  let W, H, DPR, groundY;

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.imageSmoothingEnabled = false;
    groundY = H - 70;
    if (player) camX = Math.max(0, Math.min(WORLD_WIDTH - W, player.x - W/2));
  }

  window.addEventListener('resize', resize);

let score, wave, running, waveTimer;

  let paused = false, inShop = false;

  let camX = 0;

  const WORLD_WIDTH = 3000;

  const GROUND_DEPTH_OFFSET = 9;

  function setupState(){
    player = { x: WORLD_WIDTH/2, w: 30, h: 60, vx: 0, speed: 280, bob:0, dashCooldown:0, dashT:0, dashDir:1, invulnT:0, invulnerable:false };
    zombies = [];
    bullets = [];
    particles = [];
    bolts = [];
    camX = Math.max(0, Math.min(WORLD_WIDTH - W, player.x - W/2));

    resetBoss();
    resetPickups();      // monedas en el suelo + cajas de suministro

    bgDeco = [];
    let bx = -60;
    while (bx < WORLD_WIDTH+60){
      const b = makeBuilding(bx);
      bgDeco.push(b);
      bx += b.w + 10 + Math.random()*24;
    }

    rubble = [];
    const rubbleCount = Math.floor(WORLD_WIDTH/75);
    for (let i=0;i<rubbleCount;i++){
      rubble.push({ x: Math.random()*WORLD_WIDTH, w: 16+Math.random()*32, h: 8+Math.random()*16 });
    }

    smoke = [];
    const smokeCount = Math.floor(WORLD_WIDTH/150);
    for (let i=0;i<smokeCount;i++){
      smoke.push({
        x: Math.random()*WORLD_WIDTH, y: groundY-80-Math.random()*220,
        r: 34+Math.random()*55, vx:(Math.random()-0.5)*5, speed:6+Math.random()*10
      });
    }

    streetCracks = [];
    const crackCount = Math.floor(WORLD_WIDTH/90);
    for (let i=0;i<crackCount;i++){
      streetCracks.push({
        x: Math.random()*WORLD_WIDTH, y: Math.random()*46,
        len: 12+Math.random()*22, rot: (Math.random()-0.5)*1.1,
        stain: Math.random() < 0.35
      });
    }

    fireSpots = [];
    const fireCount = Math.max(3, Math.floor(WORLD_WIDTH/650));
    for (let i=0;i<fireCount;i++){
      fireSpots.push({
        x: 150 + Math.random()*(WORLD_WIDTH-300),
        flicker: Math.random()*Math.PI*2,
        emberTimer: Math.random()*0.3
      });
    }
    embers = [];

    birds = [];
    const birdCount = 2 + Math.floor(Math.random()*3);
    for (let i=0;i<birdCount;i++){
      birds.push({
        x: Math.random()*WORLD_WIDTH, y: 60+Math.random()*90,
        speed: 18+Math.random()*14, wingPhase: Math.random()*Math.PI*2
      });
    }
    lightningTimer = 6 + Math.random()*10;
    lightningAlpha = 0;

    spawnCars();
    spawnScenery();

    score = 0;
    wave = 1;
    health = MAX_HEALTH;
    facing = 1;
    aimDX = 1; aimDY = 0;
    spawnTimer = 1.2;
    waveTimer = 20;
    fireCd = 0;

    coins = 0;
    weapon = 'pistol';
    hasShotgun = false;
    hasSMG = false;
    hasDash = false;
    ammoLevel = 0;
    reloadLevel = 0;
    SHOP_ITEMS.forEach(it => it.level = 0);
    if (typeof UPG !== 'undefined') UPG.reset();
    if (typeof recomputeMaxAmmo === 'function') recomputeMaxAmmo(); else maxAmmo = 12;

    ammo = maxAmmo;
    reloading = false;
    reloadT = 0;
    reloadDuration = reloadTimeNow();
    paused = false;
    inShop = false;

    scoreVal.textContent = '0';
    waveVal.textContent = '1';
    healthInner.style.width = '100%';
    ammoVal.textContent = ammo;
    ammoVal.classList.remove('empty');
    coinVal.textContent = '0';
    updateWeaponHUD();
  }

  function initGame(){
    resize();
    setupState();
    running = true;
    if (typeof startAmbientWind === 'function') startAmbientWind();
    if (typeof startAmbientMelody === 'function') startAmbientMelody();
  }

  let lastT = 0;

  function loop(t){
    if (!lastT) lastT = t;
    let dt = (t - lastT)/1000;
    if (dt > 0.05) dt = 0.05;
    lastT = t;
    if (running && !paused) update(dt);
    render();
    requestAnimationFrame(loop);
  }

function updateCamera(){
  // durante el jefe la cámara queda encerrada en la arena
  const a = cameraBounds();
  const minCam = Math.max(0, a.min);
  const maxCam = Math.max(minCam, Math.min(WORLD_WIDTH, a.max) - W);
  camX = Math.max(minCam, Math.min(maxCam, player.x - W/2));
}

function updateWave(dt){
    if (bossActive()) return;   // el reloj de oleada se congela mientras vive el jefe
    waveTimer -= dt;
    if (waveTimer <= 0) {
      wave += 1;
      waveVal.textContent = wave;
      waveTimer = 20;
      playWaveSound();
      rollSupplyDrop();   // sorteo de botiquin / caja de municion
      openShop();   // la propia tienda decide si además muestra la columna de mejoras (upgrades.js)
      if (wave === BOSS_WAVE) spawnBoss();
    }
}

function update(dt){
  updatePlayerMovement(dt);
  updateDashTimers(dt);
  updateDashButtonUI();
  updateCamera();
  updateFiring(dt);
  updateReload(dt);
  updateWave(dt);
  updateSpawning(dt);
  updateBulletsMovement(dt);
  resolveBossBulletHits();
  resolveBulletHits();
  updateZombiesAI(dt);
  updateBoss(dt);
  updateZombieAmbience(dt);
  updateBolts(dt);
  updateParticlesPhysics(dt);
  updatePickups(dt);
  updateScenery(dt);
  updateCars(dt);
  if (typeof UPG !== 'undefined') UPG.update(dt);
}

  function endGame(){
    running = false;
    firing = false;
    stopBossMusic();
    if (typeof stopAmbientMelody === 'function') stopAmbientMelody();
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h2>TE ALCANZARON</h2>
      <div class="score-final">PUNTAJE: ${score} — OLEADA ${wave}</div>
      <button id="startBtn">REINTENTAR</button>
    `;
    document.getElementById('startBtn').addEventListener('click', () => {
      overlay.classList.add('hidden');
      initGame();
    });
  }

  // fin del demo: se llama al matar al jefe (bosses.js, bossDefeated())
  // en vez de abrir la tienda y seguir a la oleada 26, que todavía no existe.
  // #demoCompleteBadge es solo un marcador oculto para que hud.js le ponga
  // su propio título de "victoria" al panel en vez del de game over.
  function showDemoComplete(){
    running = false;
    firing = false;
    stopBossMusic();
    if (typeof stopAmbientMelody === 'function') stopAmbientMelody();
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <div id="demoCompleteBadge" style="display:none"></div>
      <h2>EL ABOMINABLE HA CAÍDO</h2>
      <div class="score-final">PUNTAJE: ${score} · OLEADA ${wave}</div>
      <p>SEGUNDA LÍNEA — PRÓXIMAMENTE<br>GRACIAS POR JUGAR EL DEMO</p>
      <button id="startBtn">JUGAR DE NUEVO</button>
    `;
    document.getElementById('startBtn').addEventListener('click', () => {
      overlay.classList.add('hidden');
      initGame();
    });
  }

  document.getElementById('startBtn').addEventListener('click', () => {
    overlay.classList.add('hidden');
    initGame();
  });

  resize();

  running = false;

  setupState();

  requestAnimationFrame(loop);
