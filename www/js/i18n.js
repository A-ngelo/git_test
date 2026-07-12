/*
 * Scala 40 — internationalization (English / Italiano).
 * T(key, params) resolves a string in the active language with {param}
 * substitution; the choice persists and defaults to Italian on Italian
 * devices. Static screen text is applied through a selector map so the
 * markup stays language-free. Card labels stay universal (A/J/Q/K + suit
 * symbols are read the same way at an Italian table).
 */
(function (global) {
  'use strict';

  const DICT = {
    en: {
      // menu
      'menu.tagline': 'Italian 40-point rummy · 2 decks · 4 jokers',
      'menu.pvc': '▶ vs CPU',
      'menu.pvp': '▶ 2P',
      'menu.online': '▶ Online',
      'menu.cpu': 'CPU',
      'menu.easy': 'Easy',
      'menu.med': 'Med',
      'menu.hard': 'Hard',
      'menu.matchTo': 'Match to',
      'menu.players': 'Players',
      'menu.name1': 'Player 1 name',
      'menu.name2': 'Player 2 name',
      'menu.deal': 'Deal cards',
      'menu.create': 'Create room',
      'menu.orJoin': '— or join a friend —',
      'menu.join': 'Join',
      'menu.code': 'CODE',
      'menu.enterCode': 'Enter the room code you were given.',
      'menu.stats': 'Ranked stats',
      'menu.house': 'House rules',
      'menu.hrSweep': 'Clear full melds',
      'menu.hrOn': 'On',
      'menu.hrOff': 'Off',
      'menu.hrJoker': 'Joker reclaim',
      'menu.hrKeep': 'Keep',
      'menu.hrStrict': 'Strict',
      'menu.hrNote':
        'Defaults are this app’s way. "Strict" means a reclaimed joker must be replayed the same turn. Online rooms use the creator’s rules.',
      'menu.lang': 'Language',
      'menu.howto': 'How to play',
      'menu.rules': [
        'Each player gets 13 cards. On your turn: draw one card, then optionally play melds, and discard one card.',
        'Melds are sets (3–4 cards of the same rank, all different suits) or runs (3+ consecutive cards of one suit). Max one joker per meld.',
        'Your first melds must total 40+ points in a single turn ("opening"). A=11 (or 1 in A-2-3), face cards 10, others face value.',
        'After opening you can attach single cards to any meld on the table and swap table jokers for the real card.',
        'You may take the top discard only if you use it in a meld that turn.',
        'Discard your last card to win the hand. Losers count the cards left in hand (joker 25, ace 11, faces 10, rest face value) — or a flat 100 if they never opened.',
        'Penalty points add up hand after hand — reach the match limit (101/151/201, your pick) and you lose the match.',
        'Play 1v1, 3, or 4 players (pass-and-play or online). Online matches are ranked — check the leaderboard from the menu.',
        'Drag cards to arrange your hand however you like, or use the sort buttons.',
        'A finished meld with no joker — all four suits, or a full A-to-K run — is automatically cleared off the table to keep the board tidy.',
      ],
      // waiting room / pass screen
      'wait.title': 'Room ready',
      'wait.share': 'Share this code with your opponent:',
      'wait.starts': 'The game starts when everyone joins.',
      'wait.count': '{joined}/{size} players in.',
      'wait.matchTo': '{seats}-player match to {target}.',
      'wait.cancel': 'Cancel',
      'pass.title': 'Pass the device',
      'pass.turn': 'It’s {name}’s turn',
      'pass.ready': 'I’m ready',
      // table
      'game.tableHint': 'Melds land here — open with 40+ points',
      'game.left': '{n} left',
      'game.cleared': '{n} cleared',
      'game.cards': '{n} cards',
      'game.opened': 'opened',
      'game.notOpened': 'not opened',
      'game.opening': 'opening: {pts}/40',
      'game.meld': 'Play meld',
      'game.discard': 'Discard',
      'game.takeback': 'Take back',
      'game.undopick': 'Undo pickup',
      'game.sortSuit': 'Sort ♠♥',
      'game.sortRank': 'Sort 1‑9',
      'game.soundOn': '♪ on',
      'game.soundOff': '♪ off',
      // hints and local messages
      'hint.draw': 'Draw from the stock or take the discard.',
      'hint.play': 'Play melds, attach cards, then discard one card to end your turn.',
      'hint.drawFirst': 'Draw a card first.',
      'hint.alreadyDrew': 'You already drew this turn.',
      'hint.waiting': 'Waiting for {name}…',
      'hint.mustUse': 'You must use this card in a meld before your discard (or discard it back).',
      'hint.putBack': 'You put that card back — draw from the stock.',
      'hint.emptyDiscard': 'The discard pile is empty.',
      'hint.pickupUndone': 'Pickup undone — draw from the stock.',
      'hint.tookBack': 'Opening melds returned to your hand.',
      'hint.meldPlayed': 'Meld played.',
      'hint.openingGo': 'Opening total {pts}/40 — keep going.',
      'hint.openingOk': 'Opening total {pts} — discard to confirm your opening.',
      'hint.youOpened': 'You opened! ',
      'hint.jokerSwap': 'You swapped the joker into your hand!',
      'hint.someDidntFit': 'Some selected cards did not fit.',
      'hint.attachAfterOpen': 'You can attach cards only after you have opened.',
      'hint.doesNotFit': '{card} does not fit on that meld.',
      'hint.clearedMeld': 'A completed meld was cleared off the table.',
      'hint.youFirst': 'You go first — draw a card.',
      'hint.yourTurnFull': 'Your turn — draw from the stock or the discard pile.',
      'hint.passDraw': '{name}, draw from the stock or the discard pile.',
      'hint.handStart': 'Hand {n} — you start. Draw a card.',
      // computer narration (local vs CPU)
      'cpu.thinking': 'Computer is thinking…',
      'cpu.first': 'Computer goes first…',
      'cpu.handStart': 'Hand {n} — Computer starts…',
      'cpu.draws': 'Computer draws from the stock.',
      'cpu.takes': 'Computer takes {card} from the discard pile.',
      'cpu.plays': 'Computer plays {cards}.',
      'cpu.attaches': 'Computer attaches {card}.',
      'cpu.reclaims': 'Computer swaps the real card in and reclaims the joker!',
      'cpu.opened': 'Computer opened! ',
      'cpu.discards': 'Computer discards {card}. Your turn.',
      // online move feed (client-composed from server events)
      'net.gameOn': 'Game on — {name} goes first.',
      'net.drew': '{name} drew from the stock.',
      'net.took': '{name} took {card} from the discard pile.',
      'net.putBack': '{name} put {card} back and will draw from the stock.',
      'net.played': '{name} played {cards}.',
      'net.attached': '{name} attached {card}.',
      'net.swapped': '{name} swapped the joker for {card}.',
      'net.tookBack': '{name} took back their opening melds.',
      'net.discarded': '{name} discarded {card}.',
      'net.discardedWins': '{name} discarded {card} and wins the hand!',
      'net.opened': '{name} opened! ',
      'net.handDealt': 'Hand {n} dealt — {name} leads.',
      'net.cleared': ' A completed meld was cleared off the table.',
      'net.dead': ' The stock is gone — dead hand, everyone counts.',
      'net.reconnected': 'Reconnected.',
      'net.oppOffline': '{name} lost connection — waiting for them to return…',
      'net.oppBack': '{name} is back.',
      'net.oppLeftMsg': '{name} left the game.',
      'net.oppLeftTitle': 'Opponent left',
      'net.connLostTitle': 'Connection lost',
      'net.connLost': 'Lost the connection to the server.',
      // hand / match end
      'end.winsHand': '★ {name} wins hand {n}! ★',
      'end.winsMatch': '★ {name} wins the match! ★',
      'end.dead': 'Dead hand — nobody could draw',
      'end.scores': ' — reach {target} and you lose the match',
      'end.next': 'Next hand',
      'end.quit': 'Quit match',
      'end.menu': 'Back to menu',
      // ranked stats
      'stats.title': 'Ranked stats',
      'stats.tagline': 'Online matches count toward the ladder',
      'stats.rating': 'Rating',
      'stats.record': 'Record',
      'stats.winsPct': '{pct}% wins',
      'stats.streak': 'Streak',
      'stats.best': 'best W{n}',
      'stats.matches': 'Matches',
      'stats.hands': 'Hands',
      'stats.wonPlayed': 'won/played',
      'stats.avg': 'Avg taken',
      'stats.perHand': 'pts/lost hand',
      'stats.board': 'Leaderboard',
      'stats.none': 'No ranked games in this mode yet — finish an online match to get on the board.',
      'stats.nobody': 'Nobody on this ladder yet.',
      'stats.serverOnly':
        'The ranked ladder lives on the game server — open the app from your hosted server to see it.',
      'stats.back': 'Back',
      // monetization
      'iap.remove': '★ Remove ads',
      'iap.restore': 'Restore purchase',
      'iap.removed': 'Ads removed — thank you!',
      'iap.restored': 'Purchase restored — ads removed.',
      // engine errors (by code)
      'err.gameOver': 'The game is over.',
      'err.notYourTurn': 'Not your turn.',
      'err.alreadyDrew': 'You already drew this turn.',
      'err.drawFirst': 'Draw a card first.',
      'err.mustStock': 'You put that card back — draw from the stock.',
      'err.emptyDiscard': 'The discard pile is empty.',
      'err.nothingToUndo': 'Nothing to undo.',
      'err.tooLate': 'Too late to undo — you already played.',
      'err.notInHand': 'Card not in hand.',
      'err.keepOne': 'You must keep a card to discard.',
      'err.badMeld':
        'Not a valid meld: 3+ same rank (different suits) or 3+ in a row of one suit, max one joker.',
      'err.attachClosed': 'You can attach cards only after opening (in an earlier turn).',
      'err.nothingAttach': 'Nothing to attach.',
      'err.noFit': '{card} does not fit on that meld.',
      'err.swapClosed': 'You can swap jokers only after opening.',
      'err.nothingSwap': 'Nothing to swap.',
      'err.cannotReplace': 'That card cannot replace the joker.',
      'err.nothingBack': 'Nothing to take back.',
      'err.need40': 'Opening needs 40+ points — you have {pts}. Lay more melds or take them back.',
      'err.usePicked': 'Meld the card you took from the discard pile first (or discard that same card).',
      'err.strictJoker': 'Strict rule: replay the reclaimed joker this turn (or discard it).',
      'err.oneReclaim': 'Use the reclaimed joker before taking another.',
      'err.handNotOver': 'The hand is not over yet.',
      'err.matchOver': 'The match is over.',
      'err.noRoom': 'No room with code {code}.',
      'err.roomFull': 'That room is already full.',
      'err.serverFull': 'Server is full right now — try again soon.',
      'err.gone': 'That game is no longer available.',
      'err.notInGame': 'You are not in a game.',
    },

    it: {
      'menu.tagline': 'Ramino italiano a 40 punti · 2 mazzi · 4 jolly',
      'menu.pvc': '▶ vs CPU',
      'menu.pvp': '▶ 2G',
      'menu.online': '▶ Online',
      'menu.cpu': 'CPU',
      'menu.easy': 'Facile',
      'menu.med': 'Medio',
      'menu.hard': 'Difficile',
      'menu.matchTo': 'Partita a',
      'menu.players': 'Giocatori',
      'menu.name1': 'Nome giocatore 1',
      'menu.name2': 'Nome giocatore 2',
      'menu.deal': 'Distribuisci',
      'menu.create': 'Crea stanza',
      'menu.orJoin': '— oppure unisciti a un amico —',
      'menu.join': 'Entra',
      'menu.code': 'CODICE',
      'menu.enterCode': 'Inserisci il codice stanza che ti hanno dato.',
      'menu.stats': 'Statistiche',
      'menu.house': 'Regole della casa',
      'menu.hrSweep': 'Pulisci giochi completi',
      'menu.hrOn': 'Sì',
      'menu.hrOff': 'No',
      'menu.hrJoker': 'Ripresa del jolly',
      'menu.hrKeep': 'Tieni',
      'menu.hrStrict': 'Rigida',
      'menu.hrNote':
        'Le impostazioni predefinite sono quelle dell’app. Con "Rigida" il jolly ripreso va rigiocato nello stesso turno. Le stanze online usano le regole di chi le crea.',
      'menu.lang': 'Lingua',
      'menu.howto': 'Come si gioca',
      'menu.rules': [
        'Ogni giocatore riceve 13 carte. Nel tuo turno: pesca una carta, cala se vuoi, poi scarta una carta.',
        'Si calano combinazioni (3–4 carte dello stesso valore, semi diversi) o scale (3+ carte consecutive dello stesso seme). Massimo un jolly per gioco.',
        'La prima calata deve valere almeno 40 punti in un solo turno ("apertura"). A=11 (o 1 in A-2-3), figure 10, le altre il valore.',
        'Dopo l’apertura puoi attaccare carte singole a qualsiasi gioco sul tavolo e riprendere i jolly con la carta vera.',
        'Puoi prendere la carta in cima al pozzo solo se la usi subito in un gioco.',
        'Chiudi scartando l’ultima carta. Gli altri contano le carte rimaste in mano (jolly 25, asso 11, figure 10, il resto il valore) — oppure 100 fissi se non hanno mai aperto.',
        'I punti si sommano mano dopo mano — chi raggiunge il limite (101/151/201, a scelta) perde la partita.',
        'Gioca 1c1, in 3 o in 4 (sullo stesso telefono o online). Le partite online sono classificate — guarda la classifica dal menu.',
        'Trascina le carte per ordinare la mano come preferisci, o usa i pulsanti di ordinamento.',
        'Un gioco completo senza jolly — quattro semi, o una scala intera dall’A al K — viene tolto dal tavolo automaticamente per tenerlo in ordine.',
      ],
      'wait.title': 'Stanza pronta',
      'wait.share': 'Condividi questo codice con gli avversari:',
      'wait.starts': 'La partita inizia quando entrano tutti.',
      'wait.count': '{joined}/{size} giocatori dentro.',
      'wait.matchTo': 'Partita a {target} in {seats} giocatori.',
      'wait.cancel': 'Annulla',
      'pass.title': 'Passa il telefono',
      'pass.turn': 'Tocca a {name}',
      'pass.ready': 'Sono pronto',
      'game.tableHint': 'I giochi si calano qui — apri con 40+ punti',
      'game.left': '{n} nel mazzo',
      'game.cleared': '{n} tolte',
      'game.cards': '{n} carte',
      'game.opened': 'aperto',
      'game.notOpened': 'non aperto',
      'game.opening': 'apertura: {pts}/40',
      'game.meld': 'Cala gioco',
      'game.discard': 'Scarta',
      'game.takeback': 'Riprendi',
      'game.undopick': 'Annulla presa',
      'game.sortSuit': 'Ordina ♠♥',
      'game.sortRank': 'Ordina 1‑9',
      'game.soundOn': '♪ sì',
      'game.soundOff': '♪ no',
      'hint.draw': 'Pesca dal mazzo o prendi dal pozzo.',
      'hint.play': 'Cala, attacca carte, poi scarta una carta per chiudere il turno.',
      'hint.drawFirst': 'Prima pesca una carta.',
      'hint.alreadyDrew': 'Hai già pescato in questo turno.',
      'hint.waiting': 'Tocca a {name}…',
      'hint.mustUse': 'Devi usare questa carta in un gioco prima di scartare (o riscartarla).',
      'hint.putBack': 'Hai rimesso la carta — pesca dal mazzo.',
      'hint.emptyDiscard': 'Il pozzo è vuoto.',
      'hint.pickupUndone': 'Presa annullata — pesca dal mazzo.',
      'hint.tookBack': 'I giochi dell’apertura sono tornati in mano.',
      'hint.meldPlayed': 'Gioco calato.',
      'hint.openingGo': 'Apertura a {pts}/40 — continua.',
      'hint.openingOk': 'Apertura a {pts} — scarta per confermare.',
      'hint.youOpened': 'Hai aperto! ',
      'hint.jokerSwap': 'Hai ripreso il jolly in mano!',
      'hint.someDidntFit': 'Alcune carte selezionate non ci stavano.',
      'hint.attachAfterOpen': 'Puoi attaccare carte solo dopo aver aperto.',
      'hint.doesNotFit': '{card} non si attacca a quel gioco.',
      'hint.clearedMeld': 'Un gioco completo è stato tolto dal tavolo.',
      'hint.youFirst': 'Cominci tu — pesca una carta.',
      'hint.yourTurnFull': 'Tocca a te — pesca dal mazzo o dal pozzo.',
      'hint.passDraw': '{name}, pesca dal mazzo o dal pozzo.',
      'hint.handStart': 'Mano {n} — cominci tu. Pesca una carta.',
      'cpu.thinking': 'Il computer sta pensando…',
      'cpu.first': 'Comincia il computer…',
      'cpu.handStart': 'Mano {n} — comincia il computer…',
      'cpu.draws': 'Il computer pesca dal mazzo.',
      'cpu.takes': 'Il computer prende {card} dal pozzo.',
      'cpu.plays': 'Il computer cala {cards}.',
      'cpu.attaches': 'Il computer attacca {card}.',
      'cpu.reclaims': 'Il computer mette la carta vera e riprende il jolly!',
      'cpu.opened': 'Il computer ha aperto! ',
      'cpu.discards': 'Il computer scarta {card}. Tocca a te.',
      'net.gameOn': 'Si parte — comincia {name}.',
      'net.drew': '{name} ha pescato dal mazzo.',
      'net.took': '{name} ha preso {card} dal pozzo.',
      'net.putBack': '{name} ha rimesso {card} e pescherà dal mazzo.',
      'net.played': '{name} ha calato {cards}.',
      'net.attached': '{name} ha attaccato {card}.',
      'net.swapped': '{name} ha ripreso il jolly con {card}.',
      'net.tookBack': '{name} ha ripreso i giochi dell’apertura.',
      'net.discarded': '{name} ha scartato {card}.',
      'net.discardedWins': '{name} ha scartato {card} e chiude la mano!',
      'net.opened': '{name} ha aperto! ',
      'net.handDealt': 'Mano {n} distribuita — comincia {name}.',
      'net.cleared': ' Un gioco completo è stato tolto dal tavolo.',
      'net.dead': ' Mazzo finito — mano morta, contano tutti.',
      'net.reconnected': 'Riconnesso.',
      'net.oppOffline': '{name} ha perso la connessione — aspettiamo che torni…',
      'net.oppBack': '{name} è tornato.',
      'net.oppLeftMsg': '{name} ha lasciato la partita.',
      'net.oppLeftTitle': 'Avversario uscito',
      'net.connLostTitle': 'Connessione persa',
      'net.connLost': 'Connessione al server persa.',
      'end.winsHand': '★ {name} vince la mano {n}! ★',
      'end.winsMatch': '★ {name} vince la partita! ★',
      'end.dead': 'Mano morta — nessuno poteva pescare',
      'end.scores': ' — chi arriva a {target} perde la partita',
      'end.next': 'Prossima mano',
      'end.quit': 'Abbandona',
      'end.menu': 'Torna al menu',
      'stats.title': 'Statistiche',
      'stats.tagline': 'Le partite online valgono per la classifica',
      'stats.rating': 'Punteggio',
      'stats.record': 'Bilancio',
      'stats.winsPct': '{pct}% vittorie',
      'stats.streak': 'Serie',
      'stats.best': 'record V{n}',
      'stats.matches': 'Partite',
      'stats.hands': 'Mani',
      'stats.wonPlayed': 'vinte/giocate',
      'stats.avg': 'Media presi',
      'stats.perHand': 'punti/mano persa',
      'stats.board': 'Classifica',
      'stats.none': 'Nessuna partita classificata in questa modalità — finisci una partita online per entrare in classifica.',
      'stats.nobody': 'Ancora nessuno in questa classifica.',
      'stats.serverOnly':
        'La classifica vive sul server di gioco — apri l’app dal tuo server per vederla.',
      'stats.back': 'Indietro',
      'iap.remove': '★ Rimuovi pubblicità',
      'iap.restore': 'Ripristina acquisto',
      'iap.removed': 'Pubblicità rimossa — grazie!',
      'iap.restored': 'Acquisto ripristinato — niente più pubblicità.',
      'err.gameOver': 'La partita è finita.',
      'err.notYourTurn': 'Non è il tuo turno.',
      'err.alreadyDrew': 'Hai già pescato in questo turno.',
      'err.drawFirst': 'Prima pesca una carta.',
      'err.mustStock': 'Hai rimesso la carta — pesca dal mazzo.',
      'err.emptyDiscard': 'Il pozzo è vuoto.',
      'err.nothingToUndo': 'Niente da annullare.',
      'err.tooLate': 'Troppo tardi — hai già giocato.',
      'err.notInHand': 'Carta non in mano.',
      'err.keepOne': 'Devi tenere una carta da scartare.',
      'err.badMeld':
        'Gioco non valido: 3+ carte uguali (semi diversi) o 3+ in scala dello stesso seme, massimo un jolly.',
      'err.attachClosed': 'Puoi attaccare carte solo dopo aver aperto (in un turno precedente).',
      'err.nothingAttach': 'Niente da attaccare.',
      'err.noFit': '{card} non si attacca a quel gioco.',
      'err.swapClosed': 'Puoi riprendere i jolly solo dopo aver aperto.',
      'err.nothingSwap': 'Niente da scambiare.',
      'err.cannotReplace': 'Quella carta non può sostituire il jolly.',
      'err.nothingBack': 'Niente da riprendere.',
      'err.need40': 'Per aprire servono 40+ punti — ne hai {pts}. Cala altri giochi o riprendili.',
      'err.usePicked': 'Prima usa la carta presa dal pozzo (o riscarta proprio quella).',
      'err.strictJoker': 'Regola rigida: rigioca il jolly ripreso in questo turno (o scartalo).',
      'err.oneReclaim': 'Usa il jolly ripreso prima di prenderne un altro.',
      'err.handNotOver': 'La mano non è ancora finita.',
      'err.matchOver': 'La partita è finita.',
      'err.noRoom': 'Nessuna stanza con codice {code}.',
      'err.roomFull': 'Quella stanza è già piena.',
      'err.serverFull': 'Il server è pieno — riprova tra poco.',
      'err.gone': 'Quella partita non è più disponibile.',
      'err.notInGame': 'Non sei in una partita.',
    },
  };

  let lang = 'en';
  try {
    const saved = localStorage.getItem('scala40.lang');
    if (saved && DICT[saved]) lang = saved;
    else if ((navigator.language || '').toLowerCase().startsWith('it')) lang = 'it';
  } catch {}

  function T(key, params) {
    let str = DICT[lang][key];
    if (str == null) str = DICT.en[key];
    if (str == null) return key;
    if (Array.isArray(str)) return str;
    if (params) {
      for (const k of Object.keys(params)) {
        str = str.split('{' + k + '}').join(String(params[k]));
      }
    }
    return str;
  }

  /* Static screen text lives here so the markup stays language-free. */
  function applyStatic() {
    const set = (sel, key) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = T(key);
    };
    const ph = (sel, key) => {
      const el = document.querySelector(sel);
      if (el) el.placeholder = T(key);
    };
    set('.tagline', 'menu.tagline');
    set('#btn-pvc', 'menu.pvc');
    set('#btn-pvp', 'menu.pvp');
    set('#btn-online', 'menu.online');
    set('#diff-row .target-label', 'menu.cpu');
    set('.diff-btn[data-diff="easy"]', 'menu.easy');
    set('.diff-btn[data-diff="medium"]', 'menu.med');
    set('.diff-btn[data-diff="hard"]', 'menu.hard');
    set('#seats-row .target-label', 'menu.players');
    const matchRow = document.querySelector('.target-row:not(#seats-row):not(#diff-row):not(#lang-row) .target-label');
    if (matchRow) matchRow.textContent = T('menu.matchTo');
    ph('#name1', 'menu.name1');
    ph('#name2', 'menu.name2');
    ph('#room-code', 'menu.code');
    set('#btn-start', 'menu.deal');
    set('#btn-create-room', 'menu.create');
    set('.online-or', 'menu.orJoin');
    set('#btn-join-room', 'menu.join');
    set('#btn-stats', 'menu.stats');
    set('#house-rules summary', 'menu.house');
    const hrRows = document.querySelectorAll('#house-rules .target-row .target-label');
    if (hrRows[0]) hrRows[0].textContent = T('menu.hrSweep');
    if (hrRows[1]) hrRows[1].textContent = T('menu.hrJoker');
    set('.hr-sweep[data-v="on"]', 'menu.hrOn');
    set('.hr-sweep[data-v="off"]', 'menu.hrOff');
    set('.hr-joker[data-v="keep"]', 'menu.hrKeep');
    set('.hr-joker[data-v="strict"]', 'menu.hrStrict');
    set('#house-rules .online-msg', 'menu.hrNote');
    set('#lang-row .target-label', 'menu.lang');
    const howto = document.querySelector('#menu-screen details:not(#house-rules) summary');
    if (howto) howto.textContent = T('menu.howto');
    const list = document.querySelector('#menu-screen details:not(#house-rules) ul');
    if (list) {
      list.innerHTML = '';
      for (const line of T('menu.rules')) {
        const li = document.createElement('li');
        li.textContent = line;
        list.appendChild(li);
      }
    }
    // waiting / pass / end / stats screens
    set('#wait-screen h2', 'wait.title');
    set('#wait-screen .pass-to', 'wait.share');
    set('#wait-starts', 'wait.starts');
    set('#btn-wait-cancel', 'wait.cancel');
    set('#pass-screen h2', 'pass.title');
    set('#btn-pass-continue', 'pass.ready');
    set('#btn-meld', 'game.meld');
    set('#btn-discard', 'game.discard');
    set('#btn-takeback', 'game.takeback');
    set('#btn-undopick', 'game.undopick');
    set('#btn-sort-suit', 'game.sortSuit');
    set('#btn-sort-rank', 'game.sortRank');
    set('#btn-next', 'end.next');
    set('#stats-screen h2', 'stats.title');
    set('#stats-screen .tagline', 'stats.tagline');
    set('.lb-title', 'stats.board');
    set('#btn-stats-back', 'stats.back');
    set('#btn-remove-ads', 'iap.remove');
    set('#btn-restore-ads', 'iap.restore');
  }

  function setLang(next) {
    if (!DICT[next]) return;
    lang = next;
    try {
      localStorage.setItem('scala40.lang', next);
    } catch {}
    applyStatic();
  }

  global.I18N = {
    T,
    setLang,
    lang: () => lang,
    applyStatic,
    // localized error text for an engine/server result with a code
    errText: (res) =>
      res && res.code ? T('err.' + res.code, res.params || {}) : (res && res.error) || '',
  };
})(window);
