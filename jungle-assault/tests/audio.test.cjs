const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// These tests control the audio clock and storage to reproduce lifecycle races.
// The generated fixture is test data, not bundled game music.
function fixture({ storageFails = false, savedRecord = null, savedRecords = [], suspended = false } = {}) {
  const records = new Map(savedRecords);
  if (savedRecord) records.set('background', savedRecord);
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

test('legacy background record restores only to jungle, never to empty stage-two slots', async () => {
  const record = {blob: audioFile('legacy-stage-one.mp3', 'valid-legacy'), name: 'legacy-stage-one.mp3'};
  const {audio, records} = fixture({savedRecord: record});
  await audio.ready;
  assert.equal(audio.track, 'jungle');
  assert.equal(audio.getMusicStatus('jungle').name, 'legacy-stage-one.mp3');
  assert.equal(audio.getMusicStatus('base').source, 'none');
  assert.equal(audio.getMusicStatus('baseBoss').source, 'none');
  audio.unlock(); audio.start();
  const jungleSource = audio._musicSource;
  assert.equal(jungleSource.buffer.content, 'valid-legacy');
  audio.setTrack('base');
  assert.equal(jungleSource.stopped, true);
  assert.equal(loops(audio).length, 0);
  audio.setTrack('baseBoss');
  assert.equal(loops(audio).length, 0);
  assert.equal(records.get('background'), record);
});

test('three music slots save and restore independently without restarting the active source', async () => {
  const {audio, records, GameAudio} = fixture();
  await audio.ready;
  audio.unlock(); audio.start();
  await audio.importMusic(audioFile('jungle.wav', 'valid-jungle'), 'jungle');
  const source = audio._musicSource;
  audio.ctx.currentTime = 3;
  await audio.importMusic(audioFile('corridor.wav', 'valid-base'), 'base');
  await audio.importMusic(audioFile('boss.wav', 'valid-baseBoss'), 'baseBoss');
  assert.equal(audio._musicSource, source);
  assert.equal(source.stopped, false);
  assert.equal(source.starts.length, 1);
  assert.equal(records.get('background').name, 'jungle.wav');
  assert.equal(records.get('base').name, 'corridor.wav');
  assert.equal(records.get('baseBoss').name, 'boss.wav');
  const restored = new GameAudio();
  await restored.ready;
  for (const [key, name, content] of [
    ['jungle', 'jungle.wav', 'valid-jungle'],
    ['base', 'corridor.wav', 'valid-base'],
    ['baseBoss', 'boss.wav', 'valid-baseBoss']
  ]) {
    const status = restored.getMusicStatus(key);
    assert.equal(status.key, key);
    assert.equal(status.name, name);
    assert.equal(status.ready, true);
    assert.equal(status.persisted, true);
    assert.equal(restored._musicSlots[key].buffer.content, content);
  }
  assert.equal(loops(restored).length, 0);
});

test('rapid stage changes keep one loop; repeated setTrack is idempotent', async () => {
  const {audio, events} = fixture();
  await audio.ready;
  for (const key of ['jungle', 'base', 'baseBoss']) await audio.importMusic(audioFile(key + '.wav', 'valid-' + key), key);
  audio.unlock(); audio.start();
  for (const key of ['base', 'baseBoss', 'jungle', 'baseBoss', 'base']) {
    const old = audio._musicSource;
    const status = audio.setTrack(key);
    assert.equal(old.stopped, true);
    assert.equal(status.currentTrack, key);
    assert.equal(audio._musicSource.buffer.content, 'valid-' + key);
    assert.equal(audio._musicSource.starts[0][1], 0);
    assert.equal(loops(audio).length, 1);
    const source = audio._musicSource;
    const eventCount = events.length;
    audio.ctx.currentTime += 1;
    for (let i = 0; i < 5; i++) audio.setTrack(key);
    assert.equal(audio._musicSource, source);
    assert.equal(source.starts.length, 1);
    assert.equal(source.stopped, false);
    assert.equal(events.length, eventCount);
  }
});

test('failed import and clearing a non-current slot do not affect other slots or current playback', async () => {
  const {audio, records} = fixture();
  await audio.ready;
  for (const key of ['jungle', 'base', 'baseBoss']) await audio.importMusic(audioFile(key + '.wav', 'valid-' + key), key);
  audio.unlock(); audio.start();
  const source = audio._musicSource;
  const baseBuffer = audio._musicSlots.base.buffer;
  await assert.rejects(audio.importMusic(audioFile('bad-base.wav', 'broken'), 'base'), /无法解码/);
  assert.equal(audio._musicSlots.base.buffer, baseBuffer);
  assert.match(audio.getMusicStatus('base').error, /无法解码/);
  assert.equal(audio.getMusicStatus('jungle').error, '');
  assert.equal(audio.getMusicStatus('baseBoss').error, '');
  assert.equal(audio._musicSource, source);
  await audio.clearImportedMusic('base');
  assert.equal(audio._musicSource, source);
  assert.equal(source.stopped, false);
  assert.equal(audio.getMusicStatus('base').source, 'none');
  assert.equal(audio.getMusicStatus('base').error, '');
  assert.equal(audio.getMusicStatus('baseBoss').name, 'baseBoss.wav');
  assert.equal(records.has('base'), false);
  assert.equal(records.has('background'), true);
  assert.equal(records.has('baseBoss'), true);
  await audio.clearImportedMusic('jungle');
  assert.equal(loops(audio).length, 0);
  assert.equal(audio.getMusicStatus('baseBoss').source, 'imported');
});

test('default import captures its slot before await and leaves a newly active slot playing', async () => {
  const {audio, pendingDecodes} = fixture();
  await audio.ready;
  await audio.importMusic(audioFile('base.wav', 'valid-base'), 'base');
  audio.unlock(); audio.start();
  const pending = audio.importMusic(audioFile('pending-jungle.wav', 'pending'));
  audio.setTrack('base');
  const baseSource = audio._musicSource;
  await tick();
  pendingDecodes[0].resolve();
  const result = await pending;
  assert.equal(result.key, 'jungle');
  assert.equal(result.currentTrack, 'base');
  assert.equal(audio.getMusicStatus('jungle').name, 'pending-jungle.wav');
  assert.equal(audio.getMusicStatus().name, 'base.wav');
  assert.equal(audio._musicSource, baseSource);
  assert.equal(baseSource.stopped, false);
});

test('concurrent imports and cancellation are independent per music slot', async () => {
  const {audio, records, pendingDecodes} = fixture();
  await audio.ready;
  const basePending = audio.importMusic(audioFile('pending-base.wav', 'pending'), 'base');
  await tick();
  const jungleImport = audio.importMusic(audioFile('jungle.wav', 'valid-jungle'), 'jungle');
  await audio.clearImportedMusic('base');
  pendingDecodes[0].resolve();
  await assert.rejects(basePending, /已取消/);
  await jungleImport;
  assert.equal(audio.getMusicStatus('jungle').source, 'imported');
  assert.equal(audio.getMusicStatus('base').source, 'none');
  assert.equal(records.get('background').name, 'jungle.wav');
  assert.equal(records.has('base'), false);
});

test('clear before ready cancels an earlier import and blocks the saved record from reappearing', async () => {
  const record = {blob: audioFile(), name: 'saved.wav'};
  const {audio, records} = fixture({savedRecord: record});
  const pending = audio.importMusic(audioFile('new.wav'));
  const cancelled = assert.rejects(pending, /已取消/);
  await audio.clearImportedMusic();
  await cancelled;
  assert.equal(audio.getMusicStatus().source, 'none');
  assert.equal(audio.getMusicStatus().importing, false);
  assert.equal(records.has('background'), false);
});

test('invalid import before ready preserves the legacy record; corrupt other-slot data stays isolated', async () => {
  const record = {blob: audioFile('legacy.wav', 'valid-legacy'), name: 'legacy.wav'};
  const {audio} = fixture({savedRecord: record, savedRecords: [
    ['base', {blob: audioFile('broken.wav', 'invalid'), name: 'broken.wav'}],
    ['baseBoss', {blob: audioFile('boss.wav', 'valid-boss'), name: 'boss.wav'}]
  ]});
  await assert.rejects(audio.importMusic(audioFile('invalid.wav', 'invalid')), /无法解码/);
  assert.equal(audio.getMusicStatus('jungle').name, 'legacy.wav');
  assert.equal(audio.getMusicStatus('base').source, 'none');
  assert.match(audio.getMusicStatus('base').error, /无法恢复/);
  assert.equal(audio.getMusicStatus('baseBoss').name, 'boss.wav');
  assert.equal(audio.getMusicStatus('baseBoss').error, '');
  assert.equal(audio.musicReady, true);
});

test('unknown slot keys are rejected without changing playback selection', async () => {
  const {audio} = fixture();
  await audio.ready;
  assert.throws(() => audio.setTrack('unknown'), /未知/);
  assert.throws(() => audio.getMusicStatus('unknown'), /未知/);
  await assert.rejects(audio.importMusic(audioFile(), 'unknown'), /未知/);
  await assert.rejects(audio.clearImportedMusic('unknown'), /未知/);
  assert.equal(audio.track, 'jungle');
});
