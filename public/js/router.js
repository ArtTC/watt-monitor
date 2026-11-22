export function navigate(path) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (window.location.hash === `#${normalized}`) {
        window.dispatchEvent(new Event("hashchange"));
    } else {
        window.location.hash = normalized;
    }
}

export function resolveRoute() {
    const raw = window.location.hash.replace(/^#/, "") || "/login";
    const [pathname] = raw.split("?");
    const parts = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));

    if (parts.length === 0) return { name: "login" };
    if (parts[0] === "login") return { name: "login" };
    if (parts[0] === "cadastro") return { name: "register" };
    if (parts[0] === "dashboard") return { name: "dashboard" };
    if (parts[0] === "dispositivos" && parts.length === 1) return { name: "devices" };
    if (parts[0] === "dispositivos" && parts.length === 2) return { name: "device-detail", mac: parts[1] };
    return { name: "not-found" };
}

export function startRouter(callback) {
    window.addEventListener("hashchange", callback);
    callback();
}
