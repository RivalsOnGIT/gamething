// ================================
// player.js — Player Logic
// ================================

class Player {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.w = 40;
    this.h = 56;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = config.facing || 1;

    this.health    = config.maxHp    || 100;
    this.maxHealth = config.maxHp    || 100;
    this.color     = config.color    || '#ffffff';
    this.id        = config.id;       // 1=p1, 2=p2/npc
    this.charId    = config.charId   || 'chronomancer';
    this.abilityType = config.abilityType || 'timestop';

    // Movement
    this.moveSpeed    = config.speed        || 420;
    this.jumpStrength = config.jumpStrength || -620;
    this.jumpCount    = 0;
    this.maxJumps     = 2;

    // Attack
    this.isAttacking       = false;
    this.attackTimer       = 0;
    this.attackDuration    = 0.18;
    this.attackCooldown    = 0;
    this.attackCooldownMax = config.attackCooldownMax || 1.0;
    this.attackDamage      = config.attackDamage      || 12;
    this.attackHit         = false;

    // Ability
    this.abilityCooldown    = 0;
    this.abilityCooldownMax = config.abilityCooldownMax || 10;

    // State flags
    this.isTimeStopped = false;

    // Dash (Dasher)
    this.isDashing     = false;
    this.dashTimer     = 0;
    this.dashDuration  = 0.22;
    this.dashSpeed     = 700;
    this.dashCooldown  = 0;
    this.dashCooldownMax = config.abilityCooldownMax || 5;
    this.dashDamage    = 18;
    this.dashHit       = false;

    // Block system
    this.isBlocking       = false;
    this.blockHoldTime    = 0;
    this.blockOverloaded  = false;
    this.blockStunTimer   = 0;
    this.BLOCK_OVERLOAD_TIME = 3.0;
    this.BLOCK_STUN_DURATION = 3.0;

    // Phantom ability
    this.isInvisible    = false;
    this.invisTimer     = 0;
    this.invisDuration  = 2.0;

    // Burn (Pyro)
    this.burnTimer      = 0;
    this.burnDamage     = 5; // per second
    this.burnDuration   = 3.0;

    // Turret (Techno)
    this.turret = null;

    // Shockwave (Titan)
    this.isShockwave    = false;
    this.shockwaveTimer = 0;
    this.shockwaveDuration = 0.3;
    this.shockwaveHit   = false;

    // Input
    this.keys = {};

    // AI
    this._isNPC         = config.isNPC || false;
    this._aiLevel       = config.aiLevel || 1;
    this._aiTimer       = 0;
    this._isEnemy       = config.isNPC || false;

    // Cooperative tag (story coop — is this an ally?)
    this._isAlly        = config.isAlly || false;
  }

  // ── Controls ──────────────────────────────────────────────────────
  get controls() {
    if (this.id === 1) return { left:'a', right:'d', jump:'w', attack:'x', ability:'z', block:'s' };
    return { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', attack:'1', ability:'0', block:'ArrowDown' };
  }

  // ── Update ────────────────────────────────────────────────────────
  update(dt, platforms, worldW, worldH, timeStopActive) {
    if (this.isTimeStopped) {
      this._tickCooldowns(dt);
      return;
    }

    // Block stun
    if (this.blockStunTimer > 0) {
      this.blockStunTimer -= dt;
      this.isBlocking = false;
      Engine.applyGravity(this, dt);
      Engine.applyFriction(this);
      Engine.moveAndCollide(this, platforms, dt);
      Engine.clampToWorld(this, worldW, worldH);
      if (this.onGround) this.jumpCount = 0;
      this._tickCooldowns(dt);
      return;
    }

    // NPC AI
    if (this._isNPC) {
      this._runAI(dt, worldW, worldH);
    }

    const ctrl = this.controls;

    // Block input
    if (!this._isNPC) {
      if (this.keys[ctrl.block] && !this.isAttacking && !this.isDashing) {
        if (!this.blockOverloaded) {
          this.isBlocking = true;
          this.blockHoldTime += dt;
          if (this.blockHoldTime >= this.BLOCK_OVERLOAD_TIME) {
            this.blockOverloaded = true;
            this.isBlocking = false;
            this.blockHoldTime = 0;
            this.blockStunTimer = this.BLOCK_STUN_DURATION;
          }
        }
      } else {
        if (this.isBlocking) {
          this.isBlocking = false;
          this.blockHoldTime = 0;
        }
        if (!this.keys[ctrl.block]) this.blockOverloaded = false;
      }

      // Movement
      if (!this.isBlocking) {
        if (this.keys[ctrl.left]) {
          this.vx = -this.moveSpeed;
          this.facing = -1;
        } else if (this.keys[ctrl.right]) {
          this.vx = this.moveSpeed;
          this.facing = 1;
        }
      }
    }

    // Dash override
    if (this.isDashing) {
      this.vx = this.facing * this.dashSpeed;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashHit = false;
      }
    }

    Engine.applyGravity(this, dt);
    Engine.applyFriction(this);
    Engine.moveAndCollide(this, platforms, dt);
    Engine.clampToWorld(this, worldW, worldH);

    if (this.onGround) this.jumpCount = 0;

    if (this.isAttacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) { this.isAttacking = false; this.attackHit = false; }
    }

    // Invisibility timer
    if (this.isInvisible) {
      this.invisTimer -= dt;
      if (this.invisTimer <= 0) { this.isInvisible = false; }
    }

    // Burn tick
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.health = Math.max(0, this.health - this.burnDamage * dt);
    }

    // Shockwave timer
    if (this.isShockwave) {
      this.shockwaveTimer -= dt;
      if (this.shockwaveTimer <= 0) { this.isShockwave = false; this.shockwaveHit = false; }
    }

    // Turret update
    if (this.turret && this.turret.active) {
      this.turret.timer -= dt;
      this.turret.shootCooldown = Math.max(0, (this.turret.shootCooldown || 0) - dt);
      if (this.turret.timer <= 0) this.turret.active = false;
    }

    this._tickCooldowns(dt);
  }

  _tickCooldowns(dt) {
    if (this.attackCooldown  > 0) this.attackCooldown  = Math.max(0, this.attackCooldown  - dt);
    if (this.abilityCooldown > 0) this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    if (this.dashCooldown    > 0) this.dashCooldown    = Math.max(0, this.dashCooldown    - dt);
  }

  // ── AI ────────────────────────────────────────────────────────────
  _runAI(dt, worldW, worldH) {
    this._aiTimer -= dt;
    if (this._aiTimer > 0) return;

    // Difficulty-based reaction time
    const reactionTime = Math.max(0.1, 0.5 - this._aiLevel * 0.07);
    this._aiTimer = reactionTime + Math.random() * 0.2;

    const target = this._aiTarget;
    if (!target) return;

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.abs(dx);

    // Move toward target
    if (dist > 80) {
      this.vx = Math.sign(dx) * this.moveSpeed;
      this.facing = Math.sign(dx);
    } else if (dist < 40) {
      this.vx = -Math.sign(dx) * this.moveSpeed * 0.5;
    } else {
      this.vx = 0;
    }

    // Jump if target is above or to avoid edges
    if (this._aiLevel >= 2 && (dy < -60 || this.x < 30 || this.x > worldW - 60)) {
      if (this.onGround) {
        this.vy = this.jumpStrength;
        this.jumpCount = 1;
        this.onGround = false;
      }
    }

    // Attack
    if (dist < 80 && !target.isInvisible) {
      this.tryAttack();
    }

    // Ability use
    if (this._aiLevel >= 3 && Math.random() < 0.3) {
      this.tryAbility();
    }

    // Block when attacked (higher levels)
    if (this._aiLevel >= 4 && Math.random() < 0.2) {
      this.isBlocking = true;
      setTimeout(() => { if (this) this.isBlocking = false; }, 400);
    }
  }

  // ── Jump ──────────────────────────────────────────────────────────
  tryJump() {
    if (this.isTimeStopped || this.blockStunTimer > 0) return;
    if (this.jumpCount < this.maxJumps) {
      this.vy = this.jumpStrength;
      this.jumpCount++;
      this.onGround = false;
    }
  }

  // ── Basic Attack ──────────────────────────────────────────────────
  tryAttack() {
    if (this.isTimeStopped || this.isBlocking || this.blockStunTimer > 0) return;
    if (this.isAttacking || this.attackCooldown > 0) return;
    this.isAttacking    = true;
    this.attackTimer    = this.attackDuration;
    this.attackCooldown = this.attackCooldownMax;
    this.attackHit      = false;
  }

  // ── Ability ───────────────────────────────────────────────────────
  tryAbility() {
    if (this.isTimeStopped || this.abilityCooldown > 0 || this.blockStunTimer > 0) return;

    switch (this.abilityType) {
      case 'dash':
        this.isDashing    = true;
        this.dashTimer    = this.dashDuration;
        this.dashHit      = false;
        this.dashCooldown = this.dashCooldownMax;
        this.abilityCooldown = this.abilityCooldownMax;
        this.vy = -100;
        break;

      case 'shockwave':
        this.isShockwave    = true;
        this.shockwaveTimer = this.shockwaveDuration;
        this.shockwaveHit   = false;
        this.abilityCooldown = this.abilityCooldownMax;
        break;

      case 'invisibility':
        this.isInvisible  = true;
        this.invisTimer   = this.invisDuration;
        this.abilityCooldown = this.abilityCooldownMax;
        break;

      case 'burn':
        // Handled via combat — just set flag
        this._wantsBurn   = true;
        this.abilityCooldown = this.abilityCooldownMax;
        break;

      case 'turret':
        this.turret = {
          active: true,
          x: this.x + (this.facing === 1 ? this.w + 10 : -50),
          y: this.y,
          w: 30, h: 30,
          timer: 8.0,
          facing: this.facing,
          shootCooldown: 0,
          shootCooldownMax: 1.5,
          damage: 8,
        };
        this.abilityCooldown = this.abilityCooldownMax;
        break;

      case 'timestop':
        // Handled externally by Game
        break;
    }
  }

  // ── Hitboxes ──────────────────────────────────────────────────────
  getAttackHitbox() {
    if (!this.isAttacking) return null;
    const hbX = this.facing === 1 ? this.x + this.w : this.x - 40;
    return { x: hbX, y: this.y + this.h * 0.1, w: 40, h: this.h * 0.8 };
  }

  getDashHitbox() {
    if (!this.isDashing) return null;
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  getShockwaveHitbox() {
    if (!this.isShockwave) return null;
    return { x: this.x - 80, y: this.y, w: this.w + 160, h: this.h };
  }

  getTurretFireHitbox() {
    if (!this.turret || !this.turret.active || this.turret.shootCooldown > 0) return null;
    const t = this.turret;
    const bx = t.facing === 1 ? t.x + t.w : t.x - 120;
    return { x: bx, y: t.y + t.h * 0.2, w: 120, h: t.h * 0.6 };
  }

  // ── Damage ────────────────────────────────────────────────────────
  takeDamage(amount, fromPlayer) {
    if (this.isBlocking && !this.blockOverloaded) return; // blocked!
    if (this.isTimeStopped) return;
    this.health = Math.max(0, this.health - amount);
    this.vx += (this.facing * -1) * 200;
    this.vy  = -150;
  }

  applyBurn() {
    this.burnTimer = this.burnDuration;
  }

  // ── Getters ───────────────────────────────────────────────────────
  get healthPct()    { return this.health / this.maxHealth; }
  get attackReady()  { return this.attackCooldown <= 0; }
  get abilityReady() { return this.abilityCooldown <= 0; }
  get isDead()       { return this.health <= 0; }
  get isStunned()    { return this.blockStunTimer > 0; }
}
