const BASE = "https://data.etabus.gov.hk/v1/transport/kmb";

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchRouteVariants(route) {
  const json = await getJson(`${BASE}/route/`);
  const needle = String(route).trim().toUpperCase();
  return (json.data || [])
    .filter((r) => r.route === needle)
    .map((r) => ({
      route: r.route,
      bound: r.bound === "I" ? "inbound" : "outbound",
      serviceType: String(r.service_type),
      origTc: r.orig_tc,
      destTc: r.dest_tc,
      label: `${r.orig_tc} → ${r.dest_tc}`,
    }));
}

export async function fetchRouteStops(route, bound, serviceType) {
  const json = await getJson(
    `${BASE}/route-stop/${encodeURIComponent(route)}/${bound}/${serviceType}`
  );
  return json.data || [];
}

export async function fetchStopName(stopId) {
  const json = await getJson(`${BASE}/stop/${encodeURIComponent(stopId)}`);
  return {
    stopId,
    nameTc: json.data?.name_tc || stopId,
    nameEn: json.data?.name_en || "",
  };
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
