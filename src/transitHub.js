import { escapeHtml } from "./escapeHtml.js";
import { saveModuleEnabled } from "./prefsStore.js";
import { createGmb } from "./gmb.js";
import { createCitybus } from "./citybus.js";
import { createParking } from "./parking.js";

const MODES = [
  { id: "bus", label: "九巴" },
  { id: "mtr", label: "港鐵" },
  { id: "gmb", label: "專線小巴" },
  { id: "citybus", label: "城巴" },
  { id: "parking", label: "停車場" },
];

export function createTransitHub(root, { getEnabled, setEnabled, onEnabledChange, onStatus } = {}) {
  let gmb;
  let citybus;
  let parking;
  let started = false;

  const paintToggles = () => {
    const enabled = getEnabled?.() || {};
    const box = root.querySelector("#transit-toggles");
    if (!box) return;
    box.innerHTML = MODES.map((mode) => {
      const shown = enabled[mode.id] !== false;
      return `<div class="transit-toggle">
        <span>${escapeHtml(mode.label)}</span>
        <button type="button" data-home-toggle="${escapeHtml(mode.id)}" aria-pressed="${shown ? "true" : "false"}">${shown ? "✓ 已在主頁" : "＋ 加到主頁"}</button>
      </div>`;
    }).join("");
  };

  const shell = () => {
    root.innerHTML = `
      <p class="muted transit-intro">九巴同港鐵嘅搜尋仍然喺主頁卡。專線小巴、城巴、停車場喺呢度搜，釘選之後先顯示喺主頁。</p>
      <div id="transit-toggles" class="transit-toggles"></div>
      <section class="transit-section" aria-labelledby="gmb-hub-title">
        <h3 id="gmb-hub-title">專線小巴</h3>
        <div id="gmb-hub"></div>
      </section>
      <section class="transit-section" aria-labelledby="ctb-hub-title">
        <h3 id="ctb-hub-title">城巴</h3>
        <div id="ctb-hub"></div>
      </section>
      <section class="transit-section" aria-labelledby="park-hub-title">
        <h3 id="park-hub-title">停車場</h3>
        <div id="park-hub"></div>
      </section>
    `;
    paintToggles();
    gmb = createGmb(root.querySelector("#gmb-hub"), { mode: "hub", onStatus });
    citybus = createCitybus(root.querySelector("#ctb-hub"), { mode: "hub", onStatus });
    parking = createParking(root.querySelector("#park-hub"), { mode: "hub", onStatus });
  };

  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-home-toggle]");
    if (!btn || !root.contains(btn)) return;
    const id = btn.dataset.homeToggle;
    const enabled = { ...(getEnabled?.() || {}) };
    const shown = enabled[id] !== false;
    enabled[id] = !shown;
    const next = saveModuleEnabled(enabled);
    setEnabled?.(next);
    onEnabledChange?.(next);
    paintToggles();
  });

  return {
    start() {
      if (!root.querySelector("#transit-toggles")) shell();
      paintToggles();
      if (!started) {
        started = true;
        gmb?.start();
        citybus?.start();
        parking?.start();
      }
    },
    refreshToggles() {
      paintToggles();
    },
  };
}
