// ================================
// player.js — Player Logic
// ================================

class Player {
  constructor(config) {
    this.x = config.x || 0; this.y = config.y || 0;
    this.w = 40; this.h = 56;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = config.facing || 1;

    this.health    = config.maxHp || 100;
    this.maxHealth = config.maxHp || 100;
    this._tsBufferedDamage = 0;
    this._displayHealth = this.health;

    this.color       = config.color       || '#ffffff';
    this.accentColor = config.accentColor || config.color || '#ffffff';
    this.id          = config.id;
    this.charId      = config.charId      || 'chronomancer';
    this.abilityType = config.abilityType || 'timestop';
    this.shape       = config.shape       || 'default';

    this.moveSpeed    = config.speed        || 420;
    this.jumpStrength = config.jumpStrength || -620;
    this.jumpCount    = 0; this.maxJumps = 2;
    this._slowTimer   = 0;

    this.isAttacking       = false;
    this.attackTimer       = 0;
    this.attackDuration    = 0.18;
    this.attackCooldown    = 0;
    this.attackCooldownMax = config.attackCooldownMax || 1.0;
    this.attackDamage      = config.attackDamage      || 12;
    this.attackHit         = false;
    this.attackRange       = config.attackRange || 40;

    this.abilityCooldown    = 0;
    this.abilityCooldownMax = config.abilityCooldownMax || 10;

    this.stocks    = config.stocks    !== undefined ? config.stocks    : 3;
    this.maxStocks = config.maxStocks !== undefined ? config.maxStocks : 3;

    this.isTimeStopped = false;

    this.isDashing     = false;
    this.dashTimer     = 0;
    this.dashDuration  = 0.22;
    this.dashSpeed     = 700;
    this.dashCooldown  = 0;
    this.dashCooldownMax = config.abilityCooldownMax || 5;
    this.dashDamage    = 18;
    this.dashHit       = false;

    this.isBlocking       = false;
    this.blockHoldTime    = 0;
    this.blockOverloaded  = false;
    this.blockStunTimer   = 0;
    this.BLOCK_OVERLOAD_TIME = 3.0;
    this.BLOCK_STUN_DURATION = 3.0;

    this.isInvisible   = false;
    this.invisTimer    = 0;
    this.invisDuration = 2.0;

    this.burnTimer    = 0;
    this.burnDamage   = 5;
    this.burnDuration = 3.0;

    this.turret = null;

    this.isShockwave       = false;
    this.shockwaveTimer    = 0;
    this.shockwaveDuration = 0.3;
    this.shockwaveHit      = false;

    this.isUppercut       = false;
    this.uppercutTimer    = 0;
    this.uppercutDuration = 0.25;
    this.uppercutHit      = false;

    this.lightningStunTimer = 0;
    this.iceSpike           = null;
    this._teleportFlash     = 0;

    this.keys        = {};
    this._mobileKeys = {};

    // ── AI ──────────────────────────────────────────────────────────
    this._isNPC    = config.isNPC  || false;
    this._aiLevel  = config.aiLevel || 1;
    this._aiTimer  = 0;
    this._isEnemy  = config.isNPC  || false;
    this._isAlly   = config.isAlly || false;
    this._aiTargets = [];

    // Per-frame movement intent (set by decision, consumed by movement)
    this._aiWantLeft        = false;
    this._aiWantRight       = false;
    this._aiWantJump        = false;
    this._aiTarget          = null;
    this._blockReleaseTimer = 0;

    // Platform navigation state
    this._stuckTimer     = 0;     // how long we've been moving but not getting closer
    this._lastX          = config.x || 0;
    this._stuckJumpTimer = 0;     // cooldown so we don't spam jump when stuck

    this._dead         = false;
    this._respawnTimer = 0;
    this._respawnX     = config.x || 0;
    this._respawnY     = config.y || 0;
    this._invincTimer  = 0;
  }

  get controls() {
    if (this.id === 1) return { left:'a', right:'d', jump:'w', attack:'x', ability:'z', block:'s' };
    return { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', attack:'1', ability:'0', block:'ArrowDown' };
  }

  _getEffectiveKeys() {
    const k = {};
    for (const key in this.keys)        if (this.keys[key])        k[key] = true;
    for (const key in this._mobileKeys) if (this._mobileKeys[key]) k[key] = true;
    return k;
  }

  update(dt, platforms, worldW, worldH, timeStopActive) {
    if (this._dead) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this._respawn(worldW, worldH);
      return;
    }

    if (this._invincTimer > 0) this._invincTimer -= dt;
    if (this.isTimeStopped) { this._tickCooldowns(dt); return; }

    if (this.lightningStunTimer > 0) {
      this.lightningStunTimer -= dt;
      Engine.applyGravity(this, dt); Engine.applyFriction(this);
      Engine.moveAndCollide(this, platforms, dt); Engine.clampToWorldTop(this);
      if (this.onGround) this.jumpCount = 0;
      this._tickCooldowns(dt); return;
    }

    if (this.blockStunTimer > 0) {
      this.blockStunTimer -= dt; this.isBlocking = false;
      Engine.applyGravity(this, dt); Engine.applyFriction(this);
      Engine.moveAndCollide(this, platforms, dt); Engine.clampToWorldTop(this);
      if (this.onGround) this.jumpCount = 0;
      this._tickCooldowns(dt); return;
    }

    const slow = this._slowTimer > 0 ? 0.5 : 1.0;
    if (this._slowTimer > 0) this._slowTimer -= dt;

    if (this._isNPC) {
      this._updateAIDecision(dt, platforms, worldW, worldH);
      this._applyAIMovement(dt, slow);
    } else {
      const keys = this._getEffectiveKeys();
      const ctrl = this.controls;

      if (keys[ctrl.block] && !this.isAttacking && !this.isDashing) {
        if (!this.blockOverloaded) {
          this.isBlocking = true;
          this.blockHoldTime += dt;
          if (this.blockHoldTime >= this.BLOCK_OVERLOAD_TIME) {
            this.blockOverloaded  = true;
            this.isBlocking       = false;
            this.blockHoldTime    = 0;
            this.blockStunTimer   = this.BLOCK_STUN_DURATION;
          }
        }
      } else {
        if (this.isBlocking) { this.isBlocking = false; this.blockHoldTime = 0; }
        if (!keys[ctrl.block]) this.blockOverloaded = false;
      }

      if (!this.isBlocking) {
        if      (keys[ctrl.left])  { this.vx = -this.moveSpeed * slow; this.facing = -1; }
        else if (keys[ctrl.right]) { this.vx =  this.moveSpeed * slow; this.facing =  1; }
      }
    }

    if (this.isDashing) {
      this.vx = this.facing * this.dashSpeed;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) { this.isDashing = false; this.dashHit = false; }
    }

    if (this.iceSpike && this.iceSpike.active) {
      this.iceSpike.x += this.iceSpike.vx * dt;
      this.iceSpike.life -= dt;
      if (this.iceSpike.life <= 0) this.iceSpike.active = false;
    }

    Engine.applyGravity(this, dt);
    Engine.applyFriction(this);
    Engine.moveAndCollide(this, platforms, dt);
    Engine.clampToWorldTop(this);

    if (this.onGround) this.jumpCount = 0;

    if (this.isAttacking)  { this.attackTimer   -= dt; if (this.attackTimer   <= 0) { this.isAttacking  = false; this.attackHit  = false; } }
    if (this.isUppercut)   { this.uppercutTimer -= dt; if (this.uppercutTimer <= 0) { this.isUppercut   = false; this.uppercutHit= false; } }
    if (this.isShockwave)  { this.shockwaveTimer-= dt; if (this.shockwaveTimer<= 0) { this.isShockwave  = false; this.shockwaveHit=false; } }
    if (this.isInvisible)  { this.invisTimer    -= dt; if (this.invisTimer    <= 0) this.isInvisible = false; }
    if (this.burnTimer > 0){ this.burnTimer     -= dt; this._applyActualDamage(this.burnDamage * dt); }
    if (this.turret?.active) {
      this.turret.timer -= dt;
      this.turret.shootCooldown = Math.max(0, (this.turret.shootCooldown||0) - dt);
      if (this.turret.timer <= 0) this.turret.active = false;
    }
    if (this._teleportFlash > 0) this._teleportFlash -= dt;

    this._tickCooldowns(dt);
  }

  _tickCooldowns(dt) {
    if (this.attackCooldown  > 0) this.attackCooldown  = Math.max(0, this.attackCooldown  - dt);
    if (this.abilityCooldown > 0) this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    if (this.dashCooldown    > 0) this.dashCooldown    = Math.max(0, this.dashCooldown    - dt);
  }

  // ── AI Decision (runs on timer) ─────────────────────────────────────
  _updateAIDecision(dt, platforms, worldW, worldH) {
    this._aiTimer -= dt;
    this._stuckJumpTimer = Math.max(0, this._stuckJumpTimer - dt);

    const level   = this._aiLevel;
    const targets = (this._aiTargets || []).filter(t => !t._dead && !t.isDead);

    if (!targets.length) { this._aiWantLeft = false; this._aiWantRight = false; return; }

    // Closest target
    const target = targets.reduce((best, t) =>
      Math.abs(t.x - this.x) < Math.abs(best.x - this.x) ? t : best, targets[0]);

    this._aiTarget = target;

    const myCx  = this.x + this.w / 2;
    const tgtCx = target.x + target.w / 2;
    const dx    = tgtCx - myCx;
    const dy    = target.y - this.y;   // positive = target is below me
    const absDx = Math.abs(dx);
    const ATTACK_RANGE = this.attackRange + 20;

    // ── Stuck detection: if we haven't moved much toward target in 0.4s ──
    const movedDx = Math.abs(this.x - this._lastX);
    if (movedDx < 5 && (this._aiWantLeft || this._aiWantRight)) {
      this._stuckTimer += dt;
    } else {
      this._stuckTimer = Math.max(0, this._stuckTimer - dt * 2);
    }
    this._lastX = this.x;
    const isStuck = this._stuckTimer > 0.35;

    // ── Platform-aware navigation ──
    // Find a platform that is roughly above us and between us and the target
    // and work out if we need to jump to reach it.
    const targetAbove   = dy < -40;   // target is meaningfully above
    const targetBelow   = dy > 60;    // target is meaningfully below
    const sameHeight    = !targetAbove && !targetBelow;

    // Which platform is the target standing on (or nearest below target)?
    const tgtPlatform = this._findPlatformBelow(target, platforms);
    const myPlatform  = this._findPlatformBelow(this, platforms);

    // Are we on the same platform as the target?
    const samePlatform = tgtPlatform && myPlatform && tgtPlatform === myPlatform;

    // Should we navigate toward a platform the target is on?
    let navTarget = null; // a platform to jump toward
    if (targetAbove && tgtPlatform && !samePlatform) {
      navTarget = tgtPlatform;
    }

    // Decision timer gate
    const reactionTime = Math.max(0.05, 0.40 - level * 0.055) + Math.random() * 0.06;
    if (this._aiTimer > 0) {
      // Even between decisions: execute jump if flagged
      return;
    }
    this._aiTimer = reactionTime;

    // Reset movement intent
    this._aiWantLeft  = false;
    this._aiWantRight = false;
    this._aiWantJump  = false;

    const edgeLeft  = this.x < 80;
    const edgeRight = this.x + this.w > worldW - 80;

    if (navTarget) {
      // Navigate toward the platform the target is on
      // Move toward the platform's horizontal center
      const platCx = navTarget.x + navTarget.w / 2;
      const toPlatDx = platCx - myCx;

      if (Math.abs(toPlatDx) > 40) {
        if (toPlatDx > 0) this._aiWantRight = true;
        else              this._aiWantLeft  = true;
      }

      // Jump if we're on the ground and the platform is above us,
      // OR if we're stuck (can't seem to get there)
      if (this.onGround && this._stuckJumpTimer <= 0) {
        // Check if we're roughly horizontally aligned to land on it
        const platformReachable = this.x + this.w > navTarget.x - 40 &&
                                  this.x < navTarget.x + navTarget.w + 40;
        if (platformReachable || isStuck) {
          this._aiWantJump = true;
          this._stuckTimer = 0;
          this._stuckJumpTimer = 0.5; // wait a bit before jumping again
        }
      }
      // If airborne, keep moving toward platform
    } else {
      // Normal chase logic: same level or target is below
      if (absDx > ATTACK_RANGE + 20) {
        if (dx > 0) this._aiWantRight = true;
        else        this._aiWantLeft  = true;
      } else if (absDx < ATTACK_RANGE * 0.5 && level < 4) {
        // Back up a little
        if (dx > 0) this._aiWantLeft  = true;
        else        this._aiWantRight = true;
      }

      // Jump over obstacles or when stuck
      if (this.onGround && this._stuckJumpTimer <= 0) {
        if (isStuck) {
          // We're stuck — jump and keep moving
          this._aiWantJump = true;
          this._stuckTimer = 0;
          this._stuckJumpTimer = 0.6;
        } else if (targetAbove && level >= 2) {
          this._aiWantJump = true;
          this._stuckJumpTimer = 0.4;
        } else if (level >= 4 && Math.random() < 0.15) {
          // Unpredictable high-level jumps
          this._aiWantJump = true;
          this._stuckJumpTimer = 0.5;
        }
      }

      // In air but target is above and we still have double jump
      if (!this.onGround && targetAbove && this.jumpCount < this.maxJumps && level >= 3 && this._stuckJumpTimer <= 0) {
        if (Math.random() < 0.4) {
          this._aiWantJump = true;
          this._stuckJumpTimer = 0.5;
        }
      }
    }

    // Edge avoidance
    if (edgeLeft  && this._aiWantLeft)  { this._aiWantLeft  = false; this._aiWantRight = true; }
    if (edgeRight && this._aiWantRight) { this._aiWantRight = false; this._aiWantLeft  = true; }

    // Combat
    if (absDx <= ATTACK_RANGE + 10 && !target.isInvisible) this.tryAttack();

    const abilityChance = 0.12 + level * 0.07;
    if (level >= 2 && Math.random() < abilityChance) this.tryAbility();

    if (level >= 4 && Math.random() < 0.1) {
      this.isBlocking = true;
      this._blockReleaseTimer = 0.25 + Math.random() * 0.3;
    }
  }

  // Find the platform an entity is currently standing on (or closest below)
  _findPlatformBelow(entity, platforms) {
    let best = null, bestDist = Infinity;
    for (const p of platforms) {
      // Platform must be horizontally overlapping
      if (entity.x + entity.w < p.x - 20 || entity.x > p.x + p.w + 20) continue;
      // Platform top must be at or below entity bottom
      const dist = Math.abs((entity.y + entity.h) - p.y);
      if (dist < bestDist && dist < 80) { bestDist = dist; best = p; }
    }
    return best;
  }

  // ── AI Movement (every frame) ────────────────────────────────────────
  _applyAIMovement(dt, slow) {
    if (this._blockReleaseTimer > 0) {
      this._blockReleaseTimer -= dt;
      if (this._blockReleaseTimer <= 0) this.isBlocking = false;
    }
    if (this.isBlocking) return;

    // Face target every frame
    if (this._aiTarget && !this._aiTarget._dead) {
      const tgtCx = this._aiTarget.x + this._aiTarget.w / 2;
      this.facing  = tgtCx > this.x + this.w / 2 ? 1 : -1;
    }

    if (this._aiWantLeft)  this.vx = -this.moveSpeed * slow;
    if (this._aiWantRight) this.vx =  this.moveSpeed * slow;

    if (this._aiWantJump) {
      this._aiWantJump = false;
      this.tryJump();
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────
  tryJump() {
    if (this.isTimeStopped || this.blockStunTimer > 0 || this.lightningStunTimer > 0 || this._dead) return;
    if (this.jumpCount < this.maxJumps) {
      this.vy = this.jumpStrength; this.jumpCount++; this.onGround = false;
    }
  }

  tryAttack() {
    if (this.isTimeStopped || this.isBlocking || this.blockStunTimer > 0 || this.lightningStunTimer > 0 || this._dead) return;
    if (this.isAttacking || this.attackCooldown > 0) return;
    this.isAttacking    = true;
    this.attackTimer    = this.attackDuration;
    this.attackCooldown = this.attackCooldownMax;
    this.attackHit      = false;
  }

  tryAbility() {
    if (this.isTimeStopped || this.abilityCooldown > 0 || this.blockStunTimer > 0 || this._dead) return;
    switch (this.abilityType) {
      case 'dash':
        this.isDashing = true; this.dashTimer = this.dashDuration;
        this.dashHit = false; this.dashCooldown = this.dashCooldownMax;
        this.abilityCooldown = this.abilityCooldownMax; this.vy = -100; break;
      case 'shockwave':
        this.isShockwave = true; this.shockwaveTimer = this.shockwaveDuration;
        this.shockwaveHit = false; this.abilityCooldown = this.abilityCooldownMax; break;
      case 'invisibility':
        this.isInvisible = true; this.invisTimer = this.invisDuration;
        this.abilityCooldown = this.abilityCooldownMax; break;
      case 'burn':
        this._wantsBurn = true; this.abilityCooldown = this.abilityCooldownMax; break;
      case 'turret':
        this.turret = {
          active: true,
          x: this.x + (this.facing === 1 ? this.w + 10 : -50),
          y: this.y, w: 30, h: 30, timer: 8.0,
          facing: this.facing, shootCooldown: 0, shootCooldownMax: 1.5, damage: 8,
        };
        this.abilityCooldown = this.abilityCooldownMax; break;
      case 'freeze':
        this.iceSpike = {
          active: true,
          x: this.facing === 1 ? this.x + this.w : this.x - 20,
          y: this.y + this.h * 0.4,
          w: 16, h: 12, vx: this.facing * 600, life: 1.2, hit: false,
        };
        this.abilityCooldown = this.abilityCooldownMax; break;
      case 'uppercut':
        this.isUppercut = true; this.uppercutTimer = this.uppercutDuration;
        this.uppercutHit = false; this.vy = -500;
        this.abilityCooldown = this.abilityCooldownMax; break;
      case 'teleport':
        this._doTeleport(); break;
      case 'lightning':
        this._wantsLightning = true; this.abilityCooldown = this.abilityCooldownMax; break;
      case 'timestop': break;
    }
  }

  _doTeleport() {
    const targets = (this._aiTargets || []).filter(t => !t._dead);
    if (!targets.length) return;
    const target = targets[0];
    const offset = this.facing === 1 ? -(this.w + 12) : (target.w + 12);
    this.x = Math.max(0, target.x + offset);
    this.y = target.y;
    this.vx = 0; this.vy = 0;
    this._teleportFlash = 0.3;
    this.abilityCooldown = this.abilityCooldownMax;
  }

  _respawn(worldW, worldH) {
    this._dead = false;
    this.health = this.maxHealth; this._displayHealth = this.maxHealth;
    this._tsBufferedDamage = 0;
    this.x = this._respawnX; this.y = this._respawnY;
    this.vx = 0; this.vy = 0;
    this.isTimeStopped = false; this.burnTimer = 0;
    this.lightningStunTimer = 0; this.blockStunTimer = 0;
    this._aiWantLeft = false; this._aiWantRight = false;
    this._stuckTimer = 0; this._lastX = this._respawnX;
    this._invincTimer = 2.0;
  }

  // ── Hitboxes ──────────────────────────────────────────────────────
  getAttackHitbox() {
    if (!this.isAttacking) return null;
    const hbX = this.facing === 1 ? this.x + this.w : this.x - this.attackRange;
    return { x:hbX, y:this.y + this.h*0.1, w:this.attackRange, h:this.h*0.8 };
  }
  getDashHitbox()      { return this.isDashing  ? {x:this.x,  y:this.y,      w:this.w,        h:this.h}        : null; }
  getShockwaveHitbox() { return this.isShockwave? {x:this.x-80,y:this.y,     w:this.w+160,    h:this.h}        : null; }
  getUppercutHitbox()  { return this.isUppercut ? {x:this.x-10,y:this.y-20,  w:this.w+20,     h:this.h+20}     : null; }
  getTurretFireHitbox() {
    if (!this.turret?.active || this.turret.shootCooldown > 0) return null;
    const t = this.turret;
    return { x: t.facing===1 ? t.x+t.w : t.x-120, y:t.y+t.h*0.2, w:120, h:t.h*0.6 };
  }
  getIceSpikeHitbox() {
    const s = this.iceSpike;
    if (!s || !s.active || s.hit) return null;
    return { x:s.x, y:s.y, w:s.w, h:s.h };
  }

  // ── Damage ────────────────────────────────────────────────────────
  takeDamage(amount, options = {}) {
    if (this._invincTimer > 0) return;
    if (this.isBlocking && !this.blockOverloaded) return;
    if (options.duringTimeStop && this.isTimeStopped) {
      this._tsBufferedDamage += amount;
      this._tsKnockbackX = (this._tsKnockbackX||0) + (this.facing*-1)*200;
      this._tsKnockbackY = (this._tsKnockbackY||0) - 150;
      return;
    }
    this._applyActualDamage(amount);
    const kbMult = options.kbMult || 1.0;
    this.vx += (this.facing*-1) * 220 * kbMult;
    this.vy  = -160 * kbMult;
  }

  flushTimeStopDamage() {
    if (this._tsBufferedDamage <= 0) return;
    this._applyActualDamage(this._tsBufferedDamage);
    this.vx += (this._tsKnockbackX||0) * 1.8;
    this.vy  =  this._tsKnockbackY || -300;
    this._tsBufferedDamage = 0; this._tsKnockbackX = 0; this._tsKnockbackY = 0;
  }

  _applyActualDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this._displayHealth = this.health;
    if (this.health <= 0) this._die();
  }

  applyBurn()             { this.burnTimer = this.burnDuration; }
  applySlow(dur)          { this._slowTimer = dur; }
  applyLightningStun(dur) { this.lightningStunTimer = dur; }

  _die() {
    this.stocks--;
    this._dead = true; this._respawnTimer = 2.0;
    this.health = 0; this._displayHealth = 0;
    this.isDashing = false; this.isAttacking = false; this.burnTimer = 0;
    this._aiWantLeft = false; this._aiWantRight = false; this._stuckTimer = 0;
  }

  get healthPct()    { return this._displayHealth / this.maxHealth; }
  get isDead()       { return this.stocks <= 0; }
  get isStunned()    { return this.blockStunTimer > 0 || this.lightningStunTimer > 0; }
  get isEliminated() { return this.isDead; }
}
