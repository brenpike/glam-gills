/**
 * The bake of the Area 13 textures (issue #212) in the lake texture set: the five mud turtle body
 * frames, its head and neck pieces and the three fading light frames are each baked once, at the
 * logical size times the bake scale, with the anchor the painters say, they paint differently from
 * each other, and every one fits the lake's small-sprite caps. Same approach as the bake tests in
 * pelicanArt.test.ts: a scene stand-in records each canvas texture and what was painted. No Phaser
 * is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FADING_LIGHT_FRAMES,
  FADING_LIGHT_KEYS,
  FADING_LIGHT_TEX,
  type FadingLightFrame,
} from './drawFadingLight';
import { DRIFTING_ISLAND_HALF_TEX, DRIFTING_ISLAND_KEY } from './drawDriftingIsland';
import { LITTER_KEYS, LITTER_KINDS, LITTER_TEX } from './drawLitter';
import {
  MUD_TURTLE_FRAMES,
  MUD_TURTLE_HEAD_TEX,
  MUD_TURTLE_KEYS,
  MUD_TURTLE_NECK_TEX,
  MUD_TURTLE_TEX,
  type MudTurtleFrame,
} from './drawMudTurtle';
import { LAKE_TEX, LAKE_TEX_MAX_H, LAKE_TEX_MAX_W, LAKE_TEX_SIZES, bakeLakeTextures } from './lakeTextures';

vi.mock('phaser', () => ({}));

/** A Path2D stand-in that keeps its commands. */
class LogPath {
  readonly cmds: unknown[] = [];
  constructor() {
    return new Proxy(this, {
      get: (target, key) =>
        key === 'cmds' ? target.cmds : (...args: unknown[]) => void target.cmds.push([String(key), ...args]),
    });
  }
}

/** One draw call with the style it was painted under. */
interface Op {
  readonly op: string;
  readonly cmds: unknown[][];
  readonly fillStyle: unknown;
  readonly strokeStyle: unknown;
  readonly lineWidth: number;
  readonly globalAlpha: number;
}

const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha'] as const;

/** A context that records every fill and stroke into `ops`. */
function recordingContext(ops: Op[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if ((STATE_KEYS as readonly string[]).includes(name)) return state[name];
        return (...args: unknown[]) => {
          if (name === 'createRadialGradient') return { addColorStop: () => undefined };
          if (name === 'fill' || name === 'stroke') {
            ops.push({
              op: name,
              cmds: (args[0] as LogPath).cmds as unknown[][],
              fillStyle: state.fillStyle,
              strokeStyle: state.strokeStyle,
              lineWidth: state.lineWidth as number,
              globalAlpha: state.globalAlpha as number,
            });
          }
        };
      },
      set: (_target, key, value) => {
        state[String(key)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

type Made = Map<string, { w: number; h: number; ops: Op[] }>;

/** A scene stand-in whose texture manager records each canvas texture made, its size and what was painted. */
function fakeScene(made: Made): never {
  return {
    textures: {
      exists: () => false,
      remove: () => undefined,
      createCanvas: (key: string, w: number, h: number) => {
        const ops: Op[] = [];
        made.set(key, { w, h, ops });
        return { context: recordingContext(ops), refresh: () => undefined };
      },
    },
  } as never;
}

const TURTLE_KEYS = [
  LAKE_TEX.mudTurtleCrawlA,
  LAKE_TEX.mudTurtleCrawlB,
  LAKE_TEX.mudTurtleWarn,
  LAKE_TEX.mudTurtleSnap,
  LAKE_TEX.mudTurtleStill,
  LAKE_TEX.mudTurtleHead,
  LAKE_TEX.mudTurtleNeck,
];
const LIGHT_KEYS = [LAKE_TEX.fadingLightOut, LAKE_TEX.fadingLightHint, LAKE_TEX.fadingLightLit];
const NEW_KEYS = [...TURTLE_KEYS, ...LIGHT_KEYS];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Area 13 lake textures', () => {
  it('names every new key once, matching the painters keys', () => {
    expect(new Set(NEW_KEYS).size).toBe(NEW_KEYS.length);
    for (const frame of MUD_TURTLE_FRAMES) expect(LAKE_TEX[`mudTurtle${frame[0].toUpperCase()}${frame.slice(1)}` as keyof typeof LAKE_TEX]).toBe(MUD_TURTLE_KEYS[frame]);
    expect(LAKE_TEX.mudTurtleHead).toBe(MUD_TURTLE_KEYS.head);
    expect(LAKE_TEX.mudTurtleNeck).toBe(MUD_TURTLE_KEYS.neck);
    for (const frame of FADING_LIGHT_FRAMES) expect(Object.values(LAKE_TEX)).toContain(FADING_LIGHT_KEYS[frame]);
  });

  it('bakes every new key exactly once, at the logical size times the bake scale', () => {
    vi.stubGlobal('Path2D', LogPath);
    const made: Made = new Map();
    const lake = bakeLakeTextures(fakeScene(made), 2);
    for (const key of NEW_KEYS) {
      expect(made.has(key)).toBe(true);
      expect(lake.info[key]).toBeDefined();
      const size = LAKE_TEX_SIZES[key];
      expect([made.get(key)!.w, made.get(key)!.h]).toEqual([Math.ceil(size.w * 2), Math.ceil(size.h * 2)]);
      expect(made.get(key)!.ops.length).toBeGreaterThan(0);
      expect(lake.info[key].scale).toBe(2);
      expect([lake.info[key].w, lake.info[key].h]).toEqual([size.w, size.h]);
    }
    expect([...made.keys()].sort()).toEqual(Object.values(LAKE_TEX).sort());
  });

  it('sizes the textures from the painters', () => {
    for (const frame of MUD_TURTLE_FRAMES) expect(LAKE_TEX_SIZES[MUD_TURTLE_KEYS[frame]]).toBe(MUD_TURTLE_TEX);
    expect(LAKE_TEX_SIZES[LAKE_TEX.mudTurtleHead]).toBe(MUD_TURTLE_HEAD_TEX);
    expect(LAKE_TEX_SIZES[LAKE_TEX.mudTurtleNeck]).toBe(MUD_TURTLE_NECK_TEX);
    for (const frame of FADING_LIGHT_FRAMES) expect(LAKE_TEX_SIZES[FADING_LIGHT_KEYS[frame]]).toBe(FADING_LIGHT_TEX);
  });

  it('anchors each texture on the origin of its painter: shell centre, head centre, neck top, touch centre', () => {
    vi.stubGlobal('Path2D', LogPath);
    const lake = bakeLakeTextures(fakeScene(new Map()), 1);
    for (const frame of MUD_TURTLE_FRAMES) {
      expect([lake.mudTurtle[frame].originX, lake.mudTurtle[frame].originY]).toEqual([MUD_TURTLE_TEX.originX, MUD_TURTLE_TEX.originY]);
    }
    expect([lake.mudTurtleHead.originX, lake.mudTurtleHead.originY]).toEqual([MUD_TURTLE_HEAD_TEX.originX, MUD_TURTLE_HEAD_TEX.originY]);
    expect([lake.mudTurtleNeck.originX, lake.mudTurtleNeck.originY]).toEqual([MUD_TURTLE_NECK_TEX.originX, MUD_TURTLE_NECK_TEX.originY]);
    for (const frame of FADING_LIGHT_FRAMES) {
      expect([lake.fadingLight[frame].originX, lake.fadingLight[frame].originY]).toEqual([FADING_LIGHT_TEX.originX, FADING_LIGHT_TEX.originY]);
    }
  });

  it('returns each frame under its own key', () => {
    vi.stubGlobal('Path2D', LogPath);
    const lake = bakeLakeTextures(fakeScene(new Map()), 1);
    for (const frame of MUD_TURTLE_FRAMES as readonly MudTurtleFrame[]) expect(lake.mudTurtle[frame].key).toBe(MUD_TURTLE_KEYS[frame]);
    expect(lake.mudTurtleHead.key).toBe(MUD_TURTLE_KEYS.head);
    expect(lake.mudTurtleNeck.key).toBe(MUD_TURTLE_KEYS.neck);
    for (const frame of FADING_LIGHT_FRAMES as readonly FadingLightFrame[]) expect(lake.fadingLight[frame].key).toBe(FADING_LIGHT_KEYS[frame]);
  });

  it('paints every turtle frame and every light frame differently', () => {
    vi.stubGlobal('Path2D', LogPath);
    const made: Made = new Map();
    bakeLakeTextures(fakeScene(made), 1);
    const paintedTurtle = MUD_TURTLE_FRAMES.map((frame) => JSON.stringify(made.get(MUD_TURTLE_KEYS[frame])!.ops));
    expect(new Set(paintedTurtle).size).toBe(MUD_TURTLE_FRAMES.length);
    const paintedLight = FADING_LIGHT_FRAMES.map((frame) => JSON.stringify(made.get(FADING_LIGHT_KEYS[frame])!.ops));
    expect(new Set(paintedLight).size).toBe(FADING_LIGHT_FRAMES.length);
  });

  it('keeps every new texture within the lake small-sprite caps', () => {
    for (const key of NEW_KEYS) {
      const size = LAKE_TEX_SIZES[key];
      expect(size.w).toBeLessThanOrEqual(LAKE_TEX_MAX_W);
      expect(size.h).toBeLessThanOrEqual(LAKE_TEX_MAX_H);
    }
  });
});

describe('Area 14 lake textures (issue #213)', () => {
  const AREA_14_KEYS = [LAKE_TEX.litterCan, LAKE_TEX.litterBottle, LAKE_TEX.driftingIslandHalf];

  it('names the litter kinds and the half mat once, matching the painters keys', () => {
    expect(new Set(AREA_14_KEYS).size).toBe(AREA_14_KEYS.length);
    expect(LAKE_TEX.litterCan).toBe(LITTER_KEYS.can);
    expect(LAKE_TEX.litterBottle).toBe(LITTER_KEYS.bottle);
    expect(LAKE_TEX.driftingIslandHalf).toBe(DRIFTING_ISLAND_KEY);
    for (const key of AREA_14_KEYS) expect(NEW_KEYS).not.toContain(key);
  });

  it('bakes each once, at the logical size times the bake scale, anchored where the painters say', () => {
    vi.stubGlobal('Path2D', LogPath);
    const made: Made = new Map();
    const lake = bakeLakeTextures(fakeScene(made), 2);
    for (const kind of LITTER_KINDS) {
      const key = LITTER_KEYS[kind];
      expect([made.get(key)!.w, made.get(key)!.h]).toEqual([Math.ceil(LITTER_TEX.w * 2), Math.ceil(LITTER_TEX.h * 2)]);
      expect(made.get(key)!.ops.length).toBeGreaterThan(0);
      expect([lake.litter[kind].key, lake.litter[kind].scale]).toEqual([key, 2]);
      expect([lake.litter[kind].originX, lake.litter[kind].originY]).toEqual([LITTER_TEX.originX, LITTER_TEX.originY]);
      expect(LAKE_TEX_SIZES[key]).toBe(LITTER_TEX);
    }
    const island = made.get(DRIFTING_ISLAND_KEY)!;
    expect([island.w, island.h]).toEqual([DRIFTING_ISLAND_HALF_TEX.w * 2, DRIFTING_ISLAND_HALF_TEX.h * 2]);
    expect(island.ops.length).toBeGreaterThan(0);
    expect([lake.driftingIslandHalf.key, lake.driftingIslandHalf.scale]).toEqual([DRIFTING_ISLAND_KEY, 2]);
    expect([lake.driftingIslandHalf.originX, lake.driftingIslandHalf.originY]).toEqual([DRIFTING_ISLAND_HALF_TEX.originX, DRIFTING_ISLAND_HALF_TEX.originY]);
    expect(LAKE_TEX_SIZES[DRIFTING_ISLAND_KEY]).toBe(DRIFTING_ISLAND_HALF_TEX);
  });

  it('paints the two litter kinds differently', () => {
    vi.stubGlobal('Path2D', LogPath);
    const made: Made = new Map();
    bakeLakeTextures(fakeScene(made), 1);
    const painted = LITTER_KINDS.map((kind) => JSON.stringify(made.get(LITTER_KEYS[kind])!.ops));
    expect(new Set(painted).size).toBe(LITTER_KINDS.length);
  });

  it('keeps every new texture within the lake small-sprite caps', () => {
    for (const key of AREA_14_KEYS) {
      expect(LAKE_TEX_SIZES[key].w).toBeLessThanOrEqual(LAKE_TEX_MAX_W);
      expect(LAKE_TEX_SIZES[key].h).toBeLessThanOrEqual(LAKE_TEX_MAX_H);
    }
  });
});
