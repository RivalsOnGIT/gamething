// ================================
// player.js — Player Logic (with stocks, timestop damage buffer, freeze slow, teleport, lightning)
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

    // Time-stop damage buffer: damage dealt during freeze is hidden until freeze ends
    this._tsBufferedDamage = 0;  // total damage dealt to this player during time stop
    this._displayHealth = this.health; // what the HUD shows

    this.color       = config.color    || '#ffffff';
    this.accentColor = config.accentColor || config.color || '#ffffff';
    this.id          = config.id;
    this.charId      = config.charId   || 'chronomancer';
    this.abilityType = config.abilityType || 'timestop';
    this.shape       = config.shape    || 'default';

    // Movement
    this.moveSpeed    = config.speed        || 420;
    this.jumpStrength = config.jumpStrength || -620;
    this.jumpCount    = 0; this.maxJumps = 2;
    this._slowTimer   = 0; // icy slow

    // Attack
    this.isAttacking       = false;
    this.attackTimer       = 0;
    this.attackDuration    = 0.18;
    this.attackCooldown    = 0;
    this.attackCooldownMax = config.attackCooldownMax || 1.0;
    this.attackDamage      = config.attackDamage      || 12;
    this.attackHit         = false;
    this.attackRange       = config.attackRange || 40; // brawler gets wider

    // Ability
    this.abilityCooldown    = 0;
    this.abilityCooldownMax = config.abilityCooldownMax || 10;

    // Stocks
    this.stocks    = config.stocks   !== undefined ? config.stocks : 3;
    this.maxStocks = config.maxStocks !== undefined ? config.maxStocks : 3;

    // State flags
    this.isTimeStopped   = false;
    this.isOutOfBounds   = false;

    // Dash
    this.isDashing     = false;
    this.dashTimer     = 0;
    this.dashDuration  = 0.22;
    this.dashSpeed     = 700;
    this.dashCooldown  = 0;
    this.dashCooldownMax = config.abilityCooldownMax || 5;
    this.dashDamage    = 18;
    this.dashHit       = false;

    // Block
    this.isBlocking       = false;
    this.blockHoldTime    = 0;
    this.blockOverloaded  = false;
    this.blockStunTimer   = 0;
    this.BLOCK_OVERLOAD_TIME = 3.0;
    this.BLOCK_STUN_DURATION = 3.0;

    // Phantom
    this.isInvisible   = false;
    this.invisTimer    = 0;
    this.invisDuration = 2.0;

    // Pyro burn
    this.burnTimer  = 0;
    this.burnDamage = 5;
    this.burnDuration = 3.0;

    // Turret (Techno)
    this.turret = null;

    // Shockwave (Titan)
    this.isShockwave       = false;
    this.shockwaveTimer    = 0;
    this.shockwaveDuration = 0.3;
    this.shockwaveHit      = false;

    // Uppercut (Brawler)
    this.isUppercut       = false;
    this.uppercutTimer    = 0;
    this.uppercutDuration = 0.25;
    this.uppercutHit      = false;

    // Lightning stun (Stormbolt)
    this.lightningStunTimer = 0;

    // Ice spike (Glacius)
    this.iceSpike = null; // { x, y, vx, active }

    // Teleport (Wraith)
    this._teleportFlash = 0;

    // Input
    this.keys = {};
    this._mobileKeys = {}; // for on-screen buttons

    // AI
    this._isNPC    = config.isNPC || false;
    this._aiLevel  = config.aiLevel || 1;
    this._aiTimer  = 0;
    this._isEnemy  = config.isNPC || false;
    this._isAlly   = config.isAlly || false;
    this._aiTargets = []; // set by game each frame

    // Respawn
    this._dead          = false;
    this._respawnTimer  = 0;
    this._respawnX      = config.x;
    this._respawnY      = config.y;
    this._invincTimer   = 0; // brief invincibility after respawn
  }

  get controls() {
    if (this.id === 1) return { left:'a', right:'d', jump:'w', attack:'x', ability:'z', block:'s' };
    return { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp', attack:'1', ability:'0', block:'ArrowDown' };
  }

  _getEffectiveKeys() {
    // Merge keyboard and mobile keys
    const k = {};
    const src1 = this.keys || {};
    const src2 = this._mobileKeys || {};
    for (const key in src1) if (src1[key]) k[key] = true;
    for (const key in src2) if (src2[key]) k[key] = true;
    return k;
  }

  update(dt, platforms, worldW, worldH, timeStopActive) {
    // Respawning
    if (this._dead) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this._respawn(worldW, worldH);
      return;
    }

    if (this._invincTimer > 0) this._invincTimer -= dt;

    if (this.isTimeStopped) {
      this._tickCooldowns(dt);
      return;
    }

    // Lightning stun
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

    if (this._isNPC) this._runAI(dt, worldW, worldH);

    const keys = this._getEffectiveKeys();
    const ctrl = this.controls;
    const slow = this._slowTimer > 0 ? 0.5 : 1.0;
    if (this._slowTimer > 0) this._slowTimer -= dt;

    if (!this._isNPC) {
      // Block
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
        if (keys[ctrl.left]) { this.vx = -this.moveSpeed * slow; this.facing = -1; }
        else if (keys[ctrl.right]) { this.vx = this.moveSpeed * slow; this.facing = 1; }
      }
    }

    if (this.isDashing) {
      this.vx = this.facing * this.dashSpeed;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) { this.isDashing = false; this.dashHit = false; }
    }

    // Ice spike movement
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

  // ── AI ────────────────────────────────────────────────────────────
  _runAI(dt, worldW, worldH) {
    this._aiTimer -= dt;
    if (this._aiTimer > 0) return;
    const reactionTime = Math.max(0.08, 0.5 - this._aiLevel * 0.07);
    this._aiTimer = reactionTime + Math.random() * 0.15;

    // Pick closest living human target
    const targets = (this._aiTargets || []).filter(t => !t._dead && !t.isDead);
    if (!targets.length) return;
    const target = targets.reduce((best, t) => {
      return Math.abs(t.x - this.x) < Math.abs(best.x - this.x) ? t : best;
    }, targets[0]);

    const dx = target.x - this.x;
    const dist = Math.abs(dx);

    if (dist > 80) { this.vx = Math.sign(dx)*this.moveSpeed; this.facing = Math.sign(dx); }
    else if (dist < 40) { this.vx = -Math.sign(dx)*this.moveSpeed*0.5; }
    else { this.vx = 0; }

    if (this._aiLevel >= 2 && (target.y < this.y - 60 || this.x < 30 || this.x > worldW-60)) {
      if (this.onGround) { this.vy = this.jumpStrength; this.jumpCount=1; this.onGround=false; }
    }

    if (dist < 80 && !target.isInvisible) this.tryAttack();
    if (this._aiLevel >= 3 && Math.random() < 0.25) this.tryAbility();
    if (this._aiLevel >= 4 && Math.random() < 0.15) {
      this.isBlocking = true;
      setTimeout(() => { if(this) this.isBlocking=false; }, 350);
    }
  }

  tryJump() {
    if (this.isTimeStopped || this.blockStunTimer>0 || this.lightningStunTimer>0 || this._dead) return;
    if (this.jumpCount < this.maxJumps) {
      this.vy = this.jumpStrength;
      this.jumpCount++;
      this.onGround = false;
    }
  }

  tryAttack() {
    if (this.isTimeStopped || this.isBlocking || this.blockStunTimer>0 || this.lightningStunTimer>0 || this._dead) return;
    if (this.isAttacking || this.attackCooldown>0) return;
    this.isAttacking    = true;
    this.attackTimer    = this.attackDuration;
    this.attackCooldown = this.attackCooldownMax;
    this.attackHit      = false;
  }

  tryAbility() {
    if (this.isTimeStopped || this.abilityCooldown>0 || this.blockStunTimer>0 || this._dead) return;
    switch (this.abilityType) {
      case 'dash':
        this.isDashing=true; this.dashTimer=this.dashDuration;
        this.dashHit=false; this.dashCooldown=this.dashCooldownMax;
        this.abilityCooldown=this.abilityCooldownMax; this.vy=-100; break;

      case 'shockwave':
        this.isShockwave=true; this.shockwaveTimer=this.shockwaveDuration;
        this.shockwaveHit=false; this.abilityCooldown=this.abilityCooldownMax; break;

      case 'invisibility':
        this.isInvisible=true; this.invisTimer=this.invisDuration;
        this.abilityCooldown=this.abilityCooldownMax; break;

      case 'burn':
        this._wantsBurn=true; this.abilityCooldown=this.abilityCooldownMax; break;

      case 'turret':
        this.turret = {
          active:true,
          x: this.x+(this.facing===1?this.w+10:-50),
          y: this.y, w:30, h:30,
          timer:8.0, facing:this.facing,
          shootCooldown:0, shootCooldownMax:1.5, damage:8,
        };
        this.abilityCooldown=this.abilityCooldownMax; break;

      case 'freeze':
        // Fire ice spike
        this.iceSpike = {
          active:true,
          x: this.facing===1 ? this.x+this.w : this.x-20,
          y: this.y+this.h*0.4,
          w:16, h:12,
          vx: this.facing*600,
          life:1.2,
          hit:false,
        };
        this.abilityCooldown=this.abilityCooldownMax; break;

      case 'uppercut':
        this.isUppercut=true; this.uppercutTimer=this.uppercutDuration;
        this.uppercutHit=false;
        this.vy = -500; // leap up
        this.abilityCooldown=this.abilityCooldownMax; break;

      case 'teleport':
        this._doTeleport(); break;

      case 'lightning':
        this._wantsLightning=true; this.abilityCooldown=this.abilityCooldownMax; break;

      case 'timestop': break; // handled by game
    }
  }

  _doTeleport() {
    if (!this._aiTargets) return;
    const targets = this._aiTargets.filter(t=>!t._dead);
    if (!targets.length) return;
    const target = targets[0];
    // Appear on the other side of target
    const offset = target.facing === 1 ? -this.w - 10 : target.w + 10;
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
    this._invincTimer = 2.0; // 2s invincibility
  }

  // ── Hitboxes ──────────────────────────────────────────────────────
  getAttackHitbox() {
    if (!this.isAttacking) return null;
    const range = this.attackRange || 40;
    const hbX = this.facing===1 ? this.x+this.w : this.x-range;
    return { x:hbX, y:this.y+this.h*0.1, w:range, h:this.h*0.8 };
  }
  getDashHitbox() {
    if (!this.isDashing) return null;
    return { x:this.x, y:this.y, w:this.w, h:this.h };
  }
  getShockwaveHitbox() {
    if (!this.isShockwave) return null;
    return { x:this.x-80, y:this.y, w:this.w+160, h:this.h };
  }
  getUppercutHitbox() {
    if (!this.isUppercut) return null;
    return { x:this.x-10, y:this.y-20, w:this.w+20, h:this.h+20 };
  }
  getTurretFireHitbox() {
    if (!this.turret||!this.turret.active||this.turret.shootCooldown>0) return null;
    const t=this.turret;
    const bx = t.facing===1 ? t.x+t.w : t.x-120;
    return { x:bx, y:t.y+t.h*0.2, w:120, h:t.h*0.6 };
  }
  getIceSpikeHitbox() {
    const s=this.iceSpike;
    if (!s||!s.active||s.hit) return null;
    return { x:s.x, y:s.y, w:s.w, h:s.h };
  }

  // ── Damage ────────────────────────────────────────────────────────
  takeDamage(amount, options = {}) {
    if (this._invincTimer > 0) return;
    if (this.isBlocking && !this.blockOverloaded) return;

    const duringTimeStop = options.duringTimeStop || false;

    if (duringTimeStop && this.isTimeStopped) {
      // Buffer damage — don't apply to real health yet, don't show on HUD
      this._tsBufferedDamage += amount;
      // Still apply knockback force so it explodes out after
      this._tsKnockbackX = (this._tsKnockbackX||0) + (this.facing*-1)*200;
      this._tsKnockbackY = (this._tsKnockbackY||0) - 150;
      return;
    }

    this._applyActualDamage(amount);
    // Knockback
    const kbMult = options.kbMult || 1.0;
    this.vx += (this.facing*-1) * 220 * kbMult;
    this.vy  = -160 * kbMult;
  }

  // Called when time stop ends — flush buffered damage with big knockback
  flushTimeStopDamage() {
    if (this._tsBufferedDamage <= 0) return;
    this._applyActualDamage(this._tsBufferedDamage);
    // Big knockback
    this.vx += (this._tsKnockbackX || 0) * 1.8;
    this.vy  = (this._tsKnockbackY || -300);
    this._tsBufferedDamage = 0;
    this._tsKnockbackX = 0;
    this._tsKnockbackY = 0;
  }

  _applyActualDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this._displayHealth = this.health;
    if (this.health <= 0) this._die();
  }

  applyBurn() { this.burnTimer = this.burnDuration; }

  applySlow(duration) { this._slowTimer = duration; }

  applyLightningStun(duration) { this.lightningStunTimer = duration; }

  _die() {
    this.stocks--;
    this._dead = true;
    this._respawnTimer = 2.0; // 2 seconds respawn
    this.health = 0;
    this._displayHealth = 0;
    this.isDashing = false;
    this.isAttacking = false;
    this.burnTimer = 0;
  }

  // ── Getters ───────────────────────────────────────────────────────
  get healthPct()    { return this._displayHealth / this.maxHealth; }
  get isDead()       { return this.stocks <= 0; } // truly dead = no stocks
  get isStunned()    { return this.blockStunTimer > 0 || this.lightningStunTimer > 0; }
  get isEliminated() { return this.isDead; }
}
