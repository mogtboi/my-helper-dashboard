/**
 * Local cash-rate calculator. No network.
 * Cash rates are HKD per 1 unit of foreign currency.
 */

const FX_KEY = "my-helper.fx-rates.v1";
const FX_CODES = ["JPY", "TWD", "USD", "GBP", "EUR", "KRW", "CNY"];
const FX_LABELS = {
  JPY: "日圓",
  TWD: "新台幣",
  USD: "美元",
  GBP: "英鎊",
  EUR: "歐元",
  KRW: "韓圓",
  CNY: "人民幣",
};

const DEFAULT_FX_RATES = Object.freeze({
  JPY: 0.052,
  TWD: 0.24,
  USD: 7.8,
  GBP: 10.2,
  EUR: 8.5,
  KRW: 0.0056,
  CNY: 1.08,
});

/** Empty is 0. A number or a plus-sum such as 85+15. Anything else is null. */
function parseAmount(raw) {
  const s = String(raw ?? "").replace(/\s+/g, "");
  if (s === "") return 0;
  if (!/^(?:\d+(?:\.\d+)?)(?:\+(?:\d+(?:\.\d+)?))*$/.test(s)) return null;
  let sum = 0;
  for (const part of s.split("+")) sum += Number(part);
  return Number.isFinite(sum) ? sum : null;
}

/**
 * Foreign amount after the chosen tax mode.
 * jp: 税込 ÷ 1.1, nearest whole unit.
 * dept: that figure, then minus 1.55%, nearest whole unit.
 * off: straight percent off the sticker. none: sticker unchanged.
 */
function fxAfterForeign(sticker, mode, customPct = 0) {
  const price = Number(sticker);
  if (!Number.isFinite(price)) return null;
  if (mode === "jp") return Math.round(price / 1.1);
  if (mode === "dept") return Math.round(Math.round(price / 1.1) * (1 - 0.0155));
  if (mode === "off") return price * (1 - Number(customPct) / 100);
  return price;
}

/** Card vs cash on the same after-refund foreign amount. rate is HKD per 1 foreign unit. */
function fxQuote({ sticker, refundPct, rate, cashbackPct, fccPct = 1.95 }) {
  const afterForeign = sticker * (1 - refundPct / 100);
  const cashHkd = afterForeign * rate;
  const cardBefore = afterForeign * rate * (1 + fccPct / 100);
  const rebateHkd = cardBefore * (cashbackPct / 100);
  const cardNetHkd = cardBefore * (1 - cashbackPct / 100);
  return { afterForeign, cashHkd, cardBefore, rebateHkd, cardNetHkd };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function term(n) {
  if (!Number.isFinite(n)) return "?";
  const s = n.toFixed(4).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

function loadRates() {
  const rates = { ...DEFAULT_FX_RATES };
  try {
    const raw = localStorage.getItem(FX_KEY);
    if (!raw) return rates;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return rates;
    for (const code of FX_CODES) {
      const n = Number(parsed[code]);
      if (Number.isFinite(n) && n > 0 && n < 100000) rates[code] = n;
    }
  } catch {
    /* keep defaults */
  }
  return rates;
}

function saveRates(rates) {
  const slim = {};
  for (const code of FX_CODES) slim[code] = rates[code];
  try {
    localStorage.setItem(FX_KEY, JSON.stringify(slim));
  } catch {
    /* private mode */
  }
}

export function createFxPage(root) {
  const state = {
    fxCode: "JPY",
    stickerRaw: "",
    taxMode: "none",
    taxCustom: "10",
    cashback: "4",
    cashbackCustom: "",
    rates: loadRates(),
  };

  root.replaceChildren();
  const page = el("div", "split-page");
  root.append(page);
  paintFx(page);

  function paintFx(host) {
    host.replaceChildren();
    host.append(el("p", "split-note", "現金匯率係預設參考值，可改做找換店價。只會把匯率表存在呢部機，唔會上傳。"));
    const chips = el("div", "split-tabs");
    const rateField = fieldInput("現金匯率（1 外幣 = 幾多港幣）", String(state.rates[state.fxCode]));
    const chipButtons = FX_CODES.map((code) => {
      const btn = el("button", "split-pill", `${code} ${FX_LABELS[code]}`);
      btn.type = "button";
      btn.addEventListener("click", () => {
        state.fxCode = code;
        chipButtons.forEach((item, index) => item.setAttribute("aria-pressed", FX_CODES[index] === code ? "true" : "false"));
        rateField.input.value = String(state.rates[code]);
        paintFxResults();
      });
      btn.setAttribute("aria-pressed", state.fxCode === code ? "true" : "false");
      return btn;
    });
    chips.append(...chipButtons);
    rateField.input.addEventListener("input", () => {
      const n = Number(String(rateField.input.value).trim());
      if (Number.isFinite(n) && n > 0 && n < 100000) {
        state.rates[state.fxCode] = n;
        saveRates(state.rates);
      }
      paintFxResults();
    });
    const sticker = fieldInput("外幣標價", state.stickerRaw, "例如 15800");
    sticker.input.addEventListener("input", () => {
      state.stickerRaw = sticker.input.value;
      paintFxResults();
    });
    const taxRow = el("div", "split-tabs");
    const taxModes = [
      ["none", "不退稅"],
      ["jp", "日本退稅 税込÷1.1"],
      ["dept", "日本百貨 ÷1.1 再減 1.55%"],
      ["off", "直接折扣"],
    ];
    const taxCustom = fieldInput("直接折扣 %", state.taxCustom, "10");
    const taxButtons = taxModes.map(([id, label]) => {
      const btn = el("button", "split-pill", label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        state.taxMode = id;
        if (id === "off" && String(state.taxCustom).trim() === "") state.taxCustom = "10";
        taxButtons.forEach((item, index) => item.setAttribute("aria-pressed", taxModes[index][0] === id ? "true" : "false"));
        taxCustom.wrap.hidden = id !== "off";
        paintFxResults();
      });
      btn.setAttribute("aria-pressed", state.taxMode === id ? "true" : "false");
      return btn;
    });
    taxRow.append(...taxButtons);
    taxCustom.wrap.hidden = state.taxMode !== "off";
    taxCustom.input.addEventListener("input", () => {
      state.taxCustom = taxCustom.input.value;
      paintFxResults();
    });
    const cbRow = el("div", "split-tabs");
    const cbModes = [
      ["4", "4%"],
      ["5", "5%"],
      ["6", "6%"],
      ["custom", "自訂回贈"],
    ];
    const cbCustom = fieldInput("自訂回贈 %", state.cashbackCustom, "例如 3");
    const cbButtons = cbModes.map(([id, label]) => {
      const btn = el("button", "split-pill", label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        state.cashback = id;
        cbButtons.forEach((item, index) => item.setAttribute("aria-pressed", cbModes[index][0] === id ? "true" : "false"));
        cbCustom.wrap.hidden = id !== "custom";
        paintFxResults();
      });
      btn.setAttribute("aria-pressed", state.cashback === id ? "true" : "false");
      return btn;
    });
    cbRow.append(...cbButtons);
    cbCustom.wrap.hidden = state.cashback !== "custom";
    cbCustom.input.addEventListener("input", () => {
      state.cashbackCustom = cbCustom.input.value;
      paintFxResults();
    });
    const results = el("div", "split-results");
    host.append(chips, rateField.wrap, sticker.wrap, taxRow, taxCustom.wrap, el("p", "split-note", "簽卡再加 1.95% FCC，然後減回贈。"), cbRow, cbCustom.wrap, results);

    function paintFxResults() {
      results.replaceChildren();
      const stickerN = parseAmount(state.stickerRaw);
      if (String(state.stickerRaw).trim() === "") {
        results.append(el("p", "split-line", "請輸入外幣標價。"));
        return;
      }
      if (stickerN == null) {
        results.append(el("p", "split-line", "標價只接受數字。"));
        return;
      }
      const rate = Number(String(rateField.input.value).trim());
      if (!Number.isFinite(rate) || rate <= 0) {
        results.append(el("p", "split-line", "請輸入正數現金匯率。"));
        return;
      }
      let custom = 10;
      if (state.taxMode === "off") {
        const parsed = parseAmount(state.taxCustom);
        if (parsed == null || parsed < 0 || parsed > 100) {
          results.append(el("p", "split-line", "折扣百分比請填 0 至 100。"));
          return;
        }
        custom = parsed;
      }
      let cashback = Number(state.cashback);
      if (state.cashback === "custom") {
        const parsed = parseAmount(state.cashbackCustom);
        if (parsed == null || parsed < 0 || parsed > 100) {
          results.append(el("p", "split-line", "回贈百分比請填 0 至 100。"));
          return;
        }
        cashback = parsed;
      }
      const after = fxAfterForeign(stickerN, state.taxMode, custom);
      const quote = fxQuote({ sticker: after, refundPct: 0, rate, cashbackPct: cashback });
      const cardShown = quote.cardNetHkd.toFixed(2);
      const cashShown = quote.cashHkd.toFixed(2);
      const diff = Number(cashShown) - Number(cardShown);
      results.append(el("p", "split-line", `退稅後外幣 ${term(after)} ${state.fxCode}`));
      results.append(el("p", "split-line", `簽卡淨額 $${cardShown}（外幣 × 匯率 × 1.0195 FCC × ${term(1 - cashback / 100)}）`));
      results.append(el("p", "split-line", `回贈 $${quote.rebateHkd.toFixed(2)}`));
      results.append(el("p", "split-line", `現金 $${cashShown}`));
      const cmp = el("p", "split-line");
      if (diff > 0) cmp.textContent = `簽卡抵啲（平 $${diff.toFixed(2)}）`;
      else if (diff < 0) cmp.textContent = "用現金抵啲";
      else cmp.textContent = "簽卡同現金一樣";
      results.append(cmp);
    }

    function fieldInput(label, value, placeholder = "") {
      const wrap = el("label", "split-field");
      wrap.append(el("span", "split-label", label));
      const input = document.createElement("input");
      input.className = "split-input";
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
      input.placeholder = placeholder;
      input.value = value;
      wrap.append(input);
      return { wrap, input };
    }

    paintFxResults();
  }

  return { start() {} };
}
