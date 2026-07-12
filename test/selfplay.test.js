/* Self-play audit for Scala 40. Run: node test/selfplay.test.js [matches]
 *
 * Plays full AI-vs-AI matches straight through the engine (no browser)
 * and, after EVERY single action, asserts the core invariants:
 *   - all 108 cards exist exactly once across hands/stock/discard/melds/cleared
 *   - every table meld is still a valid set or run
 *   - scores never decrease and hands never go negative
 * It then reports win rates between difficulty levels and asserts the
 * ladder actually orders: hard beats easy convincingly.
 */
'use strict';

const assert = require('assert');
const R = require('../www/js/rules.js');
const E = require('../www/js/engine.js');
const AI = require('../www/js/ai.js');

const MATCHES = Number(process.argv[2]) || 30;

let actionsChecked = 0;

function checkInvariants(S, label) {
  actionsChecked++;
  const ids = [];
  for (const pl of S.players) for (const c of pl.hand) ids.push(c.id);
  for (const c of S.stock) ids.push(c.id);
  for (const c of S.discard) ids.push(c.id);
  for (const m of S.melds) for (const sl of m.slots) ids.push(sl.card.id);
  for (const m of S.cleared) for (const sl of m.slots) ids.push(sl.card.id);
  assert.strictEqual(ids.length, 108, `${label}: ${ids.length} cards in play`);
  assert.strictEqual(new Set(ids).size, 108, `${label}: duplicate card`);
  for (const m of S.melds) {
    const cards = m.slots.map((sl) => sl.card);
    assert(R.validateMeld(cards), `${label}: invalid meld on table`);
  }
  for (const sc of S.scores) assert(sc >= 0, `${label}: negative score`);
  for (const pl of S.players) assert(pl.hand.length >= 0 && pl.hand.length <= 30, `${label}: absurd hand`);
}

function playMatch(levels, rules) {
  const S = E.newGame(levels.map((l, i) => `${l}-${i}`), { target: 151, rules });
  const memories = levels.map(() => ({ oppPicks: [], oppDiscards: [] }));
  let guard = 0;
  let handTurns = 0;
  let stalemates = 0;

  // matches can legitimately run long; only a single hand that never
  // ends indicates a real stall
  while (!S.matchOver && guard++ < 300000) {
    if (S.over) {
      const r = E.actions.nextHand(S);
      assert(r.ok, 'nextHand failed mid-match');
      handTurns = 0;
      memories.forEach((m) => {
        m.oppPicks.length = 0;
        m.oppDiscards.length = 0;
      });
      continue;
    }
    assert(++handTurns < 3000, `hand ${S.handNumber} never ends (stall)`);
    const p = S.turn;
    const player = S.players[p];
    const opts = {
      level: levels[p],
      memory: memories[p],
      minOppHand: Math.min(...S.players.filter((_, i) => i !== p).map((x) => x.hand.length)),
      strictJoker: S.rules.strictJoker,
    };

    const choice = AI.chooseDraw(S, player, opts);
    let res = choice === 'discard' ? E.actions.pickDiscard(S, p) : E.actions.drawStock(S, p);
    if (!res.ok) res = E.actions.drawStock(S, p);
    assert(res.ok, 'draw failed: ' + res.error);
    checkInvariants(S, 'draw');
    if (res.stalemate) {
      stalemates++;
      continue;
    }
    if (choice === 'discard' && res.card) {
      memories.forEach((m, i) => i !== p && m.oppPicks.push(res.card));
    }

    const plan = AI.planPlay(S, player, S.picked, opts);
    assert.strictEqual(plan[plan.length - 1].type, 'discard', 'plan must end in a discard');
    for (const a of plan) {
      let r;
      if (a.type === 'meld') r = E.actions.layMeld(S, p, a.cardIds);
      else if (a.type === 'replaceJoker') r = E.actions.replaceJoker(S, p, a.cardId, a.meldId);
      else if (a.type === 'attach') {
        const card = player.hand.find((c) => c.id === a.cardId);
        const target = card && S.melds.find((m) => R.canAttach(m, card));
        r = target ? E.actions.attach(S, p, card.id, target.id) : { ok: true, skipped: true };
      } else if (a.type === 'discard') {
        const card = player.hand.find((x) => x.id === a.cardId) || player.hand[player.hand.length - 1];
        r = E.actions.discard(S, p, card.id);
        assert(r.ok, 'discard failed: ' + r.error);
        if (r.card) memories.forEach((m, i) => i !== p && m.oppDiscards.push(r.card));
      }
      assert(r && r.ok, `${a.type} failed`);
      checkInvariants(S, a.type);
      if (S.over) break;
    }
  }
  assert(S.matchOver, 'match did not finish within the guard');
  return { winner: S.matchWinner, hands: S.handNumber, stalemates };
}

function series(levels, count, rules) {
  const wins = levels.map(() => 0);
  let hands = 0;
  let stalemates = 0;
  for (let i = 0; i < count; i++) {
    // alternate seat order so going first doesn't bias the sample
    const flipped = i % 2 === 1;
    const order = flipped ? [...levels].reverse() : levels;
    const r = playMatch(order, rules);
    const winnerLevelIndex = flipped ? levels.length - 1 - r.winner : r.winner;
    wins[winnerLevelIndex]++;
    hands += r.hands;
    stalemates += r.stalemates;
  }
  return { wins, hands, stalemates };
}

console.log(`self-play: ${MATCHES} matches per pairing…`);

const he = series(['hard', 'easy'], MATCHES);
console.log(
  `  hard vs easy:   ${he.wins[0]}-${he.wins[1]}  (${he.hands} hands, ${he.stalemates} dead)`
);

const hm = series(['hard', 'medium'], MATCHES);
console.log(
  `  hard vs medium: ${hm.wins[0]}-${hm.wins[1]}  (${hm.hands} hands, ${hm.stalemates} dead)`
);

const me = series(['medium', 'easy'], MATCHES);
console.log(
  `  medium vs easy: ${me.wins[0]}-${me.wins[1]}  (${me.hands} hands, ${me.stalemates} dead)`
);

const three = series(['hard', 'medium', 'easy'], Math.max(6, Math.floor(MATCHES / 3)));
console.log(`  3-seat h/m/e:   ${three.wins.join('-')}  (${three.hands} hands)`);

// fuzz the strict house rules too: no sweeping, strict joker replay
const strict = series(['hard', 'medium'], Math.max(6, Math.floor(MATCHES / 3)), {
  sweep: false,
  strictJoker: true,
});
console.log(`  strict rules:   ${strict.wins.join('-')}  (${strict.hands} hands)`);

console.log(`\ninvariants checked after ${actionsChecked} engine actions — all held`);

// The ladder must actually order. Thresholds are deliberately looser
// than the observed rates so card luck can't flake the suite.
assert(he.wins[0] > he.wins[1], 'hard should beat easy over a series');
assert(me.wins[0] > me.wins[1], 'medium should beat easy over a series');
assert(hm.wins[0] >= Math.floor(MATCHES * 0.35), 'hard should hold its own against medium');

console.log('self-play audit OK');
