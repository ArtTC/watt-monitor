const { db } = require("../database");

const insertStatement = db.prepare(`
    INSERT INTO medicoes (esp_id, data_hora, tensao, corrente, potencia)
    VALUES (?, ?, ?, ?, ?)
`);

const historyForDeviceStatement = db.prepare(`
    SELECT m.id, m.esp_id, d.nome AS dispositivo, m.data_hora,
           m.tensao, m.corrente, m.potencia
    FROM medicoes m
    INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id
    INNER JOIN dispositivos d ON d.id = dm.dispositivo_id
    WHERE d.id = ? AND d.usuario_id = ?
    ORDER BY m.id DESC
    LIMIT 100
`);

const historyForUserStatement = db.prepare(`
    SELECT m.id, m.esp_id, d.nome AS dispositivo, m.data_hora,
           m.tensao, m.corrente, m.potencia
    FROM medicoes m
    INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id
    INNER JOIN dispositivos d ON d.id = dm.dispositivo_id
    WHERE d.usuario_id = ? AND d.removido_em IS NULL
    ORDER BY m.id DESC
    LIMIT 100
`);

const latestForUserStatement = db.prepare(`
    SELECT m.id, m.esp_id, d.nome AS dispositivo, m.data_hora,
           m.tensao, m.corrente, m.potencia
    FROM medicoes m
    INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id
    INNER JOIN dispositivos d ON d.id = dm.dispositivo_id
    WHERE d.usuario_id = ? AND d.removido_em IS NULL
    ORDER BY m.id DESC
    LIMIT 1
`);

module.exports = {
    create({ mac, measuredAt, voltage, current, power }) {
        return insertStatement.run(mac, measuredAt, voltage, current, power);
    },
    historyForDevice: (deviceId, userId) => historyForDeviceStatement.all(deviceId, userId),
    historyForUser: (userId) => historyForUserStatement.all(userId),
    latestForUser: (userId) => latestForUserStatement.get(userId)
};
