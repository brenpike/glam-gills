/**
 * Surface boats and moored hull slots (Areas 8 to 11): the x-extent of every surface boat's art, and the
 * whole moored hulls that fit in each bank overhang rect clear of them. Unit cases run on synthetic
 * spans; the layout cases run on the current Area 8, Area 10 and Area 11 data, read generically so
 * they hold when the routes move. No Phaser is loaded.
 */
import { describe, expect, it, vi } from 'vitest';
import { AREAS, habitatById, type AreaData } from '../logic/areas';
import { bailingBoatSpawn } from '../logic/bailingBuckets';
import { DEEP_CANAL_3_LAYOUT } from '../logic/deepCanal3Layout';
import { DEEP_CANAL_4_CORMORANT, DEEP_CANAL_4_LAYOUT } from '../logic/deepCanal4Layout';
import { DEEP_CANAL_LAYOUT } from '../logic/deepCanalLayout';
import { dragNetSpawn } from '../logic/dragNets';
import { LURES, fishingBoatSpawn } from '../logic/lures';
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
import { CORMORANT_TEX } from './drawCormorant';
import { MOORED_HULL_TEX, TRAJINERA_HULL_TEX, TRAJINERA_HULL_W, TRAJINERA_SHADOW_TEX } from './drawDeepCanal';
import { DRAG_NET_BOAT_TEX, DRAG_NET_MOTION } from './drawDragNet';
import { FISHING_BOAT_TEX, FISHING_BOAT_W, FISHING_SHADOW_TEX } from './drawFishingTrajinera';
import { habitatLook } from './habitatLook';
import { MOVING_HAZARD_LOOKS } from './movingHazardTextures';
import {
  DRAG_NET_BOAT_REACH,
  MOORED_HULL_GAP,
  SURFACE_BOAT_GAP,
  TRAJINERA_FRAME_OVERHANG,
  mooredHullSlots,
  surfaceBoatSpans,
  type SurfaceBoatSpan,
} from './surfaceBoats';

vi.mock('phaser', () => ({}));

const span = (id: string, x0: number, x1: number): SurfaceBoatSpan => ({ id, x0, x1 });

/** Wide swim bounds for synthetic fishing boats. */
const WIDE_BOUNDS = { minX: 0, maxX: 4000, minY: 0, maxY: 1000 };

/** A synthetic drag net on the stretch x0..x1, y 400..520, sweeping right. */
const netOn = (id: string, x0: number, x1: number) =>
  dragNetSpawn(id, 0, {
    stretch: { x0, x1, y0: 400, y1: 520 },
    sweep: 'right',
    hollows: [
      { x0: x0 + 20, x1: x0 + 60, y0: 410, y1: 450 },
      { x0: x1 - 60, x1: x1 - 20, y0: 470, y1: 510 },
    ],
  });

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

  it('widens a fishing trajinera\'s whole drift span by its widest frame from the hull middle: its shadow, 70 px', () => {
    const boat = fishingBoatSpawn('fish', 0, { x0: 400, x1: 700, lures: [{ along: 0, depth: 200 }, { along: LURES.hullLength, depth: 150 }] }, WIDE_BOUNDS);
    const shadowReach = Math.max(FISHING_SHADOW_TEX.originX, FISHING_SHADOW_TEX.w - FISHING_SHADOW_TEX.originX);
    expect(shadowReach).toBe(70);
    expect(shadowReach).toBeGreaterThanOrEqual(FISHING_BOAT_TEX.originX);
    expect(surfaceBoatSpans({ fishingBoats: [boat] })).toEqual([
      { id: 'fish', x0: 400 + FISHING_BOAT_W / 2 - shadowReach, x1: 700 - FISHING_BOAT_W / 2 + shadowReach },
    ]);
    // The span covers every place the whole hull frame can be drawn as the boat drifts.
    const [fishSpan] = surfaceBoatSpans({ fishingBoats: [boat] });
    expect(fishSpan.x0).toBeLessThanOrEqual(400 + FISHING_BOAT_W / 2 - FISHING_BOAT_TEX.originX);
    expect(fishSpan.x1).toBeGreaterThanOrEqual(700 - FISHING_BOAT_W / 2 + FISHING_BOAT_TEX.w - FISHING_BOAT_TEX.originX);
  });

  it('gives a drag net both its boats, middles a half hull outside the stretch, at their warning lean, and the float line between', () => {
    const { w, h, originX, originY } = DRAG_NET_BOAT_TEX;
    const lean = DRAG_NET_MOTION.leanRad;
    expect(DRAG_NET_BOAT_REACH).toBeCloseTo(Math.max(originX, w - originX) * Math.cos(lean) + Math.max(originY, h - originY) * Math.sin(lean), 9);
    expect(DRAG_NET_BOAT_REACH).toBeGreaterThan(originX);
    const [netSpan] = surfaceBoatSpans({ dragNets: [netOn('net', 1000, 1200)] });
    expect(netSpan.id).toBe('net');
    expect(netSpan.x0).toBeCloseTo(1000 - FISHING_BOAT_W / 2 - DRAG_NET_BOAT_REACH, 9);
    expect(netSpan.x1).toBeCloseTo(1200 + FISHING_BOAT_W / 2 + DRAG_NET_BOAT_REACH, 9);
  });

  it('lists fishing trajineras and then drag nets after the bailing boats', () => {
    const bail = bailingBoatSpawn('bail', 0, { x0: 3000, x1: 3120, bucketX: 3060, landing: { x: 1800, y: 400 } }, swimBounds(areaSize(9, 2)));
    const fish = fishingBoatSpawn('fish', 0, { x0: 400, x1: 700, lures: [{ along: 0, depth: 200 }] }, WIDE_BOUNDS);
    const pole = movingHazardSpawn('pole', PUNTING_POLE, 2000, 0);
    expect(
      surfaceBoatSpans({ dragNets: [netOn('net', 1000, 1200)], fishingBoats: [fish], bailingBoats: [bail], movingHazards: [pole] }).map((s) => s.id),
    ).toEqual(['pole', 'bail', 'fish', 'net']);
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

describe('surface boats on the current Area 10 layout (issue #108)', () => {
  const spans = surfaceBoatSpans(DEEP_CANAL_3_LAYOUT);
  const rects = DEEP_CANAL_3_LAYOUT.bankOverhangs ?? [];
  const hullW = MOORED_HULL_TEX.w;

  it('gives every surface boat a span: its surface poles, trajineras, bailing boats, fishing trajineras and drag nets', () => {
    const fishing = DEEP_CANAL_3_LAYOUT.fishingBoats ?? [];
    const nets = DEEP_CANAL_3_LAYOUT.dragNets ?? [];
    expect(fishing.length).toBeGreaterThan(0);
    expect(nets.length).toBeGreaterThan(0);
    const surfaceHazards = (DEEP_CANAL_3_LAYOUT.movingHazards ?? []).filter((spawn) => movingHazardBaseY(spawn) === SURF);
    expect(spans.map((s) => s.id)).toEqual([
      ...surfaceHazards.map((hazard) => hazard.id),
      ...(DEEP_CANAL_3_LAYOUT.trajineras ?? []).map((boat) => boat.id),
      ...(DEEP_CANAL_3_LAYOUT.bailingBoats ?? []).map((boat) => boat.id),
      ...fishing.map((boat) => boat.id),
      ...nets.map((net) => net.id),
    ]);
    for (const boat of fishing) {
      const boatSpan = spans.find((s) => s.id === boat.id);
      expect(boatSpan?.x0, boat.id).toBeLessThan(boat.x0);
      expect(boatSpan?.x1, boat.id).toBeGreaterThan(boat.x1);
    }
  });

  it('keeps every two surface boats at least SURFACE_BOAT_GAP apart: no fishing trajinera or drag net overlaps another boat', () => {
    expect(findCrowdedPairs(spans)).toEqual([]);
  });

  it('keeps every moored hull inside its rect and at least SURFACE_BOAT_GAP from every surface boat, never stretched', () => {
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      const slots = mooredHullSlots(rect, spans, hullW);
      for (const slotX of slots) {
        const label = `hull at ${slotX} in ${rect.x0}..${rect.x1}`;
        expect(slotX, label).toBeGreaterThanOrEqual(rect.x0);
        expect(slotX + hullW, label).toBeLessThanOrEqual(rect.x1);
        for (const boat of spans) {
          expect(isClearOf({ x0: slotX, x1: slotX + hullW }, boat), `${label} against ${boat.id} ${boat.x0}..${boat.x1}`).toBe(true);
        }
      }
    }
  });

  it('keeps every fishing trajinera and drag net at least SURFACE_BOAT_GAP from every moored row', () => {
    const boats = surfaceBoatSpans({ fishingBoats: DEEP_CANAL_3_LAYOUT.fishingBoats, dragNets: DEEP_CANAL_3_LAYOUT.dragNets });
    for (const boat of boats) {
      for (const rect of rects) {
        expect(isClearOf(boat, rect), `${boat.id} ${boat.x0}..${boat.x1} and moored row ${rect.x0}..${rect.x1}`).toBe(true);
      }
    }
  });
});

describe('surface boats on the current Area 11 layout (issue #112)', () => {
  const spans = surfaceBoatSpans(DEEP_CANAL_4_LAYOUT);
  const rects = DEEP_CANAL_4_LAYOUT.bankOverhangs ?? [];
  const hullW = MOORED_HULL_TEX.w;
  /** A floating cormorant's frame reaches this far either side of its x: it faces either way. */
  const cormorantHalfW = Math.max(CORMORANT_TEX.originX, CORMORANT_TEX.w - CORMORANT_TEX.originX);
  const stretches = DEEP_CANAL_4_LAYOUT.predatorRoutes
    .filter((route) => route.species === DEEP_CANAL_4_CORMORANT)
    .map((route) => {
      const xs = route.waypoints.map((point) => point.x);
      return { id: route.id, x0: Math.min(...xs) - cormorantHalfW, x1: Math.max(...xs) + cormorantHalfW };
    });

  it('gives every surface boat a span: its anchor drops and fishing trajineras', () => {
    const fishing = DEEP_CANAL_4_LAYOUT.fishingBoats ?? [];
    expect(fishing.length).toBeGreaterThan(0);
    const surfaceHazards = (DEEP_CANAL_4_LAYOUT.movingHazards ?? []).filter((spawn) => movingHazardBaseY(spawn) === SURF);
    expect(surfaceHazards.length).toBeGreaterThan(0);
    expect(spans.map((s) => s.id)).toEqual([...surfaceHazards.map((hazard) => hazard.id), ...fishing.map((boat) => boat.id)]);
    for (const boat of fishing) {
      const boatSpan = spans.find((s) => s.id === boat.id);
      expect(boatSpan?.x0, boat.id).toBeLessThan(boat.x0);
      expect(boatSpan?.x1, boat.id).toBeGreaterThan(boat.x1);
    }
  });

  it('keeps every two surface boats at least SURFACE_BOAT_GAP apart (ADR 0036)', () => {
    expect(findCrowdedPairs(spans)).toEqual([]);
  });

  it('keeps every moored hull inside its rect and at least SURFACE_BOAT_GAP from every surface boat, never stretched', () => {
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      const slots = mooredHullSlots(rect, spans, hullW);
      for (const slotX of slots) {
        const label = `hull at ${slotX} in ${rect.x0}..${rect.x1}`;
        expect(slotX, label).toBeGreaterThanOrEqual(rect.x0);
        expect(slotX + hullW, label).toBeLessThanOrEqual(rect.x1);
        for (const boat of spans) {
          expect(isClearOf({ x0: slotX, x1: slotX + hullW }, boat), `${label} against ${boat.id} ${boat.x0}..${boat.x1}`).toBe(true);
        }
      }
    }
  });

  it('still sets some whole hulls in Area 11; a row split by an anchor drop may get the shade only', () => {
    const total = rects.reduce((sum, rect) => sum + mooredHullSlots(rect, spans, hullW).length, 0);
    expect(total).toBeGreaterThan(0);
    expect(rects.map((rect) => [rect.x0, rect.x1])).toEqual([
      [2280, 2720],
      [3900, 4180],
      [4360, 4500],
    ]);
    expect(rects.map((rect) => mooredHullSlots(rect, spans, hullW).length)).toEqual([2, 0, 1]);
  });

  it('keeps every fishing trajinera at least SURFACE_BOAT_GAP from every moored row', () => {
    for (const boat of surfaceBoatSpans({ fishingBoats: DEEP_CANAL_4_LAYOUT.fishingBoats })) {
      for (const rect of rects) {
        expect(isClearOf(boat, rect), `${boat.id} ${boat.x0}..${boat.x1} and moored row ${rect.x0}..${rect.x1}`).toBe(true);
      }
    }
  });

  it('keeps each cormorant\'s stretch, widened by its frame, at least SURFACE_BOAT_GAP from every surface boat and moored row', () => {
    expect(stretches).toHaveLength(3);
    for (const stretch of stretches) {
      for (const boat of [...spans, ...rects.map((rect) => ({ id: `moored row ${rect.x0}..${rect.x1}`, x0: rect.x0, x1: rect.x1 }))]) {
        expect(isClearOf(stretch, boat), `${stretch.id} ${stretch.x0}..${stretch.x1} and ${boat.id} ${boat.x0}..${boat.x1}`).toBe(true);
      }
    }
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
