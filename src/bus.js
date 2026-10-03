import {
  fetchEta,
  fetchRouteVariants,
  fetchRouteStops,
  mapStopsWithNames,
  KMB_BASE,
} from "./kmbApi.js";
import { selectionRoutesLabel } from "./busStore.js";

function minsUntil(etaIso, now = Date.now()) {
  if (!etaIso) return null;
  const diff = new Date(etaIso).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return 0;
  return Math.round(diff / 60000);
}

function formatEtaItems(items) {
  return items
    .map((it) => {
      const label =
        it.mins === 0 ? "即將到達" : it.mins == null ? "—" : `${it.mins} 分鐘`;
      return `<li class="eta-item">
        <span class="eta-dest">${it.dest}${it.rmk ? ` · ${it.rmk}` : ""}</span>
        <span class="eta-mins">${label}</span>
      </li>`;
    })
    .join("");
}

async function loadEtaRows(stopId, route, serviceType) {
  const rows = await fetchEta(stopId, route, serviceType);
  const now = Date.now();
  return rows
    .map((r) => ({
      dest: r.dest_tc,
      eta: r.eta,
      mins: minsUntil(r.eta, now),
      rmk: r.rmk_tc,
    }))
    .filter((r) => r.eta)
    .slice(0, 3);
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

/**
 * Bus ETA panel — saved route tiles, 「其他」for unsaved stops, + search sector.
 */
export function createBus(root, titleEl, { onStatus, onOpenSettings } = {}) {
  let selection = null;
  let activeRoute = null;
  let activeOptionKey = null;
  /** Ephemeral browse: { route, stopId, nameTc, label, serviceType } */
  let browsePick = null;
  let mode = "saved"; // saved | other | search
  let lastHtml = "";
  let timer = null;
  let groups = new Map();

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
      <div class="bus-toolbar">
        <div class="route-tiles" role="tablist" aria-label="已存巴士路線"></div>
        <button type="button" class="icon-btn settings-gear" id="bus-settings-btn" aria-label="巴士路線設定">設定</button>
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
      refresh();
    });

    root.querySelector("#bus-settings-btn").addEventListener("click", () => {
      onOpenSettings?.();
    });

    bindSearchSector();
    paintOptions();
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
            ${o.label}
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
            <button type="button" class="station-btn" data-ov="${i}">${v.route} · ${v.label}</button>`
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
                <button type="button" class="route-option" data-ostop="${s.stopId}">${s.nameTc}</button>`
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
            };
            mode = "other";
            refresh();
          });
        } catch (err) {
          stopList.innerHTML = `<p class="error">${err.message || err}</p>`;
        }
      });
    } catch (err) {
      panel.innerHTML = `<p class="error">${err.message || err}</p>`;
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
          <button type="button" class="station-btn" data-sv="${i}">${v.route} · ${v.label}</button>`
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
              <button type="button" class="route-option" data-sstop="${s.stopId}">${s.nameTc}</button>`
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
          };
          paintOptions();
          refresh();
        });
      } catch (err) {
        statusEl.textContent = `載入車站失敗：${err.message || err}`;
      }
    });
  };

  const renderError = (msg) => {
    const body = root.querySelector("#eta-body");
    if (!body) return;
    body.innerHTML = lastHtml
      ? `${lastHtml}<p class="error">刷新失敗：${msg}</p>`
      : `<p class="error">巴士暫無資料：${msg}</p>`;
  };

  const refresh = async () => {
    const body = root.querySelector("#eta-body");
    if (!body || !selection) return;

    if ((mode === "other" || mode === "search") && browsePick) {
      try {
        const items = await loadEtaRows(
          browsePick.stopId,
          browsePick.route,
          browsePick.serviceType || "1"
        );
        if (!items.length) {
          lastHtml = `<div class="eta-dir">${browsePick.route} · ${browsePick.label}</div><p class="muted">暫無班次</p>`;
        } else {
          lastHtml = `<div class="eta-dir">${browsePick.route} · ${browsePick.label}</div><ul class="eta-list">${formatEtaItems(items)}</ul>`;
        }
        body.innerHTML = lastHtml;
        onStatus?.("巴士已更新");
      } catch (e) {
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
      const items = await loadEtaRows(dir.stopId, stop.route, serviceType);
      if (!items.length) {
        lastHtml = `<div class="eta-dir">${stop.route} · ${opt.label}</div><p class="muted">暫無班次</p>`;
      } else {
        lastHtml = `<div class="eta-dir">${stop.route} · ${opt.label}</div><ul class="eta-list">${formatEtaItems(items)}</ul>`;
      }
      body.innerHTML = lastHtml;
      onStatus?.("巴士已更新");
    } catch (e) {
      renderError(e.message || "網絡錯誤");
      onStatus?.("巴士更新失敗");
    }
  };

  const setSelection = (next) => {
    selection = next;
    paintShell();
    refresh();
  };

  const start = (initial) => {
    setSelection(initial);
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 45 * 1000);
    document.addEventListener("visibilitychange", onVis);
  };

  const onVis = () => {
    if (document.visibilityState === "visible") refresh();
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  };

  return { start, setSelection, refresh, destroy, _base: KMB_BASE };
}
