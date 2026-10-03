/**
 * Major MTR heavy-rail lines for Next Train API.
 * Flow: line → direction (UP/DOWN) → station.
 */

export const MTR_LINES = [
  {
    code: "EAL",
    nameTc: "東鐵綫",
    upLabel: "往羅湖／落馬洲",
    downLabel: "往金鐘",
    stations: [
      { sta: "ADM", nameTc: "金鐘" },
      { sta: "EXC", nameTc: "會展" },
      { sta: "HUH", nameTc: "紅磡" },
      { sta: "MKK", nameTc: "旺角東" },
      { sta: "KOT", nameTc: "九龍塘" },
      { sta: "TAW", nameTc: "大圍" },
      { sta: "SHT", nameTc: "沙田" },
      { sta: "FOT", nameTc: "火炭" },
      { sta: "RAC", nameTc: "馬場" },
      { sta: "UNI", nameTc: "大學" },
      { sta: "TAP", nameTc: "大埔墟" },
      { sta: "TWO", nameTc: "太和" },
      { sta: "FAN", nameTc: "粉嶺" },
      { sta: "SHS", nameTc: "上水" },
      { sta: "LOW", nameTc: "羅湖" },
      { sta: "LMC", nameTc: "落馬洲" },
    ],
  },
  {
    code: "TWL",
    nameTc: "荃灣綫",
    upLabel: "往荃灣",
    downLabel: "往中環",
    stations: [
      { sta: "CEN", nameTc: "中環" },
      { sta: "ADM", nameTc: "金鐘" },
      { sta: "TST", nameTc: "尖沙咀" },
      { sta: "JOR", nameTc: "佐敦" },
      { sta: "YMT", nameTc: "油麻地" },
      { sta: "MOK", nameTc: "旺角" },
      { sta: "PRE", nameTc: "太子" },
      { sta: "SSP", nameTc: "深水埗" },
      { sta: "CSW", nameTc: "長沙灣" },
      { sta: "LCK", nameTc: "荔枝角" },
      { sta: "MEF", nameTc: "美孚" },
      { sta: "LAK", nameTc: "荔景" },
      { sta: "KWF", nameTc: "葵芳" },
      { sta: "KWH", nameTc: "葵興" },
      { sta: "TWH", nameTc: "大窩口" },
      { sta: "TSW", nameTc: "荃灣" },
    ],
  },
  {
    code: "ISL",
    nameTc: "港島綫",
    upLabel: "往柴灣",
    downLabel: "往堅尼地城",
    stations: [
      { sta: "KET", nameTc: "堅尼地城" },
      { sta: "HKU", nameTc: "香港大學" },
      { sta: "SYP", nameTc: "西營盤" },
      { sta: "SHW", nameTc: "上環" },
      { sta: "CEN", nameTc: "中環" },
      { sta: "ADM", nameTc: "金鐘" },
      { sta: "WAC", nameTc: "灣仔" },
      { sta: "CAB", nameTc: "銅鑼灣" },
      { sta: "TIH", nameTc: "天后" },
      { sta: "FOH", nameTc: "炮台山" },
      { sta: "NOP", nameTc: "北角" },
      { sta: "QUB", nameTc: "鰂魚涌" },
      { sta: "TAK", nameTc: "太古" },
      { sta: "SWH", nameTc: "西灣河" },
      { sta: "SKW", nameTc: "筲箕灣" },
      { sta: "HFC", nameTc: "杏花邨" },
      { sta: "CHW", nameTc: "柴灣" },
    ],
  },
  {
    code: "KTL",
    nameTc: "觀塘綫",
    upLabel: "往調景嶺",
    downLabel: "往黃埔",
    stations: [
      { sta: "WHA", nameTc: "黃埔" },
      { sta: "HOM", nameTc: "何文田" },
      { sta: "YMT", nameTc: "油麻地" },
      { sta: "MOK", nameTc: "旺角" },
      { sta: "PRE", nameTc: "太子" },
      { sta: "SKM", nameTc: "石硤尾" },
      { sta: "KOT", nameTc: "九龍塘" },
      { sta: "LOF", nameTc: "樂富" },
      { sta: "WTS", nameTc: "黃大仙" },
      { sta: "DIH", nameTc: "鑽石山" },
      { sta: "CHH", nameTc: "彩虹" },
      { sta: "KOB", nameTc: "九龍灣" },
      { sta: "NTK", nameTc: "牛頭角" },
      { sta: "KWT", nameTc: "觀塘" },
      { sta: "LAT", nameTc: "藍田" },
      { sta: "YAT", nameTc: "油塘" },
      { sta: "TIK", nameTc: "調景嶺" },
    ],
  },
  {
    code: "TML",
    nameTc: "屯馬綫",
    upLabel: "往屯門",
    downLabel: "往烏溪沙",
    stations: [
      { sta: "WKS", nameTc: "烏溪沙" },
      { sta: "MOS", nameTc: "馬鞍山" },
      { sta: "HEO", nameTc: "恆安" },
      { sta: "TSH", nameTc: "大水坑" },
      { sta: "SHM", nameTc: "石門" },
      { sta: "CIO", nameTc: "第一城" },
      { sta: "STW", nameTc: "沙田圍" },
      { sta: "CKT", nameTc: "車公廟" },
      { sta: "TAW", nameTc: "大圍" },
      { sta: "HIK", nameTc: "顯徑" },
      { sta: "DIH", nameTc: "鑽石山" },
      { sta: "KAT", nameTc: "啟德" },
      { sta: "SUW", nameTc: "宋皇臺" },
      { sta: "TKW", nameTc: "土瓜灣" },
      { sta: "HOM", nameTc: "何文田" },
      { sta: "HUH", nameTc: "紅磡" },
      { sta: "ETS", nameTc: "尖東" },
      { sta: "AUS", nameTc: "柯士甸" },
      { sta: "NAC", nameTc: "南昌" },
      { sta: "MEF", nameTc: "美孚" },
      { sta: "TWW", nameTc: "荃灣西" },
      { sta: "KSR", nameTc: "錦上路" },
      { sta: "YUL", nameTc: "元朗" },
      { sta: "LOP", nameTc: "朗屏" },
      { sta: "TIS", nameTc: "天水圍" },
      { sta: "SIH", nameTc: "兆康" },
      { sta: "TUM", nameTc: "屯門" },
    ],
  },
  {
    code: "TCL",
    nameTc: "東涌綫",
    upLabel: "往東涌",
    downLabel: "往香港",
    stations: [
      { sta: "HOK", nameTc: "香港" },
      { sta: "KOW", nameTc: "九龍" },
      { sta: "OLY", nameTc: "奧運" },
      { sta: "NAC", nameTc: "南昌" },
      { sta: "LAK", nameTc: "荔景" },
      { sta: "TSY", nameTc: "青衣" },
      { sta: "SUN", nameTc: "欣澳" },
      { sta: "TUC", nameTc: "東涌" },
    ],
  },
  {
    code: "TKL",
    nameTc: "將軍澳綫",
    upLabel: "往寶琳／康城",
    downLabel: "往北角",
    stations: [
      { sta: "NOP", nameTc: "北角" },
      { sta: "QUB", nameTc: "鰂魚涌" },
      { sta: "YAT", nameTc: "油塘" },
      { sta: "TIK", nameTc: "調景嶺" },
      { sta: "TKO", nameTc: "將軍澳" },
      { sta: "HAH", nameTc: "坑口" },
      { sta: "POA", nameTc: "寶琳" },
      { sta: "LHP", nameTc: "康城" },
    ],
  },
  {
    code: "SIL",
    nameTc: "南港島綫",
    upLabel: "往海怡半島",
    downLabel: "往金鐘",
    stations: [
      { sta: "ADM", nameTc: "金鐘" },
      { sta: "OCP", nameTc: "海洋公園" },
      { sta: "WCE", nameTc: "黃竹坑" },
      { sta: "LET", nameTc: "利東" },
      { sta: "SOH", nameTc: "海怡半島" },
    ],
  },
  {
    code: "AEL",
    nameTc: "機場快綫",
    upLabel: "往機場／博覽館",
    downLabel: "往香港",
    stations: [
      { sta: "HOK", nameTc: "香港" },
      { sta: "KOW", nameTc: "九龍" },
      { sta: "TSY", nameTc: "青衣" },
      { sta: "AIR", nameTc: "機場" },
      { sta: "AWE", nameTc: "博覽館" },
    ],
  },
  {
    code: "DRL",
    nameTc: "迪士尼綫",
    upLabel: "往迪士尼",
    downLabel: "往欣澳",
    stations: [
      { sta: "SUN", nameTc: "欣澳" },
      { sta: "DIS", nameTc: "迪士尼" },
    ],
  },
];

export function lineByCode(code) {
  return MTR_LINES.find((l) => l.code === code) || null;
}

export function stationOnLine(lineCode, sta) {
  const line = lineByCode(lineCode);
  if (!line) return null;
  const hit = line.stations.find((s) => s.sta === sta);
  if (!hit) return null;
  return {
    id: `${lineCode}-${sta}`,
    line: lineCode,
    sta,
    nameTc: hit.nameTc,
    lineTc: line.nameTc,
  };
}

/** Flat catalog for settings search (all line×station). */
export function allStationsCatalog() {
  const out = [];
  for (const line of MTR_LINES) {
    for (const s of line.stations) {
      out.push({
        id: `${line.code}-${s.sta}`,
        line: line.code,
        sta: s.sta,
        nameTc: s.nameTc,
        lineTc: line.nameTc,
      });
    }
  }
  return out;
}
