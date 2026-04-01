// ================================
// player.js — Player Logic
// ================================

class Player {
  constructor(config) {
    this.x = config.x; this.y = config.y;
    this.w = 40; this.h = 56;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = config.facing || 1;

    this.health    = config.maxHp || 100;
    this.maxHealth = config.maxHp || 100;
    this._tsBufferedDamage = 0;
    this._displayHealth = this.health;

    this.color       = config.color    || '#ffffff';
    this.accentColor = config.accentColor || config.color || '#ffffff';
    this.id          = config.id;
    this.charId      = config.charId   || 'chronomancer';
    this.abilityType = config.abilityType || 'timestop';
    this.shape       = config.shape    || 'default';

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

    this.isTimeStopped   = false;
    this.isOutOfBounds   = false;

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

    this.burnTimer  = 0;
    this.burnDamage = 5;
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

    this.iceSpike = null;

    this._teleportFlash = 0;

    this.keys = {};
    this._mobileKeys = {};

    // ── AI state (persistent per frame, not timer-gated for movement) ──
    this._isNPC    = config.isNPC || false;
    this._aiLevel  = config.aiLevel || 1;  // 1-6
    this._aiTimer  = 0;        // for infrequent decisions only
    this._isEnemy  = config.isNPC || false;
    this._isAlly   = config.isAlly || false;
    this._aiTargets = [];
    // Persistent AI goal state (updated every decision tick, applied every frame)
    this._aiWantLeft   = false;
    this._aiWantRight  = false;
    this._aiWantJump   = false;
    this._aiJumpTimer  = 0;    // how long ago we requested a jump
    this._aiWantAttack = false;

    this._dead          = false;
    this._respawnTimer  = 0;
    this._respawnX      = config.x;
    this._respawnY      = config.y;
    this._invincTimer   = 0;
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
      Engine.applyGravity(this, dt);
      Engine.applyFriction(this);
      Engine.moveAndCollide(this, platforms, dt);
      Engine.clampToWorldTop(this);
      if (this.onGround) this.jumpCount = 0;
      this._tickCooldowns(dt);
      return;
    }

    if (this.blockStunTimer > 0) {
      this.blockStunTimer -= dt;
      this.isBlocking = false;
      Engine.applyGravity(this, dt);
      Engine.applyFriction(this);
      Engine.moveAndCollide(this, platforms, dt);
      Engine.clampToWorldTop(this);
      if (this.onGround) this.jumpCount = 0;
      this._tickCooldowns(dt);
      return;
    }

    const slow = this._slowTimer > 0 ? 0.5 : 1.0;
    if (this._slowTimer > 0) this._slowTimer -= dt;

    if (this._isNPC) {
      // AI: run decision logic on a timer, but apply movement EVERY frame
      this._updateAIDecision(dt, worldW, worldH);
      this._applyAIMovement(dt, slow);
    } else {
      const keys = this._getEffectiveKeys();
      const ctrl = this.controls;

      if (keys[ctrl.block] && !this.isAttacking && !this.isDashing) {
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

    if (this.isAttacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) { this.isAttacking = false; this.attackHit = false; }
    }
    if (this.isUppercut) {
      this.uppercutTimer -= dt;
      if (this.uppercutTimer <= 0) { this.isUppercut = false; this.uppercutHit = false; }
    }
    if (this.isShockwave) {
      this.shockwaveTimer -= dt;
      if (this.shockwaveTimer <= 0) { this.isShockwave = false; this.shockwaveHit = false; }
    }
    if (this.isInvisible) {
      this.invisTimer -= dt;
      if (this.invisTimer <= 0) this.isInvisible = false;
    }
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this._applyActualDamage(this.burnDamage * dt);
    }
    if (this.turret && this.turret.active) {
      this.turret.timer -= dt;
      this.turret.shootCooldown = Math.max(0, (this.turret.shootCooldown || 0) - dt);
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

  // ── AI: decision tick (infrequent) ─────────────────────────────────
  _updateAIDecision(dt, worldW, worldH) {
    this._aiTimer -= dt;
    const level = this._aiLevel;
    // Reaction time: level 1 = 0.4s, level 6 = 0.05s
    const reactionTime = Math.max(0.05, 0.42 - level * 0.06) + Math.random() * 0.08;

    const targets = (this._aiTargets || []).filter(t => !t._dead && !t.isDead);

    if (!targets.length) {
      this._aiWantLeft = false; this._aiWantRight = false;
      return;
    }

    // Pick closest target
    const target = targets.reduce((best, t) =>
      Math.abs(t.x - this.x) < Math.abs(best.x - this.x) ? t : best, targets[0]);

    const myCx   = this.x + this.w / 2;
    const tgtCx  = target.x + target.w / 2;
    const dx      = tgtCx - myCx;
    const absDx   = Math.abs(dx);
    const dy      = target.y - this.y;
    const ATTACK_RANGE = this.attackRange + 20;

    // Always face target (every frame via _applyAIMovement reads this)
    this._aiTargetCx = tgtCx;
    this._aiTargetDy = dy;
    this._aiTarget   = target;

    if (this._aiTimer > 0) return; // decisions only on timer
    this._aiTimer = reactionTime;

    // ── Movement decisions ──
    this._aiWantLeft  = false;
    this._aiWantRight = false;
    this._aiWantJump  = false;

    const edgeLeft  = this.x < 80;
    const edgeRight = this.x + this.w > worldW - 80;

    if (absDx > ATTACK_RANGE + 20) {
      // Move toward target
      if (dx > 0) this._aiWantRight = true;
      else         this._aiWantLeft  = true;
    } else if (absDx < ATTACK_RANGE * 0.5) {
      // Too close — back up a little (except high levels that like to be in face)
      if (level < 4) {
        if (dx > 0) this._aiWantLeft  = true;
        else         this._aiWantRight = true;
      }
    }

    // Edge avoidance: turn around if near edge
    if (edgeLeft  && this._aiWantLeft)  { this._aiWantLeft  = false; this._aiWantRight = true; }
    if (edgeRight && this._aiWantRight) { this._aiWantRight = false; this._aiWantLeft  = true; }

    // Jump decision: target is above, or we need to cross a gap, or edge-dodge
    if (this.onGround) {
      const targetAbove = dy < -80;
      const needsJump   = edgeLeft || edgeRight || targetAbove;
      if (needsJump && level >= 2) this._aiWantJump = true;
      if (level >= 4 && Math.random() < 0.2) this._aiWantJump = true; // random jumps to be unpredictable
    }

    // ── Combat decisions ──
    if (absDx <= ATTACK_RANGE + 10 && !target.isInvisible) {
      this.tryAttack();
    }

    // Ability use
    const abilityChance = 0.15 + level * 0.08;
    if (level >= 2 && Math.random() < abilityChance) {
      this.tryAbility();
    }

    // Block
    if (level >= 4 && Math.random() < 0.1) {
      this.isBlocking = true;
      this._blockReleaseTimer = 0.3 + Math.random() * 0.3;
    }
  }

  // ── AI: apply movement every frame (smooth!) ────────────────────────
  _applyAIMovement(dt, slow) {
    if (this._blockReleaseTimer > 0) {
      this._blockReleaseTimer -= dt;
      if (this._blockReleaseTimer <= 0) this.isBlocking = false;
    }

    if (this.isBlocking) return; // don't move while blocking

    // Compute facing from actual target position every frame
    if (this._aiTarget && !this._aiTarget._dead) {
      const tgtCx = this._aiTarget.x + this._aiTarget.w / 2;
      const myCx  = this.x + this.w / 2;
      this.facing  = tgtCx > myCx ? 1 : -1;
    }

    if (this._aiWantLeft)  { this.vx = -this.moveSpeed * slow; }
    if (this._aiWantRight) { this.vx =  this.moveSpeed * slow; }

    // Jump execution
    if (this._aiWantJump) {
      this._aiWantJump = false;
      this.tryJump();
    }
  }

  // ── Jump / Attack / Ability ─────────────────────────────────────────
  tryJump() {
    if (this.isTimeStopped || this.blockStunTimer > 0 || this.lightningStunTimer > 0 || this._dead) return;
    if (this.jumpCount < this.maxJumps) {
      this.vy = this.jumpStrength;
      this.jumpCount++;
      this.onGround = false;
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
        this.uppercutHit = false;
        this.vy = -500; this.abilityCooldown = this.abilityCooldownMax; break;

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
    this.health = this.maxHealth;
    this._displayHealth = this.maxHealth;
    this._tsBufferedDamage = 0;
    this.x = this._respawnX; this.y = this._respawnY;
    this.vx = 0; this.vy = 0;
    this.isTimeStopped = false;
    this.burnTimer = 0;
    this.lightningStunTimer = 0;
    this.blockStunTimer = 0;
    this._aiWantLeft = false; this._aiWantRight = false;
    this._invincTimer = 2.0;
  }

  // ── Hitboxes ──────────────────────────────────────────────────────
  getAttackHitbox() {
    if (!this.isAttacking) return null;
    const range = this.attackRange || 40;
    const hbX = this.facing === 1 ? this.x + this.w : this.x - range;
    return { x: hbX, y: this.y + this.h * 0.1, w: range, h: this.h * 0.8 };
  }
  getDashHitbox() {
    if (!this.isDashing) return null;
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  getShockwaveHitbox() {
    if (!this.isShockwave) return null;
    return { x: this.x - 80, y: this.y, w: this.w + 160, h: this.h };
  }
  getUppercutHitbox() {
    if (!this.isUppercut) return null;
    return { x: this.x - 10, y: this.y - 20, w: this.w + 20, h: this.h + 20 };
  }
  getTurretFireHitbox() {
    if (!this.turret || !this.turret.active || this.turret.shootCooldown > 0) return null;
    const t = this.turret;
    const bx = t.facing === 1 ? t.x + t.w : t.x - 120;
    return { x: bx, y: t.y + t.h * 0.2, w: 120, h: t.h * 0.6 };
  }
  getIceSpikeHitbox() {
    const s = this.iceSpike;
    if (!s || !s.active || s.hit) return null;
    return { x: s.x, y: s.y, w: s.w, h: s.h };
  }

  // ── Damage ─────────────────────────────────────────────────────────
  takeDamage(amount, options = {}) {
    if (this._invincTimer > 0) return;
    if (this.isBlocking && !this.blockOverloaded) return;
    const duringTimeStop = options.duringTimeStop || false;
    if (duringTimeStop && this.isTimeStopped) {
      this._tsBufferedDamage += amount;
      this._tsKnockbackX = (this._tsKnockbackX || 0) + (this.facing * -1) * 200;
      this._tsKnockbackY = (this._tsKnockbackY || 0) - 150;
      return;
    }
    this._applyActualDamage(amount);
    const kbMult = options.kbMult || 1.0;
    this.vx += (this.facing * -1) * 220 * kbMult;
    this.vy  = -160 * kbMult;
  }

  flushTimeStopDamage() {
    if (this._tsBufferedDamage <= 0) return;
    this._applyActualDamage(this._tsBufferedDamage);
    this.vx += (this._tsKnockbackX || 0) * 1.8;
    this.vy  = (this._tsKnockbackY  || -300);
    this._tsBufferedDamage = 0;
    this._tsKnockbackX = 0; this._tsKnockbackY = 0;
  }

  _applyActualDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this._displayHealth = this.health;
    if (this.health <= 0) this._die();
  }

  applyBurn()           { this.burnTimer = this.burnDuration; }
  applySlow(dur)        { this._slowTimer = dur; }
  applyLightningStun(d) { this.lightningStunTimer = d; }

  _die() {
    this.stocks--;
    this._dead = true;
    this._respawnTimer = 2.0;
    this.health = 0; this._displayHealth = 0;
    this.isDashing = false; this.isAttacking = false; this.burnTimer = 0;
    this._aiWantLeft = false; this._aiWantRight = false;
  }

  get healthPct()    { return this._displayHealth / this.maxHealth; }
  get isDead()       { return this.stocks <= 0; }
  get isStunned()    { return this.blockStunTimer > 0 || this.lightningStunTimer > 0; }
  get isEliminated() { return this.isDead; }
}
