# Accounting Lab

Interactive technical accounting modules for learning and checking hard standards. The owner is a CPA candidate and Big 4 audit associate who built this for his own practice; every module must be technically right before it is pretty.

## Rules that never bend
1. **The engine is the source of truth.** All accounting math lives in pure functions under `src/` (no DOM). The page only displays engine output. Never compute accounting in the UI.
2. **Test against known answers.** Every engine change needs tests in `tests/` with hand-calculated or textbook values, plus invariants: entries balance, balances run to zero, totals agree across methods. Run `npm test` before committing.
3. **Cite the codification.** When the UI states a rule, cite the ASC paragraph (e.g., ASC 842-10-25-2). If a choice is a practical convention rather than the standard (75%/90% thresholds, nominal periodic rate), say so on screen.
4. **Show the work.** Each module follows the workpaper order: identify or classify → measure → record entries → schedule → presentation. Every number on screen should be traceable to an input or a formula shown nearby.
5. **No real client data.** Presets and puzzle cases use invented companies. Never use real company facts tied to the owner's firm's audit clients.

## Layout
- `src/<topic>.js` — engine per standard (`asc842.js` = leases, lessee)
- `tests/<topic>.test.js` — node assert tests, run with `npm test`
- `index.html` — the Lease Lab interface (loads `src/asc842.js`)
- `.claude/skills/` — technical rules Claude follows when extending a module
- `.claude/commands/` — `/puzzle`, `/new-module`

## Conventions in the lease engine
- Periodic rate = annual rate ÷ payments per year.
- Escalations compound every 12 months.
- Advance: first payment at commencement; liability excludes it, ROU includes it.
- Year ends are anniversaries of commencement.
