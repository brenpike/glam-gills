import { afterEach, describe, expect, it, vi } from 'vitest';
import { AREAS, CANAL_AREA, areaById } from './areas';
import { CANAL_TREASURES, RARITIES, treasureById, type Rarity } from './catalogue';
import { DEV_AREAS, DEV_TEST_AREA } from './devAreas';
import { coversAt, distanceToPath, inCave, meetsRarity, pastCurrent, routeDistance, zoneThreats, type Threat } from './hiding';
import { axolotlFindId } from './morphs';
import {
  DEFAULT_TRIP_SEED,
  fallbackOrder,
  nextTripSeed,
  placeTreasures,
  rollSlotRarities,
  slotRarity,
  type PlacedFind,
  type PlacementOptions,
  type RarityCounts,
} from './placement';
import { createTrip } from './trip';
import {
  LEGS,
  RISK,
  TILAPIA,
  TRIP_TREASURES,
  TRIP_TREASURES_BY_AREA,
  tripTreasureTuning,
  type RiskTuning,
  type TripTreasureTuning,
} from './tuning';
import { buildCanalZone, buildZone, type HidingSpot, type TilapiaRoute, type ZoneLayout } from './zone';

const ALL_SEEDS = [0xa70107, 1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const TRIP_SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);
const SEEDS_300 = Array.from({ length: 300 }, (_, i) => i + 1);
const SEEDS_1000 = Array.from({ length: 1000 }, (_, i) => i + 1);
const SEEDS_2000 = Array.from({ length: 2000 }, (_, i) => i + 1);
const PER_TRIP = TRIP_TREASURES.slots;
const HALVES: Readonly<Record<Rarity, number>> = { common: 0.5, rare: 0.25, epic: 0.125, legendary: 0.125 };

function placeAll(
  zone: ZoneLayout,
  tripSeed: number,
  banked: readonly string[] = [],
  options?: PlacementOptions,
): PlacedFind[] {
  return placeTreasures(zone.finds, zone.spots, banked, tripSeed, options);
}

function spotOf(zone: ZoneLayout, placed: PlacedFind): HidingSpot {
  const spot = zone.spots.find((candidate) => candidate.id === placed.spotId);
  if (spot === undefined) {
    throw new Error(`no spot ${placed.spotId}`);
  }
  return spot;
}

function rarityOf(id: string): Rarity {
  const rarity = treasureById(id)?.rarity;
  if (rarity === undefined) {
    throw new Error(`no treasure ${id}`);
  }
  return rarity;
}

function idsOfRarity(rarity: Rarity): string[] {
  return CANAL_TREASURES.filter((treasure) => treasure.rarity === rarity).map((treasure) => treasure.id);
}

function countByRarity(placements: readonly PlacedFind[]): RarityCounts {
  const counts: RarityCounts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const placed of placements) counts[rarityOf(placed.id)] += 1;
  return counts;
}

function counts(common: number, rare: number, epic: number, legendary: number): RarityCounts {
  return { common, rare, epic, legendary };
}

/**
 * The rarity count the slots should fill for a trip: each rolled slot takes its own rarity or the
 * first in its fallback order with a treasure left that its pool has room for. Assumes one pool
 * per rarity, as in the canal.
 */
function expectedSlotCounts(zone: ZoneLayout, banked: readonly string[], extras: readonly string[], tripSeed: number): RarityCounts {
  const left = counts(0, 0, 0, 0);
  for (const rarity of RARITIES) {
    const ofRarity = zone.finds.filter((find) => rarityOf(find.id) === rarity);
    const free = ofRarity.filter((find) => !banked.includes(find.id) && !extras.includes(find.id)).length;
    const room = (ofRarity[0]?.pool.length ?? 0) - extras.filter((id) => rarityOf(id) === rarity).length;
    left[rarity] = Math.min(free, room);
  }
  const filled = counts(0, 0, 0, 0);
  for (const slot of rollSlotRarities(TRIP_TREASURES, tripSeed)) {
    const rarity = [slot, ...fallbackOrder(slot)].find((candidate) => left[candidate] > 0);
    if (rarity === undefined) continue;
    filled[rarity] += 1;
    left[rarity] -= 1;
  }
  return filled;
}

/** Each placement's spot is in its own find's pool. */
function expectInOwnPools(zone: ZoneLayout, placements: readonly PlacedFind[]): void {
  const poolById = new Map(zone.finds.map((find) => [find.id, find.pool]));
  for (const placed of placements) {
    expect(poolById.get(placed.id), placed.id).toContain(placed.spotId);
  }
}

function usesAllHidingKinds(zone: ZoneLayout, placements: readonly PlacedFind[]): boolean {
  const covers = new Set(placements.flatMap((placed) => coversAt(placed, zone)));
  const kinds = ['reeds', 'pad', 'cave', 'pastCurrent'] as const;
  return kinds.every((kind) => covers.has(kind)) && placements.some((placed) => placed.container);
}

interface PlacedFacts {
  id: string;
  at: { x: number; y: number; container: boolean };
  sealed: boolean;
  meetsRarity: boolean;
  legendaryInDeepPot: boolean;
}

function placedFacts(zone: ZoneLayout, placed: PlacedFind): PlacedFacts {
  const rarity = rarityOf(placed.id);
  const deep = inCave(placed, zone.cave) || pastCurrent(placed, zone.currents);
  return {
    id: placed.id,
    at: { x: placed.x, y: placed.y, container: placed.container },
    sealed: placed.sealed,
    meetsRarity: meetsRarity(placed, rarity, zone),
    legendaryInDeepPot: rarity !== 'legendary' || (placed.container && deep),
  };
}

function expectedFacts(zone: ZoneLayout, placed: PlacedFind): PlacedFacts {
  const spot = spotOf(zone, placed);
  return {
    id: placed.id,
    at: { x: spot.x, y: spot.y, container: spot.container },
    sealed: spot.container,
    meetsRarity: true,
    legendaryInDeepPot: true,
  };
}

/** One assertion per layout: catalogue order, one treasure per spot, and each placement's spot, seal and rarity rules. */
function expectValidLayout(zone: ZoneLayout, placements: readonly PlacedFind[]): void {
  const ids = placements.map((placed) => placed.id);
  const placedIds = new Set(ids);
  expect({
    ids,
    spotCount: new Set(placements.map((placed) => placed.spotId)).size,
    facts: placements.map((placed) => placedFacts(zone, placed)),
  }).toEqual({
    ids: zone.finds.map((find) => find.id).filter((id) => placedIds.has(id)),
    spotCount: placements.length,
    facts: placements.map((placed) => expectedFacts(zone, placed)),
  });
}

function meanDistanceByRarity(zone: ZoneLayout, seeds: readonly number[], options: PlacementOptions): RarityCounts {
  const total = counts(0, 0, 0, 0);
  const seen = counts(0, 0, 0, 0);
  for (const seed of seeds) {
    for (const placed of placeAll(zone, seed, [], options)) {
      const rarity = rarityOf(placed.id);
      total[rarity] += distanceToPath(placed, zone.mainPath);
      seen[rarity] += 1;
    }
  }
  return counts(total.common / seen.common, total.rare / seen.rare, total.epic / seen.epic, total.legendary / seen.legendary);
}

function poolSpread(zone: ZoneLayout, rarity: Rarity): number {
  const distances = zone.spots.filter((spot) => spot.rarity === rarity).map((spot) => distanceToPath(spot, zone.mainPath));
  return Math.max(...distances) - Math.min(...distances);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('nextTripSeed', () => {
  it('is deterministic, a uint32 and differs from its input', () => {
    for (const seed of [0, 1, 42, DEFAULT_TRIP_SEED, 0xffffffff]) {
      const next = nextTripSeed(seed);
      expect(nextTripSeed(seed)).toBe(next);
      expect(Number.isInteger(next)).toBe(true);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThanOrEqual(0xffffffff);
      expect(next).not.toBe(seed);
    }
  });

  it('pins the default trip seed', () => {
    expect(DEFAULT_TRIP_SEED).toBe(0x7a1b5eed);
  });
});

describe('slotRarity', () => {
  it.each<[number, Rarity]>([
    [0, 'common'],
    [0.4999, 'common'],
    [0.5, 'rare'],
    [0.7499, 'rare'],
    [0.75, 'epic'],
    [0.8749, 'epic'],
    [0.875, 'legendary'],
    [0.9999, 'legendary'],
  ])('gives roll %f the rarity %s, Common then Rare then Epic, an edge going to the next rarity', (roll, rarity) => {
    expect(slotRarity(HALVES, roll)).toBe(rarity);
  });

  it('gives what is left to the rarest rarity with a chance above 0', () => {
    expect(slotRarity({ common: 0.5, rare: 0.25, epic: 0, legendary: 0 }, 0.9)).toBe('rare');
    expect(slotRarity({ common: 0.5, rare: 0, epic: 0.5, legendary: 0 }, 0.5)).toBe('epic');
    expect(slotRarity({ common: 1, rare: 0, epic: 0, legendary: 0 }, 0.9999)).toBe('common');
    expect(slotRarity(TRIP_TREASURES.chance, 0.9999)).toBe('legendary');
  });

  it('throws when no rarity has a chance', () => {
    expect(() => slotRarity({ common: 0, rare: 0, epic: 0, legendary: 0 }, 0.5)).toThrow('no rarity has a chance');
  });
});

describe('rollSlotRarities', () => {
  it.each([1, 3, 6, 10])('rolls exactly %i slots', (slots) => {
    for (const seed of TRIP_SEEDS) {
      expect(rollSlotRarities({ ...TRIP_TREASURES, slots }, seed)).toHaveLength(slots);
    }
  });

  it('gives the same rarities for the same seed, varies across seeds, and draws the slots in turn', () => {
    const rolls = new Set<string>();
    for (const seed of TRIP_SEEDS) {
      const rarities = rollSlotRarities(TRIP_TREASURES, seed);
      expect(rollSlotRarities(TRIP_TREASURES, seed)).toEqual(rarities);
      expect(rollSlotRarities({ ...TRIP_TREASURES, slots: 3 }, seed)).toEqual(rarities.slice(0, 3));
      rolls.add(rarities.join());
    }
    expect(rolls.size).toBeGreaterThanOrEqual(2);
  });

  it('rolls no slots for a slot count of 0', () => {
    expect(rollSlotRarities({ ...TRIP_TREASURES, slots: 0 }, 1)).toEqual([]);
  });

  it.each([2.5, -1, Number.NaN, Number.POSITIVE_INFINITY])('throws for slot count %f', (slots) => {
    expect(() => rollSlotRarities({ ...TRIP_TREASURES, slots }, 1)).toThrow(RangeError);
  });

  it.each<[string, Readonly<Record<Rarity, number>>]>([
    ['a negative chance', { common: 0.75, rare: 0.27, epic: 0, legendary: -0.02 }],
    ['a NaN chance', { ...HALVES, rare: Number.NaN }],
    ['an infinite chance', { ...HALVES, legendary: Number.POSITIVE_INFINITY }],
    ['chances adding up to below 1', { common: 0.5, rare: 0.25, epic: 0, legendary: 0 }],
    ['chances adding up to above 1', { ...HALVES, common: 0.6 }],
  ])('throws for %s', (_label, chance) => {
    const zone = buildCanalZone();
    expect(() => rollSlotRarities({ ...TRIP_TREASURES, chance }, 1)).toThrow(RangeError);
    expect(() => placeAll(zone, 1, [], { tuning: { ...TRIP_TREASURES, chance } })).toThrow(RangeError);
  });
});

describe('fallbackOrder', () => {
  it.each<[Rarity, Rarity[]]>([
    ['common', ['rare']],
    ['rare', ['common', 'epic']],
    ['epic', ['rare', 'common', 'legendary']],
    ['legendary', ['epic', 'rare', 'common']],
  ])('falls back from %s to more common rarities nearest first, then only one step rarer (B4)', (rarity, order) => {
    expect(fallbackOrder(rarity)).toEqual(order);
  });
});

describe('placeTreasures with every Common, Rare and Epic of an area banked (B4)', () => {
  it.each(AREAS.map((area) => [area.id, area] as const))(
    'leaves Common and Rare slots empty and fills Legendaries only from Epic and Legendary rolls in %s',
    (_areaId, area) => {
      const areaZone = buildZone(area.layout, DEFAULT_TRIP_SEED);
      const tuning = tripTreasureTuning(area.id);
      const banked = areaZone.finds.map((find) => find.id).filter((id) => rarityOf(id) !== 'legendary');
      expect(areaZone.finds.some((find) => rarityOf(find.id) === 'legendary')).toBe(true);
      for (const seed of SEEDS_1000) {
        const rolls = rollSlotRarities(tuning, seed);
        const legendarySlots = rolls.filter((rarity) => rarity === 'epic' || rarity === 'legendary').length;
        const placements = placeTreasures(areaZone.finds, areaZone.spots, banked, seed, { tuning });
        expect(placements.every((placed) => rarityOf(placed.id) === 'legendary'), `seed ${seed}`).toBe(true);
        expect(placements.length, `seed ${seed}`).toBeLessThanOrEqual(legendarySlots);
        if (placements.length === tuning.slots) {
          expect(legendarySlots, `seed ${seed}`).toBe(tuning.slots);
        }
      }
    },
  );
});

describe('placeTreasures', () => {
  const zone = buildCanalZone();
  const legendaryIds = idsOfRarity('legendary');
  const lostLegendary = legendaryIds[0];
  const specialId = CANAL_AREA.specialTreasureId;
  const specialRarity = rarityOf(specialId);

  it('gives an equal layout for the same trip seed and varies across seeds', () => {
    const optionSets: (PlacementOptions | undefined)[] = [
      undefined,
      { mustPlace: [lostLegendary] },
      { extras: [specialId] },
      { mustPlace: [lostLegendary], extras: [specialId], mainPath: zone.mainPath },
    ];
    for (const options of optionSets) {
      expect(placeAll(zone, DEFAULT_TRIP_SEED, [], options)).toEqual(placeAll(zone, DEFAULT_TRIP_SEED, [], options));
      const layouts = new Set(TRIP_SEEDS.map((seed) => JSON.stringify(placeAll(zone, seed, [], options))));
      expect(layouts.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('fills exactly the slots, each in a free spot of its own pool, for every trip seed with nothing banked', () => {
    expect(zone.finds.length).toBeGreaterThan(PER_TRIP);
    for (const seed of SEEDS_300) {
      const placements = placeAll(zone, seed);
      expect(placements).toHaveLength(PER_TRIP);
      expectValidLayout(zone, placements);
      expectInOwnPools(zone, placements);
    }
  });

  it.each(ALL_SEEDS)('places each picked treasure once in a free spot that meets its rarity for zone seed %i', (zoneSeed) => {
    const seededZone = buildCanalZone(zoneSeed);
    for (const tripSeed of TRIP_SEEDS) {
      expectValidLayout(seededZone, placeAll(seededZone, tripSeed));
      expectValidLayout(seededZone, placeAll(seededZone, tripSeed, [], { mainPath: seededZone.mainPath, extras: [specialId] }));
    }
  });

  it('gives each rarity its chance of the slots over 2000 trip seeds, rarer ones less often (B4)', () => {
    const totals = counts(0, 0, 0, 0);
    for (const seed of SEEDS_2000) {
      const perTrip = countByRarity(placeAll(zone, seed));
      for (const rarity of RARITIES) totals[rarity] += perTrip[rarity];
    }
    const slots = SEEDS_2000.length * PER_TRIP;
    for (const rarity of RARITIES) {
      const chance = TRIP_TREASURES.chance[rarity];
      const tolerance = 4 * Math.sqrt((chance * (1 - chance)) / slots);
      expect(Math.abs(totals[rarity] / slots - chance), rarity).toBeLessThanOrEqual(tolerance);
    }
    expect(totals.legendary).toBeLessThan(totals.epic);
    expect(totals.epic).toBeLessThan(totals.rare);
    expect(totals.rare).toBeLessThan(totals.common);
  });

  it('places every catalogue treasure on some trip seed over 2000 seeds', () => {
    const seen = new Set(SEEDS_2000.flatMap((seed) => placeAll(zone, seed).map((placed) => placed.id)));
    expect([...seen].sort()).toEqual(CANAL_TREASURES.map((treasure) => treasure.id).sort());
  });

  it('has trips with no Epic and trips with no Legendary, with the special placed (createTrip)', () => {
    const trips = SEEDS_300.map((seed) => createTrip(zone, LEGS, [], seed).placed);
    expect(trips.every((placed) => placed.some((find) => find.id === specialId))).toBe(true);
    expect(trips.some((placed) => !placed.some((find) => rarityOf(find.id) === 'epic'))).toBe(true);
    expect(trips.some((placed) => !placed.some((find) => rarityOf(find.id) === 'legendary'))).toBe(true);
  });

  it.each<[string, readonly Rarity[]]>([
    ['every Legendary', ['legendary']],
    ['every Common', ['common']],
    ['every Common and Rare', ['common', 'rare']],
  ])('fills a slot whose rarity has nothing left from its fallback order, with %s banked', (_label, rarities) => {
    const banked = rarities.flatMap(idsOfRarity);
    for (const seed of SEEDS_300) {
      const placements = placeAll(zone, seed, banked);
      expect(placements.some((placed) => banked.includes(placed.id))).toBe(false);
      expect(countByRarity(placements)).toEqual(expectedSlotCounts(zone, banked, [], seed));
      expectValidLayout(zone, placements);
    }
  });

  it('falls back from a rarity whose pool is full: one Rare spot, two Rares', () => {
    const rareSpot: HidingSpot = { id: 'test/spot-rare', cover: 'reeds', rarity: 'rare', container: false, x: 0, y: 0 };
    const commonSpot: HidingSpot = { ...rareSpot, id: 'test/spot-common', rarity: 'common', x: 100 };
    const finds = [
      { id: 'canal/pond-plant', pool: [commonSpot.id] },
      { id: 'canal/shell-necklace', pool: [rareSpot.id] },
      { id: 'canal/diving-tank', pool: [rareSpot.id] },
    ];
    const allRare: TripTreasureTuning = { ...TRIP_TREASURES, slots: 2, chance: { common: 0, rare: 1, epic: 0, legendary: 0 } };
    for (const seed of TRIP_SEEDS) {
      const placements = placeTreasures(finds, [commonSpot, rareSpot], [], seed, { tuning: allRare });
      expect(countByRarity(placements)).toEqual(counts(1, 1, 0, 0));
      expect(new Set(placements.map((placed) => placed.spotId)).size).toBe(2);
    }
  });

  it('places the special and lost treasures as extras on top of the slots, which they never use up', () => {
    const extras = [specialId, lostLegendary];
    for (const seed of SEEDS_300) {
      const placements = placeAll(zone, seed, [], { mustPlace: [lostLegendary], extras: [specialId] });
      expect(placements).toHaveLength(PER_TRIP + extras.length);
      for (const id of extras) expect(placements.map((placed) => placed.id)).toContain(id);
      const slotted = placements.filter((placed) => !extras.includes(placed.id));
      expect(countByRarity(slotted)).toEqual(expectedSlotCounts(zone, [], extras, seed));
      expectValidLayout(zone, placements);
      expectInOwnPools(zone, placements);
    }
  });

  it('counts a lost treasure that is also the special once', () => {
    for (const seed of TRIP_SEEDS) {
      const placements = placeAll(zone, seed, [], { mustPlace: [specialId], extras: [specialId] });
      expect(placements.filter((placed) => placed.id === specialId)).toHaveLength(1);
      expect(placements).toEqual(placeAll(zone, seed, [], { extras: [specialId] }));
    }
  });

  it('uses all five hiding kinds for some trip seed with nothing banked', () => {
    // 1000 seeds: since the canal keeps one Legendary (issue #146), the first such seed is 342.
    expect(SEEDS_1000.some((seed) => usesAllHidingKinds(zone, placeAll(zone, seed)))).toBe(true);
  });

  it.each([
    ['without a main path', undefined],
    ['with the main path', zone.mainPath],
  ])('picks every pool spot on some trip seed %s', (_label, mainPath) => {
    const seen = new Set(SEEDS_1000.flatMap((seed) => placeAll(zone, seed, [], { mainPath }).map((placed) => placed.spotId)));
    expect([...seen].sort()).toEqual([...new Set(zone.finds.flatMap((find) => find.pool))].sort());
  });

  it('picks spots farther from the main path more often', () => {
    const seeds = SEEDS_1000.slice(0, 500);
    const flat: TripTreasureTuning = { ...TRIP_TREASURES, leastHiddenWeight: 1, bestHiddenWeight: 1 };
    const weighted = meanDistanceByRarity(zone, seeds, { mainPath: zone.mainPath });
    const even = meanDistanceByRarity(zone, seeds, { mainPath: zone.mainPath, tuning: flat });
    const spreadRarities = RARITIES.filter((rarity) => poolSpread(zone, rarity) > 0);
    expect(spreadRarities.length).toBeGreaterThan(0);
    for (const rarity of spreadRarities) {
      expect(weighted[rarity]).toBeGreaterThan(even[rarity]);
    }
    for (const seed of seeds.slice(0, 50)) {
      expect(placeAll(zone, seed)).toEqual(placeAll(zone, seed, [], { mainPath: zone.mainPath, tuning: flat }));
      expect(placeAll(zone, seed, [], { mainPath: [] })).toEqual(placeAll(zone, seed));
    }
  });

  it('always places a lost Legendary on top of the slots', () => {
    for (const seed of SEEDS_300) {
      const placements = placeAll(zone, seed, [], { mustPlace: [lostLegendary] });
      expect(placements.map((placed) => placed.id)).toContain(lostLegendary);
      expect(placements).toHaveLength(PER_TRIP + 1);
      expectValidLayout(zone, placements);
    }
  });

  it('ignores banked, unknown and duplicate lost ids', () => {
    const bankedId = idsOfRarity('epic')[0];
    const mustPlace = [lostLegendary, lostLegendary, bankedId, 'canal/not-a-treasure', axolotlFindId('wild')];
    for (const seed of TRIP_SEEDS) {
      const placements = placeAll(zone, seed, [bankedId], { mustPlace });
      expect(placements).toEqual(placeAll(zone, seed, [bankedId], { mustPlace: [lostLegendary] }));
      expect(placements.map((placed) => placed.id)).not.toContain(bankedId);
    }
  });

  it('places several lost treasures of one rarity, each on top of the slots', () => {
    const lost = legendaryIds.slice(0, 3);
    for (const seed of SEEDS_300) {
      const placements = placeAll(zone, seed, [], { mustPlace: lost });
      const ids = placements.map((placed) => placed.id);
      for (const id of lost) expect(ids).toContain(id);
      expect(placements).toHaveLength(PER_TRIP + lost.length);
      expectValidLayout(zone, placements);
    }
  });

  it('always places the special treasure as an extra on top of the slots while it is unbanked', () => {
    const options: PlacementOptions = { extras: [specialId] };
    for (const seed of SEEDS_300) {
      const placements = placeAll(zone, seed, [], options);
      expect(placements.map((placed) => placed.id)).toContain(specialId);
      expect(placements).toHaveLength(PER_TRIP + 1);
      expectValidLayout(zone, placements);
      const afterBanked = placeAll(zone, seed, [specialId], options);
      expect(afterBanked).toHaveLength(PER_TRIP);
      expect(afterBanked.map((placed) => placed.id)).not.toContain(specialId);
    }
    expect(['common', 'rare']).toContain(specialRarity);
  });

  it('never places banked treasures', () => {
    const banked = [...idsOfRarity('common'), legendaryIds[0]];
    for (const tripSeed of SEEDS_300) {
      const ids = placeAll(zone, tripSeed, banked).map((placed) => placed.id);
      expect(ids.some((id) => banked.includes(id))).toBe(false);
      expect(ids).toHaveLength(PER_TRIP);
    }
    expect(placeAll(zone, 1, CANAL_TREASURES.map((treasure) => treasure.id))).toEqual([]);
  });

  it('places every unbanked Common and Rare when there are enough slots for all of them, whatever rarity each slot rolled', () => {
    const reachable = zone.finds.filter((find) => ['common', 'rare'].includes(rarityOf(find.id)));
    for (const count of [PER_TRIP - 1, PER_TRIP]) {
      const left = reachable.slice(0, count).map((find) => find.id);
      const banked = zone.finds.map((find) => find.id).filter((id) => !left.includes(id));
      for (const tripSeed of TRIP_SEEDS) {
        expect(placeAll(zone, tripSeed, banked).map((placed) => placed.id)).toEqual(left);
      }
    }
  });

  it('throws when the extras alone leave a pool no free spot, and slots never overfill one', () => {
    const spot: HidingSpot = { id: 'canal/spot-a', cover: 'reeds', rarity: 'common', container: false, x: 0, y: 0 };
    const finds = [
      { id: 'canal/pond-plant', pool: [spot.id] },
      { id: 'canal/sun-hat', pool: [spot.id] },
    ];
    const ids = finds.map((find) => find.id);
    expect(() => placeTreasures(finds, [spot], [], 1, { extras: ids })).toThrow('no free spot left for canal/sun-hat');
    expect(() => placeTreasures(finds, [spot], [], 1, { mustPlace: ids })).toThrow('no free spot left for canal/sun-hat');
    expect(placeTreasures(finds, [spot], ['canal/pond-plant'], 1, { extras: ids })).toHaveLength(1);
    for (const seed of TRIP_SEEDS) {
      expect(placeTreasures(finds, [spot], [], seed)).toHaveLength(1);
    }
  });

  it('throws before any draw when pools partly overlap, unless the overlapping find is banked', () => {
    const spots = ['a', 'b', 'c', 'd', 'e', 'f'].map(
      (name, i): HidingSpot => ({ id: `test/spot-${name}`, cover: 'reeds', rarity: 'common', container: false, x: i * 100, y: 0 }),
    );
    const [first, second, third] = idsOfRarity('common');
    const crossing = [
      { id: first, pool: ['test/spot-a', 'test/spot-c', 'test/spot-d'] },
      { id: second, pool: ['test/spot-b', 'test/spot-e', 'test/spot-f'] },
      { id: third, pool: ['test/spot-a', 'test/spot-b'] },
    ];
    const shrinking = [
      { id: first, pool: ['test/spot-a', 'test/spot-b'] },
      { id: second, pool: ['test/spot-a'] },
    ];
    const growing = [
      { id: first, pool: ['test/spot-a'] },
      { id: second, pool: ['test/spot-a', 'test/spot-b'] },
    ];
    const allCommon: TripTreasureTuning = { ...TRIP_TREASURES, slots: 3, chance: { common: 1, rare: 0, epic: 0, legendary: 0 } };
    const noSlots: TripTreasureTuning = { ...allCommon, slots: 0 };
    for (const finds of [crossing, shrinking, growing]) {
      for (const tuning of [allCommon, noSlots]) {
        expect(() => placeTreasures(finds, spots, [], 1, { tuning })).toThrow(/partly overlaps/);
      }
    }
    expect(() => placeTreasures(crossing, spots, [], 1, { tuning: allCommon })).toThrow(
      `placeTreasures: ${third} pool partly overlaps the pool of ${first}`,
    );
    expect(() => placeTreasures(shrinking, spots, [], 1)).toThrow(`placeTreasures: ${second} pool partly overlaps the pool of ${first}`);
    expect(() => placeTreasures(growing, spots, [], 1)).toThrow(`placeTreasures: ${second} pool partly overlaps the pool of ${first}`);
    for (const seed of TRIP_SEEDS) {
      expect(placeTreasures(crossing, spots, [third], seed, { tuning: allCommon })).toHaveLength(2);
      expect(placeTreasures(shrinking, spots, [second], seed, { tuning: allCommon })).toHaveLength(1);
      expect(placeTreasures(growing, spots, [first], seed, { tuning: allCommon })).toHaveLength(1);
    }
  });

  it('fills identical pools in any order and disjoint pools each to exactly min(treasures, spots)', () => {
    const spots = ['a', 'b', 'c'].map(
      (name, i): HidingSpot => ({ id: `test/spot-${name}`, cover: 'reeds', rarity: 'common', container: false, x: i * 100, y: 0 }),
    );
    const [first, second, third, fourth] = idsOfRarity('common');
    const finds = [
      { id: first, pool: ['test/spot-a', 'test/spot-b'] },
      { id: second, pool: ['test/spot-b', 'test/spot-a'] },
      { id: third, pool: ['test/spot-a', 'test/spot-b'] },
      { id: fourth, pool: ['test/spot-c'] },
    ];
    const sharedIds = [first, second, third];
    const allCommon: TripTreasureTuning = { ...TRIP_TREASURES, slots: 4, chance: { common: 1, rare: 0, epic: 0, legendary: 0 } };
    for (const seed of SEEDS_300) {
      const placements = placeTreasures(finds, spots, [], seed, { tuning: allCommon });
      expect(placements).toHaveLength(3);
      expect(new Set(placements.map((placed) => placed.spotId)).size).toBe(3);
      for (const placed of placements) {
        expect(finds.find((find) => find.id === placed.id)?.pool).toContain(placed.spotId);
      }
      expect(placements.filter((placed) => sharedIds.includes(placed.id))).toHaveLength(2);
      expect(placements.map((placed) => placed.id)).toContain(fourth);
    }
  });

  it('throws when an unbanked find is listed twice or its pool names a spot twice', () => {
    const spot: HidingSpot = { id: 'canal/spot-a', cover: 'reeds', rarity: 'common', container: false, x: 0, y: 0 };
    const other: HidingSpot = { ...spot, id: 'canal/spot-b', x: 100 };
    const twice = [
      { id: 'canal/pond-plant', pool: [spot.id] },
      { id: 'canal/pond-plant', pool: [other.id] },
    ];
    expect(() => placeTreasures(twice, [spot, other], [], 1)).toThrow('placeTreasures: canal/pond-plant is listed twice');
    expect(placeTreasures(twice, [spot, other], ['canal/pond-plant'], 1)).toEqual([]);
    const repeated = [{ id: 'canal/pond-plant', pool: [spot.id, spot.id] }];
    expect(() => placeTreasures(repeated, [spot], [], 1)).toThrow('placeTreasures: canal/pond-plant pool names a spot twice');
  });

  it('throws when a pool names an unknown spot', () => {
    const finds = [{ id: 'canal/pond-plant', pool: ['canal/spot-missing'] }];
    expect(() => placeTreasures(finds, [], [], 1)).toThrow('unknown spot canal/spot-missing');
  });

  it('throws when an unbanked find is not a catalogue treasure', () => {
    const spot: HidingSpot = { id: 'canal/spot-a', cover: 'reeds', rarity: 'common', container: false, x: 0, y: 0 };
    const finds = [{ id: 'canal/not-a-treasure', pool: [spot.id] }];
    expect(() => placeTreasures(finds, [spot], [], 1)).toThrow('placeTreasures: unknown treasure canal/not-a-treasure');
    expect(placeTreasures(finds, [spot], ['canal/not-a-treasure'], 1)).toEqual([]);
  });

  it('never calls Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    placeAll(zone, DEFAULT_TRIP_SEED);
    placeAll(zone, DEFAULT_TRIP_SEED, [], { mustPlace: [lostLegendary], extras: [specialId], mainPath: zone.mainPath });
    nextTripSeed(DEFAULT_TRIP_SEED);
    rollSlotRarities(TRIP_TREASURES, DEFAULT_TRIP_SEED);
    slotRarity(TRIP_TREASURES.chance, 0.5);
    expect(random).not.toHaveBeenCalled();
  });
});

describe('placeTreasures risk weight (issue #70)', () => {
  const zone = buildCanalZone();
  const specialId = CANAL_AREA.specialTreasureId;
  const withRoutes: PlacementOptions = { mainPath: zone.mainPath, tilapiaRoutes: zone.tilapiaRoutes, lungeRange: TILAPIA.lungeRange };
  const withoutRoutes: PlacementOptions = { mainPath: zone.mainPath };
  const ladder: readonly Rarity[] = ['legendary', 'epic', 'rare', 'common'];
  const SHARE_TOLERANCE = 0.03;
  const lineRoute: TilapiaRoute[] = [{ id: 'test/route', waypoints: [{ x: 0, y: 0 }] }];
  const lineSpots: HidingSpot[] = [50, 100, 150].map((x) => ({
    id: `test/spot-${x}`,
    cover: 'reeds',
    rarity: 'common',
    container: false,
    x,
    y: 0,
  }));

  function meanRouteDistanceByRarity(seeds: readonly number[], options: PlacementOptions): RarityCounts {
    const total = counts(0, 0, 0, 0);
    const seen = counts(0, 0, 0, 0);
    for (const seed of seeds) {
      for (const placed of placeAll(zone, seed, [], options)) {
        const rarity = rarityOf(placed.id);
        total[rarity] += routeDistance(placed, zone.tilapiaRoutes);
        seen[rarity] += 1;
      }
    }
    return counts(total.common / seen.common, total.rare / seen.rare, total.epic / seen.epic, total.legendary / seen.legendary);
  }

  function routeSpread(rarity: Rarity): number {
    const distances = zone.spots
      .filter((spot) => spot.rarity === rarity)
      .map((spot) => routeDistance(spot, zone.tilapiaRoutes));
    return Math.max(...distances) - Math.min(...distances);
  }

  function lineShares(id: string, seeds: readonly number[], options: PlacementOptions): number[] {
    const picks = new Map(lineSpots.map((spot) => [spot.id, 0]));
    for (const seed of seeds) {
      const placed = placeTreasures([{ id, pool: lineSpots.map((spot) => spot.id) }], lineSpots, [], seed, { extras: [id], ...options });
      picks.set(placed[0].spotId, (picks.get(placed[0].spotId) ?? 0) + 1);
    }
    return lineSpots.map((spot) => (picks.get(spot.id) ?? 0) / seeds.length);
  }

  function expectShares(actual: readonly number[], expected: readonly number[]): void {
    actual.forEach((share, i) => expect(Math.abs(share - expected[i])).toBeLessThanOrEqual(SHARE_TOLERANCE));
  }

  it('hides rarer treasures nearer the tilapia on average: Legendary, then Epic, then Rare, then Common', () => {
    const means = meanRouteDistanceByRarity(SEEDS_1000, withRoutes);
    for (let i = 0; i + 1 < ladder.length; i++) {
      expect(means[ladder[i]]).toBeLessThan(means[ladder[i + 1]]);
    }
  });

  it('moves Rare, Epic and Legendary nearer the tilapia and Common farther than without routes', () => {
    const weighted = meanRouteDistanceByRarity(SEEDS_1000, withRoutes);
    const even = meanRouteDistanceByRarity(SEEDS_1000, withoutRoutes);
    for (const rarity of RARITIES) {
      expect(routeSpread(rarity)).toBeGreaterThan(0);
      if (RISK.favoured[rarity] === 'nearer') {
        expect(weighted[rarity]).toBeLessThan(even[rarity]);
      } else {
        expect(weighted[rarity]).toBeGreaterThan(even[rarity]);
      }
    }
  });

  it('weights a pool linearly from 1 to 2 toward the rarity\'s favoured side, by route distance', () => {
    const seeds = SEEDS_2000.concat(SEEDS_2000.map((seed) => seed + SEEDS_2000.length));
    const legendary = idsOfRarity('legendary')[0];
    const common = idsOfRarity('common')[0];
    expectShares(lineShares(legendary, seeds, { tilapiaRoutes: lineRoute }), [4 / 9, 3 / 9, 2 / 9]);
    expectShares(lineShares(common, seeds, { tilapiaRoutes: lineRoute }), [2 / 9, 3 / 9, 4 / 9]);
    expectShares(lineShares(legendary, seeds, {}), [1 / 3, 1 / 3, 1 / 3]);
  });

  it('gives every spot a risk weight of 1 when every route distance in the pool is equal', () => {
    const ringRoute: TilapiaRoute[] = [{ id: 'test/ring', waypoints: [{ x: 100, y: 100 }] }];
    const legendary = idsOfRarity('legendary')[0];
    const equalSpots: HidingSpot[] = [
      { ...lineSpots[0], id: 'test/spot-up', x: 100, y: 0 },
      { ...lineSpots[0], id: 'test/spot-down', x: 100, y: 200 },
    ];
    const equalFinds = [{ id: legendary, pool: equalSpots.map((spot) => spot.id) }];
    for (const seed of SEEDS_300) {
      expect(placeTreasures(equalFinds, equalSpots, [], seed, { extras: [legendary], tilapiaRoutes: ringRoute })).toEqual(
        placeTreasures(equalFinds, equalSpots, [], seed, { extras: [legendary] }),
      );
    }
  });

  it('multiplies the hiddenness weight by the risk weight, and a flat risk tuning changes nothing', () => {
    const flatRisk: RiskTuning = { ...RISK, unfavouredWeight: 1, favouredWeight: 1 };
    const flatHidden: TripTreasureTuning = { ...TRIP_TREASURES, leastHiddenWeight: 1, bestHiddenWeight: 1 };
    for (const seed of SEEDS_300) {
      expect(placeAll(zone, seed, [], { ...withRoutes, risk: flatRisk })).toEqual(placeAll(zone, seed, [], withoutRoutes));
      expect(placeAll(zone, seed, [], { ...withRoutes, tuning: flatHidden })).toEqual(
        placeAll(zone, seed, [], { tilapiaRoutes: zone.tilapiaRoutes }),
      );
    }
    const differs = SEEDS_300.some(
      (seed) => JSON.stringify(placeAll(zone, seed, [], withRoutes)) !== JSON.stringify(placeAll(zone, seed, [], withoutRoutes)),
    );
    expect(differs).toBe(true);
  });

  it('picks every pool spot on some trip seed with routes', () => {
    const seen = new Set(SEEDS_1000.flatMap((seed) => placeAll(zone, seed, [], withRoutes).map((placed) => placed.spotId)));
    expect([...seen].sort()).toEqual([...new Set(zone.finds.flatMap((find) => find.pool))].sort());
  });

  it('gives an equal layout for the same trip seed with routes and varies across seeds', () => {
    const options: PlacementOptions = { ...withRoutes, extras: [specialId] };
    for (const seed of TRIP_SEEDS) {
      expect(placeAll(zone, seed, [], options)).toEqual(placeAll(zone, seed, [], options));
    }
    const layouts = new Set(TRIP_SEEDS.map((seed) => JSON.stringify(placeAll(zone, seed, [], options))));
    expect(layouts.size).toBeGreaterThanOrEqual(2);
  });

  it.each(ALL_SEEDS)('places each pick once in a spot that meets its rarity and the risk ladder for zone seed %i', (zoneSeed) => {
    const seededZone = buildCanalZone(zoneSeed);
    const options: PlacementOptions = {
      mainPath: seededZone.mainPath,
      tilapiaRoutes: seededZone.tilapiaRoutes,
      lungeRange: TILAPIA.lungeRange,
      extras: [specialId],
    };
    for (const tripSeed of SEEDS_300) {
      expectValidLayout(seededZone, placeAll(seededZone, tripSeed, [], options));
    }
  });

  it('gives the same placement as without routes when the routes are empty or absent', () => {
    for (const seed of SEEDS_300) {
      const today = placeAll(zone, seed, [], withoutRoutes);
      expect(placeAll(zone, seed, [], { ...withoutRoutes, tilapiaRoutes: [] })).toEqual(today);
      expect(placeAll(zone, seed, [], { ...withoutRoutes, tilapiaRoutes: [], lungeRange: TILAPIA.lungeRange })).toEqual(today);
      expect(placeAll(zone, seed, [], { ...withoutRoutes, tilapiaRoutes: [{ id: 'test/empty', waypoints: [] }] })).toEqual(today);
    }
  });

  it('never calls Math.random with routes', () => {
    const random = vi.spyOn(Math, 'random');
    placeAll(zone, DEFAULT_TRIP_SEED, [], { ...withRoutes, extras: [specialId] });
    expect(random).not.toHaveBeenCalled();
  });

  it('gives the same placement from the canal threats as from its tilapia routes for trip seeds 1 to 25', () => {
    const fromRoutes: PlacementOptions = { ...withRoutes, extras: [specialId] };
    const fromThreats: PlacementOptions = { mainPath: zone.mainPath, threats: zoneThreats(zone), extras: [specialId] };
    for (const seed of TRIP_SEEDS) {
      expect(placeAll(zone, seed, [], fromThreats)).toEqual(placeAll(zone, seed, [], fromRoutes));
    }
  });

  it('reads the threats in place of the tilapia routes, and empty threats give every spot a risk weight of 1', () => {
    for (const seed of SEEDS_300) {
      expect(placeAll(zone, seed, [], { ...withRoutes, threats: [] })).toEqual(placeAll(zone, seed, [], withoutRoutes));
    }
  });

  it('weights a pool by distance to a leg-costing hazard shape like a route', () => {
    const seeds = SEEDS_2000.concat(SEEDS_2000.map((seed) => seed + SEEDS_2000.length));
    const legendary = idsOfRarity('legendary')[0];
    const hazard: Threat[] = [{ kind: 'shape', shape: { kind: 'circle', x: 0, y: 0, r: 10 }, strike: 4 }];
    expectShares(lineShares(legendary, seeds, { threats: hazard }), [4 / 9, 3 / 9, 2 / 9]);
  });
});

describe('createTrip area option', () => {
  const tripSeed = 1;
  const devZone = buildZone(DEV_TEST_AREA.layout, DEFAULT_TRIP_SEED);
  const specialId = DEV_TEST_AREA.specialTreasureId;

  it('places the special treasure of a dev area passed as options.area', () => {
    const trip = createTrip(devZone, LEGS, [], tripSeed, { area: DEV_TEST_AREA });
    expect(trip.placed.map((placed) => placed.id)).toContain(specialId);
  });

  it('places no special treasure for a dev area left to the AREAS lookup', () => {
    const trip = createTrip(devZone, LEGS, [], tripSeed);
    expect(trip.placed.map((placed) => placed.id)).not.toContain(specialId);
  });

  it('gives the canal the same placement with or without its area passed', () => {
    const canalZone = buildCanalZone();
    for (const seed of TRIP_SEEDS) {
      expect(createTrip(canalZone, LEGS, [], seed, { area: CANAL_AREA }).placed).toEqual(createTrip(canalZone, LEGS, [], seed).placed);
    }
  });

  it('throws when options.area is not the source area', () => {
    expect(() => createTrip(devZone, LEGS, [], tripSeed, { area: CANAL_AREA })).toThrow(/not the trip's area/);
  });
});

describe('trip treasure tuning', () => {
  function expectSaneTuning(tuning: TripTreasureTuning): void {
    expect(Number.isInteger(tuning.slots)).toBe(true);
    expect(tuning.slots).toBeGreaterThanOrEqual(1);
    for (const rarity of RARITIES) {
      expect(tuning.chance[rarity]).toBeGreaterThanOrEqual(0);
      expect(tuning.chance[rarity]).toBeLessThanOrEqual(1);
    }
    expect(RARITIES.reduce((sum, rarity) => sum + tuning.chance[rarity], 0)).toBeCloseTo(1);
    expect(tuning.leastHiddenWeight).toBeGreaterThanOrEqual(1);
    expect(tuning.bestHiddenWeight).toBeGreaterThanOrEqual(tuning.leastHiddenWeight);
  }

  it('has sane defaults and a sane tuning for every area and dev area', () => {
    expectSaneTuning(TRIP_TREASURES);
    expect(TRIP_TREASURES.slots).toBe(6);
    expect(TRIP_TREASURES.chance).toEqual({ common: 0.65, rare: 0.27, epic: 0.06, legendary: 0.02 });
    for (const area of [...AREAS, ...DEV_AREAS]) {
      expectSaneTuning(tripTreasureTuning(area.id));
    }
  });

  it('only overrides known areas', () => {
    for (const areaId of Object.keys(TRIP_TREASURES_BY_AREA)) {
      expect(areaById(areaId)).toBeDefined();
    }
  });

  it('merges an area override field by field and gives the default for an unknown area', () => {
    const overrides = { reef: { slots: 8, bestHiddenWeight: 4 } };
    const reef = tripTreasureTuning('reef', overrides);
    expect(reef.slots).toBe(8);
    expect(reef.chance).toEqual(TRIP_TREASURES.chance);
    expect(reef.leastHiddenWeight).toBe(TRIP_TREASURES.leastHiddenWeight);
    expect(reef.bestHiddenWeight).toBe(4);
    expect(tripTreasureTuning('nowhere', overrides)).toEqual(TRIP_TREASURES);
    expect(tripTreasureTuning('constructor', overrides)).toEqual(TRIP_TREASURES);
  });

  it('replaces the whole chance record with an override chance', () => {
    const chance = { common: 1, rare: 0, epic: 0, legendary: 0 };
    const reef = tripTreasureTuning('reef', { reef: { chance } });
    expect(reef.chance).toEqual(chance);
    expect(reef.slots).toBe(TRIP_TREASURES.slots);
    expectSaneTuning(reef);
  });
});
