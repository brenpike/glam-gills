/**
 * Browser glue for background music (PRD N6, M1 to M12; ADR 0025). The shared voices
 * (src/platform/audioVoices.ts) play the notes the pure arrangement in src/logic/music.ts gives, a
 * little ahead of time, on the music bus of the shared audio engine (src/platform/audioEngine.ts).
 * There are no audio files and no network (M6). Nothing sounds before the first tap, click or key
 * press (M7). A change of cue cross-fades, and the same cue carries on across screens (M1, M9). The
 * music stops while the page is hidden and plays softer while a trip is paused (M9).
 *
 * Scenes say where the player is (setMusicScreen) and whether a trip is paused (setMusicPaused); the
 * music switch reads and sets musicIsOn and setMusicOn.
 */
import {
  MUSIC_LEVELS,
  arrangeStep,
  musicCueFor,
  stepSeconds,
  type MusicArea,
  type MusicCue,
  type MusicScreen,
} from '../logic/music';
import { audioGraph, joinAudio, rampBus, refreshAudio, type AudioGraph } from './audioEngine';
import { SILENT, playMusicNote } from './audioVoices';
import { readMusicSetting, writeMusicSetting } from './musicSetting';

/** Seconds of notes scheduled ahead of the audio clock. */
const LOOKAHEAD_S = 0.15;
/** Milliseconds between scheduler runs. */
const TICK_MS = 25;
/** Seconds after the first scheduled note of a cue. */
const START_DELAY_S = 0.1;
/** Seconds a faded-out cue's last notes may ring before its bus is let go. */
const TAIL_S = 2.5;

/** One cue playing: its bus (for its cross-fade), its next step and when that step starts. */
interface CueRun {
  cue: Readonly<MusicCue>;
  bus: GainNode;
  seed: number;
  step: number;
  nextTime: number;
  fading: boolean;
}

const state = {
  on: true,
  paused: false,
  screen: 'title' as MusicScreen,
  area: undefined as Readonly<MusicArea> | undefined,
  runs: [] as CueRun[],
  timer: 0,
  /** Whether the scheduler plays notes: from music turning on until its fade out ends. */
  scheduling: false,
  /** Seconds the music bus takes to reach its level when the context next runs. */
  fadeS: MUSIC_LEVELS.fadeInS as number,
  installed: false,
};

/**
 * Joins the shared audio engine, which listens for the first input (to make sound) and for the page
 * being hidden. Call once, before the game starts. Reads the music switch from device storage.
 */
export function installMusic(): void {
  if (state.installed) return;
  state.installed = true;
  state.on = readMusicSetting();
  joinAudio({ wantsAudio: () => state.on, started, resumed });
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
  const graph = audioGraph();
  if (graph !== null && !on) fadeAway(graph);
  void refreshAudio();
}

/**
 * The cue playing now, or the one that would play with music off: the sounds play in its key
 * (PRD S12).
 */
export function musicCueNow(): Readonly<MusicCue> {
  return musicCueFor(state.screen, state.area);
}

/**
 * Plays the cue for `screen`, and on a trip for its `area` (M1, M2, M4); the same cue carries on,
 * another cross-fades in (M9).
 */
export function setMusicScreen(screen: MusicScreen, area?: Readonly<MusicArea>): void {
  state.screen = screen;
  state.area = screen === 'trip' ? area : undefined;
  if (screen !== 'trip') setPaused(false);
  const graph = audioGraph();
  if (graph === null) return;
  const cue = musicCueFor(screen, state.area);
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
  const graph = audioGraph();
  if (graph !== null && shouldPlay()) rampBus(graph, graph.music, musicLevel(), MUSIC_LEVELS.switchFadeS);
}

function musicLevel(): number {
  return MUSIC_LEVELS.master * (state.paused ? MUSIC_LEVELS.paused : 1);
}

function shouldPlay(): boolean {
  return state.on && document.visibilityState !== 'hidden';
}

function liveRun(): CueRun | undefined {
  return state.runs.find((run) => !run.fading);
}

/** The graph is built on the first input: starts the cue for the current screen and the scheduler (M7). */
function started(graph: AudioGraph): void {
  state.fadeS = shouldPlay() ? MUSIC_LEVELS.fadeInS : MUSIC_LEVELS.switchFadeS;
  startRun(graph, musicCueFor(state.screen, state.area), 0);
  state.timer = window.setInterval(tick, TICK_MS);
}

/**
 * The context runs again: when music should play, carries every cue on from its next step and fades
 * the music bus in, over the first input's fade in the first time (M7, M9).
 */
function resumed(graph: AudioGraph): void {
  if (!shouldPlay()) return;
  state.scheduling = true;
  const { ctx } = graph;
  for (const run of state.runs) run.nextTime = Math.max(run.nextTime, ctx.currentTime + START_DELAY_S);
  rampBus(graph, graph.music, musicLevel(), state.fadeS);
  state.fadeS = MUSIC_LEVELS.switchFadeS;
}

/** Fades the music bus out when music turns off, and stops scheduling notes once it is silent (M8). */
function fadeAway(graph: AudioGraph): void {
  rampBus(graph, graph.music, 0, MUSIC_LEVELS.switchFadeS);
  window.setTimeout(() => {
    if (!state.on) state.scheduling = false;
  }, MUSIC_LEVELS.switchFadeS * 1000 + 50);
}

function startRun(graph: AudioGraph, cue: Readonly<MusicCue>, fadeInS: number): void {
  const { ctx } = graph;
  const bus = ctx.createGain();
  const now = ctx.currentTime;
  bus.gain.setValueAtTime(fadeInS > 0 ? SILENT : 1, now);
  if (fadeInS > 0) bus.gain.linearRampToValueAtTime(1, now + fadeInS);
  bus.connect(graph.music);
  const seed = Math.floor(Math.random() * 0x7fffffff);
  state.runs.push({ cue, bus, seed, step: 0, nextTime: now + START_DELAY_S, fading: false });
}

/** Fades `run` out over the cross-fade, stops scheduling it, and lets its bus go once its notes ring out. */
function fadeOut(graph: AudioGraph, run: CueRun): void {
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
  const graph = audioGraph();
  if (graph === null || graph.ctx.state !== 'running' || !state.scheduling) return;
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
      for (const note of arrangeStep(run.cue, run.step, run.seed)) playMusicNote(graph, run.bus, note, run.nextTime + note.at);
      run.step++;
      run.nextTime += stepS;
    }
  }
}
