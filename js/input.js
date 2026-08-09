  let aimDX = 1, aimDY = 0;

  let firing = false;

  const keys = { left:false, right:false };

  function setAimFromVector(dx, dy){
    const len = Math.hypot(dx, dy) || 1;
    aimDX = dx/len;
    aimDY = dy/len;
    if (Math.abs(aimDX) > 0.05) facing = aimDX > 0 ? 1 : -1;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space') {
      e.preventDefault();
      // durante la recarga la barra manda: el mismo botón que dispara
      // sirve para clavar la ventana, así no hay que aprender otra tecla
      if (reloading) tryActiveReload();
      firing = true;
    }
    if (e.code === 'KeyR') { e.preventDefault(); if (reloading) tryActiveReload(); else reload(); }
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyQ') cycleWeapon();
    if (e.code === 'Digit1' && ownedWeaponsList().includes('pistol')) { weapon = 'pistol'; updateWeaponHUD(); }
    if (e.code === 'Digit2' && ownedWeaponsList().includes('shotgun')) { weapon = 'shotgun'; updateWeaponHUD(); }
    if (e.code === 'Digit3' && ownedWeaponsList().includes('smg')) { weapon = 'smg'; updateWeaponHUD(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') tryDash();
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space') firing = false;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const p = localPoint(canvas, e.clientX, e.clientY);
    const origin = gunOrigin();
    setAimFromVector(p.x - (origin.x - camX), p.y - origin.y);
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    firing = true;
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    firing = false;
  });

  function bindHold(el, onDown, onUp){
    // si el botón no está en el DOM se ignora en silencio: antes un id
    // ausente lanzaba y se llevaba por delante el resto de los controles
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); onDown(); el.classList.add('pressed'); });
    el.addEventListener('pointerup', () => { onUp && onUp(); el.classList.remove('pressed'); });
    el.addEventListener('pointerleave', () => { onUp && onUp(); el.classList.remove('pressed'); });
    el.addEventListener('pointercancel', () => { onUp && onUp(); el.classList.remove('pressed'); });
  }

  bindHold(document.getElementById('btnLeft'), () => keys.left = true, () => keys.left = false);

  bindHold(document.getElementById('btnRight'), () => keys.right = true, () => keys.right = false);

  bindHold(btnFire, () => { if (reloading) tryActiveReload(); firing = true; }, () => firing = false);

  btnPause.addEventListener('pointerdown', (e) => { e.preventDefault(); togglePause(); });

  btnSkipWave.addEventListener('pointerdown', (e) => { e.preventDefault(); skipWave(); });

  btnSwitchWeapon.addEventListener('pointerdown', (e) => { e.preventDefault(); cycleWeapon(); btnSwitchWeapon.classList.add('pressed'); });

  btnSwitchWeapon.addEventListener('pointerup', () => btnSwitchWeapon.classList.remove('pressed'));

  btnSwitchWeapon.addEventListener('pointerleave', () => btnSwitchWeapon.classList.remove('pressed'));

  btnDash.addEventListener('pointerdown', (e) => { e.preventDefault(); tryDash(); btnDash.classList.add('pressed'); });

  btnDash.addEventListener('pointerup', () => btnDash.classList.remove('pressed'));

  btnDash.addEventListener('pointerleave', () => btnDash.classList.remove('pressed'));

  let joystickId = null;

  function handleJoystick(clientX, clientY){
    // el centro se mide en coordenadas lógicas del propio pad, así el
    // cálculo es idéntico esté el juego rotado o no
    const rect = joystickPad.getBoundingClientRect();
    const lado = gameRotated ? rect.height : rect.width;
    const radio = lado / gameScale / 2;
    const p = localPoint(joystickPad, clientX, clientY);
    let dx = p.x - radio;
    let dy = p.y - radio;
    const dist = Math.hypot(dx, dy);
    const maxD = radio - 14;
    if (dist > maxD) { dx = dx/dist*maxD; dy = dy/dist*maxD; }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (Math.hypot(dx,dy) > 6) setAimFromVector(dx, dy);
  }

  joystickPad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joystickId = e.pointerId;
    joystickPad.setPointerCapture(e.pointerId);
    handleJoystick(e.clientX, e.clientY);
  });

  joystickPad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joystickId) return;
    handleJoystick(e.clientX, e.clientY);
  });

  function endJoystick(e){
    if (e.pointerId !== joystickId) return;
    joystickId = null;
    joystickKnob.style.transform = 'translate(0px,0px)';
  }

  joystickPad.addEventListener('pointerup', endJoystick);

  joystickPad.addEventListener('pointercancel', endJoystick);

  joystickPad.addEventListener('pointerleave', endJoystick);

  // ---- controles móviles: joysticks dinámicos (aparecen donde tocás) ----
  const moveZone = document.getElementById('moveZone');
  const aimZone = document.getElementById('aimZone');
  const moveKnobBase = document.getElementById('moveKnobBase');
  const moveKnobEl = document.getElementById('moveKnob');
  const aimKnobBase = document.getElementById('aimKnobBase');
  const aimKnobEl = document.getElementById('aimKnob');
  const btnDashMobile = document.getElementById('btnDashMobile');
  const btnSwitchWeaponMobile = document.getElementById('btnSwitchWeaponMobile');

  // liberadores de los sticks activos: los llama releaseAllInput() cuando
  // la app pasa a segundo plano. Sin esto el stick se quedaba con un dedo
  // fantasma ocupándolo y ya no volvía a responder.
  const stickReleasers = [];

  function setupDynamicStick(zoneEl, baseEl, knobEl, opts){
    let pointerId = null;
    let originX = 0, originY = 0;
    // el radio de recorrido tiene que coincidir con el radio visual de
    // .stickBase (ahora 59px): si se quedara en el valor viejo, la
    // perilla se sentiría "topada" mucho antes de llegar al borde del
    // círculo más grande — desconectado de lo que se ve en pantalla.
    const maxR = 55;

    function place(el, x, y){
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }

    zoneEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // si ya hay un dedo mandando en esta zona, el segundo se ignora:
      // antes reescribía pointerId y el origen, y el stick daba un salto
      // brusco a mitad de gesto
      if (pointerId !== null) return;
      pointerId = e.pointerId;
      // en iOS puede lanzar si el puntero ya se invalidó (llamada entrante,
      // cambio de app). Sin el try, la excepción cortaba el resto del
      // handler y el stick quedaba muerto hasta recargar.
      try { zoneEl.setPointerCapture(e.pointerId); } catch(err){}
      const o = localPoint(zoneEl, e.clientX, e.clientY);
      originX = o.x;
      originY = o.y;
      place(baseEl, originX, originY);
      place(knobEl, originX, originY);
      baseEl.classList.add('active');
      knobEl.classList.add('active');
      opts.onDown && opts.onDown();
    });

    zoneEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      const p = localPoint(zoneEl, e.clientX, e.clientY);
      let dx = p.x - originX;
      let dy = p.y - originY;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) { dx = dx/dist*maxR; dy = dy/dist*maxR; }
      place(knobEl, originX + dx, originY + dy);
      opts.onMove(dx, dy, Math.min(dist, maxR));
    });

    function end(e){
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      baseEl.classList.remove('active');
      knobEl.classList.remove('active');
      opts.onEnd && opts.onEnd();
    }
    zoneEl.addEventListener('pointerup', end);
    zoneEl.addEventListener('pointercancel', end);

    // corta el gesto pase lo que pase, sin depender de recibir el evento
    stickReleasers.push(function(){
      if (pointerId === null) return;
      pointerId = null;
      baseEl.classList.remove('active');
      knobEl.classList.remove('active');
      opts.onEnd && opts.onEnd();
    });
    // OJO: nada de 'pointerleave' acá. Con setPointerCapture el dedo puede
    // salirse de la caja de la zona mientras el stick sigue activo (es lo
    // normal al empujar el stick hasta el borde), y en iOS eso disparaba
    // pointerleave y mataba el gesto a media partida: el personaje se
    // quedaba clavado o dejaba de disparar solo. La captura ya garantiza
    // que pointerup/pointercancel lleguen aunque el dedo esté fuera.
  }

  // joystick izquierdo: mover (solo eje horizontal, igual que keys.left/right)
  setupDynamicStick(moveZone, moveKnobBase, moveKnobEl, {
    onMove(dx, dy, dist){
      if (dist < 10) { keys.left = false; keys.right = false; return; }
      keys.left = dx < 0;
      keys.right = dx > 0;
    },
    onEnd(){ keys.left = false; keys.right = false; }
  });

  // joystick derecho: apunta y dispara automáticamente mientras esté inclinado
  setupDynamicStick(aimZone, aimKnobBase, aimKnobEl, {
    // volver a apoyar el pulgar durante la recarga intenta clavar la
    // ventana. Es el gesto natural: el arma está vacía, no estás
    // disparando nada, y el dedo ya vive en esa mitad de la pantalla.
    onDown(){ if (reloading) tryActiveReload(); },
    onMove(dx, dy, dist){
      if (dist > 6) {
        setAimFromVector(dx, dy);
        firing = true;
      } else {
        firing = false;
      }
    },
    onEnd(){ firing = false; }
  });

  bindHold(btnDashMobile, () => tryDash());

  bindHold(btnSwitchWeaponMobile, () => cycleWeapon());

  // No hay botón de recarga manual: el arma se recarga sola al vaciar el
  // cargador (weapons.js). La ventana de recarga activa se clava volviendo
  // a apoyar el pulgar en el stick de puntería —ver onDown() de aimZone—,
  // que además es el gesto natural: el arma está vacía, no estás
  // disparando, y el dedo ya vive en esa mitad de la pantalla.

  // ---- guardas de Safari/iOS -------------------------------------------
  // sin esto, mantener el dedo sobre un botón abre el menú de "copiar/
  // compartir" y el doble toque hace zoom sobre el canvas a mitad de una
  // oleada. También se sueltan las teclas si la app pasa a segundo plano
  // (llamada entrante, cambio de pestaña), que si no dejaba al personaje
  // corriendo o disparando solo al volver.
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('gesturestart', (e) => e.preventDefault());

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 320) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  function releaseAllInput(){
    keys.left = false;
    keys.right = false;
    firing = false;
    stickReleasers.forEach(fn => fn());
  }

  window.addEventListener('blur', releaseAllInput);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllInput();
  });
