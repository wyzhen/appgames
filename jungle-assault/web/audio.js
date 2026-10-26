/* Synthesized effects and optional user-supplied local background music. */
(() => {
  'use strict';
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const MUSIC_KEYS = ['jungle', 'base', 'baseBoss'];

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
      this.timer = null;
      this.track = 'jungle';
      this._musicSlots = Object.fromEntries(MUSIC_KEYS.map(key => [key, {
        buffer: null, name: '', error: '', ready: false, persisted: false,
        importing: false, revision: 0, restoreBlocked: false
      }]));
      this.musicReady = false;
      this._musicSource = null;
      this._musicGain = null;
      this._musicOffset = 0;
      this._musicStartedAt = 0;
      this._storageQueue = Promise.resolve();
      this._dbPromise = null;
      this._resumePromise = null;
      // Restoring a file never starts playback without a later user gesture.
      this.ready = this._restoreImportedMusic();
    }

    _ensureContext() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
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
          this.ctx.onstatechange = () => this._syncMusicPlayback();
        } catch (_) { this.ctx = null; return false; }
      }
      return true;
    }

    unlock() {
      if (!this._ensureContext()) return;
      this.unlocked = true;
      // This is also called for every shot: an existing music source is reused.
      this._resumeContext();
      this._syncMusicPlayback();
    }

    _resumeContext() {
      if (!this.ctx || !this.unlocked || this.muted || this.paused || this.ctx.state !== 'suspended' || this._resumePromise) return;
      this._resumePromise = this.ctx.resume().catch(() => {}).then(() => {
        this._resumePromise = null;
        this._syncMusicPlayback();
      });
    }

    setMuted(value) {
      value = !!value;
      if (this.muted === value) return;
      this.muted = value;
      this._setGate();
    }

    setPaused(value) {
      value = !!value;
      if (this.paused === value) return;
      this.paused = value;
      this._setGate();
    }

    _setGate() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      // Silence immediately, including voices already queued by the scheduler.
      this.master.gain.setValueAtTime(this.muted || this.paused ? 0 : 0.58, now);
      this._clearVoices();
      this._resumeContext();
      this._syncMusicPlayback();
    }

    start() {
      this._stopImported(true);
      this._clearVoices();
      this.playing = true;
      this.step = 0;
      this._syncMusicPlayback();
    }

    stop() {
      this.playing = false;
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      this._stopImported(true);
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

    // Keep the original single-track read properties for existing integrations.
    get importedBuffer() { return this._musicSlots[this.track].buffer; }
    get importedName() { return this._musicSlots[this.track].name; }
    get musicError() { return this._musicSlots[this.track].error; }
    get musicPersisted() { return this._musicSlots[this.track].persisted; }
    get importing() { return this._musicSlots[this.track].importing; }

    _getMusicSlot(key) {
      if (!MUSIC_KEYS.includes(key)) throw new Error('未知的音乐槽');
      return this._musicSlots[key];
    }

    setTrack(key) {
      this._getMusicSlot(key);
      if (key === this.track) return this.getMusicStatus();
      // Stop while the old track is still selected, so elapsed time uses its buffer.
      this._stopImported(true);
      this.track = key;
      this._syncMusicPlayback();
      this._notifyMusicChange(key);
      return this.getMusicStatus();
    }

    getMusicStatus(key = this.track) {
      const slot = this._getMusicSlot(key);
      return {
        key,
        currentTrack: this.track,
        source: slot.buffer ? 'imported' : 'none',
        name: slot.name,
        error: slot.error,
        ready: slot.ready,
        persisted: slot.persisted,
        importing: slot.importing
      };
    }

    _notifyMusicChange(key = this.track) {
      window.dispatchEvent(new CustomEvent('game-music-change', {detail: this.getMusicStatus(key)}));
    }

    _openMusicDatabase() {
      if (!this._dbPromise) {
        this._dbPromise = new Promise((resolve, reject) => {
          if (!window.indexedDB) { reject(new Error('本机存储不可用')); return; }
          const request = window.indexedDB.open('jungle-assault-music', 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('music')) db.createObjectStore('music');
          };
          request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => { db.close(); this._dbPromise = null; };
            resolve(db);
          };
          request.onerror = () => reject(request.error || new Error('本机存储不可用'));
          request.onblocked = () => reject(new Error('本机存储正被其他窗口占用'));
        }).catch(error => { this._dbPromise = null; throw error; });
      }
      return this._dbPromise;
    }

    _musicStorageKey(key) {
      // v1.1 saved stage-one music as "background"; keep that record in place.
      return key === 'jungle' ? 'background' : key;
    }

    async _readMusicRecord(key) {
      const db = await this._openMusicDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('music', 'readonly');
        const request = tx.objectStore('music').get(this._musicStorageKey(key));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('读取音乐失败'));
        tx.onabort = () => reject(tx.error || new Error('读取音乐失败'));
      });
    }

    _persistMusic(record, key, revision) {
      // Serialize writes so a slow previous import cannot overwrite a newer choice.
      this._storageQueue = this._storageQueue.catch(() => {}).then(async () => {
        if (revision !== this._getMusicSlot(key).revision) return false;
        const db = await this._openMusicDatabase();
        if (revision !== this._getMusicSlot(key).revision) return false;
        return new Promise((resolve, reject) => {
          const tx = db.transaction('music', 'readwrite');
          const store = tx.objectStore('music');
          const storageKey = this._musicStorageKey(key);
          if (record) store.put(record, storageKey);
          else store.delete(storageKey);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error || new Error('保存音乐失败'));
          tx.onabort = () => reject(tx.error || new Error('保存音乐失败'));
        });
      });
      return this._storageQueue;
    }

    _fileBytes(file) {
      if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('无法读取所选文件'));
        reader.readAsArrayBuffer(file);
      });
    }

    async _decodeMusic(blob) {
      if (!blob || !Number.isFinite(blob.size) || blob.size <= 0) throw new Error('请选择有效的音频文件');
      if (blob.size > 20 * 1024 * 1024) throw new Error('音频文件不能超过 20 MB');
      if (!this._ensureContext()) throw new Error('当前设备不支持音频播放');
      const bytes = await this._fileBytes(blob);
      let buffer;
      try {
        buffer = await new Promise((resolve, reject) => {
          const result = this.ctx.decodeAudioData(bytes, resolve, reject);
          if (result && typeof result.then === 'function') result.then(resolve, reject);
        });
      } catch (_) {
        throw new Error('无法解码此文件，请选择设备支持的 MP3、WAV 或其他音频格式');
      }
      if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0 || !buffer.numberOfChannels) {
        throw new Error('音频文件没有可播放的内容');
      }
      return buffer;
    }

    async _restoreImportedMusic() {
      await Promise.all(MUSIC_KEYS.map(key => this._restoreMusicSlot(key)));
      this.musicReady = true;
      return this.getMusicStatus();
    }

    async _restoreMusicSlot(key) {
      const slot = this._getMusicSlot(key);
      let foundRecord = false;
      try {
        const record = await this._readMusicRecord(key);
        foundRecord = !!record;
        if (record && !slot.restoreBlocked) {
          const buffer = await this._decodeMusic(record.blob);
          if (!slot.restoreBlocked) {
            slot.buffer = buffer;
            slot.name = record.name || '本地音乐';
            slot.persisted = true;
          }
        }
      } catch (_) {
        // Storage may be disabled in a browser; game effects still work.
        if (!slot.restoreBlocked && foundRecord) slot.error = '无法恢复已保存的音乐，请重新导入';
      } finally {
        slot.ready = true;
        if (key === this.track) this._syncMusicPlayback();
        this._notifyMusicChange(key);
      }
    }

    async importMusic(file, key = this.track) {
      // Capture the slot and intent before any await; changing stages must not
      // redirect a file, and a later clear must cancel even a not-yet-ready import.
      const slot = this._getMusicSlot(key);
      const revision = ++slot.revision;
      slot.importing = true;
      slot.error = '';
      this._notifyMusicChange(key);
      try {
        await this.ready;
        if (revision !== slot.revision) throw new Error('此导入已取消');
        // Validate fully before touching the currently selected or playing music.
        const buffer = await this._decodeMusic(file);
        if (revision !== slot.revision) throw new Error('此导入已取消');
        const name = String(file.name || '本地音乐').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) || '本地音乐';
        if (key === this.track) this._stopImported(true);
        slot.buffer = buffer;
        slot.name = name;
        slot.error = '';
        slot.persisted = false;
        if (key === this.track) this._syncMusicPlayback();
        try {
          const saved = await this._persistMusic({blob: file, name}, key, revision);
          if (revision === slot.revision) slot.persisted = saved;
        } catch (_) {
          if (revision === slot.revision) slot.error = '音乐已导入，但本机存储不可用，关闭后需重新导入';
        }
        if (revision !== slot.revision) throw new Error('此导入已取消');
        slot.importing = false;
        return this.getMusicStatus(key);
      } catch (error) {
        if (revision === slot.revision) slot.error = error.message || '音乐导入失败';
        throw error;
      } finally {
        if (revision === slot.revision) {
          slot.importing = false;
          this._notifyMusicChange(key);
        }
      }
    }

    async clearImportedMusic(key = this.track) {
      const slot = this._getMusicSlot(key);
      const revision = ++slot.revision;
      slot.restoreBlocked = true;
      if (key === this.track) this._stopImported(true);
      slot.buffer = null;
      slot.name = '';
      slot.error = '';
      slot.persisted = false;
      slot.importing = false;
      if (key === this.track) this._syncMusicPlayback();
      this._notifyMusicChange(key);
      await this.ready;
      try {
        await this._persistMusic(null, key, revision);
      } catch (_) {
        if (revision === slot.revision) slot.error = '已关闭背景音乐，但无法清除本机保存的音乐';
      }
      if (revision === slot.revision) this._notifyMusicChange(key);
      return this.getMusicStatus(key);
    }

    _stopImported(resetPosition = false) {
      if (this._musicSource) {
        if (this.importedBuffer && this.ctx) {
          this._musicOffset = (this._musicOffset + Math.max(0, this.ctx.currentTime - this._musicStartedAt)) % this.importedBuffer.duration;
        }
        this._musicSource.onended = null;
        try { this._musicSource.stop(); } catch (_) {}
        try { this._musicSource.disconnect(); } catch (_) {}
        if (this._musicGain) this._musicGain.disconnect();
        this._musicSource = null;
        this._musicGain = null;
      }
      if (resetPosition) this._musicOffset = 0;
    }

    _syncMusicPlayback() {
      if (!this.importedBuffer) {
        this._stopImported(true);
        return;
      }
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      if (!this.ctx || !this.playing || !this.unlocked || this.muted || this.paused || this.ctx.state !== 'running') {
        this._stopImported(false);
        return;
      }
      if (this._musicSource) return;
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = this.importedBuffer;
      source.loop = true;
      gain.gain.value = 0.38;
      source.connect(gain);
      gain.connect(this.master);
      this._musicSource = source;
      this._musicGain = gain;
      this._musicStartedAt = this.ctx.currentTime;
      source.start(this._musicStartedAt, this._musicOffset % this.importedBuffer.duration);
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
