import "./style.css";
import { config } from "./config.js";
import { startClock } from "./clock.js";
import { createWeather } from "./weather.js";
import { createBus } from "./bus.js";
import { createMtr } from "./mtr.js";
import { createHoliday } from "./holiday.js";
import { createRadio } from "./radio.js";
import { createTraffic, noticesForPins, homeNoticeHtml } from "./traffic.js";
import { createTco } from "./tco.js";
import { createMovies } from "./movies.js";
import { createTransitHub } from "./transitHub.js";
import { createGmb } from "./gmb.js";
import { createCitybus } from "./citybus.js";
import { createParking } from "./parking.js";
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
import { createSplitPage } from "./splitPage.js";

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
    <p id="morning-line" class="morning-line" aria-live="polite">載入摘要…</p>
    <div id="home-traffic" class="home-traffic" hidden></div>
    <p class="reorder-hint muted">⋮⋮ 可拖曳排序（只存呢部機）</p>

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
      ${panelShell("gmb", "gmb-title", "專線小巴", "gmb-root", "panel-gmb")}
      ${panelShell("citybus", "citybus-title", "城巴", "citybus-root", "panel-citybus")}
      ${panelShell("parking", "parking-title", "停車場", "parking-root", "panel-parking")}
      ${panelShell("radio", "radio-title", "電台", "radio-root")}
    </div>

    <p class="footer-note">公開資料：天文台 · AQHI · 九巴 · 專線小巴 · 城巴 · 港鐵 · 停車場 · 1823 假期 · 運輸署交通消息 · RTHK · 設定只存本機</p>
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

  <div id="view-transit" class="app-view" hidden>
    <section class="panel transit-hub-panel" aria-labelledby="transit-title">
      <div class="panel-head">
        <h2 id="transit-title">交通總覽</h2>
      </div>
      <div id="transit-hub-root"></div>
    </section>
  </div>

  <div id="view-split" class="app-view" hidden>
    <section class="panel split-page-panel" aria-labelledby="split-title">
      <div class="panel-head">
        <h2 id="split-title">外賣／堂食夾錢</h2>
      </div>
      <p class="muted split-intro">Keeta 外賣夾單・堂食加一</p>
      <div id="split-root"></div>
    </section>
  </div>

  <div id="view-fx" class="app-view" hidden>
    <section class="panel split-page-panel" aria-labelledby="fx-title">
      <div class="panel-head">
        <h2 id="fx-title">外幣／退稅計數</h2>
      </div>
      <p class="muted split-intro">免稅回贈・簽卡同現金。匯率只存呢部機。</p>
      <div id="fx-root"></div>
    </section>
  </div>

  <div id="view-movies" class="app-view" hidden>
    <section class="panel movies-page-panel" data-panel-id="movies" aria-labelledby="movies-title">
      <div class="panel-head">
        <h2 id="movies-title">戲院場次</h2>
      </div>
      <div id="movies-root"></div>
    </section>
  </div>

  <div id="view-arcade" class="app-view" hidden>
    <section class="panel arcade-page-panel" aria-label="Arcade">
      <div id="arcade-root"></div>
    </section>
  </div>

  <div id="drawer-root"></div>
  <div id="settings-overlay" class="settings-overlay" hidden></div>

  <nav class="bottom-tab-bar" id="bottom-tabs" aria-label="主導覽">
    <button type="button" class="bottom-tab" data-tab="home" aria-current="page">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 3.2 3.5 10.2V21h6.2v-6.1h4.6V21h6.2V10.2L12 3.2z"/></svg>
      <span>主頁</span>
    </button>
    <button type="button" class="bottom-tab" data-tab="transit">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2 4.5 5.2v5.4C4.5 15.4 7.6 19.7 12 21c4.4-1.3 7.5-5.6 7.5-10.4V5.2L12 2zm-1.1 12.7L7.2 11l1.4-1.4 2.3 2.3 4.7-4.7L17 8.6l-6.1 6.1z"/></svg>
      <span>交通</span>
    </button>
    <button type="button" class="bottom-tab" data-tab="more">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 7h16v2H4V7zm0 4h16v2H4v-2zm0 4h16v2H4v-2z"/></svg>
      <span>更多</span>
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
const viewMovies = document.querySelector("#view-movies");
const viewTransit = document.querySelector("#view-transit");
const viewSplit = document.querySelector("#view-split");
const viewFx = document.querySelector("#view-fx");
const viewArcade = document.querySelector("#view-arcade");
const stack = document.querySelector("#panel-stack");

const VIEW_SUB = {
  home: "個人儀表板",
  traffic: "特別交通消息",
  tco: "買車成本模擬",
  movies: "戲院場次",
  transit: "交通總覽",
  split: "外賣／堂食夾錢",
  fx: "外幣／退稅計數",
  arcade: "Arcade",
};

let arcadeReady = false;

const bottomTabs = document.querySelector("#bottom-tabs");

const syncBottomTabs = (name) => {
  const tab = name === "home" ? "home" : name === "transit" ? "transit" : "more";
  bottomTabs?.querySelectorAll(".bottom-tab").forEach((btn) => {
    const on = btn.dataset.tab === tab;
    btn.setAttribute("aria-current", on ? "page" : "false");
    btn.classList.toggle("is-active", on);
  });
};

const showView = (name) => {
  viewHome.hidden = name !== "home";
  viewTraffic.hidden = name !== "traffic";
  viewTco.hidden = name !== "tco";
  viewMovies.hidden = name !== "movies";
  viewTransit.hidden = name !== "transit";
  viewSplit.hidden = name !== "split";
  viewFx.hidden = name !== "fx";
  viewArcade.hidden = name !== "arcade";
  brandSub.textContent = VIEW_SUB[name] || "個人儀表板";
  document.body.dataset.view = name;
  syncBottomTabs(name);
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

const paintMorning = () => {
  const line = document.querySelector("#morning-line");
  if (!line) return;
  const w = weather.getDigest();
  const h = holiday.getDigest();
  const etas = [bus.getSoonest(), mtr.getSoonest()].filter((row) => row && Number.isFinite(row.mins));
  etas.sort((a, b) => a.mins - b.mins);
  const bits = [];
  if (w && (w.temp != null || w.warning)) {
    bits.push([w.temp != null ? `${w.temp}°` : "", w.warning || ""].filter(Boolean).join(" "));
  }
  if (h?.text) bits.push(h.text);
  if (etas[0]?.text) bits.push(etas[0].text);
  line.textContent = bits.join(" · ") || "載入摘要…";
};

const weather = createWeather(document.querySelector("#weather-root"), config.weather, {
  onStatus: setNet,
  onChangePlace: () => settings.open("weather"),
  onDigest: () => paintMorning(),
});

const holiday = createHoliday(document.querySelector("#holiday-root"), {
  onStatus: setNet,
  onDigest: () => paintMorning(),
});

const bus = createBus(
  document.querySelector("#bus-root"),
  document.querySelector("#bus-title"),
  {
    onStatus: setNet,
    actionsEl: document.querySelector("#bus-actions"),
    onSelectionPersist: (next) => {
      busSelection = next;
      transitHub.setBusSelection(next);
      paintHomeTraffic();
    },
    onDigest: () => paintMorning(),
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
      transitHub.setMtrSelection(next);
      paintHomeTraffic();
    },
    onDigest: () => paintMorning(),
  }
);

const pinNeedles = () => {
  const routes = [];
  const names = [];
  for (const it of busSelection?.items || []) {
    if (it.route) routes.push(it.route);
    const stop = String(it.stopName || "")
      .replace(/\s*[（(][A-Za-z]{1,5}\d+[A-Za-z]?[）)]\s*$/u, "")
      .trim();
    if (stop.length >= 2) names.push(stop);
  }
  for (const station of mtrSelection?.stations || []) {
    if (station.nameTc) names.push(station.nameTc);
  }
  return { routes, names };
};

const paintHomeTraffic = () => {
  const host = document.querySelector("#home-traffic");
  if (!host) return;
  const html = homeNoticeHtml(noticesForPins(traffic.getItems(), pinNeedles(), 2));
  host.hidden = !html;
  host.innerHTML = html;
};

const traffic = createTraffic(document.querySelector("#traffic-root"), {
  onStatus: setNet,
  onItems: () => paintHomeTraffic(),
});
const tco = createTco(document.querySelector("#tco-root"));
const movies = createMovies(document.querySelector("#movies-root"), { onStatus: setNet });
const gmbHome = createGmb(document.querySelector("#gmb-root"), { mode: "home", onStatus: setNet });
const citybusHome = createCitybus(document.querySelector("#citybus-root"), { mode: "home", onStatus: setNet });
const parkingHome = createParking(document.querySelector("#parking-root"), { mode: "home", onStatus: setNet });
const splitPage = createSplitPage(document.querySelector("#split-root"), { mode: "bill" });
const fxPage = createSplitPage(document.querySelector("#fx-root"), { mode: "fx" });
const transitHub = createTransitHub(document.querySelector("#transit-hub-root"), {
  getEnabled: () => moduleEnabled,
  setEnabled: (next) => {
    moduleEnabled = next;
  },
  onEnabledChange: (next) => {
    moduleEnabled = next;
    applyVisibility();
    gmbHome.refresh();
    citybusHome.refresh();
    parkingHome.refresh();
    setNet("主頁模組已更新（本機）");
  },
  onStatus: setNet,
  getBusSelection: () => busSelection,
  getMtrSelection: () => mtrSelection,
  onBusSelection: (next) => {
    busSelection = next;
    bus.setSelection(next);
  },
  onMtrSelection: (next) => {
    mtrSelection = next;
    mtr.setSelection(next);
  },
  onOpenMtrSettings: () => settings.open("mtr"),
});

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
    gmbHome.refresh();
    citybusHome.refresh();
    parkingHome.refresh();
    transitHub.refreshToggles();
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
  onNavigateMovies: () => {
    showView("movies");
    movies.start();
    setNet("戲院場次");
  },
  onNavigateTransit: () => {
    showView("transit");
    transitHub.start();
    setNet("交通總覽");
  },
  onNavigateSplit: () => {
    showView("split");
    splitPage.start();
    setNet("外賣／堂食夾錢（只計本機）");
  },
  onNavigateFx: () => {
    showView("fx");
    fxPage.start();
    setNet("外幣／退稅計數（只計本機）");
  },
  onNavigateArcade: () => {
    showView("arcade");
    setNet("Arcade");
    if (arcadeReady) return;
    arcadeReady = true;
    const root = document.querySelector("#arcade-root");
    import("./arcade.js")
      .then(({ createArcade }) => {
        createArcade(root).start();
      })
      .catch(() => {
        arcadeReady = false;
        setNet("Arcade 暫未載入");
      });
  },
  onVisibility: (isOpen) => {
    if (isOpen) syncBottomTabs("more");
    else syncBottomTabs(document.body.dataset.view || "home");
  },
});

document.querySelector("#menu-btn").addEventListener("click", () => drawer.toggle());

bottomTabs?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === "home") {
    showView("home");
    drawer.close();
  } else if (tab === "transit") {
    showView("transit");
    drawer.close();
    transitHub.start();
    setNet("交通總覽");
  } else if (tab === "more") {
    drawer.open();
  }
});

const boot = () => {
  updateWeatherTitle(weatherPlace);
  weather.start(weatherPlace);
  holiday.start();
  bus.start(busSelection);
  mtr.start(mtrSelection);
  gmbHome.start();
  citybusHome.start();
  parkingHome.start();
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
