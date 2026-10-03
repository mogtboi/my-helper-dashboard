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
  KWF: "葵芳",
  KWH: "葵興",
  TWH: "大窩口",
  TSW: "荃灣",
  KET: "堅尼地城",
  HKU: "香港大學",
  SYP: "西營盤",
  SHW: "上環",
  SKW: "筲箕灣",
  TAK: "太古",
  QUB: "鰂魚涌",
  NOP: "北角",
  FOH: "炮台山",
  TIH: "天后",
  CAB: "銅鑼灣",
  WAC: "灣仔",
  SWH: "西灣河",
  HFC: "杏花邨",
  CHW: "柴灣",
  WHA: "黃埔",
  HOM: "何文田",
  SKM: "石硤尾",
  LOF: "樂富",
  WTS: "黃大仙",
  DIH: "鑽石山",
  CHH: "彩虹",
  KOB: "九龍灣",
  NTK: "牛頭角",
  KWT: "觀塘",
  LAT: "藍田",
  YAT: "油塘",
  TIK: "調景嶺",
  HOK: "香港",
  KOW: "九龍",
  OLY: "奧運",
  NAC: "南昌",
  TSY: "青衣",
  SUN: "欣澳",
  TUC: "東涌",
  WKS: "烏溪沙",
  MOS: "馬鞍山",
  HEO: "恆安",
  TSH: "大水坑",
  SHM: "石門",
  CIO: "第一城",
  STW: "沙田圍",
  CKT: "車公廟",
  HIK: "顯徑",
  KAT: "啟德",
  SUW: "宋皇臺",
  TKW: "土瓜灣",
  ETS: "尖東",
  AUS: "柯士甸",
  TWW: "荃灣西",
  KSR: "錦上路",
  YUL: "元朗",
  LOP: "朗屏",
  TIS: "天水圍",
  SIH: "兆康",
  TUM: "屯門",
  TKO: "將軍澳",
  HAH: "坑口",
  POA: "寶琳",
  LHP: "康城",
  OCP: "海洋公園",
  WCE: "黃竹坑",
  LET: "利東",
  SOH: "海怡半島",
  AWE: "博覽館",
  AIR: "機場",
  DIS: "迪士尼",
};

export function destLabel(code) {
  return DEST_TC[code] || code || "—";
}

export async function fetchMtrSchedule(line, sta) {
  const url = `${BASE}?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(sta)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
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
