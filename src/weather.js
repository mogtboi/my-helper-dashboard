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

function pickTemp(temps, place) {
  if (!place) return null;
  return (
    temps.find((t) => t.place === place) ||
    temps.find((t) => t.place.includes(place)) ||
    null
  );
}

function pickRainfall(rows, place) {
  if (!place || !rows?.length) return null;
  return (
    rows.find((r) => r.place === place) ||
    rows.find((r) => r.place?.includes?.(place.replace("公園", ""))) ||
    null
  );
}

/**
 * Weather panel. Call setPlace(place) after region picker / settings.
 * Does not fetch until a place is set.
 */
export function createWeather(root, weatherConfig, { onStatus, onChangePlace } = {}) {
  let place = null;
  let lastPayload = null;
  let timer = null;

  const render = (data, err) => {
    if (!place) {
      root.innerHTML = `
        <p class="muted">請先揀天氣地區</p>
        <button type="button" class="tab" id="weather-pick-btn">揀地區</button>
      `;
      root.querySelector("#weather-pick-btn")?.addEventListener("click", () => {
        onChangePlace?.();
      });
      return;
    }
    if (err && !lastPayload) {
      root.innerHTML = `<p class="error">天氣暫無資料：${err}</p>`;
      return;
    }
    const payload = data || lastPayload;
    const temps = payload.temperature?.data || [];
    const hit = pickTemp(temps, place) || temps[0];
    const iconCode = Array.isArray(payload.icon) ? payload.icon[0] : payload.icon;
    const humidity = payload.humidity?.data?.[0]?.value;
    const rainfall = pickRainfall(payload.rainfall?.data || [], place);
    const warn = (payload.warningMessage || [])[0];
    const iconUrl = `${weatherConfig.iconBase}${iconCode}.png`;
    const shownPlace = hit?.place || place;

    root.innerHTML = `
      <div class="weather-row">
        <img class="weather-icon" src="${iconUrl}" alt="" width="68" height="68" loading="lazy" />
        <div>
          <div class="weather-temp">${hit ? `${hit.value}°` : "—"}</div>
          <div class="weather-meta">
            ${shownPlace}
            · ${HKO_ICON_DESC[iconCode] || `圖示 ${iconCode}`}
            ${humidity != null ? `· 濕度 ${humidity}%` : ""}
          </div>
          ${
            rainfall
              ? `<div class="muted">雨量 ${rainfall.min ?? 0}–${rainfall.max ?? 0} mm</div>`
              : ""
          }
        </div>
      </div>
      ${warn ? `<p class="muted weather-warn">${warn}</p>` : ""}
      <div class="weather-foot">
        <p class="muted">更新 ${formatUpdated(payload.updateTime)}</p>
        <button type="button" class="ghost-btn" id="weather-change-btn">轉地區</button>
      </div>
      ${err ? `<p class="error">刷新失敗，顯示上次資料</p>` : ""}
    `;
    root.querySelector("#weather-change-btn")?.addEventListener("click", () => {
      onChangePlace?.();
    });
  };

  const fetchWeather = async () => {
    if (!place) {
      render(null, null);
      return;
    }
    try {
      const res = await fetch(weatherConfig.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      lastPayload = data;
      render(data, null);
      onStatus?.("天氣已更新");
    } catch (e) {
      render(null, e.message || "網絡錯誤");
      onStatus?.("天氣更新失敗");
    }
  };

  const setPlace = (next) => {
    place = next;
    fetchWeather();
  };

  const start = (initialPlace) => {
    place = initialPlace;
    fetchWeather();
    if (timer) clearInterval(timer);
    timer = setInterval(fetchWeather, weatherConfig.refreshMs);
    document.addEventListener("visibilitychange", onVis);
  };

  const onVis = () => {
    if (document.visibilityState === "visible") fetchWeather();
  };

  const destroy = () => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  };

  return { start, setPlace, refresh: fetchWeather, destroy };
}
