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
  const T = (k, p) => window.I18N.T(k, p);
  const errText = (res) => window.I18N.errText(res);

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

  const snd = (name) => window.Sound && window.Sound.play(name);

  // One sound vocabulary for every source of moves: local play, the AI,
  // and server events for online games.
  function soundForAction(action, res) {
    const map = {
      drawStock: 'draw',
      pickDiscard: 'draw',
      layMeld: 'meld',
      attach: 'attach',
      replaceJoker: 'joker',
      discard: 'discard',
      takeBack: 'discard',
      undoPickup: 'discard',
      nextHand: 'deal',
    };
    if (map[action]) snd(map[action]);
    const clearedCount = res && res.cleared && (res.cleared.length || res.cleared);
    if (clearedCount) snd('clear');
    if (res && res.openedNow) snd('open');
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

  function actWithSound(name, args) {
    const res = act(name, args);
    if (res.ok && !res.async) {
      soundForAction(name, res);
      if (res.cleared && res.cleared.length) {
        setMsg(T('hint.clearedMeld'));
      }
      // what the human takes and sheds is public info the AI may study
      if (LOCAL && LOCAL.mode === 'pvc' && res.card) {
        if (name === 'pickDiscard') LOCAL.aiMemory.oppPicks.push(res.card);
        if (name === 'discard') LOCAL.aiMemory.oppDiscards.push(res.card);
        if (name === 'undoPickup') LOCAL.aiMemory.oppPicks.pop();
      }
    }
    return res;
  }

  // Local-mode flow after a successful discard: end, AI turn, or pass.
  function afterLocalDiscard(res) {
    if (S.over) {
      showEndScreen();
      return;
    }
    if (LOCAL.mode === 'pvc' && S.turn === 1) {
      setMsg((res.openedNow ? T('hint.youOpened') : '') + T('cpu.thinking'));
      render();
      aiTurn();
    } else if (LOCAL.mode === 'pvp') {
      showPassScreen();
    } else {
      setMsg(T('hint.yourTurnFull'));
      render();
    }
  }

  /* ================= AI turn (local pvc only) ================= */

  function aiTurn() {
    const p = S.players[1];
    setTimeout(() => {
      if (!S || S.over) return;
      const opts = aiOpts();
      const choice = AI.chooseDraw(S, p, opts);
      if (choice === 'discard') {
        const res = E.actions.pickDiscard(S, 1);
        setMsg(T('cpu.takes', { card: R.cardLabel(res.card) }));
      } else {
        const res = E.actions.drawStock(S, 1);
        if (res.stalemate) {
          showEndScreen();
          return;
        }
        setMsg(T('cpu.draws'));
      }
      snd('draw');
      render();
      setTimeout(() => {
        if (!S || S.over) return;
        const plan = AI.planPlay(S, p, S.picked, opts);
        execAIPlan(plan, 0);
      }, 800);
    }, 800);
  }

  function execAIPlan(plan, i) {
    if (!S || S.over || i >= plan.length) return;
    const p = S.players[1];
    const a = plan[i];

    if (a.type === 'replaceJoker') {
      const res = E.actions.replaceJoker(S, 1, a.cardId, a.meldId);
      if (res.ok) {
        soundForAction('replaceJoker', res);
        setMsg(T('cpu.reclaims'));
      }
    } else if (a.type === 'meld') {
      const res = E.actions.layMeld(S, 1, a.cardIds);
      if (res.ok) {
        soundForAction('layMeld', res);
        const label = res.meld.slots.map((s) => R.cardLabel(s.card)).join(' ');
        setMsg(T('cpu.plays', { cards: label }));
      }
    } else if (a.type === 'attach') {
      const card = p.hand.find((c) => c.id === a.cardId);
      const target = card && S.melds.find((m) => R.canAttach(m, card));
      if (target) {
        const res = E.actions.attach(S, 1, card.id, target.id);
        if (res.ok) soundForAction('attach', res);
        setMsg(T('cpu.attaches', { card: R.cardLabel(card) }));
      }
    } else if (a.type === 'discard') {
      const res = E.actions.discard(S, 1, a.cardId);
      if (res.ok) {
        soundForAction('discard', res);
        if (S.over) {
          showEndScreen();
          return;
        }
        snd('turn');
        setMsg(
          (res.openedNow ? T('cpu.opened') : '') +
            T('cpu.discards', { card: R.cardLabel(res.card) })
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

    // prune stale selections
    const handIds = new Set(vm.hand.map((c) => c.id));
    for (const id of [...view.selected]) if (!handIds.has(id)) view.selected.delete(id);

    // opponents bar: one block per other seat, in turn order after you
    $('me-score').textContent = `${vm.scores[vm.you]}/${vm.target}`;
    const oppsBox = $('opps');
    oppsBox.innerHTML = '';
    for (let k = 1; k < vm.players.length; k++) {
      const i = (vm.you + k) % vm.players.length;
      const o = vm.players[i];
      const block = document.createElement('div');
      block.className = 'opp' + (vm.turn === i && !vm.over ? ' active' : '');
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML =
        `<span class="p-name"></span>` +
        `<span class="p-score">${vm.scores[i]}/${vm.target}</span>` +
        `<span class="p-count">${T('game.cards', { n: o.handCount })}</span>` +
        `<span class="p-open${o.opened ? ' on' : ''}">${o.opened ? T('game.opened') : T('game.notOpened')}</span>`;
      chip.querySelector('.p-name').textContent = o.name;
      block.appendChild(chip);
      const mini = document.createElement('div');
      mini.className = 'opp-hand';
      for (let n = 0; n < o.handCount; n++) {
        mini.appendChild(cardEl(null, { faceDown: true, small: true }));
      }
      block.appendChild(mini);
      oppsBox.appendChild(block);
    }
    $('me-bar').classList.toggle('active', vm.turn === vm.you && !vm.over);

    // table melds
    const meldsBox = $('melds');
    meldsBox.innerHTML = '';
    if (vm.melds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'table-hint';
      empty.textContent = T('game.tableHint');
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
    $('stock-label').textContent = T('game.left', { n: vm.stockCount });
    $('cleared').classList.toggle('hidden', vm.clearedCount === 0);
    $('cleared-label').textContent = T('game.cleared', { n: vm.clearedCount });
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
    $('me-opened').textContent = me.opened ? T('game.opened') : T('game.notOpened');
    $('me-opened').classList.toggle('on', me.opened);
    const myTurn = isMyTurn(vm);
    $('me-open-pts').textContent =
      !me.opened && vm.provisionalPoints > 0 && myTurn
        ? T('game.opening', { pts: vm.provisionalPoints })
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
      hint = vm.phase === 'draw' ? T('hint.draw') : T('hint.play');
    }
    if (!hint && !myTurn && MODE === 'net' && !vm.over) {
      hint = T('hint.waiting', { name: vm.players[vm.turn].name });
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
      setMsg(T('hint.drawFirst'));
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
      setMsg(T('hint.alreadyDrew'));
      render();
      return;
    }
    const res = actWithSound('drawStock');
    if (!res.async) setMsg(res.ok ? '' : errText(res));
    if (res.stalemate) {
      showEndScreen();
      return;
    }
    render();
  }

  function onDiscardClick() {
    const vm = getVM();
    if (!isMyTurn(vm)) return;
    if (vm.phase === 'draw') {
      const res = actWithSound('pickDiscard');
      if (!res.async) {
        setMsg(res.ok ? T('hint.mustUse') : errText(res));
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
        const res = actWithSound('replaceJoker', { cardId: ids[0], meldId });
        if (!res.async) {
          setMsg(res.ok ? T('hint.jokerSwap') : errText(res));
          if (res.ok) view.selected.clear();
          render();
        } else {
          view.selected.clear();
        }
        return;
      }
    }

    if (!me.opened) {
      setMsg(T('hint.attachAfterOpen'));
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
      setMsg(T('hint.doesNotFit', { card: card ? R.cardLabel(card) : '?' }));
      render();
      return;
    }
    let lastError = null;
    for (const id of sequence) {
      const res = actWithSound('attach', { cardId: id, meldId });
      if (!res.async && !res.ok) lastError = errText(res);
      else view.selected.delete(id);
    }
    setMsg(lastError || (view.selected.size ? T('hint.someDidntFit') : ''));
    render();
  }

  function onMeldButton() {
    const vm = getVM();
    if (!isMyTurn(vm) || vm.phase !== 'play') return;
    const res = actWithSound('layMeld', { cardIds: [...view.selected] });
    if (res.async) {
      view.selected.clear();
      return;
    }
    if (!res.ok) {
      snd('error');
      setMsg(errText(res));
    } else {
      view.selected.clear();
      const pts = E.provisionalPoints(S);
      setMsg(
        S.players[S.turn].opened
          ? T('hint.meldPlayed')
          : pts >= 40
            ? T('hint.openingOk', { pts })
            : T('hint.openingGo', { pts })
      );
    }
    render();
  }

  function onDiscardButton() {
    const vm = getVM();
    if (!isMyTurn(vm) || vm.phase !== 'play' || view.selected.size !== 1) return;
    const id = [...view.selected][0];
    const res = actWithSound('discard', { cardId: id });
    if (res.async) return;
    if (!res.ok) {
      snd('error');
      setMsg(errText(res));
      render();
      return;
    }
    view.selected.clear();
    afterLocalDiscard(res);
  }

  function onTakeBack() {
    const vm = getVM();
    if (!isMyTurn(vm) || vm.phase !== 'play') return;
    const res = actWithSound('takeBack');
    if (!res.async) setMsg(res.ok ? T('hint.tookBack') : errText(res));
    render();
  }

  function onUndoPick() {
    const vm = getVM();
    if (!isMyTurn(vm)) return;
    const res = actWithSound('undoPickup');
    if (!res.async) setMsg(res.ok ? T('hint.pickupUndone') : errText(res));
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
    // ads live on the menu and between hands — never over the table
    if (window.Monetize) {
      if (screenId === 'menu-screen' || screenId === 'end-screen') window.Monetize.showBanner();
      else window.Monetize.hideBanner();
    }
  }

  function showPassScreen() {
    $('pass-to').textContent = T('pass.turn', { name: S.players[S.turn].name });
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
      $('btn-again').textContent = T('end.menu');
      show('end-screen');
      return;
    }
    const w = vm.winner != null ? vm.players[vm.winner] : null;
    const takes = (vm.lastPenalties || [])
      .map((pen, i) => (i === vm.winner ? null : `${vm.players[i].name} +${pen}`))
      .filter(Boolean)
      .join(' · ');
    if (!w && !vm.matchOver) {
      $('end-title').textContent = T('end.dead');
      $('end-detail').textContent = takes;
    } else if (vm.matchOver) {
      const standings = (vm.matchRanking || [])
        .map((i, place) => `${place + 1}. ${vm.players[i].name} (${vm.scores[i]})`)
        .join('  ');
      $('end-title').textContent = T('end.winsMatch', { name: vm.players[vm.matchWinner].name });
      $('end-detail').textContent = standings;
    } else {
      $('end-title').textContent = T('end.winsHand', { name: w.name, n: vm.handNumber });
      $('end-detail').textContent = takes;
    }
    if (!w) $('end-cards').innerHTML = '';
    $('end-scores').textContent =
      vm.players.map((pl, i) => `${pl.name} ${vm.scores[i]}`).join(' · ') +
      T('end.scores', { target: vm.target });
    const box = $('end-cards');
    box.innerHTML = '';
    if (vm.players.length === 2 && vm.loserHands) {
      for (const c of vm.loserHands.find(Boolean) || []) box.appendChild(cardEl(c, { small: true }));
    }
    $('btn-next').classList.toggle('hidden', vm.matchOver);
    $('btn-again').textContent = vm.matchOver ? T('end.menu') : T('end.quit');
    snd(vm.winner === vm.you || (vm.matchOver && vm.matchWinner === vm.you) ? 'win' : 'lose');
    show('end-screen');
    if (window.Monetize) window.Monetize.onHandEnd();
  }

  /* ================= game start ================= */

  function chosenTarget() {
    const btn = document.querySelector('.target-btn.active[data-target]');
    return btn ? Number(btn.dataset.target) : 151;
  }

  function chosenDifficulty() {
    const btn = document.querySelector('.diff-btn.active');
    return btn ? btn.dataset.diff : 'medium';
  }

  function aiOpts() {
    return {
      level: LOCAL.level || 'medium',
      memory: LOCAL.aiMemory,
      minOppHand: S.players[0].hand.length,
      strictJoker: S.rules.strictJoker,
    };
  }

  function chosenRules() {
    const sweepBtn = document.querySelector('.hr-sweep.active');
    const jokerBtn = document.querySelector('.hr-joker.active');
    return {
      sweep: !sweepBtn || sweepBtn.dataset.v === 'on',
      strictJoker: !!jokerBtn && jokerBtn.dataset.v === 'strict',
    };
  }

  function chosenSeats() {
    const btn = document.querySelector('.seats-btn.active');
    return btn ? Number(btn.dataset.seats) : 2;
  }

  // Persistent anonymous player id — ties ranked results to this device.
  function getPid() {
    try {
      let pid = localStorage.getItem('scala40.pid');
      if (!pid) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        pid = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('scala40.pid', pid);
      }
      return pid;
    } catch {
      return null;
    }
  }

  function startLocalGame() {
    const mode = $('btn-pvp').classList.contains('active') ? 'pvp' : 'pvc';
    MODE = 'local';
    LOCAL = { mode, level: chosenDifficulty(), aiMemory: { oppPicks: [], oppDiscards: [] } };
    const n1 = $('name1').value.trim() || 'Player 1';
    let names;
    if (mode === 'pvc') {
      names = [n1, 'Computer'];
    } else {
      names = [n1, $('name2').value.trim() || 'Player 2'];
      for (let i = 3; i <= chosenSeats(); i++) names.push(`Player ${i}`);
    }
    S = E.newGame(names, { target: chosenTarget(), rules: chosenRules() });
    view.selected.clear();
    setMsg('');
    snd('deal');
    show('game-screen');
    if (mode === 'pvc' && S.turn === 1) {
      setMsg(T('cpu.first'));
      render();
      aiTurn();
    } else if (mode === 'pvp') {
      showPassScreen();
    } else {
      setMsg(T('hint.youFirst'));
      render();
    }
  }

  /* ================= online mode ================= */

  function netAvailable() {
    if (window.NO_NET || !('WebSocket' in window)) return false;
    // a native app needs the deployed server address configured
    const native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (native || location.protocol === 'file:') return !!window.GAME_SERVER_URL;
    return true;
  }

  function startOnlineCreate() {
    const name = $('name1').value.trim() || 'Player 1';
    const target = chosenTarget();
    const seats = chosenSeats();
    window.NET.create(name, target, seats, getPid(), chosenRules());
    $('room-code-echo').textContent = '…';
    $('wait-target').textContent = T('wait.matchTo', { seats, target });
    $('wait-count').textContent = '';
    show('wait-screen');
  }

  function startOnlineJoin() {
    const name = $('name1').value.trim() || 'Player 2';
    const code = $('room-code').value.trim().toUpperCase();
    if (!code) {
      $('online-msg').textContent = T('menu.enterCode');
      return;
    }
    window.NET.join(code, name, getPid());
  }

  function wireNet() {
    const NET = window.NET;
    NET.onCreated = (code) => {
      $('room-code-echo').textContent = code;
    };
    NET.onLobby = (joined, size, code) => {
      $('room-code-echo').textContent = code;
      $('wait-count').textContent = T('wait.count', { joined, size });
      show('wait-screen');
    };
    NET.onStart = () => {
      MODE = 'net';
      view.selected.clear();
      const vm = getVM();
      setMsg(T('net.gameOn', { name: vm.players[vm.turn].name }));
      snd('deal');
      show('game-screen');
      render();
    };
    NET.onState = (evt) => {
      if (MODE !== 'net') return;
      const vm = getVM();
      const msg = buildNetMsg(evt, vm);
      if (msg) setMsg(msg);
      if (evt && evt.a) soundForAction(evt.a, evt);
      if (vm.over) {
        showEndScreen();
      } else {
        if (evt && evt.a === 'discard' && vm.turn === vm.you) snd('turn');
        // a new hand may have been dealt while the end screen was up
        if ($('game-screen').classList.contains('hidden')) show('game-screen');
        render();
      }
    };
    NET.onError = (e) => {
      const text = errText(e);
      if (MODE === 'net' && !$('game-screen').classList.contains('hidden')) {
        setMsg(text);
        render();
      } else {
        $('online-msg').textContent = text;
      }
    };
    NET.onOppOffline = (name) => {
      setMsg(T('net.oppOffline', { name }));
      render();
    };
    NET.onOppBack = (name) => {
      setMsg(T('net.oppBack', { name }));
      render();
    };
    NET.onOppLeft = (name) => {
      showEndScreen(T('net.oppLeftTitle'), T('net.oppLeftMsg', { name: name || '?' }));
    };
    NET.onClosed = () => {
      if (MODE === 'net') showEndScreen(T('net.connLostTitle'), T('net.connLost'));
    };
  }

  /* Compose a localized move description from a server event. */
  function buildNetMsg(evt, vm) {
    if (!evt || !evt.a || !vm) return '';
    const who = vm.players[evt.by];
    const name = who ? who.name : '?';
    const card = evt.card ? R.cardLabel(evt.card) : '';
    let msg = '';
    switch (evt.a) {
      case 'drawStock': msg = T('net.drew', { name }); break;
      case 'pickDiscard': msg = T('net.took', { name, card }); break;
      case 'undoPickup': msg = T('net.putBack', { name, card }); break;
      case 'layMeld':
        msg = T('net.played', {
          name,
          cards: (evt.meld || []).map((c) => R.cardLabel(c)).join(' '),
        });
        break;
      case 'attach': msg = T('net.attached', { name, card }); break;
      case 'replaceJoker': msg = T('net.swapped', { name, card }); break;
      case 'takeBack': msg = T('net.tookBack', { name }); break;
      case 'discard':
        msg =
          (evt.openedNow ? T('net.opened', { name }) : '') +
          T(evt.won ? 'net.discardedWins' : 'net.discarded', { name, card });
        break;
      case 'nextHand':
        msg = T('net.handDealt', { n: evt.handNumber, name: vm.players[vm.turn].name });
        break;
      case 'rejoined': msg = T('net.reconnected'); break;
    }
    if (evt.cleared) msg += T('net.cleared');
    if (evt.stalemate) msg += T('net.dead');
    return msg;
  }

  /* ================= ranked stats screen ================= */

  let statsMode = '2';

  function statTile(label, value, sub) {
    const d = document.createElement('div');
    d.className = 'stat-tile';
    d.innerHTML = `<span class="stat-label"></span><span class="stat-value"></span><span class="stat-sub"></span>`;
    d.children[0].textContent = label;
    d.children[1].textContent = value;
    d.children[2].textContent = sub || '';
    return d;
  }

  async function renderStatsScreen() {
    const my = $('my-stats');
    const lb = $('lb-table');
    my.innerHTML = '<p class="online-msg">Loading…</p>';
    lb.innerHTML = '';
    try {
      const base = window.NET.apiBase();
      const [mine, board] = await Promise.all([
        fetch(`${base}/api/stats?pid=${getPid()}`).then((r) => r.json()),
        fetch(`${base}/api/leaderboard?mode=${statsMode}`).then((r) => r.json()),
      ]);
      my.innerHTML = '';
      const m = (mine.modes || {})[statsMode];
      if (!m || !m.games) {
        const p = document.createElement('p');
        p.className = 'online-msg';
        p.textContent = T('stats.none');
        my.appendChild(p);
      } else {
        const losses = m.games - m.wins;
        const pct = Math.round((100 * m.wins) / m.games);
        const streak = m.streak > 0 ? `W${m.streak}` : m.streak < 0 ? `L${-m.streak}` : '—';
        const handsLost = m.handsPlayed - m.handsWon;
        const avg = handsLost > 0 ? Math.round(m.pointsTaken / handsLost) : 0;
        const grid = document.createElement('div');
        grid.className = 'stat-grid';
        grid.appendChild(statTile(T('stats.rating'), m.rating));
        grid.appendChild(statTile(T('stats.record'), `${m.wins}-${losses}`, T('stats.winsPct', { pct })));
        grid.appendChild(statTile(T('stats.streak'), streak, T('stats.best', { n: m.bestStreak })));
        grid.appendChild(statTile(T('stats.matches'), m.games));
        grid.appendChild(statTile(T('stats.hands'), `${m.handsWon}/${m.handsPlayed}`, T('stats.wonPlayed')));
        grid.appendChild(statTile(T('stats.avg'), avg, T('stats.perHand')));
        my.appendChild(grid);
      }
      if (!board.length) {
        const p = document.createElement('p');
        p.className = 'online-msg';
        p.textContent = T('stats.nobody');
        lb.appendChild(p);
      }
      board.forEach((e, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row';
        row.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name"></span><span class="lb-rating">${e.rating}</span><span class="lb-record">${e.wins}/${e.games}</span>`;
        row.querySelector('.lb-name').textContent = e.name;
        lb.appendChild(row);
      });
    } catch {
      my.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'online-msg';
      p.textContent = T('stats.serverOnly');
      my.appendChild(p);
    }
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
        $('seats-row').classList.toggle('hidden', b.id === 'btn-pvc');
        $('diff-row').classList.toggle('hidden', b.id !== 'btn-pvc');
      });
    }
    const targetBtns = [...document.querySelectorAll('.target-btn[data-target]')];
    for (const b of targetBtns) {
      b.addEventListener('click', () => {
        targetBtns.forEach((x) => x.classList.toggle('active', x === b));
      });
    }
    const diffBtns = [...document.querySelectorAll('.diff-btn')];
    try {
      const saved = localStorage.getItem('scala40.diff');
      if (saved) diffBtns.forEach((x) => x.classList.toggle('active', x.dataset.diff === saved));
    } catch {}
    for (const b of diffBtns) {
      b.addEventListener('click', () => {
        diffBtns.forEach((x) => x.classList.toggle('active', x === b));
        try {
          localStorage.setItem('scala40.diff', b.dataset.diff);
        } catch {}
      });
    }
    const langBtns = [...document.querySelectorAll('.lang-btn')];
    const syncLang = () => {
      langBtns.forEach((x) => x.classList.toggle('active', x.dataset.lang === window.I18N.lang()));
    };
    for (const b of langBtns) {
      b.addEventListener('click', () => {
        window.I18N.setLang(b.dataset.lang);
        syncLang();
        const sb = $('btn-sound');
        sb.textContent = window.Sound && window.Sound.muted() ? T('game.soundOff') : T('game.soundOn');
        if (!$('stats-screen').classList.contains('hidden')) renderStatsScreen();
        render();
      });
    }
    window.I18N.applyStatic();
    syncLang();

    for (const cls of ['hr-sweep', 'hr-joker']) {
      const btns = [...document.querySelectorAll('.' + cls)];
      try {
        const saved = localStorage.getItem('scala40.' + cls);
        if (saved) btns.forEach((x) => x.classList.toggle('active', x.dataset.v === saved));
      } catch {}
      for (const b of btns) {
        b.addEventListener('click', () => {
          btns.forEach((x) => x.classList.toggle('active', x === b));
          try {
            localStorage.setItem('scala40.' + cls, b.dataset.v);
          } catch {}
        });
      }
    }
    const seatBtns = [...document.querySelectorAll('.seats-btn')];
    for (const b of seatBtns) {
      b.addEventListener('click', () => {
        seatBtns.forEach((x) => x.classList.toggle('active', x === b));
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
    const soundBtn = $('btn-sound');
    const syncSound = () => {
      soundBtn.textContent =
        window.Sound && window.Sound.muted() ? T('game.soundOff') : T('game.soundOn');
    };
    soundBtn.addEventListener('click', () => {
      if (window.Sound) window.Sound.toggle();
      syncSound();
    });
    syncSound();

    $('btn-sort-suit').addEventListener('click', () => sortHand(true));
    $('btn-sort-rank').addEventListener('click', () => sortHand(false));
    $('btn-pass-continue').addEventListener('click', () => {
      setMsg(T('hint.passDraw', { name: S.players[S.turn].name }));
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
      snd('deal');
      LOCAL.aiMemory = { oppPicks: [], oppDiscards: [] };
      view.selected.clear();
      setMsg('');
      if (LOCAL.mode === 'pvp') {
        showPassScreen();
      } else {
        show('game-screen');
        if (S.turn === 1) {
          setMsg(T('cpu.handStart', { n: S.handNumber }));
          render();
          aiTurn();
        } else {
          setMsg(T('hint.handStart', { n: S.handNumber }));
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

    $('btn-stats').addEventListener('click', () => {
      show('stats-screen');
      renderStatsScreen();
    });
    $('btn-stats-back').addEventListener('click', () => show('menu-screen'));
    for (const b of document.querySelectorAll('#stats-tabs .mode-btn')) {
      b.addEventListener('click', () => {
        document
          .querySelectorAll('#stats-tabs .mode-btn')
          .forEach((x) => x.classList.toggle('active', x === b));
        statsMode = b.dataset.mode;
        renderStatsScreen();
      });
    }

    wireNet();

    // monetization (native app builds only; a no-op on the web)
    if (window.Monetize) {
      const row = $('monetize-row');
      const note = $('monetize-msg');
      const refresh = () => row.classList.toggle('hidden', !window.Monetize.showsAds());
      window.Monetize.init().then(refresh);
      $('btn-remove-ads').addEventListener('click', async () => {
        note.textContent = '';
        const res = await window.Monetize.buyRemoveAds();
        note.textContent = res.ok ? T('iap.removed') : res.error;
        refresh();
      });
      $('btn-restore-ads').addEventListener('click', async () => {
        note.textContent = '';
        const res = await window.Monetize.restorePurchases();
        note.textContent = res.ok ? T('iap.restored') : res.error;
        refresh();
      });
    }
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
