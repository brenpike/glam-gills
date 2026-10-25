import { describe, expect, it } from 'vitest';
import { CANAL_AREA } from './areas';
import { SIZE_OPTIONS } from './axolotlLook';
import {
  DEFAULT_COLLECT_RADIUS,
  SNACK_BOB_PERIOD,
  SNACK_BOB_PX,
  SPARKLE_SNACKS_LEFT,
  allCollected,
  collectNear,
  collectSnacksAtHead,
  countCollected,
  createCollectibles,
  drawnSnackX,
  drawnSnackY,
  headPoint,
  pullSnacksToward,
  snackBobY,
  snackDriftMaxSpeed,
  snackDriftOffset,
  snackTally,
  snackX,
  snackWander,
  snackY,
  snacksLeft,
  sparklingSnackIds,
  wanderLegAt,
  type Collectible,
  type DrawnBody,
  type SnackDrift,
  type SnackFrame,
} from './collectibles';
import { AXO_BOB_PERIOD, BOB_SHARE, IDLE_TILT, MAX_TILT, TURN_SQUASH } from './drawnAxolotl';
import { motionProfile } from './motion';
import { LEGS, SNACK_REACH, SWIM } from './tuning';
import { buildCanalZone, type CollectibleSpawn, type Point, type SwimBounds } from './zone';

const SPAWNS: CollectibleSpawn[] = [
  { id: 's0', kind: 'worm', x: 100, y: 100 },
  { id: 's1', kind: 'bug', x: 200, y: 100 },
  { id: 's2', kind: 'worm', x: 300, y: 100 },
];

describe('createCollectibles', () => {
  it('creates uncollected items from spawns', () => {
    expect(createCollectibles(SPAWNS)).toEqual([
      { id: 's0', kind: 'worm', x: 100, y: 100, collected: false },
      { id: 's1', kind: 'bug', x: 200, y: 100, collected: false },
      { id: 's2', kind: 'worm', x: 300, y: 100, collected: false },
    ]);
  });
});

describe('collectNear', () => {
  it('collects an item exactly at the default radius of 22', () => {
    const result = collectNear(createCollectibles(SPAWNS), { x: 122, y: 100 });
    expect(result.newly.map((item) => item.id)).toEqual(['s0']);
    expect(result.items[0].collected).toBe(true);
  });

  it('skips an item just beyond the radius', () => {
    const items = createCollectibles(SPAWNS);
    const result = collectNear(items, { x: 122.01, y: 100 });
    expect(result.newly).toEqual([]);
    expect(result.items).toBe(items);
  });

  it('honours a custom radius', () => {
    const result = collectNear(createCollectibles(SPAWNS), { x: 150, y: 100 }, 50);
    expect(result.newly.map((item) => item.id)).toEqual(['s0', 's1']);
  });

  it('does not mutate the input items', () => {
    const items = createCollectibles(SPAWNS);
    const result = collectNear(items, { x: 100, y: 100 });
    expect(items[0].collected).toBe(false);
    expect(result.items).not.toBe(items);
    expect(result.items[1]).toBe(items[1]);
  });

  it('is idempotent for already-collected items', () => {
    const first = collectNear(createCollectibles(SPAWNS), { x: 100, y: 100 });
    const second = collectNear(first.items, { x: 100, y: 100 });
    expect(second.newly).toEqual([]);
    expect(second.items).toBe(first.items);
    expect(countCollected(second.items)).toBe(1);
  });
});

describe('countCollected and allCollected', () => {
  it('tracks progress until every item is collected', () => {
    let items = createCollectibles(SPAWNS);
    expect(countCollected(items)).toBe(0);
    expect(allCollected(items)).toBe(false);
    for (const spawn of SPAWNS) {
      items = collectNear(items, spawn).items;
    }
    expect(countCollected(items)).toBe(3);
    expect(allCollected(items)).toBe(true);
  });

  it('treats an empty list as all collected', () => {
    expect(allCollected([])).toBe(true);
    expect(countCollected([])).toBe(0);
  });
});

const FIVE_SPAWNS: CollectibleSpawn[] = [
  { id: 'a', kind: 'worm', x: 100, y: 100 },
  { id: 'b', kind: 'bug', x: 200, y: 100 },
  { id: 'c', kind: 'worm', x: 300, y: 100 },
  { id: 'd', kind: 'bug', x: 400, y: 100 },
  { id: 'e', kind: 'worm', x: 500, y: 100 },
];
const DRIFT: SnackDrift = { amplitudeX: 16, amplitudeY: 8, periodX: 10, periodY: 8 };
const WIDE_BOUNDS: SwimBounds = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };

function eatFirst(count: number): Collectible[] {
  let items = createCollectibles(FIVE_SPAWNS);
  for (const spawn of FIVE_SPAWNS.slice(0, count)) {
    items = collectNear(items, spawn, 1).items;
  }
  return items;
}

describe('snacksLeft', () => {
  it('counts the uncollected items', () => {
    expect(snacksLeft(eatFirst(0))).toBe(5);
    expect(snacksLeft(eatFirst(2))).toBe(3);
    expect(snacksLeft(eatFirst(5))).toBe(0);
    expect(snacksLeft([])).toBe(0);
  });
});

describe('sparklingSnackIds', () => {
  it('uses a threshold of 3', () => {
    expect(SPARKLE_SNACKS_LEFT).toBe(3);
  });

  it('sparkles nothing with 4 left', () => {
    expect(sparklingSnackIds(eatFirst(1))).toEqual([]);
  });

  it('sparkles every snack left with 3 left', () => {
    expect(sparklingSnackIds(eatFirst(2))).toEqual(['c', 'd', 'e']);
  });

  it('sparkles the last snack with 1 left', () => {
    expect(sparklingSnackIds(eatFirst(4))).toEqual(['e']);
  });

  it('sparkles nothing with 0 left', () => {
    expect(sparklingSnackIds(eatFirst(5))).toEqual([]);
  });

  it('honours a custom threshold', () => {
    expect(sparklingSnackIds(eatFirst(1), 4)).toEqual(['b', 'c', 'd', 'e']);
  });
});

describe('snackTally', () => {
  it('reports left, collected and sparkling ids for 0 to 5 eaten', () => {
    for (let eaten = 0; eaten <= 5; eaten++) {
      const items = eatFirst(eaten);
      const tally = snackTally(items);
      expect(tally.left).toBe(5 - eaten);
      expect(tally.collected).toBe(eaten);
      expect(tally.sparklingIds).toEqual(sparklingSnackIds(items));
    }
  });

  it('gives 0, 0 and no ids for an empty list', () => {
    expect(snackTally([])).toEqual({ left: 0, collected: 0, sparklingIds: [] });
  });

  it('honours a custom threshold', () => {
    const items = eatFirst(1);
    expect(snackTally(items, 4).sparklingIds).toEqual(['b', 'c', 'd', 'e']);
    expect(snackTally(items, 4).sparklingIds).toEqual(sparklingSnackIds(items, 4));
    expect(snackTally(items).sparklingIds).toEqual([]);
  });

  it('shares one empty array when nothing sparkles', () => {
    expect(snackTally(eatFirst(1)).sparklingIds).toBe(snackTally(eatFirst(5)).sparklingIds);
    expect(snackTally([]).sparklingIds).toBe(snackTally(eatFirst(0)).sparklingIds);
  });
});

describe('snackDriftOffset', () => {
  it('stays within the amplitude on each axis', () => {
    for (let index = 0; index < 16; index++) {
      for (let t = 0; t <= 60; t += 0.1) {
        const offset = snackDriftOffset(index, t, DRIFT);
        expect(Math.abs(offset.x)).toBeLessThanOrEqual(DRIFT.amplitudeX);
        expect(Math.abs(offset.y)).toBeLessThanOrEqual(DRIFT.amplitudeY);
      }
    }
  });

  it('is deterministic', () => {
    expect(snackDriftOffset(3, 7.5, DRIFT)).toEqual(snackDriftOffset(3, 7.5, DRIFT));
  });

  it('puts neighbouring snacks out of step', () => {
    expect(snackDriftOffset(0, 0, DRIFT)).not.toEqual(snackDriftOffset(1, 0, DRIFT));
  });

  it('never moves faster than the max speed', () => {
    const maxSpeed = snackDriftMaxSpeed(DRIFT);
    const dt = 0.001;
    for (let index = 0; index < 16; index++) {
      for (let t = 0; t <= 40; t += 0.05) {
        const a = snackDriftOffset(index, t, DRIFT);
        const b = snackDriftOffset(index, t + dt, DRIFT);
        expect(Math.hypot(b.x - a.x, b.y - a.y) / dt).toBeLessThanOrEqual(maxSpeed + 1e-6);
      }
    }
  });
});

describe('snackDriftMaxSpeed', () => {
  it('combines the peak speed of each axis', () => {
    expect(snackDriftMaxSpeed(DRIFT)).toBeCloseTo(Math.hypot((2 * Math.PI * 16) / 10, (2 * Math.PI * 8) / 8), 9);
  });
});

describe('snackX and snackY', () => {
  it('put an uncollected snack at its base plus its drift offset', () => {
    createCollectibles(FIVE_SPAWNS).forEach((item, i) => {
      const offset = snackDriftOffset(i, 2.5, DRIFT);
      expect(snackX(item, i, 2.5, DRIFT, WIDE_BOUNDS)).toBeCloseTo(FIVE_SPAWNS[i].x + offset.x, 9);
      expect(snackY(item, i, 2.5, DRIFT, WIDE_BOUNDS)).toBeCloseTo(FIVE_SPAWNS[i].y + offset.y, 9);
    });
  });

  it('drift from the stored base, so a moved base moves the snack', () => {
    const [item] = createCollectibles(FIVE_SPAWNS);
    const moved = { ...item, x: item.x + 50, y: item.y - 20 };
    expect(snackX(moved, 0, 3, DRIFT, WIDE_BOUNDS)).toBeCloseTo(snackX(item, 0, 3, DRIFT, WIDE_BOUNDS) + 50, 9);
    expect(snackY(moved, 0, 3, DRIFT, WIDE_BOUNDS)).toBeCloseTo(snackY(item, 0, 3, DRIFT, WIDE_BOUNDS) - 20, 9);
  });

  it('clamp to the bounds', () => {
    const tight: SwimBounds = { minX: 100, maxX: 100, minY: 100, maxY: 100 };
    const [item] = createCollectibles(FIVE_SPAWNS);
    for (let t = 0; t <= 20; t += 0.5) {
      expect(snackX(item, 0, t, DRIFT, tight)).toBe(100);
      expect(snackY(item, 0, t, DRIFT, tight)).toBe(100);
    }
  });

  it('leave a collected snack at its base', () => {
    const items = eatFirst(2);
    for (let t = 0; t <= 20; t += 0.5) {
      expect(snackX(items[1], 1, t, DRIFT, WIDE_BOUNDS)).toBe(FIVE_SPAWNS[1].x);
      expect(snackY(items[1], 1, t, DRIFT, WIDE_BOUNDS)).toBe(FIVE_SPAWNS[1].y);
    }
  });

  it('are deterministic', () => {
    const [item] = createCollectibles(FIVE_SPAWNS);
    expect(snackX(item, 3, 7.5, DRIFT, WIDE_BOUNDS)).toBe(snackX(item, 3, 7.5, DRIFT, WIDE_BOUNDS));
    expect(snackY(item, 3, 7.5, DRIFT, WIDE_BOUNDS)).toBe(snackY(item, 3, 7.5, DRIFT, WIDE_BOUNDS));
  });
});

/** The head ellipse in art local units, mirroring HEAD_ELL (src/art/drawAxolotl.ts). */
const HEAD = Object.freeze({ cx: 26, cy: -1, rx: 27, ry: 22 });

/** Ink past the head edge, mirroring LW (src/art/palette.ts): blob (src/art/canvasKit.ts) strokes 2 x LW. */
const HEAD_INK = 3.5;

/** Art local units to scene px, mirroring AXO_SCENE_SCALE (src/art/drawAxolotl.ts). */
const SCENE_SCALE = 0.95;

/**
 * Every size factor, mirroring AXO_SIZE_SCALE (src/art/drawAxolotlParts.ts). The only list of
 * sizes in these tests.
 */
const SIZE_FACTORS: readonly number[] = [0.72, 0.85, 1];

/** Largest sprite rotation: swim tilt, idle tilt and the wobble of three missing legs (src/logic/legs.ts). */
const MAX_ROTATION = MAX_TILT + IDLE_TILT + (LEGS.count - 1) * LEGS.wobbleAmp;

/** Largest axolotl bob in px (full motion); reduced motion has none. */
const AXO_BOB = BOB_SHARE * motionProfile(false).bob;

const STILL_DRIFT: SnackDrift = { amplitudeX: 0, amplitudeY: 0, periodX: 1, periodY: 1 };
const STILL_FRAME: SnackFrame = { driftT: 0, bobT: 0, bobbing: false, drift: STILL_DRIFT, bounds: WIDE_BOUNDS };
const LARGEST_SIZE = Math.max(...SIZE_FACTORS);

/** Points of the drawn head ellipse, ink included, in art local units: its edge, a middle ring and its centre. */
function drawnHeadLocalPoints(edgeSteps: number): Point[] {
  const points: Point[] = [{ x: HEAD.cx, y: HEAD.cy }];
  for (let k = 0; k < edgeSteps; k++) {
    const angle = (2 * Math.PI * k) / edgeSteps;
    for (const share of [1, 0.5]) {
      points.push({
        x: HEAD.cx + share * (HEAD.rx + HEAD_INK) * Math.cos(angle),
        y: HEAD.cy + share * (HEAD.ry + HEAD_INK) * Math.sin(angle),
      });
    }
  }
  return points;
}

/**
 * Where local point `local` lands on a sprite drawn at `body` with scale
 * (facing x squash x scale, scale), then rotated.
 */
function placeOnBody(body: DrawnBody, scale: number, local: Point): Point {
  const lx = local.x * scale * (body.squash ?? 1);
  const ly = local.y * scale;
  const cos = Math.cos(body.rotation);
  const sin = Math.sin(body.rotation);
  return { x: body.x + body.facing * lx * cos - ly * sin, y: body.y + body.facing * lx * sin + ly * cos };
}

/** One uncollected snack per point, with its base set so `frame` draws it on that point. */
function snacksDrawnAt(points: readonly Point[], frame: SnackFrame): Collectible[] {
  return points.map((point, index) => {
    const drift = snackDriftOffset(index, frame.driftT, frame.drift);
    const bob = snackBobY(index, frame.bobT, frame.bobbing);
    return { id: `p${index}`, kind: 'worm', x: point.x - drift.x, y: point.y - drift.y - bob, collected: false };
  });
}

function eatenIds(items: readonly Collectible[], body: DrawnBody, frame: SnackFrame): Set<string> {
  return new Set(collectSnacksAtHead(items, headPoint(body), frame)?.newly.map((item) => item.id) ?? []);
}

describe('SNACK_REACH', () => {
  it('reaches 36 px around a point 25 px ahead', () => {
    expect(SNACK_REACH).toEqual({ headAhead: 25, radius: 36 });
    expect(Object.isFrozen(SNACK_REACH)).toBe(true);
  });

  it('centres on the largest drawn head', () => {
    expect(SNACK_REACH.headAhead).toBe(Math.round(HEAD.cx * SCENE_SCALE * LARGEST_SIZE));
  });

  it('is one reach for every size (PRD F4)', () => {
    const keys = Object.keys(SNACK_REACH).join(' ').toLowerCase();
    for (const word of [...SIZE_OPTIONS.map((option) => option.id), 'size', 'look']) {
      expect(keys).not.toContain(word);
    }
  });
});

describe('snackBobY, drawnSnackX and drawnSnackY', () => {
  const TAU = Math.PI * 2;
  const oldRenderBob = (index: number, t: number) => 2.5 * Math.sin((TAU * t) / 2.4 + index);
  const frame: SnackFrame = { driftT: 2.5, bobT: 1.7, bobbing: true, drift: DRIFT, bounds: WIDE_BOUNDS };

  it('bobs 2.5 px every 2.4 s like the old renderSnacks', () => {
    expect(SNACK_BOB_PX).toBe(2.5);
    expect(SNACK_BOB_PERIOD).toBe(2.4);
    for (let index = 0; index < 8; index++) {
      for (let t = 0; t <= 10; t += 0.13) expect(snackBobY(index, t, true)).toBe(oldRenderBob(index, t));
    }
  });

  it('does not bob when snacks do not bob', () => {
    for (let t = 0; t <= 10; t += 0.5) expect(snackBobY(3, t, false)).toBe(0);
  });

  it('draw each snack at its drift position plus its bob', () => {
    createCollectibles(FIVE_SPAWNS).forEach((item, i) => {
      expect(drawnSnackX(item, i, frame)).toBe(snackX(item, i, 2.5, DRIFT, WIDE_BOUNDS));
      expect(drawnSnackY(item, i, frame)).toBe(snackY(item, i, 2.5, DRIFT, WIDE_BOUNDS) + oldRenderBob(i, 1.7));
    });
  });

  it('draw a snack at its drift position when snacks do not bob', () => {
    const still = { ...frame, bobbing: false };
    createCollectibles(FIVE_SPAWNS).forEach((item, i) => {
      expect(drawnSnackY(item, i, still)).toBe(snackY(item, i, 2.5, DRIFT, WIDE_BOUNDS));
    });
  });
});

describe('headPoint', () => {
  it('lies headAhead px along the facing', () => {
    expect(headPoint({ x: 500, y: 300, facing: 1, rotation: 0 })).toEqual({ x: 525, y: 300 });
    expect(headPoint({ x: 500, y: 300, facing: -1, rotation: 0 })).toEqual({ x: 475, y: 300 });
  });

  it('honours a custom reach', () => {
    expect(headPoint({ x: 0, y: 0, facing: -1, rotation: 0 }, { headAhead: 10, radius: 1 })).toEqual({ x: -10, y: 0 });
  });

  it('turns with the sprite drawn at scale (facing x s, s)', () => {
    for (const facing of [1, -1] as const) {
      for (const rotation of [-MAX_ROTATION, -0.3, 0, 0.3, MAX_ROTATION]) {
        const body: DrawnBody = { x: 200, y: 150, facing, rotation };
        const expected = placeOnBody(body, 1, { x: SNACK_REACH.headAhead, y: 0 });
        expect(headPoint(body).x).toBeCloseTo(expected.x, 9);
        expect(headPoint(body).y).toBeCloseTo(expected.y, 9);
      }
    }
  });

  it('shortens with the turn squash, matching the sprite drawn at scale (facing x squash x s, s)', () => {
    for (const squash of [TURN_SQUASH, 0.8, 1]) {
      for (const facing of [1, -1] as const) {
        for (const rotation of [-MAX_ROTATION, -0.3, 0, 0.3, MAX_ROTATION]) {
          const body: DrawnBody = { x: 200, y: 150, facing, rotation, squash };
          const expected = placeOnBody(body, 1, { x: SNACK_REACH.headAhead, y: 0 });
          expect(headPoint(body).x).toBeCloseTo(expected.x, 9);
          expect(headPoint(body).y).toBeCloseTo(expected.y, 9);
        }
      }
    }
  });

  it('lies 15 px ahead at the turn squash with no rotation', () => {
    for (const facing of [1, -1] as const) {
      const head = headPoint({ x: 500, y: 300, facing, rotation: 0, squash: TURN_SQUASH });
      expect(head.x).toBeCloseTo(500 + facing * 15, 9);
      expect(head.y).toBe(300);
    }
  });

  it('dips the head when swimming down whichever way it faces', () => {
    for (const facing of [1, -1] as const) {
      const head = headPoint({ x: 0, y: 0, facing, rotation: facing * MAX_TILT });
      expect(head.y).toBeCloseTo(SNACK_REACH.headAhead * Math.sin(MAX_TILT), 9);
      expect(Math.sign(head.x)).toBe(facing);
    }
  });
});

describe('collectSnacksAtHead', () => {
  const body: DrawnBody = { x: 500, y: 500, facing: 1, rotation: 0 };
  const head = headPoint(body);

  it('eats every snack drawn on the head, at every size, facing, tilt, bob and squash, also in reduced motion', () => {
    const rotations = [-MAX_ROTATION, -MAX_TILT, 0, MAX_TILT, MAX_ROTATION];
    const axolotlBobs = [-AXO_BOB, BOB_SHARE * motionProfile(true).bob, AXO_BOB];
    const snackBobbing = [motionProfile(false).collectBob, motionProfile(true).collectBob];
    const local = drawnHeadLocalPoints(24);
    for (const size of SIZE_FACTORS) {
      for (const facing of [1, -1] as const) {
        for (const rotation of rotations) {
          for (const bob of axolotlBobs) {
            for (const squash of [TURN_SQUASH, 1]) {
              const drawn: DrawnBody = { x: 500, y: 500 + bob, facing, rotation, squash };
              const points = local.map((point) => placeOnBody(drawn, SCENE_SCALE * size, point));
              for (const bobbing of snackBobbing) {
                for (const drift of [STILL_DRIFT, CANAL_AREA.snackDrift]) {
                  for (const [driftT, bobT] of [[0, 0], [1.3, 0.7], [2.5, 1.9]]) {
                    const frame: SnackFrame = { driftT, bobT, bobbing, drift, bounds: WIDE_BOUNDS };
                    const result = collectSnacksAtHead(snacksDrawnAt(points, frame), headPoint(drawn), frame);
                    expect(result?.newly.length).toBe(points.length);
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  it('REGRESSION: eats a snack 40 px ahead, inside the drawn head, that the body centre missed', () => {
    for (const facing of [1, -1] as const) {
      const medium: DrawnBody = { x: 500, y: 500, facing, rotation: 0 };
      const snack = { x: 500 + facing * 40, y: 500 };
      const local = { x: 40 / SCENE_SCALE, y: 0 };
      const inHead =
        ((local.x - HEAD.cx) / (HEAD.rx + HEAD_INK)) ** 2 + ((local.y - HEAD.cy) / (HEAD.ry + HEAD_INK)) ** 2;
      expect(inHead).toBeLessThanOrEqual(1);
      const items = snacksDrawnAt([snack], STILL_FRAME);
      expect(collectNear(items, medium, DEFAULT_COLLECT_RADIUS).newly).toEqual([]);
      expect(collectSnacksAtHead(items, headPoint(medium), STILL_FRAME)?.newly.map((item) => item.id)).toEqual(['p0']);
    }
  });

  it('REGRESSION: does not eat a snack ahead of a turn-squashed head that the unsquashed reach covers', () => {
    const ahead = 60;
    for (const facing of [1, -1] as const) {
      const unsquashed: DrawnBody = { x: 500, y: 500, facing, rotation: 0, squash: 1 };
      const squashed: DrawnBody = { ...unsquashed, squash: TURN_SQUASH };
      const local = { x: ahead / (SCENE_SCALE * LARGEST_SIZE * TURN_SQUASH), y: 0 };
      const inSquashedHead =
        ((local.x - HEAD.cx) / (HEAD.rx + HEAD_INK)) ** 2 + ((local.y - HEAD.cy) / (HEAD.ry + HEAD_INK)) ** 2;
      expect(inSquashedHead).toBeGreaterThan(1);
      const items = snacksDrawnAt([{ x: 500 + facing * ahead, y: 500 }], STILL_FRAME);
      expect(eatenIds(items, unsquashed, STILL_FRAME)).toEqual(new Set(['p0']));
      expect(collectSnacksAtHead(items, headPoint(squashed), STILL_FRAME)).toBeNull();
    }
  });

  it('eats a snack exactly at the radius and skips one 0.5 px beyond it', () => {
    const atEdge = snacksDrawnAt([{ x: head.x, y: head.y + SNACK_REACH.radius }], STILL_FRAME);
    const beyond = snacksDrawnAt([{ x: head.x, y: head.y + SNACK_REACH.radius + 0.5 }], STILL_FRAME);
    expect(collectSnacksAtHead(atEdge, head, STILL_FRAME)?.newly.length).toBe(1);
    expect(collectSnacksAtHead(beyond, head, STILL_FRAME)).toBeNull();
  });

  it('honours a custom radius', () => {
    const items = snacksDrawnAt([{ x: head.x + 10, y: head.y }], STILL_FRAME);
    expect(collectSnacksAtHead(items, head, STILL_FRAME, 9.5)).toBeNull();
    expect(collectSnacksAtHead(items, head, STILL_FRAME, 10)?.newly.length).toBe(1);
  });

  it('eats several snacks at once in index order and keeps their base x and y', () => {
    const points = [
      { x: head.x + 100, y: head.y },
      { x: head.x, y: head.y - 20 },
      { x: head.x + 30, y: head.y },
      { x: head.x - 200, y: head.y },
      { x: head.x - 5, y: head.y + 5 },
    ];
    const frame: SnackFrame = {
      driftT: 1.1,
      bobT: 0.4,
      bobbing: true,
      drift: CANAL_AREA.snackDrift,
      bounds: WIDE_BOUNDS,
    };
    const items = snacksDrawnAt(points, frame);
    const result = collectSnacksAtHead(items, head, frame);
    expect(result?.newly.map((item) => item.id)).toEqual(['p1', 'p2', 'p4']);
    result?.newly.forEach((item) => {
      const before = items.find((candidate) => candidate.id === item.id);
      expect(item.x).toBe(before?.x);
      expect(item.y).toBe(before?.y);
    });
    expect(result?.items.map((item) => item.collected)).toEqual([false, true, true, false, true]);
    expect(result?.items[0]).toBe(items[0]);
    expect(result?.items[3]).toBe(items[3]);
  });

  it('returns null and leaves the items untouched when nothing is in reach', () => {
    const items = snacksDrawnAt([{ x: head.x + 80, y: head.y }], STILL_FRAME);
    const before = items.map((item) => ({ ...item }));
    expect(collectSnacksAtHead(items, head, STILL_FRAME)).toBeNull();
    expect(items).toEqual(before);
  });

  it('does not mutate the input items when it eats', () => {
    const items = snacksDrawnAt([head, { x: head.x + 80, y: head.y }], STILL_FRAME);
    const before = items.map((item) => ({ ...item }));
    const result = collectSnacksAtHead(items, head, STILL_FRAME);
    expect(items).toEqual(before);
    expect(result?.items).not.toBe(items);
  });

  it('ignores already-collected snacks', () => {
    const items = snacksDrawnAt([head], STILL_FRAME);
    const eaten = collectNear(items, items[0], 1).items;
    expect(collectSnacksAtHead(eaten, head, STILL_FRAME)).toBeNull();
  });
});

describe('pullSnacksToward', () => {
  const head: Point = { x: 500, y: 500 };
  const RADIUS = 150;

  function drawnDistance(items: readonly Collectible[], index: number, frame: SnackFrame): number {
    return Math.hypot(drawnSnackX(items[index], index, frame) - head.x, drawnSnackY(items[index], index, frame) - head.y);
  }

  it('moves a snack toward the head at speed x dt', () => {
    const items = snacksDrawnAt([{ x: head.x + 60, y: head.y + 80 }], STILL_FRAME);
    const pulled = pullSnacksToward(items, head, RADIUS, 20, 0.5, STILL_FRAME);
    expect(pulled?.[0].x).toBeCloseTo(head.x + 60 - 6, 9);
    expect(pulled?.[0].y).toBeCloseTo(head.y + 80 - 8, 9);
    expect(pulled?.[0].collected).toBe(false);
  });

  it('pulls a snack at exactly the radius and skips one 0.5 px beyond it', () => {
    const atEdge = snacksDrawnAt([{ x: head.x + RADIUS, y: head.y }], STILL_FRAME);
    const beyond = snacksDrawnAt([{ x: head.x + RADIUS + 0.5, y: head.y }], STILL_FRAME);
    expect(pullSnacksToward(atEdge, head, RADIUS, 10, 1, STILL_FRAME)).not.toBeNull();
    expect(pullSnacksToward(beyond, head, RADIUS, 10, 1, STILL_FRAME)).toBeNull();
  });

  it('leaves a snack out of range alone and returns null', () => {
    const items = snacksDrawnAt([{ x: head.x + 300, y: head.y }], STILL_FRAME);
    const before = items.map((item) => ({ ...item }));
    expect(pullSnacksToward(items, head, RADIUS, 100, 1, STILL_FRAME)).toBeNull();
    expect(items).toEqual(before);
  });

  it('pulls only the snacks in range and keeps the others as the same objects', () => {
    const items = snacksDrawnAt(
      [
        { x: head.x + 400, y: head.y },
        { x: head.x - 100, y: head.y },
        { x: head.x, y: head.y + 900 },
        { x: head.x, y: head.y - 50 },
      ],
      STILL_FRAME,
    );
    const pulled = pullSnacksToward(items, head, RADIUS, 10, 1, STILL_FRAME);
    expect(pulled?.[0]).toBe(items[0]);
    expect(pulled?.[2]).toBe(items[2]);
    expect(pulled?.[1].x).toBeCloseTo(head.x - 90, 9);
    expect(pulled?.[3].y).toBeCloseTo(head.y - 40, 9);
  });

  it('never moves a snack past the head', () => {
    const items = snacksDrawnAt([{ x: head.x + 5, y: head.y - 12 }], STILL_FRAME);
    const pulled = pullSnacksToward(items, head, RADIUS, 1000, 1, STILL_FRAME);
    expect(pulled?.[0].x).toBeCloseTo(head.x, 9);
    expect(pulled?.[0].y).toBeCloseTo(head.y, 9);
  });

  it('does not move a snack drawn exactly on the head and returns null', () => {
    expect(pullSnacksToward(snacksDrawnAt([head], STILL_FRAME), head, RADIUS, 100, 1, STILL_FRAME)).toBeNull();
  });

  it('does nothing when dt is 0 (pause) or below', () => {
    const items = snacksDrawnAt([{ x: head.x + 50, y: head.y }], STILL_FRAME);
    expect(pullSnacksToward(items, head, RADIUS, 100, 0, STILL_FRAME)).toBeNull();
    expect(pullSnacksToward(items, head, RADIUS, 100, -0.1, STILL_FRAME)).toBeNull();
  });

  it('returns null for a radius of 0 or below', () => {
    const items = snacksDrawnAt([head, { x: head.x + 1, y: head.y }], STILL_FRAME);
    expect(pullSnacksToward(items, head, 0, 100, 1, STILL_FRAME)).toBeNull();
    expect(pullSnacksToward(items, head, -5, 100, 1, STILL_FRAME)).toBeNull();
  });

  it('returns null for a speed of 0 or below, never pushing a snack away', () => {
    const items = snacksDrawnAt([{ x: head.x + 50, y: head.y }], STILL_FRAME);
    expect(pullSnacksToward(items, head, RADIUS, 0, 1, STILL_FRAME)).toBeNull();
    expect(pullSnacksToward(items, head, RADIUS, -10, 1, STILL_FRAME)).toBeNull();
  });

  it('leaves collected snacks untouched', () => {
    const items = snacksDrawnAt([{ x: head.x + 50, y: head.y }, { x: head.x - 50, y: head.y }], STILL_FRAME);
    const eaten = collectNear(items, items[0], 1).items;
    const pulled = pullSnacksToward(eaten, head, RADIUS, 10, 1, STILL_FRAME);
    expect(pulled?.[0]).toBe(eaten[0]);
    expect(pulled?.[1]).not.toBe(eaten[1]);
    expect(pullSnacksToward([eaten[0]], head, RADIUS, 10, 1, STILL_FRAME)).toBeNull();
  });

  it('does not mutate the input items', () => {
    const items = snacksDrawnAt([{ x: head.x + 50, y: head.y }], STILL_FRAME);
    const before = items.map((item) => ({ ...item }));
    const pulled = pullSnacksToward(items, head, RADIUS, 10, 1, STILL_FRAME);
    expect(items).toEqual(before);
    expect(pulled).not.toBe(items);
  });

  it('moves the drawn snack the same way with bobbing on and off (reduced motion)', () => {
    for (const bobbing of [true, false]) {
      const frame: SnackFrame = { driftT: 1.3, bobT: 0.7, bobbing, drift: CANAL_AREA.snackDrift, bounds: WIDE_BOUNDS };
      const items = snacksDrawnAt(
        [
          { x: head.x + 90, y: head.y + 20 },
          { x: head.x - 60, y: head.y - 70 },
        ],
        frame,
      );
      const pulled = pullSnacksToward(items, head, RADIUS, 12, 1, frame);
      expect(pulled).not.toBeNull();
      if (pulled === null) continue;
      items.forEach((item, index) => {
        expect(drawnDistance(pulled, index, frame)).toBeCloseTo(drawnDistance(items, index, frame) - 12, 9);
      });
    }
  });

  it('measures the range where the snack is drawn, not at its base', () => {
    const drift: SnackDrift = { amplitudeX: 0, amplitudeY: 40, periodX: 1, periodY: 1 };
    const frame: SnackFrame = { driftT: 0, bobT: 0, bobbing: false, drift, bounds: WIDE_BOUNDS };
    const drawnInBaseOut = snacksDrawnAt([{ x: head.x, y: head.y - 30 }], frame);
    const drawnOutBaseIn = snacksDrawnAt([{ x: head.x, y: head.y + 60 }], frame);
    expect(Math.abs(drawnInBaseOut[0].y - head.y)).toBe(70);
    expect(Math.abs(drawnOutBaseIn[0].y - head.y)).toBe(20);
    expect(pullSnacksToward(drawnInBaseOut, head, 50, 5, 1, frame)).not.toBeNull();
    expect(pullSnacksToward(drawnOutBaseIn, head, 50, 5, 1, frame)).toBeNull();
  });

  it('clamps the moved base to the bounds', () => {
    const bounds: SwimBounds = { minX: 480, maxX: 520, minY: 490, maxY: 510 };
    const frame: SnackFrame = { ...STILL_FRAME, bounds };
    const items = snacksDrawnAt([{ x: 500, y: 500 }], frame);
    const pulled = pullSnacksToward(items, { x: 700, y: 300 }, 400, 100, 1, frame);
    expect(pulled?.[0].x).toBe(520);
    expect(pulled?.[0].y).toBe(490);
  });

  it('never collects: a pulled snack is eaten only once it is inside the head reach', () => {
    let items = snacksDrawnAt([{ x: head.x + 100, y: head.y }], STILL_FRAME);
    let ticks = 0;
    for (;;) {
      ticks += 1;
      items = pullSnacksToward(items, head, RADIUS, 10, 1, STILL_FRAME) ?? items;
      expect(items[0].collected).toBe(false);
      const result = collectSnacksAtHead(items, head, STILL_FRAME);
      if (result !== null) {
        expect(drawnDistance(items, 0, STILL_FRAME)).toBeLessThanOrEqual(SNACK_REACH.radius);
        break;
      }
      expect(drawnDistance(items, 0, STILL_FRAME)).toBeGreaterThan(SNACK_REACH.radius);
    }
    expect(ticks).toBe(7);
  });
});

describe('collectSnacksAtHead on a fast pass', () => {
  const strongestCurrent = Math.max(
    ...buildCanalZone().currents.map((current) => Math.hypot(current.force.x, current.force.y)),
  );
  const snackBobSpeed = (2 * Math.PI * SNACK_BOB_PX) / SNACK_BOB_PERIOD;
  const axolotlBobSpeed = (2 * Math.PI * AXO_BOB) / AXO_BOB_PERIOD;
  const longestStep =
    (SWIM.dashSpeed + strongestCurrent + snackDriftMaxSpeed(CANAL_AREA.snackDrift) + snackBobSpeed + axolotlBobSpeed) *
    SWIM.dtMax;
  const origin: DrawnBody = { x: 0, y: 0, facing: 1, rotation: 0 };
  const farthestHeadPoint = Math.max(
    ...drawnHeadLocalPoints(720).map((point) => {
      const placed = placeOnBody(origin, SCENE_SCALE * LARGEST_SIZE, point);
      return Math.hypot(placed.x - SNACK_REACH.headAhead, placed.y);
    }),
  );

  it('reaches past the farthest largest-head point from either end of the longest step', () => {
    expect(farthestHeadPoint).toBeCloseTo(29.3, 1);
    const reachMidStep = Math.sqrt(SNACK_REACH.radius ** 2 - (longestStep / 2) ** 2);
    expect(reachMidStep).toBeGreaterThanOrEqual(farthestHeadPoint);
  });

  it('eats a snack the head passes over mid-step at one end of the step', () => {
    const local = drawnHeadLocalPoints(24);
    for (const facing of [1, -1] as const) {
      for (const rotation of [0, MAX_ROTATION]) {
        for (let k = 0; k < 16; k++) {
          const angle = (2 * Math.PI * k) / 16;
          const start: DrawnBody = { x: 500, y: 500, facing, rotation };
          const end: DrawnBody = {
            ...start,
            x: 500 + longestStep * Math.cos(angle),
            y: 500 + longestStep * Math.sin(angle),
          };
          for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
            const passing: DrawnBody = {
              ...start,
              x: start.x + fraction * (end.x - start.x),
              y: start.y + fraction * (end.y - start.y),
            };
            const items = snacksDrawnAt(
              local.map((point) => placeOnBody(passing, SCENE_SCALE * LARGEST_SIZE, point)),
              STILL_FRAME,
            );
            const eaten = new Set([...eatenIds(items, start, STILL_FRAME), ...eatenIds(items, end, STILL_FRAME)]);
            expect(eaten.size).toBe(items.length);
          }
        }
      }
    }
  });
});

describe('createCollectibles with wander loops and homes (issue #131, ND-13)', () => {
  const WANDER = snackWander([{ x: 300, y: 200 }, { x: 420, y: 200 }], 60, 1);
  const HOME = [{ x: 500, y: 150 }, { x: 540, y: 170 }];
  const MIXED: CollectibleSpawn[] = [
    { id: 'snack-0', kind: 'worm', x: 100, y: 100 },
    { id: 'snack-tadpole-1', kind: 'tadpole', x: 300, y: 200, wander: WANDER },
    { id: 'snack-shrimp-1', kind: 'shrimp', x: 500, y: 150, home: HOME },
  ];

  it('copies a wander loop or a home only when the spawn has one, sharing no object', () => {
    const [worm, tadpole, shrimp] = createCollectibles(MIXED);
    expect(worm).toStrictEqual({ id: 'snack-0', kind: 'worm', x: 100, y: 100, collected: false });
    expect(tadpole).toStrictEqual({ id: 'snack-tadpole-1', kind: 'tadpole', x: 300, y: 200, collected: false, wander: WANDER });
    expect(tadpole.wander).not.toBe(WANDER);
    expect(tadpole.wander?.points).not.toBe(WANDER.points);
    expect(tadpole.wander?.points[1]).not.toBe(WANDER.points[1]);
    expect(tadpole.wander?.legEnds).not.toBe(WANDER.legEnds);
    expect(shrimp).toStrictEqual({ id: 'snack-shrimp-1', kind: 'shrimp', x: 500, y: 150, collected: false, home: HOME });
    expect(shrimp.home).not.toBe(HOME);
    expect(shrimp.home?.[0]).not.toBe(HOME[0]);
    expect(worm).not.toHaveProperty('wander');
    expect(worm).not.toHaveProperty('home');
    expect(shrimp).not.toHaveProperty('wander');
    expect(tadpole).not.toHaveProperty('home');
  });
});

describe('snackWander (issue #131, ND-1, ND-12)', () => {
  it('holds the turn points from the start, each leg\'s end along the loop and the lap', () => {
    const wander = snackWander([{ x: 300, y: 200 }, { x: 420, y: 200 }, { x: 420, y: 290 }, { x: 300, y: 290 }], 60, 0.5);
    expect(wander).toEqual({
      points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 90 }, { x: 0, y: 90 }],
      legEnds: [120, 210, 330, 420],
      lap: 420,
      speed: 60,
      offset: 0.5,
    });
  });

  it('counts a 2-point loop there and back', () => {
    expect(snackWander([{ x: 10, y: 10 }, { x: 10, y: 130 }], 40, 0)).toMatchObject({ legEnds: [120, 240], lap: 240 });
  });
});

describe('a tadpole\'s drawn place on its wander loop (issue #131, ND-1)', () => {
  const BOUNDS: SwimBounds = { minX: 40, maxX: 1880, minY: 94, maxY: 296 };
  /** A 120 x 90 px box loop from (300, 200), clockwise: legs of 120, 90, 120 and 90 px. */
  const BOX: readonly Point[] = [
    { x: 300, y: 200 },
    { x: 420, y: 200 },
    { x: 420, y: 290 },
    { x: 300, y: 290 },
  ];
  const tadpole = (points: readonly Point[], speed: number, offset: number): Collectible => ({
    id: 'snack-tadpole-1',
    kind: 'tadpole',
    x: points[0].x,
    y: points[0].y,
    collected: false,
    wander: snackWander(points, speed, offset),
  });
  const frameAt = (driftT: number, bobbing = true, bobT = driftT * 1.3): SnackFrame => ({
    driftT,
    bobT,
    bobbing,
    drift: DRIFT,
    bounds: BOUNDS,
  });
  const placeAt = (item: Collectible, t: number): Point => ({ x: drawnSnackX(item, 0, frameAt(t)), y: drawnSnackY(item, 0, frameAt(t)) });

  it('turns at each point, straight along each leg', () => {
    const item = tadpole(BOX, 60, 0);
    expect(placeAt(item, 0)).toEqual({ x: 300, y: 200 });
    expect(placeAt(item, 1).x).toBeCloseTo(360, 9);
    expect(placeAt(item, 2).x).toBeCloseTo(420, 9);
    expect(placeAt(item, 2).y).toBeCloseTo(200, 9);
    expect(placeAt(item, 2.5).y).toBeCloseTo(230, 9);
    expect(placeAt(item, 3.5).x).toBeCloseTo(420, 9);
    expect(placeAt(item, 3.5).y).toBeCloseTo(290, 9);
    expect(placeAt(item, 4.5).x).toBeCloseTo(360, 9);
    expect(placeAt(item, 5.5).x).toBeCloseTo(300, 9);
    expect(placeAt(item, 6).y).toBeCloseTo(260, 9);
    expect(placeAt(item, 7).x).toBeCloseTo(300, 9);
    expect(placeAt(item, 7).y).toBeCloseTo(200, 9);
  });

  it('keeps a steady speed, never faster, and exactly its speed along a leg', () => {
    const item = tadpole(BOX, 60, 0);
    const corners = [2, 3.5, 5.5, 7];
    for (let t = 0; t < 14; t += 0.05) {
      const from = placeAt(item, t);
      const to = placeAt(item, t + 0.05);
      const step = Math.hypot(to.x - from.x, to.y - from.y);
      expect(step).toBeLessThanOrEqual(60 * 0.05 + 1e-9);
      const lapT = t % 7;
      const nearCorner = corners.some((corner) => Math.abs(lapT - corner) < 0.06 || Math.abs(lapT + 0.05 - corner) < 0.06);
      if (!nearCorner && lapT > 0.06) expect(step).toBeCloseTo(60 * 0.05, 9);
    }
  });

  it('gives the leg it swims at each moment', () => {
    const wander = snackWander(BOX, 60, 0);
    expect([0, 1.9, 2, 3.4, 3.6, 5.6, 6.9, 7, 8].map((t) => wanderLegAt(wander, t))).toEqual([0, 0, 1, 1, 2, 3, 3, 0, 0]);
    expect(wanderLegAt(wander, -1)).toBe(3);
  });

  it('follows its offset', () => {
    const late = tadpole(BOX, 60, 1.5);
    const early = tadpole(BOX, 60, 0);
    for (let t = 0; t < 10; t += 0.25) {
      expect(placeAt(late, t).x).toBeCloseTo(placeAt(early, t + 1.5).x, 9);
      expect(placeAt(late, t).y).toBeCloseTo(placeAt(early, t + 1.5).y, 9);
    }
  });

  it('is clamped to the bounds', () => {
    const item = tadpole([{ x: 1800, y: 150 }, { x: 1960, y: 70 }], 40, 0);
    for (let t = 0; t < 10; t += 0.5) {
      expect(drawnSnackX(item, 0, frameAt(t))).toBeLessThanOrEqual(BOUNDS.maxX);
      expect(drawnSnackY(item, 0, frameAt(t))).toBeGreaterThanOrEqual(BOUNDS.minY);
    }
    const farEnd = Math.hypot(160, 80) / 40;
    expect(placeAt(item, farEnd)).toEqual({ x: BOUNDS.maxX, y: BOUNDS.minY });
  });

  it('has no drift and no bob, and is the same under reduced motion', () => {
    const item = tadpole(BOX, 60, 0);
    for (let t = 0; t < 8; t += 0.3) {
      expect(drawnSnackY(item, 3, frameAt(t, false))).toBe(drawnSnackY(item, 3, frameAt(t)));
      expect(drawnSnackX(item, 3, frameAt(t, false))).toBe(drawnSnackX(item, 3, frameAt(t)));
      expect(drawnSnackX(item, 7, frameAt(t, true, 0))).toBe(drawnSnackX(item, 0, frameAt(t)));
      expect(drawnSnackY(item, 7, frameAt(t, true, 0))).toBe(drawnSnackY(item, 0, frameAt(t)));
    }
    expect(drawnSnackY(item, 3, frameAt(1))).toBe(200);
  });

  it('moves with its stored x and y, as the Snack magnet moves them', () => {
    const item = tadpole(BOX, 60, 0);
    const moved = { ...item, x: 310, y: 190 };
    for (const t of [1, 2.5, 4.5, 6]) {
      expect(drawnSnackX(moved, 0, frameAt(t))).toBeCloseTo(drawnSnackX(item, 0, frameAt(t)) + 10, 9);
      expect(drawnSnackY(moved, 0, frameAt(t))).toBeCloseTo(drawnSnackY(item, 0, frameAt(t)) - 10, 9);
    }
  });

  it('leaves worms, bugs and shrimp drawn as before, with drift and bob', () => {
    const frame = frameAt(2.5, true, 1.7);
    const spawns: CollectibleSpawn[] = [
      { id: 'a', kind: 'worm', x: 300, y: 200 },
      { id: 'b', kind: 'bug', x: 400, y: 180 },
      { id: 'c', kind: 'shrimp', x: 500, y: 160 },
    ];
    createCollectibles(spawns).forEach((item, i) => {
      expect(drawnSnackX(item, i, frame)).toBe(snackX(item, i, 2.5, DRIFT, BOUNDS));
      expect(drawnSnackY(item, i, frame)).toBe(snackY(item, i, 2.5, DRIFT, BOUNDS) + snackBobY(i, 1.7, true));
    });
  });
});
