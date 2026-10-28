import { districtById } from "./weatherStore.js";
import { escapeHtml } from "./escapeHtml.js";

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

/** One line from data the card already loaded. Wording is ours; numbers come from HKO. */
export function weatherTip({ temp, humidity, uvValue, uvDesc, rainfallMax, warningText, iconCode } = {}) {
  const warns = String(warningText || "");
  const rainWarn = /雨|雷暴|水浸|洪水/.test(warns);
  const hotWarn = /酷熱|熱浪|炎熱/.test(warns);
  const coldWarn = /寒冷|霜凍/.test(warns);
  const t = Number(temp);
  const uv = Number(uvValue);
  const rain = Number(rainfallMax);
  const rainyIcon = [62, 63, 64, 65].includes(Number(iconCode));
  const uvHigh = (Number.isFinite(uv) && uv >= 8) || /極高|甚高/.test(String(uvDesc || ""));
  if (rainWarn || rainyIcon || (Number.isFinite(rain) && rain > 0)) {
    return "☔ 有雨／降雨率高，出門記得帶遮";
  }
  if (coldWarn || (Number.isFinite(t) && t <= 18)) {
    return "🧥 天氣清涼，建議帶件薄外套";
  }
  if (hotWarn || (Number.isFinite(t) && t >= 31) || uvHigh) {
    if (hotWarn || (Number.isFinite(t) && t >= 31)) return "☀️ 酷熱＋UV極高，宜著淺色短袖及防曬";
    return "☀️ UV 偏高，記得防曬";
  }
  if (Number.isFinite(Number(humidity)) && Number(humidity) >= 90) return "💧 濕度高，感覺會比較悶";
  return "🌤️ 天氣大致穩定，出門都幾方便";
}

export function forecastHtml(fnd) {
  const days = Array.isArray(fnd?.weatherForecast) ? fnd.weatherForecast.slice(0, 9) : [];
  if (!days.length) return `<p class="muted">九日預報暫無</p>`;
  return `<div class="weather-fnd-scroll">${days
    .map((day) => {
      const min = day?.forecastMintemp?.value;
      const max = day?.forecastMaxtemp?.value;
      return `<article class="weather-fnd-day">
        <div class="weather-fnd-week">${escapeHtml(day?.week || "")}</div>
        <div class="weather-fnd-text">${escapeHtml(day?.forecastWeather || "")}</div>
        <div class="weather-fnd-temp">${escapeHtml(min ?? "—")}–${escapeHtml(max ?? "—")}°</div>
        <div class="weather-fnd-psr">PSR ${escapeHtml(day?.PSR || "—")}</div>
      </article>`;
    })
    .join("")}</div>`;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Weather panel for HK 18 districts + warnings / UV / AQHI / sunrise / humidity.
 */
function rainfallLine(rainfall) {
  if (!rainfall) return "";
  const min = Number(rainfall.min ?? 0);
  const max = Number(rainfall.max ?? 0);
  const a = Number.isFinite(min) ? min : 0;
  const b = Number.isFinite(max) ? max : 0;
  if (a === b) return `<div class="muted">雨量 ${a} mm</div>`;
  return `<div class="muted">雨量 ${a}–${b} mm</div>`;
}

export function createWeather(root, weatherConfig, { onStatus, onChangePlace, onDigest } = {}) {
  let place = null;
  let last = null;
  let timer = null;
  let forecastOpen = false;
  let digest = { temp: null, warning: "" };

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

    const tip = weatherTip({
      temp: hit?.value,
      humidity: humidity?.value,
      uvValue: uv?.value,
      uvDesc: uv?.desc,
      rainfallMax: rainfall?.max,
      warningText: [...warns.map((w) => w.name), ...warnMsgs].join(" "),
      iconCode,
    });
    const warning = warns[0]?.name || (warnMsgs[0] ? String(warnMsgs[0]).replace(/\s+/g, " ").slice(0, 18) : "");
    digest = { temp: hit?.value ?? null, warning };
    onDigest?.();
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
          ${rainfallLine(rainfall)}
        </div>
      </div>
      <p class="weather-tip">${escapeHtml(tip)}</p>

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
      <button type="button" class="weather-fnd-btn" id="weather-fnd-btn" aria-expanded="${forecastOpen ? "true" : "false"}">📅 未來 9 日天氣 ${forecastOpen ? "▴" : "▾"}</button>
      <div class="weather-fnd" ${forecastOpen ? "" : "hidden"}>${forecastHtml(last.fnd)}</div>
      ${last.err ? `<p class="error">部分資料刷新失敗</p>` : ""}
    `;
    root.querySelector("#weather-change-btn")?.addEventListener("click", () => onChangePlace?.());
    root.querySelector("#weather-fnd-btn")?.addEventListener("click", () => {
      forecastOpen = !forecastOpen;
      render();
    });
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

  return { start, setPlace, refresh: fetchAll, destroy, getDigest: () => digest };
}
