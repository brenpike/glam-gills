/**
 * Area 14's registration (issue #213): its area data, its place in AREAS, its unlock, its day look
 * and cue, its habitat label, its special treasure's band, its trip slots, trips and cards, the lost
 * shared treasure coming back on the next Area 14 trip, and the open lake refuge section it cleans.
 */
import { describe, expect, it } from 'vitest';
import {
  AREAS,
  OPEN_LAKE_2_AREA,
  OPEN_LAKE_3_AREA,
  OPEN_LAKE_AREA,
  OPEN_LAKE_HABITAT,
  areaById,
  areaFactCards,
  areaTimeOfDay,
  isAreaUnlocked,
  newThingsByArea,
  sourceFactCards,
} from './areas';
import { habitatAreasLabel } from './areaText';
import { DEFAULT_LOOK } from './axolotlLook';
import { treasureById } from './catalogue';
import { deepestWaterBand, raritySpotsInDeepestBand } from './depthBand';
import { DRIFTING_ISLAND } from './driftingIslands';
import { SHARP_LITTER_FACT } from './factCards';
import { FADING_LIGHT } from './hazards';
import { zoneThreats } from './hiding';
import { STARTER_MORPH } from './morphs';
import { LAGOON_BREEZE, musicCueFor } from './music';
import {
  OPEN_LAKE_3_AREA_ID,
  OPEN_LAKE_3_EXIT,
  OPEN_LAKE_3_LAYOUT,
  OPEN_LAKE_3_SHARED_TREASURES,
  OPEN_LAKE_3_SPECIAL_TREASURE_ID,
} from './openLake3Layout';
import { placeTreasures } from './placement';
import { EMPTY_REFUGE_PENDING, refugeSections, withTripResult, type RefugeSection } from './refuge';
import { STRANDING_CHANCE, areaStrandingChance } from './rescue';
import { addStarter, createSession, recordTripEnd, tripStart, type Session, type TripEndRecord } from './session';
import { NO_STARS, type AreaStarsRecord } from './stars';
import { createTrip } from './trip';
import { LEGS, tripTreasureTuning } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone } from './zone';

const TRIP_SEEDS = [0, 1, 2, 3, 42];
const PLACEMENT_SEEDS = Array.from({ length: 200 }, (_, i) => i * 104729 + 17);

/** A stars record with the exit star saved for each area id. */
function beaten(areaIds: readonly string[]): AreaStarsRecord {
  return Object.fromEntries(areaIds.map((id) => [id, { ...NO_STARS, exit: true }]));
}

/** The open lake's refuge section for `stars`. */
function openLakeSection(stars: AreaStarsRecord): RefugeSection | undefined {
  return refugeSections(stars).find((section) => section.habitatId === OPEN_LAKE_HABITAT.id);
}

describe('Area 14 registration (issue #213)', () => {
  it('is Area 14, last in AREAS, in the open lake, with its layout, exit, special treasure and late-afternoon look', () => {
    expect(OPEN_LAKE_3_AREA).toMatchObject({
      id: OPEN_LAKE_3_AREA_ID,
      number: 14,
      habitatId: OPEN_LAKE_HABITAT.id,
      specialTreasureId: OPEN_LAKE_3_SPECIAL_TREASURE_ID,
      look: 'open-lake-late',
      snackDrift: { amplitudeX: 16, amplitudeY: 8, periodX: 6.3, periodY: 5.04 },
    });
    expect(OPEN_LAKE_3_AREA.layout).toBe(OPEN_LAKE_3_LAYOUT);
    expect(OPEN_LAKE_3_AREA.exit).toBe(OPEN_LAKE_3_EXIT);
    expect(AREAS.at(-1)).toBe(OPEN_LAKE_3_AREA);
    expect(areaById(OPEN_LAKE_3_AREA_ID)).toBe(OPEN_LAKE_3_AREA);
    expect(Object.isFrozen(OPEN_LAKE_3_AREA)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_3_AREA.exit)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_3_AREA.snackDrift)).toBe(true);
  });

  it('keeps the default stranding chance and no one-time darters', () => {
    expect('strandingChance' in OPEN_LAKE_3_AREA).toBe(false);
    expect(areaStrandingChance(OPEN_LAKE_3_AREA)).toBe(STRANDING_CHANCE);
    expect(OPEN_LAKE_3_AREA.snackDart).toBeUndefined();
  });

  it('is a day area', () => {
    expect(areaTimeOfDay(OPEN_LAKE_3_AREA)).toBe('day');
  });

  it('unlocks once Area 13 is beaten, and not before', () => {
    const throughArea12 = AREAS.slice(0, 12).map((area) => area.id);
    expect(throughArea12.at(-1)).toBe(OPEN_LAKE_AREA.id);
    expect(isAreaUnlocked(beaten(throughArea12), OPEN_LAKE_3_AREA_ID)).toBe(false);
    expect(isAreaUnlocked(beaten([...throughArea12, OPEN_LAKE_2_AREA.id]), OPEN_LAKE_3_AREA_ID)).toBe(true);
  });

  it("plays the open lake's cue, Lagoon Breeze, in its day version on a trip", () => {
    expect(musicCueFor('trip', OPEN_LAKE_3_AREA)).toBe(LAGOON_BREEZE);
  });

  it("labels the open lake habitat 'Open lake: Areas 12 to 14'", () => {
    const numbers = AREAS.filter((area) => area.habitatId === OPEN_LAKE_HABITAT.id).map((area) => area.number);
    expect(habitatAreasLabel(OPEN_LAKE_HABITAT.name, numbers)).toBe('Open lake: Areas 12 to 14');
  });

  it('gives the Legendary Refuge snow globe as its special treasure, every Legendary spot in band 3, the deepest band (issue #213, Q1)', () => {
    expect(OPEN_LAKE_3_AREA.specialTreasureId).toBe('deep-canal/refuge-snow-globe');
    expect(treasureById(OPEN_LAKE_3_AREA.specialTreasureId)?.rarity).toBe('legendary');
    expect(deepestWaterBand(OPEN_LAKE_3_LAYOUT)).toBe(3);
    const spots = buildZone(OPEN_LAKE_3_LAYOUT, DEFAULT_ZONE_SEED).spots;
    expect(raritySpotsInDeepestBand(spots, 'legendary', deepestWaterBand(OPEN_LAKE_3_LAYOUT))).toBe(true);
  });

  it('has 19 trip treasure slots', () => {
    expect(tripTreasureTuning(OPEN_LAKE_3_AREA_ID).slots).toBe(19);
  });

  it('places 200 trips with its registered slots, the special treasure always among them', () => {
    const zone = buildZone(OPEN_LAKE_3_LAYOUT, DEFAULT_ZONE_SEED);
    const options = {
      extras: [OPEN_LAKE_3_AREA.specialTreasureId],
      tuning: tripTreasureTuning(OPEN_LAKE_3_AREA_ID),
      mainPath: zone.mainPath,
      threats: zoneThreats(zone),
    };
    for (const tripSeed of PLACEMENT_SEEDS) {
      const placed = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(placed.map((find) => find.id), `seed ${tripSeed}`).toContain(OPEN_LAKE_3_SPECIAL_TREASURE_ID);
      expect(new Set(placed.map((find) => find.spotId)).size, `seed ${tripSeed}`).toBe(placed.length);
    }
  });

  it('adds the sharp litter card, last in the area cards, and no fading light or drifting island card', () => {
    const { ids } = sourceFactCards(OPEN_LAKE_3_LAYOUT);
    expect(ids).toContain(SHARP_LITTER_FACT.id);
    expect(ids).not.toContain(FADING_LIGHT.id);
    expect(ids).not.toContain(DRIFTING_ISLAND.id);
    expect(areaFactCards().at(-1)).toBe(SHARP_LITTER_FACT);
    const allIds = areaFactCards().map((card) => card.id);
    expect(allIds).not.toContain(FADING_LIGHT.id);
    expect(allIds).not.toContain(DRIFTING_ISLAND.id);
  });

  it('counts the sharp litter and the drifting island as its new things', () => {
    expect(newThingsByArea().at(-1)).toEqual({ areaId: OPEN_LAKE_3_AREA_ID, threats: ['sharp-litter'], elements: ['drifting-island'] });
  });
});

describe('a shared Area 14 treasure lost there (issue #213, ND-9)', () => {
  const zone = buildZone(OPEN_LAKE_3_LAYOUT, DEFAULT_ZONE_SEED);
  const shared = OPEN_LAKE_3_SHARED_TREASURES.find((treasure) => treasure.id !== OPEN_LAKE_3_SPECIAL_TREASURE_ID);
  if (shared === undefined) throw new Error('Area 14 shares no treasure but its special');
  const sharedId = shared.id;

  /** A trip-end record of an Area 14 trip carried home losing `sharedId`, with nothing banked. */
  function lostRecord(): TripEndRecord {
    return {
      areaId: OPEN_LAKE_3_AREA_ID,
      banked: [],
      rescued: [],
      eatenSnacks: [],
      tripSeed: 1,
      waitingStranded: null,
      met: [],
      returnedFinds: [sharedId],
    };
  }

  /** A session with a starter whose last Area 14 trip was carried home losing `sharedId`. */
  function lostInArea14(): Session {
    return recordTripEnd(addStarter(createSession(), { name: 'Gilly', look: DEFAULT_LOOK }, STARTER_MORPH), lostRecord());
  }

  /** The ids an Area 14 trip places with `tripSeed`, started from `session`'s banked ids and Area 14's lost treasures. */
  function placedIds(session: Session, tripSeed: number): string[] {
    const start = tripStart(session, tripSeed, OPEN_LAKE_3_AREA_ID);
    return createTrip(zone, LEGS, start.banked, tripSeed, { returnedFinds: start.returnedFinds }).placed.map((find) => find.id);
  }

  it('is a shared treasure Area 14 hides, not its special treasure', () => {
    expect(OPEN_LAKE_3_LAYOUT.sharedTreasures).toContain(shared);
    expect(sharedId).not.toBe(OPEN_LAKE_3_SPECIAL_TREASURE_ID);
  });

  it('comes back on the next Area 14 trip when lost there, whatever its seed, and stays in Area 14 memory only', () => {
    const session = lostInArea14();
    expect(tripStart(session, 0, OPEN_LAKE_3_AREA_ID).returnedFinds).toEqual([sharedId]);
    for (const area of AREAS.filter((candidate) => candidate.id !== OPEN_LAKE_3_AREA_ID)) {
      expect(tripStart(session, 0, area.id).returnedFinds, area.id).toEqual([]);
    }
    for (const seed of TRIP_SEEDS) expect(placedIds(session, seed), `seed ${seed}`).toContain(sharedId);
  });
});

describe('the open lake refuge section with Area 14 (issue #213)', () => {
  const throughArea13 = AREAS.slice(0, 13).map((area) => area.id);
  const throughArea14 = [...throughArea13, OPEN_LAKE_3_AREA_ID];

  it('has a batch for each of Areas 12 to 14, and is dirty until Area 14 is beaten', () => {
    expect(openLakeSection({})?.batches.map((batch) => batch.areaNumber)).toEqual([12, 13, 14]);
    expect(openLakeSection(beaten(throughArea13))?.state).toBe('dirty');
  });

  it('is clean once Areas 12 to 14 are beaten', () => {
    expect(openLakeSection(beaten(throughArea14))?.state).toBe('clean');
  });

  it("gives Area 14's clean-up and the open lake milestone when Area 14 is beaten last", () => {
    expect(withTripResult(EMPTY_REFUGE_PENDING, beaten(throughArea13), beaten(throughArea14))).toEqual({
      cleanUps: [OPEN_LAKE_3_AREA_ID],
      milestones: [OPEN_LAKE_HABITAT.id],
    });
  });
});
