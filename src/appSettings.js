import { WEATHER_DISTRICTS, districtById, saveWeatherPlace } from "./weatherStore.js";
import {
  saveMtrSelection,
  clearMtrSelection,
  catalogById,
} from "./mtrStore.js";
import { MTR_LINES, lineByCode, stationOnLine } from "./mtrLines.js";

/**
 * Unified settings sheet: weather region, bus routes, MTR stations.
 * All persistence is localStorage on this device only.
 */
export function createAppSettings({
  overlayRoot,
  getWeatherPlace,
  onWeatherPlaceChange,
  getMtrSelection,
  setMtrSelection,
  onMtrChange,
}) {
  const open = (focus = "weather") => {
    if (focus === "bus") focus = "weather";
    overlayRoot.hidden = false;
    overlayRoot.innerHTML = `
      <div class="settings-backdrop" data-close></div>
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="app-settings-title">
        <header class="settings-head">
          <h2 id="app-settings-title">設定</h2>
          <button type="button" class="icon-btn" data-close aria-label="關閉">✕</button>
        </header>
        <p class="settings-note">
          所有設定只保存在<strong>呢部裝置</strong>（localStorage）。
          唔會上雲、唔會同步去第二部機。
        </p>

        <nav class="settings-tabs" role="tablist" aria-label="設定分類">
          <button type="button" class="settings-tab" data-panel="weather" aria-selected="${focus === "weather"}">天氣</button>
          <button type="button" class="settings-tab" data-panel="mtr" aria-selected="${focus === "mtr"}">港鐵</button>
        </nav>

        <div class="settings-panel" data-panel-body="weather" ${focus === "weather" ? "" : "hidden"}>
          <h3 class="settings-sub">天氣地區（十八區）</h3>
          <p class="muted">揀香港十八區；只影響呢部機。</p>
          <div class="place-grid" id="settings-weather-places"></div>
          <p class="muted" id="weather-settings-status"></p>
        </div>

        <div class="settings-panel" data-panel-body="mtr" ${focus === "mtr" ? "" : "hidden"}>
          <h3 class="settings-sub">已選港鐵站</h3>
          <ul class="settings-list" id="mtr-current"></ul>
          <div class="settings-actions-row">
            <button type="button" class="ghost-btn" id="mtr-reset">恢復預設（大埔墟／太和）</button>
          </div>
          <h3 class="settings-sub">加入車站</h3>
          <p class="muted">先揀綫，再揀要加入嘅車站（同主畫面一樣）</p>
          <div id="mtr-add-wizard" class="mtr-add-wizard"></div>
          <p class="muted" id="mtr-status"></p>
        </div>
      </div>
    `;

    const closeSheet = () => {
      overlayRoot.hidden = true;
      overlayRoot.innerHTML = "";
    };
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
      if (e.target.closest("[data-close]")) closeSheet();
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

    // —— MTR ——
    const mtrCurrent = sheet.querySelector("#mtr-current");
    const mtrWizard = sheet.querySelector("#mtr-add-wizard");
    const mtrStatus = sheet.querySelector("#mtr-status");
    let addLineCode = null;

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

    const addStation = (meta) => {
      if (!meta) return;
      const sel = structuredClone(getMtrSelection());
      if (sel.stations.some((s) => s.id === meta.id)) {
        mtrStatus.textContent = `${meta.nameTc} 已喺列表`;
        return;
      }
      sel.stations.push({ ...meta });
      saveMtrSelection(sel);
      setMtrSelection(sel);
      onMtrChange(sel);
      closeSheet();
    };

    const paintMtrAddWizard = () => {
      if (!mtrWizard) return;
      const selected = new Set(getMtrSelection().stations.map((s) => s.id));

      if (!addLineCode) {
        mtrWizard.innerHTML = `
          <p class="wizard-step">① 揀綫</p>
          <div class="place-grid mtr-line-grid" id="mtr-settings-lines">
            ${MTR_LINES.map(
              (l) => `
              <button type="button" class="place-chip" data-add-line="${l.code}">
                ${l.nameTc}<small>${l.code}</small>
              </button>`
            ).join("")}
          </div>
        `;
        mtrWizard.querySelector("#mtr-settings-lines").addEventListener("click", (e) => {
          const btn = e.target.closest("[data-add-line]");
          if (!btn) return;
          addLineCode = btn.dataset.addLine;
          paintMtrAddWizard();
        });
        return;
      }

      const line = lineByCode(addLineCode);
      if (!line) {
        addLineCode = null;
        paintMtrAddWizard();
        return;
      }

      mtrWizard.innerHTML = `
        <p class="wizard-step">② ${line.nameTc} · 揀站加入
          <button type="button" class="ghost-btn" id="mtr-settings-back-line">返回揀綫</button>
        </p>
        <label class="field">
          <span>喺呢條綫搜尋站名</span>
          <input id="mtr-search" type="search" placeholder="例如 沙田／觀塘" autocomplete="off" />
        </label>
        <div class="place-grid mtr-add-grid" id="mtr-catalog"></div>
      `;

      const catalogEl = mtrWizard.querySelector("#mtr-catalog");
      const searchEl = mtrWizard.querySelector("#mtr-search");

      const renderStations = (q = "") => {
        const needle = q.trim().toLowerCase();
        const list = line.stations.filter((s) => {
          if (!needle) return true;
          return s.nameTc.includes(q.trim()) || s.sta.toLowerCase().includes(needle);
        });
        catalogEl.innerHTML = list
          .map((s) => {
            const id = `${line.code}-${s.sta}`;
            return `
            <button type="button" class="place-chip" data-mtr-add="${id}"
              ${selected.has(id) ? "disabled" : ""}>
              ${s.nameTc}<small>${line.nameTc}</small>
            </button>`;
          })
          .join("");
      };

      renderStations();
      searchEl.addEventListener("input", () => renderStations(searchEl.value));
      mtrWizard.querySelector("#mtr-settings-back-line").addEventListener("click", () => {
        addLineCode = null;
        paintMtrAddWizard();
      });
      catalogEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-mtr-add]");
        if (!btn || btn.disabled) return;
        const id = btn.dataset.mtrAdd;
        const meta = catalogById(id) || (() => {
          const [lc, sta] = id.split("-");
          return stationOnLine(lc, sta);
        })();
        addStation(meta);
      });
    };

    renderMtrCurrent();
    paintMtrAddWizard();

    sheet.querySelector("#mtr-reset").addEventListener("click", () => {
      const next = clearMtrSelection();
      setMtrSelection(next);
      onMtrChange(next);
      renderMtrCurrent();
      addLineCode = null;
      paintMtrAddWizard();
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
      paintMtrAddWizard();
    });
  };

  return { open };
}

const WEATHER_SHORTCUTS = ["中西區", "油尖旺", "觀塘", "沙田", "大埔", "元朗"];

/** First-run weather district. One confirm remembers the choice on this device. */
export function openWeatherPlacePicker(overlayRoot, { currentPlace, onPick }) {
  let picked = districtById(currentPlace) ? currentPlace : "";
  const chip = (d, pressed) => `
    <button type="button" class="place-chip" data-place="${d.id}" aria-pressed="${pressed}">${d.nameTc}</button>`;
  const paint = () => {
    overlayRoot.hidden = false;
    overlayRoot.innerHTML = `
      <div class="settings-backdrop"></div>
      <div class="settings-sheet place-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="place-picker-title">
        <header class="settings-head">
          <h2 id="place-picker-title">揀天氣地區</h2>
        </header>
        <p class="settings-note">
          揀一次就記住，唔會再問。只存呢部裝置，之後可喺設定更改。
        </p>
        <p class="settings-sub">常用地區</p>
        <div class="place-grid" id="place-shortcuts">
          ${WEATHER_SHORTCUTS.map((id) => WEATHER_DISTRICTS.find((d) => d.id === id))
            .filter(Boolean)
            .map((d) => chip(d, d.id === picked))
            .join("")}
        </div>
        <p class="settings-sub">十八區</p>
        <div class="place-grid" id="first-place-grid">
          ${WEATHER_DISTRICTS.map((d) => chip(d, d.id === picked)).join("")}
        </div>
        <button type="button" class="place-confirm" id="place-confirm" ${picked ? "" : "disabled"}>確定，記住呢個地區</button>
      </div>
    `;
    const choose = (e) => {
      const btn = e.target.closest("[data-place]");
      if (!btn) return;
      picked = btn.dataset.place;
      paint();
    };
    overlayRoot.querySelector("#place-shortcuts").addEventListener("click", choose);
    overlayRoot.querySelector("#first-place-grid").addEventListener("click", choose);
    overlayRoot.querySelector("#place-confirm").addEventListener("click", () => {
      if (!districtById(picked)) return;
      saveWeatherPlace(picked);
      overlayRoot.hidden = true;
      overlayRoot.innerHTML = "";
      onPick(picked);
    });
  };
  paint();
}
