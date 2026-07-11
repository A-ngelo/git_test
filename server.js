'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const store = require('./server/store');
const { valueCar, valuePortfolio, CONDITION_MULTIPLIERS } = require('./server/valuation');
const { buildFeed } = require('./server/feed');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- state -----------------------------------------------------------

let cars = store.load('cars', []);
let subscription = store.load('subscription', { plan: 'free' });

function persistCars() { store.save('cars', cars); }

// ---- validation ------------------------------------------------------

const CONDITIONS = Object.keys(CONDITION_MULTIPLIERS);

function validateCar(body) {
  const errors = [];
  const year = Number(body.year);
  const nextYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(year) || year < 1885 || year > nextYear) {
    errors.push(`year must be an integer between 1885 and ${nextYear}`);
  }
  if (!body.make || !String(body.make).trim()) errors.push('make is required');
  if (!body.model || !String(body.model).trim()) errors.push('model is required');
  const condition = String(body.condition || 'good').toLowerCase();
  if (!CONDITIONS.includes(condition)) {
    errors.push(`condition must be one of: ${CONDITIONS.join(', ')}`);
  }
  const optionalNumber = (v, name) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { errors.push(`${name} must be a non-negative number`); return null; }
    return n;
  };
  const mileage = optionalNumber(body.mileage, 'mileage');
  const purchasePrice = optionalNumber(body.purchasePrice, 'purchasePrice');
  if (errors.length) return { errors };
  return {
    car: {
      year,
      make: String(body.make).trim(),
      model: String(body.model).trim(),
      trim: body.trim ? String(body.trim).trim() : '',
      condition,
      mileage,
      purchasePrice,
      notes: body.notes ? String(body.notes).slice(0, 2000) : '',
    },
  };
}

// ---- API -------------------------------------------------------------

app.get('/api/cars', (req, res) => {
  res.json(cars.map((car) => ({ ...car, valuation: valueCar(car) })));
});

app.post('/api/cars', (req, res) => {
  const { car, errors } = validateCar(req.body || {});
  if (errors) return res.status(400).json({ errors });
  const record = { id: crypto.randomUUID(), addedAt: new Date().toISOString(), ...car };
  cars.push(record);
  persistCars();
  res.status(201).json({ ...record, valuation: valueCar(record) });
});

app.put('/api/cars/:id', (req, res) => {
  const idx = cars.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'car not found' });
  const { car, errors } = validateCar({ ...cars[idx], ...req.body });
  if (errors) return res.status(400).json({ errors });
  cars[idx] = { ...cars[idx], ...car };
  persistCars();
  res.json({ ...cars[idx], valuation: valueCar(cars[idx]) });
});

app.delete('/api/cars/:id', (req, res) => {
  const before = cars.length;
  cars = cars.filter((c) => c.id !== req.params.id);
  if (cars.length === before) return res.status(404).json({ error: 'car not found' });
  persistCars();
  res.status(204).end();
});

app.get('/api/portfolio', (req, res) => {
  res.json(valuePortfolio(cars));
});

app.get('/api/feed', (req, res) => {
  res.json({ posts: buildFeed(cars) });
});

// Live valuation preview while filling in the add-car form.
app.get('/api/valuation/preview', (req, res) => {
  const { car, errors } = validateCar(req.query);
  if (errors) return res.status(400).json({ errors });
  res.json(valueCar(car));
});

// Subscription stub — where the $2.99/mo billing integration (Stripe /
// App Store / Play) plugs in. No real payments in the MVP.
app.get('/api/subscription', (req, res) => res.json(subscription));

app.post('/api/subscription', (req, res) => {
  const plan = req.body && req.body.plan;
  if (plan !== 'free' && plan !== 'premium') {
    return res.status(400).json({ error: 'plan must be "free" or "premium"' });
  }
  subscription = {
    plan,
    price: plan === 'premium' ? 2.99 : 0,
    since: new Date().toISOString(),
  };
  store.save('subscription', subscription);
  res.json(subscription);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => {
    console.log(`GarageVault running at http://localhost:${port}`);
  });
}

module.exports = app;
