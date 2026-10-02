import "./style.css";
import { config } from "./config.js";
import { startClock } from "./clock.js";
import { createWeather } from "./weather.js";
import { createBus } from "./bus.js";
import { createRadio } from "./radio.js";
import { loadBusSelection } from "./busStore.js";
import { createBusSettings } from "./busSettings.js";

const app = document.querySelector("#app");

app.innerHTML = `
  <header class="brand-bar">
    <div class="brand">
      林村 Dashboard
      <small>Lam Tsuen · Tai Po</small>
    </div>
    <div class="status-pill" id="net-status" aria-live="polite">連線中</div>
  </header>

  <section class="hero-clock" aria-label="時鐘">
    <div class="clock-time" id="clock-time">--:--</div>
    <div class="clock-date" id="clock-date">—</div>
  </section>

  <div class="grid">
    <section class="panel" aria-labelledby="weather-title">
      <h2 id="weather-title">天氣 · 大埔</h2>
      <div id="weather-root"></div>
    </section>

    <section class="panel" aria-labelledby="bus-title">
      <h2 id="bus-title">巴士</h2>
      <div id="bus-root"></div>
    </section>

    <section class="panel span-2" aria-labelledby="radio-title">
      <h2 id="radio-title">電台</h2>
      <div id="radio-root"></div>
    </section>
  </div>

  <p class="footer-note">公開資料：天文台 · 九巴 ETA · RTHK 官方串流（手動播放）· 巴士設定只存本機</p>
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

createWeather(document.querySelector("#weather-root"), config.weather, { onStatus: setNet });

let busSelection = loadBusSelection();
const bus = createBus(document.querySelector("#bus-root"), document.querySelector("#bus-title"), {
  onStatus: setNet,
  onOpenSettings: () => settings.open(),
});

const settings = createBusSettings({
  overlayRoot: document.querySelector("#settings-overlay"),
  getSelection: () => busSelection,
  setSelection: (next) => {
    busSelection = next;
  },
  onChange: (next) => {
    bus.setSelection(next);
    setNet("巴士設定已更新（本機）");
  },
});

bus.start(busSelection);
createRadio(document.querySelector("#radio-root"), config.radio);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline install optional in dev */
    });
  });
}

window.addEventListener("online", () => setNet("已連線"));
window.addEventListener("offline", () => setNet("離線（顯示上次資料）"));
