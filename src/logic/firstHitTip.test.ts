import { describe, expect, it } from 'vitest';
import {
  FIRST_HIT_TIP_BODY,
  FIRST_HIT_TIP_LINES,
  closeFirstHitTip,
  createFirstHitTip,
  firstHitTipCardRoom,
  firstHitTipLines,
  firstHitTipSeen,
  stepFirstHitTip,
  type FirstHitTipInput,
  type FirstHitTipState,
} from './firstHitTip';
import type { PredatorState } from './predators';
import { createTrip, type TripEvent, type TripState } from './trip';
import { LEGS } from './tuning';
import { buildCanalZone, type Point } from './zone';

const FAR: Point = { x: 400, y: 400 };

const BASE_TRIP = createTrip(buildCanalZone());
const BASE_PREDATOR = BASE_TRIP.encounter.predators[0];

/** A tilapia at `pos` in `phase`. */
function tilapiaAt(pos: Point, phase: PredatorState['phase'] = 'patrol'): PredatorState {
  return { ...BASE_PREDATOR, pos, phase };
}

/** A swimming canal trip with only `predators` in the water, `protectedLeft` seconds of protected time, and no fact card due. */
function tripWith(predators: PredatorState[] = [], protectedLeft = 0): TripState {
  const legs = { ...BASE_TRIP.encounter.legs, protectedLeft };
  return { ...BASE_TRIP, met: [], factCardsSeen: [], encounter: { ...BASE_TRIP.encounter, predators, legs } };
}

function input(overrides: Partial<FirstHitTipInput> = {}): FirstHitTipInput {
  return { trip: tripWith(), events: [], pos: FAR, dt: 1 / 60, ...overrides };
}

const HIT: TripEvent = { type: 'hit', sourceId: 'tilapia-0', leg: 0, from: { x: 0, y: 0 } };
const SHELL_BLOCK: TripEvent = { type: 'shellBlock', sourceId: 'tilapia-0', from: { x: 0, y: 0 } };
const NEAR = tripWith([tilapiaAt({ x: FAR.x + 10, y: FAR.y })]);
const WARNING = tripWith([tilapiaAt({ x: 5000, y: 400 }, 'telegraph')]);
const PROTECTED = tripWith([], LEGS.protectedTime);
const BANKED: TripState = { ...tripWith(), phase: 'banked' };
const CARD_DUE: TripState = { ...tripWith(), met: ['tilapia'], factCardsSeen: [] };
const CARD_SEEN: TripState = { ...tripWith(), met: ['tilapia'], factCardsSeen: ['tilapia'] };

const LEGS_RECT = { x: 16, y: 16, w: 200, h: 48 };

describe('firstHitTipLines', () => {
  it('has five lines in order with the game regrowth numbers', () => {
    expect(FIRST_HIT_TIP_LINES).toEqual([
      'Legs are your health!',
      'Lost legs grow back in 35 seconds.',
      'Each snack takes 5 seconds off!',
      'Regrowth Wearables speed it up!',
      'Shell Wearables block one hit!',
    ]);
    expect(firstHitTipLines()).toEqual(FIRST_HIT_TIP_LINES);
    expect(firstHitTipLines(LEGS)).toEqual(FIRST_HIT_TIP_LINES);
  });

  it('follows a tuning override for its numbers', () => {
    const lines = firstHitTipLines({ regrowTime: 40, snackSpeedUp: 0.1 });
    expect(lines[1]).toBe('Lost legs grow back in 40 seconds.');
    expect(lines[2]).toBe('Each snack takes 4 seconds off!');
  });

  it('says "1 second" for both numbers when they are 1', () => {
    const lines = firstHitTipLines({ regrowTime: 1, snackSpeedUp: 1 });
    expect(lines[1]).toBe('Lost legs grow back in 1 second.');
    expect(lines[2]).toBe('Each snack takes 1 second off!');
  });

  it('never says a snack takes off less than 1 second', () => {
    expect(firstHitTipLines({ regrowTime: 10, snackSpeedUp: 0.01 })[2]).toBe('Each snack takes 1 second off!');
  });

  it('is frozen, and the body joins the lines one per row', () => {
    expect(Object.isFrozen(FIRST_HIT_TIP_LINES)).toBe(true);
    expect(FIRST_HIT_TIP_BODY).toBe(FIRST_HIT_TIP_LINES.join('\n'));
  });

  it('never uses an X1 banned word or a CONTEXT avoid word', () => {
    const banned = /\b(die|dead|killed|game over|injury|wound|damage|healing|invulnerab\w*)\b/i;
    for (const line of FIRST_HIT_TIP_LINES) expect(line).not.toMatch(banned);
    expect(FIRST_HIT_TIP_BODY).not.toMatch(banned);
  });
});

describe('firstHitTipCardRoom', () => {
  it('starts HUD.gap below the legs panel and stops CARD.margin above the bottom', () => {
    expect(firstHitTipCardRoom(320, LEGS_RECT)).toEqual({ top: 76, availH: 228 });
    expect(firstHitTipCardRoom(440, LEGS_RECT)).toEqual({ top: 76, availH: 348 });
  });

  it('is never less than 0 tall', () => {
    expect(firstHitTipCardRoom(50, LEGS_RECT)).toEqual({ top: 76, availH: 0 });
  });
});

describe('createFirstHitTip', () => {
  it('starts unseen on a new save and done on a save with the tip seen', () => {
    expect(createFirstHitTip({ firstHitTipSeen: false })).toBe('unseen');
    expect(createFirstHitTip({ firstHitTipSeen: true })).toBe('done');
  });
});

describe('firstHitTipSeen', () => {
  it('is true only once done', () => {
    expect(firstHitTipSeen('unseen')).toBe(false);
    expect(firstHitTipSeen('waiting')).toBe(false);
    expect(firstHitTipSeen('done')).toBe(true);
  });
});

describe('stepFirstHitTip', () => {
  it('stays unseen with no hit, and a Shell block does not meet it', () => {
    expect(stepFirstHitTip('unseen', input())).toEqual({ state: 'unseen', show: false });
    expect(stepFirstHitTip('unseen', input({ events: [SHELL_BLOCK] }))).toEqual({ state: 'unseen', show: false });
  });

  it('a hit meets it, and it waits through protected time', () => {
    expect(stepFirstHitTip('unseen', input({ trip: PROTECTED, events: [HIT] }))).toEqual({
      state: 'waiting',
      show: false,
    });
    expect(stepFirstHitTip('waiting', input({ trip: PROTECTED }))).toEqual({ state: 'waiting', show: false });
  });

  it('a hit meets it even off a swimming step, and it shows nothing there', () => {
    expect(stepFirstHitTip('unseen', input({ trip: BANKED, events: [HIT] }))).toEqual({
      state: 'waiting',
      show: false,
    });
  });

  it('shows once the axolotl swims free, and stays waiting while it shows', () => {
    expect(stepFirstHitTip('unseen', input({ events: [HIT] }))).toEqual({ state: 'waiting', show: true });
    expect(stepFirstHitTip('waiting', input())).toEqual({ state: 'waiting', show: true });
    expect(stepFirstHitTip('waiting', input({ events: [SHELL_BLOCK] }))).toEqual({ state: 'waiting', show: true });
  });

  it('waits while a threat has the axolotl in reach', () => {
    expect(stepFirstHitTip('waiting', input({ trip: NEAR }))).toEqual({ state: 'waiting', show: false });
    expect(stepFirstHitTip('waiting', input({ trip: WARNING }))).toEqual({ state: 'waiting', show: false });
  });

  it('waits while a fact card is due', () => {
    expect(stepFirstHitTip('waiting', input({ trip: CARD_DUE }))).toEqual({ state: 'waiting', show: false });
    expect(stepFirstHitTip('waiting', input({ trip: CARD_SEEN }))).toEqual({ state: 'waiting', show: true });
  });

  it('waits on a paused step and off a swimming step', () => {
    expect(stepFirstHitTip('waiting', input({ dt: 0 }))).toEqual({ state: 'waiting', show: false });
    expect(stepFirstHitTip('waiting', input({ dt: -1 }))).toEqual({ state: 'waiting', show: false });
    expect(stepFirstHitTip('waiting', input({ dt: Number.NaN }))).toEqual({ state: 'waiting', show: false });
    expect(stepFirstHitTip('waiting', input({ dt: Number.POSITIVE_INFINITY }))).toEqual({
      state: 'waiting',
      show: false,
    });
    expect(stepFirstHitTip('waiting', input({ trip: BANKED }))).toEqual({ state: 'waiting', show: false });
  });

  it('never changes once done', () => {
    expect(stepFirstHitTip('done', input({ events: [HIT] }))).toEqual({ state: 'done', show: false });
    expect(stepFirstHitTip('done', input())).toEqual({ state: 'done', show: false });
  });
});

describe('closeFirstHitTip', () => {
  it('ends a waiting tip', () => {
    expect(closeFirstHitTip('waiting')).toBe('done');
  });

  it('leaves any other state as it is', () => {
    const others: FirstHitTipState[] = ['unseen', 'done'];
    for (const state of others) expect(closeFirstHitTip(state)).toBe(state);
  });
});
