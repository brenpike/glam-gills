/**
 * Draw order (guide section 5, depth by layer). Higher draws in front.
 * Order: bg < reeds < haze < collectibles < axolotl < bubbles < surface < pads < fx.
 * Haze is never drawn over the axolotl. `ui` sits above everything in the world.
 * Provisional additions: `tilapia` sits between collectibles and the axolotl, so the
 * hero is never hidden by the predator; `halo` sits just under the axolotl.
 * `homeSpot` (burrow and flag) and `homeRing` (safe-ring dots) sit above haze, so
 * these cue objects are never hazed, and below collectibles, so finds and the
 * axolotl draw in front. The ring draws over the burrow so the edge stays whole.
 * Hiding places (guide 7e, provisional): `caveBack` (cave interior) and
 * `hiddenTreasure` (treasure icons under cover) sit behind everything hidden, so
 * reeds, the cave front and pads cover them on purpose and the haze tints them.
 * `caveFront` (cave rocks) and `currentMarker` share the reeds' hazed scenery
 * band. `treasure` (Dash pots, and treasures revealed by a crumble) is a cue
 * object: above the haze, below collectibles. `treasureGlow` (the rarity glow
 * behind a revealed treasure and its pickup pop) sits just under `treasure`,
 * above `homeRing`; a hidden treasure never gets one. `hint` (hint stars) draws above
 * pads and reeds, below fx. The dash-needed bubble and crumble shards use fx.
 * `friend` (the stranded axolotl, waiting or following) sits between the halo
 * and the axolotl, so the hero always draws in front; its lost bubble uses fx.
 * `queasyTint` (the green cheek tint of a queasy axolotl, issue #75) sits just over
 * the axolotl so it tints the cheeks and is never hidden by the hero, and under
 * bubbles. It is a soft see-through fill, not a cue object, so it never covers an
 * outline the pair rule relies on.
 * `fireflies` (the pond's dusk fireflies above the water band) sit above pads, below hint.
 * The wading heron (issues #98 and #111) has two depths. `heronBody` (the body, legs, and
 * the rest, watch and warn head and neck) sits just above the haze and below `homeSpot`, so
 * every cue object (Dash pots, treasures, snacks, plastic worms, the tilapia, the axolotl)
 * draws over it; the surface and the pads draw over its legs at the water line. `heronStab`
 * (the stab head and its neck piece) sits between the tilapia and the halo, so it is in front
 * of the tilapia and behind the halo and the axolotl. Neither equals `queasyTint` or
 * `treasureGlow`.
 * `hyacinthMat` (the water hyacinth mats, issue #103) sits just above the haze and below
 * `heronBody`: what is drawn is what blocks, so the mats are never hazed, and every cue object
 * (the garter snake, snacks, treasures, the axolotl) draws in front of them. The garter snake
 * reuses `tilapia` and its ripple rings use `fx`. The common carp (issue #117) reuses `tilapia` too,
 * and its mud puff uses `fx`.
 * `movingHazard` (a moving hazard's boat shadow, shaft and bow, issue #117) sits just over the
 * tilapia and below `heronStab`: a cue object above the haze and every snack, behind the halo and the
 * axolotl, so the pole is never drawn over the hero. The surface and the pads draw over the bow's
 * hull at the water line. Its ripple ring uses `fx`.
 * `darkWater` (the one dark layer over an area's dark part, issue #77, ND-7) sits above
 * collectibles and below the tilapia: scenery, treasure spots and snacks under it are hidden
 * outside its light holes, and every predator, moving hazard, the halo, a stranded axolotl and the
 * axolotl draw over it. The exit (`homeSpot`) is under it, so the exit's faint glow cuts a light
 * hole over it. Hint sparkles (`hint`) are above it and are hidden by the game rules, not by depth.
 * `glowPlant` (the glow-plants and their hint, issue #77, ND-8) sits just over `darkWater`, so the
 * darkness never hides a plant, and below the tilapia.
 * `pulsingCurrent` (a pulsing vent's mouth, its warning bubbles, its surge streaks and its surging
 * band, issue #105, ND-7) sits just above treasures and below collectibles: a cue object above the
 * haze, and snacks never sit in a band. `rock` (the solid rock walls and the pebble, issue #105,
 * ND-8) sits above the glow-plants and below the tilapia: what is drawn is what blocks, so snacks,
 * treasure spots and the dark layer are behind it, and every predator and the axolotl draw in front.
 * Full order: bg < caveBack < hiddenTreasure < reeds < caveFront = currentMarker
 * < haze < hyacinthMat < heronBody < homeSpot < homeRing < treasureGlow < treasure < pulsingCurrent
 * < collectibles < darkWater < glowPlant < rock < tilapia < movingHazard < heronStab < halo < friend < axolotl < queasyTint
 * < bubbles < surface < pads < fireflies < hint < fx < ui.
 */
export const DEPTH = {
  bg: 0,
  /** Provisional. Small cave interior, behind everything hidden. */
  caveBack: 8,
  /** Provisional. Treasure icons under cover (reeds, pads, cave front). Deliberately hidden. */
  hiddenTreasure: 9,
  reeds: 10,
  /** Provisional. Small cave rocks (hazed scenery). */
  caveFront: 12,
  /** Provisional. Past-the-current carved stone marker (hazed scenery). */
  currentMarker: 12,
  haze: 20,
  /** Provisional. Water hyacinth mats: above the haze, below the heron body and every cue object. */
  hyacinthMat: 22,
  /** Provisional. Wading heron body, legs, and rest, watch and warn head and neck: above the haze, below every cue object. */
  heronBody: 23,
  /** Provisional. Home Spot burrow and marker flag. */
  homeSpot: 24,
  /** Provisional. Home Spot safe-ring dots. */
  homeRing: 26,
  /** Provisional. Rarity glow behind a revealed treasure and its pickup pop. Never used for a hidden treasure. */
  treasureGlow: 27,
  /** Provisional. Dash pots and treasures revealed by a crumble: cue objects above the haze. */
  treasure: 28,
  /** Provisional. A pulsing vent's mouth, bubbles, streaks and surging band: above treasures, below collectibles. */
  pulsingCurrent: 29,
  collectibles: 30,
  /** Provisional. The dark layer over an area's dark part: above collectibles, below the glow-plants and the tilapia. */
  darkWater: 32,
  /** Provisional. Glow-plants and their hint: just above the dark layer, below the tilapia. */
  glowPlant: 33,
  /** Provisional. Solid rock walls and the pebble: above the glow-plants, below the tilapia. */
  rock: 34,
  /** Provisional. Predator: behind the axolotl, in front of collectibles. */
  tilapia: 35,
  /** Provisional. Moving hazard shadow, shaft and bow: in front of the tilapia, behind the heron stab, the halo and the axolotl. */
  movingHazard: 36,
  /** Provisional. Wading heron stab head and neck piece: in front of the tilapia, behind the halo and the axolotl. */
  heronStab: 37,
  /** Provisional. Protected halo: behind the axolotl, in front of the tilapia. */
  halo: 38,
  /** Provisional. Stranded axolotl: behind the axolotl, in front of the halo. */
  friend: 39,
  axolotl: 40,
  /** Provisional. Green cheek tint of a queasy axolotl: over the axolotl, under bubbles. */
  queasyTint: 41,
  bubbles: 50,
  surface: 60,
  pads: 70,
  /** Provisional. Pond fireflies above the water band: above pads, below hint. */
  fireflies: 72,
  /** Provisional. Hint stars: above pads and reeds, below fx. */
  hint: 75,
  fx: 80,
  ui: 100,
} as const;

export type DepthKey = keyof typeof DEPTH;
