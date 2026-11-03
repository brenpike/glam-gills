import { describe, expect, it } from 'vitest';
import { GHOST_NET, netDrift } from './ghostNets';
import type { HazardShape, HazardSpawn } from './hazards';
import {
  NET_CURRENT_CLEARANCE,
  SAFE_PASSING_WIDTH,
  gapsOf,
  loopSamples,
  narrowestPathGap,
  obstaclesOf,
  onMainPath,
  type ExtraObstacle,
  type Gap,
} from './layoutGaps';
import { PUNTING_POLE, movingHazardSpawn, movingHazardSweep } from './movingHazards';
import { murkyPatchSpawn } from './murkyWater';
import { TILAPIA } from './tuning';
import { SURF, type Point, type TilapiaRoute, type ZoneLayout } from './zone';

const NET_TEN = { ...GHOST_NET, reach: 10 };
const STRIKE = 30;

function net(id: string, shape: HazardShape): HazardSpawn {
  return { id, type: NET_TEN, shape };
}

function rect(x0: number, x1: number, y0: number, y1: number): HazardShape {
  return { kind: 'rect', x0, x1, y0, y1 };
}

type TestGeometry = Pick<ZoneLayout, 'areaId' | 'mainPath' | 'hazards' | 'tilapiaRoutes' | 'tilapia' | 'predatorRoutes'>;

function geometry(hazards: HazardSpawn[], tilapiaRoutes: TilapiaRoute[] = [], mainPath: Point[] = []): TestGeometry {
  return { areaId: 'test-1', mainPath, hazards, tilapiaRoutes, tilapia: { ...TILAPIA, lungeRange: STRIKE }, predatorRoutes: [] };
}

function gapNamed(gaps: Gap[], between: string): Gap {
  const gap = gaps.find((candidate) => candidate.between === between);
  if (!gap) throw new Error(`no gap ${between}`);
  return gap;
}

const square: TilapiaRoute = {
  id: 'route-1',
  waypoints: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ],
};

describe('layout gap constants', () => {
  it('sets the safe passing width to one body height: twice the net reach, 36 px', () => {
    expect(SAFE_PASSING_WIDTH).toBe(2 * GHOST_NET.reach);
    expect(SAFE_PASSING_WIDTH).toBe(36);
  });

  it('sets the net to current clearance to 190.5 px', () => {
    expect(NET_CURRENT_CLEARANCE).toBeCloseTo(190.5, 5);
  });
});

describe('loopSamples', () => {
  it('samples a closed loop every px, starting at the first waypoint', () => {
    const samples = loopSamples(square.waypoints);
    expect(samples).toHaveLength(400);
    expect(samples[0]).toEqual({ x: 0, y: 0 });
    expect(samples[1]).toEqual({ x: 1, y: 0 });
    expect(samples[399]).toEqual({ x: 0, y: 1 });
  });
});

describe('obstaclesOf', () => {
  it('lists the hazards by reach, then the routes by strike', () => {
    const geo = geometry([net('net-1', rect(200, 260, 0, 100))], [square]);
    expect(obstaclesOf(geo)).toEqual([
      { id: 'net-1', kind: 'shape', shape: rect(200, 260, 0, 100), keepOut: 10 },
      { id: 'route-1', kind: 'route', waypoints: square.waypoints, keepOut: STRIKE },
    ]);
  });

  it('gives the same obstacles with no extras as with an empty extra list', () => {
    const geo = geometry([net('net-1', rect(200, 260, 0, 100))], [square]);
    expect(obstaclesOf(geo, [])).toEqual(obstaclesOf(geo));
  });

  it("keeps a still hazard's own shape object", () => {
    const still = net('net-1', rect(200, 260, 0, 100));
    const [obstacle] = obstaclesOf(geometry([still]));
    expect(obstacle.kind === 'shape' && obstacle.shape).toBe(still.shape);
  });

  it('measures a drifting net by its whole drift path (N3)', () => {
    const drifting: HazardSpawn = { ...net('net-1', rect(200, 260, 0, 100)), drift: netDrift(-120, 40, 16, 0) };
    expect(obstaclesOf(geometry([drifting]))).toEqual([{ id: 'net-1', kind: 'shape', shape: rect(80, 260, 0, 140), keepOut: 10 }]);
  });

  it('lists each moving hazard sweep after the hazards and before the extras, by its touch reach (ND-8)', () => {
    const pole = movingHazardSpawn('pole-1', PUNTING_POLE, 600, 0);
    const geo = { ...geometry([net('net-1', rect(200, 260, 0, 100))], [square]), movingHazards: [pole] };
    const mat: ExtraObstacle = { id: 'mat-1', shape: rect(400, 500, 0, 50), keepOut: 4 };
    expect(obstaclesOf(geo, [mat])).toEqual([
      { id: 'net-1', kind: 'shape', shape: rect(200, 260, 0, 100), keepOut: 10 },
      { id: 'pole-1', kind: 'shape', shape: movingHazardSweep(pole), keepOut: PUNTING_POLE.touchReach },
      { id: 'mat-1', kind: 'shape', shape: rect(400, 500, 0, 50), keepOut: 4 },
      { id: 'route-1', kind: 'route', waypoints: square.waypoints, keepOut: STRIKE },
    ]);
    expect(movingHazardSweep(pole)).toEqual(rect(595, 605, SURF, SURF + 180));
  });

  it('gives the same obstacles with an empty moving hazard list as with none', () => {
    const geo = geometry([net('net-1', rect(200, 260, 0, 100))], [square]);
    expect(obstaclesOf({ ...geo, movingHazards: [] })).toEqual(obstaclesOf(geo));
  });

  it('puts extra shapes after the hazards and before the routes, with their own keep-out', () => {
    const geo = geometry([net('net-1', rect(200, 260, 0, 100))], [square]);
    const mat: ExtraObstacle = { id: 'mat-1', shape: rect(400, 500, 0, 50), keepOut: 4 };
    expect(obstaclesOf(geo, [mat]).map((obstacle) => [obstacle.id, obstacle.kind, obstacle.keepOut])).toEqual([
      ['net-1', 'shape', 10],
      ['mat-1', 'shape', 4],
      ['route-1', 'route', STRIKE],
    ]);
  });

  it('leaves out a murky patch, which is swum through, not round (issue #107)', () => {
    const murky = murkyPatchSpawn('murky-1', { x0: 300, x1: 500, y0: 0, y1: 200 });
    const geo = geometry([net('net-1', rect(200, 260, 0, 100)), murky], [square]);
    expect(obstaclesOf(geo).map((obstacle) => obstacle.id)).toEqual(['net-1', 'route-1']);
    expect(gapsOf(geo).map((gap) => gap.between)).toEqual(['net-1 and route-1']);
  });
});

describe('gapsOf', () => {
  it('measures two facing rects across their overlap, less each reach', () => {
    const [gap] = gapsOf(geometry([net('a', rect(0, 100, 0, 100)), net('b', rect(200, 300, 50, 150))]));
    expect(gap.between).toBe('a and b');
    expect(gap.width).toBe(80);
    expect(gap.from).toEqual({ x: 110, y: 75 });
    expect(gap.to).toEqual({ x: 190, y: 75 });
    expect(gap.hazard).toBe(true);
  });

  it('measures a circle from its centre to the nearest point of a rect', () => {
    const [gap] = gapsOf(geometry([net('worm', { kind: 'circle', x: 0, y: 0, r: 0 }), net('box', rect(50, 60, -5, 5))]));
    expect(gap.between).toBe('worm and box');
    expect(gap.width).toBe(30);
    expect(gap.from).toEqual({ x: 10, y: 0 });
    expect(gap.to).toEqual({ x: 40, y: 0 });
  });

  it('measures a rect to a route loop, less the reach and the strike, as a hazard gap', () => {
    const [gap] = gapsOf(geometry([net('net-1', rect(150, 200, 0, 100))], [square]));
    expect(gap.between).toBe('net-1 and route-1');
    expect(gap.width).toBe(50 - 10 - STRIKE);
    expect(gap.from.x).toBe(140);
    expect(gap.to.x).toBe(130);
    expect(gap.hazard).toBe(true);
  });

  it('marks a gap between two routes as a timing passage, not a hazard gap', () => {
    const far: TilapiaRoute = { id: 'route-2', waypoints: square.waypoints.map((point) => ({ x: point.x + 300, y: point.y })) };
    const [gap] = gapsOf(geometry([], [square, far]));
    expect(gap.between).toBe('route-1 and route-2');
    expect(gap.width).toBe(200 - 2 * STRIKE);
    expect(gap.hazard).toBe(false);
  });

  it("measures a drifting net's gap from the end of its drift path", () => {
    const still = gapsOf(geometry([net('a', rect(0, 100, 0, 100)), net('b', rect(200, 300, 0, 100))]));
    expect(still[0].width).toBe(80);
    const drifting: HazardSpawn = { ...net('a', rect(0, 100, 0, 100)), drift: netDrift(50, 0, 16, 0) };
    const [gap] = gapsOf(geometry([drifting, net('b', rect(200, 300, 0, 100))]));
    expect(gap.width).toBe(30);
    expect(gap.from).toEqual({ x: 160, y: 50 });
    expect(gap.to).toEqual({ x: 190, y: 50 });
  });

  it('measures a gap beside a moving hazard sweep, less its touch reach', () => {
    const pole = movingHazardSpawn('pole-1', PUNTING_POLE, 300, 0);
    const geo = { ...geometry([net('a', rect(0, 100, SURF, SURF + 180))]), movingHazards: [pole] };
    const [gap] = gapsOf(geo);
    expect(gap.between).toBe('a and pole-1');
    expect(gap.width).toBe(295 - 100 - 10 - PUNTING_POLE.touchReach);
    expect(gap.hazard).toBe(true);
  });

  it('adds the gaps beside an extra obstacle', () => {
    const geo = geometry([net('a', rect(0, 100, 0, 100)), net('b', rect(300, 400, 0, 100))]);
    const mat: ExtraObstacle = { id: 'mat', shape: rect(150, 250, 0, 100), keepOut: 5 };
    const gaps = gapsOf(geo, [mat]);
    expect(gaps.map((gap) => gap.between)).toEqual(['a and b', 'a and mat', 'b and mat']);
    expect(gapNamed(gaps, 'a and mat').width).toBe(35);
    expect(gapNamed(gaps, 'b and mat').width).toBe(35);
    expect(gapsOf(geo)).toEqual([gapNamed(gaps, 'a and b')]);
  });
});

describe('onMainPath', () => {
  const [gap] = gapsOf(geometry([net('a', rect(0, 100, 0, 100)), net('b', rect(200, 300, 0, 100))]));

  it('is true when the path crosses the clear stretch', () => {
    expect(onMainPath(gap, [{ x: 150, y: -50 }, { x: 150, y: 200 }])).toBe(true);
  });

  it('is false when the path passes beside it or stops short of it', () => {
    expect(onMainPath(gap, [{ x: 105, y: -50 }, { x: 105, y: 200 }])).toBe(false);
    expect(onMainPath(gap, [{ x: 150, y: -50 }, { x: 150, y: 20 }])).toBe(false);
  });
});

describe('narrowestPathGap', () => {
  const nets = [net('a', rect(0, 100, 0, 100)), net('b', rect(200, 300, 0, 100)), net('c', rect(360, 460, 0, 100))];
  const acrossBoth = [{ x: 150, y: -50 }, { x: 150, y: 200 }, { x: 330, y: 200 }, { x: 330, y: -50 }];

  it('picks the narrowest open hazard gap the main path swims through', () => {
    const gap = narrowestPathGap(geometry(nets, [], acrossBoth));
    expect(gap.between).toBe('b and c');
    expect(gap.width).toBe(40);
  });

  it('skips a narrower gap the main path does not swim through', () => {
    const gap = narrowestPathGap(geometry(nets, [], [{ x: 150, y: -50 }, { x: 150, y: 200 }]));
    expect(gap.between).toBe('a and b');
    expect(gap.width).toBe(80);
  });

  it('skips a gap whose keep-outs leave no room', () => {
    const shut = [net('a', rect(0, 100, 0, 100)), net('b', rect(115, 215, 0, 100)), net('c', rect(400, 500, 0, 100))];
    const path = [{ x: 108, y: -50 }, { x: 108, y: 200 }, { x: 300, y: 200 }, { x: 300, y: -50 }];
    expect(narrowestPathGap(geometry(shut, [], path)).between).toBe('b and c');
  });

  it('counts an extra obstacle the main path swims beside', () => {
    const mat: ExtraObstacle = { id: 'mat', shape: rect(120, 130, 0, 100), keepOut: 0 };
    const path = [{ x: 150, y: -50 }, { x: 150, y: 200 }];
    expect(narrowestPathGap(geometry(nets, [], path)).between).toBe('a and b');
    const gap = narrowestPathGap(geometry(nets, [], path), [mat]);
    expect(gap.between).toBe('b and mat');
    expect(gap.width).toBe(60);
  });

  it('throws when the main path swims through no gap', () => {
    expect(() => narrowestPathGap(geometry(nets, [], [{ x: 600, y: 0 }, { x: 700, y: 0 }]))).toThrow(
      'narrowestPathGap: the main path of test-1 swims through no gap',
    );
  });
});
