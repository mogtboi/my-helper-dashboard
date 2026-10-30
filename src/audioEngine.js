/**
 * Web Audio only. No audio files, no TTS.
 * Hub and the JP quiz must not call playBgm. playBgm("hub"|"jp") stops.
 * Mute key is my-helper.arcade-muted.v1. Missing key means muted.
 * "0" is sound on. Anything else, including "1", is muted.
 */

const MUTE_KEY = "my-helper.arcade-muted.v1";
const BPM = 136;
const BARS = 16;
const STEPS = BARS * 16;

/** D minor bass roots, one per bar (preview loop). */
const BASS_ROOTS = [38, 34, 36, 33, 38, 34, 36, 33, 38, 34, 36, 33, 38, 34, 31, 33];

/** Square-lead melody for bars 9–16. 0 is a hold/rest. */
const DROP_LEAD = [
  [74, 0, 74, 77, 0, 74, 72, 0, 74, 0, 77, 0, 76, 0, 74, 72],
  [70, 0, 70, 74, 0, 70, 69, 0, 70, 0, 74, 0, 72, 0, 70, 69],
  [72, 0, 72, 76, 0, 72, 74, 0, 76, 0, 79, 0, 77, 0, 76, 72],
  [77, 76, 74, 0, 72, 0, 69, 0, 72, 74, 76, 0, 72, 0, 69, 0],
  [74, 0, 77, 74, 0, 72, 69, 0, 74, 0, 77, 0, 79, 0, 77, 74],
  [70, 0, 74, 70, 0, 69, 65, 0, 70, 0, 74, 0, 77, 0, 74, 70],
  [67, 0, 70, 74, 0, 70, 69, 0, 67, 0, 70, 0, 74, 0, 77, 74],
  [69, 0, 73, 0, 76, 0, 73, 69, 76, 74, 73, 69, 73, 74, 76, 0],
];

let muted = readMuted();
let ctx = null;
let bgmGain = null;
let sidechain = null;
let noiseBuffer = null;
let timer = 0;
let playing = false;
let theme = null;

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeMuted(next) {
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* keep the in-memory choice */
  }
}

function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function ensureContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.07;
    sidechain = ctx.createGain();
    sidechain.gain.value = 1;
    sidechain.connect(bgmGain);
    bgmGain.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function envGain(node, time, peak, dur) {
  node.gain.setValueAtTime(0.001, time);
  node.gain.linearRampToValueAtTime(peak, time + Math.min(0.012, dur * 0.2));
  node.gain.exponentialRampToValueAtTime(0.001, time + dur);
}

function triggerKick(c, time) {
  if (sidechain) {
    sidechain.gain.cancelScheduledValues(time);
    sidechain.gain.setValueAtTime(0.2, time);
    sidechain.gain.exponentialRampToValueAtTime(1, time + 0.16);
  }
  const osc = c.createOscillator();
  const click = c.createOscillator();
  const gain = c.createGain();
  const clickGain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(165, time);
  osc.frequency.exponentialRampToValueAtTime(52, time + 0.045);
  osc.frequency.exponentialRampToValueAtTime(36, time + 0.16);
  gain.gain.setValueAtTime(0.9, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  click.type = "triangle";
  click.frequency.setValueAtTime(900, time);
  click.frequency.exponentialRampToValueAtTime(140, time + 0.018);
  clickGain.gain.setValueAtTime(0.28, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
  osc.connect(gain);
  click.connect(clickGain);
  gain.connect(bgmGain);
  clickGain.connect(bgmGain);
  osc.start(time);
  click.start(time);
  osc.stop(time + 0.2);
  click.stop(time + 0.03);
}

function triggerHat(c, time, open) {
  if (!noiseBuffer) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(open ? 6800 : 8500, time);
  const gain = c.createGain();
  const dur = open ? 0.11 : 0.03;
  gain.gain.setValueAtTime(open ? 0.22 : 0.1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  src.connect(hp);
  hp.connect(gain);
  gain.connect(bgmGain);
  src.start(time);
  src.stop(time + dur + 0.01);
}

function triggerBass(c, freq, time, dur, accent) {
  const osc = c.createOscillator();
  const sub = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  osc.type = "sawtooth";
  sub.type = "triangle";
  osc.frequency.setValueAtTime(freq, time);
  sub.frequency.setValueAtTime(freq * 0.5, time);
  filter.type = "lowpass";
  filter.Q.value = accent ? 3.2 : 2.2;
  filter.frequency.setValueAtTime(accent ? 1400 : 860, time);
  filter.frequency.exponentialRampToValueAtTime(180, time + dur);
  envGain(gain, time, accent ? 0.34 : 0.26, dur);
  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain);
  gain.connect(sidechain);
  osc.start(time);
  sub.start(time);
  osc.stop(time + dur + 0.02);
  sub.stop(time + dur + 0.02);
}

function triggerSquare(c, freq, time, dur) {
  const osc = c.createOscillator();
  const detune = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  osc.type = "square";
  detune.type = "square";
  osc.frequency.setValueAtTime(freq, time);
  detune.frequency.setValueAtTime(freq * 1.007, time);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1500, time);
  filter.frequency.exponentialRampToValueAtTime(700, time + dur);
  envGain(gain, time, 0.2, dur);
  osc.connect(filter);
  detune.connect(filter);
  filter.connect(gain);
  gain.connect(sidechain);
  osc.start(time);
  detune.start(time);
  osc.stop(time + dur + 0.02);
  detune.stop(time + dur + 0.02);
}

function scheduleStep(step, time) {
  const c = ctx;
  if (!c || !playing || muted || theme !== "3v3") return;
  const stepDur = 60 / BPM / 4;
  const bar = Math.floor(step / 16);
  const pos = step % 16;
  const preDrop = bar === 7 && pos >= 14;
  const root = BASS_ROOTS[bar] || 38;
  if (pos % 4 === 0 && !preDrop) triggerKick(c, time);
  if (!preDrop) {
    if (pos % 4 === 2) triggerHat(c, time, true);
    else if (pos % 2 === 1 && bar >= 2) triggerHat(c, time, false);
    const accent = pos % 4 === 2;
    triggerBass(c, midiToFreq(accent ? root + 12 : root), time, accent ? stepDur * 0.7 : stepDur * 0.42, accent);
  }
  if (bar >= 8) {
    const row = DROP_LEAD[bar - 8];
    const note = row ? row[pos] : 0;
    if (note > 0) {
      const held = pos < 15 && row[pos + 1] === 0;
      triggerSquare(c, midiToFreq(note), time, stepDur * (held ? 1.6 : 0.85));
    }
  }
}

function startLoop() {
  const c = ensureContext();
  if (!c) return false;
  if (playing && theme === "3v3") return true;
  stopBgm();
  theme = "3v3";
  playing = true;
  let step = 0;
  let next = c.currentTime + 0.06;
  const stepDur = 60 / BPM / 4;
  const pump = () => {
    if (!playing || muted || theme !== "3v3") return;
    while (next < c.currentTime + 0.16) {
      scheduleStep(step, next);
      step = (step + 1) % STEPS;
      next += stepDur;
    }
  };
  pump();
  timer = window.setInterval(pump, 40);
  return true;
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  writeMuted(muted);
  if (muted) {
    stopBgm();
    if (ctx && ctx.state === "running") ctx.suspend().catch(() => {});
  } else {
    ensureContext();
  }
  return muted;
}

/** Placeholder taps. No sound while muted. Names: tap, ok, ng. */
export function playSfx(name = "tap") {
  if (muted) return false;
  const c = ensureContext();
  if (!c) return false;
  const now = c.currentTime;
  const tone = (freq, type, dur, when, peak, slide) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, when + dur);
    gain.gain.setValueAtTime(peak, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  };
  if (name === "ok") {
    tone(587.33, "triangle", 0.08, now, 0.24);
    tone(880, "triangle", 0.16, now + 0.07, 0.24);
  } else if (name === "ng") {
    tone(196, "square", 0.16, now, 0.2, 98);
  } else {
    tone(460, "sine", 0.05, now, 0.22, 760);
  }
  return true;
}

/**
 * Later game phases call this. The hub must not.
 * "pet" and "2048" are silent stubs. "hub" and "jp" always stop.
 */
export function playBgm(name) {
  if (!name || name === "hub" || name === "jp" || name === "pet" || name === "2048") {
    stopBgm();
    return false;
  }
  if (name !== "3v3") {
    stopBgm();
    return false;
  }
  if (muted) return false;
  return startLoop();
}

export function stopBgm() {
  playing = false;
  theme = null;
  if (timer) {
    window.clearInterval(timer);
    timer = 0;
  }
}
