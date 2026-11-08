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
 * `trajineraShadow` (a gliding trajinera's leading shadow, issue #78, ND-8) sits just above the haze
 * and below `hyacinthMat`: the see-through warning on the water is never hazed, and every cue object,
 * the boat's own hull included, draws over it. `trajineraHull` (the gliding trajinera's hull, issue
 * #78, ND-8) shares `movingHazard`'s band, as the punting pole's bow is the same kind of boat: in
 * front of the tilapia and the black bass, behind the heron stab, the halo and the axolotl, so a
 * pushed axolotl is never hidden by the boat. The surface and the pads draw over its rail at the
 * water line. Its push ripple uses `fx`. The black bass reuses `tilapia`.
 * Area 9 (issue #107). `murkyCloud` (each murky patch's cloud and its dotted outline, ND-1) sits just
 * above collectibles and below `darkWater` and every predator, moving hazard, the halo and the axolotl:
 * the see-through cloud tints the scenery and the snacks in a patch, and every threat, its warning and
 * the axolotl draw over it. The exit's gate and sign keep their `homeSpot` and `homeRing` depths, under
 * the cloud; the cloud's densest place keeps ink at 3:1 or better, so the exit reads through it. The
 * dim ring reuses `halo`, the ring meter `fx`, the warning's cheek tint `queasyTint` and its little
 * bubbles `bubbles`. `bailingBoat` (a moored bailing boat's hull, ND-2) and `bailingShadow` (the
 * bucket's warning shadow) share the moving hazard band: in front of the tilapia and the black bass,
 * behind the heron stab, the halo and the axolotl. `bailingBucket` (the whole bucket on its rope) shares
 * `halo`'s value: in front of the boat, behind the axolotl, so a peeking axolotl shows over the back of
 * the rim. `bailingBucketFront` (the bucket's front wall and rim) sits over `queasyTint` and under
 * bubbles, so the front wall covers a peeking axolotl and both cheek tints. The ripples and the landing
 * splash use `fx`.
 * Area 10 (issue #108, guide 7p). `fishingBoat` (a fishing trajinera's hull and its rods, ND-1) and
 * `fishingShadow` (its always-shown shadow) share the moving hazard band: in front of the tilapia and
 * the black bass, behind the heron stab, the halo and the axolotl; the scene adds the shadow first,
 * then the hull, then the rods. `fishingLure` (a lure's line, float bead and lure) sits above
 * collectibles, the murky cloud, the dark layer, the glow-plants and the rock, and below every
 * predator, the moving hazard band, the halo and the axolotl. `dragNetBoat` (a drag net's two boats,
 * ND-2) shares the moving hazard band. `dragNetMesh` (a stretch's hollow shades and then its mesh
 * curtain) sits just above collectibles and below the murky cloud, every predator, the halo and the
 * axolotl, so the axolotl is always drawn in front of the net. `dragNetFloats` (the float line and its
 * floats, lit or not) sits just above the surface, so the surface line never cuts them, and below the
 * pads. The wriggle-out strands use `fx`.
 * Area 11 (issue #112). The cormorant reuses the heron's depths: `heronBody` while it floats, warns
 * and dries, so every cue object draws over it, and `heronStab` while it dives, so it is in front of
 * the tilapia and behind the halo and the axolotl. Its dive trail bubbles use `bubbles`. `petals`
 * (the golden-hour drifting petals) sits between bg and haze, above the reeds and the cave front:
 * hazed scenery, below every cue object.
 * Area 12 (issue #211). The pelican line takes the heron's two bands, with values of its own, as no
 * other layer shares `heronBody` or `heronStab`: `pelicanBody` (the floating body, neck and head at
 * the water line, and the body of the scoop and the rise) sits just over `heronBody`, above the haze
 * and under `homeSpot`, so every cue object draws over it; `pelicanBill` (the dipped head and bill,
 * and the neck piece joining it to the body) sits just over `heronStab`, in front of the tilapia and
 * the moving hazard band and behind the halo and the axolotl, so the bill is never drawn over the
 * hero. `pelicanSplash` (the scoop splash at the water line) and `windRipple` (the surface ripple
 * arcs of the warning) sit just above the surface line and the drag net floats, below the pads. `windStreak` (the gust streaks and
 * their chevrons) sits just over the fishing lure and below the tilapia: a see-through cue above the
 * scenery and the snacks, behind every predator, moving hazard, the halo and the axolotl, so a streak
 * never hides the hero.
 * Area 14 (issue #213). `driftingIsland` (the drifting reed mat's two halves, with its reeds and trailing
 * roots) sits just under `pelicanBody`, above the haze, the mats and the heron body: scenery that moves, so
 * what is drawn is what carries, and every pelican, cue object, predator and the axolotl draw in front of
 * it, so the axolotl is always over the roots. `litter` (the sharp can and bottle on the pit floors) sits
 * just over `glowPlant`, above the dark layer and the fading lights, and under the rock, the tilapia and
 * every predator and the axolotl: the darkness never hides a hazard, and its pale rim reads in the dark.
 * Full order: bg < caveBack < hiddenTreasure < reeds < caveFront = currentMarker < petals
 * < haze < trajineraShadow < hyacinthMat < heronBody < driftingIsland < pelicanBody < homeSpot < homeRing < treasureGlow < treasure < pulsingCurrent
 * < collectibles < dragNetMesh < murkyCloud < darkWater < glowPlant < litter < rock < fishingLure < windStreak < tilapia
 * < movingHazard = trajineraHull = bailingBoat = bailingShadow = fishingBoat = fishingShadow = dragNetBoat
 * < heronStab < pelicanBill < halo = bailingBucket < friend < axolotl < queasyTint < bailingBucketFront
 * < bubbles < surface < dragNetFloats < pelicanSplash = windRipple < pads < fireflies < hint < fx < ui.
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
  /** Provisional. Golden-hour drifting petals: hazed scenery between bg and haze, above the reeds and the cave front. */
  petals: 15,
  haze: 20,
  /** Provisional. Gliding trajinera's leading shadow: above the haze, below the mats and every cue object. */
  trajineraShadow: 21,
  /** Provisional. Water hyacinth mats: above the haze, below the heron body and every cue object. */
  hyacinthMat: 22,
  /** Provisional. Wading heron body, legs, and rest, watch and warn head and neck: above the haze, below every cue object. */
  heronBody: 23,
  /** Provisional. Drifting island halves, reeds and roots: just under the pelican body, above the haze and the heron body, below every cue object and the axolotl. */
  driftingIsland: 23.2,
  /** Provisional. Pelican body, neck and head at the water line: just over the heron body, above the haze, below every cue object. */
  pelicanBody: 23.5,
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
  /** Provisional. Drag net hollow shades and mesh curtain: above collectibles, below the murky cloud, every predator, the halo and the axolotl. */
  dragNetMesh: 30.5,
  /** Provisional. Murky patch cloud and dotted outline: above collectibles, below the dark layer, every predator and the axolotl. */
  murkyCloud: 31,
  /** Provisional. The dark layer over an area's dark part: above collectibles, below the glow-plants and the tilapia. */
  darkWater: 32,
  /** Provisional. Glow-plants and their hint: just above the dark layer, below the tilapia. */
  glowPlant: 33,
  /** Provisional. Sharp litter on the pit floors: just over the glow-plants and the fading lights, above the dark layer, below the rock, the tilapia and the axolotl. */
  litter: 33.5,
  /** Provisional. Solid rock walls and the pebble: above the glow-plants, below the tilapia. */
  rock: 34,
  /** Provisional. Fishing lure, its line and float bead: above collectibles and the rock, below every predator, the halo and the axolotl. */
  fishingLure: 34.5,
  /** Provisional. Wind gust streaks and chevrons: above the fishing lure, below every predator, the halo and the axolotl. */
  windStreak: 34.6,
  /** Provisional. Predator: behind the axolotl, in front of collectibles. */
  tilapia: 35,
  /** Provisional. Moving hazard shadow, shaft and bow: in front of the tilapia, behind the heron stab, the halo and the axolotl. */
  movingHazard: 36,
  /** Provisional. Gliding trajinera hull: the moving hazard band, behind the heron stab, the halo and the axolotl. */
  trajineraHull: 36,
  /** Provisional. Moored bailing boat hull: the moving hazard band, behind the heron stab, the halo and the axolotl. */
  bailingBoat: 36,
  /** Provisional. Bailing bucket's warning shadow: the moving hazard band, behind the halo and the axolotl. */
  bailingShadow: 36,
  /** Provisional. Fishing trajinera hull and rods: the moving hazard band, behind the heron stab, the halo and the axolotl. */
  fishingBoat: 36,
  /** Provisional. Fishing trajinera's always-shown shadow: the moving hazard band, under its hull. */
  fishingShadow: 36,
  /** Provisional. Drag net boats: the moving hazard band, behind the heron stab, the halo and the axolotl. */
  dragNetBoat: 36,
  /** Provisional. Wading heron stab head and neck piece: in front of the tilapia, behind the halo and the axolotl. */
  heronStab: 37,
  /** Provisional. Pelican dipped head, bill and neck piece: just over the heron stab, behind the halo and the axolotl. */
  pelicanBill: 37.5,
  /** Provisional. Protected halo: behind the axolotl, in front of the tilapia. */
  halo: 38,
  /** Provisional. Whole bailing bucket on its rope: in front of the boat, behind the axolotl. */
  bailingBucket: 38,
  /** Provisional. Stranded axolotl: behind the axolotl, in front of the halo. */
  friend: 39,
  axolotl: 40,
  /** Provisional. Green cheek tint of a queasy axolotl: over the axolotl, under bubbles. */
  queasyTint: 41,
  /** Provisional. Bailing bucket's front wall and rim, over a peeking axolotl and its cheek tints: under bubbles. */
  bailingBucketFront: 42,
  bubbles: 50,
  surface: 60,
  /** Provisional. Drag net float line and floats, lit or not: above the surface, below the pads. */
  dragNetFloats: 61,
  /** Provisional. Pelican scoop splash at the water line: above the drag net floats, below the pads. */
  pelicanSplash: 62,
  /** Provisional. Wind surface ripple arcs of the warning: above the drag net floats, below the pads. */
  windRipple: 62,
  pads: 70,
  /** Provisional. Pond fireflies above the water band: above pads, below hint. */
  fireflies: 72,
  /** Provisional. Hint stars: above pads and reeds, below fx. */
  hint: 75,
  fx: 80,
  ui: 100,
} as const;

export type DepthKey = keyof typeof DEPTH;
