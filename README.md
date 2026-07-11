# GarageVault

**The app for car collectors.** Add the cars you actually own, and GarageVault
tracks what your collection is worth and builds a feed of history, market
moves, and stories about *your* cars — not generic car news.

$2.99/month. Built for the collector who wants their garage in their pocket.

## What it does

- **Garage** — add each car in your real-world collection: year, make, model,
  trim, condition (#1 concours → #5 project), mileage, purchase price, notes.
- **Valuation engine** — every car gets a current value from a curated
  collector-market database (60s muscle, air-cooled Porsches, JDM legends,
  and more), adjusted for your car's condition and mileage, with a 24-month
  value trend. Cars outside the database get a clearly-labeled heuristic
  estimate.
- **Personalized feed** — every post is anchored to a car you own. Own a
  1969 Charger? Your feed covers the Coke-bottle body's design history, the
  426 HEMI premium, its Talladega 200 mph run, and how it's moved in the
  market over the last 12 months. Magazine-style content is converted into
  feed-sized posts.
- **Value dashboard** — total collection value, 12-month change, and
  gain/loss versus what you paid.
- **Premium** — the $2.99/mo subscription surface (billing integration is
  stubbed in the MVP).

## Run it

```bash
npm install
npm start
# open http://localhost:3000
```

## Test it

```bash
npm test
```

## Architecture

```
server.js               Express app + REST API
server/store.js         JSON-file persistence (swap for a real DB later)
server/market-data.js   Curated collector-market database + lookup
server/valuation.js     Condition/mileage-adjusted values, trends, portfolio rollup
server/content-library.js  Editorial content keyed by model / make / decade
server/feed.js          Personalized feed builder (interleaved per car)
public/                 Build-free single-page app
test/api.test.js        End-to-end API tests (node --test)
```

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/cars` | List / add cars (add returns valuation) |
| PUT/DELETE | `/api/cars/:id` | Update / remove a car |
| GET | `/api/portfolio` | Collection value rollup |
| GET | `/api/feed` | Personalized feed for owned cars |
| GET | `/api/valuation/preview` | Live estimate while filling in the add form |
| GET/POST | `/api/subscription` | Subscription stub ($2.99/mo premium) |

### Where the MVP is honest about being an MVP

- Market values ship as a curated snapshot; production feeds this layer from
  auction/listing aggregation (the lookup interface stays the same).
- Editorial content is a hand-written seed library keyed exactly the way an
  article-ingestion pipeline would key it.
- Payments are a stub — Stripe / App Store / Play plug into
  `POST /api/subscription`.
- Storage is JSON-on-disk behind a tiny store module; swap for a real
  database without touching route code.
