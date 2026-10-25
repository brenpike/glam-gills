import { CHINAMPA_2_AREA_ID, CHINAMPA_2_LAYOUT } from './chinampa2Layout';
import { CHINAMPA_AREA_ID, CHINAMPA_LAYOUT } from './chinampaLayout';
import type { SnackDrift } from './collectibles';
import { REFUGE_FACT_CARDS, SHRIMP_FACT, TADPOLE_FACT, TILAPIA_FACT, type FactCard } from './factCards';
import type { ElementSpawn, HazardSpawn } from './hazards';
import type { MobileSnackMix } from './mobileSnacks';
import type { MovingHazardSpawn } from './movingHazards';
import type { PredatorRoute } from './predators';
import { POND_2_AREA_ID, POND_2_LAYOUT } from './pond2Layout';
import { POND_AREA_ID, POND_LAYOUT } from './pondLayout';
import { SNACK_DART, type SnackDartRule } from './snackDart';
import { bestStarsFor, starCount, type AreaStarsRecord } from './stars';
import { CANAL_AREA_ID, CANAL_LAYOUT, type AreaLayoutData, type Point } from './zone';

/** A habitat: a place that holds one or more areas, with its own look (PRD N2). */
export interface Habitat {
  id: string;
  name: string;
  /** Id of the habitat's art look. */
  look: string;
}

/** The canal habitat, home of Area 1. */
export const CANAL_HABITAT: Readonly<Habitat> = Object.freeze({ id: 'canal', name: 'Canal', look: 'canal' });

/** The lily pad pond habitat, home of Area 2. */
export const POND_HABITAT: Readonly<Habitat> = Object.freeze({ id: 'pond', name: 'Lily pad pond', look: 'pond' });

/** The chinampa gardens habitat, home of Areas 4 and 5. */
export const CHINAMPA_HABITAT: Readonly<Habitat> = Object.freeze({ id: 'chinampa', name: 'Chinampa gardens', look: 'chinampa' });

/** Every habitat. */
export const HABITATS: readonly Readonly<Habitat>[] = Object.freeze([CANAL_HABITAT, POND_HABITAT, CHINAMPA_HABITAT]);

/** The habitat with this id, or undefined when there is none. */
export function habitatById(id: string): Readonly<Habitat> | undefined {
  return HABITATS.find((habitat) => habitat.id === id);
}

/**
 * Id of an area's own look, a variant of its habitat's look: the pond at dusk for Area 3. The art
 * layer maps it to colours; this layer only names it.
 */
export type AreaLookVariant = 'pond-dusk';

/** An area's exit: a circle the axolotl centre reaches to leave. Inclusive edge. */
export interface AreaExit {
  x: number;
  y: number;
  radius: number;
}

/** Per-area data for the exit, the special treasure and how the snacks move (PRD H1 to H4, X9). */
export interface AreaData {
  id: string;
  /** 1-based area number shown to the player, such as "Area 1". */
  number: number;
  /** Id of the habitat the area is in. */
  habitatId: string;
  /** The area's fixed layout data; buildZone adds the seeded content. */
  layout: Readonly<AreaLayoutData>;
  exit: AreaExit;
  /** Catalogue id of the area's special treasure. */
  specialTreasureId: string;
  snackDrift: SnackDrift;
  /** The area's own look, a variant of its habitat's look; absent means the habitat's look. */
  look?: AreaLookVariant;
  /** Which of the area's snacks dart away a little (PRD H4, N2); absent means none dart. */
  snackDart?: Readonly<SnackDartRule>;
}

/** What touching the exit did this frame. */
export type ExitContact = 'beat' | 'closed' | 'none';

/** Area 1, the canal. */
export const CANAL_AREA: Readonly<AreaData> = Object.freeze({
  id: CANAL_AREA_ID,
  number: 1,
  habitatId: CANAL_HABITAT.id,
  layout: CANAL_LAYOUT,
  /**
   * Provisional exit at the far end of the main swim path, inside the swim bounds and clear of
   * every hiding spot by more than the exit radius plus the find pickup radius.
   */
  exit: Object.freeze({ x: 1850, y: 200, radius: 40 }),
  specialTreasureId: 'canal/toy-boat',
  /**
   * Provisional slow drift (PRD H4): peak speed about 11.9 px/s, below the 20 px/s a one-leg
   * axolotl makes against the strongest current. Peak offset about 17.9 px, less than the gap
   * between the snack start clearance and the Home Spot ring.
   */
  snackDrift: Object.freeze({ amplitudeX: 16, amplitudeY: 8, periodX: 10, periodY: 8 }),
});

/** Area 2, the lily pad pond. */
export const POND_AREA: Readonly<AreaData> = Object.freeze({
  id: POND_AREA_ID,
  number: 2,
  habitatId: POND_HABITAT.id,
  layout: POND_LAYOUT,
  /**
   * Provisional exit at the far end of the main swim path, past the stream, inside the swim
   * bounds and clear of every hiding spot by more than the exit radius plus the find pickup radius.
   */
  exit: Object.freeze({ x: 2330, y: 200, radius: 40 }),
  specialTreasureId: 'pond/frog-statue',
  /**
   * Provisional drift, a little faster than the canal (PRD H4): the canal's amplitudes with
   * shorter periods, peak speed about 14.8 px/s. That is below the 20 px/s a one-leg axolotl
   * makes against the stream and at most half the 40 px/s Snack magnet pull.
   */
  snackDrift: Object.freeze({ amplitudeX: 16, amplitudeY: 8, periodX: 8, periodY: 6.4 }),
});

/** Area 3, the lily pad pond at dusk, where the heron hunts. */
export const POND_2_AREA: Readonly<AreaData> = Object.freeze({
  id: POND_2_AREA_ID,
  number: 3,
  habitatId: POND_HABITAT.id,
  layout: POND_2_LAYOUT,
  /**
   * Provisional exit at the far end of the main swim path, past the stream and out of the heron's
   * reach, inside the swim bounds and clear of every hiding spot by more than the exit radius plus
   * the find pickup radius.
   */
  exit: Object.freeze({ x: 2810, y: 200, radius: 40 }),
  specialTreasureId: 'pond/wooden-duck-decoy',
  /**
   * Provisional drift, a little faster than Area 2 (PRD H4): the same amplitudes with shorter
   * periods, peak speed about 15.2 px/s. That is below the 16 px/s a one-leg axolotl makes against
   * the stream and at most half the 40 px/s Snack magnet pull.
   */
  snackDrift: Object.freeze({ amplitudeX: 16, amplitudeY: 8, periodX: 7.8, periodY: 6.24 }),
  look: 'pond-dusk',
  snackDart: SNACK_DART,
});

/** Area 4, the chinampa gardens, the first area two screens tall. */
export const CHINAMPA_AREA: Readonly<AreaData> = Object.freeze({
  id: CHINAMPA_AREA_ID,
  number: 4,
  habitatId: CHINAMPA_HABITAT.id,
  layout: CHINAMPA_LAYOUT,
  /**
   * Provisional exit deep in the bottom right, at the end of the main path's lane along the bed,
   * inside the swim bounds, out of the last tilapia's reach, clear of every ghost net and clear of
   * every hiding spot by more than the exit radius plus the find pickup radius.
   */
  exit: Object.freeze({ x: 2780, y: 625, radius: 40 }),
  specialTreasureId: 'chinampa/scarecrow',
  /**
   * Provisional drift, a little faster than Area 3 (PRD H4): the same amplitudes with shorter
   * periods, peak speed about 15.6 px/s. That is below the 18 px/s a one-leg axolotl makes against
   * the gap current and at most half the 40 px/s Snack magnet pull.
   */
  snackDrift: Object.freeze({ amplitudeX: 16, amplitudeY: 8, periodX: 7.6, periodY: 6.08 }),
  snackDart: SNACK_DART,
});

/** Area 5, the chinampa gardens again, the first U-turn area, where the garter snakes hunt. */
export const CHINAMPA_2_AREA: Readonly<AreaData> = Object.freeze({
  id: CHINAMPA_2_AREA_ID,
  number: 5,
  habitatId: CHINAMPA_HABITAT.id,
  layout: CHINAMPA_2_LAYOUT,
  /**
   * Provisional exit straight under the Home Spot, at the end of the main path back along the
   * bottom row, inside the swim bounds, out of the safe area and every predator's reach, clear of
   * every ghost net and mat, and clear of every hiding spot by more than the exit radius plus the
   * find pickup radius.
   */
  exit: Object.freeze({ x: 120, y: 625, radius: 40 }),
  specialTreasureId: 'chinampa/pinata',
  /**
   * Provisional drift, a little faster than Area 4 (PRD H4): the same amplitudes with shorter
   * periods, peak speed about 15.8 px/s. That is below the 17 px/s a one-leg axolotl makes against
   * the gap current and at most half the 40 px/s Snack magnet pull.
   */
  snackDrift: Object.freeze({ amplitudeX: 16, amplitudeY: 8, periodX: 7.5, periodY: 6.0 }),
  snackDart: SNACK_DART,
});

/** Every area, in area-number order. */
export const AREAS: readonly Readonly<AreaData>[] = Object.freeze([CANAL_AREA, POND_AREA, POND_2_AREA, CHINAMPA_AREA, CHINAMPA_2_AREA]);

/** The area with this id, or undefined when there is none. */
export function areaById(id: string): Readonly<AreaData> | undefined {
  return AREAS.find((area) => area.id === id);
}

/** Whether the exit is open: only when no snacks are left (PRD H2). */
export function exitOpen(snacksLeft: number): boolean {
  return snacksLeft === 0;
}

/** Whether a point is at the exit: centre distance at most the radius (inclusive). */
export function atExit(pos: Point, exit: AreaExit): boolean {
  return Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius;
}

/**
 * Result of the axolotl's exit contact this frame: 'beat' whenever it is at the open exit,
 * 'closed' only on the frame it enters the closed exit, otherwise 'none'.
 */
export function exitContact(wasAtExit: boolean, atExitNow: boolean, snacksLeft: number): ExitContact {
  if (!atExitNow) {
    return 'none';
  }
  if (exitOpen(snacksLeft)) {
    return 'beat';
  }
  return wasAtExit ? 'none' : 'closed';
}

/** The parts of area data or a zone layout that name its threats: hazards and predators. */
export interface ThreatSource {
  readonly tilapiaRoutes: readonly unknown[];
  readonly predatorRoutes: readonly Readonly<PredatorRoute>[];
  readonly hazards: readonly Readonly<HazardSpawn>[];
  /** Moving hazards (ND-8); absent means none. */
  readonly movingHazards?: readonly Readonly<MovingHazardSpawn>[];
}

/**
 * One threat: a hazard or predator id and its fact card. `dangerPart` true marks a danger part,
 * left out of the one-new-thing count (PRD open question 260, ND-13).
 */
interface Threat {
  id: string;
  fact: Readonly<FactCard>;
  dangerPart?: true;
}

/** Threats in order, the first of each id kept. */
function uniqueThreats(threats: readonly Threat[]): Threat[] {
  const seen = new Set<string>();
  return threats.filter((threat) => {
    if (seen.has(threat.id)) return false;
    seen.add(threat.id);
    return true;
  });
}

/**
 * The tilapia when there are tilapia routes, then each predator species, then each hazard type,
 * then each moving hazard type (ND-8), each id once.
 */
function listThreats(source: ThreatSource): Threat[] {
  const tilapia: Threat[] = source.tilapiaRoutes.length > 0 ? [{ id: 'tilapia', fact: TILAPIA_FACT }] : [];
  const predators = source.predatorRoutes.map(
    ({ species }): Threat => ({ id: species.id, fact: species.fact, dangerPart: species.dangerPart }),
  );
  const hazards = source.hazards.map((hazard): Threat => ({ id: hazard.type.id, fact: hazard.type.fact }));
  const movingHazards = (source.movingHazards ?? []).map(
    (spawn): Threat => ({ id: spawn.type.id, fact: spawn.type.fact, dangerPart: spawn.type.dangerPart }),
  );
  return uniqueThreats([...tilapia, ...predators, ...hazards, ...movingHazards]);
}

/**
 * The parts of area data or a zone layout that name its fact cards: its threats, its elements and
 * its mobile snacks.
 */
export interface FactCardSource extends ThreatSource {
  readonly elements: readonly Readonly<ElementSpawn>[];
  /** Mobile snacks (ND-23); absent means none. */
  readonly mobileSnacks?: Readonly<MobileSnackMix>;
}

/** An area's fact card ids and cards, in the same order. */
export interface SourceFactCards {
  ids: string[];
  cards: Readonly<FactCard>[];
}

/** Each element type that carries a fact card, in element order. */
function listElementCards(elements: readonly Readonly<ElementSpawn>[]): Threat[] {
  return elements.flatMap((element): Threat[] => {
    const { fact } = element.type;
    return fact === undefined ? [] : [{ id: element.type.id, fact }];
  });
}

/**
 * The card of each mobile snack type the area has, tadpole first (ND-29): the tadpole when it has a
 * tadpole wander loop, the shrimp when it has a shrimp home (issue #131, ND-13).
 */
function listSnackCards(mix: Readonly<MobileSnackMix> | undefined): Threat[] {
  if (mix === undefined) return [];
  const tadpole: Threat[] = mix.wanders.length > 0 ? [{ id: TADPOLE_FACT.id, fact: TADPOLE_FACT }] : [];
  const shrimp: Threat[] = mix.homes.length > 0 ? [{ id: SHRIMP_FACT.id, fact: SHRIMP_FACT }] : [];
  return [...tadpole, ...shrimp];
}

/**
 * The threats (listThreats order), then the element types that carry a fact card, then the mobile
 * snack types (listSnackCards order), each id once.
 */
function listFactCards(source: FactCardSource): Threat[] {
  return uniqueThreats([...listThreats(source), ...listElementCards(source.elements), ...listSnackCards(source.mobileSnacks)]);
}

/**
 * An area's fact card ids and cards: its hazard and predator cards in threatIds order, then the
 * card of each element type that carries one, in element order, then the card of each mobile snack
 * type it has, tadpole first (ND-29), each id once.
 */
export function sourceFactCards(source: FactCardSource): SourceFactCards {
  const cards = listFactCards(source);
  return { ids: cards.map((card) => card.id), cards: cards.map((card) => card.fact) };
}

/**
 * Ids of every hazard and predator in an area, each once: 'tilapia' when it has tilapia routes,
 * then predator species ids, then hazard type ids (leg-costing and slow-only alike), then moving
 * hazard type ids. Danger parts are included (ND-13).
 */
export function threatIds(source: ThreatSource): string[] {
  return listThreats(source).map((threat) => threat.id);
}

/** The fact card of each of an area's hazards and predators, in threatIds order. */
export function threatFactCards(source: ThreatSource): Readonly<FactCard>[] {
  return listThreats(source).map((threat) => threat.fact);
}

/**
 * Every fact card of these areas, in area-table order, each once: per area its hazard and predator
 * cards, then its element cards (sourceFactCards order).
 */
export function areaFactCards(areas: readonly Readonly<AreaData>[] = AREAS): Readonly<FactCard>[] {
  return uniqueThreats(areas.flatMap((area) => listFactCards(area.layout))).map((threat) => threat.fact);
}

/**
 * Every fact card found by playing, in Collection Book order: these areas' hazard, predator and
 * element cards (areaFactCards order), then the refuge cards (REFUGE_FACT_CARDS order).
 */
export function bookFactCards(areas: readonly Readonly<AreaData>[] = AREAS): Readonly<FactCard>[] {
  return [...areaFactCards(areas), ...REFUGE_FACT_CARDS];
}

/** What one area adds that no earlier area has: threat ids and element type ids (PRD N2). */
export interface NewThings {
  areaId: string;
  threats: string[];
  elements: string[];
}

/** Ids in `ids` not yet in `seen`, each once; adds them to `seen`. */
function takeNewIds(ids: readonly string[], seen: Set<string>): string[] {
  const fresh = [...new Set(ids)].filter((id) => !seen.has(id));
  for (const id of fresh) seen.add(id);
  return fresh;
}

/** Ids of an area's threats that count toward the one-new-thing rule: every threat but the danger parts (ND-13). */
function countedThreatIds(source: ThreatSource): string[] {
  return listThreats(source)
    .filter((threat) => threat.dangerPart !== true)
    .map((threat) => threat.id);
}

/**
 * Per area, in area order, the hazards or predators and the timing or puzzle elements that no
 * earlier area has. Carried-forward ids are not new. Danger parts and mobile snack types are never
 * counted (ND-13, ND-27).
 */
export function newThingsByArea(areas: readonly Readonly<AreaData>[] = AREAS): NewThings[] {
  const seenThreats = new Set<string>();
  const seenElements = new Set<string>();
  return areas.map((area) => ({
    areaId: area.id,
    threats: takeNewIds(countedThreatIds(area.layout), seenThreats),
    elements: takeNewIds(
      area.layout.elements.map((element) => element.type.id),
      seenElements,
    ),
  }));
}

/** Whether an area is beaten: its exit star is recorded (PRD N2). */
export function isAreaBeaten(stars: AreaStarsRecord, areaId: string): boolean {
  return bestStarsFor(stars, areaId).exit;
}

/**
 * Ids of the unlocked areas, in area order: the first area always, and each later area when the
 * one before it is unlocked and beaten. There are no star gates. The unlocked areas are always a
 * run from the first area: the run stops at the first area not beaten, so stars saved for a later
 * area (a damaged or edited save, or areas reordered by an update) never unlock past a locked one.
 */
export function unlockedAreaIds(stars: AreaStarsRecord, areas: readonly Readonly<AreaData>[] = AREAS): string[] {
  const unlocked: string[] = [];
  for (const area of areas) {
    unlocked.push(area.id);
    if (!isAreaBeaten(stars, area.id)) break;
  }
  return unlocked;
}

/** Whether the area with this id is unlocked; false for an unknown id. */
export function isAreaUnlocked(
  stars: AreaStarsRecord,
  areaId: string,
  areas: readonly Readonly<AreaData>[] = AREAS,
): boolean {
  return unlockedAreaIds(stars, areas).includes(areaId);
}

/** Id of the last unlocked area in area order. Throws when there are no areas. */
export function newestUnlockedAreaId(stars: AreaStarsRecord, areas: readonly Readonly<AreaData>[] = AREAS): string {
  const unlocked = unlockedAreaIds(stars, areas);
  if (unlocked.length === 0) {
    throw new Error('newestUnlockedAreaId: there are no areas');
  }
  return unlocked[unlocked.length - 1];
}

/** Whether the area is new: the newest unlocked area with no stars yet. */
export function isNewArea(stars: AreaStarsRecord, areaId: string, areas: readonly Readonly<AreaData>[] = AREAS): boolean {
  return areaId === newestUnlockedAreaId(stars, areas) && starCount(bestStarsFor(stars, areaId)) === 0;
}

/** The saved area id when it names an unlocked area, else the newest unlocked area. */
export function resolveAreaId(saved: unknown, stars: AreaStarsRecord, areas: readonly Readonly<AreaData>[] = AREAS): string {
  if (typeof saved === 'string' && isAreaUnlocked(stars, saved, areas)) {
    return saved;
  }
  return newestUnlockedAreaId(stars, areas);
}
