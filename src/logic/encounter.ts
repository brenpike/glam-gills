import { hazardCentre, legHazardAt, type HazardSpawn } from './hazards';
import { inSightCover, type SightCoverGeometry } from './hiding';
import { createLegs, isProtected, speedUpRegrowth, tryHit, updateLegs, type LegsState } from './legs';
import { movingHazardTip, movingHazardTouches, type MovingHazardSpawn } from './movingHazards';
import {
  TILAPIA_SPECIES,
  bumpImpulse,
  createPredator,
  stepPredator,
  touching,
  type PredatorContext,
  type PredatorRoute,
  type PredatorSpecies,
  type PredatorState,
} from './predators';
import { LEGS, SWIM, TILAPIA, type LegTuning, type TilapiaTuning } from './tuning';
import type { Vec2 } from './vec';
import {
  swimBounds,
  type CaveArea,
  type PadSpec,
  type Point,
  type ReedPatch,
  type SafeArea,
  type SwimBounds,
  type TilapiaRoute,
  type ZoneLayout,
} from './zone';

/**
 * The zone parts an encounter is built from. An `EncounterState` is one too, so it can be reset.
 * Absent `predatorRoutes`, `hazards` or `movingHazards` mean none. Absent `tilapia` means the
 * context's tilapia tuning. The optional sight cover geometry (`reedPatches`, `pads`, `cave`) is
 * what a species with the `sightCover` rule cannot see into; absent parts mean no such cover.
 */
export type EncounterSource = Pick<ZoneLayout, 'safeArea' | 'tilapiaRoutes' | 'tilapia'> &
  SightCoverGeometry & {
    predatorRoutes?: readonly PredatorRoute[];
    hazards?: readonly HazardSpawn[];
    /** Moving hazards (ND-8, PRD open question 255); absent or empty means none. */
    movingHazards?: readonly MovingHazardSpawn[];
  };

/**
 * Legs plus every predator for one trip. Immutable: `stepEncounter` returns a new object.
 * `predators` holds one tilapia per `tilapiaRoutes` entry, in order, then one predator per
 * `predatorRoutes` entry, in order. `tripOver` is true after the fourth leg is lost;
 * every later step is a no-op until the encounter is reset. `tilapia`, when set, is the area's own
 * tilapia tuning, played in place of the context's. `reedPatches`, `pads` and `cave` are the
 * source's sight cover geometry, each present only when the source has it. `movingHazards` and
 * `hazardTime`, their clock in seconds, are present only when the source has one or more moving
 * hazards (ND-8, PRD open question 255).
 */
export interface EncounterState {
  safeArea: SafeArea;
  tilapiaRoutes: TilapiaRoute[];
  tilapia?: Readonly<TilapiaTuning>;
  predatorRoutes: PredatorRoute[];
  hazards: HazardSpawn[];
  movingHazards?: MovingHazardSpawn[];
  /** Seconds of moving hazard time: 0 at the start of every trip, advanced only by `stepEncounter`. */
  hazardTime?: number;
  reedPatches?: ReedPatch[];
  pads?: PadSpec[];
  cave?: CaveArea;
  legs: LegsState;
  predators: PredatorState[];
  /** Seconds left before another bump can happen; 0 when a bump is ready. */
  bumpCooldownLeft: number;
  /** Whether this trip's Shell block is spent (PRD A22, F11); false at the start of every trip. */
  shellUsed: boolean;
  tripOver: boolean;
}

/** World limits and tuning for a step; `bounds` limits the predator centre. */
export interface EncounterContext {
  bounds: SwimBounds;
  legs: LegTuning;
  /** Tilapia tuning when the encounter has none of its own; other species use their own. */
  tilapia: TilapiaTuning;
  /** Whether the outfit has a Shell perk. One flag, so Shell blocks at most one hit per trip (PRD F11). */
  shell: boolean;
}

/**
 * Encounter events, in the order they happened within the step.
 * `sourceId` is the route id of the predator involved, or the hazard or moving hazard spawn id for
 * a hazard hit. `leg` is a slot index. `from` is the predator centre at the moment of the hit,
 * Shell block or bump, the hazard shape centre for a hazard hit or block, or the tip of the shaft
 * for a moving hazard hit or block.
 * `shellBlock` is a hit the Shell perk blocked: no leg lost, protected time started (PRD A22).
 */
export type EncounterEvent =
  | { type: 'telegraph'; sourceId: string }
  | { type: 'lunge'; sourceId: string; aim: Point }
  | { type: 'hit'; sourceId: string; leg: number; from: Point }
  | { type: 'shellBlock'; sourceId: string; from: Point }
  | { type: 'bump'; sourceId: string; from: Point }
  | { type: 'regrowStart'; leg: number }
  | { type: 'regrown'; leg: number }
  | { type: 'protectedEnd' }
  | { type: 'carriedHome' };

/** `impulse` is set only on a step with a bump: the velocity in px/s to give the axolotl. */
export interface EncounterStepResult {
  state: EncounterState;
  events: EncounterEvent[];
  impulse?: Vec2;
}

interface HitPass {
  state: EncounterState;
  events: EncounterEvent[];
  hit: boolean;
}

/** What a hit came from. `bumpCooldown` absent leaves the bump cooldown unchanged (hazards). */
interface HitSource {
  id: string;
  from: Point;
  bumpCooldown?: number;
}

/** Default context: the canal swim bounds, the shared leg and tilapia tuning, and no Shell perk. */
export function createEncounterContext(overrides: Partial<EncounterContext> = {}): EncounterContext {
  return { bounds: swimBounds(), legs: LEGS, tilapia: TILAPIA, shell: false, ...overrides };
}

/**
 * The tilapia species played with each tuning other than TILAPIA_SPECIES.tuning, built once per
 * tuning object. An encounter copies its own tuning, so its species is built once per encounter.
 */
const tunedTilapiaSpecies = new WeakMap<Readonly<TilapiaTuning>, Readonly<PredatorSpecies>>();

/** TILAPIA_SPECIES played with `tuning`: the species itself for its own tuning, else one built once per tuning. */
function tilapiaSpeciesFor(tuning: Readonly<TilapiaTuning>): Readonly<PredatorSpecies> {
  if (tuning === TILAPIA_SPECIES.tuning) return TILAPIA_SPECIES;
  let species = tunedTilapiaSpecies.get(tuning);
  if (!species) {
    species = Object.freeze({ ...TILAPIA_SPECIES, tuning });
    tunedTilapiaSpecies.set(tuning, species);
  }
  return species;
}

/**
 * Starts a trip: every leg present, no protection, Shell unused, each predator at the start of
 * its route. Routes, hazards (with their drift, when set), moving hazards, sight cover geometry
 * and the source's own tilapia tuning (only when set) are copied; species and hazard types are
 * shared. The moving hazard clock starts at 0, and only when the source has a moving hazard.
 */
export function createEncounter(
  source: EncounterSource,
  legTuning: Pick<LegTuning, 'count'> = LEGS,
): EncounterState {
  const tilapiaRoutes = source.tilapiaRoutes.map(copyRoute);
  const predatorRoutes = (source.predatorRoutes ?? []).map((route) => ({
    ...copyRoute(route),
    species: route.species,
  }));
  const hazards = (source.hazards ?? []).map(copyHazard);
  return {
    safeArea: { ...source.safeArea },
    tilapiaRoutes,
    ...(source.tilapia ? { tilapia: { ...source.tilapia } } : {}),
    predatorRoutes,
    hazards,
    ...copyMovingHazards(source),
    ...copySightCover(source),
    legs: createLegs(legTuning),
    predators: [
      ...tilapiaRoutes.map((route) => createPredator(route, TILAPIA_SPECIES.id)),
      ...predatorRoutes.map((route) => createPredator(route, route.species.id)),
    ],
    bumpCooldownLeft: 0,
    shellUsed: false,
    tripOver: false,
  };
}

/**
 * The species of `predator` as this encounter plays it: `TILAPIA_SPECIES` with the encounter's own
 * tilapia tuning when it has one, else `ctx.tilapia`, for a tilapia; else the species of its route
 * in `state.predatorRoutes`. Throws when a non-tilapia predator has no matching route.
 */
export function predatorSpecies(
  state: EncounterState,
  predator: PredatorState,
  ctx: EncounterContext = createEncounterContext(),
): Readonly<PredatorSpecies> {
  if (predator.species === TILAPIA_SPECIES.id) return tilapiaSpeciesFor(state.tilapia ?? ctx.tilapia);
  const route = state.predatorRoutes.find(
    (candidate) => candidate.id === predator.routeId && candidate.species.id === predator.species,
  );
  if (!route) {
    throw new Error(`predatorSpecies: no ${predator.species} route ${predator.routeId} in the encounter`);
  }
  return route.species;
}

/** Starts a new trip from a zone or from a finished or running encounter; same as `createEncounter`. */
export function resetEncounter(
  source: EncounterSource,
  legTuning: Pick<LegTuning, 'count'> = LEGS,
): EncounterState {
  return createEncounter(source, legTuning);
}

/**
 * Advances the encounter by `dt` seconds with the axolotl centre at `axolotlPos`.
 * A zero, negative or non-finite `dt` (pause), or a finished trip, returns the input state
 * unchanged with no events. `dt` is capped at `SWIM.dtMax` so lunge contact is sampled finely;
 * callers should clamp dt to the same limit, since time above it is dropped.
 *
 * Order within a step: legs first (regrowth, then protected time), then each predator in
 * `predators` order, then one hazard check, then one moving hazard check, then one bump check. At
 * most one hit lands per step. So a leg that finishes regrowing in the same step as a hit emits
 * `regrown` before `hit`.
 *
 * Tuning: a tilapia uses the encounter's own tilapia tuning when set, else `ctx.tilapia`; every
 * other species uses its own tuning, rule hook and shared rules (see `predatorSpecies`). A species
 * with the `sightCover` rule is told whether the axolotl is in the encounter's sight cover
 * (`inSightCover`); the tilapia ignores cover.
 *
 * Stagger (PRD A1): only one predator attacks at a time, whatever its species. A predator may
 * start a telegraph only while no other predator is telegraphing or lunging (judged on the
 * states already stepped this step, and the previous states of the rest), so two predators
 * never telegraph or lunge at once. A blocked predator keeps patrolling; a telegraph, lunge or
 * cooldown already running goes on.
 *
 * Within-step timing always favours the axolotl. A lunge contact can happen at any moment
 * inside the step, so a hit is judged against the kindest leg state over the whole step:
 * a leg that finishes regrowing anywhere in the step counts as present, and protected time
 * that was still running when the step began blocks every hit in that step, even if it runs
 * out partway through. Protected time only counts down and only a hit restarts it, so when
 * it is 0 at the start of the step it was 0 for the whole step and a hit is always fair. A
 * hit's new protected time starts in full at the end of the step. So step size can never
 * cost a leg, or end a trip, that a finer timeline would have spared.
 *
 * A connected lunge calls `tryHit`. While protected the hit costs no leg and emits nothing;
 * the predator then sits in cooldown inside its contact radius, so the bump check below can
 * push the axolotl gently away. Losing the last present leg emits `hit` then `carriedHome`
 * (exactly once) and ends the trip, even while another leg is regrowing. A predator hit starts
 * the bump cooldown of that predator's species.
 *
 * Hazards: when no predator hit landed this step, protected time was not running at the step
 * start and the trip is not over, the first leg-costing hazard touching the axolotl
 * (`legHazardAt`) hits it the same way, with `from` at the hazard shape centre. A hazard hit
 * leaves the bump cooldown unchanged. Slow-only hazards never hit.
 *
 * Moving hazards (ND-8, PRD open question 255): `hazardTime`, when present, advances by the capped
 * step on every step that runs, so it stops with a 0 step and once the trip is over. When no
 * predator or hazard hit landed this step, protected time was not running at the step start and
 * the trip is not over, the first moving hazard touching the axolotl at the new `hazardTime`
 * (`movingHazardTouches`) hits it the same way (A4, A5, A11), with `from` at the tip of its shaft.
 * A moving hazard hit leaves the bump cooldown unchanged and is never a bump.
 *
 * Shell (PRD A22, F11): with `ctx.shell` on, the first hit of the trip, from a predator, a hazard
 * or a moving hazard, that protected time does not block is blocked instead. It costs no leg, starts
 * protected time and, for a predator, the bump cooldown as a hit does, and emits `shellBlock`,
 * never `hit`. A hit that protected time blocks leaves the Shell unused. Every later hit
 * removes one leg as usual.
 *
 * Bump: when no hit landed this step, the bump cooldown is ready and a non-lunging predator
 * touches the axolotl, emit `bump` and return `impulse`, using the bumper's species tuning.
 * A species with `neverTouches` (the heron) is skipped, whatever its contactRadius, so it never
 * bumps. A predator hit also starts the bump cooldown, so a hit is never followed at once by a bump.
 */
export function stepEncounter(
  state: EncounterState,
  axolotlPos: Point,
  dt: number,
  ctx: EncounterContext = createEncounterContext(),
): EncounterStepResult {
  if (state.tripOver || !(dt > 0) || !Number.isFinite(dt)) return { state, events: [] };
  const step = Math.min(dt, SWIM.dtMax);
  const legs = updateLegs(state.legs, step, ctx.legs);
  const events = regrowEvents(state.legs, legs);
  if (isProtected(state.legs) && !isProtected(legs)) events.push({ type: 'protectedEnd' });

  const timed: EncounterState = {
    ...state,
    legs,
    bumpCooldownLeft: Math.max(0, state.bumpCooldownLeft - step),
    ...(state.hazardTime === undefined ? {} : { hazardTime: state.hazardTime + step }),
  };
  const canHit = !isProtected(state.legs);
  const pass = stepPredators(timed, axolotlPos, step, ctx, canHit);
  events.push(...pass.events);
  let current = pass.state;
  let hit = pass.hit;
  if (!hit && canHit && !current.tripOver) {
    const hazardPass = applyHazard(current, axolotlPos, ctx);
    current = hazardPass.state;
    hit = hazardPass.hit;
    events.push(...hazardPass.events);
  }
  if (!hit && canHit && !current.tripOver) {
    const movingPass = applyMovingHazard(current, axolotlPos, ctx);
    current = movingPass.state;
    hit = movingPass.hit;
    events.push(...movingPass.events);
  }
  if (hit || current.tripOver || current.bumpCooldownLeft > 0) {
    return { state: current, events };
  }
  return applyBump(current, axolotlPos, events, ctx);
}

/** Outcome of eating snacks: the new encounter, its regrowth events and the leg slot each snack helped. */
export interface EncounterFeedResult {
  state: EncounterState;
  events: EncounterEvent[];
  boosted: number[];
}

/**
 * Applies `snacks` eaten snacks to leg regrowth (PRD A19) with `speedUpRegrowth` and
 * `ctx.legs`. A finished trip, or snacks that change no leg (0 snacks, nothing regrowing),
 * return the input state unchanged with no events. Otherwise only `legs` changes; predators,
 * bump cooldown and protected time stay as they were. A leg a snack finishes emits the same
 * `regrown` then `regrowStart` events that `stepEncounter` emits when time finishes it.
 * `boosted` is the slot each snack helped, in eating order.
 * Throws RangeError, as `speedUpRegrowth` does, for an invalid `snacks` count on a running trip.
 */
export function feedEncounter(
  state: EncounterState,
  snacks: number,
  ctx: EncounterContext = createEncounterContext(),
): EncounterFeedResult {
  if (state.tripOver) return { state, events: [], boosted: [] };
  const result = speedUpRegrowth(state.legs, snacks, ctx.legs);
  if (result.state === state.legs) return { state, events: [], boosted: [] };
  return {
    state: { ...state, legs: result.state },
    events: regrowEvents(state.legs, result.state),
    boosted: result.boosted,
  };
}

/** Steps every predator; `canHit` false means protected time was running at the step start. */
function stepPredators(
  state: EncounterState,
  axolotlPos: Point,
  dt: number,
  ctx: EncounterContext,
  canHit: boolean,
): HitPass {
  let current: EncounterState = { ...state, predators: [...state.predators] };
  const events: EncounterEvent[] = [];
  let hit = false;
  for (let i = 0; i < current.predators.length && !current.tripOver; i++) {
    const species = predatorSpecies(current, current.predators[i], ctx);
    const predatorCtx: PredatorContext = {
      safeArea: current.safeArea,
      bounds: ctx.bounds,
      tuning: species.tuning,
      telegraphBlocked: otherPredatorAttacking(current.predators, i),
      hook: species.hook,
    };
    if (species.rules) {
      predatorCtx.rules = species.rules;
      predatorCtx.targetInCover = species.rules.sightCover === true && inSightCover(axolotlPos, current);
    }
    const result = stepPredator(current.predators[i], axolotlPos, dt, predatorCtx);
    current.predators[i] = result.state;
    const sourceId = result.state.routeId;
    for (const event of result.events) {
      if (event.type === 'telegraphStart') events.push({ type: 'telegraph', sourceId });
      if (event.type === 'lungeStart') events.push({ type: 'lunge', sourceId, aim: event.aim });
      if (event.type === 'lungeEnd' && event.connected && canHit && !current.tripOver) {
        const source: HitSource = { id: sourceId, from: result.state.pos, bumpCooldown: species.tuning.bumpCooldown };
        const landed = applyHit(current, source, ctx);
        current = landed.state;
        events.push(...landed.events);
        hit = hit || landed.hit;
      }
    }
  }
  return { state: current, events, hit };
}

/**
 * Whether any predator other than `predators[index]` is telegraphing or lunging. Entries before
 * `index` already hold this step's state, so a telegraph started earlier in the step counts.
 */
function otherPredatorAttacking(predators: readonly PredatorState[], index: number): boolean {
  return predators.some(
    (other, otherIndex) => otherIndex !== index && (other.phase === 'telegraph' || other.phase === 'lunge'),
  );
}

/** Hits the axolotl from the first leg-costing hazard it touches, if any; the bump cooldown is unchanged. */
function applyHazard(state: EncounterState, axolotlPos: Point, ctx: EncounterContext): HitPass {
  const hazard = legHazardAt(state.hazards, axolotlPos);
  if (!hazard) return { state, events: [], hit: false };
  return applyHit(state, { id: hazard.id, from: hazardCentre(hazard.shape) }, ctx);
}

/**
 * Hits the axolotl from the first moving hazard whose shaft touches it at the encounter's
 * `hazardTime`, if any, from the tip of that shaft where it really is: below the surface or a roof,
 * or above the floor (issue #77, ND-3); the bump cooldown is unchanged.
 */
function applyMovingHazard(state: EncounterState, axolotlPos: Point, ctx: EncounterContext): HitPass {
  const { movingHazards, hazardTime } = state;
  if (!movingHazards || hazardTime === undefined) return { state, events: [], hit: false };
  const spawn = movingHazards.find((candidate) => movingHazardTouches(candidate, hazardTime, axolotlPos));
  if (!spawn) return { state, events: [], hit: false };
  return applyHit(state, { id: spawn.id, from: movingHazardTip(spawn, hazardTime) }, ctx);
}

/**
 * Applies a hit from `source`; a protected or legless axolotl loses nothing.
 * An unused Shell blocks the hit instead of a leg loss.
 */
function applyHit(state: EncounterState, source: HitSource, ctx: EncounterContext): HitPass {
  if (ctx.shell && !state.shellUsed && !isProtected(state.legs)) return applyShellBlock(state, source, ctx);
  const result = tryHit(state.legs, ctx.legs);
  if (!result.hit) return { state, events: [], hit: false };
  const events: EncounterEvent[] = [
    { type: 'hit', sourceId: source.id, leg: result.legIndex, from: { ...source.from } },
  ];
  if (result.state.slots[result.legIndex].status === 'regrowing') {
    events.push({ type: 'regrowStart', leg: result.legIndex });
  }
  if (result.tripOver) events.push({ type: 'carriedHome' });
  const next: EncounterState = {
    ...state,
    legs: result.state,
    bumpCooldownLeft: source.bumpCooldown ?? state.bumpCooldownLeft,
    tripOver: result.tripOver,
  };
  return { state: next, events, hit: true };
}

/** Blocks a hit with the Shell: no leg lost, protected time starts, and the bump cooldown as a hit would. */
function applyShellBlock(state: EncounterState, source: HitSource, ctx: EncounterContext): HitPass {
  const next: EncounterState = {
    ...state,
    legs: { ...state.legs, protectedLeft: ctx.legs.protectedTime },
    bumpCooldownLeft: source.bumpCooldown ?? state.bumpCooldownLeft,
    shellUsed: true,
  };
  const events: EncounterEvent[] = [{ type: 'shellBlock', sourceId: source.id, from: { ...source.from } }];
  return { state: next, events, hit: true };
}

function applyBump(
  state: EncounterState,
  axolotlPos: Point,
  events: EncounterEvent[],
  ctx: EncounterContext,
): EncounterStepResult {
  for (const predator of state.predators) {
    const species = predatorSpecies(state, predator, ctx);
    if (species.neverTouches || !touching(predator, axolotlPos, species.tuning)) continue;
    events.push({ type: 'bump', sourceId: predator.routeId, from: { ...predator.pos } });
    return {
      state: { ...state, bumpCooldownLeft: species.tuning.bumpCooldown },
      events,
      impulse: bumpImpulse(predator, axolotlPos, species.tuning),
    };
  }
  return { state, events };
}

/**
 * Regrowth events between two leg states, in regrow-queue order. A slot that went from lost
 * straight to present within one step emits both `regrowStart` and `regrown`.
 */
function regrowEvents(before: LegsState, after: LegsState): EncounterEvent[] {
  const events: EncounterEvent[] = [];
  for (const leg of before.regrowQueue) {
    const was = before.slots[leg].status;
    const now = after.slots[leg].status;
    if (was === 'lost' && now !== 'lost') events.push({ type: 'regrowStart', leg });
    if (now === 'present') events.push({ type: 'regrown', leg });
  }
  return events;
}

/** A copy of the hazard sharing its type; the drift (ND-11, PRD open question 258) is copied only when set. */
function copyHazard(hazard: Readonly<HazardSpawn>): HazardSpawn {
  const copy: HazardSpawn = { id: hazard.id, type: hazard.type, shape: { ...hazard.shape } };
  if (hazard.drift) copy.drift = { ...hazard.drift };
  return copy;
}

/**
 * The source's moving hazards, each a copy sharing its type, with the clock at 0. Empty, with no
 * `movingHazards` or `hazardTime` key, when the source has none.
 */
function copyMovingHazards(source: EncounterSource): Pick<EncounterState, 'movingHazards' | 'hazardTime'> {
  if (!source.movingHazards || source.movingHazards.length === 0) return {};
  return { movingHazards: source.movingHazards.map((spawn) => ({ ...spawn })), hazardTime: 0 };
}

/** Copies each sight cover part the source has; an absent part stays absent. */
function copySightCover(source: SightCoverGeometry): SightCoverGeometry {
  const cover: SightCoverGeometry = {};
  if (source.reedPatches) cover.reedPatches = source.reedPatches.map((patch) => ({ ...patch }));
  if (source.pads) cover.pads = source.pads.map((pad) => ({ ...pad }));
  if (source.cave) cover.cave = { ...source.cave };
  return cover;
}

function copyRoute(route: TilapiaRoute): TilapiaRoute {
  return { id: route.id, waypoints: route.waypoints.map((point) => ({ x: point.x, y: point.y })) };
}
