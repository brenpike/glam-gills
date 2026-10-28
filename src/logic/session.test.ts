import { describe, expect, it } from 'vitest';
import { CANAL_AREA, CHINAMPA_2_AREA, CHINAMPA_AREA, POND_2_AREA, POND_AREA, SPRING_CAVE_AREA } from './areas';
import { DEV_TEST_AREA } from './devAreas';
import { DEFAULT_LOOK, LOOK_FIELDS, rescuedLook, type AxolotlLook, type AxolotlSex } from './axolotlLook';
import { NAME_MAX, nameFits, nameLength, suggestedNamesFor } from './axolotlNames';
import { CANAL_TREASURES, WEARABLE_SLOTS, type DreamColourId, type Wearable } from './catalogue';
import { collectNear, type Collectible } from './collectibles';
import { createEncounterContext } from './encounter';
import { REGISTRY_KEYS } from './gameEvents';
import { REAL_MORPHS, STARTER_MORPH, axolotlFindId, isAxolotlFindId, type RealMorphId } from './morphs';
import { dueFirstFindCards } from './firstFind';
import { emptyOutfit, type Outfit } from './outfit';
import { nextTripSeed, type PlacedFind } from './placement';
import { pickStranding } from './rescue';
import {
  SESSION_REGISTRY_KEY,
  STARTER_AXOLOTL_ID,
  addStarter,
  areaMemory,
  bestStars,
  canRescueMore,
  chooseArea,
  chooseExplorer,
  createSession,
  explorerAxolotl,
  explorerId,
  explorerMorph,
  markFactCardFound,
  markDashPotTipSeen,
  markFirstFindSeen,
  needsStarter,
  newOwnedAxolotl,
  orderedMetHazards,
  recordTripEnd,
  restoreSnacks,
  restyleAxolotl,
  setDreamColour,
  setOutfit,
  setTankLayout,
  takeOffFrom,
  tripEndRecord,
  tripStart,
  wearOn,
  type AxolotlStyle,
  type OwnedAxolotl,
  type Session,
  type TripEndRecord,
} from './session';
import { createTankLayout, placeDecoration, suggestSpot } from './tank';
import { NO_STARS, type AreaStars } from './stars';
import {
  beatArea,
  createTrip,
  createTripContext,
  goHome,
  keepExploring,
  newTrip,
  stepTrip,
  tripSnapshot,
  type TripEvent,
  type TripState,
} from './trip';
import { TRIP_REGISTRY_KEYS } from './tripEvents';
import { LEGS } from './tuning';
import { CANAL_AREA_ID, buildCanalZone, type Point } from './zone';

const DT = 1 / 60;
const FIRST_SEED = 0x1234abcd;
const zone = buildCanalZone();
const ctx = createTripContext({ encounter: createEncounterContext({ legs: { ...LEGS, regrowTime: 1e9 } }) });
const routeStart = zone.tilapiaRoutes[0].waypoints[0];
const inRange: Point = { x: routeStart.x + 60, y: routeStart.y };
const PLANT = 'canal/pond-plant';
const BOAT = 'canal/toy-boat';
const HAT = 'canal/sun-hat';
const MINT_SHELL = 'canal/paint-shell-mint';
const GALAXY_SHELL = 'canal/paint-shell-galaxy';
const POND_ID = POND_AREA.id;
const POND_2_ID = POND_2_AREA.id;
const CHINAMPA_ID = CHINAMPA_AREA.id;
const CHINAMPA_2_ID = CHINAMPA_2_AREA.id;
const SPRING_CAVE_ID = SPRING_CAVE_AREA.id;
const LILY_PAD = 'pond/lily-pad';

/** Steps the trip once with the axolotl at `pos`. */
function stepAt(trip: TripState, pos: Point): TripState {
  return stepTrip(trip, { axolotlPos: pos, reduced: false, dashing: false }, DT, ctx).state;
}

/** Steps the trip at `pos` until an `until` event, for at most `limitS` seconds. */
function driveUntil(trip: TripState, pos: Point, until: TripEvent['type'], limitS = 120): TripState {
  let current = trip;
  for (let seconds = 0; seconds < limitS; seconds += DT) {
    const result = stepTrip(current, { axolotlPos: pos, reduced: false, dashing: false }, DT, ctx);
    current = result.state;
    if (result.events.some((event) => event.type === until)) return current;
  }
  throw new Error(`no ${until} within ${limitS} s`);
}

/** The first placed treasure that is not in a Dash pot. */
function openFind(trip: TripState, skip: readonly string[] = []): PlacedFind {
  const find = trip.placed.find((placed) => !placed.sealed && !skip.includes(placed.id));
  if (find === undefined) throw new Error('no open find placed');
  return find;
}

/** Picks up an open find, banks it at the Home Spot and goes home. Returns the ended trip and the banked id. */
function wentHome(trip: TripState): { ended: TripState; id: string } {
  const find = openFind(trip);
  const atHome = stepAt(stepAt(trip, find), zone.start);
  expect(atHome.phase).toBe('banked');
  const ended = goHome(atHome).state;
  expect(ended.phase).toBe('ended');
  return { ended, id: find.id };
}

/** Picks up an open find not in `skip` and is carried home with it. Returns the ended trip and the lost id. */
function carriedHome(trip: TripState, skip: readonly string[]): { ended: TripState; id: string } {
  const find = openFind(trip, skip);
  const holding = stepAt(trip, find);
  expect(holding.holdings.bag).toEqual([find.id]);
  const ended = driveUntil(driveUntil(holding, inRange, 'carryStart'), inRange, 'arrivedHome');
  expect(ended.ending?.reason).toBe('carriedHome');
  return { ended, id: find.id };
}

/** The trip a session starts with only its lost treasures, as the in-place `newTrip` flow builds it. */
function startTrip(session: Session, freshSeed: number): TripState {
  const start = tripStart(session, freshSeed);
  return createTrip(zone, LEGS, start.banked, start.tripSeed, { returnedFinds: start.returnedFinds });
}

/**
 * The trip a session starts with its stranded axolotl, fact cards seen and lost treasures, as the
 * scene flow builds it.
 */
function startRescueTrip(session: Session, freshSeed: number): TripState {
  const start = tripStart(session, freshSeed);
  const stranding = pickStranding(start.ownedMorphs, start.waitingStranded, zone.strandingPlaces, start.tripSeed);
  return createTrip(zone, LEGS, start.banked, start.tripSeed, {
    stranding,
    factCardsSeen: start.factCardsSeen,
    returnedFinds: start.returnedFinds,
  });
}

/** The trip's stranded axolotl. Throws when it has none. */
function rescueOf(trip: TripState): NonNullable<TripState['rescue']> {
  if (trip.rescue === null) throw new Error('no stranded axolotl');
  return trip.rescue;
}

/** Swims onto the stranded axolotl, so it follows. */
function reachRescue(trip: TripState): TripState {
  const following = stepAt(trip, rescueOf(trip).place);
  expect(following.holdings.bag).toContain(rescueOf(trip).id);
  return following;
}

/** Swims to the Home Spot with a non-empty Trip Bag, banking it. */
function bankAtHome(trip: TripState): TripState {
  const banked = stepAt(trip, zone.start);
  expect(banked.phase).toBe('banked');
  return banked;
}

/** Rescues the stranded axolotl, banks it and goes home. Returns the session after the trip. */
function rescueAndGoHome(session: Session, freshSeed: number): Session {
  const ended = goHome(bankAtHome(reachRescue(startRescueTrip(session, freshSeed)))).state;
  expect(ended.ending?.reason).toBe('wentHome');
  return recordTripEnd(session, tripEndRecord(ended, []));
}

/** Gets carried home from `trip`, within 20 simulated seconds per stage. */
function carriedHomeFrom(trip: TripState): TripState {
  const ended = driveUntil(driveUntil(trip, inRange, 'carryStart', 20), inRange, 'arrivedHome', 20);
  expect(ended.ending?.reason).toBe('carriedHome');
  return ended;
}

/** Asserts every owned morph is found in the Collection Book and no axolotl id is banked. */
function expectConsistent(session: Session): void {
  for (const axolotl of session.hub.axolotls) expect(session.hub.book.foundMorphs).toContain(axolotl.morph);
  expect(session.hub.banked.filter(isAxolotlFindId)).toEqual([]);
}

/** Snacks with the first `count` eaten by swimming onto them. */
function eatSnacks(snacks: Collectible[], count: number): Collectible[] {
  return snacks.slice(0, count).reduce((items, snack) => collectNear(items, snack).items, snacks);
}

/** The next trip the session would start from `record`, as the old in-place `newTrip` flow did. */
function nextFromRecord(record: TripEndRecord): TripState {
  return createTrip(zone, LEGS, record.banked, nextTripSeed(record.tripSeed), { returnedFinds: record.returnedFinds });
}

function record(banked: string[], tripSeed: number, eatenSnacks: string[] = []): TripEndRecord {
  return {
    areaId: CANAL_AREA_ID,
    banked,
    rescued: [],
    eatenSnacks,
    tripSeed,
    waitingStranded: null,
    met: [],
    returnedFinds: [],
  };
}

const SPECIAL = { specialTreasureId: CANAL_AREA.specialTreasureId };

/** Picks up an open find, banks it at the Home Spot, swims on and beats the area. Returns the ended trip and the banked id. */
function beatAfterBanking(trip: TripState): { ended: TripState; id: string } {
  const find = openFind(trip);
  const atHome = stepAt(stepAt(trip, find), zone.start);
  expect(atHome.phase).toBe('banked');
  const ended = beatArea(keepExploring(atHome), SPECIAL).state;
  expect(ended.ending?.reason).toBe('areaBeaten');
  return { ended, id: find.id };
}

/** A record of a beaten Area 1 that earned `earned`. */
function beatenRecord(earned: AreaStars, tripSeed: number): TripEndRecord {
  return { ...record([], tripSeed), stars: { areaId: CANAL_AREA_ID, earned } };
}

/** A look with every field off the default, a girl. */
const STYLED: AxolotlLook = {
  eyes: 'grumpy',
  mouth: 'smallO',
  gills: 'long',
  spots: 'patches',
  size: 'large',
  sex: 'girl',
  tail: 'long',
  body: 'chubby',
  age: 'baby',
};

/** STYLED as a restyle leaves it on a boy, such as the `withStarter` starter: the sex stays a boy. */
const STYLED_BOY: AxolotlLook = { ...STYLED, sex: 'boy' };

/**
 * A new session with a starter named `name`, of real morph `morph` and the default look, as the
 * character creator makes it.
 */
function withStarter(name = 'Gilly', morph: RealMorphId = STARTER_MORPH): Session {
  return addStarter(createSession(), { name, look: DEFAULT_LOOK }, morph);
}

/** The starter `withStarter` makes. */
function starterOf(morph: RealMorphId = STARTER_MORPH, name = 'Gilly'): OwnedAxolotl {
  return { id: STARTER_AXOLOTL_ID, morph, name, look: DEFAULT_LOOK, dreamColour: null, outfit: emptyOutfit() };
}

/** A rescued axolotl of `morph` and `sex` as `recordTripEnd` adopts it: a suggested `name` and the rescued look. */
function rescuedOf(morph: RealMorphId, name: string, sex: AxolotlSex): OwnedAxolotl {
  return { id: axolotlFindId(morph), morph, name, look: rescuedLook(sex), dreamColour: null, outfit: emptyOutfit() };
}

describe('createSession', () => {
  it('starts with no axolotl, an empty Collection Book, nothing banked, an empty tank and no trip', () => {
    expect(createSession()).toEqual({
      hub: {
        banked: [],
        axolotls: [],
        tank: { placed: [] },
        book: { foundMorphs: [] },
        stars: {},
        explorerId: null,
        firstFindsSeen: [],
        lastAreaId: CANAL_AREA_ID,
        metHazards: [],
        dashPotTipSeen: false,
      },
      areas: {
        canal: { eatenSnacks: [], lastTripSeed: null, waitingStranded: null, returnedFinds: [] },
        'pond-1': { eatenSnacks: [], lastTripSeed: null, waitingStranded: null, returnedFinds: [] },
        'pond-2': { eatenSnacks: [], lastTripSeed: null, waitingStranded: null, returnedFinds: [] },
        'chinampa-1': { eatenSnacks: [], lastTripSeed: null, waitingStranded: null, returnedFinds: [] },
        'chinampa-2': { eatenSnacks: [], lastTripSeed: null, waitingStranded: null, returnedFinds: [] },
        'spring-cave-1': { eatenSnacks: [], lastTripSeed: null, waitingStranded: null, returnedFinds: [] },
      },
    });
    expect(STARTER_AXOLOTL_ID).toBe('starter');
  });

  it('survives a JSON round trip, before and after a trip', () => {
    const fresh = createSession();
    expect(JSON.parse(JSON.stringify(fresh))).toEqual(fresh);
    const played = setTankLayout(recordTripEnd(withStarter(), record([PLANT, HAT], 7, ['snack-1'])), {
      placed: [{ id: PLANT, x: 240, y: 318 }],
    });
    expect(JSON.parse(JSON.stringify(played))).toEqual(played);
    const waiting = { morph: 'wild' as const, sex: 'girl' as const, placeId: zone.strandingPlaces[1].id };
    const rescued = recordTripEnd(played, {
      ...record([], 8),
      rescued: [{ morph: 'melanoid', sex: 'girl' }],
      waitingStranded: waiting,
      met: ['tilapia'],
    });
    expect(JSON.parse(JSON.stringify(rescued))).toEqual(rescued);
    const starred = recordTripEnd(played, beatenRecord({ exit: true, special: false, legsOrRescue: true }, 8));
    expect(JSON.parse(JSON.stringify(starred))).toEqual(starred);
  });

  it('uses a registry key no game or trip registry key uses', () => {
    const others = new Set<string>([...Object.values(REGISTRY_KEYS), ...Object.values(TRIP_REGISTRY_KEYS)]);
    expect(SESSION_REGISTRY_KEY).toBe('session');
    expect(others.has(SESSION_REGISTRY_KEY)).toBe(false);
  });
});

describe('tripStart seeds (B4)', () => {
  it('uses the fresh seed for the first trip', () => {
    expect(tripStart(withStarter(), FIRST_SEED)).toEqual({
      banked: [],
      eatenSnacks: [],
      tripSeed: FIRST_SEED,
      ownedMorphs: [STARTER_MORPH],
      waitingStranded: null,
      factCardsSeen: [],
      returnedFinds: [],
    });
  });

  it('uses the seed after the last trip for every later trip, ignoring the fresh seed', () => {
    const session = recordTripEnd(withStarter(), record([PLANT], FIRST_SEED, ['snack-1']));
    const start = tripStart(session, 99);
    expect(start).toEqual({
      banked: [PLANT],
      eatenSnacks: ['snack-1'],
      tripSeed: nextTripSeed(FIRST_SEED),
      ownedMorphs: [STARTER_MORPH],
      waitingStranded: null,
      factCardsSeen: [],
      returnedFinds: [],
    });
    expect(tripStart(session, 5).tripSeed).toBe(start.tripSeed);
  });

  it('hands out copies, so changing them leaves the session alone', () => {
    const session = recordTripEnd(withStarter(), record([PLANT], 1, ['snack-1']));
    const waiting = recordTripEnd(session, {
      ...record([], 2),
      waitingStranded: { morph: 'wild', sex: 'girl', placeId: 'p' },
      returnedFinds: [BOAT],
    });
    const start = tripStart(waiting, 2);
    start.banked.push(HAT);
    start.eatenSnacks.push('snack-2');
    start.ownedMorphs.push('wild');
    if (start.waitingStranded) start.waitingStranded.placeId = 'q';
    start.returnedFinds.push(HAT);
    expect(waiting.hub.banked).toEqual([PLANT]);
    expect(waiting.areas.canal.eatenSnacks).toEqual([]);
    expect(waiting.hub.axolotls).toEqual([starterOf()]);
    expect(waiting.areas.canal.waitingStranded).toEqual({ morph: 'wild', sex: 'girl', placeId: 'p' });
    expect(waiting.areas.canal.returnedFinds).toEqual([BOAT]);
  });
});

describe('tripEndRecord', () => {
  it('throws unless the trip has ended', () => {
    const swimming = createTrip(zone, LEGS, [], FIRST_SEED);
    expect(() => tripEndRecord(swimming, [])).toThrow(/swimming/);
  });

  it('throws when an ended trip has no ending', () => {
    const swimming = createTrip(zone, LEGS, [], FIRST_SEED);
    const endless: TripState = { ...swimming, phase: 'ended', ending: null };
    expect(() => tripEndRecord(endless, [])).toThrow(/no ending/);
  });

  it('throws when a banked axolotl is not the trip\'s rescue', () => {
    const { ended } = wentHome(startTrip(withStarter(), FIRST_SEED));
    const stray: TripState = { ...ended, holdings: { ...ended.holdings, banked: [axolotlFindId('wild')] } };
    expect(ended.rescue).toBeNull();
    expect(() => tripEndRecord(stray, [])).toThrow(/not the trip's rescue/);
  });

  it('records a went-home trip: the new find banked, the eaten snacks and the seed', () => {
    const trip = startTrip(withStarter(), FIRST_SEED);
    const { ended, id } = wentHome(trip);
    const snacks = eatSnacks(restoreSnacks(zone.collectibles, []), 2);
    const rec = tripEndRecord(ended, snacks);
    expect(rec).toEqual({
      areaId: CANAL_AREA_ID,
      banked: [id],
      rescued: [],
      eatenSnacks: [zone.collectibles[0].id, zone.collectibles[1].id],
      tripSeed: FIRST_SEED,
      waitingStranded: null,
      met: ended.met,
      returnedFinds: [],
    });
  });

  it('records a carried-home trip: the lost find is not owned, banked finds are kept, no snacks stay eaten (A11, A12, A19, B9)', () => {
    const first = wentHome(startTrip(withStarter(), FIRST_SEED));
    const session = recordTripEnd(withStarter(), tripEndRecord(first.ended, []));
    const lost = carriedHome(startTrip(session, 0), [first.id]);
    const snacks = eatSnacks(restoreSnacks(zone.collectibles, []), 2);
    const rec = tripEndRecord(lost.ended, snacks);
    expect(lost.ended.ending?.returned).toEqual([lost.id]);
    expect(rec.banked).toEqual([first.id]);
    expect(rec.banked).not.toContain(lost.id);
    expect(rec.eatenSnacks).toEqual([]);
    expect(rec.returnedFinds).toEqual([lost.id]);
    const after = recordTripEnd(session, rec);
    expect(after.hub.banked).toEqual([first.id]);
    expect(after.areas.canal.lastTripSeed).toBe(nextTripSeed(FIRST_SEED));
    expect(after.areas.canal.returnedFinds).toEqual([lost.id]);
    expect(after.areas.canal.returnedFinds).not.toBe(rec.returnedFinds);
    expect(tripStart(after, 0).returnedFinds).toEqual([lost.id]);
  });
});

describe('recordTripEnd', () => {
  it('keeps banked an order-preserving union that never shrinks', () => {
    const once = recordTripEnd(withStarter(), record([PLANT, HAT], 1));
    const twice = recordTripEnd(once, record([BOAT, PLANT], 2));
    expect(twice.hub.banked).toEqual([PLANT, HAT, BOAT]);
    const shorter = recordTripEnd(twice, record([], 3));
    expect(shorter.hub.banked).toEqual([PLANT, HAT, BOAT]);
  });

  it('stores the eaten snacks and the trip seed, and leaves the input session alone', () => {
    const session = withStarter();
    const next = recordTripEnd(session, record([PLANT], 42, ['snack-1', 'snack-2']));
    expect(next.areas.canal).toEqual({
      eatenSnacks: ['snack-1', 'snack-2'],
      lastTripSeed: 42,
      waitingStranded: null,
      returnedFinds: [],
    });
    expect(session).toEqual(withStarter());
  });

  it('never banks an axolotl find id', () => {
    const next = recordTripEnd(withStarter(), record([PLANT, axolotlFindId('wild'), HAT], 1));
    expect(next.hub.banked).toEqual([PLANT, HAT]);
    expect(next.hub.axolotls.map((axolotl) => axolotl.morph)).toEqual([STARTER_MORPH]);
  });

  it('owns each rescued morph once, after the starter, with found morphs in REAL_MORPHS order (C4)', () => {
    const session = withStarter('Gilly', 'melanoid');
    const once = recordTripEnd(session, {
      ...record([], 1),
      rescued: [
        { morph: 'wild', sex: 'girl' },
        { morph: 'melanoid', sex: 'boy' },
        { morph: 'wild', sex: 'boy' },
      ],
    });
    expect(once.hub.axolotls).toEqual([starterOf('melanoid'), rescuedOf('wild', 'Bubbles', 'girl')]);
    expect(once.hub.book.foundMorphs).toEqual(['wild', 'melanoid']);
    const twice = recordTripEnd(once, {
      ...record([], 2),
      rescued: [
        { morph: 'wild', sex: 'boy' },
        { morph: 'leucistic', sex: 'boy' },
      ],
    });
    expect(twice.hub.axolotls.map((axolotl) => axolotl.look.sex)).toEqual(['boy', 'girl', 'boy']);
    expect(twice.hub.axolotls.map((axolotl) => axolotl.morph)).toEqual(['melanoid', 'wild', 'leucistic']);
    expect(twice.hub.axolotls.map((axolotl) => axolotl.name)).toEqual(['Gilly', 'Bubbles', 'Pebble']);
    expect(twice.hub.book.foundMorphs).toEqual(['leucistic', 'wild', 'melanoid']);
    expect(explorerMorph(twice)).toBe('melanoid');
    expectConsistent(twice);
  });

  it('unlocks the tilapia card once a tilapia is met and keeps it unlocked', () => {
    const met = recordTripEnd(withStarter(), { ...record([], 1), met: ['tilapia'] });
    expect(met.hub.metHazards).toEqual(['tilapia']);
    expect(tripStart(met, 0).factCardsSeen).toEqual(['tilapia']);
    const later = recordTripEnd(met, record([], 2));
    expect(later.hub.metHazards).toEqual(['tilapia']);
    const again = recordTripEnd(later, { ...record([], 3), met: ['tilapia'] });
    expect(again.hub.metHazards).toEqual(['tilapia']);
  });

  it('drops met ids that are no known hazard or predator', () => {
    const met = recordTripEnd(withStarter(), { ...record([], 1), met: ['test-mud', 'tilapia', 'test-pike'] });
    expect(met.hub.metHazards).toEqual(['tilapia']);
    const unknownOnly = recordTripEnd(withStarter(), { ...record([], 1), met: ['test-mud'] });
    expect(unknownOnly.hub.metHazards).toEqual([]);
  });

  it('hands out a copy of the hazards met as the fact cards seen', () => {
    const session = recordTripEnd(withStarter(), { ...record([], 1), met: ['tilapia'] });
    const start = tripStart(session, 0);
    expect(start.factCardsSeen).toEqual(['tilapia']);
    expect(start.factCardsSeen).not.toBe(session.hub.metHazards);
  });

  it('keeps the tank and the axolotls across records', () => {
    const banked = [PLANT, BOAT];
    const base = recordTripEnd(withStarter(), record(banked, 1));
    const layout = placeDecoration(createTankLayout(), banked, PLANT, suggestSpot(createTankLayout())).layout;
    const decorated = setTankLayout(base, layout);
    const next = recordTripEnd(decorated, record([HAT], 2));
    expect(next.hub.tank).toEqual(layout);
    expect(next.hub.axolotls).toEqual([starterOf()]);
  });

  it('keeps the first-find cards seen (C15)', () => {
    const seen = markFirstFindSeen(markFirstFindSeen(withStarter(), 'wearable'), 'decoration');
    const next = recordTripEnd(seen, record([MINT_SHELL], 1));
    expect(next.hub.firstFindsSeen).toEqual(['decoration', 'wearable']);
  });
});

describe('restoreSnacks (A12, A19)', () => {
  it('marks eaten ids collected and ignores unknown ids', () => {
    const eaten = [zone.collectibles[1].id, 'snack-unknown'];
    const snacks = restoreSnacks(zone.collectibles, eaten);
    expect(snacks.length).toBe(zone.collectibles.length);
    expect(snacks.filter((snack) => snack.collected).map((snack) => snack.id)).toEqual([zone.collectibles[1].id]);
  });

  it('keeps eaten snacks after going home and brings every snack back after being carried home', () => {
    const snacks = eatSnacks(restoreSnacks(zone.collectibles, []), 3);
    const went = wentHome(startTrip(withStarter(), FIRST_SEED));
    const session = recordTripEnd(withStarter(), tripEndRecord(went.ended, snacks));
    const restored = restoreSnacks(zone.collectibles, tripStart(session, 0).eatenSnacks);
    expect(restored).toEqual(snacks);
    const lost = carriedHome(startTrip(session, 0), [went.id]);
    const after = recordTripEnd(session, tripEndRecord(lost.ended, restored));
    expect(tripStart(after, 0).eatenSnacks).toEqual([]);
    expect(restoreSnacks(zone.collectibles, tripStart(after, 0).eatenSnacks)).toEqual(
      restoreSnacks(zone.collectibles, []),
    );
  });
});

describe('session trips match the in-place newTrip flow (regression)', () => {
  it('builds the same next trip as newTrip after going home and after being carried home', () => {
    let session = withStarter();
    const firstTrip = startTrip(session, FIRST_SEED);
    expect(firstTrip).toEqual(createTrip(zone, LEGS, [], FIRST_SEED));

    const went = wentHome(firstTrip);
    const wentRecord = tripEndRecord(went.ended, []);
    expect(nextFromRecord(wentRecord)).toEqual(newTrip(went.ended));
    session = recordTripEnd(session, wentRecord);
    const secondTrip = startTrip(session, 0);
    expect(secondTrip).toEqual(newTrip(went.ended));
    expect(secondTrip.placed.map((find) => find.id)).not.toContain(went.id);

    const lost = carriedHome(secondTrip, [went.id]);
    const lostRecord = tripEndRecord(lost.ended, []);
    expect(nextFromRecord(lostRecord)).toEqual(newTrip(lost.ended));
    session = recordTripEnd(session, lostRecord);
    const thirdTrip = startTrip(session, 0);
    expect(thirdTrip).toEqual(newTrip(lost.ended));
    const placedIds = thirdTrip.placed.map((find) => find.id);
    expect(placedIds).toContain(lost.id);
    for (const id of session.hub.banked) expect(placedIds).not.toContain(id);
  });
});

describe('lost treasures next trip (A12, B9)', () => {
  /** A session whose last trip was carried home losing one treasure. Returns it and the lost id. */
  function afterLosing(): { session: Session; lostId: string } {
    const first = wentHome(startTrip(withStarter(), FIRST_SEED));
    const session = recordTripEnd(withStarter(), tripEndRecord(first.ended, []));
    const lost = carriedHome(startTrip(session, 0), [first.id]);
    return { session: recordTripEnd(session, tripEndRecord(lost.ended, [])), lostId: lost.id };
  }

  it('places the treasures lost when carried home on the next trip, whatever its seed', () => {
    const { session, lostId } = afterLosing();
    const start = tripStart(session, 0);
    expect(start.returnedFinds).toEqual([lostId]);
    expect(startTrip(session, 0).placed.map((find) => find.id)).toContain(lostId);
    for (let seed = 1; seed <= 50; seed++) {
      const trip = createTrip(zone, LEGS, start.banked, seed, { returnedFinds: start.returnedFinds });
      expect(trip.placed.map((find) => find.id)).toContain(lostId);
    }
  });

  it('clears them after the next ending without losses', () => {
    const { session } = afterLosing();
    const went = recordTripEnd(session, tripEndRecord(wentHome(startTrip(session, 0)).ended, []));
    expect(went.areas.canal.returnedFinds).toEqual([]);
    expect(tripStart(went, 0).returnedFinds).toEqual([]);
    const beaten = recordTripEnd(session, tripEndRecord(beatArea(startTrip(session, 0), SPECIAL).state, []));
    expect(beaten.areas.canal.returnedFinds).toEqual([]);
    expect(tripStart(beaten, 0).returnedFinds).toEqual([]);
  });

  it('never keeps the id of a following axolotl carried home, which waits instead (C5)', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    const { morph } = rescueOf(trip);
    const find = openFind(trip);
    const ended = carriedHomeFrom(reachRescue(stepAt(trip, find)));
    expect(ended.ending?.returned).toEqual([find.id, axolotlFindId(morph)]);
    const rec = tripEndRecord(ended, []);
    expect(rec.returnedFinds).toEqual([find.id]);
    const after = recordTripEnd(withStarter(), rec);
    expect(after.areas.canal.returnedFinds).toEqual([find.id]);
    expect(after.areas.canal.waitingStranded?.morph).toBe(morph);
    expect(startRescueTrip(after, 0).placed.map((placed) => placed.id)).toContain(find.id);
  });
});

describe('setTankLayout', () => {
  it('sanitizes the layout against the banked ids', () => {
    const session = recordTripEnd(withStarter(), record([PLANT], 1));
    const next = setTankLayout(session, {
      placed: [
        { id: PLANT, x: 240, y: 318 },
        { id: BOAT, x: 144, y: 318 },
      ],
    });
    expect(next.hub.tank).toEqual({ placed: [{ id: PLANT, x: 240, y: 318 }] });
    expect(next.hub.banked).toBe(session.hub.banked);
    expect(next.areas.canal).toBe(session.areas.canal);
  });
});

describe('stranded axolotl rescue across trips (C1, C4 to C6, A11, A12)', () => {
  it('owns a rescued axolotl after banking it and going home (C4)', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    const { morph, sex } = rescueOf(trip);
    const ended = goHome(bankAtHome(reachRescue(trip))).state;
    const rec = tripEndRecord(ended, []);
    expect(rec.rescued).toEqual([{ morph, sex }]);
    expect(rec.banked).toEqual([]);
    expect(rec.waitingStranded).toBeNull();
    const after = recordTripEnd(withStarter(), rec);
    expect(after.hub.axolotls).toEqual([starterOf(), rescuedOf(morph, 'Bubbles', sex)]);
    expect(after.hub.book.foundMorphs).toContain(morph);
    expect(after.areas.canal.waitingStranded).toBeNull();
    expect(explorerId(after)).toBe(STARTER_AXOLOTL_ID);
    expectConsistent(after);
  });

  it('owns a rescued axolotl banked before being carried home (C4, A12)', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    const { morph, sex } = rescueOf(trip);
    const ended = carriedHomeFrom(keepExploring(bankAtHome(reachRescue(trip))));
    const rec = tripEndRecord(ended, []);
    expect(rec.rescued).toEqual([{ morph, sex }]);
    expect(rec.eatenSnacks).toEqual([]);
    expect(rec.waitingStranded).toBeNull();
    const after = recordTripEnd(withStarter(), rec);
    expect(after.hub.axolotls.map((axolotl) => axolotl.morph)).toEqual([STARTER_MORPH, morph]);
    expect(after.hub.axolotls[1].look).toEqual(rescuedLook(sex));
    expectConsistent(after);
  });

  it('leaves a following axolotl waiting at the same place when carried home, and brings it back there (C5)', () => {
    const session = withStarter();
    const trip = startRescueTrip(session, FIRST_SEED);
    const { morph, sex, placeId } = rescueOf(trip);
    const ended = carriedHomeFrom(reachRescue(trip));
    expect(ended.ending?.returned).toContain(axolotlFindId(morph));
    const rec = tripEndRecord(ended, []);
    expect(rec.rescued).toEqual([]);
    expect(rec.banked).toEqual([]);
    expect(rec.waitingStranded).toEqual({ morph, sex, placeId });
    const after = recordTripEnd(session, rec);
    expect(after.hub.axolotls).toEqual(session.hub.axolotls);
    expect(after.hub.book.foundMorphs).toEqual([STARTER_MORPH]);
    expect(after.areas.canal.waitingStranded).toEqual({ morph, sex, placeId });
    expectConsistent(after);

    const start = tripStart(after, 0);
    const again = pickStranding(start.ownedMorphs, start.waitingStranded, zone.strandingPlaces, start.tripSeed);
    expect(again).toMatchObject({ morph, sex, placeId, met: true });
    expect(rescueOf(startRescueTrip(after, 0))).toMatchObject({ morph, sex, placeId, met: true });
  });

  it('keeps a waiting axolotl waiting after a Go-home trip that did not reach it', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    const { morph, sex, placeId } = rescueOf(trip);
    const waiting = recordTripEnd(withStarter(), tripEndRecord(carriedHomeFrom(reachRescue(trip)), []));
    const next = startRescueTrip(waiting, 0);
    expect(next.inHomeSpot).toBe(true);
    const ended = goHome(next).state;
    expect(ended.ending?.reason).toBe('wentHome');
    const after = recordTripEnd(waiting, tripEndRecord(ended, []));
    expect(after.areas.canal.waitingStranded).toEqual({ morph, sex, placeId });
    expect(after.hub.axolotls).toEqual(waiting.hub.axolotls);
  });

  it('leaves nothing waiting after a trip that never met its stranded axolotl', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    expect(rescueOf(trip).met).toBe(false);
    const after = recordTripEnd(withStarter(), tripEndRecord(goHome(trip).state, []));
    expect(after.areas.canal.waitingStranded).toBeNull();
  });

  it('owns every morph after seven rescues, and no stranded axolotl appears after that (C6)', () => {
    let session = withStarter();
    for (let i = 0; i < REAL_MORPHS.length - 1; i++) {
      session = rescueAndGoHome(session, FIRST_SEED);
      expectConsistent(session);
    }
    expect(session.hub.axolotls).toHaveLength(REAL_MORPHS.length);
    expect(session.hub.axolotls[0]).toEqual(starterOf());
    expect(new Set(session.hub.axolotls.map((axolotl) => axolotl.name)).size).toBe(REAL_MORPHS.length);
    for (const axolotl of session.hub.axolotls.slice(1)) {
      expect(axolotl.look).toEqual(rescuedLook(axolotl.look.sex));
      expect(nameFits(axolotl.name, axolotl.look.sex)).toBe(true);
    }
    expect(new Set(session.hub.axolotls.map((axolotl) => axolotl.id)).size).toBe(REAL_MORPHS.length);
    expect(session.hub.book.foundMorphs).toEqual(REAL_MORPHS.map((morph) => morph.id));
    expect(session.hub.banked).toEqual([]);
    const start = tripStart(session, 0);
    expect(pickStranding(start.ownedMorphs, start.waitingStranded, zone.strandingPlaces, start.tripSeed)).toBeNull();
    expect(startRescueTrip(session, 0).rescue).toBeNull();
  });

  it('keeps treasure banking alongside a rescue, never banking the axolotl id', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    const find = openFind(trip);
    const ended = goHome(bankAtHome(reachRescue(stepAt(trip, find)))).state;
    const after = recordTripEnd(withStarter(), tripEndRecord(ended, []));
    expect(after.hub.banked).toEqual([find.id]);
    expect(after.hub.axolotls).toHaveLength(2);
    expectConsistent(after);
  });

  it('unlocks the tilapia card after a trip that met a tilapia, then starts trips with it seen', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    expect(trip.factCardsSeen).toEqual([]);
    const met = stepAt(trip, inRange);
    expect(met.met).toEqual(['tilapia']);
    expect(tripSnapshot(met).factCardDue).toBe('tilapia');
    const ended = goHome(stepAt(met, zone.start)).state;
    expect(ended.phase).toBe('ended');
    const rec = tripEndRecord(ended, []);
    expect(rec.met).toEqual(['tilapia']);
    expect(rec.met).not.toBe(ended.met);
    const after = recordTripEnd(withStarter(), rec);
    expect(after.hub.metHazards).toEqual(['tilapia']);
    expect(tripStart(after, 0).factCardsSeen).toEqual(['tilapia']);
    const next = startRescueTrip(after, 0);
    expect(next.factCardsSeen).toEqual(['tilapia']);
    expect(tripSnapshot(stepAt(next, inRange)).factCardDue).toBeNull();
  });
});

describe('area beaten (H5, H6, H7, A12, open question 14)', () => {
  it('records the banked finds, the stars earned in Area 1, no eaten snacks and the seed', () => {
    const { ended, id } = beatAfterBanking(startTrip(withStarter(), FIRST_SEED));
    const snacks = eatSnacks(restoreSnacks(zone.collectibles, []), 2);
    const rec = tripEndRecord(ended, snacks);
    expect(rec).toEqual({
      areaId: CANAL_AREA_ID,
      banked: [id],
      rescued: [],
      eatenSnacks: [],
      tripSeed: FIRST_SEED,
      waitingStranded: null,
      met: ended.met,
      returnedFinds: [],
      stars: { areaId: CANAL_AREA_ID, earned: ended.ending?.stars },
    });
    expect(rec.stars?.earned).not.toBe(ended.ending?.stars);
    expect(tripEndRecord(ended, snacks, 'other-area').stars?.areaId).toBe('other-area');
  });

  it('throws when an area-beaten ending has no stars', () => {
    const { ended } = beatAfterBanking(startTrip(withStarter(), FIRST_SEED));
    const ending = ended.ending as NonNullable<TripState['ending']>;
    const starless: TripState = { ...ended, ending: { ...ending, stars: undefined } };
    expect(() => tripEndRecord(starless, [])).toThrow(/no stars/);
  });

  it('clears eaten snacks and records the seed so the next trip reshuffles (B4)', () => {
    const snacks = eatSnacks(restoreSnacks(zone.collectibles, []), 3);
    const went = wentHome(startTrip(withStarter(), FIRST_SEED));
    const session = recordTripEnd(withStarter(), tripEndRecord(went.ended, snacks));
    expect(tripStart(session, 0).eatenSnacks.length).toBe(3);
    const second = startTrip(session, 0);
    const beaten = beatArea(second, SPECIAL).state;
    const after = recordTripEnd(session, tripEndRecord(beaten, restoreSnacks(zone.collectibles, session.areas.canal.eatenSnacks)));
    expect(tripStart(after, 0).eatenSnacks).toEqual([]);
    expect(after.areas.canal.lastTripSeed).toBe(second.tripSeed);
    expect(tripStart(after, 0).tripSeed).toBe(nextTripSeed(second.tripSeed));
    expect(startTrip(after, 0)).toEqual(newTrip(beaten));
  });

  it('merges stars so the best never goes down across replays', () => {
    const first = recordTripEnd(withStarter(), beatenRecord({ exit: true, special: true, legsOrRescue: false }, 1));
    expect(bestStars(first, CANAL_AREA_ID)).toEqual({ exit: true, special: true, legsOrRescue: false });
    const worse = recordTripEnd(first, beatenRecord({ exit: true, special: false, legsOrRescue: false }, 2));
    expect(bestStars(worse, CANAL_AREA_ID)).toEqual({ exit: true, special: true, legsOrRescue: false });
    const better = recordTripEnd(worse, beatenRecord({ exit: true, special: false, legsOrRescue: true }, 3));
    expect(bestStars(better, CANAL_AREA_ID)).toEqual({ exit: true, special: true, legsOrRescue: true });
    expect(first.hub.stars).toEqual({ [CANAL_AREA_ID]: { exit: true, special: true, legsOrRescue: false } });
  });

  it('has no stars for an area never beaten', () => {
    expect(bestStars(createSession(), CANAL_AREA_ID)).toEqual(NO_STARS);
  });

  it('leaves stars untouched after going home and after being carried home (A12)', () => {
    const starred = recordTripEnd(withStarter(), beatenRecord({ exit: true, special: false, legsOrRescue: true }, 1));
    const went = wentHome(startTrip(starred, 0));
    const wentRecord = tripEndRecord(went.ended, []);
    expect(wentRecord.stars).toBeUndefined();
    const afterWent = recordTripEnd(starred, wentRecord);
    expect(afterWent.hub.stars).toBe(starred.hub.stars);
    const lost = carriedHome(startTrip(afterWent, 0), [went.id]);
    const lostRecord = tripEndRecord(lost.ended, []);
    expect(lostRecord.stars).toBeUndefined();
    expect(recordTripEnd(afterWent, lostRecord).hub.stars).toBe(starred.hub.stars);
  });

  it('keeps the banked total rising by the bag size when the area is beaten with finds in the bag', () => {
    const trip = startTrip(withStarter(), FIRST_SEED);
    const find = openFind(trip);
    const holding = stepAt(trip, find);
    expect(holding.holdings.bag).toEqual([find.id]);
    const beaten = beatArea(holding, SPECIAL).state;
    const after = recordTripEnd(withStarter(), tripEndRecord(beaten, []));
    expect(after.hub.banked).toEqual([find.id]);
  });
});

describe('rescue at the exit (H5, H6, C4, C6)', () => {
  it('records a following axolotl banked at the exit as rescued, with star 3 and no snacks or waiting', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    const { morph, sex } = rescueOf(trip);
    const snacks = eatSnacks(restoreSnacks(zone.collectibles, []), 2);
    const ended = beatArea(reachRescue(trip), SPECIAL).state;
    expect(ended.ending?.reason).toBe('areaBeaten');
    const rec = tripEndRecord(ended, snacks);
    expect(rec.rescued).toEqual([{ morph, sex }]);
    expect(rec.banked.filter(isAxolotlFindId)).toEqual([]);
    expect(rec.waitingStranded).toBeNull();
    expect(rec.eatenSnacks).toEqual([]);
    expect(rec.stars?.earned.legsOrRescue).toBe(true);
  });

  it('owns the rescued axolotl and keeps star 3 even with a leg lost', () => {
    const trip = startRescueTrip(withStarter(), FIRST_SEED);
    const { morph, sex } = rescueOf(trip);
    const following = { ...reachRescue(trip), legsLost: 1 };
    const rec = tripEndRecord(beatArea(following, SPECIAL).state, []);
    const after = recordTripEnd(withStarter(), rec);
    expect(after.hub.axolotls).toEqual([starterOf(), rescuedOf(morph, 'Bubbles', sex)]);
    expect(after.hub.book.foundMorphs).toEqual(
      REAL_MORPHS.map((entry) => entry.id).filter((id) => id === STARTER_MORPH || id === morph),
    );
    expect(after.hub.banked.filter(isAxolotlFindId)).toEqual([]);
    expect(after.hub.stars[CANAL_AREA_ID]?.legsOrRescue).toBe(true);
    expect(after.areas.canal.waitingStranded).toBeNull();
    expectConsistent(after);
  });

  it('keeps a met but unreached stranded axolotl waiting after the area is beaten', () => {
    const first = startRescueTrip(withStarter(), FIRST_SEED);
    const { morph, sex, placeId } = rescueOf(first);
    const waiting = recordTripEnd(withStarter(), tripEndRecord(carriedHomeFrom(reachRescue(first)), []));
    const next = startRescueTrip(waiting, 0);
    expect(rescueOf(next)).toMatchObject({ morph, sex, placeId, met: true });
    const rec = tripEndRecord(beatArea(next, SPECIAL).state, []);
    expect(rec.rescued).toEqual([]);
    expect(rec.waitingStranded).toEqual({ morph, sex, placeId });
    const after = recordTripEnd(waiting, rec);
    expect(after.areas.canal.waitingStranded).toEqual({ morph, sex, placeId });
    expect(after.hub.axolotls).toEqual(waiting.hub.axolotls);
  });
});

describe('canRescueMore (C6)', () => {
  it('is true for a new session and false once every morph is owned', () => {
    expect(canRescueMore(withStarter())).toBe(true);
    let session = withStarter();
    for (let i = 0; i < REAL_MORPHS.length - 1; i++) {
      expect(canRescueMore(session)).toBe(true);
      session = rescueAndGoHome(session, FIRST_SEED);
    }
    expect(session.hub.axolotls).toHaveLength(REAL_MORPHS.length);
    expect(canRescueMore(session)).toBe(false);
  });
});

describe.each(REAL_MORPHS.map((morph) => morph.id))('starter %s: the other seven morphs are rescuable (C1, C2, C6, F5)', (starter) => {
  const others = REAL_MORPHS.map((morph) => morph.id).filter((id) => id !== starter);
  const SEED_COUNT = 200;

  it('owns only the starter, found in the Collection Book (C1)', () => {
    const session = withStarter('Gilly', starter);
    expect(session.hub.axolotls).toEqual([starterOf(starter)]);
    expect(session.hub.book.foundMorphs).toEqual([starter]);
  });

  it('never strands the starter morph, and strands each other morph over many seeds (C2, F5)', () => {
    const session = withStarter('Gilly', starter);
    const seen = new Set<RealMorphId>();
    for (let seed = 0; seed < SEED_COUNT; seed++) {
      const { morph } = rescueOf(startRescueTrip(session, seed));
      expect(morph).not.toBe(starter);
      seen.add(morph);
    }
    expect([...seen].sort()).toEqual([...others].sort());
  });

  it('rescues each other morph in seven trips, then strands no more (C2, C6)', () => {
    let session = withStarter('Gilly', starter);
    for (let cycle = 0; cycle < others.length; cycle++) {
      expect(canRescueMore(session)).toBe(true);
      const owned = session.hub.axolotls.map((axolotl) => axolotl.morph);
      const { morph } = rescueOf(startRescueTrip(session, FIRST_SEED + cycle));
      expect(morph).not.toBe(starter);
      expect(owned).not.toContain(morph);
      session = rescueAndGoHome(session, FIRST_SEED + cycle);
      expect(session.hub.axolotls.map((axolotl) => axolotl.morph)).toContain(morph);
      expectConsistent(session);
    }
    expect(session.hub.axolotls).toHaveLength(REAL_MORPHS.length);
    expect(new Set(session.hub.axolotls.map((axolotl) => axolotl.morph))).toEqual(new Set(REAL_MORPHS.map((morph) => morph.id)));
    expect(session.hub.book.foundMorphs).toEqual(REAL_MORPHS.map((morph) => morph.id));
    expect(canRescueMore(session)).toBe(false);
    for (let seed = 0; seed < SEED_COUNT; seed++) expect(startRescueTrip(session, seed).rescue).toBeNull();
  });
});

describe('needsStarter (F1)', () => {
  it('is true while no axolotl is owned and false once the starter is added', () => {
    expect(needsStarter(createSession())).toBe(true);
    expect(needsStarter(withStarter())).toBe(false);
  });
});

describe('addStarter (F1)', () => {
  it('adds the starter with the cleaned name and a copy of the look, leaving the input session alone', () => {
    const fresh = createSession();
    const look = { ...STYLED };
    const session = addStarter(fresh, { name: '  Mochi  ', look });
    expect(session.hub.axolotls).toEqual([
      { id: STARTER_AXOLOTL_ID, morph: STARTER_MORPH, name: 'Mochi', look: STYLED, dreamColour: null, outfit: emptyOutfit() },
    ]);
    expect(session.hub.axolotls[0].look).not.toBe(look);
    expect(session.hub.book).toEqual({ foundMorphs: [STARTER_MORPH] });
    expect(session.hub.banked).toBe(fresh.hub.banked);
    expect(session.hub.tank).toBe(fresh.hub.tank);
    expect(session.areas.canal).toBe(fresh.areas.canal);
    expect(fresh).toEqual(createSession());
  });

  it('clips a long name to NAME_MAX name characters', () => {
    const session = addStarter(createSession(), { name: 'Sprinklesprinkle', look: DEFAULT_LOOK });
    expect(nameLength(explorerAxolotl(session).name)).toBe(NAME_MAX);
  });

  it('copies only the look fields, keeping every one of them', () => {
    const look = { ...STYLED, morph: 'golden-albino' } as AxolotlLook;
    const session = addStarter(createSession(), { name: 'Gilly', look });
    expect(explorerAxolotl(session).look).toEqual(STYLED);
    for (const field of LOOK_FIELDS) expect(explorerAxolotl(session).look[field]).toBe(STYLED[field]);
    expect(explorerMorph(session)).toBe(STARTER_MORPH);
  });

  it('throws on a look without a sex', () => {
    const { sex: _sex, ...sexless } = STYLED;
    expect(_sex).toBe('girl');
    const look = sexless as unknown as AxolotlLook;
    expect(() => addStarter(createSession(), { name: 'Gilly', look })).toThrow(/invalid look/);
  });

  it('makes the chosen morph the starter, found in the Collection Book, which is the explorer (C1)', () => {
    const session = withStarter('Gilly', 'golden-albino');
    expect(session.hub.axolotls).toEqual([starterOf('golden-albino')]);
    expect(session.hub.book.foundMorphs).toEqual(['golden-albino']);
    expect(explorerId(session)).toBe(STARTER_AXOLOTL_ID);
    expect(explorerMorph(session)).toBe('golden-albino');
  });

  it('throws when the cleaned name is empty', () => {
    expect(() => addStarter(createSession(), { name: '', look: DEFAULT_LOOK })).toThrow(/invalid name/);
    expect(() => addStarter(createSession(), { name: '  !!  ', look: DEFAULT_LOOK })).toThrow(/invalid name/);
  });

  it('throws on an invalid look', () => {
    const look = { ...DEFAULT_LOOK, size: 'huge' } as unknown as AxolotlLook;
    expect(() => addStarter(createSession(), { name: 'Gilly', look })).toThrow(/invalid look/);
  });

  it('throws when an axolotl is already owned', () => {
    expect(() => addStarter(withStarter(), { name: 'Pebble', look: DEFAULT_LOOK })).toThrow(/already owned/);
  });
});

describe('restyleAxolotl (F6)', () => {
  it('replaces the name and the look, and leaves the input session and other axolotls alone', () => {
    const before = withStarter();
    const other = newOwnedAxolotl('rescued-wild', 'wild', before.hub.axolotls, 'girl');
    const session: Session = { ...before, hub: { ...before.hub, axolotls: [...before.hub.axolotls, other] } };
    const next = restyleAxolotl(session, STARTER_AXOLOTL_ID, { name: ' Noodle ', look: STYLED_BOY });
    expect(next.hub.axolotls).toEqual([{ ...starterOf(), name: 'Noodle', look: STYLED_BOY }, other]);
    expect(next.hub.axolotls[1]).toBe(other);
    expect(next.hub.banked).toBe(session.hub.banked);
    expect(next.areas.canal).toBe(session.areas.canal);
    expect(session.hub.axolotls[0]).toEqual(starterOf());
  });

  it('keeps every other field of the axolotl, such as its morph', () => {
    const session = withStarter('Gilly', 'golden-albino');
    const next = restyleAxolotl(session, STARTER_AXOLOTL_ID, { name: 'Noodle', look: STYLED_BOY });
    expect(next.hub.axolotls[0]).toEqual({
      id: STARTER_AXOLOTL_ID,
      morph: 'golden-albino',
      name: 'Noodle',
      look: STYLED_BOY,
      dreamColour: null,
      outfit: emptyOutfit(),
    });
    for (const field of LOOK_FIELDS) expect(next.hub.axolotls[0].look[field]).toBe(STYLED_BOY[field]);
    expect(next.hub.book).toBe(session.hub.book);
  });

  it('never changes the morph or the sex, whatever the style says', () => {
    const girl = addStarter(createSession(), { name: 'Gilly', look: STYLED }, 'golden-albino');
    const change = { name: 'Noodle', look: { ...DEFAULT_LOOK, sex: 'boy' }, morph: 'wild' } as AxolotlStyle;
    const next = restyleAxolotl(girl, STARTER_AXOLOTL_ID, change);
    expect(next.hub.axolotls[0].morph).toBe('golden-albino');
    expect(next.hub.axolotls[0].look).toEqual({ ...DEFAULT_LOOK, sex: 'girl' });
    const boy = restyleAxolotl(withStarter(), STARTER_AXOLOTL_ID, { name: 'Noodle', look: STYLED });
    expect(boy.hub.axolotls[0].morph).toBe(STARTER_MORPH);
    expect(boy.hub.axolotls[0].look).toEqual(STYLED_BOY);
  });

  it('never takes a field other than the name and the look from the change', () => {
    const change = { name: 'Noodle', look: STYLED_BOY, id: 'other', morph: 'wild' } as AxolotlStyle;
    const next = restyleAxolotl(withStarter(), STARTER_AXOLOTL_ID, change);
    expect(next.hub.axolotls[0]).toEqual({ ...starterOf(), name: 'Noodle', look: STYLED_BOY });
  });

  it('throws on an unknown id', () => {
    expect(() => restyleAxolotl(withStarter(), 'nobody', { name: 'Noodle', look: STYLED })).toThrow(/nobody/);
    expect(() => restyleAxolotl(createSession(), STARTER_AXOLOTL_ID, { name: 'Noodle', look: STYLED })).toThrow(
      /no owned axolotl/,
    );
  });

  it('throws on an invalid name or look', () => {
    const look = { ...STYLED, eyes: 'wink' } as unknown as AxolotlLook;
    expect(() => restyleAxolotl(withStarter(), STARTER_AXOLOTL_ID, { name: '***', look: STYLED })).toThrow(
      /invalid name/,
    );
    expect(() => restyleAxolotl(withStarter(), STARTER_AXOLOTL_ID, { name: 'Noodle', look })).toThrow(/invalid look/);
  });
});

/**
 * A session with the starter and a rescued wild axolotl, where the Mint and Galaxy Paint shells and
 * a pond plant are banked.
 */
function withDreams(): Session {
  const owned = recordTripEnd(withStarter(), {
    ...record([MINT_SHELL, PLANT, GALAXY_SHELL], 1),
    rescued: [{ morph: 'wild', sex: 'girl' }],
  });
  expect(owned.hub.axolotls.map((axolotl) => axolotl.id)).toEqual([STARTER_AXOLOTL_ID, axolotlFindId('wild')]);
  return owned;
}

describe('setDreamColour (F14)', () => {
  const WILD_ID = axolotlFindId('wild');

  it('puts an owned Dream colour on an axolotl and takes it off again', () => {
    const plain = withDreams();
    const painted = setDreamColour(plain, STARTER_AXOLOTL_ID, 'mint');
    expect(painted.hub.axolotls[0].dreamColour).toBe('mint');
    const off = setDreamColour(painted, STARTER_AXOLOTL_ID, null);
    expect(off.hub.axolotls[0].dreamColour).toBeNull();
    expect(off.hub.axolotls).toEqual(plain.hub.axolotls);
  });

  it('changes only the Dream colour of that axolotl', () => {
    const before = withDreams();
    const after = setDreamColour(before, WILD_ID, 'galaxy');
    expect(after.hub.axolotls[1]).toEqual({ ...before.hub.axolotls[1], dreamColour: 'galaxy' });
    expect({ ...after.hub.axolotls[1], dreamColour: before.hub.axolotls[1].dreamColour }).toEqual(before.hub.axolotls[1]);
    expect(after.hub.axolotls[1].morph).toBe('wild');
    expect(after.hub.axolotls[1].look).toBe(before.hub.axolotls[1].look);
    expect(after.hub.axolotls[0]).toBe(before.hub.axolotls[0]);
    expect(after.hub.book).toBe(before.hub.book);
    expect(after.hub.banked).toBe(before.hub.banked);
    expect(after.hub.stars).toBe(before.hub.stars);
    expect(after.hub.tank).toBe(before.hub.tank);
    expect(after.areas.canal).toBe(before.areas.canal);
  });

  it('puts the same colour on two axolotls at once', () => {
    const both = setDreamColour(setDreamColour(withDreams(), STARTER_AXOLOTL_ID, 'mint'), WILD_ID, 'mint');
    expect(both.hub.axolotls.map((axolotl) => axolotl.dreamColour)).toEqual(['mint', 'mint']);
  });

  it('never takes a colour off another axolotl when putting one on', () => {
    const first = setDreamColour(withDreams(), STARTER_AXOLOTL_ID, 'mint');
    const second = setDreamColour(first, WILD_ID, 'galaxy');
    expect(second.hub.axolotls[0]).toBe(first.hub.axolotls[0]);
    expect(second.hub.axolotls.map((axolotl) => axolotl.dreamColour)).toEqual(['mint', 'galaxy']);
  });

  it('replaces the colour an axolotl wore, so it wears at most one', () => {
    const mint = setDreamColour(withDreams(), STARTER_AXOLOTL_ID, 'mint');
    const galaxy = setDreamColour(mint, STARTER_AXOLOTL_ID, 'galaxy');
    expect(galaxy.hub.axolotls[0].dreamColour).toBe('galaxy');
  });

  it('throws when the Dream colour is not owned', () => {
    expect(() => setDreamColour(withDreams(), STARTER_AXOLOTL_ID, 'rainbow')).toThrow(/not owned/);
    expect(() => setDreamColour(withStarter(), STARTER_AXOLOTL_ID, 'mint')).toThrow(/not owned/);
    const plaid = 'plaid' as DreamColourId;
    expect(() => setDreamColour(withDreams(), STARTER_AXOLOTL_ID, plaid)).toThrow(/not owned/);
  });

  it('takes a colour off even with no Paint shell banked', () => {
    expect(setDreamColour(withStarter(), STARTER_AXOLOTL_ID, null).hub.axolotls).toEqual([starterOf()]);
  });

  it('throws on an unknown axolotl id', () => {
    expect(() => setDreamColour(withDreams(), 'nobody', 'mint')).toThrow(/no owned axolotl/);
    expect(() => setDreamColour(createSession(), STARTER_AXOLOTL_ID, null)).toThrow(/no owned axolotl/);
  });

  it('leaves the input session alone', () => {
    const before = withDreams();
    const copy = JSON.parse(JSON.stringify(before)) as Session;
    setDreamColour(before, STARTER_AXOLOTL_ID, 'galaxy');
    expect(before).toEqual(copy);
    expect(before.hub.axolotls[0].dreamColour).toBeNull();
  });

  it('is kept by restyleAxolotl and recordTripEnd, and rescued axolotls start with none', () => {
    const painted = setDreamColour(withDreams(), STARTER_AXOLOTL_ID, 'galaxy');
    const restyled = restyleAxolotl(painted, STARTER_AXOLOTL_ID, { name: 'Noodle', look: STYLED_BOY });
    expect(restyled.hub.axolotls[0].dreamColour).toBe('galaxy');
    const later = recordTripEnd(restyled, { ...record([HAT], 2), rescued: [{ morph: 'melanoid', sex: 'boy' }] });
    expect(later.hub.axolotls.map((axolotl) => axolotl.dreamColour)).toEqual(['galaxy', null, null]);
  });

  it('survives a JSON round trip', () => {
    const painted = setDreamColour(withDreams(), WILD_ID, 'mint');
    expect(JSON.parse(JSON.stringify(painted))).toEqual(painted);
  });
});

describe('newOwnedAxolotl', () => {
  it.each<AxolotlSex>(['boy', 'girl'])(
    'takes its morph, the first %s name no owned axolotl uses, ignoring case, and the rescued look',
    (sex) => {
      const owned = withStarter('bubbles').hub.axolotls;
      const rescued = newOwnedAxolotl('rescued-wild', 'wild', owned, sex);
      expect(rescued).toEqual({
        id: 'rescued-wild',
        morph: 'wild',
        name: suggestedNamesFor(sex)[1],
        look: rescuedLook(sex),
        dreamColour: null,
        outfit: emptyOutfit(),
      });
      expect(rescued.look.sex).toBe(sex);
      expect(nameFits(rescued.name, sex)).toBe(true);
      expect(rescued.look).not.toBe(DEFAULT_LOOK);
      expect(Object.isFrozen(rescued.look)).toBe(false);
    },
  );

  it('takes the first suggested name for its sex when nothing is owned', () => {
    expect(newOwnedAxolotl('rescued-wild', 'wild', [], 'boy').name).toBe(suggestedNamesFor('boy')[0]);
    expect(newOwnedAxolotl('rescued-wild', 'wild', [], 'girl').name).toBe(suggestedNamesFor('girl')[0]);
  });

  it('skips every name fitting its sex that is taken, never picking one that does not fit', () => {
    for (const sex of ['boy', 'girl'] as const) {
      const fitting = suggestedNamesFor(sex);
      const taken = fitting.slice(0, -1);
      const owned = taken.map((name, index) => ({ ...starterOf(), id: `owned-${index}`, name }));
      const rescued = newOwnedAxolotl('rescued-wild', 'wild', owned, sex);
      expect(rescued.name).toBe(fitting[fitting.length - 1]);
      expect(nameFits(rescued.name, sex)).toBe(true);
    }
  });
});

describe('explorerAxolotl, explorerId and explorerMorph', () => {
  it('is the only owned axolotl', () => {
    const session = withStarter();
    expect(explorerAxolotl(session)).toBe(session.hub.axolotls[0]);
    expect(explorerId(session)).toBe(STARTER_AXOLOTL_ID);
    expect(explorerMorph(session)).toBe(STARTER_MORPH);
  });

  it('is the first owned axolotl when more are owned', () => {
    const before = withStarter();
    const rescued = newOwnedAxolotl('rescued-wild', 'wild', before.hub.axolotls, 'boy');
    const session: Session = { ...before, hub: { ...before.hub, axolotls: [...before.hub.axolotls, rescued] } };
    expect(explorerAxolotl(session).id).toBe(STARTER_AXOLOTL_ID);
    expect(explorerId(session)).toBe(STARTER_AXOLOTL_ID);
    expect(explorerMorph(session)).toBe(STARTER_MORPH);
  });

  it('throws when no axolotl is owned', () => {
    expect(() => explorerAxolotl(createSession())).toThrow(/explorerAxolotl: no axolotl/);
    expect(() => explorerId(createSession())).toThrow(/explorerId: no axolotl/);
    expect(() => explorerMorph(createSession())).toThrow(/explorerMorph: no axolotl/);
  });
});

const WEARABLES = CANAL_TREASURES.filter((treasure): treasure is Wearable => treasure.category === 'wearable');
const SUN_HAT = 'canal/sun-hat';
const FLIPPERS = 'canal/flippers';

/** An outfit with the canal Wearable for each slot on. */
function fullOutfit(): Outfit {
  const outfit = emptyOutfit();
  for (const wearable of WEARABLES) outfit[wearable.slot] = wearable.id;
  return outfit;
}

/**
 * A session with the starter and a rescued wild axolotl, where every canal Wearable, the Mint Paint
 * shell and a pond plant are banked.
 */
function withWearables(): Session {
  const banked = [...WEARABLES.map((wearable) => wearable.id), MINT_SHELL, PLANT];
  return recordTripEnd(withStarter(), { ...record(banked, 1), rescued: [{ morph: 'wild', sex: 'girl' }] });
}

/** Expects `after` to differ from `before` only in its axolotls' outfits. */
function expectOnlyOutfitsChanged(before: Session, after: Session): void {
  const unchanged = (session: Session) => session.hub.axolotls.map((axolotl) => ({ ...axolotl, outfit: null }));
  expect(unchanged(after)).toEqual(unchanged(before));
  expect(after.hub.book).toBe(before.hub.book);
  expect(after.hub.banked).toBe(before.hub.banked);
  expect(after.hub.tank).toBe(before.hub.tank);
  expect(after.hub.stars).toBe(before.hub.stars);
  expect(after.hub.explorerId).toBe(before.hub.explorerId);
  expect(after.areas.canal).toBe(before.areas.canal);
}

describe('setOutfit, wearOn and takeOffFrom (C10, F8)', () => {
  const WILD_ID = axolotlFindId('wild');

  it('puts a Wearable in every slot of one axolotl, the others untouched', () => {
    const before = withWearables();
    const after = setOutfit(before, WILD_ID, fullOutfit());
    expect(WEARABLE_SLOTS).toHaveLength(8);
    for (const slot of WEARABLE_SLOTS) expect(after.hub.axolotls[1].outfit[slot]).toBe(fullOutfit()[slot]);
    expect(after.hub.axolotls[0]).toBe(before.hub.axolotls[0]);
    expectOnlyOutfitsChanged(before, after);
  });

  it('takes a Wearable off another axolotl when it is put on', () => {
    const hatted = wearOn(withWearables(), STARTER_AXOLOTL_ID, SUN_HAT);
    expect(hatted.hub.axolotls[0].outfit.head).toBe(SUN_HAT);
    const moved = setOutfit(hatted, WILD_ID, { ...emptyOutfit(), head: SUN_HAT });
    expect(moved.hub.axolotls.map((axolotl) => axolotl.outfit.head)).toEqual([null, SUN_HAT]);
    const back = wearOn(moved, STARTER_AXOLOTL_ID, SUN_HAT);
    expect(back.hub.axolotls.map((axolotl) => axolotl.outfit.head)).toEqual([SUN_HAT, null]);
  });

  it('never changes a look, morph, name, Dream colour, the Collection Book or anything but outfits', () => {
    const before = setDreamColour(withWearables(), WILD_ID, 'mint');
    const dressed = setOutfit(before, WILD_ID, fullOutfit());
    expectOnlyOutfitsChanged(before, dressed);
    const worn = wearOn(dressed, STARTER_AXOLOTL_ID, FLIPPERS);
    expectOnlyOutfitsChanged(dressed, worn);
    const bare = takeOffFrom(worn, STARTER_AXOLOTL_ID, 'feet');
    expectOnlyOutfitsChanged(worn, bare);
    expect(bare.hub.axolotls[1].dreamColour).toBe('mint');
  });

  it('takes a Wearable off into the Treasure Chest, keeping the other slots', () => {
    const dressed = setOutfit(withWearables(), WILD_ID, fullOutfit());
    const after = takeOffFrom(dressed, WILD_ID, 'head');
    expect(after.hub.axolotls[1].outfit).toEqual({ ...fullOutfit(), head: null });
    expect(after.hub.banked).toContain(SUN_HAT);
  });

  it('leaves the input session alone', () => {
    const before = withWearables();
    const copy = JSON.parse(JSON.stringify(before)) as Session;
    setOutfit(before, WILD_ID, fullOutfit());
    wearOn(before, STARTER_AXOLOTL_ID, SUN_HAT);
    takeOffFrom(before, STARTER_AXOLOTL_ID, 'head');
    expect(before).toEqual(copy);
  });

  it('throws on an unknown axolotl, an unbanked, unknown or non-Wearable id, or a wrong slot', () => {
    const session = withWearables();
    expect(() => setOutfit(session, 'nobody', emptyOutfit())).toThrow(/no owned axolotl has id nobody/);
    expect(() => setOutfit(withStarter(), STARTER_AXOLOTL_ID, { ...emptyOutfit(), head: SUN_HAT })).toThrow(
      /not banked/,
    );
    expect(() => setOutfit(session, WILD_ID, { ...emptyOutfit(), head: 'canal/top-hat' })).toThrow(/unknown treasure/);
    expect(() => setOutfit(session, WILD_ID, { ...emptyOutfit(), head: PLANT })).toThrow(/not a Wearable/);
    expect(() => setOutfit(session, WILD_ID, { ...emptyOutfit(), feet: SUN_HAT })).toThrow(/does not fit slot feet/);
    expect(() => wearOn(session, 'nobody', SUN_HAT)).toThrow(/no owned axolotl/);
    expect(() => wearOn(withStarter(), STARTER_AXOLOTL_ID, SUN_HAT)).toThrow(/not banked/);
    expect(() => takeOffFrom(session, 'nobody', 'head')).toThrow(/no owned axolotl/);
  });

  it('starts every starter and rescued axolotl with an empty outfit', () => {
    for (const axolotl of withWearables().hub.axolotls) expect(axolotl.outfit).toEqual(emptyOutfit());
  });

  it('is kept by restyleAxolotl, setDreamColour and recordTripEnd, with the explorer', () => {
    const dressed = chooseExplorer(setOutfit(withWearables(), WILD_ID, fullOutfit()), WILD_ID);
    const restyled = restyleAxolotl(dressed, WILD_ID, { name: 'Noodle', look: STYLED });
    const painted = setDreamColour(restyled, WILD_ID, 'mint');
    const later = recordTripEnd(painted, { ...record([BOAT], 2), rescued: [{ morph: 'melanoid', sex: 'boy' }] });
    for (const session of [restyled, painted, later]) {
      expect(session.hub.axolotls[1].outfit).toEqual(fullOutfit());
      expect(session.hub.explorerId).toBe(WILD_ID);
    }
    expect(later.hub.axolotls[2].outfit).toEqual(emptyOutfit());
  });

  it('survives a JSON round trip', () => {
    const dressed = setOutfit(withWearables(), WILD_ID, fullOutfit());
    expect(JSON.parse(JSON.stringify(dressed))).toEqual(dressed);
  });
});

describe('chooseExplorer (F7)', () => {
  const WILD_ID = axolotlFindId('wild');

  it('makes the starter the explorer when it is added', () => {
    expect(createSession().hub.explorerId).toBeNull();
    expect(withStarter().hub.explorerId).toBe(STARTER_AXOLOTL_ID);
  });

  it('remembers the chosen explorer, which explorerAxolotl, explorerId and explorerMorph return', () => {
    const before = withWearables();
    const after = chooseExplorer(before, WILD_ID);
    expect(after.hub.explorerId).toBe(WILD_ID);
    expect(explorerAxolotl(after)).toBe(after.hub.axolotls[1]);
    expect(explorerId(after)).toBe(WILD_ID);
    expect(explorerMorph(after)).toBe('wild');
    expect(after.hub.axolotls).toBe(before.hub.axolotls);
    expect({ ...after.hub, explorerId: before.hub.explorerId }).toEqual(before.hub);
    expect(after.areas.canal).toBe(before.areas.canal);
    expect(chooseExplorer(after, STARTER_AXOLOTL_ID).hub.explorerId).toBe(STARTER_AXOLOTL_ID);
  });

  it('throws on an unknown id', () => {
    expect(() => chooseExplorer(withWearables(), 'nobody')).toThrow(/chooseExplorer: no owned axolotl has id nobody/);
    expect(() => chooseExplorer(createSession(), STARTER_AXOLOTL_ID)).toThrow(/no owned axolotl/);
  });

  it.each([
    ['none is remembered', null],
    ['the remembered one is not owned', axolotlFindId('copper')],
  ])('falls back to the first owned axolotl when %s', (_label, remembered) => {
    const before = withWearables();
    const session: Session = { ...before, hub: { ...before.hub, explorerId: remembered } };
    expect(explorerAxolotl(session)).toBe(session.hub.axolotls[0]);
    expect(explorerId(session)).toBe(STARTER_AXOLOTL_ID);
    expect(explorerMorph(session)).toBe(STARTER_MORPH);
  });
});

describe('markDashPotTipSeen (B11, D2)', () => {
  it('marks the tip seen, keeps every other field and leaves the input session alone', () => {
    const before = withStarter();
    const copy = JSON.parse(JSON.stringify(before)) as Session;
    const after = markDashPotTipSeen(before);
    expect(after.hub.dashPotTipSeen).toBe(true);
    expect({ ...after.hub, dashPotTipSeen: false }).toEqual(before.hub);
    expect(after.areas).toBe(before.areas);
    expect(before).toEqual(copy);
  });

  it('returns the same session when the tip was already seen', () => {
    const seen = markDashPotTipSeen(withStarter());
    expect(markDashPotTipSeen(seen)).toBe(seen);
  });
});

describe('markFirstFindSeen (C15, D2)', () => {
  it('adds a kind once', () => {
    const once = markFirstFindSeen(withStarter(), 'wearable');
    expect(once.hub.firstFindsSeen).toEqual(['wearable']);
    expect(markFirstFindSeen(once, 'wearable').hub.firstFindsSeen).toEqual(['wearable']);
  });

  it('keeps the kinds in FIRST_FIND_KINDS order, whatever order they are seen in', () => {
    const paint = markFirstFindSeen(withStarter(), 'paintShell');
    const both = markFirstFindSeen(paint, 'decoration');
    expect(both.hub.firstFindsSeen).toEqual(['decoration', 'paintShell']);
    expect(markFirstFindSeen(both, 'wearable').hub.firstFindsSeen).toEqual(['decoration', 'wearable', 'paintShell']);
  });

  it('keeps every other field and leaves the input session alone', () => {
    const before = recordTripEnd(withStarter(), record([PLANT, MINT_SHELL], 3, ['snack-1']));
    const copy = JSON.parse(JSON.stringify(before)) as Session;
    const after = markFirstFindSeen(before, 'paintShell');
    expect({ ...after.hub, firstFindsSeen: before.hub.firstFindsSeen }).toEqual(before.hub);
    expect(after.hub.axolotls).toBe(before.hub.axolotls);
    expect(after.areas.canal).toBe(before.areas.canal);
    expect(before).toEqual(copy);
  });

  it('starts a fresh session, as after Start over, with none seen and no card due until a Paint shell is banked', () => {
    const fresh = withStarter();
    expect(fresh.hub.firstFindsSeen).toEqual([]);
    expect(dueFirstFindCards(fresh.hub.banked, fresh.hub.firstFindsSeen)).toEqual([]);
    const banked = recordTripEnd(fresh, record([MINT_SHELL], 1));
    expect(dueFirstFindCards(banked.hub.banked, banked.hub.firstFindsSeen)).toEqual([
      { kind: 'paintShell', pictureId: MINT_SHELL },
    ]);
  });
});

describe('refuge fact cards (#74, C14)', () => {
  it('orders known ids with the threat cards first, then the refuge cards, dropping unknown ids', () => {
    expect(orderedMetHazards(['canal-clean-ups', 'heron', 'moon', 3, 'axolotl-refuges', 'tilapia', 'heron'])).toEqual([
      'tilapia',
      'heron',
      'axolotl-refuges',
      'canal-clean-ups',
    ]);
  });

  it('keeps the ghost net, after the heron and before the refuge cards', () => {
    expect(orderedMetHazards(['axolotl-refuges', 'ghost-net', 'net', 'heron', 'ghost-net'])).toEqual(['heron', 'ghost-net', 'axolotl-refuges']);
  });

  it('finds a refuge card once, in bookFactCards order', () => {
    const cleanUps = markFactCardFound(withStarter(), 'canal-clean-ups');
    expect(cleanUps.hub.metHazards).toEqual(['canal-clean-ups']);
    const both = markFactCardFound(cleanUps, 'axolotl-refuges');
    expect(both.hub.metHazards).toEqual(['axolotl-refuges', 'canal-clean-ups']);
    const met = recordTripEnd(withStarter(), { ...record([], 1), met: ['heron', 'tilapia'] });
    expect(markFactCardFound(met, 'axolotl-refuges').hub.metHazards).toEqual(['tilapia', 'heron', 'axolotl-refuges']);
  });

  it('changes nothing for a card already found or an unknown id', () => {
    const found = markFactCardFound(withStarter(), 'axolotl-refuges');
    expect(markFactCardFound(found, 'axolotl-refuges')).toBe(found);
    expect(markFactCardFound(found, 'moon')).toBe(found);
    expect(markFactCardFound(found, 'boyOrGirl')).toBe(found);
  });

  it('keeps every other field and leaves the input session alone', () => {
    const before = recordTripEnd(withStarter(), record([PLANT, MINT_SHELL], 3, ['snack-1']));
    const copy = JSON.parse(JSON.stringify(before)) as Session;
    const after = markFactCardFound(before, 'axolotl-refuges');
    expect({ ...after.hub, metHazards: before.hub.metHazards }).toEqual(before.hub);
    expect(after.hub.axolotls).toBe(before.hub.axolotls);
    expect(after.areas).toBe(before.areas);
    expect(before).toEqual(copy);
  });

  it('keeps refuge cards found across trip ends and adds only the ids met on the trip', () => {
    const found = markFactCardFound(markFactCardFound(withStarter(), 'canal-clean-ups'), 'axolotl-refuges');
    const quiet = recordTripEnd(found, record([], 1));
    expect(quiet.hub.metHazards).toEqual(['axolotl-refuges', 'canal-clean-ups']);
    const met = recordTripEnd(quiet, { ...record([], 2), areaId: POND_2_AREA.id, met: ['heron', 'plastic-worm'] });
    expect(met.hub.metHazards).toEqual(['plastic-worm', 'heron', 'axolotl-refuges', 'canal-clean-ups']);
  });

  it('still counts the threat cards met as seen at trip start, with refuge cards found alongside', () => {
    const met = recordTripEnd(withStarter(), { ...record([], 1), met: ['tilapia'] });
    const found = markFactCardFound(met, 'axolotl-refuges');
    const start = tripStart(found, 0);
    expect(start.factCardsSeen).toEqual(['tilapia', 'axolotl-refuges']);
    expect(start.factCardsSeen).not.toBe(found.hub.metHazards);
    expect(tripStart(markFactCardFound(withStarter(), 'axolotl-refuges'), 0).factCardsSeen).not.toContain('tilapia');
  });
});

describe('per-area memory (#73)', () => {
  const DEV_ID = DEV_TEST_AREA.id;
  const waiting = { morph: 'wild' as const, sex: 'girl' as const, placeId: 'p' };

  it('reads empty memory for an area with none stored, such as a dev area', () => {
    expect(areaMemory(withStarter(), DEV_ID)).toEqual({
      eatenSnacks: [],
      lastTripSeed: null,
      waitingStranded: null,
      returnedFinds: [],
    });
    expect(tripStart(withStarter(), FIRST_SEED, DEV_ID).tripSeed).toBe(FIRST_SEED);
  });

  it('stores a trip under its own area, leaving every other area alone', () => {
    const canalTrip = recordTripEnd(withStarter(), {
      ...record([PLANT], 5, ['snack-1']),
      waitingStranded: waiting,
      returnedFinds: [BOAT],
    });
    const devTrip = recordTripEnd(canalTrip, { ...record([HAT], 9, ['snack-2']), areaId: DEV_ID });
    expect(devTrip.areas.canal).toBe(canalTrip.areas.canal);
    expect(areaMemory(devTrip, DEV_ID)).toEqual({
      eatenSnacks: ['snack-2'],
      lastTripSeed: 9,
      waitingStranded: null,
      returnedFinds: [],
    });
    expect(tripStart(devTrip, 0, CANAL_AREA_ID)).toMatchObject({
      eatenSnacks: ['snack-1'],
      tripSeed: nextTripSeed(5),
      waitingStranded: waiting,
      returnedFinds: [BOAT],
    });
    expect(tripStart(devTrip, 0, DEV_ID)).toMatchObject({
      eatenSnacks: ['snack-2'],
      tripSeed: nextTripSeed(9),
      waitingStranded: null,
      returnedFinds: [],
    });
    expect(devTrip.hub.banked).toEqual([PLANT, HAT]);
  });

  it('records the area id in a trip end record', () => {
    const ended = wentHome(startTrip(withStarter(), FIRST_SEED)).ended;
    expect(tripEndRecord(ended, []).areaId).toBe(CANAL_AREA_ID);
    expect(tripEndRecord(ended, [], DEV_ID).areaId).toBe(DEV_ID);
  });

  it('keeps a pond trip in the pond memory, apart from the canal', () => {
    const canalTrip = recordTripEnd(withStarter(), { ...record([PLANT], 5, ['snack-1']), returnedFinds: [BOAT] });
    const pondTrip = recordTripEnd(canalTrip, {
      ...record([LILY_PAD], 11, ['pond/snack-3']),
      areaId: POND_ID,
      waitingStranded: waiting,
    });
    expect(pondTrip.areas.canal).toBe(canalTrip.areas.canal);
    expect(areaMemory(pondTrip, POND_ID)).toEqual({
      eatenSnacks: ['pond/snack-3'],
      lastTripSeed: 11,
      waitingStranded: waiting,
      returnedFinds: [],
    });
    expect(tripStart(pondTrip, 0, POND_ID)).toMatchObject({
      eatenSnacks: ['pond/snack-3'],
      tripSeed: nextTripSeed(11),
      waitingStranded: waiting,
      returnedFinds: [],
    });
    expect(tripStart(pondTrip, 0, CANAL_AREA_ID)).toMatchObject({ eatenSnacks: ['snack-1'], returnedFinds: [BOAT] });
    expect(pondTrip.hub.banked).toEqual([PLANT, LILY_PAD]);
  });

  it('keeps the plastic worm met in the pond after the tilapia, in area-table order', () => {
    const pondFirst = recordTripEnd(withStarter(), { ...record([], 1), areaId: POND_ID, met: ['plastic-worm'] });
    expect(pondFirst.hub.metHazards).toEqual(['plastic-worm']);
    const both = recordTripEnd(pondFirst, { ...record([], 2), met: ['tilapia'] });
    expect(both.hub.metHazards).toEqual(['tilapia', 'plastic-worm']);
    expect(tripStart(both, 0, CANAL_AREA_ID).factCardsSeen).toEqual(['tilapia', 'plastic-worm']);
  });

  it('keeps the heron met in Area 3 after the tilapia and the plastic worm, in area-table order', () => {
    const heronFirst = recordTripEnd(withStarter(), { ...record([], 1), areaId: POND_2_ID, met: ['heron'] });
    expect(heronFirst.hub.metHazards).toEqual(['heron']);
    const withTilapia = recordTripEnd(heronFirst, { ...record([], 2), met: ['tilapia'] });
    expect(withTilapia.hub.metHazards).toEqual(['tilapia', 'heron']);
    const all = recordTripEnd(withTilapia, { ...record([], 3), areaId: POND_ID, met: ['plastic-worm'] });
    expect(all.hub.metHazards).toEqual(['tilapia', 'plastic-worm', 'heron']);
    expect(tripStart(all, 0, POND_2_ID).factCardsSeen).toEqual(['tilapia', 'plastic-worm', 'heron']);
  });

  it('keeps the ghost net met in Area 4 after the heron, in area-table order', () => {
    const netFirst = recordTripEnd(withStarter(), { ...record([], 1), areaId: CHINAMPA_ID, met: ['ghost-net', 'tilapia'] });
    expect(netFirst.hub.metHazards).toEqual(['tilapia', 'ghost-net']);
    const withHeron = recordTripEnd(netFirst, { ...record([], 2), areaId: POND_2_ID, met: ['heron', 'plastic-worm'] });
    expect(withHeron.hub.metHazards).toEqual(['tilapia', 'plastic-worm', 'heron', 'ghost-net']);
    expect(tripStart(withHeron, 0, CHINAMPA_ID).factCardsSeen).toEqual(['tilapia', 'plastic-worm', 'heron', 'ghost-net']);
  });

  it('keeps the garter snake and the water hyacinth met in Area 5 after the ghost net, in area-table order', () => {
    const area5First = recordTripEnd(withStarter(), {
      ...record([], 1),
      areaId: CHINAMPA_2_ID,
      met: ['water-hyacinth', 'garter-snake', 'tilapia'],
    });
    expect(area5First.hub.metHazards).toEqual(['tilapia', 'garter-snake', 'water-hyacinth']);
    const withNet = recordTripEnd(area5First, { ...record([], 2), areaId: CHINAMPA_ID, met: ['ghost-net'] });
    expect(withNet.hub.metHazards).toEqual(['tilapia', 'ghost-net', 'garter-snake', 'water-hyacinth']);
    expect(tripStart(withNet, 0, CHINAMPA_2_ID).factCardsSeen).toEqual(['tilapia', 'ghost-net', 'garter-snake', 'water-hyacinth']);
  });

  it('keeps the crayfish met in Area 6 after the Area 5 cards, in area-table order', () => {
    const area6First = recordTripEnd(withStarter(), {
      ...record([], 1),
      areaId: SPRING_CAVE_ID,
      met: ['crayfish', 'tilapia'],
    });
    expect(area6First.hub.metHazards).toEqual(['tilapia', 'crayfish']);
    const withArea5 = recordTripEnd(area6First, { ...record([], 2), areaId: CHINAMPA_2_ID, met: ['water-hyacinth', 'garter-snake'] });
    expect(withArea5.hub.metHazards).toEqual(['tilapia', 'garter-snake', 'water-hyacinth', 'crayfish']);
    expect(tripStart(withArea5, 0, SPRING_CAVE_ID).factCardsSeen).toEqual(['tilapia', 'garter-snake', 'water-hyacinth', 'crayfish']);
  });

  it('keeps an Area 4 trip in its own memory, apart from Area 3', () => {
    const pond2Trip = recordTripEnd(withStarter(), { ...record([], 13, ['pond-2/snack-1']), areaId: POND_2_ID });
    const chinampaTrip = recordTripEnd(pond2Trip, { ...record([], 17, ['snack-4']), areaId: CHINAMPA_ID });
    expect(chinampaTrip.areas[POND_2_ID]).toBe(pond2Trip.areas[POND_2_ID]);
    expect(areaMemory(chinampaTrip, CHINAMPA_ID)).toEqual({
      eatenSnacks: ['snack-4'],
      lastTripSeed: 17,
      waitingStranded: null,
      returnedFinds: [],
    });
  });

  it('keeps an Area 3 trip in its own memory, apart from the pond', () => {
    const pondTrip = recordTripEnd(withStarter(), { ...record([LILY_PAD], 11, ['pond/snack-3']), areaId: POND_ID });
    const pond2Trip = recordTripEnd(pondTrip, { ...record([], 13, ['pond-2/snack-1']), areaId: POND_2_ID });
    expect(pond2Trip.areas[POND_ID]).toBe(pondTrip.areas[POND_ID]);
    expect(areaMemory(pond2Trip, POND_2_ID)).toEqual({
      eatenSnacks: ['pond-2/snack-1'],
      lastTripSeed: 13,
      waitingStranded: null,
      returnedFinds: [],
    });
  });

  it('counts the tilapia card seen in every area once a tilapia was met in any', () => {
    const met = recordTripEnd(withStarter(), { ...record([], 1), areaId: DEV_ID, met: ['tilapia'] });
    expect(met.hub.metHazards).toEqual(['tilapia']);
    expect(tripStart(met, 0, CANAL_AREA_ID).factCardsSeen).toEqual(['tilapia']);
  });
});

describe('chooseArea (#73)', () => {
  const TWO_AREAS = [CANAL_AREA, DEV_TEST_AREA];

  it('sets the last chosen area and nothing else', () => {
    const session = withStarter();
    const chosen = chooseArea(session, CANAL_AREA_ID);
    expect(chosen.hub.lastAreaId).toBe(CANAL_AREA_ID);
    expect(chosen.areas).toBe(session.areas);
    expect({ ...chosen.hub, lastAreaId: session.hub.lastAreaId }).toEqual(session.hub);
  });

  it('throws for an unknown area', () => {
    expect(() => chooseArea(withStarter(), 'moon')).toThrow(/no area has id moon/);
    expect(() => chooseArea(withStarter(), DEV_TEST_AREA.id)).toThrow(/no area has id/);
  });

  it('keeps the pond locked until the canal is beaten', () => {
    const session = withStarter();
    expect(() => chooseArea(session, POND_ID)).toThrow(/area pond-1 is locked/);
    const unbeaten = recordTripEnd(session, beatenRecord({ exit: false, special: true, legsOrRescue: true }, 1));
    expect(() => chooseArea(unbeaten, POND_ID)).toThrow(/locked/);
    const beaten = recordTripEnd(session, beatenRecord({ exit: true, special: false, legsOrRescue: false }, 1));
    const chosen = chooseArea(beaten, POND_ID);
    expect(chosen.hub.lastAreaId).toBe(POND_ID);
    expect(chooseArea(chosen, CANAL_AREA_ID).hub.lastAreaId).toBe(CANAL_AREA_ID);
  });

  it('keeps Area 3 locked until the pond is beaten', () => {
    const canalBeaten = recordTripEnd(withStarter(), beatenRecord({ exit: true, special: false, legsOrRescue: false }, 1));
    expect(() => chooseArea(canalBeaten, POND_2_ID)).toThrow(/area pond-2 is locked/);
    const pondBeaten = recordTripEnd(canalBeaten, {
      ...record([], 2),
      areaId: POND_ID,
      stars: { areaId: POND_ID, earned: { exit: true, special: false, legsOrRescue: false } },
    });
    expect(chooseArea(pondBeaten, POND_2_ID).hub.lastAreaId).toBe(POND_2_ID);
  });

  it('keeps Area 4 locked until Area 3 is beaten', () => {
    const canalBeaten = recordTripEnd(withStarter(), beatenRecord({ exit: true, special: false, legsOrRescue: false }, 1));
    const pondBeaten = recordTripEnd(canalBeaten, {
      ...record([], 2),
      areaId: POND_ID,
      stars: { areaId: POND_ID, earned: { exit: true, special: false, legsOrRescue: false } },
    });
    expect(() => chooseArea(pondBeaten, CHINAMPA_ID)).toThrow(/area chinampa-1 is locked/);
    const pond2Beaten = recordTripEnd(pondBeaten, {
      ...record([], 3),
      areaId: POND_2_ID,
      stars: { areaId: POND_2_ID, earned: { exit: true, special: false, legsOrRescue: false } },
    });
    expect(chooseArea(pond2Beaten, CHINAMPA_ID).hub.lastAreaId).toBe(CHINAMPA_ID);
  });

  it('throws for a locked area and chooses it once the area before it is beaten', () => {
    const session = withStarter();
    expect(() => chooseArea(session, DEV_TEST_AREA.id, TWO_AREAS)).toThrow(/locked/);
    const beaten = recordTripEnd(session, beatenRecord({ exit: true, special: false, legsOrRescue: false }, 1));
    expect(chooseArea(beaten, DEV_TEST_AREA.id, TWO_AREAS).hub.lastAreaId).toBe(DEV_TEST_AREA.id);
  });
});

describe('Start over (#73)', () => {
  it('resets the last chosen area, the hazards met and every area memory', () => {
    const played = recordTripEnd(withStarter(), { ...record([PLANT], 3, ['snack-1']), met: ['tilapia'] });
    expect(played.hub.metHazards).toEqual(['tilapia']);
    const fresh = createSession();
    expect(fresh.hub.lastAreaId).toBe(CANAL_AREA_ID);
    expect(fresh.hub.metHazards).toEqual([]);
    expect(Object.keys(fresh.areas)).toEqual([CANAL_AREA_ID, POND_ID, POND_2_ID, CHINAMPA_ID, CHINAMPA_2_ID, SPRING_CAVE_ID]);
    expect(fresh.areas.canal).toEqual(areaMemory(fresh, DEV_TEST_AREA.id));
    expect(fresh.areas[POND_ID]).toEqual(areaMemory(fresh, DEV_TEST_AREA.id));
    expect(fresh.areas[POND_2_ID]).toEqual(areaMemory(fresh, DEV_TEST_AREA.id));
    expect(fresh.areas[CHINAMPA_ID]).toEqual(areaMemory(fresh, DEV_TEST_AREA.id));
    expect(fresh.areas[CHINAMPA_2_ID]).toEqual(areaMemory(fresh, DEV_TEST_AREA.id));
    expect(fresh.areas[SPRING_CAVE_ID]).toEqual(areaMemory(fresh, DEV_TEST_AREA.id));
  });
});

describe('setTankLayout with options', () => {
  type CatalogueEntry = NonNullable<NonNullable<Parameters<typeof setTankLayout>[2]>['catalogue']>[number];
  const FLOATER: CatalogueEntry = {
    id: 'test/float',
    name: 'Test floater',
    rarity: 'common',
    category: 'decoration',
    placement: 'floating',
  };
  const TEST_CATALOGUE = [FLOATER];
  const FLOATING_LAYOUT = { placed: [{ id: FLOATER.id, x: 240, y: 104 }] };

  it('keeps an owned injected Floating placement at y 104 when given its catalogue and owned ids', () => {
    const session = withStarter();
    const next = setTankLayout(session, FLOATING_LAYOUT, { catalogue: TEST_CATALOGUE, owned: [FLOATER.id] });
    expect(next.hub.tank).toEqual(FLOATING_LAYOUT);
    expect(next.hub.banked).toBe(session.hub.banked);
  });

  it('drops the injected placement without options', () => {
    const next = setTankLayout(withStarter(), FLOATING_LAYOUT);
    expect(next.hub.tank).toEqual({ placed: [] });
  });

  it('drops it when the catalogue is given but the id is not owned', () => {
    const next = setTankLayout(withStarter(), FLOATING_LAYOUT, { catalogue: TEST_CATALOGUE });
    expect(next.hub.tank).toEqual({ placed: [] });
  });
});
