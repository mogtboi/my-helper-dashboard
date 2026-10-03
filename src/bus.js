import { fetchEta, KMB_BASE } from "./kmbApi.js";
import { selectionRoutesLabel } from "./busStore.js";

function minsUntil(etaIso, now = Date.now()) {
  if (!etaIso) return null;
  const diff = new Date(etaIso).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return 0;
  return Math.round(diff / 60000);
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
 * Bus ETA panel — one tile per route; expand for stop/direction options.
 */
export function createBus(root, titleEl, { onStatus, onOpenSettings } = {}) {
  let selection = null;
  let activeRoute = null;
  let activeOptionKey = null;
  let lastHtml = "";
  let timer = null;
  let groups = new Map();

  const paintShell = () => {
    groups = buildRouteGroups(selection);
    const routes = [...groups.keys()];
    if (!activeRoute || !groups.has(activeRoute)) {
      activeRoute = routes[0] || null;
    }
    const options = groups.get(activeRoute) || [];
    if (!activeOptionKey || !options.some((o) => o.key === activeOptionKey)) {
      activeOptionKey = options[0]?.key || null;
    }
    if (titleEl) {
      titleEl.textContent = `巴士 ${selectionRoutesLabel(selection)}`;
    }

    const multi = options.length > 1;
    root.innerHTML = `
      <div class="bus-toolbar">
        <div class="route-tiles" role="tablist" aria-label="巴士路線"></div>
        <button type="button" class="icon-btn settings-gear" id="bus-settings-btn" aria-label="巴士路線設定">設定</button>
      </div>
      <div id="route-options" class="route-options" ${multi ? "" : "hidden"}></div>
      <div id="eta-body"><p class="muted">載入 ETA…</p></div>
      <p class="device-local-hint">路線設定只存呢部機 · 唔會同步其他裝置</p>
    `;

    const tiles = root.querySelector(".route-tiles");
    tiles.innerHTML = routes.length
      ? routes
          .map(
            (r) => `
        <button type="button" class="route-tile" role="tab" data-route="${r}"
          aria-selected="${r === activeRoute}">${r}</button>`
          )
          .join("")
      : `<span class="muted">未選路線</span>`;

    tiles.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-route]");
      if (!btn) return;
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

    paintOptions();
  };

  const paintOptions = () => {
    const box = root.querySelector("#route-options");
    if (!box) return;
    const options = groups.get(activeRoute) || [];
    if (options.length <= 1) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = `
      <p class="route-options-label">${activeRoute} · 揀站／方向</p>
      <div class="route-option-list" role="listbox" aria-label="${activeRoute} 站同方向">
        ${options
          .map(
            (o) => `
          <button type="button" class="route-option" role="option"
            data-opt="${o.key}" aria-selected="${o.key === activeOptionKey}">
            ${o.label}
          </button>`
          )
          .join("")}
      </div>
    `;
    box.querySelector(".route-option-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-opt]");
      if (!btn) return;
      activeOptionKey = btn.dataset.opt;
      box.querySelectorAll(".route-option").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.opt === activeOptionKey));
      });
      refresh();
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
    const options = groups.get(activeRoute) || [];
    const opt = options.find((o) => o.key === activeOptionKey) || options[0];
    if (!opt) {
      body.innerHTML = `<p class="muted">未選擇車站 · 撳「設定」加入</p>`;
      return;
    }

    const { stop, dir } = opt;
    try {
      const serviceType = dir.serviceType || stop.serviceType || "1";
      const rows = await fetchEta(dir.stopId, stop.route, serviceType);
      const now = Date.now();
      const items = rows
        .map((r) => ({
          dest: r.dest_tc,
          eta: r.eta,
          mins: minsUntil(r.eta, now),
          rmk: r.rmk_tc,
        }))
        .filter((r) => r.eta)
        .slice(0, 3);

      if (!items.length) {
        lastHtml = `<div class="eta-dir">${stop.route} · ${opt.label}</div><p class="muted">暫無班次</p>`;
      } else {
        const list = items
          .map((it) => {
            const label =
              it.mins === 0 ? "即將到達" : it.mins == null ? "—" : `${it.mins} 分鐘`;
            return `<li class="eta-item">
              <span class="eta-dest">${it.dest}${it.rmk ? ` · ${it.rmk}` : ""}</span>
              <span class="eta-mins">${label}</span>
            </li>`;
          })
          .join("");
        lastHtml = `<div class="eta-dir">${stop.route} · ${opt.label}</div><ul class="eta-list">${list}</ul>`;
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
