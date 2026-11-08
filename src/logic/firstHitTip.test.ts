import { describe, expect, it } from 'vitest';
import {
  FIRST_HIT_TIP,
  FIRST_HIT_TIP_PAGES,
  createFirstHitTip,
  firstHitTipPages,
  firstHitTipSeen,
  pressFirstHitTip,
  stepFirstHitTip,
  type FirstHitTipInput,
  type FirstHitTipState,
} from './firstHitTip';
import type { PredatorState } from './predators';
import { createTrip, type TripEvent, type TripState } from './trip';
import { LEGS } from './tuning';
import { buildCanalZone, type Point } from './zone';

const FAR: Point = { x: 400, y: 400 };
const LAST = FIRST_HIT_TIP_PAGES.length - 1;

const BASE_TRIP = createTrip(buildCanalZone());
const BASE_PREDATOR = BASE_TRIP.encounter.predators[0];

/** A tilapia at `pos` in `phase`. */
function tilapiaAt(pos: Point, phase: PredatorState['phase'] = 'patrol'): PredatorState {
  return { ...BASE_PREDATOR, pos, phase };
}

/** A swimming canal trip with only `predators` in the water and `protectedLeft` seconds of protected time. */
function tripWith(predators: PredatorState[] = [], protectedLeft = 0): TripState {
  const legs = { ...BASE_TRIP.encounter.legs, protectedLeft };
  return { ...BASE_TRIP, encounter: { ...BASE_TRIP.encounter, predators, legs } };
}

function input(overrides: Partial<FirstHitTipInput> = {}): FirstHitTipInput {
  return { trip: tripWith(), events: [], pos: FAR, dt: 1 / 60, ...overrides };
}

const HIT: TripEvent = { type: 'hit', sourceId: 'tilapia-0', leg: 0, from: { x: 0, y: 0 } };
const SHELL_BLOCK: TripEvent = { type: 'shellBlock', sourceId: 'tilapia-0', from: { x: 0, y: 0 } };
const WARNING = tripWith([tilapiaAt({ x: 5000, y: 400 }, 'telegraph')]);
const PROTECTED = tripWith([], LEGS.protectedTime);
const BANKED: TripState = { ...tripWith(), phase: 'banked' };

const UNSEEN: FirstHitTipState = { phase: 'unseen' };
const DONE: FirstHitTipState = { phase: 'done' };

function waiting(page: number): FirstHitTipState {
  return { phase: 'waiting', page };
}

function showing(page: number, leftS: number = FIRST_HIT_TIP.holdS, seen = false): FirstHitTipState {
  return { phase: 'showing', page, leftS, seen };
}

describe('firstHitTipPages', () => {
  it('has five pages in order with the game regrowth numbers', () => {
    expect(FIRST_HIT_TIP_PAGES).toEqual([
      'Your legs up top are your health!',
      'Lost legs grow back in about 35 seconds.',
      'Each snack takes about 5 seconds off!',
      'Regrowth Wearables grow legs back faster.',
      'Shell Wearables block one hit a trip!',
    ]);
    expect(firstHitTipPages()).toEqual(FIRST_HIT_TIP_PAGES);
  });

  it('follows a tuning override for its numbers', () => {
    const pages = firstHitTipPages({ regrowTime: 40, snackSpeedUp: 0.1 });
    expect(pages[1]).toBe('Lost legs grow back in about 40 seconds.');
    expect(pages[2]).toBe('Each snack takes about 4 seconds off!');
  });

  it('never says a snack takes off less than 1 second', () => {
    expect(firstHitTipPages({ regrowTime: 10, snackSpeedUp: 0.01 })[2]).toBe('Each snack takes about 1 seconds off!');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(FIRST_HIT_TIP_PAGES)).toBe(true);
    expect(Object.isFrozen(FIRST_HIT_TIP)).toBe(true);
  });

  it('keeps each page to 48 characters or fewer', () => {
    for (const page of FIRST_HIT_TIP_PAGES) expect(page.length).toBeLessThanOrEqual(48);
  });

  it('never uses a banned word (X1)', () => {
    for (const page of FIRST_HIT_TIP_PAGES) expect(page).not.toMatch(/\b(die|dead|killed|game over)\b/i);
  });
});

describe('createFirstHitTip', () => {
  it('starts unseen on a new save and done on a save with the tip seen', () => {
    expect(createFirstHitTip({ firstHitTipSeen: false })).toEqual(UNSEEN);
    expect(createFirstHitTip({ firstHitTipSeen: true })).toEqual(DONE);
  });
});

describe('firstHitTipSeen', () => {
  it('is true only once done, or showing the last page after a step on screen', () => {
    expect(firstHitTipSeen(UNSEEN)).toBe(false);
    expect(firstHitTipSeen(waiting(LAST))).toBe(false);
    expect(firstHitTipSeen(showing(0, 1, true))).toBe(false);
    expect(firstHitTipSeen(showing(LAST))).toBe(false);
    expect(firstHitTipSeen(showing(LAST, 1, true))).toBe(true);
    expect(firstHitTipSeen(DONE)).toBe(true);
  });
});

describe('stepFirstHitTip', () => {
  it('stays unseen with no hit, and a Shell block does not meet it', () => {
    expect(stepFirstHitTip(UNSEEN, input())).toEqual({ state: UNSEEN, cue: null });
    expect(stepFirstHitTip(UNSEEN, input({ events: [SHELL_BLOCK] }))).toEqual({ state: UNSEEN, cue: null });
  });

  it('a hit meets it at page 0, and it waits through protected time', () => {
    expect(stepFirstHitTip(UNSEEN, input({ trip: PROTECTED, events: [HIT] }))).toEqual({
      state: waiting(0),
      cue: null,
    });
    expect(stepFirstHitTip(waiting(0), input({ trip: PROTECTED }))).toEqual({ state: waiting(0), cue: null });
  });

  it('a hit meets it even off a swimming step, and it shows nothing there', () => {
    expect(stepFirstHitTip(UNSEEN, input({ trip: BANKED, events: [HIT] }))).toEqual({ state: waiting(0), cue: null });
  });

  it('shows its page once the axolotl swims free', () => {
    expect(stepFirstHitTip(UNSEEN, input({ events: [HIT] }))).toEqual({ state: showing(0), cue: 'show' });
    expect(stepFirstHitTip(waiting(2), input())).toEqual({ state: showing(2), cue: 'show' });
  });

  it('waits while a threat has the axolotl in reach', () => {
    const near = tripWith([tilapiaAt({ x: FAR.x + 10, y: FAR.y })]);
    expect(stepFirstHitTip(waiting(0), input({ trip: near }))).toEqual({ state: waiting(0), cue: null });
    expect(stepFirstHitTip(waiting(0), input({ trip: WARNING }))).toEqual({ state: waiting(0), cue: null });
  });

  it('waits while another tip is on screen (busy)', () => {
    expect(stepFirstHitTip(waiting(1), input({ busy: true }))).toEqual({ state: waiting(1), cue: null });
    expect(stepFirstHitTip(waiting(1), input({ busy: false }))).toEqual({ state: showing(1), cue: 'show' });
  });

  it('waits on a paused step and off a swimming step', () => {
    expect(stepFirstHitTip(waiting(0), input({ dt: 0 }))).toEqual({ state: waiting(0), cue: null });
    expect(stepFirstHitTip(waiting(0), input({ dt: Number.NaN }))).toEqual({ state: waiting(0), cue: null });
    expect(stepFirstHitTip(waiting(0), input({ dt: Number.POSITIVE_INFINITY }))).toEqual({
      state: waiting(0),
      cue: null,
    });
    expect(stepFirstHitTip(waiting(0), input({ trip: BANKED }))).toEqual({ state: waiting(0), cue: null });
  });

  it('counts down while on screen and becomes seen on the first such step', () => {
    expect(stepFirstHitTip(showing(0), input({ dt: 1 }))).toEqual({
      state: showing(0, FIRST_HIT_TIP.holdS - 1, true),
      cue: null,
    });
  });

  it('holds its time, and is not seen, while the HUD has no room for it (X10)', () => {
    expect(stepFirstHitTip(showing(0), input({ dt: 1, held: true }))).toEqual({ state: showing(0), cue: null });
    expect(stepFirstHitTip(showing(0, 1, true), input({ dt: 10, held: true }))).toEqual({
      state: showing(0, 1, true),
      cue: null,
    });
  });

  it('turns to the next page once no time is left', () => {
    expect(stepFirstHitTip(showing(0, 1, true), input({ dt: 1 }))).toEqual({ state: showing(1), cue: 'page' });
    expect(stepFirstHitTip(showing(LAST - 1), input({ dt: FIRST_HIT_TIP.holdS }))).toEqual({
      state: showing(LAST),
      cue: 'page',
    });
  });

  it('ends after the last page', () => {
    expect(stepFirstHitTip(showing(LAST, 1, true), input({ dt: 1 }))).toEqual({ state: DONE, cue: 'hide' });
  });

  it('keeps showing while busy', () => {
    expect(stepFirstHitTip(showing(0), input({ dt: 1, busy: true }))).toEqual({
      state: showing(0, FIRST_HIT_TIP.holdS - 1, true),
      cue: null,
    });
  });

  it('a threat hides it: waiting at the same page, or done once the last page was seen', () => {
    expect(stepFirstHitTip(showing(1, 2, true), input({ trip: WARNING }))).toEqual({ state: waiting(1), cue: 'hide' });
    expect(stepFirstHitTip(showing(LAST), input({ trip: WARNING }))).toEqual({ state: waiting(LAST), cue: 'hide' });
    expect(stepFirstHitTip(showing(LAST, 1, true), input({ trip: WARNING }))).toEqual({ state: DONE, cue: 'hide' });
  });

  it('protected time hides it', () => {
    expect(stepFirstHitTip(showing(2), input({ trip: PROTECTED }))).toEqual({ state: waiting(2), cue: 'hide' });
  });

  it('a hit or a Shell block hides it, even with protected time not started', () => {
    expect(stepFirstHitTip(showing(3), input({ events: [HIT] }))).toEqual({ state: waiting(3), cue: 'hide' });
    expect(stepFirstHitTip(showing(3), input({ events: [SHELL_BLOCK] }))).toEqual({ state: waiting(3), cue: 'hide' });
    expect(stepFirstHitTip(showing(LAST, 1, true), input({ events: [HIT] }))).toEqual({ state: DONE, cue: 'hide' });
  });

  it('leaving the swim hides it, even on a paused step', () => {
    expect(stepFirstHitTip(showing(1), input({ trip: BANKED }))).toEqual({ state: waiting(1), cue: 'hide' });
    expect(stepFirstHitTip(showing(LAST, 1, true), input({ trip: BANKED, dt: 0 }))).toEqual({
      state: DONE,
      cue: 'hide',
    });
  });

  it('does nothing on a paused swimming step while showing', () => {
    expect(stepFirstHitTip(showing(1), input({ dt: 0 }))).toEqual({ state: showing(1), cue: null });
    expect(stepFirstHitTip(showing(1), input({ dt: Number.NaN, trip: WARNING }))).toEqual({
      state: showing(1),
      cue: null,
    });
  });

  it('a hidden page shows again later from where it left off', () => {
    const hidden = stepFirstHitTip(showing(2, 1, true), input({ trip: WARNING }));
    expect(stepFirstHitTip(hidden.state, input())).toEqual({ state: showing(2), cue: 'show' });
  });

  it('never changes once done', () => {
    expect(stepFirstHitTip(DONE, input({ events: [HIT] }))).toEqual({ state: DONE, cue: null });
  });

  it('runs through every page to done', () => {
    let state = stepFirstHitTip(UNSEEN, input({ events: [HIT] })).state;
    const cues: (string | null)[] = [];
    for (let page = 0; page <= LAST; page += 1) {
      const step = stepFirstHitTip(state, input({ dt: FIRST_HIT_TIP.holdS }));
      cues.push(step.cue);
      state = step.state;
    }
    expect(cues).toEqual(['page', 'page', 'page', 'page', 'hide']);
    expect(state).toEqual(DONE);
  });
});

describe('pressFirstHitTip', () => {
  it('turns to the next page, or ends after the last', () => {
    expect(pressFirstHitTip(showing(0, 1, true))).toEqual({ state: showing(1), cue: 'page' });
    expect(pressFirstHitTip(showing(LAST))).toEqual({ state: DONE, cue: 'hide' });
  });

  it('leaves any other state as it is', () => {
    expect(pressFirstHitTip(UNSEEN)).toEqual({ state: UNSEEN, cue: null });
    expect(pressFirstHitTip(waiting(1))).toEqual({ state: waiting(1), cue: null });
    expect(pressFirstHitTip(DONE)).toEqual({ state: DONE, cue: null });
  });
});
