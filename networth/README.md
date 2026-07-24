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
| **Insights** | An **Advisor** at the top — a transparent, on-device rules engine that reads your own numbers (debt APRs, expected asset growth, liquidity/runway, DeFi LTV, expenses, retirement gap) and generates prioritized, math-backed ideas that re-rank by the preference you pick (be debt-free / grow + balance / max liquidity / retire sooner). No model, no network, nothing leaves the device. Below it, the derived numbers: net worth, home equity, available liquidity, months of runway (with and without a full HELOC draw), DeFi loan health (LTV, interest cost, stables-vs-debt buffer), per-owner totals, and a category breakdown (solid ink = assets, hatched = debts). |
| **Forecast** | Projects the **value of your growth assets** — cash, investments, crypto, retirement and real estate; vehicles and debts are excluded, so this forecasts what your holdings are worth, not net worth. Every included entry carries an expected yearly change (%) **and a recurring contribution** (an amount plus a daily/weekly/biweekly/monthly/yearly cadence), editable inline or in the entry dialog. Contributions compound as an annuity at each account's growth rate, so the projection reflects ongoing saving — the basis of a retirement forecast — and a savings-rate summary shows your total monthly/yearly deposits. A projected value chart over a 1–30 year horizon, a next-milestone estimate, and a **what-if calculator**: move an amount between growth assets (or in/out of the ledger) to see the immediate impact on net worth, liquidity, runway, LTV and home equity, plus the opportunity cost or gain at the horizon versus the current plan (dashed line overlay). The ledger itself is never modified by a what-if. |
| **Expenses** | Imported from the Lifestyle Budget spreadsheet. Each expense has an amount, a cadence (weekly/biweekly/monthly/yearly), a source account, a day-of-month or weekday, an owner, and a necessity/discretionary/savings type. A **pay-period window** (real calendar dates, payday → next payday, optionally filtered by account) totals the auto-pays that will hit each account so you know how much to keep vs. waterfall. Each expense can carry a **grace period** (e.g. a mortgage's 15 days); the planner automatically notices bills whose grace runs past the window end, shows both options (pay it all now vs. defer to the next paycheck), and a toggle applies the deferral — subtracting it from the "keep this much" total and listing what can wait, and until when. The core answer is **leave vs. sweep**: enter what's in the account now and a safety floor, and it tells you exactly how much to **leave** to clear every bill until your next payday — so you can **sweep** the rest to save/invest, riding the balance down to your floor right before pay. A draw-down table shows it bill by bill. Your **payday schedule** is baked in (cadence + date; the amount is optional since income varies — it isn't needed for the leave/sweep math), and a **Next pay period** panel tells you how much your next check needs to cover, including any bill you deferred into it — turning "pay the mortgage on the 1st or later?" into a concrete answer. A monthly picture (totals by type and owner, optional take-home → surplus) and a **retirement calculator**: lean (necessities) and full (necessities + discretionary) nest-egg numbers from your withdrawal rate, with progress and years-to-reach drawn from a **selectable set of retirement assets** (a checklist lets you include/exclude specific holdings — your home and kids' accounts are excluded by default). |
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

## Put it on your iPhone Home Screen

The app is a full PWA (manifest + icons + offline service worker) and is
served over HTTPS by GitHub Pages from the `gh-pages` branch. A workflow
(`.github/workflows/deploy-ledger.yml`) republishes `networth/` to that
branch on every push to `main`, so the live site stays current
automatically:

1. The app is live at `https://<username>.github.io/git_test/`.
2. Open that URL in **Safari** on the iPhone, tap **Share →
   Add to Home Screen**.

(Note: on GitHub's free plan, Pages only works if the repository is
public.)

It then launches full-screen like a native app with its own paper-and-ink
icon, and works completely offline — the service worker caches the app
shell, and your data is already local. The app also calls
`navigator.storage.persist()` so the browser treats your data as
not-to-be-evicted.

Two saving notes:

- Data is saved automatically on **every** change (there is no save
  button to forget).
- The Home Screen app and Safari keep *separate* storage on iOS — after
  installing, do your tracking in the installed app. To carry data over
  from Safari (or any other device), use **Settings → Export JSON** there
  and **Import JSON** in the installed app.

## Sharing with a partner (optional sync)

Settings → **Share with your partner** syncs the ledger between two phones.
The entire state is **AES-GCM encrypted in the browser** before it's stored in
a shared bin, and the **encryption key travels only in the share link's URL
fragment** (which browsers never send to a server) — so the sync host only ever
sees ciphertext.

- **Create a shared space** generates the encrypted bin and a share link.
- Send that link to your partner privately (text/email) — it's the key, so
  don't post it publicly. Opening it on their phone (or Settings → **Join with
  a link**) joins the shared ledger.
- Both devices push on change (debounced) and pull on load, on focus, and every
  20s. Conflict handling is **last-write-wins** by an `updatedAt` timestamp, so
  it's best not to edit the same thing simultaneously.
- Your local copy and JSON export remain the source of truth; if the bin is
  unreachable the app keeps working offline and retries.

## Conventions

- Positive value = asset, negative value = debt (same as the spreadsheet).
- Everything is local: export a JSON backup from Settings before clearing
  browser data or to move to another device.
