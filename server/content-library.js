'use strict';

// Editorial content library.
//
// In production this is populated by an ingestion pipeline that pulls
// magazine articles, auction coverage, and club news, then converts them
// into feed-sized posts. The MVP ships with a hand-written library keyed
// the same way the pipeline would key it (model match > make match >
// decade match), so the feed architecture is real even though the
// content is seeded.
//
// Each item: { kind: 'history' | 'article', title, body, source? }
// Matchers: model entries use { make, model, years }, make entries use
// { make }, decade entries use { decade } (e.g. 1960).

const MODEL_CONTENT = [
  {
    make: 'dodge', model: 'charger', years: [1968, 1970],
    items: [
      {
        kind: 'history',
        title: 'Why the 1968–70 Charger still owns the road',
        body: 'The second-generation Charger\'s "Coke bottle" body was penned by Richard Sias under Bill Brownlie. Its flying-buttress rear pillars and hidden headlights made it an instant icon — Dodge expected to sell 35,000 in 1968 and moved over 96,000.',
      },
      {
        kind: 'history',
        title: 'The 426 HEMI: the engine that made your Charger a legend',
        body: 'Only a small fraction of second-gen Chargers left the factory with the 426 HEMI. Documented HEMI cars now trade at many multiples of small-block cars, which is why matching-numbers verification matters so much for this platform.',
      },
      {
        kind: 'article',
        title: 'From the archives: the Charger Daytona\'s 200 mph run',
        body: 'In March 1970 a Charger Daytona became the first NASCAR racer to break 200 mph on a closed course at Talladega. The aero program that produced the Daytona\'s nose cone and towering wing started with the standard Charger body you own.',
        source: 'Motorsport archive',
      },
      {
        kind: 'article',
        title: 'Screen legend: Bullitt, the General, and your garage',
        body: 'A black \'68 Charger dueled a Highland Green Mustang through San Francisco in Bullitt (1968), and a \'69 became the most famous TV car of all time a decade later. Screen fame is a real force in this market — it keeps demand for unrestored survivors strong.',
        source: 'Feature desk',
      },
    ],
  },
  {
    make: 'ford', model: 'mustang', years: [1964, 1970],
    items: [
      {
        kind: 'history',
        title: 'The launch that broke records',
        body: 'Ford took roughly 22,000 Mustang orders on the first day of sale, April 17, 1964. The first-generation car created the "pony car" class outright — everything from the Camaro to the Challenger exists because of it.',
      },
      {
        kind: 'article',
        title: 'K-code and beyond: reading your Mustang\'s DNA',
        body: 'The fifth character of a first-gen Mustang VIN is the engine code, and it moves money: a K-code 289 High Performance car carries a substantial premium over an A-code. Worth decoding before your next insurance appraisal.',
        source: 'Buyer\'s guide desk',
      },
    ],
  },
  {
    make: 'chevrolet', model: 'corvette', years: [1963, 1967],
    items: [
      {
        kind: 'history',
        title: 'The split-window that dealers begged for',
        body: 'The 1963 Corvette coupe\'s split rear window lasted exactly one model year — Zora Arkus-Duntov hated the blind spot and won the argument for 1964. That one-year quirk makes the \'63 coupe one of the most recognizable Corvettes ever built.',
      },
    ],
  },
  {
    make: 'porsche', model: '911', years: [1964, 1998],
    items: [
      {
        kind: 'history',
        title: 'Six decades, one silhouette',
        body: 'The 911\'s rear-engine layout was supposed to be an evolutionary dead end. Instead Porsche spent sixty years refining it, and air-cooled cars (through the 993 of 1998) have become the blue chips of the modern collector market.',
      },
      {
        kind: 'article',
        title: 'Air-cooled market check',
        body: 'Long-hood cars led the air-cooled boom, then 964s and 993s followed. The pattern collectors watch: as the earliest cars become unobtainable, value flows into the next-youngest generation.',
        source: 'Market desk',
      },
    ],
  },
  {
    make: 'datsun', model: '240z', years: [1969, 1973],
    items: [
      {
        kind: 'history',
        title: 'The car that changed what "Japanese car" meant',
        body: 'At launch the 240Z cost about half of a Porsche 911 while delivering genuine sports-car performance. It outsold every European sports car in America almost immediately, and survivors with straight rockers and original floors now command serious money.',
      },
    ],
  },
  {
    make: 'toyota', model: 'supra', years: [1993, 1998],
    items: [
      {
        kind: 'history',
        title: '2JZ: the iron block that built a legend',
        body: 'The Mk4 Supra\'s 2JZ-GTE was so overbuilt that tuners routinely doubled its output on stock internals. That reputation, plus a starring film role in 2001, turned unmodified manual turbo cars into six-figure collectibles.',
      },
    ],
  },
  {
    make: 'bmw', model: 'm3', years: [1986, 1991],
    items: [
      {
        kind: 'history',
        title: 'Homologation hero',
        body: 'The E30 M3 exists because BMW needed 5,000 road cars to go touring-car racing. It became the winningest touring car of its era, and the S14 four-cylinder\'s racing pedigree is exactly why clean examples appreciated faster than almost any 1980s car.',
      },
    ],
  },
];

const MAKE_CONTENT = [
  {
    make: 'dodge',
    items: [
      {
        kind: 'article',
        title: 'Mopar market watch',
        body: 'Mopar muscle continues to reward documentation: broadcast sheets, fender tags, and build records routinely add five figures at auction. If your car\'s paperwork is loose in a folder, this is your sign to archive it properly.',
        source: 'Market desk',
      },
    ],
  },
  {
    make: 'porsche',
    items: [
      {
        kind: 'article',
        title: 'The COA is your friend',
        body: 'A Porsche Certificate of Authenticity confirms original colors, options, and engine/gearbox numbers. It costs little, takes weeks, and is the first thing serious buyers ask for.',
        source: 'Ownership desk',
      },
    ],
  },
  {
    make: 'chevrolet',
    items: [
      {
        kind: 'article',
        title: 'Numbers matching, explained',
        body: 'For collector Chevrolets, "numbers matching" means the engine and transmission stampings correspond to the VIN and build date. It is the single biggest value lever on GM muscle — often the difference between a driver and an investment.',
        source: 'Buyer\'s guide desk',
      },
    ],
  },
];

const DECADE_CONTENT = [
  {
    decade: 1960,
    items: [
      {
        kind: 'article',
        title: 'Caring for a 60s survivor',
        body: 'Cars of this era hide rust in quarter panels, trunk drops, and around the rear window channel. A yearly borescope check of the usual traps costs almost nothing and protects the biggest share of your car\'s value: its originality.',
        source: 'Ownership desk',
      },
    ],
  },
  {
    decade: 1970,
    items: [
      {
        kind: 'article',
        title: 'The smog-era sleepers are waking up',
        body: 'For decades the mid-70s were dismissed as the malaise era. Collectors priced out of 60s metal are now discovering them, and clean examples have quietly become one of the market\'s strongest growth segments.',
        source: 'Market desk',
      },
    ],
  },
  {
    decade: 1990,
    items: [
      {
        kind: 'article',
        title: 'Radwood effect, five years on',
        body: '90s performance cars are the fastest-appreciating broad segment in the hobby as the generation that grew up with them hits peak buying power. Unmodified, low-mile examples are the ones setting records.',
        source: 'Market desk',
      },
    ],
  },
];

module.exports = { MODEL_CONTENT, MAKE_CONTENT, DECADE_CONTENT };
