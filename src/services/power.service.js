const { groupByDevice, bucketFor, chart, sortedUnique, round } = require("./analytics.helpers");

function generate(rows, id, aggregation, knownDevices = [], timezoneOffsetMinutes = 0) {
    const devices = groupByDevice(rows, knownDevices);
    const interval = { hour: "hora", day: "dia", month: "mês" }[aggregation] || "intervalo";
    if (id === "power-time") {
        const labels = sortedUnique(rows.map((row) => bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes)));
        const displayLabels = labels.length > 900 ? labels.filter((_, index) => index % Math.ceil(labels.length / 900) === 0) : labels;
        const series = devices.map((device) => {
            const grouped = new Map();
            for (const row of device.rows) {
                const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
                if (!grouped.has(label)) grouped.set(label, []);
                grouped.get(label).push(Number(row.potencia));
            }
            return { name: `${device.name} (${device.mac})`, data: displayLabels.map((label) => {
                const bucket = grouped.get(label);
                return bucket?.length ? bucket.reduce((sum, value) => sum + value, 0) / bucket.length : null;
            }) };
        });
        return { ...chart(id, displayLabels, series, "line", "W"), descricao: `Potência média agrupada por ${interval}.` };
    }
    if (id === "power-hourly-average") {
        const values = new Map();
        for (const row of rows) {
            const label = bucketFor(row.data_hora, aggregation, timezoneOffsetMinutes);
            if (!values.has(label)) values.set(label, []);
            values.get(label).push(Number(row.potencia));
        }
        const labels = sortedUnique([...values.keys()]);
        const result = chart(id, labels, [{ name: `Potência média por ${interval}`, data: labels.map((label) => {
            const bucket = values.get(label);
            return bucket.length ? bucket.reduce((sum, value) => sum + value, 0) / bucket.length : null;
        }) }], "bar", "W");
        return { ...result, titulo: `Potência média por ${interval}`, descricao: `Média das leituras de potência agrupadas por ${interval}.` };
    }
    if (id === "power-daily-max" || id === "power-period-comparison") {
        const bucketSize = aggregation;
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
        const result = chart(id, labels, series, "bar", "W");
        if (id === "power-daily-max") return { ...result, titulo: `Potência máxima por ${interval}`, descricao: `Maior leitura de potência em cada intervalo de ${interval}.` };
        return { ...result, titulo: `Comparação de potência por ${interval}`, descricao: `Potência média por equipamento em cada intervalo de ${interval}.` };
    }
    if (id === "power-variation") {
        const points = devices.map((device) => {
            const variations = new Map();
            for (let index = 1; index < device.rows.length; index++) {
                const previous = Number(device.rows[index - 1].potencia);
                const current = Number(device.rows[index].potencia);
                if (Math.abs(previous) <= 1e-6) continue;
                const label = bucketFor(device.rows[index].data_hora, aggregation, timezoneOffsetMinutes);
                if (!variations.has(label)) variations.set(label, []);
                variations.get(label).push((current - previous) / Math.abs(previous) * 100);
            }
            return { name: `${device.name} (${device.mac})`, values: variations };
        });
        const labels = sortedUnique(points.flatMap((device) => [...device.values.keys()]));
        const displayLabels = labels.length > 900 ? labels.filter((_, index) => index % Math.ceil(labels.length / 900) === 0) : labels;
        const series = points.map((device) => ({
            name: device.name,
            data: displayLabels.map((label) => {
                const values = device.values.get(label);
                return values?.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
            })
        }));
        return chart(id, displayLabels, series, "line", "%");
    }
    return null;
}

module.exports = { generate };
