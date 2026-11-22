import { api, setToken } from "../api.js";

export function renderLogin(container, { onAuthenticated, onRegister }) {
    container.innerHTML = `
      <main class="shell auth-shell">
        <section class="auth-card">
          <div class="brand auth-brand"><div class="brand-mark" aria-hidden="true">☀</div><div><h1>Medidor Solar</h1><p>Monitoramento fotovoltaico</p></div></div>
          <div class="eyebrow">Acesso ao sistema</div>
          <h2>Bem-vindo de volta</h2>
          <p class="auth-copy">Entre na sua conta para acompanhar seus dispositivos e medições solares.</p>
          <div id="login-notice" class="notice" role="alert"></div>
          <form id="login-form">
            <div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" maxlength="180" autocomplete="email" required placeholder="voce@exemplo.com"></div>
            <div class="field"><label for="login-password">Senha</label><input id="login-password" name="senha" type="password" minlength="8" maxlength="128" autocomplete="current-password" required placeholder="Sua senha"></div>
            <button class="btn btn-primary auth-submit" id="login-submit" type="submit">Entrar</button>
          </form>
          <div class="auth-switch">Ainda não tem uma conta? <button type="button" class="link-button" id="go-register">Criar conta</button></div>
        </section>
      </main>`;

    document.getElementById("go-register").addEventListener("click", onRegister);
    document.getElementById("login-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = document.getElementById("login-submit");
        const notice = document.getElementById("login-notice");
        notice.className = "notice";
        notice.textContent = "";
        button.disabled = true;
        button.textContent = "Entrando...";
        try {
            const result = await api("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: document.getElementById("login-email").value,
                    senha: document.getElementById("login-password").value
                })
            });
            setToken(result.token);
            onAuthenticated(result.usuario);
        } catch (error) {
            notice.textContent = error.message;
            notice.classList.add("show");
        } finally {
            button.disabled = false;
            button.textContent = "Entrar";
        }
    });
}
