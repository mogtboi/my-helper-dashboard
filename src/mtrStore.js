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

function isValidFavorite(f) {
  return (
    f &&
    typeof f.id === "string" &&
    typeof f.line === "string" &&
    typeof f.sta === "string" &&
    typeof f.nameTc === "string"
  );
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
    ) &&
    (data.favorites == null ||
      (Array.isArray(data.favorites) && data.favorites.every(isValidFavorite)))
  );
}

function normalize(data) {
  if (!Array.isArray(data.favorites)) data.favorites = [];
  return data;
}

export function loadMtrSelection() {
  try {
    const raw = localStorage.getItem(MTR_STORAGE_KEY);
    if (!raw) return normalize(defaultMtrSelection());
    const parsed = JSON.parse(raw);
    if (!isValid(parsed)) return normalize(defaultMtrSelection());
    return normalize(parsed);
  } catch {
    return normalize(defaultMtrSelection());
  }
}

export function saveMtrSelection(selection) {
  const next = normalize({ ...selection });
  if (!isValid(next)) throw new Error("invalid mtr selection");
  localStorage.setItem(MTR_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function toggleMtrFavorite(selection, station) {
  const next = normalize(structuredClone(selection));
  const id = station.id || `${station.line}-${station.sta}`;
  const idx = next.favorites.findIndex((f) => f.id === id);
  if (idx >= 0) next.favorites.splice(idx, 1);
  else {
    next.favorites.push({
      id,
      line: station.line,
      sta: station.sta,
      nameTc: station.nameTc,
      lineTc: station.lineTc || "",
    });
  }
  return saveMtrSelection(next);
}

export function isMtrFavorite(selection, stationLike) {
  const id = stationLike.id || `${stationLike.line}-${stationLike.sta}`;
  return (selection?.favorites || []).some((f) => f.id === id);
}

export function clearMtrSelection() {
  localStorage.removeItem(MTR_STORAGE_KEY);
  return defaultMtrSelection();
}
