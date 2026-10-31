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

**Voices.** Each instrument is a music voice in `src/logic/music.ts`, played by the synth in `src/platform/audioVoices.ts`. The cave cue (issue #77) added two:

- **Glass** (`glass`): a glass bell, pitched. A soft sine struck on the note with two quieter, higher partials, ringing for 2.6 s. It is the same glass sound the sound effects use for their chimes.
- **Drip** (`drip`): a water drip, unpitched. A quick fall in pitch, from a random top between 1500 and 2400 Hz down to about a third of it in 0.06 s, gone in 0.12 s.

## 3. How a cue is built

- **Loop:** 8 bars, then again. Each pass changes a little (PRD M10). The usual plan is: pass 1 the plain tune; pass 2 a second instrument joins (whistle, kalimba or music box an octave up); pass 3 a harmony or counter-line; pass 4 a lighter pass, with a made-up phrase from the key's pentatonic notes or the tune resting. The seed picks the details, so the same seed plays the same notes.
- **Parts:** each cue is made of up to five parts: tune, chords, bass, percussion, and sparkles (bubbles, boings, drips, fireflies). The sketches let each part be switched off to judge the mix.
- **Phrase ends:** bars 4 and 8 end with a small signature: a bubble pop, a boing, or a 1-2 3-4 5-6 flip.
- **Echo:** a cue may send part of itself to the music's one echo (its `echo`, above 0 and at most 1). Only Cenote Glow does, at 0.4. The echo repeats every 0.42 s, each repeat 0.38 as loud and a little darker (a 2400 Hz low-pass in the loop), and joins the music bus, so the music switch, a hidden page and pausing act on it as on the rest of the music. A dusk version keeps its day cue's echo. Every other cue has no echo, only the shared room reverb.
- **Range:** the tune sits around the octave above middle C (C5); the bass sits two octaves below.

## 4. The cues

| Cue | Plays | Key | Feel | Tempo | Instruments |
|---|---|---|---|---|---|
| Sunny Tank | Title, Home Tank, creator and restyle, area map, refuge | G major | 4/4, swung | 96 bpm | Kalimba tune, ukulele strum, soft taps and shaker, whistle on pass 2, bubbles |
| Canal Paddle | Canal (Area 1) | G major | 6/8 lilt, with a 1-2 3-4 5-6 flip in bars 4 and 8 | 68 (dotted quarter) | Marimba tune, strummed chords, soft kick, shaker, bubble pops |
| Lily Pad Hop | Lily pad pond (Areas 2 and 3) | F major | 4/4, straight | 104 bpm | Flute-like whistle tune doubled by marimba, plucked strings going oom-pah, wood block, a boing at phrase ends |
| Garden Boats | Chinampa gardens (Areas 4 and 5) | D mixolydian | 4/4 on a 3-3-2 beat | 112 bpm | Marimba tune with whistle, nylon guitar strums, guiro, box-drum slap, soft kick |
| Cenote Glow | Spring cave (Areas 6 and 7) | E dorian | 4/4, slow and straight | 66 bpm | Glass bell tune, a soft pad and a deep bass on each bar, glass sparkles, water drips, and the echo |
| Trajinera Waltz (provisional name) | Deep canal (from Area 8, once the habitat is built) | D major | 3/4 waltz, straight | 108 bpm | Nylon guitar tune, a deep bass and a soft kick on beat 1, plucked strings and a shaker on beats 2 and 3, a soft pad, a kalimba on pass 2, a second guitar a third below on pass 3, bubbles |

Chords, one bar each (two chords in one bar are split at the half bar):

| Cue | Bars 1 to 8 |
|---|---|
| Sunny Tank | G, Bm, C, D, G, E7, Am Cm, G D |
| Canal Paddle | G, C, D, G, C, G, Am D, G |
| Lily Pad Hop | F, Dm, Gm, C, F, A7, Bb C, F |
| Garden Boats | D, C, G, D, Bm, G, Em A, D |
| Cenote Glow | Em9, A, Cmaj7, D, Em9, A, Cmaj7, D |
| Trajinera Waltz | D, Bm, G, A, D, Em, A7, D |

The tunes are written out in the sketches (each cue's `tune` data) and in `src/logic/music.ts`.

Notes on mood:

- **Sunny Tank** is cozy but happy: a home to come back to. The E7 to Am lift is the smile, and the Cm near the end is the hug.
- **Canal Paddle** is the first trip: bouncy and friendly.
- **Lily Pad Hop** leaps like a frog, a little busier than the canal.
- **Garden Boats** is for the busiest areas: a sunny adventure, like a trajinera band going by. It is still never tense.
- **Cenote Glow** is for the cave: calm and full of wonder, never spooky, like light on clear water deep underground. It has no drums. Its plan differs from the usual one in section 3: a soft pad and a deep bass hold each bar's chord, glass bells play the tune, and now and then a glass bell sparkles an octave above the chord; on every third pass the tune rests and a made-up glass line from the E minor pentatonic notes, E5 up to E6, takes its place; water drips fall at random, and the echo carries all of it.
- **Trajinera Waltz** is for the deep canal: gliding and cozy, like a trajinera band's waltz heard from under the water as the boats go by overhead. It is the only cue in 3/4. The canal is deeper here, and the black bass lives in it, but the music stays the same when a predator warns (PRD M5): never tense or spooky. Two bubbles end bars 4 and 8.

## 5. The dusk rule

A dusk or night area plays the dusk version of its habitat's cue, never a cue of its own (PRD M4). One shared rule makes it from any cue:

| Part | Day | Dusk version |
|---|---|---|
| Tempo | The cue's tempo | Slower: Canal Paddle 54, Lily Pad Hop 80, Garden Boats 86, Cenote Glow 52 (no swing), Trajinera Waltz 84 (no swing) |
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

The spring cave (issue #77) was added this way. Its cue is **Cenote Glow**, the sketches page's sample cave cue, ported note for note from it: E dorian, 66 bpm, 4/4 with 2 steps a beat and no swing, its chords and tune, a soft pad and a bass note on each bar, glass bells for the tune and the chord sparkles, the glass line on every third pass, water drips, and an echo of 0.4 (section 3). It needed the two new voices (section 2) and the echo. E dorian uses the notes of D major, so the sounds play in D while it plays (the sound guide, section 3). Its dusk pace is 52 bpm with no swing; no spring cave area is at dusk yet. Check it by ear on the sketches page.

The deep canal (issue #78) is being added this way. Its cue is **Trajinera Waltz**, a provisional name: D major, 108 bpm, a straight 3/4 waltz with 2 steps a beat and no swing, the only cue in 3/4 and the only one at that tempo. Its lead is a nylon guitar, which no other cue uses for its tune. It plays oom-pah-pah: a soft pad, a deep bass and a soft kick on beat 1, then plucked strings and a shaker on beats 2 and 3, with now and then a quiet bass fifth leading into the next bar. Each pass changes, following section 3: pass 1 the guitar tune; pass 2 a kalimba joins an octave up; pass 3 a second guitar plays a third below, in D major; pass 4 keeps the tune for bars 1 to 4, then makes up a guitar phrase from the D major pentatonic notes, D5 up to D6. It uses existing voices only and has no echo, only the shared room reverb. D major's home note is D, so the sounds play in D while it plays (the sound guide, section 3). Its dusk pace is 84 bpm with no swing, for the shared dusk rule. It joins the habitat cue list when the deep canal habitat is built, and the habitat test (PRD M3) then checks it. Check it by ear on the sketches page.
