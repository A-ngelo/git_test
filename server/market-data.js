'use strict';

// Curated collector-car market database.
//
// In production this layer is fed by aggregating auction results and
// listing data (Hagerty, Bring a Trailer, Barrett-Jackson, Mecum, classic
// dealer listings). For the MVP it ships with a curated snapshot of
// well-known collector cars so the experience works out of the box, plus
// a heuristic fallback for anything we don't recognize.
//
// baseValue = typical #3 ("good") condition value in USD.
// trend     = approximate annual appreciation rate used to synthesize a
//             24-month value history until real time-series data lands.

const MARKET_DB = [
  { make: 'dodge', model: 'charger', years: [1968, 1970], baseValue: 85000, trend: 0.06,
    display: 'Dodge Charger (2nd gen)' },
  { make: 'dodge', model: 'challenger', years: [1970, 1974], baseValue: 72000, trend: 0.05,
    display: 'Dodge Challenger (E-body)' },
  { make: 'plymouth', model: 'barracuda', years: [1970, 1974], baseValue: 78000, trend: 0.05,
    display: 'Plymouth Barracuda (E-body)' },
  { make: 'ford', model: 'mustang', years: [1964, 1966], baseValue: 42000, trend: 0.04,
    display: 'Ford Mustang (1st gen early)' },
  { make: 'ford', model: 'mustang', years: [1967, 1970], baseValue: 55000, trend: 0.05,
    display: 'Ford Mustang (1st gen late)' },
  { make: 'shelby', model: 'gt350', years: [1965, 1970], baseValue: 240000, trend: 0.07,
    display: 'Shelby GT350' },
  { make: 'shelby', model: 'gt500', years: [1967, 1970], baseValue: 210000, trend: 0.07,
    display: 'Shelby GT500' },
  { make: 'chevrolet', model: 'corvette', years: [1953, 1962], baseValue: 95000, trend: 0.04,
    display: 'Chevrolet Corvette C1' },
  { make: 'chevrolet', model: 'corvette', years: [1963, 1967], baseValue: 120000, trend: 0.05,
    display: 'Chevrolet Corvette C2' },
  { make: 'chevrolet', model: 'corvette', years: [1968, 1982], baseValue: 38000, trend: 0.04,
    display: 'Chevrolet Corvette C3' },
  { make: 'chevrolet', model: 'camaro', years: [1967, 1969], baseValue: 58000, trend: 0.05,
    display: 'Chevrolet Camaro (1st gen)' },
  { make: 'chevrolet', model: 'chevelle', years: [1968, 1972], baseValue: 60000, trend: 0.05,
    display: 'Chevrolet Chevelle SS era' },
  { make: 'pontiac', model: 'gto', years: [1964, 1972], baseValue: 65000, trend: 0.05,
    display: 'Pontiac GTO' },
  { make: 'porsche', model: '911', years: [1964, 1973], baseValue: 165000, trend: 0.08,
    display: 'Porsche 911 (long-hood)' },
  { make: 'porsche', model: '911', years: [1974, 1989], baseValue: 75000, trend: 0.07,
    display: 'Porsche 911 (G-body)' },
  { make: 'porsche', model: '911', years: [1989, 1994], baseValue: 110000, trend: 0.08,
    display: 'Porsche 911 (964)' },
  { make: 'porsche', model: '911', years: [1995, 1998], baseValue: 145000, trend: 0.09,
    display: 'Porsche 911 (993)' },
  { make: 'jaguar', model: 'e-type', years: [1961, 1974], baseValue: 130000, trend: 0.05,
    display: 'Jaguar E-Type' },
  { make: 'mercedes-benz', model: '300sl', years: [1954, 1963], baseValue: 1400000, trend: 0.06,
    display: 'Mercedes-Benz 300 SL' },
  { make: 'ferrari', model: '308', years: [1975, 1985], baseValue: 95000, trend: 0.06,
    display: 'Ferrari 308' },
  { make: 'ferrari', model: 'testarossa', years: [1984, 1991], baseValue: 150000, trend: 0.07,
    display: 'Ferrari Testarossa' },
  { make: 'lamborghini', model: 'countach', years: [1974, 1990], baseValue: 650000, trend: 0.08,
    display: 'Lamborghini Countach' },
  { make: 'datsun', model: '240z', years: [1969, 1973], baseValue: 45000, trend: 0.08,
    display: 'Datsun 240Z' },
  { make: 'toyota', model: 'supra', years: [1993, 1998], baseValue: 90000, trend: 0.1,
    display: 'Toyota Supra (Mk4)' },
  { make: 'acura', model: 'nsx', years: [1990, 2005], baseValue: 110000, trend: 0.09,
    display: 'Acura NSX (NA1/NA2)' },
  { make: 'honda', model: 'nsx', years: [1990, 2005], baseValue: 110000, trend: 0.09,
    display: 'Honda NSX (NA1/NA2)' },
  { make: 'nissan', model: 'skyline gt-r', years: [1989, 2002], baseValue: 95000, trend: 0.1,
    display: 'Nissan Skyline GT-R (R32–R34)' },
  { make: 'bmw', model: 'm3', years: [1986, 1991], baseValue: 85000, trend: 0.08,
    display: 'BMW M3 (E30)' },
  { make: 'bmw', model: '2002', years: [1968, 1976], baseValue: 35000, trend: 0.06,
    display: 'BMW 2002' },
  { make: 'volkswagen', model: 'beetle', years: [1950, 1979], baseValue: 18000, trend: 0.04,
    display: 'Volkswagen Beetle (classic)' },
  { make: 'ford', model: 'bronco', years: [1966, 1977], baseValue: 62000, trend: 0.07,
    display: 'Ford Bronco (1st gen)' },
  { make: 'toyota', model: 'land cruiser', years: [1960, 1984], baseValue: 48000, trend: 0.07,
    display: 'Toyota Land Cruiser (FJ40)' },
];

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

// Find the best market entry for a car. Model matching is fuzzy in one
// direction ("charger r/t" matches "charger") so trims don't break lookup.
function findMarketEntry(car) {
  const make = norm(car.make);
  const model = norm(car.model);
  const year = Number(car.year);
  return MARKET_DB.find((e) => {
    if (e.make !== make) return false;
    if (year < e.years[0] || year > e.years[1]) return false;
    return model === e.model || model.includes(e.model) || e.model.includes(model);
  }) || null;
}

module.exports = { MARKET_DB, findMarketEntry, norm };
