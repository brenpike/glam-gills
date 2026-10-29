import type { Rarity } from './catalogue';

/**
 * Provisional tuning constants for the swim test. Values are starting points
 * meant to be adjusted by playtest; units are world pixels and seconds unless noted.
 */

/** Swim physics tuning. */
export interface SwimTuning {
  /** Cruise speed cap in px/s. */
  maxSpeed: number;
  /** Acceleration toward the steer target in px/s^2. */
  accel: number;
  /** Exponential drag rate per second (v *= exp(-drag * dt)). */
  drag: number;
  /** Speed cap while dashing in px/s. */
  dashSpeed: number;
  /** Dash duration in seconds. */
  dashDuration: number;
  /** Cooldown after a dash in seconds. */
  dashCooldown: number;
  /** Minimum |vx| in px/s before facing may flip. */
  turnHysteresis: number;
  /** Fraction of velocity reflected when hitting a bound. */
  edgeBounce: number;
  /** Largest simulated step in seconds. */
  dtMax: number;
}

/** Viewport fitting tuning. */
export interface ViewTuning {
  /** Narrowest world width in px that must remain visible. */
  minVisibleW: number;
  /** Highest device pixel ratio honoured. */
  dprCap: number;
  /** Highest texture bake scale. */
  bakeScaleMax: number;
}

/** On-screen steering pad tuning; units are CSS px unless noted. */
export interface StickTuning {
  /** Pad base diameter in CSS px at full scale. */
  baseDiameter: number;
  /** Knob diameter in CSS px at full scale. */
  knobDiameter: number;
  /** Fraction of the base radius the knob centre may move from the pad centre. */
  travel: number;
  /** Fraction of travel inside which steering is zero. */
  deadzone: number;
  /** Gap in CSS px between the pad footprint and the view edges. */
  margin: number;
  /** Gap in CSS px between the pad and other reserved UI. */
  gap: number;
  /** Touch capture padding beyond the pad footprint, in base radii. */
  zoneReach: number;
  /** Smallest pad scale allowed on cramped views. */
  minScale: number;
}

/** Leg loss, regrowth and leg-dependent swim tuning. */
export interface LegTuning {
  /** Legs on a whole axolotl. */
  count: number;
  /** Seconds for one lost leg to regrow; legs regrow one at a time. */
  regrowTime: number;
  /**
   * Share of one leg's regrowth each snack eaten adds to the regrowing leg (PRD Tuning
   * "Snack regrowth speed-up"). It is a share, so a shorter `regrowTime` (Regrowth perk)
   * keeps it the same fraction of a leg.
   */
  snackSpeedUp: number;
  /** Seconds after a hit during which no further hit can land. */
  protectedTime: number;
  /** Top speed multiplier indexed by legs present minus one (1, 2, 3, 4 legs). */
  speedByLegs: readonly number[];
  /** Peak wobble angle in radians added per missing leg. */
  wobbleAmp: number;
  /** Wobble cycle length in seconds. */
  wobblePeriod: number;
}

/**
 * A predator's chase on patrol (PRD open questions 249 and 250, ND-2 and ND-3): it swims toward an
 * exposed axolotl in sight, no nearer than its lungeRange and never past its leash.
 */
export interface ChaseTuning {
  /** Centre distance in px within which an exposed axolotl is chased; greater than the lungeRange. */
  sight: number;
  /** Farthest distance in px from the patrol loop a chase step may end; 0 or more. */
  leash: number;
  /** Chase speed in px/s; strictly between the 2-leg and 4-leg top speeds. */
  speed: number;
}

/** Tilapia patrol, telegraph and lunge tuning. */
export interface TilapiaTuning {
  /** Shortest allowed telegraph wind-up in seconds; the PRD floor. */
  minWindup: number;
  /** Telegraph wind-up in seconds; must be at least minWindup. */
  windup: number;
  /** Seconds after a lunge before the next telegraph may start. */
  cooldown: number;
  /** Centre distance in px within which a telegraph and lunge may start. */
  lungeRange: number;
  /** Lunge speed in px/s. */
  lungeSpeed: number;
  /** Lunge duration in seconds. */
  lungeDuration: number;
  /** Centre distance in px at which a lunge connects as a hit. */
  hitRadius: number;
  /** Centre distance in px at which a non-lunging tilapia bumps the axolotl. */
  contactRadius: number;
  /** Tilapia body radius in px, used for clearance from the safe area. */
  bodyRadius: number;
  /** Patrol cruise speed in px/s. */
  patrolSpeed: number;
  /** Speed in px/s given to the axolotl by a gentle bump. */
  bumpSpeed: number;
  /** Seconds after a bump before another bump can apply. */
  bumpCooldown: number;
  /** The chase on patrol; absent means the predator never chases. */
  chase?: ChaseTuning;
}

/** Carried-home transition tuning, used after the fourth leg is lost. */
export interface CarryTuning {
  /** Full-motion carry speed in px/s along a straight line to the Home Spot. */
  speed: number;
  /** Shortest full-motion carry in seconds, so even a very short carry reads as a gentle float. */
  minTime: number;
  /** Longest full-motion carry in seconds, so a far carry never drags on. */
  maxTime: number;
  /**
   * Seconds a reduced-motion carry holds before arriving. Under reduced motion the axolotl
   * does not travel: it rests in a still bubble where it was, then appears at the Home Spot.
   */
  stillHold: number;
}

/** Trip find pickup tuning. */
export interface FindTuning {
  /** Centre distance in px within which the axolotl picks up a find. */
  pickupRadius: number;
  /** Centre distance in px within which the axolotl touches a Dash pot. */
  containerRadius: number;
}

/** How many treasure slots one trip has and how each slot picks its rarity (PRD B4, Tuning values). */
export interface TripTreasureTuning {
  /** Treasure slots per trip; lost treasures and the special treasure come on top of the slots. */
  slots: number;
  /** Chance from 0 to 1 that one slot is each rarity; the chances add up to 1. */
  chance: Readonly<Record<Rarity, number>>;
  /** Spot weight for the pool spot nearest the main swim path. */
  leastHiddenWeight: number;
  /** Spot weight for the pool spot farthest from the main swim path; weights between are linear in distance. */
  bestHiddenWeight: number;
}

/**
 * One area's changes to TRIP_TREASURES; anything left out keeps the default (PRD B4). A given
 * `chance` replaces the whole default chance record, so the chances still add up to 1.
 */
export interface TripTreasureOverride {
  slots?: number;
  chance?: Readonly<Record<Rarity, number>>;
  leastHiddenWeight?: number;
  bestHiddenWeight?: number;
}

/** Snack eating reach tuning: snacks are eaten at the drawn head, not the body centre. */
export interface SnackReachTuning {
  /**
   * Distance in px along the facing, rotated with the body, from the body centre to the reach
   * centre when the body is not squashed. headPoint (src/logic/collectibles.ts) shortens it by the
   * turn squash.
   */
  headAhead: number;
  /** Distance in px from the reach centre within which a snack is eaten (inclusive). */
  radius: number;
}

/** Plastic worm tuning: a slow-only hazard the axolotl eats by mistake, then spits out. */
export interface PlasticWormTuning {
  /** Top speed multiplier while queasy; acceleration and Tail Dash are unchanged. */
  speedFactor: number;
  /** Seconds the axolotl stays queasy after eating a plastic worm. */
  queasyTime: number;
  /** Distance in px past the head reach centre, along the facing and rotation, where a spat worm lands. */
  spitDistance: number;
  /** Range in px from a plastic worm within which the axolotl meets it, unlocking its fact card. */
  meetRange: number;
  /** Peak queasy wobble angle in radians. */
  wobbleAmp: number;
  /** Queasy wobble cycle length in seconds. */
  wobblePeriod: number;
}

/** Ghost net tuning: a slow-only hazard that snags the axolotl, which wriggles free. */
export interface GhostNetTuning {
  /** Top speed multiplier while snagged; acceleration and Tail Dash are unchanged. */
  speedFactor: number;
  /** Seconds the axolotl stays snagged after swimming into a net's reach. */
  snagTime: number;
  /** Distance in px from a net's edge within which the body centre is snagged (inclusive). */
  reach: number;
  /** Range in px from a net's edge within which the axolotl meets it, unlocking its fact card. */
  meetRange: number;
  /** Peak snag wriggle angle in radians. */
  wriggleAmp: number;
  /** Snag wriggle cycle length in seconds. */
  wrigglePeriod: number;
}

/**
 * Water hyacinth mat tuning: pairs of mats that drift together to close a channel and apart to open
 * it, on a fixed cycle (ElementType and MatPair in src/logic/hazards.ts).
 */
export interface HyacinthMatTuning {
  /** Length of one full mat cycle in seconds; openFor, closingFor and closedFor fill it. */
  period: number;
  /** Seconds from the start of each cycle the channel is open; openingFor is part of it. */
  openFor: number;
  /** Seconds at the start of the open window over which the mats drift apart; part of openFor. */
  openingFor: number;
  /** Seconds after the open window over which the mats drift together (the warning). */
  closingFor: number;
  /** Seconds after closing for which the channel stays closed. */
  closedFor: number;
  /** Clear height in px at or above which the channel counts as open: the safe passing width. */
  passableHeight: number;
  /** Least clear height in px of a fully open channel; each pair's MatPair.openHeight is at least this. */
  openHeight: number;
  /** Distance in px each mat is grown by; the explorer's body centre stays out of the grown mat. */
  bodyGrow: number;
  /** Range in px from a pair's sweep within which the axolotl meets the mats, unlocking their fact card. */
  meetRange: number;
  /** Seconds into the cycle at which each pair's open window starts, in pair order. */
  offsets: readonly number[];
}

/** Punting pole tuning: a moving hazard that jabs down from the surface on a fixed cycle. */
export interface PuntingPoleTuning {
  /** Seconds at rest, up and out of the water, at the start of each cycle. */
  restFor: number;
  /** Seconds of the warning (the telegraph), still out of the water; at least the 0.8 s floor. */
  warnFor: number;
  /** Seconds over which the tip goes down to the depth at a steady speed. */
  jabFor: number;
  /** Seconds the tip holds at the depth. */
  holdFor: number;
  /** Seconds over which the tip lifts back up at a steady speed. */
  liftFor: number;
  /** Depth in px below the surface the tip reaches. */
  depth: number;
  /** Shaft half width in px. */
  halfWidth: number;
  /** Distance in px from the shaft within which the body centre touches it (inclusive). */
  touchReach: number;
  /** Range in px from the pole's sweep within which the axolotl meets it, unlocking its fact card. */
  meetRange: number;
}

/** Drifting ghost net limits: how slowly and how far a net may drift. */
export interface DriftingNetTuning {
  /** Default drift cycle length in seconds. */
  period: number;
  /** Longest drift path in px. */
  maxPath: number;
}

/** Tadpole limits: every area's tadpole rule and wander loops stay inside them (issue #131, ND-2, ND-3). */
export interface TadpoleTuning {
  /** Highest tadpole speed in px/s. */
  maxSpeed: number;
  /** Fewest turn points a wander loop needs to count as wandering (meetsSnackMotion). */
  minLoopPoints: number;
  /** Most turn points a wander loop may have. */
  maxLoopPoints: number;
  /** Narrowest home area (the box around a wander loop) in px. */
  minHomeWidth: number;
  /** Widest home area in px: one screen. */
  maxHomeWidth: number;
  /** Shortest home area in px. */
  minHomeHeight: number;
  /** Tallest home area in px: one screen. */
  maxHomeHeight: number;
  /** Shortest leg, turn point to turn point, in seconds at the area's speed. */
  minLegSeconds: number;
  /** Longest leg in seconds at the area's speed. */
  maxLegSeconds: number;
  /** Longest lap in seconds. */
  maxLapSeconds: number;
  /** Share of the loop its longest stretch out of every threat's reach must be at least. */
  safeLoopShare: number;
}

/** Freshwater shrimp limits: every area's shrimp rule stays inside them. */
export interface ShrimpTuning {
  /** Shortest rest in seconds after a flick lands. */
  minRest: number;
  /** Shortest flick distance in px. */
  minFlick: number;
  /** Longest flick distance in px. */
  maxFlick: number;
  /** Highest flick speed in px/s. */
  maxFlickSpeed: number;
  /** Speed in px/s a one-leg axolotl is counted to close on a landed shrimp, for the catch limit. */
  catchSpeed: number;
  /** A hop's share of the flick distance (its longest hop) and of the flick speed (its hop speed). */
  hopShare: number;
  /** The rest after a hop, as a share of the rest after a flick. */
  hopRestShare: number;
  /** Px from the head within which a shrimp does not hop. */
  holdDistance: number;
  /** Widest home (the box around its hop spots) in px. */
  maxHomeWidth: number;
  /** Tallest home in px. */
  maxHomeHeight: number;
  /** Fewest hop spots a home needs to count as hopping (meetsSnackMotion). */
  minHomeSpots: number;
  /** Most hop spots a home may have. */
  maxHomeSpots: number;
  /** Share of a home's hop spots that must be out of every threat's reach. */
  safeSpotShare: number;
}

/** Treasure hint sparkle tuning. */
export interface HintTuning {
  /** Distance in px within which a treasure's hint sparkle shows; strictly shorter for rarer. */
  range: Readonly<Record<Rarity, number>>;
  /** Extra px a shown hint keeps showing beyond its range. */
  hysteresis: number;
}

/** Which end of a pool's distances to the tilapia a rarity favours. */
export type RiskSide = 'nearer' | 'farther';

/** A band of distances in px from a hiding spot to the nearest tilapia route. */
export interface RiskBand {
  /** Lower edge in px; a spot must be farther than this (exclusive). */
  over: number;
  /** Upper edge in px; a spot may be exactly this far (inclusive). */
  upTo: number;
}

/** How close each rarity's hiding spots sit to the tilapia: rarer treasures sit nearer (issue #70). */
export interface RiskTuning {
  /** Each rarity's band of distances from a spot to the nearest point of any tilapia route. */
  band: Readonly<Record<Rarity, Readonly<RiskBand>>>;
  /** Least distance in px from a spot to any route waypoint, where a tilapia turns. */
  turnClearance: number;
  /** Spot weight for the pool spot at the end away from the rarity's favoured side. */
  unfavouredWeight: number;
  /** Spot weight for the pool spot at the rarity's favoured side; weights between are linear in distance. */
  favouredWeight: number;
  /** Each rarity's favoured side: nearer to or farther from the tilapia. */
  favoured: Readonly<Record<Rarity, RiskSide>>;
}

export const SWIM: Readonly<SwimTuning> = Object.freeze({
  maxSpeed: 150,
  accel: 520,
  drag: 2.0,
  dashSpeed: 330,
  dashDuration: 0.3,
  dashCooldown: 1.6,
  turnHysteresis: 12,
  edgeBounce: 0.2,
  dtMax: 0.05,
});

export const VIEW: Readonly<ViewTuning> = Object.freeze({
  minVisibleW: 320,
  dprCap: 2,
  bakeScaleMax: 3,
});

export const STICK: Readonly<StickTuning> = Object.freeze({
  baseDiameter: 128,
  knobDiameter: 52,
  travel: 0.8,
  deadzone: 0.12,
  margin: 16,
  gap: 12,
  zoneReach: 0.75,
  minScale: 0.7,
});

/** Provisional leg values; regrow, protected time and speed shares from the PRD Tuning values. */
export const LEGS: Readonly<LegTuning> = Object.freeze({
  count: 4,
  regrowTime: 40,
  snackSpeedUp: 0.1,
  protectedTime: 2,
  speedByLegs: Object.freeze([0.6, 0.75, 0.9, 1]),
  wobbleAmp: 0.06,
  wobblePeriod: 0.9,
});

/**
 * Provisional tilapia values; windup floor and cooldown from the PRD Tuning values. Hit and touch
 * reach match a Medium axolotl at every size (PRD F4).
 */
export const TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  minWindup: 0.8,
  windup: 0.9,
  cooldown: 2.5,
  lungeRange: 140,
  lungeSpeed: 380,
  lungeDuration: 0.4,
  hitRadius: 26,
  contactRadius: 29,
  bodyRadius: 24,
  patrolSpeed: 45,
  bumpSpeed: 160,
  bumpCooldown: 0.6,
});

/**
 * Provisional heron values (PRD N3, issue #111); tune in play. The heron is a wading stalker: it
 * wades its stretch at patrolSpeed, warns on sight for 1.2 s (longer than the tilapia's 0.9 s, above
 * the PRD's 0.8 s floor) when the axolotl is within lungeRange of where it stands, then stabs the
 * spot fixed at the warning start in lungeDuration and stands still for the 3 s cooldown.
 * lungeSpeed is the stab's top speed (its reach over its duration); no heron rule reads it, because
 * the stab tip moves from the heron to the fixed spot (stabTip in src/logic/predators.ts). Hit
 * reach matches a Medium axolotl at every size (PRD F4), as the tilapia's does. contactRadius and
 * bumpSpeed are 0 and never read, because the heron never touches or bumps (HERON_SPECIES).
 * bodyRadius is 0 because the heron stands with its body above the water and only its beak reaches
 * in, so nothing keeps it off the safe area.
 */
export const HERON: Readonly<TilapiaTuning> = Object.freeze({
  minWindup: 0.8,
  windup: 1.2,
  cooldown: 3,
  lungeRange: 110,
  lungeSpeed: 110 / 0.3,
  lungeDuration: 0.3,
  hitRadius: 26,
  contactRadius: 0,
  bodyRadius: 0,
  patrolSpeed: 20,
  bumpSpeed: 0,
  bumpCooldown: 0.6,
});

/**
 * Provisional garter snake values (issue #103); tune in play. The snake swims its stretch at the
 * surface at patrolSpeed, warns with ripple rings for 0.8 s (the PRD's 0.8 s floor) when the
 * axolotl is within lungeRange of its head, then darts lungeSpeed x lungeDuration = 126 px and rests
 * for the 2 s cooldown. Hit, touch and body reach, and the gentle bump, are the tilapia's, so they
 * match a Medium axolotl at every size (PRD F4). It warns only while its head is on its stretch,
 * so its depth stays bounded without a dart cap (the `warnOnRoute` rule on GARTER_SNAKE_SPECIES in
 * src/logic/predators.ts).
 */
export const GARTER_SNAKE: Readonly<TilapiaTuning> = Object.freeze({
  minWindup: 0.8,
  windup: 0.8,
  cooldown: 2,
  lungeRange: 110,
  lungeSpeed: 360,
  lungeDuration: 0.35,
  hitRadius: TILAPIA.hitRadius,
  contactRadius: TILAPIA.contactRadius,
  bodyRadius: TILAPIA.bodyRadius,
  patrolSpeed: 55,
  bumpSpeed: TILAPIA.bumpSpeed,
  bumpCooldown: TILAPIA.bumpCooldown,
});

/**
 * Provisional common carp values (PRD open question 253, ND-6); tune in play. The carp patrols at
 * every depth at patrolSpeed and digs in the mud on the bed (issue #130, ND-10). It warns for
 * 1.0 s, then sweeps its tail 200 x 0.6 = 120 px along the aim locked at the end of the warning,
 * and rests for the 2.5 s cooldown. Its hit, touch and body reach are larger than the tilapia's
 * because it is a bigger fish; the gentle bump is the tilapia's.
 */
export const CARP: Readonly<TilapiaTuning> = Object.freeze({
  minWindup: 0.8,
  windup: 1.0,
  cooldown: 2.5,
  lungeRange: 120,
  lungeSpeed: 200,
  lungeDuration: 0.6,
  hitRadius: 38,
  contactRadius: 41,
  bodyRadius: 32,
  patrolSpeed: 35,
  bumpSpeed: 160,
  bumpCooldown: 0.6,
});

/**
 * Provisional crayfish values (issue #77, ND-5); tune in play. The crayfish walks its floor stretch
 * at patrolSpeed, stops and opens its claws wide for 0.8 s (the PRD's 0.8 s floor) when the
 * axolotl is within lungeRange of it, then pinches lungeSpeed x lungeDuration = 120 px along the
 * aim locked at the end of the warning, straight at the axolotl's place then, up off the floor
 * included, and rests for the 1.8 s cooldown. It warns only while on its stretch (the `warnOnRoute`
 * rule on CRAYFISH_SPECIES in src/logic/predators.ts), so mid-water above the reach is safe. Hit, touch
 * and body reach, and the gentle bump, are the tilapia's, so they match a Medium axolotl at every
 * size (PRD F4).
 */
export const CRAYFISH: Readonly<TilapiaTuning> = Object.freeze({
  minWindup: 0.8,
  windup: 0.8,
  cooldown: 1.8,
  lungeRange: 90,
  lungeSpeed: 400,
  lungeDuration: 0.3,
  hitRadius: TILAPIA.hitRadius,
  contactRadius: TILAPIA.contactRadius,
  bodyRadius: TILAPIA.bodyRadius,
  patrolSpeed: 60,
  bumpSpeed: TILAPIA.bumpSpeed,
  bumpCooldown: TILAPIA.bumpCooldown,
});

/**
 * Provisional chase defaults for each predator type (PRD open question 251, ND-4); tune in play.
 * None is wired into a real area. Each speed is strictly between the 2-leg (112.5 px/s) and 4-leg
 * (150 px/s) top speeds, and each sight is greater than its predator's lungeRange (ND-3). This one
 * is for a tilapia in a full-bar area.
 */
export const TILAPIA_CHASE: Readonly<ChaseTuning> = Object.freeze({
  sight: 240,
  leash: 160,
  speed: 125,
});

/** Provisional chase default for a tilapia in a ramp-bar area (PRD open question 251, ND-4). */
export const TILAPIA_RAMP_CHASE: Readonly<ChaseTuning> = Object.freeze({
  sight: 200,
  leash: 80,
  speed: 115,
});

/**
 * Provisional chase default for a garter snake (PRD open question 251, ND-4). It chases along its
 * stretch only, so its leash is 0.
 */
export const GARTER_SNAKE_CHASE: Readonly<ChaseTuning> = Object.freeze({
  sight: 200,
  leash: 0,
  speed: 120,
});

/** Provisional chase default for a common carp (PRD open question 251, ND-4). */
export const CARP_CHASE: Readonly<ChaseTuning> = Object.freeze({
  sight: 220,
  leash: 120,
  speed: 115,
});

/**
 * Provisional chase default for a crayfish (issue #77, ND-5). It chases along its floor stretch
 * only, so its leash is 0.
 */
export const CRAYFISH_CHASE: Readonly<ChaseTuning> = Object.freeze({
  sight: 200,
  leash: 0,
  speed: 120,
});

/** Provisional carried-home values; a gentle float of 1.5 to 5 s, or a 1.5 s still bubble. */
export const CARRY: Readonly<CarryTuning> = Object.freeze({
  speed: 300,
  minTime: 1.5,
  maxTime: 5,
  stillHold: 1.5,
});

/** Provisional find values. */
export const FINDS: Readonly<FindTuning> = Object.freeze({
  pickupRadius: 24,
  containerRadius: 30,
});

/**
 * Provisional trip treasure values from the PRD Tuning values (B4): 6 treasure slots per trip,
 * each slot Common 65%, Rare 27%, Epic 6% or Legendary 2%. The farthest spot from the main swim
 * path is picked 3 times as often as the nearest.
 */
export const TRIP_TREASURES: Readonly<TripTreasureTuning> = Object.freeze({
  slots: 6,
  chance: Object.freeze({ common: 0.65, rare: 0.27, epic: 0.06, legendary: 0.02 }),
  leastHiddenWeight: 1,
  bestHiddenWeight: 3,
});

/**
 * Per-area changes to TRIP_TREASURES, keyed by area id. An area with no entry uses the default (PRD B4).
 * The keys are the literal area ids because this file cannot import zone.ts or pondLayout.ts.
 * The pond, Area 2, has 7 slots, the pond at dusk, Area 3, has 8, the chinampa gardens, Area 4,
 * have 9, the chinampa gardens' Area 5 has 10, the spring cave, Area 6, has 11 (issue #77), and the
 * spring cave's Area 7 has 12 (issue #105).
 */
export const TRIP_TREASURES_BY_AREA: Readonly<Record<string, Readonly<TripTreasureOverride>>> = Object.freeze({
  canal: Object.freeze({ slots: 6 }),
  'pond-1': Object.freeze({ slots: 7 }),
  'pond-2': Object.freeze({ slots: 8 }),
  'chinampa-1': Object.freeze({ slots: 9 }),
  'chinampa-2': Object.freeze({ slots: 10 }),
  'spring-cave-1': Object.freeze({ slots: 11 }),
  'spring-cave-2': Object.freeze({ slots: 12 }),
});

/**
 * The trip treasure tuning for an area: TRIP_TREASURES with that area's override merged field by
 * field, except `chance`, which an override replaces whole.
 */
export function tripTreasureTuning(
  areaId: string,
  overrides: Readonly<Record<string, Readonly<TripTreasureOverride>>> = TRIP_TREASURES_BY_AREA,
): TripTreasureTuning {
  const override: Readonly<TripTreasureOverride> = Object.hasOwn(overrides, areaId) ? overrides[areaId] : {};
  const base = TRIP_TREASURES;
  const chance = override.chance ?? base.chance;
  return Object.freeze({
    slots: override.slots ?? base.slots,
    chance: Object.freeze({
      common: chance.common,
      rare: chance.rare,
      epic: chance.epic,
      legendary: chance.legendary,
    }),
    leastHiddenWeight: override.leastHiddenWeight ?? base.leastHiddenWeight,
    bestHiddenWeight: override.bestHiddenWeight ?? base.bestHiddenWeight,
  });
}

/**
 * Provisional snack reach values, mirroring the drawn head because src/logic cannot import
 * src/art (ESLint): HEAD_ELL (src/art/drawAxolotl.ts, centre (26, -1), radii 27 x 22), its LW 3.5
 * ink outline (src/art/palette.ts, stroked at 2 x LW under the fill by blob in src/art/canvasKit.ts),
 * AXO_SCENE_SCALE 0.95 (src/art/drawAxolotl.ts) and AXO_SIZE_SCALE.large 1
 * (src/art/drawAxolotlParts.ts). `headAhead` is the largest head centre, 26 x 0.95 x 1 = 24.7,
 * rounded to 25. The farthest drawn point of the largest head, ink included, is about 29.3 px from
 * that reach centre; `radius` adds room for the longest swim step so a fast pass still eats.
 * One reach for every size and age: size is for looks only (PRD F4), and a Baby keeps the head.
 */
export const SNACK_REACH: Readonly<SnackReachTuning> = Object.freeze({
  headAhead: 25,
  radius: 36,
});

/**
 * Provisional plastic worm values (issue #75); tune in play. While queasy the axolotl swims at
 * 0.6 of its top speed for 3 s and wobbles gently; a spat worm lands 48 px past the head reach
 * centre. The axolotl meets a plastic worm within 100 px.
 */
export const PLASTIC_WORMS: Readonly<PlasticWormTuning> = Object.freeze({
  speedFactor: 0.6,
  queasyTime: 3,
  spitDistance: 48,
  meetRange: 100,
  wobbleAmp: 0.08,
  wobblePeriod: 0.6,
});

/**
 * Provisional ghost net values (issue #76); tune in play. While snagged the axolotl swims at 0.5
 * of its top speed for 2 s and wriggles free with a quick, small wriggle. The axolotl meets a ghost
 * net within 100 px of its edge, as it meets a plastic worm.
 *
 * `reach` mirrors the drawn body because src/logic cannot import src/art (ESLint): the Regular
 * torso's y radius 19 (BODY_BUILDS in src/art/drawAxolotlParts.ts) plus its LW 3.5 ink outline
 * (src/art/palette.ts, stroked at 2 x LW under the fill), times AXO_SCENE_SCALE 0.95
 * (src/art/drawAxolotl.ts) and AXO_SIZE_SCALE.medium 0.85 (src/art/drawAxolotlParts.ts):
 * (19 + 3.5) x 0.95 x 0.85 = 18.2, rounded to 18. So a snag starts when the inked top or bottom of
 * a Medium body reaches the net, and a head or tail swimming in end-on pokes into the loose mesh
 * first. One reach for every size and age: size is for looks only (PRD F4), as the tilapia's
 * reach matches a Medium axolotl.
 */
export const GHOST_NETS: Readonly<GhostNetTuning> = Object.freeze({
  speedFactor: 0.5,
  snagTime: 2,
  reach: 18,
  meetRange: 100,
  wriggleAmp: 0.1,
  wrigglePeriod: 0.4,
});

/**
 * Provisional water hyacinth mat values (issue #103); tune in play. Each pair runs an 8 s cycle
 * from its offset: 3 s open, of which the first 1 s is the mats drifting apart, then 1 s drifting
 * together (the warning), then 4 s closed. The channel counts as open once its clear height is at
 * least 36 px, the safe passing width, and a fully open channel is at least 72 px tall, two safe
 * passing widths. bodyGrow is the ghost net reach, the Medium body's half height, so a body centre
 * kept that far out of a mat keeps the inked body out of it. The axolotl meets the mats within
 * 180 px of a pair's sweep, as it meets a tilapia or a heron. Pair 1 starts its cycle at 0 s and
 * pair 2 at 4 s, so the two pairs are out of step.
 */
export const HYACINTH_MATS: Readonly<HyacinthMatTuning> = Object.freeze({
  period: 8,
  openFor: 3,
  openingFor: 1,
  closingFor: 1,
  closedFor: 4,
  passableHeight: 36,
  openHeight: 72,
  bodyGrow: GHOST_NETS.reach,
  meetRange: 180,
  offsets: Object.freeze([0, 4]),
});

/**
 * Provisional punting pole values (PRD open question 256, ND-9); tune in play. A 4 s cycle: rest
 * 1.6 s, warn 1.0 s, jab 0.3 s, hold 0.5 s and lift 0.6 s. The tip reaches 180 px below the surface
 * on a 10 px pole. touchReach is the ghost net reach, the Medium body's half height, so the danger
 * zone is x ± 23 px from the surface to 198 px below it. The axolotl meets a pole within 180 px of
 * its sweep, as it meets a tilapia.
 */
export const PUNTING_POLES: Readonly<PuntingPoleTuning> = Object.freeze({
  restFor: 1.6,
  warnFor: 1.0,
  jabFor: 0.3,
  holdFor: 0.5,
  liftFor: 0.6,
  depth: 180,
  halfWidth: 5,
  touchReach: 18,
  meetRange: 180,
});

/**
 * Provisional drifting ghost net values (PRD open question 258, ND-11); tune in play. A 16 s cycle
 * along a path of at most 200 px; a 160 px path peaks at about 31 px/s, well under a one-leg
 * axolotl's 90 px/s.
 */
export const DRIFTING_NETS: Readonly<DriftingNetTuning> = Object.freeze({
  period: 16,
  maxPath: 200,
});

/**
 * Tadpole limits (PRD open questions 269 and 271, ND-22 and ND-24; issue #131, ND-2 and ND-3);
 * limits only, with no per-area values. maxSpeed is 0.8 x a one-leg axolotl's 90 px/s, so a
 * one-leg axolotl always swims faster. A wander loop has 4 to 8 turn points; its home area is 320
 * to 480 px wide and at least 150 px tall, inside one 480 x 360 screen; each leg takes 1.5 to 5 s
 * and a lap at most 40 s; and its longest stretch out of every threat's reach is at least half of
 * it (ND-7).
 */
export const TADPOLES: Readonly<TadpoleTuning> = Object.freeze({
  maxSpeed: 72,
  minLoopPoints: 4,
  maxLoopPoints: 8,
  minHomeWidth: 320,
  maxHomeWidth: 480,
  minHomeHeight: 150,
  maxHomeHeight: 360,
  minLegSeconds: 1.5,
  maxLegSeconds: 5,
  maxLapSeconds: 40,
  safeLoopShare: 0.5,
});

/**
 * Freshwater shrimp limits (PRD open questions 269 and 272, ND-22 and ND-25); limits only, with no
 * per-area values. maxFlickSpeed is a four-leg axolotl's top speed. catchSpeed is a one-leg
 * axolotl's 90 px/s less a 20 px/s allowance for drift, for the catch limit
 * restFor x catchSpeed >= triggerRadius + flickDistance - 36. A hop (issue #131, ND-5) is at most
 * 2/3 of the flick distance at 2/3 of the flick speed and is followed by 3/4 of the rest; no hop
 * starts within 120 px of the head. A home has 3 to 6 hop spots in a box at most 200 x 160 px, and
 * at least half its spots are out of every threat's reach (ND-7).
 */
export const SHRIMP: Readonly<ShrimpTuning> = Object.freeze({
  minRest: 1.0,
  minFlick: 24,
  maxFlick: 72,
  maxFlickSpeed: 150,
  catchSpeed: 70,
  hopShare: 2 / 3,
  hopRestShare: 3 / 4,
  holdDistance: 120,
  maxHomeWidth: 200,
  maxHomeHeight: 160,
  minHomeSpots: 3,
  maxHomeSpots: 6,
  safeSpotShare: 0.5,
});

/** Provisional hint values; rarer treasures get a subtler, shorter-range hint (PRD B7). */
export const HINTS: Readonly<HintTuning> = Object.freeze({
  range: Object.freeze({ common: 150, rare: 115, epic: 85, legendary: 60 }),
  hysteresis: 16,
});

/**
 * Provisional risk values (issue #70). Bands of distance to the nearest tilapia route: Common over
 * 200 px, Rare over 140 and up to 200, Epic over 70 and up to 140, Legendary up to 70. The Rare
 * and Epic edge is the lunge range, so only Epic and Legendary sit where a lunge can start. Every
 * spot keeps 60 px from the waypoints where a tilapia turns. Within a pool, the spot at the
 * favoured side is picked twice as often as the spot at the other end: Common favours farther,
 * the rarer three favour nearer.
 */
export const RISK: Readonly<RiskTuning> = Object.freeze({
  band: Object.freeze({
    common: Object.freeze({ over: 200, upTo: Infinity }),
    rare: Object.freeze({ over: 140, upTo: 200 }),
    epic: Object.freeze({ over: 70, upTo: 140 }),
    legendary: Object.freeze({ over: -Infinity, upTo: 70 }),
  }),
  turnClearance: 60,
  unfavouredWeight: 1,
  favouredWeight: 2,
  favoured: Object.freeze({ common: 'farther', rare: 'nearer', epic: 'nearer', legendary: 'nearer' }),
});
