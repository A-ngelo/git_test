'use strict';

// GarageVault SPA — no framework, no build step.

const $ = (sel) => document.querySelector(sel);

const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error('API error'), { body });
  return body;
}

// ---- tabs ------------------------------------------------------------

const views = { feed: renderFeed, garage: renderGarage, portfolio: renderPortfolio };

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

function switchView(name) {
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => { v.hidden = true; });
  $(`#view-${name}`).hidden = false;
  views[name]();
}

// ---- feed ------------------------------------------------------------

async function renderFeed() {
  const el = $('#feed-list');
  const { posts } = await api('/api/feed');
  if (!posts.length) {
    el.innerHTML = `
      <div class="empty">
        <h3>Your feed is waiting for your first car</h3>
        <p>Add a car to your garage and we'll fill this with history, market moves, and stories about the exact cars you own.</p>
      </div>`;
    return;
  }
  el.innerHTML = posts.map((p) => `
    <article class="post">
      <div class="post-meta">
        <span class="badge badge-${esc(p.type)}">${esc(p.type)}</span>
        <span class="post-car">for your ${esc(p.car)}</span>
      </div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.body)}</p>
      <div class="post-source">— ${esc(p.source)}</div>
    </article>
  `).join('');
}

// ---- garage ----------------------------------------------------------

function sparkline(history) {
  if (!history || history.length < 2) return '';
  const values = history.map((h) => h.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 120, h = 28;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const up = values[values.length - 1] >= values[0];
  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${points}" fill="none" stroke="${up ? '#4cc38a' : '#e5534b'}" stroke-width="1.8"/>
  </svg>`;
}

async function renderGarage() {
  const el = $('#garage-list');
  const cars = await api('/api/cars');
  updateWorthChip(cars);
  if (!cars.length) {
    el.innerHTML = `
      <div class="empty">
        <h3>Your garage is empty</h3>
        <p>Add the cars you own — a 1969 Charger, a split-window Corvette, anything — and GarageVault starts tracking their value and telling their stories.</p>
      </div>`;
    return;
  }
  el.innerHTML = cars.map((c) => {
    const v = c.valuation;
    const deltaCls = v.change12mo >= 0 ? 'up' : 'down';
    const sign = v.change12mo >= 0 ? '+' : '';
    return `
    <div class="car-card">
      <div class="car-info">
        <h3>${esc(c.year)} ${esc(c.make)} ${esc(c.model)}${c.trim ? ' ' + esc(c.trim) : ''}</h3>
        <div class="car-sub">
          ${esc(c.condition)} condition${c.mileage ? ` · ${Number(c.mileage).toLocaleString()} mi` : ''}
        </div>
        ${c.notes ? `<div class="car-sub">${esc(c.notes)}</div>` : ''}
        <div class="car-actions">
          <button class="btn-delete" data-id="${esc(c.id)}">remove</button>
        </div>
      </div>
      <div class="car-value">
        <div class="amount">${fmtMoney(v.currentValue)}</div>
        <div class="delta ${deltaCls}">${sign}${v.change12mo}% · 12 mo</div>
        ${sparkline(v.history)}
        <div class="confidence">${v.confidence === 'market' ? esc(v.segment) + ' market data' : 'heuristic estimate'}</div>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cars/${btn.dataset.id}`, { method: 'DELETE' });
      renderGarage();
    });
  });
}

function updateWorthChip(cars) {
  const chip = $('#collection-worth');
  if (!cars.length) { chip.hidden = true; return; }
  const total = cars.reduce((s, c) => s + c.valuation.currentValue, 0);
  chip.innerHTML = `Collection: <strong>${fmtMoney(total)}</strong>`;
  chip.hidden = false;
}

// ---- portfolio -------------------------------------------------------

async function renderPortfolio() {
  const summary = $('#portfolio-summary');
  const list = $('#portfolio-list');
  const p = await api('/api/portfolio');
  if (!p.cars.length) {
    summary.innerHTML = '';
    list.innerHTML = `
      <div class="empty">
        <h3>No collection value yet</h3>
        <p>Add cars in the Garage tab to see your total collection value here.</p>
      </div>`;
    return;
  }
  const deltaCls = p.change12mo >= 0 ? 'up' : 'down';
  const sign = p.change12mo >= 0 ? '+' : '';
  summary.innerHTML = `
    <div class="label">Total collection value</div>
    <div class="total">${fmtMoney(p.totalValue)}</div>
    <div class="sub">
      <span class="delta ${deltaCls}">${sign}${p.change12mo}% over 12 months</span>
      ${p.totalGain !== null ? ` · ${p.totalGain >= 0 ? 'up' : 'down'} ${fmtMoney(Math.abs(p.totalGain))} vs. what you paid` : ''}
    </div>`;
  list.innerHTML = p.cars.map((c) => {
    const cls = c.change12mo >= 0 ? 'up' : 'down';
    const s = c.change12mo >= 0 ? '+' : '';
    return `
    <div class="portfolio-row">
      <div class="name">${esc(c.name)}</div>
      <div class="nums">
        <div>${fmtMoney(c.currentValue)} <span class="delta ${cls}">${s}${c.change12mo}%</span></div>
        ${c.gain !== null ? `<div class="confidence">${c.gain >= 0 ? '+' : '−'}${fmtMoney(Math.abs(c.gain))} since purchase</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ---- add-car modal ---------------------------------------------------

const modal = $('#modal');
const form = $('#car-form');

$('#add-car-btn').addEventListener('click', () => {
  form.reset();
  $('#valuation-preview').hidden = true;
  $('#form-errors').hidden = true;
  modal.hidden = false;
});
$('#modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

// Live valuation preview as the user types (debounced).
let previewTimer;
form.addEventListener('input', () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const d = Object.fromEntries(new FormData(form));
    if (!d.year || !d.make || !d.model) { $('#valuation-preview').hidden = true; return; }
    try {
      const v = await api('/api/valuation/preview?' + new URLSearchParams(d));
      $('#valuation-preview').textContent =
        `Estimated value: ${fmtMoney(v.currentValue)}` +
        (v.confidence === 'market' ? ` — based on ${v.segment} market data` : ' — heuristic estimate');
      $('#valuation-preview').hidden = false;
    } catch { $('#valuation-preview').hidden = true; }
  }, 350);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('/api/cars', { method: 'POST', body: JSON.stringify(data) });
    modal.hidden = true;
    switchView('garage');
  } catch (err) {
    const errors = (err.body && err.body.errors) || ['Something went wrong.'];
    $('#form-errors').innerHTML = errors.map(esc).join('<br>');
    $('#form-errors').hidden = false;
  }
});

// ---- premium ---------------------------------------------------------

const premiumModal = $('#premium-modal');
$('#premium-btn').addEventListener('click', () => { premiumModal.hidden = false; });
$('#premium-close').addEventListener('click', () => { premiumModal.hidden = true; });
premiumModal.addEventListener('click', (e) => { if (e.target === premiumModal) premiumModal.hidden = true; });

$('#premium-subscribe').addEventListener('click', async () => {
  await api('/api/subscription', { method: 'POST', body: JSON.stringify({ plan: 'premium' }) });
  premiumModal.hidden = true;
  reflectSubscription();
});

async function reflectSubscription() {
  const sub = await api('/api/subscription');
  const btn = $('#premium-btn');
  if (sub.plan === 'premium') {
    btn.textContent = 'Premium ✓';
    btn.classList.add('subscribed');
  } else {
    btn.textContent = 'Go Premium · $2.99/mo';
    btn.classList.remove('subscribed');
  }
}

// ---- boot ------------------------------------------------------------

reflectSubscription();
renderFeed();
// Preload the worth chip even though we start on the feed.
api('/api/cars').then(updateWorthChip).catch(() => {});
