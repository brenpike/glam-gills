import { describe, expect, it } from 'vitest';
import { ALL_TREASURES, CANAL_TREASURES, isDecoration, placementKind, type Decoration } from './catalogue';
import {
  SHIPPED_DECORATIONS,
  SUGGEST_BASE_Y,
  SUGGEST_XS,
  TANK,
  TANK_SWAYING_DECORATIONS,
  TOP_BASE_Y,
  TOP_KEEP_CLEAR,
  TOP_MOTION_MARGIN,
  createTankLayout,
  cssToTank,
  decorationAnchor,
  decorationBandTop,
  decorationById,
  decorationFootprint,
  decorationFootprintFor,
  decorationMotion,
  decorationWidth,
  decorationsOverlap,
  drawOrder,
  isValidPlacement,
  isValidPlacementFor,
  lidTopCss,
  moveDecoration,
  nudge,
  nudgeDecoration,
  ownedDecorations,
  placeDecoration,
  placementXRange,
  placementXRangeFor,
  putAway,
  sanitizeLayout,
  snapPlacement,
  suggestSpot,
  tankBoxCss,
  tankFrame,
  tankFrameAt,
  tankToCss,
  topKeepClearCss,
  type TankLayout,
} from './tank';
import type { Point } from './zone';

const PLANT = 'canal/pond-plant';
const BOAT = 'canal/toy-boat';
const CASTLE = 'canal/castle-tower';
const PYRAMID = 'canal/sun-pyramid';
const HAT = 'canal/sun-hat';
const SHELL = 'canal/paint-shell-mint';
const UNKNOWN = 'canal/not-a-treasure';
const ALL_DECORATIONS = [PLANT, BOAT, CASTLE, PYRAMID];
const POND_LILY = 'pond/lily-pad';
const CATTAIL = 'pond/cattail-clump';
const FROG = 'pond/frog-statue';
const LOTUS = 'pond/lotus-lantern';
const REEDS = 'pond/reed-bundle';
const FEATHER = 'pond/drifting-feather';
const DUCK = 'pond/wooden-duck-decoy';
const STRING_LIGHTS = 'pond/firefly-string-lights';
const JAR = 'pond/firefly-jar';
const THRONE = 'pond/golden-lotus-throne';
const FLOWERPOT = 'chinampa/clay-flowerpot';
const CORN_DOLL = 'chinampa/corn-husk-doll';
const SCARECROW = 'chinampa/scarecrow';
const PAPEL_PICADO = 'chinampa/papel-picado-banner';
const SWING = 'chinampa/willow-swing';
const GOLDEN_CORN = 'chinampa/golden-corn';
const WATERING_CAN = 'chinampa/watering-can';
const GOURD = 'chinampa/floating-gourd';
const PINATA = 'chinampa/pinata';
const FOUNTAIN = 'chinampa/talavera-fountain';
const ALEBRIJE = 'chinampa/alebrije-statue';
const PEBBLE_STACK = 'spring-cave/pebble-stack';
const GLOW_MOSS = 'spring-cave/glow-moss-ball';
const AMMONITE = 'spring-cave/fossil-ammonite';
const WIND_CHIME = 'spring-cave/crystal-wind-chime';
const GEODE_LAMP = 'spring-cave/geode-lamp';
const CRYSTAL_ARCH = 'spring-cave/crystal-arch';
const MOSSY_ROCK = 'spring-cave/mossy-rock';
const BUBBLE_STONE = 'spring-cave/bubble-stone';
const CLAY_POT = 'spring-cave/ancient-clay-pot';
const GLOWING_STALACTITE = 'spring-cave/glowing-stalactite';
const BUBBLE_MACHINE = 'spring-cave/bubble-machine';
const WATERFALL = 'spring-cave/underground-waterfall';
const WIDE_SHIPPED = [STRING_LIGHTS, PAPEL_PICADO];
const SHIPPED_FLOOR = SHIPPED_DECORATIONS.filter((decoration) => placementKind(decoration) === 'floor');
const SHIPPED_FLOATING = SHIPPED_DECORATIONS.filter((decoration) => placementKind(decoration) === 'floating');
const SHIPPED_HANGING = SHIPPED_DECORATIONS.filter((decoration) => placementKind(decoration) === 'hanging');
const BANKED = [HAT, PYRAMID, PLANT, SHELL, BOAT, CASTLE, PLANT];
const MIDDLE: Point = { x: 240, y: 318 };
const X_RANGE = placementXRange();

const LILY = 'test/lily-pad';
const LANTERN = 'test/lantern';
const BANNER = 'test/banner';
const LILY_PAD: Decoration = {
  id: LILY,
  name: 'Lily pad',
  rarity: 'common',
  category: 'decoration',
  placement: 'floating',
};
const PAPER_LANTERN: Decoration = {
  id: LANTERN,
  name: 'Paper lantern',
  rarity: 'rare',
  category: 'decoration',
  placement: 'hanging',
};
const WIDE_BANNER: Decoration = {
  id: BANNER,
  name: 'Banner',
  rarity: 'epic',
  category: 'decoration',
  placement: 'hanging',
  width: 144,
};
const TEST_CATALOGUE: readonly Decoration[] = [...SHIPPED_DECORATIONS, LILY_PAD, PAPER_LANTERN, WIDE_BANNER];
const TEST_BANKED = [...BANKED, BANNER, LANTERN, LILY];
const TOP_MIDDLE: Point = { x: 240, y: TOP_BASE_Y };

/** The shipped Decoration with this id; fails the test when it is missing. */
function shipped(id: string): Decoration {
  const decoration = decorationById(id);
  if (decoration === undefined) throw new Error(`no shipped Decoration ${id}`);
  return decoration;
}

/** A layout with each id placed at its own suggested spot from the test catalogue, in order. */
function testLayoutWith(ids: readonly string[]): TankLayout {
  let layout = createTankLayout();
  for (const id of ids) {
    const change = placeDecoration(layout, TEST_BANKED, id, suggestSpot(layout, id, TEST_CATALOGUE), TEST_CATALOGUE);
    expect(change.result).toBe('placed');
    layout = change.layout;
  }
  return layout;
}

/** A layout with each id placed at its suggested spot, in order. */
function layoutWith(ids: readonly string[]): TankLayout {
  let layout = createTankLayout();
  for (const id of ids) {
    layout = placeDecoration(layout, BANKED, id, suggestSpot(layout)).layout;
  }
  return layout;
}

describe('tank geometry', () => {
  it('keeps the Decoration footprint within 120 x 140 (art guide 7f)', () => {
    const footprint = decorationFootprint(MIDDLE);
    expect(footprint.w).toBeLessThanOrEqual(120);
    expect(footprint.h).toBeLessThanOrEqual(140);
    expect(footprint).toEqual({ x: 200, y: 238, w: TANK.decorationPx, h: TANK.decorationPx });
  });

  it('keeps every valid footprint inside the glass and under the water line', () => {
    for (const pos of [
      { x: X_RANGE.x0, y: TANK.floorBand.y0 },
      { x: X_RANGE.x1, y: TANK.floorBand.y1 },
    ]) {
      const footprint = decorationFootprint(pos);
      expect(footprint.x).toBeGreaterThanOrEqual(TANK.glass.x0 + TANK.wallInset);
      expect(footprint.x + footprint.w).toBeLessThanOrEqual(TANK.glass.x1 - TANK.wallInset);
      expect(footprint.y).toBeGreaterThan(TANK.waterTop);
      expect(footprint.y + footprint.h).toBeLessThan(TANK.glass.y1);
    }
  });

  it('puts the floor band on the gravel', () => {
    expect(TANK.floorBand.y0).toBeGreaterThan(TANK.gravelTop);
    expect(TANK.floorBand.y1).toBeLessThan(TANK.glass.y1);
  });

  it('names the real pond plant as the only swaying Decoration', () => {
    expect(TANK_SWAYING_DECORATIONS).toEqual([PLANT]);
    expect(CANAL_TREASURES.find((treasure) => treasure.id === PLANT)?.category).toBe('decoration');
  });
});

describe('ownedDecorations', () => {
  it('keeps banked Decorations once each, in catalogue order', () => {
    expect(ownedDecorations(BANKED)).toEqual(ALL_DECORATIONS);
  });

  it('drops Wearables, Paint shells and unknown ids', () => {
    expect(ownedDecorations([HAT, SHELL, UNKNOWN])).toEqual([]);
    expect(ownedDecorations([])).toEqual([]);
  });
});

describe('isValidPlacement', () => {
  it('accepts the corners of the placement area', () => {
    for (const x of [X_RANGE.x0, X_RANGE.x1]) {
      for (const y of [TANK.floorBand.y0, TANK.floorBand.y1]) {
        expect(isValidPlacement({ x, y })).toBe(true);
      }
    }
    expect(X_RANGE).toEqual({ x0: 64, x1: 416 });
  });

  it('rejects a point just past every side', () => {
    expect(isValidPlacement({ x: X_RANGE.x0 - 0.5, y: MIDDLE.y })).toBe(false);
    expect(isValidPlacement({ x: X_RANGE.x1 + 0.5, y: MIDDLE.y })).toBe(false);
    expect(isValidPlacement({ x: MIDDLE.x, y: TANK.floorBand.y0 - 0.5 })).toBe(false);
    expect(isValidPlacement({ x: MIDDLE.x, y: TANK.floorBand.y1 + 0.5 })).toBe(false);
  });

  it('rejects points above the gravel and non-finite points', () => {
    expect(isValidPlacement({ x: MIDDLE.x, y: TANK.gravelTop })).toBe(false);
    expect(isValidPlacement({ x: MIDDLE.x, y: 200 })).toBe(false);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(isValidPlacement({ x: bad, y: MIDDLE.y })).toBe(false);
      expect(isValidPlacement({ x: MIDDLE.x, y: bad })).toBe(false);
    }
  });
});

describe('placeDecoration', () => {
  it('places an owned Decoration', () => {
    const layout = createTankLayout();
    const change = placeDecoration(layout, BANKED, PLANT, MIDDLE);
    expect(change.result).toBe('placed');
    expect(change.layout.placed).toEqual([{ id: PLANT, ...MIDDLE }]);
    expect(layout.placed).toEqual([]);
  });

  it('returns the same layout object on every failure', () => {
    const layout = layoutWith([PLANT]);
    const cases: [string, readonly string[], Point, string][] = [
      [HAT, BANKED, MIDDLE, 'notDecoration'],
      [SHELL, BANKED, MIDDLE, 'notDecoration'],
      [UNKNOWN, [UNKNOWN], MIDDLE, 'notDecoration'],
      [BOAT, [PLANT], MIDDLE, 'notOwned'],
      [PLANT, BANKED, MIDDLE, 'alreadyPlaced'],
      [BOAT, BANKED, { x: 10, y: MIDDLE.y }, 'outside'],
      [BOAT, BANKED, { x: Number.NaN, y: MIDDLE.y }, 'outside'],
    ];
    for (const [id, banked, pos, result] of cases) {
      const change = placeDecoration(layout, banked, id, pos);
      expect(change.result).toBe(result);
      expect(change.layout).toBe(layout);
    }
  });

  it('places a Decoration again after it is put away', () => {
    const away = putAway(layoutWith([PLANT]), PLANT).layout;
    const again = placeDecoration(away, BANKED, PLANT, { x: 100, y: 310 });
    expect(again.result).toBe('placed');
    expect(again.layout.placed).toEqual([{ id: PLANT, x: 100, y: 310 }]);
  });
});

describe('moveDecoration', () => {
  it('moves a placed Decoration and keeps the others', () => {
    const layout = layoutWith([PLANT, BOAT]);
    const change = moveDecoration(layout, BOAT, { x: 400, y: 330 });
    expect(change.result).toBe('moved');
    expect(change.layout.placed).toEqual([
      { id: PLANT, x: 240, y: SUGGEST_BASE_Y },
      { id: BOAT, x: 400, y: 330 },
    ]);
  });

  it('returns the same layout object when not placed or outside', () => {
    const layout = layoutWith([PLANT]);
    const notPlaced = moveDecoration(layout, BOAT, MIDDLE);
    expect(notPlaced).toEqual({ layout, result: 'notPlaced' });
    expect(notPlaced.layout).toBe(layout);
    const outside = moveDecoration(layout, PLANT, { x: MIDDLE.x, y: 200 });
    expect(outside.result).toBe('outside');
    expect(outside.layout).toBe(layout);
  });
});

describe('putAway', () => {
  it('takes a placed Decoration out', () => {
    const change = putAway(layoutWith([PLANT, BOAT]), PLANT);
    expect(change.result).toBe('putAway');
    expect(change.layout.placed.map((placement) => placement.id)).toEqual([BOAT]);
  });

  it('returns the same layout object when not placed', () => {
    const layout = layoutWith([PLANT]);
    const change = putAway(layout, BOAT);
    expect(change.result).toBe('notPlaced');
    expect(change.layout).toBe(layout);
  });
});

describe('suggestSpot', () => {
  it('tries the middle first, then the next free spot', () => {
    expect(suggestSpot(createTankLayout())).toEqual(MIDDLE);
    expect(suggestSpot(layoutWith([PLANT]))).toEqual({ x: 144, y: SUGGEST_BASE_Y });
    expect(suggestSpot(layoutWith([PLANT, BOAT]))).toEqual({ x: 336, y: SUGGEST_BASE_Y });
  });

  it('is always valid, even when every spot overlaps', () => {
    const crowded: TankLayout = {
      placed: SUGGEST_XS.map((x, i) => ({ id: `test/${i}`, x, y: SUGGEST_BASE_Y })),
    };
    expect(isValidPlacement(suggestSpot(crowded))).toBe(true);
    for (let count = 0; count <= ALL_DECORATIONS.length; count++) {
      expect(isValidPlacement(suggestSpot(layoutWith(ALL_DECORATIONS.slice(0, count))))).toBe(true);
    }
    for (const x of SUGGEST_XS) expect(isValidPlacement({ x, y: SUGGEST_BASE_Y })).toBe(true);
  });

  it('cycles the spots by placed count when none is free', () => {
    const crowded: TankLayout = {
      placed: SUGGEST_XS.map((x, i) => ({ id: `test/${i}`, x, y: SUGGEST_BASE_Y })),
    };
    expect(suggestSpot(crowded)).toEqual({ x: SUGGEST_XS[0], y: SUGGEST_BASE_Y });
    const eight: TankLayout = { placed: [...crowded.placed, { id: 'test/x', x: 100, y: 310 }] };
    expect(suggestSpot(eight)).toEqual({ x: SUGGEST_XS[1], y: SUGGEST_BASE_Y });
  });
});

describe('nudge', () => {
  it('moves by one step in each direction', () => {
    expect(nudge(MIDDLE, 'left')).toEqual({ x: 224, y: 318 });
    expect(nudge(MIDDLE, 'right')).toEqual({ x: 256, y: 318 });
    expect(nudge(MIDDLE, 'up')).toEqual({ x: 240, y: 310 });
    expect(nudge(MIDDLE, 'down')).toEqual({ x: 240, y: 326 });
  });

  it('can leave the placement area, which then reads as outside', () => {
    expect(isValidPlacement(nudge({ x: X_RANGE.x0, y: MIDDLE.y }, 'left'))).toBe(false);
    expect(isValidPlacement(nudge({ x: MIDDLE.x, y: TANK.floorBand.y1 }, 'down'))).toBe(false);
  });
});

describe('drawOrder', () => {
  it('sorts by base y, then catalogue order', () => {
    const layout: TankLayout = {
      placed: [
        { id: CASTLE, x: 100, y: 330 },
        { id: PYRAMID, x: 200, y: 310 },
        { id: BOAT, x: 300, y: 310 },
        { id: PLANT, x: 400, y: 320 },
      ],
    };
    expect(drawOrder(layout).map((placement) => placement.id)).toEqual([BOAT, PYRAMID, PLANT, CASTLE]);
    expect(layout.placed[0].id).toBe(CASTLE);
  });
});

describe('sanitizeLayout', () => {
  it('drops unowned, unknown, non-Decoration, duplicate and invalid placements', () => {
    const layout: TankLayout = {
      placed: [
        { id: PLANT, x: 240, y: 318 },
        { id: PLANT, x: 100, y: 318 },
        { id: BOAT, x: 300, y: 318 },
        { id: UNKNOWN, x: 200, y: 318 },
        { id: HAT, x: 200, y: 318 },
        { id: CASTLE, x: 10, y: 318 },
        { id: PYRAMID, x: Number.NaN, y: 318 },
      ],
    };
    const banked = [PLANT, CASTLE, PYRAMID, HAT, UNKNOWN];
    expect(sanitizeLayout(layout, banked)).toEqual({ placed: [{ id: PLANT, x: 240, y: 318 }] });
  });

  it('keeps a clean layout as it is', () => {
    const layout = layoutWith(ALL_DECORATIONS);
    expect(sanitizeLayout(layout, BANKED)).toEqual(layout);
  });
});

describe('tankFrame', () => {
  it('contain-fits, centres across and bottom-aligns', () => {
    expect(tankFrame(480, 360)).toEqual({ scale: 1, x: 0, y: 0, w: 480, h: 360 });
    expect(tankFrame(960, 360)).toEqual({ scale: 1, x: 240, y: 0, w: 480, h: 360 });
  });

  it('puts the tank on the canvas bottom in portrait', () => {
    const frame = tankFrame(320, 440);
    expect(frame.scale).toBeCloseTo(320 / 480);
    expect(frame.x).toBeCloseTo(0);
    expect(frame.y).toBeCloseTo(440 - 360 * frame.scale);
    expect(frame.y + frame.h).toBeCloseTo(440);
  });

  it('treats degenerate sizes as 1 px', () => {
    const frame = tankFrame(0, Number.NaN);
    expect(Number.isFinite(frame.scale) && frame.scale > 0).toBe(true);
  });

  it('round-trips points between tank units and CSS px', () => {
    for (const [cssW, cssH] of [
      [480, 360],
      [460, 320],
      [320, 440],
      [1366, 768],
    ]) {
      const frame = tankFrame(cssW, cssH);
      for (const pos of [MIDDLE, { x: 0, y: 0 }, { x: 480, y: 360 }, { x: 17.5, y: 333.25 }]) {
        const back = cssToTank(frame, tankToCss(frame, pos));
        expect(back.x).toBeCloseTo(pos.x, 9);
        expect(back.y).toBeCloseTo(pos.y, 9);
      }
    }
  });

  it('puts the decoration band top at the floor top less one footprint', () => {
    const frame = tankFrame(320, 440);
    const top = tankToCss(frame, { x: 0, y: TANK.floorBand.y0 - TANK.decorationPx }).y;
    expect(decorationBandTop(frame)).toBeCloseTo(top);
    expect(decorationBandTop(tankFrame(480, 360))).toBe(224);
  });
});

describe('placement kinds geometry (issue #95)', () => {
  it('ships every area Decoration, in catalogue order, at the standard width but the wide string lights and banner', () => {
    expect(SHIPPED_DECORATIONS).toEqual(ALL_TREASURES.filter(isDecoration));
    expect(Object.isFrozen(SHIPPED_DECORATIONS)).toBe(true);
    expect(SHIPPED_DECORATIONS.map((decoration) => [decoration.id, placementKind(decoration)])).toEqual([
      [PLANT, 'floor'],
      [BOAT, 'floor'],
      [CASTLE, 'floor'],
      [PYRAMID, 'floor'],
      [POND_LILY, 'floating'],
      [CATTAIL, 'floor'],
      [FROG, 'floor'],
      [LOTUS, 'floating'],
      [REEDS, 'floor'],
      [FEATHER, 'floating'],
      [DUCK, 'floating'],
      [STRING_LIGHTS, 'hanging'],
      [JAR, 'hanging'],
      [THRONE, 'floor'],
      [FLOWERPOT, 'floor'],
      [CORN_DOLL, 'floor'],
      [SCARECROW, 'floor'],
      [PAPEL_PICADO, 'hanging'],
      [SWING, 'hanging'],
      [GOLDEN_CORN, 'floor'],
      [WATERING_CAN, 'floor'],
      [GOURD, 'floating'],
      [PINATA, 'hanging'],
      [FOUNTAIN, 'floor'],
      [ALEBRIJE, 'floor'],
      [PEBBLE_STACK, 'floor'],
      [GLOW_MOSS, 'floating'],
      [AMMONITE, 'floor'],
      [WIND_CHIME, 'hanging'],
      [GEODE_LAMP, 'floor'],
      [CRYSTAL_ARCH, 'floor'],
      [MOSSY_ROCK, 'floor'],
      [BUBBLE_STONE, 'floor'],
      [CLAY_POT, 'floor'],
      [GLOWING_STALACTITE, 'hanging'],
      [BUBBLE_MACHINE, 'floor'],
      [WATERFALL, 'floor'],
    ]);
    for (const decoration of SHIPPED_DECORATIONS) {
      expect(decorationWidth(decoration), decoration.id).toBe(
        WIDE_SHIPPED.includes(decoration.id) ? 144 : TANK.decorationPx,
      );
    }
    expect(decorationById(LILY)).toBeUndefined();
    expect(decorationById(LILY, TEST_CATALOGUE)).toBe(LILY_PAD);
    expect(decorationById(HAT)).toBeUndefined();
  });

  it('puts the top band under the lid, hanging from the glass top, with the waterline inside it', () => {
    expect(TANK.lidTop).toBe(16);
    expect(TANK.topBand).toEqual({ y0: 24, y1: 104 });
    expect(TOP_BASE_Y).toBe(104);
    const footprint = decorationFootprintFor(PAPER_LANTERN, TOP_MIDDLE);
    expect(footprint.y).toBe(TANK.glass.y0);
    expect(footprint.y + footprint.h).toBe(TOP_BASE_Y);
    expect(TANK.lidTop).toBeLessThan(TANK.topBand.y0);
    expect(TANK.waterTop).toBeGreaterThan(TANK.topBand.y0);
    expect(TANK.waterTop).toBeLessThan(TANK.topBand.y1);
    expect(TANK.topBand.y1).toBeLessThan(TANK.floorBand.y0 - TANK.decorationPx);
  });

  it('keeps clear the top band grown by the motion margin', () => {
    expect(TOP_MOTION_MARGIN).toBe(4);
    expect(TOP_KEEP_CLEAR).toEqual({ y0: 20, y1: 108 });
  });

  it('gives each width its own x range', () => {
    expect(placementXRangeFor(PAPER_LANTERN)).toEqual(X_RANGE);
    expect(placementXRangeFor(LILY_PAD)).toEqual({ x0: 64, x1: 416 });
    expect(placementXRangeFor(WIDE_BANNER)).toEqual({ x0: 96, x1: 384 });
    expect(decorationWidth(WIDE_BANNER)).toBe(144);
    expect(placementXRangeFor(shipped(STRING_LIGHTS))).toEqual({ x0: 96, x1: 384 });
    expect(placementXRangeFor(shipped(JAR))).toEqual(X_RANGE);
    expect(placementXRangeFor(shipped(PAPEL_PICADO))).toEqual({ x0: 96, x1: 384 });
    expect(placementXRangeFor(shipped(SWING))).toEqual(X_RANGE);
  });

  it('sizes the footprint by the item width, 80 high', () => {
    expect(decorationFootprintFor(WIDE_BANNER, TOP_MIDDLE)).toEqual({ x: 168, y: 24, w: 144, h: 80 });
    expect(decorationFootprintFor(shipped(PLANT), MIDDLE)).toEqual(decorationFootprint(MIDDLE));
    const range = placementXRangeFor(WIDE_BANNER);
    for (const x of [range.x0, range.x1]) {
      const footprint = decorationFootprintFor(WIDE_BANNER, { x, y: TOP_BASE_Y });
      expect(footprint.x).toBeGreaterThanOrEqual(TANK.glass.x0 + TANK.wallInset);
      expect(footprint.x + footprint.w).toBeLessThanOrEqual(TANK.glass.x1 - TANK.wallInset);
    }
  });
});

describe('isValidPlacementFor', () => {
  it('matches isValidPlacement for every shipped Floor Decoration', () => {
    const points: Point[] = [MIDDLE, { x: 10, y: 318 }, { x: 240, y: 200 }, TOP_MIDDLE, { x: 64, y: 304 }];
    expect(SHIPPED_FLOOR.map((decoration) => decoration.id)).toEqual([
      PLANT,
      BOAT,
      CASTLE,
      PYRAMID,
      CATTAIL,
      FROG,
      REEDS,
      THRONE,
      FLOWERPOT,
      CORN_DOLL,
      SCARECROW,
      GOLDEN_CORN,
      WATERING_CAN,
      FOUNTAIN,
      ALEBRIJE,
      PEBBLE_STACK,
      AMMONITE,
      GEODE_LAMP,
      CRYSTAL_ARCH,
      MOSSY_ROCK,
      BUBBLE_STONE,
      CLAY_POT,
      BUBBLE_MACHINE,
      WATERFALL,
    ]);
    for (const decoration of SHIPPED_FLOOR) {
      for (const pos of points) expect(isValidPlacementFor(decoration, pos)).toBe(isValidPlacement(pos));
    }
  });

  it('accepts Floating and Hanging only at the fixed base y within the x range', () => {
    expect(SHIPPED_FLOATING.map((decoration) => decoration.id)).toEqual([POND_LILY, LOTUS, FEATHER, DUCK, GOURD, GLOW_MOSS]);
    expect(SHIPPED_HANGING.map((decoration) => decoration.id)).toEqual([STRING_LIGHTS, JAR, PAPEL_PICADO, SWING, PINATA, WIND_CHIME, GLOWING_STALACTITE]);
    for (const decoration of [...SHIPPED_FLOATING, ...SHIPPED_HANGING, LILY_PAD, PAPER_LANTERN, WIDE_BANNER]) {
      const range = placementXRangeFor(decoration);
      expect(isValidPlacementFor(decoration, { x: range.x0, y: TOP_BASE_Y })).toBe(true);
      expect(isValidPlacementFor(decoration, { x: range.x1, y: TOP_BASE_Y })).toBe(true);
      expect(isValidPlacementFor(decoration, { x: range.x0 - 0.5, y: TOP_BASE_Y })).toBe(false);
      expect(isValidPlacementFor(decoration, { x: range.x1 + 0.5, y: TOP_BASE_Y })).toBe(false);
      for (const y of [TOP_BASE_Y - 0.5, TOP_BASE_Y + 0.5, SUGGEST_BASE_Y, TANK.waterTop]) {
        expect(isValidPlacementFor(decoration, { x: 240, y })).toBe(false);
      }
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(isValidPlacementFor(decoration, { x: bad, y: TOP_BASE_Y })).toBe(false);
        expect(isValidPlacementFor(decoration, { x: 240, y: bad })).toBe(false);
      }
    }
  });

  it('keeps a wide item between x 96 and 384', () => {
    for (const wide of [WIDE_BANNER, ...WIDE_SHIPPED.map(shipped)]) {
      expect(isValidPlacementFor(wide, { x: 96, y: TOP_BASE_Y })).toBe(true);
      expect(isValidPlacementFor(wide, { x: 384, y: TOP_BASE_Y })).toBe(true);
      expect(isValidPlacementFor(wide, { x: 80, y: TOP_BASE_Y })).toBe(false);
      expect(isValidPlacementFor(wide, { x: 400, y: TOP_BASE_Y })).toBe(false);
    }
  });
});

describe('decorationsOverlap', () => {
  it('uses both widths; touching edges do not overlap', () => {
    const at = (x: number): Point => ({ x, y: TOP_BASE_Y });
    expect(decorationsOverlap(LILY_PAD, at(240), PAPER_LANTERN, at(320))).toBe(false);
    expect(decorationsOverlap(LILY_PAD, at(240), PAPER_LANTERN, at(319.5))).toBe(true);
    expect(decorationsOverlap(WIDE_BANNER, at(240), PAPER_LANTERN, at(352))).toBe(false);
    expect(decorationsOverlap(WIDE_BANNER, at(240), PAPER_LANTERN, at(351.5))).toBe(true);
    expect(decorationsOverlap(PAPER_LANTERN, at(128), WIDE_BANNER, at(240))).toBe(false);
    expect(decorationsOverlap(WIDE_BANNER, at(96), WIDE_BANNER, at(240))).toBe(false);
    expect(decorationsOverlap(WIDE_BANNER, at(97), WIDE_BANNER, at(240))).toBe(true);
  });

  it('never overlaps a top item with a Floor item', () => {
    expect(decorationsOverlap(WIDE_BANNER, TOP_MIDDLE, shipped(CASTLE), { x: 240, y: TANK.floorBand.y0 })).toBe(false);
    expect(decorationsOverlap(shipped(STRING_LIGHTS), TOP_MIDDLE, shipped(THRONE), { x: 240, y: TANK.floorBand.y0 })).toBe(
      false,
    );
  });

  it('uses the full width of the shipped Firefly string lights against the other top items', () => {
    const at = (x: number): Point => ({ x, y: TOP_BASE_Y });
    const lights = shipped(STRING_LIGHTS);
    expect(decorationsOverlap(lights, at(240), shipped(JAR), at(352))).toBe(false);
    expect(decorationsOverlap(lights, at(240), shipped(JAR), at(351.5))).toBe(true);
    expect(decorationsOverlap(shipped(FEATHER), at(128), lights, at(240))).toBe(false);
    expect(decorationsOverlap(shipped(DUCK), at(128.5), lights, at(240))).toBe(true);
  });

  it('uses the full width of the shipped Papel picado banner against the other top items', () => {
    const at = (x: number): Point => ({ x, y: TOP_BASE_Y });
    const banner = shipped(PAPEL_PICADO);
    expect(decorationsOverlap(banner, at(240), shipped(SWING), at(352))).toBe(false);
    expect(decorationsOverlap(banner, at(240), shipped(SWING), at(351.5))).toBe(true);
    expect(decorationsOverlap(banner, at(96), shipped(STRING_LIGHTS), at(240))).toBe(false);
    expect(decorationsOverlap(banner, at(97), shipped(STRING_LIGHTS), at(240))).toBe(true);
    expect(decorationsOverlap(banner, TOP_MIDDLE, shipped(SCARECROW), { x: 240, y: TANK.floorBand.y0 })).toBe(false);
  });
});

describe('snapPlacement', () => {
  it('pins y and clamps x for Floating and Hanging', () => {
    expect(snapPlacement(LILY_PAD, { x: 300, y: 250 })).toEqual({ x: 300, y: TOP_BASE_Y });
    expect(snapPlacement(LILY_PAD, { x: 500, y: 0 })).toEqual({ x: 416, y: TOP_BASE_Y });
    expect(snapPlacement(WIDE_BANNER, { x: 20, y: 330 })).toEqual({ x: 96, y: TOP_BASE_Y });
    expect(snapPlacement(WIDE_BANNER, { x: 460, y: 40 })).toEqual({ x: 384, y: TOP_BASE_Y });
    expect(isValidPlacementFor(PAPER_LANTERN, snapPlacement(PAPER_LANTERN, { x: 123.5, y: 7 }))).toBe(true);
  });

  it('leaves Floor drags as they are', () => {
    expect(snapPlacement(shipped(BOAT), { x: 10, y: 200 })).toEqual({ x: 10, y: 200 });
    expect(snapPlacement(shipped(BOAT), MIDDLE)).toEqual(MIDDLE);
  });
});

describe('nudgeDecoration', () => {
  it('nudges Floor items in every direction like nudge', () => {
    for (const direction of ['left', 'right', 'up', 'down'] as const) {
      expect(nudgeDecoration(shipped(PLANT), MIDDLE, direction)).toEqual(nudge(MIDDLE, direction));
    }
  });

  it('moves Floating and Hanging left and right only; up and down give null', () => {
    for (const decoration of [LILY_PAD, PAPER_LANTERN, WIDE_BANNER]) {
      expect(nudgeDecoration(decoration, TOP_MIDDLE, 'left')).toEqual({ x: 224, y: TOP_BASE_Y });
      expect(nudgeDecoration(decoration, TOP_MIDDLE, 'right')).toEqual({ x: 256, y: TOP_BASE_Y });
      expect(nudgeDecoration(decoration, TOP_MIDDLE, 'up')).toBeNull();
      expect(nudgeDecoration(decoration, TOP_MIDDLE, 'down')).toBeNull();
    }
  });

  it('can step a wide item past its x range, which then reads as outside', () => {
    const edge = { x: 384, y: TOP_BASE_Y };
    const past = nudgeDecoration(WIDE_BANNER, edge, 'right');
    expect(past).toEqual({ x: 400, y: TOP_BASE_Y });
    expect(past !== null && isValidPlacementFor(WIDE_BANNER, past)).toBe(false);
  });
});

describe('decorationAnchor', () => {
  it('anchors Floor and Floating at the base point and Hanging at the hook on the glass top', () => {
    expect(decorationAnchor(shipped(PLANT), MIDDLE)).toEqual(MIDDLE);
    expect(decorationAnchor(LILY_PAD, TOP_MIDDLE)).toEqual(TOP_MIDDLE);
    expect(decorationAnchor(PAPER_LANTERN, TOP_MIDDLE)).toEqual({ x: 240, y: TANK.glass.y0 });
    expect(decorationAnchor(WIDE_BANNER, { x: 100, y: TOP_BASE_Y })).toEqual({ x: 100, y: 24 });
  });
});

describe('decorationMotion', () => {
  const TIMES = [0, 0.25, 0.75, 1, 1.25, 2.5, 3.7, 10];

  it('is 0 for every kind when still', () => {
    for (const decoration of [...SHIPPED_DECORATIONS, LILY_PAD, PAPER_LANTERN, WIDE_BANNER]) {
      for (const timeS of TIMES) expect(decorationMotion(decoration, timeS, true)).toEqual({ dy: 0, angle: 0 });
    }
  });

  it('sways the pond plant 0.05 rad over 4 s and holds other Floor items', () => {
    expect(decorationMotion(shipped(PLANT), 1, false).angle).toBeCloseTo(0.05);
    expect(decorationMotion(shipped(PLANT), 3, false).angle).toBeCloseTo(-0.05);
    expect(decorationMotion(shipped(PLANT), 1, false).dy).toBe(0);
    for (const id of [BOAT, CASTLE, PYRAMID]) {
      for (const timeS of TIMES) expect(decorationMotion(shipped(id), timeS, false)).toEqual({ dy: 0, angle: 0 });
    }
  });

  it('bobs Floating 3 units over 3 s and sways Hanging 0.04 rad over 5 s', () => {
    expect(decorationMotion(LILY_PAD, 0.75, false).dy).toBeCloseTo(3);
    expect(decorationMotion(LILY_PAD, 2.25, false).dy).toBeCloseTo(-3);
    expect(decorationMotion(LILY_PAD, 0.75, false).angle).toBe(0);
    expect(decorationMotion(PAPER_LANTERN, 1.25, false).angle).toBeCloseTo(0.04);
    expect(decorationMotion(WIDE_BANNER, 3.75, false).angle).toBeCloseTo(-0.04);
    expect(decorationMotion(PAPER_LANTERN, 1.25, false).dy).toBe(0);
  });

  it('keeps the moving top items inside the keep-clear band', () => {
    const halfWidth = decorationWidth(WIDE_BANNER) / 2;
    for (let step = 0; step <= 100; step++) {
      const timeS = step / 10;
      const bob = decorationMotion(LILY_PAD, timeS, false).dy;
      expect(TANK.topBand.y0 + bob).toBeGreaterThanOrEqual(TOP_KEEP_CLEAR.y0);
      expect(TANK.topBand.y1 + bob).toBeLessThanOrEqual(TOP_KEEP_CLEAR.y1);
      const swing = Math.abs(decorationMotion(WIDE_BANNER, timeS, false).angle);
      const lift = halfWidth * Math.sin(swing);
      expect(TANK.topBand.y0 - lift).toBeGreaterThanOrEqual(TOP_KEEP_CLEAR.y0);
      expect(TANK.topBand.y1 + lift).toBeLessThanOrEqual(TOP_KEEP_CLEAR.y1);
    }
  });
});

describe('tank changes with an injected catalogue', () => {
  it('owns injected Decorations only with that catalogue', () => {
    expect(ownedDecorations(TEST_BANKED, TEST_CATALOGUE)).toEqual([...ALL_DECORATIONS, LILY, LANTERN, BANNER]);
    expect(ownedDecorations(TEST_BANKED)).toEqual(ALL_DECORATIONS);
  });

  it('places Floating and Hanging items only at the fixed base y', () => {
    const empty = createTankLayout();
    const placed = placeDecoration(empty, TEST_BANKED, LILY, TOP_MIDDLE, TEST_CATALOGUE);
    expect(placed.result).toBe('placed');
    expect(placed.layout.placed).toEqual([{ id: LILY, ...TOP_MIDDLE }]);
    expect(placeDecoration(empty, TEST_BANKED, LILY, MIDDLE, TEST_CATALOGUE).result).toBe('outside');
    expect(placeDecoration(empty, TEST_BANKED, BANNER, { x: 90, y: TOP_BASE_Y }, TEST_CATALOGUE).result).toBe(
      'outside',
    );
    expect(placeDecoration(empty, TEST_BANKED, BANNER, { x: 96, y: TOP_BASE_Y }, TEST_CATALOGUE).result).toBe(
      'placed',
    );
    expect(placeDecoration(empty, TEST_BANKED, LILY, TOP_MIDDLE).result).toBe('notDecoration');
    expect(placeDecoration(empty, BANKED, LILY, TOP_MIDDLE, TEST_CATALOGUE).result).toBe('notOwned');
  });

  it('moves a top item along the top only', () => {
    const layout = testLayoutWith([LANTERN]);
    const moved = moveDecoration(layout, LANTERN, { x: 300, y: TOP_BASE_Y }, TEST_CATALOGUE);
    expect(moved.result).toBe('moved');
    expect(moved.layout.placed).toEqual([{ id: LANTERN, x: 300, y: TOP_BASE_Y }]);
    const down = moveDecoration(layout, LANTERN, { x: 300, y: TOP_BASE_Y + TANK.moveStep.y }, TEST_CATALOGUE);
    expect(down.result).toBe('outside');
    expect(down.layout).toBe(layout);
  });

  it('suggests top spots in the same x order, past items already there', () => {
    expect(suggestSpot(createTankLayout(), LILY, TEST_CATALOGUE)).toEqual(TOP_MIDDLE);
    expect(suggestSpot(testLayoutWith([LILY]), LANTERN, TEST_CATALOGUE)).toEqual({ x: 144, y: TOP_BASE_Y });
    expect(suggestSpot(testLayoutWith([LILY, LANTERN]), BANNER, TEST_CATALOGUE)).toEqual({ x: 384, y: TOP_BASE_Y });
    expect(suggestSpot(testLayoutWith([LILY]), BANNER, TEST_CATALOGUE)).toEqual({ x: 96, y: TOP_BASE_Y });
  });

  it('suggests shipped top spots past the wide Firefly string lights', () => {
    const lightsAtMiddle: TankLayout = { placed: [{ id: STRING_LIGHTS, ...TOP_MIDDLE }] };
    const jarAtMiddle: TankLayout = { placed: [{ id: JAR, ...TOP_MIDDLE }] };
    expect(suggestSpot(createTankLayout(), STRING_LIGHTS)).toEqual(TOP_MIDDLE);
    expect(suggestSpot(lightsAtMiddle, JAR)).toEqual({ x: 96, y: TOP_BASE_Y });
    expect(suggestSpot(lightsAtMiddle, FEATHER)).toEqual({ x: 96, y: TOP_BASE_Y });
    expect(suggestSpot(jarAtMiddle, STRING_LIGHTS)).toEqual({ x: 96, y: TOP_BASE_Y });
    expect(suggestSpot(lightsAtMiddle, REEDS)).toEqual(MIDDLE);
    for (const id of [JAR, FEATHER, DUCK]) {
      expect(isValidPlacementFor(shipped(id), suggestSpot(lightsAtMiddle, id))).toBe(true);
    }
  });

  it('suggests shipped top spots past the wide Papel picado banner', () => {
    const bannerAtMiddle: TankLayout = { placed: [{ id: PAPEL_PICADO, ...TOP_MIDDLE }] };
    expect(suggestSpot(createTankLayout(), PAPEL_PICADO)).toEqual(TOP_MIDDLE);
    expect(suggestSpot(bannerAtMiddle, SWING)).toEqual({ x: 96, y: TOP_BASE_Y });
    expect(suggestSpot(bannerAtMiddle, SCARECROW)).toEqual(MIDDLE);
    for (const id of [SWING, STRING_LIGHTS, JAR]) {
      expect(isValidPlacementFor(shipped(id), suggestSpot(bannerAtMiddle, id))).toBe(true);
    }
  });

  it('keeps Floor and top suggestions apart', () => {
    const floorOnly = testLayoutWith([PLANT, BOAT]);
    expect(suggestSpot(floorOnly, LILY, TEST_CATALOGUE)).toEqual(TOP_MIDDLE);
    const topOnly = testLayoutWith([LILY, BANNER]);
    expect(suggestSpot(topOnly, PLANT, TEST_CATALOGUE)).toEqual(MIDDLE);
    expect(suggestSpot(topOnly)).toEqual(MIDDLE);
    expect(suggestSpot(createTankLayout(), LILY)).toEqual(MIDDLE);
  });

  it('suggests a valid top spot even when every spot overlaps', () => {
    const crowded: TankLayout = {
      placed: SUGGEST_XS.map((x, i) => ({ id: `test/${i}`, x, y: TOP_BASE_Y })),
    };
    for (const id of [LILY, LANTERN, BANNER]) {
      const decoration = decorationById(id, TEST_CATALOGUE);
      const spot = suggestSpot(crowded, id, TEST_CATALOGUE);
      expect(decoration !== undefined && isValidPlacementFor(decoration, spot)).toBe(true);
    }
    expect(suggestSpot(crowded, LILY, TEST_CATALOGUE)).toEqual({ x: SUGGEST_XS[0], y: TOP_BASE_Y });
  });

  it('clamps suggested x into a very wide item range', () => {
    const huge: Decoration = { ...WIDE_BANNER, id: 'test/huge', width: 400 };
    const catalogue = [...TEST_CATALOGUE, huge];
    expect(placementXRangeFor(huge)).toEqual({ x0: 224, x1: 256 });
    const layout: TankLayout = { placed: [{ id: LANTERN, x: 240, y: TOP_BASE_Y }] };
    const spot = suggestSpot(layout, huge.id, catalogue);
    expect(isValidPlacementFor(huge, spot)).toBe(true);
  });

  it('draws top items first and orders ties by the injected catalogue', () => {
    const layout: TankLayout = {
      placed: [
        { id: PLANT, x: 100, y: 310 },
        { id: BANNER, x: 300, y: TOP_BASE_Y },
        { id: LILY, x: 100, y: TOP_BASE_Y },
      ],
    };
    expect(drawOrder(layout, TEST_CATALOGUE).map((placement) => placement.id)).toEqual([LILY, BANNER, PLANT]);
    expect(drawOrder(layout).map((placement) => placement.id)).toEqual([BANNER, LILY, PLANT]);
  });

  it('keeps owned injected placements with the injected catalogue and drops them with the default', () => {
    const layout: TankLayout = {
      placed: [
        { id: PLANT, x: 240, y: 318 },
        { id: LILY, x: 240, y: TOP_BASE_Y },
        { id: BANNER, x: 330, y: TOP_BASE_Y },
        { id: LANTERN, x: 144, y: 318 },
        { id: LILY, x: 100, y: TOP_BASE_Y },
      ],
    };
    expect(sanitizeLayout(layout, TEST_BANKED, TEST_CATALOGUE)).toEqual({
      placed: [
        { id: PLANT, x: 240, y: 318 },
        { id: LILY, x: 240, y: TOP_BASE_Y },
        { id: BANNER, x: 330, y: TOP_BASE_Y },
      ],
    });
    expect(sanitizeLayout(layout, TEST_BANKED)).toEqual({ placed: [{ id: PLANT, x: 240, y: 318 }] });
    expect(sanitizeLayout(layout, BANKED, TEST_CATALOGUE)).toEqual({ placed: [{ id: PLANT, x: 240, y: 318 }] });
  });

  it('restores Floating and Hanging placements exactly through a JSON round trip', () => {
    const layout: TankLayout = {
      placed: [
        { id: PLANT, x: 240, y: 318 },
        { id: LILY, x: 112, y: TOP_BASE_Y },
        { id: LANTERN, x: 416, y: TOP_BASE_Y },
        { id: BANNER, x: 260.5, y: TOP_BASE_Y },
      ],
    };
    const restored = JSON.parse(JSON.stringify(layout)) as TankLayout;
    expect(sanitizeLayout(restored, TEST_BANKED, TEST_CATALOGUE)).toEqual(layout);
  });
});

describe('top band CSS helpers', () => {
  it('gives the lid top and keep-clear band in CSS px', () => {
    expect(lidTopCss(tankFrame(480, 360))).toBe(16);
    expect(topKeepClearCss(tankFrame(480, 360))).toEqual({ y0: 20, y1: 108 });
    const frame = tankFrame(320, 440);
    expect(lidTopCss(frame)).toBeCloseTo(tankToCss(frame, { x: 0, y: TANK.lidTop }).y);
    const band = topKeepClearCss(frame);
    expect(band.y0).toBeCloseTo(tankToCss(frame, { x: 0, y: TOP_KEEP_CLEAR.y0 }).y);
    expect(band.y1).toBeCloseTo(tankToCss(frame, { x: 0, y: TOP_KEEP_CLEAR.y1 }).y);
    expect(band.y1).toBeLessThan(decorationBandTop(frame));
  });
});

describe('tankFrameAt', () => {
  it('equals tankFrame at its own scale', () => {
    for (const [cssW, cssH] of [
      [480, 360],
      [460, 320],
      [320, 440],
      [1024, 768],
      [1366, 768],
      [390, 844],
      [0, Number.NaN],
    ]) {
      const frame = tankFrame(cssW, cssH);
      expect(tankFrameAt(cssW, cssH, frame.scale)).toEqual(frame);
    }
  });

  it('places the tank at a smaller scale, centred across and bottom-aligned', () => {
    expect(tankFrameAt(1024, 768, 2)).toEqual({ scale: 2, x: 32, y: 48, w: 960, h: 720 });
    const frame = tankFrameAt(460, 320, 0.5);
    expect(frame.scale).toBe(0.5);
    expect(frame.x).toBeCloseTo((460 - 240) / 2);
    expect(frame.y + frame.h).toBeCloseTo(320);
  });

  it('caps the scale at the contain-fit one', () => {
    expect(tankFrameAt(1024, 768, 5)).toEqual(tankFrame(1024, 768));
    expect(tankFrameAt(1024, 768, Number.POSITIVE_INFINITY)).toEqual(tankFrame(1024, 768));
  });

  it('uses the contain-fit scale for a scale that is not positive', () => {
    for (const scale of [0, -1, Number.NaN]) {
      expect(tankFrameAt(1280, 720, scale)).toEqual(tankFrame(1280, 720));
    }
  });
});

describe('tankBoxCss', () => {
  it('gives the glass and the lid in CSS px', () => {
    expect(tankBoxCss(tankFrame(480, 360))).toEqual({ x: 16, y: 16, w: 448, h: 324 });
    expect(tankBoxCss(tankFrame(960, 720))).toEqual({ x: 32, y: 32, w: 896, h: 648 });
  });

  it('runs from the glass sides and the lid top to the glass bottom through the frame', () => {
    for (const frame of [tankFrame(320, 440), tankFrame(1366, 768), tankFrameAt(1024, 768, 2)]) {
      const box = tankBoxCss(frame);
      const topLeft = tankToCss(frame, { x: TANK.glass.x0, y: TANK.lidTop });
      const bottomRight = tankToCss(frame, { x: TANK.glass.x1, y: TANK.glass.y1 });
      expect(box.x).toBeCloseTo(topLeft.x, 9);
      expect(box.y).toBeCloseTo(topLeft.y, 9);
      expect(box.x + box.w).toBeCloseTo(bottomRight.x, 9);
      expect(box.y + box.h).toBeCloseTo(bottomRight.y, 9);
      expect(box.y).toBeCloseTo(lidTopCss(frame), 9);
    }
  });
});
