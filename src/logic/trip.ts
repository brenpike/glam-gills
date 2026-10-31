import { areaById, type AreaData } from './areas';
import { treasureById } from './catalogue';
import type { DrawnBody } from './collectibles';
import {
  createEncounter,
  createEncounterContext,
  feedEncounter,
  predatorSpecies,
  stepEncounter,
  type EncounterContext,
  type EncounterEvent,
  type EncounterSource,
  type EncounterState,
} from './encounter';
import { metThreatIds, type ThreatSighting } from './factCards';
import { createGhostNets, endSnag, isSnagged, stepGhostNets, type GhostNetState } from './ghostNets';
import {
  darkHintPlant,
  inDarkWater,
  lightGlowPlants,
  stepDarkHintClock,
  type DarkWater,
} from './glowPlants';
import { elementSweep, hazardShapeAt, shapeDistance, type ElementSpawn } from './hazards';
import { zoneThreats } from './hiding';
import { createLegs, isProtected, presentCount, quantizeProgress, type LegsState } from './legs';
import { isAxolotlFindId, type RealMorphId } from './morphs';
import { movingHazardSweep } from './movingHazards';
import { DEFAULT_TRIP_SEED, nextTripSeed, placeTreasures, type PlacedFind } from './placement';
import {
  createPlasticWorms,
  eatPlasticWorm,
  endQueasy,
  tickQueasy,
  type PlasticWormState,
  type SpitAvoid,
} from './plasticWorms';
import { earnStars, type AreaStars } from './stars';
import {
  createRescue,
  reachesRescue,
  rescueStatus,
  sendRescueBack,
  stepFollower,
  stepToRest,
  type RescueState,
  type Stranding,
} from './rescue';
import {
  bankAll,
  createHoldings,
  isHeld,
  pickUp,
  returnTripBag,
  type FindId,
  type Holdings,
} from './tripBag';
import {
  createTrajineraLane,
  stepTrajineraLane,
  type TrajineraLane,
  type TrajineraPush,
} from './trajineras';
import type { FoundInfo, LegsSnapshot, RescueSnapshot, TripEnding, TripPhase, TripSnapshot } from './tripEvents';
import {
  CARRY,
  FINDS,
  LEGS,
  SWIM,
  TILAPIA,
  tripTreasureTuning,
  type CarryTuning,
  type FindTuning,
  type LegTuning,
  type PlasticWormTuning,
} from './tuning';
import type { Vec2 } from './vec';
import {
  inHomeSpot as isInHomeSpot,
  swimBounds,
  type FindSpawn,
  type HidingSpot,
  type HomeSpot,
  type Point,
  type ZoneLayout,
} from './zone';

/** Regrow progress levels shown by the legs display. */
export const LEG_PROGRESS_STEPS = 10;

/**
 * The zone parts a trip is built from: the encounter parts, the area id, the Home Spot start point
 * and ring, the finds (treasure pools), the hiding spots, the main swim path, the elements (none
 * when absent) and the dark water (none when absent). The gliding trajineras (none when absent)
 * read the area's width, bed top and rock walls (none when absent) for where a push may go.
 */
export type TripSource = EncounterSource &
  Pick<ZoneLayout, 'areaId' | 'start' | 'homeSpot' | 'finds' | 'spots' | 'mainPath' | 'darkWater'> &
  Partial<Pick<ZoneLayout, 'width' | 'bedTop' | 'rockWalls' | 'trajineras'>> & {
    elements?: readonly Readonly<ElementSpawn>[];
  };

/**
 * The carried-home transition. `pos` is the axolotl centre, moving from `from` to `to`
 * over `duration` seconds. `still` (reduced motion) keeps `pos` at `from` until arrival.
 * `still` follows reduced motion on every carrying step; each switch starts a new segment from `pos`.
 */
export interface CarryState {
  from: Point;
  to: Point;
  pos: Point;
  elapsed: number;
  duration: number;
  still: boolean;
}

/**
 * One trip. Immutable: `stepTrip` returns a new object.
 * `carry` is null while swimming and set once the carry starts.
 * `areaId` is the trip's area and `mainPath` its main swim path. `finds` is the treasure pools and
 * `spots` the hiding spots; `tripSeed` picked this trip's `placed` treasures, the treasures picked
 * for this trip, each with its Dash pot state. `touchingPots` is the
 * ids of the sealed pots the axolotl touched on the latest swimming step. `found` is every id
 * picked up this trip, in pickup order, including ones banked since.
 * `holdings` is the Trip Bag and the banked finds. `inHomeSpot` is whether the axolotl centre was
 * inside the Home Spot ring on the latest swimming step. `bankedThisTrip` is every find id banked
 * during this trip and `justBanked` the ids of the latest banking (empty once the player keeps
 * exploring). `heldAt` is where the axolotl is held while 'banked', else null. `ending` is set only
 * in 'ended'. `rescue` is this trip's stranded axolotl, or null when there is none; once reached its
 * id is a Trip Bag find like any other. `factCardsSeen` is the hazard and predator ids whose fact
 * cards were seen, before or during this trip, and `met` the hazard, moving hazard type, predator,
 * element and snack type ids the axolotl met this trip, in meet order.
 * `legsLost` is how many legs hits took this trip, from predators, hazards and moving hazards; a leg
 * grown back still counts.
 * `plasticWorms` is where each plastic worm is and the explorer's queasy time left; queasy time
 * runs only on swimming steps, ends when the carry starts or the trip ends, and never affects a
 * following stranded axolotl.
 * `ghostNets` is the ghost nets and the explorer's snag time left; snag time runs only on swimming
 * steps, ends when the carry starts or the trip ends, and never affects a following stranded axolotl.
 * `elements` is the trip's timing and puzzle elements and `elementTime` their clock in seconds: 0
 * when the trip starts, and it advances only on swimming steps, so it stops while paused, banked,
 * carrying or ended. A drifting ghost net is where `hazardShapeAt` puts it at `elementTime` (ND-11,
 * PRD open question 258).
 * `darkWater` is the area's dark water, or null when the whole area is lit. `litGlowPlants` is the
 * glow-plant element ids lit this trip, in lighting order; they are trip state only, never saved,
 * so every plant is unlit at a new trip. `darkHintTime` is the hint clock (stepDarkHintClock) in
 * seconds and `darkHint` the unlit plant the hint points at, or null (issue #77, ND-8).
 * `trajineras` is the trip's gliding trajineras and their push cooldowns, or null when the area has
 * none (issue #78, ND-8); each boat's hull is where trajineraHull puts it at `elementTime`, and it is
 * solid: each swimming step holds the axolotl centre out of it (stepTrajineraLane), and the hold is
 * the step result's `outOfHull`. The lane's rules (createTrajineraLane) leave every hull a way down.
 */
export interface TripState {
  phase: TripPhase;
  home: Point;
  encounter: EncounterState;
  carry: CarryState | null;
  homeSpot: HomeSpot;
  areaId: string;
  mainPath: Point[];
  finds: FindSpawn[];
  spots: HidingSpot[];
  tripSeed: number;
  placed: PlacedFind[];
  touchingPots: FindId[];
  found: FindId[];
  holdings: Holdings;
  inHomeSpot: boolean;
  bankedThisTrip: FindId[];
  justBanked: FindId[];
  heldAt: Point | null;
  ending: TripEnding | null;
  rescue: RescueState | null;
  factCardsSeen: string[];
  met: string[];
  legsLost: number;
  plasticWorms: PlasticWormState;
  ghostNets: GhostNetState;
  elements: ElementSpawn[];
  elementTime: number;
  darkWater: DarkWater | null;
  litGlowPlants: string[];
  darkHintTime: number;
  darkHint: string | null;
  trajineras: TrajineraLane | null;
}

/**
 * Optional trip start data: this trip's stranded axolotl (none by default), the hazard and
 * predator ids whose fact cards were already seen (none by default), the treasures lost on the last trip
 * (`returnedFinds`, none by default), which are always placed this trip (PRD A12, B9), and the
 * trip's area (`area`), read for its special treasure in place of looking the area id up in AREAS;
 * a dev area, which is never in AREAS, passes it.
 */
export interface TripOptions {
  stranding?: Stranding | null;
  factCardsSeen?: readonly string[];
  returnedFinds?: readonly FindId[];
  area?: Readonly<AreaData>;
}

/**
 * What the stars of a beaten area depend on beyond the trip: the area's special treasure id. The
 * rescue part of star 3 comes from the trip itself: a rescue banked this trip, at the Home Spot or
 * the exit, or no leg lost this trip (PRD H6).
 */
export interface StarContext {
  specialTreasureId: string;
}

/** Encounter context, carry tuning and find tuning for a trip step. */
export interface TripContext {
  encounter: EncounterContext;
  carry: CarryTuning;
  finds: FindTuning;
}

/**
 * Input for one trip step: the axolotl centre, whether reduced motion is on and whether a Tail
 * Dash is active this step.
 */
export interface TripInput {
  axolotlPos: Point;
  reduced: boolean;
  dashing: boolean;
}

/**
 * Trip events, in the order they happened within the step. Encounter events pass through,
 * except `carriedHome`, which the trip replaces with `carryStart` and `arrivedHome`.
 * `containerBroken` is a Tail Dash breaking the Dash pot at `spotId`; `dashNeeded` is the axolotl
 * starting to touch a sealed pot without dashing. `pickedUp` is one treasure going into the Trip
 * Bag, with its pop-up data. `at` is the spot position. `rescued` is the stranded axolotl going into
 * the Trip Bag, with `at` its position; it carries no pop-up data. `banked` is the ids moved from the
 * bag to banked, in bag order. `arrivedHome.returned` is the Trip Bag ids sent back to the world.
 * `wormSpat` is the explorer eating plastic worm `id` and spitting it from `from` to `to`.
 * `snagged` is the explorer, with its centre at `at`, entering the reach of ghost net `id` and a
 * new snag starting.
 */
export type TripEvent =
  | Exclude<EncounterEvent, { type: 'carriedHome' }>
  | { type: 'containerBroken'; id: FindId; spotId: string; at: Point }
  | { type: 'dashNeeded'; id: FindId; spotId: string; at: Point }
  | { type: 'pickedUp'; id: FindId; spotId: string; at: Point; found: FoundInfo }
  | { type: 'rescued'; id: FindId; morph: RealMorphId; at: Point }
  | { type: 'banked'; ids: FindId[] }
  | { type: 'carryStart'; from: Point; still: boolean }
  | { type: 'arrivedHome'; still: boolean; returned: FindId[] }
  | { type: 'wormSpat'; id: string; from: Point; to: Point }
  | { type: 'snagged'; id: string; at: Point };

/**
 * Result of a trip step or a trip action. `impulse` is set only on a swimming step with a bump or a
 * trajinera push that did not bank: the velocity in px/s to give the axolotl. `pushed` is set only
 * on a swimming step where a gliding trajinera's hull pushed the axolotl aside (issue #78, ND-8),
 * and `impulse` is then that push's. `outOfHull` is set only on a swimming step that neither banks
 * nor starts the carry and where a gliding trajinera's hull held the axolotl out (issue #78, ND-8,
 * ND-9): the axolotl centre after the hold, a copy, which differs from `axolotlPos`; on a push step
 * it equals `pushed.to`. Each optional key is absent, never undefined-valued, when not set.
 */
export interface TripStepResult {
  state: TripState;
  events: TripEvent[];
  impulse?: Vec2;
  pushed?: TrajineraPush;
  outOfHull?: Point;
}

type PassedEncounterEvent = Exclude<EncounterEvent, { type: 'carriedHome' }>;

// INVARIANT: frozen and shared; no caller mutates the events of a trip step result.
const NO_EVENTS = Object.freeze<TripEvent[]>([]) as TripEvent[];

/** Default context: the default encounter context and the shared carry and find tuning. */
export function createTripContext(overrides: Partial<TripContext> = {}): TripContext {
  return { encounter: createEncounterContext(), carry: CARRY, finds: FINDS, ...overrides };
}

/** The trip's area: `area` when given, else the AREAS entry for `areaId`. Throws when `area` has another id. */
function tripArea(areaId: string, area: Readonly<AreaData> | undefined): Readonly<AreaData> | undefined {
  if (area === undefined) {
    return areaById(areaId);
  }
  if (area.id !== areaId) {
    throw new Error(`createTrip: options.area ${area.id} is not the trip's area ${areaId}`);
  }
  return area;
}

/**
 * Starts a trip: swimming from the Home Spot with a fresh encounter, an empty Trip Bag and the
 * given `banked` find ids (de-duplicated). `tripSeed` picks a few unbanked treasures for this trip
 * with the area's trip treasure tuning, and places each in a spot from its pool, with every Dash
 * pot sealed (PRD B4). `options.returnedFinds`, the treasures lost on the last trip, are always
 * placed; the area's special treasure is always placed while unbanked, on top of the treasure
 * slots (B9, H6). The area is `options.area` when given, else the AREAS entry for the source's
 * area id. Spots on the rarity's risky side of the area's threats are picked more often (issue #70);
 * the source's own tilapia tuning, when set, sets its tilapia threats' lunge range and is played by
 * the encounter. `options.stranding` sets this trip's stranded axolotl, waiting at its place; it never changes the
 * placement. A plastic worm waits at the centre of each plastic worm hazard of the source, and the
 * axolotl starts not queasy; worms never change the placement. The source's ghost net hazards are
 * the trip's nets, and the axolotl starts not snagged; nets never change the placement here. The
 * source's elements are the trip's elements, with the element clock at 0. The source's dark water
 * is the trip's, with every glow-plant unlit, the hint clock at 0 and no hint. The source's gliding
 * trajineras are the trip's, each push cooldown at 0, kept in the swim bounds of the source's width
 * and bed top and out of its rock walls. Throws when a pool cannot be placed, `options.area` is not
 * the source's area, or the source has trajineras but no width or bed top. Throws createTrajineraLane's
 * RangeError when, for some boat, the row a body reach under its hull band is out of the swim bounds
 * or meets rock, or two boats' spans are less than twice the body reach apart.
 */
export function createTrip(
  source: TripSource,
  legTuning: Pick<LegTuning, 'count'> = LEGS,
  banked: readonly FindId[] = [],
  tripSeed: number = DEFAULT_TRIP_SEED,
  options: TripOptions = {},
): TripState {
  const holdings = createHoldings(banked);
  const special = tripArea(source.areaId, options.area)?.specialTreasureId;
  const placed = placeTreasures(source.finds, source.spots, holdings.banked, tripSeed, {
    mustPlace: options.returnedFinds ?? [],
    extras: special ? [special] : [],
    tuning: tripTreasureTuning(source.areaId),
    mainPath: source.mainPath,
    tilapiaRoutes: source.tilapiaRoutes,
    lungeRange: source.tilapia?.lungeRange ?? TILAPIA.lungeRange,
    threats: zoneThreats(source),
  });
  return {
    phase: 'swimming',
    home: { x: source.start.x, y: source.start.y },
    encounter: createEncounter(source, legTuning),
    carry: null,
    homeSpot: { x: source.homeSpot.x, y: source.homeSpot.y, radius: source.homeSpot.radius },
    areaId: source.areaId,
    mainPath: source.mainPath.map((point) => ({ x: point.x, y: point.y })),
    finds: source.finds.map((find) => ({ id: find.id, pool: [...find.pool] })),
    spots: source.spots.map((spot) => ({ ...spot })),
    tripSeed,
    placed,
    touchingPots: [],
    found: [],
    holdings,
    inHomeSpot: isInHomeSpot(source.start, source.homeSpot),
    bankedThisTrip: [],
    justBanked: [],
    heldAt: null,
    ending: null,
    rescue: options.stranding ? createRescue(options.stranding) : null,
    factCardsSeen: [...(options.factCardsSeen ?? [])],
    met: [],
    legsLost: 0,
    plasticWorms: createPlasticWorms(source.hazards ?? []),
    ghostNets: createGhostNets(source.hazards ?? []),
    elements: (source.elements ?? []).map(copyTripElement),
    elementTime: 0,
    darkWater: source.darkWater ? { ...source.darkWater } : null,
    litGlowPlants: [],
    darkHintTime: 0,
    darkHint: null,
    trajineras: tripTrajineras(source),
  };
}

/** A copy of the element sharing its type; the mat pair, glow-plant, pebble and trajinera geometry, when set, are copied. */
function copyTripElement(element: Readonly<ElementSpawn>): ElementSpawn {
  return {
    ...element,
    ...(element.matPair ? { matPair: { ...element.matPair } } : {}),
    ...(element.glowPlant ? { glowPlant: { ...element.glowPlant } } : {}),
    ...(element.pebble ? { pebble: { ...element.pebble } } : {}),
    ...(element.trajinera ? { trajinera: { ...element.trajinera } } : {}),
  };
}

/**
 * The source's gliding trajineras as a new trip's lane (issue #78, ND-8), or null when it has none.
 * Throws RangeError when it has trajineras but no width or bed top.
 */
function tripTrajineras(source: TripSource): TrajineraLane | null {
  const boats = source.trajineras ?? [];
  if (boats.length === 0) return null;
  const { width, bedTop } = source;
  if (width === undefined || bedTop === undefined) {
    throw new RangeError(`createTrip: ${source.areaId} has trajineras but no width or bed top`);
  }
  return createTrajineraLane(boats, swimBounds({ width, bedTop }), source.rockWalls ?? []);
}

/**
 * Starts the next trip from an ended one, with the same area, Home Spot, routes, tilapia tuning,
 * finds, spots, main swim path, dark water, leg count and banked finds, an empty Trip Bag and
 * nothing found. Every glow-plant is unlit again, with the hint clock at 0 and no hint.
 * `tripSeed` (default: the seed after this trip's) picks this trip's treasures afresh, and every
 * Dash pot is sealed again. The treasures returned when carried home (`ending.returned`) come back this trip, always
 * placed, and the area's special treasure is always placed while unbanked, on top of the treasure
 * slots. Every plastic worm is back at its spawn and the axolotl is neither queasy nor snagged. The
 * elements, moving hazards and gliding trajineras are the same, and the element clock and the
 * moving hazard clock are back at 0, with every push cooldown at 0. It
 * passes no other trip options, so the new trip has no stranded axolotl and every fact card counts
 * as unseen. Any other phase returns the input state unchanged.
 */
export function newTrip(state: TripState, tripSeed: number = nextTripSeed(state.tripSeed)): TripState {
  if (state.phase !== 'ended') return state;
  const next = createTrip(
    {
      ...state.encounter,
      areaId: state.areaId,
      start: state.home,
      homeSpot: state.homeSpot,
      finds: state.finds,
      spots: state.spots,
      mainPath: state.mainPath,
      elements: state.elements,
      ...(state.darkWater ? { darkWater: state.darkWater } : {}),
    },
    { count: state.encounter.legs.slots.length },
    state.holdings.banked,
    tripSeed,
    { returnedFinds: state.ending?.returned ?? [] },
  );
  const lane = state.trajineras;
  return lane ? { ...next, trajineras: createTrajineraLane(lane.boats, lane.bounds, lane.rocks) } : next;
}

/**
 * Leaves the banked card: back to swimming from where the axolotl was held, with `justBanked`
 * cleared. Any other phase returns the input state unchanged.
 */
export function keepExploring(state: TripState): TripState {
  if (state.phase !== 'banked') return state;
  return { ...state, phase: 'swimming', justBanked: [], heldAt: null };
}

/**
 * The trip with the fact card of hazard or predator `id` seen, so it is no longer due (the player
 * closed it). Every other field is unchanged; a trip where it was already seen is returned as is.
 */
export function markFactCardSeen(state: TripState, id: string): TripState {
  if (state.factCardsSeen.includes(id)) return state;
  return { ...state, factCardsSeen: [...state.factCardsSeen, id] };
}

/**
 * The trip with each snack type id in `ids` met (ND-29, PRD open question 276, A21): the ids not
 * already in `met` are appended, in `ids` order and each once, so a card not seen yet comes due
 * through the same rule as every other met id. Returns `state` itself when nothing is new.
 */
export function meetSnacks(state: TripState, ids: readonly string[]): TripState {
  let met = state.met;
  for (const id of ids) {
    if (met.includes(id)) continue;
    if (met === state.met) met = [...state.met];
    met.push(id);
  }
  return met === state.met ? state : { ...state, met };
}

/**
 * Ends the trip by choice. Allowed while 'banked', or while swimming inside the Home Spot ring;
 * any other case returns the input state unchanged with no events. Banks the Trip Bag first
 * (emitting `banked` when it was not empty), then ends with reason 'wentHome', nothing returned,
 * and every id banked this trip. Queasy time and snag time end.
 */
export function goHome(state: TripState): TripStepResult {
  const allowed = state.phase === 'banked' || (state.phase === 'swimming' && state.inHomeSpot);
  if (!allowed) return { state, events: [] };
  const events: TripEvent[] = [];
  const banking = bankFinds(state);
  if (banking.ids.length > 0) events.push({ type: 'banked', ids: [...banking.ids] });
  const next = banking.state;
  const ending: TripEnding = { reason: 'wentHome', returned: [], bankedThisTrip: [...next.bankedThisTrip] };
  const plasticWorms = endQueasy(next.plasticWorms);
  const ghostNets = endSnag(next.ghostNets);
  return { state: { ...next, phase: 'ended', heldAt: null, ending, plasticWorms, ghostNets }, events };
}

/**
 * Applies `snacks` eaten snacks to leg regrowth (PRD A19) with `feedEncounter`. Takes only a
 * count, so it does not matter how a snack reached the axolotl. Any phase other than 'swimming',
 * or snacks that change no leg, return the input state unchanged with no events. Otherwise only
 * the encounter legs change: snacks are not trip finds, so the Trip Bag, finds and banking are
 * untouched. Regrowth events pass through as in `stepTrip`; `boosted` is the slot each snack
 * helped, in eating order. Throws RangeError for an invalid `snacks` count while swimming.
 */
export function eatSnacks(
  state: TripState,
  snacks: number,
  ctx: TripContext = createTripContext(),
): TripStepResult & { boosted: number[] } {
  if (state.phase !== 'swimming') return { state, events: [], boosted: [] };
  const result = feedEncounter(state.encounter, snacks, ctx.encounter);
  if (result.state === state.encounter) return { state, events: [], boosted: [] };
  return {
    state: { ...state, encounter: result.state },
    events: result.events.filter(isPassedEvent),
    boosted: result.boosted,
  };
}

/**
 * The explorer eats the first plastic worm in reach of the head reach centre of `body` and spits
 * it out (`eatPlasticWorm`): queasy time starts and only that worm moves, landing clear of
 * `avoid`. Allowed only while swimming. Any other phase, a queasy axolotl (no stacking) or no worm
 * in reach returns the input state and a shared frozen empty events array. Otherwise emits
 * `wormSpat`. Only `plasticWorms` changes: a plastic worm is not a snack, so legs, regrowth, the
 * encounter (Shell included), the Trip Bag, finds and met are untouched, and it never counts
 * toward opening the exit. A following stranded axolotl never eats one; pass only the explorer.
 */
export function eatPlasticWorms(
  state: TripState,
  body: DrawnBody,
  avoid: SpitAvoid,
  tuning?: Pick<PlasticWormTuning, 'queasyTime' | 'spitDistance'>,
): TripStepResult {
  if (state.phase !== 'swimming') return { state, events: NO_EVENTS };
  const eaten = eatPlasticWorm(state.plasticWorms, body, avoid, tuning);
  if (eaten === null) return { state, events: NO_EVENTS };
  const { id, from, to } = eaten.spat;
  return { state: { ...state, plasticWorms: eaten.state }, events: [{ type: 'wormSpat', id, from, to }] };
}

/**
 * Ends the trip at the open exit (PRD H5). Allowed only while swimming; any other phase returns the
 * input state unchanged with no events. Banks the Trip Bag first, as at the Home Spot (A14), emitting
 * `banked` when it was not empty, then ends with reason 'areaBeaten', nothing returned, every id
 * banked this trip and the stars earned (H6): the exit, the special treasure when banked now or on
 * an earlier trip, and a rescue banked this trip (at the Home Spot or the exit) or no leg lost this
 * trip. Banking comes first so a following axolotl banked at the exit counts as rescued. Queasy
 * time and snag time end.
 */
export function beatArea(state: TripState, ctx: StarContext): TripStepResult {
  if (state.phase !== 'swimming') return { state, events: [] };
  const events: TripEvent[] = [];
  const banking = bankFinds(state);
  if (banking.ids.length > 0) events.push({ type: 'banked', ids: [...banking.ids] });
  const next = banking.state;
  const stars = earnStars({
    reachedExit: true,
    specialOwned: next.holdings.banked.includes(ctx.specialTreasureId),
    rescued: next.bankedThisTrip.some(isAxolotlFindId),
    legLost: next.legsLost > 0,
  });
  const ending: TripEnding = {
    reason: 'areaBeaten',
    returned: [],
    bankedThisTrip: [...next.bankedThisTrip],
    stars,
  };
  const plasticWorms = endQueasy(next.plasticWorms);
  const ghostNets = endSnag(next.ghostNets);
  return { state: { ...next, phase: 'ended', heldAt: null, ending, plasticWorms, ghostNets }, events };
}

/**
 * Advances the trip by `dt` seconds. A zero, negative or non-finite `dt` (pause), or a
 * banked or ended trip, returns the input state unchanged with no events. `dt` is capped at
 * `SWIM.dtMax`.
 *
 * Swimming: steps the encounter; each `hit`, from a predator, a hazard or a moving hazard, adds one
 * to `legsLost`. When it ends (fourth leg lost) the carry starts in the same
 * step: `carryStart` is emitted and any bump impulse is dropped.
 * Otherwise, in placed order, every sealed Dash pot within the container radius breaks when
 * `input.dashing` (`containerBroken`), or emits `dashNeeded` when the axolotl was not already
 * touching it; pots never give an impulse. Then every unsealed treasure not held and within the
 * pickup radius goes into the Trip Bag and onto `found` (`pickedUp` each, in placed order), so a
 * break and its pickup can happen in one step. Then `inHomeSpot` updates, and inside the ring with
 * a non-empty bag the whole bag banks: `banked` is emitted, the phase becomes 'banked', the
 * axolotl is held where it is and any bump impulse or trajinera push is dropped.
 * Before the banking check, a waiting stranded axolotl within reach goes into the Trip Bag and
 * onto `found` (`rescued`); a following one swims behind the axolotl and a safe one swims to its
 * rest point by the Home Spot. It is never part of the encounter, so it cannot be hit. The first
 * step where the axolotl meets a hazard, moving hazard, predator or element adds its id to `met`.
 * When the carry starts, a following
 * stranded axolotl goes back to its place. Queasy time counts down by the capped step, and ends
 * when the carry starts. The ghost nets step with the axolotl centre and the capped step
 * (`stepGhostNets`): a new snag emits `snagged`, and snag time ends when the carry starts. Snags and
 * meetings measure each drifting net where it is at the element time this step reaches, the
 * previous element time plus the capped step (ND-11, PRD open question 258). A snag
 * never touches the legs, protected time, the Shell, the finds or the exit; a following stranded
 * axolotl is never snagged. The element clock advances by the capped step on every swimming step.
 * Each unlit glow-plant the axolotl centre touches is lit (lightGlowPlants) and stays lit for the
 * trip; lighting is silent and emits no event. The hint clock (stepDarkHintClock) adds the capped
 * step while the axolotl centre is in the dark water, and goes back to 0 on a new light or out of
 * the dark; then `darkHint` is the plant darkHintPlant picks. A step that ends the trip, a paused
 * step, the banked card and the carry leave the hint clock and the hint as they were.
 * Gliding trajineras (issue #78, ND-8, ND-9), after the encounter (stepTrajineraLane at the new
 * element time): each push cooldown counts down by the capped step; then, on a step with no bump
 * impulse, the first ready boat whose hull touches the axolotl centre pushes it aside: `pushed` and
 * `impulse` are set and that boat's cooldown starts. Then, whatever the cooldowns and the bump, the
 * hull is solid: the axolotl centre is held out of every hull, down or sideways and never up, and
 * when that moves it `outOfHull` is the held place (`pushed.to` on a push step). A bump impulse
 * still wins over a push, and the hold never changes the impulse. A push or a hold never costs a
 * leg, never counts as a hit, drops no find, starts no protected time and emits no event; a step
 * that ends the trip neither pushes nor holds, and a banking step drops both.
 * Carrying: the encounter is not stepped, so legs stay frozen, and nothing is picked up. The
 * carry follows `input.reduced` on every step (`followReducedMotion`); on arrival `arrivedHome` is
 * emitted and the phase becomes 'ended'.
 */
export function stepTrip(
  state: TripState,
  input: TripInput,
  dt: number,
  ctx: TripContext = createTripContext(),
): TripStepResult {
  if (state.phase === 'ended' || state.phase === 'banked' || !(dt > 0) || !Number.isFinite(dt)) {
    return { state, events: [] };
  }
  const step = Math.min(dt, SWIM.dtMax);
  if (state.phase === 'carrying' && state.carry) {
    return advanceCarry(state, followReducedMotion(state.carry, input.reduced, ctx.carry), step);
  }
  return stepSwimming(state, input, step, ctx);
}

/**
 * The axolotl centre the trip controls: the held point while banked, the carry position while
 * carrying, home when ended, else null.
 */
export function tripAxolotlPos(state: TripState): Point | null {
  if (state.phase === 'ended') return { x: state.home.x, y: state.home.y };
  if (state.phase === 'banked' && state.heldAt) return { x: state.heldAt.x, y: state.heldAt.y };
  if (state.phase === 'carrying' && state.carry) return { x: state.carry.pos.x, y: state.carry.pos.y };
  return null;
}

/** Legs display state with regrow progress quantized to `steps` levels. */
export function legsSnapshot(legs: LegsState, steps: number = LEG_PROGRESS_STEPS): LegsSnapshot {
  return {
    slots: legs.slots.map((slot) => ({ status: slot.status, progress: quantizeProgress(slot.progress, steps) })),
    present: presentCount(legs),
    protected: isProtected(legs),
  };
}

/** The pop-up data for a treasure id. Throws when no catalogue treasure has the id. */
export function foundInfo(id: FindId): FoundInfo {
  const treasure = treasureById(id);
  if (treasure === undefined) throw new Error(`foundInfo: unknown treasure ${id}`);
  return { id: treasure.id, name: treasure.name, category: treasure.category, rarity: treasure.rarity };
}

/** The pop-up data for each id, in id order. Ids with no catalogue treasure are omitted. */
export function foundInfos(ids: readonly FindId[]): FoundInfo[] {
  return ids.flatMap((id) => (treasureById(id) === undefined ? [] : [foundInfo(id)]));
}

/**
 * Trip display state: the phase, the quantized legs display state, the finds, the ending, the
 * stranded axolotl, the fact card due, the lit glow-plants and the glow-plant hint. `banked`
 * counts banked treasures only, not rescued axolotls; `bag` includes a following axolotl. The hint
 * shows only while swimming.
 */
export function tripSnapshot(state: TripState): TripSnapshot {
  return {
    phase: state.phase,
    legs: legsSnapshot(state.encounter.legs),
    bag: [...state.holdings.bag],
    banked: state.holdings.banked.filter((id) => !isAxolotlFindId(id)).length,
    inHomeSpot: state.inHomeSpot,
    justBanked: [...state.justBanked],
    found: foundInfos(state.found),
    ending: state.ending ? copyEnding(state.ending) : null,
    rescue: state.rescue ? rescueSnapshot(state.rescue, state) : null,
    factCardDue: factCardDue(state),
    litGlowPlants: [...state.litGlowPlants],
    glowPlantHint: state.phase === 'swimming' ? state.darkHint : null,
  };
}

/**
 * Trip display state for a swimming, whole axolotl at the Home Spot with nothing found, used
 * until the swim scene publishes one.
 */
export function idleTripSnapshot(): TripSnapshot {
  return {
    phase: 'swimming',
    legs: legsSnapshot(createLegs()),
    bag: [],
    banked: 0,
    inHomeSpot: true,
    justBanked: [],
    found: [],
    ending: null,
    rescue: null,
    factCardDue: null,
    litGlowPlants: [],
    glowPlantHint: null,
  };
}

/** Whether two trip snapshots would show the same thing. */
export function sameTripSnapshot(a: TripSnapshot, b: TripSnapshot): boolean {
  return (
    a.phase === b.phase &&
    sameLegsSnapshot(a.legs, b.legs) &&
    sameIds(a.bag, b.bag) &&
    a.banked === b.banked &&
    a.inHomeSpot === b.inHomeSpot &&
    sameIds(a.justBanked, b.justBanked) &&
    sameIds(foundIds(a.found), foundIds(b.found)) &&
    sameEnding(a.ending, b.ending) &&
    sameRescue(a.rescue, b.rescue) &&
    a.factCardDue === b.factCardDue &&
    sameIds(a.litGlowPlants, b.litGlowPlants) &&
    a.glowPlantHint === b.glowPlantHint
  );
}

function sameRescue(a: RescueSnapshot | null, b: RescueSnapshot | null): boolean {
  if (a === null || b === null) return a === b;
  return a.id === b.id && a.morph === b.morph && a.status === b.status;
}

/** The first id met this trip whose fact card is not seen yet, or null when there is none. */
function factCardDue(state: TripState): string | null {
  return state.met.find((id) => !state.factCardsSeen.includes(id)) ?? null;
}

function rescueSnapshot(rescue: RescueState, state: TripState): RescueSnapshot {
  return { id: rescue.id, morph: rescue.morph, status: rescueStatus(rescue, state.holdings, state.phase) };
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function foundIds(found: readonly FoundInfo[]): string[] {
  return found.map((info) => info.id);
}

function sameEnding(a: TripEnding | null, b: TripEnding | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.reason === b.reason &&
    sameIds(a.returned, b.returned) &&
    sameIds(a.bankedThisTrip, b.bankedThisTrip) &&
    sameStars(a.stars, b.stars)
  );
}

function sameStars(a: AreaStars | undefined, b: AreaStars | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.exit === b.exit && a.special === b.special && a.legsOrRescue === b.legsOrRescue;
}

function copyEnding(ending: TripEnding): TripEnding {
  const copy: TripEnding = {
    reason: ending.reason,
    returned: [...ending.returned],
    bankedThisTrip: [...ending.bankedThisTrip],
  };
  if (ending.stars) copy.stars = { ...ending.stars };
  return copy;
}

function sameLegsSnapshot(a: LegsSnapshot, b: LegsSnapshot): boolean {
  return (
    a.present === b.present &&
    a.protected === b.protected &&
    a.slots.length === b.slots.length &&
    a.slots.every((slot, i) => slot.status === b.slots[i].status && slot.progress === b.slots[i].progress)
  );
}

function isPassedEvent(event: EncounterEvent): event is PassedEncounterEvent {
  return event.type !== 'carriedHome';
}

/**
 * Every predator and hazard of `encounter` not in `met` as the axolotl at `pos` sees it, predators
 * first, in encounter order: a predator by centre distance and its species meet range, a hazard by
 * shape distance, where it is at `elementTime` (hazardShapeAt), and its type meet range. Every
 * predator is always shown, so any may be met; cover does not stop a meeting. Then each moving
 * hazard whose type is not in `met`, in encounter order, by shape distance to its sweep and its type
 * meet range (ND-8, PRD open question 255). Then each element not in `met` whose type has a fact
 * card and a meet range and which has a sweep, in element order, by shape distance to its sweep.
 */
function unmetSightings(
  encounter: EncounterState,
  elements: readonly ElementSpawn[],
  pos: Point,
  met: readonly string[],
  elementTime: number,
  ctx: EncounterContext,
): ThreatSighting[] {
  const sightings: ThreatSighting[] = [];
  for (const predator of encounter.predators) {
    if (met.includes(predator.species)) continue;
    const { meetRange } = predatorSpecies(encounter, predator, ctx);
    sightings.push({ id: predator.species, distance: distanceTo(predator.pos, pos), meetRange });
  }
  for (const hazard of encounter.hazards) {
    if (met.includes(hazard.type.id)) continue;
    const shape = hazardShapeAt(hazard, elementTime);
    sightings.push({ id: hazard.type.id, distance: shapeDistance(pos, shape), meetRange: hazard.type.meetRange });
  }
  for (const spawn of encounter.movingHazards ?? []) {
    if (met.includes(spawn.type.id)) continue;
    const distance = shapeDistance(pos, movingHazardSweep(spawn));
    sightings.push({ id: spawn.type.id, distance, meetRange: spawn.type.meetRange });
  }
  for (const element of elements) {
    const sighting = elementSighting(element, pos, met);
    if (sighting !== null) sightings.push(sighting);
  }
  return sightings;
}

/**
 * The element as the axolotl at `pos` sees it: shape distance to its sweep and its type meet range.
 * Null when its type is in `met`, has no fact card or no meet range, or the element has no sweep.
 */
function elementSighting(element: ElementSpawn, pos: Point, met: readonly string[]): ThreatSighting | null {
  const { id, fact, meetRange } = element.type;
  if (fact === undefined || meetRange === undefined || met.includes(id)) return null;
  const sweep = elementSweep(element);
  if (sweep === null) return null;
  return { id, distance: shapeDistance(pos, sweep), meetRange };
}

/**
 * `met` with the ids of the hazards, moving hazards, predators and elements the axolotl at `pos`
 * meets now at `elementTime` appended, in sighting order. Runs every swimming frame, so it returns
 * `met` itself when nothing new is met.
 */
function meetThreats(
  met: string[],
  encounter: EncounterState,
  elements: readonly ElementSpawn[],
  pos: Point,
  elementTime: number,
  ctx: EncounterContext,
): string[] {
  const sightings = unmetSightings(encounter, elements, pos, met, elementTime, ctx);
  if (sightings.length === 0) return met;
  const metNow = metThreatIds(pos, encounter.safeArea, sightings);
  return metNow.length === 0 ? met : [...met, ...metNow];
}

/** How many `hit` events, each a leg lost, are in `events`. Runs every swimming frame, so it allocates nothing. */
function countHits(events: readonly EncounterEvent[]): number {
  let hitCount = 0;
  for (const event of events) {
    if (event.type === 'hit') hitCount += 1;
  }
  return hitCount;
}

function stepSwimming(state: TripState, input: TripInput, step: number, ctx: TripContext): TripStepResult {
  const result = stepEncounter(state.encounter, input.axolotlPos, step, ctx.encounter);
  const events: TripEvent[] = result.events.filter(isPassedEvent);
  const legsLost = state.legsLost + countHits(result.events);
  const elementTime = state.elementTime + step;
  if (result.state.tripOver) {
    const carry = startCarry(input.axolotlPos, state.home, input.reduced, ctx.carry);
    events.push({ type: 'carryStart', from: { x: carry.from.x, y: carry.from.y }, still: carry.still });
    const rescue = rescueAtCarryStart(state);
    const plasticWorms = endQueasy(state.plasticWorms);
    const ghostNets = endSnag(state.ghostNets);
    return {
      state: {
        ...state,
        phase: 'carrying',
        encounter: result.state,
        carry,
        rescue,
        legsLost,
        plasticWorms,
        ghostNets,
        elementTime,
      },
      events,
    };
  }
  const pots = touchPots(state, input, ctx.finds, events);
  const pickup = pickUpNearby({ ...state, ...pots }, input.axolotlPos, ctx.finds, events);
  const rescued = stepRescue({ ...state, ...pickup }, input.axolotlPos, step, events);
  const ghostNets = stepSnag(state.ghostNets, input.axolotlPos, step, elementTime, events);
  const met = meetThreats(state.met, result.state, state.elements, input.axolotlPos, elementTime, ctx.encounter);
  const glow = stepGlowPlants(state, input.axolotlPos, step);
  const boats =
    state.trajineras === null
      ? NO_TRAJINERA_LANE_STEP
      : stepTrajineraLane(state.trajineras, input.axolotlPos, step, elementTime, result.impulse !== undefined);
  const inside = isInHomeSpot(input.axolotlPos, state.homeSpot);
  const next: TripState = {
    ...state,
    ...pots,
    ...rescued,
    ...glow,
    encounter: result.state,
    inHomeSpot: inside,
    met,
    legsLost,
    plasticWorms: tickQueasy(state.plasticWorms, step),
    ghostNets,
    elementTime,
    trajineras: boats.lane,
  };
  if (inside && next.holdings.bag.length > 0) return bankAtHomeSpot(next, input.axolotlPos, events);
  const stepped: TripStepResult = { state: next, events };
  if (result.impulse) {
    stepped.impulse = result.impulse;
  } else if (boats.push) {
    stepped.impulse = { ...boats.push.impulse };
    stepped.pushed = boats.push;
  }
  const outOfHull = movedOutOfHull(boats.pos, input.axolotlPos);
  if (outOfHull) stepped.outOfHull = outOfHull;
  return stepped;
}

// INVARIANT: frozen and shared; a trip with no trajineras steps them with no allocation.
const NO_TRAJINERA_LANE_STEP = Object.freeze({ lane: null, pos: null, push: null });

/** A copy of `held`, the body centre after the trajinera hold, when it moved from `pos`; null when it did not or there was no hold. */
function movedOutOfHull(held: Readonly<Point> | null, pos: Readonly<Point>): Point | null {
  if (held === null || (held.x === pos.x && held.y === pos.y)) return null;
  return { x: held.x, y: held.y };
}

/**
 * Lights every unlit glow-plant the axolotl centre `pos` touches, then steps the hint clock by
 * `step` seconds and picks the hinted plant (issue #77, ND-8). The lit ids are the state's own
 * array when no new plant was lit.
 */
function stepGlowPlants(
  state: TripState,
  pos: Point,
  step: number,
): Pick<TripState, 'litGlowPlants' | 'darkHintTime' | 'darkHint'> {
  const lit = lightGlowPlants(state.litGlowPlants, state.elements, pos);
  const litGlowPlants = lit === state.litGlowPlants ? state.litGlowPlants : [...lit];
  const inDark = state.darkWater !== null && inDarkWater(pos, state.darkWater);
  const newLight = litGlowPlants !== state.litGlowPlants;
  const darkHintTime = stepDarkHintClock(state.darkHintTime, { dt: step, inDark, newLight, paused: false });
  const darkHint = darkHintPlant(darkHintTime, pos, state.elements, litGlowPlants);
  return { litGlowPlants, darkHintTime, darkHint };
}

/**
 * Steps the ghost nets with the explorer centre `pos` by `step` seconds, each net where it is at
 * `elementTime`, pushing `snagged` when a new snag starts. Returns the state's own ghost nets when
 * nothing changed.
 */
function stepSnag(
  nets: GhostNetState,
  pos: Point,
  step: number,
  elementTime: number,
  events: TripEvent[],
): GhostNetState {
  const next = stepGhostNets(nets, pos, step, elementTime);
  if (!isSnagged(nets) && isSnagged(next)) {
    events.push({ type: 'snagged', id: next.inReach[0], at: { x: pos.x, y: pos.y } });
  }
  return next;
}

/**
 * Touches every sealed Dash pot within `tuning.containerRadius` of the axolotl: a dash breaks it
 * (`containerBroken`), otherwise a pot not touched on the previous step pushes `dashNeeded`.
 * Returns the placed treasures and the ids of the pots still sealed and touching. Each list is the
 * state's own array when it did not change, so a step that touches no pot allocates neither.
 */
function touchPots(
  state: TripState,
  input: TripInput,
  tuning: FindTuning,
  events: TripEvent[],
): Pick<TripState, 'placed' | 'touchingPots'> {
  let placed = state.placed;
  const touchingPots: FindId[] = [];
  state.placed.forEach((find, index) => {
    if (!find.sealed || distanceTo(find, input.axolotlPos) > tuning.containerRadius) return;
    if (input.dashing) {
      events.push({ type: 'containerBroken', id: find.id, spotId: find.spotId, at: { x: find.x, y: find.y } });
      if (placed === state.placed) placed = [...state.placed];
      placed[index] = { ...find, sealed: false };
      return;
    }
    if (!state.touchingPots.includes(find.id)) {
      events.push({ type: 'dashNeeded', id: find.id, spotId: find.spotId, at: { x: find.x, y: find.y } });
    }
    touchingPots.push(find.id);
  });
  return { placed, touchingPots: sameIds(touchingPots, state.touchingPots) ? state.touchingPots : touchingPots };
}

/**
 * Puts every unsealed treasure not yet held within `tuning.pickupRadius` of `pos` into the Trip Bag
 * and onto `found`, pushing `pickedUp` each. `found` is the state's own array when nothing was picked up.
 */
function pickUpNearby(
  state: TripState,
  pos: Point,
  tuning: FindTuning,
  events: TripEvent[],
): Pick<TripState, 'holdings' | 'found'> {
  let holdings = state.holdings;
  let found = state.found;
  for (const find of state.placed) {
    if (find.sealed || isHeld(holdings, find.id)) continue;
    if (distanceTo(find, pos) > tuning.pickupRadius) continue;
    holdings = pickUp(holdings, find.id);
    found = [...found, find.id];
    const at = { x: find.x, y: find.y };
    events.push({ type: 'pickedUp', id: find.id, spotId: find.spotId, at, found: foundInfo(find.id) });
  }
  return { holdings, found };
}

/**
 * Rescues a stranded axolotl within reach of `pos` (`reachRescue`), then moves it: behind `pos`
 * while following, toward its rest point by the Home Spot centre while safe.
 */
function stepRescue(
  state: TripState,
  pos: Point,
  step: number,
  events: TripEvent[],
): Pick<TripState, 'holdings' | 'found' | 'rescue'> {
  const reached = reachRescue(state, pos, events);
  const { rescue } = reached;
  if (!rescue) return reached;
  const status = rescueStatus(rescue, reached.holdings, state.phase);
  if (status === 'following') return { ...reached, rescue: stepFollower(rescue, pos, step) };
  if (status === 'safe') return { ...reached, rescue: stepToRest(rescue, state.homeSpot, step) };
  return reached;
}

/**
 * Puts a waiting stranded axolotl within reach of `pos` into the Trip Bag and onto `found`, marked
 * met, pushing `rescued`. Otherwise returns the state's own holdings, found and rescue.
 */
function reachRescue(
  state: TripState,
  pos: Point,
  events: TripEvent[],
): Pick<TripState, 'holdings' | 'found' | 'rescue'> {
  const { holdings, found, rescue } = state;
  if (!rescue || rescueStatus(rescue, holdings, state.phase) !== 'waiting' || !reachesRescue(rescue, pos)) {
    return { holdings, found, rescue };
  }
  events.push({ type: 'rescued', id: rescue.id, morph: rescue.morph, at: { x: rescue.pos.x, y: rescue.pos.y } });
  return { holdings: pickUp(holdings, rescue.id), found: [...found, rescue.id], rescue: { ...rescue, met: true } };
}

/** The stranded axolotl as the carry starts: a following one goes back to its place (C5). */
function rescueAtCarryStart(state: TripState): RescueState | null {
  const { rescue } = state;
  if (!rescue || rescueStatus(rescue, state.holdings, state.phase) !== 'following') return rescue;
  return sendRescueBack(rescue);
}

function distanceTo(from: Point, to: Point): number {
  return Math.hypot(from.x - to.x, from.y - to.y);
}

/** Banks the non-empty Trip Bag and freezes the trip on the banked card, held at `pos`, with no impulse. */
function bankAtHomeSpot(state: TripState, pos: Point, events: TripEvent[]): TripStepResult {
  const banking = bankFinds(state);
  events.push({ type: 'banked', ids: [...banking.ids] });
  return { state: { ...banking.state, phase: 'banked', heldAt: { x: pos.x, y: pos.y } }, events };
}

/**
 * Moves the whole Trip Bag to banked, recording the ids in `bankedThisTrip` and `justBanked`.
 * An empty bag returns the same state and no ids.
 */
function bankFinds(state: TripState): { state: TripState; ids: FindId[] } {
  const result = bankAll(state.holdings);
  if (result.banked.length === 0) return { state, ids: [] };
  return {
    state: {
      ...state,
      holdings: result.holdings,
      bankedThisTrip: [...state.bankedThisTrip, ...result.banked],
      justBanked: [...result.banked],
    },
    ids: result.banked,
  };
}

/**
 * Full motion: a straight line home at `tuning.speed`, clamped to `minTime`..`maxTime`, so a
 * zero-distance carry still takes `minTime`. Still: holds at `from` for `stillHold`.
 */
function startCarry(from: Point, home: Point, still: boolean, tuning: CarryTuning): CarryState {
  const distance = Math.hypot(home.x - from.x, home.y - from.y);
  const duration = still
    ? tuning.stillHold
    : Math.min(tuning.maxTime, Math.max(tuning.minTime, distance / tuning.speed));
  return {
    from: { x: from.x, y: from.y },
    to: { x: home.x, y: home.y },
    pos: { x: from.x, y: from.y },
    elapsed: 0,
    duration,
    still,
  };
}

/**
 * The carry after reduced motion is set to `reduced`, starting a new segment from `carry.pos` when
 * it changes; the same object when it does not. Turning on holds still where the axolotl is for
 * the rest of the carry, at most `stillHold`, so the switch never lengthens the carry. Turning off
 * floats home from where the axolotl is, timed like a fresh carry from there.
 */
export function followReducedMotion(carry: CarryState, reduced: boolean, tuning: CarryTuning): CarryState {
  if (carry.still === reduced) return carry;
  const here = { x: carry.pos.x, y: carry.pos.y };
  if (!reduced) return startCarry(here, carry.to, false, tuning);
  return {
    from: here,
    to: { x: carry.to.x, y: carry.to.y },
    pos: { x: here.x, y: here.y },
    elapsed: 0,
    duration: Math.min(carry.duration - carry.elapsed, tuning.stillHold),
    still: true,
  };
}

function advanceCarry(state: TripState, carry: CarryState, step: number): TripStepResult {
  const elapsed = carry.elapsed + step;
  if (elapsed >= carry.duration) return arriveHome(state, { ...carry, elapsed });
  const pos = carry.still ? { x: carry.from.x, y: carry.from.y } : carryPos(carry, elapsed / carry.duration);
  return { state: { ...state, carry: { ...carry, elapsed, pos } }, events: [] };
}

/** Smoothstep-eased point on the straight line from `carry.from` to `carry.to`. */
function carryPos(carry: CarryState, progress: number): Point {
  const eased = progress * progress * (3 - 2 * progress);
  return {
    x: carry.from.x + (carry.to.x - carry.from.x) * eased,
    y: carry.from.y + (carry.to.y - carry.from.y) * eased,
  };
}

/**
 * Ends the carry at the canal Home Spot (`zone.start`) with every leg back: present,
 * not protected, nothing regrowing. Unbanked Trip Bag finds go back to the world: the bag empties,
 * banked finds stay, and the returned ids ride on `arrivedHome` and the ending. They reappear
 * next trip in freshly picked spots, since `newTrip` always places the returned treasures.
 * Arrival now leads to the Home Tank through the scene flow. Snacks are not trip finds and are not
 * in trip state, so arrival leaves them; the session clears every eaten snack when it records a
 * carried-home ending (`tripEndRecord`, PRD A12, ADR 0010).
 */
function arriveHome(state: TripState, carry: CarryState): TripStepResult {
  const legs = createLegs({ count: state.encounter.legs.slots.length });
  const result = returnTripBag(state.holdings);
  const ending: TripEnding = {
    reason: 'carriedHome',
    returned: [...result.returned],
    bankedThisTrip: [...state.bankedThisTrip],
  };
  return {
    state: {
      ...state,
      phase: 'ended',
      encounter: { ...state.encounter, legs },
      carry: { ...carry, pos: { x: carry.to.x, y: carry.to.y } },
      holdings: result.holdings,
      inHomeSpot: isInHomeSpot(state.home, state.homeSpot),
      ending,
    },
    events: [{ type: 'arrivedHome', still: carry.still, returned: [...result.returned] }],
  };
}
