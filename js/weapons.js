let bullets;

let fireCd;

  let ammo, maxAmmo = 12, reloading, reloadT, reloadDuration;

let weapon = 'pistol';

let hasShotgun = false, hasSMG = false;

  const FIRE_CD = 0.26;

  const BULLET_SPEED = 680;

  const BASE_RELOAD = 0.55;

  /* ============================================================
     RECARGA ACTIVA
     ------------------------------------------------------------
     La recarga era el momento muerto del combate: mirabas la barra y
     esperabas. Ahora hay una ventana en el ciclo; si acertás el toque
     dentro de ella la recarga termina EN EL ACTO y ese cargador dispara
     más rápido. Si fallás, se traba y tardás bastante más.

     La ventana dura un tiempo REAL fijo (0.22s), no un porcentaje: si
     fuera porcentual, las mejoras de recarga rápida la volverían
     imposible de acertar justo cuando el jugador más invirtió en ella.

     El premio es cadencia y no daño a propósito — el daño se redondea a
     enteros contra los HP de los zombies, así que un +25% de daño se
     perdería entero al redondear y no se notaría.
     ============================================================ */
  const ACTIVE_WINDOW = 0.22;        // segundos reales de ventana
  const ACTIVE_FIRE_BONUS = 0.75;    // cargador perfecto: 25% más rápido
  const ACTIVE_FAIL_PENALTY = 0.7;   // fallar: +70% de tiempo de recarga

  // por debajo de este tiempo la recarga ya es prácticamente instantánea:
  // el minijuego no aportaría nada y la ventana sería tan corta que solo
  // repartiría penalizaciones al azar. Quien invirtió a fondo en recarga
  // rápida ya ganó — no tiene sentido cobrarle un peaje de reflejos.
  const ACTIVE_MIN_DURATION = 0.28;

  let reloadWindowStart = 0, reloadWindowEnd = 0;
  let reloadAttempted = false;
  let reloadArmed = false;           // ¿hay minijuego en esta recarga?
  let magFireBonus = 1;              // multiplicador de cadencia del cargador actual
  let activeReloadFlash = 0;         // feedback visual, lo lee renderer.js

  // nivel de tienda (reloadLevel) reduce el tiempo base; UPG.reloadSpeedMult()
  // (mejoras) lo DIVIDE encima — documentado en upgrades.js como "divide el
  // tiempo". Ninguna de las dos fuentes pisa a la otra.
  function reloadTimeNow(){
    const base = Math.max(BASE_RELOAD - reloadLevel*0.09, 0.2);
    const upgMult = (typeof UPG !== 'undefined') ? UPG.reloadSpeedMult() : 1;
    return Math.max(base / Math.max(upgMult, 0.01), 0.08);
  }

  // nivel de tienda (ammoLevel) + UPG.extraAmmo() (bono de mejoras) +
  // supplyAmmoBonus() (cajas de suministro recogidas en el mapa).
  // Lo llaman shop.js (buyItem 'ammo'), upgrades.js al aplicar una mejora
  // de munición y pickups.js al recoger una caja — nadie más debe tocar
  // maxAmmo directamente para que las tres fuentes queden sincronizadas.
  function recomputeMaxAmmo(){
    const upgBonus = (typeof UPG !== 'undefined') ? UPG.extraAmmo() : 0;
    const dropBonus = (typeof supplyAmmoBonus === 'function') ? supplyAmmoBonus() : 0;
    maxAmmo = 12 + ammoLevel*3 + upgBonus + dropBonus;
    const el = document.getElementById('maxAmmoVal');
    if (el) el.textContent = maxAmmo;
  }

  const GUN_PX = 2.7;

  const GUN_PALETTE = { C:'#4a4d52', G:'#7a808a', g:'#4a2f18', B:'#2e3034', R:'#1a1a1a' };

  const GUN_GRID = [
    "....C.......",
    "...CCCC.....",
    ".gGCCCCBBBBB",
    "gGGCCCCBBBBR",
    ".gGCCCC.....",
    "..gg........"
  ];

  const SHOTGUN_PALETTE = { C:'#3a3d42', G:'#6a6f75', g:'#4a2f18', B:'#6b4326', P:'#54575c', R:'#141414' };

  const SHOTGUN_GRID = [
    "...CC.......",
    "..CCCC......",
    ".gGCCCCBBBBB",
    "gGGCCCCPPPPR",
    ".gGCCCC.PP..",
    "..gg.PP....."
  ];

  const SMG_PALETTE = { B:'#2c2e31', A:'#4a4d52', s:'#7a808a', R:'#141414', M:'#1a1a1a' };

  const SMG_GRID = [
    "...BBBBBBBB.",
    "..BAAAAAAAAB",
    ".sBAAAAAAAAR",
    ".sBAAAAAAAA.",
    "..M.........",
    "..M........."
  ];

  // ---- zonas de rango óptimo por arma: cada arma "manda" en su distancia ----
  // pistola: francotiradora a media-larga distancia
  // escopeta: ejecutora de corto alcance, penaliza fuera de rango
  // smg: sostenida en distancia media, se degrada con espacio/tiempo
  // esto es un multiplicador de daño APARTE del de UPG: enemies.js combina
  // BASE_BULLET_DMG[b.wep] (categoría de arma) * b.damage (esta zona) y
  // recién ese total pasa por UPG.damage() para críticos/bonos
  const WEAPON_RANGES = {
    pistol:  { min:140, max:260 },
    shotgun: { min:50,  max:120 },
    smg:     { min:90,  max:180 }
  };

  function isInWeaponRange(w, dist){
    const r = WEAPON_RANGES[w];
    if (!r) return true;
    return dist >= r.min && dist <= r.max;
  }

  // distancia al objetivo más cercano. DEBE incluir al jefe: durante su
  // pelea no queda ningún zombie vivo, y si solo se miraran los zombies
  // esto devolvía Infinity, con lo que TODA arma se consideraba fuera de
  // su zona óptima — media potencia y dispersión máxima. Con esa
  // dispersión las balas fallaban los puntos débiles (el núcleo mide 18px)
  // y rebotaban contra el blindaje: se sentía como un escudo invisible.
  function closestTargetDist(){
    let best = Infinity;
    for (let i=0;i<zombies.length;i++){
      const z = zombies[i];
      if (!z.dead && !z.dying){
        const d = Math.abs(z.x - player.x);
        if (d < best) best = d;
      }
    }
    if (typeof bossActive === 'function' && bossActive() && typeof bossX === 'function'){
      const d = Math.abs(bossX() - player.x);
      if (d < best) best = d;
    }
    return best;
  }

  // alias histórico: lo llamaban otras partes por este nombre
  function closestZombieDist(){ return closestTargetDist(); }

  function getWeaponStats(w, dist){
    const stats = { damage:1, spread:0, knockback:1, fireRate:FIRE_CD };
    const upgSpread = (typeof UPG !== 'undefined') ? UPG.spreadMult() : 1;

    // El jefe queda SIEMPRE en zona óptima. Su pelea se diseñó antes que
    // el sistema de zonas y se pelea a la distancia que marca la arena,
    // muy por fuera del rango de cualquier arma. Con la penalización
    // activa el disparo se abría 0.04-0.18 rad: a 600px eso son ~25px de
    // desvío, más que el radio del núcleo (18px), así que las balas
    // fallaban los puntos débiles y rebotaban contra el blindaje. Se
    // sentía como un muro invisible que frenaba los disparos.
    const vsBoss = (typeof bossActive === 'function') && bossActive();

    if (w === 'pistol'){
      const inRange = vsBoss || isInWeaponRange('pistol', dist);
      stats.damage = inRange ? 1.6 : 0.6;
      stats.spread = (inRange ? 0 : 0.04) * upgSpread;
      stats.fireRate = FIRE_CD;
    }
    else if (w === 'shotgun'){
      const inRange = vsBoss || isInWeaponRange('shotgun', dist);
      stats.damage = inRange ? 2.4 : 0.3;
      stats.spread = (inRange ? 0.022 : 0.18) * upgSpread;
      stats.knockback = inRange ? 1.8 : 0.4;
      stats.fireRate = FIRE_CD * 1.35;
    }
    else if (w === 'smg'){
      const inRange = vsBoss || isInWeaponRange('smg', dist);
      stats.damage = 0.7;
      stats.spread = (inRange ? 0.01 : 0.14) * upgSpread;
      stats.fireRate = inRange ? FIRE_CD*0.4 : FIRE_CD*0.5;
    }
    // premio del cargador perfecto: dispara más rápido hasta vaciarlo
    stats.fireRate *= magFireBonus;
    return stats;
  }

  // ---- armas: cambio en caliente ----
  function ownedWeaponsList(){
    const list = ['pistol'];
    if (hasShotgun) list.push('shotgun');
    if (hasSMG) list.push('smg');
    return list;
  }

  function weaponLabel(w){
    if (w === 'shotgun') return 'ESCOPETA';
    if (w === 'smg') return 'METRALLETA';
    return 'PISTOLA';
  }

  function updateWeaponHUD(){
    weaponVal.textContent = weaponLabel(weapon);
    const shortLabel = weapon === 'shotgun' ? 'E' : (weapon === 'smg' ? 'M' : 'P');
    weaponSwitchLabel.textContent = shortLabel;
    const mobileLabel = document.getElementById('weaponSwitchLabelMobile');
    if (mobileLabel) mobileLabel.textContent = shortLabel;
  }

  // ---- feedback visual de rango: el contador de munición cambia de color
  // según si el arma actual está en su zona óptima contra el zombie más cercano ----
  function updateWeaponRangeHUD(){
    const vsBoss = (typeof bossActive === 'function') && bossActive();
    const dist = closestTargetDist();
    const inRange = vsBoss ? true : (dist === Infinity ? null : isInWeaponRange(weapon, dist));
    ammoVal.classList.remove('range-optimal', 'range-poor');
    if (ammoVal.classList.contains('empty')) return;
    if (inRange === true) ammoVal.classList.add('range-optimal');
    else if (inRange === false) ammoVal.classList.add('range-poor');
  }

  function cycleWeapon(){
    if (!running || paused) return;
    const list = ownedWeaponsList();
    if (list.length <= 1) return;
    const idx = list.indexOf(weapon);
    weapon = list[(idx+1) % list.length];
    updateWeaponHUD();
  }

  function reload(){
    if (!running || paused || reloading || ammo >= maxAmmo) return;
    reloading = true;
    reloadDuration = reloadTimeNow();
    reloadT = reloadDuration;
    reloadAttempted = false;
    reloadArmed = reloadDuration >= ACTIVE_MIN_DURATION;
    magFireBonus = 1;                 // el bono muere con el cargador viejo

    // la ventana se coloca en el tramo 30%-85% del ciclo, nunca al
    // principio (sería gratis) ni pegada al final (sería inalcanzable)
    const w = Math.min(ACTIVE_WINDOW, reloadDuration*0.5);
    const desde = reloadDuration*0.30;
    const hasta = reloadDuration*0.85 - w;
    reloadWindowStart = hasta > desde ? (desde + Math.random()*(hasta-desde)) : desde;
    reloadWindowEnd = reloadWindowStart + w;

    playReloadSound();
  }

  function finishReload(){
    reloading = false;
    ammo = maxAmmo;
    ammoVal.textContent = ammo;
    ammoVal.classList.remove('empty');
  }

  // la llaman input.js (tecla R, clic, botón táctil) y el disparo en
  // escritorio. Un solo intento por recarga: no se puede machacar el
  // botón hasta acertar de casualidad.
  function tryActiveReload(){
    if (!running || paused || !reloading || reloadAttempted) return;
    if (!reloadArmed) return;         // recarga demasiado corta: sin minijuego ni castigo
    reloadAttempted = true;
    const transcurrido = reloadDuration - reloadT;

    if (transcurrido >= reloadWindowStart && transcurrido <= reloadWindowEnd){
      magFireBonus = ACTIVE_FIRE_BONUS;
      activeReloadFlash = 0.45;
      finishReload();
      playHelmetHitSound();           // "clac" metálico de cerrojo
      spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - 42, '#7dff4d', 10, 110);
    } else {
      // atasco: el cargador se traba y tardás bastante más
      reloadT += reloadDuration * ACTIVE_FAIL_PENALTY;
      activeReloadFlash = -0.45;
      playFootHitSound();
    }
  }

  function ammoCostFor(w){
    return w === 'shotgun' ? 2 : 1;
  }

  function performFire(){
    const cost = ammoCostFor(weapon);
    if (ammo < cost || reloading) return;

    const dist = closestZombieDist();
    const stats = getWeaponStats(weapon, dist);
    const upgBulletSpeed = (typeof UPG !== 'undefined') ? UPG.bulletSpeedMult() : 1;
    const pierceLeft = (typeof UPG !== 'undefined') ? UPG.pierceCount() : 0;

    fireCd = stats.fireRate;
    ammo -= cost;
    ammoVal.textContent = ammo;
    if (ammo <= 0) {
      ammoVal.classList.add('empty');
      reload();
    }
    playShotSound();
    const origin = gunOrigin();
    const baseJitter = weapon === 'smg' ? (Math.random()-0.5)*0.09 : 0;
    const baseAngle = Math.atan2(aimDY, aimDX) + baseJitter;
    const pellets = weapon === 'shotgun' ? [-0.05, 0, 0.05] : [0];
    const firedThisShot = [];
    pellets.forEach(off => {
      const rangeJitter = (Math.random()-0.5) * stats.spread * 2;
      const a = baseAngle + off + rangeJitter;
      const bullet = {
        x: origin.x, y: origin.y,
        vx: Math.cos(a)*BULLET_SPEED*upgBulletSpeed, vy: Math.sin(a)*BULLET_SPEED*upgBulletSpeed,
        trail: [], dead:false,
        damage: stats.damage,      // multiplicador de ZONA (ver WEAPON_RANGES arriba)
        knockback: stats.knockback,
        wep: weapon,                // categoría de arma — la lee enemies.js y bosses.js
        pierceLeft                  // penetración de UPG.pierceCount(), 0 si no hay mejora
      };
      bullets.push(bullet);
      firedThisShot.push(bullet);
    });
    // marca de bala explosiva ("cada 8 disparos"): sin efecto si no hay mejora
    if (typeof UPG !== 'undefined') UPG.onShotFired(firedThisShot);
  }

function updateFiring(dt){
    if (fireCd > 0) fireCd -= dt;
    if (firing && fireCd <= 0) {
      // si no alcanza para el próximo disparo de esta arma (ej. escopeta
      // con 1 bala y costo 2), nunca se llega a ammo<=0 dentro de
      // performFire y el auto-reload nunca se disparaba: quedaba trabada
      // para siempre con esa bala suelta que no se puede gastar.
      if (!reloading && ammo < ammoCostFor(weapon)) reload();
      else performFire();
    }
    updateWeaponRangeHUD();
}

function updateReload(dt){
    if (activeReloadFlash > 0) activeReloadFlash = Math.max(0, activeReloadFlash - dt);
    else if (activeReloadFlash < 0) activeReloadFlash = Math.min(0, activeReloadFlash + dt);

    if (reloading) {
      reloadT -= dt;
      if (reloadT <= 0) finishReload();
    }
}

function updateBulletsMovement(dt){
    bullets.forEach(b => {
      b.trail.push({x:b.x, y:b.y});
      if (b.trail.length > 7) b.trail.shift();
      b.x += b.vx*dt;
      b.y += b.vy*dt;
    });
    compact(bullets, b => b.x > camX-100 && b.x < camX+W+100 && b.y > -80 && b.y < H+80 && !b.dead);
}
