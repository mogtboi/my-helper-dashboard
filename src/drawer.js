import {
  MODULE_CATALOG,
  DRAWER_CATEGORIES,
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
  設定: "時鐘、電台，以及其他本機設定",
};

const CAT_SETTINGS_FOCUS = {
  天氣: "weather",
  巴士: "bus",
  港鐵: "mtr",
  設定: "bus",
};

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
 * Left drawer (~2/3 width): category list → category page with toggles + settings.
 * Edge swipe from left or menu button. Swipes ignore interactive controls.
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
}) {
  root.innerHTML = `
    <div class="drawer-backdrop" data-drawer-close hidden></div>
    <aside class="drawer-panel" id="drawer-panel" aria-hidden="true">
      <header class="drawer-head">
        <button type="button" class="icon-btn drawer-back" data-drawer-back hidden aria-label="返回分類">‹</button>
        <h2 id="drawer-title">選單</h2>
        <button type="button" class="icon-btn" data-drawer-close aria-label="關閉">✕</button>
      </header>
      <p class="drawer-note" id="drawer-note">揀分類進入設定；開關可將資訊加到／移離主頁。</p>
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
  /** @type {string | null} */
  let activeCat = null;

  const setModEnabled = (id, nextOn) => {
    const enabled = { ...getEnabled(), [id]: nextOn };
    saveModuleEnabled(enabled);
    setEnabled(enabled);
    onEnabledChange?.(enabled);
  };

  const renderHome = () => {
    titleEl.textContent = "選單";
    noteEl.textContent = "揀分類進入設定；開關可將資訊加到／移離主頁。";
    backBtn.hidden = true;
    body.innerHTML = `
      <nav class="drawer-cat-list" aria-label="分類">
        ${DRAWER_CATEGORIES.map(
          (cat) => `
          <button type="button" class="drawer-cat-link" data-open-cat="${cat}">
            <span class="drawer-cat-link-title">${cat}</span>
            <span class="drawer-cat-link-blurb">${CAT_BLURBS[cat] || ""}</span>
            <span class="drawer-cat-link-chevron" aria-hidden="true">›</span>
          </button>`
        ).join("")}
      </nav>
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
            : cat === "設定"
              ? "巴士／港鐵／天氣地區設定…"
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
          settingsLabel && settingsFocus
            ? `<button type="button" class="tab drawer-settings-btn" data-open-settings data-settings-focus="${settingsFocus}">${settingsLabel}</button>`
            : ""
        }
      </section>
    `;
  };

  const render = () => {
    if (activeCat) renderCategory(activeCat);
    else renderHome();
  };

  const setOpen = (next) => {
    open = next;
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    backdrop.hidden = !open;
    document.body.classList.toggle("drawer-open", open);
    if (!open) {
      activeCat = null;
      render();
    }
  };

  const toggle = () => setOpen(!open);

  const goCat = (cat) => {
    activeCat = cat;
    render();
  };

  const goHome = () => {
    activeCat = null;
    render();
  };

  // Capture-phase handlers so toggles win over swipe/drag
  panel.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest("[data-mod-switch], .drawer-switch, .drawer-toggle, .drawer-cat-link, .place-chip, .drawer-settings-btn, .icon-btn")) {
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
      goHome();
      return;
    }

    const catBtn = e.target.closest("[data-open-cat]");
    if (catBtn) {
      goCat(catBtn.dataset.openCat);
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

  // Edge / close swipe — ignore if gesture began on a control
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
        // Only close if swipe began near the drawer edge / outside interactive area
        if (activeCat && startX < 48) goHome();
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
    openCategory: (cat) => {
      setOpen(true);
      goCat(cat);
    },
  };
}
