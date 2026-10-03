/** Device-local panel order. Never synced across devices. */
export const PANEL_ORDER_KEY = "my-helper.panel-order.v1";

export const DEFAULT_PANEL_ORDER = ["clock", "weather", "bus", "mtr", "radio"];

export function loadPanelOrder() {
  try {
    const raw = localStorage.getItem(PANEL_ORDER_KEY);
    if (!raw) return [...DEFAULT_PANEL_ORDER];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_PANEL_ORDER];
    const known = new Set(DEFAULT_PANEL_ORDER);
    const cleaned = parsed.filter((id) => known.has(id));
    for (const id of DEFAULT_PANEL_ORDER) {
      if (!cleaned.includes(id)) cleaned.push(id);
    }
    return cleaned;
  } catch {
    return [...DEFAULT_PANEL_ORDER];
  }
}

export function savePanelOrder(order) {
  const known = new Set(DEFAULT_PANEL_ORDER);
  const cleaned = (order || []).filter((id) => known.has(id));
  for (const id of DEFAULT_PANEL_ORDER) {
    if (!cleaned.includes(id)) cleaned.push(id);
  }
  localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(cleaned));
  return cleaned;
}

/**
 * Pointer-based reorder (phone-friendly). Drag via handle only.
 */
export function enablePanelReorder(stackEl, { onReorder } = {}) {
  let dragging = null;
  let startY = 0;
  let offsetY = 0;
  let placeholder = null;

  const panels = () =>
    [...stackEl.children].filter((el) => el.matches?.("[data-panel-id]"));

  const applyOrder = (order) => {
    const map = new Map(panels().map((el) => [el.dataset.panelId, el]));
    for (const id of order) {
      const el = map.get(id);
      if (el) stackEl.appendChild(el);
    }
  };

  const readOrder = () => panels().map((el) => el.dataset.panelId);

  const movePlaceholder = (clientY) => {
    const others = [...stackEl.children].filter(
      (el) => el !== dragging && el !== placeholder && el.matches?.("[data-panel-id]")
    );
    let inserted = false;
    for (const el of others) {
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        stackEl.insertBefore(placeholder, el);
        inserted = true;
        break;
      }
    }
    if (!inserted) stackEl.appendChild(placeholder);
  };

  const onPointerDown = (e) => {
    const handle = e.target.closest("[data-drag-handle]");
    if (!handle || !stackEl.contains(handle)) return;
    const panel = handle.closest("[data-panel-id]");
    if (!panel) return;
    e.preventDefault();

    dragging = panel;
    const rect = panel.getBoundingClientRect();
    startY = e.clientY;
    offsetY = e.clientY - rect.top;

    placeholder = document.createElement("div");
    placeholder.className = "panel-placeholder";
    placeholder.style.height = `${rect.height}px`;
    panel.before(placeholder);

    panel.classList.add("panel-dragging");
    panel.style.width = `${rect.width}px`;
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.position = "fixed";
    panel.style.zIndex = "30";
    panel.style.margin = "0";
    panel.style.pointerEvents = "none";
    // Keep in DOM but after placeholder visually floats
    stackEl.appendChild(panel);

    handle.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !placeholder) return;
    const top = e.clientY - offsetY;
    dragging.style.top = `${top}px`;
    dragging.style.transform = "none";
    movePlaceholder(e.clientY);
  };

  const onPointerUp = () => {
    if (!dragging || !placeholder) return;
    placeholder.replaceWith(dragging);
    dragging.classList.remove("panel-dragging");
    dragging.style.cssText = "";
    dragging = null;
    placeholder = null;
    const order = readOrder();
    savePanelOrder(order);
    onReorder?.(order);
  };

  stackEl.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  return {
    applyOrder,
    readOrder,
    destroy: () => {
      stackEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    },
  };
}
