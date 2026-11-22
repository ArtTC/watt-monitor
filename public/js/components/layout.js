import { escapeHtml } from "../api.js";

export function renderAppLayout(user, activePage, content) {
    return `
      <div class="app-shell">
        <header class="app-header">
          <div class="brand">
            <div class="brand-mark" aria-hidden="true">☀</div>
            <div><h1>Medidor Solar</h1><p>Monitoramento fotovoltaico</p></div>
          </div>
          <div class="app-header-right">
            <span class="user-chip">${escapeHtml(user?.nome || "Usuário")}</span>
            <button class="btn btn-quiet" id="logout-button" type="button">Sair</button>
          </div>
        </header>
        <nav class="main-nav" aria-label="Navegação principal">
          <a href="#/dashboard" class="${activePage === "dashboard" ? "active" : ""}">⌂ <span>Visão geral</span></a>
          <a href="#/dispositivos" class="${activePage === "devices" ? "active" : ""}">▦ <span>Dispositivos</span></a>
        </nav>
        <main id="page-content">${content}</main>
      </div>`;
}

export function bindLogout(onLogout) {
    document.getElementById("logout-button")?.addEventListener("click", onLogout);
}
