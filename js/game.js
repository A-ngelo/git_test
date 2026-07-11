/*
 * Scala 40 — game engine + UI.
 * Owns the game state (players, stock, discard, table melds, turn
 * phases), enforces the rules of play, drives the AI opponent and
 * renders everything to the DOM.
 */
(function () {
  'use strict';

  const R = window.Rules;
  const AI = window.AI;

  let S = null; // game state
  const view = {
    selected: new Set(), // selected card ids in the current hand
    newCardId: null,     // last drawn card, briefly highlighted
    msg: '',
  };

  const $ = (id) => document.getElementById(id);

  /* ================= state ================= */

  function newGame(mode, name1, name2) {
    const deck = R.shuffle(R.makeDeck());
    const players = [
      { name: name1, hand: [], opened: false, isAI: false },
      { name: name2, hand: [], opened: false, isAI: mode === 'pvc' },
    ];
    for (let i = 0; i < 13; i++) {
      for (const p of players) p.hand.push(deck.pop());
    }
    S = {
      mode,
      players,
      stock: deck,
      discard: [deck.pop()],
      melds: [],
      meldSeq: 1,
      turn: Math.floor(Math.random() * 2),
      phase: 'draw',      // 'draw' -> 'play'
      picked: null,       // id of card taken from the discard pile this turn
      mustStock: false,   // set after undoing a pickup
      actedAfterPick: false,
      provisional: [],    // meld ids laid this turn by a not-yet-opened player
      over: false,
      winner: null,
    };
    view.selected.clear();
    view.newCardId = null;
    setMsg('');
  }

  const cur = () => S.players[S.turn];
  const other = () => S.players[1 - S.turn];
  const isHumanTurn = () => !cur().isAI && !S.over;

  function provisionalPoints() {
    return S.melds
      .filter((m) => m.provisional)
      .reduce((s, m) => s + m.points, 0);
  }

  function setMsg(text) {
    view.msg = text;
  }

  function removeFromHand(player, ids) {
    const idSet = new Set(ids);
    player.hand = player.hand.filter((c) => !idSet.has(c.id));
  }

  /* ================= turn actions ================= */

  function recycleStockIfNeeded() {
    if (S.stock.length > 0) return;
    const top = S.discard.pop();
    S.stock = R.shuffle(S.discard);
    S.discard = top ? [top] : [];
  }

  function drawFromStock() {
    recycleStockIfNeeded();
    const card = S.stock.pop();
    cur().hand.push(card);
    view.newCardId = card.id;
    S.phase = 'play';
    return card;
  }

  function pickFromDiscard() {
    const card = S.discard.pop();
    cur().hand.push(card);
    view.newCardId = card.id;
    S.picked = card.id;
    S.actedAfterPick = false;
    S.phase = 'play';
    return card;
  }

  function undoPickup() {
    const p = cur();
    const card = p.hand.find((c) => c.id === S.picked);
    removeFromHand(p, [card.id]);
    S.discard.push(card);
    S.picked = null;
    S.mustStock = true;
    S.phase = 'draw';
    view.newCardId = null;
  }

  // Lay a new meld from the current player's hand. Returns an error
  // message, or null on success.
  function layMeld(cardIds) {
    const p = cur();
    const cards = p.hand.filter((c) => cardIds.includes(c.id));
    if (cards.length !== cardIds.length) return 'Card not in hand.';
    if (cards.length === p.hand.length) return 'You must keep a card to discard.';
    const m = R.validateMeld(cards);
    if (!m) return 'Not a valid meld: 3+ same rank (different suits) or 3+ in a row of one suit, max one joker.';
    const meld = { id: S.meldSeq++, owner: S.turn, provisional: !p.opened, ...m };
    S.melds.push(meld);
    removeFromHand(p, cardIds);
    if (meld.provisional) S.provisional.push(meld.id);
    if (S.picked != null) S.actedAfterPick = true;
    return null;
  }

  function attachCard(cardId, meldId) {
    const p = cur();
    if (!p.opened) return 'You can attach cards only after opening (in an earlier turn).';
    if (p.hand.length <= 1) return 'You must keep a card to discard.';
    const card = p.hand.find((c) => c.id === cardId);
    const meld = S.melds.find((m) => m.id === meldId);
    if (!card || !meld) return 'Nothing to attach.';
    if (!R.applyAttach(meld, card)) return `${R.cardLabel(card)} does not fit on that meld.`;
    removeFromHand(p, [card.id]);
    if (S.picked != null) S.actedAfterPick = true;
    return null;
  }

  function replaceJoker(cardId, meldId) {
    const p = cur();
    if (!p.opened) return 'You can swap jokers only after opening.';
    const card = p.hand.find((c) => c.id === cardId);
    const meld = S.melds.find((m) => m.id === meldId);
    if (!card || !meld) return 'Nothing to swap.';
    const joker = R.applyReplaceJoker(meld, card);
    if (!joker) return 'That card cannot replace the joker.';
    removeFromHand(p, [card.id]);
    p.hand.push(joker);
    if (S.picked != null) S.actedAfterPick = true;
    return null;
  }

  function takeBackProvisional() {
    const p = cur();
    const ids = new Set(S.provisional);
    for (const m of S.melds.filter((x) => ids.has(x.id))) {
      for (const s of m.slots) p.hand.push(s.card);
    }
    S.melds = S.melds.filter((m) => !ids.has(m.id));
    S.provisional = [];
    S.actedAfterPick = false;
  }

  // Returns an error message, or null if the discard ended the turn.
  function discardCard(cardId) {
    const p = cur();
    const card = p.hand.find((c) => c.id === cardId);
    if (!card) return 'Card not in hand.';

    const pts = provisionalPoints();
    if (pts > 0 && pts < 40) {
      return `Opening needs 40+ points — you have ${pts}. Lay more melds or take them back.`;
    }
    if (S.picked != null && cardId !== S.picked && p.hand.some((c) => c.id === S.picked)) {
      return 'Meld the card you took from the discard pile first (or discard that same card).';
    }

    if (pts >= 40) {
      p.opened = true;
      for (const m of S.melds) if (m.provisional) m.provisional = false;
      S.provisional = [];
    }

    removeFromHand(p, [card.id]);
    S.discard.push(card);
    view.selected.clear();
    view.newCardId = null;

    if (p.hand.length === 0) {
      endGame(S.turn);
      return null;
    }
    nextTurn();
    return null;
  }

  function nextTurn() {
    S.turn = 1 - S.turn;
    S.phase = 'draw';
    S.picked = null;
    S.mustStock = false;
    S.actedAfterPick = false;
    S.provisional = [];
    view.selected.clear();
    view.newCardId = null;

    if (cur().isAI) {
      setMsg(`${cur().name} is thinking…`);
      render();
      aiTurn();
    } else if (S.mode === 'pvp') {
      showPassScreen();
    } else {
      setMsg('Your turn — draw from the stock or the discard pile.');
      render();
    }
  }

  function endGame(winnerIdx) {
    S.over = true;
    S.winner = winnerIdx;
    render();
    showEndScreen();
  }

  /* ================= AI turn ================= */

  function aiTurn() {
    const p = cur();
    setTimeout(() => {
      if (S.over) return;
      const choice = AI.chooseDraw(S, p);
      if (choice === 'discard') {
        const card = pickFromDiscard();
        setMsg(`${p.name} takes ${R.cardLabel(card)} from the discard pile.`);
      } else {
        drawFromStock();
        setMsg(`${p.name} draws from the stock.`);
      }
      render();
      setTimeout(() => {
        if (S.over) return;
        const plan = AI.planPlay(S, p, S.picked);
        execAIPlan(plan, 0, p.opened);
      }, 800);
    }, 800);
  }

  function execAIPlan(plan, i, wasOpened) {
    if (S.over || i >= plan.length) return;
    const p = cur();
    const a = plan[i];

    if (a.type === 'meld') {
      layMeld(a.cardIds);
      const laid = S.melds[S.melds.length - 1];
      const label = laid.slots.map((s) => R.cardLabel(s.card)).join(' ');
      setMsg(`${p.name} plays ${label}.`);
    } else if (a.type === 'attach') {
      const card = p.hand.find((c) => c.id === a.cardId);
      const target = S.melds.find((m) => m.id != null && R.canAttach(m, card));
      if (target) {
        R.applyAttach(target, card);
        removeFromHand(p, [card.id]);
        setMsg(`${p.name} attaches ${R.cardLabel(card)}.`);
      }
    } else if (a.type === 'discard') {
      const card = p.hand.find((c) => c.id === a.cardId) || p.hand[p.hand.length - 1];
      const opensNow = !wasOpened && provisionalPoints() >= 40;
      discardCard(card.id);
      if (S.over) return;
      setMsg(
        (opensNow ? `${p.name} opened! ` : '') +
          `${p.name} discards ${R.cardLabel(card)}. Your turn.`
      );
      render();
      return;
    }
    render();
    setTimeout(() => execAIPlan(plan, i + 1, wasOpened), 750);
  }

  /* ================= rendering ================= */

  // Monochrome deck: hearts and diamonds render hollow instead of red.
  const suitGlyph = (suit) => ({ '♥': '♡', '♦': '♢' }[suit] || suit);

  function cardEl(card, { faceDown = false, small = false } = {}) {
    const el = document.createElement('div');
    el.className = 'card' + (small ? ' small' : '');
    if (faceDown) {
      el.classList.add('back');
      return el;
    }
    if (card.joker) {
      el.classList.add('joker');
      el.innerHTML = '<span class="corner">★</span><span class="pip">★</span><span class="jlabel">JOKER</span>';
    } else {
      el.classList.add(R.isRed(card) ? 'red' : 'black');
      const r = R.rankName(card.rank);
      const g = suitGlyph(card.suit);
      el.innerHTML = `<span class="corner">${r}<br>${g}</span><span class="pip">${g}</span>`;
    }
    el.dataset.id = card.id;
    return el;
  }

  function viewIndex() {
    if (S.mode === 'pvc') return 0;
    return cur().isAI ? 0 : S.turn;
  }

  function render() {
    if (!S) return;
    const me = S.players[viewIndex()];
    const opp = S.players[1 - viewIndex()];

    // opponent bar
    $('opp-name').textContent = opp.name;
    $('opp-count').textContent = `${opp.hand.length} cards`;
    $('opp-opened').textContent = opp.opened ? 'opened' : 'not opened';
    $('opp-opened').classList.toggle('on', opp.opened);
    const oppHand = $('opp-hand');
    oppHand.innerHTML = '';
    for (let i = 0; i < opp.hand.length; i++) {
      oppHand.appendChild(cardEl(null, { faceDown: true, small: true }));
    }

    // table melds
    const meldsBox = $('melds');
    meldsBox.innerHTML = '';
    if (S.melds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'table-hint';
      empty.textContent = 'Melds land here — open with 40+ points';
      meldsBox.appendChild(empty);
    }
    for (const m of S.melds) {
      const g = document.createElement('div');
      g.className = 'meld' + (m.provisional ? ' provisional' : '');
      g.dataset.mid = m.id;
      for (const s of m.slots) {
        const c = cardEl(s.card, { small: true });
        if (s.card.joker) {
          c.querySelector('.jlabel').textContent =
            m.type === 'run' ? R.valueName(s.v) + suitGlyph(m.suit) : R.rankName(m.rank);
        }
        g.appendChild(c);
      }
      const tag = document.createElement('span');
      tag.className = 'meld-owner';
      tag.textContent = S.players[m.owner].name + (m.provisional ? ` · opening ${m.points}` : '');
      g.appendChild(tag);
      g.addEventListener('click', () => onMeldClick(m.id));
      meldsBox.appendChild(g);
    }

    // piles
    $('stock-count').textContent = S.stock.length;
    const discardBox = $('discard');
    discardBox.innerHTML = '';
    const top = S.discard[S.discard.length - 1];
    if (top) discardBox.appendChild(cardEl(top));
    else {
      const ph = document.createElement('div');
      ph.className = 'card outline';
      discardBox.appendChild(ph);
    }

    // my bar
    $('me-name').textContent = me.name;
    $('me-opened').textContent = me.opened ? 'opened' : 'not opened';
    $('me-opened').classList.toggle('on', me.opened);
    const pts = provisionalPoints();
    $('me-open-pts').textContent =
      !me.opened && pts > 0 && isHumanTurn() && S.players[S.turn] === me
        ? `opening: ${pts}/40`
        : '';

    const handBox = $('hand');
    handBox.innerHTML = '';
    for (const c of me.hand) {
      const el = cardEl(c);
      if (view.selected.has(c.id)) el.classList.add('selected');
      if (c.id === view.newCardId) el.classList.add('fresh');
      el.addEventListener('click', () => onHandCardClick(c.id));
      handBox.appendChild(el);
    }

    // buttons
    const myTurn = isHumanTurn() && S.players[S.turn] === me;
    const playPhase = myTurn && S.phase === 'play';
    $('btn-meld').disabled = !playPhase || view.selected.size < 3;
    $('btn-discard').disabled = !playPhase || view.selected.size !== 1;
    $('btn-takeback').classList.toggle('hidden', !(playPhase && S.provisional.length > 0));
    $('btn-undopick').classList.toggle(
      'hidden',
      !(playPhase && S.picked != null && !S.actedAfterPick)
    );

    // turn / phase indicator
    let hint = view.msg;
    if (!hint && myTurn) {
      hint =
        S.phase === 'draw'
          ? 'Draw from the stock or take the discard.'
          : 'Play melds, attach cards, then discard one card to end your turn.';
    }
    $('msgbar').textContent = hint;
    $('stock').classList.toggle('clickable', myTurn && S.phase === 'draw');
    $('discard').classList.toggle(
      'clickable',
      myTurn && (S.phase === 'draw' || view.selected.size === 1)
    );
  }

  /* ================= human interactions ================= */

  function onHandCardClick(cardId) {
    if (!isHumanTurn()) return;
    if (S.phase !== 'play') {
      setMsg('Draw a card first.');
      render();
      return;
    }
    if (view.selected.has(cardId)) view.selected.delete(cardId);
    else view.selected.add(cardId);
    setMsg('');
    render();
  }

  function onStockClick() {
    if (!isHumanTurn()) return;
    if (S.phase !== 'draw') {
      setMsg('You already drew this turn.');
      render();
      return;
    }
    drawFromStock();
    setMsg('');
    render();
  }

  function onDiscardClick() {
    if (!isHumanTurn()) return;
    if (S.phase === 'draw') {
      if (S.mustStock) {
        setMsg('You put that card back — draw from the stock.');
      } else if (S.discard.length === 0) {
        setMsg('The discard pile is empty.');
      } else {
        pickFromDiscard();
        setMsg('You must use this card in a meld before your discard (or discard it back).');
      }
      render();
      return;
    }
    // play phase: one selected card -> discard it onto the pile
    if (view.selected.size === 1) {
      onDiscardButton();
    }
  }

  function onMeldClick(meldId) {
    if (!isHumanTurn() || S.phase !== 'play' || view.selected.size === 0) return;
    const ids = [...view.selected];

    // Single card: try a joker swap first (it wins the player a joker),
    // then a plain attach.
    if (ids.length === 1) {
      const meld = S.melds.find((m) => m.id === meldId);
      const card = cur().hand.find((c) => c.id === ids[0]);
      if (meld && card && cur().opened && R.canReplaceJoker(meld, card)) {
        const err = replaceJoker(ids[0], meldId);
        setMsg(err || 'You swapped the joker into your hand!');
        if (!err) view.selected.clear();
        render();
        return;
      }
    }

    // Attach each selected card, repeating until no more fit (so 8♥ 9♥
    // can both go onto a 5-6-7♥ run in one tap).
    let attachedAny = false;
    let progress = true;
    while (progress) {
      progress = false;
      for (const id of [...view.selected]) {
        const err = attachCard(id, meldId);
        if (!err) {
          view.selected.delete(id);
          attachedAny = true;
          progress = true;
        }
      }
    }
    if (attachedAny) {
      setMsg(view.selected.size ? 'Some selected cards did not fit.' : '');
    } else {
      const meld = S.melds.find((m) => m.id === meldId);
      const card = cur().hand.find((c) => c.id === ids[0]);
      setMsg(
        !cur().opened
          ? 'You can attach cards only after you have opened.'
          : `${card ? R.cardLabel(card) : 'That card'} does not fit on that meld.`
      );
    }
    render();
  }

  function onMeldButton() {
    if (!isHumanTurn() || S.phase !== 'play') return;
    const err = layMeld([...view.selected]);
    if (err) {
      setMsg(err);
    } else {
      view.selected.clear();
      const pts = provisionalPoints();
      setMsg(
        cur().opened
          ? 'Meld played.'
          : pts >= 40
            ? `Opening total ${pts} — discard to confirm your opening.`
            : `Opening total ${pts}/40 — keep going.`
      );
    }
    render();
  }

  function onDiscardButton() {
    if (!isHumanTurn() || S.phase !== 'play' || view.selected.size !== 1) return;
    const id = [...view.selected][0];
    const p = cur();
    const willOpen = !p.opened && provisionalPoints() >= 40;
    const err = discardCard(id);
    if (err) {
      setMsg(err);
      render();
    } else if (!S.over && willOpen) {
      // message for the *next* human render in pvp is handled by nextTurn
      if (S.mode === 'pvc') setMsg('You opened! ' + view.msg);
      render();
    }
  }

  function onTakeBack() {
    if (!isHumanTurn() || S.phase !== 'play') return;
    takeBackProvisional();
    setMsg('Opening melds returned to your hand.');
    render();
  }

  function onUndoPick() {
    if (!isHumanTurn() || S.picked == null || S.actedAfterPick) return;
    undoPickup();
    setMsg('Pickup undone — draw from the stock.');
    render();
  }

  function sortHand(bySuit) {
    const me = S.players[viewIndex()];
    const suitIdx = (s) => R.SUITS.indexOf(s);
    me.hand.sort((a, b) => {
      if (a.joker !== b.joker) return a.joker ? 1 : -1;
      if (a.joker) return 0;
      return bySuit
        ? suitIdx(a.suit) - suitIdx(b.suit) || a.rank - b.rank
        : a.rank - b.rank || suitIdx(a.suit) - suitIdx(b.suit);
    });
    render();
  }

  /* ================= screens ================= */

  function show(screenId) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    $(screenId).classList.remove('hidden');
  }

  function showPassScreen() {
    $('pass-name').textContent = cur().name;
    show('pass-screen');
  }

  function showEndScreen() {
    const w = S.players[S.winner];
    const l = S.players[1 - S.winner];
    const penalty = l.hand.reduce((s, c) => s + R.handPenalty(c), 0);
    $('end-title').textContent = `★ ${w.name} wins! ★`;
    $('end-detail').textContent = `${l.name} is left holding ${penalty} point${penalty === 1 ? '' : 's'}.`;
    const box = $('end-cards');
    box.innerHTML = '';
    for (const c of l.hand) box.appendChild(cardEl(c, { small: true }));
    show('end-screen');
  }

  /* ================= wiring ================= */

  function startGame() {
    const mode = $('btn-pvp').classList.contains('active') ? 'pvp' : 'pvc';
    const n1 = $('name1').value.trim() || 'Player 1';
    const n2 = mode === 'pvc' ? 'Computer' : $('name2').value.trim() || 'Player 2';
    newGame(mode, n1, n2);
    show('game-screen');
    if (cur().isAI) {
      setMsg(`${cur().name} goes first…`);
      render();
      aiTurn();
    } else if (mode === 'pvp') {
      showPassScreen();
    } else {
      setMsg('You go first — draw a card.');
      render();
    }
  }

  function init() {
    const modeBtns = [$('btn-pvc'), $('btn-pvp')];
    for (const b of modeBtns) {
      b.addEventListener('click', () => {
        modeBtns.forEach((x) => x.classList.toggle('active', x === b));
        $('name2').classList.toggle('hidden', b.id === 'btn-pvc');
      });
    }
    $('btn-start').addEventListener('click', startGame);
    $('stock').addEventListener('click', onStockClick);
    $('discard').addEventListener('click', onDiscardClick);
    $('btn-meld').addEventListener('click', onMeldButton);
    $('btn-discard').addEventListener('click', onDiscardButton);
    $('btn-takeback').addEventListener('click', onTakeBack);
    $('btn-undopick').addEventListener('click', onUndoPick);
    $('btn-sort-suit').addEventListener('click', () => sortHand(true));
    $('btn-sort-rank').addEventListener('click', () => sortHand(false));
    $('btn-pass-continue').addEventListener('click', () => {
      setMsg(`${cur().name}, draw from the stock or the discard pile.`);
      show('game-screen');
      render();
    });
    $('btn-again').addEventListener('click', () => show('menu-screen'));
  }

  document.addEventListener('DOMContentLoaded', init);

  // Exposed for automated testing.
  window.Scala40 = {
    getState: () => S,
    view,
    render,
  };
})();
