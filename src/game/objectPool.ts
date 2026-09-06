/**
 * High-Performance Object Pooling System
 * Eliminates garbage collection stutter when thousands of enemies, projectiles,
 * gems, damage numbers, and particles are spawned and despawned.
 */

import {
  DamageNumberEntity,
  EnemyCategory,
  EnemyEntity,
  EnemyProjectileEntity,
  GemEntity,
  ParticleEntity,
  ProjectileEntity,
  WeaponType,
} from '../types';

export class ObjectPoolSystem {
  public enemies: EnemyEntity[] = [];
  public projectiles: ProjectileEntity[] = [];
  public enemyProjectiles: EnemyProjectileEntity[] = [];
  public gems: GemEntity[] = [];
  public damageNumbers: DamageNumberEntity[] = [];
  public particles: ParticleEntity[] = [];

  private maxEnemies = 750;
  private maxProjectiles = 400;
  private maxEnemyProjectiles = 250;
  private maxGems = 600;
  private maxDamageNumbers = 150;
  private maxParticles = 300;

  // Rotating cursors: find the next free slot in O(1) amortized instead of
  // scanning the entire pool from index 0 every single spawn call.
  private enemyCursor = 0;
  private projectileCursor = 0;
  private enemyProjectileCursor = 0;
  private gemCursor = 0;
  private damageNumberCursor = 0;
  private particleCursor = 0;

  /** Adaptive quality: when true, spawn fewer cosmetic particles. */
  public lowQuality = false;

  constructor() {
    this.initPools();
  }

  private initPools() {
    // Pre-allocate Enemies
    for (let i = 0; i < this.maxEnemies; i++) {
      this.enemies.push({
        id: i,
        active: false,
        category: 'zombie',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 14,
        maxHp: 20,
        hp: 20,
        speed: 50,
        damage: 10,
        xpValue: 1,
        color: '#22c55e',
        hitFlashTimer: 0,
        isBoss: false,
        animTimer: 0,
        attackTimer: 0,
      });
    }

    // Pre-allocate Projectiles
    for (let i = 0; i < this.maxProjectiles; i++) {
      this.projectiles.push({
        id: i,
        active: false,
        weaponType: 'arcane_burst',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 6,
        damage: 25,
        life: 0,
        maxLife: 2,
        color: '#38bdf8',
        pierce: 1,
        angle: 0,
        orbitDistance: 0,
      });
    }

    // Pre-allocate Enemy Projectiles (Fireballs, Toxic Orbs, Void Orbs, Scythe Waves)
    for (let i = 0; i < this.maxEnemyProjectiles; i++) {
      this.enemyProjectiles.push({
        id: i,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 8,
        damage: 15,
        life: 0,
        maxLife: 3,
        color: '#f97316',
        type: 'fireball',
        trailTimer: 0,
      });
    }

    // Pre-allocate Gems
    for (let i = 0; i < this.maxGems; i++) {
      this.gems.push({
        id: i,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        value: 1,
        radius: 6,
        color: '#10b981',
        attracted: false,
      });
    }

    // Pre-allocate Floating Damage Numbers
    for (let i = 0; i < this.maxDamageNumbers; i++) {
      this.damageNumbers.push({
        id: i,
        active: false,
        x: 0,
        y: 0,
        vy: -40,
        text: '0',
        color: '#ffffff',
        isCrit: false,
        life: 0,
        maxLife: 0.7,
      });
    }

    // Pre-allocate Particles
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        id: i,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 3,
        color: '#ffffff',
        life: 0,
        maxLife: 0.5,
      });
    }
  }

  public resetAll() {
    for (const e of this.enemies) e.active = false;
    for (const p of this.projectiles) p.active = false;
    for (const ep of this.enemyProjectiles) ep.active = false;
    for (const g of this.gems) g.active = false;
    for (const d of this.damageNumbers) d.active = false;
    for (const pt of this.particles) pt.active = false;
  }

  // --- Enemy Pool Management ---
  public spawnEnemy(
    category: EnemyCategory,
    x: number,
    y: number,
    hp: number,
    speed: number,
    damage: number,
    radius: number,
    xpValue: number,
    color: string,
    isBoss: boolean = false
  ): EnemyEntity | null {
    const pool = this.enemies;
    const start = this.enemyCursor;
    for (let n = 0; n < this.maxEnemies; n++) {
      const i = (start + n) % this.maxEnemies;
      const e = pool[i];
      if (!e.active) {
        this.enemyCursor = (i + 1) % this.maxEnemies;
        e.active = true;
        e.category = category;
        e.x = x;
        e.y = y;
        e.vx = 0;
        e.vy = 0;
        e.radius = radius;
        e.maxHp = hp;
        e.hp = hp;
        e.speed = speed;
        e.damage = damage;
        e.xpValue = xpValue;
        e.color = color;
        e.hitFlashTimer = 0;
        e.isBoss = isBoss;
        e.animTimer = Math.random() * 10;
        return e;
      }
    }
    return null;
  }

  // --- Projectile Pool Management ---
  public spawnProjectile(
    weaponType: WeaponType,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    radius: number,
    maxLife: number,
    color: string,
    pierce: number = 1,
    angle: number = 0,
    orbitDistance: number = 0
  ): ProjectileEntity | null {
    const pool = this.projectiles;
    const start = this.projectileCursor;
    for (let n = 0; n < this.maxProjectiles; n++) {
      const i = (start + n) % this.maxProjectiles;
      const p = pool[i];
      if (!p.active) {
        this.projectileCursor = (i + 1) % this.maxProjectiles;
        p.active = true;
        p.weaponType = weaponType;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.damage = damage;
        p.radius = radius;
        p.life = 0;
        p.maxLife = maxLife;
        p.color = color;
        p.pierce = pierce;
        p.angle = angle;
        p.orbitDistance = orbitDistance;
        return p;
      }
    }
    return null;
  }

  // --- Enemy Projectile Pool Management ---
  public spawnEnemyProjectile(
    type: 'fireball' | 'toxic_orb' | 'void_orb' | 'scythe_wave' | 'shockwave',
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    radius: number = 8,
    maxLife: number = 3.0,
    color: string = '#f97316'
  ): EnemyProjectileEntity | null {
    const pool = this.enemyProjectiles;
    const start = this.enemyProjectileCursor;
    for (let n = 0; n < this.maxEnemyProjectiles; n++) {
      const i = (start + n) % this.maxEnemyProjectiles;
      const ep = pool[i];
      if (!ep.active) {
        this.enemyProjectileCursor = (i + 1) % this.maxEnemyProjectiles;
        ep.active = true;
        ep.type = type;
        ep.x = x;
        ep.y = y;
        ep.vx = vx;
        ep.vy = vy;
        ep.damage = damage;
        ep.radius = radius;
        ep.life = 0;
        ep.maxLife = maxLife;
        ep.color = color;
        ep.trailTimer = 0;
        return ep;
      }
    }
    return null;
  }

  // --- Gem Pool Management ---
  public spawnGem(x: number, y: number, value: number): GemEntity | null {
    const pool = this.gems;
    for (let n = 0; n < this.maxGems; n++) {
      const i = (this.gemCursor + n) % this.maxGems;
      const g = pool[i];
      if (!g.active) {
        this.gemCursor = (i + 1) % this.maxGems;
        g.active = true;
        g.x = x;
        g.y = y;
        g.vx = (Math.random() - 0.5) * 40;
        g.vy = (Math.random() - 0.5) * 40;
        g.value = value;
        g.attracted = false;

        // Gem color & size based on XP value
        if (value >= 15) {
          g.color = '#ef4444'; // Red gem
          g.radius = 8;
        } else if (value >= 5) {
          g.color = '#38bdf8'; // Blue gem
          g.radius = 7;
        } else {
          g.color = '#10b981'; // Green gem
          g.radius = 5.5;
        }
        return g;
      }
    }
    return null;
  }

  // --- Damage Numbers Pool Management ---
  public spawnDamageNumber(x: number, y: number, amount: number, isCrit: boolean = false) {
    const pool = this.damageNumbers;
    for (let n = 0; n < this.maxDamageNumbers; n++) {
      const i = (this.damageNumberCursor + n) % this.maxDamageNumbers;
      const d = pool[i];
      if (!d.active) {
        this.damageNumberCursor = (i + 1) % this.maxDamageNumbers;
        d.active = true;
        d.x = x + (Math.random() - 0.5) * 12;
        d.y = y - 10;
        d.vy = -60 - Math.random() * 20;
        d.text = Math.round(amount).toString();
        d.isCrit = isCrit;
        d.color = isCrit ? '#facc15' : '#ffffff';
        d.life = 0;
        d.maxLife = 0.65;
        return d;
      }
    }
  }

  // --- Particle Burst ---
  public spawnParticles(x: number, y: number, color: string, count: number = 6, speed: number = 90) {
    // Adaptive quality: halve cosmetic particle counts on struggling devices.
    const n0 = this.lowQuality ? Math.max(1, count >> 1) : count;
    const pool = this.particles;
    for (let c = 0; c < n0; c++) {
      for (let n = 0; n < this.maxParticles; n++) {
        const i = (this.particleCursor + n) % this.maxParticles;
        const pt = pool[i];
        if (!pt.active) {
          this.particleCursor = (i + 1) % this.maxParticles;
          pt.active = true;
          pt.x = x;
          pt.y = y;
          const angle = Math.random() * Math.PI * 2;
          const spd = (0.4 + Math.random() * 0.8) * speed;
          pt.vx = Math.cos(angle) * spd;
          pt.vy = Math.sin(angle) * spd;
          pt.radius = 2 + Math.random() * 2.5;
          pt.color = color;
          pt.life = 0;
          pt.maxLife = 0.35 + Math.random() * 0.25;
          break;
        }
      }
    }
  }
}
