const { groupByDevice, chart, sortedUnique, round, bucketFor, localTimestamp } = require("./analytics.helpers");

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

function generate(rows, id, periodStart, periodEnd, knownDevices = [], timezoneOffsetMinutes = 0) {
    const devices = collect(rows, periodStart, periodEnd, knownDevices);
    if (id === "availability-history") {
        const labels = sortedUnique(rows.map((row) => bucketFor(row.data_hora, "day", timezoneOffsetMinutes)));
        const series = devices.map((device) => {
            const counts = new Map();
            for (const row of device.rows) {
                const day = bucketFor(row.data_hora, "day", timezoneOffsetMinutes);
                counts.set(day, (counts.get(day) || 0) + 1);
            }
            return { name: `${device.name} (${device.mac})`, data: labels.map((day) => counts.get(day) || 0) };
        });
        return chart(id, labels, series, "line", "medições");
    }
    if (id === "availability-percent") {
        const labels = devices.map((device) => `${device.name} (${device.mac})`);
        return chart(id, labels, [{ name: "Disponibilidade estimada", data: devices.map((device) => round(device.availability, 2)) }], "hbar", "%");
    }
    if (id === "availability-gaps") {
        const gaps = devices.flatMap((device) => device.gaps.map((gap) => ({ device, ...gap }))).sort((a, b) => b.seconds - a.seconds).slice(0, 100);
        if (!gaps.length) return chart(id, [rows.length ? "Nenhuma lacuna" : "Sem medições"], [{ name: "Lacunas", data: [0] }], "bar", "segundos");
        const labels = gaps.map(({ device, row }) => `${device.name} ${localTimestamp(row.data_hora, timezoneOffsetMinutes).slice(0, 16)}`);
        return chart(id, labels, [{ name: "Tempo além da janela esperada", data: gaps.map((gap) => Math.max(0, gap.seconds - EXPECTED_SECONDS)) }], "bar", "segundos");
    }
    if (id === "availability-interruptions") {
        const counts = new Map();
        for (const device of devices) for (const gap of device.gaps) {
            if (gap.seconds < INTERRUPTION_SECONDS) continue;
            const day = bucketFor(gap.row.data_hora, "day", timezoneOffsetMinutes);
            const key = `${device.name} (${device.mac})|${day}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        const labels = sortedUnique([...counts.keys()].map((key) => key.split("|")[1]));
        if (!labels.length) labels.push(rows.length ? "Nenhuma interrupção" : "Sem medições");
        return chart(id, labels, devices.map((device) => ({
            name: `${device.name} (${device.mac})`,
            data: labels.map((day) => counts.get(`${device.name} (${device.mac})|${day}`) || 0)
        })), "bar", "interrupções");
    }
    if (id === "availability-longest-gap") {
        const labels = devices.map((device) => `${device.name} (${device.mac})`);
        const longest = devices.map((device) => Math.max(0, ...device.gaps.map((gap) => gap.seconds - EXPECTED_SECONDS)));
        return chart(id, labels, [{ name: "Maior lacuna", data: longest }], "hbar", "segundos");
    }
    return null;
}

module.exports = { generate, collect, EXPECTED_SECONDS, INTERRUPTION_SECONDS };
