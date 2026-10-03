import "./style.css";
import { config } from "./config.js";
import { startClock } from "./clock.js";
import { createWeather } from "./weather.js";
import { createBus } from "./bus.js";
import { createMtr } from "./mtr.js";
import { createRadio } from "./radio.js";
import { loadBusSelection } from "./busStore.js";
import { loadWeatherPlace, districtById } from "./weatherStore.js";
import { loadMtrSelection } from "./mtrStore.js";
import { createAppSettings, openWeatherPlacePicker } from "./appSettings.js";
import {
  loadPanelOrder,
  savePanelOrder,
  enablePanelReorder,
} from "./panelOrder.js";

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
    <div class="brand">
      my helper
      <small>個人儀表板</small>
    </div>
    <div class="status-pill" id="net-status" aria-live="polite">連線中</div>
  </header>

  <p class="reorder-hint muted">撳左邊 ⋮⋮ 上下拖曳可調順序（只存呢部機）</p>

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
    ${panelShell("bus", "bus-title", "巴士", "bus-root")}
    ${panelShell("mtr", "mtr-title", "港鐵", "mtr-root")}
    ${panelShell("radio", "radio-title", "電台", "radio-root")}
  </div>

  <p class="footer-note">公開資料：天文台 · 九巴 ETA · 港鐵 Next Train · RTHK（手動播放）· 設定／排序只存本機</p>
  <div id="settings-overlay" class="settings-overlay" hidden></div>
`;

const netStatus = document.querySelector("#net-status");
const setNet = (text) => {
  netStatus.textContent = text;
};

const stack = document.querySelector("#panel-stack");
const reorder = enablePanelReorder(stack, {
  onReorder: () => setNet("版面順序已更新（本機）"),
});
reorder.applyOrder(loadPanelOrder());
savePanelOrder(loadPanelOrder());

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

const boot = () => {
  updateWeatherTitle(weatherPlace);
  weather.start(weatherPlace);
  bus.start(busSelection);
  mtr.start(mtrSelection);
  createRadio(document.querySelector("#radio-root"), config.radio);
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
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline install optional in dev */
    });
  });
}

window.addEventListener("online", () => setNet("已連線"));
window.addEventListener("offline", () => setNet("離線（顯示上次資料）"));
