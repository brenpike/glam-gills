# ADR 0025: Background music is made live in code, one cue per habitat, with a shared dusk version

- Status: Accepted
- Date: 2026-10-26
- Related: [ADR 0006](0006-testing-strategy.md) (pure rules with tests), [ADR 0007](0007-kid-safety-and-privacy.md) (no network, no third parties), [ADR 0008](0008-gentle-fail-state.md) (nothing feels like punishment), [ADR 0012](0012-save-on-device.md) (device storage), [ADR 0013](0013-axolotl-rig-and-frame-budget.md) (frame budget), [ADR 0014](0014-area-framework.md) (areas and habitats as data), [ADR 0016](0016-heron-timer-warnings-and-area-look-variants.md) (area look variants)

## Context

The game has no sound. The [PRD](../prds/axolotl-mvp.md) listed "Sound and music" as out of scope, and issue #147 asks for sound effects and music with two switches.
The owner wants cozy but fun background music first: a cozy but happy cue for the Home side of the game, its own cue for each habitat, and a rule for dusk and night areas.
Four cues and their dusk versions were sketched and approved (`prototypes/music/sketches.html`, 2026-10-26).

Constraints:

- No network requests, CDNs or remote assets ([ADR 0007](0007-kid-safety-and-privacy.md)).
- No new dependencies outside a planned scaffold step (AGENTS.md).
- Game rules stay pure and tested in `src/logic/` ([ADR 0006](0006-testing-strategy.md)); browser glue lives in `src/platform/`.
- Browsers only let a page make sound after the player's first tap, click or key press.
- Nothing may make a scary moment scarier, and losing must never feel harsh ([ADR 0008](0008-gentle-fail-state.md), PRD X1).
- The world will grow: more habitats, and more areas with a dusk or night look ([ADR 0016](0016-heron-timer-warnings-and-area-look-variants.md)).

## Decision

**Made live in code.** Every sound is made by Web Audio oscillators, noise, filters and a short reverb, scheduled a little ahead of time. Plucked strings use the Karplus-Strong method, rendered once per note and kept. There are no audio files, no licences to track, nothing to download, and no new dependency (PRD M6).

**Cues are data.** A cue is an 8-bar loop: its key, tempo, meter, chords and tune, in `src/logic/music.ts`. The arrangement rules are pure functions: given a cue, its version (day or dusk), a step and a seed, they return the notes to play. Each pass of the loop changes a little, chosen by the seed (PRD M10). The synth that turns notes into sound, the scheduler and the fades live in `src/platform/`, and scenes only say which cue should play.

**One cue per habitat.** The cue is picked by where the player is (PRD M1 to M3):

| Where | Cue |
|---|---|
| Title, Home Tank, creator and restyle, area map, refuge | Sunny Tank (the Home cue) |
| Canal habitat (Area 1) | Canal Paddle |
| Lily pad pond habitat (Areas 2 and 3) | Lily Pad Hop |
| Chinampa gardens habitat (Areas 4 and 5) | Garden Boats |

Habitat cues are keyed by habitat id. A test fails if a habitat in `HABITATS` has no cue, so a new habitat cannot ship silent.

**The dusk rule.** An area whose look is dusk or night plays the dusk version of its habitat's cue, never a cue of its own (PRD M4). One shared rule makes the dusk version of any cue: the same tune and chords, slower, the tune on a music box, soft held chords, no drums, and fireflies. Each area look variant says its time of day (`'day'`, `'dusk'` or `'night'`), and the music rule reads that field, never the look id. Area 3's `'pond-dusk'` look is dusk, so Area 3 plays Lily Pad Hop (dusk).

**No danger music.** The music never reacts to warnings, strikes, lost legs or being carried home (PRD M5). It sets the mood of a place, not the tension of a moment.

**Starting, fading, pausing.** Music starts on the first input with a fade in (PRD M7). A change of cue cross-fades over about 1 second, and moving between screens that share a cue never restarts it. The audio stops while the page is hidden and carries on when it shows again. A paused trip plays at half volume (PRD M9). A limiter on the output keeps it gentle (PRD M11).

**The music switch.** One on/off switch, on at first launch, on the title screen, in the Home Tank and on the trip pause screen (PRD M8). It is kept in `localStorage` under its own key, `glam-gills:music`, which is not in `SAVE_STORAGE_KEYS`. So it is a device setting, not progress: "Start over" keeps it, and the save and `SAVE_VERSION` do not change.

**Music first.** Sound effects are not part of this decision. They come later under issue #147, with their own switch.

## Alternatives considered

| Option | Why not |
|---|---|
| CC0 or commissioned audio files (issue #147's first recommendation) | Adds files to the build and a credits and licence list to keep. Each cue's dusk version would be a second file, and loops of files repeat exactly. Code-made cues are tiny, vary each pass, and get a dusk version for free. |
| Phaser's sound manager | It plays audio files. With no files there is nothing for it to play, and it does not schedule notes. Web Audio is used directly instead. |
| A music library (Tone.js or similar) | A new dependency, against the AGENTS.md rule, for a small part of what it does. |
| A separate cue for each area | More music to write for every area, and areas in one habitat would not sound like one place. The habitat is the unit players feel. |
| A separate cue for each dusk area | The dusk area would not sound like its habitat. The shared dusk rule keeps the tune and needs no new music. |
| Tense music near predators | Makes scary moments scarier, against PRD X1 and [ADR 0008](0008-gentle-fail-state.md). Warnings are already clear on screen. |
| The music switch in the save | "Start over" would turn the music back on, and the save would need a new field. A device setting belongs outside progress. |

## Consequences

- Music adds no bytes of audio to the build and no network requests.
- A new habitat needs a new cue in `src/logic/music.ts`, or the habitat test fails. A new dusk or night area needs only the time of day on its look.
- The area look variant type gains a time-of-day field. Area 3's `'pond-dusk'` says `'dusk'`.
- Sound quality depends on the device's Web Audio. Low-end phones may struggle with many voices, so frame time is checked with music on (PRD M12).
- How cues sound is checked by ear in play-tests, not by tests. The tests check the rules: which cue plays, the dusk rule, and the same seed giving the same notes.

Known limits:

- On iPhone, Web Audio may be silenced by the silent switch. The game lets the browser decide (PRD open question 407).
- A browser that blocks audio leaves the game silent; nothing else changes.
- If the page is hidden mid-fade, the fade finishes when it shows again.
