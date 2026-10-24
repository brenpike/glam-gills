/**
 * The lily pad pond, Area 2 (issue #75), as area data: 5 screens across, 1 down. A hollow log is
 * the cave, and the stream flowing in at the right end is the current, with spots past it.
 */
import { POND_TREASURES } from './catalogue';
import type { HazardSpawn } from './hazards';
import { mobileSnackMix, shrimpRule, tadpoleLane, tadpoleRule } from './mobileSnacks';
import { PLASTIC_WORM } from './plasticWorms';
import { TILAPIA, TILAPIA_RAMP_CHASE, type TilapiaTuning } from './tuning';
import { BED_TOP, SURF, type AreaLayoutData } from './zone';

export const POND_AREA_ID = 'pond-1';

/**
 * Area 2's tilapia (issue #121, ND-1): TILAPIA with the ramp chase, sight 200 and speed 115, on a
 * leash of 60 px, the shortest leash of any area. Every other value stays TILAPIA's.
 */
export const POND_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...TILAPIA,
  chase: Object.freeze({ ...TILAPIA_RAMP_CHASE, leash: 60 }),
});

/** Area 2's tadpoles (issue #121, ND-4): 25 px/s, the bottom of the ramp's 20 to 30 px/s. */
const POND_TADPOLE = tadpoleRule(25);

/** One plastic worm: a circle of radius 0 at a fixed place, id `pond-1/plastic-worm-<n>`. */
function plasticWormAt(index: number, x: number, y: number): Readonly<HazardSpawn> {
  return Object.freeze({
    id: `${POND_AREA_ID}/plastic-worm-${index}`,
    type: PLASTIC_WORM,
    shape: Object.freeze({ kind: 'circle' as const, x, y, r: 0 }),
  });
}

/** The pond, Area 2, as area data: 5 screens across, 1 down. */
export const POND_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: POND_AREA_ID,
  screensWide: 5,
  screensTall: 1,
  start: Object.freeze({ x: 120, y: 200 }),
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: BED_TOP }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([
    Object.freeze({
      columns: Object.freeze([316, 372, 428, 484]),
      rows: Object.freeze([
        Object.freeze({ y: 172, rarity: 'common', tag: 'a' }),
        Object.freeze({ y: 228, rarity: 'common', tag: 'b' }),
      ]),
    }),
    Object.freeze({
      columns: Object.freeze([580, 640]),
      rows: Object.freeze([Object.freeze({ y: 110, rarity: 'rare', tag: 'top' })]),
    }),
    Object.freeze({
      columns: Object.freeze([1316, 1376, 1436]),
      rows: Object.freeze([Object.freeze({ y: 288, rarity: 'rare', tag: 'deep' })]),
    }),
    Object.freeze({
      columns: Object.freeze([1700]),
      rows: Object.freeze([Object.freeze({ y: 288, rarity: 'rare', tag: 'deep' })]),
    }),
  ]),
  caveSpots: Object.freeze([
    Object.freeze([1492, 206, 'legendary', true] as const),
    Object.freeze([1552, 206, 'legendary', true] as const),
    Object.freeze([1612, 206, 'legendary', true] as const),
    Object.freeze([1492, 266, 'epic', false] as const),
    Object.freeze([1552, 266, 'epic', false] as const),
    Object.freeze([1612, 266, 'epic', false] as const),
  ]),
  currentSpots: Object.freeze([
    Object.freeze([2200, 140, 'legendary', true] as const),
    Object.freeze([2200, 200, 'legendary', true] as const),
    Object.freeze([2200, 260, 'legendary', true] as const),
    Object.freeze([2260, 140, 'epic', false] as const),
    Object.freeze([2260, 200, 'epic', false] as const),
    Object.freeze([2260, 260, 'epic', false] as const),
  ]),
  /** The stream flowing in at the right end, in the art's stream band (y 120 to 280), flowing left. */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 1760, x1: 2160, y0: 120, y1: 280, force: Object.freeze({ x: -70, y: 0 }) }),
  ]),
  /** The hollow log. */
  cave: Object.freeze({ id: `${POND_AREA_ID}/cave`, x0: 1480, x1: 1640, y0: 200, y1: 318 }),
  /**
   * Four fixed patrol loops, left to right along the pond. The closest two, `tilapia-0` and
   * `tilapia-1`, are 290 px apart, more than twice the lunge range of 140 px.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([700, 262] as const),
      Object.freeze([790, 262] as const),
      Object.freeze([790, 296] as const),
      Object.freeze([700, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1080, 250] as const),
      Object.freeze([1150, 250] as const),
      Object.freeze([1150, 296] as const),
      Object.freeze([1080, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1432, 110] as const),
      Object.freeze([1588, 110] as const),
      Object.freeze([1588, 144] as const),
      Object.freeze([1432, 144] as const),
    ]),
    Object.freeze([
      Object.freeze([2080, 100] as const),
      Object.freeze([2145, 100] as const),
      Object.freeze([2145, 296] as const),
      Object.freeze([2080, 296] as const),
    ]),
  ]),
  predatorRoutes: Object.freeze([]),
  /** Six plastic worms, left to right, each far from the tilapia and the stream. */
  hazards: Object.freeze([
    plasticWormAt(1, 420, 120),
    plasticWormAt(2, 540, 290),
    plasticWormAt(3, 720, 105),
    plasticWormAt(4, 960, 170),
    plasticWormAt(5, 1280, 150),
    plasticWormAt(6, 1300, 270),
  ]),
  elements: Object.freeze([]),
  /** Along the middle, up over the first tilapia and the Common pad, then on past the stream to the exit. */
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 200 }),
    Object.freeze({ x: 560, y: 200 }),
    Object.freeze({ x: 760, y: 140 }),
    Object.freeze({ x: 1060, y: 140 }),
    Object.freeze({ x: 1240, y: 200 }),
    Object.freeze({ x: 2330, y: 200 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), left to right: above the first reeds, on the bed between the
   * first two tilapia, in the open water before the deep reeds, above the last reeds before the
   * stream, and on the bed past the stream. Every place is at least 80 px from every tilapia route.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${POND_AREA_ID}/strand-1`, x: 320, y: 110 }),
    Object.freeze({ id: `${POND_AREA_ID}/strand-2`, x: 880, y: 292 }),
    Object.freeze({ id: `${POND_AREA_ID}/strand-3`, x: 1340, y: 220 }),
    Object.freeze({ id: `${POND_AREA_ID}/strand-4`, x: 1700, y: 140 }),
    Object.freeze({ id: `${POND_AREA_ID}/strand-5`, x: 2310, y: 296 }),
  ]),
  treasures: POND_TREASURES,
  /**
   * 10 worms and 6 bugs (issue #121, ND-4): 4 fewer than before, for the 2 tadpoles and 2 shrimp,
   * so the pond keeps 20 snacks. snacksInCurrent places 4 worms or bugs in the stream on purpose;
   * it is a floor, since stripe snacks may also start there (ADR 0022).
   */
  snackWorms: 10,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  /**
   * The Common pad over the main path, and the Rare pad between the hollow log and the stream, then
   * pads that only decorate. No pad sits above a plastic worm. The Rare pad moved here from x 1240
   * (issue #121, ND-8): with the chase on, no start there was safe and fair, and here one is.
   */
  fixedPads: Object.freeze([
    Object.freeze({ x: 915, rx: 24, flower: true, spot: Object.freeze({ y: 100, rarity: 'common', tag: 'a' }) }),
    Object.freeze({ x: 1760, rx: 23, flower: false, spot: Object.freeze({ y: 100, rarity: 'rare', tag: 'b' }) }),
    Object.freeze({ x: 190, rx: 24, flower: true }),
    Object.freeze({ x: 640, rx: 22, flower: false }),
    Object.freeze({ x: 1390, rx: 25, flower: true }),
    Object.freeze({ x: 1820, rx: 22, flower: false }),
    Object.freeze({ x: 2280, rx: 24, flower: true }),
  ]),
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  tilapia: POND_TILAPIA,
  /**
   * Mobile snacks (issue #121, ND-4): a tadpole across the first reeds and one up and down beside
   * the stream, half a lap ahead, then a shrimp by the Common pad and one past the stream. The
   * Snack magnet pull stays 40 px/s (ND-5), and the shrimp turn the one-time darters off (ND-6).
   */
  mobileSnacks: mobileSnackMix({
    tadpole: POND_TADPOLE,
    lanes: Object.freeze([
      tadpoleLane(POND_TADPOLE, 320, 210, 120, 0, 0),
      tadpoleLane(POND_TADPOLE, 1744, 140, 0, 120, (2 * 120) / 25 / 2),
    ]),
    shrimp: shrimpRule(60, 2.0, 36, 100),
    spots: Object.freeze([Object.freeze({ x: 860, y: 106 }), Object.freeze({ x: 2320, y: 130 })]),
  }),
} satisfies AreaLayoutData);
