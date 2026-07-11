'use strict';

process.env.GARAGEVAULT_DATA_DIR = require('fs').mkdtempSync(
  require('path').join(require('os').tmpdir(), 'gv-test-')
);

const { test } = require('node:test');
const assert = require('node:assert');
const app = require('../server');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

test.after(() => server.close());

async function api(path, opts) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

test('empty garage returns empty feed and zero portfolio', async () => {
  const feed = await api('/api/feed');
  assert.deepStrictEqual(feed.body.posts, []);
  const portfolio = await api('/api/portfolio');
  assert.strictEqual(portfolio.body.totalValue, 0);
});

test('rejects an invalid car', async () => {
  const res = await api('/api/cars', {
    method: 'POST',
    body: JSON.stringify({ year: 1800, make: '', model: 'Charger' }),
  });
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.errors.length >= 2);
});

test('adds a 1969 Charger and values it from market data', async () => {
  const res = await api('/api/cars', {
    method: 'POST',
    body: JSON.stringify({
      year: 1969, make: 'Dodge', model: 'Charger', trim: 'R/T',
      condition: 'excellent', mileage: 54000, purchasePrice: 60000,
    }),
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.id);
  assert.strictEqual(res.body.valuation.confidence, 'market');
  assert.match(res.body.valuation.segment, /Charger/);
  assert.ok(res.body.valuation.currentValue > 80000, 'excellent HEMI-era Charger should value above base');
  assert.strictEqual(res.body.valuation.history.length, 24);
  // History must end at the current value.
  const last = res.body.valuation.history[23];
  assert.strictEqual(last.value, res.body.valuation.currentValue);
});

test('feed contains Charger-specific history and a market post', async () => {
  const { body } = await api('/api/feed');
  assert.ok(body.posts.length >= 3);
  const types = new Set(body.posts.map((p) => p.type));
  assert.ok(types.has('market'), 'feed should include a market post');
  assert.ok(types.has('history'), 'feed should include model history');
  assert.ok(body.posts.every((p) => /1969 Dodge Charger/.test(p.car)),
    'every post should be anchored to an owned car');
});

test('unknown car falls back to a labeled estimate', async () => {
  const res = await api('/api/cars', {
    method: 'POST',
    body: JSON.stringify({ year: 1987, make: 'Yugo', model: 'GV', condition: 'good' }),
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.valuation.confidence, 'estimate');
});

test('portfolio aggregates all cars and computes gain', async () => {
  const { body } = await api('/api/portfolio');
  assert.strictEqual(body.cars.length, 2);
  assert.strictEqual(body.totalValue, body.cars.reduce((s, c) => s + c.currentValue, 0));
  const charger = body.cars.find((c) => /Charger/.test(c.name));
  assert.strictEqual(charger.gain, charger.currentValue - 60000);
});

test('valuation preview works from query params', async () => {
  const res = await api('/api/valuation/preview?year=1965&make=Ford&model=Mustang&condition=good');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.confidence, 'market');
});

test('update changes valuation inputs', async () => {
  const cars = await api('/api/cars');
  const charger = cars.body.find((c) => /charger/i.test(c.model));
  const res = await api(`/api/cars/${charger.id}`, {
    method: 'PUT',
    body: JSON.stringify({ condition: 'concours' }),
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.valuation.currentValue > charger.valuation.currentValue,
    'concours should value higher than excellent');
});

test('delete removes the car and its feed content', async () => {
  const cars = await api('/api/cars');
  for (const car of cars.body) {
    const res = await api(`/api/cars/${car.id}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 204);
  }
  const feed = await api('/api/feed');
  assert.deepStrictEqual(feed.body.posts, []);
});

test('subscription stub upgrades to premium at $2.99', async () => {
  const res = await api('/api/subscription', {
    method: 'POST',
    body: JSON.stringify({ plan: 'premium' }),
  });
  assert.strictEqual(res.body.plan, 'premium');
  assert.strictEqual(res.body.price, 2.99);
});
