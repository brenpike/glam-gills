/**
 * Browser glue for sound effects (PRD N7, S1 to S16; ADR 0026). Plays a sound's recipe from
 * src/logic/sounds.ts on the sounds bus of the shared audio engine (src/platform/audioEngine.ts), at
 * the sound's level, in the key of the cue playing, or the cue that would play with music off (S12).
 * Nothing sounds before the first input, or while the page is hidden (S1).
 *
 * One queue (src/logic/soundQueue.ts) gives each asked-for sound its turn on the audio clock (S3, S4,
 * S13; issue #165). Snacks start 80 ms apart, and a find waits for the last find to end. A repeat of
 * the same sound within 60 ms waits for its turn instead of being dropped; a sound other than a snack
 * or a find keeps at most one turn waiting, and a later ask for it while one waits plays nothing. A
 * waiting turn holds no start: the queue sets it only when it starts the turn, from when the sounds
 * ahead really started and ended, and the sound plays at exactly that start. A sound's notes are built
 * only when its turn starts. Waiting sounds are dropped when sounds turn off
 * or the page hides, and an owner's waiting sounds when the owner drops them (SoundOwner.dropWaiting).
 * A sound that has started rings out, even when its scene ends, so a scene change never cuts it short.
 * The queue waits while the audio is paused and its clock stands still, and goes on when it runs again.
 * A sound asked for while the audio is paused waits for it to run, so it can still be dropped.
 * A started sound's life runs on the audio clock too, so when the audio pauses (the page hides, both
 * switches turn off, or the device interrupts it) the sound finishes when the audio resumes (issue #165).
 *
 * Scenes say which sound to play (playSound); the sound router owns its trip's sounds (ownSounds); the
 * sounds switch reads and sets soundsAreOn and setSoundsOn.
 */
import {
  dropWaitingTurns,
  EMPTY_SOUND_QUEUE,
  pumpWaitMs,
  startDueTurns,
  takeTurn,
  type SoundAsk,
  type SoundQueue,
  type StartedTurn,
} from '../logic/soundQueue';
import { ONLY_VERSION, SOUND_LEVELS, soundGain, soundKeyFor, soundNotes, soundVersion, type SoundId } from '../logic/sounds';
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
  /** Every asked-for sound's turn on the audio clock, waiting or started (S3, S4, S13). */
  queue: EMPTY_SOUND_QUEUE as SoundQueue,
  /** The timer that starts the next waiting turn when it falls due, or null while no turn waits. */
  pump: null as number | null,
  /** The last owner id handed out by ownSounds. */
  lastOwner: 0,
  /** Whether the audio context's statechange listener is in place. */
  watchingClock: false,
};

/** Joins the shared audio engine and reads the sounds switch from device storage. Call once, before the game starts. */
export function installSounds(): void {
  if (state.installed) return;
  state.installed = true;
  state.on = readSoundsSetting();
  joinAudio({ wantsAudio: () => state.on, started: startedAudio, resumed: showLevel });
  document.addEventListener('visibilitychange', dropWaitingIfHidden);
}

/** Whether sounds are on (the sounds switch, S14). */
export function soundsAreOn(): boolean {
  return state.on;
}

/**
 * Turns sounds on or off and keeps the choice on the device (S14). Turning them on plays a short
 * sample, so the player hears them; turning them off plays nothing and drops every waiting sound (S15).
 */
export function setSoundsOn(on: boolean): void {
  if (state.on === on) return;
  state.on = on;
  writeSoundsSetting(on);
  if (!on) dropEveryWaitingTurn();
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
 * Plays version `version` of sound `id` on the sounds bus at its level, in the current cue's key, when
 * its turn comes (S12, S13). Plays nothing while sounds are off, before the first input, or while the
 * page is hidden. A find (version: its rarity) waits for the last find to end (S4).
 */
export function playSound(id: SoundId, version: string = ONLY_VERSION): void {
  askSound({ id, version, owner: null });
}

/** Sounds asked for by one owner, whose waiting sounds it can drop without touching anyone else's. */
export interface SoundOwner {
  /** Plays version `version` of sound `id` when its turn comes, as playSound does. */
  play(id: SoundId, version?: string): void;
  /** Drops this owner's sounds that have not started yet; started ones ring out. */
  dropWaiting(): void;
}

/** A new owner of sounds, with its own id. */
export function ownSounds(): SoundOwner {
  state.lastOwner += 1;
  const owner = state.lastOwner;
  return {
    play: (id: SoundId, version: string = ONLY_VERSION) => askSound({ id, version, owner }),
    dropWaiting: () => dropOwnersWaitingTurns(owner),
  };
}

/** Takes a turn for `ask` on the audio clock, starts the turns now due, and arms the pump. */
function askSound(ask: SoundAsk): void {
  const graph = audioGraph();
  if (!state.on || graph === null || document.visibilityState === 'hidden') return;
  state.queue = takeTurn(state.queue, ask, graph.ctx.currentTime).queue;
  startDueSounds(graph);
  armPump(graph);
}

/** Starts every waiting turn that is due now; none while the audio clock is not running. */
function startDueSounds(graph: AudioGraph): void {
  const { queue, due } = startDueTurns(state.queue, graph.ctx.currentTime, clockRuns(graph));
  state.queue = queue;
  for (const turn of due) startSound(graph, turn);
}

/**
 * Builds `turn`'s sound through its own level stage on the sounds bus, in the key of the cue playing
 * now, starting at exactly the start the queue gave it. The only place sound notes are built.
 */
function startSound(graph: AudioGraph, turn: Readonly<StartedTurn>): void {
  const { ctx } = graph;
  const sound = soundVersion(turn.id, turn.version);
  const stage = ctx.createGain();
  stage.gain.value = soundGain(sound.levelDb);
  stage.connect(graph.sounds);
  // INVARIANT: the queue never gives a start before the audio clock's now; a start the clock has
  // already reached plays at once (Web Audio rule).
  for (const note of soundNotes(turn.id, turn.version, soundKeyFor(musicCueNow()))) playSoundNote(graph, stage, note, turn.startAt + note.at);
  releaseStageOnClock(ctx, stage, turn.startAt, turn.endsAt + TAIL_S);
}

/**
 * Disconnects `stage` when the audio clock reaches `endAt`, timed by a silent end marker on the stage
 * from `startAt`. The wait runs on the audio clock, not a wall-clock timer, so it stands still while the
 * audio is paused and a started sound finishes when the audio runs again (issue #165).
 */
function releaseStageOnClock(ctx: AudioContext, stage: GainNode, startAt: number, endAt: number): void {
  const marker = ctx.createConstantSource();
  marker.offset.value = 0;
  marker.connect(stage);
  marker.onended = () => {
    marker.disconnect();
    stage.disconnect();
  };
  marker.start(startAt);
  marker.stop(endAt);
}

/**
 * Arms the pump for when the next waiting turn falls due, or clears it when no turn waits or the audio
 * clock is not running; clockResumed arms it again when the clock runs. The pump is the one wall-clock
 * timer here, and it only wakes the queue: it is armed only while the audio clock runs, the queue sets
 * each turn's start from the audio clock and the real starts and ends of the sounds ahead when it
 * fires, and a pause re-pumps on statechange. So a late timer starts a sound late, but never bunches
 * snacks, overlaps finds, shortens the 60 ms gap or lets the exit overlap the last snack (issue #165).
 */
function armPump(graph: AudioGraph): void {
  clearPump();
  const { ctx } = graph;
  const waitMs = pumpWaitMs(state.queue, clockRuns(graph), ctx.currentTime);
  if (waitMs === null) return;
  state.pump = window.setTimeout(runPump, waitMs);
}

/** Stops the pump, if armed. */
function clearPump(): void {
  if (state.pump === null) return;
  window.clearTimeout(state.pump);
  state.pump = null;
}

/** Starts the turns now due and re-arms, or drops every waiting turn if sounds are off or the page is hidden. */
function runPump(): void {
  state.pump = null;
  pumpQueue();
}

/** Starts the turns now due and re-arms the pump when the audio clock runs again after a pause. */
function clockResumed(graph: AudioGraph): void {
  if (!clockRuns(graph)) return;
  pumpQueue();
}

/** Whether `graph`'s audio clock is running, so the queue may start turns on it. */
function clockRuns(graph: AudioGraph): boolean {
  return graph.ctx.state === 'running';
}

/** Starts the turns now due and re-arms, or drops every waiting turn if sounds are off or the page is hidden. */
function pumpQueue(): void {
  const graph = audioGraph();
  if (!state.on || graph === null || document.visibilityState === 'hidden') {
    dropEveryWaitingTurn();
    return;
  }
  startDueSounds(graph);
  armPump(graph);
}

/** Drops every turn that has not started yet, and stops the pump. */
function dropEveryWaitingTurn(): void {
  state.queue = dropWaitingTurns(state.queue);
  clearPump();
}

/** Drops `owner`'s turns that have not started yet, then re-arms the pump for any other waiting turn. */
function dropOwnersWaitingTurns(owner: number): void {
  state.queue = dropWaitingTurns(state.queue, owner);
  const graph = audioGraph();
  if (graph === null) {
    clearPump();
    return;
  }
  armPump(graph);
}

/** Drops every waiting sound when the page hides (S1). */
function dropWaitingIfHidden(): void {
  if (document.visibilityState === 'hidden') dropEveryWaitingTurn();
}

/** Shows the sounds bus level on the new graph, and listens for its audio clock to run again (once). */
function startedAudio(graph: AudioGraph): void {
  showLevel(graph);
  if (state.watchingClock) return;
  state.watchingClock = true;
  graph.ctx.addEventListener('statechange', () => clockResumed(graph));
}

/** Sets the sounds bus to its level while sounds are on, and silent while off. */
function showLevel(graph: AudioGraph): void {
  rampBus(graph, graph.sounds, state.on ? SOUND_LEVELS.bus : 0, state.on ? 0.01 : OFF_FADE_S);
}
