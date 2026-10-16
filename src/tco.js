import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Legend,
  Tooltip,
} from "chart.js";
import {
  PRESETS,
  calcLoan,
  calcResale,
  fmtHK,
  fmtWan,
  simulateBuyVsTransport,
  simulateEvVsIce,
} from "./tcoCalc.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Legend,
  Tooltip
);

function bindPair(root, numId, sliderId, onChange) {
  const num = root.querySelector(`#${numId}`);
  const slider = root.querySelector(`#${sliderId}`);
  if (!num || !slider) return;
  const sync = (from) => {
    const v = from.value;
    num.value = v;
    slider.value = v;
    onChange();
  };
  num.addEventListener("input", () => sync(num));
  slider.addEventListener("input", () => sync(slider));
}

/**
 * HK buy-vs-transit / EV-vs-ICE TCO simulator page.
 * Ported from Gemini HTML (inputs/presets/modes); Chart.js bundled for CSP.
 */
export function createTco(root) {
  let comparisonMode = "buyVsTransport"; // buyVsTransport | evVsIce
  let powertrain = "EV";
  let loanRateType = "FLAT";
  let corpTaxRate = 8.25;
  let chart;
  let started = false;

  root.innerHTML = `
    <div class="tco-page">
      <header class="tco-hero">
        <h2 class="tco-title">香港買車 vs 搭車 · EV vs 油車</h2>
        <p class="muted tco-sub">10 年期 TCO 財務模擬：一換一車價、上會、車位、牌費燕梳、折舊殘值同機會成本</p>
        <div class="tco-presets" role="group" aria-label="快速車款情境">
          <button type="button" class="tco-chip" data-preset="evFamily">家用電動車</button>
          <button type="button" class="tco-chip" data-preset="iceJapan">日系家庭油車</button>
          <button type="button" class="tco-chip" data-preset="luxuryMpv">豪華／七人車</button>
          <button type="button" class="tco-chip" data-preset="highMileage">高里數通勤</button>
        </div>
      </header>

      <div class="tco-modebar">
        <div class="tco-mode-tabs" role="tablist" aria-label="分析模式">
          <button type="button" class="tco-mode-tab" data-mode="buyVsTransport" aria-selected="true">模式 A：買車 vs 搭車+投資</button>
          <button type="button" class="tco-mode-tab" data-mode="evVsIce" aria-selected="false">模式 B：EV vs 汽油車</button>
        </div>
        <label class="tco-horizon">
          <span>持有年期</span>
          <input type="range" id="slider-horizon" min="3" max="10" step="1" value="10" />
          <strong id="label-horizon-years">10 年</strong>
        </label>
      </div>

      <div class="tco-kpi-grid">
        <article class="tco-kpi tco-kpi-a">
          <span class="tco-kpi-label" id="kpi1-title">買車真實總淨成本 (TCO)</span>
          <strong class="tco-kpi-main" id="kpi1-main-val">—</strong>
          <span class="tco-kpi-badge" id="kpi1-badge">—</span>
          <div class="tco-kpi-subs">
            <div><span class="muted">月均</span><b id="kpi1-sub1">—</b></div>
            <div><span class="muted">每公里</span><b id="kpi1-sub2">—</b></div>
            <div><span class="muted">殘值</span><b id="kpi1-sub3">—</b></div>
          </div>
        </article>
        <article class="tco-kpi tco-kpi-b">
          <span class="tco-kpi-label" id="kpi2-title">對照結果</span>
          <strong class="tco-kpi-main" id="kpi2-main-val">—</strong>
          <span class="tco-kpi-badge" id="kpi2-badge">—</span>
          <div class="tco-kpi-subs">
            <div><span class="muted">說明</span><b id="kpi2-sub1">—</b></div>
          </div>
        </article>
        <article class="tco-kpi tco-kpi-c">
          <span class="tco-kpi-label" id="kpi3-title">差額優勢</span>
          <strong class="tco-kpi-main" id="kpi3-main-val">—</strong>
          <span class="tco-kpi-badge" id="kpi3-badge">—</span>
          <p class="tco-kpi-note muted" id="kpi3-note">—</p>
        </article>
        <article class="tco-kpi tco-kpi-d">
          <span class="tco-kpi-label">結論</span>
          <strong class="tco-kpi-main tco-kpi-verdict" id="kpi4-main-val">—</strong>
          <p class="tco-kpi-note muted" id="kpi4-note">數字只供財務模擬參考，唔係投資建議。</p>
        </article>
      </div>

      <div class="tco-chart-wrap">
        <h3 class="tco-sec-h">累積現金／成本走勢</h3>
        <canvas id="tco-chart" height="220" aria-label="TCO 圖表"></canvas>
      </div>

      <details class="tco-section" open>
        <summary>1. 買車、車種及上會</summary>
        <div class="tco-sec-body">
          <div class="tco-type-tabs">
            <button type="button" class="tco-type-tab" data-power="EV" aria-selected="true">電動車 (EV)</button>
            <button type="button" class="tco-type-tab" data-power="ICE" aria-selected="false">汽油／混能 (ICE)</button>
          </div>

          <label class="tco-field">
            <span class="tco-field-top"><span>出車總價（連稅／一換一後）</span><b id="label-car-price-wan">—</b></span>
            <input type="number" id="input-car-price" value="280000" min="50000" max="1500000" step="10000" />
            <input type="range" id="slider-car-price" min="50000" max="1500000" step="10000" value="280000" />
          </label>

          <label class="tco-field">
            <span class="tco-field-top"><span>首期比例</span><b><span id="input-downpayment-view"></span>%</b></span>
            <input type="number" id="input-downpayment" value="20" min="0" max="100" step="5" />
            <input type="range" id="slider-downpayment" min="0" max="100" step="5" value="20" />
            <div class="tco-mini-grid">
              <div><span class="muted">首期</span><b id="summary-downpayment-amt">—</b></div>
              <div><span class="muted">貸款 (<span id="summary-loan-pct">80</span>%)</span><b id="summary-loan-amt">—</b></div>
            </div>
          </label>

          <div class="tco-loan-box">
            <div class="tco-type-tabs">
              <button type="button" class="tco-loan-tab" data-loan="FLAT" aria-selected="true">平息 Flat</button>
              <button type="button" class="tco-loan-tab" data-loan="APR" aria-selected="false">實際年利率 APR</button>
            </div>
            <label class="tco-field">
              <span class="tco-field-top"><span id="label-rate-title">車貸年平息率</span><b>%</b></span>
              <input type="number" id="input-loan-rate" value="2.5" min="0" max="10" step="0.25" />
              <input type="range" id="slider-loan-rate" min="0" max="10" step="0.25" value="2.5" />
            </label>
            <label class="tco-field">
              <span class="tco-field-top"><span>上會年期</span><b>年</b></span>
              <input type="number" id="input-loan-years" value="5" min="1" max="5" step="1" />
              <input type="range" id="slider-loan-years" min="1" max="5" step="1" value="5" />
            </label>
            <div class="tco-mini-grid tco-loan-sum">
              <div><span class="muted">月供</span><b id="summary-loan-pmt">—</b></div>
              <div><span class="muted">總利息</span><b id="summary-total-interest">—</b></div>
              <div><span class="muted">折合 APR</span><b id="summary-effective-apr">—</b></div>
            </div>
          </div>

          <label class="tco-field">
            <span class="tco-field-top"><span>其後每年折舊率（首年固定 20%）</span><b id="summary-resale-val">—</b></span>
            <input type="number" id="input-dep-rate" value="15" min="8" max="25" step="1" />
            <input type="range" id="slider-dep-rate" min="8" max="25" step="1" value="15" />
          </label>
        </div>
      </details>

      <details class="tco-section" open>
        <summary>2. 每月／每年養車開支</summary>
        <div class="tco-sec-body">
          <label class="tco-field">
            <span class="tco-field-top"><span>月租車位</span><b>$/月</b></span>
            <input type="number" id="input-monthly-parking" value="3600" min="1000" max="8000" step="100" />
            <input type="range" id="slider-monthly-parking" class="emerald" min="1000" max="8000" step="100" value="3600" />
          </label>
          <label class="tco-field">
            <span class="tco-field-top"><span>時租泊車 + 隧道／過海</span><b>$/月</b></span>
            <input type="number" id="input-hourly-tunnel" value="1800" min="300" max="7000" step="100" />
            <input type="range" id="slider-hourly-tunnel" class="emerald" min="300" max="7000" step="100" value="1800" />
          </label>
          <label class="tco-field">
            <span class="tco-field-top"><span>每月行駛里數</span><b id="summary-yearly-km">—</b></span>
            <input type="number" id="input-monthly-km" value="1200" min="300" max="4000" step="100" />
            <input type="range" id="slider-monthly-km" class="emerald" min="300" max="4000" step="100" value="1200" />
          </label>

          <div class="tco-energy-box">
            <div class="tco-field-top">
              <span>每公里電費／油費</span>
              <b id="summary-monthly-energy">—</b>
            </div>
            <div class="tco-inline-num">
              <input type="number" id="input-cost-per-km" value="0.40" min="0.1" max="4.5" step="0.05" />
              <span class="muted">$/km</span>
              <button type="button" class="ghost-btn" id="btn-energy-helper">輔助計算</button>
            </div>
            <div id="energy-helper-box" class="tco-helper" hidden>
              <div class="tco-helper-grid">
                <div>
                  <strong>EV</strong>
                  <label>充電費($/度)<input type="number" id="helper-ev-price" value="2.5" step="0.1" /></label>
                  <label>電耗(kWh/100km)<input type="number" id="helper-ev-eff" value="16" step="0.5" /></label>
                  <button type="button" class="tab" id="btn-apply-ev">套用 $<span id="helper-ev-res">0.40</span>/km</button>
                </div>
                <div>
                  <strong>ICE</strong>
                  <label>油價($/L)<input type="number" id="helper-ice-price" value="22.5" step="0.5" /></label>
                  <label>油耗(L/100km)<input type="number" id="helper-ice-eff" value="7.5" step="0.5" /></label>
                  <button type="button" class="tab" id="btn-apply-ice">套用 $<span id="helper-ice-res">1.69</span>/km</button>
                </div>
              </div>
            </div>
          </div>

          <div class="tco-mini-grid tco-fees">
            <label>每年牌費<input type="number" id="input-license-fee" value="1500" min="500" max="18000" step="100" /></label>
            <label>每年燕梳<input type="number" id="input-insurance-fee" value="6500" min="2000" max="30000" step="500" /></label>
            <label>保養／牛肉乾<input type="number" id="input-maint-fee" value="6000" min="1000" max="40000" step="500" /></label>
          </div>
        </div>
      </details>

      <details class="tco-section" open>
        <summary>3. 搭車預算、投資同扣稅</summary>
        <div class="tco-sec-body">
          <div id="box-mode-a-inputs">
            <label class="tco-field">
              <span class="tco-field-top"><span>唔買車每月替代交通</span><b>$/月</b></span>
              <input type="number" id="input-alt-transport" value="3200" min="500" max="15000" step="100" />
              <input type="range" id="slider-alt-transport" class="emerald" min="500" max="15000" step="100" value="3200" />
            </label>
            <label class="tco-field">
              <span class="tco-field-top"><span>省下資金年化回報</span><b>%</b></span>
              <input type="number" id="input-inv-return" value="6.0" min="0" max="12" step="0.5" />
              <input type="range" id="slider-inv-return" class="amber" min="0" max="12" step="0.5" value="6.0" />
            </label>
          </div>

          <div id="box-mode-b-inputs" class="tco-ice-box" hidden>
            <strong>對照組：同級汽油車參數</strong>
            <div class="tco-mini-grid tco-fees">
              <label>油車出車價<input type="number" id="input-ice-comp-price" value="260000" step="10000" /></label>
              <label>油車 $/km<input type="number" id="input-ice-comp-fuel" value="1.75" step="0.05" /></label>
              <label>油車牌費／年<input type="number" id="input-ice-comp-license" value="5074" step="500" /></label>
              <label>油車保養+燕梳／年<input type="number" id="input-ice-comp-maint" value="14500" step="500" /></label>
            </div>
          </div>

          <div class="tco-tax-row">
            <div>
              <strong>公司名義／業務用途扣稅</strong>
              <p class="muted">首年 60% 初期免稅額 + 每年 30% 折舊免稅額（簡化模型）</p>
            </div>
            <label class="tco-switch">
              <input type="checkbox" id="toggle-corp-tax" />
              <span>啟用</span>
            </label>
          </div>
          <div id="corp-tax-details" class="tco-tax-details" hidden>
            <div class="tco-type-tabs">
              <button type="button" class="tco-tax-tab" data-tax="8.25" aria-selected="true">8.25%</button>
              <button type="button" class="tco-tax-tab" data-tax="15" aria-selected="false">15%</button>
              <button type="button" class="tco-tax-tab" data-tax="16.5" aria-selected="false">16.5%</button>
            </div>
            <p class="muted">全期稅務節省（計及賣車 balancing charge）：<b id="summary-corp-tax-saved">HK$ 0</b></p>
          </div>
        </div>
      </details>

      <details class="tco-section">
        <summary>按年明細</summary>
        <div class="tco-table-wrap">
          <table class="tco-table" id="tco-year-table">
            <thead></thead>
            <tbody></tbody>
          </table>
        </div>
      </details>

      <p class="device-local-hint">模擬器只喺呢部機運算，唔會上傳資料。參數可自由調校。</p>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);
  const num = (id) => Number($(id).value);

  const readInput = () => ({
    carPrice: num("#input-car-price"),
    downPct: num("#input-downpayment"),
    loanRatePct: num("#input-loan-rate"),
    loanYears: num("#input-loan-years"),
    loanRateType,
    horizon: num("#slider-horizon"),
    depRatePct: num("#input-dep-rate"),
    monthlyParking: num("#input-monthly-parking"),
    monthlyHourlyTunnel: num("#input-hourly-tunnel"),
    monthlyKm: num("#input-monthly-km"),
    costPerKm: num("#input-cost-per-km"),
    licenseFee: num("#input-license-fee"),
    insuranceFee: num("#input-insurance-fee"),
    maintFee: num("#input-maint-fee"),
    altTransportMonthly: num("#input-alt-transport"),
    invReturnPct: num("#input-inv-return"),
    iceCompPrice: num("#input-ice-comp-price"),
    iceCompFuel: num("#input-ice-comp-fuel"),
    iceCompLicense: num("#input-ice-comp-license"),
    iceCompMaint: num("#input-ice-comp-maint"),
    corpTaxEnabled: $("#toggle-corp-tax").checked,
    corpTaxRatePct: corpTaxRate,
    powertrain,
  });

  const applyPowertrainDefaults = () => {
    if (powertrain === "EV") {
      $("#input-license-fee").value = 1500;
      if (num("#input-cost-per-km") > 1) $("#input-cost-per-km").value = 0.4;
      if (num("#input-maint-fee") > 10000) $("#input-maint-fee").value = 6000;
    } else {
      $("#input-license-fee").value = 5074;
      if (num("#input-cost-per-km") < 1) $("#input-cost-per-km").value = 1.7;
      if (num("#input-maint-fee") < 7000) $("#input-maint-fee").value = 8000;
    }
  };

  const setMode = (mode) => {
    comparisonMode = mode;
    root.querySelectorAll("[data-mode]").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.mode === mode));
    });
    $("#box-mode-a-inputs").hidden = mode !== "buyVsTransport";
    $("#box-mode-b-inputs").hidden = mode !== "evVsIce";
    recalculate();
  };

  const applyPreset = (key) => {
    const p = PRESETS[key];
    if (!p) return;
    powertrain = p.powertrain;
    loanRateType = p.loanRateType;
    root.querySelectorAll("[data-power]").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.power === powertrain));
    });
    root.querySelectorAll("[data-loan]").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.loan === loanRateType));
    });
    const map = {
      "#input-car-price": p.carPrice,
      "#slider-car-price": p.carPrice,
      "#input-downpayment": p.downPct,
      "#slider-downpayment": p.downPct,
      "#input-loan-rate": p.loanRatePct,
      "#slider-loan-rate": p.loanRatePct,
      "#input-loan-years": p.loanYears,
      "#slider-loan-years": p.loanYears,
      "#input-dep-rate": p.depRatePct,
      "#slider-dep-rate": p.depRatePct,
      "#input-monthly-parking": p.monthlyParking,
      "#slider-monthly-parking": p.monthlyParking,
      "#input-hourly-tunnel": p.monthlyHourlyTunnel,
      "#slider-hourly-tunnel": p.monthlyHourlyTunnel,
      "#input-monthly-km": p.monthlyKm,
      "#slider-monthly-km": p.monthlyKm,
      "#input-cost-per-km": p.costPerKm,
      "#input-license-fee": p.licenseFee,
      "#input-insurance-fee": p.insuranceFee,
      "#input-maint-fee": p.maintFee,
      "#input-alt-transport": p.altTransportMonthly,
      "#slider-alt-transport": p.altTransportMonthly,
      "#input-inv-return": p.invReturnPct,
      "#slider-inv-return": p.invReturnPct,
      "#input-ice-comp-price": p.iceCompPrice,
      "#input-ice-comp-fuel": p.iceCompFuel,
      "#input-ice-comp-license": p.iceCompLicense,
      "#input-ice-comp-maint": p.iceCompMaint,
    };
    for (const [sel, val] of Object.entries(map)) {
      const node = $(sel);
      if (node) node.value = val;
    }
    $("#label-rate-title").textContent =
      loanRateType === "APR" ? "實際年利率 (APR)" : "車貸年平息率";
    recalculate();
  };

  const updateHelpers = () => {
    const ev =
      (num("#helper-ev-price") * num("#helper-ev-eff")) / 100;
    const ice =
      (num("#helper-ice-price") * num("#helper-ice-eff")) / 100;
    $("#helper-ev-res").textContent = ev.toFixed(2);
    $("#helper-ice-res").textContent = ice.toFixed(2);
  };

  const renderChart = (result) => {
    const canvas = $("#tco-chart");
    const labels = result.years.map((y) => `Y${y.year}`);
    let datasets;
    if (result.mode === "buyVsTransport") {
      let buyCum = result.down;
      const buySeries = result.years.map((y, idx) => {
        buyCum += y.buyOut;
        const net = buyCum - (idx === result.years.length - 1 ? result.resale : 0);
        return Math.round(net);
      });
      const investSeries = result.years.map((y) => Math.round(y.investBalance || 0));
      let tCum = 0;
      const tSeries = result.years.map((y) => {
        tCum += y.transportOut;
        return Math.round(tCum);
      });
      datasets = [
        {
          label: "買車累積淨成本",
          data: buySeries,
          borderColor: "#5aa7d6",
          backgroundColor: "rgba(90,167,214,0.12)",
          fill: true,
          tension: 0.25,
        },
        {
          label: "搭車累積開支",
          data: tSeries,
          borderColor: "#d4a15a",
          backgroundColor: "transparent",
          tension: 0.25,
        },
        {
          label: "投資組合結餘",
          data: investSeries,
          borderColor: "#5fbf95",
          backgroundColor: "transparent",
          tension: 0.25,
        },
      ];
    } else {
      let evCum = result.down;
      const evSeries = result.years.map((y, idx) => {
        evCum += y.buyOut;
        return Math.round(evCum - (idx === result.years.length - 1 ? result.resale : 0));
      });
      let iceCum = (num("#input-ice-comp-price") * num("#input-downpayment")) / 100;
      const iceSeries = result.years.map((y, idx) => {
        iceCum += y.iceOut || 0;
        const iceResale = idx === result.years.length - 1 ? result.iceResale : 0;
        return Math.round(iceCum - iceResale);
      });
      datasets = [
        {
          label: "EV 累積淨成本",
          data: evSeries,
          borderColor: "#5aa7d6",
          backgroundColor: "rgba(90,167,214,0.12)",
          fill: true,
          tension: 0.25,
        },
        {
          label: "汽油車累積淨成本",
          data: iceSeries,
          borderColor: "#d4a15a",
          backgroundColor: "transparent",
          tension: 0.25,
        },
      ];
    }

    if (chart) chart.destroy();
    chart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#9aa8a0", boxWidth: 12, font: { size: 11 } },
          },
        },
        scales: {
          x: {
            ticks: { color: "#9aa8a0", maxRotation: 0 },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
          y: {
            ticks: {
              color: "#9aa8a0",
              callback: (v) => `${Math.round(v / 10000)}萬`,
            },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
        },
      },
    });
  };

  const renderTable = (result) => {
    const thead = $("#tco-year-table thead");
    const tbody = $("#tco-year-table tbody");
    if (result.mode === "buyVsTransport") {
      thead.innerHTML = `<tr><th>年</th><th>買車現金</th><th>搭車</th><th>投資結餘</th><th>稅省</th></tr>`;
      tbody.innerHTML = result.years
        .map(
          (y) => `<tr>
          <td>Y${y.year}</td>
          <td>${fmtHK(y.buyOut)}</td>
          <td>${fmtHK(y.transportOut)}</td>
          <td>${fmtHK(y.investBalance)}</td>
          <td>${fmtHK(y.taxSave)}</td>
        </tr>`
        )
        .join("");
    } else {
      thead.innerHTML = `<tr><th>年</th><th>EV 現金</th><th>油車現金</th><th>EV 稅省</th></tr>`;
      tbody.innerHTML = result.years
        .map(
          (y) => `<tr>
          <td>Y${y.year}</td>
          <td>${fmtHK(y.buyOut)}</td>
          <td>${fmtHK(y.iceOut)}</td>
          <td>${fmtHK(y.taxSave)}</td>
        </tr>`
        )
        .join("");
    }
  };

  const recalculate = () => {
    const input = readInput();
    const horizon = input.horizon;
    $("#label-horizon-years").textContent = `${horizon} 年`;
    $("#label-car-price-wan").textContent = fmtWan(input.carPrice);
    $("#input-downpayment-view").textContent = String(input.downPct);
    $("#summary-yearly-km").textContent = `每年 ${(input.monthlyKm * 12).toLocaleString("en-HK")} km`;
    $("#summary-monthly-energy").textContent = `每月能耗 ${fmtHK(input.monthlyKm * input.costPerKm)}`;

    const down = (input.carPrice * input.downPct) / 100;
    const principal = input.carPrice - down;
    const loan = calcLoan(principal, input.loanRatePct, input.loanYears, loanRateType);
    $("#summary-downpayment-amt").textContent = fmtHK(down);
    $("#summary-loan-pct").textContent = String(100 - input.downPct);
    $("#summary-loan-amt").textContent = fmtHK(principal);
    $("#summary-loan-pmt").textContent = `月供 ${fmtHK(loan.monthly)}`;
    $("#summary-total-interest").textContent = fmtHK(loan.totalInterest);
    $("#summary-effective-apr").textContent =
      loanRateType === "APR"
        ? `APR ${input.loanRatePct.toFixed(2)}%`
        : `折合 APR ≈ ${loan.approxApr.toFixed(2)}%`;
    const resale = calcResale(input.carPrice, horizon, input.depRatePct);
    $("#summary-resale-val").textContent = `第${horizon}年殘值 ${fmtHK(resale)}`;

    const result =
      comparisonMode === "buyVsTransport"
        ? simulateBuyVsTransport(input)
        : simulateEvVsIce(input);

    $("#summary-corp-tax-saved").textContent = fmtHK(result.corpTaxTotal || 0);

    if (result.mode === "buyVsTransport") {
      $("#kpi1-title").textContent = `${horizon}年買車「真實總淨成本」(TCO)`;
      $("#kpi1-main-val").textContent = fmtHK(result.buyNetTco);
      $("#kpi1-badge").textContent = `${powertrain} 總淨開支`;
      $("#kpi1-sub1").textContent = `${fmtHK(result.monthlyAvg)} /月`;
      $("#kpi1-sub2").textContent = `$${result.perKm.toFixed(2)} /km`;
      $("#kpi1-sub3").textContent = fmtHK(result.resale);

      $("#kpi2-title").textContent = `${horizon}年貸款本金機會成本投資期末結餘`;
      $("#kpi2-main-val").textContent = fmtHK(result.investFinal);
      $("#kpi2-badge").textContent = "月結模擬（車價−首期）";
      $("#kpi2-sub1").textContent = `搭車總開支 ${fmtHK(result.transportTotalSpend)}`;

      const ahead = result.gap; // buyNet - transport + invest
      // Positive ahead means not-buying financial position is better by that amount
      $("#kpi3-title").textContent = "相對優勢（機會投資結餘 − 買車淨成本 + 搭車開支調整）";
      $("#kpi3-main-val").textContent = fmtHK(ahead);
      $("#kpi3-badge").textContent = ahead >= 0 ? "搭車較着數" : "買車較着數";
      $("#kpi3-note").textContent =
        ahead >= 0
          ? `模擬期末，搭車+投資組合相對買車淨成本着數約 ${fmtHK(ahead)}。`
          : `模擬期末，買車路徑相對着數約 ${fmtHK(-ahead)}（未計方便／時間價值）。`;
      $("#kpi4-main-val").textContent = ahead >= 0 ? "傾向搭車 + 投資" : "傾向買車自駕";
      $("#kpi4-note").textContent =
        "已計折舊殘值、上會利息、養車同（可選）公司扣稅；實際仲有時間、方便同風險。";
    } else {
      $("#kpi1-title").textContent = `${horizon}年 EV 真實總淨成本`;
      $("#kpi1-main-val").textContent = fmtHK(result.buyNetTco);
      $("#kpi1-badge").textContent = "EV TCO";
      $("#kpi1-sub1").textContent = `${fmtHK(result.monthlyAvg)} /月`;
      $("#kpi1-sub2").textContent = `$${result.perKm.toFixed(2)} /km`;
      $("#kpi1-sub3").textContent = fmtHK(result.resale);

      $("#kpi2-title").textContent = `${horizon}年汽油車真實總淨成本`;
      $("#kpi2-main-val").textContent = fmtHK(result.iceBuyNetTco);
      $("#kpi2-badge").textContent = "ICE TCO";
      $("#kpi2-sub1").textContent = `殘值 ${fmtHK(result.iceResale)}`;

      $("#kpi3-title").textContent = "EV 相對油車節省";
      $("#kpi3-main-val").textContent = fmtHK(result.gap);
      $("#kpi3-badge").textContent = result.gap >= 0 ? "EV 較着數" : "油車較着數";
      $("#kpi3-note").textContent =
        result.gap >= 0
          ? `同樣持有期内，EV 預計少使約 ${fmtHK(result.gap)}。`
          : `油車預計少使約 ${fmtHK(-result.gap)}（未計充電方便／商標）。`;
      $("#kpi4-main-val").textContent = result.gap >= 0 ? "傾向電動車" : "傾向汽油車";
      $("#kpi4-note").textContent = "對照組用右側「同級汽油車參數」；主車參數來自上方輸入。";
    }

    renderChart(result);
    renderTable(result);
    updateHelpers();
  };

  // Wire controls
  [
    ["input-car-price", "slider-car-price"],
    ["input-downpayment", "slider-downpayment"],
    ["input-loan-rate", "slider-loan-rate"],
    ["input-loan-years", "slider-loan-years"],
    ["input-dep-rate", "slider-dep-rate"],
    ["input-monthly-parking", "slider-monthly-parking"],
    ["input-hourly-tunnel", "slider-hourly-tunnel"],
    ["input-monthly-km", "slider-monthly-km"],
    ["input-alt-transport", "slider-alt-transport"],
    ["input-inv-return", "slider-inv-return"],
  ].forEach(([a, b]) => bindPair(root, a, b, recalculate));

  ["#input-cost-per-km", "#input-license-fee", "#input-insurance-fee", "#input-maint-fee",
    "#input-ice-comp-price", "#input-ice-comp-fuel", "#input-ice-comp-license", "#input-ice-comp-maint",
    "#helper-ev-price", "#helper-ev-eff", "#helper-ice-price", "#helper-ice-eff",
  ].forEach((sel) => $(sel)?.addEventListener("input", recalculate));

  $("#slider-horizon").addEventListener("input", recalculate);

  root.querySelector(".tco-presets").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (btn) applyPreset(btn.dataset.preset);
  });
  root.querySelector(".tco-mode-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (btn) setMode(btn.dataset.mode);
  });
  root.querySelector(".tco-type-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-power]");
    if (!btn) return;
    powertrain = btn.dataset.power;
    root.querySelectorAll("[data-power]").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.power === powertrain));
    });
    applyPowertrainDefaults();
    recalculate();
  });
  root.querySelectorAll("[data-loan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loanRateType = btn.dataset.loan;
      root.querySelectorAll("[data-loan]").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.loan === loanRateType));
      });
      $("#label-rate-title").textContent =
        loanRateType === "APR" ? "實際年利率 (APR)" : "車貸年平息率";
      recalculate();
    });
  });

  $("#btn-energy-helper").addEventListener("click", () => {
    const box = $("#energy-helper-box");
    box.hidden = !box.hidden;
  });
  $("#btn-apply-ev").addEventListener("click", () => {
    $("#input-cost-per-km").value = Number($("#helper-ev-res").textContent).toFixed(2);
    recalculate();
  });
  $("#btn-apply-ice").addEventListener("click", () => {
    $("#input-cost-per-km").value = Number($("#helper-ice-res").textContent).toFixed(2);
    recalculate();
  });

  $("#toggle-corp-tax").addEventListener("change", () => {
    $("#corp-tax-details").hidden = !$("#toggle-corp-tax").checked;
    recalculate();
  });
  root.querySelectorAll("[data-tax]").forEach((btn) => {
    btn.addEventListener("click", () => {
      corpTaxRate = Number(btn.dataset.tax);
      root.querySelectorAll("[data-tax]").forEach((b) => {
        b.setAttribute("aria-selected", String(Number(b.dataset.tax) === corpTaxRate));
      });
      recalculate();
    });
  });

  const start = () => {
    if (started) {
      recalculate();
      return;
    }
    started = true;
    recalculate();
  };

  const destroy = () => {
    if (chart) chart.destroy();
  };

  return { start, refresh: recalculate, destroy };
}
