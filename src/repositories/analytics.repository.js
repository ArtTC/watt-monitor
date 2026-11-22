const { db } = require("../database");

function measurementsForDevices(userId, deviceIds, start, end, limit = 50001) {
    if (!deviceIds.length) return [];
    const placeholders = deviceIds.map(() => "?").join(", ");
    const sql = `SELECT m.id, m.esp_id, d.id AS device_id, d.nome AS device_name,
        m.data_hora, m.tensao, m.corrente, m.potencia
      FROM medicoes m
      INNER JOIN dispositivo_macs dm ON dm.mac = m.esp_id
      INNER JOIN dispositivos d ON d.id = dm.dispositivo_id
      WHERE d.usuario_id = ? AND d.removido_em IS NULL
        AND d.id IN (${placeholders}) AND m.data_hora >= ? AND m.data_hora <= ?
      ORDER BY m.data_hora ASC, m.id ASC LIMIT ?`;
    return db.prepare(sql).all(userId, ...deviceIds, start, end, limit);
}

module.exports = { measurementsForDevices };
