(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // --- Config ---
  const WORLD = { w: canvas.width, h: canvas.height };
  const COLORS = {
    bg: '#1b1f2a',
    grid: '#2a3345',
    blue: '#4aa8ff',
    blueDark: '#2c7bd1',
    red: '#ff6868',
    redDark: '#cc4d4d',
    bulletBlue: '#9fd0ff',
    bulletRed: '#ffc0c0',
  green: '#76e37c',
  greenDark: '#3ab44b',
  bulletGreen: '#c4f3c6',
  building: '#9aa6bf',
  buildingDead: '#3b4355',
  factory: '#b0a78e',
  barracks: '#8cbf9a',
  tower: '#b58ccc',
  bunker: '#a6937d',
  silo: '#c7cfc1',
  house: '#b3c7e6',
  power: '#ffd27a',
    hpBarBg: '#2b2f3b',
    hpBarGreen: '#7CFC00',
    hpBarRed: '#ff5252',
    text: '#e7e7e7',
    shadow: 'rgba(0,0,0,0.35)'
  };

  const input = new Set();
  window.addEventListener('keydown', (e) => {
    input.add(e.code);
    // prevent page scroll on arrows/space
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.delete(e.code));

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function len(vx, vy) { return Math.hypot(vx, vy); }

  function teamMainColor(team) {
    if (team === 'blue') return COLORS.blue;
    if (team === 'red') return COLORS.red;
    if (team === 'green') return COLORS.green;
    return '#ccc';
  }
  function teamDarkColor(team) {
    if (team === 'blue') return COLORS.blueDark;
    if (team === 'red') return COLORS.redDark;
    if (team === 'green') return COLORS.greenDark;
    return '#888';
  }
  function bulletColor(team) {
    if (team === 'blue') return COLORS.bulletBlue;
    if (team === 'red') return COLORS.bulletRed;
    if (team === 'green') return COLORS.bulletGreen;
    return '#ddd';
  }

  function circleRectIntersect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  function resolveCircleRect(cx, cy, cr, rx, ry, rw, rh) {
    // minimal axis separation resolution; returns new {x,y}
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    const dist2 = dx*dx + dy*dy;
    if (dist2 > cr*cr) return { x: cx, y: cy };

    const d = Math.sqrt(dist2) || 0.0001;
    const nx = dx / d;
    const ny = dy / d;
    const overlap = cr - d;
    return { x: cx + nx * overlap, y: cy + ny * overlap };
  }

  class Bullet {
    constructor(x, y, vx, vy, team) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
  this.r = 4;
      this.life = 1500; // ms
      this.team = team; // 'blue' | 'red'
      this.alive = true;
      this.damage = 1;
  this._trail = 0;
    }
    update(dt, game) {
      if (!this.alive) return;
      this.life -= dt;
      if (this.life <= 0) { this.alive = false; return; }
      this.x += this.vx * dt;
      this.y += this.vy * dt;

  // simple trail particles
  this._trail -= dt;
  if (this._trail <= 0) { this._trail = 60; game.spawnTrail(this.x, this.y, this.team); }

      // walls
      if (this.x < this.r || this.x > WORLD.w - this.r) this.alive = false;
      if (this.y < this.r || this.y > WORLD.h - this.r) this.alive = false;

  // building collision vs any enemy building
      for (const b of (game.buildings || [])) {
        if (b.team === this.team) continue;
        if (b.dead) continue;
        if (circleRectIntersect(this.x, this.y, this.r, b.x, b.y, b.w, b.h)) {
          this.alive = false;
      b.hp -= this.damage;
          if (b.hp <= 0) {
            b.dead = true; b.hp = 0;
            const cx = b.x + b.w/2, cy = b.y + b.h/2;
            game.spawnExplosion(cx, cy, this.team);
            game.spawnRubble(b);
          }
      game.spawnImpact(this.x, this.y, this.team);
          break;
        }
      }

      // damage tanks (no friendly fire): test against all enemy tanks
      for (const t of game.tanks) {
        if (t.team === this.team || t.dead) continue;
        if (circleRectIntersect(this.x, this.y, this.r, t.x - t.r, t.y - t.r, t.r*2, t.r*2)) {
          this.alive = false;
          t.hp -= this.damage;
          if (t.hp <= 0) { t.destroy(); game.spawnExplosion(this.x, this.y, this.team); }
          else { game.spawnImpact(this.x, this.y, this.team); }
          break;
        }
      }

      // people collision (enemy only)
      for (const p of game.people) {
        if (!p.alive) continue;
        if (p.team === this.team) continue;
        const px = p.x - 6, py = p.y - 20, pw = 12, ph = 22;
        if (circleRectIntersect(this.x, this.y, this.r, px, py, pw, ph)) {
          this.alive = false;
          p.hp -= this.damage;
          if (p.hp <= 0) { p.alive = false; game.spawnMiniExplosion(p.x, p.y, this.team); }
          else { game.spawnImpact(this.x, this.y, this.team); }
          break;
        }
      }
    }
    draw(ctx) {
      if (!this.alive) return;
      ctx.save();
  ctx.fillStyle = bulletColor(this.team);
  ctx.shadowColor = teamMainColor(this.team);
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Building {
    constructor(x, y, team, kind = 'block') {
      this.x = x; this.y = y;
      this.kind = kind; // 'block' | 'factory' | 'barracks' | 'tower' | 'bunker' | 'silo' | 'house' | 'power'
      const sizes = {
        block: { w: 44, h: 60, hp: 4 },
        factory: { w: 64, h: 64, hp: 7 },
        barracks: { w: 54, h: 56, hp: 5 },
        tower: { w: 40, h: 80, hp: 3 },
        bunker: { w: 70, h: 44, hp: 8 },
        silo: { w: 36, h: 72, hp: 4 },
        house: { w: 50, h: 50, hp: 4 },
        power: { w: 44, h: 54, hp: 5 }
      };
      const s = sizes[kind] || sizes.block;
      this.w = s.w; this.h = s.h;
      this.team = team;
      this.maxHp = s.hp; this.hp = this.maxHp;
      this.dead = false;
      // simple turret AI
  this.fireCooldown = 5000; // ms
  this.fireRate = 5000; // ms between shots
      this.range = 340; // px
    }
    update(dt, game) {
      if (this.dead) return;
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      if (this.fireCooldown > 0) return;
      // target nearest enemy tank, else enemy person, within range
      const cx = this.x + this.w/2, cy = this.y + this.h/2;
      let target = null; let bestD = this.range * this.range; let tx=0, ty=0;
      for (const t of game.tanks) {
        if (t.dead || t.team === this.team) continue;
        const dx = t.x - cx, dy = t.y - cy; const d2 = dx*dx + dy*dy;
        if (d2 < bestD) { bestD = d2; target = t; tx = t.x; ty = t.y; }
      }
      if (!target) {
        for (const p of game.people) {
          if (!p.alive || p.team === this.team) continue;
          const dx = p.x - cx, dy = p.y - cy; const d2 = dx*dx + dy*dy;
          if (d2 < bestD) { bestD = d2; target = p; tx = p.x; ty = p.y; }
        }
      }
      if (target) {
        const dx = tx - cx, dy = ty - cy; const d = Math.hypot(dx, dy);
        if (d > 1) {
          const vx = dx / d, vy = dy / d;
          const speed = 0.5; // px/ms
          const bx = cx + vx * 8, by = cy + vy * 8;
          game.bullets.push(new Bullet(bx, by, vx*speed, vy*speed, this.team));
          game.spawnMuzzle(bx, by, this.team);
          this.fireCooldown = this.fireRate;
        }
      }
    }
    draw(ctx) {
      ctx.save();
      let color = this.dead ? COLORS.buildingDead : COLORS.building;
      if (!this.dead) {
        if (this.kind === 'factory') color = COLORS.factory;
        else if (this.kind === 'barracks') color = COLORS.barracks;
        else if (this.kind === 'tower') color = COLORS.tower;
        else if (this.kind === 'bunker') color = COLORS.bunker;
        else if (this.kind === 'silo') color = COLORS.silo;
        else if (this.kind === 'house') color = COLORS.house;
        else if (this.kind === 'power') color = COLORS.power;
      }
      ctx.fillStyle = color;
  ctx.strokeStyle = teamDarkColor(this.team);
      ctx.lineWidth = 2;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);

      // team cap stripe
  ctx.fillStyle = teamMainColor(this.team);
      ctx.fillRect(this.x, this.y - 6, this.w, 6);

      // subtle windows/roof for more detail
      if (!this.dead) {
        ctx.fillStyle = '#2a2f3b';
        const cols = Math.max(2, Math.floor(this.w / 14));
        const rows = Math.max(1, Math.floor(this.h / 18));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const wx = this.x + 6 + c * ((this.w - 12) / cols);
            const wy = this.y + 6 + r * ((this.h - 12) / rows);
            ctx.fillRect(wx, wy, 6, 6);
          }
        }
        ctx.strokeStyle = '#444b5c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.w, this.y);
        ctx.stroke();
      }

      // hp bar
      const p = this.hp / this.maxHp;
      ctx.fillStyle = COLORS.hpBarBg;
      ctx.fillRect(this.x, this.y + this.h + 4, this.w, 6);
      ctx.fillStyle = p > 0.5 ? COLORS.hpBarGreen : COLORS.hpBarRed;
      ctx.fillRect(this.x, this.y + this.h + 4, this.w * p, 6);
      ctx.restore();
    }
  }

  class Tank {
    constructor(x, y, team, keys) {
      this.x = x; this.y = y;
      this.r = 22; // bigger tank
      this.team = team; // 'blue' | 'red'
      this.speed = 0.23; // px per ms
      this.aimX = 1; this.aimY = 0; // default
      this.fireCooldown = 0; // ms
      this.maxHp = 6; this.hp = this.maxHp;
      this.dead = false;
      this.respawnTimer = 0;
      this.keys = keys; // {up,down,left,right,fire}
    }
    update(dt, game) {
      if (this.dead) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          // respawn at team base if available (triangle layout)
          if (game && game.bases && game.bases[this.team]) {
            const base = game.bases[this.team];
            this.x = base.x + (Math.random() - 0.5) * 60;
            this.y = base.y + (Math.random() - 0.5) * 60;
          } else {
            this.x = this.team === 'red' ? WORLD.w - 140 : (this.team === 'green' ? WORLD.w/2 : 140);
            this.y = WORLD.h/2 + (Math.random() < 0.5 ? -50 : 50);
          }
          this.hp = this.maxHp;
          this.dead = false;
        }
        return;
      }
      let ax = 0, ay = 0;
      if (input.has(this.keys.left)) ax -= 1;
      if (input.has(this.keys.right)) ax += 1;
      if (input.has(this.keys.up)) ay -= 1;
      if (input.has(this.keys.down)) ay += 1;
      if (ax !== 0 || ay !== 0) {
        const L = Math.hypot(ax, ay);
        ax /= L; ay /= L;
        this.aimX = ax; this.aimY = ay;
      }
      // move
      this.x += ax * this.speed * dt;
      this.y += ay * this.speed * dt;

      // walls clamp
      this.x = clamp(this.x, this.r, WORLD.w - this.r);
      this.y = clamp(this.y, this.r, WORLD.h - this.r);

  // building collisions (solid for all teams)
  const allBuildings = game.buildings || [];
  for (const b of allBuildings) {
        if (b.dead) continue;
        if (circleRectIntersect(this.x, this.y, this.r, b.x, b.y, b.w, b.h)) {
          const sep = resolveCircleRect(this.x, this.y, this.r, b.x, b.y, b.w, b.h);
          this.x = sep.x; this.y = sep.y;
        }
      }

  // firing
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      const firePressed = input.has(this.keys.fire) || (this.keys.fire2 && input.has(this.keys.fire2));
      if (firePressed && this.fireCooldown === 0) {
        const bx = this.x + this.aimX * (this.r + 6);
        const by = this.y + this.aimY * (this.r + 6);
        const speed = 0.6; // px per ms
        const bvx = this.aimX * speed;
        const bvy = this.aimY * speed;
        game.bullets.push(new Bullet(bx, by, bvx, bvy, this.team));
  game.spawnMuzzle(bx, by, this.team);
        this.fireCooldown = 300; // ms
      }
    }
    draw(ctx) {
  if (this.dead) return;
      ctx.save();
      // shadow
      ctx.shadowColor = COLORS.shadow;
      ctx.shadowBlur = 8;

  // body with light shading
  const bodyColor = teamMainColor(this.team);
  const grad = ctx.createRadialGradient(this.x - this.r/3, this.y - this.r/3, this.r/2, this.x, this.y, this.r);
  grad.addColorStop(0, bodyColor);
  grad.addColorStop(1, teamDarkColor(this.team));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
  ctx.fill();

  // turret
  ctx.strokeStyle = teamDarkColor(this.team);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.aimX * (this.r + 12), this.y + this.aimY * (this.r + 12));
      ctx.stroke();

      // center
      ctx.fillStyle = '#101318';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // HP ring
      const p = this.hp / this.maxHp;
      ctx.strokeStyle = p > 0.5 ? COLORS.hpBarGreen : COLORS.hpBarRed;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 6, -Math.PI/2, -Math.PI/2 + Math.PI*2*p);
      ctx.stroke();
      ctx.restore();
    }
    destroy() {
      this.dead = true;
      this.respawnTimer = 1500; // ms
    }
  }

  class Person {
    constructor(x, y, team) {
      this.x = x; this.y = y;
      this.team = team;
      this.dirTimer = 0;
      this.speed = 0.08 + Math.random()*0.05;
      this.aimAngle = Math.random()*Math.PI*2;
  this.fireCooldown = 0; // 5s cadence after first shot
      this.alive = true;
      this.maxHp = 1; this.hp = this.maxHp;
    }
    update(dt, game) {
      if (!this.alive) return;
      this.dirTimer -= dt;
      if (this.dirTimer <= 0) {
        this.aimAngle = Math.random()*Math.PI*2;
        this.dirTimer = 800 + Math.random()*1200;
      }
      this.x += Math.cos(this.aimAngle) * this.speed * dt;
      this.y += Math.sin(this.aimAngle) * this.speed * dt;
  // roam freely across the map, only clamp to world bounds
  this.x = clamp(this.x, 12, WORLD.w - 12);
  this.y = clamp(this.y, 24, WORLD.h - 24);

      // try to shoot at enemy tank or buildings
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      let target = null; let tx = 0; let ty = 0;
      // choose nearest alive enemy tank among all tanks
      let bestD = Infinity;
      for (const t of game.tanks) {
        if (t.dead || t.team === this.team) continue;
        const dx = t.x - this.x; const dy = t.y - this.y; const d2 = dx*dx + dy*dy;
        if (d2 < bestD) { bestD = d2; target = t; tx = t.x; ty = t.y; }
      }
      if (!target) {
        let bestBd = Infinity;
        for (const b of (game.buildings || [])) {
          if (b.dead || b.team === this.team) continue;
          const dx = b.x + b.w/2 - this.x;
          const dy = b.y + b.h/2 - this.y;
          const d2 = dx*dx + dy*dy;
          if (d2 < bestBd) { bestBd = d2; tx = b.x + b.w/2; ty = b.y + b.h/2; target = b; }
        }
      }
      if (target) {
        const dx = tx - this.x; const dy = ty - this.y; const dist = Math.hypot(dx, dy);
        if (dist < 260 && this.fireCooldown === 0) {
          const vx = dx / dist; const vy = dy / dist;
          const bx = this.x + vx * 10; const by = this.y + vy * 10;
          const speed = 0.45;
          game.bullets.push(new Bullet(bx, by, vx*speed, vy*speed, this.team));
          game.spawnMuzzle(bx, by, this.team);
          this.fireCooldown = 5000; // 5 seconds between shots
        }
      }
    }
    draw(ctx) {
      if (!this.alive) return;
      // simple cartoon person: head+body, tiny gun
      ctx.save();
      ctx.translate(this.x, this.y);
  const bodyColor = teamMainColor(this.team);
      // body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-5, -8, 10, 14);
      // head
      ctx.fillStyle = '#ffe0bd';
      ctx.beginPath(); ctx.arc(0, -14, 5, 0, Math.PI*2); ctx.fill();
      // tiny gun
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(10, -6);
      ctx.stroke();
      ctx.restore();
    }
  }

  class Particle {
    constructor(x, y, color, life, size, vx, vy) {
      this.x = x; this.y = y; this.color = color;
      this.life = life; this.total = life;
      this.size = size; this.vx = vx; this.vy = vy;
    }
    update(dt) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      ctx.save();
      const a = Math.max(0, this.life / this.total);
      ctx.globalAlpha = a;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Game {
    constructor() {
      this.reset();
    }
    reset() {
      // core state
      this.bullets = [];
      this.buildings = [];
      this.people = [];
      this.particles = [];

      // triangle base positions
      const margin = 70;
      this.bases = {
        blue:  { x: margin + 140, y: WORLD.h - (margin + 120) },
        red:   { x: WORLD.w - (margin + 140), y: WORLD.h - (margin + 120) },
        green: { x: WORLD.w/2, y: margin + 120 }
      };
      this.territoryRadius = 260;

      // place 6 buildings around each base in a ring
      const kinds = ['block','factory','barracks','tower','bunker','silo','house','power'];
      const ringR = 150;
      const teams = ['blue','green','red'];
      for (const team of teams) {
        const base = this.bases[team];
        for (let i = 0; i < 6; i++) {
          const kind = kinds[i % kinds.length];
          const sample = new Building(0,0,team, kind);
          const a = (i / 6) * Math.PI * 2 + (team === 'green' ? Math.PI : 0);
          let bx = base.x + Math.cos(a) * ringR - sample.w/2;
          let by = base.y + Math.sin(a) * ringR - sample.h/2;
          bx = clamp(bx, 20, WORLD.w - sample.w - 20);
          by = clamp(by, 80, WORLD.h - sample.h - 20);
          this.buildings.push(new Building(bx, by, team, kind));
        }
      }

      // players at bases
      this.player1 = new Tank(this.bases.blue.x, this.bases.blue.y + 40, 'blue', {
        up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'KeyC'
      });
      this.player2 = new Tank(this.bases.red.x, this.bases.red.y, 'red', {
        up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'Slash', fire2: 'NumpadDivide'
      });
      this.player3 = new Tank(this.bases.green.x, this.bases.green.y - 40, 'green', {
        up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', fire: 'KeyB'
      });
      this.tanks = [this.player1, this.player2, this.player3];

      this.winner = null;
      this.time = performance.now();

      // NPCs around each base in random circle
      const npcsPerTeam = 10;
      for (const team of teams) {
        const base = this.bases[team];
        for (let i = 0; i < npcsPerTeam; i++) {
          const r = Math.random() * (this.territoryRadius - 40);
          const a = Math.random() * Math.PI * 2;
          const x = clamp(base.x + Math.cos(a) * r, 12, WORLD.w - 12);
          const y = clamp(base.y + Math.sin(a) * r, 24, WORLD.h - 24);
          this.people.push(new Person(x, y, team));
        }
      }
    }
    update() {
      const now = performance.now();
      const dt = clamp(now - this.time, 0, 50); // cap step
      this.time = now;

      if (input.has('KeyR')) { this.reset(); return; }
      if (this.winner) return; // freeze when game over

      for (const t of this.tanks) t.update(dt, this);
  for (const b of this.buildings) b.update(dt, this);
      for (const b of this.bullets) b.update(dt, this);
      this.bullets = this.bullets.filter(b => b.alive);
      for (const p of this.people) p.update(dt, this);
      this.people = this.people.filter(p => p.alive);
      for (const q of this.particles) q.update(dt);
      this.particles = this.particles.filter(q => q.life > 0);

      // three-team win detection
      const aliveTeams = new Set();
      for (const b of this.buildings) if (!b.dead) aliveTeams.add(b.team);
      if (aliveTeams.size === 1) this.winner = [...aliveTeams][0];
      else if (aliveTeams.size === 0) this.winner = 'draw';
    }
    draw() {
      // background
      ctx.clearRect(0, 0, WORLD.w, WORLD.h);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
      // subtle grid
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 50; x < WORLD.w; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); }
      for (let y = 50; y < WORLD.h; y += 50) { ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); }
      ctx.stroke();
      // triangle territory lines connecting team bases
      if (this.bases) {
        const b = this.bases;
        ctx.strokeStyle = '#2f3749';
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(b.blue.x, b.blue.y); ctx.lineTo(b.green.x, b.green.y);
        ctx.lineTo(b.red.x, b.red.y); ctx.lineTo(b.blue.x, b.blue.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // buildings
      for (const b of this.buildings) b.draw(ctx);
      // bullets
      for (const b of this.bullets) b.draw(ctx);
      // tanks
      for (const t of this.tanks) t.draw(ctx);
      // people
      for (const p of this.people) p.draw(ctx);
      // particles on top
      for (const q of this.particles) q.draw(ctx);

      // HUD overlay if winner
      if (this.winner) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, WORLD.w, WORLD.h);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 42px system-ui';
        let msg = '';
        if (this.winner === 'draw') msg = 'Draw!';
        else if (this.winner === 'blue') msg = 'Blue Wins!';
        else if (this.winner === 'red') msg = 'Red Wins!';
        else if (this.winner === 'green') msg = 'Green Wins!';
        ctx.fillText(msg, WORLD.w/2, WORLD.h/2 - 20);
        ctx.font = '18px system-ui';
        ctx.fillText('Press R to restart', WORLD.w/2, WORLD.h/2 + 24);
        ctx.restore();
      }
    }
    frame() {
      this.update();
      this.draw();
      requestAnimationFrame(() => this.frame());
    }

    spawnImpact(x, y, team) {
      const color = bulletColor(team);
      for (let i = 0; i < 6; i++) {
        const a = Math.random()*Math.PI*2;
        const s = 0.2 + Math.random()*0.25;
        this.particles.push(new Particle(x, y, color, 300 + Math.random()*200, 2, Math.cos(a)*s, Math.sin(a)*s));
      }
    }
    spawnMuzzle(x, y, team) {
      const color = team === 'blue' ? '#e8f6ff' : (team === 'red' ? '#ffe8e8' : '#e8ffe8');
      for (let i = 0; i < 4; i++) {
        const a = Math.random()*Math.PI*2;
        const s = 0.25 + Math.random()*0.3;
        this.particles.push(new Particle(x, y, color, 180 + Math.random()*120, 2, Math.cos(a)*s, Math.sin(a)*s));
      }
    }
    spawnExplosion(x, y, team) {
      const base = teamMainColor(team);
      for (let i = 0; i < 24; i++) {
        const a = Math.random()*Math.PI*2;
        const s = 0.25 + Math.random()*0.5;
        this.particles.push(new Particle(x, y, base, 600 + Math.random()*300, 3, Math.cos(a)*s, Math.sin(a)*s));
      }
    }
    spawnMiniExplosion(x, y, team) {
      const base = teamMainColor(team);
      for (let i = 0; i < 10; i++) {
        const a = Math.random()*Math.PI*2;
        const s = 0.2 + Math.random()*0.35;
        this.particles.push(new Particle(x, y, base, 350 + Math.random()*200, 2, Math.cos(a)*s, Math.sin(a)*s));
      }
    }
    spawnRubble(b) {
      const cx = b.x + b.w/2, cy = b.y + b.h/2;
      for (let i = 0; i < 14; i++) {
        const a = Math.random()*Math.PI*2;
        const s = 0.15 + Math.random()*0.25;
        const color = '#445066';
        this.particles.push(new Particle(cx, cy, color, 700 + Math.random()*400, 2, Math.cos(a)*s, Math.sin(a)*s));
      }
    }
    spawnTrail(x, y, team) {
      const color = 'rgba(255,255,255,0.7)';
      this.particles.push(new Particle(x, y, color, 220, 1.5, 0, 0));
    }
  }

  const game = new Game();
  game.frame();
})();
