// ---- audio sintetizado (sin archivos externos) ----
  let audioCtx = null;

  function ensureAudio(){
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function startAmbience(){
    if (typeof startAmbientWind === 'function') startAmbientWind();
    if (typeof startAmbientMelody === 'function') startAmbientMelody();
  }

  window.addEventListener('pointerdown', () => { ensureAudio(); startAmbience(); }, { once:true });

  window.addEventListener('keydown', () => { ensureAudio(); startAmbience(); }, { once:true });

  function playTone(freqStart, freqEnd, duration, type, gainStart){
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd,1), now+duration);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(gainStart, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now+duration);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(now); osc.stop(now+duration+0.02);
  }

  function playNoise(duration, gainStart, filterFreq){
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const size = Math.max(1, Math.floor(ac.sampleRate*duration));
    const buffer = ac.createBuffer(1, size, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<size;i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/size, 1.5);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(gainStart, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now+duration);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    src.start(now); src.stop(now+duration+0.02);
  }

  function playShotSound(){
    if (weapon === 'shotgun') { playNoise(0.14, 0.32, 1400); playTone(110, 40, 0.12, 'triangle', 0.28); }
    else if (weapon === 'smg') { playNoise(0.05, 0.15, 3600); playTone(180, 90, 0.05, 'triangle', 0.14); }
    else { playNoise(0.07, 0.2, 2800); playTone(140, 60, 0.07, 'triangle', 0.2); }
  }

  function playReloadSound(){
    // sacar el cargador: clack seco y plástico
    playNoise(0.035, 0.12, 3200);
    // meter el cargador nuevo: clunk más grave y con cuerpo
    setTimeout(() => {
      playNoise(0.055, 0.15, 1300);
      playTone(180, 90, 0.05, 'square', 0.07);
    }, 140);
    // correr la corredera/cerrojo: doble click metálico
    setTimeout(() => {
      playNoise(0.025, 0.11, 4200);
      playTone(1300, 750, 0.02, 'square', 0.05);
    }, 280);
    setTimeout(() => {
      playNoise(0.03, 0.13, 3600);
      playTone(1050, 550, 0.025, 'square', 0.055);
    }, 325);
  }

  function playDashSound(){ playNoise(0.18, 0.16, 2200); }

  function playHurtSound(){ playTone(180, 60, 0.18, 'sawtooth', 0.16); }

  function playDeathSound(){ playNoise(0.1, 0.14, 900); }

  function playCoinSound(){ playTone(880, 1200, 0.08, 'square', 0.07); }

  function playWaveSound(){ playTone(220, 440, 0.25, 'triangle', 0.1); }

  function playRoarSound(){ playNoise(0.35, 0.2, 700); playTone(90, 50, 0.35, 'sawtooth', 0.16); }

  function playFireballSound(){ playNoise(0.12, 0.18, 1800); playTone(160, 70, 0.12, 'triangle', 0.15); }

  // ---- impactos por zona (le dan textura propia a cada tipo de golpe) ----
  function playHeadHitSound(){ playTone(520, 300, 0.06, 'square', 0.09); }

  function playHelmetHitSound(){ playNoise(0.05, 0.14, 2600); playTone(700, 480, 0.04, 'square', 0.07); }

  function playShieldHitSound(){ playNoise(0.06, 0.16, 1200); playTone(300, 180, 0.06, 'square', 0.08); }

  function playBodyHitSound(){ playNoise(0.05, 0.1, 900); }

  function playFootHitSound(){ playNoise(0.08, 0.14, 600); playTone(150, 60, 0.08, 'sawtooth', 0.08); }

  function playExplosionSound(){ playNoise(0.4, 0.32, 500); playTone(70, 25, 0.4, 'sawtooth', 0.22); }

  // ---- jefe: sonidos propios, más graves y con más cuerpo ----
  function playBossRoar(){
    playNoise(0.85, 0.3, 420);
    playTone(70, 32, 0.9, 'sawtooth', 0.22);
    playTone(124, 54, 0.7, 'square', 0.08);
  }

  function playBossChargeSound(){ playTone(90, 340, 0.5, 'sawtooth', 0.09); }

  function playBossMortarSound(){ playNoise(0.16, 0.2, 900); playTone(210, 70, 0.18, 'triangle', 0.16); }

  function playBossSweepSound(){ playNoise(0.5, 0.22, 1600); playTone(320, 90, 0.45, 'sawtooth', 0.14); }

  function playBossArmorBreak(){ playNoise(0.35, 0.3, 2600); playTone(900, 170, 0.3, 'square', 0.12); }

  function playBossHitSound(){ playTone(380, 240, 0.05, 'square', 0.07); }

  function playBossRicochet(){ playNoise(0.04, 0.08, 5000); playTone(1500, 620, 0.05, 'square', 0.05); }


  function playBossColumnSound(){ playNoise(0.28, 0.24, 1100); playTone(140, 380, 0.2, 'sawtooth', 0.12); }

  function playBossBreathSound(){
    const base = 58 + Math.random()*22;
    playTone(base, base*0.6, 0.55 + Math.random()*0.35, 'sawtooth', 0.06);
    playNoise(0.35, 0.05, 420);
  }

  function playBossShoveRoar(){
    playNoise(0.42, 0.24, 520);
    playTone(125, 52, 0.45, 'sawtooth', 0.18);
    playTone(200, 84, 0.3, 'square', 0.055);
  }

  function playBossSwatImpact(){
    playNoise(0.16, 0.3, 900);
    playTone(240, 68, 0.14, 'triangle', 0.14);
  }

  function playBossAcidSpew(){ playNoise(0.75, 0.22, 3200); playTone(520, 130, 0.6, 'sawtooth', 0.07); }

  function playAcidSplashSound(){ playNoise(0.2, 0.18, 1500); playTone(260, 95, 0.14, 'square', 0.06); }

  // ---- música del jefe: secuenciador propio, un patrón por fase ----
  //  Fase 1: lento y amenazante. Fase 2: más rápido y disonante.
  //  Fase 3: frenético. Se calla solo mientras el juego está en pausa.
  const BOSS_MUSIC = {
    1: { step: 300, bass:[41.2,0,41.2,0, 49.0,0,41.2,0, 36.7,0,36.7,0, 43.6,0,41.2,0], lead:null, drum:[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0], hat:0 },
    2: { step: 215, bass:[43.6,0,43.6,43.6, 51.9,0,43.6,0, 38.9,0,38.9,38.9, 46.2,0,49.0,0], lead:[0,0,0,0, 233,0,220,0, 0,0,0,0, 246,0,233,0], drum:[1,0,0,1, 1,0,0,0, 1,0,0,1, 1,0,1,0], hat:1 },
    3: { step: 152, bass:[49.0,49.0,0,49.0, 58.3,0,49.0,0, 46.2,46.2,0,46.2, 55.0,0,58.3,0], lead:[293,0,277,0, 261,0,277,0, 293,0,311,0, 277,0,261,246], drum:[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,1], hat:1 }
  };

  let bossMusicTimer = null, bossMusicStep = 0, bossMusicPhase = 0;

  function startBossMusic(phase){
    const pat = BOSS_MUSIC[phase];
    if (!pat) return;
    stopBossMusic();
    ensureAudio();
    bossMusicPhase = phase;
    bossMusicStep = 0;
    bossMusicTimer = setInterval(() => {
      if (typeof paused !== 'undefined' && paused) return;
      if (typeof running !== 'undefined' && !running) return;
      const i = bossMusicStep % 16;
      const b = pat.bass[i];
      if (b) playTone(b, b*0.94, pat.step/1000*1.6, 'sawtooth', 0.075);
      if (pat.lead && pat.lead[i]) playTone(pat.lead[i], pat.lead[i]*0.98, pat.step/1000*1.2, 'square', 0.022);
      if (pat.drum[i]) playNoise(0.08, 0.11, 260);
      if (pat.hat && i % 2 === 1) playNoise(0.03, 0.035, 6000);
      bossMusicStep++;
    }, pat.step);
  }

  function stopBossMusic(){
    if (bossMusicTimer !== null) { clearInterval(bossMusicTimer); bossMusicTimer = null; }
    bossMusicPhase = 0;
  }

  // ---- ambiente: hace sentir vivo el escenario ----
  // Antes usaba el mismo patrón que playRoarSound/playBossRoar (sawtooth
  // deslizándose limpio): sonaba a rugido de fiera, no a gemido. Ahora
  // el tono tiembla con vibrato en vez de deslizar limpio, y lleva
  // debajo una capa breve de ruido filtrado que da textura de garganta.
  // El volumen también baja un poco para no tapar el viento y la
  // melodía, que ahora son más suaves que antes.
  function playZombieGroan(){
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const base = 70 + Math.random()*55;
    const dur = 0.55 + Math.random()*0.55;

    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(base*0.55,1), now+dur);

    // vibrato: la voz tiembla en vez de deslizar limpio — es lo que
    // distingue un gemido de un rugido
    const vibrato = ac.createOscillator();
    vibrato.frequency.value = 5 + Math.random()*2.5;
    const vibratoGain = ac.createGain();
    vibratoGain.gain.value = 4 + Math.random()*3;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(now); vibrato.stop(now+dur+0.05);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.032 + Math.random()*0.018, now+0.05);
    gain.gain.exponentialRampToValueAtTime(0.0008, now+dur);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(now); osc.stop(now+dur+0.05);

    // aliento ronco: capa corta de ruido filtrado, da textura de garganta
    playNoise(dur*0.6, 0.025, 480);
  }

  function playThunderSound(){ playNoise(0.9, 0.15, 350); playTone(55, 28, 0.8, 'sawtooth', 0.11); }

  function playFootstepSound(){ playNoise(0.04, 0.045, 500); }

  function playClickSound(){ playTone(500, 700, 0.03, 'square', 0.04); }

  // ---- viento ambiente: drone continuo de fondo ----
  //  Reescrito para que no suene duro: antes era ruido blanco puro por
  //  un filtro bandpass (eso es lo que le daba ese silbido áspero). Acá
  //  el ruido se integra primero ("ruido marrón", mucho más parejo al
  //  oído) y pasa por un lowpass sin resonancia — nunca canta una nota
  //  concreta, solo sopla. Entra con una rampa de 3s en vez de golpear
  //  de una. game.js lo arranca en initGame(). Como cualquier otro
  //  sonido, sound.js lo enruta al bus "ambiente": el jugador puede
  //  bajarlo o silenciarlo del todo desde el panel de sonido sin tocar
  //  este archivo.
  let windStarted = false;
  function startAmbientWind(){
    const ac = ensureAudio();
    if (!ac || windStarted) return;
    windStarted = true;
    const bufferSize = ac.sampleRate * 4;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i=0;i<bufferSize;i++){
      const white = Math.random()*2-1;
      last = (last + 0.02*white) / 1.02;   // integración: suaviza el ruido blanco
      data[i] = last * 3.4;                 // reescala lo que la integración deja muy flojo
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';    // sin resonancia: nada de silbido, solo cuerpo grave
    filter.frequency.value = 420;
    filter.Q.value = 0.35;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 70;    // variación suave del filtro, ráfagas apenas perceptibles
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    const gain = ac.createGain();
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.015, now + 3);   // entra despacio, bien bajo
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    src.start();
  }

  // ---- melodía ambiente: tema nostálgico, se calla durante el jefe ----
  //  Antes esto era un acorde sostenido sin línea melódica real — sonaba
  //  a textura, no a una melodía. Ahora hay una frase de verdad (16 notas,
  //  una por segundo, en la menor) tocada con timbre de caja de música
  //  sobre una progresión de acordes cálidos que la sostienen debajo
  //  (i-VI-III-VII: Am-F-C-G, con tercera para que se sienta el modo,
  //  no solo quintas vacías). Suena desde el primer toque de pantalla —
  //  ya en el menú, no solo dentro de la partida — y también dentro de
  //  ella salvo durante el jefe.
  //
  //  Todo pasa por UN solo nodo (melodyBus) conectado a la salida real
  //  una única vez; sound.js intercepta esa conexión concreta y la
  //  enruta al bus "ambiente" del panel de sonido.
  let melodyBus = null;
  let melodyTimer = null;
  let chordTimer = null;
  let melodyStep = 0;

  // frase (Hz, 0 = silencio): E D C _ D C B _ C B A _ B A _ _  — en la
  // menor, desciende en oleadas cortas y resuelve en la tónica (A)
  const MELODY_PHRASE = [
    329.63, 293.66, 261.63, 0,
    293.66, 261.63, 246.94, 0,
    261.63, 246.94, 220.00, 0,
    246.94, 220.00, 0,      0
  ];
  const MELODY_STEP = 1000;   // 1 nota por segundo: tempo lento, contemplativo

  // acordes: [fundamental, tercera] — uno cada 4 notas de la frase (i-VI-III-VII)
  const CHORD_PROGRESSION = [
    [110.00, 130.81],  // Am  (A2, C3)
    [87.31,  110.00],  // F   (F2, A2)
    [130.81, 164.81],  // C   (C3, E3)
    [98.00,  123.47]   // G   (G2, B2)
  ];
  const CHORD_DUR = 4.4;   // más larga que el paso: se solapa al cambiar de acorde
  const CHORD_STEP = 4;    // en notas de la frase (4s a MELODY_STEP=1000)

  function silenced(){
    if (typeof paused !== 'undefined' && paused) return true;
    if (typeof running !== 'undefined' && !running) return true;
    if (typeof bossActive === 'function' && bossActive()) return true;   // la música del jefe manda
    return false;
  }

  // nota principal: timbre suave tipo caja de música, con un vibrato
  // apenas perceptible que le da calidez en vez de sonar a pitido limpio
  function melodyNote(freq){
    const ac = ensureAudio();
    if (!ac || !melodyBus) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    const vibrato = ac.createOscillator();
    vibrato.frequency.value = 4.5;
    const vibratoGain = ac.createGain();
    vibratoGain.gain.value = 1.6;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(now); vibrato.stop(now + 1.0);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.032, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.9);
    osc.connect(gain); gain.connect(melodyBus);
    osc.start(now); osc.stop(now + 0.95);

    // eco de la propia nota, flojo y breve: la frase "se recuerda" a sí misma
    const echoNow = now + 0.28;
    const echoOsc = ac.createOscillator();
    echoOsc.type = 'sine';
    echoOsc.frequency.setValueAtTime(freq, echoNow);
    const echoGain = ac.createGain();
    echoGain.gain.setValueAtTime(0.0001, echoNow);
    echoGain.gain.exponentialRampToValueAtTime(0.011, echoNow + 0.04);
    echoGain.gain.exponentialRampToValueAtTime(0.0004, echoNow + 0.8);
    echoOsc.connect(echoGain); echoGain.connect(melodyBus);
    echoOsc.start(echoNow); echoOsc.stop(echoNow + 0.85);
  }

  function chordSwell(pair){
    const ac = ensureAudio();
    if (!ac || !melodyBus) return;
    const now = ac.currentTime;
    pair.forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      const gain = ac.createGain();
      const peak = i === 0 ? 0.020 : 0.011;   // fundamental por debajo de la tercera
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + CHORD_DUR*0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + CHORD_DUR);
      osc.connect(gain); gain.connect(melodyBus);
      osc.start(now); osc.stop(now + CHORD_DUR + 0.05);
    });
  }

  function startAmbientMelody(){
    const ac = ensureAudio();
    if (!ac || melodyTimer) return;
    if (!melodyBus){
      melodyBus = ac.createGain();
      melodyBus.gain.value = 1;
      melodyBus.connect(ac.destination);
    }
    const tick = () => {
      if (!silenced()){
        const freq = MELODY_PHRASE[melodyStep % MELODY_PHRASE.length];
        if (freq) melodyNote(freq);
        if (melodyStep % CHORD_STEP === 0){
          const chord = CHORD_PROGRESSION[(melodyStep/CHORD_STEP) % CHORD_PROGRESSION.length];
          chordSwell(chord);
        }
      }
      melodyStep++;
    };
    tick();
    melodyTimer = setInterval(tick, MELODY_STEP);
  }

  function stopAmbientMelody(){
    if (melodyTimer !== null) { clearInterval(melodyTimer); melodyTimer = null; }
    melodyStep = 0;
  }