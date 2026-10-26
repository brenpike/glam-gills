# Glam Gills Music Guide: "Cozy but fun"

How the game's background music sounds, so every cue, new ones included, feels like one game.
Requirements are in the [PRD](prds/axolotl-mvp.md) (N6, M1 to M12). The decisions behind them are in [ADR 0025](adr/0025-procedural-background-music.md).
Sound effects have their own [sound guide](sound-guide.md); they play in the key of the cue playing (section 4 gives each cue's key).

## 1. Source of truth

| Item | Value |
|---|---|
| Approved sketches | [`prototypes/music/sketches.html`](../prototypes/music/sketches.html), approved by the owner on 2026-10-26. Open it in a browser and tap a cue. |
| Game code (once built) | Cue data and arrangement rules in `src/logic/music.ts`; the synth in `src/platform/`. |
| When they disagree | The game code is the record once it ships. Before that, the sketches are. Correct this guide to match. |

Every sound is made live in code with Web Audio. There are no audio files (PRD M6).

## 2. Principles

| Do | Don't |
|---|---|
| Cozy but fun: warm, light, bouncy, singable. | No scary, tense, or sad music. No danger stings (PRD M5). |
| Major keys and bright modes (major, mixolydian, dorian with its bright 6th). | No minor-key gloom. A borrowed minor chord for warmth is fine (Sunny Tank's Cm). |
| Plucked and struck sounds: kalimba, marimba, music box, nylon guitar, ukulele, plucked strings, glass bells. Soft pads underneath. | No harsh synth leads, distortion, or loud drums. |
| A nod to Xochimilco: marimba, 6/8 son lilt, guitar rasgueo, guiro. | No cartoon "Mexican" clichés. |
| Gentle percussion: shaker, soft kick, wood block, box-drum slap, guiro. | No crashes or big hits. |
| Water touches: bubble pops, lily-pad boings, drips, fireflies. A few per loop. | Not so many that they distract. |
| A tune a kid could hum after one trip. | No endless noodling with no tune. |
| Gentle volume with a limiter (PRD M11). | No sudden loud moments. |

## 3. How a cue is built

- **Loop:** 8 bars, then again. Each pass changes a little (PRD M10). The usual plan is: pass 1 the plain tune; pass 2 a second instrument joins (whistle, kalimba or music box an octave up); pass 3 a harmony or counter-line; pass 4 a lighter pass, with a made-up phrase from the key's pentatonic notes or the tune resting. The seed picks the details, so the same seed plays the same notes.
- **Parts:** each cue is made of up to five parts: tune, chords, bass, percussion, and sparkles (bubbles, boings, drips, fireflies). The sketches let each part be switched off to judge the mix.
- **Phrase ends:** bars 4 and 8 end with a small signature: a bubble pop, a boing, or a 1-2 3-4 5-6 flip.
- **Range:** the tune sits around the octave above middle C (C5); the bass sits two octaves below.

## 4. The cues

| Cue | Plays | Key | Feel | Tempo | Instruments |
|---|---|---|---|---|---|
| Sunny Tank | Title, Home Tank, creator and restyle, area map, refuge | G major | 4/4, swung | 96 bpm | Kalimba tune, ukulele strum, soft taps and shaker, whistle on pass 2, bubbles |
| Canal Paddle | Canal (Area 1) | G major | 6/8 lilt, with a 1-2 3-4 5-6 flip in bars 4 and 8 | 68 (dotted quarter) | Marimba tune, strummed chords, soft kick, shaker, bubble pops |
| Lily Pad Hop | Lily pad pond (Areas 2 and 3) | F major | 4/4, straight | 104 bpm | Flute-like whistle tune doubled by marimba, plucked strings going oom-pah, wood block, a boing at phrase ends |
| Garden Boats | Chinampa gardens (Areas 4 and 5) | D mixolydian | 4/4 on a 3-3-2 beat | 112 bpm | Marimba tune with whistle, nylon guitar strums, guiro, box-drum slap, soft kick |

Chords, one bar each (two chords in one bar are split at the half bar):

| Cue | Bars 1 to 8 |
|---|---|
| Sunny Tank | G, Bm, C, D, G, E7, Am Cm, G D |
| Canal Paddle | G, C, D, G, C, G, Am D, G |
| Lily Pad Hop | F, Dm, Gm, C, F, A7, Bb C, F |
| Garden Boats | D, C, G, D, Bm, G, Em A, D |

The tunes are written out in the sketches (each cue's `tune` data).

Notes on mood:

- **Sunny Tank** is cozy but happy: a home to come back to. The E7 to Am lift is the smile, and the Cm near the end is the hug.
- **Canal Paddle** is the first trip: bouncy and friendly.
- **Lily Pad Hop** leaps like a frog, a little busier than the canal.
- **Garden Boats** is for the busiest areas: a sunny adventure, like a trajinera band going by. It is still never tense.

## 5. The dusk rule

A dusk or night area plays the dusk version of its habitat's cue, never a cue of its own (PRD M4). One shared rule makes it from any cue:

| Part | Day | Dusk version |
|---|---|---|
| Tempo | The cue's tempo | Slower: Canal Paddle 54, Lily Pad Hop 80, Garden Boats 86 |
| Tune | The cue's instruments | The same notes on a music box (raised an octave when below C5) |
| Chords | Strums, plucks | The same chords, held soft, with a light kalimba on the beats |
| Bass | Busy | The root on each chord change, softer |
| Percussion | Shaker, drums | No drums; a faint shaker only |
| Sparkles | Bubbles, boings | Fireflies: soft, high chimes at random from the key's pentatonic notes |

So Area 3, the pond at dusk, sounds like the pond, only sleepier.
A night look uses the dusk version too, until a night version is asked for (PRD open question 406).

## 6. Adding a habitat

1. Write a new cue in `src/logic/music.ts`, keyed by the habitat's id, following sections 2 to 4: its own key, feel and lead instrument, so it sounds different from the other cues.
2. Check it by ear in the sketches page first (copy a cue there and change it).
3. Its dusk version comes from the shared rule. Nothing more to write.
4. Add a row to the tables in section 4, and its tempos to the PRD's Tuning values.
5. The habitat test (PRD M3) fails until the cue exists.

The sketches page also has **Cenote Glow**, a sample cue for a possible future cave habitat: E dorian, 66 bpm, glass bells with an echo, water drips, and a deep soft hum. It shows how a new habitat gets its own sound. It is not planned for any area yet.
