# Accounting Lab

Interactive technical accounting, one hard standard at a time. Change the facts and watch the classification, measurement, entries, schedule, and statement effects update.

**Module 1: Lease Lab (ASC 842, lessee).** Open `index.html` in a browser.

## Develop
```bash
npm test          # engine tests against textbook values and invariants
```
No build step. The engine (`src/asc842.js`) is plain JavaScript that runs in the browser and in Node.

## Using Claude Code here
- `/puzzle [concept]` gives you a lease case, computes the answer with the engine, and grades your entries.
- `/new-module ASC 606 revenue` plans the next module and writes its skill file before any code.
- The `asc842` skill holds the technical rules and paragraph citations, so Claude extends the engine the same way every time.

## Roadmap
1. **Lease Lab v1 (done):** classification, initial measurement, finance and operating schedules, entries by period, year-end balances with current portion, finance vs operating comparison.
2. **Lease Lab v2:** short-term election, index-based variable payments, residual value guarantees, modifications and remeasurement, operating ROU impairment.
3. **Puzzle mode in the app:** generated cases, enter your entries, instant grading.
4. **Next modules:** ASC 606 revenue (allocation, variable consideration), ASC 740 deferred taxes, ASC 805/810 consolidations, ASC 718 stock compensation.
