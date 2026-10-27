/**
 * Browser glue: the one audio engine the music and the sound effects share (PRD M6, M7, M9, M11, S1;
 * ADR 0025, ADR 0026). One Web Audio context, built on the first tap, click or key press (M7), with
 * one room reverb, one gentle low-pass and one limiter (M11), and two buses: the music bus and the
 * sounds bus, each with its own level. The context stops while the page is hidden (M9, S1), and while
 * neither music nor sounds is on.
 *
 * The music player (src/platform/musicPlayer.ts) and the sound player (src/platform/soundPlayer.ts)
 * each join as an AudioClient: the engine tells them when the graph is built and when the context is
 * running again, and asks them whether they want it running.
 */
import { MUSIC_LEVELS } from '../logic/music';
import { SOUND_LEVELS } from '../logic/sounds';
import { noiseBuffer, type VoiceKit } from './audioVoices';

/** Room reverb: its length in seconds and its decay power. */
const REVERB = Object.freeze({ seconds: 2.4, decay: 3.2 });
/** The music's send to the room reverb (the sounds' is SOUND_LEVELS.reverbSend). */
const MUSIC_REVERB_SEND = 0.32;
/** Top of the gentle low-pass that softens the whole mix, in Hz. */
const WARM_HZ = 7500;
/** The output limiter (M11), after both buses. */
const LIMITER = Object.freeze({ threshold: -14, knee: 6, ratio: 8, attack: 0.003, release: 0.25 });
/**
 * Inputs that may let the page make sound (M7). A phone only allows it on a finger lifting
 * (pointerup, touchend, click), not on a finger landing (pointerdown), so the engine keeps listening
 * until the context really runs.
 */
const UNLOCK_EVENTS: readonly string[] = ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'click', 'keydown'];

/** The audio graph, built on the first input. */
export interface AudioGraph extends VoiceKit {
  ctx: AudioContext;
  /** The music bus: the music player fades it for its switch, the page and pausing. Starts silent. */
  music: GainNode;
  /** The sounds bus: at SOUND_LEVELS.bus while sounds are on, silent while off. Starts silent. */
  sounds: GainNode;
}

/** A player on the engine: the music player or the sound player. */
export interface AudioClient {
  /** Whether this player wants the context running (its switch is on). */
  wantsAudio(): boolean;
  /** The graph is built, on the first input; the context starts running next. */
  started(graph: AudioGraph): void;
  /** The context is running again after a refresh, such as the page showing or a switch turning on. */
  resumed(graph: AudioGraph): void;
}

const state = {
  installed: false,
  graph: null as AudioGraph | null,
  clients: [] as AudioClient[],
  /** The resume in flight, so the players hear once when the context runs again. */
  resuming: null as Promise<void> | null,
};

/**
 * Joins `client` to the engine, and starts listening for the first input (to make sound) and for
 * the page being hidden. Call before the game starts.
 */
export function joinAudio(client: AudioClient): void {
  state.clients.push(client);
  if (state.installed) return;
  state.installed = true;
  const stopListening = (): void => {
    for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
  };
  // The first input builds the graph; until the context runs, every input asks it to resume again,
  // because a phone ignores a resume asked for when a finger lands (pointerdown).
  const unlock = (): void => {
    const built = state.graph !== null;
    if (!startAudio()) return;
    const graph = state.graph;
    // With music and sounds both off, a switch turning on resumes the context from its own tap.
    if (graph === null || graph.ctx.state === 'running' || !shouldRun()) {
      stopListening();
      return;
    }
    const resumed = built ? refreshAudio() : (state.resuming ?? Promise.resolve());
    void resumed.then(() => {
      if (graph.ctx.state === 'running') stopListening();
    });
  };
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true);
  document.addEventListener('visibilitychange', () => void refreshAudio());
}

/** The audio graph, or null before the first input or when the browser has no Web Audio. */
export function audioGraph(): AudioGraph | null {
  return state.graph;
}

function pageShowing(): boolean {
  return document.visibilityState !== 'hidden';
}

/** Whether the context should run: the page shows and music or sounds are on. */
function shouldRun(): boolean {
  return pageShowing() && state.clients.some((client) => client.wantsAudio());
}

/**
 * Builds the audio graph on the first input and lets every player start (M7). False when the
 * browser has no Web Audio or refuses it; the game then stays silent.
 */
function startAudio(): boolean {
  if (state.graph !== null) return true;
  const graph = buildGraph();
  if (graph === null) return false;
  state.graph = graph;
  for (const client of state.clients) client.started(graph);
  void refreshAudio();
  return true;
}

function buildGraph(): AudioGraph | null {
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
  const mix = ctx.createGain();
  mix.connect(warm);
  warm.connect(limiter);
  limiter.connect(ctx.destination);
  const convolver = ctx.createConvolver();
  convolver.buffer = reverbImpulse(ctx);
  convolver.connect(mix);
  const music = busInto(ctx, mix, convolver, MUSIC_REVERB_SEND);
  const sounds = busInto(ctx, mix, convolver, SOUND_LEVELS.reverbSend);
  return { ctx, music, sounds, noise: noiseBuffer(ctx), plucks: new Map() };
}

/** A silent bus into `mix`, sending `send` of it to the room reverb. */
function busInto(ctx: AudioContext, mix: AudioNode, convolver: AudioNode, send: number): GainNode {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(mix);
  const reverb = ctx.createGain();
  reverb.gain.value = send;
  bus.connect(reverb);
  reverb.connect(convolver);
  return bus;
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

/**
 * Resumes the context when it should run and tells every player, then resolves; suspends it while
 * the page is hidden, or a moment after neither music nor sounds is on, once the players have faded
 * (M8, M9, S14). Resolves at once when it should not run.
 */
export function refreshAudio(): Promise<void> {
  const graph = state.graph;
  if (graph === null) return Promise.resolve();
  const { ctx } = graph;
  if (shouldRun()) {
    // Ask again even when a resume is in flight: a phone allows it only during a tap, and when the
    // context runs, the resume in flight completes too. The players hear once.
    const resume = ctx.resume();
    if (state.resuming !== null) return state.resuming;
    const resuming = resume
      .then(() => {
        for (const client of state.clients) client.resumed(graph);
      })
      .catch(() => undefined)
      .finally(() => {
        if (state.resuming === resuming) state.resuming = null;
      });
    state.resuming = resuming;
    return resuming;
  }
  if (!pageShowing()) {
    void ctx.suspend();
    return Promise.resolve();
  }
  window.setTimeout(() => {
    if (!shouldRun()) void ctx.suspend();
  }, MUSIC_LEVELS.switchFadeS * 1000 + 50);
  return Promise.resolve();
}

/** Ramps `bus` from where it is to `level` over `seconds`. */
export function rampBus(graph: AudioGraph, bus: GainNode, level: number, seconds: number): void {
  const gain = bus.gain;
  const now = graph.ctx.currentTime;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(level, now + Math.max(0.01, seconds));
}
