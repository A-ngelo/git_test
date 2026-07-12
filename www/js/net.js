/*
 * Scala 40 — client network layer for online rooms.
 * Thin JSON-over-WebSocket wrapper: create/join a room, forward player
 * actions, receive redacted state views from the authoritative server.
 * Reconnects with a session token if the socket drops mid-game.
 */
(function (global) {
  'use strict';

  const NET = {
    ws: null,
    view: null,      // latest redacted state view from the server
    code: null,
    token: null,
    active: false,
    // callbacks assigned by game.js
    onCreated: null, // (code)
    onStart: null,   // ()
    onState: null,   // (msg)
    onError: null,   // (error)
    onOppLeft: null, // (msg)
    onClosed: null,  // (msg)
  };

  let queue = [];        // messages queued while the socket opens
  let rejoinTries = 0;
  let intentionalClose = false;

  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  function send(obj) {
    if (NET.ws && NET.ws.readyState === WebSocket.OPEN) {
      NET.ws.send(JSON.stringify(obj));
    } else {
      queue.push(obj);
      connect();
    }
  }

  function connect() {
    if (NET.ws && (NET.ws.readyState === WebSocket.OPEN || NET.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    intentionalClose = false;
    const ws = new WebSocket(wsUrl());
    NET.ws = ws;

    ws.onopen = () => {
      rejoinTries = 0;
      const q = queue;
      queue = [];
      for (const m of q) ws.send(JSON.stringify(m));
    };

    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (m.t) {
        case 'created':
          NET.code = m.code;
          NET.token = m.token;
          if (NET.onCreated) NET.onCreated(m.code);
          break;
        case 'lobby':
          NET.code = m.code;
          NET.token = m.token || NET.token;
          if (NET.onLobby) NET.onLobby(m.joined, m.size, m.code);
          break;
        case 'start':
          NET.code = m.code;
          NET.token = m.token || NET.token;
          NET.view = m.view;
          NET.active = true;
          if (NET.onStart) NET.onStart();
          break;
        case 'state':
          NET.view = m.view;
          if (NET.onState) NET.onState(m.msg || '', m.evt || null);
          break;
        case 'error':
          if (NET.onError) NET.onError(m.error || 'Something went wrong.');
          break;
        case 'opp_left':
          NET.active = false;
          if (NET.onOppLeft) NET.onOppLeft(m.msg);
          break;
        case 'opp_offline':
        case 'opp_back':
          if (NET.onState) NET.onState(m.msg || '');
          break;
      }
    };

    ws.onclose = () => {
      if (intentionalClose) return;
      // Try to slip back into the game if one is running.
      if (NET.active && NET.code && NET.token && rejoinTries < 5) {
        rejoinTries++;
        setTimeout(() => {
          queue.push({ t: 'rejoin', code: NET.code, token: NET.token });
          connect();
        }, 1000 * rejoinTries);
      } else if (NET.active) {
        NET.active = false;
        if (NET.onClosed) NET.onClosed('Lost the connection to the server.');
      }
    };
  }

  NET.create = (name, target, seats, pid) => {
    NET.reset();
    send({ t: 'create', name, target, seats, pid });
  };

  NET.join = (code, name, pid) => {
    NET.reset();
    send({ t: 'join', code, name, pid });
  };

  NET.action = (a, args) => {
    send({ t: 'action', a, args: args || {} });
  };

  NET.leave = () => {
    if (NET.ws && NET.ws.readyState === WebSocket.OPEN) {
      NET.ws.send(JSON.stringify({ t: 'leave' }));
    }
    intentionalClose = true;
    if (NET.ws) NET.ws.close();
    NET.reset();
  };

  NET.reset = () => {
    NET.view = null;
    NET.code = null;
    NET.token = null;
    NET.active = false;
    queue = [];
    rejoinTries = 0;
  };

  global.NET = NET;
})(window);
