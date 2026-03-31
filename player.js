// ================================
// player.js — Player Logic
// ================================

class Player {
  constructor(config) {
    // Position & size
    this.x = config.x;
    this.y = config.y;
    this.w = 40;
    this.h = 56;

    // Physics
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = config.facing || 1; // 1=right, -1=left

    // Stats
    this.health = 100;
    this.maxHealth = 100;
    this.color = config.color;
    this.id = config.id; // 1 or 2

    // Movement constants
    this.moveSpeed    = 420;   // px/s
    this.jumpStrength = -620;  // px/s
    this.jumpCount    = 0;
    this.maxJumps     = 2;

    // Attack (basic)
    this.isAttacking       = false;
    this.attackTimer       = 0;
    this.attackDuration    = 0.18; // seconds hitbox is active
    this.attackCooldown    = 0;
    this.attackCooldownMax = 1.0;  // 1 second cooldown
    this.attackDamage      = 12;
    this.attackHit         = false; // prevent multi-hit per swing

    // Ability
    this.abilityCooldown    = 0;
    this.abilityCooldownMax = config.abilityCooldownMax || 6;

    // State flags
    this.isTimeStopped = false; // frozen by P1's time stop
    this.isDashing     = false;
    this.dashTimer     = 0;
    this.dashDuration  = 0.22; // seconds
    this.dashSpeed     = 700;
    this.dashCooldown  = 0;
    this.dashCooldownMax = config.abilityCooldownMax || 6;
    this.dashDamage    = 18;
    this.dashHit       = false;

    // Input snapshot (set each frame by Game)
    this.keys = {};
  }

  // ── Input Bindings ──────────────────────────────────────────────
  get controls() {
    if (this.id === 1) {
      return { left: 'a', right: 'd', jump: 'w', attack: 'x', ability: 'z' };
    } else {
      return { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', attack: '1', ability: '0' };
    }
  }

  // ── Update ──────────────────────────────────────────────────────
  update(dt, platforms, worldW, worldH, timeStopped) {
    // If frozen by time stop (and this is not the player who triggered it)
    if (this.isTimeStopped) {
      // Still tick cooldowns so they don't freeze too
      this._tickCooldowns(dt);
      return;
    }

    const ctrl = this.controls;

    // -- Horizontal movement --
    if (this.keys[ctrl.left]) {
      this.vx = -this.moveSpeed;
      this.facing = -1;
    } else if (this.keys[ctrl.right]) {
      this.vx = this.moveSpeed;
      this.facing = 1;
    }

    // -- Dash (P2 ability) overrides vx --
    if (this.isDashing) {
      this.vx = this.facing * this.dashSpeed;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashHit   = false;
      }
    }

    // -- Physics --
    Engine.applyGravity(this, dt);
    Engine.applyFriction(this);
    Engine.moveAndCollide(this, platforms, dt);
    Engine.clampToWorld(this, worldW, worldH);

    // Reset jump count on landing
    if (this.onGround) this.jumpCount = 0;

    // -- Attack timer --
    if (this.isAttacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.attackHit   = false;
      }
    }

    this._tickCooldowns(dt);
  }

  _tickCooldowns(dt) {
    if (this.attackCooldown > 0)  this.attackCooldown  = Math.max(0, this.attackCooldown  - dt);
    if (this.abilityCooldown > 0) this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    if (this.dashCooldown > 0)    this.dashCooldown    = Math.max(0, this.dashCooldown    - dt);
  }

  // ── Jump ────────────────────────────────────────────────────────
  tryJump() {
    if (this.isTimeStopped) return;
    if (this.jumpCount < this.maxJumps) {
      this.vy = this.jumpStrength;
      this.jumpCount++;
      this.onGround = false;
    }
  }

  // ── Basic Attack ─────────────────────────────────────────────────
  tryAttack() {
    if (this.isTimeStopped) return;
    if (this.isAttacking) return;
    if (this.attackCooldown > 0) return;

    this.isAttacking    = true;
    this.attackTimer    = this.attackDuration;
    this.attackCooldown = this.attackCooldownMax;
    this.attackHit      = false;
  }

  // ── Ability ──────────────────────────────────────────────────────
  tryAbility() {
    if (this.isTimeStopped) return;
    if (this.abilityCooldown > 0) return;

    if (this.id === 2) {
      // Forward dash
      this.isDashing    = true;
      this.dashTimer    = this.dashDuration;
      this.dashHit      = false;
      this.dashCooldown = this.dashCooldownMax;
      this.abilityCooldown = this.abilityCooldownMax;
      this.vy = -100; // slight lift so they don't scrape the ground
    }
    // P1 time stop is handled by Game directly
  }

  // ── Get attack hitbox ─────────────────────────────────────────────
  getAttackHitbox() {
    if (!this.isAttacking) return null;
    const hbX = this.facing === 1 ? this.x + this.w : this.x - 40;
    return { x: hbX, y: this.y + this.h * 0.1, w: 40, h: this.h * 0.8 };
  }

  // ── Get dash hitbox ───────────────────────────────────────────────
  getDashHitbox() {
    if (!this.isDashing) return null;
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  // ── Take damage ───────────────────────────────────────────────────
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    // Knockback
    this.vx += (this.facing * -1) * 200;
    this.vy  = -150;
  }

  // ── Getters for HUD ──────────────────────────────────────────────
  get healthPct() { return this.health / this.maxHealth; }
  get attackReady() { return this.attackCooldown <= 0; }
  get abilityReady() { return this.abilityCooldown <= 0; }
  get isDead() { return this.health <= 0; }
}
