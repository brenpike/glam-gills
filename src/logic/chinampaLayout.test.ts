import { describe, expect, it } from 'vitest';
import { CHINAMPA_AREA, CHINAMPA_HABITAT, POND_2_AREA, newThingsByArea, sourceFactCards } from './areas';
import { CHINAMPA_TREASURES, RARITIES } from './catalogue';
import { CHINAMPA_AREA_ID, CHINAMPA_CARP, CHINAMPA_LAYOUT, CHINAMPA_TILAPIA } from './chinampaLayout';
import { createCollectibles, drawnSnackX, drawnSnackY, snackDriftMaxSpeed, snackX, snackY, type Collectible, type SnackFrame } from './collectibles';
import { longestQuietStretch, meetsFullDangerBar, movingHazardTypeCount, movingThreatCount, predatorTypeCount } from './dangerBar';
import { currentAt, reedDragAt } from './environment';
import { CARP_FACT, GHOST_NET_FACT, PUNTING_POLE_FACT, SHRIMP_FACT, TADPOLE_FACT, TILAPIA_FACT } from './factCards';
import { GHOST_NET } from './ghostNets';
import { hazardCentre, hazardShapeAt, hazardSweep, shapeDistance, type HazardShape } from './hazards';
import {
  MAIN_PATH_REACH,
  PAST_CURRENT_DEPTH,
  coversAt,
  distanceToPath,
  routeDistance,
  spotMatchesLabels,
  turnDistance,
  zoneThreats,
} from './hiding';
import { NET_CURRENT_CLEARANCE, SAFE_PASSING_WIDTH, gapsOf, loopSamples, narrowestPathGap } from './layoutGaps';
import { legSwimTuning } from './legs';
import {
  meetsSnackRamp,
  mobileSnackAvoid,
  mobileSnackClear,
  mobileSnackShare,
  oneTimeDarts,
  shrimpBox,
  snackMagnetSpeed,
  tadpoleLaneBox,
} from './mobileSnacks';
import { PUNTING_POLE, movingHazardSweep, type MovingHazardSpawn } from './movingHazards';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { placeTreasures } from './placement';
import { CARP_SPECIES, TILAPIA_SPECIES, routeLoopDistance, tunedSpecies } from './predators';
import { POND_2_LAYOUT } from './pond2Layout';
import { RESCUE } from './rescue';
import { SNACK_DART } from './snackDart';
import { stepSwim, type SwimState } from './swimPhysics';
import {
  CARP,
  CARP_CHASE,
  DRIFTING_NETS,
  FINDS,
  GHOST_NETS,
  LEGS,
  RISK,
  SWIM,
  TILAPIA,
  TILAPIA_CHASE,
  tripTreasureTuning,
  type TilapiaTuning,
} from './tuning';
import { normalize } from './vec';
import {
  DEFAULT_ZONE_SEED,
  SCREEN_W,
  SNACK_HAZARD_CLEARANCE,
  SPOT_MIN_SPACING,
  SURF,
  WORLD_H,
  buildZone,
  inHomeSpot,
  inSafeArea,
  isInsideCurrent,
  swimBounds,
  type CurrentZone,
  type Point,
  type TilapiaRoute,
  type ZoneLayout,
} from './zone';

const EXTRA_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const ALL_SEEDS = [DEFAULT_ZONE_SEED, ...EXTRA_SEEDS];
/** 60 seeds for the seeded snacks: the shipped seeds and 51 more. */
const SNACK_SEEDS = [...ALL_SEEDS, ...Array.from({ length: 51 }, (_, i) => (i + 1) * 7919)];
/** 200 trip seeds for treasure placement. */
const TRIP_SEEDS = Array.from({ length: 200 }, (_, i) => i * 104729 + 17);
const STRIKE = CHINAMPA_TILAPIA.lungeRange;
const CARP_STRIKE = CHINAMPA_CARP.tuning.lungeRange;
const STRANDING_ROUTE_CLEARANCE = 80;
/** Least px from a hiding spot to every net: a grab from the pickup radius never comes within the net reach. */
const SPOT_NET_CLEARANCE = GHOST_NET.reach + FINDS.pickupRadius;
/** Least px from a stranding place to every net: the rescue reach plus the net reach. */
const STRAND_NET_CLEARANCE = GHOST_NET.reach + RESCUE.reachRadius;
/** Least px from a stranding place to every pole sweep: the rescue reach plus the pole's touch reach. */
const STRAND_POLE_CLEARANCE = PUNTING_POLE.touchReach + RESCUE.reachRadius;
/** Lowest y of the overhanging banks. */
const BANK_UNDER_Y = 140;
/** The measured longest stretch of the main path with no moving threat in reach (issue #119, ND-6). */
const LONGEST_QUIET_STRETCH = 459;
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
const FLICK_DIRECTIONS = 8;

const zone = buildZone(CHINAMPA_LAYOUT, DEFAULT_ZONE_SEED);
const pond2 = buildZone(POND_2_LAYOUT, DEFAULT_ZONE_SEED);

function chinampa(seed: number): ZoneLayout {
  return buildZone(CHINAMPA_LAYOUT, seed);
}

/** Least distance between two closed loops that do not cross: the waypoint distances suffice. */
function routeGap(first: TilapiaRoute, second: TilapiaRoute): number {
  const fromFirst = first.waypoints.map((point) => routeDistance(point, [second]));
  const fromSecond = second.waypoints.map((point) => routeDistance(point, [first]));
  return Math.min(...fromFirst, ...fromSecond);
}

/** Least distance from a hazard shape to a closed loop, sampled along the loop. */
function shapeRouteDistance(shape: HazardShape, waypoints: readonly Point[]): number {
  return Math.min(...loopSamples(waypoints).map((point) => shapeDistance(point, shape)));
}

function rectOf(current: CurrentZone): HazardShape {
  return { kind: 'rect', x0: current.x0, x1: current.x1, y0: current.y0, y1: current.y1 };
}

/** Least distance between two rects; 0 when they touch or overlap. */
function rectDistance(first: HazardShape, second: HazardShape): number {
  if (first.kind !== 'rect' || second.kind !== 'rect') throw new Error('rectDistance: both shapes must be rects');
  const dx = Math.max(first.x0 - second.x1, 0, second.x0 - first.x1);
  const dy = Math.max(first.y0 - second.y1, 0, second.y0 - first.y1);
  return Math.hypot(dx, dy);
}

function inBounds(point: Point, layout: ZoneLayout): boolean {
  const bounds = swimBounds(layout);
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

/** Every net's whole drift path (hazardSweep); a still net's own shape. */
function netShapes(layout: ZoneLayout): HazardShape[] {
  return layout.hazards.map(hazardSweep);
}

/** One frame of a one-leg swim steered at `target`, with the area's currents and reed drag. */
function swimToward(state: SwimState, target: Point, layout: ZoneLayout): SwimState {
  const pos = { x: state.x, y: state.y };
  const env = {
    current: currentAt(pos, layout.currents),
    dragMul: reedDragAt(pos, layout.reedPatches),
    bounds: swimBounds(layout),
    dashing: false,
  };
  const steer = normalize({ x: target.x - pos.x, y: target.y - pos.y });
  return stepSwim(state, steer, env, FRAME, legSwimTuning(1));
}

/** Seconds a one-leg axolotl takes to swim through `targets` in order; Infinity when over the limit. */
function oneLegSeconds(from: Point, targets: readonly Point[], layout: ZoneLayout, arrive: (pos: Point) => boolean): number {
  let state: SwimState = { x: from.x, y: from.y, vx: 0, vy: 0, facing: 1 };
  let next = 0;
  const maxFrames = Math.round(BEAT_MAX_SECONDS / FRAME);
  for (let frame = 0; frame < maxFrames; frame++) {
    const pos = { x: state.x, y: state.y };
    if (next === targets.length - 1 && arrive(pos)) return frame * FRAME;
    const target = targets[next];
    if (next < targets.length - 1 && Math.hypot(target.x - pos.x, target.y - pos.y) <= WAYPOINT_REACH) {
      next++;
      continue;
    }
    state = swimToward(state, target, layout);
  }
  return Infinity;
}

/** Where a snack is at the frame's drift time: a tadpole on its lane (drawnSnackX/Y), any other snack at its drift with no bob. */
function snackAt(item: Collectible, index: number, frame: SnackFrame): Point {
  if (item.lane) return { x: drawnSnackX(item, index, frame), y: drawnSnackY(item, index, frame) };
  return { x: snackX(item, index, frame.driftT, frame.drift, frame.bounds), y: snackY(item, index, frame.driftT, frame.drift, frame.bounds) };
}

/** Every patrol loop in the zone: the tilapia routes, then the carp's. */
function predatorLoops(layout: ZoneLayout): TilapiaRoute[] {
  return [...layout.tilapiaRoutes, ...layout.predatorRoutes];
}

/** The tuning of the predator on `route`: the carp's for a predator route, else Area 4's tilapia's. */
function tuningOf(layout: ZoneLayout, route: TilapiaRoute): Readonly<TilapiaTuning> {
  return layout.predatorRoutes.find((other) => other.id === route.id)?.species.tuning ?? CHINAMPA_TILAPIA;
}

/** The lunge range of the predator on `route`. */
function lungeOf(layout: ZoneLayout, route: TilapiaRoute): number {
  return tuningOf(layout, route).lungeRange;
}

/** Every punting pole of the zone. */
function polesOf(layout: ZoneLayout): MovingHazardSpawn[] {
  return layout.movingHazards ?? [];
}

/** Where a pole touches the body centre: its sweep grown by its touch reach, as a rect. */
function dangerZone(pole: MovingHazardSpawn): { x0: number; x1: number; y0: number; y1: number } {
  const sweep = movingHazardSweep(pole);
  const reach = pole.type.touchReach;
  return { x0: sweep.x0 - reach, x1: sweep.x1 + reach, y0: sweep.y0 - reach, y1: sweep.y1 + reach };
}

function rectsOverlap(first: { x0: number; x1: number; y0: number; y1: number }, second: { x0: number; x1: number; y0: number; y1: number }): boolean {
  return first.x1 >= second.x0 && first.x0 <= second.x1 && first.y1 >= second.y0 && first.y0 <= second.y1;
}

/** Whether a shrimp at `spot` has a clear place to flick to in at least one of FLICK_DIRECTIONS directions. */
function hasClearFlick(layout: ZoneLayout, spot: Point): boolean {
  const avoid = mobileSnackAvoid(layout);
  const distance = layout.mobileSnacks?.shrimp?.flickDistance ?? 0;
  return Array.from({ length: FLICK_DIRECTIONS }, (_, i) => (i * 2 * Math.PI) / FLICK_DIRECTIONS).some((angle) =>
    mobileSnackClear(shrimpBox({ x: spot.x + distance * Math.cos(angle), y: spot.y + distance * Math.sin(angle) }, CHINAMPA_AREA.snackDrift), avoid),
  );
}

describe('CHINAMPA_LAYOUT', () => {
  it('is Area 4 data: 6 screens across, 2 down, starting at the Home Spot', () => {
    expect(CHINAMPA_AREA_ID).toBe('chinampa-1');
    expect(CHINAMPA_LAYOUT.id).toBe(CHINAMPA_AREA_ID);
    expect(zone.width).toBe(2880);
    expect(zone.height).toBe(720);
    expect(zone.bedTop).toBe(678);
    expect(zone.chunks).toBe(6);
    expect(zone.rows).toBe(2);
    expect(zone.start).toEqual({ x: 120, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 120, y: 200, radius: 72 });
    expect(zone.safeArea).toEqual({ x0: 40, x1: 300, y0: SURF, y1: 678 });
    expect(zone.cave.id).toBe('chinampa-1/cave');
    expect(Object.isFrozen(CHINAMPA_LAYOUT)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_LAYOUT.hazards)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_LAYOUT.bankOverhangs)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_LAYOUT.bankSpots)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_LAYOUT.predatorRoutes)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_LAYOUT.movingHazards)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_LAYOUT.mobileSnacks)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_TILAPIA)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_CARP)).toBe(true);
  });

  it('has 28 snacks (8 worms, 6 bugs, 7 tadpoles and 7 shrimp), 5 ghost nets, 6 tilapia, a carp, 2 punting poles and 9 treasure slots, and no reeds, pads, plastic worms or heron', () => {
    for (const seed of ALL_SEEDS) {
      const layout = chinampa(seed);
      expect(layout.collectibles).toHaveLength(28);
      expect(layout.collectibles.filter((snack) => snack.kind === 'worm')).toHaveLength(8);
      expect(layout.collectibles.filter((snack) => snack.kind === 'bug')).toHaveLength(6);
      expect(layout.collectibles.filter((snack) => snack.kind === 'tadpole')).toHaveLength(7);
      expect(layout.collectibles.filter((snack) => snack.kind === 'shrimp')).toHaveLength(7);
      expect(layout.tilapiaRoutes.map((route) => route.id)).toEqual([0, 1, 2, 3, 4, 5].map((n) => `tilapia-${n}`));
      expect(layout.predatorRoutes.map((route) => route.id)).toEqual(['carp-0']);
      expect(layout.movingHazards?.map((spawn) => spawn.id)).toEqual([1, 2].map((n) => `chinampa-1/punting-pole-${n}`));
      expect(layout.reeds).toEqual([]);
      expect(layout.reedPatches).toEqual([]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.hazards.map((hazard) => hazard.id)).toEqual([1, 2, 3, 4, 5].map((n) => `chinampa-1/ghost-net-${n}`));
    for (const hazard of zone.hazards) {
      expect(hazard.type).toBe(GHOST_NET);
      expect(hazard.shape.kind).toBe('rect');
    }
    expect(CHINAMPA_LAYOUT.padCount).toBe(0);
    expect(CHINAMPA_LAYOUT.padSpotIndex).toBeNull();
    expect(zone.elements).toEqual([]);
    expect(tripTreasureTuning(CHINAMPA_AREA_ID).slots).toBe(9);
    expect(CHINAMPA_LAYOUT.treasures).toBe(CHINAMPA_TREASURES);
  });

  it('plays its tilapia one step up the predator ladder, keeping the warning floor and the strike time, with the full-bar chase', () => {
    expect(zone.tilapia).toEqual({ ...TILAPIA, windup: 0.85, lungeSpeed: 400, lungeRange: 145, cooldown: 2.2, patrolSpeed: 50, chase: TILAPIA_CHASE });
    expect(TILAPIA_CHASE).toEqual({ sight: 240, leash: 160, speed: 125 });
    expect(CHINAMPA_TILAPIA.chase).toBe(TILAPIA_CHASE);
    expect(tunedSpecies(TILAPIA_SPECIES, CHINAMPA_TILAPIA).tuning).toBe(CHINAMPA_TILAPIA);
    expect(CHINAMPA_TILAPIA.minWindup).toBe(0.8);
    expect(CHINAMPA_TILAPIA.lungeDuration).toBe(0.4);
    expect(CHINAMPA_TILAPIA.windup).toBeGreaterThanOrEqual(CHINAMPA_TILAPIA.minWindup);
    const tilapia = zoneThreats(zone).filter((threat) => threat.kind === 'route' && threat.tilapia);
    expect(tilapia).toHaveLength(zone.tilapiaRoutes.length);
    for (const threat of tilapia) {
      expect(threat).toMatchObject({ kind: 'route', strike: 145, tilapia: true, tuned: true });
    }
  });

  it('plays the common carp with its chase default, a danger part with B10 S = 120', () => {
    expect(CHINAMPA_CARP.id).toBe(CARP_SPECIES.id);
    expect(CHINAMPA_CARP.id).toBe('carp');
    expect(CHINAMPA_CARP.tuning).toEqual({ ...CARP, chase: CARP_CHASE });
    expect(CHINAMPA_CARP.dangerPart).toBe(true);
    expect(zone.predatorRoutes[0].species).toBe(CHINAMPA_CARP);
    const carp = zoneThreats(zone).filter((threat) => threat.kind === 'route' && !threat.tilapia);
    expect(carp.map((threat) => threat.strike)).toEqual([120]);
  });

  it('is shaped down and right: the Home Spot in the top left screen and the exit in the bottom right screen', () => {
    const { exit } = CHINAMPA_AREA;
    expect(zone.homeSpot.x).toBeLessThan(zone.width / zone.chunks);
    expect(zone.homeSpot.y).toBeLessThan(zone.height / zone.rows);
    expect(exit.x).toBeGreaterThan((zone.width * (zone.chunks - 1)) / zone.chunks);
    expect(exit.y).toBeGreaterThan(zone.height / zone.rows);
    const path = zone.mainPath;
    expect(path[0]).toEqual(zone.start);
    expect(path[path.length - 1]).toEqual({ x: exit.x, y: exit.y });
    for (let i = 2; i < path.length; i++) {
      expect(path[i].x, `main path point ${i}`).toBeGreaterThanOrEqual(path[i - 1].x);
      expect(path[i].y, `main path point ${i}`).toBeGreaterThanOrEqual(path[i - 1].y);
    }
  });

  it('adds one new thing, the ghost net, and no new element', () => {
    expect(newThingsByArea().find((things) => things.areaId === CHINAMPA_AREA_ID)).toEqual({
      areaId: CHINAMPA_AREA_ID,
      threats: ['ghost-net'],
      elements: [],
    });
  });

  it('is in the chinampa gardens habitat, numbered 4, with the Scarecrow as its special treasure', () => {
    expect(CHINAMPA_AREA.layout).toBe(CHINAMPA_LAYOUT);
    expect(CHINAMPA_AREA.number).toBe(4);
    expect(CHINAMPA_AREA.habitatId).toBe(CHINAMPA_HABITAT.id);
    expect(CHINAMPA_AREA.specialTreasureId).toBe('chinampa/scarecrow');
    expect(CHINAMPA_TREASURES.find((treasure) => treasure.id === CHINAMPA_AREA.specialTreasureId)?.rarity).toBe('rare');
    expect(CHINAMPA_AREA.look).toBeUndefined();
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = chinampa(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.hazards).toEqual(zone.hazards);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.bankOverhangs).toEqual(zone.bankOverhangs);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.movingHazards).toEqual(zone.movingHazards);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
    }
  });

  it('gives the tilapia, carp, ghost net and punting pole cards, then the tadpole and shrimp cards, from its data or its zone', () => {
    const expected = ['tilapia', 'carp', 'ghost-net', 'punting-pole', 'tadpole', 'shrimp'];
    expect(sourceFactCards(CHINAMPA_LAYOUT).ids).toEqual(expected);
    expect(sourceFactCards(zone).ids).toEqual(expected);
  });

  it('gives its fact cards in order: tilapia, carp, ghost net, punting pole, tadpole, shrimp, from its data or its zone', () => {
    const expected = {
      ids: ['tilapia', 'carp', 'ghost-net', 'punting-pole', 'tadpole', 'shrimp'],
      cards: [TILAPIA_FACT, CARP_FACT, GHOST_NET_FACT, PUNTING_POLE_FACT, TADPOLE_FACT, SHRIMP_FACT],
    };
    expect(sourceFactCards(CHINAMPA_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(zone)).toEqual(expected);
  });
});

describe('Area 4 hiding spots', () => {
  it.each(ALL_SEEDS)('match their labels, B5, B6 and B10 with S = 145, and keep the turn clearance for seed %i', (seed) => {
    const layout = chinampa(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('chinampa-1/spot-'), spot.id).toBe(true);
      expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
      expect(turnDistance(spot, layout.tilapiaRoutes), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it('bands every spot by the Area 4 strike reach: Common over S + 60, Rare over S, Epic over S / 2, Legendary within S / 2', () => {
    const bands = { common: [STRIKE + 60, Infinity], rare: [STRIKE, STRIKE + 60], epic: [STRIKE / 2, STRIKE], legendary: [-Infinity, STRIKE / 2] };
    for (const spot of zone.spots) {
      const [over, upTo] = bands[spot.rarity];
      expect(routeDistance(spot, zone.tilapiaRoutes), spot.id).toBeGreaterThan(over);
      expect(routeDistance(spot, zone.tilapiaRoutes), spot.id).toBeLessThanOrEqual(upTo);
    }
  });

  it('hides the Common and Rare spots under the overhanging banks, Commons on the main path and Rares off it', () => {
    const shallow = zone.spots.filter((spot) => spot.rarity === 'common' || spot.rarity === 'rare');
    expect(shallow.map((spot) => spot.cover)).toEqual(Array(12).fill('bank'));
    for (const spot of shallow) {
      expect(coversAt(spot, zone), spot.id).toEqual(['bank']);
      const fromPath = distanceToPath(spot, zone.mainPath);
      if (spot.rarity === 'common') expect(fromPath, spot.id).toBeLessThanOrEqual(MAIN_PATH_REACH);
      else expect(fromPath, spot.id).toBeGreaterThan(MAIN_PATH_REACH);
    }
  });

  it('puts every Epic and Legendary spot in the root tangle or just past the current', () => {
    const deep = zone.spots.filter((spot) => spot.rarity === 'epic' || spot.rarity === 'legendary');
    expect(deep.map((spot) => spot.cover)).toEqual([...Array(6).fill('cave'), ...Array(4).fill('pastCurrent')]);
    for (const spot of deep) {
      expect(spot.container, spot.id).toBe(spot.rarity === 'legendary');
    }
  });

  it.each(ALL_SEEDS)('give each rarity a pool larger than its Area 4 treasures for seed %i', (seed) => {
    const layout = chinampa(seed);
    expect(RARITIES.map((rarity) => CHINAMPA_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 2]);
    for (const rarity of RARITIES) {
      const treasures = CHINAMPA_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      const spots = layout.spots.filter((spot) => spot.rarity === rarity).length;
      expect(spots, rarity).toBeGreaterThan(treasures);
    }
    for (const find of layout.finds) {
      expect(find.pool.length, find.id).toBeGreaterThan(0);
    }
  });

  it('places every trip without throwing: the 9 slots (one left empty only once every Common and Rare is placed), the treasures lost last trip and the Scarecrow', () => {
    const all = CHINAMPA_TREASURES.map((treasure) => treasure.id);
    const commonAndRare = CHINAMPA_TREASURES.filter((treasure) => treasure.rarity === 'common' || treasure.rarity === 'rare').map((treasure) => treasure.id);
    const tuning = tripTreasureTuning(CHINAMPA_AREA_ID);
    const options = { extras: [CHINAMPA_AREA.specialTreasureId], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      const freshIds = fresh.map((find) => find.id);
      const everySlotFilled = fresh.length === tuning.slots + 1;
      expect(everySlotFilled || commonAndRare.every((id) => freshIds.includes(id)), `trip seed ${tripSeed}`).toBe(true);
      expect(freshIds).toContain(CHINAMPA_AREA.specialTreasureId);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and every net, and spaced for seed %i', (seed) => {
    const layout = chinampa(seed);
    const home = layout.homeSpot;
    for (const spot of layout.spots) {
      expect(inBounds(spot, layout), spot.id).toBe(true);
      expect(inSafeArea(spot, layout.safeArea), spot.id).toBe(false);
      expect(Math.hypot(spot.x - home.x, spot.y - home.y)).toBeGreaterThanOrEqual(home.radius + FINDS.pickupRadius + 8);
      for (const net of layout.hazards) {
        expect(shapeDistance(spot, hazardSweep(net)), `${spot.id} to ${net.id}`).toBeGreaterThanOrEqual(SPOT_NET_CLEARANCE);
      }
    }
    for (let i = 0; i < layout.spots.length; i++) {
      for (let j = i + 1; j < layout.spots.length; j++) {
        const [a, b] = [layout.spots[i], layout.spots[j]];
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} to ${b.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });

  it('keeps treasure spots in the dead ends: the root tangle in the bottom left and the bank in the top right', () => {
    const bottomLeft = zone.spots.filter((spot) => spot.x < zone.width / 3 && spot.y > zone.height / 2);
    const topRight = zone.spots.filter((spot) => spot.x > (zone.width * 5) / 6 && spot.y < zone.height / 4);
    expect(bottomLeft.map((spot) => spot.cover)).toEqual(Array(6).fill('cave'));
    expect(topRight.length).toBeGreaterThanOrEqual(5);
    expect(topRight.every((spot) => spot.cover === 'bank' && spot.rarity === 'rare')).toBe(true);
    for (const spot of [...bottomLeft, ...topRight]) {
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
    }
  });
});

describe('Area 4 root tangle, the cave', () => {
  it('sits on the bed of the bottom row, inside the swim bounds, and holds only the cave spots', () => {
    const bounds = swimBounds(zone);
    expect(zone.cave).toEqual({ id: 'chinampa-1/cave', x0: 410, x1: 590, y0: 560, y1: 678 });
    expect(zone.cave.y1).toBe(zone.bedTop);
    expect(zone.cave.y0).toBeGreaterThan(zone.height / 2);
    expect(zone.cave.x0).toBeGreaterThan(zone.safeArea.x1);
    expect(zone.cave.y0).toBeLessThanOrEqual(bounds.maxY);
    for (const spot of zone.spots.filter((candidate) => candidate.cover === 'cave')) {
      expect(coversAt(spot, zone), spot.id).toEqual(['cave']);
    }
  });
});

describe('Area 4 banks', () => {
  it('has garden plots on the top row, none over the gap current, and its overhangs under them only', () => {
    expect(zone.bankChunks).toEqual([1, 2, 3, 5]);
    expect(zone.sunChunk).toBe(0);
    const currentColumn = Math.floor(zone.currents[0].x0 / (zone.width / zone.chunks));
    expect(zone.bankChunks).not.toContain(currentColumn);
    expect(zone.bankOverhangs).toHaveLength(zone.bankChunks.length);
    for (const [index, overhang] of (zone.bankOverhangs ?? []).entries()) {
      const column = zone.bankChunks[index];
      expect(overhang.x0).toBeGreaterThanOrEqual(column * 480);
      expect(overhang.x1).toBeLessThanOrEqual((column + 1) * 480);
      expect(overhang.y0).toBe(SURF);
      expect(overhang.y1).toBeLessThan(zone.height / 4);
    }
  });
});

describe('Area 4 tilapia, carp, current and stranding places', () => {
  it('keeps every two tilapia routes more than twice the Area 4 lunge range apart', () => {
    for (const [i, first] of zone.tilapiaRoutes.entries()) {
      for (const second of zone.tilapiaRoutes.slice(i + 1)) {
        expect(routeGap(first, second), `${first.id} to ${second.id}`).toBeGreaterThan(2 * STRIKE);
      }
    }
  });

  it('keeps the carp loop farther than its lunge plus the Area 4 lunge from every tilapia route', () => {
    const [carp] = zone.predatorRoutes;
    for (const route of zone.tilapiaRoutes) {
      expect(routeGap(carp, route), route.id).toBeGreaterThan(CARP_STRIKE + STRIKE);
    }
  });

  it('keeps the tilapia and carp routes in the water and out of the safe area, by their body radius', () => {
    for (const route of predatorLoops(zone)) {
      for (const point of route.waypoints) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(point.x - tuningOf(zone, route).bodyRadius, route.id).toBeGreaterThan(zone.safeArea.x1);
      }
    }
  });

  it('flows sideways through the gap in the bottom row, away from home, with the spots past it', () => {
    expect(zone.currents).toHaveLength(1);
    const current = zone.currents[0];
    expect(current.force.y).toBe(0);
    expect(current.force.x).toBeLessThan(0);
    expect(zone.homeSpot.x).toBeLessThan(current.x0);
    expect(current.y0).toBeGreaterThan(zone.height / 2);
    for (const spot of zone.spots.filter((candidate) => candidate.cover === 'pastCurrent')) {
      expect(spot.x, spot.id).toBeGreaterThan(current.x1);
      expect(spot.x, spot.id).toBeLessThanOrEqual(current.x1 + PAST_CURRENT_DEPTH);
      expect(spot.y, spot.id).toBeGreaterThanOrEqual(current.y0);
      expect(spot.y, spot.id).toBeLessThanOrEqual(current.y1);
    }
  });

  it('has a current that one leg still beats, by 18 px/s', () => {
    const strength = Math.hypot(zone.currents[0].force.x, zone.currents[0].force.y);
    expect(strength).toBe(72);
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - strength).toBe(18);
  });

  it.each(ALL_SEEDS)('keeps every stranding place 80 px from every route and clear of nets, poles, spots, the current and the cave for seed %i', (seed) => {
    const layout = chinampa(seed);
    expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `chinampa-1/strand-${n}`));
    for (const place of layout.strandingPlaces) {
      expect(inBounds(place, layout), place.id).toBe(true);
      expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
      expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
      expect(shapeDistance(place, { kind: 'rect', ...layout.cave }), place.id).toBeGreaterThan(0);
      expect(routeDistance(place, predatorLoops(layout)), place.id).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
      for (const net of layout.hazards) {
        expect(shapeDistance(place, hazardSweep(net)), `${place.id} to ${net.id}`).toBeGreaterThanOrEqual(STRAND_NET_CLEARANCE);
      }
      for (const pole of polesOf(layout)) {
        expect(shapeDistance(place, movingHazardSweep(pole)), `${place.id} to ${pole.id}`).toBeGreaterThanOrEqual(STRAND_POLE_CLEARANCE);
      }
      for (const spot of layout.spots) {
        expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });
});

describe('Area 4 exit', () => {
  const { exit } = CHINAMPA_AREA;

  it('sits at the far right of the bottom row, past the current, inside the bounds, out of the safe area and the ring', () => {
    expect(exit).toEqual({ x: 2780, y: 625, radius: 40 });
    expect(exit.x).toBeGreaterThan(Math.max(...zone.currents.map((current) => current.x1)));
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
    expect(Math.hypot(exit.x - zone.homeSpot.x, exit.y - zone.homeSpot.y)).toBeGreaterThan(zone.homeSpot.radius + exit.radius);
    for (const route of predatorLoops(zone)) {
      expect(routeLoopDistance(exit, route.waypoints), route.id).toBeGreaterThan(lungeOf(zone, route));
    }
  });

  it('is clear of every net and pole: no point of the exit is within a net reach or a pole danger zone', () => {
    for (const net of zone.hazards) {
      expect(shapeDistance(exit, hazardSweep(net)), net.id).toBeGreaterThan(exit.radius + GHOST_NET.reach);
    }
    for (const pole of polesOf(zone)) {
      expect(shapeDistance(exit, movingHazardSweep(pole)), pole.id).toBeGreaterThan(exit.radius + pole.type.touchReach);
    }
  });

  it.each(ALL_SEEDS)('is clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    const clearance = exit.radius + FINDS.pickupRadius;
    for (const spot of chinampa(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(clearance);
    }
  });
});

describe('Area 4 ghost nets', () => {
  const nets = netShapes(zone);

  it('drift the two bottom-row nets in step 120 px along the flow, the way between them 100 px tall, and keep the others still', () => {
    const [first, second, ...still] = zone.hazards;
    for (const net of [first, second]) {
      expect(net.drift, net.id).toEqual({ dx: -120, dy: 0, period: DRIFTING_NETS.period, offset: 0 });
    }
    for (const net of still) expect(net.drift, net.id).toBeUndefined();
    expect(Math.sign(first.drift?.dx ?? 0)).toBe(Math.sign(zone.currents[0].force.x));
    for (let t = 0; t <= DRIFTING_NETS.period; t += 0.5) {
      const [top, bottom] = [hazardShapeAt(first, t), hazardShapeAt(second, t)];
      if (top.kind !== 'rect' || bottom.kind !== 'rect') throw new Error('the bottom-row nets must be rects');
      expect(bottom.x0, `t ${t}`).toBeCloseTo(top.x0, 9);
      expect(bottom.y0 - top.y1, `t ${t}`).toBe(100);
      expect(bottom.y0 - top.y1 - 2 * GHOST_NET.reach, `t ${t}`).toBe(64);
    }
  });

  it('sit in the water, outside the safe area and clear of the Home Spot ring', () => {
    for (const [index, net] of nets.entries()) {
      expect(rectDistance(net, { kind: 'rect', ...zone.safeArea }), `net ${index + 1}`).toBeGreaterThan(0);
      expect(shapeDistance(zone.homeSpot, net), `net ${index + 1}`).toBeGreaterThan(zone.homeSpot.radius + GHOST_NET.reach);
      expect(inBounds(hazardCentre(net), zone), `net ${index + 1}`).toBe(true);
    }
  });

  it('sit, by their whole drift path, farther than a lunge from every tilapia and carp route', () => {
    for (const [index, net] of nets.entries()) {
      for (const route of predatorLoops(zone)) {
        expect(shapeRouteDistance(net, route.waypoints), `net ${index + 1} to ${route.id}`).toBeGreaterThan(lungeOf(zone, route));
      }
    }
  });

  it('sit far enough from every current that snag time ends before the axolotl reaches it', () => {
    expect(NET_CURRENT_CLEARANCE).toBeCloseTo(190.5, 5);
    for (const [index, net] of nets.entries()) {
      for (const current of zone.currents) {
        expect(rectDistance(net, rectOf(current)), `net ${index + 1} to ${current.id}`).toBeGreaterThanOrEqual(NET_CURRENT_CLEARANCE);
      }
    }
  });

  it('leave a snagged one-leg axolotl no headway against the current, so a snag in it could never be beaten', () => {
    const snaggedOneLeg = SWIM.maxSpeed * LEGS.speedByLegs[0] * GHOST_NETS.speedFactor;
    expect(snaggedOneLeg).toBe(45);
    expect(snaggedOneLeg).toBeLessThan(Math.hypot(zone.currents[0].force.x, zone.currents[0].force.y));
  });
});

describe('Area 4 gaps (the level layout ladder)', () => {
  const gaps = gapsOf(zone);
  const narrowest = narrowestPathGap(zone);
  const pond2Narrowest = narrowestPathGap(pond2);

  it('defines the safe passing width as one body height: twice the net reach, 36 px', () => {
    expect(SAFE_PASSING_WIDTH).toBe(36);
  });

  it('never leaves a gap beside a net under the safe passing width', () => {
    for (const gap of gaps.filter((candidate) => candidate.hazard)) {
      expect(gap.width, gap.between).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    }
  });

  it('measures Area 3 the same way: its narrowest hazard gap on the main path is between its first two plastic worms, as it swims under the herons inside their reach', () => {
    expect(pond2Narrowest.between).toBe('pond-2/plastic-worm-1 and pond-2/plastic-worm-2');
    expect(pond2Narrowest.width).toBeCloseTo(Math.hypot(540 - 420, 290 - 120) - 36 - 36, 5);
    expect(pond2Narrowest.width).toBeCloseTo(136.09, 2);
  });

  it('swims the main path through a gap between two nets tighter than Area 3 narrowest, and never under the safe passing width', () => {
    expect(narrowest.between).toBe('chinampa-1/ghost-net-3 and chinampa-1/ghost-net-4');
    expect(narrowest.width).toBe(64);
    expect(narrowest.width).toBeLessThan(pond2Narrowest.width);
    expect(narrowest.width).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
  });

  it('leaves the bottom-row way a gap between two nets as tight as the main path one', () => {
    const bottom = gaps.find((gap) => gap.between === 'chinampa-1/ghost-net-1 and chinampa-1/ghost-net-2');
    expect(bottom?.width).toBe(64);
  });
});

describe('Area 4 danger bar', () => {
  it.each(ALL_SEEDS)('meets the full danger bar for seed %i', (seed) => {
    expect(meetsFullDangerBar(chinampa(seed))).toBe(true);
  });

  it('has 9 moving threats over its 12 screens, 2 predator species, 1 moving hazard type, and every predator chases', () => {
    const screens = (zone.width / SCREEN_W) * (zone.height / WORLD_H);
    expect(screens).toBe(12);
    expect(movingThreatCount(zone)).toBe(9);
    expect(movingThreatCount(zone)).toBeGreaterThanOrEqual(Math.ceil(0.75 * screens));
    expect(predatorTypeCount(zone)).toBe(2);
    expect(movingHazardTypeCount(zone)).toBe(1);
    expect(zone.tilapia?.chase).toBeDefined();
    expect(zone.predatorRoutes.every((route) => route.species.tuning.chase !== undefined)).toBe(true);
  });

  it('leaves no stretch of the main path longer than one screen with no moving threat in reach', () => {
    expect(longestQuietStretch(zone)).toBeCloseTo(LONGEST_QUIET_STRETCH, 6);
    expect(longestQuietStretch(zone)).toBeLessThanOrEqual(SCREEN_W);
  });

  it('puts each pole in a top-row screen column with no bank, its danger zone out of the safe area and every overhang', () => {
    for (const pole of polesOf(zone)) {
      const column = Math.floor(pole.x / SCREEN_W);
      const zoneRect = dangerZone(pole);
      expect(zone.bankChunks, pole.id).not.toContain(column);
      expect(zoneRect.x0 - pole.x, pole.id).toBe(-23);
      expect(zoneRect.x0, pole.id).toBeGreaterThan(zone.safeArea.x1);
      for (const overhang of zone.bankOverhangs ?? []) {
        expect(overhang.y1, pole.id).toBe(BANK_UNDER_Y);
        expect(rectsOverlap(zoneRect, overhang), `${pole.id} under the bank at x ${overhang.x0}`).toBe(false);
      }
    }
    expect(polesOf(zone).map((pole) => [pole.x, pole.offset, pole.depth])).toEqual([
      [420, 0, 180],
      [2075, 2, 350],
    ]);
    expect(polesOf(zone).every((pole) => pole.type === PUNTING_POLE)).toBe(true);
  });

  it('keeps each pole sweep farther than every predator lunge from its loop, and the pole danger zones apart', () => {
    for (const pole of polesOf(zone)) {
      for (const route of predatorLoops(zone)) {
        expect(shapeRouteDistance(movingHazardSweep(pole), route.waypoints), `${pole.id} to ${route.id}`).toBeGreaterThan(lungeOf(zone, route));
      }
    }
    const [first, second] = polesOf(zone).map(dangerZone);
    expect(rectsOverlap(first, second)).toBe(false);
  });

  it('keeps the exit farther than every predator lunge from its loop and outside every pole danger zone', () => {
    const { exit } = CHINAMPA_AREA;
    expect(exit).toMatchObject({ x: 2780, y: 625 });
    for (const route of predatorLoops(zone)) {
      expect(routeLoopDistance(exit, route.waypoints), route.id).toBeGreaterThan(lungeOf(zone, route));
    }
    for (const pole of polesOf(zone)) {
      expect(rectsOverlap(dangerZone(pole), { x0: exit.x, x1: exit.x, y0: exit.y, y1: exit.y }), pole.id).toBe(false);
    }
  });
});

describe('Area 4 snacks', () => {
  const drift = CHINAMPA_AREA.snackDrift;
  const surfacePeak = SURF + 1.6 + 0.8;
  const mix = zone.mobileSnacks;

  it.each(SNACK_SEEDS)('build and start the worms and bugs at least SNACK_HAZARD_CLEARANCE from every net drift path and pole sweep for seed %i', (seed) => {
    const layout = chinampa(seed);
    expect(layout.collectibles).toHaveLength(28);
    const keepAway = [...layout.hazards.map((hazard) => ({ id: hazard.id, shape: hazardSweep(hazard) })), ...polesOf(layout).map((pole) => ({ id: pole.id, shape: movingHazardSweep(pole) }))];
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
      if (snack.kind !== 'worm' && snack.kind !== 'bug') continue;
      for (const { id, shape } of keepAway) {
        expect(shapeDistance(snack, shape), `${snack.id} to ${id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it.each(ALL_SEEDS)('put at least 4 snacks in the current, every one a worm or a bug, for seed %i', (seed) => {
    const layout = chinampa(seed);
    const inCurrent = layout.collectibles.filter((snack) => layout.currents.some((current) => isInsideCurrent(snack, current)));
    expect(CHINAMPA_LAYOUT.snacksInCurrent).toBe(4);
    expect(inCurrent.length).toBeGreaterThanOrEqual(CHINAMPA_LAYOUT.snacksInCurrent);
    for (const snack of inCurrent) {
      expect(['worm', 'bug'], snack.id).toContain(snack.kind);
    }
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting or swimming their lanes for seed %i', (seed) => {
    const layout = chinampa(seed);
    const bounds = swimBounds(layout);
    const items = createCollectibles(layout.collectibles);
    for (let t = 0; t <= 120; t += 0.25) {
      const frame: SnackFrame = { driftT: t, bobT: t, bobbing: true, drift, bounds };
      for (let index = 0; index < items.length; index++) {
        const snack = snackAt(items[index], index, frame);
        expect(inBounds(snack, layout)).toBe(true);
        expect(snack.y).toBeGreaterThan(surfacePeak);
        expect(inHomeSpot(snack, layout.homeSpot)).toBe(false);
      }
    }
  });

  it('drift a little faster than Area 3, slower than a one-leg axolotl swims against the current, and at most half the magnet pull', () => {
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.hypot(zone.currents[0].force.x, zone.currents[0].force.y);
    expect(snackDriftMaxSpeed(drift)).toBeCloseTo(15.6, 1);
    expect(snackDriftMaxSpeed(drift)).toBeGreaterThan(snackDriftMaxSpeed(POND_2_AREA.snackDrift));
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it('meets the Area 4 snack ramp: 7 tadpoles and 7 shrimp of 28 snacks, half of them mobile, tadpoles at 48 px/s', () => {
    expect(meetsSnackRamp(4, CHINAMPA_LAYOUT)).toBe(true);
    expect(mobileSnackShare(CHINAMPA_LAYOUT)).toBe(0.5);
    expect(CHINAMPA_LAYOUT.snackWorms).toBe(8);
    expect(CHINAMPA_LAYOUT.snackBugs).toBe(6);
    expect(mix?.lanes).toHaveLength(7);
    expect(mix?.spots).toHaveLength(7);
    expect(mix?.tadpole).toEqual({ speed: 48 });
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 1.4, flickDistance: 52, flickSpeed: 130 });
  });

  it('gives each tadpole a 120 px lane along the flow, lane n (n - 1) sevenths of its 5 s cycle ahead', () => {
    const loopSeconds = (2 * 120) / 48;
    expect(loopSeconds).toBe(5);
    for (const [index, lane] of (mix?.lanes ?? []).entries()) {
      expect(Math.hypot(lane.dx, lane.dy), `lane ${index + 1}`).toBe(120);
      expect(lane.dy, `lane ${index + 1}`).toBe(0);
      expect(lane.offset, `lane ${index + 1}`).toBeCloseTo((index * loopSeconds) / 7, 9);
    }
  });

  it.each(ALL_SEEDS)('keeps every tadpole lane and shrimp spot clear (mobileSnackClear) for seed %i', (seed) => {
    const layout = chinampa(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const lane of layout.mobileSnacks?.lanes ?? []) {
      expect(mobileSnackClear(tadpoleLaneBox(lane), avoid), `lane at (${lane.x}, ${lane.y})`).toBe(true);
    }
    for (const spot of layout.mobileSnacks?.spots ?? []) {
      expect(mobileSnackClear(shrimpBox(spot, drift), avoid), `shrimp at (${spot.x}, ${spot.y})`).toBe(true);
    }
  });

  it('pulls its snacks with the Snack magnet at 1.2 times the tadpole speed, 57.6 px/s', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBeCloseTo(57.6, 9);
  });

  it.each(ALL_SEEDS)('turns the one-time darters off with its shrimp for seed %i', (seed) => {
    expect(CHINAMPA_AREA.snackDart).toBe(SNACK_DART);
    expect(oneTimeDarts(CHINAMPA_AREA, chinampa(seed))).toBeNull();
  });

  it.each(ALL_SEEDS)('gives every shrimp spot a clear flick target in at least one of 8 directions for seed %i', (seed) => {
    const layout = chinampa(seed);
    for (const spot of layout.mobileSnacks?.spots ?? []) {
      expect(hasClearFlick(layout, spot), `shrimp at (${spot.x}, ${spot.y})`).toBe(true);
    }
  });
});

describe('Area 4 difficulty', () => {
  it('is bigger than Area 3: twice as tall, more snacks, faster drift, more slots and a stronger tilapia strike', () => {
    expect(zone.width).toBeGreaterThanOrEqual(pond2.width);
    expect(zone.height).toBe(2 * pond2.height);
    expect(zone.collectibles.length).toBeGreaterThan(pond2.collectibles.length);
    expect(snackDriftMaxSpeed(CHINAMPA_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(POND_2_AREA.snackDrift));
    expect(tripTreasureTuning(CHINAMPA_AREA_ID).slots).toBeGreaterThan(tripTreasureTuning(POND_2_AREA.id).slots);
    expect(CHINAMPA_TILAPIA.lungeRange).toBeGreaterThan(TILAPIA.lungeRange);
    expect(CHINAMPA_TILAPIA.windup).toBeLessThan(TILAPIA.windup);
  });
});

describe('beating Area 4', () => {
  it('lets a one-leg axolotl swim the main path, through the current, to the exit and back home', () => {
    const exit = CHINAMPA_AREA.exit;
    const there = zone.mainPath.slice(1);
    const toExit = oneLegSeconds(zone.start, there, zone, (pos) => Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius);
    expect(toExit).toBeLessThan(BEAT_MAX_SECONDS);
    const back = [...zone.mainPath].reverse();
    const home = oneLegSeconds(exit, back, zone, (pos) => inHomeSpot(pos, zone.homeSpot));
    expect(home).toBeLessThan(BEAT_MAX_SECONDS);
  });

  it('swims the main path through the current', () => {
    const current = zone.currents[0];
    const crossing = zone.mainPath.slice(1).some((point, i) => {
      const from = zone.mainPath[i];
      return from.y === point.y && from.y >= current.y0 && from.y <= current.y1 && from.x <= current.x0 && point.x >= current.x1;
    });
    expect(crossing).toBe(true);
  });
});
