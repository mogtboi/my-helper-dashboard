/** Device-local home modules + appearance. Never synced. */
export const MODULE_PREFS_KEY = "my-helper.modules.v1";
export const APPEARANCE_KEY = "my-helper.appearance.v1";

/** All home modules that can be toggled. */
export const MODULE_CATALOG = [
  { id: "clock", nameTc: "時鐘", category: "電台" },
  { id: "weather", nameTc: "天氣（含警示／UV／空氣／日出）", category: "天氣" },
  { id: "bus", nameTc: "巴士 ETA", category: "巴士" },
  { id: "mtr", nameTc: "港鐵下一班車", category: "港鐵" },
  { id: "gmb", nameTc: "專線小巴", category: "巴士" },
  { id: "citybus", nameTc: "城巴", category: "巴士" },
  { id: "parking", nameTc: "停車場", category: "巴士" },
  { id: "holiday", nameTc: "公眾假期倒數", category: "假期" },
  { id: "radio", nameTc: "電台（港台）", category: "電台" },
];

/** Nested under sidebar「設定」 */
export const SETTINGS_CATEGORIES = ["天氣", "巴士", "港鐵", "假期", "外觀", "電台"];

/** @deprecated use SETTINGS_CATEGORIES — kept for any older imports */
export const DRAWER_CATEGORIES = SETTINGS_CATEGORIES;

export const DEFAULT_ENABLED = {
  clock: true,
  weather: true,
  bus: true,
  mtr: true,
  gmb: false,
  citybus: false,
  parking: false,
  holiday: true,
  radio: true,
};

export const FONT_STEPS = [
  { id: "sm", label: "細", scale: 0.9 },
  { id: "md", label: "中", scale: 1 },
  { id: "lg", label: "大", scale: 1.12 },
  { id: "xl", label: "特大", scale: 1.25 },
];

export const ACCENT_OPTIONS = [
  { id: "mint", label: "薄荷", value: "#5fbf95" },
  { id: "sky", label: "天空", value: "#5aa7d6" },
  { id: "amber", label: "琥珀", value: "#d4a15a" },
  { id: "rose", label: "玫瑰", value: "#d6788c" },
];

function isValidEnabled(obj) {
  return obj && typeof obj === "object";
}

/** Missing keys use DEFAULT_ENABLED. bus and mtr stay on until explicitly turned off. */
export function isModuleOn(enabled, id) {
  const value = enabled?.[id];
  if (value == null) return DEFAULT_ENABLED[id] !== false;
  return value !== false;
}

export function loadModuleEnabled() {
  try {
    const raw = localStorage.getItem(MODULE_PREFS_KEY);
    if (!raw) return { ...DEFAULT_ENABLED };
    const parsed = JSON.parse(raw);
    if (!isValidEnabled(parsed)) return { ...DEFAULT_ENABLED };
    return { ...DEFAULT_ENABLED, ...parsed };
  } catch {
    return { ...DEFAULT_ENABLED };
  }
}

export function saveModuleEnabled(enabled) {
  const next = { ...DEFAULT_ENABLED, ...enabled };
  localStorage.setItem(MODULE_PREFS_KEY, JSON.stringify(next));
  return next;
}

export function loadAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return { font: "md", accent: "mint" };
    const parsed = JSON.parse(raw);
    return {
      font: FONT_STEPS.some((f) => f.id === parsed.font) ? parsed.font : "md",
      accent: ACCENT_OPTIONS.some((a) => a.id === parsed.accent) ? parsed.accent : "mint",
    };
  } catch {
    return { font: "md", accent: "mint" };
  }
}

export function saveAppearance(appearance) {
  const next = {
    font: appearance.font || "md",
    accent: appearance.accent || "mint",
  };
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  return next;
}

export function applyAppearance(appearance) {
  const font = FONT_STEPS.find((f) => f.id === appearance.font) || FONT_STEPS[1];
  const accent = ACCENT_OPTIONS.find((a) => a.id === appearance.accent) || ACCENT_OPTIONS[0];
  const rgb = hexToRgbTriplet(accent.value);
  document.documentElement.style.setProperty("--font-scale", String(font.scale));
  document.documentElement.style.setProperty("--accent", accent.value);
  document.documentElement.style.setProperty("--accent-rgb", rgb);
  document.documentElement.dataset.font = font.id;
  document.documentElement.dataset.accent = accent.id;
}

function hexToRgbTriplet(hex) {
  const raw = String(hex || "").replace("#", "").trim();
  if (raw.length !== 6) return "95, 191, 149";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "95, 191, 149";
  return `${r}, ${g}, ${b}`;
}
