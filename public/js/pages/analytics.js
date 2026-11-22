import { api, escapeHtml, formatNumber } from "../api.js";
import { drawAnalyticsChart } from "../components/chart.js";
import { renderDevicePicker, bindDevicePicker } from "../components/device-picker.js";

const categories = [
    { id: "energia", name: "Energia", graphs: [["energy-day", "Energia gerada por intervalo"], ["energy-cumulative", "Energia acumulada no período"]] },
    { id: "potencia", name: "Potência", graphs: [["power-summary", "Potência média, mínima e máxima"], ["power-variation", "Histórico de variações de potência"]] },
    { id: "tensao", name: "Tensão", graphs: [["voltage-summary", "Tensão média, mínima e máxima"], ["voltage-distribution", "Distribuição das medições de tensão"], ["voltage-oscillation", "Oscilações de tensão"]] },
    { id: "corrente", name: "Corrente", graphs: [["current-summary", "Corrente média, mínima e máxima"], ["current-distribution", "Distribuição das medições de corrente"], ["current-oscillation", "Oscilações de corrente"]] },
    { id: "anomalias", name: "Diagnóstico e anomalias", graphs: [["anomaly-power-drop", "Quedas bruscas de potência"], ["anomaly-voltage-change", "Alterações significativas de tensão"], ["anomaly-current-change", "Alterações significativas de corrente"], ["anomaly-power-oscillation", "Oscilações excessivas de potência"], ["anomaly-repeated", "Leituras repetidas"], ["anomaly-inconsistency", "Inconsistências entre grandezas elétricas"]] },
    { id: "disponibilidade", name: "Disponibilidade", graphs: [["availability-history", "Histórico de comunicação"], ["availability-percent", "Disponibilidade por período"], ["availability-interruptions", "Quantidade de interrupções"]] }
];
const allGraphIds = categories.flatMap((category) => category.graphs.map(([id]) => id));
const presets = [
    ["full", "Análise completa", allGraphIds],
    ["energy", "Análise de energia", categories[0].graphs.map(([id]) => id)],
    ["electrical", "Análise elétrica", ["power-summary", "voltage-summary", "current-summary"]],
    ["anomalies", "Diagnóstico de anomalias", categories.find((item) => item.id === "anomalias").graphs.map(([id]) => id)],
    ["availability", "Disponibilidade", categories.find((item) => item.id === "disponibilidade").graphs.map(([id]) => id)]
];
const palette = ["#8a6500", "#2367a8", "#ad5a17", "#8141a5", "#b23242", "#00838f"];
let activeListeners = null;

function localDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function displayDate(date) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year.slice(-2)}`;
}
function localTimestamp(date, time = "00:00", end = false) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const value = new Date(year, month - 1, day, hour, minute, end ? 59 : 0, end ? 999 : 0);
    return value.toISOString();
}
function escapeAttr(value) { return escapeHtml(value); }

export async function mountAnalytics(container, user) {
    if (activeListeners) activeListeners.abort();
    activeListeners = new AbortController();
    const { signal } = activeListeners;
    const devices = await api("/api/dispositivos");
    const today = new Date();
    const startDefault = new Date(today); startDefault.setDate(startDefault.getDate() - 7);
    const selectedGraphs = new Set();
    let appliedFilters = null;
    let hasAppliedFilters = false;
    let response = null;
    let loading = false;
    let calculationSequence = 0;
    const chartTypes = new Map();
    const defaultChartType = () => appliedFilters?.agrupamento === "minute" ? "hbar" : "line";

    container.innerHTML = `<div class="page-heading"><div><div class="eyebrow">Exploração de dados</div><h2>Análises</h2><p>Monte suas visualizações e explore o comportamento dos equipamentos fotovoltaicos.</p></div></div>
      <section class="panel analytics-filter-panel" id="analytics-filters">
        <div class="form-row analytics-filter-grid"><div class="field"><label>Equipamentos</label>${renderDevicePicker({ id: "analytics-device-picker", devices, allLabel: "Todos os equipamentos", emptyLabel: "Nenhum equipamento ativo cadastrado." })}</div>
        <div class="field"><label for="analytics-start">Data inicial</label><input id="analytics-start" type="date" value="${localDate(startDefault)}" max="${localDate(today)}"></div>
        <div class="field"><label for="analytics-start-time">Hora inicial</label><input id="analytics-start-time" type="time" value="00:00"></div>
        <div class="field"><label for="analytics-end">Data final</label><input id="analytics-end" type="date" value="${localDate(today)}" max="${localDate(today)}"></div>
        <div class="field"><label for="analytics-end-time">Hora final</label><input id="analytics-end-time" type="time" value="23:59"></div>
        <div class="field"><label for="analytics-group">Agrupar por</label><select id="analytics-group"><option value="minute">Minuto</option><option value="hour" selected>Hora</option><option value="day">Dia</option><option value="month">Mês</option></select></div></div>
        <div id="analytics-notice" class="notice" role="alert"></div><div class="form-actions"><button class="btn btn-primary" id="analytics-apply" type="button">Aplicar filtros</button><button class="btn" id="analytics-clear-filters" type="button">Limpar filtros</button></div></section>
      <section class="panel analytics-builder"><div class="section-head"><div><h3>Gráficos disponíveis</h3><p class="section-sub">Selecione vários gráficos e combine-os na mesma tela.</p></div><div class="page-actions"><button class="btn" id="analytics-expand" type="button">Expandir categorias</button><button class="btn" id="analytics-collapse" type="button">Recolher categorias</button></div></div>
        <div class="field analytics-mode-field"><label for="analytics-mode">Tipo de análise</label><select id="analytics-mode"><option value="custom">Análise personalizada</option><optgroup label="Análises prontas">${presets.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</optgroup></select><p class="section-sub">Escolha uma análise pronta ou personalize os gráficos e categorias abaixo.</p></div>
        <div class="analytics-categories">${categories.map((category) => `<details class="analytics-category" data-category="${category.id}"><summary><span class="analytics-category-title"><input class="analytics-category-check" type="checkbox" data-category-check="${category.id}" aria-label="Selecionar todos os gráficos de ${category.name}"><span>${category.name}</span></span></summary><div class="analytics-checks">${category.graphs.map(([id, title]) => `<label class="analytics-check"><input class="analytics-graph-check" type="checkbox" value="${id}"><span>${title}</span></label>`).join("")}</div></details>`).join("")}</div>
        <div class="form-actions analytics-selection-actions"><span class="muted"><strong id="analytics-selected-count">0</strong> gráfico(s) selecionado(s)</span><button class="btn btn-danger" id="analytics-clear-selection" type="button">Remover todos</button></div></section>
      <section class="analytics-view" id="analytics-view" hidden><div class="section-head"><div><div class="eyebrow">Resultados filtrados</div><h2>Minhas análises</h2></div><div class="page-actions"><button class="btn" id="analytics-back-to-filters" type="button">Voltar aos filtros</button><button class="btn" id="analytics-save-pdf" type="button">Salvar PDF</button><button class="btn btn-primary" id="analytics-refresh" type="button">Atualizar análises</button></div></div>
        <div id="analytics-warning" class="notice"></div><div class="summary-grid analytics-summary" id="analytics-summary"><div class="empty">Aplique os filtros para carregar os indicadores.</div></div>
        <section id="analytics-device-summary-grid" class="panel analytics-device-summary"></section><div id="analytics-results"><div class="empty">Selecione gráficos acima para adicioná-los à sua análise.</div></div></section>`;

    // Define explicitamente o padrão também para navegadores que restauram valores antigos de formulários.
    document.getElementById("analytics-group").value = "hour";

    const readFilters = () => {
        const start = document.getElementById("analytics-start").value;
        const end = document.getElementById("analytics-end").value;
        return { start, end, startTime: document.getElementById("analytics-start-time").value, endTime: document.getElementById("analytics-end-time").value, agrupamento: document.getElementById("analytics-group").value, esp_ids: devicePicker.selected() };
    };
    const devicePicker = bindDevicePicker(container, "analytics-device-picker", { allLabel: "Todos os equipamentos", signal });
    const syncCategoryChecks = () => container.querySelectorAll(".analytics-category-check").forEach((input) => {
        const category = categories.find((item) => item.id === input.dataset.categoryCheck);
        const count = category.graphs.filter(([id]) => selectedGraphs.has(id)).length;
        input.checked = count === category.graphs.length;
        input.indeterminate = count > 0 && count < category.graphs.length;
    });
    const syncGraphChecks = () => {
        container.querySelectorAll(".analytics-graph-check").forEach((input) => { input.checked = selectedGraphs.has(input.value); });
        document.getElementById("analytics-selected-count").textContent = String(selectedGraphs.size);
        syncCategoryChecks();
    };
    const drawCards = () => {
        const target = document.getElementById("analytics-results");
        if (!selectedGraphs.size) {
            target.innerHTML = `<div class="empty analytics-empty">Nenhum gráfico selecionado. Escolha uma categoria ou use um atalho de análise.</div>`;
            return;
        }
        if (loading) target.innerHTML = `<div class="empty">Calculando ${selectedGraphs.size} gráfico(s)…</div>`;
        else if (!response) target.innerHTML = `<div class="empty">Selecione os filtros e aplique para calcular as análises.</div>`;
        else {
            const selectedDevices = devices.filter((device) => appliedFilters.esp_ids.includes(device.esp_id));
            const period = `${displayDate(appliedFilters.start)} ${appliedFilters.startTime} a ${displayDate(appliedFilters.end)} ${appliedFilters.endTime}`;
            const cards = [...selectedGraphs].map((id) => response.graficos[id]).filter(Boolean).map((graph) => {
                const names = selectedDevices.map((device) => `${device.nome}`).join(", ") || "Todos os equipamentos";
                const legend = graph.series.length > 1 ? `<div class="analytics-legend">${graph.series.map((series, index) => `<span><i style="--legend-color:${palette[index % palette.length]}"></i>${escapeHtml(series.name)}</span>`).join("")}</div>` : "";
                const details = graph.id.startsWith("anomaly-") ? `<div class="analytics-events"><p>${escapeHtml(graph.note || "Indicações estatísticas exploratórias.")} ${graph.total > graph.details.length ? `Exibindo ${graph.details.length} de ${graph.total}.` : ""} ${graph.total ? `${graph.total} indicação(ões).` : "Nenhuma indicação neste período."}</p><ul>${graph.details.map((event) => `<li><strong>${escapeHtml(event.equipamento)}</strong><span>${escapeHtml(new Date(event.data_hora).toLocaleString("pt-BR"))} — ${escapeHtml(event.descricao)} (${formatNumber(event.valor)})</span></li>`).join("") || `<li>Nenhuma ocorrência suspeita para os critérios selecionados.</li>`}</ul></div>` : "";
                const chartType = chartTypes.get(graph.id) || defaultChartType();
                const chartHeight = chartType === "hbar" ? Math.min(560, Math.max(250, graph.labels.length * 28 + 30)) : 260;
                return `<article class="analytics-card ${graph.labels.length > 20 ? "analytics-card-wide" : ""}" data-analytics-card="${graph.id}"><div class="analytics-card-head"><div><h3>${escapeHtml(graph.titulo)}</h3><p>${escapeHtml(graph.descricao)}</p></div><button class="btn btn-quiet analytics-remove" data-remove-graph="${graph.id}" type="button" aria-label="Remover ${escapeAttr(graph.titulo)}">×</button></div><label class="analytics-chart-type-control">Tipo de gráfico<select data-chart-type="${graph.id}" aria-label="Tipo de gráfico para ${escapeAttr(graph.titulo)}"><option value="line" ${chartType === "line" ? "selected" : ""}>Linha</option><option value="bar" ${chartType === "bar" ? "selected" : ""}>Coluna</option><option value="hbar" ${chartType === "hbar" ? "selected" : ""}>Barra</option><option value="pie" ${chartType === "pie" ? "selected" : ""}>Pizza</option><option value="doughnut" ${chartType === "doughnut" ? "selected" : ""}>Rosca</option></select></label><div class="analytics-meta"><span><b>Equipamento:</b> ${escapeHtml(names)}</span><span><b>Período:</b> ${escapeHtml(period)}</span><span><b>Unidade:</b> ${escapeHtml(graph.unidade)}</span></div>${legend}<div class="analytics-canvas-wrap" style="height:${chartHeight}px"><canvas class="analytics-chart" data-chart-id="${graph.id}" aria-label="${escapeAttr(graph.titulo)}"></canvas></div>${details}</article>`;
            });
            target.innerHTML = `<div class="analytics-grid">${cards.join("") || `<div class="empty">Os cálculos não retornaram gráficos para esta seleção.</div>`}</div>`;
            target.querySelectorAll(".analytics-chart").forEach((canvas) => {
                const graph = response.graficos[canvas.dataset.chartId];
                drawAnalyticsChart(canvas, { ...graph, type: chartTypes.get(graph.id) || defaultChartType() });
            });
            target.querySelectorAll("[data-chart-type]").forEach((select) => select.addEventListener("change", () => {
                const graph = response?.graficos[select.dataset.chartType];
                if (!graph) return;
                chartTypes.set(graph.id, select.value);
                const card = select.closest(".analytics-card");
                const canvas = card?.querySelector(".analytics-chart");
                const chartWrap = canvas?.parentElement;
                if (chartWrap) chartWrap.style.height = select.value === "hbar" ? `${Math.min(560, Math.max(250, graph.labels.length * 28 + 30))}px` : "260px";
                if (canvas) drawAnalyticsChart(canvas, { ...graph, type: select.value });
            }, { signal }));
            target.querySelectorAll(".analytics-remove").forEach((button) => button.addEventListener("click", () => {
                selectedGraphs.delete(button.dataset.removeGraph); document.getElementById("analytics-mode").value = "custom"; syncGraphChecks(); drawCards();
            }, { signal }));
        }
    };
    const renderIndicators = () => {
        const indicators = response.indicadores;
        const items = [
            ["Energia total", `${formatNumber(indicators.energia_wh, 2)} Wh`],
            ["Potência média", `${formatNumber(indicators.potencia_media)} W`],
            ["Potência máxima", `${formatNumber(indicators.potencia_maxima)} W`],
            ["Tensão média", `${formatNumber(indicators.tensao_media)} V`],
            ["Corrente média", `${formatNumber(indicators.corrente_media, 3)} A`],
            ["Medições", indicators.quantidade_medicoes],
        ];
        document.getElementById("analytics-summary").innerHTML = items.map(([label, value]) => `<article class="summary-card"><div class="summary-label">${label}</div><div class="summary-value">${value}</div></article>`).join("");
        const summaryHost = document.getElementById("analytics-device-summary-grid");
        summaryHost.innerHTML = `<div class="section-head"><div><h3>Resumo por equipamento</h3><p class="section-sub">Clique no equipamento para filtrar e atualizar as an&aacute;lises.</p></div><span class="period">${indicators.por_equipamento.length} equipamento(s)</span></div><div class="table-scroll"><table class="analytics-device-table" aria-label="Resumo por equipamento"><thead><tr><th>Equipamento</th><th>MAC</th><th>Medi&ccedil;&otilde;es</th><th>Pot&ecirc;ncia m&eacute;dia (W)</th><th>Pot&ecirc;ncia m&aacute;xima (W)</th></tr></thead><tbody>${indicators.por_equipamento.map((device) => `<tr><td><button class="analytics-device-filter" data-analytics-device-filter="${escapeHtml(device.mac)}" type="button" title="Filtrar an&aacute;lises por este equipamento">${escapeHtml(device.nome)}</button></td><td>${escapeHtml(device.mac)}</td><td>${device.quantidade}</td><td>${formatNumber(device.potencia_media)}</td><td>${formatNumber(device.potencia_maxima)}</td></tr>`).join("")}</tbody></table></div>`;
        summaryHost.querySelectorAll("[data-analytics-device-filter]").forEach((button) => button.addEventListener("click", () => {
            devicePicker.setSelected([button.dataset.analyticsDeviceFilter]);
            document.getElementById("analytics-device-picker").open = false;
            appliedFilters = readFilters();
            hasAppliedFilters = true;
            document.getElementById("analytics-view").hidden = false;
            calculate();
        }, { signal }));
    };
    const calculate = async () => {
        if (!hasAppliedFilters) return;
        const sequence = ++calculationSequence;
        if (!appliedFilters.esp_ids.length) {
            document.getElementById("analytics-notice").textContent = "Selecione ao menos um equipamento ativo.";
            document.getElementById("analytics-notice").classList.add("show");
            loading = false; drawCards();
            return;
        }
        if (!appliedFilters.start || !appliedFilters.end || !appliedFilters.startTime || !appliedFilters.endTime || appliedFilters.start > appliedFilters.end || (appliedFilters.start === appliedFilters.end && appliedFilters.startTime > appliedFilters.endTime)) {
            document.getElementById("analytics-notice").textContent = "Informe um período válido.";
            document.getElementById("analytics-notice").classList.add("show");
            loading = false; drawCards();
            return;
        }
        const notice = document.getElementById("analytics-notice"); notice.className = "notice"; notice.textContent = "";
        loading = true; drawCards();
        try {
            const result = await api("/api/analises", { method: "POST", body: JSON.stringify({
                inicio: appliedFilters.start, fim: appliedFilters.end,
                inicio_em: localTimestamp(appliedFilters.start, appliedFilters.startTime), fim_em: localTimestamp(appliedFilters.end, appliedFilters.endTime, true),
                fuso_minutos: new Date().getTimezoneOffset(), agrupamento: appliedFilters.agrupamento,
                esp_ids: appliedFilters.esp_ids, graficos: [...selectedGraphs]
            }) });
            if (sequence !== calculationSequence) return;
            response = result;
            renderIndicators();
            const warning = document.getElementById("analytics-warning");
            warning.className = result.truncado ? "notice show" : "notice";
            warning.textContent = result.truncado ? "O período retornou mais de 50.000 medições. Os cálculos usam as primeiras 50.000 em ordem cronológica; reduza o intervalo para ver todos os dados." : "";
        } catch (error) {
            if (sequence !== calculationSequence) return;
            notice.textContent = error.message || "Não foi possível calcular as análises."; notice.className = "notice show";
        } finally { if (sequence === calculationSequence) { loading = false; drawCards(); } }
    };
    const setGraphs = (ids, replace = false) => {
        if (replace) selectedGraphs.clear();
        ids.forEach((id) => selectedGraphs.add(id));
        syncGraphChecks(); drawCards();
        if (selectedGraphs.size) calculate();
    };

    container.querySelectorAll(".analytics-graph-check").forEach((input) => input.addEventListener("change", () => {
        document.getElementById("analytics-mode").value = "custom";
        if (input.checked) selectedGraphs.add(input.value); else selectedGraphs.delete(input.value);
        syncGraphChecks(); drawCards(); calculate();
    }, { signal }));
    container.querySelectorAll(".analytics-category-check").forEach((input) => {
        input.addEventListener("click", (event) => event.stopPropagation(), { signal });
        input.addEventListener("change", () => {
            document.getElementById("analytics-mode").value = "custom";
            const category = categories.find((item) => item.id === input.dataset.categoryCheck);
            category.graphs.forEach(([id]) => input.checked ? selectedGraphs.add(id) : selectedGraphs.delete(id));
            syncGraphChecks(); drawCards(); calculate();
        }, { signal });
    });
    document.getElementById("analytics-mode").addEventListener("change", (event) => {
        if (event.target.value === "custom") return;
        const preset = presets.find(([id]) => id === event.target.value);
        if (preset) setGraphs(preset[2], true);
    }, { signal });
    document.getElementById("analytics-expand").addEventListener("click", () => container.querySelectorAll(".analytics-category").forEach((node) => { node.open = true; }), { signal });
    document.getElementById("analytics-collapse").addEventListener("click", () => container.querySelectorAll(".analytics-category").forEach((node) => { node.open = false; }), { signal });
    document.getElementById("analytics-clear-selection").addEventListener("click", () => { selectedGraphs.clear(); document.getElementById("analytics-mode").value = "custom"; syncGraphChecks(); drawCards(); }, { signal });
    document.getElementById("analytics-apply").addEventListener("click", () => {
        appliedFilters = readFilters();
        selectedGraphs.forEach((id) => chartTypes.set(id, defaultChartType()));
        hasAppliedFilters = true;
        document.getElementById("analytics-view").hidden = false;
        calculate();
    }, { signal });
    document.getElementById("analytics-clear-filters").addEventListener("click", () => {
        container.querySelectorAll(".device-picker-item").forEach((input) => { input.checked = true; }); devicePicker.sync();
        document.getElementById("analytics-start").value = localDate(startDefault);
        document.getElementById("analytics-start-time").value = "00:00";
        document.getElementById("analytics-end").value = localDate(today);
        document.getElementById("analytics-end-time").value = "23:59";
        document.getElementById("analytics-group").value = "hour";
        hasAppliedFilters = false;
        appliedFilters = null;
        response = null;
        document.getElementById("analytics-view").hidden = true;
        document.getElementById("analytics-notice").className = "notice";
        document.getElementById("analytics-notice").textContent = "";
        document.getElementById("analytics-summary").innerHTML = `<div class="empty">Aplique os filtros para carregar os indicadores.</div>`;
        document.getElementById("analytics-device-summary-grid").innerHTML = "";
        drawCards();
    }, { signal });
    document.getElementById("analytics-refresh").addEventListener("click", calculate, { signal });
    document.getElementById("analytics-save-pdf").addEventListener("click", () => {
        if (!response || !appliedFilters) { window.alert("Aplique os filtros antes de salvar as análises em PDF."); return; }
        if (loading) { window.alert("Aguarde o fim do cálculo antes de salvar o PDF."); return; }
        if (!selectedGraphs.size) { window.alert("Selecione ao menos um gráfico para incluir no PDF."); return; }
        const win = window.open("", "_blank");
        if (!win) { window.alert("Permita pop-ups para gerar o PDF."); return; }
        const graphCards = [...container.querySelectorAll("#analytics-results .analytics-card")].map((source) => {
            const card = source.cloneNode(true);
            card.querySelector(".analytics-remove")?.remove();
            card.querySelector(".analytics-chart-type-control")?.remove();
            const sourceCanvases = [...source.querySelectorAll("canvas")];
            card.querySelectorAll("canvas").forEach((canvas, index) => {
                const image = document.createElement("img");
                image.className = "analytics-pdf-chart";
                image.alt = canvas.getAttribute("aria-label") || "Gráfico da análise";
                image.src = sourceCanvases[index].toDataURL("image/png");
                canvas.replaceWith(image);
            });
            return card.outerHTML;
        }).join("");
        const indicators = document.getElementById("analytics-summary").innerHTML;
        const deviceSummaryCopy = document.getElementById("analytics-device-summary-grid").cloneNode(true);
        deviceSummaryCopy.querySelectorAll(".analytics-device-filter").forEach((button) => button.replaceWith(document.createTextNode(button.textContent)));
        const deviceStats = deviceSummaryCopy.innerHTML;
        const selectedDevices = devices.filter((device) => appliedFilters.esp_ids.includes(device.esp_id));
        const devicesLabel = selectedDevices.map((device) => `${device.nome}`).join(", ");
        const groupLabel = { minute: "Minuto", hour: "Hora", day: "Dia", month: "Mês" }[appliedFilters.agrupamento] || appliedFilters.agrupamento;
        const generatedAt = new Date().toLocaleString("pt-BR");
        win.document.write(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Análises · Watt Monitor</title><style>
          *{box-sizing:border-box}@page{size:A4 landscape;margin:12mm}body{margin:24px;color:#17231c;font:12px Arial,sans-serif}h1{margin:0 0 4px;color:#176f39;font-size:24px}h2{margin:20px 0 10px;font-size:17px}.meta{margin:12px 0 18px;line-height:1.7;color:#39483e}.analytics-pdf-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.summary-card,.analytics-device-stat,.analytics-card{break-inside:avoid;border:1px solid #d5e0d8;border-radius:10px;padding:10px;background:#fff}.summary-label{color:#52645a;font-size:10px}.summary-value{margin-top:5px;font-size:17px;font-weight:bold}.analytics-device-summary{margin:8px 0}.analytics-device-summary .section-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px}.analytics-device-summary h3{margin:0;font-size:14px}.analytics-device-summary .section-sub,.analytics-device-summary .period{color:#52645a;font-size:10px}.analytics-device-table{width:100%;border-collapse:collapse;font-size:10px}.analytics-device-table th,.analytics-device-table td{padding:7px 8px;border-bottom:1px solid #d5e0d8;text-align:left}.analytics-device-filter{border:0;padding:0;background:none;color:#176f39;font-weight:bold}.analytics-device-stat span,.analytics-meta,.analytics-card-head p,.analytics-events p{color:#52645a}.analytics-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.analytics-card-wide{grid-column:auto}.analytics-card-head{display:flex;justify-content:space-between;gap:8px}.analytics-card-head h3{margin:0;font-size:14px}.analytics-card-head p{margin:4px 0;font-size:10px}.analytics-meta{display:grid;gap:3px;margin:7px 0;font-size:9px}.analytics-legend{display:flex;flex-wrap:wrap;gap:8px}.analytics-legend span{display:flex;align-items:center;gap:4px;font-size:9px}.analytics-legend i{width:8px;height:8px;border-radius:50%;background:var(--legend-color)}.analytics-pdf-chart{display:block;width:100%;height:auto;max-height:560px;object-fit:contain}.analytics-events{margin-top:8px;border-top:1px solid #d5e0d8}.analytics-events p,.analytics-events li{font-size:9px;line-height:1.45}.analytics-events ul{padding-left:18px}@media print{body{margin:12mm}.analytics-card,.summary-card,.analytics-device-stat{break-inside:avoid}.analytics-grid{gap:7px}}@media(max-width:700px){.analytics-pdf-summary,.analytics-device-summary,.analytics-grid{grid-template-columns:1fr}.analytics-card-wide{grid-column:auto}}
          </style><h1>Relatório de análises fotovoltaicas</h1><div class="meta"><b>Usuário:</b> ${escapeHtml(user?.nome || "")} (${escapeHtml(user?.email || "")})<br><b>Equipamentos:</b> ${escapeHtml(devicesLabel || "Nenhum equipamento") }<br><b>Período:</b> ${escapeHtml(displayDate(appliedFilters.start))} ${escapeHtml(appliedFilters.startTime)} a ${escapeHtml(displayDate(appliedFilters.end))} ${escapeHtml(appliedFilters.endTime)}<br><b>Agrupar por:</b> ${escapeHtml(groupLabel)}<br><b>Gráficos:</b> ${selectedGraphs.size}<br><b>Gerado em:</b> ${escapeHtml(generatedAt)}</div><h2>Indicadores</h2><div class="analytics-pdf-summary">${indicators}</div>${deviceStats ? `<h2>Resumo por equipamento</h2><div class="analytics-device-summary">${deviceStats}</div>` : ""}<h2>Gráficos selecionados</h2><div class="analytics-grid">${graphCards}</div><script>window.onload=()=>window.print()<\/script></html>`);
        win.document.close();
    }, { signal });
    document.getElementById("analytics-back-to-filters").addEventListener("click", () => document.getElementById("analytics-filters").scrollIntoView({ behavior: "smooth", block: "start" }), { signal });
    window.addEventListener("themechange", () => container.querySelectorAll(".analytics-chart").forEach((canvas) => response?.graficos[canvas.dataset.chartId] && drawAnalyticsChart(canvas, { ...response.graficos[canvas.dataset.chartId], type: chartTypes.get(canvas.dataset.chartId) || defaultChartType() })), { signal });
    window.addEventListener("resize", () => container.querySelectorAll(".analytics-chart").forEach((canvas) => response?.graficos[canvas.dataset.chartId] && drawAnalyticsChart(canvas, { ...response.graficos[canvas.dataset.chartId], type: chartTypes.get(canvas.dataset.chartId) || defaultChartType() })), { signal });
    syncGraphChecks();
}
