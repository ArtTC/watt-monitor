const test = require("node:test");
const assert = require("node:assert/strict");
const { integrate, MAX_INTEGRATION_GAP_SECONDS } = require("../src/services/energy.service");
const { detect } = require("../src/services/anomaly.service");
const { collect } = require("../src/services/availability.service");
const comparison = require("../src/services/comparison.service");

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
    assert.equal(chart.labels.length, 2);
    assert.notEqual(chart.series[0].data[0], chart.series[0].data[1]);
});
