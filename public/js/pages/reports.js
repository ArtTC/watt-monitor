import { api, escapeHtml, formatNumber, formatDate } from "../api.js";
import { drawPowerChart } from "../components/chart.js";
import { renderDevicePicker, bindDevicePicker } from "../components/device-picker.js";

let activeListeners = null;

function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function defaultStartDate() { const d = new Date(); d.setDate(d.getDate() - 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function localDateTime(date, time) { return new Date(`${date}T${time}:00`).toISOString(); }
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function csvNumber(value) { return Number(value).toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 12 }); }

export async function mountReports(container, user) {
    container.classList.add("reports-page");
    if (activeListeners) activeListeners.abort();
    activeListeners = new AbortController();
    const { signal } = activeListeners;
    const devices = await api("/api/dispositivos");
    const allDevices = await api("/api/dispositivos/removidos");
    const choices = [...devices, ...allDevices];
    let showSummary = false;
    const columnFilters = { data: "", dispositivo: "", mac: "", tensao: "", corrente: "", potencia: "" };
    let currentPage = 0;
    let pageSize = 10;
    let sortKey = "data";
    let sortDirection = "asc";
    container.innerHTML = `<div class="page-heading"><div><div class="eyebrow">Análise de geração</div><h2>Relatórios</h2><p>Consulte medições por equipamento e período e exporte os resultados.</p></div></div>
      <section class="panel"><form id="report-filters"><div class="form-row report-filter-grid">
        <div class="field"><label>Dispositivos</label>${renderDevicePicker({ id: "report-device-picker", devices: choices, allLabel: "Todos os dispositivos" })}</div>
        <div class="field"><label for="report-start">Data inicial</label><input id="report-start" type="date" required value="${defaultStartDate()}" max="${today()}"></div>
        <div class="field"><label for="report-start-time">Hora inicial</label><input id="report-start-time" type="time" required value="00:00"></div>
        <div class="field"><label for="report-end">Data final</label><input id="report-end" type="date" required value="${today()}" max="${today()}"></div>
        <div class="field"><label for="report-end-time">Hora final</label><input id="report-end-time" type="time" required value="23:59"></div>
      </div><div class="form-actions"><button class="btn btn-primary" type="submit">Aplicar filtros</button><button class="btn" id="report-clear-filters" type="button">Limpar filtros</button><button class="btn" id="report-csv" type="button">Exportar CSV</button><button class="btn" id="report-pdf" type="button">Salvar PDF</button></div>
      <label class="report-option"><input id="report-summary-toggle" type="checkbox"><span>Exibir indicadores e gráfico no relatório</span></label></form></section>
      <div id="report-results"><div class="empty">Carregando relatório...</div></div>`;
    let report = { medicoes: [], indicadores: {} };
    const devicePicker = bindDevicePicker(container, "report-device-picker", { allLabel: "Todos os dispositivos", signal });

    async function load() {
        const start = document.getElementById("report-start").value;
        const end = document.getElementById("report-end").value;
        const startTime = document.getElementById("report-start-time").value;
        const endTime = document.getElementById("report-end-time").value;
        if (!start || !end || !startTime || !endTime || start > end || (start === end && startTime > endTime)) { window.alert("A data e hora iniciais devem ser anteriores ou iguais às finais."); return; }
        const macs = devicePicker.selected();
        if (!macs.length) { window.alert("Selecione ao menos um dispositivo."); return; }
        const params = new URLSearchParams({ inicio: start, fim: end, hora_inicio: startTime, hora_fim: endTime, inicio_em: localDateTime(start, startTime), fim_em: localDateTime(end, endTime) });
        macs.forEach((mac) => params.append("esp_id", mac));
        const results = document.getElementById("report-results"); results.innerHTML = `<div class="empty">Carregando relatório...</div>`;
        report = await api(`/api/relatorios?${params}`);
        const labels = [["Tensão", "tensao", "V"], ["Corrente", "corrente", "A"], ["Potência", "potencia", "W"]];
        results.innerHTML = `<div class="summary-grid report-summary"><article class="summary-card"><div class="summary-label">Medições</div><div class="summary-value">${report.quantidade}</div></article>${labels.map(([label, key, unit]) => { const x = report.indicadores[key]; return `<article class="summary-card"><div class="summary-label">${label} média</div><div class="summary-value">${x.media === null ? "—" : `${formatNumber(x.media)} ${unit}`}</div><div class="summary-note">Mín. ${x.minima === null ? "—" : formatNumber(x.minima)} · Máx. ${x.maxima === null ? "—" : formatNumber(x.maxima)}</div></article>`; }).join("")}</div>
        <section class="panel report-chart-panel"><div class="section-head"><div><h3>Potência ao longo do período</h3><p class="section-sub">${escapeHtml(start)} a ${escapeHtml(end)}</p></div></div><div class="chart-wrap report-chart"><canvas id="report-chart" aria-label="Gráfico de potência do período"></canvas><div id="report-empty" class="empty" hidden>Sem medições no período selecionado.</div></div></section>
        <section class="panel report-table-panel"><div class="section-head"><div><h3>Medições detalhadas</h3><p class="section-sub">Dados pertencentes à sua conta.</p></div><span class="period" id="report-row-count">${report.medicoes.length} registro(s)</span></div><div class="table-scroll"><table><thead><tr>
          <th><button class="report-sort" data-sort="data" data-label="Data e hora" type="button">Data e hora <span></span></button><input class="table-filter" data-filter="data" type="search" placeholder="Filtrar data" aria-label="Filtrar por data e hora"></th>
          <th><button class="report-sort" data-sort="dispositivo" data-label="Equipamento" type="button">Equipamento <span></span></button><input class="table-filter" data-filter="dispositivo" type="search" placeholder="Filtrar equipamento" aria-label="Filtrar por equipamento"></th>
          <th><button class="report-sort" data-sort="mac" data-label="MAC" type="button">MAC <span></span></button><input class="table-filter" data-filter="mac" type="search" placeholder="Filtrar MAC" aria-label="Filtrar por MAC"></th>
          <th><button class="report-sort" data-sort="tensao" data-label="Tensão" type="button">Tensão (V) <span></span></button><input class="table-filter" data-filter="tensao" type="search" placeholder="Filtrar tensão" aria-label="Filtrar por tensão"></th>
          <th><button class="report-sort" data-sort="corrente" data-label="Corrente" type="button">Corrente (A) <span></span></button><input class="table-filter" data-filter="corrente" type="search" placeholder="Filtrar corrente" aria-label="Filtrar por corrente"></th>
          <th><button class="report-sort" data-sort="potencia" data-label="Potência" type="button">Potência (W) <span></span></button><input class="table-filter" data-filter="potencia" type="search" placeholder="Filtrar potência" aria-label="Filtrar por potência"></th>
        </tr></thead><tbody id="report-table-body"></tbody></table></div>
        <div class="report-table-controls"><label class="report-page-size">Linhas por página<select id="report-page-size"><option>10</option><option>25</option><option>50</option><option>100</option></select></label><div class="report-pagination"><button class="btn" id="report-prev" type="button">Anterior</button><span id="report-page-label">Página 1 de 1</span><button class="btn" id="report-next" type="button">Próxima</button></div></div></section>`;
        Object.keys(columnFilters).forEach((key) => { columnFilters[key] = ""; });
        currentPage = 0;
        const renderTable = () => {
            const filtered = report.medicoes.filter((row) => {
                const values = {
                    data: formatDate(row.data_hora),
                    dispositivo: row.dispositivo,
                    mac: row.esp_id,
                    tensao: formatNumber(row.tensao),
                    corrente: formatNumber(row.corrente, 3),
                    potencia: formatNumber(row.potencia)
                };
                return Object.entries(columnFilters).every(([key, term]) => !term || values[key].toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")));
            });
            const numericSort = ["tensao", "corrente", "potencia"].includes(sortKey);
            const sortField = sortKey === "data" ? "data_hora" : sortKey === "mac" ? "esp_id" : sortKey;
            const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
            filtered.sort((a, b) => {
                const comparison = numericSort
                    ? Number(a[sortField]) - Number(b[sortField])
                    : collator.compare(String(a[sortField] ?? ""), String(b[sortField] ?? ""));
                return comparison * (sortDirection === "asc" ? 1 : -1);
            });
            results.querySelectorAll(".report-sort").forEach((button) => {
                const active = button.dataset.sort === sortKey;
                button.querySelector("span").textContent = active ? (sortDirection === "asc" ? "↑" : "↓") : "↕";
                button.setAttribute("aria-label", `Ordenar por ${button.dataset.label} ${active && sortDirection === "asc" ? "em ordem decrescente" : "em ordem crescente"}`);
                button.closest("th").setAttribute("aria-sort", active ? (sortDirection === "asc" ? "ascending" : "descending") : "none");
            });
            const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
            currentPage = Math.min(currentPage, pages - 1);
            const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
            document.getElementById("report-table-body").innerHTML = visible.map((r) => `<tr><td>${escapeHtml(formatDate(r.data_hora))}</td><td>${escapeHtml(r.dispositivo)}</td><td>${escapeHtml(r.esp_id)}</td><td>${formatNumber(r.tensao)}</td><td>${formatNumber(r.corrente, 3)}</td><td>${formatNumber(r.potencia)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">Nenhuma medição corresponde aos filtros.</td></tr>`;
            document.getElementById("report-row-count").textContent = `${filtered.length} registro(s)`;
            document.getElementById("report-page-label").textContent = `Página ${currentPage + 1} de ${pages}`;
            document.getElementById("report-prev").disabled = currentPage === 0;
            document.getElementById("report-next").disabled = currentPage >= pages - 1;
        };
        results.querySelectorAll(".table-filter").forEach((input) => input.addEventListener("input", () => {
            columnFilters[input.dataset.filter] = input.value.trim(); currentPage = 0; renderTable();
        }));
        results.querySelectorAll(".report-sort").forEach((button) => button.addEventListener("click", () => {
            if (sortKey === button.dataset.sort) sortDirection = sortDirection === "asc" ? "desc" : "asc";
            else { sortKey = button.dataset.sort; sortDirection = "asc"; }
            currentPage = 0; renderTable();
        }, { signal }));
        document.getElementById("report-page-size").value = String(pageSize);
        document.getElementById("report-page-size").addEventListener("change", (event) => { pageSize = Number(event.target.value); currentPage = 0; renderTable(); }, { signal });
        document.getElementById("report-prev").addEventListener("click", () => { currentPage--; renderTable(); }, { signal });
        document.getElementById("report-next").addEventListener("click", () => { currentPage++; renderTable(); }, { signal });
        renderTable();
        drawPowerChart(document.getElementById("report-chart"), document.getElementById("report-empty"), report.medicoes);
        results.querySelector(".report-chart-panel .section-sub").textContent = `${start} ${startTime} a ${end} ${endTime}`;
        results.querySelector(".report-summary").hidden = !showSummary;
        results.querySelector(".report-chart-panel").hidden = !showSummary;
    }
    window.addEventListener("themechange", () => {
        const canvas = document.getElementById("report-chart"), empty = document.getElementById("report-empty");
        if (canvas && empty) drawPowerChart(canvas, empty, report.medicoes);
    }, { signal });
    document.getElementById("report-filters").addEventListener("submit", (event) => { event.preventDefault(); load().catch((e) => window.alert(e.message)); }, { signal });
    document.getElementById("report-clear-filters").addEventListener("click", () => {
        container.querySelectorAll(".device-picker-item").forEach((input) => { input.checked = true; }); devicePicker.sync();
        document.getElementById("report-start").value = defaultStartDate();
        document.getElementById("report-start-time").value = "00:00";
        document.getElementById("report-end").value = today();
        document.getElementById("report-end-time").value = "23:59";
        container.querySelectorAll(".table-filter").forEach((input) => { input.value = ""; });
        Object.keys(columnFilters).forEach((key) => { columnFilters[key] = ""; });
        load().catch((e) => window.alert(e.message));
    }, { signal });
    document.getElementById("report-summary-toggle").addEventListener("change", (event) => {
        showSummary = event.target.checked;
        document.querySelector("#report-results .report-summary")?.toggleAttribute("hidden", !showSummary);
        document.querySelector("#report-results .report-chart-panel")?.toggleAttribute("hidden", !showSummary);
    }, { signal });
    document.getElementById("report-csv").addEventListener("click", () => {
        const rows = [["Data e hora", "Equipamento", "MAC", "Tensão (V)", "Corrente (A)", "Potência (W)"], ...report.medicoes.map((r) => [r.data_hora, r.dispositivo, r.esp_id, csvNumber(r.tensao), csvNumber(r.corrente), csvNumber(r.potencia)])];
        const content = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
        const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = `relatorio-medidor-solar-${report.periodo?.inicio || ""}.csv`; a.click(); URL.revokeObjectURL(url);
    }, { signal });
    document.getElementById("report-pdf").addEventListener("click", () => {
        const selected = choices.filter((d) => devicePicker.selected().includes(d.esp_id));
        const selectedLabel = selected.length === choices.length ? "Todos os dispositivos da conta" : selected.map((d) => `${d.nome} · ${d.esp_id}`).join(", ");
        const canvas = document.getElementById("report-chart");
        const chart = !showSummary ? "" : report.medicoes.length ? `<img class="chart" src="${canvas.toDataURL("image/png")}">` : "<p>Sem medições no período.</p>";
        const metrics = [["Tensão (V)", "tensao"], ["Corrente (A)", "corrente"], ["Potência (W)", "potencia"]].map(([name, key]) => { const x = report.indicadores[key]; return `<tr><th>${name}</th><td>Média: ${x.media === null ? "—" : formatNumber(x.media)} · Mínima: ${x.minima === null ? "—" : formatNumber(x.minima)} · Máxima: ${x.maxima === null ? "—" : formatNumber(x.maxima)}</td></tr>`; }).join("");
        const rows = report.medicoes.map((r) => `<tr><td>${escapeHtml(formatDate(r.data_hora))}</td><td>${escapeHtml(r.dispositivo)}</td><td>${escapeHtml(r.esp_id)}</td><td>${formatNumber(r.tensao)}</td><td>${formatNumber(r.corrente, 3)}</td><td>${formatNumber(r.potencia)}</td></tr>`).join("");
        const win = window.open("", "_blank");
        if (!win) { window.alert("Permita pop-ups para gerar o PDF."); return; }
        win.document.write(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório Medidor Solar</title><style>body{font:12px Arial;color:#17231c;margin:28px}h1{color:#235d3b}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{text-align:left;padding:7px;border:1px solid #ccd5ce}thead{background:#eaf3ec}.chart{width:100%;height:230px;object-fit:contain}.meta{line-height:1.7}@media print{body{margin:15mm}tr{break-inside:avoid}}</style><h1>Relatório de medições solares</h1><div class="meta"><b>Usuário:</b> ${escapeHtml(user?.nome || "")} (${escapeHtml(user?.email || "")})<br><b>Equipamento:</b> ${escapeHtml(selectedLabel)}<br><b>Período:</b> ${escapeHtml(report.periodo.inicio)} a ${escapeHtml(report.periodo.fim)}<br><b>Medições:</b> ${report.quantidade}<br><b>Gerado em:</b> ${new Date().toLocaleString("pt-BR")}</div><h2>Indicadores</h2><table>${metrics}</table><h2>Potência no período</h2>${chart}<h2>Medições detalhadas</h2><table><thead><tr><th>Data e hora</th><th>Equipamento</th><th>MAC</th><th>Tensão (V)</th><th>Corrente (A)</th><th>Potência (W)</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()<\/script></html>`);
        const pdfMetadata = win.document.querySelector(".meta");
        pdfMetadata.append(win.document.createElement("br"), `Horário: ${report.periodo.hora_inicio} a ${report.periodo.hora_fim}`);
        if (!showSummary) {
            const headings = win.document.querySelectorAll("h2");
            headings[0]?.remove(); headings[1]?.remove();
            win.document.querySelector("table")?.remove();
        }
        win.document.close();
    });
    await load();
}
