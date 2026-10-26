/**
 * Browser glue for sound effects (PRD N7, S1 to S16; ADR 0026). Plays a sound's recipe from
 * src/logic/sounds.ts on the sounds bus of the shared audio engine (src/platform/audioEngine.ts), at
 * the sound's level, in the key of the cue playing, or the cue that would play with music off (S12).
 * Nothing sounds before the first input, or while the page is hidden (S1). The same sound plays at
 * most once every 60 ms (S13).
 *
 * Scenes and the sound router say which sound to play (playSound); the sounds switch reads and sets
 * soundsAreOn and setSoundsOn.
 */
import {
  ONLY_VERSION,
  SOUND_LEVELS,
  passesRepeatLimit,
  repeatKey,
  soundGain,
  soundKeyFor,
  soundNotes,
  soundVersion,
  type SoundId,
} from '../logic/sounds';
import { audioGraph, joinAudio, rampBus, refreshAudio, type AudioGraph } from './audioEngine';
import { playSoundNote } from './audioVoices';
import { musicCueNow } from './musicPlayer';
import { readSoundsSetting, writeSoundsSetting } from './soundSetting';

/** Seconds the sounds bus takes to go silent when sounds turn off, so the cut never clicks. */
const OFF_FADE_S = 0.05;
/** Seconds a sound's level stage is kept after it has rung out, for its reverb. */
const TAIL_S = 3;

const state = {
  on: true,
  installed: false,
  /** When each sound and version last started, on the audio clock, for the repeat limit. */
  lastAt: new Map<string, number>(),
};

/** Joins the shared audio engine and reads the sounds switch from device storage. Call once, before the game starts. */
export function installSounds(): void {
  if (state.installed) return;
  state.installed = true;
  state.on = readSoundsSetting();
  joinAudio({ wantsAudio: () => state.on, started: showLevel, resumed: showLevel });
}

/** Whether sounds are on (the sounds switch, S14). */
export function soundsAreOn(): boolean {
  return state.on;
}

/**
 * Turns sounds on or off and keeps the choice on the device (S14). Turning them on plays a short
 * sample, so the player hears them; turning them off plays nothing (S15).
 */
export function setSoundsOn(on: boolean): void {
  if (state.on === on) return;
  state.on = on;
  writeSoundsSetting(on);
  const graph = audioGraph();
  if (graph !== null) showLevel(graph);
  void refreshAudio();
  if (on) playSound('soundsOn');
}

/** Plays the button tap (S15). */
export function playTap(): void {
  playSound('tap');
}

/**
 * Plays version `version` of sound `id` on the sounds bus at its level, in the current cue's key
 * (S12, S13). Plays nothing while sounds are off, before the first input, while the page is hidden,
 * or within 60 ms of the same sound.
 */
export function playSound(id: SoundId, version: string = ONLY_VERSION): void {
  const graph = audioGraph();
  if (!state.on || graph === null || document.visibilityState === 'hidden') return;
  const { ctx } = graph;
  const now = ctx.currentTime;
  const key = repeatKey(id, version);
  if (!passesRepeatLimit(state.lastAt.get(key), now)) return;
  state.lastAt.set(key, now);
  const sound = soundVersion(id, version);
  const stage = ctx.createGain();
  stage.gain.value = soundGain(sound.levelDb);
  stage.connect(graph.sounds);
  const start = now + SOUND_LEVELS.startDelayS;
  for (const note of soundNotes(id, version, soundKeyFor(musicCueNow()))) playSoundNote(graph, stage, note, start + note.at);
  window.setTimeout(() => stage.disconnect(), (sound.seconds + TAIL_S) * 1000);
}

/** Sets the sounds bus to its level while sounds are on, and silent while off. */
function showLevel(graph: AudioGraph): void {
  rampBus(graph, graph.sounds, state.on ? SOUND_LEVELS.bus : 0, state.on ? 0.01 : OFF_FADE_S);
}
