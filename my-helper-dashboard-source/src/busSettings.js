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

/**
 * Settings sheet: pick / add / remove bus stops.
 * Persistence is localStorage on this device only.
 */
export function createBusSettings({
  overlayRoot,
  getSelection,
  setSelection,
  onChange,
}) {
  const open = () => {
    const selection = getSelection();
    overlayRoot.hidden = false;
    overlayRoot.innerHTML = `
      <div class="settings-backdrop" data-close></div>
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="bus-settings-title">
        <header class="settings-head">
          <h2 id="bus-settings-title">巴士路線設定</h2>
          <button type="button" class="icon-btn" data-close aria-label="關閉">✕</button>
        </header>
        <p class="settings-note">
          設定只保存在<strong>呢部手機／瀏覽器</strong>（localStorage）。
          唔會上雲、唔會同步去第二部機——另一部機會用返預設 64K 林村站。
        </p>
        <div class="settings-body">
          <h3 class="settings-sub">而家顯示</h3>
          <ul class="settings-list" id="settings-current"></ul>
          <div class="settings-actions-row">
            <button type="button" class="ghost-btn" id="settings-reset">恢復林村預設</button>
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
      </div>
    `;

    const currentEl = overlayRoot.querySelector("#settings-current");
    const statusEl = overlayRoot.querySelector("#add-status");
    const variantsEl = overlayRoot.querySelector("#add-variants");
    const stopsEl = overlayRoot.querySelector("#add-stops");
    const routeInput = overlayRoot.querySelector("#add-route");

    const renderCurrent = () => {
      const sel = getSelection();
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

    overlayRoot.querySelector("#settings-reset").addEventListener("click", () => {
      const next = clearBusSelection();
      setSelection(next);
      onChange(next);
      renderCurrent();
      statusEl.textContent = "已恢復林村 64K 預設（只影響呢部機）";
    });

    currentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      const id = btn.getAttribute("data-remove");
      const sel = getSelection();
      const next = {
        ...sel,
        stops: sel.stops.filter((s) => s.id !== id),
      };
      if (!next.stops.length) {
        statusEl.textContent = "至少留一個站；已恢復預設";
        const def = clearBusSelection();
        setSelection(def);
        onChange(def);
      } else {
        saveBusSelection(next);
        setSelection(next);
        onChange(next);
      }
      renderCurrent();
    });

    overlayRoot.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) {
        overlayRoot.hidden = true;
        overlayRoot.innerHTML = "";
      }
    });

    let loadedVariants = [];
    let loadedStops = [];
    let activeVariant = null;

    overlayRoot.querySelector("#add-load").addEventListener("click", async () => {
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
        // Prefer service type 1 first
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
        const sel = structuredClone(getSelection());
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
        setSelection(sel);
        onChange(sel);
        renderCurrent();
        statusEl.textContent = "已儲存到呢部機（其他裝置唔會見到）";
      } catch (err) {
        statusEl.textContent = `儲存失敗：${err.message || err}`;
      }
    });
  };

  return { open };
}
