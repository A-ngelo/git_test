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
  items.forEach((it) => { it.growth = defaultGrowth(it); });

  const state = {
    version: 1,
    theme: "paper",
    settings: {
      monthlyExpenses: 3955,
      helocLimit: 100000,
      retirementPct: 60,
      defiApr: 4.0,
      defiStables: 16600,
    },
    owners: ["Angelo", "Brenna", "Joint"],
    categories: cats,
    items,
    snapshots: [],
    forecast: { horizon: 10 },
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
        }
        if (!s.forecast) { s.forecast = { horizon: 10 }; migrated = true; }
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

function projectAt(list, years) {
  let v = 0;
  for (const it of list) v += it.value * Math.pow(1 + (it.growth || 0) / 100, years);
  return v;
}

function projectSeries(list, years) {
  const out = [];
  for (let t = 0; t <= years; t++) out.push(projectAt(list, t));
  return out;
}

/* first crossing of the next round million, monthly resolution, 50y cap */
function nextMilestone(list) {
  const net = computeMetrics(list).net;
  const target = (Math.floor(Math.max(net, 0) / 1e6) + 1) * 1e6;
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

  /* what-if inputs (rebuilt here, values preserved from the scenario) */
  const entryOptions = [["", "Outside the ledger"]].concat(
    state.items.map((i) => [i.id, `${i.name} (${money(i.value)})`])
  );
  const fromSel = document.getElementById("wi-from");
  const toSel = document.getElementById("wi-to");
  const validIds = new Set(state.items.map((i) => i.id));
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
  const baseline = projectSeries(state.items, H);
  const scen = active ? projectSeries(scenarioItems(), H) : null;

  document.getElementById("forecast-legend").hidden = !active;
  renderForecastChart(baseline, scen, H);

  /* milestone note */
  const note = document.getElementById("milestone-note");
  const ms = nextMilestone(state.items);
  const thisYear = new Date().getFullYear();
  note.textContent = ms.years !== null
    ? `At these assumptions you'd cross ${money(ms.target)} in about ` +
      `${ms.years.toFixed(1)} years (${Math.round(thisYear + ms.years)}).`
    : `${money(ms.target)} stays out of reach within 50 years at these assumptions.`;

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
    `Projected net worth over ${H} years, from ${money(baseline[0])} to ${money(baseline[H])} on the current plan` +
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
  const items = [...state.items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
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
  const data = {
    name: itemForm.elements.name.value.trim(),
    value,
    categoryId: itemForm.elements.categoryId.value,
    owner: itemForm.elements.owner.value,
    liquidity: itemForm.elements.liquidity.value,
    role: itemForm.elements.role.value,
    growth: Number.isFinite(growth) ? growth : 0,
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
  renderInsights();
  renderForecast();
  renderGrowthList();
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
