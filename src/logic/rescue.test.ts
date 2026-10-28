import { afterEach, describe, expect, it, vi } from 'vitest';
import { AREAS, CANAL_AREA } from './areas';
import type { AxolotlSex } from './axolotlLook';
import { REAL_MORPHS, STARTER_MORPH, axolotlFindId, isAxolotlFindId, type RealMorphId } from './morphs';
import { placeTreasures } from './placement';
import {
  RESCUE,
  STRANDING_CHANCE,
  areaStrandingChance,
  createRescue,
  pickStranding,
  reachesRescue,
  rescueStatus,
  sendRescueBack,
  stepFollower,
  stepToRest,
  strandingRoll,
  tripStranding,
  waitingAfterTrip,
  type RescueState,
  type Stranding,
} from './rescue';
import { mulberry32 } from './rng';
import { chestListing } from './treasureChest';
import { foundInfo, foundInfos } from './trip';
import { createHoldings, pickUp, type Holdings } from './tripBag';
import type { TripPhase } from './tripEvents';
import { SWIM } from './tuning';
import { CAVE, STRANDING_PLACES, buildCanalZone, inHomeSpot, swimBounds, type Point } from './zone';

const DT = 1 / 60;
const STOP_STEPS = 120;
const MAX_PATH_STEPS = 1200;
const WILD_ID = axolotlFindId('wild');
const ALL_PHASES: readonly TripPhase[] = ['swimming', 'banked', 'carrying', 'ended'];

function strandingAt(pos: Point, morph: RealMorphId = 'wild', sex: AxolotlSex = 'girl'): Stranding {
  return { id: axolotlFindId(morph), morph, sex, placeId: 'canal/strand-test', x: pos.x, y: pos.y, met: false };
}

function rescueAt(pos: Point): RescueState {
  return createRescue(strandingAt(pos));
}

function insideSwimBounds(pos: Point): boolean {
  const bounds = swimBounds();
  return pos.x >= bounds.minX && pos.x <= bounds.maxX && pos.y >= bounds.minY && pos.y <= bounds.maxY;
}

function clampToSwimBounds(pos: Point): Point {
  const bounds = swimBounds();
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, pos.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, pos.y)),
  };
}

/** Leader positions, one per DT step, swimming through `waypoints` at the speed `speedAt` gives. */
function waypointPath(waypoints: readonly Point[], speedAt: (pos: Point) => number): Point[] {
  const positions: Point[] = [];
  let pos = { ...waypoints[0] };
  for (const waypoint of waypoints.slice(1)) {
    for (let gap = Math.hypot(waypoint.x - pos.x, waypoint.y - pos.y); gap > 0; ) {
      const stepLength = Math.min(gap, speedAt(pos) * DT);
      pos = { x: pos.x + ((waypoint.x - pos.x) * stepLength) / gap, y: pos.y + ((waypoint.y - pos.y) * stepLength) / gap };
      positions.push(pos);
      gap = Math.hypot(waypoint.x - pos.x, waypoint.y - pos.y);
    }
  }
  return positions;
}

/** Rightward dash bursts: a Tail Dash at SWIM.dashSpeed, then cruising, repeated. */
function dashBurstPath(): Point[] {
  const positions: Point[] = [];
  const dashSteps = Math.round(SWIM.dashDuration / DT);
  const cycleSteps = Math.round((SWIM.dashDuration + SWIM.dashCooldown) / DT);
  let pos = { x: 200, y: 200 };
  for (let i = 0; i < cycleSteps * 4; i++) {
    const speed = i % cycleSteps < dashSteps ? SWIM.dashSpeed : SWIM.maxSpeed;
    pos = { x: pos.x + speed * DT, y: pos.y };
    positions.push(pos);
  }
  return positions;
}

/** A seeded random walk inside the swim bounds; heading and speed (up to dash speed) change every 0.5 s. */
function randomWalkPath(seed: number): Point[] {
  const rng = mulberry32(seed);
  const positions: Point[] = [];
  let pos = { x: 960, y: 200 };
  let velocity = { x: 0, y: 0 };
  for (let i = 0; i < 1000; i++) {
    if (i % 30 === 0) {
      const heading = rng() * Math.PI * 2;
      const speed = rng() * SWIM.dashSpeed;
      velocity = { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed };
    }
    pos = clampToSwimBounds({ x: pos.x + velocity.x * DT, y: pos.y + velocity.y * DT });
    positions.push(pos);
  }
  return positions;
}

interface FollowRun {
  maxLagSeen: number;
  allInBounds: boolean;
  finalGap: number;
}

/** Follows `path` from a rescue started near its first point, then holds the leader still 2 s. */
function followPath(path: readonly Point[]): FollowRun {
  const start = path[0];
  const leaderStops = Array.from({ length: STOP_STEPS }, () => path[path.length - 1]);
  const steps = [...path, ...leaderStops];
  expect(steps.length).toBeLessThanOrEqual(MAX_PATH_STEPS);
  let rescue = rescueAt(clampToSwimBounds({ x: start.x + 24, y: start.y + 10 }));
  let maxLagSeen = 0;
  let allInBounds = true;
  for (const leader of steps) {
    rescue = stepFollower(rescue, leader, DT);
    maxLagSeen = Math.max(maxLagSeen, Math.hypot(rescue.pos.x - leader.x, rescue.pos.y - leader.y));
    allInBounds &&= insideSwimBounds(rescue.pos);
  }
  const last = steps[steps.length - 1];
  return { maxLagSeen, allInBounds, finalGap: Math.hypot(rescue.pos.x - last.x, rescue.pos.y - last.y) };
}

function expectKeepsUp(path: readonly Point[]): void {
  const run = followPath(path);
  expect(run.maxLagSeen).toBeLessThanOrEqual(RESCUE.maxLag + 1e-9);
  expect(run.allInBounds).toBe(true);
  expect(run.finalGap).toBeLessThanOrEqual(RESCUE.followGap + 1);
}

function holdingsWith(bag: readonly string[], banked: readonly string[] = []): Holdings {
  return bag.reduce(pickUp, createHoldings(banked));
}

describe('RESCUE tuning', () => {
  it('is frozen, with the follower faster than a Tail Dash', () => {
    expect(Object.isFrozen(RESCUE)).toBe(true);
    expect(Object.isFrozen(RESCUE.restOffset)).toBe(true);
    expect(RESCUE.followSpeed).toBeGreaterThan(SWIM.dashSpeed);
  });

  it('puts the rest point inside the Home Spot ring and the swim bounds', () => {
    const zone = buildCanalZone();
    const rest = { x: zone.homeSpot.x + RESCUE.restOffset.x, y: zone.homeSpot.y + RESCUE.restOffset.y };
    expect(inHomeSpot(rest, zone.homeSpot)).toBe(true);
    expect(insideSwimBounds(rest)).toBe(true);
  });
});

describe('pickStranding', () => {
  const owned: RealMorphId[] = [STARTER_MORPH];

  it('is deterministic for a trip seed', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(pickStranding(owned, null, STRANDING_PLACES, seed)).toEqual(
        pickStranding(owned, null, STRANDING_PLACES, seed),
      );
    }
  });

  it('never picks an owned morph and uses every rescuable morph and every place over seeds 0..999', () => {
    const morphs = new Set<RealMorphId>();
    const placeIds = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const stranding = pickStranding(owned, null, STRANDING_PLACES, seed);
      expect(stranding).not.toBeNull();
      if (!stranding) continue;
      expect(owned).not.toContain(stranding.morph);
      expect(stranding.id).toBe(axolotlFindId(stranding.morph));
      expect(stranding.met).toBe(false);
      const place = STRANDING_PLACES.find((entry) => entry.id === stranding.placeId);
      expect(place).toBeDefined();
      expect({ x: stranding.x, y: stranding.y }).toEqual({ x: place?.x, y: place?.y });
      morphs.add(stranding.morph);
      placeIds.add(stranding.placeId);
    }
    expect([...morphs].sort()).toEqual(REAL_MORPHS.map((morph) => morph.id).filter((id) => id !== STARTER_MORPH).sort());
    expect([...placeIds].sort()).toEqual(STRANDING_PLACES.map((place) => place.id).sort());
  });

  it('returns null once all seven non-starter morphs are owned, for each possible starter', () => {
    for (const starter of REAL_MORPHS.map((morph) => morph.id)) {
      const others = REAL_MORPHS.map((morph) => morph.id).filter((id) => id !== starter);
      const lastOne = others[others.length - 1];
      for (let seed = 0; seed < 20; seed++) {
        expect(pickStranding([starter, ...others], null, STRANDING_PLACES, seed)).toBeNull();
        expect(pickStranding([starter, ...others.slice(0, -1)], null, STRANDING_PLACES, seed)?.morph).toBe(lastOne);
      }
    }
  });

  it('gives the same sex for the same seed, and both sexes over seeds 0..999', () => {
    const sexes = new Set<AxolotlSex>();
    for (let seed = 0; seed < 1000; seed++) {
      const stranding = pickStranding(owned, null, STRANDING_PLACES, seed);
      expect(stranding?.sex).toBe(pickStranding(owned, null, STRANDING_PLACES, seed)?.sex);
      if (stranding) sexes.add(stranding.sex);
    }
    expect([...sexes].sort()).toEqual(['boy', 'girl']);
  });

  it('draws the sex after the morph and the place, so they stay as the seed picked them before', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32((seed ^ 0x5743a11d) >>> 0);
      const rescuable = REAL_MORPHS.map((morph) => morph.id).filter((id) => id !== STARTER_MORPH);
      const morph = rescuable[Math.floor(rng() * rescuable.length)];
      const place = STRANDING_PLACES[Math.floor(rng() * STRANDING_PLACES.length)];
      const sex = rng() < 0.5 ? 'boy' : 'girl';
      expect(pickStranding(owned, null, STRANDING_PLACES, seed)).toMatchObject({ morph, placeId: place.id, sex });
    }
  });

  it('returns null when there are no places', () => {
    expect(pickStranding(owned, null, [], 1)).toBeNull();
  });

  it.each<AxolotlSex>(['boy', 'girl'])('honours a waiting record: same morph, sex (%s) and place, met', (sex) => {
    const place = STRANDING_PLACES[2];
    for (let seed = 0; seed < 50; seed++) {
      expect(pickStranding(owned, { morph: 'melanoid', sex, placeId: place.id }, STRANDING_PLACES, seed)).toEqual({
        id: axolotlFindId('melanoid'),
        morph: 'melanoid',
        sex,
        placeId: place.id,
        x: place.x,
        y: place.y,
        met: true,
      });
    }
  });

  it('ignores a waiting record whose morph is now owned', () => {
    const waiting = { morph: 'wild' as const, sex: 'girl' as const, placeId: STRANDING_PLACES[0].id };
    for (let seed = 0; seed < 200; seed++) {
      const stranding = pickStranding([STARTER_MORPH, 'wild'], waiting, STRANDING_PLACES, seed);
      expect(stranding).toEqual(pickStranding([STARTER_MORPH, 'wild'], null, STRANDING_PLACES, seed));
      expect(stranding?.morph).not.toBe('wild');
      expect(stranding?.met).toBe(false);
    }
  });

  it('ignores a waiting record whose place is unknown', () => {
    const waiting = { morph: 'wild' as const, sex: 'girl' as const, placeId: 'canal/strand-gone' };
    for (let seed = 0; seed < 200; seed++) {
      const stranding = pickStranding(owned, waiting, STRANDING_PLACES, seed);
      expect(stranding).toEqual(pickStranding(owned, null, STRANDING_PLACES, seed));
      expect(stranding?.met).toBe(false);
    }
  });
});

describe('tripStranding and strandingRoll', () => {
  const owned: RealMorphId[] = [STARTER_MORPH];
  const SEEDS_10000 = Array.from({ length: 10000 }, (_, i) => i);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('strands an axolotl on about 40% of trips with nobody waiting, over seeds 0..9999', () => {
    expect(STRANDING_CHANCE).toBe(0.4);
    const stranded = SEEDS_10000.filter((seed) => tripStranding(owned, null, STRANDING_PLACES, seed) !== null).length;
    expect(Math.abs(stranded / SEEDS_10000.length - STRANDING_CHANCE)).toBeLessThanOrEqual(0.02);
  });

  it('is deterministic for a trip seed, and the roll is a number from 0 to 1', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(tripStranding(owned, null, STRANDING_PLACES, seed)).toEqual(tripStranding(owned, null, STRANDING_PLACES, seed));
      const roll = strandingRoll(seed);
      expect(strandingRoll(seed)).toBe(roll);
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
  });

  it('strands the axolotl pickStranding picks for that seed, the roll drawing from its own stream', () => {
    let strandedSeeds = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const stranding = tripStranding(owned, null, STRANDING_PLACES, seed);
      expect(stranding !== null).toBe(strandingRoll(seed) < STRANDING_CHANCE);
      if (stranding === null) continue;
      strandedSeeds += 1;
      expect(stranding).toEqual(pickStranding(owned, null, STRANDING_PLACES, seed));
    }
    expect(strandedSeeds).toBeGreaterThan(0);
  });

  it('returns null once all seven non-starter morphs are owned, for each possible starter', () => {
    for (const starter of REAL_MORPHS.map((morph) => morph.id)) {
      const others = REAL_MORPHS.map((morph) => morph.id).filter((id) => id !== starter);
      for (let seed = 0; seed < 200; seed++) {
        expect(tripStranding([starter, ...others], null, STRANDING_PLACES, seed)).toBeNull();
      }
    }
  });

  it('always brings back a valid waiting record met, with no roll, on every seed including roll misses', () => {
    const waiting = { morph: 'melanoid' as const, sex: 'boy' as const, placeId: STRANDING_PLACES[1].id };
    const seeds = Array.from({ length: 200 }, (_, i) => i);
    expect(seeds.some((seed) => strandingRoll(seed) >= STRANDING_CHANCE)).toBe(true);
    for (const seed of seeds) {
      const stranding = tripStranding(owned, waiting, STRANDING_PLACES, seed);
      expect(stranding).toEqual(pickStranding(owned, waiting, STRANDING_PLACES, seed));
      expect(stranding).toMatchObject({ morph: 'melanoid', sex: 'boy', placeId: waiting.placeId, met: true });
      expect(tripStranding(owned, waiting, STRANDING_PLACES, seed, 0)).toEqual(stranding);
    }
  });

  it.each([
    ['whose morph is now owned', { morph: 'wild' as const, sex: 'girl' as const, placeId: STRANDING_PLACES[0].id }],
    ['whose place is unknown', { morph: 'melanoid' as const, sex: 'girl' as const, placeId: 'canal/strand-gone' }],
  ])('rolls for a waiting record %s, like nobody waiting', (_label, waiting) => {
    const ownedWithWild: RealMorphId[] = [STARTER_MORPH, 'wild'];
    for (let seed = 0; seed < 500; seed++) {
      expect(tripStranding(ownedWithWild, waiting, STRANDING_PLACES, seed)).toEqual(
        tripStranding(ownedWithWild, null, STRANDING_PLACES, seed),
      );
    }
  });

  it('never strands with chance 0 and always strands with chance 1', () => {
    for (let seed = 0; seed < 500; seed++) {
      expect(tripStranding(owned, null, STRANDING_PLACES, seed, 0)).toBeNull();
      expect(tripStranding(owned, null, STRANDING_PLACES, seed, 1)).toEqual(pickStranding(owned, null, STRANDING_PLACES, seed));
    }
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'throws for chance %f, outside 0 to 1, with or without a waiting record',
    (chance) => {
      const waiting = { morph: 'melanoid' as const, sex: 'boy' as const, placeId: STRANDING_PLACES[1].id };
      expect(() => tripStranding(owned, null, STRANDING_PLACES, 1, chance)).toThrow(RangeError);
      expect(() => tripStranding(owned, waiting, STRANDING_PLACES, 1, chance)).toThrow(RangeError);
    },
  );

  it('never calls Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    tripStranding(owned, null, STRANDING_PLACES, 1);
    strandingRoll(1);
    expect(random).not.toHaveBeenCalled();
  });
});

describe('areaStrandingChance', () => {
  const defaultChanceAreas = AREAS.filter((area) => area.strandingChance === undefined);

  it.each(defaultChanceAreas.map((area) => [area.id, area] as const))('gives %s the 40% stranding chance', (_id, area) => {
    expect(areaStrandingChance(area)).toBe(STRANDING_CHANCE);
    expect(areaStrandingChance(area)).toBe(0.4);
  });

  it('gives every area but Area 6 the 40% default, and Area 6 its own 30% (issue #77)', () => {
    expect(defaultChanceAreas.map((area) => area.number)).toEqual([1, 2, 3, 4, 5]);
    const springCave = AREAS.find((area) => area.number === 6);
    expect(springCave && areaStrandingChance(springCave)).toBe(0.3);
  });

  it('gives STRANDING_CHANCE when the area has no strandingChance', () => {
    expect(areaStrandingChance({})).toBe(STRANDING_CHANCE);
    expect(areaStrandingChance({ strandingChance: undefined })).toBe(STRANDING_CHANCE);
  });

  it.each([0, 0.25, 1])('gives the area its own strandingChance %f', (chance) => {
    expect(areaStrandingChance({ ...CANAL_AREA, strandingChance: chance })).toBe(chance);
  });

  it('feeds tripStranding the same result as the default chance for an area without its own', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(tripStranding([STARTER_MORPH], null, STRANDING_PLACES, seed, areaStrandingChance(CANAL_AREA))).toEqual(
        tripStranding([STARTER_MORPH], null, STRANDING_PLACES, seed),
      );
    }
  });
});

describe('createRescue and sendRescueBack', () => {
  it('starts at a copy of the place with an empty trail, facing left', () => {
    const stranding = strandingAt({ x: 880, y: 292 }, 'golden-albino');
    const rescue = createRescue(stranding);
    expect(rescue).toEqual({
      id: axolotlFindId('golden-albino'),
      morph: 'golden-albino',
      sex: 'girl',
      placeId: stranding.placeId,
      place: { x: 880, y: 292 },
      met: false,
      pos: { x: 880, y: 292 },
      trail: [],
      facing: -1,
    });
    expect(rescue.pos).not.toBe(rescue.place);
  });

  it('sends a following rescue back to its place with an empty trail', () => {
    let rescue = rescueAt({ x: 880, y: 292 });
    for (let i = 0; i < 60; i++) rescue = stepFollower(rescue, { x: 880 - i * 3, y: 250 }, DT);
    expect(rescue.trail.length).toBeGreaterThan(0);
    const back = sendRescueBack(rescue);
    expect(back.pos).toEqual({ x: 880, y: 292 });
    expect(back.pos).not.toBe(back.place);
    expect(back.trail).toEqual([]);
  });
});

describe('reachesRescue', () => {
  it('reaches within the reach radius, inclusive', () => {
    const rescue = rescueAt({ x: 500, y: 200 });
    expect(reachesRescue(rescue, { x: 500 + RESCUE.reachRadius, y: 200 })).toBe(true);
    expect(reachesRescue(rescue, { x: 500, y: 200 - RESCUE.reachRadius })).toBe(true);
    expect(reachesRescue(rescue, { x: 500 + RESCUE.reachRadius + 0.01, y: 200 })).toBe(false);
  });
});

describe('rescueStatus', () => {
  const rescue = rescueAt({ x: 500, y: 200 });

  it('is safe in every phase once banked', () => {
    for (const phase of ALL_PHASES) {
      expect(rescueStatus(rescue, holdingsWith([], [WILD_ID]), phase)).toBe('safe');
    }
  });

  it('is following while in the Trip Bag and the trip is swimming or banked', () => {
    expect(rescueStatus(rescue, holdingsWith([WILD_ID]), 'swimming')).toBe('following');
    expect(rescueStatus(rescue, holdingsWith([WILD_ID]), 'banked')).toBe('following');
  });

  it('is waiting while carrying or ended, even in the Trip Bag', () => {
    expect(rescueStatus(rescue, holdingsWith([WILD_ID]), 'carrying')).toBe('waiting');
    expect(rescueStatus(rescue, holdingsWith([WILD_ID]), 'ended')).toBe('waiting');
  });

  it('is waiting when not held', () => {
    for (const phase of ALL_PHASES) {
      expect(rescueStatus(rescue, holdingsWith(['canal/sun-hat']), phase)).toBe('waiting');
    }
  });
});

describe('waitingAfterTrip', () => {
  const met: RescueState = { ...rescueAt({ x: 880, y: 292 }), placeId: 'canal/strand-2', met: true };

  it('keeps a met rescue that was not banked, with its sex', () => {
    const waiting = { morph: 'wild', sex: 'girl', placeId: 'canal/strand-2' };
    expect(waitingAfterTrip(met, holdingsWith([WILD_ID]), 'ended')).toEqual(waiting);
    expect(waitingAfterTrip(met, createHoldings(), 'ended')).toEqual(waiting);
    expect(waitingAfterTrip({ ...met, sex: 'boy' }, createHoldings(), 'ended')).toEqual({ ...waiting, sex: 'boy' });
  });

  it('keeps the sex of a following rescue that was carried home, so the next trip brings it back the same', () => {
    let following: RescueState = { ...met, sex: 'boy' };
    for (let i = 0; i < 30; i++) following = stepFollower(following, { x: 880 - i * 3, y: 250 }, DT);
    const waiting = waitingAfterTrip(following, holdingsWith([WILD_ID]), 'ended');
    expect(waiting).toEqual({ morph: 'wild', sex: 'boy', placeId: 'canal/strand-2' });
    const place = { id: 'canal/strand-2', x: 880, y: 292 };
    expect(pickStranding([STARTER_MORPH], waiting, [place], 7)).toMatchObject({ sex: 'boy', met: true });
  });

  it('drops a banked rescue, an unmet rescue and no rescue', () => {
    expect(waitingAfterTrip(met, holdingsWith([], [WILD_ID]), 'ended')).toBeNull();
    expect(waitingAfterTrip({ ...met, met: false }, holdingsWith([WILD_ID]), 'ended')).toBeNull();
    expect(waitingAfterTrip(null, createHoldings(), 'ended')).toBeNull();
  });
});

describe('stepFollower', () => {
  it('returns the input for a zero, negative or non-finite dt', () => {
    const rescue = rescueAt({ x: 500, y: 200 });
    for (const dt of [0, -DT, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(stepFollower(rescue, { x: 520, y: 200 }, dt)).toBe(rescue);
    }
  });

  it('keeps up with dash bursts at the Tail Dash speed', () => {
    expectKeepsUp(dashBurstPath());
  });

  it('keeps up through the current zone, x 760 to 1160, and back', () => {
    const current = buildCanalZone().currents[0];
    const speedAt = (pos: Point): number => (pos.x >= current.x0 && pos.x <= current.x1 ? 80 : SWIM.maxSpeed);
    expectKeepsUp(waypointPath([{ x: 700, y: 200 }, { x: 1220, y: 200 }, { x: 700, y: 180 }], speedAt));
  });

  it('keeps up with zigzags in a reed patch', () => {
    const patch = buildCanalZone().reedPatches[0];
    const bounds = swimBounds();
    const zigzag = Array.from({ length: 6 }, (_, i) => ({
      x: patch.x0 + ((patch.x1 - patch.x0) * i) / 5,
      y: i % 2 === 0 ? bounds.minY + 10 : bounds.maxY - 10,
    }));
    expectKeepsUp(waypointPath(zigzag, () => SWIM.maxSpeed / patch.dragMul + 20));
  });

  it('keeps up into and out of the cave', () => {
    const cave = [
      { x: CAVE.x0 - 80, y: 150 },
      { x: CAVE.x0 + 20, y: 240 },
      { x: CAVE.x1 - 20, y: 290 },
      { x: CAVE.x0 + 80, y: 220 },
      { x: CAVE.x0 - 80, y: 160 },
    ];
    expectKeepsUp(waypointPath(cave, () => SWIM.maxSpeed));
  });

  it('keeps up with seeded random walks inside the swim bounds', () => {
    for (const seed of [1, 7, 42]) expectKeepsUp(randomWalkPath(seed));
  });

  it('keeps the trail bounded to just over followGap + maxLag of path', () => {
    let rescue = rescueAt({ x: 224, y: 210 });
    const path = dashBurstPath();
    for (const leader of path) rescue = stepFollower(rescue, leader, DT);
    const leader = path[path.length - 1];
    let pathLength = 0;
    let previous = leader;
    for (const point of [...rescue.trail].reverse()) {
      pathLength += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
    }
    expect(pathLength).toBeGreaterThanOrEqual(RESCUE.followGap + RESCUE.maxLag);
    expect(pathLength).toBeLessThan(RESCUE.followGap + RESCUE.maxLag + SWIM.dashSpeed * DT + RESCUE.trailStep);
  });

  it('settles followGap of path behind a leader that stops after a straight swim', () => {
    let rescue = rescueAt({ x: 500, y: 200 });
    for (let i = 1; i <= 60; i++) rescue = stepFollower(rescue, { x: 500 + i * 3, y: 200 }, DT);
    for (let i = 0; i < STOP_STEPS; i++) rescue = stepFollower(rescue, { x: 680, y: 200 }, DT);
    expect(rescue.pos.x).toBeCloseTo(680 - RESCUE.followGap, 6);
    expect(rescue.pos.y).toBeCloseTo(200, 6);
  });

  it('keeps the same trail array, untouched, while the leader moves less than a trail step', () => {
    let rescue = rescueAt({ x: 500, y: 200 });
    for (let i = 1; i <= 30; i++) rescue = stepFollower(rescue, { x: 500 + i * 3, y: 200 }, DT);
    const trail = rescue.trail;
    const before = trail.map((point) => ({ ...point }));
    const newest = trail[trail.length - 1];
    const next = stepFollower(rescue, { x: newest.x + RESCUE.trailStep / 2, y: 200 }, DT);
    expect(next.trail).toBe(trail);
    expect(trail).toEqual(before);
  });

  it('adds a point in a new trail array and leaves the input trail untouched', () => {
    let rescue = rescueAt({ x: 500, y: 200 });
    for (let i = 1; i <= 30; i++) rescue = stepFollower(rescue, { x: 500 + i * 3, y: 200 }, DT);
    const trail = rescue.trail;
    const before = trail.map((point) => ({ ...point }));
    const next = stepFollower(rescue, { x: 600, y: 200 }, DT);
    expect(next.trail).not.toBe(trail);
    expect(next.trail[next.trail.length - 1]).toEqual({ x: 600, y: 200 });
    expect(trail).toEqual(before);
  });

  it('faces the way it swims', () => {
    let rescue = rescueAt({ x: 500, y: 200 });
    for (let i = 1; i <= 60; i++) rescue = stepFollower(rescue, { x: 500 + i * 2.5, y: 200 }, DT);
    expect(rescue.facing).toBe(1);
    for (let i = 1; i <= 120; i++) rescue = stepFollower(rescue, { x: 650 - i * 2.5, y: 200 }, DT);
    expect(rescue.facing).toBe(-1);
  });
});

describe('stepToRest', () => {
  it('swims to the rest point inside the Home Spot ring at the follow speed', () => {
    const zone = buildCanalZone();
    const place = STRANDING_PLACES[STRANDING_PLACES.length - 1];
    let rescue = rescueAt(place);
    const rest = { x: zone.homeSpot.x + RESCUE.restOffset.x, y: zone.homeSpot.y + RESCUE.restOffset.y };
    for (let i = 0; i < MAX_PATH_STEPS; i++) {
      const next = stepToRest(rescue, zone.homeSpot, DT);
      expect(Math.hypot(next.pos.x - rescue.pos.x, next.pos.y - rescue.pos.y)).toBeLessThanOrEqual(
        RESCUE.followSpeed * DT + 1e-9,
      );
      rescue = next;
    }
    expect(rescue.pos).toEqual(rest);
    expect(inHomeSpot(rescue.pos, zone.homeSpot)).toBe(true);
    expect(rescue.trail).toEqual([]);
  });
});

describe('axolotl find ids are never treasures', () => {
  const zone = buildCanalZone();

  it('placeTreasures with an axolotl id banked places no axolotl id and nothing else changes', () => {
    for (let seed = 0; seed < 20; seed++) {
      const placed = placeTreasures(zone.finds, zone.spots, [WILD_ID], seed);
      expect(placed.some((find) => isAxolotlFindId(find.id))).toBe(false);
      expect(placed).toEqual(placeTreasures(zone.finds, zone.spots, [], seed));
    }
  });

  it('chestListing ignores axolotl ids', () => {
    const allAxolotls = REAL_MORPHS.map((morph) => axolotlFindId(morph.id));
    expect(chestListing(allAxolotls)).toEqual(chestListing([]));
    expect(chestListing(['canal/sun-hat', ...allAxolotls])).toEqual(chestListing(['canal/sun-hat']));
  });

  it('foundInfos omits an axolotl id', () => {
    expect(foundInfos([WILD_ID])).toEqual([]);
  });

  it('foundInfo throws for an axolotl id', () => {
    expect(() => foundInfo(WILD_ID)).toThrow();
  });
});
