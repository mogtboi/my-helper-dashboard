/** Device-local bus selection. Never sent to a server. */
export const BUS_STORAGE_KEY = "lam-tsuen-dashboard.bus.v1";

/** Default sample watches (64K area stops). Product name is separate. */
export function defaultBusSelection() {
  return {
    version: 1,
    stops: [
      {
        id: "64k-kau-liu-ha",
        route: "64K",
        serviceType: "1",
        nameTc: "較寮下",
        nameEn: "Kau Liu Ha",
        directions: [
          {
            label: "往元朗",
            stopId: "0B786699889F0AEB",
            bound: "inbound",
          },
          {
            label: "往大埔墟",
            stopId: "DC6749D20ED5C948",
            bound: "outbound",
          },
        ],
      },
      {
        id: "64k-hang-ha-po",
        route: "64K",
        serviceType: "1",
        nameTc: "坑下甫",
        nameEn: "Hang Ha Po",
        directions: [
          {
            label: "往元朗",
            stopId: "A53F6592C4173B4E",
            bound: "inbound",
          },
          {
            label: "往大埔墟",
            stopId: "BCC83D8C953DC504",
            bound: "outbound",
          },
        ],
      },
    ],
  };
}

function isValidFavorite(f) {
  return (
    f &&
    typeof f.id === "string" &&
    typeof f.route === "string" &&
    typeof f.stopId === "string" &&
    typeof f.nameTc === "string" &&
    typeof f.dirLabel === "string"
  );
}

function isValidSelection(data) {
  return (
    data &&
    data.version === 1 &&
    Array.isArray(data.stops) &&
    data.stops.every(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.route === "string" &&
        typeof s.nameTc === "string" &&
        Array.isArray(s.directions) &&
        s.directions.length > 0 &&
        s.directions.every((d) => d && d.stopId && d.label)
    ) &&
    (data.favorites == null ||
      (Array.isArray(data.favorites) && data.favorites.every(isValidFavorite)))
  );
}

function normalizeSelection(data) {
  if (!Array.isArray(data.favorites)) data.favorites = [];
  return data;
}

/** Load from this browser only. Other phones start from defaults. */
export function loadBusSelection() {
  try {
    const raw = localStorage.getItem(BUS_STORAGE_KEY);
    if (!raw) return normalizeSelection(defaultBusSelection());
    const parsed = JSON.parse(raw);
    if (!isValidSelection(parsed)) return normalizeSelection(defaultBusSelection());
    if (parsed.stops.length === 0) return normalizeSelection(defaultBusSelection());
    return normalizeSelection(parsed);
  } catch {
    return normalizeSelection(defaultBusSelection());
  }
}

export function saveBusSelection(selection) {
  const next = normalizeSelection({ ...selection });
  if (!isValidSelection(next)) {
    throw new Error("invalid bus selection");
  }
  localStorage.setItem(BUS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Build a stable favorite id for route+stop+direction. */
export function busFavoriteId({ route, stopId, bound, dirLabel }) {
  return `${String(route).toUpperCase()}::${stopId}::${bound || dirLabel || ""}`;
}

export function toggleBusFavorite(selection, fav) {
  const next = normalizeSelection(structuredClone(selection));
  const id = fav.id || busFavoriteId(fav);
  const idx = next.favorites.findIndex((f) => f.id === id);
  if (idx >= 0) next.favorites.splice(idx, 1);
  else {
    next.favorites.push({
      id,
      route: fav.route,
      stopId: fav.stopId,
      nameTc: fav.nameTc,
      dirLabel: fav.dirLabel,
      bound: fav.bound || "",
      serviceType: fav.serviceType || "1",
      optionKey: fav.optionKey || "",
      stopEntryId: fav.stopEntryId || "",
    });
  }
  return saveBusSelection(next);
}

export function isBusFavorite(selection, favLike) {
  const id = favLike.id || busFavoriteId(favLike);
  return (selection?.favorites || []).some((f) => f.id === id);
}

export function clearBusSelection() {
  localStorage.removeItem(BUS_STORAGE_KEY);
  return defaultBusSelection();
}

export function selectionRoutesLabel(selection) {
  const routes = [...new Set((selection.stops || []).map((s) => s.route))];
  return routes.length ? routes.join(" · ") : "";
}

export function makeStopId(route, stopId) {
  return `${route.toUpperCase()}-${stopId}`.replace(/[^A-Za-z0-9_-]/g, "");
}
