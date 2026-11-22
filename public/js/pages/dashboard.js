import { api, escapeHtml, formatNumber, formatDate, deviceIsOnline } from "../api.js";

function deviceCard(device) {
    const online = deviceIsOnline(device.ultima_medicao);
    const voltage = device.ultima_tensao == null ? "—" : `${formatNumber(device.ultima_tensao)} V`;
    const current = device.ultima_corrente == null ? "—" : `${formatNumber(device.ultima_corrente, 3)} A`;
    const power = device.ultima_potencia == null ? "—" : `${formatNumber(device.ultima_potencia)} W`;
    return `
      <a class="device-card" href="#/dispositivos/${encodeURIComponent(device.esp_id)}">
        <div class="device-card-head">
          <div><h3>${escapeHtml(device.nome)}</h3><div class="device-mac">${escapeHtml(device.esp_id)}</div></div>
          <span class="device-status"><span class="dot ${online ? "online" : "offline"}"></span>${online ? "Online" : "Sem comunicação"}</span>
        </div>
        <div class="device-stats">
          <div><div class="device-stat-label">TENSÃO</div><div class="device-stat-value">${voltage}</div></div>
          <div><div class="device-stat-label">CORRENTE</div><div class="device-stat-value">${current}</div></div>
          <div><div class="device-stat-label">POTÊNCIA</div><div class="device-stat-value">${power}</div></div>
        </div>
        <div class="device-last">${device.ultima_medicao ? `Última medição: ${formatDate(device.ultima_medicao)}` : "Aguardando primeira medição"}</div>
      </a>`;
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
          <section class="panel"><div class="section-head"><div><h3>Dispositivos</h3><p class="section-sub">Selecione um equipamento para consultar as medições e o gráfico.</p></div><span class="period">${devices.length} equipamento(s)</span></div>
            ${devices.length ? `<div class="device-grid">${devices.map(deviceCard).join("")}</div>` : `<div class="empty-state"><h3>Nenhum ESP32 cadastrado</h3><p>Cadastre o endereço MAC do seu primeiro equipamento para começar a receber medições.</p><a class="btn btn-primary" href="#/dispositivos">Cadastrar ESP32</a></div>`}
          </section>`;
    } catch (error) {
        container.innerHTML = `<div class="notice show">${escapeHtml(error.message)}</div>`;
        throw error;
    }
}
