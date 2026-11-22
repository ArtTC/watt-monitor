import { api, escapeHtml, formatNumber, formatDate, deviceIsOnline } from "../api.js";

function renderDeviceRow(device) {
    const online = deviceIsOnline(device.ultima_medicao);
    const voltage = device.ultima_tensao == null ? "—" : `${formatNumber(device.ultima_tensao)} V`;
    const current = device.ultima_corrente == null ? "—" : `${formatNumber(device.ultima_corrente, 3)} A`;
    const power = device.ultima_potencia == null ? "—" : `${formatNumber(device.ultima_potencia)} W`;
    const actions = device.ativo
        ? `<button class="btn edit-device" data-mac="${escapeHtml(device.esp_id)}" data-name="${escapeHtml(device.nome)}" type="button">Editar</button><button class="btn btn-danger delete-device" data-mac="${escapeHtml(device.esp_id)}" type="button">Excluir</button>`
        : `<button class="btn restore-device" data-mac="${escapeHtml(device.esp_id)}" type="button">Reativar</button>`;
    const href = `#/dispositivos/${encodeURIComponent(device.esp_id)}`;
    return `<tr class="device-management-row${device.ativo ? " is-clickable" : ""}" ${device.ativo ? `data-href="${escapeHtml(href)}" role="link" tabindex="0" aria-label="Abrir detalhes de ${escapeHtml(device.nome)}"` : ""}>
      <td><strong>${escapeHtml(device.nome)}</strong></td>
      <td>${escapeHtml(device.esp_id)}</td>
      <td>${device.ativo ? "Ativo" : "Removido"}</td>
      <td><span class="device-status"><span class="dot ${online && device.ativo ? "online" : "offline"}"></span>${device.ativo ? (online ? "Online" : "Sem comunicação") : "Inativo"}</span></td>
      <td>${voltage}</td><td>${current}</td><td>${power}</td>
      <td>${device.ultima_medicao ? escapeHtml(formatDate(device.ultima_medicao)) : "Aguardando medição"}</td>
      <td><div class="device-table-actions">${actions}</div></td>
    </tr>`;
}

export async function mountDevices(container) {
    container.innerHTML = `<div class="page-heading"><div><div class="eyebrow">Visão geral</div><h2>Monitoramento solar</h2><p>Acompanhe o status e as medições dos seus equipamentos.</p></div></div><div class="empty">Carregando...</div>`;
    const [activeDevices, deletedDevices] = await Promise.all([api("/api/dispositivos"), api("/api/dispositivos/removidos")]);
    const devices = [
        ...activeDevices.map((device) => ({ ...device, ativo: true })),
        ...deletedDevices.map((device) => ({ ...device, ativo: false }))
    ];

    container.innerHTML = `
      <div class="page-heading"><div><div class="eyebrow">Visão geral</div><h2>Monitoramento solar</h2><p>Acompanhe o status e as medições dos seus equipamentos.</p></div><div class="page-actions"><button class="btn btn-primary" id="open-device-modal" type="button">+ Adicionar equipamento</button></div></div>
      <section class="summary-grid">
        <div class="summary-card"><div class="summary-label">EQUIPAMENTOS CADASTRADOS</div><div class="summary-value">${activeDevices.length}</div><div class="summary-note">Vinculados à sua conta</div></div>
        <div class="summary-card"><div class="summary-label">ONLINE</div><div class="summary-value">${activeDevices.filter((device) => deviceIsOnline(device.ultima_medicao)).length}</div><div class="summary-note">Medição nos últimos 20 segundos</div></div>
        <div class="summary-card"><div class="summary-label">COM HISTÓRICO</div><div class="summary-value">${activeDevices.filter((device) => device.ultima_medicao).length}</div><div class="summary-note">Já enviaram alguma medição</div></div>
      </section>
      <dialog class="device-add-modal" id="device-add-modal" aria-labelledby="device-modal-title">
        <div class="modal-head"><div><h3 id="device-modal-title">Adicionar equipamento</h3><p>Informe o nome e o endereço MAC exibido no monitor serial.</p></div><button class="close-btn" data-close-device-modal type="button" aria-label="Fechar">×</button></div>
        <div id="device-form-notice" class="notice" role="alert"></div>
        <form id="device-form">
          <div class="form-row">
            <div class="field"><label for="device-name">Nome do equipamento</label><input id="device-name" name="nome" required minlength="2" maxlength="60" placeholder="Ex.: Painel solar da garagem"></div>
            <div class="field"><label for="device-mac">Endereço MAC</label><input id="device-mac" name="esp_id" required maxlength="17" placeholder="AA:BB:CC:DD:EE:FF" autocapitalize="characters" autocomplete="off"></div>
          </div>
          <div class="form-actions"><button class="btn" data-close-device-modal type="button">Cancelar</button><button class="btn btn-primary" id="device-submit" type="submit">Vincular equipamento</button></div>
        </form>
      </dialog>
      <section class="panel"><div class="section-head"><div><h3>Equipamentos</h3><p class="section-sub">Selecione um equipamento para abrir os detalhes. Os dados pertencem somente à sua conta.</p></div><span class="period" id="devices-count">${devices.length} equipamento(s)</span></div>
        ${devices.length ? `<div class="devices-table-toolbar"><label for="devices-status-filter">Status</label><select id="devices-status-filter" class="devices-status-filter"><option value="active" selected>Ativos</option><option value="all">Todos</option><option value="removed">Removidos</option></select></div>
        <div class="table-scroll"><table class="device-management-table"><thead><tr>
          <th>Equipamento<input class="table-filter device-column-filter" data-filter="nome" type="search" placeholder="Filtrar equipamento" aria-label="Filtrar por equipamento"></th>
          <th>MAC<input class="table-filter device-column-filter" data-filter="mac" type="search" placeholder="Filtrar MAC" aria-label="Filtrar por MAC"></th>
          <th>Situação<input class="table-filter device-column-filter" data-filter="situacao" type="search" placeholder="Filtrar ativo/removido" aria-label="Filtrar por situação ativa ou removida"></th>
          <th>Status<input class="table-filter device-column-filter" data-filter="comunicacao" type="search" placeholder="Filtrar status" aria-label="Filtrar por comunicação"></th>
          <th>Tensão<input class="table-filter device-column-filter" data-filter="tensao" type="search" placeholder="Filtrar tensão" aria-label="Filtrar por tensão"></th>
          <th>Corrente<input class="table-filter device-column-filter" data-filter="corrente" type="search" placeholder="Filtrar corrente" aria-label="Filtrar por corrente"></th>
          <th>Potência<input class="table-filter device-column-filter" data-filter="potencia" type="search" placeholder="Filtrar potência" aria-label="Filtrar por potência"></th>
          <th>Última medição<input class="table-filter device-column-filter" data-filter="data" type="search" placeholder="Filtrar data" aria-label="Filtrar por última medição"></th>
          <th>Ações</th>
        </tr></thead><tbody id="devices-table-body"></tbody></table></div>
        <div class="report-table-controls"><label class="report-page-size">Linhas por página<select id="devices-page-size"><option>10</option><option>25</option><option>50</option><option>100</option></select></label><div class="report-pagination"><button class="btn" id="devices-prev" type="button">Anterior</button><span id="devices-page-label">Página 1 de 1</span><button class="btn" id="devices-next" type="button">Próxima</button></div></div>` : `<div class="empty">Você ainda não cadastrou nenhum equipamento.</div>`}
      </section>`;

    if (devices.length) {
        const filters = { nome: "", mac: "", situacao: "", comunicacao: "", tensao: "", corrente: "", potencia: "", data: "" };
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
                    tensao: device.ultima_tensao == null ? "" : formatNumber(device.ultima_tensao),
                    corrente: device.ultima_corrente == null ? "" : formatNumber(device.ultima_corrente, 3),
                    potencia: device.ultima_potencia == null ? "" : formatNumber(device.ultima_potencia),
                    data: device.ultima_medicao ? formatDate(device.ultima_medicao) : "aguardando medição"
                };
                return Object.entries(filters).every(([key, term]) => !term || String(values[key] ?? "").toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")));
            });
            const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
            page = Math.min(page, pages - 1);
            const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
            const tbody = document.getElementById("devices-table-body");
            tbody.innerHTML = visible.map(renderDeviceRow).join("") || `<tr><td colspan="9" class="empty">Nenhum equipamento corresponde aos filtros.</td></tr>`;
            document.getElementById("devices-count").textContent = `${filtered.length} equipamento(s)`;
            document.getElementById("devices-page-label").textContent = `Página ${page + 1} de ${pages}`;
            document.getElementById("devices-prev").disabled = page === 0;
            document.getElementById("devices-next").disabled = page >= pages - 1;

            tbody.querySelectorAll(".device-management-row.is-clickable").forEach((row) => {
                row.addEventListener("click", (event) => {
                    if (event.target.closest("button, a, input, select")) return;
                    window.location.hash = row.dataset.href;
                });
                row.addEventListener("keydown", (event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    if (event.target.closest("button, a, input, select")) return;
                    event.preventDefault();
                    window.location.hash = row.dataset.href;
                });
            });

            tbody.querySelectorAll(".delete-device").forEach((button) => button.addEventListener("click", async () => {
                if (!window.confirm("Remover este equipamento? O histórico será preservado e ele deixará de enviar medições.")) return;
                try { await api(`/api/dispositivos/${encodeURIComponent(button.dataset.mac)}`, { method: "DELETE" }); await mountDevices(container); } catch (error) { window.alert(error.message); }
            }));
            tbody.querySelectorAll(".restore-device").forEach((button) => button.addEventListener("click", async () => {
                try { await api(`/api/dispositivos/${encodeURIComponent(button.dataset.mac)}/reativar`, { method: "PATCH" }); await mountDevices(container); } catch (error) { window.alert(error.message); }
            }));
            tbody.querySelectorAll(".edit-device").forEach((button) => button.addEventListener("click", () => openEditModal(button.dataset)));
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
    const form = document.getElementById("device-form");
    const formNotice = document.getElementById("device-form-notice");
    const modalTitle = document.getElementById("device-modal-title");
    const modalDescription = modal.querySelector(".modal-head p");
    const submitButton = document.getElementById("device-submit");
    const openEditModal = ({ mac, name }) => {
        modal.dataset.mode = "edit";
        modal.dataset.originalMac = mac;
        modalTitle.textContent = "Editar equipamento";
        modalDescription.textContent = "Atualize o nome e o endereço MAC deste equipamento.";
        document.getElementById("device-name").value = name;
        document.getElementById("device-mac").value = mac;
        submitButton.textContent = "Salvar alterações";
        formNotice.className = "notice";
        formNotice.textContent = "";
        modal.showModal();
    };
    document.getElementById("open-device-modal").addEventListener("click", () => {
        modal.dataset.mode = "add";
        delete modal.dataset.originalMac;
        form.reset();
        modalTitle.textContent = "Adicionar equipamento";
        modalDescription.textContent = "Informe o nome do equipamento e o endereço MAC exibido no monitor serial.";
        submitButton.textContent = "Vincular equipamento";
        formNotice.className = "notice";
        formNotice.textContent = "";
        modal.showModal();
    });
    container.querySelectorAll("[data-close-device-modal]").forEach((button) => button.addEventListener("click", () => modal.close()));
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
    const macInput = document.getElementById("device-mac");
    macInput.addEventListener("input", () => { macInput.value = macInput.value.toUpperCase(); });
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const editing = modal.dataset.mode === "edit";
        const originalText = editing ? "Salvar alterações" : "Vincular equipamento";
        formNotice.className = "notice";
        formNotice.textContent = "";
        submitButton.disabled = true;
        submitButton.textContent = editing ? "Salvando..." : "Vinculando...";
        try {
            const body = JSON.stringify({ nome: document.getElementById("device-name").value.trim(), esp_id: macInput.value.trim().toUpperCase() });
            if (editing) await api(`/api/dispositivos/${encodeURIComponent(modal.dataset.originalMac)}`, { method: "PATCH", body });
            else await api("/api/dispositivos", { method: "POST", body });
            modal.close();
            await mountDevices(container);
            const success = document.createElement("div");
            success.className = "notice success show";
            success.textContent = editing ? "Equipamento atualizado com sucesso." : "Equipamento vinculado com sucesso à sua conta.";
            container.querySelector(".panel")?.prepend(success);
        } catch (error) {
            formNotice.textContent = error.message;
            formNotice.classList.add("show");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });
}
