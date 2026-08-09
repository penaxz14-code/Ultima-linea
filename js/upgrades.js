/* ============================================================
   ÚLTIMA LÍNEA — SISTEMA DE MEJORAS (UPG)
   ------------------------------------------------------------
   Este es el módulo que game.js, player.js, weapons.js, enemies.js
   y bosses.js ya llaman por su nombre: UPG. No es una capa nueva
   ni una reinterpretación — implementa exactamente los hooks que
   esos archivos referencian, así que no hace falta tocarlos.

   API que consume el resto del juego (ya existente en el código):
     UPG.reset()                    — game.js, al empezar partida
     UPG.update(dt)                 — game.js, cada frame
     UPG.dashCooldownBonus()        — player.js, resta al cooldown
     UPG.incomingDamageMult()       — player.js, al recibir daño
     UPG.effectiveMaxHealth()       — player.js, para la barra de vida
     UPG.onPlayerDamaged()          — player.js, justo antes del
                                       chequeo de game over: acá
                                       engancha el revivir con
                                       "Protocolo Fénix"
     UPG.onDashStart()              — player.js, al iniciar el dash
     UPG.moveSpeedMult()            — player.js, multiplicador EN VIVO
                                       (no se hornea en player.speed)
     UPG.reloadSpeedMult()          — weapons.js, divide el tiempo
     UPG.extraAmmo()                — weapons.js, bono de munición
     UPG.spreadMult()               — weapons.js, abre/cierra spread
     UPG.bulletSpeedMult()          — weapons.js, velocidad de bala
     UPG.pierceCount()              — weapons.js, penetración
     UPG.onShotFired(bullets)       — weapons.js, después de disparar;
                                       acá se marca la bala explosiva
                                       cada 8 disparos ("Bala Explosiva")
     UPG.damage(base, meta?)        — enemies.js / bosses.js, daño de
                                       salida del jugador. meta admite
                                       {head, x, y}; devuelve el daño
                                       ya con crítico y bonos aplicados
     UPG.coins(base)                — enemies.js / bosses.js, monedas
                                       otorgadas por golpe/kill
     UPG.enemySpeedMult(dist)       — enemies.js, multiplicador de
                                       velocidad del zombie según su
                                       distancia al jugador (campo de
                                       frenado)
     UPG.enemyPushDistance()        — enemies.js, empuje que recibe el
                                       zombie golpeado (0 sin mejora)
     UPG.onKill(z)                  — enemies.js, al morir un zombie
                                       (punto de enganche)
     UPG.triggerExplosion(x,y,z)    — enemies.js, cuando impacta una
                                       bala marcada como explosiva

   API que usa shop.js para dibujar las columnas central y derecha:
     UPG.renderCenter(), UPG.renderSide()

   Todo vive en un IIFE y expone solo `window.UPG`.
   ============================================================ */
(function(){
  'use strict';

  // ---- rarezas: weight = probabilidad de salir en cada carta ----
  const RARITIES = {
    comun:      { label:'COMÚN',      weight:0.45 },
    rara:       { label:'RARA',       weight:0.27 },
    especial:   { label:'ESPECIAL',   weight:0.16 },
    epica:      { label:'ÉPICA',      weight:0.09 },
    legendaria: { label:'LEGENDARIA', weight:0.03 }
  };

  // techos para que una buena partida no deje al soldado invencible
  const MAX_LEGENDARY = 2;
  const LEGENDARY_MIN_WAVE = 15;
  const EPIC_MIN_WAVE = 10;
  const EVERY = 5;
  const MILESTONES = [5, 10, 15, 20, 25];

  /* ============================================================
     ESTADO MECÁNICO
     Todo lo que las mejoras pueden afectar vive acá, como bonos
     y multiplicadores independientes. player.js / weapons.js
     preguntan estos valores en vivo; nunca se escribe encima de
     sus variables (player.speed, maxAmmo, reloadLevel...).
     ============================================================ */
  const mech = {
    damageMult: 1,
    maxHealthBonus: 0,
    dashCdBonus: 0,
    moveSpeedMult: 1,
    reloadSpeedMult: 1,
    extraAmmo: 0,
    spreadMult: 1,
    bulletSpeedMult: 1,
    pierceCount: 0,
    phoenixCharges: 0,
    // ---- nuevos: daño de salida, monedas, empuje, ralentí, explosivo ----
    coinMult: 1,             // coins()
    damageBonusChance: 0,    // damage(): prob. de +1 punto de daño
    headDamageBonus: 0,      // damage(): bonus fijo sólo en headshots
    critChance: 0,           // damage(): prob. de golpe crítico (x2)
    bulletPushDist: 0,       // enemyPushDistance()
    slowFieldRadius: 0,      // enemySpeedMult(): radio del campo (px)
    slowFieldMult: 1,        // enemySpeedMult(): multiplicador dentro del radio
    explosiveEnabled: false, // onShotFired(): activa el conteo de disparos
    shotsSinceExplosive: 0   // onShotFired(): contador interno
  };

  const state = {
    owned: [],
    offer: null,
    offerWave: 0,
    selectedId: null
  };

  function resetMech(){
    mech.damageMult = 1;
    mech.maxHealthBonus = 0;
    mech.dashCdBonus = 0;
    mech.moveSpeedMult = 1;
    mech.reloadSpeedMult = 1;
    mech.extraAmmo = 0;
    mech.spreadMult = 1;
    mech.bulletSpeedMult = 1;
    mech.pierceCount = 0;
    mech.phoenixCharges = 0;
    mech.coinMult = 1;
    mech.damageBonusChance = 0;
    mech.headDamageBonus = 0;
    mech.critChance = 0;
    mech.bulletPushDist = 0;
    mech.slowFieldRadius = 0;
    mech.slowFieldMult = 1;
    mech.explosiveEnabled = false;
    mech.shotsSinceExplosive = 0;
  }

  function reset(){
    resetMech();
    state.owned = [];
    state.offer = null;
    state.offerWave = 0;
    state.selectedId = null;
  }

  function update(dt){
    // sin mejoras temporizadas por ahora; queda el punto de enganche
    // listo para cuando se agregue una (ej. "Adrenalina, 3 oleadas").
  }

  // ---- helpers de estado ----
  function ownedEntry(id){ return state.owned.find(o => o.id === id) || null; }
  function byId(id){ return POOL.find(u => u.id === id) || null; }
  function levelOf(id){ const e = ownedEntry(id); return e ? e.level : 0; }
  function legendaryCount(){
    return state.owned.filter(o => { const u = byId(o.id); return u && u.rarity === 'legendaria'; }).length;
  }
  function totalPicks(){ return state.owned.reduce((s,o) => s + o.level, 0); }

  function heal(amount){
    const max = MAX_HEALTH + mech.maxHealthBonus;
    health = Math.min(max, health + amount);
    healthInner.style.width = (health / max * 100) + '%';
  }

  /* ============================================================
     HOOKS QUE CONSUME EL RESTO DEL JUEGO
     ============================================================ */
  function dashCooldownBonus(){ return mech.dashCdBonus; }
  function incomingDamageMult(){ return mech.damageMult; }
  function effectiveMaxHealth(){ return MAX_HEALTH + mech.maxHealthBonus; }
  function moveSpeedMult(){ return mech.moveSpeedMult; }
  function reloadSpeedMult(){ return mech.reloadSpeedMult; }
  function extraAmmo(){ return mech.extraAmmo; }
  function spreadMult(){ return mech.spreadMult; }
  function bulletSpeedMult(){ return mech.bulletSpeedMult; }
  function pierceCount(){ return mech.pierceCount; }

  // se llama DESPUÉS de restar vida y ANTES de endGame(): si hay
  // carga de Fénix y la vida quedó en 0 o menos, revive acá mismo.
  function onPlayerDamaged(){
    if (health <= 0 && mech.phoenixCharges > 0){
      mech.phoenixCharges -= 1;
      health = 50;
      const max = effectiveMaxHealth();
      healthInner.style.width = (health / max * 100) + '%';
      // ventana de invulnerabilidad al revivir: sin esto resucitabas con
      // 50 de vida justo encima del ataque que acababa de matarte (el
      // puñetazo del jefe, una columna de fuego, un charco de ácido) y
      // morías otra vez en menos de un segundo — parecía que el Fénix
      // no se había activado nunca. player.invulnT lo consume el mismo
      // temporizador que ya usa el dash.
      if (typeof player !== 'undefined'){
        player.invulnT = Math.max(player.invulnT || 0, 1.6);
        player.invulnerable = true;
      }
      if (typeof playRoarSound === 'function') playRoarSound();
      if (typeof spawnParticles === 'function' && typeof player !== 'undefined'){
        spawnParticles(player.x, groundY + GROUND_DEPTH_OFFSET - 30, '#7dff4d', 20, 170);
      }
    }
  }

  function onDashStart(){ /* punto de enganche, sin efecto por ahora */ }

  // cada 8 disparos (contando perdigones), el último de la ráfaga
  // queda marcado como explosivo — enemies.js ya lee b.explosive y
  // llama a UPG.triggerExplosion() cuando corresponde; acá sólo se
  // pone la marca. Sin la mejora "Bala Explosiva" no hace nada.
  const EXPLOSIVE_EVERY = 8;
  function onShotFired(bullets){
    if (!mech.explosiveEnabled || !bullets || !bullets.length) return;
    mech.shotsSinceExplosive += bullets.length;
    if (mech.shotsSinceExplosive >= EXPLOSIVE_EVERY){
      mech.shotsSinceExplosive -= EXPLOSIVE_EVERY;
      bullets[bullets.length - 1].explosive = true;
    }
  }

  // ---- daño de salida del jugador (enemies.js / bosses.js) ----
  // base = puntos que le sacarían al HP pool golpeado (helmetHp, headHp,
  // shieldHp, bodyHp o el HP de un punto débil del jefe) sin mejoras.
  // meta = {head, x, y}; head sólo lo pasan los zombies comunes (el
  // jefe no tiene zona de cabeza, así que nunca recibe ese bonus).
  const CRIT_MULT = 2;
  function damageOut(base, meta){
    meta = meta || {};
    let amt = base;
    // bonus fijo de "+1" con cierta probabilidad, en vez de un % que
    // en pools de 1-2 HP se perdería siempre al redondear
    if (mech.damageBonusChance > 0 && Math.random() < mech.damageBonusChance) amt += 1;
    if (meta.head && mech.headDamageBonus > 0) amt += mech.headDamageBonus;
    if (mech.critChance > 0 && Math.random() < mech.critChance){
      amt *= CRIT_MULT;
      if (typeof meta.x === 'number' && typeof spawnParticles === 'function'){
        spawnParticles(meta.x, meta.y, '#ffe066', 5, 90);
      }
    }
    return Math.max(1, Math.round(amt));
  }

  // ---- monedas otorgadas (enemies.js / bosses.js) ----
  // redondeo probabilístico: con base=1 y +15%, la mitad de las veces
  // que corresponda da 2 en vez de 1, así el bono es real incluso en
  // los premios más chicos y no se pierde siempre al redondear.
  function coinsBonus(base){
    const exact = base * mech.coinMult;
    const floor = Math.floor(exact);
    const frac = exact - floor;
    return floor + (Math.random() < frac ? 1 : 0);
  }

  // ---- campo de frenado (enemies.js, dentro de updateZombiesAI) ----
  function enemySpeedMultFn(dist){
    if (mech.slowFieldRadius > 0 && typeof dist === 'number' && dist <= mech.slowFieldRadius){
      return mech.slowFieldMult;
    }
    return 1;
  }

  // ---- empuje al zombie golpeado (enemies.js, resolveBulletHits) ----
  function enemyPushDistanceFn(){ return mech.bulletPushDist; }

  // ---- punto de enganche al matar un zombie (enemies.js, killZombie) ----
  function onKill(z){ /* sin efecto por ahora; listo para una mejora futura */ }

  // ---- explosión de la bala marcada (enemies.js, resolveBulletHits) ----
  // z = el zombie que ya recibió el golpe directo; no vuelve a tocarlo,
  // sólo salpica daño de área a los que están alrededor.
  function triggerExplosion(x, y, hitZombie){
    const RADIUS = 70, SPLASH_DMG = 2;
    if (typeof zombies !== 'undefined'){
      zombies.forEach(z => {
        if (z === hitZombie || z.dead || z.dying) return;
        if (Math.abs(z.x - x) > RADIUS) return;
        z.bodyHp -= SPLASH_DMG;
        if (typeof BODY_HITS !== 'undefined') z.bodyStage = Math.min(z.bodyStage + 1, BODY_HITS);
        if (z.bodyHp <= 0 && typeof killZombie === 'function') killZombie(z);
      });
    }
    if (typeof spawnParticles === 'function'){
      spawnParticles(x, y, '#ff6b2a', 16, 170);
      spawnParticles(x, y, '#ffb020', 10, 120);
    }
    if (typeof spawnChunks === 'function') spawnChunks(x, y, '#3a3a3a', 6, 140);
    if (typeof playExplosionSound === 'function') playExplosionSound();
  }

  /* ============================================================
     CATÁLOGO
     apply(): suma el efecto sobre `mech` o sobre otro estado
     mutable propio del juego (recomputeMaxAmmo, heal...).
     ============================================================ */
  const POOL = [
    // ---------------- COMÚN ----------------
    { id:'p_ammo', rarity:'comun', max:3,
      name:'MUNICIÓN EXTRA', desc:'Un par de balas más en cada cargador.',
      effect:'+2 munición máxima',
      apply(){ mech.extraAmmo += 2; recomputeMaxAmmo(); } },

    { id:'p_hands', rarity:'comun', max:3,
      name:'MANOS FIRMES', desc:'Cambiás el cargador sin mirarlo.',
      effect:'+15% velocidad de recarga',
      apply(){ mech.reloadSpeedMult *= 1.15; } },

    { id:'p_rations', rarity:'comun', max:null,
      name:'RACIONES DE CAMPO', desc:'Comida enlatada y vendas del botiquín del convoy.',
      effect:'+20 de vida al instante',
      apply(){ heal(20); } },

    { id:'p_boots', rarity:'comun', max:3,
      name:'BOTAS LIGERAS', desc:'Menos peso encima, más metros por segundo.',
      effect:'+10% velocidad',
      apply(){ mech.moveSpeedMult *= 1.10; } },

    // ---------------- RARA ----------------
    { id:'p_belt', rarity:'rara', max:3,
      name:'CINTURÓN DE MUNICIÓN', desc:'Bandolera cruzada, cargadores a mano.',
      effect:'+5 munición máxima',
      apply(){ mech.extraAmmo += 5; recomputeMaxAmmo(); } },

    { id:'p_vest', rarity:'rara', max:3,
      name:'CHALECO REFORZADO', desc:'Placas de kevlar remendadas con cinta.',
      effect:'-12% daño recibido',
      apply(){ mech.damageMult *= 0.88; } },

    { id:'p_reflex', rarity:'rara', max:2,
      name:'REFLEJOS AFILADOS', desc:'Ya sabés hacia dónde salta cada infectado.',
      effect:'+18% velocidad',
      apply(){ mech.moveSpeedMult *= 1.18; } },

    { id:'p_fieldkit', rarity:'rara', max:2,
      name:'KIT DE CAMPAÑA', desc:'Botiquín completo y aceite para el arma.',
      effect:'+35 de vida y +15% recarga',
      apply(){ heal(35); mech.reloadSpeedMult *= 1.15; } },

    // ---------------- ESPECIAL ----------------
    { id:'p_plating', rarity:'especial', max:2,
      name:'BLINDAJE TÁCTICO', desc:'Chapa de vehículo atornillada al chaleco.',
      effect:'-22% daño recibido',
      apply(){ mech.damageMult *= 0.78; } },

    { id:'p_drum', rarity:'especial', max:2,
      name:'RECÁMARA AMPLIADA', desc:'Cargador extendido, boca de alimentación pulida.',
      effect:'+8 munición máxima y +15% recarga',
      apply(){ mech.extraAmmo += 8; recomputeMaxAmmo(); mech.reloadSpeedMult *= 1.15; } },

    { id:'p_evade', rarity:'especial', max:3,
      name:'SISTEMA DE EVASIÓN', desc:'Arnés de impulso recuperado de un dron caído.',
      effect:'Otorga dash · -1s de cooldown',
      apply(){ hasDash = true; mech.dashCdBonus += 1; } },

    { id:'p_secondwind', rarity:'especial', max:2,
      name:'SEGUNDO ALIENTO', desc:'Un inyector de emergencia todavía sellado.',
      effect:'+50 de vida y +10% velocidad',
      apply(){ heal(50); mech.moveSpeedMult *= 1.10; } },

    // ---------------- ÉPICA ----------------
    { id:'p_exo', rarity:'epica', max:1,
      name:'EXOESQUELETO', desc:'Servomotores pesados: aguantás mucho más, te movés algo peor.',
      effect:'-35% daño recibido · -8% velocidad',
      apply(){ mech.damageMult *= 0.65; mech.moveSpeedMult *= 0.92; } },

    { id:'p_overdrive', rarity:'epica', max:1,
      name:'SOBRECARGA DE CARGADOR', desc:'Muelle reforzado y alimentación forzada.',
      effect:'+12 munición máxima y +40% recarga',
      apply(){ mech.extraAmmo += 12; recomputeMaxAmmo(); mech.reloadSpeedMult *= 1.4; } },

    { id:'p_phoenix', rarity:'epica', max:2,
      name:'PROTOCOLO FÉNIX', desc:'Adrenalina automática: te levanta una vez del suelo.',
      effect:'Evita una muerte y te deja con 50 de vida',
      apply(){ mech.phoenixCharges += 1; } },

    // ---------------- LEGENDARIA ----------------
    { id:'p_armory', rarity:'legendaria', max:1,
      name:'ARMERÍA COMPLETA', desc:'El arsenal intacto de un puesto de control abandonado.',
      effect:'Desbloquea escopeta y metralleta',
      apply(){
        hasShotgun = true; hasSMG = true;
        if (typeof SHOP_ITEMS !== 'undefined'){
          const sg = SHOP_ITEMS.find(i => i.id === 'shotgun'); if (sg) sg.level = sg.max;
          const sm = SHOP_ITEMS.find(i => i.id === 'smg');     if (sm) sm.level = sm.max;
        }
        if (typeof updateWeaponHUD === 'function') updateWeaponHUD();
      } },

    { id:'p_steelskin', rarity:'legendaria', max:1,
      name:'PIEL DE ACERO', desc:'Blindaje corporal completo del escuadrón de asalto.',
      effect:'-45% daño recibido y +25 de vida',
      apply(){ mech.damageMult *= 0.55; heal(25); } },

    { id:'p_infinitedrum', rarity:'legendaria', max:1,
      name:'TAMBOR SIN FONDO', desc:'Cargador de tambor militar: casi no parás de disparar.',
      effect:'+20 munición máxima y recarga casi instantánea',
      apply(){ mech.extraAmmo += 20; recomputeMaxAmmo(); mech.reloadSpeedMult *= 1.8; } },

    // ---------------- NUEVAS: daño de salida, monedas, control ----------------
    { id:'p_coins', rarity:'comun', max:3,
      name:'BOLSILLOS FORRADOS', desc:'Bolsillos extra cosidos por dentro del chaleco.',
      effect:'+15% monedas obtenidas',
      apply(){ mech.coinMult *= 1.15; } },

    { id:'p_punch', rarity:'rara', max:3,
      name:'CARGA DE COMBATE', desc:'Pólvora de mayor grado en cada cartucho.',
      effect:'12% de probabilidad de +1 de daño',
      apply(){ mech.damageBonusChance = Math.min(0.7, mech.damageBonusChance + 0.12); } },

    { id:'p_knockback', rarity:'rara', max:2,
      name:'MUNICIÓN DE GRAN CALIBRE', desc:'Cartuchos pesados que paran en seco al que golpean.',
      effect:'Cada disparo empuja al enemigo hacia atrás',
      apply(){ mech.bulletPushDist += 35; } },

    { id:'p_slowfield', rarity:'especial', max:2,
      name:'CAMPO DE FRENADO', desc:'Emisor de microondas recuperado de un dron caído.',
      effect:'Ralentiza a los infectados cercanos',
      apply(){
        mech.slowFieldRadius = 170;
        mech.slowFieldMult = mech.slowFieldMult === 1 ? 0.72 : mech.slowFieldMult * 0.8;
      } },

    { id:'p_headshot', rarity:'especial', max:1,
      name:'MIRA TELESCÓPICA', desc:'Óptica de precisión, retícula grabada a mano.',
      effect:'+1 de daño en golpes a la cabeza',
      apply(){ mech.headDamageBonus += 1; } },

    { id:'p_crit', rarity:'epica', max:2,
      name:'PRECISIÓN LETAL', desc:'Sabés exactamente dónde pegarle para que duela.',
      effect:'12% de probabilidad de golpe crítico (x2 daño)',
      apply(){ mech.critChance = Math.min(0.5, mech.critChance + 0.12); } },

    { id:'p_explosive', rarity:'epica', max:1,
      name:'BALA EXPLOSIVA', desc:'Carga de fragmentación oculta en la última bala del cargador.',
      effect:'Cada 8 disparos, el siguiente explota',
      apply(){ mech.explosiveEnabled = true; } }
  ];

  /* ============================================================
     ICONOGRAFÍA
     ============================================================ */
  const ICONS = {
    p_ammo:'<svg viewBox="0 0 24 24"><rect x="3" y="9" width="4" height="12" rx="1"/><polygon points="3,9 5,4 7,9"/><rect x="10" y="7" width="4" height="14" rx="1"/><polygon points="10,7 12,2 14,7"/><rect x="17" y="9" width="4" height="12" rx="1"/><polygon points="17,9 19,4 21,9"/></svg>',
    p_hands:'<svg viewBox="0 0 24 24"><path d="M12 4.4a7.6 7.6 0 1 1-6.9 4.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><polygon points="13.2,0.6 13.2,8 6.8,4.3"/></svg>',
    p_rations:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><rect x="8" y="3" width="8" height="3" rx="1"/><rect x="10.6" y="9" width="2.8" height="8" fill="#0d120e"/><rect x="7.6" y="12" width="8.8" height="2.8" fill="#0d120e"/></svg>',
    p_boots:'<svg viewBox="0 0 24 24"><path d="M6 3h5v9l7 3.4V19H4v-3l2-1.4z"/><rect x="3" y="19" width="16" height="2.6" rx="1"/></svg>',
    p_belt:'<svg viewBox="0 0 24 24"><rect x="1.5" y="10" width="21" height="5" rx="1.4"/><rect x="3.4" y="5.5" width="2.8" height="5" rx="0.8"/><rect x="8" y="5.5" width="2.8" height="5" rx="0.8"/><rect x="12.6" y="5.5" width="2.8" height="5" rx="0.8"/><rect x="17.2" y="5.5" width="2.8" height="5" rx="0.8"/></svg>',
    p_vest:'<svg viewBox="0 0 24 24"><path d="M12 1.6 21 5v7.4c0 5.2-3.8 8.4-9 10-5.2-1.6-9-4.8-9-10V5z"/><rect x="10.8" y="6.5" width="2.4" height="10" fill="#0d120e"/></svg>',
    p_reflex:'<svg viewBox="0 0 24 24"><polygon points="13.6,1 4,13.6 10.6,13.6 9.2,23 19.4,9.6 12.6,9.6"/></svg>',
    p_fieldkit:'<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2.4"/><path d="M8.4 7V5.2h7.2V7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10.7" y="10" width="2.6" height="8" fill="#0d120e"/><rect x="8" y="12.7" width="8" height="2.6" fill="#0d120e"/></svg>',
    p_plating:'<svg viewBox="0 0 24 24"><path d="M12 1.4 21.4 5v6.6c0 5.4-4 8.8-9.4 10.6C6.6 20.4 2.6 17 2.6 11.6V5z"/><rect x="5.6" y="7.4" width="12.8" height="2.4" fill="#0d120e"/><rect x="5.6" y="11.6" width="12.8" height="2.4" fill="#0d120e"/></svg>',
    p_drum:'<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2"/><rect x="8.4" y="5" width="7.2" height="1.8" fill="#0d120e"/><rect x="8.4" y="8.4" width="7.2" height="1.8" fill="#0d120e"/><rect x="8.4" y="11.8" width="7.2" height="1.8" fill="#0d120e"/><rect x="8.4" y="15.2" width="7.2" height="1.8" fill="#0d120e"/></svg>',
    p_evade:'<svg viewBox="0 0 24 24"><polygon points="11,1.6 2.6,12.4 8.4,12.4 7,22.4 16.4,10.6 10.4,10.6"/><rect x="17.6" y="4" width="2.2" height="16" rx="1" opacity="0.55"/><rect x="21" y="7" width="1.8" height="10" rx="0.9" opacity="0.3"/></svg>',
    p_secondwind:'<svg viewBox="0 0 24 24"><path d="M12 21.2C6.6 17.6 2.4 14.4 2.4 9.8A5.2 5.2 0 0 1 12 6.9a5.2 5.2 0 0 1 9.6 2.9c0 4.6-4.2 7.8-9.6 11.4z"/><rect x="10.9" y="9" width="2.2" height="7" fill="#0d120e"/><rect x="8.6" y="11.3" width="6.8" height="2.2" fill="#0d120e"/></svg>',
    p_exo:'<svg viewBox="0 0 24 24"><rect x="9.4" y="1.6" width="5.2" height="5" rx="1.2"/><rect x="4" y="7.6" width="16" height="6.4" rx="1.6"/><rect x="1.4" y="8.6" width="2.2" height="9" rx="1"/><rect x="20.4" y="8.6" width="2.2" height="9" rx="1"/><rect x="6.6" y="15.4" width="4" height="7" rx="1.2"/><rect x="13.4" y="15.4" width="4" height="7" rx="1.2"/></svg>',
    p_overdrive:'<svg viewBox="0 0 24 24"><rect x="7" y="6" width="10" height="16" rx="1.8"/><rect x="9.2" y="9" width="5.6" height="1.8" fill="#0d120e"/><rect x="9.2" y="12.4" width="5.6" height="1.8" fill="#0d120e"/><rect x="9.2" y="15.8" width="5.6" height="1.8" fill="#0d120e"/><polygon points="12,0.4 8.4,5.2 11.4,5.2 10.6,8.4 15,3.6 12,3.6"/></svg>',
    p_phoenix:'<svg viewBox="0 0 24 24"><path d="M12 1.4c1.6 3.6.4 5.2-1.2 7.2-1.8 2.2-3 3.8-3 6.2a4.2 4.2 0 0 0 8.4 0c0-1.4-.6-2.6-1.4-3.6 2 .8 4.6 3 4.6 6.2 0 3.6-3.4 6.2-7.4 6.2S4.6 20.6 4.6 17c0-5 4-6.6 5.6-10.2.8-1.8 1.2-3.6 1.8-5.4z"/></svg>',
    p_armory:'<svg viewBox="0 0 24 24"><rect x="1.6" y="6.4" width="14" height="3" rx="0.6" transform="rotate(-8 8.6 7.9)"/><rect x="14.4" y="4.4" width="7.4" height="2.2" rx="0.6" transform="rotate(-8 18.1 5.5)"/><rect x="5" y="9" width="2.8" height="6" rx="0.8" transform="rotate(-8 6.4 12)"/><rect x="2" y="16.4" width="20" height="3" rx="0.6"/><rect x="6.4" y="19" width="3" height="4" rx="0.8"/></svg>',
    p_steelskin:'<svg viewBox="0 0 24 24"><path d="M12 1 21.6 4.6v7.2c0 5.6-4.2 9.2-9.6 11.2-5.4-2-9.6-5.6-9.6-11.2V4.6z"/><path d="M12 4.6v15.6c3.6-1.6 6.4-4.2 6.4-8.4V6.4z" fill="#0d120e" opacity="0.55"/><rect x="4.8" y="9.6" width="14.4" height="1.8" fill="#0d120e"/></svg>',
    p_infinitedrum:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13.4" r="8.4"/><circle cx="12" cy="13.4" r="3.4" fill="#0d120e"/><rect x="10.2" y="1" width="3.6" height="5.6" rx="1"/><rect x="3.4" y="12.2" width="2.4" height="2.4" fill="#0d120e"/><rect x="18.2" y="12.2" width="2.4" height="2.4" fill="#0d120e"/></svg>',
    p_coins:'<svg viewBox="0 0 24 24"><circle cx="8.6" cy="8.8" r="7.2"/><circle cx="8.6" cy="8.8" r="3.2" fill="#0d120e"/><circle cx="16.2" cy="16.2" r="6" opacity="0.88"/><circle cx="16.2" cy="16.2" r="2.6" fill="#0d120e"/></svg>',
    p_punch:'<svg viewBox="0 0 24 24"><rect x="2.6" y="8.6" width="13" height="10.4" rx="3.4"/><rect x="1" y="11.2" width="4" height="5.6" rx="1.8"/><rect x="16.4" y="9.4" width="3.4" height="2" opacity="0.75" transform="rotate(-18 18.1 10.4)"/><rect x="19.6" y="8" width="3.4" height="2" opacity="0.55" transform="rotate(-18 21.3 9)"/><rect x="17.4" y="13.4" width="3.4" height="2" opacity="0.6" transform="rotate(-8 19.1 14.4)"/></svg>',
    p_knockback:'<svg viewBox="0 0 24 24"><circle cx="6.4" cy="12" r="3.6"/><path d="M12.4 5 Q17.4 12 12.4 19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M17 3.4 Q23.4 12 17 20.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/></svg>',
    p_slowfield:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.2" fill="none" stroke="currentColor" stroke-width="1.7" opacity="0.35"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="1.9" opacity="0.65"/><circle cx="12" cy="12" r="2.8"/></svg>',
    p_headshot:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="11.1" y="0.4" width="1.8" height="5.4"/><rect x="11.1" y="18.2" width="1.8" height="5.4"/><rect x="0.4" y="11.1" width="5.4" height="1.8"/><rect x="18.2" y="11.1" width="5.4" height="1.8"/><circle cx="12" cy="12" r="1.9" fill="#0d120e"/></svg>',
    p_crit:'<svg viewBox="0 0 24 24"><polygon points="12,0.4 14.5,8.3 22.4,8.6 16,13.2 18.2,21 12,16.3 5.8,21 8,13.2 1.6,8.6 9.5,8.3"/></svg>',
    p_explosive:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13.4" r="6.2"/><polygon points="12,0.4 13.7,6.4 10.3,6.4"/><polygon points="21.6,5.8 17.5,10.4 16.2,7.3"/><polygon points="2.4,5.8 6.5,10.4 7.8,7.3"/><polygon points="22.6,17.4 16.8,15.6 18.6,12.9"/><polygon points="1.4,17.4 7.2,15.6 5.4,12.9"/></svg>'
  };

  function icon(id){ return ICONS[id] || ''; }

  const SKULL = '<svg viewBox="0 0 24 24" class="skullMark"><path d="M12 1.6c-5 0-8.6 3.4-8.6 8 0 2.6 1.2 4.4 2.6 5.6v3.4c0 1.6 1.2 2.8 2.8 2.8h6.4c1.6 0 2.8-1.2 2.8-2.8v-3.4c1.4-1.2 2.6-3 2.6-5.6 0-4.6-3.6-8-8.6-8z"/><circle cx="8.6" cy="10" r="2.4" fill="#0a0d0a"/><circle cx="15.4" cy="10" r="2.4" fill="#0a0d0a"/><rect x="10.9" y="13.6" width="2.2" height="2.8" fill="#0a0d0a"/></svg>';

  const CREST = '<svg viewBox="0 0 120 64" class="crestSvg">' +
    '<path d="M2 22 L30 14 L30 20 L8 27 Z"/><path d="M6 32 L32 25 L32 31 L12 37 Z"/><path d="M12 42 L34 36 L34 42 L18 47 Z"/>' +
    '<path d="M118 22 L90 14 L90 20 L112 27 Z"/><path d="M114 32 L88 25 L88 31 L108 37 Z"/><path d="M108 42 L86 36 L86 42 L102 47 Z"/>' +
    '<path d="M60 6c-12 0-20 8-20 19 0 6 3 10.4 6.2 13.2v8c0 3.8 2.8 6.8 6.4 6.8h14.8c3.6 0 6.4-3 6.4-6.8v-8C77 35.4 80 31 80 25 80 14 72 6 60 6z"/>' +
    '<circle cx="51" cy="26" r="5.6" fill="#0a0d0a"/><circle cx="69" cy="26" r="5.6" fill="#0a0d0a"/>' +
    '<rect x="57.2" y="34" width="5.6" height="7" fill="#0a0d0a"/>' +
    '<rect x="46" y="46" width="28" height="2.6" fill="#0a0d0a"/>' +
    '</svg>';

  const WING_L = '<svg viewBox="0 0 44 14" preserveAspectRatio="xMaxYMid meet" class="wingSvg">' +
    '<path d="M44 2.2 L20 5 L20 7.4 L44 4.8 Z"/>' +
    '<path d="M38 7.6 L14 10.2 L14 12.6 L38 10.2 Z"/>' +
    '<path d="M8 4.4 L11.6 7.4 L8 10.4 L4.4 7.4 Z"/></svg>';
  const WING_R = '<svg viewBox="0 0 44 14" preserveAspectRatio="xMinYMid meet" class="wingSvg">' +
    '<path d="M0 2.2 L24 5 L24 7.4 L0 4.8 Z"/>' +
    '<path d="M6 7.6 L30 10.2 L30 12.6 L6 10.2 Z"/>' +
    '<path d="M36 4.4 L39.6 7.4 L36 10.4 L32.4 7.4 Z"/></svg>';

  /* ============================================================
     SORTEO
     ============================================================ */
  function available(u){
    if (u.max === null) return true;
    return levelOf(u.id) < u.max;
  }

  function rollRarity(){
    const r = Math.random();
    let acc = 0;
    for (const key of Object.keys(RARITIES)){
      acc += RARITIES[key].weight;
      if (r < acc) return key;
    }
    return 'comun';
  }

  function clampRarity(rar){
    if (rar === 'legendaria' && (wave < LEGENDARY_MIN_WAVE || legendaryCount() >= MAX_LEGENDARY)) rar = 'epica';
    if (rar === 'epica' && wave < EPIC_MIN_WAVE) rar = 'especial';
    return rar;
  }

  function generateOffer(){
    const picks = [];
    let guard = 0;
    while (picks.length < 3 && guard++ < 120){
      const rar = clampRarity(rollRarity());
      const pool = POOL.filter(u => u.rarity === rar && available(u) && !picks.some(p => p.id === u.id));
      if (!pool.length) continue;
      picks.push(pool[Math.floor(Math.random()*pool.length)]);
    }
    if (picks.length < 3){
      const rest = POOL.filter(u => u.rarity !== 'legendaria' && available(u) && !picks.some(p => p.id === u.id));
      while (picks.length < 3 && rest.length){
        picks.push(rest.splice(Math.floor(Math.random()*rest.length), 1)[0]);
      }
    }
    return picks;
  }

  function dueThisWave(){ return wave > 0 && wave % EVERY === 0; }

  function ensureOffer(){
    if (state.offer && state.offer.length) return;
    if (!dueThisWave()) return;
    if (state.offerWave === wave) return;
    state.offer = generateOffer();
    state.offerWave = wave;
  }

  function pick(id){
    if (!state.offer) return;
    if (!state.offer.some(u => u.id === id)) return;
    const u = byId(id);
    if (!u) return;

    const entry = ownedEntry(id);
    if (entry) entry.level += 1;
    else state.owned.push({ id, level: 1 });

    u.apply(levelOf(id));
    state.offer = null;
    state.selectedId = id;

    if (typeof playCoinSound === 'function') playCoinSound();
    if (typeof renderShopHTML === 'function') renderShopHTML();
  }

  function select(id){
    state.selectedId = id;
    if (typeof renderShopHTML === 'function') renderShopHTML();
  }

  /* ------------------------------------------------------------
     RECOMPENSA DEL JEFE — la llama bossDefeated() en bosses.js.
     Concede UNA mejora al azar sin pasar por la oferta de tres
     cartas (el jefe no abre pantalla de elección) y devuelve su
     nombre para el cartel de la tienda.

     Reutiliza las MISMAS reglas que la oferta normal —available()
     para respetar el nivel máximo de cada mejora y clampRarity()
     para el tope de legendarias— así que el premio del jefe no
     puede saltarse los límites de balance ni dar una legendaria
     de más.
     ------------------------------------------------------------ */
  function grantRandomUpgrade(){
    let elegidas = null;

    // se intenta con una rareza sorteada y acotada; si esa rareza
    // ya no tiene nada disponible, se baja a cualquier no legendaria
    for (let i = 0; i < 40 && !elegidas; i++){
      const rar = clampRarity(rollRarity());
      const pool = POOL.filter(u => u.rarity === rar && available(u));
      if (pool.length) elegidas = pool;
    }
    if (!elegidas){
      const resto = POOL.filter(u => u.rarity !== 'legendaria' && available(u));
      if (resto.length) elegidas = resto;
    }
    if (!elegidas || !elegidas.length) return null;   // todo al máximo

    const u = elegidas[Math.floor(Math.random()*elegidas.length)];

    const entry = ownedEntry(u.id);
    if (entry) entry.level += 1;
    else state.owned.push({ id: u.id, level: 1 });

    u.apply(levelOf(u.id));
    state.selectedId = u.id;

    return u.name;
  }

  // bosses.js la invoca como global (grantRandomUpgrade()), no vía UPG:
  // upgrades.js es un IIFE, así que sin esta línea la función quedaría
  // encerrada y matar al jefe reventaba con ReferenceError.
  window.grantRandomUpgrade = grantRandomUpgrade;

  window.__perkPick = pick;  window.__perkSelect = select;

  /* ============================================================
     RENDER — COLUMNA CENTRAL
     ============================================================ */
  function head(title){
    return `<header class="panelHead">${WING_L}<h3>${title}</h3>${WING_R}</header>`;
  }

  function milestoneTrack(){
    const nodes = MILESTONES.map(m => {
      let cls = 'msNode';
      let inner = '<span class="msDot"></span>';
      if (wave > m) { cls += ' done'; inner = '<span class="msTick">✓</span>'; }
      else if (wave === m) { cls += ' now'; }
      if (m === 25) { cls += ' boss'; if (wave <= m) inner = SKULL; }
      return `<div class="msStep"><div class="${cls}">${inner}</div><span class="msNum">${m}</span></div>`;
    }).join('<div class="msLink"></div>');
    return `<div class="msTrack">${nodes}</div>`;
  }

  function progressPanel(){
    const next = MILESTONES.find(m => m > wave);
    let hint;
    if (dueThisWave() && state.offer) {
      hint = `<span class="ready">Mejora disponible: elegí una carta abajo.</span>`;
    } else if (next) {
      const left = next - wave;
      hint = `Completá <b>${left}</b> ${left === 1 ? 'oleada' : 'oleadas'} más para elegir una mejora.`;
    } else {
      hint = `Última mejora entregada. Sólo queda el frente.`;
    }
    return `
      <section class="ulPanel centerTop">
        ${head('PRÓXIMA MEJORA')}
        <div class="panelBody">
          ${milestoneTrack()}
          <p class="msHint">${hint}</p>
        </div>
      </section>`;
  }

  function offerPanel(){
    const cards = state.offer.map(u => {
      const lvl = levelOf(u.id);
      const stack = lvl > 0 ? `<span class="cardStack">Nv.${lvl} → Nv.${lvl+1}</span>` : '';
      return `
        <article class="perkCard r-${u.rarity}">
          <div class="cardRarity">${RARITIES[u.rarity].label}</div>
          <div class="cardIcon">${icon(u.id)}</div>
          <h4 class="cardName">${u.name}</h4>
          <p class="cardEffect">${u.effect}</p>
          <p class="cardDesc">${u.desc}</p>
          ${stack}
          <button type="button" class="cardPick" onclick="window.__perkPick('${u.id}')">ELEGIR</button>
        </article>`;
    }).join('');
    return `
      <section class="ulPanel centerChoice">
        ${head(`OLEADA ${wave} · ELEGÍ UNA MEJORA`)}
        <div class="perkRow">${cards}</div>
        <p class="choiceFoot">Las mejoras se aplican durante toda la partida.</p>
      </section>`;
  }

  function statBar(cls, pct){
    return `<span class="statBar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`;
  }

  function sheetPanel(){
    const spd = moveSpeedMult();
    const spdPct = Math.round((spd - 1) * 100);
    const armor = Math.round((1 - mech.damageMult) * 100);
    const hp = (typeof health === 'number') ? Math.max(0, Math.round(health)) : 100;
    const maxA = (typeof maxAmmo === 'number') ? maxAmmo : 12;

    const guns = ['PISTOLA'];
    if (typeof hasShotgun !== 'undefined' && hasShotgun) guns.push('ESCOPETA');
    if (typeof hasSMG !== 'undefined' && hasSMG) guns.push('METRALLETA');
    const gunTags = guns.map(g => `<span class="tag">${g}</span>`).join('');

    const extras = [];
    if (typeof hasDash !== 'undefined' && hasDash) extras.push('<span class="tag on">DASH</span>');
    if (mech.phoenixCharges > 0) extras.push(`<span class="tag on">FÉNIX x${mech.phoenixCharges}</span>`);
    if (!extras.length) extras.push('<span class="tag off">SIN EQUIPO DE ESCAPE</span>');

    return `
      <section class="ulPanel centerIdle">
        ${head('FICHA DEL SOLDADO')}
        <div class="sheetGrid">
          <div class="statRow"><span class="statLabel">VIDA</span><span class="statVal hp">${hp}<i>/${effectiveMaxHealth()}</i></span>${statBar('hp', hp/effectiveMaxHealth()*100)}</div>
          <div class="statRow"><span class="statLabel">MUNICIÓN MÁX.</span><span class="statVal am">${maxA}</span>${statBar('am', (maxA/44)*100)}</div>
          <div class="statRow"><span class="statLabel">BLINDAJE</span><span class="statVal ar">${armor}%</span>${statBar('ar', armor*1.6)}</div>
          <div class="statRow"><span class="statLabel">VELOCIDAD</span><span class="statVal sp">${spdPct >= 0 ? '+' : ''}${spdPct}%</span>${statBar('sp', 50 + spdPct*1.4)}</div>
        </div>
        <div class="sheetTags">
          <div class="tagLine"><span class="tagTitle">ARSENAL</span><span class="tagWrap">${gunTags}</span></div>
          <div class="tagLine"><span class="tagTitle">SOPORTE</span><span class="tagWrap">${extras.join('')}</span></div>
        </div>
        <p class="idleText">Sin depósito abierto en esta oleada. Volvé a la línea.</p>
      </section>`;
  }

  function renderCenter(){
    ensureOffer();
    const bottom = (state.offer && state.offer.length) ? offerPanel() : sheetPanel();
    return progressPanel() + bottom;
  }

  /* ============================================================
     RENDER — COLUMNA DERECHA
     ============================================================ */
  function activePanel(){
    const picks = totalPicks();
    const granted = Math.max(MILESTONES.length, picks);
    const counter = `<div class="perkCount"><b>${picks}</b> / ${granted} MEJORAS</div>`;

    if (!state.owned.length){
      return `
        <section class="ulPanel sideActive">
          ${head('MEJORAS ACTIVAS')}
          ${counter}
          <div class="crestBox">
            ${CREST}
            <p>Cada mejora potencia a tu soldado.<br>La primera llega en la oleada 5.</p>
          </div>
        </section>`;
    }

    const chips = state.owned.map(o => {
      const u = byId(o.id);
      if (!u) return '';
      const sel = state.selectedId === o.id ? ' sel' : '';
      return `
        <button type="button" class="perkChip r-${u.rarity}${sel}" onclick="window.__perkSelect('${o.id}')">
          <span class="chipIcon">${icon(o.id)}</span>
          <span class="chipName">${u.name}</span>
          <span class="chipLvl">Nv.${o.level}</span>
        </button>`;
    }).join('');

    return `
      <section class="ulPanel sideActive">
        ${head('MEJORAS ACTIVAS')}
        <div class="chipGrid">${chips}</div>
        ${counter}
        <div class="crestBox small">
          ${CREST}
          <p>Cada mejora potencia a tu soldado.<br>Elegí con cabeza: ${legendaryCount()}/${MAX_LEGENDARY} legendarias.</p>
        </div>
      </section>`;
  }

  function detailPanel(){
    const id = state.selectedId || (state.owned.length ? state.owned[state.owned.length-1].id : null);
    const u = id ? byId(id) : null;
    if (!u){
      return `
        <section class="ulPanel sideDetail">
          ${head('DETALLE DE MEJORA')}
          <p class="detailEmpty">Elegí una mejora de la lista para leer su ficha.</p>
        </section>`;
    }
    const lvl = levelOf(u.id);
    const cap = u.max ? ` / ${u.max}` : '';
    return `
      <section class="ulPanel sideDetail r-${u.rarity}">
        ${head('DETALLE DE MEJORA')}
        <div class="detailTop">
          <span class="detailIcon">${icon(u.id)}</span>
          <span class="detailTitle"><b>${u.name}</b><i>Nivel ${lvl}${cap}</i></span>
          <span class="detailBadge">${RARITIES[u.rarity].label}</span>
        </div>
        <p class="detailDesc">${u.desc}</p>
        <div class="detailEffect">${u.effect}</div>
      </section>`;
  }

  function renderSide(){ return activePanel() + detailPanel(); }

  /* ============================================================
     API PÚBLICA — window.UPG
     ============================================================ */
  window.UPG = {
    reset, update,
    dashCooldownBonus, incomingDamageMult, effectiveMaxHealth,
    onPlayerDamaged, onDashStart, moveSpeedMult,
    reloadSpeedMult, extraAmmo, spreadMult, bulletSpeedMult,
    pierceCount, onShotFired,
    damage: damageOut, coins: coinsBonus,
    enemySpeedMult: enemySpeedMultFn, enemyPushDistance: enemyPushDistanceFn,
    onKill, triggerExplosion,
    renderCenter, renderSide,
    state, POOL, RARITIES, MILESTONES, ICONS,
    dueThisWave, totalPicks, legendaryCount, levelOf, byId,
    ensureOffer, pick, select, grantRandomUpgrade,
    SKULL, CREST, WING_L, WING_R
  };
})();