/** HK car TCO financial engine (買車 vs 搭車 / EV vs ICE). */

export function fmtHK(n) {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}HK$ ${Math.abs(v).toLocaleString("en-HK")}`;
}

export function fmtWan(n) {
  return `HK$ ${(Number(n) / 10000).toFixed(1)}萬`;
}

/** Flat-rate hire purchase: interest = P * r * years; equal monthly. */
export function calcFlatLoan(principal, flatRatePct, years) {
  const P = Math.max(0, principal);
  const n = Math.max(1, years);
  const r = Math.max(0, flatRatePct) / 100;
  const totalInterest = P * r * n;
  const months = n * 12;
  const monthly = months ? (P + totalInterest) / months : 0;
  const approxApr = n > 0 ? ((2 * n) / (n + 1)) * flatRatePct : 0;
  return { monthly, totalInterest, totalPay: P + totalInterest, months, approxApr };
}

/** Amortizing APR loan. */
export function calcAprLoan(principal, aprPct, years) {
  const P = Math.max(0, principal);
  const months = Math.max(1, years) * 12;
  const i = Math.max(0, aprPct) / 100 / 12;
  let monthly;
  if (i === 0) monthly = P / months;
  else monthly = (P * i * (1 + i) ** months) / ((1 + i) ** months - 1);
  const totalPay = monthly * months;
  const totalInterest = totalPay - P;
  return { monthly, totalInterest, totalPay, months, approxApr: aprPct };
}

export function calcLoan(principal, ratePct, years, rateType) {
  if (rateType === "APR") return calcAprLoan(principal, ratePct, years);
  return calcFlatLoan(principal, ratePct, years);
}

/** Resale after first-year 20% drop, then annual depRate thereafter. */
export function calcResale(price, horizonYears, annualDepPct, firstYearPct = 20) {
  let value = Math.max(0, price);
  const years = Math.max(1, horizonYears);
  value *= 1 - firstYearPct / 100;
  for (let y = 2; y <= years; y++) {
    value *= 1 - annualDepPct / 100;
  }
  return Math.max(0, value);
}

/**
 * HK profits-tax capital allowances for company cars.
 * EV: 100% first-year capital allowance (WDV → 0).
 * ICE: first-year IA 60% + AA 30% RB thereafter.
 * On sale in year N: Balancing Charge =
 *   min(totalAllowancesClaimed, max(0, residual - WDV)) * taxRate
 * (deducted from that year's tax benefit; no double-counted tax save).
 */
export function calcCorpTaxSavings({
  carPrice,
  horizonYears,
  resale,
  annualOpsDeductible,
  taxRatePct,
  enabled,
  powertrain = "ICE",
}) {
  if (!enabled) return { yearly: [], total: 0, wdv: carPrice, totalAllowances: 0 };
  const rate = taxRatePct / 100;
  const isEv = String(powertrain).toUpperCase() === "EV";
  let wdv = carPrice;
  let totalAllowances = 0;
  const yearly = [];
  let total = 0;

  for (let y = 1; y <= horizonYears; y++) {
    let allowance = 0;
    if (isEv) {
      if (y === 1) {
        allowance = carPrice;
        wdv = 0;
        totalAllowances += allowance;
      }
    } else if (y === 1) {
      const ia = carPrice * 0.6;
      wdv = carPrice - ia;
      const aa = wdv * 0.3;
      wdv -= aa;
      allowance = ia + aa;
      totalAllowances += allowance;
    } else {
      const aa = wdv * 0.3;
      wdv -= aa;
      allowance = aa;
      totalAllowances += allowance;
    }

    let taxSave = (allowance + annualOpsDeductible) * rate;
    if (y === horizonYears) {
      const residualGap = Math.max(0, resale - wdv);
      const balBase = Math.min(totalAllowances, residualGap);
      taxSave -= balBase * rate;
    }
    yearly.push(taxSave);
    total += taxSave;
  }
  return { yearly, total, wdv, totalAllowances };
}

/**
 * Mode A opportunity portfolio: invest (車價 − 首期), monthly cashflow.
 * Each month: balance += balance * (annualReturn/12), then subtract monthlyPayment
 * while the loan is outstanding. Do NOT multiply whole principal by (1+r)^N.
 */
export function simulateMonthlyLoanOpportunity({
  principal,
  monthlyPayment,
  loanMonths,
  horizonMonths,
  annualReturnPct,
}) {
  const r = Math.max(0, annualReturnPct) / 100 / 12;
  let balance = Math.max(0, principal);
  const yearEnds = [];
  const months = Math.max(1, horizonMonths);
  const payMonths = Math.max(0, loanMonths);

  for (let m = 1; m <= months; m++) {
    balance += balance * r;
    if (m <= payMonths) balance -= monthlyPayment;
    if (m % 12 === 0) yearEnds.push(balance);
  }
  // If horizon isn't a whole number of years, still expose final
  if (months % 12 !== 0) {
    // pad yearEnds only when needed by callers using full years
  }
  return { final: balance, yearEnds };
}

/**
 * Mode A: buy car vs transport + invest the difference.
 * Returns yearly rows + summary KPIs.
 */
export function simulateBuyVsTransport(input) {
  const {
    carPrice,
    downPct,
    loanRatePct,
    loanYears,
    loanRateType,
    horizon,
    depRatePct,
    monthlyParking,
    monthlyHourlyTunnel,
    monthlyKm,
    costPerKm,
    licenseFee,
    insuranceFee,
    maintFee,
    altTransportMonthly,
    invReturnPct,
    corpTaxEnabled,
    corpTaxRatePct,
    powertrain = "EV",
  } = input;

  const down = (carPrice * downPct) / 100;
  const principal = carPrice - down;
  const loan = calcLoan(principal, loanRatePct, loanYears, loanRateType);
  const resale = calcResale(carPrice, horizon, depRatePct);

  const annualEnergy = monthlyKm * costPerKm * 12;
  const annualParking = monthlyParking * 12;
  const annualTunnel = monthlyHourlyTunnel * 12;
  const annualOps =
    annualParking + annualTunnel + annualEnergy + licenseFee + insuranceFee + maintFee;

  const tax = calcCorpTaxSavings({
    carPrice,
    horizonYears: horizon,
    resale,
    annualOpsDeductible: annualOps,
    taxRatePct: corpTaxRatePct,
    enabled: corpTaxEnabled,
    powertrain,
  });

  // Opportunity cost: invest financed principal, pay loan from portfolio monthly
  const opp = simulateMonthlyLoanOpportunity({
    principal,
    monthlyPayment: loan.monthly,
    loanMonths: loan.months,
    horizonMonths: horizon * 12,
    annualReturnPct: invReturnPct,
  });

  const years = [];
  let cumBuyCash = down; // t0 downpayment
  let cumTransportCash = 0;

  for (let y = 1; y <= horizon; y++) {
    const loanPay = y <= loanYears ? loan.monthly * 12 : 0;
    const ops = annualOps;
    const taxSave = tax.yearly[y - 1] || 0;
    const buyOut = loanPay + ops - taxSave;
    const transportOut = altTransportMonthly * 12;

    cumBuyCash += buyOut;
    cumTransportCash += transportOut;

    years.push({
      year: y,
      loanPay,
      ops,
      taxSave,
      buyOut,
      transportOut,
      investBalance: opp.yearEnds[y - 1] ?? opp.final,
      resaleIfSold: calcResale(carPrice, y, depRatePct),
    });
  }

  const investFinal = opp.final;
  const buyNetTco = cumBuyCash - resale;
  const transportTotalSpend = cumTransportCash;
  // KPI wording: gap > 0 → 搭車+投資較着數
  // Relative advantage ≈ (transport path holds investFinal) vs buyNetTco after transport spend
  const gap = buyNetTco - transportTotalSpend + investFinal;

  const totalKm = monthlyKm * 12 * horizon;
  const monthlyAvg = buyNetTco / (horizon * 12);
  const perKm = totalKm > 0 ? buyNetTco / totalKm : 0;

  return {
    mode: "buyVsTransport",
    loan,
    down,
    principal,
    resale,
    buyNetTco,
    transportTotalSpend,
    investFinal,
    gap,
    monthlyAvg,
    perKm,
    corpTaxTotal: tax.total,
    years,
    annualOps,
  };
}

/** Mode B: EV (primary inputs) vs ICE (comparison inputs). Same loan/dep/parking structure. */
export function simulateEvVsIce(input) {
  const base = { ...input, powertrain: "EV" };
  const ev = simulateBuyOnly(base);
  const iceInput = {
    ...base,
    powertrain: "ICE",
    carPrice: input.iceCompPrice,
    costPerKm: input.iceCompFuel,
    licenseFee: input.iceCompLicense,
    // split maint+insurance roughly: iceCompMaint is combined yearly
    insuranceFee: 0,
    maintFee: input.iceCompMaint,
  };
  const ice = simulateBuyOnly(iceInput);
  const gap = ice.buyNetTco - ev.buyNetTco; // >0 → EV cheaper
  return {
    mode: "evVsIce",
    ev,
    ice,
    gap,
    loan: ev.loan,
    down: ev.down,
    principal: ev.principal,
    resale: ev.resale,
    buyNetTco: ev.buyNetTco,
    monthlyAvg: ev.monthlyAvg,
    perKm: ev.perKm,
    corpTaxTotal: ev.corpTaxTotal,
    years: ev.years.map((y, i) => ({
      ...y,
      iceOut: ice.years[i]?.buyOut ?? 0,
      iceCum: ice.years.slice(0, i + 1).reduce((s, r) => s + r.buyOut, ice.down) - (i === ev.years.length - 1 ? ice.resale : 0),
    })),
    iceBuyNetTco: ice.buyNetTco,
    iceResale: ice.resale,
    annualOps: ev.annualOps,
  };
}

function simulateBuyOnly(input) {
  const {
    carPrice,
    downPct,
    loanRatePct,
    loanYears,
    loanRateType,
    horizon,
    depRatePct,
    monthlyParking,
    monthlyHourlyTunnel,
    monthlyKm,
    costPerKm,
    licenseFee,
    insuranceFee,
    maintFee,
    corpTaxEnabled,
    corpTaxRatePct,
    powertrain = "EV",
  } = input;

  const down = (carPrice * downPct) / 100;
  const principal = carPrice - down;
  const loan = calcLoan(principal, loanRatePct, loanYears, loanRateType);
  const resale = calcResale(carPrice, horizon, depRatePct);
  const annualOps =
    monthlyParking * 12 +
    monthlyHourlyTunnel * 12 +
    monthlyKm * costPerKm * 12 +
    licenseFee +
    insuranceFee +
    maintFee;

  const tax = calcCorpTaxSavings({
    carPrice,
    horizonYears: horizon,
    resale,
    annualOpsDeductible: annualOps,
    taxRatePct: corpTaxRatePct,
    enabled: corpTaxEnabled,
    powertrain,
  });

  const years = [];
  let cum = down;
  for (let y = 1; y <= horizon; y++) {
    const loanPay = y <= loanYears ? loan.monthly * 12 : 0;
    const taxSave = tax.yearly[y - 1] || 0;
    const buyOut = loanPay + annualOps - taxSave;
    cum += buyOut;
    years.push({
      year: y,
      loanPay,
      ops: annualOps,
      taxSave,
      buyOut,
      cumNet: cum - (y === horizon ? resale : 0),
      resaleIfSold: calcResale(carPrice, y, depRatePct),
    });
  }
  const buyNetTco = cum - resale;
  const totalKm = monthlyKm * 12 * horizon;
  return {
    loan,
    down,
    principal,
    resale,
    buyNetTco,
    monthlyAvg: buyNetTco / (horizon * 12),
    perKm: totalKm > 0 ? buyNetTco / totalKm : 0,
    corpTaxTotal: tax.total,
    years,
    annualOps,
  };
}

export const PRESETS = {
  evFamily: {
    label: "家用電動車",
    powertrain: "EV",
    carPrice: 280000,
    downPct: 20,
    loanRatePct: 2.5,
    loanYears: 5,
    loanRateType: "FLAT",
    depRatePct: 15,
    monthlyParking: 3600,
    monthlyHourlyTunnel: 1800,
    monthlyKm: 1200,
    costPerKm: 0.4,
    licenseFee: 1500,
    insuranceFee: 6500,
    maintFee: 6000,
    altTransportMonthly: 3200,
    invReturnPct: 6,
    iceCompPrice: 260000,
    iceCompFuel: 1.75,
    iceCompLicense: 5074,
    iceCompMaint: 14500,
  },
  iceJapan: {
    label: "日系家庭油車",
    powertrain: "ICE",
    carPrice: 260000,
    downPct: 30,
    loanRatePct: 2.8,
    loanYears: 5,
    loanRateType: "FLAT",
    depRatePct: 14,
    monthlyParking: 3400,
    monthlyHourlyTunnel: 1600,
    monthlyKm: 1100,
    costPerKm: 1.7,
    licenseFee: 5074,
    insuranceFee: 7000,
    maintFee: 8000,
    altTransportMonthly: 3000,
    invReturnPct: 6,
    iceCompPrice: 260000,
    iceCompFuel: 1.7,
    iceCompLicense: 5074,
    iceCompMaint: 15000,
  },
  luxuryMpv: {
    label: "豪華歐洲/七人車",
    powertrain: "ICE",
    carPrice: 550000,
    downPct: 40,
    loanRatePct: 2.8,
    loanYears: 5,
    loanRateType: "FLAT",
    depRatePct: 18,
    monthlyParking: 4500,
    monthlyHourlyTunnel: 2200,
    monthlyKm: 1300,
    costPerKm: 2.2,
    licenseFee: 7599,
    insuranceFee: 12000,
    maintFee: 16000,
    altTransportMonthly: 4500,
    invReturnPct: 6,
    iceCompPrice: 550000,
    iceCompFuel: 2.2,
    iceCompLicense: 7599,
    iceCompMaint: 28000,
  },
  highMileage: {
    label: "高里數跨區通勤族",
    powertrain: "EV",
    carPrice: 300000,
    downPct: 20,
    loanRatePct: 2.5,
    loanYears: 5,
    loanRateType: "FLAT",
    depRatePct: 15,
    monthlyParking: 3200,
    monthlyHourlyTunnel: 2500,
    monthlyKm: 2500,
    costPerKm: 0.45,
    licenseFee: 1500,
    insuranceFee: 7000,
    maintFee: 6500,
    altTransportMonthly: 5000,
    invReturnPct: 6,
    iceCompPrice: 280000,
    iceCompFuel: 1.9,
    iceCompLicense: 5074,
    iceCompMaint: 16000,
  },
};
