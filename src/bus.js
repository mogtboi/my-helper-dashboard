import {
  fetchEta,
  fetchRouteVariants,
  fetchRouteStops,
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

async function loadEtaRows(stopId, route, serviceType) {
  const rows = await fetchEta(stopId, route, serviceType);
  const now = Date.now();
  const withEta = rows.filter((r) => r.eta != null && String(r.eta).trim() !== "");
  const items = withEta
    .map((r) => ({
      dest: r.dest_tc,
      mins: minsUntil(r.eta, now),
      rmk: r.rmk_tc,
    }))
    .slice(0, 3);
  if (items.length) return { items, reason: "" };
  const remarks = [
    ...new Set(
      rows
        .filter((r) => (r.eta == null || String(r.eta).trim() === "") && String(r.rmk_tc || "").trim())
        .map((r) => String(r.rmk_tc).trim())
    ),
  ];
  return { items: [], reason: remarks.join("；") };
}

function formatMeters(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 1000) return `📍 距離約 ${Math.round(m)}m`;
  return `📍 距離約 ${(m / 1000).toFixed(1)}km`;
}

function focusHtml(cur, eta) {
  const first = eta?.items?.[0];
  const urgent = first && (first.mins === 0 || first.mins <= 2);
  const num = !first ? "—" : first.mins === 0 ? "即將到達" : `${first.mins}`;
  const unit = first && first.mins !== 0 && first.mins != null ? "分" : "";
  const rest = (eta?.items || []).slice(1, 3).map((it) => (it.mins === 0 ? "即將" : `${it.mins}分`));
  const next = rest.length ? `<div class="eta-next">次班: ${rest.map((t) => escapeHtml(t)).join(" · ")}</div>` : "";
  const empty = !first
    ? `<p class="eta-reason">${escapeHtml(eta?.reason || "暫時冇班次")}</p>`
    : "";
  return `
    <article class="eta-card bus-focus">
      <div class="eta-card-main">
        <div class="eta-card-left">
          <div class="eta-card-route-row">
            <span class="eta-route-badge">${escapeHtml(cur.route)}</span>
            <span class="eta-card-dest">往${escapeHtml(cur.destName || first?.dest || "—")}</span>
          </div>
          <button type="button" class="bus-stop-toggle" id="bus-stop-toggle" aria-expanded="false">
            ${escapeHtml(cur.stopName || "揀站")} <span aria-hidden="true">▾</span>
          </button>
        </div>
        <div class="eta-card-right">
          <div class="eta-focus${urgent ? " is-urgent" : ""}">
            <span class="eta-focus-num">${escapeHtml(num)}</span>
            <span class="eta-focus-unit">${escapeHtml(unit)}</span>
          </div>
          ${next}
        </div>
      </div>
      ${empty}
    </article>
    <div id="bus-stop-picker" class="bus-stop-picker" hidden></div>`;
}

/**
 * Compact bus card: header actions, one chip row, one ETA row.
 * Add / pin / remove all happen on the card. No settings-page bus tab.
 */
export function createBus(root, titleEl, { onStatus, onSelectionPersist, actionsEl } = {}) {
  let selection = null;
  /** Viewed stop; may be unsaved until ★. */
  let current = null;
  let searchOpen = false;
  let pickerOpen = false;
  let lastFetchAt = 0;
  let refreshSeq = 0;
  let reverseLock = false;
  let timer = null;
  let freshTimer = null;
  let bound = false;

  const persist = (next) => {
    selection = next;
    onSelectionPersist?.(next);
  };

  const updateFresh = () => {
    const el = document.querySelector("#bus-fresh");
    if (el) el.textContent = freshnessLabel(lastFetchAt);
  };

  const updateStar = () => {
    const btn = document.querySelector("#bus-star-btn");
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

  const paintChips = () => {
    const row = root.querySelector("#bus-chips");
    if (!row) return;
    const items = selection?.items || [];
    const chips = items
      .map((it) => {
        const on = current && it.id === (current.id || watchId(current));
        const label = `${it.route} ${it.stopName}`;
        return `<button type="button" class="bus-pill" data-watch="${escapeHtml(it.id)}" aria-pressed="${on}">${escapeHtml(label)}</button>`;
      })
      .join("");
    row.innerHTML = `
      ${chips || `<span class="muted fav-empty">未有常用</span>`}
      <button type="button" class="bus-pill bus-pill-add" id="bus-add-toggle" aria-expanded="${searchOpen}">＋ 查車</button>
    `;
  };

  const paintShell = () => {
    if (titleEl) titleEl.textContent = "巴士";
    if (!current && selection?.items?.length) {
      current = selection.items.find((i) => i.id === selection.activeId) || selection.items[0];
    }
    root.innerHTML = `
      <div class="bus-chip-row" id="bus-chips" aria-label="常用巴士"></div>
      <div id="bus-eta"><p class="muted">載入 ETA…</p></div>
      <section class="bus-search" id="bus-search" ${searchOpen ? "" : "hidden"}>
        <div class="add-form bus-search-form">
          <input id="bus-search-route" type="text" inputmode="text" autocomplete="off" placeholder="路線 43X" maxlength="8" aria-label="路線" />
          <button type="button" class="tab" id="bus-search-load">搜尋</button>
        </div>
        <div id="bus-search-variants" class="add-variants"></div>
        <div id="bus-search-stops"></div>
        <p class="muted" id="bus-search-status"></p>
        <button type="button" class="ghost-btn" id="bus-restore-defaults">恢復預設路線</button>
      </section>
    `;
    paintActions();
    paintChips();
    bindSearch();
  };

  const renderStopButtons = (stops, { nearestIds = new Set() } = {}) =>
    stops
      .map((s) => {
        const near = nearestIds.has(s.stopId) && Number.isFinite(s.meters);
        return `<button type="button" class="route-option" data-pick-stop="${escapeHtml(s.stopId)}">
          ${escapeHtml(s.nameTc)}${near ? ` <small>${escapeHtml(formatMeters(s.meters))}</small>` : ""}
        </button>`;
      })
      .join("");

  const orderNearest = (stops) => {
    const ranked = [...stops].filter((s) => Number.isFinite(s.meters)).sort((a, b) => a.meters - b.meters);
    const top = ranked.slice(0, 2);
    const topIds = new Set(top.map((s) => s.stopId));
    const rest = stops.filter((s) => !topIds.has(s.stopId));
    return { list: [...top, ...rest], nearestIds: topIds };
  };

  const filterStops = (stops, q) => {
    const needle = q.trim();
    if (!needle) return stops;
    return stops.filter((s) => (s.nameTc || "").includes(needle) || (s.nameEn || "").toLowerCase().includes(needle.toLowerCase()));
  };

  const mountStopBrowser = (host, named, variant, { onPick }) => {
    let rows = named;
    const draw = () => {
      const q = host.querySelector(".bus-filter")?.value || "";
      const filtered = filterStops(rows, q);
      const { list, nearestIds } = orderNearest(filtered);
      const box = host.querySelector(".bus-stop-list");
      if (box) {
        box.innerHTML = list.length
          ? renderStopButtons(list, { nearestIds })
          : `<p class="muted">冇符合嘅站</p>`;
      }
    };
    host.innerHTML = `
      <div class="bus-filter-row">
        <input class="bus-filter" type="search" placeholder="🔍 過濾站名（例如：轉車站、大埔）" aria-label="過濾站名" />
        <button type="button" class="bus-near-btn" data-near>📍 附近分站</button>
      </div>
      <div class="bus-stop-list"></div>
    `;
    draw();
    host.querySelector(".bus-filter").addEventListener("input", draw);
    host.querySelector("[data-near]").addEventListener("click", () => {
      if (!navigator.geolocation) {
        onStatus?.("呢部機冇定位");
        return;
      }
      onStatus?.("定位中…（只喺呢部機計距離）");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Coordinates stay in this callback. Never written to localStorage or sent out.
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          rows = rankStopsByDistance(named, lat, lng);
          draw();
          const nearest = rows.find((s) => Number.isFinite(s.meters));
          if (nearest) onPick(nearest, variant);
          onStatus?.(nearest ? `最近：${nearest.nameTc}` : "附近冇站座標");
        },
        () => onStatus?.("定位未允許，可以手動過濾站名"),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
    host.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick-stop]");
      if (!btn) return;
      const hit = rows.find((s) => s.stopId === btn.dataset.pickStop) || named.find((s) => s.stopId === btn.dataset.pickStop);
      if (hit) onPick(hit, variant);
    });
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
    pickerOpen = false;
    if (collapse) searchOpen = false;
    paintShell();
    return refresh();
  };

  const bindSearch = () => {
    const input = root.querySelector("#bus-search-route");
    const variantsEl = root.querySelector("#bus-search-variants");
    const stopsEl = root.querySelector("#bus-search-stops");
    const statusEl = root.querySelector("#bus-search-status");
    let loaded = [];
    input?.addEventListener("input", () => {
      const up = input.value.toUpperCase();
      if (up !== input.value) input.value = up;
    });
    root.querySelector("#bus-search-load")?.addEventListener("click", async () => {
      const route = input.value.trim().toUpperCase();
      if (!route) {
        statusEl.textContent = "請輸入路線";
        return;
      }
      statusEl.textContent = "搜尋中…";
      variantsEl.innerHTML = "";
      stopsEl.innerHTML = "";
      try {
        const all = await fetchRouteVariants(route);
        const preferred = all.filter((v) => v.serviceType === "1");
        loaded = preferred.length ? preferred : all;
        if (!loaded.length) {
          statusEl.textContent = `搵唔到 ${route}`;
          return;
        }
        variantsEl.innerHTML = loaded
          .map(
            (v, i) =>
              `<button type="button" class="station-btn" data-sv="${i}">${escapeHtml(v.route)} · ${escapeHtml(v.label)}</button>`
          )
          .join("");
        statusEl.textContent = "揀方向";
      } catch (err) {
        statusEl.textContent = err.message || "搜尋失敗";
      }
    });
    variantsEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-sv]");
      if (!btn) return;
      const variant = loaded[Number(btn.dataset.sv)];
      statusEl.textContent = "載入車站…";
      try {
        const raw = await fetchRouteStops(variant.route, variant.bound, variant.serviceType);
        const named = await mapStopsWithNames(raw);
        mountStopBrowser(stopsEl, named, variant, {
          onPick: (stop, v) => adoptStop(stop, v),
        });
        statusEl.textContent = `${named.length} 個站`;
      } catch (err) {
        statusEl.textContent = err.message || "載入失敗";
      }
    });
    root.querySelector("#bus-restore-defaults")?.addEventListener("click", () => {
      const next = clearBusSelection();
      persist(next);
      current = next.items[0];
      searchOpen = false;
      paintShell();
      refresh();
      onStatus?.("已恢復預設路線");
    });
  };

  const openPicker = async () => {
    const host = root.querySelector("#bus-stop-picker");
    const toggle = root.querySelector("#bus-stop-toggle");
    if (!host || !current) return;
    pickerOpen = !pickerOpen;
    host.hidden = !pickerOpen;
    toggle?.setAttribute("aria-expanded", String(pickerOpen));
    if (!pickerOpen) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = `<p class="muted">載入同方向車站…</p>`;
    try {
      const raw = await fetchRouteStops(current.route, current.bound, current.serviceType || "1");
      const named = await mapStopsWithNames(raw);
      const variant = {
        route: current.route,
        bound: current.bound,
        serviceType: current.serviceType || "1",
        destTc: current.destName,
      };
      mountStopBrowser(host, named, variant, {
        onPick: (stop, v) => adoptStop(stop, v, { collapse: true }),
      });
    } catch (err) {
      host.innerHTML = `<p class="error">${escapeHtml(err.message || err)}</p>`;
    }
  };

  const refresh = async () => {
    const box = root.querySelector("#bus-eta");
    if (!box || !current) {
      if (box) box.innerHTML = `<p class="muted">撳「＋ 查車」加站</p>`;
      return;
    }
    const seq = ++refreshSeq;
    try {
      const eta = await loadEtaRows(current.stopId, current.route, current.serviceType || "1");
      if (seq !== refreshSeq) return;
      if (!current.destName && eta.items[0]?.dest) current.destName = eta.items[0].dest;
      box.innerHTML = focusHtml(current, eta);
      lastFetchAt = Date.now();
      updateFresh();
      updateStar();
      paintChips();
      onStatus?.("巴士已更新");
    } catch (e) {
      if (seq !== refreshSeq) return;
      box.innerHTML = `<p class="error">巴士暫無資料：${escapeHtml(e.message || e)}</p>`;
      onStatus?.("巴士更新失敗");
    }
  };

  const reverseDirection = async () => {
    if (reverseLock || !current) return;
    reverseLock = true;
    onStatus?.("調轉緊…");
    try {
      const variants = await fetchRouteVariants(current.route);
      const other = variants.find(
        (v) => v.serviceType === String(current.serviceType || "1") && v.bound !== current.bound
      );
      const opp = await findOppositeDirection(
        current.route,
        current.serviceType || "1",
        current.bound,
        current.stopName,
        other?.destTc
      );
      if (!opp) {
        onStatus?.("搵唔到反方向車站");
        return;
      }
      await adoptStop(
        { stopId: opp.stopId, nameTc: current.stopName },
        {
          route: current.route,
          bound: opp.bound,
          serviceType: opp.serviceType || current.serviceType || "1",
          destTc: other?.destTc || "",
        }
      );
      onStatus?.(`已調轉：往${other?.destTc || ""}`);
    } catch (err) {
      onStatus?.(`調轉失敗：${err.message || err}`);
    } finally {
      reverseLock = false;
    }
  };

  const onClick = (e) => {
    const watchBtn = e.target.closest("[data-watch]");
    if (watchBtn && root.contains(watchBtn)) {
      const it = selection.items.find((i) => i.id === watchBtn.dataset.watch);
      if (!it) return;
      current = { ...it };
      persist(saveBusSelection({ ...selection, activeId: it.id }));
      searchOpen = false;
      pickerOpen = false;
      paintShell();
      refresh();
      return;
    }
    if (e.target.closest("#bus-add-toggle")) {
      searchOpen = !searchOpen;
      pickerOpen = false;
      paintShell();
      refresh();
      return;
    }
    if (e.target.closest("#bus-stop-toggle")) {
      openPicker();
    }
  };

  const onDocClick = (e) => {
    if (e.target.closest("#bus-reverse-btn")) {
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
      paintChips();
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
    paintShell();
    refresh();
  };

  const start = (initial) => {
    if (!bound) {
      bound = true;
      root.addEventListener("click", onClick);
      document.addEventListener("click", onDocClick);
      document.addEventListener("visibilitychange", onVis);
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
    root.removeEventListener("click", onClick);
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("visibilitychange", onVis);
  };

  return { start, setSelection, refresh, destroy, _base: KMB_BASE };
}
