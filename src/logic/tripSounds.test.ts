import { describe, expect, it } from 'vitest';
import { RARITIES, type Rarity } from './catalogue';
import { createEncounter, stepEncounter, type EncounterEvent } from './encounter';
import type { HazardSoundTrip, ViewRect } from './hazardSounds';
import type { ElementSpawn, MatPair } from './hazards';
import { hyacinthMatSpawn } from './hyacinthMats';
import { axolotlFindId } from './morphs';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import type { DashPhase } from './tailDash';
import { NO_STARS } from './stars';
import { ONLY_VERSION, soundVersion } from './sounds';
import type { TripEvent } from './trip';
import type { TripPhase } from './tripEvents';
import {
  BANK_SOUND_MAX,
  NEW_TRIP_SOUNDS,
  allCollectedSound,
  areaBeatenSound,
  collectedSound,
  dashStateSound,
  exitClosedSound,
  shrimpFlickSounds,
  tripEventFollowOnSound,
  tripEventSound,
  tripFrameSounds,
  type SoundRequest,
  type TripSoundState,
} from './tripSounds';
import { buildCanalZone, type CollectibleKind, type Point } from './zone';

const AT = { x: 10, y: 20 };

function pickedUp(rarity: Rarity): TripEvent {
  return { type: 'pickedUp', id: 'f1', spotId: 's1', at: AT, found: { id: 'f1', name: 'Shell', category: 'decoration', rarity } };
}

function banked(count: number): TripEvent {
  return { type: 'banked', ids: Array.from({ length: count }, (_, i) => `f${i}`) };
}

/** Every trip event that plays nothing (issue #166, Q1). */
const SILENT_EVENTS: readonly TripEvent[] = [
  { type: 'lunge', sourceId: 'tilapia-1', aim: AT },
  { type: 'bump', sourceId: 'tilapia-1', from: AT },
  { type: 'regrowStart', leg: 1 },
  { type: 'protectedEnd' },
  { type: 'arrivedHome', still: false, returned: [] },
];

/** Each trip event with a sound of its own from issue #166, and that sound (ND-3, ND-7, ND-8, ND-10 to ND-12, ND-16). */
const HAZARD_RESCUE_EVENTS: readonly { event: TripEvent; id: SoundRequest['id'] }[] = [
  { event: { type: 'telegraph', sourceId: 'tilapia-1' }, id: 'ripple' },
  { event: { type: 'shellBlock', sourceId: 'tilapia-1', from: AT }, id: 'shellBlock' },
  { event: { type: 'carryStart', from: AT, still: false }, id: 'lullaby' },
  { event: { type: 'dashNeeded', id: 'f1', spotId: 's1', at: AT }, id: 'potWobble' },
  { event: { type: 'containerBroken', id: 'f1', spotId: 's1', at: AT }, id: 'dashPot' },
  { event: { type: 'rescued', id: 'r1', morph: 'leucistic', at: AT }, id: 'rescueMeet' },
  { event: { type: 'wormSpat', id: 'w1', from: AT, to: AT }, id: 'bleh' },
  { event: { type: 'snagged', id: 'n1', at: AT }, id: 'snag' },
];

function paintShellPickedUp(): TripEvent {
  return { type: 'pickedUp', id: 'p1', spotId: 's1', at: AT, found: { id: 'p1', name: 'Paint shell', category: 'paintShell', rarity: 'common' } };
}

/** Punting pole cycle from offset 0: rest [0, 1.6), warn [1.6, 2.6), jab [2.6, 2.9), hold [2.9, 3.4), lift [3.4, 4). */
const POLE: MovingHazardSpawn = movingHazardSpawn('pole-a', PUNTING_POLE, 500, 0);

/** Mat cycle from offset 0: opening [0, 1), open [1, 3), closing [3, 4), closed [4, 8). */
const PAIR: MatPair = { x0: 300, x1: 420, rowTop: 100, rowBottom: 300, channelY: 200, openHeight: 72 };
const MATS: ElementSpawn = hyacinthMatSpawn('mats-a', 0, PAIR);

/** A view holding the pole's shaft and the mat box. */
const VIEW: ViewRect = { x: 0, y: 0, width: 960, height: 540 };

/** One frame of a trip for the hazard sounds: its phase, snag time left and both hazard clocks. */
interface FrameFixture {
  phase?: TripPhase;
  snagLeft?: number;
  hazardTime?: number;
  elementTime?: number;
}

function createFrameTrip(fixture: FrameFixture = {}): HazardSoundTrip {
  const { phase = 'swimming', snagLeft = 0, hazardTime = 0, elementTime = 0 } = fixture;
  return {
    phase,
    ghostNets: { nets: [], snagLeft, inReach: [] },
    encounter: { movingHazards: [POLE], hazardTime },
    elements: [MATS],
    elementTime,
  };
}

/** Plays `frames` in order from a new trip with no trip events; the ids each frame asks for. */
function frameSoundIds(frames: readonly FrameFixture[]): string[][] {
  let state: TripSoundState = NEW_TRIP_SOUNDS;
  const ids: string[][] = [];
  for (const frame of frames) {
    const step = tripFrameSounds(state, createFrameTrip(frame), VIEW, []);
    state = step.state;
    ids.push(step.requests.map((request) => request.id));
  }
  return ids;
}

/** Frames at clocks `from` to `to` in steps of `dt`, both hazard clocks moving together. */
function clockFrames(from: number, to: number, dt: number): FrameFixture[] {
  const frames: FrameFixture[] = [];
  for (let t = from; t <= to + 1e-9; t += dt) frames.push({ hazardTime: t, elementTime: t });
  return frames;
}

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

  it('plays nothing for the strike, the bump, the regrowth start, the end of protected time and the arrival home', () => {
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
  it('asks for the exit sound at once after the last snacks, leaving the wait to the sound queue (issue #165)', () => {
    let state: TripSoundState = NEW_TRIP_SOUNDS;
    for (let collected = 8; collected <= 10; collected++) {
      state = collectedSound(state, { id: `snack-${collected}`, collected, total: 10 }, 5).state;
    }
    expect(allCollectedSound(state).request).toEqual({ id: 'exitOpens', version: ONLY_VERSION, delayS: 0 });
  });

  it('plays once per trip', () => {
    const last = collectedSound(NEW_TRIP_SOUNDS, { id: 'a', collected: 10, total: 10 }, 5);
    const first = allCollectedSound(last.state);
    expect(first.request?.id).toBe('exitOpens');
    expect(allCollectedSound(first.state).request).toBeNull();
  });
});

describe('Tail Dash (S6; issue #165, ND-10)', () => {
  it('plays only on the edge into dashing, once per Dash', () => {
    const requests = dashRequests(['ready', 'dashing', 'dashing', 'cooldown', 'cooldown', 'ready', 'dashing']);
    expect(requests.map((request) => request?.id ?? null)).toEqual([null, 'dash', null, null, null, 'dashReady', 'dash']);
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

describe('hazard and rescue trip events (S9 to S11; issue #166, ND-3, ND-7, ND-8, ND-10 to ND-12, ND-16)', () => {
  it('plays each event its sound at once', () => {
    for (const { event, id } of HAZARD_RESCUE_EVENTS) expect(tripEventSound(event)).toEqual({ id, version: ONLY_VERSION, delayS: 0 });
  });

  it('plays one ripple for a predator warning that is cancelled', () => {
    const zone = buildCanalZone();
    const start = zone.tilapiaRoutes[0].waypoints[0];
    const inRange: Point = { x: start.x + 60, y: start.y };
    const sheltered: Point = { x: (zone.safeArea.x0 + zone.safeArea.x1) / 2, y: (zone.safeArea.y0 + zone.safeArea.y1) / 2 };
    let encounter = createEncounter(zone);
    const events: EncounterEvent[] = [];
    for (let frame = 0; frame < 600 && encounter.predators[0].phase !== 'cooldown'; frame++) {
      const telegraphing = encounter.predators[0].phase === 'telegraph';
      const result = stepEncounter(encounter, telegraphing ? sheltered : inRange, 1 / 60);
      encounter = result.state;
      events.push(...result.events);
    }
    expect(encounter.predators[0].phase).toBe('cooldown');
    const types = events.map((event) => event.type);
    expect(types).toContain('telegraph');
    expect(types).not.toContain('lunge');
    const tripEvents = events.filter((event): event is Exclude<EncounterEvent, { type: 'carriedHome' }> => event.type !== 'carriedHome');
    const ripples = tripEvents.map((event) => tripEventSound(event)).filter((request) => request?.id === 'ripple');
    expect(ripples).toHaveLength(1);
  });
});

describe('follow-on sounds (issue #166, ND-14, ND-16)', () => {
  it('plays the painted shell after a Paint shell find, and nothing after any other find', () => {
    expect(tripEventFollowOnSound(paintShellPickedUp())).toEqual({ id: 'paintShell', version: ONLY_VERSION, delayS: 0 });
    for (const rarity of RARITIES) expect(tripEventFollowOnSound(pickedUp(rarity))).toBeNull();
  });

  it('plays the rescue safe moment once after a bank that holds a rescued axolotl', () => {
    const rescueBank: TripEvent = { type: 'banked', ids: ['f1', axolotlFindId('leucistic'), axolotlFindId('wild')] };
    expect(tripEventFollowOnSound(rescueBank)).toEqual({ id: 'rescueSafe', version: ONLY_VERSION, delayS: 0 });
    expect(tripEventSound(rescueBank)?.id).toBe('bank');
  });

  it('plays nothing after a bank without a rescued axolotl, or after any other event', () => {
    expect(tripEventFollowOnSound(banked(3))).toBeNull();
    expect(tripEventFollowOnSound({ type: 'banked', ids: ['rescue-axolotl'] })).toBeNull();
    for (const { event } of HAZARD_RESCUE_EVENTS) expect(tripEventFollowOnSound(event)).toBeNull();
    for (const event of SILENT_EVENTS) expect(tripEventFollowOnSound(event)).toBeNull();
  });
});

describe('tadpoles and shrimp (S3; issue #166, ND-2)', () => {
  it('plays the catch on the ladder step for a tadpole or shrimp, climbing the same ladder as snacks', () => {
    let state: TripSoundState = NEW_TRIP_SOUNDS;
    const kinds: (CollectibleKind | undefined)[] = ['worm', 'tadpole', undefined, 'shrimp', 'bug'];
    const versions: string[] = [];
    for (let collected = 1; collected <= kinds.length; collected++) {
      const step = collectedSound(state, { id: `snack-${collected}`, collected, total: 10, kind: kinds[collected - 1] }, collected * 0.5);
      state = step.state;
      versions.push(`${step.request?.id}:${step.request?.version}`);
    }
    expect(versions).toEqual(['snack:0', 'catchSnack:1', 'snack:2', 'catchSnack:3', 'snack:4']);
  });

  it('plays the last-3 twinkle for a tadpole or shrimp among the last 3, leaving the ladder as it is', () => {
    for (const kind of ['tadpole', 'shrimp'] as const) {
      const step = collectedSound(NEW_TRIP_SOUNDS, { id: 'a', collected: 8, total: 10, kind }, 0);
      expect(step.request).toEqual({ id: 'lastThree', version: ONLY_VERSION, delayS: 0 });
      expect(step.state).toBe(NEW_TRIP_SOUNDS);
    }
  });
});

describe('Dash ready (S6; issue #166, ND-13)', () => {
  it('plays once per recharge, on the edge from cooldown to ready', () => {
    const requests = dashRequests(['ready', 'dashing', 'cooldown', 'ready', 'ready', 'dashing', 'cooldown', 'cooldown', 'ready']);
    expect(requests.map((request) => request?.id ?? null)).toEqual([null, 'dash', null, 'dashReady', null, 'dash', null, null, 'dashReady']);
    expect(requests[3]).toEqual({ id: 'dashReady', version: ONLY_VERSION, delayS: 0 });
  });

  it('plays nothing at the start of a trip, whatever the first Dash state', () => {
    for (const phase of ['ready', 'cooldown'] as const) expect(dashRequests([phase])).toEqual([null]);
  });
});

describe('the exit still closed (issue #166, ND-9)', () => {
  it('plays the closed exit at once', () => {
    expect(exitClosedSound()).toEqual({ id: 'exitClosed', version: ONLY_VERSION, delayS: 0 });
  });
});

describe('shrimp flicks (issue #166, ND-15)', () => {
  it('plays one flick for each shrimp that starts a flick', () => {
    expect(shrimpFlickSounds(['s1', 's2'])).toEqual([
      { id: 'shrimpFlick', version: ONLY_VERSION, delayS: 0 },
      { id: 'shrimpFlick', version: ONLY_VERSION, delayS: 0 },
    ]);
    expect(shrimpFlickSounds(['s1'])).toHaveLength(1);
  });

  it('plays nothing when no shrimp starts a flick', () => {
    expect(shrimpFlickSounds([])).toEqual([]);
  });
});

describe('hazard frames (S9, S11; issue #166, ND-4 to ND-7, Q2)', () => {
  it('starts a trip with no hazard snapshot', () => {
    expect(NEW_TRIP_SOUNDS.hazards).toBeUndefined();
  });

  it('plays nothing on the trip first frame, even where every edge would fire, and records the snapshot', () => {
    const step = tripFrameSounds(NEW_TRIP_SOUNDS, createFrameTrip({ snagLeft: 0, hazardTime: 1.6, elementTime: 0 }), VIEW, []);
    expect(step.requests).toEqual([]);
    expect(step.state.hazards).toEqual({ snagged: false, hazardTime: 1.6, elementTime: 0 });
  });

  it('plays wriggle free once when a snag ends', () => {
    const snagLefts = [0, 1, 0.5, 0, 0, 1, 0];
    const ids = frameSoundIds(snagLefts.map((snagLeft) => ({ snagLeft, hazardTime: 0.5, elementTime: 5 })));
    expect(ids).toEqual([[], [], [], ['wriggleFree'], [], [], ['wriggleFree']]);
  });

  it('plays one ripple per pole warning start and one mats opening per opening', () => {
    expect(frameSoundIds(clockFrames(1, 8.5, 0.1)).flat()).toEqual(['ripple', 'ripple', 'matsOpen']);
  });

  it('plays the edges of one frame in order: wriggle free, ripple, mats opening', () => {
    const before = tripFrameSounds(NEW_TRIP_SOUNDS, createFrameTrip({ snagLeft: 1, hazardTime: 1.5, elementTime: 7.9 }), VIEW, []).state;
    const step = tripFrameSounds(before, createFrameTrip({ snagLeft: 0, hazardTime: 1.7, elementTime: 8.1 }), VIEW, []);
    expect(step.requests.map((request) => request.id)).toEqual(['wriggleFree', 'ripple', 'matsOpen']);
    for (const request of step.requests) expect(request.delayS).toBe(0);
  });

  it('adds no pole ripple on a frame where a predator warning already asked for one', () => {
    const before = tripFrameSounds(NEW_TRIP_SOUNDS, createFrameTrip({ snagLeft: 1, hazardTime: 1.5, elementTime: 7.9 }), VIEW, []).state;
    const telegraph: TripEvent = { type: 'telegraph', sourceId: 'tilapia-1' };
    const step = tripFrameSounds(before, createFrameTrip({ snagLeft: 0, hazardTime: 1.7, elementTime: 8.1 }), VIEW, [telegraph]);
    expect(step.requests.map((request) => request.id)).toEqual(['wriggleFree', 'matsOpen']);
    const frameRipples = [tripEventSound(telegraph), ...step.requests].filter((request) => request?.id === 'ripple');
    expect(frameRipples).toHaveLength(1);
  });

  it('plays no wriggle when the carry home ends a snag, but still records the snapshot', () => {
    const before = tripFrameSounds(NEW_TRIP_SOUNDS, createFrameTrip({ snagLeft: 1 }), VIEW, []).state;
    const carried = tripFrameSounds(before, createFrameTrip({ phase: 'carrying', snagLeft: 0, hazardTime: 0.2 }), VIEW, []);
    expect(carried.requests).toEqual([]);
    expect(carried.state.hazards).toEqual({ snagged: false, hazardTime: 0.2, elementTime: 0 });
  });

  it('keeps the rest of the sound state as it is', () => {
    const step = tripFrameSounds(NEW_TRIP_SOUNDS, createFrameTrip(), VIEW, []);
    expect(step.state.ladder).toBe(NEW_TRIP_SOUNDS.ladder);
    expect(step.state.dashPhase).toBe(NEW_TRIP_SOUNDS.dashPhase);
    expect(step.state.exitOpened).toBe(NEW_TRIP_SOUNDS.exitOpened);
  });
});

describe('versions (issue #166)', () => {
  it('asks for a version every sound has', () => {
    const requests: (SoundRequest | null)[] = [
      ...HAZARD_RESCUE_EVENTS.map(({ event }) => tripEventSound(event)),
      tripEventFollowOnSound(paintShellPickedUp()),
      tripEventFollowOnSound({ type: 'banked', ids: [axolotlFindId('leucistic')] }),
      exitClosedSound(),
      ...shrimpFlickSounds(['s1']),
      dashRequests(['cooldown', 'ready'])[1],
    ];
    let state: TripSoundState = NEW_TRIP_SOUNDS;
    for (let collected = 1; collected <= 12; collected++) {
      const step = collectedSound(state, { id: `t${collected}`, collected, total: 20, kind: 'tadpole' }, collected * 0.3);
      state = step.state;
      requests.push(step.request);
    }
    const before = tripFrameSounds(NEW_TRIP_SOUNDS, createFrameTrip({ snagLeft: 1, hazardTime: 1.5, elementTime: 7.9 }), VIEW, []).state;
    const frame = tripFrameSounds(before, createFrameTrip({ hazardTime: 1.7, elementTime: 8.1 }), VIEW, []);
    requests.push(...frame.requests);
    expect(frame.requests).toHaveLength(3);
    for (const request of requests) {
      expect(request).not.toBeNull();
      if (request !== null) expect(soundVersion(request.id, request.version)).toBeDefined();
    }
  });
});
