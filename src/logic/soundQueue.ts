/**
 * Pure sound queue rules (PRD S3, S4, S13; issue #165): when each asked-for sound starts. Every sound
 * starts at least SOUND_LEVELS.startDelayS after it is asked for, and the same sound and version starts
 * at most once in SOUND_LEVELS.repeatS, so one asked for sooner waits. Sounds also wait on their line:
 * snacks start SOUND_LEVELS.snackGapS apart, and only one find plays at a time. A sound on its own line
 * keeps at most one waiting turn per version; a later ask for it while one waits plays nothing. Times
 * are in seconds on one clock, such as the audio clock.
 */
import { nextFindSlot } from './findWait';
import { repeatKey, SOUND_LEVELS, soundVersion, type SoundId } from './sounds';

/** The line a sound waits in: the snacks', the finds', or its own. */
export type SoundLine = 'snack' | 'find' | 'own';

/** Sounds that wait in the snack line. Later snack-like sounds join it. */
const SNACK_LINE_SOUNDS: readonly SoundId[] = Object.freeze(['snack', 'lastThree']);

/** The line sound `id` waits in. */
export function soundLine(id: SoundId): SoundLine {
  if (SNACK_LINE_SOUNDS.includes(id)) return 'snack';
  if (id === 'find') return 'find';
  return 'own';
}

/** An ask for a sound: its id, its version, and who asked (null for no one in particular). */
export interface SoundAsk {
  readonly id: SoundId;
  readonly version: string;
  readonly owner: number | null;
}

/** An asked-for sound's turn: when it starts, when it rings out, and whether it has started. */
export interface SoundTurn extends SoundAsk {
  readonly startAt: number;
  readonly endsAt: number;
  readonly started: boolean;
}

/** The turns asked for, in ask order. */
export type SoundQueue = readonly SoundTurn[];

/** A queue with no turns. */
export const EMPTY_SOUND_QUEUE: SoundQueue = Object.freeze([]);

/** A queue after an ask, and the ask's turn (null when it plays nothing). */
export interface TurnTaken {
  readonly queue: SoundQueue;
  readonly turn: SoundTurn | null;
}

/** A queue after starting the turns that are due, and those turns in start order. */
export interface DueTurns {
  readonly queue: SoundQueue;
  readonly due: readonly SoundTurn[];
}

/**
 * When a snack that could start at `soonest` starts, after a last snack that started at `lastStartAt`
 * (undefined if none): at `soonest`, or SOUND_LEVELS.snackGapS after the last start if that is later.
 */
export function snackTurnStart(lastStartAt: number | undefined, soonest: number): number {
  if (lastStartAt === undefined) return soonest;
  return Math.max(soonest, lastStartAt + SOUND_LEVELS.snackGapS);
}

/** Seconds after its start that a started turn still holds back later asks. */
const HOLD_S = Math.max(SOUND_LEVELS.repeatS, SOUND_LEVELS.snackGapS);

/** Whether `turn` has started and no longer holds back an ask at `now`. */
function isSpent(turn: Readonly<SoundTurn>, now: number): boolean {
  return turn.started && now >= Math.max(turn.endsAt, turn.startAt + HOLD_S);
}

/** The latest of `pick` over the turns in `queue` that `matches` keeps, or undefined if none. */
function latestOf(queue: SoundQueue, matches: (turn: SoundTurn) => boolean, pick: (turn: SoundTurn) => number): number | undefined {
  let latest: number | undefined;
  for (const turn of queue) {
    if (!matches(turn)) continue;
    const value = pick(turn);
    if (latest === undefined || value > latest) latest = value;
  }
  return latest;
}

/** When the ask's line lets a sound `seconds` long that could start at `soonest` start. */
function lineStart(queue: SoundQueue, ask: Readonly<SoundAsk>, soonest: number, seconds: number): number {
  const line = soundLine(ask.id);
  if (line === 'snack') {
    const lastStartAt = latestOf(queue, (turn) => soundLine(turn.id) === 'snack', (turn) => turn.startAt);
    return snackTurnStart(lastStartAt, soonest);
  }
  if (line === 'find') {
    const lastEndsAt = latestOf(queue, (turn) => soundLine(turn.id) === 'find', (turn) => turn.endsAt);
    return nextFindSlot(lastEndsAt, soonest, seconds).startAt;
  }
  return soonest;
}

/**
 * The turn of `ask`, asked for at `now`, and the queue with it added. Started turns that have rung
 * out and no longer hold back an ask leave the queue first. The turn starts at the latest of: `now`
 * plus SOUND_LEVELS.startDelayS, SOUND_LEVELS.repeatS after the last start of the same sound and
 * version, and its line's rule (snacks SOUND_LEVELS.snackGapS apart, one find at a time). An own-line
 * ask whose sound and version already has a waiting turn gets no turn (null) and adds nothing; snack
 * and find asks always get a turn.
 */
export function takeTurn(queue: SoundQueue, ask: Readonly<SoundAsk>, now: number): TurnTaken {
  const kept = queue.filter((turn) => !isSpent(turn, now));
  const key = repeatKey(ask.id, ask.version);
  const sameKey = (turn: SoundTurn): boolean => repeatKey(turn.id, turn.version) === key;
  if (soundLine(ask.id) === 'own' && kept.some((turn) => !turn.started && sameKey(turn))) {
    return { queue: kept, turn: null };
  }
  const seconds = soundVersion(ask.id, ask.version).seconds;
  const soonest = now + SOUND_LEVELS.startDelayS;
  const lastKeyStartAt = latestOf(kept, sameKey, (turn) => turn.startAt);
  const repeatStart = lastKeyStartAt === undefined ? soonest : lastKeyStartAt + SOUND_LEVELS.repeatS;
  const startAt = Math.max(soonest, repeatStart, lineStart(kept, ask, soonest, seconds));
  const turn: SoundTurn = { id: ask.id, version: ask.version, owner: ask.owner, startAt, endsAt: startAt + seconds, started: false };
  return { queue: [...kept, turn], turn };
}

/** Whether waiting `turn` is due at `now`: its start is no more than SOUND_LEVELS.startDelayS away. */
function isDue(turn: Readonly<SoundTurn>, now: number): boolean {
  return !turn.started && turn.startAt <= now + SOUND_LEVELS.startDelayS;
}

/**
 * Starts every waiting turn due at `now` (its start minus SOUND_LEVELS.startDelayS is at most `now`).
 * Gives the queue with them marked started, and them in start order, ties in ask order.
 */
export function startDueTurns(queue: SoundQueue, now: number): DueTurns {
  const due: SoundTurn[] = [];
  const nextQueue = queue.map((turn) => {
    if (!isDue(turn, now)) return turn;
    const startedTurn: SoundTurn = { ...turn, started: true };
    due.push(startedTurn);
    return startedTurn;
  });
  due.sort((first, second) => first.startAt - second.startAt);
  return { queue: nextQueue, due };
}

/**
 * The queue without its waiting turns: only `owner`'s when given, every waiting turn otherwise.
 * Started turns stay.
 */
export function dropWaitingTurns(queue: SoundQueue, owner?: number): SoundQueue {
  return queue.filter((turn) => turn.started || (owner !== undefined && turn.owner !== owner));
}

/** The earliest start of a waiting turn, or undefined if none waits. */
export function nextWaitingStart(queue: SoundQueue): number | undefined {
  let earliest: number | undefined;
  for (const turn of queue) {
    if (!turn.started && (earliest === undefined || turn.startAt < earliest)) earliest = turn.startAt;
  }
  return earliest;
}
