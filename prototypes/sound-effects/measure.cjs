// Renders every sound in sketches.html (and each music cue) offline in Chromium and reports its
// loudness, K-weighted roughly like LUFS (a +4 dB shelf above 1.5 kHz and a 60 Hz low cut), over the
// loudest 0.2 seconds (docs/sound-guide.md, section 4).
//
//   node prototypes/sound-effects/measure.cjs        raw levels, before each sound's LEVEL_DB
//   node prototypes/sound-effects/measure.cjs gain   levels after LEVEL_DB: event sounds near -18, touch near -21
//
// Needs Playwright and its Chromium (preinstalled in cloud sessions). Writes a probe copy of the page
// to the system temp folder; makes no network requests.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const src = fs.readFileSync(path.join(__dirname, 'sketches.html'), 'utf8');
const probe = `
  window.__list = () => GROUPS.flatMap((g) => (g.sounds || []).flatMap((s) => (s.btns || [['Play', null]]).map(([, arg]) => [s.id, arg])));
  function freshOffline(seconds) {
    const sr = 48000, oc = new OfflineAudioContext(1, Math.ceil(sr * seconds), sr);
    ctx = oc; pluckCache.clear(); ladder = 0; ladderAt = -10;
    noiseBuf = oc.createBuffer(1, sr, sr); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const shelf = oc.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1500; shelf.gain.value = 4;
    const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 60; hp.Q.value = 0.5;
    sfxBus = oc.createGain(); musicBus = oc.createGain();
    sfxBus.connect(shelf); musicBus.connect(shelf); shelf.connect(hp); hp.connect(oc.destination);
    return oc;
  }
  function loud(data, sr, win) {
    const n = Math.floor(sr * win), hop = Math.floor(sr * 0.01);
    let best = 0; const series = [];
    const sq = new Float64Array(data.length + 1);
    for (let i = 0; i < data.length; i++) sq[i + 1] = sq[i] + data[i] * data[i];
    for (let i = 0; i + n <= data.length; i += hop) { const ms = (sq[i + n] - sq[i]) / n; series.push(ms); if (ms > best) best = ms; }
    return { max: -0.691 + 10 * Math.log10(best + 1e-12), series };
  }
  window.__measureSound = async (id, arg, withGain, runs) => {
    let m = 0, peak = 0;
    for (let r = 0; r < runs; r++) {
      const oc = freshOffline(4);
      if (withGain) { const st = oc.createGain(); st.gain.value = gainFor(id, arg); st.connect(sfxBus); S = st; }
      FX[id](arg); S = null;
      const buf = await oc.startRendering(); const d = buf.getChannelData(0);
      m += loud(d, 48000, 0.2).max;
      for (const x of d) peak = Math.max(peak, Math.abs(x));
    }
    return { m: m / runs, peakDb: 20 * Math.log10(peak + 1e-12) };
  };
  window.__measureMusic = async (choiceId, seconds) => {
    const c = CHOICES.find((x) => x.id === choiceId), tr = trackOf(c), dusk = c.dusk;
    const oc = freshOffline(seconds);
    const spb = tr.beatsPerBar * tr.stepsPerBeat, sd = 60 / (dusk ? dusk.bpm : tr.bpm) / tr.stepsPerBeat, sw = dusk ? dusk.swing : tr.swing;
    for (let i = 0, t = 0.05; t < seconds - 1; i++, t += sd) {
      const bar = Math.floor(i / spb) % tr.chords.length, pass = Math.floor(i / (spb * tr.chords.length)), st = i % spb;
      const half = tr.chords[bar], split = half.length === 2, chord = split && st >= spb / 2 ? half[1] : half[0];
      const rng = mulberry32((pass * 977 + bar * 131 + st * 17 + tr.id.length * 7919) >>> 0);
      const e = { t: t + (st % 2 === 1 ? sd * sw : 0), bar, st, pass, rng, stepDur: sd, chord, chordStart: st === 0 || (split && st === spb / 2), chordSteps: split ? spb / 2 : spb };
      if (dusk) duskStep(tr, e); else tr.step(e);
    }
    const buf = await oc.startRendering();
    const { series } = loud(buf.getChannelData(0), 48000, 0.2);
    const db = series.map((ms) => -0.691 + 10 * Math.log10(ms + 1e-12)).sort((a, b) => a - b);
    return { median: db[Math.floor(db.length / 2)], p90: db[Math.floor(db.length * 0.9)] };
  };
`;
const html = src.replace('})();\n</script>', probe + '})();\n</script>');
const page = path.join(os.tmpdir(), 'glam-gills-sound-measure.html');
fs.writeFileSync(page, html);

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('file://' + page);
  const withGain = process.argv[2] === 'gain';
  const list = await p.evaluate(() => window.__list());
  const out = {};
  for (const [id, arg] of list) {
    if (arg === 'none') continue;
    out[`${id}:${arg}`] = await p.evaluate(([i, a, g]) => window.__measureSound(i, a, g, 4), [id, arg, withGain]);
  }
  const music = {};
  for (const c of ['home', 'canal', 'pond', 'pond-dusk', 'chinampa']) music[c] = await p.evaluate((c) => window.__measureMusic(c, 20), c);
  console.log(JSON.stringify({ out, music }, null, 1));
  await browser.close();
})();
