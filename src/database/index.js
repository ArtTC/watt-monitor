const sqlite = require("node:sqlite");
// Node.js 26.11+ chama a classe de Database; versoes anteriores usam DatabaseSync.
const Database = sqlite.Database || sqlite.DatabaseSync;
const { DATABASE_PATH } = require("../config");

const db = new Database(DATABASE_PATH);
db.exec("PRAGMA foreign_keys = ON;");

function validateSchema() {
    const checks = [
        "SELECT id, esp_id, data_hora, tensao, corrente, potencia FROM medicoes LIMIT 0",
        "SELECT id, nome, email, senha_hash, senha_salt FROM usuarios LIMIT 0",
        "SELECT id, esp_id, usuario_id, nome, criado_em FROM dispositivos LIMIT 0",
        "SELECT token_hash, usuario_id, expira_em FROM sessoes LIMIT 0"
    ];

    try {
        for (const sql of checks) db.prepare(sql).all();
    } catch (error) {
        error.message = `Estrutura do banco incompleta. Execute database/schema.sql no DBeaver. Detalhe: ${error.message}`;
        throw error;
    }
}

module.exports = { db, validateSchema };
