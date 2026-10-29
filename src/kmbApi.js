const BASE = "https://data.etabus.gov.hk/v1/transport/kmb";

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let routeCatalogPromise = null;

function mapRouteRow(r) {
  return {
    route: r.route,
    bound: r.bound === "I" ? "inbound" : "outbound",
    serviceType: String(r.service_type),
    origTc: r.orig_tc,
    destTc: r.dest_tc,
    label: `${r.orig_tc} → ${r.dest_tc}`,
  };
}

/** Full KMB route list, cached in memory for live search. */
export function fetchRouteCatalog() {
  if (!routeCatalogPromise) {
    routeCatalogPromise = getJson(`${BASE}/route/`)
      .then((json) => (json.data || []).map(mapRouteRow))
      .catch((err) => {
        routeCatalogPromise = null;
        throw err;
      });
  }
  return routeCatalogPromise;
}

export async function fetchRouteVariants(route) {
  const needle = String(route).trim().toUpperCase();
  const all = await fetchRouteCatalog();
  return all.filter((r) => r.route === needle);
}

export async function fetchRouteStops(route, bound, serviceType) {
  const json = await getJson(
    `${BASE}/route-stop/${encodeURIComponent(route)}/${bound}/${serviceType}`
  );
  return json.data || [];
}

let stopListPromise = null;

function boundName(raw) {
  if (raw === "I" || raw === "inbound") return "inbound";
  if (raw === "O" || raw === "outbound") return "outbound";
  return raw || "outbound";
}

/** All KMB stops, cached in memory for search and nearby ranking. Coordinates stay in memory. */
export function fetchStopList() {
  if (!stopListPromise) {
    stopListPromise = getJson(`${BASE}/stop`)
      .then((json) =>
        (json.data || []).map((row) => {
          const lat = Number(row.lat);
          const lng = Number(row.long);
          return {
            stopId: row.stop,
            nameTc: row.name_tc || row.stop,
            nameEn: row.name_en || "",
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
          };
        })
      )
      .catch((err) => {
        stopListPromise = null;
        throw err;
      });
  }
  return stopListPromise;
}

let routesAtStopPromise = null;

/**
 * In-memory index of public route-stop rows: stop id → service-type-1 routes.
 * Used to show which routes pass a stop. Not written to localStorage.
 */
export function fetchRoutesAtStopMap() {
  if (!routesAtStopPromise) {
    routesAtStopPromise = Promise.all([getJson(`${BASE}/route-stop`), fetchRouteCatalog()])
      .then(([json, catalog]) => {
        const dest = new Map(
          catalog.map((row) => [`${row.route}|${row.bound}|${row.serviceType}`, row.destTc])
        );
        const index = new Map();
        for (const row of json.data || []) {
          const serviceType = String(row.service_type || "1");
          if (serviceType !== "1") continue;
          const bound = boundName(row.bound);
          const hit = {
            route: row.route,
            bound,
            serviceType,
            destTc: dest.get(`${row.route}|${bound}|${serviceType}`) || "",
          };
          const list = index.get(row.stop);
          if (list) list.push(hit);
          else index.set(row.stop, [hit]);
        }
        return index;
      })
      .catch((err) => {
        routesAtStopPromise = null;
        throw err;
      });
  }
  return routesAtStopPromise;
}

export async function fetchStopName(stopId) {
  const json = await getJson(`${BASE}/stop/${encodeURIComponent(stopId)}`);
  const lat = Number(json.data?.lat);
  const lng = Number(json.data?.long);
  return {
    stopId,
    nameTc: json.data?.name_tc || stopId,
    nameEn: json.data?.name_en || "",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

/** Great-circle distance in metres. Caller must keep coordinates in memory only. */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rank stops nearest to a point. Does not persist or transmit the point. */
export function rankStopsByDistance(stops, lat, lng) {
  return (stops || [])
    .map((s) => {
      const slat = Number(s.lat);
      const slng = Number(s.lng);
      if (!Number.isFinite(slat) || !Number.isFinite(slng) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { ...s, meters: Number.POSITIVE_INFINITY };
      }
      return { ...s, meters: haversineMeters(lat, lng, slat, slng) };
    })
    .sort((a, b) => a.meters - b.meters);
}

/** Parallel name lookup with a small concurrency limit. */
export async function mapStopsWithNames(stopRows, concurrency = 8) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < stopRows.length) {
      const idx = i++;
      const row = stopRows[idx];
      const detail = await fetchStopName(row.stop);
      out[idx] = {
        seq: row.seq,
        stopId: row.stop,
        nameTc: detail.nameTc,
        nameEn: detail.nameEn,
        lat: detail.lat,
        lng: detail.lng,
      };
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, stopRows.length) }, () => worker())
  );
  return out;
}

export async function fetchEta(stopId, route, serviceType) {
  const json = await getJson(
    `${BASE}/eta/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}/${encodeURIComponent(serviceType)}`
  );
  return json.data || [];
}

/** Drop the KMB stop-code suffix, e.g. "白田巴士總站 (SS900)" → "白田巴士總站". */
export function normalizeStopName(name) {
  return String(name || "")
    .replace(/\s*[（(][A-Za-z]{1,5}\d+[A-Za-z]?[）)]\s*$/u, "")
    .replace(/[\s\u3000]+/g, "")
    .trim();
}

/**
 * Opposite stop: same normalised name, else the nearest stop within 400m.
 * Live 64K / 104 opposite pairs are all inside that distance; names often
 * differ only by the parenthetical stop code, or are a different roadside name.
 */
export function pickOppositeStop(named, { nameTc, lat, lng } = {}) {
  const key = normalizeStopName(nameTc);
  const rows = (named || []).map((s) => {
    const slat = Number(s.lat);
    const slng = Number(s.lng);
    const meters =
      Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(slat) && Number.isFinite(slng)
        ? haversineMeters(lat, lng, slat, slng)
        : null;
    return { ...s, meters, key: normalizeStopName(s.nameTc) };
  });
  const exact = rows.filter((s) => key && s.key === key);
  if (exact.length) {
    exact.sort((a, b) => (a.meters ?? 1e12) - (b.meters ?? 1e12));
    return exact[0];
  }
  const near = rows
    .filter((s) => s.meters != null && s.meters <= 400)
    .sort((a, b) => a.meters - b.meters);
  return near[0] || null;
}

/**
 * Opposite-bound stop for 調轉方向.
 * `hint.stopId` / coordinates disambiguate duplicate names.
 */
export async function findOppositeDirection(route, serviceType, bound, nameTc, destTcOther, hint = {}) {
  const otherBound = bound === "inbound" ? "outbound" : "inbound";
  const types = [String(serviceType || "1")];
  if (types[0] !== "1") types.push("1");

  let named = [];
  let usedType = types[0];
  for (const st of types) {
    try {
      const rows = await fetchRouteStops(route, otherBound, st);
      if (!rows.length) continue;
      named = await mapStopsWithNames(rows);
      usedType = st;
      if (named.length) break;
    } catch {
      /* try the next service type */
    }
  }
  if (!named.length) return null;

  let lat = Number(hint.lat);
  let lng = Number(hint.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    try {
      const here = await mapStopsWithNames(await fetchRouteStops(route, bound, serviceType || "1"));
      const key = normalizeStopName(nameTc);
      const self =
        here.find((s) => hint.stopId && s.stopId === hint.stopId) ||
        here.find((s) => s.nameTc === nameTc) ||
        here.find((s) => key && normalizeStopName(s.nameTc) === key);
      if (self) {
        lat = Number(self.lat);
        lng = Number(self.lng);
      }
    } catch {
      /* name match can still succeed */
    }
  }

  const hit = pickOppositeStop(named, { nameTc, lat, lng });
  if (!hit) return null;
  return {
    label: destTcOther ? `往${destTcOther}` : otherBound === "inbound" ? "往終點" : "往起點",
    stopId: hit.stopId,
    stopName: hit.nameTc,
    bound: otherBound,
    serviceType: usedType,
  };
}

export { BASE as KMB_BASE };
