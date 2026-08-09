/* ============================================================
   ÚLTIMA LÍNEA — OBJETOS RECOGIBLES (PICKUPS)
   ------------------------------------------------------------
   Dos sistemas que comparten la misma idea de diseño: darle un
   MOTIVO al movimiento. Antes el jugador podía plantarse en una
   esquina toda la partida; ahora el botín está en el suelo y hay
   que ir a buscarlo, justo cuando más zombies hay encima.

     1. MONEDAS FÍSICAS — matar ya no suma monedas solo. Caen al
        asfalto, rebotan, y hay que pasar por encima. Tienen imán
        de cercanía (para que no sea tedioso) y caducan a los 12s
        parpadeando los últimos 3, así que hay una decisión real:
        ¿voy por ellas ahora o las pierdo?

     2. SUMINISTROS AÉREOS — al terminar una oleada, si el jugador
        viene herido, hay probabilidad de que caiga un botiquín en
        paracaídas. Más raro todavía es la caja de munición, que
        además de curar sube el cargador de forma permanente.

   API pública que consume el resto del juego:
     resetPickups()                   — game.js, al empezar partida
     dropCoins(x, y, cantidad)        — enemies.js, al herir/matar
     rollSupplyDrop()                 — game.js, al cambiar de oleada
     updatePickups(dt)                — game.js, cada frame
     drawPickups()                    — renderer.js, dentro de render()
     supplyAmmoBonus()                — weapons.js, en recomputeMaxAmmo
   ============================================================ */

let groundCoins, supplyDrops;

// bono permanente de cargador que otorgan las cajas de munición.
// weapons.js lo suma en recomputeMaxAmmo() junto al nivel de tienda y
// al bono de mejoras — nadie escribe maxAmmo directamente.
let _supplyAmmoBonus = 0;
function supplyAmmoBonus(){ return _supplyAmmoBonus; }

  const COIN_PX = 2.2;
  const COIN_MAGNET = 52;      // a esta distancia la moneda vuela hacia vos
  const COIN_GRAB = 24;        // a esta se recoge
  const COIN_LIFE = 12;        // segundos antes de desaparecer
  const COIN_BLINK = 3;        // últimos segundos parpadeando
  const MAX_GROUND_COINS = 14; // techo duro: en móvil cada objeto cuesta
  const COIN_MERGE_DIST = 78;  // si hay una moneda cerca, se fusionan

  const CRATE_PX = 2.6;
  const CRATE_GRAB = 34;
  const CRATE_LIFE = 26;
  const CRATE_FALL_SPEED = 150;

  // ---- probabilidades de suministro al cerrar una oleada ----
  // el botiquín SOLO se sortea si el jugador viene herido: regalarle vida
  // a alguien que está al 100% no premia nada y rompe la tensión.
  const MEDKIT_CHANCE = 0.20;        // 20% si la vida está por debajo del umbral
  const MEDKIT_HEALTH_THRESHOLD = 0.65;
  const SUPPLY_CHANCE = 0.07;        // 7% — la caja buena, mucho más rara
  const SUPPLY_AMMO_STEP = 3;        // +3 de cargador permanente
  const SUPPLY_AMMO_CAP = 12;        // techo: 4 cajas como máximo por partida

  const COIN_PALETTE = { C:'#8a6510', c:'#c89a20', Y:'#ffd166', L:'#fff3c4' };
  const COIN_GRID = [
    ".CCCC.",
    "CcYYcC",
    "CYYLYC",
    "CYLYYC",
    "CcYYcC",
    ".CCCC."
  ];

  const MEDKIT_PALETTE = { b:'#5a0c0c', B:'#a83232', W:'#e8e2c9', R:'#ff2d4e' };
  const MEDKIT_GRID = [
    "..bbbbbbbb..",
    ".bBBBBBBBBb.",
    "bBWWWWWWWWBb",
    "bBWWWRRWWWBb",
    "bBWWRRRRWWBb",
    "bBWWRRRRWWBb",
    "bBWWWRRWWWBb",
    "bBWWWWWWWWBb",
    ".bBBBBBBBBb.",
    "..bbbbbbbb.."
  ];

  const SUPPLY_PALETTE = { d:'#1f2416', G:'#4a5533', g:'#2f3a20', y:'#c8a83a', Y:'#ffe066' };
  const SUPPLY_GRID = [
    "..dddddddd..",
    ".dGGGGGGGGd.",
    "dGGgGGGGgGGd",
    "dGgGGGGGGgGd",
    "dGyyyyyyyyGd",
    "dGyYYYYYYyGd",
    "dGyyyyyyyyGd",
    "dGgGGGGGGgGd",
    ".dGGgGGgGGGd",
    "..dddddddd.."
  ];

function resetPickups(){
  groundCoins = [];
  supplyDrops = [];
  _supplyAmmoBonus = 0;
}

/* ============================================================
   1 · MONEDAS EN EL SUELO
   ============================================================ */

// UNA sola moneda por evento, y si ya hay otra cerca se fusionan sumando
// el valor. Antes se repartía en hasta 4 monedas por muerte y con media
// docena de zombies cayendo a la vez la pantalla se llenaba de objetos:
// en móvil cada uno cuesta física, dibujado y brillo propio, y eso era
// justo el tirón. Una moneda gorda se lee igual de bien que cuatro chicas.
function dropCoins(x, y, amount){
  if (!groundCoins || amount <= 0) return;

  // ¿hay ya una moneda cerca? sumarle el valor y refrescarle la vida
  let mejor = null, mejorD = COIN_MERGE_DIST;
  for (let i=0;i<groundCoins.length;i++){
    const c = groundCoins[i];
    if (c.dead) continue;
    const d = Math.abs(c.x - x);
    if (d < mejorD){ mejorD = d; mejor = c; }
  }

  // si el suelo está lleno, se fusiona con la más cercana aunque esté
  // lejos: nunca se pierde botín ni se supera el techo de objetos
  if (!mejor && groundCoins.length >= MAX_GROUND_COINS){
    let d2 = Infinity;
    for (let i=0;i<groundCoins.length;i++){
      const c = groundCoins[i];
      if (c.dead) continue;
      const d = Math.abs(c.x - x);
      if (d < d2){ d2 = d; mejor = c; }
    }
  }

  if (mejor){
    mejor.value += amount;
    mejor.life = Math.max(mejor.life, COIN_LIFE * 0.8);
    return;
  }

  groundCoins.push({
    x: x + (Math.random()-0.5)*14,
    y: y,
    vx: (Math.random()-0.5)*70,
    vy: -105 - Math.random()*55,
    value: amount,
    life: COIN_LIFE,
    landed: false,
    bob: Math.random()*Math.PI*2,
    dead: false
  });
}

function collectCoin(c){
  c.dead = true;
  coins += c.value;
  coinVal.textContent = coins;
  playCoinSound();
  spawnParticles(c.x, c.y, '#ffd166', 3, 60);
}

function updateGroundCoins(dt){
  const suelo = groundY + GROUND_DEPTH_OFFSET;
  const px = player.x;
  const py = suelo - player.h*0.45;

  groundCoins.forEach(c => {
    if (c.dead) return;
    c.life -= dt;
    if (c.life <= 0){ c.dead = true; return; }

    const dx = px - c.x;
    const dy = py - c.y;
    const dist = Math.hypot(dx, dy);

    if (dist < COIN_GRAB){ collectCoin(c); return; }

    if (dist < COIN_MAGNET){
      // imán: se despega del suelo y vuela hacia el jugador
      const fuerza = (1 - dist/COIN_MAGNET) * 620;
      c.vx += (dx/dist) * fuerza * dt;
      c.vy += (dy/dist) * fuerza * dt;
      c.landed = false;
    } else if (!c.landed){
      c.vy += 620*dt;             // gravedad hasta tocar asfalto
    }

    c.x += c.vx*dt;
    c.y += c.vy*dt;

    if (!c.landed && c.y >= suelo - 4 && dist >= COIN_MAGNET){
      c.y = suelo - 4;
      c.vy = -c.vy * 0.32;        // rebote amortiguado
      c.vx *= 0.55;
      if (Math.abs(c.vy) < 34){ c.vy = 0; c.landed = true; }
    }
    if (c.landed){
      c.vx *= 0.86;
      c.bob += dt*4;
    }
  });

  compact(groundCoins, c => !c.dead);
}

/* ============================================================
   2 · SUMINISTROS AÉREOS
   ============================================================ */

function spawnSupplyDrop(kind){
  // cae lejos del jugador a propósito: la gracia es tener que ir a
  // buscarlo, no que aterrice en la cara
  const ab = (typeof arenaBounds === 'function') ? arenaBounds() : { min:0, max:WORLD_WIDTH };
  const margen = 120;
  const min = Math.max(ab.min + margen, camX + 60);
  const max = Math.min(ab.max - margen, camX + W - 60);
  let x;
  if (max <= min) {
    x = player.x + (Math.random() < 0.5 ? -1 : 1) * 200;
    x = Math.max(ab.min + margen, Math.min(ab.max - margen, x));
  } else {
    // fuerza que caiga a cierta distancia del jugador
    do { x = min + Math.random()*(max-min); } while (Math.abs(x - player.x) < 150 && max-min > 320);
  }

  supplyDrops.push({
    kind,                                   // 'medkit' | 'supply'
    x,
    y: -40,
    vy: CRATE_FALL_SPEED,
    landed: false,
    life: CRATE_LIFE,
    bob: 0,
    sway: Math.random()*Math.PI*2,
    dead: false
  });
  playWaveSound();
}

// se llama al cerrar cada oleada (game.js). Orden intencional: primero
// se sortea la caja buena y solo si no salió se sortea el botiquín, así
// nunca caen las dos juntas ni la caja queda tapada por el botiquín.
function rollSupplyDrop(){
  if (!supplyDrops) return;
  if (typeof bossActive === 'function' && bossActive()) return;

  const max = (typeof UPG !== 'undefined') ? UPG.effectiveMaxHealth() : MAX_HEALTH;
  const frac = health / max;

  if (_supplyAmmoBonus < SUPPLY_AMMO_CAP && Math.random() < SUPPLY_CHANCE){
    spawnSupplyDrop('supply');
    return;
  }
  if (frac < MEDKIT_HEALTH_THRESHOLD && Math.random() < MEDKIT_CHANCE){
    spawnSupplyDrop('medkit');
  }
}

function applySupplyDrop(d){
  d.dead = true;
  const max = (typeof UPG !== 'undefined') ? UPG.effectiveMaxHealth() : MAX_HEALTH;

  if (d.kind === 'supply'){
    // caja de munición: cargador permanente + vida al tope
    _supplyAmmoBonus = Math.min(_supplyAmmoBonus + SUPPLY_AMMO_STEP, SUPPLY_AMMO_CAP);
    if (typeof recomputeMaxAmmo === 'function') recomputeMaxAmmo();
    ammo = maxAmmo;
    reloading = false;
    ammoVal.textContent = ammo;
    ammoVal.classList.remove('empty');
    const maxAmmoEl = document.getElementById('maxAmmoVal');
    if (maxAmmoEl) maxAmmoEl.textContent = maxAmmo;
    health = max;
    healthInner.style.width = '100%';
    spawnParticles(d.x, groundY + GROUND_DEPTH_OFFSET - 20, '#ffe066', 22, 190);
    spawnChunks(d.x, groundY + GROUND_DEPTH_OFFSET - 20, '#4a5533', 10, 150);
  } else {
    health = max;
    healthInner.style.width = '100%';
    spawnParticles(d.x, groundY + GROUND_DEPTH_OFFSET - 20, '#ff6b7a', 18, 160);
    spawnParticles(d.x, groundY + GROUND_DEPTH_OFFSET - 20, '#e8e2c9', 10, 120);
  }
  playCoinSound();
}

function updateSupplyDrops(dt){
  const suelo = groundY + GROUND_DEPTH_OFFSET;

  supplyDrops.forEach(d => {
    if (d.dead) return;

    if (!d.landed){
      d.y += d.vy*dt;
      d.sway += dt*2.2;
      if (d.y >= suelo){
        d.y = suelo;
        d.landed = true;
        spawnParticles(d.x, suelo, '#8a8478', 10, 90);
      }
    } else {
      d.life -= dt;
      if (d.life <= 0){ d.dead = true; return; }
      d.bob += dt*3;
      if (Math.abs(player.x - d.x) < CRATE_GRAB) applySupplyDrop(d);
    }
  });

  compact(supplyDrops, d => !d.dead);
}

function updatePickups(dt){
  updateGroundCoins(dt);
  updateSupplyDrops(dt);
}

/* ============================================================
   3 · DIBUJADO — lo llama renderer.js dentro de render()
   ============================================================ */

// Los halos se hornean UNA vez a un canvas oculto y luego se estampan con
// drawImage. Antes se llamaba a createRadialGradient por moneda y por
// frame: crear un degradado es de las operaciones más caras del canvas 2D
// y con varias monedas en pantalla era exactamente el origen del tirón en
// móvil. Estampar un bitmap ya hecho es prácticamente gratis.
const _glowCache = {};
function getGlow(key, r, rgb, alpha){
  let c = _glowCache[key];
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = r*2;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(r, r, 0, r, r, r);
  rg.addColorStop(0, `rgba(${rgb},${alpha})`);
  rg.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = rg;
  g.fillRect(0, 0, r*2, r*2);
  _glowCache[key] = c;
  return c;
}

function drawPickups(){
  const suelo = groundY + GROUND_DEPTH_OFFSET;

  // ---- monedas ----
  const brillo = getGlow('coin', 14, '255,209,102', 0.42);
  groundCoins.forEach(c => {
    if (c.x < camX - 40 || c.x > camX + W + 40) return;
    // parpadeo de aviso en los últimos segundos
    if (c.life < COIN_BLINK && Math.floor(c.life*9) % 2 === 0) return;

    const flota = c.landed ? Math.sin(c.bob)*1.6 : 0;
    // las monedas de mucho valor se ven más gordas, para que se note
    // que fusionar botín no es perderlo
    const gordo = 1 + Math.min(c.value, 12)*0.035;

    ctx.save();
    ctx.translate(c.x, c.y + flota);
    ctx.drawImage(brillo, -14, -14);

    // giro: se aplasta en horizontal como una moneda real girando
    const giro = Math.abs(Math.cos(c.bob*0.9));
    ctx.scale((0.35 + giro*0.65) * gordo, gordo);
    ctx.translate(0, 7);
    drawSpriteCached('coin', () => COIN_GRID, COIN_PALETTE, COIN_PX, false);
    ctx.restore();
  });

  // ---- cajas de suministro ----
  supplyDrops.forEach(d => {
    if (d.x < camX - 80 || d.x > camX + W + 80) return;
    const esMed = d.kind === 'medkit';
    const grid = esMed ? MEDKIT_GRID : SUPPLY_GRID;
    const pal  = esMed ? MEDKIT_PALETTE : SUPPLY_PALETTE;
    const key  = esMed ? 'pk_medkit' : 'pk_supply';
    const rgb  = esMed ? '255,45,78' : '255,224,102';

    // aviso en el suelo antes de tocar: sombra que se agranda al caer
    if (!d.landed){
      const prox = Math.max(0, Math.min(1, 1 - (suelo - d.y)/420));
      ctx.save();
      ctx.globalAlpha = 0.25 + prox*0.4;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(d.x, suelo + 2, 12 + prox*14, 4 + prox*3, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(d.x, d.y);

    if (!d.landed){
      // paracaídas: el balanceo va en el contexto para que la caja
      // cuelgue de él en vez de flotar suelta
      const vaiven = Math.sin(d.sway)*0.16;
      ctx.rotate(vaiven);
      ctx.save();
      ctx.translate(0, -46);
      ctx.fillStyle = esMed ? 'rgba(200,60,70,0.9)' : 'rgba(90,105,66,0.9)';
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.quadraticCurveTo(0, -30, 26, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,24,16,0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-24, 1); ctx.lineTo(-8, 30);
      ctx.moveTo(24, 1);  ctx.lineTo(8, 30);
      ctx.moveTo(0, -14); ctx.lineTo(0, 30);
      ctx.stroke();
      ctx.restore();
    } else {
      // pulso de baliza mientras espera a ser recogida; se acelera
      // cuando está por caducar
      const urgencia = d.life < 6 ? 7 : 3;
      const pulso = 0.35 + 0.35*Math.sin(d.bob*urgencia);
      const halo = getGlow(esMed ? 'gl_med' : 'gl_sup', 46, rgb, 0.30);
      ctx.save();
      ctx.globalAlpha = pulso;
      ctx.drawImage(halo, -46, -60);
      ctx.restore();
      ctx.translate(0, Math.sin(d.bob)*1.2);
    }

    drawSpriteCached(key, () => grid, pal, CRATE_PX, false);
    ctx.restore();
  });
}
