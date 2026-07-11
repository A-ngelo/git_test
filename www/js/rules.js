/*
 * Scala 40 (Scala Quaranta) — core rules module.
 * Deck construction, meld validation (sets & runs), attachments,
 * joker replacement and scoring. Pure logic, no DOM — usable from
 * the browser (window.Rules) and from Node for tests.
 */
(function (global) {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RED_SUITS = new Set(['♥', '♦']);

  /* ---------- cards ---------- */

  function rankName(rank) {
    return { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] || String(rank);
  }

  // Run slot values go 1..14 where both 1 and 14 are the Ace.
  function valueName(v) {
    return rankName(v === 14 ? 1 : v);
  }

  function isRed(card) {
    return !card.joker && RED_SUITS.has(card.suit);
  }

  function cardLabel(card) {
    return card.joker ? 'Joker' : rankName(card.rank) + card.suit;
  }

  // Two full French decks + 4 jokers = 108 cards.
  function makeDeck() {
    const cards = [];
    let id = 0;
    for (let d = 0; d < 2; d++) {
      for (const suit of SUITS) {
        for (let rank = 1; rank <= 13; rank++) {
          cards.push({ id: id++, rank, suit, joker: false });
        }
      }
      cards.push({ id: id++, rank: 0, suit: null, joker: true });
      cards.push({ id: id++, rank: 0, suit: null, joker: true });
    }
    return cards;
  }

  function shuffle(cards, rng) {
    rng = rng || Math.random;
    const a = cards.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- point values ---------- */

  function setCardPoints(rank) {
    return rank === 1 ? 11 : rank >= 11 ? 10 : rank;
  }

  function runSlotPoints(v) {
    if (v === 1) return 1;      // Ace low (A-2-3)
    if (v === 14) return 11;    // Ace high (Q-K-A)
    if (v >= 11) return 10;     // J, Q, K
    return v;
  }

  // Points left in hand when the opponent closes.
  function handPenalty(card) {
    if (card.joker) return 25;
    if (card.rank === 1) return 11;
    if (card.rank >= 11) return 10;
    return card.rank;
  }

  /* ---------- meld validation ----------
   * A meld is { type: 'set'|'run', rank?, suit?, slots, points }.
   * slots is an ordered array of { card, v } where v is the value the
   * card occupies (resolves jokers and ace-high/ace-low).
   */

  function trySet(cards) {
    if (cards.length < 3 || cards.length > 4) return null;
    const jokers = cards.filter((c) => c.joker);
    const naturals = cards.filter((c) => !c.joker);
    if (jokers.length > 1 || naturals.length < 2) return null;
    const rank = naturals[0].rank;
    if (naturals.some((c) => c.rank !== rank)) return null;
    const suits = naturals.map((c) => c.suit);
    if (new Set(suits).size !== suits.length) return null;
    return {
      type: 'set',
      rank,
      slots: cards.map((c) => ({ card: c, v: rank })),
      points: setCardPoints(rank) * cards.length,
    };
  }

  function tryRun(cards) {
    if (cards.length < 3 || cards.length > 13) return null;
    const jokers = cards.filter((c) => c.joker);
    const naturals = cards.filter((c) => !c.joker);
    if (jokers.length > 1 || naturals.length < 2) return null;
    const suit = naturals[0].suit;
    if (naturals.some((c) => c.suit !== suit)) return null;

    const hasAce = naturals.some((c) => c.rank === 1);
    const aceOptions = hasAce ? [14, 1] : [0];
    for (const aceVal of aceOptions) {
      const valued = naturals.map((c) => ({
        card: c,
        v: c.rank === 1 ? aceVal : c.rank,
      }));
      const vs = valued.map((x) => x.v);
      if (new Set(vs).size !== vs.length) continue; // duplicate rank
      valued.sort((a, b) => a.v - b.v);
      const lo = valued[0].v;
      const hi = valued[valued.length - 1].v;
      const missing = hi - lo + 1 - valued.length;

      let slots = null;
      if (jokers.length === 0) {
        if (missing !== 0) continue;
        slots = valued;
      } else if (missing === 1) {
        // Joker fills the single internal gap.
        slots = [];
        for (let v = lo; v <= hi; v++) {
          const nat = valued.find((x) => x.v === v);
          slots.push(nat || { card: jokers[0], v });
        }
      } else if (missing === 0) {
        // Joker extends one end; prefer the high end. A run may never
        // contain the Ace twice (as both 1 and 14).
        const canHigh = hi + 1 <= 14 && !(hi + 1 === 14 && vs.includes(1));
        const canLow = lo - 1 >= 1 && !(lo - 1 === 1 && vs.includes(14));
        if (canHigh) {
          slots = valued.concat([{ card: jokers[0], v: hi + 1 }]);
        } else if (canLow) {
          slots = [{ card: jokers[0], v: lo - 1 }].concat(valued);
        } else {
          continue;
        }
      } else {
        continue;
      }

      return {
        type: 'run',
        suit,
        slots,
        points: slots.reduce((s, x) => s + runSlotPoints(x.v), 0),
      };
    }
    return null;
  }

  function validateMeld(cards) {
    return trySet(cards) || tryRun(cards);
  }

  /* ---------- attaching to existing melds ---------- */

  function canAttach(meld, card) {
    if (meld.type === 'set') {
      if (meld.slots.length >= 4) return null;
      if (card.joker) {
        if (meld.slots.some((s) => s.card.joker)) return null;
        return { kind: 'set', v: meld.rank };
      }
      if (card.rank !== meld.rank) return null;
      if (meld.slots.some((s) => !s.card.joker && s.card.suit === card.suit)) return null;
      return { kind: 'set', v: meld.rank };
    }

    // run
    if (meld.slots.length >= 13) return null;
    const lo = meld.slots[0].v;
    const hi = meld.slots[meld.slots.length - 1].v;
    const has1 = meld.slots.some((s) => s.v === 1);
    const has14 = meld.slots.some((s) => s.v === 14);

    if (card.joker) {
      if (meld.slots.some((s) => s.card.joker)) return null;
      if (hi + 1 <= 14 && !(hi + 1 === 14 && has1)) return { kind: 'high', v: hi + 1 };
      if (lo - 1 >= 1 && !(lo - 1 === 1 && has14)) return { kind: 'low', v: lo - 1 };
      return null;
    }
    if (card.suit !== meld.suit) return null;
    const values = card.rank === 1 ? [1, 14] : [card.rank];
    for (const v of values) {
      if (v === hi + 1 && !(v === 14 && has1)) return { kind: 'high', v };
      if (v === lo - 1 && !(v === 1 && has14)) return { kind: 'low', v };
    }
    return null;
  }

  function applyAttach(meld, card) {
    const att = canAttach(meld, card);
    if (!att) return false;
    if (att.kind === 'low') meld.slots.unshift({ card, v: att.v });
    else meld.slots.push({ card, v: att.v });
    return true;
  }

  /* ---------- joker replacement ---------- */

  function findJokerSlot(meld) {
    return meld.slots.find((s) => s.card.joker) || null;
  }

  // A natural card that stands for what the joker represents may take
  // its place; the joker goes back to the player's hand.
  function canReplaceJoker(meld, card) {
    if (card.joker) return null;
    const slot = findJokerSlot(meld);
    if (!slot) return null;
    if (meld.type === 'set') {
      if (card.rank !== meld.rank) return null;
      if (meld.slots.some((s) => !s.card.joker && s.card.suit === card.suit)) return null;
      return slot;
    }
    if (card.suit !== meld.suit) return null;
    const matches = card.rank === 1 ? slot.v === 1 || slot.v === 14 : slot.v === card.rank;
    return matches ? slot : null;
  }

  function applyReplaceJoker(meld, card) {
    const slot = canReplaceJoker(meld, card);
    if (!slot) return null;
    const joker = slot.card;
    slot.card = card;
    return joker;
  }

  /* ---------- exports ---------- */

  const api = {
    SUITS,
    makeDeck,
    shuffle,
    rankName,
    valueName,
    isRed,
    cardLabel,
    setCardPoints,
    runSlotPoints,
    handPenalty,
    validateMeld,
    trySet,
    tryRun,
    canAttach,
    applyAttach,
    findJokerSlot,
    canReplaceJoker,
    applyReplaceJoker,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
