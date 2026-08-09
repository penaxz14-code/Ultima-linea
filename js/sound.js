/* ============================================================
   ÚLTIMA LÍNEA — AJUSTES DE SONIDO
   ------------------------------------------------------------
   NO TOCA audio.js. En vez de eso intercepta AudioNode.connect:
   cada vez que un sonido intenta conectarse a la salida, se le
   desvía por un bus de volumen. Como todos los sonidos del juego
   terminan en ac.destination, todos quedan cubiertos: disparos,
   impactos, gruñidos, truenos, el viento de fondo y lo que se
   añada en el futuro.

   Buses:  fuente -> [efectos | ambiente] -> general -> salida

   El viento se distingue del resto envolviendo startAmbientWind():
   mientras se ejecuta, lo que se conecte va al bus de ambiente.
   ============================================================ */
(function(){
  'use strict';

  /* ---------- 1 · estado y persistencia ---------- */
  const POR_DEFECTO = { general: 0.8, efectos: 1, ambiente: 0.7, silencio: false };
  const CLAVE = 'ultimaLinea.sonido';
  let cfg = Object.assign({}, POR_DEFECTO);

  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) Object.assign(cfg, JSON.parse(guardado));
  } catch(e){ /* file:// sin almacenamiento: se queda en memoria */ }

  function guardar(){
    try { localStorage.setItem(CLAVE, JSON.stringify(cfg)); } catch(e){}
  }

  /* ---------- 2 · buses de volumen ---------- */
  const buses = new Map();          // AudioContext -> {general, efectos, ambiente}
  let destino = 'efectos';          // a qué bus va lo que se conecte ahora

  const NodoAudio = window.AudioNode;
  const conectarOriginal = NodoAudio && NodoAudio.prototype.connect;

  function busesDe(ctx){
    let b = buses.get(ctx);
    if (b) return b;
    const general  = ctx.createGain();
    const efectos  = ctx.createGain();
    const ambiente = ctx.createGain();
    // se usa la función original para no volver a entrar en el desvío
    conectarOriginal.call(general, ctx.destination);
    conectarOriginal.call(efectos, general);
    conectarOriginal.call(ambiente, general);
    b = { general, efectos, ambiente };
    buses.set(ctx, b);
    aplicar();
    return b;
  }

  if (conectarOriginal && !NodoAudio.prototype.__ulDesviado){
    NodoAudio.prototype.connect = function(dest){
      if (window.AudioDestinationNode && dest instanceof window.AudioDestinationNode){
        const b = busesDe(dest.context);
        const args = Array.prototype.slice.call(arguments, 1);
        return conectarOriginal.apply(this, [destino === 'ambiente' ? b.ambiente : b.efectos].concat(args));
      }
      return conectarOriginal.apply(this, arguments);
    };
    NodoAudio.prototype.__ulDesviado = true;
  }

  // el viento ambiente se marca envolviendo su función de arranque
  if (typeof window.startAmbientWind === 'function'){
    const originalViento = window.startAmbientWind;
    window.startAmbientWind = function(){
      destino = 'ambiente';
      try { return originalViento.apply(this, arguments); }
      finally { destino = 'efectos'; }
    };
  }

  // la melodía ambiente se marca igual: su única conexión real a la
  // salida (el melodyBus) ocurre dentro de esta misma llamada síncrona
  if (typeof window.startAmbientMelody === 'function'){
    const originalMelodia = window.startAmbientMelody;
    window.startAmbientMelody = function(){
      destino = 'ambiente';
      try { return originalMelodia.apply(this, arguments); }
      finally { destino = 'efectos'; }
    };
  }

  function aplicar(){
    const g = cfg.silencio ? 0 : cfg.general;
    buses.forEach(b => {
      b.general.gain.value  = g;
      b.efectos.gain.value  = cfg.efectos;
      b.ambiente.gain.value = cfg.ambiente;
    });
  }

  /* ---------- 3 · panel ---------- */
  const zona = document.getElementById('gameArea');
  if (!zona) return;

  const panel = document.createElement('div');
  panel.id = 'sndPanel';
  panel.className = 'hidden';

  const FILAS = [
    { id:'general',  etiqueta:'GENERAL',  nota:'volumen de todo el juego' },
    { id:'efectos',  etiqueta:'EFECTOS',  nota:'disparos, impactos, zombies' },
    { id:'ambiente', etiqueta:'AMBIENTE', nota:'viento y fondo' }
  ];

  panel.innerHTML =
    '<div class="sndCard">' +
      '<h3>SONIDO</h3>' +
      FILAS.map(f =>
        '<div class="sndRow" data-canal="' + f.id + '">' +
          '<span class="sndLabel">' + f.etiqueta + '<i>' + f.nota + '</i></span>' +
          '<span class="sndTrack">' +
            '<input type="range" class="sndSlider" min="0" max="100" step="1" ' +
                   'aria-label="' + f.etiqueta + '" data-canal="' + f.id + '">' +
          '</span>' +
          '<span class="sndVal">0</span>' +
        '</div>'
      ).join('') +
      '<div class="sndBtns">' +
        '<button type="button" class="sndMute"></button>' +
        '<button type="button" class="sndClose">CERRAR</button>' +
      '</div>' +
    '</div>';
  zona.appendChild(panel);

  const sliders = {};
  panel.querySelectorAll('.sndSlider').forEach(s => { sliders[s.dataset.canal] = s; });
  const btnMute  = panel.querySelector('.sndMute');
  const btnClose = panel.querySelector('.sndClose');

  function pintar(){
    FILAS.forEach(f => {
      const v = Math.round(cfg[f.id] * 100);
      sliders[f.id].value = v;
      const fila = panel.querySelector('.sndRow[data-canal="' + f.id + '"]');
      fila.querySelector('.sndVal').textContent = v;
      fila.classList.toggle('mudo', cfg.silencio && f.id === 'general');
      // relleno de la guía proporcional al valor
      sliders[f.id].style.setProperty('--relleno', v + '%');
    });
    btnMute.textContent = cfg.silencio ? 'ACTIVAR SONIDO' : 'SILENCIAR';
    btnMute.classList.toggle('on', cfg.silencio);
    panel.classList.toggle('silenciado', cfg.silencio);
  }

  // pitido de referencia para oír el nivel mientras se ajusta
  let ultimoAviso = 0;
  function avisar(){
    const ahora = Date.now();
    if (ahora - ultimoAviso < 140) return;
    ultimoAviso = ahora;
    if (typeof playClickSound === 'function'){ try { playClickSound(); } catch(e){} }
  }

  panel.addEventListener('input', e => {
    const canal = e.target.dataset && e.target.dataset.canal;
    if (!canal) return;
    cfg[canal] = e.target.value / 100;
    if (cfg.silencio && cfg[canal] > 0) cfg.silencio = false;
    aplicar(); pintar(); guardar(); avisar();
  });

  btnMute.addEventListener('click', () => {
    cfg.silencio = !cfg.silencio;
    aplicar(); pintar(); guardar();
    if (!cfg.silencio) avisar();
  });

  function abrir(){
    if (typeof ensureAudio === 'function'){ try { ensureAudio(); } catch(e){} }
    pintar();
    panel.classList.remove('hidden');
  }
  function cerrar(){
    panel.classList.add('hidden');
    if (typeof playClickSound === 'function'){ try { playClickSound(); } catch(e){} }
  }

  btnClose.addEventListener('click', cerrar);
  panel.addEventListener('click', e => { if (e.target === panel) cerrar(); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && !panel.classList.contains('hidden')){
      e.stopPropagation();
      cerrar();
    }
  }, true);

  window.__openSoundSettings = abrir;

  /* ---------- 4 · acceso desde la pausa ---------- */
  const overlay = document.getElementById('overlay');
  if (overlay){
    new MutationObserver(() => {
      if (overlay.classList.contains('hidden')) return;
      if (!overlay.querySelector('#resumeBtn')) return;      // sólo en la pausa
      if (overlay.querySelector('.sndOpenBtn')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sndOpenBtn';
      b.textContent = 'SONIDO';
      b.addEventListener('click', abrir);
      (overlay.querySelector('.termPanel') || overlay).appendChild(b);
    }).observe(overlay, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  aplicar();
  pintar();
})();
