const sessionsRepository = require("../repositories/sessions.repository");
const usersRepository = require("../repositories/users.repository");
const { hashToken } = require("../utils/security");

function requireAuth(req, res, next) {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        return res.status(401).json({ sucesso: false, mensagem: "Faça login para continuar." });
    }

    const tokenHash = hashToken(match[1].trim());
    const session = sessionsRepository.findByHash(tokenHash);

    if (!session || Number(session.expira_em) <= Date.now()) {
        if (session) sessionsRepository.remove(tokenHash);
        return res.status(401).json({ sucesso: false, mensagem: "Sessão expirada. Entre novamente." });
    }

    const user = usersRepository.findById(session.usuario_id);
    if (!user) {
        sessionsRepository.remove(tokenHash);
        return res.status(401).json({ sucesso: false, mensagem: "Usuário não encontrado. Entre novamente." });
    }

    req.user = user;
    req.tokenHash = tokenHash;
    next();
}

module.exports = { requireAuth };
