/**
 * Core 2D Canvas Game Engine
 * High-performance render & update loop, smooth camera, weapon physics,
 * visual feedback (screen shake, damage numbers, hit flash, particles).
 */

import { soundEngine } from '../audio/soundEngine';
import {
  ActivePassive,
  ActiveWeapon,
  CharacterId,
  CharacterTheme,
  EnemyEntity,
  GameRunStats,
  PassiveType,
  PlayerStats,
  ProjectileEntity,
  WeaponType,
} from '../types';
import { ObjectPoolSystem } from './objectPool';
import { getCurrentWave, WAVE_SCHEDULE } from './waves';
import { DUNGEON_DIFFICULTY, type HubStationId } from './cityScene';

export interface GameEngineCallbacks {
  onLevelUp: (level: number) => void;
  onGameOver: (stats: GameRunStats) => void;
  onStatsUpdate: (stats: {
    hp: number;
    maxHp: number;
    xp: number;
    nextLevelXp: number;
    level: number;
    timeSurvived: number;
    kills: number;
    activeBoss: EnemyEntity | null;
  }) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pool: ObjectPoolSystem;
  private callbacks: GameEngineCallbacks;

  // Game State
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  // Rendering / performance state
  private viewW: number = 0;  // logical CSS-pixel viewport width
  private viewH: number = 0;
  private dpr: number = 1;
  private floorPattern: CanvasPattern | null = null;
  private avgFrameDt: number = 1 / 60; // EMA of frame time for adaptive quality
  private statsSendTimer: number = 0;  // throttle React HUD updates

  // Spatial hash grid for enemy collision queries (rebuilt each frame)
  private grid = new Map<number, EnemyEntity[]>();
  private gridCell = 128;
  private gridQueryBuf: EnemyEntity[] = [];

  // Survival & Stats
  private timeSurvived: number = 0; // seconds
  private kills: number = 0;
  private totalDamageDealt: number = 0;
  private gemsCollected: number = 0;
  private level: number = 1;
  private currentXp: number = 0;
  private nextLevelXp: number = 10;

  // Player
  public player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 16,
    facingLeft: false,
    walkCycle: 0,
    invincibleTimer: 0,
  };

  public stats: PlayerStats = {
    maxHp: 100,
    hp: 100,
    hpRegen: 0,
    speed: 165,
    pickupRadius: 75,
    damageMultiplier: 1.0,
    cooldownReduction: 0.0,
    armor: 0,
  };

  // Loadout
  public weapons: Map<WeaponType, ActiveWeapon> = new Map();

  // Character config from Lobby (defaults = starter 'blade')
  private characterBaseHp: number = 100;
  private characterSpeedMultiplier: number = 1.0;
  private characterDamageMultiplier: number = 1.0;
  public passives: Map<PassiveType, ActivePassive> = new Map();

  // Weapon internal state
  private bladeAngle: number = 0;
  private holyAuraTimer: number = 0;
  private lastEnemyHitTime: Map<string, number> = new Map(); // for blade damage throttling

  // Camera & Shake
  private camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  };
  private shakeIntensity: number = 0;
  private hitVignetteTimer: number = 0;

  // Input
  private inputVector = { x: 0, y: 0 };
  private keysDown: Set<string> = new Set();

  // Spawner
  private enemySpawnTimer: number = 0;
  private triggeredBosses: Set<number> = new Set();
  public activeBoss: EnemyEntity | null = null;

  // Lightning VFX storage
  private lightningStrikes: { x: number; y: number; timer: number }[] = [];
  // Signature weapon VFX storage
  private frostNovaRings: { x: number; y: number; r: number; maxR: number; timer: number; maxTimer: number; color: string }[] = [];
  private beamStrikes: { x: number; y: number; angle: number; len: number; timer: number; color: string; width: number }[] = [];

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Cannot get 2D canvas context');
    this.ctx = context;
    this.pool = new ObjectPoolSystem();
    this.callbacks = callbacks;

    this.bindKeyboard();
    this.resize();
  }

  /**
   * Resize backing store with a capped devicePixelRatio (max 2). Full Retina
   * (3x) multiplies fill-rate ~2.25x versus 2x for barely-visible gain,
   * so we keep crisp visuals while halving GPU cost on high-DPI phones.
   */
  public resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
      this.floorPattern = null; // rebuild pattern at new scale if needed
    }
    this.dpr = dpr;
    this.viewW = w;
    this.viewH = h;
  }

  // --- Spatial Grid ---
  private buildEnemyGrid() {
    this.grid.clear();
    const cell = this.gridCell;
    for (const e of this.pool.enemies) {
      if (!e.active) continue;
      const key = (Math.floor(e.x / cell) & 0xffff) | ((Math.floor(e.y / cell) & 0xffff) << 16);
      let arr = this.grid.get(key);
      if (!arr) {
        arr = [];
        this.grid.set(key, arr);
      }
      arr.push(e);
    }
  }

  /** Collect active enemies within `radius` of (x, y) into a reusable buffer. */
  private queryEnemies(x: number, y: number, radius: number): EnemyEntity[] {
    const out = this.gridQueryBuf;
    out.length = 0;
    const cell = this.gridCell;
    const minX = Math.floor((x - radius) / cell);
    const maxX = Math.floor((x + radius) / cell);
    const minY = Math.floor((y - radius) / cell);
    const maxY = Math.floor((y + radius) / cell);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const arr = this.grid.get((cx & 0xffff) | ((cy & 0xffff) << 16));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const e = arr[i];
          if (!e.active) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          const rr = radius + e.radius;
          if (dx * dx + dy * dy <= rr * rr) out.push(e);
        }
      }
    }
    return out;
  }

  private bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        this.keysDown.add(key);
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keysDown.delete(key);
    });
  }

  public setJoystickVector(x: number, y: number) {
    this.inputVector.x = x;
    this.inputVector.y = y;
  }

  /** Configure the run from the Lobby: selected character + owned perks. */
  public setLoadout(config: {
    characterId: CharacterId;
    maxHp: number;
    speedMultiplier: number;
    damageMultiplier: number;
    startingWeapons: WeaponType[];
    theme: CharacterTheme;
    applyPerks: (stats: PlayerStats) => void;
  }) {
    this.characterId = config.characterId;
    this.characterBaseHp = config.maxHp;
    this.characterSpeedMultiplier = config.speedMultiplier;
    this.characterDamageMultiplier = config.damageMultiplier;
    this.characterStartingWeapons = config.startingWeapons;
    this.characterTheme = config.theme;
    this.perkApplier = config.applyPerks;
  }

  private perkApplier: ((stats: PlayerStats) => void) | null = null;
  private dungeonDifficulty: number = 1;
  private pendingDifficulty: number | null = null;
  private characterId: CharacterId = 'blade';
  private characterStartingWeapons: WeaponType[] = ['spinning_blades', 'arcane_burst'];
  private characterTheme: CharacterTheme = {
    cape: '#0f172a',
    trim: '#22d3ee',
    glow: '#22d3ee',
    accent: '#0284c7',
    boot: '#38bdf8',
  };

  public initNewGame(difficulty?: number) {
    if (typeof difficulty === 'number') {
      this.pendingDifficulty = difficulty;
    }
    this.pool.resetAll();
    this.dungeonDifficulty = this.pendingDifficulty;
    this.pendingDifficulty = null;
    this.timeSurvived = 0;
    this.kills = 0;
    this.totalDamageDealt = 0;
    this.gemsCollected = 0;
    this.level = 1;
    this.currentXp = 0;
    this.nextLevelXp = 12;

    this.player.x = 0;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.facingLeft = false;
    this.player.walkCycle = 0;
    this.player.invincibleTimer = 0;

    this.stats = {
      maxHp: this.characterBaseHp,
      hp: this.characterBaseHp,
      hpRegen: 0.05,
      speed: Math.round(175 * this.characterSpeedMultiplier),
      pickupRadius: 85,
      damageMultiplier: this.characterDamageMultiplier,
      cooldownReduction: 0.0,
      armor: 0,
    };
    // Apply owned shop perks (armor, magnet, speed, regen, etc.)
    this.perkApplier?.(this.stats);

    // Seed the open world with the chosen dungeon difficulty (from Lobby).
    this.setWorldDifficulty(this.dungeonDifficulty);

    this.camera.x = 0;
    this.camera.y = 0;
    this.shakeIntensity = 0;
    this.hitVignetteTimer = 0;
    this.bladeAngle = 0;
    this.holyAuraTimer = 0;
    this.lastEnemyHitTime.clear();
    this.triggeredBosses.clear();
    this.activeBoss = null;
    this.lightningStrikes = [];
    this.frostNovaRings = [];
    this.beamStrikes = [];

    // Starting loadout: per-character signature weapons (matched from Lobby)
    this.weapons.clear();
    for (const w of this.characterStartingWeapons) {
      this.weapons.set(w, { id: w, level: 1, timer: w === 'arcane_burst' ? 0.2 : 0 });
    }

    this.passives.clear();
    this.applyPassiveBonuses();

    this.isPaused = false;
    this.isRunning = true;
    this.lastTime = performance.now();

    this.sendStats();
  }

  public applyUpgrade(itemId: WeaponType | PassiveType, isWeapon: boolean) {
    // Guard: ignore upgrade selections from a run that already ended/was exited.
    if (!this.isRunning) return;
    if (isWeapon) {
      const wType = itemId as WeaponType;
      const existing = this.weapons.get(wType);
      if (existing) {
        existing.level = Math.min(5, existing.level + 1);
      } else {
        this.weapons.set(wType, { id: wType, level: 1, timer: 0 });
      }
    } else {
      const pType = itemId as PassiveType;
      const existing = this.passives.get(pType);
      if (existing) {
        existing.level = Math.min(5, existing.level + 1);
      } else {
        this.passives.set(pType, { id: pType, level: 1 });
      }
      this.applyPassiveBonuses();
    }

    this.resume();
  }

  private applyPassiveBonuses() {
    let speed = 175 * this.characterSpeedMultiplier;
    let maxHp = this.characterBaseHp;
    let regen = 0.05;
    let pickupRadius = 85;
    let damageMultiplier = this.characterDamageMultiplier;
    let cooldownReduction = 0.0;
    let armor = 0;

    for (const [type, item] of this.passives.entries()) {
      const lvl = item.level;
      if (type === 'swift_boots') {
        speed += lvl * 22;
      } else if (type === 'vitality') {
        maxHp += lvl * 25;
        regen += lvl * 0.35;
      } else if (type === 'magnet') {
        pickupRadius += lvl * 38;
      } else if (type === 'might') {
        damageMultiplier += lvl * 0.18;
      } else if (type === 'haste') {
        cooldownReduction = Math.min(0.5, lvl * 0.1);
      } else if (type === 'armor') {
        armor += lvl * 2;
      }
    }

    const hpRatio = this.stats.hp / this.stats.maxHp;
    this.stats.maxHp = maxHp;
    this.stats.hp = Math.min(maxHp, Math.max(1, hpRatio * maxHp));
    this.stats.speed = speed;
    this.stats.hpRegen = regen;
    this.stats.pickupRadius = pickupRadius;
    this.stats.damageMultiplier = damageMultiplier;
    this.stats.cooldownReduction = cooldownReduction;
    this.stats.armor = armor;
  }

  /**
   * Configure the open world before `initNewGame()`.
   * Called by Lobby with the dungeon difficulty the player selected.
   * This does NOT generate anything immediately — the actual spawn/scaling
   * happens in `initNewGame()` where `setWorldDifficulty` re-seeds the world.
   */
  public setPendingDifficulty(difficulty: number) {
    const clamped = Math.max(1, Math.min(10, Math.floor(difficulty)));
    this.dungeonDifficulty = clamped;
    this.pendingDifficulty = clamped;
  }

  public getDifficulty(): number {
    return this.dungeonDifficulty;
  }

  /**
   * Re-seed world content for a difficulty tier. Also wipes any existing
   * enemies/pickups so the player never fights stale low-tier mobs.
   */
  public setWorldDifficulty(difficulty: number) {
    const clamped = Math.max(1, Math.min(10, Math.floor(difficulty)));
    this.dungeonDifficulty = clamped;
    this.pendingDifficulty = null;
    this.pool.resetAll();
    // Regenerate loot caches + restock world enemies for the new tier.
    this.generateWorldCaches();
    this.spawnWorldEnemies();
  }

  /**
   * Spawn treasure caches scattered around the world. Higher tiers grant
   * better rewards. Caches are one-shot and re-roll each difficulty tier.
   */
  private generateWorldCaches() {
    const count = 3 + Math.floor(this.dungeonDifficulty * 1.5);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 220 + Math.random() * (520 + this.dungeonDifficulty * 90);
      const gem = this.pool.spawnGem(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        5 + this.dungeonDifficulty * 4 + Math.floor(Math.random() * 6),
      );
      if (gem) gem.color = '#fbbf24'; // treasure-cache gems render gold
    }
  }

  /**
   * Seed initial enemy population outside the city walls.
   * Difficulty scales both spawn count and enemy strength directly.
   */
  private spawnWorldEnemies() {
    const base = 8 + this.dungeonDifficulty * 5;
    const tierHpMul = 1 + (this.dungeonDifficulty - 1) * 0.35;
    const tierDmgMul = 1 + (this.dungeonDifficulty - 1) * 0.22;
    for (let i = 0; i < base; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 380 + Math.random() * (600 + this.dungeonDifficulty * 120);
      const ex = Math.cos(angle) * dist;
      const ey = Math.sin(angle) * dist;
      const brute = Math.random() < 0.2 + this.dungeonDifficulty * 0.05;
      const hp = 30 * tierHpMul * (brute ? 2.2 : 1);
      const e = this.pool.spawnEnemy(
        brute ? 'orc' : 'zombie',
        ex, ey,
        hp,
        brute ? 55 : 85,
        8 * tierDmgMul * (brute ? 1.6 : 1),
        brute ? 20 : 13,
        brute ? 6 : 3,
        brute ? '#f97316' : '#22c55e',
      );
      if (e) e.hitFlashTimer = 0;
    }
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  /**
   * Fully stop the current run (player exited to the hub mid-dungeon).
   * Halts the update loop and blocks any later `resume()` / `applyUpgrade()`
   * from resurrecting a finished run in the background.
   */
  public stopRun() {
    this.isRunning = false;
    this.isPaused = false;
  }

  public start() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.lastTime = performance.now();
    const loop = (timestamp: number) => {
      const rawDt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;
      const dt = Math.min(0.1, rawDt);

      // Adaptive quality: track an EMA of real frame time. If we cannot hold
      // ~40fps for a sustained period, drop cosmetic effects automatically.
      if (rawDt > 0 && rawDt < 1) {
        this.avgFrameDt = this.avgFrameDt * 0.95 + rawDt * 0.05;
        this.pool.lowQuality = this.avgFrameDt > 1 / 40;
      }

      if (this.isRunning && !this.isPaused) {
        this.update(dt);
      }
      this.render();

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public destroy() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // --- Main Update Cycle ---
  private update(dt: number) {
    this.timeSurvived += dt;

    // HP regeneration
    if (this.stats.hp < this.stats.maxHp) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.hpRegen * dt);
    }

    // Invincible timer countdown
    if (this.player.invincibleTimer > 0) {
      this.player.invincibleTimer -= dt;
    }

    // Hit vignette countdown
    if (this.hitVignetteTimer > 0) {
      this.hitVignetteTimer -= dt;
    }

    // Screen shake decay
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 25);
    }

    // 1. Update Player Movement
    this.updatePlayerMovement(dt);

    // 2. Smooth Camera Follow
    const cameraSpeed = 7.0;
    this.camera.x += (this.player.x - this.camera.x) * (cameraSpeed * dt);
    this.camera.y += (this.player.y - this.camera.y) * (cameraSpeed * dt);

    // 3. Update Weapons & Attacks
    this.updateWeapons(dt);

    // 4. Update Projectiles (Player and Enemy)
    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);

    // 5. Spawn & Update Enemies
    this.updateEnemySpawning(dt);
    this.updateEnemies(dt);
    this.buildEnemyGrid(); // rebuilt once per frame for cheap weapon/projectile queries

    // 6. Update XP Gems & Magnet Attraction
    this.updateGems(dt);

    // 7. Update Particles & Floating Damage Numbers
    this.updateFloatingNumbersAndParticles(dt);

    // 8. Update Lightning Strikes VFX
    for (let i = this.lightningStrikes.length - 1; i >= 0; i--) {
      this.lightningStrikes[i].timer -= dt;
      if (this.lightningStrikes[i].timer <= 0) {
        this.lightningStrikes.splice(i, 1);
      }
    }

    // 8b. Update Frost Nova rings & Judgement beams VFX
    for (let i = this.frostNovaRings.length - 1; i >= 0; i--) {
      const ring = this.frostNovaRings[i];
      ring.timer -= dt;
      ring.r = ring.maxR * (1 - ring.timer / ring.maxTimer);
      if (ring.timer <= 0) this.frostNovaRings.splice(i, 1);
    }
    for (let i = this.beamStrikes.length - 1; i >= 0; i--) {
      this.beamStrikes[i].timer -= dt;
      if (this.beamStrikes[i].timer <= 0) this.beamStrikes.splice(i, 1);
    }

    // Check 20-minute victory condition
    if (this.timeSurvived >= 1200) {
      this.triggerGameOver(true);
      return;
    }

    // Check Player Death
    if (this.stats.hp <= 0) {
      this.triggerGameOver(false);
      return;
    }

    // Throttled HUD updates: React re-renders are expensive, so send stats
    // at 10Hz instead of every frame (60Hz). Health changes feel instant
    // because damage events also trigger an immediate update below.
    this.statsSendTimer -= dt;
    if (this.statsSendTimer <= 0) {
      this.statsSendTimer = 0.1;
      this.sendStats();
    }
  }

  /** Force an immediate HUD update (called on damage / level up / kill). */
  private sendStatsNow() {
    this.statsSendTimer = 0.1;
    this.sendStats();
  }

  private sendStats() {
    this.callbacks.onStatsUpdate({
      hp: Math.max(0, Math.round(this.stats.hp)),
      maxHp: this.stats.maxHp,
      xp: this.currentXp,
      nextLevelXp: this.nextLevelXp,
      level: this.level,
      timeSurvived: Math.floor(this.timeSurvived),
      kills: this.kills,
      activeBoss: this.activeBoss && this.activeBoss.active ? this.activeBoss : null,
    });
  }

  private triggerGameOver(victory: boolean) {
    this.isRunning = false;
    soundEngine.playEnemyDeath(true);
    this.callbacks.onGameOver({
      timeSurvived: Math.floor(this.timeSurvived),
      enemiesKilled: this.kills,
      damageDealt: Math.round(this.totalDamageDealt),
      gemsCollected: this.gemsCollected,
      level: this.level,
      victory,
    });
  }

  // --- Player Movement ---
  private updatePlayerMovement(dt: number) {
    let moveX = this.inputVector.x;
    let moveY = this.inputVector.y;

    // Keyboard controls override or blend
    let keyX = 0;
    let keyY = 0;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) keyX -= 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) keyX += 1;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) keyY -= 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) keyY += 1;

    if (keyX !== 0 || keyY !== 0) {
      const len = Math.hypot(keyX, keyY);
      moveX = keyX / len;
      moveY = keyY / len;
    }

    const isMoving = Math.hypot(moveX, moveY) > 0.05;
    if (isMoving) {
      if (moveX < -0.1) this.player.facingLeft = true;
      else if (moveX > 0.1) this.player.facingLeft = false;

      this.player.walkCycle += dt * 14;
      this.player.vx = moveX * this.stats.speed;
      this.player.vy = moveY * this.stats.speed;
    } else {
      this.player.vx *= 0.7;
      this.player.vy *= 0.7;
      this.player.walkCycle = 0;
    }

    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
  }

  // --- Weapons Engine ---
  private updateWeapons(dt: number) {
    const cdMult = 1 - this.stats.cooldownReduction;

    // 1. Spinning Blades Weapon
    const blades = this.weapons.get('spinning_blades');
    if (blades) {
      const bladeCount = blades.level; // 1 to 5 blades
      const rotSpeed = 2.6 + blades.level * 0.4;
      this.bladeAngle += rotSpeed * dt;
      const orbitDist = 72 + (blades.level >= 3 ? 18 : 0);
      const bladeDmg = (18 + blades.level * 8) * this.stats.damageMultiplier;

      // Check collision between each blade and active enemies
      const nowTime = this.timeSurvived;
      for (let b = 0; b < bladeCount; b++) {
        const offsetAngle = this.bladeAngle + (b * Math.PI * 2) / bladeCount;
        const bx = this.player.x + Math.cos(offsetAngle) * orbitDist;
        const by = this.player.y + Math.sin(offsetAngle) * orbitDist;
        const bRadius = 14 + (blades.level >= 4 ? 4 : 0);

        const nearby = this.queryEnemies(bx, by, bRadius + 40);
        for (const enemy of nearby) {
          const key = `blade_${b}_e_${enemy.id}`;
          const lastHit = this.lastEnemyHitTime.get(key) || 0;
          if (nowTime - lastHit >= 0.22) {
            this.lastEnemyHitTime.set(key, nowTime);
            this.damageEnemy(enemy, bladeDmg, false);
            soundEngine.playBladeHit();
            this.pool.spawnParticles(bx, by, '#38bdf8', 4, 70);
          }
        }
      }

      // Prune stale blade-hit keys so the Map doesn't grow unbounded.
      if (this.lastEnemyHitTime.size > 1024) {
        this.lastEnemyHitTime.clear();
      }
    }

    // 2. Arcane Burst Weapon
    const arcane = this.weapons.get('arcane_burst');
    if (arcane) {
      arcane.timer -= dt;
      const cd = Math.max(0.4, (1.1 - arcane.level * 0.12) * cdMult);
      if (arcane.timer <= 0) {
        arcane.timer = cd;
        this.fireArcaneBurst(arcane.level);
      }
    }

    // 3. Holy Aura Weapon
    const holy = this.weapons.get('holy_aura');
    if (holy) {
      this.holyAuraTimer -= dt;
      const cd = Math.max(0.35, 0.55 * cdMult);
      if (this.holyAuraTimer <= 0) {
        this.holyAuraTimer = cd;
        const auraRadius = 75 + holy.level * 22;
        const auraDmg = (14 + holy.level * 7) * this.stats.damageMultiplier;

        const nearby = this.queryEnemies(this.player.x, this.player.y, auraRadius);
        for (const enemy of nearby) {
          this.damageEnemy(enemy, auraDmg, false);
          this.pool.spawnParticles(enemy.x, enemy.y, '#fef08a', 2, 40);
        }
      }
    }

    // 4. Lightning Strike Weapon
    const lightning = this.weapons.get('lightning_strike');
    if (lightning) {
      lightning.timer -= dt;
      const cd = Math.max(0.8, (2.0 - lightning.level * 0.2) * cdMult);
      if (lightning.timer <= 0) {
        lightning.timer = cd;
        this.fireLightningStrike(lightning.level);
      }
    }

    // 5. Fire Wand Weapon
    const fire = this.weapons.get('fire_wand');
    if (fire) {
      fire.timer -= dt;
      const cd = Math.max(0.6, (1.5 - fire.level * 0.15) * cdMult);
      if (fire.timer <= 0) {
        fire.timer = cd;
        this.fireFireWand(fire.level);
      }
    }

    // 6. Blade Tempest (blade exclusive)
    const tempest = this.weapons.get('blade_tempest');
    if (tempest) {
      tempest.timer -= dt;
      const cd = Math.max(0.9, (2.2 - tempest.level * 0.18) * cdMult);
      if (tempest.timer <= 0) {
        tempest.timer = cd;
        this.fireBladeTempest(tempest.level);
      }
    }

    // 7. Frost Nova (mage exclusive)
    const frost = this.weapons.get('frost_nova');
    if (frost) {
      frost.timer -= dt;
      const cd = Math.max(1.0, (2.4 - frost.level * 0.2) * cdMult);
      if (frost.timer <= 0) {
        frost.timer = cd;
        this.fireFrostNova(frost.level);
      }
    }

    // 8. Poison Volley (hunter exclusive)
    const poison = this.weapons.get('poison_volley');
    if (poison) {
      poison.timer -= dt;
      const cd = Math.max(0.5, (1.4 - poison.level * 0.12) * cdMult);
      if (poison.timer <= 0) {
        poison.timer = cd;
        this.firePoisonVolley(poison.level);
      }
    }

    // 9. Judgement Beam (paladin exclusive)
    const beam = this.weapons.get('judgement_beam');
    if (beam) {
      beam.timer -= dt;
      const cd = Math.max(1.2, (2.6 - beam.level * 0.2) * cdMult);
      if (beam.timer <= 0) {
        beam.timer = cd;
        this.fireJudgementBeam(beam.level);
      }
    }

    // 10. Soul Scythe (wraith exclusive)
    const scythe = this.weapons.get('soul_scythe');
    if (scythe) {
      scythe.timer -= dt;
      const cd = Math.max(0.7, (1.8 - scythe.level * 0.14) * cdMult);
      if (scythe.timer <= 0) {
        scythe.timer = cd;
        this.fireSoulScythe(scythe.level);
      }
    }

    // 11. Blood Reaver (berserker exclusive)
    const reaver = this.weapons.get('blood_reaver');
    if (reaver) {
      reaver.timer -= dt;
      const cd = Math.max(0.6, (1.6 - reaver.level * 0.14) * cdMult);
      if (reaver.timer <= 0) {
        reaver.timer = cd;
        this.pulseBloodReaver(reaver.level);
      }
    }
  }

  private fireArcaneBurst(level: number) {
    const closest = this.findClosestEnemy(this.player.x, this.player.y, 650);
    if (!closest) return;

    soundEngine.playArcaneShoot();
    const projectileCount = Math.min(4, 1 + Math.floor((level - 1) * 0.8));
    const baseAngle = Math.atan2(closest.y - this.player.y, closest.x - this.player.x);
    const spread = 0.22;
    const speed = 420;
    const dmg = (26 + level * 12) * this.stats.damageMultiplier;
    const pierce = level >= 4 ? 2 : 1;

    for (let i = 0; i < projectileCount; i++) {
      const angle = baseAngle + (i - (projectileCount - 1) / 2) * spread;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.pool.spawnProjectile(
        'arcane_burst',
        this.player.x,
        this.player.y,
        vx,
        vy,
        dmg,
        6,
        1.8,
        '#38bdf8',
        pierce,
        angle
      );
    }
  }

  private fireLightningStrike(level: number) {
    // Find candidate enemies via the spatial grid (single wide query)
    const candidates = this.queryEnemies(this.player.x, this.player.y, 600).slice();
    if (candidates.length === 0) return;

    soundEngine.playLightning();
    this.addScreenShake(4);

    const targetCount = Math.min(candidates.length, level >= 5 ? 6 : level + 1);
    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const dmg = (55 + level * 20) * this.stats.damageMultiplier;
    for (let i = 0; i < targetCount; i++) {
      const target = candidates[i];
      this.damageEnemy(target, dmg, true);
      this.lightningStrikes.push({ x: target.x, y: target.y, timer: 0.18 });
      this.pool.spawnParticles(target.x, target.y, '#67e8f9', 8, 120);
    }
  }

  private fireFireWand(level: number) {
    const closest = this.findClosestEnemy(this.player.x, this.player.y, 650);
    if (!closest) return;

    soundEngine.playArcaneShoot();
    const count = level >= 3 ? (level >= 5 ? 3 : 2) : 1;
    const baseAngle = Math.atan2(closest.y - this.player.y, closest.x - this.player.x);
    const speed = 340;
    const dmg = (38 + level * 16) * this.stats.damageMultiplier;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * 0.3;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.pool.spawnProjectile(
        'fire_wand',
        this.player.x,
        this.player.y,
        vx,
        vy,
        dmg,
        8,
        2.0,
        '#f97316',
        1,
        angle
      );
    }
  }

  /* ==================== SIGNATURE WEAPONS ==================== */

  private fireBladeTempest(level: number) {
    const count = level >= 5 ? 12 : Math.min(10, 6 + (level - 1) * 2);
    const speed = 380;
    const dmg = (22 + level * 9) * this.stats.damageMultiplier;
    const pierce = level >= 4 ? 3 : 2;
    const baseAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * Math.PI * 2) / count;
      this.pool.spawnProjectile(
        'blade_tempest',
        this.player.x,
        this.player.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        dmg,
        7,
        0.8,
        '#67e8f9',
        pierce,
        angle
      );
    }
    soundEngine.playBladeHit();
  }

  private fireFrostNova(level: number) {
    soundEngine.playExplosion();
    const radius = 140 + level * 28;
    const dmg = (30 + level * 13) * this.stats.damageMultiplier;
    this.frostNovaRings.push({ x: this.player.x, y: this.player.y, r: 10, maxR: radius, timer: 0.5, maxTimer: 0.5, color: '#7dd3fc' });

    const nearby = this.queryEnemies(this.player.x, this.player.y, radius).slice();
    for (const enemy of nearby) {
      this.damageEnemy(enemy, dmg, false);
      this.pool.spawnParticles(enemy.x, enemy.y, '#7dd3fc', 3, 60);
      // Knockback: push enemies away from the blast center
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = 900;
      enemy.vx = (dx / d) * push;
      enemy.vy = (dy / d) * push;
    }
    this.addScreenShake(5);
  }

  private firePoisonVolley(level: number) {
    const closest = this.findClosestEnemy(this.player.x, this.player.y, 700);
    if (!closest) return;

    soundEngine.playArcaneShoot();
    const count = level >= 5 ? 9 : level >= 4 ? 7 : level >= 2 ? 5 : 3;
    const baseAngle = Math.atan2(closest.y - this.player.y, closest.x - this.player.x);
    const speed = 400;
    const dmg = (20 + level * 8) * this.stats.damageMultiplier;
    const pierce = level >= 3 ? 4 : 3;
    const spread = 0.16;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * spread;
      this.pool.spawnProjectile(
        'poison_volley',
        this.player.x,
        this.player.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        dmg,
        6,
        1.4,
        '#84cc16',
        pierce,
        angle
      );
    }
  }

  private fireJudgementBeam(level: number) {
    const closest = this.findClosestEnemy(this.player.x, this.player.y, 800);
    const baseAngle = closest
      ? Math.atan2(closest.y - this.player.y, closest.x - this.player.x)
      : 0;
    const beamCount = level >= 5 ? 3 : level >= 3 ? 2 : 1;
    const len = 850;
    const width = level >= 4 ? 34 : 22;
    const dmg = (45 + level * 18) * this.stats.damageMultiplier;

    soundEngine.playLightning();
    this.addScreenShake(6);

    const hitIds = new Set<number>();
    for (let b = 0; b < beamCount; b++) {
      const angle = baseAngle + (b * Math.PI * 2) / beamCount;
      this.beamStrikes.push({ x: this.player.x, y: this.player.y, angle, len, timer: 0.28, color: '#fde047', width });

      // Damage everything along the corridor (sampled queries, deduped)
      const steps = 6;
      for (let s = 1; s <= steps; s++) {
        const sx = this.player.x + Math.cos(angle) * (len / steps) * s;
        const sy = this.player.y + Math.sin(angle) * (len / steps) * s;
        const nearby = this.queryEnemies(sx, sy, width);
        for (const enemy of nearby) {
          if (hitIds.has(enemy.id)) continue;
          hitIds.add(enemy.id);
          this.damageEnemy(enemy, dmg, false);
          this.pool.spawnParticles(enemy.x, enemy.y, '#fde047', 3, 70);
        }
      }
    }
  }

  private fireSoulScythe(level: number) {
    soundEngine.playArcaneShoot();
    const count = level >= 5 ? 4 : level >= 4 ? 3 : level >= 2 ? 2 : 1;
    const closest = this.findClosestEnemy(this.player.x, this.player.y, 700);
    const baseAngle = closest
      ? Math.atan2(closest.y - this.player.y, closest.x - this.player.x)
      : 0;
    const speed = 300;
    const dmg = (34 + level * 14) * this.stats.damageMultiplier;
    const pierce = level >= 4 ? 6 : 4;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * 0.5;
      this.pool.spawnProjectile(
        'soul_scythe',
        this.player.x,
        this.player.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        dmg,
        10,
        1.6,
        '#c084fc',
        pierce,
        angle
      );
    }
  }

  private pulseBloodReaver(level: number) {
    const radius = 110 + level * 20;
    const dmg = (26 + level * 11) * this.stats.damageMultiplier;
    const healPerKill = level >= 5 ? 10 : level >= 4 ? 5 : level >= 2 ? 2 : 0;

    this.frostNovaRings.push({ x: this.player.x, y: this.player.y, r: 8, maxR: radius, timer: 0.35, maxTimer: 0.35, color: '#ef4444' });

    const nearby = this.queryEnemies(this.player.x, this.player.y, radius).slice();
    for (const enemy of nearby) {
      this.damageEnemy(enemy, dmg, false);
      this.pool.spawnParticles(enemy.x, enemy.y, '#ef4444', 2, 50);
      // Blood frenzy: heal on kill
      if (healPerKill > 0 && !enemy.active && enemy.hp <= 0) {
        this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + healPerKill);
        this.pool.spawnParticles(this.player.x, this.player.y, '#f87171', 4, 80);
      }
    }
    if (nearby.length > 0) soundEngine.playEnemyHit();
  }

  private updateProjectiles(dt: number) {
    for (const p of this.pool.projectiles) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        if (p.weaponType === 'fire_wand') {
          this.explodeFireball(p.x, p.y, p.damage);
        }
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Collision check via spatial grid — O(k) instead of O(all enemies)
      const nearby = this.queryEnemies(p.x, p.y, p.radius);
      for (let i = 0; i < nearby.length; i++) {
        const e = nearby[i];
          const isCrit = Math.random() < 0.15;
          const finalDamage = isCrit ? p.damage * 1.8 : p.damage;

          this.damageEnemy(e, finalDamage, isCrit);
          this.pool.spawnParticles(p.x, p.y, p.color, 5, 80);

          if (p.weaponType === 'fire_wand') {
            this.explodeFireball(p.x, p.y, p.damage);
            p.active = false;
            break;
          }

          p.pierce -= 1;
          if (p.pierce <= 0) {
            p.active = false;
            break;
          }
      }
    }
  }

  private explodeFireball(x: number, y: number, damage: number) {
    soundEngine.playExplosion();
    this.addScreenShake(6);
    this.pool.spawnParticles(x, y, '#ef4444', 16, 140);
    this.pool.spawnParticles(x, y, '#facc15', 10, 90);

    const radius = 75;
    const nearby = this.queryEnemies(x, y, radius);
    for (let i = 0; i < nearby.length; i++) {
      this.damageEnemy(nearby[i], damage * 0.85, false);
    }
  }

  // --- Enemies & Wave Spawner ---
  private updateEnemySpawning(dt: number) {
    const wave = getCurrentWave(this.timeSurvived);

    // Check boss triggers
    if (wave.bossEvent && !this.triggeredBosses.has(wave.bossEvent.triggerTime)) {
      if (this.timeSurvived >= wave.bossEvent.triggerTime) {
        this.triggeredBosses.add(wave.bossEvent.triggerTime);
        this.spawnBoss(wave.bossEvent);
      }
    }

    this.enemySpawnTimer += dt;
    const interval = 1 / wave.spawnRate;

    while (this.enemySpawnTimer >= interval) {
      this.enemySpawnTimer -= interval;

      // Select enemy based on weight
      const totalWeight = wave.enemies.reduce((acc, curr) => acc + curr.weight, 0);
      let rand = Math.random() * totalWeight;
      let selected = wave.enemies[0];

      for (const def of wave.enemies) {
        if (rand < def.weight) {
          selected = def;
          break;
        }
        rand -= def.weight;
      }

      // Safeguard: Limit concurrent shooting enemies in early stages
      if (selected.category === 'fire_mage') {
        const maxActiveShooters = this.timeSurvived < 300 ? 2 : (this.timeSurvived < 600 ? 4 : 8);
        let activeShooters = 0;
        for (let i = 0; i < this.pool.enemies.length; i++) {
          const en = this.pool.enemies[i];
          if (en.active && en.category === 'fire_mage') {
            activeShooters++;
            if (activeShooters >= maxActiveShooters) break;
          }
        }

        // If cap reached for shooting enemies, switch to a melee enemy from this wave
        if (activeShooters >= maxActiveShooters) {
          const alternate = wave.enemies.find((e) => e.category !== 'fire_mage');
          if (alternate) {
            selected = alternate;
          }
        }
      }

      // Spawn at a circle perimeter around player outside viewport (650 to 800px)
      const spawnDist = 650 + Math.random() * 120;
      const angle = Math.random() * Math.PI * 2;
      const sx = this.player.x + Math.cos(angle) * spawnDist;
      const sy = this.player.y + Math.sin(angle) * spawnDist;

      // Scale HP slightly with survival time + dungeon difficulty
      const timeScale = (1 + (this.timeSurvived / 120) * 0.45) * (1 + (this.dungeonDifficulty - 1) * 0.35);
      const finalHp = Math.round(selected.baseHp * timeScale);

      const spawned = this.pool.spawnEnemy(
        selected.category,
        sx,
        sy,
        finalHp,
        selected.baseSpeed,
        selected.baseDamage,
        selected.radius,
        selected.xpValue,
        selected.color,
        false
      );

      // Delay first shot for shooting enemies so they don't fire instantly upon appearing
      if (spawned && spawned.category === 'fire_mage') {
        spawned.attackTimer = this.timeSurvived < 300
          ? 4.0 + Math.random() * 2.0
          : (this.timeSurvived < 600 ? 3.0 + Math.random() * 1.0 : 2.0 + Math.random() * 0.8);
      }
    }
  }

  private spawnBoss(bossDef: NonNullable<ReturnType<typeof getCurrentWave>['bossEvent']>) {
    soundEngine.playEnemyDeath(true);
    this.addScreenShake(12);

    const hpMul = 1 + (this.dungeonDifficulty - 1) * 0.35;
    const spawnDist = 550;
    const angle = Math.random() * Math.PI * 2;
    const sx = this.player.x + Math.cos(angle) * spawnDist;
    const sy = this.player.y + Math.sin(angle) * spawnDist;

    const boss = this.pool.spawnEnemy(
      bossDef.category,
      sx,
      sy,
      Math.round(bossDef.hp * hpMul),
      bossDef.speed,
      bossDef.damage,
      bossDef.radius,
      bossDef.xpValue,
      bossDef.color,
      true
    );

    if (boss) {
      boss.bossName = bossDef.name;
      boss.bossNameAr = bossDef.nameAr;
      boss.attackTimer = 2.0;
      boss.bossPhase = 1;
      this.activeBoss = boss;
    }
  }

  private updateEnemyProjectiles(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    const pRadius = this.player.radius;

    for (const ep of this.pool.enemyProjectiles) {
      if (!ep.active) continue;

      ep.life += dt;
      if (ep.life >= ep.maxLife) {
        ep.active = false;
        continue;
      }

      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;

      // Trail sparks & particle effect
      ep.trailTimer += dt;
      if (ep.trailTimer >= 0.08) {
        ep.trailTimer = 0;
        this.pool.spawnParticles(ep.x, ep.y, ep.color, 1, 30);
      }

      // Check collision with player
      const dist = Math.hypot(px - ep.x, py - ep.y);
      if (dist <= pRadius + ep.radius) {
        this.hitPlayer(ep.damage);
        this.pool.spawnParticles(ep.x, ep.y, ep.color, 6, 80);
        ep.active = false;
      }
    }
  }

  private updateEnemies(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    const pRadius = this.player.radius;

    for (const e of this.pool.enemies) {
      if (!e.active) continue;

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
      }
      e.animTimer += dt * 6;

      const dx = px - e.x;
      const dy = py - e.y;
      const dist = Math.hypot(dx, dy);

      // ==========================================
      // FIRE MAGE AI (رمي النيران على اللاعب)
      // ==========================================
      if (e.category === 'fire_mage') {
        if (e.attackTimer === undefined) {
          e.attackTimer = this.timeSurvived < 300
            ? 4.0 + Math.random() * 2.0
            : (this.timeSurvived < 600 ? 3.0 + Math.random() * 1.0 : 2.0 + Math.random() * 0.8);
        }

        e.attackTimer -= dt;

        // Keep distance: ideal 230 - 320 px
        if (dist > 300) {
          e.vx = (dx / dist) * e.speed;
          e.vy = (dy / dist) * e.speed;
        } else if (dist < 190 && dist > 1) {
          // Back away from player
          e.vx = -(dx / dist) * (e.speed * 0.9);
          e.vy = -(dy / dist) * (e.speed * 0.9);
        } else if (dist > 1) {
          // Strafe in a circle
          const perpX = -dy / dist;
          const perpY = dx / dist;
          e.vx = perpX * (e.speed * 0.6);
          e.vy = perpY * (e.speed * 0.6);
        }

        // Fire fireball projectile at player (balanced for early stages)
        if (e.attackTimer <= 0 && dist < 650) {
          // Slower firing rate in early minutes
          const cooldown = this.timeSurvived < 300
            ? 4.5 + Math.random() * 1.5 // shoots once every 4.5 to 6 seconds in early stages
            : (this.timeSurvived < 600 ? 3.4 + Math.random() * 1.0 : 2.4 + Math.random() * 0.8);
          e.attackTimer = cooldown;

          soundEngine.playFireWand();
          this.pool.spawnParticles(e.x, e.y, '#f97316', 6, 70);

          if (dist > 1) {
            // Slower fireball speed and lower damage in early stages for fair dodging
            const fSpeed = this.timeSurvived < 300 ? 150 : (this.timeSurvived < 600 ? 185 : 220);
            const fDamageRatio = this.timeSurvived < 300 ? 0.6 : (this.timeSurvived < 600 ? 0.75 : 0.9);
            const fRadius = this.timeSurvived < 300 ? 7 : 8;
            const fVx = (dx / dist) * fSpeed;
            const fVy = (dy / dist) * fSpeed;
            this.pool.spawnEnemyProjectile(
              'fireball',
              e.x,
              e.y,
              fVx,
              fVy,
              e.damage * fDamageRatio,
              fRadius,
              3.5,
              '#f97316'
            );
          }
        }
      }

      // ==========================================
      // DISTINCT BOSS AI (زعماء مختلفون في الهجمات والسلوك)
      // ==========================================
      else if (e.isBoss) {
        e.attackTimer = (e.attackTimer ?? 2.5) - dt;

        if (e.category === 'minotaur_boss' && (e.bossName?.includes('Ghoul') || e.bossNameAr?.includes('الغيلان'))) {
          // Armored Ghoul King: Fires toxic spread orbs
          if (dist > 1) {
            e.vx = (dx / dist) * e.speed;
            e.vy = (dy / dist) * e.speed;
          }

          if (e.attackTimer <= 0) {
            e.attackTimer = 3.8;
            soundEngine.playEnemyHit();
            this.pool.spawnParticles(e.x, e.y, '#10b981', 12, 110);

            const baseAngle = Math.atan2(dy, dx);
            const spread = [-0.25, 0, 0.25];
            const pSpeed = 165;

            for (const offset of spread) {
              const ang = baseAngle + offset;
              this.pool.spawnEnemyProjectile(
                'toxic_orb',
                e.x,
                e.y,
                Math.cos(ang) * pSpeed,
                Math.sin(ang) * pSpeed,
                e.damage * 0.75,
                9,
                3.2,
                '#10b981'
              );
            }
          }
        } else if (e.category === 'minotaur_boss' && (e.bossName?.includes('Abyssal') || e.bossNameAr?.includes('الأعماق'))) {
          // Abyssal Behemoth: 360-degree radial magma fireballs
          if (dist > 1) {
            e.vx = (dx / dist) * e.speed;
            e.vy = (dy / dist) * e.speed;
          }

          if (e.attackTimer <= 0) {
            e.attackTimer = 4.2;
            this.addScreenShake(9);
            soundEngine.playExplosion();
            this.pool.spawnParticles(e.x, e.y, '#dc2626', 20, 160);

            const count = 8;
            const pSpeed = 200;
            for (let i = 0; i < count; i++) {
              const ang = (i * Math.PI * 2) / count;
              this.pool.spawnEnemyProjectile(
                'fireball',
                e.x,
                e.y,
                Math.cos(ang) * pSpeed,
                Math.sin(ang) * pSpeed,
                e.damage * 0.85,
                9,
                3.5,
                '#ea580c'
              );
            }
          }
        } else if (e.category === 'reaper_boss' && (e.bossName?.includes('Shadow') || e.bossNameAr?.includes('الظلال'))) {
          // Shadow Overlord: Void orbs and shadow teleportation
          if (dist < 130) {
            const escapeAngle = Math.random() * Math.PI * 2;
            this.pool.spawnParticles(e.x, e.y, '#7c3aed', 15, 120);
            e.x = px + Math.cos(escapeAngle) * 320;
            e.y = py + Math.sin(escapeAngle) * 320;
            this.pool.spawnParticles(e.x, e.y, '#7c3aed', 15, 120);
          } else if (dist > 1) {
            e.vx = (dx / dist) * e.speed;
            e.vy = (dy / dist) * e.speed;
          }

          if (e.attackTimer <= 0) {
            e.attackTimer = 3.6;
            soundEngine.playEnemyHit();
            this.pool.spawnParticles(e.x, e.y, '#a855f7', 10, 90);

            const baseAngle = Math.atan2(dy, dx);
            const spread = [-0.18, 0, 0.18];
            const pSpeed = 240;

            for (const offset of spread) {
              const ang = baseAngle + offset;
              this.pool.spawnEnemyProjectile(
                'void_orb',
                e.x,
                e.y,
                Math.cos(ang) * pSpeed,
                Math.sin(ang) * pSpeed,
                e.damage * 0.8,
                9,
                3.2,
                '#7c3aed'
              );
            }
          }
        } else if (e.category === 'reaper_boss') {
          // Grim Reaper of Eternity: Crescent Scythe Waves
          if (dist > 1) {
            e.vx = (dx / dist) * e.speed;
            e.vy = (dy / dist) * e.speed;
          }

          if (e.attackTimer <= 0) {
            e.attackTimer = 2.8;
            this.addScreenShake(6);
            soundEngine.playEnemyHit();
            this.pool.spawnParticles(e.x, e.y, '#9333ea', 16, 140);

            const baseAngle = Math.atan2(dy, dx);
            const scytheAngles = [-0.22, 0.22];
            const pSpeed = 270;

            for (const offset of scytheAngles) {
              const ang = baseAngle + offset;
              this.pool.spawnEnemyProjectile(
                'scythe_wave',
                e.x,
                e.y,
                Math.cos(ang) * pSpeed,
                Math.sin(ang) * pSpeed,
                e.damage * 0.95,
                14,
                3.8,
                '#c084fc'
              );
            }
          }
        } else {
          // Crypt Minotaur: Stomp shockwaves
          if (dist > 1) {
            e.vx = (dx / dist) * e.speed;
            e.vy = (dy / dist) * e.speed;
          }

          if (e.attackTimer <= 0) {
            e.attackTimer = 4.0;
            this.addScreenShake(7);
            soundEngine.playEnemyHit();
            this.pool.spawnParticles(e.x, e.y, '#f59e0b', 12, 100);

            const count = 4;
            const pSpeed = 210;
            for (let i = 0; i < count; i++) {
              const ang = (i * Math.PI * 2) / count;
              this.pool.spawnEnemyProjectile(
                'shockwave',
                e.x,
                e.y,
                Math.cos(ang) * pSpeed,
                Math.sin(ang) * pSpeed,
                e.damage * 0.75,
                10,
                2.5,
                '#ef4444'
              );
            }
          }
        }
      }

      // Standard marching enemy
      else {
        if (dist > 0.1) {
          e.vx = (dx / dist) * e.speed;
          e.vy = (dy / dist) * e.speed;
        }
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Check collision with player
      if (dist < pRadius + e.radius) {
        this.hitPlayer(e.damage);
      }
    }
  }

  private hitPlayer(baseDamage: number) {
    if (this.player.invincibleTimer > 0) return;

    const dmgMul = 1 + (this.dungeonDifficulty - 1) * 0.22;
    const effectiveDamage = Math.max(3, baseDamage * dmgMul - this.stats.armor);
    this.stats.hp -= effectiveDamage;
    this.player.invincibleTimer = 0.42; // invincibility window
    this.hitVignetteTimer = 0.25;
    this.addScreenShake(8);
    soundEngine.playPlayerHurt();
    this.pool.spawnParticles(this.player.x, this.player.y, '#ef4444', 8, 90);
    this.sendStatsNow();
  }

  public damageEnemy(enemy: EnemyEntity, damage: number, isCrit: boolean) {
    // Bosses are armored: they take 15% less damage from every source,
    // making burst builds less trivially effective against them.
    const playerMul = Math.max(0.5, 1 - (this.dungeonDifficulty - 1) * 0.04);
    const finalDamage = (enemy.isBoss ? damage * 0.85 : damage) * playerMul;
    enemy.hp -= finalDamage;
    enemy.hitFlashTimer = 0.12; // White hit flash!
    this.totalDamageDealt += finalDamage;
    this.pool.spawnDamageNumber(enemy.x, enemy.y, finalDamage, isCrit);

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: EnemyEntity) {
    enemy.active = false;
    this.kills += 1;
    soundEngine.playEnemyDeath(enemy.isBoss);

    if (enemy.isBoss) {
      this.addScreenShake(12);
      this.pool.spawnParticles(enemy.x, enemy.y, '#f59e0b', 24, 180);
      if (this.activeBoss === enemy) {
        this.activeBoss = null;
      }
    } else {
      this.pool.spawnParticles(enemy.x, enemy.y, enemy.color, 6, 75);
    }

    // Drop XP Gem
    this.pool.spawnGem(enemy.x, enemy.y, enemy.xpValue);
  }

  // --- XP Gems & Attraction ---
  private updateGems(dt: number) {
    const px = this.player.x;
    const py = this.player.y;
    const pickupRad = this.stats.pickupRadius;
    const pickupRadSq = pickupRad * pickupRad;

    for (const g of this.pool.gems) {
      if (!g.active) continue;

      const dSq = (px - g.x) ** 2 + (py - g.y) ** 2;

      // Friction for initial drop velocity
      g.vx *= 0.88;
      g.vy *= 0.88;
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      if (!g.attracted && dSq <= pickupRadSq) {
        g.attracted = true;
      }

      if (g.attracted) {
        const dist = Math.sqrt(dSq);
        if (dist <= this.player.radius + g.radius + 6) {
          // Collected!
          g.active = false;
          this.collectGem(g.value);
        } else {
          // Accelerate towards player
          const speed = 480;
          g.x += ((px - g.x) / dist) * speed * dt;
          g.y += ((py - g.y) / dist) * speed * dt;
        }
      }
    }
  }

  private collectGem(value: number) {
    this.gemsCollected += 1;
    this.currentXp += value;
    soundEngine.playGemPickup();
    this.sendStatsNow();

    if (this.currentXp >= this.nextLevelXp) {
      this.levelUp();
    }
  }

  private levelUp() {
    this.currentXp -= this.nextLevelXp;
    this.level += 1;
    // XP requirement curve (standard rogue-lite curve)
    this.nextLevelXp = Math.round(12 + (this.level ** 1.5) * 6);

    soundEngine.playLevelUp();
    this.addScreenShake(6);
    this.pool.spawnParticles(this.player.x, this.player.y, '#facc15', 20, 150);

    // Pause game and trigger level up modal
    this.pause();
    this.callbacks.onLevelUp(this.level);
  }

  private updateFloatingNumbersAndParticles(dt: number) {
    for (const d of this.pool.damageNumbers) {
      if (!d.active) continue;
      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
      } else {
        d.y += d.vy * dt;
      }
    }

    for (const pt of this.pool.particles) {
      if (!pt.active) continue;
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        pt.active = false;
      } else {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
      }
    }
  }

  private addScreenShake(amount: number) {
    this.shakeIntensity = Math.min(18, this.shakeIntensity + amount);
  }

  private findClosestEnemy(x: number, y: number, maxDist: number): EnemyEntity | null {
    let closest: EnemyEntity | null = null;
    let closestDistSq = maxDist * maxDist;

    for (const e of this.pool.enemies) {
      if (!e.active) continue;
      const dSq = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closest = e;
      }
    }
    return closest;
  }

  // --- Rendering Loop ---
  public render() {
    const ctx = this.ctx;
    const width = this.viewW;
    const height = this.viewH;
    const dpr = this.dpr;

    // Reset to device scale each frame (handles DPR + clears residue)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Apply Camera Translation with Screen Shake
    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
    const viewCenterX = width / 2;
    const viewCenterY = height / 2;

    ctx.translate(
      Math.round(viewCenterX - this.camera.x + shakeX),
      Math.round(viewCenterY - this.camera.y + shakeY)
    );

    // Viewport bounds (world coords) with margin, used for render culling
    const cullLeft = this.camera.x - viewCenterX - 80;
    const cullRight = this.camera.x + viewCenterX + 80;
    const cullTop = this.camera.y - viewCenterY - 80;
    const cullBottom = this.camera.y + viewCenterY + 80;
    this.cullLeft = cullLeft;
    this.cullRight = cullRight;
    this.cullTop = cullTop;
    this.cullBottom = cullBottom;

    // 1. Draw Endless Arena Floor Tiles & Markers
    this.renderFloor(ctx, width, height);

    // 1.5 City gate: difficulty banner + wall hints (arena edge decoration)
    {
      const gateX = 0;
      const WORLD_TOP = 240;
      ctx.save();
      // Stone wall bands flanking the gate
      ctx.fillStyle = 'rgba(71, 85, 105, 0.5)';
      ctx.fillRect(gateX - 190, -WORLD_TOP - 60, 60, WORLD_TOP + 130);
      ctx.fillRect(gateX + 130, -WORLD_TOP - 60, 60, WORLD_TOP + 130);
      // Banner pole + difficulty pennant above the gate
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(gateX, -WORLD_TOP - 10);
      ctx.lineTo(gateX, -WORLD_TOP - 90);
      ctx.stroke();
      const diff = this.getDifficulty();
      const hue = 120 - (diff - 1) * 24; // green -> red
      ctx.fillStyle = `hsl(${hue} 80% 50%)`;
      ctx.beginPath();
      ctx.moveTo(gateX, -WORLD_TOP - 88);
      ctx.lineTo(gateX + 66, -WORLD_TOP - 74);
      ctx.lineTo(gateX, -WORLD_TOP - 60);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(` Lv.${diff} `, gateX + 22, -WORLD_TOP - 70);
      ctx.restore();
    }

    // 2. Draw Holy Aura Field
    const holy = this.weapons.get('holy_aura');
    if (holy) {
      const radius = 75 + holy.level * 22;
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw XP Gems (culled; cheap layered-diamond glow instead of shadowBlur)
    for (const g of this.pool.gems) {
      if (!g.active) continue;
      if (!this.isOnScreen(g.x, g.y, 20)) continue;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = g.color;
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -g.radius);
      ctx.lineTo(g.radius, 0);
      ctx.lineTo(0, g.radius);
      ctx.lineTo(-g.radius, 0);
      ctx.closePath();
      ctx.fill();
      // Inner highlight (replaces expensive per-gem shadowBlur)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.moveTo(0, -g.radius * 0.45);
      ctx.lineTo(g.radius * 0.45, 0);
      ctx.lineTo(0, g.radius * 0.45);
      ctx.lineTo(-g.radius * 0.45, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Projectiles (culled; translucent halo instead of shadowBlur)
    for (const p of this.pool.projectiles) {
      if (!p.active) continue;
      if (!this.isOnScreen(p.x, p.y, 24)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      // Soft halo
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Body
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      // Core glow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Draw Orbiting Spinning Blades
    const blades = this.weapons.get('spinning_blades');
    if (blades) {
      const count = blades.level;
      const orbitDist = 72 + (blades.level >= 3 ? 18 : 0);
      for (let b = 0; b < count; b++) {
        const offsetAngle = this.bladeAngle + (b * Math.PI * 2) / count;
        const bx = this.player.x + Math.cos(offsetAngle) * orbitDist;
        const by = this.player.y + Math.sin(offsetAngle) * orbitDist;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(offsetAngle + Math.PI / 2);

        // Blade glow
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;

        // Curved sword blade
        ctx.fillStyle = '#67e8f9';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(8, 0, 0, 18);
        ctx.quadraticCurveTo(-8, 0, 0, -18);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    // 6. Draw Enemies (culled)
    for (const e of this.pool.enemies) {
      if (!e.active) continue;
      if (!this.isOnScreen(e.x, e.y, e.radius + 60)) continue;
      this.renderEnemy(ctx, e);
    }

    // 6.5 Draw Enemy Projectiles (Fireballs, Void Orbs, Toxic Orbs, Scythe Waves)
    this.renderEnemyProjectiles(ctx);

    // 7. Draw Player Character
    this.renderPlayer(ctx);

    // 8. Draw Lightning Strikes
    for (const strike of this.lightningStrikes) {
      ctx.save();
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(strike.x, strike.y - 450);
      const midX = strike.x + (Math.random() - 0.5) * 30;
      ctx.lineTo(midX, strike.y - 200);
      ctx.lineTo(strike.x, strike.y);
      ctx.stroke();

      // Core white bolt
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 8b. Draw Frost Nova / Blood Reaver rings & Judgement beams
    for (const ring of this.frostNovaRings) {
      if (!this.isOnScreen(ring.x, ring.y, ring.r + 20)) continue;
      const alpha = Math.max(0, ring.timer / ring.maxTimer);
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.18;
      ctx.fillStyle = ring.color;
      ctx.fill();
      ctx.restore();
    }
    for (const beam of this.beamStrikes) {
      if (!this.isOnScreen(beam.x, beam.y, beam.len + 20)) continue;
      const alpha = Math.max(0, beam.timer / 0.28);
      ctx.save();
      ctx.translate(beam.x, beam.y);
      ctx.rotate(beam.angle);
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = beam.color;
      ctx.fillRect(0, -beam.width / 2, beam.len, beam.width);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -beam.width / 6, beam.len, beam.width / 3);
      ctx.restore();
    }

    // 9. Draw Particles (culled; no save/restore needed)
    for (const pt of this.pool.particles) {
      if (!pt.active) continue;
      if (!this.isOnScreen(pt.x, pt.y, 12)) continue;
      const alpha = Math.max(0, 1 - pt.life / pt.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 10. Draw Floating Damage Numbers (culled; shared font, batched by style)
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#000000';
    let critFont = false;
    for (const d of this.pool.damageNumbers) {
      if (!d.active) continue;
      if (!this.isOnScreen(d.x, d.y, 30)) continue;
      if (d.isCrit !== critFont) {
        critFont = d.isCrit;
        ctx.font = critFont ? 'italic 900 17px monospace, sans-serif' : 'italic 900 13px monospace, sans-serif';
      }
      const alpha = Math.max(0, 1 - d.life / d.maxLife);
      ctx.globalAlpha = alpha;
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillStyle = d.color;
      ctx.fillText(d.text, d.x, d.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // 11. Draw Screen Hit Vignette (Red border flash on hurt)
    if (this.hitVignetteTimer > 0) {
      const alpha = (this.hitVignetteTimer / 0.25) * 0.45;
      ctx.save();
      ctx.fillStyle = `rgba(220, 38, 38, ${alpha})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  private cullLeft = 0;
  private cullRight = 0;
  private cullTop = 0;
  private cullBottom = 0;

  private isOnScreen(x: number, y: number, margin: number): boolean {
    return (
      x >= this.cullLeft - margin &&
      x <= this.cullRight + margin &&
      y >= this.cullTop - margin &&
      y <= this.cullBottom + margin
    );
  }

  private renderFloor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Pre-rendered 96px tile (grid lines + 3 glow dots) blitted as a pattern.
    // Replaces ~600 arc()/stroke() calls per frame with ONE fillRect.
    if (!this.floorPattern) {
      const tile = document.createElement('canvas');
      const size = 96;
      const scale = this.dpr;
      tile.width = size * scale;
      tile.height = size * scale;
      const tctx = tile.getContext('2d')!;
      tctx.scale(scale, scale);

      // Grid boundary lines (top + left edges of tile)
      tctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
      tctx.lineWidth = 1;
      tctx.beginPath();
      tctx.moveTo(0.5, 0);
      tctx.lineTo(0.5, size);
      tctx.moveTo(0, 0.5);
      tctx.lineTo(size, 0.5);
      tctx.stroke();

      // Cyan dots every 32px (offset to match tile-center alignment)
      tctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
      for (let x = 16; x < size; x += 32) {
        for (let y = 16; y < size; y += 32) {
          tctx.beginPath();
          tctx.arc(x, y, 1.2, 0, Math.PI * 2);
          tctx.fill();
        }
      }

      this.floorPattern = ctx.createPattern(tile, 'repeat');
    }

    if (this.floorPattern) {
      // Patterns are transformed by the current CTM, so filling the visible
      // world rect keeps the grid locked to world space automatically.
      ctx.fillStyle = this.floorPattern;
      ctx.fillRect(this.cullLeft, this.cullTop, width + 160, height + 160);
    }
  }

  private renderEnemyProjectiles(ctx: CanvasRenderingContext2D) {
    for (const ep of this.pool.enemyProjectiles) {
      if (!ep.active) continue;
      if (!this.isOnScreen(ep.x, ep.y, ep.radius * 3 + 20)) continue;

      ctx.save();
      ctx.translate(ep.x, ep.y);

      const angle = Math.atan2(ep.vy, ep.vx);
      ctx.rotate(angle);

      // Cheap 2-stop cached gradients instead of 4-stop per-frame gradients.
      // (Gradients are created per-draw below only when a projectile is on
      // screen; the shadowBlur halo was replaced by a translucent circle.)
      if (ep.type === 'fireball') {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, ep.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, ep.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.55, '#fef08a');
        grad.addColorStop(1, '#dc2626');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, ep.radius, 0, Math.PI * 2);
        ctx.fill();

        // Flame Trail Spikes
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(-ep.radius * 0.8, -ep.radius * 0.6);
        ctx.lineTo(-ep.radius * 2.2, 0);
        ctx.lineTo(-ep.radius * 0.8, ep.radius * 0.6);
        ctx.closePath();
        ctx.fill();
      } else if (ep.type === 'toxic_orb') {
        // Toxic Slime Orb
        ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, ep.radius * 1.4, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, ep.radius);
        grad.addColorStop(0, '#d1fae5');
        grad.addColorStop(1, '#065f46');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, ep.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (ep.type === 'void_orb') {
        // Void Dark Orb
        ctx.fillStyle = 'rgba(124, 58, 237, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, ep.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, ep.radius);
        grad.addColorStop(0, '#f3e8ff');
        grad.addColorStop(1, '#1e1b4b');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, ep.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (ep.type === 'scythe_wave') {
        // Crescent Death Scythe Wave
        ctx.fillStyle = '#e9d5ff';
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.arc(0, 0, ep.radius * 1.6, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.quadraticCurveTo(ep.radius * 0.4, 0, Math.cos(-Math.PI * 0.45) * ep.radius * 1.6, Math.sin(-Math.PI * 0.45) * ep.radius * 1.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Shockwave Orb
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, ep.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Invulnerability blink
    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Walking bob & tilt
    const isMoving = Math.hypot(p.vx, p.vy) > 10;
    const bob = isMoving ? Math.sin(p.walkCycle) * 3 : Math.sin(this.timeSurvived * 3) * 1.2;
    const legSwing = isMoving ? Math.sin(p.walkCycle) * 6 : 0;

    // Outer runic aura ring (pulsing with level) — themed by selected character
    const T = this.characterTheme;
    ctx.save();
    ctx.strokeStyle = T.trim + '66';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.shadowColor = T.glow;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 4, p.radius + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Orbiting celestial mana motes based on character level
    const moteCount = Math.min(4, Math.floor(this.level / 2) + 1);
    for (let m = 0; m < moteCount; m++) {
      const mAngle = this.timeSurvived * 3.5 + (m * Math.PI * 2) / moteCount;
      const mDist = p.radius + 18;
      const mx = Math.cos(mAngle) * mDist;
      const my = Math.sin(mAngle) * (mDist * 0.45) + 2;

      ctx.save();
      ctx.fillStyle = T.trim;
      ctx.shadowColor = T.glow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 18, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flip if facing left
    if (p.facingLeft) {
      ctx.scale(-1, 1);
    }

    // 1. Flowing Royal Cape (Rippling backwards behind hero)
    ctx.save();
    const capeFlutter = isMoving ? Math.sin(p.walkCycle * 1.5) * 5 : Math.sin(this.timeSurvived * 4) * 2;
    ctx.fillStyle = T.cape;
    ctx.beginPath();
    ctx.moveTo(-6, bob - 2);
    ctx.quadraticCurveTo(-16 - (isMoving ? 8 : 2), bob + 10 + capeFlutter, -14 - (isMoving ? 12 : 3), bob + 20 + capeFlutter);
    ctx.lineTo(-4, bob + 18 + capeFlutter * 0.5);
    ctx.lineTo(2, bob + 4);
    ctx.closePath();
    ctx.fill();

    // Themed trim on Cape
    ctx.strokeStyle = T.trim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 2. Armored Legs & Boots
    ctx.fillStyle = '#1e293b'; // Slate armor
    // Left Leg / Boot
    ctx.fillRect(-7, bob + 9 - legSwing * 0.4, 5, 8 + legSwing * 0.5);
    // Right Leg / Boot
    ctx.fillRect(2, bob + 9 + legSwing * 0.4, 5, 8 - legSwing * 0.5);

    // Boot Greave Caps (themed glow runes)
    ctx.fillStyle = T.boot;
    ctx.fillRect(-8, bob + 14 - legSwing * 0.4, 6, 2.5);
    ctx.fillRect(1, bob + 14 + legSwing * 0.4, 6, 2.5);

    // 3. Knight Cuirass / Torso Plate
    ctx.save();
    ctx.shadowColor = T.glow;
    ctx.shadowBlur = 12;

    // Steel Chestplate (themed)
    ctx.fillStyle = T.cape;
    ctx.beginPath();
    ctx.roundRect(-10, bob - 6, 20, 16, 4);
    ctx.fill();

    ctx.strokeStyle = T.boot;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Themed Armor Trim & Shoulder Pauldrons
    ctx.fillStyle = T.accent;
    // Left shoulder pauldron
    ctx.beginPath();
    ctx.arc(-11, bob - 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Right shoulder pauldron
    ctx.beginPath();
    ctx.arc(11, bob - 4, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Arcane Chest Crest (Pulsing Diamond Mana Core)
    ctx.fillStyle = T.trim;
    ctx.beginPath();
    ctx.moveTo(0, bob - 4);
    ctx.lineTo(4, bob);
    ctx.lineTo(0, bob + 4);
    ctx.lineTo(-4, bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, bob, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Heroic Hood & Visor Helmet
    ctx.save();
    // Dark Rogue Cowl Hood
    ctx.fillStyle = T.cape;
    ctx.beginPath();
    ctx.arc(0, bob - 10, 11, 0, Math.PI * 2);
    ctx.fill();

    // Steel Face Visor
    ctx.fillStyle = '#334155';
    ctx.fillRect(-6, bob - 12, 12, 6);

    // Piercing Neon Warrior Slit Eyes (themed)
    ctx.fillStyle = T.trim;
    ctx.shadowColor = T.glow;
    ctx.shadowBlur = 10;
    ctx.fillRect(1, bob - 11, 6, 2.5);

    // Visor eye shine
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, bob - 11, 2, 2.5);
    ctx.restore();

    // 5. Heroic Runic Blade (Held in front hand)
    ctx.save();
    const swordSwing = isMoving ? Math.sin(p.walkCycle) * 0.2 : 0;
    ctx.translate(11, bob + 2);
    ctx.rotate(0.35 + swordSwing);

    // Crossguard (Gold)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-4, -1, 8, 2.5);

    // Leather Grip & Pommel
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-1.5, 1.5, 3, 5);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(0, 7.5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Gleaming Runic Steel Blade (themed glow)
    ctx.shadowColor = T.boot;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(-2.5, -1);
    ctx.lineTo(0, -22); // Sharp blade tip
    ctx.lineTo(2.5, -1);
    ctx.closePath();
    ctx.fill();

    // Inner glowing themed blade fuller/rune
    ctx.fillStyle = T.accent;
    ctx.fillRect(-0.8, -16, 1.6, 14);
    ctx.fillStyle = T.boot;
    ctx.fillRect(-0.4, -14, 0.8, 10);
    ctx.restore();

    ctx.restore();
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: EnemyEntity) {
    ctx.save();
    ctx.translate(e.x, e.y);

    // Face towards player
    const facing = e.x > this.player.x ? -1 : 1;
    ctx.scale(facing, 1);

    // Damage flash (white silhouette)
    const isFlashing = e.hitFlashTimer > 0;

    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.9, e.radius * 0.85, e.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Walking / bobbing cycle
    const bob = Math.sin(e.animTimer) * 2.5;
    const r = e.radius;

    if (isFlashing) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
    }

    // ==========================================
    // 1. BAT (خفاش مصاص الدماء)
    // ==========================================
    if (e.category === 'bat') {
      const wingSpread = Math.sin(e.animTimer * 2) * (r * 0.7);

      // Leathery Bat Wings
      ctx.fillStyle = isFlashing ? '#ffffff' : '#3b0764';
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#581c87';
      ctx.lineWidth = 1.5;

      // Left Wing
      ctx.beginPath();
      ctx.moveTo(-2, bob - 2);
      ctx.quadraticCurveTo(-r * 1.2, bob - r * 1.3 - wingSpread, -r * 2.2, bob - wingSpread * 0.5);
      ctx.quadraticCurveTo(-r * 1.5, bob + r * 0.4, -r * 1.0, bob + r * 0.1);
      ctx.quadraticCurveTo(-r * 0.6, bob + r * 0.5, -2, bob + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right Wing
      ctx.beginPath();
      ctx.moveTo(2, bob - 2);
      ctx.quadraticCurveTo(r * 1.2, bob - r * 1.3 - wingSpread, r * 2.2, bob - wingSpread * 0.5);
      ctx.quadraticCurveTo(r * 1.5, bob + r * 0.4, r * 1.0, bob + r * 0.1);
      ctx.quadraticCurveTo(r * 0.6, bob + r * 0.5, 2, bob + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Furry Torso
      ctx.fillStyle = isFlashing ? '#ffffff' : '#581c87';
      ctx.beginPath();
      ctx.ellipse(0, bob, r * 0.7, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head & Pointed Ears
      ctx.fillStyle = isFlashing ? '#ffffff' : '#6b21a8';
      // Left Ear
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, bob - r * 0.5);
      ctx.lineTo(-r * 0.7, bob - r * 1.4);
      ctx.lineTo(-r * 0.2, bob - r * 0.8);
      ctx.closePath();
      ctx.fill();
      // Right Ear
      ctx.beginPath();
      ctx.moveTo(r * 0.5, bob - r * 0.5);
      ctx.lineTo(r * 0.7, bob - r * 1.4);
      ctx.lineTo(r * 0.2, bob - r * 0.8);
      ctx.closePath();
      ctx.fill();

      // Bat Eyes (Glowing Red)
      if (!isFlashing) {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(r * 0.25, bob - 2, 2, 0, Math.PI * 2);
        ctx.arc(-r * 0.25, bob - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Tiny fangs
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(-2, bob + 3);
        ctx.lineTo(-1, bob + 6);
        ctx.lineTo(0, bob + 3);
        ctx.moveTo(1, bob + 3);
        ctx.lineTo(2, bob + 6);
        ctx.lineTo(3, bob + 3);
        ctx.fill();
      }
    }

    // ==========================================
    // 2. ZOMBIE (زومبي العفن والموتى)
    // ==========================================
    else if (e.category === 'zombie') {
      const legSwing = Math.sin(e.animTimer * 1.5) * 4;
      const armReach = Math.cos(e.animTimer * 1.5) * 3;

      // Shuffling legs
      ctx.fillStyle = isFlashing ? '#ffffff' : '#1e293b';
      ctx.fillRect(-r * 0.5, bob + r * 0.5, r * 0.4, r * 0.5 + legSwing);
      ctx.fillRect(r * 0.1, bob + r * 0.5, r * 0.4, r * 0.5 - legSwing);

      // Tattered ragged shirt
      ctx.fillStyle = isFlashing ? '#ffffff' : '#334155';
      ctx.beginPath();
      ctx.roundRect(-r * 0.65, bob - r * 0.3, r * 1.3, r * 1.0, 4);
      ctx.fill();

      // Rotting green skin torso patch
      if (!isFlashing) {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-r * 0.3, bob + r * 0.1, r * 0.4, r * 0.3);
      }

      // Reaching zombie arms
      ctx.fillStyle = isFlashing ? '#ffffff' : '#16a34a';
      ctx.beginPath();
      // Forward outstretched arm with clawed hand
      ctx.roundRect(r * 0.2, bob - r * 0.2 + armReach, r * 0.9, r * 0.35, 3);
      ctx.fill();
      // Back arm
      ctx.beginPath();
      ctx.roundRect(-r * 0.2, bob - r * 0.1 - armReach, r * 0.8, r * 0.3, 3);
      ctx.fill();

      // Grotesque Zombie Head
      ctx.fillStyle = isFlashing ? '#ffffff' : '#4ade80';
      ctx.beginPath();
      ctx.roundRect(-r * 0.55, bob - r * 1.2, r * 1.1, r * 0.95, 5);
      ctx.fill();

      // Stitched brow & scars
      if (!isFlashing) {
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, bob - r * 1.0);
        ctx.lineTo(r * 0.2, bob - r * 0.9);
        ctx.stroke();

        // Eyes: One bulging yellow dead eye, one sunken socket
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(r * 0.2, bob - r * 0.75, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(r * 0.2, bob - r * 0.75, 1, 0, Math.PI * 2);
        ctx.arc(-r * 0.25, bob - r * 0.75, 2, 0, Math.PI * 2);
        ctx.fill();

        // Jagged gaping mouth with yellow teeth
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-r * 0.25, bob - r * 0.45, r * 0.55, 3);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-r * 0.15, bob - r * 0.45, 2, 2.5);
        ctx.fillRect(r * 0.05, bob - r * 0.45, 2, 2.5);
      }
    }

    // ==========================================
    // 3. SKELETON (محارب الهيكل العظمي)
    // ==========================================
    else if (e.category === 'skeleton') {
      const legStride = Math.sin(e.animTimer * 1.8) * 3;

      // Bone Legs
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#e2e8f0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, bob + r * 0.4);
      ctx.lineTo(-r * 0.4, bob + r * 0.9 + legStride);
      ctx.moveTo(r * 0.3, bob + r * 0.4);
      ctx.lineTo(r * 0.4, bob + r * 0.9 - legStride);
      ctx.stroke();

      // Rib Cage & Spine
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Spine
      ctx.moveTo(0, bob - r * 0.3);
      ctx.lineTo(0, bob + r * 0.4);
      // Ribs
      ctx.moveTo(-r * 0.45, bob - r * 0.15);
      ctx.lineTo(r * 0.45, bob - r * 0.15);
      ctx.moveTo(-r * 0.4, bob + r * 0.05);
      ctx.lineTo(r * 0.4, bob + r * 0.05);
      ctx.moveTo(-r * 0.35, bob + r * 0.25);
      ctx.lineTo(r * 0.35, bob + r * 0.25);
      ctx.stroke();

      // Bone Skull
      ctx.fillStyle = isFlashing ? '#ffffff' : '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(-r * 0.5, bob - r * 1.1, r * 1.0, r * 0.85, 4);
      ctx.fill();

      // Jawbone
      ctx.beginPath();
      ctx.roundRect(-r * 0.3, bob - r * 0.35, r * 0.6, r * 0.3, 2);
      ctx.fill();

      // Rusted Ancient Broadsword
      ctx.save();
      ctx.translate(r * 0.5, bob - r * 0.1);
      ctx.rotate(0.3 + Math.sin(e.animTimer * 1.8) * 0.15);
      // Crossguard
      ctx.fillStyle = isFlashing ? '#ffffff' : '#78350f';
      ctx.fillRect(-3, -2, 6, 4);
      // Steel Blade
      ctx.fillStyle = isFlashing ? '#ffffff' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.lineTo(-2, -r * 1.3);
      ctx.lineTo(0, -r * 1.6);
      ctx.lineTo(2, -r * 1.3);
      ctx.lineTo(2, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Soul Fire Eyes
      if (!isFlashing) {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 6;
        ctx.fillRect(-r * 0.3, bob - r * 0.75, 3, 3);
        ctx.fillRect(r * 0.1, bob - r * 0.75, 3, 3);

        // Nasal Cavity & Teeth notches
        ctx.fillStyle = '#0f172a';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(0, bob - r * 0.55);
        ctx.lineTo(-1.5, bob - r * 0.45);
        ctx.lineTo(1.5, bob - r * 0.45);
        ctx.fill();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, bob - r * 0.25);
        ctx.lineTo(-3, bob - r * 0.15);
        ctx.moveTo(0, bob - r * 0.25);
        ctx.lineTo(0, bob - r * 0.15);
        ctx.moveTo(3, bob - r * 0.25);
        ctx.lineTo(3, bob - r * 0.15);
        ctx.stroke();
      }
    }

    // ==========================================
    // 4. GHOST (الشبح الطيفي المعذب)
    // ==========================================
    else if (e.category === 'ghost') {
      const ghostSway = Math.sin(e.animTimer * 1.5) * 5;
      const tailRipple = Math.cos(e.animTimer * 1.5) * 4;

      if (!isFlashing) {
        ctx.globalAlpha = 0.85;
      }

      // Ethereal Aura Glow
      ctx.fillStyle = isFlashing ? '#ffffff' : '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;

      // Flowing Spirit Robe / Shroud
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, bob - r * 0.6);
      ctx.quadraticCurveTo(-r * 0.8, bob - r * 1.2, 0, bob - r * 1.2);
      ctx.quadraticCurveTo(r * 0.8, bob - r * 1.2, r * 0.7, bob - r * 0.6);
      ctx.lineTo(r * 0.8, bob + r * 0.5);
      // Tattered wispy ghost tails
      ctx.quadraticCurveTo(r * 0.4, bob + r * 0.3 + ghostSway, r * 0.1, bob + r * 0.9 + tailRipple);
      ctx.quadraticCurveTo(-r * 0.2, bob + r * 0.4 - ghostSway, -r * 0.5, bob + r * 0.8 - tailRipple);
      ctx.quadraticCurveTo(-r * 0.7, bob + r * 0.4, -r * 0.7, bob - r * 0.6);
      ctx.closePath();
      ctx.fill();

      // Shadowed Cowl Void & Glowing Soul Eyes
      if (!isFlashing) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, bob - r * 0.55, r * 0.45, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Piercing Cyan Soul Flame Eyes
        ctx.fillStyle = '#67e8f9';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-r * 0.2, bob - r * 0.65, 2.5, 0, Math.PI * 2);
        ctx.arc(r * 0.2, bob - r * 0.65, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Agonized wailing mouth
        ctx.fillStyle = '#020617';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, bob - r * 0.38, 2.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    // ==========================================
    // 5. ORC BERSERKER (وحش الأورك المحارب المدرع)
    // ==========================================
    else if (e.category === 'orc') {
      const stomp = Math.sin(e.animTimer * 2) * 3;

      // Heavy Muscular Legs
      ctx.fillStyle = isFlashing ? '#ffffff' : '#713f12';
      ctx.fillRect(-r * 0.65, bob + r * 0.4, r * 0.5, r * 0.6 + stomp);
      ctx.fillRect(r * 0.15, bob + r * 0.4, r * 0.5, r * 0.6 - stomp);

      // Bulky Green Orc Torso
      ctx.fillStyle = isFlashing ? '#ffffff' : '#15803d';
      ctx.beginPath();
      ctx.roundRect(-r * 0.8, bob - r * 0.4, r * 1.6, r * 1.0, 6);
      ctx.fill();

      // Iron Studded Shoulder Pauldron
      ctx.fillStyle = isFlashing ? '#ffffff' : '#475569';
      ctx.beginPath();
      ctx.roundRect(-r * 0.95, bob - r * 0.4, r * 0.5, r * 0.6, 3);
      ctx.fill();

      // Brutish Orc Head
      ctx.fillStyle = isFlashing ? '#ffffff' : '#16a34a';
      ctx.beginPath();
      ctx.roundRect(-r * 0.6, bob - r * 1.25, r * 1.2, r * 0.95, 6);
      ctx.fill();

      // Riveted Iron Helmet / Spikes
      ctx.fillStyle = isFlashing ? '#ffffff' : '#334155';
      ctx.beginPath();
      ctx.arc(0, bob - r * 1.15, r * 0.65, Math.PI, 0);
      ctx.lineTo(r * 0.65, bob - r * 0.95);
      ctx.lineTo(-r * 0.65, bob - r * 0.95);
      ctx.closePath();
      ctx.fill();

      // Helmet Spike
      ctx.fillStyle = isFlashing ? '#ffffff' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-3, bob - r * 1.55);
      ctx.lineTo(0, bob - r * 1.95);
      ctx.lineTo(3, bob - r * 1.55);
      ctx.closePath();
      ctx.fill();

      // Giant Spiked Morningstar / Mace
      ctx.save();
      ctx.translate(r * 0.9, bob - r * 0.2);
      ctx.rotate(0.4 + Math.sin(e.animTimer * 2) * 0.2);
      // Shaft
      ctx.fillStyle = isFlashing ? '#ffffff' : '#78350f';
      ctx.fillRect(-2, -r * 1.0, 4, r * 1.2);
      // Spiked Iron Ball
      ctx.fillStyle = isFlashing ? '#ffffff' : '#475569';
      ctx.beginPath();
      ctx.arc(0, -r * 1.0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      // Mace Spikes
      ctx.fillStyle = isFlashing ? '#ffffff' : '#cbd5e1';
      for (let sp = 0; sp < 4; sp++) {
        const a = (sp * Math.PI) / 2;
        ctx.fillRect(Math.cos(a) * (r * 0.45) - 1.5, -r * 1.0 + Math.sin(a) * (r * 0.45) - 1.5, 3, 3);
      }
      ctx.restore();

      // Menacing Facial Details (Tusks & Warpaint)
      if (!isFlashing) {
        // Red Warpaint
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-r * 0.4, bob - r * 0.85, r * 0.8, 2.5);

        // Angry yellow eyes
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(-r * 0.2, bob - r * 0.75, 2, 0, Math.PI * 2);
        ctx.arc(r * 0.2, bob - r * 0.75, 2, 0, Math.PI * 2);
        ctx.fill();

        // Large Upward-Curving Tusks
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, bob - r * 0.35);
        ctx.lineTo(-r * 0.45, bob - r * 0.65);
        ctx.lineTo(-r * 0.25, bob - r * 0.4);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(r * 0.35, bob - r * 0.35);
        ctx.lineTo(r * 0.45, bob - r * 0.65);
        ctx.lineTo(r * 0.25, bob - r * 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ==========================================
    // 5.5. FIRE MAGE (ساحر النيران المتجول)
    // ==========================================
    else if (e.category === 'fire_mage') {
      const float = Math.sin(e.animTimer * 2.0) * 4;

      // Swirling fiery ground embers
      ctx.save();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.9, r * 0.9 + Math.sin(e.animTimer * 3) * 3, r * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Flowing Crimson & Charcoal Sorcerer Robe
      ctx.fillStyle = isFlashing ? '#ffffff' : '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, bob - r * 0.5 + float);
      ctx.lineTo(-r * 0.9, bob + r * 0.85 + float);
      ctx.quadraticCurveTo(0, bob + r * 1.0 + float, r * 0.9, bob + r * 0.85 + float);
      ctx.lineTo(r * 0.7, bob - r * 0.5 + float);
      ctx.closePath();
      ctx.fill();

      // Molten orange robe hem trim
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#f97316';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sorcerer Cowl Hood
      ctx.fillStyle = isFlashing ? '#ffffff' : '#450a0a';
      ctx.beginPath();
      ctx.roundRect(-r * 0.6, bob - r * 1.3 + float, r * 1.2, r * 0.9, 6);
      ctx.fill();

      // Pointed Hood Crest
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, bob - r * 1.1 + float);
      ctx.lineTo(0, bob - r * 1.6 + float);
      ctx.lineTo(r * 0.5, bob - r * 1.1 + float);
      ctx.closePath();
      ctx.fill();

      // Glowing Magma Eyes
      if (!isFlashing) {
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-r * 0.22, bob - r * 0.9 + float, 2.5, 0, Math.PI * 2);
        ctx.arc(r * 0.22, bob - r * 0.9 + float, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flaming Catalyst Staff
      ctx.save();
      ctx.translate(r * 0.85, bob - r * 0.3 + float);
      ctx.rotate(0.15 + Math.sin(e.animTimer * 2) * 0.1);

      // Dark Wood Staff
      ctx.fillStyle = isFlashing ? '#ffffff' : '#292524';
      ctx.fillRect(-2, -r * 1.3, 4, r * 2.0);

      // Floating Burning Pyre Orb at Staff tip
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 14;
      ctx.fillStyle = isFlashing ? '#ffffff' : '#ea580c';
      ctx.beginPath();
      ctx.arc(0, -r * 1.35, 6, 0, Math.PI * 2);
      ctx.fill();

      // Golden core inside orb
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -r * 1.35, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ==========================================
    // 6. MINOTAUR BOSS & VARIANTS
    // ==========================================
    else if (e.category === 'minotaur_boss') {
      const stomp = Math.sin(e.animTimer * 1.6) * 4;
      const isGhoulKing = (e.bossName && e.bossName.includes('Ghoul')) || (e.bossNameAr && e.bossNameAr.includes('الغيلان'));
      const isAbyssal = (e.bossName && e.bossName.includes('Abyssal')) || (e.bossNameAr && e.bossNameAr.includes('الأعماق'));

      if (isGhoulKing) {
        // Toxic Armored Ghoul King (ملك الغيلان السام)
        ctx.save();
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.9, r * 1.4 + Math.sin(e.animTimer * 3) * 6, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Rotting Spiked Armor & Body
        ctx.fillStyle = isFlashing ? '#ffffff' : '#064e3b';
        ctx.beginPath();
        ctx.roundRect(-r * 0.9, bob - r * 0.5, r * 1.8, r * 1.1, 8);
        ctx.fill();

        // Spiked Iron Pauldrons
        ctx.fillStyle = isFlashing ? '#ffffff' : '#1e293b';
        ctx.fillRect(-r * 1.1, bob - r * 0.5, r * 0.5, r * 0.6);
        ctx.fillRect(r * 0.6, bob - r * 0.5, r * 0.5, r * 0.6);

        // Ghoul King Head & Bone Crown
        ctx.fillStyle = isFlashing ? '#ffffff' : '#047857';
        ctx.beginPath();
        ctx.roundRect(-r * 0.7, bob - r * 1.4, r * 1.4, r * 1.0, 6);
        ctx.fill();

        // Spiked Crown of Bones
        ctx.fillStyle = isFlashing ? '#ffffff' : '#fef08a';
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, bob - r * 1.4);
        ctx.lineTo(-r * 0.4, bob - r * 2.0);
        ctx.lineTo(-r * 0.2, bob - r * 1.4);
        ctx.lineTo(0, bob - r * 2.2);
        ctx.lineTo(r * 0.2, bob - r * 1.4);
        ctx.lineTo(r * 0.4, bob - r * 2.0);
        ctx.lineTo(r * 0.6, bob - r * 1.4);
        ctx.closePath();
        ctx.fill();

        // Poison Dripping Cleaver
        ctx.save();
        ctx.translate(r * 1.1, bob - r * 0.4);
        ctx.rotate(0.35 + Math.sin(e.animTimer * 1.8) * 0.2);
        ctx.fillStyle = isFlashing ? '#ffffff' : '#334155';
        ctx.fillRect(-3, -r * 1.3, 6, r * 2.0);
        ctx.fillStyle = isFlashing ? '#ffffff' : '#10b981';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 12;
        ctx.fillRect(0, -r * 1.3, r * 0.8, r * 1.4);
        ctx.restore();

        // Toxic Green Eyes
        if (!isFlashing) {
          ctx.fillStyle = '#34d399';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(-r * 0.3, bob - r * 0.95, 3.5, 0, Math.PI * 2);
          ctx.arc(r * 0.3, bob - r * 0.95, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (isAbyssal) {
        // Volcanic Abyssal Behemoth (طاغوت الأعماق البركاني)
        ctx.save();
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.7)';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.9, r * 1.5 + Math.sin(e.animTimer * 3) * 6, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Obsidian Magma Body
        ctx.fillStyle = isFlashing ? '#ffffff' : '#1c1917';
        ctx.beginPath();
        ctx.roundRect(-r * 0.95, bob - r * 0.55, r * 1.9, r * 1.2, 10);
        ctx.fill();

        // Glowing Magma Fissures
        ctx.strokeStyle = isFlashing ? '#ffffff' : '#f97316';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, bob - r * 0.2);
        ctx.lineTo(0, bob + r * 0.2);
        ctx.lineTo(r * 0.5, bob - r * 0.1);
        ctx.stroke();

        // Molten Obsidian Horns
        ctx.fillStyle = isFlashing ? '#ffffff' : '#ea580c';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, bob - r * 1.3);
        ctx.lineTo(-r * 1.6, bob - r * 2.3);
        ctx.lineTo(-r * 0.2, bob - r * 1.5);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(r * 0.5, bob - r * 1.3);
        ctx.lineTo(r * 1.6, bob - r * 2.3);
        ctx.lineTo(r * 0.2, bob - r * 1.5);
        ctx.closePath();
        ctx.fill();

        // Fiery Volcanic Warhammer
        ctx.save();
        ctx.translate(r * 1.15, bob - r * 0.4);
        ctx.rotate(0.4 + Math.sin(e.animTimer * 1.5) * 0.2);
        ctx.fillStyle = isFlashing ? '#ffffff' : '#292524';
        ctx.fillRect(-4, -r * 1.6, 8, r * 2.4);
        ctx.fillStyle = isFlashing ? '#ffffff' : '#ea580c';
        ctx.fillRect(-r * 0.7, -r * 1.6, r * 1.4, r * 0.8);
        ctx.restore();

        // Blazing Fiery Eyes
        if (!isFlashing) {
          ctx.fillStyle = '#fef08a';
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(-r * 0.35, bob - r * 0.95, 4, 0, Math.PI * 2);
          ctx.arc(r * 0.35, bob - r * 0.95, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Default Crypt Minotaur (مينوتور السراديب)
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.9, r * 1.4 + Math.sin(e.animTimer * 3) * 6, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Muscular Hooves & Legs
        ctx.fillStyle = isFlashing ? '#ffffff' : '#451a03';
        ctx.fillRect(-r * 0.75, bob + r * 0.4, r * 0.6, r * 0.7 + stomp);
        ctx.fillRect(r * 0.15, bob + r * 0.4, r * 0.6, r * 0.7 - stomp);

        // Iron Hooves
        ctx.fillStyle = isFlashing ? '#ffffff' : '#1e293b';
        ctx.fillRect(-r * 0.8, bob + r * 1.0 + stomp, r * 0.7, 5);
        ctx.fillRect(r * 0.1, bob + r * 1.0 - stomp, r * 0.7, 5);

        // Hulking Beast Torso
        ctx.fillStyle = isFlashing ? '#ffffff' : '#78350f';
        ctx.beginPath();
        ctx.roundRect(-r * 0.9, bob - r * 0.5, r * 1.8, r * 1.1, 8);
        ctx.fill();

        // Armored Chestplate
        ctx.fillStyle = isFlashing ? '#ffffff' : '#1e293b';
        ctx.beginPath();
        ctx.roundRect(-r * 0.6, bob - r * 0.35, r * 1.2, r * 0.7, 4);
        ctx.fill();

        // Colossal Bull Head
        ctx.fillStyle = isFlashing ? '#ffffff' : '#92400e';
        ctx.beginPath();
        ctx.roundRect(-r * 0.75, bob - r * 1.4, r * 1.5, r * 1.0, 8);
        ctx.fill();

        // Giant Obsidian & Gold Horns
        ctx.fillStyle = isFlashing ? '#ffffff' : '#0f172a';
        ctx.strokeStyle = isFlashing ? '#ffffff' : '#eab308';
        ctx.lineWidth = 3;

        // Left Horn
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, bob - r * 1.3);
        ctx.quadraticCurveTo(-r * 1.6, bob - r * 1.6, -r * 1.8, bob - r * 2.3);
        ctx.quadraticCurveTo(-r * 1.2, bob - r * 1.9, -r * 0.2, bob - r * 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right Horn
        ctx.beginPath();
        ctx.moveTo(r * 0.4, bob - r * 1.3);
        ctx.quadraticCurveTo(r * 1.6, bob - r * 1.6, r * 1.8, bob - r * 2.3);
        ctx.quadraticCurveTo(r * 1.2, bob - r * 1.9, r * 0.2, bob - r * 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Colossal Flaming Battleaxe
        ctx.save();
        ctx.translate(r * 1.1, bob - r * 0.4);
        ctx.rotate(0.3 + Math.sin(e.animTimer * 1.6) * 0.25);
        ctx.fillStyle = isFlashing ? '#ffffff' : '#451a03';
        ctx.fillRect(-3, -r * 1.5, 6, r * 2.2);
        ctx.fillStyle = isFlashing ? '#ffffff' : '#dc2626';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.2);
        ctx.quadraticCurveTo(r * 1.0, -r * 1.5, r * 0.9, -r * 0.8);
        ctx.lineTo(0, -r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.2);
        ctx.quadraticCurveTo(-r * 0.7, -r * 1.4, -r * 0.6, -r * 0.9);
        ctx.lineTo(0, -r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Flaming Eyes & Gold Nose Ring
        if (!isFlashing) {
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(-r * 0.35, bob - r * 0.95, 3.5, 0, Math.PI * 2);
          ctx.arc(r * 0.35, bob - r * 0.95, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(0, bob - r * 0.45, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // ==========================================
    // 7. REAPER BOSS & SHADOW OVERLORD
    // ==========================================
    else if (e.category === 'reaper_boss') {
      const floatWave = Math.sin(e.animTimer * 1.2) * 5;
      const isShadowOverlord = (e.bossName && e.bossName.includes('Shadow')) || (e.bossNameAr && e.bossNameAr.includes('الظلال'));

      if (isShadowOverlord) {
        // Void Shadow Overlord (حاكم الظلال الأكبر)
        ctx.save();
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.8)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.9, r * 1.6 + Math.sin(e.animTimer * 2) * 8, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Dark Void Nebula Mantle
        ctx.fillStyle = isFlashing ? '#ffffff' : '#1e1b4b';
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, bob - r * 0.8 + floatWave);
        ctx.quadraticCurveTo(0, bob - r * 1.8 + floatWave, r * 0.9, bob - r * 0.8 + floatWave);
        ctx.lineTo(r * 1.2, bob + r * 0.9 + floatWave);
        ctx.quadraticCurveTo(0, bob + r * 1.3 + floatWave, -r * 1.2, bob + r * 0.9 + floatWave);
        ctx.closePath();
        ctx.fill();

        // Crown of Shadow Spikes
        ctx.fillStyle = isFlashing ? '#ffffff' : '#a855f7';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 14;
        for (let sp = -2; sp <= 2; sp++) {
          ctx.beginPath();
          ctx.moveTo(sp * 8, bob - r * 1.4 + floatWave);
          ctx.lineTo(sp * 11, bob - r * 2.1 + floatWave - Math.abs(sp) * 4);
          ctx.lineTo(sp * 8 + 6, bob - r * 1.4 + floatWave);
          ctx.closePath();
          ctx.fill();
        }

        // Orbiting Void Catalysts
        for (let orb = 0; orb < 3; orb++) {
          const oAng = e.animTimer * 2.5 + (orb * Math.PI * 2) / 3;
          const ox = Math.cos(oAng) * (r * 1.3);
          const oy = bob + Math.sin(oAng) * (r * 0.6) + floatWave;
          ctx.fillStyle = '#c084fc';
          ctx.shadowColor = '#9333ea';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(ox, oy, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Glowing Purple Void Eyes
        if (!isFlashing) {
          ctx.fillStyle = '#f3e8ff';
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(-r * 0.25, bob - r * 1.1 + floatWave, 3.5, 0, Math.PI * 2);
          ctx.arc(r * 0.25, bob - r * 1.1 + floatWave, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Grim Reaper of Eternity (ملك الموت الأبدي)
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.9, r * 1.5 + Math.sin(e.animTimer * 2) * 8, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Swirling Pitch-Black Robes
        ctx.fillStyle = isFlashing ? '#ffffff' : '#090d16';
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, bob - r * 0.8 + floatWave);
        ctx.quadraticCurveTo(-r * 1.1, bob - r * 1.4, 0, bob - r * 1.5 + floatWave);
        ctx.quadraticCurveTo(r * 1.1, bob - r * 1.4, r * 0.85, bob - r * 0.8 + floatWave);
        ctx.lineTo(r * 1.1, bob + r * 0.8 + floatWave);
        ctx.quadraticCurveTo(r * 0.4, bob + r * 0.5 + floatWave, 0, bob + r * 1.1 + floatWave);
        ctx.quadraticCurveTo(-r * 0.5, bob + r * 0.6 + floatWave, -r * 1.1, bob + r * 0.8 + floatWave);
        ctx.closePath();
        ctx.fill();

        // Deep Cowl Hood
        ctx.fillStyle = isFlashing ? '#ffffff' : '#030712';
        ctx.beginPath();
        ctx.roundRect(-r * 0.7, bob - r * 1.6 + floatWave, r * 1.4, r * 1.1, 8);
        ctx.fill();

        // Inner Void Face with Skeletal Features
        ctx.fillStyle = isFlashing ? '#ffffff' : '#000000';
        ctx.beginPath();
        ctx.ellipse(0, bob - r * 1.05 + floatWave, r * 0.45, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Majestic Curved Silver Death Scythe
        ctx.save();
        ctx.translate(r * 0.9, bob - r * 0.6 + floatWave);
        ctx.rotate(0.2 + Math.sin(e.animTimer * 1.2) * 0.15);

        ctx.fillStyle = isFlashing ? '#ffffff' : '#334155';
        ctx.fillRect(-3, -r * 1.8, 6, r * 2.8);

        ctx.fillStyle = isFlashing ? '#ffffff' : '#e2e8f0';
        ctx.strokeStyle = isFlashing ? '#ffffff' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.8);
        ctx.quadraticCurveTo(-r * 1.8, -r * 2.2, -r * 2.2, -r * 1.2);
        ctx.quadraticCurveTo(-r * 1.6, -r * 1.6, 0, -r * 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Dual Blazing Cyan Soul Flames
        if (!isFlashing) {
          ctx.fillStyle = '#38bdf8';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(-r * 0.22, bob - r * 1.1 + floatWave, 3.5, 0, Math.PI * 2);
          ctx.arc(r * 0.22, bob - r * 1.1 + floatWave, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Fallback for any unknown category: stylized armored demon
    else {
      ctx.fillStyle = isFlashing ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.roundRect(-r * 0.8, bob - r * 0.8, r * 1.6, r * 1.6, 6);
      ctx.fill();

      if (!isFlashing) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-r * 0.4, bob - 2, 4, 4);
        ctx.fillRect(r * 0.2, bob - 2, 4, 4);
      }
    }

    // Mini Health Bar for Bosses and damaged enemies
    if (e.hp < e.maxHp) {
      const barW = Math.max(28, r * 1.8);
      const barH = e.isBoss ? 6 : 4;
      const barY = bob - r * 1.4 - 10;
      const hpPct = Math.max(0, e.hp / e.maxHp);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(-barW / 2, barY, barW, barH);

      ctx.fillStyle = e.isBoss ? '#f59e0b' : '#22c55e';
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barW / 2, barY, barW, barH);
    }

    ctx.restore();
  }
}
