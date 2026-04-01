// ================================
// engine.js — Physics & Renderer
// ================================

const Engine = (() => {
  const GRAVITY = 1800;
  const MAX_FALL = 900;
  const GROUND_FRICTION = 0.75;
  const AIR_FRICTION    = 0.92;

  function applyGravity(entity, dt) {
    if (!entity.onGround) {
      entity.vy += GRAVITY * dt;
      if (entity.vy > MAX_FALL) entity.vy = MAX_FALL;
    }
  }

  function applyFriction(entity) {
    entity.vx *= entity.onGround ? GROUND_FRICTION : AIR_FRICTION;
  }

  function moveAndCollide(entity, platforms, dt) {
    entity.x += entity.vx * dt;
    for (const p of platforms) {
      if (rectsOverlap(entity, p)) {
        if (entity.vx > 0) entity.x = p.x - entity.w;
        else if (entity.vx < 0) entity.x = p.x + p.w;
        entity.vx = 0;
      }
    }
    entity.y += entity.vy * dt;
    entity.onGround = false;
    for (const p of platforms) {
      if (rectsOverlap(entity, p)) {
        if (entity.vy > 0) { entity.y = p.y - entity.h; entity.onGround = true; }
        else if (entity.vy < 0) { entity.y = p.y + p.h; }
        entity.vy = 0;
      }
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Returns true if player fell off the world (x out of bounds past margin, or below world)
  function checkOutOfBounds(entity, worldW, worldH) {
    const DEATH_MARGIN = 80; // pixels off-screen before death
    if (entity.x + entity.w < -DEATH_MARGIN) return true;
    if (entity.x > worldW + DEATH_MARGIN) return true;
    if (entity.y > worldH + 100) return true;
    return false;
  }

  function clampToWorldTop(entity) {
    // Only clamp top — sides and bottom are now death zones
    if (entity.y < -300) { entity.y = -300; entity.vy = 0; }
  }

  function clearCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawBackground(ctx, canvas, timeStop, map) {
    const m = map || MAPS[0];
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (timeStop) {
      sky.addColorStop(0, m.bgTopStop    || '#0d0820');
      sky.addColorStop(1, m.bgBottomStop || '#1a0830');
    } else {
      sky.addColorStop(0, m.bgTop    || '#0d0d1f');
      sky.addColorStop(1, m.bgBottom || '#141430');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = timeStop ? 'rgba(138,43,226,0.08)' : (m.gridColor || 'rgba(255,255,255,0.03)');
    ctx.lineWidth = 1;
    const gs = 60;
    for (let x = 0; x < canvas.width; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

    // "death zone" warning edges
    ctx.fillStyle = 'rgba(255,50,50,0.08)';
    ctx.fillRect(0, 0, 60, canvas.height);
    ctx.fillRect(canvas.width - 60, 0, 60, canvas.height);
  }

  function drawPlatforms(ctx, platforms, map) {
    const m = map || MAPS[0];
    for (const p of platforms) {
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, m.platformColor0 || '#2a2a45');
      grad.addColorStop(1, m.platformColor1 || '#1a1a30');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = m.platformHighlight || 'rgba(100,100,200,0.4)';
      ctx.fillRect(p.x, p.y, p.w, 3);
      ctx.strokeStyle = m.platformStroke || 'rgba(80,80,160,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  }

  // ── Character-specific drawing ───────────────────────────────────
  function drawPlayer(ctx, player, timeStop) {
    const { x, y, w, h, color, accentColor, facing, isTimeStopped,
            isDashing, isAttacking, isBlocking, blockOverloaded,
            isInvisible, shape, burnTimer } = player;

    const ghostAlpha = (isInvisible && !player._isEnemy) ? 0.15 : 1.0;
    ctx.save();
    ctx.globalAlpha = ghostAlpha;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h + 2, w*0.4, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Time-stop freeze border
    if (isTimeStopped) {
      ctx.strokeStyle = 'rgba(138,43,226,0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([4,4]);
      ctx.strokeRect(x-5, y-5, w+10, h+10);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(138,43,226,0.1)';
      ctx.fillRect(x-5, y-5, w+10, h+10);
    }

    // Block shield
    if (isBlocking) {
      const sc = blockOverloaded ? '#ff4444' : '#00ffff';
      ctx.fillStyle = sc + '22';
      ctx.fillRect(x-7, y-7, w+14, h+14);
      ctx.strokeStyle = sc;
      ctx.lineWidth = 3;
      ctx.strokeRect(x-7, y-7, w+14, h+14);
    }

    // Draw body based on shape
    _drawCharacterBody(ctx, player, color, accentColor || color, x, y, w, h, facing, isAttacking, isDashing);

    // Burn overlay
    if (burnTimer > 0) {
      ctx.fillStyle = 'rgba(255,120,0,0.3)';
      ctx.fillRect(x, y, w, h);
    }

    // Enemy label
    if (player._isEnemy) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▼', x + w/2, y - 8);
    }

    ctx.restore();

    // Burn flames (not affected by invisible alpha)
    if (burnTimer > 0) _drawBurnFlames(ctx, x, y, w);
  }

  function _drawCharacterBody(ctx, player, color, accent, x, y, w, h, facing, isAttacking, isDashing) {
    const shape = player.shape || 'default';
    const t = Date.now() / 1000;
    const fdir = facing; // 1=right, -1=left

    // Flash white on attack
    const flash = isAttacking ? 'rgba(255,255,255,0.35)' : null;

    switch (shape) {
      case 'mage': {
        // Robed figure with staff
        // Robe body (trapezoid via path)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x+4, y);
        ctx.lineTo(x+w-4, y);
        ctx.lineTo(x+w+2, y+h);
        ctx.lineTo(x-2, y+h);
        ctx.closePath();
        ctx.fill();
        // Hood (circle top)
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x+w/2, y+8, w*0.38, 0, Math.PI*2);
        ctx.fill();
        // Eyes glow
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#c77dff';
        ctx.shadowBlur = 10;
        const ex = fdir===1 ? x+w*0.55 : x+w*0.25;
        ctx.fillRect(ex, y+6, 5, 4);
        ctx.shadowBlur = 0;
        // Staff
        const sx = fdir===1 ? x+w+4 : x-8;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx, y+4); ctx.lineTo(sx, y+h+4); ctx.stroke();
        ctx.fillStyle = '#c77dff';
        ctx.beginPath(); ctx.arc(sx, y+4, 5, 0, Math.PI*2); ctx.fill();
        if (flash) { ctx.fillStyle = flash; ctx.fillRect(x, y, w, h); }
        break;
      }
      case 'speedster': {
        // Lean body with motion streaks
        ctx.fillStyle = color;
        ctx.fillRect(x+3, y+4, w-6, h-4);
        // Helmet
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(x+w/2, y+8, w*0.35, 0, Math.PI*2); ctx.fill();
        // Visor
        ctx.fillStyle = '#000';
        const vx = fdir===1 ? x+w*0.5 : x+w*0.15;
        ctx.fillRect(vx, y+5, w*0.38, 6);
        // Speed lines
        if (isDashing) {
          ctx.strokeStyle = color + 'aa';
          ctx.lineWidth = 2;
          for (let i=0;i<3;i++) {
            const lx = fdir===1 ? x - 10 - i*12 : x+w + 10 + i*12;
            ctx.beginPath(); ctx.moveTo(lx, y+h*0.3+i*8); ctx.lineTo(lx - fdir*20, y+h*0.3+i*8); ctx.stroke();
          }
        }
        if (flash) { ctx.fillStyle = flash; ctx.fillRect(x+3, y+4, w-6, h-4); }
        break;
      }
      case 'tank': {
        // Wide, armored
        ctx.fillStyle = color;
        ctx.fillRect(x-4, y+8, w+8, h-8); // wider body
        // Shoulders
        ctx.fillStyle = accent;
        ctx.fillRect(x-4, y+8, 14, 14);
        ctx.fillRect(x+w-10, y+8, 14, 14);
        // Head (small square)
        ctx.fillStyle = color;
        ctx.fillRect(x+4, y, w-8, 16);
        // Visor slit
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 6;
        const tx = fdir===1 ? x+w*0.5 : x+4;
        ctx.fillRect(tx, y+4, w*0.4, 5);
        ctx.shadowBlur=0;
        if (flash) { ctx.fillStyle = flash; ctx.fillRect(x-4, y, w+8, h); }
        break;
      }
      case 'ghost': {
        // Wispy body
        const wobble = Math.sin(t*3) * 3;
        ctx.fillStyle = color + 'cc';
        ctx.beginPath();
        ctx.moveTo(x+2, y+h);
        ctx.bezierCurveTo(x-4, y+h-10+wobble, x+4, y+h-20, x+w/2, y+h-20);
        ctx.bezierCurveTo(x+w-4, y+h-20, x+w+4, y+h-10-wobble, x+w-2, y+h);
        ctx.lineTo(x+w/2, y+4);
        ctx.closePath();
        ctx.fill();
        // Glow eyes
        ctx.fillStyle = '#fff';
        ctx.shadowColor = accent; ctx.shadowBlur = 12;
        ctx.fillRect(x+w*0.25, y+h*0.3, 7, 7);
        ctx.fillRect(x+w*0.58, y+h*0.3, 7, 7);
        ctx.shadowBlur = 0;
        if (flash) { ctx.fillStyle = flash; ctx.fillRect(x, y, w, h); }
        break;
      }
      case 'pyro': {
        ctx.fillStyle = accent;
        ctx.fillRect(x+2, y+8, w-4, h-8);
        // Flame helmet
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x+w/2, y+8, w*0.36, 0, Math.PI*2); ctx.fill();
        // Flame atop head
        ctx.fillStyle = '#ffdd00';
        ctx.shadowColor = '#ff6b35'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(x+w/2, y-8);
        ctx.bezierCurveTo(x+w*0.2, y+4, x+w*0.8, y+4, x+w/2, y-8);
        ctx.fill();
        ctx.shadowBlur=0;
        // Visor
        ctx.fillStyle = '#ff2200';
        const pvx = fdir===1 ? x+w*0.5 : x+w*0.12;
        ctx.fillRect(pvx, y+5, w*0.38, 5);
        if (flash) { ctx.fillStyle = flash; ctx.fillRect(x, y, w, h); }
        break;
      }
      case 'robot': {
        ctx.fillStyle = accent;
        ctx.fillRect(x+1, y+12, w-2, h-12);
        // Square head
        ctx.fillStyle = color;
        ctx.fillRect(x+3, y, w-6, 16);
        // LED eyes
        ctx.fillStyle = '#00ffcc';
        ctx.shadowColor='#00ffcc'; ctx.shadowBlur=8;
        ctx.fillRect(x+7, y+4, 6, 5);
        ctx.fillRect(x+w-13, y+4, 6, 5);
        ctx.shadowBlur=0;
        // Antenna
        ctx.strokeStyle = color;
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x+w/2, y); ctx.lineTo(x+w/2, y-8); ctx.stroke();
        ctx.fillStyle='#00ffcc'; ctx.beginPath(); ctx.arc(x+w/2, y-8, 3, 0, Math.PI*2); ctx.fill();
        if (flash) { ctx.fillStyle=flash; ctx.fillRect(x, y, w, h); }
        break;
      }
      case 'ice': {
        // Crystal body
        ctx.fillStyle = color + 'cc';
        ctx.beginPath();
        ctx.moveTo(x+w/2, y);
        ctx.lineTo(x+w, y+h*0.4);
        ctx.lineTo(x+w-4, y+h);
        ctx.lineTo(x+4, y+h);
        ctx.lineTo(x, y+h*0.4);
        ctx.closePath();
        ctx.fill();
        // Ice shards overlay
        ctx.strokeStyle = '#ffffff88';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x+w/2, y+4); ctx.lineTo(x+w*0.25, y+h*0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+w/2, y+4); ctx.lineTo(x+w*0.75, y+h*0.5); ctx.stroke();
        // Eyes
        ctx.fillStyle='#003388'; ctx.shadowColor=color; ctx.shadowBlur=8;
        ctx.fillRect(x+w*0.3, y+h*0.3, 6, 5);
        ctx.fillRect(x+w*0.6, y+h*0.3, 6, 5);
        ctx.shadowBlur=0;
        if (flash) { ctx.fillStyle=flash; ctx.fillRect(x, y, w, h); }
        break;
      }
      case 'brawler': {
        // Thick body
        ctx.fillStyle = color;
        ctx.fillRect(x, y+8, w, h-8);
        // Big fists
        const fistX = fdir===1 ? x+w-2 : x-12;
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(fistX+6, y+h*0.55, 10, 0, Math.PI*2); ctx.fill();
        // Head
        ctx.fillStyle = color;
        ctx.fillRect(x+4, y, w-8, 18);
        // Scar / brow
        ctx.strokeStyle='#5a2a00'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x+8, y+5); ctx.lineTo(x+w*0.45, y+8); ctx.stroke();
        // Eyes
        ctx.fillStyle='#1a0000';
        ctx.fillRect(x+8, y+7, 5, 4);
        ctx.fillRect(x+w-13, y+7, 5, 4);
        if (flash) { ctx.fillStyle=flash; ctx.fillRect(x, y, w, h); }
        break;
      }
      case 'wraith': {
        // Smoke-like
        ctx.fillStyle = '#00000066';
        ctx.fillRect(x+2, y+h*0.4, w-4, h*0.6);
        const smokeAlpha = 0.5 + Math.sin(t*2)*0.2;
        ctx.fillStyle = `rgba(80,80,80,${smokeAlpha})`;
        ctx.beginPath(); ctx.arc(x+w/2, y+h*0.3, w*0.42, 0, Math.PI*2); ctx.fill();
        // Cloak
        ctx.fillStyle = color + 'cc';
        ctx.beginPath();
        ctx.moveTo(x, y+h*0.2);
        ctx.lineTo(x+w, y+h*0.2);
        ctx.lineTo(x+w+4, y+h);
        ctx.lineTo(x-4, y+h);
        ctx.closePath();
        ctx.fill();
        // Glowing red eyes
        ctx.fillStyle='#ff2200'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=14;
        ctx.fillRect(x+w*0.28, y+h*0.22, 6, 5);
        ctx.fillRect(x+w*0.6, y+h*0.22, 6, 5);
        ctx.shadowBlur=0;
        if (flash) { ctx.fillStyle=flash; ctx.fillRect(x, y, w, h); }
        break;
      }
      case 'storm': {
        // Electric body
        ctx.fillStyle = color;
        ctx.fillRect(x+2, y+8, w-4, h-8);
        ctx.fillStyle = accent;
        ctx.fillRect(x+4, y, w-8, 18);
        // Lightning bolt on chest
        ctx.strokeStyle = color; ctx.lineWidth=3;
        ctx.beginPath();
        ctx.moveTo(x+w*0.55, y+18);
        ctx.lineTo(x+w*0.4, y+h*0.55);
        ctx.lineTo(x+w*0.58, y+h*0.55);
        ctx.lineTo(x+w*0.43, y+h-2);
        ctx.stroke();
        // Sparking eyes
        ctx.fillStyle='#fff'; ctx.shadowColor=color; ctx.shadowBlur=14;
        ctx.fillRect(x+7, y+4, 6, 5);
        ctx.fillRect(x+w-13, y+4, 6, 5);
        ctx.shadowBlur=0;
        // Electric arcs
        if (Math.random()<0.3) {
          ctx.strokeStyle=color+'88'; ctx.lineWidth=1;
          ctx.beginPath();
          ctx.moveTo(x+w/2, y);
          ctx.lineTo(x+w/2+Math.random()*16-8, y-10);
          ctx.stroke();
        }
        if (flash) { ctx.fillStyle=flash; ctx.fillRect(x, y, w, h); }
        break;
      }
      default: {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle='rgba(0,0,0,0.5)';
        const dvx = fdir===1 ? x+w*0.55 : x+w*0.1;
        ctx.fillRect(dvx, y+h*0.2, w*0.35, h*0.2);
        ctx.fillStyle='#fff'; ctx.shadowColor=color; ctx.shadowBlur=8;
        const dex = fdir===1 ? x+w*0.65 : x+w*0.2;
        ctx.fillRect(dex, y+h*0.22, 5, 5);
        ctx.shadowBlur=0;
        if (flash) { ctx.fillStyle=flash; ctx.fillRect(x, y, w, h); }
      }
    }
  }

  function _drawBurnFlames(ctx, x, y, w) {
    const t = Date.now()/200;
    for (let i=0;i<5;i++) {
      const fx = x + (i/4)*w + Math.sin(t+i)*5;
      const fy = y + Math.sin(t*1.3+i)*6;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = ['#ff6b35','#ff4500','#ffd700','#ff8c00'][i%4];
      ctx.beginPath(); ctx.arc(fx, fy, 4+Math.sin(t+i)*2, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function drawTurret(ctx, turret) {
    if (!turret || !turret.active) return;
    ctx.save();
    ctx.fillStyle = '#00e676';
    ctx.fillRect(turret.x, turret.y, turret.w, turret.h);
    ctx.strokeStyle='#004d40'; ctx.lineWidth=2;
    ctx.strokeRect(turret.x, turret.y, turret.w, turret.h);
    const bx = turret.facing===1 ? turret.x+turret.w : turret.x-12;
    ctx.fillStyle='#00e676';
    ctx.fillRect(bx, turret.y+turret.h*0.3, 12, turret.h*0.4);
    ctx.restore();
  }

  function drawAttackHitbox(ctx, player) {
    if (!player.isAttacking) return;
    const {x,y,w,h,facing,color}=player;
    const hbX = facing===1 ? x+w : x-40;
    ctx.save(); ctx.globalAlpha=0.45; ctx.fillStyle=color;
    ctx.fillRect(hbX, y+h*0.1, 40, h*0.8);
    ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    ctx.strokeRect(hbX, y+h*0.1, 40, h*0.8);
    ctx.restore();
  }

  function drawAbilityCooldown(ctx, player) {
    if (player.abilityCooldown <= 0) return;
    const cx=player.x+player.w/2, cy=player.y-14, r=8;
    const frac=player.abilityCooldown/player.abilityCooldownMax;
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle=player.color;
    ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+(1-frac)*Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  function drawStockIcons(ctx, player, stocks, worldW) {
    const isP1 = player.id === 1;
    const cx = player.x + player.w/2;
    const cy = player.y - 28;
    // Draw small colored hearts above player
    for (let i=0;i<stocks;i++) {
      const ix = cx - (stocks-1)*7 + i*14;
      ctx.save();
      ctx.fillStyle = player.color;
      ctx.shadowColor = player.color; ctx.shadowBlur=6;
      ctx.font='11px sans-serif'; ctx.textAlign='center';
      ctx.fillText('♥', ix, cy);
      ctx.restore();
    }
  }

  function drawTimeStopEffect(ctx, canvas) {
    const vignette = ctx.createRadialGradient(
      canvas.width/2, canvas.height/2, canvas.height*0.3,
      canvas.width/2, canvas.height/2, canvas.height
    );
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(60,0,100,0.4)');
    ctx.fillStyle=vignette;
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function shadeColor(hex, amount) {
    const num=parseInt(hex.replace('#',''),16);
    const r=Math.max(0,Math.min(255,(num>>16)+amount));
    const g=Math.max(0,Math.min(255,((num>>8)&0xff)+amount));
    const b=Math.max(0,Math.min(255,(num&0xff)+amount));
    return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  return {
    applyGravity, applyFriction, moveAndCollide, rectsOverlap,
    checkOutOfBounds, clampToWorldTop,
    clearCanvas, drawBackground, drawPlatforms, drawPlayer,
    drawAttackHitbox, drawAbilityCooldown, drawTimeStopEffect,
    drawTurret, drawStockIcons, shadeColor,
  };
})();
