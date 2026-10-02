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

function formatUpdated(iso, locale, timeZone = "Asia/Hong_Kong") {
  try {
    return new Intl.DateTimeFormat(locale || "zh-HK", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function createWeather(root, weatherConfig, { onStatus } = {}) {
  root.innerHTML = `<p class="muted">載入天氣…</p>`;

  let lastPayload = null;

  const render = (data, err) => {
    if (err && !lastPayload) {
      root.innerHTML = `<p class="error">天氣暫無資料：${err}</p>`;
      return;
    }
    const payload = data || lastPayload;
    const temps = payload.temperature?.data || [];
    const place =
      temps.find((t) => t.place === weatherConfig.place) ||
      temps.find((t) => t.place.includes("大埔")) ||
      temps[0];
    const iconCode = Array.isArray(payload.icon) ? payload.icon[0] : payload.icon;
    const humidity = payload.humidity?.data?.[0]?.value;
    const rainfall = (payload.rainfall?.data || []).find((r) => r.place === "大埔");
    const warn = (payload.warningMessage || [])[0];
    const iconUrl = `${weatherConfig.iconBase}${iconCode}.png`;

    root.innerHTML = `
      <div class="weather-row">
        <img class="weather-icon" src="${iconUrl}" alt="" width="68" height="68" loading="lazy" />
        <div>
          <div class="weather-temp">${place ? `${place.value}°` : "—"}</div>
          <div class="weather-meta">
            ${place?.place || weatherConfig.place}
            · ${HKO_ICON_DESC[iconCode] || `圖示 ${iconCode}`}
            ${humidity != null ? `· 濕度 ${humidity}%` : ""}
          </div>
          ${
            rainfall
              ? `<div class="muted">大埔雨量 ${rainfall.min ?? 0}–${rainfall.max ?? 0} mm</div>`
              : ""
          }
        </div>
      </div>
      ${warn ? `<p class="muted" style="margin:0.65rem 0 0">${warn}</p>` : ""}
      <p class="muted" style="margin:0.55rem 0 0">更新 ${formatUpdated(payload.updateTime)}</p>
      ${err ? `<p class="error">刷新失敗，顯示上次資料</p>` : ""}
    `;
  };

  const fetchWeather = async () => {
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

  fetchWeather();
  const id = setInterval(fetchWeather, weatherConfig.refreshMs);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fetchWeather();
  });
  return () => clearInterval(id);
}
