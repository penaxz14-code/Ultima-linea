let zombies, bolts;

let spawnTimer;

  const MAX_ALIVE_ZOMBIES = 6;

  const HEAD_HITS = 2;

  const BODY_HITS = 3;

  const HEAD_BAND = 35;

  const FOOT_BAND = 20;

  const HEAD_SLOW_MULT = 0.45;

  const FOOT_SLOW_MULT = 0.22;

  const SPITTER_STOP_DIST = 240;

  const ACID_GRAVITY = 550;

  // ---- umbrales de comportamiento táctico por oleada ----
  // el corredor NO tiene táctica: su identidad es la velocidad pura y el
  // casco. Meterle flanqueo lo volvía impredecible sin ser divertido.
  const TACTICS = {
    FORMATION_WAVE: 10,
    RANGED_COORD_WAVE: 15,
    RETREAT_WAVE: 20
  };

  /* ============================================================
     BLINDAJE POR OLEADA — calibrado contra el daño del jugador
     ------------------------------------------------------------
     Daño por disparo SIN mejoras (ver getWeaponStats en weapons.js):
       pistola en rango  : 2      (3.85 disparos/s)
       escopeta en rango : 6      (3 perdigones x2, 2.85 disparos/s)
       metralleta        : 1      (~9.6 disparos/s)

     CORREDOR — casco medio, sube cada 4 oleadas. En la 25 son 4
     pistoletazos de casco + 3 de cabeza = 7 tiros. Con mejoras de daño
     a la cabeza y crítico baja a ~4. Ahí está el castigo por no
     prepararse: sin mejoras, gastás un cargador entero por corredor.

     ANTIDISTURBIOS — casco ESPECIAL, muchísimo más duro. En la 25 son
     7 pistoletazos solo para el casco. La ruta rentable es reventar el
     escudo (7) y rematar al torso con escopeta (3 disparos). Matarlo de
     cabeza sigue siendo posible, pero cuesta el doble — que es
     exactamente la decisión que queremos que el jugador tome.
     ============================================================ */
  function runnerHelmetHp(w){
    return Math.min(2 + Math.floor((w - 5) / 4), 8);
  }
  function riotHelmetHp(w){
    return Math.min(8 + Math.floor((w - 10) / 3), 16);
  }
  function riotShieldHp(w){
    return Math.min(4 + Math.floor((w - 10) / 5), 9);
  }

  // ---- puente con UPG (upgrades.js): mismas proporciones que usa bosses.js
  // en BOSS_BULLET_DMG, así el arma se siente igual de fuerte contra zombies
  // comunes que contra el jefe. b.damage (multiplicador de ZONA de weapons.js)
  // se aplica ENCIMA de esta base, y todo el total pasa por UPG.damage() para
  // críticos y bonos de mejoras — igual que hace bosses.js con la suya. ----
  const BASE_BULLET_DMG = { pistol:1, shotgun:0.9, smg:0.5 };

  function bulletBaseDamage(b){
    const wepBase = BASE_BULLET_DMG[b.wep] || 1;
    const rangeMult = b.damage || 1;
    return wepBase * rangeMult;
  }

  function upgDamage(base, meta){
    const d = (typeof UPG !== 'undefined') ? UPG.damage(base, meta) : Math.max(1, Math.round(base));
    return (typeof devDmg === 'function') ? devDmg(d) : d;   // [DEV] modo desarrollador
  }

  function upgCoins(base){
    return (typeof UPG !== 'undefined') ? UPG.coins(base) : base;
  }

  function upgSpeedMult(dist){
    return (typeof UPG !== 'undefined') ? UPG.enemySpeedMult(dist) : 1;
  }

  // ---- pixel sprites ----
  const ZOMBIE_PX = 3.2;

  const ZOMBIE_PALETTE = {
    H:'#4a3320', h:'#6b4a2f', g:'#8a6a42',
    S:'#7bbf4a', s:'#3f6b26', L:'#a8e070', x:'#5a2213',
    D:'#1a1008', P:'#e0483a',
    M:'#5a1010', m:'#a02828', T:'#d8d0b8',
    C:'#3a4550', c:'#232c34',
    W:'#c23a3a', w:'#7a1f1f',
    B:'#5a3f22', b:'#3f2b16', y:'#8a6540',
    N:'#d8d8c8'
  };

  const SHIELD_PALETTE = { S:'#1f2a4a', b:'#0f1526', W:'#8fa6c8', w:'#5c7194', y:'#c8a83a', g:'#2f3f5c' };

  // ---- escudo antidisturbios: alto, cubre PIES + TORSO (no la cabeza).
  // 17 filas a px*0.85 = 46px, y el torso del zombie termina a los 44.8px
  // del suelo — así que tapa exactamente el cuerpo entero menos el casco.
  // Ventanilla de policarbonato arriba, banda amarilla de advertencia al
  // medio y refuerzo central abajo. ----
  const SHIELD_GRID = [
    "..bbSSSSbb..",
    ".bSSSSSSSSb.",
    "bSSSSSSSSSSb",
    "bSSWWWWWWSSb",
    "bSSWwwwwWSSb",
    "bSSWwwwwWSSb",
    "bSSWWWWWWSSb",
    "bSSSSSSSSSSb",
    "bSyyyyyyyySb",
    "bSSSSSSSSSSb",
    "bSSSSSSSSSSb",
    "bSSSggggSSSb",
    "bSSSggggSSSb",
    "bSSSSSSSSSSb",
    "bSSSSSSSSSSb",
    ".bSSSSSSSSb.",
    "..bbSSSSbb.."
  ];

  const ZOMBIE_HEAD = [
    ".....HH.HH.HH.....",
    "....HHhHHHhHHH....",
    "...HHhHHHHhHHHH...",
    "..HhHHhHHhSSSSSs..",
    "..hHhSSSLSSSSSss..",
    "..hsSSSSSDDDDDss..",
    "..sSSSSSSDDPDDss..",
    "..SSSSSSsDDDDDss..",
    "..SSSSSSSsMMTmss..",
    "...SSsSSSsMmsSS...",
    "....SsSSSSSSsS....",
    "......sSSSSs......"
  ];

  const ZOMBIE_HEAD_DAMAGE = [
    [5,9,'x'],[5,10,'x'],[5,11,'x'],[5,12,'x'],[5,13,'x'],
    [6,9,'x'],[6,10,'x'],[6,11,'x'],[6,12,'x'],[6,13,'x'],
    [7,9,'x'],[7,10,'x'],[7,11,'x'],[7,12,'x'],[7,13,'x'],
    [8,10,'.'],[8,11,'.'],[8,12,'.'],[8,13,'.'],
    [9,10,'.'],[9,11,'.']
  ];

  // ---- corredor (runner) variant: distinto aspecto, más rápido, casco ----
  const RUNNER_PALETTE = {
    H:'#2e2a20', h:'#463f2e', g:'#5c5340',
    S:'#8a9a7a', s:'#4f5c42', L:'#b8c9a0', x:'#5a2213',
    D:'#1a1008', P:'#e0483a',
    M:'#4a1010', m:'#901f1f', T:'#c8c0a8',
    C:'#3f4a2a', c:'#28301a',
    W:'#c23a3a', w:'#7a1f1f',
    B:'#4a4030', b:'#302a1e', y:'#6a5c40',
    N:'#c8c8b8',
    J:'#3a4a2e', j:'#5c7048', Q:'#201a10'
  };

  const RUNNER_HEAD = [
    "......JJJJJJ......",
    "....JJJJJJJJJJ....",
    "...JjJJJJJJJJjJ...",
    "..JJJJJJJJJJJJJJ..",
    "..QSJJJJJJJJJJQS..",
    "..hsSSSSSDDDDDss..",
    "..sSSSSSSDDPDDss..",
    "..SSSSSSsDDDDDss..",
    "..SSSSSSSsMMTmss..",
    "...SSsSSSsMmsSS...",
    "....SsSSSSSSsS....",
    "......sSSSSs......"
  ];

  // ---- antidisturbios (riot): uniforme azul oscuro, piel ceniza ----
  const RIOT_PALETTE = {
    H:'#1a1a1a', h:'#2e2e2e', g:'#3a3a3a',
    S:'#8a9088', s:'#5a6058', L:'#b0b4a8', x:'#5a2213',
    D:'#100c0a', P:'#e0483a',
    M:'#4a1010', m:'#901f1f', T:'#c8c0a8',
    C:'#1f2a4a', c:'#141c33',
    W:'#c23a3a', w:'#7a1f1f',
    B:'#2a2a2e', b:'#1a1a1c', y:'#3a3a3e',
    N:'#8a8a80',
    J:'#1a2438', j:'#2f3f5c', Q:'#0d1220'
  };

  // ---- casco ESPECIAL del antidisturbios: yelmo blindado integral con
  // visor de policarbonato. Los ojos se ven brillando DETRÁS del cristal
  // (D = cuenca oscura, P = pupila roja), que es lo que lo mantiene con
  // cara de zombie y no de maniquí. El reflejo blanco va al centro, entre
  // los dos ojos, para no taparlos. ----
  const RIOT_HEAD = [
    "....JJJJJJJJJJ....",
    "..JJjjjjjjjjjjJJ..",
    ".JJjjjjjjjjjjjjJJ.",
    ".JjjjjjjjjjjjjjjJ.",
    ".JjjQQQQQQQQQQjjJ.",
    ".JjQCCCCCCCCCCQjJ.",
    ".JjQCDPCWWCPDCQjJ.",
    ".JjQCDDCCCCDDCQjJ.",
    ".JjQQCCCCCCCCQQjJ.",
    "..JjjQQQQQQQQjjJ..",
    "...JjjSSSSSSjjJ...",
    ".....sSSSSSSs....."
  ];

  // ---- escupidor (spitter): piel toxica, tunica podrida ----
  const SPITTER_PALETTE = {
    H:'#3a2f18', h:'#241a0c', g:'#4a3a1c',
    S:'#a8b83a', s:'#6b7a1f', L:'#c8d868', x:'#5a2213',
    D:'#100c0a', P:'#d8e83a',
    M:'#3a5a1f', m:'#6b8a2f', T:'#c8c0a8',
    C:'#5a3a6b', c:'#3a2246',
    W:'#8ab83a', w:'#5a7a1f',
    B:'#3a2740', b:'#241830', y:'#4a3050',
    N:'#a8b878'
  };

  const ZOMBIE_TORSO = [
    "...SSsCCCcCCCCc...",
    ".sSCCcWwWCCCCCcSSN",
    ".sSCCcwWwCCCCcSSNN",
    ".sSCCcWwcCCCCcSSN.",
    ".sSCcCSSssSCCcsS..",
    "..sBBbBBBBBbBBb...",
    "...bBBBBBBBBBBb...",
    "....BbyB..BbyB...."
  ];

  const ZOMBIE_WOUND_POOL = [[1,10,'w'],[2,11,'W'],[4,5,'w'],[5,7,'W'],[3,12,'w'],[6,4,'W']];

  const ZOMBIE_LEG = [
    "SsSs",
    "sSSs",
    "sSsS",
    "SssS",
    "NNNN",
    "...."
  ];

  const ZOMBIE_STUMPS = [
    "....SsSs..sSsS....",
    "....wWww..wWww....",
    EMPTY18,
    EMPTY18,
    EMPTY18,
    EMPTY18
  ];

  function applyOverlay(rows, coords){
    const arr = rows.map(r => r.split(''));
    coords.forEach(([r,c,ch]) => { if (arr[r] && arr[r][c] !== undefined) arr[r][c] = ch; });
    return arr.map(r => r.join(''));
  }

  function pickZombieType(){
    const pool = [{type:'walker', weight:1}];
    if (wave >= 5) pool.push({type:'runner', weight:0.35});
    if (wave >= 10) pool.push({type:'riot', weight:0.28});
    if (wave >= 15) pool.push({type:'spitter', weight:0.24});
    if (wave >= 20) pool.push({type:'brute', weight:0.16});
    const total = pool.reduce((s,p) => s+p.weight, 0);
    let r = Math.random()*total;
    for (const p of pool){ if (r < p.weight) return p.type; r -= p.weight; }
    return 'walker';
  }

  function spawnBolt(z, kind, dmg){
    const startX = z.x;
    const startY = groundY + GROUND_DEPTH_OFFSET - z.h*0.6;
    const targetX = player.x;
    const targetY = groundY + GROUND_DEPTH_OFFSET - player.h*0.5;
    const dx = targetX - startX;
    const dur = Math.max(0.55, Math.abs(dx)/300);
    const vx = dx/dur;
    const vy = (targetY - startY - 0.5*ACID_GRAVITY*dur*dur)/dur;
    const splashRadius = kind === 'fire' ? 46 : 20;
    const visualSize = kind === 'fire' ? 8.5 : 4.2;
    bolts.push({ x:startX, y:startY, vx, vy, trail:[], life: dur+1.0, dead:false, kind, dmg, splashRadius, visualSize });
  }

  function spawnZombie(){
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side === -1 ? (camX - 30) : (camX + W + 30);
    const type = pickZombieType();
    const headBonus = Math.floor((wave-1)/5);
    const bodyBonus = Math.floor((wave-1)/2);

    let speedFactor = 1, scale = 1;
    let headHp = HEAD_HITS + headBonus;
    let bodyHp = BODY_HITS + bodyBonus;
    if (type === 'runner') speedFactor = 2.1;
    if (type === 'riot') speedFactor = 0.8;
    if (type === 'brute') { speedFactor = 0.65; scale = 1.55; headHp += 1; bodyHp *= 3; }

    const spd = (30 + Math.random()*22) * (1 + (wave-1)*0.12) * speedFactor;

    zombies.push({
      x, side, scale,
      w: 40, h: 83*scale,
      px: ZOMBIE_PX*scale,
      speedMag: spd,
      speedMul: 1,
      type,
      attackTimer: type==='brute' ? (2.5 + Math.random()*2) : 0,
      helmetHp: (type==='runner') ? runnerHelmetHp(wave) : (type==='riot' ? riotHelmetHp(wave) : 0),
      helmetBroken: type!=='runner' && type!=='riot',
      shieldHp: type==='riot' ? riotShieldHp(wave) : 0,
      shieldUp: type==='riot',
      spitTimer: 1.5 + Math.random()*1.5,
      headHp, bodyHp,
      headDamaged: false,
      bodyStage: 0,
      legsGone: false,
      dead:false,
      dying:false,
      dyingT:0,
      contactT:0,
      bob: Math.random()*Math.PI*2,
      staggerT:0,
      // ---- estado táctico (se activa por oleada según TACTICS) ----
      // el corredor no lleva estado táctico: solo corre (speedFactor 2.1)
      formationMode: false,    // riot: se agrupan en línea
      formationCenter: null,
      spitterLane: null,       // spitter: -1 izq / 1 der (evita solaparse)
      retreatT: 0              // brute: se retira si estás muy cerca
    });
  }

function updateSpawning(dt){
    // mientras vive el jefe la arena es un duelo: bossLanded() ya barre la
    // horda al aterrizar, pero si el spawner sigue corriendo vuelven a
    // entrar por los lados y arruinan la pelea. El reloj de oleada también
    // está congelado (updateWave sale antes), así que nada más los genera.
    if (typeof bossActive === 'function' && bossActive()) return;

    const aliveCount = zombies.filter(z => !z.dead && !z.dying).length;
    const maxZombies = Math.min(MAX_ALIVE_ZOMBIES + Math.floor((wave-1)/6), 12);
    if (aliveCount <= maxZombies) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnZombie();
        const base = Math.max(1.4 - wave*0.09, 0.4);
        spawnTimer = base + Math.random()*0.5;
      }
    }
}

// aplica el empuje de UPG.enemyPushDistance() al zombie golpeado, en la
// dirección de vuelo de la bala; 0 sin la mejora correspondiente
function applyHitPush(z, b){
  const push = (typeof UPG !== 'undefined') ? UPG.enemyPushDistance() : 0;
  if (push > 0 && !z.dead && !z.dying) {
    z.x += (b.vx >= 0 ? 1 : -1) * push;
  }
}

function resolveHeadHit(z, b){
                if (!z.helmetBroken) {
                const dmgMult = upgDamage(bulletBaseDamage(b), { head:false, x:z.x, y:b.y });
                z.helmetHp -= dmgMult;
                score += 5;
                dropCoins(z.x, b.y, upgCoins(1));
                scoreVal.textContent = score;
                spawnHelmetHitGore(z.x, b.y, z.helmetHp <= 0);
                playHelmetHitSound();
                z.staggerT = 0.15;
                if (z.helmetHp <= 0) z.helmetBroken = true;
              } else {
                const dmgMult = upgDamage(bulletBaseDamage(b), { head:true, x:z.x, y:b.y });
                z.headHp -= dmgMult;
                const isKill = z.headHp <= 0;
                score += isKill ? 25 : 8;
                dropCoins(z.x, b.y, upgCoins(isKill ? 4 : 1));
                scoreVal.textContent = score;
                spawnHeadHitGore(z.x, b.y, isKill);
                if (!isKill) playHeadHitSound();
                if (!z.headDamaged) {
                  z.headDamaged = true;
                  z.speedMul = HEAD_SLOW_MULT;
                }
                z.staggerT = 0.2;
                if (isKill) killZombie(z);
              }
              applyHitPush(z, b);
}

function resolveFootHit(z, b){
                z.legsGone = true;
              z.speedMul *= FOOT_SLOW_MULT;
              score += 10;
              dropCoins(z.x, b.y, upgCoins(3));
              scoreVal.textContent = score;
              spawnParticles(z.x, b.y, '#ff2d4e', 10, 130);
              spawnChunks(z.x, b.y, '#d8d8c8', 6, 140);
              spawnChunks(z.x, b.y, '#4f7a35', 4, 110);
              playFootHitSound();
              z.staggerT = 0.25;
}

function resolveShieldHit(z, b){
                const dmgMult = upgDamage(bulletBaseDamage(b), { head:false, x:z.x, y:b.y });
                z.shieldHp -= dmgMult;
              score += 3;
              dropCoins(z.x, b.y, upgCoins(1));
              scoreVal.textContent = score;
              spawnParticles(z.x, b.y, '#e8e8e8', 5, 90);
              spawnChunks(z.x, b.y, '#1f2a4a', 3, 100);
              playShieldHitSound();
              z.staggerT = 0.1;
              if (z.shieldHp <= 0) {
                z.shieldUp = false;
                score += 8; dropCoins(z.x, b.y, upgCoins(2));
                scoreVal.textContent = score;
                spawnParticles(z.x, b.y, '#8a9aac', 10, 150);
                spawnChunks(z.x, b.y, '#1f2a4a', 8, 160);
              }
              applyHitPush(z, b);
}

function resolveBodyHit(z, b){
                const dmgMult = upgDamage(bulletBaseDamage(b), { head:false, x:z.x, y:b.y });
                z.bodyHp -= dmgMult;
              z.bodyStage = Math.min(z.bodyStage + 1, BODY_HITS);
              const isKill = z.bodyHp <= 0;
              score += isKill ? 12 : 4;
              dropCoins(z.x, b.y, upgCoins(isKill ? 2 : 1));
              scoreVal.textContent = score;
              spawnBodyHitGore(z.x, b.y, isKill);
              if (!isKill) playBodyHitSound();
              z.staggerT = 0.15;
              if (isKill) killZombie(z);
              applyHitPush(z, b);
}

function resolveBulletHits(){
  bullets.forEach(b => {
    if (b.dead) return;
    zombies.forEach(z => {
      if (z.dead || z.dying || b.dead) return;
      const hitW = 22 * z.scale;
      if (Math.abs(b.x - z.x) < hitW) {
        const topY = groundY + GROUND_DEPTH_OFFSET - z.h;
        const headBottomY = topY + HEAD_BAND*z.scale;
        const footTopY = groundY + GROUND_DEPTH_OFFSET - FOOT_BAND*z.scale;
        const feetY = groundY + GROUND_DEPTH_OFFSET;
        if (b.y >= topY && b.y <= feetY) {
          // penetración: si queda carga de UPG.pierceCount(), la bala sigue
          // viva y puede golpear a otro zombie en este mismo frame
          if (b.pierceLeft && b.pierceLeft > 0) b.pierceLeft -= 1;
          else b.dead = true;

          if (b.y <= headBottomY) {
            resolveHeadHit(z, b);
          } else if (z.type === 'riot' && z.shieldUp) {
            // el escudo va ANTES que los pies: ahora tapa piernas y torso,
            // así que mientras esté en pie no existe el atajo de volarle
            // los pies. Una vez roto, las piernas vuelven a ser blanco.
            resolveShieldHit(z, b);
          } else if (z.type !== 'brute' && !z.legsGone && b.y >= footTopY) {
            resolveFootHit(z, b);
          } else {
            resolveBodyHit(z, b);
          }

          // bala explosiva (marcada por UPG.onShotFired cada 8 disparos):
          // daño de área a los zombies alrededor del impacto
          if (b.explosive && typeof UPG !== 'undefined') {
            UPG.triggerExplosion(z.x, b.y, z);
          }
        }
      }
    });
  });
  compact(bullets, b => !b.dead);
}

// ---- RIOT: formación defensiva en línea (oleada 10+) ----
function updateRiotTactic(z, dt, meleeRange){
  const nearbyRiot = zombies.filter(zz =>
    zz.type === 'riot' && !zz.dead && !zz.dying && zz !== z &&
    Math.abs(zz.x - z.x) < 130
  );

  const distToPlayer = Math.abs(z.x - player.x);
  const dirToPlayer = player.x >= z.x ? 1 : -1;
  const spdMult = upgSpeedMult(distToPlayer);

  if (nearbyRiot.length >= 1 && distToPlayer > meleeRange + 30) {
    const partner = nearbyRiot[0];
    z.formationMode = true;
    z.formationCenter = (z.x + partner.x) / 2;

    z.x += z.speedMag * z.speedMul * spdMult * dirToPlayer * dt * 0.85;
    if (Math.abs(z.x - partner.x) < 26) {
      z.x += (z.x < partner.x ? -1 : 1) * 14 * dt;
    }
  } else {
    z.formationMode = false;
    if (distToPlayer > meleeRange) {
      z.x += z.speedMag * z.speedMul * spdMult * dirToPlayer * dt;
    } else {
      z.contactT -= dt;
      if (z.contactT <= 0) {
        z.contactT = 0.55;
        spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - player.h*0.6, '#ff2d4e', 8, 100);
        damagePlayer(9);
      }
    }
  }
}

// ---- SPITTER: coordinación de carriles de tiro (oleada 15+) ----
function updateSpitterTactic(z, dt, meleeRange){
  const distToPlayer = Math.abs(z.x - player.x);
  const dirToPlayer = player.x >= z.x ? 1 : -1;
  const spdMult = upgSpeedMult(distToPlayer);

  if (z.spitterLane === null) {
    const otherSpitter = zombies.find(zz =>
      zz.type === 'spitter' && zz !== z && !zz.dead && !zz.dying
    );
    z.spitterLane = otherSpitter ? (z.x < otherSpitter.x ? -1 : 1) : 0;
  }

  if (distToPlayer > SPITTER_STOP_DIST) {
    z.x += z.speedMag * z.speedMul * spdMult * dirToPlayer * dt;
  } else if (distToPlayer <= meleeRange) {
    z.contactT -= dt;
    if (z.contactT <= 0) {
      z.contactT = 0.55;
      spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - player.h*0.6, '#ff2d4e', 8, 100);
      damagePlayer(9);
    }
  } else if (z.spitterLane !== 0) {
    z.x += z.spitterLane * 18 * spdMult * dt;
  }

  z.spitTimer -= dt;
  const coordBonus = z.spitterLane !== 0 ? 0.75 : 1;
  if (z.spitTimer <= 0 && distToPlayer > 46) {
    spawnBolt(z, 'acid', 11);
    z.spitTimer = (2.2 + Math.random()*1.3) * coordBonus;
  }
}

// ---- BRUTE: retirada táctica + emboscada (oleada 20+) ----
function updateBruteRetreatTactic(z, dt, distToPlayer){
  const dirToPlayer = player.x >= z.x ? 1 : -1;
  const spdMult = upgSpeedMult(distToPlayer);

  if (distToPlayer < BRUTE_ROAR_RADIUS + 70 && z.retreatT <= 0) {
    z.x -= dirToPlayer * z.speedMag * z.speedMul * spdMult * dt * 0.65;
    z.retreatT = 1.1;
  } else {
    z.retreatT -= dt;
    if (distToPlayer > BRUTE_ROAR_RADIUS + 70) {
      z.x += dirToPlayer * z.speedMag * z.speedMul * spdMult * dt;
    }
  }
}

function updateZombiesAI(dt){
      zombies.forEach(z => {
      if (z.dead) return;
      z.bob += dt*6*z.speedMul;
      if (z.dying) {
        z.dyingT -= dt;
        if (z.dyingT <= 0) z.dead = true;
        return;
      }
      const distToPlayer = Math.abs(z.x - player.x);
      const dirToPlayer = player.x >= z.x ? 1 : -1;
      z.facingDir = dirToPlayer;

      const meleeRange = 46 * (z.scale || 1);

      // ---- RIOT: formación desde oleada 10 ----
      if (z.type === 'riot' && wave >= TACTICS.FORMATION_WAVE) {
        updateRiotTactic(z, dt, meleeRange);
        return;
      }

      // ---- SPITTER: coordinación desde oleada 15 ----
      if (z.type === 'spitter' && !z.legsGone && wave >= TACTICS.RANGED_COORD_WAVE) {
        updateSpitterTactic(z, dt, meleeRange);
        return;
      }
      if (z.type === 'spitter' && !z.legsGone) {
        // comportamiento base (antes de oleada 15)
        const spdMult = upgSpeedMult(distToPlayer);
        if (distToPlayer > SPITTER_STOP_DIST) {
          z.x += z.speedMag * z.speedMul * spdMult * dirToPlayer * dt;
        } else if (distToPlayer <= meleeRange) {
          z.contactT -= dt;
          if (z.contactT <= 0) {
            z.contactT = 0.55;
            spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - player.h*0.6, '#ff2d4e', 8, 100);
            damagePlayer(9);
          }
        }
        z.spitTimer -= dt;
        if (z.spitTimer <= 0 && distToPlayer > 46) {
          spawnBolt(z, 'acid', 11);
          z.spitTimer = 2.2 + Math.random()*1.3;
        }
        return;
      }

      // ---- BRUTE: retirada táctica desde oleada 20 ----
      if (z.type === 'brute' && !z.legsGone && wave >= TACTICS.RETREAT_WAVE) {
        updateBruteRetreatTactic(z, dt, distToPlayer);
        updateBruteAttack(z, distToPlayer, dt);
        return;
      }

      // ---- comportamiento base (resto de zombies / oleadas tempranas) ----
      const spdMult = upgSpeedMult(distToPlayer);
      if (distToPlayer > meleeRange) {
        z.x += z.speedMag * z.speedMul * spdMult * dirToPlayer * dt;
      } else {
        z.contactT -= dt;
        if (z.contactT <= 0) {
          z.contactT = 0.55;
          spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - player.h*0.6, '#ff2d4e', 8, 100);
          if (z.type === 'brute') {
            if (!player.invulnerable) {
              const pushDir = player.x >= z.x ? 1 : -1;
              applyKnockback(pushDir, 130);
            }
            damagePlayer(16);
          } else {
            damagePlayer(9);
          }
        }
      }

      if (z.type === 'brute' && !z.legsGone) {
        updateBruteAttack(z, distToPlayer, dt);
      }
      });
    compact(zombies, z => !z.dead);
}

function updateBolts(dt){
    bolts.forEach(a => {
      a.vy += ACID_GRAVITY*dt;
      a.x += a.vx*dt;
      a.y += a.vy*dt;
      a.trail.push({x:a.x, y:a.y});
      if (a.trail.length > 6) a.trail.shift();
      a.life -= dt;
      const groundLevel = groundY + GROUND_DEPTH_OFFSET;
      const splashColor = a.kind === 'fire' ? '#ff6b2a' : '#9be83a';
      const splashColor2 = a.kind === 'fire' ? '#ffb020' : '#5a7a1f';
      if (!a.dead && Math.abs(a.x - player.x) < a.splashRadius && a.y > groundLevel - player.h && a.y < groundLevel + 6) {
        a.dead = true;
        spawnParticles(a.x, a.y, splashColor, a.kind==='fire' ? 16 : 10, a.kind==='fire' ? 170 : 130);
        spawnParticles(a.x, a.y, splashColor2, a.kind==='fire' ? 10 : 6, a.kind==='fire' ? 120 : 90);
        damagePlayer(a.dmg);
      } else if (!a.dead && a.y >= groundLevel) {
        a.dead = true;
        spawnParticles(a.x, groundLevel, splashColor, 8, 110);
      }
    });
    compact(bolts, a => !a.dead && a.life > 0);
}

let zombieGroanTimer = 2;
function updateZombieAmbience(dt){
  zombieGroanTimer -= dt;
  if (zombieGroanTimer <= 0 && zombies.length > 0) {
    playZombieGroan();
    zombieGroanTimer = 2.2 + Math.random()*3.3;
  }
}

function killZombie(z){
  z.dying = true;
  z.dyingT = 0.25;
  if (typeof UPG !== 'undefined') UPG.onKill(z);
  if (z.type === 'brute') bruteExplode(z);
  else playDeathSound();
}

  function buildZombieGrid(z){
    let head;
    if (z.type === 'riot' && !z.helmetBroken)        head = RIOT_HEAD;      // yelmo integral blindado
    else if (z.type === 'runner' && !z.helmetBroken) head = RUNNER_HEAD;    // casco ligero
    else head = z.headDamaged ? applyOverlay(ZOMBIE_HEAD, ZOMBIE_HEAD_DAMAGE) : ZOMBIE_HEAD;
    const woundCount = Math.min(z.bodyStage*2, ZOMBIE_WOUND_POOL.length);
    const torso = woundCount > 0 ? applyOverlay(ZOMBIE_TORSO, ZOMBIE_WOUND_POOL.slice(0, woundCount)) : ZOMBIE_TORSO;
    return head.concat(torso);
  }

  function zombiePalette(type){
    if (type === 'runner') return RUNNER_PALETTE;
    if (type === 'riot') return RIOT_PALETTE;
    if (type === 'spitter') return SPITTER_PALETTE;
    if (type === 'brute') return BRUTE_PALETTE;
    return ZOMBIE_PALETTE;
  }
