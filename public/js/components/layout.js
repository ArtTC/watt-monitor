import { escapeHtml } from "../api.js";

export function applyTheme(theme = localStorage.getItem("medidor-tema") || "light") {
    const selected = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = selected;
    localStorage.setItem("medidor-tema", selected);
    document.querySelectorAll("#theme-toggle").forEach((button) => {
        button.textContent = selected === "dark" ? "☀ Tema claro" : "☾ Tema escuro";
        button.setAttribute("aria-label", selected === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
    });
    window.dispatchEvent(new Event("themechange"));
}

export function renderThemeToggle() { return `<button class="btn btn-quiet" id="theme-toggle" type="button"></button>`; }

export function bindThemeToggle() {
    applyTheme();
    document.getElementById("theme-toggle")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
}

export function bindSidebar() {
    const shell = document.getElementById("app-shell");
    const toggle = document.getElementById("sidebar-toggle");
    if (!shell || !toggle) return;
    const mobile = () => window.matchMedia("(max-width: 800px)").matches;
    const saved = localStorage.getItem("medidor-sidebar") === "collapsed";
    if (saved && !mobile()) shell.classList.add("sidebar-collapsed");
    const sync = () => {
        if (!mobile()) shell.classList.remove("sidebar-open");
        const expanded = mobile() ? shell.classList.contains("sidebar-open") : !shell.classList.contains("sidebar-collapsed");
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.setAttribute("aria-label", expanded ? "Recolher barra lateral" : "Expandir barra lateral");
    };
    toggle.addEventListener("click", () => {
        if (mobile()) shell.classList.toggle("sidebar-open");
        else {
            shell.classList.toggle("sidebar-collapsed");
            localStorage.setItem("medidor-sidebar", shell.classList.contains("sidebar-collapsed") ? "collapsed" : "expanded");
        }
        sync();
    });
    shell.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () => shell.classList.remove("sidebar-open")));
    shell.addEventListener("click", (event) => { if (event.target === shell && mobile()) shell.classList.remove("sidebar-open"); });
    window.addEventListener("resize", sync);
    sync();
}

export function renderAppLayout(user, activePage, content) {
    return `
      <div class="app-shell" id="app-shell">
        <aside class="app-sidebar" id="app-sidebar" aria-label="Barra lateral">
          <div class="brand sidebar-brand"><div class="brand-mark"><img src="/watt-monitor-icon.svg" alt=""></div><div class="sidebar-brand-copy"><h1>Watt Monitor</h1><p>Monitoramento fotovoltaico</p></div></div>
          <nav class="main-nav" aria-label="Navegação principal">
            <a href="#/dashboard" title="Visão geral" class="${activePage === "dashboard" ? "active" : ""}">⌂ <span>Visão geral</span></a>
            <a href="#/relatorios" title="Relatórios" class="${activePage === "reports" ? "active" : ""}">▤ <span>Relatórios</span></a>
            <a href="#/analises" title="Análises" class="${activePage === "analytics" ? "active" : ""}">⌁ <span>Análises</span></a>
          </nav>
        </aside>
        <div class="app-main">
          <header class="app-header">
            <button class="btn btn-quiet sidebar-toggle" id="sidebar-toggle" type="button" aria-controls="app-sidebar" aria-expanded="true" aria-label="Recolher barra lateral">☰</button>
            <div class="brand mobile-brand"><div class="brand-mark"><img src="/watt-monitor-icon.svg" alt=""></div><div><h1>Watt Monitor</h1></div></div>
            <div class="app-header-right"><span class="user-chip">${escapeHtml(user?.nome || "Usuário")}</span>${renderThemeToggle()}<button class="btn btn-quiet" id="logout-button" type="button">Sair</button></div>
          </header>
          <main id="page-content">${content}</main>
        </div>
      </div>`;
}

export function bindLogout(onLogout) {
    document.getElementById("logout-button")?.addEventListener("click", onLogout);
    bindThemeToggle();
    bindSidebar();
}
