import { describe, expect, it } from 'vitest';
import { AREAS, CANAL_AREA } from './areas';
import { createCollectibles, drawnSnackX, drawnSnackY, pullSnacksToward, type Collectible, type SnackDrift, type SnackFrame } from './collectibles';
import { netDrift } from './ghostNets';
import { hazardSweep, type ElementSpawn, type HazardSpawn, type HazardType } from './hazards';
import { zoneThreats } from './hiding';
import {
  SHRIMP_FLICK_FRAME,
  SHRIMP_REST_FRAME,
  SNACK_RAMP,
  TADPOLE_SWAY,
  meetsSnackRamp,
  metSnackTypeIds,
  mobileSnackAvoid,
  mobileSnackClear,
  mobileSnackMix,
  mobileSnackPose,
  mobileSnackShare,
  oneTimeDarts,
  shrimpBox,
  shrimpRule,
  snackMagnetSpeed,
  snackTopSpeed,
  tadpoleLane,
  tadpoleLaneBox,
  tadpoleLaneBoxes,
  tadpoleRule,
  type MobileSnackAvoid,
  type MobileSnackMix,
  type MobileSnackPose,
  type ShrimpRule,
  type TadpoleRule,
} from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, movingHazardSweep } from './movingHazards';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { CARP_SPECIES, GARTER_SNAKE_SPECIES, HERON_SPECIES, type PredatorRoute } from './predators';
import { SNACK_DART, createSnackDarts } from './snackDart';
import { SHRIMP, SNACK_REACH, TADPOLES, TILAPIA } from './tuning';
import {
  CANAL_LAYOUT,
  SNACK_HAZARD_CLEARANCE,
  SURF,
  buildZone,
  type AreaLayoutData,
  type Point,
  type ZoneLayout,
} from './zone';

const SEEDS = [0xa70107, 1, 2, 3, 42, 1234, 0xdeadbeef];

/** Tadpole speeds from ND-24, Areas 2 to 5. */
const TADPOLE_SPEEDS: Readonly<Record<number, number>> = { 2: 25, 3: 35, 4: 48, 5: 60 };
/** Shrimp values from ND-25, Areas 2 to 5: triggerRadius, restFor, flickDistance, flickSpeed. */
const SHRIMP_VALUES: Readonly<Record<number, readonly [number, number, number, number]>> = {
  2: [60, 2.0, 36, 100],
  3: [60, 1.7, 44, 115],
  4: [60, 1.4, 52, 130],
  5: [60, 1.2, 60, 145],
};
/** Implied counts from ND-23, Areas 2 to 5: worms, bugs, tadpoles, shrimp. */
const COUNTS: Readonly<Record<number, readonly [number, number, number, number]>> = {
  2: [10, 6, 2, 2],
  3: [10, 6, 4, 4],
  4: [8, 6, 7, 7],
  5: [7, 6, 10, 9],
};
/** Snack magnet pulls from ND-28, Areas 2 to 5. */
const PULLS: Readonly<Record<number, number>> = { 2: 40, 3: 42, 4: 57.6, 5: 72 };
const DEFAULT_LANE = 120;
const AREA_NUMBERS = [2, 3, 4, 5] as const;

function areaShrimp(area: number): Readonly<ShrimpRule> {
  const [triggerRadius, restFor, flickDistance, flickSpeed] = SHRIMP_VALUES[area];
  return shrimpRule(triggerRadius, restFor, flickDistance, flickSpeed);
}

/** Lane n of N gets offset (n - 1) x (2L / speed) / N (ND-24). */
function spreadLanes(rule: Readonly<TadpoleRule>, count: number): ReturnType<typeof tadpoleLane>[] {
  const loop = (2 * DEFAULT_LANE) / rule.speed;
  return Array.from({ length: count }, (_, i) => tadpoleLane(rule, 400 + 160 * i, 200, DEFAULT_LANE, 0, (i * loop) / count));
}

function areaMix(area: number): Readonly<MobileSnackMix> {
  const [, , tadpoles, shrimp] = COUNTS[area];
  const tadpole = tadpoleRule(TADPOLE_SPEEDS[area]);
  return mobileSnackMix({
    tadpole,
    lanes: spreadLanes(tadpole, tadpoles),
    shrimp: areaShrimp(area),
    spots: Array.from({ length: shrimp }, (_, i) => ({ x: 400 + 160 * i, y: 140 })),
  });
}

function areaLayout(area: number): Pick<AreaLayoutData, 'snackWorms' | 'snackBugs' | 'mobileSnacks'> {
  const [snackWorms, snackBugs] = COUNTS[area];
  return { snackWorms, snackBugs, mobileSnacks: areaMix(area) };
}

describe('tadpoleRule (ND-24)', () => {
  it.each([0, -1, 72.001, Number.NaN, Infinity])('refuses speed %s', (speed) => {
    expect(() => tadpoleRule(speed)).toThrow(RangeError);
  });

  it('takes any speed above 0 and at most 72 px/s', () => {
    expect(TADPOLES.maxSpeed).toBe(72);
    expect(tadpoleRule(0.01)).toEqual({ speed: 0.01 });
    expect(tadpoleRule(72)).toEqual({ speed: 72 });
  });

  it.each(AREA_NUMBERS)('takes the Area %i default', (area) => {
    expect(tadpoleRule(TADPOLE_SPEEDS[area]).speed).toBe(TADPOLE_SPEEDS[area]);
  });
});

describe('tadpoleLane (ND-24)', () => {
  const rule = tadpoleRule(60);

  it('takes lanes from 80 to 160 px long and refuses others', () => {
    expect(TADPOLES.laneMin).toBe(80);
    expect(TADPOLES.laneMax).toBe(160);
    expect(tadpoleLane(rule, 400, 200, 80, 0, 0)).toEqual({ x: 400, y: 200, dx: 80, dy: 0, offset: 0 });
    expect(tadpoleLane(rule, 400, 200, 0, -160, 0).dy).toBe(-160);
    expect(tadpoleLane(rule, 400, 200, 96, 128, 0).dx).toBe(96);
    expect(() => tadpoleLane(rule, 400, 200, 79.9, 0, 0)).toThrow(RangeError);
    expect(() => tadpoleLane(rule, 400, 200, 0, 160.1, 0)).toThrow(RangeError);
  });

  it('takes an offset in [0, 2L / speed) only', () => {
    expect(tadpoleLane(rule, 400, 200, 120, 0, 3.999).offset).toBe(3.999);
    expect(() => tadpoleLane(rule, 400, 200, 120, 0, -0.001)).toThrow(RangeError);
    expect(() => tadpoleLane(rule, 400, 200, 120, 0, 4)).toThrow(RangeError);
  });

  it('refuses a value that is not finite or a rule outside its limits', () => {
    expect(() => tadpoleLane(rule, Number.NaN, 200, 120, 0, 0)).toThrow(RangeError);
    expect(() => tadpoleLane(rule, 400, Infinity, 120, 0, 0)).toThrow(RangeError);
    expect(() => tadpoleLane({ speed: 90 }, 400, 200, 120, 0, 0)).toThrow(RangeError);
  });

  it.each(AREA_NUMBERS)('takes the Area %i default 120 px lanes with spread offsets', (area) => {
    const lanes = spreadLanes(tadpoleRule(TADPOLE_SPEEDS[area]), COUNTS[area][2]);
    expect(lanes).toHaveLength(COUNTS[area][2]);
    expect(lanes.every((lane) => Math.hypot(lane.dx, lane.dy) === DEFAULT_LANE)).toBe(true);
  });
});

describe('shrimpRule (ND-25)', () => {
  it('refuses a trigger radius at or inside the 36 px eat reach', () => {
    expect(SNACK_REACH.radius).toBe(36);
    expect(() => shrimpRule(36, 2, 36, 100)).toThrow(RangeError);
    expect(shrimpRule(36.5, 2, 36, 100).triggerRadius).toBe(36.5);
  });

  it('refuses a rest under 1.0 s', () => {
    expect(SHRIMP.minRest).toBe(1);
    expect(() => shrimpRule(40, 0.99, 24, 100)).toThrow(RangeError);
    expect(shrimpRule(40, 1, 24, 100).restFor).toBe(1);
  });

  it('refuses a flick distance outside 24 to 72 px', () => {
    expect(() => shrimpRule(40, 3, 23.9, 100)).toThrow(RangeError);
    expect(() => shrimpRule(40, 3, 72.1, 100)).toThrow(RangeError);
    expect(shrimpRule(40, 3, 24, 100).flickDistance).toBe(24);
    expect(shrimpRule(40, 3, 72, 100).flickDistance).toBe(72);
  });

  it('refuses a flick speed not above 0 or above 150 px/s', () => {
    expect(() => shrimpRule(40, 3, 36, 0)).toThrow(RangeError);
    expect(() => shrimpRule(40, 3, 36, 150.1)).toThrow(RangeError);
    expect(shrimpRule(40, 3, 36, 150).flickSpeed).toBe(150);
  });

  it('refuses a rule outside the catch limit, restFor x 70 >= triggerRadius + flickDistance - 36', () => {
    expect(SHRIMP.catchSpeed).toBe(70);
    expect(shrimpRule(60, 1, 46, 100).restFor).toBe(1);
    expect(() => shrimpRule(60, 1, 46.1, 100)).toThrow(RangeError);
    expect(() => shrimpRule(80, 1.2, 60, 145)).toThrow(RangeError);
  });

  it('refuses a value that is not finite', () => {
    expect(() => shrimpRule(Number.NaN, 2, 36, 100)).toThrow(RangeError);
    expect(() => shrimpRule(60, Infinity, 36, 100)).toThrow(RangeError);
  });

  it.each(AREA_NUMBERS)('takes the Area %i default', (area) => {
    const [triggerRadius, restFor, flickDistance, flickSpeed] = SHRIMP_VALUES[area];
    expect(areaShrimp(area)).toEqual({ triggerRadius, restFor, flickDistance, flickSpeed });
  });
});

describe('mobileSnackMix (ND-23)', () => {
  const tadpole = tadpoleRule(60);
  const lane = tadpoleLane(tadpole, 400, 200, 120, 0, 0);

  it('refuses lanes without a tadpole rule and spots without a shrimp rule', () => {
    expect(() => mobileSnackMix({ lanes: [lane], spots: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ lanes: [], spots: [{ x: 500, y: 200 }] })).toThrow(RangeError);
  });

  it('checks every hand-written value against its limits', () => {
    expect(() => mobileSnackMix({ tadpole: { speed: 80 }, lanes: [], spots: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ tadpole, lanes: [{ ...lane, dx: 200 }], spots: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ tadpole, lanes: [{ ...lane, offset: 4 }], spots: [] })).toThrow(RangeError);
    const loose: ShrimpRule = { triggerRadius: 60, restFor: 0.5, flickDistance: 36, flickSpeed: 100 };
    expect(() => mobileSnackMix({ lanes: [], shrimp: loose, spots: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ lanes: [], shrimp: areaShrimp(5), spots: [{ x: Number.NaN, y: 1 }] })).toThrow(RangeError);
  });

  it('keeps a rule with no snacks, adds no key for a missing rule and freezes the mix', () => {
    const mix = mobileSnackMix({ tadpole, lanes: [], spots: [] });
    expect(mix).toStrictEqual({ tadpole: { speed: 60 }, lanes: [], spots: [] });
    expect(mix).not.toHaveProperty('shrimp');
    expect(Object.isFrozen(mix)).toBe(true);
    expect(Object.isFrozen(mix.lanes)).toBe(true);
  });

  it.each(AREA_NUMBERS)('takes the Area %i defaults', (area) => {
    const mix = areaMix(area);
    expect(mix.lanes).toHaveLength(COUNTS[area][2]);
    expect(mix.spots).toHaveLength(COUNTS[area][3]);
  });
});

describe('lane and shrimp boxes (ND-26)', () => {
  it('boxes a lane from its start to its end, whichever way it runs', () => {
    expect(tadpoleLaneBox({ x: 400, y: 200, dx: -120, dy: 30 })).toEqual({ kind: 'rect', x0: 280, x1: 400, y0: 200, y1: 230 });
    expect(tadpoleLaneBox({ x: 400, y: 200, dx: 0, dy: -100 })).toEqual({ kind: 'rect', x0: 400, x1: 400, y0: 100, y1: 200 });
  });

  it('boxes a shrimp by its drift and the snack bob', () => {
    const drift: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 10, periodY: 8 };
    expect(shrimpBox({ x: 500, y: 200 }, drift)).toEqual({ kind: 'rect', x0: 484, x1: 516, y0: 189.5, y1: 210.5 });
  });

  it('gives the lane boxes of a zone, and none without tadpoles', () => {
    const mix = areaMix(2);
    expect(tadpoleLaneBoxes({ mobileSnacks: mix })).toEqual(mix.lanes.map(tadpoleLaneBox));
    expect(tadpoleLaneBoxes({})).toEqual([]);
    expect(tadpoleLaneBoxes({ mobileSnacks: mobileSnackMix({ lanes: [], shrimp: areaShrimp(2), spots: [{ x: 1, y: 1 }] }) })).toEqual([]);
  });
});

type AvoidZone = Parameters<typeof mobileSnackAvoid>[0];

/** A made-up two-screen-tall area, 6 screens across, with nothing in it but the Home Spot. */
const OPEN_ZONE: AvoidZone = {
  width: 2880,
  bedTop: 678,
  homeSpot: { x: 120, y: 200, radius: 72 },
  safeArea: { x0: 40, x1: 300, y0: SURF, y1: 678 },
  currents: [],
  hazards: [],
  elements: [],
  tilapiaRoutes: [],
  predatorRoutes: [],
};

function zoneWith(overrides: Partial<AvoidZone>): AvoidZone {
  return { ...OPEN_ZONE, ...overrides };
}

/** A point box at (x, y). */
function pointBox(x: number, y: number) {
  return { kind: 'rect' as const, x0: x, x1: x, y0: y, y1: y };
}

const SLOW_TYPE: HazardType = {
  id: 'test-litter',
  name: 'Test litter',
  costsLeg: false,
  reach: 12,
  meetRange: 60,
  fact: { id: 'test-litter', name: 'Test litter', title: 'Meet the test litter', body: 'Test litter.' },
};
const LEG_TYPE: HazardType = { ...SLOW_TYPE, id: 'test-spikes', costsLeg: true, reach: 100 };
const MATS: ElementSpawn = {
  id: 'mats-0',
  type: { id: 'test-mats', name: 'Test mats', kind: 'cycle', period: 8, activeFor: 3 },
  offset: 0,
  matPair: { x0: 1000, x1: 1060, rowTop: 360, rowBottom: 678, channelY: 520, openHeight: 72 },
};
/** A square patrol loop from (1400, 300) to (1500, 400). */
const LOOP: Point[] = [
  { x: 1400, y: 300 },
  { x: 1500, y: 300 },
  { x: 1500, y: 400 },
  { x: 1400, y: 400 },
];

describe('mobileSnackAvoid (ND-26)', () => {
  it('collects the bounds, the hazard drift sweeps, element and moving sweeps, worms and zoneThreats', () => {
    const net: HazardSpawn = { id: 'net-0', type: SLOW_TYPE, shape: { kind: 'rect', x0: 600, x1: 640, y0: 300, y1: 340 }, drift: netDrift(160, 0, 16, 0) };
    const pole = movingHazardSpawn('dev/punting-pole-1', PUNTING_POLE, 2000, 0);
    const zone = zoneWith({ hazards: [net], elements: [MATS], movingHazards: [pole], tilapiaRoutes: [{ id: 'tilapia-0', waypoints: LOOP }] });
    const avoid = mobileSnackAvoid(zone, [{ x: 5, y: 6 }]);
    expect(avoid.bounds).toEqual({ minX: 40, maxX: 2840, minY: SURF + 14, maxY: 656 });
    expect(avoid.keepAway).toEqual([hazardSweep(net), { kind: 'rect', x0: 1000, x1: 1060, y0: 360, y1: 678 }, movingHazardSweep(pole)]);
    expect(avoid.mats).toEqual([{ kind: 'rect', x0: 1000, x1: 1060, y0: 360, y1: 678 }]);
    expect(avoid.worms).toEqual([{ x: 5, y: 6 }]);
    expect(avoid.threats).toEqual(zoneThreats(zone));
    expect(mobileSnackAvoid(zone).worms).toEqual([]);
  });
});

describe('mobileSnackClear (ND-26)', () => {
  const open = mobileSnackAvoid(OPEN_ZONE);

  it('clears a box in open water', () => {
    expect(mobileSnackClear(pointBox(1400, 400), open)).toBe(true);
    expect(mobileSnackClear(tadpoleLaneBox({ x: 1400, y: 400, dx: 120, dy: 40 }), open)).toBe(true);
  });

  it('keeps the box inside the swim bounds', () => {
    expect(mobileSnackClear(pointBox(2840, 400), open)).toBe(true);
    expect(mobileSnackClear(pointBox(2840.5, 400), open)).toBe(false);
    expect(mobileSnackClear(pointBox(1400, 656), open)).toBe(true);
    expect(mobileSnackClear(pointBox(1400, 656.5), open)).toBe(false);
    expect(mobileSnackClear(pointBox(1400, SURF + 13.5), open)).toBe(false);
  });

  it('keeps the box below the highest wave, SURF + 2.4', () => {
    const tall: MobileSnackAvoid = { ...open, bounds: { ...open.bounds, minY: 0 } };
    expect(mobileSnackClear(pointBox(1400, SURF + 2.3), tall)).toBe(false);
    expect(mobileSnackClear(pointBox(1400, SURF + 2.5), tall)).toBe(true);
  });

  it('keeps the box out of the Home Spot ring, the edge counting as inside', () => {
    const ringOnly: MobileSnackAvoid = { ...open, safeArea: { x0: -10, x1: -5, y0: -10, y1: -5 } };
    expect(mobileSnackClear(pointBox(192, 200), ringOnly)).toBe(false);
    expect(mobileSnackClear(pointBox(192.5, 200), ringOnly)).toBe(true);
  });

  it('keeps the box out of the safe area, the edge counting as inside', () => {
    expect(mobileSnackClear(tadpoleLaneBox({ x: 300, y: 400, dx: 120, dy: 0 }), open)).toBe(false);
    expect(mobileSnackClear(tadpoleLaneBox({ x: 300.5, y: 400, dx: 120, dy: 0 }), open)).toBe(true);
  });

  it('keeps the box out of every current, the edge counting as inside', () => {
    const avoid = mobileSnackAvoid(zoneWith({ currents: [{ id: 'current-0', x0: 1500, x1: 1700, y0: 400, y1: 640, force: { x: -70, y: 0 } }] }));
    expect(mobileSnackClear(tadpoleLaneBox({ x: 1380, y: 400, dx: 120, dy: 0 }), avoid)).toBe(false);
    expect(mobileSnackClear(tadpoleLaneBox({ x: 1379.5, y: 399.5, dx: 120, dy: 0 }), avoid)).toBe(true);
  });

  it('keeps the box out of every mat pair sweep and 80 px from it', () => {
    const avoid = mobileSnackAvoid(zoneWith({ elements: [MATS] }));
    expect(mobileSnackClear(pointBox(1030, 500), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1060, 500), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1139.5, 500), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1140, 500), avoid)).toBe(true);
  });

  it('keeps the box 80 px from every plastic worm where it is now', () => {
    const avoid = mobileSnackAvoid(OPEN_ZONE, [{ x: 1600, y: 400 }]);
    expect(SNACK_HAZARD_CLEARANCE).toBe(80);
    expect(mobileSnackClear(tadpoleLaneBox({ x: 1400, y: 400, dx: 120, dy: 0 }), avoid)).toBe(true);
    expect(mobileSnackClear(tadpoleLaneBox({ x: 1400, y: 400, dx: 120.5, dy: 0 }), avoid)).toBe(false);
  });

  it('keeps the box 80 px from every hazard shape', () => {
    const litter: HazardSpawn = { id: 'litter-0', type: SLOW_TYPE, shape: { kind: 'circle', x: 1600, y: 400, r: 10 } };
    const avoid = mobileSnackAvoid(zoneWith({ hazards: [litter] }));
    expect(mobileSnackClear(pointBox(1510, 400), avoid)).toBe(true);
    expect(mobileSnackClear(pointBox(1510.5, 400), avoid)).toBe(false);
  });

  it('keeps the box 80 px from a drifting net\'s whole drift path', () => {
    const net: HazardSpawn = { id: 'net-0', type: SLOW_TYPE, shape: { kind: 'rect', x0: 1600, x1: 1640, y0: 380, y1: 420 }, drift: netDrift(-160, 0, 16, 0) };
    const avoid = mobileSnackAvoid(zoneWith({ hazards: [net] }));
    expect(mobileSnackClear(pointBox(1430, 400), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1360, 400), avoid)).toBe(true);
    expect(mobileSnackClear(pointBox(1360.5, 400), avoid)).toBe(false);
  });

  it('keeps the box 80 px from every moving hazard sweep', () => {
    const pole = movingHazardSpawn('dev/punting-pole-1', PUNTING_POLE, 1600, 0);
    const avoid = mobileSnackAvoid(zoneWith({ movingHazards: [pole] }));
    expect(mobileSnackClear(pointBox(1515, 200), avoid)).toBe(true);
    expect(mobileSnackClear(pointBox(1515.5, 200), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1600, 340), avoid)).toBe(true);
    expect(mobileSnackClear(pointBox(1600, 339.5), avoid)).toBe(false);
  });

  it('measures moving hazards even when given only as threats', () => {
    const pole = movingHazardSpawn('dev/punting-pole-1', PUNTING_POLE, 1600, 0);
    const avoid: MobileSnackAvoid = { ...open, threats: zoneThreats({ tilapiaRoutes: [], movingHazards: [pole] }) };
    expect(mobileSnackClear(pointBox(1623, 200), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1623.5, 200), avoid)).toBe(true);
  });

  it('keeps the box farther than the tilapia lunge range from its loop', () => {
    const avoid = mobileSnackAvoid(zoneWith({ tilapiaRoutes: [{ id: 'tilapia-0', waypoints: LOOP }] }));
    expect(TILAPIA.lungeRange).toBe(140);
    expect(mobileSnackClear(pointBox(1640, 350), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1640.5, 350), avoid)).toBe(true);
    expect(mobileSnackClear(tadpoleLaneBox({ x: 1300, y: 350, dx: 160, dy: 0 }), avoid)).toBe(false);
  });

  it('measures a tilapia by the area\'s own tuning', () => {
    const tilapia = { ...TILAPIA, lungeRange: 160 };
    const avoid = mobileSnackAvoid(zoneWith({ tilapiaRoutes: [{ id: 'tilapia-0', waypoints: LOOP }], tilapia }));
    expect(mobileSnackClear(pointBox(1660, 350), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1660.5, 350), avoid)).toBe(true);
  });

  it.each([
    ['heron', HERON_SPECIES],
    ['garter snake', GARTER_SNAKE_SPECIES],
    ['carp', CARP_SPECIES],
  ] as const)('keeps the box farther than the %s lunge range from its loop', (_, species) => {
    const route: PredatorRoute = { id: `${species.id}-0`, waypoints: LOOP, species };
    const avoid = mobileSnackAvoid(zoneWith({ predatorRoutes: [route] }));
    const strike = species.tuning.lungeRange;
    expect(mobileSnackClear(pointBox(1500 + strike, 350), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1500 + strike + 0.5, 350), avoid)).toBe(true);
    expect(mobileSnackClear(pointBox(1450, 400 + strike), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1450, 400 + strike + 0.5), avoid)).toBe(true);
  });

  it('keeps the box farther than a leg-costing hazard\'s reach', () => {
    const spikes: HazardSpawn = { id: 'spikes-0', type: LEG_TYPE, shape: { kind: 'rect', x0: 1600, x1: 1640, y0: 380, y1: 420 } };
    const avoid = mobileSnackAvoid(zoneWith({ hazards: [spikes] }));
    expect(mobileSnackClear(pointBox(1500, 400), avoid)).toBe(false);
    expect(mobileSnackClear(pointBox(1499.5, 400), avoid)).toBe(true);
  });

  it('measures a lane crossing a loop as inside it', () => {
    const avoid = mobileSnackAvoid(zoneWith({ predatorRoutes: [{ id: 'carp-0', waypoints: LOOP, species: CARP_SPECIES }] }));
    expect(mobileSnackClear(tadpoleLaneBox({ x: 1450, y: 100, dx: 0, dy: 160 }), avoid)).toBe(false);
    expect(mobileSnackClear(tadpoleLaneBox({ x: 1450, y: 100, dx: 0, dy: 79.5 }), avoid)).toBe(true);
  });

  it('checks a shrimp box at its spot, drift and bob included', () => {
    const drift: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 };
    const avoid = mobileSnackAvoid(OPEN_ZONE, [{ x: 1600, y: 400 }]);
    expect(mobileSnackClear(shrimpBox({ x: 1504, y: 400 }, drift), avoid)).toBe(true);
    expect(mobileSnackClear(shrimpBox({ x: 1505, y: 400 }, drift), avoid)).toBe(false);
  });
});

describe('snackTopSpeed and snackMagnetSpeed (ND-28)', () => {
  it('pulls at exactly the base with no mobile snacks', () => {
    expect(SNACK_MAGNET_PULL_SPEED).toBe(40);
    expect(snackMagnetSpeed(40, {})).toBe(40);
    for (const area of AREAS.filter((each) => each.layout.mobileSnacks === undefined)) {
      for (const seed of SEEDS) expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, buildZone(area.layout, seed))).toBe(40);
    }
  });

  it('gives a tadpole its speed and a shrimp the farthest it gets a second over a rest and a flick', () => {
    const shrimp = areaShrimp(5);
    expect(snackTopSpeed(mobileSnackMix({ tadpole: tadpoleRule(48), lanes: spreadLanes(tadpoleRule(48), 1), spots: [] }))).toBe(48);
    const shrimpOnly = mobileSnackMix({ lanes: [], shrimp, spots: [{ x: 1, y: 1 }] });
    expect(snackTopSpeed(shrimpOnly)).toBeCloseTo(60 / (1.2 + 60 / 145), 12);
    expect(snackTopSpeed(mobileSnackMix({ tadpole: tadpoleRule(60), lanes: [], spots: [] }))).toBe(0);
  });

  it.each(AREA_NUMBERS)('pulls at the Area %i value', (area) => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, { mobileSnacks: areaMix(area) })).toBe(PULLS[area]);
  });

  it('pulls at max(40, 1.2 x the fastest top speed)', () => {
    for (let speed = 0.5; speed <= TADPOLES.maxSpeed; speed += 0.5) {
      const rule = tadpoleRule(speed);
      const pull = snackMagnetSpeed(40, { mobileSnacks: mobileSnackMix({ tadpole: rule, lanes: spreadLanes(rule, 1), spots: [] }) });
      expect(pull).toBeCloseTo(Math.max(40, 1.2 * speed), 9);
      expect(pull).toBeLessThan(90);
    }
  });

  it('stays under 90 px/s for the fastest shrimp the limits allow', () => {
    const fastest = shrimpRule(60, SHRIMP.minRest, 46, SHRIMP.maxFlickSpeed);
    const pull = snackMagnetSpeed(40, { mobileSnacks: mobileSnackMix({ lanes: [], shrimp: fastest, spots: [{ x: 1, y: 1 }] }) });
    expect(pull).toBeGreaterThan(40);
    expect(pull).toBeLessThan(90);
  });

  it('pulls a shrimp farther over a rest and a flick than the flick carries it', () => {
    for (const area of AREA_NUMBERS) {
      const rule = areaShrimp(area);
      const pull = snackMagnetSpeed(40, { mobileSnacks: areaMix(area) });
      expect(pull * (rule.restFor + rule.flickDistance / rule.flickSpeed)).toBeGreaterThan(rule.flickDistance);
    }
  });

  it.each([
    ['away from', 340, 120, 0],
    ['across', 330, 0, 120],
    ['toward and past', 360, -120, 0],
  ] as const)('always closes on a still head with a tadpole swimming %s it', (_, x, dx, dy) => {
    const speed = TADPOLES.maxSpeed;
    const rule = tadpoleRule(speed);
    const mix = mobileSnackMix({ tadpole: rule, lanes: [tadpoleLane(rule, x, 400, dx, dy, 0)], spots: [] });
    const pull = snackMagnetSpeed(40, { mobileSnacks: mix });
    const head = { x: 300, y: 400 };
    const dt = 1 / 60;
    let items: Collectible[] = createCollectibles([{ id: 'snack-tadpole-1', kind: 'tadpole', x, y: 400, lane: { dx, dy, speed, offset: 0 } }]);
    const frameAt = (driftT: number): SnackFrame => ({
      driftT,
      bobT: driftT,
      bobbing: true,
      drift: CANAL_AREA.snackDrift,
      bounds: { minX: 40, maxX: 2840, minY: 94, maxY: 656 },
    });
    const distanceAt = (driftT: number) => Math.hypot(drawnSnackX(items[0], 0, frameAt(driftT)) - head.x, drawnSnackY(items[0], 0, frameAt(driftT)) - head.y);
    let driftT = 0;
    let distance = distanceAt(driftT);
    for (let step = 0; step < 240 && distance > pull * dt; step++) {
      items = pullSnacksToward(items, head, 70, pull, dt, frameAt(driftT)) ?? items;
      driftT += dt;
      const next = distanceAt(driftT);
      expect(next).toBeLessThanOrEqual(distance - (pull - speed) * dt + 1e-9);
      distance = next;
    }
    expect(distance).toBeLessThanOrEqual(pull * dt);
  });
});

describe('oneTimeDarts (ND-27)', () => {
  it('gives Areas 1 and 2 none, as today', () => {
    for (const area of AREAS.filter((each) => !each.snackDart)) {
      expect(oneTimeDarts(area, buildZone(area.layout, 3))).toBeNull();
    }
    expect(AREAS.filter((each) => !each.snackDart).map((each) => each.number)).toEqual([1, 2]);
  });

  it.each(SEEDS)('gives Areas 3, 4 and 5 exactly today\'s darters, or none once the area has shrimp, for seed %i', (seed) => {
    const darted = AREAS.filter((each) => each.snackDart);
    expect(darted.map((each) => each.number)).toEqual([3, 4, 5]);
    for (const area of darted) {
      const zone = buildZone(area.layout, seed);
      const hasShrimp = (area.layout.mobileSnacks?.spots.length ?? 0) > 0;
      expect(oneTimeDarts(area, zone)).toEqual(hasShrimp ? null : createSnackDarts(zone.collectibles, SNACK_DART));
    }
  });

  it.each(SEEDS)('picks the darters from the worms and bugs only for seed %i', (seed) => {
    const rule = tadpoleRule(60);
    const lanes = [tadpoleLane(rule, 400, 200, 120, 0, 0), tadpoleLane(rule, 1500, 200, 120, 0, 2)];
    const zone = buildZone({ ...CANAL_LAYOUT, mobileSnacks: mobileSnackMix({ tadpole: rule, lanes, spots: [] }) }, seed);
    const seeded = buildZone(CANAL_LAYOUT, seed).collectibles;
    const darts = oneTimeDarts({ snackDart: SNACK_DART }, zone);
    expect(darts).toEqual(createSnackDarts(seeded, SNACK_DART));
    expect(darts?.waiting.some((id) => id.startsWith('snack-tadpole'))).toBe(false);
  });

  it('gives none when the zone has shrimp', () => {
    const mix = mobileSnackMix({ lanes: [], shrimp: areaShrimp(3), spots: [{ x: 600, y: 200 }] });
    const zone = buildZone({ ...CANAL_LAYOUT, mobileSnacks: mix }, 3);
    expect(oneTimeDarts({ snackDart: SNACK_DART }, zone)).toBeNull();
  });
});

describe('metSnackTypeIds (ND-29)', () => {
  const SAFE = { x0: 40, x1: 300, y0: SURF, y1: 678 };
  const frame: SnackFrame = {
    driftT: 1,
    bobT: 0.4,
    bobbing: true,
    drift: { amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 },
    bounds: { minX: 40, maxX: 2840, minY: 94, maxY: 656 },
  };
  const snacks = createCollectibles([
    { id: 'snack-0', kind: 'worm', x: 400, y: 300 },
    { id: 'snack-shrimp-1', kind: 'shrimp', x: 1000, y: 300 },
    { id: 'snack-tadpole-1', kind: 'tadpole', x: 1100, y: 300, lane: { dx: 120, dy: 0, speed: 60, offset: 0 } },
    { id: 'snack-tadpole-2', kind: 'tadpole', x: 2000, y: 300, lane: { dx: 0, dy: 120, speed: 60, offset: 0 } },
  ]);
  const shrimpAt = { x: drawnSnackX(snacks[1], 1, frame), y: drawnSnackY(snacks[1], 1, frame) };

  it('meets a type within 120 px of where a snack of it is drawn, inclusive', () => {
    expect(metSnackTypeIds(snacks, { x: 1160 + 120, y: 300 }, SAFE, [], frame)).toEqual(['tadpole']);
    expect(metSnackTypeIds(snacks, { x: 1160 + 120.5, y: 300 }, SAFE, [], frame)).toEqual([]);
    expect(metSnackTypeIds(snacks, { x: 2000, y: 190 }, SAFE, [], frame)).toEqual([]);
    expect(metSnackTypeIds(snacks, { x: 2000, y: 250 }, SAFE, [], frame)).toEqual(['tadpole']);
    expect(metSnackTypeIds(snacks, { x: shrimpAt.x, y: shrimpAt.y + 120 }, SAFE, [], frame)).toEqual(['shrimp']);
  });

  it('lists each id once, tadpole first', () => {
    expect(metSnackTypeIds(snacks, { x: 1080, y: 300 }, SAFE, [], frame)).toEqual(['tadpole', 'shrimp']);
  });

  it('skips a met type, a collected snack and worms or bugs', () => {
    expect(metSnackTypeIds(snacks, { x: 1080, y: 300 }, SAFE, ['tadpole'], frame)).toEqual(['shrimp']);
    expect(metSnackTypeIds(snacks, { x: 1080, y: 300 }, SAFE, ['tadpole', 'shrimp'], frame)).toEqual([]);
    const eaten = snacks.map((snack) => (snack.kind === 'shrimp' ? { ...snack, collected: true } : snack));
    expect(metSnackTypeIds(eaten, { x: 950, y: 300 }, SAFE, [], frame)).toEqual([]);
    expect(metSnackTypeIds(snacks, { x: 950, y: 300 }, SAFE, [], frame)).toEqual(['shrimp']);
    expect(metSnackTypeIds(snacks, { x: 400, y: 300 }, SAFE, [], frame)).toEqual([]);
  });

  it('meets nothing from the safe area, the edge counting as inside', () => {
    const near = createCollectibles([{ id: 'snack-shrimp-1', kind: 'shrimp', x: 360, y: 300 }]);
    expect(metSnackTypeIds(near, { x: 300, y: 300 }, SAFE, [], frame)).toEqual([]);
    expect(metSnackTypeIds(near, { x: 300.5, y: 300 }, SAFE, [], frame)).toEqual(['shrimp']);
  });
});

describe('mobileSnackPose (ND-24, ND-25, ND-30)', () => {
  const frameAt = (driftT: number): SnackFrame => ({
    driftT,
    bobT: driftT,
    bobbing: true,
    drift: { amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 },
    bounds: { minX: 40, maxX: 2840, minY: 94, maxY: 656 },
  });
  const tadpole = (dx: number, dy: number): Collectible => ({
    id: 'snack-tadpole-1',
    kind: 'tadpole',
    x: 1000,
    y: 300,
    collected: false,
    lane: { dx, dy, speed: 60, offset: 0 },
  });
  const scene = (clock: number, reduced = false, head: Point = { x: 0, y: 0 }) => ({ clock, reduced, head });
  const pose = (): MobileSnackPose => ({ frame: -1, facing: 1, sway: 99 });

  it('faces a tadpole the way it swims, +1 on a lane with dx 0', () => {
    expect(mobileSnackPose(tadpole(120, 0), 0, frameAt(1), scene(0), false, pose()).facing).toBe(1);
    expect(mobileSnackPose(tadpole(120, 0), 0, frameAt(3), scene(0), false, pose()).facing).toBe(-1);
    expect(mobileSnackPose(tadpole(-120, 0), 0, frameAt(1), scene(0), false, pose()).facing).toBe(-1);
    expect(mobileSnackPose(tadpole(-120, 0), 0, frameAt(3), scene(0), false, pose()).facing).toBe(1);
    expect(mobileSnackPose(tadpole(0, 120), 0, frameAt(1), scene(0), false, pose()).facing).toBe(1);
    expect(mobileSnackPose(tadpole(0, 120), 0, frameAt(3), scene(0), true, pose()).facing).toBe(1);
  });

  it('shows a tadpole\'s 4 tail frames at 8 a second, swaying up to 8 degrees', () => {
    const frames = [0, 0.125, 0.25, 0.375, 0.5, 0.625].map((clock) => mobileSnackPose(tadpole(120, 0), 0, frameAt(1), scene(clock), false, pose()).frame);
    expect(frames).toEqual([0, 1, 2, 3, 0, 1]);
    let widest = 0;
    for (let clock = 0; clock < 2; clock += 0.01) {
      const sway = mobileSnackPose(tadpole(120, 0), 0, frameAt(1), scene(clock), false, pose()).sway;
      expect(Math.abs(sway)).toBeLessThanOrEqual(TADPOLE_SWAY + 1e-12);
      widest = Math.max(widest, Math.abs(sway));
    }
    expect(TADPOLE_SWAY).toBeCloseTo((8 * Math.PI) / 180, 12);
    expect(widest).toBeGreaterThan(TADPOLE_SWAY * 0.99);
  });

  it('shows a tadpole\'s frame 0 with no sway under reduced motion, facing as without it', () => {
    for (let clock = 0; clock < 2; clock += 0.07) {
      const still = mobileSnackPose(tadpole(120, 0), 0, frameAt(3), scene(clock, true), false, pose());
      expect(still).toEqual({ frame: 0, facing: -1, sway: 0 });
    }
  });

  it('faces a shrimp toward the head, so its flick goes backward, with its rest or flick frame', () => {
    const shrimp = createCollectibles([{ id: 'snack-shrimp-1', kind: 'shrimp', x: 1000, y: 300 }])[0];
    const x = drawnSnackX(shrimp, 0, frameAt(1));
    expect(mobileSnackPose(shrimp, 0, frameAt(1), scene(0, false, { x: x - 50, y: 300 }), false, pose())).toEqual({ frame: SHRIMP_REST_FRAME, facing: -1, sway: 0 });
    expect(mobileSnackPose(shrimp, 0, frameAt(1), scene(0, false, { x: x + 50, y: 300 }), true, pose())).toEqual({ frame: SHRIMP_FLICK_FRAME, facing: 1, sway: 0 });
    expect(mobileSnackPose(shrimp, 0, frameAt(1), scene(0, false, { x, y: 200 }), false, pose()).facing).toBe(1);
    expect(mobileSnackPose(shrimp, 0, frameAt(1), scene(0, true, { x: x + 50, y: 300 }), true, pose()).frame).toBe(SHRIMP_REST_FRAME);
    expect(SHRIMP_REST_FRAME).not.toBe(SHRIMP_FLICK_FRAME);
  });

  it('gives a worm or bug frame 0, facing +1 and no sway, written into the pose it was given', () => {
    const out = pose();
    const worm = createCollectibles([{ id: 'snack-0', kind: 'worm', x: 1000, y: 300 }])[0];
    expect(mobileSnackPose(worm, 0, frameAt(1), scene(0.3), true, out)).toBe(out);
    expect(out).toEqual({ frame: 0, facing: 1, sway: 0 });
  });
});

describe('the snack ramp (ND-31)', () => {
  it('has rows for Areas 1 to 5 and a rule for Area 6 on', () => {
    expect(SNACK_RAMP.rows).toHaveLength(5);
    expect(SNACK_RAMP.rows[0].mobile).toBe(false);
    expect(SNACK_RAMP.later).toEqual({ mobile: true, minShare: 0.55, maxShare: 0.7, minTadpoleSpeed: 60, maxTadpoleSpeed: 72 });
  });

  it('gives the mobile share of a made-up layout', () => {
    expect(mobileSnackShare({ snackWorms: 10, snackBugs: 6 })).toBe(0);
    expect(mobileSnackShare(areaLayout(2))).toBeCloseTo(0.2, 12);
    expect(mobileSnackShare(areaLayout(3))).toBeCloseTo(8 / 24, 12);
    expect(mobileSnackShare(areaLayout(4))).toBeCloseTo(0.5, 12);
    expect(mobileSnackShare(areaLayout(5))).toBeCloseTo(19 / 32, 12);
    expect(mobileSnackShare({ snackWorms: 0, snackBugs: 0 })).toBe(0);
  });

  it('meets Area 1 only with no mobile snacks', () => {
    expect(meetsSnackRamp(1, { snackWorms: 10, snackBugs: 6 })).toBe(true);
    expect(meetsSnackRamp(1, { snackWorms: 10, snackBugs: 6, mobileSnacks: mobileSnackMix({ lanes: [], spots: [] }) })).toBe(true);
    expect(meetsSnackRamp(1, areaLayout(2))).toBe(false);
  });

  it.each(AREA_NUMBERS)('meets the Area %i row with the implied counts and speeds', (area) => {
    expect(meetsSnackRamp(area, areaLayout(area))).toBe(true);
  });

  it('fails a row by share, by tadpole speed, or without both types', () => {
    expect(meetsSnackRamp(2, areaLayout(3))).toBe(false);
    expect(meetsSnackRamp(4, areaLayout(5))).toBe(false);
    expect(meetsSnackRamp(2, { snackWorms: 12, snackBugs: 8 })).toBe(false);
    const mix = areaMix(4);
    const slow = tadpoleRule(39);
    const slowMix = mobileSnackMix({ ...mix, tadpole: slow, lanes: spreadLanes(slow, mix.lanes.length) });
    expect(meetsSnackRamp(4, { snackWorms: 8, snackBugs: 6, mobileSnacks: slowMix })).toBe(false);
    const noShrimp = mobileSnackMix({ tadpole: mix.tadpole, lanes: spreadLanes(tadpoleRule(48), 14), spots: [] });
    expect(meetsSnackRamp(4, { snackWorms: 8, snackBugs: 6, mobileSnacks: noShrimp })).toBe(false);
  });

  it('checks Area 6 on against the later rule', () => {
    const fast = tadpoleRule(66);
    const mix = (tadpoles: number) => mobileSnackMix({ tadpole: fast, lanes: spreadLanes(fast, tadpoles), shrimp: areaShrimp(5), spots: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }, { x: 7, y: 7 }, { x: 8, y: 8 }, { x: 9, y: 9 }, { x: 10, y: 10 }] });
    expect(meetsSnackRamp(6, { snackWorms: 6, snackBugs: 6, mobileSnacks: mix(10) })).toBe(true);
    expect(meetsSnackRamp(9, { snackWorms: 6, snackBugs: 6, mobileSnacks: mix(10) })).toBe(true);
    expect(meetsSnackRamp(6, { snackWorms: 4, snackBugs: 4, mobileSnacks: mix(10) })).toBe(false);
    const slow = tadpoleRule(58);
    expect(meetsSnackRamp(6, { snackWorms: 6, snackBugs: 6, mobileSnacks: mobileSnackMix({ ...mix(10), tadpole: slow, lanes: spreadLanes(slow, 10) }) })).toBe(false);
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses area number %s', (number) => {
    expect(() => meetsSnackRamp(number, { snackWorms: 1, snackBugs: 1 })).toThrow(RangeError);
  });

  it('holds over AREAS: Area 1 has no mobile snacks, and no ramp value steps down by area number', () => {
    const byNumber = [...AREAS].sort((a, b) => a.number - b.number);
    expect(byNumber[0].number).toBe(1);
    expect(meetsSnackRamp(1, byNumber[0].layout)).toBe(true);
    const withMobile = byNumber.filter((area) => mobileSnackShare(area.layout) > 0);
    for (let i = 1; i < withMobile.length; i++) {
      const before = withMobile[i - 1].layout.mobileSnacks;
      const after = withMobile[i].layout.mobileSnacks;
      expect(mobileSnackShare(withMobile[i].layout)).toBeGreaterThanOrEqual(mobileSnackShare(withMobile[i - 1].layout));
      if (before?.tadpole && after?.tadpole) expect(after.tadpole.speed).toBeGreaterThanOrEqual(before.tadpole.speed);
      if (before?.shrimp && after?.shrimp) {
        expect(after.shrimp.flickDistance).toBeGreaterThanOrEqual(before.shrimp.flickDistance);
        expect(after.shrimp.flickSpeed).toBeGreaterThanOrEqual(before.shrimp.flickSpeed);
        expect(after.shrimp.restFor).toBeLessThanOrEqual(before.shrimp.restFor);
      }
    }
  });
});

describe('a zone with mobile snacks', () => {
  it('is a plain ZoneLayout field the magnet and darts read', () => {
    const zone: Pick<ZoneLayout, 'mobileSnacks' | 'collectibles'> = buildZone({ ...CANAL_LAYOUT, mobileSnacks: areaMix(5) }, 3);
    expect(snackMagnetSpeed(40, zone)).toBe(72);
    expect(oneTimeDarts({ snackDart: SNACK_DART }, zone)).toBeNull();
  });
});
