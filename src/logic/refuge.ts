import { areasLine } from './areaText';
import { AREAS, HABITATS, isAreaBeaten, type AreaData, type Habitat } from './areas';
import { MORPH_UNFOUND_NAME } from './morphs';
import type { AreaStarsRecord } from './stars';

/**
 * Registry key for the refuge's pending clean-ups and milestones. Never equals a `REGISTRY_KEYS`,
 * `TRIP_REGISTRY_KEYS`, `SESSION_REGISTRY_KEY` or `SAVE_GATE_REGISTRY_KEY` value, nor the dev
 * area or dev decor keys.
 */
export const REFUGE_REGISTRY_KEY = 'refuge';

/** Title of the Xochimilco refuge screen (PRD N2). */
export const REFUGE_TITLE = 'Xochimilco refuge';

/** Name shown on a hidden refuge section: no area of its habitat is beaten yet. */
export const REFUGE_HIDDEN_NAME = MORPH_UNFOUND_NAME;

/** Line at the end of the refuge: more sections come with later areas (PRD N2). */
export const REFUGE_MORE_TO_COME = 'More to come';

/** Button that plays a section's clean-up again. */
export const REFUGE_SEE_AGAIN_LABEL = 'See it again';

/** Title of the card shown when every area of a habitat is beaten, so its section is clean. */
export const REFUGE_MILESTONE_TITLE = 'All clean!';

/** Button that closes the refuge and goes back to exploring; the same words as the banking card. */
export { KEEP_EXPLORING_LABEL } from './tripText';

/** How far a refuge section is cleaned up: hidden until an area of its habitat is beaten. */
export type RefugeSectionState = 'hidden' | 'dirty' | 'clean';

/** One area's batch of trash in a refuge section, cleared once the area is beaten. */
export interface RefugeBatch {
  areaId: string;
  areaNumber: number;
  cleared: boolean;
}

/** One refuge section: a habitat and a batch of trash per area in it (PRD N2). */
export interface RefugeSection {
  habitatId: string;
  habitatName: string;
  /** Id of the habitat's art look. */
  look: string;
  /** Number of the habitat's first area in area-table order. */
  firstAreaNumber: number;
  state: RefugeSectionState;
  batches: RefugeBatch[];
}

/** Clean-ups and milestones still to show in the refuge: area ids and habitat ids. */
export interface RefugePending {
  cleanUps: readonly string[];
  milestones: readonly string[];
}

/** Nothing pending. */
export const EMPTY_REFUGE_PENDING: Readonly<RefugePending> = Object.freeze({
  cleanUps: Object.freeze([]),
  milestones: Object.freeze([]),
});

/** Hint on a hidden refuge section: the area that opens it. */
export function refugeHiddenHint(areaNumber: number): string {
  return `Beat Area ${areaNumber}`;
}

/**
 * The area line under a section's habitat name (issue #113, ND-8): the areas its batches come from,
 * such as "Area 1" or "Areas 2 and 3", or null for a hidden section, which shows none.
 */
export function refugeAreaLine(section: Readonly<RefugeSection>): string | null {
  if (section.state === 'hidden') return null;
  return areasLine(section.batches.map((batch) => batch.areaNumber));
}

/** A habitat name as a place in a sentence: "the canal". Same rule as the fact card hints. */
export function habitatPlace(habitatName: string): string {
  return `the ${habitatName.toLowerCase()}`;
}

/** Body of the milestone card for the axolotl named `name` and the habitat it cleaned up. */
export function milestoneBody(name: string, habitatName: string): string {
  return `You and ${name} cleaned up ${habitatPlace(habitatName)}! Real people in Xochimilco do this work too.`;
}

function createBatch(stars: AreaStarsRecord, area: Readonly<AreaData>): RefugeBatch {
  return { areaId: area.id, areaNumber: area.number, cleared: isAreaBeaten(stars, area.id) };
}

function sectionState(batches: readonly RefugeBatch[]): RefugeSectionState {
  if (batches.every((batch) => batch.cleared)) return 'clean';
  return batches.some((batch) => batch.cleared) ? 'dirty' : 'hidden';
}

function createSection(stars: AreaStarsRecord, habitat: Readonly<Habitat>, areas: readonly Readonly<AreaData>[]): RefugeSection {
  const batches = areas.filter((area) => area.habitatId === habitat.id).map((area) => createBatch(stars, area));
  return {
    habitatId: habitat.id,
    habitatName: habitat.name,
    look: habitat.look,
    firstAreaNumber: batches[0].areaNumber,
    state: sectionState(batches),
    batches,
  };
}

/** Ids of the habitats in `habitats` that hold an area, in the order of each one's first area. */
function habitatsInAreaOrder(
  areas: readonly Readonly<AreaData>[],
  habitats: readonly Readonly<Habitat>[],
): Readonly<Habitat>[] {
  const ids = [...new Set(areas.map((area) => area.habitatId))];
  return ids.flatMap((id) => habitats.filter((habitat) => habitat.id === id));
}

/**
 * The refuge sections: one per habitat with at least one area, in the order of each habitat's first
 * area. A section is hidden until an area in it is beaten, clean once every area in it is beaten,
 * else dirty. Each area has a batch, cleared once the area is beaten (PRD N2).
 */
export function refugeSections(
  stars: AreaStarsRecord,
  areas: readonly Readonly<AreaData>[] = AREAS,
  habitats: readonly Readonly<Habitat>[] = HABITATS,
): RefugeSection[] {
  return habitatsInAreaOrder(areas, habitats).map((habitat) => createSection(stars, habitat, areas));
}

/** Ids of the areas beaten in `after` but not in `before`, in area-table order. */
export function newlyBeatenAreaIds(
  before: AreaStarsRecord,
  after: AreaStarsRecord,
  areas: readonly Readonly<AreaData>[] = AREAS,
): string[] {
  return areas.filter((area) => !isAreaBeaten(before, area.id) && isAreaBeaten(after, area.id)).map((area) => area.id);
}

/** Ids of the habitats whose section is clean in `after` but not in `before`, in section order. */
export function newlyCleanHabitatIds(
  before: AreaStarsRecord,
  after: AreaStarsRecord,
  areas: readonly Readonly<AreaData>[] = AREAS,
  habitats: readonly Readonly<Habitat>[] = HABITATS,
): string[] {
  const cleanBefore = new Set(
    refugeSections(before, areas, habitats)
      .filter((section) => section.state === 'clean')
      .map((section) => section.habitatId),
  );
  return refugeSections(after, areas, habitats)
    .filter((section) => section.state === 'clean' && !cleanBefore.has(section.habitatId))
    .map((section) => section.habitatId);
}

/** The ids of `known` that are in `ids`, each once, in `known` order. */
function orderedKnownIds(ids: readonly unknown[], known: readonly string[]): string[] {
  return known.filter((id) => ids.includes(id));
}

function areaIds(areas: readonly Readonly<AreaData>[]): string[] {
  return areas.map((area) => area.id);
}

function sectionHabitatIds(areas: readonly Readonly<AreaData>[], habitats: readonly Readonly<Habitat>[]): string[] {
  return habitatsInAreaOrder(areas, habitats).map((habitat) => habitat.id);
}

/**
 * `pending` with the clean-ups and milestones of one trip added: the areas newly beaten and the
 * habitats newly clean between `before` and `after`. Each id once, in area-table and section order.
 */
export function withTripResult(
  pending: Readonly<RefugePending>,
  before: AreaStarsRecord,
  after: AreaStarsRecord,
  areas: readonly Readonly<AreaData>[] = AREAS,
  habitats: readonly Readonly<Habitat>[] = HABITATS,
): RefugePending {
  const cleanUps = [...pending.cleanUps, ...newlyBeatenAreaIds(before, after, areas)];
  const milestones = [...pending.milestones, ...newlyCleanHabitatIds(before, after, areas, habitats)];
  return {
    cleanUps: orderedKnownIds(cleanUps, areaIds(areas)),
    milestones: orderedKnownIds(milestones, sectionHabitatIds(areas, habitats)),
  };
}

function idList(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The pending clean-ups and milestones stored in the registry, repaired: only known area and section
 * habitat ids, each once, in area-table and section order. Anything else reads as nothing pending.
 */
export function refugePendingFrom(
  value: unknown,
  areas: readonly Readonly<AreaData>[] = AREAS,
  habitats: readonly Readonly<Habitat>[] = HABITATS,
): RefugePending {
  if (typeof value !== 'object' || value === null) return { cleanUps: [], milestones: [] };
  const stored = value as { cleanUps?: unknown; milestones?: unknown };
  return {
    cleanUps: orderedKnownIds(idList(stored.cleanUps), areaIds(areas)),
    milestones: orderedKnownIds(idList(stored.milestones), sectionHabitatIds(areas, habitats)),
  };
}

/** `pending` with no clean-ups; the milestones are unchanged. */
export function withoutCleanUps(pending: Readonly<RefugePending>): RefugePending {
  return { cleanUps: [], milestones: [...pending.milestones] };
}

/** `pending` without the milestone of `habitatId`; everything else is unchanged. */
export function withoutMilestone(pending: Readonly<RefugePending>, habitatId: string): RefugePending {
  return { cleanUps: [...pending.cleanUps], milestones: pending.milestones.filter((id) => id !== habitatId) };
}

/** Whether any clean-up is still to show. */
export function hasPendingCleanUps(pending: Readonly<RefugePending>): boolean {
  return pending.cleanUps.length > 0;
}
