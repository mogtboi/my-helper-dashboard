/**
 * MTR line service status (RYG). Best-effort — may be blocked by CORS on Pages.
 */
const STATUS_URL = "https://www.mtr.com.hk/alert/ryg_line_status.json";

const STATUS_TC = {
  green: "正常",
  yellow: "留意",
  red: "受阻",
  grey: "暫停／維修",
};

export function createMtrStatus(root, { onStatus } = {}) {
  let timer = null;
  let last = null;

  const paint = (data, err) => {
    if (err && !last) {
      root.innerHTML = `
        <p class="error">車務資料暫讀唔到：${err}</p>
        <p class="muted">若瀏覽器封鎖跨域，請睇 <a class="inline-link" href="https://www.mtr.com.hk/" target="_blank" rel="noopener noreferrer">mtr.com.hk</a>。</p>
      `;
      return;
    }
    const payload = data || last;
    const lines = payload?.ryg_status?.line || [];
    const built = payload?.ryg_status?.lastBuildDate || "—";
    const alerts = lines.filter((l) => l.status && l.status !== "green");
    const rows = (alerts.length ? alerts : lines).map((l) => {
      const st = STATUS_TC[l.status] || l.status;
      const msg = (l.messages || "").trim();
      return `<li class="eta-item mtr-status-item status-${l.status || "green"}">
        <span class="eta-dest">${l.line_name_tc || l.line_code}${msg ? ` · ${msg}` : ""}</span>
        <span class="eta-mins">${st}</span>
      </li>`;
    });

    root.innerHTML = `
      <div class="eta-dir">${alerts.length ? `留意 ${alerts.length} 條綫` : "各綫大致正常"} · 更新 ${built}</div>
      <ul class="eta-list">${rows.join("")}</ul>
      ${err ? `<p class="error">刷新失敗，顯示上次資料</p>` : ""}
      <p class="device-local-hint">港鐵 RYG 車務 · 公開狀態檔（若 CORS 阻擋會顯示提示）</p>
    `;
  };

  const refresh = async () => {
    try {
      const res = await fetch(STATUS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      last = data;
      paint(data, null);
      onStatus?.("港鐵車務已更新");
    } catch (e) {
      paint(null, e.message || "網絡／跨域錯誤");
      onStatus?.("港鐵車務更新失敗");
    }
  };

  const start = () => {
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 3 * 60 * 1000);
    document.addEventListener("visibilitychange", onVis);
  };

  const onVis = () => {
    if (document.visibilityState === "visible") refresh();
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  };

  return { start, refresh, destroy };
}
