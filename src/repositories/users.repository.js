const { db } = require("../database");

const byEmail = db.prepare(`
    SELECT id, nome, email, senha_hash, senha_salt
    FROM usuarios
    WHERE email = ?
`);

const byId = db.prepare(`
    SELECT id, nome, email
    FROM usuarios
    WHERE id = ?
`);

const insert = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, senha_salt, criado_em)
    VALUES (?, ?, ?, ?, ?)
`);

module.exports = {
    findByEmail: (email) => byEmail.get(email),
    findById: (id) => byId.get(id),
    create: ({ nome, email, senhaHash, senhaSalt }) =>
        insert.run(nome, email, senhaHash, senhaSalt, new Date().toISOString())
};
