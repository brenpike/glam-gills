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
  type SoundTurn,
} from './soundQueue';
import { ONLY_VERSION, repeatKey, SOUND_LEVELS, SOUNDS, soundVersion, type SoundId } from './sounds';

const START_DELAY_S = SOUND_LEVELS.startDelayS;
const REPEAT_S = SOUND_LEVELS.repeatS;
const SNACK_GAP_S = SOUND_LEVELS.snackGapS;
const CLOSE_DIGITS = 9;
const SLACK_S = 1e-9;

function soundAsk(id: SoundId, version: string = ONLY_VERSION, owner: number | null = null): SoundAsk {
  return { id, version, owner };
}

function waitingTurn(id: SoundId, startAt: number, owner: number | null = null, version: string = ONLY_VERSION): SoundTurn {
  return { id, version, owner, startAt, endsAt: startAt + soundVersion(id, version).seconds, started: false };
}

function startedTurn(id: SoundId, startAt: number, owner: number | null = null, version: string = ONLY_VERSION): SoundTurn {
  return { ...waitingTurn(id, startAt, owner, version), started: true };
}

/** Takes the turn of each ask in order at `now`, without starting any; the turns, none null. */
function takeTurnsAt(asks: readonly SoundAsk[], now: number): { queue: SoundQueue; turns: SoundTurn[] } {
  let queue: SoundQueue = EMPTY_SOUND_QUEUE;
  const turns: SoundTurn[] = [];
  for (const ask of asks) {
    const taken = takeTurn(queue, ask, now);
    if (taken.turn === null) throw new Error(`soundQueue.test: ${ask.id} got no turn`);
    queue = taken.queue;
    turns.push(taken.turn);
  }
  return { queue, turns };
}

/** What the player does for one ask: takes its turn at `now`, then starts the turns due at `now`. */
function playAsk(queue: SoundQueue, ask: SoundAsk, now: number): { queue: SoundQueue; turn: SoundTurn | null; due: readonly SoundTurn[] } {
  const taken = takeTurn(queue, ask, now);
  const started = startDueTurns(taken.queue, now);
  return { queue: started.queue, turn: taken.turn, due: started.due };
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

describe('the snack line (S3; issue #165)', () => {
  it('starts 3 snacks eaten at the same moment 80 ms apart, in ask order', () => {
    const { turns } = takeTurnsAt([soundAsk('snack', '0'), soundAsk('snack', '1'), soundAsk('snack', '2')], 1);
    expect(turns.map((turn) => turn.version)).toEqual(['0', '1', '2']);
    expect(turns[0].startAt).toBeCloseTo(1 + START_DELAY_S, CLOSE_DIGITS);
    expect(turns[1].startAt).toBeCloseTo(1 + START_DELAY_S + SNACK_GAP_S, CLOSE_DIGITS);
    expect(turns[2].startAt).toBeCloseTo(1 + START_DELAY_S + 2 * SNACK_GAP_S, CLOSE_DIGITS);
    for (const turn of turns) expect(turn.endsAt).toBeCloseTo(turn.startAt + soundVersion('snack', turn.version).seconds, CLOSE_DIGITS);
  });

  it('gives each of 3 last snacks eaten at the same moment a turn, 80 ms apart', () => {
    const { turns } = takeTurnsAt([soundAsk('lastThree'), soundAsk('lastThree'), soundAsk('lastThree')], 2);
    expect(turns).toHaveLength(3);
    expect(turns[1].startAt - turns[0].startAt).toBeCloseTo(SNACK_GAP_S, CLOSE_DIGITS);
    expect(turns[2].startAt - turns[1].startAt).toBeCloseTo(SNACK_GAP_S, CLOSE_DIGITS);
  });

  it('puts a snack and a last-3 twinkle in the same line', () => {
    const { turns } = takeTurnsAt([soundAsk('snack', '4'), soundAsk('lastThree')], 2);
    expect(turns[1].startAt - turns[0].startAt).toBeCloseTo(SNACK_GAP_S, CLOSE_DIGITS);
  });
});

describe('the find line (S4; issue #165)', () => {
  it('gives 2 finds at the same moment turns, the second starting as the first ends', () => {
    const { turns } = takeTurnsAt([soundAsk('find', 'common'), soundAsk('find', 'common')], 1);
    expect(turns).toHaveLength(2);
    expect(turns[0].startAt).toBeCloseTo(1 + START_DELAY_S, CLOSE_DIGITS);
    expect(turns[1].startAt).toBe(turns[0].endsAt);
  });

  it('makes a find asked for while a find plays wait for its end', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('find', 'common'), 0);
    expect(first.due).toHaveLength(1);
    const second = playAsk(first.queue, soundAsk('find', 'rare'), 0.5);
    expect(second.turn?.startAt).toBe(first.turn?.endsAt);
    expect(second.due).toHaveLength(0);
  });

  it("frees a dropped waiting find's slot", () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('find', 'common', 1), 0);
    const waiting = playAsk(first.queue, soundAsk('find', 'legendary', 2), 0.1);
    expect(waiting.turn?.started).toBe(false);
    const dropped = dropWaitingTurns(waiting.queue, 2);
    const third = takeTurn(dropped, soundAsk('find', 'rare', 1), 0.2);
    expect(third.turn?.startAt).toBe(first.turn?.endsAt);
  });
});

describe('the repeat limit on own-line sounds (S13; issue #165)', () => {
  it('starts 2 taps at the same moment 60 ms apart and gives a 3rd no turn', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 1);
    const second = playAsk(first.queue, soundAsk('tap'), 1);
    expect(second.turn?.startAt).toBeCloseTo(1 + START_DELAY_S + REPEAT_S, CLOSE_DIGITS);
    expect(second.due).toHaveLength(0);
    const third = takeTurn(second.queue, soundAsk('tap'), 1);
    expect(third.turn).toBeNull();
    expect(third.queue).toHaveLength(2);
  });

  it('gives a new tap a turn once the waiting tap has started', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 1);
    const second = playAsk(first.queue, soundAsk('tap'), 1);
    const started = startDueTurns(second.queue, 1.07);
    expect(started.due.map((turn) => turn.startAt)).toEqual([second.turn?.startAt]);
    const third = takeTurn(started.queue, soundAsk('tap'), 1.07);
    expect(third.turn).not.toBeNull();
    expect(third.turn?.startAt).toBeCloseTo((second.turn?.startAt ?? 0) + REPEAT_S, CLOSE_DIGITS);
  });

  it('starts different own-line sounds asked for at the same moment together', () => {
    const { turns } = takeTurnsAt([soundAsk('arrive'), soundAsk('areaBeaten', '3'), soundAsk('areaBeaten', '1')], 4);
    for (const turn of turns) expect(turn.startAt).toBe(4 + START_DELAY_S);
  });

  it('does not make the same sound asked for 0.1 s later wait', () => {
    const first = playAsk(EMPTY_SOUND_QUEUE, soundAsk('tap'), 1);
    const second = playAsk(first.queue, soundAsk('tap'), 1.1);
    expect(second.turn?.startAt).toBe(1.1 + START_DELAY_S);
    expect(second.due).toHaveLength(1);
  });
});

describe('dropWaitingTurns (issue #165)', () => {
  const queue: SoundQueue = [
    startedTurn('find', 1, 1, 'common'),
    startedTurn('tap', 1, null),
    waitingTurn('find', 2, 1, 'rare'),
    waitingTurn('find', 3, 2, 'common'),
    waitingTurn('tap', 1.06, null),
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
    waitingTurn('tap', 1.51),
    waitingTurn('snack', 1.5, null, '0'),
    startedTurn('dash', 1),
    waitingTurn('arrive', 1.5, 3),
    waitingTurn('find', 3, null, 'common'),
    waitingTurn('lastThree', 1.53),
  ];

  it('starts every waiting turn whose start is at most the start delay away, in start order, ties in ask order', () => {
    const { due } = startDueTurns(queue, 1.5);
    expect(due.map((turn) => turn.id)).toEqual(['snack', 'arrive', 'tap']);
    for (const turn of due) expect(turn.started).toBe(true);
  });

  it('marks the due turns started in the queue and leaves the rest as they were', () => {
    const started = startDueTurns(queue, 1.5).queue;
    expect(started.map((turn) => turn.started)).toEqual([true, true, true, true, false, false]);
    expect(started.map((turn) => turn.startAt)).toEqual(queue.map((turn) => turn.startAt));
  });

  it('starts nothing when no turn is due', () => {
    const { queue: after, due } = startDueTurns(queue, 1);
    expect(due).toEqual([]);
    expect(after).toEqual(queue);
  });
});

describe('nextWaitingStart (issue #165)', () => {
  it('is undefined when no turn waits', () => {
    expect(nextWaitingStart(EMPTY_SOUND_QUEUE)).toBeUndefined();
    expect(nextWaitingStart([startedTurn('tap', 1)])).toBeUndefined();
  });

  it('is the earliest waiting start', () => {
    expect(nextWaitingStart([startedTurn('tap', 0.5), waitingTurn('find', 3, null, 'rare'), waitingTurn('snack', 2, null, '1')])).toBe(2);
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
    const queue = [startedTurn('tap', 0.5), waitingTurn('find', 3, null, 'rare'), waitingTurn('snack', 2, null, '1')];
    expect(pumpWaitMs(queue, true, 1)).toBeCloseTo((2 - START_DELAY_S - 1) * 1000, CLOSE_DIGITS - 3);
  });

  it('never waits less than PUMP_FLOOR_MS, even for a turn already due or past', () => {
    expect(pumpWaitMs([waitingTurn('snack', 1, null, '1')], true, 1)).toBe(PUMP_FLOOR_MS);
    expect(pumpWaitMs([waitingTurn('snack', 1, null, '1')], true, 50)).toBe(PUMP_FLOOR_MS);
  });

  it('is never 0', () => {
    const dueNow = waitingTurn('snack', 1 + START_DELAY_S, null, '1');
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
function expectRepeatGaps(starts: readonly SoundTurn[]): void {
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

describe('a fixed mix of asks (issue #165)', () => {
  it('keeps every queue rule', () => {
    let queue: SoundQueue = EMPTY_SOUND_QUEUE;
    const starts: SoundTurn[] = [];
    for (let i = 0; i < 80; i++) {
      const ask = MIXED_ASKS[i % MIXED_ASKS.length];
      const now = Math.floor(i / 3) * 0.03;
      if (i % 17 === 16) queue = dropWaitingTurns(queue, 2);
      const step = playAsk(queue, ask, now);
      queue = step.queue;
      starts.push(...step.due);
      if (soundLine(ask.id) !== 'own') expect(step.turn).not.toBeNull();
      if (step.turn !== null) expect(step.turn.startAt).toBeGreaterThanOrEqual(now + START_DELAY_S - SLACK_S);
      if (step.turn !== null && soundLine(ask.id) === 'own') {
        expect(step.turn.startAt - (now + START_DELAY_S)).toBeLessThanOrEqual(REPEAT_S + SLACK_S);
      }
      for (const count of countWaitingOwnTurns(queue).values()) expect(count).toBeLessThanOrEqual(1);
    }
    starts.push(...startDueTurns(queue, 1000).due);
    expect(starts.length).toBeGreaterThan(40);
    expectRepeatGaps(starts);
  });
});
