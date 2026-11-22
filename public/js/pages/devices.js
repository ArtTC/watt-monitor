import { api, escapeHtml, formatDate, deviceIsOnline } from "../api.js";

function renderDeviceRow(device) {
    const online = deviceIsOnline(device.ultima_medicao);
    const actions = device.ativo
        ? `<a class="btn" href="#/dispositivos/${encodeURIComponent(device.esp_id)}">Abrir dispositivo</a><button class="btn edit-device-mac" data-mac="${escapeHtml(device.esp_id)}" type="button">Editar MAC</button><button class="btn btn-danger delete-device" data-mac="${escapeHtml(device.esp_id)}" type="button">Excluir</button>`
        : `<button class="btn restore-device" data-mac="${escapeHtml(device.esp_id)}" type="button">Reativar</button>`;
    return `<tr>
      <td><strong>${escapeHtml(device.nome)}</strong></td>
      <td>${escapeHtml(device.esp_id)}</td>
      <td>${device.ativo ? "Ativo" : "Removido"}</td>
      <td><span class="device-status"><span class="dot ${online && device.ativo ? "online" : "offline"}"></span>${device.ativo ? (online ? "Online" : "Offline") : "Inativo"}</span></td>
      <td>${device.ultima_medicao ? escapeHtml(formatDate(device.ultima_medicao)) : "Aguardando medição"}</td>
      <td><div class="device-table-actions">${actions}</div></td>
    </tr>`;
}

export async function mountDevices(container) {
    container.innerHTML = `<div class="page-heading"><div><div class="eyebrow">Equipamentos</div><h2>Dispositivos</h2><p>Cadastre e acompanhe os ESP32 vinculados à sua conta.</p></div></div><div class="empty">Carregando...</div>`;
    const [activeDevices, deletedDevices] = await Promise.all([api("/api/dispositivos"), api("/api/dispositivos/removidos")]);
    const devices = [
        ...activeDevices.map((device) => ({ ...device, ativo: true })),
        ...deletedDevices.map((device) => ({ ...device, ativo: false }))
    ];

    container.innerHTML = `
      <div class="page-heading"><div><div class="eyebrow">Equipamentos</div><h2>Dispositivos</h2><p>Um usuário pode vincular vários ESP32. Cada MAC só pode pertencer a uma conta.</p></div><div class="page-actions"><button class="btn btn-primary" id="open-device-modal" type="button">+ Adicionar dispositivo</button></div></div>
      <dialog class="device-add-modal" id="device-add-modal" aria-labelledby="device-modal-title">
        <div class="modal-head"><div><h3 id="device-modal-title">Adicionar ESP32</h3><p>Informe o nome do equipamento e o endereço MAC exibido no Monitor Serial do ESP32.</p></div><button class="close-btn" data-close-device-modal type="button" aria-label="Fechar">×</button></div>
        <div id="device-form-notice" class="notice" role="alert"></div>
        <form id="device-form">
          <div class="form-row">
            <div class="field"><label for="device-name">Nome do dispositivo</label><input id="device-name" name="nome" required minlength="2" maxlength="60" placeholder="Ex.: Painel solar da garagem"></div>
            <div class="field"><label for="device-mac">Endereço MAC</label><input id="device-mac" name="esp_id" required maxlength="17" placeholder="AA:BB:CC:DD:EE:FF" autocapitalize="characters" autocomplete="off"></div>
          </div>
          <div class="form-actions"><button class="btn" data-close-device-modal type="button">Cancelar</button><button class="btn btn-primary" id="device-submit" type="submit">Vincular dispositivo</button></div>
        </form>
      </dialog>
      <section class="panel"><div class="section-head"><div><h3>Meus equipamentos</h3><p class="section-sub">Os dados exibidos pertencem somente à sua conta.</p></div><span class="period" id="devices-count">${devices.length} dispositivo(s)</span></div>
        ${devices.length ? `<div class="devices-table-toolbar"><label for="devices-status-filter">Status</label><select id="devices-status-filter" class="devices-status-filter"><option value="active" selected>Ativos</option><option value="all">Todos</option><option value="removed">Removidos</option></select></div>
        <div class="table-scroll"><table class="device-management-table"><thead><tr>
          <th>Equipamento<input class="table-filter device-column-filter" data-filter="nome" type="search" placeholder="Filtrar equipamento" aria-label="Filtrar por equipamento"></th>
          <th>MAC<input class="table-filter device-column-filter" data-filter="mac" type="search" placeholder="Filtrar MAC" aria-label="Filtrar por MAC"></th>
          <th>Status<input class="table-filter device-column-filter" data-filter="situacao" type="search" placeholder="Filtrar status" aria-label="Filtrar por status ativo ou removido"></th>
          <th>Comunicação<input class="table-filter device-column-filter" data-filter="comunicacao" type="search" placeholder="Filtrar comunicação" aria-label="Filtrar por comunicação"></th>
          <th>Última medição<input class="table-filter device-column-filter" data-filter="data" type="search" placeholder="Filtrar data" aria-label="Filtrar por última medição"></th>
          <th>Ações</th>
        </tr></thead><tbody id="devices-table-body"></tbody></table></div>
        <div class="report-table-controls"><label class="report-page-size">Linhas por página<select id="devices-page-size"><option>10</option><option>25</option><option>50</option><option>100</option></select></label><div class="report-pagination"><button class="btn" id="devices-prev" type="button">Anterior</button><span id="devices-page-label">Página 1 de 1</span><button class="btn" id="devices-next" type="button">Próxima</button></div></div>` : `<div class="empty">Você ainda não cadastrou nenhum ESP32.</div>`}
      </section>`;

    if (devices.length) {
        const filters = { nome: "", mac: "", situacao: "", comunicacao: "", data: "" };
        let page = 0;
        let pageSize = 10;
        const renderTable = () => {
            const status = document.getElementById("devices-status-filter").value;
            const filtered = devices.filter((device) => {
                if (status === "active" && !device.ativo || status === "removed" && device.ativo) return false;
                const online = device.ativo && deviceIsOnline(device.ultima_medicao);
                const values = {
                    nome: device.nome,
                    mac: device.esp_id,
                    situacao: device.ativo ? "ativo" : "removido",
                    comunicacao: device.ativo ? (online ? "online" : "offline") : "inativo",
                    data: device.ultima_medicao ? formatDate(device.ultima_medicao) : "aguardando medição"
                };
                return Object.entries(filters).every(([key, term]) => !term || String(values[key] ?? "").toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")));
            });
            const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
            page = Math.min(page, pages - 1);
            const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
            const tbody = document.getElementById("devices-table-body");
            tbody.innerHTML = visible.map(renderDeviceRow).join("") || `<tr><td colspan="6" class="empty">Nenhum dispositivo corresponde aos filtros.</td></tr>`;
            document.getElementById("devices-count").textContent = `${filtered.length} dispositivo(s)`;
            document.getElementById("devices-page-label").textContent = `Página ${page + 1} de ${pages}`;
            document.getElementById("devices-prev").disabled = page === 0;
            document.getElementById("devices-next").disabled = page >= pages - 1;

            tbody.querySelectorAll(".delete-device").forEach((button) => button.addEventListener("click", async () => {
                if (!window.confirm("Remover este dispositivo? O histórico será preservado e o ESP32 deixará de enviar medições.")) return;
                try { await api(`/api/dispositivos/${encodeURIComponent(button.dataset.mac)}`, { method: "DELETE" }); await mountDevices(container); } catch (error) { window.alert(error.message); }
            }));
            tbody.querySelectorAll(".restore-device").forEach((button) => button.addEventListener("click", async () => {
                try { await api(`/api/dispositivos/${encodeURIComponent(button.dataset.mac)}/reativar`, { method: "PATCH" }); await mountDevices(container); } catch (error) { window.alert(error.message); }
            }));
            tbody.querySelectorAll(".edit-device-mac").forEach((button) => button.addEventListener("click", async () => {
                const mac = window.prompt("Informe o novo endereço MAC:", button.dataset.mac);
                if (mac === null || !mac.trim()) return;
                try {
                    await api(`/api/dispositivos/${encodeURIComponent(button.dataset.mac)}`, { method: "PATCH", body: JSON.stringify({ esp_id: mac.trim().toUpperCase() }) });
                    await mountDevices(container);
                } catch (error) { window.alert(error.message); }
            }));
        };
        container.querySelectorAll(".device-column-filter").forEach((input) => input.addEventListener("input", () => {
            filters[input.dataset.filter] = input.value.trim();
            page = 0;
            renderTable();
        }));
        document.getElementById("devices-status-filter").addEventListener("change", () => { page = 0; renderTable(); });
        document.getElementById("devices-page-size").addEventListener("change", (event) => { pageSize = Number(event.target.value); page = 0; renderTable(); });
        document.getElementById("devices-prev").addEventListener("click", () => { page--; renderTable(); });
        document.getElementById("devices-next").addEventListener("click", () => { page++; renderTable(); });
        renderTable();
    }

    const modal = document.getElementById("device-add-modal");
    document.getElementById("open-device-modal").addEventListener("click", () => modal.showModal());
    container.querySelectorAll("[data-close-device-modal]").forEach((button) => button.addEventListener("click", () => modal.close()));
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
    const macInput = document.getElementById("device-mac");
    macInput.addEventListener("input", () => { macInput.value = macInput.value.toUpperCase(); });
    document.getElementById("device-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = document.getElementById("device-submit");
        const notice = document.getElementById("device-form-notice");
        notice.className = "notice";
        notice.textContent = "";
        button.disabled = true;
        button.textContent = "Vinculando...";
        try {
            await api("/api/dispositivos", { method: "POST", body: JSON.stringify({ nome: document.getElementById("device-name").value, esp_id: macInput.value }) });
            modal.close();
            await mountDevices(container);
            const success = document.createElement("div");
            success.className = "notice success show";
            success.textContent = "ESP32 vinculado com sucesso à sua conta.";
            container.querySelector(".panel")?.prepend(success);
        } catch (error) {
            notice.textContent = error.message;
            notice.classList.add("show");
        } finally {
            button.disabled = false;
            button.textContent = "Vincular dispositivo";
        }
    });
}
