const { groupByDevice, chart, sortedUnique, localTimestamp, round } = require("./analytics.helpers");

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function detect(rows, id, knownDevices = []) {
    const events = [];
    for (const device of groupByDevice(rows, knownDevices)) {
        const data = device.rows;
        const add = (row, description, value) => events.push({ data_hora: row.data_hora, equipamento: device.name, mac: row.esp_id, descricao: description, valor: round(value, 3) });
        if (id === "anomaly-power-drop") {
            for (let i = 1; i < data.length; i++) {
                const before = Number(data[i - 1].potencia), after = Number(data[i].potencia);
                if (before > 5 && (before - after) / before >= 0.5) add(data[i], `Queda de ${round((before - after) / before * 100, 1)}% em relação à leitura anterior`, after);
            }
        } else if (id === "anomaly-voltage-change" || id === "anomaly-current-change") {
            const key = id === "anomaly-voltage-change" ? "tensao" : "corrente";
            const minimum = key === "tensao" ? 1 : 0.05;
            for (let i = 3; i < data.length; i++) {
                const baseline = median(data.slice(Math.max(0, i - 7), i).map((row) => Number(row[key])));
                const value = Number(data[i][key]);
                if (Math.abs(baseline) >= minimum && Math.abs(value - baseline) >= minimum && Math.abs((value - baseline) / baseline) >= 0.25) {
                    add(data[i], `Desvio de ${round((value - baseline) / baseline * 100, 1)}% da mediana móvel`, value);
                }
            }
        } else if (id === "anomaly-power-oscillation") {
            let lastReported = -5;
            for (let i = 4; i < data.length; i++) {
                const values = data.slice(i - 4, i + 1).map((row) => Number(row.potencia));
                const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
                const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
                const coefficient = mean > 0 ? Math.sqrt(variance) / mean : 0;
                if (mean > 5 && coefficient > 0.5 && i - lastReported >= 5) {
                    add(data[i], `Coeficiente de variação móvel de ${round(coefficient * 100, 1)}%`, Number(data[i].potencia));
                    lastReported = i;
                }
            }
        } else if (id === "anomaly-repeated") {
            let run = 1;
            for (let i = 1; i < data.length; i++) {
                const previous = ["tensao", "corrente", "potencia"].map((key) => Number(data[i - 1][key])).join("|");
                const current = ["tensao", "corrente", "potencia"].map((key) => Number(data[i][key])).join("|");
                run = current === previous ? run + 1 : 1;
                if (run === 4 && Number(data[i].potencia) > 5) add(data[i], "Quatro ou mais leituras elétricas idênticas consecutivas", Number(data[i].potencia));
            }
        } else if (id === "anomaly-inconsistency") {
            for (const row of data) {
                const expected = Number(row.tensao) * Number(row.corrente);
                const actual = Number(row.potencia);
                const scale = Math.max(Math.abs(expected), Math.abs(actual));
                if (scale > 5 && Math.abs(expected - actual) / scale > 0.3) add(row, `Potência difere ${round(Math.abs(expected - actual) / scale * 100, 1)}% de tensão × corrente`, actual);
            }
        }
    }
    return events;
}

function generate(rows, id, knownDevices = [], timezoneOffsetMinutes = 0) {
    const events = detect(rows, id, knownDevices);
    const byDay = new Map();
    for (const event of events) {
        const day = localTimestamp(event.data_hora, timezoneOffsetMinutes).slice(0, 10);
        byDay.set(day, (byDay.get(day) || 0) + 1);
    }
    const labels = sortedUnique([...byDay.keys()]);
    if (!labels.length) labels.push(rows.length ? "Nenhuma indicação" : "Sem medições");
    return {
        ...chart(id, labels, [{ name: "Indicações", data: labels.map((label) => byDay.get(label) || 0) }], "bar", "ocorrências"),
        details: events.slice(0, 300),
        total: events.length,
        note: "Sinalização estatística exploratória; não confirma falha física."
    };
}

module.exports = { generate, detect, median };
