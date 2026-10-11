import {
  MODULE_CATALOG,
  SETTINGS_CATEGORIES,
  FONT_STEPS,
  ACCENT_OPTIONS,
  saveModuleEnabled,
  saveAppearance,
  applyAppearance,
} from "./prefsStore.js";

const CAT_BLURBS = {
  天氣: "地區天氣、警告、UV、空氣質素、日出日落",
  巴士: "九巴路線 ETA 同車站設定",
  港鐵: "下一班車 ETA 同車站設定",
  假期: "公眾假期倒數、今日是否假期、本月勞工假日數",
  外觀: "字體大小同主題色（只存呢部機）",
  電台: "港台電台同埋時鐘主頁顯示",
};

const CAT_SETTINGS_FOCUS = {
  天氣: "weather",
  巴士: "bus",
  港鐵: "mtr",
};

const ROOT_ITEMS = [
  { id: "home", nameTc: "主頁", blurb: "儀表板各資訊面板" },
  { id: "traffic", nameTc: "交通消息", blurb: "特別交通消息／封路／改道" },
  { id: "settings", nameTc: "設定", blurb: "加到主頁、天氣／巴士／港鐵等" },
];

function toggleRow(mod, on) {
  return `
    <div class="drawer-toggle" data-toggle-row data-mod="${mod.id}">
      <div class="drawer-toggle-meta">
        <span class="drawer-toggle-name">${mod.nameTc}</span>
        <span class="drawer-toggle-state">${on ? "已加到主頁" : "未加到主頁"}</span>
      </div>
      <button
        type="button"
        class="drawer-switch"
        role="switch"
        data-mod-switch="${mod.id}"
        aria-checked="${on ? "true" : "false"}"
        aria-label="${mod.nameTc}：${on ? "加到主頁" : "唔加"}"
      >
        <span class="drawer-switch-track" aria-hidden="true">
          <span class="drawer-switch-thumb"></span>
        </span>
        <span class="drawer-switch-label">${on ? "加到主頁" : "唔加"}</span>
      </button>
    </div>`;
}

/**
 * Left drawer (~67vw): 主頁 / 交通消息 / 設定 → nested category pages.
 */
export function createDrawer({
  root,
  getEnabled,
  setEnabled,
  onEnabledChange,
  getAppearance,
  setAppearance,
  onAppearanceChange,
  onOpenSettings,
  onNavigateHome,
  onNavigateTraffic,
}) {
  root.innerHTML = `
    <div class="drawer-backdrop" data-drawer-close hidden></div>
    <aside class="drawer-panel" id="drawer-panel" aria-hidden="true">
      <header class="drawer-head">
        <button type="button" class="icon-btn drawer-back" data-drawer-back hidden aria-label="返回">‹</button>
        <h2 id="drawer-title">選單</h2>
        <button type="button" class="icon-btn" data-drawer-close aria-label="關閉">✕</button>
      </header>
      <p class="drawer-note" id="drawer-note">主頁、交通消息，或者入設定管理主頁模組。</p>
      <div class="drawer-body" id="drawer-body"></div>
    </aside>
  `;

  const backdrop = root.querySelector(".drawer-backdrop");
  const panel = root.querySelector("#drawer-panel");
  const body = root.querySelector("#drawer-body");
  const titleEl = root.querySelector("#drawer-title");
  const noteEl = root.querySelector("#drawer-note");
  const backBtn = root.querySelector("[data-drawer-back]");

  let open = false;
  /** @type {'root' | 'settings' | string} */
  let screen = "root";

  const setModEnabled = (id, nextOn) => {
    const enabled = { ...getEnabled(), [id]: nextOn };
    saveModuleEnabled(enabled);
    setEnabled(enabled);
    onEnabledChange?.(enabled);
  };

  const renderRoot = () => {
    titleEl.textContent = "選單";
    noteEl.textContent = "主頁、交通消息，或者入設定管理主頁模組。";
    backBtn.hidden = true;
    body.innerHTML = `
      <nav class="drawer-cat-list" aria-label="選單">
        ${ROOT_ITEMS.map(
          (item) => `
          <button type="button" class="drawer-cat-link" data-root-nav="${item.id}">
            <span class="drawer-cat-link-title">${item.nameTc}</span>
            <span class="drawer-cat-link-blurb">${item.blurb}</span>
            <span class="drawer-cat-link-chevron" aria-hidden="true">›</span>
          </button>`
        ).join("")}
      </nav>
    `;
  };

  const renderSettingsHub = () => {
    const enabled = getEnabled();
    titleEl.textContent = "設定";
    noteEl.textContent = "開關「加到主頁」，或者進入分類設定。全部只存呢部機。";
    backBtn.hidden = false;
    body.innerHTML = `
      <section class="drawer-page">
        <h3 class="drawer-page-h">加到主頁</h3>
        <div class="drawer-toggle-list">
          ${MODULE_CATALOG.map((m) => toggleRow(m, enabled[m.id] !== false)).join("")}
        </div>
        <h3 class="drawer-page-h">分類設定</h3>
        <nav class="drawer-cat-list" aria-label="設定分類">
          ${SETTINGS_CATEGORIES.map(
            (cat) => `
            <button type="button" class="drawer-cat-link" data-open-cat="${cat}">
              <span class="drawer-cat-link-title">${cat}</span>
              <span class="drawer-cat-link-blurb">${CAT_BLURBS[cat] || ""}</span>
              <span class="drawer-cat-link-chevron" aria-hidden="true">›</span>
            </button>`
          ).join("")}
        </nav>
      </section>
    `;
  };

  const renderCategory = (cat) => {
    const enabled = getEnabled();
    const appearance = getAppearance();
    titleEl.textContent = cat;
    noteEl.textContent = CAT_BLURBS[cat] || "全部設定只存呢部機。";
    backBtn.hidden = false;

    if (cat === "外觀") {
      body.innerHTML = `
        <section class="drawer-page">
          <h3 class="drawer-page-h">字體大小</h3>
          <div class="drawer-chip-row">
            ${FONT_STEPS.map(
              (f) => `
              <button type="button" class="place-chip" data-font="${f.id}"
                aria-pressed="${appearance.font === f.id}">${f.label}</button>`
            ).join("")}
          </div>
          <h3 class="drawer-page-h">主題色</h3>
          <div class="drawer-chip-row">
            ${ACCENT_OPTIONS.map(
              (a) => `
              <button type="button" class="place-chip accent-chip" data-accent="${a.id}"
                aria-pressed="${appearance.accent === a.id}"
                style="--chip-accent:${a.value}">${a.label}</button>`
            ).join("")}
          </div>
        </section>
      `;
      return;
    }

    const mods = MODULE_CATALOG.filter((m) => m.category === cat);
    const settingsFocus = CAT_SETTINGS_FOCUS[cat];
    const settingsLabel =
      cat === "天氣"
        ? "設定天氣地區…"
        : cat === "巴士"
          ? "設定巴士站／路線…"
          : cat === "港鐵"
            ? "設定港鐵站／綫…"
            : null;

    body.innerHTML = `
      <section class="drawer-page">
        ${
          mods.length
            ? `<h3 class="drawer-page-h">主頁顯示</h3>
               <div class="drawer-toggle-list">
                 ${mods.map((m) => toggleRow(m, enabled[m.id] !== false)).join("")}
               </div>`
            : ""
        }
        ${
          cat === "假期"
            ? `<p class="drawer-page-info muted">倒數下一公眾假期、顯示今日是否假期，並統計本月勞工假日數。標籤區分勞工假／一般公眾假期／銀行假。</p>`
            : ""
        }
        ${
          cat === "電台"
            ? `<p class="drawer-page-info muted">港台電台串流同主頁時鐘顯示；設定只存呢部機。</p>`
            : ""
        }
        ${
          settingsLabel && settingsFocus
            ? `<button type="button" class="tab drawer-settings-btn" data-open-settings data-settings-focus="${settingsFocus}">${settingsLabel}</button>`
            : ""
        }
      </section>
    `;
  };

  const render = () => {
    if (screen === "root") renderRoot();
    else if (screen === "settings") renderSettingsHub();
    else renderCategory(screen);
  };

  const setOpen = (next) => {
    open = next;
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    backdrop.hidden = !open;
    document.body.classList.toggle("drawer-open", open);
    if (!open) {
      screen = "root";
      render();
    }
  };

  const toggle = () => setOpen(!open);

  const goBack = () => {
    if (screen !== "root" && screen !== "settings") {
      screen = "settings";
      render();
      return;
    }
    if (screen === "settings") {
      screen = "root";
      render();
      return;
    }
    setOpen(false);
  };

  panel.addEventListener(
    "pointerdown",
    (e) => {
      if (
        e.target.closest(
          "[data-mod-switch], .drawer-switch, .drawer-toggle, .drawer-cat-link, .place-chip, .drawer-settings-btn, .icon-btn"
        )
      ) {
        e.stopPropagation();
      }
    },
    true
  );

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-drawer-close]")) {
      setOpen(false);
      return;
    }
    if (e.target.closest("[data-drawer-back]")) {
      goBack();
      return;
    }

    const rootNav = e.target.closest("[data-root-nav]");
    if (rootNav) {
      const id = rootNav.dataset.rootNav;
      if (id === "home") {
        setOpen(false);
        onNavigateHome?.();
        return;
      }
      if (id === "traffic") {
        setOpen(false);
        onNavigateTraffic?.();
        return;
      }
      if (id === "settings") {
        screen = "settings";
        render();
      }
      return;
    }

    const catBtn = e.target.closest("[data-open-cat]");
    if (catBtn) {
      screen = catBtn.dataset.openCat;
      render();
      return;
    }

    const switchBtn = e.target.closest("[data-mod-switch]");
    if (switchBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = switchBtn.dataset.modSwitch;
      const nextOn = switchBtn.getAttribute("aria-checked") !== "true";
      setModEnabled(id, nextOn);
      render();
      return;
    }

    const settingsBtn = e.target.closest("[data-open-settings]");
    if (settingsBtn) {
      const focus = settingsBtn.dataset.settingsFocus || "bus";
      setOpen(false);
      onOpenSettings?.(focus);
      return;
    }

    const fontBtn = e.target.closest("[data-font]");
    if (fontBtn) {
      const next = saveAppearance({ ...getAppearance(), font: fontBtn.dataset.font });
      setAppearance(next);
      applyAppearance(next);
      onAppearanceChange?.(next);
      render();
      return;
    }

    const accentBtn = e.target.closest("[data-accent]");
    if (accentBtn) {
      const next = saveAppearance({ ...getAppearance(), accent: accentBtn.dataset.accent });
      setAppearance(next);
      applyAppearance(next);
      onAppearanceChange?.(next);
      render();
    }
  });

  let touchStartX = null;
  let touchStartY = null;
  let touchOnControl = false;

  const isControlTarget = (el) =>
    !!el?.closest?.(
      "[data-mod-switch], .drawer-switch, .drawer-toggle, .drawer-cat-link, .place-chip, .drawer-settings-btn, button, input, a, label"
    );

  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchOnControl = isControlTarget(e.target);
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    (e) => {
      if (touchStartX == null) return;
      const t = e.changedTouches[0];
      const startX = touchStartX;
      const startY = touchStartY;
      const onControl = touchOnControl;
      touchStartX = null;
      touchStartY = null;
      touchOnControl = false;
      if (!t || onControl) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (!open && startX < 28 && dx > 60 && dy < 50) {
        setOpen(true);
        return;
      }
      if (open && dx < -70 && dy < 50) {
        if (screen !== "root" && startX < 48) goBack();
        else setOpen(false);
      }
    },
    { passive: true }
  );

  render();
  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle,
    render,
    openSettingsHub: () => {
      setOpen(true);
      screen = "settings";
      render();
    },
  };
}
