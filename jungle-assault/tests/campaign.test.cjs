const test = require('node:test');
const assert = require('node:assert/strict');
const {CampaignGame} = require('../web/campaign.js');
const {GameModel} = require('../web/engine.js');

function clearJungle(g) {
  // The combat model is tested separately; exercise its real delayed-clear
  // branch here so the campaign sees the same result as ordinary gameplay.
  g.boss.hp = 0;
  g.bossDefeat = .01;
  g.update(1 / 60);
}

test('campaign starts at the title screen and preserves model property/method access', () => {
  const effects = [];
  const g = new CampaignGame(name => effects.push(name));
  assert.equal(g.state, 'menu');
  assert.equal(g.levelNumber, 1);
  assert.ok(g.current instanceof GameModel);
  assert.ok('player' in g);
  assert.equal(g.reset('practice', 1), g);
  assert.equal(g.state, 'playing');
  assert.equal(g.lives, 8);
  g.score = 2700;
  assert.equal(g.current.score, 2700);
  g.player.invuln = 0;
  const damage = g.damage;
  assert.equal(damage(), true, 'an extracted combat method remains bound to its model');
  assert.equal(g.lives, 7);
  assert.ok(effects.includes('death'));
  const time = g.time;
  g.state = 'paused';
  g.update(.04, {x: 1, fire: true});
  assert.equal(g.time, time);
});

test('first-stage victory becomes a stable stage-clear screen and waits for user action', () => {
  const g = new CampaignGame();
  g.reset('classic', 1);
  g.score = 2100;
  clearJungle(g);
  assert.equal(g.state, 'stageclear');
  assert.equal(g.levelNumber, 1);
  assert.equal(g.score, 7100);
  const time = g.time;
  for (let i = 0; i < 60; i++) g.update(1 / 60, {x: 1, fire: true});
  assert.equal(g.state, 'stageclear');
  assert.equal(g.time, time);
  assert.equal(g.score, 7100, 'the stage-clear bonus is not granted twice');
});

test('entering the base carries lives, weapon, score, campaign statistics and extra-life threshold', () => {
  const g = new CampaignGame();
  g.reset('practice', 1);
  g.lives = 5;
  g.score = 25000;
  g.kills = 17;
  g.deaths = 2;
  g.elapsed = 74;
  g.shots = 111;
  g.hits = 79;
  g.nextLife = 40000;
  g.player.weapon = 'S';
  g.player.rapid = 9;
  clearJungle(g);
  const score = g.score;
  const elapsed = g.elapsed;
  const best = g.best;
  const rapid = g.player.rapid;
  assert.equal(g.nextLevel(), true);
  assert.equal(g.levelNumber, 2);
  assert.equal(g.state, 'playing');
  assert.equal(g.mode, 'practice');
  assert.equal(g.lives, 5);
  assert.equal(g.score, score);
  assert.equal(g.kills, 17);
  assert.equal(g.deaths, 2);
  assert.equal(g.elapsed, elapsed);
  assert.equal(g.player.weapon, 'S');
  assert.equal(g.player.rapid, rapid);
  assert.equal(g.shots, 111);
  assert.equal(g.hits, 79);
  assert.ok(g.player.invuln >= 2);
  assert.equal(g.nextLife, 40000);
  assert.equal(g.best, best);
  assert.equal(g.roomIndex, 0);
  assert.equal(g.baseMode, 'corridor');
  assert.equal(g.startLevel, 1);
  const active = g.current;
  assert.equal(g.nextLevel(), false);
  assert.equal(g.current, active, 'repeated transition input cannot reset the base');
});

test('next-stage action does nothing before the first-stage clear screen', () => {
  const g = new CampaignGame();
  const titleModel = g.current;
  assert.equal(g.nextLevel(), false);
  assert.equal(g.current, titleModel);
  g.reset('classic', 1);
  const playingModel = g.current;
  assert.equal(g.nextLevel(), false);
  assert.equal(g.current, playingModel);
});

test('stage selection supports a fresh base start and retry keeps the selected starting stage', () => {
  const g = new CampaignGame();
  g.best = 54321;
  g.reset('practice', 2);
  assert.equal(g.levelNumber, 2);
  assert.equal(g.startLevel, 2);
  assert.equal(g.state, 'playing');
  assert.equal(g.score, 0);
  assert.equal(g.lives, 8);
  assert.equal(g.player.weapon, 'R');
  assert.equal(g.best, 54321);
  g.score = 9000;
  g.player.weapon = 'L';
  g.reset('classic');
  assert.equal(g.levelNumber, 2);
  assert.equal(g.lives, 3);
  assert.equal(g.score, 0);
  assert.equal(g.player.weapon, 'R');
  assert.equal(g.best, 54321);
  g.reset('classic', 1);
  assert.equal(g.levelNumber, 1);
  assert.equal(g.startLevel, 1);
  assert.equal(g.best, 54321);
});

test('base victory stays final and does not create an unsupported third stage', () => {
  const g = new CampaignGame();
  g.reset('classic', 2);
  const active = g.current;
  g.score = 9990;
  g.best = 9990;
  g.state = 'victory';
  g.update(1 / 60);
  assert.equal(g.state, 'victory');
  assert.equal(g.levelNumber, 2);
  assert.equal(g.nextLevel(), false);
  assert.equal(g.current, active);
  assert.equal(g.best, 9990);
});

test('base game-over continues in the same model and room without losing the campaign best', () => {
  const g = new CampaignGame();
  g.reset('classic', 2);
  g.best = 12345;
  g.score = 3500;
  g.player.weapon = 'S';
  g.lives = 1;
  g.player.invuln = 0;
  assert.equal(g.damage(), true);
  for (let i = 0; i < 90 && g.state === 'playing'; i++) g.update(1 / 60);
  assert.equal(g.state, 'gameover');
  const active = g.current, room = g.roomIndex;
  assert.equal(g.continueGame(), true);
  assert.equal(g.current, active);
  assert.equal(g.levelNumber, 2);
  assert.equal(g.roomIndex, room);
  assert.equal(g.state, 'playing');
  assert.equal(g.lives, 3);
  assert.equal(g.score, 1500);
  assert.equal(g.player.weapon, 'R');
  assert.equal(g.best, 12345);
  assert.equal(g.continueGame(), false, 'continue cannot be used to refill lives during combat');
});
