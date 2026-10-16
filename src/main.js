import "./style.css";
import { config } from "./config.js";
import { startClock } from "./clock.js";
import { createWeather } from "./weather.js";
import { createBus } from "./bus.js";
import { createMtr } from "./mtr.js";
import { createHoliday } from "./holiday.js";
import { createRadio } from "./radio.js";
import { createTraffic } from "./traffic.js";
import { createTco } from "./tco.js";
import { loadBusSelection } from "./busStore.js";
import { loadWeatherPlace, districtById } from "./weatherStore.js";
import { loadMtrSelection } from "./mtrStore.js";
import { createAppSettings, openWeatherPlacePicker } from "./appSettings.js";
import {
  loadPanelOrder,
  savePanelOrder,
  enablePanelReorder,
} from "./panelOrder.js";
import {
  loadModuleEnabled,
  loadAppearance,
  applyAppearance,
} from "./prefsStore.js";
import { createDrawer } from "./drawer.js";

const app = document.querySelector("#app");

const panelShell = (id, titleId, titleText, bodyId, extraClass = "", actionsId = "") => `
  <section class="panel ${extraClass}" data-panel-id="${id}" aria-labelledby="${titleId}">
    <div class="panel-head">
      <button type="button" class="drag-handle" data-drag-handle aria-label="拖曳調整${titleText}位置" title="上下拖曳排序">⋮⋮</button>
      <h2 id="${titleId}">${titleText}</h2>
      ${actionsId ? `<div class="panel-head-actions" id="${actionsId}"></div>` : ""}
    </div>
    <div id="${bodyId}"></div>
  </section>
`;

app.innerHTML = `
  <header class="brand-bar">
    <button type="button" class="menu-btn" id="menu-btn" aria-label="開啟選單">☰</button>
    <div class="brand">
      my helper
      <small id="brand-sub">個人儀表板</small>
    </div>
    <div class="status-pill" id="net-status" aria-live="polite">連線中</div>
  </header>

  <div id="view-home" class="app-view">
    <p class="reorder-hint muted">☰ 選單：主頁／交通消息／買車成本／設定；⋮⋮ 可拖曳排序（只存呢部機）</p>

    <div id="panel-stack" class="panel-stack">
      <section class="panel panel-clock" data-panel-id="clock" aria-label="時鐘">
        <div class="panel-head">
          <button type="button" class="drag-handle" data-drag-handle aria-label="拖曳調整時鐘位置" title="上下拖曳排序">⋮⋮</button>
          <h2 class="panel-head-label">時鐘</h2>
        </div>
        <div class="hero-clock">
          <div class="clock-time" id="clock-time">--:--</div>
          <div class="clock-date" id="clock-date">—</div>
        </div>
      </section>

      ${panelShell("weather", "weather-title", "天氣", "weather-root")}
      ${panelShell("holiday", "holiday-title", "公眾假期", "holiday-root")}
      ${panelShell("bus", "bus-title", "巴士", "bus-root", "panel-bus", "bus-actions")}
      ${panelShell("mtr", "mtr-title", "港鐵", "mtr-root")}
      ${panelShell("radio", "radio-title", "電台", "radio-root")}
    </div>

    <p class="footer-note">公開資料：天文台 · AQHI · 九巴 · 港鐵 · 1823 假期 · 運輸署交通消息 · RTHK · 設定只存本機</p>
  </div>

  <div id="view-traffic" class="app-view" hidden>
    <section class="panel traffic-page-panel" data-panel-id="traffic" aria-labelledby="traffic-title">
      <div class="panel-head">
        <h2 id="traffic-title">交通消息</h2>
      </div>
      <p class="muted traffic-intro">運輸署特別交通消息：封路、改道、大型活動等（唔係巴士／港鐵 ETA）。</p>
      <div id="traffic-root"></div>
    </section>
  </div>

  <div id="view-tco" class="app-view" hidden>
    <section class="panel tco-page-panel" data-panel-id="tco" aria-label="買車成本">
      <div id="tco-root"></div>
    </section>
  </div>

  <div id="drawer-root"></div>
  <div id="settings-overlay" class="settings-overlay" hidden></div>

  <nav class="bottom-tab-bar" id="bottom-tabs" aria-label="主導覽">
    <button type="button" class="bottom-tab" data-tab="home" aria-current="page">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 3.2 3.5 10.2V21h6.2v-6.1h4.6V21h6.2V10.2L12 3.2z"/></svg>
      <span>主頁</span>
    </button>
    <button type="button" class="bottom-tab" data-tab="traffic">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2 4.5 5.2v5.4C4.5 15.4 7.6 19.7 12 21c4.4-1.3 7.5-5.6 7.5-10.4V5.2L12 2zm-1.1 12.7L7.2 11l1.4-1.4 2.3 2.3 4.7-4.7L17 8.6l-6.1 6.1z"/></svg>
      <span>交通消息</span>
    </button>
    <button type="button" class="bottom-tab" data-tab="tco">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M18.9 6.1H5.1L3 9.2v1.2h1.1c.5 0 .9.4.9.9v6.5c0 .7.6 1.3 1.3 1.3h1.6c.7 0 1.3-.6 1.3-1.3v-.9h6.6v.9c0 .7.6 1.3 1.3 1.3h1.6c.7 0 1.3-.6 1.3-1.3v-6.5c0-.5.4-.9.9-.9H21V9.2l-2.1-3.1zM7.4 17.1c-.6 0-1.1-.5-1.1-1.1S6.8 14.9 7.4 14.9s1.1.5 1.1 1.1-.5 1.1-1.1 1.1zm9.2 0c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1zM5.7 8.1h12.6l.9 1.4H4.8l.9-1.4z"/></svg>
      <span>買車成本</span>
    </button>
    <button type="button" class="bottom-tab" data-tab="settings">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.1 12.9c0-.3 0-.6-.1-.9l1.7-1.3-1.6-2.8-2 .8c-.5-.4-1-.7-1.6-.9L15.1 5h-3.2l-.4 2.1c-.6.2-1.1.5-1.6.9l-2-.8-1.6 2.8 1.7 1.3c0 .3-.1.6-.1.9s0 .6.1.9L5.3 15.1l1.6 2.8 2-.8c.5.4 1 .7 1.6.9l.4 2.1h3.2l.4-2.1c.6-.2 1.1-.5 1.6-.9l2 .8 1.6-2.8-1.7-1.3c.1-.3.1-.6.1-.9zM12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4z"/></svg>
      <span>設定</span>
    </button>
  </nav>
`;

let moduleEnabled = loadModuleEnabled();
let appearance = loadAppearance();
applyAppearance(appearance);

const netStatus = document.querySelector("#net-status");
const brandSub = document.querySelector("#brand-sub");
const setNet = (text) => {
  netStatus.textContent = text;
};

const viewHome = document.querySelector("#view-home");
const viewTraffic = document.querySelector("#view-traffic");
const viewTco = document.querySelector("#view-tco");
const stack = document.querySelector("#panel-stack");

const VIEW_SUB = {
  home: "個人儀表板",
  traffic: "特別交通消息",
  tco: "買車成本模擬",
};

const bottomTabs = document.querySelector("#bottom-tabs");

const syncBottomTabs = (name) => {
  bottomTabs?.querySelectorAll(".bottom-tab").forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.setAttribute("aria-current", on ? "page" : "false");
    btn.classList.toggle("is-active", on);
  });
};

const showView = (name) => {
  viewHome.hidden = name !== "home";
  viewTraffic.hidden = name !== "traffic";
  viewTco.hidden = name !== "tco";
  brandSub.textContent = VIEW_SUB[name] || "個人儀表板";
  document.body.dataset.view = name;
  syncBottomTabs(name === "settings" ? "settings" : name);
};

const applyVisibility = () => {
  stack.querySelectorAll("[data-panel-id]").forEach((el) => {
    const id = el.dataset.panelId;
    el.hidden = moduleEnabled[id] === false;
  });
};

const reorder = enablePanelReorder(stack, {
  onReorder: () => setNet("版面順序已更新（本機）"),
});
reorder.applyOrder(loadPanelOrder());
savePanelOrder(loadPanelOrder());
applyVisibility();

startClock({
  timeEl: document.querySelector("#clock-time"),
  dateEl: document.querySelector("#clock-date"),
  locale: config.locale,
  timeZone: config.timeZone,
});

const overlay = document.querySelector("#settings-overlay");

let weatherPlace = loadWeatherPlace();
let busSelection = loadBusSelection();
let mtrSelection = loadMtrSelection();

const weatherTitle = document.querySelector("#weather-title");
const updateWeatherTitle = (place) => {
  const label = districtById(place)?.nameTc || place;
  weatherTitle.textContent = label ? `天氣 · ${label}` : "天氣";
};

const weather = createWeather(document.querySelector("#weather-root"), config.weather, {
  onStatus: setNet,
  onChangePlace: () => settings.open("weather"),
});

const holiday = createHoliday(document.querySelector("#holiday-root"), { onStatus: setNet });

const bus = createBus(
  document.querySelector("#bus-root"),
  document.querySelector("#bus-title"),
  {
    onStatus: setNet,
    actionsEl: document.querySelector("#bus-actions"),
    onSelectionPersist: (next) => {
      busSelection = next;
    },
  }
);

const mtr = createMtr(
  document.querySelector("#mtr-root"),
  document.querySelector("#mtr-title"),
  {
    onStatus: setNet,
    onOpenSettings: () => settings.open("mtr"),
    setSelectionExternal: (next) => {
      mtrSelection = next;
    },
    onSelectionChange: (next) => {
      mtrSelection = next;
    },
  }
);

const traffic = createTraffic(document.querySelector("#traffic-root"), { onStatus: setNet });
const tco = createTco(document.querySelector("#tco-root"));

const settings = createAppSettings({
  overlayRoot: overlay,
  getWeatherPlace: () => weatherPlace,
  onWeatherPlaceChange: (place) => {
    weatherPlace = place;
    updateWeatherTitle(place);
    weather.setPlace(place);
    setNet("天氣地區已更新（本機）");
  },
  getMtrSelection: () => mtrSelection,
  setMtrSelection: (next) => {
    mtrSelection = next;
  },
  onMtrChange: (next) => {
    mtr.setSelection(next);
    setNet("港鐵設定已更新（本機）");
  },
});

const drawer = createDrawer({
  root: document.querySelector("#drawer-root"),
  getEnabled: () => moduleEnabled,
  setEnabled: (next) => {
    moduleEnabled = next;
  },
  onEnabledChange: (next) => {
    moduleEnabled = next;
    applyVisibility();
    setNet("主頁模組已更新（本機）");
  },
  getAppearance: () => appearance,
  setAppearance: (next) => {
    appearance = next;
  },
  onAppearanceChange: () => setNet("外觀已更新（本機）"),
  onOpenSettings: (focus = "bus") => settings.open(focus),
  onNavigateHome: () => showView("home"),
  onNavigateTraffic: () => {
    showView("traffic");
    traffic.refresh();
  },
  onNavigateTco: () => {
    showView("tco");
    tco.start();
    setNet("買車成本模擬");
  },
});

document.querySelector("#menu-btn").addEventListener("click", () => drawer.toggle());

bottomTabs?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === "home") {
    showView("home");
  } else if (tab === "traffic") {
    showView("traffic");
    traffic.refresh();
  } else if (tab === "tco") {
    showView("tco");
    tco.start();
    setNet("買車成本模擬");
  } else if (tab === "settings") {
    syncBottomTabs("settings");
    drawer.openSettingsHub();
  }
});

const boot = () => {
  updateWeatherTitle(weatherPlace);
  weather.start(weatherPlace);
  holiday.start();
  bus.start(busSelection);
  mtr.start(mtrSelection);
  createRadio(document.querySelector("#radio-root"), config.radio);
  traffic.start();
  showView("home");
};

if (!weatherPlace) {
  openWeatherPlacePicker(overlay, {
    currentPlace: null,
    onPick: (place) => {
      weatherPlace = place;
      updateWeatherTitle(place);
      setNet(`天氣地區：${place}`);
      boot();
    },
  });
} else {
  boot();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

window.addEventListener("online", () => setNet("已連線"));
window.addEventListener("offline", () => setNet("離線（顯示上次資料）"));
