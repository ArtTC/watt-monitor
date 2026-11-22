import { api, escapeHtml, formatNumber, formatDate, deviceIsOnline } from "../api.js";
import { drawPowerChart } from "../components/chart.js";

let themeListener = null;

export async function mountDeviceDetail(container, mac) {
    container.innerHTML = `<div class="empty">Carregando medições do equipamento...</div>`;
    const [devices, records] = await Promise.all([
        api("/api/dispositivos"),
        api(`/api/medicoes/${encodeURIComponent(mac)}`)
    ]);
    const device = devices.find((item) => item.esp_id === mac);
    if (!device) {
        container.innerHTML = `<div class="notice show">Equipamento não encontrado na sua conta.</div><a class="auth-back" href="#/dispositivos">← Voltar aos equipamentos</a>`;
        return;
    }

    const latest = records[0];
    const online = deviceIsOnline(latest?.data_hora);
    container.innerHTML = `
      <a class="breadcrumb" href="#/dispositivos">← Voltar aos equipamentos</a>
      <div class="page-heading device-detail-heading"><div><div class="eyebrow">Detalhes do equipamento</div><h2>${escapeHtml(device.nome)}</h2><p>${escapeHtml(device.esp_id)}</p></div><div class="page-actions detail-actions"><span class="device-status"><span class="dot ${online ? "online" : "offline"}"></span>${online ? "Online" : "Offline"}</span><button class="btn" id="detail-edit" type="button">Editar</button><button class="btn btn-danger" id="detail-remove" type="button">Excluir</button></div></div>
      <dialog class="device-add-modal" id="detail-edit-modal" aria-labelledby="detail-edit-title">
        <div class="modal-head"><div><h3 id="detail-edit-title">Editar equipamento</h3><p>Atualize o nome e o endereço MAC deste equipamento.</p></div><button class="close-btn" data-close-detail-edit type="button" aria-label="Fechar">×</button></div>
        <form id="detail-edit-form"><div class="form-row">
          <div class="field"><label for="detail-edit-name">Nome do equipamento</label><input id="detail-edit-name" required minlength="2" maxlength="60" value="${escapeHtml(device.nome)}"></div>
          <div class="field"><label for="detail-edit-mac">Endereço MAC</label><input id="detail-edit-mac" required maxlength="17" value="${escapeHtml(device.esp_id)}" autocapitalize="characters" autocomplete="off"></div>
        </div><div id="detail-edit-notice" class="notice" role="alert"></div><div class="form-actions"><button class="btn" data-close-detail-edit type="button">Cancelar</button><button class="btn btn-primary" id="detail-edit-save" type="submit">Salvar alterações</button></div></form>
      </dialog>
      <section class="detail-metrics">
        <article class="metric"><div class="metric-top"><span>Tensão</span><span class="metric-icon">ϟ</span></div><div class="metric-value"><span id="detail-voltage">${latest ? formatNumber(latest.tensao) : "—"}</span><span class="metric-unit">V</span></div><div class="metric-foot">Tensão elétrica</div></article>
        <article class="metric"><div class="metric-top"><span>Corrente</span><span class="metric-icon">↯</span></div><div class="metric-value"><span id="detail-current">${latest ? formatNumber(latest.corrente, 3) : "—"}</span><span class="metric-unit">A</span></div><div class="metric-foot">Corrente elétrica</div></article>
        <article class="metric"><div class="metric-top"><span>Potência</span><span class="metric-icon">⌁</span></div><div class="metric-value"><span id="detail-power">${latest ? formatNumber(latest.potencia) : "—"}</span><span class="metric-unit">W</span></div><div class="metric-foot">Potência elétrica instantânea</div></article>
      </section>
      <section class="panel" style="margin-top:14px">
        <div class="section-head"><div><h3>Histórico de potência</h3><p class="section-sub">Últimas 100 medições recebidas deste ESP32.</p></div><span class="period">${records.length} registro(s)</span></div>
        <div class="chart-wrap detail-chart"><canvas id="device-power-chart" aria-label="Gráfico de potência"></canvas></div>
        <div class="empty" id="device-chart-empty" hidden>Nenhuma medição disponível para este equipamento.</div>
        <div class="device-last">${latest ? `Última medição: ${formatDate(latest.data_hora)}` : "Aguardando a primeira medição"}</div>
      </section>`;

    document.getElementById("detail-remove").addEventListener("click", async () => {
        if (!window.confirm(`Remover ${device.nome}? O histórico será preservado.`)) return;
        await api(`/api/dispositivos/${encodeURIComponent(device.esp_id)}`, { method: "DELETE" });
        window.location.hash = "#/dispositivos";
    });
    const editModal = document.getElementById("detail-edit-modal");
    document.getElementById("detail-edit").addEventListener("click", () => editModal.showModal());
    container.querySelectorAll("[data-close-detail-edit]").forEach((button) => button.addEventListener("click", () => editModal.close()));
    editModal.addEventListener("click", (event) => { if (event.target === editModal) editModal.close(); });
    document.getElementById("detail-edit-mac").addEventListener("input", (event) => { event.target.value = event.target.value.toUpperCase(); });
    document.getElementById("detail-edit-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const saveButton = document.getElementById("detail-edit-save");
        const notice = document.getElementById("detail-edit-notice");
        const newMac = document.getElementById("detail-edit-mac").value.trim().toUpperCase();
        const name = document.getElementById("detail-edit-name").value.trim();
        saveButton.disabled = true;
        notice.className = "notice";
        notice.textContent = "";
        try {
            await api(`/api/dispositivos/${encodeURIComponent(device.esp_id)}`, { method: "PATCH", body: JSON.stringify({ nome: name, esp_id: newMac }) });
            editModal.close();
            await mountDeviceDetail(container, newMac);
        } catch (error) {
            notice.textContent = error.message;
            notice.classList.add("show");
        } finally { saveButton.disabled = false; }
    });
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
    if (themeListener) window.removeEventListener("themechange", themeListener);
    themeListener = () => {
        const canvas = document.getElementById("device-power-chart");
        const empty = document.getElementById("device-chart-empty");
        if (canvas && empty) drawPowerChart(canvas, empty, [...records].reverse());
    };
    window.addEventListener("themechange", themeListener);
}
