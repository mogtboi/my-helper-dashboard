/** Device-local weather district. Never synced across devices. */
export const WEATHER_PLACE_KEY = "my-helper.weather.district.v2";
/** Legacy key — ignored except to clear on migrate. */
const LEGACY_PLACE_KEY = "my-helper.weather.place.v1";

/**
 * Hong Kong 18 districts (十八區).
 * `hkoTemp` = nearest HKO rhrread temperature station label.
 * Rainfall Open Data already uses district names (離島區).
 */
export const WEATHER_DISTRICTS = [
  { id: "中西區", nameTc: "中西區", hkoTemp: "香港公園", hkoRain: "中西區" },
  { id: "灣仔", nameTc: "灣仔區", hkoTemp: "跑馬地", hkoRain: "灣仔" },
  { id: "東區", nameTc: "東區", hkoTemp: "筲箕灣", hkoRain: "東區" },
  { id: "南區", nameTc: "南區", hkoTemp: "黃竹坑", hkoRain: "南區" },
  { id: "油尖旺", nameTc: "油尖旺區", hkoTemp: "京士柏", hkoRain: "油尖旺" },
  { id: "深水埗", nameTc: "深水埗區", hkoTemp: "深水埗", hkoRain: "深水埗" },
  { id: "九龍城", nameTc: "九龍城區", hkoTemp: "九龍城", hkoRain: "九龍城" },
  { id: "黃大仙", nameTc: "黃大仙區", hkoTemp: "黃大仙", hkoRain: "黃大仙" },
  { id: "觀塘", nameTc: "觀塘區", hkoTemp: "觀塘", hkoRain: "觀塘" },
  { id: "葵青", nameTc: "葵青區", hkoTemp: "青衣", hkoRain: "葵青" },
  { id: "荃灣", nameTc: "荃灣區", hkoTemp: "荃灣可觀", hkoRain: "荃灣" },
  { id: "屯門", nameTc: "屯門區", hkoTemp: "屯門", hkoRain: "屯門" },
  { id: "元朗", nameTc: "元朗區", hkoTemp: "元朗公園", hkoRain: "元朗" },
  { id: "北區", nameTc: "北區", hkoTemp: "打鼓嶺", hkoRain: "北區" },
  { id: "大埔", nameTc: "大埔區", hkoTemp: "大埔", hkoRain: "大埔" },
  { id: "沙田", nameTc: "沙田區", hkoTemp: "沙田", hkoRain: "沙田" },
  { id: "西貢", nameTc: "西貢區", hkoTemp: "西貢", hkoRain: "西貢" },
  { id: "離島", nameTc: "離島區", hkoTemp: "長洲", hkoRain: "離島區" },
];

/** @deprecated use WEATHER_DISTRICTS — kept for settings UI label list */
export const WEATHER_PLACES = WEATHER_DISTRICTS.map((d) => d.id);

export function districtById(id) {
  return WEATHER_DISTRICTS.find((d) => d.id === id) || null;
}

export function loadWeatherPlace() {
  try {
    localStorage.removeItem(LEGACY_PLACE_KEY);
    const raw = localStorage.getItem(WEATHER_PLACE_KEY);
    if (!raw) return null;
    const place = JSON.parse(raw);
    if (typeof place === "string" && districtById(place)) return place;
    return null;
  } catch {
    return null;
  }
}

export function saveWeatherPlace(place) {
  if (!districtById(place)) {
    throw new Error("invalid weather district");
  }
  localStorage.setItem(WEATHER_PLACE_KEY, JSON.stringify(place));
  return place;
}

export function clearWeatherPlace() {
  localStorage.removeItem(WEATHER_PLACE_KEY);
  localStorage.removeItem(LEGACY_PLACE_KEY);
}
