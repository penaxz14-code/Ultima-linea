/* ============================================================
   ÚLTIMA LÍNEA — BESTIARIO
   ------------------------------------------------------------
   Panel de fichas de enemigos, abierto desde el botón BESTIARIO
   del menú principal. NO TOCA la lógica del juego: solo lee las
   rejillas y paletas que enemies.js y bosses.js ya definen, y
   las hornea a un canvas para mostrar el sprite real de cada
   ficha. Si mañana cambia un sprite, el bestiario lo refleja
   solo — no hay copias de las rejillas acá.

   Los números de cada ficha salen del código, no están
   inventados: las fórmulas de blindaje (runnerHelmetHp,
   riotHelmetHp, riotShieldHp) se evalúan en vivo para la oleada
   que elija el jugador con el selector de arriba, así se ve cómo
   se endurece cada enemigo a lo largo de la partida.

   Único enganche externo: window.__openBestiary, que menu.js
   llama igual que ya llama a window.__openSoundSettings.
   ============================================================ */
(function(){
  'use strict';

  const zona = document.getElementById('gameArea');
  if (!zona) return;

  /* ---------- 1 · fichas ---------- */
  //  hp() y notas se resuelven contra la oleada elegida para que los
  //  números coincidan exactamente con los que verá el jugador.
  const FICHAS = [
    {
      id: 'walker',
      nombre: 'CAMINANTE',
      alias: 'Infectado común',
      desde: 1,
      peso: 'base',
      color: '#7bbf4a',
      texto: 'El grueso de la horda. Sin blindaje ni tácticas: avanza recto hacia vos hasta que algo lo detiene. Es el enemigo contra el que se calibra todo lo demás.',
      stats: (w) => [
        ['Velocidad', 'Lenta'],
        ['Cabeza', (2 + Math.floor((w-1)/5)) + ' impactos'],
        ['Cuerpo', (3 + Math.floor((w-1)/2)) + ' impactos'],
        ['Daño al contacto', '9'],
        ['Blindaje', 'Ninguno']
      ],
      tacticas: ['Sin táctica: avance frontal directo.'],
      consejo: 'Dos tiros a la cabeza lo bajan más barato que tres al cuerpo. Volarle los pies lo deja arrastrándose al 22% de velocidad.'
    },
    {
      id: 'runner',
      nombre: 'CORREDOR',
      alias: 'Infectado veloz',
      desde: 5,
      peso: '0.35',
      color: '#a8e070',
      texto: 'Más del doble de rápido que un caminante y con casco ligero. Su identidad es la velocidad pura: no flanquea ni se coordina, simplemente llega antes de lo que esperás.',
      stats: (w) => [
        ['Velocidad', '×2.1 — muy alta'],
        ['Casco', Math.min(2 + Math.floor((w-5)/4), 8) + ' impactos'],
        ['Cabeza (tras casco)', (2 + Math.floor((w-1)/5)) + ' impactos'],
        ['Cuerpo', (3 + Math.floor((w-1)/2)) + ' impactos'],
        ['Daño al contacto', '9']
      ],
      tacticas: ['Sin táctica: velocidad pura.'],
      consejo: 'Primero el casco, después la cabeza. Si lo dejás llegar no vas a tener tiempo de recargar — abrí fuego lejos.'
    },
    {
      id: 'riot',
      nombre: 'ANTIDISTURBIOS',
      alias: 'Unidad de control blindada',
      desde: 10,
      peso: '0.28',
      color: '#8fa6c8',
      texto: 'Yelmo integral y escudo de policarbonato. El escudo cubre pies y torso pero deja la cabeza expuesta: no hay atajo por los pies, hay que elegir por dónde entrar.',
      stats: (w) => [
        ['Velocidad', '×0.8 — lenta'],
        ['Yelmo', Math.min(8 + Math.floor((w-10)/3), 16) + ' impactos'],
        ['Escudo', Math.min(4 + Math.floor((w-10)/5), 9) + ' impactos'],
        ['Cuerpo (tras escudo)', (3 + Math.floor((w-1)/2)) + ' impactos'],
        ['Daño al contacto', '9']
      ],
      tacticas: ['Oleada 10+: se agrupan en línea de formación.'],
      consejo: 'Reventar el escudo y rematar al torso con escopeta sale a la mitad de balas que perforar el yelmo. Matarlo de cabeza se puede, pero cuesta el doble.'
    },
    {
      id: 'spitter',
      nombre: 'ESCUPIDOR',
      alias: 'Infectado de glándula ácida',
      desde: 15,
      peso: '0.24',
      color: '#c8e070',
      texto: 'El primer enemigo que no necesita tocarte. Se planta a distancia y lanza ácido en parábola. Quedarte quieto contra un escupidor es la forma más barata de perder la partida.',
      stats: (w) => [
        ['Velocidad', 'Lenta'],
        ['Se detiene a', '240 px'],
        ['Daño del ácido', '11'],
        ['Cadencia', '2.2 – 3.5 s'],
        ['Daño al contacto', '9']
      ],
      tacticas: [
        'Oleada 15+: dos escupidores se reparten carriles y montan fuego cruzado.',
        'Coordinados disparan un 25% más rápido.'
      ],
      consejo: 'El ácido va en parábola: moverte lateralmente lo esquiva casi siempre. Cerrá distancia o matalo antes de que se acomode.'
    },
    {
      id: 'brute',
      nombre: 'TANQUE',
      alias: 'Infectado masivo',
      desde: 20,
      peso: '0.16',
      color: '#e0483a',
      texto: 'Enorme, lento y con el triple de aguante en el cuerpo. Inmune a perder los pies. Te empuja al golpear y no se deja acorralar: si te acercás demasiado, retrocede y vuelve.',
      stats: (w) => [
        ['Velocidad', '×0.65 — muy lenta'],
        ['Tamaño', '×1.55'],
        ['Cabeza', (2 + Math.floor((w-1)/5) + 1) + ' impactos'],
        ['Cuerpo', ((3 + Math.floor((w-1)/2)) * 3) + ' impactos'],
        ['Daño al contacto', '16 + empujón']
      ],
      tacticas: [
        'Oleada 20+: se retira si te acercás a menos de 180 px y vuelve a entrar (emboscada).',
        'No se le pueden volar los pies.'
      ],
      consejo: 'No gastes balas en el cuerpo: con el triple de aguante es el peor negocio del juego. A la cabeza, y de lejos.'
    },
    {
      id: 'boss',
      nombre: 'EL ABOMINABLE',
      alias: 'Objetivo prioritario · Oleada 25',
      desde: 25,
      peso: 'único',
      color: '#ff2d4e',
      jefe: true,
      texto: 'El final del Acto I. Tres fases encadenadas, cada una con su propio patrón de ataque. Mientras vive, el reloj de oleada se congela y no entra ningún otro infectado: es un duelo.',
      stats: () => [
        ['Fase 1 · Blindado', '3 puntos débiles (26 / 30 / 34)'],
        ['Fase 2 · Expuesto', 'Columnas de fuego'],
        ['Fase 3 · Mutación', 'Aliento ácido y puñetazo'],
        ['Arena', 'Cerrada — no se puede huir'],
        ['Recompensa', '+3000 pts · +200¢ · mejora gratis']
      ],
      tacticas: [
        'Fase 1: hay que reventar los tres puntos débiles del blindaje.',
        'Fase 2: cae el blindaje y aparecen las columnas de fuego.',
        'Fase 3: la criatura sale del chasis — aliento ácido y golpe de suelo.'
      ],
      consejo: 'Contra el jefe TODA arma cuenta como en zona óptima: usá la que más daño por segundo te dé, no la que mejor alcance tenga.'
    }
  ];

  /* ---------- 2 · sprites: se hornean de las rejillas reales ---------- */
  function bake(rows, palette, escala){
    const c = document.createElement('canvas');
    const cols = rows[0].length, filas = rows.length;
    c.width = cols*escala; c.height = filas*escala;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    for (let r=0;r<filas;r++){
      for (let col=0; col<rows[r].length; col++){
        const ch = rows[r][col];
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) continue;
        x.fillStyle = color;
        x.fillRect(col*escala, r*escala, escala, escala);
      }
    }
    return c;
  }

  // arma la figura completa (cabeza + torso + piernas) del tipo pedido
  // usando exactamente las mismas rejillas que dibuja renderer.js
  function retrato(ficha){
    try {
      if (ficha.jefe) return null;   // el jefe se dibuja con su propia marca
      if (typeof ZOMBIE_TORSO === 'undefined') return null;

      let head;
      if (ficha.id === 'riot' && typeof RIOT_HEAD !== 'undefined') head = RIOT_HEAD;
      else if (ficha.id === 'runner' && typeof RUNNER_HEAD !== 'undefined') head = RUNNER_HEAD;
      else head = ZOMBIE_HEAD;

      const palette = (typeof zombiePalette === 'function')
        ? zombiePalette(ficha.id)
        : ZOMBIE_PALETTE;

      const cuerpo = head.concat(ZOMBIE_TORSO);
      const ancho = Math.max.apply(null, cuerpo.map(r => r.length));
      const filas = cuerpo.map(r => r.padEnd(ancho, '.'));

      // piernas centradas debajo del torso
      if (typeof ZOMBIE_LEG !== 'undefined'){
        const legW = ZOMBIE_LEG[0].length;
        const pad = Math.floor((ancho - legW*2 - 2)/2);
        ZOMBIE_LEG.forEach(fila => {
          filas.push('.'.repeat(Math.max(pad,0)) + fila + '..' + fila);
        });
      }
      const anchoFinal = Math.max.apply(null, filas.map(r => r.length));
      return bake(filas.map(r => r.padEnd(anchoFinal, '.')), palette, 3);
    } catch(e){ return null; }
  }

  // escudo aparte: se muestra al lado del antidisturbios
  function retratoEscudo(){
    try {
      if (typeof SHIELD_GRID === 'undefined') return null;
      return bake(SHIELD_GRID, SHIELD_PALETTE, 3);
    } catch(e){ return null; }
  }

  /* ---------- 3 · panel ---------- */
  const panel = document.createElement('div');
  panel.id = 'bestPanel';
  panel.className = 'hidden';
  zona.appendChild(panel);

  let oleada = 25;          // por defecto, la oleada final del demo
  let seleccion = 0;

  function statsHTML(ficha){
    return ficha.stats(oleada).map(([k,v]) =>
      '<div class="bestStat"><span>' + k + '</span><b>' + v + '</b></div>'
    ).join('');
  }

  function tacticasHTML(ficha){
    return ficha.tacticas.map(t => '<li>' + t + '</li>').join('');
  }

  function pintarFicha(){
    const ficha = FICHAS[seleccion];
    const cuerpo = panel.querySelector('.bestFicha');
    if (!cuerpo) return;

    cuerpo.innerHTML =
      '<div class="bestFichaHead">' +
        '<div class="bestRetrato"></div>' +
        '<div class="bestTitulo">' +
          '<h4 style="color:' + ficha.color + '">' + ficha.nombre + '</h4>' +
          '<i>' + ficha.alias + '</i>' +
          '<span class="bestDesde">APARECE EN OLEADA ' + ficha.desde + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="bestTexto">' + ficha.texto + '</p>' +
      '<div class="bestStats">' + statsHTML(ficha) + '</div>' +
      '<div class="bestBloque"><h5>TÁCTICAS</h5><ul>' + tacticasHTML(ficha) + '</ul></div>' +
      '<div class="bestBloque consejo"><h5>CÓMO CAERLE</h5><p>' + ficha.consejo + '</p></div>';

    const hueco = cuerpo.querySelector('.bestRetrato');
    const img = retrato(ficha);
    if (img){
      img.className = 'bestSprite';
      hueco.appendChild(img);
      if (ficha.id === 'riot'){
        const esc = retratoEscudo();
        if (esc){ esc.className = 'bestSprite bestSpriteEscudo'; hueco.appendChild(esc); }
      }
    } else {
      hueco.innerHTML = '<span class="bestSinSprite" style="color:' + ficha.color + '">?</span>';
    }

    panel.querySelectorAll('.bestTab').forEach((t, i) => {
      t.classList.toggle('on', i === seleccion);
    });
  }

  function construir(){
    panel.innerHTML =
      '<div class="bestCard">' +
        '<header class="bestHead">' +
          '<h3>BESTIARIO</h3>' +
          '<div class="bestOleada">' +
            '<label for="bestWaveSlider">DATOS EN OLEADA</label>' +
            '<input type="range" id="bestWaveSlider" min="1" max="25" step="1" value="' + oleada + '">' +
            '<b class="bestWaveVal">' + oleada + '</b>' +
          '</div>' +
        '</header>' +
        '<nav class="bestTabs">' +
          FICHAS.map((f,i) =>
            '<button type="button" class="bestTab' + (i===0?' on':'') + '" data-i="' + i + '"' +
              (f.jefe ? ' data-jefe="1"' : '') + '>' +
              '<span class="bestTabPunto" style="background:' + f.color + '"></span>' +
              f.nombre +
            '</button>'
          ).join('') +
        '</nav>' +
        '<div class="bestFicha"></div>' +
        '<div class="bestBtns"><button type="button" class="bestClose">CERRAR</button></div>' +
      '</div>';

    panel.querySelectorAll('.bestTab').forEach(t => {
      t.addEventListener('click', () => {
        seleccion = parseInt(t.dataset.i, 10);
        if (typeof playClickSound === 'function'){ try { playClickSound(); } catch(e){} }
        pintarFicha();
      });
    });

    const slider = panel.querySelector('#bestWaveSlider');
    slider.addEventListener('input', () => {
      oleada = parseInt(slider.value, 10);
      panel.querySelector('.bestWaveVal').textContent = oleada;
      slider.style.setProperty('--relleno', ((oleada-1)/24*100) + '%');
      pintarFicha();
    });
    slider.style.setProperty('--relleno', ((oleada-1)/24*100) + '%');

    panel.querySelector('.bestClose').addEventListener('click', cerrar);
    panel.addEventListener('click', e => { if (e.target === panel) cerrar(); });
  }

  function abrir(){
    if (!panel.querySelector('.bestCard')) construir();
    pintarFicha();
    panel.classList.remove('hidden');
  }

  function cerrar(){
    panel.classList.add('hidden');
    if (typeof playClickSound === 'function'){ try { playClickSound(); } catch(e){} }
  }

  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && !panel.classList.contains('hidden')){
      e.stopPropagation();
      cerrar();
    }
  }, true);

  window.__openBestiary = abrir;
})();
