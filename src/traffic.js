/**
 * HK Transport Department special traffic news (特別交通消息).
 * Source: DATA.GOV.HK / data.one.gov.hk TC XML (CORS-enabled).
 * Fallback: td.gov.hk trafficnews.xml (also CORS-enabled).
 */

const PRIMARY_URL = "https://resource.data.one.gov.hk/td/tc/specialtrafficnews.xml";
const FALLBACK_URL = "https://www.td.gov.hk/tc/special_news/trafficnews.xml";

const STATUS_TC = {
  1: "已解除",
  2: "最新",
  3: "更新",
};

function textOf(el, names) {
  if (!el) return "";
  for (const name of names) {
    const hit =
      el.getElementsByTagNameNS("*", name)[0] || el.getElementsByTagName(name)[0];
    if (hit?.textContent?.trim()) return hit.textContent.trim();
  }
  return "";
}

function headingFromBody(body) {
  const compact = (body || "").replace(/\s+/g, " ").trim();
  if (!compact) return "特別交通消息";
  const cut = compact.split(/[。！？\n]/)[0] || compact;
  return cut.length > 42 ? `${cut.slice(0, 42)}…` : cut;
}

function parseDataOneXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML 解析失敗");
  const messages = [...doc.getElementsByTagNameNS("*", "message")];
  return messages
    .map((msg) => {
      const id = textOf(msg, ["msgID", "ID"]);
      const statusCode = textOf(msg, ["CurrentStatus"]);
      const body = textOf(msg, ["ChinText", "ChinShort"]) || textOf(msg, ["EngText"]);
      const short = textOf(msg, ["ChinShort"]) || body;
      const time = textOf(msg, ["ReferenceDate"]);
      return {
        id: id || short.slice(0, 24),
        title: headingFromBody(short),
        detail: body,
        location: "",
        status: STATUS_TC[statusCode] || (statusCode ? `狀態 ${statusCode}` : ""),
        time,
        source: "data.one.gov.hk",
      };
    })
    .filter((m) => m.detail || m.title);
}

function parseTdXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML 解析失敗");
  const messages = [...doc.getElementsByTagName("message")];
  return messages
    .map((msg) => {
      const location = textOf(msg, ["LOCATION_CN", "LOCATION_EN"]);
      const heading = textOf(msg, ["INCIDENT_HEADING_CN", "INCIDENT_HEADING_EN"]);
      const detailType = textOf(msg, ["INCIDENT_DETAIL_CN", "INCIDENT_DETAIL_EN"]);
      const body = textOf(msg, ["CONTENT_CN", "CONTENT_EN"]);
      const status = textOf(msg, ["INCIDENT_STATUS_CN", "INCIDENT_STATUS_EN"]);
      const time = textOf(msg, ["ANNOUNCEMENT_DATE"]);
      const id = textOf(msg, ["INCIDENT_NUMBER", "ID"]);
      const titleBits = [heading, detailType, location].filter(Boolean);
      return {
        id: id || location || heading,
        title: titleBits.join(" · ") || headingFromBody(body),
        detail: body,
        location,
        status,
        time,
        source: "td.gov.hk",
      };
    })
    .filter((m) => m.detail || m.title);
}

async function fetchXml(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createTraffic(root, { onStatus } = {}) {
  let timer = null;
  let last = null;

  const paint = (items, err, meta = {}) => {
    if (err && !items?.length) {
      root.innerHTML = `
        <p class="error">交通消息暫讀唔到：${escapeHtml(err)}</p>
        <p class="muted">來源：運輸署特別交通消息（公開 XML）。若網絡或跨域受阻，請稍後再試，或睇
          <a class="inline-link" href="https://www.td.gov.hk/tc/special_news/spnews.htm" target="_blank" rel="noopener noreferrer">運輸署特別交通消息</a>。
        </p>
        <button type="button" class="tab" data-traffic-refresh>再試</button>
      `;
      root.querySelector("[data-traffic-refresh]")?.addEventListener("click", () => refresh());
      return;
    }

    const list = items || [];
    const rows = list
      .map(
        (m) => `
      <article class="traffic-card">
        <header class="traffic-card-head">
          <h3 class="traffic-card-title">${escapeHtml(m.title)}</h3>
          ${m.status ? `<span class="traffic-status">${escapeHtml(m.status)}</span>` : ""}
        </header>
        ${m.location ? `<div class="traffic-loc">地點：${escapeHtml(m.location)}</div>` : ""}
        <p class="traffic-body">${escapeHtml(m.detail)}</p>
        <div class="traffic-meta muted">
          ${m.time ? `時間：${escapeHtml(m.time)}` : "時間：—"}
        </div>
      </article>`
      )
      .join("");

    root.innerHTML = `
      <div class="traffic-toolbar">
        <p class="muted traffic-summary">
          ${list.length ? `而家 ${list.length} 則特別交通消息` : "而家冇特別交通消息"}
          ${meta.source ? ` · ${escapeHtml(meta.source)}` : ""}
        </p>
        <button type="button" class="ghost-btn" data-traffic-refresh>重新整理</button>
      </div>
      ${list.length ? `<div class="traffic-list">${rows}</div>` : `<p class="muted">暫時冇事故／特別安排消息。</p>`}
      ${err ? `<p class="error">部分更新失敗，顯示上次資料</p>` : ""}
      <p class="device-local-hint">運輸署特別交通消息 · 公開實時 XML（data.one.gov.hk／td.gov.hk）</p>
    `;
    root.querySelector("[data-traffic-refresh]")?.addEventListener("click", () => refresh());
  };

  const refresh = async () => {
    let err = null;
    try {
      const xml = await fetchXml(PRIMARY_URL);
      const items = parseDataOneXml(xml);
      last = { items, source: "data.one.gov.hk／運輸署" };
      paint(items, null, last);
      onStatus?.("交通消息已更新");
      return;
    } catch (e) {
      err = e.message || "載入失敗";
    }
    try {
      const xml = await fetchXml(FALLBACK_URL);
      const items = parseTdXml(xml);
      last = { items, source: "td.gov.hk" };
      paint(items, err ? `主來源失敗（${err}），已用後備` : null, last);
      onStatus?.(err ? "交通消息（後備來源）" : "交通消息已更新");
    } catch (e2) {
      paint(last?.items || null, err || e2.message || "載入失敗", last || {});
      onStatus?.("交通消息更新失敗");
    }
  };

  const start = () => {
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 2 * 60 * 1000);
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
