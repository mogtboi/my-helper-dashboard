import { escapeHtml } from "./escapeHtml.js";
import { loadPins, savePins, subscribePins } from "./transitStore.js";

const PARK_URL = "https://api.data.gov.hk/v1/carpark-info-vacancy";
const REGIONS = [
  { id: "all", label: "全部" },
  { id: "hki", label: "港島" },
  { id: "kln", label: "九龍" },
  { id: "nt", label: "新界" },
];

const DISTRICT_REGION = [
  ["Central and Western", "hki"],
  ["Wan Chai", "hki"],
  ["Eastern", "hki"],
  ["Southern", "hki"],
  ["Yau Tsim Mong", "kln"],
  ["Sham Shui Po", "kln"],
  ["Kowloon City", "kln"],
  ["Wong Tai Sin", "kln"],
  ["Kwun Tong", "kln"],
  ["Kwai Tsing", "nt"],
  ["Tsuen Wan", "nt"],
  ["Tuen Mun", "nt"],
  ["Yuen Long", "nt"],
  ["North", "nt"],
  ["Tai Po", "nt"],
  ["Sha Tin", "nt"],
  ["Sai Kung", "nt"],
  ["Islands", "nt"],
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

let parkCache = null;

export function pcSpaces(item) {
  const raw = item?.privateCar?.space;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

export function regionOfPark(item) {
  const code = String(item?.address?.region || "").toUpperCase();
  if (code === "HK" || code === "HKI") return "hki";
  if (code === "KLN") return "kln";
  if (code === "NT") return "nt";
  const district = String(item?.district || "");
  for (const [name, id] of DISTRICT_REGION) {
    if (district.includes(name)) return id;
  }
  return "";
}

function regionLabel(id) {
  return REGIONS.find((row) => row.id === id)?.label || "";
}

async function loadParks(force = false) {
  if (parkCache && !force) return { ok: true, parks: parkCache, message: "" };
  const res = await loadJson(PARK_URL);
  if (!res.ok) return { ok: false, parks: [], message: res.message || "停車場資料暫無" };
  const rows = Array.isArray(res.data?.results) ? res.data.results : [];
  parkCache = rows;
  return { ok: true, parks: rows, message: "" };
}

export function createParking(root, { mode = "hub", onStatus } = {}) {
  const state = { region: "all", query: "", rows: [], error: "", loading: false };
  let pins = loadPins("parking");
  let timer = null;
  const unsub = subscribePins("parking", (next) => {
    pins = next;
    if (mode === "home") refreshHome();
    else paint();
  });

  const spaceText = (item) => {
    const n = pcSpaces(item);
    return n == null ? "私家車剩餘暫無" : `私家車剩餘 ${n}`;
  };

  const paintHome = (parks, message) => {
    if (!pins.length) {
      root.innerHTML = `<p class="muted">未有釘選。去交通總覽揀停車場之後釘低。</p>`;
      return;
    }
    if (message) {
      root.innerHTML = `<p class="error">${escapeHtml(message)}</p>`;
      return;
    }
    const byId = new Map((parks || []).map((row) => [String(row.park_Id), row]));
    root.innerHTML = pins
      .map((pin) => {
        const live = byId.get(String(pin.id));
        const spaces = live ? spaceText(live) : "私家車剩餘暫無";
        return `<article class="transit-pin">
          <h3>${escapeHtml(pin.name || "")}</h3>
          <p>${escapeHtml(spaces)}</p>
        </article>`;
      })
      .join("");
  };

  const refreshHome = async () => {
    if (!pins.length) {
      paintHome([], "");
      return;
    }
    paintHome([], "");
    const res = await loadParks(true);
    if (!res.ok) {
      paintHome([], res.message);
      return;
    }
    paintHome(res.parks, "");
    onStatus?.("停車場已更新");
  };

  const filtered = () => {
    const q = state.query.trim().toLowerCase();
    return state.rows
      .filter((row) => {
        if (state.region !== "all" && regionOfPark(row) !== state.region) return false;
        if (!q) return true;
        const hay = `${row.name || ""} ${row.displayAddress || ""} ${row.district || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  };

  const paint = () => {
    const chips = REGIONS.map(
      (row) =>
        `<button type="button" class="transit-chip" data-park-region="${row.id}" aria-pressed="${state.region === row.id ? "true" : "false"}">${row.label}</button>`
    ).join("");
    const list = filtered()
      .map((row) => {
        const id = String(row.park_Id ?? "");
        const on = pins.some((pin) => String(pin.id) === id);
        const where = [regionLabel(regionOfPark(row)), row.district].filter(Boolean).join(" · ");
        return `<article class="transit-pin">
          <h3>${escapeHtml(row.name || "")}</h3>
          <p>${escapeHtml(where)}</p>
          <p>${escapeHtml(spaceText(row))}</p>
          <button type="button" class="transit-pin-btn" data-park-pin="${escapeHtml(id)}">${on ? "已釘選" : "釘選"}</button>
        </article>`;
      })
      .join("");
    root.innerHTML = `
      <div class="transit-search">
        <div class="transit-chips" role="group" aria-label="地區">${chips}</div>
        <form class="transit-form" data-park-form>
          <input class="transit-input" data-park-q name="q" placeholder="關鍵字" value="${escapeHtml(state.query)}" autocomplete="off" />
          <button type="submit" class="tab">搜尋</button>
        </form>
        ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
        ${state.loading ? `<p class="muted">載入中…</p>` : ""}
        <div id="park-results">${list || (!state.loading && state.rows.length ? `<p class="muted">冇符合嘅停車場</p>` : "")}</div>
      </div>
    `;
  };

  const paintResults = () => {
    const box = root.querySelector("#park-results");
    if (!box) {
      paint();
      return;
    }
    const list = filtered()
      .map((row) => {
        const id = String(row.park_Id ?? "");
        const on = pins.some((pin) => String(pin.id) === id);
        const where = [regionLabel(regionOfPark(row)), row.district].filter(Boolean).join(" · ");
        return `<article class="transit-pin">
          <h3>${escapeHtml(row.name || "")}</h3>
          <p>${escapeHtml(where)}</p>
          <p>${escapeHtml(spaceText(row))}</p>
          <button type="button" class="transit-pin-btn" data-park-pin="${escapeHtml(id)}">${on ? "已釘選" : "釘選"}</button>
        </article>`;
      })
      .join("");
    box.innerHTML = list || `<p class="muted">冇符合嘅停車場</p>`;
  };

  const search = async () => {
    state.error = "";
    state.loading = true;
    paint();
    const res = await loadParks(false);
    state.loading = false;
    if (!res.ok) {
      state.error = res.message || "停車場資料暫無";
      state.rows = [];
      paint();
      return;
    }
    state.rows = res.parks;
    paint();
  };

  const togglePin = (id) => {
    const row = state.rows.find((item) => String(item.park_Id) === String(id));
    if (!row) return;
    const exists = pins.some((pin) => String(pin.id) === String(id));
    pins = exists
      ? pins.filter((pin) => String(pin.id) !== String(id))
      : [...pins, { id: String(row.park_Id), name: row.name || "", district: row.district || "" }];
    savePins("parking", pins);
    paint();
  };

  root.addEventListener("click", (e) => {
    const region = e.target.closest("[data-park-region]");
    if (region) {
      state.region = region.dataset.parkRegion || "all";
      if (!state.rows.length && !state.loading) search();
      else paint();
      return;
    }
    const pin = e.target.closest("[data-park-pin]");
    if (pin) togglePin(pin.dataset.parkPin || "");
  });
  root.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-park-form]");
    if (!form) return;
    e.preventDefault();
    state.query = form.querySelector("[data-park-q]")?.value || "";
    search();
  });
  root.addEventListener("input", (e) => {
    if (!e.target?.matches?.("[data-park-q]")) return;
    state.query = e.target.value;
    if (state.rows.length) paintResults();
  });

  return {
    start() {
      if (mode === "home") {
        refreshHome();
        if (!timer) timer = setInterval(refreshHome, 5 * 60 * 1000);
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
