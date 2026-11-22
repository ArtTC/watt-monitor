const energy = require("./energy.service");
const { groupByDevice, chart, round } = require("./analytics.helpers");

function generate(rows, id, knownDevices = [], timezoneOffsetMinutes = 0) {
    const devices = groupByDevice(rows, knownDevices);
    if (id === "compare-energy") {
        const totals = energy.dailyEnergy(rows, knownDevices, timezoneOffsetMinutes).map((device) => ({ name: `${device.name} (${device.mac})`, value: [...device.energy.values()].reduce((sum, value) => sum + value, 0) }));
        return chart(id, totals.map((item) => item.name), [{ name: "Energia", data: totals.map((item) => item.value) }], "hbar", "Wh");
    }
    const metricById = { "compare-power-avg": "potencia", "compare-power-max": "potencia", "compare-voltage": "tensao", "compare-current": "corrente" };
    if (metricById[id]) {
        const metric = metricById[id];
        const names = devices.map((device) => `${device.name} (${device.mac})`);
        const values = devices.map((device) => {
            const measurements = device.rows.map((row) => Number(row[metric]));
            if (!measurements.length) return 0;
            if (id === "compare-power-max") return Math.max(...measurements);
            return measurements.reduce((sum, value) => sum + value, 0) / (measurements.length || 1);
        });
        const unit = metric === "potencia" ? "W" : metric === "tensao" ? "V" : "A";
        return chart(id, names, [{ name: unit === "W" ? "Potência" : unit === "V" ? "Tensão" : "Corrente", data: values }], "hbar", unit);
    }
    if (id === "compare-hour-profile") {
        const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
        const series = devices.map((device) => {
            const buckets = new Map(labels.map((label) => [label, []]));
            for (const row of device.rows) {
                const hour = String(new Date(Date.parse(row.data_hora) - timezoneOffsetMinutes * 60000).getUTCHours()).padStart(2, "0");
                buckets.get(hour + ":00").push(Number(row.potencia));
            }
            return { name: `${device.name} (${device.mac})`, data: labels.map((label) => {
                const values = buckets.get(label);
                return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
            }) };
        });
        return chart(id, labels, series, "line", "W");
    }
    return null;
}

module.exports = { generate };
