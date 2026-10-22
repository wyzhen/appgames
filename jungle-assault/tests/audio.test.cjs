const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// These tests control the audio clock and storage to reproduce lifecycle races.
// The generated fixture is test data, not bundled game music.
function fixture({ storageFails = false, savedRecord = null, suspended = false } = {}) {
  const records = new Map(savedRecord ? [['background', savedRecord]] : []);
  const events = [];
  const contexts = [];
  const pendingDecodes = [];
  const param = () => ({ value: 0, cancelScheduledValues() {},
    setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; },
    exponentialRampToValueAtTime(v) { this.value = v; } });
  class AudioNode {
    constructor() { this.gain = param(); this.frequency = param(); this.starts = []; this.stopped = false; }
    connect() {}
    disconnect() { this.disconnected = true; }
    start(...args) { this.starts.push(args); }
    stop() { this.stopped = true; if (this.onended) this.onended(); }
  }
  class AudioContext {
    constructor() { this.currentTime = 0; this.sampleRate = 10; this.state = suspended ? 'suspended' : 'running'; this.sources = []; this.oscillators = []; contexts.push(this); }
    createGain() { return new AudioNode(); }
    createDynamicsCompressor() { const n = new AudioNode(); for (const p of ['threshold', 'knee', 'ratio']) n[p] = param(); return n; }
    createBuffer() { return { getChannelData: () => new Float32Array(10) }; }
    createBufferSource() { const n = new AudioNode(); this.sources.push(n); return n; }
    createOscillator() { const n = new AudioNode(); this.oscillators.push(n); return n; }
    createBiquadFilter() { return new AudioNode(); }
    resume() { this.state = 'running'; if (this.onstatechange) this.onstatechange(); return Promise.resolve(); }
    decodeAudioData(bytes, resolve, reject) {
      const content = Buffer.from(bytes).toString();
      const buffer = {duration: 10, numberOfChannels: 2, content};
      if (content === 'pending') return new Promise((res, rej) => pendingDecodes.push({resolve: () => {resolve(buffer); res(buffer);}, reject: rej}));
      if (!content.startsWith('valid')) { const error = new Error('invalid audio'); reject(error); return Promise.reject(error); }
      resolve(buffer);
      return Promise.resolve(buffer);
    }
  }
  const db = {
    transaction() {
      const tx = {
        objectStore: () => ({
          get(key) { const request = {}; queueMicrotask(() => { request.result = records.get(key); request.onsuccess(); }); return request; },
          put(value, key) { queueMicrotask(() => { if (storageFails) { tx.error = new Error('quota'); tx.onerror(); } else { records.set(key, value); tx.oncomplete(); } }); },
          delete(key) { queueMicrotask(() => { if (storageFails) { tx.error = new Error('quota'); tx.onerror(); } else { records.delete(key); tx.oncomplete(); } }); }
        })
      };
      return tx;
    }, close() {}
  };
  const window = {
    AudioContext,
    indexedDB: {open() { const request = {}; queueMicrotask(() => {request.result = db; request.onsuccess();}); return request; }},
    dispatchEvent(event) {events.push(event);}
  };
  const sandbox = {window, CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options.detail;}}, clearInterval, setInterval, FileReader: class {}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../web/audio.js'), 'utf8'), sandbox);
  return {audio: new window.GameAudio(), GameAudio: window.GameAudio, records, events, contexts, pendingDecodes};
}
const audioFile = (name = 'stage-one.wav', content = 'valid-test-audio') => new File([content], name, {type: 'audio/wav'});
const loops = audio => audio.ctx.sources.filter(s => s.loop && !s.stopped);
const tick = () => new Promise(resolve => setImmediate(resolve));

test('default has no background music while game effects remain available', async () => {
  const {audio, events} = fixture();
  await audio.ready;
  assert.equal(audio.getMusicStatus().source, 'none');
  assert.equal(audio.getMusicStatus().ready, true);
  audio.unlock();
  audio.start();
  assert.equal(loops(audio).length, 0);
  audio.sfx('shoot');
  assert.ok(audio.ctx.oscillators.length > 0);
  assert.ok(events.some(e => e.type === 'game-music-change' && e.detail.ready));
});

test('valid import loops once; repeated unlock and firing do not interrupt it', async () => {
  const {audio, records} = fixture();
  await audio.ready;
  audio.unlock();
  audio.start();
  const file = audioFile();
  await audio.importMusic(file);
  const source = audio._musicSource;
  assert.ok(source.loop);
  assert.equal(loops(audio).length, 1);
  assert.equal(audio.getMusicStatus().persisted, true);
  assert.equal(records.get('background').blob, file);
  assert.equal(records.get('background').name, 'stage-one.wav');
  audio.ctx.currentTime = 4;
  for (let i = 0; i < 30; i++) { audio.unlock(); audio.sfx('shoot'); }
  assert.equal(audio._musicSource, source);
  assert.equal(source.starts.length, 1);
  assert.equal(source.stopped, false);
});

test('pause and mute preserve position; stop and restart never overlap music', async () => {
  const {audio} = fixture();
  await audio.ready;
  audio.unlock(); audio.start(); await audio.importMusic(audioFile());
  audio.ctx.currentTime = 4;
  audio.setPaused(true);
  assert.equal(loops(audio).length, 0);
  assert.equal(audio.master.gain.value, 0);
  audio.ctx.currentTime = 9;
  audio.setPaused(false);
  assert.equal(audio._musicSource.starts[0][1], 4);
  audio.ctx.currentTime = 11;
  audio.setMuted(true);
  assert.equal(loops(audio).length, 0);
  audio.ctx.currentTime = 20;
  audio.setMuted(false);
  assert.equal(audio._musicSource.starts[0][1], 6);
  assert.equal(loops(audio).length, 1);
  audio.start();
  assert.equal(audio._musicSource.starts[0][1], 0);
  assert.equal(loops(audio).length, 1);
  audio.stop(); audio.setPaused(false); audio.unlock();
  assert.equal(loops(audio).length, 0);
  audio.start();
  assert.equal(loops(audio).length, 1);
  assert.equal(audio._musicSource.starts[0][1], 0);
});

test('invalid and oversized files preserve the current playing track', async () => {
  const {audio} = fixture();
  await audio.ready;
  audio.unlock(); audio.start(); await audio.importMusic(audioFile());
  const source = audio._musicSource;
  const buffer = audio.importedBuffer;
  await assert.rejects(audio.importMusic(audioFile('broken.mp3', 'not audio')), /无法解码/);
  assert.equal(audio.importedBuffer, buffer);
  assert.equal(audio._musicSource, source);
  assert.equal(audio.getMusicStatus().name, 'stage-one.wav');
  let read = false;
  await assert.rejects(audio.importMusic({size: 20 * 1024 * 1024 + 1, arrayBuffer() {read = true;}}), /20 MB/);
  assert.equal(read, false);
  assert.equal(audio._musicSource, source);
  assert.equal(audio.getMusicStatus().importing, false);
});

test('stored Blob restores across instances but waits for user gesture and start', async () => {
  const {audio, GameAudio} = fixture();
  await audio.ready;
  await audio.importMusic(audioFile('local-stage.mp3'));
  const restored = new GameAudio();
  await restored.ready;
  assert.equal(restored.getMusicStatus().source, 'imported');
  assert.equal(restored.getMusicStatus().persisted, true);
  assert.equal(restored.getMusicStatus().name, 'local-stage.mp3');
  assert.equal(loops(restored).length, 0);
  restored.start();
  assert.equal(loops(restored).length, 0);
  restored.unlock();
  assert.equal(loops(restored).length, 1);
});

test('clearing music prevents a pending decode from restoring stale music', async () => {
  const {audio, pendingDecodes, records} = fixture();
  await audio.ready;
  audio.unlock(); audio.start(); await audio.importMusic(audioFile());
  const pending = audio.importMusic(audioFile('later.wav', 'pending'));
  await tick();
  assert.equal(pendingDecodes.length, 1);
  await audio.clearImportedMusic();
  pendingDecodes[0].resolve();
  await assert.rejects(pending, /已取消/);
  assert.equal(audio.getMusicStatus().source, 'none');
  assert.equal(audio.getMusicStatus().name, '');
  assert.equal(loops(audio).length, 0);
  assert.equal(records.has('background'), false);
  assert.equal(audio.getMusicStatus().importing, false);
});

test('storage failure is reported while the validated track stays usable', async () => {
  const {audio} = fixture({storageFails: true});
  await audio.ready;
  audio.unlock(); audio.start(); await audio.importMusic(audioFile());
  const status = audio.getMusicStatus();
  assert.equal(status.source, 'imported');
  assert.equal(status.persisted, false);
  assert.match(status.error, /关闭后需重新导入/);
  assert.equal(loops(audio).length, 1);
});

test('file import during pause waits for resume and does not change mute preference', async () => {
  const {audio} = fixture({suspended: true});
  await audio.ready;
  audio.setMuted(true); audio.setPaused(true); audio.unlock(); audio.start();
  await audio.importMusic(audioFile());
  assert.equal(loops(audio).length, 0);
  assert.equal(audio.muted, true);
  audio.setPaused(false);
  assert.equal(loops(audio).length, 0);
  audio.setMuted(false);
  await tick();
  assert.equal(loops(audio).length, 1);
  audio.setPaused(true);
  audio.ctx.state = 'suspended';
  audio.ctx.onstatechange();
  audio.ctx.state = 'running';
  audio.ctx.onstatechange();
  assert.equal(loops(audio).length, 0);
});
