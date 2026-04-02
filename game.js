// ================================
// game.js — Main Game Coordinator
// ================================

const Game = (() => {
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');
  let WORLD_W, WORLD_H;
  let state = null;
  let platformMode = 'pc';

  // ── Session config ─────────────────────────────────────────────────
  let sessionConfig = {
    p1CharId: 'chronomancer',
    p2CharId: 'dasher',
    mapId: 'timestrike',
    matchTime: 60,
    p1Custom: null,
    p2Custom: null,
    mode: 'vs',           // 'vs' | 'story' | 'story_coop'
    storyLevel: 0,
    storyP1CharId: 'chronomancer',
    storyP2CharId: 'dasher',
    stockCount: 3,
    customP2IsNPC: false,
    soloMode: false,      // true = no P2 at all (solo vs bots only)
    extraBots: 0,         // 0-3 extra bots added to custom match
    botDifficulty: 3,     // 1-6
  };

  // ── Audio ──────────────────────────────────────────────────────────
  let currentAudio = null;
  function startMusic() {
    stopMusic();
    if (typeof AUDIO_TRACKS === 'undefined' || !AUDIO_TRACKS.length) return;
    const track = AUDIO_TRACKS[Math.floor(Math.random() * AUDIO_TRACKS.length)];
    currentAudio = new Audio(track);
    currentAudio.loop = true; currentAudio.volume = 0.55;
    currentAudio.play().catch(() => {});
  }
  function stopMusic() {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
  }

  // ── Canvas ─────────────────────────────────────────────────────────
  function resizeCanvas() {
    const hud = document.getElementById('hud');
    WORLD_W = window.innerWidth;
    WORLD_H = window.innerHeight - (hud.offsetHeight || 50);
    canvas.width = WORLD_W; canvas.height = WORLD_H;
    if (state) buildPlatforms();
  }
  function buildPlatforms() {
    const map = MAPS.find(m => m.id === sessionConfig.mapId) || MAPS[0];
    state.platforms = map.buildPlatforms(WORLD_W, WORLD_H);
    state.map = map;
  }

  // ── State init ─────────────────────────────────────────────────────
  function initState() {
    state = {
      players: [], platforms: [], keys: {},
      timeStop: false, timeStopTimer: 0, timeStopDuration: 3,
      matchTimer: sessionConfig.matchTime,
      running: false, paused: false, lastTime: null,
      particles: [], map: null,
      mode: sessionConfig.mode, storyLevel: sessionConfig.storyLevel,
      npc: null,
    };
    resizeCanvas();
    const isStory = state.mode === 'story' || state.mode === 'story_coop';
    if (isStory) _initStoryPlayers();
    else         _initVsPlayers();
    buildPlatforms();
    _refreshAllAITargets();
  }

  // After init, give every NPC a fresh target list of all living enemies
  function _refreshAllAITargets() {
    state.players.forEach(p => {
      if (p._isNPC) {
        // NPCs target everyone who is NOT on their team
        // In story: NPCs target humans. In vs with bots: bots target everyone else (including other bots)
        const isStory = state.mode === 'story' || state.mode === 'story_coop';
        if (isStory) {
          p._aiTargets = state.players.filter(q => !q._isNPC && !q._dead);
        } else {
          p._aiTargets = state.players.filter(q => q !== p && !q._dead);
        }
      }
    });
  }

  // Spread spawn positions evenly
  function _spawnX(index, total) {
    return WORLD_W * (0.1 + (index / Math.max(total - 1, 1)) * 0.8);
  }

  function _getCharConfig(charId, id, facing, custom, extras = {}) {
    const def   = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
    const stats = { ...def.stats };
    if (custom) {
      if (custom.hp)  stats.hp            = custom.hp;
      if (custom.spd) stats.speed         = custom.spd;
      if (custom.dmg) stats.attackDamage  = custom.dmg;
      if (custom.cd)  stats.abilityCooldownMax = custom.cd;
    }
    return {
      id, facing,
      x: facing === 1 ? WORLD_W * 0.2 : WORLD_W * 0.75,
      y: WORLD_H - 200,
      color: def.color, accentColor: def.accentColor,
      charId: def.id, abilityType: def.ability, shape: def.shape || 'default',
      maxHp: stats.hp, speed: stats.speed, jumpStrength: stats.jumpStrength,
      attackDamage: stats.attackDamage,
      attackRange: charId === 'brawler' ? 60 : 40,
      attackCooldownMax: stats.attackCooldownMax,
      abilityCooldownMax: stats.abilityCooldownMax,
      stocks: sessionConfig.stockCount, maxStocks: sessionConfig.stockCount,
      ...extras,
    };
  }

  function _initVsPlayers() {
    const botDiff   = sessionConfig.botDifficulty;
    const isSolo    = sessionConfig.soloMode;
    const p2IsNPC   = sessionConfig.customP2IsNPC;
    // total slots: 1 (p1) + 0or1 (p2) + extraBots
    const totalSlots = 1 + (isSolo ? 0 : 1) + sessionConfig.extraBots;

    const cfg1 = _getCharConfig(sessionConfig.p1CharId, 1, 1, sessionConfig.p1Custom);
    cfg1.x = _spawnX(0, totalSlots);
    cfg1._respawnX = cfg1.x; cfg1._respawnY = WORLD_H - 200;
    const p1 = new Player(cfg1);
    state.players = [p1];

    // P2 slot — only if not solo
    if (!isSolo) {
      if (!p2IsNPC) {
        // Human P2
        const cfg2 = _getCharConfig(sessionConfig.p2CharId, 2, -1, sessionConfig.p2Custom);
        cfg2.x = _spawnX(1, totalSlots);
        cfg2._respawnX = cfg2.x; cfg2._respawnY = WORLD_H - 200;
        state.players.push(new Player(cfg2));
      } else {
        // NPC P2
        const cfg2 = _getCharConfig(sessionConfig.p2CharId, 2, -1, sessionConfig.p2Custom,
          { isNPC: true, aiLevel: botDiff });
        cfg2.x = _spawnX(1, totalSlots);
        cfg2._respawnX = cfg2.x; cfg2._respawnY = WORLD_H - 200;
        state.players.push(new Player(cfg2));
      }
    }

    // Extra bots
    const BOT_COLORS = ['#ff00ff','#00ff88','#ffaa00','#44aaff'];
    for (let i = 0; i < sessionConfig.extraBots; i++) {
      const charDef  = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      const spawnIdx = state.players.length;
      const botCfg   = _getCharConfig(charDef.id, 100 + i, i % 2 === 0 ? -1 : 1, null, {
        isNPC: true, aiLevel: botDiff,
        color: BOT_COLORS[i % BOT_COLORS.length],
      });
      botCfg.x = _spawnX(spawnIdx, totalSlots);
      botCfg._respawnX = botCfg.x; botCfg._respawnY = WORLD_H - 200;
      state.players.push(new Player(botCfg));
    }
  }

  function _initStoryPlayers() {
    const level   = sessionConfig.storyLevel;
    const npcDef  = STORY_NPCS[level];
    const charDef = CHARACTERS.find(c => c.id === npcDef.charId) || CHARACTERS[0];

    const p1Cfg = _getCharConfig(sessionConfig.storyP1CharId, 1, 1, null);
    p1Cfg.x = WORLD_W * 0.2; p1Cfg._respawnX = p1Cfg.x; p1Cfg._respawnY = WORLD_H - 200;
    state.players = [new Player(p1Cfg)];

    if (state.mode === 'story_coop') {
      const p2Cfg = _getCharConfig(sessionConfig.storyP2CharId, 2, 1, null, { isAlly: true });
      p2Cfg.x = WORLD_W * 0.35; p2Cfg._respawnX = p2Cfg.x; p2Cfg._respawnY = WORLD_H - 200;
      state.players.push(new Player(p2Cfg));
    }

    const npcStats = { ...charDef.stats };
    npcStats.hp           = Math.round(npcStats.hp           * npcDef.hpMult);
    npcStats.speed        = Math.round(npcStats.speed        * npcDef.speedMult);
    npcStats.attackDamage = Math.round(npcStats.attackDamage * npcDef.damageMult);

    const npc = new Player({
      id: 99, facing: -1,
      x: WORLD_W * 0.75, y: WORLD_H - 200,
      color:       npcDef.isBoss ? '#ff0000' : charDef.color,
      accentColor: npcDef.isBoss ? '#880000' : (charDef.accentColor || charDef.color),
      charId: charDef.id, abilityType: charDef.ability, shape: charDef.shape || 'default',
      maxHp: npcStats.hp, speed: npcStats.speed,
      jumpStrength: npcStats.jumpStrength || -620,
      attackDamage: npcStats.attackDamage,
      attackRange: charDef.id === 'brawler' ? 60 : 40,
      attackCooldownMax:  npcStats.attackCooldownMax  || 1.0,
      abilityCooldownMax: npcStats.abilityCooldownMax || 8,
      isNPC: true, aiLevel: npcDef.aiLevel,
      stocks: 1, maxStocks: 1,
    });
    npc._respawnX = npc.x; npc._respawnY = npc.y;
    state.npc = npc;
    state.players.push(npc);

    const lvlEl = document.getElementById('story-level-display');
    lvlEl.classList.remove('hidden');
    lvlEl.textContent = npcDef.isBoss ? '⚠ FINAL BOSS' : `LEVEL ${level + 1} / 10`;
  }

  // ── Input ─────────────────────────────────────────────────────────
  const jumpPressed = { 1: false, 2: false };
  function onKeyDown(e) {
    const k = e.key === ' ' ? 'Space' : e.key;
    if (!state) return;
    if (k === 'Escape') { togglePause(); return; }
    if (state.paused) return;
    state.keys[k] = true;
    if ((k === 'w' || k === 'W') && !jumpPressed[1]) { jumpPressed[1]=true; state.players[0]?.tryJump(); }
    if (k === 'ArrowUp' && !jumpPressed[2]) { jumpPressed[2]=true; state.players.find(p=>p.id===2&&!p._isNPC)?.tryJump(); }
    if (k==='x'||k==='X') state.players[0]?.tryAttack();
    if (k==='1') state.players.find(p=>p.id===2&&!p._isNPC)?.tryAttack();
    if ((k==='z'||k==='Z') && !state.timeStop) {
      const p1=state.players[0];
      if (p1?.abilityType==='timestop') activateTimeStop(p1); else p1?.tryAbility();
    }
    if (k==='0') {
      const p2=state.players.find(p=>p.id===2&&!p._isNPC);
      if (p2) { if (p2.abilityType==='timestop') activateTimeStop(p2); else p2.tryAbility(); }
    }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)) e.preventDefault();
  }
  function onKeyUp(e) {
    const k = e.key===' ' ? 'Space' : e.key;
    if (!state) return;
    state.keys[k] = false;
    if (k==='w'||k==='W') jumpPressed[1]=false;
    if (k==='ArrowUp') jumpPressed[2]=false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);
  window.addEventListener('resize',  resizeCanvas);

  // ── Mobile Controls ────────────────────────────────────────────────
  function setupMobileControls() {
    const panel = document.getElementById('mobile-controls');
    if (!panel) return;
    panel.style.display = platformMode === 'mobile' ? 'flex' : 'none';
    // Only bind once
    if (panel._bound) return;
    panel._bound = true;

    const p1 = () => state?.players[0];
    const bindBtn = (id, downFn, upFn) => {
      const el = document.getElementById(id); if (!el) return;
      const onDown = e => { e.preventDefault(); if (!state||state.paused) return; downFn(); };
      const onUp   = e => { e.preventDefault(); if (upFn) upFn(); };
      el.addEventListener('touchstart', onDown, { passive:false });
      el.addEventListener('touchend',   onUp,   { passive:false });
      el.addEventListener('mousedown',  onDown);
      el.addEventListener('mouseup',    onUp);
    };

    bindBtn('mb-left',
      () => { if(p1()) p1()._mobileKeys['a']=true; },
      () => { if(p1()) p1()._mobileKeys['a']=false; }
    );
    bindBtn('mb-right',
      () => { if(p1()) p1()._mobileKeys['d']=true; },
      () => { if(p1()) p1()._mobileKeys['d']=false; }
    );
    bindBtn('mb-jump',    () => p1()?.tryJump());
    bindBtn('mb-attack',  () => p1()?.tryAttack());
    bindBtn('mb-ability', () => {
      const pl = p1(); if (!pl) return;
      if (pl.abilityType==='timestop') activateTimeStop(pl); else pl.tryAbility();
    });
    bindBtn('mb-block',
      () => { if(p1()) p1()._mobileKeys['s']=true; },
      () => { if(p1()) p1()._mobileKeys['s']=false; }
    );
  }

  // ── Pause ──────────────────────────────────────────────────────────
  function togglePause() {
    if (!state || !state.running) return;
    state.paused = !state.paused;
    if (state.paused) { stopMusic(); showScreen('pause-screen'); }
    else { startMusic(); showScreen('game-screen'); state.lastTime=null; requestAnimationFrame(loop); }
  }

  // ── Time Stop ─────────────────────────────────────────────────────
  function activateTimeStop(caster) {
    if (!caster || caster.abilityCooldown > 0) return;
    state.timeStop = true; state.timeStopTimer = state.timeStopDuration;
    caster.abilityCooldown = caster.abilityCooldownMax;
    state.players.forEach(p => { if (p !== caster) p.isTimeStopped = true; });
    document.body.classList.add('time-stopped');
    document.getElementById('time-stop-overlay').classList.remove('hidden');
    spawnParticles(WORLD_W/2, WORLD_H/2, '#c77dff', 30);
  }
  function deactivateTimeStop() {
    state.timeStop = false;
    state.players.forEach(p => { if (p.isTimeStopped) { p.flushTimeStopDamage(); p.isTimeStopped = false; } });
    document.body.classList.remove('time-stopped');
    document.getElementById('time-stop-overlay').classList.add('hidden');
  }

  // ── Particles ─────────────────────────────────────────────────────
  function spawnParticles(x, y, color, count=12) {
    for (let i=0;i<count;i++) {
      const angle=Math.random()*Math.PI*2, speed=60+Math.random()*200;
      const p={x,y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life:0.4+Math.random()*0.4, color, size:2+Math.random()*4};
      p.maxLife=p.life; state.particles.push(p);
    }
  }
  function updateParticles(dt) {
    for (let i=state.particles.length-1;i>=0;i--) {
      const p=state.particles[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=300*dt; p.life-=dt;
      if (p.life<=0) state.particles.splice(i,1);
    }
  }
  function drawParticles() {
    for (const p of state.particles) {
      ctx.save(); ctx.globalAlpha=p.life/p.maxLife; ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
  function drawIceSpikes() {
    for (const p of state.players) {
      const s=p.iceSpike; if (!s||!s.active) continue;
      ctx.save(); ctx.fillStyle='#a0e8ff'; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(s.x,s.y+s.h/2); ctx.lineTo(s.x+s.w*0.4,s.y);
      ctx.lineTo(s.x+s.w,s.y+s.h/2); ctx.lineTo(s.x+s.w*0.4,s.y+s.h); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  // ── Combat ────────────────────────────────────────────────────────
  function checkCombat() {
    const players = state.players;
    const isStory = state.mode==='story'||state.mode==='story_coop';

    for (let i=0;i<players.length;i++) {
      const a=players[i]; if (a._dead) continue;
      for (let j=0;j<players.length;j++) {
        if (i===j) continue;
        const b=players[j]; if (b._dead) continue;
        // Friendly fire rules: in story, humans don't hurt each other
        if (isStory && !a._isNPC && !b._isNPC) continue;
        // In free-for-all, everyone can hurt everyone (even bot vs bot)

        const duringTS = state.timeStop && b.isTimeStopped;
        const kbMult   = duringTS ? 2.5 : 1.0;

        if (a.isAttacking && !a.attackHit) {
          const hb=a.getAttackHitbox();
          if (hb && Engine.rectsOverlap(hb,b)) {
            b.takeDamage(a.attackDamage, {duringTimeStop:duringTS, kbMult});
            a.attackHit=true;
            spawnParticles(b.x+b.w/2, b.y+b.h/2, a.color, 10);
            if (a.charId==='glacius') b.applySlow(1.5);
          }
        }
        if (a.isDashing && !a.dashHit) {
          const hb=a.getDashHitbox();
          if (hb && Engine.rectsOverlap(hb,b)) {
            b.takeDamage(a.dashDamage, {duringTimeStop:duringTS, kbMult});
            a.dashHit=true; spawnParticles(b.x+b.w/2, b.y+b.h/2, '#ff8800', 14);
          }
        }
        if (a.isShockwave && !a.shockwaveHit) {
          const hb=a.getShockwaveHitbox();
          if (hb && Engine.rectsOverlap(hb,b)) {
            b.takeDamage(22, {duringTimeStop:duringTS, kbMult:kbMult*1.5});
            b.vx=Math.sign(b.x-a.x)*400; a.shockwaveHit=true;
            spawnParticles(a.x+a.w/2, a.y+a.h/2, '#f5a623', 20);
          }
        }
        if (a.isUppercut && !a.uppercutHit) {
          const hb=a.getUppercutHitbox();
          if (hb && Engine.rectsOverlap(hb,b)) {
            b.takeDamage(25, {duringTimeStop:duringTS});
            b.vy=-600; b.vx=Math.sign(b.x-a.x)*300; a.uppercutHit=true;
            spawnParticles(b.x+b.w/2, b.y, '#e8b86d', 18);
          }
        }
        if (a._wantsBurn && Math.abs(a.x-b.x)<220) {
          b.applyBurn(); spawnParticles(b.x+b.w/2, b.y, '#ff6b35', 15);
        }
        if (a.turret?.active && a.turret.shootCooldown<=0) {
          const hb=a.getTurretFireHitbox();
          if (hb && Engine.rectsOverlap(hb,b)) {
            b.takeDamage(a.turret.damage, {});
            a.turret.shootCooldown=a.turret.shootCooldownMax;
            spawnParticles(b.x+b.w/2, b.y+b.h/2, '#00e676', 6);
          }
        }
        if (a.iceSpike?.active && !a.iceSpike.hit) {
          const hb=a.getIceSpikeHitbox();
          if (hb && Engine.rectsOverlap(hb,b)) {
            b.takeDamage(20, {duringTimeStop:duringTS}); b.applySlow(2.5);
            a.iceSpike.hit=true; a.iceSpike.active=false;
            spawnParticles(b.x+b.w/2, b.y+b.h/2, '#a0e8ff', 12);
          }
        }
        if (a._wantsLightning && Math.abs(a.x-b.x)<300) {
          b.takeDamage(16, {duringTimeStop:duringTS}); b.applyLightningStun(1.0);
          spawnParticles(b.x+b.w/2, b.y-20, '#ffe600', 20);
        }
      }
      if (a._teleportFlash > 0.25) {
        for (const b of players) {
          if (b===a||b._dead) continue;
          if (isStory && !a._isNPC && !b._isNPC) continue;
          if (Engine.rectsOverlap(a,b)) {
            b.takeDamage(20, {}); spawnParticles(b.x+b.w/2, b.y+b.h/2, '#9e9e9e', 14);
          }
        }
      }
      a._wantsBurn=false; a._wantsLightning=false;
    }
  }

  function checkOutOfBounds() {
    for (const p of state.players) {
      if (p._dead || p.isTimeStopped) continue;
      if (Engine.checkOutOfBounds(p, WORLD_W, WORLD_H)) {
        spawnParticles(
          Math.max(20, Math.min(WORLD_W-20, p.x+p.w/2)),
          Math.max(20, Math.min(WORLD_H-20, p.y+p.h/2)),
          p.color, 25
        );
        p._applyActualDamage(p.health);
      }
    }
  }

  // ── Win condition ─────────────────────────────────────────────────
  function checkWinCondition() {
    const isStory = state.mode==='story'||state.mode==='story_coop';
    const timerDone = sessionConfig.matchTime < 9999 && state.matchTimer <= 0;

    if (isStory) {
      const npc = state.npc;
      const humanPlayers = state.players.filter(p => !p._isNPC);
      const allHumansDead = humanPlayers.every(p => p.isDead);
      if (npc.isDead || allHumansDead || timerDone) return true;
    } else {
      // Free-for-all: round ends when only 1 (or 0) players have stocks left
      const alive = state.players.filter(p => !p.isDead);
      if (alive.length <= 1) return true;
      if (timerDone) return true;
    }
    return false;
  }

  // ── HUD ───────────────────────────────────────────────────────────
  function updateHUD() {
    const isStory = state.mode==='story'||state.mode==='story_coop';
    const p1 = state.players[0];
    const p2display = isStory ? state.npc : state.players.find(p=>p.id===2);
    if (!p1) return;

    document.getElementById('p1-health-bar').style.width = (p1.healthPct*100)+'%';
    document.getElementById('p1-health-text').textContent = Math.ceil(p1._displayHealth);
    document.getElementById('p1-stocks').textContent = p1.isDead ? '✗' : '♥'.repeat(Math.max(0,p1.stocks));
    document.getElementById('p1-char-name').textContent = (CHARACTERS.find(c=>c.id===p1.charId)||{}).name||'';

    if (p2display) {
      document.getElementById('p2-health-bar').style.width = (p2display.healthPct*100)+'%';
      document.getElementById('p2-health-text').textContent = Math.ceil(p2display._displayHealth);
      document.getElementById('p2-stocks').textContent = p2display.isDead ? '✗' : '♥'.repeat(Math.max(0,p2display.stocks));
      document.getElementById('p2-char-name').textContent = (CHARACTERS.find(c=>c.id===p2display.charId)||{}).name||'';
    }

    const p1AbilEl=document.getElementById('p1-ability-status');
    if (p1.abilityCooldown>0) { p1AbilEl.textContent=`Z:${p1.abilityCooldown.toFixed(1)}s`; p1AbilEl.classList.remove('ready'); }
    else { p1AbilEl.textContent='Z: READY'; p1AbilEl.classList.add('ready'); }

    const p2human=state.players.find(p=>p.id===2&&!p._isNPC);
    if (!isStory && p2human) {
      const p2AbilEl=document.getElementById('p2-ability-status');
      if (p2human.abilityCooldown>0) { p2AbilEl.textContent=`0:${p2human.abilityCooldown.toFixed(1)}s`; p2AbilEl.classList.remove('ready'); }
      else { p2AbilEl.textContent='0: READY'; p2AbilEl.classList.add('ready'); }
    }

    const setBlock=(pl,id)=>{
      const el=document.getElementById(id); if(!el) return;
      if (pl.blockStunTimer>0||pl.lightningStunTimer>0) { el.textContent='STUNNED'; el.style.color='#ff4444'; }
      else if (pl.blockOverloaded) { el.textContent='OVERLOADED'; el.style.color='#ff8800'; }
      else if (pl.isBlocking) { el.textContent=`BLOCK ${Math.round(pl.blockHoldTime/pl.BLOCK_OVERLOAD_TIME*100)}%`; el.style.color='#00ffff'; }
      else { el.textContent=''; }
    };
    setBlock(p1,'p1-block-status');
    if (p2display && !isStory) setBlock(p2display,'p2-block-status');

    const p1Resp=document.getElementById('p1-respawn');
    if (p1Resp) p1Resp.textContent = p1._dead ? `RESPAWN ${p1._respawnTimer.toFixed(1)}s` : '';
    const p2Resp=document.getElementById('p2-respawn');
    if (p2Resp && p2display) p2Resp.textContent = p2display._dead ? `RESPAWN ${p2display._respawnTimer.toFixed(1)}s` : '';

    document.getElementById('timer-display').textContent =
      sessionConfig.matchTime>=9999 ? '∞' : Math.ceil(Math.max(0,state.matchTimer));
  }

  // ── Main Loop ─────────────────────────────────────────────────────
  function loop(timestamp) {
    if (!state||!state.running||state.paused) return;
    const dt = Math.min((timestamp-(state.lastTime||timestamp))/1000, 0.05);
    state.lastTime = timestamp;

    if (!state.timeStop && sessionConfig.matchTime<9999) state.matchTimer -= dt;
    if (state.timeStop) { state.timeStopTimer-=dt; if (state.timeStopTimer<=0) deactivateTimeStop(); }

    state.players.forEach(p => { if (!p._isNPC) p.keys = state.keys; });

    // Refresh NPC targets every frame (picks closest living enemy, not just humans)
    const isStory = state.mode==='story'||state.mode==='story_coop';
    state.players.forEach(p => {
      if (p._isNPC && !p._dead) {
        if (isStory) p._aiTargets = state.players.filter(q=>!q._isNPC&&!q._dead);
        else         p._aiTargets = state.players.filter(q=>q!==p&&!q._dead);
      }
      // Also update teleport target for any player
      p._aiTargets = p._aiTargets || state.players.filter(q=>q!==p&&!q._dead);
    });

    state.players.forEach(p => p.update(dt, state.platforms, WORLD_W, WORLD_H, state.timeStop));

    checkCombat();
    checkOutOfBounds();
    updateParticles(dt);

    Engine.clearCanvas(ctx,canvas);
    Engine.drawBackground(ctx,canvas,state.timeStop,state.map);
    if (state.timeStop) Engine.drawTimeStopEffect(ctx,canvas);
    Engine.drawPlatforms(ctx,state.platforms,state.map);

    for (const p of state.players) {
      if (!p._dead) {
        Engine.drawAttackHitbox(ctx,p);
        Engine.drawPlayer(ctx,p,state.timeStop);
        Engine.drawAbilityCooldown(ctx,p);
        Engine.drawStockIcons(ctx,p,p.stocks,WORLD_W);
        if (p.turret) Engine.drawTurret(ctx,p.turret);
      }
    }
    drawIceSpikes();
    drawParticles();
    updateHUD();

    if (checkWinCondition()) { endGame(); return; }
    requestAnimationFrame(loop);
  }

  // ── End Game ──────────────────────────────────────────────────────
  function endGame() {
    state.running=false; deactivateTimeStop(); stopMusic();
    const isStory=state.mode==='story'||state.mode==='story_coop';
    const winnerEl=document.getElementById('winner-text');
    const storyContinueWrap=document.getElementById('story-continue-btn-wrap');
    storyContinueWrap.classList.add('hidden');

    if (isStory) {
      const npc=state.npc;
      const humanPlayers=state.players.filter(p=>!p._isNPC);
      const allHumansDead=humanPlayers.every(p=>p.isDead);
      if (npc.isDead && !allHumansDead) {
        const npcName=STORY_NPCS[sessionConfig.storyLevel]?.name||'Enemy';
        winnerEl.textContent=`${npcName} DEFEATED!`; winnerEl.style.color='#ffd700';
        if (sessionConfig.storyLevel<9) storyContinueWrap.classList.remove('hidden');
        else { winnerEl.textContent='🏆 YOU WIN THE GAME!'; winnerEl.style.color='#ffd700'; }
      } else {
        winnerEl.textContent='DEFEATED... RETRY?'; winnerEl.style.color='#ff4444';
      }
    } else {
      // Find last survivor
      const alive = state.players.filter(p => !p.isDead);
      if (alive.length === 1) {
        const w = alive[0];
        const isHuman1 = w.id===1;
        const isHuman2 = w.id===2 && !w._isNPC;
        const label = isHuman1 ? 'PLAYER 1 WINS!' : isHuman2 ? 'PLAYER 2 WINS!' : `${(CHARACTERS.find(c=>c.id===w.charId)||{}).name||'BOT'} WINS!`;
        winnerEl.textContent=label;
        winnerEl.style.color=w.color;
      } else if (alive.length === 0) {
        winnerEl.textContent='DRAW!'; winnerEl.style.color='#ffd700';
      } else {
        // Timer ended — highest HP wins
        const best = alive.reduce((a,b)=>a.health>b.health?a:b);
        const isHuman1 = best.id===1;
        const isHuman2 = best.id===2 && !best._isNPC;
        winnerEl.textContent = isHuman1?'PLAYER 1 WINS! (HP)':isHuman2?'PLAYER 2 WINS! (HP)':`${(CHARACTERS.find(c=>c.id===best.charId)||{}).name||'BOT'} WINS! (HP)`;
        winnerEl.style.color=best.color;
      }
    }
    document.getElementById('rematch-btn').textContent = isStory ? 'RETRY LEVEL' : 'REMATCH';
    showScreen('gameover-screen');
  }

  // ── Screen ────────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const el=document.getElementById(id); if(el) el.classList.add('active');
    const mp=document.getElementById('mobile-controls');
    if (mp) mp.style.display=(id==='game-screen'&&platformMode==='mobile')?'flex':'none';
  }

  function startGame() {
    initState(); showScreen('game-screen');
    state.running=true; state.lastTime=null;
    startMusic(); setupMobileControls();
    requestAnimationFrame(loop);
  }

  // ── UI helpers ────────────────────────────────────────────────────
  function populateCharSelects(ids) {
    ids.forEach(id=>{
      const sel=document.getElementById(id); if(!sel) return; sel.innerHTML='';
      CHARACTERS.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=`${c.emoji} ${c.name}`;sel.appendChild(o);});
    });
  }
  function populateMapSelects(ids) {
    ids.forEach(id=>{
      const sel=document.getElementById(id); if(!sel) return; sel.innerHTML='';
      MAPS.forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=`${m.emoji} ${m.name}`;sel.appendChild(o);});
    });
  }
  function buildCharCards(cid, onSel, defId) {
    const c=document.getElementById(cid); if(!c) return; c.innerHTML='';
    CHARACTERS.forEach(ch=>{
      const card=document.createElement('div');
      card.className='char-card'+(ch.id===defId?' selected':'');
      card.innerHTML=`<div class="char-emoji">${ch.emoji}</div><div class="char-card-name">${ch.name}</div><div class="char-card-desc">${ch.description}</div>`;
      card.addEventListener('click',()=>{c.querySelectorAll('.char-card').forEach(e=>e.classList.remove('selected'));card.classList.add('selected');onSel(ch.id);});
      c.appendChild(card);
    });
  }
  function buildMapCards(cid, onSel, defId) {
    const c=document.getElementById(cid); if(!c) return; c.innerHTML='';
    MAPS.forEach(m=>{
      const card=document.createElement('div');
      card.className='map-card'+(m.id===defId?' selected':'');
      card.innerHTML=`<div class="map-emoji">${m.emoji}</div><div class="map-card-name">${m.name}</div>`;
      card.addEventListener('click',()=>{c.querySelectorAll('.map-card').forEach(e=>e.classList.remove('selected'));card.classList.add('selected');onSel(m.id);});
      c.appendChild(card);
    });
  }
  const mkSlider=(sid,vid)=>{const s=document.getElementById(sid),v=document.getElementById(vid);if(!s||!v)return;v.textContent=s.value;s.addEventListener('input',()=>v.textContent=s.value);};

  // ── Menu wiring ───────────────────────────────────────────────────
  document.getElementById('pc-toggle')?.addEventListener('click',()=>{
    platformMode='pc';
    document.getElementById('pc-toggle').classList.add('selected');
    document.getElementById('mobile-toggle').classList.remove('selected');
    const row=document.getElementById('custom-p2-npc-row'); if(row) row.style.display='flex';
  });
  document.getElementById('mobile-toggle')?.addEventListener('click',()=>{
    platformMode='mobile';
    document.getElementById('mobile-toggle').classList.add('selected');
    document.getElementById('pc-toggle').classList.remove('selected');
    sessionConfig.customP2IsNPC=true;
    const row=document.getElementById('custom-p2-npc-row'); if(row) row.style.display='none';
  });

  document.getElementById('start-btn').addEventListener('click',()=>{
    sessionConfig.mode='vs'; sessionConfig.p1Custom=null; sessionConfig.p2Custom=null;
    sessionConfig.matchTime=60; sessionConfig.customP2IsNPC=false; sessionConfig.soloMode=false;
    sessionConfig.extraBots=0;
    buildCharCards('p1-chars',id=>sessionConfig.p1CharId=id, sessionConfig.p1CharId);
    buildCharCards('p2-chars',id=>sessionConfig.p2CharId=id, sessionConfig.p2CharId);
    buildMapCards('map-cards',id=>sessionConfig.mapId=id, sessionConfig.mapId);
    showScreen('char-select-screen');
  });
  document.getElementById('char-confirm-btn').addEventListener('click', startGame);
  document.getElementById('char-back-btn').addEventListener('click',()=>showScreen('menu-screen'));
  document.getElementById('controls-btn').addEventListener('click',()=>showScreen('controls-screen'));
  document.getElementById('back-btn').addEventListener('click',()=>showScreen('menu-screen'));

  // Custom match
  document.getElementById('custom-match-btn').addEventListener('click',()=>{
    populateCharSelects(['custom-p1-char','custom-p2-char']);
    populateMapSelects(['custom-map']);
    const npcChk=document.getElementById('custom-p2-npc');
    if (npcChk) npcChk.checked=(platformMode==='mobile');
    showScreen('custom-screen');
  });
  ['p1','p2'].forEach(p=>{mkSlider(`custom-${p}-hp`,`custom-${p}-hp-val`);mkSlider(`custom-${p}-spd`,`custom-${p}-spd-val`);mkSlider(`custom-${p}-dmg`,`custom-${p}-dmg-val`);mkSlider(`custom-${p}-cd`,`custom-${p}-cd-val`);});
  mkSlider('custom-stocks','custom-stocks-val');
  mkSlider('custom-extra-bots','custom-extra-bots-val');

  document.getElementById('custom-back-btn').addEventListener('click',()=>showScreen('menu-screen'));
  document.getElementById('custom-start-btn').addEventListener('click',()=>{
    sessionConfig.mode='vs';
    sessionConfig.p1CharId=document.getElementById('custom-p1-char').value;
    sessionConfig.p2CharId=document.getElementById('custom-p2-char').value;
    sessionConfig.mapId=document.getElementById('custom-map').value;
    sessionConfig.matchTime=parseInt(document.getElementById('custom-time').value);
    sessionConfig.stockCount=parseInt(document.getElementById('custom-stocks').value);
    sessionConfig.extraBots=parseInt(document.getElementById('custom-extra-bots')?.value||0);
    const diffSel=document.getElementById('custom-bot-difficulty');
    sessionConfig.botDifficulty=diffSel?parseInt(diffSel.value):3;
    const npcChk=document.getElementById('custom-p2-npc');
    const soloChk=document.getElementById('custom-solo-mode');
    sessionConfig.soloMode=!!(soloChk&&soloChk.checked);
    sessionConfig.customP2IsNPC=sessionConfig.soloMode ? false : (platformMode==='mobile'||(npcChk&&npcChk.checked));
    sessionConfig.p1Custom={hp:+document.getElementById('custom-p1-hp').value,spd:+document.getElementById('custom-p1-spd').value,dmg:+document.getElementById('custom-p1-dmg').value,cd:+document.getElementById('custom-p1-cd').value};
    sessionConfig.p2Custom={hp:+document.getElementById('custom-p2-hp').value,spd:+document.getElementById('custom-p2-spd').value,dmg:+document.getElementById('custom-p2-dmg').value,cd:+document.getElementById('custom-p2-cd').value};
    startGame();
  });

  // Story
  document.getElementById('story-btn').addEventListener('click',()=>{
    populateCharSelects(['story-p1-char','story-p2-char']);
    sessionConfig.storyLevel=0;
    const coopCard=document.getElementById('story-coop');
    if (platformMode==='mobile') { coopCard.style.opacity='0.4'; coopCard.style.pointerEvents='none'; }
    else { coopCard.style.opacity=''; coopCard.style.pointerEvents=''; }
    showScreen('story-select-screen');
  });
  let storyModeSolo=true;
  document.getElementById('story-solo').addEventListener('click',()=>{storyModeSolo=true;document.getElementById('story-solo').classList.add('selected');document.getElementById('story-coop').classList.remove('selected');document.getElementById('story-p2-select').style.display='none';});
  document.getElementById('story-coop').addEventListener('click',()=>{if(platformMode==='mobile')return;storyModeSolo=false;document.getElementById('story-coop').classList.add('selected');document.getElementById('story-solo').classList.remove('selected');document.getElementById('story-p2-select').style.display='block';});
  document.getElementById('story-back-btn').addEventListener('click',()=>showScreen('menu-screen'));
  document.getElementById('story-start-btn').addEventListener('click',()=>{
    sessionConfig.mode=storyModeSolo?'story':'story_coop';
    sessionConfig.storyP1CharId=document.getElementById('story-p1-char').value;
    sessionConfig.storyP2CharId=document.getElementById('story-p2-char').value;
    sessionConfig.matchTime=60; sessionConfig.stockCount=3; sessionConfig.extraBots=0;
    sessionConfig.mapId=MAPS[sessionConfig.storyLevel%MAPS.length].id;
    startGame();
  });

  // Pause
  document.getElementById('resume-btn').addEventListener('click',()=>{state.paused=false;startMusic();showScreen('game-screen');state.lastTime=null;requestAnimationFrame(loop);});
  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('pause-menu-btn').addEventListener('click',()=>{if(state){state.running=false;state.paused=false;}stopMusic();showScreen('menu-screen');});

  // Game Over
  document.getElementById('story-continue-btn').addEventListener('click',()=>{sessionConfig.storyLevel++;sessionConfig.mapId=MAPS[sessionConfig.storyLevel%MAPS.length].id;startGame();});
  document.getElementById('rematch-btn').addEventListener('click', startGame);
  document.getElementById('menu-btn').addEventListener('click',()=>{if(state)state.running=false;stopMusic();showScreen('menu-screen');});

  showScreen('menu-screen');
})();
