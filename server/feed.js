'use strict';

const { norm } = require('./market-data');
const { valueCar } = require('./valuation');
const { MODEL_CONTENT, MAKE_CONTENT, DECADE_CONTENT } = require('./content-library');

// Builds the personalized feed for a collection. Every post is anchored to
// a specific car the user owns — that's the product: no generic car news,
// only content about *your* garage.
//
// Post types:
//   history   — editorial/historical content matched to the exact model
//   article   — magazine-style content converted to feed form
//   market    — generated from the valuation engine (12-month movement)
//   milestone — anniversaries (car's age hitting a round number this year)

function carLabel(car) {
  return `${car.year} ${car.make} ${car.model}`;
}

function contentForCar(car) {
  const make = norm(car.make);
  const model = norm(car.model);
  const year = Number(car.year);
  const decade = Math.floor(year / 10) * 10;
  const items = [];

  for (const entry of MODEL_CONTENT) {
    if (entry.make !== make) continue;
    if (year < entry.years[0] || year > entry.years[1]) continue;
    if (!(model === entry.model || model.includes(entry.model) || entry.model.includes(model))) continue;
    items.push(...entry.items.map((i) => ({ ...i, relevance: 3 })));
  }
  for (const entry of MAKE_CONTENT) {
    if (entry.make !== make) continue;
    items.push(...entry.items.map((i) => ({ ...i, relevance: 2 })));
  }
  for (const entry of DECADE_CONTENT) {
    if (entry.decade !== decade) continue;
    items.push(...entry.items.map((i) => ({ ...i, relevance: 1 })));
  }
  return items;
}

function marketPost(car) {
  const v = valueCar(car);
  const dir = v.change12mo >= 0 ? 'up' : 'down';
  const abs = Math.abs(v.change12mo);
  const fmt = (n) => '$' + n.toLocaleString('en-US');
  return {
    type: 'market',
    carId: car.id,
    car: carLabel(car),
    title: `Your ${carLabel(car)} is ${dir} ${abs}% over the last 12 months`,
    body: v.confidence === 'market'
      ? `Current estimate: ${fmt(v.currentValue)} based on ${v.segment} market data, adjusted for your car's condition and mileage.`
      : `Current estimate: ${fmt(v.currentValue)}. We don't have deep market coverage for this model yet, so this is a heuristic estimate — add more details to tighten it up.`,
    source: 'GarageVault Market Engine',
    relevance: 2.5,
  };
}

function milestonePost(car, nowYear) {
  const age = nowYear - Number(car.year);
  if (age <= 0 || age % 5 !== 0) return null;
  return {
    type: 'milestone',
    carId: car.id,
    car: carLabel(car),
    title: `Your ${carLabel(car)} turns ${age} this year`,
    body: age >= 25
      ? `That's ${age} years of history in your garage. Anniversary years are peak visibility for a model — shows, magazine retrospectives, and auction features all follow the round numbers.`
      : `${age} years old — and officially on the collector radar.`,
    source: 'GarageVault',
    relevance: 2,
  };
}

// Interleave posts so no single car dominates the top of the feed.
function interleaveByCar(posts) {
  const byCar = new Map();
  for (const p of posts) {
    if (!byCar.has(p.carId)) byCar.set(p.carId, []);
    byCar.get(p.carId).push(p);
  }
  for (const list of byCar.values()) {
    list.sort((a, b) => b.relevance - a.relevance);
  }
  const result = [];
  const queues = [...byCar.values()];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      if (q.length) {
        result.push(q.shift());
        added = true;
      }
    }
  }
  return result;
}

function buildFeed(cars) {
  const nowYear = new Date().getFullYear();
  const posts = [];
  for (const car of cars) {
    posts.push(marketPost(car));
    const milestone = milestonePost(car, nowYear);
    if (milestone) posts.push(milestone);
    for (const item of contentForCar(car)) {
      posts.push({
        type: item.kind,
        carId: car.id,
        car: carLabel(car),
        title: item.title,
        body: item.body,
        source: item.source || 'GarageVault Editorial',
        relevance: item.relevance,
      });
    }
  }
  return interleaveByCar(posts).map((p, i) => {
    const { relevance, ...post } = p;
    return { id: `post-${i}`, ...post };
  });
}

module.exports = { buildFeed };
