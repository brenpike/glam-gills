/**
 * Browser glue: the synth voices the music and the sound effects share (PRD M6, S1; ADR 0025, ADR
 * 0026). Every voice is made live with Web Audio oscillators, noise and filters; there are no audio
 * files. The music player plays MusicNotes (playMusicNote) and the sound player plays sound notes
 * (playSoundNote), each into its own bus on the shared engine (src/platform/audioEngine.ts).
 */
import type { MusicNote } from '../logic/music';
import type { PlayedSoundNote, SoundPluck } from '../logic/sounds';

/** What a voice needs of the engine: the audio context, a second of noise, and the rendered plucks. */
export interface VoiceKit {
  ctx: BaseAudioContext;
  noise: AudioBuffer;
  /** Rendered plucks by voice and MIDI number, such as `'guitar:62'`. */
  plucks: Map<string, { buffer: AudioBuffer; rate: number }>;
}

/** Plucked strings by the Karplus-Strong method: ring length, sustain per pass and pick softness. */
const PLUCKS = Object.freeze({
  ukulele: Object.freeze({ seconds: 0.9, keep: 0.992, soft: 0.35 }),
  guitar: Object.freeze({ seconds: 1.6, keep: 0.996, soft: 0.6 }),
  strings: Object.freeze({ seconds: 0.45, keep: 0.982, soft: 0.7 }),
});
type PluckVoice = keyof typeof PLUCKS;
/** Top of the low-pass that softens the dusk pad, in Hz. */
const PAD_HZ = 950;
/** Seconds the dusk pad takes to die away after its chord. */
const PAD_RELEASE_S = 1.2;
/** The music's boing: its low, high and end pitches in Hz. */
const BOING_HZ: readonly number[] = Object.freeze([260, 720, 380]);
/** A water drip: its top pitch in Hz, up to DRIP_HZ.top + DRIP_HZ.spread, and the share of it the drip falls to. */
const DRIP_HZ = Object.freeze({ top: 1500, spread: 900, fall: 0.35 });
/** Seconds a sound's strummed strings are apart, low to high, unless its note says. */
const STRUM_GAP_S = 0.014;
/** How much quieter each higher string of a sound's strum is. */
const STRUM_FALL = 0.08;
export const SILENT = 0.0001;

export const midiHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** A second of white noise, which the noisy voices loop through. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Plays one music note on its voice into `out` at `time`. */
export function playMusicNote(kit: VoiceKit, out: AudioNode, note: MusicNote, time: number): void {
  const midi = note.midi ?? 0;
  const v = note.velocity;
  switch (note.voice) {
    case 'kalimba':
      return kalimba(kit, out, time, midi, v);
    case 'marimba':
      return marimba(kit, out, time, midi, v);
    case 'musicBox':
      return musicBox(kit, out, time, midi, v);
    case 'whistle':
      return whistle(kit, out, time, midi, v, note.duration);
    case 'ukulele':
    case 'guitar':
    case 'strings':
      return pluck(kit, out, note.voice, time, midi, v);
    case 'strum':
      return struck(kit, out, time, midi, v);
    case 'pad':
      return pad(kit, out, time, midi, v, note.duration);
    case 'bass':
      return bass(kit, out, time, midi, v, note.duration);
    case 'tap':
      return tap(kit, out, time, v);
    case 'shaker':
      return shaker(kit, out, time, v);
    case 'kick':
      return kick(kit, out, time, v);
    case 'slap':
      return slap(kit, out, time, v);
    case 'guiro':
      return guiro(kit, out, time, v, note.duration);
    case 'woodBlock':
      return woodBlock(kit, out, time, midiHz(midi), v);
    case 'bubble':
      return bubble(kit, out, time, midiHz(midi), v);
    case 'boing':
      return boing(kit, out, time, v, BOING_HZ);
    case 'firefly':
      return firefly(kit, out, time, midi, v);
    case 'glass':
      return glass(kit, out, time, midi, v, note.duration);
    case 'drip':
      return drip(kit, out, time, v);
    default: {
      const unhandled: never = note.voice;
      throw new Error(`audioVoices: no music voice ${String(unhandled)}`);
    }
  }
}

/** Plays one sound note on its voice into `out` at `time` (docs/sound-guide.md, section 5). */
export function playSoundNote(kit: VoiceKit, out: AudioNode, note: PlayedSoundNote, time: number): void {
  const v = note.velocity;
  const midi = note.midis[0] ?? 0;
  const hz = note.hz ?? [];
  switch (note.voice) {
    case 'kalimba':
      return kalimba(kit, out, time, midi, v);
    case 'marimba':
      return marimba(kit, out, time, midi, v);
    case 'musicBox':
      return musicBox(kit, out, time, midi, v);
    case 'glass':
      return glass(kit, out, time, midi, v, note.seconds ?? 2.6);
    case 'whistle':
      return whistle(kit, out, time, midi, v, note.seconds ?? 0.2);
    case 'firefly':
      return firefly(kit, out, time, midi, v);
    case 'pluck':
      return pluck(kit, out, note.pluck ?? 'ukulele', time, midi, v);
    case 'strumPluck':
      return strumPluck(kit, out, note.pluck ?? 'ukulele', time, note.midis, v, note.gap ?? STRUM_GAP_S);
    case 'pad':
      for (const each of note.midis) pad(kit, out, time, each, v, note.seconds ?? 1);
      return;
    case 'bubble':
      return bubble(kit, out, time, hz[0] ?? 500 + Math.random() * 400, v);
    case 'boing':
      return boing(kit, out, time, v, hz.length === 3 ? hz : BOING_HZ);
    case 'woodBlock':
      return woodBlock(kit, out, time, hz[0] ?? 880, v);
    case 'shaker':
      return shaker(kit, out, time, v, note.seconds);
    case 'swoosh':
      return swoosh(kit, out, time, note.seconds ?? 0.3, hz[0] ?? 500, hz[1] ?? 2600, v, note.q ?? 1.4);
    case 'puff':
      return puff(kit, out, time, v, hz[0] ?? 1600, note.seconds ?? 0.32);
    case 'glide':
      return glide(kit, out, time, hz[0] ?? 330, hz[1] ?? 210, note.seconds ?? 0.2, v, note.wave ?? 'triangle', note.wobble ?? 0);
    case 'clay':
      return clay(kit, out, time, v);
    default: {
      const unhandled: never = note.voice;
      throw new Error(`audioVoices: no sound voice ${String(unhandled)}`);
    }
  }
}

/** Rises to `peak` over `attack` seconds from `time`, then dies away over `decay` seconds. */
function envelope(gain: GainNode, time: number, attack: number, peak: number, decay: number): void {
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, time + attack + decay);
}

function tone(
  kit: VoiceKit,
  out: AudioNode,
  time: number,
  hz: number,
  type: OscillatorType,
  attack: number,
  peak: number,
  decay: number,
): OscillatorNode {
  const { ctx } = kit;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  envelope(gain, time, attack, peak, decay);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + attack + decay + 0.05);
  return osc;
}

/** Noise for `seconds` from a random place in the noise buffer, looping so a long burst is never cut short. */
function noiseBurst(kit: VoiceKit, out: AudioNode, time: number, seconds: number): void {
  const source = kit.ctx.createBufferSource();
  source.buffer = kit.noise;
  source.loop = true;
  source.connect(out);
  source.start(time, Math.random() * 0.8);
  source.stop(time + seconds);
}

function kalimba(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number): void {
  const hz = midiHz(midi);
  tone(kit, out, time, hz, 'sine', 0.004, v, 1.3);
  tone(kit, out, time, hz * 2, 'triangle', 0.003, v * 0.12, 0.25);
  tone(kit, out, time, hz * 5.4, 'sine', 0.002, v * 0.1, 0.05);
}

/** A marimba bar: a short, warm tone with its bright fourth partial. */
function marimba(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number): void {
  const hz = midiHz(midi);
  tone(kit, out, time, hz, 'sine', 0.003, v, 0.55);
  tone(kit, out, time, hz * 3.98, 'sine', 0.002, v * 0.22, 0.07);
  tone(kit, out, time, hz * 9.2, 'sine', 0.001, v * 0.05, 0.02);
}

/** A music box tine: long and pure, with a little shimmer at the start. */
function musicBox(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number): void {
  const hz = midiHz(midi);
  tone(kit, out, time, hz, 'sine', 0.002, v, 1.8);
  tone(kit, out, time, hz * 4.01, 'sine', 0.001, v * 0.12, 0.3);
  tone(kit, out, time, hz * 2, 'sine', 0.002, v * 0.08, 0.6);
}

/** A glass chime: a pure tone ringing for `ring` seconds, with its glassy upper partials. */
function glass(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number, ring: number): void {
  const hz = midiHz(midi);
  tone(kit, out, time, hz, 'sine', 0.004, v, ring);
  tone(kit, out, time, hz * 2.76, 'sine', 0.003, v * 0.25, ring * 0.35);
  tone(kit, out, time, hz * 5.4, 'sine', 0.002, v * 0.08, 0.3);
}

/** One string of Canal Paddle's struck strum: a short triangle tone with a soft octave. */
function struck(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number): void {
  const hz = midiHz(midi);
  tone(kit, out, time, hz, 'triangle', 0.003, v * 0.7, 0.28);
  tone(kit, out, time, hz * 2, 'sine', 0.002, v * 0.2, 0.12);
}

/** One note of the dusk pad: two soft, slightly detuned triangles held for `duration`, then let go. */
function pad(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number, duration: number): void {
  const { ctx } = kit;
  const lowPass = ctx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = PAD_HZ;
  lowPass.Q.value = 0.4;
  const gain = ctx.createGain();
  const attack = Math.min(0.9, duration * 0.3);
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.linearRampToValueAtTime(v, time + attack);
  gain.gain.setValueAtTime(v, time + Math.max(attack, duration - 0.05));
  gain.gain.exponentialRampToValueAtTime(SILENT, time + duration + PAD_RELEASE_S);
  lowPass.connect(gain);
  gain.connect(out);
  for (const cents of [-7, 7]) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiHz(midi);
    osc.detune.value = cents;
    osc.connect(lowPass);
    osc.start(time);
    osc.stop(time + duration + PAD_RELEASE_S + 0.1);
  }
}

/** A soft, flute-like whistle with a little vibrato and a breath of air at the start. */
function whistle(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number, duration: number): void {
  const { ctx } = kit;
  const hz = midiHz(midi);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  osc.frequency.value = hz;
  lfo.frequency.value = 5.5;
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(hz * 0.006, time + 0.25);
  lfo.connect(depth);
  depth.connect(osc.frequency);
  const hold = Math.max(0.08, duration * 0.85);
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.linearRampToValueAtTime(v, time + 0.035);
  gain.gain.setValueAtTime(v, time + hold);
  gain.gain.exponentialRampToValueAtTime(SILENT, time + hold + 0.14);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  lfo.start(time);
  osc.stop(time + hold + 0.2);
  lfo.stop(time + hold + 0.2);
  const air = ctx.createBiquadFilter();
  const airGain = ctx.createGain();
  air.type = 'bandpass';
  air.frequency.value = hz * 2;
  air.Q.value = 3;
  envelope(airGain, time, 0.01, v * 0.5, 0.06);
  air.connect(airGain);
  airGain.connect(out);
  noiseBurst(kit, air, time, 0.1);
}

/** A plucked string (ukulele, nylon guitar or plucked strings), rendered once per note and kept. */
function pluck(kit: VoiceKit, out: AudioNode, voice: PluckVoice, time: number, midi: number, v: number): void {
  const { buffer, rate } = pluckBuffer(kit, voice, midi);
  const source = kit.ctx.createBufferSource();
  const gain = kit.ctx.createGain();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  gain.gain.value = v;
  source.connect(gain);
  gain.connect(out);
  source.start(time);
}

/** A strum of plucked strings, low to high, `gap` seconds apart, each a little quieter. */
function strumPluck(kit: VoiceKit, out: AudioNode, voice: SoundPluck, time: number, midis: readonly number[], v: number, gap: number): void {
  midis.forEach((midi, i) => pluck(kit, out, voice, time + i * gap, midi, v * (1 - i * STRUM_FALL)));
}

function pluckBuffer(kit: VoiceKit, voice: PluckVoice, midi: number): { buffer: AudioBuffer; rate: number } {
  const key = `${voice}:${midi}`;
  const kept = kit.plucks.get(key);
  if (kept !== undefined) return kept;
  const { ctx } = kit;
  const sampleRate = ctx.sampleRate;
  const hz = midiHz(midi);
  const shape = PLUCKS[voice];
  const period = Math.max(2, Math.floor(sampleRate / hz - 0.5));
  const length = Math.floor(sampleRate * shape.seconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i <= period; i++) {
    last = last * shape.soft + (Math.random() * 2 - 1) * (1 - shape.soft);
    data[i] = last * 2;
  }
  for (let i = period + 1; i < length; i++) data[i] = (data[i - period] + data[i - period - 1]) * 0.5 * shape.keep;
  // Averaging the samples `period` and `period + 1` back makes the loop `period + 0.5` samples long,
  // so the played rate corrects the pitch to `hz`.
  const made = { buffer, rate: hz / (sampleRate / (period + 0.5)) };
  kit.plucks.set(key, made);
  return made;
}

function bass(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number, duration: number): void {
  const lowPass = kit.ctx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 520;
  lowPass.connect(out);
  const hz = midiHz(midi);
  const decay = Math.min(duration, 0.7);
  tone(kit, lowPass, time, hz, 'triangle', 0.006, v, decay);
  tone(kit, lowPass, time, hz, 'sine', 0.006, v * 0.6, decay);
}

function tap(kit: VoiceKit, out: AudioNode, time: number, v: number): void {
  const band = kit.ctx.createBiquadFilter();
  const gain = kit.ctx.createGain();
  band.type = 'bandpass';
  band.frequency.value = 2200;
  band.Q.value = 1.2;
  envelope(gain, time, 0.002, v, 0.04);
  band.connect(gain);
  gain.connect(out);
  noiseBurst(kit, band, time, 0.06);
  tone(kit, out, time, 330, 'sine', 0.002, v * 0.5, 0.04);
}

/** A shaker: high noise that dies away over `decay` seconds (0.05 in the music). */
function shaker(kit: VoiceKit, out: AudioNode, time: number, v: number, decay = 0.05): void {
  const high = kit.ctx.createBiquadFilter();
  const gain = kit.ctx.createGain();
  high.type = 'highpass';
  high.frequency.value = 6000;
  envelope(gain, time, 0.004, v, decay);
  high.connect(gain);
  gain.connect(out);
  noiseBurst(kit, high, time, decay + 0.03);
}

/** A soft kick: a low thump that drops in pitch. */
function kick(kit: VoiceKit, out: AudioNode, time: number, v: number): void {
  const { ctx } = kit;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(130, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + 0.12);
  envelope(gain, time, 0.004, v, 0.18);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.25);
}

/** A box-drum slap: a band of noise over a low knock. */
function slap(kit: VoiceKit, out: AudioNode, time: number, v: number): void {
  const band = kit.ctx.createBiquadFilter();
  const gain = kit.ctx.createGain();
  band.type = 'bandpass';
  band.frequency.value = 1500;
  band.Q.value = 0.9;
  envelope(gain, time, 0.002, v, 0.09);
  band.connect(gain);
  gain.connect(out);
  noiseBurst(kit, band, time, 0.12);
  tone(kit, out, time, 190, 'sine', 0.002, v * 1.2, 0.07);
}

/** A guiro scrape: quick ridges of filtered noise, growing a little, over `duration` seconds. */
function guiro(kit: VoiceKit, out: AudioNode, time: number, v: number, duration: number): void {
  const band = kit.ctx.createBiquadFilter();
  const gain = kit.ctx.createGain();
  band.type = 'bandpass';
  band.frequency.value = 3200;
  band.Q.value = 2;
  const ridgeS = 0.018;
  const ridges = Math.max(4, Math.round(duration / ridgeS));
  gain.gain.setValueAtTime(SILENT, time);
  for (let k = 0; k < ridges; k++) {
    const at = time + k * ridgeS;
    gain.gain.setValueAtTime(v * (0.6 + 0.4 * (k / ridges)), at);
    gain.gain.setValueAtTime(SILENT, at + 0.008);
  }
  band.connect(gain);
  gain.connect(out);
  noiseBurst(kit, band, time, ridges * ridgeS + 0.02);
}

/** A wood block tick: two short, high tones, the base at `hz`. */
function woodBlock(kit: VoiceKit, out: AudioNode, time: number, hz: number, v: number): void {
  tone(kit, out, time, hz, 'sine', 0.001, v, 0.045);
  tone(kit, out, time, hz * 1.625, 'sine', 0.001, v * 0.4, 0.025);
}

/** A lily-pad boing: a triangle that springs up from `hz[0]` to `hz[1]`, then settles at `hz[2]`. */
function boing(kit: VoiceKit, out: AudioNode, time: number, v: number, hz: readonly number[]): void {
  const { ctx } = kit;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(hz[0], time);
  osc.frequency.exponentialRampToValueAtTime(hz[1], time + 0.09);
  osc.frequency.exponentialRampToValueAtTime(hz[2], time + 0.28);
  envelope(gain, time, 0.005, v, 0.3);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.36);
}

/** A firefly: a soft, high chime that drifts a little in pitch. */
function firefly(kit: VoiceKit, out: AudioNode, time: number, midi: number, v: number): void {
  const osc = tone(kit, out, time, midiHz(midi), 'sine', 0.02, v, 0.7);
  osc.detune.setValueAtTime(-8, time);
  osc.detune.linearRampToValueAtTime(8, time + 0.7);
}

/** A bubble pop: a quick upward slide from `base` Hz. */
function bubble(kit: VoiceKit, out: AudioNode, time: number, base: number, v: number): void {
  const { ctx } = kit;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(base, time);
  osc.frequency.exponentialRampToValueAtTime(base * 2.6, time + 0.07);
  envelope(gain, time, 0.003, v, 0.08);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.12);
}

/** A water drip: a quick fall in pitch from a random top. */
function drip(kit: VoiceKit, out: AudioNode, time: number, v: number): void {
  const { ctx } = kit;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const top = DRIP_HZ.top + Math.random() * DRIP_HZ.spread;
  osc.frequency.setValueAtTime(top, time);
  osc.frequency.exponentialRampToValueAtTime(top * DRIP_HZ.fall, time + 0.06);
  envelope(gain, time, 0.002, v, 0.09);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.12);
}

/** A swoosh: noise through a band that slides from `from` Hz to `to` Hz over `seconds`. */
function swoosh(kit: VoiceKit, out: AudioNode, time: number, seconds: number, from: number, to: number, v: number, q: number): void {
  const band = kit.ctx.createBiquadFilter();
  const gain = kit.ctx.createGain();
  band.type = 'bandpass';
  band.Q.value = q;
  band.frequency.setValueAtTime(from, time);
  band.frequency.exponentialRampToValueAtTime(to, time + seconds);
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.linearRampToValueAtTime(v, time + seconds * 0.35);
  gain.gain.exponentialRampToValueAtTime(SILENT, time + seconds);
  band.connect(gain);
  gain.connect(out);
  noiseBurst(kit, band, time, seconds + 0.02);
}

/** A soft puff of air: low-passed noise from `top` Hz that blooms and fades over `seconds`. */
function puff(kit: VoiceKit, out: AudioNode, time: number, v: number, top: number, seconds: number): void {
  const lowPass = kit.ctx.createBiquadFilter();
  const gain = kit.ctx.createGain();
  lowPass.type = 'lowpass';
  lowPass.frequency.setValueAtTime(top, time);
  lowPass.frequency.exponentialRampToValueAtTime(top * 0.4, time + seconds);
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.linearRampToValueAtTime(v, time + 0.03);
  gain.gain.exponentialRampToValueAtTime(SILENT, time + seconds);
  lowPass.connect(gain);
  gain.connect(out);
  noiseBurst(kit, lowPass, time, seconds + 0.02);
}

/** A glide: one tone sliding from `from` Hz to `to` Hz, with an optional wobble, for spits, stretches and blips. */
function glide(
  kit: VoiceKit,
  out: AudioNode,
  time: number,
  from: number,
  to: number,
  seconds: number,
  v: number,
  wave: OscillatorType,
  wobble: number,
): void {
  const { ctx } = kit;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(from, time);
  osc.frequency.exponentialRampToValueAtTime(to, time + seconds);
  if (wobble > 0) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = wobble;
    depth.gain.value = from * 0.06;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(time);
    lfo.stop(time + seconds + 0.1);
  }
  envelope(gain, time, 0.006, v, seconds);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + seconds + 0.1);
}

/** A clay knock, the Dash pot: a low hollow tone with a burst of grit. */
function clay(kit: VoiceKit, out: AudioNode, time: number, v: number): void {
  tone(kit, out, time, 210, 'sine', 0.002, v, 0.12);
  tone(kit, out, time, 520, 'triangle', 0.001, v * 0.3, 0.05);
  const band = kit.ctx.createBiquadFilter();
  const gain = kit.ctx.createGain();
  band.type = 'bandpass';
  band.frequency.value = 1100;
  band.Q.value = 0.8;
  envelope(gain, time, 0.002, v * 0.8, 0.08);
  band.connect(gain);
  gain.connect(out);
  noiseBurst(kit, band, time, 0.1);
}
