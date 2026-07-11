# Scala 40 (Scala Quaranta)

A playable, mobile-friendly implementation of **Scala 40** — the classic
Italian 40-point rummy — with a retro **Game Boy-style monochrome LCD**
look. Three modes: vs computer, pass-and-play, and **online multiplayer
with room codes**.

The game itself is plain dependency-free HTML/CSS/JS, ready to be wrapped
into a native iOS/Android app with Capacitor (see below). Online play adds
one server dependency (`ws`).

## Play it

**Local modes** (vs CPU, pass-and-play): just open `index.html` in any
browser.

**With online multiplayer:**

```sh
npm install
npm start          # serves the game + referee on http://localhost:3040
```

One player taps **Online → Create room** and shares the 5-letter code;
the other taps **Online**, enters the code, and joins. To play across the
internet, deploy the server anywhere Node runs (Fly.io, Railway, a $5 VPS)
— it's a single process serving both the static app and the WebSocket
referee, so no extra configuration is needed.

## How multiplayer stays fair

The server is **authoritative**: it holds the real deck and both hands,
validates every move through the same `js/engine.js` the browser uses for
local play, and sends each client only a redacted view (your cards, the
table, and the opponent's card *count*). A modified client can neither
cheat nor peek — there is a unit test asserting no hidden card ever
appears in a client view. Dropped connections rejoin automatically with a
session token.

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
- **Match play:** penalty points accumulate hand after hand; the player
  who reaches the match limit loses. Pick **101, 151 (default), or 201**
  in the menu (in online rooms the creator's choice applies). The lead
  alternates between hands and the running score is always visible next
  to each player's name.

Casual simplification: a retrieved joker may be kept in hand (strict rules
require replaying it the same turn).

## Project layout

| Path                  | What it is                                              |
| --------------------- | ------------------------------------------------------- |
| `index.html`          | App shell and screens (menu, lobby, game, end)          |
| `css/style.css`       | Game Boy DMG theme (4-shade palette, scanlines)         |
| `js/rules.js`         | Meld validation, attachments, joker swaps, scoring      |
| `js/engine.js`        | Game state machine: turns, opening, discards, winning   |
| `js/ai.js`            | Computer opponent: meld search, opening solver, plans   |
| `js/net.js`           | WebSocket client: rooms, actions, auto-reconnect        |
| `js/game.js`          | Screens, rendering, input; routes moves to engine/net   |
| `server/server.js`    | Static host + authoritative multiplayer referee         |
| `test/`               | Unit tests for rules, AI, and engine (`npm test`)       |

`rules.js`, `engine.js`, and `ai.js` are DOM-free and run in both the
browser and Node — local play, the server referee, and the tests all share
the identical game logic.

## Shipping to the App Store (Capacitor)

The app is deliberately dependency-free and touch-first so it can be
wrapped as-is:

```sh
npm install @capacitor/core @capacitor/cli
npx cap init "Scala 40" com.yourname.scala40 --web-dir .
npx cap add ios        # requires Xcode on macOS
npx cap open ios       # build/sign/submit from Xcode
```

Before submitting: add app icons and a splash screen, set
`UIRequiresFullScreen`/orientation in Xcode, and consider haptics + sound.
Note that "Scala 40" is the traditional (public domain) game name, but
check App Store availability for your exact app title.

Note for online play from a Capacitor app: point `js/net.js` at your
deployed server URL instead of `location.host`.

## Roadmap ideas

- Difficulty levels for the AI
- Random matchmaking and rematches for online rooms
- Sound effects, haptics, animations
- Selectable palettes (original DMG green, gray "Pocket", inverted)
