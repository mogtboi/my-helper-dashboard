/** Device-local weather region. Never synced across devices. */
export const WEATHER_PLACE_KEY = "my-helper.weather.place.v1";

/** HKO rhrread temperature places (zh-HK labels from Open Data). */
export const WEATHER_PLACES = [
  "大埔",
  "大美督",
  "沙田",
  "元朗公園",
  "屯門",
  "荃灣可觀",
  "荃灣城門谷",
  "青衣",
  "石崗",
  "流浮山",
  "打鼓嶺",
  "西貢",
  "將軍澳",
  "觀塘",
  "黃大仙",
  "九龍城",
  "深水埗",
  "啟德跑道公園",
  "京士柏",
  "香港天文台",
  "香港公園",
  "跑馬地",
  "筲箕灣",
  "黃竹坑",
  "赤柱",
  "長洲",
  "赤鱲角",
];

export function loadWeatherPlace() {
  try {
    const raw = localStorage.getItem(WEATHER_PLACE_KEY);
    if (!raw) return null;
    const place = JSON.parse(raw);
    if (typeof place === "string" && WEATHER_PLACES.includes(place)) return place;
    return null;
  } catch {
    return null;
  }
}

export function saveWeatherPlace(place) {
  if (!WEATHER_PLACES.includes(place)) {
    throw new Error("invalid weather place");
  }
  localStorage.setItem(WEATHER_PLACE_KEY, JSON.stringify(place));
  return place;
}

export function clearWeatherPlace() {
  localStorage.removeItem(WEATHER_PLACE_KEY);
}
