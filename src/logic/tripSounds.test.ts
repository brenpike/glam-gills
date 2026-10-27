import { describe, expect, it } from 'vitest';
import { RARITIES, type Rarity } from './catalogue';
import type { DashPhase } from './tailDash';
import { NO_STARS } from './stars';
import { ONLY_VERSION, soundVersion } from './sounds';
import type { TripEvent } from './trip';
import {
  BANK_SOUND_MAX,
  NEW_TRIP_SOUNDS,
  allCollectedSound,
  areaBeatenSound,
  collectedSound,
  dashStateSound,
  tripEventSound,
  type SoundRequest,
  type TripSoundState,
} from './tripSounds';

const AT = { x: 10, y: 20 };

function pickedUp(rarity: Rarity): TripEvent {
  return { type: 'pickedUp', id: 'f1', spotId: 's1', at: AT, found: { id: 'f1', name: 'Shell', category: 'decoration', rarity } };
}

function banked(count: number): TripEvent {
  return { type: 'banked', ids: Array.from({ length: count }, (_, i) => `f${i}`) };
}

/** Every trip event that plays nothing in this slice, slice 2 and section 6 moments included. */
const SILENT_EVENTS: readonly TripEvent[] = [
  { type: 'telegraph', sourceId: 'tilapia-1' },
  { type: 'lunge', sourceId: 'tilapia-1', aim: AT },
  { type: 'shellBlock', sourceId: 'tilapia-1', from: AT },
  { type: 'bump', sourceId: 'tilapia-1', from: AT },
  { type: 'regrowStart', leg: 1 },
  { type: 'protectedEnd' },
  { type: 'containerBroken', id: 'f1', spotId: 's1', at: AT },
  { type: 'dashNeeded', id: 'f1', spotId: 's1', at: AT },
  { type: 'rescued', id: 'r1', morph: 'leucistic', at: AT },
  { type: 'carryStart', from: AT, still: false },
  { type: 'arrivedHome', still: false, returned: [] },
  { type: 'wormSpat', id: 'w1', from: AT, to: AT },
  { type: 'snagged', id: 'n1', at: AT },
];

/** Plays `phases` as DASH_STATE events in order from a new trip; the requests they give. */
function dashRequests(phases: readonly DashPhase[]): (SoundRequest | null)[] {
  let state: TripSoundState = NEW_TRIP_SOUNDS;
  const requests: (SoundRequest | null)[] = [];
  for (const phase of phases) {
    const step = dashStateSound(state, { phase, charge: phase === 'ready' ? 1 : 0 });
    state = step.state;
    requests.push(step.request);
  }
  return requests;
}

describe('trip events (S4, S5, S7; issue #165, ND-7, ND-11, ND-12)', () => {
  it('plays the find by its rarity', () => {
    for (const rarity of RARITIES) expect(tripEventSound(pickedUp(rarity))).toEqual({ id: 'find', version: rarity, delayS: 0 });
  });

  it('plays the uh-oh for a hit that costs a leg, the 4th leg included', () => {
    for (const leg of [0, 3]) {
      expect(tripEventSound({ type: 'hit', sourceId: 'tilapia-1', leg, from: AT })).toEqual({ id: 'uhOh', version: ONLY_VERSION, delayS: 0 });
    }
  });

  it('plays the regrowth when a leg is back', () => {
    expect(tripEventSound({ type: 'regrown', leg: 2 })).toEqual({ id: 'regrow', version: ONLY_VERSION, delayS: 0 });
  });

  it('plays the bank by the number of finds banked, capped at 5', () => {
    expect(BANK_SOUND_MAX).toBe(5);
    for (let count = 1; count <= 5; count++) expect(tripEventSound(banked(count))?.version).toBe(String(count));
    expect(tripEventSound(banked(8))).toEqual({ id: 'bank', version: '5', delayS: 0 });
  });

  it('counts a rescued axolotl among the banked finds', () => {
    expect(tripEventSound({ type: 'banked', ids: ['f1', 'rescue-axolotl'] })?.version).toBe('2');
  });

  it('plays nothing when nothing was banked', () => {
    expect(tripEventSound(banked(0))).toBeNull();
  });

  it('plays nothing for every other trip event, the Shell perk block and section 6 moments included', () => {
    for (const event of SILENT_EVENTS) expect(tripEventSound(event)).toBeNull();
  });

  it('asks for a version every sound has', () => {
    const events = [...RARITIES.map(pickedUp), banked(1), banked(5), banked(9), { type: 'regrown', leg: 0 } as TripEvent];
    for (const event of events) {
      const request = tripEventSound(event);
      expect(request).not.toBeNull();
      if (request !== null) expect(soundVersion(request.id, request.version)).toBeDefined();
    }
  });
});

describe('snacks (S3; issue #165, ND-5, ND-8)', () => {
  it('plays one ladder note per snack, climbing, and the last-3 twinkle for each sparkling snack', () => {
    let state: TripSoundState = NEW_TRIP_SOUNDS;
    const versions: string[] = [];
    for (let collected = 1; collected <= 6; collected++) {
      const step = collectedSound(state, { id: `snack-${collected}`, collected, total: 6 }, collected * 0.5);
      state = step.state;
      versions.push(`${step.request?.id}:${step.request?.version}`);
    }
    expect(versions).toEqual(['snack:0', 'snack:1', 'snack:2', 'lastThree:only', 'lastThree:only', 'lastThree:only']);
  });

  it('leaves the ladder as it is for the last 3 snacks', () => {
    const before = collectedSound(NEW_TRIP_SOUNDS, { id: 'a', collected: 1, total: 10 }, 0).state;
    const after = collectedSound(before, { id: 'b', collected: 9, total: 10 }, 0.4).state;
    expect(after.ladder).toBe(before.ladder);
  });

  it('twinkles for every snack of a trip that starts with 3 or fewer left', () => {
    let state: TripSoundState = NEW_TRIP_SOUNDS;
    for (let collected = 18; collected <= 20; collected++) {
      const step = collectedSound(state, { id: `snack-${collected}`, collected, total: 20 }, collected);
      state = step.state;
      expect(step.request?.id).toBe('lastThree');
    }
  });

  it('climbs one step for each of several snacks eaten in one frame', () => {
    let state: TripSoundState = NEW_TRIP_SOUNDS;
    const versions: string[] = [];
    for (let collected = 1; collected <= 3; collected++) {
      const step = collectedSound(state, { id: `snack-${collected}`, collected, total: 10 }, 2);
      state = step.state;
      versions.push(step.request?.version ?? '');
    }
    expect(versions).toEqual(['0', '1', '2']);
  });

  it('starts the ladder again after a pause in game time', () => {
    const first = collectedSound(NEW_TRIP_SOUNDS, { id: 'a', collected: 1, total: 10 }, 0);
    const second = collectedSound(first.state, { id: 'b', collected: 2, total: 10 }, 1);
    const third = collectedSound(second.state, { id: 'c', collected: 3, total: 10 }, 4);
    expect([first, second, third].map((step) => step.request?.version)).toEqual(['0', '1', '0']);
  });

  it('plays every snack sound at once', () => {
    const step = collectedSound(NEW_TRIP_SOUNDS, { id: 'a', collected: 1, total: 10 }, 0);
    expect(step.request?.delayS).toBe(0);
  });
});

describe('the exit opens (S8; issue #165, ND-9)', () => {
  it("plays once the last snack's sound has rung out", () => {
    const last = collectedSound(NEW_TRIP_SOUNDS, { id: 'a', collected: 10, total: 10 }, 5);
    const exit = allCollectedSound(last.state, 5);
    expect(exit.request).toEqual({ id: 'exitOpens', version: ONLY_VERSION, delayS: soundVersion('lastThree').seconds });
  });

  it('plays once per trip', () => {
    const first = allCollectedSound(NEW_TRIP_SOUNDS, 3);
    expect(first.request?.id).toBe('exitOpens');
    expect(allCollectedSound(first.state, 4).request).toBeNull();
  });

  it('plays at once when no snack sound is still ringing', () => {
    expect(allCollectedSound(NEW_TRIP_SOUNDS, 3).request?.delayS).toBe(0);
    const last = collectedSound(NEW_TRIP_SOUNDS, { id: 'a', collected: 10, total: 10 }, 1);
    expect(allCollectedSound(last.state, 9).request?.delayS).toBe(0);
  });
});

describe('Tail Dash (S6; issue #165, ND-10)', () => {
  it('plays only on the edge into dashing, once per Dash', () => {
    const requests = dashRequests(['ready', 'dashing', 'dashing', 'cooldown', 'cooldown', 'ready', 'dashing']);
    expect(requests.map((request) => request?.id ?? null)).toEqual([null, 'dash', null, null, null, null, 'dash']);
  });

  it('plays when the first Dash state of a trip is already dashing', () => {
    expect(dashRequests(['dashing'])).toEqual([{ id: 'dash', version: ONLY_VERSION, delayS: 0 }]);
  });
});

describe('beating an area (S8; issue #165, ND-13)', () => {
  it('plays the stars earned this trip', () => {
    expect(areaBeatenSound({ exit: true, special: false, legsOrRescue: false })).toEqual({ id: 'areaBeaten', version: '1', delayS: 0 });
    expect(areaBeatenSound({ exit: true, special: false, legsOrRescue: true }).version).toBe('2');
    expect(areaBeatenSound({ exit: true, special: true, legsOrRescue: true }).version).toBe('3');
  });

  it('refuses no stars, since a beaten area always earns the exit star', () => {
    expect(() => areaBeatenSound(NO_STARS)).toThrow();
  });
});
