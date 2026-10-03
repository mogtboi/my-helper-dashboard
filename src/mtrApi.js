const BASE = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

/** Next Train destination codes → zh labels (best-effort). */
export const DEST_TC = {
  ADM: "金鐘",
  EXC: "會展",
  HUH: "紅磡",
  MKK: "旺角東",
  KOT: "九龍塘",
  TAW: "大圍",
  SHT: "沙田",
  FOT: "火炭",
  RAC: "馬場",
  UNI: "大學",
  TAP: "大埔墟",
  TWO: "太和",
  FAN: "粉嶺",
  SHS: "上水",
  LOW: "羅湖",
  LMC: "落馬洲",
  CEN: "中環",
  TST: "尖沙咀",
  JOR: "佐敦",
  YMT: "油麻地",
  MOK: "旺角",
  PRE: "太子",
  SSP: "深水埗",
  CSW: "長沙灣",
  LCK: "荔枝角",
  MEF: "美孚",
  LAK: "荔景",
  TSW: "荃灣",
  SKW: "筲箕灣",
  TAK: "太古",
  QUB: "鰂魚涌",
  NOP: "北角",
  FOH: "炮台山",
  TIH: "天后",
  CAB: "銅鑼灣",
  WAC: "灣仔",
  DIH: "鑽石山",
  CHH: "彩虹",
  KOB: "九龍灣",
  NTK: "牛頭角",
  KWT: "觀塘",
  LAT: "藍田",
  YAT: "油塘",
  TIK: "調景嶺",
  OLY: "奧運",
  NAC: "南昌",
  TSY: "青衣",
  SUN: "欣澳",
  TUC: "東涌",
  TUM: "屯門",
  YUL: "元朗",
  TIS: "天水圍",
  AWE: "博覽館",
  AIR: "機場",
  TSY2: "青衣",
};

export function destLabel(code) {
  return DEST_TC[code] || code || "—";
}

export async function fetchMtrSchedule(line, sta) {
  const url = `${BASE}?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(sta)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // status can be 0 on some failures; still try data
  const key = `${line}-${sta}`;
  const block = json?.data?.[key];
  if (!block) {
    const msg = json?.message || json?.status || "無班次資料";
    throw new Error(String(msg));
  }
  return {
    up: Array.isArray(block.UP) ? block.UP : [],
    down: Array.isArray(block.DOWN) ? block.DOWN : [],
    currTime: block.curr_time || json.curr_time,
  };
}

export { BASE as MTR_BASE };
