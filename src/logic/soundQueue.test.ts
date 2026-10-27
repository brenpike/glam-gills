import { describe, expect, it } from 'vitest';
import {
  EMPTY_SOUND_QUEUE,
  dropWaitingTurns,
  nextWaitingStart,
  PUMP_FLOOR_MS,
  pumpWaitMs,
  snackTurnStart,
  soundLine,
  startDueTurns,
  takeTurn,
  type SoundAsk,
  type SoundQueue,
  type StartedTurn,
  type WaitingTurn,
} from './soundQueue';
import { ONLY_VERSION, repeatKey, SOUND_LEVELS, SOUNDS, soundVersion, type SoundId } from './sounds';

const START_DELAY_S = SOUND_LEVELS.startDelayS;
const REPEAT_S = SOUND_LEVELS.repeatS;
const SNACK_GAP_S = SOUND_LEVELS.snackGapS;
const CLOSE_DIGITS = 9;
const SLACK_S = 1e-9;
const MAX_WAKES = 10000;

function soundAsk(id: SoundId, version: string = ONLY_VERSION, owner: number | null = null): SoundAsk {
  return { id, version, owner };
}

function waitingTurn(id: SoundId, askedAt: number, owner: number | null = null, version: string = ONLY_VERSION): WaitingTurn {
  return { id, version, owner, started: false, askedAt };
}

function startedTurn(id: SoundId, startAt: number, owner: number | null = null, version: string = ONLY_VERSION): StartedTurn {
  return { id, version, owner, started: true, startAt, endsAt: startAt + soundVersion(id, version).seconds };
}

/** A turn started by a pump, and the time on the clock when that pump ran. */
interface PumpedStart {
  readonly turn: StartedTurn;
  readonly now: number;
}

/** A queue after the pump has run until no turn waits, and every start it made, in start order. */
interface PumpedQueue {
  readonly queue: SoundQueue;
  readonly starts: readonly PumpedStart[];
}

/** Takes the turn of each ask in order at `now`, without starting any; none gets no turn. */
function takeTurnsAt(asks: readonly SoundAsk[], now: number): SoundQueue {
  let queue: SoundQueue = EMPTY_SOUND_QUEUE;
  for (const ask of asks) {
    const taken = takeTurn(queue, ask, now);
    if (taken.turn === null) throw new Error(`soundQueue.test: ${ask.id} got no turn`);
    queue = taken.queue;
  }
  return queue;
}

/** What the player does for one ask: takes its turn at `now`, then starts the turns due at `now`. */
function playAsk(queue: SoundQueue, ask: SoundAsk, now: number): { queue: SoundQueue; turn: WaitingTurn | null; due: readonly StartedTurn[] } {
  const taken = takeTurn(queue, ask, now);
  const started = startDueTurns(taken.queue, now, true);
  return { queue: started.queue, turn: taken.turn, due: started.due };
}

/**
 * What the pump does from `now` until no turn waits: starts the turns due, then wakes again when the
 * next waiting turn falls due, `lateS(wake)` seconds late.
 */
function pumpAll(queue: SoundQueue, now: number, lateS: (wake: number) => number): PumpedQueue {
  let pumped = queue;
  let clock = now;
  const starts: PumpedStart[] = [];
  for (let wake = 0; wake < MAX_WAKES; wake++) {
    const started = startDueTurns(pumped, clock, true);
    pumped = started.queue;
    for (const turn of started.due) starts.push({ turn, now: clock });
    const next = nextWaitingStart(pumped, clock);
    if (next === undefined) return { queue: pumped, starts };
    clock = Math.max(clock, next - START_DELAY_S + SLACK_S) + lateS(wake);
  }
  throw new Error('soundQueue.test: the pump never emptied the queue');
}

/** Pumps on time. */
function onTime(): number {
  return 0;
}

/** The start of the only turn in `starts` with sound `id`, version `version` and owner `owner`. */
function startOf(starts: readonly PumpedStart[], id: SoundId, owner: number | null, version: string = ONLY_VERSION): StartedTurn {
  const found = starts.filter(({ turn }) => turn.id === id && turn.owner === owner && turn.version === version);
  if (found.length !== 1) throw new Error(`soundQueue.test: ${found.length} starts of ${id} ${version} for ${owner}`);
  return found[0].turn;
}

describe('soundLine (issue #165)', () => {
  it('puts snacks and the last-3 twinkle in the snack line and finds in the find line', () => {
    expect(soundLine('snack')).toBe('snack');
    expect(soundLine('lastThree')).toBe('snack');
    expect(soundLine('find')).toBe('find');
  });

  it('gives every other sound its own line', () => {
    const others = (Object.keys(SOUNDS) as SoundId[]).filter((id) => !['snack', 'lastThree', 'find'].includes(id));
    expect(others.length).toBeGreaterThan(0);
    for (const id of others) expect(soundLine(id)).toBe('own');
  });
});

describe('snackTurnStart (S3; issue #165)', () => {
  it('starts the first snack as soon as it can', () => {
    expect(snackTurnStart(undefined, 3)).toBe(3);
  });

  it('starts a snack the snack gap after the last one when that is later', () => {
    expect(snackTurnStart(1, 1)).toBeCloseTo(1 + SNACK_GAP_S, CLOSE_DIGITS);
    expect(snackTurnStart(1, 1.05)).toBeCloseTo(1 + SNACK_GAP_S, CLOSE_DIGITS);
  });

  it('starts a snack as soon as it can once the gap has passed', () => {
    expect(snackTurnStart(1, 2)).toBe(2);
  });
});

describe('takeTurn (issue #165)', () => {
  it('gives a turn that waits with when it was asked for and no start', () => {
    const { turn } = takeTurn(EMPTY_SOUND_QUEUE, soundAsk('find', 'rare', 4), 2);
    expect(turn).toEqual({ id: 'find', version: 'rare', owner: 4, started: false, askedAt: 2 });
    expect(turn).not.toHaveProperty('startAt');
  });
});

describe('the snack line (S3; issue #165)', () => {
  it('starts 3 snacks eaten at the same moment 80 ms apart, in ask order', () => {
    const queue = takeTurnsAt([soundAsk('snack', '0', 0), soundAsk('snack', '1', 1), soundAsk('snack', '2', 2)], 1);
    const { starts } = pumpAll(queue, 1, onTime);
    expect(starts.map(({ turn }) => turn.version)).toEqual(['0', '1', '2']);
    expect(starts[0].turn.startAt).toBeCloseTo(1 + START_DELAY_S, CLOSE_DIGITS);
    expect(starts[1].turn.startAt).toBeCloseTo(1 + START_DELAY_S + SNACK_GAP_S, CLOSE_DIGITS);
    expect(starts[2].turn.startAt).toBeCloseTo(1 + START_DELAY_S + 2 * SNACK_GAP_S, CLOSE_DIGITS);
    for (const { turn } of starts) expect(turn.endsAt).toBeCloseTo(turn.startAt + soundVersion('snack', turn.version).seconds, CLOSE_DIGITS);
  });

  it('gives each of 3 last snacks eaten at the same moment a turn, 80 ms apart', () => {
    const queue = takeTurnsAt([soundAsk('lastThree'), soundAsk('lastThree'), soundAsk('lastThree')], 2);
    const { starts } = pumpAll(queue, 2, onTime);
    expect(starts).toHaveLength(3);
    expect(starts[1].turn.startAt - starts[0].turn.startAt).toBeCloseTo(SNACK_GAP_S, CLOSE_DIGITS);
    expect(starts[2].turn.startAt - starts[1].turn.startAt).toBeCloseTo(SNACK_GAP_S, CLOSE_DIGITS);
  });

  it('puts a snack and a last-3 twinkle in the same line', () => {
    const queue = takeTurnsAt([soundAsk('snack', '4'), soundAsk('lastThree')], 2);
    const { starts } = pumpAll(queue, 2, onTime);
    expect(starts.map(({ turn }) => turn.id)).toEqual(['snack', 'lastThree']);
    expect(starts[1].turn.startAt - starts[0].turn.startAt).toBeCloseTo(SNACK_GAP_S, CLOSE_DIGITS);
  });
});

describe("the exit's wait for the snacks (S8; issue #165)", () => {
  it('starts the exit asked for right after 3 last snacks at the same moment once the last snack really ends', () => {
    const queue = takeTurnsAt([soundAsk('lastThree', ONLY_VERSION, 0), soundAsk('lastThree', ONLY_VERSION, 1), soundAsk('lastThree', ONLY_VERSION, 2), soundAsk('exitOpens')], 5);
    const { starts } = pumpAll(queue, 5, onTime);
    const exit = startOf(starts, 'exitOpens', null);
    expect(exit.startAt).toBe(startOf(starts, 'lastThree', 2).endsAt);
    expect(exit.startAt).toBeCloseTo(5 + START_DELAY_S + 2 * SNACK_GAP_S + soundVersion('lastThree').seconds, CLOSE_DIGITS);
  });

  it('starts the exit with no wait when no snack is in the queue', () => {
    const tap = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 0);
    const exit = playAsk(tap.queue, soundAsk('exitOpens'), 3);
    expect(exit.due.map((turn) => [turn.id, turn.startAt])).toEqual([['exitOpens', 3 + START_DELAY_S]]);
  });

  it('waits for a snack that has not started yet', () => {
    const queue: SoundQueue = [startedTurn('snack', 1 + START_DELAY_S, null, '0'), waitingTurn('snack', 1, 1, '2')];
    const exit = playAsk(queue, soundAsk('exitOpens'), 1);
    expect(exit.due).toEqual([]);
    const { starts } = pumpAll(exit.queue, 1, onTime);
    expect(startOf(starts, 'exitOpens', null).startAt).toBe(startOf(starts, 'snack', 1, '2').endsAt);
  });

  it('waits for a started snack still ringing, and not for one that has rung out', () => {
    const snack = playAsk(EMPTY_SOUND_QUEUE, soundAsk('snack', '0'), 0);
    const { endsAt } = snack.due[0];
    const ringing = pumpAll(takeTurn(snack.queue, soundAsk('exitOpens'), 0.01).queue, 0.01, onTime);
    expect(startOf(ringing.starts, 'exitOpens', null).startAt).toBe(endsAt);
    const rungOut = playAsk(snack.queue, soundAsk('exitOpens'), endsAt + 1);
    expect(rungOut.due.map((turn) => turn.startAt)).toEqual([endsAt + 1 + START_DELAY_S]);
  });

  it("drops a waiting exit with its owner's other waiting turns", () => {
    const queue = takeTurnsAt([soundAsk('lastThree', ONLY_VERSION, 1), soundAsk('exitOpens', ONLY_VERSION, 1)], 2);
    expect(dropWaitingTurns(queue, 1)).toEqual([]);
  });
});

describe('the find line (S4; issue #165)', () => {
  it('gives 2 finds at the same moment turns, the second starting as the first really ends', () => {
    const queue = takeTurnsAt([soundAsk('find', 'common', 0), soundAsk('find', 'common', 1)], 1);
    const { starts } = pumpAll(queue, 1, onTime);
    expect(starts).toHaveLength(2);
    expect(startOf(starts, 'find', 0, 'common').startAt).toBeCloseTo(1 + START_DELAY_S, CLOSE_DIGITS);
    expect(startOf(starts, 'find', 1, 'common').startAt).toBe(startOf(starts, 'find', 0, 'common').endsAt);
  });

  it('makes a find asked for while a find plays wait for its end', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('find', 'common'), 0);
    expect(first.due).toHaveLength(1);
    const second = playAsk(first.queue, soundAsk('find', 'rare'), 0.5);
    expect(second.due).toHaveLength(0);
    const { starts } = pumpAll(second.queue, 0.5, onTime);
    expect(startOf(starts, 'find', null, 'rare').startAt).toBe(first.due[0].endsAt);
  });

  it("frees a dropped waiting find's slot", () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('find', 'common', 1), 0);
    const waiting = playAsk(first.queue, soundAsk('find', 'legendary', 2), 0.1);
    expect(waiting.turn?.started).toBe(false);
    expect(waiting.due).toEqual([]);
    const dropped = dropWaitingTurns(waiting.queue, 2);
    const third = takeTurn(dropped, soundAsk('find', 'rare', 1), 0.2);
    const { starts } = pumpAll(third.queue, 0.2, onTime);
    expect(startOf(starts, 'find', 1, 'rare').startAt).toBe(first.due[0].endsAt);
  });
});

describe('the repeat limit on own-line sounds (S13; issue #165)', () => {
  it('starts 2 taps at the same moment 60 ms apart and gives a 3rd no turn', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 1);
    const second = playAsk(first.queue, soundAsk('tap'), 1);
    expect(second.due).toHaveLength(0);
    const third = takeTurn(second.queue, soundAsk('tap'), 1);
    expect(third.turn).toBeNull();
    expect(third.queue).toHaveLength(2);
    const { starts } = pumpAll(third.queue, 1, onTime);
    expect(starts.map(({ turn }) => turn.startAt - first.due[0].startAt)).toEqual([expect.closeTo(REPEAT_S, CLOSE_DIGITS)]);
    expect(starts[0].turn.startAt).toBeCloseTo(1 + START_DELAY_S + REPEAT_S, CLOSE_DIGITS);
  });

  it('gives a new tap a turn once the waiting tap has started', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 1);
    const second = playAsk(first.queue, soundAsk('tap'), 1);
    const started = startDueTurns(second.queue, 1.07, true);
    expect(started.due).toHaveLength(1);
    expect(started.due[0].startAt).toBeCloseTo(1 + START_DELAY_S + REPEAT_S, CLOSE_DIGITS);
    const third = takeTurn(started.queue, soundAsk('tap'), 1.07);
    expect(third.turn).not.toBeNull();
    expect(nextWaitingStart(third.queue, 1.07)).toBeCloseTo(started.due[0].startAt + REPEAT_S, CLOSE_DIGITS);
  });

  it('starts different own-line sounds asked for at the same moment together', () => {
    const queue = takeTurnsAt([soundAsk('arrive'), soundAsk('areaBeaten', '3'), soundAsk('areaBeaten', '1')], 4);
    const { due } = startDueTurns(queue, 4, true);
    expect(due).toHaveLength(3);
    for (const turn of due) expect(turn.startAt).toBe(4 + START_DELAY_S);
  });

  it('does not make the same sound asked for 0.1 s later wait', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 1);
    const second = playAsk(first.queue, soundAsk('tap'), 1.1);
    expect(second.due.map((turn) => turn.startAt)).toEqual([1.1 + START_DELAY_S]);
  });
});

describe('dropWaitingTurns (issue #165)', () => {
  const queue: SoundQueue = [
    startedTurn('find', 1, 1, 'common'),
    startedTurn('tap', 1, null),
    waitingTurn('find', 2, 1, 'rare'),
    waitingTurn('find', 3, 2, 'common'),
    waitingTurn('tap', 1.04, null),
    waitingTurn('arrive', 1.5, 1),
  ];

  it("drops only the owner's waiting turns, keeping other owners', ownerless and started turns", () => {
    expect(dropWaitingTurns(queue, 1)).toEqual([queue[0], queue[1], queue[3], queue[4]]);
  });

  it('drops every waiting turn when no owner is given', () => {
    expect(dropWaitingTurns(queue)).toEqual([queue[0], queue[1]]);
  });
});

describe('startDueTurns (issue #165)', () => {
  const queue: SoundQueue = [
    waitingTurn('tap', 1.49),
    waitingTurn('snack', 1.4, null, '0'),
    startedTurn('dash', 1),
    waitingTurn('arrive', 1.4, 3),
    waitingTurn('find', 2.98, null, 'common'),
    waitingTurn('lastThree', 1.45),
  ];

  it('starts every waiting turn whose start is at most the start delay away, in start order, ties in ask order', () => {
    const { due } = startDueTurns(queue, 1.5, true);
    expect(due.map((turn) => turn.id)).toEqual(['snack', 'arrive', 'tap']);
    expect(due.map((turn) => turn.startAt)).toEqual([1.5, 1.5, 1.49 + START_DELAY_S]);
    for (const turn of due) expect(turn.started).toBe(true);
  });

  it('marks the due turns started in the queue and leaves the rest as they were', () => {
    const started = startDueTurns(queue, 1.5, true).queue;
    expect(started.map((turn) => turn.started)).toEqual([true, true, true, true, false, false]);
    expect(started[2]).toBe(queue[2]);
    expect(started[4]).toBe(queue[4]);
    expect(started[5]).toBe(queue[5]);
  });

  it('starts nothing when no turn is due', () => {
    const { queue: after, due } = startDueTurns(queue, 1, true);
    expect(due).toEqual([]);
    expect(after).toEqual(queue);
  });

  it('never starts a turn before now, and starts an overdue turn at now', () => {
    const { due } = startDueTurns([waitingTurn('arrive', 1), waitingTurn('snack', 1, null, '2')], 5, true);
    expect(due.map((turn) => turn.startAt)).toEqual([5, 5]);
    for (const turn of due) expect(turn.endsAt).toBe(5 + soundVersion(turn.id, turn.version).seconds);
  });

  it('starts nothing while the clock is not running, and gives back the same queue', () => {
    const paused = startDueTurns(queue, 1.5, false);
    expect(paused.due).toEqual([]);
    expect(paused.queue).toBe(queue);
  });
});

/** What the player does for one ask while the clock is paused: takes its turn at `now`, and starts none. */
function askWhilePaused(queue: SoundQueue, ask: SoundAsk, now: number): SoundQueue {
  const taken = takeTurn(queue, ask, now);
  const started = startDueTurns(taken.queue, now, false);
  expect(started.due).toEqual([]);
  return started.queue;
}

describe('a turn asked for while the clock is paused (issue #165)', () => {
  it('never starts once its owner drops it', () => {
    let queue = askWhilePaused(EMPTY_SOUND_QUEUE, soundAsk('arrive', ONLY_VERSION, 7), 1);
    queue = askWhilePaused(queue, soundAsk('snack', '0', 7), 1);
    queue = askWhilePaused(queue, soundAsk('find', 'common', 8), 1);
    const dropped = dropWaitingTurns(queue, 7);
    const resumed = startDueTurns(dropped, 1, true);
    const { starts } = pumpAll(resumed.queue, 1, onTime);
    const owners = [...resumed.due, ...starts.map(({ turn }) => turn)].map((turn) => turn.owner);
    expect(owners).toEqual([8]);
  });

  for (const resumeNow of [1.01, 1.5]) {
    it(`starts when the clock runs again at ${resumeNow}, keeping the snack, find and repeat spacing`, () => {
      const tap = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 1);
      let queue = askWhilePaused(tap.queue, soundAsk('tap'), 1.01);
      queue = askWhilePaused(queue, soundAsk('snack', '0', 1), 1.01);
      queue = askWhilePaused(queue, soundAsk('snack', '1', 2), 1.01);
      queue = askWhilePaused(queue, soundAsk('find', 'common', 3), 1.01);
      queue = askWhilePaused(queue, soundAsk('find', 'common', 4), 1.01);
      const resumed = startDueTurns(queue, resumeNow, true);
      const pumped = pumpAll(resumed.queue, resumeNow, onTime);
      const starts = [...resumed.due.map((turn) => ({ turn, now: resumeNow })), ...pumped.starts];
      expect(starts).toHaveLength(5);
      for (const { turn, now } of starts) expect(turn.startAt).toBeGreaterThanOrEqual(now);
      expect(startOf(starts, 'tap', null).startAt).toBeCloseTo(Math.max(tap.due[0].startAt + REPEAT_S, resumeNow), CLOSE_DIGITS);
      const firstSnack = startOf(starts, 'snack', 1, '0');
      expect(firstSnack.startAt).toBeCloseTo(Math.max(1.01 + START_DELAY_S, resumeNow), CLOSE_DIGITS);
      expect(startOf(starts, 'snack', 2, '1').startAt).toBeCloseTo(firstSnack.startAt + SNACK_GAP_S, CLOSE_DIGITS);
      const firstFind = startOf(starts, 'find', 3, 'common');
      expect(firstFind.startAt).toBeCloseTo(Math.max(1.01 + START_DELAY_S, resumeNow), CLOSE_DIGITS);
      expect(startOf(starts, 'find', 4, 'common').startAt).toBeGreaterThanOrEqual(firstFind.endsAt - SLACK_S);
    });
  }
});

describe('nextWaitingStart (issue #165)', () => {
  it('is undefined when no turn waits', () => {
    expect(nextWaitingStart(EMPTY_SOUND_QUEUE, 0)).toBeUndefined();
    expect(nextWaitingStart([startedTurn('tap', 1)], 0)).toBeUndefined();
  });

  it('is the earliest waiting start', () => {
    const queue = [startedTurn('tap', 0.5), waitingTurn('find', 2.98, null, 'rare'), waitingTurn('snack', 1.98, null, '1')];
    expect(nextWaitingStart(queue, 1)).toBeCloseTo(2, CLOSE_DIGITS);
  });

  it('counts from the real start of a turn that started late', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('snack', '0'), 1);
    const second = playAsk(first.queue, soundAsk('snack', '1'), 1);
    expect(nextWaitingStart(second.queue, 1)).toBeCloseTo(1 + START_DELAY_S + SNACK_GAP_S, CLOSE_DIGITS);
    const third = playAsk(second.queue, soundAsk('snack', '2'), 1);
    const late = startDueTurns(third.queue, 1.5, true);
    expect(late.due.map((turn) => turn.startAt)).toEqual([1.5]);
    expect(nextWaitingStart(late.queue, 1.5)).toBeCloseTo(1.5 + SNACK_GAP_S, CLOSE_DIGITS);
  });
});

describe('pumpWaitMs (issue #165)', () => {
  it('is null when no turn waits', () => {
    expect(pumpWaitMs(EMPTY_SOUND_QUEUE, true, 0)).toBeNull();
    expect(pumpWaitMs([startedTurn('tap', 1)], true, 0)).toBeNull();
  });

  it('is null while the clock is not running, even with turns waiting', () => {
    expect(pumpWaitMs([waitingTurn('snack', 2, null, '1')], false, 0)).toBeNull();
  });

  it('waits until the next waiting turn falls due', () => {
    const queue = [startedTurn('tap', 0.5), waitingTurn('find', 2.98, null, 'rare'), waitingTurn('snack', 1.98, null, '1')];
    expect(pumpWaitMs(queue, true, 1)).toBeCloseTo((2 - START_DELAY_S - 1) * 1000, CLOSE_DIGITS - 3);
  });

  it('never waits less than PUMP_FLOOR_MS, even for a turn already due or past', () => {
    expect(pumpWaitMs([waitingTurn('snack', 1, null, '1')], true, 1)).toBe(PUMP_FLOOR_MS);
    expect(pumpWaitMs([waitingTurn('snack', 1, null, '1')], true, 50)).toBe(PUMP_FLOOR_MS);
  });

  it('is never 0', () => {
    const dueNow = waitingTurn('snack', 1, null, '1');
    expect(pumpWaitMs([dueNow], true, 1)).toBeGreaterThan(0);
    expect(PUMP_FLOOR_MS).toBeGreaterThan(0);
  });
});

describe('pruning (issue #165)', () => {
  it('drops a started turn once it has rung out and no longer holds back an ask', () => {
    const tap = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 0);
    const arrive = takeTurn(tap.queue, soundAsk('arrive'), 0.5);
    expect(arrive.queue).toEqual([arrive.turn]);
  });

  it('keeps a started turn that is still ringing', () => {
    const find = playAsk(EMPTY_SOUND_QUEUE, soundAsk('find', 'common'), 0);
    const tap = takeTurn(find.queue, soundAsk('tap'), 0.5);
    expect(tap.queue).toHaveLength(2);
  });

  it('keeps a started snack for the snack gap even once it has rung out', () => {
    const queue: SoundQueue = [{ ...startedTurn('snack', 1, null, '0'), endsAt: 1.01 }];
    expect(takeTurn(queue, soundAsk('tap'), 1.05).queue).toHaveLength(2);
    expect(takeTurn(queue, soundAsk('tap'), 1.09).queue).toHaveLength(1);
  });

  it('never drops a waiting turn', () => {
    const queue: SoundQueue = [waitingTurn('arrive', 0)];
    expect(takeTurn(queue, soundAsk('tap'), 10).queue).toHaveLength(2);
  });
});

describe('a late pump (issue #165)', () => {
  it('starts the next snack late and the one after it a full snack gap after that real start', () => {
    let queue: SoundQueue = EMPTY_SOUND_QUEUE;
    const firstDue: StartedTurn[] = [];
    for (const version of ['0', '1', '2']) {
      const step = playAsk(queue, soundAsk('snack', version), 1);
      queue = step.queue;
      firstDue.push(...step.due);
    }
    expect(firstDue.map((turn) => [turn.version, turn.startAt])).toEqual([['0', 1 + START_DELAY_S]]);
    const late = startDueTurns(queue, 1.5, true);
    expect(late.due.map((turn) => [turn.version, turn.startAt])).toEqual([['1', 1.5]]);
    expect(nextWaitingStart(late.queue, 1.5)).toBeCloseTo(1.5 + SNACK_GAP_S, CLOSE_DIGITS);
    const { starts } = pumpAll(late.queue, 1.5, onTime);
    expect(starts.map(({ turn }) => turn.version)).toEqual(['2']);
    expect(starts[0].turn.startAt).toBeCloseTo(1.5 + SNACK_GAP_S, CLOSE_DIGITS);
  });

  it('never overlaps 3 finds of the same rarity, each starting after the last really ends', () => {
    const queue = takeTurnsAt([soundAsk('find', 'rare', 0), soundAsk('find', 'rare', 1), soundAsk('find', 'rare', 2)], 1);
    const { starts } = pumpAll(queue, 1, () => 0.3);
    expect(starts.map(({ turn }) => turn.owner)).toEqual([0, 1, 2]);
    for (let i = 1; i < starts.length; i++) expect(starts[i].turn.startAt).toBeGreaterThanOrEqual(starts[i - 1].turn.endsAt);
    expect(starts[1].turn.startAt).toBeGreaterThan(starts[0].turn.endsAt);
  });

  it('keeps 60 ms between a tap that started late and the next tap', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 1);
    const second = playAsk(first.queue, soundAsk('tap'), 1);
    const late = startDueTurns(second.queue, 1.5, true);
    expect(late.due.map((turn) => turn.startAt)).toEqual([1.5]);
    const third = playAsk(late.queue, soundAsk('tap'), 1.5);
    expect(third.due).toEqual([]);
    const { starts } = pumpAll(third.queue, 1.5, onTime);
    expect(starts).toHaveLength(1);
    expect(starts[0].turn.startAt).toBeCloseTo(1.5 + REPEAT_S, CLOSE_DIGITS);
  });

  it('starts the exit only once the last of 3 last snacks started late has really rung out', () => {
    const queue = takeTurnsAt([soundAsk('lastThree', ONLY_VERSION, 0), soundAsk('lastThree', ONLY_VERSION, 1), soundAsk('lastThree', ONLY_VERSION, 2), soundAsk('exitOpens')], 5);
    const { starts } = pumpAll(queue, 5, () => 0.25);
    const lastSnack = startOf(starts, 'lastThree', 2);
    expect(lastSnack.startAt).toBeGreaterThan(5 + START_DELAY_S + 2 * SNACK_GAP_S);
    expect(startOf(starts, 'exitOpens', null).startAt).toBeGreaterThanOrEqual(lastSnack.endsAt);
  });
});

/** A fixed mix of asks, one per step, taken 3 to a moment. */
const MIXED_ASKS: readonly SoundAsk[] = [
  soundAsk('tap', ONLY_VERSION, 1),
  soundAsk('snack', '0', 1),
  soundAsk('find', 'common', 2),
  soundAsk('tap', ONLY_VERSION, 2),
  soundAsk('lastThree', ONLY_VERSION, null),
  soundAsk('find', 'rare', 1),
  soundAsk('arrive', ONLY_VERSION, 1),
  soundAsk('tap', ONLY_VERSION, null),
  soundAsk('snack', '1', 2),
  soundAsk('dash', ONLY_VERSION, 1),
  soundAsk('find', 'common', null),
  soundAsk('areaBeaten', '3', 2),
  soundAsk('dash', ONLY_VERSION, 2),
];

/** Counts the waiting own-line turns of each sound and version in `queue`. */
function countWaitingOwnTurns(queue: SoundQueue): Map<string, number> {
  const counts = new Map<string, number>();
  for (const turn of queue) {
    if (turn.started || soundLine(turn.id) !== 'own') continue;
    const key = repeatKey(turn.id, turn.version);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Checks that the starts of each sound and version are at least the repeat limit apart. */
function expectRepeatGaps(starts: readonly StartedTurn[]): void {
  const startsByKey = new Map<string, number[]>();
  for (const turn of starts) {
    const key = repeatKey(turn.id, turn.version);
    startsByKey.set(key, [...(startsByKey.get(key) ?? []), turn.startAt]);
  }
  for (const times of startsByKey.values()) {
    const sorted = [...times].sort((first, second) => first - second);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(REPEAT_S - SLACK_S);
  }
}

/** Checks that no two finds in `starts` play at once. */
function expectNoFindOverlap(starts: readonly StartedTurn[]): void {
  const finds = starts.filter((turn) => soundLine(turn.id) === 'find').sort((first, second) => first.startAt - second.startAt);
  for (let i = 1; i < finds.length; i++) expect(finds[i].startAt).toBeGreaterThanOrEqual(finds[i - 1].endsAt - SLACK_S);
}

describe('a fixed mix of asks (issue #165)', () => {
  it('keeps every queue rule', () => {
    let queue: SoundQueue = EMPTY_SOUND_QUEUE;
    const starts: StartedTurn[] = [];
    for (let i = 0; i < 80; i++) {
      const ask = MIXED_ASKS[i % MIXED_ASKS.length];
      const now = Math.floor(i / 3) * 0.03;
      if (i % 17 === 16) queue = dropWaitingTurns(queue, 2);
      const step = playAsk(queue, ask, now);
      queue = step.queue;
      starts.push(...step.due);
      if (soundLine(ask.id) !== 'own') expect(step.turn).not.toBeNull();
      for (const turn of step.due) {
        expect(turn.startAt).toBeGreaterThanOrEqual(now);
        expect(turn.startAt).toBeLessThanOrEqual(now + START_DELAY_S + SLACK_S);
      }
      for (const count of countWaitingOwnTurns(queue).values()) expect(count).toBeLessThanOrEqual(1);
    }
    starts.push(...pumpAll(queue, 80 * 0.01, onTime).starts.map(({ turn }) => turn));
    expect(starts.length).toBeGreaterThan(40);
    expectRepeatGaps(starts);
    expectNoFindOverlap(starts);
  });
});

/** One ask in a trip: the ask, given an owner of its own, when it was asked for, and whether it got a turn. */
interface TripAsk {
  readonly ask: SoundAsk;
  readonly askedAt: number;
  readonly turned: boolean;
}

/** Every ask in a trip, by owner, and every start, with the time of the pump or ask that made it. */
interface TripRun {
  readonly asks: readonly TripAsk[];
  readonly starts: readonly PumpedStart[];
}

/** The asks made at the trip's first moment: a crowd of snacks, finds and own-line sounds, and the exit. */
const TRIP_FIRST_ASKS: readonly (readonly [SoundId, string])[] = [
  ['snack', '0'],
  ['snack', '1'],
  ['snack', '2'],
  ['lastThree', ONLY_VERSION],
  ['lastThree', ONLY_VERSION],
  ['lastThree', ONLY_VERSION],
  ['exitOpens', ONLY_VERSION],
  ['find', 'common'],
  ['find', 'common'],
  ['find', 'rare'],
  ['tap', ONLY_VERSION],
  ['tap', ONLY_VERSION],
  ['tap', ONLY_VERSION],
  ['dash', ONLY_VERSION],
  ['dash', ONLY_VERSION],
];

/** How many of the first wakes also ask for a tap and a snack. */
const TRIP_ASKING_WAKES = 4;

/** Seconds late the pump wakes, each tried on every wake and then mixed wake by wake. */
const LATENESSES_S: readonly number[] = [0, 0.001, 0.019, 0.021, 0.05, 0.081, 0.25, 1, 5];

/** A trip in progress: its queue, the clock, and every ask and start so far. */
interface TripState {
  queue: SoundQueue;
  now: number;
  readonly asks: TripAsk[];
  readonly starts: PumpedStart[];
}

/** Starts the trip's turns due now, as the player does, and checks none is left due. */
function startTripDue(trip: TripState): void {
  const started = startDueTurns(trip.queue, trip.now, true);
  trip.queue = started.queue;
  for (const turn of started.due) trip.starts.push({ turn, now: trip.now });
  expect(startDueTurns(trip.queue, trip.now, true).due).toEqual([]);
}

/** Asks for version `version` of sound `id` now, owned by a new owner, then starts the turns due, as the player does. */
function askInTrip(trip: TripState, id: SoundId, version: string): void {
  const ask = soundAsk(id, version, trip.asks.length);
  const taken = takeTurn(trip.queue, ask, trip.now);
  trip.asks.push({ ask, askedAt: trip.now, turned: taken.turn !== null });
  trip.queue = taken.queue;
  startTripDue(trip);
  for (const count of countWaitingOwnTurns(trip.queue).values()) expect(count).toBeLessThanOrEqual(1);
}

/** Plays a trip's asks and pumps, the pump waking `lateS(wake)` seconds late, until no turn waits. */
function runTrip(lateS: (wake: number) => number): TripRun {
  const trip: TripState = { queue: EMPTY_SOUND_QUEUE, now: 1, asks: [], starts: [] };
  for (const [id, version] of TRIP_FIRST_ASKS) askInTrip(trip, id, version);
  for (let wake = 0; wake < MAX_WAKES; wake++) {
    const next = nextWaitingStart(trip.queue, trip.now);
    if (next === undefined) return { asks: trip.asks, starts: trip.starts };
    trip.now = Math.max(trip.now, next - START_DELAY_S + SLACK_S) + lateS(wake);
    startTripDue(trip);
    if (wake >= TRIP_ASKING_WAKES) continue;
    askInTrip(trip, 'tap', ONLY_VERSION);
    askInTrip(trip, 'snack', String(wake % 3));
  }
  throw new Error('soundQueue.test: the trip never emptied the queue');
}

/** Checks every queue rule over trip `run`; snack-line starts exactly the snack gap apart when `onTimeGaps`. */
function expectTripRules(run: TripRun, onTimeGaps: boolean): void {
  const owners = run.starts.map(({ turn }) => turn.owner);
  expect(new Set(owners).size).toBe(owners.length);
  const turnedOwners = run.asks.flatMap((trip, owner) => (trip.turned ? [owner] : []));
  expect([...owners].sort((first, second) => (first ?? 0) - (second ?? 0))).toEqual(turnedOwners);
  for (const trip of run.asks) if (soundLine(trip.ask.id) !== 'own') expect(trip.turned).toBe(true);
  const startByOwner = new Map(run.starts.map(({ turn }) => [turn.owner ?? -1, turn]));
  for (const { turn, now } of run.starts) {
    expect(turn.startAt).toBeGreaterThanOrEqual(now);
    expect(turn.startAt).toBeGreaterThanOrEqual(run.asks[turn.owner ?? -1].askedAt + START_DELAY_S - SLACK_S);
  }
  const snackLine = turnedOwners.filter((owner) => soundLine(run.asks[owner].ask.id) === 'snack').map((owner) => startByOwner.get(owner) as StartedTurn);
  expect(snackLine.length).toBeGreaterThan(TRIP_ASKING_WAKES);
  for (let i = 1; i < snackLine.length; i++) {
    const gap = snackLine[i].startAt - snackLine[i - 1].startAt;
    if (onTimeGaps) expect(gap).toBeCloseTo(SNACK_GAP_S, CLOSE_DIGITS);
    else expect(gap).toBeGreaterThanOrEqual(SNACK_GAP_S - SLACK_S);
  }
  const startedTurns = run.starts.map(({ turn }) => turn);
  expectRepeatGaps(startedTurns);
  expectNoFindOverlap(startedTurns);
  for (const exit of startedTurns.filter((turn) => turn.id === 'exitOpens')) {
    for (const snack of snackLine.filter((turn) => (turn.owner ?? 0) < (exit.owner ?? 0))) expect(exit.startAt).toBeGreaterThanOrEqual(snack.endsAt - SLACK_S);
  }
}

describe('every queue rule, however late the pump wakes (issue #165)', () => {
  for (const lateness of LATENESSES_S) {
    it(`keeps every rule with the pump ${lateness} s late`, () => {
      expectTripRules(
        runTrip(() => lateness),
        lateness === 0,
      );
    });
  }

  it('keeps every rule with the pump late by a different amount each wake', () => {
    expectTripRules(
      runTrip((wake) => LATENESSES_S[wake % LATENESSES_S.length]),
      false,
    );
  });
});
