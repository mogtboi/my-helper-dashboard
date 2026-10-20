/**
 * Local bill-split and cash-rate math. No network, no eval.
 * Cash rates are HKD per 1 unit of foreign currency.
 */

export const DEFAULT_FX_RATES = Object.freeze({
  JPY: 0.052,
  TWD: 0.24,
  USD: 7.8,
  GBP: 10.2,
  EUR: 8.5,
  KRW: 0.0056,
  CNY: 1.08,
});

/** Empty is 0. A number or a plus-sum such as 85+15. Anything else is null. */
export function parseAmount(raw) {
  const s = String(raw ?? "").replace(/\s+/g, "");
  if (s === "") return 0;
  if (!/^(?:\d+(?:\.\d+)?)(?:\+(?:\d+(?:\.\d+)?))*$/.test(s)) return null;
  let sum = 0;
  for (const part of s.split("+")) sum += Number(part);
  return Number.isFinite(sum) ? sum : null;
}

export function sumAmounts(amounts) {
  return amounts.reduce((a, b) => a + b, 0);
}

/** Mode 1: each dish plus an even share of (總計 − 小計). */
export function splitEvenGap(amounts, totalPaid) {
  const n = amounts.length;
  const gap = totalPaid - sumAmounts(amounts);
  const each = n ? gap / n : 0;
  return amounts.map((amount) => amount + each);
}

/** Mode 2: each dish × (總計 / 小計). Null shares when 小計 is 0. */
export function splitProportional(amounts, totalPaid) {
  const sub = sumAmounts(amounts);
  if (!sub) return amounts.map(() => null);
  const ratio = totalPaid / sub;
  return amounts.map((amount) => amount * ratio);
}

/**
 * Mode 3: split 運費+平台費 evenly.
 * The leftover gap (總計 − 小計 − 運費平台費) follows each dish's share of 小計.
 */
export function splitFeeThenProportional(amounts, totalPaid, fee) {
  const n = amounts.length;
  const sub = sumAmounts(amounts);
  const feeEach = n ? fee / n : 0;
  const rest = totalPaid - sub - fee;
  if (!sub) return amounts.map(() => null);
  return amounts.map((amount) => amount + feeEach + rest * (amount / sub));
}

/**
 * Largest remainder so the displayed shares sum to the rounded total.
 * places 0 = integer 齊頭, 1 = one decimal, 2 = cents (pre-toggle check).
 */
export function allocateRounded(exact, places) {
  const factor = 10 ** places;
  const usable = exact.map((v) => (Number.isFinite(v) ? v : 0));
  const sum = sumAmounts(usable);
  const targetUnits = Math.round(sum * factor + (sum >= 0 ? 1e-8 : -1e-8));
  const floors = usable.map((v) => Math.floor(v * factor + 1e-8));
  let extra = targetUnits - floors.reduce((a, b) => a + b, 0);
  const order = usable
    .map((v, i) => ({ i, rem: v * factor - Math.floor(v * factor + 1e-8) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  const units = floors.slice();
  if (extra > 0 && order.length) {
    for (let k = 0; k < extra; k += 1) units[order[k % order.length].i] += 1;
  } else if (extra < 0 && order.length) {
    const asc = [...order].reverse();
    for (let k = 0; k < -extra; k += 1) units[asc[k % asc.length].i] -= 1;
  }
  return {
    shares: units.map((u) => u / factor),
    total: targetUnits / factor,
  };
}

/** Independent rounding, before remainder allocation. */
export function naiveRound(exact, places) {
  const factor = 10 ** places;
  return exact.map((v) => Math.round(v * factor) / factor);
}

/**
 * discountZhe 85 means 85折.
 * "after" 折後加一 = 折扣 × 1.10
 * "before" 折前原價加一 = 折扣 + 10% of the original (service is not discounted)
 */
export function dineMultiplier(discountZhe, order) {
  const zhe = discountZhe / 100;
  if (order === "before") return zhe + 0.1;
  return zhe * 1.1;
}

/** 全單平分 splits the net. 各自計餐點價 runs each dish through the same factor, deposit even. */
export function dineShares(amounts, { discountZhe, order, deposit, split }) {
  const factor = dineMultiplier(discountZhe, order);
  const sub = sumAmounts(amounts);
  const net = sub * factor - deposit;
  const n = amounts.length;
  if (split === "even") {
    const each = n ? net / n : 0;
    return { factor, sub, net, shares: amounts.map(() => each) };
  }
  const depEach = n ? deposit / n : 0;
  return {
    factor,
    sub,
    net,
    shares: amounts.map((amount) => amount * factor - depEach),
  };
}

/** Card vs cash on the same after-refund foreign amount. rate is HKD per 1 foreign unit. */
export function fxQuote({ sticker, refundPct, rate, cashbackPct, fccPct = 1.95 }) {
  const afterForeign = sticker * (1 - refundPct / 100);
  const cashHkd = afterForeign * rate;
  const cardBefore = afterForeign * rate * (1 + fccPct / 100);
  const rebateHkd = cardBefore * (cashbackPct / 100);
  const cardNetHkd = cardBefore * (1 - cashbackPct / 100);
  return { afterForeign, cashHkd, cardBefore, rebateHkd, cardNetHkd };
}
