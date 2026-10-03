import { stationOnLine, allStationsCatalog } from "./mtrLines.js";

/** Device-local MTR station watches. Never synced across devices. */
export const MTR_STORAGE_KEY = "my-helper.mtr.v1";

/** Full catalog derived from major lines. */
export const MTR_STATION_CATALOG = allStationsCatalog();

export function catalogById(id) {
  return MTR_STATION_CATALOG.find((s) => s.id === id) || null;
}

export function defaultMtrSelection() {
  return {
    version: 1,
    stations: [
      stationOnLine("EAL", "TAP"),
      stationOnLine("EAL", "TWO"),
    ].filter(Boolean),
  };
}

function isValid(data) {
  return (
    data &&
    data.version === 1 &&
    Array.isArray(data.stations) &&
    data.stations.every(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.line === "string" &&
        typeof s.sta === "string" &&
        typeof s.nameTc === "string"
    )
  );
}

export function loadMtrSelection() {
  try {
    const raw = localStorage.getItem(MTR_STORAGE_KEY);
    if (!raw) return defaultMtrSelection();
    const parsed = JSON.parse(raw);
    if (!isValid(parsed)) return defaultMtrSelection();
    return parsed;
  } catch {
    return defaultMtrSelection();
  }
}

export function saveMtrSelection(selection) {
  if (!isValid(selection)) throw new Error("invalid mtr selection");
  localStorage.setItem(MTR_STORAGE_KEY, JSON.stringify(selection));
  return selection;
}

export function clearMtrSelection() {
  localStorage.removeItem(MTR_STORAGE_KEY);
  return defaultMtrSelection();
}
