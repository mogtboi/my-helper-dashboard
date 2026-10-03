import { fetchMtrSchedule, destLabel } from "./mtrApi.js";

function formatRows(rows, limit = 3) {
  const valid = (rows || []).filter((r) => r && r.valid !== "N").slice(0, limit);
  if (!valid.length) return `<p class="muted">暫無班次</p>`;
  return `<ul class="eta-list">${valid
    .map((r) => {
      const mins = r.ttnt === "0" || r.ttnt === 0 ? "即將到達" : `${r.ttnt} 分鐘`;
      const dest = destLabel(r.dest);
      const plat = r.plat ? ` · 月台 ${r.plat}` : "";
      return `<li class="eta-item">
        <span class="eta-dest">往${dest}${plat}</span>
        <span class="eta-mins">${mins}</span>
      </li>`;
    })
    .join("")}</ul>`;
}

/**
 * MTR Next Train panel. Selection is device-local.
 */
export function createMtr(root, titleEl, { onStatus, onOpenSettings } = {}) {
  let selection = null;
  let activeId = null;
  let lastHtml = "";
  let timer = null;

  const paintShell = () => {
    const stations = selection?.stations || [];
    if (!activeId || !stations.some((s) => s.id === activeId)) {
      activeId = stations[0]?.id || null;
    }
    if (titleEl) titleEl.textContent = "港鐵";
    root.innerHTML = `
      <div class="bus-toolbar">
        <div class="stop-tabs mtr-tabs" role="tablist" aria-label="港鐵站"></div>
        <button type="button" class="icon-btn settings-gear" id="mtr-settings-btn" aria-label="港鐵站設定">設定</button>
      </div>
      <div id="mtr-body"><p class="muted">載入班次…</p></div>
      <p class="device-local-hint">港鐵站只存呢部機 · 公開 Next Train API</p>
    `;
    const tabs = root.querySelector(".mtr-tabs");
    if (!stations.length) {
      tabs.innerHTML = `<span class="muted">未選站</span>`;
    } else {
      tabs.innerHTML = stations
        .map(
          (s) => `
        <button type="button" class="tab" role="tab" data-mtr="${s.id}"
          aria-selected="${s.id === activeId}">${s.nameTc}</button>`
        )
        .join("");
    }

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mtr]");
      if (!btn) return;
      activeId = btn.dataset.mtr;
      tabs.querySelectorAll(".tab").forEach((t) => {
        t.setAttribute("aria-selected", String(t.dataset.mtr === activeId));
      });
      refresh();
    });

    root.querySelector("#mtr-settings-btn").addEventListener("click", () => {
      onOpenSettings?.();
    });
  };

  const refresh = async () => {
    const body = root.querySelector("#mtr-body");
    if (!body || !selection) return;
    const station = selection.stations.find((s) => s.id === activeId);
    if (!station) {
      body.innerHTML = `<p class="muted">未選擇車站 · 撳「設定」加入</p>`;
      return;
    }
    try {
      const { up, down } = await fetchMtrSchedule(station.line, station.sta);
      lastHtml = `
        <div class="eta-dir">${station.lineTc || station.line} · ${station.nameTc} · 上行</div>
        ${formatRows(up)}
        <div style="height:0.55rem"></div>
        <div class="eta-dir">${station.lineTc || station.line} · ${station.nameTc} · 下行</div>
        ${formatRows(down)}
      `;
      body.innerHTML = lastHtml;
      onStatus?.("港鐵已更新");
    } catch (e) {
      body.innerHTML = lastHtml
        ? `${lastHtml}<p class="error">刷新失敗：${e.message || e}</p>`
        : `<p class="error">港鐵暫無資料：${e.message || e}</p>
           <p class="muted">若瀏覽器封鎖跨域，請稍後再試或改用其他網絡。</p>`;
      onStatus?.("港鐵更新失敗");
    }
  };

  const setSelection = (next) => {
    selection = next;
    paintShell();
    refresh();
  };

  const onVis = () => {
    if (document.visibilityState === "visible") refresh();
  };

  const start = (initial) => {
    setSelection(initial);
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 30 * 1000);
    document.addEventListener("visibilitychange", onVis);
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  };

  return { start, setSelection, refresh, destroy };
}
