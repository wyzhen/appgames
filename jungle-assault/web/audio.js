/* Original, entirely synthesized arcade music and effects. No external audio. */
(() => {
  'use strict';
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  class GameAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.paused = false;
      this.playing = false;
      this.unlocked = false;
      this.voices = new Set();
      this.lastEffects = Object.create(null);
      this.step = 0;
      this.nextBeat = 0;
      this.timer = null;
      this.tempo = 136;
      // An original A-minor melody; each entry occupies one sixteenth note.
      this.melody = [
        76,0,79,0,81,0,76,0, 74,0,72,74,76,0,0,0,
        76,0,79,81,84,0,81,0, 79,0,76,0,74,0,0,0,
        72,0,76,0,79,0,76,0, 74,0,72,71,69,0,0,0,
        71,0,74,0,76,0,79,0, 78,76,74,71,69,0,0,0
      ];
      this.bass = [45,45,45,45,41,41,43,43,45,45,45,45,41,43,40,40];
    }

    unlock() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        try {
          this.ctx = new AudioContext();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted || this.paused ? 0 : 0.58;
          const compressor = this.ctx.createDynamicsCompressor();
          compressor.threshold.value = -16;
          compressor.knee.value = 18;
          compressor.ratio.value = 4;
          this.master.connect(compressor);
          compressor.connect(this.ctx.destination);
          this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
          const samples = this.noise.getChannelData(0);
          let seed = 48713;
          for (let i = 0; i < samples.length; i++) {
            seed = (seed * 16807) % 2147483647;
            samples[i] = (seed / 1073741824) - 1;
          }
        } catch (_) { this.ctx = null; return; }
      }
      this.unlocked = true;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      if (this.playing) this._ensureTimer();
    }

    setMuted(value) {
      this.muted = !!value;
      this._setGate();
    }

    setPaused(value) {
      this.paused = !!value;
      this._setGate();
    }

    _setGate() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      // Silence immediately, including voices already queued by the scheduler.
      this.master.gain.setValueAtTime(this.muted || this.paused ? 0 : 0.58, now);
      this._clearVoices();
      this.nextBeat = now + 0.04;
      if (!this.muted && !this.paused && this.unlocked && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    start() {
      this.playing = true;
      this.step = 0;
      if (this.ctx) this.nextBeat = this.ctx.currentTime + 0.06;
      this._ensureTimer();
    }

    stop() {
      this.playing = false;
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      this._clearVoices();
      this.step = 0;
    }

    _clearVoices() {
      for (const node of this.voices) {
        try { node.stop(); } catch (_) {}
        try { node.disconnect(); } catch (_) {}
      }
      this.voices.clear();
    }

    _ensureTimer() {
      if (this.timer !== null || !this.ctx || !this.playing) return;
      this.timer = setInterval(() => this._schedule(), 40);
    }

    _schedule() {
      if (!this.ctx || !this.playing || this.muted || this.paused || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      if (this.nextBeat < now - 0.2) this.nextBeat = now + 0.025;
      const interval = 60 / this.tempo / 4;
      while (this.nextBeat < now + 0.12) {
        const s = this.step % 64;
        const t = this.nextBeat;
        const note = this.melody[s];
        if (note) this._tone(midi(note), interval * 0.72, 'square', 0.043, t);
        if (s % 4 === 0) {
          const bass = midi(this.bass[Math.floor(s / 4)]);
          this._tone(bass, interval * 2.4, 'triangle', 0.16, t);
        }
        if (s % 8 === 0 || s % 16 === 11) this._tone(115, 0.095, 'sine', 0.19, t, 36);
        if (s % 8 === 4) {
          this._noise(0.075, 0.065, t, 'highpass', 1000);
          this._tone(170, 0.06, 'triangle', 0.045, t, 95);
        }
        if (s % 2 === 0) this._noise(0.022, 0.017, t, 'highpass', 5800);
        this.step++;
        this.nextBeat += interval;
      }
    }

    _track(node, gain, filter) {
      this.voices.add(node);
      node.onended = () => {
        this.voices.delete(node);
        try { node.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); } catch (_) {}
      };
    }

    _tone(freq, duration, type, volume, when, endFreq) {
      if (!this.ctx || this.muted || this.paused) return;
      const t = when === undefined ? this.ctx.currentTime : when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      this._track(osc, gain);
      osc.start(t);
      osc.stop(t + duration + 0.015);
    }

    _noise(duration, volume, when, filterType = 'lowpass', frequency = 2200) {
      if (!this.ctx || this.muted || this.paused) return;
      const t = when === undefined ? this.ctx.currentTime : when;
      const source = this.ctx.createBufferSource();
      source.buffer = this.noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(frequency, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      this._track(source, gain, filter);
      source.start(t, (this.step % 11) * 0.031);
      source.stop(t + duration);
    }

    sfx(name) {
      if (!this.ctx || !this.unlocked || this.muted || this.paused || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const cooldown = {shoot:0.065,spread:0.10,laser:0.09,hit:0.055,explosion:0.06};
      if (t - (this.lastEffects[name] ?? -99) < (cooldown[name] || 0.025)) return;
      this.lastEffects[name] = t;
      switch (name) {
        case 'shoot':
          this._tone(510, 0.045, 'triangle', 0.12, t, 150);
          this._noise(0.025, 0.047, t, 'lowpass', 1800);
          break;
        case 'spread':
          this._tone(420, 0.07, 'triangle', 0.15, t, 92);
          this._noise(0.065, 0.12, t, 'lowpass', 1700);
          break;
        case 'laser':
          this._tone(1120, 0.11, 'sawtooth', 0.052, t, 180);
          this._tone(560, 0.085, 'triangle', 0.075, t, 110);
          break;
        case 'jump':
          this._tone(180, 0.12, 'square', 0.064, t, 580);
          break;
        case 'hit':
          this._tone(170, 0.045, 'square', 0.06, t, 70);
          this._noise(0.045, 0.075, t);
          break;
        case 'explosion':
          this._noise(0.32, 0.25, t, 'lowpass', 1300);
          this._tone(90, 0.26, 'triangle', 0.20, t, 26);
          break;
        case 'pickup':
          [76,81,88].forEach((n,i) => this._tone(midi(n), 0.095, 'square', 0.07, t + i * 0.065));
          break;
        case 'death':
          this._noise(0.23, 0.20, t, 'lowpass', 1700);
          [76,72,69,64,57].forEach((n,i) => this._tone(midi(n), 0.13, 'square', 0.075, t + i * 0.085));
          break;
        case 'clear':
          [69,72,76,81,76,81,84,88].forEach((n,i) => {
            this._tone(midi(n), i === 7 ? 0.7 : 0.16, 'square', 0.072, t + i * 0.14);
            this._tone(midi(n - 12), 0.18, 'triangle', 0.09, t + i * 0.14);
          });
          break;
        case 'boss':
          [45,45,46,45].forEach((n,i) => this._tone(midi(n), 0.19, 'sawtooth', 0.07, t + i * 0.21));
          this._noise(0.5, 0.15, t, 'lowpass', 900);
          break;
      }
    }
  }
  window.GameAudio = GameAudio;
})();
