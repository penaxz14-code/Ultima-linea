let player;

let health, facing;

let hasDash = false;

let footstepTimer = 0;

  const MAX_HEALTH = 100;

  const GUN_Y_OFFSET = 38;

  const DASH_COOLDOWN = 5;

  const DASH_DURATION = 0.16;

  const DASH_SPEED = 1000;

  const DASH_INVULN_TIME = 0.32;

  const KNOCKBACK_DECAY = 9;

  function applyKnockback(dir, dist){
    player.knockbackVX = dir * dist * KNOCKBACK_DECAY;
  }

  function dashCooldownNow(){
    const upgBonus = (typeof UPG !== 'undefined') ? UPG.dashCooldownBonus() : 0;
    return Math.max(DASH_COOLDOWN - (wave-1)*0.105 - upgBonus, 3);
  }

  // ---- GATO SOLDADO DE ÉLITE ----------------------------------------
  //  Sprite por piezas (cabeza, torso, pierna, brazos, mano) para poder
  //  animarlas por separado. Resolución más fina que antes: bloques más
  //  pequeños y muchos más, con contorno, tres tonos de pelaje, mechones
  //  irregulares en la silueta y equipo táctico con correas y bolsillos.


  const CAT_PALETTE = {
    f:'#8a6a48', d:'#5d452c', o:'#b99a70', F:'#d9c09a', L:'#f2e6cc',
    K:'#141210', k:'#2a2520', W:'#ffffff', w:'#bcd0d0', P:'#c4787a',
    H:'#5a6b3a', h:'#3d4a26', J:'#76874e', j:'#293317',
    E:'#e8b98a', e:'#c1905f', C:'#8a6742',
    V:'#6f8f7a', v:'#3b5347', Z:'#cfe6dc',
    X:'#8a1414', x:'#4a0a0a', Q:'#0d0d0d',
    I:'#3fbfd0', i:'#1d6f80',
    G:'#3b4232', g:'#2a3025', M:'#525b44', D:'#191d16',
    B:'#3a3229', b:'#1f1a15', R:'#a8322a', A:'#e0a028',
    S:'#7a8078', s:'#474d45', T:'#2e2a22',
    n:'#12160f'
  };

  // La cabeza usa su PROPIA escala de bloque, más fina que la del cuerpo:
  // 28x24 celdas a 1.8 px ocupan lo mismo en pantalla que las 21x18 a 2.4,
  // pero con un 78% más de celdas, que es lo que permite meter el detalle
  // del casco, las gafas y los rasgos sin agrandar al personaje.
  const CAT_HEAD_PX = 1.8;

  const CAT_HEAD = [
    "..........jjJJJJjj..........",
    ".......jjhHJJJJJJJJHh.......",
    ".....jhHHJJJJJJJJJJJJJJ.....",
    "...jhHHJJJJJJJJJJJJJJJJJJ...",
    "..jhHHJJJJJhhJJJJJJJJJJJJH..",
    ".jhHHJJJJJhhhJJJJJJJddJJJHH.",
    ".jhHHJJJJJJhhJJJJJJdddJJJHH.",
    "jhHHHJJJJJJJJJJJJJJddJJJJHHH",
    "jhHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "jhhhhhhhhhhhhhhhhhhhhhhhhhhh",
    "jjjjjjjjjjjjjjjjjjjjjjjjjjjj",
    ".jCCCCCCCCCCCCCCCCCCCCCCCCj.",
    ".jCCCEEEEEEEEEEEEEEEEEECCCj.",
    ".jCKKKKKKKKKKKKKKKKKKKKKKCj.",
    ".jCKKKKKKKKKZVVVVKKKKZVVKCj.",
    ".jCKKKKKKKKKVVVVVKKKKVVVKCj.",
    ".jCKKKKKKKKKKKKKKKKKKKKKKCj.",
    ".jCEEEEEEEEEEEEEEEEEEEEEECj.",
    ".jCEEEEEEEEEEEEEEEeEEEEEECj.",
    "..jCEEEEEEEEEEEEEeEeEEEECj..",
    "..jCEEEEEEEEEEEEeQxQeEEECj..",
    "....jCEEEEEEEEEEEEEeEEEECj..",
    "......jCEEEEEEEEEEEEEEECj...",
    ".........jCeeeeeeeeeeCj....."
  ];

  // cuello: pieza puente entre la cabeza y el cuello alto del chaleco,
  // para que no queden pegados sin transición
  const CAT_NECK = [
    "nEEEEEEn",
    "nCeeeeCn"
  ];



  const CAT_TAIL = [
    "....fFo.",
    "...fFFo.",
    "..fFFdo.",
    "..fFFo..",
    ".fFFdo..",
    ".fFFo...",
    ".fFFo...",
    "..fFFo..",
    "..fFFdo.",
    "...fFFo.",
    "...fLFo.",
    "...fFFo.",
    "..fFFo..",
    "..fFo...",
    "..ff...."
  ];


  const CAT_PX = 2.4;

  const CAT_TORSO = [
    "......gGGGGg........",
    ".....gGDDDDGg.......",
    "...ggGMMGDDGMMGgg...",
    "..ngGMMBGDDGBMMGgn..",
    ".nGGMMBGGGGGGBMMGGn.",
    ".nGMMGBGMMMMMBGMMGn.",
    ".nGMMGBGMMMMMBGMMSn.",
    ".nGMMGBGMMRRMBGMMSn.",
    ".nGMMGBGMMMMMBGMMSn.",
    ".nGMMGBBBBBBBBGMMGn.",
    ".nGMMGDDDGGDDDGMMGn.",
    ".nGMMGDbDGGDbDGMMGn.",
    ".nGGMGDDDGGDDDGMGGn.",
    "..nbBBAABBBBAABBbn..",
    "..ngGGGGGGGGGGGGgn..",
    "...nggGGGGGGGGggn..."
  ];

  const CAT_LEG = [
    "gGGGGg",
    "gGMMGg",
    "gGGMGg",
    "gGGGGg",
    "bBBBBb",
    "TTTTTT",
    "TbTTbT",
    "bTTTTb"
  ];




  // ---- brazo delantero: manga que sale del hombro ----
  const CAT_ARM = [
    "nGGGn",
    "GMMMG",
    "GMMMG",
    "nGGGn"
  ];

  // ---- brazo de apoyo: largo y fino, sale del hombro del fondo ----
  const CAT_ARM_BACK = [
    "nGGGGGGGGGGGGGGn",
    "GMMMMMMMMMMMMMMG",
    "nGGGGGGGGGGGGGGn"
  ];

  // ---- mano enguantada: puño de pelaje arriba y guante agarrando ----
  const CAT_PAW = [
    ".FF.",
    "nFFn",
    "nBBn",
    ".nn."
  ];

  // el brazo trasero va en penumbra para que se lea detrás del cuerpo
  const CAT_PALETTE_DIM = (() => {
    const p = {};
    for (const k in CAT_PALETTE) {
      const c = CAT_PALETTE[k];
      const r = Math.round(parseInt(c.slice(1,3),16)*0.78);
      const g = Math.round(parseInt(c.slice(3,5),16)*0.78);
      const b = Math.round(parseInt(c.slice(5,7),16)*0.80);
      p[k] = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    }
    return p;
  })();

  //  Origen real de las balas: reproduce exactamente la misma cadena de
  //  transformaciones que dibuja el brazo y el arma en renderer.js
  //  (hombro -> rotar según puntería -> espejar si mira a la izquierda),
  //  así que el disparo siempre nace en la boca visible del cañón, seas
  //  cual seas el arma, el ángulo o el punto de la animación de correr.

  // ================== DAÑO PROGRESIVO DEL PERSONAJE =====================
  //  Según baja la vida el soldado se va rompiendo: primero sangre, luego
  //  el casco agrietado y el chaleco desgarrado. Los overlays son
  //  acumulativos (la etapa 3 incluye lo de la 1 y la 2) y se aplican con
  //  applyOverlay igual que las heridas de los zombies o el jefe.
  function playerDamageStage(){
    // contra el máximo EFECTIVO: si no, con una mejora de vida máxima el
    // soldado se veía intacto mientras la barra ya marcaba dos tercios
    const max = (typeof UPG !== 'undefined') ? UPG.effectiveMaxHealth() : MAX_HEALTH;
    const f = health / max;
    if (f > 0.72) return 0;
    if (f > 0.45) return 1;
    if (f > 0.22) return 2;
    return 3;
  }

  // ---- cabeza: sangre en la cara, luego grieta y abolladura en el casco ----
  const HEAD_DMG_1 = [
    [17,8,'X'],[18,8,'x'],[19,9,'x'],
    [22,20,'X'],[23,19,'x']
  ];
  const HEAD_DMG_2 = [
    // grieta bajando por el domo
    [2,12,'Q'],[3,12,'Q'],[3,13,'Q'],[4,13,'Q'],[4,14,'Q'],[5,14,'Q'],[6,15,'Q'],[7,15,'Q'],
    // abolladura hundida en el lateral
    [4,6,'h'],[5,6,'h'],[5,7,'h'],[6,7,'h'],
    // sangre bajando por la mejilla
    [17,20,'X'],[18,20,'x'],[19,21,'x'],[20,21,'x']
  ];
  const HEAD_DMG_3 = [
    // trozo del ala arrancado
    [9,24,'.'],[9,25,'.'],[10,25,'.'],[10,26,'.'],
    [2,13,'Q'],[1,12,'Q'],[5,15,'Q'],[6,16,'Q'],
    // lente cercana reventada
    [14,20,'Q'],[14,21,'Q'],[15,20,'Q'],
    // sangre densa
    [14,10,'X'],[18,12,'X'],[19,12,'x'],[19,13,'x'],[20,13,'x'],[21,13,'x'],[22,12,'x']
  ];

  // ---- torso: sangre, luego rotos en el chaleco que dejan ver el fondo ----
  const TORSO_DMG_1 = [
    [6,7,'X'],[7,7,'x'],[8,8,'x'],
    [11,13,'X'],[12,13,'x']
  ];
  const TORSO_DMG_2 = [
    // desgarro en la placa: se ve el hueco oscuro debajo
    [7,5,'Q'],[8,5,'Q'],[8,6,'Q'],[9,5,'Q'],
    [5,14,'Q'],[6,14,'Q'],[6,15,'Q'],
    [9,9,'X'],[10,9,'x'],[11,9,'x'],
    [13,6,'x'],[13,7,'x']
  ];
  const TORSO_DMG_3 = [
    // correa partida y cartucheras reventadas
    [4,6,'.'],[4,7,'.'],[4,8,'.'],
    [10,4,'Q'],[11,4,'Q'],[11,5,'Q'],[12,4,'Q'],
    [10,16,'Q'],[11,16,'Q'],[11,15,'Q'],
    [7,10,'X'],[8,10,'X'],[9,10,'x'],[10,10,'x'],[11,10,'x'],[12,10,'x'],
    [14,9,'x'],[14,10,'x'],[15,10,'x']
  ];

  function playerHeadRows(stage){
    let rows = CAT_HEAD;
    if (stage >= 1) rows = applyOverlay(rows, HEAD_DMG_1);
    if (stage >= 2) rows = applyOverlay(rows, HEAD_DMG_2);
    if (stage >= 3) rows = applyOverlay(rows, HEAD_DMG_3);
    return rows;
  }

  function playerTorsoRows(stage){
    let rows = CAT_TORSO;
    if (stage >= 1) rows = applyOverlay(rows, TORSO_DMG_1);
    if (stage >= 2) rows = applyOverlay(rows, TORSO_DMG_2);
    if (stage >= 3) rows = applyOverlay(rows, TORSO_DMG_3);
    return rows;
  }

  function gunOrigin(){
    const m = (typeof GUN_MUZZLE !== 'undefined' && GUN_MUZZLE[weapon]) || { x: 34, y: 0 };
    const flip = facing < 0;
    const angle = Math.atan2(aimDY, aimDX);
    const mx = m.x, my = flip ? -m.y : m.y;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const shoulderY = -GUN_Y_OFFSET + 4;
    const moving = Math.abs(player.vx) > 5;
    const bobY = Math.sin(player.bob) * (moving ? 2.2 : 0.4);
    return {
      x: player.x + facing*3 + (mx*cos - my*sin),
      y: groundY + GROUND_DEPTH_OFFSET + bobY + shoulderY + (mx*sin + my*cos)
    };
  }

  function damagePlayer(amount){
    if (player.invulnerable) return;
    if (devInvulnerable()) return;   // [DEV] modo desarrollador
    const reducMult = (typeof UPG !== 'undefined') ? UPG.incomingDamageMult() : 1;
    health -= amount * reducMult;
    const max = (typeof UPG !== 'undefined') ? UPG.effectiveMaxHealth() : MAX_HEALTH;
    healthInner.style.width = (Math.max(health,0) / max * 100) + '%';
    playHurtSound();
    if (typeof UPG !== 'undefined') UPG.onPlayerDamaged();
    if (health <= 0) endGame();
  }

  // ---- dash: invulnerable, 1 vez cada 5s ----
  function tryDash(){
    if (!running || paused || !hasDash) return;
    if (player.dashCooldown > 0 || player.dashT > 0) return;
    const dir = keys.left ? -1 : (keys.right ? 1 : facing);
    player.dashDir = dir;
    player.dashT = DASH_DURATION;
    player.invulnT = DASH_INVULN_TIME;
    player.dashCooldown = dashCooldownNow();
    if (typeof UPG !== 'undefined') UPG.onDashStart();
    playDashSound();
    spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - 28, '#bfe8ff', 12, 110);
  }

function updatePlayerMovement(dt){
    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;
    const spdMult = (typeof UPG !== 'undefined') ? UPG.moveSpeedMult() : 1;
    player.vx = dir * player.speed * spdMult;

    if (player.dashT > 0) {
      player.dashT -= dt;
      player.x += player.dashDir * DASH_SPEED * dt;
      if (Math.random() < 0.6) {
        spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - 30, '#bfe8ff', 2, 40);
      }
    } else {
      player.x += player.vx*dt;
    }

    if (player.knockbackVX && Math.abs(player.knockbackVX) > 2) {
      player.x += player.knockbackVX * dt;
      player.knockbackVX *= Math.max(0, 1 - KNOCKBACK_DECAY*dt);
    } else {
      player.knockbackVX = 0;
    }

    const ab = arenaBounds();
    player.x = Math.max(ab.min, Math.min(ab.max, player.x));
    player.bob += dt * (dir !== 0 ? 10 : 2);

    if (dir !== 0 && player.dashT <= 0) {
      footstepTimer -= dt;
      if (footstepTimer <= 0) {
        playFootstepSound();
        footstepTimer = 0.27;
      }
    } else {
      footstepTimer = 0;
    }
}

function updateDashTimers(dt){
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.invulnT > 0) player.invulnT -= dt;
    player.invulnerable = player.invulnT > 0;
}
