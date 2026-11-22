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
            const day = keyDate.toISOString().slice(0, 10);
            const key = bucketType === "hour"
                ? `${day} ${String(keyDate.getUTCHours()).padStart(2, "0")}:00`
                : bucketType === "month" ? day.slice(0, 7) : day;
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

function generate(rows, id, aggregation = "day", knownDevices = [], timezoneOffsetMinutes = 0) {
    const interval = { hour: "hora", day: "dia", month: "mês" }[aggregation] || "intervalo";
    const grouped = energyByDevice(rows, aggregation, knownDevices, timezoneOffsetMinutes);
    const labels = sortedUnique(grouped.flatMap((device) => [...device.energy.keys()]));
    if (["energy-day", "energy-month", "energy-daily-comparison"].includes(id)) {
        const series = id === "energy-day" && grouped.length > 1
            ? [{ name: "Total dos equipamentos", data: labels.map((label) => grouped.reduce((sum, device) => sum + (device.energy.get(label) || 0), 0)) }]
            : id === "energy-month"
                ? [{ name: `Energia total por ${interval}`, data: labels.map((label) => grouped.reduce((sum, device) => sum + (device.energy.get(label) || 0), 0)) }]
                : grouped.map((device) => ({ name: `${device.name} (${device.mac})`, data: labels.map((label) => device.energy.get(label) || 0) }));
        const result = chart(id, labels, series, "bar", "Wh");
        const titulo = id === "energy-day" ? `Energia gerada por ${interval}`
            : id === "energy-month" ? `Energia total por ${interval}`
                : `Comparação de energia por ${interval}`;
        return { ...result, titulo, descricao: `Energia integrada por ${interval}${id === "energy-daily-comparison" ? " para cada equipamento" : ""}.` };
    }
    if (id === "energy-cumulative") {
        const series = grouped.map((device) => {
            let sum = 0;
            return { name: `${device.name} (${device.mac})`, data: labels.map((label) => { sum += device.energy.get(label) || 0; return sum; }) };
        });
        return { ...chart(id, labels, series, "line", "Wh"), titulo: `Energia acumulada por ${interval}`, descricao: `Energia acumulada ao longo de cada intervalo de ${interval}.` };
    }
    if (id === "energy-hourly-profile") {
        const data = labels.map((label) => grouped.reduce((sum, device) => sum + (device.energy.get(label) || 0), 0));
        return { ...chart(id, labels, [{ name: `Energia por ${interval}`, data }], "line", "Wh"), titulo: `Perfil de geração por ${interval}`, descricao: `Energia integrada agrupada por ${interval}.` };
    }
    return null;
}

module.exports = { generate, integrate, energyByDevice, dailyEnergy, totalEnergyWh, MAX_INTEGRATION_GAP_SECONDS };
