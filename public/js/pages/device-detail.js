import { api, escapeHtml, formatNumber, formatDate, deviceIsOnline } from "../api.js";
import { drawPowerChart } from "../components/chart.js";

export async function mountDeviceDetail(container, mac) {
    container.innerHTML = `<div class="empty">Carregando medições do dispositivo...</div>`;
    const [devices, records] = await Promise.all([
        api("/api/dispositivos"),
        api(`/api/medicoes/${encodeURIComponent(mac)}`)
    ]);
    const device = devices.find((item) => item.esp_id === mac);
    if (!device) {
        container.innerHTML = `<div class="notice show">Dispositivo não encontrado na sua conta.</div><a class="auth-back" href="#/dispositivos">← Voltar aos dispositivos</a>`;
        return;
    }

    const latest = records[0];
    const online = deviceIsOnline(latest?.data_hora);
    container.innerHTML = `
      <a class="breadcrumb" href="#/dispositivos">← Voltar aos dispositivos</a>
      <div class="page-heading"><div><div class="eyebrow">Detalhes do equipamento</div><h2>${escapeHtml(device.nome)}</h2><p>${escapeHtml(device.esp_id)}</p></div><span class="device-status"><span class="dot ${online ? "online" : "offline"}"></span>${online ? "Online" : "Sem comunicação recente"}</span></div>
      <section class="detail-metrics">
        <article class="metric"><div class="metric-top"><span>Tensão</span><span class="metric-icon">ϟ</span></div><div class="metric-value"><span id="detail-voltage">${latest ? formatNumber(latest.tensao) : "—"}</span><span class="metric-unit">V</span></div><div class="metric-foot">Tensão elétrica</div></article>
        <article class="metric"><div class="metric-top"><span>Corrente</span><span class="metric-icon">↯</span></div><div class="metric-value"><span id="detail-current">${latest ? formatNumber(latest.corrente, 3) : "—"}</span><span class="metric-unit">A</span></div><div class="metric-foot">Corrente elétrica</div></article>
        <article class="metric"><div class="metric-top"><span>Potência</span><span class="metric-icon">⌁</span></div><div class="metric-value"><span id="detail-power">${latest ? formatNumber(latest.potencia) : "—"}</span><span class="metric-unit">W</span></div><div class="metric-foot">Potência elétrica instantânea</div></article>
      </section>
      <section class="panel" style="margin-top:14px">
        <div class="section-head"><div><h3>Histórico de potência</h3><p class="section-sub">Últimas 100 medições recebidas deste ESP32.</p></div><span class="period">${records.length} registro(s)</span></div>
        <div class="chart-wrap detail-chart"><canvas id="device-power-chart" aria-label="Gráfico de potência"></canvas></div>
        <div class="empty" id="device-chart-empty" hidden>Nenhuma medição disponível para este dispositivo.</div>
        <div class="device-last">${latest ? `Última medição: ${formatDate(latest.data_hora)}` : "Aguardando a primeira medição"}</div>
      </section>`;

    drawPowerChart(
        document.getElementById("device-power-chart"),
        document.getElementById("device-chart-empty"),
        [...records].reverse()
    );
    window.addEventListener("resize", () => {
        const canvas = document.getElementById("device-power-chart");
        const empty = document.getElementById("device-chart-empty");
        if (canvas && empty) drawPowerChart(canvas, empty, [...records].reverse());
    }, { once: true });
}
