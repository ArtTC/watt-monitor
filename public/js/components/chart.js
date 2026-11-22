import { formatNumber } from "../api.js";

const hoverStates = new WeakMap();

function formatAxisLabel(value) {
    const label = String(value);
    let match = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[3]}/${match[2]}/${match[1].slice(-2)}`;
    match = label.match(/^(\d{4})-(\d{2})$/);
    if (match) return `${match[2]}/${match[1].slice(-2)}`;
    match = label.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):\d{2}(?::\d{2})?$/);
    if (match) return `${match[3]}/${match[2]} ${match[4]}`;
    return label;
}

function formatPowerTimestamp(value) {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    return `${day}/${month} ${hour}`;
}

function setHoverTargets(canvas, targets) {
    let state = hoverStates.get(canvas);
    if (!state) {
        const wrapper = canvas.parentElement;
        wrapper.classList.add("chart-hover-wrap");
        const tooltip = document.createElement("div");
        tooltip.className = "chart-tooltip";
        tooltip.setAttribute("role", "tooltip");
        tooltip.hidden = true;
        wrapper.append(tooltip);
        state = { wrapper, tooltip, targets: [] };
        hoverStates.set(canvas, state);
        canvas.addEventListener("pointermove", (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            let closest = null;
            let closestDistance = Infinity;
            for (const target of state.targets) {
                if (target.contains) {
                    if (target.contains(x, y)) { closest = target; closestDistance = 0; break; }
                } else if (target.width != null) {
                    if (x >= target.x - 4 && x <= target.x + Math.max(6, target.width) + 4 && y >= target.y - 4 && y <= target.y + Math.max(8, target.height) + 4) {
                        const distance = Math.abs(x - (target.x + target.width / 2)) + Math.abs(y - (target.y + target.height / 2));
                        if (distance < closestDistance) { closest = target; closestDistance = distance; }
                    }
                } else {
                    const distance = Math.hypot(x - target.x, y - target.y);
                    if (distance < 12 && distance < closestDistance) { closest = target; closestDistance = distance; }
                }
            }
            if (!closest) { state.tooltip.hidden = true; return; }
            state.tooltip.textContent = closest.text;
            state.tooltip.hidden = false;
            const wrapperRect = state.wrapper.getBoundingClientRect();
            const localX = event.clientX - wrapperRect.left;
            const localY = event.clientY - wrapperRect.top;
            const halfTooltip = Math.min(state.tooltip.offsetWidth / 2, wrapperRect.width / 2);
            state.tooltip.style.left = `${Math.max(halfTooltip + 4, Math.min(wrapperRect.width - halfTooltip - 4, localX))}px`;
            state.tooltip.style.top = `${Math.max(8, localY)}px`;
        });
        canvas.addEventListener("pointerleave", () => { state.tooltip.hidden = true; });
    }
    state.targets = targets;
}

export function drawPowerChart(canvas, emptyElement, records) {
    const context = canvas.getContext("2d");
    const light = document.documentElement.dataset.theme === "light";
    const bounds = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    if (!records.length) {
        setHoverTargets(canvas, []);
        emptyElement.hidden = false;
        canvas.style.display = "none";
        return;
    }

    emptyElement.hidden = true;
    canvas.style.display = "block";
    const values = records.map((item) => Number(item.potencia) || 0);
    const max = Math.max(1, ...values) * 1.18;
    const min = Math.min(0, ...values);
    const left = 43, right = 10, top = 12, bottom = 28;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    context.font = "10px system-ui";
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let index = 0; index <= 3; index++) {
        const y = top + plotHeight * index / 3;
        const value = max - (max - min) * index / 3;
        context.strokeStyle = light ? "#d7e1da" : "#3c392e";
        context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
        context.fillStyle = light ? "#53645a" : "#94a69a";
        context.fillText(formatNumber(value, 1), left - 8, y);
    }

    const points = values.map((value, index) => ({
        x: left + (values.length === 1 ? plotWidth / 2 : plotWidth * index / (values.length - 1)),
        y: top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight
    }));
    setHoverTargets(canvas, points.map((point, index) => ({
        ...point,
        text: `${formatPowerTimestamp(records[index].data_hora)} · ${formatNumber(values[index])} W`
    })));

    const gradient = context.createLinearGradient(0, top, 0, top + plotHeight);
    gradient.addColorStop(0, light ? "rgba(154,109,0,0.22)" : "rgba(244,197,66,0.26)");
    gradient.addColorStop(1, light ? "rgba(154,109,0,0.01)" : "rgba(244,197,66,0.01)");
    context.beginPath();
    context.moveTo(points[0].x, top + plotHeight);
    points.forEach((point) => context.lineTo(point.x, point.y));
    context.lineTo(points[points.length - 1].x, top + plotHeight);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.strokeStyle = light ? "#8a6500" : "#f4c542";
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();

    context.fillStyle = light ? "#53645a" : "#94a69a";
    context.textBaseline = "top";
    context.textAlign = "left";
    const firstDate = records[0]?.data_hora ? new Date(records[0].data_hora) : null;
    const lastDate = records.at(-1)?.data_hora ? new Date(records.at(-1).data_hora) : null;
    if (firstDate) context.fillText(firstDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), left, height - 18);
    context.textAlign = "right";
    if (lastDate) context.fillText(lastDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), width - right, height - 18);
}

export function drawAnalyticsChart(canvas, graph) {
    const context = canvas.getContext("2d");
    const bounds = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, bounds.width);
    const height = Math.max(200, bounds.height || 260);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const labels = graph.labels || [];
    const series = graph.series || [];
    const palette = document.documentElement.dataset.theme === "light"
        ? ["#8a6500", "#2367a8", "#ad5a17", "#8141a5", "#b23242", "#00838f"]
        : ["#f4c542", "#74b7ff", "#ffc477", "#c794ee", "#ff8994", "#5dd5dc"];
    const isNumeric = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
    const values = series.flatMap((item) => item.data || []).filter(isNumeric).map(Number);
    context.font = "10px system-ui";
    context.fillStyle = document.documentElement.dataset.theme === "light" ? "#53645a" : "#94a69a";
    if (!labels.length || !values.length) {
        setHoverTargets(canvas, []);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("Sem dados suficientes para este gráfico", width / 2, height / 2);
        return;
    }
    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(1e-9, ...values);
    const colors = palette;

    if (graph.type === "pie" || graph.type === "doughnut") {
        const slices = labels.map((label, index) => ({
            label,
            value: series.reduce((sum, item) => sum + (isNumeric(item.data[index]) ? Math.max(0, Number(item.data[index])) : 0), 0)
        })).filter((slice) => slice.value > 0);
        const total = slices.reduce((sum, slice) => sum + slice.value, 0);
        if (!total) {
            setHoverTargets(canvas, []);
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("Sem valores positivos para este grÃ¡fico", width / 2, height / 2);
            return;
        }
        const radius = Math.max(24, Math.min(height * 0.39, width * 0.27));
        const centerX = Math.max(radius + 8, Math.min(width * 0.32, width - radius - 110));
        const centerY = height * 0.48;
        const innerRadius = graph.type === "doughnut" ? radius * 0.56 : 0;
        const hoverTargets = [];
        let angle = -Math.PI / 2;
        slices.forEach((slice, index) => {
            const startAngle = angle;
            const endAngle = angle + Math.PI * 2 * slice.value / total;
            context.beginPath();
            context.moveTo(centerX, centerY);
            context.arc(centerX, centerY, radius, startAngle, endAngle);
            context.closePath();
            context.fillStyle = colors[index % colors.length];
            context.fill();
            if (innerRadius) {
                context.beginPath();
                context.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
                context.fillStyle = document.documentElement.dataset.theme === "light" ? "#ffffff" : "#1b1913";
                context.fill();
            }
            const normalizedStart = (startAngle + Math.PI * 2) % (Math.PI * 2);
            const normalizedEnd = (endAngle + Math.PI * 2) % (Math.PI * 2);
            hoverTargets.push({
                contains(x, y) {
                    const dx = x - centerX, dy = y - centerY;
                    const distance = Math.hypot(dx, dy);
                    if (distance > radius || distance < innerRadius) return false;
                    if (slice.value >= total) return true;
                    const pointerAngle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
                    return normalizedStart <= normalizedEnd
                        ? pointerAngle >= normalizedStart && pointerAngle <= normalizedEnd
                        : pointerAngle >= normalizedStart || pointerAngle <= normalizedEnd;
                },
                text: `${formatAxisLabel(slice.label)} Â· ${formatNumber(slice.value)} ${graph.unidade || ""} (${formatNumber(slice.value / total * 100, 1)}%)`.trim()
            });
            angle = endAngle;
        });
        const legendX = centerX + radius + 16;
        const legendWidth = Math.max(30, width - legendX - 6);
        const maxLegendRows = Math.max(1, Math.floor((height - 16) / 20));
        context.textBaseline = "middle";
        slices.slice(0, maxLegendRows).forEach((slice, index) => {
            const y = 14 + index * 20;
            context.fillStyle = colors[index % colors.length];
            context.fillRect(legendX, y - 4, 8, 8);
            context.fillStyle = document.documentElement.dataset.theme === "light" ? "#53645a" : "#94a69a";
            const label = `${formatAxisLabel(slice.label)} · ${formatNumber(slice.value)}`;
            context.textAlign = "left";
            context.fillText(label, legendX + 13, y, Math.max(20, legendWidth - 13));
        });
        if (slices.length > maxLegendRows) {
            context.textAlign = "left";
            context.fillText(`+ ${slices.length - maxLegendRows} mais`, legendX + 13, 14 + maxLegendRows * 20, legendWidth - 13);
        }
        setHoverTargets(canvas, hoverTargets);
        return;
    }

    if (graph.type === "hbar") {
        const hoverTargets = [];
        const left = Math.min(160, Math.max(95, width * 0.32));
        const right = 16, top = 12, bottom = 12;
        const plotWidth = Math.max(1, width - left - right);
        const rowHeight = Math.max(22, (height - top - bottom) / labels.length);
        const allMax = Math.max(1e-9, ...values);
        for (let index = 0; index <= 4; index++) {
            const x = left + plotWidth * index / 4;
            context.strokeStyle = document.documentElement.dataset.theme === "light" ? "#d7e1da" : "#3c392e";
            context.beginPath(); context.moveTo(x, top); context.lineTo(x, height - bottom); context.stroke();
            context.textAlign = "center"; context.textBaseline = "top";
            context.fillText(formatNumber(allMax * index / 4, 1), x, height - 10);
        }
        labels.forEach((label, index) => {
            const y = top + rowHeight * index;
            context.fillStyle = document.documentElement.dataset.theme === "light" ? "#53645a" : "#94a69a";
            context.textAlign = "right"; context.textBaseline = "middle";
            context.fillText(label, left - 8, y + rowHeight / 2, left - 14);
            series.forEach((item, seriesIndex) => {
                const raw = item.data[index];
                if (!isNumeric(raw)) return;
                const value = Number(raw);
                const h = Math.max(2, Math.min(15, rowHeight / Math.max(1, series.length) - 2));
                const offset = (seriesIndex - (series.length - 1) / 2) * (h + 2);
                const barWidth = Math.max(0, plotWidth * value / allMax);
                context.fillStyle = colors[seriesIndex % colors.length];
                const barY = y + rowHeight / 2 + offset - h / 2;
                context.fillRect(left, barY, barWidth, h);
                hoverTargets.push({ x: left, y: barY, width: barWidth, height: h, text: `${formatAxisLabel(label)} · ${formatNumber(value)} ${graph.unidade || ""}`.trim() });
            });
        });
        setHoverTargets(canvas, hoverTargets);
        return;
    }

    const left = 48, right = 12, top = 20, bottom = 42;
    const plotWidth = Math.max(1, width - left - right);
    const plotHeight = Math.max(1, height - top - bottom);
    const max = maxValue * 1.12;
    const min = graph.type === "bar" ? Math.min(0, minValue) : minValue;
    for (let index = 0; index <= 4; index++) {
        const y = top + plotHeight * index / 4;
        const value = max - (max - min) * index / 4;
        context.strokeStyle = document.documentElement.dataset.theme === "light" ? "#d7e1da" : "#3c392e";
        context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
        context.fillStyle = document.documentElement.dataset.theme === "light" ? "#53645a" : "#94a69a";
        context.textAlign = "right"; context.textBaseline = "middle";
        context.fillText(formatNumber(value, 1), left - 7, y);
    }
    const pointX = (index) => left + (labels.length === 1 ? plotWidth / 2 : plotWidth * index / (labels.length - 1));
    const hoverTargets = [];
    if (graph.type === "bar") {
        const groupWidth = plotWidth / labels.length;
        const barWidth = Math.max(1, Math.min(28, groupWidth * 0.78 / Math.max(1, series.length)));
        series.forEach((item, seriesIndex) => item.data.forEach((raw, index) => {
            if (!isNumeric(raw)) return;
            const value = Number(raw);
            const y = top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight;
            const x = left + groupWidth * index + groupWidth / 2 + (seriesIndex - (series.length - 1) / 2) * barWidth - barWidth / 2;
            context.fillStyle = colors[seriesIndex % colors.length];
            const baseline = top + plotHeight;
            const barY = Math.min(y, baseline);
            const barHeight = Math.max(2, Math.abs(baseline - y));
            context.fillRect(x, barY, barWidth, barHeight);
            hoverTargets.push({ x, y: barY, width: barWidth, height: barHeight, text: `${formatAxisLabel(labels[index])} · ${formatNumber(value)} ${graph.unidade || ""}`.trim() });
        }));
    } else {
        series.forEach((item, seriesIndex) => {
            context.beginPath();
            let drawing = false;
            item.data.forEach((raw, index) => {
                if (!isNumeric(raw)) { drawing = false; return; }
                const value = Number(raw);
                const point = { x: pointX(index), y: top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight };
                hoverTargets.push({ ...point, text: `${formatAxisLabel(labels[index])} · ${formatNumber(value)} ${graph.unidade || ""}`.trim() });
                if (!drawing) { context.moveTo(point.x, point.y); drawing = true; }
                else context.lineTo(point.x, point.y);
            });
            context.strokeStyle = colors[seriesIndex % colors.length];
            context.lineWidth = 2;
            context.stroke();
            context.fillStyle = colors[seriesIndex % colors.length];
            const markerRadius = labels.length < 25 ? 3.5 : labels.length < 120 ? 2.5 : 1.75;
            item.data.forEach((raw, index) => {
                if (!isNumeric(raw)) return;
                const value = Number(raw);
                const point = { x: pointX(index), y: top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight };
                const singleLabelOffset = labels.length === 1 && series.length > 1 ? (seriesIndex - (series.length - 1) / 2) * 7 : 0;
                context.beginPath();
                context.arc(point.x + singleLabelOffset, point.y, markerRadius, 0, Math.PI * 2);
                context.fill();
            });
        });
    }
    const stride = Math.max(1, Math.ceil(labels.length / 8));
    context.fillStyle = document.documentElement.dataset.theme === "light" ? "#53645a" : "#94a69a";
    context.textBaseline = "top";
    context.textAlign = "center";
    labels.forEach((label, index) => {
        if (index % stride !== 0 && index !== labels.length - 1) return;
        const compactLabel = formatAxisLabel(label);
        const shown = compactLabel.length > 15 ? `${compactLabel.slice(0, 13)}…` : compactLabel;
        context.fillText(shown, pointX(index), height - bottom + 8, Math.max(30, plotWidth / 7));
    });
    setHoverTargets(canvas, hoverTargets);
}
