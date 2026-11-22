// Run: node tests/asc842.test.js
const assert = require("assert");
const L = require("../src/asc842.js");
const near = (a, b, tol = 0.01, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg}: expected ${b.toFixed(2)}, got ${a.toFixed(2)}`);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

const base = { termYears: 5, frequency: "annual", payment: 10000, timing: "arrears", annualRate: 5,
  fairValue: 60000, economicLifeYears: 10 };

test("PV of ordinary annuity: 5 x $10,000 at 5% = $43,294.77", () => {
  near(L.initial(base).liability, 43294.77, 0.01, "liability");
  near(L.initial(base).rou, 43294.77, 0.01, "ROU");
});

test("PV of annuity due: liability excludes the day-one payment, ROU includes it", () => {
  const i = L.initial({ ...base, timing: "advance" });
  near(i.liability, 35459.51, 0.01, "liability");
  near(i.rou, 45459.51, 0.01, "ROU");
});

test("Finance lease year 1: interest $2,164.74 and amortization $8,658.95", () => {
  const s = L.schedule(base, "finance");
  near(s.years[0].interest, 2164.74, 0.01, "interest");
  near(s.years[0].amortization, 8658.95, 0.01, "amortization");
});

test("Operating lease: single straight-line cost of $10,000 a year; ROU plug = cost minus accretion", () => {
  const s = L.schedule(base, "operating");
  s.years.forEach(y => near(y.totalExpense, 10000, 0.01, `year ${y.year} cost`));
  near(s.rows[0].rouReduction, 10000 - 2164.74, 0.01, "ROU reduction");
});

test("Total expense over the term is identical under both classifications", () => {
  for (const timing of ["arrears", "advance"]) {
    const inp = { ...base, timing, idc: 1200, incentives: 500, prepaid: 300, escalationPct: 3 };
    const f = L.schedule(inp, "finance"), o = L.schedule(inp, "operating");
    const tf = f.rows.reduce((a, r) => a + r.expense.total, 0), to = o.rows.reduce((a, r) => a + r.expense.total, 0);
    near(tf, to, 0.01, timing);
    near(to, o.totalCost, 0.01, "operating total = payments + IDC + prepaid - incentives");
  }
});

const cases = [];
for (const frequency of ["monthly", "quarterly", "annual"])
  for (const timing of ["arrears", "advance"])
    for (const escalationPct of [0, 2.5])
      cases.push({ ...base, frequency, timing, escalationPct, termYears: 4, annualRate: 6.25, idc: 800, incentives: 1500, prepaid: 0, payment: frequency === "monthly" ? 2000 : frequency === "quarterly" ? 6000 : 24000 });

test(`Liability and ROU both end at zero (${cases.length} scenarios x 2 classifications)`, () => {
  for (const inp of cases) for (const k of ["finance", "operating"]) {
    const s = L.schedule(inp, k), last = s.rows[s.rows.length - 1];
    near(last.liabilityEnd, 0, 0.01, `${k} ${inp.frequency} ${inp.timing} liability`);
    near(last.rouEnd, 0, 0.01, `${k} ${inp.frequency} ${inp.timing} ROU`);
  }
});

test("Every journal entry balances (debits = credits)", () => {
  for (const inp of cases) for (const k of ["finance", "operating"]) {
    const s = L.schedule(inp, k);
    const all = [s.initial.entry, ...s.rows.map(r => r.entry)];
    all.forEach((e, i) => near(e.reduce((a, l) => a + l.dr, 0), e.reduce((a, l) => a + l.cr, 0), 0.001, `${k} entry ${i}`));
  }
});

test("Escalation: monthly payment steps up once every 12 months", () => {
  const c = L.normalize({ ...base, frequency: "monthly", payment: 1000, escalationPct: 3 });
  near(L.paymentFor(c, 12), 1000, 1e-9, "month 12");
  near(L.paymentFor(c, 13), 1030, 1e-9, "month 13");
  near(L.paymentFor(c, 25), 1060.9, 1e-9, "month 25");
});

test("Classification: 5-year term on 6-year life is finance (83% >= 75%)", () => {
  const r = L.classify({ ...base, economicLifeYears: 6 });
  assert.strictEqual(r.classification, "finance");
  assert.ok(r.tests.find(t => t.id === "c").met);
});

test("Classification: 5 of 10 years and 72% of fair value is operating", () => {
  const r = L.classify(base);
  assert.strictEqual(r.classification, "operating");
  near(r.fvShare, 43294.77 / 60000, 1e-6, "fair value share");
});

test("Classification: purchase option reasonably certain forces finance and amortization over economic life", () => {
  const inp = { ...base, purchaseOption: true };
  assert.strictEqual(L.classify(inp).classification, "finance");
  const s = L.schedule(inp, "finance");
  assert.strictEqual(s.amortPeriods, 10);
  near(s.years[0].amortization, 43294.77 / 10, 0.01, "amortization over 10 years");
});

test("Current portion at commencement = principal paid down in the next 12 months", () => {
  const s = L.schedule(base, "finance");
  near(s.currentAtCommencement, 10000 - 2164.74, 0.01, "current portion");
});

console.log(`\n${passed} tests passed`);
