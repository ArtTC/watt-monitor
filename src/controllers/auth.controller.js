const users = require("../repositories/users.repository");
const sessions = require("../repositories/sessions.repository");
const { SESSION_DURATION_MS } = require("../config");
const {
    normalizeEmail,
    createPasswordHash,
    verifyPassword,
    hashToken,
    createToken
} = require("../utils/security");

function createLoginSession(userId) {
    const token = createToken();
    const now = Date.now();
    const expiresAt = now + SESSION_DURATION_MS;
    sessions.removeExpired(now);
    sessions.create(hashToken(token), userId, now, expiresAt);
    return { token, expiresAt };
}

function register(req, res) {
    try {
        const name = String(req.body.nome || "").trim();
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.senha || "");

        if (name.length < 2 || name.length > 80) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe um nome entre 2 e 80 caracteres." });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe um e-mail válido." });
        }
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({ sucesso: false, mensagem: "A senha deve ter entre 8 e 128 caracteres." });
        }
        if (users.findByEmail(email)) {
            return res.status(409).json({ sucesso: false, mensagem: "Já existe uma conta com este e-mail." });
        }

        const credentials = createPasswordHash(password);
        const result = users.create({
            nome: name,
            email,
            senhaHash: credentials.hash,
            senhaSalt: credentials.salt
        });
        const userId = Number(result.lastInsertRowid);
        const session = createLoginSession(userId);

        return res.status(201).json({
            sucesso: true,
            token: session.token,
            expiraEm: session.expiresAt,
            usuario: { id: userId, nome: name, email }
        });
    } catch (error) {
        console.error("Erro no cadastro:", error);
        return res.status(500).json({ sucesso: false, mensagem: "Não foi possível criar a conta." });
    }
}

function login(req, res) {
    try {
        const email = normalizeEmail(req.body.email);
        const password = String(req.body.senha || "");
        const user = users.findByEmail(email);

        if (!user || !verifyPassword(password, user.senha_salt, user.senha_hash)) {
            return res.status(401).json({ sucesso: false, mensagem: "E-mail ou senha incorretos." });
        }

        const session = createLoginSession(user.id);
        return res.json({
            sucesso: true,
            token: session.token,
            expiraEm: session.expiresAt,
            usuario: { id: Number(user.id), nome: user.nome, email: user.email }
        });
    } catch (error) {
        console.error("Erro no login:", error);
        return res.status(500).json({ sucesso: false, mensagem: "Não foi possível entrar." });
    }
}

function me(req, res) {
    res.json({ sucesso: true, usuario: req.user });
}

function logout(req, res) {
    sessions.remove(req.tokenHash);
    res.json({ sucesso: true, mensagem: "Sessão encerrada." });
}

module.exports = { register, login, me, logout };
