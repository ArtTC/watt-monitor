const { db } = require("../database");

const findByMacStatement = db.prepare(`
    SELECT id, esp_id, usuario_id, nome, criado_em
    FROM dispositivos
    WHERE esp_id = ?
`);

// Compatibilidade com bancos criados na versão que ainda possuía chave_api_hash.
const deviceColumns = db.prepare("PRAGMA table_info(dispositivos)").all();
const hasLegacyKeyColumn = deviceColumns.some((column) => column.name === "chave_api_hash");

const insertStatement = hasLegacyKeyColumn
    ? db.prepare(`
        INSERT INTO dispositivos (esp_id, usuario_id, nome, chave_api_hash, criado_em)
        VALUES (?, ?, ?, '', ?)
      `)
    : db.prepare(`
        INSERT INTO dispositivos (esp_id, usuario_id, nome, criado_em)
        VALUES (?, ?, ?, ?)
      `);

const listStatement = db.prepare(`
    SELECT
        d.id,
        d.esp_id,
        d.nome,
        d.criado_em,
        (SELECT m.data_hora FROM medicoes m WHERE m.esp_id = d.esp_id ORDER BY m.id DESC LIMIT 1) AS ultima_medicao,
        (SELECT m.tensao FROM medicoes m WHERE m.esp_id = d.esp_id ORDER BY m.id DESC LIMIT 1) AS ultima_tensao,
        (SELECT m.corrente FROM medicoes m WHERE m.esp_id = d.esp_id ORDER BY m.id DESC LIMIT 1) AS ultima_corrente,
        (SELECT m.potencia FROM medicoes m WHERE m.esp_id = d.esp_id ORDER BY m.id DESC LIMIT 1) AS ultima_potencia,
        (SELECT COUNT(*) FROM medicoes m WHERE m.esp_id = d.esp_id) AS quantidade_medicoes
    FROM dispositivos d
    WHERE d.usuario_id = ?
    ORDER BY d.nome COLLATE NOCASE
`);

module.exports = {
    findByMac: (mac) => findByMacStatement.get(mac),
    listByUser: (userId) => listStatement.all(userId),
    create({ mac, userId, name, createdAt }) {
        insertStatement.run(mac, userId, name, createdAt);
    }
};
