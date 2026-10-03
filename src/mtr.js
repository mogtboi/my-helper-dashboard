import { fetchMtrSchedule, destLabel } from "./mtrApi.js";
import { MTR_LINES, lineByCode, stationOnLine } from "./mtrLines.js";
import { saveMtrSelection } from "./mtrStore.js";

function formatRows(rows, limit = 4) {
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
 * MTR panel: saved quick picks + line → direction → station browse/search.
 */
export function createMtr(root, titleEl, { onStatus, onOpenSettings, getSelection, setSelectionExternal, onSelectionChange } = {}) {
  let selection = null;
  let activeId = null;
  /** Browse state: { line, dir: 'UP'|'DOWN', station } */
  let browse = { line: null, dir: null, station: null };
  let mode = "saved"; // saved | browse
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
        <div class="stop-tabs mtr-tabs" role="tablist" aria-label="已存港鐵站"></div>
        <button type="button" class="icon-btn settings-gear" id="mtr-settings-btn" aria-label="港鐵站設定">設定</button>
      </div>
      <div id="mtr-body"><p class="muted">載入班次…</p></div>

      <section class="search-sector" aria-labelledby="mtr-search-title">
        <h3 id="mtr-search-title" class="search-sector-title">搜尋其他港鐵</h3>
        <p class="muted search-sector-hint">按次序：綫 → 方向 → 車站</p>
        <div id="mtr-wizard" class="mtr-wizard"></div>
      </section>

      <p class="device-local-hint">港鐵站只存呢部機 · 公開 Next Train API</p>
    `;

    const tabs = root.querySelector(".mtr-tabs");
    if (!stations.length) {
      tabs.innerHTML = `<span class="muted">未有已存站</span>`;
    } else {
      tabs.innerHTML = stations
        .map(
          (s) => `
        <button type="button" class="tab" role="tab" data-mtr="${s.id}"
          aria-selected="${mode === "saved" && s.id === activeId}">${s.nameTc}</button>`
        )
        .join("");
    }

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mtr]");
      if (!btn) return;
      mode = "saved";
      activeId = btn.dataset.mtr;
      browse = { line: null, dir: null, station: null };
      tabs.querySelectorAll(".tab").forEach((t) => {
        t.setAttribute("aria-selected", String(t.dataset.mtr === activeId));
      });
      paintWizard();
      refresh();
    });

    root.querySelector("#mtr-settings-btn").addEventListener("click", () => {
      onOpenSettings?.();
    });

    paintWizard();
  };

  const paintWizard = () => {
    const box = root.querySelector("#mtr-wizard");
    if (!box) return;
    const line = browse.line ? lineByCode(browse.line) : null;

    if (!browse.line) {
      box.innerHTML = `
        <p class="wizard-step">① 揀綫</p>
        <div class="place-grid mtr-line-grid">
          ${MTR_LINES.map(
            (l) => `
            <button type="button" class="place-chip" data-line="${l.code}">
              ${l.nameTc}<small>${l.code}</small>
            </button>`
          ).join("")}
        </div>
      `;
      box.querySelector(".mtr-line-grid").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-line]");
        if (!btn) return;
        browse = { line: btn.dataset.line, dir: null, station: null };
        mode = "browse";
        root.querySelectorAll(".mtr-tabs .tab").forEach((t) => t.setAttribute("aria-selected", "false"));
        paintWizard();
        const body = root.querySelector("#mtr-body");
        if (body) body.innerHTML = `<p class="muted">已選 ${lineByCode(browse.line)?.nameTc} · 再揀方向</p>`;
      });
      return;
    }

    if (!browse.dir) {
      box.innerHTML = `
        <p class="wizard-step">② ${line.nameTc} · 揀方向
          <button type="button" class="ghost-btn" id="mtr-wiz-back-line">返回揀綫</button>
        </p>
        <div class="add-variants">
          <button type="button" class="station-btn" data-dir="UP">${line.upLabel}</button>
          <button type="button" class="station-btn" data-dir="DOWN">${line.downLabel}</button>
        </div>
      `;
      box.querySelector("#mtr-wiz-back-line").addEventListener("click", () => {
        browse = { line: null, dir: null, station: null };
        paintWizard();
      });
      box.querySelectorAll("[data-dir]").forEach((btn) => {
        btn.addEventListener("click", () => {
          browse = { ...browse, dir: btn.dataset.dir, station: null };
          paintWizard();
          const body = root.querySelector("#mtr-body");
          if (body) body.innerHTML = `<p class="muted">已選方向 · 再揀車站</p>`;
        });
      });
      return;
    }

    const dirLabel = browse.dir === "UP" ? line.upLabel : line.downLabel;
    box.innerHTML = `
      <p class="wizard-step">③ ${line.nameTc} · ${dirLabel} · 揀站
        <button type="button" class="ghost-btn" id="mtr-wiz-back-dir">返回方向</button>
      </p>
      <div class="place-grid mtr-sta-grid">
        ${line.stations
          .map(
            (s) => `
          <button type="button" class="place-chip" data-sta="${s.sta}"
            aria-pressed="${browse.station === s.sta}">${s.nameTc}</button>`
          )
          .join("")}
      </div>
      <button type="button" class="ghost-btn" id="mtr-save-browse" ${browse.station ? "" : "hidden"}>儲存呢個站到本機</button>
    `;
    box.querySelector("#mtr-wiz-back-dir").addEventListener("click", () => {
      browse = { ...browse, dir: null, station: null };
      paintWizard();
    });
    box.querySelector(".mtr-sta-grid").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sta]");
      if (!btn) return;
      browse = { ...browse, station: btn.dataset.sta };
      mode = "browse";
      root.querySelectorAll(".mtr-tabs .tab").forEach((t) => t.setAttribute("aria-selected", "false"));
      paintWizard();
      refresh();
    });
    box.querySelector("#mtr-save-browse")?.addEventListener("click", () => {
      const meta = stationOnLine(browse.line, browse.station);
      if (!meta || !selection) return;
      const next = structuredClone(selection);
      if (!next.stations.some((s) => s.id === meta.id)) {
        next.stations.push(meta);
        saveMtrSelection(next);
        selection = next;
        setSelectionExternal?.(next);
        onSelectionChange?.(next);
        activeId = meta.id;
        mode = "saved";
        paintShell();
        refresh();
        onStatus?.("已儲存港鐵站（本機）");
      } else {
        onStatus?.("呢個站已喺已存列表");
      }
    });
  };

  const refresh = async () => {
    const body = root.querySelector("#mtr-body");
    if (!body || !selection) return;

    if (mode === "browse" && browse.line && browse.dir && browse.station) {
      const line = lineByCode(browse.line);
      const staMeta = line?.stations.find((s) => s.sta === browse.station);
      const dirLabel = browse.dir === "UP" ? line?.upLabel : line?.downLabel;
      try {
        const { up, down } = await fetchMtrSchedule(browse.line, browse.station);
        const rows = browse.dir === "UP" ? up : down;
        lastHtml = `
          <div class="eta-dir">${line?.nameTc} · ${staMeta?.nameTc || browse.station} · ${dirLabel}</div>
          ${formatRows(rows)}
        `;
        body.innerHTML = lastHtml;
        onStatus?.("港鐵已更新");
      } catch (e) {
        body.innerHTML = `<p class="error">港鐵暫無資料：${e.message || e}</p>`;
        onStatus?.("港鐵更新失敗");
      }
      return;
    }

    const station = selection.stations.find((s) => s.id === activeId);
    if (!station) {
      body.innerHTML = `<p class="muted">未選擇車站 · 用下方搜尋揀綫／方向／站</p>`;
      return;
    }
    try {
      const { up, down } = await fetchMtrSchedule(station.line, station.sta);
      const line = lineByCode(station.line);
      lastHtml = `
        <div class="eta-dir">${station.lineTc || station.line} · ${station.nameTc} · ${line?.upLabel || "上行"}</div>
        ${formatRows(up)}
        <div style="height:0.55rem"></div>
        <div class="eta-dir">${station.lineTc || station.line} · ${station.nameTc} · ${line?.downLabel || "下行"}</div>
        ${formatRows(down)}
      `;
      body.innerHTML = lastHtml;
      onStatus?.("港鐵已更新");
    } catch (e) {
      body.innerHTML = lastHtml
        ? `${lastHtml}<p class="error">刷新失敗：${e.message || e}</p>`
        : `<p class="error">港鐵暫無資料：${e.message || e}</p>`;
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
