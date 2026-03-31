// ================================
// engine.js — Physics & Renderer
// ================================

const Engine = (() => {
  const GRAVITY = 1800;      // px/s²
  const MAX_FALL = 900;      // px/s
  const GROUND_FRICTION = 0.75;
  const AIR_FRICTION    = 0.92;

  // ---------- Physics ----------
  function applyGravity(entity, dt) {
    if (!entity.onGround) {
      entity.vy += GRAVITY * dt;
      if (entity.vy > MAX_FALL) entity.vy = MAX_FALL;
    }
  }

  function applyFriction(entity) {
    if (entity.onGround) {
      entity.vx *= GROUND_FRICTION;
    } else {
      entity.vx *= AIR_FRICTION;
    }
  }

  function moveAndCollide(entity, platforms, dt) {
    // Horizontal
    entity.x += entity.vx * dt;
    for (const p of platforms) {
      if (rectsOverlap(entity, p)) {
        if (entity.vx > 0) entity.x = p.x - entity.w;
        else if (entity.vx < 0) entity.x = p.x + p.w;
        entity.vx = 0;
      }
    }

    // Vertical
    entity.y += entity.vy * dt;
    entity.onGround = false;
    for (const p of platforms) {
      if (rectsOverlap(entity, p)) {
        if (entity.vy > 0) {
          entity.y = p.y - entity.h;
          entity.onGround = true;
        } else if (entity.vy < 0) {
          entity.y = p.y + p.h;
        }
        entity.vy = 0;
      }
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  function clampToWorld(entity, worldW, worldH) {
    if (entity.x < 0) { entity.x = 0; entity.vx = 0; }
    if (entity.x + entity.w > worldW) { entity.x = worldW - entity.w; entity.vx = 0; }
    if (entity.y + entity.h > worldH) {
      entity.y = worldH - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    }
  }

  // ---------- Renderer ----------
  function clearCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawBackground(ctx, canvas, timeStop) {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (timeStop) {
      sky.addColorStop(0, '#0d0820');
      sky.addColorStop(1, '#1a0830');
    } else {
      sky.addColorStop(0, '#0d0d1f');
      sky.addColorStop(1, '#141430');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = timeStop ? 'rgba(138,43,226,0.08)' : 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  function drawPlatforms(ctx, platforms) {
    for (const p of platforms) {
      // Platform body
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, '#2a2a45');
      grad.addColorStop(1, '#1a1a30');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);

      // Top highlight
      ctx.fillStyle = 'rgba(100,100,200,0.4)';
      ctx.fillRect(p.x, p.y, p.w, 3);

      // Edge glow
      ctx.strokeStyle = 'rgba(80,80,160,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
  }

  function drawPlayer(ctx, player, timeStop) {
    const { x, y, w, h, color, facing, isTimeStopped, isDashing, isAttacking } = player;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 2, w * 0.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Time-stop freeze effect on player 2
    if (isTimeStopped) {
      ctx.fillStyle = 'rgba(138,43,226,0.15)';
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      ctx.strokeStyle = 'rgba(138,43,226,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
      ctx.setLineDash([]);
    }

    // Body
    const bodyGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    const c = color;
    bodyGrad.addColorStop(0, c);
    bodyGrad.addColorStop(1, shadeColor(c, -40));
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x, y, w, h);

    // Attack flash
    if (isAttacking) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x, y, w, h);
    }

    // Dash effect
    if (isDashing) {
      ctx.fillStyle = color + '44';
      const trail = facing === 1 ? -1 : 1;
      ctx.fillRect(x + trail * 15, y + 4, w, h - 8);
      ctx.fillRect(x + trail * 28, y + 8, w, h - 16);
    }

    // Face direction indicator (visor)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const visorX = facing === 1 ? x + w * 0.55 : x + w * 0.1;
    ctx.fillRect(visorX, y + h * 0.2, w * 0.35, h * 0.2);

    // Eyes (glow)
    ctx.fillStyle = '#fff';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    const eyeX = facing === 1 ? x + w * 0.65 : x + w * 0.2;
    ctx.fillRect(eyeX, y + h * 0.22, 5, 5);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawAttackHitbox(ctx, player) {
    if (!player.isAttacking) return;
    const { x, y, w, h, facing, color } = player;
    const hbX = facing === 1 ? x + w : x - 40;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.fillRect(hbX, y + h * 0.1, 40, h * 0.8);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(hbX, y + h * 0.1, 40, h * 0.8);
    ctx.restore();
  }

  function drawAbilityCooldown(ctx, player) {
    // Visual ring above player if ability is charging
    if (player.abilityCooldown > 0) {
      const cx = player.x + player.w / 2;
      const cy = player.y - 12;
      const r = 8;
      const frac = player.abilityCooldown / player.abilityCooldownMax;

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = player.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (1 - frac) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTimeStopEffect(ctx, canvas, alpha) {
    // Purple vignette
    const vignette = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.height
    );
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, `rgba(60,0,100,${alpha * 0.4})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Util
  function shadeColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  return {
    applyGravity,
    applyFriction,
    moveAndCollide,
    rectsOverlap,
    clampToWorld,
    clearCanvas,
    drawBackground,
    drawPlatforms,
    drawPlayer,
    drawAttackHitbox,
    drawAbilityCooldown,
    drawTimeStopEffect,
  };
})();
