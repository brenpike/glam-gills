/**
 * Area 13's registration (issue #212): its area data, its place in AREAS, its unlock, its day look
 * and cue, its habitat label, its special treasure's band, its trip slots and cards, and the lost
 * shared treasure coming back on the next Area 13 trip (ND-27).
 */
import { describe, expect, it } from 'vitest';
import {
  AREAS,
  OPEN_LAKE_2_AREA,
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
import { treasureById } from './catalogue';
import { deepestWaterBand, raritySpotsInDeepestBand } from './depthBand';
import { MUD_TURTLE_FACT } from './factCards';
import { FADING_LIGHT } from './hazards';
import { LAGOON_BREEZE, musicCueFor } from './music';
import {
  OPEN_LAKE_2_AREA_ID,
  OPEN_LAKE_2_EXIT,
  OPEN_LAKE_2_LAYOUT,
  OPEN_LAKE_2_SHARED_TREASURES,
  OPEN_LAKE_2_SPECIAL_TREASURE_ID,
} from './openLake2Layout';
import { STRANDING_CHANCE, areaStrandingChance } from './rescue';
import { DEFAULT_LOOK } from './axolotlLook';
import { STARTER_MORPH } from './morphs';
import { addStarter, createSession, recordTripEnd, tripStart, type Session, type TripEndRecord } from './session';
import { NO_STARS, type AreaStarsRecord } from './stars';
import { createTrip } from './trip';
import { LEGS, tripTreasureTuning } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone } from './zone';

const TRIP_SEEDS = [0, 1, 2, 3, 42];

/** A stars record with the exit star saved for each area id. */
function beaten(areaIds: readonly string[]): AreaStarsRecord {
  return Object.fromEntries(areaIds.map((id) => [id, { ...NO_STARS, exit: true }]));
}

describe('Area 13 registration (issue #212)', () => {
  it('is Area 13, just before Area 14 in AREAS, in the open lake, with its layout, exit, special treasure and still look', () => {
    expect(OPEN_LAKE_2_AREA).toMatchObject({
      id: OPEN_LAKE_2_AREA_ID,
      number: 13,
      habitatId: OPEN_LAKE_HABITAT.id,
      specialTreasureId: OPEN_LAKE_2_SPECIAL_TREASURE_ID,
      look: 'open-lake-still',
      snackDrift: { amplitudeX: 16, amplitudeY: 8, periodX: 6.4, periodY: 5.12 },
    });
    expect(OPEN_LAKE_2_AREA.layout).toBe(OPEN_LAKE_2_LAYOUT);
    expect(OPEN_LAKE_2_AREA.exit).toBe(OPEN_LAKE_2_EXIT);
    expect(AREAS.at(-2)).toBe(OPEN_LAKE_2_AREA);
    expect(areaById(OPEN_LAKE_2_AREA_ID)).toBe(OPEN_LAKE_2_AREA);
    expect(Object.isFrozen(OPEN_LAKE_2_AREA)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_2_AREA.exit)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_2_AREA.snackDrift)).toBe(true);
  });

  it('keeps the default stranding chance and no one-time darters', () => {
    expect('strandingChance' in OPEN_LAKE_2_AREA).toBe(false);
    expect(areaStrandingChance(OPEN_LAKE_2_AREA)).toBe(STRANDING_CHANCE);
    expect(OPEN_LAKE_2_AREA.snackDart).toBeUndefined();
  });

  it('is a day area', () => {
    expect(areaTimeOfDay(OPEN_LAKE_2_AREA)).toBe('day');
  });

  it('unlocks once Area 12 is beaten, and not before', () => {
    const throughArea11 = AREAS.slice(0, 11).map((area) => area.id);
    expect(isAreaUnlocked(beaten(throughArea11), OPEN_LAKE_2_AREA_ID)).toBe(false);
    expect(isAreaUnlocked(beaten([...throughArea11, OPEN_LAKE_AREA.id]), OPEN_LAKE_2_AREA_ID)).toBe(true);
  });

  it("plays the open lake's cue, Lagoon Breeze, in its day version on a trip", () => {
    expect(musicCueFor('trip', OPEN_LAKE_2_AREA)).toBe(LAGOON_BREEZE);
  });

  it("labels the open lake habitat 'Open lake: Areas 12 to 14'", () => {
    const numbers = AREAS.filter((area) => area.habitatId === OPEN_LAKE_HABITAT.id).map((area) => area.number);
    expect(habitatAreasLabel(OPEN_LAKE_HABITAT.name, numbers)).toBe('Open lake: Areas 12 to 14');
  });

  it('gives the Legendary Lagoon shine Paint shell as its special treasure, every Legendary spot in band 3, the deepest band (ND-24)', () => {
    expect(treasureById(OPEN_LAKE_2_AREA.specialTreasureId)?.rarity).toBe('legendary');
    expect(deepestWaterBand(OPEN_LAKE_2_LAYOUT)).toBe(3);
    const spots = buildZone(OPEN_LAKE_2_LAYOUT, DEFAULT_ZONE_SEED).spots;
    expect(raritySpotsInDeepestBand(spots, 'legendary', deepestWaterBand(OPEN_LAKE_2_LAYOUT))).toBe(true);
  });

  it('has 18 trip treasure slots', () => {
    expect(tripTreasureTuning(OPEN_LAKE_2_AREA_ID).slots).toBe(18);
  });

  it("adds the mud turtle card, just before Area 14's sharp litter card in the area cards, and no fading light card (ND-26)", () => {
    const { ids } = sourceFactCards(OPEN_LAKE_2_LAYOUT);
    expect(ids).toContain(MUD_TURTLE_FACT.id);
    expect(ids).not.toContain(FADING_LIGHT.id);
    expect(areaFactCards().at(-2)).toBe(MUD_TURTLE_FACT);
    expect(areaFactCards().map((card) => card.id)).not.toContain(FADING_LIGHT.id);
    expect(newThingsByArea().at(-2)).toEqual({ areaId: OPEN_LAKE_2_AREA_ID, threats: ['mud-turtle'], elements: ['fading-light'] });
  });
});

describe('a shared Area 13 treasure lost there (issue #212, ND-27)', () => {
  const zone = buildZone(OPEN_LAKE_2_LAYOUT, DEFAULT_ZONE_SEED);
  const shared = OPEN_LAKE_2_SHARED_TREASURES.find((treasure) => treasure.id !== OPEN_LAKE_2_SPECIAL_TREASURE_ID);
  if (shared === undefined) throw new Error('Area 13 shares no treasure but its special');
  const sharedId = shared.id;

  /** A trip-end record of an Area 13 trip carried home losing `sharedId`, with nothing banked. */
  function lostRecord(): TripEndRecord {
    return {
      areaId: OPEN_LAKE_2_AREA_ID,
      banked: [],
      rescued: [],
      eatenSnacks: [],
      tripSeed: 1,
      waitingStranded: null,
      met: [],
      returnedFinds: [sharedId],
    };
  }

  /** A session with a starter whose last Area 13 trip was carried home losing `sharedId`. */
  function lostInArea13(): Session {
    return recordTripEnd(addStarter(createSession(), { name: 'Gilly', look: DEFAULT_LOOK }, STARTER_MORPH), lostRecord());
  }

  /** The ids an Area 13 trip places with `tripSeed`, started from `session`'s banked ids and Area 13's lost treasures. */
  function placedIds(session: Session, tripSeed: number): string[] {
    const start = tripStart(session, tripSeed, OPEN_LAKE_2_AREA_ID);
    return createTrip(zone, LEGS, start.banked, tripSeed, { returnedFinds: start.returnedFinds }).placed.map((find) => find.id);
  }

  it('is a shared treasure Area 13 hides, not its special treasure', () => {
    expect(OPEN_LAKE_2_LAYOUT.sharedTreasures).toContain(shared);
    expect(sharedId).not.toBe(OPEN_LAKE_2_SPECIAL_TREASURE_ID);
  });

  it('comes back on the next Area 13 trip when lost there, whatever its seed, and stays in Area 13 memory only', () => {
    const session = lostInArea13();
    expect(tripStart(session, 0, OPEN_LAKE_2_AREA_ID).returnedFinds).toEqual([sharedId]);
    for (const area of AREAS.filter((candidate) => candidate.id !== OPEN_LAKE_2_AREA_ID)) {
      expect(tripStart(session, 0, area.id).returnedFinds, area.id).toEqual([]);
    }
    for (const seed of TRIP_SEEDS) expect(placedIds(session, seed), `seed ${seed}`).toContain(sharedId);
  });
});
