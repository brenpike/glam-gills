/**
 * Surface boats and moored hull slots (Areas 8 and 9): the x-extent of every surface boat's art, and the
 * whole moored hulls that fit in each bank overhang rect clear of them. Unit cases run on synthetic
 * spans; the layout cases run on the current Area 8 data, read generically so they hold when the
 * routes move. No Phaser is loaded.
 */
import { describe, expect, it, vi } from 'vitest';
import { AREAS, habitatById, type AreaData } from '../logic/areas';
import { bailingBoatSpawn } from '../logic/bailingBuckets';
import { DEEP_CANAL_LAYOUT } from '../logic/deepCanalLayout';
import { DEV_AREAS } from '../logic/devAreas';
import { PUNTING_POLE, STALACTITE_DRIP, movingHazardBaseY, movingHazardSpawn } from '../logic/movingHazards';
import { trajineraSpawn } from '../logic/trajineras';
import { SURF, areaSize, swimBounds } from '../logic/zone';
import {
  BAILING_BOAT_TEX,
  BAILING_BUCKET_FRONT_TEX,
  BAILING_BUCKET_TEX,
  BAILING_RIPPLES_TEX,
  BAILING_SHADOW_TEX,
} from './drawBailingBucket';
import { MOORED_HULL_TEX, TRAJINERA_HULL_TEX, TRAJINERA_HULL_W, TRAJINERA_SHADOW_TEX } from './drawDeepCanal';
import { habitatLook } from './habitatLook';
import { MOVING_HAZARD_LOOKS } from './movingHazardTextures';
import {
  MOORED_HULL_GAP,
  SURFACE_BOAT_GAP,
  TRAJINERA_FRAME_OVERHANG,
  mooredHullSlots,
  surfaceBoatSpans,
  type SurfaceBoatSpan,
} from './surfaceBoats';

vi.mock('phaser', () => ({}));

const span = (id: string, x0: number, x1: number): SurfaceBoatSpan => ({ id, x0, x1 });

describe('surface boat gaps', () => {
  it('keeps 8 px of water between a moored hull and any other surface boat, and 14 px hull to hull', () => {
    expect(SURFACE_BOAT_GAP).toBe(8);
    expect(MOORED_HULL_GAP).toBe(14);
  });
});

describe('surfaceBoatSpans', () => {
  it('gives a punting pole the union of its bow and shadow frames: x - 74 to x + 82', () => {
    const pole = movingHazardSpawn('pole', PUNTING_POLE, 1000, 0);
    expect(surfaceBoatSpans({ movingHazards: [pole] })).toEqual([{ id: 'pole', x0: 926, x1: 1082 }]);
    const { bow, shadow } = MOVING_HAZARD_LOOKS['punting-pole'].parts;
    expect(926).toBe(1000 - Math.max(bow.tex.originX, shadow.tex.originX));
    expect(1082).toBe(1000 + Math.max(bow.tex.w - bow.tex.originX, shadow.tex.w - shadow.tex.originX));
  });

  it('skips a moving hazard whose base is not the surface', () => {
    const drip = movingHazardSpawn('drip', STALACTITE_DRIP, 500, 0, undefined, 300);
    expect(movingHazardBaseY(drip)).not.toBe(SURF);
    expect(surfaceBoatSpans({ movingHazards: [drip] })).toEqual([]);
  });

  it('widens a gliding trajinera\'s whole route by the larger of its hull and shadow frame overhangs', () => {
    const hullOverhang = TRAJINERA_HULL_TEX.originX - TRAJINERA_HULL_W / 2;
    const shadowOverhang = TRAJINERA_SHADOW_TEX.originX - TRAJINERA_HULL_W / 2;
    expect(TRAJINERA_FRAME_OVERHANG).toBe(Math.max(hullOverhang, shadowOverhang));
    expect(TRAJINERA_FRAME_OVERHANG).toBeGreaterThan(0);
    for (const direction of ['left', 'right'] as const) {
      const boat = trajineraSpawn('boat', 0, { x0: 500, x1: 800, direction });
      expect(surfaceBoatSpans({ trajineras: [boat] })).toEqual([
        { id: 'boat', x0: 500 - TRAJINERA_FRAME_OVERHANG, x1: 800 + TRAJINERA_FRAME_OVERHANG },
      ]);
    }
  });

  it('gives a bailing boat the union of its hull span, its hull frame at the span\'s middle and its bucket frames at the bucket\'s x', () => {
    const bounds = swimBounds(areaSize(9, 2));
    const centred = bailingBoatSpawn('bail', 0, { x0: 3000, x1: 3120, bucketX: 3060, landing: { x: 1800, y: 400 } }, bounds);
    const bucketFrames = [BAILING_BUCKET_TEX, BAILING_BUCKET_FRONT_TEX, BAILING_SHADOW_TEX, BAILING_RIPPLES_TEX];
    expect(surfaceBoatSpans({ bailingBoats: [centred] })).toEqual([
      {
        id: 'bail',
        x0: Math.min(3000, 3060 - BAILING_BOAT_TEX.originX, ...bucketFrames.map((tex) => 3060 - tex.originX)),
        x1: Math.max(3120, 3060 + BAILING_BOAT_TEX.w - BAILING_BOAT_TEX.originX, ...bucketFrames.map((tex) => 3060 + tex.w - tex.originX)),
      },
    ]);
    // The hull frame, inked and padded, reaches past a 120 px span, so the span is wider than the hull rect.
    const [centredSpan] = surfaceBoatSpans({ bailingBoats: [centred] });
    expect(centredSpan.x0).toBeLessThan(3000);
    expect(centredSpan.x1).toBeGreaterThan(3120);
    // A bucket at the span's end reaches past the hull frame on that side.
    const offCentre = bailingBoatSpawn('east', 0, { x0: 3000, x1: 3120, bucketX: 3096, landing: { x: 1800, y: 400 } }, bounds);
    const [offSpan] = surfaceBoatSpans({ bailingBoats: [offCentre] });
    expect(offSpan.x0).toBe(centredSpan.x0);
    expect(offSpan.x1).toBe(Math.max(...bucketFrames.map((tex) => 3096 + tex.w - tex.originX)));
    expect(offSpan.x1).toBeGreaterThan(centredSpan.x1);
  });

  it('lists surface moving hazards, then trajineras, then bailing boats, each with its id, and nothing for a zone with none', () => {
    const pole = movingHazardSpawn('pole', PUNTING_POLE, 2000, 0);
    const boat = trajineraSpawn('boat', 0, { x0: 100, x1: 300, direction: 'right' });
    const bail = bailingBoatSpawn('bail', 0, { x0: 3000, x1: 3120, bucketX: 3060, landing: { x: 1800, y: 400 } }, swimBounds(areaSize(9, 2)));
    expect(surfaceBoatSpans({ bailingBoats: [bail], movingHazards: [pole], trajineras: [boat] }).map((s) => s.id)).toEqual([
      'pole',
      'boat',
      'bail',
    ]);
    expect(surfaceBoatSpans({})).toEqual([]);
  });

  it('keeps a moored hull SURFACE_BOAT_GAP clear of a bailing boat\'s art', () => {
    const bail = bailingBoatSpawn('bail', 0, { x0: 3000, x1: 3120, bucketX: 3060, landing: { x: 1800, y: 400 } }, swimBounds(areaSize(9, 2)));
    const spans = surfaceBoatSpans({ bailingBoats: [bail] });
    const [bailSpan] = spans;
    const hullW = MOORED_HULL_TEX.w;
    const slots = mooredHullSlots({ x0: 2400, x1: 3700 }, spans, hullW);
    expect(slots.length).toBeGreaterThan(0);
    for (const slotX of slots) {
      const clear = slotX + hullW <= bailSpan.x0 - SURFACE_BOAT_GAP || slotX >= bailSpan.x1 + SURFACE_BOAT_GAP;
      expect(clear, `hull at ${slotX}`).toBe(true);
    }
  });

  it('throws for a surface moving hazard whose look has no art', () => {
    const pole = movingHazardSpawn('odd', { ...PUNTING_POLE, look: 'no-such-look' }, 1000, 0);
    expect(() => surfaceBoatSpans({ movingHazards: [pole] })).toThrow(/no-such-look/);
  });
});

describe('mooredHullSlots', () => {
  it('centres as many whole hulls as fit in an open rect, MOORED_HULL_GAP apart', () => {
    // Two 100 px hulls and a 14 px gap: 214 px, centred in 300.
    expect(mooredHullSlots({ x0: 0, x1: 300 }, [], 100)).toEqual([43, 157]);
    expect(mooredHullSlots({ x0: 0, x1: 100 }, [], 100)).toEqual([0]);
    expect(mooredHullSlots({ x0: 0, x1: 214 }, [], 100)).toEqual([0, 114]);
  });

  it('gives a stretch narrower than one hull no hull: a hull is never stretched', () => {
    expect(mooredHullSlots({ x0: 0, x1: 99 }, [], 100)).toEqual([]);
    expect(mooredHullSlots({ x0: 0, x1: 213 }, [], 100)).toEqual([56.5]);
  });

  it('takes every span, widened by SURFACE_BOAT_GAP, out of the rect and fills each stretch left', () => {
    // Blocked 192..308: stretches 0..192 and 308..500.
    expect(mooredHullSlots({ x0: 0, x1: 500 }, [span('a', 200, 300)], 100)).toEqual([46, 354]);
  });

  it('gives no hull where the spans leave no stretch wide enough', () => {
    expect(mooredHullSlots({ x0: 0, x1: 300 }, [span('a', -50, 350)], 100)).toEqual([]);
    expect(mooredHullSlots({ x0: 0, x1: 300 }, [span('a', 50, 120), span('b', 180, 250)], 100)).toEqual([]);
  });

  it('ignores spans outside the rect except for their gap, in any order, overlapping or not', () => {
    expect(mooredHullSlots({ x0: 0, x1: 300 }, [span('far', 1000, 1200)], 100)).toEqual([43, 157]);
    // A span ending 4 px before the rect still holds 4 px of the gap inside it.
    expect(mooredHullSlots({ x0: 0, x1: 300 }, [span('near', -100, -4)], 100)).toEqual([45, 159]);
    const spans = [span('b', 420, 480), span('a', 100, 200), span('c', 150, 260)];
    // Blocked 92..268 and 412..488: stretches 0..92, 268..412 and 488..600.
    expect(mooredHullSlots({ x0: 0, x1: 600 }, spans, 100)).toEqual([290, 494]);
  });

  it('returns the slots west to east, each a whole hull inside its stretch', () => {
    const slots = mooredHullSlots({ x0: 40, x1: 900 }, [span('a', 400, 480)], 120);
    expect([...slots].sort((a, b) => a - b)).toEqual(slots);
    for (let i = 1; i < slots.length; i++) expect(slots[i] - slots[i - 1]).toBeGreaterThanOrEqual(120 + MOORED_HULL_GAP);
  });

  it('throws for a hull frame width that is not finite and above 0', () => {
    expect(() => mooredHullSlots({ x0: 0, x1: 300 }, [], 0)).toThrow(RangeError);
    expect(() => mooredHullSlots({ x0: 0, x1: 300 }, [], Number.NaN)).toThrow(RangeError);
  });
});

describe('moored hulls on the current Area 8 layout', () => {
  const spans = surfaceBoatSpans(DEEP_CANAL_LAYOUT);
  const rects = DEEP_CANAL_LAYOUT.bankOverhangs ?? [];
  const hullW = MOORED_HULL_TEX.w;

  it('gives every surface pole and every gliding trajinera a span', () => {
    const surfaceHazards = (DEEP_CANAL_LAYOUT.movingHazards ?? []).filter((spawn) => movingHazardBaseY(spawn) === SURF);
    const boats = DEEP_CANAL_LAYOUT.trajineras ?? [];
    expect(surfaceHazards.length).toBeGreaterThan(0);
    expect(boats.length).toBeGreaterThan(0);
    expect(spans.map((s) => s.id)).toEqual([...surfaceHazards.map((h) => h.id), ...boats.map((b) => b.id)]);
    for (const pole of surfaceHazards.filter((h) => h.type === PUNTING_POLE)) {
      expect(spans.find((s) => s.id === pole.id)).toEqual({ id: pole.id, x0: pole.x - 74, x1: pole.x + 82 });
    }
    for (const boat of boats) {
      expect(spans.find((s) => s.id === boat.id)).toEqual({
        id: boat.id,
        x0: boat.trajinera.x0 - TRAJINERA_FRAME_OVERHANG,
        x1: boat.trajinera.x1 + TRAJINERA_FRAME_OVERHANG,
      });
    }
  });

  it('keeps every hull inside its rect and at least SURFACE_BOAT_GAP from every surface boat, never stretched', () => {
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      const slots = mooredHullSlots(rect, spans, hullW);
      for (const slotX of slots) {
        const label = `hull at ${slotX} in ${rect.x0}..${rect.x1}`;
        expect(slotX, label).toBeGreaterThanOrEqual(rect.x0);
        expect(slotX + hullW, label).toBeLessThanOrEqual(rect.x1);
        for (const boat of spans) {
          const clear = slotX + hullW <= boat.x0 - SURFACE_BOAT_GAP || slotX >= boat.x1 + SURFACE_BOAT_GAP;
          expect(clear, `${label} against ${boat.id} ${boat.x0}..${boat.x1}`).toBe(true);
        }
      }
      for (let i = 1; i < slots.length; i++) expect(slots[i] - slots[i - 1]).toBeGreaterThanOrEqual(hullW + MOORED_HULL_GAP);
    }
  });

  it('still sets some whole hulls in Area 8; a short row may get the shade only', () => {
    const total = rects.reduce((sum, rect) => sum + mooredHullSlots(rect, spans, hullW).length, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('has no bailing boat, so its spans are its poles and trajineras alone', () => {
    expect(DEEP_CANAL_LAYOUT.bailingBoats ?? []).toHaveLength(0);
    expect(spans).toEqual(surfaceBoatSpans({ movingHazards: DEEP_CANAL_LAYOUT.movingHazards, trajineras: DEEP_CANAL_LAYOUT.trajineras }));
  });

  it('sets the 4 hulls ADR 0036 records: one west, none in the short row, one middle, two east', () => {
    expect(rects.map((rect) => mooredHullSlots(rect, spans, hullW).length)).toEqual([1, 0, 1, 2]);
  });
});

/** Every area and dev area, each with its look resolved from its own look or its habitat's. */
const ALL_AREAS: readonly Readonly<AreaData>[] = [...AREAS, ...DEV_AREAS];

/** The look an area is drawn with: its own look variant, else its habitat's look. Throws for an unknown habitat. */
function lookAreaUp(area: Readonly<AreaData>): ReturnType<typeof habitatLook> {
  const habitat = habitatById(area.habitatId);
  if (habitat === undefined) throw new Error(`area ${area.id} has unknown habitat ${area.habitatId}`);
  return habitatLook(area.look ?? habitat.look);
}

/** True when two x-extents leave at least SURFACE_BOAT_GAP of water between them. */
function isClearOf(a: Readonly<{ x0: number; x1: number }>, b: Readonly<{ x0: number; x1: number }>): boolean {
  return a.x1 + SURFACE_BOAT_GAP <= b.x0 || b.x1 + SURFACE_BOAT_GAP <= a.x0;
}

/** Every pair of surface boats in one area closer than SURFACE_BOAT_GAP, named by id with both extents. */
function findCrowdedPairs(spans: readonly Readonly<SurfaceBoatSpan>[]): string[] {
  const crowded: string[] = [];
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const [a, b] = [spans[i], spans[j]];
      if (isClearOf(a, b)) continue;
      crowded.push(`${a.id} ${a.x0}..${a.x1} and ${b.id} ${b.x0}..${b.x1}`);
    }
  }
  return crowded;
}

describe('surface boats in every area', () => {
  it('keeps every two surface boats in an area at least SURFACE_BOAT_GAP apart', () => {
    const crowded = ALL_AREAS.flatMap((area) => findCrowdedPairs(surfaceBoatSpans(area.layout)));
    expect(crowded).toEqual([]);
  });

  it('keeps every gliding trajinera at least SURFACE_BOAT_GAP from every moored row in a deep canal area', () => {
    const deepCanalAreas = ALL_AREAS.filter((area) => lookAreaUp(area).deepCanalProps);
    expect(deepCanalAreas.length).toBeGreaterThan(0);
    for (const area of deepCanalAreas) {
      const boats = surfaceBoatSpans({ trajineras: area.layout.trajineras });
      for (const boat of boats) {
        for (const rect of area.layout.bankOverhangs ?? []) {
          expect(isClearOf(boat, rect), `${area.id}: ${boat.id} ${boat.x0}..${boat.x1} and moored row ${rect.x0}..${rect.x1}`).toBe(true);
        }
      }
    }
  });
});
