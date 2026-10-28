import { fetchMtrSchedule, destLabel } from "./mtrApi.js";
import { MTR_LINES, lineByCode, stationOnLine, lineColor } from "./mtrLines.js";
import {
  saveMtrSelection,
  toggleMtrFavorite,
  isMtrFavorite,
} from "./mtrStore.js";
import { escapeHtml } from "./escapeHtml.js";
import {
  compactEtaCard,
  freshnessBarHtml,
  freshnessLabel,
  makeRefreshController,
} from "./transitUi.js";

function rowsToItems(rows, limit = 3) {
  return (rows || [])
    .filter((r) => r && r.valid !== "N")
    .slice(0, limit)
    .map((r) => {
      const mins =
        r.ttnt === "0" || r.ttnt === 0
          ? 0
          : Number.isFinite(Number(r.ttnt))
            ? Number(r.ttnt)
            : null;
      return {
        mins,
        label: mins === 0 ? "即將到達" : mins == null ? "—" : `${mins} 分鐘`,
        dest: destLabel(r.dest),
        plat: r.plat,
      };
    });
}

function formatNoEta(reason) {
  const r = (reason || "").trim();
  if (r) return `<p class="eta-reason">${escapeHtml(r)}</p>`;
  return `<p class="muted">暫時冇班次</p>`;
}

/**
 * MTR panel: favorites chips, compact UP/DOWN cards, line colours, freshness.
 */
export function createMtr(
  root,
  titleEl,
  { onStatus, onOpenSettings, setSelectionExternal, onSelectionChange, onDigest } = {}
) {
  let selection = null;
  let activeId = null;
  /** Browse state: { line, dir: 'UP'|'DOWN', station } */
  let browse = { line: null, dir: null, station: null };
  let mode = "saved"; // saved | browse
  let mtrDirTab = "BOTH"; // BOTH | UP | DOWN
  let lastHtml = "";
  let timer = null;
  let freshTimer = null;
  let lastFetchAt = 0;
  let refreshCtrl = null;
  let soonest = null;
  let soonSeq = 0;

  const persist = (next) => {
    selection = next;
    setSelectionExternal?.(next);
    onSelectionChange?.(next);
  };

  const activeStation = () => {
    if (mode === "browse" && browse.line && browse.station) {
      return stationOnLine(browse.line, browse.station);
    }
    return selection?.stations?.find((s) => s.id === activeId) || null;
  };

  const paintFavChips = () => {
    const row = root.querySelector("#mtr-fav-chips");
    if (!row) return;
    const favs = selection?.favorites || [];
    if (!favs.length) {
      row.innerHTML = `<span class="muted fav-empty">未有常用 · 撳 ★ 釘選呢個站</span>`;
      return;
    }
    row.innerHTML = favs
      .map((f) => {
        const color = lineColor(f.line);
        return `
        <button type="button" class="fav-chip" data-fav="${escapeHtml(f.id)}"
          aria-label="${escapeHtml(f.lineTc || f.line)} ${escapeHtml(f.nameTc)}">
          <span class="fav-chip-route" style="background:${color}">${escapeHtml(f.line)}</span>
          <span class="fav-chip-meta">${escapeHtml(f.nameTc)}</span>
        </button>`;
      })
      .join("");
  };

  const updateStarBtn = () => {
    const btn = root.querySelector("#mtr-star-btn");
    if (!btn) return;
    const sta = activeStation();
    const on = sta && isMtrFavorite(selection, sta);
    btn.setAttribute("aria-pressed", String(!!on));
    btn.classList.toggle("is-pinned", !!on);
    btn.textContent = on ? "★" : "☆";
    btn.title = on ? "取消常用" : "加到常用";
  };

  const updateFreshLabel = () => {
    const el = root.querySelector("#mtr-fresh");
    if (el) el.textContent = freshnessLabel(lastFetchAt);
  };

  const paintShell = () => {
    const stations = selection?.stations || [];
    if (!activeId || !stations.some((s) => s.id === activeId)) {
      activeId = stations[0]?.id || null;
    }
    if (titleEl) titleEl.textContent = "港鐵";

    root.innerHTML = `
      <div class="fav-chip-row" id="mtr-fav-chips" aria-label="常用港鐵"></div>
      <div class="bus-toolbar">
        <div class="stop-tabs mtr-tabs" role="tablist" aria-label="已存港鐵站"></div>
        <div class="transit-toolbar-actions">
          <button type="button" class="icon-btn star-btn" id="mtr-star-btn" aria-pressed="false" aria-label="釘選常用">☆</button>
          ${freshnessBarHtml("mtr")}
          <button type="button" class="icon-btn settings-gear" id="mtr-settings-btn" aria-label="港鐵站設定">設定</button>
        </div>
      </div>
      <div id="mtr-body"><p class="muted">載入班次…</p></div>

      <section class="search-sector" aria-labelledby="mtr-search-title">
        <h3 id="mtr-search-title" class="search-sector-title">搜尋其他港鐵</h3>
        <p class="muted search-sector-hint">按次序：綫 → 方向 → 車站</p>
        <div id="mtr-wizard" class="mtr-wizard"></div>
      </section>

      <p class="device-local-hint">港鐵站只存呢部裝置 · 公開 Next Train API</p>
    `;

    paintFavChips();
    root.querySelector("#mtr-fav-chips")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fav]");
      if (!btn) return;
      const fav = (selection.favorites || []).find((f) => f.id === btn.dataset.fav);
      if (!fav) return;
      mode = "saved";
      browse = { line: null, dir: null, station: null };
      // Ensure station exists in selection for display
      if (!selection.stations.some((s) => s.id === fav.id)) {
        const meta = stationOnLine(fav.line, fav.sta);
        if (meta) {
          const next = structuredClone(selection);
          next.stations.push(meta);
          persist(saveMtrSelection(next));
        }
      }
      activeId = fav.id;
      paintShell();
      refresh();
    });

    const tabs = root.querySelector(".mtr-tabs");
    if (!stations.length) {
      tabs.innerHTML = `<span class="muted">未有已存站</span>`;
    } else {
      tabs.innerHTML = stations
        .map((s) => {
          const color = lineColor(s.line);
          return `
        <button type="button" class="tab mtr-sta-tab" role="tab" data-mtr="${s.id}"
          aria-selected="${mode === "saved" && s.id === activeId}">
          <span class="mtr-tab-dot" style="background:${color}"></span>${escapeHtml(s.nameTc)}
        </button>`;
        })
        .join("");
    }

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mtr]");
      if (!btn) return;
      mode = "saved";
      activeId = btn.dataset.mtr;
      browse = { line: null, dir: null, station: null };
      mtrDirTab = "BOTH";
      tabs.querySelectorAll(".tab").forEach((t) => {
        t.setAttribute("aria-selected", String(t.dataset.mtr === activeId));
      });
      paintWizard();
      updateStarBtn();
      refresh();
    });

    root.querySelector("#mtr-settings-btn").addEventListener("click", () => {
      onOpenSettings?.();
    });

    root.querySelector("#mtr-star-btn").addEventListener("click", () => {
      const sta = activeStation();
      if (!sta) {
        onStatus?.("未有可釘選嘅站");
        return;
      }
      persist(toggleMtrFavorite(selection, sta));
      paintFavChips();
      updateStarBtn();
      onStatus?.(isMtrFavorite(selection, sta) ? "已加到常用" : "已取消常用");
    });

    refreshCtrl = makeRefreshController({
      button: root.querySelector("#mtr-refresh"),
      onRefresh: () => refresh({ force: true }),
    });

    paintWizard();
    updateStarBtn();
    updateFreshLabel();
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
              <span class="mtr-tab-dot" style="background:${lineColor(l.code)}"></span>
              ${escapeHtml(l.nameTc)}<small>${l.code}</small>
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
        if (body) {
          body.innerHTML = `<p class="muted">已選 ${escapeHtml(lineByCode(browse.line)?.nameTc || "")} · 再揀方向</p>`;
        }
      });
      return;
    }

    if (!browse.dir) {
      box.innerHTML = `
        <p class="wizard-step">② ${escapeHtml(line.nameTc)} · 揀方向
          <button type="button" class="ghost-btn" id="mtr-wiz-back-line">返回揀綫</button>
        </p>
        <div class="add-variants">
          <button type="button" class="station-btn" data-dir="UP">${escapeHtml(line.upLabel)}</button>
          <button type="button" class="station-btn" data-dir="DOWN">${escapeHtml(line.downLabel)}</button>
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
      <p class="wizard-step">③ ${escapeHtml(line.nameTc)} · ${escapeHtml(dirLabel)} · 揀站
        <button type="button" class="ghost-btn" id="mtr-wiz-back-dir">返回方向</button>
      </p>
      <div class="place-grid mtr-sta-grid">
        ${line.stations
          .map(
            (s) => `
          <button type="button" class="place-chip" data-sta="${s.sta}"
            aria-pressed="${browse.station === s.sta}">${escapeHtml(s.nameTc)}</button>`
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
      updateStarBtn();
      refresh();
    });
    box.querySelector("#mtr-save-browse")?.addEventListener("click", () => {
      const meta = stationOnLine(browse.line, browse.station);
      if (!meta || !selection) return;
      const next = structuredClone(selection);
      if (!next.stations.some((s) => s.id === meta.id)) {
        next.stations.push(meta);
        persist(saveMtrSelection(next));
        activeId = meta.id;
        mode = "saved";
        browse = { line: null, dir: null, station: null };
        paintShell();
        refresh();
        onStatus?.("已儲存港鐵站（本機）");
      } else {
        browse = { line: null, dir: null, station: null };
        paintWizard();
        onStatus?.("呢個站已喺已存列表");
      }
    });
  };

  const dirTabsHtml = (line, active) => `
    <div class="mtr-dir-tabs" role="tablist" aria-label="方向">
      <button type="button" class="mtr-dir-tab" data-dir-tab="BOTH" aria-selected="${active === "BOTH"}">兩邊</button>
      <button type="button" class="mtr-dir-tab" data-dir-tab="UP" aria-selected="${active === "UP"}">${escapeHtml(line?.upLabel || "上行")}</button>
      <button type="button" class="mtr-dir-tab" data-dir-tab="DOWN" aria-selected="${active === "DOWN"}">${escapeHtml(line?.downLabel || "下行")}</button>
    </div>`;

  const renderDirCards = ({ line, stationName, up, down, reason, statusFailed, delayed, color }) => {
    if (statusFailed) {
      return `${dirTabsHtml(line, mtrDirTab)}${formatNoEta(reason)}`;
    }
    const notice =
      delayed && reason ? `<p class="eta-reason">${escapeHtml(reason)}</p>` : "";
    const upItems = rowsToItems(up);
    const downItems = rowsToItems(down);
    const upDest = upItems[0]?.dest || destFromLabel(line?.upLabel);
    const downDest = downItems[0]?.dest || destFromLabel(line?.downLabel);
    const upPlat = upItems[0]?.plat;
    const downPlat = downItems[0]?.plat;

    const upCard = compactEtaCard({
      routeBadge: line?.code || "",
      badgeColor: color,
      dest: upDest,
      stopName: `${stationName} · ${line?.upLabel || "上行"}`,
      items: upItems,
      reason: !upItems.length ? reason : "",
      plat: upPlat,
    });
    const downCard = compactEtaCard({
      routeBadge: line?.code || "",
      badgeColor: color,
      dest: downDest,
      stopName: `${stationName} · ${line?.downLabel || "下行"}`,
      items: downItems,
      reason: !downItems.length ? reason : "",
      plat: downPlat,
    });

    let cards = "";
    if (mtrDirTab === "UP") cards = upCard;
    else if (mtrDirTab === "DOWN") cards = downCard;
    else cards = `<div class="mtr-eta-pair">${upCard}${downCard}</div>`;

    return `${dirTabsHtml(line, mtrDirTab)}${notice}${cards}`;
  };

  const destFromLabel = (label) => String(label || "").replace(/^往\s*/, "") || "—";

  const bindDirTabs = (body) => {
    body.querySelector(".mtr-dir-tabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dir-tab]");
      if (!btn) return;
      mtrDirTab = btn.dataset.dirTab;
      refresh({ force: true });
    });
  };

  const sampleSoonest = async () => {
    const seq = ++soonSeq;
    const stations = (selection?.stations || []).slice(0, 6);
    let best = null;
    for (const sta of stations) {
      try {
        const sched = await fetchMtrSchedule(sta.line, sta.sta);
        const rows = [...(sched?.up || []), ...(sched?.down || [])];
        for (const row of rows) {
          if (row?.valid === "N") continue;
          const mins = row.ttnt === "0" || row.ttnt === 0 ? 0 : Number(row.ttnt);
          if (!Number.isFinite(mins)) continue;
          if (!best || mins < best.mins) {
            const when = mins === 0 ? "即將" : `${mins}分`;
            best = { mins, text: `${sta.nameTc} ${when}` };
          }
        }
      } catch {
        /* keep the best row found so far */
      }
    }
    if (seq !== soonSeq) return;
    soonest = best;
    onDigest?.();
  };

  const refresh = async ({ force = false } = {}) => {
    const body = root.querySelector("#mtr-body");
    if (!body || !selection) return;

    if (mode === "browse" && browse.line && browse.dir && browse.station) {
      const line = lineByCode(browse.line);
      const staMeta = line?.stations.find((s) => s.sta === browse.station);
      try {
        const sched = await fetchMtrSchedule(browse.line, browse.station);
        const { up = [], down = [], reason, statusFailed, delayed } = sched || {};
        const rows = browse.dir === "UP" ? up : down;
        const items = rowsToItems(rows);
        const color = lineColor(browse.line);
        lastHtml = compactEtaCard({
          routeBadge: line?.code || browse.line,
          badgeColor: color,
          dest: items[0]?.dest || destFromLabel(browse.dir === "UP" ? line?.upLabel : line?.downLabel),
          stopName: staMeta?.nameTc || browse.station,
          items,
          reason: statusFailed || !items.length ? reason : "",
          plat: items[0]?.plat,
        });
        if (delayed && reason) {
          lastHtml = `<p class="eta-reason">${escapeHtml(reason)}</p>${lastHtml}`;
        }
        body.innerHTML = lastHtml;
        lastFetchAt = Date.now();
        updateFreshLabel();
        updateStarBtn();
        onStatus?.("港鐵已更新");
      } catch (e) {
        body.innerHTML = `<p class="error">港鐵暫無資料：${escapeHtml(e.message || e)}</p>`;
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
      const sched = await fetchMtrSchedule(station.line, station.sta);
      const { up = [], down = [], reason, statusFailed, delayed } = sched || {};
      const line = lineByCode(station.line);
      const color = lineColor(station.line);
      lastHtml = renderDirCards({
        line,
        stationName: station.nameTc,
        up,
        down,
        reason,
        statusFailed,
        delayed,
        color,
      });
      body.innerHTML = lastHtml;
      bindDirTabs(body);
      lastFetchAt = Date.now();
      updateFreshLabel();
      updateStarBtn();
      onStatus?.("港鐵已更新");
      sampleSoonest();
    } catch (e) {
      body.innerHTML = lastHtml
        ? `${lastHtml}<p class="error">刷新失敗：${escapeHtml(e.message || e)}</p>`
        : `<p class="error">港鐵暫無資料：${escapeHtml(e.message || e)}</p>`;
      onStatus?.("港鐵更新失敗");
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
    setSelection(initial);
    if (timer) clearInterval(timer);
    if (freshTimer) clearInterval(freshTimer);
    timer = setInterval(() => refresh(), 30 * 1000);
    freshTimer = setInterval(updateFreshLabel, 1000);
    document.addEventListener("visibilitychange", onVis);
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
    if (freshTimer) clearInterval(freshTimer);
    document.removeEventListener("visibilitychange", onVis);
  };

  return { start, setSelection, refresh, destroy, getSoonest: () => soonest };
}
