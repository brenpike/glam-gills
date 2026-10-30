import { describe, expect, it } from 'vitest';
import {
  areaTimeOfDay,
  AREAS,
  CANAL_AREA,
  CANAL_HABITAT,
  CHINAMPA_2_AREA,
  CHINAMPA_AREA,
  CHINAMPA_HABITAT,
  HABITATS,
  POND_2_AREA,
  POND_AREA,
  POND_HABITAT,
  SPRING_CAVE_2_AREA,
  SPRING_CAVE_AREA,
  SPRING_CAVE_HABITAT,
  areaById,
  areaFactCards,
  atExit,
  bookFactCards,
  exitContact,
  exitOpen,
  habitatById,
  isAreaBeaten,
  isAreaUnlocked,
  isNewArea,
  newThingsByArea,
  newestUnlockedAreaId,
  resolveAreaId,
  sourceFactCards,
  threatFactCards,
  threatIds,
  unlockedAreaIds,
  type AreaData,
  type NewThings,
} from './areas';
import {
  ALL_TREASURES,
  CANAL_TREASURES,
  CHINAMPA_2_TREASURES,
  CHINAMPA_TREASURES,
  POND_2_TREASURES,
  POND_TREASURES,
  SPRING_CAVE_TREASURES,
  dreamColourById,
  treasureById,
} from './catalogue';
import { CHINAMPA_2_AREA_ID, CHINAMPA_2_LAYOUT } from './chinampa2Layout';
import { CHINAMPA_AREA_ID, CHINAMPA_LAYOUT } from './chinampaLayout';
import { createCollectibles, snackDriftMaxSpeed, snackX, snackY } from './collectibles';
import { DEV_AREAS, DEV_TEST_AREA } from './devAreas';
import {
  AXOLOTL_REFUGES_FACT,
  CANAL_CLEAN_UPS_FACT,
  CARP_FACT,
  CRAYFISH_FACT,
  GEYSER_FACT,
  GARTER_SNAKE_FACT,
  GHOST_NET_FACT,
  HERON_FACT,
  PLASTIC_WORM_FACT,
  PUNTING_POLE_FACT,
  SHRIMP_FACT,
  STALACTITE_FACT,
  TADPOLE_FACT,
  TILAPIA_FACT,
  UNDERWATER_SPRINGS_FACT,
  WATER_HYACINTH_FACT,
  type FactCard,
} from './factCards';
import type { ElementType, HazardType } from './hazards';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander } from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardType } from './movingHazards';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { CARP_SPECIES, TILAPIA_SPECIES, type PredatorSpecies } from './predators';
import { POND_2_AREA_ID, POND_2_LAYOUT } from './pond2Layout';
import { POND_AREA_ID, POND_LAYOUT } from './pondLayout';
import { STRANDING_CHANCE, areaStrandingChance } from './rescue';
import { SNACK_DART } from './snackDart';
import { SPRING_CAVE_2_AREA_ID } from './springCave2Layout';
import { SPRING_CAVE_AREA_ID, SPRING_CAVE_LAYOUT } from './springCaveLayout';
import { NO_STARS, type AreaStars, type AreaStarsRecord } from './stars';
import { inSafeArea } from './tilapia';
import { FINDS, LEGS, SWIM } from './tuning';
import {
  CANAL_AREA_ID,
  CANAL_LAYOUT,
  DEFAULT_ZONE_SEED,
  SURF,
  buildCanalZone,
  buildZone,
  inHomeSpot,
  swimBounds,
  type AreaLayoutData,
} from './zone';

const EXTRA_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const ALL_SEEDS = [DEFAULT_ZONE_SEED, ...EXTRA_SEEDS];
const MAX_NEW_THREATS = 1;
const MAX_NEW_ELEMENTS = 1;
const EXIT_ONLY: AreaStars = { exit: true, special: false, legsOrRescue: false };
const ALL_STARS: AreaStars = { exit: true, special: true, legsOrRescue: true };
const SPECIAL_ONLY: AreaStars = { exit: false, special: true, legsOrRescue: false };
/** The canal, then the dev test area as area 2. */
const TWO_AREAS: readonly AreaData[] = [CANAL_AREA, { ...DEV_TEST_AREA, number: 2 }];
const TEST_ID = DEV_TEST_AREA.id;
const THIRD_ID = 'third-test-area';
const UNKNOWN_ID = 'no-such-area';
/** The canal, the dev test area as area 2, then a third area. */
const THREE_AREAS: readonly AreaData[] = [...TWO_AREAS, { ...CANAL_AREA, id: THIRD_ID, number: 3 }];

function testFact(id: string): FactCard {
  return { id, name: id, title: `Meet the ${id}`, body: `A ${id} for tests.` };
}

const TEST_PIKE: PredatorSpecies = { ...TILAPIA_SPECIES, id: 'test-pike', name: 'Test pike', fact: testFact('test-pike') };
const TEST_GLASS: HazardType = { id: 'test-glass', name: 'Test glass', costsLeg: true, reach: 4, meetRange: 60, fact: testFact('test-glass') };
const TEST_MUD: HazardType = { id: 'test-mud', name: 'Test mud', costsLeg: false, reach: 0, meetRange: 60, fact: testFact('test-mud') };
const TEST_GATE: ElementType = { id: 'test-gate', name: 'Test gate', kind: 'cycle', period: 4, activeFor: 2 };
const TEST_TIDE: ElementType = { id: 'test-tide', name: 'Test tide', kind: 'cycle', period: 6, activeFor: 3 };
const TEST_MATS: ElementType = { ...TEST_GATE, id: 'test-mats', name: 'Test mats', meetRange: 60, fact: testFact('test-mats') };
const TEST_LOCK: ElementType = { ...TEST_TIDE, id: 'test-lock', name: 'Test lock', fact: testFact('test-lock') };
const TEST_RAM: MovingHazardType = { ...PUNTING_POLE, id: 'test-ram', name: 'Test ram', fact: testFact('test-ram') };
const TEST_OAR: MovingHazardType = { ...PUNTING_POLE, id: 'test-oar', name: 'Test oar', fact: testFact('test-oar') };
const TEST_TADPOLE = tadpoleRule(30);
const TEST_TADPOLE_WANDERS = [
  tadpoleWander(TEST_TADPOLE, [[700, 300], [800, 300]], 0),
  tadpoleWander(TEST_TADPOLE, [[1100, 300], [1100, 380]], 0),
];
const TEST_SHRIMP = shrimpRule(60, 1.5, 40, 120);
const TEST_SHRIMP_HOMES = [shrimpHome([[1300, 320]]), shrimpHome([[1500, 320], [1540, 340], [1500, 360]])];
const SHRIMP_THEN_TADPOLES = mobileSnackMix({ shrimp: TEST_SHRIMP, homes: TEST_SHRIMP_HOMES, tadpole: TEST_TADPOLE, wanders: TEST_TADPOLE_WANDERS });
const TADPOLES_ONLY = mobileSnackMix({ tadpole: TEST_TADPOLE, wanders: TEST_TADPOLE_WANDERS, homes: [] });
const SHRIMP_ONLY = mobileSnackMix({ shrimp: TEST_SHRIMP, homes: TEST_SHRIMP_HOMES, wanders: [] });

/** Canal layout data with these threats, elements and mobile snacks in place of the canal's. */
function layoutWith(
  extra: Partial<
    Pick<AreaLayoutData, 'tilapiaRoutes' | 'predatorRoutes' | 'hazards' | 'elements' | 'movingHazards' | 'mobileSnacks'>
  >,
): AreaLayoutData {
  return { ...CANAL_LAYOUT, ...extra };
}

function areaWith(id: string, number: number, layout: AreaLayoutData): AreaData {
  return { ...CANAL_AREA, id, number, layout };
}

function pikeRoute(id: string) {
  return { id, waypoints: [{ x: 700, y: 262 }, { x: 790, y: 262 }], species: TEST_PIKE };
}

function carpRoute(id: string) {
  return { ...pikeRoute(id), species: CARP_SPECIES };
}

function ramAt(id: string, type: MovingHazardType = TEST_RAM) {
  return movingHazardSpawn(id, type, 1000, 0);
}

function glassAt(id: string, type: HazardType = TEST_GLASS) {
  return { id, type, shape: { kind: 'circle' as const, x: 900, y: 290, r: 10 } };
}

function elementOf(id: string, type: ElementType) {
  return { id, type, offset: 0 };
}

/** Fastest snack drift any area may have, in px/s: half the Snack magnet pull, 20 (PRD H4, Tuning values). */
const MAX_SNACK_DRIFT = SNACK_MAGNET_PULL_SPEED / 2;

/** Strength in px/s of the strongest current in an area's default zone. */
function strongestCurrentIn(area: AreaData): number {
  return Math.max(...buildZone(area.layout, DEFAULT_ZONE_SEED).currents.map((current) => Math.hypot(current.force.x, current.force.y)));
}

/** Areas that add more than one new threat or element (PRD N2). */
function areasOverNewLimit(areas: readonly AreaData[]): NewThings[] {
  return newThingsByArea(areas).filter(
    (things) => things.threats.length > MAX_NEW_THREATS || things.elements.length > MAX_NEW_ELEMENTS,
  );
}

describe('CANAL_AREA', () => {
  it('is Area 1, the canal', () => {
    expect(CANAL_AREA.id).toBe('canal');
    expect(CANAL_AREA.id).toBe(CANAL_AREA_ID);
    expect(CANAL_AREA.number).toBe(1);
  });

  it('names a special treasure from the canal catalogue', () => {
    expect(CANAL_TREASURES.map((treasure) => treasure.id)).toContain(CANAL_AREA.specialTreasureId);
    expect(CANAL_AREA.specialTreasureId).toBe('canal/toy-boat');
  });

  it.each([...AREAS, ...DEV_AREAS].map((area) => [area.id, area] as const))(
    'gives %s a Common or Rare special treasure that the area hides',
    (_id, area) => {
      const special = treasureById(area.specialTreasureId);
      expect(special).toBeDefined();
      expect(area.layout.treasures).toContain(special);
      expect(['common', 'rare']).toContain(special?.rarity);
    },
  );

  it.each(ALL_SEEDS)('names a special treasure the zone hides for seed %i', (seed) => {
    const finds = buildCanalZone(seed).finds;
    const special = finds.find((find) => find.id === CANAL_AREA.specialTreasureId);
    expect(special).toBeDefined();
    expect(special?.pool.length).toBeGreaterThan(0);
  });

  it('is frozen area data', () => {
    expect(Object.isFrozen(CANAL_AREA)).toBe(true);
    expect(Object.isFrozen(CANAL_AREA.exit)).toBe(true);
    expect(Object.isFrozen(CANAL_AREA.snackDrift)).toBe(true);
    expect(Object.isFrozen(AREAS)).toBe(true);
  });
});

describe('POND_AREA', () => {
  it('is Area 2, the lily pad pond', () => {
    expect(POND_AREA.id).toBe('pond-1');
    expect(POND_AREA.id).toBe(POND_AREA_ID);
    expect(POND_AREA.number).toBe(2);
    expect(POND_AREA.layout).toBe(POND_LAYOUT);
  });

  it('names the Frog statue from the pond catalogue as its special treasure', () => {
    expect(POND_AREA.specialTreasureId).toBe('pond/frog-statue');
    expect(POND_TREASURES.map((treasure) => treasure.id)).toContain(POND_AREA.specialTreasureId);
  });

  it.each(ALL_SEEDS)('names a special treasure the zone hides for seed %i', (seed) => {
    const special = buildZone(POND_LAYOUT, seed).finds.find((find) => find.id === POND_AREA.specialTreasureId);
    expect(special).toBeDefined();
    expect(special?.pool.length).toBeGreaterThan(0);
  });

  it('is frozen area data', () => {
    expect(Object.isFrozen(POND_AREA)).toBe(true);
    expect(Object.isFrozen(POND_AREA.exit)).toBe(true);
    expect(Object.isFrozen(POND_AREA.snackDrift)).toBe(true);
  });
});

describe('POND_2_AREA', () => {
  it('is Area 3, the lily pad pond at dusk, in the pond habitat', () => {
    expect(POND_2_AREA.id).toBe('pond-2');
    expect(POND_2_AREA.id).toBe(POND_2_AREA_ID);
    expect(POND_2_AREA.number).toBe(3);
    expect(POND_2_AREA.habitatId).toBe(POND_HABITAT.id);
    expect(POND_2_AREA.layout).toBe(POND_2_LAYOUT);
    expect(POND_2_AREA.look).toBe('pond-dusk');
  });

  it("is the only dusk area: its look's time of day is dusk, and every other area's look is day", () => {
    for (const area of AREAS) expect(areaTimeOfDay(area)).toBe(area === POND_2_AREA ? 'dusk' : 'day');
  });

  it('names the Wooden duck decoy, a Rare treasure from the Area 3 catalogue, as its special treasure', () => {
    expect(POND_2_AREA.specialTreasureId).toBe('pond/wooden-duck-decoy');
    expect(POND_2_TREASURES.map((treasure) => treasure.id)).toContain(POND_2_AREA.specialTreasureId);
    expect(treasureById(POND_2_AREA.specialTreasureId)?.rarity).toBe('rare');
  });

  it.each(ALL_SEEDS)('names a special treasure the zone hides for seed %i', (seed) => {
    const special = buildZone(POND_2_LAYOUT, seed).finds.find((find) => find.id === POND_2_AREA.specialTreasureId);
    expect(special).toBeDefined();
    expect(special?.pool.length).toBeGreaterThan(0);
  });

  it('keeps the shared dart rule in its data, and its shrimp turn the darters off; the earlier areas have no darters and no look of their own', () => {
    expect(POND_2_AREA.snackDart).toBe(SNACK_DART);
    expect(POND_2_AREA.snackDart?.darters).toBe(3);
    expect(CANAL_AREA.snackDart).toBeUndefined();
    expect(POND_AREA.snackDart).toBeUndefined();
    expect(CANAL_AREA.look).toBeUndefined();
    expect(POND_AREA.look).toBeUndefined();
  });

  it('is frozen area data', () => {
    expect(Object.isFrozen(POND_2_AREA)).toBe(true);
    expect(Object.isFrozen(POND_2_AREA.exit)).toBe(true);
    expect(Object.isFrozen(POND_2_AREA.snackDrift)).toBe(true);
    expect(Object.isFrozen(POND_2_AREA.snackDart)).toBe(true);
  });
});

describe('CHINAMPA_AREA', () => {
  it('is Area 4, the chinampa gardens, in the chinampa habitat', () => {
    expect(CHINAMPA_AREA.id).toBe('chinampa-1');
    expect(CHINAMPA_AREA.id).toBe(CHINAMPA_AREA_ID);
    expect(CHINAMPA_AREA.number).toBe(4);
    expect(CHINAMPA_AREA.habitatId).toBe(CHINAMPA_HABITAT.id);
    expect(CHINAMPA_AREA.layout).toBe(CHINAMPA_LAYOUT);
    expect(CHINAMPA_AREA.look).toBeUndefined();
  });

  it('names the Scarecrow, a Rare treasure from the Area 4 catalogue, as its special treasure', () => {
    expect(CHINAMPA_AREA.specialTreasureId).toBe('chinampa/scarecrow');
    expect(CHINAMPA_TREASURES.map((treasure) => treasure.id)).toContain(CHINAMPA_AREA.specialTreasureId);
    expect(treasureById(CHINAMPA_AREA.specialTreasureId)?.rarity).toBe('rare');
  });

  it.each(ALL_SEEDS)('names a special treasure the zone hides for seed %i', (seed) => {
    const special = buildZone(CHINAMPA_LAYOUT, seed).finds.find((find) => find.id === CHINAMPA_AREA.specialTreasureId);
    expect(special).toBeDefined();
    expect(special?.pool.length).toBeGreaterThan(0);
  });

  it('keeps the shared 3-darter rule, as Area 3 does, which its shrimp turn off', () => {
    expect(CHINAMPA_AREA.snackDart).toBe(SNACK_DART);
    expect(CHINAMPA_AREA.snackDart?.darters).toBe(3);
  });

  it('is frozen area data', () => {
    expect(Object.isFrozen(CHINAMPA_AREA)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_AREA.exit)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_AREA.snackDrift)).toBe(true);
  });
});

describe('CHINAMPA_2_AREA', () => {
  it('is Area 5, the chinampa gardens again, in the chinampa habitat, with no look of its own', () => {
    expect(CHINAMPA_2_AREA.id).toBe('chinampa-2');
    expect(CHINAMPA_2_AREA.id).toBe(CHINAMPA_2_AREA_ID);
    expect(CHINAMPA_2_AREA.number).toBe(5);
    expect(CHINAMPA_2_AREA.habitatId).toBe(CHINAMPA_HABITAT.id);
    expect(CHINAMPA_2_AREA.layout).toBe(CHINAMPA_2_LAYOUT);
    expect(CHINAMPA_2_AREA.look).toBeUndefined();
  });

  it('names the Piñata, a Rare treasure from the Area 5 catalogue, as its special treasure', () => {
    expect(CHINAMPA_2_AREA.specialTreasureId).toBe('chinampa/pinata');
    expect(CHINAMPA_2_TREASURES.map((treasure) => treasure.id)).toContain(CHINAMPA_2_AREA.specialTreasureId);
    expect(treasureById(CHINAMPA_2_AREA.specialTreasureId)?.rarity).toBe('rare');
  });

  it.each(ALL_SEEDS)('names a special treasure the zone hides for seed %i', (seed) => {
    const special = buildZone(CHINAMPA_2_LAYOUT, seed).finds.find((find) => find.id === CHINAMPA_2_AREA.specialTreasureId);
    expect(special).toBeDefined();
    expect(special?.pool.length).toBeGreaterThan(0);
  });

  it('keeps the shared dart rule in its data; its shrimp turn the one-time darters off (#118, ND-27)', () => {
    expect(CHINAMPA_2_AREA.snackDart).toBe(SNACK_DART);
  });

  it('is frozen area data', () => {
    expect(Object.isFrozen(CHINAMPA_2_AREA)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_2_AREA.exit)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_2_AREA.snackDrift)).toBe(true);
  });
});

describe('SPRING_CAVE_AREA', () => {
  it('is Area 6, the spring cave, in the spring cave habitat, with no look of its own (issue #77)', () => {
    expect(SPRING_CAVE_AREA.id).toBe('spring-cave-1');
    expect(SPRING_CAVE_AREA.id).toBe(SPRING_CAVE_AREA_ID);
    expect(SPRING_CAVE_AREA.number).toBe(6);
    expect(SPRING_CAVE_AREA.habitatId).toBe(SPRING_CAVE_HABITAT.id);
    expect(SPRING_CAVE_AREA.layout).toBe(SPRING_CAVE_LAYOUT);
    expect(SPRING_CAVE_AREA.look).toBeUndefined();
  });

  it('names the Fossil ammonite, a Rare treasure from the Area 6 catalogue, as its special treasure', () => {
    expect(SPRING_CAVE_AREA.specialTreasureId).toBe('spring-cave/fossil-ammonite');
    expect(SPRING_CAVE_TREASURES.map((treasure) => treasure.id)).toContain(SPRING_CAVE_AREA.specialTreasureId);
    expect(treasureById(SPRING_CAVE_AREA.specialTreasureId)?.rarity).toBe('rare');
  });

  it.each(ALL_SEEDS)('names a special treasure the zone hides for seed %i', (seed) => {
    const special = buildZone(SPRING_CAVE_LAYOUT, seed).finds.find((find) => find.id === SPRING_CAVE_AREA.specialTreasureId);
    expect(special).toBeDefined();
    expect(special?.pool.length).toBeGreaterThan(0);
  });

  it('has no dart rule: its shrimp replace the one-time darters (issue #77, ND-10)', () => {
    expect(SPRING_CAVE_AREA.snackDart).toBeUndefined();
  });

  it('is frozen area data', () => {
    expect(Object.isFrozen(SPRING_CAVE_AREA)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_AREA.exit)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_AREA.snackDrift)).toBe(true);
  });
});

describe('habitats', () => {
  it('has the canal habitat, holding Area 1, the pond habitat, holding Areas 2 and 3, and the chinampa habitat, holding Areas 4 and 5', () => {
    expect(CANAL_HABITAT).toEqual({ id: 'canal', name: 'Canal', look: 'canal' });
    expect(POND_HABITAT).toEqual({ id: 'pond', name: 'Lily pad pond', look: 'pond' });
    expect(CHINAMPA_HABITAT).toEqual({ id: 'chinampa', name: 'Chinampa gardens', look: 'chinampa' });
    expect(HABITATS).toEqual([CANAL_HABITAT, POND_HABITAT, CHINAMPA_HABITAT, SPRING_CAVE_HABITAT]);
    expect(Object.isFrozen(CANAL_HABITAT)).toBe(true);
    expect(Object.isFrozen(POND_HABITAT)).toBe(true);
    expect(Object.isFrozen(CHINAMPA_HABITAT)).toBe(true);
    expect(Object.isFrozen(HABITATS)).toBe(true);
    expect(CANAL_AREA.habitatId).toBe(CANAL_HABITAT.id);
    expect(POND_AREA.habitatId).toBe(POND_HABITAT.id);
    expect(POND_2_AREA.habitatId).toBe(POND_HABITAT.id);
    expect(CHINAMPA_AREA.habitatId).toBe(CHINAMPA_HABITAT.id);
    expect(CHINAMPA_2_AREA.habitatId).toBe(CHINAMPA_HABITAT.id);
  });

  it('has the spring cave habitat, with its own look, after the chinampa gardens', () => {
    expect(SPRING_CAVE_HABITAT).toEqual({ id: 'spring-cave', name: 'Spring cave', look: 'spring-cave' });
    expect(Object.isFrozen(SPRING_CAVE_HABITAT)).toBe(true);
    expect(HABITATS.at(-1)).toBe(SPRING_CAVE_HABITAT);
    expect(SPRING_CAVE_AREA.habitatId).toBe(SPRING_CAVE_HABITAT.id);
    expect(new Set(HABITATS.map((habitat) => habitat.id)).size).toBe(HABITATS.length);
    expect(new Set(HABITATS.map((habitat) => habitat.look)).size).toBe(HABITATS.length);
  });

  it('finds a habitat by id', () => {
    expect(habitatById('canal')).toBe(CANAL_HABITAT);
    expect(habitatById('pond')).toBe(POND_HABITAT);
    expect(habitatById('chinampa')).toBe(CHINAMPA_HABITAT);
    expect(habitatById('spring-cave')).toBe(SPRING_CAVE_HABITAT);
    expect(habitatById(UNKNOWN_ID)).toBeUndefined();
  });

  it('puts every area in a known habitat', () => {
    for (const area of AREAS) {
      expect(habitatById(area.habitatId), area.id).toBeDefined();
    }
  });
});

describe('strandingChance', () => {
  it.each([CANAL_AREA, POND_AREA, POND_2_AREA, CHINAMPA_AREA, CHINAMPA_2_AREA].map((area) => [area.id, area] as const))(
    'leaves %s without its own strandingChance, so it keeps the 40% default',
    (_id, area) => {
      expect(area.strandingChance).toBeUndefined();
      expect('strandingChance' in area).toBe(false);
    },
  );

  it('gives the spring cave, Area 6, a stranded axolotl on 30% of trips (issue #77, ND-13)', () => {
    expect(SPRING_CAVE_AREA.strandingChance).toBe(0.3);
    expect(areaStrandingChance(SPRING_CAVE_AREA)).toBe(0.3);
    expect(areaStrandingChance(CHINAMPA_2_AREA)).toBe(STRANDING_CHANCE);
  });

  it('keeps any area strandingChance a number from 0 to 1', () => {
    for (const area of AREAS) {
      if (area.strandingChance === undefined) continue;
      expect(area.strandingChance, area.id).toBeGreaterThanOrEqual(0);
      expect(area.strandingChance, area.id).toBeLessThanOrEqual(1);
    }
  });
});

describe('canal area layout', () => {
  it('is the canal layout data and builds the canal zone', () => {
    expect(CANAL_AREA.layout).toBe(CANAL_LAYOUT);
    expect(buildZone(CANAL_AREA.layout, DEFAULT_ZONE_SEED)).toEqual(buildCanalZone());
  });
});

describe('threats', () => {
  it('names the tilapia for the canal, from its data or its zone', () => {
    expect(threatIds(CANAL_LAYOUT)).toEqual(['tilapia']);
    expect(threatIds(buildCanalZone())).toEqual(['tilapia']);
    expect(threatFactCards(CANAL_LAYOUT)).toEqual([TILAPIA_FACT]);
    expect(threatFactCards(buildCanalZone())).toEqual([TILAPIA_FACT]);
  });

  it('lists the tilapia, then predator species, then hazard types, each once', () => {
    const layout = layoutWith({
      predatorRoutes: [pikeRoute('pike-0'), pikeRoute('pike-1'), { ...pikeRoute('tilapia-x'), species: TILAPIA_SPECIES }],
      hazards: [glassAt('glass-0'), glassAt('mud-0', TEST_MUD), glassAt('glass-1')],
    });
    expect(threatIds(layout)).toEqual(['tilapia', 'test-pike', 'test-glass', 'test-mud']);
    expect(threatFactCards(layout)).toEqual([TILAPIA_FACT, TEST_PIKE.fact, TEST_GLASS.fact, TEST_MUD.fact]);
  });

  it('lists moving hazard types after the still hazard types, each once (ND-8)', () => {
    const layout = layoutWith({
      hazards: [glassAt('glass-0')],
      movingHazards: [ramAt('ram-0'), ramAt('oar-0', TEST_OAR), ramAt('ram-1')],
    });
    expect(threatIds(layout)).toEqual(['tilapia', 'test-glass', 'test-ram', 'test-oar']);
    expect(threatFactCards(layout)).toEqual([TILAPIA_FACT, TEST_GLASS.fact, TEST_RAM.fact, TEST_OAR.fact]);
    expect(threatIds(buildZone(layout, DEFAULT_ZONE_SEED))).toEqual(['tilapia', 'test-glass', 'test-ram', 'test-oar']);
  });

  it('still names the danger parts: the carp and every moving hazard type (ND-13)', () => {
    const layout = layoutWith({ predatorRoutes: [carpRoute('carp-0')], movingHazards: [ramAt('oar-0', TEST_OAR)] });
    expect(threatIds(layout)).toEqual(['tilapia', 'carp', 'test-oar']);
    expect(threatFactCards(layout)).toEqual([TILAPIA_FACT, CARP_FACT, TEST_OAR.fact]);
  });

  it('names no mobile snack type as a threat', () => {
    expect(threatIds(layoutWith({ mobileSnacks: SHRIMP_THEN_TADPOLES }))).toEqual(['tilapia']);
  });

  it('leaves out the tilapia when there are no tilapia routes', () => {
    const layout = layoutWith({ tilapiaRoutes: [], hazards: [glassAt('glass-0')] });
    expect(threatIds(layout)).toEqual(['test-glass']);
    expect(threatIds(layoutWith({ tilapiaRoutes: [] }))).toEqual([]);
  });

  it('gives the tilapia, carp, plastic worm, tadpole, shrimp, heron, ghost net, punting pole, garter snake, water hyacinth, crayfish, stalactite, geyser and underwater springs cards, for the shipped areas', () => {
    expect(areaFactCards()).toEqual([
      TILAPIA_FACT,
      CARP_FACT,
      PLASTIC_WORM_FACT,
      TADPOLE_FACT,
      SHRIMP_FACT,
      HERON_FACT,
      GHOST_NET_FACT,
      PUNTING_POLE_FACT,
      GARTER_SNAKE_FACT,
      WATER_HYACINTH_FACT,
      CRAYFISH_FACT,
      STALACTITE_FACT,
      GEYSER_FACT,
      UNDERWATER_SPRINGS_FACT,
    ]);
  });

  it('names the tilapia, the carp, the ghost net and the punting pole for Area 4, from its data or its zone', () => {
    expect(threatIds(CHINAMPA_LAYOUT)).toEqual(['tilapia', 'carp', 'ghost-net', 'punting-pole']);
    expect(threatIds(buildZone(CHINAMPA_LAYOUT, DEFAULT_ZONE_SEED))).toEqual(['tilapia', 'carp', 'ghost-net', 'punting-pole']);
    expect(threatFactCards(CHINAMPA_LAYOUT)).toEqual([TILAPIA_FACT, CARP_FACT, GHOST_NET_FACT, PUNTING_POLE.fact]);
  });

  it('names the tilapia, the heron, the carp and the plastic worm for Area 3, from its data or its zone', () => {
    expect(threatIds(POND_2_LAYOUT)).toEqual(['tilapia', 'heron', 'carp', 'plastic-worm']);
    expect(threatIds(buildZone(POND_2_LAYOUT, DEFAULT_ZONE_SEED))).toEqual(['tilapia', 'heron', 'carp', 'plastic-worm']);
    expect(threatFactCards(POND_2_LAYOUT)).toEqual([TILAPIA_FACT, HERON_FACT, CARP_FACT, PLASTIC_WORM_FACT]);
  });

  it('names the tilapia, the carp and the plastic worm for the pond, from its data or its zone', () => {
    expect(threatIds(POND_LAYOUT)).toEqual(['tilapia', 'carp', 'plastic-worm']);
    expect(threatIds(buildZone(POND_LAYOUT, DEFAULT_ZONE_SEED))).toEqual(['tilapia', 'carp', 'plastic-worm']);
    expect(threatFactCards(POND_LAYOUT)).toEqual([TILAPIA_FACT, CARP_FACT, PLASTIC_WORM_FACT]);
  });

  it('gives fact cards in area-table order, each once', () => {
    const areas = [
      areaWith('one', 1, layoutWith({ hazards: [glassAt('glass-0')] })),
      areaWith('two', 2, layoutWith({ tilapiaRoutes: [], predatorRoutes: [pikeRoute('pike-0')], hazards: [glassAt('glass-0')] })),
    ];
    expect(areaFactCards(areas)).toEqual([TILAPIA_FACT, TEST_GLASS.fact, TEST_PIKE.fact]);
  });
});

describe('sourceFactCards', () => {
  it('gives the threat cards, then each element type that carries a card, each id once', () => {
    const layout = layoutWith({
      predatorRoutes: [pikeRoute('pike-0')],
      hazards: [glassAt('glass-0')],
      elements: [
        elementOf('gate-0', TEST_GATE),
        elementOf('mats-0', TEST_MATS),
        elementOf('lock-0', TEST_LOCK),
        elementOf('mats-1', TEST_MATS),
      ],
    });
    expect(sourceFactCards(layout)).toEqual({
      ids: ['tilapia', 'test-pike', 'test-glass', 'test-mats', 'test-lock'],
      cards: [TILAPIA_FACT, TEST_PIKE.fact, TEST_GLASS.fact, TEST_MATS.fact, TEST_LOCK.fact],
    });
  });

  it('puts the moving hazard cards after the still hazard cards and before the element cards', () => {
    const layout = layoutWith({
      hazards: [glassAt('glass-0')],
      movingHazards: [ramAt('ram-0')],
      elements: [elementOf('mats-0', TEST_MATS)],
    });
    expect(sourceFactCards(layout)).toEqual({
      ids: ['tilapia', 'test-glass', 'test-ram', 'test-mats'],
      cards: [TILAPIA_FACT, TEST_GLASS.fact, TEST_RAM.fact, TEST_MATS.fact],
    });
  });

  it('puts the snack type cards after the element cards, tadpole first (ND-29), from its data or its zone', () => {
    const layout = layoutWith({
      movingHazards: [ramAt('ram-0')],
      elements: [elementOf('mats-0', TEST_MATS)],
      mobileSnacks: SHRIMP_THEN_TADPOLES,
    });
    const expected = {
      ids: ['tilapia', 'test-ram', 'test-mats', 'tadpole', 'shrimp'],
      cards: [TILAPIA_FACT, TEST_RAM.fact, TEST_MATS.fact, TADPOLE_FACT, SHRIMP_FACT],
    };
    expect(sourceFactCards(layout)).toEqual(expected);
    expect(sourceFactCards(buildZone(layout, DEFAULT_ZONE_SEED))).toEqual(expected);
  });

  it('gives a snack type card only for the snack types the area has', () => {
    expect(sourceFactCards(layoutWith({ mobileSnacks: TADPOLES_ONLY })).ids).toEqual(['tilapia', 'tadpole']);
    expect(sourceFactCards(layoutWith({ mobileSnacks: SHRIMP_ONLY })).ids).toEqual(['tilapia', 'shrimp']);
    expect(sourceFactCards(layoutWith({ mobileSnacks: mobileSnackMix({ wanders: [], homes: [] }) })).ids).toEqual(['tilapia']);
  });

  it('puts each area\'s snack type cards after its element cards, in area-table order, each once', () => {
    const areas = [
      areaWith('one', 1, layoutWith({ mobileSnacks: SHRIMP_ONLY })),
      areaWith('two', 2, layoutWith({ elements: [elementOf('mats-0', TEST_MATS)], mobileSnacks: SHRIMP_THEN_TADPOLES })),
    ];
    expect(areaFactCards(areas)).toEqual([TILAPIA_FACT, SHRIMP_FACT, TEST_MATS.fact, TADPOLE_FACT]);
    expect(bookFactCards(areas)).toEqual([
      TILAPIA_FACT,
      SHRIMP_FACT,
      TEST_MATS.fact,
      TADPOLE_FACT,
      AXOLOTL_REFUGES_FACT,
      CANAL_CLEAN_UPS_FACT,
    ]);
  });

  it('keeps an element card out when a threat has its id', () => {
    const shadow: ElementType = { ...TEST_MATS, id: 'test-glass', fact: testFact('shadow-glass') };
    const layout = layoutWith({ hazards: [glassAt('glass-0')], elements: [elementOf('shadow-0', shadow)] });
    expect(sourceFactCards(layout)).toEqual({ ids: ['tilapia', 'test-glass'], cards: [TILAPIA_FACT, TEST_GLASS.fact] });
  });

  it('gives no element card for elements with none', () => {
    const layout = layoutWith({ tilapiaRoutes: [], elements: [elementOf('gate-0', TEST_GATE)] });
    expect(sourceFactCards(layout)).toEqual({ ids: [], cards: [] });
  });

  it.each(AREAS.filter((area) => area.layout.elements.length === 0 && area.layout.mobileSnacks === undefined).map((area) => [area.id, area] as const))('gives the threat cards alone for %s, which has no elements and no mobile snacks, from its data or its zone', (_id, area) => {
    const expected = { ids: threatIds(area.layout), cards: threatFactCards(area.layout) };
    expect(sourceFactCards(area.layout)).toEqual(expected);
    expect(sourceFactCards(buildZone(area.layout, DEFAULT_ZONE_SEED))).toEqual(expected);
  });

  it('gives Area 2 its threat cards, then the tadpole and shrimp cards, from its data or its zone', () => {
    const expected = {
      ids: ['tilapia', 'carp', 'plastic-worm', 'tadpole', 'shrimp'],
      cards: [TILAPIA_FACT, CARP_FACT, PLASTIC_WORM_FACT, TADPOLE_FACT, SHRIMP_FACT],
    };
    expect(sourceFactCards(POND_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(buildZone(POND_LAYOUT, DEFAULT_ZONE_SEED))).toEqual(expected);
  });

  it('puts each area\'s element cards after its threat cards, in area-table order, each once', () => {
    const areas = [
      areaWith('one', 1, layoutWith({ elements: [elementOf('mats-0', TEST_MATS)] })),
      areaWith('two', 2, layoutWith({ hazards: [glassAt('glass-0')], elements: [elementOf('lock-0', TEST_LOCK), elementOf('mats-0', TEST_MATS)] })),
    ];
    expect(areaFactCards(areas)).toEqual([TILAPIA_FACT, TEST_MATS.fact, TEST_GLASS.fact, TEST_LOCK.fact]);
    expect(bookFactCards(areas)).toEqual([
      TILAPIA_FACT,
      TEST_MATS.fact,
      TEST_GLASS.fact,
      TEST_LOCK.fact,
      AXOLOTL_REFUGES_FACT,
      CANAL_CLEAN_UPS_FACT,
    ]);
  });

  it('leaves newThingsByArea counting threats and elements apart', () => {
    const areas = [areaWith('one', 1, layoutWith({ elements: [elementOf('mats-0', TEST_MATS)] }))];
    expect(newThingsByArea(areas)).toEqual([{ areaId: 'one', threats: ['tilapia'], elements: ['test-mats'] }]);
  });
});

describe('bookFactCards', () => {
  it('gives the shipped area cards, then the axolotl refuges and canal clean-ups cards', () => {
    expect(bookFactCards()).toEqual([
      TILAPIA_FACT,
      CARP_FACT,
      PLASTIC_WORM_FACT,
      TADPOLE_FACT,
      SHRIMP_FACT,
      HERON_FACT,
      GHOST_NET_FACT,
      PUNTING_POLE_FACT,
      GARTER_SNAKE_FACT,
      WATER_HYACINTH_FACT,
      CRAYFISH_FACT,
      STALACTITE_FACT,
      GEYSER_FACT,
      UNDERWATER_SPRINGS_FACT,
      AXOLOTL_REFUGES_FACT,
      CANAL_CLEAN_UPS_FACT,
    ]);
  });

  it('puts the refuge cards after the given areas cards', () => {
    const areas = [areaWith('one', 1, layoutWith({ hazards: [glassAt('glass-0')] }))];
    expect(bookFactCards(areas)).toEqual([TILAPIA_FACT, TEST_GLASS.fact, AXOLOTL_REFUGES_FACT, CANAL_CLEAN_UPS_FACT]);
    expect(bookFactCards([])).toEqual([AXOLOTL_REFUGES_FACT, CANAL_CLEAN_UPS_FACT]);
  });
});

describe('newThingsByArea', () => {
  it('lets every area in AREAS add at most one new threat and one new element (PRD N2)', () => {
    expect(newThingsByArea().map((things) => things.areaId)).toEqual(AREAS.map((area) => area.id));
    expect(areasOverNewLimit(AREAS)).toEqual([]);
  });

  it('counts the canal tilapia as new in Area 1, the plastic worm in Area 2, the heron in Area 3, with no timing element (#111), the ghost net in Area 4, the garter snake and the water hyacinth mats in Area 5, the crayfish and the glow-plant in Area 6, and the pulsing current and the pebble in Area 7', () => {
    expect(newThingsByArea()).toEqual([
      { areaId: 'canal', threats: ['tilapia'], elements: [] },
      { areaId: 'pond-1', threats: ['plastic-worm'], elements: [] },
      { areaId: 'pond-2', threats: ['heron'], elements: [] },
      { areaId: 'chinampa-1', threats: ['ghost-net'], elements: [] },
      { areaId: 'chinampa-2', threats: ['garter-snake'], elements: ['water-hyacinth'] },
      { areaId: 'spring-cave-1', threats: ['crayfish'], elements: ['glow-plant'] },
      { areaId: 'spring-cave-2', threats: ['pulsing-current'], elements: ['pebble'] },
    ]);
  });

  it('does not count carried-forward threats and elements as new', () => {
    const areas = [
      areaWith('one', 1, layoutWith({ hazards: [], elements: [{ id: 'gate-0', type: TEST_GATE, offset: 0 }] })),
      areaWith(
        'two',
        2,
        layoutWith({
          hazards: [glassAt('glass-0')],
          elements: [
            { id: 'gate-0', type: TEST_GATE, offset: 0 },
            { id: 'gate-1', type: TEST_GATE, offset: 1 },
          ],
        }),
      ),
    ];
    expect(newThingsByArea(areas)).toEqual([
      { areaId: 'one', threats: ['tilapia'], elements: ['test-gate'] },
      { areaId: 'two', threats: ['test-glass'], elements: [] },
    ]);
    expect(areasOverNewLimit(areas)).toEqual([]);
  });

  it('leaves the carp, every moving hazard type and both snack types out of the count (ND-13, ND-27)', () => {
    const areas = [
      CANAL_AREA,
      areaWith(
        'danger-parts',
        2,
        layoutWith({
          predatorRoutes: [carpRoute('carp-0')],
          hazards: [glassAt('glass-0')],
          movingHazards: [ramAt('ram-0'), ramAt('oar-0', TEST_OAR)],
          elements: [elementOf('mats-0', TEST_MATS)],
          mobileSnacks: SHRIMP_THEN_TADPOLES,
        }),
      ),
    ];
    expect(newThingsByArea(areas)).toEqual([
      { areaId: 'canal', threats: ['tilapia'], elements: [] },
      { areaId: 'danger-parts', threats: ['test-glass'], elements: ['test-mats'] },
    ]);
    expect(areasOverNewLimit(areas)).toEqual([]);
    expect(threatIds(areas[1].layout)).toEqual(['tilapia', 'carp', 'test-glass', 'test-ram', 'test-oar']);
    expect(sourceFactCards(areas[1].layout).ids).toEqual(['tilapia', 'carp', 'test-glass', 'test-ram', 'test-oar', 'test-mats', 'tadpole', 'shrimp']);
  });

  it('still counts a species that is not marked a danger part', () => {
    const areas = [areaWith('pike', 1, layoutWith({ predatorRoutes: [pikeRoute('pike-0'), carpRoute('carp-0')] }))];
    expect(newThingsByArea(areas)).toEqual([{ areaId: 'pike', threats: ['tilapia', 'test-pike'], elements: [] }]);
  });

  it('detects an area that adds two new threats or two new elements', () => {
    const areas = [
      CANAL_AREA,
      areaWith('two-threats', 2, layoutWith({ predatorRoutes: [pikeRoute('pike-0')], hazards: [glassAt('glass-0')] })),
      areaWith(
        'two-elements',
        3,
        layoutWith({
          elements: [
            { id: 'gate-0', type: TEST_GATE, offset: 0 },
            { id: 'tide-0', type: TEST_TIDE, offset: 0 },
          ],
        }),
      ),
    ];
    expect(areasOverNewLimit(areas).map((things) => things.areaId)).toEqual(['two-threats', 'two-elements']);
  });
});

describe('unlocking', () => {
  const canalBeaten: AreaStarsRecord = { canal: EXIT_ONLY };

  it('treats an area as beaten only when its exit star is recorded', () => {
    expect(isAreaBeaten({}, 'canal')).toBe(false);
    expect(isAreaBeaten({ canal: NO_STARS }, 'canal')).toBe(false);
    expect(isAreaBeaten({ canal: SPECIAL_ONLY }, 'canal')).toBe(false);
    expect(isAreaBeaten(canalBeaten, 'canal')).toBe(true);
  });

  it('always unlocks area 1', () => {
    expect(unlockedAreaIds({})).toEqual(['canal']);
    expect(unlockedAreaIds({}, TWO_AREAS)).toEqual(['canal']);
    expect(isAreaUnlocked({}, 'canal', TWO_AREAS)).toBe(true);
  });

  it('unlocks area 2 when area 1 is beaten, with no star gates', () => {
    expect(isAreaUnlocked({}, TEST_ID, TWO_AREAS)).toBe(false);
    expect(isAreaUnlocked({ canal: SPECIAL_ONLY }, TEST_ID, TWO_AREAS)).toBe(false);
    expect(unlockedAreaIds(canalBeaten, TWO_AREAS)).toEqual(['canal', TEST_ID]);
    expect(isAreaUnlocked(canalBeaten, TEST_ID, TWO_AREAS)).toBe(true);
  });

  it('never unlocks an unknown area', () => {
    expect(isAreaUnlocked(canalBeaten, UNKNOWN_ID, TWO_AREAS)).toBe(false);
    expect(isAreaUnlocked(canalBeaten, UNKNOWN_ID)).toBe(false);
  });

  it('unlocks the pond after the canal in the shipped areas', () => {
    expect(unlockedAreaIds({})).toEqual(['canal']);
    expect(isAreaUnlocked({}, POND_AREA_ID)).toBe(false);
    expect(isAreaUnlocked({ canal: SPECIAL_ONLY }, POND_AREA_ID)).toBe(false);
    expect(unlockedAreaIds(canalBeaten)).toEqual(['canal', POND_AREA_ID]);
    expect(isAreaUnlocked(canalBeaten, POND_AREA_ID)).toBe(true);
    expect(newestUnlockedAreaId(canalBeaten)).toBe(POND_AREA_ID);
    expect(isNewArea(canalBeaten, POND_AREA_ID)).toBe(true);
    expect(isNewArea({ canal: EXIT_ONLY, [POND_AREA_ID]: EXIT_ONLY }, POND_AREA_ID)).toBe(false);
    expect(unlockedAreaIds({ [POND_AREA_ID]: ALL_STARS })).toEqual(['canal']);
  });

  it('unlocks Area 3 once the pond is beaten, with no star gates, in the shipped areas', () => {
    const pondBeaten: AreaStarsRecord = { canal: EXIT_ONLY, [POND_AREA_ID]: EXIT_ONLY };
    expect(isAreaUnlocked(canalBeaten, POND_2_AREA_ID)).toBe(false);
    expect(isAreaUnlocked({ canal: ALL_STARS, [POND_AREA_ID]: SPECIAL_ONLY }, POND_2_AREA_ID)).toBe(false);
    expect(unlockedAreaIds(pondBeaten)).toEqual(['canal', POND_AREA_ID, POND_2_AREA_ID]);
    expect(isAreaUnlocked(pondBeaten, POND_2_AREA_ID)).toBe(true);
    expect(newestUnlockedAreaId(pondBeaten)).toBe(POND_2_AREA_ID);
    expect(isNewArea(pondBeaten, POND_2_AREA_ID)).toBe(true);
    expect(isNewArea({ ...pondBeaten, [POND_2_AREA_ID]: EXIT_ONLY }, POND_2_AREA_ID)).toBe(false);
    expect(unlockedAreaIds({ ...pondBeaten, [POND_2_AREA_ID]: SPECIAL_ONLY })).toEqual(['canal', POND_AREA_ID, POND_2_AREA_ID]);
    expect(unlockedAreaIds({ canal: EXIT_ONLY, [POND_2_AREA_ID]: ALL_STARS })).toEqual(['canal', POND_AREA_ID]);
    expect(resolveAreaId(POND_2_AREA_ID, canalBeaten)).toBe(POND_AREA_ID);
    expect(resolveAreaId(POND_2_AREA_ID, pondBeaten)).toBe(POND_2_AREA_ID);
  });

  it('unlocks Area 4 once Area 3 is beaten, with no new rule and no star gates, in the shipped areas', () => {
    const pondBeaten: AreaStarsRecord = { canal: EXIT_ONLY, [POND_AREA_ID]: EXIT_ONLY };
    const area3Beaten: AreaStarsRecord = { ...pondBeaten, [POND_2_AREA_ID]: EXIT_ONLY };
    expect(isAreaUnlocked(pondBeaten, CHINAMPA_AREA_ID)).toBe(false);
    expect(isAreaUnlocked({ ...pondBeaten, [POND_2_AREA_ID]: SPECIAL_ONLY }, CHINAMPA_AREA_ID)).toBe(false);
    expect(unlockedAreaIds(area3Beaten)).toEqual(['canal', POND_AREA_ID, POND_2_AREA_ID, CHINAMPA_AREA_ID]);
    expect(isAreaUnlocked(area3Beaten, CHINAMPA_AREA_ID)).toBe(true);
    expect(newestUnlockedAreaId(area3Beaten)).toBe(CHINAMPA_AREA_ID);
    expect(isNewArea(area3Beaten, CHINAMPA_AREA_ID)).toBe(true);
    expect(isNewArea({ ...area3Beaten, [CHINAMPA_AREA_ID]: EXIT_ONLY }, CHINAMPA_AREA_ID)).toBe(false);
    expect(unlockedAreaIds({ ...area3Beaten, [CHINAMPA_AREA_ID]: ALL_STARS })).toEqual(['canal', POND_AREA_ID, POND_2_AREA_ID, CHINAMPA_AREA_ID, CHINAMPA_2_AREA_ID]);
    expect(unlockedAreaIds({ ...pondBeaten, [CHINAMPA_AREA_ID]: ALL_STARS })).toEqual(['canal', POND_AREA_ID, POND_2_AREA_ID]);
    expect(resolveAreaId(CHINAMPA_AREA_ID, pondBeaten)).toBe(POND_2_AREA_ID);
    expect(resolveAreaId(CHINAMPA_AREA_ID, area3Beaten)).toBe(CHINAMPA_AREA_ID);
  });

  it('unlocks Area 5 once Area 4 is beaten, with no new rule and no star gates, in the shipped areas', () => {
    const area3Beaten: AreaStarsRecord = { canal: EXIT_ONLY, [POND_AREA_ID]: EXIT_ONLY, [POND_2_AREA_ID]: EXIT_ONLY };
    const area4Beaten: AreaStarsRecord = { ...area3Beaten, [CHINAMPA_AREA_ID]: EXIT_ONLY };
    const firstFour = ['canal', POND_AREA_ID, POND_2_AREA_ID, CHINAMPA_AREA_ID];
    expect(isAreaUnlocked(area3Beaten, CHINAMPA_2_AREA_ID)).toBe(false);
    expect(isAreaUnlocked({ ...area3Beaten, [CHINAMPA_AREA_ID]: SPECIAL_ONLY }, CHINAMPA_2_AREA_ID)).toBe(false);
    expect(unlockedAreaIds(area4Beaten)).toEqual([...firstFour, CHINAMPA_2_AREA_ID]);
    expect(isAreaUnlocked(area4Beaten, CHINAMPA_2_AREA_ID)).toBe(true);
    expect(newestUnlockedAreaId(area4Beaten)).toBe(CHINAMPA_2_AREA_ID);
    expect(isNewArea(area4Beaten, CHINAMPA_2_AREA_ID)).toBe(true);
    expect(isNewArea({ ...area4Beaten, [CHINAMPA_2_AREA_ID]: EXIT_ONLY }, CHINAMPA_2_AREA_ID)).toBe(false);
    expect(unlockedAreaIds({ ...area4Beaten, [CHINAMPA_2_AREA_ID]: ALL_STARS })).toEqual([...firstFour, CHINAMPA_2_AREA_ID, SPRING_CAVE_AREA_ID]);
    expect(unlockedAreaIds({ ...area3Beaten, [CHINAMPA_2_AREA_ID]: ALL_STARS })).toEqual(firstFour);
    expect(resolveAreaId(CHINAMPA_2_AREA_ID, area3Beaten)).toBe(CHINAMPA_AREA_ID);
    expect(resolveAreaId(CHINAMPA_2_AREA_ID, area4Beaten)).toBe(CHINAMPA_2_AREA_ID);
  });

  it('unlocks Area 6 once Area 5 is beaten, with no new rule and no star gates, in the shipped areas (issue #77)', () => {
    const area4Beaten: AreaStarsRecord = { canal: EXIT_ONLY, [POND_AREA_ID]: EXIT_ONLY, [POND_2_AREA_ID]: EXIT_ONLY, [CHINAMPA_AREA_ID]: EXIT_ONLY };
    const area5Beaten: AreaStarsRecord = { ...area4Beaten, [CHINAMPA_2_AREA_ID]: EXIT_ONLY };
    const firstFive = ['canal', POND_AREA_ID, POND_2_AREA_ID, CHINAMPA_AREA_ID, CHINAMPA_2_AREA_ID];
    expect(isAreaUnlocked(area4Beaten, SPRING_CAVE_AREA_ID)).toBe(false);
    expect(isAreaUnlocked({ ...area4Beaten, [CHINAMPA_2_AREA_ID]: SPECIAL_ONLY }, SPRING_CAVE_AREA_ID)).toBe(false);
    expect(unlockedAreaIds(area5Beaten)).toEqual([...firstFive, SPRING_CAVE_AREA_ID]);
    expect(isAreaUnlocked(area5Beaten, SPRING_CAVE_AREA_ID)).toBe(true);
    expect(newestUnlockedAreaId(area5Beaten)).toBe(SPRING_CAVE_AREA_ID);
    expect(isNewArea(area5Beaten, SPRING_CAVE_AREA_ID)).toBe(true);
    expect(isNewArea({ ...area5Beaten, [SPRING_CAVE_AREA_ID]: EXIT_ONLY }, SPRING_CAVE_AREA_ID)).toBe(false);
    expect(unlockedAreaIds({ ...area5Beaten, [SPRING_CAVE_AREA_ID]: ALL_STARS })).toEqual([...firstFive, SPRING_CAVE_AREA_ID, SPRING_CAVE_2_AREA_ID]);
    expect(unlockedAreaIds({ ...area4Beaten, [SPRING_CAVE_AREA_ID]: ALL_STARS })).toEqual(firstFive);
    expect(resolveAreaId(SPRING_CAVE_AREA_ID, area4Beaten)).toBe(CHINAMPA_2_AREA_ID);
    expect(resolveAreaId(SPRING_CAVE_AREA_ID, area5Beaten)).toBe(SPRING_CAVE_AREA_ID);
  });

  it('unlocks Area 7 once Area 6 is beaten, with no new rule and no star gates, in the shipped areas (issue #105)', () => {
    const area5Beaten: AreaStarsRecord = {
      canal: EXIT_ONLY,
      [POND_AREA_ID]: EXIT_ONLY,
      [POND_2_AREA_ID]: EXIT_ONLY,
      [CHINAMPA_AREA_ID]: EXIT_ONLY,
      [CHINAMPA_2_AREA_ID]: EXIT_ONLY,
    };
    const area6Beaten: AreaStarsRecord = { ...area5Beaten, [SPRING_CAVE_AREA_ID]: EXIT_ONLY };
    const firstSix = ['canal', POND_AREA_ID, POND_2_AREA_ID, CHINAMPA_AREA_ID, CHINAMPA_2_AREA_ID, SPRING_CAVE_AREA_ID];
    expect(isAreaUnlocked(area5Beaten, SPRING_CAVE_2_AREA_ID)).toBe(false);
    expect(isAreaUnlocked({ ...area5Beaten, [SPRING_CAVE_AREA_ID]: SPECIAL_ONLY }, SPRING_CAVE_2_AREA_ID)).toBe(false);
    expect(unlockedAreaIds(area6Beaten)).toEqual([...firstSix, SPRING_CAVE_2_AREA_ID]);
    expect(newestUnlockedAreaId(area6Beaten)).toBe(SPRING_CAVE_2_AREA_ID);
    expect(isNewArea(area6Beaten, SPRING_CAVE_2_AREA_ID)).toBe(true);
    expect(isNewArea({ ...area6Beaten, [SPRING_CAVE_2_AREA_ID]: EXIT_ONLY }, SPRING_CAVE_2_AREA_ID)).toBe(false);
    expect(unlockedAreaIds({ ...area5Beaten, [SPRING_CAVE_2_AREA_ID]: ALL_STARS })).toEqual(firstSix);
    expect(resolveAreaId(SPRING_CAVE_2_AREA_ID, area5Beaten)).toBe(SPRING_CAVE_AREA_ID);
    expect(resolveAreaId(SPRING_CAVE_2_AREA_ID, area6Beaten)).toBe(SPRING_CAVE_2_AREA_ID);
  });

  it('names the newest unlocked area', () => {
    expect(newestUnlockedAreaId({}, TWO_AREAS)).toBe('canal');
    expect(newestUnlockedAreaId(canalBeaten, TWO_AREAS)).toBe(TEST_ID);
    expect(newestUnlockedAreaId({ canal: ALL_STARS, [TEST_ID]: EXIT_ONLY }, TWO_AREAS)).toBe(TEST_ID);
  });

  it('unlocks a run from area 1 that stops at the first area not beaten', () => {
    expect(unlockedAreaIds({ canal: EXIT_ONLY, [TEST_ID]: EXIT_ONLY }, THREE_AREAS)).toEqual([
      'canal',
      TEST_ID,
      THIRD_ID,
    ]);
    expect(unlockedAreaIds({ canal: EXIT_ONLY, [THIRD_ID]: EXIT_ONLY }, THREE_AREAS)).toEqual(['canal', TEST_ID]);
  });

  it('never unlocks past a locked area when a later area has stars', () => {
    const gap: AreaStarsRecord = { [TEST_ID]: EXIT_ONLY, [THIRD_ID]: ALL_STARS };
    expect(unlockedAreaIds(gap, THREE_AREAS)).toEqual(['canal']);
    expect(isAreaUnlocked(gap, TEST_ID, THREE_AREAS)).toBe(false);
    expect(isAreaUnlocked(gap, THIRD_ID, THREE_AREAS)).toBe(false);
    expect(newestUnlockedAreaId(gap, THREE_AREAS)).toBe('canal');
    expect(isNewArea(gap, 'canal', THREE_AREAS)).toBe(true);
    expect(resolveAreaId(THIRD_ID, gap, THREE_AREAS)).toBe('canal');
    expect(resolveAreaId(TEST_ID, gap, THREE_AREAS)).toBe('canal');
  });

  it('throws when there are no areas', () => {
    expect(() => newestUnlockedAreaId({}, [])).toThrow('no areas');
  });
});

describe('isNewArea', () => {
  it('marks the newest unlocked area while it has no stars', () => {
    expect(isNewArea({}, 'canal', TWO_AREAS)).toBe(true);
    expect(isNewArea({}, TEST_ID, TWO_AREAS)).toBe(false);
    expect(isNewArea({ canal: EXIT_ONLY }, 'canal', TWO_AREAS)).toBe(false);
    expect(isNewArea({ canal: EXIT_ONLY }, TEST_ID, TWO_AREAS)).toBe(true);
  });

  it('clears once the newest area has any star', () => {
    expect(isNewArea({ canal: EXIT_ONLY, [TEST_ID]: SPECIAL_ONLY }, TEST_ID, TWO_AREAS)).toBe(false);
    expect(isNewArea({ canal: SPECIAL_ONLY }, 'canal', TWO_AREAS)).toBe(false);
  });

  it('keeps Area 1 new in the shipped areas until it has a star', () => {
    expect(isNewArea({}, 'canal')).toBe(true);
    expect(isNewArea({ canal: EXIT_ONLY }, 'canal')).toBe(false);
  });
});

describe('resolveAreaId', () => {
  const canalBeaten: AreaStarsRecord = { canal: EXIT_ONLY };

  it('keeps a saved id that names an unlocked area', () => {
    expect(resolveAreaId('canal', canalBeaten, TWO_AREAS)).toBe('canal');
    expect(resolveAreaId(TEST_ID, canalBeaten, TWO_AREAS)).toBe(TEST_ID);
  });

  it('falls back to the newest unlocked area for a locked, unknown or malformed id', () => {
    expect(resolveAreaId(TEST_ID, {}, TWO_AREAS)).toBe('canal');
    expect(resolveAreaId(UNKNOWN_ID, canalBeaten, TWO_AREAS)).toBe(TEST_ID);
    for (const saved of [undefined, null, 7, {}, ['canal'], '']) {
      expect(resolveAreaId(saved, canalBeaten, TWO_AREAS)).toBe(TEST_ID);
    }
  });

  it('resolves to the canal, then the pond once the canal is beaten, in the shipped areas', () => {
    expect(resolveAreaId(undefined, {})).toBe('canal');
    expect(resolveAreaId(POND_AREA_ID, {})).toBe('canal');
    expect(resolveAreaId(TEST_ID, { canal: EXIT_ONLY })).toBe(POND_AREA_ID);
    expect(resolveAreaId('canal', { canal: EXIT_ONLY })).toBe('canal');
  });
});

describe('areaById', () => {
  it('finds the canal, the pond, Area 3, Area 4, Area 5 and Area 6 by id', () => {
    expect(areaById('canal')).toBe(CANAL_AREA);
    expect(areaById(POND_AREA_ID)).toBe(POND_AREA);
    expect(areaById(POND_2_AREA_ID)).toBe(POND_2_AREA);
    expect(areaById(CHINAMPA_AREA_ID)).toBe(CHINAMPA_AREA);
    expect(areaById(CHINAMPA_2_AREA_ID)).toBe(CHINAMPA_2_AREA);
    expect(areaById(SPRING_CAVE_AREA_ID)).toBe(SPRING_CAVE_AREA);
    expect(areaById(SPRING_CAVE_2_AREA_ID)).toBe(SPRING_CAVE_2_AREA);
  });

  it('returns undefined for an unknown id', () => {
    expect(areaById(UNKNOWN_ID)).toBeUndefined();
    expect(areaById('pond')).toBeUndefined();
    expect(areaById('chinampa')).toBeUndefined();
  });

  it('lists every area in number order', () => {
    expect(AREAS.map((area) => area.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(AREAS).toEqual([CANAL_AREA, POND_AREA, POND_2_AREA, CHINAMPA_AREA, CHINAMPA_2_AREA, SPRING_CAVE_AREA, SPRING_CAVE_2_AREA]);
  });
});

describe('exitOpen', () => {
  it('opens only when no snacks are left', () => {
    expect(exitOpen(0)).toBe(true);
    expect(exitOpen(1)).toBe(false);
    expect(exitOpen(16)).toBe(false);
  });
});

describe('atExit', () => {
  const exit = { x: 100, y: 100, radius: 40 };

  it('is true inside and exactly on the edge', () => {
    expect(atExit({ x: 100, y: 100 }, exit)).toBe(true);
    expect(atExit({ x: 140, y: 100 }, exit)).toBe(true);
  });

  it('is false just beyond the edge', () => {
    expect(atExit({ x: 140.01, y: 100 }, exit)).toBe(false);
  });
});

describe('exitContact', () => {
  it.each([
    [false, false, 0, 'none'],
    [true, false, 0, 'none'],
    [false, true, 0, 'beat'],
    [true, true, 0, 'beat'],
    [false, false, 3, 'none'],
    [true, false, 3, 'none'],
    [false, true, 3, 'closed'],
    [true, true, 3, 'none'],
    [false, true, 1, 'closed'],
  ] as const)('was %s, now %s, %i left gives %s', (wasAtExit, atExitNow, left, expected) => {
    expect(exitContact(wasAtExit, atExitNow, left)).toBe(expected);
  });
});

const AREA_CASES = AREAS.map((area) => [area.id, area] as const);
const AREA_SEED_CASES = AREAS.flatMap((area) => ALL_SEEDS.map((seed) => [area.id, seed, area] as const));

describe.each(AREA_CASES)('%s exit geometry', (_id, area) => {
  const { exit } = area;

  it('sits inside the swim bounds', () => {
    const bounds = swimBounds(buildZone(area.layout, DEFAULT_ZONE_SEED));
    expect(exit.x).toBeGreaterThanOrEqual(bounds.minX);
    expect(exit.x).toBeLessThanOrEqual(bounds.maxX);
    expect(exit.y).toBeGreaterThanOrEqual(bounds.minY);
    expect(exit.y).toBeLessThanOrEqual(bounds.maxY);
  });

  it.each(ALL_SEEDS)('is outside the safe area and clear of the Home Spot ring for seed %i', (seed) => {
    const zone = buildZone(area.layout, seed);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
    const fromHome = Math.hypot(exit.x - zone.homeSpot.x, exit.y - zone.homeSpot.y);
    expect(fromHome).toBeGreaterThan(zone.homeSpot.radius + exit.radius);
  });

  it.each(ALL_SEEDS)('is clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    const clearance = exit.radius + FINDS.pickupRadius;
    for (const spot of buildZone(area.layout, seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y)).toBeGreaterThanOrEqual(clearance);
    }
  });
});

describe('snack drift', () => {
  const surfacePeak = SURF + 1.6 + 0.8;

  it('pins the canal drift at about 11.9 px/s, the pond drift at about 14.8 px/s, the Area 3 drift at about 15.2 px/s, the Area 4 drift at about 15.6 px/s, the Area 5 drift at about 15.8 px/s, the Area 6 drift at about 16.0 px/s and the Area 7 drift at about 16.2 px/s', () => {
    expect(snackDriftMaxSpeed(CANAL_AREA.snackDrift)).toBeCloseTo(11.9, 1);
    expect(snackDriftMaxSpeed(POND_AREA.snackDrift)).toBeCloseTo(14.8, 1);
    expect(snackDriftMaxSpeed(POND_2_AREA.snackDrift)).toBeCloseTo(15.2, 1);
    expect(snackDriftMaxSpeed(CHINAMPA_AREA.snackDrift)).toBeCloseTo(15.6, 1);
    expect(snackDriftMaxSpeed(CHINAMPA_2_AREA.snackDrift)).toBeCloseTo(15.8, 1);
    expect(snackDriftMaxSpeed(SPRING_CAVE_AREA.snackDrift)).toBeCloseTo(16.0, 1);
    expect(snackDriftMaxSpeed(SPRING_CAVE_2_AREA.snackDrift)).toBeCloseTo(16.2, 1);
  });

  it('pins the one-leg headway against the strongest steady current: 20 px/s in the canal and the pond, 16 in Area 3, 18 in Area 4, 17 in Areas 5 to 7', () => {
    const headways = AREAS.map((area) => SWIM.maxSpeed * LEGS.speedByLegs[0] - strongestCurrentIn(area));
    expect(headways).toEqual([20, 20, 16, 18, 17, 17, 17]);
  });

  it.each(AREA_CASES)('drifts slower than a one-leg axolotl swims against the strongest current, and at most 20 px/s, in %s', (_id, area) => {
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - strongestCurrentIn(area);
    expect(oneLegNet).toBeGreaterThan(0);
    expect(snackDriftMaxSpeed(area.snackDrift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(area.snackDrift)).toBeLessThanOrEqual(MAX_SNACK_DRIFT);
  });

  it('drifts each later area at least as fast as the one before it', () => {
    const speeds = AREAS.map((area) => snackDriftMaxSpeed(area.snackDrift));
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i], AREAS[i].id).toBeGreaterThan(speeds[i - 1]);
    }
  });

  it.each(AREA_SEED_CASES)('keeps every %s snack in the water, in reach and out of the ring for seed %i', (_id, seed, area) => {
    const zone = buildZone(area.layout, seed);
    const bounds = swimBounds(zone);
    const items = createCollectibles(zone.collectibles);
    for (let t = 0; t <= 120; t += 0.25) {
      for (let index = 0; index < items.length; index++) {
        const snack = {
          x: snackX(items[index], index, t, area.snackDrift, bounds),
          y: snackY(items[index], index, t, area.snackDrift, bounds),
        };
        expect(snack.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(snack.x).toBeLessThanOrEqual(bounds.maxX);
        expect(snack.y).toBeGreaterThanOrEqual(bounds.minY);
        expect(snack.y).toBeLessThanOrEqual(bounds.maxY);
        expect(snack.y).toBeGreaterThan(surfacePeak);
        expect(inHomeSpot(snack, zone.homeSpot)).toBe(false);
      }
    }
  }, 30_000);
});

describe('Legendary treasures by area (issue #146)', () => {
  const legendaryIds = (area: Readonly<AreaData>): string[] =>
    area.layout.treasures.filter((treasure) => treasure.rarity === 'legendary').map((treasure) => treasure.id);

  it('keeps exactly 1 Legendary in the canal, the Sun pyramid, 3 in each of Areas 2 to 7, the last of Areas 6 and 7 a Paint shell', () => {
    expect(legendaryIds(CANAL_AREA)).toEqual(['canal/sun-pyramid']);
    expect(legendaryIds(POND_AREA)).toEqual(['pond/rainbow-dragonfly-wings', 'pond/froggy-boots', 'canal/golden-bow']);
    expect(legendaryIds(POND_2_AREA)).toEqual(['pond/golden-lotus-throne', 'pond/firefly-cape', 'canal/paint-shell-galaxy']);
    expect(legendaryIds(CHINAMPA_AREA)).toEqual(['chinampa/golden-corn', 'chinampa/monarch-wings', 'canal/paint-shell-rainbow']);
    expect(legendaryIds(CHINAMPA_2_AREA)).toEqual([
      'chinampa/alebrije-statue',
      'chinampa/rainbow-serape-cape',
      'canal/paint-shell-tie-dye-galaxy',
    ]);
    expect(legendaryIds(SPRING_CAVE_AREA)).toEqual([
      'spring-cave/crystal-arch',
      'spring-cave/crystal-crown',
      'spring-cave/paint-shell-crystal-shine',
    ]);
    expect(legendaryIds(SPRING_CAVE_2_AREA)).toEqual([
      'spring-cave/underground-waterfall',
      'spring-cave/gemstone-cape',
      'spring-cave/paint-shell-glowworm',
    ]);
  });

  it('gives every area from Area 6 on at least 2 Paint shells, at least 1 of them a Legendary patterned or sheen Dream colour', () => {
    const laterAreas = AREAS.filter((area) => area.number >= 6);
    expect(laterAreas.length).toBeGreaterThan(0);
    for (const area of laterAreas) {
      const shells = area.layout.treasures.filter((treasure) => treasure.category === 'paintShell');
      expect(shells.length, area.id).toBeGreaterThanOrEqual(2);
      const legendaryFancy = shells.filter((shell) => {
        const kind = dreamColourById(shell.dreamColour)?.kind;
        return shell.rarity === 'legendary' && (kind === 'patterned' || kind === 'sheen');
      });
      expect(legendaryFancy.length, area.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('puts each catalogue treasure in exactly one area', () => {
    const ids = AREAS.flatMap((area) => area.layout.treasures.map((treasure) => treasure.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ALL_TREASURES.map((treasure) => treasure.id).sort());
  });

  it.each(AREAS.map((area) => [area.id, area] as const))(
    'gives every %s Legendary a pool with a spot free for each Legendary, and keeps every Dash pot a Legendary spot',
    (_id, area) => {
      for (const seed of [DEFAULT_ZONE_SEED, 1, 2, 3]) {
        const zone = buildZone(area.layout, seed);
        const ids = legendaryIds(area);
        for (const id of ids) {
          const pool = zone.finds.find((find) => find.id === id)?.pool ?? [];
          expect(pool.length, id).toBeGreaterThanOrEqual(ids.length);
        }
        for (const spot of zone.spots.filter((candidate) => candidate.container)) {
          expect(spot.rarity, spot.id).toBe('legendary');
        }
      }
    },
  );

  it.each(AREAS.filter((area) => area.number <= 5).map((area) => [area.id, area] as const))(
    'hides every %s Legendary only in Dash pots',
    (_id, area) => {
      for (const seed of [DEFAULT_ZONE_SEED, 1, 2, 3]) {
        const zone = buildZone(area.layout, seed);
        const spots = new Map(zone.spots.map((spot) => [spot.id, spot]));
        for (const id of legendaryIds(area)) {
          const pool = zone.finds.find((find) => find.id === id)?.pool ?? [];
          for (const spotId of pool) {
            expect(spots.get(spotId)?.container, `${id} at ${spotId}`).toBe(true);
          }
        }
      }
    },
  );
});
