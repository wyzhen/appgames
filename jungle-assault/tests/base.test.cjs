const test = require('node:test');
const assert = require('node:assert/strict');
const { BaseLevelModel } = require('../web/base-engine.js');

const FRAME = 1 / 60;
function game(carry = {}) {
  return new BaseLevelModel(() => {}, carry);
}
function advance(g, seconds, input = {}) {
  for (let t = 0; t < seconds - 1e-8; t += FRAME) {
    g.update(Math.min(FRAME, seconds - t), input);
  }
}
function bullet(x, y, vx, vy, kind = 'high', type = 'orb') {
  return { x, y, vx, vy, kind, type, enemy: true, life: 3,
    damage: 1, pierce: 0, depth: .9 };
}
function shootTarget(g, target, { protectedPlayer = true } = {}) {
  if (protectedPlayer) g.player.invuln = 999;
  g.player.x = target.x;
  for (let i = 0; target.hp > 0 && i < 2400; i++) {
    g.update(FRAME, { fire: true, y: 1 });
  }
  assert.ok(target.hp <= 0, `${target.type} ${target.id} can be destroyed by real player fire`);
}
function clearCores(g) {
  for (const target of g.targets.filter(t => t.type === 'core')) shootTarget(g, target);
}

test('level two preserves the first-level loadout and campaign counters', () => {
  const carry = { mode: 'practice', lives: 5, score: 12340, weapon: 'S', rapid: 11,
    elapsed: 91, kills: 28, deaths: 2, best: 20000 };
  const g = game(carry);
  assert.equal(g.levelNumber, 2);
  assert.equal(g.roomIndex, 0);
  assert.equal(g.roomCount, 5);
  assert.equal(g.baseMode, 'corridor');
  assert.equal(g.mode, carry.mode);
  for (const key of ['lives', 'score', 'elapsed', 'kills', 'deaths', 'best']) {
    assert.equal(g[key], carry[key], `carry ${key}`);
  }
  assert.equal(g.player.weapon, 'S');
  assert.equal(g.player.rapid, 11);
});

test('walking into the live electric barrier causes a recoverable stun rather than death', () => {
  const g = game();
  g.player.invuln = 0;
  const lives = g.lives;
  const room = g.roomIndex;
  advance(g, .15, { y: -1 });
  assert.equal(g.barrierActive, true);
  assert.ok(g.stun > 0);
  assert.equal(g.lives, lives);
  assert.equal(g.deaths, 0);
  assert.equal(g.player.dead, 0);
  assert.equal(g.roomIndex, room);
  advance(g, 1);
  assert.equal(g.stun, 0);
  const x = g.player.x;
  advance(g, .15, { x: 1 });
  assert.ok(g.player.x > x, 'the character can move again when the stun expires');
});

test('all room cores must be shot, while surviving cannons do not keep the barrier powered', () => {
  const g = game();
  g.loadRoom(4);
  const cores = g.targets.filter(t => t.type === 'core');
  const turrets = g.targets.filter(t => t.type === 'turret');
  assert.ok(cores.length > 1, 'fixture room has several independent electrical cores');
  assert.ok(turrets.length > 0);
  for (const core of cores.slice(0, -1)) shootTarget(g, core);
  assert.equal(g.barrierActive, true, 'one remaining core keeps the barrier live');
  assert.equal(g.phase, 'combat');
  shootTarget(g, cores.at(-1));
  g.update(FRAME);
  assert.equal(g.barrierActive, false);
  assert.equal(g.phase, 'advance');
  assert.ok(turrets.some(t => t.hp > 0), 'the room can be cleared without dismantling every gun');
});

test('a cleared corridor advances one room after a sustained upward input', () => {
  const g = game();
  clearCores(g);
  const previous = g.roomIndex;
  advance(g, .5, { y: -1 });
  assert.equal(g.roomIndex, previous, 'a short press does not skip the room');
  advance(g, .55, { y: -1 });
  assert.equal(g.roomIndex, previous + 1);
  assert.equal(g.phase, 'combat');
  assert.equal(g.barrierActive, true);
  assert.ok(g.targets.some(t => t.type === 'core' && t.hp > 0));
});

test('high bullets hit a standing player but pass safely over a crouching player', () => {
  for (const prone of [false, true]) {
    const g = game();
    g.player.invuln = 0;
    const lives = g.lives;
    g.bullets.push(bullet(g.player.x, 380, 0, 800));
    advance(g, .1, prone ? { y: 1 } : {});
    assert.equal(g.lives, lives - (prone ? 0 : 1), prone ? 'crouching avoids high fire' : 'standing is vulnerable');
  }
});

test('crouching does not avoid a rolling mine, but an actual jump does', () => {
  const crouching = game();
  crouching.player.invuln = 0;
  crouching.bullets.push(bullet(crouching.player.x, 430, 0, 0, 'mine', 'mine'));
  crouching.update(FRAME, { y: 1 });
  assert.equal(crouching.lives, 2);

  const jumping = game();
  jumping.player.invuln = 0;
  jumping.update(FRAME, { jump: true });
  advance(jumping, .12);
  assert.ok(jumping.player.jumpHeight >= 24);
  jumping.bullets.push(bullet(jumping.player.x, 430, 0, 0, 'mine', 'mine'));
  jumping.update(FRAME);
  assert.equal(jumping.lives, 3);
  assert.equal(jumping.player.dead, 0);
});

test('real upward fire intercepts moving hostile bullets before they can hurt the player', () => {
  const g = game();
  g.player.invuln = 0;
  g.bullets.push(bullet(g.player.x, 370, 0, 800));
  g.update(.04, { fire: true });
  assert.equal(g.lives, 3);
  assert.equal(g.bullets.filter(b => b.enemy).length, 0);
  assert.equal(g.bullets.filter(b => !b.enemy).length, 0, 'an ordinary shot is consumed by its interception');
});

test('laser fire can pierce through more than one moving hostile bullet in one frame', () => {
  const g = game({ weapon: 'L' });
  g.player.invuln = 0;
  g.bullets.push(bullet(g.player.x, 380, 0, 800), bullet(g.player.x, 350, 0, 800));
  g.update(.04, { fire: true });
  assert.equal(g.lives, 3);
  assert.equal(g.bullets.filter(b => b.enemy).length, 0);
  assert.ok(g.bullets.some(b => !b.enemy && b.type === 'L' && b.life > 0));
});

test('even a batch attack cannot exceed four active hostile projectiles', () => {
  const g = game();
  const results = Array.from({ length: 8 }, (_, i) =>
    g.spawnHostile({ x: 300 + i * 40, y: 200 }, 'high', { batch: true }));
  assert.equal(results.filter(Boolean).length, 4);
  assert.equal(g.bullets.filter(b => b.enemy).length, 4);
});

test('death and continue preserve the current corridor while resetting the weapon', () => {
  const g = game({ score: 4700, weapon: 'S', rapid: 8 });
  g.loadRoom(3);
  g.player.invuln = 0;
  g.bullets.push(bullet(g.player.x, 400, 0, 800));
  advance(g, 1.2);
  assert.equal(g.roomIndex, 3);
  assert.equal(g.player.weapon, 'R');
  assert.equal(g.player.rapid, 0);
  assert.equal(g.player.dead, 0);
  assert.ok(g.player.invuln > 0);
  g.lives = 1;
  g.player.invuln = 0;
  g.bullets.push(bullet(g.player.x, 400, 0, 800));
  advance(g, 1.2);
  assert.equal(g.state, 'gameover');
  const score = g.score;
  g.continueGame();
  assert.equal(g.state, 'playing');
  assert.equal(g.roomIndex, 3);
  assert.equal(g.lives, 3);
  assert.equal(g.score, Math.max(0, score - 2000));
  assert.equal(g.player.weapon, 'R');
});

test('a red supply soldier can be shot and its homing weapon drop can be collected', () => {
  const g = game();
  g.player.invuln = 999;
  g.enemies = [];
  advance(g, 1.45);
  const supply = g.enemies.find(e => e.type === 'supply');
  assert.ok(supply, 'a red supply soldier actually enters the corridor');
  for (let i = 0; supply.hp > 0 && i < 240; i++) {
    g.player.x = supply.x;
    g.update(FRAME, { fire: true });
  }
  assert.equal(supply.hp, 0);
  assert.ok(!g.enemies.includes(supply));
  assert.ok(g.pickups.some(p => ['M', 'S', 'R'].includes(p.type)), 'supply soldier drops a supported upgrade');
  const drop = g.pickups[0];
  const type = drop.type;
  advance(g, 3, { y: 1 });
  assert.equal(g.pickups.length, 0, 'the drop approaches and is picked up by the player');
  if (type === 'R') assert.ok(g.player.rapid > 0);
  else assert.equal(g.player.weapon, type);
});

test('five rooms and both boss phases can be completed entirely with real fire', (context) => {
  const g = game({ mode: 'practice', lives: 8 });
  // An input-only bot uses crouching for high shots and jumps over approaching mines.
  // No target health, projectile or invulnerability state is modified in this run.
  const bot = (target) => {
    const delta = target ? target.x - g.player.x : 0;
    const mine = g.bullets.some(b => b.enemy && (b.kind === 'mine' || b.type === 'mine') && b.y > 325);
    const advancing = g.phase === 'advance' || g.phase === 'transition';
    g.update(FRAME, {
      x: Math.abs(delta) > 3 ? Math.sign(delta) : 0,
      y: advancing ? -1 : Math.abs(delta) > 3 ? 0 : 1,
      fire: Boolean(target),
      jump: mine && g.player.jumpHeight < 1,
    });
    assert.ok(g.bullets.filter(b => b.enemy).length <= 4);
    assert.notEqual(g.state, 'gameover', 'the input-only script survives without continuing');
  };
  for (let room = 0; room < 5; room++) {
    assert.equal(g.roomIndex, room);
    for (let i = 0; g.phase === 'combat' && i < 12000; i++) {
      bot(g.targets.find(t => t.type === 'core' && t.hp > 0));
    }
    assert.equal(g.phase, 'advance', `room ${room + 1} clears using its cores`);
    for (let i = 0; g.roomIndex === room && i < 180; i++) bot();
    assert.equal(g.roomIndex, room + 1);
  }
  assert.equal(g.baseMode, 'boss');
  assert.equal(g.targets.filter(t => t.type === 'core').length, 4);
  assert.equal(g.targets.filter(t => t.type === 'turret').length, 2);
  assert.ok(g.targets.filter(t => t.type === 'core').every(t => t.maxHp === 4));
  assert.ok(g.targets.filter(t => t.type === 'turret').every(t => t.maxHp === 6));
  const firstPhaseTargets = [...g.targets];
  for (let i = 0; g.targets.some(t => firstPhaseTargets.includes(t)) && i < 24000; i++) {
    bot(g.targets.find(t => t.hp > 0 && t.open !== false) || g.targets.find(t => t.hp > 0));
  }
  assert.ok(firstPhaseTargets.every(t => t.hp <= 0));
  assert.equal(g.targets.length, 1);
  assert.equal(g.targets[0].type, 'core');
  assert.equal(g.targets[0].maxHp, 24);
  for (let i = 0; g.state === 'playing' && i < 12000; i++) {
    bot(g.targets.find(t => t.hp > 0));
  }
  assert.equal(g.state, 'victory');
  assert.ok(g.elapsed > 0);
  assert.ok(g.score > 0);
  context.diagnostic(`Input-only clear: ${g.elapsed.toFixed(1)}s, ${g.deaths} deaths, no continues.`);
});
