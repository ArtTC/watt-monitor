const { db } = require("../database");

const findByMacStatement = db.prepare(`
    SELECT d.id, d.esp_id, d.usuario_id, d.nome, d.criado_em, d.removido_em,
           dm.mac AS mac_consultado, dm.aceita_medicoes
    FROM dispositivo_macs dm INNER JOIN dispositivos d ON d.id = dm.dispositivo_id
    WHERE dm.mac = ?
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
        (SELECT m.data_hora FROM medicoes m INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id WHERE dm.dispositivo_id = d.id ORDER BY m.id DESC LIMIT 1) AS ultima_medicao,
        (SELECT m.tensao FROM medicoes m INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id WHERE dm.dispositivo_id = d.id ORDER BY m.id DESC LIMIT 1) AS ultima_tensao,
        (SELECT m.corrente FROM medicoes m INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id WHERE dm.dispositivo_id = d.id ORDER BY m.id DESC LIMIT 1) AS ultima_corrente,
        (SELECT m.potencia FROM medicoes m INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id WHERE dm.dispositivo_id = d.id ORDER BY m.id DESC LIMIT 1) AS ultima_potencia,
        (SELECT COUNT(*) FROM medicoes m INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id WHERE dm.dispositivo_id = d.id) AS quantidade_medicoes
    FROM dispositivos d
    WHERE d.usuario_id = ? AND d.removido_em IS NULL
    ORDER BY d.nome COLLATE NOCASE
`);

const deletedListStatement = db.prepare(`SELECT id, esp_id, nome, criado_em, removido_em FROM dispositivos WHERE usuario_id = ? AND removido_em IS NOT NULL ORDER BY nome COLLATE NOCASE`);
const removeStatement = db.prepare("UPDATE dispositivos SET removido_em = ? WHERE esp_id = ? AND usuario_id = ? AND removido_em IS NULL");
const restoreStatement = db.prepare("UPDATE dispositivos SET removido_em = NULL WHERE esp_id = ? AND usuario_id = ? AND removido_em IS NOT NULL");
const insertMacStatement = db.prepare("INSERT INTO dispositivo_macs (mac, dispositivo_id, criado_em) VALUES (?, ?, ?)");
const updateCurrentMacStatement = db.prepare("UPDATE dispositivos SET esp_id = ?, nome = ? WHERE id = ? AND esp_id = ? AND removido_em IS NULL");
const disableOldMacStatement = db.prepare("UPDATE dispositivo_macs SET aceita_medicoes = 0 WHERE mac = ? AND dispositivo_id = ?");
const enableNewMacStatement = db.prepare(`INSERT INTO dispositivo_macs (mac, dispositivo_id, criado_em, aceita_medicoes) VALUES (?, ?, ?, 1)
    ON CONFLICT(mac) DO UPDATE SET aceita_medicoes = 1 WHERE dispositivo_macs.dispositivo_id = excluded.dispositivo_id`);

module.exports = {
    findByMac: (mac) => findByMacStatement.get(mac),
    listByUser: (userId) => listStatement.all(userId),
    listDeletedByUser: (userId) => deletedListStatement.all(userId),
    remove: (mac, userId, removedAt) => removeStatement.run(removedAt, mac, userId),
    restore: (mac, userId) => restoreStatement.run(mac, userId),
    updateMac({ deviceId, oldMac, newMac, name, changedAt }) {
        db.exec("BEGIN IMMEDIATE");
        try {
            const update = updateCurrentMacStatement.run(newMac, name, deviceId, oldMac);
            if (!Number(update.changes)) throw new Error("O MAC atual do equipamento mudou durante a edição.");
            disableOldMacStatement.run(oldMac, deviceId);
            enableNewMacStatement.run(newMac, deviceId, changedAt);
            db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    create({ mac, userId, name, createdAt }) {
        const result = insertStatement.run(mac, userId, name, createdAt);
        insertMacStatement.run(mac, Number(result.lastInsertRowid), createdAt);
    }
};
