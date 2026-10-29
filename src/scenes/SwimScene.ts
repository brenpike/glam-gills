import * as Phaser from 'phaser';
import { createAxolotlRigView, type AxolotlRigView } from '../art/axolotlRig';
import { AXO_MAX_TAIL_AMP, AXO_SCENE_SCALE, type AxolotlPose } from '../art/drawAxolotl';
import { AXO_SIZE_SCALE } from '../art/drawAxolotlParts';
import { dreamSheenAt } from '../art/drawDreamOverlay';
import { artOutfit } from '../art/drawWearables';
import type { HabitatLook } from '../art/habitatLook';
import type { MobileSnackTextures } from '../art/mobileSnackTextures';
import { DEPTH } from '../art/layers';
import { axolotlPalette, T_STATIC } from '../art/palette';
import { BUBBLE_RADII, type SceneryTextures, type TexInfo } from '../art/textures';
import { atExit, exitContact, exitOpen, type AreaData } from '../logic/areas';
import { BUBBLE_MAX_ALIVE, bubblePos, createBubbles, updateBubbles, type BubbleSystem } from '../logic/bubbles';
import {
  SPARKLE_SNACKS_LEFT,
  collectSnacksAtHead,
  drawnSnackX,
  drawnSnackY,
  headPoint,
  pullSnacksToward,
  snackTally,
  type Collectible,
  type SnackFrame,
  type SnackTally,
} from '../logic/collectibles';
import {
  closeDashPotTip,
  createDashPotTip,
  dashPotTipSeen,
  stepDashPotTip,
  type DashPotTipState,
  type DashPotTipStep,
} from '../logic/dashPotTip';
import { TURN_SQUASH, bodyPoint, drawnAxolotl, type DrawnAxolotl } from '../logic/drawnAxolotl';
import { currentAt, reedDragAt, reedsNear } from '../logic/environment';
import { exitArrowSide } from '../logic/exitArrow';
import { exitGateBase } from '../logic/exitGate';
import {
  GAME_EVENTS,
  REGISTRY_KEYS,
  type AllCollectedPayload,
  type CollectedPayload,
  type DashPotTipPayload,
  type DashStatePayload,
  type ExitClosedPayload,
  type GhostNetSnaggedPayload,
  type PlasticWormSpatPayload,
  type ReducedMotionPayload,
  type SnackBoostPayload,
  type SteerPayload,
} from '../logic/gameEvents';
import { isSnagged, snagSwimTuning } from '../logic/ghostNets';
import {
  glowMotion,
  glowPlants,
  shownInDark,
  type DarkLight,
  type GlowMotion,
} from '../logic/glowPlants';
import { elementSweep, type HazardRect } from '../logic/hazards';
import { hintSparkleRadius } from '../logic/hints';
import { blockExplorer, type MatAvoid } from '../logic/hyacinthMats';
import { legSwimTuning } from '../logic/legs';
import {
  metSnackTypeIds,
  mobileLegBoxes,
  mobileSnackAvoid,
  oneTimeDarts,
  snackMagnetSpeed,
  type MobileSnackAvoid,
  type MobileSnackPoseScene,
} from '../logic/mobileSnacks';
import { motionProfile, type MotionProfile } from '../logic/motion';
import {
  blockAtRock,
  createPebbles,
  nearUnrolledPebble,
  pebbleHintShown,
  stepPebbleHintClock,
  stepPebbles,
  type PebbleState,
  type RockWall,
} from '../logic/pebble';
import { outfitPerks, perkTripContext, perkTuning, type PerkTuning } from '../logic/perks';
import { isQueasy, queasySwimTuning, type SpitAvoid } from '../logic/plasticWorms';
import { CARP_SPECIES, CRAYFISH_SPECIES, GARTER_SNAKE_SPECIES, HERON_SPECIES } from '../logic/predators';
import { addPulseCurrent, pulseMotion, pulsingCurrents, type PulseMotion, type PulsingCurrentSpawn } from '../logic/pulsingCurrents';
import { mulberry32 } from '../logic/rng';
import { areaStrandingChance, tripStranding } from '../logic/rescue';
import { explorerAxolotl, markDashPotTipSeen, restoreSnacks, tripStart } from '../logic/session';
import { createShrimpFlicks, stepShrimpFlicks, type ShrimpFlickState } from '../logic/shrimpFlick';
import { stepSnackDarts, type SnackDartAvoid, type SnackDartState } from '../logic/snackDart';
import { steerFromKeys, type KeyState } from '../logic/steering';
import { startDashVelocity, stepSwim, swimIntensity, type SwimBounds, type SwimState } from '../logic/swimPhysics';
import { createDash, dashCharge, tryStartDash, updateDash, type DashState } from '../logic/tailDash';
import {
  beatArea,
  createTrip,
  eatPlasticWorms,
  eatSnacks,
  goHome,
  keepExploring,
  markFactCardSeen,
  meetSnacks,
  sameTripSnapshot,
  stepTrip,
  tripAxolotlPos,
  tripSnapshot,
  type TripContext,
  type TripEvent,
  type TripInput,
  type TripState,
} from '../logic/trip';
import { TRIP_EVENTS, TRIP_REGISTRY_KEYS, type TripSnapshot } from '../logic/tripEvents';
import { LEGS, SWIM, type SwimTuning } from '../logic/tuning';
import { len, type Vec2 } from '../logic/vec';
import { SURF, swimBounds, waveY, type CollectibleKind, type CurrentZone, type ZoneLayout } from '../logic/zone';
import { setMusicScreen } from '../platform/musicPlayer';
import {
  SCENE_KEYS,
  areaFor,
  areaLook,
  blinkAt,
  cssColor,
  fitWorldCamera,
  readSceneView,
  sceneryFor,
  zoneFor,
  type GameAssets,
  type SceneView,
  type SwimStart,
} from './BootScene';
import { CarpView } from './CarpView';
import { CrayfishView } from './CrayfishView';
import { DarkCaveView } from './DarkCaveView';
import { ExitView } from './ExitView';
import { FireflyView } from './FireflyView';
import { GarterSnakeView } from './GarterSnakeView';
import { GhostNetView } from './GhostNetView';
import { GlowPlantView } from './GlowPlantView';
import { HeronView } from './HeronView';
import { HomeSpotView } from './HomeSpotView';
import { HUD_EVENTS, type DashPotTipHeldPayload, type FactCardSeenPayload } from './HudScene';
import { HyacinthMatView } from './HyacinthMatView';
import { MobileSnackView } from './MobileSnackView';
import { addMotionTween, settleMotionTweens } from './motionTweens';
import { MovingHazardView } from './MovingHazardView';
import { PebbleRoomView } from './PebbleRoomView';
import { PlasticWormView } from './PlasticWormView';
import { PredatorView } from './PredatorView';
import { PulsingCurrentView } from './PulsingCurrentView';
import { readSession, returnToHomeTank, writeSession } from './sceneFlow';
import { faceSprite } from './spriteFacing';
import { StrandedView } from './StrandedView';
import { TreasureView, type DarkShows } from './TreasureView';
import { TripSoundRouter } from './TripSoundRouter';

const TAU = Math.PI * 2;
const SIM_SEED = 0xb0bb1e;
const IDLE_PADDLE = 0.3;
const DASH_PADDLE = 2;
const SWIM_TAIL_BOOST = 0.2;
const TURN_MS = 140;
const SPARKLE_FADE_S = 0.4;
const SPARKLE_SPAWN_S = 0.05;
const SPARKLE_LIFE_S = 0.4;
const SPARKLE_POOL = 10;
/** Dash sparkles spawn this far behind the body origin, in axolotl art local units. */
const SPARKLE_TAIL_X = 46.3;
/** Full width of the dash sparkle spawn spread along the body, in axolotl art local units. */
const SPARKLE_SPREAD_X = 10.5;
/** Full height of the dash sparkle spawn spread across the body, in axolotl art local units. */
const SPARKLE_SPREAD_Y = 14.7;
/** Bubble emitter point at the mouth, ahead of and below the body origin, in axolotl art local units. */
const MOUTH_X = 51.6;
const MOUTH_Y = 4.2;
/** Scratch point for the bubble emitter, reused each frame; updateBubbles copies its x and y. */
const MOUTH_AT: Vec2 = { x: 0, y: 0 };
/** Scratch point for a dash sparkle spawn, reused each spawn; it is read straight into setPosition. */
const SPARKLE_AT: Vec2 = { x: 0, y: 0 };
const REED_PERIOD = 4;
const REED_TOUCH_RADIUS = 26;
const REED_NUDGE_PX = 7;
const REED_NUDGE_RATE = 6;
const SNACK_POP_MS = 200;
/** Last-snack hint star (PRD H3, guide 7e and 9): the Common star, 16 px above the snack. */
const SNACK_STAR_OFFSET_Y = -16;
const SNACK_STAR_GROW_FROM = 0.6;
const SNACK_STAR_GROW_S = 0.4;
const SNACK_STAR_BOB_PX = 2;
const SNACK_STAR_SPIN_RAD = 0.15;
const SNACK_STAR_PERIOD = 2.4;
const STREAKS_PER_CURRENT = 6;
const STREAK_EDGE_FADE = 40;
const SURFACE_STEP = 8;
const SURFACE_BAND_BOTTOM = SURF + 3;
/** The tally of no snacks, held until setItems first runs. */
const EMPTY_SNACK_TALLY: SnackTally = Object.freeze({ left: 0, collected: 0, sparklingIds: Object.freeze([]) });

interface SteerKeys {
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  up: Phaser.Input.Keyboard.Key[];
  down: Phaser.Input.Keyboard.Key[];
}

interface Streak {
  image: Phaser.GameObjects.Image;
  zone: CurrentZone;
  x: number;
  y: number;
}

interface Sparkle {
  image: Phaser.GameObjects.Image;
  age: number;
}

function anyKeyDown(keys: readonly Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown);
}

function wrapInto(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return min;
  return min + ((((value - min) % span) + span) % span);
}

/** Whether the zone has any tadpole or shrimp. */
function hasMobileSnacks(zone: Pick<ZoneLayout, 'mobileSnacks'>): boolean {
  const mix = zone.mobileSnacks;
  return mix !== undefined && mix.wanders.length + mix.homes.length > 0;
}

/** How many mobile snack types (tadpole, shrimp) the snacks hold: 0, 1 or 2. */
function countMobileSnackTypes(snacks: readonly Readonly<{ kind: CollectibleKind }>[]): number {
  const tadpoles = snacks.some((snack) => snack.kind === 'tadpole') ? 1 : 0;
  const shrimp = snacks.some((snack) => snack.kind === 'shrimp') ? 1 : 0;
  return tadpoles + shrimp;
}

function placeBaked(image: Phaser.GameObjects.Image, info: TexInfo): Phaser.GameObjects.Image {
  return image.setOrigin(info.originNormX, info.originNormY).setScale(1 / info.scale);
}

/**
 * One area of any size, the canal or another: swimming, snacks, currents, reeds, bubbles, Tail
 * Dash, the tilapia, the Home Spot, the hidden treasures (hint stars, Dash pots, the cave and the
 * past-the-current marker), the stranded axolotl, and in the spring cave the crayfish, the dark
 * water and its glow-plants. The camera follows the axolotl across the
 * area; a one-screen-tall area such as the canal never scrolls vertically.
 * One scene start is one trip: it starts from the session and, once the trip ends, hands the trip
 * back to the session and opens the Home Tank.
 */
export class SwimScene extends Phaser.Scene {
  private start!: SwimStart;
  private assets!: GameAssets;
  private zone!: ZoneLayout;
  private scenery!: SceneryTextures;
  private motion!: MotionProfile;
  private view!: SceneView;
  private bounds!: SwimBounds;
  private rand: () => number = Math.random;
  private clock = 0;

  private swim!: SwimState;
  private dash!: DashState;
  private items: Collectible[] = [];
  /** Tally of `items`; written only by setItems, alongside `items`. */
  private snackTally: SnackTally = EMPTY_SNACK_TALLY;
  private bubbles!: BubbleSystem;
  private allDone = false;
  private area!: Readonly<AreaData>;
  /** Colours of the area's habitat: haze and surface. */
  private look!: HabitatLook;
  /** Where a spat plastic worm must not land: the swim bounds, the currents and the safe area. Fixed for the trip. */
  private spitAvoid!: SpitAvoid;
  /** Dart state of the trip's snacks (PRD H4, N2), or null in an area whose snacks never dart. */
  private snackDarts: SnackDartState | null = null;
  /** Where a darted snack must not land; built again only when the plastic worms move. */
  private snackDartAvoid: SnackDartAvoid | null = null;
  /** Flick state of the trip's shrimp (ND-25), or null in an area with no shrimp. */
  private shrimpFlicks: ShrimpFlickState | null = null;
  /** Where a flicking shrimp must not land (ND-26); built again only when the plastic worms move. */
  private shrimpAvoid: MobileSnackAvoid | null = null;
  /** The Snack magnet's pull in px/s (ND-28), worked out once per trip from the perks and the zone. */
  private magnetSpeed = 0;
  /** Mobile snack types in the area not met yet this trip (ND-29); the meet check runs only while above 0. */
  private snackTypesToMeet = 0;
  /** Each water hyacinth mat pair's whole sweep (elementSweep), or null in an area with no mats. Fixed for the trip. */
  private matSweeps: HazardRect[] | null = null;
  /** Where a mat may never push the explorer, or null in an area with no mats. Fixed for the trip. */
  private matAvoid: MatAvoid | null = null;
  /** Swim tuning for `tunedLegs` legs, `tunedQueasy` and `tunedSnagged`, worked out again only when one changes. */
  private tuned: SwimTuning = SWIM;
  private tunedLegs = -1;
  private tunedQueasy = false;
  private tunedSnagged = false;
  /** Snack drift time in seconds; advances only while swimming. */
  private driftClock = 0;
  /** Whether the axolotl centre was at the exit on the latest swimming step. */
  private wasAtExit = false;
  /** Whether this trip has ended at the open exit; once per trip. */
  private areaBeaten = false;
  private trip!: TripState;
  private tripCtx!: TripContext;
  /** The Dash pot tip this trip (PRD B11). */
  private dashPotTip: DashPotTipState = { phase: 'done' };
  /** Whether the HUD holds the Dash pot tip off screen for want of room (X10). */
  private dashPotTipHeld = false;
  private snapshot!: TripSnapshot;
  /** Whether the ended trip has been handed back and the Home Tank asked for; once per trip. */
  private leaving = false;

  private padSteer: Vec2 = { x: 0, y: 0 };
  private lastSteer: Vec2 = { x: 0, y: 0 };
  private keys: SteerKeys = { left: [], right: [], up: [], down: [] };
  private dashKeys: Phaser.Input.Keyboard.Key[] = [];
  private dashKeyLatched = false;
  private dashingThisFrame = false;

  private followPoint = new Phaser.Math.Vector2();
  private axolotlView!: AxolotlRigView;
  private axolotl!: Phaser.GameObjects.Container;
  private predatorView!: PredatorView;
  /** The wading herons, or null in an area with no heron. */
  private heronView: HeronView | null = null;
  /** The garter snakes, or null in an area with no garter snake. */
  private garterSnakeView: GarterSnakeView | null = null;
  /** The water hyacinth mats, or null in an area with no mats. */
  private hyacinthMatView: HyacinthMatView | null = null;
  /** The dusk fireflies, or null in an area whose look has none. */
  private fireflyView: FireflyView | null = null;
  /** The ghost nets and the snag cue, or null in an area with no ghost nets. */
  private ghostNetView: GhostNetView | null = null;
  /** The common carp, or null in an area with no carp route. */
  private carpView: CarpView | null = null;
  /** The moving hazards, or null in an area with no moving hazards. */
  private movingHazardView: MovingHazardView | null = null;
  /** The crayfish, or null in an area with no crayfish. */
  private crayfishView: CrayfishView | null = null;
  /** The dark layer over the area's dark water, or null in an area with no dark water. */
  private darkCaveView: DarkCaveView | null = null;
  /** The glow-plants and their hint, or null in an area with no glow-plants. */
  private glowPlantView: GlowPlantView | null = null;
  /** The glow-plant motion for the reduced-motion preference, worked out again only when it changes. */
  private glowPlantMotion: GlowMotion = glowMotion(false);
  /**
   * This frame's lights through the dark water (DarkCaveView.lights: darkLights, with a new plant
   * light still growing in); empty in an area with no dark water.
   */
  private darkLightsNow: DarkLight[] = [];
  /** The tadpole and shrimp poses, or null in an area with no mobile snacks. */
  private mobileSnackView: MobileSnackView | null = null;
  /** The area's pulsing vents (issue #105, ND-5); empty in an area with none. Fixed for the trip. */
  private vents: readonly Readonly<PulsingCurrentSpawn>[] = [];
  /** The pulsing vents' mouths, bubbles and surges, or null in an area with no vents. */
  private pulsingCurrentView: PulsingCurrentView | null = null;
  /** The pulsing current motion for the reduced-motion preference, worked out again only when it changes. */
  private pulseMotionNow: PulseMotion = pulseMotion(false);
  /** The area's solid rock walls (issue #105, ND-8); empty in an area with none. Fixed for the trip. */
  private rockWalls: readonly Readonly<RockWall>[] = [];
  /** Each pebble's place along its groove this trip (trip state only: every pebble starts at its start). */
  private pebbleStates: readonly PebbleState[] = [];
  /** Seconds of swimming near an unrolled pebble without moving it, for the hint (stepPebbleHintClock). */
  private pebbleHintTime = 0;
  /** The rock walls and pebbles, or null in an area with neither. */
  private pebbleRoomView: PebbleRoomView | null = null;
  /** What every mobile snack pose shares this frame, reused each frame. */
  private mobileSnackScene: MobileSnackPoseScene = { clock: 0, reduced: false, head: { x: 0, y: 0 } };
  private homeSpotView!: HomeSpotView;
  private treasureView!: TreasureView;
  private plasticWormView!: PlasticWormView;
  /** Green cheek tint shown while queasy, or null in an area with no plastic worms. */
  private queasyCheeks: Phaser.GameObjects.Image | null = null;
  private queasyCheeksBaseScale = 1;
  private strandedView!: StrandedView;
  /** Trip overrides from the explorer's outfit only (PRD F12), fixed for the trip. */
  private perks!: PerkTuning;
  private exitView!: ExitView;
  /** This trip's sounds: hears the snack and Dash game events and every dispatched trip event. */
  private tripSounds!: TripSoundRouter;
  private reeds: Phaser.GameObjects.Image[] = [];
  private reedNudge: number[] = [];
  private pads: Phaser.GameObjects.Image[] = [];
  private snacks = new Map<string, Phaser.GameObjects.Image>();
  private snackStars: Phaser.GameObjects.Image[] = [];
  private snackStarBaseScale = 1;
  /** Seconds each sparkling snack's star has shown, by snack id. */
  private snackStarAges = new Map<string, number>();
  private streaks: Streak[] = [];
  private bubbleImages: Phaser.GameObjects.Image[] = [];
  private sparkles: Sparkle[] = [];
  private sparkleCursor = 0;
  private sparkleAcc = 0;
  private surface!: Phaser.GameObjects.Graphics;
  private surfaceFill = { color: 0, alpha: 1 };
  private surfaceLine = { color: 0, alpha: 1 };
  private surfaceLineWidth = 0;

  private swimPhase = 0;
  private gillPhase = 0;
  private sparkleLevel = 0;
  private turn = { squash: 1 };
  private lastFacing: 1 | -1 = 1;
  /** The drawn axolotl this frame, captured once after the trip step; the eat check and the sprite read it. */
  private body!: DrawnAxolotl;
  /** Where the snacks are drawn this frame, captured with `body`. */
  private snackView!: SnackFrame;

  constructor() {
    super(SCENE_KEYS.swim);
  }

  init(data: SwimStart): void {
    this.start = data;
    this.assets = data.assets;
    this.clock = 0;
    this.allDone = false;
    this.leaving = false;
    this.driftClock = 0;
    this.wasAtExit = false;
    this.areaBeaten = false;
    this.dashKeyLatched = false;
    this.dashingThisFrame = false;
    this.padSteer = { x: 0, y: 0 };
    this.lastSteer = { x: 0, y: 0 };
    this.keys = { left: [], right: [], up: [], down: [] };
    this.dashKeys = [];
    this.snacks = new Map();
    this.snackStarAges = new Map();
    this.snackTally = EMPTY_SNACK_TALLY;
    this.sparkleCursor = 0;
    this.sparkleAcc = 0;
    this.sparkleLevel = 0;
    this.turn = { squash: 1 };
    this.tuned = SWIM;
    this.tunedLegs = -1;
    this.tunedQueasy = false;
    this.tunedSnagged = false;
    this.queasyCheeks = null;
    this.snackDarts = null;
    this.snackDartAvoid = null;
    this.shrimpFlicks = null;
    this.shrimpAvoid = null;
    this.magnetSpeed = 0;
    this.snackTypesToMeet = 0;
    this.matSweeps = null;
    this.matAvoid = null;
    this.heronView = null;
    this.garterSnakeView = null;
    this.hyacinthMatView = null;
    this.fireflyView = null;
    this.ghostNetView = null;
    this.carpView = null;
    this.movingHazardView = null;
    this.crayfishView = null;
    this.darkCaveView = null;
    this.glowPlantView = null;
    this.darkLightsNow = [];
    this.mobileSnackView = null;
    this.vents = [];
    this.pulsingCurrentView = null;
    this.rockWalls = [];
    this.pebbleStates = [];
    this.pebbleHintTime = 0;
    this.pebbleRoomView = null;
    this.swimPhase = (TAU * T_STATIC) / 1.2;
    this.gillPhase = (TAU * T_STATIC) / 0.8;
  }

  create(): void {
    const areaId = this.start.areaId;
    const zone = zoneFor(this.assets, areaId);
    const area = areaFor(this.assets, areaId);
    setMusicScreen('trip', area);
    this.zone = zone;
    this.area = area;
    this.look = areaLook(area);
    this.scenery = sceneryFor(this.assets, areaId);
    this.view = readSceneView(this.scale);
    this.motion = motionProfile(this.registry.get(REGISTRY_KEYS.reducedMotion) === true);
    this.glowPlantMotion = glowMotion(!this.motion.ambient);
    this.pulseMotionNow = pulseMotion(!this.motion.ambient);
    this.bounds = swimBounds(zone);
    this.spitAvoid = { bounds: this.bounds, currents: zone.currents, safeArea: zone.safeArea };
    this.rand = mulberry32(SIM_SEED);
    this.swim = { x: zone.start.x, y: zone.start.y, vx: 0, vy: 0, facing: 1 };
    this.lastFacing = this.swim.facing;
    this.dash = createDash();
    this.bubbles = createBubbles();
    // INVARIANT: trip seeds are never saved. The first trip of the session is random; later
    // trips use nextTripSeed of the last trip's seed (tripStart).
    const session = readSession(this.registry);
    const start = tripStart(session, Math.floor(Math.random() * 0x100000000) >>> 0, area.id);
    const explorer = explorerAxolotl(session);
    // INVARIANT: perks are worked out once, with every leg present. The feet rule (Socks and Feet
    // count only with a leg present) never changes them in play: the hit that takes the last leg
    // starts the carry home in that step, and only swimming reads them.
    this.perks = perkTuning(outfitPerks(explorer.outfit));
    this.assets.axolotl.setAppearance({
      look: explorer.look,
      palette: axolotlPalette(explorer.morph, explorer.dreamColour),
      outfit: artOutfit(explorer.outfit),
    });
    this.setItems(restoreSnacks(zone.collectibles, start.eatenSnacks));
    this.allDone = this.snackTally.left === 0;
    this.snackDarts = oneTimeDarts(area, zone);
    this.setUpMobileSnacks();
    const stranding = tripStranding(
      start.ownedMorphs,
      start.waitingStranded,
      zone.strandingPlaces,
      start.tripSeed,
      areaStrandingChance(area),
    );
    this.trip = createTrip(zone, LEGS, start.banked, start.tripSeed, {
      stranding,
      factCardsSeen: start.factCardsSeen,
      returnedFinds: start.returnedFinds,
      area,
    });
    this.dashPotTip = createDashPotTip(session.hub);
    this.setUpMats();
    this.vents = pulsingCurrents(zone.hazards);
    this.rockWalls = zone.rockWalls ?? [];
    this.pebbleStates = createPebbles(this.trip.elements);
    this.dashKeyLatched = true;
    this.tripCtx = perkTripContext(this.perks, this.bounds);
    this.registry.set(REGISTRY_KEYS.total, this.items.length);
    this.registry.set(REGISTRY_KEYS.collected, this.snackTally.collected);

    this.buildWorld();
    this.setupCamera();
    this.setupInput();

    this.tripSounds = new TripSoundRouter(this, () => this.clock);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.on(GAME_EVENTS.REQUEST_DASH, this.handleRequestDash, this);
    this.game.events.on(GAME_EVENTS.STEER, this.handleSteer, this);
    this.game.events.on(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleHidden, this);
    this.game.events.on(TRIP_EVENTS.REQUEST_KEEP_EXPLORING, this.handleRequestKeepExploring, this);
    this.game.events.on(TRIP_EVENTS.REQUEST_GO_HOME, this.handleRequestGoHome, this);
    this.game.events.on(HUD_EVENTS.FACT_CARD_SEEN, this.handleFactCardSeen, this);
    this.game.events.on(HUD_EVENTS.DASH_POT_TIP_CLOSED, this.handleDashPotTipClosed, this);
    this.game.events.on(HUD_EVENTS.DASH_POT_TIP_HELD, this.handleDashPotTipHeld, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.handleResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.publishSnapshot(tripSnapshot(this.trip));
    this.captureDrawnFrame();
    this.renderFrame(0);
    this.scene.launch(SCENE_KEYS.hud, this.start);
  }

  /**
   * Per-frame cost (#31 review findings ac16b4b1, fb55980d, 18472eb6).
   * Snack drift is computed on read from each snack's base point and the drift clock. The snack
   * tally (left, collected, sparkling ids) is worked out only in setItems, when the items change,
   * and frame code reads it. Snack positions, the exit and the last-3 stars create no objects per
   * frame. Drawn-frame capture (#51 review finding cbed1ef9): captureDrawnFrame builds the
   * drawnAxolotl input and result and the snack frame, and update builds the head point once while
   * swimming for the snack magnet and the eat, so four small objects per frame. They stay plain
   * values, like the step results below: drawnAxolotl and headPoint are pure src/logic functions
   * tested as values (ADR 0006), and the eat and the sprite read one immutable capture. Same bounded
   * cost as the residual below.
   * Snack magnet (#16): pullSnacksToward allocates nothing when no snack is in the perk radius (and
   * always with no Snack magnet worn). While it pulls, it builds a new items array and one object
   * per pulled snack, and setItems works the tally out again: bounded by the area's snack count.
   * Plastic worms (#75): swimTuning is worked out only when the leg count or queasy changes, the
   * worm sprites and the cheek tint are made once per trip, and the queasy flag is a field on the
   * drawnAxolotl input. The eat runs only in an area with plastic worms and while not queasy; there
   * eatPlasticWorms (trip.ts) returns one small result object per frame, the same bounded class as
   * stepTrip below. The canal and a queasy frame call nothing.
   * Snack dart (#98): only in an area with a dart rule (Area 3); the canal and Area 2 call nothing.
   * stepSnackDarts allocates nothing when no darter darts and no hop glides, which is every frame
   * once its few darters have hopped. While a hop glides it builds a new items array, one object per
   * moved snack and a new dart state, and setItems works the tally out again: bounded by the
   * darter count and only for the hop's third of a second. The avoid object is built again only
   * when the plastic worms move.
   * Ghost nets (#76): swimTuning is worked out again only when the leg count, queasy or snagged
   * changes, and the snagged flag is a field on the drawnAxolotl input; isSnagged reads one number
   * and allocates nothing. The net sprites and the snag cue are made once per trip, and only in an
   * area with ghost nets; there GhostNetView.render allocates nothing. The canal and the pond call
   * no view here.
   * Heron and fireflies (#98): made once per trip, and only in an area with a heron or a look with
   * fireflies; the canal and Area 2 call nothing. FireflyView.render allocates nothing. HeronView
   * reuses its sprites and takes the axolotl's swim state as its position, so it allocates only its
   * render argument object, the bounded cover check (inSightCover) and, during a full-motion stab,
   * one stab tip (stabTip) per heron per frame: the same bounded class as the residual below.
   * Garter snake and water hyacinth mats (#103): made once per trip, and only in an area with a
   * garter snake or with mat elements; Areas 1 to 4 build neither view and call nothing new, and
   * their snack dart avoid object is unchanged (no `mats` field). GarterSnakeView reuses its sprites
   * and allocates only its render argument object. The mat sweeps and the mats' avoid object are
   * worked out once per trip. Where there are mats, each swimming frame blockExplorer builds the
   * grown mats (two per pair) and its result point, and a blocked step builds one new swim state;
   * HyacinthMatView takes a render argument object and builds matRects' result for each pair: the
   * same bounded class as the residual below, bounded by the area's mat pair count.
   * Danger parts and mobile snacks (#117): Areas 1 to 5 build and call nothing new, for the danger
   * parts and for snacks alike. CarpView, MovingHazardView and MobileSnackView are made once per
   * trip, and only in an area with a carp route, with moving hazards or with mobile snacks. The
   * one-time darts come from oneTimeDarts, which gives today's darters in an area with no shrimp.
   * The Snack magnet's pull is worked out once per trip (snackMagnetSpeed), and is exactly the
   * perk's pull with no mobile snacks. The shrimp flick state, the meet count and the tadpole
   * `keepClear` boxes exist only in an area with shrimp or tadpoles. There, stepShrimpFlicks
   * allocates nothing when no flick starts and none glides, except that a ready shrimp whose flick
   * landing is blocked reruns its landing check and builds two small objects each frame (known gap,
   * issue #131, ND-12); while one glides it builds a new items
   * array, one object per moved shrimp and a new flick state, and setItems works the tally out
   * again: bounded by the shrimp count. Its avoid object is built again only when the plastic worms
   * move. metSnackTypeIds runs only while some snack type in the area is unmet, and returns a shared
   * empty list when none is met. MobileSnackView reuses one pose and one scene object and allocates
   * only the head point (headPoint) per frame. CarpView reuses its sprites and allocates only its
   * render argument object; MovingHazardView allocates its render argument object and
   * movingHazardPhase's result per spawn. GhostNetView takes the element time and allocates nothing.
   * Spring cave (#77): Areas 1 to 5 build and call nothing new, and their stranding chance is
   * unchanged (areaStrandingChance gives STRANDING_CHANCE). CrayfishView, DarkCaveView and
   * GlowPlantView are made once per trip, and only in an area with a crayfish, dark water or
   * glow-plants. CrayfishView reuses its sprites and allocates only its render argument object;
   * GlowPlantView allocates only its render argument object. In an area with dark water, each frame
   * DarkCaveView builds darkLights' result and its light argument object once, the dark layer and the
   * treasure and snack star dark rule share that one list, and the layer is redrawn only when a light
   * moved, grew or appeared while the camera view meets the dark water. The glow-plant motion object is worked out
   * again only when reduced motion changes.
   * Spring cave Area 7 (#105): Areas 1 to 6 build and call nothing new. PulsingCurrentView and
   * PebbleRoomView are made once per trip, and only in an area with pulsing vents, rock walls or a
   * pebble. Where there are vents, addPulseCurrent adds to the steady current's own result and
   * allocates nothing, and PulsingCurrentView reuses its sprites and allocates only its render
   * argument object. Where there is rock or a pebble, each swimming frame stepPebbles builds its step
   * result and the body's point, a roll builds one new pebble state, blockAtRock builds a point only
   * when a wall is in the way, and PebbleRoomView allocates its render argument object and each
   * pebble's centre point: the same bounded class as the residual below. The pulsing current motion
   * object is worked out again only when reduced motion changes.
   * Recorded residual, inherited from main: stepSwim and stepTrip return new immutable state and
   * event lists each frame, syncSnapshot builds a trip snapshot to compare, the views take a render
   * argument object, and the reeds-near Set, bubble views and surface x list are rebuilt each frame.
   * Impact is bounded: a fixed number of small, short-lived objects per frame that does not grow
   * with play time, and not seen to cause stutter. Pooling or mutating them in place was considered
   * and rejected: the src/logic step functions are immutable by design (trip.ts, encounter.ts,
   * tilapia.ts) and tested that way (ADR 0006), so the change would cut across shared modules for a
   * cost nobody has measured. If profiling shows GC pauses, file an issue with this scope.
   */
  update(_time: number, deltaMs: number): void {
    const dt = Math.min(Math.max(deltaMs / 1000, 0), SWIM.dtMax);
    this.clock += dt;
    this.releaseDashLatch();
    if (this.trip.phase === 'swimming') {
      this.stepPlay(dt);
    }
    this.advanceTrip(dt);
    this.tripSounds.handleFrame(this.trip, this.cameras.main.worldView);
    // INVARIANT: the trip step runs before the eat, so the eat reads the transform drawn this frame.
    this.captureDrawnFrame();
    // INVARIANT: a trip that left swimming in its step eats nothing.
    if (this.trip.phase === 'swimming') {
      const head = headPoint(this.body);
      // INVARIANT: the dart and the shrimp flick run before the Snack magnet and the eat, so a darter
      // hops and a shrimp flicks before either reads it.
      this.dartSnacks(head, dt);
      this.flickShrimp(head, dt);
      this.pullSnacks(head, dt);
      // INVARIANT: the meet runs before the eat, so a snack type eaten on the frame it comes in range is met.
      this.meetMobileSnacks();
      this.collectSnacks(head);
      this.eatPlasticWormsAtHead();
    }
    // INVARIANT: the exit check runs after the eat, so eating the last snack at the exit beats it this frame.
    this.checkExit();
    this.followPoint.set(this.swim.x, this.swim.y);
    this.renderFrame(dt);
  }

  private stepPlay(dt: number): void {
    const steer = this.computeSteer();
    this.lastSteer = steer;

    const zone = this.zone;
    const pos = { x: this.swim.x, y: this.swim.y };
    this.dashingThisFrame = this.dash.phase === 'dashing';
    const current = currentAt(pos, zone.currents);
    // INVARIANT: the vents surge on the element time the trip reaches this frame, as the mats do.
    if (this.vents.length > 0) addPulseCurrent(current, pos, this.vents, this.trip.elementTime + dt);
    const swum = stepSwim(
      this.swim,
      steer,
      {
        current,
        dragMul: reedDragAt(pos, zone.reedPatches),
        bounds: this.bounds,
        dashing: this.dashingThisFrame,
      },
      dt,
      this.swimTuning(),
    );
    this.swim = this.blockAtRockAndPebbles(pos, this.blockAtMats(pos, swum, dt), dt);
    const previousPhase = this.dash.phase;
    this.dash = updateDash(this.dash, dt, this.perks.swim);
    if (this.dash.phase !== previousPhase || this.dash.phase === 'cooldown') {
      this.emitDashState();
    }
    this.driftClock += dt;
  }

  /**
   * Swim tuning for the legs present, slowed while queasy and while snagged (Tail Dash never is).
   * Worked out again only when the leg count, queasy or snagged changes, so a swimming frame
   * allocates no tuning object.
   */
  private swimTuning(): SwimTuning {
    const legs = this.snapshot.legs.present;
    const queasy = isQueasy(this.trip.plasticWorms);
    const snagged = isSnagged(this.trip.ghostNets);
    if (legs !== this.tunedLegs || queasy !== this.tunedQueasy || snagged !== this.tunedSnagged) {
      this.tunedLegs = legs;
      this.tunedQueasy = queasy;
      this.tunedSnagged = snagged;
      const legTuning = legSwimTuning(legs, this.perks.swim);
      this.tuned = snagSwimTuning(queasySwimTuning(legTuning, this.trip.plasticWorms), this.trip.ghostNets);
    }
    return this.tuned;
  }

  /**
   * Water hyacinth mats (issue #103, PRD ND-6 to ND-9): the swim step from `prev` to `swum` stopped
   * at the mats (blockExplorer), with the velocity zeroed on each axis the mats changed. Called only
   * while swimming, so the carry home and a following stranded axolotl are never blocked. An area
   * with no mats returns `swum` itself and calls nothing.
   *
   * Element time: the mats are placed at `trip.elementTime + dt`, the element time stepTrip reaches
   * in this frame's advanceTrip (it adds the same capped `dt` on a swimming step, and nothing on a
   * 0 step). That is the time renderFrame draws the mats at this frame, so the explorer ends the
   * frame outside the mats as drawn, and a mat closing during the step pushes it out at once.
   */
  private blockAtMats(prev: Vec2, swum: SwimState, dt: number): SwimState {
    const avoid = this.matAvoid;
    if (avoid === null) return swum;
    const blocked = blockExplorer(prev, swum, this.trip.elements, this.trip.elementTime + dt, avoid);
    if (blocked.x === swum.x && blocked.y === swum.y) return swum;
    return {
      ...swum,
      x: blocked.x,
      y: blocked.y,
      vx: blocked.x === swum.x ? swum.vx : 0,
      vy: blocked.y === swum.y ? swum.vy : 0,
    };
  }

  /**
   * Rock walls and pebbles (issue #105, ND-8): the swim step from `prev` to `swum` against the
   * pebbles first, so a push rolls one and the body stays at its edge, then stopped at the rock, with
   * the velocity zeroed on each axis the rock or a pebble changed. Steps the pebble hint clock too.
   * Called only while swimming. An area with neither returns `swum` itself and calls nothing.
   */
  private blockAtRockAndPebbles(prev: Vec2, swum: SwimState, dt: number): SwimState {
    if (this.rockWalls.length === 0 && this.pebbleStates.length === 0) return swum;
    const rolled = stepPebbles(this.pebbleStates, this.trip.elements, prev, swum, dt);
    const moved = rolled.pebbles !== this.pebbleStates;
    this.pebbleStates = rolled.pebbles;
    const near = nearUnrolledPebble(swum, this.pebbleStates, this.trip.elements);
    this.pebbleHintTime = stepPebbleHintClock(this.pebbleHintTime, { dt, near, rolled: moved, paused: false });
    const blocked = blockAtRock(prev, rolled.pos, this.rockWalls);
    if (blocked.x === swum.x && blocked.y === swum.y) return swum;
    return {
      ...swum,
      x: blocked.x,
      y: blocked.y,
      vx: blocked.x === swum.x ? swum.vx : 0,
      vy: blocked.y === swum.y ? swum.vy : 0,
    };
  }

  // ---- setup ---------------------------------------------------------------

  /**
   * Works out the trip's mat sweeps and the mats' avoid object (the swim bounds, the trip's ghost
   * nets and the currents) once per trip; both stay null in an area with no mat elements.
   */
  private setUpMats(): void {
    const sweeps = this.trip.elements.flatMap((element) => elementSweep(element) ?? []);
    if (sweeps.length === 0) return;
    this.matSweeps = sweeps;
    this.matAvoid = { bounds: this.bounds, nets: this.trip.ghostNets.nets, currents: this.zone.currents };
  }

  /**
   * Works out the trip's mobile snack parts once per trip (ND-24 to ND-29): the Snack magnet's pull,
   * and, only in an area with mobile snacks, the tadpole leg and shrimp hop leg boxes a spat plastic
   * worm keeps clear of (issue #131, ND-7), the shrimp flick state and the snack types to meet. An area with no mobile snacks gets
   * exactly the perk's pull and nothing else.
   */
  private setUpMobileSnacks(): void {
    const zone = this.zone;
    this.magnetSpeed = snackMagnetSpeed(this.perks.snackMagnetSpeed, zone);
    const mix = zone.mobileSnacks;
    if (!mix) return;
    const legBoxes = mobileLegBoxes(zone);
    if (legBoxes.length > 0) this.spitAvoid = { ...this.spitAvoid, keepClear: legBoxes };
    if (mix.shrimp && mix.homes.length > 0) this.shrimpFlicks = createShrimpFlicks(zone.collectibles, mix.shrimp);
    this.snackTypesToMeet = countMobileSnackTypes(zone.collectibles);
  }

  private buildWorld(): void {
    const { zone, scenery } = this;
    const baked = this.assets.baked;
    scenery.bg.forEach((row, r) => this.placeBackgroundRow(row, r));
    this.reeds = zone.reeds.map((reed, i) =>
      placeBaked(this.add.image(reed.bx, reed.by, scenery.reeds[i].key), scenery.reeds[i]).setDepth(DEPTH.reeds),
    );
    this.reedNudge = zone.reeds.map(() => 0);

    const haze = cssColor(this.look.haze);
    this.add
      .rectangle(0, SURF, zone.width, zone.height - SURF, haze.color, haze.alpha)
      .setOrigin(0, 0)
      .setDepth(DEPTH.haze);
    this.streaks = zone.currents.flatMap((current) => this.buildStreaks(current));

    this.homeSpotView = new HomeSpotView(this, this.assets, this.trip.homeSpot, zone.bedTop);
    this.exitView = new ExitView(
      this,
      this.assets,
      exitGateBase(this.area.exit, zone),
      exitOpen(this.snackTally.left),
      exitArrowSide(this.area.exit, zone.width),
    );
    this.treasureView = new TreasureView(
      this,
      this.assets,
      zone,
      this.look,
      this.trip.placed,
      this.perks.hintMultiplier,
      this.darkShows(),
    );
    this.plasticWormView = new PlasticWormView(this, this.assets, this.trip.plasticWorms.worms);
    const nets = this.trip.ghostNets.nets;
    this.ghostNetView = nets.length > 0 ? new GhostNetView(this, this.assets, nets, this.axolotlSize()) : null;

    this.snacks.clear();
    for (const item of this.items) {
      if (item.collected) continue;
      const info = this.snackTexture(item.kind);
      this.snacks.set(
        item.id,
        placeBaked(this.add.image(item.x, item.y, info.key), info).setDepth(DEPTH.collectibles),
      );
    }
    const starInfo = this.snackStarInfo();
    this.snackStarBaseScale = 1 / starInfo.scale;
    this.snackStars = Array.from({ length: SPARKLE_SNACKS_LEFT }, () =>
      placeBaked(this.add.image(0, 0, starInfo.key), starInfo).setVisible(false).setDepth(DEPTH.hint),
    );

    this.axolotlView = createAxolotlRigView(this, this.assets.axolotl);
    this.axolotl = this.axolotlView.root.setPosition(this.swim.x, this.swim.y).setDepth(DEPTH.axolotl);
    this.queasyCheeks = this.buildQueasyCheeks();
    this.strandedView = new StrandedView(this, this.assets);
    this.predatorView = new PredatorView(
      this,
      this.assets,
      this.trip.encounter.predators.map((predator) => predator.species),
    );
    const predators = this.trip.encounter.predators;
    this.heronView = predators.some((predator) => predator.species === HERON_SPECIES.id)
      ? new HeronView(this, this.assets, predators)
      : null;
    this.garterSnakeView = predators.some((predator) => predator.species === GARTER_SNAKE_SPECIES.id)
      ? new GarterSnakeView(this, this.assets, predators)
      : null;
    this.carpView = predators.some((predator) => predator.species === CARP_SPECIES.id)
      ? new CarpView(this, this.assets, predators)
      : null;
    this.crayfishView = predators.some((predator) => predator.species === CRAYFISH_SPECIES.id)
      ? new CrayfishView(this, this.assets, predators)
      : null;
    const movingHazards = this.trip.encounter.movingHazards ?? [];
    this.movingHazardView = movingHazards.length > 0 ? new MovingHazardView(this, this.assets, movingHazards) : null;
    this.mobileSnackView = hasMobileSnacks(zone) ? new MobileSnackView(this.mobileSnackTextures()) : null;
    this.hyacinthMatView = this.matSweeps !== null ? new HyacinthMatView(this, this.assets, this.trip.elements) : null;
    this.fireflyView = this.look.firefliesPerScreen > 0 ? new FireflyView(this, this.assets, this.look, zone) : null;
    const dark = this.trip.darkWater;
    this.darkCaveView = dark !== null ? new DarkCaveView(this, this.assets, dark, this.trip.elements) : null;
    this.glowPlantView =
      glowPlants(this.trip.elements).length > 0 ? new GlowPlantView(this, this.assets, this.trip.elements) : null;
    this.pulsingCurrentView = this.vents.length > 0 ? new PulsingCurrentView(this, this.assets, this.vents) : null;
    this.pebbleRoomView =
      this.rockWalls.length > 0 || this.pebbleStates.length > 0
        ? new PebbleRoomView(this, this.assets, this.rockWalls, this.trip.elements)
        : null;

    this.bubbleImages = Array.from({ length: BUBBLE_MAX_ALIVE }, () =>
      this.add.image(0, 0, baked.bubbles[0].key).setVisible(false).setDepth(DEPTH.bubbles),
    );
    this.surface = this.add.graphics().setDepth(DEPTH.surface);
    this.surfaceFill = cssColor(this.look.surfaceFill);
    this.surfaceLine = cssColor(this.look.surfaceLine);
    this.surfaceLineWidth = this.look.surfaceLineWidth;
    this.pads = zone.pads.map((pad, i) =>
      placeBaked(this.add.image(pad.x, SURF, scenery.pads[i].key), scenery.pads[i]).setDepth(DEPTH.pads),
    );
    this.sparkles = Array.from({ length: SPARKLE_POOL }, () => ({
      image: placeBaked(this.add.image(0, 0, baked.sparkle.key), baked.sparkle)
        .setVisible(false)
        .setDepth(DEPTH.fx),
      age: SPARKLE_LIFE_S,
    }));
  }

  /**
   * Whether a part shows through the trip's dark water this frame (shownInDark with this frame's
   * lights, `darkLightsNow`), for the treasures; undefined in an area with no dark water, where
   * everything shows.
   */
  private darkShows(): DarkShows | undefined {
    const dark = this.trip.darkWater;
    if (dark === null) return undefined;
    return (part, at) => shownInDark(part, at, dark, this.darkLightsNow);
  }

  /**
   * The queasy cheek tint, hidden until queasy, in an area with plastic worms; null in any other
   * area. Its texture is in axolotl local units, so it scales with the explorer's size, not the rig.
   */
  private buildQueasyCheeks(): Phaser.GameObjects.Image | null {
    if (this.trip.plasticWorms.worms.length === 0) return null;
    const pond = this.assets.pond;
    if (pond === null) {
      throw new Error('SwimScene: plastic worms need the baked pond textures for the queasy cheek tint');
    }
    const info = pond.queasyCheeks;
    this.queasyCheeksBaseScale = (AXO_SCENE_SCALE * this.axolotlSize()) / info.scale;
    return placeBaked(this.add.image(this.swim.x, this.swim.y, info.key), info)
      .setVisible(false)
      .setDepth(DEPTH.queasyTint);
  }

  /** Background chunk row `row` (row 0 on top), each chunk at its column and row in the area. */
  private placeBackgroundRow(chunks: readonly TexInfo[], row: number): void {
    chunks.forEach((info, column) => {
      this.add
        .image(column * info.w, row * info.h, info.key)
        .setOrigin(0, 0)
        .setScale(1 / info.scale)
        .setDepth(DEPTH.bg);
    });
  }

  /**
   * The baked texture a snack sprite starts with: the worm or the bug, a tadpole's tail frame 0 or a
   * shrimp's rest frame. Throws when a tadpole or a shrimp has no baked mobile snack texture.
   */
  private snackTexture(kind: CollectibleKind): TexInfo {
    if (kind === 'worm') return this.assets.baked.worm;
    if (kind === 'bug') return this.assets.baked.bug;
    const textures = this.mobileSnackTextures();
    if (kind === 'shrimp') return textures.shrimp.rest;
    const info: TexInfo | undefined = textures.tadpole[0];
    if (!info) {
      throw new Error('SwimScene: no tadpole tail frame 0 in the baked mobile snack textures');
    }
    return info;
  }

  /** GameAssets.mobileSnacks; throws when they were not baked, which an area with mobile snacks needs. */
  private mobileSnackTextures(): MobileSnackTextures {
    const textures = this.assets.mobileSnacks;
    if (textures === null) {
      throw new Error('SwimScene: tadpoles and shrimp need the baked mobile snack textures');
    }
    return textures;
  }

  /** The Common hint star, the one the last snacks share (PRD H3). */
  private snackStarInfo(): TexInfo {
    const info: TexInfo | undefined = this.assets.baked.hiding.hintStars[hintSparkleRadius('common')];
    if (!info) {
      throw new Error('SwimScene: no Common hint star for the last snacks');
    }
    return info;
  }

  private buildStreaks(current: CurrentZone): Streak[] {
    const info = this.assets.baked.streak;
    const angle = Math.atan2(current.force.y, current.force.x);
    return Array.from({ length: STREAKS_PER_CURRENT }, (): Streak => {
      const x = current.x0 + this.rand() * (current.x1 - current.x0);
      const y = current.y0 + this.rand() * (current.y1 - current.y0);
      const image = placeBaked(this.add.image(x, y, info.key), info).setRotation(angle).setDepth(DEPTH.haze);
      return { image, zone: current, x, y };
    });
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    fitWorldCamera(camera, this.view.fit, this.zone.width, this.zone.height);
    this.followPoint.set(this.swim.x, this.swim.y);
    camera.startFollow(this.followPoint, false, this.motion.cameraLerp, this.motion.cameraLerp);
    camera.centerOn(this.swim.x, this.swim.y);
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const codes = Phaser.Input.Keyboard.KeyCodes;
    const keysFor = (...keyCodes: number[]): Phaser.Input.Keyboard.Key[] =>
      keyCodes.map((code) => keyboard.addKey(code));
    this.keys = {
      left: keysFor(codes.LEFT, codes.A),
      right: keysFor(codes.RIGHT, codes.D),
      up: keysFor(codes.UP, codes.W),
      down: keysFor(codes.DOWN, codes.S),
    };
    this.dashKeys = [keyboard.addKey(codes.SPACE, false), keyboard.addKey(codes.SHIFT, false)];
    keyboard.on('keydown-SPACE', this.handleDashKey, this);
    keyboard.on('keydown-SHIFT', this.handleDashKey, this);
  }

  // ---- input ---------------------------------------------------------------

  private readKeys(): KeyState {
    return {
      left: anyKeyDown(this.keys.left),
      right: anyKeyDown(this.keys.right),
      up: anyKeyDown(this.keys.up),
      down: anyKeyDown(this.keys.down),
    };
  }

  private computeSteer(): Vec2 {
    const keySteer = steerFromKeys(this.readKeys());
    return len(keySteer) > 0 ? keySteer : this.padSteer;
  }

  private handleSteer(payload: SteerPayload): void {
    this.padSteer = { x: payload.x, y: payload.y };
  }

  private handleDashKey(event: KeyboardEvent): void {
    if (event.repeat || this.dashKeyLatched) return;
    this.requestDash();
  }

  /** A dash key held from the Home Tank or from confirming a HUD card must be released before it dashes. */
  private releaseDashLatch(): void {
    if (this.dashKeyLatched && !anyKeyDown(this.dashKeys)) {
      this.dashKeyLatched = false;
    }
  }

  private handleRequestDash(): void {
    if (!this.sys.isActive()) return;
    this.requestDash();
  }

  private requestDash(): void {
    if (this.trip.phase !== 'swimming') return;
    const attempt = tryStartDash(this.dash, this.perks.swim);
    if (!attempt.started) return;
    this.dash = attempt.state;
    const velocity = { x: this.swim.vx, y: this.swim.vy };
    const direction = len(this.lastSteer) > 0 ? this.lastSteer : velocity;
    this.swim = startDashVelocity(this.swim, direction, this.perks.swim);
    this.emitDashState();
  }

  private emitDashState(): void {
    const payload: DashStatePayload = { phase: this.dash.phase, charge: dashCharge(this.dash, this.perks.swim) };
    this.game.events.emit(GAME_EVENTS.DASH_STATE, payload);
  }

  // ---- game events ---------------------------------------------------------

  /**
   * The only writer of `items` and its tally: works the tally out once per items change, so frame
   * code reads it instead. Stars of snacks that stopped sparkling lose their age here.
   */
  private setItems(items: Collectible[]): void {
    this.items = items;
    this.snackTally = snackTally(items);
    for (const id of this.snackStarAges.keys()) {
      if (!this.snackTally.sparklingIds.includes(id)) this.snackStarAges.delete(id);
    }
  }

  /**
   * Snack dart (PRD H4, N2): a darter near `head` hops a little away, before the Snack magnet and
   * the eat. Only in an area with a dart rule; the canal and Area 2 call nothing here. Reads reduced
   * motion every frame, and allocates nothing when no snack darts or glides.
   */
  private dartSnacks(head: Vec2, dt: number): void {
    if (this.snackDarts === null) return;
    const step = stepSnackDarts(
      this.items,
      head,
      this.snackView,
      this.snackDarts,
      !this.motion.ambient,
      this.dartAvoid(),
      dt,
    );
    if (!step) return;
    this.snackDarts = step.state;
    this.setItems(step.items);
  }

  /**
   * Where a darted snack must not land, built again only when the plastic worm positions change. In
   * an area with mats it also keeps darted snacks out of each mat pair's whole sweep; elsewhere it
   * has no `mats` field.
   */
  private dartAvoid(): SnackDartAvoid {
    const worms = this.trip.plasticWorms.worms;
    if (this.snackDartAvoid === null || this.snackDartAvoid.worms !== worms) {
      const zone = this.zone;
      const avoid: SnackDartAvoid = {
        bounds: this.bounds,
        homeSpot: zone.homeSpot,
        safeArea: zone.safeArea,
        currents: zone.currents,
        worms,
      };
      if (this.matSweeps !== null) avoid.mats = this.matSweeps;
      this.snackDartAvoid = avoid;
    }
    return this.snackDartAvoid;
  }

  /**
   * Shrimp flick (PRD H4, ND-25): a ready shrimp near `head` flicks away, after the one-time darts
   * and before the Snack magnet and the eat. Only in an area with shrimp; every other area calls
   * nothing here. Allocates nothing when no flick starts or glides.
   */
  private flickShrimp(head: Vec2, dt: number): void {
    if (this.shrimpFlicks === null) return;
    const step = stepShrimpFlicks(
      this.items,
      head,
      this.snackView,
      this.shrimpFlicks,
      !this.motion.ambient,
      this.flickAvoid(),
      dt,
    );
    if (!step) return;
    this.tripSounds.handleShrimpFlicks(step.flickStarts);
    this.shrimpFlicks = step.state;
    this.setItems(step.items);
  }

  /** Where a flicking shrimp must not land (mobileSnackAvoid), built again only when the plastic worm positions change. */
  private flickAvoid(): MobileSnackAvoid {
    const worms = this.trip.plasticWorms.worms;
    if (this.shrimpAvoid === null || this.shrimpAvoid.worms !== worms) {
      this.shrimpAvoid = mobileSnackAvoid(this.zone, worms);
    }
    return this.shrimpAvoid;
  }

  /**
   * Meets the area's snack types (PRD A21, ND-29): a tadpole or shrimp type met for the first time
   * this trip comes due as a fact card. Calls nothing once every type is met, or in an area with no
   * mobile snacks.
   */
  private meetMobileSnacks(): void {
    if (this.snackTypesToMeet === 0) return;
    const ids = metSnackTypeIds(this.items, this.swim, this.zone.safeArea, this.trip.met, this.snackView);
    if (ids.length === 0) return;
    this.trip = meetSnacks(this.trip, ids);
    this.snackTypesToMeet = Math.max(0, this.snackTypesToMeet - ids.length);
    this.syncSnapshot();
  }

  /** Snack magnet (PRD A19, ND-28): pulls the snacks in the perk radius toward `head` at the trip's pull, before the eat. */
  private pullSnacks(head: Vec2, dt: number): void {
    const pulled = pullSnacksToward(
      this.items,
      head,
      this.perks.snackMagnetRadius,
      this.magnetSpeed,
      dt,
      this.snackView,
    );
    if (pulled) this.setItems(pulled);
  }

  private collectSnacks(head: Vec2): void {
    const before = this.snackTally.collected;
    const result = collectSnacksAtHead(this.items, head, this.snackView);
    if (!result) return;
    this.setItems(result.items);
    const total = this.items.length;
    this.registry.set(REGISTRY_KEYS.collected, this.snackTally.collected);
    result.newly.forEach((item, i) => {
      this.popSnack(item.id);
      const payload: CollectedPayload = { id: item.id, collected: before + i + 1, total, kind: item.kind };
      this.game.events.emit(GAME_EVENTS.COLLECTED, payload);
    });
    if (!this.allDone && this.snackTally.left === 0) {
      this.allDone = true;
      const payload: AllCollectedPayload = { total };
      this.game.events.emit(GAME_EVENTS.ALL_COLLECTED, payload);
    }
    this.applySnackSpeedUp(result.newly.length);
  }

  private popSnack(id: string): void {
    const sprite = this.snacks.get(id);
    if (!sprite) {
      throw new Error(`SwimScene: no sprite for collectible "${id}"`);
    }
    this.snacks.delete(id);
    if (!this.motion.ambient) {
      sprite.destroy();
      return;
    }
    addMotionTween(this, {
      targets: sprite,
      props: { scaleX: sprite.scaleX * 1.4, scaleY: sprite.scaleY * 1.4, alpha: 0 },
      duration: SNACK_POP_MS,
      ease: 'Sine.easeOut',
      onComplete: () => sprite.destroy(),
    });
  }

  /**
   * Speeds up the regrowing leg by the snacks just eaten (PRD A19). Regrowth events take the
   * timed-regrowth path, the HUD gets the new legs before the speed-up event, and nothing happens
   * when no leg is missing.
   */
  private applySnackSpeedUp(eaten: number): void {
    const result = eatSnacks(this.trip, eaten, this.tripCtx);
    if (result.boosted.length === 0) return;
    this.trip = result.state;
    this.dispatchTripEvents(result.events);
    this.predatorView.startSnackBoost(result.boosted);
    this.syncSnapshot();
    const payload: SnackBoostPayload = { legs: [...result.boosted] };
    this.game.events.emit(GAME_EVENTS.SNACK_BOOST, payload);
  }

  /**
   * Steps the trip. Swimming: a bump sets the swim velocity, and a Tail Dash active this step can
   * break Dash pots. Banked, carrying or ended: the trip places the axolotl, still. The carry
   * advances only with this frame `dt`, so pause freezes it.
   */
  private advanceTrip(dt: number): void {
    const input: TripInput = {
      axolotlPos: { x: this.swim.x, y: this.swim.y },
      reduced: !this.motion.ambient,
      dashing: this.trip.phase === 'swimming' && this.dashingThisFrame,
    };
    const result = stepTrip(this.trip, input, dt, this.tripCtx);
    this.trip = result.state;
    if (this.trip.phase === 'swimming') {
      if (result.impulse) {
        this.swim = { ...this.swim, vx: result.impulse.x, vy: result.impulse.y };
      }
    } else {
      this.placeCarried();
    }
    this.dispatchTripEvents(result.events);
    const tipInput = {
      trip: this.trip,
      events: result.events,
      pos: input.axolotlPos,
      dt,
      held: this.dashPotTipHeld,
      ctx: this.tripCtx.encounter,
    };
    this.applyDashPotTip(stepDashPotTip(this.dashPotTip, tipInput));
    this.syncSnapshot();
  }

  /**
   * Takes a Dash pot tip step (PRD B11): saves the tip as seen the first time it is on screen or a
   * pot breaks first, and tells the HUD to show or hide it. A show starts unheld; the HUD's placing,
   * during the emit, reports a hold at once.
   */
  private applyDashPotTip(step: DashPotTipStep): void {
    const wasSeen = dashPotTipSeen(this.dashPotTip);
    this.dashPotTip = step.state;
    if (!wasSeen && dashPotTipSeen(step.state)) {
      writeSession(this.registry, markDashPotTipSeen(readSession(this.registry)));
    }
    if (step.cue === null) return;
    this.dashPotTipHeld = false;
    const payload: DashPotTipPayload = { show: step.cue === 'show' };
    this.game.events.emit(GAME_EVENTS.DASH_POT_TIP, payload);
  }

  /** The HUD placed the Dash pot tip, or held it for want of room. */
  private handleDashPotTipHeld(payload: DashPotTipHeldPayload): void {
    this.dashPotTipHeld = payload.held;
  }

  /** The player closed the Dash pot tip in the HUD: it never shows again. */
  private handleDashPotTipClosed(): void {
    this.applyDashPotTip(closeDashPotTip(this.dashPotTip));
  }

  /**
   * Exit contact while swimming (PRD H2, H5): swimming into the closed exit sends EXIT_CLOSED once
   * per entry, and the open exit ends the trip. A trip that banked or started the carry this step
   * is not swimming, so the carry wins over the exit.
   */
  private checkExit(): void {
    if (this.trip.phase !== 'swimming') return;
    const left = this.snackTally.left;
    const atExitNow = atExit(this.swim, this.area.exit);
    const contact = exitContact(this.wasAtExit, atExitNow, left);
    this.wasAtExit = atExitNow;
    if (contact === 'closed') {
      const payload: ExitClosedPayload = { left };
      this.game.events.emit(GAME_EVENTS.EXIT_CLOSED, payload);
    }
    if (contact === 'beat') this.endAtExit();
  }

  /**
   * Ends the trip at the open exit, once per trip: banks the Trip Bag and leaves for the Home Tank
   * the same way Go home does.
   */
  private endAtExit(): void {
    if (this.areaBeaten) return;
    const result = beatArea(this.trip, { specialTreasureId: this.area.specialTreasureId });
    if (result.state === this.trip) return;
    this.areaBeaten = true;
    this.trip = result.state;
    this.padSteer = { x: 0, y: 0 };
    this.placeCarried();
    this.dispatchTripEvents(result.events);
    this.publishSnapshot(tripSnapshot(this.trip));
  }

  /**
   * Eats a plastic worm in reach of the head and spits it out (issue #75). Skipped with no worms or
   * while queasy, where the eat changes nothing, so the canal and a queasy frame call nothing here.
   */
  private eatPlasticWormsAtHead(): void {
    const worms = this.trip.plasticWorms;
    if (worms.worms.length === 0 || isQueasy(worms)) return;
    const result = eatPlasticWorms(this.trip, this.body, this.spitAvoid);
    if (result.state === this.trip) return;
    this.trip = result.state;
    this.dispatchTripEvents(result.events);
  }

  private dispatchTripEvents(events: readonly TripEvent[]): void {
    this.handleTripEvents(events);
    this.predatorView.handleEvents(events);
    this.homeSpotView.handleEvents(events);
    this.treasureView.handleEvents(events);
    this.plasticWormView.handleEvents(events);
    this.tripSounds.handleEvents(events);
  }

  /** Puts the axolotl where the trip holds it while banked, carried or ended, with no velocity. */
  private placeCarried(): void {
    const pos = tripAxolotlPos(this.trip);
    if (!pos) {
      throw new Error(`SwimScene: no axolotl position for trip phase "${this.trip.phase}"`);
    }
    this.swim = { ...this.swim, x: pos.x, y: pos.y, vx: 0, vy: 0 };
  }

  /**
   * Clears pad steering when the carry starts; a still (reduced-motion) arrival snaps the camera
   * home; a spat plastic worm and a new ghost net snag tell the HUD.
   */
  private handleTripEvents(events: readonly TripEvent[]): void {
    for (const event of events) {
      if (event.type === 'wormSpat') {
        const payload: PlasticWormSpatPayload = { id: event.id };
        this.game.events.emit(GAME_EVENTS.PLASTIC_WORM_SPAT, payload);
      }
      if (event.type === 'snagged') {
        const payload: GhostNetSnaggedPayload = { id: event.id };
        this.game.events.emit(GAME_EVENTS.GHOST_NET_SNAGGED, payload);
      }
      if (event.type === 'carryStart') {
        this.padSteer = { x: 0, y: 0 };
      }
      if (event.type === 'arrivedHome' && event.still) {
        this.followPoint.set(this.trip.home.x, this.trip.home.y);
        this.cameras.main.centerOn(this.trip.home.x, this.trip.home.y);
      }
    }
  }

  private syncSnapshot(): void {
    const snapshot = tripSnapshot(this.trip);
    if (sameTripSnapshot(snapshot, this.snapshot)) return;
    this.publishSnapshot(snapshot);
  }

  /**
   * Publishes the trip snapshot to the HUD; an ended trip (Go home, the open exit or the end of the
   * carry) leaves for the Home Tank.
   */
  private publishSnapshot(snapshot: TripSnapshot): void {
    this.snapshot = snapshot;
    this.registry.set(TRIP_REGISTRY_KEYS.state, snapshot);
    this.game.events.emit(TRIP_EVENTS.STATE, snapshot);
    if (snapshot.phase === 'ended') this.leaveForHomeTank();
  }

  /** Hands the ended trip and its snacks back to the session and opens the Home Tank, once per trip. */
  private leaveForHomeTank(): void {
    if (this.leaving) return;
    this.leaving = true;
    returnToHomeTank(this, this.assets, this.trip, this.items);
  }

  /**
   * Leaves the banked card and swims on from where the axolotl was held. A dash key held from
   * confirming the card must be released before it dashes. Ignored in any other phase.
   */
  private handleRequestKeepExploring(): void {
    const next = keepExploring(this.trip);
    if (next === this.trip) return;
    this.trip = next;
    this.dashKeyLatched = true;
    this.padSteer = { x: 0, y: 0 };
    this.publishSnapshot(tripSnapshot(this.trip));
  }

  /** Ends the trip by choice (from the banked card, or swimming inside the ring). Ignored when not allowed. */
  private handleRequestGoHome(): void {
    const result = goHome(this.trip);
    if (result.state === this.trip) return;
    this.trip = result.state;
    this.padSteer = { x: 0, y: 0 };
    this.placeCarried();
    this.dispatchTripEvents(result.events);
    this.publishSnapshot(tripSnapshot(this.trip));
  }

  /** The player closed a fact card: it is no longer due this trip. */
  private handleFactCardSeen(payload: FactCardSeenPayload): void {
    this.trip = markFactCardSeen(this.trip, payload.id);
  }

  private handleHidden(): void {
    if (this.trip.phase === 'ended') return;
    this.game.events.emit(GAME_EVENTS.REQUEST_PAUSE);
  }

  private handleResume(): void {
    this.padSteer = { x: 0, y: 0 };
  }

  private handleReducedMotion(payload: ReducedMotionPayload): void {
    this.motion = motionProfile(payload.reduced);
    this.glowPlantMotion = glowMotion(payload.reduced);
    this.pulseMotionNow = pulseMotion(payload.reduced);
    this.cameras.main.setLerp(this.motion.cameraLerp, this.motion.cameraLerp);
    if (!this.motion.turnTween) {
      this.tweens.killTweensOf(this.turn);
      this.turn.squash = 1;
    }
    if (!this.motion.ambient) {
      this.streaks.forEach((streak) => streak.image.setAlpha(1));
      settleMotionTweens(this);
    }
  }

  private handleResize(): void {
    this.view = readSceneView(this.scale);
    const camera = this.cameras.main;
    camera.setSize(this.scale.width, this.scale.height);
    fitWorldCamera(camera, this.view.fit, this.zone.width, this.zone.height);
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.off(GAME_EVENTS.REQUEST_DASH, this.handleRequestDash, this);
    this.game.events.off(GAME_EVENTS.STEER, this.handleSteer, this);
    this.game.events.off(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleHidden, this);
    this.game.events.off(TRIP_EVENTS.REQUEST_KEEP_EXPLORING, this.handleRequestKeepExploring, this);
    this.game.events.off(TRIP_EVENTS.REQUEST_GO_HOME, this.handleRequestGoHome, this);
    this.game.events.off(HUD_EVENTS.FACT_CARD_SEEN, this.handleFactCardSeen, this);
    this.game.events.off(HUD_EVENTS.DASH_POT_TIP_CLOSED, this.handleDashPotTipClosed, this);
    this.game.events.off(HUD_EVENTS.DASH_POT_TIP_HELD, this.handleDashPotTipHeld, this);
    this.events.off(Phaser.Scenes.Events.RESUME, this.handleResume, this);
    this.tripSounds.destroy();
    this.strandedView.destroy();
    this.heronView?.destroy();
    this.garterSnakeView?.destroy();
    this.carpView?.destroy();
    this.movingHazardView?.destroy();
    this.crayfishView?.destroy();
    this.darkCaveView?.destroy();
    this.glowPlantView?.destroy();
    this.pulsingCurrentView?.destroy();
    this.pebbleRoomView?.destroy();
    this.hyacinthMatView?.destroy();
    this.axolotlView.destroy();
  }

  // ---- rendering -----------------------------------------------------------

  private renderFrame(dt: number): void {
    const t = this.motion.ambient ? this.clock : T_STATIC;
    // INVARIANT: the dark lights are worked out before any view that reads them (treasures, snack stars).
    this.updateDarkLights();
    this.renderAxolotl(dt);
    this.strandedView.render({ trip: this.trip, motion: this.motion, dt, time: this.clock });
    this.homeSpotView.render({ motion: this.motion, dt, time: this.clock });
    this.exitView.render(exitOpen(this.snackTally.left), this.motion, dt);
    this.treasureView.render({
      placed: this.trip.placed,
      holdings: this.trip.holdings,
      axolotl: { x: this.swim.x, y: this.swim.y },
      motion: this.motion,
      dt,
      time: this.clock,
    });
    this.predatorView.render({
      encounter: this.trip.encounter,
      axolotl: this.axolotl,
      motion: this.motion,
      dt,
      phase: this.trip.phase,
    });
    this.heronView?.render({ encounter: this.trip.encounter, axolotl: this.swim, motion: this.motion, dt });
    this.garterSnakeView?.render({ encounter: this.trip.encounter, axolotl: this.swim, motion: this.motion, dt });
    this.carpView?.render({ encounter: this.trip.encounter, motion: this.motion, dt, axolotl: this.swim });
    this.movingHazardView?.render({ encounter: this.trip.encounter, motion: this.motion });
    this.crayfishView?.render({ encounter: this.trip.encounter, motion: this.motion, dt, axolotl: this.swim });
    this.renderDarkCave();
    this.hyacinthMatView?.render({ elementTime: this.trip.elementTime, motion: this.motion, time: this.clock });
    this.pulsingCurrentView?.render({ elementTime: this.trip.elementTime, motion: this.pulseMotionNow });
    this.pebbleRoomView?.render({ pebbles: this.pebbleStates, hint: this.trip.phase === 'swimming' && pebbleHintShown(this.pebbleHintTime) });
    this.fireflyView?.render(this.motion, this.clock);
    this.renderReeds(dt, t);
    this.renderSnacks();
    this.renderMobileSnacks();
    this.renderSnackStars(dt, t);
    this.renderStreaks(dt);
    this.renderBubbles(dt);
    this.renderSparkles(dt);
    this.renderSurface(t);
    this.renderPads(t);
  }

  /**
   * This frame's lights through the dark water (issue #77, ND-7): the axolotl's own glow round its
   * body centre, the exit's faint glow and one light per glow-plant lit this trip. Only in an area
   * with dark water; every other area calls nothing here.
   */
  private updateDarkLights(): void {
    if (this.darkCaveView === null) return;
    // One list for the dark layer and the dark rule, so a hint star shows only where the drawn light reaches.
    this.darkLightsNow = this.darkCaveView.lights({
      axolotl: this.swim,
      exit: this.area.exit,
      lit: this.trip.litGlowPlants,
      motion: this.glowPlantMotion,
      time: this.clock,
    });
  }

  /**
   * The dark layer and the glow-plants (issue #77, ND-7, ND-8 and ND-18): the plants lit this trip,
   * the hinted plant only while swimming (the trip snapshot's hint) and the camera view the dark
   * layer is redrawn for. Only in an area with dark water or glow-plants.
   */
  private renderDarkCave(): void {
    const lit = this.trip.litGlowPlants;
    this.darkCaveView?.render(this.darkLightsNow, this.cameras.main.worldView);
    this.glowPlantView?.render({
      lit,
      hint: this.snapshot.glowPlantHint,
      motion: this.glowPlantMotion,
      time: this.clock,
    });
  }

  /**
   * Whether a hint star at `at` shows through the dark water this frame: hint stars draw above the
   * dark layer, so the dark rule hides them. Always true in an area with no dark water.
   */
  private hintShowsInDark(at: Readonly<Vec2>): boolean {
    const dark = this.trip.darkWater;
    if (dark === null) return true;
    return shownInDark('hint-sparkle', at, dark, this.darkLightsNow);
  }

  private renderAxolotl(dt: number): void {
    const intensity = swimIntensity(this.swim);
    const dashing = this.isDashing();

    if (this.motion.ambient) {
      const paddle = (IDLE_PADDLE + (1 - IDLE_PADDLE) * intensity) * (dashing ? DASH_PADDLE : 1);
      this.swimPhase = (this.swimPhase + dt * (TAU / 1.2) * paddle) % TAU;
    }
    if (this.motion.gillFlutter) {
      this.gillPhase = (this.gillPhase + dt * (TAU / 0.8)) % TAU;
    }
    this.sparkleLevel =
      dashing && this.motion.dashTrail ? 1 : Math.max(0, this.sparkleLevel - dt / SPARKLE_FADE_S);

    const pose: AxolotlPose = {
      swimPhase: this.swimPhase,
      gillPhase: this.gillPhase,
      blink: this.motion.ambient ? blinkAt(this.clock) : 1,
      tailAmp: dashing ? AXO_MAX_TAIL_AMP : 1 + (this.motion.ambient ? SWIM_TAIL_BOOST * intensity : 0),
      sparkle: this.sparkleLevel,
      legs: this.snapshot.legs.slots,
      sheen: this.motion.ambient ? dreamSheenAt(this.clock) : undefined,
    };
    this.axolotlView.setPose(pose);

    const baseScale = this.assets.axolotl.displayScale(1);
    const body = this.body;
    // Phaser flips about the texture frame centre, but the AXO_TEX anchor (originX) is off-centre,
    // so setFlipX drew a left-facing axolotl ahead of its anchor. A negative x scale mirrors about
    // the anchor, so the head lands where the eat check expects.
    faceSprite(
      this.axolotl.setPosition(body.x, body.y).setRotation(body.rotation),
      body.facing,
      baseScale * body.squash,
      baseScale,
    );
    this.renderQueasyCheeks();
    this.ghostNetView?.render(isSnagged(this.trip.ghostNets), body, this.trip.elementTime);
  }

  /**
   * The cheek tint at the rig root with its rotation, facing and squash, shown while queasy in both
   * motion modes: reduced motion keeps the tint and drops only the wobble (drawnAxolotl).
   */
  private renderQueasyCheeks(): void {
    const cheeks = this.queasyCheeks;
    if (cheeks === null) return;
    if (!isQueasy(this.trip.plasticWorms)) {
      cheeks.setVisible(false);
      return;
    }
    const body = this.body;
    const scale = this.queasyCheeksBaseScale;
    faceSprite(
      cheeks.setVisible(true).setPosition(body.x, body.y).setRotation(body.rotation),
      body.facing,
      scale * body.squash,
      scale,
    );
  }

  /**
   * Captures the drawn axolotl and snacks once per frame, after the trip step. A facing change
   * starts the turn squash here, so the captured squash is the one the sprite shows.
   */
  private captureDrawnFrame(): void {
    if (this.swim.facing !== this.lastFacing) {
      this.lastFacing = this.swim.facing;
      this.startTurnSquash();
    }
    this.body = drawnAxolotl({
      swim: this.swim,
      t: this.motion.ambient ? this.clock : T_STATIC,
      clock: this.clock,
      ambient: this.motion.ambient,
      motionBob: this.motion.bob,
      legsPresent: this.snapshot.legs.present,
      swimming: this.trip.phase === 'swimming',
      queasy: isQueasy(this.trip.plasticWorms),
      snagged: isSnagged(this.trip.ghostNets),
      squash: this.turn.squash,
    });
    this.snackView = this.snackFrame();
  }

  /**
   * Where the snacks are drawn this frame: drift time, bob time and bounds. Read once per frame by
   * captureDrawnFrame, so a reduced-motion toggle applies from the next frame.
   */
  private snackFrame(): SnackFrame {
    return {
      driftT: this.driftClock,
      bobT: this.motion.ambient ? this.clock : T_STATIC,
      bobbing: this.motion.collectBob,
      drift: this.area.snackDrift,
      bounds: this.bounds,
    };
  }

  /** Dashing look and trail, only while swimming: a frozen dash shows nothing once the carry starts. */
  private isDashing(): boolean {
    return this.trip.phase === 'swimming' && this.dash.phase === 'dashing';
  }

  private startTurnSquash(): void {
    if (!this.motion.turnTween) return;
    this.tweens.killTweensOf(this.turn);
    this.turn.squash = TURN_SQUASH;
    addMotionTween(this, { targets: this.turn, props: { squash: 1 }, duration: TURN_MS, ease: 'Sine.easeOut' });
  }

  private renderReeds(dt: number, t: number): void {
    const zone = this.zone;
    const sway = this.motion.reedSway;
    const near = sway ? new Set(reedsNear(this.swim, zone.reeds, REED_TOUCH_RADIUS)) : null;
    zone.reeds.forEach((reed, i) => {
      const push = near?.has(reed.id) ? Math.sign(reed.bx - this.swim.x) || 1 : 0;
      this.reedNudge[i] += (push - this.reedNudge[i]) * Math.min(1, dt * REED_NUDGE_RATE);
      const swayPx = sway ? reed.amp * Math.sin((TAU * t) / REED_PERIOD + reed.phase) : 0;
      const nudgePx = sway ? this.reedNudge[i] * REED_NUDGE_PX : 0;
      this.reeds[i].setRotation((swayPx + nudgePx) / (reed.by - reed.tipY));
    });
  }

  /** Each snack where its drift puts it at the drift time (PRD H4), plus its bob. */
  private renderSnacks(): void {
    const frame = this.snackView;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const sprite = this.snacks.get(item.id);
      if (!sprite) continue;
      sprite.setPosition(drawnSnackX(item, i, frame), drawnSnackY(item, i, frame));
    }
  }

  /**
   * Each tadpole's and shrimp's frame, facing and sway (MobileSnackView), after renderSnacks places
   * them. Only in an area with mobile snacks; every other area calls nothing here.
   */
  private renderMobileSnacks(): void {
    const view = this.mobileSnackView;
    if (view === null) return;
    const scene = this.mobileSnackScene;
    scene.clock = this.clock;
    scene.reduced = !this.motion.ambient;
    scene.head = headPoint(this.body);
    view.render(this.items, this.snacks, this.snackView, scene, this.shrimpFlicks);
  }

  /**
   * The hint star over each of the last snacks (PRD H3), always on while 1 to 3 are left, following
   * its snack. Full motion: it grows in, bobs and spins like a treasure hint star. Reduced motion:
   * still at full size. It hides at once when its snack is eaten, and while its snack is in the dark
   * water out of every light (hintShowsInDark).
   */
  private renderSnackStars(dt: number, t: number): void {
    // Runs every frame. At most SPARKLE_SNACKS_LEFT ids, so plain array lookups and index loops
    // replace a Set and slices: nothing is allocated here between snacks being eaten.
    const sparkling = this.snackTally.sparklingIds;
    let slot = 0;
    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      if (!sparkling.includes(item.id)) continue;
      const star = this.snackStars[slot];
      if (!star) {
        throw new Error(`SwimScene: more sparkling snacks than the ${this.snackStars.length} snack stars`);
      }
      const age = this.snackStarAges.get(item.id);
      const shownAge = age === undefined ? 0 : age + dt;
      this.snackStarAges.set(item.id, shownAge);
      this.placeSnackStar(star, this.snackSprite(item.id), index, shownAge, t);
      slot += 1;
    }
    for (let i = slot; i < this.snackStars.length; i++) this.snackStars[i].setVisible(false);
  }

  private placeSnackStar(
    star: Phaser.GameObjects.Image,
    sprite: Phaser.GameObjects.Image,
    index: number,
    shownAge: number,
    t: number,
  ): void {
    const ambient = this.motion.ambient;
    const grow = Math.min(1, shownAge / SNACK_STAR_GROW_S);
    const growScale = ambient ? SNACK_STAR_GROW_FROM + (1 - SNACK_STAR_GROW_FROM) * grow : 1;
    const wave = (TAU * t) / SNACK_STAR_PERIOD + index;
    star
      .setVisible(this.hintShowsInDark(sprite))
      .setPosition(sprite.x, sprite.y + SNACK_STAR_OFFSET_Y + (ambient ? SNACK_STAR_BOB_PX * Math.sin(wave) : 0))
      .setRotation(ambient ? SNACK_STAR_SPIN_RAD * Math.cos(wave) : 0)
      .setScale(growScale * this.snackStarBaseScale);
  }

  private snackSprite(id: string): Phaser.GameObjects.Image {
    const sprite = this.snacks.get(id);
    if (!sprite) {
      throw new Error(`SwimScene: no sprite for collectible "${id}"`);
    }
    return sprite;
  }

  private renderStreaks(dt: number): void {
    for (const streak of this.streaks) {
      const { zone } = streak;
      if (this.motion.ambient) {
        streak.x = wrapInto(streak.x + zone.force.x * dt, zone.x0, zone.x1);
        streak.y = wrapInto(streak.y + zone.force.y * dt, zone.y0, zone.y1);
        const edge = Math.min(streak.x - zone.x0, zone.x1 - streak.x);
        streak.image.setAlpha(Phaser.Math.Clamp(edge / STREAK_EDGE_FADE, 0, 1));
      }
      streak.image.setPosition(streak.x, streak.y);
    }
  }

  /** The explorer's size factor: art-anchored offsets scale with it so they stay on the body (PRD F4). */
  private axolotlSize(): number {
    return AXO_SIZE_SCALE[this.assets.axolotl.look.size];
  }

  private renderBubbles(dt: number): void {
    const worldPerUnit = AXO_SCENE_SCALE * this.axolotlSize();
    const emitter = this.motion.bubbles ? bodyPoint(this.body, worldPerUnit, MOUTH_X, MOUTH_Y, MOUTH_AT) : null;
    this.bubbles = updateBubbles(this.bubbles, dt, emitter, this.rand);
    const baked = this.assets.baked.bubbles;
    this.bubbleImages.forEach((image, i) => {
      const bubble = this.bubbles.list[i];
      if (!bubble) {
        image.setVisible(false);
        return;
      }
      const view = bubblePos(bubble);
      const index = BUBBLE_RADII.findIndex((radius) => radius >= view.r);
      const textureIndex = index === -1 ? BUBBLE_RADII.length - 1 : index;
      const info = baked[textureIndex];
      placeBaked(image.setTexture(info.key), info)
        .setScale(view.r / BUBBLE_RADII[textureIndex] / info.scale)
        .setPosition(view.x, view.y)
        .setVisible(true);
    });
  }

  private renderSparkles(dt: number): void {
    const trailing = this.motion.dashTrail && this.isDashing();
    if (trailing) {
      this.sparkleAcc += dt;
      while (this.sparkleAcc >= SPARKLE_SPAWN_S) {
        this.sparkleAcc -= SPARKLE_SPAWN_S;
        this.spawnSparkle();
      }
    } else {
      this.sparkleAcc = 0;
    }
    const info = this.assets.baked.sparkle;
    for (const sparkle of this.sparkles) {
      sparkle.age += dt;
      const life = sparkle.age / SPARKLE_LIFE_S;
      if (life >= 1 || !this.motion.dashTrail) {
        sparkle.image.setVisible(false);
        continue;
      }
      sparkle.image.setAlpha(1 - life).setScale((0.9 - 0.5 * life) / info.scale);
    }
  }

  private spawnSparkle(): void {
    const sparkle = this.sparkles[this.sparkleCursor];
    this.sparkleCursor = (this.sparkleCursor + 1) % this.sparkles.length;
    sparkle.age = 0;
    const localX = -SPARKLE_TAIL_X + (this.rand() - 0.5) * SPARKLE_SPREAD_X;
    const localY = (this.rand() - 0.5) * SPARKLE_SPREAD_Y;
    const at = bodyPoint(this.body, AXO_SCENE_SCALE * this.axolotlSize(), localX, localY, SPARKLE_AT);
    sparkle.image.setPosition(at.x, at.y).setVisible(true);
  }

  private renderSurface(t: number): void {
    const view = this.cameras.main.worldView;
    const x0 = Math.max(0, Math.floor(view.x / SURFACE_STEP - 1) * SURFACE_STEP);
    const x1 = Math.min(this.zone.width, view.right + SURFACE_STEP);
    const steps = Math.max(1, Math.ceil((x1 - x0) / SURFACE_STEP));
    const xs = Array.from({ length: steps + 1 }, (_, k) => Math.min(x0 + k * SURFACE_STEP, x1));

    const fill = this.surfaceFill;
    const line = this.surfaceLine;
    const graphics = this.surface;
    graphics.clear();
    graphics.fillStyle(fill.color, fill.alpha);
    graphics.beginPath();
    graphics.moveTo(x0, SURFACE_BAND_BOTTOM);
    for (const x of xs) graphics.lineTo(x, waveY(x, t));
    graphics.lineTo(x1, SURFACE_BAND_BOTTOM);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(this.surfaceLineWidth, line.color, line.alpha);
    graphics.beginPath();
    graphics.moveTo(xs[0], waveY(xs[0], t));
    for (const x of xs) graphics.lineTo(x, waveY(x, t));
    graphics.strokePath();
  }

  private renderPads(t: number): void {
    this.zone.pads.forEach((pad, i) => {
      const slope = (waveY(pad.x + 3, t) - waveY(pad.x - 3, t)) / 6;
      this.pads[i].setPosition(pad.x, waveY(pad.x, t) - 1).setRotation(Math.atan(slope));
    });
  }
}
