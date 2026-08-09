const canvas = document.getElementById('canvas');

  const ctx = canvas.getContext('2d');

  // ---- resolución lógica fija + escalado responsivo ----
  // #gameArea es siempre una caja de 1000x600px lógicos, horizontal
  // (debe coincidir con el width/height fijo de #gameArea en style.css). Todo lo demás
  // (HUD, canvas, controles) se calcula contra esta caja constante; para
  // que quepa completa en cualquier pantalla sin deformarse, se escala
  // como bloque único mediante la variable CSS --game-scale.
  const LOGICAL_W = 1000;
  const LOGICAL_H = 600;

  let gameScale = 1;
  // ¿el juego está girado 90° porque el móvil está en vertical?
  // Lo decide este mismo sitio (y no un media query en el CSS) para que
  // la escala y la clase no puedan quedar desincronizadas.
  let gameRotated = false;
  const coarsePointer = window.matchMedia
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

  function applyViewportScale(){
    // visualViewport es el único que da la altura real con la barra de
    // direcciones de Safari retraída; innerHeight se queda desfasado
    const vv = window.visualViewport;
    const w = vv ? vv.width  : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;

    gameRotated = coarsePointer && h > w;
    document.documentElement.classList.toggle('forceLandscape', gameRotated);

    // girado, el ancho lógico (1000) se reparte sobre el ALTO de pantalla
    gameScale = gameRotated
      ? Math.min(h / LOGICAL_W, w / LOGICAL_H)
      : Math.min(w / LOGICAL_W, h / LOGICAL_H);
    document.documentElement.style.setProperty('--game-scale', gameScale);
    // el canvas también tiene que rehacerse: si solo se cambia la escala,
    // el búfer se queda del tamaño anterior y la imagen sale borrosa o
    // recortada hasta el siguiente resize
    if (typeof resize === 'function') resize();
  }

  /* Convierte un punto de pantalla (clientX/clientY de un evento) a
     coordenadas lógicas DENTRO del elemento indicado.

     Sin rotación es la cuenta de siempre: restar la esquina y dividir
     por la escala. Con rotate(90deg) los ejes se intercambian — el eje
     X lógico avanza hacia ABAJO en la pantalla y el eje Y lógico hacia
     la IZQUIERDA — así que hay que medir desde el borde superior y
     desde el DERECHO respectivamente. Sin esto los joysticks táctiles
     quedan cruzados e invertidos al rotar. */
  function localPoint(el, clientX, clientY){
    const r = el.getBoundingClientRect();
    if (gameRotated){
      return { x: (clientY - r.top) / gameScale,
               y: (r.right - clientX) / gameScale };
    }
    return { x: (clientX - r.left) / gameScale,
             y: (clientY - r.top)  / gameScale };
  }

  window.addEventListener('resize', applyViewportScale);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', applyViewportScale);
  // iOS informa las dimensiones VIEJAS durante orientationchange, así que
  // además de reaccionar al evento hay que volver a medir cuando el
  // navegador ya terminó de girar
  window.addEventListener('orientationchange', () => {
    applyViewportScale();
    setTimeout(applyViewportScale, 120);
    setTimeout(applyViewportScale, 400);
  });
  applyViewportScale();

let bgDeco, rubble, smoke, streetCracks, fireSpots, birds;
let lightningTimer = 8, lightningAlpha = 0, lightningBolt = null;

  const EMPTY18 = '.'.repeat(18);

  // ---- cache de sprites: cada combo (forma+paleta) se pinta UNA vez a un canvas
  // oculto a resolución nativa (1px por celda) y de ahí se reusa con drawImage,
  // muchísimo más barato que volver a hacer cientos de fillRect por frame ----
  const spriteBitmapCache = new Map();

  function getSpriteBitmap(key, rowsProvider, palette){
    let bmp = spriteBitmapCache.get(key);
    if (bmp) return bmp;
    const rows = rowsProvider();
    const numRows = rows.length, numCols = rows[0].length;
    const off = document.createElement('canvas');
    off.width = numCols; off.height = numRows;
    const octx = off.getContext('2d');
    for (let r=0;r<numRows;r++){
      const row = rows[r];
      for (let c=0;c<numCols;c++){
        const ch = row[c];
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) continue;
        octx.fillStyle = color;
        octx.fillRect(c, r, 1, 1);
      }
    }
    bmp = { canvas: off, cols: numCols, rows: numRows };
    spriteBitmapCache.set(key, bmp);
    return bmp;
  }

  // ---- glow horneado a bitmap: mismo truco que ya usa pickups.js
  // (getGlow), pero compartido acá para que renderer.js y cars.js dejen
  // de pedirle un gradiente nuevo al motor de canvas en cada partícula
  // y en cada frame. Se hornea UNA vez a un radio de referencia fijo y
  // se estampa con drawImage al radio y alpha reales — escalar un bitmap
  // ya existente es prácticamente gratis comparado con reconstruir el
  // degradado 60 veces por segundo por cada foco de fuego, columna de
  // humo o brasa en pantalla. Esto era justo el tipo de costo que no
  // depende de qué está pasando en la partida: corría igual de caro
  // aunque no hubiera un solo zombie cerca. ----
  const GLOW_REF = 64;
  const glowBitmapCache = new Map();
  function getGlowBitmap(key, rgb){
    let bmp = glowBitmapCache.get(key);
    if (bmp) return bmp;
    const off = document.createElement('canvas');
    off.width = off.height = GLOW_REF*2;
    const octx = off.getContext('2d');
    const rg = octx.createRadialGradient(GLOW_REF, GLOW_REF, 0, GLOW_REF, GLOW_REF, GLOW_REF);
    rg.addColorStop(0, `rgba(${rgb},1)`);
    rg.addColorStop(1, `rgba(${rgb},0)`);
    octx.fillStyle = rg;
    octx.fillRect(0, 0, GLOW_REF*2, GLOW_REF*2);
    bmp = { canvas: off };
    glowBitmapCache.set(key, bmp);
    return bmp;
  }

  // key: color único del glow (para no volver a hornearlo). rgb: "r,g,b".
  // El resto (posición, radio, opacidad) puede variar libre por frame sin
  // volver a tocar el motor de gradientes.
  function drawGlow(key, rgb, x, y, r, alpha){
    if (alpha <= 0 || r <= 0) return;
    const bmp = getGlowBitmap(key, rgb);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(bmp.canvas, x-r, y-r, r*2, r*2);
    ctx.restore();
  }

  // dibuja centrado horizontalmente / anclado abajo, igual que drawSprite original
  function drawSpriteCached(key, rowsProvider, palette, px, flip){
    const bmp = getSpriteBitmap(key, rowsProvider, palette);
    const totalW = bmp.cols*px, totalH = bmp.rows*px;
    if (flip) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(bmp.canvas, -totalW/2, -totalH, totalW, totalH);
      ctx.restore();
    } else {
      ctx.drawImage(bmp.canvas, -totalW/2, -totalH, totalW, totalH);
    }
  }

  // dibuja desde el pivote (0,0) hacia +x, centrado vertical, igual que drawGunSprite original
  function drawGunSpriteCached(key, rowsProvider, palette, px){
    const bmp = getSpriteBitmap(key, rowsProvider, palette);
    const totalW = bmp.cols*px, totalH = bmp.rows*px;
    ctx.drawImage(bmp.canvas, 0, -totalH/2, totalW, totalH);
  }

  function makeBuilding(x){
    const w = 40 + Math.random()*70;
    const h = 90 + Math.random()*220;
    const segs = 3 + Math.floor(Math.random()*4);
    const topProfile = [];
    for (let i=0;i<=segs;i++) topProfile.push(Math.random()*20);
    const windows = [];
    const wc = Math.max(1, Math.floor(w/15));
    const wr = Math.max(1, Math.floor(h/24));
    for (let r=0;r<wr;r++){
      for (let c=0;c<wc;c++){
        if (Math.random() < 0.55){
          const lit = Math.random() < 0.1;
          windows.push({ dx: 6+c*15, dy: 16+r*24, lit, flickerPhase: Math.random()*Math.PI*2, flickerSpeed: 1.5+Math.random()*3 });
        }
      }
    }
    return { x, w, h, topProfile, windows };
  }

function updateScenery(dt){
    smoke.forEach(s => {
      s.x += s.vx*dt;
      s.y -= s.speed*dt*0.15;
      if (s.y < -180) { s.y = groundY + 40; s.x = Math.random()*WORLD_WIDTH; }
      if (s.x < -100) s.x = WORLD_WIDTH+100;
      if (s.x > WORLD_WIDTH+100) s.x = -100;
    });

    fireSpots.forEach(f => {
      f.flicker += dt*4;
      f.emberTimer -= dt;
      if (f.emberTimer <= 0) {
        f.emberTimer = 0.12 + Math.random()*0.22;
        embers.push({
          x: f.x + (Math.random()-0.5)*26,
          y: groundY + GROUND_DEPTH_OFFSET - 4,
          vx: (Math.random()-0.5)*18,
          vy: -40 - Math.random()*40,
          life: 1.0 + Math.random()*0.8,
          maxLife: 1.8,
          size: 1.6 + Math.random()*1.8
        });
      }
    });
    embers.forEach(e => {
      e.x += e.vx*dt;
      e.y += e.vy*dt;
      e.vy -= 14*dt;
      e.vx *= 0.98;
      e.life -= dt;
    });
    compact(embers, e => e.life > 0);

    birds.forEach(b => {
      b.x += b.speed*dt;
      b.wingPhase += dt*9;
      if (b.x > WORLD_WIDTH+60) { b.x = -60; b.y = 60+Math.random()*90; }
    });

    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightningAlpha = 0.55 + Math.random()*0.3;
      lightningTimer = 10 + Math.random()*18;
      lightningBolt = generateLightningBolt();
      playThunderSound();
    }
    if (lightningAlpha > 0) lightningAlpha = Math.max(0, lightningAlpha - dt*2.4);
}

  function generateLightningBolt(){
    const startX = 60 + Math.random()*Math.max(1, W-120);
    const endY = H*0.3 + Math.random()*H*0.18;
    const points = [{x:startX, y:0}];
    let x = startX;
    const segs = 6 + Math.floor(Math.random()*4);
    for (let i=1;i<=segs;i++){
      const y = (endY/segs)*i;
      x += (Math.random()-0.5)*46;
      points.push({x, y});
    }
    let branch = null;
    if (Math.random() < 0.6 && points.length > 2){
      const bi = 1 + Math.floor(Math.random()*(points.length-2));
      let bx = points[bi].x, by = points[bi].y;
      branch = [{x:bx, y:by}];
      const bsegs = 2 + Math.floor(Math.random()*2);
      for (let i=1;i<=bsegs;i++){
        by += H*0.11;
        bx += (Math.random()-0.35)*38;
        branch.push({x:bx, y:by});
      }
    }
    return { points, branch };
  }

  const LEG_ROWS = 6;

  // dibuja un par de piernas con balanceo continuo (seno), evita el efecto "2 poses fijas"
  function drawLegPair(legKey, legRows, palette, px, flip, phase, moving){
    const liftAmp = moving ? px*1.5 : 0;
    const swingAmp = moving ? px*0.5 : 0;
    const sideOffset = px*3;
    const phaseA = phase;
    const phaseB = phase + Math.PI;
    const liftA = Math.max(0, Math.sin(phaseA)) * liftAmp;
    const liftB = Math.max(0, Math.sin(phaseB)) * liftAmp;
    const swingA = Math.sin(phaseA) * swingAmp;
    const swingB = Math.sin(phaseB) * swingAmp;

    ctx.save();
    ctx.translate(-sideOffset + swingA, -liftA);
    drawSpriteCached(legKey, () => legRows, palette, px, flip);
    ctx.restore();

    ctx.save();
    ctx.translate(sideOffset + swingB, -liftB);
    drawSpriteCached(legKey, () => legRows, palette, px, flip);
    ctx.restore();
  }

  function drawZombie(z){
    if (z.dead) return;
    const px = z.px;
    const t = z.dying ? (1 - z.dyingT/0.25) : 0;
    ctx.save();
    ctx.translate(z.x, groundY + GROUND_DEPTH_OFFSET);
    if (z.dying) {
      ctx.globalAlpha = 1 - t;
      ctx.rotate(t * Math.PI/2 * ((z.facingDir||1) < 0 ? 1 : -1));
    }
    let bobY = Math.sin(z.bob) * 1.8;
    const stagger = z.staggerT > 0 ? -3 : 0;
    if (z.staggerT > 0) z.staggerT -= 0.016;
    ctx.translate(0, bobY + stagger);

    if (z.legsGone && !z.dying) {
      const dir = (z.facingDir||1) < 0 ? -1 : 1;
      ctx.translate(0, 15);
      ctx.rotate(dir * 0.4);
    }

    const palette = zombiePalette(z.type);
    const flip = (z.facingDir||1) < 0;
    const headVariant = ((z.type === 'runner' || z.type === 'riot') && !z.helmetBroken) ? 'helmet' : (z.headDamaged ? 'dmg' : 'ok');
    const htKey = `zht_${z.type}_${headVariant}_${z.bodyStage}`;

    ctx.save();
    ctx.translate(0, -LEG_ROWS*px);
    drawSpriteCached(htKey, () => buildZombieGrid(z), palette, px, flip);
    ctx.restore();

    if (z.legsGone) {
      drawSpriteCached(`zstump_${z.type}`, () => ZOMBIE_STUMPS, palette, px, flip);
    } else {
      drawLegPair(`zleg_${z.type}`, ZOMBIE_LEG, palette, px, flip, z.bob, true);
    }

    if (z.type === 'riot' && z.shieldUp) {
      // anclado al SUELO (sin translate vertical): así cubre pies y torso
      // y deja el casco expuesto, que es justo la lectura que queremos —
      // "dispárale al escudo o a la cabeza, no hay atajo por los pies"
      // Se adelanta en la dirección de z.facingDir para que se lea como
      // sostenido con los brazos extendidos, no pegado al cuerpo.
      ctx.save();
      ctx.translate((z.facingDir||1) * px*3, 0);
      drawSpriteCached('shield', () => SHIELD_GRID, SHIELD_PALETTE, px*0.85, false);
      ctx.restore();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---- protagonista: mismo ensamblaje de 6 piezas que replica menu.js
  // (ver drawCat() ahí) — brazo trasero en penumbra, piernas, torso, cuello
  // puente, cabeza con su PROPIA escala de bloque (CAT_HEAD_PX, más fina
  // que CAT_PX) y la cadena hombro->manga->arma->mano. Nunca se debe volver
  // a colapsar cabeza+torso en un solo drawSpriteCached: la cabeza está
  // diseñada a 1.8px/celda, el cuerpo a 2.4px/celda, y forzar la misma
  // escala en ambos es lo que deforma al personaje.
  function drawPlayer(){
    ctx.save();
    ctx.translate(player.x, groundY + GROUND_DEPTH_OFFSET);
    if (player.invulnerable) {
      ctx.globalAlpha = 0.55 + 0.35*Math.sin(performance.now()*0.03);
    }
    const moving = Math.abs(player.vx) > 5;
    const bobY = Math.sin(player.bob) * (moving ? 2.2 : 0.4);
    ctx.translate(0, bobY);
    const angle = Math.atan2(aimDY, aimDX);
    const flip = facing < 0;

    const legsH  = CAT_LEG.length*CAT_PX;
    const torsoH = CAT_TORSO.length*CAT_PX;
    const stage  = (typeof playerDamageStage === 'function') ? playerDamageStage() : 0;

    // 1 · brazo de apoyo en penumbra, por detrás del cuerpo
    ctx.save();
    ctx.translate(facing*3, -GUN_Y_OFFSET + 4);
    ctx.rotate(angle);
    ctx.translate(flip ? 4 : -4, 7);
    drawGunSpriteCached('cat_arm_back_dim', () => CAT_ARM_BACK, CAT_PALETTE_DIM, CAT_PX);
    ctx.translate(flip ? -22 : 22, 0);
    drawGunSpriteCached('cat_paw_dim', () => CAT_PAW, CAT_PALETTE_DIM, CAT_PX);
    ctx.restore();

    // 2 · piernas
    drawLegPair('cat_leg', CAT_LEG, CAT_PALETTE, CAT_PX, flip, player.bob, moving);

    // 3 · torso (con etapa de daño si corresponde)
    ctx.save();
    ctx.translate(0, -legsH + 2);
    const torsoRows = (typeof playerTorsoRows === 'function') ? playerTorsoRows(stage) : CAT_TORSO;
    drawSpriteCached(`cat_torso_${stage}`, () => torsoRows, CAT_PALETTE, CAT_PX, flip);
    ctx.restore();

    // 4 · cuello: pieza puente entre el chaleco y la cabeza
    ctx.save();
    ctx.translate(flip ? -2 : 2, -(legsH + torsoH - 5));
    drawSpriteCached('cat_neck', () => CAT_NECK, CAT_PALETTE, CAT_PX, flip);
    ctx.restore();

    // 5 · cabeza: escala de bloque propia, más fina (con etapa de daño)
    ctx.save();
    ctx.translate(flip ? -3 : 3, -(legsH + torsoH - 5) - CAT_NECK.length*CAT_PX + 3);
    const headRows = (typeof playerHeadRows === 'function') ? playerHeadRows(stage) : CAT_HEAD;
    drawSpriteCached(`cat_head_${stage}`, () => headRows, CAT_PALETTE, CAT_HEAD_PX, flip);
    ctx.restore();

    // 6 · cadena del arma: hombro -> manga -> arma -> mano en la culata
    ctx.save();
    ctx.translate(facing*3, -GUN_Y_OFFSET + 4);
    ctx.rotate(angle);
    ctx.save();
    ctx.translate(flip ? 2 : -2, 2);
    drawGunSpriteCached('cat_arm', () => CAT_ARM, CAT_PALETTE, CAT_PX);
    ctx.restore();
    const gunGrid = weapon === 'shotgun' ? SHOTGUN_GRID : (weapon === 'smg' ? SMG_GRID : GUN_GRID);
    const gunPal = weapon === 'shotgun' ? SHOTGUN_PALETTE : (weapon === 'smg' ? SMG_PALETTE : GUN_PALETTE);
    drawGunSpriteCached(`gun_${weapon}`, () => gunGrid, gunPal, GUN_PX);
    ctx.save();
    ctx.translate(flip ? -5 : 5, 3);
    drawGunSpriteCached('cat_paw', () => CAT_PAW, CAT_PALETTE, CAT_PX);
    ctx.restore();
    ctx.restore();

    ctx.restore();
  }

  // ---- barra de RECARGA ACTIVA, flotando sobre el soldado ----
  //  Se dibuja en el canvas y no en el DOM a propósito: tiene que estar
  //  pegada al personaje, donde el jugador ya está mirando. Si estuviera
  //  arriba en el HUD nadie acertaría la ventana a tiempo.
  function drawReloadBar(){
    if (typeof reloading === 'undefined') return;
    if (!reloading && !(typeof activeReloadFlash !== 'undefined' && activeReloadFlash !== 0)) return;

    const ancho = 38, alto = 5;
    const x = player.x - ancho/2;
    const y = groundY + GROUND_DEPTH_OFFSET - 104;

    ctx.save();

    // marco metálico
    ctx.fillStyle = 'rgba(8,11,10,0.88)';
    ctx.fillRect(x-1.5, y-1.5, ancho+3, alto+3);
    ctx.strokeStyle = 'rgba(140,150,130,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x-1.5, y-1.5, ancho+3, alto+3);

    if (reloading){
      const transcurrido = reloadDuration - reloadT;
      const prog = Math.max(0, Math.min(1, transcurrido / reloadDuration));

      // zona dulce (solo si esta recarga trae minijuego)
      const armado = (typeof reloadArmed === 'undefined') || reloadArmed;
      if (armado){
        const zi = Math.max(0, Math.min(1, reloadWindowStart / reloadDuration));
        const zf = Math.max(0, Math.min(1, reloadWindowEnd / reloadDuration));
        const yaPaso = transcurrido > reloadWindowEnd;
        const gastada = (typeof reloadAttempted !== 'undefined') && reloadAttempted;
        ctx.fillStyle = (gastada || yaPaso) ? 'rgba(120,110,90,0.5)' : 'rgba(255,176,32,0.85)';
        ctx.fillRect(x + zi*ancho, y, Math.max(2, (zf-zi)*ancho), alto);
      }

      // progreso recorrido
      ctx.fillStyle = 'rgba(125,255,77,0.30)';
      ctx.fillRect(x, y, prog*ancho, alto);

      // cursor
      const cx = x + prog*ancho;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx-1, y-1.5, 2, alto+3);
    } else {
      // destello del resultado: verde si clavó la ventana, rojo si se trabó
      const bueno = activeReloadFlash > 0;
      const a = Math.abs(activeReloadFlash) / 0.45;
      ctx.fillStyle = bueno ? `rgba(125,255,77,${a})` : `rgba(255,45,78,${a})`;
      ctx.fillRect(x, y, ancho, alto);
    }

    ctx.restore();
  }

  function drawAimGuide(){
    const origin = gunOrigin();
    const len = 55;
    ctx.save();
    ctx.setLineDash([3,5]);
    ctx.strokeStyle = 'rgba(255,176,32,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x + aimDX*18, origin.y + aimDY*18);
    ctx.lineTo(origin.x + aimDX*len, origin.y + aimDY*len);
    ctx.stroke();
    ctx.restore();
  }

  function render(){
    ctx.clearRect(0,0,W,H);

    // sacudida de cámara del jefe: la calcula bosses.js (bossShakeX) y se
    // aplica al desplazamiento del mundo. Sin esto los pisotones, el
    // aterrizaje y los impactos del jefe no se sienten en absoluto.
    const shakeX = (typeof bossShakeX === 'function') ? bossShakeX() : 0;

    ctx.save();
    ctx.translate(-camX + shakeX, 0);

    // focos de fuego distantes (parpadeantes, varios a lo largo del mapa)
    fireSpots.forEach(f => {
      if (f.x < camX - 280 || f.x > camX + W + 280) return;
      const flick = 0.65 + 0.35*Math.sin(f.flicker);
      drawGlow('fireSpot', '255,110,30', f.x, groundY-20, 200*flick, 0.28*flick);
    });

    // ruined skyline
    bgDeco.forEach(b => {
      if (b.x + b.w < camX - 20 || b.x > camX + W + 20) return;
      const topY = groundY - b.h;
      ctx.fillStyle = 'rgba(16,23,18,0.88)';
      ctx.beginPath();
      const segW = b.w / (b.topProfile.length-1);
      ctx.moveTo(b.x, groundY);
      ctx.lineTo(b.x, topY + b.topProfile[0]);
      b.topProfile.forEach((t,i) => ctx.lineTo(b.x + i*segW, topY + t));
      ctx.lineTo(b.x + b.w, groundY);
      ctx.closePath();
      ctx.fill();
      b.windows.forEach(w => {
        if (w.lit) {
          const flick = 0.55 + 0.45*Math.sin(performance.now()*0.001*w.flickerSpeed + w.flickerPhase);
          ctx.fillStyle = `rgba(255,176,32,${0.5*flick})`;
        } else {
          ctx.fillStyle = 'rgba(4,7,5,0.85)';
        }
        ctx.fillRect(b.x + w.dx, topY + w.dy, 5, 7);
      });
    });

    // autos abandonados (capa intermedia entre edificios y calle) y
    // decorado de fondo (cercas, árboles, señales, flotsam, arbustos)
    drawCars();
    drawScenery();

    // pájaros/cuervos sobrevolando la ciudad en ruinas
    ctx.strokeStyle = 'rgba(10,12,10,0.55)';
    ctx.lineWidth = 1.6;
    birds.forEach(bird => {
      if (bird.x < camX - 40 || bird.x > camX + W + 40) return;
      const flap = Math.sin(bird.wingPhase) * 5;
      ctx.beginPath();
      ctx.moveTo(bird.x-7, bird.y - flap);
      ctx.lineTo(bird.x, bird.y);
      ctx.lineTo(bird.x+7, bird.y - flap);
      ctx.stroke();
    });

    // drifting smoke
    smoke.forEach(s => {
      if (s.x < camX - 120 || s.x > camX + W + 120) return;
      drawGlow('smoke', '70,68,62', s.x, s.y, s.r, 0.16);
    });

    // brasas ascendiendo desde los focos de fuego — antes usaban
    // shadowBlur, la operación más cara de canvas 2D, sobre ~25-30
    // brasas vivas a la vez de forma constante (no depende de la
    // partida: el costo estaba ahí aunque no hubiera ni un zombie
    // cerca). El bitmap horneado ya trae el resplandor incluido.
    embers.forEach(e => {
      const alpha = Math.max(e.life/e.maxLife, 0);
      const bright = alpha > 0.5;
      drawGlow(bright ? 'emberHot' : 'emberCool', bright ? '255,208,102' : '255,107,42', e.x, e.y, e.size*3, alpha);
    });
    ctx.globalAlpha = 1;

    ctx.restore();

    // suelo: asfalto de calle, en espacio de pantalla, cubre todo el ancho visible
    ctx.fillStyle = '#2c2c2e';
    ctx.fillRect(0, groundY+1, W, H-groundY-1);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY+1);
    ctx.lineTo(W, groundY+1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, groundY+3, W, 3);

    ctx.save();
    ctx.translate(-camX + shakeX, 0);

    // grietas y manchas del asfalto (mundo, se desplazan con la cámara)
    streetCracks.forEach(c => {
      if (c.x < camX - 30 || c.x > camX + W + 30) return;
      if (c.stain) {
        ctx.fillStyle = 'rgba(10,10,10,0.35)';
        ctx.beginPath();
        ctx.ellipse(c.x, groundY + c.y + 10, c.len*0.7, c.len*0.35, c.rot, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(c.x, groundY + c.y + 6);
        ctx.rotate(c.rot);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-c.len/2, 0);
        ctx.lineTo(c.len/2, 0);
        ctx.stroke();
        ctx.restore();
      }
    });

    // línea central discontinua tipo calle
    const dashPeriod = 46, dashLen = 22;
    const dashStartIdx = Math.floor((camX-dashLen)/dashPeriod);
    const dashEndX = camX + W + dashLen;
    ctx.fillStyle = 'rgba(255,210,90,0.18)';
    for (let dx = dashStartIdx*dashPeriod; dx < dashEndX; dx += dashPeriod){
      ctx.fillRect(dx, groundY + 34, dashLen, 3);
    }

    // foreground rubble
    ctx.fillStyle = 'rgba(28,24,20,0.9)';
    rubble.forEach(r => {
      if (r.x + r.w < camX - 20 || r.x > camX + W + 20) return;
      ctx.beginPath();
      ctx.moveTo(r.x, groundY);
      ctx.lineTo(r.x + r.w*0.2, groundY - r.h);
      ctx.lineTo(r.x + r.w*0.55, groundY - r.h*0.7);
      ctx.lineTo(r.x + r.w*0.8, groundY - r.h);
      ctx.lineTo(r.x + r.w, groundY);
      ctx.closePath();
      ctx.fill();
    });

    const skipChunkRotation = particles.length > 60;
    particles.forEach(p => {
      const alpha = Math.max(p.life/p.maxLife, 0);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.chunk) {
        if (skipChunkRotation) {
          ctx.fillRect(p.x-p.w/2, p.y-p.h/2, p.w, p.h);
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
          ctx.restore();
        }
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI*2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    // peligros del jefe pegados al suelo (charcos de ácido, grietas):
    // van bajo todo lo demás para que nada los tape
    drawBossGround();

    // monedas y cajas de suministro: sobre el asfalto pero por debajo de
    // los zombies y del jugador, para que nunca tapen un objetivo
    drawPickups();

    zombies.forEach(drawZombie);

    // el jefe se dibuja tras los zombies: es lo más grande de la escena
    // y tiene que leerse por encima de la horda
    drawBoss();

    bolts.forEach(a => {
      const isFire = a.kind === 'fire';
      const rgb = isFire ? '255,110,40' : '155,232,58';
      const size = a.visualSize || (isFire ? 8.5 : 4.2);
      if (a.trail.length > 1) {
        ctx.save();
        for (let i=0;i<a.trail.length-1;i++){
          const p0 = a.trail[i], p1 = a.trail[i+1];
          const alpha = (i+1)/a.trail.length * 0.45;
          ctx.strokeStyle = `rgba(${rgb},${alpha})`;
          ctx.lineWidth = (isFire ? 5.5 : 3) * ((i+1)/a.trail.length);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = isFire ? '#ff6b2a' : '#9be83a';
      ctx.shadowColor = isFire ? '#ffb020' : '#c8e83a';
      ctx.shadowBlur = isFire ? 18 : 12;
      ctx.beginPath();
      ctx.arc(a.x, a.y, size, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    if (running) drawAimGuide();

    bullets.forEach(b => {
      if (b.trail.length > 1) {
        ctx.save();
        for (let i=0;i<b.trail.length-1;i++){
          const p0 = b.trail[i], p1 = b.trail[i+1];
          const alpha = (i+1)/b.trail.length * 0.5;
          ctx.strokeStyle = `rgba(255,210,120,${alpha})`;
          ctx.lineWidth = 2.4 * ((i+1)/b.trail.length);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      // el resplandor de la punta iba con shadowBlur — con la metralleta
      // (~10 disparos/seg) podían ser varias balas en vuelo a la vez,
      // cada una recalculando el blur cada frame; justo el momento de
      // más acción, donde más se nota cualquier bajón.
      drawGlow('bulletTip', '255,208,102', b.x, b.y, 9, 0.85);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.6, 0, Math.PI*2);
      ctx.fill();
    });

    drawPlayer();
    drawReloadBar();

    // columnas de fuego, ondas de choque y aliento ácido: por encima de
    // todos los personajes, son los avisos de ataque del jefe
    drawBossFX();

    ctx.restore();

    // rótulo de presentación del jefe — FUERA del translate de cámara
    // porque se posiciona en coordenadas de pantalla (W/2, H*0.20)
    drawBossOverlay();

    if (lightningAlpha > 0) {
      if (lightningBolt) {
        ctx.save();
        ctx.strokeStyle = `rgba(230,240,255,${Math.min(1, lightningAlpha*1.6)})`;
        ctx.lineWidth = 2.4;
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(200,220,255,0.9)';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(lightningBolt.points[0].x, lightningBolt.points[0].y);
        lightningBolt.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        if (lightningBolt.branch) {
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(lightningBolt.branch[0].x, lightningBolt.branch[0].y);
          lightningBolt.branch.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = `rgba(220,230,255,${lightningAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
