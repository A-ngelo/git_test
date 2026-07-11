/*
 * Scala 40 — game state machine.
 * Owns a full game state and every legal state transition (draw, meld,
 * attach, joker swap, discard) with all rule enforcement: the 40-point
 * opening, the "use what you take from the discard pile" rule, keeping
 * a card back to discard, winning by discarding the last card.
 *
 * Pure logic, no DOM. The browser uses it for local play and the
 * multiplayer server uses the very same code as the authoritative
 * referee — clients only ever see the redacted `view()`.
 */
(function (global) {
  'use strict';

  const R =
    typeof module !== 'undefined' && typeof require === 'function'
      ? require('./rules.js')
      : global.Rules;

  const err = (error) => ({ ok: false, error });
  const ok = (extra) => Object.assign({ ok: true }, extra);

  function newGame(names, opts) {
    opts = opts || {};
    const deck = opts.deck || R.shuffle(R.makeDeck());
    const players = names.map((name) => ({ name, hand: [], opened: false }));
    for (let i = 0; i < 13; i++) {
      for (const p of players) p.hand.push(deck.pop());
    }
    const firstTurn = opts.firstTurn != null ? opts.firstTurn : Math.floor(Math.random() * 2);
    return {
      players,
      stock: deck,
      discard: [deck.pop()],
      melds: [],
      meldSeq: 1,
      turn: firstTurn,
      phase: 'draw',        // 'draw' -> 'play'
      picked: null,         // id of card taken from the discard pile this turn
      mustStock: false,     // set after undoing a pickup
      actedAfterPick: false,
      provisional: [],      // meld ids laid this turn by a not-yet-opened player
      lastDraw: null,       // { p, id } — which card the current player just drew
      over: false,          // this hand is finished
      winner: null,         // winner of this hand
      // match play: penalty points accumulate hand after hand, and the
      // player who reaches `target` loses the match
      scores: names.map(() => 0),
      target: opts.target != null ? opts.target : 151,
      handNumber: 1,
      handFirstTurn: firstTurn,
      lastPenalty: null,
      matchOver: false,
      matchWinner: null,
    };
  }

  /* Deal the next hand of the match: fresh deck, scores carried over,
   * the lead alternating between hands. Either player may trigger it. */
  function nextHand(S) {
    if (!S.over) return err('The hand is not over yet.');
    if (S.matchOver) return err('The match is over.');
    const deck = R.shuffle(R.makeDeck());
    for (const pl of S.players) {
      pl.hand = [];
      pl.opened = false;
    }
    for (let i = 0; i < 13; i++) {
      for (const pl of S.players) pl.hand.push(deck.pop());
    }
    S.stock = deck;
    S.discard = [deck.pop()];
    S.melds = [];
    S.meldSeq = 1;
    S.handNumber++;
    S.handFirstTurn = 1 - S.handFirstTurn;
    S.turn = S.handFirstTurn;
    S.phase = 'draw';
    S.picked = null;
    S.mustStock = false;
    S.actedAfterPick = false;
    S.provisional = [];
    S.lastDraw = null;
    S.over = false;
    S.winner = null;
    S.lastPenalty = null;
    return ok({ handNumber: S.handNumber });
  }

  function provisionalPoints(S) {
    return S.melds.filter((m) => m.provisional).reduce((s, m) => s + m.points, 0);
  }

  function guard(S, p, phase) {
    if (S.over) return 'The game is over.';
    if (S.turn !== p) return 'Not your turn.';
    if (phase && S.phase !== phase) {
      return phase === 'draw' ? 'You already drew this turn.' : 'Draw a card first.';
    }
    return null;
  }

  function removeFromHand(player, ids) {
    const idSet = new Set(ids);
    player.hand = player.hand.filter((c) => !idSet.has(c.id));
  }

  function recycleStockIfNeeded(S) {
    if (S.stock.length > 0) return;
    const top = S.discard.pop();
    S.stock = R.shuffle(S.discard);
    S.discard = top ? [top] : [];
  }

  /* ---------- actions: each returns { ok } or { ok:false, error } ---------- */

  function drawStock(S, p) {
    const g = guard(S, p, 'draw');
    if (g) return err(g);
    recycleStockIfNeeded(S);
    if (S.stock.length === 0) return err('No cards left to draw.');
    const card = S.stock.pop();
    S.players[p].hand.push(card);
    S.lastDraw = { p, id: card.id };
    S.phase = 'play';
    return ok({ card });
  }

  function pickDiscard(S, p) {
    const g = guard(S, p, 'draw');
    if (g) return err(g);
    if (S.mustStock) return err('You put that card back — draw from the stock.');
    if (S.discard.length === 0) return err('The discard pile is empty.');
    const card = S.discard.pop();
    S.players[p].hand.push(card);
    S.lastDraw = { p, id: card.id };
    S.picked = card.id;
    S.actedAfterPick = false;
    S.phase = 'play';
    return ok({ card });
  }

  function undoPickup(S, p) {
    const g = guard(S, p, 'play');
    if (g) return err(g);
    if (S.picked == null) return err('Nothing to undo.');
    if (S.actedAfterPick) return err('Too late to undo — you already played.');
    const player = S.players[p];
    const card = player.hand.find((c) => c.id === S.picked);
    removeFromHand(player, [card.id]);
    S.discard.push(card);
    S.picked = null;
    S.mustStock = true;
    S.lastDraw = null;
    S.phase = 'draw';
    return ok({ card });
  }

  function layMeld(S, p, cardIds) {
    const g = guard(S, p, 'play');
    if (g) return err(g);
    if (!Array.isArray(cardIds)) return err('No cards selected.');
    const player = S.players[p];
    const cards = player.hand.filter((c) => cardIds.includes(c.id));
    if (cards.length !== cardIds.length) return err('Card not in hand.');
    if (cards.length === player.hand.length) return err('You must keep a card to discard.');
    const m = R.validateMeld(cards);
    if (!m) {
      return err(
        'Not a valid meld: 3+ same rank (different suits) or 3+ in a row of one suit, max one joker.'
      );
    }
    const meld = Object.assign(
      { id: S.meldSeq++, owner: p, provisional: !player.opened },
      m
    );
    S.melds.push(meld);
    removeFromHand(player, cardIds);
    if (meld.provisional) S.provisional.push(meld.id);
    if (S.picked != null) S.actedAfterPick = true;
    return ok({ meld });
  }

  function attach(S, p, cardId, meldId) {
    const g = guard(S, p, 'play');
    if (g) return err(g);
    const player = S.players[p];
    if (!player.opened) return err('You can attach cards only after opening (in an earlier turn).');
    if (player.hand.length <= 1) return err('You must keep a card to discard.');
    const card = player.hand.find((c) => c.id === cardId);
    const meld = S.melds.find((m) => m.id === meldId);
    if (!card || !meld) return err('Nothing to attach.');
    if (!R.applyAttach(meld, card)) return err(`${R.cardLabel(card)} does not fit on that meld.`);
    removeFromHand(player, [card.id]);
    if (S.picked != null) S.actedAfterPick = true;
    return ok({ card, meld });
  }

  function replaceJoker(S, p, cardId, meldId) {
    const g = guard(S, p, 'play');
    if (g) return err(g);
    const player = S.players[p];
    if (!player.opened) return err('You can swap jokers only after opening.');
    const card = player.hand.find((c) => c.id === cardId);
    const meld = S.melds.find((m) => m.id === meldId);
    if (!card || !meld) return err('Nothing to swap.');
    const joker = R.applyReplaceJoker(meld, card);
    if (!joker) return err('That card cannot replace the joker.');
    removeFromHand(player, [card.id]);
    player.hand.push(joker);
    if (S.picked != null) S.actedAfterPick = true;
    return ok({ card, meld });
  }

  function takeBack(S, p) {
    const g = guard(S, p, 'play');
    if (g) return err(g);
    if (S.provisional.length === 0) return err('Nothing to take back.');
    const player = S.players[p];
    const ids = new Set(S.provisional);
    for (const m of S.melds.filter((x) => ids.has(x.id))) {
      for (const s of m.slots) player.hand.push(s.card);
    }
    S.melds = S.melds.filter((m) => !ids.has(m.id));
    S.provisional = [];
    S.actedAfterPick = false;
    return ok({});
  }

  function discard(S, p, cardId) {
    const g = guard(S, p, 'play');
    if (g) return err(g);
    const player = S.players[p];
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) return err('Card not in hand.');

    const pts = provisionalPoints(S);
    if (pts > 0 && pts < 40) {
      return err(`Opening needs 40+ points — you have ${pts}. Lay more melds or take them back.`);
    }
    if (S.picked != null && cardId !== S.picked && player.hand.some((c) => c.id === S.picked)) {
      return err('Meld the card you took from the discard pile first (or discard that same card).');
    }

    let openedNow = false;
    if (pts >= 40) {
      player.opened = true;
      openedNow = true;
      for (const m of S.melds) if (m.provisional) m.provisional = false;
      S.provisional = [];
    }

    removeFromHand(player, [card.id]);
    S.discard.push(card);

    if (player.hand.length === 0) {
      S.over = true;
      S.winner = p;
      const loser = 1 - p;
      const penalty = S.players[loser].hand.reduce((s, c) => s + R.handPenalty(c), 0);
      S.scores[loser] += penalty;
      S.lastPenalty = penalty;
      if (S.scores[loser] >= S.target) {
        S.matchOver = true;
        S.matchWinner = p;
      }
      return ok({ card, openedNow, won: true, penalty });
    }

    // next turn
    S.turn = 1 - S.turn;
    S.phase = 'draw';
    S.picked = null;
    S.mustStock = false;
    S.actedAfterPick = false;
    S.provisional = [];
    S.lastDraw = null;
    return ok({ card, openedNow, won: false });
  }

  /* ---------- redacted per-player view (what a client may know) ---------- */

  function view(S, p) {
    return {
      you: p,
      players: S.players.map((pl) => ({
        name: pl.name,
        opened: pl.opened,
        handCount: pl.hand.length,
      })),
      hand: S.players[p].hand,
      melds: S.melds,
      stockCount: S.stock.length,
      discardTop: S.discard[S.discard.length - 1] || null,
      turn: S.turn,
      phase: S.phase,
      picked: S.turn === p ? S.picked : null,
      mustStock: S.turn === p ? S.mustStock : false,
      actedAfterPick: S.turn === p ? S.actedAfterPick : false,
      newCardId: S.lastDraw && S.lastDraw.p === p ? S.lastDraw.id : null,
      provisionalPoints: provisionalPoints(S),
      provisionalCount: S.provisional.length,
      over: S.over,
      winner: S.winner,
      loserHand: S.over && S.winner != null ? S.players[1 - S.winner].hand : null,
      scores: S.scores.slice(),
      target: S.target,
      handNumber: S.handNumber,
      lastPenalty: S.lastPenalty,
      matchOver: S.matchOver,
      matchWinner: S.matchWinner,
    };
  }

  const api = {
    newGame,
    view,
    provisionalPoints,
    actions: {
      drawStock,
      pickDiscard,
      undoPickup,
      layMeld,
      attach,
      replaceJoker,
      takeBack,
      discard,
      nextHand,
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
