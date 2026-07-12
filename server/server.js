/*
 * Scala 40 — multiplayer server.
 * Serves the static web app and referees online games over WebSockets.
 * The server is fully authoritative: it holds the real deck and hands,
 * validates every move through the same js/engine.js the browser uses
 * for local play, and sends each client only their redacted view — so
 * a modified client can neither cheat nor peek.
 *
 * Run: npm install && npm start   (PORT env var, default 3040)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const R = require('../www/js/rules.js');
const Engine = require('../www/js/engine.js');
const Stats = require('./stats.js');

const PORT = Number(process.env.PORT) || 3040;
const ROOT = path.join(__dirname, '..', 'www');
const MAX_ROOMS = 500;
const ROOM_TTL_EMPTY_MS = 3 * 60 * 1000;   // both players gone
const ROOM_TTL_DONE_MS = 5 * 60 * 1000;    // game finished
const ROOM_TTL_LOBBY_MS = 30 * 60 * 1000;  // created but never joined

/* ================= static files ================= */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const httpServer = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath.startsWith('/api/')) {
    const u = new URL(req.url, 'http://localhost');
    let body = null;
    if (urlPath === '/api/leaderboard') {
      const mode = String(u.searchParams.get('mode') || '2');
      if (['2', '3', '4'].includes(mode)) body = Stats.leaderboard(mode);
    } else if (urlPath === '/api/stats') {
      body = Stats.playerStats(String(u.searchParams.get('pid') || ''));
    }
    res.writeHead(body ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body || { error: 'not found' }));
    return;
  }
  let filePath = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (e, data) => {
    if (e) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
    });
    res.end(data);
  });
});

/* ================= rooms ================= */

const rooms = new Map(); // code -> room

function makeCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += alphabet[crypto.randomInt(alphabet.length)];
    }
    if (!rooms.has(code)) return code;
  }
}

const TARGETS = [101, 151, 201];
const SEAT_COUNTS = [2, 3, 4];

function cleanPid(pid) {
  return typeof pid === 'string' && /^[a-f0-9]{16,64}$/i.test(pid) ? pid : null;
}

function newRoom(ws, name, target, seats, pid) {
  const room = {
    code: makeCode(),
    players: [
      { ws, name, pid, token: crypto.randomBytes(12).toString('hex'), connected: true },
    ],
    size: SEAT_COUNTS.includes(Number(seats)) ? Number(seats) : 2,
    target: TARGETS.includes(Number(target)) ? Number(target) : 151,
    state: null,
    createdAt: Date.now(),
    emptySince: null,
    doneAt: null,
  };
  rooms.set(room.code, room);
  return room;
}

function othersOf(room, index) {
  return room.players.filter((_, i) => i !== index);
}

function sendTo(player, obj) {
  if (player.ws && player.ws.readyState === player.ws.OPEN) {
    player.ws.send(JSON.stringify(obj));
  }
}

function broadcastState(room, msg, evt) {
  room.players.forEach((p, i) => {
    sendTo(p, { t: 'state', view: Engine.view(room.state, i), msg: msg || '', evt: evt || null });
  });
}

function cleanName(name) {
  return String(name || '').slice(0, 14).trim() || 'Player';
}

/* What everyone is told about a move — public information only. */
function describe(room, p, a, res) {
  const cleared =
    res && res.cleared && res.cleared.length
      ? ' A completed meld was cleared off the table.'
      : '';
  return describeBase(room, p, a, res) + cleared;
}

function describeBase(room, p, a, res) {
  const name = room.players[p].name;
  switch (a) {
    case 'drawStock':
      return `${name} drew from the stock.`;
    case 'pickDiscard':
      return `${name} took ${R.cardLabel(res.card)} from the discard pile.`;
    case 'undoPickup':
      return `${name} put ${R.cardLabel(res.card)} back and will draw from the stock.`;
    case 'layMeld':
      return `${name} played ${res.meld.slots.map((s) => R.cardLabel(s.card)).join(' ')}.`;
    case 'attach':
      return `${name} attached ${R.cardLabel(res.card)}.`;
    case 'replaceJoker':
      return `${name} swapped the joker for ${R.cardLabel(res.card)}.`;
    case 'takeBack':
      return `${name} took back their opening melds.`;
    case 'discard':
      return (
        (res.openedNow ? `${name} opened! ` : '') +
        (res.won
          ? `${name} discarded ${R.cardLabel(res.card)} and wins the hand!`
          : `${name} discarded ${R.cardLabel(res.card)}.`)
      );
    case 'nextHand': {
      const first = room.players[room.state.turn].name;
      return `Hand ${res.handNumber} dealt — ${first} leads.`;
    }
    default:
      return '';
  }
}

const ACTION_ARGS = {
  drawStock: () => [],
  pickDiscard: () => [],
  undoPickup: () => [],
  layMeld: (args) => [Array.isArray(args.cardIds) ? args.cardIds.map(Number) : null],
  attach: (args) => [Number(args.cardId), Number(args.meldId)],
  replaceJoker: (args) => [Number(args.cardId), Number(args.meldId)],
  takeBack: () => [],
  discard: (args) => [Number(args.cardId)],
  nextHand: () => [],
};

/* ================= websocket handling ================= */

const wss = new WebSocketServer({ server: httpServer, maxPayload: 8 * 1024 });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.room = null;
  ws.playerIndex = null;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    let m;
    try {
      m = JSON.parse(data.toString());
    } catch {
      return;
    }
    try {
      handleMessage(ws, m);
    } catch (e) {
      sendTo({ ws }, { t: 'error', error: 'Server error handling that move.' });
      console.error(e);
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (!room || ws.playerIndex == null) return;
    const player = room.players[ws.playerIndex];
    if (player.ws !== ws) return; // an old socket for a reconnected player
    player.connected = false;
    player.ws = null;
    if (room.players.every((p) => !p.connected)) {
      room.emptySince = Date.now();
    } else {
      for (const otherP of othersOf(room, ws.playerIndex)) {
        sendTo(otherP, {
          t: 'opp_offline',
          msg: `${player.name} lost connection — waiting for them to return…`,
        });
      }
    }
  });
});

function handleMessage(ws, m) {
  switch (m.t) {
    case 'create': {
      if (rooms.size >= MAX_ROOMS) {
        return sendTo({ ws }, { t: 'error', error: 'Server is full right now — try again soon.' });
      }
      const room = newRoom(ws, cleanName(m.name), m.target, m.seats, cleanPid(m.pid));
      ws.room = room;
      ws.playerIndex = 0;
      sendTo(room.players[0], { t: 'created', code: room.code, token: room.players[0].token });
      break;
    }

    case 'join': {
      const code = String(m.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return sendTo({ ws }, { t: 'error', error: `No room with code ${code || '—'}.` });
      if (room.state || room.players.length >= room.size) {
        return sendTo({ ws }, { t: 'error', error: 'That room is already full.' });
      }
      room.players.push({
        ws,
        name: cleanName(m.name),
        pid: cleanPid(m.pid),
        token: crypto.randomBytes(12).toString('hex'),
        connected: true,
      });
      ws.room = room;
      ws.playerIndex = room.players.length - 1;

      if (room.players.length < room.size) {
        // still waiting for seats — everyone sees the fill count
        room.players.forEach((p) => {
          sendTo(p, {
            t: 'lobby',
            code: room.code,
            token: p.token,
            joined: room.players.length,
            size: room.size,
          });
        });
        break;
      }

      room.state = Engine.newGame(room.players.map((p) => p.name), { target: room.target });
      const first = room.players[room.state.turn].name;
      room.players.forEach((p, i) => {
        sendTo(p, {
          t: 'start',
          code: room.code,
          token: p.token,
          view: Engine.view(room.state, i),
        });
        sendTo(p, {
          t: 'state',
          view: Engine.view(room.state, i),
          msg: `Game on — ${first} goes first.`,
        });
      });
      break;
    }

    case 'rejoin': {
      const room = rooms.get(String(m.code || '').toUpperCase());
      const idx = room ? room.players.findIndex((p) => p.token === m.token) : -1;
      if (idx === -1 || !room.state) {
        return sendTo({ ws }, { t: 'error', error: 'That game is no longer available.' });
      }
      const player = room.players[idx];
      player.ws = ws;
      player.connected = true;
      room.emptySince = null;
      ws.room = room;
      ws.playerIndex = idx;
      sendTo(player, { t: 'start', code: room.code, token: player.token, view: Engine.view(room.state, idx) });
      sendTo(player, { t: 'state', view: Engine.view(room.state, idx), msg: 'Reconnected.' });
      for (const otherP of othersOf(room, idx)) {
        sendTo(otherP, { t: 'opp_back', msg: `${player.name} is back.` });
      }
      break;
    }

    case 'action': {
      const room = ws.room;
      if (!room || !room.state || ws.playerIndex == null) {
        return sendTo({ ws }, { t: 'error', error: 'You are not in a game.' });
      }
      const getArgs = ACTION_ARGS[m.a];
      if (!getArgs) return sendTo({ ws }, { t: 'error', error: 'Unknown action.' });
      const args = getArgs(m.args || {});
      if (args.some((x) => x == null || Number.isNaN(x))) {
        return sendTo({ ws }, { t: 'error', error: 'Bad move data.' });
      }
      const res = Engine.actions[m.a](room.state, ws.playerIndex, ...args);
      if (!res.ok) {
        return sendTo(room.players[ws.playerIndex], { t: 'error', error: res.error });
      }
      broadcastState(room, describe(room, ws.playerIndex, m.a, res), {
        a: m.a,
        openedNow: !!res.openedNow,
        won: !!res.won,
        cleared: res.cleared ? res.cleared.length : 0,
      });
      if (res.won) {
        const seats = room.players.map((p) => ({ pid: p.pid, name: p.name }));
        const mode = String(room.size);
        Stats.recordHand(seats, mode, room.state.winner, res.penalties || []);
        if (room.state.matchOver) {
          Stats.recordMatch(seats, mode, room.state.matchRanking);
        }
      }
      // rooms linger between hands; only a finished match starts the clock
      room.doneAt = room.state.matchOver ? Date.now() : null;
      break;
    }

    case 'leave': {
      const room = ws.room;
      if (!room || ws.playerIndex == null) return;
      if (room.state && !room.state.over) {
        for (const otherP of othersOf(room, ws.playerIndex)) {
          sendTo(otherP, {
            t: 'opp_left',
            msg: `${room.players[ws.playerIndex].name} left the game.`,
          });
        }
      }
      rooms.delete(room.code);
      ws.room = null;
      break;
    }
  }
}

/* keepalive + room garbage collection */

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30 * 1000);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const emptyTooLong = room.emptySince && now - room.emptySince > ROOM_TTL_EMPTY_MS;
    const doneTooLong = room.doneAt && now - room.doneAt > ROOM_TTL_DONE_MS;
    const lobbyTooLong = !room.state && now - room.createdAt > ROOM_TTL_LOBBY_MS;
    if (emptyTooLong || doneTooLong || lobbyTooLong) rooms.delete(code);
  }
}, 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`Scala 40 server listening on http://localhost:${PORT}`);
});
