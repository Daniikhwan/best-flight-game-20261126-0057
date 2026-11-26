// Sky Ranger — all sound is synthesised with WebAudio, no audio files.
// One file, one job: engine hum, wind, chimes, thuds and the level fanfare.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.startEngineHum();
    this.startWind();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.ctx.suspend();
    if (!this.muted && this.ctx) this.ctx.resume();
    return this.muted;
  }

  startEngineHum() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(lowpass).connect(this.engineGain).connect(ctx.destination);
    this.engineOsc.start();
    // A second, slightly detuned oscillator gives the prop its throb.
    this.propOsc = ctx.createOscillator();
    this.propOsc.type = 'square';
    this.propOsc.frequency.value = 26;
    const propGain = ctx.createGain();
    propGain.gain.value = 0.05;
    this.propOsc.connect(propGain).connect(this.engineGain);
    this.propOsc.start();
  }

  startWind() {
    const ctx = this.ctx;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 480;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(this.windFilter).connect(this.windGain).connect(ctx.destination);
    this.windSource.start();
  }

  // Called every frame while flying: throttle 0..1, speed in world units.
  setFlight(throttle, speed, airborne) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const engineLevel = airborne ? 0.05 + throttle * 0.075 : 0.0;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(46 + throttle * 62 + speed * 0.12, t, 0.1);
    this.propOsc.frequency.setTargetAtTime(22 + throttle * 30, t, 0.1);
    const windLevel = airborne ? Math.min(0.16, speed / 900) : 0.0;
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(380 + speed * 4, t, 0.2);
  }

  blip(freq, duration, type, volume, when = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.18, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.02);
  }

  ringChime(combo) {
    // A rising arpeggio; higher combos climb higher.
    const base = 523 + Math.min(combo, 8) * 40;
    this.blip(base, 0.16, 'sine', 0.2);
    this.blip(base * 1.25, 0.18, 'sine', 0.18, 0.07);
    this.blip(base * 1.5, 0.26, 'sine', 0.16, 0.14);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    // Crunch: a burst of filtered noise on top.
    const noise = ctx.createBufferSource();
    const len = ctx.sampleRate * 0.18;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(filter).connect(ng).connect(ctx.destination);
    noise.start();
  }

  fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.blip(n, 0.35, 'triangle', 0.2, i * 0.11));
    this.blip(1319, 0.6, 'triangle', 0.16, 0.48);
  }

  warning() {
    this.blip(880, 0.09, 'square', 0.07);
    this.blip(880, 0.09, 'square', 0.07, 0.14);
  }

  click() {
    this.blip(1200, 0.05, 'sine', 0.1);
  }
}
