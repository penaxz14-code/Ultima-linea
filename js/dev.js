// =====================================================================
//  MODO DESARROLLADOR — TEMPORAL, PARA PRUEBAS
//  ---------------------------------------------------------------
//  Igual que el botón de saltar oleada, esto está pensado para
//  borrarse. Todo lo propio del modo vive en este archivo: el estado,
//  el botón (se crea por JS, no está en el HTML), su CSS y la tecla.
//
//  PARA ELIMINARLO POR COMPLETO:
//    1. Borrar este archivo y su <script> en index.html.
//    2. Quitar las 6 líneas marcadas con  // [DEV]  repartidas por
//       player.js, enemies.js y bosses.js (se encuentran con grep).
// =====================================================================

let devMode = false;

const DEV_DAMAGE_MULT = 30;

// multiplicador de daño de las balas del jugador
function devDmg(base){ return devMode ? base*DEV_DAMAGE_MULT : base; }

// vida infinita
function devInvulnerable(){ return devMode; }

(function setupDevMode(){
  const style = document.createElement('style');
  style.textContent = `
    #btnDevMode {
      border:none;
      border-radius:8px;
      background: rgba(111,208,255,0.08);
      border: 1.5px dashed rgba(111,208,255,0.5);
      color: #6fd0ff;
      font-family: inherit;
      font-size:11px;
      padding:5px 8px;
      cursor:pointer;
      letter-spacing:0.5px;
    }
    #btnDevMode:active { transform: scale(0.9); }
    #btnDevMode.on {
      background: rgba(111,208,255,0.28);
      border-style: solid;
      color: #d8f4ff;
      box-shadow: 0 0 12px rgba(111,208,255,0.6);
    }
    #devBadge {
      position:absolute;
      top:50%; left:50%;
      transform: translate(-50%, -50%);
      pointer-events:none;
      z-index:9;
      font-family: 'Courier New', monospace;
      font-size:10px;
      letter-spacing:3px;
      color: #6fd0ff;
      text-shadow: 0 0 10px rgba(111,208,255,0.8);
      opacity:0.75;
    }
    #devBadge.hidden { display:none; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'btnDevMode';
  btn.title = 'Modo desarrollador: vida infinita y daño x' + DEV_DAMAGE_MULT + ' (tecla G)';
  btn.textContent = '🛠 DEV';

  const hudTop = document.getElementById('hudTop');
  if (hudTop) hudTop.appendChild(btn);

  const badge = document.createElement('div');
  badge.id = 'devBadge';
  badge.className = 'hidden';
  badge.textContent = 'MODO DESARROLLADOR';
  const hud = document.getElementById('hud');
  if (hud) hud.appendChild(badge);

  function refresh(){
    btn.classList.toggle('on', devMode);
    btn.textContent = devMode ? '🛠 DEV ON' : '🛠 DEV';
    badge.classList.toggle('hidden', !devMode);
  }

  window.__toggleDevMode = function(){
    devMode = !devMode;
    if (devMode) {
      // al activarlo deja la vida a tope para no arrancar tocado
      if (typeof health !== 'undefined') {
        health = (typeof UPG !== 'undefined') ? UPG.effectiveMaxHealth() : MAX_HEALTH;
        healthInner.style.width = '100%';
      }
    }
    if (typeof playClickSound === 'function') playClickSound();
    refresh();
  };

  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); window.__toggleDevMode(); });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG') window.__toggleDevMode();
  });

  refresh();
})();
