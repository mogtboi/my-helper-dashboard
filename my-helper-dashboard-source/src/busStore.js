/** Device-local bus selection. Never sent to a server. */
export const BUS_STORAGE_KEY = "lam-tsuen-dashboard.bus.v1";

/** Default Lam Tsuen / 64K watches (also used when storage empty or cleared). */
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
    )
  );
}

/** Load from this browser only. Other phones start from defaults. */
export function loadBusSelection() {
  try {
    const raw = localStorage.getItem(BUS_STORAGE_KEY);
    if (!raw) return defaultBusSelection();
    const parsed = JSON.parse(raw);
    if (!isValidSelection(parsed)) return defaultBusSelection();
    if (parsed.stops.length === 0) return defaultBusSelection();
    return parsed;
  } catch {
    return defaultBusSelection();
  }
}

export function saveBusSelection(selection) {
  if (!isValidSelection(selection)) {
    throw new Error("invalid bus selection");
  }
  localStorage.setItem(BUS_STORAGE_KEY, JSON.stringify(selection));
  return selection;
}

export function clearBusSelection() {
  localStorage.removeItem(BUS_STORAGE_KEY);
  return defaultBusSelection();
}

export function selectionRoutesLabel(selection) {
  const routes = [...new Set((selection.stops || []).map((s) => s.route))];
  return routes.length ? routes.join(" · ") : "巴士";
}

export function makeStopId(route, stopId) {
  return `${route.toUpperCase()}-${stopId}`.replace(/[^A-Za-z0-9_-]/g, "");
}
