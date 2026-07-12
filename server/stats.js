/*
 * Scala 40 — ranked stats store.
 * Tracks per-player records separately for each mode (2/3/4 seats):
 * Elo rating (pairwise by final placement in multiplayer), match wins,
 * streaks, hands won/played and penalty points taken. Persists to a
 * JSON file with debounced writes; identity is the anonymous pid each
 * client generates and keeps in localStorage.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = process.env.STATS_FILE || path.join(__dirname, 'stats.json');
const ELO_K = 32;

let data = { players: {} };
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!data || typeof data !== 'object' || !data.players) data = { players: {} };
} catch {
  /* first boot */
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(FILE, JSON.stringify(data));
    } catch (e) {
      console.error('stats save failed:', e.message);
    }
  }, 500);
}

function freshMode() {
  return {
    rating: 1000,
    games: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    handsWon: 0,
    handsPlayed: 0,
    pointsTaken: 0,
  };
}

function ensure(pid, name) {
  const p = data.players[pid] || (data.players[pid] = { name: name || 'Player', modes: {} });
  if (name) p.name = name;
  return p;
}

function ensureMode(player, mode) {
  return player.modes[mode] || (player.modes[mode] = freshMode());
}

/* seats: [{ pid, name }] aligned with engine player indexes. */
function recordHand(seats, mode, winnerIndex, penalties) {
  seats.forEach((seat, i) => {
    if (!seat.pid) return;
    const m = ensureMode(ensure(seat.pid, seat.name), mode);
    m.handsPlayed++;
    if (i === winnerIndex) m.handsWon++;
    else m.pointsTaken += penalties[i] || 0;
  });
  save();
}

/* placements: player indexes best -> worst. Pairwise Elo: every pair is
 * scored as a 1v1 the better-placed player won. */
function recordMatch(seats, mode, placements) {
  const modes = seats.map((seat) => (seat.pid ? ensureMode(ensure(seat.pid, seat.name), mode) : null));
  const newRating = modes.map((m) => (m ? m.rating : null));
  for (let a = 0; a < placements.length; a++) {
    for (let b = a + 1; b < placements.length; b++) {
      const winner = placements[a];
      const loser = placements[b];
      if (!modes[winner] || !modes[loser]) continue;
      const expected = 1 / (1 + Math.pow(10, (modes[loser].rating - modes[winner].rating) / 400));
      newRating[winner] += ELO_K * (1 - expected);
      newRating[loser] -= ELO_K * (1 - expected);
    }
  }
  seats.forEach((seat, i) => {
    const m = modes[i];
    if (!m) return;
    m.rating = Math.round(newRating[i]);
    m.games++;
    if (placements[0] === i) {
      m.wins++;
      m.streak = m.streak > 0 ? m.streak + 1 : 1;
      m.bestStreak = Math.max(m.bestStreak, m.streak);
    } else {
      m.streak = m.streak < 0 ? m.streak - 1 : -1;
    }
  });
  save();
}

function leaderboard(mode, limit) {
  const rows = [];
  for (const p of Object.values(data.players)) {
    const m = p.modes[mode];
    if (!m || !m.games) continue;
    rows.push({ name: p.name, rating: m.rating, games: m.games, wins: m.wins });
  }
  rows.sort((a, b) => b.rating - a.rating || b.wins - a.wins);
  return rows.slice(0, limit || 25);
}

function playerStats(pid) {
  const p = pid && data.players[pid];
  return p ? { name: p.name, modes: p.modes } : { name: null, modes: {} };
}

module.exports = { recordHand, recordMatch, leaderboard, playerStats };
