# ADR 0046: Twin trenches, sharp litter and drifting islands

- Status: Accepted
- Date: 2026-11-07
- Amends: [ADR 0042](0042-pelican-line-and-wind-and-waves.md) (in part: a pelican whose scoop would meet a drifting island does not dip that scoop, and the trip finds scoop hits through the shelter rule; every other ADR 0042 rule stays in force, and an area without islands plays exactly as before), [ADR 0028](0028-descent-areas-crayfish-and-dark-water.md) (in part: the parts the darkness never hides gain every fixed hazard; every other ADR 0028 rule stays in force)
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the litter gentle and the pelican from catching), [ADR 0008](0008-gentle-fail-state.md) (the gentle fail state, which a litter touch goes through like any hit), [ADR 0012](0012-save-on-device.md) (the new ids under its additive rule), [ADR 0013](0013-axolotl-rig-and-frame-budget.md) (the frame budget), [ADR 0014](0014-area-framework.md) (the area framework and the rule of at most one new thing per area), [ADR 0015](0015-multi-area-catalogue-and-slow-only-hazards.md) (hazard types, slow-only or leg-costing), [ADR 0016](0016-heron-timer-warnings-and-area-look-variants.md) (area look variants, which the late look is), [ADR 0020](0020-u-turn-areas-garter-snake-and-hyacinth-mats.md) (the water hyacinth mats, which block and push, unlike an island), [ADR 0022](0022-danger-pass-phase-2-seam-amendments.md) (living docs name no area), [ADR 0039](0039-cormorant-dive-arc-and-golden-hour-area-look.md) (the iOS Safari memory fix and textures baked at boot), [ADR 0041](0041-stepped-lake-areas-depth-bands-and-banded-danger-rules.md) (stepped, depth-banded lake areas and the banded danger rules), [ADR 0043](0043-trench-area-mud-turtle-and-fading-lights.md) (the trench, the mud turtle, the fading light and the dark layer's recorded residual), [ADR 0045](0045-fact-card-sources-live-in-the-prd.md) (fact card sources live only in the PRD)

This ADR records the build choices for issue #213, the open lake's Area 14: its twin trenches, its one new hazard, sharp litter, and its one new timing element, the drifting island. The owner took the planner's recommendation on all five questions of #213 (Q1 to Q5), then amended Q2's litter spacing, and those answers are final. The owner's direction for the open lake is on #209. The named defaults (ND-1 to ND-12 on #213), the tuning values and the layout calls made during the build are provisional until the owner reviews them on the PR.

## Context

Area 13 ([ADR 0043](0043-trench-area-mud-turtle-and-fading-lights.md)) has one trench. Area 14 has two, either side of a ridge, so the main path goes out and back on both sides before it ends on a pit floor.

Two gaps in the shared rules blocked the area as planned:

- **A hazard that lies still and costs a leg.** Every hazard so far that costs a leg on touch moves (a **Moving hazard**, a trajinera lure on its line) or is a predator. The slow-only hazards ([ADR 0015](0015-multi-area-catalogue-and-slow-only-hazards.md)) lie still but never cost a leg. A can or bottle on a pit floor is still and costs a leg.
- **Fixed hazards in the dark.** The parts the darkness never hides ([ADR 0028](0028-descent-areas-crayfish-and-dark-water.md), `DARK_SHOWN_PARTS`) name every predator and every moving hazard, but not a fixed one. A leg-costing hazard hidden in pitch-black water breaks the telegraph rule (PRD A2): the player could not see it before touching it.

The pelican line ([ADR 0042](0042-pelican-line-and-wind-and-waves.md)) is dodged by diving under the dip or slipping between two bills. The lake needed a timing element of its own after the wind and waves, and a moving shelter at the surface gives the player a third way past the line.

Litter in Xochimilco's water is real, and the owner chose a fact card for it (Q5), "Litter in the water". Its sources, check date and owner checks live only in its paragraph in PRD C13, per [ADR 0045](0045-fact-card-sources-live-in-the-prd.md). The drifting island is a tule raft of the kind the Valley of Mexico lakes had; it has no fact card.

## Decision

**The twin trenches are plain area data on the existing collision (`src/logic/openLake3Layout.ts`, Q4, ND-1).** Area 14 (`'open-lake-3'`) is 9 x 3 screens, `depthBanded`, in five segments west to east: west shallows 2 x 1, west pit 2 x 3, the ridge 1 x 1, east pit 2 x 3, east shallows 2 x 1. Seven `RockWall` rectangles build stepped rock: each pit steps down on its outer side, a ledge under band 2 and a terrace step at the foot of the pit, and is sheer on the ridge side.

- **Start and exit.** The Home Spot and its safe area sit on the ridge between the pits. The exit is on the far (east) pit floor, in the dark, east of its mud turtle, with its gate clear of the east terrace step (the ADR 0043 gate check).
- **The main path is no left-to-right run.** West across the west pit in band 2 to the west shallows beds and back, down to the west ledge, back over the ridge, east across the east pit, up past the east terrace step and over the east ledge to the east shallows beds and back, then down into the east pit to the exit.
- **Dark water (ND-3).** One `darkWater` rectangle covers band 3 from the west ledge to the east ledge, both pits and the ridge rock between them, from y 720 to the bed, the same size as Area 13's. It keeps every ADR 0028 and ADR 0043 dark rule, drawn in `LAKE_DARK`. Two fading lights light each pit.
- **The look (ND-2).** Area 14 uses the open lake's late-afternoon variant (`'open-lake-late'`, `OPEN_LAKE_LATE_LOOK` in `src/art/habitatLook.ts`): a warm sky with a peach horizon, warm, longer-slanted rays and ordinary clouds. Its `pitShafts` flag paints long lighten-only shafts of light into band 2 of the pits (`paintPitShafts` in `src/art/drawLake.ts`), faded to nothing by y 720, so band 3 stays pitch black. Every other look sets `pitShafts` false. It is a day look and plays the open lake's cue, Lagoon Breeze, in its day version. It has no wind and waves.
- **Predators one ladder step up (ND-7).** The tilapia, carp, cormorants, mud turtles and pelican lines are each one step up the predator ladder from Area 13, with the ADR 0041 band rule by band. The tuned values are the `OPEN_LAKE_3_*` exports in the layout file.

**Sharp litter is a fixed hazard that costs a leg (`SHARP_LITTER` and `litterSpawn` in `src/logic/litter.ts`, Q2, ND-4).** It is `'sharp-litter'`, Area 14's one new hazard, a `HazardType` in `hazards` with a kind, `'can'` (a dented can) or `'bottle'` (a bottle with a chipped neck).

- **The touch.** It never moves and never pushes. A body centre within its touch reach, 18 px past its 10 px circle (the ghost net's and the pelican line's reach), costs one leg through the shared hit path ([ADR 0008](0008-gentle-fail-state.md)), from the litter's centre: the Shell perk can block it and protected time follows.
- **The shared rules see it.** As a leg-costing hazard type it is a threat for hiding spots (B10, `zoneThreats`), and the snacks keep their hazard clearance from it. It is not a moving hazard and not a danger part, so the danger bar never counts it as a moving threat.
- **Placement (Q2 as amended).** Area 14 has four, all in the pits: in each pit one can and one bottle on the pit floor in band 3, each 64 to 115 px from its Legendary spot, and none outside the pits. The owner's amendment widened Q2's first 60 to 100 px: the shared hiding rules put a pit Legendary within the mud turtle's snap reach and at least 60 px from any route turn point, and with litter kept 64 px clear of the turtle's crawl path, the closest spacing that fits is about 105 to 111 px.
- **Kid-safe look (ADR 0007).** Round corners, smooth dents and one rounded chip: no shard, spike, jagged edge, red or face. "Sharp" is the rule, shown by the shared leg-loss poof, never the look. A pale rim holds its edge on near-black water. It draws at `DEPTH.litter`, over the dark layer and the lights, under the predators and the axolotl.
- **Fact card (Q5).** "Litter in the water" (`SHARP_LITTER_FACT`) is met within 120 px of a piece's edge (`SHARP_LITTER_MEET_RANGE`, the lure's), outside the Home Spot. Its sources and owner checks are in PRD C13 only.

**Fixed hazards are never hidden by the darkness (`DARK_SHOWN_PARTS` in `src/logic/glowPlants.ts`, ND-4).** This amends ADR 0028 in part. The `DarkWaterPart` list gains `'hazard'`, and `DARK_SHOWN_PARTS` gains it, so a fixed hazard such as sharp litter shows in the dark as a predator or a moving hazard does. The darkness still hides only scenery, snacks, treasure spots, their hint sparkles and finds.

**The drifting island is a timing element that shelters from the pelican line only (`src/logic/driftingIslands.ts`, Q3, ND-5, ND-6).** It is `'drifting-island'`, Area 14's one new timing element, built with `driftingIslandSpawn`: always active, never met, with no fact card and no sweep.

- **The drift.** A tule reed mat 240 px wide (`DRIFTING_ISLANDS`) drifts back and forth at the surface along its own path at 16 px/s, turning at once at each end. Its offset sets where in its drift it starts, so neighbouring islands are out of step. Area 14 has two, one under each pelican line, each on a 1200 px path.
- **The shelter.** A pelican whose scoop box would overlap an island, edges included, at any moment of that scoop, from the start of the plunge to the end of the rise, does not dip that scoop (`pelicanBirdSheltered`). The answer is decided once per scoop: through the glide and the warning it is the coming scoop's, and it holds for the whole cycle, so a bird never dips partway. A sheltered bird holds its warning pose through the plunge, hold and rise, with no neck, bill or splash, and its warning ripple still sounds, since the sound reads the line's phase (ND-6). Other birds of the same line dip as usual.
- **Shelter from the pelican line only.** An island is no shelter from the cormorant, the fish or any other predator, and no cover for the hiding rules. It never slows, blocks, pushes or drags the axolotl, never costs a leg and is never a hit. It is not a reed patch, and unlike the water hyacinth mats of [ADR 0020](0020-u-turn-areas-garter-snake-and-hyacinth-mats.md) it never closes a way or pushes anything out.
- **Reduced motion.** The drift is gameplay, so it carries on; the island's bob on the water line stops.
- **Drawing (ND-5).** The island draws at `DEPTH.driftingIsland`, just under the pelicans, so a pelican over it draws in front, and the axolotl always draws over its roots.

**The shelter lives in the islands module, and an area without islands takes the old path (ND-6).** This amends ADR 0042 in part. The trip's pelican step finds a scoop hit with `shelteredScoopHit`, which skips a sheltered bird. With no islands it returns exactly what `pelicanScoopHit` returns, and `pelicanLine.ts` is unchanged, so Areas 12 and 13 play exactly as before. Every other ADR 0042 rule holds: one hit per scoop per line, the push away from the bill, and never a catch or a hold.

**Layout calls made during the build.** These are the planner's and the builder's, not the owner's, and are provisional:

- **Pelican line 2 and island 2 sit over the east ledge and shallows, not the east pit.** With the line over the east pit, the one-leg run had no passing start. For the same reason the main path crosses the east pit low, in band 3 at y 800, before it climbs to the east shallows.
- **The east terrace step is narrowed to x 2960 to 3040, and the east ledge widened to x 3040 to 3360,** to fit the east ledge's Rare spots. The west side keeps its first widths, so the pits are not mirror images.

**Treasure until #216 (Q1).** Area 14 shares Area 10's whole set (`OPEN_LAKE_3_SHARED_TREASURES`, which is `DEEP_CANAL_3_TREASURES`). Its special treasure is the Refuge snow globe, Legendary, on the deepest spot of the east pit floor in band 3, as ADR 0043 allows in a deep-banded area. The slot count lives in Area 14's registration in `src/logic/areas.ts` and is checked in `src/logic/openLake3Area.test.ts`, which also holds the shared-treasure session test (ND-9).

**The one-leg run is pinned in its window.** A one-leg axolotl swims the main path from the Home Spot to the exit in under the 180 s limit, leaving at a pinned element time, with no cormorant or mud turtle warning and no litter touched. Every scoop is timed as if no island sheltered it, so the run holds wherever the islands are in their drift. The window, the pin and the run time live in `src/logic/openLake3Fairness.test.ts` (`ONE_LEG_RUN`). As in ADR 0043, a later shared tuning change re-measures the window and pins the start inside it again; it never loosens the run to fit.

## Consequences

- A later area can place sharp litter in `hazards` with `litterSpawn` and drifting islands in `elements` with `driftingIslandSpawn`. A later fixed hazard of any type shows in the dark.
- Areas 1 to 13 and the spring cave have no litter and no island. Their pelican scoops take the identical `pelicanScoopHit` path, so they build, play and bake as before.
- The ids `'open-lake-3'`, `'sharp-litter'`, `'drifting-island'` and the litter, island, light and line ids of Area 14 are fixed for good (ADR 0012). The save format is unchanged: the met list only gains `'sharp-litter'`, and island drift is never saved.
- A pelican line's danger now depends on the islands in its area. A later change to the scoop timing, box or the island width or speed changes which scoops are sheltered, and must re-run the area's fairness and danger tests.
- The layout, litter, island, look and band values are provisional. The owner can tune or reverse them on the PR, as tuning, area data or art.

Recorded residuals:

- **The one-leg run's start window is narrow.** As measured, every start from 1.85 s to 2.00 s of element time passes. Root cause: the run is a long out-and-back swim past two pelican lines on one shared cycle, two cormorants and two mud turtles, and every scoop is timed as if no island sheltered it, so the islands cannot widen the window. Bounded: the start is pinned mid-window and measured in its own test, so a change that closes the window fails that test, and an island only ever takes a scoop away, so the run holds at every point of the islands' drift. Ground: the same accepted pattern as Area 13's (ADR 0043, Q4). Not changed: widening the window by moving threats off the main path, which would thin the danger the predator ladder asks for.
- **The dark layer is the same size as Area 13's.** Area 14's dark water is 2400 x 318 px, as Area 13's, so the ADR 0043 residual holds unchanged: one render texture of about 3.1 MB, redrawn when a light changes while the view meets the dark water, with up to four fading lights. The owner's on-device frame-time check (PRD open question 524) covers it with Area 13's. A measured frame time over budget promotes this to a filed issue.
- **Extra textures are baked at boot.** The litter's two kinds and the island's half mat are baked with the lake textures at boot, under the texture budget of [ADR 0039](0039-cormorant-dive-arc-and-golden-hour-area-look.md) and [ADR 0041](0041-stepped-lake-areas-depth-bands-and-banded-danger-rules.md). They are small sprites, not scenery chunks, so the iOS Safari memory fix holds. The pit shafts are painted into the on-demand scenery chunks, so they add no texture.
- **The island's bob values are provisional art.** The bob's height, period and phase step in `src/scenes/DriftingIslandView.ts` are the builder's guess, not tuned on a device, and are cosmetic: the drift and the shelter never read them.

## Alternatives considered

| Option | Why not |
|---|---|
| Sharp litter as a slow-only hazard, like the plastic worm | The owner chose a leg cost (Q2). A slow-only piece of litter would read as harmless, and the card says sharp edges can hurt animals. |
| Litter that pushes the axolotl away, like a pelican scoop | The owner chose no push (Q2): one hit through the shared path is the gentle fail state. |
| Light each piece of litter with its own light hole in the dark layer | A missed hole would hide a hazard. Drawing every fixed hazard over the dark layer makes "never hidden" hold by depth, as ADR 0028 does for predators. |
| Litter outside the pits | The owner put every piece on a pit floor (Q2), by the Legendary spots, so the risk sits with the reward. |
| An island that hides the axolotl from every surface threat | The owner chose shelter from the pelican line only (Q3). Cover from the cormorant or for the hiding rules would make the island a reed patch on the move and change who can see the axolotl and where treasure may hide. |
| An island that blocks or pushes, like a hyacinth mat | The hyacinth mats already block and push (ADR 0020). The owner chose an island that never slows, blocks or pushes (Q3), so it is only a place to be under. |
| Decide the shelter frame by frame | A bird whose scoop started dipping could stop halfway as an island drifted off, or start dipping onto the axolotl partway through. Deciding once per scoop means a bird either dips the whole scoop or none of it, and the warning shows which. |
| Put the shelter rule in `pelicanLine.ts` | The pelican line module would need to know about islands. Keeping the rule in `driftingIslands.ts` leaves `pelicanLine.ts` unchanged and Areas 12 and 13 on their exact old path (ND-6). |
| Pelican line 2 over the east pit, with the main path crossing it in band 2 | The one-leg run found no passing start. |
| Mirror the west pit's ledge and terrace widths on the east | The east ledge's Rare spots did not fit on a ledge that narrow. |
| A separate dark-water rectangle for each pit | Area data holds one `darkWater` rectangle, so two would need a new field and a second render texture. One rectangle the size of Area 13's keeps the ADR 0043 residual as recorded (ND-3). |
