  const overlay = document.getElementById('overlay');

  const scoreVal = document.getElementById('scoreVal');

  const waveVal = document.getElementById('waveVal');

  const healthInner = document.getElementById('healthInner');

  const ammoVal = document.getElementById('ammoVal');

  const joystickPad = document.getElementById('joystickPad');

  const joystickKnob = document.getElementById('joystickKnob');

  const btnFire = document.getElementById('btnFire');

  const btnPause = document.getElementById('btnPause');

  const coinVal = document.getElementById('coinVal');

  const weaponVal = document.getElementById('weaponVal');

  const btnSwitchWeapon = document.getElementById('btnSwitchWeapon');

  const weaponSwitchLabel = document.getElementById('weaponSwitchLabel');

  const btnDash = document.getElementById('btnDash');

  const btnSkipWave = document.getElementById('btnSkipWave');

  const bossBar = document.getElementById('bossBar');

  const bossSegs = Array.prototype.slice.call(document.querySelectorAll('#bossSegs .bossSeg'));

  const bossSegFills = bossSegs.map(el => el.firstElementChild);

  const helpDetails = document.getElementById('helpDetails');

  const btnToggleHelp = document.getElementById('btnToggleHelp');

  function toggleHelp(){
    const isHidden = helpDetails.classList.toggle('hidden');
    btnToggleHelp.textContent = isHidden
      ? '▼ más detalles (controles, oleadas, enemigos especiales)'
      : '▲ ocultar detalles';
  }
  window.__toggleHelp = toggleHelp;

  const dashBtnState = { locked: null, disabled: null, label: null };

  function togglePause(){
    if (!running || inShop) return;
    playClickSound();
    paused = !paused;
    if (paused){
      firing = false;
      overlay.classList.remove('hidden');
      overlay.innerHTML = `
        <h2>PAUSA</h2>
        <p>El juego está en pausa.</p>
        <button id="resumeBtn">CONTINUAR</button>
      `;
      document.getElementById('resumeBtn').addEventListener('click', togglePause);
    } else {
      overlay.classList.add('hidden');
    }
  }

function updateDashButtonUI(){
    const btnDashMobile = document.getElementById('btnDashMobile');
    const locked = !hasDash;
    const disabled = !hasDash || player.dashCooldown > 0;
    const label = !hasDash ? 'DASH' : (player.dashCooldown > 0 ? String(Math.ceil(player.dashCooldown)) : 'DASH');
    if (locked !== dashBtnState.locked) {
      btnDash.classList.toggle('locked', locked);
      if (btnDashMobile) btnDashMobile.classList.toggle('locked', locked);
      dashBtnState.locked = locked;
    }
    if (disabled !== dashBtnState.disabled) {
      btnDash.disabled = disabled;
      if (btnDashMobile) btnDashMobile.disabled = disabled;
      dashBtnState.disabled = disabled;
    }
    if (label !== dashBtnState.label) {
      btnDash.textContent = label;
      if (btnDashMobile) btnDashMobile.textContent = label;
      dashBtnState.label = label;
    }
  
}
