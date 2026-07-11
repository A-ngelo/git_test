/*
 * Scala 40 — UI controller.
 * Renders a per-player view model and routes every player action either
 * to the local Engine (vs CPU / pass-and-play) or over the network to
 * the multiplayer server (online rooms). All rule enforcement lives in
 * js/engine.js; this file is screens, clicks and messages.
 */
(function () {
  'use strict';

  const R = window.Rules;
  const AI = window.AI;
  const E = window.Engine;

  let MODE = null;   // 'local' | 'net'
  let LOCAL = null;  // { mode: 'pvc' | 'pvp' }
  let S = null;      // full engine state (local mode only)

  const view = {
    selected: new Set(), // selected card ids in the current hand
    msg: '',
  };

  const $ = (id) => document.getElementById(id);

  /* ---- hand ordering (pure presentation, per seat) ----
   * The engine/server owns which cards you hold; the order you see them
   * in is yours: kept here, survives redraws and server updates. */
  const handOrder = {}; // seat index -> [card ids]

  function orderedHand(vm) {
    const order = handOrder[vm.you] || [];
    const byId = new Map(vm.hand.map((c) => [c.id, c]));
    const out = [];
    for (const id of order) {
      const c = byId.get(id);
      if (c) {
        out.push(c);
        byId.delete(id);
      }
    }
    for (const c of byId.values()) out.push(c); // new draws go on the right
    handOrder[vm.you] = out.map((c) => c.id);
    return out;
  }

  /* ---- drag to rearrange ---- */
  const drag = {
    el: null,
    moved: false,
    startX: 0,
    startY: 0,
    pendingRender: false,
    suppressClick: false,
  };

  // Where should the dragged card land for this pointer position?
  // Row-aware, so it works when the hand wraps onto multiple lines.
  function dropTarget(container, x, y, draggedEl) {
    for (const kid of container.children) {
      if (kid === draggedEl) continue;
      const r = kid.getBoundingClientRect();
      if (y < r.top) return kid;
      if (y <= r.bottom && x < r.left + r.width / 2) return kid;
    }
    return null; // end of the hand
  }

  // NB: reordering a node with insertBefore drops pointer capture in
  // Chromium, so the drag is tracked on the document, not the card.
  function onDragMove(e) {
    if (!drag.el || e.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < 8) return;
      drag.moved = true;
      drag.el.classList.add('dragging');
    }
    const container = $('hand');
    const before = dropTarget(container, e.clientX, e.clientY, drag.el);
    if (before !== drag.el && before !== drag.el.nextSibling) {
      container.insertBefore(drag.el, before);
    }
  }

  function onDragUp(e) {
    if (drag.el && e.pointerId === drag.pointerId) endDrag(true);
  }

  function onDragCancel(e) {
    if (drag.el && e.pointerId === drag.pointerId) endDrag(false);
  }

  function endDrag(commit) {
    const el = drag.el;
    if (!el) return;
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragUp);
    document.removeEventListener('pointercancel', onDragCancel);
    drag.el = null;
    el.classList.remove('dragging');
    if (drag.moved) {
      drag.suppressClick = true;
      setTimeout(() => {
        drag.suppressClick = false;
      }, 250);
      if (commit) {
        const vm = getVM();
        if (vm) {
          handOrder[vm.you] = [...$('hand').children].map((k) => Number(k.dataset.id));
        }
      }
    }
    const needRender = drag.pendingRender || drag.moved;
    drag.moved = false;
    drag.pendingRender = false;
    if (needRender) render();
  }

  function attachDragHandlers(el) {
    el.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || drag.el) return;
      drag.el = el;
      drag.moved = false;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.pointerId = e.pointerId;
      document.addEventListener('pointermove', onDragMove);
      document.addEventListener('pointerup', onDragUp);
      document.addEventListener('pointercancel', onDragCancel);
    });
  }

  /* ================= view model ================= */

  function localYou() {
    if (LOCAL.mode === 'pvc') return 0;
    return S.turn; // pass-and-play: the bottom hand is always whoever plays
  }

  function getVM() {
    if (MODE === 'net') return window.NET.view;
    return S ? E.view(S, localYou()) : null;
  }

  function isMyTurn(vm) {
    if (!vm || vm.over) return false;
    if (MODE === 'net') return vm.turn === vm.you;
    if (LOCAL.mode === 'pvc') return vm.turn === 0;
    return true;
  }

  function setMsg(text) {
    view.msg = text;
  }

  /* ================= acting ================= */

  // Route an action to the engine (local) or the server (net). Local
  // calls return the engine result; net calls return { async: true }
  // and the server answers with a fresh state or an error message.
  function act(name, args) {
    args = args || {};
    if (MODE === 'net') {
      window.NET.action(name, args);
      return { ok: true, async: true };
    }
    const p = S.turn;
    const A = E.actions;
    switch (name) {
      case 'drawStock': return A.drawStock(S, p);
      case 'pickDiscard': return A.pickDiscard(S, p);
      case 'undoPickup': return A.undoPickup(S, p);
      case 'layMeld': return A.layMeld(S, p, args.cardIds);
      case 'attach': return A.attach(S, p, args.cardId, args.meldId);
      case 'replaceJoker': return A.replaceJoker(S, p, args.cardId, args.meldId);
      case 'takeBack': return A.takeBack(S, p);
      case 'discard': return A.discard(S, p, args.cardId);
      case 'nextHand': return A.nextHand(S);
      default: return { ok: false, error: 'Unknown action.' };
    }
  }

  // Local-mode flow after a successful discard: end, AI turn, or pass.
  function afterLocalDiscard(res) {
    if (S.over) {
      showEndScreen();
      return;
    }
    if (LOCAL.mode === 'pvc' && S.turn === 1) {
      setMsg((res.openedNow ? 'You opened! ' : '') + 'Computer is thinking…');
      render();
      aiTurn();
    } else if (LOCAL.mode === 'pvp') {
      showPassScreen();
    } else {
      setMsg('Your turn — draw from the stock or the discard pile.');
      render();
    }
  }

  /* ================= AI turn (local pvc only) ================= */

  function aiTurn() {
    const p = S.players[1];
    setTimeout(() => {
      if (!S || S.over) return;
      const choice = AI.chooseDraw(S, p);
      if (choice === 'discard') {
        const res = E.actions.pickDiscard(S, 1);
        setMsg(`Computer takes ${R.cardLabel(res.card)} from the discard pile.`);
      } else {
        E.actions.drawStock(S, 1);
        setMsg('Computer draws from the stock.');
      }
      render();
      setTimeout(() => {
        if (!S || S.over) return;
        const plan = AI.planPlay(S, p, S.picked);
        execAIPlan(plan, 0);
      }, 800);
    }, 800);
  }

  function execAIPlan(plan, i) {
    if (!S || S.over || i >= plan.length) return;
    const p = S.players[1];
    const a = plan[i];

    if (a.type === 'meld') {
      const res = E.actions.layMeld(S, 1, a.cardIds);
      if (res.ok) {
        const label = res.meld.slots.map((s) => R.cardLabel(s.card)).join(' ');
        setMsg(`Computer plays ${label}.`);
      }
    } else if (a.type === 'attach') {
      const card = p.hand.find((c) => c.id === a.cardId);
      const target = card && S.melds.find((m) => R.canAttach(m, card));
      if (target) {
        E.actions.attach(S, 1, card.id, target.id);
        setMsg(`Computer attaches ${R.cardLabel(card)}.`);
      }
    } else if (a.type === 'discard') {
      const res = E.actions.discard(S, 1, a.cardId);
      if (res.ok) {
        if (S.over) {
          showEndScreen();
          return;
        }
        setMsg(
          (res.openedNow ? 'Computer opened! ' : '') +
            `Computer discards ${R.cardLabel(res.card)}. Your turn.`
        );
      }
      render();
      return;
    }
    render();
    setTimeout(() => execAIPlan(plan, i + 1), 750);
  }

  /* ================= rendering ================= */

  // Monochrome deck: hearts and diamonds render hollow instead of red.
  const suitGlyph = (suit) => ({ '♥': '♡', '♦': '♢' }[suit] || suit);

  function cardEl(card, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'card' + (opts.small ? ' small' : '');
    if (opts.faceDown) {
      el.classList.add('back');
      return el;
    }
    if (card.joker) {
      el.classList.add('joker');
      el.innerHTML =
        '<span class="corner">★</span><span class="pip">★</span><span class="jlabel">JOKER</span>';
    } else {
      el.classList.add(R.isRed(card) ? 'red' : 'black');
      const r = R.rankName(card.rank);
      const g = suitGlyph(card.suit);
      el.innerHTML = `<span class="corner">${r}<br>${g}</span><span class="pip">${g}</span>`;
    }
    el.dataset.id = card.id;
    return el;
  }

  function render() {
    const vm = getVM();
    if (!vm) return;
    // don't yank the hand out from under an in-progress drag
    if (drag.el && drag.moved) {
      drag.pendingRender = true;
      return;
    }
    const me = vm.players[vm.you];
    const opp = vm.players[1 - vm.you];

    // prune stale selections
    const handIds = new Set(vm.hand.map((c) => c.id));
    for (const id of [...view.selected]) if (!handIds.has(id)) view.selected.delete(id);

    // opponent bar
    $('opp-name').textContent = opp.name;
    $('opp-score').textContent = `${vm.scores[1 - vm.you]}/${vm.target}`;
    $('me-score').textContent = `${vm.scores[vm.you]}/${vm.target}`;
    $('opp-count').textContent = `${opp.handCount} cards`;
    $('opp-opened').textContent = opp.opened ? 'opened' : 'not opened';
    $('opp-opened').classList.toggle('on', opp.opened);
    const oppHand = $('opp-hand');
    oppHand.innerHTML = '';
    for (let i = 0; i < opp.handCount; i++) {
      oppHand.appendChild(cardEl(null, { faceDown: true, small: true }));
    }

    // table melds
    const meldsBox = $('melds');
    meldsBox.innerHTML = '';
    if (vm.melds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'table-hint';
      empty.textContent = 'Melds land here — open with 40+ points';
      meldsBox.appendChild(empty);
    }
    for (const m of vm.melds) {
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
      tag.textContent =
        vm.players[m.owner].name + (m.provisional ? ` · opening ${m.points}` : '');
      g.appendChild(tag);
      g.addEventListener('click', () => onMeldClick(m.id));
      meldsBox.appendChild(g);
    }

    // piles
    $('stock-count').textContent = vm.stockCount;
    const discardBox = $('discard');
    discardBox.innerHTML = '';
    if (vm.discardTop) discardBox.appendChild(cardEl(vm.discardTop));
    else {
      const ph = document.createElement('div');
      ph.className = 'card outline';
      discardBox.appendChild(ph);
    }

    // my bar
    $('me-name').textContent = me.name;
    $('me-opened').textContent = me.opened ? 'opened' : 'not opened';
    $('me-opened').classList.toggle('on', me.opened);
    const myTurn = isMyTurn(vm);
    $('me-open-pts').textContent =
      !me.opened && vm.provisionalPoints > 0 && myTurn
        ? `opening: ${vm.provisionalPoints}/40`
        : '';

    const handBox = $('hand');
    handBox.innerHTML = '';
    for (const c of orderedHand(vm)) {
      const el = cardEl(c);
      if (view.selected.has(c.id)) el.classList.add('selected');
      if (c.id === vm.newCardId) el.classList.add('fresh');
      el.addEventListener('click', () => onHandCardClick(c.id));
      attachDragHandlers(el);
      handBox.appendChild(el);
    }

    // buttons
    const playPhase = myTurn && vm.phase === 'play';
    $('btn-meld').disabled = !playPhase || view.selected.size < 3;
    $('btn-discard').disabled = !playPhase || view.selected.size !== 1;
    $('btn-takeback').classList.toggle('hidden', !(playPhase && vm.provisionalCount > 0));
    $('btn-undopick').classList.toggle(
      'hidden',
      !(playPhase && vm.picked != null && !vm.actedAfterPick)
    );

    // hint line
    let hint = view.msg;
    if (!hint && myTurn) {
      hint =
        vm.phase === 'draw'
          ? 'Draw from the stock or take the discard.'
          : 'Play melds, attach cards, then discard one card to end your turn.';
    }
    if (!hint && !myTurn && MODE === 'net' && !vm.over) {
      hint = `Waiting for ${opp.name}…`;
    }
    $('msgbar').textContent = hint;
    $('stock').classList.toggle('clickable', myTurn && vm.phase === 'draw');
    $('discard').classList.toggle(
      'clickable',
      myTurn && (vm.phase === 'draw' || view.selected.size === 1)
    );
  }

  /* ================= human interactions ================= */

  function onHandCardClick(cardId) {
    if (drag.suppressClick) {
      drag.suppressClick = false;
      return;
    }
    const vm = getVM();
    if (!isMyTurn(vm)) return;
    if (vm.phase !== 'play') {
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
    const vm = getVM();
    if (!isMyTurn(vm)) return;
    if (vm.phase !== 'draw') {
      setMsg('You already drew this turn.');
      render();
      return;
    }
    const res = act('drawStock');
    if (!res.async) setMsg(res.ok ? '' : res.error);
    render();
  }

  function onDiscardClick() {
    const vm = getVM();
    if (!isMyTurn(vm)) return;
    if (vm.phase === 'draw') {
      const res = act('pickDiscard');
      if (!res.async) {
        setMsg(
          res.ok
            ? 'You must use this card in a meld before your discard (or discard it back).'
            : res.error
        );
      }
      render();
      return;
    }
    if (view.selected.size === 1) onDiscardButton();
  }

  function onMeldClick(meldId) {
    const vm = getVM();
    if (!isMyTurn(vm) || vm.phase !== 'play' || view.selected.size === 0) return;
    const me = vm.players[vm.you];
    const meld = vm.melds.find((m) => m.id === meldId);
    const ids = [...view.selected];

    // Single card on a meld with a joker: swapping the joker out beats
    // attaching, so try that first.
    if (ids.length === 1 && me.opened && meld) {
      const card = vm.hand.find((c) => c.id === ids[0]);
      if (card && R.canReplaceJoker(meld, card)) {
        const res = act('replaceJoker', { cardId: ids[0], meldId });
        if (!res.async) {
          setMsg(res.ok ? 'You swapped the joker into your hand!' : res.error);
          if (res.ok) view.selected.clear();
          render();
        } else {
          view.selected.clear();
        }
        return;
      }
    }

    if (!me.opened) {
      setMsg('You can attach cards only after you have opened.');
      render();
      return;
    }

    // Work out an attach order that fits (so 8♡ 9♡ both land on 5-6-7♡
    // in one tap) by simulating on a clone, then send that sequence.
    const clone = meld && { ...meld, slots: meld.slots.map((s) => ({ ...s })) };
    const sequence = [];
    let progress = true;
    while (clone && progress) {
      progress = false;
      for (const id of ids) {
        if (sequence.includes(id)) continue;
        const card = vm.hand.find((c) => c.id === id);
        if (card && R.canAttach(clone, card)) {
          R.applyAttach(clone, card);
          sequence.push(id);
          progress = true;
        }
      }
    }
    if (sequence.length === 0) {
      const card = vm.hand.find((c) => c.id === ids[0]);
      setMsg(`${card ? R.cardLabel(card) : 'That card'} does not fit on that meld.`);
      render();
      return;
    }
    let lastError = null;
    for (const id of sequence) {
      const res = act('attach', { cardId: id, meldId });
      if (!res.async && !res.ok) lastError = res.error;
      else view.selected.delete(id);
    }
    setMsg(
      lastError || (view.selected.size ? 'Some selected cards did not fit.' : '')
    );
    render();
  }

  function onMeldButton() {
    const vm = getVM();
    if (!isMyTurn(vm) || vm.phase !== 'play') return;
    const res = act('layMeld', { cardIds: [...view.selected] });
    if (res.async) {
      view.selected.clear();
      return;
    }
    if (!res.ok) {
      setMsg(res.error);
    } else {
      view.selected.clear();
      const pts = E.provisionalPoints(S);
      setMsg(
        S.players[S.turn].opened
          ? 'Meld played.'
          : pts >= 40
            ? `Opening total ${pts} — discard to confirm your opening.`
            : `Opening total ${pts}/40 — keep going.`
      );
    }
    render();
  }

  function onDiscardButton() {
    const vm = getVM();
    if (!isMyTurn(vm) || vm.phase !== 'play' || view.selected.size !== 1) return;
    const id = [...view.selected][0];
    const res = act('discard', { cardId: id });
    if (res.async) return;
    if (!res.ok) {
      setMsg(res.error);
      render();
      return;
    }
    view.selected.clear();
    afterLocalDiscard(res);
  }

  function onTakeBack() {
    const vm = getVM();
    if (!isMyTurn(vm) || vm.phase !== 'play') return;
    const res = act('takeBack');
    if (!res.async) setMsg(res.ok ? 'Opening melds returned to your hand.' : res.error);
    render();
  }

  function onUndoPick() {
    const vm = getVM();
    if (!isMyTurn(vm)) return;
    const res = act('undoPickup');
    if (!res.async) setMsg(res.ok ? 'Pickup undone — draw from the stock.' : res.error);
    render();
  }

  function sortHand(bySuit) {
    const vm = getVM();
    if (!vm) return;
    const suitIdx = (s) => R.SUITS.indexOf(s);
    const cmp = (a, b) => {
      if (a.joker !== b.joker) return a.joker ? 1 : -1;
      if (a.joker) return 0;
      return bySuit
        ? suitIdx(a.suit) - suitIdx(b.suit) || a.rank - b.rank
        : a.rank - b.rank || suitIdx(a.suit) - suitIdx(b.suit);
    };
    handOrder[vm.you] = [...vm.hand].sort(cmp).map((c) => c.id);
    render();
  }

  /* ================= screens ================= */

  function show(screenId) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    $(screenId).classList.remove('hidden');
  }

  function showPassScreen() {
    $('pass-name').textContent = S.players[S.turn].name;
    show('pass-screen');
  }

  function showEndScreen(overrideTitle, overrideDetail) {
    const vm = getVM();
    if (overrideTitle) {
      $('end-title').textContent = overrideTitle;
      $('end-detail').textContent = overrideDetail || '';
      $('end-scores').textContent = '';
      $('end-cards').innerHTML = '';
      $('btn-next').classList.add('hidden');
      $('btn-again').textContent = 'Back to menu';
      show('end-screen');
      return;
    }
    const w = vm.players[vm.winner];
    const l = vm.players[1 - vm.winner];
    const penalty =
      vm.lastPenalty != null
        ? vm.lastPenalty
        : (vm.loserHand || []).reduce((s, c) => s + R.handPenalty(c), 0);
    if (vm.matchOver) {
      $('end-title').textContent = `★ ${vm.players[vm.matchWinner].name} wins the match! ★`;
      $('end-detail').textContent =
        `${l.name} takes ${penalty} point${penalty === 1 ? '' : 's'} and busts past ${vm.target}.`;
    } else {
      $('end-title').textContent = `★ ${w.name} wins hand ${vm.handNumber}! ★`;
      $('end-detail').textContent =
        `${l.name} takes ${penalty} penalty point${penalty === 1 ? '' : 's'}.`;
    }
    $('end-scores').textContent =
      `${vm.players[0].name} ${vm.scores[0]} · ${vm.players[1].name} ${vm.scores[1]}` +
      ` — reach ${vm.target} and you lose the match`;
    const box = $('end-cards');
    box.innerHTML = '';
    for (const c of vm.loserHand || []) box.appendChild(cardEl(c, { small: true }));
    $('btn-next').classList.toggle('hidden', vm.matchOver);
    $('btn-again').textContent = vm.matchOver ? 'Back to menu' : 'Quit match';
    show('end-screen');
  }

  /* ================= game start ================= */

  function chosenTarget() {
    const btn = document.querySelector('.target-btn.active');
    return btn ? Number(btn.dataset.target) : 151;
  }

  function startLocalGame() {
    const mode = $('btn-pvp').classList.contains('active') ? 'pvp' : 'pvc';
    MODE = 'local';
    LOCAL = { mode };
    const n1 = $('name1').value.trim() || 'Player 1';
    const n2 = mode === 'pvc' ? 'Computer' : $('name2').value.trim() || 'Player 2';
    S = E.newGame([n1, n2], { target: chosenTarget() });
    view.selected.clear();
    setMsg('');
    show('game-screen');
    if (mode === 'pvc' && S.turn === 1) {
      setMsg('Computer goes first…');
      render();
      aiTurn();
    } else if (mode === 'pvp') {
      showPassScreen();
    } else {
      setMsg('You go first — draw a card.');
      render();
    }
  }

  /* ================= online mode ================= */

  function netAvailable() {
    return !window.NO_NET && location.protocol !== 'file:' && 'WebSocket' in window;
  }

  function startOnlineCreate() {
    const name = $('name1').value.trim() || 'Player 1';
    const target = chosenTarget();
    window.NET.create(name, target);
    $('room-code-echo').textContent = '…';
    $('wait-target').textContent = `Match to ${target}.`;
    show('wait-screen');
  }

  function startOnlineJoin() {
    const name = $('name1').value.trim() || 'Player 2';
    const code = $('room-code').value.trim().toUpperCase();
    if (!code) {
      $('online-msg').textContent = 'Enter the room code you were given.';
      return;
    }
    window.NET.join(code, name);
  }

  function wireNet() {
    const NET = window.NET;
    NET.onCreated = (code) => {
      $('room-code-echo').textContent = code;
    };
    NET.onStart = () => {
      MODE = 'net';
      view.selected.clear();
      setMsg('');
      show('game-screen');
      render();
    };
    NET.onState = (msg) => {
      if (MODE !== 'net') return;
      const vm = getVM();
      if (msg) setMsg(msg);
      if (vm.over) {
        showEndScreen();
      } else {
        // a new hand may have been dealt while the end screen was up
        if ($('game-screen').classList.contains('hidden')) show('game-screen');
        render();
      }
    };
    NET.onError = (error) => {
      if (MODE === 'net' && !$('game-screen').classList.contains('hidden')) {
        setMsg(error);
        render();
      } else {
        $('online-msg').textContent = error;
      }
    };
    NET.onOppLeft = (msg) => {
      showEndScreen('Opponent left', msg || 'Your opponent left the game.');
    };
    NET.onClosed = (msg) => {
      if (MODE === 'net') showEndScreen('Connection lost', msg || 'The connection was lost.');
    };
  }

  /* ================= wiring ================= */

  function init() {
    const modeBtns = [$('btn-pvc'), $('btn-pvp'), $('btn-online')];
    for (const b of modeBtns) {
      b.addEventListener('click', () => {
        modeBtns.forEach((x) => x.classList.toggle('active', x === b));
        const online = b.id === 'btn-online';
        $('name2').classList.toggle('hidden', b.id !== 'btn-pvp');
        $('online-row').classList.toggle('hidden', !online);
        $('btn-start').classList.toggle('hidden', online);
      });
    }
    const targetBtns = [...document.querySelectorAll('.target-btn')];
    for (const b of targetBtns) {
      b.addEventListener('click', () => {
        targetBtns.forEach((x) => x.classList.toggle('active', x === b));
      });
    }
    if (!netAvailable()) {
      $('btn-online').disabled = true;
      $('btn-online').title = 'Online play needs the hosted version (npm start).';
    }

    $('btn-start').addEventListener('click', startLocalGame);
    $('btn-create-room').addEventListener('click', startOnlineCreate);
    $('btn-join-room').addEventListener('click', startOnlineJoin);
    $('btn-wait-cancel').addEventListener('click', () => {
      window.NET.leave();
      show('menu-screen');
    });

    $('stock').addEventListener('click', onStockClick);
    $('discard').addEventListener('click', onDiscardClick);
    $('btn-meld').addEventListener('click', onMeldButton);
    $('btn-discard').addEventListener('click', onDiscardButton);
    $('btn-takeback').addEventListener('click', onTakeBack);
    $('btn-undopick').addEventListener('click', onUndoPick);
    $('btn-sort-suit').addEventListener('click', () => sortHand(true));
    $('btn-sort-rank').addEventListener('click', () => sortHand(false));
    $('btn-pass-continue').addEventListener('click', () => {
      setMsg(`${S.players[S.turn].name}, draw from the stock or the discard pile.`);
      show('game-screen');
      render();
    });
    $('btn-next').addEventListener('click', () => {
      if (MODE === 'net') {
        window.NET.action('nextHand', {});
        return;
      }
      const res = act('nextHand');
      if (!res.ok) return;
      view.selected.clear();
      setMsg('');
      if (LOCAL.mode === 'pvp') {
        showPassScreen();
      } else {
        show('game-screen');
        if (S.turn === 1) {
          setMsg(`Hand ${S.handNumber} — Computer starts…`);
          render();
          aiTurn();
        } else {
          setMsg(`Hand ${S.handNumber} — you start. Draw a card.`);
          render();
        }
      }
    });
    $('btn-again').addEventListener('click', () => {
      if (MODE === 'net') window.NET.leave();
      MODE = null;
      S = null;
      show('menu-screen');
    });

    wireNet();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Exposed for automated testing.
  window.Scala40 = {
    getState: () => S,
    getVM,
    act,
    view,
    render,
  };
})();
