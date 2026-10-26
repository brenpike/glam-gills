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
A level that belongs to one **Habitat**, such as the canal (Area 1), the Lily pad pond (Area 2 and Area 3), or the Chinampa gardens (Area 4 and Area 5), W x H screens in size and built from area data; it is beaten by reaching its open exit. Area 3 (`'pond-2'` in code) is the second area of the Lily pad pond, the pond at dusk where the **Heron** hunts, about 6 x 1 screens, unlocked by beating Area 2. Area 4 (`'chinampa-1'` in code) is the first area of the Chinampa gardens, where the **Ghost nets** are, about 6 x 2 screens, unlocked by beating Area 3; it is the first area that scrolls up and down, with the Home Spot top left and the exit deep bottom right. Area 5 (`'chinampa-2'` in code) is the second area of the Chinampa gardens, where the **Garter snakes** and the **Water hyacinth mats** are, 7 x 2 screens, unlocked by beating Area 4; it is the first U-turn area: the way runs right along the top row from the Home Spot top left, down in the rightmost screen column, and back left along the bottom row to the exit straight under the Home Spot.
_Avoid_: map; "level" in UI text (say "Area 1")

**Habitat**:
A group of areas that share a look: the canal, which holds Area 1, the Lily pad pond, which holds Area 2 and Area 3, and the Chinampa gardens (`'chinampa'` in code), which holds Area 4 and Area 5: clear green-teal water by garden plots, with crops above the surface and ahuejote willow roots in the water. An area may use its own variant of its habitat's look: Area 3 uses the pond at dusk (`'pond-dusk'`), warmer and dimmer, with fireflies over the water. Besides colours, a look says what its area needs: a stream, its cave's kind and anchor, the pond props, fireflies, how its banks are drawn (willows or garden plots), the gap between two chinampas, and the chinampa props.
_Avoid_: using it as another name for one area

**Area map**:
The screen after the explorer card's Go! where the player picks an unlocked **Area** to explore or replay, with the areas on a winding path by **Habitat**, each with its stars, and a padlock on each locked area (N2).

**Exit**:
The way out of an area, which stays closed until every snack in the area is eaten. When it is open, its sign's arrow points toward the nearer side edge of the area: right in Areas 1 to 4, left in Area 5, whose exit is under its Home Spot.

**Star**:
One of up to 3 rewards for beating an area, kept forever once earned.

**Special treasure**:
The one treasure per area that earns a star when the area is beaten with it owned; always Common or Rare; the canal's is the Toy boat, Area 2's is the Frog statue, Area 3's is the Wooden duck decoy (Rare), Area 4's is the Scarecrow (Rare), and Area 5's is the Piñata (Rare).

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
A stretch of flowing water in an area that pushes the axolotl, and that rarer treasures hide past. In Area 4 and Area 5 it is the water flowing sideways through the gap between two chinampas in the bottom row; Area 4's flows left and Area 5's flows right.

**Timing element**:
Something in an area that runs on a clock, and may carry a **Fun-fact card** of its own. Area 5's **Water hyacinth mats** are the only one now, and the first that blocks the **Explorer**. Area 3's was the **Heron**'s shadow cycle, and #111 removed it when the **Heron** became a sight-based wading stalker.

**Water hyacinth mat**:
A floating mat of water hyacinth in the Chinampa gardens, Area 5's **Timing element** (`'water-hyacinth'` in code). The mats come in pairs, one above and one below a narrow channel; each pair spans its row, and Area 5 has two, one in each row, out of step. On an 8 s cycle the mats drift apart over the first 1 s of a 3 s open window, drift together over 1 s (the warning), and stay closed for 4 s. A closed channel blocks the **Explorer**, who waits or goes round through the other row; a mat that closes on the **Explorer** pushes it out along the channel, never into a **Ghost net**, a **Current** or out of the swim bounds. A mat never costs a leg, is never a **Hit** and never traps. Only the **Explorer** is blocked: a following rescued axolotl, the **Predators** and the **Snacks** are not.
_Avoid_: wall, terrain

**Tail Dash**:
The axolotl's first power, a short burst of speed that works with any number of legs and is the only way to break a Dash pot.

**Hiding spot**:
A place in an area where a treasure can hide, picked fresh each trip for each treasure picked for that trip, from that treasure's pool. Each rarity's spots sit in their own risk band, nearer a threat (a predator's patrol route or a leg-costing hazard) the rarer the treasure (B10). An area's cave holds hiding spots of its own; Area 2's cave is a hollow log, and Area 3's is a root arch under the bank (B6's "a cave or other hollow"). The **Heron** cannot see an axolotl in cover: inside a reed patch, under a lily pad, or in the root arch (N3). Area 4's and Area 5's caves are tangles of ahuejote roots on the bed of the bottom row, and their Common and Rare spots sit under the overhanging chinampa banks (the bank cover, `'bank'` in code). A spot is past a **Current** when it is within 140 px beyond the current's upstream edge, the edge its flow comes from, and inside its y range, so the side follows the flow: right of Area 4's current, left of Area 5's; a current with no sideways flow has no past side. Each Lily pad pond area also has two fixed spots under lily pads, one Common and one Rare, that are area data, so every trip there has them.

**Treasure slot**:
One of an area's set number of places for a treasure on each trip (6 in the canal, 7 in Area 2, 8 in Area 3, 9 in Area 4, 10 in Area 5), with its rarity picked by chance from the trip seed; lost treasures and the **Special treasure** are extras on top of the slots (B4). If a rarity has no treasure left to fill a slot, the slot falls back to a more common rarity first, then to only one step rarer; otherwise it stays empty (B4).
_Avoid_: Slot alone (that means a Wearable **Slot**)

**Dash pot**:
A pot only Tail Dash can break, where Legendary treasures hide.

**Hint sparkle**:
The small sparkle, readable without colour, that appears near a hidden treasure and on each of the last 3 snacks.
_Avoid_: hint star

### Hazards, predators and legs

**Hazard**:
Something in an area, defined as data with its own rules, that may cost the axolotl a leg or only slow it, such as a predator. A slow-only hazard, such as the **Plastic worm**, never costs a leg, never starts **Protected time**, and is not a threat for hiding spots (B10). A hazard may stay still or move: a **Moving hazard** moves on its own cycle and costs a leg on touch, and a **Drifting ghost net** moves and only slows.

**Predator**:
A kind of **Hazard**: an animal that hunts, with a visible warning before every strike; every predator follows the same shared rules, and each species is data. A species' warning starts by distance, when the axolotl comes near (the **Tilapia**, the **Garter snake** and the **Common carp**), or on sight, when the axolotl is within the predator's reach and not in cover (the **Heron**). A species may warn only while it is on its route (the **Garter snake**), so after a strike it swims back to its route before it can warn again. A predator whose area gives it a chase follows the **Chase rule** on patrol, within its **Leash**, before it warns; the **Heron** never chases. Any species may be tuned per area in its area's own data, and stays the same species.
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
A **Hazard** that moves on a fixed cycle of its own and costs a leg on touch, with a warning (its **Telegraph**) of at least 0.8 seconds before each move into the water; its looks are data. It is not a **Predator**, so it does not wait its turn: it may move while a predator warns or lunges. It is not a **Timing element**, because a timing element never costs a leg. Every moving hazard type is a **Danger part**. The first is the **Punting pole**.
_Avoid_: trap, obstacle

**Punting pole**:
The first **Moving hazard** (`'punting-pole'` in code): a trajinera boat's long pole that jabs straight down from the surface on a 4 s cycle, 180 px deep. Before each jab the boat's shadow darkens on the water and the pole's tip dips to the surface with a ripple ring. Touching the jabbed pole costs a leg; the water below its tip is safe. Only the boat's bright painted bow shows, with no people, and the pole is never shown hitting or pinning the axolotl. Its fact card is "Trajineras". Which areas have one is in each area's danger pass paragraph in the PRD (N2).
_Avoid_: oar, stick

**Telegraph**:
A predator's or **Moving hazard**'s visible warning before a lunge or a jab; the tilapia's is a glint and a wind-up pose, the heron's is freezing and pulling its neck into an S, the garter snake's is stopping in a held S with ripple rings spreading from its head, the common carp's is tipping its nose down with a mud puff, and the punting pole's is the boat's shadow darkening while the pole's tip dips with a ripple ring.

**Lunge**:
A predator's strike; the tilapia's is a quick dash at the axolotl, the heron's is a stab with its beak at the spot where the axolotl was when its S-neck began, the garter snake's is a straight dart along the aim fixed at the end of its warning, and the common carp's is a slow, wide tail sweep along the aim fixed at the end of its warning.

**Hit**:
A predator's strike, or a **Hazard** that costs a leg, that connects.

**Protected time**:
A short time after a hit when no second hit can land.
_Avoid_: invulnerability (in UI)

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
A fantasy colour, not found in nature, that can be put on any owned axolotl; solid ones are Common or Rare, and patterned and sheen ones are Epic or Legendary. There are 16: 9 from the canal, Lily green from Area 2, Firefly gold and Galaxy from Area 3, Poppy red and Rainbow from Area 4, and Plum and Tie-dye galaxy from Area 5.
_Avoid_: skin

**Treasure Chest**:
The list of every catalogue Decoration, Wearable, and Dream colour: owned ones in full, with their rarity glow, and unfound ones as silhouettes with "???" and an area and rarity hint, with a line per section saying what its items are for.
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
A short, true fact about axolotls or their world. Besides the morph facts, the **Collection Book** lists 13 fact cards, in this order: the tilapia card, "Meet the carp" (the **Common carp**), "Plastic is not food" (the **Plastic worm**), the tadpole card, "Freshwater shrimp" (the **Freshwater shrimp**), the heron card, "Lost fishing nets" (the **Ghost net**), "Trajineras" (the **Punting pole**), "Meet garter snakes" (the **Garter snake**), "Water hyacinth" (the **Water hyacinth mats**), "Axolotl refuges", "Canal clean-ups", and "Boy or girl?".

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
A habitat cue played the dusk way: the same tune and chords, slower, on a music box, with soft chords, no drums, and fireflies. Dusk and night areas play it (the dusk rule, M4).
_Avoid_: night song, dusk theme

**Music switch**:
The on/off control for background music, kept on the device outside the save (M8).
_Avoid_: mute button

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
- A Legendary **Treasure** always hides in a **Dash pot**, which only **Tail Dash** can break
- A **Hint sparkle** marks a hidden **Treasure** when the axolotl is near, and each of the last 3 **Snacks**
- A **Predator** is a **Hazard**, and a **Tilapia**, a **Heron**, a **Garter snake** and a **Common carp** are **Predators**; a **Predator**'s **Telegraph** always comes before its **Lunge**, whether its warning starts by distance or on sight, and only one **Predator** in an **Area** warns or lunges at a time, a **Heron**, a **Garter snake**, a **Common carp** and a **Tilapia** included
- A **Garter snake** warns only while its head is on its stretch, so the water below y 260, the whole bottom row included, is out of its reach
- A **Predator** with the **Chase rule** chases only on patrol and within its **Leash**; chasing is not warning or lunging, so any number of **Predators** may chase at once, and a **Garter snake** chases along its stretch only
- A **Moving hazard** is a **Hazard** that costs a leg, but not a **Predator** and not a **Timing element**; its **Telegraph** always comes before its jab, and it keeps its own cycle whatever the **Predators** do
- A **Drifting ghost net** is a **Ghost net**: it only slows, it is never a **Hit**, and it is never a threat for **Hiding spots** (B10)
- A **Mobile snack** is a **Snack** with a **Home area**; a **Tadpole** swims its **Wander loop** forever, a **Freshwater shrimp** hops round its hop spots and flicks away again after each rest, and in an **Area** with **Freshwater shrimp** no **Snack** darts once
- A **Water hyacinth mat** is a **Timing element**, not a **Hazard**: it blocks only the **Explorer**, never costs a leg and is never a **Hit**, so the Shell **Perk** plays no part
- A **Hit** is a **Lunge** that connects, or a touch on a **Hazard** that costs a leg; it starts **Protected time** and causes exactly one **Leg loss**, except a hit blocked by a Shell **Perk** (at most one per trip), which costs no leg; a **Hazard** that only slows never hits
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
- The **Treasure Chest** lists every catalogue **Decoration**, **Wearable**, and **Dream colour**: owned ones in full with their **Rarity** glow, unfound ones as silhouettes with "???" and an **Area** and **Rarity** hint, and a line per section saying what its items are for; placed **Decorations** live in the **Home Tank**
- The **Collection Book** holds one entry per **Real morph**, each with a **Fun-fact card**, and lists **Dream colours** separately as not found in nature
- The **Refuge** has one **Refuge section** per **Habitat** that holds an **Area**, and each **Refuge section** has one **Trash batch** per **Area** in it; beating an **Area** (its exit **Star**) clears its **Trash batch**
- A **Trip** in a real **Area** that newly beats it adds a pending clean-up, and one that newly makes a **Refuge section** clean adds a **Habitat milestone**; both live in memory only, a dev area **Trip** or a replay adds neither, and the **Refuge nudge** shows while a clean-up is pending
- The **Refuge** holds two **Fun-fact cards**, "Axolotl refuges" (first visit) and "Canal clean-ups" (the first time cleared trash shows); the **Collection Book** lists them after the **Hazard** cards and before "Boy or girl?"
- The **Collection Book** lists the **Hazard**, **Predator** and **Timing element** **Fun-fact cards** in area-table order, each area's element cards after its threat cards: the tilapia, the **Plastic worm**, the **Heron**, the **Ghost net**, the **Garter snake**, then the **Water hyacinth mat**

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
- "worm" names both a **Snack** (`CollectibleKind` `'worm'`) and the **Plastic worm** (`'plastic-worm'`): resolved: a worm alone is a **Snack**; always say **Plastic worm** in full for the hazard.
- The **Ghost net**'s fact card is titled "Lost fishing nets", and its name in the **Collection Book** is "Ghost net": resolved: **Ghost net** is the domain term; "Lost fishing nets" is only the card's title.
- "bank" names the top-row bank art (`bankChunks` in area data, drawn as willows in the canal and the pond and as garden plots in the Chinampa gardens) and the bank cover of **Hiding spots** (`'bank'`, from `bankOverhangs`): resolved: the bank cover comes only from `bankOverhangs`, never from `bankChunks`, so the canal's and the pond's **Hiding spots** are unchanged.
