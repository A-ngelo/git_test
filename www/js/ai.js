/*
 * Scala 40 — computer opponent.
 * Finds melds in a hand, searches for the best disjoint combination
 * (used both to open with 40+ points and to dump cards afterwards),
 * decides where to draw from and what to discard.
 * Pure logic, no DOM.
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

  /* Enumerate every candidate meld that can be formed from a hand. */
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

  /* Where should the AI draw from? 'discard' only when the top card is
   * immediately usable (that is the rule for taking it). */
  function chooseDraw(state, player) {
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
        // Ace works next to the King too.
        if ((card.rank === 1 && o.rank === 13) || (card.rank === 13 && o.rank === 1)) u += 2;
      }
    }
    // a joker in hand turns any partial combination into a real meld
    if (u > 0 && hand.some((o) => o !== card && o.joker)) u += 1;
    return u;
  }

  /* Pick the least valuable discard, table-aware:
   * - never let go of a joker while there is any other choice
   * - hold cards that attach to melds on the table (we can dump them the
   *   moment we're opened — and discarding them gifts the opponent a
   *   free pickup)
   * - hold cards that pair up or sit near a run in hand
   * - among equally useless cards, shed the highest penalty points */
  function chooseDiscard(hand, tableMelds) {
    tableMelds = tableMelds || [];
    let pick = hand[0];
    let pickScore = Infinity;
    for (const c of hand) {
      if (c.joker) continue;
      let score = usefulness(c, hand) * 100 - R.handPenalty(c);
      if (tableMelds.some((m) => R.canAttach(m, c))) score += 900;
      if (score < pickScore) {
        pickScore = score;
        pick = c;
      }
    }
    return pick; // hand[0] survives only if everything else is a joker
  }

  /* Plan a full play phase. Returns an ordered action list:
   *   { type:'meld', cardIds }  { type:'attach', cardId }
   *   { type:'discard', cardId }
   * mustUseId is a card taken from the discard pile that has to leave
   * the hand this turn (melded, attached, or discarded back).
   */
  function planPlay(state, player, mustUseId) {
    const actions = [];
    let hand = player.hand.slice();
    let opened = player.opened;
    // Simulate attachments on clones so the real table is untouched.
    const table = state.melds.map((m) => ({ ...m, slots: m.slots.map((s) => ({ ...s })) }));

    const layMeld = (m) => {
      actions.push({ type: 'meld', cardIds: m.slots.map((s) => s.card.id) });
      const ids = new Set(m.slots.map((s) => s.card.id));
      hand = hand.filter((c) => !ids.has(c.id));
      table.push({ ...m, slots: m.slots.map((s) => ({ ...s })) });
    };

    if (!opened) {
      const combo = bestCombo(generateMelds(hand));
      let melds = [...combo.melds].sort((a, b) => b.points - a.points);
      const cardsUsed = () => melds.reduce((n, m) => n + m.slots.length, 0);
      while (melds.length && hand.length - cardsUsed() < 1) melds.pop();
      if (melds.reduce((s, m) => s + m.points, 0) >= 40) {
        melds.forEach(layMeld);
        opened = true;
      }
    } else {
      const combo = bestCombo(generateMelds(hand));
      for (const m of [...combo.melds].sort((a, b) => b.points - a.points)) {
        if (hand.length - m.slots.length < 1) continue;
        layMeld(m);
      }
    }

    if (opened) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of hand.slice()) {
          if (hand.length <= 1) break;
          const target = table.find((m) => R.canAttach(m, c));
          if (target) {
            R.applyAttach(target, c);
            actions.push({ type: 'attach', cardId: c.id });
            hand = hand.filter((x) => x.id !== c.id);
            changed = true;
          }
        }
      }
    }

    // Honour the "use what you took from the discard pile" rule: if the
    // taken card is still in hand, it must be the discard.
    const stuck = mustUseId != null && hand.some((c) => c.id === mustUseId);
    const discard = stuck ? hand.find((c) => c.id === mustUseId) : chooseDiscard(hand, table);
    actions.push({ type: 'discard', cardId: discard.id });
    return actions;
  }

  const api = { generateMelds, bestCombo, chooseDraw, chooseDiscard, planPlay };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AI = api;
})(typeof window !== 'undefined' ? window : globalThis);
