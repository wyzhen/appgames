const test = require('node:test');
const assert = require('node:assert/strict');
const { GameModel } = require('../web/engine.js');

const FRAME = 1 / 60;
function game() {
  const g = new GameModel().reset();
  // Isolate the mechanism under test from unrelated patrols and supply drops.
  g.enemies = [];
  g.capsules = [];
  g.pickups = [];
  g.player.invuln = 0;
  return g;
}
function advance(g, seconds, input = {}) {
  for (let t = 0; t < seconds - 1e-8; t += FRAME) {
    g.update(Math.min(FRAME, seconds - t), input);
  }
}
function enemyBullet(g, y, { x = g.player.x - 80, vx = 1200 } = {}) {
  g.bullets.push({ x, y, vx, vy: 0, enemy: true, type: 'orb', life: 2, damage: 1 });
}
function projectile(x, y, vx, vy, enemy = false, type = 'R') {
  return { x, y, vx, vy, enemy, type, life: 2, damage: type === 'L' ? 3 : 1, pierce: type === 'L' ? 3 : 0 };
}
function hitBoss(g, x, y, count = 1) {
  // Normal, one-damage projectiles exercise the full swept-collision path.
  for (let i = 0; i < count; i++) {
    g.bullets.push({ x: x - 80, y, vx: 1000, vy: 0, enemy: false,
      type: 'R', life: 1.2, damage: 1, pierce: 0 });
    advance(g, .1);
  }
}

test('running, a single jump and gravity return the player to solid ground', () => {
  const g = game();
  advance(g, 1, { x: 1 });
  assert.ok(Math.abs(g.player.x - 288) < .01);
  assert.equal(g.player.y, 430);
  g.update(FRAME, { jump: true });
  assert.equal(g.player.ground, false);
  assert.ok(g.player.vy < 0);
  const airborneY = g.player.y;
  advance(g, .2);
  assert.ok(g.player.y < airborneY, 'jump continues to rise after releasing jump');
  advance(g, .8);
  assert.equal(g.player.y, 430);
  assert.equal(g.player.vy, 0);
  assert.equal(g.player.ground, true);
});

test('thin ledges catch a falling player and down+jump drops through them', () => {
  const g = game();
  Object.assign(g.player, { x: 420, y: 250, vy: 0, ground: false, coyote: 0 });
  advance(g, .6);
  assert.equal(g.player.y, 342);
  assert.equal(g.player.ground, true);
  g.update(FRAME, { y: 1, jump: true });
  assert.ok(g.player.y > 342);
  advance(g, .6);
  assert.equal(g.player.y, 430);
  assert.equal(g.player.ground, true);
});

test('a jump from the ground reaches and lands on the first elevated ledge', () => {
  const g = game();
  Object.assign(g.player, { x: 420, y: 430, ground: true });
  g.update(FRAME, { jump: true });
  advance(g, .8);
  assert.equal(g.player.y, 342, 'the 88-pixel ledge is reachable from ground level');
  assert.equal(g.player.ground, true);
  assert.equal(g.player.vy, 0);
});

test('a raised solid-ground step blocks running and can be crossed with a jump', () => {
  const g = game();
  Object.assign(g.player, { x: 2410, y: 430, ground: true });
  g.cam = 2100;
  advance(g, .5, { x: 1 });
  assert.ok(g.player.x <= 2430.01, 'the character cannot walk through the vertical face');
  assert.equal(g.player.y, 430);
  assert.equal(g.player.ground, true);
  g.update(FRAME, { x: 1, jump: true });
  advance(g, .9, { x: 1 });
  assert.ok(g.player.x > 2440, 'jump clears the step rather than pinning the player to the wall');
  assert.equal(g.player.y, 390);
  assert.equal(g.player.ground, true);
});

test('a player in the river can jump out onto the higher riverbank', () => {
  const g = game();
  for (const platform of g.level.platforms) {
    if (platform.type === 'bridge') platform.broken = true;
  }
  Object.assign(g.player, { x: 1760, y: 478, ground: true, water: true });
  g.cam = 1450;
  advance(g, .5, { x: 1 });
  assert.ok(g.player.x <= 1780.01, 'the riverbank blocks swimming straight into solid earth');
  assert.equal(g.player.water, true);
  g.update(FRAME, { x: 1, jump: true });
  advance(g, .85, { x: 1 });
  assert.ok(g.player.x > 1790);
  assert.equal(g.player.y, 430, 'water jump clears the 48-pixel rise');
  assert.equal(g.player.water, false);
  assert.equal(g.player.ground, true);
});

test('airborne shooting covers all eight directions at equal bullet speed', () => {
  for (const [x, y] of [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]]) {
    const g = game();
    Object.assign(g.player, { y: 240, ground: false, coyote: 0 });
    g.update(FRAME, { x, y, fire: true });
    assert.equal(g.bullets.length, 1);
    const b = g.bullets[0];
    const magnitude = Math.hypot(x, y);
    assert.ok(Math.abs(b.vx / 650 - x / magnitude) < 1e-8, `wrong horizontal aim for (${x}, ${y})`);
    assert.ok(Math.abs(b.vy / 650 - y / magnitude) < 1e-8, `wrong vertical aim for (${x}, ${y})`);
    assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - 650) < 1e-8);
  }
});

test('prone avoids a head-height bullet, stops running, and still takes a body hit', () => {
  const standing = game();
  enemyBullet(standing, 400);
  advance(standing, .1);
  assert.equal(standing.lives, 2);

  const prone = game();
  const startX = prone.player.x;
  enemyBullet(prone, 400);
  advance(prone, .1, { x: 1, y: 1 });
  assert.equal(prone.player.prone, true);
  assert.equal(prone.player.x, startX);
  assert.equal(prone.lives, 3, 'head-height bullet clears the prone hurtbox');
  enemyBullet(prone, 422);
  advance(prone, .1, { y: 1 });
  assert.equal(prone.lives, 2, 'prone is not full invulnerability');
});

test('a bridge collapses after being stepped on and drops the player into swimmable water', () => {
  const g = game();
  Object.assign(g.player, { x: 1160, y: 430, ground: true });
  g.cam = 850;
  const bridge = g.level.platforms.find(p => p.type === 'bridge' && p.x <= 1160 && p.x + p.w >= 1160);
  g.update(FRAME);
  assert.ok(bridge.crumble > 0);
  assert.equal(bridge.broken, false);
  advance(g, 1.2);
  assert.equal(bridge.broken, true);
  assert.equal(g.player.y, 478);
  assert.equal(g.player.water, true);
  assert.equal(g.lives, 3);
  const x = g.player.x;
  advance(g, .3, { x: 1 });
  assert.ok(Math.abs(g.player.x - x - 33.6) < .1, 'swimming is slower than running');
  g.update(FRAME, { jump: true });
  assert.ok(g.player.vy < 0);
  assert.equal(g.player.water, false);
});

test('supply capsules release a collectible and spread pickup fires five projectiles', () => {
  const g = game();
  g.capsules = [{ x: 140, y: 390, baseY: 390, hp: 2, type: 'S', t: 0 }];
  g.update(FRAME, { fire: true });
  advance(g, .2);
  g.update(FRAME, { fire: true });
  advance(g, .2);
  assert.equal(g.capsules[0].hp, 0);
  assert.equal(g.pickups.length, 1);
  assert.equal(g.pickups[0].type, 'S');
  advance(g, .15, { x: 1 });
  assert.equal(g.player.weapon, 'S');
  assert.equal(g.pickups.length, 0);
  g.bullets = [];
  g.player.cooldown = 0;
  g.update(FRAME, { fire: true });
  assert.equal(g.bullets.length, 5);
  assert.equal(new Set(g.bullets.map(b => b.vy)).size, 5);
});

test('one enemy bullet costs one life, respawn resets weapons and grants temporary invulnerability', () => {
  const g = game();
  g.player.weapon = 'L';
  g.player.rapid = 20;
  // Travel across the entire player in one update to catch tunnelling regressions.
  enemyBullet(g, 405, { x: 0, vx: 5000 });
  g.update(.04);
  assert.equal(g.lives, 2);
  assert.equal(g.deaths, 1);
  assert.ok(g.player.dead > 0);
  enemyBullet(g, 405);
  advance(g, .2);
  assert.equal(g.lives, 2, 'already dead player cannot lose another life');
  advance(g, 1);
  assert.equal(g.player.dead, 0);
  assert.equal(g.player.weapon, 'R');
  assert.equal(g.player.rapid, 0);
  assert.ok(g.player.invuln > 0);
  enemyBullet(g, 405);
  advance(g, .1);
  assert.equal(g.lives, 2);
  advance(g, 3);
  enemyBullet(g, 405);
  advance(g, .1);
  assert.equal(g.lives, 1, 'invulnerability expires');
});

test('crossing bullets are intercepted between frames regardless of array ordering', () => {
  for (const reverse of [false, true]) {
    const g = game();
    g.bullets = [projectile(200, 250, 3000, 0), projectile(300, 250, -3000, 0, true, 'orb')];
    if (reverse) g.bullets.reverse();
    g.update(.04);
    assert.equal(g.bullets.length, 0, 'paths cross even though their endpoints are far apart');
  }
});

test('a real rifle shot intercepts an incoming bullet before it can harm the player', () => {
  const g = game();
  // The hostile bullet is deliberately first in the array and would cross the player.
  enemyBullet(g, 403, { x: 180, vx: -3000 });
  g.update(.04, { fire: true });
  assert.equal(g.lives, 3);
  assert.equal(g.deaths, 0);
  assert.equal(g.bullets.length, 0);
});

test('paths crossing at different times do not cancel unrelated bullets', () => {
  const g = game();
  g.bullets = [projectile(200, 200, 2500, 0), projectile(250, 150, 0, 5000, true, 'orb')];
  g.update(.04);
  assert.equal(g.bullets.length, 2, 'use relative movement, not intersection of spatial line segments');
});

test('ordinary shots stop at the nearest interception while lasers clear multiple bullets and hit enemies', () => {
  for (const laser of [false, true]) {
    const g = game();
    const near = projectile(250, 250, 0, 0, true, 'orb');
    const far = projectile(290, 250, 0, 0, true, 'orb');
    const shot = projectile(200, 250, 3000, 0, false, laser ? 'L' : 'R');
    g.bullets = [far, near, shot];
    const target = { x: 325, y: 270, w: 22, h: 40, hp: 10, type: 'rifle', flash: 0,
      cooldown: 99, anim: 0, dead: false };
    g.enemies = [target];
    g.update(.04);
    assert.equal(near.life, 0);
    if (laser) {
      assert.equal(far.life, 0);
      assert.equal(target.hp, 7);
      assert.ok(shot.life > 0);
    } else {
      assert.ok(far.life > 0);
      assert.equal(shot.life, 0);
      assert.equal(target.hp, 10);
    }
  }
});

test('shooting down a grenade on its explosion frame prevents fragments and damage', () => {
  for (const fuse of [null, .06, .01]) {
    const g = game();
    const grenade = projectile(180, fuse === null ? 429 : 427, 0, 50, true, 'grenade');
    grenade.life = fuse === null ? 1 : fuse;
    g.bullets = [grenade, projectile(140, 428, 1000, 0)];
    g.update(.04);
    assert.equal(g.bullets.length, 0, 'an intercepted grenade cannot explode later in the same frame');
    assert.equal(g.lives, 3);
  }
  const exploding = game();
  exploding.bullets = [projectile(180, 429, 0, 50, true, 'grenade')];
  exploding.update(.04);
  assert.equal(exploding.bullets.length, 3, 'an unblocked grenade creates three slow fragments');
  const expired = game();
  const grenade = projectile(180, 300, 0, 0, true, 'grenade');
  grenade.life = .01;
  expired.bullets = [grenade];
  expired.update(.04);
  assert.equal(expired.bullets.length, 3, 'a fuse expiring between frames detonates rather than disappearing');
});

test('normal enemies share a fire throttle, longer per-enemy intervals and a global bullet cap', () => {
  const g = game();
  g.player.invuln = 99;
  g.enemies = Array.from({ length: 8 }, (_, i) => ({ x: 300 + i * 20, y: 430,
    w: 22, h: 40, hp: 1, type: 'rifle', flash: 0, cooldown: 0, anim: 0, dead: false }));
  const fire = g.enemyFire.bind(g), fired = [];
  g.enemyFire = (e, grenade) => {
    const success = fire(e, grenade);
    if (success) fired.push({ time: g.time, enemy: e });
    return success;
  };
  g.update(FRAME);
  assert.equal(g.enemyBulletCount(), 1, 'only one of eight ready enemies shoots on the same frame');
  for (let i = 0; i < 1200; i++) {
    g.update(FRAME);
    assert.ok(g.enemyBulletCount() <= g.enemyBulletLimit);
  }
  assert.ok(fired.length >= 8);
  const last = new Map();
  for (let i = 0; i < fired.length; i++) {
    const shot = fired[i];
    if (i) assert.ok(shot.time - fired[i - 1].time >= .39, 'global spacing prevents simultaneous salvos');
    if (last.has(shot.enemy)) assert.ok(shot.time - last.get(shot.enemy) >= 3.79);
    last.set(shot.enemy, shot.time);
  }
  const crowded = game();
  crowded.bullets = Array.from({ length: 4 }, () => projectile(300, 250, 0, 0, true, 'orb'));
  crowded.bullets.push(projectile(180, 429, 0, 50, true, 'grenade'));
  crowded.update(.04);
  assert.equal(crowded.enemyBulletCount(), crowded.enemyBulletLimit, 'grenade fragments also respect the cap');
});

test('boss has a visible, directly vulnerable low core and optional destructible cannons', () => {
  const g = game();
  Object.assign(g.player, { x: 7900, y: 430 });
  g.cam = 7590;
  g.update(FRAME);
  assert.equal(g.boss.active, true);
  assert.equal(g.checkpoint, 7740);
  advance(g, 2, { x: 1 });
  assert.equal(g.player.x, g.boss.wallX - 10, 'collision uses the same wall edge as the renderer');
  assert.equal(g.boss.coreOpen, true);
  assert.deepEqual(g.boss.core, { x: 8260, y: 398, w: 76, h: 52 });
  assert.equal(g.boss.hp, 32);
  assert.equal(g.boss.maxHp, 32);
  g.update(FRAME, { fire: true });
  advance(g, .3);
  assert.equal(g.boss.hp, 31, 'standing horizontal fire hits the red core with both cannons intact');
  assert.ok(g.boss.turrets.every(t => t.hp === 8 && t.maxHp === 8));
  const cannon = g.boss.turrets[0];
  hitBoss(g, cannon.x, cannon.y, 8);
  assert.equal(cannon.hp, 0);
  assert.equal(g.boss.turrets[1].hp, 8);
  assert.equal(g.boss.coreOpen, true, 'cannon destruction is optional and never gates core damage');
});

test('boss opens with three safe seconds then telegraphs alternating single slow shots without patrols', () => {
  const g = game();
  Object.assign(g.player, { x: 7900, y: 430 });
  g.cam = 7590;
  g.enemies = [{ x: 7910, y: 430, hp: 1, w: 22, h: 40, type: 'runner', cooldown: 0 }];
  enemyBullet(g, 403, { x: 7950, vx: -1000 });
  const seen = new WeakSet(), fired = [];
  let maxCharge = 0;
  for (let i = 0; i < 600; i++) {
    g.update(FRAME, { y: 1 });
    assert.equal(g.enemies.length, 0, 'boss activation removes patrols before they attack');
    assert.ok(g.enemyBulletCount() <= 3);
    maxCharge = Math.max(maxCharge, ...g.boss.turrets.map(t => t.charge));
    for (const bullet of g.bullets) if (bullet.enemy && !seen.has(bullet)) {
      seen.add(bullet);
      assert.equal(bullet.boss, true);
      assert.equal(bullet.destructible, true);
      fired.push({ time: g.time, x: bullet.x - bullet.vx * FRAME, speed: Math.hypot(bullet.vx, bullet.vy) });
    }
    if (g.time < 3 - 1e-6) assert.equal(fired.length, 0);
  }
  assert.ok(maxCharge > .9, 'the next firing cannon visibly charges before its shot');
  assert.ok(fired.length >= 5);
  assert.ok(fired[0].time >= 3 - 1e-6);
  fired.forEach((shot, i) => {
    assert.ok(Math.abs(shot.x - g.boss.turrets[i % 2].x) < 1e-6);
    assert.ok(shot.speed >= 120 && shot.speed <= 130);
    if (i) assert.ok(Math.abs(shot.time - fired[i - 1].time - 1.3) < FRAME + 1e-6);
  });
  assert.equal(g.deaths, 0, 'the player can duck aimed shots without invulnerability');
});

test('standing rifle fire and brief ducks can clear the boss without invulnerability or jumping', () => {
  const g = game();
  Object.assign(g.player, { x: 7900, y: 430 });
  g.cam = 7590;
  let ducked = false;
  for (let i = 0; g.boss.hp > 0 && i < 1200; i++) {
    const danger = g.bullets.some(b => b.enemy && b.x > g.player.x - 25 && b.x < g.player.x + 75 && b.y > 370);
    if (danger) ducked = true;
    g.update(FRAME, { y: danger ? 1 : 0, fire: !danger });
    assert.equal(g.player.invuln, 0);
    assert.equal(g.player.y, 430, 'core never requires a jump');
    assert.equal(g.deaths, 0);
  }
  assert.equal(ducked, true);
  assert.equal(g.boss.hp, 0);
  assert.ok(g.boss.turrets.every(t => t.hp === 8), 'both optional cannons can remain intact at victory');
  assert.ok(g.bossDefeat > 0);
  advance(g, 3);
  assert.equal(g.state, 'victory');
  assert.ok(g.score >= 5000);
});

test('last-life game over can continue from the saved checkpoint with a fresh loadout', () => {
  const g = game();
  Object.assign(g.player, { x: 6480, y: 390, weapon: 'S' });
  g.cam = 6170;
  g.update(FRAME);
  assert.equal(g.checkpoint, 6300);
  g.lives = 1;
  g.score = 3500;
  assert.equal(g.damage(), true);
  advance(g, 1);
  assert.equal(g.state, 'gameover');
  assert.equal(g.lives, 0);
  g.continueGame();
  assert.equal(g.state, 'playing');
  assert.equal(g.lives, 3);
  assert.equal(g.score, 1500);
  assert.equal(g.player.x, 6300);
  assert.equal(g.player.weapon, 'R');
  assert.ok(g.player.invuln > 0);
  advance(g, .8);
  assert.equal(g.player.y, 430);
  assert.equal(g.player.ground, true);
});
