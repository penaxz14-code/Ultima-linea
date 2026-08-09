const BRUTE_EXPLOSION_RADIUS = 80;

  const BRUTE_ROAR_RADIUS = 110;

  // ---- tanque (brute): hulking, mas grande y resistente ----
  const BRUTE_PALETTE = {
    H:'#1a1410', h:'#0c0906', g:'#2a2018',
    S:'#7a3a3a', s:'#4a2020', L:'#a85a5a', x:'#3a1408',
    D:'#0c0806', P:'#ff2200',
    M:'#2a0808', m:'#5a1010', T:'#a89880',
    C:'#3a3a3a', c:'#222222',
    W:'#c23a3a', w:'#7a1f1f',
    B:'#2a2422', b:'#181412', y:'#3a322c',
    N:'#5a5450'
  };

  function bruteRoar(z){
    playRoarSound();
    spawnParticles(z.x, groundY + GROUND_DEPTH_OFFSET - z.h*0.5, '#ffb020', 14, 160);
    spawnParticles(z.x, groundY + GROUND_DEPTH_OFFSET - z.h*0.5, '#ff6b2a', 10, 120);
    const dist = Math.abs(z.x - player.x);
    if (dist < BRUTE_ROAR_RADIUS && !player.invulnerable) {
      const pushDir = player.x >= z.x ? 1 : -1;
      applyKnockback(pushDir, 130);
      damagePlayer(14);
    }
  }

function updateBruteAttack(z, distToPlayer, dt){
      z.attackTimer -= dt;
      if (z.attackTimer <= 0) {
        if (distToPlayer > BRUTE_ROAR_RADIUS + 40) {
          spawnBolt(z, 'fire', 14);
          playFireballSound();
          z.attackTimer = 3.2 + Math.random()*1.6;
        } else {
          bruteRoar(z);
          z.attackTimer = 3.6 + Math.random()*1.8;
        }
      }
    
}

function bruteExplode(z){
    playExplosionSound();
    spawnParticles(z.x, groundY + GROUND_DEPTH_OFFSET - z.h*0.4, '#ff6b2a', 24, 220);
    spawnParticles(z.x, groundY + GROUND_DEPTH_OFFSET - z.h*0.4, '#ffb020', 16, 180);
    spawnChunks(z.x, groundY + GROUND_DEPTH_OFFSET - z.h*0.4, '#3a3a3a', 10, 200);
    const dist = Math.abs(z.x - player.x);
    if (dist < BRUTE_EXPLOSION_RADIUS) {
      spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - player.h*0.6, '#ff2d4e', 10, 140);
      damagePlayer(25);
    }
  
}

  // =====================================================================
  //  JEFE OLEADA 25 — "EL ABOMINABLE"
  //  ---------------------------------------------------------------
  //  Estructura:
  //    boss              -> objeto único con la máquina de estados
  //    bossProjectiles[] -> morteros en parábola y ondas horizontales
  //    bossHazards[]     -> marcas de suelo, columnas de fuego, llamas
  //  Vida en TRES depósitos independientes (uno por segmento de la barra):
  //    fase 1 -> puntos débiles (casco + tanque + núcleo)
  //    fase 2 -> blindaje (armorHp)
  //    fase 3 -> criatura (fleshHp)
  // =====================================================================

  const BOSS_WAVE = 25;

  // La arena mide lo mismo que el ancho visible: la cámara queda encuadrada y
  // el jefe y el jugador SIEMPRE están los dos en pantalla durante la pelea.
  const BOSS_ARENA_W = 1000;
  const BOSS_PX = 6.5;
  const BOSS_H = 235;               // alto del jefe blindado
  const BOSS_HALF_W = 150;          // media silueta (sprite)
  const BOSS_BODY_HALF_W = 120;     // hitbox real: algo más angosta que el sprite
  const BOSS_STOMP_R = 190;         // radio del manotazo de apartar
  const BOSS_SWAT_TIME = 0.5;       // duración de la animación de empujón         // pisotón por acercarse demasiado
  const BOSS_NEAR_LIMIT = 162;      // hasta dónde puede acercarse el jugador (fases 1-2)

  const BOSS_WP_MAX = { helmet: 26, tank: 30, core: 34 };
  const BOSS_ARMOR_MAX = 130;
  const BOSS_FLESH_MAX = 100;

  // las balas hacen poco daño: el jefe está pensado para durar
  const BOSS_BULLET_DMG = { pistol: 1, shotgun: 0.9, smg: 0.5 };

  const BOSS_MIN_ATTACK_GAP = 0.6;  // dos ataques nunca arrancan pegados
  const BOSS_MORTAR_G = 620;
  const BOSS_MORTAR_R = 46;
  const BOSS_SWEEP_SPEED = 560;
  const BOSS_SWEEP_R = 36;          // radio de la bola de fuego horizontal
  const BOSS_SWEEP_SAFE = 170;      // la onda nace casi encima: pegarse ya no libra de ella
  const BOSS_COLUMN_R = 40;
  const BOSS_COLUMN_SLOTS = 7;      // rejilla propia de las columnas
  const BOSS_COLUMN_WARN = 1.05;    // aviso en el suelo antes de brotar
  const BOSS_COLUMN_UP = 0.95;
  const BOSS_PUNCH_R = 95;
  const BOSS_PUNCH_WARN = 0.95;
  const BOSS_WALK_SPEED = 66;

  let boss = null;
  let bossProjectiles = [];
  let bossHazards = [];
  let bossShakeT = 0, bossShakeAmp = 0;
  let acidHitCd = 0;
  let bossNameT = 0;
  let bossTitleMain = 'EL ABOMINABLE', bossTitleSub = 'JEFE — OLEADA 25';

  function bossAnnounce(sub, main, dur){
    bossTitleSub = sub; bossTitleMain = main; bossNameT = dur;
  }

  function groundLevel(){ return groundY + GROUND_DEPTH_OFFSET; }

  // punta del hocico de la criatura: de aquí sale todo el ácido
  function bossMouth(){
    const spewing = boss.state === 'breath' && boss.stateStep === 1;
    return {
      x: boss.x + boss.dir*(spewing ? 92 : 78),
      y: groundLevel() - (spewing ? 133 : 140)
    };
  }

  function bclamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function bossActive(){ return !!boss && !boss.dead; }

  // posición del jefe — la consulta weapons.js para calcular la zona
  // óptima del arma. Sin esto, durante la pelea (sin zombies vivos) no
  // había ningún objetivo que medir y todas las armas quedaban "fuera
  // de rango": media potencia y dispersión máxima contra el jefe.
  function bossX(){ return boss ? boss.x : 0; }

  function resetBoss(){
    boss = null;
    bossProjectiles = [];
    bossHazards = [];
    bossShakeT = 0; bossShakeAmp = 0;
    bossNameT = 0;
    stopBossMusic();
    hideBossHUD();
  }

  // ---- límites de movimiento -------------------------------------------
  //  Fases 1-2: el jefe está clavado de espaldas al muro y no se le puede
  //  rodear, pero queda un hueco a su lado (fuera del pisotón) para esquivar
  //  la onda sin dash. Fase 3: camina, así que se le puede pasar por al lado.
  function arenaBounds(){
    if (boss && !boss.dead) {
      if (boss.phase >= 3) return { min: boss.arenaMin + 36, max: boss.arenaMax - 36 };
      const near = boss.x + boss.dir*BOSS_NEAR_LIMIT;
      return boss.dir > 0
        ? { min: near, max: boss.arenaMax - 36 }
        : { min: boss.arenaMin + 36, max: near };
    }
    return { min: 36, max: WORLD_WIDTH - 36 };
  }

  //  Encuadre de cámara: durante el jefe se ancla a la ARENA completa, no a
  //  los límites del jugador. Si se usaban los del jugador, con la arena en el
  //  lado izquierdo la cámara se paraba en el límite de acercamiento y el jefe
  //  (que está detrás de ese límite) se quedaba fuera de pantalla.
  function cameraBounds(){
    if (boss && !boss.dead) return { min: boss.arenaMin, max: boss.arenaMax };
    return { min: 0, max: WORLD_WIDTH };
  }

  function bossShake(dur, amp){
    bossShakeT = Math.max(bossShakeT, dur);
    bossShakeAmp = Math.max(bossShakeAmp, amp);
  }

  function bossShakeX(){
    if (bossShakeT <= 0) return 0;
    return (Math.random()-0.5) * 2 * bossShakeAmp * Math.min(1, bossShakeT);
  }

  // ---------------------------------------------------------------- spawn ----
  function spawnBoss(){
    const onLeft = player.x < WORLD_WIDTH/2;
    const aw = Math.min(BOSS_ARENA_W, WORLD_WIDTH);
    const arenaMin = onLeft ? 0 : WORLD_WIDTH - aw;
    const arenaMax = arenaMin + aw;
    const dir = onLeft ? 1 : -1;
    const x = onLeft ? arenaMin + 175 : arenaMax - 175;

    boss = {
      x, dir, arenaMin, arenaMax,
      phase: 1,
      armorHp: BOSS_ARMOR_MAX, armorMax: BOSS_ARMOR_MAX,
      fleshHp: BOSS_FLESH_MAX, fleshMax: BOSS_FLESH_MAX,
      state: 'entering', stateT: 1.15, stateStep: 0,
      entryP: 0,
      bob: 0, flash: 0, stagger: 0, telegraph: 0,
      blinkT: 2 + Math.random()*3, blink: 0,
      twitchT: 2.5 + Math.random()*3, twitch: 0,
      smokeT: 0, sparkT: 0, leakT: 0, groanT: 3,
      armAnim: 0, walkPhase: 0,
      swatT: 0, swatDone: true,
      transT: 0, transMax: 1, transStage: 0,
      wp: {
        helmet: { hp: BOSS_WP_MAX.helmet, max: BOSS_WP_MAX.helmet, broken: false, flash: 0 },
        tank:   { hp: BOSS_WP_MAX.tank,   max: BOSS_WP_MAX.tank,   broken: false, flash: 0 },
        core:   { hp: BOSS_WP_MAX.core,   max: BOSS_WP_MAX.core,   broken: false, flash: 0 }
      },
      tMortar: 2.4, tSweep: 4.6, tColumns: 99, tPunch: 99, tBreath: 99,
      mortarTargets: [], shots: 0, shotsLeft: 0,
      attackLock: 0, contactT: 0.5,
      dead: false, dyingT: 0
    };

    const ab = arenaBounds();
    player.x = bclamp(player.x, ab.min, ab.max);
    bossAnnounce('JEFE — OLEADA 25', 'EL ABOMINABLE', 4.5);
    showBossHUD();
    updateBossHUD();
  }

  function bossLanded(){
    bossShake(1.2, 14);
    playBossRoar();
    spawnChunks(boss.x, groundLevel(), '#454e46', 18, 240);
    spawnParticles(boss.x, groundLevel(), '#8d968a', 22, 280);
    zombies.forEach(z => {
      if (z.dead || z.dying) return;
      z.dying = true; z.dyingT = 0.25;
      spawnChunks(z.x, groundLevel()-20, '#4f7a35', 4, 120);
    });
    boss.state = 'idle';
    boss.tMortar = 1.8;
    boss.tSweep = 3.6;
    startBossMusic(1);
  }

  // ------------------------------------------------------- puntos débiles ----
  //  Cajas (no círculos): así cualquier bala que entre a esa altura acaba
  //  impactando, incluido el tanque de la espalda.
  function bossWeakPoints(){
    const gy = groundLevel();
    return [
      { id:'helmet', x: boss.x + boss.dir*4,   y: gy - 208, r: 28 },
      { id:'core',   x: boss.x,                y: gy - 124, r: 18 },
      { id:'tank',   x: boss.x - boss.dir*100, y: gy - 185, r: 28 }
    ];
  }

  function bossBodyHit(b){
    const gy = groundLevel();
    const halfW = boss.phase >= 3 ? 62 : BOSS_BODY_HALF_W;
    const h = boss.phase >= 3 ? 195 : BOSS_H;
    return Math.abs(b.x - boss.x) < halfW && b.y > gy - h && b.y < gy + 4;
  }

  // ¿la trayectoria de la bala entra en la caja de un punto débil?  (slab test)
  function bossRayReachesBox(b, wp){
    let tmin = 0, tmax = Infinity;
    const axes = [
      { p: b.x, d: b.vx, lo: wp.x - wp.r, hi: wp.x + wp.r },
      { p: b.y, d: b.vy, lo: wp.y - wp.r, hi: wp.y + wp.r }
    ];
    for (const a of axes){
      if (Math.abs(a.d) < 1e-6) {
        if (a.p < a.lo || a.p > a.hi) return false;
      } else {
        let t1 = (a.lo - a.p)/a.d, t2 = (a.hi - a.p)/a.d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return false;
      }
    }
    return tmax >= tmin;
  }

  //  El blindaje sólo rebota la bala si NO va camino de una abertura. Así
  //  cualquier disparo realmente apuntado a un punto débil llega, venga del
  //  ángulo que venga (incluido el tanque de la espalda).
  function bossOpeningAt(b, wps){
    for (let i=0;i<wps.length;i++){
      const wp = wps[i];
      if (boss.wp[wp.id].broken) continue;
      if (bossRayReachesBox(b, wp)) return true;
    }
    return false;
  }

  function bossInvulnerable(){
    return boss.state === 'entering' || boss.state === 'break1' ||
           boss.state === 'break2'   || boss.state === 'dying';
  }

  function resolveBossBulletHits(){
    if (!boss || boss.dead || bossInvulnerable()) return;
    const wps = boss.phase === 1 ? bossWeakPoints() : null;

    bullets.forEach(b => {
      if (b.dead) return;
      const dmg = devDmg(UPG.damage(BOSS_BULLET_DMG[b.wep] || 1));   // [DEV] modo desarrollador
      // Nota de diseño: el jefe SÓLO recibe el daño general y la
      // probabilidad de crítico de las mejoras. No recibe el bonus de
      // "daño a la cabeza" (no tiene una zona de cabeza equivalente),
      // ni penetración ni disparo explosivo (su sistema de golpes por
      // punto débil es distinto al de los zombies comunes y su ritmo
      // ya está afinado a mano) — así la pelea conserva su duración
      // pensada incluso con una build muy cargada de mejoras.

      if (boss.phase === 1) {
        for (let i=0;i<wps.length;i++){
          const wp = wps[i];
          if (boss.wp[wp.id].broken) continue;
          if (Math.abs(b.x - wp.x) <= wp.r && Math.abs(b.y - wp.y) <= wp.r) {
            b.dead = true;
            damageWeakPoint(wp.id, dmg, b.x, b.y);
            return;
          }
        }
        if (bossBodyHit(b) && !bossOpeningAt(b, wps)) {
          b.dead = true;
          bossRicochet(b.x, b.y);
        }
      } else {
        if (bossBodyHit(b)) {
          b.dead = true;
          damageBossBody(dmg, b.x, b.y);
        }
      }
    });
  }

  function bossRicochet(x, y){
    spawnParticles(x, y, '#c9cfc4', 3, 70);
    spawnParticles(x, y, '#ffd35a', 2, 55);
    playBossRicochet();
  }

  // ---- feedback de impacto en zona vulnerable: destello + sacudida + gore ----
  function bossVulnerableHitFX(x, y, color){
    boss.flash = 0.11;
    bossShake(0.09, 3.2);
    spawnParticles(x, y, color, 5, 100);
    spawnParticles(x, y, '#ffd35a', 3, 70);
    bossHazards.push({ kind:'spark', x, y, t:0.22, max:0.22, r:16 });
  }

  function damageWeakPoint(id, dmg, x, y){
    const st = boss.wp[id];
    st.hp -= dmg;
    st.flash = 0.16;
    score += 6;
    if (Math.random() < 0.35) { coins += UPG.coins(1); coinVal.textContent = coins; }
    scoreVal.textContent = score;
    bossVulnerableHitFX(x, y, id === 'tank' ? '#8ad13a' : '#ff3b30');
    if (id === 'tank') spawnParticles(x, y, '#c8e83a', 3, 80);
    playBossHitSound();
    updateBossHUD();
    if (st.hp <= 0) breakWeakPoint(id, x, y);
  }

  function breakWeakPoint(id, x, y){
    const st = boss.wp[id];
    st.broken = true;
    st.hp = 0;
    boss.stagger = 0.75;
    bossShake(0.6, 9);
    score += 300; coins += UPG.coins(25);
    scoreVal.textContent = score;
    coinVal.textContent = coins;
    playBossArmorBreak();
    playBossRoar();

    if (id === 'helmet') {
      spawnChunks(x, y, '#454e46', 14, 210);
      spawnChunks(x, y, '#8d968a', 10, 180);
      spawnParticles(x, y, '#ffd35a', 10, 160);
    } else if (id === 'tank') {
      spawnParticles(x, y, '#8ad13a', 24, 210);
      spawnParticles(x, y, '#4c7a1f', 14, 160);
      spawnChunks(x, y, '#2f3630', 10, 190);
    } else {
      spawnParticles(x, y, '#ff9a2a', 24, 220);
      spawnParticles(x, y, '#ffd35a', 14, 170);
      spawnChunks(x, y, '#5a2f22', 10, 180);
    }
    updateBossHUD();

    if (boss.wp.helmet.broken && boss.wp.tank.broken && boss.wp.core.broken) bossEnterPhase2();
  }

  function damageBossBody(dmg, x, y){
    if (boss.phase === 2) {
      boss.armorHp -= dmg;
      bossVulnerableHitFX(x, y, '#ff3b30');
      spawnParticles(x, y, '#8a2a2a', 2, 70);
      playBossHitSound();
      updateBossHUD();
      if (boss.armorHp <= 0) { boss.armorHp = 0; bossEnterPhase3(); }
    } else {
      boss.fleshHp -= dmg;
      bossVulnerableHitFX(x, y, '#ff2d4e');
      spawnParticles(x, y, '#7a1010', 3, 90);
      playBossHitSound();
      updateBossHUD();
      if (boss.fleshHp <= 0) { boss.fleshHp = 0; killBoss(); }
    }
  }

  // ------------------------------------------------- transiciones de fase ----
  function bossEnterPhase2(){
    boss.phase = 2;
    boss.state = 'break1';
    boss.stateT = 2.4;
    boss.transMax = 2.4;
    boss.transStage = 0;
    boss.attackLock = 0;
    bossProjectiles.length = 0;
    bossShake(1.6, 16);
    playBossRoar();
    playBossArmorBreak();
    startBossMusic(2);
    bossAnnounce('FASE 2', 'BLINDAJE ROTO', 3.2);
    updateBossHUD();
  }

  function bossEnterPhase3(){
    boss.phase = 3;
    boss.state = 'break2';
    boss.stateT = 3.0;
    boss.transMax = 3.0;
    boss.transStage = 0;
    boss.attackLock = 0;
    bossProjectiles.length = 0;
    bossHazards.length = 0;
    bossShake(2.2, 20);
    playBossArmorBreak();
    playBossRoar();
    startBossMusic(3);
    bossAnnounce('FASE FINAL', 'LA COSA DE DENTRO', 3.4);
    updateBossHUD();
  }

  function updateBossBreak1(dt){
    boss.stateT -= dt;
    const p = 1 - boss.stateT/boss.transMax;
    bossShake(0.2, 6 + 6*(1-p));
    if (boss.transStage === 0 && p > 0.25) {
      boss.transStage = 1;
      playBossArmorBreak();
      for (let i=0;i<14;i++){
        spawnChunks(boss.x + (Math.random()-0.5)*220, groundLevel() - 60 - Math.random()*160, '#454e46', 1, 240);
      }
    }
    if (boss.transStage === 1 && p > 0.6) {
      boss.transStage = 2;
      playBossRoar();
      spawnParticles(boss.x, groundLevel() - 130, '#ff9a2a', 22, 240);
      spawnChunks(boss.x, groundLevel() - 130, '#8d968a', 12, 220);
    }
    if (boss.stateT <= 0) {
      boss.state = 'idle';
      boss.attackLock = 0.5;
      boss.tMortar = 1.8;
      boss.tSweep = 3.2;
      boss.tColumns = 2.4;
    }
  }

  function updateBossBreak2(dt){
    boss.stateT -= dt;
    const p = 1 - boss.stateT/boss.transMax;
    bossShake(0.25, 8 + 10*(1-p));
    if (boss.transStage === 0 && p > 0.35) {
      boss.transStage = 1;
      playBossArmorBreak();
      for (let i=0;i<26;i++){
        spawnChunks(boss.x + (Math.random()-0.5)*260, groundLevel() - 40 - Math.random()*200, '#6b7369', 1, 300);
      }
      spawnParticles(boss.x, groundLevel() - 140, '#8ad13a', 26, 260);
    }
    if (boss.transStage === 1 && p > 0.62) {
      boss.transStage = 2;   // aquí ya se ve la criatura
      playBossRoar();
      playExplosionSound();
      spawnParticles(boss.x, groundLevel() - 110, '#ff2d4e', 30, 280);
      spawnChunks(boss.x, groundLevel() - 110, '#5f7a3f', 14, 240);
    }
    if (boss.stateT <= 0) {
      boss.state = 'walk';
      boss.attackLock = 0.6;
      boss.tPunch = 2.6;
      boss.tBreath = 3.4;
      boss.tMortar = 6.0;
    }
  }

  // ------------------------------------------------------------- ataque 1 ----
  //  BOLAS DE FUEGO EN PARÁBOLA. La arena se divide en casillas: una cae
  //  siempre encima del jugador y el resto en casillas sorteadas dejando
  //  siempre pasillos libres.
  const BOSS_SLOTS = 4;

  function bossSlotSpan(){
    const ab = arenaBounds();
    return { a: ab.min, b: ab.max, w: (ab.max - ab.min)/BOSS_SLOTS };
  }

  function bossSlotX(i){
    const sp = bossSlotSpan();
    return sp.a + (i + 0.5)*sp.w;
  }

  function bossPlayerSlot(){
    const sp = bossSlotSpan();
    return bclamp(Math.floor((player.x - sp.a)/sp.w), 0, BOSS_SLOTS-1);
  }

  function pickMortarTargets(n){
    const sp = bossSlotSpan();
    const targets = [ bclamp(player.x, sp.a, sp.b) ];
    const mine = bossPlayerSlot();
    const rest = [];
    for (let i=0;i<BOSS_SLOTS;i++) if (i !== mine) rest.push(i);
    for (let i=rest.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp;
    }
    for (const i of rest){
      if (targets.length >= n) break;
      const x = bossSlotX(i) + (Math.random()-0.5)*22;
      if (targets.some(t => Math.abs(t - x) < BOSS_MORTAR_R*2.6)) continue;
      targets.push(x);
    }
    return targets;
  }

  function startBossMortar(){
    boss.state = 'mortar';
    boss.stateStep = 0;
    boss.stateT = 0.65;
    boss.mortarTargets = pickMortarTargets(boss.phase >= 2 ? 3 : 2);
    boss.shots = boss.mortarTargets.length;
    boss.shotsLeft = boss.shots;
    boss.telegraph = 1;
    boss.attackLock = BOSS_MIN_ATTACK_GAP;
    boss.tMortar = (boss.phase >= 2 ? 4.2 : 5.0) + Math.random()*1.3;
    playBossChargeSound();
  }

  function fireBossMortar(targetX){
    const gl = groundLevel();
    const acid = boss.phase >= 3;                 // sin traje ya sólo escupe ácido
    const m = acid ? bossMouth() : null;
    const sx = acid ? m.x : boss.x + boss.dir*30;
    const sy = acid ? m.y : gl - 170;
    const vy0 = -560;
    const t = (-vy0 + Math.sqrt(vy0*vy0 + 2*BOSS_MORTAR_G*(gl - sy))) / BOSS_MORTAR_G;
    const vx = (targetX - sx) / t;
    bossProjectiles.push({ kind:'mortar', acid, x:sx, y:sy, vx, vy:vy0, targetX, trail:[], life: t + 0.4, r: acid ? 13 : 15, wob: Math.random()*6 });
    bossHazards.push({ kind:'mark', x:targetX, r:BOSS_MORTAR_R, t, max:t, acid });
    if (acid) playBossAcidSpew(); else playBossMortarSound();
  }

  function updateBossMortar(dt){
    boss.stateT -= dt;
    if (boss.stateStep === 0) {
      boss.telegraph = Math.max(0, boss.stateT/0.65);
      if (boss.stateT <= 0) { boss.stateStep = 1; boss.stateT = 0; boss.telegraph = 0; }
      return;
    }
    if (boss.stateT <= 0) {
      if (boss.shotsLeft > 0) {
        fireBossMortar(boss.mortarTargets[boss.shots - boss.shotsLeft]);
        boss.shotsLeft -= 1;
        boss.stateT = boss.shotsLeft > 0 ? 0.3 : 0.4;
      } else {
        boss.state = boss.phase >= 3 ? 'walk' : 'idle';
      }
    }
  }

  function bossMortarImpact(x, acid){
    const gl = groundLevel();
    bossShake(0.3, 6);
    if (acid) {
      spawnParticles(x, gl - 6, '#8ad13a', 20, 230);
      spawnParticles(x, gl - 6, '#c8e83a', 12, 180);
      spawnChunks(x, gl - 6, '#4c7a1f', 6, 170);
      playAcidSplashSound();
      if (Math.abs(player.x - x) < BOSS_MORTAR_R) {
        damagePlayer(16);
        applyKnockback(player.x >= x ? 1 : -1, 80);
      }
      bossHazards.push({ kind:'acidpool', x, r:44, t:2.2, max:2.2, tick:0.2, bub:0 });
    } else {
      spawnParticles(x, gl - 6, '#ff9a2a', 18, 220);
      spawnParticles(x, gl - 6, '#ffd35a', 10, 170);
      spawnChunks(x, gl - 6, '#5a2f22', 6, 180);
      playExplosionSound();
      if (Math.abs(player.x - x) < BOSS_MORTAR_R) {
        damagePlayer(18);
        applyKnockback(player.x >= x ? 1 : -1, 90);
      }
      bossHazards.push({ kind:'flame', x, r:38, t:1.0, max:1.0, tick:0.25 });
    }
  }

  // ------------------------------------------------------------- ataque 2 ----
  //  ONDA HORIZONTAL RÁPIDA: se esquiva con dash (o pegándose al jefe).
  function startBossSweep(){
    boss.state = 'sweep';
    boss.stateStep = 0;
    boss.stateT = 0.9;
    boss.telegraph = 1;
    boss.attackLock = BOSS_MIN_ATTACK_GAP;
    boss.tSweep = (boss.phase >= 2 ? 5.2 : 5.8) + Math.random()*0.8;
    playBossChargeSound();
  }

  function updateBossSweep(dt){
    boss.stateT -= dt;
    if (boss.stateStep === 0) {
      boss.telegraph = Math.max(0, boss.stateT/0.9);
      if (boss.stateT <= 0) {
        boss.stateStep = 1;
        boss.stateT = 0.35;
        boss.telegraph = 0;
        bossProjectiles.push({
          kind:'sweep',
          x: boss.x + boss.dir*BOSS_SWEEP_SAFE,
          y: groundLevel() - BOSS_SWEEP_R - 4,
          vx: boss.dir*BOSS_SWEEP_SPEED,
          life: 3.5, r: BOSS_SWEEP_R, hit:false, phase:0, spin:0
        });
        bossShake(0.28, 6);
        playBossSweepSound();
      }
      return;
    }
    if (boss.stateT <= 0) boss.state = 'idle';
  }

  // ------------------------------------------------------------- ataque 3 ----
  //  COLUMNAS DE FUEGO (fase 2): se marcan ~1s antes y dejan siempre hueco.
  function startBossColumns(){
    boss.state = 'columns';
    boss.stateT = 0.55;
    boss.telegraph = 1;
    boss.attackLock = BOSS_MIN_ATTACK_GAP;
    boss.tColumns = 4.4 + Math.random()*1.4;

    //  Rejilla fina de 7 posiciones. Se eligen 3-4 NUNCA contiguas: entre dos
    //  columnas siempre queda al menos una posición vacía (unos 100 px de
    //  pasillo), y una de ellas cae siempre donde está el jugador.
    const sp = bossSlotSpan();
    const w = (sp.b - sp.a)/BOSS_COLUMN_SLOTS;
    const colX = i => sp.a + (i + 0.5)*w;
    const mine = bclamp(Math.floor((player.x - sp.a)/w), 0, BOSS_COLUMN_SLOTS-1);

    const libres = [];
    for (let i=0;i<BOSS_COLUMN_SLOTS;i++) if (Math.abs(i - mine) > 1) libres.push(i);
    for (let i=libres.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const tmp = libres[i]; libres[i] = libres[j]; libres[j] = tmp;
    }

    const elegidos = [mine];
    const objetivo = 3 + (Math.random() < 0.5 ? 1 : 0);
    for (const i of libres){
      if (elegidos.length >= objetivo) break;
      if (elegidos.some(k => Math.abs(k - i) <= 1)) continue;
      elegidos.push(i);
    }

    elegidos.forEach((i, k) => {
      const x = k === 0 ? bclamp(player.x, sp.a, sp.b) : colX(i);
      bossHazards.push({
        kind:'column', x, r:BOSS_COLUMN_R,
        t: BOSS_COLUMN_WARN + BOSS_COLUMN_UP, max: BOSS_COLUMN_WARN + BOSS_COLUMN_UP,
        warn: BOSS_COLUMN_WARN, up: BOSS_COLUMN_UP, fired: false, tick: 0,
        seed: Math.random()*6
      });
    });
    playBossChargeSound();
  }

  function updateBossColumns(dt){
    boss.stateT -= dt;
    boss.telegraph = Math.max(0, boss.stateT/0.55);
    if (boss.stateT <= 0) boss.state = 'idle';
  }

  // ------------------------------------------------------------- ataque 4 ----
  //  FASE 3: aliento de fuego mientras avanza + puñetazo al suelo mortal.
  function startBossBreath(){
    boss.state = 'breath';
    boss.stateStep = 0;
    boss.stateT = 0.6;
    boss.telegraph = 1;
    boss.attackLock = BOSS_MIN_ATTACK_GAP;
    boss.tBreath = 4.6 + Math.random()*1.6;
    boss.breathTick = 0;
    playBossChargeSound();
  }

  // gota de ácido: sale de la boca en parábola y deja charco al caer
  function spawnAcidGlob(){
    const m = bossMouth();
    const ox = m.x, oy = m.y;
    // arcos muy variados: el chorro barre desde justo delante del hocico
    // hasta media arena, así que hay que alejarse o atravesarlo con el dash
    const spd = 140 + Math.random()*300;
    bossProjectiles.push({
      kind:'glob', x:ox, y:oy,
      vx: boss.dir*spd, vy: -90 - Math.random()*180,
      r: 5.5 + Math.random()*5, life: 2.4, wob: Math.random()*Math.PI*2,
      trail: []
    });
  }

  function updateBossBreath(dt){
    boss.stateT -= dt;
    if (boss.stateStep === 0) {
      boss.telegraph = Math.max(0, boss.stateT/0.6);
      if (boss.stateT <= 0) {
        boss.stateStep = 1;
        boss.stateT = 1.3;
        boss.telegraph = 0;
        playBossAcidSpew();
      }
      return;
    }
    boss.breathTick -= dt;
    if (boss.breathTick <= 0) {
      boss.breathTick = 0.075;
      spawnAcidGlob();
      const m = bossMouth();
      spawnParticles(m.x, m.y, Math.random() < 0.5 ? '#8ad13a' : '#c8e83a', 2, 60);
    }
    if (boss.stateT <= 0) boss.state = 'walk';
  }

  function startBossPunch(){
    boss.state = 'punch';
    boss.stateStep = 0;
    boss.stateT = BOSS_PUNCH_WARN;
    boss.telegraph = 1;
    boss.attackLock = BOSS_MIN_ATTACK_GAP;
    boss.tPunch = 3.4 + Math.random()*1.2;
    boss.punchX = bclamp(player.x, Math.min(boss.x + boss.dir*40, boss.x + boss.dir*175),
                                   Math.max(boss.x + boss.dir*40, boss.x + boss.dir*175));
    bossHazards.push({ kind:'punchmark', x: boss.punchX, r: BOSS_PUNCH_R, t: BOSS_PUNCH_WARN, max: BOSS_PUNCH_WARN });
    playBossChargeSound();
  }

  function updateBossPunch(dt){
    boss.stateT -= dt;
    if (boss.stateStep === 0) {
      boss.telegraph = Math.max(0, boss.stateT/BOSS_PUNCH_WARN);
      boss.armAnim = 1 - boss.stateT/BOSS_PUNCH_WARN;
      if (boss.stateT <= 0) {
        boss.stateStep = 1;
        boss.stateT = 0.45;
        boss.telegraph = 0;
        bossPunchImpact();
      }
      return;
    }
    boss.armAnim = Math.max(0, boss.stateT/0.45);
    if (boss.stateT <= 0) { boss.armAnim = 0; boss.state = 'walk'; }
  }

  function bossPunchImpact(){
    const gl = groundLevel();
    bossShake(0.7, 16);
    playExplosionSound();
    spawnChunks(boss.punchX, gl - 6, '#3a3a3a', 16, 260);
    spawnParticles(boss.punchX, gl - 6, '#8d968a', 20, 280);
    spawnParticles(boss.punchX, gl - 6, '#ff9a2a', 10, 200);
    bossHazards.push({ kind:'shock', x: boss.punchX, r: BOSS_PUNCH_R, t:0.35, max:0.35 });
    if (Math.abs(player.x - boss.punchX) < BOSS_PUNCH_R && !player.invulnerable) {
      damagePlayer(999);   // el puñetazo mata de un golpe (el dash te salva)
    }
  }

  // ---------------------------------------------------------------- update ----
  function updateBossIdle(dt){
    boss.tMortar -= dt;
    boss.tSweep -= dt;
    if (boss.phase >= 2) boss.tColumns -= dt;
    if (boss.attackLock > 0) return;
    if (boss.tSweep <= 0)   { startBossSweep(); return; }
    if (boss.tColumns <= 0) { startBossColumns(); return; }
    if (boss.tMortar <= 0)  { startBossMortar(); return; }
  }

  function updateBossWalk(dt){
    const d = player.x - boss.x;
    const dist = Math.abs(d);
    boss.dir = d >= 0 ? 1 : -1;
    if (dist > 78) {
      boss.x += Math.sign(d) * BOSS_WALK_SPEED * dt;
      boss.walkPhase += dt*5.5;
    }
    boss.x = bclamp(boss.x, boss.arenaMin + 90, boss.arenaMax - 90);

    boss.tPunch -= dt;
    boss.tBreath -= dt;
    boss.tMortar -= dt;
    if (boss.attackLock > 0) return;
    if (boss.tPunch <= 0 && dist < 235) { startBossPunch(); return; }
    if (boss.tBreath <= 0 && dist < 320) { startBossBreath(); return; }
    if (boss.tMortar <= 0) { startBossMortar(); return; }
  }

  function updateBossProjectiles(dt){
    const gl = groundLevel();
    if (acidHitCd > 0) acidHitCd -= dt;
    bossProjectiles.forEach(p => {
      p.life -= dt;
      if (p.kind === 'mortar') {
        p.vy += BOSS_MORTAR_G*dt;
        p.x += p.vx*dt;
        p.y += p.vy*dt;
        p.trail.push({x:p.x, y:p.y});
        if (p.trail.length > 8) p.trail.shift();
        if (!p.acid && Math.random() < 0.55) {
          embers.push({
            x: p.x + (Math.random()-0.5)*16, y: p.y + (Math.random()-0.5)*12,
            vx: (Math.random()-0.5)*40 - p.vx*0.06, vy: -10 - Math.random()*40,
            life: 0.35 + Math.random()*0.4, maxLife: 0.75, size: 1.4 + Math.random()*2
          });
        }
        if (p.y >= gl) { p.dead = true; bossMortarImpact(p.x, p.acid); }
      } else if (p.kind === 'glob') {
        p.vy += 700*dt;
        p.x += p.vx*dt;
        p.y += p.vy*dt;
        p.trail.push({x:p.x, y:p.y});
        if (p.trail.length > 5) p.trail.shift();
        if (!p.dead && acidHitCd <= 0 && Math.abs(p.x - player.x) < 24 && p.y > gl - player.h && p.y < gl + 4 && !player.invulnerable) {
          p.dead = true;
          acidHitCd = 0.62;
          damagePlayer(8);
          spawnParticles(player.x, gl - player.h*0.6, '#8ad13a', 10, 130);
          playAcidSplashSound();
        }
        if (!p.dead && p.y >= gl) {
          p.dead = true;
          spawnParticles(p.x, gl - 4, '#8ad13a', 5, 90);
          if (Math.random() < 0.55) bossHazards.push({ kind:'acidpool', x:p.x, r:22, t:1.1, max:1.1, tick:0.2, bub:0 });
        }
        if (p.x < boss.arenaMin - 40 || p.x > boss.arenaMax + 40) p.dead = true;
      } else if (p.kind === 'sweep') {
        p.x += p.vx*dt;
        p.phase += dt*14;
        p.spin += dt*7*(p.vx > 0 ? 1 : -1);
        p.y = groundLevel() - BOSS_SWEEP_R - 4 + Math.sin(p.phase*0.5)*4;
        if (Math.random() < 0.9) {
          embers.push({
            x: p.x - Math.sign(p.vx)*Math.random()*60, y: p.y + (Math.random()-0.5)*60,
            vx: (Math.random()-0.5)*50, vy: -30 - Math.random()*70,
            life: 0.3 + Math.random()*0.45, maxLife: 0.75, size: 1.3 + Math.random()*2.2
          });
        }
        if (!p.hit && Math.abs(p.x - player.x) < BOSS_SWEEP_R - 2 && !player.invulnerable) {
          p.hit = true;
          damagePlayer(20);
          applyKnockback(p.vx > 0 ? 1 : -1, 110);
          spawnParticles(player.x, gl - player.h*0.6, '#ff9a2a', 12, 150);
        }
        if (p.x < boss.arenaMin - 40 || p.x > boss.arenaMax + 40) p.dead = true;
      }
    });
    compact(bossProjectiles, p => !p.dead && p.life > 0);
  }

  function updateBossHazards(dt){
    const gl = groundLevel();
    bossHazards.forEach(h => {
      h.t -= dt;
      if (h.kind === 'flame') {
        h.tick -= dt;
        if (h.tick <= 0) {
          h.tick = 0.4;
          if (Math.abs(player.x - h.x) < h.r) damagePlayer(6);
        }
        if (Math.random() < 0.5) {
          embers.push({
            x: h.x + (Math.random()-0.5)*h.r*1.6, y: gl - 4,
            vx: (Math.random()-0.5)*20, vy: -50 - Math.random()*50,
            life: 0.5 + Math.random()*0.4, maxLife: 0.9, size: 1.4 + Math.random()*1.6
          });
        }
      } else if (h.kind === 'acidpool') {
        h.tick -= dt;
        h.bub = (h.bub || 0) + dt;
        if (h.tick <= 0) {
          h.tick = 0.45;
          if (Math.abs(player.x - h.x) < h.r) damagePlayer(5);
        }
        if (Math.random() < 0.25) spawnParticles(h.x + (Math.random()-0.5)*h.r*1.4, gl - 6, '#8ad13a', 1, 26);
      } else if (h.kind === 'column') {
        const elapsed = h.max - h.t;
        if (!h.fired && elapsed >= h.warn) {
          h.fired = true;
          bossShake(0.2, 5);
          playBossColumnSound();
          spawnParticles(h.x, gl - 10, '#ff9a2a', 14, 190);
          spawnParticles(h.x, gl - 40, '#ffd35a', 8, 150);
        }
        if (h.fired) {
          h.tick -= dt;
          if (h.tick <= 0) {
            h.tick = 0.3;
            if (Math.abs(player.x - h.x) < h.r) damagePlayer(14);
          }
          if (Math.random() < 0.7) {
            embers.push({
              x: h.x + (Math.random()-0.5)*h.r*1.3, y: gl - 10,
              vx: (Math.random()-0.5)*24, vy: -150 - Math.random()*90,
              life: 0.4 + Math.random()*0.3, maxLife: 0.7, size: 1.6 + Math.random()*2
            });
          }
        }
      }
    });
    compact(bossHazards, h => h.t > 0);
  }

  function updateBossIdleLife(dt){
    const gl = groundLevel();
    // parpadeo
    boss.blinkT -= dt;
    if (boss.blinkT <= 0) { boss.blink = 0.13; boss.blinkT = 2.4 + Math.random()*3.6; }
    if (boss.blink > 0) boss.blink -= dt;

    // tic nervioso: un espasmo corto cada pocos segundos
    boss.twitchT -= dt;
    if (boss.twitchT <= 0) { boss.twitch = 0.22; boss.twitchT = 2.2 + Math.random()*3.4; }
    if (boss.twitch > 0) boss.twitch = Math.max(0, boss.twitch - dt);

    // humo del tanque de ácido
    boss.smokeT -= dt;
    if (boss.smokeT <= 0) {
      boss.smokeT = boss.wp.tank.broken ? 0.12 : 0.3;
      const tx = boss.x - boss.dir*100, ty = gl - (boss.phase >= 3 ? 120 : 226);
      if (boss.phase < 3) {
        embers.push({
          x: tx + (Math.random()-0.5)*22, y: ty,
          vx: (Math.random()-0.5)*14 + boss.dir*-6, vy: -22 - Math.random()*18,
          life: 1.1 + Math.random()*0.7, maxLife: 1.8, size: 2.2 + Math.random()*2.4
        });
        if (boss.wp.tank.broken) spawnParticles(tx, ty + 40, '#8ad13a', 1, 22);
      }
    }

    // criatura: babeo y vaho al respirar
    if (boss.phase >= 3 && Math.random() < 0.10) {
      const m = bossMouth();
      spawnParticles(m.x, m.y + 6, Math.random() < 0.6 ? '#7a1414' : '#3d5228', 1, 18);
    }

    // chispas por las grietas del blindaje
    boss.sparkT -= dt;
    if (boss.sparkT <= 0 && boss.phase < 3) {
      boss.sparkT = 0.35 + Math.random()*0.7;
      const sx = boss.x + (Math.random()-0.5)*180;
      const sy = gl - 60 - Math.random()*140;
      spawnParticles(sx, sy, '#ffd35a', 1, 45);
    }

    // gruñido de fondo
    boss.groanT -= dt;
    if (boss.groanT <= 0) {
      boss.groanT = boss.phase >= 3 ? (1.8 + Math.random()*2) : (3.2 + Math.random()*3);
      playBossBreathSound();
    }
  }

  function updateBoss(dt){
    if (bossShakeT > 0) { bossShakeT -= dt; if (bossShakeT <= 0) bossShakeAmp = 0; }
    if (bossNameT > 0) bossNameT -= dt;
    updateBossHazards(dt);
    if (!boss) return;
    updateBossProjectiles(dt);

    boss.bob += dt*(boss.phase >= 3 ? 2.6 : 1.7);
    if (boss.flash > 0) boss.flash -= dt;
    if (boss.stagger > 0) boss.stagger -= dt;
    if (boss.attackLock > 0) boss.attackLock -= dt;
    for (const k in boss.wp) if (boss.wp[k].flash > 0) boss.wp[k].flash -= dt;
    if (boss.state !== 'entering') updateBossIdleLife(dt);

    if (boss.dead) return;

    // contacto: si te le pegas demasiado, te aparta de un manotazo
    if (boss.state !== 'entering' && boss.state !== 'break2') {
      const cr = boss.phase >= 3 ? 110 : BOSS_STOMP_R;
      if (Math.abs(player.x - boss.x) < cr) {
        boss.contactT -= dt;
        if (boss.contactT <= 0 && boss.swatT <= 0) {
          boss.contactT = 0.9;
          boss.swatT = BOSS_SWAT_TIME;
          boss.swatDone = false;
          bossShake(0.18, 4);
          playBossShoveRoar();
        }
      } else {
        boss.contactT = 0.35;
      }

      // el impacto cae en el pico del barrido
      if (boss.swatT > 0) {
        boss.swatT = Math.max(0, boss.swatT - dt);
        const p = 1 - boss.swatT/BOSS_SWAT_TIME;
        if (!boss.swatDone && p >= 0.46) {
          boss.swatDone = true;
          if (Math.abs(player.x - boss.x) < cr + 24) {
            bossShake(0.35, 9);
            playBossSwatImpact();
            spawnParticles(player.x, groundLevel() - player.h*0.5, '#ff2d4e', 10, 130);
            spawnChunks(player.x, groundLevel() - player.h*0.5, '#8d968a', 4, 150);
            applyKnockback(player.x >= boss.x ? 1 : -1, 170);
            damagePlayer(boss.phase >= 3 ? 14 : 10);
          }
        }
      }
    }

    switch (boss.state) {
      case 'entering':
        boss.stateT -= dt;
        boss.entryP = bclamp(1 - boss.stateT/1.15, 0, 1);
        if (boss.stateT <= 0) bossLanded();
        break;
      case 'idle':    updateBossIdle(dt); break;
      case 'walk':    updateBossWalk(dt); break;
      case 'mortar':  updateBossMortar(dt); break;
      case 'sweep':   updateBossSweep(dt); break;
      case 'columns': updateBossColumns(dt); break;
      case 'breath':  updateBossBreath(dt); break;
      case 'punch':   updateBossPunch(dt); break;
      case 'break1':  updateBossBreak1(dt); break;
      case 'break2':  updateBossBreak2(dt); break;
      case 'dying':
        boss.dyingT -= dt;
        if (Math.random() < 0.4) {
          const ex = boss.x + (Math.random()-0.5)*140;
          const ey = groundLevel() - Math.random()*190;
          spawnParticles(ex, ey, '#ff9a2a', 8, 190);
          spawnChunks(ex, ey, '#5f7a3f', 4, 170);
        }
        if (boss.dyingT <= 0) bossDefeated();
        break;
    }
  }

  function killBoss(){
    boss.state = 'dying';
    boss.dyingT = 2.2;
    bossProjectiles.length = 0;
    bossShake(2.0, 20);
    playExplosionSound();
    playBossRoar();
    stopBossMusic();
    spawnParticles(boss.x, groundLevel() - 100, '#ff9a2a', 34, 280);
    spawnChunks(boss.x, groundLevel() - 100, '#5f7a3f', 20, 260);
    updateBossHUD();
  }

  function bossDefeated(){
    boss.dead = true;
    bossHazards.length = 0;
    score += 3000;
    coins += 200;
    scoreVal.textContent = score;
    coinVal.textContent = coins;
    const upgrade = grantRandomUpgrade();
    shopNote = upgrade
      ? `EL ABOMINABLE HA CAÍDO — +200¢ y mejora gratis: ${upgrade}`
      : 'EL ABOMINABLE HA CAÍDO — +200¢';
    waveTimer = 16;
    spawnTimer = 4;
    hideBossHUD();
    boss = null;
    if (typeof showDemoComplete === 'function') showDemoComplete();
    else openShop();   // red de seguridad si game.js no cargó por algún motivo
  }

  // --------------------------------------------------------------- HUD ------
  function showBossHUD(){ if (typeof bossBar !== 'undefined' && bossBar) bossBar.classList.remove('hidden'); }
  function hideBossHUD(){ if (typeof bossBar !== 'undefined' && bossBar) bossBar.classList.add('hidden'); }

  function updateBossHUD(){
    if (typeof bossSegFills === 'undefined' || !bossSegFills[0] || !boss) return;
    const wpTotal = BOSS_WP_MAX.helmet + BOSS_WP_MAX.tank + BOSS_WP_MAX.core;
    const wpNow = Math.max(0, boss.wp.helmet.hp) + Math.max(0, boss.wp.tank.hp) + Math.max(0, boss.wp.core.hp);
    // el segmento 3 (derecha) es la fase 1, el 2 el blindaje y el 1 la criatura
    const segs = [
      boss.phase >= 3 ? boss.fleshHp/boss.fleshMax : 1,
      boss.phase >= 3 ? 0 : (boss.phase === 2 ? boss.armorHp/boss.armorMax : 1),
      boss.phase >= 2 ? 0 : wpNow/wpTotal
    ];
    const activeIdx = 3 - Math.min(3, boss.phase);
    for (let i=0;i<3;i++){
      if (!bossSegFills[i]) continue;
      bossSegFills[i].style.width = (bclamp(segs[i], 0, 1)*100) + '%';
      if (bossSegs[i]) bossSegs[i].classList.toggle('active', i === activeIdx);
    }
  }

  // =============================== SPRITES =================================
  //  Cada pieza va por separado (cabeza, torso, brazos, piernas, tanque) para
  //  animarlas de forma independiente. El blindado está DE PERFIL mirando a +x.
  //  Regla de dibujo: contorno negro en toda la silueta, luz arriba/adelante y
  //  sombra abajo/atrás, y bordes irregulares para que no parezca geometría.
  const BOSS_PALETTE = {
    K:'#070806', D:'#111309', t:'#1a1d16',
    G:'#242a25', g:'#3a423b', M:'#5c655a', m:'#828b78', N:'#adb59d',
    R:'#4a2418', r:'#7d3f22', C:'#5e5e56',
    S:'#4a6330', s:'#2c3d1c', L:'#7d9c4c', l:'#a4c266',
    A:'#8ad13a', a:'#4c7a1f',
    E:'#ff2a1a', e:'#a01208',
    F:'#ff9a2a', f:'#ffd35a',
    W:'#c9c3ad', w:'#8b8570', V:'#eae3c8',
    B:'#3a2a1a', b:'#241a10',
    x:'#3d0c0c', X:'#7a1414',
    P:'#5c3f4a', p:'#33222a'
  };

  const BOSS_PALETTE_HIT = (() => {
    const p = {};
    for (const k in BOSS_PALETTE) p[k] = '#ff5a3c';
    p.K = '#6e1810'; p.D = '#6e1810';
    return p;
  })();

  function bossDarkenPalette(f, fb){
    const p = {};
    for (const k in BOSS_PALETTE) {
      const c = BOSS_PALETTE[k];
      const r = Math.round(parseInt(c.slice(1,3),16)*f);
      const g = Math.round(parseInt(c.slice(3,5),16)*f);
      const b = Math.round(parseInt(c.slice(5,7),16)*fb);
      p[k] = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    }
    return p;
  }

  // piezas lejanas (brazo y pierna del fondo) en penumbra: da profundidad
  const BOSS_PALETTE_FAR = (() => {
    const p = {};
    for (const k in BOSS_PALETTE) {
      const c = BOSS_PALETTE[k];
      const r = Math.round(parseInt(c.slice(1,3),16)*0.52);
      const g = Math.round(parseInt(c.slice(3,5),16)*0.52);
      const b = Math.round(parseInt(c.slice(5,7),16)*0.55);
      p[k] = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    }
    return p;
  })();

  // el brazo de ácido va detrás del cuerpo pero tiene que verse: penumbra suave
  const BOSS_PALETTE_DIM = bossDarkenPalette(0.74, 0.76);

  // ---- casco de perfil (16x12) ----
  const BOSS_HEAD_HELMET = [
    "......KKKK......",
    "....KKGggGKK....",
    "..KKGgmmmmgGK...",
    ".KGgmmMMMMmmgGK.",
    ".KGmMMMMMMMMMgK.",
    "KGgMMMGKKKKKMgK.",
    "KGMMMMGKEEEKMgK.",
    "KGMMMMGKKKKKMggK",
    "KGgMMMMMMWVWMgK.",
    ".KGgMMMMWVWVWgK.",
    "..KKGgMMWwWwWgK.",
    "....KKGgMWwWgK.."
  ];

  // ---- cabeza al reventar el casco (16x12) ----
  const BOSS_HEAD_EXPOSED = [
    "......KKKK......",
    "....KKAaAAKK....",
    "..KKAaAAAaAGK...",
    ".KGsLSSSSSaAgK..",
    ".KsSSLSSSSSSsK..",
    "KsSSSSKKKKSSsK..",
    "KsSSSSKEEKSSssK.",
    "KsSSSSKKKKSSssK.",
    "KsSSSSSSxWVWSsK.",
    ".KsSSSSSWVWVWsK.",
    "..KKsSSSWwWwWsK.",
    "....KKssSWwWsK.."
  ];

  // ---- torso de perfil, encorvado (24x16). Núcleo en columnas 15-18 ----
  const BOSS_CHEST = [
    "....KKKKKKKK............",
    "..KKGggmmmggGKK.........",
    ".KGgmmMMMMMMmmgGKK......",
    "KGgmMMMMMMMMMMMmmgGK....",
    "KGMMMMMMNMMMMMMMMMgGK...",
    "KGMMMMGtGMMMMMMMMMMgGK..",
    "KGMMMMGGGMMMMMMGGgEEgGK.",
    "KGgMMMMMMMMMMMMGgEffEgGK",
    "KGgMMMMMMMMMMMMGgEffEgGK",
    ".KGMMMNMMMMMMMMMGgEEgGK.",
    ".KGgMMMMMMMMMMMMMGGgGKK.",
    "..KGgMMMCCCCCCMMMMMgGK..",
    "..KGgMMsSSSSSSsMMMgGK...",
    "...KGgMsSSXSSXsMMgGK....",
    "....KGgMsSSSSsMMgGK.....",
    ".....KKGggMMMggGKK......"
  ];

  const BOSS_CORE_BROKEN_OVERLAY = [
    [6,18,'e'],[6,19,'K'],
    [7,17,'K'],[7,18,'e'],[7,19,'K'],[7,20,'K'],
    [8,17,'K'],[8,18,'K'],[8,19,'e'],[8,20,'K'],
    [9,18,'K'],[9,19,'K']
  ];

  const BOSS_ARMOR_DMG_OVERLAY = [
    [2,7,'t'],[2,8,'.'],[3,7,'x'],[3,8,'s'],[4,8,'S'],[4,9,'s'],
    [5,4,'.'],[5,5,'t'],[6,4,'x'],[6,5,'s'],
    [8,10,'s'],[8,11,'S'],[9,10,'x'],[9,11,'s'],[10,10,'.'],
    [3,13,'t'],[4,14,'x'],[5,13,'.'],
    [10,15,'s'],[11,14,'X'],[12,18,'x'],[13,17,'X'],
    [1,9,'.'],[1,10,'t'],[2,11,'x'],
    [14,9,'s'],[14,10,'S'],[15,11,'.']
  ];

  function bossTorsoRows(coreBroken, damaged){
    let rows = BOSS_CHEST;
    if (coreBroken) rows = applyOverlay(rows, BOSS_CORE_BROKEN_OVERLAY);
    if (damaged) rows = applyOverlay(rows, BOSS_ARMOR_DMG_OVERLAY);
    return rows;
  }

  // ---- brazo blindado con puño enorme (16x18), pivote hombro (8,1) ----
  const BOSS_ARM_FRONT = [
    "...KKKKKKKK.....",
    "..KGgmmmmmgGK...",
    ".KGgmMMMMMMmgGK.",
    "KGgmMMMNMMMMMmgK",
    "KGMMMMMMMMMMMMgK",
    "KGgMMMMMMMMMMgGK",
    "..KGMMMMMMMMgK..",
    "..KGgMMMMMMgK...",
    "...KGMMMMMMgK...",
    "...KGgMMMMMgK...",
    "..KGmMMMMMMMgK..",
    ".KGgmMMMNMMMMMgK",
    "KGgmMMMMMMMMMMgK",
    "KGmMMMMMMMMMMMgK",
    "KGMMNMMMMMMNMMgK",
    "KGMMMMMMMMMMMMgK",
    ".KGgMMMMMMMMMgGK",
    "..KKGgggggggGGK."
  ];

  // ---- brazo mutado trasero (12x18), pivote hombro (6,1) ----
  const BOSS_ARM_BACK = [
    "..KKsSSsKK..",
    ".KsSLlLSSsK.",
    "KsSLlLSSSSsK",
    "KsSLSSSSSSsK",
    "KsSaAASSSSsK",
    ".KsSAaSSSsK.",
    ".KsSSSSSSsK.",
    "..KsSSSSsK..",
    "..KsSSSSsK..",
    "..KsSSSSsK..",
    "...KsSSsK...",
    "..KsSSSSsK..",
    ".KsSSSSSSsK.",
    ".KsSSsSSSsK.",
    "KsSSsKsSSSsK",
    "KWVsK.KsSSsK",
    ".KWw...KsWVK",
    "........KWwK"
  ];

  // ---- una pierna de perfil (12x12); se dibuja dos veces (cerca/lejos) ----
  const BOSS_LEG = [
    "..KKGgggGK..",
    ".KGgmMMMmgK.",
    "KGgmMMMMMmgK",
    "KGmMMMMMMMgK",
    "KGMMMMMMMMgK",
    ".KGMMMMMMgK.",
    ".KGgMMMMgGK.",
    "..KGMMMMgK..",
    "..KGgMMMgK..",
    ".KGgMMMMMgK.",
    "KGgMMMMMMMmg",
    "KKGgggggggGG"
  ];

  // ---- tanque de ácido de la espalda (10x13) ----
  const BOSS_TANK = [
    "..KKGggGK.",
    ".KGgAAAgGK",
    "KGgAlAAAgK",
    "KGaAlAAAaK",
    "KGaAAAAAaK",
    "KGaANAAAaK",
    "KGaAAAAAaK",
    "KGaAaaaAaK",
    "KGaAAaAAaK",
    "KGaaAAAaaK",
    "KGgaaaaagK",
    ".KGgggggGK",
    "..KKGGGKK."
  ];

  const BOSS_TANK_BROKEN = [
    "..KKGggGK.",
    ".KGgDDDgGK",
    "KGgDaDDDgK",
    "KGaDDKKDaK",
    "KGaDKKKKaK",
    "KGaDKKKtaK",
    "KGaDaKtDaK",
    "KGaDaatDaK",
    "KGaADaaDaK",
    "KGaaAaAaaK",
    "KGgaaaaagK",
    ".KGgggggGK",
    "..KKGGGKK."
  ];

  const BOSS_BANNER = [
    "bDDDDDD.",
    "bDDDDDD.",
    "bDDWWDD.",
    "bDWWWWD.",
    "bDWKWKD.",
    "bDWWWWD.",
    "bDDWWDD.",
    "bDWDDWD.",
    "bDDDDDD.",
    "bDDDDD..",
    "bDDDD...",
    "b.......",
    "b.......",
    "b......."
  ];

  // ================== FASE 3: LA COSA DE DENTRO =========================
  //  Descarnada y encorvada, piel oscura tirante sobre el hueso, cuencas
  //  vacías con dos brasas dentro, mandíbula desencajada hasta el pecho y
  //  un brazo monstruoso que arrastra por el suelo: ese es el que golpea.

  // ---- cráneo alargado (16x12) ----
  const CREATURE_HEAD = [
    ".....KKKKKK.....",
    "...KKsSSSSsKK...",
    "..KsSLlLSSSSsK..",
    ".KsSLSSSSSSSSsK.",
    "KsSSKKKsSKKKSsK.",
    "KsSSKEKsSKEKSsK.",
    "KsSSKKKsSKKKSsK.",
    "KsSSSSSSSSSSSsK.",
    ".KsSSSSVWVWVWsK.",
    ".KsSSxSWwWwWwsK.",
    "..KsSSSVWVWVWsK.",
    "...KKssSwWwWwsK."
  ];

  // ---- torso encorvado con costillar y espinazo (20x16) ----
  const CREATURE_BODY = [
    "....KKKsSSsKK.......",
    "..KKsSLlLSSSsKK.....",
    ".KpsSLSSSSSSSSsK....",
    "KpsSSSSSSSSSSSSsK...",
    "KpsSVSSSSVSSSSSSsK..",
    "KpsSVwsSSVwsSSSSsK..",
    "KpsSVwsSSVwsSSSSSsK.",
    "KpsSVwsSSVwsSSSSSsK.",
    "KpsSSVSSSSVSSSSSSsK.",
    ".KpsSSSSSSSSSSSSSsK.",
    ".KpsSSxXxSSSSSSSsK..",
    "..KpsSXXXSSSSSSsK...",
    "..KpsSSSSSSSSSsK....",
    "...KpsSSSSSSSsK.....",
    "....KpsSSSSSsK......",
    ".....KKpssSSsK......"
  ];

  // ---- brazo GRANDE, el que machaca (16x22), pivote hombro (8,1) ----
  const CREATURE_ARM_BIG = [
    "..KKsSSSSSsKK...",
    ".KsSLlLSSSSSsK..",
    "KsSLlLSSSSSSSsK.",
    "KsSLSSSSSSSSSSsK",
    "KsSSSSSSSSSSSSsK",
    "KsSSSSSSSSSSSsK.",
    ".KsSSSSSSSSSsK..",
    "..KsSSSSSSSsK...",
    "..KsSSSSSSsK....",
    "..KsSSSSSSsK....",
    ".KsSSSSSSSSsK...",
    "KsSSSSSSSSSSsK..",
    "KsSSSxXxSSSSSsK.",
    "KsSSSXXXSSSSSSsK",
    "KsSSSSSSSSSSSSsK",
    "KsSSSSSSSSSSSSsK",
    ".KsSSsSSSsSSSsK.",
    ".KsSsKsSSsKsSSsK",
    "KWVsK.KsSsK.KsSs",
    "KWw....KWVK..KWV",
    ".K......KWw...KW",
    "..............K."
  ];

  // ---- brazo atrofiado (8x16), pivote hombro (4,1) ----
  const CREATURE_ARM_SMALL = [
    ".KsSSsK.",
    "KsSLSSsK",
    "KsSSSSsK",
    ".KsSSsK.",
    ".KsSSsK.",
    "..KsSsK.",
    "..KsSsK.",
    "..KsSsK.",
    "..KsSSsK",
    "..KsSSsK",
    "...KsSsK",
    "...KsSsK",
    "..KsSsK.",
    ".KWVsK..",
    ".KWwK...",
    "..K....."
  ];

  // ---- pata digitígrada (10x10) ----
  const CREATURE_LEG = [
    "..KKsSSsK.",
    ".KsSLlLSsK",
    "KsSLSSSSsK",
    "KsSSSSSSsK",
    ".KsSSSSsK.",
    "..KsSSsK..",
    "..KsSSsK..",
    ".KsSSSsK..",
    "KsSWVSsK..",
    "KWVWWsK..."
  ];

  // ============== EFECTOS PIXELADOS (fuego y ácido) ==============
  //  Nada de arc(), degradados ni shadowBlur: todo se compone con bloques
  //  del tamaño de un píxel del juego, con ruido temporal, para que arda y
  //  chorree de verdad en vez de parecer una figura geométrica.
  const FIRE_Q = 5;

  const FIRE_RAMP = ['#fff3c4', '#ffd35a', '#ff9a2a', '#ff5a12', '#c22a06', '#7a1600'];
  const ACID_RAMP = ['#f4ffb4', '#d8f24a', '#8ad13a', '#5e9b22', '#3a6b12', '#1e3c08'];

  function rampColor(ramp, v){
    const i = Math.min(ramp.length - 1, Math.max(0, Math.floor(v*ramp.length)));
    return ramp[i];
  }

  function fsnap(v){ return Math.round(v/FIRE_Q)*FIRE_Q; }

  //  Masa de bloques con el borde deformado. dripDir = -1 saca lenguas de
  //  fuego hacia arriba; +1 deja goterones cayendo (ácido).
  function drawPixelBlob(x, y, r, seed, t, ramp, dripDir){
    const q = FIRE_Q;
    const ox = fsnap(x), oy = fsnap(y);
    const R = Math.ceil(r/q) + 1;
    for (let gy=-R; gy<=R; gy++){
      for (let gx=-R; gx<=R; gx++){
        const dx = gx*q, dy = gy*q;
        const ang = Math.atan2(dy, dx);
        const wob = 1 + 0.20*Math.sin(ang*3 + t*11 + seed) + 0.13*Math.sin(ang*5 - t*8 + seed*2.3);
        const d = Math.hypot(dx, dy*1.12) / (r*wob);
        if (d > 1) continue;
        ctx.fillStyle = rampColor(ramp, d*0.95 + 0.05*Math.sin(t*15 + gx + gy));
        ctx.fillRect(ox + dx, oy + dy, q, q);
      }
    }
    const dir = dripDir || -1;
    for (let i=0;i<3;i++){
      const a = (dir < 0 ? -Math.PI/2 : Math.PI/2) + (i-1)*0.45 + Math.sin(t*6 + seed + i)*0.25;
      const len = r*(0.85 + 0.55*Math.sin(t*13 + i*2 + seed));
      for (let d=r*0.55; d<len; d+=q){
        ctx.fillStyle = rampColor(ramp, 0.3 + 0.7*(d/len));
        ctx.fillRect(fsnap(x + Math.cos(a)*d), fsnap(y + Math.sin(a)*d), q, q);
      }
    }
  }

  function drawFireBlob(x, y, r, seed, t){ drawPixelBlob(x, y, r, seed, t, FIRE_RAMP, -1); }

  // columna vertical: mechas independientes que ondean
  function drawFireColumn(x, gl, h, r, seed, t){
    const q = FIRE_Q;
    for (let i=-r; i<=r; i+=q){
      const f = 1 - Math.abs(i)/r;
      const flick = 0.72 + 0.38*Math.sin(t*12 + i*0.33 + seed);
      const hh = h*Math.pow(Math.max(f,0), 0.6)*flick;
      if (hh < q) continue;
      for (let y=0; y<hh; y+=q){
        const v = y/hh;
        const wob = Math.sin(t*9 + y*0.08 + i*0.25 + seed)*q*v*1.5;
        ctx.fillStyle = rampColor(FIRE_RAMP, Math.min(1, v*1.05 + 0.12*Math.sin(t*17 + y + i)));
        ctx.fillRect(fsnap(x + i + wob), fsnap(gl - y - q), q, q);
      }
    }
    ctx.fillStyle = FIRE_RAMP[0];
    for (let i=-r*0.62; i<=r*0.62; i+=q){
      ctx.fillRect(fsnap(x + i), fsnap(gl - q*2), q, q*2);
    }
  }

  //  Chorro del vómito: NO es un cono recto (eso dejaba un corte plano al
  //  final, como una pared). Se dibuja siguiendo la misma parábola que las
  //  gotas —misma gravedad y velocidad—, adelgazando con la distancia y
  //  deshaciéndose en salpicaduras sueltas al final, así el chorro y las
  //  gotas son la misma masa y no hay borde duro en ninguna parte.
  const JET_G = 700, JET_VX = 340, JET_VY = -120, JET_T = 0.62;

  function jetNoise(a, b, frame){
    const v = Math.sin(a*12.9898 + b*78.233 + frame*0.734) * 43758.5453;
    return v - Math.floor(v);
  }

  function drawAcidStream(ox, oy, dir, t, ramp){
    const q = FIRE_Q;
    const steps = 30;
    const frame = Math.floor(t*16);
    // pulso que viaja por el chorro: se nota que lo está expulsando a golpes
    for (let i=0;i<steps;i++){
      const s0 = i/steps;
      const ft = s0*JET_T;
      const x = ox + dir*JET_VX*ft;
      const y = oy + JET_VY*ft + 0.5*JET_G*ft*ft;
      const pulse = 0.78 + 0.34*Math.sin(t*16 - s0*7);
      const half = 26*Math.pow(1 - s0, 0.55)*pulse;
      if (half < q*0.5) continue;
      const dens = s0 < 0.6 ? 1 : Math.max(0, 1 - (s0 - 0.6)/0.42);
      for (let o=-half; o<=half; o+=q){
        const edge = Math.abs(o)/half;
        if (dens < 1 && jetNoise(i, o, frame) > dens*(1.15 - edge*0.5)) continue;
        const wob = Math.sin(t*12 + i*0.5 + o*0.25)*q*0.7*s0;
        ctx.fillStyle = rampColor(ramp, Math.min(0.98, Math.max(edge*0.9, s0*0.5) + 0.1*Math.sin(t*22 + i + o)));
        ctx.fillRect(fsnap(x), fsnap(y + o + wob), q, q);
      }
    }
    // salpicaduras sueltas más allá de la punta: el chorro no termina, se rompe
    for (let i=0;i<7;i++){
      const s0 = 1 + i*0.055;
      const ft = s0*JET_T;
      const n = jetNoise(i, 3, frame);
      if (n > 0.72) continue;
      const x = ox + dir*JET_VX*ft + dir*(n-0.5)*26;
      const y = oy + JET_VY*ft + 0.5*JET_G*ft*ft + (n-0.5)*34;
      const sz = q*(n > 0.45 ? 2 : 1);
      ctx.fillStyle = rampColor(ramp, 0.25 + n*0.5);
      ctx.fillRect(fsnap(x), fsnap(y), sz, sz);
    }
  }

  // charco pegado al suelo, con burbujas que revientan
  function drawPixelPool(x, gl, r, fade, seed, t, ramp){
    const q = FIRE_Q;
    for (let i=-r; i<=r; i+=q){
      const f = 1 - Math.abs(i)/r;
      const hgt = q*Math.max(1, Math.round((1 + 2.2*Math.pow(Math.max(f,0), 0.7)*(0.75 + 0.35*Math.sin(t*4 + i*0.4 + seed)))*fade));
      for (let k=0;k<hgt;k+=q){
        const v = k/Math.max(q, hgt);
        ctx.fillStyle = rampColor(ramp, 0.75 - v*0.5);
        ctx.fillRect(fsnap(x + i), fsnap(gl - q - k), q, q);
      }
    }
    for (let i=0;i<4;i++){
      const ph = t*3 + i*2.1 + seed;
      const bs = (Math.sin(ph) + 1)*0.5;
      if (bs < 0.45) continue;
      const bx = x + Math.sin(i*2.7 + seed)*r*0.6;
      const sz = q*(bs > 0.8 ? 2 : 1);
      ctx.fillStyle = rampColor(ramp, 0.1);
      ctx.fillRect(fsnap(bx), fsnap(gl - q*2 - bs*10), sz, sz);
    }
  }

  // =============================== RENDER ==================================
  const BOSS_LEGS_H = () => BOSS_LEG.length*BOSS_PX;
  const BOSS_TORSO_H = () => BOSS_CHEST.length*BOSS_PX;

  // avisos pintados sobre el asfalto, por debajo de todo lo demás
  function drawBossGround(){
    if (!bossHazards.length) return;
    const gl = groundLevel();
    bossHazards.forEach(h => {
      if (h.x < camX - 140 || h.x > camX + W + 140) return;

      if (h.kind === 'acidpool') {
        const fade = Math.min(1, h.t/0.4);
        drawPixelPool(h.x, gl, h.r, fade, h.x*0.03, performance.now()*0.001, ACID_RAMP);

      } else if (h.kind === 'mark') {
        const p = 1 - h.t/h.max;
        ctx.save();
        ctx.globalAlpha = 0.30 + 0.55*p;
        ctx.strokeStyle = h.acid ? '#8ad13a' : '#ff6b2a';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(h.x, gl - 2, h.r, h.r*0.30, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.globalAlpha = 0.16 + 0.32*p;
        ctx.fillStyle = h.acid ? '#8ad13a' : '#ff6b2a';
        ctx.beginPath();
        ctx.ellipse(h.x, gl - 2, h.r*p, h.r*0.30*p, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

      } else if (h.kind === 'column' && !h.fired) {
        const p = 1 - h.t/h.max;
        const pulse = 0.45 + 0.55*Math.abs(Math.sin(performance.now()*0.016));
        ctx.save();
        ctx.globalAlpha = (0.25 + 0.5*p)*pulse;
        ctx.fillStyle = '#ffb020';
        ctx.beginPath();
        ctx.ellipse(h.x, gl - 2, h.r, h.r*0.32, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 0.5 + 0.4*p;
        ctx.strokeStyle = '#ff6b2a';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(h.x, gl - 2, h.r, h.r*0.32, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();

      } else if (h.kind === 'punchmark') {
        const p = 1 - h.t/h.max;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.5*p;
        ctx.strokeStyle = '#ff2d4e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(h.x, gl - 2, h.r, h.r*0.34, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(h.x, gl - 2, h.r*(1-p), h.r*0.34*(1-p), 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();

      } else if (h.kind === 'flame') {
        const a = h.t/h.max;
        // franja ancha, no círculo — mismo bitmap que el resto de glows,
        // solo estirado distinto; drawImage no cobra más por eso
        const bmp = getGlowBitmap('bossFlame', '255,120,50');
        ctx.save();
        ctx.globalAlpha = a*0.75;
        ctx.drawImage(bmp.canvas, h.x - h.r, gl - 52, h.r*2, 60);
        ctx.restore();
      }
    });
  }

  function flipDir(flip){ return flip ? -1 : 1; }

  // dibuja una pieza usando un pivote (columna/fila del grid) como origen:
  // permite rotar brazos y cabeza alrededor del hombro / cuello
  function drawPivotCached(key, rowsFn, palette, px, flip, pivotCol, pivotRow){
    const bmp = getSpriteBitmap(key, rowsFn, palette);
    const w = bmp.cols*px, h = bmp.rows*px;
    const ox = -pivotCol*px, oy = -pivotRow*px;
    if (flip) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(bmp.canvas, ox, oy, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(bmp.canvas, ox, oy, w, h);
    }
  }

  //  Manotazo de apartar: recoge el brazo, lo barre hacia adelante y vuelve.
  //  El golpe (daño + empujón) se resuelve en el pico del barrido, no al
  //  entrar en el radio, así el jugador ve venir el manotazo.
  function bossSwatAngle(){
    if (!boss || boss.swatT <= 0) return 0;
    const p = 1 - boss.swatT/BOSS_SWAT_TIME;
    if (p < 0.28) return -0.35*(p/0.28);
    if (p < 0.5)  return -0.35 + 1.35*((p - 0.28)/0.22);
    return 1.0*(1 - (p - 0.5)/0.5);
  }

  function bossTwitch(){
    return boss.twitch > 0 ? Math.sin(boss.twitch*90)*boss.twitch*0.9 : 0;
  }

  // ---- jefe blindado de perfil (fases 1 y 2), animado pieza a pieza ----
  function drawBossArmored(px, flip, breatheIgn, shatter){
    const d = flipDir(flip);
    const rot = flip ? -1 : 1;
    const br = Math.sin(boss.bob*2);          // respiración
    const br2 = Math.sin(boss.bob*2 - 0.7);   // desfasada, para los brazos
    const tw = bossTwitch();
    const jitter = shatter ? (Math.random()-0.5)*5 : 0;
    const coreBroken = boss.wp.core.broken;
    const damaged = boss.phase >= 2;
    const torsoKey = `boss_torso_${coreBroken?1:0}_${damaged?1:0}`;
    const rowsFn = () => bossTorsoRows(coreBroken, damaged);

    // estandarte al fondo
    ctx.save();
    ctx.translate(-d*132, -206 + Math.sin(boss.bob*1.3)*3);
    ctx.rotate(rot*Math.sin(boss.bob*0.9)*0.03);
    drawSpriteCached('boss_banner', () => BOSS_BANNER, BOSS_PALETTE, px*0.95, flip);
    ctx.restore();

    // tanque de ácido a la espalda
    ctx.save();
    ctx.translate(-d*100 + jitter*0.6, -145 + br*1.6);
    ctx.rotate(rot*br*0.014);
    if (boss.wp.tank.broken) drawSpriteCached('boss_tank_b', () => BOSS_TANK_BROKEN, BOSS_PALETTE, px*0.95, flip);
    else                     drawSpriteCached('boss_tank', () => BOSS_TANK, BOSS_PALETTE, px*0.95, flip);
    ctx.restore();

    // pierna del fondo (en penumbra) y pierna cercana
    ctx.save();
    ctx.translate(-d*30, 0);
    drawSpriteCached('boss_leg_far', () => BOSS_LEG, BOSS_PALETTE_FAR, px, flip);
    ctx.restore();
    ctx.save();
    ctx.translate(d*22, 0);
    drawSpriteCached('boss_leg_near', () => BOSS_LEG, BOSS_PALETTE, px, flip);
    ctx.restore();

    // brazo pequeño mutado (el que chorrea ácido): nace junto al núcleo y se
    // dibuja POR DEBAJO del cuerpo, así sólo asoma el antebrazo y la garra
    ctx.save();
    ctx.translate(d*28 + jitter, -150 + br*2);
    ctx.rotate(rot*(0.08 - br2*0.09 + tw*0.4));
    drawPivotCached('boss_arm_back', () => BOSS_ARM_BACK, BOSS_PALETTE_DIM, px, flip, 6, 1);
    ctx.restore();

    // torso: sube y baja al respirar y se hincha un pelín
    ctx.save();
    ctx.translate(-d*26 + jitter + d*Math.max(0, bossSwatAngle())*7, -68 + br*2.4);
    ctx.scale(1, 1 + br*0.014);
    drawSpriteCached(torsoKey, rowsFn, BOSS_PALETTE, px, flip);
    if (boss.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.9, boss.flash*6);
      drawSpriteCached(torsoKey + '_hit', rowsFn, BOSS_PALETTE_HIT, px, flip);
      ctx.restore();
    }
    ctx.restore();

    // brazo grande blindado: cuelga sobre el cuerpo, en el hueco que queda
    // entre el núcleo y el tanque de ácido. Se dibuja ENCIMA del torso pero
    // por debajo del tanque, y su borde delantero deja el núcleo despejado.
    ctx.save();
    ctx.translate(-d*60 + jitter, -150 + br*2.2);
    ctx.rotate(rot*(-0.04 + br2*0.055 - boss.telegraph*0.3 + tw*0.3 - bossSwatAngle()));
    drawPivotCached('boss_arm_front', () => BOSS_ARM_FRONT, BOSS_PALETTE, px, flip, 8, 1);
    if (boss.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.7, boss.flash*5);
      drawPivotCached('boss_arm_front_hit', () => BOSS_ARM_FRONT, BOSS_PALETTE_HIT, px, flip, 8, 1);
      ctx.restore();
    }
    ctx.restore();

    // cabeza: cabeceo lento + tic nervioso
    ctx.save();
    ctx.translate(-d*8 + jitter, -168 + br*2.8);
    ctx.rotate(rot*(br*0.022 + tw*0.5));
    if (boss.wp.helmet.broken) drawSpriteCached('boss_head_x', () => BOSS_HEAD_EXPOSED, BOSS_PALETTE, px, flip);
    else                       drawSpriteCached('boss_head_h', () => BOSS_HEAD_HELMET, BOSS_PALETTE, px, flip);
    if (boss.blink > 0) {
      ctx.fillStyle = '#090b09';
      ctx.fillRect(d*10 - 15, -42, 30, 9);
    }
    ctx.restore();

  }

  // ---- criatura de la fase 3 ----
  //  Encorvada, el brazo grande arrastra por el suelo y es el que golpea.
  function drawBossCreature(px, flip, breatheIgn, scale){
    const d = flipDir(flip);
    const rot = flip ? -1 : 1;
    const moving = boss.state === 'walk' || boss.state === 'breath';
    const br = Math.sin(boss.bob*2.2);
    const step = Math.sin(boss.walkPhase);
    const tw = bossTwitch();
    const heave = br*3.4 + (moving ? Math.abs(step)*2.2 : 0);

    // ángulo del brazo grande: reposo, carga del puñetazo y golpe
    let bigArm = -0.12 + br*0.06 + bossSwatAngle()*0.85;
    let armLunge = 0;
    if (boss.state === 'punch') {
      if (boss.stateStep === 0) {
        const p = boss.armAnim;                    // 0 -> 1 mientras lo levanta
        bigArm = -0.12 - 2.15*(p*p*(3 - 2*p));
      } else {
        const p = 1 - boss.armAnim;                // 0 -> 1 tras el impacto
        const slam = Math.min(1, p*4.5);
        bigArm = -2.27 + 2.72*slam;
        armLunge = (boss.punchX - boss.x)*0.42*slam;
        if (p > 0.55) bigArm = 0.45 - (p-0.55)/0.45*0.57;
      }
    }

    ctx.save();
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.rotate(rot*(0.06 + (boss.state === 'punch' && boss.stateStep === 0 ? -0.08*boss.armAnim : 0)));

    // brazo atrofiado, detrás
    ctx.save();
    ctx.translate(-d*36, -136 + heave*0.6);
    ctx.rotate(rot*(0.14 - Math.sin(boss.walkPhase + Math.PI)*(moving ? 0.22 : 0.05) + tw*0.5));
    drawPivotCached('cre_arm_small', () => CREATURE_ARM_SMALL, BOSS_PALETTE_FAR, px, flip, 4, 1);
    ctx.restore();

    ctx.save();
    ctx.translate(-d*20, 0);
    drawSpriteCached('cre_leg_far', () => CREATURE_LEG, BOSS_PALETTE_FAR, px, flip);
    ctx.restore();
    ctx.save();
    ctx.translate(d*14, -Math.max(0, Math.sin(boss.walkPhase))*(moving ? 9 : 0));
    drawSpriteCached('cre_leg_near', () => CREATURE_LEG, BOSS_PALETTE, px, flip);
    ctx.restore();

    // torso
    ctx.save();
    ctx.translate(-d*6, -52 + heave);
    ctx.scale(1, 1 + br*0.02);
    drawSpriteCached('cre_body', () => CREATURE_BODY, BOSS_PALETTE, px, flip);
    if (boss.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.9, boss.flash*6);
      drawSpriteCached('cre_body_hit', () => CREATURE_BODY, BOSS_PALETTE_HIT, px, flip);
      ctx.restore();
    }
    ctx.restore();

    // brazo GRANDE: el que machaca
    ctx.save();
    ctx.translate(d*24 + armLunge, -140 + heave*0.8);
    ctx.rotate(rot*(bigArm + (moving ? Math.sin(boss.walkPhase)*0.16 : 0)));
    drawPivotCached('cre_arm_big', () => CREATURE_ARM_BIG, BOSS_PALETTE, px, flip, 8, 1);
    if (boss.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.7, boss.flash*5);
      drawPivotCached('cre_arm_big_hit', () => CREATURE_ARM_BIG, BOSS_PALETTE_HIT, px, flip, 8, 1);
      ctx.restore();
    }
    ctx.restore();

    // cráneo: se dibuja EL ÚLTIMO, por encima del cuerpo y del brazo grande.
    // Al vomitar echa la cabeza atrás para cargar y luego se lanza adelante
    // sacudiéndose mientras escupe.
    let headRot = 0.22 + br*0.05 + tw;
    let headX = d*34, headY = -128 + heave*1.1;
    if (boss.state === 'breath') {
      if (boss.stateStep === 0) {
        const p = 1 - boss.telegraph;               // 0 -> 1 mientras carga
        headRot -= 0.45*p;
        headY   -= 12*p;
        headX   -= d*10*p;
      } else {
        headRot += 0.28 + Math.sin(performance.now()*0.045)*0.06;
        headX   += d*14;
        headY   += 7;
      }
    }
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(rot*headRot);
    drawSpriteCached('cre_head', () => CREATURE_HEAD, BOSS_PALETTE, px, flip);
    if (boss.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.85, boss.flash*6);
      drawSpriteCached('cre_head_hit', () => CREATURE_HEAD, BOSS_PALETTE_HIT, px, flip);
      ctx.restore();
    }
    if (boss.blink > 0) {
      ctx.fillStyle = '#090b09';
      ctx.fillRect(-d*4 - 20, -46, 40, 9);
    }
    ctx.restore();

    ctx.restore();
  }

  function drawBoss(){
    if (!boss) return;
    if (boss.x < camX - 400 || boss.x > camX + W + 400) return;

    const gl = groundLevel();
    const px = BOSS_PX;
    const flip = boss.dir < 0;
    const entryOff = boss.state === 'entering' ? -Math.pow(1 - boss.entryP, 2)*820 : 0;
    const breathe = Math.sin(boss.bob*2)*(boss.phase >= 3 ? 3 : 2.2);
    const staggerOff = boss.stagger > 0 ? (Math.random()-0.5)*6 : 0;

    // transición fase 2 -> 3: el blindaje tiembla y luego sale la criatura
    let shatter = 0, creatureScale = 1, showCreature = boss.phase >= 3;
    if (boss.state === 'break1') shatter = 1;
    if (boss.state === 'break2') {
      const p = 1 - boss.stateT/boss.transMax;
      shatter = 1;
      showCreature = boss.transStage >= 2;
      if (showCreature) creatureScale = bclamp(0.55 + (p - 0.62)/0.25, 0.55, 1);
    }

    ctx.save();
    ctx.translate(boss.x + staggerOff + shatter*(Math.random()-0.5)*7, gl + entryOff);
    if (boss.state === 'dying') {
      const t = 1 - boss.dyingT/2.2;
      ctx.globalAlpha = Math.max(0, 1 - t*0.85);
      ctx.translate(0, t*12);
    }

    if (showCreature) drawBossCreature(px, flip, breathe, creatureScale);
    else              drawBossArmored(px, flip, breathe, shatter);

    ctx.restore();

    // fugas y llamas por las grietas (el jefe se siente vivo aunque esté quieto)
    if (!showCreature && boss.state !== 'entering') drawBossCracks(gl + entryOff);

    // brillo del núcleo / carga de ataque
    if (!showCreature && (!boss.wp.core.broken || boss.telegraph > 0)) {
      const pulse = 0.5 + 0.5*Math.sin(performance.now()*0.005);
      const intensity = boss.wp.core.broken ? boss.telegraph*0.6 : (0.32 + 0.3*pulse + boss.telegraph*0.55);
      const cx = boss.x, cy = gl - 124 + entryOff;
      const rad = 52 + boss.telegraph*34;
      drawGlow('bossCore', '255,75,25', cx, cy, rad, Math.min(1, intensity));
    }

    // recuadros de los puntos débiles (feedback de fase 1)
    if (boss.phase === 1 && boss.state !== 'entering') {
      const pulse = 0.5 + 0.5*Math.sin(performance.now()*0.006);
      bossWeakPoints().forEach(wp => {
        const st = boss.wp[wp.id];
        if (st.broken) return;
        const frac = Math.max(0, st.hp/st.max);
        ctx.save();
        ctx.globalAlpha = (0.16 + 0.2*pulse)*(0.35 + 0.65*frac) + (st.flash > 0 ? 0.55 : 0);
        ctx.strokeStyle = wp.id === 'tank' ? '#8ad13a' : '#ff5a3c';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]);
        ctx.lineDashOffset = -performance.now()*0.02;
        ctx.strokeRect(wp.x - wp.r, wp.y + entryOff - wp.r, wp.r*2, wp.r*2);
        ctx.restore();
      });
    }

    // telégrafo de la onda horizontal
    if (boss.state === 'sweep' && boss.stateStep === 0) {
      const y = gl - 34;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.45*Math.abs(Math.sin(performance.now()*0.02));
      ctx.strokeStyle = '#ff6b2a';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(boss.x + boss.dir*BOSS_SWEEP_SAFE, y);
      ctx.lineTo(boss.dir > 0 ? boss.arenaMax : boss.arenaMin, y);
      ctx.stroke();
      ctx.restore();
    }

    // el puñetazo lo ejecuta el propio brazo de la criatura (ver drawBossCreature)
  }

  // fugas de ácido, chispas y llamitas en las grietas del blindaje
  function drawBossCracks(gy){
    const t = performance.now()*0.001;
    const spots = [
      { x: boss.dir*46,  y: -176, s: 1.0 },
      { x: -boss.dir*26, y: -96,  s: 0.8 },
      { x: boss.dir*96,  y: -120, s: 0.7 }
    ];
    ctx.save();
    spots.forEach((sp, i) => {
      if (boss.phase < 2 && i > 0) return;   // con el blindaje entero hay menos fugas
      const fl = 0.55 + 0.45*Math.sin(t*(5 + i*1.7) + i);
      const r = (9 + 7*fl)*sp.s;
      const gx = boss.x + sp.x, gyy = gy + sp.y;
      // antes creaba un gradiente nuevo acá, cada frame, durante TODA la
      // pelea (esté pasando algo o no) — hasta 3 a la vez en fase 2+.
      // El bitmap horneado aproxima el degradado de 3 paradas con uno
      // solo de 2 (pierde el tono intermedio, imperceptible a este radio)
      drawGlow('bossCrack', '255,150,60', gx, gyy, r*2.2, 0.5*fl);
    });
    // goteo del tanque roto
    if (boss.wp.tank.broken) {
      ctx.globalAlpha = 0.55 + 0.3*Math.sin(t*7);
      ctx.fillStyle = '#8ad13a';
      const tx = boss.x - boss.dir*100;
      ctx.fillRect(tx - 2, gy - 148, 4, 30 + 12*Math.sin(t*4));
    }
    ctx.restore();
  }

  // proyectiles, columnas y efectos por encima de los zombies
  function drawBossFX(){
    const gl = groundLevel();

    bossHazards.forEach(h => {
      if (h.kind === 'column' && h.fired) {
        const life = h.t/h.up;
        const hgt = 265*bclamp(life*1.7, 0, 1);
        drawFireColumn(h.x, gl, hgt, h.r, h.seed || 0, performance.now()*0.001);
      } else if (h.kind === 'shock') {
        const p = 1 - h.t/h.max;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = '#ffd35a';
        ctx.lineWidth = 4*(1-p) + 1;
        ctx.beginPath();
        ctx.ellipse(h.x, gl - 4, h.r*(0.4 + p*1.5), h.r*0.3*(0.4 + p*1.5), 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      } else if (h.kind === 'spark') {
        const p = 1 - h.t/h.max;
        ctx.save();
        ctx.globalAlpha = (1 - p)*0.9;
        ctx.strokeStyle = '#ff5a3c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r*(0.3 + p*1.3), 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }
    });

    // vómito de ácido de la criatura: chorro en cono, todo en bloques
    if (boss && boss.state === 'breath' && boss.stateStep === 1) {
      const m = bossMouth();
      const tt = performance.now()*0.001;
      drawAcidStream(m.x, m.y, boss.dir, tt, ACID_RAMP);
      // bocanada en la propia boca, para que nazca de dentro y no del aire
      drawPixelBlob(m.x + boss.dir*6, m.y + 2, 19 + 3*Math.sin(tt*17), 2.2, tt, ACID_RAMP, 1);
    }

    bossProjectiles.forEach(p => {
      if (p.kind === 'glob') {
        const tt = performance.now()*0.001;
        for (let i=0;i<p.trail.length;i++){
          const q0 = p.trail[i], f = (i+1)/p.trail.length;
          ctx.fillStyle = rampColor(ACID_RAMP, 0.45 + (1-f)*0.45);
          const sz = FIRE_Q*(0.5 + f);
          ctx.fillRect(fsnap(q0.x), fsnap(q0.y + (1-f)*6), sz, sz);
        }
        drawPixelBlob(p.x, p.y, p.r*1.5, p.wob, tt, ACID_RAMP, 1);

      } else if (p.kind === 'mortar') {
        const acid = !!p.acid;
        if (p.trail.length > 1) {
          for (let i=0;i<p.trail.length-1;i++){
            const a0 = p.trail[i], a1 = p.trail[i+1];
            const f = (i+1)/p.trail.length;
            if (acid) {
              const sz = FIRE_Q*(0.6 + f*1.6);
              ctx.fillStyle = rampColor(ACID_RAMP, 0.35 + (1-f)*0.5);
              ctx.fillRect(fsnap(a1.x), fsnap(a1.y + (1-f)*8), sz, sz);
            }
          }
        }
        ctx.save();
        if (!acid) {
          // bola de fuego pixelada con estela de humo y brasas
          const tt = performance.now()*0.001;
          for (let i=0;i<p.trail.length;i++){
            const q0 = p.trail[i], f = (i+1)/p.trail.length;
            ctx.fillStyle = f > 0.7 ? '#c22a06' : (f > 0.4 ? '#7a1600' : '#3a1608');
            const sz = FIRE_Q*(0.6 + f*1.4);
            ctx.fillRect(fsnap(q0.x + Math.sin(tt*9 + i)*3), fsnap(q0.y + (1-f)*6), sz, sz);
          }
          drawFireBlob(p.x, p.y, p.r*1.9, p.wob || 0, tt);
          ctx.restore();
          return;
        }
        if (acid) {
          drawPixelBlob(p.x, p.y, p.r*1.9, p.wob || 0, performance.now()*0.001, ACID_RAMP, 1);
        } else {
          ctx.shadowColor = '#ffb020';
          ctx.shadowBlur = 26;
          ctx.fillStyle = '#ff6b2a';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#ffd35a';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r*0.5, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
      } else if (p.kind === 'sweep') {
        // bola de fuego que rueda: cola de brasas + masa girando
        const tt = performance.now()*0.001;
        const dirS = p.vx > 0 ? 1 : -1;
        for (let i=1;i<=5;i++){
          const f = i/5;
          const bx = p.x - dirS*i*16;
          const by = p.y + Math.sin(tt*9 + i)*4 + f*10;
          const rr = p.r*(1 - f*0.72);
          drawPixelBlob(bx, by, rr, i*1.7, tt, FIRE_RAMP, -1);
        }
        drawPixelBlob(p.x, p.y, p.r, p.spin, tt, FIRE_RAMP, -1);
        drawPixelBlob(p.x - dirS*p.r*0.15, p.y - p.r*0.1, p.r*0.42, p.spin*1.7, tt*1.4, FIRE_RAMP, -1);
      }
    });
  }

  // rótulos de evento (espacio de pantalla)
  function drawBossOverlay(){
    if (bossNameT <= 0) return;
    const a = Math.min(1, bossNameT/1.2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#7c9a80';
    ctx.fillText(bossTitleSub, W/2, H*0.20);
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.fillStyle = '#ff2d4e';
    ctx.shadowColor = 'rgba(255,45,78,0.8)';
    ctx.shadowBlur = 18;
    ctx.fillText(bossTitleMain, W/2, H*0.20 + 34);
    ctx.restore();
  }