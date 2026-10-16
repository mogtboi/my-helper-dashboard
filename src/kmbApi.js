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

/**
 * Try to attach the opposite-bound stop with the same Chinese name.
 */
export async function findOppositeDirection(route, serviceType, bound, nameTc, destTcOther) {
  const otherBound = bound === "inbound" ? "outbound" : "inbound";
  const rows = await fetchRouteStops(route, otherBound, serviceType);
  const named = await mapStopsWithNames(rows);
  const hit = named.find((s) => s.nameTc === nameTc);
  if (!hit) return null;
  return {
    label: destTcOther ? `往${destTcOther}` : otherBound === "inbound" ? "往終點" : "往起點",
    stopId: hit.stopId,
    bound: otherBound,
    serviceType: String(serviceType),
  };
}

export { BASE as KMB_BASE };
