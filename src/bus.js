import {
  fetchEta,
  fetchRouteVariants,
  fetchRouteStops,
  mapStopsWithNames,
  findOppositeDirection,
  KMB_BASE,
} from "./kmbApi.js";
import {
  selectionRoutesLabel,
  saveBusSelection,
  toggleBusFavorite,
  isBusFavorite,
} from "./busStore.js";
import { escapeHtml } from "./escapeHtml.js";
import {
  compactEtaCard,
  freshnessBarHtml,
  freshnessLabel,
  makeRefreshController,
} from "./transitUi.js";

function minsUntil(etaIso, now = Date.now()) {
  if (!etaIso) return null;
  const diff = new Date(etaIso).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return 0;
  return Math.round(diff / 60000);
}

/** Returns { items, reason } — reason from null/empty-eta rows with rmk_tc when no real ETAs. */
async function loadEtaRows(stopId, route, serviceType) {
  const rows = await fetchEta(stopId, route, serviceType);
  const now = Date.now();
  const withEta = rows.filter((r) => r.eta != null && String(r.eta).trim() !== "");
  const items = withEta
    .map((r) => ({
      dest: r.dest_tc,
      eta: r.eta,
      mins: minsUntil(r.eta, now),
      rmk: r.rmk_tc,
    }))
    .slice(0, 3);

  if (items.length) {
    return { items, reason: "" };
  }

  const remarks = [
    ...new Set(
      rows
        .filter((r) => {
          const etaEmpty = r.eta == null || String(r.eta).trim() === "";
          return etaEmpty && String(r.rmk_tc || "").trim();
        })
        .map((r) => String(r.rmk_tc || "").trim())
        .filter(Boolean)
    ),
  ];
  return {
    items: [],
    reason: remarks.join("；"),
  };
}

/** Flatten stops into per-route option list (stop + direction). */
function buildRouteGroups(selection) {
  const map = new Map();
  for (const stop of selection?.stops || []) {
    const route = stop.route;
    if (!map.has(route)) map.set(route, []);
    for (const dir of stop.directions || []) {
      map.get(route).push({
        key: `${stop.id}::${dir.stopId}::${dir.bound || ""}`,
        stop,
        dir,
        label: `${stop.nameTc} · ${dir.label}`,
      });
    }
  }
  return map;
}

function destFromDirLabel(label) {
  const s = String(label || "");
  return s.replace(/^往\s*/, "") || s;
}

/**
 * Bus ETA panel — favorites chips, compact ETA, reverse, freshness.
 */
export function createBus(root, titleEl, { onStatus, onOpenSettings, onSelectionPersist } = {}) {
  let selection = null;
  let activeRoute = null;
  let activeOptionKey = null;
  /** Ephemeral browse: { route, stopId, nameTc, label, serviceType, destTc } */
  let browsePick = null;
  let mode = "saved"; // saved | other | search
  let lastHtml = "";
  let timer = null;
  let freshTimer = null;
  let lastFetchAt = 0;
  let groups = new Map();
  let refreshCtrl = null;
  let refreshSeq = 0;
  let reverseLock = false;
  let reverseBound = false;

  const persist = (next) => {
    selection = next;
    onSelectionPersist?.(next);
  };

  const currentFavLike = () => {
    if ((mode === "other" || mode === "search") && browsePick) {
      return {
        route: browsePick.route,
        stopId: browsePick.stopId,
        nameTc: browsePick.nameTc,
        dirLabel: browsePick.label?.includes("往")
          ? browsePick.label.split("·").pop()?.trim() || browsePick.label
          : `往${browsePick.destTc || ""}`,
        bound: browsePick.bound || "",
        serviceType: browsePick.serviceType || "1",
      };
    }
    const options = groups.get(activeRoute) || [];
    const opt = options.find((o) => o.key === activeOptionKey) || options[0];
    if (!opt) return null;
    return {
      route: opt.stop.route,
      stopId: opt.dir.stopId,
      nameTc: opt.stop.nameTc,
      dirLabel: opt.dir.label,
      bound: opt.dir.bound || "",
      serviceType: opt.dir.serviceType || opt.stop.serviceType || "1",
      optionKey: opt.key,
      stopEntryId: opt.stop.id,
    };
  };

  const paintFavChips = () => {
    const row = root.querySelector("#bus-fav-chips");
    if (!row) return;
    const favs = selection?.favorites || [];
    if (!favs.length) {
      row.innerHTML = `<span class="muted fav-empty">未有常用 · 撳 ★ 釘選呢個站</span>`;
      return;
    }
    row.innerHTML = favs
      .map(
        (f) => `
      <button type="button" class="fav-chip" data-fav="${escapeHtml(f.id)}"
        aria-label="${escapeHtml(f.route)} ${escapeHtml(f.dirLabel)} ${escapeHtml(f.nameTc)}">
        <span class="fav-chip-route">${escapeHtml(f.route)}</span>
        <span class="fav-chip-meta">${escapeHtml(f.dirLabel)} · ${escapeHtml(f.nameTc)}</span>
      </button>`
      )
      .join("");
  };

  const updateStarBtn = () => {
    const btn = root.querySelector("#bus-star-btn");
    if (!btn) return;
    const like = currentFavLike();
    const on = like && isBusFavorite(selection, like);
    btn.setAttribute("aria-pressed", String(!!on));
    btn.classList.toggle("is-pinned", !!on);
    btn.textContent = on ? "★" : "☆";
    btn.title = on ? "取消常用" : "加到常用";
  };

  const updateFreshLabel = () => {
    const el = root.querySelector("#bus-fresh");
    if (el) el.textContent = freshnessLabel(lastFetchAt);
  };

  const paintShell = () => {
    groups = buildRouteGroups(selection);
    const routes = [...groups.keys()];
    if (mode === "saved") {
      if (!activeRoute || !groups.has(activeRoute)) {
        activeRoute = routes[0] || null;
      }
      const options = groups.get(activeRoute) || [];
      if (
        activeOptionKey !== "__other__" &&
        (!activeOptionKey || !options.some((o) => o.key === activeOptionKey))
      ) {
        activeOptionKey = options[0]?.key || null;
      }
    }
    if (titleEl) {
      titleEl.textContent = `巴士 ${selectionRoutesLabel(selection)}`;
    }

    root.innerHTML = `
      <div class="fav-chip-row" id="bus-fav-chips" aria-label="常用巴士"></div>
      <div class="bus-toolbar">
        <div class="route-tiles" role="tablist" aria-label="已存巴士路線"></div>
        <div class="transit-toolbar-actions">
          <button type="button" class="icon-btn star-btn" id="bus-star-btn" aria-pressed="false" aria-label="釘選常用">☆</button>
          <button type="button" class="icon-btn reverse-btn" id="bus-reverse-btn" aria-label="調轉方向" title="調轉方向">⇄</button>
          ${freshnessBarHtml("bus")}
          <button type="button" class="icon-btn settings-gear" id="bus-settings-btn" aria-label="巴士路線設定">設定</button>
        </div>
      </div>
      <div id="route-options" class="route-options"></div>
      <div id="eta-body"><p class="muted">載入 ETA…</p></div>

      <section class="search-sector" aria-labelledby="bus-search-title">
        <h3 id="bus-search-title" class="search-sector-title">搜尋其他巴士</h3>
        <p class="muted search-sector-hint">輸入路線編號，查其他未儲存嘅站</p>
        <div class="add-form">
          <label class="field">
            <span>路線</span>
            <input id="bus-search-route" type="text" inputmode="text" autocomplete="off" placeholder="例如 71K" maxlength="8" />
          </label>
          <button type="button" class="tab" id="bus-search-load">搜尋</button>
        </div>
        <div id="bus-search-variants" class="add-variants"></div>
        <div id="bus-search-stops"></div>
        <p class="muted" id="bus-search-status"></p>
      </section>

      <p class="device-local-hint">路線設定只存呢部機 · 唔會同步其他裝置</p>
    `;

    paintFavChips();
    root.querySelector("#bus-fav-chips")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fav]");
      if (!btn) return;
      const fav = (selection.favorites || []).find((f) => f.id === btn.dataset.fav);
      if (!fav) return;
      applyFavorite(fav);
    });

    const tiles = root.querySelector(".route-tiles");
    tiles.innerHTML = routes.length
      ? routes
          .map(
            (r) => `
        <button type="button" class="route-tile" role="tab" data-route="${r}"
          aria-selected="${mode !== "search" && r === activeRoute}">${r}</button>`
          )
          .join("")
      : `<span class="muted">未有已存路線</span>`;

    tiles.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-route]");
      if (!btn) return;
      mode = "saved";
      browsePick = null;
      activeRoute = btn.dataset.route;
      const opts = groups.get(activeRoute) || [];
      activeOptionKey = opts[0]?.key || null;
      tiles.querySelectorAll(".route-tile").forEach((t) => {
        t.setAttribute("aria-selected", String(t.dataset.route === activeRoute));
      });
      paintOptions();
      updateStarBtn();
      refresh();
    });

    root.querySelector("#bus-settings-btn").addEventListener("click", () => {
      onOpenSettings?.();
    });

    root.querySelector("#bus-star-btn").addEventListener("click", () => {
      const like = currentFavLike();
      if (!like) {
        onStatus?.("未有可釘選嘅站");
        return;
      }
      persist(toggleBusFavorite(selection, like));
      paintFavChips();
      updateStarBtn();
      onStatus?.(isBusFavorite(selection, like) ? "已加到常用" : "已取消常用");
    });

    refreshCtrl = makeRefreshController({
      button: root.querySelector("#bus-refresh"),
      onRefresh: () => refresh({ force: true }),
    });

    bindSearchSector();
    paintOptions();
    updateStarBtn();
    updateFreshLabel();
  };

  const applyFavorite = (fav) => {
    browsePick = null;
    mode = "saved";
    activeRoute = fav.route;
    groups = buildRouteGroups(selection);
    const options = groups.get(activeRoute) || [];
    const match =
      options.find((o) => o.key === fav.optionKey) ||
      options.find(
        (o) =>
          o.dir.stopId === fav.stopId &&
          (o.dir.bound || "") === (fav.bound || "")
      ) ||
      options.find((o) => o.dir.stopId === fav.stopId);
    if (match) {
      activeOptionKey = match.key;
    } else {
      // Favorite not in saved stops — treat as browse pick
      mode = "search";
      browsePick = {
        route: fav.route,
        stopId: fav.stopId,
        nameTc: fav.nameTc,
        label: `${fav.nameTc} · ${fav.dirLabel}`,
        serviceType: fav.serviceType || "1",
        bound: fav.bound || "",
      };
      activeOptionKey = null;
    }
    paintShell();
    refresh();
  };

  const applySavedDirection = (opt) => {
    activeOptionKey = opt.key;
    mode = "saved";
    browsePick = null;
    paintOptions();
    updateStarBtn();
    const body = root.querySelector("#eta-body");
    if (body) {
      lastHtml = compactEtaCard({
        routeBadge: opt.stop.route,
        dest: destFromDirLabel(opt.dir.label),
        stopName: opt.stop.nameTc,
        items: [],
        reason: "載入緊…",
        extraActions: reverseControlHtml(),
      });
      body.innerHTML = lastHtml;
    }
  };

  const reverseDirection = async () => {
    if (reverseLock) return;
    reverseLock = true;
    onStatus?.("調轉緊…");
    try {
      if (mode === "saved" && activeOptionKey && activeOptionKey !== "__other__") {
        const options = groups.get(activeRoute) || [];
        const opt = options.find((o) => o.key === activeOptionKey);
        if (!opt) {
          onStatus?.("未有方向可調轉");
          return;
        }
        const siblings = options.filter((o) => o.stop.id === opt.stop.id);
        if (siblings.length >= 2) {
          const idx = siblings.findIndex((o) => o.key === opt.key);
          const next = siblings[(idx + 1) % siblings.length];
          applySavedDirection(next);
          await refresh({ force: true });
          onStatus?.(`已調轉：${next.dir.label}`);
          return;
        }
        const serviceType = opt.dir.serviceType || opt.stop.serviceType || "1";
        const bound = opt.dir.bound || "outbound";
        const variants = await fetchRouteVariants(opt.stop.route);
        const other = variants.find(
          (v) => v.serviceType === String(serviceType) && v.bound !== bound
        );
        const opp = await findOppositeDirection(
          opt.stop.route,
          serviceType,
          bound,
          opt.stop.nameTc,
          other?.destTc
        );
        if (!opp || opp.stopId === opt.dir.stopId) {
          onStatus?.("搵唔到反方向車站");
          return;
        }
        const nextSel = structuredClone(selection);
        const stop = nextSel.stops.find((s) => s.id === opt.stop.id);
        if (!stop) {
          onStatus?.("搵唔到反方向車站");
          return;
        }
        if (!stop.directions.some((d) => d.stopId === opp.stopId && d.bound === opp.bound)) {
          stop.directions.push({
            label: opp.label,
            stopId: opp.stopId,
            bound: opp.bound,
            serviceType: opp.serviceType || serviceType,
          });
          persist(saveBusSelection(nextSel));
        }
        groups = buildRouteGroups(selection);
        const flipped = (groups.get(activeRoute) || []).find(
          (o) => o.stop.id === stop.id && o.dir.stopId === opp.stopId && (o.dir.bound || "") === (opp.bound || "")
        );
        if (!flipped) {
          onStatus?.("搵唔到反方向車站");
          return;
        }
        applySavedDirection(flipped);
        await refresh({ force: true });
        onStatus?.(`已調轉：${flipped.dir.label}`);
        return;
      }

      if (browsePick) {
        const serviceType = browsePick.serviceType || "1";
        const bound = browsePick.bound || "outbound";
        const variants = await fetchRouteVariants(browsePick.route);
        const other = variants.find(
          (v) => v.serviceType === String(serviceType) && v.bound !== bound
        );
        const opp = await findOppositeDirection(
          browsePick.route,
          serviceType,
          bound,
          browsePick.nameTc,
          other?.destTc
        );
        if (!opp) {
          onStatus?.("搵唔到反方向車站");
          return;
        }
        browsePick = {
          ...browsePick,
          stopId: opp.stopId,
          label: `${browsePick.nameTc} · ${opp.label}`,
          destTc: other?.destTc || destFromDirLabel(opp.label),
          bound: opp.bound,
          serviceType: opp.serviceType || serviceType,
        };
        await refresh({ force: true });
        onStatus?.(`已調轉：${opp.label}`);
        return;
      }

      onStatus?.("未有方向可調轉");
    } catch (err) {
      onStatus?.(`調轉失敗：${err.message || err}`);
    } finally {
      reverseLock = false;
    }
  };

  const bindReverseOnce = () => {
    if (reverseBound) return;
    reverseBound = true;
    // One delegated tap path. Survives innerHTML swaps and ignores a second click
    // from the same gesture (which would flip the direction straight back).
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("#bus-reverse-btn, [data-eta-reverse]");
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      reverseDirection();
    });
  };

  const paintOptions = () => {
    const box = root.querySelector("#route-options");
    if (!box) return;
    if (!activeRoute || mode === "search") {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const options = groups.get(activeRoute) || [];
    box.hidden = false;
    const otherSelected = activeOptionKey === "__other__";
    box.innerHTML = `
      <p class="route-options-label">${activeRoute} · 揀站／方向</p>
      <div class="route-option-list" role="listbox" aria-label="${activeRoute} 站同方向">
        ${options
          .map(
            (o) => `
          <button type="button" class="route-option" role="option"
            data-opt="${o.key}" aria-selected="${!otherSelected && o.key === activeOptionKey}">
            ${escapeHtml(o.label)}
          </button>`
          )
          .join("")}
        <button type="button" class="route-option route-option-other" role="option"
          data-opt="__other__" aria-selected="${otherSelected}">其他</button>
      </div>
      <div id="other-stops-panel" class="other-stops-panel" ${otherSelected ? "" : "hidden"}></div>
    `;
    box.querySelector(".route-option-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-opt]");
      if (!btn) return;
      activeOptionKey = btn.dataset.opt;
      browsePick = null;
      mode = activeOptionKey === "__other__" ? "other" : "saved";
      box.querySelectorAll(".route-option").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.opt === activeOptionKey));
      });
      const panel = box.querySelector("#other-stops-panel");
      if (activeOptionKey === "__other__") {
        panel.hidden = false;
        loadOtherStops(panel);
      } else {
        panel.hidden = true;
        panel.innerHTML = "";
        updateStarBtn();
        refresh();
      }
    });

    if (otherSelected) {
      loadOtherStops(box.querySelector("#other-stops-panel"));
    }
  };

  const loadOtherStops = async (panel) => {
    if (!panel || !activeRoute) return;
    panel.innerHTML = `<p class="muted">載入 ${activeRoute} 全部車站…</p>`;
    try {
      const variants = await fetchRouteVariants(activeRoute);
      const preferred = variants.filter((v) => v.serviceType === "1");
      const list = preferred.length ? preferred : variants;
      if (!list.length) {
        panel.innerHTML = `<p class="error">搵唔到 ${activeRoute}</p>`;
        return;
      }
      panel.innerHTML = `
        <p class="muted">揀方向，再揀站（唔限已儲存）</p>
        <div class="add-variants" id="other-variants">
          ${list
            .map(
              (v, i) => `
            <button type="button" class="station-btn" data-ov="${i}">${escapeHtml(v.route)} · ${escapeHtml(v.label)}</button>`
            )
            .join("")}
        </div>
        <div id="other-stop-list"></div>
      `;
      let activeV = null;
      let named = [];
      panel.querySelector("#other-variants").addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-ov]");
        if (!btn) return;
        const idx = Number(btn.dataset.ov);
        activeV = list[idx];
        panel.querySelectorAll("[data-ov]").forEach((b) => {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        const stopList = panel.querySelector("#other-stop-list");
        stopList.innerHTML = `<p class="muted">載入車站…</p>`;
        try {
          const rows = await fetchRouteStops(activeV.route, activeV.bound, activeV.serviceType);
          named = await mapStopsWithNames(rows);
          stopList.innerHTML = `
            <div class="stop-check-list other-stop-pick">
              ${named
                .map(
                  (s) => `
                <button type="button" class="route-option" data-ostop="${s.stopId}">${escapeHtml(s.nameTc)}</button>`
                )
                .join("")}
            </div>
          `;
          stopList.querySelector(".other-stop-pick").addEventListener("click", (ev) => {
            const b = ev.target.closest("[data-ostop]");
            if (!b || !activeV) return;
            const meta = named.find((s) => s.stopId === b.dataset.ostop);
            browsePick = {
              route: activeV.route,
              stopId: b.dataset.ostop,
              nameTc: meta?.nameTc || b.dataset.ostop,
              label: `${meta?.nameTc || ""} · 往${activeV.destTc}`,
              serviceType: activeV.serviceType,
              destTc: activeV.destTc,
              bound: activeV.bound,
            };
            mode = "other";
            updateStarBtn();
            refresh();
          });
        } catch (err) {
          stopList.innerHTML = `<p class="error">${escapeHtml(err.message || err)}</p>`;
        }
      });
    } catch (err) {
      panel.innerHTML = `<p class="error">${escapeHtml(err.message || err)}</p>`;
    }
  };

  const bindSearchSector = () => {
    const statusEl = root.querySelector("#bus-search-status");
    const variantsEl = root.querySelector("#bus-search-variants");
    const stopsEl = root.querySelector("#bus-search-stops");
    const input = root.querySelector("#bus-search-route");
    let loaded = [];
    let activeV = null;
    let named = [];

    root.querySelector("#bus-search-load").addEventListener("click", async () => {
      const route = input.value.trim().toUpperCase();
      if (!route) {
        statusEl.textContent = "請輸入路線編號";
        return;
      }
      statusEl.textContent = "搜尋中…";
      variantsEl.innerHTML = "";
      stopsEl.innerHTML = "";
      try {
        loaded = await fetchRouteVariants(route);
        if (!loaded.length) {
          statusEl.textContent = `搵唔到 ${route}`;
          return;
        }
        const preferred = loaded.filter((v) => v.serviceType === "1");
        loaded = preferred.length ? preferred : loaded;
        variantsEl.innerHTML = loaded
          .map(
            (v, i) => `
          <button type="button" class="station-btn" data-sv="${i}">${escapeHtml(v.route)} · ${escapeHtml(v.label)}</button>`
          )
          .join("");
        statusEl.textContent = "揀方向，再揀站";
      } catch (err) {
        statusEl.textContent = `失敗：${err.message || err}`;
      }
    });

    variantsEl.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-sv]");
      if (!btn) return;
      activeV = loaded[Number(btn.dataset.sv)];
      variantsEl.querySelectorAll("[data-sv]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      statusEl.textContent = "載入車站…";
      stopsEl.innerHTML = "";
      try {
        const rows = await fetchRouteStops(activeV.route, activeV.bound, activeV.serviceType);
        named = await mapStopsWithNames(rows);
        stopsEl.innerHTML = `
          <div class="stop-check-list other-stop-pick">
            ${named
              .map(
                (s) => `
              <button type="button" class="route-option" data-sstop="${s.stopId}">${escapeHtml(s.nameTc)}</button>`
              )
              .join("")}
          </div>
        `;
        statusEl.textContent = `已載入 ${named.length} 個站 · 撳站睇 ETA`;
        stopsEl.querySelector(".other-stop-pick").addEventListener("click", (ev) => {
          const b = ev.target.closest("[data-sstop]");
          if (!b || !activeV) return;
          const meta = named.find((s) => s.stopId === b.dataset.sstop);
          mode = "search";
          activeRoute = null;
          root.querySelectorAll(".route-tile").forEach((t) => t.setAttribute("aria-selected", "false"));
          browsePick = {
            route: activeV.route,
            stopId: b.dataset.sstop,
            nameTc: meta?.nameTc || b.dataset.sstop,
            label: `${meta?.nameTc || ""} · 往${activeV.destTc}`,
            serviceType: activeV.serviceType,
            destTc: activeV.destTc,
            bound: activeV.bound,
          };
          paintOptions();
          updateStarBtn();
          refresh();
        });
      } catch (err) {
        statusEl.textContent = `載入車站失敗：${err.message || err}`;
      }
    });
  };

  const reverseControlHtml = () => `
    <div class="eta-card-actions">
      <button type="button" class="reverse-cta" data-eta-reverse aria-label="調轉方向">
        <span aria-hidden="true">⇄</span> 調轉方向
      </button>
    </div>`;

  const renderError = (msg) => {
    const body = root.querySelector("#eta-body");
    if (!body) return;
    body.innerHTML = lastHtml
      ? `${lastHtml}<p class="error">刷新失敗：${escapeHtml(msg)}</p>`
      : `<p class="error">巴士暫無資料：${escapeHtml(msg)}</p>`;
  };

  const refresh = async ({ force = false } = {}) => {
    const body = root.querySelector("#eta-body");
    if (!body || !selection) return;
    const seq = ++refreshSeq;

    const paintCard = (route, dest, stopName, items, reason) => {
      if (seq !== refreshSeq) return;
      lastHtml = compactEtaCard({
        routeBadge: route,
        dest,
        stopName,
        items,
        reason,
        extraActions: reverseControlHtml(),
      });
      body.innerHTML = lastHtml;
      lastFetchAt = Date.now();
      updateFreshLabel();
      updateStarBtn();
    };

    if ((mode === "other" || mode === "search") && browsePick) {
      try {
        const { items, reason } = await loadEtaRows(
          browsePick.stopId,
          browsePick.route,
          browsePick.serviceType || "1"
        );
        if (seq !== refreshSeq) return;
        const dest =
          browsePick.destTc ||
          destFromDirLabel(browsePick.label?.split("·").pop()?.trim() || "") ||
          items[0]?.dest ||
          "—";
        paintCard(browsePick.route, dest, browsePick.nameTc, items, reason);
        onStatus?.("巴士已更新");
      } catch (e) {
        if (seq !== refreshSeq) return;
        renderError(e.message || "網絡錯誤");
        onStatus?.("巴士更新失敗");
      }
      return;
    }

    if (activeOptionKey === "__other__" && !browsePick) {
      body.innerHTML = `<p class="muted">喺上面「其他」揀方向同站，或用下方搜尋</p>`;
      return;
    }

    const options = groups.get(activeRoute) || [];
    const opt = options.find((o) => o.key === activeOptionKey) || options[0];
    if (!opt) {
      body.innerHTML = `<p class="muted">未選擇車站 · 用下方搜尋或其他站</p>`;
      return;
    }

    const { stop, dir } = opt;
    try {
      const serviceType = dir.serviceType || stop.serviceType || "1";
      const { items, reason } = await loadEtaRows(dir.stopId, stop.route, serviceType);
      if (seq !== refreshSeq) return;
      const dest = destFromDirLabel(dir.label) || items[0]?.dest || "—";
      paintCard(stop.route, dest, stop.nameTc, items, reason);
      onStatus?.("巴士已更新");
    } catch (e) {
      if (seq !== refreshSeq) return;
      renderError(e.message || "網絡錯誤");
      onStatus?.("巴士更新失敗");
    }
  };

  const setSelection = (next) => {
    selection = next;
    paintShell();
    refresh();
  };

  const onVis = () => {
    if (document.visibilityState !== "visible") return;
    if (!lastFetchAt || Date.now() - lastFetchAt > 20_000) {
      refresh({ force: true });
    }
  };

  const start = (initial) => {
    bindReverseOnce();
    setSelection(initial);
    if (timer) clearInterval(timer);
    if (freshTimer) clearInterval(freshTimer);
    timer = setInterval(() => refresh(), 45 * 1000);
    freshTimer = setInterval(updateFreshLabel, 1000);
    document.addEventListener("visibilitychange", onVis);
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
    if (freshTimer) clearInterval(freshTimer);
    document.removeEventListener("visibilitychange", onVis);
  };

  return { start, setSelection, refresh, destroy, _base: KMB_BASE };
}
