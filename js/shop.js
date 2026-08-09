let coins = 0;

let ammoLevel = 0, reloadLevel = 0;

  const SHOP_ITEMS = [
    { id:'ammo', name:'Cargador ampliado', desc:'+3 munición máx.', base:17, level:0, max:4 },
    { id:'reload', name:'Recarga veloz', desc:'Recarga aún más rápido', base:18, level:0, max:4 },
    { id:'medkit', name:'Botiquín', desc:'+25 de vida', base:12, level:0, max:null },
    { id:'shotgun', name:'Escopeta', desc:'3 perdigones por disparo', base:48, level:0, max:1 },
    { id:'smg', name:'Metralleta', desc:'Cadencia muy rápida, automática', base:65, level:0, max:1 },
    { id:'dash', name:'Dash esquiva', desc:'Invulnerable un instante, cooldown baja con las oleadas', base:60, level:0, max:1 }
  ];

  function itemCost(item){
    return Math.round(item.base * Math.pow(1.35, item.level));
  }

  function openShop(){
    paused = true;
    inShop = true;
    firing = false;
    overlay.classList.remove('hidden');
    overlay.classList.add('shopMode');
    renderShopHTML();
  }

  // ---- debug: adelantar a una oleada específica para probar mecánicas (temporal) ----
  function skipWave(){
    if (!running || inShop) return;
    const input = window.prompt('¿A qué oleada querés saltar?', wave + 1);
    if (input === null) return;
    const target = parseInt(input, 10);
    if (!Number.isFinite(target) || target < 1) return;
    wave = target;
    waveVal.textContent = wave;
    waveTimer = 20;
    playWaveSound();
    openShop();
    // el salto tiene que invocar al jefe igual que lo hace updateWave():
    // si no, saltar a la oleada 25 se la comía entera — el reloj seguía,
    // pasaba a la 26 y la comprobación `wave === BOSS_WAVE` no se cumplía
    // nunca más, dejando la partida sin jefe hasta reiniciar.
    if (wave === BOSS_WAVE && !bossActive()) spawnBoss();
  }

  function closeShop(){
    playClickSound();
    inShop = false;
    paused = false;
    overlay.classList.add('hidden');
    overlay.classList.remove('shopMode');
  }

  function buyItem(id){
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item) return;
    if (item.max !== null && item.level >= item.max) return;
    const cost = itemCost(item);
    if (coins < cost) return;
    coins -= cost;
    item.level += 1;
    if (id === 'ammo'){
      ammoLevel = item.level;
      recomputeMaxAmmo();          // suma el nivel de tienda + el bono de mejoras
      ammo = maxAmmo;
      ammoVal.textContent = ammo;
      ammoVal.classList.remove('empty');
    } else if (id === 'reload'){
      reloadLevel = item.level;    // el bono de mejoras se suma en reloadTimeNow()
    } else if (id === 'medkit'){
      // el tope tiene que ser el máximo EFECTIVO (base + mejoras). Con
      // MAX_HEALTH fijo, si una mejora te había subido por encima de 100
      // el Math.min te la RECORTABA: el botiquín quitaba vida en vez de
      // darla. Y el ancho salía como "130%", desbordando la barra.
      const maxVida = (typeof UPG !== 'undefined') ? UPG.effectiveMaxHealth() : MAX_HEALTH;
      health = Math.min(maxVida, health + 25);
      healthInner.style.width = (health / maxVida * 100) + '%';
    } else if (id === 'shotgun'){
      hasShotgun = true;
      weapon = 'shotgun';
      updateWeaponHUD();
    } else if (id === 'smg'){
      hasSMG = true;
      weapon = 'smg';
      updateWeaponHUD();
    } else if (id === 'dash'){
      hasDash = true;
    }
    coinVal.textContent = coins;
    playCoinSound();
    renderShopHTML();
  }

  window.__shopBuy = buyItem;

  const SHOP_ICONS = {
    ammo: '<svg viewBox="0 0 24 24" width="30" height="30"><rect x="8" y="1" width="8" height="5" fill="#ffd166"/><rect x="6" y="6" width="12" height="15" rx="2" fill="#e0a030" stroke="#7a4a10" stroke-width="1.4"/><line x1="9" y1="10" x2="9" y2="18" stroke="#7a4a10" stroke-width="1.2"/><line x1="12" y1="10" x2="12" y2="18" stroke="#7a4a10" stroke-width="1.2"/><line x1="15" y1="10" x2="15" y2="18" stroke="#7a4a10" stroke-width="1.2"/></svg>',
    reload: '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 4 A8 8 0 1 1 4.6 8.6" fill="none" stroke="#4deeea" stroke-width="2.6" stroke-linecap="round"/><polygon points="13,0 13,7 7,3.5" fill="#4deeea"/></svg>',
    medkit: '<svg viewBox="0 0 24 24" width="30" height="30"><rect x="2" y="6" width="20" height="15" rx="3" fill="#e8e2c9" stroke="#ff2d4e" stroke-width="1.6"/><rect x="10" y="9" width="4" height="9" fill="#ff2d4e"/><rect x="6.5" y="12" width="11" height="4" fill="#ff2d4e"/><rect x="7" y="3" width="10" height="3.5" rx="1" fill="#b0a888"/></svg>',
    shotgun: '<svg viewBox="0 0 24 24" width="34" height="34"><rect x="1" y="12" width="15" height="3" fill="#2a2a2e"/><rect x="13" y="10" width="8" height="2.4" fill="#151517"/><rect x="4" y="15" width="3" height="6" fill="#4a2410"/><rect x="18" y="10.8" width="2.4" height="1.4" fill="#ff3b30"/><rect x="1" y="12" width="15" height="1" fill="#6a6f75"/></svg>',
    smg: '<svg viewBox="0 0 24 24" width="34" height="34"><rect x="2" y="9" width="16" height="4" fill="#3a3d42"/><rect x="16" y="8.5" width="5" height="2" fill="#202224"/><rect x="6" y="13" width="3" height="7" fill="#151517"/><rect x="1" y="10.5" width="3" height="1.4" fill="#7a808a"/></svg>',
    dash: '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M13 1 L4 14 L11 14 L9 23 L20 9 L13 9 Z" fill="#6fd0ff" stroke="#1a4a66" stroke-width="1"/></svg>'
  };

  // ---- render: sólo maquetado; la lógica de arriba no cambia ----
  const SHOP_TIPS = [
    'Combiná daño y supervivencia para llegar más lejos.',
    'Volarles los pies los deja arrastrándose por el asfalto.',
    'Al corredor, primero el casco: dos tiros y cae.',
    'Al antidisturbios apuntale a los pies y pierde el escudo.',
    'Guardá monedas antes de la 20: el tanque explota al morir.',
    'La escopeta gasta 2 balas por disparo. Mirá el cargador.'
  ];

  function shopWing(side){
    if (window.UPG) return side === 'l' ? UPG.WING_L : UPG.WING_R;
    return '';
  }

  // si js/upgrades.js no cargó, las columnas quedarían en blanco:
  // mejor decirlo en pantalla que dejar dos huecos negros
  function perksMissingPanel(where){
    return `
      <section class="ulPanel perksMissing">
        <header class="panelHead"><span class="headRule"></span><h3>MÓDULO NO CARGADO</h3><span class="headRule"></span></header>
        <p>No se encontró <b>js/upgrades.js</b>, así que el panel de ${where} no puede dibujarse.</p>
        <p class="hint">Revisá que el archivo exista y que index.html tenga
        <b>&lt;script src="js/upgrades.js"&gt;&lt;/script&gt;</b> antes de <b>js/shop.js</b>.</p>
      </section>`;
  }

  function renderShopItemsHTML(){
    return SHOP_ITEMS.map(item => {
      const cost = itemCost(item);
      const maxed = item.max !== null && item.level >= item.max;
      const afford = coins >= cost;
      const label = maxed ? 'MÁX' : (cost + '¢');
      const disabled = (maxed || !afford) ? 'disabled' : '';
      const state = maxed ? ' maxed' : (afford ? '' : ' broke');
      const lvl = item.max
        ? `<span class="itemLvl">Nv.${item.level}/${item.max}</span>`
        : (item.level ? `<span class="itemLvl">x${item.level}</span>` : '');
      return `
        <article class="gearRow${state}">
          <div class="gearIcon">${SHOP_ICONS[item.id] || ''}</div>
          <div class="gearInfo">
            <b>${item.name}</b>
            <span>${item.desc}</span>
            ${lvl}
          </div>
          <button type="button" class="gearBuy" ${disabled} onclick="window.__shopBuy('${item.id}')">${label}</button>
        </article>`;
    }).join('');
  }

  function renderShopHTML(){
    const skull = window.UPG ? UPG.SKULL : '';
    const crest = window.UPG ? UPG.CREST : '';
    const tip = SHOP_TIPS[wave % SHOP_TIPS.length];

    overlay.innerHTML = `
      <div class="shopScreen">

        <div class="shopBar">
          <div class="barSlot barLeft">
            <span class="barTag">DEPÓSITO DE CAMPAÑA</span>
            <span class="barSub">Oleada ${wave} · alto el fuego</span>
          </div>
          <div class="barSlot barCenter">
            <span class="barOrn">${crest}</span>
            <h2 class="shopTitle">EQUIPAMIENTO</h2>
          </div>
          <div class="barSlot barRight">
            <span class="barTag">MONEDAS DISPONIBLES</span>
            <span class="barCoins">${coins}<i>¢</i></span>
          </div>
        </div>

        <div class="shopBody">

          <div class="shopCol colLeft">
            <section class="ulPanel gearPanel">
              <header class="panelHead big">${shopWing('l')}<h3>TIENDA</h3>${shopWing('r')}</header>
              <div class="gearList">${renderShopItemsHTML()}</div>
            </section>
          </div>

          <div class="shopCol colCenter">${window.UPG ? UPG.renderCenter() : perksMissingPanel('mejoras')}</div>

          <div class="shopCol colRight">${window.UPG ? UPG.renderSide() : perksMissingPanel('mejoras activas')}</div>

        </div>

        <div class="shopFoot">
          <span class="footCrest">${crest}</span>
          <span class="footTip">
            <span class="tipStar"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="12,4.4 14.1,10 20,10 15.2,13.6 17,19.4 12,15.9 7,19.4 8.8,13.6 4,10 9.9,10"/></svg></span>
            <b>Consejo:</b> ${tip}
          </span>
          <button type="button" id="shopContinue">CONTINUAR OLEADA</button>
          <span class="footWarn">${skull}El jefe aparece en la oleada 25.</span>
        </div>

      </div>
    `;
    document.getElementById('shopContinue').addEventListener('click', closeShop);
    const maxAmmoEl = document.getElementById('maxAmmoVal');
    if (maxAmmoEl) maxAmmoEl.textContent = maxAmmo;
  }
