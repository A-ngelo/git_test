/* Node test suite for the ranked stats store. Run: node test/stats.test.js */
'use strict';

process.env.STATS_FILE = require('path').join(
  require('os').tmpdir(),
  `scala40-stats-test-${Date.now()}.json`
);

const assert = require('assert');
const Stats = require('../server/stats.js');

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

const A = { pid: 'a'.repeat(32), name: 'Anna' };
const B = { pid: 'b'.repeat(32), name: 'Bruno' };
const C = { pid: 'c'.repeat(32), name: 'Carla' };

t('hands accumulate per mode with penalties for losers only', () => {
  Stats.recordHand([A, B], '2', 0, [0, 100]);
  Stats.recordHand([A, B], '2', 1, [37, 0]);
  const a = Stats.playerStats(A.pid).modes['2'];
  const b = Stats.playerStats(B.pid).modes['2'];
  assert.strictEqual(a.handsPlayed, 2);
  assert.strictEqual(a.handsWon, 1);
  assert.strictEqual(a.pointsTaken, 37);
  assert.strictEqual(b.handsWon, 1);
  assert.strictEqual(b.pointsTaken, 100);
});

t('match results move Elo in opposite directions and count wins', () => {
  Stats.recordMatch([A, B], '2', [0, 1]); // Anna beats Bruno
  const a = Stats.playerStats(A.pid).modes['2'];
  const b = Stats.playerStats(B.pid).modes['2'];
  assert(a.rating > 1000, `winner should gain, got ${a.rating}`);
  assert(b.rating < 1000, `loser should drop, got ${b.rating}`);
  assert.strictEqual(a.rating - 1000, 1000 - b.rating); // symmetric at equal ratings
  assert.strictEqual(a.games, 1);
  assert.strictEqual(a.wins, 1);
  assert.strictEqual(b.wins, 0);
  assert.strictEqual(a.streak, 1);
  assert.strictEqual(b.streak, -1);
});

t('streaks grow and reset across matches', () => {
  Stats.recordMatch([A, B], '2', [0, 1]);
  Stats.recordMatch([A, B], '2', [0, 1]);
  let a = Stats.playerStats(A.pid).modes['2'];
  assert.strictEqual(a.streak, 3);
  assert.strictEqual(a.bestStreak, 3);
  Stats.recordMatch([A, B], '2', [1, 0]); // Bruno finally wins
  a = Stats.playerStats(A.pid).modes['2'];
  const b = Stats.playerStats(B.pid).modes['2'];
  assert.strictEqual(a.streak, -1);
  assert.strictEqual(a.bestStreak, 3);
  assert.strictEqual(b.streak, 1);
});

t('multiplayer matches score pairwise by placement and stay separate per mode', () => {
  Stats.recordMatch([A, B, C], '3', [2, 0, 1]); // Carla > Anna > Bruno
  const a3 = Stats.playerStats(A.pid).modes['3'];
  const b3 = Stats.playerStats(B.pid).modes['3'];
  const c3 = Stats.playerStats(C.pid).modes['3'];
  assert(c3.rating > a3.rating && a3.rating > b3.rating);
  assert.strictEqual(c3.wins, 1);
  assert.strictEqual(a3.wins, 0);
  // 1v1 ladder untouched by the 3P match
  const a2 = Stats.playerStats(A.pid).modes['2'];
  assert.strictEqual(a2.games, 4);
});

t('leaderboard sorts by rating and only lists players with games', () => {
  const board = Stats.leaderboard('2');
  assert(board.length >= 2);
  for (let i = 1; i < board.length; i++) {
    assert(board[i - 1].rating >= board[i].rating);
  }
  assert(board.every((e) => e.games > 0 && typeof e.name === 'string'));
  assert.deepStrictEqual(Stats.leaderboard('4'), []);
});

t('unknown players read as empty, seats without pid are skipped', () => {
  assert.deepStrictEqual(Stats.playerStats('nope').modes, {});
  Stats.recordHand([{ pid: null, name: 'Ghost' }, A], '2', 0, [0, 10]);
  assert.strictEqual(Stats.playerStats(A.pid).modes['2'].pointsTaken, 47);
});

console.log(`\n${n} tests run`);
