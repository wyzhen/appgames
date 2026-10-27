const {chromium} = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../web');
const dist = fs.mkdtempSync(require('os').tmpdir() + '/jungle-bundled-smoke-');

// Locally generated fixture: the tests do not bundle a third-party recording.
function sampleWav() {
  const rate = 8000, samples = 8000, b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) b.writeInt16LE(Math.round(Math.sin(i / rate * Math.PI * 2 * 220) * 1000), 44 + i * 2);
  return b;
}

(async () => {
  const bytes = sampleWav();
  const bundled = Object.fromEntries(['jungle','base','baseBoss'].map(key=>[key,{name:'Fixture '+key,mimeType:'audio/wav',base64:bytes.toString('base64'),sha256:require('crypto').createHash('sha256').update(bytes).digest('hex')}]));
  const server = http.createServer((q, r) => {
    if(q.url==='/bundled-music.js'){r.setHeader('Content-Type','application/javascript');r.end('window.BUNDLED_SOUNDTRACK='+JSON.stringify(bundled)+';');return;}
    const file = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
    fs.readFile(file, (error, data) => {
      if (error) { r.writeHead(404); r.end(); return; }
      r.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      r.end(data);
    });
  });
  await new Promise(resolve => server.listen(8765, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-crash-reporter', '--disable-breakpad']
    });
    const p = await browser.newPage({viewport: {width: 1280, height: 720}, hasTouch: true, isMobile: true});
    const errors = [];
    p.on('pageerror', error => errors.push(error.message));
    // Instrument only this test page, keeping production free of debug globals.
    await p.addInitScript(() => {
      let AudioClass;
      Object.defineProperty(window, 'GameAudio', {
        configurable: true,
        get() { return AudioClass; },
        set(Base) {
          AudioClass = class extends Base {
            constructor(...args) { super(...args); window.__smokeAudio = this; }
          };
        }
      });
    });
    const waitMusic = text => p.waitForFunction(expected => document.querySelector('#music-current-name')?.textContent.includes(expected), text);
    const snapshot = name => p.screenshot({path: path.join(dist, name)});
    const musicTrack = () => p.evaluate(() => __smokeAudio.getMusicStatus().currentTrack);
    await p.goto('http://127.0.0.1:8765');
    await p.waitForFunction(() => window.game && game.state === 'menu');
    await p.click('#help');
    assert.match(await p.locator('#dialog-card').innerText(), /八向方向盘/);
    await p.click('[data-action="helpClose"]');

    await p.evaluate(() => gameAudio.ready);
    assert.equal(await p.locator('#music-file').count(),0,'there is no manual import flow');
    await p.click('#music-settings');
    await waitMusic('Fixture jungle');
    assert.match(await p.locator('#dialog-card').innerText(),/内置配乐/);
    for(const key of ['base','baseBoss','jungle']){
      await p.click('[data-music-track="'+key+'"]');
      await waitMusic('Fixture '+key);
    }
    await snapshot('music.png');
    await p.click('[data-action="musicToggle"]');
    assert.equal(await p.evaluate(()=>gameAudio.muted),true);
    await p.click('[data-action="musicToggle"]');
    assert.equal(await p.evaluate(()=>gameAudio.muted),false);
    await p.click('[data-action="musicClose"]');
    await p.reload();
    await p.evaluate(()=>gameAudio.ready);
    assert.equal(await p.evaluate(()=>gameAudio.getMusicStatus().source),'bundled');
    await snapshot('title.png');

    await p.click('#start');
    await p.waitForFunction(() => game.state === 'playing');
    assert.equal(await p.evaluate(() => game.levelNumber), 1);
    assert.equal(await musicTrack(), 'jungle');
    assert.equal(await p.evaluate(() => __smokeAudio.getMusicStatus().source), 'bundled');
    assert.equal(await p.evaluate(()=>gameAudio._musicSource?.loop),true,'fresh install starts music after Start without importing');

    const points = await p.evaluate(() => ['dpad', 'fire', 'jump'].map((id, i) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return {x: r.x + r.width / 2 + (i === 0 ? r.width * .35 : 0), y: r.y + r.height / 2, id: i + 1};
    }));
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points});
    await p.waitForTimeout(210);
    const moved = await p.evaluate(() => ({x: game.player.x, y: game.player.y, shots: game.shots}));
    assert.ok(moved.x > 115 && moved.y < 420 && moved.shots >= 2, JSON.stringify(moved));
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: points.slice(0, 2)});
    await p.waitForTimeout(100);
    assert.ok(await p.evaluate(() => game.shots) >= moved.shots);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await p.waitForTimeout(100);
    const stillX = await p.evaluate(() => game.player.x);
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => game.player.x), stillX);
    await snapshot('gameplay.png');

    await p.click('#pause');
    assert.equal(await p.evaluate(() => game.state), 'paused');
    const pausedTime = await p.evaluate(() => game.time);
    await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => game.time), pausedTime);
    await p.click('[data-action="resume"]');
    await p.evaluate(() => gameLifecycle(false));
    assert.equal(await p.evaluate(() => game.state), 'paused');
    await p.evaluate(() => gameLifecycle(true));
    assert.equal(await p.evaluate(() => game.state), 'paused');
    await p.click('[data-action="resume"]');
    await p.setViewportSize({width: 1920, height: 864});
    await p.waitForFunction(() => document.querySelector('#rotate').hidden && innerWidth === 1920);
    assert.equal(await p.locator('#rotate').isVisible(), false);
    const box = await p.locator('#viewport').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 1920.1);
    await p.setViewportSize({width: 412, height: 915});
    await p.waitForFunction(() => !document.querySelector('#rotate').hidden);
    assert.equal(await p.locator('#rotate').isVisible(), true);
    await p.setViewportSize({width: 1280, height: 720});
    await p.waitForFunction(() => document.querySelector('#rotate').hidden && innerWidth === 1280);

    await p.evaluate(() => { game.player.x = 7900; game.player.y = 430; game.player.invuln = 999; game.cam = 7590; game.player.weapon = 'S'; });
    await p.waitForTimeout(150);
    await snapshot('boss.png');
    const bossHP = await p.evaluate(() => game.boss.hp);
    await p.keyboard.down('KeyJ');
    await p.waitForTimeout(750);
    await p.keyboard.up('KeyJ');
    assert.ok(await p.evaluate(() => game.boss.hp) < bossHP, 'standing horizontal fire reaches first-stage weakpoint');
    await p.evaluate(() => { game.lives = 2; game.score = 5400; game.player.weapon = 'M'; game.boss.turrets.forEach(t => t.hp = 0); game.boss.hp = 0; game.bossDefeat = .05; });
    await p.waitForFunction(() => game.state === 'stageclear');
    const carry = await p.evaluate(() => ({lives: game.lives, score: game.score, weapon: game.player.weapon, elapsed: game.elapsed}));
    await p.click('[data-action="nextLevel"]');
    await p.waitForFunction(() => game.levelNumber === 2 && game.state === 'playing');
    assert.deepEqual(await p.evaluate(() => ({lives: game.lives, score: game.score, weapon: game.player.weapon})), {lives: carry.lives, score: carry.score, weapon: carry.weapon});
    assert.ok(await p.evaluate(() => game.elapsed) >= carry.elapsed);
    await p.waitForFunction(() => __smokeAudio.getMusicStatus().currentTrack === 'base');
    assert.equal(await p.evaluate(() => __smokeAudio.getMusicStatus().name), 'Fixture base');
    await p.waitForFunction(() => document.querySelector('#sector').textContent.startsWith('02'));
    assert.match(await p.locator('#sector').innerText(), /02|第二关|基地/);
    await p.evaluate(() => { game.player.invuln = 0; });
    await p.waitForTimeout(50);
    await snapshot('base.png');

    const beforeShock = await p.evaluate(() => game.lives);
    await p.keyboard.down('ArrowUp');
    await p.waitForTimeout(150);
    await p.keyboard.up('ArrowUp');
    assert.ok(await p.evaluate(() => game.stun) > 0, 'up into a powered barrier briefly immobilizes the player');
    assert.equal(await p.evaluate(() => game.lives), beforeShock, 'electric barrier itself is not lethal');
    await p.waitForFunction(() => game.stun <= 0);

    // The room is reached through normal campaign UI. Guard immunity and target
    // HP are shortened so this integration test is deterministic and fast.
    await p.evaluate(() => { game.player.invuln = 999; game.targets.filter(t => t.type === 'core').forEach(t => t.hp = 1); });
    await p.keyboard.down('KeyJ');
    await p.waitForFunction(() => !game.barrierActive, null, {timeout: 6000});
    await p.keyboard.up('KeyJ');
    await p.keyboard.down('ArrowUp');
    await p.waitForFunction(() => game.roomIndex === 1, null, {timeout: 3000});
    await p.keyboard.up('ArrowUp');
    assert.equal(await p.evaluate(() => game.barrierActive), true);
    await p.evaluate(() => { game.lives = 1; game.player.invuln = 0; game.damage(); game.player.dead = .02; });
    await p.waitForFunction(() => game.state === 'gameover');
    await p.click('[data-action="continue"]');
    assert.equal(await p.evaluate(() => game.roomIndex), 1, 'continue retains the current base room');
    assert.equal(await p.evaluate(() => game.lives), 3);

    // Traverse all remaining room boundaries through real shooting and the up
    // control. The separate model tests cover their normal target HP/difficulty.
    for (let room = 1; room < 5; room++) {
      assert.equal(await p.evaluate(() => game.roomIndex), room);
      await p.waitForFunction(() => game.stun <= 0);
      const cores = await p.evaluate(() => {
        game.player.invuln = 999;
        game.targets.filter(t => t.type === 'core').forEach(t => t.hp = 1);
        return game.targets.filter(t => t.type === 'core').map(t => ({id: t.id, x: t.x}));
      });
      for (const core of cores) {
        await p.evaluate(x => { game.player.x = x; }, core.x);
        await p.keyboard.down('KeyJ');
        await p.waitForFunction(id => game.targets.find(t => t.id === id)?.hp === 0, core.id, {timeout: 6000});
        await p.keyboard.up('KeyJ');
      }
      await p.waitForFunction(() => !game.barrierActive);
      await p.keyboard.down('ArrowUp');
      await p.waitForFunction(expected => game.roomIndex === expected, room + 1, {timeout: 3000});
      await p.keyboard.up('ArrowUp');
    }
    await p.waitForFunction(() => __smokeAudio.getMusicStatus().currentTrack === 'baseBoss');
    assert.equal(await p.evaluate(() => __smokeAudio.getMusicStatus().name), 'Fixture baseBoss');
    assert.equal(await p.evaluate(() => game.boss.phase), 1);
    await p.locator('#bossbar').waitFor({state: 'visible'});
    assert.equal(await p.locator('#bossbar').isVisible(), true);
    await p.evaluate(() => { game.targets.forEach(t => t.hp = 0); });
    await p.waitForFunction(() => game.boss.phase === 2);
    await p.evaluate(() => { game.player.invuln = 0; });
    await p.waitForTimeout(50);
    await snapshot('base-boss.png');
    await p.evaluate(() => { game.player.invuln = 999; const t = game.targets.find(t => t.hp > 0); game.player.x = t ? t.x : game.boss.x; });
    const secondBossHP = await p.evaluate(() => game.boss.hp);
    await p.keyboard.down('KeyJ');
    await p.waitForFunction(hp => game.boss.hp < hp, secondBossHP, {timeout: 5000});
    await p.keyboard.up('KeyJ');
    await p.evaluate(() => { game.boss.hp = 1; game.targets.filter(t => t.hp > 0).forEach(t => t.hp = 1); });
    await p.keyboard.down('KeyJ');
    await p.waitForFunction(() => game.state === 'victory', null, {timeout: 6000});
    await p.keyboard.up('KeyJ');
    assert.match(await p.locator('#dialog-card').innerText(), /完成|通关|机核/);
    await snapshot('victory.png');

    await p.click('[data-action="menu"]');
    await p.click('[data-level="2"]');
    await p.click('#start');
    await p.waitForFunction(() => game.levelNumber === 2 && game.state === 'playing');
    assert.equal(await p.evaluate(() => game.roomIndex), 0);
    assert.equal(await p.evaluate(() => game.score), 0, 'direct stage selection starts a fresh run');
    assert.equal(await p.evaluate(() => game.lives), 3);
    await p.click('#pause');
    await p.click('[data-action="music"]');
    await waitMusic('Fixture base');
    assert.equal(await p.locator('[data-action="musicChoose"]').count(),0);
    assert.equal(await p.locator('[data-action="musicClear"]').count(),0);
    await p.click('[data-music-track="baseBoss"]');
    await waitMusic('Fixture baseBoss');
    await p.click('[data-action="musicClose"]');
    await p.click('[data-action="resume"]');
    assert.deepEqual(errors, []);
    console.log('Test-only fixture screenshots: '+dist);
    console.log('PASS: menus/help; real packaged WAV decoding, fresh-install automatic playback without import controls; multi-touch/release; pause/native lifecycle; screen ratios; first-stage boss damage; stage-clear carry into Base; nonlethal electric stun; real door shooting and up-control traversal of all five Base rooms; room continue; two-phase Base boss; automatic corridor/boss music; final victory; direct stage selection; no JavaScript errors.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
