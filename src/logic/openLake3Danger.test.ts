/**
 * Area 14's danger pass (issue #213; ADR 0041): the whole-water full danger bar over its 17 screens
 * of water, the band rule (each band its own danger: the pelicans and cormorants in band 1, the
 * tilapia and carp in band 2, the mud turtles in band 3), the floor rule over the stepped floor of
 * both pits, the carp target and the longest quiet swim, as Area 13's danger proofs. The sharp
 * litter lies still, so it is no moving threat and leaves the bar as the predators and the pelican
 * lines set it.
 */
import { describe, expect, it } from 'vitest';
import {
  carpCount,
  carpTarget,
  floorQuietStretch,
  hasSurfaceDanger,
  legCostingMovingHazardTypeCount,
  longestQuietSwim,
  meetsBandDepthRule,
  meetsDepthRule,
  meetsFloorRule,
  meetsWholeWaterDangerBar,
  movingThreatCount,
  predatorTypeCount,
  waterDepthBands,
  waterScreenCount,
} from './dangerBar';
import { OPEN_LAKE_3_LAYOUT } from './openLake3Layout';
import { pelicanBirdCount, pelicanLineSweep } from './pelicanLine';
import { CARP_SPECIES, CORMORANT_SPECIES, MUD_TURTLE_SPECIES, type PredatorRoute } from './predators';
import { DEFAULT_ZONE_SEED, SCREEN_W, WORLD_H, buildZone, swimBounds, type Point, type ZoneLayout } from './zone';

const EXTRA_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
/** The longest quiet swim the danger bar allows in px: one screen across. */
const QUIET_SWIM_LIMIT = SCREEN_W;
/** Longest quiet swim in the whole water in px, as measured, and where it starts and ends: down the west ledge's water by the west shallows. */
const LONGEST_QUIET_SWIM = { length: 422.96, from: { x: 1112, y: 318 }, to: { x: 960, y: 678 } };
/** Longest quiet stretch of the floor lane in px, as measured, with the mud turtles and without them. */
const FLOOR_QUIET_STRETCH = 151;
const FLOOR_QUIET_STRETCH_WITHOUT_TURTLES = 560;
/** How far in px a loop must reach toward each edge of its band (the band rule's BAND_REACH). */
const BAND_REACH = 24;

const zone = buildZone(OPEN_LAKE_3_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const lines = zone.pelicanLines ?? [];

/** The zone's predator routes of one species. */
function routesOf(layout: Pick<ZoneLayout, 'predatorRoutes'>, speciesId: string): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === speciesId);
}

/** The y span of a route's waypoints. */
function ySpan(waypoints: readonly Point[]): { top: number; bottom: number } {
  const ys = waypoints.map((point) => point.y);
  return { top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** Whether a y span lies wholly in a band, edges included. */
function inBand(span: { top: number; bottom: number }, band: { top: number; bottom: number }): boolean {
  return span.top >= band.top && span.bottom <= band.bottom;
}

describe('Area 14 danger pass (issue #213)', () => {
  it('meets the full danger bar with the whole-water test', () => {
    expect(meetsWholeWaterDangerBar(zone)).toBe(true);
  });

  it('counts 18 moving threats for its 17 screens of water, at least ceil(0.75 x 17) = 13, 4 predator types and the pelican line in the moving hazard slot: the tilapia, the predators and the birds, never the still litter', () => {
    expect(waterScreenCount(zone)).toBe(17);
    const birds = lines.reduce((count, line) => count + pelicanBirdCount(line), 0);
    expect([zone.tilapiaRoutes.length, zone.predatorRoutes.length, birds]).toEqual([2, 10, 6]);
    expect(movingThreatCount(zone)).toBe(18);
    expect(zone.hazards).toHaveLength(4);
    expect(Math.ceil(0.75 * waterScreenCount(zone))).toBe(13);
    expect(predatorTypeCount(zone)).toBe(4);
    expect(legCostingMovingHazardTypeCount(zone)).toBe(1);
  });

  it('has every predator chase but the mud turtle, which is built never to chase', () => {
    expect(zone.tilapia?.chase).toBeDefined();
    for (const route of zone.predatorRoutes) {
      if (route.species.id === MUD_TURTLE_SPECIES.id) {
        expect(route.species.tuning.chase, route.id).toBeUndefined();
        expect(route.species.rules?.fixedStrikeSpot, route.id).toBe(true);
      } else {
        expect(route.species.tuning.chase, route.id).toBeDefined();
      }
    }
  });

  it('never leaves a quiet swim in the whole water longer than one screen across, rock counted as no water', () => {
    const swim = longestQuietSwim(zone);
    expect(swim?.length).toBeCloseTo(LONGEST_QUIET_SWIM.length, 1);
    expect(swim?.from).toEqual(LONGEST_QUIET_SWIM.from);
    expect(swim?.to).toEqual(LONGEST_QUIET_SWIM.to);
    expect(swim?.length).toBeLessThanOrEqual(QUIET_SWIM_LIMIT);
  });

  it('has surface danger and keeps the floor lane over both pits quiet for no more than one screen across, the mud turtles guarding the pit floors', () => {
    expect(hasSurfaceDanger(zone)).toBe(true);
    expect(floorQuietStretch(zone)).toBeCloseTo(FLOOR_QUIET_STRETCH, 1);
    expect(meetsFloorRule(zone)).toBe(true);
    const noTurtles: ZoneLayout = { ...zone, predatorRoutes: zone.predatorRoutes.filter((route) => route.species.id !== MUD_TURTLE_SPECIES.id) };
    expect(floorQuietStretch(noTurtles)).toBeCloseTo(FLOOR_QUIET_STRETCH_WITHOUT_TURTLES, 1);
    expect(floorQuietStretch(noTurtles)).toBeGreaterThan(QUIET_SWIM_LIMIT);
  });

  it('meets the band rule: the tilapia and the carp each reach both edges of band 2, within 24 px', () => {
    expect(meetsBandDepthRule(zone)).toBe(true);
    expect(meetsDepthRule(zone)).toBe(true);
    const [, band2] = waterDepthBands(zone);
    for (const routes of [zone.tilapiaRoutes, routesOf(zone, CARP_SPECIES.id)]) {
      const spans = routes.map((route) => ySpan(route.waypoints));
      expect(Math.min(...spans.map((span) => span.top))).toBeLessThanOrEqual(band2.top + BAND_REACH);
      expect(Math.max(...spans.map((span) => span.bottom))).toBeGreaterThanOrEqual(band2.bottom - BAND_REACH);
    }
  });

  it('has the carp target from its screens of water: 6 carp for 17 screens, all in band 2', () => {
    expect(carpTarget(waterScreenCount(zone))).toBe(6);
    expect(carpCount(zone)).toBe(6);
  });

  it('gives every band its own danger: the pelican lines and cormorants in band 1, the tilapia and carp in band 2, and the mud turtles alone in band 3', () => {
    const bands = waterDepthBands(zone);
    expect(bands).toEqual([
      { top: bounds.minY, bottom: WORLD_H },
      { top: WORLD_H, bottom: 2 * WORLD_H },
      { top: 2 * WORLD_H, bottom: bounds.maxY },
    ]);
    const [band1, band2, band3] = bands;
    for (const line of lines) {
      const sweep = pelicanLineSweep(line);
      expect(inBand({ top: Math.max(sweep.y0, bounds.minY), bottom: sweep.y1 }, band1), line.id).toBe(true);
    }
    for (const route of routesOf(zone, CORMORANT_SPECIES.id)) expect(inBand(ySpan(route.waypoints), band1), route.id).toBe(true);
    for (const route of [...zone.tilapiaRoutes, ...routesOf(zone, CARP_SPECIES.id)]) expect(inBand(ySpan(route.waypoints), band2), route.id).toBe(true);
    const deep = [...zone.tilapiaRoutes, ...zone.predatorRoutes].filter((route) => ySpan(route.waypoints).bottom > band3.top);
    expect(deep.map((route) => route.id)).toEqual(['mud-turtle-0', 'mud-turtle-1']);
    for (const route of deep) expect(inBand(ySpan(route.waypoints), band3), route.id).toBe(true);
  });

  it.each(EXTRA_SEEDS)('builds the same threats and water as the default seed for seed %i, so the bar holds for it too', (seed) => {
    const layout = buildZone(OPEN_LAKE_3_LAYOUT, seed);
    expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
    expect(layout.pelicanLines).toEqual(zone.pelicanLines);
    expect(layout.movingHazards).toEqual(zone.movingHazards);
    expect(layout.hazards).toEqual(zone.hazards);
    expect(layout.rockWalls).toEqual(zone.rockWalls);
    expect(layout.safeArea).toEqual(zone.safeArea);
    expect([layout.width, layout.height, layout.bedTop]).toEqual([zone.width, zone.height, zone.bedTop]);
  });
});
