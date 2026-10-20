import {
  DEFAULT_FX_RATES,
  allocateRounded,
  dineMultiplier,
  dineShares,
  fxQuote,
  parseAmount,
  splitEvenGap,
  splitFeeThenProportional,
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
  const body = term(Math.abs(n));
  return n < 0 ? `−${body}` : body;
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

export function createSplitPage(root) {
  const state = {
    tab: "bill",
    sub: "keeta",
    people: [
      { name: "", amountRaw: "" },
      { name: "", amountRaw: "" },
      { name: "", amountRaw: "" },
    ],
    totalRaw: "",
    keetaMode: "even",
    feeRaw: "",
    places: 1,
    discountRaw: "",
    serviceOrder: "after",
    depositRaw: "",
    dineSplit: "even",
    fxCode: "JPY",
    stickerRaw: "",
    taxMode: "none",
    taxCustom: "",
    cashback: "4",
    cashbackCustom: "",
    rates: loadRates(),
  };

  root.replaceChildren();
  const page = el("div", "split-page");
  const tabs = el("div", "split-tabs");
  const billTab = pillButton("🛵 外賣 / 堂食夾錢", () => {
    state.tab = "bill";
    paintShell();
  });
  const fxTab = pillButton("💴 外幣 / 免稅回贈", () => {
    state.tab = "fx";
    paintShell();
  });
  tabs.append(billTab, fxTab);

  const body = el("div", "split-body");
  page.append(tabs, body);
  root.append(page);

  function pillButton(label, onClick) {
    const btn = el("button", "split-pill", label);
    btn.type = "button";
    btn.addEventListener("click", onClick);
    return btn;
  }

  function markPressed(buttons, index) {
    buttons.forEach((btn, i) => btn.setAttribute("aria-pressed", i === index ? "true" : "false"));
  }

  function paintShell() {
    billTab.setAttribute("aria-pressed", state.tab === "bill" ? "true" : "false");
    fxTab.setAttribute("aria-pressed", state.tab === "fx" ? "true" : "false");
    body.replaceChildren();
    if (state.tab === "fx") paintFx();
    else paintBill();
  }

  function paintBill() {
    const subRow = el("div", "split-tabs");
    const keetaBtn = pillButton("🛵 Keeta / 外賣夾單", () => {
      state.sub = "keeta";
      paintShell();
    });
    const dineBtn = pillButton("🍽️ 堂食加一 / 折頭", () => {
      state.sub = "dine";
      paintShell();
    });
    keetaBtn.setAttribute("aria-pressed", state.sub === "keeta" ? "true" : "false");
    dineBtn.setAttribute("aria-pressed", state.sub === "dine" ? "true" : "false");
    subRow.append(keetaBtn, dineBtn);
    body.append(subRow);

    const rows = el("div", "split-rows");
    body.append(rows);
    const addBtn = el("button", "split-add", "＋ 加人");
    addBtn.type = "button";
    addBtn.addEventListener("click", () => {
      state.people.push({ name: "", amountRaw: "" });
      paintPeople(rows);
      paintResults();
      const last = rows.querySelector(".split-row:last-child input");
      last?.focus();
    });
    body.append(addBtn);

    const subtotal = el("p", "split-subtotal");
    body.append(subtotal);

    if (state.sub === "keeta") paintKeetaControls();
    else paintDineControls();

    const roundRow = el("div", "split-tabs");
    const oneDp = pillButton("小數 1 位", () => {
      state.places = 1;
      markPressed([oneDp, integer], 0);
      paintResults();
    });
    const integer = pillButton("齊頭整數", () => {
      state.places = 0;
      markPressed([oneDp, integer], 1);
      paintResults();
    });
    markPressed([oneDp, integer], state.places === 1 ? 0 : 1);
    roundRow.append(oneDp, integer);
    body.append(roundRow);

    const results = el("div", "split-results");
    const copyBtn = el("button", "split-copy", "📋 一鍵複製收錢明細");
    copyBtn.type = "button";
    const copyNote = el("p", "split-note");
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
    body.append(results, copyBtn, copyNote);

    function paintPeople(host) {
      host.replaceChildren();
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
        amount.inputMode = "text";
        amount.placeholder = "109.5 或 85+15";
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
          if (state.people.length <= 1) {
            state.people[0] = { name: "", amountRaw: "" };
          } else {
            state.people.splice(index, 1);
          }
          paintPeople(host);
          paintResults();
        });
        row.append(name, amount, remove);
        host.append(row);
      });
    }

    function readPeople() {
      const rowsOut = [];
      let invalid = false;
      for (const person of state.people) {
        const amount = parseAmount(person.amountRaw);
        if (amount == null) invalid = true;
        rowsOut.push({ name: person.name, amount });
      }
      return { rows: rowsOut, invalid };
    }

    function paintKeetaControls() {
      const totalField = field("總計實付", state.totalRaw, "297.50", (value) => {
        state.totalRaw = value;
        paintResults();
      });
      body.append(totalField);
      const gap = el("p", "split-gap");
      gap.dataset.role = "gap";
      body.append(gap);
      const modes = el("div", "split-tabs");
      const labels = [
        ["even", "人頭平分差額（推薦）"],
        ["ratio", "全單按比例折算"],
        ["fee", "拆細：運費平分＋優惠按比例"],
      ];
      const buttons = labels.map(([id, label]) => {
        const btn = pillButton(label, () => {
          state.keetaMode = id;
          buttons.forEach((b, i) => b.setAttribute("aria-pressed", labels[i][0] === id ? "true" : "false"));
          feeWrap.hidden = id !== "fee";
          paintResults();
        });
        btn.setAttribute("aria-pressed", state.keetaMode === id ? "true" : "false");
        return btn;
      });
      modes.append(...buttons);
      body.append(modes);
      const feeWrap = field("運費+平台費總額", state.feeRaw, "18", (value) => {
        state.feeRaw = value;
        paintResults();
      });
      feeWrap.hidden = state.keetaMode !== "fee";
      body.append(feeWrap);
    }

    function paintDineControls() {
      body.append(
        field("全單幾折（85 = 85折，100 或留空 = 無折）", state.discountRaw, "85", (value) => {
          state.discountRaw = value;
          paintResults();
        })
      );
      const orderRow = el("div", "split-tabs");
      const after = pillButton("折後加一", () => {
        state.serviceOrder = "after";
        markPressed([after, before], 0);
        paintResults();
      });
      const before = pillButton("折前原價加一", () => {
        state.serviceOrder = "before";
        markPressed([after, before], 1);
        paintResults();
      });
      markPressed([after, before], state.serviceOrder === "after" ? 0 : 1);
      orderRow.append(after, before);
      body.append(orderRow);
      body.append(
        el("p", "split-note", "服務費固定加一（+10%）。折後加一先折再加一；折前原價加一係正價加一，折扣唔計落服務費。")
      );
      body.append(
        field("已付訂金", state.depositRaw, "0", (value) => {
          state.depositRaw = value;
          paintResults();
        })
      );
      const splitRow = el("div", "split-tabs");
      const even = pillButton("全單平分", () => {
        state.dineSplit = "even";
        markPressed([even, each], 0);
        paintResults();
      });
      const each = pillButton("各自計餐點價", () => {
        state.dineSplit = "each";
        markPressed([even, each], 1);
        paintResults();
      });
      markPressed([even, each], state.dineSplit === "even" ? 0 : 1);
      splitRow.append(even, each);
      body.append(splitRow);
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
      input.addEventListener("input", () => onInput(input.value));
      wrap.append(input);
      return wrap;
    }

    function paintResults() {
      const { rows: people, invalid } = readPeople();
      const amountsKnown = people.map((p) => (p.amount == null ? 0 : p.amount));
      const shownTerms = [];
      state.people.forEach((person) => {
        const amount = parseAmount(person.amountRaw);
        if (amount == null || String(person.amountRaw).trim() === "") return;
        shownTerms.push(term(amount));
      });
      const known = people.filter((p) => p.amount != null).map((p) => p.amount);
      subtotal.textContent = invalid
        ? "有金額未能計（只接受數字或 85+15 呢種加法）"
        : `${shownTerms.join(" + ") || "0"} = $${sumAmounts(known).toFixed(2)}`;

      results.replaceChildren();
      delete results.dataset.copy;
      const places = state.places === 0 ? 0 : 1;

      if (invalid) {
        results.append(el("p", "split-line", "改啱金額先至計到每人應付。"));
        return;
      }

      if (state.sub === "keeta") paintKeetaResults(people, amountsKnown, places);
      else paintDineResults(people, amountsKnown, places);
    }

    function paintKeetaResults(people, amounts, places) {
      const total = parseAmount(state.totalRaw);
      const gapEl = body.querySelector("[data-role='gap']");
      if (total == null) {
        if (gapEl) gapEl.textContent = "總計實付格式不正確";
        results.append(el("p", "split-line", "總計實付只接受數字。"));
        return;
      }
      if (String(state.totalRaw).trim() === "") {
        if (gapEl) gapEl.textContent = "差額會係 總計 − 小計";
        results.append(el("p", "split-line", "請輸入總計實付。"));
        return;
      }
      const sub = sumAmounts(amounts);
      const gap = total - sub;
      if (gapEl) gapEl.textContent = `差額（總計 − 小計）${signed(gap)}`;

      let exact = null;
      if (state.keetaMode === "even") exact = splitEvenGap(amounts, total);
      else if (state.keetaMode === "ratio") exact = splitProportional(amounts, total);
      else {
        const fee = parseAmount(state.feeRaw);
        if (String(state.feeRaw).trim() === "" || fee == null) {
          results.append(el("p", "split-line", "請輸入運費+平台費總額。"));
          return;
        }
        exact = splitFeeThenProportional(amounts, total, fee);
      }
      if (!exact || exact.some((v) => v == null)) {
        results.append(el("p", "split-line", "小計係 0，未能按比例折算。"));
        return;
      }
      const allocated = allocateRounded(exact, places);
      const lines = people.map((person, i) => {
        const label = personLabel(person.name, i);
        const formula = keetaFormula(state.keetaMode, amounts[i], sub, total, amounts.length);
        return { label, dish: amounts[i], pay: allocated.shares[i], formula };
      });
      renderShareLines(lines, allocated.total, places);
      const modeName =
        state.keetaMode === "even"
          ? "人頭平分差額"
          : state.keetaMode === "ratio"
            ? "全單按比例折算"
            : "運費平分＋優惠按比例";
      results.dataset.copy = copyBlock(`Keeta／外賣夾單 · ${modeName}`, total, lines, places, allocated.total);
    }

    function keetaFormula(mode, amount, sub, total, n) {
      const gap = total - sub;
      if (mode === "even") return `${term(amount)} + (${signed(gap)} ÷ ${n})`;
      if (mode === "ratio") return `${term(amount)} × (${term(total)} / ${term(sub)})`;
      const fee = parseAmount(state.feeRaw) || 0;
      const rest = total - sub - fee;
      return `${term(amount)} + (${term(fee)} ÷ ${n}) + (${signed(rest)} × ${term(amount)}/${term(sub)})`;
    }

    function paintDineResults(people, amounts, places) {
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
      const allocated = allocateRounded(cooked.shares, places);
      const orderLabel = state.serviceOrder === "before" ? "折前原價加一" : "折後加一";
      const factor = dineMultiplier(discount, state.serviceOrder);
      results.append(
        el(
          "p",
          "split-line",
          `正價 $${cooked.sub.toFixed(2)} · ${orderLabel} × ${term(factor)} − 訂金 ${money(deposit, 2)} → 實付 ${money(cooked.net, 2)}`
        )
      );
      const lines = people.map((person, i) => {
        const formula =
          state.dineSplit === "even"
            ? `實付 ${term(cooked.net)} ÷ ${amounts.length}`
            : state.serviceOrder === "before"
              ? `${term(amounts[i])} × ${term(discount)}% + ${term(amounts[i])} × 10% − 訂金 ÷ ${amounts.length}`
              : `${term(amounts[i])} × ${term(discount)}% × 1.10 − 訂金 ÷ ${amounts.length}`;
        return {
          label: personLabel(person.name, i),
          dish: amounts[i],
          pay: allocated.shares[i],
          formula,
        };
      });
      renderShareLines(lines, allocated.total, places);
      results.dataset.copy = copyBlock(`堂食 · ${orderLabel}`, cooked.net, lines, places, allocated.total);
    }

    function renderShareLines(lines, total, places) {
      results.append(el("p", "split-line", `應付合計 ${money(total, places)}`));
      for (const line of lines) {
        const row = el("p", "split-line");
        row.textContent = `${line.label}　餐點 ${term(line.dish)}　應付 ${money(line.pay, places)}`;
        const formula = el("span", "split-formula");
        formula.textContent = line.formula;
        row.append(formula);
        results.append(row);
      }
    }

    function copyBlock(title, receiptTotal, lines, places, shownTotal) {
      const rows = lines.map(
        (line) => `${line.label}｜${term(line.dish)}｜應付 ${money(line.pay, places)}`
      );
      const head = [`夾錢明細`, title, `總計實付 ${money(receiptTotal, 2)}`];
      if (Math.abs(receiptTotal - shownTotal) > 0.001) {
        head.push(`齊頭後合計 ${money(shownTotal, places)}`);
      }
      return [...head, ...rows].join("\n");
    }

    paintPeople(rows);
    paintResults();
  }

  function paintFx() {
    const note = el(
      "p",
      "split-note",
      "現金匯率係預設參考值，可改做找換店價。只會把匯率表存在呢部機，唔會上傳。"
    );
    const chips = el("div", "split-tabs");
    const rateField = fieldInput("現金匯率（1 外幣 = 幾多港幣）", String(state.rates[state.fxCode]));
    const chipButtons = FX_CODES.map((code) => {
      const btn = pillButton(`${code} ${FX_LABELS[code]}`, () => {
        state.fxCode = code;
        chipButtons.forEach((b, i) => b.setAttribute("aria-pressed", FX_CODES[i] === code ? "true" : "false"));
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

    const sticker = fieldInput("外幣標價", state.stickerRaw, "15800");
    sticker.input.addEventListener("input", () => {
      state.stickerRaw = sticker.input.value;
      paintFxResults();
    });

    const taxRow = el("div", "split-tabs");
    const taxModes = [
      ["none", "未退稅原價"],
      ["jp", "日本退稅 −10%"],
      ["custom", "自訂退稅"],
    ];
    const taxCustom = fieldInput("自訂退稅 %", state.taxCustom, "8");
    const taxButtons = taxModes.map(([id, label]) => {
      const btn = pillButton(label, () => {
        state.taxMode = id;
        taxButtons.forEach((b, i) => b.setAttribute("aria-pressed", taxModes[i][0] === id ? "true" : "false"));
        taxCustom.wrap.hidden = id !== "custom";
        paintFxResults();
      });
      btn.setAttribute("aria-pressed", state.taxMode === id ? "true" : "false");
      return btn;
    });
    taxRow.append(...taxButtons);
    taxCustom.wrap.hidden = state.taxMode !== "custom";
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
    const cbCustom = fieldInput("自訂回贈 %", state.cashbackCustom, "3");
    const cbButtons = cbModes.map(([id, label]) => {
      const btn = pillButton(label, () => {
        state.cashback = id;
        cbButtons.forEach((b, i) => b.setAttribute("aria-pressed", cbModes[i][0] === id ? "true" : "false"));
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
    body.append(note, chips, rateField.wrap, sticker.wrap, taxRow, taxCustom.wrap, cbRow, cbCustom.wrap, results);

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
      let refund = 0;
      if (state.taxMode === "jp") refund = 10;
      if (state.taxMode === "custom") {
        const custom = parseAmount(state.taxCustom);
        if (custom == null || custom < 0 || custom > 100) {
          results.append(el("p", "split-line", "退稅百分比請填 0 至 100。"));
          return;
        }
        refund = custom;
      }
      let cashback = Number(state.cashback);
      if (state.cashback === "custom") {
        const custom = parseAmount(state.cashbackCustom);
        if (custom == null || custom < 0 || custom > 100) {
          results.append(el("p", "split-line", "回贈百分比請填 0 至 100。"));
          return;
        }
        cashback = custom;
      }
      const quote = fxQuote({
        sticker: stickerN,
        refundPct: refund,
        rate,
        cashbackPct: cashback,
      });
      const cardShown = quote.cardNetHkd.toFixed(2);
      const cashShown = quote.cashHkd.toFixed(2);
      const diff = Number(cashShown) - Number(cardShown);
      results.append(el("p", "split-line", `退稅後外幣 ${term(quote.afterForeign)} ${state.fxCode}`));
      results.append(
        el(
          "p",
          "split-line",
          `簽卡淨額 $${cardShown}（外幣 × 匯率 × 1.0195 FCC × ${term(1 - cashback / 100)}）`
        )
      );
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

  paintShell();
  return { start() {} };
}
