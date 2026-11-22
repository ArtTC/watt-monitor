const { db } = require("../database");

const insert = db.prepare(`
    INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em)
    VALUES (?, ?, ?, ?)
`);
const findByHash = db.prepare(`
    SELECT token_hash, usuario_id, expira_em
    FROM sessoes
    WHERE token_hash = ?
`);
const remove = db.prepare("DELETE FROM sessoes WHERE token_hash = ?");
const removeExpired = db.prepare("DELETE FROM sessoes WHERE expira_em <= ?");

module.exports = {
    create(tokenHash, userId, createdAt, expiresAt) {
        insert.run(tokenHash, userId, createdAt, expiresAt);
    },
    findByHash: (tokenHash) => findByHash.get(tokenHash),
    remove: (tokenHash) => remove.run(tokenHash),
    removeExpired: (now) => removeExpired.run(now)
};
