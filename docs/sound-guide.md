# Glam Gills Sound Guide: "Oops, yay, and bubbles"

How the game's sound effects sound, so every sound, new ones included, feels like one game and sits well with the music.
Requirements are in the [PRD](prds/axolotl-mvp.md) (N7, S1 to S16). The decisions behind them are in [ADR 0026](adr/0026-procedural-sound-effects.md). The music has its own [music guide](music-guide.md).

## 1. Source of truth

| Item | Value |
|---|---|
| Approved sketches | [`prototypes/sound-effects/sketches.html`](../prototypes/sound-effects/sketches.html), approved by the owner on 2026-10-26. Open it in a browser, pick a cue to play under the sounds, and tap a sound. "Play the trip" plays 30 seconds of a canal trip. |
| Game code (once built) | Sound recipes, levels and rules in `src/logic/`; the shared engine and voices in `src/platform/`. |
| When they disagree | The game code is the record once it ships. Before that, the sketches are. Correct this guide to match. |

Every sound is made live in code with Web Audio. There are no audio files (PRD S1).

## 2. Principles

| Do | Don't |
|---|---|
| Short and bright: most sounds are under 1 second, and even a Legendary find is under 2.5 seconds. | No long stings that talk over the music. |
| Watery and wooden: bubbles, boings, drips, marimba, kalimba, music box, glass chimes, soft plucks, swishes of water. | No mechanical, electronic or arcade sounds: no lasers, coins, buzzers or beeps. |
| In the music's key: pitched notes come from the playing cue's major pentatonic scale (section 3). | No pitches outside the scale. |
| Wins end on the home chord, so they feel finished and happy. | No win that ends up in the air. |
| Bad moments say "oops" kindly: low, soft, short. | No "yay" for a bad moment (a sparkle for a lost leg sounded like a reward), and no "ouch": no crunch, hit, sad slide down or minor-key sigh. |
| A warning is one soft cue when it starts. | No alarms, drones, heartbeats, rising pitch or anything that repeats or builds (PRD S9, S11). |
| Funny hazards are silly: the plastic worm's "bleh", the ghost net's stretchy twang. | Nothing gross: no gagging or squelching. |
| Every sound has an on-screen partner. | No sound is the only sign that something happened (PRD S11). |
| Every sound has a level, so they are all about as loud as each other (section 4). | No sound much louder or quieter than the rest. |

## 3. The key rule

Pitched sounds use the five notes of the major pentatonic scale of the cue that is playing (PRD S12):

| Cue playing | Key of the sounds | Notes |
|---|---|---|
| Sunny Tank, Canal Paddle (day and dusk) | G | G A B D E |
| Lily Pad Hop (day and dusk) | F | F G A C D |
| Garden Boats (day and dusk) | D | D E F# A B |
| No music (music off) | The cue that would play | The same notes |

A recipe names its notes as steps of that scale: step 0 is the home note in the octave above middle C (G5, F5 or D5), step 5 is the home note an octave up, and step −5 an octave down. The "home chord" is steps −5, −3 and −1 (the major triad on the home note).
Unpitched sounds (swishes, puffs, taps, clay knocks) do not change with the key.

## 4. Loudness

| Kind | Level | Sounds |
|---|---|---|
| Event sounds | About −18, K-weighted, over the sound's loudest 0.2 seconds | Everything not listed below |
| Touch sounds | 3 dB under, about −21 | Button tap, close or back, focus tick (unused), picking up a Decoration, taking off a Wearable, a page turn, the shrimp flick |

- Each sound's level is data next to its recipe. The sketches measured every sound offline and set its level so that every sound landed within 1 dB of its target (they had spanned about 40 dB).
- A new sound is measured the same way before it ships: render it, measure its loudest 0.2 seconds, and set its level. The sketches page holds the voices and recipes to try it in.
- The sounds bus and the music bus start at the same volume. The music never dips for a sound. One limiter after both keeps the loudest moment gentle.
- The same sound plays at most once every 60 ms. Only one treasure find sound plays at a time; a second waits until the first ends.

## 5. The sounds

Slice 1 is the first build; slices 2 and 3 follow (PRD N7). The recipe column is a summary; the sketches hold the exact notes and timings.

| Group | Moment | Sound | Slice |
|---|---|---|---|
| Snacks and finds | Eat a snack | A soft gulp (a low bubble) and one marimba note. The snack ladder: snacks eaten within about 2 seconds of each other climb the scale one step each, up to step 9, then a pause starts it again at step 0. | 1 |
| | One of the last 3 snacks | The gulp on step 5, with two firefly twinkles. | 1 |
| | Catch a tadpole or shrimp | The gulp with a tiny upward boing. | 2 |
| | Shrimp flicks away | A tiny high flick and tick (touch level). | 2 |
| | Find a treasure | Grows with rarity: Common two kalimba dings; Rare a marimba run and bubbles; Epic a music box run, a glass chime and a shaker; Legendary a run up the scale, a held glassy chord over a soft pad, a whistle and fireflies. | 1 |
| | Paint shell, extra shimmer | A glassy sparkle that slides up, after the find sound. | 2 |
| Tail Dash and Dash pots | Tail Dash | A watery whoosh that rises, and a trail of three bubbles. | 1 |
| | Dash ready again | One soft bloop and a high kalimba note. | 2 |
| | Bump a sealed pot | One soft, hollow clay knock, and a quieter echo. | 2 |
| | Dash pot breaks | A hollow clay "tok", a little crumble, bubbles rising. | 2 |
| Bumps, hazards, predators | Predator warning | Ripple: a soft water swish with two low marimba notes, once when the telegraph starts. | 2 |
| | Lose a leg | Uh-oh: a soft puff with two low marimba notes falling a minor third (steps −2 then −3), left unresolved. | 1 |
| | Shell perk blocks a hit | A bright shell tink and a bubble. | 2 |
| | Leg grows back | Three rising marimba notes ending on the home note an octave up (steps 2, 3, 5), and a bubble. | 1 |
| | Carried home | Lullaby: a soft held home chord with a slow music box line falling gently to the home note, and bubbles floating up. | 2 |
| | Plastic worm "bleh" | A little "pthh" spit and a droopy, comic "bwoip", then a bubble. | 2 |
| | Snagged on a ghost net | A wobbly, stretchy twang. | 2 |
| | Wriggle free | Three quick plucks up and a pop. | 2 |
| | Bump the closed exit | Two soft, same-pitch marimba "boops": "not yet". | 2 |
| | Hyacinth mats open | A leafy rustle with a low, slow boing. | 2 |
| Wins | Bank finds | One bubble and kalimba note per find, climbing (up to 5), then a ukulele strum of the home chord. | 1 |
| | Meet a stranded axolotl | A two-note whistle "hi!", up. | 2 |
| | Rescued axolotl is safe | A kalimba run, a whistle, a strum and a boing. | 2 |
| | The exit opens | A tiny "ta-da": whistle and marimba up four notes, a strum, a boing. | 1 |
| | Beat an area, with stars | A strum, one glass chime per star (steps 5, 7, 10), then the home chord and bubbles. One star still ends on the home chord. | 1 |
| Home Tank and the book | Back in the Home Tank | Two bubbles and a kalimba note. | 3 |
| | Pick up a Decoration | A small rising bloop (touch level). | 3 |
| | Place a Decoration | A soft plop into the sand, with a low note. | 3 |
| | Put on a Wearable | A cloth swish and two twinkles. | 3 |
| | Take off a Wearable | Just the swish (touch level). | 3 |
| | Put on a Dream colour | A glassy run up the scale. | 3 |
| | Open a fact card | A page flip and a two-note music box "ooh". | 3 |
| | Turn a Collection Book or Treasure Chest page | A paper flip (touch level). | 3 |
| | Refuge milestone | A marimba run, a whistle, a strum and bubbles. | 3 |
| | New area unlocked | A boing and two whistle notes up. | 3 |
| Menus | Tap a button | A soft bubble with a light wood tick (touch level), for every button press, by touch or by keyboard. | 1 |
| | Turn Sounds on | Two kalimba notes up, so the player hears the level. | 1 |
| | Close or go back | The tap, lower (touch level). | 3 |
| | Surprise me | A tumble of random marimba notes landing on a strum and a boing. | 3 |

## 6. Kept silent

| Moment | Why |
|---|---|
| Swimming and steering | Constant; the music's bubbles already give the water. |
| The current, reeds, drifting snacks, the snack magnet | Constant. |
| Predators patrolling or chasing | A chase sound would be danger music. |
| A lunge or strike that misses | Missing is the good outcome; the warning was the cue. |
| Bumping a predator that is not lunging | Nothing is lost. |
| Protected time, and a leg regrowing | Only the moment a leg is back gets a sound. |
| The hidden-treasure hint sparkle | Finding it by looking is the fun. |
| Entering the Home Spot ring | The Go home button shows; banking has its own sound. |
| Find toasts and the first-trip hint | The find sound already played. |
| Pause and resume | The tap plays; the music goes soft (PRD M9). |
| Keyboard focus moves | A sound on every key press is noise. |
| Turning Sounds off | Off means off. |
| Typing a name | A sound per letter is noisy on phones. |
| The update prompt | Nothing to celebrate or warn about. |
| Rescued axolotls swimming in the Home Tank | Constant. |

## 7. Adding a sound

1. Decide whether the moment needs one: check section 6 and the principles in section 2.
2. Sketch it on the sketches page: copy a recipe near it and change it, using steps of the scale (section 3).
3. Listen over every cue, with "Match the music's key" on.
4. Measure its loudness and set its level (section 4).
5. Add the recipe and level to `src/logic/`, hook the moment, and add a row to section 5. The rule test fails if a sound has no level.
