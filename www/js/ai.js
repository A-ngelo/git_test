/*
 * Scala 40 — computer opponent with three difficulty levels.
 *
 *   easy    Casual: never reads the discard pile, hesitates to lay melds,
 *           misses attachments, and its discards ignore the table.
 *   medium  Solid club player: backtracking 40+ opening solver, takes the
 *           discard only when immediately usable, attaches everything,
 *           table-aware discards, never lets a joker go.
 *   hard    Everything medium does, plus: an opponent model built from
 *           what you take and shed (never feeds your melds), endgame
 *           danger awareness (dumps expensive cards when someone is about
 *           to close), and it reclaims table jokers it can replace.
 *
 * Pure logic, no DOM. Callers pass opts = { level, memory, minOppHand }
 * where memory = { oppPicks: [cards], oppDiscards: [cards] }.
 */
(function (global) {
  'use strict';

  const R =
    typeof module !== 'undefined' && typeof require === 'function'
      ? require('./rules.js')
      : global.Rules;

  function combos(arr, k) {
    const out = [];
    (function rec(start, cur) {
      if (cur.length === k) {
        out.push(cur.slice());
        return;
      }
      for (let i = start; i < arr.length; i++) {
        cur.push(arr[i]);
        rec(i + 1, cur);
        cur.pop();
      }
    })(0, []);
    return out;
  }

  /* ---------- meld discovery (all levels) ---------- */

  function generateMelds(hand) {
    const melds = [];
    const jokers = hand.filter((c) => c.joker);

    // Sets: group by rank, one card per suit.
    const byRank = new Map();
    for (const c of hand) {
      if (c.joker) continue;
      if (!byRank.has(c.rank)) byRank.set(c.rank, new Map());
      const suitMap = byRank.get(c.rank);
      if (!suitMap.has(c.suit)) suitMap.set(c.suit, c);
    }
    for (const suitMap of byRank.values()) {
      const uniq = [...suitMap.values()];
      for (const k of [3, 4]) {
        for (const cs of combos(uniq, k)) {
          const m = R.validateMeld(cs);
          if (m) melds.push(m);
        }
      }
      if (jokers.length) {
        for (const k of [2, 3]) {
          for (const cs of combos(uniq, k)) {
            const m = R.validateMeld(cs.concat([jokers[0]]));
            if (m) melds.push(m);
          }
        }
      }
    }

    // Runs: per suit, map each value 1..14 to a card (the Ace covers
    // both ends) and slide every window of length 3..13 over it.
    for (const suit of R.SUITS) {
      const byVal = new Map();
      for (const c of hand) {
        if (c.joker || c.suit !== suit) continue;
        if (c.rank === 1) {
          if (!byVal.has(1)) byVal.set(1, c);
          if (!byVal.has(14)) byVal.set(14, c);
        } else if (!byVal.has(c.rank)) {
          byVal.set(c.rank, c);
        }
      }
      if (byVal.size < 2) continue;
      for (let a = 1; a <= 12; a++) {
        for (let len = 3; len <= 13; len++) {
          const b = a + len - 1;
          if (b > 14) break;
          const cards = [];
          let missing = 0;
          for (let v = a; v <= b; v++) {
            const c = byVal.get(v);
            if (c) cards.push(c);
            else missing++;
          }
          if (missing === 0) {
            const m = R.validateMeld(cards);
            if (m) melds.push(m);
          } else if (missing === 1 && jokers.length) {
            const m = R.validateMeld(cards.concat([jokers[0]]));
            if (m) melds.push(m);
          }
        }
      }
    }
    return melds;
  }

  /* Best disjoint combination of melds, maximising total points. */
  function bestCombo(melds) {
    const sorted = [...melds].sort((a, b) => b.points - a.points);
    const suffix = new Array(sorted.length + 1).fill(0);
    for (let i = sorted.length - 1; i >= 0; i--) {
      suffix[i] = suffix[i + 1] + sorted[i].points;
    }
    let best = { points: 0, melds: [] };
    const used = new Set();

    (function rec(i, cur, pts) {
      if (pts > best.points) best = { points: pts, melds: cur.slice() };
      if (i >= sorted.length || pts + suffix[i] <= best.points) return;
      for (let j = i; j < sorted.length; j++) {
        if (pts + suffix[j] <= best.points) break;
        const m = sorted[j];
        if (m.slots.some((s) => used.has(s.card.id))) continue;
        m.slots.forEach((s) => used.add(s.card.id));
        cur.push(m);
        rec(j + 1, cur, pts + m.points);
        cur.pop();
        m.slots.forEach((s) => used.delete(s.card.id));
      }
    })(0, [], 0);
    return best;
  }

  /* ---------- opponent model (hard) ----------
   * Positive = the opponent probably collects cards like this one,
   * negative = they shed cards like it, so it is a safer discard. */
  function feedRisk(card, memory) {
    if (!memory || card.joker) return 0;
    let risk = 0;
    for (const p of memory.oppPicks || []) {
      if (p.joker) continue;
      if (p.rank === card.rank) risk += 2;
      if (p.suit === card.suit && Math.abs(p.rank - card.rank) <= 2) risk += 2;
    }
    for (const d of memory.oppDiscards || []) {
      if (d.joker) continue;
      if (d.rank === card.rank) risk -= 1;
      if (d.suit === card.suit && Math.abs(d.rank - card.rank) <= 1) risk -= 1;
    }
    return risk;
  }

  /* ---------- decisions ---------- */

  function usefulness(card, hand) {
    if (card.joker) return 100;
    let u = 0;
    for (const o of hand) {
      if (o === card || o.joker) continue;
      if (o.rank === card.rank && o.suit !== card.suit) u += 2;
      if (o.suit === card.suit) {
        const d = Math.abs(o.rank - card.rank);
        if (d === 1) u += 2;
        else if (d === 2) u += 1;
        if ((card.rank === 1 && o.rank === 13) || (card.rank === 13 && o.rank === 1)) u += 2;
      }
    }
    // a joker in hand turns any partial combination into a real meld
    if (u > 0 && hand.some((o) => o !== card && o.joker)) u += 1;
    return u;
  }

  function chooseDiscard(hand, tableMelds, opts) {
    opts = opts || {};
    const level = opts.level || 'medium';
    tableMelds = tableMelds || [];
    const scored = [];
    for (const c of hand) {
      if (c.joker) continue; // a joker goes only when it is the last card
      let score;
      if (level === 'hard' && opts.danger) {
        // someone is about to close: shed points, keep only cheap hopes
        score = usefulness(c, hand) * 30 - R.handPenalty(c) * 12;
      } else {
        score = usefulness(c, hand) * 100 - R.handPenalty(c);
      }
      if (level !== 'easy' && tableMelds.some((m) => R.canAttach(m, c))) score += 900;
      if (level === 'hard') {
        const risk = feedRisk(c, opts.memory);
        score += risk > 0 ? risk * 220 : risk * 40;
      }
      scored.push({ c, score });
    }
    if (!scored.length) return hand[0];
    scored.sort((a, b) => a.score - b.score);
    // easy players are inconsistent about which junk card goes
    if (level === 'easy' && scored.length > 1 && Math.random() < 0.5) return scored[1].c;
    return scored[0].c;
  }

  /* Where to draw from. 'discard' only when the top card is usable now —
   * that is the rule for taking it. Easy never even looks. */
  function chooseDraw(state, player, opts) {
    opts = opts || {};
    if ((opts.level || 'medium') === 'easy') return 'stock';
    const top = state.discard[state.discard.length - 1];
    if (!top) return 'stock';
    if (player.opened) {
      if (state.melds.some((m) => R.canAttach(m, top))) return 'discard';
      const melds = generateMelds(player.hand.concat([top]));
      if (melds.some((m) => m.slots.some((s) => s.card.id === top.id))) return 'discard';
    } else {
      const combo = bestCombo(generateMelds(player.hand.concat([top])));
      if (
        combo.points >= 40 &&
        combo.melds.some((m) => m.slots.some((s) => s.card.id === top.id))
      ) {
        return 'discard';
      }
    }
    return 'stock';
  }

  /* Plan a full play phase. Returns an ordered action list:
   *   { type:'replaceJoker', cardId, meldId }   (hard only)
   *   { type:'meld', cardIds }  { type:'attach', cardId }
   *   { type:'discard', cardId }
   * mustUseId is a card taken from the discard pile that has to leave
   * the hand this turn (melded, attached, or discarded back).
   */
  function planPlay(state, player, mustUseId, opts) {
    opts = opts || {};
    const level = opts.level || 'medium';
    const lazy = level === 'easy';
    const danger = opts.minOppHand != null && opts.minOppHand <= 3;
    const actions = [];
    let hand = player.hand.slice();
    let opened = player.opened;
    // Simulate on clones so the real table is untouched.
    const table = state.melds.map((m) => ({ ...m, slots: m.slots.map((s) => ({ ...s })) }));
    const liveTable = () => table.filter((m) => !m.swept);

    // hard: reclaim table jokers it holds the real card for — a joker in
    // hand is worth far more than the card that frees it. Skipped in the
    // endgame, where being caught holding 25 points is the bigger risk.
    if (level === 'hard' && opened && !(opts.minOppHand != null && opts.minOppHand <= 2)) {
      for (const m of table) {
        const slot = m.slots.find((sl) => sl.card.joker);
        if (!slot) continue;
        const rep = hand.find((c) => R.canReplaceJoker(m, c));
        if (!rep) continue;
        actions.push({ type: 'replaceJoker', cardId: rep.id, meldId: m.id });
        const joker = slot.card;
        slot.card = rep;
        hand = hand.filter((c) => c.id !== rep.id);
        hand.push(joker);
        // the engine sweeps a now-complete jokerless meld — mirror that
        const full =
          (m.type === 'set' && m.slots.length === 4) ||
          (m.type === 'run' && m.slots.length === 13);
        if (full && !m.slots.some((sl) => sl.card.joker)) m.swept = true;
      }
    }

    const layMeld = (m) => {
      actions.push({ type: 'meld', cardIds: m.slots.map((sl) => sl.card.id) });
      const ids = new Set(m.slots.map((sl) => sl.card.id));
      hand = hand.filter((c) => !ids.has(c.id));
      table.push({ ...m, slots: m.slots.map((sl) => ({ ...sl })) });
    };

    const hesitates = lazy && mustUseId == null && Math.random() < 0.35;
    if (!opened) {
      if (!hesitates) {
        const combo = bestCombo(generateMelds(hand));
        let melds = [...combo.melds].sort((a, b) => b.points - a.points);
        const cardsUsed = () => melds.reduce((n, m) => n + m.slots.length, 0);
        while (melds.length && hand.length - cardsUsed() < 1) melds.pop();
        if (melds.reduce((sum, m) => sum + m.points, 0) >= 40) {
          melds.forEach(layMeld);
          opened = true;
        }
      }
    } else if (!hesitates) {
      const combo = bestCombo(generateMelds(hand));
      for (const m of [...combo.melds].sort((a, b) => b.points - a.points)) {
        if (hand.length - m.slots.length < 1) continue;
        layMeld(m);
      }
    }

    // Attaching is only legal from the turn AFTER opening — player.opened
    // at turn start, not the opening we may have just laid above.
    if (player.opened) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of hand.slice()) {
          if (hand.length <= 1) break;
          if (lazy && Math.random() < 0.5) continue; // easy misses attaches
          const target = liveTable().find((m) => R.canAttach(m, c));
          if (target) {
            R.applyAttach(target, c);
            actions.push({ type: 'attach', cardId: c.id });
            hand = hand.filter((x) => x.id !== c.id);
            changed = true;
          }
        }
      }
    }

    // Honour the "use what you took from the discard pile" rule.
    const stuck = mustUseId != null && hand.some((c) => c.id === mustUseId);
    const discard = stuck
      ? hand.find((c) => c.id === mustUseId)
      : chooseDiscard(hand, liveTable(), { level, memory: opts.memory, danger });
    actions.push({ type: 'discard', cardId: discard.id });
    return actions;
  }

  const api = { generateMelds, bestCombo, chooseDraw, chooseDiscard, planPlay, feedRisk };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AI = api;
})(typeof window !== 'undefined' ? window : globalThis);
