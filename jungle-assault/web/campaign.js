/* Shared campaign flow; both game models keep their own combat rules. */
(function(root) {
  'use strict';

  function modelClass(name, file) {
    if (root[name]) return root[name];
    if (typeof module !== 'undefined' && module.exports) return require(file)[name];
    throw new Error(name + ' must be loaded before starting this stage');
  }

  function createFacade(campaign) {
    return new Proxy(campaign, {
      get(target, key, receiver) {
        if (Reflect.has(target, key)) return Reflect.get(target, key, receiver);
        const value = target.current[key];
        // An extracted method must still operate on the active model. In
        // particular damage/respawn must not run against the campaign wrapper.
        return typeof value === 'function' ? value.bind(target.current) : value;
      },
      set(target, key, value, receiver) {
        if (Reflect.has(target, key)) return Reflect.set(target, key, value, receiver);
        target.current[key] = value;
        return true;
      },
      has(target, key) {
        return Reflect.has(target, key) || key in target.current;
      }
    });
  }

  class CampaignGame {
    constructor(sound = () => {}) {
      this.sound = sound;
      this.current = null;
      this.startLevel = 1;
      this._best = 0;
      this.reset('classic', 1);
      this.current.state = 'menu';
      return createFacade(this);
    }

    get levelNumber() { return this.current ? this.current.levelNumber : this.startLevel; }

    get best() {
      return Math.max(this._best, Number(this.current && this.current.best) || 0);
    }

    set best(value) {
      this._best = Math.max(0, Number(value) || 0);
      if (this.current) this.current.best = this._best;
    }

    reset(mode = 'classic', level = this.startLevel) {
      const best = this.best;
      const nextLevel = Number(level) === 2 ? 2 : 1;
      const nextMode = mode === 'practice' ? 'practice' : 'classic';
      let next;
      if (nextLevel === 2) {
        const BaseLevelModel = modelClass('BaseLevelModel', './base-engine.js');
        next = new BaseLevelModel(this.sound, {mode: nextMode, best});
      } else {
        const GameModel = modelClass('GameModel', './engine.js');
        next = new GameModel(this.sound);
        next.reset(nextMode);
      }
      next.levelNumber = nextLevel;
      next.best = best;
      next.state = 'playing';
      this.current = next;
      this.startLevel = nextLevel;
      return this;
    }

    update(dt, input = {}) {
      this.current.update(dt, input);
      if (this.levelNumber === 1 && this.current.state === 'victory') {
        this._best = this.best;
        this.current.state = 'stageclear';
      }
      if (this.current.state === 'victory' || this.current.state === 'gameover') {
        this._best = this.best;
      }
    }

    nextLevel() {
      if (this.levelNumber !== 1 || this.current.state !== 'stageclear') return false;
      const from = this.current;
      const carry = {
        mode: from.mode,
        lives: from.lives,
        score: from.score,
        weapon: from.player.weapon,
        rapid: from.player.rapid,
        elapsed: from.elapsed,
        kills: from.kills,
        deaths: from.deaths,
        shots: from.shots,
        hits: from.hits,
        nextLife: from.nextLife,
        best: this.best
      };
      const BaseLevelModel = modelClass('BaseLevelModel', './base-engine.js');
      const next = new BaseLevelModel(this.sound, carry);
      next.levelNumber = 2;
      next.state = 'playing';
      // Keep the stage selected at the title screen as the campaign restart
      // point. An explicit reset(mode, 2) starts a fresh second-stage run.
      this.current = next;
      this._best = Math.max(this._best, carry.best);
      return true;
    }

    continueGame() {
      if (this.current.state !== 'gameover') return false;
      this.current.continueGame();
      return true;
    }
  }

  root.CampaignGame = CampaignGame;
  if (typeof module !== 'undefined' && module.exports) module.exports = {CampaignGame};
})(typeof window !== 'undefined' ? window : globalThis);
