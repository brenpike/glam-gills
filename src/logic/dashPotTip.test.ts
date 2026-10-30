import { describe, expect, it } from 'vitest';
import { ALL_TREASURES } from './catalogue';
import {
  DASH_POT_TIP,
  DASH_POT_TIP_TEXT,
  closeDashPotTip,
  createDashPotTip,
  dashPotTipSeen,
  dashPotTipText,
  inThreatReach,
  knowsDashPots,
  nearSealedPot,
  stepDashPotTip,
  type DashPotTipInput,
  type DashPotTipState,
} from './dashPotTip';
import { PUNTING_POLE, movingHazardSpawn } from './movingHazards';
import type { PlacedFind } from './placement';
import type { PredatorState } from './predators';
import { createTrip, type TripEvent, type TripState } from './trip';
import { TILAPIA } from './tuning';
import { SURF, buildCanalZone, type Point } from './zone';

const LEGENDARY_ID = ALL_TREASURES.find((treasure) => treasure.rarity === 'legendary')!.id;
const COMMON_ID = ALL_TREASURES.find((treasure) => treasure.rarity === 'common')!.id;

const POT: PlacedFind = { id: LEGENDARY_ID, spotId: 'pot-spot', x: 1000, y: 400, container: true, sealed: true };
const FAR: Point = { x: 400, y: 400 };
const NEAR: Point = { x: POT.x - DASH_POT_TIP.nearPx, y: POT.y };

const BASE_TRIP = createTrip(buildCanalZone());
const BASE_PREDATOR = BASE_TRIP.encounter.predators[0];

/** A tilapia at `pos` in `phase`. */
function tilapiaAt(pos: Point, phase: PredatorState['phase'] = 'patrol'): PredatorState {
  return { ...BASE_PREDATOR, pos, phase };
}

/** A swimming canal trip with only `POT` placed and only `predators` in the water. */
function tripWith(predators: PredatorState[] = [], placed: PlacedFind[] = [POT]): TripState {
  return { ...BASE_TRIP, placed, encounter: { ...BASE_TRIP.encounter, predators } };
}

function input(overrides: Partial<DashPotTipInput> = {}): DashPotTipInput {
  return { trip: tripWith(), events: [], pos: FAR, dt: 1 / 60, ...overrides };
}

const DASH_NEEDED: TripEvent = { type: 'dashNeeded', id: POT.id, spotId: POT.spotId, at: { x: POT.x, y: POT.y } };
const BROKEN: TripEvent = { type: 'containerBroken', id: POT.id, spotId: POT.spotId, at: { x: POT.x, y: POT.y } };

const UNSEEN: DashPotTipState = { phase: 'unseen' };
const WAITING: DashPotTipState = { phase: 'waiting' };
const SHOWING: DashPotTipState = { phase: 'showing', leftS: DASH_POT_TIP.holdS, seen: false };
const SHOWN: DashPotTipState = { phase: 'showing', leftS: DASH_POT_TIP.holdS - 1, seen: true };
const DONE: DashPotTipState = { phase: 'done' };

describe('dashPotTipText', () => {
  it('names the Tail Dash key for the keyboard and the Dash button for touch', () => {
    expect(dashPotTipText('keyboard')).toBe('Tail Dash into the pot to break it! Press Space.');
    expect(dashPotTipText('touch')).toBe('Tail Dash into the pot to break it! Tap Dash.');
  });

  it('uses short, plain words (X6)', () => {
    for (const text of Object.values(DASH_POT_TIP_TEXT)) {
      expect(text.length).toBeLessThanOrEqual(50);
      for (const word of text.split(/\W+/)) expect(word.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('knowsDashPots and createDashPotTip', () => {
  it('a new save does not know, so the tip starts unseen', () => {
    const save = { dashPotTipSeen: false };
    expect(knowsDashPots(save)).toBe(false);
    expect(createDashPotTip(save)).toEqual(UNSEEN);
  });

  it('a save with the tip seen knows, so the tip starts done', () => {
    const save = { dashPotTipSeen: true };
    expect(knowsDashPots(save)).toBe(true);
    expect(createDashPotTip(save)).toEqual(DONE);
  });

  it('a banked Legendary alone does not count as knowing, so the tip starts unseen', () => {
    const hub = { banked: [COMMON_ID, LEGENDARY_ID], dashPotTipSeen: false };
    expect(knowsDashPots(hub)).toBe(false);
    expect(createDashPotTip(hub)).toEqual(UNSEEN);
  });
});

describe('dashPotTipSeen', () => {
  it('is true only once done, or showing after a step on screen', () => {
    expect(dashPotTipSeen(UNSEEN)).toBe(false);
    expect(dashPotTipSeen(WAITING)).toBe(false);
    expect(dashPotTipSeen(SHOWING)).toBe(false);
    expect(dashPotTipSeen(SHOWN)).toBe(true);
    expect(dashPotTipSeen(DONE)).toBe(true);
  });
});

describe('nearSealedPot', () => {
  it('is true within the near distance, edge inclusive', () => {
    expect(nearSealedPot([POT], NEAR)).toBe(true);
    expect(nearSealedPot([POT], { x: NEAR.x - 1, y: NEAR.y })).toBe(false);
  });

  it('ignores a broken pot and finds that are not sealed', () => {
    expect(nearSealedPot([{ ...POT, sealed: false }], { x: POT.x, y: POT.y })).toBe(false);
    expect(nearSealedPot([], { x: POT.x, y: POT.y })).toBe(false);
  });
});

describe('inThreatReach', () => {
  it('is false with no predator near and true within a patrolling predator lunge range, edge inclusive', () => {
    expect(inThreatReach(tripWith([]), FAR)).toBe(false);
    const edge = { x: FAR.x + TILAPIA.lungeRange, y: FAR.y };
    expect(inThreatReach(tripWith([tilapiaAt(edge)]), FAR)).toBe(true);
    expect(inThreatReach(tripWith([tilapiaAt({ x: edge.x + 1, y: edge.y })]), FAR)).toBe(false);
  });

  it('is true while any predator warns or strikes, however far away', () => {
    const far = { x: FAR.x + 2000, y: FAR.y };
    expect(inThreatReach(tripWith([tilapiaAt(far, 'telegraph')]), FAR)).toBe(true);
    expect(inThreatReach(tripWith([tilapiaAt(far, 'lunge')]), FAR)).toBe(true);
    expect(inThreatReach(tripWith([tilapiaAt(far, 'cooldown')]), FAR)).toBe(false);
  });

  it('is true near a moving hazard out of its rest, and false at rest or away from its sweep', () => {
    const pole = movingHazardSpawn('pole-0', PUNTING_POLE, FAR.x, 0);
    const restTime = PUNTING_POLE.restFor / 2;
    const warnTime = PUNTING_POLE.restFor + PUNTING_POLE.warnFor / 2;
    const withPole = (hazardTime: number): TripState => ({
      ...tripWith([]),
      encounter: { ...tripWith([]).encounter, movingHazards: [pole], hazardTime },
    });
    const under = { x: FAR.x, y: SURF + 20 };
    expect(inThreatReach(withPole(restTime), under)).toBe(false);
    expect(inThreatReach(withPole(warnTime), under)).toBe(true);
    expect(inThreatReach(withPole(warnTime), { x: FAR.x + 400, y: FAR.y })).toBe(false);
  });
});

describe('stepDashPotTip', () => {
  it('stays unseen away from every pot', () => {
    expect(stepDashPotTip(UNSEEN, input())).toEqual({ state: UNSEEN, cue: null });
  });

  it('shows on coming near a sealed pot, with the whole hold time', () => {
    expect(stepDashPotTip(UNSEEN, input({ pos: NEAR }))).toEqual({ state: SHOWING, cue: 'show' });
  });

  it('shows on the first bump of a pot without dashing, whichever comes first', () => {
    expect(stepDashPotTip(UNSEEN, input({ events: [DASH_NEEDED] }))).toEqual({ state: SHOWING, cue: 'show' });
  });

  it('waits while the axolotl is in a threat reach, then shows once it is out', () => {
    const threatened = tripWith([tilapiaAt({ x: NEAR.x + 10, y: NEAR.y })]);
    const first = stepDashPotTip(UNSEEN, input({ trip: threatened, pos: NEAR }));
    expect(first).toEqual({ state: WAITING, cue: null });
    const warning = tripWith([tilapiaAt({ x: 5000, y: 400 }, 'telegraph')]);
    expect(stepDashPotTip(WAITING, input({ trip: warning }))).toEqual({ state: WAITING, cue: null });
    expect(stepDashPotTip(WAITING, input())).toEqual({ state: SHOWING, cue: 'show' });
  });

  it('counts down while on screen, becomes seen, and hides once no time is left', () => {
    const next = stepDashPotTip(SHOWING, input({ dt: 1 }));
    expect(next).toEqual({ state: SHOWN, cue: null });
    expect(stepDashPotTip(next.state, input({ dt: DASH_POT_TIP.holdS }))).toEqual({ state: DONE, cue: 'hide' });
  });

  it('holds its time, and is not seen, while the HUD has no room for it (X10)', () => {
    expect(stepDashPotTip(SHOWING, input({ dt: 1, held: true }))).toEqual({ state: SHOWING, cue: null });
    expect(stepDashPotTip(SHOWN, input({ dt: 10, held: true }))).toEqual({ state: SHOWN, cue: null });
  });

  it('hides at once when a threat reaches the axolotl: done once seen, else waiting to show again', () => {
    const warning = tripWith([tilapiaAt({ x: 5000, y: 400 }, 'telegraph')]);
    expect(stepDashPotTip(SHOWN, input({ trip: warning }))).toEqual({ state: DONE, cue: 'hide' });
    expect(stepDashPotTip(SHOWING, input({ trip: warning }))).toEqual({ state: WAITING, cue: 'hide' });
    expect(stepDashPotTip(SHOWING, input({ trip: warning, held: true }))).toEqual({ state: WAITING, cue: 'hide' });
  });

  it('a pot broken first means the player knows: done with no tip, and a showing tip hides', () => {
    expect(stepDashPotTip(UNSEEN, input({ pos: NEAR, events: [BROKEN] }))).toEqual({ state: DONE, cue: null });
    expect(stepDashPotTip(WAITING, input({ events: [BROKEN] }))).toEqual({ state: DONE, cue: null });
    expect(stepDashPotTip(SHOWING, input({ events: [BROKEN] }))).toEqual({ state: DONE, cue: 'hide' });
  });

  it('never changes once done, near a pot or bumping one', () => {
    expect(stepDashPotTip(DONE, input({ pos: NEAR, events: [DASH_NEEDED] }))).toEqual({ state: DONE, cue: null });
  });

  it('does nothing on a paused step and nothing while not swimming, except hiding a showing tip', () => {
    expect(stepDashPotTip(UNSEEN, input({ pos: NEAR, dt: 0 }))).toEqual({ state: UNSEEN, cue: null });
    expect(stepDashPotTip(SHOWING, input({ dt: Number.NaN }))).toEqual({ state: SHOWING, cue: null });
    const banked = { ...tripWith(), phase: 'banked' as const };
    expect(stepDashPotTip(UNSEEN, input({ trip: banked, pos: NEAR }))).toEqual({ state: UNSEEN, cue: null });
    expect(stepDashPotTip(SHOWN, input({ trip: banked }))).toEqual({ state: DONE, cue: 'hide' });
    expect(stepDashPotTip(SHOWING, input({ trip: banked }))).toEqual({ state: WAITING, cue: 'hide' });
  });
});

describe('closeDashPotTip', () => {
  it('closes a showing tip for good and leaves any other state as it is', () => {
    expect(closeDashPotTip(SHOWING)).toEqual({ state: DONE, cue: 'hide' });
    expect(closeDashPotTip(UNSEEN)).toEqual({ state: UNSEEN, cue: null });
    expect(closeDashPotTip(DONE)).toEqual({ state: DONE, cue: null });
  });
});
