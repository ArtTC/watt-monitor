import { formatNumber } from "../api.js";

export function drawPowerChart(canvas, emptyElement, records) {
    const context = canvas.getContext("2d");
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
        context.strokeStyle = "#293a31";
        context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
        context.fillStyle = "#94a69a";
        context.fillText(formatNumber(value, 1), left - 8, y);
    }

    const points = values.map((value, index) => ({
        x: left + (values.length === 1 ? plotWidth / 2 : plotWidth * index / (values.length - 1)),
        y: top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight
    }));

    const gradient = context.createLinearGradient(0, top, 0, top + plotHeight);
    gradient.addColorStop(0, "rgba(141,224,167,0.26)");
    gradient.addColorStop(1, "rgba(141,224,167,0.01)");
    context.beginPath();
    context.moveTo(points[0].x, top + plotHeight);
    points.forEach((point) => context.lineTo(point.x, point.y));
    context.lineTo(points[points.length - 1].x, top + plotHeight);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.strokeStyle = "#8de0a7";
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();

    context.fillStyle = "#94a69a";
    context.textBaseline = "top";
    context.textAlign = "left";
    const firstDate = records[0]?.data_hora ? new Date(records[0].data_hora) : null;
    const lastDate = records.at(-1)?.data_hora ? new Date(records.at(-1).data_hora) : null;
    if (firstDate) context.fillText(firstDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), left, height - 18);
    context.textAlign = "right";
    if (lastDate) context.fillText(lastDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), width - right, height - 18);
}
