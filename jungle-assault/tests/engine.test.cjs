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

test('boss core resists fire until both cannons fall, opens in cycles and completes the stage', () => {
  const g = game();
  Object.assign(g.player, { x: 7900, y: 430, invuln: 999 });
  g.cam = 7590;
  g.update(FRAME);
  assert.equal(g.boss.active, true);
  assert.equal(g.checkpoint, 7740);
  advance(g, 2, { x: 1 });
  assert.equal(g.player.x, g.boss.x - 130, 'intact fortress wall blocks running past the boss');
  hitBoss(g, g.boss.x, 337);
  assert.equal(g.boss.hp, 60, 'armoured core rejects early shots');
  for (const cannon of g.boss.turrets) hitBoss(g, cannon.x, cannon.y, 14);
  g.update(FRAME);
  assert.ok(g.boss.turrets.every(t => t.hp <= 0));
  assert.equal(g.boss.phase, 1);
  for (let i = 0; !g.boss.coreOpen && i < 240; i++) g.update(FRAME);
  assert.equal(g.boss.coreOpen, true);
  const initialHp = g.boss.hp;
  hitBoss(g, g.boss.x, 337);
  assert.equal(g.boss.hp, initialHp - 1);
  for (let i = 0; g.boss.coreOpen && i < 240; i++) g.update(FRAME);
  assert.equal(g.boss.coreOpen, false, 'core closes again during the attack cycle');
  const closedHp = g.boss.hp;
  hitBoss(g, g.boss.x, 337);
  assert.equal(g.boss.hp, closedHp);
  for (let i = 0; g.boss.hp > 0 && i < 1200; i++) {
    if (g.boss.coreOpen) hitBoss(g, g.boss.x, 337);
    else g.update(FRAME);
  }
  assert.equal(g.boss.hp, 0);
  assert.ok(g.bossDefeat > 0);
  advance(g, 3);
  assert.equal(g.state, 'victory');
  assert.ok(g.score >= 8000);
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
