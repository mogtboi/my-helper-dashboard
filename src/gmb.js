import { escapeHtml } from "./escapeHtml.js";
import { loadPins, savePins, subscribePins } from "./transitStore.js";

const GMB_BASE = "https://data.etagmb.gov.hk";
const REGIONS = [
  { id: "HKI", label: "港島" },
  { id: "KLN", label: "九龍" },
  { id: "NT", label: "新界" },
];

async function loadJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body && (body.message || body.msg)) message = String(body.message || body.msg);
      } catch {
        /* keep the status line */
      }
      return { ok: false, message, data: null };
    }
    return { ok: true, message: "", data: await res.json() };
  } catch (err) {
    return { ok: false, message: String(err?.message || "連線失敗"), data: null };
  }
}

function etaText(row) {
  const diff = Number(row?.diff);
  const remark = String(row?.remarks_tc || "").trim();
  if (Number.isFinite(diff)) return remark ? `${diff} 分鐘 · ${remark}` : `${diff} 分鐘`;
  return remark || "暫無班次";
}

export function createGmb(root, { mode = "hub", onStatus } = {}) {
  const state = {
    region: "KLN",
    query: "",
    variants: [],
    routeId: "",
    routeSeq: "",
    stops: [],
    stopSeq: "",
    etas: [],
    error: "",
    loading: false,
  };
  let pins = loadPins("gmb");
  let homeEtas = {};
  let timer = null;
  const unsub = subscribePins("gmb", (next) => {
    pins = next;
    if (mode === "home") refreshHome();
    else paint();
  });

  const pinId = (pin) => `${pin.routeId}-${pin.routeSeq}-${pin.stopSeq}`;

  const paintHome = () => {
    if (!pins.length) {
      root.innerHTML = `<p class="muted">未有釘選。去交通總覽搜尋專線小巴之後釘低。</p>`;
      return;
    }
    root.innerHTML = pins
      .map((pin) => {
        const rows = homeEtas[pinId(pin)];
        const body = Array.isArray(rows)
          ? rows.length
            ? rows.map((row) => `<li>${escapeHtml(etaText(row))}</li>`).join("")
            : `<li>暫時冇班次</li>`
          : `<li class="muted">載入到站…</li>`;
        return `<article class="transit-pin">
          <h3>${escapeHtml(pin.routeCode)} ${escapeHtml(pin.orig || "")} → ${escapeHtml(pin.dest || "")}</h3>
          <p>${escapeHtml(pin.name || "")}</p>
          <ul class="transit-etas">${body}</ul>
        </article>`;
      })
      .join("");
  };

  const refreshHome = async () => {
    paintHome();
    const next = {};
    await Promise.all(
      pins.map(async (pin) => {
        const url = `${GMB_BASE}/eta/route-stop/${encodeURIComponent(pin.routeId)}/${encodeURIComponent(pin.routeSeq)}/${encodeURIComponent(pin.stopSeq)}`;
        const res = await loadJson(url);
        if (!res.ok) {
          next[pinId(pin)] = [{ remarks_tc: res.message || "到站資料暫無" }];
          return;
        }
        const eta = res.data?.data?.eta;
        next[pinId(pin)] = Array.isArray(eta) ? eta.slice(0, 3) : [];
      })
    );
    homeEtas = next;
    paintHome();
    if (pins.length) onStatus?.("專線小巴已更新");
  };

  const paint = () => {
    const regionBtns = REGIONS.map(
      (r) =>
        `<button type="button" class="transit-chip" data-gmb-region="${r.id}" aria-pressed="${state.region === r.id ? "true" : "false"}">${r.label}</button>`
    ).join("");
    const variants = state.variants
      .map((variant) => {
        const dirs = variant.directions || [];
        const ends = dirs
          .map((dir) => `${dir.orig_tc || ""} → ${dir.dest_tc || ""}`.trim())
          .filter((text) => text !== "→");
        const heading = ends.join("／") || variant.description_tc || "";
        const buttons = dirs
          .map(
            (dir) =>
              `<button type="button" class="transit-chip" data-gmb-dir="${escapeHtml(variant.route_id)}" data-seq="${escapeHtml(dir.route_seq)}">${escapeHtml(dir.orig_tc || "")} → ${escapeHtml(dir.dest_tc || "")}</button>`
          )
          .join("");
        return `<div class="transit-block"><p>${escapeHtml(variant.route_code || "")} ${escapeHtml(heading)}</p><div class="transit-chips">${buttons}</div></div>`;
      })
      .join("");
    const stops = state.stops
      .map((stop) => {
        const on = String(stop.stop_seq) === String(state.stopSeq);
        return `<button type="button" class="transit-stop" data-gmb-stop="${escapeHtml(stop.stop_seq)}" aria-pressed="${on ? "true" : "false"}">${escapeHtml(stop.stop_seq)}. ${escapeHtml(stop.name_tc || "")}</button>`;
      })
      .join("");
    const selected = state.stops.find((stop) => String(stop.stop_seq) === String(state.stopSeq));
    const pinned = selected && pins.some((pin) => pinId(pin) === `${state.routeId}-${state.routeSeq}-${selected.stop_seq}`);
    const etaBlock = selected
      ? `<div class="transit-block">
          <p>${escapeHtml(selected.name_tc || "")}</p>
          <ul class="transit-etas">${
            state.etas.length
              ? state.etas.map((row) => `<li>${escapeHtml(etaText(row))}</li>`).join("")
              : `<li>暫時冇班次</li>`
          }</ul>
          <button type="button" class="transit-pin-btn" data-gmb-pin>${pinned ? "已釘選" : "釘選呢個站"}</button>
        </div>`
      : "";
    root.innerHTML = `
      <div class="transit-search">
        <div class="transit-chips" role="group" aria-label="地區">${regionBtns}</div>
        <form class="transit-form" data-gmb-form>
          <input class="transit-input" data-gmb-q name="q" inputmode="text" placeholder="路線號碼，例如 12" value="${escapeHtml(state.query)}" autocomplete="off" />
          <button type="submit" class="tab">搜尋</button>
        </form>
        ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
        ${state.loading ? `<p class="muted">載入中…</p>` : ""}
        ${variants}
        ${stops ? `<div class="transit-stops">${stops}</div>` : ""}
        ${etaBlock}
      </div>
    `;
  };

  const search = async () => {
    const code = state.query.trim().toUpperCase();
    state.error = "";
    state.variants = [];
    state.stops = [];
    state.etas = [];
    state.stopSeq = "";
    if (!code) {
      state.error = "請輸入路線號碼";
      paint();
      return;
    }
    state.loading = true;
    paint();
    const url = `${GMB_BASE}/route/${state.region}/${encodeURIComponent(code)}`;
    const res = await loadJson(url);
    state.loading = false;
    if (!res.ok) {
      state.error = res.message || "專線小巴路線暫無";
      paint();
      return;
    }
    const rows = Array.isArray(res.data?.data) ? res.data.data : [];
    if (!rows.length) {
      state.error = "冇呢條線";
      paint();
      return;
    }
    state.variants = rows;
    paint();
  };

  const loadStops = async (routeId, routeSeq) => {
    state.routeId = String(routeId);
    state.routeSeq = String(routeSeq);
    state.stops = [];
    state.etas = [];
    state.stopSeq = "";
    state.error = "";
    state.loading = true;
    paint();
    const url = `${GMB_BASE}/route-stop/${encodeURIComponent(routeId)}/${encodeURIComponent(routeSeq)}`;
    const res = await loadJson(url);
    state.loading = false;
    if (!res.ok) {
      state.error = res.message || "站名暫無";
      paint();
      return;
    }
    const rows = res.data?.data?.route_stops;
    state.stops = Array.isArray(rows) ? rows : [];
    if (!state.stops.length) state.error = "呢個方向冇站";
    paint();
  };

  const loadEta = async (stopSeq) => {
    state.stopSeq = String(stopSeq);
    state.etas = [];
    state.error = "";
    const url = `${GMB_BASE}/eta/route-stop/${encodeURIComponent(state.routeId)}/${encodeURIComponent(state.routeSeq)}/${encodeURIComponent(stopSeq)}`;
    const res = await loadJson(url);
    if (!res.ok) {
      state.error = res.message || "到站資料暫無";
      paint();
      return;
    }
    const eta = res.data?.data?.eta;
    state.etas = Array.isArray(eta) ? eta.slice(0, 3) : [];
    paint();
  };

  const togglePin = () => {
    const stop = state.stops.find((row) => String(row.stop_seq) === String(state.stopSeq));
    const variant = state.variants.find((row) => String(row.route_id) === String(state.routeId));
    const dir = (variant?.directions || []).find((row) => String(row.route_seq) === String(state.routeSeq));
    if (!stop || !variant) return;
    const pin = {
      routeId: state.routeId,
      routeSeq: state.routeSeq,
      stopSeq: String(stop.stop_seq),
      stopId: stop.stop_id,
      routeCode: variant.route_code || state.query,
      region: state.region,
      name: stop.name_tc || "",
      orig: dir?.orig_tc || "",
      dest: dir?.dest_tc || "",
    };
    const id = pinId(pin);
    const exists = pins.some((row) => pinId(row) === id);
    pins = exists ? pins.filter((row) => pinId(row) !== id) : [...pins, pin];
    savePins("gmb", pins);
    paint();
  };

  root.addEventListener("click", (e) => {
    const region = e.target.closest("[data-gmb-region]");
    if (region) {
      state.region = region.dataset.gmbRegion || "KLN";
      paint();
      return;
    }
    const dir = e.target.closest("[data-gmb-dir]");
    if (dir) {
      loadStops(dir.dataset.gmbDir, dir.dataset.seq);
      return;
    }
    const stop = e.target.closest("[data-gmb-stop]");
    if (stop) {
      loadEta(stop.dataset.gmbStop);
      return;
    }
    if (e.target.closest("[data-gmb-pin]")) togglePin();
  });
  root.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-gmb-form]");
    if (!form) return;
    e.preventDefault();
    state.query = form.querySelector("[data-gmb-q]")?.value || "";
    search();
  });
  root.addEventListener("input", (e) => {
    if (e.target?.matches?.("[data-gmb-q]")) state.query = e.target.value;
  });

  return {
    start() {
      if (mode === "home") {
        refreshHome();
        if (!timer) timer = setInterval(refreshHome, 60000);
        return;
      }
      paint();
    },
    refresh() {
      if (mode === "home") refreshHome();
    },
    destroy() {
      if (timer) clearInterval(timer);
      unsub();
    },
  };
}
