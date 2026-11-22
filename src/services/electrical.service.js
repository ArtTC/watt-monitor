const { groupByDevice, bucketFor, localTimestamp, chart, sortedUnique, round } = require("./analytics.helpers");

function downsample(rows, max = 900) {
    if (rows.length <= max) return rows;
    const result = [];
    const step = (rows.length - 1) / (max - 1);
    for (let i = 0; i < max; i++) result.push(rows[Math.round(i * step)]);
    return result;
}

function aggregate(rows, key, mode, aggregation, timezoneOffsetMinutes = 0) {
    const grouped = new Map();
    for (const row of rows) {
        const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
        if (!grouped.has(label)) grouped.set(label, []);
        grouped.get(label).push(Number(row[key]));
    }
    const result = new Map();
    for (const [label, values] of grouped) {
        result.set(label, mode === "max" ? Math.max(...values) : mode === "min" ? Math.min(...values) : values.reduce((a, b) => a + b, 0) / values.length);
    }
    return result;
}

function rangeChart(rows, metric, id, aggregation, timezoneOffsetMinutes = 0) {
    const groups = new Map();
    for (const row of rows) {
        const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(Number(row[metric]));
    }
    const labels = sortedUnique([...groups.keys()]);
    return chart(id, labels, [
        { name: "Mínima", data: labels.map((label) => Math.min(...groups.get(label))) },
        { name: "Máxima", data: labels.map((label) => Math.max(...groups.get(label))) }
    ], "line", metric === "tensao" ? "V" : "A");
}

function distributionChart(rows, metric, id) {
    const values = rows.map((row) => Number(row[metric])).filter(Number.isFinite);
    if (!values.length) return chart(id, [], [{ name: "Medições", data: [] }], "bar", "medições");
    const min = Math.min(...values), max = Math.max(...values);
    const bucketCount = 10;
    const width = (max - min) / bucketCount || 1;
    const counts = Array(bucketCount).fill(0);
    for (const value of values) counts[Math.min(bucketCount - 1, Math.floor((value - min) / width))]++;
    const unit = metric === "tensao" ? "V" : "A";
    const labels = counts.map((_, index) => `${round(min + index * width, 2)}–${round(min + (index + 1) * width, 2)} ${unit}`);
    return chart(id, labels, [{ name: "Medições", data: counts }], "bar", "medições");
}

function perDeviceTimeChart(rows, metric, id, unit, knownDevices, timezoneOffsetMinutes) {
    const devices = groupByDevice(rows, knownDevices);
    const labels = sortedUnique(devices.flatMap((device) => downsample(device.rows).map((row) => localTimestamp(row.data_hora, timezoneOffsetMinutes))));
    const sampledLabels = labels.length > 900 ? labels.filter((_, index) => index % Math.ceil(labels.length / 900) === 0) : labels;
    const series = devices.map((device) => {
        const values = new Map(downsample(device.rows).map((row) => [localTimestamp(row.data_hora, timezoneOffsetMinutes), Number(row[metric])]));
        return { name: `${device.name} (${device.mac})`, data: sampledLabels.map((label) => values.get(label) ?? null) };
    });
    return chart(id, sampledLabels, series, "line", unit);
}

function changeChart(rows, metric, id, unit, percent = false, knownDevices = [], timezoneOffsetMinutes = 0) {
    const devices = groupByDevice(rows, knownDevices);
    const points = devices.map((device) => {
        const source = [];
        for (let index = 1; index < device.rows.length; index++) {
            const previous = Number(device.rows[index - 1][metric]);
            const current = Number(device.rows[index][metric]);
            if (percent && Math.abs(previous) < 1e-6) continue;
            source.push({ label: localTimestamp(device.rows[index].data_hora, timezoneOffsetMinutes), value: percent ? ((current - previous) / Math.abs(previous)) * 100 : Math.abs(current - previous) });
        }
        return { name: `${device.name} (${device.mac})`, points: downsample(source) };
    });
    const labels = sortedUnique(points.flatMap((device) => device.points.map((point) => point.label)));
    const sampledLabels = labels.length > 900 ? labels.filter((_, index) => index % Math.ceil(labels.length / 900) === 0) : labels;
    return chart(id, sampledLabels, points.map((device) => {
        const values = new Map(device.points.map((point) => [point.label, point.value]));
        return { name: device.name, data: sampledLabels.map((label) => values.get(label) ?? null) };
    }), "line", unit);
}

function generate(rows, id, aggregation, knownDevices = [], timezoneOffsetMinutes = 0) {
    const voltage = id.startsWith("voltage");
    const metric = voltage ? "tensao" : "corrente";
    const unit = voltage ? "V" : "A";
    if (id === `${voltage ? "voltage" : "current"}-time`) return perDeviceTimeChart(rows, metric, id, unit, knownDevices, timezoneOffsetMinutes);
    if (id === `${voltage ? "voltage" : "current"}-daily-average`) {
        const devices = groupByDevice(rows, knownDevices);
        const labels = sortedUnique(rows.map((row) => bucketFor(row.data_hora, "day", timezoneOffsetMinutes)));
        const series = devices.map((device) => {
            const daily = aggregate(device.rows, metric, "avg", "day", timezoneOffsetMinutes);
            return { name: `${device.name} (${device.mac})`, data: labels.map((label) => daily.get(label) ?? null) };
        });
        return chart(id, labels, series, "line", unit);
    }
    if (id === `${voltage ? "voltage" : "current"}-range`) return rangeChart(rows, metric, id, aggregation, timezoneOffsetMinutes);
    if (id === `${voltage ? "voltage" : "current"}-distribution`) return distributionChart(rows, metric, id);
    if (id === `${voltage ? "voltage" : "current"}-oscillation`) return changeChart(rows, metric, id, unit, false, knownDevices, timezoneOffsetMinutes);
    return null;
}

module.exports = { generate, aggregate, downsample };
