# Scala 40 (Scala Quaranta)

A complete, mobile-first implementation of **Scala 40** — the classic
Italian 40-point rummy — styled like a Game Boy LCD. Three modes:
**vs computer**, **pass-and-play**, and **online multiplayer** with
5-letter room codes. Match play to 101/151/201 penalty points.

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
- Discard your last card to win the hand. The loser counts penalty points
  for the cards left in hand (joker 25, ace 11, faces 10, rest face value).
- **Match play:** penalties accumulate hand after hand; reaching the match
  limit — **101 / 151 (default) / 201**, picked in the menu — loses the
  match. In online rooms the creator's choice applies. The lead alternates
  between hands and running scores sit next to each player's name.
- Drag cards to arrange your hand (order is yours alone and persists), or
  use the sort buttons.

Casual simplification: a retrieved joker may be kept in hand (strict rules
require replaying it the same turn).

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
- [ ] App Privacy: no data collected (nothing is tracked or stored)

## Roadmap ideas

- Difficulty levels for the AI (defensive discards tracking opponent pickups)
- Random matchmaking and rematches for online rooms
- Sound effects, haptics, animations
- Selectable palettes (original DMG green, gray "Pocket", inverted)
