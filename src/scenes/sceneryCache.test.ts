import { describe, expect, it } from 'vitest';
import type { SceneryTextures, TexInfo } from '../art/textures';
import { CANAL_AREA_ID } from '../logic/zone';
import { SceneryCache } from './sceneryCache';

function info(key: string): TexInfo {
  return { key } as TexInfo;
}

/** Scenery for `areaId` whose middle row shares one deep chunk, like a real tall area. */
function sceneryOf(areaId: string): SceneryTextures {
  const deep = info(`${areaId}:deep`);
  return {
    bg: [[info(`${areaId}:bg0`)], [deep], [deep]],
    reeds: [info(`${areaId}:reed0`)],
    pads: [info(`${areaId}:pad0`)],
  };
}

/** A fake scene whose texture manager holds `keys`, and a cache that bakes into it. */
function setup() {
  const keys = new Set<string>();
  const removed: string[] = [];
  const scene = {
    textures: {
      exists: (key: string) => keys.has(key),
      remove: (key: string) => {
        removed.push(key);
        keys.delete(key);
      },
    },
  } as never;
  const baked: string[] = [];
  const cache = new SceneryCache(sceneryOf(CANAL_AREA_ID), (_scene, areaId) => {
    baked.push(areaId);
    const scenery = sceneryOf(areaId);
    for (const tex of [...scenery.bg.flat(), ...scenery.reeds, ...scenery.pads]) keys.add(tex.key);
    return scenery;
  });
  return { cache, scene, keys, removed, baked };
}

describe('SceneryCache', () => {
  it('returns the canal scenery from the boot bake without baking', () => {
    const { cache, scene, baked } = setup();
    expect(cache.get(scene, CANAL_AREA_ID).bg[0][0].key).toBe(`${CANAL_AREA_ID}:bg0`);
    expect(baked).toEqual([]);
  });

  it('bakes an area once and reuses it while it is held', () => {
    const { cache, scene, baked } = setup();
    const first = cache.get(scene, 'pond-1');
    expect(cache.get(scene, 'pond-1')).toBe(first);
    expect(cache.get(scene, CANAL_AREA_ID)).not.toBe(first);
    expect(cache.get(scene, 'pond-1')).toBe(first);
    expect(baked).toEqual(['pond-1']);
  });

  it('removes the last area textures, each key once, before baking a new area', () => {
    const { cache, scene, keys, removed, baked } = setup();
    cache.get(scene, 'pond-1');
    cache.get(scene, 'chinampa-1');
    expect(removed.sort()).toEqual(['pond-1:bg0', 'pond-1:deep', 'pond-1:pad0', 'pond-1:reed0']);
    expect([...keys].every((key) => key.startsWith('chinampa-1:'))).toBe(true);
    cache.get(scene, 'pond-1');
    expect(baked).toEqual(['pond-1', 'chinampa-1', 'pond-1']);
  });
});
