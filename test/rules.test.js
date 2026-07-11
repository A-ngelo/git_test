/* Node test suite for the Scala 40 rules + AI modules. Run: node test/rules.test.js */
'use strict';

const assert = require('assert');
const R = require('../js/rules.js');
const AI = require('../js/ai.js');

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

let seq = 1000;
const c = (rank, suit) => ({ id: seq++, rank, suit, joker: false });
const joker = () => ({ id: seq++, rank: 0, suit: null, joker: true });

/* ---- deck ---- */
t('deck has 108 cards with 4 jokers and unique ids', () => {
  const d = R.makeDeck();
  assert.strictEqual(d.length, 108);
  assert.strictEqual(d.filter((x) => x.joker).length, 4);
  assert.strictEqual(new Set(d.map((x) => x.id)).size, 108);
});

/* ---- runs ---- */
t('A-2-3 is a valid low run worth 6', () => {
  const m = R.validateMeld([c(1, '♥'), c(2, '♥'), c(3, '♥')]);
  assert(m && m.type === 'run');
  assert.strictEqual(m.points, 6);
});

t('Q-K-A is a valid high run worth 31', () => {
  const m = R.validateMeld([c(12, '♠'), c(13, '♠'), c(1, '♠')]);
  assert(m && m.type === 'run');
  assert.strictEqual(m.points, 31);
});

t('K-A-2 wrap-around is not a run', () => {
  assert.strictEqual(R.validateMeld([c(13, '♠'), c(1, '♠'), c(2, '♠')]), null);
});

t('mixed suits are not a run', () => {
  assert.strictEqual(R.validateMeld([c(5, '♠'), c(6, '♥'), c(7, '♠')]), null);
});

t('duplicate rank in a run is invalid', () => {
  assert.strictEqual(R.validateMeld([c(5, '♦'), c(5, '♦'), c(6, '♦')]), null);
});

t('joker fills an internal gap (5-6-J*-8 = 26)', () => {
  const m = R.validateMeld([c(5, '♦'), c(6, '♦'), c(8, '♦'), joker()]);
  assert(m && m.type === 'run');
  assert.strictEqual(m.points, 26);
  assert.strictEqual(m.slots[2].card.joker, true);
  assert.strictEqual(m.slots[2].v, 7);
});

t('joker extends the high end by default (5-6 + joker -> 7)', () => {
  const m = R.validateMeld([c(5, '♦'), c(6, '♦'), joker()]);
  assert(m && m.slots[2].card.joker && m.slots[2].v === 7);
  assert.strictEqual(m.points, 18);
});

t('joker extends low when high is blocked (Q-K-A + joker -> J)', () => {
  const m = R.validateMeld([c(12, '♣'), c(13, '♣'), c(1, '♣'), joker()]);
  assert(m && m.slots[0].card.joker && m.slots[0].v === 11);
  assert.strictEqual(m.points, 41);
});

t('two jokers in one meld are invalid', () => {
  assert.strictEqual(R.validateMeld([c(5, '♦'), joker(), joker()]), null);
});

/* ---- sets ---- */
t('9-9-9 in three suits is a 27-point set', () => {
  const m = R.validateMeld([c(9, '♠'), c(9, '♥'), c(9, '♦')]);
  assert(m && m.type === 'set');
  assert.strictEqual(m.points, 27);
});

t('set with a repeated suit is invalid', () => {
  assert.strictEqual(R.validateMeld([c(9, '♠'), c(9, '♠'), c(9, '♥')]), null);
});

t('four aces are worth 44', () => {
  const m = R.validateMeld([c(1, '♠'), c(1, '♥'), c(1, '♦'), c(1, '♣')]);
  assert(m && m.points === 44);
});

t('7-7 + joker is a 21-point set', () => {
  const m = R.validateMeld([c(7, '♠'), c(7, '♥'), joker()]);
  assert(m && m.type === 'set' && m.points === 21);
});

t('five cards are not a set', () => {
  assert.strictEqual(
    R.trySet([c(9, '♠'), c(9, '♥'), c(9, '♦'), c(9, '♣'), joker()]),
    null
  );
});

/* ---- attaching ---- */
function meldOf(cards) {
  const m = R.validateMeld(cards);
  assert(m, 'fixture meld must be valid');
  return m;
}

t('8♥ and 4♥ attach to a 5-6-7♥ run; 3♥ does not (yet)', () => {
  const m = meldOf([c(5, '♥'), c(6, '♥'), c(7, '♥')]);
  assert(R.canAttach(m, c(8, '♥')));
  assert(R.canAttach(m, c(4, '♥')));
  assert.strictEqual(R.canAttach(m, c(3, '♥')), null);
  assert(R.applyAttach(m, c(4, '♥')));
  assert(R.canAttach(m, c(3, '♥')));
  assert.strictEqual(m.slots[0].v, 4);
});

t('ace attaches low to 2-3-4 and high to J-Q-K', () => {
  const low = meldOf([c(2, '♦'), c(3, '♦'), c(4, '♦')]);
  assert.strictEqual(R.canAttach(low, c(1, '♦')).v, 1);
  const high = meldOf([c(11, '♦'), c(12, '♦'), c(13, '♦')]);
  assert.strictEqual(R.canAttach(high, c(1, '♦')).v, 14);
});

t('a full A..K run accepts nothing more', () => {
  const cards = [];
  for (let r = 1; r <= 13; r++) cards.push(c(r, '♣'));
  const m = meldOf(cards);
  assert.strictEqual(R.canAttach(m, c(1, '♣')), null);
  assert.strictEqual(R.canAttach(m, joker()), null);
});

t('fourth suit attaches to a set, duplicates and fifth cards do not', () => {
  const m = meldOf([c(9, '♠'), c(9, '♥'), c(9, '♦')]);
  assert.strictEqual(R.canAttach(m, c(9, '♥')), null);
  assert(R.applyAttach(m, c(9, '♣')));
  assert.strictEqual(R.canAttach(m, joker()), null);
});

t('joker attaches to a run without a joker, not to one that has one', () => {
  const m = meldOf([c(5, '♥'), c(6, '♥'), c(7, '♥')]);
  assert(R.applyAttach(m, joker()));
  assert.strictEqual(m.slots[3].v, 8);
  assert.strictEqual(R.canAttach(m, joker()), null);
});

/* ---- joker replacement ---- */
t('the real card swaps a joker out of a run', () => {
  const m = meldOf([c(5, '♦'), c(6, '♦'), c(8, '♦'), joker()]); // joker = 7♦
  assert.strictEqual(R.canReplaceJoker(m, c(7, '♥')), null);
  const got = R.applyReplaceJoker(m, c(7, '♦'));
  assert(got && got.joker);
  assert(m.slots.every((s) => !s.card.joker));
});

t('a matching rank in a missing suit swaps a joker out of a set', () => {
  const m = meldOf([c(9, '♠'), c(9, '♥'), joker()]);
  assert.strictEqual(R.canReplaceJoker(m, c(9, '♠')), null);
  const got = R.applyReplaceJoker(m, c(9, '♦'));
  assert(got && got.joker);
});

/* ---- scoring ---- */
t('hand penalties: joker 25, ace 11, king 10, five 5', () => {
  assert.strictEqual(R.handPenalty(joker()), 25);
  assert.strictEqual(R.handPenalty(c(1, '♠')), 11);
  assert.strictEqual(R.handPenalty(c(13, '♠')), 10);
  assert.strictEqual(R.handPenalty(c(5, '♠')), 5);
});

/* ---- AI ---- */
t('AI finds a 40+ opening when one exists', () => {
  // K-K-K (30) + 5-6-7 (18) = 48
  const hand = [
    c(13, '♠'), c(13, '♥'), c(13, '♦'),
    c(5, '♣'), c(6, '♣'), c(7, '♣'),
    c(2, '♠'), c(9, '♥'), c(4, '♦'), c(10, '♣'),
    c(3, '♠'), c(8, '♥'), c(12, '♦'), c(2, '♥'),
  ];
  const combo = AI.bestCombo(AI.generateMelds(hand));
  assert(combo.points >= 48, `expected >= 48, got ${combo.points}`);
});

t('AI does not fabricate an opening from nothing', () => {
  const hand = [
    c(2, '♠'), c(5, '♥'), c(9, '♦'), c(11, '♣'),
    c(3, '♠'), c(7, '♥'), c(12, '♦'), c(4, '♣'),
    c(6, '♠'), c(10, '♥'), c(13, '♦'), c(8, '♣'), c(2, '♦'),
  ];
  const combo = AI.bestCombo(AI.generateMelds(hand));
  assert(combo.points < 40, `expected < 40, got ${combo.points}`);
});

t('AI uses a joker to reach the opening', () => {
  // A-A + joker = 33 as a set... plus 4-5-6 = 15 -> 48
  const hand = [
    c(1, '♠'), c(1, '♥'), joker(),
    c(4, '♦'), c(5, '♦'), c(6, '♦'),
    c(2, '♣'), c(9, '♠'), c(12, '♥'), c(3, '♦'),
    c(8, '♣'), c(10, '♠'), c(7, '♥'), c(13, '♣'),
  ];
  const combo = AI.bestCombo(AI.generateMelds(hand));
  assert(combo.points >= 40, `expected >= 40, got ${combo.points}`);
});

t('AI plan always ends with exactly one discard and keeps hands legal', () => {
  const hand = [
    c(13, '♠'), c(13, '♥'), c(13, '♦'),
    c(5, '♣'), c(6, '♣'), c(7, '♣'),
    c(2, '♠'), c(9, '♥'), c(4, '♦'), c(10, '♣'),
    c(3, '♠'), c(8, '♥'), c(12, '♦'), c(2, '♥'),
  ];
  const state = { melds: [], discard: [] };
  const player = { hand, opened: false };
  const plan = AI.planPlay(state, player, null);
  const discards = plan.filter((a) => a.type === 'discard');
  assert.strictEqual(discards.length, 1);
  assert.strictEqual(plan[plan.length - 1].type, 'discard');
  const usedIds = plan
    .filter((a) => a.type === 'meld')
    .flatMap((a) => a.cardIds)
    .concat(plan.filter((a) => a.type === 'attach').map((a) => a.cardId))
    .concat(discards.map((a) => a.cardId));
  assert(usedIds.length < hand.length, 'must keep at least a card melded/held legally');
  assert.strictEqual(new Set(usedIds).size, usedIds.length, 'no card used twice');
});

t('AI takes the discard only when it is usable', () => {
  const player = {
    opened: true,
    hand: [c(5, '♥'), c(6, '♥'), c(9, '♣'), c(2, '♦')],
  };
  const run = meldOf([c(10, '♠'), c(11, '♠'), c(12, '♠')]);
  const stateYes = { melds: [run], discard: [c(13, '♠')] };
  assert.strictEqual(AI.chooseDraw(stateYes, player), 'discard');
  const stateMeld = { melds: [], discard: [c(7, '♥')] }; // completes 5-6-7♥
  assert.strictEqual(AI.chooseDraw(stateMeld, player), 'discard');
  const stateNo = { melds: [], discard: [c(2, '♠')] };
  assert.strictEqual(AI.chooseDraw(stateNo, player), 'stock');
});

console.log(`\n${n} tests run`);
