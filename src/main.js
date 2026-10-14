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

const panelShell = (id, titleId, titleText, bodyId, extraClass = "") => `
  <section class="panel ${extraClass}" data-panel-id="${id}" aria-labelledby="${titleId}">
    <div class="panel-head">
      <button type="button" class="drag-handle" data-drag-handle aria-label="拖曳調整${titleText}位置" title="上下拖曳排序">⋮⋮</button>
      <h2 id="${titleId}">${titleText}</h2>
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
      ${panelShell("bus", "bus-title", "巴士", "bus-root")}
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

const showView = (name) => {
  viewHome.hidden = name !== "home";
  viewTraffic.hidden = name !== "traffic";
  viewTco.hidden = name !== "tco";
  brandSub.textContent = VIEW_SUB[name] || "個人儀表板";
  document.body.dataset.view = name;
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
    onOpenSettings: () => settings.open("bus"),
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
  getBusSelection: () => busSelection,
  setBusSelection: (next) => {
    busSelection = next;
  },
  onBusChange: (next) => {
    bus.setSelection(next);
    setNet("巴士設定已更新（本機）");
  },
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
