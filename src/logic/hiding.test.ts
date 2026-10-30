import { describe, expect, it } from 'vitest';
import { RARITIES } from './catalogue';
import { CHINAMPA_LAYOUT } from './chinampaLayout';
import type { FactCard } from './factCards';
import { GHOST_NET, netDrift } from './ghostNets';
import type { HazardSpawn, HazardType } from './hazards';
import {
  MAIN_PATH_REACH,
  PAD_COVER_DEPTH,
  PAST_CURRENT_DEPTH,
  RISK_COMMON_MARGIN,
  coversAt,
  distanceToPath,
  inCave,
  inReeds,
  inSightCover,
  isDeep,
  meetsRarity,
  meetsRiskRule,
  meetsThreatRiskRule,
  pastCurrent,
  pastCurrentBand,
  riskBands,
  riskDistance,
  routeDistance,
  spotMatchesLabels,
  turnDistance,
  underBank,
  underPad,
  withinLungeRange,
  zoneThreats,
  type HidingGeometry,
  type PastCurrentBand,
  type Threat,
} from './hiding';
import { PUNTING_POLE, movingHazardSpawn, movingHazardSweep } from './movingHazards';
import { POND_2_LAYOUT } from './pond2Layout';
import { POND_LAYOUT } from './pondLayout';
import {
  HERON_SPECIES,
  TILAPIA_SPECIES,
  createPredator,
  routeLoopDistance,
  stepPredator,
  type PredatorContext,
  type PredatorRoute,
  type PredatorSpecies,
} from './predators';
import { HERON, RISK, TILAPIA, TILAPIA_CHASE } from './tuning';
import { BED_TOP, CANAL_LAYOUT, SURF, inSafeArea, type CurrentZone, type HidingSpot, type Point, type TilapiaRoute } from './zone';

const CURRENT: CurrentZone = { id: 'current-0', x0: 400, x1: 600, y0: 120, y1: 280, force: { x: -70, y: 0 } };
/** CURRENT with its flow reversed, coming from the left. */
const RIGHT_FLOW: CurrentZone = { ...CURRENT, force: { x: 70, y: 0 } };
/** CURRENT with its flow straight down, no sideways part. */
const NO_SIDEWAYS_FLOW: CurrentZone = { ...CURRENT, force: { x: 0, y: 70 } };

const GEO: HidingGeometry = {
  reedPatches: [{ x0: 100, x1: 160, y0: SURF, y1: 318, dragMul: 2.5 }],
  pads: [{ x: 300, rx: 20, flower: false }],
  cave: { id: 'canal/cave', x0: 900, x1: 1000, y0: 200, y1: 318 },
  currents: [CURRENT],
  homeSpot: { x: 0, y: 200, radius: 72 },
  mainPath: [
    { x: 0, y: 200 },
    { x: 1200, y: 200 },
  ],
  tilapiaRoutes: [],
};

const SQUARE_ROUTE: TilapiaRoute = {
  id: 'square',
  waypoints: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ],
};

/** A one-point route far down the canal, so the risk ladder can be probed along a line above it. */
const PROBE_ROUTE: TilapiaRoute = { id: 'probe', waypoints: [{ x: 5000, y: 0 }] };

/**
 * The past band the rule gave before #103: beyond the current's edge farther from home, none when
 * home is within the current's x range.
 */
function homeBasedBand(current: Pick<CurrentZone, 'x0' | 'x1'>, home: Point): PastCurrentBand | null {
  if (home.x < current.x0) return { edgeX: current.x1, farX: current.x1 + PAST_CURRENT_DEPTH };
  if (home.x > current.x1) return { edgeX: current.x0, farX: current.x0 - PAST_CURRENT_DEPTH };
  return null;
}

function spotAt(x: number, y: number, overrides: Partial<Omit<HidingSpot, 'id'>> = {}): Omit<HidingSpot, 'id'> {
  return { cover: 'reeds', rarity: 'common', container: false, x, y, ...overrides };
}

describe('hiding constants', () => {
  it('pins the provisional values', () => {
    expect(MAIN_PATH_REACH).toBe(48);
    expect(PAD_COVER_DEPTH).toBe(30);
    expect(PAST_CURRENT_DEPTH).toBe(140);
  });
});

describe('inReeds', () => {
  const patches = GEO.reedPatches;

  it('counts every edge as inside', () => {
    expect(inReeds({ x: 100, y: 200 }, patches)).toBe(true);
    expect(inReeds({ x: 160, y: 200 }, patches)).toBe(true);
    expect(inReeds({ x: 130, y: SURF }, patches)).toBe(true);
    expect(inReeds({ x: 130, y: 318 }, patches)).toBe(true);
  });

  it('rejects points just outside', () => {
    expect(inReeds({ x: 99.999, y: 200 }, patches)).toBe(false);
    expect(inReeds({ x: 160.001, y: 200 }, patches)).toBe(false);
    expect(inReeds({ x: 130, y: SURF - 0.001 }, patches)).toBe(false);
    expect(inReeds({ x: 130, y: 318.001 }, patches)).toBe(false);
    expect(inReeds({ x: 130, y: 200 }, [])).toBe(false);
  });
});

describe('underPad', () => {
  const pads = GEO.pads;

  it('covers the pad half-width down to PAD_COVER_DEPTH below the surface, inclusive', () => {
    expect(underPad({ x: 300, y: SURF }, pads)).toBe(true);
    expect(underPad({ x: 280, y: SURF + PAD_COVER_DEPTH }, pads)).toBe(true);
    expect(underPad({ x: 320, y: SURF + 10 }, pads)).toBe(true);
  });

  it('rejects points beside, above or below the cover', () => {
    expect(underPad({ x: 320.001, y: SURF + 10 }, pads)).toBe(false);
    expect(underPad({ x: 279.999, y: SURF + 10 }, pads)).toBe(false);
    expect(underPad({ x: 300, y: SURF - 0.001 }, pads)).toBe(false);
    expect(underPad({ x: 300, y: SURF + PAD_COVER_DEPTH + 0.001 }, pads)).toBe(false);
  });
});

describe('inCave', () => {
  it('uses inclusive edges', () => {
    expect(inCave({ x: 900, y: 200 }, GEO.cave)).toBe(true);
    expect(inCave({ x: 1000, y: 318 }, GEO.cave)).toBe(true);
    expect(inCave({ x: 899.999, y: 250 }, GEO.cave)).toBe(false);
    expect(inCave({ x: 1000.001, y: 250 }, GEO.cave)).toBe(false);
    expect(inCave({ x: 950, y: 199.999 }, GEO.cave)).toBe(false);
    expect(inCave({ x: 950, y: 318.001 }, GEO.cave)).toBe(false);
  });
});

describe('pastCurrentBand', () => {
  it('puts the band beyond the right edge when the flow comes from the right', () => {
    expect(pastCurrentBand(CURRENT)).toEqual({ edgeX: 600, farX: 600 + PAST_CURRENT_DEPTH });
  });

  it('puts the band beyond the left edge when the flow comes from the left', () => {
    expect(pastCurrentBand(RIGHT_FLOW)).toEqual({ edgeX: 400, farX: 400 - PAST_CURRENT_DEPTH });
  });

  it('gives no band when the current has no sideways flow', () => {
    expect(pastCurrentBand(NO_SIDEWAYS_FLOW)).toBeNull();
  });

  it('gives every shipped current the band the old home-based rule gave', () => {
    const layouts = [CANAL_LAYOUT, POND_LAYOUT, POND_2_LAYOUT, CHINAMPA_LAYOUT];
    for (const layout of layouts) {
      expect(layout.currents.length, layout.id).toBeGreaterThan(0);
      for (const current of layout.currents) {
        expect(pastCurrentBand(current), `${layout.id} ${current.id}`).toEqual(homeBasedBand(current, layout.start));
      }
    }
  });
});

describe('pastCurrent', () => {
  it('with flow to the left, covers the band beyond the right edge, edge excluded', () => {
    const currents = [CURRENT];
    expect(pastCurrent({ x: 600, y: 200 }, currents)).toBe(false);
    expect(pastCurrent({ x: 600.001, y: 200 }, currents)).toBe(true);
    expect(pastCurrent({ x: 600 + PAST_CURRENT_DEPTH, y: 200 }, currents)).toBe(true);
    expect(pastCurrent({ x: 600 + PAST_CURRENT_DEPTH + 0.001, y: 200 }, currents)).toBe(false);
    expect(pastCurrent({ x: 399, y: 200 }, currents)).toBe(false);
    expect(pastCurrent({ x: 500, y: 200 }, currents)).toBe(false);
  });

  it('with flow to the right, mirrors the band beyond the left edge', () => {
    const currents = [RIGHT_FLOW];
    expect(pastCurrent({ x: 400, y: 200 }, currents)).toBe(false);
    expect(pastCurrent({ x: 399.999, y: 200 }, currents)).toBe(true);
    expect(pastCurrent({ x: 400 - PAST_CURRENT_DEPTH, y: 200 }, currents)).toBe(true);
    expect(pastCurrent({ x: 400 - PAST_CURRENT_DEPTH - 0.001, y: 200 }, currents)).toBe(false);
    expect(pastCurrent({ x: 500, y: 200 }, currents)).toBe(false);
    expect(pastCurrent({ x: 601, y: 200 }, currents)).toBe(false);
  });

  it('keeps to the current y range, inclusive, for either flow', () => {
    for (const [current, x] of [
      [CURRENT, 650],
      [RIGHT_FLOW, 350],
    ] as const) {
      expect(pastCurrent({ x, y: 120 }, [current])).toBe(true);
      expect(pastCurrent({ x, y: 280 }, [current])).toBe(true);
      expect(pastCurrent({ x, y: 119.999 }, [current])).toBe(false);
      expect(pastCurrent({ x, y: 280.001 }, [current])).toBe(false);
    }
  });

  it('has no band on either side when the current has no sideways flow', () => {
    const currents = [NO_SIDEWAYS_FLOW];
    expect(pastCurrent({ x: 650, y: 200 }, currents)).toBe(false);
    expect(pastCurrent({ x: 350, y: 200 }, currents)).toBe(false);
  });
});

describe('coversAt', () => {
  it('lists covers in the order reeds, pad, cave, pastCurrent', () => {
    const geo: HidingGeometry = {
      ...GEO,
      reedPatches: [{ x0: 640, x1: 700, y0: SURF, y1: 318, dragMul: 2.5 }],
      pads: [{ x: 660, rx: 20, flower: false }],
      cave: { id: 'canal/cave', x0: 640, x1: 700, y0: SURF, y1: 318 },
      currents: [{ ...CURRENT, y0: SURF }],
    };
    expect(coversAt({ x: 660, y: SURF + 20 }, geo)).toEqual(['reeds', 'pad', 'cave', 'pastCurrent']);
    expect(coversAt({ x: 130, y: 200 }, GEO)).toEqual(['reeds']);
    expect(coversAt({ x: 300, y: SURF + 5 }, GEO)).toEqual(['pad']);
    expect(coversAt({ x: 950, y: 250 }, GEO)).toEqual(['cave']);
    expect(coversAt({ x: 650, y: 200 }, GEO)).toEqual(['pastCurrent']);
    expect(coversAt({ x: 800, y: 200 }, GEO)).toEqual([]);
  });
});

describe('inSightCover', () => {
  it('is true in a reed patch, under a lily pad or in the cave', () => {
    expect(inSightCover({ x: 130, y: 200 }, GEO)).toBe(true);
    expect(inSightCover({ x: 300, y: SURF + 5 }, GEO)).toBe(true);
    expect(inSightCover({ x: 950, y: 250 }, GEO)).toBe(true);
  });

  it('is false past a current, which is open water, and in other open water', () => {
    expect(coversAt({ x: 650, y: 200 }, GEO)).toEqual(['pastCurrent']);
    expect(inSightCover({ x: 650, y: 200 }, GEO)).toBe(false);
    expect(inSightCover({ x: 800, y: 200 }, GEO)).toBe(false);
  });

  it('treats absent cover geometry as no such cover', () => {
    expect(inSightCover({ x: 130, y: 200 }, {})).toBe(false);
    expect(inSightCover({ x: 950, y: 250 }, { reedPatches: GEO.reedPatches, pads: GEO.pads })).toBe(false);
    expect(inSightCover({ x: 950, y: 250 }, { cave: GEO.cave })).toBe(true);
  });
});

describe('distanceToPath', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('measures to the nearest segment of a multi-segment path', () => {
    expect(distanceToPath({ x: 50, y: 30 }, path)).toBeCloseTo(30, 9);
    expect(distanceToPath({ x: 130, y: 50 }, path)).toBeCloseTo(30, 9);
    expect(distanceToPath({ x: 80, y: 20 }, path)).toBeCloseTo(20, 9);
    expect(distanceToPath({ x: 100, y: 0 }, path)).toBe(0);
  });

  it('measures past the ends to the end points', () => {
    expect(distanceToPath({ x: -30, y: -40 }, path)).toBeCloseTo(50, 9);
    expect(distanceToPath({ x: 100, y: 130 }, path)).toBeCloseTo(30, 9);
  });

  it('uses the distance to the point for a single-point path', () => {
    expect(distanceToPath({ x: 3, y: 4 }, [{ x: 0, y: 0 }])).toBeCloseTo(5, 9);
  });

  it('throws on an empty path', () => {
    expect(() => distanceToPath({ x: 0, y: 0 }, [])).toThrow('distanceToPath');
  });
});

describe('isDeep', () => {
  it('is true in the cave or past the current only', () => {
    expect(isDeep({ x: 950, y: 250 }, GEO)).toBe(true);
    expect(isDeep({ x: 650, y: 200 }, GEO)).toBe(true);
    expect(isDeep({ x: 130, y: 200 }, GEO)).toBe(false);
    expect(isDeep({ x: 500, y: 200 }, GEO)).toBe(false);
  });
});

describe('meetsRarity', () => {
  it('common: hidden, shallow, no container and within MAIN_PATH_REACH of the path', () => {
    expect(meetsRarity({ x: 130, y: 200 + MAIN_PATH_REACH, container: false }, 'common', GEO)).toBe(true);
    expect(meetsRarity({ x: 130, y: 200 + MAIN_PATH_REACH + 0.001, container: false }, 'common', GEO)).toBe(false);
    expect(meetsRarity({ x: 130, y: 200, container: true }, 'common', GEO)).toBe(false);
    expect(meetsRarity({ x: 800, y: 200, container: false }, 'common', GEO)).toBe(false);
    expect(meetsRarity({ x: 650, y: 200, container: false }, 'common', GEO)).toBe(false);
  });

  it('rare: hidden, shallow, no container and beyond MAIN_PATH_REACH of the path', () => {
    expect(meetsRarity({ x: 130, y: 200 + MAIN_PATH_REACH + 0.001, container: false }, 'rare', GEO)).toBe(true);
    expect(meetsRarity({ x: 300, y: SURF + 20, container: false }, 'rare', GEO)).toBe(true);
    expect(meetsRarity({ x: 130, y: 200 + MAIN_PATH_REACH, container: false }, 'rare', GEO)).toBe(false);
    expect(meetsRarity({ x: 130, y: 300, container: true }, 'rare', GEO)).toBe(false);
    expect(meetsRarity({ x: 800, y: 120, container: false }, 'rare', GEO)).toBe(false);
    expect(meetsRarity({ x: 950, y: 300, container: false }, 'rare', GEO)).toBe(false);
  });

  it('epic: deep without a container', () => {
    expect(meetsRarity({ x: 950, y: 250, container: false }, 'epic', GEO)).toBe(true);
    expect(meetsRarity({ x: 650, y: 200, container: false }, 'epic', GEO)).toBe(true);
    expect(meetsRarity({ x: 950, y: 250, container: true }, 'epic', GEO)).toBe(false);
    expect(meetsRarity({ x: 130, y: 300, container: false }, 'epic', GEO)).toBe(false);
  });

  it('legendary with no threat: deep in a container only', () => {
    expect(meetsRarity({ x: 950, y: 250, container: true }, 'legendary', GEO)).toBe(true);
    expect(meetsRarity({ x: 650, y: 200, container: true }, 'legendary', GEO)).toBe(true);
    expect(meetsRarity({ x: 950, y: 250, container: false }, 'legendary', GEO)).toBe(false);
    expect(meetsRarity({ x: 650, y: 200, container: false }, 'legendary', GEO)).toBe(false);
    expect(meetsRarity({ x: 130, y: 300, container: true }, 'legendary', GEO)).toBe(false);
  });

  it('legendary with only an unmeasurable threat: deep in a container only', () => {
    const emptyRoute: HidingGeometry = { ...GEO, tilapiaRoutes: [{ id: 'empty', waypoints: [] }] };
    expect(meetsRarity({ x: 950, y: 250, container: true }, 'legendary', emptyRoute)).toBe(true);
    expect(meetsRarity({ x: 950, y: 250, container: false }, 'legendary', emptyRoute)).toBe(false);
  });
});

describe('meetsRarity for an open Legendary near a threat', () => {
  /** A long tilapia route along y = 180, so a spot at (x, y) is y - 180 px from it and far from every turn. */
  const nearCave: HidingGeometry = { ...GEO, tilapiaRoutes: [{ id: 'over-cave', waypoints: [{ x: -1000, y: 180 }, { x: 3000, y: 180 }] }] };

  it('accepts a deep Legendary with no pot within half the strike of a threat', () => {
    expect(meetsRarity({ x: 950, y: 250, container: false }, 'legendary', nearCave)).toBe(true);
    expect(meetsRarity({ x: 650, y: 200, container: false }, 'legendary', nearCave)).toBe(true);
    expect(meetsRarity({ x: 950, y: 250, container: true }, 'legendary', nearCave)).toBe(true);
  });

  it('rejects a deep Legendary with no pot beyond half the strike, where an Epic is accepted', () => {
    expect(meetsRarity({ x: 950, y: 250.001, container: false }, 'legendary', nearCave)).toBe(false);
    expect(meetsRarity({ x: 950, y: 260, container: false }, 'legendary', nearCave)).toBe(false);
    expect(meetsRarity({ x: 950, y: 260, container: false }, 'epic', nearCave)).toBe(true);
  });

  it('rejects a shallow Legendary, with a pot or without', () => {
    expect(meetsRarity({ x: 130, y: 200, container: false }, 'legendary', nearCave)).toBe(false);
    expect(meetsRarity({ x: 130, y: 200, container: true }, 'legendary', nearCave)).toBe(false);
  });

  it('still rejects an Epic in a pot', () => {
    expect(meetsRarity({ x: 950, y: 260, container: true }, 'epic', nearCave)).toBe(false);
  });

  it('makes spotMatchesLabels accept an open cave Legendary near a threat', () => {
    expect(spotMatchesLabels(spotAt(950, 250, { cover: 'cave', rarity: 'legendary' }), nearCave)).toBe(true);
    expect(spotMatchesLabels(spotAt(950, 260, { cover: 'cave', rarity: 'legendary' }), nearCave)).toBe(false);
  });
});

describe('spotMatchesLabels', () => {
  it('accepts correctly labelled spots of every kind', () => {
    expect(spotMatchesLabels(spotAt(130, 200), GEO)).toBe(true);
    expect(spotMatchesLabels(spotAt(130, 300, { rarity: 'rare' }), GEO)).toBe(true);
    expect(spotMatchesLabels(spotAt(300, SURF + 20, { cover: 'pad', rarity: 'rare' }), GEO)).toBe(true);
    expect(spotMatchesLabels(spotAt(950, 250, { cover: 'cave', rarity: 'epic' }), GEO)).toBe(true);
    expect(spotMatchesLabels(spotAt(650, 200, { cover: 'pastCurrent', rarity: 'legendary', container: true }), GEO)).toBe(true);
  });

  it('rejects a reeds label in open water', () => {
    expect(spotMatchesLabels(spotAt(800, 200), GEO)).toBe(false);
  });

  it('rejects a cover label the geometry does not give', () => {
    expect(spotMatchesLabels(spotAt(130, 300, { cover: 'cave', rarity: 'rare' }), GEO)).toBe(false);
  });

  it('rejects a Common in the cave', () => {
    expect(spotMatchesLabels(spotAt(950, 210, { cover: 'cave', rarity: 'common' }), GEO)).toBe(false);
  });

  it('rejects a Rare on the path', () => {
    expect(spotMatchesLabels(spotAt(130, 200, { rarity: 'rare' }), GEO)).toBe(false);
  });

  it('rejects an Epic with a container', () => {
    expect(spotMatchesLabels(spotAt(950, 250, { cover: 'cave', rarity: 'epic', container: true }), GEO)).toBe(false);
  });

  it('rejects a Legendary without a container in an area with no threat', () => {
    expect(spotMatchesLabels(spotAt(950, 250, { cover: 'cave', rarity: 'legendary' }), GEO)).toBe(false);
  });

  it('rejects a Legendary container outside the cave and past-current band', () => {
    expect(spotMatchesLabels(spotAt(130, 300, { rarity: 'legendary', container: true }), GEO)).toBe(false);
  });

  it('rejects a container at a Common spot', () => {
    expect(spotMatchesLabels(spotAt(130, 200, { container: true }), GEO)).toBe(false);
  });
});

describe('routeDistance', () => {
  it('measures to the nearest side of a closed loop, the wrap segment included', () => {
    expect(routeDistance({ x: 50, y: 50 }, [SQUARE_ROUTE])).toBeCloseTo(50, 9);
    expect(routeDistance({ x: 50, y: -10 }, [SQUARE_ROUTE])).toBeCloseTo(10, 9);
    expect(routeDistance({ x: 150, y: 50 }, [SQUARE_ROUTE])).toBeCloseTo(50, 9);
    expect(routeDistance({ x: -10, y: 50 }, [SQUARE_ROUTE])).toBeCloseTo(10, 9);
    expect(routeDistance({ x: -30, y: -40 }, [SQUARE_ROUTE])).toBeCloseTo(50, 9);
    expect(routeDistance({ x: 0, y: 50 }, [SQUARE_ROUTE])).toBe(0);
  });

  it('measures a one-point route to its point', () => {
    expect(routeDistance({ x: 3, y: 4 }, [{ id: 'one', waypoints: [{ x: 0, y: 0 }] }])).toBeCloseTo(5, 9);
  });

  it('measures a two-point route to the segment between them', () => {
    const route: TilapiaRoute = { id: 'two', waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    expect(routeDistance({ x: 50, y: 10 }, [route])).toBeCloseTo(10, 9);
    expect(routeDistance({ x: -30, y: 40 }, [route])).toBeCloseTo(50, 9);
    expect(routeDistance({ x: 130, y: -40 }, [route])).toBeCloseTo(50, 9);
  });

  it('uses the nearest of several routes and ignores a route with no waypoints', () => {
    const empty: TilapiaRoute = { id: 'empty', waypoints: [] };
    const near: TilapiaRoute = { id: 'near', waypoints: [{ x: 0, y: 0 }] };
    const far: TilapiaRoute = { id: 'far', waypoints: [{ x: 0, y: 100 }] };
    expect(routeDistance({ x: 3, y: 4 }, [empty, far, near])).toBeCloseTo(5, 9);
    expect(routeDistance({ x: 3, y: 4 }, [empty])).toBe(Infinity);
  });

  it('is Infinity with no routes', () => {
    expect(routeDistance({ x: 3, y: 4 }, [])).toBe(Infinity);
  });
});

describe('turnDistance', () => {
  it('measures to the nearest waypoint of any route, not to the segments', () => {
    expect(turnDistance({ x: 50, y: -10 }, [SQUARE_ROUTE])).toBeCloseTo(Math.hypot(50, 10), 9);
    expect(turnDistance({ x: 103, y: 104 }, [SQUARE_ROUTE])).toBeCloseTo(5, 9);
    expect(turnDistance({ x: 5003, y: 4 }, [SQUARE_ROUTE, PROBE_ROUTE])).toBeCloseTo(5, 9);
  });

  it('is Infinity with no routes or no waypoints', () => {
    expect(turnDistance({ x: 3, y: 4 }, [])).toBe(Infinity);
    expect(turnDistance({ x: 3, y: 4 }, [{ id: 'empty', waypoints: [] }])).toBe(Infinity);
  });
});

describe('withinLungeRange', () => {
  it('is true up to the lunge range, inclusive, and false beyond', () => {
    expect(withinLungeRange({ x: 5000, y: TILAPIA.lungeRange }, [PROBE_ROUTE])).toBe(true);
    expect(withinLungeRange({ x: 5000, y: TILAPIA.lungeRange + 0.001 }, [PROBE_ROUTE])).toBe(false);
    expect(withinLungeRange({ x: 5000, y: 50 }, [PROBE_ROUTE], 50)).toBe(true);
    expect(withinLungeRange({ x: 5000, y: 50.001 }, [PROBE_ROUTE], 50)).toBe(false);
  });

  it('is false with no routes', () => {
    expect(withinLungeRange({ x: 0, y: 0 }, [])).toBe(false);
  });
});

describe('RISK', () => {
  it('pins the provisional values', () => {
    expect(RISK.band).toEqual({
      common: { over: 200, upTo: Infinity },
      rare: { over: 140, upTo: 200 },
      epic: { over: 70, upTo: 140 },
      legendary: { over: -Infinity, upTo: 70 },
    });
    expect(RISK.turnClearance).toBe(60);
    expect(RISK.unfavouredWeight).toBe(1);
    expect(RISK.favouredWeight).toBe(2);
    expect(RISK.favoured).toEqual({ common: 'farther', rare: 'nearer', epic: 'nearer', legendary: 'nearer' });
    expect(Object.isFrozen(RISK)).toBe(true);
    expect(Object.isFrozen(RISK.band)).toBe(true);
    expect(Object.isFrozen(RISK.band.common)).toBe(true);
    expect(Object.isFrozen(RISK.favoured)).toBe(true);
  });

  it('orders the bands so each rarer band sits nearer the tilapia, with no overlap', () => {
    for (const rarity of RARITIES) {
      expect(RISK.band[rarity].over).toBeLessThan(RISK.band[rarity].upTo);
    }
    for (let i = 0; i + 1 < RARITIES.length; i++) {
      const commoner = RISK.band[RARITIES[i]];
      const rarer = RISK.band[RARITIES[i + 1]];
      expect(rarer.upTo).toBeLessThanOrEqual(commoner.over);
    }
  });

  it('puts the Rare and Epic edge at the lunge range and the Common edge beyond it', () => {
    expect(RISK.band.rare.over).toBe(TILAPIA.lungeRange);
    expect(RISK.band.epic.upTo).toBe(TILAPIA.lungeRange);
    expect(RISK.band.common.over).toBeGreaterThan(TILAPIA.lungeRange);
  });
});

describe('meetsRiskRule', () => {
  const lineRoute: TilapiaRoute = { id: 'line', waypoints: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] };

  it.each([
    ['common', 200, false],
    ['common', 200.001, true],
    ['common', 1000, true],
    ['rare', 140, false],
    ['rare', 140.001, true],
    ['rare', 200, true],
    ['rare', 200.001, false],
    ['epic', 70, false],
    ['epic', 70.001, true],
    ['epic', 140, true],
    ['epic', 140.001, false],
    ['legendary', 0, true],
    ['legendary', 70, true],
    ['legendary', 70.001, false],
  ] as const)('%s at %f px from the route gives %s', (rarity, distance, expected) => {
    expect(meetsRiskRule({ x: 5000, y: distance }, rarity, [lineRoute])).toBe(expected);
  });

  it('rejects a spot inside the turn clearance of a waypoint, edge allowed', () => {
    expect(meetsRiskRule({ x: 0, y: RISK.turnClearance }, 'legendary', [lineRoute])).toBe(true);
    expect(meetsRiskRule({ x: 0, y: RISK.turnClearance - 0.001 }, 'legendary', [lineRoute])).toBe(false);
    expect(meetsRiskRule({ x: 30, y: 50 }, 'legendary', [lineRoute])).toBe(false);
    expect(meetsRiskRule({ x: 10000, y: 50 }, 'legendary', [lineRoute])).toBe(false);
  });

  it('is true for every rarity with no routes or no waypoints', () => {
    for (const rarity of RARITIES) {
      expect(meetsRiskRule({ x: 0, y: 0 }, rarity, [])).toBe(true);
      expect(meetsRiskRule({ x: 0, y: 0 }, rarity, [{ id: 'empty', waypoints: [] }])).toBe(true);
    }
  });

  it('reads the bands and clearance from the tuning it is given', () => {
    const tight = { ...RISK, band: { ...RISK.band, legendary: { over: -Infinity, upTo: 10 } }, turnClearance: 0 };
    expect(meetsRiskRule({ x: 5000, y: 20 }, 'legendary', [lineRoute], tight)).toBe(false);
    expect(meetsRiskRule({ x: 0, y: 5 }, 'legendary', [lineRoute], tight)).toBe(true);
  });
});

describe('meetsRarity with tilapia routes', () => {
  const farAbove: TilapiaRoute = { id: 'far', waypoints: [{ x: -1000, y: -100 }, { x: 2000, y: -100 }] };
  const nearAbove: TilapiaRoute = { id: 'near', waypoints: [{ x: -1000, y: 100 }, { x: 2000, y: 100 }] };

  it('with no routes, applies the hiding rules alone', () => {
    expect(meetsRarity({ x: 130, y: 200, container: false }, 'common', GEO)).toBe(true);
    expect(meetsRarity({ x: 130, y: 300, container: false }, 'rare', GEO)).toBe(true);
    expect(meetsRarity({ x: 950, y: 250, container: true }, 'legendary', GEO)).toBe(true);
  });

  it('needs both the hiding rules and the risk ladder', () => {
    const far: HidingGeometry = { ...GEO, tilapiaRoutes: [farAbove] };
    const near: HidingGeometry = { ...GEO, tilapiaRoutes: [nearAbove] };
    expect(meetsRarity({ x: 130, y: 200, container: false }, 'common', far)).toBe(true);
    expect(meetsRarity({ x: 130, y: 200, container: false }, 'common', near)).toBe(false);
    expect(meetsRarity({ x: 130, y: 300, container: false }, 'rare', far)).toBe(false);
    expect(meetsRarity({ x: 800, y: 200, container: false }, 'common', far)).toBe(false);
  });

  it('makes spotMatchesLabels enforce the risk ladder', () => {
    const near: HidingGeometry = { ...GEO, tilapiaRoutes: [nearAbove] };
    expect(spotMatchesLabels(spotAt(130, 200), GEO)).toBe(true);
    expect(spotMatchesLabels(spotAt(130, 200), near)).toBe(false);
    expect(spotMatchesLabels(spotAt(130, 200), near, { ...RISK, band: { ...RISK.band, common: { over: 0, upTo: 150 } } })).toBe(true);
  });
});

function testFact(id: string): FactCard {
  return { id, name: id, title: `Meet the ${id}`, body: `A ${id} for tests.` };
}

/** A test predator with a shorter strike than the tilapia. */
const TEST_EEL: PredatorSpecies = {
  ...TILAPIA_SPECIES,
  id: 'test-eel',
  name: 'Test eel',
  tuning: { ...TILAPIA_SPECIES.tuning, lungeRange: 80 },
  fact: testFact('test-eel'),
};
const TEST_SPIKE: HazardType = { id: 'test-spike', name: 'Test spike', costsLeg: true, reach: 20, meetRange: 60, fact: testFact('test-spike') };
const TEST_WEED: HazardType = { id: 'test-weed', name: 'Test weed', costsLeg: false, reach: 20, meetRange: 60, fact: testFact('test-weed') };

/** A long line route along y = 0, so a spot at (5000, d) is d px from it and far from every turn. */
const LINE_ROUTE: TilapiaRoute = { id: 'line', waypoints: [{ x: 0, y: 0 }, { x: 10000, y: 0 }] };
const EEL_ROUTE: PredatorRoute = { id: 'eel', waypoints: [{ x: 0, y: 1000 }, { x: 10000, y: 1000 }], species: TEST_EEL };
const SPIKE: HazardSpawn = { id: 'spike-0', type: TEST_SPIKE, shape: { kind: 'circle', x: 5000, y: 1000, r: 10 } };
const WEED: HazardSpawn = { id: 'weed-0', type: TEST_WEED, shape: { kind: 'rect', x0: 0, x1: 10000, y0: 900, y1: 1100 } };
/** A punting pole at x 5000: its sweep is x 4995 to 5005, from the surface down 180 px. */
const POLE = movingHazardSpawn('pole-0', PUNTING_POLE, 5000, 0);

describe('riskBands', () => {
  it('gives exactly RISK.band for the tilapia lunge range', () => {
    expect(riskBands(TILAPIA.lungeRange)).toEqual(RISK.band);
  });

  it('scales the bands with the strike range, the Common edge RISK_COMMON_MARGIN past it', () => {
    expect(RISK_COMMON_MARGIN).toBe(60);
    expect(riskBands(80)).toEqual({
      common: { over: 140, upTo: Infinity },
      rare: { over: 80, upTo: 140 },
      epic: { over: 40, upTo: 80 },
      legendary: { over: -Infinity, upTo: 40 },
    });
  });
});

describe('zoneThreats', () => {
  it('lists the tilapia routes, then the predator routes, then the leg-costing hazards, each with its strike', () => {
    const threats = zoneThreats({ tilapiaRoutes: [LINE_ROUTE], predatorRoutes: [EEL_ROUTE], hazards: [SPIKE] });
    expect(threats).toEqual([
      { kind: 'route', route: LINE_ROUTE, strike: TILAPIA.lungeRange, tilapia: true },
      { kind: 'route', route: EEL_ROUTE, strike: 80, tilapia: false },
      { kind: 'shape', shape: SPIKE.shape, strike: TEST_SPIKE.reach },
    ]);
  });

  it('ignores slow-only hazards and absent predator routes or hazards', () => {
    expect(zoneThreats({ tilapiaRoutes: [], hazards: [WEED] })).toEqual([]);
    expect(zoneThreats({ tilapiaRoutes: [] })).toEqual([]);
  });

  it('lists each moving hazard after the hazards: its sweep as the shape, its touch reach as the strike (ND-8)', () => {
    const threats = zoneThreats({ tilapiaRoutes: [LINE_ROUTE], predatorRoutes: [EEL_ROUTE], hazards: [SPIKE], movingHazards: [POLE] });
    expect(threats).toHaveLength(4);
    expect(threats[2]).toEqual({ kind: 'shape', shape: SPIKE.shape, strike: TEST_SPIKE.reach });
    expect(threats[3]).toEqual({ kind: 'shape', shape: movingHazardSweep(POLE), strike: PUNTING_POLE.touchReach });
    expect(threats[3]).toEqual({ kind: 'shape', shape: { kind: 'rect', x0: 4995, x1: 5005, y0: SURF, y1: SURF + 180 }, strike: 18 });
  });

  it('bands a spot near a moving hazard by riskBands of its touch reach', () => {
    const pole = zoneThreats({ tilapiaRoutes: [], movingHazards: [POLE] });
    const below = (distance: number): Point => ({ x: 5000, y: SURF + 180 + distance });
    expect(meetsThreatRiskRule(below(15), 'epic', pole)).toBe(true);
    expect(meetsThreatRiskRule(below(15), 'rare', pole)).toBe(false);
    expect(meetsThreatRiskRule(below(5), 'legendary', pole)).toBe(true);
    expect(meetsThreatRiskRule(below(100), 'common', pole)).toBe(true);
  });

  it('keeps a chasing predator\'s strike at its lungeRange from its loop, without the leash (ND-5)', () => {
    const chaser: PredatorRoute = { ...EEL_ROUTE, species: { ...TEST_EEL, tuning: { ...TEST_EEL.tuning, chase: TILAPIA_CHASE } } };
    expect(zoneThreats({ tilapiaRoutes: [], predatorRoutes: [chaser] })).toEqual([{ kind: 'route', route: chaser, strike: 80, tilapia: false }]);
    const tuned = zoneThreats({ tilapiaRoutes: [LINE_ROUTE], tilapia: { ...AREA_TILAPIA, chase: TILAPIA_CHASE } });
    expect(tuned).toEqual([{ kind: 'route', route: LINE_ROUTE, strike: AREA_TILAPIA.lungeRange, tilapia: true, tuned: true }]);
  });

  it('never lists a drifting net: nets never cost a leg (N3)', () => {
    const drifting: HazardSpawn = { id: 'net-0', type: GHOST_NET, shape: { kind: 'circle', x: 0, y: 200, r: 40 }, drift: netDrift(160, 0, 16, 0) };
    expect(zoneThreats({ tilapiaRoutes: [], hazards: [drifting] })).toEqual([]);
  });

  it('gives the same threats with an empty moving hazard list as with none', () => {
    const geo = { tilapiaRoutes: [LINE_ROUTE], predatorRoutes: [EEL_ROUTE], hazards: [SPIKE, WEED] };
    expect(zoneThreats({ ...geo, movingHazards: [] })).toEqual(zoneThreats(geo));
  });
});

describe('riskDistance', () => {
  it('measures to the nearest threat: a closed route loop or a hazard shape edge', () => {
    const threats = zoneThreats({ tilapiaRoutes: [LINE_ROUTE], predatorRoutes: [EEL_ROUTE], hazards: [SPIKE] });
    expect(riskDistance({ x: 5000, y: 300 }, threats)).toBe(300);
    expect(riskDistance({ x: 5000, y: 960 }, threats)).toBe(30);
    expect(riskDistance({ x: 5000, y: 1005 }, threats)).toBe(0);
    expect(riskDistance({ x: 2000, y: 960 }, threats)).toBe(40);
  });

  it('matches routeDistance for tilapia routes alone', () => {
    const threats = zoneThreats({ tilapiaRoutes: [SQUARE_ROUTE, PROBE_ROUTE] });
    for (const pos of [{ x: 50, y: -30 }, { x: 150, y: 50 }, { x: 4000, y: 10 }]) {
      expect(riskDistance(pos, threats)).toBe(routeDistance(pos, [SQUARE_ROUTE, PROBE_ROUTE]));
    }
  });

  it('is Infinity with no threats', () => {
    expect(riskDistance({ x: 0, y: 0 }, [])).toBe(Infinity);
  });
});

describe('meetsThreatRiskRule', () => {
  const tilapiaOnly = zoneThreats({ tilapiaRoutes: [LINE_ROUTE] });

  it.each([
    ['common', 200, false],
    ['common', 200.001, true],
    ['rare', 140.001, true],
    ['rare', 200, true],
    ['epic', 70.001, true],
    ['epic', 140, true],
    ['epic', 140.001, false],
    ['legendary', 70, true],
    ['legendary', 70.001, false],
  ] as const)('with one tilapia route, %s at %f px gives %s like meetsRiskRule', (rarity, distance, expected) => {
    const pos = { x: 5000, y: distance };
    expect(meetsThreatRiskRule(pos, rarity, tilapiaOnly)).toBe(expected);
    expect(meetsThreatRiskRule(pos, rarity, tilapiaOnly)).toBe(meetsRiskRule(pos, rarity, [LINE_ROUTE]));
  });

  it('uses a predator route\'s own strike range for its bands', () => {
    const eel = zoneThreats({ tilapiaRoutes: [], predatorRoutes: [EEL_ROUTE] });
    expect(meetsThreatRiskRule({ x: 5000, y: 1000 - 100 }, 'rare', eel)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 1000 - 60 }, 'epic', eel)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 1000 - 40 }, 'legendary', eel)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 1000 - 141 }, 'common', eel)).toBe(true);
  });

  it('uses a leg-costing hazard\'s reach from its shape edge for its bands', () => {
    const spike = zoneThreats({ tilapiaRoutes: [], hazards: [SPIKE] });
    expect(meetsThreatRiskRule({ x: 5000, y: 1000 - 10 - 10 }, 'legendary', spike)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 1000 - 10 - 15 }, 'epic', spike)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 1000 - 10 - 50 }, 'rare', spike)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 1000 - 10 - 81 }, 'common', spike)).toBe(true);
  });

  it('ranks a spot by the riskiest band any threat gives, not by the nearest threat', () => {
    const mixed = zoneThreats({
      tilapiaRoutes: [LINE_ROUTE],
      predatorRoutes: [{ ...EEL_ROUTE, waypoints: [{ x: 0, y: 230 }, { x: 10000, y: 230 }] }],
    });
    const pos = { x: 5000, y: 130 };
    expect(riskDistance(pos, mixed)).toBe(100);
    expect(meetsThreatRiskRule(pos, 'epic', mixed)).toBe(true);
    expect(meetsThreatRiskRule(pos, 'rare', mixed)).toBe(false);
    expect(meetsThreatRiskRule({ x: 5000, y: 120 }, 'epic', mixed)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 180 }, 'epic', mixed)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 180 }, 'rare', mixed)).toBe(false);
  });

  it('ignores slow-only hazards', () => {
    const withWeed = zoneThreats({ tilapiaRoutes: [LINE_ROUTE], hazards: [WEED] });
    expect(meetsThreatRiskRule({ x: 5000, y: 300 }, 'common', withWeed)).toBe(true);
    expect(meetsThreatRiskRule({ x: 5000, y: 900 }, 'common', withWeed)).toBe(true);
  });

  it('keeps the turn clearance from every predator route waypoint, edge allowed', () => {
    const eel = zoneThreats({ tilapiaRoutes: [], predatorRoutes: [EEL_ROUTE] });
    expect(meetsThreatRiskRule({ x: 0, y: 1000 - RISK.turnClearance }, 'epic', eel)).toBe(true);
    expect(meetsThreatRiskRule({ x: 0, y: 1000 - RISK.turnClearance + 0.001 }, 'epic', eel)).toBe(false);
  });

  it('is true for every rarity with no threats or no waypoints', () => {
    const emptyRoute: Threat = { kind: 'route', route: { id: 'empty', waypoints: [] }, strike: 140, tilapia: false };
    for (const rarity of RARITIES) {
      expect(meetsThreatRiskRule({ x: 0, y: 0 }, rarity, [])).toBe(true);
      expect(meetsThreatRiskRule({ x: 0, y: 0 }, rarity, [emptyRoute])).toBe(true);
    }
  });

  it('reads the tilapia bands and the clearance from the tuning it is given', () => {
    const tight = { ...RISK, band: { ...RISK.band, legendary: { over: -Infinity, upTo: 10 } }, turnClearance: 0 };
    expect(meetsThreatRiskRule({ x: 5000, y: 20 }, 'legendary', tilapiaOnly, tight)).toBe(false);
    expect(meetsThreatRiskRule({ x: 0, y: 5 }, 'legendary', tilapiaOnly, tight)).toBe(true);
  });
});

describe('meetsRarity with every threat', () => {
  it('with no threats, applies the hiding rules alone', () => {
    const geo: HidingGeometry = { ...GEO, predatorRoutes: [], hazards: [{ ...WEED, shape: { kind: 'circle', x: 130, y: 200, r: 5 } }] };
    expect(meetsRarity({ x: 130, y: 200, container: false }, 'common', geo)).toBe(true);
    expect(meetsRarity({ x: 950, y: 250, container: true }, 'legendary', geo)).toBe(true);
  });

  it('applies the risk ladder for predator routes and leg-costing hazards', () => {
    const nearEel: HidingGeometry = { ...GEO, predatorRoutes: [{ ...EEL_ROUTE, waypoints: [{ x: -1000, y: 150 }, { x: 2000, y: 150 }] }] };
    const nearSpike: HidingGeometry = { ...GEO, hazards: [{ ...SPIKE, shape: { kind: 'circle', x: 130, y: 100, r: 10 } }] };
    expect(meetsRarity({ x: 130, y: 200, container: false }, 'common', nearEel)).toBe(false);
    expect(spotMatchesLabels(spotAt(130, 200), nearEel)).toBe(false);
    expect(meetsRarity({ x: 130, y: 200, container: false }, 'common', nearSpike)).toBe(true);
    expect(spotMatchesLabels(spotAt(130, 160), nearSpike)).toBe(false);
  });
});

describe('heron reach and strike zone', () => {
  const stretchY = SURF + PAD_COVER_DEPTH;
  const stretchX0 = 700;
  const stretchX1 = 1400;
  const heronRoute: PredatorRoute = {
    id: 'heron-stretch',
    waypoints: [
      { x: stretchX0, y: stretchY },
      { x: stretchX1, y: stretchY },
    ],
    species: HERON_SPECIES,
  };
  const heronCtx: PredatorContext = {
    safeArea: { x0: 40, x1: 660, y0: SURF, y1: BED_TOP },
    bounds: { minX: 0, maxX: 2000, minY: SURF, maxY: BED_TOP },
    tuning: HERON_SPECIES.tuning,
    rules: HERON_SPECIES.rules,
  };
  const heronGeo: HidingGeometry = {
    ...GEO,
    reedPatches: [...GEO.reedPatches, { x0: 1300, x1: 1340, y0: SURF, y1: BED_TOP, dragMul: 2.5 }],
    pads: [{ x: 1000, rx: 40, flower: false }],
    cave: { id: 'test/root-arch', x0: 1150, x1: 1250, y0: 120, y1: 220 },
    predatorRoutes: [heronRoute],
  };
  const threats = zoneThreats(heronGeo);
  const strike = threats[0].strike;

  /** Whether a heron standing at `stand` starts a warning at the target: the real predators.ts sight rule, cover included. */
  function heronWarnsAt(target: Point, stand: Point): boolean {
    const heron = createPredator({ id: 'heron-stand', waypoints: [stand] }, HERON_SPECIES.id);
    const ctx: PredatorContext = { ...heronCtx, targetInCover: inSightCover(target, heronGeo) };
    return stepPredator(heron, target, 0.01, ctx).events.some((event) => event.type === 'telegraphStart');
  }

  /** The point of the stretch nearest to `pos`, where the heron stands when it is nearest. */
  function nearestStand(pos: Point): Point {
    return { x: Math.min(stretchX1, Math.max(stretchX0, pos.x)), y: stretchY };
  }

  function inStrikeZone(pos: Point): boolean {
    return !inSafeArea(pos, heronCtx.safeArea) && riskDistance(pos, threats) <= strike;
  }

  function samplePoints(): Point[] {
    const points: Point[] = [];
    for (let x = 0; x <= 1600; x += 20) {
      for (let y = SURF; y <= BED_TOP; y += 10) points.push({ x, y });
    }
    return points;
  }

  it('gives the heron route its species lunge range as the strike range S = 110, and bands it by riskBands', () => {
    expect(threats).toEqual([{ kind: 'route', route: heronRoute, strike: HERON.lungeRange, tilapia: false }]);
    expect(strike).toBe(110);
    expect(riskBands(strike)).toEqual({
      common: { over: 170, upTo: Infinity },
      rare: { over: 110, upTo: 170 },
      epic: { over: 55, upTo: 110 },
      legendary: { over: -Infinity, upTo: 55 },
    });
    const at = (distance: number): Point => ({ x: 1000, y: stretchY + distance });
    expect(meetsThreatRiskRule(at(171), 'common', threats)).toBe(true);
    expect(meetsThreatRiskRule(at(170), 'common', threats)).toBe(false);
    expect(meetsThreatRiskRule(at(170), 'rare', threats)).toBe(true);
    expect(meetsThreatRiskRule(at(110), 'epic', threats)).toBe(true);
    expect(meetsThreatRiskRule(at(56), 'epic', threats)).toBe(true);
    expect(meetsThreatRiskRule(at(55), 'legendary', threats)).toBe(true);
  });

  it('warns at a sampled point, standing on the nearest point of its stretch, exactly when the point is in the strike zone and not in cover', () => {
    const points = samplePoints();
    const mismatches = points.filter(
      (pos) => heronWarnsAt(pos, nearestStand(pos)) !== (inStrikeZone(pos) && !inSightCover(pos, heronGeo)),
    );
    const reachRule = points.filter(
      (pos) => (routeLoopDistance(pos, heronRoute.waypoints) <= HERON.lungeRange && !inSafeArea(pos, heronCtx.safeArea)) !== inStrikeZone(pos),
    );
    expect(mismatches).toEqual([]);
    expect(reachRule).toEqual([]);
    expect(points.some((pos) => inStrikeZone(pos) && !inSightCover(pos, heronGeo))).toBe(true);
    expect(points.some((pos) => !inStrikeZone(pos))).toBe(true);
  });

  it('never warns, from anywhere on its stretch, at a point outside the strike zone', () => {
    const outside = samplePoints().filter((pos) => !inStrikeZone(pos));
    for (let x = stretchX0; x <= stretchX1; x += 50) {
      const stand = { x, y: stretchY };
      expect(outside.filter((pos) => heronWarnsAt(pos, stand)), `standing at x ${x}`).toEqual([]);
    }
  });

  it('counts the zone edge, exactly S from where it stands, as in reach', () => {
    const stand = { x: 1000, y: stretchY };
    const edge = { x: 1000, y: stretchY + strike };
    expect(riskDistance(edge, threats)).toBe(strike);
    expect(heronWarnsAt(edge, stand)).toBe(true);
    expect(heronWarnsAt({ x: 1000, y: stretchY + strike + 1 }, stand)).toBe(false);
  });

  it('never reaches deep water below the zone', () => {
    for (const pos of [{ x: 1000, y: stretchY + strike + 10 }, { x: 1000, y: BED_TOP }, { x: 1100, y: 225 }]) {
      expect(riskDistance(pos, threats)).toBeGreaterThan(strike);
      expect(heronWarnsAt(pos, nearestStand(pos))).toBe(false);
    }
  });

  it('never reaches the safe area, even within S of where it stands', () => {
    const sheltered = { x: 650, y: stretchY };
    expect(riskDistance(sheltered, threats)).toBeLessThanOrEqual(strike);
    expect(heronWarnsAt(sheltered, nearestStand(sheltered))).toBe(false);
  });

  it('never warns at a covered point under a pad, in the root arch or in reeds, though the risk ladder still counts it as near', () => {
    const underThePad = { x: 1000, y: stretchY - 10 };
    const archMouth = { x: 1200, y: 130 };
    const archDeep = { x: 1200, y: 200 };
    const inTheReeds = { x: 1320, y: 150 };
    expect(coversAt(underThePad, heronGeo)).toContain('pad');
    expect(coversAt(archMouth, heronGeo)).toContain('cave');
    expect(coversAt(archDeep, heronGeo)).toContain('cave');
    expect(coversAt(inTheReeds, heronGeo)).toContain('reeds');
    for (const pos of [underThePad, archMouth, archDeep, inTheReeds]) {
      expect(inSightCover(pos, heronGeo)).toBe(true);
      expect(inStrikeZone(pos)).toBe(true);
      expect(heronWarnsAt(pos, nearestStand(pos))).toBe(false);
      expect(heronWarnsAt({ x: pos.x, y: pos.y }, { x: pos.x, y: stretchY })).toBe(false);
    }
    expect(meetsThreatRiskRule(underThePad, 'legendary', threats)).toBe(true);
    expect(meetsThreatRiskRule(archMouth, 'legendary', threats)).toBe(true);
    expect(meetsThreatRiskRule(archDeep, 'epic', threats)).toBe(true);
    expect(meetsThreatRiskRule(archDeep, 'common', threats)).toBe(false);
    expect(meetsThreatRiskRule(inTheReeds, 'legendary', threats)).toBe(true);
  });
});

/** Tilapia tuning of an area with its own values, a longer strike reach than TILAPIA's. */
const AREA_TILAPIA = { ...TILAPIA, windup: 0.85, lungeSpeed: 400, lungeRange: 145, cooldown: 2.2, patrolSpeed: 50 };
const BANK = { x0: 760, x1: 860, y0: SURF, y1: 280 };

describe('underBank', () => {
  it('is true inside an overhang rectangle, edges included', () => {
    expect(underBank({ x: 800, y: 200 }, [BANK])).toBe(true);
    expect(underBank({ x: 760, y: SURF }, [BANK])).toBe(true);
    expect(underBank({ x: 860, y: 280 }, [BANK])).toBe(true);
    expect(underBank({ x: 759.999, y: 200 }, [BANK])).toBe(false);
    expect(underBank({ x: 800, y: 280.001 }, [BANK])).toBe(false);
    expect(underBank({ x: 800, y: 200 }, [])).toBe(false);
  });
});

describe('bank cover', () => {
  const banked: HidingGeometry = { ...GEO, bankOverhangs: [BANK] };

  it('lists the bank cover last in coversAt', () => {
    const geo: HidingGeometry = {
      ...GEO,
      reedPatches: [{ x0: 640, x1: 700, y0: SURF, y1: 318, dragMul: 2.5 }],
      pads: [{ x: 660, rx: 20, flower: false }],
      cave: { id: 'canal/cave', x0: 640, x1: 700, y0: SURF, y1: 318 },
      currents: [{ ...CURRENT, y0: SURF }],
      bankOverhangs: [{ x0: 640, x1: 700, y0: SURF, y1: 318 }],
    };
    expect(coversAt({ x: 660, y: SURF + 20 }, geo)).toEqual(['reeds', 'pad', 'cave', 'pastCurrent', 'bank']);
    expect(coversAt({ x: 800, y: 200 }, banked)).toEqual(['bank']);
  });

  it('gives no bank cover with absent or empty overhangs', () => {
    expect(coversAt({ x: 800, y: 200 }, GEO)).toEqual([]);
    expect(coversAt({ x: 800, y: 200 }, { ...GEO, bankOverhangs: [] })).toEqual([]);
  });

  it('is shallow cover: hides Common and Rare spots, never Epic or Legendary', () => {
    expect(isDeep({ x: 800, y: 200 }, banked)).toBe(false);
    expect(spotMatchesLabels(spotAt(800, 230, { cover: 'bank' }), banked)).toBe(true);
    expect(spotMatchesLabels(spotAt(800, 260, { cover: 'bank', rarity: 'rare' }), banked)).toBe(true);
    expect(spotMatchesLabels(spotAt(800, 260, { cover: 'bank', rarity: 'epic' }), banked)).toBe(false);
    expect(spotMatchesLabels(spotAt(800, 260, { cover: 'bank', rarity: 'legendary', container: true }), banked)).toBe(false);
    expect(spotMatchesLabels(spotAt(800, 230, { cover: 'bank' }), GEO)).toBe(false);
  });
});

describe('per-area tilapia tuning in the risk ladder', () => {
  const tuned = zoneThreats({ tilapiaRoutes: [LINE_ROUTE], tilapia: AREA_TILAPIA });
  const shared = zoneThreats({ tilapiaRoutes: [LINE_ROUTE] });

  it("gives a tuned geometry's tilapia routes the tuning's lunge range, marked tuned", () => {
    expect(tuned).toEqual([{ kind: 'route', route: LINE_ROUTE, strike: 145, tilapia: true, tuned: true }]);
    expect(shared).toEqual([{ kind: 'route', route: LINE_ROUTE, strike: TILAPIA.lungeRange, tilapia: true }]);
    expect(shared[0]).not.toHaveProperty('tuned');
  });

  it('bands a tuned tilapia route by riskBands of its lunge range', () => {
    expect(riskBands(AREA_TILAPIA.lungeRange)).toEqual({
      common: { over: 205, upTo: Infinity },
      rare: { over: 145, upTo: 205 },
      epic: { over: 72.5, upTo: 145 },
      legendary: { over: -Infinity, upTo: 72.5 },
    });
    const at = (distance: number): Point => ({ x: 5000, y: distance });
    expect(meetsThreatRiskRule(at(142), 'rare', shared)).toBe(true);
    expect(meetsThreatRiskRule(at(142), 'epic', tuned)).toBe(true);
    expect(meetsThreatRiskRule(at(142), 'rare', tuned)).toBe(false);
    expect(meetsThreatRiskRule(at(72), 'epic', shared)).toBe(true);
    expect(meetsThreatRiskRule(at(72), 'legendary', tuned)).toBe(true);
    expect(meetsThreatRiskRule(at(72), 'epic', tuned)).toBe(false);
    expect(meetsThreatRiskRule(at(203), 'common', shared)).toBe(true);
    expect(meetsThreatRiskRule(at(203), 'rare', tuned)).toBe(true);
    expect(meetsThreatRiskRule(at(203), 'common', tuned)).toBe(false);
  });

  it("ignores the risk tuning's tilapia bands for a tuned route but keeps its turn clearance", () => {
    const tight = { ...RISK, band: { ...RISK.band, legendary: { over: -Infinity, upTo: 10 } } };
    expect(meetsThreatRiskRule({ x: 5000, y: 20 }, 'legendary', shared, tight)).toBe(false);
    expect(meetsThreatRiskRule({ x: 5000, y: 20 }, 'legendary', tuned, tight)).toBe(true);
    expect(meetsThreatRiskRule({ x: 0, y: RISK.turnClearance - 0.001 }, 'legendary', tuned)).toBe(false);
  });

  it("gives today's bands for a tuning with TILAPIA's lunge range", () => {
    const same = zoneThreats({ tilapiaRoutes: [LINE_ROUTE], tilapia: { ...TILAPIA } });
    for (const rarity of RARITIES) {
      for (const distance of [0, 50, 70, 70.001, 100, 140, 140.001, 170, 200, 200.001, 400]) {
        const pos = { x: 5000, y: distance };
        expect(meetsThreatRiskRule(pos, rarity, same)).toBe(meetsThreatRiskRule(pos, rarity, shared));
      }
    }
  });

  it('reads the geometry tuning in meetsRarity', () => {
    const route: TilapiaRoute = { id: 'over-cave', waypoints: [{ x: -10000, y: 250 - 142 }, { x: 10000, y: 250 - 142 }] };
    const geo: HidingGeometry = { ...GEO, tilapiaRoutes: [route] };
    expect(meetsRarity({ x: 950, y: 250, container: false }, 'epic', geo)).toBe(false);
    expect(meetsRarity({ x: 950, y: 250, container: false }, 'epic', { ...geo, tilapia: AREA_TILAPIA })).toBe(true);
  });
});
