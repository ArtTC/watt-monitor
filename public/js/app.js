import { api, getToken, clearToken, escapeHtml } from "./api.js";
import { navigate, resolveRoute, startRouter } from "./router.js";
import { renderAppLayout, bindLogout } from "./components/layout.js";
import { renderLogin } from "./pages/login.js";
import { renderRegister } from "./pages/register.js";
import { mountDashboard } from "./pages/dashboard.js";
import { mountDevices } from "./pages/devices.js";
import { mountDeviceDetail } from "./pages/device-detail.js";
import { mountReports } from "./pages/reports.js";
import { mountAnalytics } from "./pages/analytics.js";

const app = document.getElementById("app");
let refreshTimer = null;
let renderSequence = 0;

function stopRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
}

async function logout() {
    try {
        await api("/api/auth/logout", { method: "POST" });
    } catch (error) {
        console.warn("Não foi possível encerrar a sessão no servidor:", error);
    }
    clearToken();
    navigate("/login");
}

function renderAuthScreen(route) {
    if (route.name === "register") {
        renderRegister(app, {
            onAuthenticated: () => navigate("/dashboard"),
            onLogin: () => navigate("/login")
        });
    } else {
        renderLogin(app, {
            onAuthenticated: () => navigate("/dashboard"),
            onRegister: () => navigate("/cadastro")
        });
    }
}

async function renderProtectedScreen(route, sequence) {
    const token = getToken();
    if (!token) {
        navigate("/login");
        return;
    }

    let result;
    try {
        result = await api("/api/auth/me");
    } catch (error) {
        if (error.status === 401) {
            clearToken();
            navigate("/login");
            return;
        }
        app.innerHTML = `<main class="shell"><div class="notice show">${escapeHtml(error.message)}</div></main>`;
        return;
    }

    if (sequence !== renderSequence) return;

    const activePage = route.name === "devices" || route.name === "device-detail" ? "devices" : route.name === "reports" ? "reports" : route.name === "analytics" ? "analytics" : "dashboard";
    app.innerHTML = renderAppLayout(result.usuario, activePage, `<div class="empty">Carregando...</div>`);
    bindLogout(logout);
    const content = document.getElementById("page-content");

    try {
        if (route.name === "dashboard") {
            await mountDashboard(content);
            stopRefresh();
            refreshTimer = setInterval(async () => {
                if (resolveRoute().name !== "dashboard") return;
                try { await mountDashboard(content); }
                catch (error) { handlePageError(error); }
            }, 5000);
        } else if (route.name === "devices") {
            await mountDevices(content);
        } else if (route.name === "device-detail") {
            await mountDeviceDetail(content, route.mac);
            stopRefresh();
            refreshTimer = setInterval(async () => {
                const current = resolveRoute();
                if (current.name !== "device-detail" || current.mac !== route.mac) return;
                try { await mountDeviceDetail(content, route.mac); }
                catch (error) { handlePageError(error); }
            }, 5000);
        } else if (route.name === "reports") {
            await mountReports(content, result.usuario);
        } else if (route.name === "analytics") {
            await mountAnalytics(content, result.usuario);
        } else {
            content.innerHTML = `<section class="panel"><h3>Página não encontrada</h3><p class="panel-copy">O endereço solicitado não existe.</p><a class="btn btn-primary" href="#/dashboard">Voltar ao painel</a></section>`;
        }
    } catch (error) {
        handlePageError(error);
    }
}

function handlePageError(error) {
    if (error.status === 401) {
        clearToken();
        navigate("/login");
        return;
    }
    const content = document.getElementById("page-content") || app;
    content.innerHTML = `<div class="notice show">${escapeHtml(error.message || "Erro ao carregar a tela.")}</div>`;
}

async function renderRoute() {
    const sequence = ++renderSequence;
    stopRefresh();
    const route = resolveRoute();

    if (route.name === "login" || route.name === "register") {
        if (getToken()) {
            try {
                await api("/api/auth/me");
                if (sequence === renderSequence) navigate("/dashboard");
                return;
            } catch {
                clearToken();
            }
        }
        if (sequence === renderSequence) renderAuthScreen(route);
        return;
    }

    await renderProtectedScreen(route, sequence);
}

startRouter(() => {
    renderRoute().catch((error) => {
        console.error("Erro ao abrir tela:", error);
        app.innerHTML = `<main class="shell"><div class="notice show">Ocorreu um erro ao abrir o painel.</div></main>`;
    });
});
