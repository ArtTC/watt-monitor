const { db } = require("../database");

function queryForUser(userId, start, endExclusive, deviceIds) {
    let sql = `SELECT m.id, m.esp_id, d.nome AS dispositivo, m.data_hora, m.tensao, m.corrente, m.potencia
        FROM medicoes m INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id
        INNER JOIN dispositivos d ON d.id = dm.dispositivo_id
        WHERE d.usuario_id = ? AND m.data_hora >= ? AND m.data_hora < ?`;
    const params = [userId, start, endExclusive];
    if (deviceIds?.length) {
        sql += ` AND d.id IN (${deviceIds.map(() => "?").join(", ")})`;
        params.push(...deviceIds);
    }
    sql += " ORDER BY m.data_hora ASC, m.id ASC";
    return db.prepare(sql).all(...params);
}

module.exports = { queryForUser };
