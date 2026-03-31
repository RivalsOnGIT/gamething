// ================================
// game.js — Main Game Loop
// ================================

const Game = (() => {
  // ── Canvas ────────────────────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');

  // ── World ─────────────────────────────────────────────────────────
  let WORLD_W, WORLD_H;

  function resizeCanvas() {
    const hud = document.getElementById('hud');
    WORLD_W = window.innerWidth;
    WORLD_H = window.innerHeight - hud.offsetHeight;
    canvas.width  = WORLD_W;
    canvas.height = WORLD_H;
    if (state) buildPlatforms();
  }

  // ── Game State ────────────────────────────────────────────────────
  let state = null;

  function buildPlatforms() {
    state.platforms = [
      // Ground
      { x: 0,            y: WORLD_H - 40, w: WORLD_W,        h: 40  },
      // Left ledge
      { x: WORLD_W*0.05, y: WORLD_H - 180, w: WORLD_W*0.18, h: 18  },
      // Right ledge
      { x: WORLD_W*0.77, y: WORLD_H - 180, w: WORLD_W*0.18, h: 18  },
      // Center platform
      { x: WORLD_W*0.35, y: WORLD_H - 280, w: WORLD_W*0.30, h: 18  },
      // High left
      { x: WORLD_W*0.10, y: WORLD_H - 380, w: WORLD_W*0.14, h: 18  },
      // High right
      { x: WORLD_W*0.76, y: WORLD_H - 380, w: WORLD_W*0.14, h: 18  },
    ];
  }

  function initState() {
    state = {
      players: [],
      platforms: [],
      keys: {},
      prevKeys: {},
      timeStop: false,
      timeStopTimer: 0,
      timeStopDuration: 3,
      timeStopCooldown: 0,
      timeStopCooldownMax: 10,
      matchTimer: 60,
      running: false,
      lastTime: null,
      particles: [],
    };

    resizeCanvas();

    const p1 = new Player({
      id: 1,
      x: WORLD_W * 0.2,
      y: WORLD_H - 200,
      color: '#00d4ff',
      facing: 1,
      abilityCooldownMax: 10,
    });

    const p2 = new Player({
      id: 2,
      x: WORLD_W * 0.75,
      y: WORLD_H - 200,
      color: '#ff4d4d',
      facing: -1,
      abilityCooldownMax: 5,
    });

    state.players = [p1, p2];
    buildPlatforms();
  }

  // ── Input ─────────────────────────────────────────────────────────
  const jumpPressed = { 1: false, 2: false };

  function onKeyDown(e) {
    const k = e.key === ' ' ? 'Space' : e.key;
    if (!state) return;
    state.keys[k] = true;

    // Jump — fire once per press
    if ((k === 'w' || k === 'W') && !jumpPressed[1]) {
      jumpPressed[1] = true;
      state.players[0].tryJump();
    }
    if (k === 'ArrowUp' && !jumpPressed[2]) {
      jumpPressed[2] = true;
      state.players[1].tryJump();
    }

    // Attack
    if (k === 'x' || k === 'X') state.players[0].tryAttack();
    if (k === '1')               state.players[1].tryAttack();

    // Abilities
    if ((k === 'z' || k === 'Z') && !state.timeStop) activateTimeStop();
    if (k === '0')               state.players[1].tryAbility();

    // Prevent arrow key scroll
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const k = e.key === ' ' ? 'Space' : e.key;
    if (!state) return;
    state.keys[k] = false;
    if (k === 'w' || k === 'W') jumpPressed[1] = false;
    if (k === 'ArrowUp')        jumpPressed[2] = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);
  window.addEventListener('resize',  resizeCanvas);

  // ── Time Stop ─────────────────────────────────────────────────────
  function activateTimeStop() {
    const p1 = state.players[0];
    if (p1.abilityCooldown > 0) return;

    state.timeStop      = true;
    state.timeStopTimer = state.timeStopDuration;
    p1.abilityCooldown  = p1.abilityCooldownMax;

    // Freeze P2 (and any future entities except P1)
    state.players[1].isTimeStopped = true;

    // CSS visual
    document.body.classList.add('time-stopped');
    document.getElementById('time-stop-overlay').classList.remove('hidden');

    spawnParticles(WORLD_W / 2, WORLD_H / 2, '#c77dff', 30);
  }

  function deactivateTimeStop() {
    state.timeStop = false;
    state.players[1].isTimeStopped = false;
    document.body.classList.remove('time-stopped');
    document.getElementById('time-stop-overlay').classList.add('hidden');
  }

  // ── Particles ─────────────────────────────────────────────────────
  function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 200;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0,
        color,
        size: 2 + Math.random() * 4,
      });
      state.particles[state.particles.length - 1].maxLife =
        state.particles[state.particles.length - 1].life;
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x   += p.vx * dt;
      p.y   += p.vy * dt;
      p.vy  += 300 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Collision & Combat ────────────────────────────────────────────
  function checkCombat() {
    const [p1, p2] = state.players;

    // P1 attack hits P2
    if (p1.isAttacking && !p1.attackHit) {
      const hb = p1.getAttackHitbox();
      if (hb && Engine.rectsOverlap(hb, p2)) {
        p2.takeDamage(p1.attackDamage);
        p1.attackHit = true;
        spawnParticles(p2.x + p2.w / 2, p2.y + p2.h / 2, '#00d4ff', 10);
      }
    }

    // P2 attack hits P1
    if (p2.isAttacking && !p2.attackHit) {
      const hb = p2.getAttackHitbox();
      if (hb && Engine.rectsOverlap(hb, p1)) {
        p1.takeDamage(p2.attackDamage);
        p2.attackHit = true;
        spawnParticles(p1.x + p1.w / 2, p1.y + p1.h / 2, '#ff4d4d', 10);
      }
    }

    // P2 dash hits P1
    if (p2.isDashing && !p2.dashHit) {
      const hb = p2.getDashHitbox();
      if (hb && Engine.rectsOverlap(hb, p1)) {
        p1.takeDamage(p2.dashDamage);
        p2.dashHit = true;
        spawnParticles(p1.x + p1.w / 2, p1.y + p1.h / 2, '#ff8800', 14);
      }
    }
  }

  // ── HUD Update ────────────────────────────────────────────────────
  function updateHUD() {
    const [p1, p2] = state.players;

    document.getElementById('p1-health-bar').style.width  = (p1.healthPct * 100) + '%';
    document.getElementById('p2-health-bar').style.width  = (p2.healthPct * 100) + '%';
    document.getElementById('p1-health-text').textContent = Math.ceil(p1.health);
    document.getElementById('p2-health-text').textContent = Math.ceil(p2.health);

    // P1 ability (time stop)
    const p1AbilEl = document.getElementById('p1-ability-status');
    if (p1.abilityCooldown > 0) {
      p1AbilEl.textContent = `Z: ${p1.abilityCooldown.toFixed(1)}s`;
      p1AbilEl.classList.remove('ready');
    } else {
      p1AbilEl.textContent = 'Z: READY';
      p1AbilEl.classList.add('ready');
    }

    // P2 ability (dash)
    const p2AbilEl = document.getElementById('p2-ability-status');
    if (p2.abilityCooldown > 0) {
      p2AbilEl.textContent = `0: ${p2.abilityCooldown.toFixed(1)}s`;
      p2AbilEl.classList.remove('ready');
    } else {
      p2AbilEl.textContent = '0: READY';
      p2AbilEl.classList.add('ready');
    }

    document.getElementById('timer-display').textContent = Math.ceil(state.matchTimer);
  }

  // ── Main Loop ─────────────────────────────────────────────────────
  function loop(timestamp) {
    if (!state.running) return;

    const dt = Math.min((timestamp - (state.lastTime || timestamp)) / 1000, 0.05);
    state.lastTime = timestamp;

    // Match timer
    state.matchTimer -= dt;

    // Time stop countdown
    if (state.timeStop) {
      state.timeStopTimer -= dt;
      if (state.timeStopTimer <= 0) deactivateTimeStop();
    }

    // Player keys
    const [p1, p2] = state.players;
    p1.keys = state.keys;
    p2.keys = state.keys;

    // Update players
    p1.update(dt, state.platforms, WORLD_W, WORLD_H, state.timeStop);
    p2.update(dt, state.platforms, WORLD_W, WORLD_H, state.timeStop);

    // Combat
    checkCombat();

    // Particles
    updateParticles(dt);

    // ── Render ──
    Engine.clearCanvas(ctx, canvas);
    Engine.drawBackground(ctx, canvas, state.timeStop);
    if (state.timeStop) Engine.drawTimeStopEffect(ctx, canvas, 1);
    Engine.drawPlatforms(ctx, state.platforms);

    for (const p of state.players) {
      Engine.drawAttackHitbox(ctx, p);
      Engine.drawPlayer(ctx, p, state.timeStop);
      Engine.drawAbilityCooldown(ctx, p);
    }

    drawParticles();

    updateHUD();

    // Win conditions
    if (p1.isDead || p2.isDead || state.matchTimer <= 0) {
      endGame();
      return;
    }

    requestAnimationFrame(loop);
  }

  // ── End / Win ─────────────────────────────────────────────────────
  function endGame() {
    state.running = false;
    deactivateTimeStop();

    const [p1, p2] = state.players;
    let winner = '';

    if (p1.isDead && !p2.isDead) {
      winner = 'PLAYER 2 WINS!';
      document.getElementById('winner-text').style.color = '#ff4d4d';
    } else if (p2.isDead && !p1.isDead) {
      winner = 'PLAYER 1 WINS!';
      document.getElementById('winner-text').style.color = '#00d4ff';
    } else if (p1.health > p2.health) {
      winner = 'PLAYER 1 WINS! (HP)';
      document.getElementById('winner-text').style.color = '#00d4ff';
    } else if (p2.health > p1.health) {
      winner = 'PLAYER 2 WINS! (HP)';
      document.getElementById('winner-text').style.color = '#ff4d4d';
    } else {
      winner = 'DRAW!';
      document.getElementById('winner-text').style.color = '#ffd700';
    }

    document.getElementById('winner-text').textContent = winner;
    showScreen('gameover-screen');
  }

  // ── Screen Management ─────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function startGame() {
    initState();
    showScreen('game-screen');
    state.running = true;
    requestAnimationFrame(loop);
  }

  // ── UI Buttons ────────────────────────────────────────────────────
  document.getElementById('start-btn').addEventListener('click', startGame);

  document.getElementById('controls-btn').addEventListener('click', () => {
    showScreen('controls-screen');
  });

  document.getElementById('back-btn').addEventListener('click', () => {
    showScreen('menu-screen');
  });

  document.getElementById('rematch-btn').addEventListener('click', startGame);

  document.getElementById('menu-btn').addEventListener('click', () => {
    if (state) state.running = false;
    showScreen('menu-screen');
  });

  // Initial screen
  showScreen('menu-screen');
})();
