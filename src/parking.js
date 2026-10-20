import { escapeHtml } from "./escapeHtml.js";
import { loadPins, savePins, subscribePins } from "./transitStore.js";

const INFO_URL =
  "https://api.data.gov.hk/v1/carpark-info-vacancy?data=info&vehicleTypes=privateCar&lang=zh_TW";
const VAC_URL =
  "https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&vehicleTypes=privateCar&lang=zh_TW";
const REGIONS = [
  { id: "all", label: "全部" },
  { id: "hki", label: "港島" },
  { id: "kln", label: "九龍" },
  { id: "nt", label: "新界" },
];

const HK_DISTRICT = {
  中西區: "hki",
  灣仔區: "hki",
  東區: "hki",
  南區: "hki",
  油尖旺區: "kln",
  深水埗區: "kln",
  九龍城區: "kln",
  黃大仙區: "kln",
  觀塘區: "kln",
  葵青區: "nt",
  荃灣區: "nt",
  屯門區: "nt",
  元朗區: "nt",
  北區: "nt",
  大埔區: "nt",
  沙田區: "nt",
  西貢區: "nt",
  離島區: "nt",
};

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

let infoCache = null;
let parkCache = null;

/** vacancy_type A/B/C from the vacancy feed. Missing or negative vacancy is not live. */
export function vacancyStatus(item) {
  const kind = String(item?.vacancy_type || "").toUpperCase();
  const n = Number(item?.vacancy);
  const finite = Number.isFinite(n);
  if (kind === "C") return { live: false, spaces: -1, text: "⚪ 關閉", tone: "closed" };
  if (!finite || n < 0) return { live: false, spaces: null, text: "暫無數據", tone: "none" };
  if (kind === "A" && n === 0) return { live: true, spaces: 0, text: "🔴 已滿", tone: "full" };
  if (kind === "A" && n > 0) return { live: true, spaces: n, text: `🟢 剩 ${n} 位`, tone: "ok" };
  if (kind === "B" && n === 0) return { live: true, spaces: 0, text: "🔴 已滿", tone: "full" };
  if (kind === "B" && n === 1) return { live: true, spaces: 1, text: "🟢 有車位", tone: "ok" };
  return { live: false, spaces: null, text: "暫無數據", tone: "none" };
}

export function regionOfPark(item) {
  const region = String(item?.address?.region || "");
  if (region.includes("港島")) return "hki";
  if (region.includes("九龍")) return "kln";
  if (region.includes("新界")) return "nt";
  const code = region.toUpperCase();
  if (code === "HK" || code === "HKI") return "hki";
  if (code === "KLN") return "kln";
  if (code === "NT") return "nt";
  return HK_DISTRICT[String(item?.district || "")] || "";
}

function regionLabel(id) {
  return REGIONS.find((row) => row.id === id)?.label || "";
}

function vacancyOf(row) {
  const car = row?.privateCar;
  if (Array.isArray(car)) return car[0] || null;
  if (car && typeof car === "object") return car;
  return null;
}

async function loadParks(force = false) {
  if (parkCache && !force) return { ok: true, parks: parkCache, message: "" };
  if (!infoCache) {
    const infoRes = await loadJson(INFO_URL);
    if (!infoRes.ok) return { ok: false, parks: [], message: infoRes.message || "停車場資料暫無" };
    infoCache = Array.isArray(infoRes.data?.results) ? infoRes.data.results : [];
  }
  const vacRes = await loadJson(VAC_URL);
  if (!vacRes.ok) return { ok: false, parks: [], message: vacRes.message || "車位數據暫無" };
  const infoRows = infoCache;
  const vacRows = Array.isArray(vacRes.data?.results) ? vacRes.data.results : [];
  const vacById = new Map(vacRows.map((row) => [String(row.park_Id), vacancyOf(row)]));
  const rows = infoRows.map((info) => {
    const vac = vacById.get(String(info.park_Id));
    return {
      park_Id: info.park_Id,
      name: info.name || "",
      district: info.district || "",
      displayAddress: info.displayAddress || "",
      address: info.address || null,
      vacancy_type: vac?.vacancy_type || "",
      vacancy: vac?.vacancy,
    };
  });
  parkCache = rows;
  return { ok: true, parks: rows, message: "" };
}

export function createParking(root, { mode = "hub", onStatus } = {}) {
  const state = { region: "all", query: "", rows: [], error: "", loading: false, showEmpty: false };
  let pins = loadPins("parking");
  let timer = null;
  const unsub = subscribePins("parking", (next) => {
    pins = next;
    if (mode === "home") refreshHome();
    else paint();
  });

  const spaceText = (item) => vacancyStatus(item).text;

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
        const spaces = live ? spaceText(live) : "暫無數據";
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
    const pinned = new Set(pins.map((pin) => String(pin.id)));
    return state.rows
      .filter((row) => {
        const status = vacancyStatus(row);
        if (!state.showEmpty && !status.live) return false;
        if (state.region !== "all" && regionOfPark(row) !== state.region) return false;
        if (!q) return true;
        const hay = `${row.name || ""} ${row.displayAddress || ""} ${row.district || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ap = pinned.has(String(a.park_Id)) ? 0 : 1;
        const bp = pinned.has(String(b.park_Id)) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const as = vacancyStatus(a).spaces;
        const bs = vacancyStatus(b).spaces;
        return (bs ?? -2) - (as ?? -2);
      })
      .slice(0, 40);
  };

  const rowHtml = (row) => {
    const id = String(row.park_Id ?? "");
    const on = pins.some((pin) => String(pin.id) === id);
    const status = vacancyStatus(row);
    const where = [row.district, row.displayAddress].filter(Boolean).join(" · ");
    return `<article class="park-row">
      <div class="park-row-main">
        <strong class="park-name">${escapeHtml(row.name || "")}</strong>
        <span class="park-where">${escapeHtml(where)}</span>
      </div>
      <div class="park-row-side">
        <span class="park-badge is-${escapeHtml(status.tone)}">${escapeHtml(status.text)}</span>
        <button type="button" class="park-pin" data-park-pin="${escapeHtml(id)}" aria-pressed="${on ? "true" : "false"}">${on ? "★" : "☆"}</button>
      </div>
    </article>`;
  };

  const paint = () => {
    const chips = REGIONS.map(
      (row) =>
        `<button type="button" class="transit-chip" data-park-region="${row.id}" aria-pressed="${state.region === row.id ? "true" : "false"}">${row.label}</button>`
    ).join("");
    const list = filtered().map(rowHtml).join("");
    root.innerHTML = `
      <div class="transit-search">
        <div class="transit-chips" role="group" aria-label="地區">${chips}</div>
        <form class="transit-form" data-park-form>
          <input class="transit-input" data-park-q name="q" placeholder="關鍵字" value="${escapeHtml(state.query)}" autocomplete="off" />
          <button type="submit" class="tab">搜尋</button>
        </form>
        <button type="button" class="transit-chip" data-park-empty aria-pressed="${state.showEmpty ? "true" : "false"}">顯示暫無數據車場</button>
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
    box.innerHTML = filtered().map(rowHtml).join("") || `<p class="muted">冇符合嘅停車場</p>`;
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
    const emptyBtn = e.target.closest("[data-park-empty]");
    if (emptyBtn) {
      state.showEmpty = !state.showEmpty;
      paint();
      return;
    }
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
