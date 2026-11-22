---
name: asc842
description: Technical rules for ASC 842 lessee accounting in Accounting Lab. Use when changing src/asc842.js, adding lease features (modifications, remeasurement, variable payments, short-term exemption, impairment), writing lease puzzle cases, or explaining a lease result.
---

# ASC 842 lessee rules for this project

## Already implemented (src/asc842.js)
- Classification: the five criteria in ASC 842-10-25-2, with 75%/90% thresholds as the reasonable approach from 842-10-55-2.
- Initial measurement: liability = PV of unpaid lease payments (842-20-30-1); ROU = liability + payments at/before commencement + initial direct costs − incentives received (842-20-30-5).
- Finance: effective interest on the liability; ROU amortized straight-line over the shorter of term and useful life, or useful life if ownership transfers or a purchase option is reasonably certain (842-20-35-8).
- Operating: single straight-line lease cost (842-20-25-6); liability accretes at the discount rate; ROU reduction is the plug (cost − accretion).

## Roadmap features and their rules
- **Short-term lease election** (term ≤ 12 months, no purchase option reasonably certain): no ROU or liability; expense straight-line (842-20-25-2).
- **Variable payments**: only those based on an index or rate are lease payments, measured at the commencement index; changes are expensed as incurred, not remeasured, unless the liability is remeasured for another reason (842-10-30-5, 842-10-35-5).
- **Residual value guarantees**: include amounts probable of being owed (842-10-30-5(f)).
- **Modifications not accounted for as a separate contract**: remeasure the liability at the modification date with an updated discount rate; adjust ROU by the same amount; a reduction in scope or term reduces ROU proportionately with gain or loss (842-10-25-8 through 25-18).
- **Impairment of an operating-lease ROU asset**: after impairment, amortize the remaining ROU straight-line; expense is no longer a single straight-line cost (842-20-35-9 through 35-10).
- **Lessor accounting** (sales-type, direct financing, operating) is a separate module.

## Testing rules
- Every new feature needs a hand-calculated case in tests with values to the cent.
- Keep the invariants passing: every entry balances, liability and ROU reach zero at the end, and total expense over the life equals total cost under both classifications (except impairment, which shifts timing but not total).

## Writing puzzle cases
- Invented companies and assets only.
- State every fact needed and nothing ambiguous: commencement date, payments and timing, rate (and whether it is the implicit rate or IBR), fair value, economic life, options and how likely they are.
- Each case targets one concept (e.g., purchase option changes the amortization period) and has a single correct answer computed with the engine.
