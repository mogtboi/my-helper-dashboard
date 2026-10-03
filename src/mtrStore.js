/** Device-local MTR station watches. Never synced across devices. */
export const MTR_STORAGE_KEY = "my-helper.mtr.v1";

/**
 * Curated heavy-rail stations (Next Train API line + sta codes).
 * dest codes map to Chinese names in mtrApi.js.
 */
export const MTR_STATION_CATALOG = [
  { id: "EAL-TAP", line: "EAL", sta: "TAP", nameTc: "大埔墟", lineTc: "東鐵綫" },
  { id: "EAL-TWO", line: "EAL", sta: "TWO", nameTc: "太和", lineTc: "東鐵綫" },
  { id: "EAL-UNI", line: "EAL", sta: "UNI", nameTc: "大學", lineTc: "東鐵綫" },
  { id: "EAL-FOT", line: "EAL", sta: "FOT", nameTc: "火炭", lineTc: "東鐵綫" },
  { id: "EAL-SHT", line: "EAL", sta: "SHT", nameTc: "沙田", lineTc: "東鐵綫" },
  { id: "EAL-TAW", line: "EAL", sta: "TAW", nameTc: "大圍", lineTc: "東鐵綫" },
  { id: "EAL-KOT", line: "EAL", sta: "KOT", nameTc: "九龍塘", lineTc: "東鐵綫" },
  { id: "EAL-MKK", line: "EAL", sta: "MKK", nameTc: "旺角東", lineTc: "東鐵綫" },
  { id: "EAL-HUH", line: "EAL", sta: "HUH", nameTc: "紅磡", lineTc: "東鐵綫" },
  { id: "EAL-EXC", line: "EAL", sta: "EXC", nameTc: "會展", lineTc: "東鐵綫" },
  { id: "EAL-ADM", line: "EAL", sta: "ADM", nameTc: "金鐘", lineTc: "東鐵綫" },
  { id: "EAL-FAN", line: "EAL", sta: "FAN", nameTc: "粉嶺", lineTc: "東鐵綫" },
  { id: "EAL-SHS", line: "EAL", sta: "SHS", nameTc: "上水", lineTc: "東鐵綫" },
  { id: "EAL-LOW", line: "EAL", sta: "LOW", nameTc: "羅湖", lineTc: "東鐵綫" },
  { id: "EAL-LMC", line: "EAL", sta: "LMC", nameTc: "落馬洲", lineTc: "東鐵綫" },
  { id: "TML-TUM", line: "TML", sta: "TUM", nameTc: "屯門", lineTc: "屯馬綫" },
  { id: "TML-YUL", line: "TML", sta: "YUL", nameTc: "元朗", lineTc: "屯馬綫" },
  { id: "TML-TIS", line: "TML", sta: "TIS", nameTc: "天水圍", lineTc: "屯馬綫" },
  { id: "TML-TAW", line: "TML", sta: "TAW", nameTc: "大圍", lineTc: "屯馬綫" },
  { id: "TML-HUH", line: "TML", sta: "HUH", nameTc: "紅磡", lineTc: "屯馬綫" },
  { id: "TWL-TSW", line: "TWL", sta: "TSW", nameTc: "荃灣", lineTc: "荃灣綫" },
  { id: "TWL-LAK", line: "TWL", sta: "LAK", nameTc: "荔景", lineTc: "荃灣綫" },
  { id: "TWL-MEF", line: "TWL", sta: "MEF", nameTc: "美孚", lineTc: "荃灣綫" },
  { id: "TWL-LCK", line: "TWL", sta: "LCK", nameTc: "荔枝角", lineTc: "荃灣綫" },
  { id: "TWL-CSW", line: "TWL", sta: "CSW", nameTc: "長沙灣", lineTc: "荃灣綫" },
  { id: "TWL-SSP", line: "TWL", sta: "SSP", nameTc: "深水埗", lineTc: "荃灣綫" },
  { id: "TWL-PRE", line: "TWL", sta: "PRE", nameTc: "太子", lineTc: "荃灣綫" },
  { id: "TWL-MOK", line: "TWL", sta: "MOK", nameTc: "旺角", lineTc: "荃灣綫" },
  { id: "TWL-YMT", line: "TWL", sta: "YMT", nameTc: "油麻地", lineTc: "荃灣綫" },
  { id: "TWL-JOR", line: "TWL", sta: "JOR", nameTc: "佐敦", lineTc: "荃灣綫" },
  { id: "TWL-TST", line: "TWL", sta: "TST", nameTc: "尖沙咀", lineTc: "荃灣綫" },
  { id: "TWL-ADM", line: "TWL", sta: "ADM", nameTc: "金鐘", lineTc: "荃灣綫" },
  { id: "TWL-CEN", line: "TWL", sta: "CEN", nameTc: "中環", lineTc: "荃灣綫" },
  { id: "ISL-SKW", line: "ISL", sta: "SKW", nameTc: "筲箕灣", lineTc: "港島綫" },
  { id: "ISL-TAK", line: "ISL", sta: "TAK", nameTc: "太古", lineTc: "港島綫" },
  { id: "ISL-QUB", line: "ISL", sta: "QUB", nameTc: "鰂魚涌", lineTc: "港島綫" },
  { id: "ISL-NOP", line: "ISL", sta: "NOP", nameTc: "北角", lineTc: "港島綫" },
  { id: "ISL-FOH", line: "ISL", sta: "FOH", nameTc: "炮台山", lineTc: "港島綫" },
  { id: "ISL-TIH", line: "ISL", sta: "TIH", nameTc: "天后", lineTc: "港島綫" },
  { id: "ISL-CAB", line: "ISL", sta: "CAB", nameTc: "銅鑼灣", lineTc: "港島綫" },
  { id: "ISL-WAC", line: "ISL", sta: "WAC", nameTc: "灣仔", lineTc: "港島綫" },
  { id: "ISL-ADM", line: "ISL", sta: "ADM", nameTc: "金鐘", lineTc: "港島綫" },
  { id: "ISL-CEN", line: "ISL", sta: "CEN", nameTc: "中環", lineTc: "港島綫" },
  { id: "KTL-DIH", line: "KTL", sta: "DIH", nameTc: "鑽石山", lineTc: "觀塘綫" },
  { id: "KTL-CHH", line: "KTL", sta: "CHH", nameTc: "彩虹", lineTc: "觀塘綫" },
  { id: "KTL-KOB", line: "KTL", sta: "KOB", nameTc: "九龍灣", lineTc: "觀塘綫" },
  { id: "KTL-NTK", line: "KTL", sta: "NTK", nameTc: "牛頭角", lineTc: "觀塘綫" },
  { id: "KTL-KWT", line: "KTL", sta: "KWT", nameTc: "觀塘", lineTc: "觀塘綫" },
  { id: "KTL-LAT", line: "KTL", sta: "LAT", nameTc: "藍田", lineTc: "觀塘綫" },
  { id: "KTL-YAT", line: "KTL", sta: "YAT", nameTc: "油塘", lineTc: "觀塘綫" },
  { id: "KTL-TIK", line: "KTL", sta: "TIK", nameTc: "調景嶺", lineTc: "觀塘綫" },
  { id: "TCL-OLY", line: "TCL", sta: "OLY", nameTc: "奧運", lineTc: "東涌綫" },
  { id: "TCL-NAC", line: "TCL", sta: "NAC", nameTc: "南昌", lineTc: "東涌綫" },
  { id: "TCL-LAK", line: "TCL", sta: "LAK", nameTc: "荔景", lineTc: "東涌綫" },
  { id: "TCL-TSY", line: "TCL", sta: "TSY", nameTc: "青衣", lineTc: "東涌綫" },
  { id: "TCL-SUN", line: "TCL", sta: "SUN", nameTc: "欣澳", lineTc: "東涌綫" },
  { id: "TCL-TUC", line: "TCL", sta: "TUC", nameTc: "東涌", lineTc: "東涌綫" },
];

export function catalogById(id) {
  return MTR_STATION_CATALOG.find((s) => s.id === id) || null;
}

/** Empty selection until user adds stations (or defaults on first open). */
export function defaultMtrSelection() {
  return {
    version: 1,
    stations: [
      { id: "EAL-TAP", line: "EAL", sta: "TAP", nameTc: "大埔墟", lineTc: "東鐵綫" },
      { id: "EAL-TWO", line: "EAL", sta: "TWO", nameTc: "太和", lineTc: "東鐵綫" },
    ],
  };
}

function isValid(data) {
  return (
    data &&
    data.version === 1 &&
    Array.isArray(data.stations) &&
    data.stations.every(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.line === "string" &&
        typeof s.sta === "string" &&
        typeof s.nameTc === "string"
    )
  );
}

export function loadMtrSelection() {
  try {
    const raw = localStorage.getItem(MTR_STORAGE_KEY);
    if (!raw) return defaultMtrSelection();
    const parsed = JSON.parse(raw);
    if (!isValid(parsed)) return defaultMtrSelection();
    return parsed;
  } catch {
    return defaultMtrSelection();
  }
}

export function saveMtrSelection(selection) {
  if (!isValid(selection)) throw new Error("invalid mtr selection");
  localStorage.setItem(MTR_STORAGE_KEY, JSON.stringify(selection));
  return selection;
}

export function clearMtrSelection() {
  localStorage.removeItem(MTR_STORAGE_KEY);
  return defaultMtrSelection();
}
