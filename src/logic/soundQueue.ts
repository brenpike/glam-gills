/**
 * Pure sound queue rules (PRD S3, S4, S13; issue #165): when each asked-for sound starts. A turn holds no
 * start while it waits; the queue sets its start only when it starts the turn, from when the sounds
 * ahead of it really started and ended. Every sound starts at least SOUND_LEVELS.startDelayS after it
 * is asked for, and the same sound and version starts at most once in SOUND_LEVELS.repeatS, so one
 * asked for sooner waits. Sounds also wait on their line: snacks start SOUND_LEVELS.snackGapS apart,
 * and only one find plays at a time. A sound on its own line keeps at most one waiting turn per
 * version; a later ask for it while one waits plays nothing. Some sounds also wait until every
 * snack-line sound ahead of them has rung out. The pump only wakes the queue: a late wake starts a turn
 * late, and every turn behind it counts from that real start, so no rule is broken. Times are in
 * seconds on one clock, such as the audio clock.
 */
import { nextFindSlot } from './findWait';
import { repeatKey, SOUND_LEVELS, soundVersion, type SoundId } from './sounds';

/** The line a sound waits in: the snacks', the finds', or its own. */
export type SoundLine = 'snack' | 'find' | 'own';

/** Sounds that wait in the snack line. Later snack-like sounds join it. */
const SNACK_LINE_SOUNDS: readonly SoundId[] = Object.freeze(['snack', 'lastThree']);

/**
 * Sounds that start only once every snack-line turn ahead of them, started or waiting, has rung out:
 * the exit's "ta-da" waits for the last snack's sound on the same clock the snack plays on (issue #165).
 */
const AFTER_SNACKS_SOUNDS: readonly SoundId[] = Object.freeze(['exitOpens']);

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

/** A turn that has not started: when it was asked for, and no start until the queue starts it. */
export interface WaitingTurn extends SoundAsk {
  readonly started: false;
  readonly askedAt: number;
}

/** A turn the queue has started: the start the sound really plays at, and when it rings out. */
export interface StartedTurn extends SoundAsk {
  readonly started: true;
  readonly startAt: number;
  readonly endsAt: number;
}

/** An asked-for sound's turn, waiting or started. */
export type SoundTurn = WaitingTurn | StartedTurn;

/** The turns asked for, in ask order. */
export type SoundQueue = readonly SoundTurn[];

/** A queue with no turns. */
export const EMPTY_SOUND_QUEUE: SoundQueue = Object.freeze([]);

/** A queue after an ask, and the ask's turn (null when it plays nothing). */
export interface TurnTaken {
  readonly queue: SoundQueue;
  readonly turn: WaitingTurn | null;
}

/** A queue after starting the turns that are due, and those turns in start order. */
export interface DueTurns {
  readonly queue: SoundQueue;
  readonly due: readonly StartedTurn[];
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

/** Whether `turn` has started. */
function isStarted(turn: SoundTurn): turn is StartedTurn {
  return turn.started;
}

/** A turn's place on the clock while the queue walks: a started turn's real one, or a waiting turn's projection. */
type PlacedTurn = Pick<StartedTurn, 'id' | 'version' | 'startAt' | 'endsAt'>;

/** Whether `turn` waits in the snack line. */
function isSnackLine(turn: Readonly<PlacedTurn>): boolean {
  return soundLine(turn.id) === 'snack';
}

/** Whether `turn` waits in the find line. */
function isFindLine(turn: Readonly<PlacedTurn>): boolean {
  return soundLine(turn.id) === 'find';
}

/** The latest of `pick` over the turns in `placed` that `matches` keeps, or undefined if none. */
function latestOf(
  placed: readonly PlacedTurn[],
  matches: (turn: PlacedTurn) => boolean,
  pick: (turn: PlacedTurn) => number,
): number | undefined {
  let latest: number | undefined;
  for (const turn of placed) {
    if (!matches(turn)) continue;
    const value = pick(turn);
    if (latest === undefined || value > latest) latest = value;
  }
  return latest;
}

/**
 * The earliest start of waiting `turn`, a sound `seconds` long, behind the turns in `placed`: the latest
 * of its ask time plus SOUND_LEVELS.startDelayS, SOUND_LEVELS.repeatS after the last start of the same
 * sound and version, its line's rule (snacks SOUND_LEVELS.snackGapS apart, one find at a time), and for
 * a sound in AFTER_SNACKS_SOUNDS the end of the last snack-line turn.
 */
function earliestStart(placed: readonly PlacedTurn[], turn: Readonly<WaitingTurn>, seconds: number): number {
  const soonest = turn.askedAt + SOUND_LEVELS.startDelayS;
  const key = repeatKey(turn.id, turn.version);
  const lastKeyStartAt = latestOf(placed, (other) => repeatKey(other.id, other.version) === key, (other) => other.startAt);
  let earliest = lastKeyStartAt === undefined ? soonest : Math.max(soonest, lastKeyStartAt + SOUND_LEVELS.repeatS);
  const line = soundLine(turn.id);
  if (line === 'snack') earliest = Math.max(earliest, snackTurnStart(latestOf(placed, isSnackLine, (other) => other.startAt), soonest));
  if (line === 'find') earliest = Math.max(earliest, nextFindSlot(latestOf(placed, isFindLine, (other) => other.endsAt), soonest, seconds).startAt);
  if (AFTER_SNACKS_SOUNDS.includes(turn.id)) earliest = Math.max(earliest, latestOf(placed, isSnackLine, (other) => other.endsAt) ?? soonest);
  return earliest;
}

/** The queue after a walk at one moment, the turns it started, and the earliest start of any turn that waited. */
interface QueueWalk {
  readonly queue: SoundQueue;
  readonly due: readonly StartedTurn[];
  readonly nextStart: number | undefined;
}

/**
 * Walks `queue` at `now`, starting every waiting turn that is due. Every started turn is placed first,
 * at its real start and end. Waiting turns are then visited in ask order, each behind the turns placed
 * so far. A turn is due when its earliest start is no more than SOUND_LEVELS.startDelayS after `now`;
 * it starts at its earliest start, or at `now` if that has passed, and is placed there. A turn not due
 * stays as it was, and is placed at its earliest start only for the turns behind it in this walk. The
 * due turns come in start order, ties in ask order.
 */
function walkQueue(queue: SoundQueue, now: number): QueueWalk {
  const placed: PlacedTurn[] = queue.filter(isStarted);
  const walked: SoundTurn[] = [];
  const due: StartedTurn[] = [];
  let nextStart: number | undefined;
  for (const turn of queue) {
    if (turn.started) {
      walked.push(turn);
      continue;
    }
    const seconds = soundVersion(turn.id, turn.version).seconds;
    const earliest = earliestStart(placed, turn, seconds);
    if (nextStart === undefined || earliest < nextStart) nextStart = earliest;
    if (earliest > now + SOUND_LEVELS.startDelayS) {
      walked.push(turn);
      placed.push({ id: turn.id, version: turn.version, startAt: earliest, endsAt: earliest + seconds });
      continue;
    }
    const startAt = Math.max(earliest, now);
    const startedTurn: StartedTurn = { id: turn.id, version: turn.version, owner: turn.owner, started: true, startAt, endsAt: startAt + seconds };
    walked.push(startedTurn);
    due.push(startedTurn);
    placed.push(startedTurn);
  }
  due.sort((first, second) => first.startAt - second.startAt);
  return { queue: walked, due, nextStart };
}

/**
 * The turn of `ask`, asked for at `now`, and the queue with it added. Started turns that have rung
 * out and no longer hold back an ask leave the queue first. The turn waits with no start: the queue
 * sets its start only when it starts the turn (startDueTurns). A started turn leaves only once it has
 * rung out, so a snack's end still holds back a sound in AFTER_SNACKS_SOUNDS while it rings. An
 * own-line ask whose sound and version already has a waiting turn gets no turn (null) and adds
 * nothing; snack and find asks always get a turn.
 */
export function takeTurn(queue: SoundQueue, ask: Readonly<SoundAsk>, now: number): TurnTaken {
  const kept = queue.filter((turn) => !isSpent(turn, now));
  const key = repeatKey(ask.id, ask.version);
  if (soundLine(ask.id) === 'own' && kept.some((turn) => !turn.started && repeatKey(turn.id, turn.version) === key)) {
    return { queue: kept, turn: null };
  }
  const turn: WaitingTurn = { id: ask.id, version: ask.version, owner: ask.owner, started: false, askedAt: now };
  return { queue: [...kept, turn], turn };
}

/**
 * Starts every waiting turn due at `now`: one whose earliest start, counted from when the turns ahead of
 * it really started and ended, is no more than SOUND_LEVELS.startDelayS away. Each starts at its
 * earliest start, or at `now` if that has passed, so no start is ever before `now`. Gives the queue
 * with them started, in ask order, the turns still waiting untouched; and them in start order, ties in
 * ask order. Starts nothing while the clock is not running (`clockRunning` false), and gives `queue`
 * itself back: a turn asked for while the clock stands still keeps waiting, so it can still be dropped,
 * and starts once the clock runs again, as pumpWaitMs waits for (issue #165).
 */
export function startDueTurns(queue: SoundQueue, now: number, clockRunning: boolean): DueTurns {
  if (!clockRunning) return { queue, due: [] };
  const { queue: walked, due } = walkQueue(queue, now);
  return { queue: walked, due };
}

/**
 * The queue without its waiting turns: only `owner`'s when given, every waiting turn otherwise.
 * Started turns stay.
 */
export function dropWaitingTurns(queue: SoundQueue, owner?: number): SoundQueue {
  return queue.filter((turn) => turn.started || (owner !== undefined && turn.owner !== owner));
}

/**
 * The earliest start at `now` of a waiting turn, counted from when the turns ahead of it really started
 * and ended, or undefined if none waits.
 */
export function nextWaitingStart(queue: SoundQueue, now: number): number | undefined {
  return walkQueue(queue, now).nextStart;
}

/** The shortest wait, in milliseconds, before the pump looks for due turns again; it never fires at once. */
export const PUMP_FLOOR_MS = 10;

/**
 * Milliseconds the pump waits at `now` before looking for due turns again: until the next waiting turn
 * falls due (its start minus SOUND_LEVELS.startDelayS), and never less than PUMP_FLOOR_MS. Null when no
 * turn waits, or when the clock is not running (`clockRunning` false), since a paused clock never
 * brings a turn due; the pump waits for the clock to run again instead. The pump only wakes the queue:
 * a late wake never moves a start earlier than the rules allow (issue #165).
 */
export function pumpWaitMs(queue: SoundQueue, clockRunning: boolean, now: number): number | null {
  if (!clockRunning) return null;
  const nextStart = nextWaitingStart(queue, now);
  if (nextStart === undefined) return null;
  return Math.max(PUMP_FLOOR_MS, (nextStart - SOUND_LEVELS.startDelayS - now) * 1000);
}
