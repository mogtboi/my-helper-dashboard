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

const REGIONS = [
  { id: "all", nameTc: "全部" },
  { id: "nt", nameTc: "新界" },
  { id: "kln", nameTc: "九龍" },
  { id: "hki", nameTc: "港島" },
  { id: "other", nameTc: "其他／跨區" },
];

/** Place-name cues for bucketing when TD district fields are empty. */
const REGION_KEYWORDS = {
  hki: [
    "港島",
    "香港島",
    "中西區",
    "灣仔區",
    "東區",
    "南區",
    "中環",
    "金鐘",
    "上環",
    "西環",
    "堅尼地城",
    "西營盤",
    "香港大學",
    "灣仔",
    "銅鑼灣",
    "跑馬地",
    "天后",
    "炮台山",
    "北角",
    "鰂魚涌",
    "太古",
    "西灣河",
    "筲箕灣",
    "杏花邨",
    "柴灣",
    "小西灣",
    "香港仔",
    "黃竹坑",
    "海洋公園",
    "海怡",
    "利東",
    "鴨脷洲",
    "赤柱",
    "淺水灣",
    "薄扶林",
    "數碼港",
    "會展",
    "添馬",
  ],
  kln: [
    "九龍",
    "九龍西",
    "九龍東",
    "九龍城",
    "九龍塘",
    "九龍灣",
    "西九",
    "西九龍",
    "西九文化區",
    "中九龍繞道",
    "油尖旺",
    "尖沙咀",
    "尖東",
    "佐敦",
    "油麻地",
    "旺角",
    "太子",
    "深水埗",
    "長沙灣",
    "荔枝角",
    "美孚",
    "石硤尾",
    "紅磡",
    "土瓜灣",
    "馬頭圍",
    "何文田",
    "黃埔",
    "黃大仙",
    "鑽石山",
    "樂富",
    "彩虹",
    "慈雲山",
    "觀塘",
    "牛頭角",
    "藍田",
    "油塘",
    "秀茂坪",
    "啟德",
    "宋皇臺",
    "柯士甸",
    "南昌",
    "奧運",
    "大角咀",
    "長沙灣道",
    "彌敦道",
    "博物館道",
    "文化道",
  ],
  nt: [
    "新界",
    "新界南",
    "新界西",
    "新界東",
    "荃灣",
    "葵涌",
    "葵芳",
    "葵青",
    "青衣",
    "荃青",
    "汀九",
    "屯門",
    "元朗",
    "天水圍",
    "大埔",
    "大埔墟",
    "太和",
    "粉嶺",
    "上水",
    "北區",
    "沙田",
    "大圍",
    "火炭",
    "馬場",
    "馬鞍山",
    "西貢",
    "將軍澳",
    "坑口",
    "寶琳",
    "康城",
    "調景嶺",
    "東涌",
    "大嶼山",
    "機場",
    "青嶼",
    "青馬",
    "大欖",
    "落馬洲",
    "羅湖",
    "離島",
    "屯門公路",
    "元朗公路",
    "粉嶺公路",
    "吐露港",
    "城門隧道",
    "大老山",
    "尖山隧道",
    "沙田嶺",
    "獅子山",
    "錦上路",
    "朗屏",
    "兆康",
    "欣澳",
    "迪士尼",
    "博覽館",
    "大學",
    "顯徑",
    "第一城",
    "石門",
    "恆安",
    "烏溪沙",
    "馬會道",
    "沙田圍路",
    "葵涌道",
    "大連排道",
  ],
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
  return cut.length > 48 ? `${cut.slice(0, 48)}…` : cut;
}

function regionFromText(text) {
  const hay = String(text || "");
  const hits = [];
  for (const [id, words] of Object.entries(REGION_KEYWORDS)) {
    if (words.some((w) => hay.includes(w))) hits.push(id);
  }
  if (hits.length === 1) return hits[0];
  return "other"; // none or multiple → 其他／跨區
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
      const region = regionFromText(`${short}\n${body}`);
      return {
        id: id || short.slice(0, 24),
        title: headingFromBody(short),
        detail: body,
        location: "",
        status: STATUS_TC[statusCode] || (statusCode ? `狀態 ${statusCode}` : ""),
        time,
        region,
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
      const district = textOf(msg, ["DISTRICT_CN", "DISTRICT_EN"]);
      const heading = textOf(msg, ["INCIDENT_HEADING_CN", "INCIDENT_HEADING_EN"]);
      const detailType = textOf(msg, ["INCIDENT_DETAIL_CN", "INCIDENT_DETAIL_EN"]);
      const body = textOf(msg, ["CONTENT_CN", "CONTENT_EN"]);
      const status = textOf(msg, ["INCIDENT_STATUS_CN", "INCIDENT_STATUS_EN"]);
      const time = textOf(msg, ["ANNOUNCEMENT_DATE"]);
      const id = textOf(msg, ["INCIDENT_NUMBER", "ID"]);
      const titleBits = [heading, detailType, location].filter(Boolean);
      const region = regionFromText(`${district} ${location} ${heading} ${body}`);
      return {
        id: id || location || heading,
        title: titleBits.join(" · ") || headingFromBody(body),
        detail: body,
        location: location || district,
        status,
        time,
        region,
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

function renderCards(list) {
  if (!list.length) {
    return `<p class="muted">呢個分類暫時冇消息。</p>`;
  }
  return `<div class="traffic-list">${list
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
        · ${escapeHtml(REGIONS.find((r) => r.id === m.region)?.nameTc || "其他／跨區")}
      </div>
    </article>`
    )
    .join("")}</div>`;
}

export function createTraffic(root, { onStatus } = {}) {
  let timer = null;
  let last = null;
  let activeRegion = "all";

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
    const counts = Object.fromEntries(REGIONS.map((r) => [r.id, 0]));
    counts.all = list.length;
    for (const m of list) {
      const id = REGIONS.some((r) => r.id === m.region) ? m.region : "other";
      counts[id] = (counts[id] || 0) + 1;
    }
    if (!REGIONS.some((r) => r.id === activeRegion)) activeRegion = "all";
    const filtered =
      activeRegion === "all" ? list : list.filter((m) => (m.region || "other") === activeRegion);

    root.innerHTML = `
      <div class="traffic-toolbar">
        <p class="muted traffic-summary">
          ${list.length ? `而家 ${list.length} 則特別交通消息` : "而家冇特別交通消息"}
          ${meta.source ? ` · ${escapeHtml(meta.source)}` : ""}
        </p>
        <button type="button" class="ghost-btn" data-traffic-refresh>重新整理</button>
      </div>
      <div class="traffic-region-tabs" role="tablist" aria-label="地區分類">
        ${REGIONS.map(
          (r) => `
          <button type="button" class="traffic-region-tab" role="tab"
            data-region="${r.id}" aria-selected="${activeRegion === r.id}">
            ${r.nameTc}${r.id === "all" ? "" : ` ${counts[r.id] || 0}`}
          </button>`
        ).join("")}
      </div>
      ${list.length ? renderCards(filtered) : `<p class="muted">暫時冇事故／特別安排消息。</p>`}
      ${err ? `<p class="error">部分更新失敗，顯示上次資料</p>` : ""}
      <p class="device-local-hint">運輸署特別交通消息 · 按內文地點歸入新界／九龍／港島；跨區或不清歸「其他／跨區」</p>
    `;

    root.querySelector("[data-traffic-refresh]")?.addEventListener("click", () => refresh());
    root.querySelector(".traffic-region-tabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-region]");
      if (!btn) return;
      activeRegion = btn.dataset.region;
      paint(list, err, meta);
    });
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
