function groupByDevice(rows, knownDevices = []) {
    const groups = new Map();
    for (const device of knownDevices) groups.set(Number(device.id), { id: Number(device.id), name: device.nome || device.name, mac: device.esp_id || device.mac, rows: [] });
    for (const row of rows) {
        const key = Number(row.device_id);
        if (!groups.has(key)) groups.set(key, { id: key, name: row.device_name, mac: row.esp_id, rows: [] });
        const device = groups.get(key);
        device.name = row.device_name;
        device.rows.push(row);
    }
    return [...groups.values()];
}

function bucketFor(value, aggregation = "day", timezoneOffsetMinutes = 0) {
    const date = new Date(Date.parse(value) - timezoneOffsetMinutes * 60000);
    const y = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");
    if (aggregation === "month") return `${y}-${month}`;
    if (aggregation === "hour") return `${y}-${month}-${day} ${hour}:00`;
    return `${y}-${month}-${day}`;
}

function localTimestamp(value, timezoneOffsetMinutes = 0) {
    return new Date(Date.parse(value) - timezoneOffsetMinutes * 60000).toISOString().replace("T", " ").slice(0, 19);
}

function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function chart(id, labels, series, type = "line", unit = "") {
    return { id, labels, series: series.map((item) => ({ name: item.name, data: item.data.map((value) => value == null ? null : round(value)) })), type, unit };
}

function sortedUnique(values) { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }

module.exports = { groupByDevice, bucketFor, localTimestamp, round, chart, sortedUnique };
