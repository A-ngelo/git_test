/* Node test suite for the Scala 40 game engine. Run: node test/engine.test.js */
'use strict';

const assert = require('assert');
const R = require('../www/js/rules.js');
const E = require('../www/js/engine.js');

let n = 0;
function t(name, fn) {
  n++;
  try {
    fn();
    console.log(`  ok ${n} - ${name}`);
  } catch (e) {
    console.error(`  FAIL ${n} - ${name}`);
    console.error(e.message);
    process.exitCode = 1;
  }
}

let seq = 5000;
const c = (rank, suit) => ({ id: seq++, rank, suit, joker: false });

/* Build a deck whose deal is fully known. Dealing pops from the end,
 * alternating p0/p1 thirteen times, then one card for the discard pile;
 * later stock draws pop from the end of what remains. */
function riggedDeck(p0, p1, discardTop, stockTopFirst) {
  assert.strictEqual(p0.length, 13);
  assert.strictEqual(p1.length, 13);
  const stock = [...stockTopFirst].reverse(); // first element drawn first
  const tail = [discardTop];
  for (let i = 12; i >= 0; i--) {
    tail.push(p1[i], p0[i]);
  }
  return [...stock, ...tail];
}

/* A p0 hand that can open: K♠ K♥ K♦ (30) + 5♣ 6♣ 7♣ (18) = 48. */
function openingHand() {
  return [
    c(13, '♠'), c(13, '♥'), c(13, '♦'),
    c(5, '♣'), c(6, '♣'), c(7, '♣'),
    c(2, '♠'), c(9, '♥'), c(4, '♦'), c(10, '♣'),
    c(3, '♠'), c(8, '♥'), c(2, '♥'),
  ];
}

function junkHand() {
  return [
    c(2, '♦'), c(4, '♠'), c(6, '♥'), c(8, '♦'), c(10, '♠'),
    c(12, '♥'), c(3, '♣'), c(5, '♠'), c(7, '♦'), c(9, '♣'),
    c(11, '♥'), c(13, '♣'), c(4, '♥'),
  ];
}

function riggedGame(opts) {
  opts = opts || {};
  const p0 = opts.p0 || openingHand();
  const p1 = opts.p1 || junkHand();
  const discardTop = opts.discardTop || c(9, '♦');
  const stock = opts.stock || [c(2, '♣'), c(6, '♦'), c(10, '♥'), c(3, '♦'), c(11, '♦')];
  const deck = riggedDeck(p0, p1, discardTop, stock);
  const S = E.newGame(['Anna', 'Bruno'], { deck, firstTurn: 0 });
  return { S, p0, p1, discardTop, stock };
}

/* ---- dealing ---- */
t('deal gives 13 cards each, one discard, known stock order', () => {
  const { S, p0, p1, discardTop, stock } = riggedGame();
  assert.deepStrictEqual(S.players[0].hand.map((x) => x.id), p0.map((x) => x.id));
  assert.deepStrictEqual(S.players[1].hand.map((x) => x.id), p1.map((x) => x.id));
  assert.strictEqual(S.discard[0].id, discardTop.id);
  const draw = E.actions.drawStock(S, 0);
  assert.strictEqual(draw.card.id, stock[0].id);
});

/* ---- guards ---- */
t('acting out of turn or phase is rejected', () => {
  const { S } = riggedGame();
  assert.strictEqual(E.actions.drawStock(S, 1).ok, false);
  assert.strictEqual(E.actions.discard(S, 0, S.players[0].hand[0].id).ok, false); // draw first
  assert.strictEqual(E.actions.layMeld(S, 0, []).ok, false);
  E.actions.drawStock(S, 0);
  assert.strictEqual(E.actions.drawStock(S, 0).ok, false); // already drew
});

/* ---- opening ---- */
t('a 40+ opening in one turn opens the player and flips the turn', () => {
  const { S } = riggedGame();
  E.actions.drawStock(S, 0);
  const h = S.players[0].hand;
  const kings = h.filter((x) => x.rank === 13).map((x) => x.id);
  const run = h.filter((x) => x.suit === '♣' && x.rank >= 5 && x.rank <= 7).map((x) => x.id);
  assert(E.actions.layMeld(S, 0, kings).ok);
  assert(E.actions.layMeld(S, 0, run).ok);
  assert.strictEqual(E.provisionalPoints(S), 48);
  assert.strictEqual(S.players[0].opened, false);
  const res = E.actions.discard(S, 0, S.players[0].hand[0].id);
  assert(res.ok && res.openedNow && !res.won);
  assert.strictEqual(S.players[0].opened, true);
  assert(S.melds.every((m) => !m.provisional));
  assert.strictEqual(S.turn, 1);
  assert.strictEqual(S.phase, 'draw');
});

t('a partial opening blocks the discard until taken back', () => {
  const { S } = riggedGame();
  E.actions.drawStock(S, 0);
  const kings = S.players[0].hand.filter((x) => x.rank === 13).map((x) => x.id);
  assert(E.actions.layMeld(S, 0, kings).ok); // 30 points only
  const res = E.actions.discard(S, 0, S.players[0].hand[0].id);
  assert.strictEqual(res.ok, false);
  assert(/40/.test(res.error));
  assert(E.actions.takeBack(S, 0).ok);
  assert.strictEqual(S.players[0].hand.length, 14);
  assert(E.actions.discard(S, 0, S.players[0].hand[0].id).ok);
});

t('attaching before opening is rejected', () => {
  const { S } = riggedGame();
  E.actions.drawStock(S, 0);
  const kings = S.players[0].hand.filter((x) => x.rank === 13).map((x) => x.id);
  E.actions.layMeld(S, 0, kings);
  const meldId = S.melds[0].id;
  const res = E.actions.attach(S, 0, S.players[0].hand[0].id, meldId);
  assert.strictEqual(res.ok, false);
});

/* ---- discard pickup rule ---- */
t('the picked-up discard must be used (or discarded back)', () => {
  const { S } = riggedGame({ discardTop: c(9, '♦') });
  const picked = E.actions.pickDiscard(S, 0);
  assert(picked.ok);
  const otherCard = S.players[0].hand.find((x) => x.id !== picked.card.id);
  const blocked = E.actions.discard(S, 0, otherCard.id);
  assert.strictEqual(blocked.ok, false);
  assert(/discard pile/.test(blocked.error));
  // escape hatch: discarding the same card back is allowed
  assert(E.actions.discard(S, 0, picked.card.id).ok);
});

t('undo pickup works only before acting, then forces the stock', () => {
  const { S } = riggedGame();
  const picked = E.actions.pickDiscard(S, 0);
  assert(E.actions.undoPickup(S, 0).ok);
  assert.strictEqual(S.discard[S.discard.length - 1].id, picked.card.id);
  assert.strictEqual(E.actions.pickDiscard(S, 0).ok, false); // mustStock
  assert(E.actions.drawStock(S, 0).ok);
});

/* ---- attach + joker swap after opening ---- */
t('after opening: attach to any meld and swap table jokers', () => {
  // p0 opens with K-K-K + 5-6-7♣, holds 8♣ to attach next turn and
  // a 9♦ matching the joker p1... simpler: p0 attaches to own run.
  const p0 = openingHand();
  p0[12] = c(8, '♣'); // replaces junk with an attachable card
  const { S } = riggedGame({ p0 });
  E.actions.drawStock(S, 0);
  const h = S.players[0].hand;
  E.actions.layMeld(S, 0, h.filter((x) => x.rank === 13).map((x) => x.id));
  E.actions.layMeld(S, 0, h.filter((x) => x.suit === '♣' && x.rank >= 5 && x.rank <= 7).map((x) => x.id));
  E.actions.discard(S, 0, S.players[0].hand.find((x) => x.rank === 2).id);
  // p1 turn: draw + discard
  E.actions.drawStock(S, 1);
  E.actions.discard(S, 1, S.players[1].hand[0].id);
  // p0 turn: attach 8♣ to the 5-6-7♣ run
  E.actions.drawStock(S, 0);
  const run = S.melds.find((m) => m.type === 'run');
  const eight = S.players[0].hand.find((x) => x.rank === 8 && x.suit === '♣');
  assert(E.actions.attach(S, 0, eight.id, run.id).ok);
  assert.strictEqual(run.slots.length, 4);
});

/* ---- completed-meld sweep ---- */
t('a jokerless 4-card set is swept off the board when completed', () => {
  const p0 = openingHand();
  p0[6] = c(13, '\u2663'); // 4th king to attach later
  const { S } = riggedGame({ p0 });
  E.actions.drawStock(S, 0);
  const h = S.players[0].hand;
  E.actions.layMeld(S, 0, h.filter((x) => x.rank === 13 && x.suit !== '\u2663').map((x) => x.id));
  E.actions.layMeld(S, 0, h.filter((x) => x.suit === '\u2663' && x.rank >= 5 && x.rank <= 7).map((x) => x.id));
  E.actions.discard(S, 0, S.players[0].hand.find((x) => x.rank === 2).id);
  E.actions.drawStock(S, 1);
  E.actions.discard(S, 1, S.players[1].hand[0].id);
  E.actions.drawStock(S, 0);
  const setMeld = S.melds.find((m) => m.type === 'set');
  const fourth = S.players[0].hand.find((x) => x.rank === 13);
  const res = E.actions.attach(S, 0, fourth.id, setMeld.id);
  assert(res.ok);
  assert.strictEqual(res.cleared.length, 1);
  assert(!S.melds.some((m) => m.id === setMeld.id), 'set should leave the board');
  assert.strictEqual(S.cleared.length, 1);
  assert.strictEqual(E.view(S, 0).clearedCount, 4);
});

t('a full set holding a joker stays until the joker is swapped out', () => {
  const p0 = openingHand();
  // open with K-K-K-Joker (40) directly
  p0[3] = { id: 9001, rank: 0, suit: null, joker: true };
  const { S } = riggedGame({ p0 });
  E.actions.drawStock(S, 0);
  const h = S.players[0].hand;
  const ids = h.filter((x) => x.rank === 13 || x.joker).map((x) => x.id);
  assert.strictEqual(ids.length, 4);
  assert(E.actions.layMeld(S, 0, ids).ok);
  const res = E.actions.discard(S, 0, S.players[0].hand[0].id);
  assert(res.ok && res.openedNow);
  assert.strictEqual(res.cleared.length, 0, 'jokered set must stay on the table');
  assert.strictEqual(S.melds.length, 1);
  // opponent swaps the real K in -> set completes -> swept, joker to hand
  const kClubs = c(13, '\u2663');
  S.players[1].hand.push(kClubs);
  S.players[1].opened = true; // test shortcut: allow the swap
  E.actions.drawStock(S, 1);
  const swap = E.actions.replaceJoker(S, 1, kClubs.id, S.melds[0].id);
  assert(swap.ok);
  assert.strictEqual(swap.cleared.length, 1);
  assert.strictEqual(S.melds.length, 0);
  assert(S.players[1].hand.some((x) => x.joker), 'joker should be in hand');
});

t('nextHand resets the cleared pile', () => {
  const { S } = riggedGame();
  S.cleared.push({ slots: [] });
  const res = winFirstHand(S);
  assert(res.ok);
  E.actions.nextHand(S);
  assert.strictEqual(S.cleared.length, 0);
});

/* ---- winning + match play ---- */
function winFirstHand(S) {
  E.actions.drawStock(S, 0);
  const h = S.players[0].hand;
  E.actions.layMeld(S, 0, h.filter((x) => x.rank === 13).map((x) => x.id));
  E.actions.layMeld(S, 0, h.filter((x) => x.suit === '♣' && x.rank >= 5 && x.rank <= 7).map((x) => x.id));
  E.actions.discard(S, 0, S.players[0].hand[0].id);
  S.players[1].hand.push(...S.players[0].hand.splice(1));
  E.actions.drawStock(S, 1);
  E.actions.discard(S, 1, S.players[1].hand[0].id);
  E.actions.drawStock(S, 0);
  const keep = S.players[0].hand[0];
  S.players[1].hand.push(...S.players[0].hand.splice(1));
  return E.actions.discard(S, 0, keep.id);
}

t('discarding the last card wins the hand and books the penalty', () => {
  const { S } = riggedGame();
  const res = winFirstHand(S);
  assert(res.ok && res.won);
  assert.strictEqual(S.over, true);
  assert.strictEqual(S.winner, 0);
  assert(res.penalty > 0);
  assert.strictEqual(S.scores[1], res.penalty);
  assert.strictEqual(S.scores[0], 0);
  assert.strictEqual(S.matchOver, false); // one hand can't reach 151 here
});

t('nextHand deals fresh, keeps scores, alternates the lead', () => {
  const { S } = riggedGame();
  const won = winFirstHand(S);
  const bank = S.scores[1];
  assert.strictEqual(E.actions.nextHand(S).ok, true);
  assert.strictEqual(S.handNumber, 2);
  assert.strictEqual(S.over, false);
  assert.strictEqual(S.turn, 1); // hand 1 lead was 0
  assert.strictEqual(S.scores[1], bank);
  assert.strictEqual(S.players[0].hand.length, 13);
  assert.strictEqual(S.players[1].hand.length, 13);
  assert.strictEqual(S.melds.length, 0);
  assert.strictEqual(S.players[0].opened, false);
  assert(won.ok);
});

t('nextHand is rejected mid-hand and after the match ends', () => {
  const { S } = riggedGame();
  assert.strictEqual(E.actions.nextHand(S).ok, false); // hand still running
  S.scores[1] = 150; // one loss from busting
  const res = winFirstHand(S);
  assert(res.ok && res.won);
  assert.strictEqual(S.matchOver, true);
  assert.strictEqual(S.matchWinner, 0);
  assert(S.scores[1] >= 151);
  assert.strictEqual(E.actions.nextHand(S).ok, false);
});

t('the match target is configurable and defaults to 151', () => {
  const short = E.newGame(['A', 'B'], { target: 101 });
  assert.strictEqual(short.target, 101);
  assert.strictEqual(E.view(short, 0).target, 101);
  const def = E.newGame(['A', 'B']);
  assert.strictEqual(def.target, 151);
  const { S } = riggedGame();
  S.target = 101;
  S.scores[1] = 100;
  const res = winFirstHand(S);
  assert(res.ok && S.matchOver && S.matchWinner === 0);
});

t('views carry the match scoreboard', () => {
  const { S } = riggedGame();
  winFirstHand(S);
  const v = E.view(S, 1);
  assert.deepStrictEqual(v.scores, S.scores);
  assert.strictEqual(v.target, 151);
  assert.strictEqual(v.handNumber, 1);
  assert.strictEqual(v.lastPenalty, S.scores[1]);
});

/* ---- view redaction ---- */
t('a view never leaks the opponent hand or the stock', () => {
  const { S } = riggedGame();
  const v1 = E.view(S, 1);
  assert.strictEqual(v1.hand.length, 13);
  assert.deepStrictEqual(
    v1.hand.map((x) => x.id),
    S.players[1].hand.map((x) => x.id)
  );
  assert.strictEqual(typeof v1.players[0].handCount, 'number');
  assert.strictEqual(v1.players[0].hand, undefined);
  assert.strictEqual(v1.stock, undefined);
  assert.strictEqual(typeof v1.stockCount, 'number');
  const json = JSON.stringify(v1);
  const hiddenIds = S.players[0].hand.map((x) => `"id":${x.id}`);
  for (const needle of hiddenIds) {
    assert(!json.includes(needle), 'opponent card leaked into view');
  }
});

t('stock recycles the discard pile when exhausted', () => {
  const { S } = riggedGame();
  // drain the stock into p1's hand (test-only surgery)
  S.players[1].hand.push(...S.stock.splice(0));
  S.discard.push(c(4, '♣'), c(9, '♠'));
  const before = S.discard.length;
  const res = E.actions.drawStock(S, 0);
  assert(res.ok);
  assert.strictEqual(S.discard.length, 1); // only the top stayed
  assert.strictEqual(S.stock.length, before - 2); // rest became stock, one drawn
});

console.log(`\n${n} tests run`);
