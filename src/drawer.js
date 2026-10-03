import {
  MODULE_CATALOG,
  DRAWER_CATEGORIES,
  FONT_STEPS,
  ACCENT_OPTIONS,
  saveModuleEnabled,
  saveAppearance,
  applyAppearance,
} from "./prefsStore.js";

function toggleRow(mod, on) {
  return `
    <label class="drawer-toggle">
      <span class="drawer-toggle-meta">
        <span class="drawer-toggle-name">${mod.nameTc}</span>
        <span class="drawer-toggle-state">${on ? "加到主頁" : "唔加"}</span>
      </span>
      <input type="checkbox" data-mod="${mod.id}" ${on ? "checked" : ""} aria-label="${mod.nameTc}：${on ? "加到主頁" : "唔加"}" />
    </label>`;
}

/**
 * Left half-screen drawer: categories + module toggles + appearance.
 * Edge swipe from left or menu button.
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
        <h2>選單</h2>
        <button type="button" class="icon-btn" data-drawer-close aria-label="關閉">✕</button>
      </header>
      <p class="drawer-note">撳開關將資訊加到／移離主頁。全部只存呢部機。</p>
      <div class="drawer-body" id="drawer-body"></div>
    </aside>
  `;

  const backdrop = root.querySelector(".drawer-backdrop");
  const panel = root.querySelector("#drawer-panel");
  const body = root.querySelector("#drawer-body");

  let open = false;

  const render = () => {
    const enabled = getEnabled();
    const appearance = getAppearance();
    const blocks = [];

    for (const cat of DRAWER_CATEGORIES) {
      if (cat === "外觀") {
        blocks.push(`
          <section class="drawer-cat" data-cat="外觀">
            <h3>外觀</h3>
            <p class="muted">字體大小</p>
            <div class="drawer-chip-row">
              ${FONT_STEPS.map(
                (f) => `
                <button type="button" class="place-chip" data-font="${f.id}"
                  aria-pressed="${appearance.font === f.id}">${f.label}</button>`
              ).join("")}
            </div>
            <p class="muted" style="margin-top:0.55rem">主題色</p>
            <div class="drawer-chip-row">
              ${ACCENT_OPTIONS.map(
                (a) => `
                <button type="button" class="place-chip accent-chip" data-accent="${a.id}"
                  aria-pressed="${appearance.accent === a.id}"
                  style="--chip-accent:${a.value}">${a.label}</button>`
              ).join("")}
            </div>
          </section>
        `);
        continue;
      }

      if (cat === "設定") {
        const mods = MODULE_CATALOG.filter((m) => m.category === "設定");
        blocks.push(`
          <section class="drawer-cat" data-cat="設定">
            <h3>設定</h3>
            ${mods.map((m) => toggleRow(m, enabled[m.id])).join("")}
            <button type="button" class="tab drawer-settings-btn" data-open-settings>巴士／港鐵／天氣地區設定…</button>
          </section>
        `);
        continue;
      }

      const mods = MODULE_CATALOG.filter((m) => m.category === cat);
      if (!mods.length) continue;
      blocks.push(`
        <section class="drawer-cat" data-cat="${cat}">
          <h3>${cat}</h3>
          ${mods.map((m) => toggleRow(m, enabled[m.id])).join("")}
        </section>
      `);
    }

    body.innerHTML = blocks.join("");
  };

  const setOpen = (next) => {
    open = next;
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    backdrop.hidden = !open;
    document.body.classList.toggle("drawer-open", open);
  };

  const toggle = () => setOpen(!open);

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-drawer-close]")) {
      setOpen(false);
      return;
    }
    if (e.target.closest("[data-open-settings]")) {
      setOpen(false);
      onOpenSettings?.();
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

  body.addEventListener("change", (e) => {
    const input = e.target.closest("input[data-mod]");
    if (!input) return;
    const id = input.dataset.mod;
    const enabled = { ...getEnabled(), [id]: input.checked };
    saveModuleEnabled(enabled);
    setEnabled(enabled);
    onEnabledChange?.(enabled);
    render();
  });

  // Edge swipe from left
  let touchStartX = null;
  let touchStartY = null;
  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchend",
    (e) => {
      if (touchStartX == null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = Math.abs(t.clientY - touchStartY);
      if (!open && touchStartX < 24 && dx > 60 && dy < 50) setOpen(true);
      if (open && dx < -60 && dy < 50) setOpen(false);
      touchStartX = null;
    },
    { passive: true }
  );

  render();
  return { open: () => setOpen(true), close: () => setOpen(false), toggle, render };
}
