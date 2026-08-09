/* ============================================================
   ÚLTIMA LÍNEA — capa de vida del HUD
   ------------------------------------------------------------
   ESTE ARCHIVO NO TOCA LA LÓGICA DEL JUEGO. Sólo observa el DOM
   que el juego ya escribe y le añade clases para que el CSS pueda
   animarlo. Si se borra este script y hud.css, todo vuelve a
   funcionar exactamente igual que antes.

   Hace tres cosas:
     1. Detecta cambios en la barra de vida (daño / curación /
        estado crítico) leyendo el style.width que escribe
        damagePlayer(), y dispara sacudida, fogonazo y viñeta.
     2. Marca los lectores del HUD cuando su cifra cambia.
     3. Envuelve el contenido de #overlay en un panel de terminal
        cada vez que pausa, tienda o fin de partida lo reescriben.
   ============================================================ */
(function(){
  'use strict';

  const outer   = document.getElementById('healthOuter');
  const inner   = document.getElementById('healthInner');
  const overlay = document.getElementById('overlay');
  const area    = document.getElementById('gameArea');
  if (!area) return;

  const flash = (el, cls, ms) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;              // reinicia la animación
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  };

  /* ---------- 1 · barra de integridad ---------- */
  if (outer && inner){
    const vig = document.createElement('div');
    vig.id = 'dmgVignette';
    area.appendChild(vig);

    let last = 100;
    const readPct = () => {
      const v = parseFloat(inner.style.width);
      return isNaN(v) ? last : v;
    };

    const onHealth = () => {
      const pct = readPct();
      if (pct < last - 0.01){
        flash(outer, 'hit', 360);
        flash(vig, 'show', 440);
      } else if (pct > last + 0.01){
        flash(outer, 'heal', 520);
      }
      last = pct;
      outer.classList.toggle('critical', pct <= 25);
      outer.classList.toggle('warn', pct > 25 && pct <= 55);
    };

    new MutationObserver(onHealth)
      .observe(inner, { attributes:true, attributeFilter:['style'] });
    onHealth();
  }

  /* ---------- 2 · lectores que reaccionan al cambiar ---------- */
  ['scoreVal','waveVal','coinVal','ammoVal','weaponVal'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const plate = el.closest('#hudTop > div, #hudMid > div') || el.parentElement;
    let prev = el.textContent;
    new MutationObserver(() => {
      if (el.textContent === prev) return;
      prev = el.textContent;
      flash(plate, 'bump', 320);
      // la placa de munición entra en alarma cuando el cargador se vacía
      if (id === 'ammoVal') plate.classList.toggle('dry', el.classList.contains('empty'));
    }).observe(el, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['class'] });
  });

  /* ---------- 3 · terminal de pausa / tienda / fin ---------- */
  if (overlay){
    const TITULOS = {
      pausa:    'ALTO EL FUEGO · POSICIÓN ASEGURADA',
      tienda:   'PUESTO DE SUMINISTRO · SECTOR 7',
      fin:      'BAJA CONFIRMADA · SIN RESPUESTA',
      victoria: 'ACTO I · PROTOCOLO CUMPLIDO',
      otro:     'PUESTO DE MANDO'
    };

    function modoDe(){
      if (overlay.querySelector('#resumeBtn'))    return 'pausa';
      if (overlay.querySelector('#shopContinue')) return 'tienda';
      if (overlay.querySelector('#demoCompleteBadge')) return 'victoria';
      if (overlay.querySelector('#startBtn'))     return 'fin';
      return 'otro';
    }

    function envolver(){
      if (overlay.classList.contains('hidden')) return;

      // la tienda ya trae su propio panel de 3 columnas (shop.js + shop.css,
      // marcado con overlay.classList 'shopMode'): envolverla en .termPanel
      // la encogería a un ancho de tarjeta simple y le rompería el layout.
      if (overlay.classList.contains('shopMode')) return;

      // hijos que todavía están sueltos, fuera del panel
      const sueltos = Array.prototype.filter.call(overlay.childNodes, n =>
        !(n.nodeType === 1 && n.classList.contains('termPanel'))
      ).filter(n => n.nodeType !== 3 || n.textContent.trim() !== '');

      if (!sueltos.length){
        // overlay vaciado (al volver al menú): fuera el panel huérfano
        const viejo = overlay.querySelector('.termPanel');
        if (viejo && !viejo.childNodes.length) viejo.remove();
        return;
      }

      let panel = overlay.querySelector('.termPanel');
      if (!panel || panel.parentNode !== overlay){
        panel = document.createElement('div');
        panel.className = 'termPanel';
        overlay.appendChild(panel);
      }
      // mover conserva los listeners ya enganchados por ui.js / shop.js
      sueltos.forEach(n => panel.appendChild(n));

      const modo = modoDe();
      panel.dataset.mode = modo;
      panel.dataset.title = TITULOS[modo];
    }

    new MutationObserver(envolver)
      .observe(overlay, { childList:true, subtree:false, attributes:true, attributeFilter:['class'] });
    envolver();
  }
})();