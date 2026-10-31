/**
 * Art palette and metrics. Every value comes from docs/art-style-guide.md
 * (section 3a unless noted), which is a port of prototypes/art-styles/cartoon.js.
 * Presentational only: no game state, no Phaser.
 */

// ---- Reference viewport (guide section 1) -------------------------------
export const VIEW_W = 480;
export const VIEW_H = 360;
/** Water line, logical px. */
export const SURF = 80;
/** Time used for the reduced-motion still frame (guide section 9). */
export const T_STATIC = 1.0;

// ---- Ink and fixed colours ----------------------------------------------
/** Single outline colour for every object. Never use pure black. */
export const INK = '#2b2350';
/** Main outline width, logical px. Constant at every object size. */
export const LW = 3.5;
export const EYE = '#1b1535';
export const WHITE = '#ffffff';
/** Page background around the 4:3 canvas ("deep canal teal"). */
export const LETTERBOX = '#0c6a8c';

// ---- Sky, sun, clouds ----------------------------------------------------
export const SKY_TOP = '#4fc3ff';
export const SKY_HORIZON = '#c4f1ff';
export const SUN = '#ffe14a';
export const SUN_RAY = '#ffb52e';
export const CLOUD_SHINE = '#cfeeff';
export const SUN_SHINE = 'rgba(255,255,255,0.9)';

// ---- Willows and chinampa bank ------------------------------------------
export const WILLOW_TRUNK = '#a56a3b';
export const WILLOW_STRAND = '#35b342';
export const WILLOW_FOLIAGE = '#43c74d';
export const WILLOW_SHINE = '#9af27a';
export const BANK_SOIL = '#a2623a';
export const SOIL_DETAIL = '#7f4a2a';
export const GRASS = '#63d94f';
export const GRASS_SHINE = '#a6f58a';

// ---- Water (clean state, guide 3a and 3c) --------------------------------
export const WATER_SHALLOW = '#55e4d8';
export const WATER_MID = '#1cb6cc';
export const WATER_DEEP = '#0a5c98';
/** Gradient stop positions, shared by every water state. */
export const WATER_STOP_MID = 0.45;
/** y where the water gradient ends (deep stop). */
export const WATER_GRADIENT_END_Y = 330;
export const HAZE = 'rgba(40,200,215,0.12)';
export const SURFACE_LINE = 'rgba(236,255,252,0.95)';
export const SURFACE_LINE_WIDTH = 3.4;
/** Light-ray peak alpha at the top of a shaft; fades to 0 at y 300. */
export const RAY_ALPHA = 0.12;
export const RAY_ALPHA_SWING = 0.05;
export const RAY_END_Y = 300;

// ---- Canal bed and pebbles ----------------------------------------------
export const BED_TOP = '#b78552';
export const BED_BOTTOM = '#8c5e3a';
export const BED_LIP = '#e0b07a';
export const MUD = 'rgba(110,70,40,0.55)';
export const PEBBLE_A = '#d4cfe6';
export const PEBBLE_B = '#a9bfd6';
export const PEBBLE_C = '#efdcba';
export const PEBBLE_D = '#97a6c4';
export const PEBBLE_E = '#e0b095';
export const PEBBLE_COLOURS: readonly string[] = [PEBBLE_A, PEBBLE_B, PEBBLE_C, PEBBLE_D, PEBBLE_E];
export const PEBBLE_SHINE = 'rgba(255,255,255,0.8)';

// ---- Reeds, lily pads, flower -------------------------------------------
export const REED_LIGHT = '#63d247';
export const REED_DARK = '#45b83e';
export const REED_LEAF = '#86e660';
export const CATTAIL = '#9a5426';
export const LILY_PAD = '#47ce5a';
export const LILY_PAD_SHINE = '#a2f58c';
export const FLOWER_PETAL = '#ff82bf';
export const FLOWER_FRONT_PETAL = '#ffb4dc';
export const PETAL_SHINE = 'rgba(255,255,255,0.9)';
/** Flower centre uses the sun colour. */
export const FLOWER_CENTRE = SUN;

// ---- Axolotl detail colours that are not morph slots --------------------
export const FIN_RAY = 'rgba(236,120,160,0.65)';
export const BODY_SHINE = 'rgba(255,255,255,0.75)';
export const FRECKLE = 'rgba(236,120,160,0.55)';
export const BLUSH = 'rgba(255,100,148,0.5)';
/** Girl cue cheek heart fill (guide 6u): opaque, so it reads stronger than the see-through blush on every body. */
export const CHEEK_HEART = '#ff5c9a';

// ---- Bubbles -------------------------------------------------------------
export const BUBBLE_FILL = 'rgba(255,255,255,0.38)';
export const BUBBLE_STROKE = 'rgba(43,35,80,0.85)';
export const BUBBLE_STROKE_WIDTH = 2;

// ---- Morph role slots (guide 3b) ----------------------------------------
/**
 * A morph swaps colours through these named slots. Shapes, line weights and
 * layer order never change. LEUCISTIC, WILD, GOLDEN_ALBINO, WHITE_ALBINO,
 * COPPER, PIEBALD, AXANTHIC and MELANOID are implemented; GFP is not in the MVP.
 */
export interface MorphPalette {
  readonly body: string;
  readonly farSide: string;
  readonly fin: string;
  readonly belly: string;
  readonly gillNearStem: string;
  readonly gillNearFilament: string;
  readonly gillFarStem: string;
  readonly gillFarFilament: string;
  readonly eye: string;
  readonly mouth: string;
  /** Non-hue cues and tweaks (guide 3b, 6h). Undefined draws exactly the Leucistic look. */
  readonly extras?: MorphExtras;
  /** The Dream colour painted over the real morph (guide 3f, 6p). Set only on Dream palettes (dreamPalette). */
  readonly dream?: DreamOverlay;
}

/**
 * One small mark (speckle, fleck or glint) in the axolotl's local units.
 * Body marks use local x, y. Tail marks are tail-space: `t` runs 0 at the tail
 * root to 1 at the tail tip, and `offset` is a fraction of the local core
 * half-height (negative is toward the top edge, 0 the centre line, so the mark
 * follows the tail wave). Provisional.
 */
export type MorphMark =
  | { readonly space: 'body'; readonly x: number; readonly y: number; readonly r: number }
  | { readonly space: 'tail'; readonly t: number; readonly offset: number; readonly r: number };

/** A colour plus the marks painted in it. */
export interface MorphMarkSet {
  readonly colour: string;
  readonly marks: readonly MorphMark[];
}

/** Rim light along the upper silhouette (guide 3b). `width` is the visible inner width, logical px. */
export interface MorphRim {
  readonly colour: string;
  readonly width: number;
  /** True: the rim runs on to the tail tip, top fin edge included. False: it stops where the fin band starts. */
  readonly fin: boolean;
}

/** Ring just inside the edge of each eye bead. `width` in logical px. */
export interface MorphEyeRing {
  readonly colour: string;
  readonly width: number;
}

/**
 * Morph extras (guide 3b non-hue cues, 6h). Every field is optional; omitted
 * fields keep the Leucistic prototype look. Every value is derived (provisional).
 */
export interface MorphExtras {
  /** Spot colour for the layer 8 freckles (guide 3b spot table). `null` draws no spots. */
  readonly spot?: string | null;
  /** Body and head shine alpha. Default is BODY_SHINE (0.75). 0 draws no shine. */
  readonly shineAlpha?: number;
  readonly rim?: MorphRim;
  readonly eyeRing?: MorphEyeRing;
  /** Dark pattern dots, clipped to the silhouette, under the shines. */
  readonly speckles?: MorphMarkSet;
  /** Small bright dots, clipped to the silhouette, over the shines. */
  readonly flecks?: MorphMarkSet;
  /** Four-point glints with no outline, clipped to the silhouette, over the shines. */
  readonly shimmer?: MorphMarkSet;
  /** Default true. */
  readonly blush?: boolean;
  /** Fin ray and core-edge colour. Default FIN_RAY. `null` draws no fin rays. */
  readonly finRays?: string | null;
}

const bodyMark = (x: number, y: number, r: number): MorphMark => ({ space: 'body', x, y, r });
const tailMark = (t: number, offset: number, r: number): MorphMark => ({ space: 'tail', t, offset, r });

/** Leucistic colourway: the approved prototype hero. */
export const LEUCISTIC: MorphPalette = {
  body: '#ffb7cf',
  farSide: '#f58fb0',
  fin: '#ffd9e6',
  belly: '#ffe3ed',
  gillNearStem: '#ff5f8d',
  gillNearFilament: '#ff7fa6',
  gillFarStem: '#e8507f',
  gillFarFilament: '#f26b92',
  eye: EYE,
  mouth: '#e8567e',
};

/**
 * Wild colourway (guide 3b), derived (provisional). Non-hue cue: dark speckles
 * plus a few gold flecks. All extras below are derived (provisional).
 */
export const WILD: MorphPalette = {
  body: '#b0b86e',
  farSide: '#939c55',
  fin: '#cdd398',
  belly: '#e2e4b8',
  gillNearStem: '#8a5f8f',
  gillNearFilament: '#a77aa9',
  gillFarStem: '#714a77',
  gillFarFilament: '#8c6490',
  eye: EYE,
  mouth: '#c85a74',
  extras: {
    // Far gill stem #714a77 at 0.55.
    spot: 'rgba(113,74,119,0.55)',
    // Corrective contrast cue (guide 12 "Wild rim"): a 2 px rim in the Wild
    // belly colour just inside the ink from snout to the fin band start (tail
    // point 3, or 1 on a Boy), not on the fin. Ink vs rim is 10.98:1 (worst
    // case 3.31:1). It keeps the body, so Wild luminance stays 0.446, and it
    // differs from Melanoid's fin-inclusive #cec9f0 rim.
    rim: { colour: '#e2e4b8', width: 2, fin: false },
    // 8 dots (guide asks 6 to 9). Positions are derived (provisional).
    speckles: {
      colour: '#5f6b33',
      marks: [
        bodyMark(-12, -9.75, 1.6),
        bodyMark(-24, -6, 1.5),
        bodyMark(-18, 2, 1.4),
        bodyMark(-34, 0, 1.3),
        tailMark(0.15, -0.45, 1.5),
        tailMark(0.35, 0.4, 1.4),
        tailMark(0.55, -0.35, 1.2),
        tailMark(0.75, 0.2, 1.0),
      ],
    },
    flecks: {
      colour: '#ffe14a',
      marks: [bodyMark(-8, -6, 1.0), bodyMark(-27, 3, 1.0), tailMark(0.45, -0.1, 0.9)],
    },
  },
};

/**
 * Golden albino colourway (guide 3b), derived (provisional). Non-hue cue: light
 * eye with an ink ring, plus shimmer glints with no outline.
 */
export const GOLDEN_ALBINO: MorphPalette = {
  body: '#ffd36b',
  farSide: '#f2b445',
  fin: '#ffe7a8',
  belly: '#fff1c9',
  gillNearStem: '#ff8a65',
  gillNearFilament: '#ffa585',
  gillFarStem: '#ef7350',
  gillFarFilament: '#f78f6c',
  eye: '#d6336c',
  mouth: '#e86a5a',
  extras: {
    // #ef7350 at 0.55.
    spot: 'rgba(239,115,80,0.55)',
    eyeRing: { colour: INK, width: 1.5 },
    // Three white four-point glints, R 2, no outline. Positions are derived (provisional).
    shimmer: {
      colour: 'rgba(255,255,255,0.8)',
      marks: [bodyMark(-18, -8, 2), bodyMark(-30, 2, 2), tailMark(0.4, -0.2, 2)],
    },
  },
};

/**
 * White albino colourway (guide 3b), derived (provisional). Lightest value.
 * Non-hue cue: light pink eye with an ink ring, as Golden albino, on a
 * near-white body. Ink vs body 13.38:1, so it passes alone.
 */
export const WHITE_ALBINO: MorphPalette = {
  body: '#fff4f6',
  farSide: '#f5dce3',
  fin: '#ffe6ec',
  belly: '#fffafb',
  gillNearStem: '#ff7f9e',
  gillNearFilament: '#ff9fb6',
  gillFarStem: '#ec6a8b',
  gillFarFilament: '#f786a3',
  eye: '#e2557a',
  mouth: '#e86a80',
  extras: {
    spot: FRECKLE,
    eyeRing: { colour: INK, width: 1.5 },
  },
};

/**
 * Copper colourway (guide 3b), derived (provisional). Non-hue cue: fine copper
 * speckles plus white shimmer glints with no outline. Ink vs body 9.24:1, so it
 * passes alone.
 */
export const COPPER: MorphPalette = {
  body: '#fac595',
  farSide: '#eba878',
  fin: '#fdd8b6',
  belly: '#fee6cf',
  gillNearStem: '#f0785f',
  gillNearFilament: '#f7967f',
  gillFarStem: '#d9634b',
  gillFarFilament: '#e88068',
  eye: EYE,
  mouth: '#d9675a',
  extras: {
    // Speckle colour #a8613a at 0.55.
    spot: 'rgba(168,97,58,0.55)',
    // Nine fine dots. Positions are derived (provisional).
    speckles: {
      colour: '#a8613a',
      marks: [
        bodyMark(-6, -2, 1.2),
        bodyMark(-20, -2, 1.1),
        bodyMark(-32, 3, 1.0),
        bodyMark(-12, 6, 1.0),
        bodyMark(-26, 7, 1.0),
        tailMark(0.2, -0.35, 1.1),
        tailMark(0.4, 0.3, 1.0),
        tailMark(0.6, -0.2, 0.9),
        tailMark(0.8, 0.1, 0.8),
      ],
    },
    // Three white four-point glints, no outline. Positions are derived (provisional).
    shimmer: {
      colour: 'rgba(255,255,255,0.8)',
      marks: [bodyMark(-28, -4, 1.8), bodyMark(2, -9, 1.8), tailMark(0.5, 0.15, 1.6)],
    },
  },
};

/**
 * Piebald colourway (guide 3b), derived (provisional). Non-hue cue: a few large
 * dark patches on a near-white body. Ink vs body 12.75:1, so it passes alone and
 * the patches stay inset from the edge.
 */
export const PIEBALD: MorphPalette = {
  body: '#f8eff1',
  farSide: '#e8d8dd',
  fin: '#fbe6eb',
  belly: '#fffafb',
  gillNearStem: '#ee4f6e',
  gillNearFilament: '#f7728c',
  gillFarStem: '#d6435f',
  gillFarFilament: '#e5627b',
  eye: EYE,
  mouth: '#e8567e',
  extras: {
    spot: FRECKLE,
    // Five patches. Positions are derived (provisional).
    speckles: {
      colour: '#4a4459',
      marks: [
        bodyMark(8, -8, 3.4),
        bodyMark(-6, -3, 4.2),
        bodyMark(-24, 1, 3.6),
        tailMark(0.35, -0.3, 2.8),
        tailMark(0.55, 0.2, 2.2),
      ],
    },
  },
};

/**
 * Axanthic colourway (guide 3b), derived (provisional). Cool grey, second
 * darkest value, with normal shine and no eye ring (EYE vs body is 3.85:1).
 */
export const AXANTHIC: MorphPalette = {
  body: '#74767f',
  farSide: '#5e606a',
  fin: '#cfd1d8',
  belly: '#8a8c96',
  gillNearStem: '#8c879f',
  gillNearFilament: '#a6a2b8',
  gillFarStem: '#6f6b84',
  gillFarFilament: '#88849c',
  eye: EYE,
  mouth: '#e8567e',
  extras: {
    // Rim colour at 0.4, so spots show on the grey body.
    spot: 'rgba(228,230,235,0.4)',
    // The Axanthic rim is required: ink vs body is only 3.18:1, ink vs rim
    // 11.53:1. The fin #cfd1d8 is 9.43:1 with ink and passes alone, so the rim
    // stops at the fin band start (tail point 3, or 1 on a Boy). It differs from
    // Melanoid's fin-inclusive #cec9f0 rim.
    rim: { colour: '#e4e6eb', width: 2, fin: false },
    finRays: 'rgba(94,96,106,0.65)',
  },
};

/**
 * Melanoid colourway (guide 3b), derived (provisional). Darkest value, matte,
 * with a required rim light: ink vs body is only 1.74:1, ink vs rim 9.07:1.
 * The mouth slot keeps the Leucistic value.
 */
export const MELANOID: MorphPalette = {
  body: '#4f4a6e',
  farSide: '#3e3a5a',
  fin: '#6a6590',
  belly: '#5f5a82',
  gillNearStem: '#6b4f8f',
  gillNearFilament: '#8467a8',
  gillFarStem: '#563f75',
  gillFarFilament: '#6e558f',
  eye: EYE,
  mouth: '#e8567e',
  extras: {
    // Rim colour, so spots show on the dark body.
    spot: 'rgba(206,201,240,0.35)',
    // Matte: body shine 0.45 instead of 0.75.
    shineAlpha: 0.45,
    // Top fin edge included. Width 2 px.
    rim: { colour: '#cec9f0', width: 2, fin: true },
    // Width to confirm in a prototype (guide 12); 1.5 px matches golden.
    eyeRing: { colour: '#cec9f0', width: 1.5 },
  },
};

/**
 * Friendly silhouette base for unfound morphs: one flat pebble A tone in every
 * slot, ink outline and a dark eye bead. No blush, shine, spots or fin rays.
 * Derived (provisional).
 */
export const SILHOUETTE: MorphPalette = {
  body: PEBBLE_A,
  farSide: PEBBLE_A,
  fin: PEBBLE_A,
  belly: PEBBLE_A,
  gillNearStem: PEBBLE_A,
  gillNearFilament: PEBBLE_A,
  gillFarStem: PEBBLE_A,
  gillFarFilament: PEBBLE_A,
  eye: EYE,
  mouth: PEBBLE_A,
  extras: { spot: null, shineAlpha: 0, blush: false, finRays: null },
};

/** Look ids of the real morphs. Must match the logic layer's RealMorphId. */
export type MorphLookId =
  | 'leucistic'
  | 'wild'
  | 'golden-albino'
  | 'white-albino'
  | 'copper'
  | 'piebald'
  | 'axanthic'
  | 'melanoid';

export const MORPH_PALETTES: Record<MorphLookId, MorphPalette> = {
  leucistic: LEUCISTIC,
  wild: WILD,
  'golden-albino': GOLDEN_ALBINO,
  'white-albino': WHITE_ALBINO,
  copper: COPPER,
  piebald: PIEBALD,
  axanthic: AXANTHIC,
  melanoid: MELANOID,
};

// ---- Dream colours (guide 3f, 6h, 6p) -------------------------------------
// A Dream colour is a paint over the real morph, never a morph. It swaps the
// body and gill slots; the real morph keeps its eye and mouth. Every value in
// this section is derived (provisional).

/** Look ids of the twenty-two Dream colours, in the guide 3f order. Must match the logic layer's Dream colour ids. */
export type DreamLookId =
  | 'mint'
  | 'sky-blue'
  | 'lavender'
  | 'sunset-orange'
  | 'bubblegum'
  | 'midnight-blue'
  | 'hearts'
  | 'tie-dye'
  | 'iridescent'
  | 'rainbow'
  | 'galaxy'
  | 'tie-dye-galaxy'
  | 'lily-green'
  | 'firefly-gold'
  | 'poppy-red'
  | 'plum'
  | 'moonstone'
  | 'chocolate'
  | 'crystal-shine'
  | 'glowworm'
  | 'jade'
  | 'fiesta-shine';

/** The body and gill role slots a Dream colour swaps (guide 3f). */
export type DreamSlots = Pick<
  MorphPalette,
  | 'body'
  | 'farSide'
  | 'fin'
  | 'belly'
  | 'gillNearStem'
  | 'gillNearFilament'
  | 'gillFarStem'
  | 'gillFarFilament'
>;

const dreamSlots = (
  body: string,
  farSide: string,
  fin: string,
  belly: string,
  [gillNearStem, gillNearFilament]: readonly [string, string],
  [gillFarStem, gillFarFilament]: readonly [string, string],
): DreamSlots => ({ body, farSide, fin, belly, gillNearStem, gillNearFilament, gillFarStem, gillFarFilament });

/** The guide 3f "Dream colour slots" table, verbatim. */
export const DREAM_SLOTS: Readonly<Record<DreamLookId, DreamSlots>> = {
  mint: dreamSlots('#a8f0cf', '#99d7c0', '#cbf6e2', '#d8f8e9', ['#34c98e', '#61d5a7'], ['#33b888', '#5dc7a0']),
  'sky-blue': dreamSlots('#9fd8ff', '#91c2ea', '#c5e8ff', '#d4edff', ['#3a96e8', '#65aded'], ['#388ad9', '#60a2e0']),
  lavender: dreamSlots('#d6c5ff', '#c1b2ea', '#e6dcff', '#ede5ff', ['#9575e6', '#ac93ec'], ['#8a6dd7', '#a28ae0']),
  'sunset-orange': dreamSlots(
    '#ffc18e',
    '#e6ae87',
    '#ffdabb',
    '#ffe3cc',
    ['#ff6a3d', '#ff8b68'],
    ['#ea633f', '#ee8366'],
  ),
  bubblegum: dreamSlots('#ffb9e2', '#e6a7d0', '#ffd5ee', '#ffe0f2', ['#e0449c', '#e76db2'], ['#ce4194', '#d867aa']),
  'midnight-blue': dreamSlots(
    '#2f3a8f',
    '#2f3787',
    '#8289bc',
    '#a1a6cd',
    ['#6f8cff', '#8fa5ff'],
    ['#6882ee', '#879bf1'],
  ),
  hearts: dreamSlots('#fff0b3', '#e6d7a7', '#fff6d1', '#fff8dd', ['#ff5f8d', '#ff82a6'], ['#ea5987', '#ee7a9f']),
  'tie-dye': dreamSlots('#ffe9a8', '#e6d19d', '#fff2cb', '#fff5d8', ['#ff7fbf', '#ff9bcd'], ['#ea76b4', '#ee91c3']),
  iridescent: dreamSlots('#d7ccff', '#c2b8ea', '#e7e0ff', '#ede8ff', ['#8fe3ff', '#a8e9ff'], ['#85d0ee', '#9ed9f1']),
  rainbow: dreamSlots('#ff6b6b', '#e66268', '#ffa6a6', '#ffbcbc', ['#b07cff', '#c199ff'], ['#a373ee', '#b590f1']),
  galaxy: dreamSlots('#2b2f7a', '#2b2e75', '#8082af', '#a0a1c3', ['#ff8fd0', '#ffa8da'], ['#ea84c3', '#ee9dcf']),
  'tie-dye-galaxy': dreamSlots(
    '#3a2f7a',
    '#382e75',
    '#8982af',
    '#a6a1c3',
    ['#7fd4ff', '#9bddff'],
    ['#77c2ee', '#92cef1'],
  ),
  // Pond Dream colour (issue #75). Body #ddf274 (hue 70) is 11.67:1 with ink, so 3.42:1 worst case.
  'lily-green': dreamSlots('#ddf274', '#c8d970', '#ebf7ac', '#f0f9c0', ['#4fb83a', '#76c865'], ['#4ba93c', '#70bb63']),
  // Pond Area 3 Dream colour (issue #98). Body #ffd52a (hue 48) is 10.15:1 with ink, so 3.19:1 worst case.
  'firefly-gold': dreamSlots('#ffd52a', '#e6c02f', '#ffe67f', '#ffec9f', ['#e08214', '#e79e48'], ['#ce781a', '#d89449']),
  // Chinampa Area 4 Dream colour (issue #76). Body #e8402f (hue 5, relative luminance 0.210) is 3.57:1 with ink and 4.03:1 with white, so both clear the 3:1 cue floor.
  'poppy-red': dreamSlots('#e8402f', '#d13d33', '#f18c82', '#f5a9a1', ['#ffb02e', '#ffc15c'], ['#eaa231', '#eeb45b']),
  // Chinampa Area 5 Dream colour (issue #118, ND-11). Body #933f93 is a deep plum (relative luminance 0.119): 6.23:1 with white and 2.31:1 with ink, so it follows the dark-body rules (white spots, eye ring, rim light).
  plum: dreamSlots('#933f93', '#873c8b', '#be8cbe', '#cea9ce', ['#f2a0ee', '#f5b5f2'], ['#de94de', '#e5a9e5']),
  // Spring cave Area 6 Dream colour (issue #77, ND-12). Body #f5f7fc is a pale silvery white (relative luminance 0.930), the lightest Dream colour: 13.43:1 with ink, so 3.66:1 worst case.
  moonstone: dreamSlots('#f5f7fc', '#dddee7', '#f9fafd', '#fbfbfe', ['#7f9fdc', '#9bb4e4'], ['#7793ce', '#92a8d8']),
  // Spring cave Area 7 Dream colour (issue #105, ND-13). Body #6c391d is a deep chocolate brown (relative luminance 0.062):
  // 9.37:1 with white and 1.54:1 with ink, so it follows the dark-body rules (white spots, eye ring, rim light). The named
  // default #7b4a2c (0.093) sat 1.18:1 from Plum in greyscale, under Plum's 1.5:1 margin; #6c391d is the nearest brown
  // that keeps 1.5:1 from Plum and 1.05:1 from Midnight blue.
  chocolate: dreamSlots('#6c391d', '#643623', '#a78877', '#bda699', ['#ffa6c9', '#ffbad5'], ['#ea99bd', '#eeaeca']),
  // Spring cave Area 6 Legendary Dream colour (Crystal shine, a sheen). Body #2f9a9a is a teal (relative luminance 0.260):
  // 4.26:1 with ink and 3.38:1 with white, so ink spots and no rim light. It sits in the window between Poppy red (1.19:1)
  // and Rainbow (1.22:1), 2.25:1 from Iridescent (the shared stripe cue needs 1.5:1), and keeps the girl cheek heart
  // fill further from the body than the blush. The violet gill #6a3fd8 is 1.87:1 against it.
  'crystal-shine': dreamSlots('#2f9a9a', '#2f8c91', '#82c2c2', '#a1d2d2', ['#6a3fd8', '#8b69e1'], ['#643cca', '#8363d5']),
  // Spring cave Area 7 Legendary Dream colour (Glowworm). Body #101c52 is a night blue (relative luminance 0.0155), darker
  // than Galaxy (1.37:1) and Midnight blue (1.62:1): 16.03:1 with white and 1.11:1 with ink, so it follows the dark-body
  // rules (white spots, eye ring, rim light). The glow gill #4fe3c1 is 9.99:1 against it.
  glowworm: dreamSlots('#101c52', '#131d52', '#707797', '#9399b1', ['#4fe3c1', '#76e9cf'], ['#4bd0b6', '#70d9c5']),
  // Deep canal Area 8 Dream colour (Jade, issue #78). Body #3ec8a8 is a deep blue-green (relative luminance 0.452), darker
  // than Mint (1.60:1) and Lily green (1.70:1) and 1.62:1 lighter than Crystal shine, so all three keep the 1.5:1 greyscale
  // margin. 6.88:1 with ink and 2.09:1 with white, so ink spots and, as Rainbow, the rim light. The deep jade gill #13806c
  // is 2.32:1 against it.
  jade: dreamSlots('#3ec8a8', '#3cb49d', '#8bdecb', '#a8e6d8', ['#13806c', '#479c8c'], ['#157769', '#459287']),
  // Deep canal Area 8 Legendary Dream colour (Fiesta shine, a sheen). Body #ff78c8 is a bright fiesta pink (relative
  // luminance 0.389): 1.51:1 darker than Bubblegum and 1.59:1 from Iridescent, the other light sheen. 6.01:1 with ink and
  // 2.39:1 with white, so ink spots and, as Rainbow, the rim light. The sunny yellow gill #ffd83a is 1.73:1 against it.
  'fiesta-shine': dreamSlots('#ff78c8', '#e66eba', '#ffaede', '#ffc2e6', ['#ffd83a', '#ffe165'], ['#eac63c', '#eed263']),
};

/** Marks a palette as a Dream colour over a real morph; drawAxolotl paints the layer 6.5 overlay from it. */
export interface DreamOverlay {
  readonly id: DreamLookId;
}

/**
 * Dream rim light (guide 3f): 2 px #cec9f0 along the upper silhouette, top fin
 * edge included, as Melanoid. Ink vs rim is 9.07:1.
 */
export const DREAM_RIM_LIGHT: MorphRim = { colour: '#cec9f0', width: 2, fin: true };

/** Dream eye ring (guide 3f): 1.5 px #cec9f0 round the morph eye. Ring vs eye bead is 10.98:1. */
export const DREAM_EYE_RING: MorphEyeRing = { colour: '#cec9f0', width: 1.5 };

/** The dark Dream bodies (guide 3f): the morph eye is under 3:1 on them, so they get the eye ring and white spots. */
const DREAM_DARK_IDS: readonly DreamLookId[] = ['midnight-blue', 'galaxy', 'tie-dye-galaxy', 'plum', 'chocolate', 'glowworm'];
/** Guide 3f Extras column: the Dream colours with the rim light. */
const DREAM_RIM_IDS: readonly DreamLookId[] = [
  'midnight-blue',
  'rainbow',
  'galaxy',
  'tie-dye-galaxy',
  'plum',
  'chocolate',
  'glowworm',
  'jade',
  'fiesta-shine',
];
/** Guide 3b spot table: white at 0.45 on the dark Dream bodies. */
const DREAM_SPOT_DARK = 'rgba(255,255,255,0.45)';
/** Guide 3b spot table: ink at 0.30 on Dream bodies of relative luminance 0.2 or more. */
const DREAM_SPOT_LIGHT = 'rgba(43,35,80,0.30)';

/**
 * The real morph `base` wearing Dream colour `id` (guide 3f, 6h, 6p): the 3f
 * body and gill slots, the morph's eye and mouth. The morph's body extras are
 * off (no speckles, flecks, shimmer, matte shine, morph rim or fin rays); only
 * the Dream spot colour, rim light and eye ring rules apply. Builds a new
 * object: use axolotlPalette for the cached one.
 */
export function dreamPalette(base: MorphPalette, id: DreamLookId): MorphPalette {
  const dark = DREAM_DARK_IDS.includes(id);
  const eyeRing = dark ? DREAM_EYE_RING : base.extras?.eyeRing;
  const extras: MorphExtras = {
    spot: dark ? DREAM_SPOT_DARK : DREAM_SPOT_LIGHT,
    ...(DREAM_RIM_IDS.includes(id) ? { rim: DREAM_RIM_LIGHT } : {}),
    ...(eyeRing ? { eyeRing } : {}),
  };
  return { ...DREAM_SLOTS[id], eye: base.eye, mouth: base.mouth, extras, dream: { id } };
}

const dreamPaletteCache = new Map<string, MorphPalette>();

/**
 * Palette for a real morph with an optional Dream colour. `null` returns
 * MORPH_PALETTES[morph] itself; otherwise the same cached Dream palette object
 * for every call with this pair.
 */
export function axolotlPalette(morph: MorphLookId, dream: DreamLookId | null): MorphPalette {
  if (dream === null) return MORPH_PALETTES[morph];
  const key = `${morph}|${dream}`;
  const cached = dreamPaletteCache.get(key);
  if (cached) return cached;
  const palette = dreamPalette(MORPH_PALETTES[morph], dream);
  dreamPaletteCache.set(key, palette);
  return palette;
}

// ---- UI roles (guide 3d and section 8) -----------------------------------
export const UI_TEXT = INK;
export const UI_PRIMARY = '#ffe14a';
export const UI_SECONDARY = '#55e4d8';
export const UI_ACCENT = '#ff82bf';
export const UI_SUCCESS = '#86e660';
export const UI_PANEL = '#ffffff';
export const UI_PANEL_PINK = '#ffd9e6';
/** White text on the letterbox colour is 6.08:1. */
export const UI_ON_LETTERBOX = '#ffffff';

/**
 * Rounded system sans-serif stack. No webfont is fetched; the final typeface
 * is deferred (guide section 8).
 */
export const UI_FONT =
  'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", "Quicksand", "Segoe UI", system-ui, sans-serif';

// ---- Predator (provisional) ----------------------------------------------
// Every value in this section is derived (provisional): not in the approved
// prototype, so confirm in a prototype before final art. The tilapia is cooler
// and less saturated than the hero so the axolotl stays the warmest, brightest
// thing on screen (guide section 2).
/** Tilapia body (guide 3g): 9.07:1 with ink, so body or ink is 3.01:1 or better on any background. */
export const TILAPIA_BODY = '#c2d2bb';
/** Tilapia fins (guide 3g): 10.54:1 with ink. No fin sits wholly behind the body, so there is no far-fin tone. */
export const TILAPIA_FIN = '#d4e0d0';
/** Tilapia belly band (guide 3g): 11.72:1 with ink. */
export const TILAPIA_BELLY = '#e3eadf';
/** Tilapia body bars (guide 3g). Soft tinted mark, never ink. They also tell the tilapia from the axolotl without hue. */
export const TILAPIA_BARS = 'rgba(70,95,80,0.22)';
/** Tilapia fin rays and gill-cover line (guide 3g). Internal detail lines, never ink. */
export const TILAPIA_LINE = 'rgba(70,95,80,0.4)';
/** Tilapia shine (guide 3g). */
export const TILAPIA_SHINE = 'rgba(255,255,255,0.6)';
/** Inside of the tilapia's open lunge mouth (guide 3g). */
export const TILAPIA_MOUTH = '#e8567e';
/** Alert sign bubble fill, provisional. Reuses the sun yellow; ink "!" on it is 11.05:1. */
export const ALERT_FILL = SUN;
/** Telegraph glint fill, provisional. */
export const GLINT_FILL = WHITE;
/** Poof puff fill, provisional. White cloud puffs, never red. */
export const POOF_PUFF = WHITE;
/** Poof puff shine, provisional. Reuses the cloud shine. */
export const POOF_SHINE = CLOUD_SHINE;
/** Poof sparkle fill, provisional. Reuses the sun yellow. */
export const POOF_SPARKLE = SUN;
/** Protected ring outer line (guide 3g, 6q): ink, opaque. Ink and white are 14.39:1, so one line is 3.79:1 or better on any background. */
export const PROTECTED_RING_OUTER = INK;
/** Protected ring inner line (guide 3g, 6q): white, opaque. */
export const PROTECTED_RING_INNER = WHITE;
/** Protected ring glint (guide 3g, 6q): white, opaque. */
export const PROTECTED_RING_GLINT = WHITE;
/** Legs display, leg present (guide 3g): 3.46:1 vs the white panel, 4.16:1 vs ink. */
export const LEGS_FILL = '#e8567e';
/** Carry bubble inner rim, provisional. White vs water deep is 6.6:1. */
export const CARRY_RIM = 'rgba(255,255,255,0.9)';

// ---- Home Spot (guide 3g and 7d, provisional) ----------------------------
// Every value in this section is derived (provisional).
/** Burrow arch stones, in turn A, C, A, C, A, C, A. 9.50 and 10.70:1 with ink. */
export const HOME_STONE_A = PEBBLE_A;
export const HOME_STONE_C = PEBBLE_C;
export const HOME_STONES: readonly string[] = [HOME_STONE_A, HOME_STONE_C];
/** Burrow opening, the eye colour. 3.13:1 or better against every bed colour. */
export const HOME_OPENING = EYE;
/** Soft glow at the bottom of the opening. Inside the silhouette, so alpha is allowed. */
export const HOME_GLOW = 'rgba(255,225,74,0.25)';
/** Marker post tube, the willow trunk brown. */
export const HOME_POST = WILLOW_TRUNK;
/** Marker flag, sun yellow. Ink house icon on it is 11.05:1. */
export const HOME_FLAG = SUN;
/** Safe-ring dot fill. Opaque, with an opaque ink 2.0 stroke: 14.39:1. */
export const HOME_RING_DOT = WHITE;
/**
 * Home Tank wall (3g). Home Tank scene backdrop and the Treasure Chest backdrop
 * (it was the interim home screen backdrop before the Home Tank). 12.89:1 with ink.
 */
export const HOME_TANK_WALL = '#fff1d6';

// ---- Home Tank kit (guide 3g and 7f, provisional) --------------------------
// Every value in this section is derived (provisional).
/** Home Tank stand band, the willow trunk brown (#a56a3b), as the Home Spot post. */
export const HOME_TANK_STAND = WILLOW_TRUNK;
/** Home Tank lid, pebble A (#d4cfe6). 9.5:1 with ink. */
export const HOME_TANK_LID = PEBBLE_A;
/** Home Tank air gap under the lid, the sky horizon tone (#c4f1ff). 11.91:1 with ink. */
export const HOME_TANK_AIR_GAP = SKY_HORIZON;
/** Home Tank glass shine stripes. Inside the glass, so alpha is allowed. */
export const HOME_TANK_GLASS_SHINE = 'rgba(255,255,255,0.25)';

// ---- Hidden treasures and hiding places (guide 3g, 7e, provisional) -------
// Every value in this section is derived (provisional). Cue objects (Dash pot,
// dash-needed bubble, hint star) keep opaque ink and opaque partner fills.
/** Dash pot body, provisional. 9.07:1 with ink, so ink or fill is 3.01:1 or better on any background. */
export const DASH_POT = '#efc5aa';
/** Dash pot rim, provisional. 11.45:1 with ink. */
export const DASH_POT_RIM = '#f9e1d0';
/** Dash pot cracks, provisional. Internal detail lines, never ink. */
export const DASH_POT_CRACK = SOIL_DETAIL;
/** Dash pot shine, provisional. */
export const DASH_POT_SHINE = 'rgba(255,255,255,0.75)';
/** Hint star fill, provisional. White with ink: 14.39:1, 3.79:1 or better on any background. */
export const HINT_STAR_FILL = WHITE;
/** Dash-needed bubble fill, provisional. White with ink: 14.39:1. Never red. */
export const DASH_BUBBLE_FILL = WHITE;
/** Small cave rocks, provisional. Scenery: ink on them is 5.87:1 and 7.62:1. Cool and bigger than the burrow stones. */
export const CAVE_ROCK_A = PEBBLE_D;
export const CAVE_ROCK_B = PEBBLE_B;
/**
 * Small cave interior, provisional. A deep water tone darker than water deep
 * #0a5c98: 5.29:1 against bed top, 3.08:1 against bed bottom, 2.44:1 against
 * water deep. Cooler and bluer than the burrow opening, which is the eye colour.
 */
export const CAVE_INTERIOR = '#031d33';
/** Past-the-current marker stone, provisional. 10.70:1 with ink. */
export const MARKER_STONE = PEBBLE_C;
/** Past-the-current marker carving, provisional. Internal detail line, never ink. */
export const MARKER_CARVE = PEBBLE_E;

// ---- Mobile snacks: tadpole and freshwater shrimp (guide 3g and 7b, provisional) ----
// Every value in this section is derived (provisional). Both are cue objects with an opaque ink
// outline, so each outer fill keeps 3:1 or better against ink. They are told apart from the worm,
// the bug and the plastic worm by shape first (see drawMobileSnacks.ts) and by value second.
/**
 * Tadpole body and head: a dark olive brown, luminance 0.1741, 3.07:1 with ink and 3.72:1 with the
 * eye bead. Much darker than the earthworm snack (#e0b095, 0.4907) and the bug shell, so it reads
 * as a dark round blob by value alone.
 */
export const TADPOLE_BODY = '#86723a';
/** Tadpole belly patch: a pale sand, luminance 0.6713, 9.89:1 with ink and 3.22:1 lighter than the body. Inside the silhouette, never an edge. */
export const TADPOLE_BELLY = '#e4d6a0';
/** Tadpole tail fin: a lighter olive tan, luminance 0.3912, 6.05:1 with ink. It reaches the outer edge. */
export const TADPOLE_FIN = '#b8a864';
/**
 * Shrimp body and head: a pale blue grey, luminance 0.6685, 9.85:1 with ink. A cool, light tone,
 * 1.32:1 lighter than the earthworm snack and far lighter than the tadpole.
 */
export const SHRIMP_BODY = '#c4d9e2';
/** Shrimp tail fan: lighter than the body, luminance 0.7639, 11.16:1 with ink. It reaches the outer edge. */
export const SHRIMP_FIN = '#d6e5ec';
/** Shrimp soft bands across the body. See-through and inside the silhouette, so alpha is allowed; never ink. */
export const SHRIMP_BAND = 'rgba(70,110,140,0.35)';
