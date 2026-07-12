# Scala 40 (Scala Quaranta)

A complete, mobile-first implementation of **Scala 40** — the classic
Italian 40-point rummy — styled like a Game Boy LCD, with synthesized
sound effects. Modes: **vs computer**, **pass-and-play**, and **online
multiplayer** with 5-letter room codes — **1v1, 3, or 4 players**.
Match play to 101/151/201 penalty points, and online matches feed a
**ranked ladder** (per-mode Elo, detailed stat board, leaderboards).

The game is dependency-free HTML/CSS/JS packaged three ways from one
codebase:

| Way to ship            | What it takes                                    |
| ---------------------- | ------------------------------------------------ |
| **Web / PWA**          | `npm start` (or any static host for local modes) |
| **Server + online**    | `Dockerfile` + `fly.toml` included               |
| **iOS / Android**      | Capacitor config + icons/splash included         |

## Run it

```sh
npm install
npm start          # game + multiplayer referee on http://localhost:3040
```

Open two browser windows to try online mode: **Online → Create room**,
share the 5-letter code, join from the other window. Visiting from a
phone lets you **Add to Home Screen** — the app installs as a PWA with
the proper icon and works offline for the local modes.

## Game rules implemented

- Two French decks + 4 jokers (108 cards), 13 cards each.
- Turn = draw (stock or discard) → play melds / attach → discard one card.
- **Opening:** your first melds must total **40+ points in one turn**.
  Ace = 11 (or 1 in A-2-3), face cards = 10, others face value.
- **Melds:** sets (3–4 same rank, all different suits) and runs
  (3+ consecutive, one suit; A-2-3 and Q-K-A allowed, no wrap-around).
  Max one joker per meld.
- The top discard may be taken only if you use it in a meld that turn
  (enforced; you can also undo the pickup).
- After opening you can attach single cards to any meld on the table and
  swap a table joker for the real card it stands for.
- Discard your last card to win the hand. Losers count the cards left in
  hand (joker 25, ace 11, faces 10, rest face value) — or take a flat
  **100** if they never opened.
- A finished jokerless meld (all four suits, or a full A-K run) is swept
  off the board into a face-down cleared pile, keeping the table tidy.
- **Match play:** penalties accumulate hand after hand; reaching the match
  limit — **101 / 151 (default) / 201**, picked in the menu — loses the
  match. In online rooms the creator's choice applies. The lead alternates
  between hands and running scores sit next to each player's name.
- Drag cards to arrange your hand (order is yours alone and persists), or
  use the sort buttons.

Casual simplification: a retrieved joker may be kept in hand (strict rules
require replaying it the same turn).

## Ranked play

Every finished online match counts toward a per-mode ladder (1v1 / 3P /
4P): pairwise Elo by final placement, match wins, streaks, hands won and
average penalty taken. Identity is an anonymous per-device id, stats
persist in `server/stats.json`, and the app's **Ranked stats** screen
reads them from `/api/stats` and `/api/leaderboard`. Results are recorded
by the server referee itself, so clients can't fake them.

## How multiplayer stays fair

The server is **authoritative**: it holds the real deck and both hands,
validates every move through the same `www/js/engine.js` the browser uses
for local play, and sends each client only a redacted view (your cards,
the table, and the opponent's card *count*). A modified client can neither
cheat nor peek — a unit test asserts no hidden card ever appears in a
client view. Dropped connections rejoin automatically with a session token.

## Project layout

| Path                     | What it is                                            |
| ------------------------ | ----------------------------------------------------- |
| `www/`                   | The whole app (this is what Capacitor bundles)        |
| `www/index.html`         | Shell, screens, PWA manifest + service worker hookup  |
| `www/css/style.css`      | Game Boy DMG theme (4-shade palette, scanlines)       |
| `www/js/rules.js`        | Meld validation, attachments, joker swaps, scoring    |
| `www/js/engine.js`       | State machine: turns, opening, match play, winning    |
| `www/js/ai.js`           | Computer opponent (table-aware discards, 40+ solver)  |
| `www/js/net.js`          | WebSocket client: rooms, actions, auto-reconnect      |
| `www/js/game.js`         | Screens, rendering, input, drag-to-sort               |
| `www/icons/`, `www/sw.js`, `www/manifest.webmanifest` | PWA installability + offline shell |
| `server/server.js`       | Static host + authoritative multiplayer referee       |
| `test/`                  | Unit tests for rules, AI, and engine (`npm test`)     |
| `resources/`             | 1024px icon + 2732px splash for `@capacitor/assets`   |
| `Dockerfile`, `fly.toml` | One-command server deployment                         |
| `capacitor.config.json`  | Native iOS/Android wrapper config                     |

`rules.js`, `engine.js`, and `ai.js` are DOM-free and run in both the
browser and Node — local play, the server referee, and the tests all share
the identical game logic.

## Deploying the online server

Any Node host works; it's a single process, no database. With Fly.io:

```sh
flyctl launch --copy-config --name your-scala40   # uses the Dockerfile
flyctl deploy
```

Railway/Render: point them at the repo; they detect the Dockerfile. The
server binds `PORT` (default 3040) and serves both the game and the
WebSocket referee — one URL to share.

## Shipping to the App Store (Capacitor)

On a Mac with Xcode:

```sh
npm install @capacitor/core @capacitor/cli @capacitor/assets --save-dev
npm run assets      # generates all icon/splash sizes from resources/
npm run ios         # adds the iOS project and opens Xcode
```

Then in Xcode: set your signing team, build, and submit. `npm run android`
does the same for Google Play via Android Studio.

Checklist before submitting:
- [ ] Change `appId` in `capacitor.config.json` to your own reverse-DNS id
- [ ] For online play from the native app, point `www/js/net.js` at your
      deployed server URL instead of `location.host`
- [ ] Verify the app name "Scala 40" (or your variant) is available on the
      store — the game itself is traditional and public domain
- [ ] Complete the monetization setup below, or strip
      `www/js/monetize.js` for an ad-free release

## Ads + "Remove ads" purchase

The native apps show AdMob banners on the menu and hand-end screens and a
full-screen ad every 3rd hand — **never during play**. A one-time
purchase removes all ads (with the App Store-required restore button).
The web/PWA build has no ads at all, and `monetize.js` no-ops there.

Wiring it up for release:

1. **Install the plugins** in the app project (only needed for native
   builds): `npm i @capacitor-community/admob @revenuecat/purchases-capacitor`
2. **AdMob** (admob.google.com): register the iOS and Android apps,
   create one banner and one interstitial ad unit each, and put the four
   ids into `CONFIG.admob` in `www/js/monetize.js`. Google's public
   **test ids are pre-filled** — keep them while developing; clicking
   real ads in a dev build can get an account suspended. Publish an
   `app-ads.txt` on your site as AdMob instructs.
3. **The purchase** (revenuecat.com, free tier): create a non-consumable
   "Remove Ads" product in App Store Connect and Google Play Console
   (e.g. $2.99), attach both to a RevenueCat entitlement named `no_ads`,
   and put the two public API keys into `CONFIG.revenuecat`. RevenueCat
   handles receipts, cross-device restore, and both stores' quirks.
4. **Store disclosures**: with ads, "no data collected" no longer
   applies — declare AdMob's data collection in App Privacy / Data
   safety (both consoles have AdMob-specific guidance), add a privacy
   policy URL, and on iOS the bundled UMP consent flow covers
   GDPR/ATT prompts.

Everything above is config — the purchase flow, entitlement check,
banner placement, and interstitial cadence are already implemented.

## The computer opponent

Three difficulties (menu, vs CPU): **Easy** never reads the discard pile,
hesitates, and misses attachments; **Medium** plays a solid club game
(backtracking 40+ opening solver, table-aware discards); **Hard** adds an
opponent model built from what you take and shed (it won't feed your
melds), endgame danger awareness (dumps expensive cards when you're about
to close), and it reclaims table jokers it holds the real card for.
`npm test` includes a self-play audit that fuzz-checks engine invariants
across thousands of actions and verifies the ladder actually orders
(typical series: hard beats easy ~95%, medium beats easy ~90%, hard beats
medium ~60%).

Two edge rules found by that audit are now in the engine: a hand with no
drawable card, or one where the stock has been re-shuffled four times
without anyone closing, is declared a **dead hand** — no winner, everyone
counts (flat 100 unopened), and the match rolls on.

## Roadmap ideas

- Random matchmaking and rematches for online rooms
- Sound effects, haptics, animations
- Selectable palettes (original DMG green, gray "Pocket", inverted)
