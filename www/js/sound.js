/*
 * Scala 40 — sound effects.
 * Everything is synthesized live with the Web Audio API — filtered noise
 * for card swishes and felt taps, soft square/triangle blips for the
 * Game Boy flavour — so the app ships zero audio files and stays fully
 * offline. The context unlocks on the first tap (mobile autoplay rules),
 * and the mute preference persists.
 */
(function (global) {
  'use strict';

  const MUTE_KEY = 'scala40.muted';
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {}

  function ensure() {
    if (ctx) return true;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // Mobile browsers only allow audio after a user gesture.
  document.addEventListener(
    'pointerdown',
    () => {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    { capture: true }
  );

  function blip(t, freq, dur, type, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.4, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // A card sliding — bandpass-filtered noise sweeping in pitch.
  function swish(t, f0, f1, dur, vol) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.3;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // A card landing on the felt — a short low-passed noise thump.
  function tap(t, vol) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.1);
  }

  const FX = {
    deal(t) {
      for (let i = 0; i < 5; i++) swish(t + i * 0.06, 1000 + i * 150, 2400, 0.08, 0.3);
    },
    draw(t) {
      swish(t, 900, 2600, 0.12, 0.5);
    },
    discard(t) {
      swish(t, 2200, 700, 0.12, 0.45);
      tap(t + 0.09, 0.3);
    },
    meld(t) {
      tap(t, 0.5);
      tap(t + 0.07, 0.5);
      blip(t + 0.13, 660, 0.09, 'triangle', 0.22);
    },
    attach(t) {
      tap(t, 0.45);
      blip(t + 0.03, 880, 0.06, 'triangle', 0.18);
    },
    joker(t) {
      blip(t, 1175, 0.07, 'square', 0.18);
      blip(t + 0.08, 1568, 0.1, 'square', 0.18);
    },
    clear(t) {
      swish(t, 1800, 500, 0.2, 0.5);
      blip(t + 0.1, 523, 0.07, 'triangle', 0.18);
      blip(t + 0.18, 392, 0.1, 'triangle', 0.18);
    },
    open(t) {
      [523, 659, 784].forEach((f, i) => blip(t + i * 0.07, f, 0.09, 'square', 0.2));
    },
    win(t) {
      [523, 659, 784, 1047].forEach((f, i) => blip(t + i * 0.1, f, 0.14, 'square', 0.22));
    },
    lose(t) {
      [392, 330, 262].forEach((f, i) => blip(t + i * 0.12, f, 0.16, 'square', 0.16));
    },
    error(t) {
      blip(t, 140, 0.12, 'square', 0.22);
    },
    turn(t) {
      blip(t, 784, 0.08, 'triangle', 0.2);
    },
  };

  function play(name) {
    if (muted || !FX[name]) return;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    try {
      FX[name](ctx.currentTime + 0.01);
    } catch {}
  }

  function setMuted(v) {
    muted = v;
    try {
      localStorage.setItem(MUTE_KEY, v ? '1' : '0');
    } catch {}
  }

  global.Sound = {
    play,
    muted: () => muted,
    toggle() {
      setMuted(!muted);
      return muted;
    },
  };
})(window);
