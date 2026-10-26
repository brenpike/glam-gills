# ADR 0026: Sound effects are made live in code on the music's audio engine, in the music's key, with matched loudness

- Status: Accepted
- Date: 2026-10-26
- Related: [ADR 0006](0006-testing-strategy.md) (pure rules with tests), [ADR 0007](0007-kid-safety-and-privacy.md) (no network, no third parties), [ADR 0008](0008-gentle-fail-state.md) (nothing feels like punishment), [ADR 0012](0012-save-on-device.md) (device storage), [ADR 0013](0013-axolotl-rig-and-frame-budget.md) (frame budget), [ADR 0025](0025-procedural-background-music.md) (background music)

## Context

Issue #147 asks for sound effects and music, with separate on/off switches. Background music shipped first ([ADR 0025](0025-procedural-background-music.md), PRD N6), with sound effects left for later (PRD open question 404).
The owner wants a sound for the moments a player cares about, gentle for kids aged 8 to 12, cozy but fun like the music, and never scary.
The sounds were sketched and chosen by ear (`prototypes/sound-effects/sketches.html`, 2026-10-26).

Constraints:

- No network requests, CDNs or remote assets ([ADR 0007](0007-kid-safety-and-privacy.md)).
- No new dependencies outside a planned scaffold step (AGENTS.md).
- Game rules stay pure and tested in `src/logic/` ([ADR 0006](0006-testing-strategy.md)); browser glue lives in `src/platform/`.
- The music already owns a Web Audio context, an unlock on the first input, a stop while the page is hidden, a reverb and a limiter.
- Nothing may make a scary moment scarier, and losing must never feel harsh ([ADR 0008](0008-gentle-fail-state.md), PRD X1). The music never reacts to danger (PRD M5).
- Phones have to play sounds and music together within the frame budget ([ADR 0013](0013-axolotl-rig-and-frame-budget.md)).

## Decision

**Made live in code, like the music.** Every sound is made by Web Audio oscillators, noise and filters, using the music's voices (kalimba, marimba, music box, whistle, plucks, bubble, boing and the rest) plus a few of its own (a swoosh, a puff, a glide, a clay knock and glass chimes). There are no audio files, no licences and no new dependency (PRD S1).

**One audio engine, two buses.** One audio context, one unlock on the first input, one stop while the page is hidden, one reverb and one limiter, with a music bus and a sounds bus. Each bus has its own switch and level. The voices move out of `musicPlayer.ts` into a shared voices file, used by the music player and a new sound player (PRD S1). Two audio contexts would double the cost on phones, and iPhones limit how many may run.

**Sounds are data.** Each sound is a short recipe in `src/logic/`: its notes, as steps of a scale, with voice, timing, loudness and its level. Pure rules turn a recipe, its version (such as a treasure's rarity or a star count), the key and the snack ladder into the notes to play. Scenes and a sound router only say which sound to play; they never build notes.

**In the music's key.** Pitched sounds use the five notes of the major pentatonic scale of the cue that is playing: G for Sunny Tank and Canal Paddle, F for Lily Pad Hop and its dusk version, D for Garden Boats (PRD S12). So a sound never clashes with the tune. A new habitat cue names its key, and its sounds follow.

**Matched loudness.** Each sound carries a level in its data, set so that every event sound is about as loud as every other (PRD S13): measured with a K-weighted loudness meter over its loudest 0.2 seconds, event sounds sit at about −18 and the small touch sounds (button taps, picking up, page turns) about 3 dB under. Before matching, the sketches' sounds spanned about 40 dB. The sounds and the music share a limiter, and the music never dips for a sound.

**Gentle by rule.** Wins end on the home chord of the key. A lost leg is an "uh-oh": two soft, low notes falling a small step, left unresolved, which the leg-back sound answers by rising home. A predator warning is one soft water ripple, played once when the telegraph starts, never repeating or building. Being carried home is a lullaby. There are no crunches, alarms, drones, sad slides or minor-key sighs, and no sound is the only sign of anything (PRD S5, S9 to S11).

**Warning sounds are not danger music.** PRD M5 is about the music: it sets the mood of a place and never changes. A warning sound is a one-off cue for one event, like the telegraph on screen, at the same loudness as a snack. So it does not break M5 (PRD open question 432).

**Moments kept silent.** Constant things (swimming, the current, predators patrolling, the snack magnet), things another sound already covers (find toasts, pausing) and things a sound would spoil (the hint sparkle) stay silent (PRD S2, sound guide).

**The Sounds switch.** One on/off switch, "Sounds on" or "Sounds off", on at first launch, beside the music switch on the title screen and the pause screen. In the Home Tank, one "Sound" hub tile, in place of the music tile, opens a small card with both switches, because the hub already wraps at 1024 x 768 (PRD S14). It is kept in `localStorage` under `glam-gills:sounds`, outside the save, so "Start over" keeps it and the save and `SAVE_VERSION` do not change.

**In slices.** The first slice is the engine, the switch and the 12 sounds a player hears every trip. Hazards and rescue come next, then the Home Tank and menus (PRD N7).

## Alternatives considered

| Option | Why not |
|---|---|
| CC0 or self-made audio files (issue #147's first recommendation) | Adds files to the build and a credits and licence list. Files cannot follow the music's key, and each one would need its loudness fixed by hand. The music already showed that code-made sound is enough. |
| Phaser's sound manager | It plays audio files. With no files there is nothing for it to play. |
| A second, separate audio engine for sounds | Two audio contexts, two unlocks and two limiters. It doubles the cost on phones, and iPhones limit audio contexts. |
| Fixed pitches, ignoring the music | Sounds clash with Lily Pad Hop (F) and Garden Boats (D) when pitched for G. |
| Levels set by ear only | The sketches' first levels ran from about −54 to −13, and the owner heard the Dash, a lost leg and the warning as far too quiet. Measuring is repeatable for new sounds. |
| Every sound at exactly the same level, taps included | A menu tap as loud as a treasure find feels wrong. Touch sounds sit 3 dB under. |
| A sparkle for a lost leg, matching the sparkle poof | It sounded like a reward. The owner chose the "uh-oh". |
| Ducking the music for big sounds | The music would change around danger moments too, against M5. Matched loudness makes ducking unneeded. |
| No warning sound | The telegraph on screen stays the main cue. A soft ripple helps a player who is looking elsewhere, and it can be dropped if play-tests find it tense. |
| A seventh Home Tank hub tile for the Sounds switch | The hub already wraps onto two rows at 1024 x 768 (PRD open question 419). |
| The Sounds switch in the save | "Start over" would turn sounds back on, and the save would need a new field. |

## Consequences

- Sound effects add no bytes of audio and no network requests.
- `musicPlayer.ts` is split: the shared engine and voices go to their own files, and the music player keeps its scheduler and cues. The music must sound the same afterwards.
- A new sound needs a recipe, a level and a moment to hook. A rule test fails if a sound has no level or no recipe.
- A new habitat cue must name its key, or its sounds fall back to G. A rule test checks every cue has a key.
- Some moments need new hooks: the snack kind on `COLLECTED`, the shrimp flick, wriggling free of a ghost net, the punting pole warning, and per-star timing on the tank arrival card. Keyboard presses bypass the shared button press, so taps need a second hook there.
- How the sounds feel is checked by ear in play-tests. The tests check the rules: the key, the ladder, the rarity order, the endings, the levels and the repeat limit.

Known limits:

- On iPhone, Web Audio may be silenced by the silent switch (PRD open question 407 applies to sounds too).
- A browser that blocks audio leaves the game silent; nothing else changes.
- Loudness is matched by a meter, which is a guide. A very short, clicky sound can feel louder than it measures; play-tests may trim single levels.
