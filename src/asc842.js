/*
 * ASC 842 lessee engine.
 * Pure functions, no DOM. Works in the browser (window.ASC842) and in Node (require).
 *
 * Conventions (shown to the user in the app):
 * - Periodic rate = annual rate / payments per year (nominal convention).
 * - Escalations apply once every 12 months, compounding.
 * - "Advance" means each payment is made on the first day of its period; the first one is paid at commencement.
 * - Initial direct costs and prepaid rent are paid at or before commencement; incentives are received at commencement.
 * - Classification uses the common 75% (economic life) and 90% (fair value) thresholds as the
 *   reasonable approach described in ASC 842-10-55-2. They are not bright lines in the standard.
 */
(function (root) {
  "use strict";

  const PER_YEAR = { monthly: 12, quarterly: 4, annual: 1 };

  function normalize(input) {
    const ppy = PER_YEAR[input.frequency];
    if (!ppy) throw new Error("frequency must be monthly, quarterly, or annual");
    const n = Math.round(input.termYears * ppy);
    if (!(n >= 1)) throw new Error("Lease term must be at least one payment period");
    return {
      ...input,
      ppy,
      n,
      r: (input.annualRate || 0) / 100 / ppy,
      esc: (input.escalationPct || 0) / 100,
      idc: input.idc || 0,
      incentives: input.incentives || 0,
      prepaid: input.prepaid || 0
    };
  }

  /** Payment for period k (1-based), with annual escalation. */
  function paymentFor(c, k) {
    return c.payment * Math.pow(1 + c.esc, Math.floor((k - 1) / c.ppy));
  }

  /** Discount factor time (in periods) for payment k. */
  function timeFor(c, k) {
    return c.timing === "advance" ? k - 1 : k;
  }

  function pv(c, includeCommencementPayment) {
    let total = 0;
    for (let k = 1; k <= c.n; k++) {
      const t = timeFor(c, k);
      if (t === 0 && !includeCommencementPayment) continue;
      total += paymentFor(c, k) / Math.pow(1 + c.r, t);
    }
    return total;
  }

  /** The five ASC 842-10-25-2 classification criteria. */
  function classify(input) {
    const c = normalize(input);
    const pvAll = pv(c, true);
    const lifeShare = c.economicLifeYears > 0 ? c.termYears / c.economicLifeYears : 0;
    const fvShare = c.fairValue > 0 ? pvAll / c.fairValue : 0;
    const tests = [
      { id: "a", name: "Ownership transfers to the lessee by the end of the lease term", met: !!c.transferOwnership, detail: c.transferOwnership ? "Yes" : "No" },
      { id: "b", name: "Lessee is reasonably certain to exercise a purchase option", met: !!c.purchaseOption, detail: c.purchaseOption ? "Yes" : "No" },
      { id: "c", name: "Lease term is a major part of the asset's remaining economic life", met: lifeShare >= 0.75, detail: `${(lifeShare * 100).toFixed(1)}% of ${c.economicLifeYears || 0} years (threshold 75%)` },
      { id: "d", name: "Present value of payments is substantially all of the asset's fair value", met: fvShare >= 0.9, detail: `${(fvShare * 100).toFixed(1)}% of fair value (threshold 90%)` },
      { id: "e", name: "Asset is so specialized it has no alternative use to the lessor", met: !!c.specialized, detail: c.specialized ? "Yes" : "No" }
    ];
    const finance = tests.some(t => t.met);
    return { classification: finance ? "finance" : "operating", tests, pvAll, lifeShare, fvShare };
  }

  /** Initial measurement at commencement. */
  function initial(input) {
    const c = normalize(input);
    const liability = pv(c, false);
    const commencementPayment = c.timing === "advance" ? paymentFor(c, 1) : 0;
    const rou = liability + commencementPayment + c.idc + c.prepaid - c.incentives;
    const lines = [
      { account: "Right-of-use asset", dr: rou, cr: 0 },
      { account: "Lease liability", dr: 0, cr: liability }
    ];
    if (commencementPayment) lines.push({ account: "Cash (first payment)", dr: 0, cr: commencementPayment });
    if (c.idc) lines.push({ account: "Cash (initial direct costs)", dr: 0, cr: c.idc });
    if (c.prepaid) lines.push({ account: "Prepaid rent", dr: 0, cr: c.prepaid });
    if (c.incentives) lines.push({ account: "Cash (incentive received)", dr: c.incentives, cr: 0 });
    return { liability, rou, commencementPayment, entry: lines };
  }

  /** Signed entry line helper: positive = debit, negative = credit. */
  function line(account, signed) {
    return signed >= 0 ? { account, dr: signed, cr: 0 } : { account, dr: 0, cr: -signed };
  }

  /**
   * Full schedule under one classification.
   * Rows run over the lease term; for a finance lease amortized over economic life
   * (ownership transfer or purchase option), extra rows continue the ROU amortization.
   */
  function schedule(input, classification) {
    const c = normalize(input);
    const init = initial(input);
    const totalPayments = Array.from({ length: c.n }, (_, i) => paymentFor(c, i + 1)).reduce((a, b) => a + b, 0);
    const longLife = classification === "finance" && (c.transferOwnership || c.purchaseOption);
    const amortPeriods = longLife ? Math.max(c.n, Math.round(c.economicLifeYears * c.ppy)) : c.n;
    const amort = init.rou / amortPeriods;
    const straightLine = (totalPayments + c.idc + c.prepaid - c.incentives) / c.n;

    let L = init.liability, R = init.rou;
    const rows = [];
    const periods = classification === "finance" ? amortPeriods : c.n;
    for (let t = 1; t <= periods; t++) {
      const inTerm = t <= c.n;
      let pay = 0;
      if (inTerm) {
        if (c.timing === "arrears") pay = paymentFor(c, t);
        else if (t >= 2) pay = paymentFor(c, t);
      }
      // Advance payments for period t+1 are not here: each advance payment is made at the start of its own period.
      const Lb = L, Rb = R;
      const base = c.timing === "advance" ? Lb - pay : Lb;
      const interest = inTerm ? base * c.r : 0;
      L = c.timing === "advance" ? base + interest : Lb + interest - pay;
      if (t === c.n || !inTerm) { if (Math.abs(L) < 0.005) L = 0; }

      let rouReduction, expense, entry;
      if (classification === "finance") {
        rouReduction = Math.min(amort, R);
        expense = { interest, amortization: rouReduction, total: interest + rouReduction };
        entry = [
          line("Interest expense", interest),
          line("Lease liability", pay - interest),
          line("Cash", -pay),
          line("Amortization expense", rouReduction),
          line("Right-of-use asset (accumulated amortization)", -rouReduction)
        ].filter(l => Math.abs(l.dr - l.cr) > 0.004);
      } else {
        rouReduction = straightLine - interest;
        expense = { leaseCost: straightLine, total: straightLine };
        entry = [
          line("Lease cost (straight-line)", straightLine),
          line("Lease liability", pay - interest),
          line("Right-of-use asset", -rouReduction),
          line("Cash", -pay)
        ].filter(l => Math.abs(l.dr - l.cr) > 0.004);
      }
      R = Rb - rouReduction;
      if (Math.abs(R) < 0.005) R = 0;
      rows.push({
        period: t,
        year: Math.floor((t - 1) / c.ppy) + 1,
        payment: pay,
        liabilityBegin: Lb, interest, liabilityEnd: L,
        rouBegin: Rb, rouReduction, rouEnd: R,
        expense, entry
      });
    }

    // Annual rollup and current/noncurrent split at each year end
    const years = [];
    const yearCount = Math.ceil(periods / c.ppy);
    for (let y = 1; y <= yearCount; y++) {
      const rs = rows.filter(r => r.year === y);
      const last = rs[rs.length - 1];
      const next = rows.filter(r => r.year === y + 1);
      const principalNext = next.reduce((s, r) => s + (r.payment - r.interest), 0);
      years.push({
        year: y,
        payments: rs.reduce((s, r) => s + r.payment, 0) + (y === 1 ? init.commencementPayment : 0),
        interest: rs.reduce((s, r) => s + r.interest, 0),
        amortization: classification === "finance" ? rs.reduce((s, r) => s + r.rouReduction, 0) : null,
        totalExpense: rs.reduce((s, r) => s + r.expense.total, 0),
        liabilityEnd: last.liabilityEnd,
        currentLiability: Math.max(0, Math.min(last.liabilityEnd, principalNext)),
        rouEnd: last.rouEnd
      });
    }
    const commencementPrincipal = rows.filter(r => r.year === 1).reduce((s, r) => s + (r.payment - r.interest), 0);
    return {
      classification, n: c.n, ppy: c.ppy, periodicRate: c.r,
      initial: init, straightLine, amortPerPeriod: amort, amortPeriods,
      totalPayments: totalPayments, totalCost: totalPayments + c.idc + c.prepaid - c.incentives,
      currentAtCommencement: Math.max(0, Math.min(init.liability, commencementPrincipal)),
      rows, years
    };
  }

  function analyze(input) {
    const cls = classify(input);
    const chosen = input.override === "finance" || input.override === "operating" ? input.override : cls.classification;
    return {
      classification: cls,
      chosen,
      finance: schedule(input, "finance"),
      operating: schedule(input, "operating")
    };
  }

  const api = { PER_YEAR, normalize, paymentFor, pv, classify, initial, schedule, analyze };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ASC842 = api;
})(typeof window !== "undefined" ? window : globalThis);
