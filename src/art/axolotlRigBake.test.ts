/**
 * Axolotl rig bake texture lifecycle (issue #46), headless: a bake removes
 * every texture it made, the shared twinkle strip lives only while some bake
 * holds it, and changes re-bake once, lazily (on the next read of baked state
 * or at the game's POST_STEP). Phaser is mocked, the scene is a fake texture
 * manager and game event emitter, and the painters and game objects run
 * against inert values that accept every call and draw nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { createAxolotlRigBake, createAxolotlRigView, takeRigBakeCount } from './axolotlRig';
import { RIG_PAD, RIG_STILL_POSE, rigParts } from './axolotlRigParts';
import { AXO_TEX } from './drawAxolotl';
import {
  AXO_SIZE_SCALE,
  DEFAULT_ART_LOOK,
  HEAD_BIG_FOOTPRINT,
  HEAD_FOOTPRINT,
  backBigFootprint,
  backFootprint,
  type AxolotlArtLook,
  type Bounds,
} from './drawAxolotlParts';
import { BIG_WEARABLE_ART_SLUGS, NO_OUTFIT, WEARABLE_ART_SLOT, type ArtOutfit, type WearableArtSlug } from './drawWearables';
import { MORPH_PALETTES, axolotlPalette } from './palette';
import { makeInfo } from './textures';

const { inert, InertGameObject } = vi.hoisted(() => {
  /** A value that accepts every call, property read and write, and turns into 0 as a primitive. */
  function inert(): unknown {
    const stored = new Map<PropertyKey, unknown>();
    const target = function noop(): void {};
    const proxy: unknown = new Proxy(target, {
      get: (_t, key) => {
        if (key === Symbol.toPrimitive) return () => 0;
        if (stored.has(key)) return stored.get(key);
        return proxy;
      },
      set: (_t, key, value: unknown) => {
        stored.set(key, value);
        return true;
      },
      apply: () => proxy,
      construct: () => proxy as object,
    });
    return proxy;
  }

  /** A game object stand-in (Image, Rope, Graphics): constructing one gives an inert value. */
  class InertGameObject {
    constructor() {
      return inert() as InertGameObject;
    }
  }

  return { inert, InertGameObject };
});

vi.mock('phaser', () => ({
  CANVAS: 1,
  WEBGL: 2,
  Core: { Events: { POST_STEP: 'poststep' } },
  GameObjects: {
    Events: { DESTROY: 'destroy' },
    Image: InertGameObject,
    Rope: InertGameObject,
    Graphics: InertGameObject,
  },
}));

/** The texture manager surface a bake uses, recording what it creates and removes. */
class FakeTextures {
  readonly live = new Set<string>();
  readonly created: string[] = [];
  /** Width and height of each texture, by key, as last created. */
  readonly sizes = new Map<string, { readonly w: number; readonly h: number }>();

  exists(key: string): boolean {
    return this.live.has(key);
  }

  remove(key: string): void {
    this.live.delete(key);
  }

  createCanvas(key: string, w: number, h: number): unknown {
    if (this.live.has(key)) throw new Error(`texture "${key}" already exists`);
    this.live.add(key);
    this.created.push(key);
    this.sizes.set(key, { w, h });
    return { context: inert(), add: () => undefined, refresh: () => undefined };
  }

  twinkles(): string[] {
    return [...this.live].filter((key) => key.startsWith('axo-rig-twinkle-'));
  }

  /** How many times `key` was created. */
  createdCount(key: string): number {
    return this.created.filter((created) => created === key).length;
  }
}

interface GameListener {
  readonly event: string;
  readonly fn: () => void;
  readonly context: unknown;
}

/** The game event emitter surface a bake uses: once, off and emit. */
class FakeGameEvents {
  private listeners: GameListener[] = [];

  once(event: string, fn: () => void, context: unknown): void {
    this.listeners.push({ event, fn, context });
  }

  off(event: string, fn: () => void, context: unknown): void {
    this.listeners = this.listeners.filter((l) => l.event !== event || l.fn !== fn || l.context !== context);
  }

  emit(event: string): void {
    const due = this.listeners.filter((l) => l.event === event);
    this.listeners = this.listeners.filter((l) => l.event !== event);
    for (const listener of due) listener.fn.call(listener.context);
  }

  count(event: string): number {
    return this.listeners.filter((l) => l.event === event).length;
  }
}

function fakeScene(textures: FakeTextures, events = new FakeGameEvents(), renderer: object = { type: 2 }): Phaser.Scene {
  return {
    textures,
    sys: { game: { renderer, events } },
    add: { container: () => inert() },
  } as unknown as Phaser.Scene;
}

const GIRL: AxolotlArtLook = { ...DEFAULT_ART_LOOK, sex: 'girl' };

beforeEach(() => {
  vi.stubGlobal('Path2D', function Path2D() {
    return inert();
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rig bake texture lifecycle', () => {
  it('removes the twinkle strip of every scale it left behind, and all its textures on destroy', () => {
    const textures = new FakeTextures();
    const bake = createAxolotlRigBake(fakeScene(textures), 'lifecycle', 2);
    expect(bake.version).toBe(1);
    for (const bakeScale of [2.25, 2.5, 2.75, 3.125, 3.5]) {
      expect(bake.setBakeScale(bakeScale)).toBe(true);
      expect(bake.version).toBeGreaterThan(1);
      expect(textures.twinkles()).toEqual([`axo-rig-twinkle-${bake.scale}`]);
    }
    bake.destroy();
    expect([...textures.live]).toEqual([]);
  });

  it('shares one twinkle strip between bakes at one scale until the last lets go', () => {
    const textures = new FakeTextures();
    const events = new FakeGameEvents();
    const scene = fakeScene(textures, events);
    const first = createAxolotlRigBake(scene, 'first', 2);
    const second = createAxolotlRigBake(scene, 'second', 2);
    events.emit('poststep');
    const strip = `axo-rig-twinkle-${first.scale}`;
    expect(textures.createdCount(strip)).toBe(1);
    first.destroy();
    expect(textures.twinkles()).toEqual([strip]);
    second.destroy();
    expect([...textures.live]).toEqual([]);
  });

  it('keeps its twinkle strip through a re-bake at the same scale without baking it again', () => {
    const textures = new FakeTextures();
    const bake = createAxolotlRigBake(fakeScene(textures), 'same-scale', 2);
    expect(bake.version).toBe(1);
    const strip = `axo-rig-twinkle-${bake.scale}`;
    expect(bake.setAppearance({ look: GIRL })).toBe(true);
    expect(bake.version).toBe(2);
    expect(textures.twinkles()).toEqual([strip]);
    expect(textures.createdCount(strip)).toBe(1);
    bake.destroy();
    expect([...textures.live]).toEqual([]);
  });

  it('packs every part texture within the WebGL renderer max texture size', () => {
    const appearance = { look: { ...DEFAULT_ART_LOOK, size: 'large' as const }, palette: axolotlPalette('leucistic', 'iridescent') };
    const widest = (maxTextureSize: number): { w: number; h: number } => {
      const textures = new FakeTextures();
      const renderer = { type: 2, getMaxTextureSize: () => maxTextureSize };
      const bake = createAxolotlRigBake(fakeScene(textures, new FakeGameEvents(), renderer), 'cap', 3, appearance);
      expect(bake.version).toBe(1);
      const sizes = [...textures.sizes.values()];
      bake.destroy();
      return { w: Math.max(...sizes.map((s) => s.w)), h: Math.max(...sizes.map((s) => s.h)) };
    };
    expect(widest(4096).w).toBeGreaterThan(2048);
    const capped = widest(2048);
    expect(capped.w).toBeLessThanOrEqual(2048);
    expect(capped.h).toBeLessThanOrEqual(2048);
  });
});

describe('rig bake re-bakes lazily, once per batch of changes', () => {
  it('bakes several changes once, on the next read, counting every texture it bakes', () => {
    const textures = new FakeTextures();
    const bake = createAxolotlRigBake(fakeScene(textures), 'batch', 2);
    const firstVersion = bake.version;
    const before = textures.created.length;
    takeRigBakeCount();
    expect(bake.setAppearance({ look: GIRL })).toBe(true);
    expect(bake.setAppearance({ palette: MORPH_PALETTES.wild })).toBe(true);
    expect(bake.setBakeScale(2.5)).toBe(true);
    expect(textures.created).toHaveLength(before);
    expect(bake.version).toBe(firstVersion + 1);
    expect(textures.createdCount('batch:body')).toBe(2);
    expect(takeRigBakeCount()).toBe(textures.created.length - before);
    bake.destroy();
  });

  it('has scale, bakeScale, look and info current right after the setters, baking nothing', () => {
    const textures = new FakeTextures();
    const bake = createAxolotlRigBake(fakeScene(textures), 'current', 2);
    const look: AxolotlArtLook = { ...DEFAULT_ART_LOOK, size: 'small' };
    bake.setBakeScale(2.5);
    bake.setAppearance({ look });
    const scale = 2.5 * AXO_SIZE_SCALE.small;
    expect(bake.bakeScale).toBe(2.5);
    expect(bake.scale).toBe(scale);
    expect(bake.look).toBe(look);
    expect(bake.info.scale).toBe(scale);
    expect(bake.info.pxW).toBe(makeInfo('current', scale, AXO_TEX).pxW);
    expect(bake.info).toEqual(makeInfo('current', scale, AXO_TEX));
    expect(textures.created).toEqual([]);
    bake.destroy();
  });

  it('bakes nothing when a change goes back to the baked appearance', () => {
    const textures = new FakeTextures();
    const events = new FakeGameEvents();
    const bake = createAxolotlRigBake(fakeScene(textures, events), 'back', 2);
    expect(bake.version).toBe(1);
    const before = textures.created.length;
    expect(bake.setAppearance({ look: GIRL })).toBe(true);
    expect(bake.setAppearance({ look: DEFAULT_ART_LOOK })).toBe(false);
    events.emit('poststep');
    expect(bake.version).toBe(1);
    expect(textures.created).toHaveLength(before);
    bake.destroy();
  });

  it('bakes a pending change at POST_STEP; a bake destroyed while stale bakes nothing and leaves no listener', () => {
    const textures = new FakeTextures();
    const events = new FakeGameEvents();
    const scene = fakeScene(textures, events);
    const bake = createAxolotlRigBake(scene, 'step', 2);
    expect(events.count('poststep')).toBe(1);
    events.emit('poststep');
    expect(textures.createdCount('step:body')).toBe(1);
    expect(bake.setAppearance({ look: GIRL })).toBe(true);
    events.emit('poststep');
    expect(textures.createdCount('step:body')).toBe(2);
    expect(bake.version).toBe(2);
    bake.destroy();

    const doomed = createAxolotlRigBake(scene, 'doomed', 2);
    doomed.setAppearance({ look: GIRL });
    doomed.destroy();
    expect(events.count('poststep')).toBe(0);
    events.emit('poststep');
    expect(textures.created.filter((key) => key.startsWith('doomed:'))).toEqual([]);
    expect([...textures.live]).toEqual([]);
  });

  it('bakes once when the styler opens (bake, view, setBakeScale, setAppearance, setPose)', () => {
    const textures = new FakeTextures();
    const scene = fakeScene(textures);
    const bake = createAxolotlRigBake(scene, 'styler', 2);
    const view = createAxolotlRigView(scene, bake);
    bake.setBakeScale(2.5);
    bake.setAppearance({ palette: MORPH_PALETTES.wild });
    view.setPose(RIG_STILL_POSE);
    expect(textures.createdCount('styler:body')).toBe(1);
    expect(bake.version).toBe(1);
    view.destroy();
    bake.destroy();
    expect([...textures.live]).toEqual([]);
  });

  it('syncs a view made while a re-bake was pending once the change goes back, and unregisters a view destroyed before the flush', () => {
    const textures = new FakeTextures();
    const events = new FakeGameEvents();
    const scene = fakeScene(textures, events);
    const bake = createAxolotlRigBake(scene, 'views', 2);
    expect(bake.version).toBe(1);
    bake.setAppearance({ look: GIRL });
    const view = createAxolotlRigView(scene, bake);
    const gone = createAxolotlRigView(scene, bake);
    gone.destroy();
    expect(textures.created.some((key) => key.startsWith('views:leg-'))).toBe(false);
    expect(bake.setAppearance({ look: DEFAULT_ART_LOOK })).toBe(false);
    expect(textures.created.some((key) => key.startsWith('views:leg-'))).toBe(true);
    expect(bake.setAppearance({ look: GIRL })).toBe(true);
    events.emit('poststep');
    expect(bake.version).toBe(2);
    view.destroy();
    bake.destroy();
    expect([...textures.live]).toEqual([]);
  });
});

describe('rig bake face part and the big Wearables (issue #207)', () => {
  const LARGE: AxolotlArtLook = { ...DEFAULT_ART_LOOK, size: 'large' };
  const faceBox = (look: AxolotlArtLook, outfit: ArtOutfit): Bounds => {
    const face = rigParts({ look, palette: MORPH_PALETTES.wild, outfit }).find((part) => part.id === 'face');
    expect(face).toBeDefined();
    return face!.box;
  };
  /** Whether the part box holds `inner` with RIG_PAD round it. */
  const holds = (box: Bounds, inner: Bounds): boolean =>
    box.minX <= inner.minX - RIG_PAD && box.minY <= inner.minY - RIG_PAD && box.maxX >= inner.maxX + RIG_PAD && box.maxY >= inner.maxY + RIG_PAD;
  const slugsOf = (slot: 'head' | 'back'): WearableArtSlug[] => (Object.keys(WEARABLE_ART_SLOT) as WearableArtSlug[]).filter((slug) => WEARABLE_ART_SLOT[slug] === slot);

  it('names the four big items: the Propeller cap and Wizard hat (Head) and the Jetpack and Surfboard (Back; issue #214, ND-6)', () => {
    expect([...BIG_WEARABLE_ART_SLUGS].sort()).toEqual(['jetpack', 'propeller-cap', 'surfboard', 'wizard-hat']);
  });

  it('grows the face part to the big Head footprint only while a big Head item is worn', () => {
    const small = slugsOf('head').filter((slug) => !BIG_WEARABLE_ART_SLUGS.has(slug));
    const big = slugsOf('head').filter((slug) => BIG_WEARABLE_ART_SLUGS.has(slug));
    expect(big).toEqual(['propeller-cap', 'wizard-hat']);
    const hat = faceBox(DEFAULT_ART_LOOK, { head: small[0] });
    for (const slug of small) expect(faceBox(DEFAULT_ART_LOOK, { head: slug }), slug).toEqual(hat);
    expect(holds(hat, HEAD_FOOTPRINT)).toBe(true);
    expect(holds(hat, HEAD_BIG_FOOTPRINT)).toBe(false);
    expect(hat.minY).toBe(HEAD_FOOTPRINT.minY - RIG_PAD);
    for (const slug of big) {
      const box = faceBox(DEFAULT_ART_LOOK, { head: slug });
      expect(holds(box, HEAD_BIG_FOOTPRINT), slug).toBe(true);
      expect(box.minY, slug).toBe(HEAD_BIG_FOOTPRINT.minY - RIG_PAD);
      expect(box.maxX, slug).toBe(HEAD_BIG_FOOTPRINT.maxX + RIG_PAD);
      expect(box.minY, slug).toBeLessThan(hat.minY);
      expect(box.maxY, slug).toBe(hat.maxY);
    }
    // Nothing worn on the head, the face part is the bare one: no footprint grows it.
    expect(faceBox(DEFAULT_ART_LOOK, NO_OUTFIT).minY).toBeGreaterThan(hat.minY);
  });

  it('grows the face part to the big Back footprint only while the Jetpack or the Surfboard is worn, on every body', () => {
    const small = slugsOf('back').filter((slug) => !BIG_WEARABLE_ART_SLUGS.has(slug));
    expect(slugsOf('back').filter((slug) => BIG_WEARABLE_ART_SLUGS.has(slug))).toEqual(['jetpack', 'surfboard']);
    for (const body of ['slim', 'regular', 'chubby'] as const) {
      for (const age of ['baby', 'young', 'grownUp'] as const) {
        const look: AxolotlArtLook = { ...DEFAULT_ART_LOOK, body, age };
        const id = `${body} ${age}`;
        const tank = faceBox(look, { back: small[0] });
        for (const slug of small) expect(faceBox(look, { back: slug }), `${id} ${slug}`).toEqual(tank);
        expect(holds(tank, backFootprint(look).bounds), id).toBe(true);
        expect(holds(tank, backBigFootprint(look).bounds), id).toBe(false);
        for (const slug of ['jetpack', 'surfboard'] as const) {
          const jet = faceBox(look, { back: slug });
          expect(holds(jet, backBigFootprint(look).bounds), `${id} ${slug}`).toBe(true);
          expect(jet.minY, `${id} ${slug}`).toBe(backBigFootprint(look).bounds.minY - RIG_PAD);
          expect(jet.minY, `${id} ${slug}`).toBeLessThan(tank.minY);
          expect(jet.maxY, `${id} ${slug}`).toBe(tank.maxY);
        }
      }
    }
  });

  it('packs the grown face part of a big outfit within the WebGL renderer max texture size', () => {
    const sizesOf = (outfit: ArtOutfit, maxTextureSize: number): Map<string, { readonly w: number; readonly h: number }> => {
      const textures = new FakeTextures();
      const renderer = { type: 2, getMaxTextureSize: () => maxTextureSize };
      const appearance = { look: LARGE, palette: axolotlPalette('leucistic', 'iridescent'), outfit };
      const bake = createAxolotlRigBake(fakeScene(textures, new FakeGameEvents(), renderer), 'big', 3, appearance);
      expect(bake.version).toBe(1);
      bake.destroy();
      return textures.sizes;
    };
    const small: ArtOutfit = { head: 'sun-hat', back: 'diving-tank', face: 'heart-glasses', shirt: 'tank-top', neck: 'shell-necklace' };
    const smallFace = sizesOf(small, 2048).get('big:face');
    expect(smallFace).toBeDefined();
    for (const back of ['jetpack', 'surfboard'] as const) {
      const big: ArtOutfit = { ...small, head: 'wizard-hat', back };
      const bigFace = sizesOf(big, 2048).get('big:face');
      expect(bigFace, back).toBeDefined();
      expect(bigFace!.h, back).toBeGreaterThan(smallFace!.h);
      for (const maxTextureSize of [2048, 4096]) {
        for (const [key, size] of sizesOf(big, maxTextureSize)) {
          expect(size.w, `${back} ${key} at ${maxTextureSize}`).toBeLessThanOrEqual(maxTextureSize);
          expect(size.h, `${back} ${key} at ${maxTextureSize}`).toBeLessThanOrEqual(maxTextureSize);
        }
      }
    }
  });
});
