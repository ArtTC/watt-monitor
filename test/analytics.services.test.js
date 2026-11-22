const test = require("node:test");
const assert = require("node:assert/strict");
const energy = require("../src/services/energy.service");
const { integrate, MAX_INTEGRATION_GAP_SECONDS } = energy;
const { detect } = require("../src/services/anomaly.service");
const { collect } = require("../src/services/availability.service");
const comparison = require("../src/services/comparison.service");
const electrical = require("../src/services/electrical.service");
const power = require("../src/services/power.service");
const availability = require("../src/services/availability.service");
const { allGraphIds } = require("../src/services/analytics.catalog");

function row(deviceId, name, mac, dataHora, potencia, tensao = 100, corrente = 1) {
    return { device_id: deviceId, device_name: name, esp_id: mac, data_hora: dataHora, potencia, tensao, corrente };
}

test("energia trapezoidal divide um intervalo que cruza a meia-noite", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-01T23:59:50.000Z", 100),
        row(1, "Painel A", "AA:00", "2026-01-02T00:00:10.000Z", 200)
    ];
    const buckets = integrate(points);
    assert.ok(Math.abs(buckets.get("2026-01-01") - (125 * 10 / 3600)) < 1e-9);
    assert.ok(Math.abs(buckets.get("2026-01-02") - (175 * 10 / 3600)) < 1e-9);
});

test("gráficos de energia respeitam o agrupamento por hora, dia e mês", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:00.000Z", 100),
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:10.000Z", 200),
        row(1, "Painel A", "AA:00", "2026-01-02T10:00:00.000Z", 200),
        row(1, "Painel A", "AA:00", "2026-01-02T10:00:10.000Z", 400)
    ];
    const devices = [{ id: 1, nome: "Painel A", esp_id: "AA:00" }];
    for (const [aggregation, labels, values, titleInterval] of [
        ["hour", ["2026-01-01 10:00", "2026-01-02 10:00"], [0.417, 0.833], "hora"],
        ["day", ["2026-01-01", "2026-01-02"], [0.417, 0.833], "dia"],
        ["month", ["2026-01"], [1.25], "mês"]
    ]) {
        const generated = ["energy-day", "energy-month", "energy-cumulative", "energy-daily-comparison", "energy-hourly-profile"]
            .map((id) => energy.generate(points, id, aggregation, devices));
        for (const graph of generated) assert.deepEqual(graph.labels, labels);
        assert.deepEqual(generated[0].series[0].data, values);
        assert.deepEqual(generated[1].series[0].data, values);
        assert.equal(generated[0].titulo, `Energia gerada por ${titleInterval}`);
        assert.deepEqual(generated[2].series[0].data, aggregation === "month" ? [1.25] : [0.417, 1.25]);
        assert.deepEqual(generated[3].series[0].data, values);
        assert.deepEqual(generated[4].series[0].data, values);
    }
});

test("energia divide a meia-noite no fuso local selecionado", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-01T22:59:50.000Z", 100),
        row(1, "Painel A", "AA:00", "2026-01-01T23:00:10.000Z", 200)
    ];
    const buckets = integrate(points, "day", -60);
    assert.ok(buckets.has("2026-01-01"));
    assert.ok(buckets.has("2026-01-02"));
});

test("energia não integra lacunas maiores que o limite seguro", () => {
    const points = [row(1, "Painel A", "AA:00", "2026-01-01T00:00:00.000Z", 100), row(1, "Painel A", "AA:00", `2026-01-01T00:00:${String(MAX_INTEGRATION_GAP_SECONDS + 1).padStart(2, "0")}.000Z`, 100)];
    assert.equal(integrate(points).size, 0);
});

test("anomalias sinalizam queda de potência e inconsistência elétrica", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-01T00:00:00.000Z", 100, 100, 1),
        row(1, "Painel A", "AA:00", "2026-01-01T00:00:05.000Z", 40, 100, 1)
    ];
    assert.equal(detect(points, "anomaly-power-drop").length, 1);
    assert.equal(detect(points, "anomaly-inconsistency").length, 1);
    const lowGeneration = Array.from({ length: 5 }, (_, index) => row(1, "Painel A", "AA:00", `2026-01-01T00:00:0${index}.000Z`, 0, 0, 0));
    assert.equal(detect(lowGeneration, "anomaly-repeated").length, 0);
});

test("disponibilidade identifica lacunas e comparação mantém equipamentos separados", () => {
    const start = "2026-01-01T00:00:00.000Z", end = "2026-01-01T00:01:00.000Z";
    const points = [row(1, "Painel A", "AA:00", "2026-01-01T00:00:10.000Z", 10), row(1, "Painel A", "AA:00", "2026-01-01T00:00:30.000Z", 10), row(2, "Painel B", "BB:00", "2026-01-01T00:00:30.000Z", 20)];
    const gaps = collect(points, start, end);
    assert.ok(gaps[0].gaps.some((gap) => gap.seconds === 20));
    const chart = comparison.generate(points, "compare-power-avg");
    assert.equal(chart.labels.length, 1);
    assert.equal(chart.series.length, 2);
    assert.notEqual(chart.series[0].data[0], chart.series[1].data[0]);
});

test("gráficos de comparação por equipamento respeitam hora, dia e mês", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:00.000Z", 100, 220, 1),
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:10.000Z", 200, 224, 2),
        row(1, "Painel A", "AA:00", "2026-01-02T10:00:00.000Z", 300, 230, 3),
        row(2, "Painel B", "BB:00", "2026-02-01T10:00:00.000Z", 400, 240, 4)
    ];
    const devices = [{ id: 1, nome: "Painel A", esp_id: "AA:00" }, { id: 2, nome: "Painel B", esp_id: "BB:00" }];
    const ids = ["compare-energy", "compare-power-avg", "compare-power-max", "compare-hour-profile", "compare-voltage", "compare-current"];
    for (const aggregation of ["hour", "day", "month"]) {
        const generated = ids.map((id) => comparison.generate(points, id, aggregation, devices));
        const expectedLabels = aggregation === "hour"
            ? ["2026-01-01 10:00", "2026-01-02 10:00", "2026-02-01 10:00"]
            : aggregation === "day" ? ["2026-01-01", "2026-01-02", "2026-02-01"] : ["2026-01", "2026-02"];
        for (const graph of generated) assert.deepEqual(graph.labels, expectedLabels);
        for (const graph of generated) assert.equal(graph.series.length, 2);
        assert.deepEqual(generated[1].series[0].data, aggregation === "month" ? [200, null] : [150, 300, null]);
        assert.deepEqual(generated[2].series[0].data, aggregation === "month" ? [300, null] : [200, 300, null]);
        assert.deepEqual(generated[4].series[0].data, aggregation === "month" ? [224.667, null] : [222, 230, null]);
        assert.deepEqual(generated[5].series[0].data, aggregation === "month" ? [2, null] : [1.5, 3, null]);
    }
});

test("gráficos de disponibilidade respeitam hora, dia e mês", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-31T23:59:50.000Z", 100),
        row(1, "Painel A", "AA:00", "2026-02-01T00:00:00.000Z", 100),
        row(1, "Painel A", "AA:00", "2026-02-01T00:00:10.000Z", 100)
    ];
    const devices = [{ id: 1, nome: "Painel A", esp_id: "AA:00" }];
    const start = "2026-01-31T23:59:45.000Z";
    const end = "2026-02-01T00:00:15.000Z";
    const ids = ["availability-history", "availability-percent", "availability-interruptions"];
    for (const [aggregation, expectedLabels] of [
        ["minute", ["2026-01-31 23:59", "2026-02-01 00:00"]],
        ["hour", ["2026-01-31 23:00", "2026-02-01 00:00"]],
        ["day", ["2026-01-31", "2026-02-01"]],
        ["month", ["2026-01", "2026-02"]]
    ]) {
        for (const id of ids) {
            const graph = availability.generate(points, id, start, end, aggregation, devices);
            assert.deepEqual(graph.labels, expectedLabels, id);
            assert.equal(graph.series[0].data.length, expectedLabels.length, id);
            assert.match(graph.titulo, aggregation === "minute" ? /minuto$/ : aggregation === "hour" ? /hora$/ : aggregation === "day" ? /dia$/ : /mês$/);
        }
    }
    assert.deepEqual(availability.generate(points, "availability-history", start, end, "day", devices).series[0].data, [1, 2]);
});

test("gráficos de tensão preservam pontos de uma única data", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:00.000Z", 100, 220),
        row(1, "Painel A", "AA:00", "2026-01-01T10:05:00.000Z", 100, 224)
    ];
    const devices = [{ id: 1, nome: "Painel A", esp_id: "AA:00" }];
    const average = electrical.generate(points, "voltage-daily-average", "day", devices);
    const hourlyAverage = electrical.generate(points, "voltage-daily-average", "hour", devices);
    const monthlyAverage = electrical.generate(points, "voltage-daily-average", "month", devices);
    const range = electrical.generate(points, "voltage-range", "day", devices);
    const timeSeries = electrical.generate(points, "voltage-time", "day", devices);
    const oscillations = electrical.generate(points, "voltage-oscillation", "day", devices);
    const distribution = electrical.generate(points, "voltage-distribution", "day", devices);
    assert.deepEqual(average.labels, ["2026-01-01"]);
    assert.deepEqual(average.series[0].data, [222]);
    assert.equal(average.titulo, "Tensão média por dia");
    assert.deepEqual(hourlyAverage.labels, ["2026-01-01 10:00"]);
    assert.deepEqual(hourlyAverage.series[0].data, [222]);
    assert.equal(hourlyAverage.titulo, "Tensão média por hora");
    assert.deepEqual(monthlyAverage.labels, ["2026-01"]);
    assert.deepEqual(monthlyAverage.series[0].data, [222]);
    assert.equal(monthlyAverage.titulo, "Tensão média por mês");
    assert.deepEqual(range.labels, ["2026-01-01"]);
    assert.deepEqual(range.series.map((series) => series.data), [[220], [224]]);
    assert.deepEqual(timeSeries.labels, ["2026-01-01"]);
    assert.deepEqual(timeSeries.series[0].data, [222]);
    assert.deepEqual(oscillations.labels, ["2026-01-01"]);
    assert.deepEqual(oscillations.series[0].data, [4]);
    assert.equal(distribution.type, "hbar");
    assert.deepEqual(distribution.labels, ["222.00 V"]);
    assert.deepEqual(distribution.series[0].data, [1]);
    const distributionRows = [
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:00.000Z", 0, 220),
        row(1, "Painel A", "AA:00", "2026-01-02T10:00:00.000Z", 0, 224),
        row(1, "Painel A", "AA:00", "2026-01-03T10:00:00.000Z", 0, 224)
    ];
    const orderedDistribution = electrical.generate(distributionRows, "voltage-distribution", "day", devices);
    assert.deepEqual(orderedDistribution.labels, ["224.00 V", "220.00 V"]);
    assert.deepEqual(orderedDistribution.series[0].data, [2, 1]);
});

test("gráficos de potência respeitam o agrupamento diário selecionado", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:00.000Z", 100),
        row(1, "Painel A", "AA:00", "2026-01-01T10:05:00.000Z", 200),
        row(1, "Painel A", "AA:00", "2026-01-02T10:00:00.000Z", 100)
    ];
    const devices = [{ id: 1, nome: "Painel A", esp_id: "AA:00" }];
    const timeSeries = power.generate(points, "power-time", "day", devices);
    const meanBars = power.generate(points, "power-hourly-average", "day", devices);
    const maxBars = power.generate(points, "power-daily-max", "day", devices);
    const comparisonBars = power.generate(points, "power-period-comparison", "day", devices);
    const variation = power.generate(points, "power-variation", "day", devices);
    assert.deepEqual(timeSeries.labels, ["2026-01-01", "2026-01-02"]);
    assert.deepEqual(timeSeries.series[0].data, [150, 100]);
    assert.deepEqual(meanBars.labels, ["2026-01-01", "2026-01-02"]);
    assert.deepEqual(meanBars.series[0].data, [150, 100]);
    assert.equal(meanBars.titulo, "Potência média por dia");
    assert.deepEqual(maxBars.labels, ["2026-01-01", "2026-01-02"]);
    assert.deepEqual(maxBars.series[0].data, [200, 100]);
    assert.equal(maxBars.titulo, "Potência máxima por dia");
    assert.deepEqual(comparisonBars.series[0].data, [150, 100]);
    assert.deepEqual(variation.labels, ["2026-01-01", "2026-01-02"]);
    assert.deepEqual(variation.series[0].data, [100, -50]);
});

test("resumos de potência, tensão e corrente agrupam média, mínima e máxima por minuto", () => {
    const points = [
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:05.000Z", 10, 220, 1),
        row(1, "Painel A", "AA:00", "2026-01-01T10:00:45.000Z", 30, 230, 3),
        row(1, "Painel A", "AA:00", "2026-01-01T10:01:05.000Z", 20, 225, 2)
    ];
    const devices = [{ id: 1, nome: "Painel A", esp_id: "AA:00" }];
    for (const [service, id, values] of [
        [power, "power-summary", [10, 30, 20]],
        [electrical, "voltage-summary", [220, 230, 225]],
        [electrical, "current-summary", [1, 3, 2]]
    ]) {
        const graph = service.generate(points, id, "minute", devices);
        assert.deepEqual(graph.labels, ["2026-01-01 10:00", "2026-01-01 10:01"]);
        assert.deepEqual(graph.series.map((series) => series.data), [[(values[0] + values[1]) / 2, values[2]], [values[0], values[2]], [values[1], values[2]]]);
    }
});

test("catálogo de análises remove gráficos ao longo do tempo e comparação entre equipamentos", () => {
    assert.equal(allGraphIds.includes("power-time"), false);
    assert.equal(allGraphIds.includes("current-time"), false);
    assert.equal(allGraphIds.some((id) => id.startsWith("compare-")), false);
    assert.equal(allGraphIds.includes("power-summary"), true);
    assert.equal(allGraphIds.includes("voltage-summary"), true);
    assert.equal(allGraphIds.includes("current-summary"), true);
});
