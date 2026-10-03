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

const app = document.querySelector("#app");

app.innerHTML = `
  <header class="brand-bar">
    <div class="brand">
      my helper
      <small>個人儀表板</small>
    </div>
    <div class="status-pill" id="net-status" aria-live="polite">連線中</div>
  </header>

  <section class="hero-clock" aria-label="時鐘">
    <div class="clock-time" id="clock-time">--:--</div>
    <div class="clock-date" id="clock-date">—</div>
  </section>

  <div class="grid">
    <section class="panel" aria-labelledby="weather-title">
      <h2 id="weather-title">天氣</h2>
      <div id="weather-root"></div>
    </section>

    <section class="panel" aria-labelledby="bus-title">
      <h2 id="bus-title">巴士</h2>
      <div id="bus-root"></div>
    </section>

    <section class="panel" aria-labelledby="mtr-title">
      <h2 id="mtr-title">港鐵</h2>
      <div id="mtr-root"></div>
    </section>

    <section class="panel span-2" aria-labelledby="radio-title">
      <h2 id="radio-title">電台</h2>
      <div id="radio-root"></div>
    </section>
  </div>

  <p class="footer-note">公開資料：天文台 · 九巴 ETA · 港鐵 Next Train · RTHK（手動播放）· 設定只存本機</p>
  <div id="settings-overlay" class="settings-overlay" hidden></div>
`;

startClock({
  timeEl: document.querySelector("#clock-time"),
  dateEl: document.querySelector("#clock-date"),
  locale: config.locale,
  timeZone: config.timeZone,
});

const netStatus = document.querySelector("#net-status");
const setNet = (text) => {
  netStatus.textContent = text;
};

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
