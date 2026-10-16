import { escapeHtml } from "./escapeHtml.js";

/** Freshness label for last successful fetch. */
export function freshnessLabel(lastFetchAt, now = Date.now()) {
  if (!lastFetchAt) return "—";
  const sec = Math.max(0, Math.round((now - lastFetchAt) / 1000));
  if (sec < 3) return "剛更新";
  return `${sec} 秒前`;
}

export function freshnessBarHtml(idPrefix) {
  return `
    <div class="transit-fresh" aria-live="polite">
      <span class="transit-fresh-label" id="${idPrefix}-fresh">—</span>
      <button type="button" class="transit-refresh-btn" id="${idPrefix}-refresh"
        aria-label="重新整理 ETA" title="重新整理">
        <svg class="transit-refresh-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6c-2.62 0-4.83-1.69-5.65-4H4.26C5.13 16.98 8.28 20 12 20c4.42 0 8-3.58 8-8s-3.58-8-8-8z"/>
        </svg>
      </button>
    </div>`;
}

/** Platform → small badge text, e.g. ① 號月台 */
export function platBadge(plat) {
  if (plat == null || plat === "") return "";
  const n = String(plat).trim();
  const circled = {
    1: "①",
    2: "②",
    3: "③",
    4: "④",
    5: "⑤",
    6: "⑥",
    7: "⑦",
    8: "⑧",
    9: "⑨",
  };
  const mark = circled[n] || n;
  return `${mark} 號月台`;
}

function primaryEtaText(item) {
  if (!item) return "—";
  if (item.mins === 0 || item.label === "即將到達") return "即將到達";
  if (item.mins == null) return item.label || "—";
  return `${item.mins}`;
}

function primaryUnit(item) {
  if (!item) return "";
  if (item.mins === 0 || item.label === "即將到達") return "";
  if (item.mins == null) return "";
  return "分";
}

function isUrgent(item) {
  if (!item) return false;
  if (item.mins === 0 || item.label === "即將到達") return true;
  return typeof item.mins === "number" && item.mins <= 2;
}

function nextLine(items) {
  const rest = (items || []).slice(1, 3);
  if (!rest.length) return "";
  const bits = rest.map((it) => {
    if (it.mins === 0) return "即將";
    if (it.mins == null) return "—";
    return `${it.mins}分`;
  });
  return `<div class="eta-next">次班: ${bits.map((b) => escapeHtml(b)).join(" · ")}</div>`;
}

/**
 * Compact ETA card: left meta, right focus ETA, next departures under.
 * items: [{ mins, label?, dest?, rmk?, plat? }]
 */
export function compactEtaCard({
  routeBadge,
  badgeColor,
  dest,
  stopName,
  items,
  reason,
  plat,
  extraActions = "",
}) {
  const list = items || [];
  if (!list.length) {
    const body = reason
      ? `<p class="eta-reason">${escapeHtml(reason)}</p>`
      : `<p class="muted">暫時冇班次</p>`;
    return `
      <article class="eta-card">
        <div class="eta-card-main">
          <div class="eta-card-left">
            <div class="eta-card-route-row">
              <span class="eta-route-badge" style="${badgeColor ? `background:${badgeColor}` : ""}">${escapeHtml(routeBadge || "")}</span>
              <span class="eta-card-dest">往${escapeHtml(dest || "—")}${
                plat
                  ? `<span class="eta-plat-badge">${escapeHtml(platBadge(plat))}</span>`
                  : ""
              }</span>
            </div>
            <div class="eta-card-stop">${escapeHtml(stopName || "")}</div>
          </div>
          <div class="eta-card-right muted">—</div>
        </div>
        ${body}
        ${extraActions}
      </article>`;
  }

  const first = list[0];
  const urgent = isUrgent(first) ? " is-urgent" : "";
  const destText = dest || first.dest || "—";
  const platShow = plat || first.plat;

  return `
    <article class="eta-card">
      <div class="eta-card-main">
        <div class="eta-card-left">
          <div class="eta-card-route-row">
            <span class="eta-route-badge" style="${badgeColor ? `background:${badgeColor}` : ""}">${escapeHtml(routeBadge || "")}</span>
            <span class="eta-card-dest">往${escapeHtml(destText)}${
              platShow
                ? `<span class="eta-plat-badge">${escapeHtml(platBadge(platShow))}</span>`
                : ""
            }</span>
          </div>
          <div class="eta-card-stop">${escapeHtml(stopName || "")}</div>
          ${first.rmk ? `<div class="eta-card-rmk muted">${escapeHtml(first.rmk)}</div>` : ""}
        </div>
        <div class="eta-card-right">
          <div class="eta-focus${urgent}">
            <span class="eta-focus-num">${escapeHtml(primaryEtaText(first))}</span>
            <span class="eta-focus-unit">${escapeHtml(primaryUnit(first))}</span>
          </div>
          ${nextLine(list)}
        </div>
      </div>
      ${extraActions}
    </article>`;
}

/** Debounced manual refresh with spin class on button. */
export function makeRefreshController({ button, onRefresh, cooldownMs = 1200 }) {
  let busy = false;
  let lastTap = 0;

  const run = async () => {
    const now = Date.now();
    if (busy || now - lastTap < cooldownMs) return;
    lastTap = now;
    busy = true;
    button?.classList.add("is-spinning");
    button?.setAttribute("disabled", "true");
    try {
      await onRefresh?.();
    } finally {
      window.setTimeout(() => {
        busy = false;
        button?.classList.remove("is-spinning");
        button?.removeAttribute("disabled");
      }, cooldownMs);
    }
  };

  button?.addEventListener("click", (e) => {
    e.preventDefault();
    run();
  });

  return { run };
}
