import {
  saveBusSelection,
  clearBusSelection,
  makeStopId,
} from "./busStore.js";
import {
  fetchRouteVariants,
  fetchRouteStops,
  mapStopsWithNames,
  findOppositeDirection,
} from "./kmbApi.js";
import { WEATHER_DISTRICTS, districtById, saveWeatherPlace } from "./weatherStore.js";
import {
  MTR_STATION_CATALOG,
  saveMtrSelection,
  clearMtrSelection,
  catalogById,
} from "./mtrStore.js";

/**
 * Unified settings sheet: weather region, bus routes, MTR stations.
 * All persistence is localStorage on this device only.
 */
export function createAppSettings({
  overlayRoot,
  getBusSelection,
  setBusSelection,
  onBusChange,
  getWeatherPlace,
  onWeatherPlaceChange,
  getMtrSelection,
  setMtrSelection,
  onMtrChange,
}) {
  const open = (focus = "bus") => {
    overlayRoot.hidden = false;
    overlayRoot.innerHTML = `
      <div class="settings-backdrop" data-close></div>
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="app-settings-title">
        <header class="settings-head">
          <h2 id="app-settings-title">設定</h2>
          <button type="button" class="icon-btn" data-close aria-label="關閉">✕</button>
        </header>
        <p class="settings-note">
          所有設定只保存在<strong>呢部手機／瀏覽器</strong>（localStorage）。
          唔會上雲、唔會同步去第二部機。
        </p>

        <nav class="settings-tabs" role="tablist" aria-label="設定分類">
          <button type="button" class="settings-tab" data-panel="weather" aria-selected="${focus === "weather"}">天氣</button>
          <button type="button" class="settings-tab" data-panel="bus" aria-selected="${focus === "bus"}">巴士</button>
          <button type="button" class="settings-tab" data-panel="mtr" aria-selected="${focus === "mtr"}">港鐵</button>
        </nav>

        <div class="settings-panel" data-panel-body="weather" ${focus === "weather" ? "" : "hidden"}>
          <h3 class="settings-sub">天氣地區（十八區）</h3>
          <p class="muted">揀香港十八區；只影響呢部機。</p>
          <div class="place-grid" id="settings-weather-places"></div>
          <p class="muted" id="weather-settings-status"></p>
        </div>

        <div class="settings-panel" data-panel-body="bus" ${focus === "bus" ? "" : "hidden"}>
          <h3 class="settings-sub">而家顯示</h3>
          <ul class="settings-list" id="settings-current"></ul>
          <div class="settings-actions-row">
            <button type="button" class="ghost-btn" id="settings-reset">恢復預設巴士站</button>
          </div>
          <h3 class="settings-sub">新增站（九巴公開資料）</h3>
          <div class="add-form">
            <label class="field">
              <span>路線</span>
              <input id="add-route" type="text" inputmode="text" autocomplete="off" placeholder="例如 64K" maxlength="8" />
            </label>
            <button type="button" class="tab" id="add-load">載入方向</button>
          </div>
          <div id="add-variants" class="add-variants"></div>
          <div id="add-stops" class="add-stops"></div>
          <p class="muted" id="add-status"></p>
        </div>

        <div class="settings-panel" data-panel-body="mtr" ${focus === "mtr" ? "" : "hidden"}>
          <h3 class="settings-sub">已選港鐵站</h3>
          <ul class="settings-list" id="mtr-current"></ul>
          <div class="settings-actions-row">
            <button type="button" class="ghost-btn" id="mtr-reset">恢復預設（大埔墟／太和）</button>
          </div>
          <h3 class="settings-sub">加入車站</h3>
          <label class="field">
            <span>搜尋</span>
            <input id="mtr-search" type="search" placeholder="例如 大埔／沙田／觀塘" autocomplete="off" />
          </label>
          <div class="place-grid mtr-add-grid" id="mtr-catalog"></div>
          <p class="muted" id="mtr-status"></p>
        </div>
      </div>
    `;

    const sheet = overlayRoot.querySelector(".settings-sheet");

    sheet.querySelector(".settings-tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-panel]");
      if (!btn) return;
      const id = btn.dataset.panel;
      sheet.querySelectorAll(".settings-tab").forEach((t) => {
        t.setAttribute("aria-selected", String(t.dataset.panel === id));
      });
      sheet.querySelectorAll("[data-panel-body]").forEach((p) => {
        p.hidden = p.getAttribute("data-panel-body") !== id;
      });
    });

    overlayRoot.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) {
        overlayRoot.hidden = true;
        overlayRoot.innerHTML = "";
      }
    });

    // —— Weather ——
    const weatherGrid = sheet.querySelector("#settings-weather-places");
    const weatherStatus = sheet.querySelector("#weather-settings-status");
    const currentPlace = getWeatherPlace();
    weatherGrid.innerHTML = WEATHER_DISTRICTS.map(
      (d) => `
      <button type="button" class="place-chip" data-place="${d.id}"
        aria-pressed="${d.id === currentPlace}">${d.nameTc}</button>`
    ).join("");
    weatherGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-place]");
      if (!btn) return;
      const place = btn.dataset.place;
      saveWeatherPlace(place);
      onWeatherPlaceChange(place);
      weatherGrid.querySelectorAll(".place-chip").forEach((c) => {
        c.setAttribute("aria-pressed", String(c.dataset.place === place));
      });
      const label = districtById(place)?.nameTc || place;
      weatherStatus.textContent = `已儲存：${label}（只呢部機）`;
    });

    // —— Bus ——
    const currentEl = sheet.querySelector("#settings-current");
    const statusEl = sheet.querySelector("#add-status");
    const variantsEl = sheet.querySelector("#add-variants");
    const stopsEl = sheet.querySelector("#add-stops");
    const routeInput = sheet.querySelector("#add-route");

    const renderCurrent = () => {
      const sel = getBusSelection();
      if (!sel.stops.length) {
        currentEl.innerHTML = `<li class="muted">未選站（會用預設）</li>`;
        return;
      }
      currentEl.innerHTML = sel.stops
        .map(
          (s) => `
        <li class="settings-item">
          <div>
            <strong>${s.route}</strong> · ${s.nameTc}
            <div class="muted">${s.directions.map((d) => d.label).join(" · ")}</div>
          </div>
          <button type="button" class="ghost-btn danger" data-remove="${s.id}">移除</button>
        </li>`
        )
        .join("");
    };

    renderCurrent();

    sheet.querySelector("#settings-reset").addEventListener("click", () => {
      const next = clearBusSelection();
      setBusSelection(next);
      onBusChange(next);
      renderCurrent();
      statusEl.textContent = "已恢復預設巴士站（只影響呢部機）";
    });

    currentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      const id = btn.getAttribute("data-remove");
      const sel = getBusSelection();
      const next = {
        ...sel,
        stops: sel.stops.filter((s) => s.id !== id),
      };
      if (!next.stops.length) {
        statusEl.textContent = "至少留一個站；已恢復預設";
        const def = clearBusSelection();
        setBusSelection(def);
        onBusChange(def);
      } else {
        saveBusSelection(next);
        setBusSelection(next);
        onBusChange(next);
      }
      renderCurrent();
    });

    let loadedVariants = [];
    let loadedStops = [];
    let activeVariant = null;

    sheet.querySelector("#add-load").addEventListener("click", async () => {
      const route = routeInput.value.trim().toUpperCase();
      if (!route) {
        statusEl.textContent = "請輸入路線編號";
        return;
      }
      statusEl.textContent = "載入路線…";
      variantsEl.innerHTML = "";
      stopsEl.innerHTML = "";
      try {
        loadedVariants = await fetchRouteVariants(route);
        if (!loadedVariants.length) {
          statusEl.textContent = `搵唔到 ${route}`;
          return;
        }
        const preferred = loadedVariants.filter((v) => v.serviceType === "1");
        const list = preferred.length ? preferred : loadedVariants;
        variantsEl.innerHTML = list
          .map(
            (v, i) => `
          <button type="button" class="station-btn" data-variant="${i}"
            aria-pressed="false">${v.route} · ${v.label}</button>`
          )
          .join("");
        statusEl.textContent = "揀一個方向，再剔站名";
        loadedVariants = list;
      } catch (err) {
        statusEl.textContent = `載入失敗：${err.message || err}`;
      }
    });

    variantsEl.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-variant]");
      if (!btn) return;
      const idx = Number(btn.dataset.variant);
      activeVariant = loadedVariants[idx];
      variantsEl.querySelectorAll("[data-variant]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      statusEl.textContent = "載入車站…";
      stopsEl.innerHTML = "";
      try {
        const rows = await fetchRouteStops(
          activeVariant.route,
          activeVariant.bound,
          activeVariant.serviceType
        );
        loadedStops = await mapStopsWithNames(rows);
        stopsEl.innerHTML = `
          <label class="check-row both-ways">
            <input type="checkbox" id="add-both" checked />
            <span>盡量加埋反向（同站名）</span>
          </label>
          <div class="stop-check-list">
            ${loadedStops
              .map(
                (s) => `
              <label class="check-row">
                <input type="checkbox" data-stop="${s.stopId}" />
                <span>${s.nameTc}</span>
              </label>`
              )
              .join("")}
          </div>
          <button type="button" class="play-btn" id="add-save">加入已剔車站</button>
        `;
        statusEl.textContent = `已載入 ${loadedStops.length} 個站`;
      } catch (err) {
        statusEl.textContent = `載入車站失敗：${err.message || err}`;
      }
    });

    stopsEl.addEventListener("click", async (e) => {
      if (e.target.id !== "add-save" && !e.target.closest("#add-save")) return;
      if (!activeVariant) return;
      const checked = [...stopsEl.querySelectorAll("input[data-stop]:checked")];
      if (!checked.length) {
        statusEl.textContent = "請最少剔一個站";
        return;
      }
      const both = stopsEl.querySelector("#add-both")?.checked;
      statusEl.textContent = "儲存中…";
      try {
        const sel = structuredClone(getBusSelection());
        const otherVariant = loadedVariants.find(
          (v) =>
            v.route === activeVariant.route &&
            v.serviceType === activeVariant.serviceType &&
            v.bound !== activeVariant.bound
        );

        for (const input of checked) {
          const stopId = input.getAttribute("data-stop");
          const meta = loadedStops.find((s) => s.stopId === stopId);
          if (!meta) continue;
          const id = makeStopId(activeVariant.route, stopId);
          const directions = [
            {
              label: `往${activeVariant.destTc}`,
              stopId,
              bound: activeVariant.bound,
              serviceType: activeVariant.serviceType,
            },
          ];
          if (both) {
            const opp = await findOppositeDirection(
              activeVariant.route,
              activeVariant.serviceType,
              activeVariant.bound,
              meta.nameTc,
              otherVariant?.destTc
            );
            if (opp) directions.push(opp);
          }
          const existing = sel.stops.findIndex((s) => s.id === id);
          const card = {
            id,
            route: activeVariant.route,
            serviceType: activeVariant.serviceType,
            nameTc: meta.nameTc,
            nameEn: meta.nameEn,
            directions,
          };
          if (existing >= 0) sel.stops[existing] = card;
          else sel.stops.push(card);
        }

        saveBusSelection(sel);
        setBusSelection(sel);
        onBusChange(sel);
        renderCurrent();
        statusEl.textContent = "已儲存到呢部機（其他裝置唔會見到）";
      } catch (err) {
        statusEl.textContent = `儲存失敗：${err.message || err}`;
      }
    });

    // —— MTR ——
    const mtrCurrent = sheet.querySelector("#mtr-current");
    const mtrCatalog = sheet.querySelector("#mtr-catalog");
    const mtrStatus = sheet.querySelector("#mtr-status");
    const mtrSearch = sheet.querySelector("#mtr-search");

    const renderMtrCurrent = () => {
      const sel = getMtrSelection();
      if (!sel.stations.length) {
        mtrCurrent.innerHTML = `<li class="muted">未選站</li>`;
        return;
      }
      mtrCurrent.innerHTML = sel.stations
        .map(
          (s) => `
        <li class="settings-item">
          <div>
            <strong>${s.nameTc}</strong>
            <div class="muted">${s.lineTc || s.line}</div>
          </div>
          <button type="button" class="ghost-btn danger" data-mtr-remove="${s.id}">移除</button>
        </li>`
        )
        .join("");
    };

    const renderMtrCatalog = (q = "") => {
      const needle = q.trim().toLowerCase();
      const selected = new Set(getMtrSelection().stations.map((s) => s.id));
      const list = MTR_STATION_CATALOG.filter((s) => {
        if (!needle) return true;
        return (
          s.nameTc.includes(q.trim()) ||
          s.lineTc.includes(q.trim()) ||
          s.sta.toLowerCase().includes(needle) ||
          s.line.toLowerCase().includes(needle)
        );
      }).slice(0, 40);
      mtrCatalog.innerHTML = list
        .map(
          (s) => `
        <button type="button" class="place-chip" data-mtr-add="${s.id}"
          ${selected.has(s.id) ? "disabled" : ""}>
          ${s.nameTc}<small>${s.lineTc}</small>
        </button>`
        )
        .join("");
    };

    renderMtrCurrent();
    renderMtrCatalog();

    mtrSearch.addEventListener("input", () => renderMtrCatalog(mtrSearch.value));

    sheet.querySelector("#mtr-reset").addEventListener("click", () => {
      const next = clearMtrSelection();
      setMtrSelection(next);
      onMtrChange(next);
      renderMtrCurrent();
      renderMtrCatalog(mtrSearch.value);
      mtrStatus.textContent = "已恢復預設港鐵站（只影響呢部機）";
    });

    mtrCurrent.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mtr-remove]");
      if (!btn) return;
      const id = btn.getAttribute("data-mtr-remove");
      const sel = getMtrSelection();
      const next = { ...sel, stations: sel.stations.filter((s) => s.id !== id) };
      saveMtrSelection(next);
      setMtrSelection(next);
      onMtrChange(next);
      renderMtrCurrent();
      renderMtrCatalog(mtrSearch.value);
    });

    mtrCatalog.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mtr-add]");
      if (!btn || btn.disabled) return;
      const meta = catalogById(btn.dataset.mtrAdd);
      if (!meta) return;
      const sel = structuredClone(getMtrSelection());
      if (sel.stations.some((s) => s.id === meta.id)) return;
      sel.stations.push({ ...meta });
      saveMtrSelection(sel);
      setMtrSelection(sel);
      onMtrChange(sel);
      renderMtrCurrent();
      renderMtrCatalog(mtrSearch.value);
      mtrStatus.textContent = `已加入 ${meta.nameTc}`;
    });
  };

  return { open };
}

/** First-run / change weather region modal — 十八區. */
export function openWeatherPlacePicker(overlayRoot, { currentPlace, onPick }) {
  overlayRoot.hidden = false;
  overlayRoot.innerHTML = `
    <div class="settings-backdrop"></div>
    <div class="settings-sheet place-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="place-picker-title">
      <header class="settings-head">
        <h2 id="place-picker-title">揀天氣地區（十八區）</h2>
      </header>
      <p class="settings-note">
        第一次使用請揀香港十八區。選擇只存在呢部機，之後可喺設定更改。
      </p>
      <div class="place-grid" id="first-place-grid">
        ${WEATHER_DISTRICTS.map(
          (d) => `
          <button type="button" class="place-chip" data-place="${d.id}"
            aria-pressed="${d.id === currentPlace}">${d.nameTc}</button>`
        ).join("")}
      </div>
    </div>
  `;

  overlayRoot.querySelector("#first-place-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-place]");
    if (!btn) return;
    const place = btn.dataset.place;
    saveWeatherPlace(place);
    overlayRoot.hidden = true;
    overlayRoot.innerHTML = "";
    onPick(place);
  });
}
