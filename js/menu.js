/* ============================================================
   ÚLTIMA LÍNEA — pantalla de inicio
   Autónomo: no toca ni un solo estado del juego. Sólo dibuja
   sobre su propio canvas y deja el botón #startBtn intacto para
   que game.js siga arrancando la partida como siempre.
   ============================================================ */
(function(){
  'use strict';

  const overlayEl   = document.getElementById('overlay');
  const menuScreen  = document.getElementById('menuScreen');
  if (!menuScreen || !overlayEl) return;

  const cv  = document.getElementById('menuCanvas');
  const g   = cv.getContext('2d');

  // misma caja lógica que #gameArea (1000x600). El escalado responsive
  // lo sigue haciendo --game-scale sobre el contenedor, acá no se toca nada.
  const MW = 1000, MH = 600;
  const HORIZON   = 470;  // borde superior del asfalto
  const CAT_FLOOR = 512;  // altura donde apoyan las patas del gato
  const CAT_X     = 500;

  const rnd = (a,b) => a + Math.random()*(b-a);
  const clamp01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);

  /* ---------- canvas ---------- */
  function fitCanvas(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width  = MW*dpr;
    cv.height = MH*dpr;
    cv.style.width  = MW+'px';
    cv.style.height = MH+'px';
    g.setTransform(dpr,0,0,dpr,0,0);
    g.imageSmoothingEnabled = false;
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  /* ============================================================
     1. LOGO — letras construidas pixel a pixel (no es texto plano)
     ============================================================ */
  const FONT = {
    A:['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
    E:['#####','#....','#....','####.','#....','#....','#####'],
    I:['#####','..#..','..#..','..#..','..#..','..#..','#####'],
    L:['#....','#....','#....','#....','#....','#....','#####'],
    M:['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],
    N:['#...#','##..#','#.#.#','#.#.#','#..##','#...#','#...#'],
    T:['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
    U:['#...#','#...#','#...#','#...#','#...#','#...#','.###.']
  };
  const ACCENT = ['..##.','.##..'];           // tilde, se dibuja 2 filas arriba
  const ACCENTED = { 'Ú':'U', 'Í':'I' };

  // devuelve { rects:[[x,y]], w } para una palabra en unidades de celda
  function layoutWord(word, u, x0, y0){
    const cells = [];
    let cx = x0;
    const src = word.normalize ? word.normalize('NFC') : word;
    for (const raw of src){
      const base = ACCENTED[raw] || raw;
      const glyph = FONT[base];
      if (!glyph) { cx += 6*u; continue; }
      for (let r=0;r<glyph.length;r++){
        for (let c=0;c<glyph[r].length;c++){
          if (glyph[r][c] === '#') cells.push([cx + c*u, y0 + r*u]);
        }
      }
      if (ACCENTED[raw]){
        for (let r=0;r<ACCENT.length;r++){
          for (let c=0;c<ACCENT[r].length;c++){
            if (ACCENT[r][c] === '#') cells.push([cx + c*u, y0 - (2-r)*u]);
          }
        }
      }
      cx += 6*u;
    }
    return cells;
  }

  function rectsOf(cells, u, dx, dy){
    let s = '';
    for (const [x,y] of cells) s += `<rect x="${x+dx}" y="${y+dy}" width="${u}" height="${u}"/>`;
    return s;
  }

  function buildLogo(){
    const svg = document.getElementById('logoSvg');
    if (!svg) return;

    const u1 = 6,  w1 = 35*u1, x1 = (420-w1)/2, y1 = 34;   // ÚLTIMA  (chica)
    const u2 = 10, w2 = 29*u2, x2 = (420-w2)/2, y2 = 98;   // LÍNEA   (grande)

    const top = layoutWord('ÚLTIMA', u1, x1, y1);
    const bot = layoutWord('LÍNEA',  u2, x2, y2);

    // desgaste: algunas celdas se pierden, otras quedan apagadas
    // Desgaste SIN perder legibilidad: NINGUNA celda se descarta, o el
    // rótulo saldría con agujeros y a veces ilegible. La pintura gastada
    // se consigue sólo repartiendo las celdas en tres tonos: sana,
    // apagada y casi comida. Todas se dibujan siempre.
    function repartir(celdas, pApagada, pComida){
      const sana = [], apagada = [], comida = [];
      celdas.forEach(c => {
        const r = Math.random();
        if (r < pComida)              comida.push(c);
        else if (r < pComida+pApagada) apagada.push(c);
        else                           sana.push(c);
      });
      return { sana, apagada, comida };
    }
    const T = repartir(top, 0.16, 0.06);
    const B = repartir(bot, 0.15, 0.05);
    const wornTop = T.sana, dimTop = T.apagada, fadeTop = T.comida;
    const wornBot = B.sana, dimBot = B.apagada, fadeBot = B.comida;

    // gotas de sangre cayendo desde las letras de abajo
    const bajos = bot.filter(c => c[1] === y2 + 6*u2);
    let chorros = '';
    for (let i=0;i<5 && bajos.length;i++){
      const c = bajos[(Math.random()*bajos.length)|0];
      const largo = u2*(1.2 + Math.random()*2.8);
      const ancho = u2*(0.45 + Math.random()*0.3);
      chorros += `<rect x="${c[0]+u2*0.3}" y="${c[1]+u2}" width="${ancho}" height="${largo}" fill="#7a1f1f" opacity="0.75"/>`;
      chorros += `<ellipse cx="${c[0]+u2*0.3+ancho/2}" cy="${c[1]+u2+largo}" rx="${ancho*0.8}" ry="${ancho*0.6}" fill="#5e1616" opacity="0.7"/>`;
    }

    // impactos de bala en la chapa
    let balazos = '';
    for (let i=0;i<3;i++){
      const bx = 30 + Math.random()*360, by = 16 + Math.random()*156;
      balazos += `<circle cx="${bx}" cy="${by}" r="3.4" fill="#080a07"/>`
              +  `<circle cx="${bx}" cy="${by}" r="4.6" fill="none" stroke="rgba(190,180,155,0.22)" stroke-width="1"/>`
              +  `<circle cx="${bx-0.8}" cy="${by-0.8}" r="1.6" fill="rgba(150,142,120,0.28)"/>`;
    }

    svg.innerHTML = `
      <defs>
        <linearGradient id="lgRust" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c08a52"/><stop offset="1" stop-color="#6b3418"/>
        </linearGradient>
        <linearGradient id="lgBone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e2dac2"/><stop offset="0.55" stop-color="#b8ae94"/><stop offset="1" stop-color="#6d6553"/>
        </linearGradient>
        <pattern id="hazard" width="14" height="14" patternTransform="rotate(115)" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#14120c"/>
          <rect width="7" height="14" fill="#4a3c18"/>
        </pattern>
      </defs>

      <!-- chapa abollada, recorte irregular -->
      <path d="M14 9 L399 6 L414 24 L411 170 L396 189 L20 186 L7 168 L9 25 Z"
            fill="#191c15" stroke="rgba(0,0,0,0.7)" stroke-width="2"/>
      <path d="M14 9 L399 6 L414 24 L411 170 L396 189 L20 186 L7 168 L9 25 Z"
            fill="none" stroke="rgba(200,192,170,0.13)" stroke-width="1"/>

      <!-- óxido comiendo los bordes -->
      <ellipse cx="34" cy="176" rx="52" ry="17" fill="#8c441c" opacity="0.3"/>
      <ellipse cx="392" cy="24" rx="40" ry="14" fill="#78391a" opacity="0.26"/>
      <ellipse cx="210" cy="188" rx="90" ry="9"  fill="#8c441c" opacity="0.18"/>

      <!-- rayones -->
      <line x1="46" y1="22" x2="163" y2="41" stroke="rgba(220,214,190,0.11)" stroke-width="1"/>
      <line x1="288" y1="160" x2="386" y2="132" stroke="rgba(220,214,190,0.09)" stroke-width="1"/>
      <line x1="88" y1="150" x2="140" y2="176" stroke="rgba(0,0,0,0.4)" stroke-width="1.4"/>

      <!-- galones despintados -->
      <g fill="rgba(176,138,82,0.42)">
        <polygon points="72,44 84,52 72,60"/><polygon points="58,44 70,52 58,60"/>
        <polygon points="348,44 336,52 348,60"/><polygon points="362,44 350,52 362,60"/>
      </g>

      <!-- ÚLTIMA: pintura oxidada -->
      <g fill="#050704" opacity="0.9">${rectsOf(top,u1,3,3)}</g>
      <g fill="url(#lgRust)">${rectsOf(wornTop,u1,0,0)}</g>
      <g fill="#7d4a1e">${rectsOf(dimTop,u1,0,0)}</g>
      <g fill="#54301a">${rectsOf(fadeTop,u1,0,0)}</g>

      <!-- sangre por detrás de LÍNEA -->
      ${chorros}

      <!-- LÍNEA: estarcido de hueso -->
      <g fill="#040603" opacity="0.92">${rectsOf(bot,u2,5,5)}</g>
      <g fill="url(#lgBone)">${rectsOf(wornBot,u2,0,0)}</g>
      <g fill="#968d76">${rectsOf(dimBot,u2,0,0)}</g>
      <g fill="#6b6455">${rectsOf(fadeBot,u2,0,0)}</g>

      <!-- salpicadura sobre las letras -->
      <ellipse cx="286" cy="118" rx="15" ry="7" fill="#7a1f1f" opacity="0.5"/>
      <ellipse cx="303" cy="128" rx="6"  ry="3.4" fill="#5e1616" opacity="0.45"/>
      <ellipse cx="120" cy="140" rx="8"  ry="4" fill="#7a1f1f" opacity="0.4"/>

      ${balazos}

      <!-- banda de peligro y placa de identificación -->
      <rect x="66" y="170" width="288" height="8" fill="url(#hazard)" opacity="0.75"/>
      <text x="210" y="186" class="logoTag" text-anchor="middle">PROTOCOLO DE CONTENCION - SECTOR 7</text>
    `;
  }
  buildLogo();

  /* ============================================================
     2. SPRITES — se arman en el primer frame, cuando el resto de
        los scripts del juego ya definieron sus paletas y grillas.
     ============================================================ */
  const sprites = {};
  let spritesReady = false;

  function bake(rows, palette){
    const c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const x = c.getContext('2d');
    for (let r=0;r<rows.length;r++){
      for (let col=0; col<rows[r].length; col++){
        const ch = rows[r][col];
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) continue;
        x.fillStyle = color;
        x.fillRect(col, r, 1, 1);
      }
    }
    return c;
  }

  function bakeSilhouette(rows, color){
    const c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const x = c.getContext('2d');
    x.fillStyle = color;
    for (let r=0;r<rows.length;r++){
      for (let col=0; col<rows[r].length; col++){
        if (rows[r][col] !== '.') x.fillRect(col, r, 1, 1);
      }
    }
    return c;
  }

  function buildSprites(){
    if (spritesReady) return;
    try {
      // etapa 0 = sano; si mañana cambian las rejillas de daño esto las sigue
      const headRows  = (typeof playerHeadRows  === 'function') ? playerHeadRows(0)  : CAT_HEAD;
      const torsoRows = (typeof playerTorsoRows === 'function') ? playerTorsoRows(0) : CAT_TORSO;
      sprites.catHead       = bake(headRows,     CAT_PALETTE);
      sprites.catTorso      = bake(torsoRows,    CAT_PALETTE);
      sprites.catNeck       = bake(CAT_NECK,     CAT_PALETTE);
      sprites.catLeg        = bake(CAT_LEG,      CAT_PALETTE);
      sprites.catArm        = bake(CAT_ARM,      CAT_PALETTE);
      sprites.catPaw        = bake(CAT_PAW,      CAT_PALETTE);
      sprites.catArmBackDim = bake(CAT_ARM_BACK, CAT_PALETTE_DIM);
      sprites.catPawDim     = bake(CAT_PAW,      CAT_PALETTE_DIM);
      sprites.gun           = bake(GUN_GRID,     GUN_PALETTE);
      spritesReady = true;
    } catch(e){
      spritesReady = false;
      return;
    }

    // los zombies del fondo son opcionales: si sus rejillas cambian de nombre
    // el protagonista se sigue dibujando igual
    try {
      sprites.walker    = bakeSilhouette(ZOMBIE_HEAD.concat(ZOMBIE_TORSO), '#0a0f0c');
      sprites.walkerLeg = bakeSilhouette(ZOMBIE_LEG, '#0a0f0c');
    } catch(e){}
  }

  // dibuja anclado abajo y centrado (mismo criterio que el renderer del juego)
  // pivote en (0,0) hacia +x, centrado en vertical (= drawGunSprite del juego)
  function blitGun(img, px){
    const w = img.width*px, h = img.height*px;
    g.drawImage(img, 0, -h/2, w, h);
  }

  function blitBottom(img, px, flip){
    const w = img.width*px, h = img.height*px;
    if (flip){
      g.save(); g.scale(-1,1);
      g.drawImage(img, -w/2, -h, w, h);
      g.restore();
    } else {
      g.drawImage(img, -w/2, -h, w, h);
    }
  }

  /* ============================================================
     3. ESCENA
     ============================================================ */
  function makeSkyline(opts){
    const arr = [];
    let x = -50;
    while (x < MW+70){
      const w = rnd(opts.wMin, opts.wMax);
      const h = rnd(opts.hMin, opts.hMax);
      const b = { x, w, h, top: [], win: [], mast: Math.random() < 0.22 };
      const segs = 3 + (Math.random()*4|0);
      for (let i=0;i<=segs;i++) b.top.push(Math.random()*opts.jag);
      if (opts.windows){
        const wc = Math.max(1, Math.floor(w/15));
        const wr = Math.max(1, Math.floor(h/23));
        for (let r=0;r<wr;r++){
          for (let c=0;c<wc;c++){
            if (Math.random() < 0.55){
              b.win.push({
                dx: 6+c*15, dy: 15+r*23,
                lit: Math.random() < 0.14,
                ph: Math.random()*Math.PI*2,
                sp: 1.2 + Math.random()*3
              });
            }
          }
        }
      }
      arr.push(b);
      x += w + rnd(3, 22);
    }
    return arr;
  }

  const far  = makeSkyline({ wMin:44, wMax:110, hMin:120, hMax:280, jag:24, windows:false });
  const near = makeSkyline({ wMin:38, wMax:92,  hMin:70,  hMax:200, jag:16, windows:true  });

  const fires = [];
  for (let i=0;i<5;i++) fires.push({ x: rnd(60, MW-60), flick: rnd(0,6.28), t: rnd(0,0.3), r: rnd(120,210) });

  const smoke = [];
  for (let i=0;i<16;i++) smoke.push({ x: rnd(-60, MW+60), y: rnd(60, HORIZON), r: rnd(40,95), vx: rnd(-6,6), vy: rnd(5,13) });

  const embers = [];
  const ash = [];
  for (let i=0;i<48;i++) ash.push({ x: rnd(0,MW), y: rnd(0,MH), vy: rnd(7,20), vx: rnd(-8,8), s: rnd(0.7,1.7), a: rnd(0.08,0.26) });

  const rain = [];
  for (let i=0;i<90;i++) rain.push({ x: rnd(-40,MW), y: rnd(-40,MH), len: rnd(9,20), sp: rnd(420,700) });

  const cracks = [];
  for (let i=0;i<26;i++) cracks.push({ x: rnd(0,MW), y: HORIZON + rnd(6,120), len: rnd(14,44), rot: rnd(-0.5,0.5), stain: Math.random()<0.35 });

  const rubble = [];
  for (let i=0;i<22;i++) rubble.push({ x: rnd(0,MW), y: HORIZON + rnd(-2,26), w: rnd(16,46), h: rnd(7,20) });

  // charcos y salpicaduras de sangre en el asfalto: alguien murió aquí
  const bloodPools = [];
  for (let i=0;i<8;i++){
    const gotas = [];
    const n = 3 + (Math.random()*5|0);
    for (let k=0;k<n;k++) gotas.push({ dx: rnd(-38,38), dy: rnd(-11,11), r: rnd(1.4,4.2) });
    bloodPools.push({
      x: rnd(40, MW-40), y: HORIZON + rnd(16, 112),
      rx: rnd(13,38), ry: rnd(4.5,12), rot: rnd(-0.45,0.45),
      a: rnd(0.3,0.55), gotas,
      arrastre: Math.random() < 0.4 ? rnd(26,70) : 0
    });
  }

  // casquillos usados repartidos por el suelo
  const casquillos = [];
  for (let i=0;i<16;i++) casquillos.push({
    x: rnd(30, MW-30), y: HORIZON + rnd(24, 118),
    w: rnd(2.4,4), h: rnd(1.2,1.8), rot: rnd(-1.6,1.6)
  });

  const walkers = [];
  for (let i=0;i<4;i++) walkers.push({ x: rnd(0,MW), sp: rnd(7,14)*(Math.random()<0.5?-1:1), px: rnd(1.25,1.7), bob: rnd(0,6.28) });

  let flashA = 0, flashTimer = rnd(4,9), bolt = null;
  let glintTimer = rnd(2,5), glintT = 0;

  function makeBolt(){
    const sx = rnd(80, MW-80);
    const endY = rnd(160, 300);
    const pts = [{x:sx, y:-10}];
    const segs = 6 + (Math.random()*4|0);
    let x = sx;
    for (let i=1;i<=segs;i++){
      x += rnd(-40,40);
      pts.push({ x, y: (endY/segs)*i });
    }
    return pts;
  }

  /* ---------- update ---------- */
  function update(dt, t){
    smoke.forEach(s => {
      s.x += s.vx*dt; s.y -= s.vy*dt;
      if (s.y < -110){ s.y = HORIZON + rnd(0,40); s.x = rnd(-60, MW+60); }
      if (s.x < -140) s.x = MW+140;
      if (s.x > MW+140) s.x = -140;
    });

    fires.forEach(f => {
      f.flick += dt*4.2;
      f.t -= dt;
      if (f.t <= 0){
        f.t = 0.1 + Math.random()*0.24;
        if (embers.length < 90){
          embers.push({ x: f.x + rnd(-16,16), y: HORIZON + rnd(-4,10), vx: rnd(-14,14), vy: rnd(-58,-26), life: rnd(1.1,2.1), max: 2.1, s: rnd(1.1,2.2) });
        }
      }
    });
    for (let i=embers.length-1;i>=0;i--){
      const e = embers[i];
      e.x += e.vx*dt; e.y += e.vy*dt; e.vy -= 12*dt; e.vx *= 0.985; e.life -= dt;
      if (e.life <= 0) embers.splice(i,1);
    }

    ash.forEach(a => {
      a.y += a.vy*dt; a.x += a.vx*dt + Math.sin((t + a.x)*0.6)*4*dt;
      if (a.y > MH+6){ a.y = -6; a.x = rnd(0,MW); }
      if (a.x < -8) a.x = MW+8; if (a.x > MW+8) a.x = -8;
    });

    rain.forEach(r => {
      r.y += r.sp*dt; r.x += r.sp*0.22*dt;
      if (r.y > MH){ r.y = rnd(-60,-10); r.x = rnd(-60, MW); }
    });

    walkers.forEach(w => {
      w.x += w.sp*dt;
      w.bob += dt*2.6;
      if (w.x < -40) w.x = MW+40;
      if (w.x > MW+40) w.x = -40;
    });

    flashTimer -= dt;
    if (flashTimer <= 0){
      flashA = rnd(0.35, 0.6);
      flashTimer = rnd(7, 16);
      bolt = makeBolt();
    }
    if (flashA > 0) flashA = Math.max(0, flashA - dt*2.1);

    glintTimer -= dt;
    if (glintTimer <= 0){ glintT = 0.45; glintTimer = rnd(4.0, 8.0); }
    if (glintT > 0) glintT -= dt;
  }

  /* ---------- draw ---------- */
  function drawSkyline(list, baseY, fill, winAlpha, t){
    g.fillStyle = fill;
    list.forEach(b => {
      const topY = baseY - b.h;
      const segW = b.w / (b.top.length-1);
      g.beginPath();
      g.moveTo(b.x, baseY);
      g.lineTo(b.x, topY + b.top[0]);
      b.top.forEach((v,i) => g.lineTo(b.x + i*segW, topY + v));
      g.lineTo(b.x + b.w, baseY);
      g.closePath();
      g.fill();
      if (b.mast){
        g.fillRect(b.x + b.w*0.5 - 1, topY - 22, 2, 22);
        g.fillRect(b.x + b.w*0.5 - 5, topY - 14, 10, 2);
      }
    });
    if (!winAlpha) return;
    list.forEach(b => {
      const topY = baseY - b.h;
      b.win.forEach(w => {
        if (w.lit){
          const fl = 0.5 + 0.5*Math.sin(t*w.sp + w.ph);
          g.fillStyle = `rgba(255,186,66,${0.55*fl*winAlpha})`;
        } else {
          g.fillStyle = `rgba(3,6,4,${0.8*winAlpha})`;
        }
        g.fillRect(b.x + w.dx, topY + w.dy, 5, 7);
      });
    });
  }

  // ---- protagonista: réplica exacta del ensamblaje de drawPlayer() ----
  //  Se escala el contexto entero por CAT_SCALE y desde ahí se repiten las
  //  MISMAS coordenadas que usa renderer.js. Las piezas van por separado
  //  (brazo trasero, piernas, torso, cuello, cabeza con su propia escala de
  //  bloque, y la cadena del arma), así la figura del menú no puede
  //  desalinearse aunque cambien las rejillas o las escalas del sprite.
  const CAT_SCALE = 1.4;

  function drawCat(t){
    if (!spritesReady) return;

    const breathe = Math.sin(t*1.75)*1.1;
    const sway    = Math.sin(t*0.62)*1.2;
    const angle   = -0.05 + Math.sin(t*1.1)*0.04;      // vaivén del arma en reposo
    const legsH   = CAT_LEG.length*CAT_PX;
    const torsoH  = CAT_TORSO.length*CAT_PX;
    const headTop = (legsH + torsoH - 5) + CAT_NECK.length*CAT_PX - 3 + CAT_HEAD.length*CAT_HEAD_PX;
    const totalH  = headTop*CAT_SCALE;

    // sombra en el asfalto
    g.save();
    g.globalAlpha = 0.42;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(CAT_X + sway, CAT_FLOOR + 3, 26*CAT_SCALE, 7, 0, 0, Math.PI*2);
    g.fill();
    g.restore();

    // resplandor cálido del incendio detrás de la silueta
    const glow = g.createRadialGradient(CAT_X, CAT_FLOOR - totalH*0.5, 6, CAT_X, CAT_FLOOR - totalH*0.5, 115);
    glow.addColorStop(0, 'rgba(255,150,50,0.17)');
    glow.addColorStop(1, 'rgba(255,150,50,0)');
    g.fillStyle = glow;
    g.fillRect(CAT_X-125, CAT_FLOOR-totalH-45, 250, totalH+90);

    g.save();
    g.translate(CAT_X + sway, CAT_FLOOR);
    g.scale(CAT_SCALE, CAT_SCALE);

    // 1 · brazo de apoyo en penumbra, por detrás del cuerpo
    g.save();
    g.translate(3, -GUN_Y_OFFSET + 4 + breathe);
    g.rotate(angle);
    g.translate(-4, 7);
    blitGun(sprites.catArmBackDim, CAT_PX);
    g.translate(22, 0);
    blitGun(sprites.catPawDim, CAT_PX);
    g.restore();

    // 2 · piernas (quietas: es una pose idle, no está caminando)
    g.save(); g.translate(-6, 0); blitBottom(sprites.catLeg, CAT_PX, false); g.restore();
    g.save(); g.translate( 6, 0); blitBottom(sprites.catLeg, CAT_PX, false); g.restore();

    // 3 · torso (respira)
    g.save();
    g.translate(0, -legsH + 2 + breathe);
    blitBottom(sprites.catTorso, CAT_PX, false);
    g.restore();

    // 4 · cuello: pieza puente entre el chaleco y la cabeza
    g.save();
    g.translate(2, -(legsH + torsoH - 5) + breathe);
    blitBottom(sprites.catNeck, CAT_PX, false);
    g.restore();

    // 5 · cabeza: escala de bloque propia, más fina
    g.save();
    g.translate(3, -(legsH + torsoH - 5) - CAT_NECK.length*CAT_PX + 3 + breathe);
    blitBottom(sprites.catHead, CAT_HEAD_PX, false);
    if (glintT > 0){
      // destello ocasional recorriendo las lentes del visor
      const hw = CAT_HEAD[0].length*CAT_HEAD_PX, hh = CAT_HEAD.length*CAT_HEAD_PX;
      g.fillStyle = 'rgba(226,255,255,' + Math.min(0.9, glintT*2.0) + ')';
      [[14,12],[14,13],[15,12],[14,21]].forEach(rc => {
        g.fillRect(rc[1]*CAT_HEAD_PX - hw/2, rc[0]*CAT_HEAD_PX - hh, CAT_HEAD_PX, CAT_HEAD_PX);
      });
    }
    g.restore();

    // 6 · cadena del arma: hombro -> manga -> arma -> mano en la culata
    g.save();
    g.translate(3, -GUN_Y_OFFSET + 4 + breathe);
    g.rotate(angle);
    g.save(); g.translate(-2, 2); blitGun(sprites.catArm, CAT_PX); g.restore();
    blitGun(sprites.gun, GUN_PX);
    g.save(); g.translate(5, 3); blitGun(sprites.catPaw, CAT_PX); g.restore();
    // piloto verde en la boca del cañón
    const gw = sprites.gun.width*GUN_PX;
    g.fillStyle = 'rgba(125,255,77,' + (0.4 + 0.4*Math.sin(t*3.1)) + ')';
    g.fillRect(gw - GUN_PX*2, -GUN_PX/2, GUN_PX, GUN_PX);
    g.restore();

    g.restore();
  }

  function drawWalkers(t){
    if (!sprites.walker || !sprites.walkerLeg) return;
    walkers.forEach(w => {
      const y = HORIZON + 6;
      g.save();
      g.globalAlpha = 0.55;
      g.translate(w.x, y + Math.sin(w.bob)*1.2);
      const legH = sprites.walkerLeg.height*w.px;
      g.save(); g.translate(-w.px*3, 0); blitBottom(sprites.walkerLeg, w.px, false); g.restore();
      g.save(); g.translate( w.px*3, 0); blitBottom(sprites.walkerLeg, w.px, false); g.restore();
      g.save(); g.translate(0, -legH); blitBottom(sprites.walker, w.px, w.sp < 0); g.restore();
      g.restore();
    });
    g.globalAlpha = 1;
  }

  function draw(t){
    // cielo
    const sky = g.createLinearGradient(0,0,0,HORIZON);
    sky.addColorStop(0,   '#070b09');
    sky.addColorStop(0.45,'#101a14');
    sky.addColorStop(0.82,'#1d2a1e');
    sky.addColorStop(1,   '#2a2f22');
    g.fillStyle = sky;
    g.fillRect(0,0,MW,HORIZON+2);

    // halo tóxico sobre el horizonte
    const haze = g.createRadialGradient(MW*0.5, HORIZON, 20, MW*0.5, HORIZON, 420);
    haze.addColorStop(0, 'rgba(125,255,77,0.08)');
    haze.addColorStop(1, 'rgba(125,255,77,0)');
    g.fillStyle = haze;
    g.fillRect(0,0,MW,HORIZON+2);

    drawSkyline(far, HORIZON+4, 'rgba(11,17,14,0.92)', 0, t);

    // banda de niebla baja
    const fog = g.createLinearGradient(0, HORIZON-120, 0, HORIZON+10);
    fog.addColorStop(0, 'rgba(60,72,58,0)');
    fog.addColorStop(1, 'rgba(60,72,58,0.22)');
    g.fillStyle = fog;
    g.fillRect(0, HORIZON-120, MW, 130);

    drawSkyline(near, HORIZON+4, 'rgba(7,11,9,0.96)', 1, t);

    // incendios lejanos
    fires.forEach(f => {
      const fl = 0.62 + 0.38*Math.sin(f.flick);
      const gr = g.createRadialGradient(f.x, HORIZON-14, 6, f.x, HORIZON-14, f.r*fl);
      gr.addColorStop(0, `rgba(255,116,32,${0.3*fl})`);
      gr.addColorStop(1, 'rgba(255,116,32,0)');
      g.fillStyle = gr;
      g.fillRect(f.x - f.r, HORIZON - f.r, f.r*2, f.r*1.4);
    });

    // humo
    smoke.forEach(s => {
      const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      gr.addColorStop(0, 'rgba(74,74,66,0.17)');
      gr.addColorStop(1, 'rgba(74,74,66,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI*2); g.fill();
    });

    drawWalkers(t);

    // asfalto
    g.fillStyle = '#26282a';
    g.fillRect(0, HORIZON+2, MW, MH-HORIZON);
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.fillRect(0, HORIZON+4, MW, 3);
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0,HORIZON+2); g.lineTo(MW,HORIZON+2); g.stroke();

    cracks.forEach(c => {
      if (c.stain){
        g.fillStyle = 'rgba(8,8,8,0.32)';
        g.beginPath(); g.ellipse(c.x, c.y, c.len*0.7, c.len*0.3, c.rot, 0, Math.PI*2); g.fill();
      } else {
        g.save();
        g.translate(c.x, c.y); g.rotate(c.rot);
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-c.len/2,0); g.lineTo(c.len/2,0); g.stroke();
        g.restore();
      }
    });

    // sangre seca en el asfalto
    bloodPools.forEach(b => {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      if (b.arrastre){
        // marca de arrastre saliendo del charco
        const gr = g.createLinearGradient(0,0,b.arrastre,0);
        gr.addColorStop(0, `rgba(74,14,14,${b.a*0.8})`);
        gr.addColorStop(1, 'rgba(74,14,14,0)');
        g.fillStyle = gr;
        g.fillRect(0, -b.ry*0.42, b.arrastre, b.ry*0.84);
      }
      g.fillStyle = `rgba(82,16,16,${b.a})`;
      g.beginPath(); g.ellipse(0, 0, b.rx, b.ry, 0, 0, Math.PI*2); g.fill();
      g.fillStyle = `rgba(120,26,26,${b.a*0.75})`;
      g.beginPath(); g.ellipse(-b.rx*0.18, -b.ry*0.14, b.rx*0.52, b.ry*0.5, 0, 0, Math.PI*2); g.fill();
      g.fillStyle = `rgba(74,14,14,${b.a*0.85})`;
      b.gotas.forEach(d => { g.beginPath(); g.ellipse(d.dx, d.dy, d.r, d.r*0.7, 0, 0, Math.PI*2); g.fill(); });
      g.restore();
    });

    // casquillos: latón mate con un punto de luz
    casquillos.forEach(c => {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.rot);
      g.fillStyle = 'rgba(122,96,42,0.75)';
      g.fillRect(-c.w/2, -c.h/2, c.w, c.h);
      g.fillStyle = 'rgba(198,166,92,0.55)';
      g.fillRect(-c.w/2, -c.h/2, c.w*0.55, c.h*0.5);
      g.restore();
    });

    // línea central discontinua
    g.fillStyle = 'rgba(255,206,90,0.13)';
    for (let x=-20; x<MW+40; x+=48) g.fillRect(x, HORIZON+62, 24, 3);

    // escombros en primer plano
    g.fillStyle = 'rgba(20,18,15,0.92)';
    rubble.forEach(r => {
      g.beginPath();
      g.moveTo(r.x, r.y);
      g.lineTo(r.x + r.w*0.22, r.y - r.h);
      g.lineTo(r.x + r.w*0.55, r.y - r.h*0.65);
      g.lineTo(r.x + r.w*0.8,  r.y - r.h);
      g.lineTo(r.x + r.w, r.y);
      g.closePath(); g.fill();
    });

    drawCat(t);

    // brasas
    embers.forEach(e => {
      const a = clamp01(e.life/e.max);
      g.globalAlpha = a*0.9;
      g.fillStyle = a > 0.55 ? '#ffd066' : '#ff6b2a';
      g.beginPath(); g.arc(e.x, e.y, e.s, 0, Math.PI*2); g.fill();
    });
    g.globalAlpha = 1;

    // lluvia
    g.strokeStyle = 'rgba(176,200,190,0.14)';
    g.lineWidth = 1;
    g.beginPath();
    rain.forEach(r => { g.moveTo(r.x, r.y); g.lineTo(r.x - r.len*0.22, r.y + r.len); });
    g.stroke();

    // ceniza
    ash.forEach(a => {
      g.globalAlpha = a.a;
      g.fillStyle = '#cfd6c4';
      g.fillRect(a.x, a.y, a.s, a.s);
    });
    g.globalAlpha = 1;

    // relámpago
    if (flashA > 0){
      if (bolt){
        g.save();
        g.strokeStyle = `rgba(226,238,255,${Math.min(1, flashA*1.7)})`;
        g.lineWidth = 2.2; g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(bolt[0].x, bolt[0].y);
        bolt.forEach(p => g.lineTo(p.x, p.y));
        g.stroke();
        g.restore();
      }
      g.fillStyle = `rgba(206,222,255,${flashA*0.5})`;
      g.fillRect(0,0,MW,MH);
    }
  }

  /* ============================================================
     4. BUCLE (se apaga solo cuando el menú deja de estar en pantalla)
     ============================================================ */
  let raf = null, last = 0, t = 0, alive = false;

  function frame(ts){
    if (!last) last = ts;
    let dt = (ts-last)/1000;
    if (dt > 0.05) dt = 0.05;
    last = ts;
    t += dt;
    buildSprites();
    update(dt, t);
    draw(t);
    raf = requestAnimationFrame(frame);
  }
  function start(){ if (alive) return; alive = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop(){ alive = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  /* ============================================================
     5. ENTRAR Y SALIR DEL MENÚ
     ============================================================ */

  // deja el juego quieto y devuelve el menú a pantalla
  function openMenu(){
    try {
      running = false;
      paused  = false;
      inShop  = false;
      firing  = false;
      keys.left = false;
      keys.right = false;
    } catch(e){}
    overlayEl.classList.add('hidden');
    overlayEl.innerHTML = '';
    if (helpPanel) helpPanel.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    start();
  }

  // arranca una partida nueva (misma llamada que hacía el botón original)
  function launchGame(){
    stop();
    menuScreen.classList.add('hidden');
    overlayEl.classList.add('hidden');
    overlayEl.innerHTML = '';
    if (typeof initGame === 'function') initGame();
  }

  const helpPanel = document.getElementById('helpDetails');

  // pausa y game over reescriben #overlay: les colgamos el botón de volver
  const overlayObs = new MutationObserver(() => {
    if (overlayEl.classList.contains('hidden')) return;
    if (overlayEl.querySelector('.toMenuBtn')) return;
    const isPause = !!overlayEl.querySelector('#resumeBtn');
    const isOver  = !!overlayEl.querySelector('#startBtn');
    if (!isPause && !isOver) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toMenuBtn';
    b.textContent = isPause ? 'SALIR AL MENÚ' : 'MENÚ PRINCIPAL';
    b.addEventListener('click', openMenu);
    overlayEl.appendChild(b);
  });
  overlayObs.observe(overlayEl, { childList:true, subtree:true });

  start();

  /* ============================================================
     6. MÓDULOS TODAVÍA NO DISPONIBLES
     ============================================================ */
  const toast = document.getElementById('menuToast');
  let toastT = null;

  document.querySelectorAll('.menuBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof playClickSound === 'function') { try { playClickSound(); } catch(e){} }
      // Ajustes ya es funcional: abre el panel de sonido en vez del aviso
      if (btn.dataset.mod === 'Ajustes' && typeof window.__openSoundSettings === 'function'){
        window.__openSoundSettings();
        return;
      }
      // Bestiario: fichas de enemigos (bestiary.js)
      if (btn.dataset.mod === 'El bestiario' && typeof window.__openBestiary === 'function'){
        window.__openBestiary();
        return;
      }
      btn.classList.remove('shake');
      void btn.offsetWidth;               // reinicia la animación
      btn.classList.add('shake');
      if (!toast) return;
      toast.textContent = (btn.dataset.mod || 'Este módulo') + ' abre en la próxima actualización';
      toast.classList.add('show');
      clearTimeout(toastT);
      toastT = setTimeout(() => toast.classList.remove('show'), 2200);
    });
  });

  const play = document.getElementById('btnPlayMain');
  if (play){
    play.addEventListener('pointerenter', () => {
      if (typeof playClickSound === 'function') { try { playClickSound(); } catch(e){} }
    });
    play.addEventListener('click', () => {
      try { launchGame(); } catch(err){ report('launchGame', err); }
    });
  }

  /* ============================================================
     7. RED DE SEGURIDAD
     Si update() o render() lanzan una excepción, el bucle original
     de game.js muere en silencio y la pantalla queda en negro para
     siempre. Los envolvemos para que el bucle nunca se corte y para
     poder ver en pantalla qué falló.
     ============================================================ */
  let diagBox = null;
  function report(where, err){
    const msg = where + ': ' + (err && err.message ? err.message : err);
    if (!diagBox){
      diagBox = document.createElement('div');
      diagBox.style.cssText = [
        'position:absolute','left:8px','bottom:8px','z-index:60','max-width:520px',
        'padding:8px 10px','background:rgba(20,4,6,0.94)','border:1px solid #ff2d4e',
        'color:#ff8a9a','font:11px/1.5 "Courier New",monospace','white-space:pre-wrap',
        'pointer-events:none'
      ].join(';');
      const host = document.getElementById('gameArea') || document.body;
      host.appendChild(diagBox);
    }
    if (diagBox.dataset.msg !== msg){
      diagBox.dataset.msg = msg;
      diagBox.textContent = 'ERROR — ' + msg;
      console.error(where, err);
    }
  }

  if (typeof window.update === 'function'){
    const origUpdate = window.update;
    window.update = function(dt){
      try { origUpdate(dt); } catch(err){ report('update', err); }
    };
  }
  if (typeof window.render === 'function'){
    const origRender = window.render;
    window.render = function(){
      try { origRender(); } catch(err){ report('render', err); }
    };
  }

  window.addEventListener('error', (e) => {
    report((e.filename || '').split('/').pop() + ':' + e.lineno, e.message);
  });

})();
