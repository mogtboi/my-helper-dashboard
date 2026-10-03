/** Device-local panel order. Never synced across devices. */
export const PANEL_ORDER_KEY = "my-helper.panel-order.v1";

export const DEFAULT_PANEL_ORDER = [
  "clock",
  "weather",
  "holiday",
  "bus",
  "mtr",
  "radio",
];

/** Viewport edge zone (px) that triggers auto-scroll while dragging. */
const EDGE_ZONE = 72;
/** Max scroll speed (px per frame ~60fps). */
const MAX_SCROLL_SPEED = 28;

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
 * Near top/bottom of viewport, auto-scrolls the page during drag.
 */
export function enablePanelReorder(stackEl, { onReorder } = {}) {
  let dragging = null;
  let offsetY = 0;
  let placeholder = null;
  let lastClientY = 0;
  let scrollRaf = 0;

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

  const positionDragging = (clientY) => {
    if (!dragging) return;
    const top = clientY - offsetY;
    dragging.style.top = `${top}px`;
    dragging.style.transform = "none";
    movePlaceholder(clientY);
  };

  const edgeScrollSpeed = (clientY) => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (clientY < EDGE_ZONE) {
      const t = 1 - clientY / EDGE_ZONE;
      return -Math.ceil(MAX_SCROLL_SPEED * Math.min(1, Math.max(0, t)));
    }
    if (clientY > vh - EDGE_ZONE) {
      const t = 1 - (vh - clientY) / EDGE_ZONE;
      return Math.ceil(MAX_SCROLL_SPEED * Math.min(1, Math.max(0, t)));
    }
    return 0;
  };

  const stopAutoScroll = () => {
    if (scrollRaf) {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = 0;
    }
  };

  const tickAutoScroll = () => {
    scrollRaf = 0;
    if (!dragging) return;
    const speed = edgeScrollSpeed(lastClientY);
    if (speed !== 0) {
      const before = window.scrollY || window.pageYOffset || 0;
      window.scrollBy(0, speed);
      const after = window.scrollY || window.pageYOffset || 0;
      // Keep floating card under finger while page scrolls
      if (after !== before) {
        positionDragging(lastClientY);
      }
    }
    if (dragging) {
      scrollRaf = requestAnimationFrame(tickAutoScroll);
    }
  };

  const startAutoScroll = () => {
    if (!scrollRaf) {
      scrollRaf = requestAnimationFrame(tickAutoScroll);
    }
  };

  const onPointerDown = (e) => {
    const handle = e.target.closest("[data-drag-handle]");
    if (!handle || !stackEl.contains(handle)) return;
    const panel = handle.closest("[data-panel-id]");
    if (!panel) return;
    e.preventDefault();

    dragging = panel;
    const rect = panel.getBoundingClientRect();
    offsetY = e.clientY - rect.top;
    lastClientY = e.clientY;

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
    stackEl.appendChild(panel);

    handle.setPointerCapture?.(e.pointerId);
    startAutoScroll();
  };

  const onPointerMove = (e) => {
    if (!dragging || !placeholder) return;
    lastClientY = e.clientY;
    positionDragging(e.clientY);
    startAutoScroll();
  };

  const onPointerUp = () => {
    if (!dragging || !placeholder) return;
    stopAutoScroll();
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
      stopAutoScroll();
      stackEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    },
  };
}
