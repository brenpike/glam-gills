/**
 * Browser glue for background music (PRD N6, M1 to M12; ADR 0025). A Web Audio synth plays the notes
 * the pure arrangement in src/logic/music.ts gives, a little ahead of time. There are no audio files
 * and no network (M6). Nothing sounds before the first tap, click or key press (M7). A change of cue
 * cross-fades, and the same cue carries on across screens (M1, M9). The music stops while the page is
 * hidden and plays softer while a trip is paused (M9). A limiter keeps it gentle (M11).
 *
 * Scenes say where the player is (setMusicScreen) and whether a trip is paused (setMusicPaused); the
 * music switch reads and sets musicIsOn and setMusicOn.
 */
import {
  MUSIC_LEVELS,
  arrangeStep,
  musicCueFor,
  stepSeconds,
  type MusicCue,
  type MusicNote,
  type MusicScreen,
} from '../logic/music';
import { readMusicSetting, writeMusicSetting } from './musicSetting';

/** Seconds of notes scheduled ahead of the audio clock. */
const LOOKAHEAD_S = 0.15;
/** Milliseconds between scheduler runs. */
const TICK_MS = 25;
/** Seconds after the first scheduled note of a cue. */
const START_DELAY_S = 0.1;
/** Seconds a faded-out cue's last notes may ring before its bus is let go. */
const TAIL_S = 2.5;
/** Room reverb: its length in seconds, its decay power and its send level. */
const REVERB = Object.freeze({ seconds: 2.4, decay: 3.2, send: 0.32 });
/** Top of the gentle low-pass that softens the whole mix, in Hz. */
const WARM_HZ = 7500;
/** The output limiter (M11). */
const LIMITER = Object.freeze({ threshold: -14, knee: 6, ratio: 8, attack: 0.003, release: 0.25 });
/** Plucked strings by the Karplus-Strong method: ring length, sustain per pass and pick softness. */
const PLUCKS = Object.freeze({ ukulele: Object.freeze({ seconds: 0.9, keep: 0.992, soft: 0.35 }) });
const SILENT = 0.0001;
/** Inputs that count as the first input, which lets the page make sound (M7). */
const UNLOCK_EVENTS: readonly string[] = ['pointerdown', 'keydown', 'touchend'];

/** One cue playing: its bus (for its cross-fade), its next step and when that step starts. */
interface CueRun {
  cue: Readonly<MusicCue>;
  bus: GainNode;
  seed: number;
  step: number;
  nextTime: number;
  fading: boolean;
}

/** The audio graph, built on the first input. */
interface Graph {
  ctx: AudioContext;
  master: GainNode;
  reverb: GainNode;
  noise: AudioBuffer;
  plucks: Map<number, { buffer: AudioBuffer; rate: number }>;
}

const state = {
  on: true,
  paused: false,
  screen: 'title' as MusicScreen,
  graph: null as Graph | null,
  runs: [] as CueRun[],
  timer: 0,
  installed: false,
};

const midiHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Starts listening for the first input (to make sound) and for the page being hidden. Call once,
 * before the game starts. Reads the music switch from device storage.
 */
export function installMusic(): void {
  if (state.installed) return;
  state.installed = true;
  state.on = readMusicSetting();
  const unlock = (): void => {
    if (!startAudio()) return;
    for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
  };
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true);
  document.addEventListener('visibilitychange', () => refreshRunning());
}


/** Whether music is on (the music switch, M8). */
export function musicIsOn(): boolean {
  return state.on;
}

/** Turns music on or off, keeps the choice on the device, and fades to match (M8). */
export function setMusicOn(on: boolean): void {
  if (state.on === on) return;
  state.on = on;
  writeMusicSetting(on);
  refreshRunning();
}

/** Plays the cue for `screen`; the same cue carries on, another cross-fades in (M1, M2, M9). */
export function setMusicScreen(screen: MusicScreen): void {
  state.screen = screen;
  if (screen !== 'trip') setPaused(false);
  const graph = state.graph;
  if (graph === null) return;
  const cue = musicCueFor(screen);
  const current = liveRun();
  if (current !== undefined && current.cue.id === cue.id) return;
  if (current !== undefined) fadeOut(graph, current);
  startRun(graph, cue, MUSIC_LEVELS.crossFadeS);
}

/** Plays softer while a trip is paused (M9). */
export function setMusicPaused(paused: boolean): void {
  setPaused(paused && state.screen === 'trip');
}

function setPaused(paused: boolean): void {
  if (state.paused === paused) return;
  state.paused = paused;
  const graph = state.graph;
  if (graph !== null && shouldRun()) rampMaster(graph, masterLevel(), MUSIC_LEVELS.switchFadeS);
}

function masterLevel(): number {
  return MUSIC_LEVELS.master * (state.paused ? MUSIC_LEVELS.paused : 1);
}

function shouldRun(): boolean {
  return state.on && document.visibilityState !== 'hidden';
}

function liveRun(): CueRun | undefined {
  return state.runs.find((run) => !run.fading);
}

/**
 * Builds the audio graph on the first input and starts the cue for the current screen with a fade
 * in (M7). False when the browser has no Web Audio or refuses it; the game then stays silent.
 */
function startAudio(): boolean {
  if (state.graph !== null) return true;
  const graph = buildGraph();
  if (graph === null) return false;
  state.graph = graph;
  startRun(graph, musicCueFor(state.screen), 0);
  state.timer = window.setInterval(tick, TICK_MS);
  refreshRunning(MUSIC_LEVELS.fadeInS);
  return true;
}

function buildGraph(): Graph | null {
  const AudioContextClass = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AudioContextClass === undefined) return null;
  let ctx: AudioContext;
  try {
    ctx = new AudioContextClass();
  } catch {
    return null;
  }
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMITER.threshold;
  limiter.knee.value = LIMITER.knee;
  limiter.ratio.value = LIMITER.ratio;
  limiter.attack.value = LIMITER.attack;
  limiter.release.value = LIMITER.release;
  const warm = ctx.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = WARM_HZ;
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(warm);
  warm.connect(limiter);
  limiter.connect(ctx.destination);
  const convolver = ctx.createConvolver();
  convolver.buffer = reverbImpulse(ctx);
  const reverb = ctx.createGain();
  reverb.gain.value = REVERB.send;
  reverb.connect(convolver);
  convolver.connect(master);
  return { ctx, master, reverb, noise: noiseBuffer(ctx), plucks: new Map() };
}

/** A soft room: stereo noise that dies away. */
function reverbImpulse(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * REVERB.seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, REVERB.decay);
  }
  return impulse;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Resumes and fades in when music should play; fades out and suspends when it should not (M8, M9). */
function refreshRunning(fadeS: number = MUSIC_LEVELS.switchFadeS): void {
  const graph = state.graph;
  if (graph === null) return;
  const { ctx } = graph;
  if (shouldRun()) {
    void ctx.resume().then(() => {
      for (const run of state.runs) run.nextTime = Math.max(run.nextTime, ctx.currentTime + START_DELAY_S);
      rampMaster(graph, masterLevel(), fadeS);
    });
    return;
  }
  if (document.visibilityState === 'hidden') {
    void ctx.suspend();
    return;
  }
  rampMaster(graph, 0, MUSIC_LEVELS.switchFadeS);
  window.setTimeout(() => {
    if (!shouldRun()) void ctx.suspend();
  }, MUSIC_LEVELS.switchFadeS * 1000 + 50);
}

function rampMaster(graph: Graph, level: number, seconds: number): void {
  const gain = graph.master.gain;
  const now = graph.ctx.currentTime;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(level, now + Math.max(0.01, seconds));
}

function startRun(graph: Graph, cue: Readonly<MusicCue>, fadeInS: number): void {
  const { ctx } = graph;
  const bus = ctx.createGain();
  const now = ctx.currentTime;
  bus.gain.setValueAtTime(fadeInS > 0 ? SILENT : 1, now);
  if (fadeInS > 0) bus.gain.linearRampToValueAtTime(1, now + fadeInS);
  bus.connect(graph.master);
  bus.connect(graph.reverb);
  const seed = Math.floor(Math.random() * 0x7fffffff);
  state.runs.push({ cue, bus, seed, step: 0, nextTime: now + START_DELAY_S, fading: false });
}

/** Fades `run` out over the cross-fade, stops scheduling it, and lets its bus go once its notes ring out. */
function fadeOut(graph: Graph, run: CueRun): void {
  run.fading = true;
  const gain = run.bus.gain;
  const now = graph.ctx.currentTime;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(SILENT, now + MUSIC_LEVELS.crossFadeS);
  window.setTimeout(() => {
    run.bus.disconnect();
    state.runs = state.runs.filter((other) => other !== run);
  }, (MUSIC_LEVELS.crossFadeS + TAIL_S) * 1000);
}

/** Schedules every live cue's notes up to LOOKAHEAD_S ahead of the audio clock. */
function tick(): void {
  const graph = state.graph;
  if (graph === null || graph.ctx.state !== 'running') return;
  const now = graph.ctx.currentTime;
  const horizon = now + LOOKAHEAD_S;
  for (const run of state.runs) {
    if (run.fading) continue;
    const stepS = stepSeconds(run.cue);
    // After a stall, skip the steps already past instead of playing them all at once.
    while (run.nextTime < now) {
      run.step++;
      run.nextTime += stepS;
    }
    while (run.nextTime < horizon) {
      for (const note of arrangeStep(run.cue, run.step, run.seed)) playNote(graph, run.bus, note, run.nextTime + note.at);
      run.step++;
      run.nextTime += stepS;
    }
  }
}

function playNote(graph: Graph, out: AudioNode, note: MusicNote, time: number): void {
  const midi = note.midi ?? 0;
  const v = note.velocity;
  switch (note.voice) {
    case 'kalimba':
      return kalimba(graph, out, time, midi, v);
    case 'whistle':
      return whistle(graph, out, time, midi, v, note.duration);
    case 'ukulele':
      return pluck(graph, out, time, midi, v);
    case 'bass':
      return bass(graph, out, time, midi, v, note.duration);
    case 'tap':
      return tap(graph, out, time, v);
    case 'shaker':
      return shaker(graph, out, time, v);
    case 'bubble':
      return bubble(graph, out, time, midi, v);
    default: {
      const unhandled: never = note.voice;
      throw new Error(`musicPlayer: no voice ${String(unhandled)}`);
    }
  }
}

/** Rises to `peak` over `attack` seconds from `time`, then dies away over `decay` seconds. */
function envelope(gain: GainNode, time: number, attack: number, peak: number, decay: number): void {
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, time + attack + decay);
}

function tone(
  graph: Graph,
  out: AudioNode,
  time: number,
  hz: number,
  type: OscillatorType,
  attack: number,
  peak: number,
  decay: number,
): OscillatorNode {
  const { ctx } = graph;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  envelope(gain, time, attack, peak, decay);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + attack + decay + 0.05);
  return osc;
}

function noiseBurst(graph: Graph, out: AudioNode, time: number, seconds: number): void {
  const source = graph.ctx.createBufferSource();
  source.buffer = graph.noise;
  source.connect(out);
  source.start(time, Math.random() * 0.8);
  source.stop(time + seconds);
}

function kalimba(graph: Graph, out: AudioNode, time: number, midi: number, v: number): void {
  const hz = midiHz(midi);
  tone(graph, out, time, hz, 'sine', 0.004, v, 1.3);
  tone(graph, out, time, hz * 2, 'triangle', 0.003, v * 0.12, 0.25);
  tone(graph, out, time, hz * 5.4, 'sine', 0.002, v * 0.1, 0.05);
}

/** A soft, flute-like whistle with a little vibrato and a breath of air at the start. */
function whistle(graph: Graph, out: AudioNode, time: number, midi: number, v: number, duration: number): void {
  const { ctx } = graph;
  const hz = midiHz(midi);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  osc.frequency.value = hz;
  lfo.frequency.value = 5.5;
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(hz * 0.006, time + 0.25);
  lfo.connect(depth);
  depth.connect(osc.frequency);
  const hold = Math.max(0.08, duration * 0.85);
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.linearRampToValueAtTime(v, time + 0.035);
  gain.gain.setValueAtTime(v, time + hold);
  gain.gain.exponentialRampToValueAtTime(SILENT, time + hold + 0.14);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  lfo.start(time);
  osc.stop(time + hold + 0.2);
  lfo.stop(time + hold + 0.2);
  const air = ctx.createBiquadFilter();
  const airGain = ctx.createGain();
  air.type = 'bandpass';
  air.frequency.value = hz * 2;
  air.Q.value = 3;
  envelope(airGain, time, 0.01, v * 0.5, 0.06);
  air.connect(airGain);
  airGain.connect(out);
  noiseBurst(graph, air, time, 0.1);
}

/** A plucked string (ukulele), rendered once per note and kept. */
function pluck(graph: Graph, out: AudioNode, time: number, midi: number, v: number): void {
  const { buffer, rate } = pluckBuffer(graph, midi);
  const source = graph.ctx.createBufferSource();
  const gain = graph.ctx.createGain();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  gain.gain.value = v;
  source.connect(gain);
  gain.connect(out);
  source.start(time);
}

function pluckBuffer(graph: Graph, midi: number): { buffer: AudioBuffer; rate: number } {
  const kept = graph.plucks.get(midi);
  if (kept !== undefined) return kept;
  const { ctx } = graph;
  const sampleRate = ctx.sampleRate;
  const hz = midiHz(midi);
  const shape = PLUCKS.ukulele;
  const period = Math.max(2, Math.floor(sampleRate / hz - 0.5));
  const length = Math.floor(sampleRate * shape.seconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i <= period; i++) {
    last = last * shape.soft + (Math.random() * 2 - 1) * (1 - shape.soft);
    data[i] = last * 2;
  }
  for (let i = period + 1; i < length; i++) data[i] = (data[i - period] + data[i - period - 1]) * 0.5 * shape.keep;
  // Averaging the samples `period` and `period + 1` back makes the loop `period + 0.5` samples long,
  // so the played rate corrects the pitch to `hz`.
  const made = { buffer, rate: hz / (sampleRate / (period + 0.5)) };
  graph.plucks.set(midi, made);
  return made;
}

function bass(graph: Graph, out: AudioNode, time: number, midi: number, v: number, duration: number): void {
  const lowPass = graph.ctx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 520;
  lowPass.connect(out);
  const hz = midiHz(midi);
  const decay = Math.min(duration, 0.7);
  tone(graph, lowPass, time, hz, 'triangle', 0.006, v, decay);
  tone(graph, lowPass, time, hz, 'sine', 0.006, v * 0.6, decay);
}

function tap(graph: Graph, out: AudioNode, time: number, v: number): void {
  const band = graph.ctx.createBiquadFilter();
  const gain = graph.ctx.createGain();
  band.type = 'bandpass';
  band.frequency.value = 2200;
  band.Q.value = 1.2;
  envelope(gain, time, 0.002, v, 0.04);
  band.connect(gain);
  gain.connect(out);
  noiseBurst(graph, band, time, 0.06);
  tone(graph, out, time, 330, 'sine', 0.002, v * 0.5, 0.04);
}

function shaker(graph: Graph, out: AudioNode, time: number, v: number): void {
  const high = graph.ctx.createBiquadFilter();
  const gain = graph.ctx.createGain();
  high.type = 'highpass';
  high.frequency.value = 6000;
  envelope(gain, time, 0.004, v, 0.05);
  high.connect(gain);
  gain.connect(out);
  noiseBurst(graph, high, time, 0.08);
}

/** A bubble pop: a quick upward slide. */
function bubble(graph: Graph, out: AudioNode, time: number, midi: number, v: number): void {
  const { ctx } = graph;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const base = midiHz(midi);
  osc.frequency.setValueAtTime(base, time);
  osc.frequency.exponentialRampToValueAtTime(base * 2.6, time + 0.07);
  envelope(gain, time, 0.003, v, 0.08);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.12);
}
