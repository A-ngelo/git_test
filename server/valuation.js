'use strict';

const { findMarketEntry, norm } = require('./market-data');

// Condition scale follows the collector-market convention:
// concours (#1) > excellent (#2) > good (#3, baseline) > fair (#4) > project (#5)
const CONDITION_MULTIPLIERS = {
  concours: 1.8,
  excellent: 1.35,
  good: 1.0,
  fair: 0.65,
  project: 0.35,
};

const PREMIUM_MAKES = new Set([
  'ferrari', 'lamborghini', 'porsche', 'mercedes-benz', 'aston martin',
  'jaguar', 'maserati', 'shelby', 'bentley', 'rolls-royce',
]);

// Deterministic PRNG seeded from the car's identity, so value histories are
// stable across requests/restarts without storing time-series data yet.
function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function next() {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Heuristic estimate for cars not in the curated database: value by age
// bracket, bumped for premium marques. Clearly labeled as an estimate in
// the API response so the UI can set expectations.
function fallbackBaseValue(car) {
  const year = Number(car.year);
  const age = new Date().getFullYear() - year;
  let base;
  if (age >= 70) base = 60000;
  else if (age >= 55) base = 45000;
  else if (age >= 40) base = 30000;
  else if (age >= 25) base = 20000;
  else base = 15000;
  if (PREMIUM_MAKES.has(norm(car.make))) base *= 2.5;
  return base;
}

function mileageAdjustment(car) {
  const miles = Number(car.mileage);
  if (!Number.isFinite(miles) || miles <= 0) return 1.0;
  if (miles < 25000) return 1.15;
  if (miles < 60000) return 1.05;
  if (miles < 100000) return 1.0;
  return 0.9;
}

function conditionMultiplier(condition) {
  return CONDITION_MULTIPLIERS[norm(condition)] || CONDITION_MULTIPLIERS.good;
}

// Full valuation for a car: current value, confidence, market segment
// label, and a synthesized 24-month history consistent with the segment's
// appreciation trend.
function valueCar(car) {
  const entry = findMarketEntry(car);
  const base = entry ? entry.baseValue : fallbackBaseValue(car);
  const trend = entry ? entry.trend : 0.03;
  const current = Math.round(base * conditionMultiplier(car.condition) * mileageAdjustment(car));

  const rand = seededRandom(`${norm(car.make)}|${norm(car.model)}|${car.year}|${norm(car.condition)}`);
  const months = 24;
  const monthlyTrend = Math.pow(1 + trend, 1 / 12) - 1;
  const history = [];
  // Walk backwards from today's value so the series always ends at `current`.
  let v = current;
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    history.unshift({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      value: Math.round(v),
    });
    const noise = (rand() - 0.5) * 0.02;
    v = v / (1 + monthlyTrend + noise);
  }

  const yearAgo = history[history.length - 13] || history[0];
  const change12mo = yearAgo.value > 0 ? (current - yearAgo.value) / yearAgo.value : 0;

  return {
    currentValue: current,
    confidence: entry ? 'market' : 'estimate',
    segment: entry ? entry.display : `${car.year} ${car.make} ${car.model}`,
    annualTrend: trend,
    change12mo: Math.round(change12mo * 1000) / 10, // percent, 1 decimal
    history,
  };
}

// Portfolio rollup across a whole collection.
function valuePortfolio(cars) {
  const items = cars.map((car) => {
    const valuation = valueCar(car);
    const paid = Number(car.purchasePrice);
    return {
      id: car.id,
      name: `${car.year} ${car.make} ${car.model}`,
      currentValue: valuation.currentValue,
      change12mo: valuation.change12mo,
      confidence: valuation.confidence,
      purchasePrice: Number.isFinite(paid) && paid > 0 ? paid : null,
      gain: Number.isFinite(paid) && paid > 0 ? valuation.currentValue - paid : null,
    };
  });
  const totalValue = items.reduce((s, i) => s + i.currentValue, 0);
  const totalPaid = items.reduce((s, i) => s + (i.purchasePrice || 0), 0);
  const weighted = items.reduce((s, i) => s + i.currentValue * (i.change12mo / 100), 0);
  return {
    totalValue,
    totalPaid,
    totalGain: totalPaid > 0 ? totalValue - totalPaid : null,
    change12mo: totalValue > 0 ? Math.round((weighted / totalValue) * 1000) / 10 : 0,
    cars: items,
  };
}

module.exports = { valueCar, valuePortfolio, CONDITION_MULTIPLIERS };
