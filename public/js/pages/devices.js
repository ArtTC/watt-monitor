import { api, escapeHtml, formatDate, deviceIsOnline } from "../api.js";

function renderDeviceRow(device) {
    const online = deviceIsOnline(device.ultima_medicao);
    return `
      <div class="device-list-item">
        <div class="device-list-info">
          <strong>${escapeHtml(device.nome)} <span class="device-status"><span class="dot ${online ? "online" : "offline"}"></span>${online ? "Online" : "Offline"}</span></strong>
          <span>${escapeHtml(device.esp_id)}</span><br>
          <span>${device.ultima_medicao ? `Última medição: ${formatDate(device.ultima_medicao)}` : "Ainda não recebeu medições"}</span>
        </div>
        <a class="btn" href="#/dispositivos/${encodeURIComponent(device.esp_id)}">Abrir dispositivo</a>
      </div>`;
}

export async function mountDevices(container) {
    container.innerHTML = `<div class="page-heading"><div><div class="eyebrow">Equipamentos</div><h2>Dispositivos</h2><p>Cadastre e acompanhe os ESP32 vinculados à sua conta.</p></div></div><div class="empty">Carregando...</div>`;
    const devices = await api("/api/dispositivos");

    container.innerHTML = `
      <div class="page-heading"><div><div class="eyebrow">Equipamentos</div><h2>Dispositivos</h2><p>Um usuário pode vincular vários ESP32. Cada MAC só pode pertencer a uma conta.</p></div></div>
      <section class="panel">
        <h3>Adicionar ESP32</h3>
        <p class="panel-copy">Informe o nome do equipamento e o endereço MAC exibido no Monitor Serial do ESP32.</p>
        <div id="device-form-notice" class="notice" role="alert"></div>
        <form id="device-form">
          <div class="form-row">
            <div class="field"><label for="device-name">Nome do dispositivo</label><input id="device-name" name="nome" required minlength="2" maxlength="60" placeholder="Ex.: Painel solar da garagem"></div>
            <div class="field"><label for="device-mac">Endereço MAC</label><input id="device-mac" name="esp_id" required maxlength="17" placeholder="AA:BB:CC:DD:EE:FF" autocapitalize="characters" autocomplete="off"></div>
          </div>
          <div class="form-actions"><button class="btn btn-primary" id="device-submit" type="submit">Vincular dispositivo</button></div>
        </form>
      </section>
      <section class="panel">
        <div class="section-head"><div><h3>Meus equipamentos</h3><p class="section-sub">Os dados exibidos pertencem somente à sua conta.</p></div><span class="period">${devices.length} cadastrado(s)</span></div>
        ${devices.length ? `<div class="device-list">${devices.map(renderDeviceRow).join("")}</div>` : `<div class="empty">Você ainda não cadastrou nenhum ESP32.</div>`}
      </section>`;

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
            await api("/api/dispositivos", {
                method: "POST",
                body: JSON.stringify({
                    nome: document.getElementById("device-name").value,
                    esp_id: macInput.value
                })
            });
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
