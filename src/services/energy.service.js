const { groupByDevice, chart, sortedUnique, round } = require("./analytics.helpers");

const MAX_INTEGRATION_GAP_SECONDS = 30;

function integrate(records, bucketType = "day", timezoneOffsetMinutes = 0) {
    const totals = new Map();
    const offsetMilliseconds = timezoneOffsetMinutes * 60000;
    for (let i = 1; i < records.length; i++) {
        const previous = records[i - 1];
        const current = records[i];
        const start = Date.parse(previous.data_hora);
        const end = Date.parse(current.data_hora);
        const duration = (end - start) / 1000;
        if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_INTEGRATION_GAP_SECONDS) continue;
        let cursor = start;
        while (cursor < end) {
            const date = new Date(cursor - offsetMilliseconds);
            let nextBoundary;
            if (bucketType === "hour") nextBoundary = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours() + 1) + offsetMilliseconds;
            else nextBoundary = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) + offsetMilliseconds;
            const segmentEnd = Math.min(end, nextBoundary);
            const pStart = Number(previous.potencia) + (Number(current.potencia) - Number(previous.potencia)) * ((cursor - start) / (end - start));
            const pEnd = Number(previous.potencia) + (Number(current.potencia) - Number(previous.potencia)) * ((segmentEnd - start) / (end - start));
            const wh = ((pStart + pEnd) / 2) * ((segmentEnd - cursor) / 3600000);
            const keyDate = new Date(cursor - offsetMilliseconds);
            const key = bucketType === "hour"
                ? String(keyDate.getUTCHours()).padStart(2, "0")
                : keyDate.toISOString().slice(0, 10);
            totals.set(key, (totals.get(key) || 0) + wh);
            cursor = segmentEnd;
        }
    }
    return totals;
}

function energyByDevice(rows, bucketType = "day", knownDevices = [], timezoneOffsetMinutes = 0) {
    return groupByDevice(rows, knownDevices).map((device) => ({ ...device, energy: integrate(device.rows, bucketType, timezoneOffsetMinutes) }));
}

function dailyEnergy(rows, knownDevices = [], timezoneOffsetMinutes = 0) { return energyByDevice(rows, "day", knownDevices, timezoneOffsetMinutes); }

function totalEnergyWh(rows, knownDevices = [], timezoneOffsetMinutes = 0) {
    return dailyEnergy(rows, knownDevices, timezoneOffsetMinutes).reduce((sum, device) => sum + [...device.energy.values()].reduce((a, b) => a + b, 0), 0);
}

function generate(rows, id, knownDevices = [], timezoneOffsetMinutes = 0) {
    if (id === "energy-day" || id === "energy-daily-comparison") {
        const devices = dailyEnergy(rows, knownDevices, timezoneOffsetMinutes);
        const labels = sortedUnique(devices.flatMap((device) => [...device.energy.keys()]));
        const series = id === "energy-day" && devices.length > 1
            ? [{ name: "Total dos equipamentos", data: labels.map((label) => devices.reduce((sum, device) => sum + (device.energy.get(label) || 0), 0)) }]
            : devices.map((device) => ({ name: `${device.name} (${device.mac})`, data: labels.map((label) => device.energy.get(label) || 0) }));
        return chart(id, labels, series, "bar", "Wh");
    }
    if (id === "energy-month") {
        const devices = dailyEnergy(rows, knownDevices, timezoneOffsetMinutes);
        const monthly = new Map();
        for (const device of devices) for (const [day, value] of device.energy) {
            const month = day.slice(0, 7);
            monthly.set(month, (monthly.get(month) || 0) + value);
        }
        const labels = sortedUnique([...monthly.keys()]);
        return chart(id, labels, [{ name: "Energia total", data: labels.map((label) => monthly.get(label)) }], "bar", "Wh");
    }
    if (id === "energy-cumulative") {
        const daily = dailyEnergy(rows, knownDevices, timezoneOffsetMinutes);
        const labels = sortedUnique(daily.flatMap((device) => [...device.energy.keys()]));
        const series = daily.map((device) => {
            let sum = 0;
            return { name: `${device.name} (${device.mac})`, data: labels.map((label) => { sum += device.energy.get(label) || 0; return sum; }) };
        });
        return chart(id, labels, series, "line", "Wh");
    }
    if (id === "energy-hourly-profile") {
        const devices = energyByDevice(rows, "hour", knownDevices, timezoneOffsetMinutes);
        const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
        const data = labels.map((label) => devices.reduce((sum, device) => sum + (device.energy.get(label.slice(0, 2)) || 0), 0));
        return chart(id, labels, [{ name: "Energia", data }], "line", "Wh");
    }
    return null;
}

module.exports = { generate, integrate, dailyEnergy, totalEnergyWh, MAX_INTEGRATION_GAP_SECONDS };
