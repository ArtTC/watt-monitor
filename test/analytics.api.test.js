const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { allGraphIds } = require("../src/services/analytics.catalog");

async function unusedPort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

test("análises autenticadas filtram por dispositivo e preservam Relatórios", async (t) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "medidor-analytics-"));
    const database = path.join(temp, "analytics.db");
    const seed = new DatabaseSync(database);
    seed.exec(fs.readFileSync(path.join(__dirname, "..", "database", "schema.sql"), "utf8"));
    seed.close();
    const port = await unusedPort();
    const server = spawn(process.execPath, ["server.js"], { cwd: path.join(__dirname, ".."), env: { ...process.env, DATABASE_PATH: database, PORT: String(port) }, stdio: "ignore" });
    const base = `http://127.0.0.1:${port}`;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    t.after(async () => { server.kill(); await sleep(150); fs.rmSync(temp, { recursive: true, force: true }); });

    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
        try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* server is starting */ }
        if (ready) break;
        await sleep(100);
    }
    assert.equal(ready, true, "server starts on a temporary SQLite database");

    async function request(url, method = "GET", token, body) {
        const response = await fetch(`${base}${url}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
        return { status: response.status, json: await response.json() };
    }
    async function createUser(email) {
        const response = await request("/api/auth/register", "POST", null, { nome: "Análise", email, senha: "senha-teste-123" });
        assert.equal(response.status, 201);
        return response.json.token;
    }

    const owner = await createUser("analytics-owner@example.test");
    const other = await createUser("analytics-other@example.test");
    const macA = "AA:BB:CC:DD:EE:01", macB = "AA:BB:CC:DD:EE:02", foreignMac = "AA:BB:CC:DD:EE:03";
    for (const [token, name, mac] of [[owner, "Painel A", macA], [owner, "Painel B", macB], [other, "Painel externo", foreignMac]]) {
        assert.equal((await request("/api/dispositivos", "POST", token, { nome: name, esp_id: mac })).status, 201);
    }
    const day = new Date().toISOString().slice(0, 10);
    const writer = new DatabaseSync(database);
    const ownerId = writer.prepare("SELECT id FROM usuarios WHERE email = ?").get("analytics-owner@example.test").id;
    writer.prepare("INSERT INTO medicoes (esp_id,data_hora,tensao,corrente,potencia) VALUES (?,?,?,?,?)").run(macA, `${day}T10:00:00.000Z`, 220, 1, 100);
    writer.prepare("INSERT INTO medicoes (esp_id,data_hora,tensao,corrente,potencia) VALUES (?,?,?,?,?)").run(macA, `${day}T10:00:05.000Z`, 220, 1, 200);
    writer.prepare("INSERT INTO medicoes (esp_id,data_hora,tensao,corrente,potencia) VALUES (?,?,?,?,?)").run(macB, `${day}T10:00:00.000Z`, 110, 2, 40);
    writer.prepare("INSERT INTO medicoes (esp_id,data_hora,tensao,corrente,potencia) VALUES (?,?,?,?,?)").run(macB, `${day}T10:00:05.000Z`, 110, 2, 50);
    writer.close();

    const start = new Date(`${day}T00:00:00.000Z`).toISOString();
    const end = new Date(`${day}T23:59:59.999Z`).toISOString();
    const body = { inicio: day, fim: day, inicio_em: start, fim_em: end, agrupamento: "day", esp_ids: [macA, macB], graficos: allGraphIds };
    assert.equal((await request("/api/analises", "POST", null, body)).status, 401);
    const result = await request("/api/analises", "POST", owner, body);
    assert.equal(result.status, 200);
    assert.equal(result.json.indicadores.quantidade_medicoes, 4);
    assert.equal(result.json.indicadores.quantidade_equipamentos, 2);
    assert.deepEqual(Object.keys(result.json.graficos).sort(), [...allGraphIds].sort());
    assert.deepEqual(result.json.graficos["compare-power-avg"].series[0].data, [150, 45]);
    assert.equal(result.json.indicadores.energia_wh, 0.271);
    const offset = 180;
    const saoPauloRange = await request("/api/analises", "POST", owner, {
        ...body, fuso_minutos: offset,
        inicio_em: new Date(Date.parse(`${day}T00:00:00.000Z`) + offset * 60000).toISOString(),
        fim_em: new Date(Date.parse(`${day}T23:59:59.999Z`) + offset * 60000).toISOString(),
        graficos: []
    });
    assert.equal(saoPauloRange.status, 200);
    const oneDevice = await request("/api/analises", "POST", owner, { ...body, esp_ids: [macA], graficos: ["compare-power-avg"] });
    assert.deepEqual(oneDevice.json.graficos["compare-power-avg"].labels, ["Painel A (AA:BB:CC:DD:EE:01)"]);
    const outsidePeriod = await request("/api/analises", "POST", owner, { ...body, inicio_em: `${day}T11:00:00.000Z`, fim_em: `${day}T12:00:00.000Z`, graficos: ["power-time"] });
    assert.equal(outsidePeriod.json.indicadores.quantidade_medicoes, 0);
    assert.equal((await request("/api/analises", "POST", owner, { ...body, esp_ids: [foreignMac] })).status, 404);

    const query = new URLSearchParams({ inicio: day, fim: day, hora_inicio: "00:00", hora_fim: "23:59", inicio_em: start, fim_em: end });
    const reports = await request(`/api/relatorios?${query}`, "GET", owner);
    assert.equal(reports.status, 200);
    assert.equal(reports.json.quantidade, 4);
    assert.equal(ownerId > 0, true);
});
