/** Device-local bus watches. Never sent to a server. Coordinates are never stored. */
export const BUS_STORAGE_KEY = "lam-tsuen-dashboard.bus.v1";

function watch(route, bound, serviceType, stopId, stopName, destName) {
  return {
    id: `${route}::${stopId}::${bound}`,
    route,
    bound,
    serviceType,
    stopId,
    stopName,
    destName,
  };
}

/** Default 64K watches (較寮下／坑下甫，兩向). */
export function defaultBusItems() {
  return [
    watch("64K", "inbound", "1", "0B786699889F0AEB", "較寮下", "元朗"),
    watch("64K", "outbound", "1", "DC6749D20ED5C948", "較寮下", "大埔墟"),
    watch("64K", "inbound", "1", "A53F6592C4173B4E", "坑下甫", "元朗"),
    watch("64K", "outbound", "1", "BCC83D8C953DC504", "坑下甫", "大埔墟"),
  ];
}

export function defaultBusSelection() {
  const items = defaultBusItems();
  return { version: 2, items, activeId: items[0].id };
}

function destFromLabel(label) {
  return String(label || "")
    .replace(/^往\s*/, "")
    .replace(/^.*?·\s*/, "")
    .trim();
}

function isItem(it) {
  return (
    it &&
    typeof it.route === "string" &&
    typeof it.stopId === "string" &&
    typeof it.stopName === "string" &&
    typeof it.bound === "string"
  );
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!isItem(it)) continue;
    const id = it.id || `${it.route}::${it.stopId}::${it.bound || ""}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      route: String(it.route).toUpperCase(),
      bound: it.bound || "outbound",
      serviceType: String(it.serviceType || "1"),
      stopId: it.stopId,
      stopName: it.stopName,
      destName: it.destName || "",
    });
  }
  return out;
}

/** Expand legacy stop+directions and ★ bookmarks into one list. */
export function migrateBusSelection(data) {
  if (data?.version === 2 && Array.isArray(data.items)) {
    const items = dedupe(data.items);
    const activeId = items.some((i) => i.id === data.activeId) ? data.activeId : items[0]?.id || null;
    return { version: 2, items, activeId };
  }
  const items = [];
  for (const stop of data?.stops || []) {
    for (const dir of stop.directions || []) {
      if (!dir?.stopId) continue;
      items.push(
        watch(
          stop.route,
          dir.bound || "outbound",
          String(dir.serviceType || stop.serviceType || "1"),
          dir.stopId,
          stop.nameTc || dir.nameTc || dir.stopId,
          dir.destName || destFromLabel(dir.label)
        )
      );
    }
  }
  for (const fav of data?.favorites || []) {
    if (!fav?.stopId || !fav?.route) continue;
    items.push(
      watch(
        fav.route,
        fav.bound || "outbound",
        String(fav.serviceType || "1"),
        fav.stopId,
        fav.nameTc || fav.stopName || fav.stopId,
        fav.destName || destFromLabel(fav.dirLabel)
      )
    );
  }
  const cleaned = dedupe(items);
  if (!cleaned.length) return defaultBusSelection();
  return { version: 2, items: cleaned, activeId: cleaned[0].id };
}

export function loadBusSelection() {
  try {
    const raw = localStorage.getItem(BUS_STORAGE_KEY);
    if (!raw) return defaultBusSelection();
    const parsed = JSON.parse(raw);
    const next = migrateBusSelection(parsed);
    if (parsed?.version !== 2) {
      localStorage.setItem(BUS_STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    return defaultBusSelection();
  }
}

export function saveBusSelection(selection) {
  const items = dedupe(selection?.items || []);
  const activeId = items.some((i) => i.id === selection?.activeId)
    ? selection.activeId
    : items[0]?.id || null;
  const next = { version: 2, items, activeId };
  localStorage.setItem(BUS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearBusSelection() {
  const next = defaultBusSelection();
  localStorage.setItem(BUS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function watchId(item) {
  return `${String(item.route).toUpperCase()}::${item.stopId}::${item.bound || ""}`;
}

export function isPinned(selection, item) {
  const id = item.id || watchId(item);
  return (selection?.items || []).some((i) => i.id === id);
}

export function togglePinned(selection, item) {
  const next = structuredClone(selection);
  next.items = dedupe(next.items || []);
  const id = item.id || watchId(item);
  const idx = next.items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    next.items.splice(idx, 1);
    if (next.activeId === id) next.activeId = next.items[0]?.id || null;
  } else {
    next.items.push({
      id,
      route: String(item.route).toUpperCase(),
      bound: item.bound || "outbound",
      serviceType: String(item.serviceType || "1"),
      stopId: item.stopId,
      stopName: item.stopName,
      destName: item.destName || "",
    });
    next.activeId = id;
  }
  return saveBusSelection(next);
}

export function selectionRoutesLabel(selection) {
  const routes = [...new Set((selection?.items || []).map((s) => s.route))];
  return routes.join(" · ");
}

export function makeStopId(route, stopId) {
  return `${route.toUpperCase()}-${stopId}`.replace(/[^A-Za-z0-9_-]/g, "");
}
