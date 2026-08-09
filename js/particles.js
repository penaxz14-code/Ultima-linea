let particles, embers;

  // compacta un array in-place (mantiene solo los que cumplen keepFn) sin crear
  // un array nuevo cada frame como hace .filter() — reduce presión sobre el GC
  function compact(arr, keepFn){
    let w = 0;
    for (let i=0;i<arr.length;i++){
      if (keepFn(arr[i])) arr[w++] = arr[i];
    }
    arr.length = w;
    return arr;
  }

  const MAX_PARTICLES = 220;

  function spawnParticles(x, y, color, n, spread){
    for (let i=0;i<n;i++){
      if (particles.length >= MAX_PARTICLES) return;
      const ang = Math.random()*Math.PI*2;
      const spd = Math.random()*(spread||140)+30;
      particles.push({
        x, y,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd - 60,
        life: 0.5 + Math.random()*0.4,
        maxLife: 0.5 + Math.random()*0.4,
        color, grav:true, chunk:false
      });
    }
  }

  function spawnChunks(x, y, color, n, spread){
    for (let i=0;i<n;i++){
      if (particles.length >= MAX_PARTICLES) return;
      const ang = Math.random()*Math.PI*2;
      const spd = Math.random()*(spread||140)+40;
      particles.push({
        x, y,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd - 80,
        life: 0.6 + Math.random()*0.5,
        maxLife: 0.6 + Math.random()*0.5,
        color, grav:true, chunk:true,
        rot: Math.random()*Math.PI*2,
        rotSpeed: (Math.random()-0.5)*12,
        w: 3+Math.random()*4, h: 3+Math.random()*4
      });
    }
  }

  function spawnHeadHitGore(x, y, isKill){
    spawnParticles(x, y, '#ff2d4e', isKill?14:7, isKill?180:120);
    spawnChunks(x, y, '#e8d9a8', isKill?8:3, isKill?170:110);
    spawnChunks(x, y-2, '#f2f2f2', isKill?3:1, isKill?130:80);
    if (isKill) spawnParticles(x, y, '#7a1010', 9, 140);
  }

  function spawnHelmetHitGore(x, y, broke){
    spawnParticles(x, y, '#e8c840', broke?6:3, 90);
    spawnChunks(x, y, '#3a4a2e', broke?7:2, broke?150:70);
    if (broke) spawnChunks(x, y, '#5c7048', 3, 130);
  }

  function spawnBodyHitGore(x, y, isKill){
    spawnParticles(x, y, '#ff2d4e', isKill?16:7, isKill?170:100);
    spawnChunks(x, y, isKill?'#6b3a2a':'#4f7a35', isKill?7:2, isKill?160:90);
  }

function updateParticlesPhysics(dt){
    particles.forEach(p => {
      p.x += p.vx*dt;
      p.y += p.vy*dt;
      if (p.grav) p.vy += 260*dt;
      p.vx *= 0.96;
      p.life -= dt;
      if (p.chunk) p.rot += p.rotSpeed*dt;
    });
    compact(particles, p => p.life > 0);
}
