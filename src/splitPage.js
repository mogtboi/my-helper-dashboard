import {
  DEFAULT_FX_RATES,
  allocateRounded,
  ceilShares,
  dineMultiplier,
  dineShares,
  fxAfterForeign,
  fxQuote,
  keetaTotal,
  parseAmount,
  splitCouponFee,
  splitEvenGap,
  splitProportional,
  sumAmounts,
} from "./splitMath.js";

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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function money(n, places) {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(places)}`;
}

function term(n) {
  if (!Number.isFinite(n)) return "?";
  const s = n.toFixed(4).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

function signed(n) {
  if (!Number.isFinite(n)) return "?";
  return n < 0 ? `−${term(Math.abs(n))}` : term(n);
}

function personLabel(name, index) {
  const t = String(name ?? "").trim();
  return t || `第${index + 1}位`;
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

function copyPlain(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text)
    );
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function blankPeople() {
  return [
    { name: "", amountRaw: "" },
    { name: "", amountRaw: "" },
    { name: "", amountRaw: "" },
  ];
}

export function createSplitPage(root, { mode = "bill" } = {}) {
  const state = {
    sub: "keeta",
    people: blankPeople(),
    couponRaw: "",
    extraRaw: "",
    extraPercent: false,
    feeRaw: "",
    totalRaw: "",
    totalManual: false,
    keetaMode: "even",
    round: "tenth",
    discountRaw: "",
    serviceOrder: "after",
    depositRaw: "",
    dineSplit: "even",
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
  if (mode === "fx") paintFx(page);
  else paintBill(page);

  function paintBill(host) {
    host.replaceChildren();
    const segment = el("div", "split-segment");
    const keetaBtn = el("button", "split-segment-btn", "🛵 Keeta / 外賣夾單");
    const dineBtn = el("button", "split-segment-btn", "🍽️ 堂食加一 / 折頭");
    keetaBtn.type = "button";
    dineBtn.type = "button";
    const markSegment = () => {
      keetaBtn.setAttribute("aria-pressed", state.sub === "keeta" ? "true" : "false");
      dineBtn.setAttribute("aria-pressed", state.sub === "dine" ? "true" : "false");
    };
    keetaBtn.addEventListener("click", () => {
      state.sub = "keeta";
      paintBill(host);
    });
    dineBtn.addEventListener("click", () => {
      state.sub = "dine";
      paintBill(host);
    });
    markSegment();
    segment.append(keetaBtn, dineBtn);
    host.append(segment);

    const rowsCard = el("section", "split-card");
    rowsCard.append(el("h3", "split-card-title", "1. 每人餐點"));
    const rows = el("div", "split-rows");
    const subtotal = el("p", "split-subtotal");
    const addBtn = el("button", "split-add", "＋ 加人");
    addBtn.type = "button";
    rowsCard.append(rows, addBtn, subtotal);
    host.append(rowsCard);

    const payCard = el("section", "split-card");
    const results = el("div", "split-results");
    const copyBtn = el("button", "split-copy", "📋 一鍵複製收錢明細");
    copyBtn.type = "button";
    const copyNote = el("p", "split-note");

    if (state.sub === "keeta") paintKeetaPay(payCard);
    else paintDinePay(payCard);
    host.append(payCard);

    const modeCard = el("section", "split-card");
    modeCard.append(el("h3", "split-card-title", state.sub === "keeta" ? "3. 點樣分" : "2. 點樣分"));
    if (state.sub === "keeta") {
      modeCard.append(modeRow(
        [
          ["even", "人頭平分差額"],
          ["ratio", "全單按比例折算"],
          ["fee", "運費平分＋優惠按比例"],
        ],
        () => state.keetaMode,
        (id) => {
          state.keetaMode = id;
        }
      ));
    } else {
      modeCard.append(modeRow(
        [
          ["even", "全單平分"],
          ["each", "各自計餐點價"],
        ],
        () => state.dineSplit,
        (id) => {
          state.dineSplit = id;
        }
      ));
    }
    modeCard.append(modeRow(
      [
        ["tenth", "小數 1 位"],
        ["cent", "小數 2 位（PayMe／FPS）"],
        ["ceil", "齊頭向上"],
      ],
      () => state.round,
      (id) => {
        state.round = id;
      }
    ));
    modeCard.append(results, copyBtn, copyNote);
    host.append(modeCard);

    addBtn.addEventListener("click", () => {
      state.people.push({ name: "", amountRaw: "" });
      paintPeople();
      paintResults();
    });
    copyBtn.addEventListener("click", () => {
      const text = results.dataset.copy || "";
      if (!text) {
        copyNote.textContent = "未有明細可複製";
        return;
      }
      copyPlain(text).then((ok) => {
        copyNote.textContent = ok ? "已複製，可貼去 WhatsApp／PayMe" : "呢部機未允許剪貼簿";
      });
    });

    function modeRow(options, get, set) {
      const row = el("div", "split-tabs");
      const buttons = options.map(([id, label]) => {
        const btn = el("button", "split-pill", label);
        btn.type = "button";
        btn.addEventListener("click", () => {
          set(id);
          buttons.forEach((item, index) => {
            item.setAttribute("aria-pressed", options[index][0] === id ? "true" : "false");
          });
          paintResults();
        });
        btn.setAttribute("aria-pressed", get() === id ? "true" : "false");
        return btn;
      });
      row.append(...buttons);
      return row;
    }

    function paintPeople() {
      rows.replaceChildren();
      state.people.forEach((person, index) => {
        const row = el("div", "split-row");
        const name = document.createElement("input");
        name.className = "split-input";
        name.type = "text";
        name.maxLength = 40;
        name.placeholder = "名稱／備註";
        name.autocomplete = "off";
        name.value = person.name;
        name.addEventListener("input", () => {
          person.name = name.value;
          paintResults();
        });
        const amount = document.createElement("input");
        amount.className = "split-input";
        amount.type = "text";
        amount.placeholder = "例如 109.5 或 85+15";
        amount.autocomplete = "off";
        amount.value = person.amountRaw;
        amount.setAttribute("aria-label", "金額");
        amount.addEventListener("input", () => {
          person.amountRaw = amount.value;
          paintResults();
        });
        const remove = el("button", "split-remove", "移除");
        remove.type = "button";
        remove.addEventListener("click", () => {
          if (state.people.length <= 1) state.people[0] = { name: "", amountRaw: "" };
          else state.people.splice(index, 1);
          paintPeople();
          paintResults();
        });
        row.append(name, amount, remove);
        rows.append(row);
      });
    }

    function readPeople() {
      let invalid = false;
      const amounts = [];
      const shown = [];
      for (const person of state.people) {
        const amount = parseAmount(person.amountRaw);
        if (amount == null) invalid = true;
        else {
          amounts.push(amount);
          if (String(person.amountRaw).trim() !== "") shown.push(term(amount));
        }
      }
      return { invalid, amounts: invalid ? [] : amounts, shown };
    }

    function field(label, value, placeholder, onInput) {
      const wrap = el("label", "split-field");
      wrap.append(el("span", "split-label", label));
      const input = document.createElement("input");
      input.className = "split-input";
      input.type = "text";
      input.inputMode = "decimal";
      input.placeholder = placeholder;
      input.autocomplete = "off";
      input.value = value;
      input.addEventListener("input", () => onInput(input.value, input));
      wrap.append(input);
      return { wrap, input };
    }

    function paintKeetaPay(card) {
      card.append(el("h3", "split-card-title", "2. 優惠同實付"));
      card.append(field("優惠券 / Koupon (-$)", state.couponRaw, "例如 30 或 30+15", (value) => {
        state.couponRaw = value;
        state.totalManual = false;
        paintResults();
      }).wrap);
      const extra = field(
        state.extraPercent ? "支付優惠 / 額外 Discount (%)" : "支付優惠 / 額外 Discount (-$)",
        state.extraRaw,
        "例如 10",
        (value) => {
          state.extraRaw = value;
          state.totalManual = false;
          paintResults();
        }
      );
      const percentBtn = el("button", "split-pill", state.extraPercent ? "百分比" : "金額");
      percentBtn.type = "button";
      percentBtn.setAttribute("aria-pressed", state.extraPercent ? "true" : "false");
      percentBtn.addEventListener("click", () => {
        state.extraPercent = !state.extraPercent;
        state.totalManual = false;
        paintBill(host);
      });
      extra.wrap.append(percentBtn);
      card.append(extra.wrap);
      card.append(field("運費 + 平台費 (+$)", state.feeRaw, "例如 5+13", (value) => {
        state.feeRaw = value;
        state.totalManual = false;
        paintResults();
      }).wrap);
      const total = field("總計實付", state.totalRaw, "例如 297.50", (value) => {
        state.totalRaw = value;
        state.totalManual = true;
        paintResults();
      });
      total.input.dataset.role = "total";
      card.append(total.wrap);
      card.append(el("p", "split-note", "有填優惠或運費時，總計會自動計。你仍然可以自己改總計。只填小計同總計，就用兩者嘅差額。"));
    }

    function paintDinePay(card) {
      card.append(el("h3", "split-card-title", "堂食加一"));
      card.append(field("全單幾折（85 = 85折，100 或留空 = 無折）", state.discountRaw, "例如 85", (value) => {
        state.discountRaw = value;
        paintResults();
      }).wrap);
      card.append(modeRow(
        [
          ["after", "折後加一"],
          ["before", "折前原價加一"],
        ],
        () => state.serviceOrder,
        (id) => {
          state.serviceOrder = id;
        }
      ));
      card.append(el("p", "split-note", "服務費固定加一（+10%）。折後加一先折再加一；折前原價加一係正價加一，折扣唔計落服務費。"));
      card.append(field("已付訂金", state.depositRaw, "例如 200，留空當 0", (value) => {
        state.depositRaw = value;
        paintResults();
      }).wrap);
    }

    function componentValue(raw) {
      if (String(raw).trim() === "") return 0;
      return parseAmount(raw);
    }

    function paintResults() {
      const people = readPeople();
      const known = people.invalid ? [] : people.amounts;
      subtotal.textContent = people.invalid
        ? "有金額未能計（只接受數字或 85+15 呢種加法）"
        : `${people.shown.join(" + ") || "0"} = $${sumAmounts(known).toFixed(2)}`;
      results.replaceChildren();
      delete results.dataset.copy;
      if (people.invalid) {
        results.append(el("p", "split-line", "改啱金額先至計到每人應付。"));
        return;
      }
      if (state.sub === "dine") {
        paintDineResults(known);
        return;
      }
      paintKeetaResults(known);
    }

    function paintKeetaResults(amounts) {
      const sub = sumAmounts(amounts);
      const coupon = componentValue(state.couponRaw);
      const fee = componentValue(state.feeRaw);
      const extraRaw = componentValue(state.extraRaw);
      if (coupon == null || fee == null || extraRaw == null) {
        results.append(el("p", "split-line", "優惠或運費只接受數字，或者 30+15 呢種加法。"));
        return;
      }
      const extra = state.extraPercent ? (sub * extraRaw) / 100 : extraRaw;
      const filled = [state.couponRaw, state.extraRaw, state.feeRaw].some((value) => String(value).trim() !== "");
      let total = null;
      if (state.totalManual && String(state.totalRaw).trim() !== "") {
        total = parseAmount(state.totalRaw);
        if (total == null) {
          results.append(el("p", "split-line", "總計實付只接受數字。"));
          return;
        }
      } else if (filled) {
        total = keetaTotal(sub, coupon, extra, fee);
        const input = host.querySelector("[data-role='total']");
        if (input && document.activeElement !== input) {
          state.totalRaw = total.toFixed(2);
          input.value = state.totalRaw;
        }
      } else if (String(state.totalRaw).trim() !== "") {
        total = parseAmount(state.totalRaw);
        if (total == null) {
          results.append(el("p", "split-line", "總計實付只接受數字。"));
          return;
        }
      }
      if (total == null) {
        results.append(el("p", "split-line", "請輸入總計實付，或者填優惠／運費。"));
        return;
      }
      const gap = total - sub;
      let exact = null;
      if (state.keetaMode === "even") exact = splitEvenGap(amounts, total);
      else if (state.keetaMode === "ratio") exact = splitProportional(amounts, total);
      else exact = splitCouponFee(amounts, total, { coupon, extra, fee });
      if (!exact || exact.some((value) => value == null)) {
        results.append(el("p", "split-line", "小計係 0，未能按比例折算。"));
        return;
      }
      const places = state.round === "cent" ? 2 : 1;
      const rounded = state.round === "ceil" ? ceilShares(exact) : allocateRounded(exact, places);
      const displayPlaces = state.round === "ceil" ? 0 : places;
      results.append(el("p", "split-line", `差額（總計 − 小計）${signed(gap)}`));
      if (state.round === "ceil") {
        results.append(el("p", "split-line", `齊頭向上合計 ${money(rounded.total, 0)}`));
      } else {
        results.append(el("p", "split-line", `應付合計 ${money(rounded.total, displayPlaces)}`));
      }
      const lines = amounts.map((amount, index) => {
        const pay = rounded.shares[index];
        const mark = state.round === "tenth" && rounded.adjusted?.[index] ? "（已補尾數）" : "";
        return {
          label: personLabel(state.people[index]?.name, index),
          dish: amount,
          pay,
          mark,
          formula: keetaFormula(amount, sub, total, coupon, extra, fee, amounts.length),
        };
      });
      for (const line of lines) {
        const row = el("p", "split-line");
        row.textContent = `${line.label}　餐點 ${term(line.dish)}　應付 ${money(line.pay, displayPlaces)}${line.mark}`;
        const formula = el("span", "split-formula");
        formula.textContent = line.formula;
        row.append(formula);
        results.append(row);
      }
      results.dataset.copy = [
        "夾錢明細",
        "Keeta／外賣夾單",
        `總計實付 ${money(total, 2)}`,
        state.round === "ceil" ? `齊頭向上合計 ${money(rounded.total, 0)}` : `應付合計 ${money(rounded.total, displayPlaces)}`,
        ...lines.map((line) => `${line.label}｜${term(line.dish)}｜應付 ${money(line.pay, displayPlaces)}`),
      ].join("\n");
    }

    function keetaFormula(amount, sub, total, coupon, extra, fee, n) {
      if (state.keetaMode === "even") return `${term(amount)} + (${signed(total - sub)} ÷ ${n})`;
      if (state.keetaMode === "ratio") return `${term(amount)} × (${term(total)} / ${term(sub)})`;
      const discount = coupon + extra;
      return `${term(amount)} + (${term(fee)} ÷ ${n}) − (${term(discount)} × ${term(amount)}/${term(sub)})`;
    }

    function paintDineResults(amounts) {
      const discount = String(state.discountRaw).trim() === "" ? 100 : parseAmount(state.discountRaw);
      const deposit = String(state.depositRaw).trim() === "" ? 0 : parseAmount(state.depositRaw);
      if (discount == null || discount < 0 || discount > 100) {
        results.append(el("p", "split-line", "折扣請填 0 至 100（85 即 85折）。"));
        return;
      }
      if (deposit == null) {
        results.append(el("p", "split-line", "訂金只接受數字。"));
        return;
      }
      const cooked = dineShares(amounts, {
        discountZhe: discount,
        order: state.serviceOrder,
        deposit,
        split: state.dineSplit,
      });
      const places = state.round === "cent" ? 2 : 1;
      const rounded = state.round === "ceil" ? ceilShares(cooked.shares) : allocateRounded(cooked.shares, places);
      const displayPlaces = state.round === "ceil" ? 0 : places;
      const orderLabel = state.serviceOrder === "before" ? "折前原價加一" : "折後加一";
      results.append(el(
        "p",
        "split-line",
        `正價 $${cooked.sub.toFixed(2)} · ${orderLabel} × ${term(dineMultiplier(discount, state.serviceOrder))} − 訂金 ${money(deposit, 2)}`
      ));
      results.append(el("p", "split-line", state.round === "ceil"
        ? `齊頭向上合計 ${money(rounded.total, 0)}`
        : `應付合計 ${money(rounded.total, displayPlaces)}`));
      const header = `正價 $${cooked.sub.toFixed(2)} · ${orderLabel} × ${term(dineMultiplier(discount, state.serviceOrder))} − 訂金 ${money(deposit, 2)}`;
      const totalLine = state.round === "ceil"
        ? `齊頭向上合計 ${money(rounded.total, 0)}`
        : `應付合計 ${money(rounded.total, displayPlaces)}`;
      const personLines = amounts.map((amount, index) => {
        const pay = rounded.shares[index];
        const mark = state.round === "tenth" && rounded.adjusted?.[index] ? "（已補尾數）" : "";
        const text = `${personLabel(state.people[index]?.name, index)}　餐點 ${term(amount)}　應付 ${money(pay, displayPlaces)}${mark}`;
        const row = el("p", "split-line");
        row.textContent = text;
        results.append(row);
        return text;
      });
      results.dataset.copy = ["夾錢明細", "堂食加一", header, totalLine, ...personLines].join("\n");
    }

    paintPeople();
    paintResults();
  }

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
