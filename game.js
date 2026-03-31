// ================================
// game.js — Main Game Coordinator
// ================================

const Game = (() => {
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');

  let WORLD_W, WORLD_H;
  let state = null;

  // ── Session config (set by menus) ─────────────────────────────────
  let sessionConfig = {
    p1CharId: 'chronomancer',
    p2CharId: 'dasher',
    mapId: 'timestrike',
    matchTime: 60,
    p1Custom: null,
    p2Custom: null,
    mode: 'vs',       // 'vs' | 'story' | 'story_coop'
    storyLevel: 0,
    storyP1CharId: 'chronomancer',
    storyP2CharId: 'dasher',
  };

  // ── Audio ─────────────────────────────────────────────────────────
  let audioCtx = null;
  let musicNodes = {};
  let musicPlaying = false;

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  function playNote(freq, startTime, duration, gainVal, type = 'square') {
    if (!audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, startTime + duration - 0.01);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // Chiptune battle soundtrack — loops every ~8 bars
  let musicTimeout = null;
  let musicStep = 0;

  const MELODY = [
    // freq, duration (s)
    [440,0.15],[0,0.05],[494,0.15],[0,0.05],[523,0.2],[0,0.05],[587,0.3],[0,0.1],
    [523,0.15],[0,0.05],[494,0.15],[0,0.05],[440,0.3],[0,0.15],
    [392,0.15],[0,0.05],[440,0.15],[0,0.05],[494,0.2],[0,0.05],[440,0.3],[0,0.1],
    [392,0.15],[0,0.05],[349,0.15],[0,0.05],[330,0.4],[0,0.2],
  ];

  const BASS = [
    [110,0.4],[0,0.1],[110,0.4],[0,0.1],[98,0.4],[0,0.1],[98,0.4],[0,0.1],
    [110,0.4],[0,0.1],[110,0.4],[0,0.1],[87,0.4],[0,0.1],[87,0.8],[0,0.2],
  ];

  function startMusic() {
    if (musicPlaying || !audioCtx) return;
    musicPlaying = true;
    scheduleMusicLoop();
  }

  function scheduleMusicLoop() {
    if (!musicPlaying || !audioCtx) return;
    const now = audioCtx.currentTime;
    let t = now;

    // melody
    for (const [freq, dur] of MELODY) {
      if (freq > 0) playNote(freq, t, dur, 0.07, 'square');
      t += dur;
    }

    // bass
    t = now;
    for (const [freq, dur] of BASS) {
      if (freq > 0) playNote(freq, t, dur * 2, 0.05, 'sawtooth');
      t += dur * 2;
    }

    // percussion — simple kick/hat pattern
    for (let i = 0; i < 8; i++) {
      const kt = now + i * 0.5;
      playNote(80, kt, 0.1, 0.1, 'sine');       // kick
      if (i % 2 === 1) playNote(800, kt, 0.05, 0.03, 'square'); // hat
    }

    const loopDuration = MELODY.reduce((s,[,d]) => s + d, 0);
    musicTimeout = setTimeout(scheduleMusicLoop, loopDuration * 1000 - 100);
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimeout) clearTimeout(musicTimeout);
    musicTimeout = null;
  }

  // ── Canvas resize ─────────────────────────────────────────────────
  function resizeCanvas() {
    const hud = document.getElementById('hud');
    WORLD_W = window.innerWidth;
    WORLD_H = window.innerHeight - (hud.offsetHeight || 64);
    canvas.width  = WORLD_W;
    canvas.height = WORLD_H;
    if (state) buildPlatforms();
  }

  function buildPlatforms() {
    const map = MAPS.find(m => m.id === sessionConfig.mapId) || MAPS[0];
    state.platforms = map.buildPlatforms(WORLD_W, WORLD_H);
    state.map = map;
  }

  // ── State init ────────────────────────────────────────────────────
  function initState(overrides = {}) {
    state = {
      players: [],
      platforms: [],
      keys: {},
      timeStop: false,
      timeStopTimer: 0,
      timeStopDuration: 3,
      timeStopCooldown: 0,
      timeStopCooldownMax: 10,
      matchTimer: sessionConfig.matchTime,
      running: false,
      paused: false,
      lastTime: null,
      particles: [],
      map: null,
      mode: sessionConfig.mode,
      storyLevel: sessionConfig.storyLevel,
    };
    Object.assign(state, overrides);
    resizeCanvas();

    if (state.mode === 'story' || state.mode === 'story_coop') {
      _initStoryPlayers();
    } else {
      _initVsPlayers();
    }

    buildPlatforms();
  }

  function _getCharConfig(charId, id, facing, custom) {
    const def = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
    const stats = { ...def.stats };
    if (custom) {
      if (custom.hp)  stats.hp  = custom.hp;
      if (custom.spd) stats.speed = custom.spd;
      if (custom.dmg) stats.attackDamage = custom.dmg;
      if (custom.cd)  stats.abilityCooldownMax = custom.cd;
    }
    return {
      id, facing,
      x: facing === 1 ? WORLD_W * 0.2 : WORLD_W * 0.75,
      y: WORLD_H - 200,
      color: def.color,
      charId: def.id,
      abilityType: def.ability,
      maxHp: stats.hp,
      speed: stats.speed,
      jumpStrength: stats.jumpStrength,
      attackDamage: stats.attackDamage,
      attackCooldownMax: stats.attackCooldownMax,
      abilityCooldownMax: stats.abilityCooldownMax,
    };
  }

  function _initVsPlayers() {
    const cfg1 = _getCharConfig(sessionConfig.p1CharId, 1,  1, sessionConfig.p1Custom);
    const cfg2 = _getCharConfig(sessionConfig.p2CharId, 2, -1, sessionConfig.p2Custom);
    state.players = [new Player(cfg1), new Player(cfg2)];
  }

  function _initStoryPlayers() {
    const level   = sessionConfig.storyLevel;
    const npcDef  = STORY_NPCS[level];
    const charDef = CHARACTERS.find(c => c.id === npcDef.charId) || CHARACTERS[0];

    const p1Cfg = _getCharConfig(sessionConfig.storyP1CharId, 1, 1, null);
    state.players = [new Player(p1Cfg)];

    if (state.mode === 'story_coop') {
      const p2Cfg = _getCharConfig(sessionConfig.storyP2CharId, 2, 1, null);
      p2Cfg.x = WORLD_W * 0.35;
      p2Cfg._isAlly = true;
      state.players.push(new Player(p2Cfg));
    }

    // NPC
    const npcStats = { ...charDef.stats };
    npcStats.hp    = Math.round(npcStats.hp    * npcDef.hpMult);
    npcStats.speed = Math.round(npcStats.speed * npcDef.speedMult);
    npcStats.attackDamage = Math.round(npcStats.attackDamage * npcDef.damageMult);

    const npc = new Player({
      id: 99,
      x: WORLD_W * 0.75, y: WORLD_H - 200,
      facing: -1,
      color: npcDef.isBoss ? '#ff0000' : (charDef.color),
      charId: charDef.id,
      abilityType: charDef.ability,
      maxHp: npcStats.hp,
      speed: npcStats.speed,
      jumpStrength: npcStats.jumpStrength || -620,
      attackDamage: npcStats.attackDamage,
      attackCooldownMax: npcStats.attackCooldownMax || 1.0,
      abilityCooldownMax: npcStats.abilityCooldownMax || 8,
      isNPC: true,
      aiLevel: npcDef.aiLevel,
    });
    npc._aiTarget = state.players[0];
    state.npc = npc;
    state.players.push(npc);

    // Boss special display
    if (npcDef.isBoss) {
      document.getElementById('story-level-display').classList.remove('hidden');
      document.getElementById('story-level-display').textContent = `⚠ FINAL BOSS`;
    } else {
      document.getElementById('story-level-display').classList.remove('hidden');
      document.getElementById('story-level-display').textContent = `LEVEL ${level + 1} / 10`;
    }
  }

  // ── Input ─────────────────────────────────────────────────────────
  const jumpPressed = { 1: false, 2: false };

  function onKeyDown(e) {
    const k = e.key === ' ' ? 'Space' : e.key;
    if (!state) return;

    // Pause toggle
    if (k === 'Escape') {
      togglePause();
      return;
    }

    if (state.paused) return;
    state.keys[k] = true;

    if ((k === 'w' || k === 'W') && !jumpPressed[1]) {
      jumpPressed[1] = true;
      if (state.players[0]) state.players[0].tryJump();
    }
    if (k === 'ArrowUp' && !jumpPressed[2]) {
      jumpPressed[2] = true;
      const p2 = state.players.find(p => p.id === 2);
      if (p2) p2.tryJump();
    }

    if (k === 'x' || k === 'X') { if (state.players[0]) state.players[0].tryAttack(); }
    if (k === '1') { const p2 = state.players.find(p => p.id === 2); if (p2) p2.tryAttack(); }

    if ((k === 'z' || k === 'Z') && !state.timeStop) {
      if (state.players[0] && state.players[0].abilityType === 'timestop') activateTimeStop();
      else if (state.players[0]) state.players[0].tryAbility();
    }
    if (k === '0') {
      const p2 = state.players.find(p => p.id === 2);
      if (p2 && !p2._isNPC) {
        if (p2.abilityType === 'timestop') activateTimeStop();
        else p2.tryAbility();
      }
    }

    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)) e.preventDefault();
  }

  function onKeyUp(e) {
    const k = e.key === ' ' ? 'Space' : e.key;
    if (!state) return;
    state.keys[k] = false;
    if (k === 'w' || k === 'W') jumpPressed[1] = false;
    if (k === 'ArrowUp') jumpPressed[2] = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);
  window.addEventListener('resize',  resizeCanvas);

  // ── Pause ─────────────────────────────────────────────────────────
  function togglePause() {
    if (!state || !state.running) return;
    state.paused = !state.paused;
    if (state.paused) {
      stopMusic();
      showScreen('pause-screen');
    } else {
      initAudio();
      startMusic();
      showScreen('game-screen');
      requestAnimationFrame(loop);
    }
  }

  // ── Time Stop ─────────────────────────────────────────────────────
  function activateTimeStop() {
    const p1 = state.players[0];
    if (p1.abilityCooldown > 0) return;

    state.timeStop      = true;
    state.timeStopTimer = state.timeStopDuration;
    p1.abilityCooldown  = p1.abilityCooldownMax;

    state.players.forEach((p, i) => {
      if (i !== 0) p.isTimeStopped = true;
    });
    if (state.npc) state.npc.isTimeStopped = true;

    document.body.classList.add('time-stopped');
    document.getElementById('time-stop-overlay').classList.remove('hidden');
    spawnParticles(WORLD_W / 2, WORLD_H / 2, '#c77dff', 30);
  }

  function deactivateTimeStop() {
    state.timeStop = false;
    state.players.forEach(p => p.isTimeStopped = false);
    document.body.classList.remove('time-stopped');
    document.getElementById('time-stop-overlay').classList.add('hidden');
  }

  // ── Particles ─────────────────────────────────────────────────────
  function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 200;
      const p = {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 4,
      };
      p.maxLife = p.life;
      state.particles.push(p);
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 300 * dt; p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Combat ────────────────────────────────────────────────────────
  function checkCombat() {
    const players = state.players;

    for (let i = 0; i < players.length; i++) {
      const attacker = players[i];

      for (let j = 0; j < players.length; j++) {
        if (i === j) continue;
        const target = players[j];

        // Coop ally protection
        if (state.mode === 'story_coop' && attacker._isAlly && target._isAlly) continue;
        if (state.mode === 'story_coop' && !attacker._isNPC && !target._isNPC) continue;

        // Basic attack
        if (attacker.isAttacking && !attacker.attackHit) {
          const hb = attacker.getAttackHitbox();
          if (hb && Engine.rectsOverlap(hb, target)) {
            target.takeDamage(attacker.attackDamage);
            attacker.attackHit = true;
            spawnParticles(target.x + target.w/2, target.y + target.h/2, attacker.color, 10);
          }
        }

        // Dash hit
        if (attacker.isDashing && !attacker.dashHit) {
          const hb = attacker.getDashHitbox();
          if (hb && Engine.rectsOverlap(hb, target)) {
            target.takeDamage(attacker.dashDamage);
            attacker.dashHit = true;
            spawnParticles(target.x + target.w/2, target.y + target.h/2, '#ff8800', 14);
          }
        }

        // Shockwave
        if (attacker.isShockwave && !attacker.shockwaveHit) {
          const hb = attacker.getShockwaveHitbox();
          if (hb && Engine.rectsOverlap(hb, target)) {
            target.takeDamage(22);
            target.vx = Math.sign(target.x - attacker.x) * 400;
            attacker.shockwaveHit = true;
            spawnParticles(attacker.x + attacker.w/2, attacker.y + attacker.h/2, '#f5a623', 20);
          }
        }

        // Burn projectile
        if (attacker._wantsBurn) {
          // Apply burn to nearest enemy within range
          if (Math.abs(attacker.x - target.x) < 200) {
            target.applyBurn();
            spawnParticles(target.x + target.w/2, target.y, '#ff6b35', 15);
          }
        }

        // Turret fire
        if (attacker.turret && attacker.turret.active && attacker.turret.shootCooldown <= 0) {
          const hb = attacker.getTurretFireHitbox();
          if (hb && Engine.rectsOverlap(hb, target)) {
            target.takeDamage(attacker.turret.damage);
            attacker.turret.shootCooldown = attacker.turret.shootCooldownMax;
            spawnParticles(target.x + target.w/2, target.y + target.h/2, '#00e676', 6);
          }
        }
      }

      // Clear one-shot burn flag
      attacker._wantsBurn = false;
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────
  function updateHUD() {
    const p1 = state.players[0];
    const isStory = state.mode === 'story' || state.mode === 'story_coop';
    const enemy = state.npc || state.players[1];
    const p2display = isStory ? enemy : state.players[1];

    if (!p1 || !p2display) return;

    document.getElementById('p1-health-bar').style.width  = (p1.healthPct * 100) + '%';
    document.getElementById('p2-health-bar').style.width  = (p2display.healthPct * 100) + '%';
    document.getElementById('p1-health-text').textContent = Math.ceil(p1.health);
    document.getElementById('p2-health-text').textContent = Math.ceil(p2display.health);

    // Char names
    const p1Def = CHARACTERS.find(c => c.id === p1.charId) || {};
    const p2Def = CHARACTERS.find(c => c.id === p2display.charId) || {};
    document.getElementById('p1-char-name').textContent = p1Def.name || '';
    document.getElementById('p2-char-name').textContent = p2Def.name || '';

    // Ability indicators
    const p1AbilEl = document.getElementById('p1-ability-status');
    const p1Key    = p1.abilityType === 'timestop' ? 'Z' : 'Z';
    if (p1.abilityCooldown > 0) {
      p1AbilEl.textContent = `${p1Key}: ${p1.abilityCooldown.toFixed(1)}s`;
      p1AbilEl.classList.remove('ready');
    } else {
      p1AbilEl.textContent = `${p1Key}: READY`;
      p1AbilEl.classList.add('ready');
    }

    if (!isStory) {
      const p2 = state.players[1];
      const p2AbilEl = document.getElementById('p2-ability-status');
      if (p2.abilityCooldown > 0) {
        p2AbilEl.textContent = `0: ${p2.abilityCooldown.toFixed(1)}s`;
        p2AbilEl.classList.remove('ready');
      } else {
        p2AbilEl.textContent = '0: READY';
        p2AbilEl.classList.add('ready');
      }
    }

    // Block status
    const updateBlockStatus = (player, elId) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (player.isStunned) {
        el.textContent = `STUNNED ${player.blockStunTimer.toFixed(1)}s`;
        el.style.color = '#ff4444';
      } else if (player.blockOverloaded) {
        el.textContent = 'OVERLOADED';
        el.style.color = '#ff8800';
      } else if (player.isBlocking) {
        const pct = Math.round((player.blockHoldTime / player.BLOCK_OVERLOAD_TIME) * 100);
        el.textContent = `BLOCKING ${pct}%`;
        el.style.color = '#00ffff';
      } else {
        el.textContent = '';
      }
    };
    updateBlockStatus(p1, 'p1-block-status');
    if (!isStory && state.players[1]) updateBlockStatus(state.players[1], 'p2-block-status');

    const timerEl = document.getElementById('timer-display');
    if (sessionConfig.matchTime >= 9999) {
      timerEl.textContent = '∞';
    } else {
      timerEl.textContent = Math.ceil(Math.max(0, state.matchTimer));
    }
  }

  // ── Main Loop ─────────────────────────────────────────────────────
  function loop(timestamp) {
    if (!state || !state.running || state.paused) return;

    const dt = Math.min((timestamp - (state.lastTime || timestamp)) / 1000, 0.05);
    state.lastTime = timestamp;

    if (sessionConfig.matchTime < 9999) {
      state.matchTimer -= dt;
    }

    if (state.timeStop) {
      state.timeStopTimer -= dt;
      if (state.timeStopTimer <= 0) deactivateTimeStop();
    }

    // Pass keys to non-NPC players
    state.players.forEach(p => {
      if (!p._isNPC) p.keys = state.keys;
    });

    // Update
    state.players.forEach(p => p.update(dt, state.platforms, WORLD_W, WORLD_H, state.timeStop));
    if (state.npc) state.npc.update(dt, state.platforms, WORLD_W, WORLD_H, state.timeStop);

    checkCombat();
    updateParticles(dt);

    // ── Render ──
    Engine.clearCanvas(ctx, canvas);
    Engine.drawBackground(ctx, canvas, state.timeStop, state.map);
    if (state.timeStop) Engine.drawTimeStopEffect(ctx, canvas, 1);
    Engine.drawPlatforms(ctx, state.platforms, state.map);

    // Draw turrets
    state.players.forEach(p => {
      if (p.turret) Engine.drawTurret(ctx, p.turret);
    });

    state.players.forEach(p => {
      Engine.drawAttackHitbox(ctx, p);
      Engine.drawPlayer(ctx, p, state.timeStop);
      Engine.drawAbilityCooldown(ctx, p);
    });

    drawParticles();
    updateHUD();

    // Win check
    const isStory = state.mode === 'story' || state.mode === 'story_coop';
    const humanPlayers = state.players.filter(p => !p._isNPC);

    if (isStory) {
      const npc = state.npc;
      const allHumansDead = humanPlayers.every(p => p.isDead);
      if (npc.isDead || allHumansDead || state.matchTimer <= 0) {
        endGame(); return;
      }
    } else {
      const [p1, p2] = state.players;
      if (p1.isDead || p2.isDead || state.matchTimer <= 0) {
        endGame(); return;
      }
    }

    requestAnimationFrame(loop);
  }

  // ── End Game ──────────────────────────────────────────────────────
  function endGame() {
    state.running = false;
    deactivateTimeStop();
    stopMusic();

    const isStory = state.mode === 'story' || state.mode === 'story_coop';
    const winnerEl = document.getElementById('winner-text');
    const storyContinueWrap = document.getElementById('story-continue-btn-wrap');
    const rematchBtn = document.getElementById('rematch-btn');
    storyContinueWrap.classList.add('hidden');

    if (isStory) {
      const npc = state.npc;
      const humanPlayers = state.players.filter(p => !p._isNPC);
      const allHumansDead = humanPlayers.every(p => p.isDead);
      if (!npc.isDead && (allHumansDead || state.matchTimer <= 0)) {
        winnerEl.textContent = 'DEFEATED...';
        winnerEl.style.color = '#ff4444';
        rematchBtn.textContent = 'TRY AGAIN';
      } else {
        const level = sessionConfig.storyLevel;
        const npcName = STORY_NPCS[level]?.name || 'Enemy';
        winnerEl.textContent = `${npcName} DEFEATED!`;
        winnerEl.style.color = '#ffd700';
        rematchBtn.textContent = 'RETRY LEVEL';
        if (level < 9) {
          storyContinueWrap.classList.remove('hidden');
        } else {
          winnerEl.textContent = '🏆 YOU WIN THE GAME!';
          winnerEl.style.color = '#ffd700';
        }
      }
    } else {
      const [p1, p2] = state.players;
      rematchBtn.textContent = 'REMATCH';
      if (p1.isDead && !p2.isDead) {
        winnerEl.textContent = 'PLAYER 2 WINS!';
        winnerEl.style.color = '#ff4d4d';
      } else if (p2.isDead && !p1.isDead) {
        winnerEl.textContent = 'PLAYER 1 WINS!';
        winnerEl.style.color = '#00d4ff';
      } else if (p1.health > p2.health) {
        winnerEl.textContent = 'PLAYER 1 WINS! (HP)';
        winnerEl.style.color = '#00d4ff';
      } else if (p2.health > p1.health) {
        winnerEl.textContent = 'PLAYER 2 WINS! (HP)';
        winnerEl.style.color = '#ff4d4d';
      } else {
        winnerEl.textContent = 'DRAW!';
        winnerEl.style.color = '#ffd700';
      }
    }

    showScreen('gameover-screen');
  }

  // ── Screen helpers ────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function startGame() {
    initAudio();
    initState();
    showScreen('game-screen');
    state.running = true;
    state.lastTime = null;
    startMusic();
    requestAnimationFrame(loop);
  }

  // ── UI Population helpers ─────────────────────────────────────────
  function populateCharSelects(selectIds) {
    selectIds.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      CHARACTERS.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.emoji} ${c.name}`;
        sel.appendChild(opt);
      });
    });
  }

  function populateMapSelects(selectIds) {
    selectIds.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      MAPS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.emoji} ${m.name}`;
        sel.appendChild(opt);
      });
    });
  }

  function buildCharCards(containerId, onSelect, defaultId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    CHARACTERS.forEach(c => {
      const card = document.createElement('div');
      card.className = 'char-card' + (c.id === defaultId ? ' selected' : '');
      card.dataset.id = c.id;
      card.innerHTML = `<div class="char-emoji">${c.emoji}</div><div class="char-card-name">${c.name}</div><div class="char-card-desc">${c.description}</div>`;
      card.addEventListener('click', () => {
        container.querySelectorAll('.char-card').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        onSelect(c.id);
      });
      container.appendChild(card);
    });
  }

  function buildMapCards(containerId, onSelect, defaultId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    MAPS.forEach(m => {
      const card = document.createElement('div');
      card.className = 'map-card' + (m.id === defaultId ? ' selected' : '');
      card.dataset.id = m.id;
      card.innerHTML = `<div class="map-emoji">${m.emoji}</div><div class="map-card-name">${m.name}</div>`;
      card.addEventListener('click', () => {
        container.querySelectorAll('.map-card').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        onSelect(m.id);
      });
      container.appendChild(card);
    });
  }

  // ── Menu Buttons ──────────────────────────────────────────────────

  // Quick Fight → char select
  document.getElementById('start-btn').addEventListener('click', () => {
    sessionConfig.mode = 'vs';
    sessionConfig.p1Custom = null;
    sessionConfig.p2Custom = null;
    sessionConfig.matchTime = 60;

    buildCharCards('p1-chars', id => { sessionConfig.p1CharId = id; }, sessionConfig.p1CharId);
    buildCharCards('p2-chars', id => { sessionConfig.p2CharId = id; }, sessionConfig.p2CharId);
    buildMapCards('map-cards', id => { sessionConfig.mapId = id; }, sessionConfig.mapId);

    showScreen('char-select-screen');
  });

  document.getElementById('char-confirm-btn').addEventListener('click', startGame);
  document.getElementById('char-back-btn').addEventListener('click', () => showScreen('menu-screen'));

  // Controls
  document.getElementById('controls-btn').addEventListener('click', () => showScreen('controls-screen'));
  document.getElementById('back-btn').addEventListener('click', () => showScreen('menu-screen'));

  // Custom Match
  document.getElementById('custom-match-btn').addEventListener('click', () => {
    populateCharSelects(['custom-p1-char','custom-p2-char']);
    populateMapSelects(['custom-map']);
    showScreen('custom-screen');
  });

  const makeSliderSync = (sliderId, valId) => {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(valId);
    if (!slider || !display) return;
    display.textContent = slider.value;
    slider.addEventListener('input', () => { display.textContent = slider.value; });
  };
  makeSliderSync('custom-p1-hp',  'custom-p1-hp-val');
  makeSliderSync('custom-p1-spd', 'custom-p1-spd-val');
  makeSliderSync('custom-p1-dmg', 'custom-p1-dmg-val');
  makeSliderSync('custom-p1-cd',  'custom-p1-cd-val');
  makeSliderSync('custom-p2-hp',  'custom-p2-hp-val');
  makeSliderSync('custom-p2-spd', 'custom-p2-spd-val');
  makeSliderSync('custom-p2-dmg', 'custom-p2-dmg-val');
  makeSliderSync('custom-p2-cd',  'custom-p2-cd-val');

  document.getElementById('custom-back-btn').addEventListener('click', () => showScreen('menu-screen'));

  document.getElementById('custom-start-btn').addEventListener('click', () => {
    sessionConfig.mode = 'vs';
    sessionConfig.p1CharId = document.getElementById('custom-p1-char').value;
    sessionConfig.p2CharId = document.getElementById('custom-p2-char').value;
    sessionConfig.mapId    = document.getElementById('custom-map').value;
    sessionConfig.matchTime = parseInt(document.getElementById('custom-time').value);

    sessionConfig.p1Custom = {
      hp:  parseInt(document.getElementById('custom-p1-hp').value),
      spd: parseInt(document.getElementById('custom-p1-spd').value),
      dmg: parseInt(document.getElementById('custom-p1-dmg').value),
      cd:  parseInt(document.getElementById('custom-p1-cd').value),
    };
    sessionConfig.p2Custom = {
      hp:  parseInt(document.getElementById('custom-p2-hp').value),
      spd: parseInt(document.getElementById('custom-p2-spd').value),
      dmg: parseInt(document.getElementById('custom-p2-dmg').value),
      cd:  parseInt(document.getElementById('custom-p2-cd').value),
    };
    startGame();
  });

  // Story Mode
  document.getElementById('story-btn').addEventListener('click', () => {
    populateCharSelects(['story-p1-char','story-p2-char']);
    sessionConfig.storyLevel = 0;
    showScreen('story-select-screen');
  });

  let storyModeSolo = true;
  document.getElementById('story-solo').addEventListener('click', () => {
    storyModeSolo = true;
    document.getElementById('story-solo').classList.add('selected');
    document.getElementById('story-coop').classList.remove('selected');
    document.getElementById('story-p2-select').style.display = 'none';
  });
  document.getElementById('story-coop').addEventListener('click', () => {
    storyModeSolo = false;
    document.getElementById('story-coop').classList.add('selected');
    document.getElementById('story-solo').classList.remove('selected');
    document.getElementById('story-p2-select').style.display = 'block';
  });

  document.getElementById('story-back-btn').addEventListener('click', () => showScreen('menu-screen'));
  document.getElementById('story-start-btn').addEventListener('click', () => {
    sessionConfig.mode = storyModeSolo ? 'story' : 'story_coop';
    sessionConfig.storyP1CharId = document.getElementById('story-p1-char').value;
    sessionConfig.storyP2CharId = document.getElementById('story-p2-char').value;
    sessionConfig.matchTime = 60;
    sessionConfig.mapId = MAPS[sessionConfig.storyLevel % MAPS.length].id;
    startGame();
  });

  // Pause screen
  document.getElementById('resume-btn').addEventListener('click', () => {
    state.paused = false;
    initAudio();
    startMusic();
    showScreen('game-screen');
    state.lastTime = null;
    requestAnimationFrame(loop);
  });

  document.getElementById('restart-btn').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('pause-menu-btn').addEventListener('click', () => {
    if (state) { state.running = false; state.paused = false; }
    stopMusic();
    showScreen('menu-screen');
  });

  // Game Over
  document.getElementById('story-continue-btn').addEventListener('click', () => {
    sessionConfig.storyLevel++;
    sessionConfig.mapId = MAPS[sessionConfig.storyLevel % MAPS.length].id;
    startGame();
  });

  document.getElementById('rematch-btn').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('menu-btn').addEventListener('click', () => {
    if (state) state.running = false;
    stopMusic();
    showScreen('menu-screen');
  });

  // Init
  showScreen('menu-screen');
})();
