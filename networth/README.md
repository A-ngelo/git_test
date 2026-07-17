# The Ledger — a paper-and-ink net worth tracker

A sleek, dependency-free replacement for the *Assets & Debts* spreadsheet,
styled like an e-reader page: paper background, serif type, hairline rules,
ink-only charts, and a night mode. Open `index.html` in any browser — no
build step, no server, no account.

All data is stored privately in the browser's `localStorage` and comes
pre-seeded with the spreadsheet's entries and assumptions.

## Chapters

| Chapter | What it does |
| --- | --- |
| **Ledger** | Every asset and debt, shelved by category with dotted-leader rows like a table of contents. Tap any row to edit its name, value, category, owner, liquidity, or special role; add or strike entries freely. |
| **Insights** | The derived numbers the spreadsheet used to compute: net worth, home equity, available liquidity, months of runway (with and without a full HELOC draw), DeFi loan health (LTV, interest cost, stables-vs-debt buffer), per-owner totals, and a category breakdown (solid ink = assets, hatched = debts). |
| **History** | Record a snapshot whenever you update your numbers; a crosshair-hover ink line traces net worth over time, with a full table underneath. One snapshot per date — re-recording a date updates it. |
| **Settings** | The assumptions behind Insights (monthly expenses, HELOC limit, retirement haircut %, DeFi APR, stables balance), plus category/owner management, JSON export/import, and a reset back to the original spreadsheet data. |

## How Insights are computed

Entries carry two small flags that drive everything:

- **Liquidity** — `liquid` (counted in full), `retirement` (counted at the
  haircut % from Settings), or `illiquid` (not counted).
- **Special role** — `property` / `property-loan` / `heloc` feed home equity
  and HELOC headroom; `defi-vault` / `defi-loan` feed the DeFi health panel.

Available liquidity = liquid entries + (DeFi vault − DeFi loan) + haircut %
of retirement entries. Months of runway = liquidity ÷ monthly expenses.

## Conventions

- Positive value = asset, negative value = debt (same as the spreadsheet).
- Everything is local: export a JSON backup from Settings before clearing
  browser data or to move to another device.
