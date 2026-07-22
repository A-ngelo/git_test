/* ═══════════════════════════════════════════════════════════════
   The Ledger — net worth tracker
   Plain JS, no dependencies. All data lives in localStorage.
   Convention: positive value = asset, negative value = debt.
   ═══════════════════════════════════════════════════════════════ */

(() => {
"use strict";

const STORAGE_KEY = "networth-ledger-v1";

/* ── Seed data (imported from the Assets & Debts spreadsheet) ── */

function seedState() {
  const cats = [
    ["real-estate", "Real Estate"],
    ["crypto",      "Crypto & DeFi"],
    ["retirement",  "Retirement"],
    ["investments", "Investments"],
    ["cash",        "Cash"],
    ["vehicles",    "Vehicles"],
    ["collections", "Collections"],
    ["cards",       "Credit Cards"],
    ["loans",       "Loans"],
  ].map(([id, name]) => ({ id, name }));

  // [name, value, category, owner, liquidity, role]
  const rows = [
    ["Home (est. + improvements)", 750000, "real-estate", "Joint",  "illiquid",   "property"],
    ["Ether.fi Vault",              54700, "crypto",      "Angelo", "illiquid",   "defi-vault"],
    ["Schwab HSA (ETH)",            40700, "retirement",  "Angelo", "retirement", ""],
    ["Public IRA (ETH)",            34500, "retirement",  "Angelo", "retirement", ""],
    ["2021 Santa Fe",               17500, "vehicles",    "Joint",  "illiquid",   ""],
    ["Angelo's Betterment",         16400, "investments", "Angelo", "liquid",     ""],
    ["Crypto.com IRA",               6260, "retirement",  "Angelo", "retirement", ""],
    ["Figure Markets",               5075, "crypto",      "Angelo", "liquid",     ""],
    ["Fidelity IRA (ETH)",           4754, "retirement",  "Angelo", "retirement", ""],
    ["2015 NV200",                   4000, "vehicles",    "Joint",  "illiquid",   ""],
    ["529 Plan",                     3540, "investments", "Joint",  "illiquid",   ""],
    ["HSA (cash in Lively)",         3000, "retirement",  "Angelo", "retirement", ""],
    ["Collectr Portfolio",           2068, "collections", "Angelo", "liquid",     ""],
    ["Eastern Bank",                 1692, "cash",        "Angelo", "liquid",     ""],
    ["M1",                           1225, "investments", "Angelo", "liquid",     ""],
    ["Brenna's Citizens",           15000, "cash",        "Brenna", "liquid",     ""],
    ["Brenna's Betterment Savings",  8000, "investments", "Brenna", "liquid",     ""],
    ["2017 Santa Fe",                9000, "vehicles",    "Brenna", "illiquid",   ""],
    ["Brenna's 401k (Breadshop)",    5162, "retirement",  "Brenna", "retirement", ""],
    ["Brenna's MTRS Annuity",        2225, "retirement",  "Brenna", "retirement", ""],
    ["Coinbase CC",                  -116, "cards",       "Angelo", "liquid",     ""],
    ["Chase Aeroplan CC",           -1818, "cards",       "Angelo", "liquid",     ""],
    ["Ether.fi Borrowed",          -20400, "crypto",      "Angelo", "liquid",     "defi-loan"],
    ["HELOC",                      -53610, "loans",       "Joint",  "illiquid",   "heloc"],
    ["Mortgage",                  -396298, "loans",       "Joint",  "illiquid",   "property-loan"],
  ];

  const items = rows.map(([name, value, categoryId, owner, liquidity, role], i) => ({
    id: "seed-" + i, name, value, categoryId, owner, liquidity, role,
  }));
  items.forEach((it) => {
    it.growth = defaultGrowth(it);
    it.contrib = 0;              // amount per period; you fill these in
    it.contribFreq = "monthly"; // used only when contrib > 0
    it.retirement = defaultRetirement(it);
    it.apr = defaultApr(it);
  });

  const state = {
    version: 1,
    theme: "paper",
    settings: {
      monthlyExpenses: 3955,
      helocLimit: 100000,
      retirementPct: 60,
      defiApr: 4.0,
      defiStables: 16600,
      withdrawalRate: 4.0,
      monthlyIncome: 0,
    },
    owners: ["Angelo", "Brenna", "Joint"],
    categories: cats,
    items,
    snapshots: [],
    forecast: { horizon: 10 },
    expenses: seedExpenses(),
    income: seedIncome(),
    expensesView: { start: "", end: "", account: "DCU", basis: "full", useGrace: true, startBalance: 0, floor: 0 },
    advisor: { strategy: "grow-balance" },
  };

  const t = totals(state);
  state.snapshots.push({
    id: uid(),
    date: new Date().toISOString().slice(0, 10),
    note: "Imported from spreadsheet",
    netWorth: t.net, assets: t.assets, debts: t.debts,
  });
  return state;
}

/* Expenses imported from the Lifestyle Budget spreadsheet.
   amount is per-occurrence; freq normalizes to a monthly cost.
   when = day-of-month (monthly/yearly) or weekday 0–6 Sun–Sat (weekly).
   type: necessity | discretionary | savings. */
function seedExpenses() {
  // [name, amount, freq, when, account, owner, type]
  const rows = [
    ["Juno's Future Fund (Betterment)", 100, "weekly",  5, "DCU",      "Angelo", "savings"],
    ["M1",                              100, "weekly",  5, "DCU",      "Angelo", "savings"],
    ["Betterment Brokerage",           100, "weekly",  5, "DCU",      "Angelo", "savings"],
    ["Lorelei's Future Account",        75, "weekly",  5, "DCU",      "Angelo", "savings"],
    ["Mortgage",                      2736, "monthly", 1, "DCU",      "Angelo", "necessity"],
    ["National Grid",                  384, "monthly", 1, "DCU",      "Angelo", "necessity"],
    ["HELOC Payment",                  318, "monthly", 6, "DCU",      "Angelo", "necessity"],
    ["Progressive",                    180, "monthly", 18, "DCU",     "Angelo", "necessity"],
    ["Oil",                            140, "monthly", null, "ether.fi", "Angelo", "necessity"],
    ["Propane",                        110, "monthly", null, "ether.fi", "Angelo", "necessity"],
    ["Verizon Internet + Disney+",      76, "monthly", 31, "ether.fi", "Angelo", "necessity"],
    ["Mint Mobile",                     66, "monthly", null, "ether.fi", "Angelo", "necessity"],
    ["AAA Life",                        34, "monthly", null, "ether.fi", "Angelo", "necessity"],
    ["Coinbase One",                    30, "monthly", null, "Coinbase CC", "Angelo", "discretionary"],
    ["CC Annual Fees",                  24, "monthly", null, "", "Angelo", "discretionary"],
    ["Claude",                          21, "monthly", null, "", "Angelo", "discretionary"],
    ["X Premium",                       11, "monthly", null, "", "Angelo", "discretionary"],
    ["Netflix",                         18, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["Spotify",                         17, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["AAA Coverage",                    17, "monthly", null, "ether.fi", "Angelo", "necessity"],
    ["Max",                             19, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["Amazon Prime",                    12, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["Lightroom",                       11, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["Crunchyroll",                      8, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["Paramount+",                       8, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["Amazon Kids",                      7, "monthly", null, "", "Angelo", "discretionary"],
    ["Trash bags (Amazon)",              5, "monthly", null, "ether.fi", "Angelo", "necessity"],
    ["Ring Doorbell",                    5, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["Disney Duo (Hulu)",                1, "monthly", null, "ether.fi", "Angelo", "discretionary"],
    ["Groceries",                      900, "monthly", null, "", "Brenna", "necessity"],
    ["Euro School Trip",               771, "monthly", null, "", "Brenna", "discretionary"],
    ["Betterment",                     400, "monthly", null, "", "Brenna", "savings"],
    ["AlphaBEST",                      150, "monthly", null, "", "Brenna", "necessity"],
    ["GLP",                            299, "monthly", null, "", "Brenna", "necessity"],
    ["Donna's Health Insurance",       283, "monthly", null, "", "Brenna", "necessity"],
    ["Gymnastics",                     125, "monthly", null, "", "Brenna", "discretionary"],
    ["Water Bill",                      76, "monthly", null, "", "Brenna", "necessity"],
    ["iStorage",                        60, "monthly", null, "", "Brenna", "discretionary"],
    ["Gutters",                         25, "monthly", null, "", "Brenna", "necessity"],
    ["NY Times",                         6, "monthly", null, "", "Brenna", "discretionary"],
    ["Sword Scale Sub",                 10, "monthly", null, "", "Brenna", "discretionary"],
  ];
  return rows.map(([name, amount, freq, when, account, owner, type], i) => ({
    id: "exp-" + i, name, amount, freq, when, account, owner, type,
    grace: defaultGrace(name),
  }));
}

/* default grace period (days) — mortgages typically allow ~15 */
function defaultGrace(name) {
  return /mortgage/i.test(name || "") ? 15 : 0;
}

/* Income / paychecks, so the planner can project a running balance and
   guardrail you against ever needing assets to cover a bill. */
function seedIncome() {
  return [{
    id: "inc-0", name: "Paycheck", amount: null, freq: "biweekly",
    weekday: 3, anchor: "2026-07-29", account: "DCU", owner: "Angelo",
  }];
}

/* assumed interest rate (% APR) for debts, so the advisor can weigh
   payoff vs. investing. Editable per entry; only meaningful for debts. */
function defaultApr(it) {
  if (!(it.value < 0)) return 0;
  if (it.role === "defi-loan") return 4;
  if (it.categoryId === "cards") return 22;
  if (it.role === "heloc") return 8.5;
  if (it.role === "property-loan") return 7;
  if (it.categoryId === "loans") return 8;
  return 0;
}

/* default retirement eligibility: growth assets, but not your home (you
   live in it) and not 529 college funds. Everything is toggleable. */
function defaultRetirement(it) {
  if (!(it.value > 0) || it.categoryId === "vehicles") return false;
  if (it.role === "property") return false;
  if (/\b529\b|college|future (fund|account)/i.test(it.name)) return false;
  return true;
}

/* starting-point growth guesses (% per year); every entry is editable */
function defaultGrowth(it) {
  if (it.role === "property") return 3;
  if (it.role === "defi-vault") return 5;
  if (it.value < 0) return 0;               // debts stay flat unless told otherwise
  switch (it.categoryId) {
    case "vehicles":    return -10;
    case "retirement":  return 6;
    case "investments": return 6;
    case "crypto":      return 5;
    default:            return 0;
  }
}

/* ── Store ──────────────────────────────────────────────────── */

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1 && Array.isArray(s.items)) {
        let migrated = false;
        for (const it of s.items) {
          if (typeof it.growth !== "number") { it.growth = defaultGrowth(it); migrated = true; }
          if (typeof it.contrib !== "number") { it.contrib = 0; migrated = true; }
          if (!it.contribFreq) { it.contribFreq = "monthly"; migrated = true; }
          if (typeof it.retirement !== "boolean") { it.retirement = defaultRetirement(it); migrated = true; }
          if (typeof it.apr !== "number") { it.apr = defaultApr(it); migrated = true; }
        }
        if (!s.advisor) { s.advisor = { strategy: "grow-balance" }; migrated = true; }
        if (!s.forecast) { s.forecast = { horizon: 10 }; migrated = true; }
        if (!Array.isArray(s.expenses)) { s.expenses = seedExpenses(); migrated = true; }
        else for (const e of s.expenses) {
          if (typeof e.grace !== "number") { e.grace = defaultGrace(e.name); migrated = true; }
        }
        if (!s.expensesView) { s.expensesView = { start: "", end: "", account: "", basis: "full" }; migrated = true; }
        if (typeof s.expensesView.useGrace !== "boolean") { s.expensesView.useGrace = true; migrated = true; }
        if (typeof s.expensesView.startBalance !== "number") { s.expensesView.startBalance = 0; migrated = true; }
        if (typeof s.expensesView.floor !== "number") { s.expensesView.floor = 0; migrated = true; }
        if (!Array.isArray(s.income)) { s.income = seedIncome(); migrated = true; }
        else for (const inc of s.income) {
          // undo the earlier hard-coded placeholder paycheck amount
          if (inc.id === "inc-0" && inc.amount === 4855) { inc.amount = null; migrated = true; }
        }
        if (typeof s.settings.withdrawalRate !== "number") { s.settings.withdrawalRate = 4.0; migrated = true; }
        if (typeof s.settings.monthlyIncome !== "number") { s.settings.monthlyIncome = 0; migrated = true; }
        if (migrated) persist(s);
        return s;
      }
    }
  } catch (_) { /* fall through to seed */ }
  const s = seedState();
  persist(s);
  return s;
}

function persist(s = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Money & math ───────────────────────────────────────────── */

const fmt0 = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});
const money = (v) => fmt0.format(Math.round(v));
const moneyAbs = (v) => fmt0.format(Math.abs(Math.round(v)));

function totals(s = state) {
  let assets = 0, debts = 0;
  for (const it of s.items) {
    if (it.value >= 0) assets += it.value; else debts += it.value;
  }
  return { assets, debts, net: assets + debts };
}

function sumWhere(pred) {
  return state.items.filter(pred).reduce((a, it) => a + it.value, 0);
}

/* every derived number, computable for any item list (real or what-if) */
function computeMetrics(list) {
  const st = state.settings;
  let assets = 0, debts = 0;
  for (const it of list) { if (it.value >= 0) assets += it.value; else debts += it.value; }
  const sum = (pred) => list.filter(pred).reduce((a, it) => a + it.value, 0);

  const propertyValue = sum((i) => i.role === "property");
  const propertyDebt = sum((i) => i.role === "property-loan" || i.role === "heloc");
  const helocBalance = Math.abs(sum((i) => i.role === "heloc"));
  const vault = sum((i) => i.role === "defi-vault");
  const defiLoan = Math.abs(sum((i) => i.role === "defi-loan"));
  const defiNet = vault - defiLoan;
  const liquid = sum((i) => i.liquidity === "liquid" && !(i.role || "").startsWith("defi"));
  const retirementFunds = sum((i) => i.liquidity === "retirement" && i.value > 0);
  const liquidity = liquid + defiNet + retirementFunds * (st.retirementPct / 100);

  return {
    assets, debts, net: assets + debts,
    propertyValue, propertyDebt, homeEquity: propertyValue + propertyDebt,
    helocHeadroom: Math.max(0, st.helocLimit - helocBalance),
    vault, defiLoan, defiNet,
    ltv: vault > 0 ? defiLoan / vault : 0,
    interestMo: (defiLoan * st.defiApr) / 100 / 12,
    stablesGap: st.defiStables - defiLoan,
    liquidity,
    months: st.monthlyExpenses > 0 ? liquidity / st.monthlyExpenses : 0,
  };
}

/* ── Tabs ───────────────────────────────────────────────────── */

const tabs = document.querySelectorAll(".chapters button");
tabs.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

function showTab(name) {
  tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.hidden = p.id !== "tab-" + name;
  });
  renderAll();
}

/* ── Hero + footer ──────────────────────────────────────────── */

function renderHero() {
  const t = totals();
  document.getElementById("hero-networth").textContent = money(t.net);
  document.getElementById("hero-assets").textContent = money(t.assets);
  document.getElementById("hero-debts").textContent = moneyAbs(t.debts);

  const owned = t.assets <= 0 ? 0 : Math.max(0, Math.min(1, t.net / t.assets));
  document.getElementById("progress-fill").style.width = (owned * 100).toFixed(1) + "%";
  const cap = document.getElementById("progress-caption");
  cap.innerHTML = "";
  const left = document.createElement("span");
  left.textContent = `you own ${(owned * 100).toFixed(0)}% of your gross assets`;
  const right = document.createElement("span");
  const n = state.snapshots.length;
  right.textContent = n ? `${n} snapshot${n === 1 ? "" : "s"} recorded` : "no snapshots yet";
  cap.append(left, right);
}

/* ── Ledger tab ─────────────────────────────────────────────── */

function renderLedger() {
  const wrap = document.getElementById("ledger-groups");
  wrap.innerHTML = "";
  if (!state.items.length) {
    wrap.innerHTML = `<p class="empty-note">The ledger is blank. Add your first entry above.</p>`;
    return;
  }
  for (const cat of state.categories) {
    const items = state.items
      .filter((it) => it.categoryId === cat.id)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    if (!items.length) continue;

    const group = document.createElement("section");
    group.className = "ledger-group";

    const head = document.createElement("div");
    head.className = "ledger-group-head";
    const h2 = document.createElement("h2");
    h2.textContent = cat.name;
    const total = document.createElement("span");
    total.className = "group-total";
    const sum = items.reduce((a, it) => a + it.value, 0);
    total.textContent = (sum < 0 ? "− " : "") + moneyAbs(sum);
    head.append(h2, total);
    group.append(head);

    for (const it of items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ledger-row";
      row.title = "Edit " + it.name;

      const name = document.createElement("span");
      name.className = "row-name";
      name.textContent = it.name;

      const badges = document.createElement("span");
      badges.className = "row-badges";
      badges.textContent = it.owner !== "Joint" ? it.owner.toUpperCase() : "";

      const dots = document.createElement("span");
      dots.className = "row-dots";

      const value = document.createElement("span");
      value.className = "row-value" + (it.value < 0 ? " negative" : "");
      value.textContent = moneyAbs(it.value);

      row.append(name, badges, dots, value);
      row.addEventListener("click", () => openItemDialog(it.id));
      group.append(row);
    }

    // orphaned category check happens in settings; unknown-category items:
    wrap.append(group);
  }

  const orphans = state.items.filter(
    (it) => !state.categories.some((c) => c.id === it.categoryId)
  );
  if (orphans.length) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = `${orphans.length} entr${orphans.length === 1 ? "y has" : "ies have"} a deleted category — edit them to re-shelve.`;
    wrap.append(note);
    for (const it of orphans) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ledger-row";
      row.textContent = `${it.name} — ${money(it.value)}`;
      row.addEventListener("click", () => openItemDialog(it.id));
      wrap.append(row);
    }
  }
}

/* ── Insights tab ───────────────────────────────────────────── */

function tile(label, value, note) {
  return `<div class="stat-tile">
    <span class="stat-label">${esc(label)}</span>
    <span class="stat-value">${esc(value)}</span>
    ${note ? `<span class="stat-note">${esc(note)}</span>` : ""}
  </div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/* ── Advisor ────────────────────────────────────────────────────
   A transparent, rules-based engine: it reads your own numbers and
   proposes prioritized ideas, re-ranked by the preference you pick.
   No model, no network — every suggestion shows its math. */

const STRATEGIES = [
  ["debt-free",    "Be debt-free",   { debt: 1.7, risk: 1.2, liquidity: 0.9, growth: 0.5, retirement: 0.7, efficiency: 1.0 }],
  ["grow-balance", "Grow + balance", { debt: 1.1, risk: 1.1, liquidity: 1.0, growth: 1.25, retirement: 1.15, efficiency: 1.05 }],
  ["liquidity",    "Max liquidity",  { debt: 0.9, risk: 1.35, liquidity: 1.75, growth: 0.7, retirement: 0.8, efficiency: 1.0 }],
  ["retirement",   "Retire sooner",  { debt: 0.95, risk: 1.0, liquidity: 0.8, growth: 1.3, retirement: 1.75, efficiency: 1.1 }],
];

/* Expected return on money you could actually redirect — investable
   growth assets, excluding your home (you wouldn't buy more house with
   spare cash). Weighted by value; falls back to 6% if none. */
function expectedReturn() {
  const list = forecastItems().filter((it) => it.role !== "property");
  const tot = list.reduce((a, it) => a + it.value, 0);
  if (tot <= 0) return 6;
  return list.reduce((a, it) => a + it.value * (it.growth || 0), 0) / tot;
}

/* generate every applicable idea as {tag, base, title, body}; base 0–100 */
function adviceCandidates() {
  const ideas = [];
  const m = computeMetrics(state.items);
  const st = state.settings;
  const ret = expectedReturn();
  const debts = state.items
    .filter((it) => it.value < 0)
    .map((it) => ({ ...it, bal: -it.value, apr: it.apr || 0 }))
    .sort((a, b) => b.apr - a.apr);

  /* 1. high-APR debts that beat investing */
  for (const d of debts) {
    if (d.apr <= 0 || d.bal < 1) continue;
    const moInterest = (d.bal * d.apr) / 100 / 12;
    if (d.apr >= ret + 1) {
      ideas.push({
        tag: "debt", base: Math.min(95, 45 + d.apr + Math.min(25, d.bal / 1000)),
        title: `Pay down ${d.name} (~${d.apr}% APR)`,
        body: `${money(d.bal)} at ~${d.apr}% costs about ${money(moInterest)}/mo in interest. ` +
          `Paying it off is a guaranteed ~${d.apr}% return — more than your ~${ret.toFixed(1)}% ` +
          `expected asset growth, so it beats investing the same dollars.`,
      });
    } else if (d.apr > 0) {
      ideas.push({
        tag: "efficiency", base: 30,
        title: `${d.name} is "cheap" debt (~${d.apr}%)`,
        body: `At ~${d.apr}%, below your ~${ret.toFixed(1)}% expected growth, there's little rush to ` +
          `prepay ${money(d.bal)} — investing spare cash likely comes out ahead. Keep paying on schedule.`,
      });
    }
  }

  /* 2. avalanche order if 2+ interest-bearing debts */
  const rateDebts = debts.filter((d) => d.apr > 0 && d.bal >= 1);
  if (rateDebts.length >= 2) {
    ideas.push({
      tag: "debt", base: 55,
      title: "Attack debts highest-rate first",
      body: "Order to clear them for the least interest: " +
        rateDebts.map((d) => `${d.name} (${d.apr}%)`).join(" → ") + ".",
    });
  }

  /* 3. emergency fund / excess cash */
  const months = m.months;
  if (st.monthlyExpenses > 0) {
    if (months < 3) {
      const need = 3 * st.monthlyExpenses - m.liquidity;
      ideas.push({
        tag: "liquidity", base: 90,
        title: "Build a 3-month emergency fund",
        body: `Liquid reserves cover about ${months.toFixed(1)} months. Adding roughly ` +
          `${money(Math.max(0, need))} in cash gets you to a 3-month cushion.`,
      });
    } else if (months > 12) {
      const excess = m.liquidity - 6 * st.monthlyExpenses;
      ideas.push({
        tag: "efficiency", base: 60,
        title: "Put idle cash to work",
        body: `You hold about ${months.toFixed(0)} months of runway — well past a 6-month cushion. ` +
          `Roughly ${money(Math.max(0, excess))} could go toward your top-rate debt or growth ` +
          `assets instead of sitting idle.`,
      });
    }
  }

  /* 4. DeFi risk */
  if (m.vault > 0 && m.defiLoan > 0) {
    if (m.ltv >= 0.5) {
      ideas.push({
        tag: "risk", base: 80,
        title: "Trim your DeFi loan-to-value",
        body: `LTV is ${(m.ltv * 100).toFixed(0)}% (${money(m.defiLoan)} against ${money(m.vault)}). ` +
          `A market dip could risk liquidation — repaying some borrow or adding collateral lowers the risk.`,
      });
    }
    if (m.stablesGap < 0) {
      ideas.push({
        tag: "risk", base: 50,
        title: "Top up DeFi stablecoins",
        body: `Your stablecoin balance is about ${money(-m.stablesGap)} short of the ${money(m.defiLoan)} ` +
          `borrowed. Topping up keeps you able to repay on demand.`,
      });
    }
  }

  /* 5. redirect savings while carrying high-rate debt */
  const topDebt = rateDebts[0];
  const savingContribs = state.items.reduce((a, it) => a + (annualContrib(it) || 0), 0);
  if (topDebt && topDebt.apr >= ret + 3 && savingContribs > 0) {
    ideas.push({
      tag: "debt", base: 65,
      title: "Redirect some saving to your priciest debt",
      body: `You're adding about ${money(savingContribs / 12)}/mo to growth assets earning ~${ret.toFixed(1)}%, ` +
        `while ${topDebt.name} costs ${topDebt.apr}%. Steering some of that at the debt is a higher, ` +
        `risk-free return until it's gone.`,
    });
  }

  /* 6. retirement gap */
  const by = expenseTotalsByType();
  const swr = (st.withdrawalRate || 4) / 100;
  const fullTarget = swr > 0 ? ((by.necessity + by.discretionary) * 12) / swr : 0;
  const retList = retirementItems();
  const retAssets = retList.reduce((a, it) => a + it.value, 0);
  if (fullTarget > 0) {
    const yrs = yearsToReach(fullTarget, retList);
    if (yrs === null || yrs > 15) {
      ideas.push({
        tag: "retirement", base: 70,
        title: "Close the retirement gap faster",
        body: `Your retirement assets (${money(retAssets)}) are ${(retAssets / fullTarget * 100).toFixed(0)}% ` +
          `of the ${money(fullTarget)} needed to retire on ${money(by.necessity + by.discretionary)}/mo. ` +
          `Raising contributions or trimming that monthly figure pulls the date in.`,
      });
    } else if (yrs != null) {
      ideas.push({
        tag: "retirement", base: 55,
        title: "You're on a solid retirement track",
        body: `At current growth and contributions your retirement assets reach ${money(fullTarget)} in ` +
          `about ${yrs.toFixed(0)} years. Extra contributions shorten that; lifestyle creep lengthens it.`,
      });
    }
  }

  /* 7. savings-rate note */
  if (savingContribs > 0 && st.monthlyIncome > 0) {
    const rate = (savingContribs / 12) / st.monthlyIncome * 100;
    ideas.push({
      tag: "growth", base: 40,
      title: `Your savings rate is about ${rate.toFixed(0)}%`,
      body: `You're investing ${money(savingContribs / 12)}/mo of your ${money(st.monthlyIncome)} take-home. ` +
        (rate >= 20 ? "That's a strong rate — keep it steady." :
          "Nudging this toward 20% meaningfully speeds up every long-term goal."),
    });
  }

  return ideas;
}

function renderAdvisor() {
  const row = document.getElementById("strategy-row");
  row.innerHTML = "";
  const current = (state.advisor && state.advisor.strategy) || "grow-balance";
  for (const [key, label] of STRATEGIES) {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = label;
    b.setAttribute("aria-pressed", String(key === current));
    b.addEventListener("click", () => {
      state.advisor.strategy = key;
      persist();
      renderAdvisor();
    });
    row.append(b);
  }

  const weights = (STRATEGIES.find(([k]) => k === current) || STRATEGIES[1])[2];
  const ideas = adviceCandidates()
    .map((i) => ({ ...i, score: i.base * (weights[i.tag] ?? 1) }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 7);

  const body = document.getElementById("advice-body");
  if (!ideas.length) {
    body.innerHTML = `<p class="empty-note">No standout ideas right now — your numbers look balanced.</p>`;
    return;
  }
  const tagName = { debt: "Debt", growth: "Growth", liquidity: "Liquidity", risk: "Risk", retirement: "Retirement", efficiency: "Efficiency" };
  let html = "";
  ideas.forEach((i, n) => {
    html += `<div class="idea-card">
      <div class="idea-head">
        <span class="idea-num">${n + 1}</span>
        <span class="idea-title">${esc(i.title)}</span>
        <span class="idea-tag idea-tag-${i.tag}">${esc(tagName[i.tag] || i.tag)}</span>
      </div>
      <p class="idea-body">${esc(i.body)}</p>
    </div>`;
  });
  html += `<p class="fine-print advisor-disclaimer">Generated from your own figures with transparent
    rules — educational, not professional financial advice. Debt rates are your editable estimates.</p>`;
  body.innerHTML = html;
}

function renderInsights() {
  const el = document.getElementById("insights-body");
  const st = state.settings;
  const m = computeMetrics(state.items);
  const t = { assets: m.assets, debts: m.debts, net: m.net };
  const { propertyValue, propertyDebt, homeEquity, helocHeadroom,
          vault, defiLoan, defiNet, ltv, interestMo, stablesGap,
          liquidity, months } = m;

  /* owners */
  const ownerRows = state.owners
    .map((o) => [o, sumWhere((i) => i.owner === o)])
    .filter(([, v]) => v !== 0);

  let html = "";

  html += `<h2 class="section-label">The estate</h2><div class="insight-grid">`;
  html += tile("Net worth", money(t.net));
  html += tile("Total assets", money(t.assets));
  html += tile("Total debts", moneyAbs(t.debts));
  if (propertyValue > 0) {
    html += tile("Home equity", money(homeEquity), `${moneyAbs(propertyDebt)} still owed`);
  }
  html += `</div>`;

  html += `<h2 class="section-label">Liquidity &amp; runway</h2><div class="insight-grid">`;
  html += tile("Available liquidity", money(liquidity),
    `liquid + DeFi net + ${st.retirementPct}% of retirement`);
  html += tile("Months of runway", months.toFixed(1),
    `at ${money(st.monthlyExpenses)}/mo expenses`);
  html += tile("+ full HELOC draw", money(liquidity + helocHeadroom),
    `${money(helocHeadroom)} of headroom left`);
  html += `</div>`;

  if (vault > 0 || defiLoan > 0) {
    html += `<h2 class="section-label">DeFi loan health</h2><div class="insight-grid">`;
    html += tile("Loan-to-value", (ltv * 100).toFixed(1) + "%",
      `${moneyAbs(defiLoan)} against ${moneyAbs(vault)}`);
    html += tile("Position net value", money(defiNet), "vault minus borrowed");
    html += tile("Interest cost", money(interestMo) + "/mo",
      `${money(interestMo * 12)}/yr at ${st.defiApr}% APR`);
    html += tile("Stables vs. debt", (stablesGap < 0 ? "− " : "") + moneyAbs(stablesGap),
      stablesGap < 0 ? "shortfall — top up stables to match debt" : "stables cover the debt");
    html += `</div>`;
  }

  if (ownerRows.length > 1) {
    html += `<h2 class="section-label">By owner</h2><div class="insight-grid">`;
    for (const [o, v] of ownerRows) html += tile(o, money(v));
    html += `</div>`;
  }

  html += `<h2 class="section-label">By category</h2><div id="break-rows"></div>`;

  el.innerHTML = html;

  /* category breakdown bars (built with DOM so widths are computed) */
  const rows = state.categories
    .map((c) => ({ name: c.name, sum: sumWhere((i) => i.categoryId === c.id) }))
    .filter((r) => r.sum !== 0)
    .sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum));
  const max = Math.max(...rows.map((r) => Math.abs(r.sum)), 1);
  const breakEl = document.getElementById("break-rows");
  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "break-row";
    row.title = `${r.name}: ${money(r.sum)}`;
    const name = document.createElement("span");
    name.className = "break-name";
    name.textContent = r.name;
    const track = document.createElement("span");
    track.className = "break-track";
    const bar = document.createElement("span");
    bar.className = "break-bar" + (r.sum < 0 ? " debt" : "");
    bar.style.width = ((Math.abs(r.sum) / max) * 100).toFixed(1) + "%";
    track.append(bar);
    const val = document.createElement("span");
    val.className = "break-value" + (r.sum < 0 ? " negative" : "");
    val.textContent = moneyAbs(r.sum);
    row.append(name, track, val);
    breakEl.append(row);
  }
}

/* ── Forecast tab ───────────────────────────────────────────── */

const HORIZONS = [1, 5, 10, 20, 30];
let scenario = { fromId: "", toId: "", amount: 0 }; // "" = outside the ledger

function scenarioActive() {
  return scenario.amount > 0 && scenario.fromId !== scenario.toId;
}

function scenarioItems() {
  const items = state.items.map((i) => ({ ...i }));
  if (!scenarioActive()) return items;
  const from = items.find((i) => i.id === scenario.fromId);
  const to = items.find((i) => i.id === scenario.toId);
  if (from) from.value -= scenario.amount;
  if (to) to.value += scenario.amount;
  return items;
}

/* contribution cadences: value, short suffix, deposits per year */
const FREQS = [
  ["daily",    "/day",     365],
  ["weekly",   "/week",     52],
  ["biweekly", "/2 weeks",  26],
  ["monthly",  "/month",    12],
  ["yearly",   "/year",      1],
];
const FREQ_PER_YEAR = Object.fromEntries(FREQS.map(([k, , n]) => [k, n]));
const FREQ_SUFFIX = Object.fromEntries(FREQS.map(([k, s]) => [k, s]));

function annualContrib(it) {
  const per = FREQ_PER_YEAR[it.contribFreq] ?? 12;
  return (it.contrib || 0) * per;
}

/* future value of one entry: principal compounds, contributions compound as
   an annuity at the same rate. C is the annualized deposit. */
function projectItemAt(it, years) {
  const g = (it.growth || 0) / 100;
  const gf = Math.pow(1 + g, years);
  let fv = it.value * gf;
  const C = annualContrib(it);
  if (C) fv += Math.abs(g) < 1e-9 ? C * years : C * (gf - 1) / g;
  return fv;
}

function projectAt(list, years) {
  let v = 0;
  for (const it of list) v += projectItemAt(it, years);
  return v;
}

function projectSeries(list, years) {
  const out = [];
  for (let t = 0; t <= years; t++) out.push(projectAt(list, t));
  return out;
}

/* The forecast covers growth assets only: positive-value holdings that
   aren't vehicles. Debts and depreciating vehicles are left out, so this
   projects what your cash, investments, crypto, retirement and real
   estate are worth over time — not net worth. */
const VEHICLE_CATEGORY = "vehicles";
function isForecastable(it) {
  return it.value > 0 && it.categoryId !== VEHICLE_CATEGORY;
}
function forecastItems(list = state.items) {
  return list.filter(isForecastable);
}

/* first crossing of the next round million, monthly resolution, 50y cap.
   `list` is already the forecastable set (all positive), so total = sum. */
function nextMilestone(list) {
  const total = list.reduce((a, it) => a + it.value, 0);
  const target = (Math.floor(Math.max(total, 0) / 1e6) + 1) * 1e6;
  for (let mth = 1; mth <= 600; mth++) {
    if (projectAt(list, mth / 12) >= target) return { target, years: mth / 12 };
  }
  return { target, years: null };
}

function signedMoney(v) {
  return (v < 0 ? "− " : "+ ") + moneyAbs(v);
}

function renderForecast() {
  /* horizon buttons */
  const row = document.getElementById("horizon-row");
  row.innerHTML = "";
  for (const h of HORIZONS) {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = h + " yr" + (h > 1 ? "s" : "");
    b.setAttribute("aria-pressed", String(state.forecast.horizon === h));
    b.addEventListener("click", () => {
      state.forecast.horizon = h;
      persist();
      renderForecast();
    });
    row.append(b);
  }

  /* what-if inputs (rebuilt here, values preserved from the scenario).
     Only growth assets are offered — the forecast is about them. */
  const fset = forecastItems();
  const entryOptions = [["", "Outside the ledger"]].concat(
    fset.map((i) => [i.id, `${i.name} (${money(i.value)})`])
  );
  const fromSel = document.getElementById("wi-from");
  const toSel = document.getElementById("wi-to");
  const validIds = new Set(fset.map((i) => i.id));
  if (scenario.fromId && !validIds.has(scenario.fromId)) scenario.fromId = "";
  if (scenario.toId && !validIds.has(scenario.toId)) scenario.toId = "";
  fillSelect(fromSel, entryOptions, scenario.fromId);
  fillSelect(toSel, entryOptions, scenario.toId);
  document.getElementById("wi-amount").value = scenario.amount || "";

  updateForecastOutputs();
}

/* everything below the inputs — safe to re-run on each keystroke */
function updateForecastOutputs() {
  const H = state.forecast.horizon;
  const active = scenarioActive();
  const fset = forecastItems();
  const baseline = projectSeries(fset, H);
  const scen = active ? projectSeries(forecastItems(scenarioItems()), H) : null;

  document.getElementById("forecast-legend").hidden = !active;
  renderForecastChart(baseline, scen, H);

  /* milestone note */
  const note = document.getElementById("milestone-note");
  const ms = nextMilestone(fset);
  const thisYear = new Date().getFullYear();
  note.textContent = ms.years !== null
    ? `At these assumptions your growth assets would reach ${money(ms.target)} in ` +
      `about ${ms.years.toFixed(1)} years (${Math.round(thisYear + ms.years)}).`
    : `Your growth assets stay under ${money(ms.target)} for the next 50 years at these assumptions.`;

  /* savings-rate summary */
  const summary = document.getElementById("contrib-summary");
  const annual = fset.reduce((a, it) => a + annualContrib(it), 0);
  const funded = fset.filter((it) => annualContrib(it) !== 0).length;
  if (annual === 0) {
    summary.textContent = "No contributions set yet — add amounts below to fold " +
      "regular saving into the forecast.";
  } else {
    const invested = fset
      .filter((it) => annualContrib(it) > 0)
      .reduce((a, it) => a + annualContrib(it) * H, 0);
    summary.textContent =
      `You're contributing ${money(annual / 12)}/mo (${money(annual)}/yr) across ` +
      `${funded} account${funded === 1 ? "" : "s"} — about ${money(invested)} deposited ` +
      `over ${H} year${H > 1 ? "s" : ""}, before any growth.`;
  }

  /* what-if results */
  const res = document.getElementById("whatif-results");
  if (!active) {
    res.innerHTML = `<p class="empty-note">Enter an amount and pick where it moves.</p>`;
    return;
  }
  const mNow = computeMetrics(state.items);
  const mScen = computeMetrics(scenarioItems());
  const dNet = mScen.net - mNow.net;
  const dLiq = mScen.liquidity - mNow.liquidity;
  const dMonths = mScen.months - mNow.months;
  const endBase = baseline[H];
  const endScen = scen[H];
  const dEnd = endScen - endBase;

  let html = `<div class="insight-grid">`;
  html += tile("Net worth today", money(mScen.net),
    dNet === 0 ? "unchanged — money moved, not spent" : signedMoney(dNet) + " vs. now");
  html += tile("Liquidity", money(mScen.liquidity),
    dLiq === 0 ? "unchanged" : signedMoney(dLiq) + " vs. now");
  html += tile("Months of runway", mScen.months.toFixed(1),
    dMonths === 0 ? "unchanged" : signedMoney(dMonths).replace("$", "") + " months");
  if (mNow.vault > 0 || mScen.vault > 0) {
    const dLtv = (mScen.ltv - mNow.ltv) * 100;
    html += tile("DeFi loan-to-value", (mScen.ltv * 100).toFixed(1) + "%",
      Math.abs(dLtv) < 0.05 ? "unchanged" : (dLtv > 0 ? "up " : "down ") + Math.abs(dLtv).toFixed(1) + " pts");
  }
  if (Math.abs(mScen.homeEquity - mNow.homeEquity) > 0.5) {
    html += tile("Home equity", money(mScen.homeEquity),
      signedMoney(mScen.homeEquity - mNow.homeEquity) + " vs. now");
  }
  html += `</div>`;

  html += `<h2 class="section-label">In ${H} year${H > 1 ? "s" : ""}</h2><div class="insight-grid">`;
  html += tile("Current plan", money(endBase));
  html += tile("With this move", money(endScen));
  html += tile(dEnd < 0 ? "Opportunity cost" : "Long-run gain", signedMoney(dEnd),
    "difference at the horizon");
  html += `</div>`;
  res.innerHTML = html;
}

function renderForecastChart(baseline, scen, H) {
  const wrap = document.getElementById("forecast-chart-wrap");
  const tip = document.getElementById("forecast-tooltip");
  wrap.innerHTML = "";
  tip.hidden = true;

  const W = 640, Hpx = 260;
  const pad = { top: 18, right: 16, bottom: 28, left: 62 };
  const iw = W - pad.left - pad.right;
  const ih = Hpx - pad.top - pad.bottom;

  const all = scen ? baseline.concat(scen) : baseline;
  let yMin = Math.min(...all), yMax = Math.max(...all);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const padY = (yMax - yMin) * 0.08;
  yMin -= padY; yMax += padY;

  const X = (t) => pad.left + (t / H) * iw;
  const Y = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * ih;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${Hpx}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label",
    `Projected value of your growth assets over ${H} years, from ${money(baseline[0])} to ${money(baseline[H])} on the current plan` +
    (scen ? `, or ${money(scen[H])} with the what-if move` : "") + ".");

  const css = getComputedStyle(document.body);
  const ink = css.getPropertyValue("--ink").trim();
  const inkSoft = css.getPropertyValue("--ink-soft").trim();
  const inkFaint = css.getPropertyValue("--ink-faint").trim();
  const hairline = css.getPropertyValue("--hairline-soft").trim();

  const mk = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + ((yMax - yMin) * i) / ticks;
    const y = Y(v);
    svg.append(mk("line", {
      x1: pad.left, x2: W - pad.right, y1: y, y2: y,
      stroke: hairline, "stroke-width": 1, "stroke-dasharray": "1 4",
    }));
    const label = mk("text", {
      x: pad.left - 8, y: y + 3, "text-anchor": "end",
      "font-size": 10, fill: inkFaint, "font-family": "inherit",
    });
    label.textContent = compactMoney(v);
    svg.append(label);
  }

  const thisYear = new Date().getFullYear();
  for (const t of [0, H]) {
    const label = mk("text", {
      x: X(t), y: Hpx - 8,
      "text-anchor": t === 0 ? "start" : "end",
      "font-size": 10, fill: inkFaint, "font-family": "inherit",
    });
    label.textContent = String(thisYear + t);
    svg.append(label);
  }

  const lineD = (series) =>
    "M" + series.map((v, t) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(" L");

  if (scen) {
    svg.append(mk("path", {
      d: lineD(scen), fill: "none", stroke: inkSoft,
      "stroke-width": 2, "stroke-dasharray": "6 5",
      "stroke-linejoin": "round", "stroke-linecap": "round",
    }));
  }
  svg.append(mk("path", {
    d: lineD(baseline), fill: "none", stroke: ink,
    "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round",
  }));

  /* direct labels at the ends */
  const endLabel = (series, color, dy) => {
    const label = mk("text", {
      x: W - pad.right - 2, y: Math.min(Math.max(Y(series[H]) + dy, 12), Hpx - pad.bottom - 4),
      "text-anchor": "end", "font-size": 11, fill: color,
      "font-family": "inherit", "font-weight": "600",
    });
    label.textContent = money(series[H]);
    return label;
  };
  if (scen) {
    const above = scen[H] >= baseline[H];
    svg.append(endLabel(baseline, ink, above ? 14 : -8));
    svg.append(endLabel(scen, inkSoft, above ? -8 : 14));
  } else {
    svg.append(endLabel(baseline, ink, -8));
  }

  /* hover crosshair + tooltip */
  const crosshair = mk("line", {
    x1: 0, x2: 0, y1: pad.top, y2: Hpx - pad.bottom,
    stroke: inkFaint, "stroke-width": 1, "stroke-dasharray": "2 3", visibility: "hidden",
  });
  svg.append(crosshair);
  const overlay = mk("rect", {
    x: pad.left, y: pad.top, width: iw, height: ih, fill: "transparent",
  });
  overlay.style.cursor = "crosshair";
  svg.append(overlay);

  function showHover(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const t = Math.max(0, Math.min(H, Math.round(((px - pad.left) / iw) * H)));
    const x = X(t);
    crosshair.setAttribute("x1", x); crosshair.setAttribute("x2", x);
    crosshair.setAttribute("visibility", "visible");
    let html = `<strong>${thisYear + t}</strong> (+${t} yr${t === 1 ? "" : "s"})` +
      `<br>${esc(money(baseline[t]))}`;
    if (scen) {
      html += `<br>what-if: ${esc(money(scen[t]))}` +
        `<br><span style="opacity:.75">Δ ${esc(signedMoney(scen[t] - baseline[t]))}</span>`;
    }
    tip.innerHTML = html;
    tip.style.left = rect.left + (x / W) * rect.width + "px";
    tip.style.top = rect.top + (Y(baseline[t]) / Hpx) * rect.height + "px";
    tip.hidden = false;
  }
  function hideHover() {
    crosshair.setAttribute("visibility", "hidden");
    tip.hidden = true;
  }
  overlay.addEventListener("mousemove", showHover);
  overlay.addEventListener("touchstart", showHover, { passive: true });
  overlay.addEventListener("touchmove", showHover, { passive: true });
  overlay.addEventListener("mouseleave", hideHover);
  overlay.addEventListener("touchend", hideHover);

  wrap.append(svg);
}

/* growth assumptions list */
function renderGrowthList() {
  const el = document.getElementById("growth-list");
  el.innerHTML = "";
  const items = forecastItems().sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "growth-row";

    const name = document.createElement("span");
    name.className = "g-name";
    name.textContent = it.name;

    const val = document.createElement("span");
    val.className = "g-val";
    val.textContent = money(it.value);

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.value = it.growth;
    input.setAttribute("aria-label", `Yearly change for ${it.name}, percent`);
    input.addEventListener("change", () => {
      const g = parseFloat(input.value);
      if (!Number.isFinite(g)) { input.value = it.growth; return; }
      it.growth = g;
      persist();
      updateForecastOutputs();
    });

    const pct = document.createElement("span");
    pct.className = "g-val";
    pct.style.minWidth = "2rem";
    pct.textContent = "%/yr";

    row.append(name, val, input, pct);
    el.append(row);
  }
}

/* contributions list: amount + cadence per entry */
function renderContribList() {
  const el = document.getElementById("contrib-list");
  el.innerHTML = "";
  const items = forecastItems().sort((a, b) => {
    const ca = annualContrib(a), cb = annualContrib(b);
    if ((cb !== 0) - (ca !== 0)) return (cb !== 0) - (ca !== 0); // funded first
    return Math.abs(b.value) - Math.abs(a.value);
  });
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "contrib-row";

    const name = document.createElement("span");
    name.className = "c-name";
    name.textContent = it.name;

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.value = it.contrib ? it.contrib : "";
    input.placeholder = "0";
    input.setAttribute("aria-label", `Contribution amount for ${it.name}`);

    const sel = document.createElement("select");
    fillSelect(sel, FREQS.map(([k]) => [k, k]), it.contribFreq || "monthly");
    sel.setAttribute("aria-label", `Contribution frequency for ${it.name}`);

    input.addEventListener("change", () => {
      const c = parseFloat(String(input.value).replace(/[$,\s]/g, ""));
      it.contrib = Number.isFinite(c) ? c : 0;
      input.value = it.contrib ? it.contrib : "";
      persist();
      updateForecastOutputs();
    });
    sel.addEventListener("change", () => {
      it.contribFreq = sel.value;
      persist();
      updateForecastOutputs();
    });

    row.append(name, input, sel);
    el.append(row);
  }
}

/* what-if input wiring (elements are static, listeners attached once) */
document.getElementById("wi-amount").addEventListener("input", (e) => {
  const v = parseFloat(e.target.value);
  scenario.amount = Number.isFinite(v) && v > 0 ? v : 0;
  updateForecastOutputs();
});
document.getElementById("wi-from").addEventListener("change", (e) => {
  scenario.fromId = e.target.value;
  updateForecastOutputs();
});
document.getElementById("wi-to").addEventListener("change", (e) => {
  scenario.toId = e.target.value;
  updateForecastOutputs();
});

/* ── Expenses tab ───────────────────────────────────────────── */

const EXP_FREQS = [
  ["weekly",   "Weekly",        52 / 12],
  ["biweekly", "Every 2 weeks", 26 / 12],
  ["monthly",  "Monthly",       1],
  ["yearly",   "Yearly",        1 / 12],
];
const EXP_PER_MONTH = Object.fromEntries(EXP_FREQS.map(([k, , n]) => [k, n]));
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EXP_TYPES = [
  ["necessity", "Necessity"],
  ["discretionary", "Discretionary"],
  ["savings", "Savings"],
];

function expMonthly(e) {
  return (e.amount || 0) * (EXP_PER_MONTH[e.freq] ?? 1);
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function expTiming(e) {
  if (e.freq === "weekly") return e.when != null ? WEEKDAYS[e.when] + "s" : "Weekly";
  if (e.freq === "biweekly") return e.when != null ? "Every other " + WEEKDAYS[e.when] : "Every 2 weeks";
  if (e.freq === "yearly") return e.when ? "Yearly, " + ordinal(e.when) : "Yearly";
  return e.when ? "Monthly, " + ordinal(e.when) : "Monthly";
}

function parseLocalDate(str) {
  if (!str) return null;
  const d = new Date(str + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

/* dated occurrences of one expense within [start, end] inclusive (Date objs) */
function expenseOccurrences(e, start, end) {
  const out = [];
  if (!start || !end || end < start) return out;
  if (e.freq === "weekly") {
    if (e.when == null) return out;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
      if (d.getDay() === Number(e.when)) out.push({ date: new Date(d), amount: e.amount });
  } else if (e.freq === "biweekly") {
    if (e.when == null) return out;
    let n = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
      if (d.getDay() === Number(e.when)) { if (n % 2 === 0) out.push({ date: new Date(d), amount: e.amount }); n++; }
  } else if (e.freq === "monthly") {
    if (!e.when) return out;
    let y = start.getFullYear(), m = start.getMonth();
    while (true) {
      const dim = new Date(y, m + 1, 0).getDate();
      const dt = new Date(y, m, Math.min(e.when, dim), 12);
      if (dt > end) break;
      if (dt >= start) out.push({ date: dt, amount: e.amount });
      m++; if (m > 11) { m = 0; y++; }
    }
  }
  // yearly has no month stored → not placed in a cash-flow window
  return out;
}

function expenseAccounts() {
  const set = new Set();
  for (const e of state.expenses) if (e.account && e.account.trim()) set.add(e.account.trim());
  for (const inc of state.income) if (inc.account && inc.account.trim()) set.add(inc.account.trim());
  return [...set].sort((a, b) => a.localeCompare(b));
}

/* paydays for one income source within [start, end] inclusive */
function incomeOccurrences(inc, start, end) {
  const out = [];
  const amt = inc.amount || 0;
  if (inc.freq === "biweekly") {
    const anchor = parseLocalDate(inc.anchor);
    if (!anchor) return out;
    let d = new Date(anchor);
    while (d > start) d = addDays(d, -14);
    while (d < start) d = addDays(d, 14);
    for (; d <= end; d = addDays(d, 14)) out.push({ date: new Date(d), amount: amt });
  } else if (inc.freq === "weekly") {
    const wd = Number(inc.weekday);
    for (let x = new Date(start); x <= end; x = addDays(x, 1))
      if (x.getDay() === wd) out.push({ date: new Date(x), amount: amt });
  } else if (inc.freq === "monthly") {
    let y = start.getFullYear(), m = start.getMonth();
    const day = inc.day || 1;
    while (true) {
      const dim = new Date(y, m + 1, 0).getDate();
      const dt = new Date(y, m, Math.min(day, dim), 12);
      if (dt > end) break;
      if (dt >= start) out.push({ date: dt, amount: amt });
      m++; if (m > 11) { m = 0; y++; }
    }
  }
  return out;
}

/* Draw down the account across the window: no paycheck lands mid-window —
   the point is how much of your CURRENT balance to leave until next pay.
   Returns each required bill with the running balance after it. */
function drawDownWindow(requiredBills, startBalance) {
  const rows = [...requiredBills].sort((a, b) => a.date - b.date);
  let bal = startBalance;
  let low = { bal: startBalance, date: null };
  for (const r of rows) {
    bal -= r.amount;
    r.balance = bal;
    if (bal < low.bal) low = { bal, date: r.date };
  }
  return { rows, endBal: bal, low };
}

/* Next pay period's required outflow (bills paid in that period, including
   ones deferred into it from now). Income amounts aren't assumed — it tells
   you how much your NEXT paycheck needs to cover. */
function nextPeriodOutflow(start, end, account) {
  const acct = (x) => !account || (x.account || "") === account;
  const paydays = [];
  for (const inc of state.income) {
    if (!acct(inc)) continue;
    for (const o of incomeOccurrences(inc, start, addDays(end, 160))) paydays.push(o.date);
  }
  paydays.sort((a, b) => a - b);
  const after = paydays.filter((d) => d > start);
  if (!after.length) return null;
  const nextStart = after[0];
  const following = after.find((d) => d > nextStart);
  const nextEnd = addDays(following || addDays(nextStart, 14), -1);

  let required = 0, deferredIn = 0;
  const bills = [];
  for (const e of state.expenses) {
    if (!acct(e)) continue;
    for (const occ of expenseOccurrences(e, start, nextEnd)) {
      const grace = e.grace || 0;
      const deadline = grace > 0 ? addDays(occ.date, grace) : occ.date;
      const eligible = grace > 0 && deadline > end;
      let payDate = occ.date;
      if (eligible) {
        const p = paydays.find((d) => d > occ.date && d <= deadline);
        payDate = p ? new Date(p) : deadline;
      }
      if (payDate >= nextStart && payDate <= nextEnd) {
        required += occ.amount;
        if (eligible) deferredIn += occ.amount;
        bills.push({ name: e.name, date: payDate, amount: occ.amount, deferred: eligible });
      }
    }
  }
  bills.sort((a, b) => a.date - b.date);
  return { nextStart, nextEnd, required, deferredIn, bills };
}

const fmtDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

function renderExpenses() {
  const dl = document.getElementById("account-suggestions");
  dl.innerHTML = "";
  for (const a of expenseAccounts()) {
    const o = document.createElement("option");
    o.value = a;
    dl.append(o);
  }
  document.getElementById("retire-swr").value = state.settings.withdrawalRate;
  document.getElementById("retire-basis").value = state.expensesView.basis || "full";
  document.getElementById("exp-income").value = state.settings.monthlyIncome || "";
  document.getElementById("cf-balance").value = state.expensesView.startBalance || "";
  document.getElementById("cf-floor").value = state.expensesView.floor || "";
  renderIncomeList();
  renderCashflow();
  renderExpenseSummary();
  renderRetirePicker();
  renderRetirement();
  renderExpenseList();
}

/* ── cash-flow window planner ── */
function renderCashflow() {
  const v = state.expensesView;
  const startEl = document.getElementById("cf-start");
  const endEl = document.getElementById("cf-end");
  const acctEl = document.getElementById("cf-account");

  if (!v.start || !v.end) {
    const today = new Date();
    const plus14 = new Date(); plus14.setDate(today.getDate() + 14);
    v.start = v.start || today.toISOString().slice(0, 10);
    v.end = v.end || plus14.toISOString().slice(0, 10);
  }
  startEl.value = v.start;
  endEl.value = v.end;
  fillSelect(acctEl, [["", "All accounts"]].concat(expenseAccounts().map((a) => [a, a])), v.account);

  updateCashflow();
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function updateCashflow() {
  const v = state.expensesView;
  const start = parseLocalDate(v.start);
  const end = parseLocalDate(v.end);
  const out = document.getElementById("cashflow-results");

  if (!start || !end || end < start) {
    out.innerHTML = `<p class="empty-note">Pick a start date and a later end date.</p>`;
    return;
  }

  const useGrace = v.useGrace !== false;

  /* every occurrence in the window, flagged if its grace lets it wait past end */
  const all = [];
  for (const e of state.expenses) {
    if (v.account && (e.account || "") !== v.account) continue;
    for (const occ of expenseOccurrences(e, start, end)) {
      const grace = e.grace || 0;
      const deadline = grace > 0 ? addDays(occ.date, grace) : occ.date;
      all.push({
        date: occ.date, name: e.name, account: e.account || "—",
        amount: occ.amount, grace, deadline, canDefer: grace > 0 && deadline > end,
      });
    }
  }

  const deferable = all.filter((r) => r.canDefer);
  const deferred = useGrace ? deferable : [];
  const required = useGrace ? all.filter((r) => !r.canDefer) : all;

  required.sort((a, b) => a.date - b.date);
  deferred.sort((a, b) => a.deadline - b.deadline);

  const byAccount = {};
  for (const r of required) byAccount[r.account] = (byAccount[r.account] || 0) + r.amount;

  const total = required.reduce((a, r) => a + r.amount, 0);
  const payAll = all.reduce((a, r) => a + r.amount, 0);
  const deferSum = deferable.reduce((a, r) => a + r.amount, 0);
  const days = Math.round((end - start) / 86400000) + 1;
  const acctLabel = v.account ? v.account : "all accounts";

  let html = `<div class="cashflow-headline">
    <span class="cf-total">${money(total)}</span>
    <span class="cf-cap">to cover from ${esc(fmtDate.format(start))} through
    ${esc(fmtDate.format(end))} (${days} days) in <strong>${esc(acctLabel)}</strong>${
      useGrace && deferred.length ? ` &mdash; deferring ${money(deferSum)} to your next pay` : ""
    }</span>
  </div>`;

  /* grace-period callout: auto-noticed deferrable bills + the toggle */
  if (deferable.length) {
    html += `<div class="grace-callout">
      <div class="grace-head">Grace period available</div>
      <p class="grace-lead">${deferable.length} bill${deferable.length > 1 ? "s" : ""} due in this
      window ${deferable.length > 1 ? "have" : "has"} a grace period that runs past
      ${esc(fmtDate.format(end))}, so ${deferable.length > 1 ? "they" : "it"} can wait for your next paycheck:</p>
      <ul class="grace-list">`;
    for (const r of deferable) {
      html += `<li><strong>${esc(r.name)}</strong> ${esc(money(r.amount))} &mdash; due
        ${esc(fmtDate.format(r.date))}, safe until <strong>${esc(fmtDate.format(r.deadline))}</strong></li>`;
    }
    html += `</ul>
      <div class="grace-options">
        <span>Pay it all now: <strong>${esc(money(payAll))}</strong></span>
        <span>Defer eligible: keep <strong>${esc(money(payAll - deferSum))}</strong> now,
        ${esc(money(deferSum))} waits</span>
      </div>
      <label class="grace-toggle">
        <input type="checkbox" id="cf-grace" ${useGrace ? "checked" : ""}>
        Defer eligible bills to my next pay
      </label>
    </div>`;
  }

  /* ── leave vs. sweep: how much to keep until next pay, invest the rest ── */
  const floor = v.floor || 0;
  const balanceNow = v.startBalance || 0;
  const reserve = total + floor;                 // bills to cover (deferred excluded) + floor
  const acctName = v.account || "the account";

  html += `<h2 class="section-label">Leave vs. sweep</h2>`;
  if (balanceNow > 0) {
    const sweep = balanceNow - reserve;
    if (sweep >= 0) {
      html += `<div class="verdict verdict-good">
        <strong>Leave ${money(reserve)}, sweep ${money(sweep)}.</strong>
        ${money(total)} of bills clear before ${esc(fmtDate.format(end))}${
          floor ? ` and you keep your ${money(floor)} floor` : ""
        }; with ${money(balanceNow)} in ${esc(acctName)} that frees
        <strong>${money(sweep)}</strong> to save/invest now.</div>`;
    } else {
      html += `<div class="verdict verdict-bad">
        <strong>You're ${money(-sweep)} short.</strong> These bills need ${money(reserve)}
        but ${esc(acctName)} holds ${money(balanceNow)}. Don't sweep &mdash; ${
          !useGrace && deferable.length ? `turn on defer to free ${money(deferSum)} of room, or ` : ""
        }move cash in.</div>`;
    }
  } else {
    html += `<div class="verdict verdict-good">
      <strong>Leave ${money(reserve)} in ${esc(acctName)}</strong> to cover every bill through
      ${esc(fmtDate.format(end))}${floor ? ` plus your ${money(floor)} floor` : ""}. Everything above
      that is free to invest. Enter your ${esc(acctName)} balance above to see the exact sweep amount.</div>`;
  }

  /* draw-down: current balance minus the bills, day by day (no paycheck mid-window) */
  if (balanceNow > 0 && required.length) {
    const dd = drawDownWindow(required, balanceNow);
    html += `<table class="snap-table balance-table"><thead><tr>
      <th scope="col">Date</th><th scope="col">Bill</th>
      <th scope="col">Out</th><th scope="col">Balance</th></tr></thead><tbody>`;
    html += `<tr class="bal-start"><td>${esc(fmtDate.format(start))}</td>` +
      `<td>Balance now</td><td class="num"></td>` +
      `<td class="num">${esc(money(balanceNow))}</td></tr>`;
    for (const r of dd.rows) {
      const low = r.balance < floor;
      html += `<tr class="${low ? "bal-low" : ""}">` +
        `<td>${esc(fmtDate.format(r.date))}</td><td>${esc(r.name)}</td>` +
        `<td class="num">−${esc(moneyAbs(r.amount))}</td>` +
        `<td class="num">${r.balance < 0 ? "−" : ""}${esc(moneyAbs(r.balance))}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  /* next pay period: how much your NEXT paycheck needs to cover (incl. deferrals) */
  const np = nextPeriodOutflow(start, end, v.account);
  if (np && np.required > 0) {
    html += `<h2 class="section-label">Next pay period</h2>
      <div class="verdict verdict-warn">
        <strong>${esc(fmtDate.format(np.nextStart))} – ${esc(fmtDate.format(np.nextEnd))}:</strong>
        ${money(np.required)} in bills to clear${
          np.deferredIn > 0 ? `, including the deferred ${money(np.deferredIn)} mortgage that lands here` : ""
        }. Your ${esc(fmtDate.format(np.nextStart))} paycheck needs to cover at least
        ${money(np.required + floor)}${floor ? " (bills + floor)" : ""} before you sweep again.</div>
      <details class="next-period-details"><summary>See next period's bills</summary>
      <table class="snap-table"><thead><tr>
        <th scope="col">Date</th><th scope="col">Bill</th><th scope="col">Amount</th></tr></thead><tbody>`;
    for (const b of np.bills) {
      html += `<tr><td>${esc(fmtDate.format(b.date))}</td>` +
        `<td>${esc(b.name)}${b.deferred ? ' <span class="muted">(deferred in)</span>' : ""}</td>` +
        `<td class="num">${esc(money(b.amount))}</td></tr>`;
    }
    html += `</tbody></table></details>`;
  }

  if (!v.account && Object.keys(byAccount).length > 1) {
    html += `<div class="insight-grid">`;
    for (const [acct, amt] of Object.entries(byAccount).sort((a, b) => b[1] - a[1]))
      html += tile(acct, money(amt), "keep this in " + acct);
    html += `</div>`;
  }

  if (!required.length && !deferred.length) {
    html += `<p class="empty-note">Nothing scheduled falls in this window.
    (Undated expenses aren't placed on the calendar — give them a day to see them here.)</p>`;
  } else if (required.length) {
    html += `<table class="snap-table"><thead><tr>
      <th scope="col">Date</th><th scope="col">Expense</th>
      <th scope="col">Account</th><th scope="col">Amount</th></tr></thead><tbody>`;
    for (const r of required) {
      html += `<tr><td>${esc(fmtDate.format(r.date))}</td><td>${esc(r.name)}</td>` +
        `<td>${esc(r.account)}</td><td class="num">${esc(money(r.amount))}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  if (deferred.length) {
    html += `<h2 class="section-label">Can wait until next pay</h2>
      <table class="snap-table"><thead><tr>
      <th scope="col">Due</th><th scope="col">Expense</th>
      <th scope="col">Safe until</th><th scope="col">Amount</th></tr></thead><tbody>`;
    for (const r of deferred) {
      html += `<tr><td>${esc(fmtDate.format(r.date))}</td><td>${esc(r.name)}</td>` +
        `<td>${esc(fmtDate.format(r.deadline))}</td><td class="num">${esc(money(r.amount))}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  out.innerHTML = html;

  const graceToggle = document.getElementById("cf-grace");
  if (graceToggle) graceToggle.addEventListener("change", (e) => {
    state.expensesView.useGrace = e.target.checked;
    persist();
    updateCashflow();
  });
}

/* ── monthly summary ── */
function expenseTotalsByType() {
  const by = { necessity: 0, discretionary: 0, savings: 0 };
  for (const e of state.expenses) by[e.type] = (by[e.type] || 0) + expMonthly(e);
  return by;
}

function renderExpenseSummary() {
  const el = document.getElementById("expense-summary");
  const by = expenseTotalsByType();
  const total = by.necessity + by.discretionary + by.savings;
  const income = state.settings.monthlyIncome || 0;

  let html = `<div class="insight-grid">`;
  html += tile("Total / month", money(total), money(total * 12) + " per year");
  html += tile("Necessities", money(by.necessity));
  html += tile("Discretionary", money(by.discretionary));
  html += tile("Savings", money(by.savings), "contributions out");
  if (income > 0) {
    const surplus = income - total;
    html += tile("Take-home / month", money(income));
    html += tile(surplus < 0 ? "Shortfall" : "Left over", (surplus < 0 ? "− " : "") + moneyAbs(surplus),
      surplus < 0 ? "spending exceeds income" : "after everything above");
  }
  html += `</div>`;

  const owners = [...new Set(state.expenses.map((e) => e.owner))];
  if (owners.length > 1) {
    html += `<h2 class="section-label">By owner</h2><div class="insight-grid">`;
    for (const o of owners) {
      const sum = state.expenses.filter((e) => e.owner === o).reduce((a, e) => a + expMonthly(e), 0);
      html += tile(o, money(sum) + "/mo");
    }
    html += `</div>`;
  }
  el.innerHTML = html;
}

/* ── retirement ── */
function retirementItems() {
  return state.items.filter((it) => it.retirement && isForecastable(it));
}

function yearsToReach(target, list) {
  if (projectAt(list, 0) >= target) return 0;
  for (let mth = 1; mth <= 600; mth++) if (projectAt(list, mth / 12) >= target) return mth / 12;
  return null;
}

function renderRetirement() {
  const el = document.getElementById("retirement-body");
  const swr = (state.settings.withdrawalRate || 4) / 100;
  const by = expenseTotalsByType();
  const leanMo = by.necessity;
  const fullMo = by.necessity + by.discretionary;
  const lean = swr > 0 ? (leanMo * 12) / swr : 0;
  const full = swr > 0 ? (fullMo * 12) / swr : 0;
  const multiple = swr > 0 ? 1 / swr : 0;
  const retList = retirementItems();
  const retAssets = retList.reduce((a, it) => a + it.value, 0);
  const thisYear = new Date().getFullYear();

  const target = state.expensesView.basis === "lean" ? lean : full;
  const targetMo = state.expensesView.basis === "lean" ? leanMo : fullMo;
  const pct = target > 0 ? Math.min(1, retAssets / target) : 0;
  const yrs = yearsToReach(target, retList);

  let html = `<p class="fine-print">A ${state.settings.withdrawalRate}% withdrawal rate means your
  nest egg needs to be about <strong>${multiple.toFixed(0)}×</strong> your yearly expenses.
  Savings contributions are excluded (you stop saving once retired). Progress and years-to-reach
  use only the assets you mark below.</p>`;

  html += `<div class="insight-grid">`;
  html += tile("Lean number", money(lean), `covers necessities (${money(leanMo)}/mo)`);
  html += tile("Full number", money(full), `necessities + discretionary (${money(fullMo)}/mo)`);
  html += tile("Retirement assets", money(retAssets), pctLabel(pct) + " of the " +
    (state.expensesView.basis === "lean" ? "lean" : "full") + " number");
  html += tile(yrs === null ? "Years to target" : "On track for",
    yrs === null ? "50+ yrs" : (yrs === 0 ? "there now" : `${Math.round(thisYear + yrs)}`),
    yrs === null ? "add assets, growth or contributions" :
      (yrs === 0 ? "already funded" : `about ${yrs.toFixed(1)} years out`));
  html += `</div>`;

  el.innerHTML = html;

  /* progress bar toward the selected basis */
  const bar = document.getElementById("retire-progress");
  bar.style.width = (pct * 100).toFixed(1) + "%";
  document.getElementById("retire-progress-cap").textContent =
    `${money(retAssets)} of ${money(target)} (${(pct * 100).toFixed(0)}%) toward retiring on ` +
    `${money(targetMo)}/mo`;

  updateRetireSummary();
}

function pctLabel(p) { return (p * 100).toFixed(0) + "%"; }

function updateRetireSummary() {
  const all = forecastItems();
  const sel = all.filter((it) => it.retirement).length;
  const sum = document.querySelector("#retire-picker > summary");
  if (sum) sum.textContent = `Choose which assets fund retirement (${sel} of ${all.length})`;
}

/* checklist of growth assets to include in the retirement picture */
function renderRetirePicker() {
  const el = document.getElementById("retire-assets");
  el.innerHTML = "";
  const items = forecastItems().sort((a, b) => b.value - a.value);
  for (const it of items) {
    const row = document.createElement("label");
    row.className = "retire-pick-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!it.retirement;
    cb.addEventListener("change", () => {
      it.retirement = cb.checked;
      persist();
      renderRetirement();
    });
    const name = document.createElement("span");
    name.className = "rp-name";
    name.textContent = it.name;
    const val = document.createElement("span");
    val.className = "rp-val";
    val.textContent = money(it.value);
    row.append(cb, name, val);
    el.append(row);
  }
  updateRetireSummary();
}

/* ── expense list ── */
function renderExpenseList() {
  const el = document.getElementById("expense-list");
  el.innerHTML = "";
  if (!state.expenses.length) {
    el.innerHTML = `<p class="empty-note">No expenses yet. Add one above.</p>`;
    return;
  }
  const owners = [...new Set(state.expenses.map((e) => e.owner))];
  for (const owner of owners) {
    const items = state.expenses
      .filter((e) => e.owner === owner)
      .sort((a, b) => expMonthly(b) - expMonthly(a));
    if (!items.length) continue;

    const group = document.createElement("section");
    group.className = "ledger-group";
    const head = document.createElement("div");
    head.className = "ledger-group-head";
    const h2 = document.createElement("h2");
    h2.textContent = owner;
    const total = document.createElement("span");
    total.className = "group-total";
    total.textContent = money(items.reduce((a, e) => a + expMonthly(e), 0)) + "/mo";
    head.append(h2, total);
    group.append(head);

    for (const e of items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "expense-row";
      row.title = "Edit " + e.name;

      const main = document.createElement("span");
      main.className = "exp-main";
      const nm = document.createElement("span");
      nm.className = "exp-name";
      nm.textContent = e.name;
      const meta = document.createElement("span");
      meta.className = "exp-meta";
      meta.textContent = [expTiming(e), e.account, e.grace ? e.grace + "-day grace" : ""]
        .filter(Boolean).join(" · ");
      main.append(nm, meta);

      const badge = document.createElement("span");
      badge.className = "exp-type exp-type-" + e.type;
      badge.textContent = e.type[0].toUpperCase();
      badge.title = e.type;

      const amt = document.createElement("span");
      amt.className = "exp-amt";
      amt.textContent = money(expMonthly(e)) + "/mo";

      row.append(main, badge, amt);
      row.addEventListener("click", () => openExpenseDialog(e.id));
      group.append(row);
    }
    el.append(group);
  }
}

/* ── cash-flow + retirement controls (static elements, wired once) ── */
document.getElementById("cf-start").addEventListener("change", (e) => {
  state.expensesView.start = e.target.value; persist(); updateCashflow();
});
document.getElementById("cf-end").addEventListener("change", (e) => {
  state.expensesView.end = e.target.value; persist(); updateCashflow();
});
document.getElementById("cf-account").addEventListener("change", (e) => {
  state.expensesView.account = e.target.value; persist(); updateCashflow();
});
document.getElementById("retire-basis").addEventListener("change", (e) => {
  state.expensesView.basis = e.target.value; persist(); renderRetirement();
});
document.getElementById("retire-swr").addEventListener("change", (e) => {
  const v = parseFloat(e.target.value);
  if (Number.isFinite(v) && v > 0) { state.settings.withdrawalRate = v; persist(); renderRetirement(); }
  else e.target.value = state.settings.withdrawalRate;
});
document.getElementById("exp-income").addEventListener("change", (e) => {
  const v = parseFloat(String(e.target.value).replace(/[$,\s]/g, ""));
  state.settings.monthlyIncome = Number.isFinite(v) ? v : 0;
  persist(); renderExpenseSummary();
});

/* ── income list + dialog ── */
function incomeTiming(inc) {
  if (inc.freq === "biweekly") return "Every 2 weeks" + (inc.anchor ? ", " + fmtDate.format(parseLocalDate(inc.anchor)) : "");
  if (inc.freq === "weekly") return inc.weekday != null ? WEEKDAYS[inc.weekday] + "s" : "Weekly";
  if (inc.freq === "monthly") return inc.day ? "Monthly, " + ordinal(inc.day) : "Monthly";
  return inc.freq;
}

function renderIncomeList() {
  const el = document.getElementById("income-list");
  el.innerHTML = "";
  if (!state.income.length) {
    el.innerHTML = `<p class="empty-note">No paychecks yet. Add one so the projection knows your income.</p>`;
    return;
  }
  for (const inc of state.income) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "expense-row";
    row.title = "Edit " + inc.name;
    const main = document.createElement("span");
    main.className = "exp-main";
    const nm = document.createElement("span");
    nm.className = "exp-name";
    nm.textContent = inc.name;
    const meta = document.createElement("span");
    meta.className = "exp-meta";
    meta.textContent = [incomeTiming(inc), inc.account].filter(Boolean).join(" · ");
    main.append(nm, meta);
    const amt = document.createElement("span");
    amt.className = "exp-amt";
    amt.textContent = inc.amount ? "+" + money(inc.amount) : "varies";
    row.append(main, amt);
    row.addEventListener("click", () => openIncomeDialog(inc.id));
    el.append(row);
  }
}

const incomeDialog = document.getElementById("income-dialog");
const incomeForm = document.getElementById("income-form");
let editingIncomeId = null;

function syncIncomeWhen() {
  const freq = incomeForm.elements.freq.value;
  document.getElementById("inc-when-weekday").hidden = !(freq === "weekly" || freq === "biweekly");
  document.getElementById("inc-when-day").hidden = freq !== "monthly";
  document.getElementById("inc-anchor-wrap").hidden = freq !== "biweekly";
}

function openIncomeDialog(id) {
  editingIncomeId = id;
  const inc = id ? state.income.find((x) => x.id === id) : null;
  document.getElementById("income-dialog-title").textContent = inc ? "Edit paycheck" : "New paycheck";
  document.getElementById("income-delete-btn").style.visibility = inc ? "visible" : "hidden";
  incomeForm.elements.name.value = inc ? inc.name : "Paycheck";
  incomeForm.elements.amount.value = inc && inc.amount ? inc.amount : "";
  incomeForm.elements.freq.value = inc ? inc.freq : "biweekly";
  fillSelect(incomeForm.elements.weekday, WEEKDAYS.map((w, i) => [String(i), w]),
    inc && inc.weekday != null ? String(inc.weekday) : "3");
  incomeForm.elements.day.value = inc && inc.freq === "monthly" && inc.day ? inc.day : "";
  incomeForm.elements.anchor.value = inc && inc.anchor ? inc.anchor : "";
  incomeForm.elements.account.value = inc ? (inc.account || "") : "";
  fillSelect(incomeForm.elements.owner, state.owners.map((o) => [o, o]), inc ? inc.owner : state.owners[0]);
  syncIncomeWhen();
  incomeDialog.showModal();
}

incomeForm.elements.freq.addEventListener("change", syncIncomeWhen);
document.getElementById("add-income-btn").addEventListener("click", () => openIncomeDialog(null));
document.getElementById("income-cancel-btn").addEventListener("click", () => incomeDialog.close());
document.getElementById("income-delete-btn").addEventListener("click", () => {
  const inc = state.income.find((x) => x.id === editingIncomeId);
  if (!inc || !confirm(`Remove "${inc.name}"?`)) return;
  state.income = state.income.filter((x) => x.id !== editingIncomeId);
  persist(); incomeDialog.close(); renderExpenses();
});

incomeForm.addEventListener("submit", (ev) => {
  const amountRaw = parseFloat(String(incomeForm.elements.amount.value).replace(/[$,\s]/g, ""));
  const amount = Number.isFinite(amountRaw) ? amountRaw : null; // optional — income varies
  const name = incomeForm.elements.name.value.trim();
  if (!name) { ev.preventDefault(); return; }
  const freq = incomeForm.elements.freq.value;
  const data = {
    name, amount, freq,
    weekday: Number(incomeForm.elements.weekday.value),
    day: parseInt(incomeForm.elements.day.value, 10) || null,
    anchor: incomeForm.elements.anchor.value || "",
    account: incomeForm.elements.account.value.trim(),
    owner: incomeForm.elements.owner.value,
  };
  if (editingIncomeId) Object.assign(state.income.find((x) => x.id === editingIncomeId), data);
  else state.income.push({ id: uid(), ...data });
  persist(); renderExpenses();
});

/* planner: starting balance + safety floor (static inputs, wired once) */
document.getElementById("cf-balance").addEventListener("change", (e) => {
  const v = parseFloat(String(e.target.value).replace(/[$,\s]/g, ""));
  state.expensesView.startBalance = Number.isFinite(v) ? v : 0;
  persist(); updateCashflow();
});
document.getElementById("cf-floor").addEventListener("change", (e) => {
  const v = parseFloat(String(e.target.value).replace(/[$,\s]/g, ""));
  state.expensesView.floor = Number.isFinite(v) ? v : 0;
  persist(); updateCashflow();
});

/* ── expense dialog ── */
const expenseDialog = document.getElementById("expense-dialog");
const expenseForm = document.getElementById("expense-form");
let editingExpenseId = null;

function syncWhenField() {
  const freq = expenseForm.elements.freq.value;
  const weekly = freq === "weekly" || freq === "biweekly";
  document.getElementById("exp-when-weekday").hidden = !weekly;
  document.getElementById("exp-when-day").hidden = weekly;
}

function openExpenseDialog(id) {
  editingExpenseId = id;
  const e = id ? state.expenses.find((x) => x.id === id) : null;
  document.getElementById("expense-dialog-title").textContent = e ? "Edit expense" : "New expense";
  document.getElementById("expense-delete-btn").style.visibility = e ? "visible" : "hidden";

  expenseForm.elements.name.value = e ? e.name : "";
  expenseForm.elements.amount.value = e ? e.amount : "";
  expenseForm.elements.freq.value = e ? e.freq : "monthly";
  expenseForm.elements.type.value = e ? e.type : "necessity";
  fillSelect(expenseForm.elements.owner, state.owners.map((o) => [o, o]), e ? e.owner : state.owners[0]);
  fillSelect(expenseForm.elements.weekday,
    WEEKDAYS.map((w, i) => [String(i), w]), e && (e.freq === "weekly" || e.freq === "biweekly") ? String(e.when ?? 5) : "5");
  expenseForm.elements.dayOfMonth.value =
    e && e.freq !== "weekly" && e.freq !== "biweekly" && e.when ? e.when : "";
  expenseForm.elements.account.value = e ? (e.account || "") : "";
  expenseForm.elements.grace.value = e && e.grace ? e.grace : "";
  syncWhenField();
  expenseDialog.showModal();
}

expenseForm.elements.freq.addEventListener("change", syncWhenField);
document.getElementById("add-expense-btn").addEventListener("click", () => openExpenseDialog(null));
document.getElementById("expense-cancel-btn").addEventListener("click", () => expenseDialog.close());

document.getElementById("expense-delete-btn").addEventListener("click", () => {
  const e = state.expenses.find((x) => x.id === editingExpenseId);
  if (!e) return;
  if (!confirm(`Remove "${e.name}" from expenses?`)) return;
  state.expenses = state.expenses.filter((x) => x.id !== editingExpenseId);
  persist();
  expenseDialog.close();
  renderExpenses();
});

expenseForm.addEventListener("submit", (ev) => {
  const amount = parseFloat(String(expenseForm.elements.amount.value).replace(/[$,\s]/g, ""));
  const name = expenseForm.elements.name.value.trim();
  if (!name || !Number.isFinite(amount)) { ev.preventDefault(); return; }
  const freq = expenseForm.elements.freq.value;
  const weekly = freq === "weekly" || freq === "biweekly";
  let when;
  if (weekly) {
    when = Number(expenseForm.elements.weekday.value);
  } else {
    const d = parseInt(expenseForm.elements.dayOfMonth.value, 10);
    when = Number.isFinite(d) && d >= 1 && d <= 31 ? d : null;
  }
  const graceRaw = parseInt(expenseForm.elements.grace.value, 10);
  const data = {
    name, amount, freq, when,
    type: expenseForm.elements.type.value,
    owner: expenseForm.elements.owner.value,
    account: expenseForm.elements.account.value.trim(),
    grace: Number.isFinite(graceRaw) && graceRaw > 0 ? graceRaw : 0,
  };
  if (editingExpenseId) {
    Object.assign(state.expenses.find((x) => x.id === editingExpenseId), data);
  } else {
    state.expenses.push({ id: uid(), ...data });
  }
  persist();
  renderExpenses();
});

/* ── History tab ────────────────────────────────────────────── */

function renderHistory() {
  renderChart();
  renderSnapshotTable();
}

function renderSnapshotTable() {
  const el = document.getElementById("snapshot-table");
  const snaps = [...state.snapshots].sort((a, b) => b.date.localeCompare(a.date));
  if (!snaps.length) {
    el.innerHTML = `<p class="empty-note">No snapshots yet.</p>`;
    return;
  }
  const table = document.createElement("table");
  table.className = "snap-table";
  table.innerHTML = `<thead><tr>
    <th scope="col">Date</th><th scope="col">Net worth</th>
    <th scope="col">Assets</th><th scope="col">Debts</th>
    <th scope="col">Note</th><th scope="col"></th></tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const s of snaps) {
    const tr = document.createElement("tr");
    const cells = [
      ["", s.date],
      ["num", money(s.netWorth)],
      ["num", money(s.assets)],
      ["num negative", moneyAbs(s.debts)],
      ["snap-note", s.note || ""],
    ];
    for (const [cls, text] of cells) {
      const td = document.createElement("td");
      td.className = cls;
      td.textContent = text;
      tr.append(td);
    }
    const tdDel = document.createElement("td");
    const del = document.createElement("button");
    del.className = "del-snap";
    del.title = "Delete snapshot";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      if (!confirm(`Delete the ${s.date} snapshot?`)) return;
      state.snapshots = state.snapshots.filter((x) => x.id !== s.id);
      persist();
      renderAll();
    });
    tdDel.append(del);
    tr.append(tdDel);
    tbody.append(tr);
  }
  table.append(tbody);
  el.innerHTML = "";
  el.append(table);
}

/* single-series ink line: net worth over time, crosshair + tooltip */
function renderChart() {
  const wrap = document.getElementById("chart-wrap");
  const tip = document.getElementById("chart-tooltip");
  wrap.innerHTML = "";
  tip.hidden = true;

  const snaps = [...state.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (snaps.length < 2) {
    wrap.innerHTML = `<p class="empty-note">${
      snaps.length === 1
        ? "One point so far — record another snapshot and a line appears."
        : "Record snapshots to draw your story here."
    }</p>`;
    return;
  }

  const W = 640, H = 260;
  const pad = { top: 18, right: 16, bottom: 28, left: 62 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const xs = snaps.map((s) => new Date(s.date + "T12:00:00").getTime());
  const ys = snaps.map((s) => s.netWorth);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPadding = (yMax - yMin) * 0.08;
  yMin -= yPadding; yMax += yPadding;

  const X = (t) => pad.left + ((t - xMin) / (xMax - xMin || 1)) * iw;
  const Y = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * ih;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label",
    `Net worth over time, from ${money(ys[0])} on ${snaps[0].date} to ${money(ys[ys.length - 1])} on ${snaps[snaps.length - 1].date}. Full data in the table below.`);

  const css = getComputedStyle(document.body);
  const ink = css.getPropertyValue("--ink").trim();
  const inkFaint = css.getPropertyValue("--ink-faint").trim();
  const hairline = css.getPropertyValue("--hairline-soft").trim();
  const paper = css.getPropertyValue("--paper").trim();

  const mk = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  /* recessive dotted grid: 4 y-ticks */
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + ((yMax - yMin) * i) / ticks;
    const y = Y(v);
    svg.append(mk("line", {
      x1: pad.left, x2: W - pad.right, y1: y, y2: y,
      stroke: hairline, "stroke-width": 1, "stroke-dasharray": "1 4",
    }));
    const label = mk("text", {
      x: pad.left - 8, y: y + 3, "text-anchor": "end",
      "font-size": 10, fill: inkFaint, "font-family": "inherit",
    });
    label.textContent = compactMoney(v);
    svg.append(label);
  }

  /* x labels: first & last */
  for (const idx of [0, snaps.length - 1]) {
    const label = mk("text", {
      x: X(xs[idx]), y: H - 8,
      "text-anchor": idx === 0 ? "start" : "end",
      "font-size": 10, fill: inkFaint, "font-family": "inherit",
    });
    label.textContent = snaps[idx].date;
    svg.append(label);
  }

  /* the line + soft area beneath */
  const pts = xs.map((t, i) => [X(t), Y(ys[i])]);
  const lineD = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const baseY = Y(Math.max(yMin, Math.min(0, yMax)));
  svg.append(mk("path", {
    d: `${lineD} L${pts[pts.length - 1][0].toFixed(1)},${baseY} L${pts[0][0].toFixed(1)},${baseY} Z`,
    fill: ink, "fill-opacity": 0.06, stroke: "none",
  }));
  svg.append(mk("path", {
    d: lineD, fill: "none", stroke: ink,
    "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round",
  }));

  /* point markers with paper ring */
  for (const [x, y] of pts) {
    svg.append(mk("circle", { cx: x, cy: y, r: 4, fill: ink, stroke: paper, "stroke-width": 2 }));
  }

  /* direct label on the latest point */
  const last = pts[pts.length - 1];
  const lastLabel = mk("text", {
    x: Math.min(last[0], W - pad.right) - 2, y: Math.max(last[1] - 10, 12),
    "text-anchor": "end", "font-size": 11, fill: ink,
    "font-family": "inherit", "font-weight": "600",
  });
  lastLabel.textContent = money(ys[ys.length - 1]);
  svg.append(lastLabel);

  /* crosshair + tooltip hover layer */
  const crosshair = mk("line", {
    x1: 0, x2: 0, y1: pad.top, y2: H - pad.bottom,
    stroke: inkFaint, "stroke-width": 1, "stroke-dasharray": "2 3", visibility: "hidden",
  });
  svg.append(crosshair);
  const halo = mk("circle", { r: 6, fill: "none", stroke: ink, "stroke-width": 1.5, visibility: "hidden" });
  svg.append(halo);

  const overlay = mk("rect", {
    x: pad.left, y: pad.top, width: iw, height: ih, fill: "transparent",
  });
  overlay.style.cursor = "crosshair";
  svg.append(overlay);

  function nearest(clientX) {
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0, bestD = Infinity;
    pts.forEach(([x], i) => {
      const d = Math.abs(x - px);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }
  function showHover(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const i = nearest(clientX);
    const [x, y] = pts[i];
    crosshair.setAttribute("x1", x); crosshair.setAttribute("x2", x);
    crosshair.setAttribute("visibility", "visible");
    halo.setAttribute("cx", x); halo.setAttribute("cy", y);
    halo.setAttribute("visibility", "visible");
    const s = snaps[i];
    tip.innerHTML = `<strong>${esc(s.date)}</strong><br>${esc(money(s.netWorth))}` +
      (s.note ? `<br><span style="opacity:.75">${esc(s.note)}</span>` : "");
    const rect = svg.getBoundingClientRect();
    tip.style.left = rect.left + (x / W) * rect.width + "px";
    tip.style.top = rect.top + (y / H) * rect.height + "px";
    tip.hidden = false;
  }
  function hideHover() {
    crosshair.setAttribute("visibility", "hidden");
    halo.setAttribute("visibility", "hidden");
    tip.hidden = true;
  }
  overlay.addEventListener("mousemove", showHover);
  overlay.addEventListener("touchstart", showHover, { passive: true });
  overlay.addEventListener("touchmove", showHover, { passive: true });
  overlay.addEventListener("mouseleave", hideHover);
  overlay.addEventListener("touchend", hideHover);

  wrap.append(svg);
}

function compactMoney(v) {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return sign + "$" + Math.round(a / 1e3) + "k";
  return sign + "$" + Math.round(a);
}

/* ── Settings tab ───────────────────────────────────────────── */

const SETTING_DEFS = [
  ["monthlyExpenses", "Monthly expenses ($)", "Necessities with buffer — drives months of runway."],
  ["helocLimit", "HELOC limit ($)", "Total credit line; headroom = limit − drawn balance."],
  ["retirementPct", "Retirement haircut (%)", "Share of retirement funds counted as reachable liquidity."],
  ["defiApr", "DeFi borrow APR (%)", "Interest rate on your DeFi loan."],
  ["defiStables", "DeFi stables balance ($)", "Stablecoins held against the DeFi debt."],
];

function renderSettings() {
  const form = document.getElementById("settings-form");
  form.innerHTML = "";
  for (const [key, label, help] of SETTING_DEFS) {
    const lab = document.createElement("label");
    lab.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = state.settings[key];
    input.addEventListener("change", () => {
      const v = parseFloat(input.value);
      if (!Number.isFinite(v)) { input.value = state.settings[key]; return; }
      state.settings[key] = v;
      persist();
      renderHero();
    });
    const helpEl = document.createElement("span");
    helpEl.className = "setting-help";
    helpEl.textContent = help;
    lab.append(input, helpEl);
    form.append(lab);
  }

  renderCategoryList();
  renderOwnerList();
}

function renderCategoryList() {
  const el = document.getElementById("category-list");
  el.innerHTML = "";
  state.categories.forEach((cat, idx) => {
    const row = document.createElement("div");
    row.className = "tag-list-row";

    const up = moveBtn("↑", idx > 0, () => {
      [state.categories[idx - 1], state.categories[idx]] =
        [state.categories[idx], state.categories[idx - 1]];
      persist(); renderAll();
    });
    const down = moveBtn("↓", idx < state.categories.length - 1, () => {
      [state.categories[idx + 1], state.categories[idx]] =
        [state.categories[idx], state.categories[idx + 1]];
      persist(); renderAll();
    });

    const input = document.createElement("input");
    input.value = cat.name;
    input.addEventListener("change", () => {
      cat.name = input.value.trim() || cat.name;
      input.value = cat.name;
      persist(); renderHero();
    });

    const count = state.items.filter((i) => i.categoryId === cat.id).length;
    const countEl = document.createElement("span");
    countEl.className = "row-count";
    countEl.textContent = count ? `${count} entr${count === 1 ? "y" : "ies"}` : "empty";

    const del = document.createElement("button");
    del.className = "row-del";
    del.title = "Delete category";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      if (count && !confirm(`"${cat.name}" holds ${count} entr${count === 1 ? "y" : "ies"}. Delete anyway? (Entries keep their data; re-shelve them from the Ledger.)`)) return;
      state.categories = state.categories.filter((c) => c.id !== cat.id);
      persist(); renderAll();
    });

    row.append(up, down, input, countEl, del);
    el.append(row);
  });
}

function moveBtn(glyph, enabled, fn) {
  const b = document.createElement("button");
  b.className = "row-move";
  b.textContent = glyph;
  b.disabled = !enabled;
  if (!enabled) b.style.visibility = "hidden";
  b.addEventListener("click", fn);
  return b;
}

function renderOwnerList() {
  const el = document.getElementById("owner-list");
  el.innerHTML = "";
  state.owners.forEach((owner) => {
    const row = document.createElement("div");
    row.className = "tag-list-row";

    const input = document.createElement("input");
    input.value = owner;
    input.addEventListener("change", () => {
      const next = input.value.trim();
      if (!next || state.owners.includes(next)) { input.value = owner; return; }
      state.items.forEach((i) => { if (i.owner === owner) i.owner = next; });
      state.owners = state.owners.map((o) => (o === owner ? next : o));
      persist(); renderAll();
    });

    const count = state.items.filter((i) => i.owner === owner).length;
    const countEl = document.createElement("span");
    countEl.className = "row-count";
    countEl.textContent = count ? `${count} entr${count === 1 ? "y" : "ies"}` : "unused";

    const del = document.createElement("button");
    del.className = "row-del";
    del.title = "Delete owner";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      if (count) { alert(`"${owner}" still owns ${count} entr${count === 1 ? "y" : "ies"} — reassign them first.`); return; }
      state.owners = state.owners.filter((o) => o !== owner);
      persist(); renderAll();
    });

    row.append(input, countEl, del);
    el.append(row);
  });
}

document.getElementById("add-category-btn").addEventListener("click", () => {
  const name = prompt("Name the new category:");
  if (!name || !name.trim()) return;
  state.categories.push({ id: uid(), name: name.trim() });
  persist(); renderAll();
});

document.getElementById("add-owner-btn").addEventListener("click", () => {
  const name = prompt("Name the new owner:");
  if (!name || !name.trim() || state.owners.includes(name.trim())) return;
  state.owners.push(name.trim());
  persist(); renderAll();
});

/* export / import / reset */

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ledger-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("import-btn").addEventListener("click", () =>
  document.getElementById("import-file").click()
);
document.getElementById("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!s || s.version !== 1 || !Array.isArray(s.items)) throw new Error("bad shape");
      if (!confirm("Replace everything in this browser with the imported file?")) return;
      state = s;
      persist();
      applyTheme();
      renderAll();
    } catch (_) {
      alert("That file doesn't look like a Ledger export.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (!confirm("Throw away all changes and restore the original spreadsheet data?")) return;
  state = seedState();
  persist();
  applyTheme();
  renderAll();
});

/* ── Item dialog ────────────────────────────────────────────── */

const itemDialog = document.getElementById("item-dialog");
const itemForm = document.getElementById("item-form");
let editingId = null;

function fillSelect(select, options, value) {
  select.innerHTML = "";
  for (const [val, label] of options) {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = label;
    select.append(o);
  }
  select.value = value;
}

function openItemDialog(id) {
  editingId = id;
  const it = id ? state.items.find((x) => x.id === id) : null;
  document.getElementById("item-dialog-title").textContent = it ? "Edit entry" : "New entry";
  document.getElementById("item-delete-btn").style.visibility = it ? "visible" : "hidden";

  itemForm.elements.name.value = it ? it.name : "";
  itemForm.elements.value.value = it ? it.value : "";
  fillSelect(
    itemForm.elements.categoryId,
    state.categories.map((c) => [c.id, c.name]),
    it ? it.categoryId : state.categories[0] && state.categories[0].id
  );
  fillSelect(
    itemForm.elements.owner,
    state.owners.map((o) => [o, o]),
    it ? it.owner : state.owners[0]
  );
  itemForm.elements.liquidity.value = it ? it.liquidity : "liquid";
  itemForm.elements.role.value = it ? it.role : "";
  itemForm.elements.growth.value = it ? it.growth : "";
  itemForm.elements.apr.value = it && it.apr ? it.apr : "";
  itemForm.elements.contrib.value = it && it.contrib ? it.contrib : "";
  itemForm.elements.contribFreq.value = it && it.contribFreq ? it.contribFreq : "monthly";

  itemDialog.showModal();
}

document.getElementById("add-item-btn").addEventListener("click", () => openItemDialog(null));
document.getElementById("item-cancel-btn").addEventListener("click", () => itemDialog.close());

document.getElementById("item-delete-btn").addEventListener("click", () => {
  const it = state.items.find((x) => x.id === editingId);
  if (!it) return;
  if (!confirm(`Strike "${it.name}" from the ledger?`)) return;
  state.items = state.items.filter((x) => x.id !== editingId);
  persist();
  itemDialog.close();
  renderAll();
});

itemForm.addEventListener("submit", (e) => {
  const value = parseFloat(String(itemForm.elements.value.value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(value)) {
    e.preventDefault();
    itemForm.elements.value.focus();
    return;
  }
  const growth = parseFloat(String(itemForm.elements.growth.value).replace(/[%\s]/g, ""));
  const apr = parseFloat(String(itemForm.elements.apr.value).replace(/[%\s]/g, ""));
  const contrib = parseFloat(String(itemForm.elements.contrib.value).replace(/[$,\s]/g, ""));
  const data = {
    name: itemForm.elements.name.value.trim(),
    value,
    categoryId: itemForm.elements.categoryId.value,
    owner: itemForm.elements.owner.value,
    liquidity: itemForm.elements.liquidity.value,
    role: itemForm.elements.role.value,
    growth: Number.isFinite(growth) ? growth : 0,
    apr: Number.isFinite(apr) ? apr : 0,
    contrib: Number.isFinite(contrib) ? contrib : 0,
    contribFreq: itemForm.elements.contribFreq.value,
  };
  if (!data.name) { e.preventDefault(); return; }
  if (editingId) {
    Object.assign(state.items.find((x) => x.id === editingId), data);
  } else {
    state.items.push({ id: uid(), ...data });
  }
  persist();
  renderAll();
});

/* ── Snapshot dialog ────────────────────────────────────────── */

const snapDialog = document.getElementById("snapshot-dialog");
const snapForm = document.getElementById("snapshot-form");

document.getElementById("snapshot-btn").addEventListener("click", () => {
  snapForm.elements.date.value = new Date().toISOString().slice(0, 10);
  snapForm.elements.note.value = "";
  snapDialog.showModal();
});
document.getElementById("snapshot-cancel-btn").addEventListener("click", () => snapDialog.close());

snapForm.addEventListener("submit", () => {
  const t = totals();
  const date = snapForm.elements.date.value;
  const note = snapForm.elements.note.value.trim();
  const existing = state.snapshots.find((s) => s.date === date);
  const snap = { id: existing ? existing.id : uid(), date, note, netWorth: t.net, assets: t.assets, debts: t.debts };
  if (existing) Object.assign(existing, snap);
  else state.snapshots.push(snap);
  persist();
  renderAll();
});

/* ── Theme ──────────────────────────────────────────────────── */

function applyTheme() {
  document.body.classList.toggle("night", state.theme === "night");
  document.getElementById("theme-toggle").textContent =
    state.theme === "night" ? "☀" : "☾";
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  state.theme = state.theme === "night" ? "paper" : "night";
  persist();
  applyTheme();
  renderChart(); // chart colors are sampled from CSS variables
  updateForecastOutputs();
});

/* ── Boot ───────────────────────────────────────────────────── */

function renderAll() {
  renderHero();
  renderLedger();
  renderAdvisor();
  renderInsights();
  renderForecast();
  renderContribList();
  renderGrowthList();
  renderExpenses();
  renderHistory();
  renderSettings();
}

applyTheme();
renderAll();

/* PWA: offline cache + ask the browser not to evict our data.
   Service workers need http(s) — opening via file:// still works,
   just without offline install. */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

})();
