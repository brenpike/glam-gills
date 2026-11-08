/**
 * Pure sharp litter rules (issue #213): Area 14's one new hazard. A dented can or a bottle with a
 * chipped neck lies still on a pit floor. It never moves and never pushes: a body centre within its
 * touch reach costs one leg through the shared hit path (encounter.ts applyHazard), from the litter's
 * centre, and the Shell may block that hit. As a hazard type that costs a leg, it is a hiding-risk
 * threat (hiding.ts zoneThreats) and the snacks keep their hazard clearance from it. It is met within
 * SHARP_LITTER_MEET_RANGE of its edge, with the "Litter in the water" card. The darkness never hides
 * it (glowPlants.ts DARK_SHOWN_PARTS, 'hazard').
 */
import { SHARP_LITTER_FACT, SHARP_LITTER_MEET_RANGE } from './factCards';
import type { HazardCircle, HazardSpawn, HazardType, LitterKind } from './hazards';
import { GHOST_NETS } from './tuning';
import type { Point } from './zone';

/** Radius in px of a piece of sharp litter's circle, measured from its centre. */
export const SHARP_LITTER_RADIUS = 10;

/**
 * The sharp litter hazard type (issue #213): touching it costs a leg. Its 18 px touch reach is the
 * ghost net's and the pelican line's, the Medium body's half height, so a body centre within
 * SHARP_LITTER_RADIUS + 18 = 28 px of the litter's centre is hit. Met within SHARP_LITTER_MEET_RANGE
 * of its edge, the same as the lure's.
 */
export const SHARP_LITTER: Readonly<HazardType> = Object.freeze({
  id: 'sharp-litter',
  name: 'Sharp litter',
  costsLeg: true,
  reach: GHOST_NETS.reach,
  meetRange: SHARP_LITTER_MEET_RANGE,
  fact: SHARP_LITTER_FACT,
});

/** A hazard spawn that is a piece of sharp litter: its circle and its kind. */
export type LitterSpawn = HazardSpawn & { readonly shape: HazardCircle; readonly litter: LitterKind };

/**
 * A sharp litter spawn for area data (issue #213): a `kind` piece of litter centred on `at`, with
 * SHARP_LITTER_RADIUS. Area data names it `<area id>/litter-<n>`, n from 1. Throws RangeError when
 * the place is not finite or `kind` is not a litter kind.
 */
export function litterSpawn(id: string, at: Readonly<Point>, kind: LitterKind): LitterSpawn {
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) {
    throw new RangeError(`litterSpawn ${id}: place (${at.x}, ${at.y}) must be finite`);
  }
  if (kind !== 'can' && kind !== 'bottle') {
    throw new RangeError(`litterSpawn ${id}: kind ${String(kind)} must be 'can' or 'bottle'`);
  }
  return { id, type: SHARP_LITTER, shape: { kind: 'circle', x: at.x, y: at.y, r: SHARP_LITTER_RADIUS }, litter: kind };
}

/** True when the hazard is a piece of sharp litter: its type is sharp litter, its shape a circle and it has a kind. */
export function isLitter(hazard: Readonly<HazardSpawn>): hazard is Readonly<LitterSpawn> {
  return hazard.type.id === SHARP_LITTER.id && hazard.shape.kind === 'circle' && hazard.litter !== undefined;
}

/** The hazards that are sharp litter, in hazard order. */
export function litters(hazards: readonly Readonly<HazardSpawn>[]): Readonly<LitterSpawn>[] {
  return hazards.filter(isLitter);
}
