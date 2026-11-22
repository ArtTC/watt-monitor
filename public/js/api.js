const TOKEN_KEY = "medidor_solar_token";

export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
}

export async function api(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const error = new Error(payload?.mensagem || payload || `Erro HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return payload;
}

export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

export function formatNumber(value, decimals = 2) {
    const number = Number(value);
    return Number.isFinite(number)
        ? number.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : "—";
}

export function formatDate(value) {
    if (!value) return "Sem medições";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data indisponível";
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function deviceIsOnline(value, seconds = 20) {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && (Date.now() - timestamp) / 1000 <= seconds;
}
