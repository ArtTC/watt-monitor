const { groupByDevice, bucketFor, localTimestamp, chart, sortedUnique, round } = require("./analytics.helpers");

function sample(rows, max = 900) {
    if (rows.length <= max) return rows;
    const step = (rows.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, index) => rows[Math.round(index * step)]);
}

function generate(rows, id, aggregation, knownDevices = [], timezoneOffsetMinutes = 0) {
    const devices = groupByDevice(rows, knownDevices);
    if (id === "power-time") {
        const labels = sortedUnique(devices.flatMap((device) => sample(device.rows).map((row) => localTimestamp(row.data_hora, timezoneOffsetMinutes))));
        const displayLabels = labels.length > 900 ? labels.filter((_, index) => index % Math.ceil(labels.length / 900) === 0) : labels;
        const series = devices.map((device) => {
            const values = new Map(sample(device.rows).map((row) => [localTimestamp(row.data_hora, timezoneOffsetMinutes), Number(row.potencia)]));
            return { name: `${device.name} (${device.mac})`, data: displayLabels.map((label) => values.get(label) ?? null) };
        });
        return chart(id, displayLabels, series, "line", "W");
    }
    if (id === "power-hourly-average") {
        const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
        const values = new Map(labels.map((label) => [label, []]));
        for (const row of rows) {
            const hour = String(new Date(Date.parse(row.data_hora) - timezoneOffsetMinutes * 60000).getUTCHours()).padStart(2, "0");
            values.get(hour + ":00").push(Number(row.potencia));
        }
        return chart(id, labels, [{ name: "Potência média", data: labels.map((label) => {
            const bucket = values.get(label);
            return bucket.length ? bucket.reduce((sum, value) => sum + value, 0) / bucket.length : null;
        }) }], "bar", "W");
    }
    if (id === "power-daily-max" || id === "power-period-comparison") {
        const bucketSize = id === "power-daily-max" ? "day" : aggregation;
        const groups = devices.map((device) => {
            const values = new Map();
            for (const row of device.rows) {
                const bucket = bucketFor(row.data_hora, bucketSize, timezoneOffsetMinutes);
                if (!values.has(bucket)) values.set(bucket, []);
                values.get(bucket).push(Number(row.potencia));
            }
            return { name: `${device.name} (${device.mac})`, values };
        });
        const labels = sortedUnique(groups.flatMap((device) => [...device.values.keys()]));
        const series = groups.map((device) => ({ name: device.name, data: labels.map((label) => {
            const bucket = device.values.get(label);
            if (!bucket?.length) return null;
            if (id === "power-daily-max") return Math.max(...bucket);
            return bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
        }) }));
        return chart(id, labels, series, "bar", "W");
    }
    if (id === "power-variation") {
        const points = devices.map((device) => {
            const variations = [];
            for (let index = 1; index < device.rows.length; index++) {
                const previous = Number(device.rows[index - 1].potencia);
                const current = Number(device.rows[index].potencia);
                if (Math.abs(previous) > 1e-6) variations.push({ label: localTimestamp(device.rows[index].data_hora, timezoneOffsetMinutes), value: (current - previous) / Math.abs(previous) * 100 });
            }
            return { name: `${device.name} (${device.mac})`, points: sample(variations) };
        });
        const labels = sortedUnique(points.flatMap((device) => device.points.map((point) => point.label)));
        const displayLabels = labels.length > 900 ? labels.filter((_, index) => index % Math.ceil(labels.length / 900) === 0) : labels;
        const series = points.map((device) => {
            const values = new Map(device.points.map((point) => [point.label, point.value]));
            return { name: device.name, data: displayLabels.map((label) => values.get(label) ?? null) };
        });
        return chart(id, displayLabels, series, "line", "%");
    }
    return null;
}

module.exports = { generate };
