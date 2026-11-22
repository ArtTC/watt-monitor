import { formatNumber } from "../api.js";

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
        context.strokeStyle = light ? "#d7e1da" : "#293a31";
        context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
        context.fillStyle = light ? "#53645a" : "#94a69a";
        context.fillText(formatNumber(value, 1), left - 8, y);
    }

    const points = values.map((value, index) => ({
        x: left + (values.length === 1 ? plotWidth / 2 : plotWidth * index / (values.length - 1)),
        y: top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight
    }));

    const gradient = context.createLinearGradient(0, top, 0, top + plotHeight);
    gradient.addColorStop(0, light ? "rgba(35,125,69,0.22)" : "rgba(141,224,167,0.26)");
    gradient.addColorStop(1, light ? "rgba(35,125,69,0.01)" : "rgba(141,224,167,0.01)");
    context.beginPath();
    context.moveTo(points[0].x, top + plotHeight);
    points.forEach((point) => context.lineTo(point.x, point.y));
    context.lineTo(points[points.length - 1].x, top + plotHeight);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.strokeStyle = light ? "#237d45" : "#8de0a7";
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
        ? ["#237d45", "#2367a8", "#ad5a17", "#8141a5", "#b23242", "#00838f"]
        : ["#8de0a7", "#74b7ff", "#ffc477", "#c794ee", "#ff8994", "#5dd5dc"];
    const isNumeric = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
    const values = series.flatMap((item) => item.data || []).filter(isNumeric).map(Number);
    context.font = "10px system-ui";
    context.fillStyle = document.documentElement.dataset.theme === "light" ? "#53645a" : "#94a69a";
    if (!labels.length || !values.length) {
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("Sem dados suficientes para este gráfico", width / 2, height / 2);
        return;
    }
    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(1e-9, ...values);
    const colors = palette;

    if (graph.type === "hbar") {
        const left = Math.min(160, Math.max(95, width * 0.32));
        const right = 16, top = 12, bottom = 12;
        const plotWidth = Math.max(1, width - left - right);
        const rowHeight = Math.max(22, (height - top - bottom) / labels.length);
        const allMax = Math.max(1e-9, ...values);
        for (let index = 0; index <= 4; index++) {
            const x = left + plotWidth * index / 4;
            context.strokeStyle = document.documentElement.dataset.theme === "light" ? "#d7e1da" : "#293a31";
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
                context.fillRect(left, y + rowHeight / 2 + offset - h / 2, barWidth, h);
            });
        });
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
        context.strokeStyle = document.documentElement.dataset.theme === "light" ? "#d7e1da" : "#293a31";
        context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
        context.fillStyle = document.documentElement.dataset.theme === "light" ? "#53645a" : "#94a69a";
        context.textAlign = "right"; context.textBaseline = "middle";
        context.fillText(formatNumber(value, 1), left - 7, y);
    }
    const pointX = (index) => left + (labels.length === 1 ? plotWidth / 2 : plotWidth * index / (labels.length - 1));
    if (graph.type === "bar") {
        const groupWidth = plotWidth / labels.length;
        const barWidth = Math.max(1, Math.min(28, groupWidth * 0.78 / Math.max(1, series.length)));
        series.forEach((item, seriesIndex) => item.data.forEach((raw, index) => {
            if (!isNumeric(raw)) return;
            const value = Number(raw);
            const y = top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight;
            const x = left + groupWidth * index + groupWidth / 2 + (seriesIndex - (series.length - 1) / 2) * barWidth - barWidth / 2;
            context.fillStyle = colors[seriesIndex % colors.length];
            context.fillRect(x, y, barWidth, top + plotHeight - y);
        }));
    } else {
        series.forEach((item, seriesIndex) => {
            context.beginPath();
            let drawing = false;
            item.data.forEach((raw, index) => {
                if (!isNumeric(raw)) { drawing = false; return; }
                const value = Number(raw);
                const point = { x: pointX(index), y: top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight };
                if (!drawing) { context.moveTo(point.x, point.y); drawing = true; }
                else context.lineTo(point.x, point.y);
            });
            context.strokeStyle = colors[seriesIndex % colors.length];
            context.lineWidth = 2;
            context.stroke();
        });
    }
    const stride = Math.max(1, Math.ceil(labels.length / 8));
    context.fillStyle = document.documentElement.dataset.theme === "light" ? "#53645a" : "#94a69a";
    context.textBaseline = "top";
    context.textAlign = "center";
    labels.forEach((label, index) => {
        if (index % stride !== 0 && index !== labels.length - 1) return;
        const shown = String(label).length > 15 ? `${String(label).slice(0, 13)}…` : String(label);
        context.fillText(shown, pointX(index), height - bottom + 8, Math.max(30, plotWidth / 7));
    });
}
