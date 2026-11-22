import { api, escapeHtml, formatNumber, formatDate, deviceIsOnline } from "../api.js";

function deviceRow(device) {
    const online = deviceIsOnline(device.ultima_medicao);
    const voltage = device.ultima_tensao == null ? "—" : `${formatNumber(device.ultima_tensao)} V`;
    const current = device.ultima_corrente == null ? "—" : `${formatNumber(device.ultima_corrente, 3)} A`;
    const power = device.ultima_potencia == null ? "—" : `${formatNumber(device.ultima_potencia)} W`;
    const href = `#/dispositivos/${encodeURIComponent(device.esp_id)}`;
    return `<tr class="dashboard-device-row" data-href="${escapeHtml(href)}" role="link" tabindex="0" aria-label="Abrir detalhes de ${escapeHtml(device.nome)}">
      <td><strong>${escapeHtml(device.nome)}</strong></td>
      <td>${escapeHtml(device.esp_id)}</td>
      <td><span class="device-status"><span class="dot ${online ? "online" : "offline"}"></span>${online ? "Online" : "Sem comunicação"}</span></td>
      <td>${voltage}</td><td>${current}</td><td>${power}</td>
      <td>${device.ultima_medicao ? escapeHtml(formatDate(device.ultima_medicao)) : "Aguardando medição"}</td>
    </tr>`;
}

export async function mountDashboard(container) {
    container.innerHTML = `<div class="page-heading"><div><div class="eyebrow">Visão geral</div><h2>Seus sistemas solares</h2><p>Acompanhe o estado dos dispositivos vinculados à sua conta.</p></div><div class="page-actions"><a class="btn btn-primary" href="#/dispositivos">Gerenciar dispositivos</a></div></div><div class="empty">Carregando dispositivos...</div>`;

    try {
        const devices = await api("/api/dispositivos");
        const onlineCount = devices.filter((device) => deviceIsOnline(device.ultima_medicao)).length;
        const measuredCount = devices.filter((device) => device.ultima_medicao).length;

        container.innerHTML = `
          <div class="page-heading"><div><div class="eyebrow">Visão geral</div><h2>Seus sistemas solares</h2><p>Acompanhe o estado dos dispositivos vinculados à sua conta.</p></div><div class="page-actions"><a class="btn btn-primary" href="#/dispositivos">+ Gerenciar dispositivos</a></div></div>
          <section class="summary-grid">
            <div class="summary-card"><div class="summary-label">DISPOSITIVOS CADASTRADOS</div><div class="summary-value">${devices.length}</div><div class="summary-note">Vinculados à sua conta</div></div>
            <div class="summary-card"><div class="summary-label">ONLINE</div><div class="summary-value">${onlineCount}</div><div class="summary-note">Medição nos últimos 20 segundos</div></div>
            <div class="summary-card"><div class="summary-label">COM HISTÓRICO</div><div class="summary-value">${measuredCount}</div><div class="summary-note">Já enviaram alguma medição</div></div>
          </section>
          <section class="panel"><div class="section-head"><div><h3>Dispositivos</h3><p class="section-sub">Selecione um equipamento para consultar as medições e o gráfico.</p></div><span class="period" id="dashboard-device-count">${devices.length} equipamento(s)</span></div>
            ${devices.length ? `<div class="table-scroll"><table class="dashboard-device-table"><thead><tr>
              <th>Equipamento<input class="table-filter dashboard-device-filter" data-filter="equipamento" type="search" placeholder="Filtrar equipamento" aria-label="Filtrar por equipamento"></th>
              <th>MAC<input class="table-filter dashboard-device-filter" data-filter="mac" type="search" placeholder="Filtrar MAC" aria-label="Filtrar por MAC"></th>
              <th>Status<input class="table-filter dashboard-device-filter" data-filter="status" type="search" placeholder="Filtrar status" aria-label="Filtrar por status"></th>
              <th>Tensão<input class="table-filter dashboard-device-filter" data-filter="tensao" type="search" placeholder="Filtrar tensão" aria-label="Filtrar por tensão"></th>
              <th>Corrente<input class="table-filter dashboard-device-filter" data-filter="corrente" type="search" placeholder="Filtrar corrente" aria-label="Filtrar por corrente"></th>
              <th>Potência<input class="table-filter dashboard-device-filter" data-filter="potencia" type="search" placeholder="Filtrar potência" aria-label="Filtrar por potência"></th>
              <th>Última medição<input class="table-filter dashboard-device-filter" data-filter="data" type="search" placeholder="Filtrar data" aria-label="Filtrar por última medição"></th>
            </tr></thead><tbody id="dashboard-device-body"></tbody></table></div>
            <div class="report-table-controls"><label class="report-page-size">Linhas por página<select id="dashboard-page-size"><option>10</option><option>25</option><option>50</option><option>100</option></select></label><div class="report-pagination"><button class="btn" id="dashboard-prev" type="button">Anterior</button><span id="dashboard-page-label">Página 1 de 1</span><button class="btn" id="dashboard-next" type="button">Próxima</button></div></div>` : `<div class="empty-state"><h3>Nenhum ESP32 cadastrado</h3><p>Cadastre o endereço MAC do seu primeiro equipamento para começar a receber medições.</p><a class="btn btn-primary" href="#/dispositivos">Cadastrar ESP32</a></div>`}
          </section>`;
        if (devices.length) {
            const filters = { equipamento: "", mac: "", status: "", tensao: "", corrente: "", potencia: "", data: "" };
            let page = 0;
            let pageSize = 10;
            const renderRows = () => {
                const filtered = devices.filter((device) => {
                    const online = deviceIsOnline(device.ultima_medicao);
                    const values = {
                        equipamento: device.nome,
                        mac: device.esp_id,
                        status: online ? "online" : "sem comunicação",
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
                const body = document.getElementById("dashboard-device-body");
                body.innerHTML = visible.map(deviceRow).join("") || `<tr><td colspan="7" class="empty">Nenhum equipamento corresponde aos filtros.</td></tr>`;
                document.getElementById("dashboard-device-count").textContent = `${filtered.length} equipamento(s)`;
                document.getElementById("dashboard-page-label").textContent = `Página ${page + 1} de ${pages}`;
                document.getElementById("dashboard-prev").disabled = page === 0;
                document.getElementById("dashboard-next").disabled = page >= pages - 1;
                body.querySelectorAll(".dashboard-device-row").forEach((row) => {
                    row.addEventListener("click", () => { window.location.hash = row.dataset.href; });
                    row.addEventListener("keydown", (event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault(); window.location.hash = row.dataset.href;
                    });
                });
            };
            container.querySelectorAll(".dashboard-device-filter").forEach((input) => input.addEventListener("input", () => {
                filters[input.dataset.filter] = input.value.trim();
                page = 0;
                renderRows();
            }));
            document.getElementById("dashboard-page-size").addEventListener("change", (event) => { pageSize = Number(event.target.value); page = 0; renderRows(); });
            document.getElementById("dashboard-prev").addEventListener("click", () => { page--; renderRows(); });
            document.getElementById("dashboard-next").addEventListener("click", () => { page++; renderRows(); });
            renderRows();
        }
    } catch (error) {
        container.innerHTML = `<div class="notice show">${escapeHtml(error.message)}</div>`;
        throw error;
    }
}
