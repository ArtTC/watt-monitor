const { groupByDevice, chart, round, bucketFor, intervalName } = require("./analytics.helpers");

const EXPECTED_SECONDS = 5;
const INTERRUPTION_SECONDS = EXPECTED_SECONDS * 2;

function collect(rows, periodStart, periodEnd, knownDevices = []) {
    return groupByDevice(rows, knownDevices).map((device) => {
        const gaps = [];
        const first = device.rows[0];
        const last = device.rows.at(-1);
        if (first) {
            const leading = (Date.parse(first.data_hora) - Date.parse(periodStart)) / 1000;
            if (leading > EXPECTED_SECONDS) gaps.push({ seconds: leading, row: first });
        }
        for (let i = 1; i < device.rows.length; i++) {
            const seconds = (Date.parse(device.rows[i].data_hora) - Date.parse(device.rows[i - 1].data_hora)) / 1000;
            if (seconds > EXPECTED_SECONDS) gaps.push({ seconds, row: device.rows[i] });
        }
        if (last) {
            const trailing = (Date.parse(periodEnd) - Date.parse(last.data_hora)) / 1000;
            if (trailing > EXPECTED_SECONDS) gaps.push({ seconds: trailing, row: { data_hora: periodEnd } });
        }
        const span = Math.max(0, (Date.parse(periodEnd) - Date.parse(periodStart)) / 1000);
        const covered = Math.min(span, device.rows.length * EXPECTED_SECONDS);
        return { ...device, gaps, span, availability: span ? covered / span * 100 : 0 };
    });
}

function bucketWindows(periodStart, periodEnd, aggregation, timezoneOffsetMinutes = 0) {
    const start = Date.parse(periodStart), end = Date.parse(periodEnd);
    const windows = [];
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return windows;
    let cursor = start;
    while (cursor <= end) {
        if (windows.length && cursor >= end) break;
        const local = new Date(cursor - timezoneOffsetMinutes * 60000);
        const year = local.getUTCFullYear(), month = local.getUTCMonth(), day = local.getUTCDate(), hour = local.getUTCHours();
        const nextLocal = aggregation === "minute" ? Date.UTC(year, month, day, hour, local.getUTCMinutes() + 1)
            : aggregation === "hour" ? Date.UTC(year, month, day, hour + 1)
            : aggregation === "month" ? Date.UTC(year, month + 1, 1)
                : Date.UTC(year, month, day + 1);
        const next = nextLocal + timezoneOffsetMinutes * 60000;
        if (next <= cursor) break;
        windows.push({ label: bucketFor(new Date(cursor).toISOString(), aggregation, timezoneOffsetMinutes), start: cursor, end: Math.min(end, next) });
        cursor = next;
    }
    return windows;
}

function generate(rows, id, periodStart, periodEnd, aggregation = "day", knownDevices = [], timezoneOffsetMinutes = 0) {
    const devices = collect(rows, periodStart, periodEnd, knownDevices);
    const windows = bucketWindows(periodStart, periodEnd, aggregation, timezoneOffsetMinutes);
    const labels = windows.map((window) => window.label);
    const interval = intervalName(aggregation);

    if (id === "availability-history") {
        const series = devices.map((device) => {
            const counts = new Map();
            for (const row of device.rows) {
                const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
                counts.set(label, (counts.get(label) || 0) + 1);
            }
            return { name: `${device.name}`, data: labels.map((label) => counts.get(label) || 0) };
        });
        return { ...chart(id, labels, series, "line", "medições"), titulo: `Histórico de comunicação por ${interval}`, descricao: `Medições recebidas por ${interval} e equipamento.` };
    }

    if (id === "availability-percent") {
        const series = devices.flatMap((device) => {
            const counts = new Map();
            for (const row of device.rows) {
                const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
                counts.set(label, (counts.get(label) || 0) + 1);
            }
            const availability = windows.map((window) => {
                const seconds = (window.end - window.start) / 1000;
                return seconds > 0 ? round(Math.min(seconds, (counts.get(window.label) || 0) * EXPECTED_SECONDS) / seconds * 100, 2) : 0;
            });
            const name = `${device.name}`;
            return [
                { name: `${name} - Disponibilidade`, stackGroup: device.id, data: availability },
                { name: `${name} - Indisponibilidade`, stackGroup: device.id, data: availability.map((value) => round(Math.max(0, 100 - value), 2)) }
            ];
        });
        const chartData = chart(id, labels, series, "bar", "%");
        chartData.series = chartData.series.map((item, index) => ({ ...item, stackGroup: series[index].stackGroup }));
        return { ...chartData, stacked: true, titulo: `Disponibilidade por ${interval}`, descricao: `Disponibilidade e indisponibilidade estimadas de cada equipamento em cada intervalo de ${interval}.` };
    }
    if (id === "availability-interruptions") {
        const series = devices.map((device) => {
            const counts = new Map();
            for (const gap of device.gaps) {
                if (gap.seconds < INTERRUPTION_SECONDS) continue;
                const label = bucketFor(gap.row.data_hora, aggregation, timezoneOffsetMinutes);
                counts.set(label, (counts.get(label) || 0) + 1);
            }
            return { name: `${device.name}`, data: labels.map((label) => counts.get(label) || 0) };
        });
        return { ...chart(id, labels, series, "bar", "interrupções"), titulo: `Quantidade de interrupções por ${interval}`, descricao: `Interrupções por equipamento em cada intervalo de ${interval}.` };
    }

    return null;
}

module.exports = { generate, collect, bucketWindows, EXPECTED_SECONDS, INTERRUPTION_SECONDS };
