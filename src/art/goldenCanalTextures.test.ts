/**
 * The golden-hour bake (issue #112, Area 11; ND-13), headless: the one sinking marigold petal is
 * baked only when some look lets petals sink, at the petal's own frame size. A fake scene records
 * every canvas texture it is asked for, and a stub Path2D and context take the painter's calls. No
 * Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MARIGOLD_PETAL, SINKING_PETAL_TEX } from './drawGoldenCanal';
import { bakeGoldenCanalTextures, GOLDEN_CANAL_TEX } from './goldenCanalTextures';
import { AREA_LOOK_IDS, DEEP_CANAL_GOLDEN_LOOK, habitatLook } from './habitatLook';

vi.mock('phaser', () => ({}));

/** A Path2D stand-in: every path call is accepted and ignored. */
class StubPath {
  constructor() {
    return new Proxy(this, { get: () => () => undefined });
  }
}

/** A canvas context stand-in that keeps the fill style of every fill. */
function fillRecordingContext(fills: unknown[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = {};
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if (name in state) return state[name];
        if (name === 'fill') return () => fills.push(state.fillStyle);
        return () => undefined;
      },
      set: (_target, key, value) => {
        state[String(key)] = value;
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
}

/** A scene stand-in whose texture manager records each canvas texture made and the fills painted on it. */
function fakeScene(made: Map<string, unknown[]>): never {
  return {
    textures: {
      exists: () => false,
      remove: () => undefined,
      createCanvas: (key: string) => {
        const fills: unknown[] = [];
        made.set(key, fills);
        return { context: fillRecordingContext(fills), refresh: () => undefined };
      },
    },
  } as never;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bakeGoldenCanalTextures', () => {
  it('bakes nothing and returns null when no look lets petals sink', () => {
    const made = new Map<string, unknown[]>();
    const looks = AREA_LOOK_IDS.map(habitatLook).filter((look) => look.sinkingPetalsPerScreen === 0);
    expect(looks.length).toBeGreaterThan(0);
    expect(bakeGoldenCanalTextures(fakeScene(made), 2, looks)).toBeNull();
    expect(bakeGoldenCanalTextures(fakeScene(made), 2, [])).toBeNull();
    expect(made.size).toBe(0);
  });

  it('bakes exactly one petal at its frame size when some look lets petals sink', () => {
    vi.stubGlobal('Path2D', StubPath);
    const made = new Map<string, unknown[]>();
    const looks = [habitatLook('deep-canal'), DEEP_CANAL_GOLDEN_LOOK, DEEP_CANAL_GOLDEN_LOOK];
    const baked = bakeGoldenCanalTextures(fakeScene(made), 2, looks);
    expect([...made.keys()]).toEqual([GOLDEN_CANAL_TEX.sinkingPetal]);
    expect(baked).not.toBeNull();
    const info = baked!.sinkingPetal;
    expect(info.key).toBe(GOLDEN_CANAL_TEX.sinkingPetal);
    expect(info.scale).toBe(2);
    expect([info.w, info.h, info.originX, info.originY]).toEqual([
      SINKING_PETAL_TEX.w,
      SINKING_PETAL_TEX.h,
      SINKING_PETAL_TEX.originX,
      SINKING_PETAL_TEX.originY,
    ]);
    expect(made.get(GOLDEN_CANAL_TEX.sinkingPetal)).toContain(MARIGOLD_PETAL);
  });

  it('is baked the same way twice (stable key, no state kept between calls)', () => {
    vi.stubGlobal('Path2D', StubPath);
    const first = bakeGoldenCanalTextures(fakeScene(new Map()), 2, [DEEP_CANAL_GOLDEN_LOOK]);
    const second = bakeGoldenCanalTextures(fakeScene(new Map()), 2, [DEEP_CANAL_GOLDEN_LOOK]);
    expect(second).toEqual(first);
  });
});
