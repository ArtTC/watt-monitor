import { api, setToken } from "../api.js";

export function renderRegister(container, { onAuthenticated, onLogin }) {
    container.innerHTML = `
      <main class="shell auth-shell">
        <section class="auth-card">
          <div class="brand auth-brand"><div class="brand-mark" aria-hidden="true">☀</div><div><h1>Medidor Solar</h1><p>Monitoramento fotovoltaico</p></div></div>
          <div class="eyebrow">Nova conta</div>
          <h2>Crie seu acesso</h2>
          <p class="auth-copy">Cadastre-se para vincular seus ESP32 e acompanhar a geração solar.</p>
          <div id="register-notice" class="notice" role="alert"></div>
          <form id="register-form">
            <div class="field"><label for="register-name">Nome</label><input id="register-name" name="nome" type="text" minlength="2" maxlength="80" autocomplete="name" required placeholder="Seu nome"></div>
            <div class="field"><label for="register-email">E-mail</label><input id="register-email" name="email" type="email" maxlength="180" autocomplete="email" required placeholder="voce@exemplo.com"></div>
            <div class="field"><label for="register-password">Senha</label><input id="register-password" name="senha" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="Mínimo de 8 caracteres"></div>
            <button class="btn btn-primary auth-submit" id="register-submit" type="submit">Criar conta</button>
          </form>
          <div class="auth-switch">Já possui uma conta? <button type="button" class="link-button" id="go-login">Entrar</button></div>
        </section>
      </main>`;

    document.getElementById("go-login").addEventListener("click", onLogin);
    document.getElementById("register-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = document.getElementById("register-submit");
        const notice = document.getElementById("register-notice");
        notice.className = "notice";
        notice.textContent = "";
        button.disabled = true;
        button.textContent = "Criando conta...";
        try {
            const result = await api("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    nome: document.getElementById("register-name").value,
                    email: document.getElementById("register-email").value,
                    senha: document.getElementById("register-password").value
                })
            });
            setToken(result.token);
            onAuthenticated(result.usuario);
        } catch (error) {
            notice.textContent = error.message;
            notice.classList.add("show");
        } finally {
            button.disabled = false;
            button.textContent = "Criar conta";
        }
    });
}
