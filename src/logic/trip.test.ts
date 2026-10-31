import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DrawnBody } from './collectibles';
import { createEncounter, createEncounterContext, predatorSpecies } from './encounter';
import { HERON_MEET_RANGE, meetsTilapia, type FactCard } from './factCards';
import { GHOST_NET, createGhostNets, isSnagged, netDrift } from './ghostNets';
import { GLOW_PLANTS, glowPlantSpawn, type DarkWater } from './glowPlants';
import type { ElementSpawn, ElementType, HazardSpawn, HazardType } from './hazards';
import { inSightCover, zoneThreats } from './hiding';
import {
  HERON_SPECIES,
  TILAPIA_SPECIES,
  type PredatorRoute,
  type PredatorSpecies,
} from './predators';
import { GAME_EVENTS, REGISTRY_KEYS } from './gameEvents';
import { createLegs, isProtected, presentCount, tryHit, type LegsState } from './legs';
import { PUNTING_POLE, movingHazardSpawn } from './movingHazards';
import { CANAL_AREA } from './areas';
import { treasureById } from './catalogue';
import { TRAJINERAS, trajineraSpawn } from './trajineras';
import {
  LEG_PROGRESS_STEPS,
  beatArea,
  createTrip,
  createTripContext,
  eatPlasticWorms,
  foundInfo,
  followReducedMotion,
  foundInfos,
  goHome,
  idleTripSnapshot,
  keepExploring,
  legsSnapshot,
  markFactCardSeen,
  meetSnacks,
  newTrip,
  sameTripSnapshot,
  stepTrip,
  tripAxolotlPos,
  tripSnapshot,
  type CarryState,
  type TripEvent,
  type TripInput,
  type TripSource,
  type StarContext,
  type TripState,
  type TripStepResult,
} from './trip';
import { axolotlFindId, type RealMorphId } from './morphs';
import { DEFAULT_TRIP_SEED, nextTripSeed, placeTreasures, type PlacedFind, type PlacementOptions } from './placement';
import { PLASTIC_WORM, isQueasy, spitLanding, type SpitAvoid } from './plasticWorms';
import { RESCUE, pickStranding, type Stranding } from './rescue';
import { tripEndRecord } from './session';
import { TRIP_EVENTS, TRIP_REGISTRY_KEYS, type TripSnapshot } from './tripEvents';
import { withStars } from './stars';
import { CARRY, FINDS, GHOST_NETS, LEGS, PLASTIC_WORMS, SNACK_REACH, SWIM, TILAPIA, tripTreasureTuning } from './tuning';
import { SURF, buildCanalZone, swimBounds, type HidingSpot, type Point } from './zone';

const DT = 1 / 60;
const PAUSE_DTS = [0, -1, Number.NaN, Number.POSITIVE_INFINITY];
const zone = buildCanalZone();
const routeStart = zone.tilapiaRoutes[0].waypoints[0];
const inRange: Point = { x: routeStart.x + 60, y: routeStart.y };
const ctx = createTripContext({ encounter: createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 } }) });
const farZone: TripSource = { ...zone, tilapiaRoutes: [{ id: 'far', waypoints: [{ x: 1500, y: 200 }] }] };
const farTarget: Point = { x: 1560, y: 200 };
const home: Point = zone.start;
const outside: Point = { x: 400, y: 200 };
const PLANT = 'canal/pond-plant';
const HAT = 'canal/sun-hat';
const BOAT = 'canal/toy-boat';
const BOW = 'canal/golden-bow';
const spotA: HidingSpot = { id: 'test/spot-a', cover: 'reeds', rarity: 'common', container: false, x: 500, y: 200 };
const spotB: HidingSpot = { id: 'test/spot-b', cover: 'reeds', rarity: 'epic', container: false, x: 600, y: 260 };
const spotC: HidingSpot = { id: 'test/spot-c', cover: 'reeds', rarity: 'rare', container: false, ...inRange };
const potSpot: HidingSpot = { id: 'test/spot-pot', cover: 'cave', rarity: 'legendary', container: true, x: 700, y: 200 };
const calmRoutes = [{ id: 'calm', waypoints: [{ x: 1800, y: 120 }] }];
const findZone: TripSource = {
  ...zone,
  tilapiaRoutes: calmRoutes,
  finds: [
    { id: PLANT, pool: [spotA.id] },
    { id: HAT, pool: [spotB.id] },
  ],
  spots: [spotA, spotB],
};
const carryZone: TripSource = {
  ...zone,
  finds: [
    { id: BOAT, pool: [spotC.id] },
    { id: HAT, pool: [spotB.id] },
  ],
  spots: [spotC, spotB],
};
const potZone: TripSource = {
  ...findZone,
  finds: [...findZone.finds, { id: BOW, pool: [potSpot.id] }],
  spots: [...findZone.spots, potSpot],
};

/**
 * A trip seed whose treasure slots reach the Legendary Golden bow in its pot. A slot falls back only
 * one step rarer (B4), so the canal's Common slots never reach it; it needs an Epic or Legendary roll.
 */
const POT_SEED = seedPlacing(potZone, BOW, potSpot.id);

/** A trip of the pot zone with the Golden bow placed in its sealed pot. */
function potTrip(source: TripSource = potZone): TripState {
  const trip = createTrip(source, LEGS, [], POT_SEED);
  expect(placedPot(trip)?.sealed).toBe(true);
  return trip;
}

interface Drive {
  state: TripState;
  events: TripEvent[];
  last: TripStepResult;
  seconds: number;
}

function drive(state: TripState, input: TripInput, until: TripEvent['type'], limit = 120): Drive {
  let current = state;
  const events: TripEvent[] = [];
  let last: TripStepResult = { state, events: [] };
  let seconds = 0;
  while (seconds < limit) {
    last = stepTrip(current, input, DT, ctx);
    current = last.state;
    seconds += DT;
    events.push(...last.events);
    if (last.events.some((event) => event.type === until)) break;
  }
  return { state: current, events, last, seconds };
}

function stepAt(state: TripState, pos: Point, dashing = false): TripStepResult {
  return stepTrip(state, { axolotlPos: pos, reduced: false, dashing }, DT, ctx);
}

function walk(state: TripState, path: Point[], dashing = false): Drive {
  let current = state;
  const events: TripEvent[] = [];
  let last: TripStepResult = { state, events: [] };
  for (const pos of path) {
    last = stepAt(current, pos, dashing);
    current = last.state;
    events.push(...last.events);
  }
  return { state: current, events, last, seconds: path.length * DT };
}

function banked(): Drive {
  return walk(createTrip(findZone), [spotA, spotB, outside, home]);
}

function pickedUpAt(id: string, spot: HidingSpot): TripEvent {
  return { type: 'pickedUp', id, spotId: spot.id, at: { x: spot.x, y: spot.y }, found: foundInfo(id) };
}

function potEvent(type: 'containerBroken' | 'dashNeeded'): TripEvent {
  return { type, id: BOW, spotId: potSpot.id, at: { x: potSpot.x, y: potSpot.y } };
}

function placedPot(state: TripState): PlacedFind | undefined {
  return state.placed.find((find) => find.id === BOW);
}

function seedPlacing(source: TripSource, id: string, spotId: string): number {
  for (let seed = 1; seed < 1000; seed++) {
    if (createTrip(source, LEGS, [], seed).placed.some((find) => find.id === id && find.spotId === spotId)) {
      return seed;
    }
  }
  throw new Error(`no seed places ${id} at ${spotId}`);
}

function countOf(events: TripEvent[], type: TripEvent['type']): number {
  return events.filter((event) => event.type === type).length;
}

function carrying(source: TripSource, target: Point, reduced: boolean): Drive {
  return drive(createTrip(source), { axolotlPos: target, reduced, dashing: false }, 'carryStart');
}

function ended(): TripState {
  const carry = carrying(zone, inRange, false).state;
  return drive(carry, { axolotlPos: inRange, reduced: false, dashing: false }, 'arrivedHome').state;
}

function distanceToHome(state: TripState, pos: Point): number {
  return Math.hypot(state.home.x - pos.x, state.home.y - pos.y);
}

function expectedDuration(from: Point, home: Point): number {
  const distance = Math.hypot(home.x - from.x, home.y - from.y);
  return Math.min(CARRY.maxTime, Math.max(CARRY.minTime, distance / CARRY.speed));
}

function regrowingLegs(progress: number): LegsState {
  const hit = tryHit(createLegs());
  const slots = hit.state.slots.map((slot, i) => (i === 0 ? { ...slot, progress } : slot));
  return { ...hit.state, slots };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createTrip', () => {
  it('starts swimming from the Home Spot with a fresh encounter and no carry', () => {
    const trip = createTrip(zone);
    expect(trip.phase).toBe('swimming');
    expect(trip.carry).toBeNull();
    expect(trip.home).toEqual(zone.start);
    expect(trip.encounter).toEqual(createEncounter(zone));
    expect(tripAxolotlPos(trip)).toBeNull();
  });

  it('starts with an empty bag, the given banked ids, inside the Home Spot and no ending', () => {
    const trip = createTrip(findZone, LEGS, ['canal/pebble-9', 'canal/pebble-9', 'canal/pebble-8']);
    expect(trip.holdings.bag).toEqual([]);
    expect(trip.holdings.banked).toEqual(['canal/pebble-9', 'canal/pebble-8']);
    expect(trip.inHomeSpot).toBe(true);
    expect(trip.ending).toBeNull();
    expect(trip.bankedThisTrip).toEqual([]);
    expect(trip.justBanked).toEqual([]);
    expect(trip.heldAt).toBeNull();
  });
});

describe('stepTrip finds', () => {
  it('picks up a find at its spot once and fills the bag', () => {
    const near: Point = { x: spotA.x + FINDS.pickupRadius, y: spotA.y };
    const { state, events } = walk(createTrip(findZone), [near, spotA, spotA]);
    expect(events.filter((event) => event.type === 'pickedUp')).toEqual([pickedUpAt(PLANT, spotA)]);
    expect(state.holdings.bag).toEqual([PLANT]);
    expect(state.inHomeSpot).toBe(false);
    expect(state.phase).toBe('swimming');
  });

  it('does not pick up a find just outside the pickup radius', () => {
    const away: Point = { x: spotA.x + FINDS.pickupRadius + 0.5, y: spotA.y };
    const result = stepAt(createTrip(findZone), away);
    expect(result.events).toEqual([]);
    expect(result.state.holdings.bag).toEqual([]);
  });

  it('never picks up a banked find again', () => {
    const preBanked = createTrip(findZone, LEGS, [PLANT]);
    expect(countOf(stepAt(preBanked, spotA).events, 'pickedUp')).toBe(0);
    const resumed = keepExploring(banked().state);
    const again = walk(resumed, [outside, spotA, spotB]);
    expect(countOf(again.events, 'pickedUp')).toBe(0);
    expect(again.state.holdings.bag).toEqual([]);
  });

  it('banks the whole bag inside the ring, freezing the trip where the axolotl is', () => {
    const before = walk(createTrip(findZone, LEGS, ['canal/pebble-9']), [spotA, spotB, outside]).state;
    expect(before.holdings.bag).toEqual([PLANT, HAT]);
    const result = stepAt(before, home);
    expect(result.events).toEqual([{ type: 'banked', ids: [PLANT, HAT] }]);
    expect(result.impulse).toBeUndefined();
    const { state } = result;
    expect(state.phase).toBe('banked');
    expect(state.holdings.bag).toEqual([]);
    expect(state.holdings.banked.length).toBe(before.holdings.banked.length + 2);
    expect(state.holdings.banked).toEqual(['canal/pebble-9', PLANT, HAT]);
    expect(state.justBanked).toEqual([PLANT, HAT]);
    expect(state.bankedThisTrip).toEqual([PLANT, HAT]);
    expect(state.inHomeSpot).toBe(true);
    expect(tripAxolotlPos(state)).toEqual(home);
  });

  it('does nothing inside the ring with an empty bag', () => {
    const start = walk(createTrip(findZone), [outside]).state;
    const result = stepAt(start, home);
    expect(result.events).toEqual([]);
    expect(result.state.phase).toBe('swimming');
    expect(result.state.inHomeSpot).toBe(true);
    expect(result.state.holdings).toBe(start.holdings);
    expect(tripAxolotlPos(result.state)).toBeNull();
  });

  it('does not re-bank after keepExploring inside the ring, and banks again after a new find', () => {
    const resumed = keepExploring(banked().state);
    expect(resumed.phase).toBe('swimming');
    expect(resumed.justBanked).toEqual([]);
    expect(resumed.heldAt).toBeNull();
    const stay = walk(resumed, [home, home, home]);
    expect(stay.events).toEqual([]);
    expect(stay.state.phase).toBe('swimming');
    const extraSpot: HidingSpot = { ...spotA, id: 'test/spot-x', x: 700, y: 200 };
    const extra: PlacedFind = { id: BOAT, spotId: extraSpot.id, x: 700, y: 200, container: false, sealed: false };
    const withExtra: TripState = { ...stay.state, placed: [...stay.state.placed, extra] };
    const trip = walk(withExtra, [outside, extraSpot, outside, home]);
    expect(trip.events).toEqual([pickedUpAt(BOAT, extraSpot), { type: 'banked', ids: [BOAT] }]);
    expect(trip.state.phase).toBe('banked');
    expect(trip.state.justBanked).toEqual([BOAT]);
    expect(trip.state.bankedThisTrip).toEqual([PLANT, HAT, BOAT]);
    expect(trip.state.found).toEqual([PLANT, HAT, BOAT]);
  });

  it('keepExploring returns the same object outside the banked phase', () => {
    const swimming = createTrip(findZone);
    const carry = carrying(zone, inRange, false).state;
    const done = ended();
    expect(keepExploring(swimming)).toBe(swimming);
    expect(keepExploring(carry)).toBe(carry);
    expect(keepExploring(done)).toBe(done);
  });
});

describe('stepTrip Dash pots', () => {
  it('asks for a dash once per contact, keeps the pot sealed and gives no pickup or impulse', () => {
    const edge: Point = { x: potSpot.x + FINDS.containerRadius, y: potSpot.y };
    const path = [outside, edge, potSpot, potSpot, outside, potSpot];
    let current = potTrip();
    const perStep: TripEvent[][] = [];
    for (const pos of path) {
      const result = stepAt(current, pos);
      expect(result.impulse).toBeUndefined();
      perStep.push(result.events);
      current = result.state;
    }
    expect(perStep).toEqual([[], [potEvent('dashNeeded')], [], [], [], [potEvent('dashNeeded')]]);
    expect(current.touchingPots).toEqual([BOW]);
    expect(placedPot(current)?.sealed).toBe(true);
    expect(current.holdings.bag).toEqual([]);
    expect(current.found).toEqual([]);
  });

  it('does not touch a pot just outside the container radius', () => {
    const away: Point = { x: potSpot.x + FINDS.containerRadius + 0.5, y: potSpot.y };
    const result = stepAt(potTrip(), away, true);
    expect(result.events).toEqual([]);
    expect(placedPot(result.state)?.sealed).toBe(true);
  });

  it('breaks the pot and picks the treasure up in one step when dashing into it', () => {
    const result = stepAt(potTrip(), potSpot, true);
    expect(result.events).toEqual([potEvent('containerBroken'), pickedUpAt(BOW, potSpot)]);
    expect(result.impulse).toBeUndefined();
    expect(placedPot(result.state)?.sealed).toBe(false);
    expect(result.state.touchingPots).toEqual([]);
    expect(result.state.holdings.bag).toEqual([BOW]);
    expect(result.state.found).toEqual([BOW]);
  });

  it('breaks at the container radius but picks up only once the axolotl reaches the spot', () => {
    const edge: Point = { x: potSpot.x + FINDS.containerRadius, y: potSpot.y };
    const near: Point = { x: potSpot.x + FINDS.pickupRadius, y: potSpot.y };
    const broke = stepAt(potTrip(), edge, true);
    expect(broke.events).toEqual([potEvent('containerBroken')]);
    expect(broke.state.holdings.bag).toEqual([]);
    const lingered = stepAt(broke.state, edge, true);
    expect(lingered.events).toEqual([]);
    const reached = stepAt(lingered.state, near);
    expect(reached.events).toEqual([pickedUpAt(BOW, potSpot)]);
    expect(reached.state.holdings.bag).toEqual([BOW]);
  });

  it('never picks up a sealed pot without a dash', () => {
    const swum = walk(potTrip(), Array.from({ length: 120 }, () => potSpot));
    expect(countOf(swum.events, 'pickedUp')).toBe(0);
    expect(countOf(swum.events, 'dashNeeded')).toBe(1);
    expect(swum.state.holdings.bag).toEqual([]);
    expect(placedPot(swum.state)?.sealed).toBe(true);
  });

  it('touches no pot while carrying', () => {
    const potRoute: TripSource = { ...potZone, tilapiaRoutes: zone.tilapiaRoutes };
    const carry = drive(potTrip(potRoute), { axolotlPos: inRange, reduced: false, dashing: false }, 'carryStart');
    const arrived = drive(carry.state, { axolotlPos: potSpot, reduced: false, dashing: true }, 'arrivedHome');
    expect(countOf(arrived.events, 'containerBroken')).toBe(0);
    expect(countOf(arrived.events, 'dashNeeded')).toBe(0);
    expect(placedPot(arrived.state)?.sealed).toBe(true);
  });

  it('keeps the placed, touching and found arrays across steps that change none of them', () => {
    const start = potTrip();
    const away = stepAt(start, outside);
    expect(away.state.placed).toBe(start.placed);
    expect(away.state.touchingPots).toBe(start.touchingPots);
    expect(away.state.found).toBe(start.found);
    const touching = stepAt(away.state, potSpot);
    const still = stepAt(touching.state, potSpot);
    expect(still.state.touchingPots).toEqual([BOW]);
    expect(still.state.touchingPots).toBe(touching.state.touchingPots);
    expect(still.state.placed).toBe(start.placed);
    const broke = stepAt(still.state, potSpot, true);
    expect(broke.state.placed).not.toBe(start.placed);
    expect(placedPot(broke.state)?.sealed).toBe(false);
    expect(placedPot(start)?.sealed).toBe(true);
    expect(start.found).toEqual([]);
  });
});

describe('per-trip placement', () => {
  it('places every unbanked treasure at its spot on a trip whose slots reach the Legendary, sealing pots, with nothing found', () => {
    expect(createTrip(potZone).tripSeed).toBe(DEFAULT_TRIP_SEED);
    const trip = potTrip();
    expect(trip.tripSeed).toBe(POT_SEED);
    expect(trip.placed).toEqual([
      { id: PLANT, spotId: spotA.id, x: spotA.x, y: spotA.y, container: false, sealed: false },
      { id: HAT, spotId: spotB.id, x: spotB.x, y: spotB.y, container: false, sealed: false },
      { id: BOW, spotId: potSpot.id, x: potSpot.x, y: potSpot.y, container: true, sealed: true },
    ]);
    expect(trip.touchingPots).toEqual([]);
    expect(trip.found).toEqual([]);
  });

  it('places none of the banked treasures', () => {
    const trip = createTrip(potZone, LEGS, [PLANT, BOW]);
    expect(trip.placed.map((find) => find.id)).toEqual([HAT]);
    expect(countOf(walk(trip, [spotA, potSpot], true).events, 'pickedUp')).toBe(0);
  });

  it('uses the next trip seed by default and honours an explicit seed', () => {
    const done = ended();
    expect(newTrip(done).tripSeed).toBe(nextTripSeed(done.tripSeed));
    expect(newTrip(done, 42).tripSeed).toBe(42);
    expect(newTrip(done, 42)).toEqual(createTrip(zone, LEGS, [], 42));
  });

  it('gives a carried-home treasure a fresh pick and seals its pot again', () => {
    const potC: HidingSpot = { ...spotC, id: 'test/spot-pot-c', container: true };
    const spotFar: HidingSpot = { ...spotB, id: 'test/spot-far', x: 900, y: 260 };
    const source: TripSource = { ...zone, finds: [{ id: BOAT, pool: [potC.id, spotFar.id] }], spots: [potC, spotFar] };
    const atPot = seedPlacing(source, BOAT, potC.id);
    const atFar = seedPlacing(source, BOAT, spotFar.id);
    const start = createTrip(source, LEGS, [], atPot);
    const carry = drive(start, { axolotlPos: inRange, reduced: false, dashing: true }, 'carryStart');
    expect(carry.state.holdings.bag).toEqual([BOAT]);
    expect(carry.state.placed[0].sealed).toBe(false);
    const done = drive(carry.state, { axolotlPos: inRange, reduced: false, dashing: false }, 'arrivedHome').state;
    expect(done.ending?.returned).toEqual([BOAT]);
    const moved = newTrip(done, atFar);
    expect(moved.placed).toEqual([
      { id: BOAT, spotId: spotFar.id, x: spotFar.x, y: spotFar.y, container: false, sealed: false },
    ]);
    expect(moved.found).toEqual([]);
    const resealed = newTrip(done, atPot);
    expect(resealed.placed).toEqual([{ id: BOAT, spotId: potC.id, x: potC.x, y: potC.y, container: true, sealed: true }]);
  });
});

describe('risk-weighted placement (issue #70)', () => {
  const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

  function zonePlacement(source: TripSource, seed: number, routes: PlacementOptions['tilapiaRoutes']): PlacedFind[] {
    const special = CANAL_AREA.specialTreasureId;
    return placeTreasures(source.finds, source.spots, [], seed, {
      mustPlace: [],
      extras: [special],
      tuning: tripTreasureTuning(source.areaId),
      mainPath: source.mainPath,
      tilapiaRoutes: routes,
      lungeRange: TILAPIA.lungeRange,
    });
  }

  function endedFrom(start: TripState): TripState {
    return { ...start, phase: 'ended', ending: { reason: 'carriedHome', returned: [], bankedThisTrip: [] } };
  }

  it("places treasures as placeTreasures does with the zone's routes and lunge range", () => {
    for (const seed of SEEDS) {
      expect(createTrip(zone, LEGS, [], seed).placed).toEqual(zonePlacement(zone, seed, zone.tilapiaRoutes));
    }
  });

  it('differs from the placement without routes for some trip seed', () => {
    const differs = SEEDS.some(
      (seed) => JSON.stringify(createTrip(zone, LEGS, [], seed).placed) !== JSON.stringify(zonePlacement(zone, seed, [])),
    );
    expect(differs).toBe(true);
  });

  it("keeps the trip's routes when newTrip starts the next trip", () => {
    const done = endedFrom(createTrip(farZone, LEGS, [], DEFAULT_TRIP_SEED));
    for (const seed of SEEDS) {
      const next = newTrip(done, seed);
      expect(next.encounter.tilapiaRoutes).toEqual(farZone.tilapiaRoutes);
      expect(next.placed).toEqual(zonePlacement(farZone, seed, farZone.tilapiaRoutes));
    }
    const differs = SEEDS.some(
      (seed) => JSON.stringify(newTrip(done, seed).placed) !== JSON.stringify(zonePlacement(zone, seed, zone.tilapiaRoutes)),
    );
    expect(differs).toBe(true);
  });
});

describe('treasures per trip (B4, B9, H6)', () => {
  const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
  const SPECIAL = CANAL_AREA.specialTreasureId;
  const RETURNED_COMMONS = 3;
  const perTrip = tripTreasureTuning(zone.areaId).slots;

  function placedIds(trip: TripState): string[] {
    return trip.placed.map((find) => find.id);
  }

  function returnedCommons(): string[] {
    const commons = zone.finds.map((find) => find.id).filter((id) => treasureById(id)?.rarity === 'common');
    return commons.slice(0, RETURNED_COMMONS);
  }

  it('places the treasure slots plus the unbanked special, and the returned treasures on top', () => {
    const returned = returnedCommons();
    for (const seed of SEEDS) {
      expect(createTrip(zone, LEGS, [], seed).placed).toHaveLength(perTrip + 1);
      const withReturned = createTrip(zone, LEGS, [], seed, { returnedFinds: returned }).placed;
      expect(withReturned).toHaveLength(perTrip + 1 + returned.length);
    }
  });

  it('places the special on every trip until it is banked, then exactly the treasures per trip', () => {
    for (const seed of SEEDS) {
      expect(placedIds(createTrip(zone, LEGS, [], seed))).toContain(SPECIAL);
      const afterBanking = createTrip(zone, LEGS, [SPECIAL], seed);
      expect(placedIds(afterBanking)).not.toContain(SPECIAL);
      expect(afterBanking.placed).toHaveLength(perTrip);
    }
  });

  it('always places the returned treasures, even several of one rarity', () => {
    const returned = returnedCommons();
    expect(returned).toHaveLength(RETURNED_COMMONS);
    for (const seed of SEEDS) {
      const ids = placedIds(createTrip(zone, LEGS, [], seed, { returnedFinds: returned }));
      for (const id of returned) expect(ids).toContain(id);
    }
  });

  it('places a treasure lost on the last trip when newTrip starts the next one', () => {
    const seed = 42;
    const left = zone.finds.map((find) => find.id).find((id) => !placedIds(createTrip(zone, LEGS, [], seed)).includes(id));
    expect(left).toBeDefined();
    const lost = left as string;
    const start = createTrip(zone, LEGS, [], DEFAULT_TRIP_SEED);
    const done: TripState = { ...start, phase: 'ended', ending: { reason: 'carriedHome', returned: [lost], bankedThisTrip: [] } };
    const next = newTrip(done, seed);
    expect(placedIds(next)).toContain(lost);
    expect(next).toEqual(createTrip(zone, LEGS, [], seed, { returnedFinds: [lost] }));
  });

  it('ignores axolotl ids in the returned treasures', () => {
    const wild = axolotlFindId('wild');
    for (const seed of SEEDS) {
      const trip = createTrip(zone, LEGS, [], seed, { returnedFinds: [wild] });
      expect(trip.placed).toEqual(createTrip(zone, LEGS, [], seed).placed);
    }
  });

  it('takes the special from the area, with none for an area that has no data', () => {
    const otherArea: TripSource = { ...zone, areaId: 'test/area-2' };
    const seedsWithout = SEEDS.filter((seed) => !placedIds(createTrip(otherArea, LEGS, [], seed)).includes(SPECIAL));
    expect(seedsWithout.length).toBeGreaterThan(0);
  });

  it('weights the spots by the main swim path of the source', () => {
    const movedPath: TripSource = { ...zone, mainPath: [{ x: 120, y: 40 }, { x: 1840, y: 40 }] };
    const differs = SEEDS.some((seed) => {
      const moved = createTrip(movedPath, LEGS, [], seed).placed;
      return JSON.stringify(moved) !== JSON.stringify(createTrip(zone, LEGS, [], seed).placed);
    });
    expect(differs).toBe(true);
  });
});

describe('found treasures', () => {
  it('carries the pop-up data on pickedUp and in the snapshot, kept after banking', () => {
    const plant = { id: PLANT, name: 'Pond plant', category: 'decoration', rarity: 'common' };
    const picked = stepAt(createTrip(findZone), spotA);
    expect(picked.events).toEqual([{ type: 'pickedUp', id: PLANT, spotId: spotA.id, at: { x: 500, y: 200 }, found: plant }]);
    expect(tripSnapshot(picked.state).found).toEqual([plant]);
    const state = banked().state;
    expect(state.found).toEqual([PLANT, HAT]);
    expect(tripSnapshot(state).found).toEqual([foundInfo(PLANT), foundInfo(HAT)]);
  });

  it('resets each trip', () => {
    const fresh = newTrip(goHome(banked().state).state);
    expect(fresh.found).toEqual([]);
    expect(tripSnapshot(fresh).found).toEqual([]);
  });
});

describe('banked trip', () => {
  it('returns the same state for every step, including pause dts, with legs frozen', () => {
    const base = banked().state;
    const state: TripState = { ...base, encounter: { ...base.encounter, legs: regrowingLegs(0.3) } };
    for (const dt of [DT, 1, ...PAUSE_DTS]) {
      for (const pos of [home, spotA, inRange]) {
        const result = stepTrip(state, { axolotlPos: pos, reduced: false, dashing: false }, dt, ctx);
        expect(result.state).toBe(state);
        expect(result.events).toEqual([]);
        expect(result.impulse).toBeUndefined();
      }
    }
    expect(tripAxolotlPos(state)).toEqual(home);
  });
});

describe('goHome', () => {
  it('ends a banked trip with wentHome and every id banked this trip', () => {
    const state = banked().state;
    const result = goHome(state);
    expect(result.events).toEqual([]);
    expect(result.state.phase).toBe('ended');
    expect(result.state.ending).toEqual({
      reason: 'wentHome',
      returned: [],
      bankedThisTrip: [PLANT, HAT],
    });
    expect(result.state.holdings).toBe(state.holdings);
    expect(tripAxolotlPos(result.state)).toEqual(state.home);
  });

  it('ends from swimming inside the ring with an empty bag and changes nothing else', () => {
    const state = createTrip(findZone, LEGS, ['canal/pebble-9']);
    const result = goHome(state);
    expect(result.events).toEqual([]);
    expect(result.state.phase).toBe('ended');
    expect(result.state.holdings).toBe(state.holdings);
    expect(result.state.ending).toEqual({ reason: 'wentHome', returned: [], bankedThisTrip: [] });
  });

  it('banks a non-empty bag first when going home from swimming inside the ring', () => {
    const start = createTrip(findZone, LEGS, ['canal/pebble-9']);
    const state: TripState = { ...start, holdings: { bag: [PLANT], banked: ['canal/pebble-9'] } };
    const result = goHome(state);
    expect(result.events).toEqual([{ type: 'banked', ids: [PLANT] }]);
    expect(result.state.phase).toBe('ended');
    expect(result.state.holdings).toEqual({ bag: [], banked: ['canal/pebble-9', PLANT] });
    expect(result.state.ending).toEqual({ reason: 'wentHome', returned: [], bankedThisTrip: [PLANT] });
  });

  it('is a no-op outside the ring, while carrying or once ended', () => {
    const away = walk(createTrip(findZone), [spotA, outside]).state;
    const carry = carrying(zone, inRange, false).state;
    const carryInside: TripState = { ...carry, inHomeSpot: true };
    const done = ended();
    for (const state of [away, carry, carryInside, done]) {
      const result = goHome(state);
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    }
  });
});

describe('carried home with finds', () => {
  function carriedHome(): { start: TripState; arrived: Drive } {
    const start = createTrip(carryZone, LEGS, ['canal/pebble-9']);
    const carry = drive(start, { axolotlPos: inRange, reduced: false, dashing: false }, 'carryStart');
    expect(carry.state.holdings.bag).toEqual([BOAT]);
    const arrived = drive(carry.state, { axolotlPos: spotB, reduced: false, dashing: false }, 'arrivedHome');
    return { start, arrived };
  }

  it('returns exactly the bag ids, keeps banked, restores four legs and ends carriedHome', () => {
    const { arrived } = carriedHome();
    const { state } = arrived;
    expect(arrived.last.events).toEqual([{ type: 'arrivedHome', still: false, returned: [BOAT] }]);
    expect(state.phase).toBe('ended');
    expect(state.holdings).toEqual({ bag: [], banked: ['canal/pebble-9'] });
    expect(presentCount(state.encounter.legs)).toBe(LEGS.count);
    expect(state.ending).toEqual({ reason: 'carriedHome', returned: [BOAT], bankedThisTrip: [] });
    expect(state.inHomeSpot).toBe(true);
  });

  it('picks nothing up during the carry', () => {
    const { arrived } = carriedHome();
    expect(countOf(arrived.events, 'pickedUp')).toBe(0);
    expect(arrived.state.holdings.bag).toEqual([]);
  });

  it('lets returned finds be picked up again next trip', () => {
    const next = newTrip(carriedHome().arrived.state);
    const result = stepAt(next, spotC);
    expect(countOf(result.events, 'pickedUp')).toBe(1);
    expect(result.state.holdings.bag).toEqual([BOAT]);
  });
});

describe('snacks are not finds (A19)', () => {
  it('never puts a snack id in the bag, banked or returned', () => {
    const snackIds = new Set(zone.collectibles.map((snack) => snack.id));
    const placed = createTrip(zone).placed;
    const findIds = placed.map((find) => find.id);
    expect(findIds.length).toBeGreaterThan(0);
    const path: Point[] = [...zone.collectibles, ...placed];
    const swum = walk(createTrip(zone), path, true);
    expect(swum.state.phase).toBe('swimming');
    expect([...swum.state.holdings.bag].sort()).toEqual([...findIds].sort());
    const bankedTrip = stepAt(swum.state, home).state;
    expect([...bankedTrip.holdings.banked].sort()).toEqual([...findIds].sort());
    const carry = drive(swum.state, { axolotlPos: inRange, reduced: false, dashing: false }, 'carryStart').state;
    const arrived = drive(carry, { axolotlPos: inRange, reduced: false, dashing: false }, 'arrivedHome').state;
    const ids = [
      ...swum.state.holdings.bag,
      ...bankedTrip.holdings.banked,
      ...(arrived.ending?.returned ?? []),
    ];
    expect([...(arrived.ending?.returned ?? [])].sort()).toEqual([...findIds].sort());
    for (const id of ids) expect(snackIds.has(id)).toBe(false);
  });
});

describe('foundInfo', () => {
  it('gives the catalogue name, category and rarity of a treasure', () => {
    expect(foundInfo(PLANT)).toEqual({ id: PLANT, name: 'Pond plant', category: 'decoration', rarity: 'common' });
    expect(foundInfo(BOW)).toEqual({ id: BOW, name: 'Golden bow', category: 'wearable', rarity: 'legendary' });
  });

  it('throws for an id not in the catalogue', () => {
    expect(() => foundInfo('canal/pebble-9')).toThrow();
  });

  it('maps ids in id order and omits unknown ids', () => {
    expect(foundInfos([HAT, 'nope', PLANT])).toEqual([foundInfo(HAT), foundInfo(PLANT)]);
    expect(foundInfos([])).toEqual([]);
  });
});

describe('stepTrip swimming', () => {
  it('starts the carry exactly once when the fourth leg is lost, never passing carriedHome', () => {
    const { state, events, last } = carrying(zone, inRange, false);
    expect(countOf(events, 'carryStart')).toBe(1);
    expect(events.some((event) => (event.type as string) === 'carriedHome')).toBe(false);
    expect(countOf(events, 'hit')).toBe(LEGS.count);
    expect(state.phase).toBe('carrying');
    expect(presentCount(state.encounter.legs)).toBe(0);
    expect(last.impulse).toBeUndefined();
    expect(last.events.at(-1)).toEqual({ type: 'carryStart', from: inRange, still: false });
    expect(tripAxolotlPos(state)).toEqual(inRange);
  });

  it('passes a bump impulse through while swimming', () => {
    const edge: TripSource = { ...zone, tilapiaRoutes: [{ id: 'edge', waypoints: [{ x: 324, y: 200 }] }] };
    const result = stepTrip(createTrip(edge), { axolotlPos: { x: 300, y: 200 }, reduced: false, dashing: false }, DT, ctx);
    expect(result.events).toEqual([{ type: 'bump', sourceId: 'edge', from: { x: 324, y: 200 } }]);
    expect(result.impulse).toBeDefined();
  });
});

describe('stepTrip full-motion carry', () => {
  it('floats straight home without moving away, arrives once on time and restores four legs', () => {
    const start = carrying(farZone, farTarget, false).state;
    const duration = expectedDuration(farTarget, start.home);
    expect(duration).toBeGreaterThan(CARRY.minTime);
    expect(duration).toBeLessThan(CARRY.maxTime);
    const bounds = swimBounds();
    let current = start;
    let previous = distanceToHome(start, farTarget);
    let arrivals = 0;
    let seconds = 0;
    while (current.phase === 'carrying' && seconds < 10) {
      const result = stepTrip(current, { axolotlPos: farTarget, reduced: false, dashing: false }, DT, ctx);
      current = result.state;
      seconds += DT;
      arrivals += countOf(result.events, 'arrivedHome');
      const pos = tripAxolotlPos(current) as Point;
      expect(distanceToHome(current, pos)).toBeLessThanOrEqual(previous);
      expect(pos.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(pos.x).toBeLessThanOrEqual(bounds.maxX);
      expect(pos.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(pos.y).toBeLessThanOrEqual(bounds.maxY);
      previous = distanceToHome(current, pos);
    }
    expect(arrivals).toBe(1);
    expect(Math.abs(seconds - duration)).toBeLessThanOrEqual(DT + 1e-9);
    expect(current.phase).toBe('ended');
    expect(tripAxolotlPos(current)).toEqual(current.home);
    expect(current.carry?.pos).toEqual(current.home);
    expect(presentCount(current.encounter.legs)).toBe(LEGS.count);
    expect(isProtected(current.encounter.legs)).toBe(false);
    expect(current.encounter.legs.regrowQueue).toEqual([]);
  });

  it('keeps legs frozen while carrying', () => {
    const start = carrying(zone, inRange, false).state;
    const next = stepTrip(start, { axolotlPos: inRange, reduced: false, dashing: false }, DT, ctx).state;
    expect(next.encounter).toBe(start.encounter);
  });

  it('still takes minTime for a zero-distance carry', () => {
    const start = carrying({ ...zone, start: inRange }, inRange, false);
    expect(start.state.carry?.duration).toBe(CARRY.minTime);
    const arrived = drive(start.state, { axolotlPos: inRange, reduced: false, dashing: false }, 'arrivedHome');
    expect(arrived.state.phase).toBe('ended');
    expect(Math.abs(arrived.seconds - CARRY.minTime)).toBeLessThanOrEqual(DT + 1e-9);
  });

  it('caps dt at SWIM.dtMax', () => {
    const start = carrying(farZone, farTarget, false).state;
    const next = stepTrip(start, { axolotlPos: farTarget, reduced: false, dashing: false }, 1, ctx).state;
    expect(next.carry?.elapsed).toBeCloseTo(SWIM.dtMax, 12);
    expect(next.phase).toBe('carrying');
  });
});

describe('stepTrip still carry', () => {
  it('holds at the start point, then arrives after stillHold', () => {
    const start = carrying(farZone, farTarget, true);
    expect(start.last.events.at(-1)).toEqual({ type: 'carryStart', from: farTarget, still: true });
    expect(start.state.carry?.duration).toBe(CARRY.stillHold);
    let current = start.state;
    let seconds = 0;
    const arrivals: TripEvent[] = [];
    while (current.phase === 'carrying' && seconds < 10) {
      const result = stepTrip(current, { axolotlPos: farTarget, reduced: true, dashing: false }, DT, ctx);
      current = result.state;
      seconds += DT;
      arrivals.push(...result.events);
      if (current.phase === 'carrying') expect(tripAxolotlPos(current)).toEqual(farTarget);
    }
    expect(arrivals).toEqual([{ type: 'arrivedHome', still: true, returned: [] }]);
    expect(Math.abs(seconds - CARRY.stillHold)).toBeLessThanOrEqual(DT + 1e-9);
    expect(tripAxolotlPos(current)).toEqual(current.home);
  });
});

describe('carry follows reduced motion (A11, X3)', () => {
  interface CarryRun {
    state: TripState;
    events: TripEvent[];
    seconds: number;
  }

  function carryStep(state: TripState, reduced: boolean, dt = DT): TripStepResult {
    return stepTrip(state, { axolotlPos: farTarget, reduced, dashing: false }, dt, ctx);
  }

  function holdFor(state: TripState, reduced: boolean, frames: number): TripState {
    let current = state;
    for (let i = 0; i < frames; i++) current = carryStep(current, reduced).state;
    expect(current.phase).toBe('carrying');
    return current;
  }

  function runUntilEnded(state: TripState, reduced: boolean, limit = 20): CarryRun {
    let current = state;
    const events: TripEvent[] = [];
    let seconds = 0;
    while (current.phase === 'carrying' && seconds < limit) {
      const result = carryStep(current, reduced);
      current = result.state;
      seconds += DT;
      events.push(...result.events);
    }
    return { state: current, events, seconds };
  }

  function carryPosOf(state: TripState): Point {
    return tripAxolotlPos(state) as Point;
  }

  function flippedReduced(final: boolean, frame: number): boolean {
    const flips = Math.min(Math.floor(frame / 5), 12);
    return flips % 2 === 1 ? !final : final;
  }

  it('turning on mid-carry holds where the axolotl is, then arrives once still', () => {
    const start = carrying(farZone, farTarget, false).state;
    const duration = start.carry?.duration as number;
    const mid = holdFor(start, false, 30);
    const here = carryPosOf(mid);
    expect(here).not.toEqual(farTarget);
    let current = mid;
    const events: TripEvent[] = [];
    let seconds = 0;
    while (current.phase === 'carrying' && seconds < 20) {
      const result = carryStep(current, true);
      current = result.state;
      seconds += DT;
      events.push(...result.events);
      if (current.phase === 'carrying') {
        expect(carryPosOf(current)).toEqual(here);
        expect(current.carry?.still).toBe(true);
      }
    }
    expect(events).toEqual([{ type: 'arrivedHome', still: true, returned: [] }]);
    const expected = Math.min(duration - 30 * DT, CARRY.stillHold);
    expect(Math.abs(seconds - expected)).toBeLessThanOrEqual(DT + 1e-9);
    expect(current.phase).toBe('ended');
    expect(carryPosOf(current)).toEqual(current.home);
  });

  it('turning on never makes the carry longer', () => {
    const start = carrying(farZone, farTarget, false).state;
    const duration = start.carry?.duration as number;
    for (const fraction of [0.1, 0.5, 0.9]) {
      const frames = Math.round((fraction * duration) / DT);
      const mid = holdFor(start, false, frames);
      const run = runUntilEnded(mid, true);
      expect(run.state.phase).toBe('ended');
      expect(countOf(run.events, 'arrivedHome')).toBe(1);
      expect(frames * DT + run.seconds).toBeLessThanOrEqual(duration + DT + 1e-9);
    }
  });

  it('turning off mid-carry floats home from where the axolotl is, timed like a fresh carry', () => {
    const start = carrying(farZone, farTarget, true).state;
    const mid = holdFor(start, true, 30);
    const here = carryPosOf(mid);
    expect(here).toEqual(farTarget);
    const expected = expectedDuration(here, mid.home);
    let current = mid;
    let previous = distanceToHome(mid, here);
    const events: TripEvent[] = [];
    let seconds = 0;
    while (current.phase === 'carrying' && seconds < 20) {
      const result = carryStep(current, false);
      current = result.state;
      seconds += DT;
      events.push(...result.events);
      const distance = distanceToHome(current, carryPosOf(current));
      expect(distance).toBeLessThanOrEqual(previous);
      previous = distance;
      if (current.phase === 'carrying') expect(current.carry?.still).toBe(false);
    }
    expect(events).toEqual([{ type: 'arrivedHome', still: false, returned: [] }]);
    expect(Math.abs(seconds - expected)).toBeLessThanOrEqual(DT + 1e-9);
    expect(current.phase).toBe('ended');
    expect(carryPosOf(current)).toEqual(current.home);
  });

  it('toggling many times never moves away or moves while still, and arrives once as it ends', () => {
    for (const final of [true, false]) {
      let current = carrying(farZone, farTarget, final).state;
      let previousPos = carryPosOf(current);
      let previous = distanceToHome(current, previousPos);
      const events: TripEvent[] = [];
      let frame = 0;
      while (current.phase === 'carrying' && frame * DT < 20) {
        const reduced = flippedReduced(final, frame);
        const result = carryStep(current, reduced);
        current = result.state;
        frame += 1;
        events.push(...result.events);
        const pos = carryPosOf(current);
        const distance = distanceToHome(current, pos);
        expect(distance).toBeLessThanOrEqual(previous);
        if (current.phase === 'carrying') {
          expect(current.carry?.still).toBe(reduced);
          if (reduced) expect(pos).toEqual(previousPos);
        }
        previous = distance;
        previousPos = pos;
      }
      expect(frame).toBeGreaterThan(60);
      expect(events).toEqual([{ type: 'arrivedHome', still: final, returned: [] }]);
      for (const reduced of [true, false, true]) {
        const after = carryStep(current, reduced);
        expect(after.state).toBe(current);
        expect(after.events).toEqual([]);
      }
    }
  });

  it('toggling while paused changes nothing until the next real step', () => {
    const mid = holdFor(carrying(farZone, farTarget, false).state, false, 30);
    const here = carryPosOf(mid);
    let reduced = false;
    for (const dt of [...PAUSE_DTS, ...PAUSE_DTS]) {
      reduced = !reduced;
      const result = carryStep(mid, reduced, dt);
      expect(result.state).toBe(mid);
      expect(result.events).toEqual([]);
    }
    expect(reduced).toBe(false);
    const next = carryStep(mid, true);
    expect(next.events).toEqual([]);
    expect(next.state.carry?.still).toBe(true);
    expect(carryPosOf(next.state)).toEqual(here);
    const resumed = carryStep(mid, reduced);
    expect(resumed.state.carry?.still).toBe(false);
    expect(distanceToHome(resumed.state, carryPosOf(resumed.state))).toBeLessThan(distanceToHome(mid, here));
  });

  it('turning on in the step the carry would end arrives in that step, still, once', () => {
    let current = carrying(farZone, farTarget, false).state;
    while (current.carry && current.carry.duration - current.carry.elapsed >= DT) {
      current = carryStep(current, false).state;
    }
    expect(current.phase).toBe('carrying');
    const result = carryStep(current, true);
    expect(result.events).toEqual([{ type: 'arrivedHome', still: true, returned: [] }]);
    expect(result.state.phase).toBe('ended');
    expect(carryStep(result.state, true).events).toEqual([]);
  });

  describe('followReducedMotion', () => {
    const to: Point = Object.freeze({ x: 100, y: 300 });
    function frozenCarry(still: boolean, elapsed: number, duration: number): CarryState {
      return Object.freeze({
        from: Object.freeze({ x: 900, y: 200 }),
        to,
        pos: Object.freeze({ x: 700, y: 220 }),
        elapsed,
        duration,
        still,
      });
    }

    it('returns the same carry when reduced motion has not changed', () => {
      const moving = frozenCarry(false, 1, 4);
      const holding = frozenCarry(true, 0.5, CARRY.stillHold);
      expect(followReducedMotion(moving, false, CARRY)).toBe(moving);
      expect(followReducedMotion(holding, true, CARRY)).toBe(holding);
    });

    it('turning on holds at pos for the rest of the carry, at most stillHold', () => {
      const long = frozenCarry(false, 1, 4);
      expect(followReducedMotion(long, true, CARRY)).toEqual({
        from: { x: 700, y: 220 },
        to: { x: 100, y: 300 },
        pos: { x: 700, y: 220 },
        elapsed: 0,
        duration: CARRY.stillHold,
        still: true,
      });
      const short = frozenCarry(false, 3.5, 4);
      expect(followReducedMotion(short, true, CARRY).duration).toBe(0.5);
    });

    it('turning off starts a fresh full-motion carry from pos', () => {
      const holding = frozenCarry(true, 0.5, CARRY.stillHold);
      const pos = { x: 700, y: 220 };
      expect(followReducedMotion(holding, false, CARRY)).toEqual({
        from: pos,
        to: { x: 100, y: 300 },
        pos,
        elapsed: 0,
        duration: expectedDuration(pos, to),
        still: false,
      });
    });

    it('never mutates or shares the input points', () => {
      for (const still of [false, true]) {
        const carry = frozenCarry(still, 0.5, 4);
        const before = structuredClone(carry);
        const next = followReducedMotion(carry, !still, CARRY);
        expect(next.pos).not.toBe(carry.pos);
        expect(next.from).not.toBe(carry.pos);
        expect(next.to).not.toBe(carry.to);
        expect(carry).toEqual(before);
      }
    });
  });
});

describe('stepTrip pause', () => {
  it('returns the same state with no events for a paused dt in every phase', () => {
    const phases = [createTrip(zone), carrying(zone, inRange, false).state, ended()];
    for (const state of phases) {
      for (const dt of PAUSE_DTS) {
        const result = stepTrip(state, { axolotlPos: inRange, reduced: false, dashing: false }, dt, ctx);
        expect(result.state).toBe(state);
        expect(result.events).toEqual([]);
        expect(result.impulse).toBeUndefined();
      }
    }
  });
});

describe('ended trip', () => {
  it('ignores steps and reports phase ended with four legs', () => {
    const done = ended();
    const result = stepTrip(done, { axolotlPos: inRange, reduced: true, dashing: false }, DT, ctx);
    expect(result.state).toBe(done);
    expect(result.events).toEqual([]);
    const snapshot = tripSnapshot(done);
    expect(snapshot.phase).toBe('ended');
    expect(snapshot.legs.present).toBe(LEGS.count);
  });
});

describe('newTrip', () => {
  it('starts a fresh swimming trip from an ended one', () => {
    const fresh = newTrip(ended());
    expect(fresh.phase).toBe('swimming');
    expect(fresh.carry).toBeNull();
    expect(fresh.home).toEqual(zone.start);
    expect(presentCount(fresh.encounter.legs)).toBe(LEGS.count);
    expect(fresh.encounter).toEqual(createEncounter(zone));
  });

  it('keeps banked finds with an empty bag and four legs (A18)', () => {
    const done = goHome(banked().state).state;
    const fresh = newTrip(done);
    expect(fresh.phase).toBe('swimming');
    expect(fresh.holdings).toEqual({ bag: [], banked: [PLANT, HAT] });
    expect(presentCount(fresh.encounter.legs)).toBe(LEGS.count);
    expect(fresh.ending).toBeNull();
    expect(fresh.bankedThisTrip).toEqual([]);
    expect(fresh.justBanked).toEqual([]);
    expect(fresh.inHomeSpot).toBe(true);
    expect(fresh.finds).toEqual(findZone.finds);
    expect(fresh.spots).toEqual(findZone.spots);
    expect(fresh.placed).toEqual([]);
    expect(fresh.found).toEqual([]);
    expect(fresh.homeSpot).toEqual(findZone.homeSpot);
  });

  it('returns the same object while swimming or carrying', () => {
    const swimming = createTrip(zone);
    const carry = carrying(zone, inRange, false).state;
    expect(newTrip(swimming)).toBe(swimming);
    expect(newTrip(carry)).toBe(carry);
  });
});

describe('snapshots', () => {
  it('quantizes regrow progress to LEG_PROGRESS_STEPS or a given step count', () => {
    const legs = regrowingLegs(0.37);
    const expected = Math.floor(0.37 * LEG_PROGRESS_STEPS) / LEG_PROGRESS_STEPS;
    expect(legsSnapshot(legs).slots[0].progress).toBeCloseTo(expected, 12);
    expect(legsSnapshot(legs, 4).slots[0].progress).toBe(0.25);
    expect(legsSnapshot(legs).present).toBe(LEGS.count - 1);
    expect(legsSnapshot(legs).protected).toBe(true);
  });

  it('detects phase-only and leg-only changes and ignores sub-step progress', () => {
    const swimming = createTrip(zone);
    const base = { ...swimming, encounter: { ...swimming.encounter, legs: regrowingLegs(0.31) } };
    const subStep = { ...swimming, encounter: { ...swimming.encounter, legs: regrowingLegs(0.39) } };
    const nextStep = { ...swimming, encounter: { ...swimming.encounter, legs: regrowingLegs(0.41) } };
    const phaseOnly: TripState = { ...base, phase: 'carrying' };
    expect(sameTripSnapshot(tripSnapshot(base), tripSnapshot(subStep))).toBe(true);
    expect(sameTripSnapshot(tripSnapshot(base), tripSnapshot(nextStep))).toBe(false);
    expect(sameTripSnapshot(tripSnapshot(base), tripSnapshot(phaseOnly))).toBe(false);
  });

  it('reports the bag ids, banked count, ring, latest banking and ending', () => {
    const state = banked().state;
    expect(tripSnapshot(state)).toEqual({
      phase: 'banked',
      legs: legsSnapshot(state.encounter.legs),
      bag: [],
      banked: 2,
      inHomeSpot: true,
      justBanked: [PLANT, HAT],
      found: [foundInfo(PLANT), foundInfo(HAT)],
      ending: null,
      rescue: null,
      factCardDue: null,
      litGlowPlants: [],
      glowPlantHint: null,
    });
    const done = tripSnapshot(goHome(state).state);
    expect(done.ending).toEqual({ reason: 'wentHome', returned: [], bankedThisTrip: [PLANT, HAT] });
  });

  it('starts idle as a whole axolotl swimming at the Home Spot with nothing found', () => {
    expect(idleTripSnapshot()).toEqual(tripSnapshot(createTrip(zone)));
  });

  it('detects a change in each find and ending field', () => {
    const base: TripSnapshot = {
      ...idleTripSnapshot(),
      bag: ['a'],
      banked: 1,
      justBanked: ['b'],
      found: [foundInfo(PLANT)],
      ending: { reason: 'wentHome', returned: ['c'], bankedThisTrip: ['b'] },
    };
    const ending = base.ending as NonNullable<TripSnapshot['ending']>;
    const copy: TripSnapshot = {
      ...base,
      bag: ['a'],
      found: [{ ...foundInfo(PLANT) }],
      ending: { ...ending, returned: ['c'] },
    };
    expect(sameTripSnapshot(base, copy)).toBe(true);
    const changes: TripSnapshot[] = [
      { ...base, bag: ['a', 'x'] },
      { ...base, bag: ['x'] },
      { ...base, banked: 2 },
      { ...base, inHomeSpot: false },
      { ...base, justBanked: [] },
      { ...base, justBanked: ['x'] },
      { ...base, found: [] },
      { ...base, found: [foundInfo(HAT)] },
      { ...base, found: [foundInfo(PLANT), foundInfo(HAT)] },
      { ...base, ending: null },
      { ...base, ending: { ...ending, reason: 'carriedHome' } },
      { ...base, ending: { ...ending, returned: [] } },
      { ...base, ending: { ...ending, bankedThisTrip: ['x'] } },
      { ...base, litGlowPlants: ['x'] },
      { ...base, glowPlantHint: 'x' },
    ];
    for (const changed of changes) {
      expect(sameTripSnapshot(base, changed)).toBe(false);
      expect(sameTripSnapshot(changed, base)).toBe(false);
    }
  });

  it('copies arrays so a snapshot does not share state', () => {
    const state = banked().state;
    const snapshot = tripSnapshot(state);
    expect(snapshot.justBanked).not.toBe(state.justBanked);
    expect(snapshot.found).not.toBe(tripSnapshot(state).found);
  });
});

describe('trip contract', () => {
  it('keeps trip event names unique and apart from game events', () => {
    const tripValues = Object.values(TRIP_EVENTS);
    const gameValues = new Set<string>(Object.values(GAME_EVENTS));
    expect(new Set(tripValues).size).toBe(tripValues.length);
    for (const name of tripValues) expect(gameValues.has(name)).toBe(false);
  });

  it('keeps trip registry keys unique and apart from game registry keys', () => {
    const tripKeys = Object.values(TRIP_REGISTRY_KEYS);
    const gameKeys = new Set<string>(Object.values(REGISTRY_KEYS));
    expect(new Set(tripKeys).size).toBe(tripKeys.length);
    for (const key of tripKeys) expect(gameKeys.has(key)).toBe(false);
  });

  it('includes the banking requests and the banking hint key', () => {
    expect(TRIP_EVENTS.REQUEST_KEEP_EXPLORING).toBe('request-keep-exploring');
    expect(TRIP_EVENTS.REQUEST_GO_HOME).toBe('request-go-home');
    expect(TRIP_REGISTRY_KEYS.bankingHintShown).toBe('bankingHintShown');
  });
});

describe('determinism', () => {
  it('replays the same trip without Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const input: TripInput = { axolotlPos: farTarget, reduced: false, dashing: false };
    const first = drive(carrying(farZone, farTarget, false).state, input, 'arrivedHome');
    const second = drive(carrying(farZone, farTarget, false).state, input, 'arrivedHome');
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual(first.events);
    expect(random).not.toHaveBeenCalled();
  });

  it('replays the same pickup, banking and going home without Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const path = [spotA, outside, spotB, outside, home];
    const first = walk(createTrip(findZone), path);
    const second = walk(createTrip(findZone), path);
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual(first.events);
    expect(goHome(second.state)).toEqual(goHome(first.state));
    expect(random).not.toHaveBeenCalled();
  });

  it('replays the same placement, pots and next trip without Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const path = [outside, potSpot, potSpot, outside, home];
    const first = walk(potTrip(), path, true);
    const second = walk(potTrip(), path, true);
    expect(second.state).toEqual(first.state);
    expect(second.events).toEqual(first.events);
    expect(newTrip(goHome(second.state).state)).toEqual(newTrip(goHome(first.state).state));
    expect(createTrip(zone)).toEqual(createTrip(zone));
    expect(random).not.toHaveBeenCalled();
  });
});

const WILD = axolotlFindId('wild');
const strandPlace: Point = { x: 800, y: 200 };

function strandingAt(pos: Point, morph: RealMorphId = 'wild'): Stranding {
  return { id: axolotlFindId(morph), morph, sex: 'boy', placeId: 'test/strand', x: pos.x, y: pos.y, met: false };
}

function rescueTrip(source: TripSource = findZone, place: Point = strandPlace, banked: string[] = []): TripState {
  return createTrip(source, LEGS, banked, DEFAULT_TRIP_SEED, { stranding: strandingAt(place) });
}

function gap(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function stepToward(from: Point, to: Point, distance: number): Point {
  const span = gap(from, to);
  if (span <= distance) return { x: to.x, y: to.y };
  return { x: from.x + ((to.x - from.x) * distance) / span, y: from.y + ((to.y - from.y) * distance) / span };
}

describe('stranded axolotl rescue (C3 to C5, A11 to A16)', () => {
  it('starts with no stranded axolotl and the tilapia card unseen by default', () => {
    const trip = createTrip(zone);
    expect(trip.rescue).toBeNull();
    expect(trip.factCardsSeen).toEqual([]);
    expect(trip.met).toEqual([]);
    const stranded = rescueTrip();
    expect(stranded.rescue?.pos).toEqual(strandPlace);
    expect(tripSnapshot(stranded).rescue).toEqual({ id: WILD, morph: 'wild', status: 'waiting' });
  });

  it('places the same treasures for a seed with and without a stranding (B4)', () => {
    for (const seed of [1, 7, 42, DEFAULT_TRIP_SEED]) {
      const stranding = pickStranding([], null, zone.strandingPlaces, seed);
      expect(stranding).not.toBeNull();
      expect(createTrip(zone, LEGS, [], seed, { stranding }).placed).toEqual(createTrip(zone, LEGS, [], seed).placed);
    }
  });

  it('rescues once on reach: in the bag and found, not in snapshot found, following', () => {
    const { state, events } = walk(rescueTrip(), [spotA, outside, strandPlace, strandPlace, strandPlace]);
    expect(events.filter((event) => event.type === 'rescued')).toEqual([
      { type: 'rescued', id: WILD, morph: 'wild', at: strandPlace },
    ]);
    expect(state.holdings.bag).toEqual([PLANT, WILD]);
    expect(state.found).toEqual([PLANT, WILD]);
    expect(state.rescue?.met).toBe(true);
    const snapshot = tripSnapshot(state);
    expect(snapshot.bag).toEqual([PLANT, WILD]);
    expect(snapshot.found).toEqual([foundInfo(PLANT)]);
    expect(snapshot.rescue).toEqual({ id: WILD, morph: 'wild', status: 'following' });
  });

  it('does not rescue just outside the reach radius', () => {
    const away: Point = { x: strandPlace.x + RESCUE.reachRadius + 0.5, y: strandPlace.y };
    const result = stepAt(rescueTrip(), away);
    expect(result.events).toEqual([]);
    expect(result.state.holdings.bag).toEqual([]);
    expect(tripSnapshot(result.state).rescue?.status).toBe('waiting');
  });

  it('keeps the follower within maxLag of the axolotl on a short walk', () => {
    let current = walk(rescueTrip(), [strandPlace]).state;
    for (let i = 1; i <= 90; i++) {
      const pos: Point = { x: strandPlace.x + i * 4, y: strandPlace.y + i };
      current = stepAt(current, pos).state;
      const follower = current.rescue as NonNullable<TripState['rescue']>;
      expect(gap(follower.pos, pos)).toBeLessThanOrEqual(RESCUE.maxLag + 1e-9);
    }
    expect(current.rescue?.pos.x).toBeGreaterThan(strandPlace.x);
    expect(tripSnapshot(current).rescue?.status).toBe('following');
  });

  it('banks the axolotl with the bag in the ring, safe, counting only treasures as banked', () => {
    const following = walk(rescueTrip(findZone, strandPlace, ['canal/pebble-9']), [spotA, strandPlace, outside]).state;
    const result = stepAt(following, home);
    expect(result.events).toEqual([{ type: 'banked', ids: [PLANT, WILD] }]);
    const { state } = result;
    expect(state.phase).toBe('banked');
    expect(state.justBanked).toEqual([PLANT, WILD]);
    expect(state.holdings.banked).toEqual(['canal/pebble-9', PLANT, WILD]);
    const snapshot = tripSnapshot(state);
    expect(snapshot.banked).toBe(2);
    expect(snapshot.rescue?.status).toBe('safe');
    const resting = walk(keepExploring(state), Array.from({ length: 120 }, () => home));
    expect(countOf(resting.events, 'rescued')).toBe(0);
    expect(resting.state.rescue?.pos).toEqual({ x: home.x + RESCUE.restOffset.x, y: home.y + RESCUE.restOffset.y });
    expect(tripSnapshot(resting.state).rescue?.status).toBe('safe');
  });

  it('banks a following axolotl when going home', () => {
    const following = walk(rescueTrip(), [strandPlace]).state;
    const result = goHome({ ...following, inHomeSpot: true });
    expect(result.events).toEqual([{ type: 'banked', ids: [WILD] }]);
    expect(result.state.ending).toEqual({ reason: 'wentHome', returned: [], bankedThisTrip: [WILD] });
    expect(tripSnapshot(result.state).rescue?.status).toBe('safe');
  });

  it('sends a following axolotl back to its place when carried home, returned and waiting (C5)', () => {
    const place: Point = { x: farTarget.x + 80, y: farTarget.y };
    const path = Array.from({ length: 20 }, (_, i) => ({ x: place.x - (i + 1) * 4, y: place.y }));
    const walked = walk(rescueTrip(farZone, place), [place, ...path]).state;
    expect(walked.phase).toBe('swimming');
    expect(walked.rescue?.pos).not.toEqual(place);
    const carry = drive(walked, { axolotlPos: farTarget, reduced: false, dashing: false }, 'carryStart');
    expect(carry.seconds).toBeLessThanOrEqual(20);
    expect(carry.state.phase).toBe('carrying');
    expect(carry.state.rescue?.pos).toEqual(place);
    expect(carry.state.rescue?.trail).toEqual([]);
    const arrived = drive(carry.state, { axolotlPos: farTarget, reduced: false, dashing: false }, 'arrivedHome').state;
    expect(arrived.ending?.returned).toContain(WILD);
    expect(arrived.holdings.bag).toEqual([]);
    expect(tripSnapshot(arrived).rescue?.status).toBe('waiting');
  });

  it('keeps a banked axolotl safe and out of returned when carried home', () => {
    const bankedState = stepAt(walk(rescueTrip(farZone), [strandPlace, outside]).state, home).state;
    expect(bankedState.phase).toBe('banked');
    const carry = drive(keepExploring(bankedState), { axolotlPos: farTarget, reduced: false, dashing: false }, 'carryStart');
    expect(carry.state.phase).toBe('carrying');
    expect(tripSnapshot(carry.state).rescue?.status).toBe('safe');
    const arrived = drive(carry.state, { axolotlPos: farTarget, reduced: false, dashing: false }, 'arrivedHome').state;
    expect(arrived.ending?.returned).not.toContain(WILD);
    expect(arrived.holdings.banked).toContain(WILD);
    expect(tripSnapshot(arrived).rescue?.status).toBe('safe');
  });

  it('cannot be hit: the follower position never changes the encounter or its events', () => {
    const start = rescueTrip(zone, inRange);
    const lunging = drive(start, { axolotlPos: inRange, reduced: false, dashing: false }, 'lunge', 20);
    const lunge = lunging.last.events.find((event) => event.type === 'lunge');
    expect(lunge).toBeDefined();
    expect(lunging.state.holdings.bag).toContain(WILD);
    const rescue = lunging.state.rescue as NonNullable<TripState['rescue']>;
    const lunger = lunging.state.encounter.predators.find((tilapia) => tilapia.routeId === lunge?.sourceId);
    expect(lunger?.phase).toBe('lunge');
    const onTilapia: TripState = { ...lunging.state, rescue: { ...rescue, pos: { ...(lunger as { pos: Point }).pos } } };
    const away: TripState = { ...lunging.state, rescue: { ...rescue, pos: { x: home.x, y: home.y } } };
    const path = Array.from({ length: 60 }, () => inRange);
    const a = walk(onTilapia, path);
    const b = walk(away, path);
    expect(a.state.encounter).toEqual(b.state.encounter);
    expect(a.events).toEqual(b.events);
    expect(countOf(a.events, 'hit')).toBeGreaterThan(0);
    expect(a.last.impulse).toEqual(b.last.impulse);
  });

  it('starts the next trip with no stranded axolotl', () => {
    const done = goHome({ ...walk(rescueTrip(), [strandPlace]).state, inHomeSpot: true }).state;
    const fresh = newTrip(done);
    expect(fresh.rescue).toBeNull();
    expect(fresh.factCardsSeen).toEqual([]);
    expect(fresh.met).toEqual([]);
  });
});

describe('meeting a tilapia', () => {
  const meetZone: TripSource = { ...zone, finds: [], spots: [], tilapiaRoutes: [{ id: 'meet', waypoints: [{ x: 400, y: 200 }] }] };
  const inSafe: Point = { x: zone.safeArea.x1 - 10, y: 200 };
  const outSafe: Point = { x: zone.safeArea.x1 + 10, y: 200 };

  it('is not met inside the safe area, then met once outside within range', () => {
    const safe = walk(createTrip(meetZone), [home, inSafe, inSafe]).state;
    expect(safe.met).toEqual([]);
    expect(tripSnapshot(safe).factCardDue).toBeNull();
    const met = stepAt(safe, outSafe).state;
    expect(met.met).toEqual(['tilapia']);
    expect(tripSnapshot(met).factCardDue).toBe('tilapia');
    const back = stepAt(met, inSafe).state;
    expect(back.met).toEqual(['tilapia']);
  });

  it('is not met outside the safe area when every tilapia is out of range', () => {
    expect(walk(createTrip(findZone), [outside, spotA]).state.met).toEqual([]);
  });

  it('is never due when the tilapia card was already seen', () => {
    const seen = createTrip(meetZone, LEGS, [], DEFAULT_TRIP_SEED, { factCardsSeen: ['tilapia'] });
    const met = stepAt(seen, outSafe).state;
    expect(met.met).toEqual(['tilapia']);
    expect(tripSnapshot(met).factCardDue).toBeNull();
  });

  it('is no longer due once the card is marked seen, and stays met', () => {
    const met = stepAt(createTrip(meetZone), outSafe).state;
    expect(tripSnapshot(met).factCardDue).toBe('tilapia');
    const seen = markFactCardSeen(met, 'tilapia');
    expect(seen).not.toBe(met);
    expect(seen).toEqual({ ...met, factCardsSeen: ['tilapia'] });
    expect(met.factCardsSeen).toEqual([]);
    expect(tripSnapshot(seen).factCardDue).toBeNull();
    const later = stepAt(seen, outSafe).state;
    expect(later.met).toEqual(['tilapia']);
    expect(tripSnapshot(later).factCardDue).toBeNull();
  });

  it('returns the same object when the card was already seen', () => {
    const seen = createTrip(meetZone, LEGS, [], DEFAULT_TRIP_SEED, { factCardsSeen: ['tilapia'] });
    expect(markFactCardSeen(seen, 'tilapia')).toBe(seen);
  });

  it('meets a tilapia on a step before any telegraph when swimming toward route 0', () => {
    let current = createTrip(zone);
    let pos: Point = { x: home.x, y: home.y };
    let metStep = -1;
    let telegraphStep = -1;
    for (let i = 0; i < 20 * 60 && telegraphStep < 0; i++) {
      pos = stepToward(pos, current.encounter.predators[0].pos, 150 * DT);
      const result = stepAt(current, pos);
      current = result.state;
      if (metStep < 0 && current.met.includes('tilapia')) metStep = i;
      if (result.events.some((event) => event.type === 'telegraph')) telegraphStep = i;
    }
    expect(metStep).toBeGreaterThanOrEqual(0);
    expect(telegraphStep).toBeGreaterThan(metStep);
  });
});

describe('meeting hazards and predators', () => {
  const testFact = (id: string): FactCard => ({ id, name: id, title: id, body: id });
  const TEST_PIKE: PredatorSpecies = { ...TILAPIA_SPECIES, id: 'test-pike', name: 'Test pike', fact: testFact('test-pike') };
  const TEST_MUD: HazardType = {
    id: 'test-mud',
    name: 'Test mud',
    costsLeg: false,
    reach: 0,
    meetRange: 60,
    fact: testFact('test-mud'),
  };
  const mudAt = (id: string, x: number) => ({ id, type: TEST_MUD, shape: { kind: 'circle' as const, x, y: 200, r: 10 } });
  const pikeAt = (id: string, x: number) => ({ id, waypoints: [{ x, y: 200 }], species: TEST_PIKE });
  const threatZone: TripSource = {
    ...zone,
    finds: [],
    spots: [],
    tilapiaRoutes: [],
    predatorRoutes: [pikeAt('pike', 1300)],
    hazards: [mudAt('mud-1', 500), mudAt('mud-2', 1250)],
  };
  const atMud: Point = { x: 500 + 10 + 60, y: 200 };
  const pastMud: Point = { x: 500 + 10 + 60.5, y: 200 };
  const atBoth: Point = { x: 1240, y: 200 };
  const inSafe: Point = { x: zone.safeArea.x1 - 10, y: 200 };

  it('meets a hazard at exactly its meet range from the shape edge, not past it', () => {
    expect(stepAt(createTrip(threatZone), pastMud).state.met).toEqual([]);
    expect(stepAt(createTrip(threatZone), atMud).state.met).toEqual(['test-mud']);
  });

  it('gives the hazard and predator ids met, each once, in meet order', () => {
    const mud = stepAt(createTrip(threatZone), atMud).state;
    expect(mud.met).toEqual(['test-mud']);
    const both = stepAt(mud, atBoth).state;
    expect(both.met).toEqual(['test-mud', 'test-pike']);
    expect(walk(both, [atMud, atBoth]).state.met).toEqual(['test-mud', 'test-pike']);
  });

  it('lists predators before hazards when both are met on one step', () => {
    expect(stepAt(createTrip(threatZone), atBoth).state.met).toEqual(['test-pike', 'test-mud']);
  });

  it('meets nothing inside the safe area', () => {
    const near: TripSource = { ...threatZone, hazards: [mudAt('mud-near', zone.safeArea.x1 + 20)] };
    expect(stepAt(createTrip(near), inSafe).state.met).toEqual([]);
  });

  it('makes the first met card not yet seen due, in meet order', () => {
    const both = walk(createTrip(threatZone), [atMud, atBoth]).state;
    expect(tripSnapshot(both).factCardDue).toBe('test-mud');
    const mudSeen = markFactCardSeen(both, 'test-mud');
    expect(tripSnapshot(mudSeen).factCardDue).toBe('test-pike');
    const allSeen = markFactCardSeen(mudSeen, 'test-pike');
    expect(allSeen.factCardsSeen).toEqual(['test-mud', 'test-pike']);
    expect(tripSnapshot(allSeen).factCardDue).toBeNull();
  });

  it('never makes a card due that was seen but not met, nor one met after it was seen', () => {
    const seen = createTrip(threatZone, LEGS, [], DEFAULT_TRIP_SEED, { factCardsSeen: ['test-pike'] });
    expect(tripSnapshot(seen).factCardDue).toBeNull();
    const mud = stepAt(seen, atMud).state;
    expect(tripSnapshot(mud).factCardDue).toBe('test-mud');
    const both = stepAt(markFactCardSeen(mud, 'test-mud'), atBoth).state;
    expect(both.met).toEqual(['test-mud', 'test-pike']);
    expect(tripSnapshot(both).factCardDue).toBeNull();
  });

  it('copies factCardsSeen from the options', () => {
    const options = { factCardsSeen: ['test-mud'] };
    const trip = createTrip(threatZone, LEGS, [], DEFAULT_TRIP_SEED, options);
    expect(trip.factCardsSeen).toEqual(['test-mud']);
    expect(trip.factCardsSeen).not.toBe(options.factCardsSeen);
  });

  it('makes the tilapia card due on the same step as the tilapia meet rule (meetsTilapia, range 180)', () => {
    let current = createTrip(zone);
    let pos: Point = { x: home.x, y: home.y };
    let dueStep = -1;
    let ruleStep = -1;
    for (let i = 0; i < 20 * 60 && dueStep < 0; i++) {
      pos = stepToward(pos, current.encounter.predators[0].pos, 150 * DT);
      current = stepAt(current, pos).state;
      if (ruleStep < 0 && meetsTilapia(pos, current.encounter.predators, current.encounter.safeArea)) ruleStep = i;
      if (dueStep < 0 && tripSnapshot(current).factCardDue === 'tilapia') dueStep = i;
    }
    expect(ruleStep).toBeGreaterThanOrEqual(0);
    expect(dueStep).toBe(ruleStep);
  });
});

describe('meeting the heron (#111)', () => {
  const standPoint: Point = { x: 1000, y: 100 };
  const heronRoute: PredatorRoute = { id: 'heron-stand', waypoints: [standPoint], species: HERON_SPECIES };
  const heronZone: TripSource = { ...zone, finds: [], spots: [], tilapiaRoutes: [], predatorRoutes: [heronRoute] };
  const atMeetRange: Point = { x: standPoint.x - HERON_MEET_RANGE, y: standPoint.y };
  const pastMeetRange: Point = { x: atMeetRange.x - 0.5, y: atMeetRange.y };

  it('meets the heron from the first step, within 180 px of where it stands, and not past that', () => {
    expect(HERON_SPECIES.meetRange).toBe(HERON_MEET_RANGE);
    expect(HERON_MEET_RANGE).toBe(180);
    expect(stepAt(createTrip(heronZone), pastMeetRange).state.met).toEqual([]);
    const met = stepAt(createTrip(heronZone), atMeetRange).state;
    expect(met.met).toEqual(['heron']);
    expect(tripSnapshot(met).factCardDue).toBe('heron');
  });

  it('meets the heron wherever it has waded to', () => {
    const wading: PredatorRoute = { ...heronRoute, id: 'heron-wade', waypoints: [standPoint, { x: 1250, y: 100 }] };
    const wadeZone: TripSource = { ...heronZone, predatorRoutes: [wading] };
    const far: Point = { x: 1250, y: 270 };
    expect(Math.hypot(standPoint.x - far.x, standPoint.y - far.y)).toBeGreaterThan(HERON_MEET_RANGE);
    let state = createTrip(wadeZone);
    let steps = 0;
    while (state.met.length === 0 && steps < 30 * 60) {
      state = stepAt(state, far).state;
      steps += 1;
    }
    expect(state.met).toEqual(['heron']);
    expect(steps).toBeGreaterThan(1);
    const heron = state.encounter.predators[0].pos;
    expect(Math.hypot(heron.x - far.x, heron.y - far.y)).toBeLessThanOrEqual(HERON_MEET_RANGE);
  });

  it('meets nothing inside the safe area, even within 180 px of the heron', () => {
    const nearHome: PredatorRoute = { ...heronRoute, waypoints: [{ x: zone.safeArea.x1 + 100, y: 100 }] };
    const homeZone: TripSource = { ...heronZone, predatorRoutes: [nearHome] };
    const inSafe: Point = { x: zone.safeArea.x1 - 10, y: 150 };
    const safe = walk(createTrip(homeZone), [inSafe, inSafe]).state;
    expect(safe.met).toEqual([]);
    expect(stepAt(safe, { x: zone.safeArea.x1 + 10, y: 150 }).state.met).toEqual(['heron']);
  });

  it('meets the heron with the axolotl in cover: cover stops a warning, not a meeting', () => {
    const reeds = zone.reedPatches[2];
    const stand: Point = { x: (reeds.x0 + reeds.x1) / 2, y: 100 };
    const hidden: Point = { x: stand.x, y: 180 };
    const coverZone: TripSource = { ...heronZone, predatorRoutes: [{ ...heronRoute, waypoints: [stand] }] };
    const trip = createTrip(coverZone);
    expect(inSightCover(hidden, trip.encounter)).toBe(true);
    const result = walk(trip, Array.from({ length: 60 }, () => hidden));
    expect(result.state.met).toEqual(['heron']);
    expect(result.events.filter((event) => event.type === 'telegraph')).toEqual([]);
  });

  it('keeps the cover data on the next trip', () => {
    const start = createTrip(heronZone);
    expect(start.encounter.reedPatches).toEqual(zone.reedPatches);
    expect(start.encounter.pads).toEqual(zone.pads);
    expect(start.encounter.cave).toEqual(zone.cave);
    const fresh = newTrip({ ...start, phase: 'ended', ending: { reason: 'wentHome', returned: [], bankedThisTrip: [] } });
    expect(fresh.encounter.reedPatches).toEqual(zone.reedPatches);
    expect(fresh.encounter.pads).toEqual(zone.pads);
    expect(fresh.encounter.cave).toEqual(zone.cave);
    expect(fresh.encounter.predatorRoutes).toEqual([heronRoute]);
  });
});

describe('rescue and tilapia snapshots', () => {
  it('detects rescue-status and factCardDue changes', () => {
    const base: TripSnapshot = { ...idleTripSnapshot(), rescue: { id: WILD, morph: 'wild', status: 'waiting' } };
    const rescue = base.rescue as NonNullable<TripSnapshot['rescue']>;
    expect(sameTripSnapshot(base, { ...base, rescue: { ...rescue } })).toBe(true);
    const changes: TripSnapshot[] = [
      { ...base, rescue: null },
      { ...base, rescue: { ...rescue, status: 'following' } },
      { ...base, rescue: { ...rescue, status: 'safe' } },
      { ...base, rescue: { id: axolotlFindId('melanoid'), morph: 'melanoid', status: 'waiting' } },
      { ...base, factCardDue: 'tilapia' },
      { ...base, factCardDue: 'test-mud' },
    ];
    for (const changed of changes) {
      expect(sameTripSnapshot(base, changed)).toBe(false);
      expect(sameTripSnapshot(changed, base)).toBe(false);
    }
  });

  it('starts idle with no rescue and no tilapia card due', () => {
    expect(idleTripSnapshot()).toEqual(tripSnapshot(createTrip(zone)));
    expect(idleTripSnapshot().rescue).toBeNull();
    expect(idleTripSnapshot().factCardDue).toBeNull();
  });
});

describe('legsLost', () => {
  it('starts at 0 and counts every hit, including the one that ends the trip', () => {
    expect(createTrip(zone).legsLost).toBe(0);
    const input: TripInput = { axolotlPos: inRange, reduced: false, dashing: false };
    const firstHit = drive(createTrip(zone), input, 'hit');
    expect(countOf(firstHit.events, 'hit')).toBe(1);
    expect(firstHit.state.phase).toBe('swimming');
    expect(firstHit.state.legsLost).toBe(1);
    const carry = drive(firstHit.state, input, 'carryStart');
    expect(carry.state.phase).toBe('carrying');
    expect(carry.state.legsLost).toBe(LEGS.count);
  });

  it('keeps counting a leg that grew back', () => {
    const regrowCtx = createTripContext();
    const hitInput: TripInput = { axolotlPos: farTarget, reduced: false, dashing: false };
    let state = drive(createTrip(farZone), hitInput, 'hit').state;
    expect(state.legsLost).toBe(1);
    let regrown = false;
    for (let seconds = 0; seconds < 60 && !regrown; seconds += DT) {
      const result = stepTrip(state, { axolotlPos: outside, reduced: false, dashing: false }, DT, regrowCtx);
      state = result.state;
      regrown = result.events.some((event) => event.type === 'regrown');
    }
    expect(regrown).toBe(true);
    expect(presentCount(state.encounter.legs)).toBe(LEGS.count);
    expect(state.legsLost).toBe(1);
  });
});

describe('beatArea (H5, H6)', () => {
  const plantSpecial: StarContext = { specialTreasureId: PLANT };

  function hitOnce(source: TripSource, target: Point): TripState {
    return hitOnceFrom(createTrip(source), target);
  }

  function hitOnceFrom(state: TripState, target: Point): TripState {
    return drive(state, { axolotlPos: target, reduced: false, dashing: false }, 'hit').state;
  }

  function hitWithFollowingRescue(): TripState {
    const following = walk(hitOnceFrom(rescueTrip(farZone), farTarget), [strandPlace]).state;
    expect(following.phase).toBe('swimming');
    expect(following.legsLost).toBeGreaterThan(0);
    expect(tripSnapshot(following).rescue?.status).toBe('following');
    return following;
  }

  it('banks the bag like the Home Spot and ends areaBeaten with every id banked this trip', () => {
    const state = walk(createTrip(findZone, LEGS, ['canal/pebble-9']), [spotA, spotB, outside]).state;
    expect(state.holdings.bag).toEqual([PLANT, HAT]);
    const result = beatArea(state, plantSpecial);
    expect(result.events).toEqual([{ type: 'banked', ids: [PLANT, HAT] }]);
    expect(result.state.phase).toBe('ended');
    expect(result.state.holdings).toEqual({ bag: [], banked: ['canal/pebble-9', PLANT, HAT] });
    expect(result.state.holdings.banked.length - state.holdings.banked.length).toBe(state.holdings.bag.length);
    expect(result.state.heldAt).toBeNull();
    expect(result.state.ending).toEqual({
      reason: 'areaBeaten',
      returned: [],
      bankedThisTrip: [PLANT, HAT],
      stars: { exit: true, special: true, legsOrRescue: true },
    });
    expect(tripAxolotlPos(result.state)).toEqual(state.home);
  });

  it('emits no banked event with an empty bag and keeps earlier bankings this trip', () => {
    const state = keepExploring(banked().state);
    const result = beatArea(state, plantSpecial);
    expect(result.events).toEqual([]);
    expect(result.state.holdings).toBe(state.holdings);
    expect(result.state.ending?.bankedThisTrip).toEqual([PLANT, HAT]);
  });

  it('earns the special star when banked on an earlier trip, earlier this trip, or in the bag', () => {
    const earlierTrip = createTrip(findZone, LEGS, [PLANT]);
    const earlierThisTrip = keepExploring(banked().state);
    const inBag = walk(createTrip(findZone), [spotA, outside]).state;
    expect(inBag.holdings.bag).toEqual([PLANT]);
    for (const state of [earlierTrip, earlierThisTrip, inBag]) {
      expect(beatArea(state, plantSpecial).state.ending?.stars?.special).toBe(true);
    }
    const canal = createTrip(zone, LEGS, [CANAL_AREA.specialTreasureId]);
    const canalCtx: StarContext = { specialTreasureId: CANAL_AREA.specialTreasureId };
    expect(beatArea(canal, canalCtx).state.ending?.stars?.special).toBe(true);
  });

  it('misses the special star this trip when only the old canal special is banked, and keeps an earlier one', () => {
    const special = CANAL_AREA.specialTreasureId;
    expect(special).toBe('canal/toy-boat');
    const oldSpecialOnly = createTrip(zone, LEGS, ['canal/castle-tower']);
    expect(oldSpecialOnly.holdings.banked).not.toContain(special);
    const earned = beatArea(oldSpecialOnly, { specialTreasureId: special }).state.ending?.stars;
    expect(earned?.special).toBe(false);
    const earnedStars = earned as NonNullable<typeof earned>;
    const kept = withStars({ [CANAL_AREA.id]: { exit: true, special: true, legsOrRescue: false } }, CANAL_AREA.id, earnedStars);
    expect(kept[CANAL_AREA.id].special).toBe(true);
  });

  it('misses the special star when the special is not owned', () => {
    const notOwned = walk(createTrip(findZone), [spotB, outside]).state;
    expect(beatArea(notOwned, plantSpecial).state.ending?.stars).toEqual({
      exit: true,
      special: false,
      legsOrRescue: true,
    });
  });

  it('misses the legs star after a leg is lost, even grown back, with no stranding', () => {
    const hit = hitOnce(farZone, farTarget);
    expect(hit.phase).toBe('swimming');
    expect(beatArea(hit, plantSpecial).state.ending?.stars?.legsOrRescue).toBe(false);
    const regrown: TripState = { ...hit, encounter: { ...hit.encounter, legs: createLegs() } };
    expect(beatArea(regrown, plantSpecial).state.ending?.stars?.legsOrRescue).toBe(false);
    expect(beatArea(createTrip(findZone), plantSpecial).state.ending?.stars?.legsOrRescue).toBe(true);
  });

  it('banks a following rescue at the exit: banked, safe, counting only treasures as banked', () => {
    const following = hitWithFollowingRescue();
    expect(following.holdings.bag).toEqual([WILD]);
    const result = beatArea(following, plantSpecial);
    expect(result.events).toEqual([{ type: 'banked', ids: [WILD] }]);
    const { state } = result;
    expect(state.ending?.bankedThisTrip).toEqual([WILD]);
    expect(state.holdings.bag).toEqual([]);
    expect(state.holdings.banked).toContain(WILD);
    const snapshot = tripSnapshot(state);
    expect(snapshot.rescue?.status).toBe('safe');
    expect(snapshot.banked).toBe(0);
  });

  it('earns the legs star after a leg is lost when the rescue is banked at the exit', () => {
    const following = hitWithFollowingRescue();
    expect(beatArea(following, plantSpecial).state.ending?.stars?.legsOrRescue).toBe(true);
  });

  it('earns the legs star after a leg is lost when the rescue was banked at the Home Spot earlier this trip', () => {
    const bankedState = walk(hitWithFollowingRescue(), [outside, home]).state;
    expect(bankedState.phase).toBe('banked');
    expect(bankedState.holdings.banked).toContain(WILD);
    const resumed = keepExploring(bankedState);
    const result = beatArea(resumed, plantSpecial);
    expect(result.events).toEqual([]);
    expect(result.state.legsLost).toBeGreaterThan(0);
    expect(result.state.ending?.stars?.legsOrRescue).toBe(true);
  });

  it('misses the legs star after a leg is lost when the rescue is still waiting', () => {
    const waiting = hitOnceFrom(rescueTrip(farZone), farTarget);
    expect(waiting.legsLost).toBeGreaterThan(0);
    expect(tripSnapshot(waiting).rescue?.status).toBe('waiting');
    const result = beatArea(waiting, plantSpecial);
    expect(result.state.ending?.stars?.legsOrRescue).toBe(false);
    expect(tripSnapshot(result.state).rescue?.status).toBe('waiting');
  });

  it('earns the legs star with no leg lost and the rescue never reached', () => {
    expect(beatArea(rescueTrip(farZone), plantSpecial).state.ending?.stars?.legsOrRescue).toBe(true);
  });

  it('is a no-op while banked, carrying or ended', () => {
    const bankedState = banked().state;
    const carry = carrying(zone, inRange, false).state;
    const done = ended();
    const beaten = beatArea(createTrip(findZone), plantSpecial).state;
    for (const state of [bankedState, carry, done, beaten]) {
      const result = beatArea(state, plantSpecial);
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    }
  });

  it('carries the stars on the snapshot and compares them', () => {
    const beaten = beatArea(walk(createTrip(findZone), [spotA, outside]).state, plantSpecial).state;
    const snapshot = tripSnapshot(beaten);
    expect(snapshot.ending).toEqual(beaten.ending);
    expect(snapshot.ending?.stars).not.toBe(beaten.ending?.stars);
    const ending = snapshot.ending as NonNullable<TripSnapshot['ending']>;
    const stars = ending.stars as NonNullable<typeof ending.stars>;
    expect(sameTripSnapshot(snapshot, tripSnapshot(beaten))).toBe(true);
    const changes: TripSnapshot[] = [
      { ...snapshot, ending: { ...ending, stars: undefined } },
      { ...snapshot, ending: { ...ending, stars: { ...stars, exit: false } } },
      { ...snapshot, ending: { ...ending, stars: { ...stars, special: false } } },
      { ...snapshot, ending: { ...ending, stars: { ...stars, legsOrRescue: false } } },
    ];
    for (const changed of changes) {
      expect(sameTripSnapshot(snapshot, changed)).toBe(false);
      expect(sameTripSnapshot(changed, snapshot)).toBe(false);
    }
  });

  it('starts the next trip with no legs lost and a fresh placement seed (B4)', () => {
    const beaten = beatArea(hitOnce(farZone, farTarget), plantSpecial).state;
    const next = newTrip(beaten);
    expect(next.phase).toBe('swimming');
    expect(next.legsLost).toBe(0);
    expect(next.tripSeed).toBe(nextTripSeed(beaten.tripSeed));
    expect(next.holdings.banked).toEqual(beaten.holdings.banked);
  });
});

describe('Shell perk through stepTrip (A22, F11)', () => {
  const shellCtx = createTripContext({
    encounter: createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 }, shell: true }),
  });
  const plantSpecial: StarContext = { specialTreasureId: PLANT };
  const hitInput: TripInput = { axolotlPos: farTarget, reduced: false, dashing: false };

  function driveShell(state: TripState, until: TripEvent['type'], limit = 120): Drive {
    let current = state;
    const events: TripEvent[] = [];
    let last: TripStepResult = { state, events: [] };
    let seconds = 0;
    while (seconds < limit) {
      last = stepTrip(current, hitInput, DT, shellCtx);
      current = last.state;
      seconds += DT;
      events.push(...last.events);
      if (last.events.some((event) => event.type === until)) break;
    }
    return { state: current, events, last, seconds };
  }

  it('blocks the first hit with no leg lost and keeps star 3', () => {
    const blocked = driveShell(createTrip(farZone), 'shellBlock');
    expect(countOf(blocked.events, 'shellBlock')).toBe(1);
    expect(countOf(blocked.events, 'hit')).toBe(0);
    expect(blocked.state.phase).toBe('swimming');
    expect(blocked.state.legsLost).toBe(0);
    expect(presentCount(blocked.state.encounter.legs)).toBe(LEGS.count);
    expect(isProtected(blocked.state.encounter.legs)).toBe(true);
    expect(beatArea(blocked.state, plantSpecial).state.ending?.stars?.legsOrRescue).toBe(true);
  });

  it('costs a leg on the next hit', () => {
    const blocked = driveShell(createTrip(farZone), 'shellBlock');
    const hit = driveShell(blocked.state, 'hit');
    expect(countOf(hit.events, 'shellBlock')).toBe(0);
    expect(countOf(hit.events, 'hit')).toBe(1);
    expect(hit.state.legsLost).toBe(1);
    expect(presentCount(hit.state.encounter.legs)).toBe(LEGS.count - 1);
    expect(beatArea(hit.state, plantSpecial).state.ending?.stars?.legsOrRescue).toBe(false);
  });

  it('resets the block on newTrip', () => {
    const blocked = driveShell(createTrip(farZone), 'shellBlock');
    expect(blocked.state.encounter.shellUsed).toBe(true);
    const next = newTrip(beatArea(blocked.state, plantSpecial).state);
    expect(next.phase).toBe('swimming');
    expect(next.encounter.shellUsed).toBe(false);
    const again = driveShell(next, 'shellBlock');
    expect(countOf(again.events, 'shellBlock')).toBe(1);
    expect(again.state.legsLost).toBe(0);
  });
});

describe('plastic worms in the trip (#75)', () => {
  const WORM_A: Point = { x: 900, y: 200 };
  const WORM_B: Point = { x: 1300, y: 200 };
  const wormAt = (id: string, at: Point): HazardSpawn => ({
    id,
    type: PLASTIC_WORM,
    shape: { kind: 'circle', x: at.x, y: at.y, r: 0 },
  });
  const worms = [wormAt('test/worm-a', WORM_A), wormAt('test/worm-b', WORM_B)];
  const wormZone: TripSource = { ...findZone, hazards: worms };
  const carryWormZone: TripSource = { ...zone, hazards: [...(zone.hazards ?? []), ...worms] };
  const avoid: SpitAvoid = { bounds: swimBounds(), currents: [], safeArea: zone.safeArea };
  const longQueasy = { ...PLASTIC_WORMS, queasyTime: 1e6 };
  const shellCtx = createTripContext({
    encounter: createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 }, shell: true }),
  });
  const calm: Point = { x: 700, y: 120 };

  function bodyWithHeadAt(head: Point, facing: 1 | -1 = 1): DrawnBody {
    return { x: head.x - facing * SNACK_REACH.headAhead, y: head.y, facing, rotation: 0 };
  }

  function eatenAt(state: TripState, head: Point, tuning = PLASTIC_WORMS): TripStepResult {
    const result = eatPlasticWorms(state, bodyWithHeadAt(head), avoid, tuning);
    if (result.events.length !== 1) throw new Error('expected a plastic worm to be eaten');
    return result;
  }

  function queasyFor(state: TripState, seconds: number): TripState {
    return { ...state, plasticWorms: { ...state.plasticWorms, queasyLeft: seconds } };
  }

  function swimUntilWell(state: TripState, pos: Point, stepCtx = ctx): TripState {
    let current = state;
    for (let i = 0; i < 1000 && isQueasy(current.plasticWorms); i++) {
      current = stepTrip(current, { axolotlPos: pos, reduced: false, dashing: false }, SWIM.dtMax, stepCtx).state;
    }
    if (isQueasy(current.plasticWorms)) throw new Error('expected queasy time to run out');
    return current;
  }

  it('starts with a worm at each plastic worm hazard centre, in data order, not queasy', () => {
    expect(createTrip(wormZone).plasticWorms).toEqual({
      worms: [
        { id: 'test/worm-a', ...WORM_A },
        { id: 'test/worm-b', ...WORM_B },
      ],
      queasyLeft: 0,
    });
  });

  it('gives canal trips no worms and the same placements as with worm hazards added', () => {
    expect(createTrip(zone).plasticWorms).toEqual({ worms: [], queasyLeft: 0 });
    for (const seed of [1, 7, 42, DEFAULT_TRIP_SEED]) {
      expect(createTrip(carryWormZone, LEGS, [], seed).placed).toEqual(createTrip(zone, LEGS, [], seed).placed);
    }
  });

  it('eats the worm in reach, spits it out, starts queasy time and emits wormSpat', () => {
    const trip = createTrip(wormZone);
    const body = bodyWithHeadAt(WORM_A);
    const result = eatPlasticWorms(trip, body, avoid);
    const to = spitLanding(body);
    expect(result.events).toEqual([{ type: 'wormSpat', id: 'test/worm-a', from: WORM_A, to }]);
    expect(result.state.plasticWorms).toEqual({
      worms: [
        { id: 'test/worm-a', ...to },
        { id: 'test/worm-b', ...WORM_B },
      ],
      queasyLeft: PLASTIC_WORMS.queasyTime,
    });
    expect(result.impulse).toBeUndefined();
  });

  it('is not a snack: only the worms change, legs and regrowth stay, nothing counts toward the exit', () => {
    const fresh = createTrip(wormZone);
    const trip: TripState = { ...fresh, encounter: { ...fresh.encounter, legs: regrowingLegs(0.4) } };
    const result = eatenAt(trip, WORM_A);
    expect(Object.keys(result)).toEqual(['state', 'events']);
    expect({ ...result.state, plasticWorms: trip.plasticWorms }).toEqual(trip);
    expect(result.state.encounter).toBe(trip.encounter);
    expect(result.state.holdings).toBe(trip.holdings);
    expect(result.state.found).toBe(trip.found);
    expect(result.state.placed).toBe(trip.placed);
    expect(result.state.met).toBe(trip.met);
    expect(sameTripSnapshot(tripSnapshot(result.state), tripSnapshot(trip))).toBe(true);
    const eatenStep = stepAt(result.state, calm).state;
    const plainStep = stepAt(trip, calm).state;
    expect(eatenStep.encounter.legs).toEqual(plainStep.encounter.legs);
    expect(eatenStep.legsLost).toBe(plainStep.legsLost);
  });

  it('returns the input state and one shared frozen empty events array when nothing is eaten', () => {
    const trip = createTrip(wormZone);
    const missed = eatPlasticWorms(trip, bodyWithHeadAt(calm), avoid);
    expect(missed.state).toBe(trip);
    expect(missed.events).toEqual([]);
    expect(Object.isFrozen(missed.events)).toBe(true);
    expect(eatPlasticWorms(createTrip(zone), bodyWithHeadAt(WORM_A), avoid).events).toBe(missed.events);
  });

  it('never stacks: a second worm does nothing while queasy, and can be eaten once queasy ends', () => {
    const queasy = eatenAt(createTrip(wormZone), WORM_A).state;
    const again = eatPlasticWorms(queasy, bodyWithHeadAt(WORM_B), avoid);
    expect(again.state).toBe(queasy);
    expect(again.events).toEqual([]);
    const well = swimUntilWell(queasy, calm);
    const second = eatenAt(well, WORM_B);
    expect(second.events[0]).toMatchObject({ type: 'wormSpat', id: 'test/worm-b', from: WORM_B });
    expect(second.state.plasticWorms.queasyLeft).toBe(PLASTIC_WORMS.queasyTime);
  });

  it('lets a spat worm slow the axolotl again at its new spot once queasy ends', () => {
    const first = eatenAt(createTrip(wormZone), WORM_A);
    const spat = first.events[0];
    if (spat.type !== 'wormSpat') throw new Error('expected wormSpat');
    expect(spat.to).not.toEqual(WORM_A);
    expect(eatPlasticWorms(first.state, bodyWithHeadAt(spat.to), avoid).state).toBe(first.state);
    expect(eatPlasticWorms(first.state, bodyWithHeadAt(WORM_A), avoid).state).toBe(first.state);
    const well = swimUntilWell(first.state, calm);
    const again = eatenAt(well, spat.to);
    expect(again.events[0]).toMatchObject({ type: 'wormSpat', id: 'test/worm-a', from: spat.to });
    expect(isQueasy(again.state.plasticWorms)).toBe(true);
  });

  it('counts queasy time down by the capped step while swimming, and never on a paused step', () => {
    const queasy = eatenAt(createTrip(wormZone), WORM_A).state;
    expect(stepAt(queasy, calm).state.plasticWorms.queasyLeft).toBeCloseTo(PLASTIC_WORMS.queasyTime - DT, 12);
    const long = stepTrip(queasy, { axolotlPos: calm, reduced: false, dashing: false }, 1, ctx).state;
    expect(long.plasticWorms.queasyLeft).toBeCloseTo(PLASTIC_WORMS.queasyTime - SWIM.dtMax, 12);
    expect(long.plasticWorms.worms).toBe(queasy.plasticWorms.worms);
    for (const dt of PAUSE_DTS) {
      expect(stepTrip(queasy, { axolotlPos: calm, reduced: false, dashing: false }, dt, ctx).state).toBe(queasy);
    }
    const well = swimUntilWell(queasy, calm);
    expect(well.plasticWorms.queasyLeft).toBe(0);
    expect(stepAt(well, calm).state.plasticWorms).toBe(well.plasticWorms);
  });

  it('holds queasy time on the banking card and resumes it after keepExploring', () => {
    const picked = walk(createTrip(wormZone), [spotA]).state;
    const queasy = eatenAt(picked, WORM_A).state;
    const bankedTrip = walk(queasy, [outside, home]).state;
    expect(bankedTrip.phase).toBe('banked');
    const held = bankedTrip.plasticWorms.queasyLeft;
    expect(held).toBeCloseTo(PLASTIC_WORMS.queasyTime - 2 * DT, 12);
    expect(stepAt(bankedTrip, calm).state).toBe(bankedTrip);
    const atWorm = eatPlasticWorms(bankedTrip, bodyWithHeadAt(WORM_B), avoid);
    expect(atWorm.state).toBe(bankedTrip);
    expect(atWorm.events).toEqual([]);
    const exploring = keepExploring(bankedTrip);
    expect(exploring.plasticWorms).toBe(bankedTrip.plasticWorms);
    expect(stepAt(exploring, calm).state.plasticWorms.queasyLeft).toBeCloseTo(held - DT, 12);
  });

  it('ends queasy time when the carry starts, and never ticks or eats while carrying or ended', () => {
    const queasy = eatenAt(createTrip(carryWormZone), WORM_A, longQueasy).state;
    const carry = drive(queasy, { axolotlPos: inRange, reduced: false, dashing: false }, 'carryStart');
    expect(carry.state.phase).toBe('carrying');
    expect(carry.state.plasticWorms.queasyLeft).toBe(0);
    expect(carry.state.plasticWorms.worms).toBe(queasy.plasticWorms.worms);
    const carryAtWorm = eatPlasticWorms(carry.state, bodyWithHeadAt(WORM_B), avoid);
    expect(carryAtWorm.state).toBe(carry.state);
    expect(carryAtWorm.events).toEqual([]);
    const done = drive(carry.state, { axolotlPos: inRange, reduced: false, dashing: false }, 'arrivedHome').state;
    expect(done.phase).toBe('ended');
    expect(done.plasticWorms).toBe(carry.state.plasticWorms);
    expect(eatPlasticWorms(done, bodyWithHeadAt(WORM_B), avoid).state).toBe(done);
  });

  it('ends queasy time when the trip ends at the Home Spot or the exit, keeping the worms where they are', () => {
    const queasy = queasyFor(eatenAt(createTrip(wormZone), WORM_A).state, 2);
    const wentHome = goHome(queasy).state;
    expect(wentHome.phase).toBe('ended');
    expect(wentHome.plasticWorms).toEqual({ worms: queasy.plasticWorms.worms, queasyLeft: 0 });
    const beaten = beatArea(queasy, { specialTreasureId: PLANT }).state;
    expect(beaten.phase).toBe('ended');
    expect(beaten.plasticWorms).toEqual({ worms: queasy.plasticWorms.worms, queasyLeft: 0 });
    expect(stepAt(beaten, calm).state).toBe(beaten);
  });

  it('starts the next trip with every worm back at its spawn and no queasy time', () => {
    const queasy = eatenAt(createTrip(wormZone), WORM_A).state;
    const fresh = newTrip(beatArea(queasy, { specialTreasureId: PLANT }).state);
    expect(fresh.plasticWorms).toEqual(createTrip(wormZone).plasticWorms);
    const carried = drive(
      eatenAt(createTrip(carryWormZone), WORM_A).state,
      { axolotlPos: inRange, reduced: false, dashing: false },
      'arrivedHome',
    ).state;
    expect(newTrip(carried).plasticWorms).toEqual(createTrip(carryWormZone).plasticWorms);
  });

  it('is not stopped by the Shell perk, which stays unused', () => {
    const queasy = eatenAt(createTrip(wormZone), WORM_A).state;
    const shellStep = stepTrip(queasy, { axolotlPos: calm, reduced: false, dashing: false }, DT, shellCtx);
    expect(shellStep.events).toEqual([]);
    expect(shellStep.state.plasticWorms).toEqual(stepAt(queasy, calm).state.plasticWorms);
    expect(shellStep.state.encounter.shellUsed).toBe(false);
    const well = swimUntilWell(queasy, calm, shellCtx);
    expect(well.encounter.shellUsed).toBe(false);
    expect(isProtected(well.encounter.legs)).toBe(false);
    expect(eatenAt(well, WORM_B).state.encounter.shellUsed).toBe(false);
  });

  it('never lets a following stranded axolotl eat a worm, only the explorer', () => {
    const following = walk(rescueTrip(wormZone), [strandPlace]).state;
    expect(tripSnapshot(following).rescue?.status).toBe('following');
    const rescue = following.rescue as NonNullable<TripState['rescue']>;
    const onWorm: TripState = { ...following, rescue: { ...rescue, pos: { ...WORM_A } } };
    const explorer: Point = { x: WORM_A.x - 200, y: 140 };
    const stepped = stepAt(onWorm, explorer).state;
    expect(stepped.plasticWorms).toBe(onWorm.plasticWorms);
    const missed = eatPlasticWorms(onWorm, bodyWithHeadAt(explorer), avoid);
    expect(missed.state).toBe(onWorm);
    expect(missed.events).toEqual([]);
    const eaten = eatenAt(onWorm, WORM_A);
    expect(eaten.state.rescue).toBe(onWorm.rescue);
    expect(eaten.state.holdings).toBe(onWorm.holdings);
  });
});

describe('ghost nets in the trip', () => {
  const netAt = (id: string, x0: number): HazardSpawn => ({
    id,
    type: GHOST_NET,
    shape: { kind: 'rect', x0, x1: x0 + 100, y0: 150, y1: 250 },
  });
  const nets = [netAt('test/net-a', 900), netAt('test/net-b', 1300)];
  const netZone: TripSource = { ...findZone, hazards: nets };
  const carryNetZone: TripSource = { ...zone, hazards: [...(zone.hazards ?? []), ...nets] };
  const shellCtx = createTripContext({
    encounter: createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 }, shell: true }),
  });
  const calm: Point = { x: 700, y: 120 };
  const atEdgeA: Point = { x: 900 - GHOST_NETS.reach, y: 200 };
  const pastEdgeA: Point = { x: 900 - GHOST_NETS.reach - 1, y: 200 };
  const insideA: Point = { x: 950, y: 200 };
  const insideB: Point = { x: 1350, y: 200 };
  const snagEvent = (id: string, at: Point): TripEvent => ({ type: 'snagged', id, at: { x: at.x, y: at.y } });

  function snaggedFor(state: TripState, seconds: number): TripState {
    return { ...state, ghostNets: { ...state.ghostNets, snagLeft: seconds } };
  }

  function swimUntilFree(state: TripState, pos: Point, stepCtx = ctx): TripState {
    let current = state;
    for (let i = 0; i < 1000 && isSnagged(current.ghostNets); i++) {
      current = stepTrip(current, { axolotlPos: pos, reduced: false, dashing: false }, SWIM.dtMax, stepCtx).state;
    }
    if (isSnagged(current.ghostNets)) throw new Error('expected snag time to run out');
    return current;
  }

  it("starts with the source's ghost nets, in data order, not snagged", () => {
    expect(createTrip(netZone).ghostNets).toEqual(createGhostNets(nets));
    expect(createTrip(netZone).ghostNets).toEqual({ nets, snagLeft: 0, inReach: [] });
  });

  it('gives a trip with no nets an empty state, the same placements, and never changes it', () => {
    const canal = createTrip(zone);
    expect(canal.ghostNets).toEqual({ nets: [], snagLeft: 0, inReach: [] });
    for (const seed of [1, 7, 42, DEFAULT_TRIP_SEED]) {
      expect(createTrip(carryNetZone, LEGS, [], seed).placed).toEqual(createTrip(zone, LEGS, [], seed).placed);
    }
    const plain = createTrip(findZone);
    const walked = walk(plain, [calm, insideA, atEdgeA, insideB]);
    expect(walked.state.ghostNets).toBe(plain.ghostNets);
    expect(countOf(walked.events, 'snagged')).toBe(0);
    const stepped = stepAt(canal, insideA).state;
    expect(stepped.ghostNets).toBe(canal.ghostNets);
  });

  it('snags the explorer centre at the net reach from the rect edge, emitting snagged once', () => {
    expect(stepAt(createTrip(netZone), pastEdgeA).events).toEqual([]);
    expect(stepAt(createTrip(netZone), pastEdgeA).state.ghostNets.snagLeft).toBe(0);
    const result = stepAt(createTrip(netZone), atEdgeA);
    expect(result.events).toEqual([snagEvent('test/net-a', atEdgeA)]);
    expect(result.state.ghostNets).toEqual({ nets, snagLeft: GHOST_NETS.snagTime, inReach: ['test/net-a'] });
    expect(result.impulse).toBeUndefined();
    const inside = walk(result.state, [insideA, insideA, atEdgeA]);
    expect(countOf(inside.events, 'snagged')).toBe(0);
  });

  it('snags only on entering: staying inside after the snag ends never snags again', () => {
    const snagged = stepAt(createTrip(netZone), insideA).state;
    const freeInside = swimUntilFree(snagged, insideA);
    expect(freeInside.ghostNets.inReach).toEqual(['test/net-a']);
    const still = stepAt(freeInside, insideA);
    expect(still.events).toEqual([]);
    expect(still.state.ghostNets).toBe(freeInside.ghostNets);
    const left = stepAt(freeInside, calm).state;
    expect(stepAt(left, insideA).events).toEqual([snagEvent('test/net-a', insideA)]);
  });

  it('never stacks: entering another net while snagged does nothing, and snags once free', () => {
    const snagged = stepAt(createTrip(netZone), insideA).state;
    const away = stepAt(snagged, calm).state;
    const other = stepAt(away, insideB);
    expect(other.events).toEqual([]);
    expect(other.state.ghostNets.snagLeft).toBeCloseTo(GHOST_NETS.snagTime - 2 * DT, 12);
    expect(other.state.ghostNets.inReach).toEqual(['test/net-b']);
    const free = swimUntilFree(stepAt(other.state, calm).state, calm);
    const again = stepAt(free, insideB);
    expect(again.events).toEqual([snagEvent('test/net-b', insideB)]);
    expect(again.state.ghostNets.snagLeft).toBe(GHOST_NETS.snagTime);
  });

  it('counts snag time down by the capped step while swimming, and never on a paused step', () => {
    const snagged = stepAt(createTrip(netZone), insideA).state;
    expect(stepAt(snagged, calm).state.ghostNets.snagLeft).toBeCloseTo(GHOST_NETS.snagTime - DT, 12);
    const long = stepTrip(snagged, { axolotlPos: calm, reduced: false, dashing: false }, 1, ctx).state;
    expect(long.ghostNets.snagLeft).toBeCloseTo(GHOST_NETS.snagTime - SWIM.dtMax, 12);
    expect(long.ghostNets.nets).toBe(snagged.ghostNets.nets);
    for (const dt of PAUSE_DTS) {
      expect(stepTrip(snagged, { axolotlPos: calm, reduced: false, dashing: false }, dt, ctx).state).toBe(snagged);
    }
    const free = swimUntilFree(snagged, calm);
    expect(free.ghostNets.snagLeft).toBe(0);
    expect(stepAt(free, calm).state.ghostNets).toBe(free.ghostNets);
  });

  it('holds snag time on the banking card and resumes it after keepExploring', () => {
    const picked = walk(createTrip(netZone), [spotA]).state;
    const snagged = stepAt(picked, insideA).state;
    const bankedTrip = walk(snagged, [outside, home]).state;
    expect(bankedTrip.phase).toBe('banked');
    const held = bankedTrip.ghostNets.snagLeft;
    expect(held).toBeCloseTo(GHOST_NETS.snagTime - 2 * DT, 12);
    expect(stepAt(bankedTrip, insideB).state).toBe(bankedTrip);
    const exploring = keepExploring(bankedTrip);
    expect(exploring.ghostNets).toBe(bankedTrip.ghostNets);
    expect(stepAt(exploring, calm).state.ghostNets.snagLeft).toBeCloseTo(held - DT, 12);
  });

  it('ends snag time when the carry starts, and never steps while carrying or ended', () => {
    const snagged = snaggedFor(stepAt(createTrip(carryNetZone), insideA).state, 1e6);
    const carry = drive(snagged, { axolotlPos: inRange, reduced: false, dashing: false }, 'carryStart');
    expect(carry.state.phase).toBe('carrying');
    expect(carry.state.ghostNets.snagLeft).toBe(0);
    expect(carry.state.ghostNets.nets).toBe(snagged.ghostNets.nets);
    const carryStep = stepAt(carry.state, insideB);
    expect(carryStep.state.ghostNets).toBe(carry.state.ghostNets);
    expect(countOf(carryStep.events, 'snagged')).toBe(0);
    const done = drive(carry.state, { axolotlPos: insideB, reduced: false, dashing: false }, 'arrivedHome');
    expect(done.state.phase).toBe('ended');
    expect(done.state.ghostNets).toBe(carry.state.ghostNets);
    expect(countOf(done.events, 'snagged')).toBe(0);
    expect(stepAt(done.state, insideB).state).toBe(done.state);
  });

  it('ends snag time when the trip ends at the Home Spot or the exit, keeping the nets and their reach', () => {
    const snagged = stepAt(createTrip(netZone), insideA).state;
    const atHome = snaggedFor({ ...snagged, inHomeSpot: true }, 1);
    const wentHome = goHome(atHome).state;
    expect(wentHome.phase).toBe('ended');
    expect(wentHome.ghostNets).toEqual({ nets, snagLeft: 0, inReach: ['test/net-a'] });
    const beaten = beatArea(snagged, { specialTreasureId: PLANT }).state;
    expect(beaten.phase).toBe('ended');
    expect(beaten.ghostNets).toEqual({ nets, snagLeft: 0, inReach: ['test/net-a'] });
    expect(beaten.ending?.stars).toEqual(beatArea(createTrip(netZone), { specialTreasureId: PLANT }).state.ending?.stars);
    expect(stepAt(beaten, insideB).state).toBe(beaten);
  });

  it('starts the next trip with the same nets and no snag time', () => {
    const snagged = stepAt(createTrip(netZone), insideA).state;
    const fresh = newTrip(beatArea(snagged, { specialTreasureId: PLANT }).state);
    expect(fresh.ghostNets).toEqual(createTrip(netZone).ghostNets);
    const carried = drive(
      snaggedFor(stepAt(createTrip(carryNetZone), insideA).state, 1e6),
      { axolotlPos: inRange, reduced: false, dashing: false },
      'arrivedHome',
    ).state;
    expect(newTrip(carried).ghostNets).toEqual(createTrip(carryNetZone).ghostNets);
  });

  it('never touches legs, regrowth, protected time, finds or the bag', () => {
    const fresh = createTrip(netZone);
    const regrowing: TripState = { ...fresh, encounter: { ...fresh.encounter, legs: regrowingLegs(0.4) } };
    const plainFresh = createTrip(findZone);
    const plain: TripState = { ...plainFresh, encounter: { ...plainFresh.encounter, legs: regrowingLegs(0.4) } };
    const path = [insideA, insideA, calm, insideB];
    const snagWalk = walk(regrowing, path);
    const plainWalk = walk(plain, path);
    expect(countOf(snagWalk.events, 'snagged')).toBe(1);
    expect(snagWalk.events.filter((event) => event.type !== 'snagged')).toEqual(plainWalk.events);
    expect(snagWalk.state.encounter.legs).toEqual(plainWalk.state.encounter.legs);
    expect(isProtected(snagWalk.state.encounter.legs)).toBe(isProtected(plainWalk.state.encounter.legs));
    expect(snagWalk.state.legsLost).toBe(0);
    expect(snagWalk.state.placed).toEqual(plainWalk.state.placed);
    expect(snagWalk.state.holdings).toEqual(plainWalk.state.holdings);
    expect(snagWalk.state.found).toEqual(plainWalk.state.found);
    expect(snagWalk.state.phase).toBe('swimming');
  });

  it('is not stopped by the Shell perk, which stays unused', () => {
    const shellStep = stepTrip(createTrip(netZone), { axolotlPos: insideA, reduced: false, dashing: false }, DT, shellCtx);
    expect(shellStep.events).toEqual([snagEvent('test/net-a', insideA)]);
    expect(shellStep.state.ghostNets).toEqual(stepAt(createTrip(netZone), insideA).state.ghostNets);
    expect(shellStep.state.encounter.shellUsed).toBe(false);
    const free = swimUntilFree(shellStep.state, calm, shellCtx);
    expect(free.encounter.shellUsed).toBe(false);
    expect(isProtected(free.encounter.legs)).toBe(false);
  });

  it('meets the ghost net at its meet range from the rect edge, making its card due', () => {
    const atMeet: Point = { x: 900 - GHOST_NETS.meetRange, y: 200 };
    const pastMeet: Point = { x: 900 - GHOST_NETS.meetRange - 0.5, y: 200 };
    expect(stepAt(createTrip(netZone), pastMeet).state.met).toEqual([]);
    const met = stepAt(createTrip(netZone), atMeet).state;
    expect(met.met).toEqual([GHOST_NET.id]);
    expect(met.ghostNets.snagLeft).toBe(0);
    expect(tripSnapshot(met).factCardDue).toBe(GHOST_NET.id);
    expect(walk(met, [insideA, insideB]).state.met).toEqual([GHOST_NET.id]);
  });

  it('never snags a following stranded axolotl, only the explorer', () => {
    const following = walk(rescueTrip(netZone), [strandPlace]).state;
    expect(tripSnapshot(following).rescue?.status).toBe('following');
    const rescue = following.rescue as NonNullable<TripState['rescue']>;
    const onNet: TripState = { ...following, rescue: { ...rescue, pos: { ...insideA } } };
    const explorer: Point = { x: 600, y: 120 };
    const stepped = stepAt(onNet, explorer);
    expect(countOf(stepped.events, 'snagged')).toBe(0);
    expect(stepped.state.ghostNets).toBe(onNet.ghostNets);
  });
});

describe('per-area tilapia tuning', () => {
  const AREA_TILAPIA = { ...TILAPIA, windup: 0.85, lungeSpeed: 400, lungeRange: 145, cooldown: 2.2, patrolSpeed: 50 };
  const tunedZone: TripSource = { ...zone, tilapia: AREA_TILAPIA };
  const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

  function endedFrom(start: TripState): TripState {
    return { ...start, phase: 'ended', ending: { reason: 'carriedHome', returned: [], bankedThisTrip: [] } };
  }

  function tunedPlacement(seed: number): PlacedFind[] {
    return placeTreasures(tunedZone.finds, tunedZone.spots, [], seed, {
      mustPlace: [],
      extras: [CANAL_AREA.specialTreasureId],
      tuning: tripTreasureTuning(tunedZone.areaId),
      mainPath: tunedZone.mainPath,
      tilapiaRoutes: tunedZone.tilapiaRoutes,
      lungeRange: AREA_TILAPIA.lungeRange,
      threats: zoneThreats(tunedZone),
    });
  }

  it('carries no tuning of its own for a zone with none', () => {
    expect(createTrip(zone).encounter).not.toHaveProperty('tilapia');
  });

  it("plays the source's tuning in the trip's encounter", () => {
    const trip = createTrip(tunedZone);
    expect(trip.encounter.tilapia).toEqual(AREA_TILAPIA);
    expect(predatorSpecies(trip.encounter, trip.encounter.predators[0], ctx.encounter).tuning).toBe(trip.encounter.tilapia);
  });

  it("places treasures with the tuned threats and the tuning's lunge range", () => {
    for (const seed of SEEDS) {
      expect(createTrip(tunedZone, LEGS, [], seed).placed).toEqual(tunedPlacement(seed));
    }
  });

  it('keeps the tuning when newTrip starts the next trip', () => {
    const done = endedFrom(createTrip(tunedZone, LEGS, [], DEFAULT_TRIP_SEED));
    for (const seed of SEEDS.slice(0, 10)) {
      const next = newTrip(done, seed);
      expect(next.encounter.tilapia).toEqual(AREA_TILAPIA);
      expect(next.encounter).toEqual(createEncounter(tunedZone));
      expect(next.placed).toEqual(tunedPlacement(seed));
    }
    expect(newTrip(endedFrom(createTrip(zone)))).not.toHaveProperty('encounter.tilapia');
  });
});

describe('elements in the trip (#103)', () => {
  const testFact = (id: string): FactCard => ({ id, name: id, title: id, body: id });
  const TEST_MATS: ElementType = {
    id: 'test-mats',
    name: 'Test mats',
    kind: 'cycle',
    period: 8,
    activeFor: 4,
    meetRange: 60,
    fact: testFact('test-mats'),
  };
  const TEST_MUD: HazardType = { id: 'test-mud', name: 'Test mud', costsLeg: false, reach: 0, meetRange: 60, fact: testFact('test-mud') };
  const TEST_PIKE: PredatorSpecies = { ...TILAPIA_SPECIES, id: 'test-pike', name: 'Test pike', fact: testFact('test-pike') };
  const matsAt = (id: string, x0: number, type: ElementType = TEST_MATS): ElementSpawn => ({
    id,
    type,
    offset: 0,
    matPair: { x0, x1: x0 + 100, rowTop: 150, rowBottom: 250, channelY: 200, openHeight: 60 },
  });
  const elementZone: TripSource = { ...zone, finds: [], spots: [], tilapiaRoutes: [], elements: [matsAt('mats-a', 900)] };
  const atMats: Point = { x: 900 - 60, y: 200 };
  const pastMats: Point = { x: 900 - 60.5, y: 200 };
  const inMats: Point = { x: 950, y: 200 };
  const calm: Point = { x: 700, y: 120 };

  it("starts with copies of the source's elements and the element clock at 0", () => {
    const trip = createTrip(elementZone);
    expect(trip.elements).toEqual(elementZone.elements);
    expect(trip.elements[0]).not.toBe(elementZone.elements?.[0]);
    expect(trip.elements[0].matPair).not.toBe(elementZone.elements?.[0].matPair);
    expect(trip.elements[0].type).toBe(TEST_MATS);
    expect(trip.elementTime).toBe(0);
  });

  it('starts with no elements when the source has none', () => {
    const noElements: TripSource = { ...zone, elements: undefined };
    expect(createTrip(noElements).elements).toEqual([]);
    expect(createTrip(zone).elements).toEqual([]);
  });

  it('advances the element clock by the capped step on swimming steps only', () => {
    const trip = createTrip(elementZone);
    expect(stepAt(trip, calm).state.elementTime).toBe(DT);
    expect(walk(trip, [calm, calm, calm]).state.elementTime).toBeCloseTo(3 * DT, 12);
    const long = stepTrip(trip, { axolotlPos: calm, reduced: false, dashing: false }, 1, ctx);
    expect(long.state.elementTime).toBe(SWIM.dtMax);
  });

  it('holds the element clock while paused, banked, carrying or ended', () => {
    const swimming = stepAt(createTrip(elementZone), calm).state;
    for (const dt of PAUSE_DTS) {
      expect(stepTrip(swimming, { axolotlPos: calm, reduced: false, dashing: false }, dt, ctx).state).toBe(swimming);
    }
    const bankedTrip = banked().state;
    expect(bankedTrip.phase).toBe('banked');
    expect(stepAt(bankedTrip, home).state).toBe(bankedTrip);
    expect(keepExploring(bankedTrip).elementTime).toBe(bankedTrip.elementTime);
    const carry = carrying(zone, inRange, false).state;
    expect(carry.elementTime).toBeGreaterThan(0);
    expect(stepAt(carry, inRange).state.elementTime).toBe(carry.elementTime);
    const done = ended();
    expect(done.elementTime).toBe(carry.elementTime);
  });

  it('keeps the elements and restarts the element clock on newTrip', () => {
    const swum = walk(createTrip(elementZone), [calm, calm]).state;
    const done: TripState = { ...swum, phase: 'ended', ending: { reason: 'wentHome', returned: [], bankedThisTrip: [] } };
    const next = newTrip(done);
    expect(next.elementTime).toBe(0);
    expect(next.elements).toEqual(elementZone.elements);
  });

  it('meets an element at exactly its meet range from its sweep, not past it, and makes its card due', () => {
    expect(stepAt(createTrip(elementZone), pastMats).state.met).toEqual([]);
    const met = stepAt(createTrip(elementZone), atMats).state;
    expect(met.met).toEqual(['test-mats']);
    expect(tripSnapshot(met).factCardDue).toBe('test-mats');
    expect(walk(met, [inMats, atMats]).state.met).toEqual(['test-mats']);
  });

  it('never meets an element with no fact card, no meet range or no sweep', () => {
    const noFact: ElementType = { ...TEST_MATS, id: 'no-fact', fact: undefined };
    const noRange: ElementType = { ...TEST_MATS, id: 'no-range', meetRange: undefined };
    const noSweep: ElementSpawn = { id: 'no-sweep', type: { ...TEST_MATS, id: 'no-sweep' }, offset: 0 };
    const source: TripSource = { ...elementZone, elements: [matsAt('a', 900, noFact), matsAt('b', 900, noRange), noSweep] };
    expect(walk(createTrip(source), [atMats, inMats]).state.met).toEqual([]);
  });

  it('meets nothing inside the safe area', () => {
    const inSafe: Point = { x: zone.safeArea.x1 - 10, y: 200 };
    const near: TripSource = { ...elementZone, elements: [matsAt('mats-near', zone.safeArea.x1 + 20)] };
    expect(stepAt(createTrip(near), inSafe).state.met).toEqual([]);
  });

  it('lists elements after predators and hazards met on one step', () => {
    const source: TripSource = {
      ...elementZone,
      predatorRoutes: [{ id: 'pike', waypoints: [{ x: 1100, y: 200 }], species: TEST_PIKE }],
      hazards: [{ id: 'mud', type: TEST_MUD, shape: { kind: 'circle', x: 1050, y: 200, r: 10 } }],
    };
    expect(stepAt(createTrip(source), { x: 1020, y: 200 }).state.met).toEqual(['test-pike', 'test-mud', 'test-mats']);
  });
});

describe('moving hazards in the trip (ND-8)', () => {
  const testFact = (id: string): FactCard => ({ id, name: id, title: id, body: id });
  const POLE_X = 1000;
  /** Offset -3 puts the pole 3 s into its cycle at hazard time 0: held at full depth. */
  const heldPole = movingHazardSpawn('pole-1', PUNTING_POLE, POLE_X, -3);
  const restingPole = movingHazardSpawn('pole-1', PUNTING_POLE, POLE_X, 0);
  const poleZone: TripSource = { ...zone, finds: [], spots: [], tilapiaRoutes: calmRoutes, movingHazards: [heldPole] };
  const restingZone: TripSource = { ...poleZone, movingHazards: [restingPole] };
  const underPole: Point = { x: POLE_X, y: 200 };
  const calm: Point = { x: 700, y: 120 };
  const sweepEdge = POLE_X + PUNTING_POLE.halfWidth;
  const atMeet: Point = { x: sweepEdge + PUNTING_POLE.meetRange, y: 200 };
  const pastMeet: Point = { x: sweepEdge + PUNTING_POLE.meetRange + 0.5, y: 200 };

  it('keeps every trip and encounter key unchanged without moving hazards', () => {
    const plain = createTrip(zone);
    const empty = createTrip({ ...zone, movingHazards: [] });
    expect(empty).toEqual(plain);
    expect(Object.keys(empty.encounter)).toEqual(Object.keys(plain.encounter));
    expect(stepAt(empty, calm).state).toEqual(stepAt(plain, calm).state);
  });

  it('starts the moving hazard clock at 0 and advances it on swimming steps only', () => {
    const trip = createTrip(restingZone);
    expect(trip.encounter.movingHazards).toEqual([restingPole]);
    expect(trip.encounter.hazardTime).toBe(0);
    expect(stepAt(trip, calm).state.encounter.hazardTime).toBe(DT);
    for (const dt of PAUSE_DTS) {
      expect(stepTrip(trip, { axolotlPos: calm, reduced: false, dashing: false }, dt, ctx).state).toBe(trip);
    }
  });

  it('holds the clock while carrying and restarts it on newTrip', () => {
    const carry = drive(createTrip(poleZone), { axolotlPos: underPole, reduced: false, dashing: false }, 'carryStart').state;
    expect(carry.phase).toBe('carrying');
    const clock = carry.encounter.hazardTime;
    expect(clock).toBeGreaterThan(0);
    const done = drive(carry, { axolotlPos: underPole, reduced: false, dashing: false }, 'arrivedHome').state;
    expect(done.phase).toBe('ended');
    expect(done.encounter.hazardTime).toBe(clock);
    const next = newTrip(done);
    expect(next.encounter.hazardTime).toBe(0);
    expect(next.encounter.movingHazards).toEqual([heldPole]);
    expect(next.encounter).toEqual(createTrip(poleZone).encounter);
  });

  it('counts a pole hit in legsLost, so Star 3 is not earned', () => {
    const hit = drive(createTrip(poleZone), { axolotlPos: underPole, reduced: false, dashing: false }, 'hit');
    expect(hit.events.find((event) => event.type === 'hit')).toMatchObject({ sourceId: 'pole-1' });
    expect(hit.state.legsLost).toBe(1);
    const stars = beatArea(hit.state, { specialTreasureId: PLANT }).state.ending?.stars;
    expect(stars?.legsOrRescue).toBe(false);
    expect(beatArea(createTrip(poleZone), { specialTreasureId: PLANT }).state.ending?.stars?.legsOrRescue).toBe(true);
  });

  it('meets the pole at exactly its meet range from its sweep, not past it, and makes its card due', () => {
    expect(stepAt(createTrip(restingZone), pastMeet).state.met).toEqual([]);
    const met = stepAt(createTrip(restingZone), atMeet).state;
    expect(met.met).toEqual([PUNTING_POLE.id]);
    expect(tripSnapshot(met).factCardDue).toBe(PUNTING_POLE.id);
  });

  it('meets it by its sweep while it rests, and gives its type id once for several poles', () => {
    const below: Point = { x: POLE_X, y: SURF + PUNTING_POLE.depth + PUNTING_POLE.meetRange };
    expect(stepAt(createTrip(restingZone), below).state.met).toEqual([PUNTING_POLE.id]);
    const second = movingHazardSpawn('pole-2', PUNTING_POLE, POLE_X + 40, 1);
    const twoPoles: TripSource = { ...restingZone, movingHazards: [restingPole, second] };
    const met = walk(createTrip(twoPoles), [atMeet, { x: POLE_X + 20, y: 300 }]).state;
    expect(met.met).toEqual([PUNTING_POLE.id]);
  });

  it('meets nothing inside the safe area', () => {
    const nearSafe = movingHazardSpawn('pole-near', PUNTING_POLE, zone.safeArea.x1 + 20, 0);
    const inSafe: Point = { x: zone.safeArea.x1 - 10, y: 200 };
    expect(stepAt(createTrip({ ...restingZone, movingHazards: [nearSafe] }), inSafe).state.met).toEqual([]);
  });

  it('lists moving hazards after still hazards and before elements met on one step', () => {
    const TEST_MUD: HazardType = { id: 'test-mud', name: 'Test mud', costsLeg: false, reach: 0, meetRange: 60, fact: testFact('test-mud') };
    const TEST_MATS: ElementType = { id: 'test-mats', name: 'Test mats', kind: 'cycle', period: 8, activeFor: 4, meetRange: 60, fact: testFact('test-mats') };
    const mats: ElementSpawn = {
      id: 'mats-a',
      type: TEST_MATS,
      offset: 0,
      matPair: { x0: 900, x1: 1000, rowTop: 150, rowBottom: 250, channelY: 200, openHeight: 60 },
    };
    const source: TripSource = {
      ...restingZone,
      movingHazards: [movingHazardSpawn('pole-far', PUNTING_POLE, 1100, 0)],
      hazards: [{ id: 'mud', type: TEST_MUD, shape: { kind: 'circle', x: 1050, y: 200, r: 10 } }],
      elements: [mats],
    };
    expect(stepAt(createTrip(source), { x: 1020, y: 200 }).state.met).toEqual(['test-mud', PUNTING_POLE.id, 'test-mats']);
  });
});

describe('drifting ghost nets in the trip (ND-11)', () => {
  const drift = netDrift(200, 0, 16, 0);
  const driftingNet: HazardSpawn = { id: 'test/net-drift', type: GHOST_NET, shape: { kind: 'rect', x0: 900, x1: 1000, y0: 150, y1: 250 }, drift };
  const driftZone: TripSource = { ...zone, finds: [], spots: [], tilapiaRoutes: calmRoutes, hazards: [driftingNet] };
  /** Half a drift period in: the net is at the far end of its path, 1100..1200. */
  const halfway = drift.period / 2;
  const onMovedNet: Point = { x: 1150, y: 200 };
  const onStartPlace: Point = { x: 950, y: 200 };

  function tripAt(elementTime: number): TripState {
    return { ...createTrip(driftZone), elementTime: elementTime - DT };
  }

  it('snags and meets the net where it is now, at the element time the step reaches', () => {
    const moved = stepAt(tripAt(halfway), onMovedNet);
    expect(moved.events).toEqual([{ type: 'snagged', id: driftingNet.id, at: onMovedNet }]);
    expect(moved.state.ghostNets.snagLeft).toBe(GHOST_NETS.snagTime);
    expect(moved.state.met).toEqual([GHOST_NET.id]);
  });

  it('neither snags nor meets the net where it is not now', () => {
    const atStart = stepAt(tripAt(DT), onMovedNet);
    expect(atStart.events).toEqual([]);
    expect(atStart.state.met).toEqual([]);
    const left = stepAt(tripAt(halfway), onStartPlace);
    expect(countOf(left.events, 'snagged')).toBe(0);
    expect(left.state.met).toEqual([]);
    expect(isSnagged(left.state.ghostNets)).toBe(false);
  });

  it('snags the net at its start place at element time 0, as a still net would', () => {
    const start = stepAt(createTrip(driftZone), onStartPlace);
    expect(start.events).toEqual([{ type: 'snagged', id: driftingNet.id, at: onStartPlace }]);
  });
});

describe('meetSnacks (ND-29)', () => {
  it('appends each new id once, in order, and makes its card due', () => {
    const trip = createTrip(zone);
    const met = meetSnacks(trip, ['tadpole', 'shrimp', 'tadpole']);
    expect(met.met).toEqual(['tadpole', 'shrimp']);
    expect(trip.met).toEqual([]);
    expect(tripSnapshot(met).factCardDue).toBe('tadpole');
    expect(tripSnapshot(markFactCardSeen(met, 'tadpole')).factCardDue).toBe('shrimp');
    expect(meetSnacks(meetSnacks(trip, ['tadpole']), ['shrimp', 'tadpole']).met).toEqual(['tadpole', 'shrimp']);
  });

  it('returns the same state when nothing is new', () => {
    const trip = createTrip(zone);
    expect(meetSnacks(trip, [])).toBe(trip);
    const met = meetSnacks(trip, ['tadpole']);
    expect(meetSnacks(met, ['tadpole'])).toBe(met);
  });

  it('never makes a card due that was already seen', () => {
    const seen = createTrip(zone, LEGS, [], DEFAULT_TRIP_SEED, { factCardsSeen: ['tadpole'] });
    const met = meetSnacks(seen, ['tadpole']);
    expect(met.met).toEqual(['tadpole']);
    expect(tripSnapshot(met).factCardDue).toBeNull();
  });
});

describe('glow-plants in the trip (issue #77, ND-8)', () => {
  const STEP = SWIM.dtMax;
  const HINT_STEPS = Math.round(GLOW_PLANTS.hintAfter / STEP);
  const darkWater: DarkWater = { x0: 960, x1: 1920, y0: 0, y1: 400 };
  const plantA = glowPlantSpawn('plant-a', { x: 1200, y: 200, radius: 20 });
  const plantB = glowPlantSpawn('plant-b', { x: 1600, y: 200, radius: 20 });
  const glowZone: TripSource = {
    ...zone,
    finds: [],
    spots: [],
    tilapiaRoutes: [],
    hazards: [],
    predatorRoutes: [],
    elements: [plantA, plantB],
    darkWater,
  };
  const deep: Point = { x: 1350, y: 120 };
  const atA: Point = { x: 1200, y: 200 - 20 - GLOW_PLANTS.bodyReach };
  const pastA: Point = { x: 1200, y: 200 - 20 - GLOW_PLANTS.bodyReach - 0.5 };
  const lit: Point = { x: 700, y: 200 };

  /** Swims `steps` steps of `STEP` seconds at `pos`. */
  function swimSteps(state: TripState, pos: Point, steps: number): TripState {
    let current = state;
    for (let i = 0; i < steps; i++) {
      current = stepTrip(current, { axolotlPos: pos, reduced: false, dashing: false }, STEP, ctx).state;
    }
    return current;
  }

  it('starts with every plant unlit, the hint clock at 0, no hint and a copy of the dark water', () => {
    const trip = createTrip(glowZone);
    expect(trip.litGlowPlants).toEqual([]);
    expect(trip.darkHintTime).toBe(0);
    expect(trip.darkHint).toBeNull();
    expect(trip.darkWater).toEqual(darkWater);
    expect(trip.darkWater).not.toBe(darkWater);
    expect(trip.elements[0].glowPlant).toEqual(plantA.glowPlant);
    expect(trip.elements[0].glowPlant).not.toBe(plantA.glowPlant);
    expect(createTrip(zone).darkWater).toBeNull();
  });

  it('lights a plant at exactly its touch reach, not past it, silently', () => {
    expect(stepAt(createTrip(glowZone), pastA).state.litGlowPlants).toEqual([]);
    const result = stepAt(createTrip(glowZone), atA);
    expect(result.state.litGlowPlants).toEqual(['plant-a']);
    expect(result.events).toEqual([]);
    expect(tripSnapshot(result.state).litGlowPlants).toEqual(['plant-a']);
  });

  it('keeps a lit plant lit, never twice, and keeps the same array when nothing new is lit', () => {
    const once = stepAt(createTrip(glowZone), atA).state;
    const away = walk(once, [deep, atA, deep]).state;
    expect(away.litGlowPlants).toBe(once.litGlowPlants);
    const both = stepAt(away, { x: 1600, y: 200 }).state;
    expect(both.litGlowPlants).toEqual(['plant-a', 'plant-b']);
  });

  it('never lights a plant while banked, carrying or ended', () => {
    const swimming = stepAt(createTrip(glowZone), deep).state;
    const bankedTrip: TripState = { ...swimming, phase: 'banked', heldAt: { ...atA } };
    expect(stepAt(bankedTrip, atA).state).toBe(bankedTrip);
    const carry: TripState = { ...swimming, phase: 'carrying', carry: { from: atA, to: home, pos: atA, elapsed: 0, duration: 5, still: false } };
    expect(stepAt(carry, atA).state.litGlowPlants).toEqual([]);
  });

  it('is trip state only: newTrip unlights every plant and the end record holds no lit plant', () => {
    const swum = swimSteps(stepAt(createTrip(glowZone), atA).state, deep, 10);
    const done = goHome({ ...swum, inHomeSpot: true }).state;
    expect(done.litGlowPlants).toEqual(['plant-a']);
    const next = newTrip(done);
    expect(next.litGlowPlants).toEqual([]);
    expect(next.darkHintTime).toBe(0);
    expect(next.darkHint).toBeNull();
    expect(next.darkWater).toEqual(darkWater);
    expect(next.elements).toEqual(glowZone.elements);
    expect(JSON.stringify(tripEndRecord(done, []))).not.toContain('plant-a');
  });

  it('shows the hint at the nearest unlit plant after 20 s in the dark with no new light', () => {
    const before = swimSteps(createTrip(glowZone), deep, HINT_STEPS - 1);
    expect(before.darkHintTime).toBeCloseTo(GLOW_PLANTS.hintAfter - STEP, 9);
    expect(before.darkHint).toBeNull();
    expect(tripSnapshot(before).glowPlantHint).toBeNull();
    const after = swimSteps(before, deep, 2);
    expect(after.darkHint).toBe('plant-a');
    expect(tripSnapshot(after).glowPlantHint).toBe('plant-a');
  });

  it('points the hint past a lit plant to the next unlit one, and shows none when all are lit', () => {
    const litA = stepAt(createTrip(glowZone), atA).state;
    expect(swimSteps(litA, deep, HINT_STEPS + 1).darkHint).toBe('plant-b');
    const allLit = stepAt(litA, { x: 1600, y: 200 }).state;
    const waited = swimSteps(allLit, deep, HINT_STEPS + 1);
    expect(waited.darkHintTime).toBeGreaterThan(GLOW_PLANTS.hintAfter);
    expect(waited.darkHint).toBeNull();
  });

  it('resets the hint clock on a new light', () => {
    const waited = swimSteps(createTrip(glowZone), deep, HINT_STEPS + 1);
    expect(waited.darkHint).toBe('plant-a');
    const litNow = stepAt(waited, atA).state;
    expect(litNow.darkHintTime).toBe(0);
    expect(litNow.darkHint).toBeNull();
    expect(tripSnapshot(litNow).glowPlantHint).toBeNull();
  });

  it('resets the hint clock on leaving the dark, and never runs it in a lit area', () => {
    const waited = swimSteps(createTrip(glowZone), deep, HINT_STEPS + 1);
    const out = stepAt(waited, lit).state;
    expect(out.darkHintTime).toBe(0);
    expect(out.darkHint).toBeNull();
    const edge = stepAt(createTrip(glowZone), { x: darkWater.x0, y: 200 }).state;
    expect(edge.darkHintTime).toBe(DT);
    const noDark: TripSource = { ...glowZone, darkWater: undefined };
    const unlitArea = swimSteps(createTrip(noDark), deep, HINT_STEPS + 1);
    expect(unlitArea.darkHintTime).toBe(0);
    expect(unlitArea.darkHint).toBeNull();
  });

  it('runs the hint clock by the capped step', () => {
    const long = stepTrip(createTrip(glowZone), { axolotlPos: deep, reduced: false, dashing: false }, 1, ctx);
    expect(long.state.darkHintTime).toBe(SWIM.dtMax);
  });

  it('pauses the hint clock with the game', () => {
    const swimming = swimSteps(createTrip(glowZone), deep, 10);
    for (const dt of PAUSE_DTS) {
      expect(stepTrip(swimming, { axolotlPos: deep, reduced: false, dashing: false }, dt, ctx).state).toBe(swimming);
    }
  });

  it('pauses the hint clock and hides the hint while the banking card shows', () => {
    const waited = swimSteps(createTrip(glowZone), deep, HINT_STEPS + 1);
    const bankedTrip: TripState = { ...waited, phase: 'banked', heldAt: { ...deep } };
    expect(stepAt(bankedTrip, deep).state).toBe(bankedTrip);
    expect(tripSnapshot(bankedTrip).glowPlantHint).toBeNull();
    const resumed = keepExploring(bankedTrip);
    expect(resumed.darkHintTime).toBe(waited.darkHintTime);
    expect(tripSnapshot(resumed).glowPlantHint).toBe('plant-a');
    expect(stepAt(resumed, deep).state.darkHintTime).toBeCloseTo(waited.darkHintTime + DT, 9);
  });

  it('pauses the hint clock and hides the hint through the carry home', () => {
    const darkCanal: TripSource = { ...zone, darkWater: { x0: 0, x1: 1920, y0: 0, y1: 400 } };
    const carry = carrying(darkCanal, inRange, false);
    expect(carry.state.phase).toBe('carrying');
    const atStart = carry.state.darkHintTime;
    expect(atStart).toBeCloseTo(carry.seconds - DT, 6);
    expect(tripSnapshot(carry.state).glowPlantHint).toBeNull();
    const moved = stepAt(carry.state, inRange).state;
    expect(moved.darkHintTime).toBe(atStart);
    const done = drive(moved, { axolotlPos: inRange, reduced: false, dashing: false }, 'arrivedHome').state;
    expect(done.phase).toBe('ended');
    expect(done.darkHintTime).toBe(atStart);
    expect(tripSnapshot(done).glowPlantHint).toBeNull();
  });
});

describe('gliding trajineras in the trip (issue #78, ND-8)', () => {
  /** Offset -2 puts the hull 2 s into its crossing at element time 0: x 620 to 740, mid-span. */
  const boat = trajineraSpawn('canal/trajinera-1', -2, { x0: 600, x1: 880, direction: 'right' });
  const boatZone: TripSource = { ...findZone, trajineras: [boat] };
  const underHull: Point = { x: 700, y: 130 };
  const clear: Point = { x: 700, y: 260 };

  it('keeps a trip with no boats unchanged', () => {
    const plain = createTrip(zone);
    expect(plain.trajineras).toBeNull();
    expect(createTrip({ ...zone, trajineras: [] })).toEqual(plain);
    const result = stepAt(plain, underHull);
    expect(result).not.toHaveProperty('pushed');
    expect(result.state.trajineras).toBeNull();
  });

  it('starts the lane with the boats, the swim bounds, the rock walls and every cooldown at 0', () => {
    const rock = { x0: 1000, x1: 1100, y0: 200, y1: 318 };
    const lane = createTrip({ ...boatZone, rockWalls: [rock] }).trajineras;
    expect(lane).toEqual({ boats: [boat], bounds: swimBounds(zone), rocks: [rock], cooldowns: [0] });
    expect(lane?.boats[0]).not.toBe(boat);
  });

  it('refuses boats without the area width or bed top', () => {
    expect(() => createTrip({ ...boatZone, width: undefined })).toThrow(RangeError);
    expect(() => createTrip({ ...boatZone, bedTop: undefined })).toThrow(RangeError);
  });

  it('pushes the axolotl out of the hull: no leg, no hit and no protected time', () => {
    const result = stepAt(createTrip(boatZone), underHull);
    expect(result.pushed).toMatchObject({ id: 'canal/trajinera-1', from: underHull, to: { x: 700, y: SURF + 60 + TRAJINERAS.bodyReach } });
    expect(result.impulse).toEqual({ x: 0, y: TRAJINERAS.pushSpeed });
    expect(result.impulse).not.toBe(result.pushed?.impulse);
    expect(result.events).toEqual([]);
    expect(result.state.legsLost).toBe(0);
    expect(presentCount(result.state.encounter.legs)).toBe(LEGS.count);
    expect(isProtected(result.state.encounter.legs)).toBe(false);
    expect(result.state.trajineras?.cooldowns).toEqual([TRAJINERAS.pushCooldown]);
  });

  it('drops no carried find', () => {
    const carried = walk(createTrip(boatZone), [spotA]).state;
    expect(carried.holdings.bag).toEqual([PLANT]);
    const result = stepAt(carried, underHull);
    expect(result.pushed).toBeDefined();
    expect(result.state.holdings).toEqual(carried.holdings);
    expect(result.state.found).toEqual(carried.found);
  });

  it('gives no push again during the cooldown, then pushes again', () => {
    const steps = Math.ceil(TRAJINERAS.pushCooldown / DT) + 1;
    let state = createTrip(boatZone);
    const pushedOn: number[] = [];
    for (let step = 0; step <= steps; step++) {
      const result = stepAt(state, underHull);
      if (result.pushed) pushedOn.push(step);
      state = result.state;
    }
    expect(pushedOn).toHaveLength(2);
    expect(pushedOn[0]).toBe(0);
    expect(pushedOn[1] * DT).toBeGreaterThanOrEqual(TRAJINERAS.pushCooldown - 1e-9);
  });

  it('gives no push clear of the hull, and counts the cooldown down with the capped step', () => {
    const pushed = stepAt(createTrip(boatZone), underHull).state;
    const away = stepAt(pushed, clear);
    expect(away).not.toHaveProperty('pushed');
    expect(away.impulse).toBeUndefined();
    expect(away.state.trajineras?.cooldowns[0]).toBeCloseTo(TRAJINERAS.pushCooldown - DT, 9);
    const long = stepTrip(pushed, { axolotlPos: clear, reduced: false, dashing: false }, 1, ctx);
    expect(long.state.trajineras?.cooldowns[0]).toBeCloseTo(TRAJINERAS.pushCooldown - SWIM.dtMax, 9);
  });

  it('lets a bump win over a push on the same step, with no cooldown started', () => {
    const edgeBoat = trajineraSpawn('canal/trajinera-2', -2, { x0: 200, x1: 480, direction: 'right' });
    const edge: TripSource = { ...zone, tilapiaRoutes: [{ id: 'edge', waypoints: [{ x: 324, y: 130 }] }], trajineras: [edgeBoat] };
    const result = stepAt(createTrip(edge), { x: 300, y: 130 });
    expect(result.events.map((event) => event.type)).toEqual(['bump']);
    expect(result).not.toHaveProperty('pushed');
    expect(result.impulse).toBeDefined();
    expect(result.state.trajineras?.cooldowns).toEqual([0]);
  });

  it('never changes Star 3: a push is not a leg lost', () => {
    const pushed = stepAt(createTrip(boatZone), underHull).state;
    expect(beatArea(pushed, { specialTreasureId: PLANT }).state.ending?.stars?.legsOrRescue).toBe(true);
  });

  it('holds the boats while paused and restarts the cooldowns on newTrip', () => {
    const pushed = stepAt(createTrip(boatZone), underHull).state;
    for (const dt of PAUSE_DTS) {
      expect(stepTrip(pushed, { axolotlPos: underHull, reduced: false, dashing: false }, dt, ctx).state).toBe(pushed);
    }
    const atHome = stepAt(pushed, home).state;
    expect(atHome.trajineras?.cooldowns[0]).toBeGreaterThan(0);
    const done = goHome(atHome).state;
    expect(done.phase).toBe('ended');
    const next = newTrip(done, 42);
    expect(next.trajineras).toEqual({ ...pushed.trajineras, cooldowns: [0] });
    expect(next).toEqual(createTrip(boatZone, LEGS, [], 42));
  });
});
