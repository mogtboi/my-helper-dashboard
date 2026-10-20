/** Device-local pins for the transit hub. Never synced. */
const KEYS = {
  gmb: "my-helper.gmb-pins.v1",
  citybus: "my-helper.citybus-pins.v1",
  parking: "my-helper.parking-pins.v1",
};

const listeners = {
  gmb: new Set(),
  citybus: new Set(),
  parking: new Set(),
};

export function loadPins(kind) {
  try {
    const raw = localStorage.getItem(KEYS[kind]);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePins(kind, pins) {
  const next = Array.isArray(pins) ? pins.slice(0, 8) : [];
  localStorage.setItem(KEYS[kind], JSON.stringify(next));
  for (const fn of listeners[kind] || []) fn(next);
  return next;
}

export function subscribePins(kind, fn) {
  listeners[kind]?.add(fn);
  return () => listeners[kind]?.delete(fn);
}
