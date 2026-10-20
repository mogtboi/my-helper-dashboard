import { escapeHtml } from "./escapeHtml.js";
import { isModuleOn, saveModuleEnabled } from "./prefsStore.js";
import { createBus } from "./bus.js";
import { createMtr } from "./mtr.js";
import { createGmb } from "./gmb.js";
import { createCitybus } from "./citybus.js";
import { createParking } from "./parking.js";

const MODES = [
  { id: "bus", label: "🚌 九巴" },
  { id: "mtr", label: "🚇 港鐵" },
  { id: "gmb", label: "🚐 專線小巴" },
  { id: "citybus", label: "🚍 城巴" },
  { id: "parking", label: "🅿️ 停車場" },
];

export function createTransitHub(root, options = {}) {
  const {
    getEnabled,
    setEnabled,
    onEnabledChange,
    onStatus,
    getBusSelection,
    getMtrSelection,
    onBusSelection,
    onMtrSelection,
    onOpenMtrSettings,
  } = options;
  let active = "bus";
  let bus;
  let mtr;
  let gmb;
  let citybus;
  let parking;
  const started = { bus: false, mtr: false, gmb: false, citybus: false, parking: false };

  const paintModes = () => {
    const enabled = getEnabled?.() || {};
    const box = root.querySelector("#transit-modes");
    if (!box) return;
    box.innerHTML = MODES.map((mode) => {
      const shown = isModuleOn(enabled, mode.id);
      const on = active === mode.id;
      return `<div class="transit-mode${on ? " is-active" : ""}">
        <button type="button" class="transit-mode-name" data-pick-mode="${escapeHtml(mode.id)}" aria-pressed="${on ? "true" : "false"}">${escapeHtml(mode.label)}</button>
        <button type="button" class="transit-home-btn" data-home-toggle="${escapeHtml(mode.id)}" aria-pressed="${shown ? "true" : "false"}">${shown ? "✓ 已在主頁" : "＋ 加到主頁"}</button>
      </div>`;
    }).join("");
  };

  const showPanel = () => {
    for (const mode of MODES) {
      const panel = root.querySelector(`#hub-${mode.id}`);
      if (panel) panel.hidden = mode.id !== active;
    }
    paintModes();
    if (started[active]) {
      if (active === "bus") bus?.refresh();
      if (active === "mtr") mtr?.refresh();
      if (active === "gmb") gmb?.start();
      if (active === "citybus") citybus?.start();
      if (active === "parking") parking?.start();
      return;
    }
    started[active] = true;
    if (active === "bus") bus?.start(getBusSelection?.() || { items: [], activeId: "" });
    if (active === "mtr") mtr?.start(getMtrSelection?.() || { stations: [], favorites: [], activeId: "" });
    if (active === "gmb") gmb?.start();
    if (active === "citybus") citybus?.start();
    if (active === "parking") parking?.start();
  };

  const shell = () => {
    root.innerHTML = `
      <p class="muted transit-intro">揀一個交通工具，下面先顯示嗰個搜尋。右邊按鈕只切換主頁卡。</p>
      <div id="transit-modes" class="transit-modes"></div>
      <div id="hub-bus" class="transit-panel"></div>
      <div id="hub-mtr" class="transit-panel" hidden></div>
      <div id="hub-gmb" class="transit-panel" hidden></div>
      <div id="hub-citybus" class="transit-panel" hidden></div>
      <div id="hub-parking" class="transit-panel" hidden></div>
    `;
    const busActions = document.createElement("div");
    busActions.className = "transit-hub-actions";
    root.querySelector("#hub-bus").append(busActions);
    const busBody = document.createElement("div");
    root.querySelector("#hub-bus").append(busBody);
    bus = createBus(busBody, null, {
      onStatus,
      actionsEl: busActions,
      onSelectionPersist: (next) => onBusSelection?.(next),
    });
    mtr = createMtr(root.querySelector("#hub-mtr"), null, {
      onStatus,
      onOpenSettings: () => onOpenMtrSettings?.(),
      onSelectionChange: (next) => onMtrSelection?.(next),
    });
    gmb = createGmb(root.querySelector("#hub-gmb"), { mode: "hub", onStatus });
    citybus = createCitybus(root.querySelector("#hub-citybus"), { mode: "hub", onStatus });
    parking = createParking(root.querySelector("#hub-parking"), { mode: "hub", onStatus });
    showPanel();
  };

  root.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-home-toggle]");
    if (toggle && root.contains(toggle)) {
      e.stopPropagation();
      const id = toggle.dataset.homeToggle;
      const enabled = { ...(getEnabled?.() || {}) };
      const currentlyOn = isModuleOn(enabled, id);
      enabled[id] = !currentlyOn;
      const next = saveModuleEnabled(enabled);
      setEnabled?.(next);
      onEnabledChange?.(next);
      paintModes();
      return;
    }
    const pick = e.target.closest("[data-pick-mode]");
    if (!pick || !root.contains(pick)) return;
    active = pick.dataset.pickMode || "bus";
    showPanel();
  });

  return {
    start() {
      if (!root.querySelector("#transit-modes")) shell();
      else showPanel();
    },
    refreshToggles() {
      paintModes();
    },
    setBusSelection(next) {
      if (started.bus) bus?.setSelection(next);
    },
    setMtrSelection(next) {
      if (started.mtr) mtr?.setSelection(next);
    },
  };
}
