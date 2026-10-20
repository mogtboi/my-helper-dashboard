import { escapeHtml } from "./escapeHtml.js";
import { loadPins, savePins, subscribePins } from "./transitStore.js";

const CTB = "https://rt.data.gov.hk/v2/transport/citybus";
const DIRS = [
  { id: "outbound", dir: "O", label: "去程" },
  { id: "inbound", dir: "I", label: "回程" },
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

let routeCache = null;
const stopNames = new Map();

async function loadRoutes() {
  if (routeCache) return { ok: true, routes: routeCache, message: "" };
  const res = await loadJson(`${CTB}/route/CTB`);
  if (!res.ok) return { ok: false, routes: [], message: res.message };
  routeCache = Array.isArray(res.data?.data) ? res.data.data : [];
  return { ok: true, routes: routeCache, message: "" };
}

async function stopName(stopId) {
  if (stopNames.has(stopId)) return stopNames.get(stopId);
  const res = await loadJson(`${CTB}/stop/${encodeURIComponent(stopId)}`);
  const name = res.ok ? String(res.data?.data?.name_tc || stopId) : String(stopId);
  stopNames.set(stopId, name);
  return name;
}

function etaLine(row) {
  const remark = String(row?.rmk_tc || "").trim();
  const stamp = Date.parse(row?.eta || "");
  if (!Number.isFinite(stamp)) return remark || "暫無班次";
  const mins = Math.max(0, Math.round((stamp - Date.now()) / 60000));
  return remark ? `${mins} 分鐘 · ${remark}` : `${mins} 分鐘`;
}

async function etasFor(stop, route, dir) {
  const url = `${CTB}/eta/CTB/${encodeURIComponent(stop)}/${encodeURIComponent(route)}`;
  const res = await loadJson(url);
  if (!res.ok) return { ok: false, rows: [], message: res.message };
  const rows = (Array.isArray(res.data?.data) ? res.data.data : [])
    .filter((row) => !dir || row.dir === dir)
    .filter((row) => row.eta || String(row.rmk_tc || "").trim())
    .sort((a, b) => (Date.parse(a.eta || "") || Infinity) - (Date.parse(b.eta || "") || Infinity))
    .slice(0, 3);
  return { ok: true, rows, message: "" };
}

export function createCitybus(root, { mode = "hub", onStatus } = {}) {
  const state = {
    query: "",
    matches: [],
    route: "",
    direction: "outbound",
    stops: [],
    stop: "",
    etas: [],
    error: "",
    loading: false,
  };
  let pins = loadPins("citybus");
  let homeEtas = {};
  let timer = null;
  const unsub = subscribePins("citybus", (next) => {
    pins = next;
    if (mode === "home") refreshHome();
    else paint();
  });

  const pinKey = (pin) => `${pin.stop}-${pin.route}-${pin.dir}`;

  const paintHome = () => {
    if (!pins.length) {
      root.innerHTML = `<p class="muted">未有釘選。去交通總覽搜尋城巴之後釘低。</p>`;
      return;
    }
    root.innerHTML = pins
      .map((pin) => {
        const pack = homeEtas[pinKey(pin)];
        const body = !pack
          ? `<li class="muted">載入到站…</li>`
          : pack.message
            ? `<li>${escapeHtml(pack.message)}</li>`
            : pack.rows.length
              ? pack.rows.map((row) => `<li>${escapeHtml(etaLine(row))}</li>`).join("")
              : `<li>暫時冇班次</li>`;
        return `<article class="transit-pin">
          <h3>${escapeHtml(pin.route)} → ${escapeHtml(pin.dest || "")}</h3>
          <p>${escapeHtml(pin.name || pin.stop || "")}</p>
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
        const res = await etasFor(pin.stop, pin.route, pin.dir);
        next[pinKey(pin)] = res.ok ? { rows: res.rows, message: "" } : { rows: [], message: res.message || "到站資料暫無" };
      })
    );
    homeEtas = next;
    paintHome();
    if (pins.length) onStatus?.("城巴已更新");
  };

  const paint = () => {
    const matches = state.matches
      .map(
        (row) =>
          `<button type="button" class="transit-stop" data-ctb-route="${escapeHtml(row.route)}">${escapeHtml(row.route)} ${escapeHtml(row.orig_tc || "")} → ${escapeHtml(row.dest_tc || "")}</button>`
      )
      .join("");
    const dirs = DIRS.map(
      (dir) =>
        `<button type="button" class="transit-chip" data-ctb-dir="${dir.id}" aria-pressed="${state.direction === dir.id ? "true" : "false"}">${dir.label}</button>`
    ).join("");
    const stops = state.stops
      .map((stop) => {
        const on = stop.stop === state.stop;
        return `<button type="button" class="transit-stop" data-ctb-stop="${escapeHtml(stop.stop)}" aria-pressed="${on ? "true" : "false"}">${escapeHtml(stop.seq)}. ${escapeHtml(stop.name || stop.stop)}</button>`;
      })
      .join("");
    const selected = state.stops.find((stop) => stop.stop === state.stop);
    const dirCode = DIRS.find((dir) => dir.id === state.direction)?.dir || "O";
    const pinned = selected && pins.some((pin) => pinKey(pin) === `${selected.stop}-${state.route}-${dirCode}`);
    const etaBlock = selected
      ? `<div class="transit-block">
          <p>${escapeHtml(selected.name || selected.stop)}</p>
          <ul class="transit-etas">${
            state.etas.length
              ? state.etas.map((row) => `<li>${escapeHtml(etaLine(row))}</li>`).join("")
              : `<li>暫時冇班次</li>`
          }</ul>
          <button type="button" class="transit-pin-btn" data-ctb-pin>${pinned ? "已釘選" : "釘選呢個站"}</button>
        </div>`
      : "";
    root.innerHTML = `
      <div class="transit-search">
        <form class="transit-form" data-ctb-form>
          <input class="transit-input" data-ctb-q name="q" inputmode="text" placeholder="城巴路線，例如 5B" value="${escapeHtml(state.query)}" autocomplete="off" />
          <button type="submit" class="tab">搜尋</button>
        </form>
        ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
        ${state.loading ? `<p class="muted">載入中…</p>` : ""}
        ${matches ? `<div class="transit-stops">${matches}</div>` : ""}
        ${state.route ? `<div class="transit-chips" role="group" aria-label="方向">${dirs}</div>` : ""}
        ${stops ? `<div class="transit-stops">${stops}</div>` : ""}
        ${etaBlock}
      </div>
    `;
  };

  const search = async () => {
    const q = state.query.trim().toUpperCase();
    state.error = "";
    state.matches = [];
    state.stops = [];
    state.etas = [];
    state.route = "";
    state.stop = "";
    if (!q) {
      state.error = "請輸入路線號碼";
      paint();
      return;
    }
    state.loading = true;
    paint();
    const res = await loadRoutes();
    state.loading = false;
    if (!res.ok) {
      state.error = res.message || "城巴路線暫無";
      paint();
      return;
    }
    state.matches = res.routes.filter((row) => String(row.route || "").toUpperCase().includes(q)).slice(0, 30);
    if (!state.matches.length) state.error = "冇呢條城巴線";
    paint();
  };

  const loadStops = async () => {
    state.stops = [];
    state.etas = [];
    state.stop = "";
    state.error = "";
    if (!state.route) return;
    state.loading = true;
    paint();
    const url = `${CTB}/route-stop/CTB/${encodeURIComponent(state.route)}/${state.direction}`;
    const res = await loadJson(url);
    state.loading = false;
    if (!res.ok) {
      state.error = res.message || "站名暫無";
      paint();
      return;
    }
    const rows = Array.isArray(res.data?.data) ? res.data.data : [];
    const named = [];
    for (const row of rows) {
      const name = await stopName(row.stop);
      named.push({ stop: row.stop, seq: row.seq, name });
    }
    state.stops = named;
    if (!named.length) state.error = "呢個方向冇站";
    paint();
  };

  const loadEta = async (stopId) => {
    state.stop = stopId;
    state.etas = [];
    state.error = "";
    const dir = DIRS.find((row) => row.id === state.direction)?.dir || "O";
    const res = await etasFor(stopId, state.route, dir);
    if (!res.ok) {
      state.error = res.message || "到站資料暫無";
      paint();
      return;
    }
    state.etas = res.rows;
    paint();
  };

  const togglePin = () => {
    const stop = state.stops.find((row) => row.stop === state.stop);
    const match = state.matches.find((row) => row.route === state.route) || { dest_tc: "" };
    if (!stop) return;
    const dir = DIRS.find((row) => row.id === state.direction)?.dir || "O";
    const pin = { stop: stop.stop, route: state.route, dir, name: stop.name || stop.stop, dest: match.dest_tc || "" };
    const id = pinKey(pin);
    const exists = pins.some((row) => pinKey(row) === id);
    pins = exists ? pins.filter((row) => pinKey(row) !== id) : [...pins, pin];
    savePins("citybus", pins);
    paint();
  };

  root.addEventListener("click", (e) => {
    const routeBtn = e.target.closest("[data-ctb-route]");
    if (routeBtn) {
      state.route = routeBtn.dataset.ctbRoute || "";
      state.matches = state.matches.filter((row) => row.route === state.route);
      loadStops();
      return;
    }
    const dirBtn = e.target.closest("[data-ctb-dir]");
    if (dirBtn) {
      state.direction = dirBtn.dataset.ctbDir || "outbound";
      loadStops();
      return;
    }
    const stopBtn = e.target.closest("[data-ctb-stop]");
    if (stopBtn) {
      loadEta(stopBtn.dataset.ctbStop || "");
      return;
    }
    if (e.target.closest("[data-ctb-pin]")) togglePin();
  });
  root.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-ctb-form]");
    if (!form) return;
    e.preventDefault();
    state.query = form.querySelector("[data-ctb-q]")?.value || "";
    search();
  });
  root.addEventListener("input", (e) => {
    if (e.target?.matches?.("[data-ctb-q]")) state.query = e.target.value;
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
