// =====================================================================
//  AUTOS DE FONDO — capa intermedia entre los edificios y la calle
//  ---------------------------------------------------------------
//  Autos abandonados y destrozados por el caos, notablemente más grandes
//  que los zombies y el jugador (un auto real es más grande que una
//  persona), con daño en capas: óxido, abolladuras, ventanas rotas,
//  capó reventado, ruedas hundidas en el asfalto, maleza creciendo entre
//  las grietas, pilas de chatarra al lado, y algunos ardiendo con
//  llamas de colores distintos. Se dibujan como el resto del juego: un
//  grid de caracteres + paleta, cacheados con drawSpriteCached.
// =====================================================================

let cars = [];

const CAR_PX = 4.6;

// ---- sedán (44x22) ----
const CAR_SEDAN = [
    "............................................",
    "............................................",
    "...........KKKKKKKKKKKKKKKKKKKKK............",
    "........KKKWDDWWWWWWWWWDDWWWWWWWKKK.........",
    ".......KWWWWDDWWWWWWWWWDDWWWWWWWWWWK........",
    "......KHWWWwDDwwwwwwwwwDDwwwwwwwWWWDK.......",
    "....KKHBwwwBBBBBBBBBBBBBBBBBBBBBwwwDDKK.....",
    "...KHHBBBBBBBBBBBBBBBBBBBBBBBBBBBBBDDHHK....",
    "..KHBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBwBBHKK..",
    ".KHBBBBBBBBBBBBBBBBBSBBBBBBBBBSBBBBBBBBBHHKK",
    "KHBBBBBBBBBBBBBBBBBBSBBBBBBBBBSBBBBBBBBBBBHH",
    "HBBBBBBBBBBBBBBBBBBBSBBBBBBBBBSBBBBBBBBBBBBB",
    "BBBBBBBBBSSSBBBBBBBBSBBBBBBBBBSBBSSSBBBBBBBB",
    "BAAABBBBSSTSSBBBBBBBSBBBBBBBBBSBSSTSSBBBQQQB",
    "SAAASSSTTTTTTTSSSSSSSSSSSSSSSSSTTTTTTTSSQQQS",
    "SSSSSSTTTTtTTTTSSSSSSSSSSSSSSSTTTTtTTTTSSSSS",
    "SgggSSTTtttttTTSSSSSSSSSSSSSSSTTtttttTTSgggS",
    "GGGGGTTTtttttTTT.............TTTtttttTTTGGGG",
    ".....TTtttTtttTT.............TTtttTtttTT....",
    ".....TTTtttttTTT.............TTTtttttTTT....",
    "......TTtttttTT...............TTtttttTT.....",
    "......TTTTtTTTT...............TTTTtTTTT....."
];

// ---- camioneta / SUV (40x27), más alta y cuadrada ----
const CAR_VAN = [
    "........................................",
    "........................................",
    ".....KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK....",
    "....KWWWWWDDWWWWWWWDDWWWWWWWDDWWWWWHK...",
    "...KHWWWWWDDWWWWWWWDDWWWWWWWDDWWWWWBHK..",
    "..KHBWWWWWDDWWWWWWWDDWWWWWWWDDWWWWWBBHK.",
    ".KHBBWWWWWDDWWWWWWWDDWWWWWWWDDWWWWWBBBHK",
    "KHBBBwwwwwDDwwwwwwwDDwwwwwwwDDwwwwwBBBBH",
    "HBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBBSBBBBBBBBSBBBBBBBBBBBBBB",
    "BBBBBBBBBBBBBBBBSBBBBBBBBSBBBBBBBBBBBBBB",
    "BBBBBBBBBSBBBBBBSBBBBBBBBSBBBBBSBBBBBBBB",
    "BAAABBBBSSSBBBBBSBBBBBBBBSBBBBSSSBBBQQQB",
    "SAAASSSSSTSSSSSSSSSSSSSSSSSSSSSTSSSSQQQS",
    "SSSSSSTTTTTTTSSSSSSSSSSSSSSSTTTTTTTSSSSS",
    "SSSSSTTTTtTTTTSSSSSSSSSSSSSTTTTtTTTTSSSS",
    "SggSSTTtttttTTSSSSSSSSSSSSSTTtttttTTSggS",
    "GGGGTTTtttttTTT...........TTTtttttTTTGGG",
    "....TTtttTtttTT...........TTtttTtttTT...",
    "....TTTtttttTTT...........TTTtttttTTT...",
    ".....TTtttttTT.............TTtttttTT....",
    ".....TTTTtTTTT.............TTTTtTTTT....",
    "......TTTTTTT...............TTTTTTT....."
];

const CAR_TYPES = [CAR_SEDAN, CAR_VAN];

// ---- paletas: varios colores de carrocería, todas con el mismo esquema ----
function carPalette(body, bodyLight, bodyShadow){
  return {
    K:'#0a0a0a', W:'#5b6a72', w:'#2a343a', D:'#141414', n:'#050505', c:'#dfeaea',
    H:bodyLight, B:body, S:bodyShadow,
    G:'#161616', g:'#3a3a3a',
    A:'#ffcf6b', Q:'#d8342a',
    T:'#050505', t:'#4a4a4a',
    r:'#8a5a2a', x:'#3a2a10',
    X:'#7a1414', v:'#3d0a0a',
    M:'#0a0a0a', p:'#8a8f92',
    s:'#6a2a2a'
  };
}

const CAR_PALETTES = [
  carPalette('#7a2a24', '#a8443a', '#4a1712'),   // rojo óxido
  carPalette('#2a4a5e', '#447088', '#152530'),   // azul petróleo
  carPalette('#3a4a2e', '#5a7048', '#20281a'),   // verde militar
  carPalette('#5c5636', '#8a7f4c', '#332f1d'),   // beige polvoriento
  carPalette('#39434a', '#5c6a72', '#1f252a')    // gris azulado
];

// ============================================================ DAÑO ======
//  El caos se nota: cada auto lleva óxido (siempre), y probablemente
//  abolladuras, ventanas rotas o el capó reventado. Todo se aplica con
//  applyOverlay, igual que las heridas de los zombies o el blindaje del
//  jefe: son coordenadas que se calculan una vez, al generar el auto, y
//  se cachean como si fueran un sprite más.

// óxido: pecas esparcidas por la carrocería, con más peso cerca de las
// ruedas y el filo del techo (donde el agua se acumula y come la chapa)
function carRust(grid, count){
  const rows = grid.length;
  const cand = [];
  grid.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === 'B' || ch === 'S' || ch === 'H') {
        const weight = r > rows * 0.6 ? 3 : (r < rows * 0.35 ? 2 : 1);
        for (let k = 0; k < weight; k++) cand.push([r, c]);
      }
    });
  });
  const picks = [];
  for (let i = 0; i < count && cand.length; i++) {
    const [r, c] = cand[Math.floor(Math.random() * cand.length)];
    picks.push([r, c, Math.random() < 0.55 ? 'r' : 'x']);
  }
  return picks;
}

// abolladura: un parche irregular oscurecido en un panel de la carrocería
function carDent(grid){
  const rows = grid.length, cols = grid[0].length;
  const w = 3 + Math.floor(Math.random() * 4), h = 2 + Math.floor(Math.random() * 2);
  const c0 = 4 + Math.floor(Math.random() * Math.max(1, cols - w - 8));
  const r0 = Math.floor(rows * 0.42) + Math.floor(Math.random() * Math.floor(rows * 0.22));
  const coords = [];
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) {
      if (Math.random() < 0.75 && grid[r] && (grid[r][c] === 'B' || grid[r][c] === 'H' || grid[r][c] === 'S')) {
        coords.push([r, c, 'x']);
      }
    }
  }
  return coords;
}

// ventanas rotas: un tramo se vuelve cavidad negra, con una grieta al lado
function carBrokenWindows(grid){
  const coords = [];
  grid.forEach((row, r) => {
    [...row].forEach((ch, c) => { if (ch === 'W' || ch === 'w') coords.push([r, c]); });
  });
  if (!coords.length) return [];
  const start = Math.floor(Math.random() * Math.max(1, coords.length - 5));
  const span = coords.slice(start, start + 4 + Math.floor(Math.random() * 5));
  const out = span.map(([r, c]) => [r, c, 'n']);
  if (span.length) {
    const [r0, c0] = span[0];
    if (grid[r0-1] && grid[r0-1][c0] === 'K') out.push([r0-1, c0, 'c']);
  }
  return out;
}

// capó reventado: el filo delantero se vuelve una cavidad oscura con un
// par de destellos de metal — coordenadas relativas a cada tipo de auto
// rueda faltante: se escanean las celdas T/t (neumático/llanta) del propio
// grid y se borra un lado completo, dejando sólo un pequeño eje expuesto.
// El auto además se asienta inclinado hacia ese lado (ver spawnCars).
function carMissingWheel(grid, side){
  const cols = grid[0].length, half = cols / 2;
  const cells = [];
  grid.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if ((ch === 'T' || ch === 't') && ((side === 'left' && c < half) || (side === 'right' && c >= half))) {
        cells.push([r, c]);
      }
    });
  });
  if (!cells.length) return [];
  const cs = cells.map(p => p[1]), rs = cells.map(p => p[0]);
  const cx = Math.round(cs.reduce((a, b) => a + b, 0) / cs.length);
  const rTop = Math.min(...rs);
  const out = cells.map(([r, c]) => [r, c, '.']);
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = -1; dc <= 1; dc++) out.push([rTop + 1 + dr, cx + dc, 'x']);
  }
  return out;
}

const CAR_HOOD_DAMAGE = [
  // sedán: parte delantera (columnas bajas)
  [[8,3,'M'],[8,4,'M'],[9,3,'M'],[9,4,'M'],[9,5,'M'],[10,3,'p'],[10,5,'M'],[11,4,'p']],
  // van: morro más corto y alto
  [[9,3,'M'],[9,4,'M'],[10,3,'M'],[10,4,'M'],[10,5,'M'],[11,3,'p'],[11,5,'M'],[12,4,'p']]
];

// sangre sobre la carrocería: un impacto y su reguero cayendo, más alguna
// mancha suelta. Se limita a los paneles (no pisa vidrios ni ruedas) para
// que se lea como pintura manchada y no como un fallo del sprite.
function carBloodSplatter(grid){
  const rows = grid.length, cols = grid[0].length;
  const paint = (r, c) => grid[r] && ['B','H','S','r','x'].includes(grid[r][c]);
  const out = [];
  const blots = 1 + Math.floor(Math.random() * 2);
  for (let b = 0; b < blots; b++) {
    const c0 = 3 + Math.floor(Math.random() * (cols - 8));
    const r0 = Math.floor(rows * 0.3) + Math.floor(Math.random() * Math.floor(rows * 0.3));
    // núcleo del impacto
    for (let r = r0; r < r0 + 2; r++) {
      for (let c = c0; c < c0 + 3; c++) {
        if (paint(r, c) && Math.random() < 0.8) out.push([r, c, Math.random() < 0.6 ? 'X' : 'v']);
      }
    }
    // reguero: cae hacia abajo perdiendo intensidad
    let c = c0 + 1;
    for (let r = r0 + 2; r < Math.min(rows, r0 + 2 + 3 + Math.floor(Math.random() * 4)); r++) {
      if (Math.random() < 0.35) c += Math.random() < 0.5 ? -1 : 1;
      if (paint(r, c)) out.push([r, c, 'v']);
    }
    // salpicaduras sueltas alrededor
    for (let i = 0; i < 3; i++) {
      const rr = r0 + Math.floor((Math.random() - 0.3) * 5);
      const cc = c0 + Math.floor((Math.random() - 0.5) * 9);
      if (paint(rr, cc)) out.push([rr, cc, 'v']);
    }
  }
  return out;
}

// marca de mano arrastrada: alguien intentó entrar y resbaló
function carHandSmear(grid){
  const rows = grid.length, cols = grid[0].length;
  const paint = (r, c) => grid[r] && ['B','H','S'].includes(grid[r][c]);
  const out = [];
  const c0 = 5 + Math.floor(Math.random() * (cols - 12));
  const r0 = Math.floor(rows * 0.4);
  for (let i = 0; i < 4; i++) {
    const c = c0 + i;
    if (paint(r0, c)) out.push([r0, c, 'X']);
    if (paint(r0 + 1, c) && Math.random() < 0.7) out.push([r0 + 1, c, 'v']);
    if (paint(r0 + 2, c) && Math.random() < 0.4) out.push([r0 + 2, c, 'v']);
  }
  return out;
}

function carDamageSet(typeIdx, grid){
  const coords = [];
  const info = { brokenGlass: false, missingWheelSide: null };
  // el óxido nunca falta: es la calle donde ocurrió todo, nada quedó limpio
  coords.push(...carRust(grid, 10 + Math.floor(Math.random()*12)));
  if (Math.random() < 0.7) coords.push(...carDent(grid));
  if (Math.random() < 0.55) {
    const win = carBrokenWindows(grid);
    if (win.length) { coords.push(...win); info.brokenGlass = true; }
  }
  const poppedHood = Math.random() < 0.18;
  if (poppedHood) coords.push(...CAR_HOOD_DAMAGE[typeIdx]);
  // la sangre es la marca del brote: la mayoría de los autos la tiene
  if (Math.random() < 0.62) coords.push(...carBloodSplatter(grid));
  if (Math.random() < 0.3) coords.push(...carHandSmear(grid));
  if (Math.random() < 0.16) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const wheel = carMissingWheel(grid, side);
    if (wheel.length) { coords.push(...wheel); info.missingWheelSide = side; }
  }
  coords.info = info;
  return coords;
}

// ================================================== FUEGO DE COLORES ====
// Antes había llamas de fantasía (azul, verde, morado) para variar entre
// autos. Ahora todas son fuego real: sólo cambia la temperatura, no el
// color base. "hot" es una llama más blanca/amarilla (gasolina recién
// prendida); "ember" es más roja y humeante (fuego que ya lleva rato).
const CAR_FIRE_RAMPS = {
  hot:   ['#fff8d8', '#ffe27a', '#ffb03a', '#ff6a12', '#d43a06'],
  embers:['#ffe8b0', '#ffbd4a', '#ff7a1e', '#e2430c', '#8a1e04']
};
const CAR_FIRE_KEYS = Object.keys(CAR_FIRE_RAMPS);

// equivalente "r,g,b" de CAR_FIRE_RAMPS[key][2], para el glow horneado
// de drawGlow (renderer.js) — sin esto habría que parsear el hex en
// cada frame para armar el string del gradiente
const CAR_FIRE_GLOW_RGB = { hot:'255,176,58', embers:'255,122,30' };

function carFireColor(key, v){
  const ramp = CAR_FIRE_RAMPS[key];
  const i = Math.min(ramp.length - 1, Math.max(0, Math.floor(v * ramp.length)));
  return ramp[i];
}

// ================================================= GENERACIÓN DEL MUNDO =
function spawnCars(){
  cars = [];
  let x = 90 + Math.random() * 110;
  while (x < WORLD_WIDTH - 100) {
    if (Math.random() < 0.5) {
      const typeIdx = Math.floor(Math.random() * CAR_TYPES.length);
      const grid = CAR_TYPES[typeIdx];
      const palIdx = Math.floor(Math.random() * CAR_PALETTES.length);
      const onFire = Math.random() < 0.3;
      const puddle = !onFire && Math.random() < 0.32;
      const headlightFlicker = !onFire && Math.random() < 0.28;
      const spark = !onFire && Math.random() < 0.22;
      const crow = !onFire && Math.random() < 0.2;
      const weeds = !onFire && Math.random() < 0.55;
      const debris = Math.random() < 0.4;
      const dmg = carDamageSet(typeIdx, grid);
      // sin daño de rueda: se asienta apenas torcida (asfalto irregular);
      // con una rueda faltante: se hunde claramente hacia ese lado
      let tilt = (Math.random() - 0.5) * 0.05;
      if (dmg.info.missingWheelSide === 'left') tilt = -(0.09 + Math.random()*0.05);
      if (dmg.info.missingWheelSide === 'right') tilt = 0.09 + Math.random()*0.05;
      cars.push({
        x, typeIdx, palIdx,
        flip: Math.random() < 0.5,
        damage: dmg,
        hasGlassOnGround: dmg.info.brokenGlass,
        onFire,
        fireKey: CAR_FIRE_KEYS[Math.floor(Math.random() * CAR_FIRE_KEYS.length)],
        flicker: Math.random() * Math.PI * 2,
        emberTimer: Math.random() * 0.3,
        smokeTimer: Math.random() * 0.6,
        puddle,
        headlightFlicker, lightOn: true, lightTimer: 0.5 + Math.random(),
        spark, sparkTimer: 1 + Math.random() * 3,
        crow, crowOffsetX: (Math.random() - 0.5) * 0.18 * grid[0].length * CAR_PX,
        crowFlap: false, crowTimer: 2 + Math.random() * 3,
        weeds, debris, debrisSide: Math.random() < 0.5 ? -1 : 1,
        tilt
      });
      // el siguiente auto respeta el largo real de este para no solaparse
      // quedan grupos de autos con claros entre medias, que rellenan
      // las cercas, la maleza y el equipaje
      x += grid[0].length * CAR_PX + 90 + Math.random() * 220;
    } else {
      x += 110 + Math.random() * 150;
    }
  }
  spawnLitter();
}

function carRows(c){
  const grid = CAR_TYPES[c.typeIdx];
  return c.damage.length ? applyOverlay(grid, c.damage) : grid;
}

function findCarCell(grid, ch){
  for (let r = 0; r < grid.length; r++) {
    const c = grid[r].indexOf(ch);
    if (c >= 0) return { r, c };
  }
  return null;
}

function carCellLocal(grid, cell, px){
  const totalW = grid[0].length * px, totalH = grid.length * px;
  return { x: -totalW / 2 + (cell.c + 0.5) * px, y: -totalH + (cell.r + 0.5) * px };
}

// ---- papeles y bolsas arrastrados por el viento: ambiente apocalíptico ----
let litter = [];

function spawnLitter(){
  litter = [];
  const n = Math.floor(WORLD_WIDTH / 240);
  for (let i = 0; i < n; i++) {
    litter.push({
      x: Math.random() * WORLD_WIDTH,
      y: groundY - 2 - Math.random() * 12,
      vx: 8 + Math.random() * 16,
      bob: Math.random() * Math.PI * 2,
      bobSpeed: 1.4 + Math.random() * 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3,
      size: 2 + Math.random() * 2.4,
      tone: Math.random() < 0.5 ? '#cfcabe' : '#8a8378'
    });
  }
}

function updateLitter(dt){
  litter.forEach(p => {
    p.x += p.vx * dt;
    p.bob += dt * p.bobSpeed;
    p.rot += p.rotSpeed * dt;
    if (p.x > WORLD_WIDTH + 40) p.x = -40;
  });
}

function drawLitter(){
  litter.forEach(p => {
    if (p.x < camX - 40 || p.x > camX + W + 40) return;
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(p.bob) * 3);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.tone;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });
}

// ============================================================= UPDATE ===
function updateCars(dt){
  updateLitter(dt);
  cars.forEach(c => {
    if (c.onFire) {
      c.flicker += dt * 5;
      c.emberTimer -= dt;
      if (c.emberTimer <= 0) {
        c.emberTimer = 0.05 + Math.random() * 0.08;
        const ramp = CAR_FIRE_RAMPS[c.fireKey];
        embers.push({
          x: c.x + (Math.random() - 0.5) * 44,
          y: groundY - 42 - Math.random() * 10,
          vx: (Math.random() - 0.5) * 18,
          vy: -38 - Math.random() * 50,
          life: 0.5 + Math.random() * 0.5,
          maxLife: 1.0,
          size: 1.4 + Math.random() * 1.9,
          col: [ramp[0], ramp[2]]
        });
      }
      c.smokeTimer -= dt;
      if (c.smokeTimer <= 0) {
        c.smokeTimer = 0.32 + Math.random() * 0.28;
        smoke.push({
          x: c.x + (Math.random() - 0.5) * 30, y: groundY - 62,
          r: 16 + Math.random() * 12, vx: (Math.random() - 0.5) * 4, speed: 5 + Math.random() * 6
        });
      }
      return;
    }

    if (c.headlightFlicker) {
      c.lightTimer -= dt;
      if (c.lightTimer <= 0) {
        c.lightOn = !c.lightOn;
        c.lightTimer = c.lightOn ? (0.4 + Math.random()*1.4) : (0.04 + Math.random()*0.14);
      }
    }

    if (c.spark) {
      c.sparkTimer -= dt;
      if (c.sparkTimer <= 0) {
        c.sparkTimer = 2 + Math.random()*4;
        const grid = CAR_TYPES[c.typeIdx];
        const cell = findCarCell(grid, 'D') || { r: 3, c: Math.floor(grid[0].length/2) };
        const local = carCellLocal(grid, cell, CAR_PX);
        const sx = c.x + (c.flip ? -local.x : local.x);
        const sy = groundY + local.y;
        spawnParticles(sx, sy, '#eaffff', 3 + Math.floor(Math.random()*3), 60);
      }
    }

    if (c.crow) {
      c.crowTimer -= dt;
      if (c.crowTimer <= 0) {
        c.crowFlap = !c.crowFlap;
        c.crowTimer = c.crowFlap ? 0.12 : (2 + Math.random()*3.5);
      }
    }
  });
}

// llama pixelada compacta sobre el techo del auto
function drawCarFlame(x, gy, key, seed, t){
  const q = 3;
  const cols = [-3, -2, -1, 0, 0, 1, 2, 3];
  cols.forEach((cx, i) => {
    const flick = 0.6 + 0.4 * Math.sin(t * 10 + i * 1.7 + seed);
    const h = (13 + Math.abs(cx) * -2.4 + 7 * flick) * flick;
    for (let y = 0; y < h; y += q) {
      const v = y / Math.max(h, q);
      ctx.fillStyle = carFireColor(key, v);
      ctx.fillRect(x + cx * q - q / 2, gy - y - q, q, q);
    }
  });
}

// marca en el suelo: charco de aceite con reflejo, hollín permanente, o
// simple sombra de contacto según el estado del auto
function drawCarGroundMark(c, grid){
  const halfW = grid[0].length * CAR_PX * 0.5;
  if (c.onFire) {
    ctx.fillStyle = 'rgba(10,8,6,0.55)';
    ctx.beginPath();
    ctx.ellipse(c.x, groundY, halfW * 1.05, 8, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(3,2,2,0.55)';
    ctx.beginPath();
    ctx.ellipse(c.x - halfW*0.15, groundY+1, halfW*0.55, 5, 0, 0, Math.PI*2);
    ctx.fill();
  } else if (c.puddle) {
    ctx.fillStyle = 'rgba(5,9,9,0.55)';
    ctx.beginPath();
    ctx.ellipse(c.x - halfW*0.1, groundY+1, halfW*0.9, 6, 0, 0, Math.PI*2);
    ctx.fill();
    const t = performance.now()*0.0004 + c.x*0.01;
    ctx.strokeStyle = `hsla(${200 + Math.sin(t)*70}, 70%, 55%, 0.35)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c.x - halfW*0.1, groundY+1, halfW*0.62, 3.4, 0, 0.2, 2.6);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(c.x, groundY + 1, halfW * 0.85, 5, 0, 0, Math.PI*2);
    ctx.fill();
  }
}

// maleza: matojos que se abren paso por las juntas y la base de las ruedas
function drawCarWeeds(c, grid){
  const halfW = grid[0].length * CAR_PX * 0.5;
  const spots = [-halfW*0.62, -halfW*0.08, halfW*0.5, halfW*0.78];
  ctx.save();
  spots.forEach((ox, i) => {
    if ((Math.floor(c.x) + i*31) % 5 === 0) return; // salta alguno para variar
    const bx = c.x + ox, by = groundY + 1;
    ctx.fillStyle = '#3f6b28';
    ctx.fillRect(bx-3, by-9, 2, 9);
    ctx.fillRect(bx+1, by-7, 2, 7);
    ctx.fillStyle = '#7fae4a';
    ctx.fillRect(bx-1, by-11, 2, 5);
  });
  ctx.restore();
}

// pila de chatarra/cajas junto al auto, para reforzar el caos del entorno
function drawCarDebris(c, grid){
  const halfW = grid[0].length * CAR_PX * 0.5;
  const bx = c.x + c.debrisSide * (halfW + 22);
  const by = groundY;
  const blocks = [
    { dx: -10, dy: 0,  w: 20, h: 10, col: '#3a3229' },
    { dx: -4,  dy: 8,  w: 14, h: 9,  col: '#4a4034' },
    { dx: 6,   dy: 3,  w: 12, h: 12, col: '#2e2a22' },
    { dx: -12, dy: 3,  w: 9,  h: 8,  col: '#524a3a' }
  ];
  ctx.save();
  blocks.forEach(b => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(bx + b.dx, by - b.h - b.dy + 2, b.w, 3);
    ctx.fillStyle = b.col;
    ctx.fillRect(bx + b.dx, by - b.h - b.dy, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(bx + b.dx, by - b.h - b.dy, b.w, 2);
  });
  ctx.restore();
}

// vidrios rotos en el suelo: esquirlas que destellan de vez en cuando
function drawCarGlassShards(c, grid){
  const halfW = grid[0].length * CAR_PX * 0.5;
  const t = performance.now() * 0.001;
  for (let i = 0; i < 7; i++) {
    const ox = Math.sin(i * 12.9 + c.x * 0.7) * halfW * 0.65;
    const oy = groundY + 1 + Math.abs(Math.sin(i * 7.7 + c.x * 0.3)) * 5;
    const phase = i * 2.1 + c.x * 0.05;
    const glint = Math.max(0, Math.sin(t * 3 + phase));
    const bright = glint > 0.88;
    ctx.globalAlpha = bright ? 1 : 0.55;
    ctx.fillStyle = bright ? '#ffffff' : '#7a8a90';
    const s = bright ? 2.4 : 1.8;
    ctx.fillRect(c.x + ox, oy, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawCars(){
  drawLitter();

  cars.forEach(c => {
    const grid0 = CAR_TYPES[c.typeIdx];
    const halfW = grid0[0].length * CAR_PX * 0.5;
    if (c.x < camX - halfW - 140 || c.x > camX + W + halfW + 140) return;

    const grid = carRows(c);
    const pal = CAR_PALETTES[c.palIdx];
    const key = `car_${c.typeIdx}_${c.palIdx}_${c.damage.map(d => d.join('')).join('_')}`;
    const roofY = groundY - grid.length * CAR_PX;

    if (c.debris) drawCarDebris(c, grid);

    drawCarGroundMark(c, grid);

    if (c.onFire) {
      const flick = 0.6 + 0.4 * Math.sin(c.flicker);
      drawGlow('carFire_' + c.fireKey, CAR_FIRE_GLOW_RGB[c.fireKey], c.x, groundY - 20, 90*flick, 0.33);
    }

    // el cuerpo del auto SIEMPRE se dibuja desde su propio origen (c.x,
    // groundY); sin este translate todos los autos caerían apilados en el
    // origen del mundo en vez de en su posición real
    ctx.save();
    ctx.translate(c.x, groundY);
    ctx.rotate(c.tilt);
    if (c.onFire) {
      const sh = Math.sin(performance.now()*0.006 + c.x*0.07) * 0.05;
      ctx.transform(1, 0, sh, 1, 0, 0);
    }
    drawSpriteCached(key, () => grid, pal, CAR_PX, c.flip);
    ctx.restore();

    if (c.onFire) {
      drawCarFlame(c.x, roofY + 6, c.fireKey, c.x * 0.05, performance.now() * 0.001);
      return;
    }

    if (c.weeds) drawCarWeeds(c, grid);
    if (c.hasGlassOnGround) drawCarGlassShards(c, grid);

    if (c.headlightFlicker && c.lightOn) {
      const cellA = findCarCell(grid0, 'A');
      if (cellA) {
        const local = carCellLocal(grid0, cellA, CAR_PX);
        const lx = c.x + (c.flip ? -local.x : local.x);
        const ly = groundY + local.y;
        // el original iba de crema a naranja en dos tonos; un bitmap
        // horneado de un solo color intermedio es indistinguible a
        // 15px de radio y evita el gradiente nuevo por auto y por frame
        drawGlow('headlight', '255,197,112', lx, ly, 15, 0.85);
      }
    }

    if (c.crow) {
      const cx = c.x + c.crowOffsetX, cy = roofY + 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#050505';
      ctx.fillRect(-4, -5, 8, 5);
      ctx.fillStyle = '#161513';
      ctx.fillRect(-4, -5, 8, 2);
      ctx.fillStyle = '#050505';
      ctx.fillRect(-2, -8, 4, 4);
      ctx.fillStyle = '#e0a028';
      ctx.fillRect(-3, -6, 2, 1);
      ctx.fillStyle = '#c23a2a';
      ctx.fillRect(-1, -7, 1, 1);
      if (c.crowFlap) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(-8, -4, 4, 2);
        ctx.fillRect(4, -4, 4, 2);
      }
      ctx.restore();
    }
  });
}
