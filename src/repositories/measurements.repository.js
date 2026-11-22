const { db } = require("../database");

const insertStatement = db.prepare(`
    INSERT INTO medicoes (esp_id, data_hora, tensao, corrente, potencia)
    VALUES (?, ?, ?, ?, ?)
`);

const historyForDeviceStatement = db.prepare(`
    SELECT m.id, m.esp_id, d.nome AS dispositivo, m.data_hora,
           m.tensao, m.corrente, m.potencia
    FROM medicoes m
    INNER JOIN dispositivos d ON d.esp_id = m.esp_id
    WHERE m.esp_id = ? AND d.usuario_id = ?
    ORDER BY m.id DESC
    LIMIT 100
`);

const historyForUserStatement = db.prepare(`
    SELECT m.id, m.esp_id, d.nome AS dispositivo, m.data_hora,
           m.tensao, m.corrente, m.potencia
    FROM medicoes m
    INNER JOIN dispositivos d ON d.esp_id = m.esp_id
    WHERE d.usuario_id = ?
    ORDER BY m.id DESC
    LIMIT 100
`);

const latestForUserStatement = db.prepare(`
    SELECT m.id, m.esp_id, d.nome AS dispositivo, m.data_hora,
           m.tensao, m.corrente, m.potencia
    FROM medicoes m
    INNER JOIN dispositivos d ON d.esp_id = m.esp_id
    WHERE d.usuario_id = ?
    ORDER BY m.id DESC
    LIMIT 1
`);

module.exports = {
    create({ mac, measuredAt, voltage, current, power }) {
        return insertStatement.run(mac, measuredAt, voltage, current, power);
    },
    historyForDevice: (mac, userId) => historyForDeviceStatement.all(mac, userId),
    historyForUser: (userId) => historyForUserStatement.all(userId),
    latestForUser: (userId) => latestForUserStatement.get(userId)
};
