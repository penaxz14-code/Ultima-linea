// =====================================================================
//  ESCENARIO — árboles muertos y señalización, en la misma capa que los
//  autos (entre los edificios y la calle). Refuerzan lo apocalíptico:
//  ramas quebradas, hojas mustias, sangre seca, carteles abollados.
// =====================================================================

let trees = [];
let signs = [];
let groundTufts = [];

// ---- paletas compartidas ----
const TREE_PALETTE = {
  trunk: '#3a2f22', trunkDark: '#211a12', trunkLight: '#5a4a34',
  leafA: '#8a6a2a', leafB: '#5c4318', leafC: '#a8863a',
  blood: '#7a1414', bloodDark: '#3a0808'
};

const SIGN_PALETTE = {
  K: '#0a0a0a', Y: '#8a7a1c', n: '#4a4010', R: '#6e1814', W: '#b8b4a8',
  pole: '#3a3a3a', poleDark: '#1c1c1c',
  b: '#7a1414', v: '#3d0a0a', h: '#080808'
};

const SIGN_RECT = ["KKKKKKKKKKKK","KYYYYYYYYYYK","KYYnnnnnnYYK","KYYYYYYYYYYK","KYYYnnnYYYYK","KYYYYYYYYYYK","KKKKKKKKKKKK"];
const SIGN_DIAMOND = ["....KKK....","...KYYYK...","..KYYYYYK..","..KYYYnYYK.",".KYYYnYYYK.","..KYYYnYYK.","..KYYYYYK..","...KYYYK...","....KKK...."];
const SIGN_STOP = ["..KKKKK..",".KRRRRRK.","KRRRRRRRK","KRRWWWRRK","KRRWWWRRK","KRRRRRRRK",".KRRRRRK.","..KKKKK.."];
const SIGN_HEADS = [SIGN_RECT, SIGN_DIAMOND, SIGN_STOP];
const SIGN_PX = 3.6;

// =========================================================== SEÑALES ===
// sangre sobre el cartel: un impacto y su reguero, como los autos
function signBloodOverlay(grid){
  const cand = [];
  grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.' && ch !== 'K') cand.push([r, c]); }));
  if (!cand.length) return [];
  const out = [];
  const [r0, c0] = cand[Math.floor(Math.random() * cand.length)];
  for (let r = r0; r < Math.min(grid.length, r0 + 2); r++) {
    for (let c = c0; c < Math.min(grid[0].length, c0 + 2); c++) {
      if (grid[r] && grid[r][c] !== '.' && grid[r][c] !== 'K') out.push([r, c, 'b']);
    }
  }
  // reguero cayendo por el cartel
  let c = c0;
  for (let r = r0 + 2; r < grid.length; r++) {
    if (Math.random() < 0.3) c += Math.random() < 0.5 ? -1 : 1;
    if (grid[r] && grid[r][c] && grid[r][c] !== '.' && grid[r][c] !== 'K') out.push([r, c, 'v']);
  }
  const extra = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < extra; i++) {
    const [rr, cc] = cand[Math.floor(Math.random() * cand.length)];
    out.push([rr, cc, 'v']);
  }
  return out;
}

// panel reventado: se arranca un trozo del cartel desde un borde, dejando
// el hueco del cielo detrás y los bordes retorcidos
function signTornOverlay(grid){
  const rows = grid.length, cols = grid[0].length;
  const fromLeft = Math.random() < 0.5;
  const out = [];
  const bite = 2 + Math.floor(Math.random() * 3);
  for (let r = 0; r < rows; r++) {
    const depth = Math.max(0, bite - Math.abs(r - rows / 2));
    for (let i = 0; i < depth; i++) {
      const c = fromLeft ? i : cols - 1 - i;
      if (grid[r] && grid[r][c] !== '.') out.push([r, c, '.']);
    }
    // borde retorcido junto al desgarro
    const edge = fromLeft ? depth : cols - 1 - depth;
    if (depth > 0 && grid[r] && grid[r][edge] && grid[r][edge] !== '.') out.push([r, edge, 'K']);
  }
  return out;
}

// agujeros de bala en el cartel
function signBulletHoles(grid){
  const cand = [];
  grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.' && ch !== 'K') cand.push([r, c]); }));
  if (!cand.length) return [];
  const out = [];
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const [r, c] = cand[Math.floor(Math.random() * cand.length)];
    out.push([r, c, 'h']);
  }
  return out;
}

function signDamageSet(grid){
  const coords = [];
  const kind = Math.random();
  if (kind < 0.34) {
    // rota: panel arrancado, casi siempre además con sangre
    coords.push(...signTornOverlay(grid));
    if (Math.random() < 0.7) coords.push(...signBloodOverlay(grid));
  } else if (kind < 0.72) {
    // entera pero ensangrentada
    coords.push(...signBloodOverlay(grid));
    if (Math.random() < 0.5) coords.push(...signBulletHoles(grid));
  } else {
    // sólo acribillada, sin sangre
    coords.push(...signBulletHoles(grid));
  }
  return coords;
}

function spawnSigns(){
  signs = [];
  let x = 140 + Math.random() * 160;
  while (x < WORLD_WIDTH - 120) {
    if (Math.random() < 0.72) {
      const headIdx = Math.floor(Math.random() * SIGN_HEADS.length);
      const head = SIGN_HEADS[headIdx];
      const knocked = Math.random() < 0.25;
      const poleH = 46 + Math.random() * 30;
      signs.push({
        x, headIdx,
        damage: signDamageSet(head),
        poleH,
        bent: knocked ? (Math.PI * 0.42 + Math.random() * 0.18) * (Math.random() < 0.5 ? 1 : -1)
                      : (Math.random() - 0.5) * 0.4,
        flip: Math.random() < 0.5
      });
    }
    x += 150 + Math.random() * 190;
  }
}

function signRows(s){
  const head = SIGN_HEADS[s.headIdx];
  return s.damage.length ? applyOverlay(head, s.damage) : head;
}

function drawSigns(){
  signs.forEach(s => {
    const headH = SIGN_HEADS[s.headIdx].length * SIGN_PX;
    if (s.x < camX - 60 || s.x > camX + W + 60) return;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(s.x, groundY + 1, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(s.x, groundY);
    ctx.rotate(s.bent);
    // poste
    ctx.fillStyle = SIGN_PALETTE.poleDark;
    ctx.fillRect(-2, -s.poleH, 4, s.poleH);
    ctx.fillStyle = SIGN_PALETTE.pole;
    ctx.fillRect(-2, -s.poleH, 1.5, s.poleH);
    // cabeza de la señal
    ctx.translate(0, -s.poleH);
    drawSpriteCached(`sign_${s.headIdx}_${s.damage.map(d=>d.join('')).join('_')}`, () => signRows(s), SIGN_PALETTE, SIGN_PX, s.flip);
    ctx.restore();
  });
}

// ============================================================ ÁRBOLES ==
function spawnTrees(){
  trees = [];
  let x = 150 + Math.random() * 260;
  while (x < WORLD_WIDTH - 150) {
    if (Math.random() < 0.42) {
      const trunkH = 34 + Math.random() * 16;          // en bloques de 3px -> ~102-150px
      const branchCount = 3 + Math.floor(Math.random() * 3);
      const branches = [];
      for (let i = 0; i < branchCount; i++) {
        const snapped = Math.random() < 0.4;
        branches.push({
          heightFrac: 0.35 + Math.random() * 0.6,
          side: Math.random() < 0.5 ? -1 : 1,
          len: (snapped ? 5 : 9) + Math.random() * 6,
          ang: -0.22 - Math.random() * 0.45,
          snapped,
          leafTone: Math.floor(Math.random() * 3)
        });
      }
      const bloody = Math.random() < 0.38;
      trees.push({
        x, trunkH, branches, seed: Math.random() * 10,
        lean: (Math.random() - 0.5) * 10,
        bloody, bloodPool: bloody && Math.random() < 0.5
      });
    }
    x += 240 + Math.random() * 300;
  }
}

function drawDeadTree(t){
  if (t.x < camX - 120 || t.x > camX + W + 120) return;
  const q = 3;
  const gy = groundY;
  const rows = Math.round(t.trunkH / q);
  const P = TREE_PALETTE;

  ctx.save();

  // charco de sangre seca en la base, si corresponde
  if (t.bloodPool) {
    ctx.fillStyle = P.bloodDark;
    ctx.beginPath();
    ctx.ellipse(t.x + 3, gy + 1, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // tronco: se afina y se inclina hacia arriba, con un quiebre visible
  const trunkX = r => t.lean * (r / rows) + Math.sin(r * 0.6 + t.seed) * 3;
  for (let r = 0; r < rows; r++) {
    const w = Math.max(3, q * 2.4 * (1 - r / rows * 0.6));
    const x0 = t.x + trunkX(r) - w / 2;
    const y0 = gy - (r + 1) * q;
    ctx.fillStyle = (r % 5 === 0) ? P.trunkDark : P.trunk;
    ctx.fillRect(x0, y0, w, q + 0.6);
  }
  // filo de luz en un lado del tronco
  for (let r = 0; r < rows; r += 2) {
    const w = Math.max(3, q * 2.4 * (1 - r / rows * 0.6));
    ctx.fillStyle = P.trunkLight;
    ctx.fillRect(t.x + trunkX(r) - w / 2, gy - (r + 1) * q, 1.6, q);
  }

  // ramas: bloques apilados a lo largo de una línea desde el tronco
  t.branches.forEach(b => {
    const baseR = Math.floor(rows * b.heightFrac);
    const bx = t.x + trunkX(baseR);
    const by = gy - baseR * q;
    const ang = b.ang * (b.side < 0 ? -1 : 1) - (b.side < 0 ? Math.PI : 0);
    const steps = Math.ceil(b.len / q);
    let lastX = bx, lastY = by;
    for (let i = 1; i <= steps; i++) {
      const dist = i * q;
      const wob = Math.sin(i * 0.8 + t.seed + b.side) * 1.4;
      const px = bx + Math.cos(ang) * dist * b.side + wob;
      const py = by + Math.sin(ang) * dist;
      const sz = Math.max(2, q * 1.4 * (1 - i / steps * 0.5));
      ctx.fillStyle = (b.snapped && i === steps) ? P.trunkDark : P.trunk;
      ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      lastX = px; lastY = py;
    }
    if (b.snapped) {
      // punta astillada, oscura e irregular
      ctx.fillStyle = P.trunkDark;
      ctx.fillRect(lastX - 3, lastY - 2, 6, 4);
      ctx.fillStyle = P.trunkLight;
      ctx.fillRect(lastX - 2, lastY - 3, 2, 2);
    } else {
      // hojas mustias: un manojo disperso, no un follaje denso
      const tones = [P.leafA, P.leafB, P.leafC];
      for (let i = 0; i < 6; i++) {
        const ox = (Math.random() - 0.5) * 10;
        const oy = (Math.random() - 0.5) * 8 - 2;
        ctx.fillStyle = tones[(b.leafTone + i) % 3];
        ctx.fillRect(lastX + ox, lastY + oy, 2.6, 2.6);
      }
    }
    // sangre goteando por alguna rama
    if (t.bloody && b.side > 0 && !b.snapped) {
      ctx.fillStyle = P.blood;
      ctx.fillRect(lastX - 1, lastY, 2, 10 + Math.random() * 8);
    }
  });

  // regueros de sangre en el propio tronco
  if (t.bloody) {
    ctx.fillStyle = P.blood;
    ctx.fillRect(t.x + trunkX(Math.floor(rows*0.5)) + 1, gy - rows*q*0.55, 2, rows*q*0.4);
  }

  ctx.restore();
}

function drawTrees(){
  trees.forEach(drawDeadTree);
}

// ======================= CERCAS DE CARRETERA ROTAS =====================
//  Guardarraíl metálico corrido a lo largo de la vía, generado por tramos
//  para que cada trozo esté distinto: enteros, doblados hacia afuera,
//  hundidos, con postes arrancados o con el riel colgando partido. Es lo
//  que rellena los claros que dejan los autos.
let fences = [];

const FENCE_PALETTE = {
  rail:'#5a6068', railDark:'#2e3238', railLight:'#828a92',
  post:'#3a3e44', postDark:'#1c1f23',
  rust:'#7a4a20', blood:'#7a1414'
};

const FENCE_STATES = ['ok', 'bent', 'down', 'gone', 'hanging'];

function spawnFences(){
  fences = [];
  let x = 40;
  while (x < WORLD_WIDTH) {
    const segW = 46 + Math.random() * 26;
    // los tramos "gone" abren huecos y evitan la línea continua monótona
    const roll = Math.random();
    let state;
    if (roll < 0.34) state = 'ok';
    else if (roll < 0.53) state = 'bent';
    else if (roll < 0.68) state = 'down';
    else if (roll < 0.86) state = 'gone';
    else state = 'hanging';
    // Todo lo que antes se sorteaba DENTRO de drawFences() (que se llama
    // cada frame) ahora se decide aquí, una sola vez, al nacer la valla.
    // Antes esos Math.random() por frame hacían que los postes de un
    // tramo "hanging" aparecieran/desaparecieran y el punto de quiebre
    // del riel temblara 60 veces por segundo -> parecía que la valla se
    // movía sola. Ahora son valores fijos, guardados en el objeto.
    const numPostes = Math.max(1, Math.ceil((segW - 4) / 22));
    const posteVisible = [];
    for (let i = 0; i < numPostes; i++) posteVisible.push(!(state === 'hanging' && Math.random() < 0.4));
    fences.push({
      x, w: segW, state,
      h: 20 + Math.random() * 8,
      lean: (Math.random() - 0.5) * 0.5,
      rusty: Math.random() < 0.5,
      bloody: Math.random() < 0.18,
      seed: Math.random() * 10,
      hangHalf: 0.4 + Math.random() * 0.2,   // punto de quiebre del riel colgante
      downWidth: 0.6 + Math.random() * 0.1,  // ancho del reflejo en el riel caído
      posteVisible
    });
    x += segW;
  }
}

function drawFences(){
  const P = FENCE_PALETTE;
  fences.forEach(f => {
    if (f.state === 'gone') return;
    if (f.x + f.w < camX - 40 || f.x > camX + W + 40) return;

    const gy = groundY;

    if (f.state === 'down') {
      // tramo tumbado en el suelo, sólo se ve el riel aplastado
      ctx.fillStyle = P.railDark;
      ctx.fillRect(f.x, gy - 4, f.w, 3);
      ctx.fillStyle = f.rusty ? P.rust : P.rail;
      ctx.fillRect(f.x, gy - 5, f.w * f.downWidth, 2);
      // poste arrancado, tirado en diagonal
      ctx.save();
      ctx.translate(f.x + f.w * 0.3, gy);
      ctx.rotate(1.2 + f.seed * 0.05);
      ctx.fillStyle = P.postDark;
      ctx.fillRect(-2, -f.h, 4, f.h);
      ctx.restore();
      return;
    }

    const lean = f.state === 'bent' ? f.lean : f.lean * 0.15;
    const railY = gy - f.h;

    // postes cada ~22px, alguno ausente
    let posteIdx = 0;
    for (let px = f.x + 4; px < f.x + f.w; px += 22) {
      const visible = f.posteVisible ? f.posteVisible[posteIdx++] !== false : true;
      if (f.state === 'hanging' && !visible) continue;
      ctx.save();
      ctx.translate(px, gy);
      ctx.rotate(lean * 0.6);
      ctx.fillStyle = P.postDark;
      ctx.fillRect(-2.5, -f.h, 5, f.h);
      ctx.fillStyle = P.post;
      ctx.fillRect(-2.5, -f.h, 1.6, f.h);
      ctx.restore();
    }

    // riel: dos bandas horizontales, la de abajo más oscura
    ctx.save();
    ctx.translate(f.x, railY);
    ctx.rotate(lean * 0.25);
    if (f.state === 'hanging') {
      // el riel se parte a la mitad y cuelga hacia el suelo
      const half = f.w * f.hangHalf;
      ctx.fillStyle = f.rusty ? P.rust : P.rail;
      ctx.fillRect(0, 0, half, 4);
      ctx.fillStyle = P.railDark;
      ctx.fillRect(0, 4, half, 2);
      ctx.save();
      ctx.translate(half, 0);
      ctx.rotate(0.7 + f.seed * 0.03);
      ctx.fillStyle = P.railDark;
      ctx.fillRect(0, 0, f.w - half, 4);
      ctx.restore();
    } else {
      ctx.fillStyle = f.rusty ? P.rust : P.rail;
      ctx.fillRect(0, 0, f.w, 4);
      ctx.fillStyle = P.railLight;
      ctx.fillRect(0, 0, f.w, 1.2);
      ctx.fillStyle = P.railDark;
      ctx.fillRect(0, 4, f.w, 2);
      // abolladuras: mordidas oscuras en el riel
      if (f.state === 'bent') {
        for (let i = 0; i < 3; i++) {
          const dx = (f.seed * 13 + i * 17) % f.w;
          ctx.fillStyle = P.railDark;
          ctx.fillRect(dx, 0, 4, 4);
        }
      }
    }
    if (f.bloody) {
      ctx.fillStyle = P.blood;
      const bx = (f.seed * 7) % Math.max(1, f.w - 6);
      ctx.fillRect(bx, 1, 3, 3);
      ctx.fillRect(bx + 1, 5, 2, 6 + f.seed);
    }
    ctx.restore();
  });
}

// ============================= RASTRO DE LA HUIDA ======================
//  Maletas reventadas, bolsas y conos: lo que la gente soltó al bajarse
//  de los autos y salir corriendo. Rellena los huecos entre vehículos.
let flotsam = [];

const FLOTSAM_PALETTE = {
  K:'#0a0a0a', A:'#5a4632', a:'#33271b', B:'#3a4a5a', b:'#1f2833',
  C:'#6a5a3a', R:'#7a1414', W:'#b8b4a8', o:'#8a7a5a', N:'#2a2a2a'
};

// maleta abierta con ropa desparramada (10x7)
const PROP_SUITCASE = [
  "..KKKKKK..",
  ".KAAAAAAK.",
  "KAaAAAAaAK",
  "KAAAAAAAAK",
  "KaAAAAAAaK",
  ".KAAAAAAK.",
  "..KKKKKK.."
];

// bolsa/mochila tirada (8x7)
const PROP_BAG = [
  "..KKKK..",
  ".KBBBBK.",
  "KBbBBbBK",
  "KBBBBBBK",
  "KBbBBbBK",
  ".KBBBBK.",
  "..KKKK.."
];

// cono de tráfico volcado (7x6)
const PROP_CONE = [
  "...KK..",
  "..KRRK.",
  "..KRRK.",
  ".KRWWRK",
  "KRRWWRRK".slice(0,7),
  "KKKKKKK"
];

// caja de cartón reventada (9x6)
const PROP_CRATE = [
  ".KKKKKKK.",
  "KCoCCCoCK",
  "KCCCCCCCK",
  "KCoCCCoCK",
  "KCCCCCCCK",
  ".KKKKKKK."
];

const PROP_TYPES = [PROP_SUITCASE, PROP_BAG, PROP_CONE, PROP_CRATE];
const PROP_PX = 3.0;

function propBlood(grid){
  if (Math.random() > 0.45) return [];
  const cand = [];
  grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.' && ch !== 'K') cand.push([r, c]); }));
  if (!cand.length) return [];
  const out = [];
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const [r, c] = cand[Math.floor(Math.random() * cand.length)];
    out.push([r, c, 'R']);
  }
  return out;
}

function spawnFlotsam(){
  flotsam = [];
  let x = 60 + Math.random() * 90;
  while (x < WORLD_WIDTH - 60) {
    if (Math.random() < 0.62) {
      const typeIdx = Math.floor(Math.random() * PROP_TYPES.length);
      const grid = PROP_TYPES[typeIdx];
      flotsam.push({
        x, typeIdx,
        damage: propBlood(grid),
        flip: Math.random() < 0.5,
        tilt: (Math.random() - 0.5) * 0.5
      });
    }
    x += 80 + Math.random() * 130;
  }
}

function drawFlotsam(){
  flotsam.forEach(p => {
    if (p.x < camX - 40 || p.x > camX + W + 40) return;
    const grid = PROP_TYPES[p.typeIdx];
    const rows = p.damage.length ? applyOverlay(grid, p.damage) : grid;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, groundY + 1, grid[0].length * PROP_PX * 0.45, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, groundY + 1);
    ctx.rotate(p.tilt);
    drawSpriteCached(`prop_${p.typeIdx}_${p.damage.map(d=>d.join('')).join('_')}`,
                     () => rows, FLOTSAM_PALETTE, PROP_PX, p.flip);
    ctx.restore();
  });
}

// matas grandes: arbustos que se comieron el arcén, con volumen propio
// para rellenar los claros que dejan los autos
let bushes = [];

function spawnBushes(){
  bushes = [];
  let x = 60 + Math.random() * 120;
  while (x < WORLD_WIDTH - 40) {
    if (Math.random() < 0.66) {
      bushes.push({
        x,
        w: 16 + Math.random() * 22,
        h: 10 + Math.random() * 14,
        seed: Math.random() * 10,
        dry: Math.random() < 0.4,
        blades: 5 + Math.floor(Math.random() * 5)
      });
    }
    x += 90 + Math.random() * 120;
  }
}

function drawBushes(){
  const t = performance.now() * 0.001;
  bushes.forEach(b => {
    if (b.x < camX - 60 || b.x > camX + W + 60) return;
    const base = b.dry ? ['#6a6a32', '#8a8a46', '#4a4a22'] : ['#3f6b28', '#5c8a38', '#28461a'];
    // masa baja del arbusto
    ctx.fillStyle = base[2];
    ctx.beginPath();
    ctx.ellipse(b.x, groundY + 1, b.w * 0.55, b.h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // tallos que salen en abanico, con balanceo
    for (let i = 0; i < b.blades; i++) {
      const f = i / (b.blades - 1) - 0.5;
      const sway = Math.sin(t * 0.9 + b.seed + i) * 1.8;
      const bx = b.x + f * b.w * 0.8;
      const bh = b.h * (1 - Math.abs(f) * 0.55);
      ctx.fillStyle = base[i % 2];
      ctx.fillRect(bx, groundY + 1 - bh, 1.8, bh);
      ctx.fillRect(bx + sway * 0.4, groundY + 1 - bh - 3, 1.8, bh * 0.35);
    }
  });
}

// ================================================= MALEZA POR EL SUELO ==
//  A diferencia de la de los autos, ésta crece de forma independiente,
//  directamente entre las grietas del asfalto: la naturaleza reclamando
//  la calle.
function spawnGroundTufts(){
  groundTufts = [];
  const n = Math.floor(WORLD_WIDTH / 42);
  for (let i = 0; i < n; i++) {
    groundTufts.push({
      x: Math.random() * WORLD_WIDTH,
      h: 5 + Math.random() * 7,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.8 + Math.random() * 1.2,
      tone: Math.random() < 0.5 ? '#3f6b28' : '#5c8a38'
    });
  }
}

function drawGroundTufts(){
  const t = performance.now() * 0.001;
  groundTufts.forEach(g => {
    if (g.x < camX - 20 || g.x > camX + W + 20) return;
    const sway = Math.sin(t * g.swaySpeed + g.sway) * 1.4;
    ctx.fillStyle = g.tone;
    ctx.fillRect(g.x - 2, groundY + 1 - g.h, 1.6, g.h);
    ctx.fillRect(g.x + sway, groundY + 1 - g.h - 2, 1.6, g.h * 0.7);
    ctx.fillRect(g.x + 2 - sway * 0.6, groundY + 1 - g.h + 1, 1.6, g.h * 0.6);
  });
}

// ============================================================= UPDATE ==
function updateScenery2(dt){
  // los matojos y ramas no necesitan física; el balanceo se calcula en el
  // propio dibujado a partir del reloj, así que aquí no hay nada que hacer
  // (se deja la función por si en el futuro se anima algo con estado)
}

function spawnScenery(){
  spawnFences();
  spawnTrees();
  spawnSigns();
  spawnFlotsam();
  spawnBushes();
  spawnGroundTufts();
}

function drawScenery(){
  // la cerca corre detrás de todo lo demás del sub-fondo
  drawFences();
  drawTrees();
  drawSigns();
  drawFlotsam();
  drawBushes();
  // los matojos van al final: crecen pegados al borde del asfalto, por
  // delante del resto del decorado. spawnGroundTufts() ya los generaba,
  // pero nadie los dibujaba y el array quedaba invisible.
  drawGroundTufts();
}
