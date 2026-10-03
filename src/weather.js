import { districtById } from "./weatherStore.js";

const HKO_ICON_DESC = {
  50: "陽光充沛",
  51: "間有陽光",
  52: "短暫陽光",
  53: "間中有陽光",
  54: "有煙霞",
  60: "多雲",
  61: "陰天",
  62: "微雨",
  63: "雨",
  64: "大雨",
  65: "雷暴",
};

const AQHI_DISTRICT = {
  中西區: ["Central/Western", "Central"],
  灣仔: ["Causeway Bay", "Eastern"],
  東區: ["Eastern"],
  南區: ["Southern"],
  油尖旺: ["Mong Kok"],
  深水埗: ["Sham Shui Po"],
  九龍城: ["Kwun Tong"],
  黃大仙: ["Kwun Tong"],
  觀塘: ["Kwun Tong"],
  葵青: ["Kwai Chung"],
  荃灣: ["Tsuen Wan"],
  屯門: ["Tuen Mun"],
  元朗: ["Yuen Long"],
  北區: ["North"],
  大埔: ["Tai Po"],
  沙田: ["Sha Tin"],
  西貢: ["Tseung Kwan O"],
  離島: ["Tung Chung"],
};

function formatUpdated(iso) {
  try {
    return new Intl.DateTimeFormat("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function pickTemp(temps, hkoTemp) {
  if (!hkoTemp) return null;
  return (
    temps.find((t) => t.place === hkoTemp) ||
    temps.find((t) => t.place.includes(hkoTemp)) ||
    null
  );
}

function pickRainfall(rows, hkoRain) {
  if (!hkoRain || !rows?.length) return null;
  return (
    rows.find((r) => r.place === hkoRain) ||
    rows.find((r) => r.place?.includes?.(hkoRain)) ||
    null
  );
}

function warnList(warnsum) {
  if (!warnsum || typeof warnsum !== "object") return [];
  return Object.values(warnsum)
    .filter((w) => w && (w.name || w.code || w.type))
    .map((w) => ({
      name: w.name || w.code || "警告",
      action: w.actionCode || w.type || "",
      issue: w.issueTime || "",
    }));
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Weather panel for HK 18 districts + warnings / UV / AQHI / sunrise / humidity.
 */
export function createWeather(root, weatherConfig, { onStatus, onChangePlace } = {}) {
  let place = null;
  let last = null;
  let timer = null;

  const render = () => {
    const district = districtById(place);
    if (!place || !district) {
      root.innerHTML = `
        <p class="muted">請先揀十八區天氣</p>
        <button type="button" class="tab" id="weather-pick-btn">揀地區</button>
      `;
      root.querySelector("#weather-pick-btn")?.addEventListener("click", () => onChangePlace?.());
      return;
    }
    if (!last?.rhr) {
      root.innerHTML = `<p class="muted">載入天氣…</p>`;
      return;
    }

    const payload = last.rhr;
    const temps = payload.temperature?.data || [];
    const hit = pickTemp(temps, district.hkoTemp) || temps[0];
    const iconCode = Array.isArray(payload.icon) ? payload.icon[0] : payload.icon;
    const humidity = payload.humidity?.data?.[0];
    const rainfall = pickRainfall(payload.rainfall?.data || [], district.hkoRain);
    const uv = payload.uvindex?.data?.[0];
    const warnMsgs = payload.warningMessage || [];
    const warns = warnList(last.warnsum);
    const aqhi = last.aqhi;
    const sun = last.sun;
    const fndRh = last.fnd?.weatherForecast?.[0];

    const iconUrl = `${weatherConfig.iconBase}${iconCode}.png`;
    const humTrend =
      fndRh?.forecastMaxrh && fndRh?.forecastMinrh
        ? `明日濕度約 ${fndRh.forecastMinrh.value}–${fndRh.forecastMaxrh.value}%`
        : "";

    root.innerHTML = `
      <div class="weather-row">
        <img class="weather-icon" src="${iconUrl}" alt="" width="68" height="68" loading="lazy" />
        <div>
          <div class="weather-temp">${hit ? `${hit.value}°` : "—"}</div>
          <div class="weather-meta">
            ${district.nameTc}
            · ${HKO_ICON_DESC[iconCode] || `圖示 ${iconCode}`}
          </div>
          <div class="weather-meta">
            濕度 ${humidity?.value ?? "—"}%${humidity?.place ? `（${humidity.place}）` : ""}
            ${uv ? ` · UV ${uv.value} ${uv.desc || ""}` : ""}
          </div>
          ${humTrend ? `<div class="muted">${humTrend}</div>` : ""}
          ${
            rainfall
              ? `<div class="muted">雨量 ${rainfall.min ?? 0}–${rainfall.max ?? 0} mm</div>`
              : ""
          }
        </div>
      </div>

      ${
        sun
          ? `<div class="weather-extras">日出 ${sun.rise} · 正午 ${sun.tran} · 日落 ${sun.set}</div>`
          : ""
      }

      ${
        aqhi
          ? `<div class="weather-extras">空氣質素 AQHI ${aqhi.aqhi} · ${aqhi.health_risk || ""}（${aqhi.station}）</div>`
          : ""
      }

      ${
        warns.length || warnMsgs.length
          ? `<div class="weather-warns">
              ${warns.map((w) => `<div class="warn-chip">${w.name}${w.action ? ` · ${w.action}` : ""}</div>`).join("")}
              ${warnMsgs.map((m) => `<p class="muted weather-warn">${m}</p>`).join("")}
            </div>`
          : `<div class="muted weather-warns">而家冇生效天氣警告</div>`
      }

      <div class="weather-foot">
        <p class="muted">更新 ${formatUpdated(payload.updateTime)}</p>
        <button type="button" class="ghost-btn" id="weather-change-btn">轉地區</button>
      </div>
      ${last.err ? `<p class="error">部分資料刷新失敗</p>` : ""}
    `;
    root.querySelector("#weather-change-btn")?.addEventListener("click", () => onChangePlace?.());
  };

  const fetchAll = async () => {
    if (!place || !districtById(place)) {
      render();
      return;
    }
    const district = districtById(place);
    const year = todayIso().slice(0, 4);
    const errors = [];
    try {
      const [rhr, warnsum, aqhiList, sunData, fnd] = await Promise.all([
        fetchJson(weatherConfig.url).catch((e) => {
          errors.push(e.message);
          return last?.rhr || null;
        }),
        fetchJson(
          "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc"
        ).catch(() => ({})),
        fetchJson("https://dashboard.data.gov.hk/api/aqhi-individual?lang=zh").catch(() => null),
        fetchJson(
          `https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=SRS&lang=tc&rformat=json&year=${year}`
        ).catch(() => null),
        fetchJson(
          "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=tc"
        ).catch(() => null),
      ]);

      if (!rhr) {
        root.innerHTML = `<p class="error">天氣暫無資料${errors[0] ? `：${errors[0]}` : ""}</p>`;
        onStatus?.("天氣更新失敗");
        return;
      }

      let aqhi = null;
      if (Array.isArray(aqhiList)) {
        const prefer = AQHI_DISTRICT[district.id] || [];
        aqhi =
          prefer.map((n) => aqhiList.find((a) => a.station === n)).find(Boolean) ||
          aqhiList[0] ||
          null;
      }

      let sun = null;
      if (sunData?.data) {
        const row = sunData.data.find((r) => r[0] === todayIso());
        if (row) sun = { rise: row[1], tran: row[2], set: row[3] };
      }

      last = { rhr, warnsum, aqhi, sun, fnd, err: errors.length ? errors.join(",") : null };
      render();
      onStatus?.(errors.length ? "天氣部分更新失敗" : "天氣已更新");
    } catch (e) {
      root.innerHTML = `<p class="error">天氣暫無資料：${e.message || e}</p>`;
      onStatus?.("天氣更新失敗");
    }
  };

  const setPlace = (next) => {
    place = next;
    fetchAll();
  };

  const start = (initialPlace) => {
    place = initialPlace;
    fetchAll();
    if (timer) clearInterval(timer);
    timer = setInterval(fetchAll, weatherConfig.refreshMs);
    document.addEventListener("visibilitychange", onVis);
  };

  const onVis = () => {
    if (document.visibilityState === "visible") fetchAll();
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  };

  return { start, setPlace, refresh: fetchAll, destroy };
}
