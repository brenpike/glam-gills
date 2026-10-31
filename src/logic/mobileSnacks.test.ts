import { describe, expect, it } from 'vitest';
import { AREAS, CANAL_AREA } from './areas';
import {
  createCollectibles,
  drawnSnackX,
  drawnSnackY,
  pullSnacksToward,
  snackWander,
  type Collectible,
  type SnackDrift,
  type SnackFrame,
} from './collectibles';
import { netDrift } from './ghostNets';
import { hazardSweep, type ElementSpawn, type HazardRect, type HazardSpawn, type HazardType } from './hazards';
import { zoneThreats } from './hiding';
import { legSwimTuning } from './legs';
import {
  SHRIMP_FLICK_FRAME,
  SHRIMP_REST_FRAME,
  SNACK_RAMP,
  TADPOLE_CATCH_SECONDS,
  TADPOLE_CATCH_START_GAP,
  TADPOLE_MAX_TILT,
  TADPOLE_SWAY,
  TADPOLE_TURN_SECONDS,
  meetsSnackMotion,
  meetsSnackRamp,
  metSnackTypeIds,
  mobileLegBoxes,
  mobileSnackAvoid,
  mobileSnackClear,
  mobileSnackHardClear,
  mobileSnackMix,
  mobileSnackPose,
  mobileSnackShare,
  oneLegCatchesTadpole,
  oneTimeDarts,
  shrimpBox,
  shrimpGlideClear,
  shrimpHome,
  shrimpHomeClear,
  shrimpRule,
  snackMagnetSpeed,
  snackTopSpeed,
  tadpoleRule,
  tadpoleWander,
  tadpoleWanderClear,
  writeShrimpBox,
  type MobileSnackAvoid,
  type MobileSnackMix,
  type MobileSnackPose,
  type ShrimpHome,
  type ShrimpPoseState,
  type ShrimpRule,
  type TadpoleRule,
  type TadpoleWander,
} from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, movingHazardSweep } from './movingHazards';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { CARP_SPECIES, GARTER_SNAKE_SPECIES, HERON_SPECIES, type PredatorRoute } from './predators';
import {
  createShrimpFlicks,
  isShrimpFlicking,
  isShrimpRestingAfterFlick,
  readShrimpHopSign,
  type ShrimpFlickState,
} from './shrimpFlick';
import { SNACK_DART, createSnackDarts } from './snackDart';
import { SHRIMP, SNACK_REACH, TADPOLES, TILAPIA } from './tuning';
import {
  CANAL_LAYOUT,
  SNACK_HAZARD_CLEARANCE,
  SURF,
  areaSize,
  buildZone,
  swimBounds,
  type AreaLayoutData,
  type Point,
  type ZoneLayout,
} from './zone';

const SEEDS = [0xa70107, 1, 2, 3, 42, 1234, 0xdeadbeef];

/** Tadpole speeds from issue #131, ND-9, Areas 2 to 5. */
const TADPOLE_SPEEDS: Readonly<Record<number, number>> = { 2: 40, 3: 50, 4: 60, 5: 70 };
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
/** Snack magnet pulls from issue #131, ND-8, Areas 2 to 5: 1.2 x the tadpole speed. */
const PULLS: Readonly<Record<number, number>> = { 2: 48, 3: 60, 4: 72, 5: 84 };
const DEFAULT_LEG = 120;
const AREA_NUMBERS = [2, 3, 4, 5] as const;

function areaShrimp(area: number): Readonly<ShrimpRule> {
  const [triggerRadius, restFor, flickDistance, flickSpeed] = SHRIMP_VALUES[area];
  return shrimpRule(triggerRadius, restFor, flickDistance, flickSpeed);
}

/** Tadpole n of N on a 2-point loop 120 px long gets offset (n - 1) x (2L / speed) / N (ND-24; issue #131, ND-14). */
function spreadWanders(rule: Readonly<TadpoleRule>, count: number): Readonly<TadpoleWander>[] {
  const lap = (2 * DEFAULT_LEG) / rule.speed;
  return Array.from({ length: count }, (_, i) =>
    tadpoleWander(rule, [[400 + 160 * i, 200], [400 + 160 * i + DEFAULT_LEG, 200]], (i * lap) / count),
  );
}

/** `count` 1-spot shrimp homes. */
function spreadHomes(count: number): Readonly<ShrimpHome>[] {
  return Array.from({ length: count }, (_, i) => shrimpHome([[400 + 160 * i, 140]]));
}

function areaMix(area: number): Readonly<MobileSnackMix> {
  const [, , tadpoles, shrimp] = COUNTS[area];
  const tadpole = tadpoleRule(TADPOLE_SPEEDS[area]);
  return mobileSnackMix({
    tadpole,
    wanders: spreadWanders(tadpole, tadpoles),
    shrimp: areaShrimp(area),
    homes: spreadHomes(shrimp),
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

describe('tadpoleWander (issue #131, ND-1, ND-3, ND-13)', () => {
  const rule = tadpoleRule(60);

  it('takes 2 to 8 [x, y] points, the first its start, and freezes them', () => {
    expect(TADPOLES.maxLoopPoints).toBe(8);
    const wander = tadpoleWander(rule, [[400, 200], [520, 200]], 0);
    expect(wander).toEqual({ points: [{ x: 400, y: 200 }, { x: 520, y: 200 }], offset: 0 });
    expect(Object.isFrozen(wander)).toBe(true);
    expect(Object.isFrozen(wander.points)).toBe(true);
    expect(Object.isFrozen(wander.points[0])).toBe(true);
    const eight = Array.from({ length: 8 }, (_, i) => [400 + (i % 2) * 120, 200] as const);
    expect(tadpoleWander(rule, eight, 0).points).toHaveLength(8);
    expect(() => tadpoleWander(rule, [[400, 200]], 0)).toThrow(RangeError);
    expect(() => tadpoleWander(rule, [], 0)).toThrow(RangeError);
    expect(() => tadpoleWander(rule, [...eight, [400, 200]], 0)).toThrow(RangeError);
  });

  it('takes legs of 1.5 to 5 s at its speed and refuses others', () => {
    expect(TADPOLES.minLegSeconds).toBe(1.5);
    expect(TADPOLES.maxLegSeconds).toBe(5);
    expect(tadpoleWander(rule, [[400, 200], [490, 200]], 0).points[1].x).toBe(490);
    expect(tadpoleWander(rule, [[400, 200], [400, 500]], 0).points[1].y).toBe(500);
    expect(() => tadpoleWander(rule, [[400, 200], [489.9, 200]], 0)).toThrow(RangeError);
    expect(() => tadpoleWander(rule, [[400, 200], [400, 500.1]], 0)).toThrow(RangeError);
    expect(() => tadpoleWander(rule, [[400, 200], [600, 200], [600, 280], [400, 280]], 0)).toThrow(RangeError);
  });

  it('takes a lap of up to 40 s', () => {
    expect(TADPOLES.maxLapSeconds).toBe(40);
    const longest = Array.from({ length: 8 }, (_, i) => [400 + (i % 2) * 300, 200] as const);
    expect(tadpoleWander(rule, longest, 39.999).offset).toBe(39.999);
  });

  it('takes an offset in [0, lap) only', () => {
    expect(tadpoleWander(rule, [[400, 200], [520, 200]], 3.999).offset).toBe(3.999);
    expect(() => tadpoleWander(rule, [[400, 200], [520, 200]], -0.001)).toThrow(RangeError);
    expect(() => tadpoleWander(rule, [[400, 200], [520, 200]], 4)).toThrow(RangeError);
  });

  it('refuses a value that is not finite or a rule outside its limits', () => {
    expect(() => tadpoleWander(rule, [[Number.NaN, 200], [520, 200]], 0)).toThrow(RangeError);
    expect(() => tadpoleWander(rule, [[400, 200], [520, Infinity]], 0)).toThrow(RangeError);
    expect(() => tadpoleWander(rule, [[400, 200], [520, 200]], Number.NaN)).toThrow(RangeError);
    expect(() => tadpoleWander({ speed: 90 }, [[400, 200], [520, 200]], 0)).toThrow(RangeError);
  });

  it.each(AREA_NUMBERS)('takes the Area %i default 2-point loops with spread offsets', (area) => {
    const wanders = spreadWanders(tadpoleRule(TADPOLE_SPEEDS[area]), COUNTS[area][2]);
    expect(wanders).toHaveLength(COUNTS[area][2]);
    expect(wanders.every((wander) => wander.points.length === 2)).toBe(true);
  });
});

describe('shrimpHome (issue #131, ND-5, ND-13)', () => {
  it('takes 1 to 6 [x, y] hop spots, the first its start, and freezes them', () => {
    expect(SHRIMP.maxHomeSpots).toBe(6);
    const home = shrimpHome([[500, 200], [540, 220]]);
    expect(home).toEqual({ points: [{ x: 500, y: 200 }, { x: 540, y: 220 }] });
    expect(Object.isFrozen(home)).toBe(true);
    expect(Object.isFrozen(home.points)).toBe(true);
    expect(shrimpHome([[500, 200]]).points).toHaveLength(1);
    const six = Array.from({ length: 6 }, (_, i) => [500 + 20 * i, 200] as const);
    expect(shrimpHome(six).points).toHaveLength(6);
    expect(() => shrimpHome([])).toThrow(RangeError);
    expect(() => shrimpHome([...six, [700, 200]])).toThrow(RangeError);
  });

  it('refuses a value that is not finite', () => {
    expect(() => shrimpHome([[Number.NaN, 200]])).toThrow(RangeError);
    expect(() => shrimpHome([[500, 200], [500, -Infinity]])).toThrow(RangeError);
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

describe('mobileSnackMix (ND-23; issue #131, ND-13)', () => {
  const tadpole = tadpoleRule(60);
  const wander = tadpoleWander(tadpole, [[400, 200], [520, 200]], 0);
  const home = shrimpHome([[500, 200]]);

  it('refuses wander loops without a tadpole rule and homes without a shrimp rule', () => {
    expect(() => mobileSnackMix({ wanders: [wander], homes: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ wanders: [], homes: [home] })).toThrow(RangeError);
  });

  it('checks every hand-written value against its limits', () => {
    expect(() => mobileSnackMix({ tadpole: { speed: 80 }, wanders: [], homes: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ tadpole, wanders: [{ ...wander, points: [{ x: 400, y: 200 }, { x: 800, y: 200 }] }], homes: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ tadpole, wanders: [{ ...wander, offset: 4 }], homes: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ tadpole, wanders: [{ points: [{ x: 400, y: 200 }], offset: 0 }], homes: [] })).toThrow(RangeError);
    const loose: ShrimpRule = { triggerRadius: 60, restFor: 0.5, flickDistance: 36, flickSpeed: 100 };
    expect(() => mobileSnackMix({ wanders: [], shrimp: loose, homes: [] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ wanders: [], shrimp: areaShrimp(5), homes: [{ points: [{ x: Number.NaN, y: 1 }] }] })).toThrow(RangeError);
    expect(() => mobileSnackMix({ wanders: [], shrimp: areaShrimp(5), homes: [{ points: [] }] })).toThrow(RangeError);
  });

  it('keeps a rule with no snacks, adds no key for a missing rule and freezes the mix', () => {
    const mix = mobileSnackMix({ tadpole, wanders: [], homes: [] });
    expect(mix).toStrictEqual({ tadpole: { speed: 60 }, wanders: [], homes: [] });
    expect(mix).not.toHaveProperty('shrimp');
    expect(Object.isFrozen(mix)).toBe(true);
    expect(Object.isFrozen(mix.wanders)).toBe(true);
    expect(Object.isFrozen(mix.homes)).toBe(true);
  });

  it('keeps the wander loops and homes it was given', () => {
    const mix = mobileSnackMix({ tadpole, wanders: [wander], shrimp: areaShrimp(5), homes: [home] });
    expect(mix.wanders).toEqual([wander]);
    expect(mix.homes).toEqual([home]);
  });

  it.each(AREA_NUMBERS)('takes the Area %i defaults', (area) => {
    const mix = areaMix(area);
    expect(mix.wanders).toHaveLength(COUNTS[area][2]);
    expect(mix.homes).toHaveLength(COUNTS[area][3]);
  });
});

/** The box from (x, y) to (x + dx, y + dy), whichever way it runs. */
function segmentBox(x: number, y: number, dx: number, dy: number) {
  return { kind: 'rect' as const, x0: Math.min(x, x + dx), x1: Math.max(x, x + dx), y0: Math.min(y, y + dy), y1: Math.max(y, y + dy) };
}

describe('leg and shrimp boxes (ND-26; issue #131, ND-7)', () => {
  it('boxes a shrimp by its drift and the snack bob', () => {
    const drift: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 10, periodY: 8 };
    expect(shrimpBox({ x: 500, y: 200 }, drift)).toEqual({ kind: 'rect', x0: 484, x1: 516, y0: 189.5, y1: 210.5 });
  });

  it('writes the same box as shrimpBox into the box it is given, over whatever it held (issue #139)', () => {
    const drifts: SnackDrift[] = [
      { amplitudeX: 16, amplitudeY: 8, periodX: 10, periodY: 8 },
      { amplitudeX: 0, amplitudeY: 0, periodX: 10, periodY: 8 },
      { amplitudeX: 3.5, amplitudeY: 12.25, periodX: 6, periodY: 9 },
    ];
    const spots: Point[] = [
      { x: 500, y: 200 },
      { x: -40.5, y: 1234.75 },
      { x: 0, y: 0 },
    ];
    const out: HazardRect = { kind: 'rect', x0: NaN, x1: Infinity, y0: -Infinity, y1: 7 };
    for (const drift of drifts) {
      for (const spot of spots) {
        expect(writeShrimpBox(spot, drift, out)).toBe(out);
        expect(out).toEqual(shrimpBox(spot, drift));
      }
    }
  });

  it('gives one box per tadpole leg and per shrimp hop leg, tadpoles first, and none for a 1-spot home', () => {
    const rule = tadpoleRule(60);
    const mix = mobileSnackMix({
      tadpole: rule,
      wanders: [tadpoleWander(rule, [[400, 200], [520, 200], [520, 320], [400, 320]], 0)],
      shrimp: areaShrimp(2),
      homes: [shrimpHome([[900, 200]]), shrimpHome([[1000, 200], [1060, 230], [1000, 250]])],
    });
    expect(mobileLegBoxes({ mobileSnacks: mix })).toEqual([
      segmentBox(400, 200, 120, 0),
      segmentBox(520, 200, 0, 120),
      segmentBox(520, 320, -120, 0),
      segmentBox(400, 320, 0, -120),
      segmentBox(1000, 200, 60, 30),
      segmentBox(1060, 230, -60, 20),
      segmentBox(1000, 250, 0, -50),
    ]);
  });

  it('gives a 2-point loop a box for each way and a zone without mobile snacks none', () => {
    const rule = tadpoleRule(60);
    const mix = mobileSnackMix({ tadpole: rule, wanders: [tadpoleWander(rule, [[400, 200], [520, 260]], 0)], homes: [] });
    expect(mobileLegBoxes({ mobileSnacks: mix })).toEqual([segmentBox(400, 200, 120, 60), segmentBox(400, 200, 120, 60)]);
    expect(mobileLegBoxes({})).toEqual([]);
    expect(mobileLegBoxes({ mobileSnacks: mobileSnackMix({ wanders: [], shrimp: areaShrimp(2), homes: [shrimpHome([[1, 1]])] }) })).toEqual([]);
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
    expect(avoid.hazards).toEqual([hazardSweep(net)]);
    expect(avoid.worms).toEqual([{ x: 5, y: 6 }]);
    expect(avoid.threats).toEqual(zoneThreats(zone));
    expect(mobileSnackAvoid(zone).worms).toEqual([]);
  });
});

describe('mobileSnackClear (ND-26)', () => {
  const open = mobileSnackAvoid(OPEN_ZONE);

  it('clears a box in open water', () => {
    expect(mobileSnackClear(pointBox(1400, 400), open)).toBe(true);
    expect(mobileSnackClear(segmentBox(1400, 400, 120, 40), open)).toBe(true);
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
    expect(mobileSnackClear(segmentBox(300, 400, 120, 0), open)).toBe(false);
    expect(mobileSnackClear(segmentBox(300.5, 400, 120, 0), open)).toBe(true);
  });

  it('keeps the box out of every current, the edge counting as inside', () => {
    const avoid = mobileSnackAvoid(zoneWith({ currents: [{ id: 'current-0', x0: 1500, x1: 1700, y0: 400, y1: 640, force: { x: -70, y: 0 } }] }));
    expect(mobileSnackClear(segmentBox(1380, 400, 120, 0), avoid)).toBe(false);
    expect(mobileSnackClear(segmentBox(1379.5, 399.5, 120, 0), avoid)).toBe(true);
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
    expect(mobileSnackClear(segmentBox(1400, 400, 120, 0), avoid)).toBe(true);
    expect(mobileSnackClear(segmentBox(1400, 400, 120.5, 0), avoid)).toBe(false);
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
    expect(mobileSnackClear(segmentBox(1300, 350, 160, 0), avoid)).toBe(false);
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

  it('measures a box crossing a loop as inside it', () => {
    const avoid = mobileSnackAvoid(zoneWith({ predatorRoutes: [{ id: 'carp-0', waypoints: LOOP, species: CARP_SPECIES }] }));
    expect(mobileSnackClear(segmentBox(1450, 100, 0, 160), avoid)).toBe(false);
    expect(mobileSnackClear(segmentBox(1450, 100, 0, 79.5), avoid)).toBe(true);
  });

  it('checks a shrimp box at its spot, drift and bob included', () => {
    const drift: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 };
    const avoid = mobileSnackAvoid(OPEN_ZONE, [{ x: 1600, y: 400 }]);
    expect(mobileSnackClear(shrimpBox({ x: 1504, y: 400 }, drift), avoid)).toBe(true);
    expect(mobileSnackClear(shrimpBox({ x: 1505, y: 400 }, drift), avoid)).toBe(false);
  });
});

describe('mobileSnackHardClear (issue #131, ND-7)', () => {
  const open = mobileSnackAvoid(OPEN_ZONE);

  it('clears a box in open water and keeps it inside the bounds, below the highest wave', () => {
    expect(mobileSnackHardClear(segmentBox(1400, 400, 120, 40), open)).toBe(true);
    expect(mobileSnackHardClear(pointBox(2840.5, 400), open)).toBe(false);
    expect(mobileSnackHardClear(pointBox(1400, 656.5), open)).toBe(false);
    const tall: MobileSnackAvoid = { ...open, bounds: { ...open.bounds, minY: 0 } };
    expect(mobileSnackHardClear(pointBox(1400, SURF + 2.3), tall)).toBe(false);
    expect(mobileSnackHardClear(pointBox(1400, SURF + 2.5), tall)).toBe(true);
  });

  it('keeps the box out of the Home Spot ring, the safe area and every current, edges counting as inside', () => {
    const ringOnly: MobileSnackAvoid = { ...open, safeArea: { x0: -10, x1: -5, y0: -10, y1: -5 } };
    expect(mobileSnackHardClear(pointBox(192, 200), ringOnly)).toBe(false);
    expect(mobileSnackHardClear(pointBox(192.5, 200), ringOnly)).toBe(true);
    expect(mobileSnackHardClear(segmentBox(300, 400, 120, 0), open)).toBe(false);
    expect(mobileSnackHardClear(segmentBox(300.5, 400, 120, 0), open)).toBe(true);
    const avoid = mobileSnackAvoid(zoneWith({ currents: [{ id: 'current-0', x0: 1500, x1: 1700, y0: 400, y1: 640, force: { x: -70, y: 0 } }] }));
    expect(mobileSnackHardClear(segmentBox(1380, 400, 120, 0), avoid)).toBe(false);
    expect(mobileSnackHardClear(segmentBox(1379.5, 399.5, 120, 0), avoid)).toBe(true);
  });

  it('keeps the box out of every mat sweep, with no clearance beyond it', () => {
    const avoid = mobileSnackAvoid(zoneWith({ elements: [MATS] }));
    expect(mobileSnackHardClear(pointBox(1060, 500), avoid)).toBe(false);
    expect(mobileSnackHardClear(pointBox(1060.5, 500), avoid)).toBe(true);
  });

  it('keeps the box 80 px from every plastic worm where it is now and every hazard by its sweep', () => {
    const wormed = mobileSnackAvoid(OPEN_ZONE, [{ x: 1600, y: 400 }]);
    expect(mobileSnackHardClear(segmentBox(1400, 400, 120, 0), wormed)).toBe(true);
    expect(mobileSnackHardClear(segmentBox(1400, 400, 120.5, 0), wormed)).toBe(false);
    const net: HazardSpawn = { id: 'net-0', type: SLOW_TYPE, shape: { kind: 'rect', x0: 1600, x1: 1640, y0: 380, y1: 420 }, drift: netDrift(-160, 0, 16, 0) };
    const netted = mobileSnackAvoid(zoneWith({ hazards: [net] }));
    expect(mobileSnackHardClear(pointBox(1360, 400), netted)).toBe(true);
    expect(mobileSnackHardClear(pointBox(1360.5, 400), netted)).toBe(false);
  });

  it('leaves moving hazards and predators to the threat rules', () => {
    const pole = movingHazardSpawn('dev/punting-pole-1', PUNTING_POLE, 1600, 0);
    const avoid = mobileSnackAvoid(zoneWith({ movingHazards: [pole], tilapiaRoutes: [{ id: 'tilapia-0', waypoints: LOOP }] }));
    expect(mobileSnackHardClear(pointBox(1600, 200), avoid)).toBe(true);
    expect(mobileSnackHardClear(pointBox(1450, 350), avoid)).toBe(true);
    expect(mobileSnackClear(pointBox(1600, 200), avoid)).toBe(false);
  });

  it('measures keepAway when an avoid has no hazard sweeps of its own', () => {
    const pole = movingHazardSpawn('dev/punting-pole-1', PUNTING_POLE, 1600, 0);
    const handWritten: MobileSnackAvoid = { ...mobileSnackAvoid(zoneWith({ movingHazards: [pole] })) };
    delete handWritten.hazards;
    expect(mobileSnackHardClear(pointBox(1515.5, 200), handWritten)).toBe(false);
    expect(mobileSnackHardClear(pointBox(1515, 200), handWritten)).toBe(true);
  });
});

/** A leg-costing spike at (x, y) with a 100 px reach: a shape threat, kept 80 px from by the hard rules. */
function spikeAt(id: string, x: number, y: number): HazardSpawn {
  return { id, type: LEG_TYPE, shape: { kind: 'circle', x, y, r: 0 } };
}

describe('tadpoleWanderClear (issue #131, ND-7)', () => {
  const rule = tadpoleRule(60);
  /** A 300 x 100 px box loop from (1000, 300): legs of 300, 100, 300 and 100 px, an 800 px lap. */
  const box = tadpoleWander(rule, [[1000, 300], [1300, 300], [1300, 400], [1000, 400]], 0);

  it('clears a loop in open water', () => {
    expect(TADPOLES.safeLoopShare).toBe(0.5);
    expect(tadpoleWanderClear(box, mobileSnackAvoid(OPEN_ZONE))).toBe(true);
  });

  it('holds every turn point and leg to the hard rules', () => {
    expect(tadpoleWanderClear(tadpoleWander(rule, [[300, 300], [450, 300]], 0), mobileSnackAvoid(OPEN_ZONE))).toBe(false);
    expect(tadpoleWanderClear(box, mobileSnackAvoid(OPEN_ZONE, [{ x: 1150, y: 479 }]))).toBe(false);
    expect(tadpoleWanderClear(box, mobileSnackAvoid(OPEN_ZONE, [{ x: 1150, y: 481 }]))).toBe(true);
    const inside = { id: 'current-0', x0: 1100, x1: 1200, y0: 340, y1: 360, force: { x: -70, y: 0 } };
    expect(tadpoleWanderClear(box, mobileSnackAvoid(zoneWith({ currents: [inside] })))).toBe(true);
    const across = { ...inside, y0: 280, y1: 320 };
    expect(tadpoleWanderClear(box, mobileSnackAvoid(zoneWith({ currents: [across] })))).toBe(false);
  });

  it('lets a threat reach part of the loop when its longest clear stretch is at least half the loop', () => {
    const avoid = mobileSnackAvoid(zoneWith({ hazards: [spikeAt('spikes-0', 1150, 210)] }));
    expect(avoid.threats).toHaveLength(1);
    expect(mobileSnackClear(segmentBox(1000, 300, 300, 0), avoid)).toBe(false);
    expect(tadpoleWanderClear(box, avoid)).toBe(true);
  });

  it('refuses a loop whose clear water is split into stretches each under half the loop', () => {
    const avoid = mobileSnackAvoid(zoneWith({ hazards: [spikeAt('spikes-0', 1150, 210), spikeAt('spikes-1', 1150, 490)] }));
    expect(tadpoleWanderClear(box, avoid)).toBe(false);
  });

  it('refuses a loop that is mostly within a predator\'s lunge range', () => {
    const route: PredatorRoute = { id: 'carp-0', waypoints: [{ x: 1050, y: 350 }, { x: 1250, y: 350 }], species: CARP_SPECIES };
    expect(tadpoleWanderClear(box, mobileSnackAvoid(zoneWith({ predatorRoutes: [route] })))).toBe(false);
    const far: PredatorRoute = { ...route, waypoints: [{ x: 2100, y: 350 }, { x: 2300, y: 350 }] };
    expect(tadpoleWanderClear(box, mobileSnackAvoid(zoneWith({ predatorRoutes: [far] })))).toBe(true);
  });

  it('counts a moving hazard in the threat rule only', () => {
    const pole = movingHazardSpawn('dev/punting-pole-1', PUNTING_POLE, 1150, 0);
    const loop = tadpoleWander(rule, [[1000, 200], [1300, 200], [1300, 300], [1000, 300]], 0);
    expect(tadpoleWanderClear(loop, mobileSnackAvoid(zoneWith({ movingHazards: [pole] })))).toBe(true);
    const crossed = tadpoleWander(rule, [[1060, 150], [1240, 150], [1240, 240], [1060, 240]], 0);
    expect(tadpoleWanderClear(crossed, mobileSnackAvoid(zoneWith({ movingHazards: [pole] })))).toBe(false);
  });
});

describe('shrimpHomeClear (issue #131, ND-7)', () => {
  const drift: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 };
  const tilapia = mobileSnackAvoid(zoneWith({ tilapiaRoutes: [{ id: 'tilapia-0', waypoints: LOOP }] }));

  it('clears a home in open water, and a 1-spot home only out of every threat\'s reach', () => {
    expect(SHRIMP.safeSpotShare).toBe(0.5);
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [1950, 380], [1900, 400]]), drift, mobileSnackAvoid(OPEN_ZONE))).toBe(true);
    expect(shrimpHomeClear(shrimpHome([[1900, 350]]), drift, tilapia)).toBe(true);
    expect(shrimpHomeClear(shrimpHome([[1640, 350]]), drift, tilapia)).toBe(false);
  });

  it('needs at least half its hop spots, drift and bob included, out of every threat\'s reach', () => {
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [1950, 350], [1600, 350], [1620, 350]]), drift, tilapia)).toBe(true);
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [1600, 350], [1620, 350], [1640, 350]]), drift, tilapia)).toBe(false);
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [1656, 350]]), drift, tilapia)).toBe(true);
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [1656, 350], [1655, 380]]), drift, tilapia)).toBe(false);
  });

  it('holds every hop spot\'s drift-and-bob box and every hop leg to the hard rules', () => {
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [316, 350]]), drift, mobileSnackAvoid(OPEN_ZONE))).toBe(false);
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [317, 350]]), drift, mobileSnackAvoid(OPEN_ZONE))).toBe(true);
    const current = { id: 'current-0', x0: 1990, x1: 2010, y0: 300, y1: 320, force: { x: -70, y: 0 } };
    const crossed = mobileSnackAvoid(zoneWith({ currents: [current] }));
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [2100, 350]]), drift, crossed)).toBe(true);
    expect(shrimpHomeClear(shrimpHome([[1900, 350], [2100, 290]]), drift, crossed)).toBe(false);
  });

  it('holds every hop leg\'s whole glide, drift and bob included, to the hard rules', () => {
    const current = { id: 'current-0', x0: 1990, x1: 2010, y0: 300, y1: 320, force: { x: -70, y: 0 } };
    const crossed = mobileSnackAvoid(zoneWith({ currents: [current] }));
    expect(mobileSnackHardClear(segmentBox(1900, 325, 200, 0), crossed)).toBe(true);
    expect(shrimpHomeClear(shrimpHome([[1900, 325], [2100, 325]]), drift, crossed)).toBe(false);
    expect(shrimpHomeClear(shrimpHome([[1900, 331], [2100, 331]]), drift, crossed)).toBe(true);
  });
});

describe('shrimpGlideClear (issue #131, ND-7)', () => {
  const drift: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 };
  const open = mobileSnackAvoid(OPEN_ZONE);
  const from: Point = { x: 1400, y: 400 };
  const to: Point = { x: 1600, y: 400 };

  /** Whether the shrimpBox at each end of the glide from `a` to `b` meets the hard rules. */
  function endsClear(a: Point, b: Point, avoid: MobileSnackAvoid): boolean {
    return mobileSnackHardClear(shrimpBox(a, drift), avoid) && mobileSnackHardClear(shrimpBox(b, drift), avoid);
  }

  it('clears a glide in open water, and a glide that does not move just where the shrimpBox meets the hard rules', () => {
    expect(shrimpGlideClear(from, { x: 1440, y: 430 }, drift, open)).toBe(true);
    const ringOnly: MobileSnackAvoid = { ...open, safeArea: { x0: -10, x1: -5, y0: -10, y1: -5 } };
    const current = { id: 'current-0', x0: 1500, x1: 1700, y0: 400, y1: 640, force: { x: -70, y: 0 } };
    const net: HazardSpawn = { id: 'net-0', type: SLOW_TYPE, shape: { kind: 'rect', x0: 1600, x1: 1640, y0: 380, y1: 420 }, drift: netDrift(-160, 0, 16, 0) };
    const avoids = [open, ringOnly, mobileSnackAvoid(zoneWith({ currents: [current], elements: [MATS], hazards: [net, spikeAt('spikes-0', 2200, 300)] }))];
    const places: Point[] = [
      { x: 316, y: 350 },
      { x: 317, y: 350 },
      { x: 1400, y: 104 },
      { x: 1400, y: 104.5 },
      { x: 2824, y: 400 },
      { x: 2824.5, y: 400 },
      { x: 208, y: 200 },
      { x: 208.5, y: 200 },
      { x: 1484, y: 500 },
      { x: 1483.5, y: 500 },
      { x: 1076, y: 500 },
      { x: 1076.5, y: 500 },
      { x: 1360, y: 400 },
      { x: 1344, y: 400 },
      { x: 2200, y: 390 },
      { x: 2200, y: 390.5 },
    ];
    for (const avoid of avoids) {
      for (const place of places) {
        expect(shrimpGlideClear(place, place, drift, avoid), `${place.x}, ${place.y}`).toBe(mobileSnackHardClear(shrimpBox(place, drift), avoid));
      }
    }
  });

  it('refuses a glide whose ends are clear but whose way crosses a current, a mat sweep, the safe area or the Home Spot ring', () => {
    const current = { id: 'current-0', x0: 1490, x1: 1510, y0: 380, y1: 420, force: { x: -70, y: 0 } };
    const currented = mobileSnackAvoid(zoneWith({ currents: [current] }));
    expect(endsClear(from, to, currented)).toBe(true);
    expect(shrimpGlideClear(from, to, drift, currented)).toBe(false);
    expect(shrimpGlideClear({ x: 1400, y: 369 }, { x: 1600, y: 369 }, drift, currented)).toBe(true);
    expect(shrimpGlideClear({ x: 1400, y: 369.5 }, { x: 1600, y: 369.5 }, drift, currented)).toBe(false);
    const matted = mobileSnackAvoid(zoneWith({ elements: [MATS] }));
    expect(endsClear({ x: 940, y: 500 }, { x: 1120, y: 500 }, matted)).toBe(true);
    expect(shrimpGlideClear({ x: 940, y: 500 }, { x: 1120, y: 500 }, drift, matted)).toBe(false);
    const safe: MobileSnackAvoid = { ...open, safeArea: { x0: 1490, x1: 1510, y0: 380, y1: 420 } };
    expect(endsClear(from, to, safe)).toBe(true);
    expect(shrimpGlideClear(from, to, drift, safe)).toBe(false);
    const ringOnly: MobileSnackAvoid = { ...open, safeArea: { x0: -10, x1: -5, y0: -10, y1: -5 } };
    expect(endsClear({ x: 200, y: 110 }, { x: 200, y: 290 }, ringOnly)).toBe(true);
    expect(shrimpGlideClear({ x: 200, y: 110 }, { x: 200, y: 290 }, drift, ringOnly)).toBe(false);
  });

  it('keeps the whole way 80 px from every hazard by its sweep, measured on the way and not on its box', () => {
    const near = mobileSnackAvoid(zoneWith({ hazards: [spikeAt('spikes-0', 1500, 490)] }));
    expect(endsClear(from, to, near)).toBe(true);
    expect(shrimpGlideClear(from, to, drift, near)).toBe(false);
    expect(shrimpGlideClear(from, to, drift, mobileSnackAvoid(zoneWith({ hazards: [spikeAt('spikes-0', 1500, 490.5)] })))).toBe(true);
    const rock: HazardSpawn = { id: 'rock-0', type: SLOW_TYPE, shape: { kind: 'rect', x0: 680, x1: 900, y0: 420, y1: 480 } };
    const rocky = mobileSnackAvoid(zoneWith({ hazards: [rock] }));
    const slantFrom: Point = { x: 560, y: 470 };
    const slantTo: Point = { x: 586, y: 524 };
    expect(mobileSnackHardClear({ kind: 'rect', x0: 544, x1: 602, y0: 459.5, y1: 534.5 }, rocky)).toBe(false);
    expect(shrimpGlideClear(slantFrom, slantTo, drift, rocky)).toBe(true);
  });

  it('leaves the plastic worms where they are now to the landing, so a shrimp can glide away from one', () => {
    const wormed = mobileSnackAvoid(OPEN_ZONE, [{ x: 1500, y: 400 }]);
    expect(mobileSnackHardClear(shrimpBox({ x: 1500, y: 400 }, drift), wormed)).toBe(false);
    expect(shrimpGlideClear(from, to, drift, wormed)).toBe(true);
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
    expect(snackTopSpeed(mobileSnackMix({ tadpole: tadpoleRule(48), wanders: spreadWanders(tadpoleRule(48), 1), homes: [] }))).toBe(48);
    const shrimpOnly = mobileSnackMix({ wanders: [], shrimp, homes: [shrimpHome([[1, 1]])] });
    expect(snackTopSpeed(shrimpOnly)).toBeCloseTo(60 / (1.2 + 60 / 145), 12);
    expect(snackTopSpeed(mobileSnackMix({ tadpole: tadpoleRule(60), wanders: [], homes: [] }))).toBe(0);
  });

  it.each(AREA_NUMBERS)('pulls at the Area %i value', (area) => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, { mobileSnacks: areaMix(area) })).toBe(PULLS[area]);
  });

  it('pulls at max(40, 1.2 x the fastest top speed)', () => {
    for (let speed = 0.5; speed <= TADPOLES.maxSpeed; speed += 0.5) {
      const rule = tadpoleRule(speed);
      const wanders = [tadpoleWander(rule, [[400, 200], [400 + 3 * speed, 200]], 0)];
      const pull = snackMagnetSpeed(40, { mobileSnacks: mobileSnackMix({ tadpole: rule, wanders, homes: [] }) });
      expect(pull).toBeCloseTo(Math.max(40, 1.2 * speed), 9);
      expect(pull).toBeLessThan(90);
    }
  });

  it('stays under 90 px/s for the fastest shrimp the limits allow', () => {
    const fastest = shrimpRule(60, SHRIMP.minRest, 46, SHRIMP.maxFlickSpeed);
    const pull = snackMagnetSpeed(40, { mobileSnacks: mobileSnackMix({ wanders: [], shrimp: fastest, homes: [shrimpHome([[1, 1]])] }) });
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
    const mix = mobileSnackMix({ tadpole: rule, wanders: [tadpoleWander(rule, [[x, 400], [x + dx, 400 + dy]], 0)], homes: [] });
    const pull = snackMagnetSpeed(40, { mobileSnacks: mix });
    expect(pull).toBeCloseTo(86.4, 9);
    const head = { x: 300, y: 400 };
    const dt = 1 / 60;
    const wander = snackWander([{ x, y: 400 }, { x: x + dx, y: 400 + dy }], speed, 0);
    let items: Collectible[] = createCollectibles([{ id: 'snack-tadpole-1', kind: 'tadpole', x, y: 400, wander }]);
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
  it('gives Areas 1, 2, 6, 7 and 8 none', () => {
    for (const area of AREAS.filter((each) => !each.snackDart)) {
      expect(oneTimeDarts(area, buildZone(area.layout, 3))).toBeNull();
    }
    expect(AREAS.filter((each) => !each.snackDart).map((each) => each.number)).toEqual([1, 2, 6, 7, 8]);
  });

  it.each(SEEDS)('gives Areas 3, 4 and 5 exactly today\'s darters, or none once the area has shrimp, for seed %i', (seed) => {
    const darted = AREAS.filter((each) => each.snackDart);
    expect(darted.map((each) => each.number)).toEqual([3, 4, 5]);
    for (const area of darted) {
      const zone = buildZone(area.layout, seed);
      const hasShrimp = (area.layout.mobileSnacks?.homes.length ?? 0) > 0;
      expect(oneTimeDarts(area, zone)).toEqual(hasShrimp ? null : createSnackDarts(zone.collectibles, SNACK_DART));
    }
  });

  it.each(SEEDS)('picks the darters from the worms and bugs only for seed %i', (seed) => {
    const rule = tadpoleRule(60);
    const wanders = [tadpoleWander(rule, [[400, 200], [520, 200]], 0), tadpoleWander(rule, [[1500, 200], [1620, 200]], 2)];
    const zone = buildZone({ ...CANAL_LAYOUT, mobileSnacks: mobileSnackMix({ tadpole: rule, wanders, homes: [] }) }, seed);
    const seeded = buildZone(CANAL_LAYOUT, seed).collectibles;
    const darts = oneTimeDarts({ snackDart: SNACK_DART }, zone);
    expect(darts).toEqual(createSnackDarts(seeded, SNACK_DART));
    expect(darts?.waiting.some((id) => id.startsWith('snack-tadpole'))).toBe(false);
  });

  it('gives none when the zone has shrimp', () => {
    const mix = mobileSnackMix({ wanders: [], shrimp: areaShrimp(3), homes: [shrimpHome([[600, 200]])] });
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
    { id: 'snack-tadpole-1', kind: 'tadpole', x: 1100, y: 300, wander: snackWander([{ x: 1100, y: 300 }, { x: 1220, y: 300 }], 60, 0) },
    { id: 'snack-tadpole-2', kind: 'tadpole', x: 2000, y: 300, wander: snackWander([{ x: 2000, y: 300 }, { x: 2000, y: 420 }], 60, 0) },
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

/** A shrimp pose state with no flick, no rest after a flick and no hop yet. */
const STILL: Readonly<ShrimpPoseState> = Object.freeze({ flicking: false, afterFlick: false, hopSign: 0 });
/** A shrimp pose state with a flick under way. */
const FLICKING: Readonly<ShrimpPoseState> = Object.freeze({ flicking: true, afterFlick: false, hopSign: 0 });

describe('mobileSnackPose (ND-24, ND-25, ND-30; issue #131, ND-4)', () => {
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
    wander: snackWander([{ x: 1000, y: 300 }, { x: 1000 + dx, y: 300 + dy }], 60, 0),
  });
  const scene = (clock: number, reduced = false, head: Point = { x: 0, y: 0 }) => ({ clock, reduced, head });
  const pose = (): MobileSnackPose => ({ frame: -1, facing: 1, sway: 99, tilt: 99 });

  it('faces a tadpole along the leg it swims now, +1 on a vertical leg', () => {
    expect(mobileSnackPose(tadpole(120, 0), 0, frameAt(1), scene(0), STILL, pose()).facing).toBe(1);
    expect(mobileSnackPose(tadpole(120, 0), 0, frameAt(3), scene(0), STILL, pose()).facing).toBe(-1);
    expect(mobileSnackPose(tadpole(-120, 0), 0, frameAt(1), scene(0), STILL, pose()).facing).toBe(-1);
    expect(mobileSnackPose(tadpole(-120, 0), 0, frameAt(3), scene(0), STILL, pose()).facing).toBe(1);
    expect(mobileSnackPose(tadpole(0, 120), 0, frameAt(1), scene(0), STILL, pose()).facing).toBe(1);
    expect(mobileSnackPose(tadpole(0, 120), 0, frameAt(3), scene(0), FLICKING, pose()).facing).toBe(1);
  });

  it('turns a tadpole to face each new leg of a longer loop', () => {
    const item: Collectible = {
      id: 'snack-tadpole-1',
      kind: 'tadpole',
      x: 1000,
      y: 300,
      collected: false,
      wander: snackWander([{ x: 1000, y: 300 }, { x: 1120, y: 300 }, { x: 1120, y: 420 }, { x: 960, y: 360 }], 60, 0),
    };
    const facings = [1, 3, 5, 7].map((t) => mobileSnackPose(item, 0, frameAt(t), scene(0), STILL, pose()).facing);
    expect(facings).toEqual([1, 1, -1, 1]);
  });

  it('shows a tadpole\'s 4 tail frames at 8 a second, swaying up to 8 degrees', () => {
    const frames = [0, 0.125, 0.25, 0.375, 0.5, 0.625].map((clock) => mobileSnackPose(tadpole(120, 0), 0, frameAt(1), scene(clock), STILL, pose()).frame);
    expect(frames).toEqual([0, 1, 2, 3, 0, 1]);
    let widest = 0;
    for (let clock = 0; clock < 2; clock += 0.01) {
      const sway = mobileSnackPose(tadpole(120, 0), 0, frameAt(1), scene(clock), STILL, pose()).sway;
      expect(Math.abs(sway)).toBeLessThanOrEqual(TADPOLE_SWAY + 1e-12);
      widest = Math.max(widest, Math.abs(sway));
    }
    expect(TADPOLE_SWAY).toBeCloseTo((8 * Math.PI) / 180, 12);
    expect(widest).toBeGreaterThan(TADPOLE_SWAY * 0.99);
  });

  it('shows a tadpole\'s frame 0 with no sway under reduced motion, facing as without it', () => {
    for (let clock = 0; clock < 2; clock += 0.07) {
      const still = mobileSnackPose(tadpole(120, 0), 0, frameAt(3), scene(clock, true), STILL, pose());
      expect(still).toMatchObject({ frame: 0, facing: -1, sway: 0 });
      expect(still.tilt).toBeCloseTo(0, 12);
    }
  });

  it('faces a shrimp toward the head, so its flick goes backward, with its rest or flick frame', () => {
    const shrimp = createCollectibles([{ id: 'snack-shrimp-1', kind: 'shrimp', x: 1000, y: 300 }])[0];
    const x = drawnSnackX(shrimp, 0, frameAt(1));
    expect(mobileSnackPose(shrimp, 0, frameAt(1), scene(0, false, { x: x - 50, y: 300 }), STILL, pose())).toEqual({ frame: SHRIMP_REST_FRAME, facing: -1, sway: 0, tilt: 0 });
    expect(mobileSnackPose(shrimp, 0, frameAt(1), scene(0, false, { x: x + 50, y: 300 }), FLICKING, pose())).toEqual({ frame: SHRIMP_FLICK_FRAME, facing: 1, sway: 0, tilt: 0 });
    expect(mobileSnackPose(shrimp, 0, frameAt(1), scene(0, false, { x, y: 200 }), STILL, pose()).facing).toBe(1);
    expect(mobileSnackPose(shrimp, 0, frameAt(1), scene(0, true, { x: x + 50, y: 300 }), FLICKING, pose()).frame).toBe(SHRIMP_REST_FRAME);
    expect(SHRIMP_REST_FRAME).not.toBe(SHRIMP_FLICK_FRAME);
  });

  it('gives a worm or bug frame 0, facing +1, no sway and no tilt, written into the pose it was given', () => {
    const out = pose();
    const worm = createCollectibles([{ id: 'snack-0', kind: 'worm', x: 1000, y: 300 }])[0];
    expect(mobileSnackPose(worm, 0, frameAt(1), scene(0.3), FLICKING, out)).toBe(out);
    expect(out).toEqual({ frame: 0, facing: 1, sway: 0, tilt: 0 });
  });
});

describe('shrimp facing and frames (issue #131, ND-10, ND-11)', () => {
  const frameAt = (driftT: number): SnackFrame => ({
    driftT,
    bobT: driftT,
    bobbing: true,
    drift: { amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 },
    bounds: { minX: 40, maxX: 2840, minY: 94, maxY: 656 },
  });
  const frame = frameAt(1);
  const shrimp = createCollectibles([{ id: 'snack-shrimp-1', kind: 'shrimp', x: 1000, y: 300 }])[0];
  const drawnX = drawnSnackX(shrimp, 0, frame);
  const drawnY = drawnSnackY(shrimp, 0, frame);
  /** A scene with the head `dx` px to the side of the drawn shrimp (and `dy` below it). */
  const headAt = (dx: number, dy = 0, reduced = false) => ({ clock: 0.3, reduced, head: { x: drawnX + dx, y: drawnY + dy } });
  const state = (flicking: boolean, afterFlick: boolean, hopSign: -1 | 0 | 1): ShrimpPoseState => ({ flicking, afterFlick, hopSign });
  const pose = (): MobileSnackPose => ({ frame: -1, facing: 1, sway: 99, tilt: 99 });
  const poseOf = (dx: number, shrimpState: Readonly<ShrimpPoseState>, dy = 0, reduced = false): MobileSnackPose =>
    mobileSnackPose(shrimp, 0, frame, headAt(dx, dy, reduced), shrimpState, pose());

  it('faces the head while the head is within the 120 px hold distance, edge included, whatever its last hop', () => {
    expect(SHRIMP.holdDistance).toBe(120);
    expect(poseOf(-SHRIMP.holdDistance, state(false, false, 1)).facing).toBe(-1);
    expect(poseOf(SHRIMP.holdDistance, state(false, false, -1)).facing).toBe(1);
    expect(poseOf(72, state(false, false, -1), 96).facing).toBe(1);
    expect(poseOf(-30, state(false, false, 1)).facing).toBe(-1);
  });

  it('faces the x sign of its last hop once the head is farther than 120 px', () => {
    expect(poseOf(-(SHRIMP.holdDistance + 0.5), state(false, false, 1)).facing).toBe(1);
    expect(poseOf(SHRIMP.holdDistance + 0.5, state(false, false, -1)).facing).toBe(-1);
    expect(poseOf(73, state(false, false, -1), 96).facing).toBe(-1);
    expect(poseOf(-400, state(false, false, -1)).facing).toBe(-1);
  });

  it('faces the head during a flick and during the rest after it, however far the head is', () => {
    expect(poseOf(400, state(true, false, -1)).facing).toBe(1);
    expect(poseOf(-400, state(true, false, 1)).facing).toBe(-1);
    expect(poseOf(400, state(false, true, -1)).facing).toBe(1);
    expect(poseOf(-400, state(false, true, 1)).facing).toBe(-1);
  });

  it('faces the head when it has not hopped, so a 1-spot home looks as before, +1 straight above or below', () => {
    expect(poseOf(-400, STILL).facing).toBe(-1);
    expect(poseOf(400, STILL).facing).toBe(1);
    expect(poseOf(0, STILL, -400).facing).toBe(1);
    expect(poseOf(0, state(false, false, -1), -400).facing).toBe(-1);
  });

  it('shows the flick frame only while flicking: the rest frame at rest, after a flick and while hopping', () => {
    expect(poseOf(40, state(true, false, 0))).toEqual({ frame: SHRIMP_FLICK_FRAME, facing: 1, sway: 0, tilt: 0 });
    expect(poseOf(40, state(true, false, -1)).frame).toBe(SHRIMP_FLICK_FRAME);
    expect(poseOf(40, STILL)).toEqual({ frame: SHRIMP_REST_FRAME, facing: 1, sway: 0, tilt: 0 });
    expect(poseOf(40, state(false, true, 0)).frame).toBe(SHRIMP_REST_FRAME);
    expect(poseOf(400, state(false, false, -1))).toEqual({ frame: SHRIMP_REST_FRAME, facing: -1, sway: 0, tilt: 0 });
  });

  it('shows the rest frame under reduced motion, facing as without it', () => {
    for (const shrimpState of [STILL, FLICKING, state(false, true, 1), state(false, false, -1), state(true, false, 1)]) {
      for (const dx of [-400, -60, 60, 400]) {
        const still = poseOf(dx, shrimpState, 0, true);
        expect(still.frame).toBe(SHRIMP_REST_FRAME);
        expect(still.facing).toBe(poseOf(dx, shrimpState).facing);
      }
    }
  });

  it('reads its pose state from the trip\'s flick state through the shrimpFlick queries', () => {
    const rule = shrimpRule(60, 2.0, 36, 100);
    const fresh = createShrimpFlicks([shrimp], rule);
    const readState = (flicks: ShrimpFlickState): ShrimpPoseState => ({
      flicking: isShrimpFlicking(flicks, shrimp.id),
      afterFlick: isShrimpRestingAfterFlick(flicks, shrimp.id),
      hopSign: readShrimpHopSign(flicks, shrimp.id),
    });
    expect(poseOf(-400, readState(fresh)).facing).toBe(-1);
    const hopped: ShrimpFlickState = { ...fresh, resting: [{ id: shrimp.id, readyAt: 5, next: 0, hopSign: 1, afterFlick: false }] };
    expect(poseOf(-400, readState(hopped)).facing).toBe(1);
    expect(poseOf(-100, readState(hopped)).facing).toBe(-1);
    const hopping: ShrimpFlickState = { ...fresh, resting: [], hops: [{ id: shrimp.id, restX: -10, restY: 0, next: 1, hopSign: -1 }] };
    expect(poseOf(400, readState(hopping))).toMatchObject({ frame: SHRIMP_REST_FRAME, facing: -1 });
    const flicking: ShrimpFlickState = { ...fresh, resting: [], flicks: [{ id: shrimp.id, restX: 30, restY: 0, next: 0, hopSign: -1 }] };
    expect(poseOf(-400, readState(flicking))).toMatchObject({ frame: SHRIMP_FLICK_FRAME, facing: -1 });
    const rested: ShrimpFlickState = { ...fresh, resting: [{ id: shrimp.id, readyAt: 5, next: 0, hopSign: 1, afterFlick: true }] };
    expect(poseOf(-400, readState(rested))).toMatchObject({ frame: SHRIMP_REST_FRAME, facing: -1 });
  });

  it('writes every shrimp pose into the one it was given and changes neither the snack nor the state', () => {
    Object.freeze(shrimp);
    const shrimpState = Object.freeze(state(false, false, -1));
    const out = pose();
    for (let t = 0; t < 8; t += 0.05) {
      const scene = { clock: t, reduced: t > 4, head: { x: drawnX + 300 * Math.cos(t), y: drawnY + 100 * Math.sin(t) } };
      expect(mobileSnackPose(shrimp, 0, frameAt(t), scene, shrimpState, out)).toBe(out);
    }
    expect(Object.keys(out).sort()).toEqual(['facing', 'frame', 'sway', 'tilt']);
    expect(shrimpState).toEqual({ flicking: false, afterFlick: false, hopSign: -1 });
  });
});

describe('tadpole tilt and facing (issue #131, ND-4, ND-10, ND-11)', () => {
  const frameAt = (driftT: number): SnackFrame => ({
    driftT,
    bobT: driftT,
    bobbing: true,
    drift: { amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 },
    bounds: { minX: 40, maxX: 2840, minY: 94, maxY: 656 },
  });
  const scene = (clock: number, reduced = false) => ({ clock, reduced, head: { x: 0, y: 0 } });
  const pose = (): MobileSnackPose => ({ frame: -1, facing: 1, sway: 99, tilt: 99 });
  /** A tadpole on the loop through `pairs` at `speed` px/s, stored at the first point. */
  const tadpoleOn = (pairs: readonly (readonly [number, number])[], speed = 60): Collectible => {
    const points = pairs.map(([x, y]) => ({ x, y }));
    return { id: 'snack-tadpole-1', kind: 'tadpole', x: points[0].x, y: points[0].y, collected: false, wander: snackWander(points, speed, 0) };
  };
  const poseAt = (item: Collectible, driftT: number, reduced = false): MobileSnackPose =>
    mobileSnackPose(item, 0, frameAt(driftT), scene(0.3, reduced), STILL, pose());

  it('tilts to the leg\'s angle from level with the head along the leg in both facings', () => {
    for (const degrees of [-35, -20, -5, 0, 10, 30]) {
      const angle = (degrees * Math.PI) / 180;
      for (const side of [1, -1]) {
        const dx = side * 120 * Math.cos(angle);
        const dy = 120 * Math.sin(angle);
        const out = poseAt(tadpoleOn([[1000, 300], [1000 + dx, 300 + dy]]), 1);
        expect(out.facing).toBe(side);
        expect(out.facing * Math.cos(out.tilt)).toBeCloseTo(dx / 120, 9);
        expect(out.facing * Math.sin(out.tilt)).toBeCloseTo(dy / 120, 9);
      }
    }
  });

  it('holds the tilt to 40 degrees either way, head still down a falling leg and up a rising one', () => {
    expect(TADPOLE_MAX_TILT).toBeCloseTo((40 * Math.PI) / 180, 12);
    const steep = tadpoleOn([[1000, 300], [1040, 420]]);
    const down = poseAt(steep, 1);
    expect(down).toMatchObject({ facing: 1 });
    expect(down.tilt).toBeCloseTo(TADPOLE_MAX_TILT, 12);
    const up = poseAt(steep, 3);
    expect(up).toMatchObject({ facing: -1 });
    expect(up.tilt).toBeCloseTo(TADPOLE_MAX_TILT, 12);
    expect(up.facing * Math.sin(up.tilt)).toBeLessThan(0);
    const vertical = poseAt(tadpoleOn([[1000, 300], [1000, 420]]), 1);
    expect(vertical.facing).toBe(1);
    expect(vertical.tilt).toBeCloseTo(TADPOLE_MAX_TILT, 12);
  });

  /** A level leg of 2 s at 60 px/s, then a 30 degree falling leg of 2 s from t = 2, then back. */
  const corner = tadpoleOn([[1000, 300], [1120, 300], [1120 + 120 * Math.cos(Math.PI / 6), 360]]);

  it('eases to the new leg\'s tilt over 0.25 s after each corner', () => {
    expect(TADPOLE_TURN_SECONDS).toBe(0.25);
    const fall = Math.PI / 6;
    expect(poseAt(corner, 1.99).tilt).toBeCloseTo(0, 12);
    expect(poseAt(corner, 2).tilt).toBeCloseTo(0, 9);
    expect(poseAt(corner, 2.125).tilt).toBeCloseTo(fall / 2, 9);
    expect(poseAt(corner, 2.25).tilt).toBeCloseTo(fall, 9);
    expect(poseAt(corner, 3).tilt).toBeCloseTo(fall, 12);
    let last = -Infinity;
    for (let t = 2; t <= 2.25; t += 0.01) {
      const tilt = poseAt(corner, t).tilt;
      expect(tilt).toBeGreaterThanOrEqual(last - 1e-12);
      expect(tilt).toBeLessThanOrEqual(fall + 1e-12);
      last = tilt;
    }
  });

  it('changes the tilt at once under reduced motion, with tail frame 0 and no sway', () => {
    for (const t of [2, 2.05, 2.125, 2.2]) {
      const still = poseAt(corner, t, true);
      expect(still).toMatchObject({ frame: 0, facing: 1, sway: 0 });
      expect(still.tilt).toBeCloseTo(Math.PI / 6, 9);
    }
  });

  it('flips at the corner, and keeps its facing on a near-vertical leg', () => {
    const loop = tadpoleOn([[1000, 300], [1120, 300], [1100, 420], [980, 360], [985, 250]]);
    expect([1, 3, 5.2, 7.2, 8.5].map((t) => poseAt(loop, t).facing)).toEqual([1, 1, -1, -1, 1]);
    expect(poseAt(loop, 7.2).facing * Math.sin(poseAt(loop, 7.2).tilt)).toBeLessThan(0);
  });

  it('counts a leg as near-vertical only when its sideways part is under a quarter of its length', () => {
    expect(poseAt(tadpoleOn([[1100, 300], [980, 300], [1009, 416]]), 2.5).facing).toBe(-1);
    expect(poseAt(tadpoleOn([[1100, 300], [980, 300], [1011, 416]]), 2.5).facing).toBe(1);
  });

  it('faces +1 when every leg is near-vertical', () => {
    const loop = tadpoleOn([[1000, 300], [1010, 420]]);
    expect([1, 3].map((t) => poseAt(loop, t).facing)).toEqual([1, 1]);
  });

  it('keeps the place exactly on the loop, the pose changing only the drawing', () => {
    const frame = frameAt(2.125);
    expect(drawnSnackX(corner, 0, frame)).toBeCloseTo(1120 + 7.5 * Math.cos(Math.PI / 6), 9);
    expect(drawnSnackY(corner, 0, frame)).toBeCloseTo(300 + 7.5 * Math.sin(Math.PI / 6), 9);
  });

  it('writes every pose into the one it was given and changes nothing on the snack', () => {
    const item = tadpoleOn([[1000, 300], [1120, 300], [1100, 420], [980, 360]]);
    Object.freeze(item);
    Object.freeze(item.wander);
    const out = pose();
    for (let t = 0; t < 12; t += 0.05) {
      expect(mobileSnackPose(item, 0, frameAt(t), scene(t, t > 6), STILL, out)).toBe(out);
    }
    expect(Object.keys(out).sort()).toEqual(['facing', 'frame', 'sway', 'tilt']);
  });
});

/** [x, y] pairs as points. */
function toPoints(pairs: readonly (readonly [number, number])[]): Point[] {
  return pairs.map(([x, y]) => ({ x, y }));
}

/** A hexagon loop from x0 to x0 + w and y0 to y0 + h, its side corners at mid-height `cut` px in from the top and bottom corners. */
function hexagon(x0: number, y0: number, w: number, h: number, cut = 100): Point[] {
  return toPoints([
    [x0, y0 + h / 2],
    [x0 + cut, y0],
    [x0 + w - cut, y0],
    [x0 + w, y0 + h / 2],
    [x0 + w - cut, y0 + h],
    [x0 + cut, y0 + h],
  ]);
}

/** A made-up layout 4 screens wide and `screensTall` tall with these mobile snacks, built by hand, so no builder check runs. */
function motionLayout(mix: Partial<MobileSnackMix>, screensTall = 2): Pick<AreaLayoutData, 'screensWide' | 'screensTall' | 'mobileSnacks'> {
  return { screensWide: 4, screensTall, mobileSnacks: { wanders: [], homes: [], ...mix } };
}

/** A made-up layout with one tadpole on each loop at `speed` px/s. */
function wanderLayout(speed: number, ...loops: readonly Point[][]): Pick<AreaLayoutData, 'screensWide' | 'screensTall' | 'mobileSnacks'> {
  return motionLayout({ tadpole: { speed }, wanders: loops.map((points) => ({ points, offset: 0 })) });
}

/** A made-up layout with one shrimp in each home. */
function homeLayout(...homes: readonly (readonly (readonly [number, number])[])[]): Pick<AreaLayoutData, 'screensWide' | 'screensTall' | 'mobileSnacks'> {
  return motionLayout({ homes: homes.map((pairs) => ({ points: toPoints(pairs) })) });
}

describe('meetsSnackMotion (issue #131, ND-2, ND-3, ND-5)', () => {
  /** Eight 150 px legs, 5 s each at 30 px/s: a 40 s lap round a 450 x 150 box. */
  const eightLegs = toPoints([[400, 200], [550, 200], [700, 200], [850, 200], [850, 350], [700, 350], [550, 350], [400, 350]]);
  const home: readonly (readonly [number, number])[] = [[1000, 300], [1200, 300], [1100, 460]];

  it('passes loops and homes inside every limit, and a layout with no mobile snacks', () => {
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 400, 200), hexagon(1200, 300, 320, 150)))).toBe(true);
    expect(meetsSnackMotion(homeLayout(home, [[400, 300], [500, 340], [450, 400], [420, 360]]))).toBe(true);
    expect(meetsSnackMotion({ screensWide: 4, screensTall: 1 })).toBe(true);
    expect(meetsSnackMotion(motionLayout({}))).toBe(true);
  });

  it('needs 4 to 8 turn points on every loop, so a 2-point loop fails', () => {
    expect(TADPOLES.minLoopPoints).toBe(4);
    expect(meetsSnackMotion(wanderLayout(64, toPoints([[400, 200], [720, 200], [720, 350], [400, 350]])))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(64, toPoints([[400, 200], [720, 200], [560, 350]])))).toBe(false);
    expect(meetsSnackMotion(wanderLayout(30, eightLegs))).toBe(true);
    const nine = [...eightLegs.slice(0, 5), { x: 775, y: 350 }, ...eightLegs.slice(5)];
    expect(meetsSnackMotion(wanderLayout(30, nine))).toBe(false);
    expect(meetsSnackMotion(wanderLayout(40, toPoints([[400, 200], [520, 200]])))).toBe(false);
  });

  it('needs a home box 320 to 480 px wide', () => {
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 320, 200)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 319, 200)))).toBe(false);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 480, 200)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 481, 200)))).toBe(false);
  });

  it('needs a home box 150 to 360 px tall', () => {
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 400, 150)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 400, 149)))).toBe(false);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 400, 360)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 400, 361)))).toBe(false);
  });

  it('keeps every turn point inside the area\'s swim bounds, below the highest wave', () => {
    const bounds = swimBounds(areaSize(4, 2));
    expect(bounds).toEqual({ minX: 40, maxX: 1880, minY: 94, maxY: 656 });
    expect(bounds.minY).toBeGreaterThan(SURF + 2.4);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(40, 200, 400, 200)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(39, 200, 400, 200)))).toBe(false);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(1480, 200, 400, 200)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(1481, 200, 400, 200)))).toBe(false);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 94, 400, 200)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 93, 400, 200)))).toBe(false);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 456, 400, 200)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 457, 400, 200)))).toBe(false);
    const oneScreen = { ...wanderLayout(60, hexagon(400, 100, 400, 196)), screensTall: 1 };
    expect(meetsSnackMotion(oneScreen)).toBe(true);
    expect(meetsSnackMotion({ ...oneScreen, mobileSnacks: wanderLayout(60, hexagon(400, 100, 400, 197)).mobileSnacks })).toBe(false);
  });

  it('needs each leg to take 1.5 to 5 s at the tadpole speed and the lap at most 40 s', () => {
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 320, 200, 115)))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(60, hexagon(400, 200, 320, 200, 115.5)))).toBe(false);
    expect(meetsSnackMotion(wanderLayout(64, toPoints([[400, 200], [720, 200], [720, 350], [400, 350]])))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(64, toPoints([[400, 200], [721, 200], [721, 350], [400, 350]])))).toBe(false);
    expect(TADPOLES.maxLoopPoints * TADPOLES.maxLegSeconds).toBe(TADPOLES.maxLapSeconds);
    expect(meetsSnackMotion(wanderLayout(30, eightLegs))).toBe(true);
    expect(meetsSnackMotion(wanderLayout(29.9, eightLegs))).toBe(false);
  });

  it('needs a tadpole rule for its wander loops', () => {
    expect(meetsSnackMotion(motionLayout({ wanders: [{ points: hexagon(400, 200, 400, 200), offset: 0 }] }))).toBe(false);
  });

  it('needs 3 to 6 hop spots in every shrimp home, so a 1-spot home fails', () => {
    expect(SHRIMP.minHomeSpots).toBe(3);
    expect(meetsSnackMotion(homeLayout(home))).toBe(true);
    expect(meetsSnackMotion(homeLayout(home.slice(0, 2)))).toBe(false);
    expect(meetsSnackMotion(homeLayout(home.slice(0, 1)))).toBe(false);
    const six: readonly (readonly [number, number])[] = [...home, [1050, 350], [1150, 350], [1100, 400]];
    expect(meetsSnackMotion(homeLayout(six))).toBe(true);
    expect(meetsSnackMotion(homeLayout([...six, [1100, 320]]))).toBe(false);
  });

  it('needs every shrimp home in a box at most 200 x 160 px', () => {
    expect(meetsSnackMotion(homeLayout([[1000, 300], [1201, 300], [1100, 460]]))).toBe(false);
    expect(meetsSnackMotion(homeLayout([[1000, 300], [1200, 300], [1100, 461]]))).toBe(false);
  });

  it('fails the whole layout on one loop or home outside its limits', () => {
    const mix = { tadpole: { speed: 60 }, wanders: [{ points: hexagon(400, 200, 400, 200), offset: 0 }], homes: [{ points: toPoints(home) }] };
    expect(meetsSnackMotion(motionLayout(mix))).toBe(true);
    expect(meetsSnackMotion(motionLayout({ ...mix, wanders: [...mix.wanders, { points: hexagon(1000, 200, 300, 200), offset: 0 }] }))).toBe(false);
    expect(meetsSnackMotion(motionLayout({ ...mix, homes: [...mix.homes, { points: toPoints([[1500, 300]]) }] }))).toBe(false);
  });
});

describe('oneLegCatchesTadpole (issue #131, ND-8)', () => {
  const bounds = swimBounds(areaSize(4, 2));

  it('catches the fastest tadpole on a screen-sized loop within 20 s from 8 starts 100 px outside its home', () => {
    expect(TADPOLE_CATCH_SECONDS).toBe(20);
    expect(TADPOLE_CATCH_START_GAP).toBe(100);
    expect(legSwimTuning(1).maxSpeed).toBe(90);
    const rule = tadpoleRule(TADPOLES.maxSpeed);
    for (const offset of [0, 3, 7]) {
      const wander = tadpoleWander(rule, hexagon(600, 200, 480, 360).map((point) => [point.x, point.y] as const), offset);
      expect(oneLegCatchesTadpole(rule, wander, bounds)).toBe(true);
    }
  });

  it('holds the starts inside the swim bounds for a loop on the edge', () => {
    const rule = tadpoleRule(70);
    const wander = tadpoleWander(rule, hexagon(40, 94, 400, 200).map((point) => [point.x, point.y] as const), 1);
    expect(oneLegCatchesTadpole(rule, wander, bounds)).toBe(true);
  });

  it('catches a tadpole on a plain 2-point loop', () => {
    const rule = tadpoleRule(40);
    expect(oneLegCatchesTadpole(rule, tadpoleWander(rule, [[400, 200], [520, 200]], 0), bounds)).toBe(true);
  });

  it('fails when the swimmer cannot reach the tadpole in time', () => {
    const rule = tadpoleRule(60);
    const wander = tadpoleWander(rule, hexagon(600, 200, 400, 200).map((point) => [point.x, point.y] as const), 0);
    expect(oneLegCatchesTadpole(rule, wander, bounds, { ...legSwimTuning(1), maxSpeed: 1 })).toBe(false);
  });

  it('refuses a rule or wander loop outside its limits', () => {
    const rule = tadpoleRule(60);
    expect(() => oneLegCatchesTadpole(rule, { points: toPoints([[400, 200]]), offset: 0 }, bounds)).toThrow(RangeError);
    expect(() => oneLegCatchesTadpole({ speed: 80 }, { points: toPoints([[400, 200], [520, 200]]), offset: 0 }, bounds)).toThrow(RangeError);
  });
});

describe('the snack ramp (ND-31)', () => {
  it('has rows for Areas 1 to 5 and a rule for Area 6 on', () => {
    expect(SNACK_RAMP.rows).toHaveLength(5);
    expect(SNACK_RAMP.rows[0].mobile).toBe(false);
    expect(SNACK_RAMP.later).toEqual({ mobile: true, minShare: 0.55, maxShare: 0.7, minTadpoleSpeed: 70, maxTadpoleSpeed: 72 });
  });

  it('has the tadpole speed rows 35-45, 45-55, 55-65 and 65-72 for Areas 2 to 5 (issue #131, ND-9)', () => {
    expect(SNACK_RAMP.rows.slice(1).map((row) => [row.minTadpoleSpeed, row.maxTadpoleSpeed])).toEqual([
      [35, 45],
      [45, 55],
      [55, 65],
      [65, 72],
    ]);
    expect(SNACK_RAMP.rows.map((row) => [row.minShare, row.maxShare])).toEqual([
      [0, 0],
      [0.15, 0.25],
      [0.3, 0.4],
      [0.45, 0.55],
      [0.55, 0.65],
    ]);
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
    expect(meetsSnackRamp(1, { snackWorms: 10, snackBugs: 6, mobileSnacks: mobileSnackMix({ wanders: [], homes: [] }) })).toBe(true);
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
    const slow = tadpoleRule(54);
    const slowMix = mobileSnackMix({ ...mix, tadpole: slow, wanders: spreadWanders(slow, mix.wanders.length) });
    expect(meetsSnackRamp(4, { snackWorms: 8, snackBugs: 6, mobileSnacks: slowMix })).toBe(false);
    const fast = tadpoleRule(66);
    const fastMix = mobileSnackMix({ ...mix, tadpole: fast, wanders: spreadWanders(fast, mix.wanders.length) });
    expect(meetsSnackRamp(4, { snackWorms: 8, snackBugs: 6, mobileSnacks: fastMix })).toBe(false);
    const noShrimp = mobileSnackMix({ tadpole: mix.tadpole, wanders: spreadWanders(tadpoleRule(60), 14), homes: [] });
    expect(meetsSnackRamp(4, { snackWorms: 8, snackBugs: 6, mobileSnacks: noShrimp })).toBe(false);
  });

  it('checks Area 6 on against the later rule', () => {
    const fast = tadpoleRule(71);
    const mix = (tadpoles: number) => mobileSnackMix({ tadpole: fast, wanders: spreadWanders(fast, tadpoles), shrimp: areaShrimp(5), homes: spreadHomes(10) });
    expect(meetsSnackRamp(6, { snackWorms: 6, snackBugs: 6, mobileSnacks: mix(10) })).toBe(true);
    expect(meetsSnackRamp(9, { snackWorms: 6, snackBugs: 6, mobileSnacks: mix(10) })).toBe(true);
    expect(meetsSnackRamp(6, { snackWorms: 4, snackBugs: 4, mobileSnacks: mix(10) })).toBe(false);
    const slow = tadpoleRule(69);
    expect(meetsSnackRamp(6, { snackWorms: 6, snackBugs: 6, mobileSnacks: mobileSnackMix({ ...mix(10), tadpole: slow, wanders: spreadWanders(slow, 10) }) })).toBe(false);
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
    expect(snackMagnetSpeed(40, zone)).toBe(84);
    expect(oneTimeDarts({ snackDart: SNACK_DART }, zone)).toBeNull();
  });
});
