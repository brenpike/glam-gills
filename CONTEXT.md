# Glam Gills: Find Your Flair

A cozy 2D web game for kids aged 8 to 12 in which the player is an axolotl exploring the Xochimilco canals to find treasures, rescue stranded axolotls, and dodge invasive tilapia.
The [MVP PRD](docs/prds/axolotl-mvp.md) is the source of truth; this glossary follows its Glossary section.

## Language

### Trips and banking

**Trip**:
One outing from the Home Tank into an area and back.
_Avoid_: run, level, life

**Explorer**:
The axolotl the player takes on a trip, chosen on the explorer card before each trip, and the only one whose outfit applies.

**Home Spot**:
The safe, clearly marked place where each trip starts and where finds are banked.
_Avoid_: checkpoint, base

**Trip Bag**:
Holds unbanked finds for the current trip only.
_Avoid_: inventory

**Trip find**:
A treasure or rescued axolotl collected this trip but not yet banked.

**Banking**:
Moving trip finds to permanent ownership at the Home Spot; a find that has been banked is **Banked**.
_Avoid_: saving ("save" means device storage)

**Go home**:
Ending a trip by choice at the Home Spot, which banks every trip find first.

**Carried home**:
Ending a trip after losing the fourth leg, which is a full trip reset: unbanked finds go back into the canal and the snacks start over.
_Avoid_: death, die, game over, wipe, fail

### Areas and exploring

**Area**:
A level that belongs to one **Habitat**, such as the canal (Area 1), the Lily pad pond (Area 2 and Area 3), or the Chinampa gardens (Area 4 and Area 5), W x H screens in size and built from area data; it is beaten by reaching its open exit. Area 3 (`'pond-2'` in code) is the second area of the Lily pad pond, the pond at dusk where the **Heron** hunts, about 6 x 1 screens, unlocked by beating Area 2. Area 4 (`'chinampa-1'` in code) is the first area of the Chinampa gardens, where the **Ghost nets** are, about 6 x 2 screens, unlocked by beating Area 3; it is the first area that scrolls up and down, with the Home Spot top left and the exit deep bottom right. Area 5 (`'chinampa-2'` in code) is the second area of the Chinampa gardens, where the **Garter snakes** and the **Water hyacinth mats** are, 7 x 2 screens, unlocked by beating Area 4; it is the first U-turn area: the way runs right along the top row from the Home Spot top left, down in the rightmost screen column, and back left along the bottom row to the exit straight under the Home Spot. Area 8 (`'deep-canal-1'` in code) is the first area of the **Deep canal**, where the **Black bass** and the **Gliding trajineras** are, about 8 x 2 screens, unlocked by beating Area 7; it is the first **Two-lane area**. Area 9 (`'deep-canal-2'` in code) is the second area of the **Deep canal**, where the **Murky water** and the **Bailing buckets** are, 9 x 2 screens, unlocked by beating Area 8; it is the first **Hub area**, with the Home Spot mid-area, the treasure down its west branch and the exit at the end of its east branch, low, with its gate on the bed. It also places two **Anchor drops** and two **Mud seeps**, and its trajineras are all moored: none glides. Area 10 (`'deep-canal-3'` in code) is the third area of the **Deep canal**, where the **Trajinera lures** and the **Drag nets** are, 10 x 3 screens, unlocked by beating Area 9; it is the first **Grand tour**. It mixes the **Tilapia** with every earlier **Predator**: the **Heron**, the **Garter snake**, the **Common carp**, the **Crayfish** and the **Black bass**. Area 11 (`'deep-canal-4'` in code) is the fourth area of the **Deep canal**, where the **Cormorants** are, 10 x 2 screens, unlocked by beating Area 10; it is a U-turn at golden hour (the **Golden hour look**), with the Home Spot top left and the exit low under it, and no timing or puzzle element. Area 12 (`'open-lake-1'` in code) is the first area of the **Open lake**, where the **Pelican line** and the **Wind and waves** are, unlocked by beating Area 11; it is the first area with **Depth bands**.
_Avoid_: map; "level" in UI text (say "Area 1")

**Habitat**:
A group of areas that share a look: the **Open lake** (`'open-lake'` in code), which holds Area 12 and the lake areas after it, the **Deep canal** (`'deep-canal'` in code), which holds Areas 8 to 11, the canal, which holds Area 1, the Lily pad pond, which holds Area 2 and Area 3, and the Chinampa gardens (`'chinampa'` in code), which holds Area 4 and Area 5: clear green-teal water by garden plots, with crops above the surface and ahuejote willow roots in the water. An area may use its own variant of its habitat's look: Area 3 uses the pond at dusk (`'pond-dusk'`), warmer and dimmer, with fireflies over the water, Area 11 uses the deep canal at golden hour (the **Golden hour look**), and the open lake's areas use the open lake in wind (`'open-lake-windy'`), still (`'open-lake-still'`) or in the late afternoon (`'open-lake-late'`). Besides colours, a look says what its area needs: a stream, its cave's kind and anchor, the pond props, fireflies, how its banks are drawn (willows or garden plots), the gap between two chinampas, and the chinampa props.
_Avoid_: using it as another name for one area

**Area map**:
The screen after the explorer card's Go! where the player picks an unlocked **Area** to explore or replay, with the areas on a winding path by **Habitat**, each with its stars, and a padlock on each locked area (N2).

**Exit**:
The way out of an area, which stays closed until every snack in the area is eaten. When it is open, its sign's arrow points toward the nearer side edge of the area: right in Areas 1 to 4, left in Area 5, whose exit is under its Home Spot, right in Area 9, whose exit is at the end of its east branch, right in Area 10, whose exit is low at its east end, below the hub fork, and left in Area 11, whose exit is low under its Home Spot.

**Star**:
One of up to 3 rewards for beating an area, kept forever once earned.

**Special treasure**:
The one treasure per area that earns a star when the area is beaten with it owned; Common or Rare, except in an area with **Depth bands** whose deepest water is band 3 or deeper, where it may be Epic or Legendary and every spot of its **Rarity** lies in that deepest band; the canal's is the Toy boat, Area 2's is the Frog statue, Area 3's is the Wooden duck decoy (Rare), Area 4's is the Scarecrow (Rare), Area 5's is the Piñata (Rare), Area 9's is the **Little bailing bucket** (Rare), Area 10's is the Axolotl statue (Rare), and Area 11's is the **Little cormorant** (Rare).

**Snack**:
A worm, a bug or a **Mobile snack** the axolotl eats by touching it with its head; not a trip find, it speeds up regrowth while a leg is missing, and every snack must be eaten to open the exit. In some areas a few snacks dart a short hop away when the axolotl gets close, each at most once per **Trip**; darting is part of the growth rule (N2), not a new **Timing element**.

**Mobile snack**:
A **Snack** that moves on its own: a **Tadpole** or a **Freshwater shrimp**. It counts as one snack, like a worm or a bug, for the counter, the last-3 **Hint sparkle**, opening the **Exit**, speeding up **Regrowth**, and starting over when **Carried home**. Mobile snacks are fixed area data, never placed by chance, and each is eaten, pulled by the Snack magnet, and met where it is drawn. A mobile snack is not a **Hazard** or a **Timing element**, so the one-new-thing rule and the **Danger bar** never count it. Which areas have them is in each area's danger pass paragraph in the PRD (N2).
_Avoid_: prey, moving food

**Tadpole**:
A **Mobile snack** (`'tadpole'` in code), a baby frog that never stops: it swims its **Wander loop** round its **Home area** at its area's steady speed, forever, turning at each turn point, so it changes direction every few seconds. It never drifts or bobs, and a one-leg axolotl always swims faster than any tadpole. At each turn it flips to face its new way and tips smoothly to the new leg's slant, never more than 40 degrees, so it is never drawn sideways. Under reduced motion it still swims its loop, without wiggling, and turns at once. Its fact card is "Meet the tadpole".

**Freshwater shrimp**:
A **Mobile snack** (`'shrimp'` in code) that rests, drifting and bobbing like a worm, and keeps busy: after each rest, while the axolotl's head is not close, it hops a short way toward the next hop spot of its **Home area**, about every 1 to 2 seconds. When the head comes near it flicks straight backward, away from the head, instead; it flicks again after each rest, with no limit, but never out of reach of its **Home area**, and then hops back. A one-leg axolotl that swims straight at a shrimp that has just landed always reaches it before its rest ends. A shrimp whose home has only one spot never hops; it only flicks. In an area with shrimp, the shrimp replace the snacks that dart once. Under reduced motion a hop or a flick lands at once. Its fact card is "Freshwater shrimp".
_Avoid_: prawn

**Wander loop**:
A **Tadpole**'s closed path of turn points, written as numbers in its area's data (`TadpoleWander` in area data, `SnackWander` on the snack), swum in order and back to the first. It counts as wandering with 4 to 8 turn points; a 2-point loop is a straight way there and back. Each leg takes 1.5 to 5 seconds and a lap at most 40 seconds, and where the tadpole is comes from the snack drift clock alone, never from chance. Every turn point and leg keeps inside the water, out of the safe area, the **Home Spot**, every **Current** and every **Water hyacinth mat**'s sweep, and 80 px or more from every **Hazard** (a drifting **Ghost net** by its whole drift path) and every **Plastic worm**. A **Predator** or a **Moving hazard** may reach part of the loop, but its longest stretch out of every threat's reach is at least half the loop. A spat plastic worm never lands near one of its legs.
_Avoid_: lane (the old straight-only shape), route (a route is a **Predator**'s patrol)

**Home area**:
The box a **Mobile snack** keeps to. A **Tadpole**'s is the box around its **Wander loop**: 320 to 480 px wide (about one screen) and at least 150 px tall, from near the surface to near the bed, inside one screen. A **Freshwater shrimp**'s is its home of 3 to 6 hop spots (`ShrimpHome` in area data) in a box at most 200 x 160 px; each spot and hop keeps the same rules as a **Wander loop**'s turn points and legs, and at least half its spots are out of every threat's reach, so every shrimp keeps coming back to safe water.
_Avoid_: home (the **Home Spot** and the Home Tank are other places)

**Snack ramp**:
The PRD's rule (H4, N2) for how many of an area's **Snacks** are **Mobile snacks**, and how fast they are, rising by area: none in Area 1, about 20% in Area 2, about 35% in Area 3, about 50% in Area 4, about 60% in Area 5, and up to about 70% from Area 6 on, with faster tadpoles and quicker shrimp each step. Every area keeps its snack total. Every area issue from Area 2 on must meet it, beside the **Danger bar**.

**Current**:
A stretch of flowing water in an area that pushes the axolotl, and that rarer treasures hide past. In Area 4 and Area 5 it is the water flowing sideways through the gap between two chinampas in the bottom row; Area 4's flows left and Area 5's flows right. In Area 9 it is a side-canal inflow on the bed of the west branch, flowing gently left. In Area 10 it is a side-canal inflow in the hub's treasure branch, at the top right, flowing left. A **Pulsing current**'s whole band counts as a current for **Snack** homes, but it is not a current for hiding spots: no treasure hides past one.

**Timing element**:
Something in an area that runs on a clock, and may carry a **Fun-fact card** of its own. Area 5's **Water hyacinth mats** were the first, and the first that blocks the **Explorer**; Area 8's **Gliding trajineras** push the **Explorer** aside; Area 9's **Bailing buckets** catch the **Explorer** and toss it back along the way; Area 10's **Drag nets** are the first that costs a leg; Area 12's **Wind and waves** push the **Explorer** along the surface band. Area 3's was the **Heron**'s shadow cycle, and #111 removed it when the **Heron** became a sight-based wading stalker.

**Water hyacinth mat**:
A floating mat of water hyacinth in the Chinampa gardens, Area 5's **Timing element** (`'water-hyacinth'` in code). The mats come in pairs, one above and one below a narrow channel; each pair spans its row, and Area 5 has two, one in each row, out of step. On an 8 s cycle the mats drift apart over the first 1 s of a 3 s open window, drift together over 1 s (the warning), and stay closed for 4 s. A closed channel blocks the **Explorer**, who waits or goes round through the other row; a mat that closes on the **Explorer** pushes it out along the channel, never into a **Ghost net**, a **Current** or out of the swim bounds. A mat never costs a leg, is never a **Hit** and never traps. Only the **Explorer** is blocked: a following rescued axolotl, the **Predators** and the **Snacks** are not.
_Avoid_: wall, terrain

**Gliding trajinera**:
A painted trajinera boat that shuttles back and forth over a span of the surface lane of a **Two-lane area**, Area 8's **Timing element** (`'gliding-trajinera'` in code). A new crossing starts every 6 s, each heading the other way from the last: the whole boat rests at the end it starts from, at least 1 s, then glides at 70 px/s and reaches the far end as the crossing ends. It is always drawn whole, never cut off at its span's ends. Its hull is 120 px long and blocks the top 60 px of water under it. Its shadow is the whole hull 1 s later, as the warning: it slides out from under a resting boat 1 s before the boat moves, with no fade. A hull that touches the **Explorer** pushes it out the shortest way, down or sideways, at 120 px/s, with a 0.5 s cooldown per boat. A push is gentle: it never costs a leg, is never a **Hit**, drops no find and starts no **Protected time**, so the Shell **Perk** plays no part. It is reported as a trip result (`pushed`), not a trip event. Only the boat's bright painted bow shows, with no people and no fishing. It is not a **Moving hazard** and not a **Danger part**, so the **Danger bar** never counts it. Snacks keep clear of its hull band.
_Avoid_: moving hazard, barge, punting pole (the pole is a **Moving hazard**), moored trajinera

**Puzzle element**:
Something in an area that the player works out how to use, always active and never on a clock (the `'puzzle'` element kind in code). It is not a **Hazard** and not a **Timing element**: it never costs a leg and is never a **Hit**, so the Shell **Perk** plays no part. It counts as an area's one new timing or puzzle element. A stuck player gets a gentle hint, and the **Exit** is never locked behind a puzzle the player cannot see how to solve (N3). The first is the **Glow-plant**; the **Pebble** is the second, and the first that blocks the **Explorer**, by its own shape, never as a **Hit**.
_Avoid_: lock, key, switch

**Dark water**:
The dark part of an area (`darkWater` in area data): a fixed rectangle drawn as one dark layer, never placed by chance; an area without one is lit everywhere. The darkness hides only scenery, **Snacks**, treasure spots, their **Hint sparkles** and finds. It never hides the axolotl, the **Exit**, the **Home Spot**, any **Predator** or **Moving hazard** or its **Telegraph**, any fixed **Hazard**, such as **Sharp litter**, a **Stranded axolotl**, a **Glow-plant**, a **Fading light**, lit or out, or the controls. Light shows through it as soft circles: the axolotl's own glow, about 120 px round its body and always on, so a **Snack** shows in it before it is in reach; the exit's faint glow; and about 200 px round each lit **Glow-plant** and each lit or dimming **Fading light**. Lit and dark water differ in brightness, so they read in greyscale. No stranding place is in the dark water. Swimming into or out of it is silent.
_Avoid_: fog, shadow, night (night is a look's time of day)

**Glow-plant**:
A plant in the **Dark water**, the first **Puzzle element** (`'glow-plant'` in code). Unlit, it shows as a dim teal outline, so it can be seen in the dark. When the axolotl's body touches it, it lights, silently, and stays lit for the rest of the **Trip**, lighting about 200 px round it. Lit plants are trip state only, never saved, so every plant is unlit at the start of each trip. After 20 seconds of game time in the dark water without lighting a new plant, the nearest unlit plant pulses gently until a plant is lit or the axolotl leaves the dark; under reduced motion its outline brightens instead, and a new light appears at once. The hint clock holds while the game is paused, a banking card shows or the axolotl is being **Carried home**. A glow-plant never blocks the **Explorer**, has no **Fun-fact card** and is never met. Its hint is not a **Hint sparkle**.
_Avoid_: lamp, torch, light switch

**Fading light**:
A light-bulb-like water plant in the **Dark water** of a lake area, a **Puzzle element** (`'fading-light'` in code), the lake's cousin of the **Glow-plant**: one round bulb on a hooked stalk, never a snack, a hint star, a hazard or a hiding place. When the axolotl's body touches it, it lights, silently, about 200 px round it. It stays fully lit for 15 seconds, then dims smoothly over 4 seconds and goes out; a touch relights it to full whether it is lit, dimming or out. Out, it shows as a dim outline, so it can always be found in the dark. Its light is trip state only, never saved, so every light is unlit at the start of each **Trip**. It shares the dark hint clock with the **Glow-plants**: after 20 seconds of game time in the dark water without a new light, the nearest light that is out or never touched pulses gently. The timers and the hint clock hold while the game is paused, a banking card shows or the axolotl is being **Carried home**. Under reduced motion a light holds full, drops to half for the dim and then goes out, and its hint brightens instead of pulsing. It never blocks the **Explorer**, never costs a leg, is never a **Hit**, has no **Fun-fact card** and is never met. Its hint is not a **Hint sparkle**.
_Avoid_: lamp, lantern, torch, glow-plant (a **Glow-plant** stays lit for the whole trip)

**Pebble**:
A big round pebble in the doorway of a **Side room**, a **Puzzle element** (`'pebble'` in code). It sits on a fixed straight groove and blocks the doorway. When the **Explorer** swims into it from outside, from behind it along its groove, it rolls slowly along the groove into the room, one way only, never back, so it can never get stuck; at the groove's end it stays. It never costs a leg, is never a **Hit** and has no **Fun-fact card**, and only the **Explorer** pushes it. Where it is on its groove is trip state only, never saved, so every pebble is back at its start on each **Trip**. After 10 seconds of game time near a pebble that has not rolled, without moving it, a still arrow shows which way to push, under reduced motion too. The clock holds while the game is paused, a banking card shows or the axolotl is being **Carried home**. The way to the **Exit** never needs a pebble.
_Avoid_: boulder, rock (rock is a **Rock wall**), door, key

**Rock wall**:
Solid rock in an area (`rockWalls` in area data): a fixed rectangle, never placed by chance, that the **Explorer**'s body never enters. A swim step into rock stops at its face, one axis at a time, so the axolotl slides along it. It is not a **Hazard**: it never costs a leg and is never a **Hit**. Rock is not water, so no quiet swim of the **Danger bar** runs through it, and no **Snack** starts in or near it, and no **Mobile snack** home reaches it. Every **Predator** is blocked by it too: its moves stop at the rock's face, and it never senses, chases or strikes an axolotl through rock. A rock wall may be a **Lane divider**.
_Avoid_: terrain, cliff, mat (a **Water hyacinth mat** is not a wall)

**Side room**:
The water walled in by **Rock walls** behind a **Pebble** (`sideRooms` in area data), reached only once the pebble rolls. It is optional: the main path, the **Exit**, the **Home Spot** and every stranding place stay out of it, and no **Snack** starts in it or near it, so an area can always be finished without it. Treasure may hide in it.
_Avoid_: secret room, vault

**Deep canal**:
The **Habitat** of Areas 8 to 11 (`'deep-canal'` in code): a deeper, darker stretch of the Xochimilco canal, with painted boats moored along its surface and a **Black bass** hunting below. Area 8 is a **Two-lane area** whose boats also glide; Area 9 is a **Hub area** whose boats are all moored, with **Murky water** and **Bailing buckets**; Area 10 is a **Grand tour**, with **Fishing trajineras** and **Drag nets**; Area 11 is a U-turn at golden hour, with **Cormorants** floating on its surface. It has its own look (`'deep-canal'`), which Area 11 varies with the **Golden hour look**, and its own music **Cue**.
_Avoid_: ocean, sea

**Golden hour look**:
Area 11's own look (`'deep-canal-golden'` in code), a variant of the **Deep canal**'s look at golden hour ([ADR 0039](docs/adr/0039-cormorant-dive-arc-and-golden-hour-area-look.md)): a warm coral and peach sky, warm shallow water fading to the deep canal's deep teal, and warm light rays slanting low, with its lower row lit. Its time of day is dusk, so Area 11 plays the **Dusk version** of the deep canal's **Cue**. Its decorations are painted into the area's own scenery: papel picado banners, marigold petal patches, water hyacinth rafts, chinampa walls with ahuejote root curtains, and sunken trajinera arches with round marigold flowers on their boards, never letters. At most one marigold petal per screen sinks slowly through the water. All of it is scenery: none of it is cover, a cue or a **Hiding spot**.
_Avoid_: dusk look, sunset (say golden hour); hyacinth mat (the rafts are scenery, not a **Water hyacinth mat**)

**Open lake**:
The **Habitat** of the open lake's areas (`'open-lake'` in code, named "Open lake"): a wide, open stretch of Xochimilco lake, not a canal, its water split into **Depth bands**, a **Pelican line** floating on its surface and **Wind and waves** across it, and a **Mud turtle** creeping its deep floor among **Fading lights**. It has its own **Refuge section** and its own look (`'open-lake'`), which its areas vary as windy (`'open-lake-windy'`), with streaming clouds, as still (`'open-lake-still'`), overcast with no streaming clouds and no wind, and as late afternoon (`'open-lake-late'`), with a warm apricot and peach sky and long shafts of light down into the pits. Real lagoons are shallow; the deep water is game licence, and its fact cards stay true.
_Avoid_: ocean, sea, canal (the canal is Area 1's **Habitat**)

**Depth band**:
One screen-row band of water in an **Area** that opts in to bands, counted from the top: band 1 is the shallows (the top row), band 2 the middle, band 3 and below the deep. The water is darker with each band, and the bottom of a band 3 or deeper may be pitch-black **Dark water**, lit only by what the player lights. Darkness in a band follows the **Dark water** rule: it hides only scenery, **Snacks**, treasure spots, their **Hint sparkles** and finds, never the axolotl, the **Exit**, the **Home Spot**, a **Pelican line** or any other **Hazard** or its warning. **Rarity** of a treasure spot goes by band: the shallows Common, the middle Rare, the deep Epic and Legendary, and band 3 or deeper counts as deep for a **Hiding spot** with no cave or **Current**. The **Special treasure** hides in the deepest band; when that band is band 3 or deeper, it may be Epic or Legendary. The shallows are not safe: surface danger works there. Band 1 is the surface band the **Wind and waves** work in. An area without bands has none of this.
_Avoid_: layer, level ("level" is an **Area**), depth third (that is the **Danger bar**'s, see Flagged ambiguities), lane (a lane is a **Two-lane area**'s)

**Two-lane area**:
An **Area** whose water a **Lane divider** splits into a surface lane over it and a deep lane under it, joined again at a shared pocket at the Home Spot and in the exit pocket (Area 8 is the first). The surface lane holds the **Punting poles**, the moored boats and the **Gliding trajineras**; the deep lane holds the **Black bass** and the sunken trajinera. Each lane has its own **Tilapia** and its share of the **Common carp**. The main path runs along the surface lane to the **Exit**. Area 10's **Grand tour** swims one stretch of two lanes, the upper and the lower lane, from its fork pocket to its join pocket, along the upper lane.
_Avoid_: split level, floor (a floor is the bed of the water)

**Hub area**:
An **Area** whose way starts in the middle and branches both ways (the owner's area shape decision on #107, from the area shape rule on #32; [ADR 0037](docs/adr/0037-hub-areas-murky-water-and-the-bailing-bucket.md)): the **Home Spot** sits mid-area, the exit is down one branch, and the treasure is down the other. Area 9 is the first: 9 x 2 screens (4320 px across), the Home Spot at x 2160, y 360, the middle of the area, and the safe area its screen column (x 2015 to 2305) from the surface to the bed. Its west branch and its east branch are each about 4 screens across. The west branch holds the treasure: Rare spots under its moored rows, the **Sunken trajinera** under the wide **Murky water** patch, and the Legendary and Epic spots past the side-canal inflow. The main path runs east only, never turning back west: along the surface under the moored rows, through the two narrow murky patches, under both **Anchor drops** and past both **Bailing buckets**, then down to the exit low at the end of the east branch. Every branch counts for the **Danger bar**. Area 10's **Grand tour** ends in a hub fork at the top right: its main branch drops to the exit and its treasure branch runs on east past the side-canal inflow to a dead end.
_Avoid_: crossroads, maze, two-lane area (that is Area 8's shape)

**Grand tour**:
An **Area** whose long route mixes the earlier area shapes (issue #108, ND-7). Area 10 is the first: 10 x 3 screens (4800 x 1080 px), with the **Home Spot** top left and the safe area its column of the top row (x 40 to 330). The main path drops down and right into the fork pocket, swims the upper of two lanes split by an old-stone **Lane divider** to the join pocket, makes a U-turn along the top row, comes down through all three rows, runs east along the bottom row, climbs back up, and forks at the hub at the top right: the main branch drops to the **Exit** low at the east end, and the treasure branch runs on east past the side-canal inflow to a dead end. Each **Predator** guards its own part of the way, and every part counts for the **Danger bar**.
_Avoid_: maze, level select; hub area or two-lane area alone (a grand tour holds both shapes and more)

**Lane divider**:
The solid line of **Rock walls** that splits a **Two-lane area** into its lanes (the owner's Q3): stones that each touch the next, so no body passes between the lanes. It is `rockWalls` area data, so it blocks the **Explorer**'s body and every **Predator**, and no **Predator** senses, chases or strikes through it. It is not a **Hazard**.
_Avoid_: wall alone, floor, ceiling

**Moored trajinera**:
A painted trajinera tied up at the bank of the surface lane, or in Area 9 along the surface of both branches, or in Area 10 in three rows along its surface (`bankOverhangs` in area data), scenery that gives the water under it bank cover for **Hiding spots**. It never moves, never pushes and is not a **Timing element**. A row of them is a shade over the whole bank cover with whole, unstretched boats only in the free water between the other surface boats, so no surface boat overlaps another; a short row may show the shade only.
_Avoid_: gliding trajinera (that is the moving boat), anchor drop's boat (that boat is part of an **Anchor drop**, a **Moving hazard**, not scenery)

**Sunken trajinera**:
An old trajinera hull on the bed of the deep lane, or in Area 9 on the bed of the west branch, or in Area 10 on the bed of the lower lane, under the wide **Murky water** patch, a dead end that holds an open Legendary spot and an Epic spot. It is scenery and hiding cover: it never moves, never pushes and is not a **Hazard**.
_Avoid_: wreck, shipwreck

**Tail Dash**:
The axolotl's first power, a short burst of speed that works with any number of legs and is the only way to break a Dash pot.

**Hiding spot**:
A place in an area where a treasure can hide, picked fresh each trip for each treasure picked for that trip, from that treasure's pool. Each rarity's spots sit in their own risk band, nearer a threat (a predator's patrol route or a leg-costing hazard) the rarer the treasure (B10). A spot is deep when it is in the area's cave, past a **Current** or, in an area with **Depth bands**, in band 3 or deeper; Epic and Legendary spots are deep, and a Common or Rare spot never is (B6). An area's cave holds hiding spots of its own; Area 2's cave is a hollow log, and Area 3's is a root arch under the bank (B6's "a cave or other hollow"). The **Heron** cannot see an axolotl in cover: inside a reed patch, under a lily pad, or in the root arch (N3). Area 4's and Area 5's caves are tangles of ahuejote roots on the bed of the bottom row, and their Common and Rare spots sit under the overhanging chinampa banks (the bank cover, `'bank'` in code). A spot is past a **Current** when it is within 140 px beyond the current's upstream edge, the edge its flow comes from, and inside its y range, so the side follows the flow: right of Area 4's current, left of Area 5's; a current with no sideways flow has no past side. Each Lily pad pond area also has two fixed spots under lily pads, one Common and one Rare, that are area data, so every trip there has them.

**Treasure slot**:
One of an area's set number of places for a treasure on each trip (6 in the canal, 7 in Area 2, 8 in Area 3, 9 in Area 4, 10 in Area 5, 11 in Area 6, 12 in Area 7, 13 in Area 8, 14 in Area 9, 15 in Area 10, 16 in Area 11), with its rarity picked by chance from the trip seed; lost treasures and the **Special treasure** are extras on top of the slots (B4). If a rarity has no treasure left to fill a slot, the slot falls back to a more common rarity first, then to only one step rarer; otherwise it stays empty (B4).
_Avoid_: Slot alone (that means a Wearable **Slot**)

**Dash pot**:
A pot only Tail Dash can break, which holds only a Legendary treasure. A Legendary may also hide in the open, as long as its spot is deep and right next to danger (B6, B10).

**Hint sparkle**:
The small sparkle, readable without colour, that appears near a hidden treasure and on each of the last 3 snacks.
_Avoid_: hint star

### Hazards, predators and legs

**Hazard**:
Something in an area, defined as data with its own rules, that may cost the axolotl a leg or only slow it, such as a predator. A slow-only hazard, such as the **Plastic worm**, never costs a leg, never starts **Protected time**, and is not a threat for hiding spots (B10). A hazard may stay still or move: a **Moving hazard** moves on its own cycle and costs a leg on touch, a **Drifting ghost net** moves and only slows, and **Sharp litter** lies still and costs a leg on touch, with no push. A **Pulsing current** only pushes: it never costs a leg and never slows. **Murky water** never costs a leg on touch: only staying in it too long does.

**Predator**:
A kind of **Hazard**: an animal that hunts, with a visible warning before every strike; every predator follows the same shared rules, and each species is data. A species' warning starts by distance, when the axolotl comes near (the **Tilapia**, the **Garter snake**, the **Common carp** and the **Crayfish**), or on sight, when the axolotl is within the predator's reach and not in cover (the **Heron** and the **Cormorant**). A species may warn only while it is on its route (the **Garter snake**, the **Crayfish** and the **Cormorant**), so after a strike it swims back to its route before it can warn again. A species may strike level (`levelStrike` in code; the **Crayfish**): its strike never moves it up or down, so it reaches only along its own height. A species may glide after a strike (**Slow turn**; the **Black bass**), or strike by diving along a **Dive arc** (the **Cormorant**). No predator senses, chases or strikes through a **Rock wall**. A predator whose area gives it a chase follows the **Chase rule** on patrol, within its **Leash**, before it warns; the **Heron** never chases. Any species may be tuned per area in its area's own data, and stays the same species.
_Avoid_: monster

**Chase rule**:
The shared rule (`chase` in a predator's tuning) by which a **Predator** on patrol swims toward an exposed axolotl within its sight, at a chase speed between the 2-leg and 4-leg top speeds, and stops at its strike reach, where it warns, or waits while another predator warns or lunges. It never goes farther than its **Leash** from its patrol route, and when the axolotl is out of sight or in the safe area it swims back along its route. Chasing is not attacking: any number of predators may chase at once. There is no extra cue, and **Tail Dash** always outruns a chaser. A predator chases only when its area's data gives it a chase; which areas do is in each area's danger pass paragraph in the PRD (N2).
_Avoid_: aggro, hunt mode

**Leash**:
How far in px a chasing **Predator** may go from its patrol route (`leash` in code). A species that warns only on its route, such as the **Garter snake**, has a leash of 0, so it chases along its stretch only. Hiding-spot risk (B10) ignores the leash: a predator's strike reach is still measured from its route.

**Danger part**:
A **Predator** or **Hazard** type added by the danger pass to make areas busier, which does not count toward an area's one new **Hazard** or **Predator** (N2): the **Common carp** and every **Moving hazard** type. The mark is on the species or type itself (`dangerPart` in code). A danger part still has its own **Fun-fact card** and is still met.

**Danger bar**:
The PRD's measure (N2) of how busy an area from Area 4 on must be: about one moving threat (each **Tilapia**, each other **Predator** and each **Moving hazard**) per screen, at least 2 **Predator** species and 1 **Moving hazard** type, every predator chasing, and no swim anywhere in the swim water, along the surface, along the floor or anywhere between, longer than one screen (480 px) with no moving threat in reach. Its depth rule has the **Tilapia** and the **Common carp** patrol at every depth, its floor rule puts predators on the floor when danger comes from the surface, and its carp rule asks for about one **Common carp** per 3 screens. The gentle stakes stay (G2).
_Avoid_: difficulty

**Ramp bar**:
The gentler **Danger bar** for Area 2 and Area 3: the **Tilapia** chase with a short **Leash**, no quiet swim anywhere in the swim water longer than 480 px, the same depth, floor and carp rules, and no **Moving hazard** in Area 2 and at most one type in Area 3. Area 1 stays gentle, with no chase and no moving hazard.

**Tilapia**:
The invasive fish that patrol the canal, the first **Predator**. From Area 4 on, each area's tilapia can be tuned as area data, one step tighter per area (the predator ladder): Area 4's warn a little more briefly and strike a little faster and farther. Areas 1 to 3 keep the first tuning.
_Avoid_: monster

**Heron**:
The wading bird that hunts in Area 3 (N3), the first **Predator** whose warning starts on sight. Two herons stand in the back half with legs in the water, head and neck above it, and wade slowly (20 px/s) along short stretches. A heron's head turns to follow the axolotl when it is near and not in cover. Within 110 px of where it stands (down to about y 230) it sees the axolotl, freezes, and pulls its neck into an S for 1.2 seconds, then stabs in 0.3 seconds at the spot where the axolotl was when the warning started, so swimming away dodges it. After a stab it waits 3 seconds, then wades again. It cannot see an axolotl in cover (a reed patch, a lily pad, the root arch); past the current is open water, and the bottom band below its reach is out of its reach ("stay deep"). The **Tilapia** ignores cover. It never grabs, holds or lifts the axolotl.
_Avoid_: monster, bird alone

**Garter snake**:
The striped snake that hunts in Area 5 (N3), at the surface (`'garter-snake'` in code). Three snakes swim slowly along short straight stretches with their heads at y 100, in a gentle S-wiggle. When the axolotl comes within 110 px of a snake's head, it stops and ripple rings spread from its head for 0.8 seconds, then it darts in a straight line, so swimming away or swimming deep during the rings dodges it. It warns only while its head is on its stretch, so repeated darts never walk it deeper: its hits reach no deeper than about y 254, and the water below y 260, the whole bottom row included, is out of its reach. Cover does not hide the axolotl from it. A touch is a gentle bump that costs no leg. Its mouth is always closed, and it never bites, holds or eats the axolotl.
_Avoid_: monster

**Common carp**:
A big, round, bronze-gold invasive fish with two short barbels (`'carp'` in code), a **Predator** on the shared rules with no special rules, and a **Danger part**. It swims at every depth and digs in the mud on the bed. Before its strike it tips its nose down and puffs a small mud cloud, then makes a slow, wide tail sweep along the aim fixed at the end of its warning. A touch is a gentle bump that costs no leg. Its mouth is closed and it has no teeth; it never bites or holds the axolotl. Its fact card is "Meet the carp". Which areas have a carp is in each area's danger pass paragraph in the PRD (N2).
_Avoid_: monster, koi

**Crayfish**:
A small freshwater cousin of the lobster that walks along the bed (`'crayfish'` in code), a **Predator** on the shared rules. Each crayfish walks its own short straight floor stretch. With its first tuning, when the axolotl comes within 90 px of it while it is on its stretch, it stops and opens its claws wide for 0.8 seconds (under reduced motion they snap open), then pinches forward, level along the floor and never up, so swimming up out of its reach dodges every pinch, and the water above its reach is safe. A pinch that connects costs a leg; a touch outside a pinch is a gentle bump that costs no leg. It warns only while on its stretch, and its **Leash** is 0, so it chases along its stretch only. Cover does not hide the axolotl from it. Its mouth is always closed, and it is never shown holding, pinching down on or hurting the axolotl. Its fact card is "Meet the crayfish".
_Avoid_: crawfish, crawdad, lobster, monster

**Black bass**:
A big, fast dark fish that people brought to Xochimilco (`'black-bass'` in code), a **Predator** on the shared rules, and the **Deep canal**'s signature predator. It warns by distance, within 180 px, flaring its fins for 0.8 seconds, then lunges straight along the aim locked at strike start, with no homing. It follows the **Slow turn** rule. A touch outside a lunge is a gentle bump that costs no leg. Its mouth is closed and it never bites or holds the axolotl. It is not a **Danger part**: it is Area 8's one new **Predator**. Its fact card is "Meet the black bass".
_Avoid_: monster, largemouth

**Cormorant**:
The Neotropic cormorant, a dark diving water bird (`'cormorant'` in code), a **Predator** on the shared rules, and Area 11's one new **Predator**, not a **Danger part** ([ADR 0039](docs/adr/0039-cormorant-dive-arc-and-golden-hour-area-look.md)). Area 11 has three, each floating along a short straight stretch at the top of the water, at y 94, drifting at 40 px/s. Its warning starts on sight, like the **Heron**'s, when the axolotl is within 180 px, not in cover and outside the safe area, and only while it is on its stretch: for 1.0 seconds it holds its dive crouch, neck arched down until its closed bill touches the water and tail tipped up. Then it dives along its **Dive arc** at 450 px/s, at most 1.3 seconds, at the spot the axolotl was in when the warning ended; its head within 26 px of the axolotl costs a leg. Its dive goes no deeper than 180 px below its stretch, so swimming deeper than y 300, or away, dodges it. Through its 2.5 second cooldown it floats where it came up with its wings out to dry, then swims back to its stretch. It chases along its stretch only (**Leash** 0, sight 240 px, 120 px/s). It is surface danger for the **Danger bar**, so its area also has predators on the floor, and it never counts toward the depth rule. It never touches or bumps the axolotl, its bill is always closed, and it never grabs, holds, lifts or carries the axolotl: a hit shows only the **Leg loss** poof. Under reduced motion its poses switch at once and nothing bobs, but the dive still moves. Its fact card is "Meet the cormorant".
_Avoid_: shag, diving duck, monster

**Mud turtle**:
The Valley of Mexico mud turtle (`'mud-turtle'` in code), a small, dark, friendly turtle that creeps along a short stretch of the deep lakebed, a **Predator** on the shared rules and not a **Danger part**. It crawls at 20 px/s. When the axolotl comes within 110 px of it, it turns to face it and lifts its head for 1.2 seconds, then snaps its neck out in 0.3 seconds to the spot the axolotl was in when the warning started, so swimming away dodges it. Through its 2.5 second cooldown it holds still, facing the axolotl. It never chases and has no **Leash**: no area can give it the **Chase rule**. Cover does not hide the axolotl from it. A snap that connects costs one leg through the same hit path as any **Hit**, so the Shell **Perk** can block it; a touch outside a snap is a gentle bump that costs no leg. Its beak is always closed and empty, and it never bites, grabs, holds, lifts or carries the axolotl. A turn shows over 0.3 seconds; under reduced motion it turns at once and its poses hold, but the snap still moves. The **Ripple** plays when it warns. Its fact card is "Meet the mud turtle", which never says it eats axolotls.
_Avoid_: snapping turtle (a different turtle), tortoise, monster

**Pelican line**:
Area 12's one new threat (`pelicanLines` in area data; the American white pelican): a line of 3 pelicans floating on the surface, gliding along their span together. The line warns, then dips every bill together, down from the surface, and rises again, on one shared cycle. The warning is visible first: the birds stop, lift their heads and open their pouches, with a ripple on the water, and the **Ripple** plays. A scoop that touches the axolotl costs one leg and bumps it away, through the same hit path as any **Hit**, so the Shell **Perk** can block it and **Protected time** follows; it never catches, holds or lifts the axolotl ([ADR 0007](docs/adr/0007-kid-safety-and-privacy.md)). The axolotl dodges by swimming under the dip or through a gap between two bills. A **Drifting island** shelters from it: a bird whose scoop would meet an island at any moment of that scoop does not dip it, decided once for the whole scoop, so that bird holds its warning pose with no splash and its scoop never touches the axolotl; the **Ripple** still plays. The line never chases and has no **Leash**, so the **Chase rule** does not apply: it is a scheduled formation, not a **Predator** on the shared rules. Each bird counts as a moving threat for the **Danger bar**. It is met within 180 px of a bird. Its fact card is about the American white pelican.
_Avoid_: flock (a line moves in step and keeps its spacing), predator (see Flagged ambiguities), monster

**Wind and waves**:
Area 12's **Timing element** (`'wind'` in code): gusts blow across the surface band and push the **Explorer** sideways. A gust shows its ripples on the water first, as its warning; its direction alternates with each gust, left then right; it fades to calm by the second **Depth band**, and the **Home Spot** is always calm. It pushes only the **Explorer**: it never moves **Snacks**, **Predators**, a **Pelican line** or any **Hazard**, never costs a leg, is never a **Hit**, drops no find and starts no **Protected time**, so the Shell **Perk** plays no part. It is not a **Hazard**, a **Current** or a **Pulsing current**.
_Avoid_: current (see Flagged ambiguities), storm, weather

**Drifting island**:
A floating island of tule reeds on the surface of a lake area, a **Timing element** (`'drifting-island'` in code): a flat mat 240 px wide, with reeds standing up from it and roots trailing below, that drifts slowly back and forth along its own path at the surface, at 16 px/s, turning at once at each end. Neighbouring islands drift out of step. It is moving shelter from the **Pelican line** only: a bird whose scoop would meet an island at any moment of that scoop, from the plunge to the end of the rise, does not dip that scoop. It is no shelter from any **Predator**, the **Cormorant** included, and no cover for a **Hiding spot**. It never slows, blocks, pushes or drags the **Explorer**, never costs a leg and is never a **Hit**, so the Shell **Perk** plays no part; every bird and the axolotl draw in front of it. It has no **Fun-fact card**, is never met and has no sweep, so **Snacks** do not keep away from it. Under reduced motion it still drifts, because the drift is gameplay, but it does not bob.
_Avoid_: raft, boat, water hyacinth mat (a **Water hyacinth mat** blocks), reed patch (a reed patch is cover)

**Slow turn**:
The shared rule option (`slowTurn` in code) that the **Black bass** plays: after a strike it keeps its facing and glides along the strike's aim, slowing evenly to a stop by the end of its cooldown, instead of turning away. After a cancelled warning it holds still, keeping its facing. Dodging sideways beats it.

**Dive arc**:
The shared rule option (`diveArc` in code) that the **Cormorant** plays: its strike is a dive along a U-shaped arc, locked at the end of its warning toward where the axolotl was then. The arc goes down from the predator's place to that spot's depth, never deeper than its lunge range below the nearest point of its route, and back up to its start height as far past the spot. It is 120 to 360 px wide, and its far end stays within its lunge range of its route. The dive moves at its lunge speed and lasts the arc's length over that speed, at most its lunge duration. A hit is its head within its hit reach anywhere along the arc; after a hit it finishes the arc with no further hit. Through the cooldown it holds where it surfaced, keeping its facing.
_Avoid_: swoop, lunge (a lunge is a straight strike)

**Plastic worm**:
A bit of plastic in the Lily pad pond that looks like a worm, the first slow-only **Hazard**. Touching it with the head eats it, which makes the **Explorer** **Queasy**, and the axolotl spits it out a little way ahead. It is never a **Snack**, never counts toward opening the **Exit**, and the worms start over each **Trip**.
_Avoid_: worm alone (a worm is a **Snack**)

**Queasy**:
How the **Explorer** feels for 3 seconds after eating a **Plastic worm**: top speed drops to 0.6 of normal, with a green cheek tint and a gentle wobble (no wobble under reduced motion). **Tail Dash** and speeding up are not slowed, no leg is lost, and eating another plastic worm while queasy does nothing. Queasy time pauses while the game is paused or a banking card shows, and ends when the axolotl starts being **Carried home**, on **Go home**, on beating the area, or at the end of the trip.
_Avoid_: sick, poisoned, damage

**Ghost net**:
A torn, loose, old fishing net anchored in the water of the Chinampa gardens, a slow-only **Hazard** (`'ghost-net'` in code); Area 4 has five. Swimming into one makes the **Explorer** **Snagged**. It is not fishing line.
_Avoid_: trap; net alone in docs (say **Ghost net**)

**Drifting ghost net**:
A **Ghost net** that drifts slowly back and forth along a short straight path, at most 200 px, on a 16 s cycle, slowing at each end, laid along the flow of a nearby **Current**. It snags where it is now, like any **Ghost net**, and never costs a leg. Everything placed in an area keeps clear of its whole drift path. Under reduced motion it still drifts. Which areas have one is in each area's danger pass paragraph in the PRD (N2).
_Avoid_: moving net, floating net

**Snagged**:
How the **Explorer** is for 2 seconds after swimming into a **Ghost net**: it wriggles free and swims at 0.5 of its top speed. **Tail Dash** and speeding up are not slowed, no leg is lost, and swimming into a net while snagged does nothing, so snags never stack. A new snag starts only on swimming into a net's reach, never while staying in it. Snag time pauses while the game is paused or a banking card shows, and ends when the axolotl starts being **Carried home**, on **Go home**, on beating the area, or at the end of the trip. A small snag cue shows over its head; under reduced motion there is no wriggle, so the cue and the slowdown show the snag.
_Avoid_: trapped, caught, stuck, damage

**Moving hazard**:
A **Hazard** that moves on a fixed cycle of its own and costs a leg on touch, with a warning (its **Telegraph**) of at least 0.8 seconds before each move into the water; its looks are data. Its shaft comes from its base: down from the surface, down from a rock roof, or up from the floor; the whole shaft touches, and a hit comes from its tip where it really is. It is not a **Predator**, so it does not wait its turn: it may move while a predator warns or lunges. It is not a **Timing element**: a timing element is an element on its area's clock, and the **Drag net** is the only one that costs a leg. Every moving hazard type is a **Danger part**. The first is the **Punting pole**; the **Anchor drop** also comes from the surface, the **Stalactite drip** from a roof, and the **Geyser vent** and the **Mud seep** from the floor.
_Avoid_: trap, obstacle

**Punting pole**:
The first **Moving hazard** (`'punting-pole'` in code): a trajinera boat's long pole that jabs straight down from the surface on a 4 s cycle, 180 px deep. Before each jab the boat's shadow darkens on the water and the pole's tip dips to the surface with a ripple ring. Touching the jabbed pole costs a leg; the water below its tip is safe. Only the boat's bright painted bow shows, with no people, and the pole is never shown hitting or pinning the axolotl. Its fact card is "Trajineras". Area 8 reuses it, at least 3 poles in its surface lane (the owner's Q2), to meet the **Danger bar**. Which areas have one is in each area's danger pass paragraph in the PRD (N2).
_Avoid_: oar, stick

**Stalactite drip**:
A **Moving hazard** from a rock ledge (`'stalactite-drip'` in code): a rock stalactite hangs from the underside of a rock ledge, never from the surface, and a thin stream of drips falls from under its tip down to its depth on a 4 s cycle. Before each stream a drop swells at the tip and ripple rings spread just under the drop; then the drip stream falls from the tip to its depth. The whole stream costs a leg on touch; the water below its end is safe. Its fact card is "Stalactites". Which areas have one is in each area's danger pass paragraph in the PRD (N2).
_Avoid_: icicle, waterfall

**Geyser vent**:
A **Moving hazard** from the floor (`'geyser-vent'` in code): a rock vent on the bed that bursts a column of water and bubbles up to its height on a 5.2 s cycle. Before each burst bubbles rise from its mouth with a shimmer ring. The whole column costs a leg on touch; the water above its top is safe. It is never shown as fire. Its fact card is "Geysers". Which areas have one is in each area's danger pass paragraph in the PRD (N2).
_Avoid_: volcano, jet

**Anchor drop**:
A **Moving hazard** from the surface (`'anchor-drop'` in code): a small old anchor lowered on its chain from a moored old wooden work-canoe toward the canal bed and pulled back up on a 4.8 s cycle, 200 px deep (an area may set at most 320 px). Before each drop two chain links fade in under the boat and three wavy ripple lines spread under it, pointing down at where the anchor will land. The whole drawn shaft, the chain and the anchor, costs a leg on touch (the owner's Q2); the water below the anchor is safe. Only the canoe's plain wooden hull shows, with no people, and the anchor is never shown hurting the axolotl. Its fact card is "Anchors". Area 9 is the first real area to place it (the owner's Q3): two anchor drops on its main path, each lowered 140 px, 2.4 s out of step, so the path dips under each anchor; Area 10 places five, four over its fork pocket and the lane mouth and one beside its climb, each lowered 300 or 320 px. The developer test area (`dev-danger-area`) has one too.
_Avoid_: hook, weight, moored trajinera (the canoe is part of the hazard)

**Mud seep**:
A **Moving hazard** from the floor (`'mud-seep'` in code): a seep in a low mud mound on the canal bed that sends a column of bubbles up from the mud to its height on a 5.6 s cycle, 180 px high (an area may set at most 260 px). Before each rise silt flakes lift off the mound and a jagged crack opens in the bed round it. The whole column costs a leg on touch (the owner's Q2); the water above its top is safe. It is never shown as fire, steam or a volcano. Its fact card is "Mud bubbles". Area 9 is the first real area to place it (the owner's Q3): two mud seeps, each 200 px high, one on the bed of the west branch and one under the second **Bailing bucket**'s boat, by the exit. Area 10 places six, from 180 to 240 px high: one in the lower lane, four under the bottom row's way east and one by the exit. The developer test area (`dev-danger-area`) has one too.
_Avoid_: volcano, fart, steam, geyser (a **Geyser vent** is a rock vent that bursts water)

**Pulsing current**:
A **Hazard** that pushes but never costs a leg (`'pulsing-current'` in code): a spring vent that blows a strong current along a band of water across the way, on a cycle on the element clock. Each cycle, from its own offset, it is calm for its area's calm time, at least 2 seconds, warns for 0.8 seconds while bubbles build at the vent's mouth, then surges for 1.5 seconds. Only the surge pushes, harder than any axolotl swims, so the axolotl crosses in the calm; the push stops at the band's edge, so a surge leaves the axolotl just past the band, in open water. A one-leg axolotl can always cross a band in its calm and warning. A surge is never a **Hit**: it costs no leg and starts no **Protected time**, so the Shell **Perk** plays no part. Under reduced motion the bubbles hold still and the surging band darkens; in greyscale the surging band has an ink outline. It is silent. It is met within 60 px of its band, and its fact card is "Underwater springs". It is not a **Moving hazard** and not a **Danger part**: it is not a threat for hiding spots (B10) or for the **Danger bar**, no treasure hides past it, and no gap is measured against it. Its whole band counts as a **Current** for **Snack** homes, even while calm. Which areas have one is in each area's own N2 paragraph in the PRD.
_Avoid_: geyser (a **Geyser vent** is a **Moving hazard**), jet, wind

**Murky water**:
A fixed patch of cloudy brown water (`'murky-water'` in code), a **Hazard** and Area 9's one new hazard (the owner's decisions on #107, ND-1; [ADR 0037](docs/adr/0037-hub-areas-murky-water-and-the-bailing-bucket.md)). A patch is a rect in area data, never placed by chance, and never moves. It touches nothing: swimming in never costs a leg and is never a **Hit**; only time inside does. While the axolotl's centre is in a patch, the murky timer builds up: the water looks cloudy, a dim ring shows round the axolotl, and a small ring meter over it fills. At 2 seconds the warning shows (a cheek tint in the **Queasy** tint's places and three little bubbles over the head). At 3 seconds one leg is due, through the same hit path as any **Hit**: a Shell **Perk** can block it, a lost leg starts **Protected time** and plays the **Uh-oh**, and losing the fourth leg means **Carried home**. Then the timer starts again at 0. The timer holds while **Protected time** runs. One second in clean water resets it to 0; a shorter time out holds it where it is, with no drain. It is fresh on each **Trip**, and a **Bailing bucket** catch resets it. The axolotl, every threat and the **Exit** stay visible inside a patch. Area 9 has 3 patches: two narrow ones, each 160 px wide, over the main path in the east branch, which a one-leg axolotl (90 px/s) crosses in under 2 seconds, and a wide one, 320 px, over the **Sunken trajinera**'s dead end in the west branch, where the optional treasure is. Area 10 has 2 patches: a narrow one, 120 px wide, over the main path on the bottom row, and a wide one, 280 px, over the **Sunken trajinera**'s dead end in the lower lane. Patches on the way to the **Exit** are at most 200 px wide. It is met when the axolotl's centre first enters a patch outside the **Home Spot**, and its fact card is "Dirty water". It is not a **Danger part**, not a **Moving hazard**, not a threat for **Hiding spots** (B10) or for the **Danger bar**, and no gap is measured against it; **Snack** homes and starts keep clear of it. Under reduced motion the cloud has no swirl, and the meter and tint stay; in greyscale each patch has a dotted outline. It is not **Dark water**: it hides nothing.
_Avoid_: poison, poisoned, toxic, sewage, sludge, pollution cloud, damage; dark water (that is **Dark water**)

**Bailing bucket**:
A moored trajinera's bucket that comes down on a rope to bail water, Area 9's **Timing element** (`'bailing-bucket'` in code; the owner's decision on #107, ND-2; [ADR 0037](docs/adr/0037-hub-areas-murky-water-and-the-bailing-bucket.md)). Area 9 has two bailing boats over the main path near the exit, half a cycle (3.5 s) out of step. Each 7 s cycle is a 5 s rest, a 1 s warning (the bucket's shadow and ripples on the water) and a 1 s dip. Only during the dip, a catch box under the bucket, 48 px wide and reaching 70 px down from the surface, catches an axolotl whose centre is in it. The bucket scoops it up, it peeks out of the bucket, never hurt, and it is tossed in a 1.2 s arc back along the main path to the boat's fixed landing spot, about 3 screens back toward the hub, out of every **Predator**'s reach with its **Leash**. It lands with no speed and swims on. A catch costs only distance: it never costs a leg, is never a **Hit**, drops no find and starts no **Protected time**, so the Shell **Perk** plays no part. During the toss legs keep regrowing and **Protected time** counts down, but no **Predator** warns at, chases or strikes the axolotl and no **Hazard** acts on it; a following **Stranded axolotl** waits, and **Go home** waits until it lands. It is not a **Predator**: it is never a bird or an animal, and nothing grabs, holds or lifts the axolotl. It is not a **Hazard**, a **Moving hazard** or a **Danger part**, so the **Danger bar** never counts it, though it is danger from the surface, so Area 9 has predators on the floor too. It has no **Fun-fact card**, is never met, and its catch and landing play no **Sound** (ND-5). Only the boat's plain painted hull, its post and the bucket show, with no person. Under reduced motion the axolotl fades out at the bucket and fades in at the landing spot; in greyscale the bucket and its shadow have ink outlines. **Snack** homes and starts keep clear of its catch box.
_Avoid_: grab, trap, net, hook, bird, predator, hazard; bucket alone in docs (the **Little bailing bucket** is a **Decoration**)

**Fishing trajinera**:
A whole festival-painted trajinera that drifts slowly back and forth over a span of the surface, at 12 px/s, and hangs one or more **Trajinera lures** on straight lines from rods at its hull's ends (`fishingBoats` in area data; issue #108, ND-1). Its hull is 120 px long. The boat itself never blocks, pushes or costs a leg: only its lures can. It is a surface boat, so no other surface boat is set over its drift span. It stops with the pause and the banking card. Only the boat, its rods and its lines show, with no person and no hook. Area 10 has three, 4 s out of step, holding five lures among the **Snacks**, out of every **Predator**'s strike.
_Avoid_: gliding trajinera (that boat pushes), moored trajinera (that boat never moves)

**Trajinera lure**:
A worm on a line under a **Fishing trajinera**, Area 10's one new **Hazard** (`'trajinera-lure'` in code; issue #108, ND-1). It looks exactly like a snack worm and bobs like one; its only tell is its line, running straight up to its boat with a float bead at the water line. Eating it costs a leg: when the head comes within the shared snack eat reach of the lure where it is drawn, one leg is due through the same hit path as any **Hit**, so a Shell **Perk** can block it and a lost leg starts **Protected time**. Touching its line, the lure without eating it or the boat's hull never costs a leg. Two lures in reach on one step land one hit. After a tug the lure is pulled up to its boat for 5 seconds, and it comes back only once the head is out of its reach, so it never returns onto the head. It is never a **Snack**: it is never counted, never speeds up **Regrowth** and never opens the **Exit**. It is a threat for **Hiding spots** (B10) and gaps are measured against it, but it is not a **Moving hazard**, not a **Danger part** and not a threat for the **Danger bar**. It is met within 120 px of a lure that is down, and its fact card is "Fishing lines". Under reduced motion it does not bob. Every lure is down again on **Carried home**.
_Avoid_: hook, bait, worm alone (a worm is a **Snack**), snack

**Drag net**:
A net swept between two empty boats across a stretch of water on a cycle, Area 10's **Timing element** and the first that costs a leg (`'drag-net'` in code, `dragNets` in area data; issue #108, ND-2). Each cycle is a quiet time, a warning (the floats rise and the boats lean; under reduced motion the floats light up) and a sweep, in which a front crosses the stretch from one edge to the other. The owner's default cycle is 7.5 s: 4 s quiet, a 1 s warning and a 2.5 s sweep; area data may set its own. During the sweep the net catches an axolotl whose centre is inside the stretch, on the side the front has already swept, and not in a **Safe hollow**: one leg is due through the same hit path as any **Hit**, at most once per sweep, so a Shell **Perk** can block it and a lost leg starts **Protected time**. **Tail Dash** gives no immunity. The net never moves, holds or traps the axolotl: it wriggles out where it is. From anywhere in a stretch, a one-leg axolotl that starts swimming when the warning starts can always reach a **Safe hollow** or leave the stretch before the front reaches it. It is a threat for **Hiding spots** (B10), but no gap is measured against it, and it is not a **Moving hazard**, not a **Danger part** and not a threat for the **Danger bar**. **Snack** homes and starts and the stranding places keep out of its stretch. It is met within 180 px of a stretch, and its fact card is "Fishing nets". Area 10 has two stretches on its main path: the first sweeps left on the default cycle, and the second sweeps right on a 3 s quiet, a 1 s warning and a 2 s sweep.
_Avoid_: ghost net (that only slows), trap, catch-and-hold; net alone in docs (say **Drag net**)

**Safe hollow**:
One of the two rects inside each **Drag net** stretch (area data) where its sweep never catches: an axolotl whose centre is in one, edges included, waits out the sweep. A hollow is always shown, as a darker shade, in every phase, so a kid can plan before the warning, and the net's mesh is never drawn over it.
_Avoid_: hiding spot (that is where a treasure hides), cave, safe area (that is the **Home Spot**'s)

**Sharp litter**:
A dented can or a glass bottle with a chipped neck lying still on the lakebed (`'sharp-litter'` in code), a fixed **Hazard** that costs a leg. It never moves and never pushes. A body centre within its touch reach, 18 px past its 10 px circle (the **Ghost net**'s reach), costs one leg through the same hit path as any **Hit**, from the litter's centre, so the Shell **Perk** can block it and **Protected time** follows. It is a threat for **Hiding spots** (B10) and **Snacks** keep clear of it, but it is not a **Moving hazard**, not a **Danger part** and not a moving threat for the **Danger bar**. The darkness never hides it: it draws over **Dark water**, with a pale rim that reads on near-black water. It looks gentle and toy-like: round corners and smooth dents, with no shard, spike, jagged edge or red, and a hit shows only the **Leg loss** poof. "Sharp" is its rule, not its look. It is met within 120 px of its edge, and its fact card is "Litter in the water".
_Avoid_: rubbish or trash alone (a **Trash batch** is the **Refuge**'s), shard, broken glass, plastic worm (a **Plastic worm** only slows)

**Telegraph**:
A predator's or **Moving hazard**'s visible warning before a lunge or a jab; the tilapia's is a glint and a wind-up pose, the heron's is freezing and pulling its neck into an S, the garter snake's is stopping in a held S with ripple rings spreading from its head, the common carp's is tipping its nose down with a mud puff, the crayfish's is stopping with its claws raised and opened wide, the cormorant's is its dive crouch, neck arched down until its closed bill touches the water and tail tipped up, the punting pole's is the boat's shadow darkening while the pole's tip dips with a ripple ring, the stalactite drip's is a drop swelling at the tip with ripple rings just under the drop, the geyser vent's is bubbles rising from its mouth with a shimmer ring, the anchor drop's is two chain links fading in under the boat with wavy ripple lines spreading under it, and the mud seep's is silt flakes lifting off its mound with a jagged crack opening round it.

**Lunge**:
A predator's strike; the tilapia's is a quick dash at the axolotl, the heron's is a stab with its beak at the spot where the axolotl was when its S-neck began, the garter snake's is a straight dart along the aim fixed at the end of its warning, the common carp's is a slow, wide tail sweep along the aim fixed at the end of its warning, the crayfish's is a pinch straight forward along the floor, toward the axolotl's side, and the cormorant's is a dive along its **Dive arc**.

**Hit**:
A predator's strike, a **Hazard** that costs a leg, or a **Drag net**'s catch, that connects.

**Protected time**:
A short time after a hit when no second hit can land.
_Avoid_: invulnerability (in UI)

**Legs display**:
The axolotl's health, shown as leg icons: one icon for each leg, present, regrowing or lost. The first-hit tip card explains it after the first **Hit** that costs a leg.
_Avoid_: HP, hearts, health bar (in the UI)

**Leg loss**:
Losing one leg to a hit, shown as a gentle sparkle poof.
_Avoid_: injury, wound, damage

**Regrowth**:
A lost leg growing back.
_Avoid_: healing

### Treasures

**Treasure**:
A hidden collectible: a Decoration, a Wearable, or a Paint shell.
_Avoid_: loot

**Rarity**:
How rare a treasure is: Common, Rare, Epic, or Legendary.

**Decoration**:
A treasure placed in the Home Tank. Each has one Placement kind and a footprint width, 80 tank units unless its catalogue entry sets a wider one.
_Avoid_: loot

**Wearable**:
A treasure an axolotl can wear.
_Avoid_: loot

**Paint shell**:
A hidden treasure that holds one Dream colour.

**Dream colour**:
A fantasy colour, not found in nature, that can be put on any owned axolotl; solid ones are Common or Rare, and patterned and sheen ones are Legendary, except Hearts, Tie-dye, and Iridescent, which came first and stay Epic. Each new area adds at least 2 Dream colours, at least one of them a Legendary patterned or sheen colour; Areas 1 to 5 came before this rule. There are 31: 9 from the canal, Lily green from Area 2, Firefly gold and Galaxy from Area 3, Poppy red and Rainbow from Area 4, Plum and Tie-dye galaxy from Area 5, Moonstone and Crystal shine from Area 6, Chocolate and Glowworm from Area 7, **Jade** and **Fiesta shine** from Area 8, **Olive** and **Lantern shine** from Area 9, Peach (`'peach'` in code, a soft peach, Rare) and Confetti shine (`'confetti-shine'` in code, a Legendary grape-violet sheen with gliding pink and lemon stripes) from Area 10, and **Marigold**, **Golden shine**, **Lime**, **Hyacinth** and **Lagoon shine** from Area 11, which makes 31.
_Avoid_: skin

**Jade**:
Area 8's solid **Dream colour** (`'jade'` in code), a deep blue-green, Rare, held by the **Deep canal**'s first Paint shell.

**Fiesta shine**:
Area 8's Legendary sheen **Dream colour** (`'fiesta-shine'` in code), a fiesta pink with a stripe that glides along the body, held by the **Deep canal**'s second Paint shell. It shares the live stripe with Iridescent and Crystal shine ([ADR 0031](docs/adr/0031-sheen-dream-colours-share-the-live-stripe.md)).

**Olive**:
Area 9's solid **Dream colour** (`'olive'` in code), a yellow-green olive, mid-dark in greyscale, Rare, held by the first Paint shell of Area 9 (the owner's treasure list on #107).

**Lantern shine**:
Area 9's Legendary sheen **Dream colour** (`'lantern-shine'` in code), a glowing lantern orange with a candle-cream stripe that glides along the body, held by the second Paint shell of Area 9. It shares the live stripe with Iridescent, Crystal shine and **Fiesta shine** ([ADR 0031](docs/adr/0031-sheen-dream-colours-share-the-live-stripe.md)).

**Little bailing bucket**:
Area 9's **Special treasure** (`'deep-canal/little-bailing-bucket'` in code), a Rare Floor **Decoration**, from the owner's treasure list on #107. It is one of Area 9's 13 treasures, all new: the owner's 12 (6 **Decorations**, 5 **Wearables** and the **Olive** Paint shell) and the **Lantern shine** Paint shell. When Area 9 is beaten without it, the Area beaten card says "Find the Little bailing bucket next time."
_Avoid_: bailing bucket alone (the **Bailing bucket** is Area 9's **Timing element**)

**Marigold**:
Area 11's solid **Dream colour** (`'marigold'` in code), a warm marigold, Rare, held by the first Paint shell of Area 11.
_Avoid_: Marigold boat (that is an Area 10 **Decoration**), marigold petals (scenery of the **Golden hour look**)

**Golden shine**:
Area 11's Legendary sheen **Dream colour** (`'golden-hour-shine'` in code), a deep golden-hour gold with sunset rose and pale gold stripes that glide along the body, held by the second Paint shell of Area 11. Its name was shortened from Golden hour shine to fit the cards. It shares the live stripe with the other sheen Dream colours ([ADR 0031](docs/adr/0031-sheen-dream-colours-share-the-live-stripe.md)).

**Lime**:
Area 11's Common solid **Dream colour** (`'lime'` in code), a zesty lime green, held by the third Paint shell of Area 11 (the owner's treasure list on #207).

**Hyacinth**:
Area 11's Rare solid **Dream colour** (`'hyacinth'` in code), a water hyacinth violet, held by the fourth Paint shell of Area 11 (the owner's treasure list on #207).
_Avoid_: hyacinth alone for the **Water hyacinth mat**, the water hyacinth rafts of the **Golden hour look** or the Flower raft (an Area 11 **Decoration**)

**Lagoon shine**:
Area 11's Legendary sheen **Dream colour** (`'lagoon-shine'` in code), a lagoon blue with sea foam and coral stripes that glide along the body, held by the last Paint shell of Area 11 (issue #207). It shares the live stripe with the other sheen Dream colours ([ADR 0031](docs/adr/0031-sheen-dream-colours-share-the-live-stripe.md)).

**Little cormorant**:
Area 11's **Special treasure** (`'deep-canal/little-cormorant'` in code), a Rare Floating **Decoration**: a friendly pale toy of the area's diving bird. It is one of Area 11's 14 treasures, all new: the Little cormorant, the **Marigold** Paint shell and the **Golden shine** Paint shell from #112, then the 11 from the owner's list on #207: the Flower raft, the Festival kite and the Carousel (3 **Decorations**), the Propeller cap, the Star sunglasses, the Robot suit, the Jetpack and the Wizard hat (5 **Wearables**, the Propeller cap, the Jetpack and the Wizard hat as **Big Wearables**), and the **Lime**, **Hyacinth** and **Lagoon shine** Paint shells.
_Avoid_: cormorant alone (the **Cormorant** is a **Predator**)

**Treasure Chest**:
The list of every catalogue Decoration, Wearable, and Dream colour: owned ones in full, with their rarity glow, and unfound ones as silhouettes with "???" and an area and rarity hint, with a line per section saying what its items are for. Its filters narrow the list by type, found or not found, rarity, and area, several at once, and its area progress shows how many of each area's treasures are found, or "All found!". The filter lasts while the game is open and is never saved.
_Avoid_: inventory

**First-find card**:
A once-per-save card in the Home Tank, after the tank arrival card's OK, that explains the first Decoration, Wearable, or Paint shell banked; the Paint shell card's "Try it now!" opens restyle on the Dream colour tab.
_Avoid_: tutorial, popup

### Axolotls and outfits

**Morph**:
An axolotl colour type, such as Leucistic or Wild.

**Real morph**:
One of the eight true axolotl morphs: Leucistic, Wild, Golden albino, White albino, Copper, Piebald, Axanthic, or Melanoid.

**Character creator**:
The step-by-step screens at first launch where the player makes a starter axolotl: 11 steps, one choice per step, from Colour to Name.

**Picture button**:
A big button on a creator or restyle step that shows one option as a small preview on the axolotl so far.

**Name box**:
The field on the Name step where the player types the axolotl's name; it looks typeable, with a light inset field, a pencil, the "Type a name" placeholder, and a blinking cursor while focused.

**Restyle**:
Changing an owned axolotl's look and name in the Home Tank, on the creator's step screens with tabs, putting on or taking off its **Dream colour** on its own tab, and choosing its **Outfit** on the Outfit tab; Colour and **Boy or girl** cannot change.

**Boy or girl**:
Whether an axolotl is a boy or a girl; exactly one, always set, and fixed after creation.
_Avoid_: gender; "sex" in UI text; "they" or "it" for one axolotl

**Tail**:
The look option for how long an axolotl's tail is: Short, Medium, or Long; looks only.

**Body**:
The look option for an axolotl's body shape: Slim, Regular, or Chubby; looks only.

**Age**:
The look option for how grown-up an axolotl looks: Baby, Young, or Grown-up; it changes proportions only, never size.

**Size**:
How big an axolotl is drawn: Small, Medium, or Large; looks only, with the same hit area and speed at every size.

**Stranded axolotl**:
A lost axolotl in the canal waiting to be rescued, on about 4 trips in 10 (C2); one left waiting always comes back on the next trip in that area.

**Rescue**:
Leading a stranded axolotl home and banking it.

**Outfit**:
The Wearables one axolotl has on, one per slot at most.

**Slot**:
One of eight places a Wearable goes: Head, Neck, Face, Shirt, Back, Tail, Socks, or Feet.

**Big Wearable**:
A Head or Back **Wearable** drawn inside its slot's big footprint, which grows only away from the body and keeps every keep-clear rule of its slot ([ADR 0040](docs/adr/0040-big-wearables-larger-head-and-back-footprints.md)): the Propeller cap, the Wizard hat and the Jetpack. Its visible paint always stays under the axolotl's own, so the axolotl stays the hero. Every other Wearable keeps its slot's usual footprint; there is no big Face footprint, so the Star sunglasses are not one.
_Avoid_: big hat (the Jetpack is one too)

**Perk**:
The one small gameplay bonus a Wearable gives on trips.
_Avoid_: stat, buff (in UI)

**Perk cap**:
The hard limit on the total of one perk type in an outfit.

### Home

**Home Tank**:
The hub where owned axolotls live and decorations are placed.
_Avoid_: fish tank (axolotls are amphibians)

**Placement kind**:
Where a Decoration goes in the Home Tank, set in its catalogue entry: Floor (the default; it stands on the gravel and moves left, right, and a little up and down), Floating (it rests on the water surface), or Hanging (it hangs from the glass top). Floating and Hanging Decorations move left and right only.
_Avoid_: slot (a Slot is where a Wearable goes)

**Collection Book**:
The in-game book of morphs and fact cards, nicknamed the Axolotl-dex in game.

**Fun-fact card**:
A short, true fact about axolotls or their world. Besides the morph facts, the **Collection Book** lists 24 fact cards, in this order: the tilapia card, "Meet the carp" (the **Common carp**), "Plastic is not food" (the **Plastic worm**), the tadpole card, "Freshwater shrimp" (the **Freshwater shrimp**), the heron card, "Lost fishing nets" (the **Ghost net**), "Trajineras" (the **Punting pole**), "Meet garter snakes" (the **Garter snake**), "Water hyacinth" (the **Water hyacinth mats**), "Meet the crayfish" (the **Crayfish**), "Stalactites" (the **Stalactite drip**), "Geysers" (the **Geyser vent**), "Underwater springs" (the **Pulsing current**), "Meet the black bass" (the **Black bass**), "Dirty water" (the **Murky water**), "Anchors" (the **Anchor drop**), "Mud bubbles" (the **Mud seep**), "Fishing lines" (the **Trajinera lure**), "Fishing nets" (the **Drag net**), "Meet the cormorant" (the **Cormorant**), "Axolotl refuges", "Canal clean-ups", and "Boy or girl?".

**Save**:
Progress kept in device storage by itself: banked treasures, the axolotls, the tank, the Collection Book, stars, the last chosen area, and the fact cards found (`metHazards`: the hazards, predators and timing elements met, then the refuge fact cards found); never anything from a trip in progress, and never the refuge's pending clean-ups and milestones.
_Avoid_: banking (banking moves trip finds to ownership)

**Start over**:
Erasing all saved progress on this device after two confirmations, from the title screen; it also clears the refuge's pending clean-ups and milestones.

### Refuge

**Refuge**:
The safe axolotl refuge in Xochimilco, opened by the Refuge tile, the fifth and last Home Tank action, that grows as areas are beaten (N2). It has one **Refuge section** per **Habitat**, and it is worked out from the saved **Stars** alone, so nothing about it is saved. It has no end: a dim "More to come" section closes it, and later areas and habitats add to it.

**Refuge section**:
One **Habitat**'s part of the **Refuge**, in area-table order: hidden ("???" and "Beat Area N") until one of its areas is beaten, clean once every one is, else dirty, still tinted with its remaining trash. It has one **Trash batch** per **Area** in its habitat, so the Chinampa gardens section has two (Area 4 and Area 5). A save that had cleaned it by beating Area 4 sees it dirty again with Area 5's batch until Area 5 is beaten.

**Trash batch**:
One **Area**'s trash in its habitat's **Refuge section**, cleared once that area is beaten. When the refuge next opens, the cleared trash floats up and fades with a sparkle (the clean-up).

**Habitat milestone**:
A **Trip** that newly makes a **Refuge section** clean. Back in the **Home Tank**, after the tank arrival card and its **First-find cards**, the "All clean!" card names the trip's **Explorer** and the habitat; "See it again" in the refuge shows it again, naming the current **Explorer**.
_Avoid_: finale, ending, "refuge complete"

**Refuge nudge**:
The "Refuge grew" badge on the Refuge tile, a pink disc with an ink ring and an ink star, shown while a clean-up is waiting to play.

### After the MVP

**Tank Top Model**:
Trying on Wearables and posing in a spotlight, started from the Home Tank (N1); not in the MVP.

**Wearable set**:
A themed group of Wearables, named by a Wearable's optional set ID, that unlocks a small bonus when worn together (N5).

### Music

**Cue**:
One piece of background music, an 8-bar loop that changes a little each time round. The Home cue plays on the Home side, and each habitat has its own cue (N6, M1 to M3).
_Avoid_: track, song (in specs)

**Dusk version**:
A habitat cue played the dusk way: the same tune and chords, slower, on a music box, with soft chords, no drums, and fireflies. Dusk and night areas play it (the dusk rule, M4): Area 3, the pond at dusk, and Area 11, whose **Golden hour look** is dusk.
_Avoid_: night song, dusk theme

**Music switch**:
The on/off control for background music, kept on the device outside the save (M8).
_Avoid_: mute button

### Sound effects

**Sound**:
A short sound effect for one moment, such as eating a snack or a find, made live in code (N7, S1).
_Avoid_: sfx, sample (in specs)

**Sounds switch**:
The on/off control for sound effects, kept on the device outside the save (S14).
_Avoid_: mute button

**Snack ladder**:
Snacks eaten close together each play one note higher, starting again after a pause (S3).
_Avoid_: combo

**Uh-oh**:
The sound for a lost leg: two soft, low notes falling a small step, answered by the leg-back sound (S5).
_Avoid_: hit sound, hurt sound

**Ripple**:
The warning sound: a soft water swish with two low notes, played once when a **Predator**'s **Telegraph** starts, or a **Moving hazard**'s with its sweep on screen where it really is, from the surface, a roof or the floor, never repeating or building (S9). Not the ripple rings drawn in some telegraphs.
_Avoid_: alarm, warning beep

**Lullaby**:
The sound for being **Carried home**: a soft held home chord under a slow music box line falling gently to the home note, with bubbles floating up; it waits for the **Uh-oh** to finish (S10).
_Avoid_: carry sound, defeat sound

## Relationships

- A **Trip** has exactly one **Explorer**, starts at the **Home Spot** in the **Area** picked on the **Area map**, and ends by **Go home**, **Carried home**, or reaching the open **Exit**
- Only the **Explorer**'s **Outfit** applies on a **Trip**
- A **Trip** has one **Trip Bag**, which holds zero or more **Trip finds**
- A **Trip find** is either a **Treasure** or a rescued **Stranded axolotl**
- **Banking** at the **Home Spot**, **Go home**, or reaching the open **Exit** empties the **Trip Bag** into permanent ownership
- **Carried home** sends every unbanked **Trip find** back into the **Area** and starts the **Snacks** over; banked items and **Stars** are untouched
- An **Area** has exactly one **Exit**, one **Special treasure**, many **Snacks**, many **Hiding spots**, and up to 3 **Stars**
- An **Area** belongs to exactly one **Habitat**; a **Habitat** holds one or more **Areas**
- Each **Area** adds at most one new **Hazard** or **Predator** and at most one new timing or puzzle element that no earlier **Area** has; **Danger parts** and **Mobile snacks** do not count toward either
- Area 1 is always unlocked, and beating Area N (earning its exit **Star**) unlocks Area N+1; there are no star gates, and any unlocked **Area** can be replayed from the **Area map**
- The **Exit** opens only when every **Snack** in its **Area** is eaten
- Each **Trip** fills its **Area**'s **Treasure slots** with unbanked **Treasures**, each slot's **Rarity** picked by chance, plus any lost **Treasures** and the unbanked **Special treasure** on top, and one **Hiding spot** per **Treasure** picked for that **Trip**, from that **Treasure**'s pool; no two **Treasures** share a spot in one **Trip**
- A Legendary **Treasure** always hides deep (in a cave or other hollow, past a **Current**, or in band 3 or deeper of an **Area** with **Depth bands**) and within half a threat's strike reach, either in a **Dash pot**, which only **Tail Dash** can break, or in the open in an **Area** with a threat; a **Dash pot** holds only a Legendary
- A **Hint sparkle** marks a hidden **Treasure** when the axolotl is near, and each of the last 3 **Snacks**
- A **Predator** is a **Hazard**, and a **Tilapia**, a **Heron**, a **Garter snake**, a **Common carp**, a **Crayfish**, a **Black bass**, a **Cormorant** and a **Mud turtle** are **Predators**; a **Predator**'s **Telegraph** always comes before its **Lunge**, whether its warning starts by distance or on sight, and only one **Predator** in an **Area** warns or lunges at a time, a **Heron**, a **Garter snake**, a **Common carp**, a **Crayfish**, a **Cormorant**, a **Mud turtle** and a **Tilapia** included
- A **Mud turtle** never chases: it snaps to the spot fixed when its warning started and holds still through its cooldown, so swimming away dodges it
- A **Cormorant** warns only while it is on its stretch and dives along a **Dive arc** no deeper than its lunge range below its stretch, so the water below its dive, and an axolotl in cover, are out of its reach; it is surface danger, so its **Area** also has **Predators** on the floor, and it never touches, bumps, grabs or holds the axolotl
- A **Crayfish** warns only while it is on its floor stretch, and its pinch stays level along the floor, so the water above its reach is out of its reach
- A **Garter snake** warns only while its head is on its stretch, so the water below y 260, the whole bottom row included, is out of its reach
- A **Predator** with the **Chase rule** chases only on patrol and within its **Leash**; chasing is not warning or lunging, so any number of **Predators** may chase at once, and a **Garter snake** chases along its stretch only
- A **Moving hazard** is a **Hazard** that costs a leg, but not a **Predator** and not a **Timing element**; its **Telegraph** always comes before its jab, and it keeps its own cycle whatever the **Predators** do
- A **Drifting ghost net** is a **Ghost net**: it only slows, it is never a **Hit**, and it is never a threat for **Hiding spots** (B10)
- A **Mobile snack** is a **Snack** with a **Home area**; a **Tadpole** swims its **Wander loop** forever, a **Freshwater shrimp** hops round its hop spots and flicks away again after each rest, and in an **Area** with **Freshwater shrimp** no **Snack** darts once
- A **Water hyacinth mat** is a **Timing element**, not a **Hazard**: it blocks only the **Explorer**, never costs a leg and is never a **Hit**, so the Shell **Perk** plays no part
- A **Glow-plant** is a **Puzzle element**, not a **Hazard** and not a **Timing element**: it never blocks, never costs a leg and is never a **Hit**, so the Shell **Perk** plays no part
- A **Pebble** is a **Puzzle element** that blocks only the **Explorer**: it rolls one way only, never costs a leg and is never a **Hit**, and every **Pebble** starts each **Trip** at the start of its groove
- A **Fading light** is a **Puzzle element**, not a **Hazard** and not a **Timing element**: it never blocks, never costs a leg and is never a **Hit**; a touch lights or relights it to full, its light fades out after its last touch, and every light starts each **Trip** unlit
- A **Side room** sits behind **Rock walls** and a **Pebble**; the **Exit** never needs it, and no **Snack** starts in it
- A **Rock wall** blocks the **Explorer**'s body and every **Predator**'s moves, is never a **Hit**, and is not water for the **Danger bar**; a **Predator** never senses, chases or strikes through one
- A **Lane divider** is made of **Rock walls** and splits a **Two-lane area** into a surface lane and a deep lane that join at the Home Spot's pocket and the exit pocket; the **Exit** is reached along the surface lane
- A **Hub area** starts at a **Home Spot** mid-area and branches both ways; the **Exit** is down one branch, the main path never turns back toward the other, and the treasure is down the other branch
- A **Gliding trajinera** is a **Timing element**, not a **Hazard**: it pushes the **Explorer** aside at 120 px/s, never costs a leg and is never a **Hit**, so the Shell **Perk** plays no part; a **Moored trajinera** and a **Sunken trajinera** are scenery that never move or push
- A **Bailing bucket** is a **Timing element**, not a **Hazard** and not a **Predator**: its catch never costs a leg, is never a **Hit**, drops no find and starts no **Protected time**, so the Shell **Perk** plays no part; a catch resets the **Murky water** timer, and while the axolotl is tossed no **Predator** warns at, chases or strikes it
- A **Trajinera lure** is a **Hazard** that costs a leg only when eaten: touching its line or its **Fishing trajinera** never does; it is never a **Snack**, and a lure pulled up never comes back onto the head
- A **Drag net** is a **Timing element** that costs a leg: its sweep catches an axolotl in its stretch and not in a **Safe hollow**, at most once per sweep, through the same hit path as any **Hit**, so the Shell **Perk** can block it; it never moves, holds or traps the axolotl
- An **Area** with **Depth bands** is in the **Open lake** (Area 12 is the first); each band is darker than the one above it, hides only what **Dark water** hides, and sets the **Rarity** of the treasure spots in it, with the **Special treasure** in the deepest band
- A **Pelican line** costs a leg and is a **Hit** through the same hit path as any other; it is not a **Predator** on the **Chase rule**, but its warning always comes before its dip, and it counts for the **Danger bar** as moving threats, one per bird
- **Wind and waves** is a **Timing element**, not a **Hazard**: it pushes only the **Explorer** along the surface band, fades to calm by the second **Depth band**, is calm at the **Home Spot**, and never moves a **Snack** or a **Predator**; it differs from a **Current** (steady, fixed in place, treasure hides past it) and from a **Pulsing current** (one fixed band on a cycle)
- A **Pulsing current** is a **Hazard** that never costs a leg: a surge is never a **Hit**, it is not a threat for **Hiding spots** (B10) or for the **Danger bar**, and its whole band counts as a **Current** for **Snack** homes
- **Murky water** is a **Hazard**, not a **Danger part**, a **Moving hazard** or a **Predator**: touching it is never a **Hit**, and only 3 seconds of time built up inside costs a leg, through the same hit path as any **Hit**, so the Shell **Perk** can block it; it is never a threat for **Hiding spots** (B10) or for the **Danger bar**
- An **Area** has at most one **Dark water**; each **Glow-plant** sits in it, and a lit **Glow-plant** stays lit until the **Trip** ends, then every plant starts the next **Trip** unlit
- **Dark water** may hide a **Snack**, a treasure spot, its **Hint sparkle** and a find outside every light, but never anything that warns or costs a leg; a **Snack** in it shows in the axolotl's own glow before it is in reach, the **Exit** keeps its faint glow, and every **Glow-plant** and every **Fading light**'s dim outline shows, so the **Area** can always be finished with no plant or light lit
- A **Hit** is a **Lunge** that connects, a touch on a **Hazard** that costs a leg, an eaten **Trajinera lure** or a **Drag net**'s catch; it starts **Protected time** and causes exactly one **Leg loss**, except a hit blocked by a Shell **Perk** (at most one per trip), which costs no leg; a **Hazard** that only slows never hits
- Eating a **Plastic worm** makes the **Explorer** **Queasy**; it is not a **Hit**, so the Shell **Perk** plays no part, and it costs no leg
- Swimming into a **Ghost net** makes the **Explorer** **Snagged**, never a following **Stranded axolotl**; it is not a **Hit**, so the Shell **Perk** plays no part, it starts no **Protected time**, and it costs no leg
- A **Ghost net** is never a threat for **Hiding spots** (B10); each **Area**'s **Tilapia** risk bands come from that area's own strike reach
- The first time the **Explorer** meets a **Hazard**, **Predator**, or **Timing element** that carries a card, its **Fun-fact card** shows, once per **Save**
- Each **Leg loss** is undone by **Regrowth**, one leg at a time; eating a **Snack** speeds up **Regrowth**
- Losing the fourth leg means the axolotl is **Carried home**
- A **Treasure** is exactly one of **Decoration**, **Wearable**, or **Paint shell**, and has exactly one **Rarity**
- Each **Decoration** has exactly one **Placement kind**: Floor, Floating, or Hanging; the **Save** keeps only where it is placed, and its kind comes from the catalogue
- A **Paint shell** holds exactly one **Dream colour**; banking it makes that **Dream colour** owned
- One owned **Dream colour** can be on any number of owned axolotls; an axolotl shows at most one at a time
- A **Wearable** fits exactly one **Slot**, gives exactly one **Perk**, and may belong to one **Wearable set**
- An **Outfit** holds at most one **Wearable** per **Slot**; each **Perk** type in it is limited by its **Perk cap**
- Each axolotl has exactly one **Real morph**; a **Dream colour** draws on top of it and never changes it
- Each axolotl has exactly one **Boy or girl**, fixed after creation; text about one axolotl says he or she, never they or it
- **Restyle** can change **Tail**, **Body**, **Age**, **Size**, face, gills, spots, and name, can put on or take off the applied **Dream colour**, and can change the **Outfit** on the Outfit tab, but never the **Real morph** or **Boy or girl**; none of these looks changes the hit area or speed, and only the **Perks** of the **Explorer**'s **Outfit** change play, on a **Trip**
- The starter axolotl's **Real morph**, chosen in the **Character creator**, decides which seven **Real morphs** can be **Stranded axolotls**
- Each **Trip** has at most one **Stranded axolotl**, on about 4 trips in 10, or always when one is left waiting from the last **Trip** in that **Area**; a **Rescue** moves it into the **Home Tank** and unlocks its **Morph** in the **Collection Book**
- The **Treasure Chest** lists every catalogue **Decoration**, **Wearable**, and **Dream colour**: owned ones in full with their **Rarity** glow, unfound ones as silhouettes with "???" and an **Area** and **Rarity** hint, and a line per section saying what its items are for; its filters narrow the list by type, found or not found, **Rarity**, and **Area**, and each **Area** shows how many of its treasures are found; placed **Decorations** live in the **Home Tank**
- The **Collection Book** holds one entry per **Real morph**, each with a **Fun-fact card**, and lists **Dream colours** separately as not found in nature
- The **Refuge** has one **Refuge section** per **Habitat** that holds an **Area**, and each **Refuge section** has one **Trash batch** per **Area** in it; beating an **Area** (its exit **Star**) clears its **Trash batch**
- A **Trip** in a real **Area** that newly beats it adds a pending clean-up, and one that newly makes a **Refuge section** clean adds a **Habitat milestone**; both live in memory only, a dev area **Trip** or a replay adds neither, and the **Refuge nudge** shows while a clean-up is pending
- The **Refuge** holds two **Fun-fact cards**, "Axolotl refuges" (first visit) and "Canal clean-ups" (the first time cleared trash shows); the **Collection Book** lists them after the **Hazard** cards and before "Boy or girl?"
- The **Collection Book** lists the **Hazard**, **Predator** and **Timing element** **Fun-fact cards** in area-table order, each area's element cards after its threat cards: the tilapia, the **Plastic worm**, the **Heron**, the **Ghost net**, the **Garter snake**, the **Water hyacinth mat**, the **Crayfish**, the **Pulsing current**, the **Black bass**, then Area 9's **Murky water**, **Anchor drop** and **Mud seep**, then Area 10's **Trajinera lure** and **Drag net**, then Area 11's **Cormorant**; a **Puzzle element** or **Timing element** without a card, such as the **Bailing bucket**, adds none

## Example dialogue

> **Dev:** "When the **Explorer** gets **Carried home** with a **Paint shell** in the **Trip Bag**, does the player keep the **Dream colour**?"
> **Domain expert:** "No. It was only a **Trip find**, never banked, so it goes back into the canal and hides in a freshly picked **Hiding spot** next **Trip**. Only **Banking** at the **Home Spot**, choosing **Go home**, or reaching the open **Exit** makes it owned."
> **Dev:** "And the **Snacks** they ate? Are those banked too?"
> **Domain expert:** "**Snacks** are never **Trip finds**. Being **Carried home** starts them all over, so the **Exit** closes again until every one is eaten. **Stars** already earned stay."

## Flagged ambiguities

- "zone" (the README, the PRD problem statement and A1, and `src/logic/zone.ts` with `ZoneLayout` and `ZONE_W`) and **Area** both name the canal: resolved: **Area** is the domain term; "zone" is the swim-test name that survives in code.
- "collectible" means **Snacks** in code (`src/logic/collectibles.ts`, `CollectibleKind = 'worm' | 'bug' | 'tadpole' | 'shrimp'`) but the PRD defines a **Treasure** as "a hidden collectible": resolved: say **Snack** for worms, bugs, tadpoles and shrimp and **Treasure** for hidden finds; avoid "collectible" for either in new work.
- "hint star" (art style guide 7e) and "hint sparkle" (PRD B7 and H3) name the same cue: resolved: **Hint sparkle**, matching the PRD; the PRD lists an art style guide follow-up (issue #31). Art style guide 7e now covers the snack sparkle (#31); the guide-wide "hint star" to "hint sparkle" rename is a follow-up.
- "slot" means a Wearable **Slot** in the PRD, but code also has `LegSlot` (one leg in the legs display) and `CardSlot`: resolved: **Slot** alone always means a Wearable slot; say "leg" for legs. A **Treasure slot** is not a Wearable **Slot**: always say "treasure slot" in full.
- "Go home" and **Carried home** both end a trip and both send the axolotl home: resolved: distinct concepts; **Go home** is the player's choice and banks first (`wentHome` in code), **Carried home** follows the fourth **Leg loss** and loses unbanked finds (`carriedHome` in code).
- "sex" in code (`AxolotlSex`, the `sex` look field, the `sex` styler step) means **Boy or girl** in the UI: resolved: say **Boy or girl** in UI text and docs; "sex" survives in code only.
- "Tail" names three things: the **Tail** look option (tail length), the Tail Wearable **Slot**, and **Tail Dash**: resolved: **Tail** alone means the look option; say "Tail slot" for the Wearable slot and **Tail Dash** for the power.
- "medium" (`'medium'`) is an id of both **Tail** and **Size**: resolved: always name the field with it (Medium tail, Medium size); the ids are distinct per field.
- "Tilapia" and "predator" were used for the same fish (PRD glossary, `src/scenes/PredatorView.ts`, `src/art/predatorTextures.ts`): resolved: a **Predator** is the kind of **Hazard** that hunts, and the **Tilapia** is the first **Predator**; say **Tilapia** for the fish, and avoid "monster".
- "habitat" was another name for one **Area** before the area framework (#73): resolved: a **Habitat** is a group of **Areas** that share a look.
- `tilapiaRoutes` and `predatorRoutes` both hold predator patrol routes in area data: resolved: the **Tilapia** keeps its own `tilapiaRoutes` column, matching the PRD area table's tilapia column, and every other species goes in `predatorRoutes`.
- `metHazards` (the hub's met list) holds **Predator** ids too, such as `'tilapia'`, and, since the **Refuge** (#74), the refuge fact card ids `'axolotl-refuges'` and `'canal-clean-ups'`: resolved: it is the list of **Fun-fact cards** found, hazards, predators and timing elements (such as `'water-hyacinth'`) met first, then the refuge cards. The name stays, because renaming a saved field needs a save version bump ([ADR 0017](docs/adr/0017-xochimilco-refuge-and-habitat-milestones.md)).
- "dark" names both the **Dark water** (`darkWater` in area data) and a dusk or night look, whose time of day picks the **Dusk version** of a **Cue**: resolved: **Dark water** is one part of an area's layout that hides things outside its lights, and it never changes the music; a night look is a whole area's colours.
- "vent" names both the **Geyser vent**, a **Moving hazard** on the floor that costs a leg, and a **Pulsing current**'s vent, which only pushes: resolved: say **Geyser vent** in full for the hazard, and **Pulsing current** (or "pulsing vent") for the vent that blows a band of water.
- "current" names both the steady **Current**, which treasure hides past, and a **Pulsing current**: resolved: **Current** alone is the steady one; a **Pulsing current** counts as one only for **Snack** homes.
- "wall" names a **Rock wall**, which blocks the **Explorer** for good, and, loosely, a closed **Water hyacinth mat** or the rock walls drawn at a row's ends: resolved: a **Rock wall** is only solid rock in `rockWalls`; a mat is a **Timing element**, and the row-end rock is scenery that the swim bounds already hold.
- "anchor" names both the **Anchor drop**, a **Moving hazard** that costs a leg, and an anchor point, a texture's origin in the art code: resolved: say **Anchor drop** in full for the hazard and "anchor point" for a texture origin.
- The **Mud seep**, the **Geyser vent** and the **Common carp**'s mud puff all send up mud or bubbles: resolved: the **Mud seep** is a **Moving hazard** whose bubble column rises from a mud mound and costs a leg; the **Geyser vent** is a **Moving hazard** whose column of water and bubbles bursts from a rock vent and costs a leg; the mud puff is only the carp's **Telegraph** and never costs a leg. Say **Mud seep** and **Geyser vent** in full, and "mud puff" only for the carp's warning.
- "worm" names both a **Snack** (`CollectibleKind` `'worm'`) and the **Plastic worm** (`'plastic-worm'`): resolved: a worm alone is a **Snack**; always say **Plastic worm** in full for the hazard.
- The **Ghost net**'s fact card is titled "Lost fishing nets", and its name in the **Collection Book** is "Ghost net": resolved: **Ghost net** is the domain term; "Lost fishing nets" is only the card's title.
- "bank" names the top-row bank art (`bankChunks` in area data, drawn as willows in the canal and the pond and as garden plots in the Chinampa gardens) and the bank cover of **Hiding spots** (`'bank'`, from `bankOverhangs`): resolved: the bank cover comes only from `bankOverhangs`, never from `bankChunks`, so the canal's and the pond's **Hiding spots** are unchanged.
- "bucket" names the **Bailing bucket** (`'bailing-bucket'`, Area 9's **Timing element**), the **Little bailing bucket** (`'deep-canal/little-bailing-bucket'`, Area 9's **Special treasure**) and the Bucket hat (`'deep-canal/bucket-hat'`, a Head **Wearable**): resolved: say **Bailing bucket** in full for the boat's bucket, **Little bailing bucket** in full for the **Decoration**, and Bucket hat for the **Wearable**.
- "net" names the **Ghost net**, which only slows, and the **Drag net**, a **Timing element** that costs a leg; their fact cards are titled "Lost fishing nets" and "Fishing nets": resolved: say **Ghost net** or **Drag net** in full, never net alone; the card titles are only titles. The **Trajinera lure**'s card is titled "Fishing lines".
- "trajinera" names the **Gliding trajinera**, the **Moored trajinera**, the **Sunken trajinera**, the **Fishing trajinera**, a **Bailing bucket**'s boat and a **Drag net**'s two boats: resolved: always name the kind; a boat that is part of a **Bailing bucket** or a **Drag net** is named by that element.
- **Murky water**'s fact card is titled "Dirty water", and its name in the **Collection Book** is "Murky water": resolved: **Murky water** is the domain term; "Dirty water" is only the card's title.
- "hyacinth" and "water hyacinth" name the **Water hyacinth mat** (`'water-hyacinth'`, Area 5's **Timing element**, which blocks the **Explorer**), the water hyacinth rafts of the **Golden hour look**, the **Hyacinth** **Dream colour** (`'hyacinth'`) and the Flower raft (`'deep-canal/flower-raft'`, an Area 11 Common Floating **Decoration**, a little raft of water hyacinth leaves with a lilac bloom spike): resolved: **Hyacinth** alone is the **Dream colour**; say **Water hyacinth mat** in full for the element, water hyacinth rafts for the scenery, which is painted into Area 11's background and is never cover, a cue or a **Timing element**, and Flower raft for the **Decoration**.
- "marigold" names the **Marigold** **Dream colour** (`'marigold'`), the Marigold boat (`'deep-canal/marigold-boat'`, an Area 10 **Decoration**) and the marigold petals of the **Golden hour look**: resolved: **Marigold** alone is the **Dream colour**; say Marigold boat for the **Decoration** and marigold petals for the scenery.
- "cormorant" names the **Cormorant** (`'cormorant'`, a **Predator**) and the **Little cormorant** (`'deep-canal/little-cormorant'`, Area 11's **Special treasure**): resolved: say **Little cormorant** in full for the **Decoration**.
- "murky" and "dark" both describe hard-to-see water: resolved: **Murky water** is a **Hazard** that costs a leg after time inside and hides nothing; **Dark water** hides things outside its lights and never costs a leg.
- "depth" names a **Depth band** (a screen-row band of an **Area** that opts in, `depthBanded` in area data) and the **Danger bar**'s depth thirds (the depth rule, issue #130, whose code name `depthBands` means the three depth thirds of the swim water): resolved: they are different things; say **Depth band** for a banded area's row band, and "depth third" for the danger bar's.
- "wind", **Current** and **Pulsing current** all push the axolotl: resolved: **Wind and waves** is a **Timing element** that gusts across the whole surface band and alternates direction, fading to calm by the second **Depth band**; a **Current** is steady, fixed in place and never changes; a **Pulsing current** is one fixed band on a calm-warn-surge cycle, and a **Hazard**.
- "pelican" and "pelicans" name the **Pelican line** as a whole and a bird in it: resolved: say **Pelican line** for the threat and "bird" for one pelican; a line of 3 is never a "flock".
