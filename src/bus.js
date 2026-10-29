import {
  fetchEta,
  fetchRouteVariants,
  fetchRouteCatalog,
  fetchRouteStops,
  fetchStopList,
  fetchRoutesAtStopMap,
  mapStopsWithNames,
  findOppositeDirection,
  rankStopsByDistance,
  KMB_BASE,
} from "./kmbApi.js";
import {
  saveBusSelection,
  clearBusSelection,
  togglePinned,
  isPinned,
  watchId,
} from "./busStore.js";
import { escapeHtml } from "./escapeHtml.js";
import { freshnessLabel, makeRefreshController } from "./transitUi.js";

function minsUntil(etaIso, now = Date.now()) {
  if (!etaIso) return null;
  const diff = new Date(etaIso).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return 0;
  return Math.round(diff / 60000);
}

function etaDir(bound) {
  if (bound === "I" || bound === "inbound") return "I";
  if (bound === "O" || bound === "outbound") return "O";
  return "";
}

async function loadEtaRows(stopId, route, serviceType, bound) {
  const rows = await fetchEta(stopId, route, serviceType);
  const now = Date.now();
  const dir = etaDir(bound);
  const scoped = rows.filter((r) => !dir || !r.dir || r.dir === dir);
  const withEta = scoped
    .filter((r) => {
      if (r.eta == null || String(r.eta).trim() === "") return false;
      const etaMs = Date.parse(r.eta);
      return Number.isFinite(etaMs) && etaMs >= now - 30000;
    })
    .sort((a, b) => Date.parse(a.eta) - Date.parse(b.eta));
  const items = withEta
    .slice(0, 3)
    .map((r) => ({
      dest: r.dest_tc,
      mins: minsUntil(r.eta, now),
      rmk: r.rmk_tc,
    }));
  if (items.length) return { items, reason: "" };
  const remarks = [
    ...new Set(
      scoped
        .filter((r) => (r.eta == null || String(r.eta).trim() === "") && String(r.rmk_tc || "").trim())
        .map((r) => String(r.rmk_tc).trim())
    ),
  ];
  return { items: [], reason: remarks.join("；") };
}

function shortStopName(name) {
  const bare = String(name || "")
    .replace(/\s*[（(][A-Za-z]{1,5}\d+[A-Za-z]?[）)]\s*$/u, "")
    .trim();
  return bare.length > 8 ? `${bare.slice(0, 8)}…` : bare;
}

function chipLabel(it) {
  const dest = String(it?.destName || "").replace(/^往\s*/, "");
  const dir = dest ? `往${dest}` : it?.bound === "inbound" ? "回程" : "去程";
  const stop = shortStopName(it?.stopName);
  return `${it?.route || ""} ${dir}${stop ? ` · ${stop}` : ""}`.trim();
}

function formatMeters(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 1000) return `📍 距離約 ${Math.round(m)}m`;
  return `📍 距離約 ${(m / 1000).toFixed(1)}km`;
}

const RECENT_KEY = "my-helper.bus.recent-search.v1";

function etaFace(mins) {
  if (mins == null) return { num: "—", unit: "", soon: false };
  if (mins <= 1) return { num: "即將到達", unit: "", soon: true };
  return { num: String(mins), unit: "分", soon: mins <= 2 };
}

function etaWhen(mins) {
  const face = etaFace(mins);
  return face.unit ? `${face.num}${face.unit}` : face.num;
}

function loadRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5);
  } catch {
    return [];
  }
}

function rememberSearch(query) {
  const text = String(query || "").trim();
  if (!text) return loadRecent();
  const next = [text, ...loadRecent().filter((item) => item !== text)].slice(0, 5);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

function uniqueRouteRows(rows, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const key = `${row.route}|${row.bound}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function locateHint(code) {
  if (code === 1) return "定位未允許。請喺瀏覽器網址列嘅鎖或網站設定允許定位，然後再撳「再試」。";
  if (code === 3) return "定位逾時。如果個提示仲未選擇，請先允許；否則再試一次。";
  if (code === "unsupported") return "呢部機冇定位。可以改用搜尋路線或站名。";
  return "定位失敗。請檢查系統定位服務已開，然後再試。";
}

/**
 * KMB card: one saved row per pin, a detail stop sequence, nearby list, and search.
 * Pins stay in localStorage. Coordinates and the route-stop index stay in memory.
 */
export function createBus(root, titleEl, { onStatus, onSelectionPersist, actionsEl, onDigest } = {}) {
  let selection = null;
  /** Viewed stop; may be unsaved until ★. */
  let current = null;
  let lastFetchAt = 0;
  let refreshSeq = 0;
  let reverseLock = false;
  let timer = null;
  let freshTimer = null;
  let bound = false;
  let view = "board";
  let backView = "board";
  let searchDraft = "";
  let searchVariant = null;
  let soonest = null;
  let pinSeq = 0;
  let locatePending = false;
  let locateToken = 0;
  let sequence = [];
  let sequenceKey = "";
  let nearStops = [];
  let nearNote = "";
  let lastPoint = null;
  let recent = loadRecent();
  const etaCache = new Map();

  const persist = (next) => {
    selection = next;
    onSelectionPersist?.(next);
  };

  const actionHost = () => actionsEl || root;

  const updateFresh = () => {
    const el = actionHost().querySelector("#bus-fresh");
    if (el) el.textContent = freshnessLabel(lastFetchAt);
  };

  const updateStar = () => {
    const btn = actionHost().querySelector("#bus-star-btn");
    if (!btn || !current) return;
    const on = isPinned(selection, current);
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("is-pinned", on);
    btn.textContent = on ? "★" : "☆";
    btn.title = on ? "取消釘選" : "釘選到常用";
  };

  const paintActions = () => {
    const host = actionsEl || document.querySelector("#bus-actions");
    if (!host) return;
    host.innerHTML = `
      <span class="transit-fresh-label" id="bus-fresh">—</span>
      <button type="button" class="transit-refresh-btn" id="bus-refresh" aria-label="重新整理">
        <svg class="transit-refresh-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6c-2.62 0-4.83-1.69-5.65-4H4.26C5.13 16.98 8.28 20 12 20c4.42 0 8-3.58 8-8s-3.58-8-8-8z"/>
        </svg>
      </button>
      <button type="button" class="icon-btn reverse-btn" id="bus-reverse-btn" aria-label="調轉方向">⇄</button>
      <button type="button" class="icon-btn star-btn" id="bus-star-btn" aria-pressed="false" aria-label="釘選">☆</button>
    `;
    makeRefreshController({
      button: host.querySelector("#bus-refresh"),
      onRefresh: () => refresh(),
    });
    updateStar();
    updateFresh();
  };

  const rowEtaHtml = (it) => {
    const eta = etaCache.get(it.id);
    const first = eta?.items?.[0];
    const face = etaFace(first?.mins);
    const rest = (eta?.items || []).slice(1, 3).map((row) => etaWhen(row.mins));
    const next = rest.length ? `<span class="bus-row-next">次班 ${rest.map((t) => escapeHtml(t)).join(" · ")}</span>` : "";
    const empty = eta && !first ? `<span class="bus-row-next">${escapeHtml(eta.reason || "暫時冇班次")}</span>` : "";
    return `<span class="bus-row-eta"><span class="eta-focus${face.soon ? " is-urgent" : ""}"><span class="eta-focus-num">${escapeHtml(face.num)}</span>${face.unit ? `<span class="eta-focus-unit">${escapeHtml(face.unit)}</span>` : ""}</span>${next}${empty}</span>`;
  };

  const paintBoardRows = () => {
    const row = root.querySelector("#bus-board");
    if (!row) return;
    const items = selection?.items || [];
    row.innerHTML = items.length
      ? items
          .map(
            (it) => `<button type="button" class="bus-row" data-watch="${escapeHtml(it.id)}">
              <span class="bus-row-label">${escapeHtml(chipLabel(it))}</span>
              ${rowEtaHtml(it)}
            </button>`
          )
          .join("")
      : `<p class="muted">未有常用。撳「查車」或「附近站」加一條。</p>`;
  };

  const typingInSearch = () => {
    const el = document.activeElement;
    return !!(el && root.contains(el) && el.id === "bus-search-route");
  };

  const openView = (next, { back } = {}) => {
    if (back) backView = back;
    view = next;
    paintShell();
  };

  const detailEtaHtml = (eta) => {
    const items = eta?.items || [];
    if (!items.length) {
      return `<p class="eta-reason">${escapeHtml(eta?.reason || "暫時冇班次")}</p>`;
    }
    return items
      .map((row, index) => {
        const face = etaFace(row.mins);
        const cls = index === 0 ? "bus-eta-slot is-primary" : "bus-eta-slot";
        return `<div class="${cls}"><span class="eta-focus${face.soon ? " is-urgent" : ""}"><span class="eta-focus-num">${escapeHtml(face.num)}</span>${face.unit ? `<span class="eta-focus-unit">${face.unit}</span>` : ""}</span><span class="bus-eta-dest">往${escapeHtml(row.dest || current?.destName || "—")}</span></div>`;
      })
      .join("");
  };

  const paintSequence = () => {
    const list = root.querySelector("#bus-seq");
    if (!list) return;
    if (!sequence.length) {
      list.innerHTML = `<li class="muted">載入站序…</li>`;
      return;
    }
    list.innerHTML = sequence
      .map((stop) => {
        const here = stop.stopId === current?.stopId;
        return `<li><button type="button" class="bus-seq-stop${here ? " is-here" : ""}" data-seq-stop="${escapeHtml(stop.stopId)}" ${here ? 'aria-current="true"' : ""}>${escapeHtml(shortStopName(stop.nameTc) || stop.nameTc)}</button></li>`;
      })
      .join("");
    const here = list.querySelector(".is-here");
    if (here) list.scrollTop = Math.max(0, here.offsetTop - list.clientHeight / 2);
  };

  const loadSequence = async () => {
    if (!current) return;
    const key = `${current.route}|${current.bound}|${current.serviceType || "1"}`;
    if (sequenceKey === key && sequence.length) {
      paintSequence();
      return;
    }
    sequenceKey = key;
    sequence = [];
    paintSequence();
    try {
      const raw = await fetchRouteStops(current.route, current.bound, current.serviceType || "1");
      const named = await mapStopsWithNames(raw);
      if (sequenceKey !== key) return;
      sequence = named;
      paintSequence();
    } catch (err) {
      const list = root.querySelector("#bus-seq");
      if (list) list.innerHTML = `<li class="error">${escapeHtml(err.message || "站序載入失敗")}</li>`;
    }
  };

  const paintShell = () => {
    if (typingInSearch()) return;
    if (titleEl) titleEl.textContent = "巴士";
    if (!current && selection?.items?.length) {
      current = selection.items.find((i) => i.id === selection.activeId) || selection.items[0];
    }
    if (view === "detail" && current) {
      const face = chipLabel(current);
      root.innerHTML = `
        <button type="button" class="ghost-btn bus-back" id="bus-back">‹ 返回</button>
        <div class="bus-detail-head">
          <span class="eta-route-badge">${escapeHtml(current.route)}</span>
          <span class="bus-detail-label">${escapeHtml(face)}</span>
          <button type="button" class="icon-btn reverse-btn" id="bus-detail-reverse" aria-label="調轉方向">⇄</button>
        </div>
        <div id="bus-detail-eta" class="bus-eta-list"><p class="muted">載入班次…</p></div>
        <p class="bus-seq-label">站序 · 而家站高亮</p>
        <ol class="bus-seq" id="bus-seq"></ol>
      `;
      paintActions();
      const cached = etaCache.get(current.id);
      if (cached) root.querySelector("#bus-detail-eta").innerHTML = detailEtaHtml(cached);
      loadSequence();
      return;
    }
    if (view === "near") {
      root.innerHTML = `
        <button type="button" class="ghost-btn bus-back" id="bus-back">‹ 返回</button>
        <p class="muted">附近站按距離排。距離只喺呢部機計，唔會儲存。</p>
        <p class="bus-near-note" id="bus-near-note">${escapeHtml(nearNote || (locatePending ? "定位中…（請喺提示允許定位）" : ""))}</p>
        <div id="bus-near-list" class="bus-near-list"></div>
        <button type="button" class="ghost-btn" id="bus-near-retry">再試定位</button>
      `;
      paintActions();
      paintNearList();
      return;
    }
    if (view === "search") {
      const draft = escapeHtml(searchDraft);
      const recents = recent
        .map((item) => `<button type="button" class="bus-pill" data-recent="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
        .join("");
      root.innerHTML = `
        <button type="button" class="ghost-btn bus-back" id="bus-back">‹ 返回</button>
        <input id="bus-search-route" class="bus-route-input" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="路線號或站名，例如 64K／大埔墟" maxlength="24" aria-label="搜尋路線或站名" value="${draft}" />
        <div class="bus-recent" aria-label="最近搜尋">${recents || `<span class="muted">最近 5 次搜尋會記低喺呢部機</span>`}</div>
        <div id="bus-search-variants" class="bus-route-hits"></div>
        <div id="bus-search-stops"></div>
        <p class="muted" id="bus-search-status"></p>
        <button type="button" class="ghost-btn" id="bus-restore-defaults">恢復預設路線</button>
      `;
      paintActions();
      bindSearch();
      if (searchDraft) showSearch(searchDraft);
      return;
    }
    root.innerHTML = `
      <div class="bus-board" id="bus-board" aria-label="常用巴士"></div>
      <p class="muted bus-board-hint">一行一條常用線。點入睇站序。長按或向右滑可取消釘選。</p>
      <div class="bus-chip-tools">
        <button type="button" class="bus-pill bus-pill-add" id="bus-add-toggle">＋ 查車</button>
        <button type="button" class="bus-pill bus-near-pill" id="bus-nearby">📍 附近站</button>
      </div>
    `;
    paintActions();
    paintBoardRows();
  };

  const adoptStop = (stop, variant, { collapse = true } = {}) => {
    current = {
      id: watchId({
        route: variant.route,
        stopId: stop.stopId,
        bound: variant.bound,
      }),
      route: variant.route,
      bound: variant.bound,
      serviceType: variant.serviceType || "1",
      stopId: stop.stopId,
      stopName: stop.nameTc,
      destName: variant.destTc || variant.destName || "",
    };
    if (isPinned(selection, current)) {
      persist(saveBusSelection({ ...selection, activeId: current.id }));
    }
    if (collapse) {
      backView = view === "detail" ? backView : view;
      view = "detail";
    }
    if (`${current.route}|${current.bound}|${current.serviceType}` !== sequenceKey) {
      sequence = [];
      sequenceKey = "";
    }
    paintShell();
    return refresh();
  };

  let matchSeq = 0;
  let matchTimer = 0;

  const showDirectionStops = async (variant) => {
    const stopsEl = root.querySelector("#bus-search-stops");
    const statusEl = root.querySelector("#bus-search-status");
    if (!stopsEl || !variant) return;
    searchVariant = variant;
    if (statusEl) statusEl.textContent = "載入車站…";
    try {
      const raw = await fetchRouteStops(variant.route, variant.bound, variant.serviceType);
      const named = await mapStopsWithNames(raw);
      stopsEl.innerHTML = `
        <div class="bus-search-dirbar">
          <span>${escapeHtml(variant.route)} 往${escapeHtml(variant.destTc || "")}</span>
          <button type="button" class="reverse-cta" id="bus-search-reverse">⇄ 調轉方向</button>
        </div>
        <div class="bus-stop-list">
          ${named
            .map(
              (stop) =>
                `<button type="button" class="route-option" data-pick-stop="${escapeHtml(stop.stopId)}">${escapeHtml(shortStopName(stop.nameTc) || stop.nameTc)}</button>`
            )
            .join("")}
        </div>
      `;
      stopsEl.querySelector("#bus-search-reverse")?.addEventListener("click", () => flipSearchDirection());
      stopsEl.querySelector(".bus-stop-list")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-pick-stop]");
        if (!btn) return;
        const hit = named.find((stop) => stop.stopId === btn.dataset.pickStop);
        if (!hit) return;
        recent = rememberSearch(searchDraft);
        adoptStop(hit, variant);
      });
      if (statusEl) statusEl.textContent = `${named.length} 個站 · 點站入詳情`;
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || "載入失敗";
    }
  };

  const flipSearchDirection = async () => {
    if (!searchVariant) return;
    const all = await fetchRouteCatalog();
    const other = all.find(
      (v) =>
        v.route === searchVariant.route &&
        v.serviceType === searchVariant.serviceType &&
        v.bound !== searchVariant.bound
    );
    if (!other) {
      onStatus?.("搵唔到反方向");
      return;
    }
    await showDirectionStops(other);
    onStatus?.(`已調轉：往${other.destTc}`);
  };

  const showRoutesAtStop = async (stop) => {
    const stopsEl = root.querySelector("#bus-search-stops");
    const statusEl = root.querySelector("#bus-search-status");
    if (!stopsEl) return;
    if (statusEl) statusEl.textContent = "搵緊途經路線…";
    try {
      const map = await fetchRoutesAtStopMap();
      const rows = uniqueRouteRows(map.get(stop.stopId) || [], 12);
      if (!rows.length) {
        stopsEl.innerHTML = `<p class="muted">呢個站暫時冇公開路線。</p>`;
        return;
      }
      stopsEl.innerHTML = `
        <p class="bus-group-label">${escapeHtml(shortStopName(stop.nameTc) || stop.nameTc)} · 揀線</p>
        <div class="bus-route-hit">
          ${rows
            .map(
              (row) =>
                `<button type="button" class="station-btn" data-stop-route="${escapeHtml(row.route)}|${escapeHtml(row.bound)}|${escapeHtml(row.serviceType)}">${escapeHtml(row.route)} 往${escapeHtml(row.destTc || "")}</button>`
            )
            .join("")}
        </div>
      `;
      stopsEl.querySelector(".bus-route-hit")?.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-stop-route]");
        if (!btn) return;
        const [route, boundDir, serviceType] = btn.dataset.stopRoute.split("|");
        const all = await fetchRouteCatalog();
        const variant =
          all.find((v) => v.route === route && v.bound === boundDir && v.serviceType === serviceType) || {
            route,
            bound: boundDir,
            serviceType,
            destTc: "",
          };
        recent = rememberSearch(searchDraft || stop.nameTc);
        adoptStop(stop, variant);
      });
      if (statusEl) statusEl.textContent = "點一條線入詳情";
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || "路線載入失敗";
    }
  };

  const showSearch = async (raw) => {
    const variantsEl = root.querySelector("#bus-search-variants");
    const statusEl = root.querySelector("#bus-search-status");
    const stopsEl = root.querySelector("#bus-search-stops");
    if (!variantsEl) return;
    const seq = ++matchSeq;
    const query = String(raw || "").trim();
    if (!query) {
      variantsEl.innerHTML = "";
      if (stopsEl) stopsEl.innerHTML = "";
      if (statusEl) statusEl.textContent = "輸入路線號或站名";
      return;
    }
    if (statusEl) statusEl.textContent = "搜尋中…";
    try {
      const [catalog, stops] = await Promise.all([fetchRouteCatalog(), fetchStopList()]);
      if (seq !== matchSeq) return;
      const q = query.toUpperCase();
      const routes = [
        ...new Set(
          catalog
            .filter((row) => {
              const name = row.route.toUpperCase();
              return name.startsWith(q) || name.includes(q);
            })
            .map((row) => row.route)
        ),
      ]
        .sort((a, b) => {
          const as = a.toUpperCase().startsWith(q) ? 0 : 1;
          const bs = b.toUpperCase().startsWith(q) ? 0 : 1;
          return as - bs || a.localeCompare(b, "en");
        })
        .slice(0, 6);
      const needle = query.toLowerCase();
      const stopHits = stops
        .filter(
          (stop) =>
            (stop.nameTc || "").includes(query) || (stop.nameEn || "").toLowerCase().includes(needle)
        )
        .slice(0, 8);
      const routeHtml = routes.length
        ? routes
            .map((route) => {
              const dirs = catalog.filter((row) => row.route === route && row.serviceType === "1");
              const list = dirs.length ? dirs : catalog.filter((row) => row.route === route);
              return `<div class="bus-route-hit">
                <span class="eta-route-badge">${escapeHtml(route)}</span>
                ${list
                  .map(
                    (v) =>
                      `<button type="button" class="station-btn" data-pick-dir="${escapeHtml(v.route)}|${escapeHtml(v.bound)}|${escapeHtml(v.serviceType)}">往${escapeHtml(v.destTc)}</button>`
                  )
                  .join("")}
              </div>`;
            })
            .join("")
        : `<p class="muted">冇符合嘅路線</p>`;
      const stopHtml = stopHits.length
        ? stopHits
            .map((stop) => {
              const meters =
                lastPoint && Number.isFinite(stop.lat)
                  ? rankStopsByDistance([stop], lastPoint.lat, lastPoint.lng)[0]?.meters
                  : null;
              const dist = Number.isFinite(meters) ? ` <small>${escapeHtml(formatMeters(meters))}</small>` : "";
              return `<button type="button" class="route-option" data-pick-named="${escapeHtml(stop.stopId)}">${escapeHtml(shortStopName(stop.nameTc) || stop.nameTc)}${dist}</button>`;
            })
            .join("")
        : `<p class="muted">冇符合嘅車站</p>`;
      variantsEl.innerHTML = `<p class="bus-group-label">路線</p>${routeHtml}<p class="bus-group-label">車站</p><div class="bus-stop-list" id="bus-stop-hits">${stopHtml}</div>`;
      if (stopsEl) stopsEl.innerHTML = "";
      variantsEl.querySelector("#bus-stop-hits")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-pick-named]");
        if (!btn) return;
        const stop = stopHits.find((row) => row.stopId === btn.dataset.pickNamed);
        if (stop) showRoutesAtStop(stop);
      });
      if (statusEl) statusEl.textContent = routes.length || stopHits.length ? "揀路線方向，或點車站再揀線" : "";
    } catch (err) {
      if (seq !== matchSeq) return;
      if (statusEl) statusEl.textContent = err.message || "搜尋失敗";
    }
  };

  const bindSearch = () => {
    const input = root.querySelector("#bus-search-route");
    const variantsEl = root.querySelector("#bus-search-variants");
    input?.addEventListener("input", () => {
      searchDraft = input.value;
      window.clearTimeout(matchTimer);
      matchTimer = window.setTimeout(() => showSearch(searchDraft), 160);
    });
    variantsEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-pick-dir]");
      if (!btn) return;
      const [route, boundDir, serviceType] = btn.dataset.pickDir.split("|");
      const all = await fetchRouteCatalog();
      const variant = all.find(
        (v) => v.route === route && v.bound === boundDir && v.serviceType === serviceType
      );
      if (!variant) return;
      recent = rememberSearch(searchDraft);
      showDirectionStops(variant);
    });
    root.querySelector(".bus-recent")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-recent]");
      if (!btn || !input) return;
      input.value = btn.dataset.recent;
      searchDraft = input.value;
      showSearch(searchDraft);
    });
    root.querySelector("#bus-restore-defaults")?.addEventListener("click", () => {
      const next = clearBusSelection();
      persist(next);
      current = next.items[0];
      view = "board";
      searchDraft = "";
      paintShell();
      refresh();
      onStatus?.("已恢復預設路線");
    });
  };

  const paintNearList = () => {
    const host = root.querySelector("#bus-near-list");
    const note = root.querySelector("#bus-near-note");
    if (note) note.textContent = nearNote;
    if (!host) return;
    if (!nearStops.length) {
      host.innerHTML = nearNote ? "" : `<p class="muted">撳「再試定位」列出附近站。</p>`;
      return;
    }
    host.innerHTML = nearStops
      .map((stop) => {
        const chips = uniqueRouteRows(stop.routes || [], 3)
          .map((row) => `<span class="bus-mini-chip">${escapeHtml(row.route)}</span>`)
          .join("");
        return `<button type="button" class="bus-near-row" data-near-stop="${escapeHtml(stop.stopId)}">
          <span><strong>${escapeHtml(shortStopName(stop.nameTc) || stop.nameTc)}</strong><span class="muted"> ${escapeHtml(formatMeters(stop.meters))}</span></span>
          <span class="bus-mini-chips">${chips}</span>
        </button>`;
      })
      .join("");
  };

  const rankNearby = async (lat, lng) => {
    lastPoint = { lat, lng };
    nearNote = "計緊附近站同途經路線…";
    paintNearList();
    const [stops, routeMap] = await Promise.all([fetchStopList(), fetchRoutesAtStopMap()]);
    const ranked = rankStopsByDistance(stops, lat, lng)
      .filter((stop) => Number.isFinite(stop.meters))
      .slice(0, 12)
      .map((stop) => ({ ...stop, routes: routeMap.get(stop.stopId) || [] }));
    nearStops = ranked;
    nearNote = ranked.length ? "由近到遠。點站再揀線。" : "附近冇站座標。";
    if (view === "near") paintNearList();
  };

  const refresh = async () => {
    samplePinned();
    if (view === "near" && lastPoint) {
      rankNearby(lastPoint.lat, lastPoint.lng).catch((err) => {
        nearNote = err.message || "附近站載入失敗";
        paintNearList();
      });
    }
    const box = root.querySelector("#bus-detail-eta");
    if (view !== "detail" || !box || !current) return;
    const seq = ++refreshSeq;
    try {
      const eta = await loadEtaRows(current.stopId, current.route, current.serviceType || "1", current.bound);
      if (seq !== refreshSeq) return;
      if (!current.destName && eta.items[0]?.dest) current.destName = eta.items[0].dest;
      etaCache.set(current.id, eta);
      if (view === "detail") {
        const live = root.querySelector("#bus-detail-eta");
        if (live) live.innerHTML = detailEtaHtml(eta);
      }
      lastFetchAt = Date.now();
      updateFresh();
      updateStar();
      onStatus?.("巴士已更新");
    } catch (e) {
      if (seq !== refreshSeq) return;
      box.innerHTML = `<p class="error">巴士暫無資料：${escapeHtml(e.message || e)}</p>`;
      onStatus?.("巴士更新失敗");
    }
  };

  const samplePinned = async () => {
    const seq = ++pinSeq;
    const items = (selection?.items || []).slice(0, 8);
    const rows = await Promise.all(
      items.map(async (it) => {
        try {
          const eta = await loadEtaRows(it.stopId, it.route, it.serviceType || "1", it.bound);
          etaCache.set(it.id, eta);
          const mins = eta.items?.[0]?.mins;
          if (mins == null) return null;
          const dest = it.destName || eta.items[0].dest || "";
          return { mins, text: `${it.route} 往${dest} ${etaWhen(mins)}`.replace(/\s+/g, " ").trim() };
        } catch {
          return null;
        }
      })
    );
    if (seq !== pinSeq) return;
    soonest = rows.filter(Boolean).sort((a, b) => a.mins - b.mins)[0] || null;
    if (view === "board") paintBoardRows();
    onDigest?.();
    if (items.length) {
      lastFetchAt = Date.now();
      updateFresh();
    }
  };

  const locateNearest = () => {
    if (!navigator.geolocation) {
      nearNote = locateHint("unsupported");
      nearStops = [];
      openView("near");
      onStatus?.(nearNote);
      return;
    }
    if (locatePending) {
      nearNote = "定位中…（請喺提示允許定位）";
      openView("near");
      onStatus?.(nearNote);
      return;
    }
    const token = ++locateToken;
    locatePending = true;
    nearNote = "定位中…（只喺呢部機計距離）";
    nearStops = [];
    openView("near");
    onStatus?.(nearNote);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (token !== locateToken) return;
        locatePending = false;
        try {
          await rankNearby(pos.coords.latitude, pos.coords.longitude);
          onStatus?.(nearStops[0] ? `最近：${shortStopName(nearStops[0].nameTc)}` : "附近冇站座標");
        } catch (err) {
          nearNote = `附近站載入失敗：${err.message || err}`;
          paintNearList();
          onStatus?.("附近站載入失敗");
        }
      },
      (err) => {
        if (token !== locateToken) return;
        locatePending = false;
        nearNote = locateHint(err?.code);
        nearStops = [];
        paintNearList();
        onStatus?.(err?.code === 1 ? "定位未允許" : err?.code === 3 ? "定位逾時，可再試一次" : "定位失敗，可再試一次");
      },
      { enableHighAccuracy: false, timeout: 60000, maximumAge: 120000 }
    );
  };

  const reverseDirection = async () => {
    if (reverseLock || !current) {
      if (!current) onStatus?.("先點入一條路線");
      return;
    }
    reverseLock = true;
    onStatus?.("調轉緊…");
    try {
      const variants = await fetchRouteVariants(current.route);
      const opp = await findOppositeDirection(
        current.route,
        current.serviceType || "1",
        current.bound,
        current.stopName,
        "",
        { stopId: current.stopId }
      );
      if (!opp) {
        onStatus?.("搵唔到對應回程車站，請撳「＋ 查車」揀返程車站");
        return;
      }
      const other =
        variants.find((v) => v.serviceType === String(opp.serviceType) && v.bound === opp.bound) ||
        variants.find((v) => v.bound === opp.bound);
      const stopName = shortStopName(opp.stopName) || current.stopName;
      view = "detail";
      await adoptStop(
        { stopId: opp.stopId, nameTc: opp.stopName || current.stopName },
        {
          route: current.route,
          bound: opp.bound,
          serviceType: opp.serviceType || current.serviceType || "1",
          destTc: other?.destTc || "",
        },
        { collapse: true }
      );
      onStatus?.(`已調轉：往${other?.destTc || stopName}`);
    } catch (err) {
      onStatus?.(`調轉失敗：${err.message || err}`);
    } finally {
      reverseLock = false;
    }
  };

  const toggleRowPin = (id) => {
    const it = (selection?.items || []).find((row) => row.id === id) || (current?.id === id ? current : null);
    if (!it) return;
    const was = isPinned(selection, it);
    persist(togglePinned(selection, it));
    if (!was) {
      it.id = watchId(it);
      current = { ...it };
    } else if (current?.id === id) {
      current = selection.items?.[0] || null;
    }
    updateStar();
    if (view === "board") paintBoardRows();
    onStatus?.(was ? "已取消釘選" : "已釘選到常用");
  };

  let suppressClick = false;
  let pressTimer = 0;

  const onClick = (e) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (e.target.closest("#bus-back")) {
      view = backView === view ? "board" : backView || "board";
      if (view !== "search" && view !== "near" && view !== "detail") view = "board";
      paintShell();
      if (view === "detail") refresh();
      return;
    }
    if (e.target.closest("#bus-nearby") || e.target.closest("#bus-near-retry")) {
      locateNearest();
      return;
    }
    if (e.target.closest("#bus-add-toggle")) {
      backView = "board";
      view = "search";
      paintShell();
      root.querySelector("#bus-search-route")?.focus();
      return;
    }
    const seqBtn = e.target.closest("[data-seq-stop]");
    if (seqBtn && current) {
      const stop = sequence.find((row) => row.stopId === seqBtn.dataset.seqStop);
      if (!stop || stop.stopId === current.stopId) return;
      adoptStop(stop, {
        route: current.route,
        bound: current.bound,
        serviceType: current.serviceType || "1",
        destTc: current.destName,
      });
      return;
    }
    const nearBtn = e.target.closest("[data-near-stop]");
    if (nearBtn) {
      const stop = nearStops.find((row) => row.stopId === nearBtn.dataset.nearStop);
      if (!stop) return;
      backView = "near";
      view = "search";
      searchDraft = "";
      paintShell();
      showRoutesAtStop(stop);
      return;
    }
    const watchBtn = e.target.closest("[data-watch]");
    if (watchBtn && root.contains(watchBtn)) {
      const it = selection.items.find((i) => i.id === watchBtn.dataset.watch);
      if (!it) return;
      current = { ...it };
      persist(saveBusSelection({ ...selection, activeId: it.id }));
      backView = "board";
      view = "detail";
      sequence = [];
      sequenceKey = "";
      paintShell();
      refresh();
    }
  };

  const onDocClick = (e) => {
    const host = actionHost();
    if (!host.contains(e.target) && !root.contains(e.target)) return;
    if (e.target.closest("#bus-reverse-btn") || e.target.closest("#bus-detail-reverse")) {
      e.preventDefault();
      reverseDirection();
      return;
    }
    if (e.target.closest("#bus-star-btn")) {
      e.preventDefault();
      if (!current) return;
      const was = isPinned(selection, current);
      persist(togglePinned(selection, current));
      if (!was) current.id = watchId(current);
      updateStar();
      if (view === "board") paintBoardRows();
      onStatus?.(was ? "已取消釘選" : "已釘選到常用");
    }
  };

  const onVis = () => {
    if (document.visibilityState === "visible" && (!lastFetchAt || Date.now() - lastFetchAt > 20000)) {
      refresh();
    }
  };

  const setSelection = (next) => {
    selection = next;
    current = next.items?.find((i) => i.id === next.activeId) || next.items?.[0] || null;
    view = "board";
    paintShell();
    refresh();
  };

  const start = (initial) => {
    if (!bound) {
      bound = true;
      root.addEventListener("click", onClick);
      document.addEventListener("click", onDocClick);
      document.addEventListener("visibilitychange", onVis);
      root.addEventListener("pointerdown", (e) => {
        const row = e.target.closest("[data-watch]");
        if (!row) return;
        const id = row.dataset.watch;
        window.clearTimeout(pressTimer);
        pressTimer = window.setTimeout(() => {
          suppressClick = true;
          toggleRowPin(id);
        }, 560);
      });
      const clearPress = () => window.clearTimeout(pressTimer);
      root.addEventListener("pointerup", clearPress);
      root.addEventListener("pointercancel", clearPress);
      root.addEventListener("pointermove", (e) => {
        if (Math.abs(e.movementX) > 8 || Math.abs(e.movementY) > 8) clearPress();
      });
      let swipe = null;
      root.addEventListener(
        "touchstart",
        (e) => {
          const row = e.target.closest("[data-watch]");
          const t = e.changedTouches[0];
          if (!row || !t) return;
          swipe = { id: row.dataset.watch, x: t.clientX, y: t.clientY };
        },
        { passive: true }
      );
      root.addEventListener(
        "touchend",
        (e) => {
          if (!swipe) return;
          const t = e.changedTouches[0];
          const id = swipe.id;
          const dx = t ? t.clientX - swipe.x : 0;
          const dy = t ? Math.abs(t.clientY - swipe.y) : 99;
          swipe = null;
          if (dx > 64 && dy < 40) {
            suppressClick = true;
            toggleRowPin(id);
          }
        },
        { passive: true }
      );
    }
    setSelection(initial);
    if (timer) clearInterval(timer);
    if (freshTimer) clearInterval(freshTimer);
    timer = setInterval(refresh, 45000);
    freshTimer = setInterval(updateFresh, 1000);
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
    if (freshTimer) clearInterval(freshTimer);
    window.clearTimeout(pressTimer);
    root.removeEventListener("click", onClick);
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("visibilitychange", onVis);
  };

  return {
    start,
    setSelection,
    refresh,
    destroy,
    getSoonest: () => soonest,
    _base: KMB_BASE,
  };
}
