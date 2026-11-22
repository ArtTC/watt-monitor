import { escapeHtml } from "../api.js";

document.addEventListener("pointerdown", (event) => {
    document.querySelectorAll(".device-picker[open]").forEach((picker) => {
        if (!picker.contains(event.target)) picker.open = false;
    });
}, true);

export function renderDevicePicker({ id, devices, allLabel, emptyLabel = "Nenhum equipamento disponível." }) {
    return `<details class="device-picker" id="${escapeHtml(id)}">
      <summary id="${escapeHtml(id)}-summary">${escapeHtml(allLabel)}</summary>
      <div class="device-picker-options">
        <label><input class="device-picker-all" type="checkbox" checked><span>${escapeHtml(allLabel)}</span></label>
        ${devices.map((device) => `<label><input class="device-picker-item" type="checkbox" value="${escapeHtml(device.esp_id)}" checked><span class="device-picker-name">${escapeHtml(device.nome)}</span><small>${escapeHtml(device.esp_id)}${device.removido_em ? " · removido" : ""}</small></label>`).join("") || `<span class="muted">${escapeHtml(emptyLabel)}</span>`}
      </div>
    </details>`;
}

export function bindDevicePicker(container, id, { allLabel, signal, onChange = () => {} }) {
    const picker = container.querySelector(`#${id}`);
    const summary = container.querySelector(`#${id}-summary`);
    const master = picker.querySelector(".device-picker-all");
    const items = [...picker.querySelectorAll(".device-picker-item")];

    const selected = () => items.filter((input) => input.checked).map((input) => input.value);
    const setSelected = (values) => {
        const selectedMacs = new Set(values);
        items.forEach((input) => { input.checked = selectedMacs.has(input.value); });
        sync();
        onChange(selected());
    };
    const sync = () => {
        const checked = selected().length;
        master.checked = items.length > 0 && checked === items.length;
        master.indeterminate = checked > 0 && checked < items.length;
        summary.textContent = checked === items.length && items.length
            ? allLabel
            : checked ? `${checked} equipamento(s) selecionado(s)` : "Selecione equipamentos";
    };
    master.addEventListener("change", () => {
        items.forEach((input) => { input.checked = master.checked; });
        sync(); onChange(selected());
    }, { signal });
    items.forEach((input) => input.addEventListener("change", () => { sync(); onChange(selected()); }, { signal }));
    sync();
    return { selected, sync, setSelected };
}
