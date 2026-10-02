import { fetchEta, KMB_BASE } from "./kmbApi.js";
import { selectionRoutesLabel } from "./busStore.js";

function minsUntil(etaIso, now = Date.now()) {
  if (!etaIso) return null;
  const diff = new Date(etaIso).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return 0;
  return Math.round(diff / 60000);
}

/**
 * Bus ETA panel driven by device-local selection.
 * Call `setSelection(next)` after settings change.
 */
export function createBus(root, titleEl, { onStatus, onOpenSettings } = {}) {
  let selection = null;
  let activeStopId = null;
  let lastHtml = "";
  let timer = null;

  const paintShell = () => {
    const stops = selection?.stops || [];
    if (!activeStopId || !stops.some((s) => s.id === activeStopId)) {
      activeStopId = stops[0]?.id || null;
    }
    if (titleEl) {
      titleEl.textContent = `巴士 ${selectionRoutesLabel(selection)}`;
    }
    root.innerHTML = `
      <div class="bus-toolbar">
        <div class="stop-tabs" role="tablist" aria-label="巴士站"></div>
        <button type="button" class="icon-btn settings-gear" id="bus-settings-btn" aria-label="巴士路線設定">設定</button>
      </div>
      <div id="eta-body"><p class="muted">載入 ETA…</p></div>
      <p class="device-local-hint">路線設定只存呢部機 · 唔會同步其他裝置</p>
    `;
    const tabs = root.querySelector(".stop-tabs");
    tabs.innerHTML = stops
      .map(
        (s) => `
        <button type="button" class="tab" role="tab" data-stop="${s.id}"
          aria-selected="${s.id === activeStopId}">${s.route} · ${s.nameTc}</button>`
      )
      .join("");

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-stop]");
      if (!btn) return;
      activeStopId = btn.dataset.stop;
      tabs.querySelectorAll(".tab").forEach((t) => {
        t.setAttribute("aria-selected", String(t.dataset.stop === activeStopId));
      });
      refresh();
    });

    root.querySelector("#bus-settings-btn").addEventListener("click", () => {
      onOpenSettings?.();
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
    const stop = selection.stops.find((s) => s.id === activeStopId);
    if (!stop) {
      body.innerHTML = `<p class="muted">未選擇車站 · 撳「設定」加入</p>`;
      return;
    }

    try {
      const blocks = await Promise.all(
        stop.directions.map(async (dir) => {
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
          return { dir, items };
        })
      );

      lastHtml = blocks
        .map(({ dir, items }) => {
          if (!items.length) {
            return `<div class="eta-dir">${stop.route} · ${dir.label}</div><p class="muted">暫無班次</p>`;
          }
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
          return `<div class="eta-dir">${stop.route} · ${dir.label} · ${stop.nameTc}</div><ul class="eta-list">${list}</ul>`;
        })
        .join('<div style="height:0.55rem"></div>');

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
