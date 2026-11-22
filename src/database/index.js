const sqlite = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
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

function migrateSchema() {
    const columns = db.prepare("PRAGMA table_info(dispositivos)").all();
    if (!columns.some((column) => column.name === "removido_em")) {
        const migration = fs.readFileSync(path.join(__dirname, "..", "..", "database", "migrations", "001_soft_delete_devices.sql"), "utf8");
        db.exec(migration);
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_dispositivos_usuario_removido ON dispositivos (usuario_id, removido_em)");
    const macMigration = fs.readFileSync(path.join(__dirname, "..", "..", "database", "migrations", "002_device_mac_history.sql"), "utf8");
    db.exec(macMigration);
}

module.exports = { db, validateSchema, migrateSchema };
