# Scala 40 (Scala Quaranta)

A playable, mobile-friendly implementation of **Scala 40** — the classic
Italian 40-point rummy — with a retro **Game Boy-style monochrome LCD**
look. Play against the computer or pass-and-play with a friend.

Built as a plain HTML/CSS/JS web app with zero dependencies, so it runs
anywhere a browser runs and is ready to be wrapped into a native iOS/Android
app with Capacitor (see below).

## Play it

Open `index.html` in any browser — that's it. For a local server:

```sh
npx serve .        # or: python3 -m http.server
```

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
- Discard your last card to win. Loser counts penalty points
  (joker 25, ace 11, faces 10, rest face value).

Casual simplifications: a retrieved joker may be kept in hand (strict rules
require replaying it the same turn), and a game is a single hand rather
than a multi-round points match.

## Project layout

| Path                  | What it is                                             |
| --------------------- | ------------------------------------------------------ |
| `index.html`          | App shell and screens (menu, game, pass-device, end)   |
| `css/style.css`       | Game Boy DMG theme (4-shade palette, scanlines)        |
| `js/rules.js`         | Pure rules engine: deck, meld validation, attachments  |
| `js/ai.js`            | Computer opponent: meld search, opening solver, plans  |
| `js/game.js`          | Game state machine + DOM rendering + input             |
| `test/rules.test.js`  | Unit tests for rules + AI (`node test/rules.test.js`)  |

`rules.js` and `ai.js` are DOM-free and load in Node, so game logic is unit
tested and could later back an online multiplayer server unchanged.

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

## Roadmap ideas

- Multi-round scoring to 101/201 points
- Difficulty levels for the AI
- Online multiplayer (the rules engine is already server-ready)
- Sound effects, haptics, animations
- Selectable palettes (original DMG green, gray "Pocket", inverted)
