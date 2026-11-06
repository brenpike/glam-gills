# ADR 0041: Stepped lake areas, depth bands and banded danger rules

- Status: Accepted
- Date: 2026-11-06
- Amends: [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (in part: the whole-water danger test, which in a depth-banded area counts only screens of water, runs its floor lane over the stepped floor and reads the depth rule by band; every other ADR 0023 rule stays in force, and every existing area's result is unchanged)
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the lake gentle), [ADR 0012](0012-save-on-device.md) (the new ids under its additive rule), [ADR 0013](0013-axolotl-rig-and-frame-budget.md) (the frame budget), [ADR 0014](0014-area-framework.md) (the area framework and the rule of at most one new thing per area), [ADR 0016](0016-heron-timer-warnings-and-area-look-variants.md) (area look variants, which the lake looks are), [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) (solid rock walls, which build the stepped floors), [ADR 0035](0035-deep-canal-moving-hazards-anchor-drop-and-mud-seep.md) (moving hazards and the danger bar they count in), [ADR 0039](0039-cormorant-dive-arc-and-golden-hour-area-look.md) (the iOS Safari memory fix of commit bbd5755 and on-demand scenery chunks), [ADR 0042](0042-pelican-line-and-wind-and-waves.md) (the pelican line and the wind and waves, Area 12's one new threat and its timing element)

This ADR records the build choices for issue #211, the open lake's Area 12: the first stepped, depth-banded area. The owner's direction on #209 (2026-11-05) is listed below, and it is final. The tuning values, the band rarity table and the named defaults in the code comments (ND-n) are provisional until the owner reviews them on the PR.

Owner direction on #209 (2026-11-05):

- Areas may be non-rectangular. A stepped floor is built from the existing solid rock walls, which are rectangles. Smooth sloped floors are deferred to #210.
- Each new habitat has 2 to 3 areas.
- The open lake is not like the deep canal: it is wide and open, with its own look, its own threat and its own timing element.

## Context

Every area so far is a rectangle of screens with a flat bed. The deep canal's later areas stack rows, but each row is open water to the bed. Rock walls ([ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md)) already stop the body and are plain rectangles in area data, so a floor made of several walls at different heights needs no new collision.

The treasure rules tie rarity to how hidden a spot is (B6, B10). A wide lake with no walls has no cave or hollow to hide a rare treasure in, so depth has to do that job: the deeper the water, the rarer the spot. The lake also needs a look that gets darker with depth, without the pitch black of the spring cave's dark water.

The danger bar and the ramp bar ([ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md)) are whole-water tests. Three of their rules assume a rectangle with a flat bed: the screen count (every screen is water), the floor lane (it runs on the bed), and the depth rule (three equal thirds of the water's height, issue #130). A stepped area breaks all three.

Boot used to bake every area's full-screen scenery chunks up front, which crashed iOS Safari on an iPhone 13 (commit bbd5755, #203). Scenery is now baked per area when a trip enters it. A lake bed painted as boot sprites would bring the crash back.

## Decision

**A stepped area is plain area data, and the collision did not change.** Area 12 is 9 x 2 screens, a bowl (`src/logic/openLakeLayout.ts`). Two shelves of solid rock fill columns 0 to 2 and 6 to 8 from y 318 down, and a small terrace step on each side of the deep middle starts at y 560. All four are existing `RockWall` rectangles, so the walls still block the body as every rock wall does. The Home Spot and its safe area sit in the middle shallows. The main path is no left-to-right run: it goes west across the left shelf and back, down through the bowl and up again, then east along the right shelf to the exit (PRD X9), whose gate sits on the shelf rock.

**Depth bands are opt-in, per area, and follow the screen rows (`src/logic/depthBand.ts`, ND-1).** An area sets `depthBanded: true`. Then each screen row is one band: band 1, the shallows, is the top row; band 2, the middle, is the next; band 3 and every row below it is the deep. A row's top edge belongs to its own band (`depthBandAt`). An area without the flag has no bands and plays as before.

- **Darkness per band is baked into the look's water colour, row by row.** The `open-lake` looks draw water by depth band (`depthBands` on the look, `LAKE_WATER_BANDS` in `src/art/drawLake.ts`). Band 1 is sunlit blue-green and band 2 a dusky blue, both lit and held to the luminance floor of the contrast rule, so the ink is 3:1 or better on them. Band 3 (dark indigo) and band 4 (near-black) are defined for later areas and are the recorded exceptions, never used by Area 12. A lower row starts on the deep colour of the band above it, so rows meet with no seam. Bands are told by value, never by hue alone.
- **The dark-water layer is kept for pitch black.** Banded darkness is a water colour only. It does not hide scenery, snacks or treasure. The existing dark-water rule (darkness hides scenery, snacks and treasure, never the axolotl, the exit, predators or hazards, and the player lights the way) is kept for the pitch black of Area 13 and later.

**Spot rarity follows the band (`bandRarities`, `spotFitsBand`, ND-2).** In a banded area a hiding spot's rarity must fit the band at its y: the shallows hold Common spots, the middle Rare spots, and the deep (band 3 and below) Epic and Legendary spots. Area 12 has two water rows, so it holds Common spots in the tule beds on the shelves by the main path, and Rare spots in tule beds on the terrace steps and the bowl floor, off the path. The area's special treasure sits only in the deepest band that holds swimmable water (`deepestWaterBand`, `raritySpotsInDeepestBand`): the band of the lowest screen row whose water the rock walls do not wholly cover. For Area 12 that is band 2. The treasure's rarity has at least one spot, and every spot of that rarity lies in that band.

**The pelican line is exempt from hiding risk and from snack keep-away (ND-7).** Pelican lines are their own area field, never in `hazards` or `elements`, so the risk ladder (B10) does not rate a spot by them, and the snack sweeps ignore them (`snackSweeps` in `src/logic/zone.ts`), so snacks do not keep away from a pelican. A spot's rarity comes from its band, so the line does not also rate it.

**The danger bar reads a stepped, banded area by water, not by rectangle (`src/logic/dangerBar.ts`, ND-8, ND-9).** The changes apply only when the area sets `depthBanded`; every other area keeps each rule as built, and every existing area's result is unchanged.

- **Water screens.** The screen count is the screens of water: a screen that the rock walls wholly cover is left out. Area 12's 18 screens give 12 water screens, since the shelves wholly cover 6.
- **The floor lane runs over the stepped floor.** Under each x the floor is the top of the rock walls stacked on the bed there (`floorTopAt`), else the bed, and the lane runs 22 px above it. Samples inside a rock wall or above the swim water are skipped. A pelican line's whole sweep, grown by its touch reach, counts as a threat point where its scoop reaches the floor.
- **The band depth rule replaces #130's thirds.** `meetsBandDepthRule` reads the bands that hold water (`waterDepthBands`). (a) Every band has its own moving threat, a route or a sweep that lies wholly in the band. (b) For each species the depth rule covers, in each band its loops reach into, the loops reach within `BAND_REACH` px of the band's top and of its bottom.
- **The pelican line fills the leg-costing moving-hazard slot.** Each bird of each line counts as one moving threat, a line's sweep counts toward the surface-band check and the band rule, and `legCostingMovingHazardTypeCount` adds one when the area has a pelican line, so Area 12 needs no anchor drop or mud seep.

**The lakebed is painted into on-demand scenery chunks, never boot sprites.** A look with `lakebed` receives its area's rock walls clipped to each chunk (`clipRectsToChunk`) and paints silt, stones, roots and a pale lip on every top edge there (`paintLakebed`, `src/art/drawLake.ts`; `src/art/textures.ts`). The chunks are the ones `SceneryCache` already bakes when a trip enters the area, so the iOS Safari memory fix of commit bbd5755 holds. The scene does not draw a lakebed rock wall a second time (`drawnWalls` in `SwimScene`), and the walls still block the body. The lip is a pale band, so a ledge reads as a terrace with a flat top in greyscale too. The bed has no letters, faces, points, worm or bug shapes, so nothing in it reads as a snack, a hint star, a hazard or a hiding place.

**Known limitation.** A rock wall that is continuous across two screen rows is painted per row-clipped chunk, so the lip shows at the row seam inside the wall. It is a thin pale band inside rock the player cannot enter, and it is left as is.

## Consequences

- A later area can opt in to depth bands with `depthBanded: true` and build a stepped floor from rock walls. Its danger bar reads water screens, the stepped floor lane and the band depth rule.
- Areas 1 to 11 and the spring cave have no `depthBanded` flag, so they build, play, bake and pass the danger bar exactly as before.
- Area 13 and later can use bands 3 and 4 of the lake water and the existing dark-water layer for pitch black. Epic and Legendary spots have a band to sit in.
- A habitat's later areas can reuse the lakebed painting, because it lives in the scenery chunks and adds no boot texture.
- The ids `'open-lake-1'` and the lake look ids are fixed for good (ADR 0012).
- Sloped floors, the tilted terrace or any non-rectangular wall stay out of scope. They need new collision and new predator and danger work (#210).
- The band rarity table, the water colours, the shelf and step heights (y 318 and y 560) and the tule bed placements are provisional. The owner can tune or reverse them on the PR, as area data, tuning or art.

## Alternatives considered

| Option | Why not |
|---|---|
| Smooth sloped floors now | Sloped collision needs a new wall shape, and predators and the danger tests would need to read it. That is #210, deferred. Stepped rectangles give the bowl without it. |
| Keep #130's thirds rule in banded areas | The thirds are equal parts of the water's height, so a stepped bowl would force a tilapia or a carp into the shallows to fill the top third. The owner (Q9) wants the shallows to be the pelican's, with the tilapia and the carp in the middle band. Reading the bands by screen row puts each threat where the owner wants it. |
| A separate dark-band layer for the lake's darkness | A second layer would need its own hiding and lighting rules. Area 12 is lit, so the darkness is just a water colour per row. The dark-water layer waits for the pitch black of Area 13. |
| Paint the lakebed as boot sprites | Boot sprites for a wide lake would pass iOS Safari's per-page memory limit again (commit bbd5755, #203). The scenery chunks bake on demand. |
| Rate the pelican line in hiding risk or keep snacks away from it | The spot's band already sets its rarity, and a line that sweeps the surface would rate the shelf spots by a second rule. Keeping snacks off its sweep would clear the surface of snacks. |
