import type { Rarity, TreasureCategory } from './catalogue';
import type { LegStatus } from './legs';
import type { RealMorphId } from './morphs';
import type { RescueStatus } from './rescue';
import type { AreaStars } from './stars';

/**
 * Event names for a trip, shared between the game scene and the UI scene. The `TripSnapshot`
 * (`TRIP_EVENTS.STATE`) is the only scene to HUD trip channel. Values never repeat a `GAME_EVENTS` value.
 */
export const TRIP_EVENTS = Object.freeze({
  STATE: 'trip-state',
  REQUEST_KEEP_EXPLORING: 'request-keep-exploring',
  REQUEST_GO_HOME: 'request-go-home',
} as const);

export type TripEventName = (typeof TRIP_EVENTS)[keyof typeof TRIP_EVENTS];

/** One leg slot for the legs display; `progress` is 0..1 and rises while regrowing. */
export interface LegSlotSnapshot {
  status: LegStatus;
  progress: number;
}

/** Legs display state: one entry per slot in slot order, the present count and protected time. */
export interface LegsSnapshot {
  slots: LegSlotSnapshot[];
  present: number;
  protected: boolean;
}

/**
 * Trip phase: swimming, frozen at the Home Spot while the banked card shows, being carried home
 * after the fourth leg is lost, or ended at home.
 */
export type TripPhase = 'swimming' | 'banked' | 'carrying' | 'ended';

/**
 * How a trip ended: the player chose Go home, the axolotl was carried home, or it reached the open
 * exit and beat the area (PRD H5).
 */
export type TripEndReason = 'wentHome' | 'carriedHome' | 'areaBeaten';

/**
 * How an ended trip ended. `returned` is the find ids sent back to the world (carried home only).
 * `bankedThisTrip` is every find id banked during the trip, in banking order. `stars` is the stars
 * earned this trip, set only when the area was beaten (PRD H6).
 */
export interface TripEnding {
  reason: TripEndReason;
  returned: string[];
  bankedThisTrip: string[];
  stars?: AreaStars;
}

/** A found treasure as the pop-up shows it: its catalogue id, name, category and rarity. */
export interface FoundInfo {
  id: string;
  name: string;
  category: TreasureCategory;
  rarity: Rarity;
}

/**
 * A stranded axolotl as the HUD shows it: its find id, its morph, and whether it is waiting at its
 * place, following the player (in the Trip Bag, not safe yet) or safe (banked).
 */
export interface RescueSnapshot {
  id: string;
  morph: RealMorphId;
  status: RescueStatus;
}

/**
 * Trip display state. `bag` is the Trip Bag find ids in pickup order, including a following
 * axolotl, and `banked` the banked treasure count, not counting rescued axolotls. `inHomeSpot` is whether the axolotl centre is inside the Home Spot ring.
 * `justBanked` is the find ids of the latest banking, shown on the banked card. `found` is every
 * treasure picked up this trip, in pickup order, including ones banked since; it resets each trip.
 * `ending` is set only once the trip has ended. `found` never lists rescued axolotls.
 * `rescue` is this trip's stranded axolotl, or null when there is none. `factCardDue` is the id of
 * the first hazard or predator met this trip whose fact card is not seen yet, or null when none is.
 * `litGlowPlants` is the glow-plant ids lit this trip, in lighting order; every plant is unlit at a
 * new trip (issue #77, ND-8). `glowPlantHint` is the unlit glow-plant the hint points at, set only
 * while swimming after the hint clock reaches its time, else null.
 */
export interface TripSnapshot {
  phase: TripPhase;
  legs: LegsSnapshot;
  bag: string[];
  banked: number;
  inHomeSpot: boolean;
  justBanked: string[];
  found: FoundInfo[];
  ending: TripEnding | null;
  rescue: RescueSnapshot | null;
  factCardDue: string | null;
  litGlowPlants: string[];
  glowPlantHint: string | null;
}

/** Payload type for each event; `undefined` marks payload-less events. */
export interface TripEventPayloads {
  [TRIP_EVENTS.STATE]: TripSnapshot;
  [TRIP_EVENTS.REQUEST_KEEP_EXPLORING]: undefined;
  [TRIP_EVENTS.REQUEST_GO_HOME]: undefined;
}

/** Keys for trip values stored in the shared game registry. Values never repeat a `REGISTRY_KEYS` value. */
export const TRIP_REGISTRY_KEYS = Object.freeze({
  state: 'tripState',
  bankingHintShown: 'bankingHintShown',
} as const);

export type TripRegistryKey = (typeof TRIP_REGISTRY_KEYS)[keyof typeof TRIP_REGISTRY_KEYS];
