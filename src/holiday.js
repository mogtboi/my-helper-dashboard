/**
 * HK public holiday countdown panel.
 * Data: same-origin ./data/hk-holidays.json (from 1823 + statutory tags).
 * types: general (公眾假期), statutory (勞工假), bank (銀行假)
 */

function todayIso(timeZone = "Asia/Hong_Kong") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysUntil(isoDate, today) {
  const a = new Date(`${today}T00:00:00+08:00`);
  const b = new Date(`${isoDate}T00:00:00+08:00`);
  return Math.round((b - a) / 86400000);
}

function typeLabels(types) {
  const map = { general: "公眾假期", statutory: "勞工假", bank: "銀行假" };
  return (types || []).map((t) => map[t] || t).join(" · ");
}

function monthPrefix(isoDate) {
  return isoDate.slice(0, 7); // YYYY-MM
}

function countStatutoryInMonth(list, ym) {
  return list.filter(
    (h) => h.date?.startsWith(ym) && Array.isArray(h.types) && h.types.includes("statutory")
  ).length;
}

export function createHoliday(root, { onStatus } = {}) {
  let timer = null;

  const render = (payload, err) => {
    if (err && !payload) {
      root.innerHTML = `<p class="error">假期資料暫無：${err}</p>`;
      return;
    }
    const today = todayIso();
    const ym = monthPrefix(today);
    const list = payload.holidays || [];
    const todayHit = list.find((h) => h.date === today);
    const upcoming = list.filter((h) => h.date >= today);
    const next = upcoming[0];
    const nextDays = next ? daysUntil(next.date, today) : null;
    const labourThisMonth = countStatutoryInMonth(list, ym);
    const [, monthNum] = ym.split("-");
    const monthLabel = `${Number(monthNum)} 月`;

    root.innerHTML = `
      <div class="holiday-today ${todayHit ? "is-holiday" : ""}">
        ${
          todayHit
            ? `<strong>今日係假期</strong><div class="muted">${todayHit.nameTc} · ${typeLabels(todayHit.types)}</div>`
            : `<strong>今日唔係公眾假期</strong><div class="muted">${today}</div>`
        }
      </div>
      <div class="holiday-month-stat">
        <div class="eta-dir">本月勞工假</div>
        <div class="holiday-countdown">${labourThisMonth} 日</div>
        <div class="muted">${monthLabel}共有 ${labourThisMonth} 個法定／勞工假期</div>
      </div>
      ${
        next
          ? `<div class="holiday-next">
              <div class="eta-dir">下一公眾假期</div>
              <div class="holiday-countdown">${nextDays === 0 ? "就係今日" : `${nextDays} 日後`}</div>
              <div class="weather-meta">${next.date} · ${next.nameTc}</div>
              <div class="muted">${typeLabels(next.types)}</div>
            </div>`
          : `<p class="muted">未有之後假期資料</p>`
      }
      <p class="device-local-hint">來源：1823 公眾假期曆 · 勞工假／銀行假標籤為本機整理（銀行假大致等同一般公眾假期）</p>
    `;
  };

  const refresh = async () => {
    try {
      const res = await fetch("./data/hk-holidays.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data, null);
      onStatus?.("假期已更新");
    } catch (e) {
      render(null, e.message || "載入失敗");
      onStatus?.("假期更新失敗");
    }
  };

  const start = () => {
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 60 * 60 * 1000);
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
  };

  return { start, refresh, destroy };
}
