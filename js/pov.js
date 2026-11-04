/* =========================================================
   ODV RIO-SAONARA · "POV: SEI IL PALLONE"
   Scena Three.js guidata dallo scroll: la camera È il pallone.
   Un'azione intera di set point (24–23):
     01 battuta ODV → 02 ricezione e attacco avversario → 03 MURO ODV
     → 04 alzata → 05 schiacciata → PUNTO ODV, 25–23.
   Tutto è procedurale (texture disegnate su canvas, materiali "basic"
   neon): niente asset esterni, leggero anche su mobile.
   Espone window.ODVPov.init(team, onProgress) → Promise (true quando la scena è completa);
   main.js tiene il loader finché non è pronta.
   ========================================================= */
(() => {
  'use strict';

  // Coordinate campo (metri): x larghezza (-4.5…4.5), y altezza, z lunghezza.
  // ODV gioca in z > 0, le avversarie in z < 0, rete a z = 0 (nastro a 2.24 m).
  const NET_TOP = 2.24;
  const PINK = '#FF2E9A', BLUE = '#6EC1FF', YELLOW = '#FFD23F';

  // ---------- PERCORSO DELLA CAMERA (= il pallone) ----------
  // p = avanzamento dello scroll (0–1). pos = dove si trova il pallone, look = dove "guarda".
  const KEYS = [
    { p: 0.000, pos: [2.2, 1.55, 11.2], look: [0.0, 1.9, -4.0] },  // in mano alla battitrice
    { p: 0.050, pos: [2.2, 2.30, 11.0], look: [0.0, 2.6, -4.0] },  // parte il lancio
    { p: 0.110, pos: [2.1, 4.60, 10.7], look: [0.0, 4.0, -6.0] },  // culmine del lancio
    { p: 0.150, pos: [2.0, 3.40, 10.3], look: [0.0, 3.0, -6.0] },  // COLPO di battuta
    { p: 0.205, pos: [1.2, 3.30, 4.50], look: [0.0, 2.5, -8.0] },
    { p: 0.240, pos: [0.6, 2.55, 0.00], look: [-0.6, 1.4, -8.0] }, // a filo del nastro
    { p: 0.285, pos: [-0.6, 1.50, -5.5], look: [-1.2, 0.8, -8.0] },
    { p: 0.320, pos: [-1.1, 0.95, -7.4], look: [-1.2, 0.6, -8.6] }, // ricezione avversaria
    { p: 0.360, pos: [-0.8, 3.20, -5.5], look: [0.0, 4.4, -2.0] },
    { p: 0.400, pos: [0.3, 4.40, -3.0], look: [1.2, 3.0, -1.5] },
    { p: 0.430, pos: [1.0, 3.00, -1.8], look: [1.4, 3.3, -1.2] },  // alzata avversaria
    { p: 0.455, pos: [1.5, 3.25, -1.1], look: [1.3, 2.6, 4.0] },   // attacco avversario
    { p: 0.470, pos: [1.55, 2.85, -0.28], look: [1.6, 2.8, 3.0] }, // MURO!
    { p: 0.510, pos: [1.3, 4.60, 1.2], look: [0.6, 8.0, 4.0] },    // la palla schizza in alto
    { p: 0.560, pos: [0.8, 6.20, 3.0], look: [0.5, 0.0, 3.2] },    // vista dall'alto sul campo ODV
    { p: 0.620, pos: [0.6, 2.70, 1.4], look: [0.6, 1.4, 0.6] },    // alzata ODV
    { p: 0.680, pos: [1.9, 4.50, 1.1], look: [3.5, 2.9, 1.6] },
    { p: 0.740, pos: [2.8, 3.60, 0.25], look: [3.75, 2.50, 2.0] },    // sospesa: arriva l'attaccante
    { p: 0.780, pos: [3.3, 3.40, 0.9], look: [1.0, 0.0, -6.0] },   // SCHIACCIATA
    { p: 0.810, pos: [2.2, 2.75, -0.6], look: [-1.5, 0.0, -6.5] }, // sopra la rete
    { p: 0.855, pos: [-1.9, 0.16, -6.2], look: [-2.6, 0.0, -7.2] },// TERRA!
    { p: 0.890, pos: [-2.6, 1.40, -7.4], look: [-2.5, 3.2, -12.0] },
    { p: 0.950, pos: [-3.0, 2.30, -8.6], look: [0.0, 3.6, -14.0] },
    { p: 1.000, pos: [-3.2, 2.10, -9.3], look: [0.0, 3.4, -14.0] }
  ];
  // Colpi: scossa della camera + flash
  const HITS = [
    { p: 0.150, power: 0.7, flash: 0.35 },
    { p: 0.320, power: 0.5, flash: 0.15 },
    { p: 0.455, power: 0.8, flash: 0.25 },
    { p: 0.470, power: 1.2, flash: 0.8 },
    { p: 0.620, power: 0.35, flash: 0.1 },
    { p: 0.780, power: 1.3, flash: 0.6 },
    { p: 0.855, power: 1.6, flash: 1.0 }
  ];
  // Didascalie in sovrimpressione
  const ACTS = [
    { from: 0.06, to: 0.27, text: '01 · Battuta', sub: 'Float in salto · ODV' },
    { from: 0.29, to: 0.44, text: '02 · Ricezione', sub: 'Le avversarie costruiscono' },
    { from: 0.45, to: 0.56, text: '03 · Muro', sub: 'Muro a due · ODV' },
    { from: 0.58, to: 0.72, text: '04 · Alzata', sub: 'Palla alta in banda' },
    { from: 0.74, to: 0.85, text: '05 · Schiacciata', sub: 'Diagonale stretta' }
  ];
  const CALLS = [
    { from: 0.470, to: 0.53, text: 'MURO!' },
    { from: 0.857, to: 0.97, text: 'PUNTO!' }
  ];

  // ---------- TEXTURE PROCEDURALI ----------
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

  function courtTexture() {
    const [c, g] = canvas(512, 1024); // 9 m × 18 m → 1 m = 56.9 px
    const m = 512 / 9;
    const grd = g.createLinearGradient(0, 0, 0, 1024);
    grd.addColorStop(0, '#16307a'); grd.addColorStop(0.5, '#1b3a8c'); grd.addColorStop(1, '#16307a');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 1024);
    // zone d'attacco leggermente più chiare
    g.fillStyle = 'rgba(110,193,255,.12)';
    g.fillRect(0, 512 - 3 * m, 512, 6 * m);
    // logo ODV a centrocampo per lato
    g.save(); g.globalAlpha = 0.16; g.fillStyle = '#fff'; g.font = '900 120px Orbitron, Arial'; g.textAlign = 'center';
    g.translate(256, 290); g.fillText('ODV', 0, 0); g.translate(0, 444); g.rotate(Math.PI); g.fillText('ODV', 0, 0); g.restore();
    g.strokeStyle = '#fff'; g.shadowColor = '#bfe4ff'; g.shadowBlur = 10; g.lineWidth = 7;
    g.strokeRect(4, 4, 504, 1016);
    [[512 - 3 * m], [512 + 3 * m]].forEach(([y]) => { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); });
    g.lineWidth = 9; g.beginPath(); g.moveTo(0, 512); g.lineTo(512, 512); g.stroke();
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function floorTexture() {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#0a0f2e'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(110,193,255,.08)'; g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 12); return t;
  }
  function netTexture() {
    const [c, g] = canvas(1024, 128);
    g.clearRect(0, 0, 1024, 128);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5;
    for (let x = -128; x < 1152; x += 14) {
      g.beginPath(); g.moveTo(x, 14); g.lineTo(x + 114, 128); g.stroke();
      g.beginPath(); g.moveTo(x + 114, 14); g.lineTo(x, 128); g.stroke();
    }
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1024, 14);
    g.fillStyle = PINK; g.font = '900 11px Orbitron, Arial'; g.textAlign = 'center';
    for (let x = 64; x < 1024; x += 256) g.fillText('ODV RIO-SAONARA', x, 11);
    g.fillStyle = '#fff'; g.fillRect(0, 120, 1024, 8);
    return new THREE.CanvasTexture(c);
  }
  function textTexture(text, color, w = 1024, h = 256, font = 'Anton, Impact, sans-serif') {
    const [c, g] = canvas(w, h);
    g.font = `${Math.round(h * 0.62)}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 28; g.fillStyle = '#fff';
    g.fillText(text, w / 2, h / 2); g.shadowBlur = 60; g.fillText(text, w / 2, h / 2);
    g.strokeStyle = color; g.lineWidth = 3; g.shadowBlur = 0; g.strokeText(text, w / 2, h / 2);
    return new THREE.CanvasTexture(c);
  }
  function glowTexture(color) {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, color); grd.addColorStop(0.35, color.replace(')', ',.35)').replace('rgb', 'rgba')); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  // Giocatrici: sagome neon disegnate a canvas (canvas 256×512 → 0.9 × 1.8 m)
  const POSES = {
    ready: { arms: [[[100, 170], [84, 238], [104, 272]], [[156, 170], [172, 238], [152, 272]]], legs: 'bent' },
    bump: { arms: [[[104, 168], [116, 240], [128, 286]], [[152, 168], [140, 240], [128, 286]]], legs: 'bent' },
    set: { arms: [[[100, 168], [74, 110], [108, 58]], [[156, 168], [182, 110], [148, 58]]], legs: 'straight' },
    spike: { arms: [[[152, 166], [196, 92], [214, 20]], [[104, 170], [70, 200], [48, 236]]], legs: 'tuck' },
    block: { arms: [[[106, 164], [96, 90], [92, 18]], [[150, 164], [160, 90], [164, 18]]], legs: 'straight' }
  };
  function figureTexture(pose, color) {
    const [c, g] = canvas(256, 512);
    const P = POSES[pose];
    const legs = {
      straight: [[[116, 300], [112, 404], [110, 500]], [[140, 300], [146, 404], [148, 500]]],
      bent: [[[114, 300], [92, 392], [110, 500]], [[142, 300], [164, 392], [146, 500]]],
      tuck: [[[116, 300], [88, 380], [104, 460]], [[140, 300], [170, 360], [160, 452]]]
    }[P.legs];
    g.lineCap = 'round'; g.lineJoin = 'round';
    const limb = (pts, wdt) => { g.lineWidth = wdt; g.beginPath(); g.moveTo(...pts[0]); pts.slice(1).forEach((q) => g.lineTo(...q)); g.stroke(); };
    const draw = (stroke, glow, alpha) => {
      g.globalAlpha = alpha; g.strokeStyle = stroke; g.fillStyle = stroke; g.shadowColor = color; g.shadowBlur = glow;
      // busto
      g.beginPath(); g.moveTo(104, 160); g.lineTo(152, 160); g.lineTo(144, 300); g.lineTo(112, 300); g.closePath(); g.fill();
      g.beginPath(); g.arc(128, 116, 30, 0, Math.PI * 2); g.fill();
      P.arms.forEach((a) => limb(a, 20)); legs.forEach((l) => limb(l, 26));
    };
    draw(color, 30, 0.45);   // alone
    draw(color, 14, 0.9);    // corpo
    if (color === PINK) { // scritta ODV sulla maglia
      g.globalAlpha = 1; g.shadowBlur = 0; g.fillStyle = '#04061a'; g.font = '900 30px Orbitron, Arial'; g.textAlign = 'center';
      g.fillText('ODV', 128, 236);
    }
    return new THREE.CanvasTexture(c);
  }
  function handTexture(color) {
    const [c, g] = canvas(256, 320);
    g.shadowColor = color; g.shadowBlur = 26; g.fillStyle = color; g.strokeStyle = '#fff'; g.lineWidth = 5;
    const shape = () => {
      g.beginPath();
      g.roundRect ? g.roundRect(54, 150, 150, 150, 40) : g.rect(54, 150, 150, 150);
      [[58, 40, 30, 140], [96, 12, 30, 168], [134, 20, 30, 160], [172, 56, 28, 124]].forEach(([x, y, w, h]) => {
        g.moveTo(x + w, y + 15); g.arc(x + w / 2, y + 15, w / 2, 0, Math.PI, true); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.closePath();
      });
      g.moveTo(54, 200); g.lineTo(12, 140); g.arc(24, 128, 16, Math.PI * 0.8, Math.PI * 1.9); g.lineTo(70, 180); g.closePath();
    };
    g.globalAlpha = 0.85; shape(); g.fill(); g.globalAlpha = 1; shape(); g.stroke();
    return new THREE.CanvasTexture(c);
  }

  // Card delle giocatrici ODV, come nella sezione "Le Eroine": riquadro neon nel colore del ruolo,
  // foto scontornata, ruolo, nome, superpotere e, per la capitana, il suo grido. Canvas 512×640 → 1.44 × 1.8 m.
  const ROLE_COLORS = { Palleggiatrice: '#6EC1FF', Opposto: '#FF2E9A', Schiacciatrice: '#A66BFF', Centrale: '#FFD23F', Libero: '#3DFFC8' };
  const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function wrap(g, text, maxW) {
    const words = text.split(/\s+/), lines = [];
    let line = '';
    words.forEach((w) => { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    return lines;
  }
  function cardTexture(person) {
    const [c, g] = canvas(512, 640);
    const tex = new THREE.CanvasTexture(c);
    const color = ROLE_COLORS[person.ruolo] || PINK;
    const parts = person.nome.trim().split(/\s+/), surname = parts.pop(), first = parts.join(' ');
    const phrase = person.superpotere || '';
    const round = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const draw = (img) => {
      g.clearRect(0, 0, 512, 640);
      g.save(); round(14, 14, 484, 612, 34); g.clip();
      const bg = g.createLinearGradient(0, 0, 0, 640); bg.addColorStop(0, '#121a4a'); bg.addColorStop(1, '#070b1f');
      g.fillStyle = bg; g.fillRect(0, 0, 512, 640);
      const halo = g.createRadialGradient(256, 210, 0, 256, 210, 300); halo.addColorStop(0, `${color}88`); halo.addColorStop(1, `${color}00`);
      g.fillStyle = halo; g.fillRect(0, 0, 512, 640);
      g.font = '120px Anton, Impact, sans-serif'; g.textAlign = 'right'; g.strokeStyle = `${color}99`; g.lineWidth = 3; g.strokeText('ODV', 500, 130);
      if (img) { g.shadowColor = color; g.shadowBlur = 24; g.drawImage(img, 26, 26, 460, 575); g.shadowBlur = 0; }
      const fade = g.createLinearGradient(0, 330, 0, 640); fade.addColorStop(0, 'rgba(5,7,26,0)'); fade.addColorStop(0.55, 'rgba(5,7,26,.92)'); fade.addColorStop(1, 'rgba(5,7,26,.98)');
      g.fillStyle = fade; g.fillRect(0, 330, 512, 310);
      // testi in basso a sinistra, come le card Instagram
      g.textAlign = 'left'; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 10;
      g.font = '700 20px Orbitron, monospace'; g.fillText(`${person.ruolo}${person.capitano ? ' · Capitana' : ''}`.toUpperCase(), 38, phrase ? 432 : 500);
      g.shadowBlur = 0; g.fillStyle = '#fff';
      g.font = '30px Anton, Impact, sans-serif'; g.fillText(first.toUpperCase(), 38, phrase ? 470 : 540);
      g.font = '62px Anton, Impact, sans-serif'; g.fillText(surname.toUpperCase(), 38, phrase ? 530 : 600);
      if (phrase) {
        if (person.grido) { // per la capitana, al posto della frase: il suo grido
          g.font = '52px Anton, Impact, sans-serif'; g.fillStyle = YELLOW; g.shadowColor = PINK; g.shadowBlur = 18;
          g.fillText(person.grido, 38, 590, 440); g.shadowBlur = 0;
        } else {
          g.font = '600 21px Manrope, Arial, sans-serif'; g.fillStyle = '#dfe6ff';
          wrap(g, phrase, 440).slice(0, 3).forEach((l, i) => g.fillText(l, 38, 566 + i * 25));
        }
      }
      g.restore();
      // riquadro neon
      g.shadowColor = color; g.shadowBlur = 26; g.strokeStyle = color; g.lineWidth = 7; round(14, 14, 484, 612, 34); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; round(14, 14, 484, 612, 34); g.stroke();
      if (person.capitano) { // fascia da capitana
        g.fillStyle = YELLOW; g.shadowColor = YELLOW; g.shadowBlur = 18; g.beginPath(); g.arc(62, 62, 30, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0; g.fillStyle = '#070b1f'; g.font = '36px Anton, Impact, sans-serif'; g.textAlign = 'center'; g.fillText('C', 62, 76);
      }
      tex.needsUpdate = true;
    };
    draw(null);
    // la foto parte subito; la card è "pronta" quando foto e font sono arrivati (o la foto manca)
    tex.odvReady = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => fontsLoaded().then(() => { draw(img); resolve(); });
      img.onerror = () => fontsLoaded().then(() => { draw(null); resolve(); });
      img.src = `assets/players/${slug(surname)}.webp`;
    });
    return tex;
  }
  // I font disegnati nelle texture devono essere caricati prima di disegnare (sono locali: è rapido)
  let fontsPromise = null;
  function fontsLoaded() {
    if (!fontsPromise) {
      fontsPromise = document.fonts
        ? Promise.all(['62px Anton', '700 20px Orbitron', '600 21px Manrope'].map((f) => document.fonts.load(f))).catch(() => null)
        : Promise.resolve();
    }
    return fontsPromise;
  }

  // Chi va in campo: la capitana schiaccia, una palleggiatrice alza, due centrali murano, le altre coprono
  function lineup(team) {
    const all = (team && team.giocatrici) || [];
    if (!all.length) return null;
    const by = (n) => all.find((g) => g.nome === n);
    const six = (team.rotazione || []).map(by).filter(Boolean);
    const pool = six.length ? six : all.slice(0, 6);
    const pick = (test, from = pool) => { const g = from.find((x) => test(x) && !used.has(x)) || all.find((x) => test(x) && !used.has(x)); if (g) used.add(g); return g; };
    const used = new Set();
    const hitter = pick((g) => g.capitano) || pick((g) => g.ruolo === 'Schiacciatrice');
    const setter = pick((g) => g.ruolo === 'Palleggiatrice');
    const blockers = [pick((g) => g.ruolo === 'Centrale'), pick((g) => g.ruolo === 'Centrale')];
    const libero = all.find((g) => g.nome === team.liberoInCampo) || all.find((g) => g.ruolo === 'Libero');
    const others = pool.filter((g) => !used.has(g)).slice(0, 2);
    if (libero) others.push(libero);
    return { hitter, setter, blockers, others };
  }

  // ---------- COSTRUZIONE DELLA SCENA ----------
  function build(scene, mobile, team) {
    const add = (o) => { scene.add(o); return o; };
    const basic = (opts) => new THREE.MeshBasicMaterial(opts);

    // pavimento, campo, palazzetto
    const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(34, 48), basic({ map: floorTexture() })));
    floor.rotation.x = -Math.PI / 2;
    const court = add(new THREE.Mesh(new THREE.PlaneGeometry(9, 18), basic({ map: courtTexture() })));
    court.rotation.x = -Math.PI / 2; court.position.y = 0.005;
    const hall = add(new THREE.Mesh(new THREE.BoxGeometry(34, 16, 48), basic({ color: 0x060920, side: THREE.BackSide })));
    hall.position.y = 7.99;

    // strisce neon lungo le pareti
    const strip = (w, h, d, x, y, z, color) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic({ color }))); m.position.set(x, y, z); return m; };
    [-16.9, 16.9].forEach((x, i) => { strip(0.08, 0.08, 46, x, 2.2, 0, i ? 0xff2e9a : 0x6ec1ff); strip(0.08, 0.08, 46, x, 8.5, 0, 0x7b2cff); });
    [-23.9, 23.9].forEach((z) => strip(32, 0.08, 0.08, 0, 2.2, z, 0xff2e9a));

    // insegne
    const sign = (tex, w, h, x, y, z, ry) => {
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic({ map: tex, transparent: true, depthWrite: false })));
      m.position.set(x, y, z); m.rotation.y = ry; return m;
    };
    sign(textTexture('ODV RIO-SAONARA', PINK), 16, 4, 0, 6.2, -23.8, 0);
    sign(textTexture('FORZA ODV', BLUE), 12, 3, 0, 6.2, 23.8, Math.PI);
    sign(textTexture('UNITI PER LA VITTORIA', PINK, 1024, 160), 18, 2.8, -16.8, 5.4, 0, Math.PI / 2);
    sign(textTexture('SERIE C · 2026/27', BLUE, 1024, 160), 18, 2.8, 16.8, 5.4, 0, -Math.PI / 2);

    // rete, pali, antenne
    const net = add(new THREE.Mesh(new THREE.PlaneGeometry(9.8, 1.0), basic({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false })));
    net.position.set(0, NET_TOP - 0.5, 0);
    [-5.1, 5.1].forEach((x) => { const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 10), basic({ color: 0xdfe6ff }))); post.position.set(x, 1.3, 0); });
    [-4.5, 4.5].forEach((x) => {
      const ant = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.8, 6), basic({ color: 0xff2e4d })));
      ant.position.set(x, NET_TOP + 0.4, 0);
    });

    // luci del soffitto + fasci volumetrici
    const lampGeo = new THREE.BoxGeometry(1.4, 0.12, 0.5), lampMat = basic({ color: 0xffffff });
    const beamMat = basic({ color: 0x9fd8ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beamGeo = new THREE.ConeGeometry(3.2, 14, 24, 1, true);
    for (let x = -1; x <= 1; x++) {
      for (let z = -2; z <= 2; z++) {
        const lamp = add(new THREE.Mesh(lampGeo, lampMat)); lamp.position.set(x * 6, 15.6, z * 8.5);
        if (Math.abs(x) <= 1 && Math.abs(z) <= 1 && (x + z) % 2 === 0) { const beam = add(new THREE.Mesh(beamGeo, beamMat)); beam.position.set(x * 6, 8.6, z * 8.5); }
      }
    }

    // pubblico: puntini luminosi sulle tribune (flash dei telefoni compresi)
    const n = mobile ? 1600 : 3200;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const palette = [[0.10, 0.14, 0.35], [0.14, 0.18, 0.42], [1, 0.18, 0.6], [0.43, 0.76, 1], [1, 1, 1]];
    for (let i = 0; i < n; i++) {
      const side = i % 3; // 0 sinistra, 1 destra, 2 fondo
      const row = Math.random();
      let x, y, z;
      if (side < 2) { x = (side ? 1 : -1) * (8 + row * 7.5); y = 0.8 + row * 6.5; z = (Math.random() - 0.5) * 30; }
      else { x = (Math.random() - 0.5) * 22; y = 0.8 + row * 5; z = (Math.random() < 0.5 ? -1 : 1) * (14 + row * 8); }
      pos.set([x, y, z], i * 3);
      const r = Math.random(), c = palette[r < 0.72 ? 0 : r < 0.86 ? 1 : r < 0.92 ? 2 : r < 0.97 ? 3 : 4];
      col.set(c, i * 3);
    }
    const crowdGeo = new THREE.BufferGeometry();
    crowdGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    crowdGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const crowdMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    add(new THREE.Points(crowdGeo, crowdMat));

    // giocatrici (sprite sempre rivolti alla camera)
    const tex = {};
    const figTex = (pose, color) => (tex[pose + color] = tex[pose + color] || figureTexture(pose, color));
    const player = (pose, color, x, z, scale = 1) => {
      const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: figTex(pose, color), transparent: true, depthWrite: false })));
      s.scale.set(0.95 * scale, 1.9 * scale, 1); s.position.set(x, 0.95 * scale, z); s.userData.baseY = 0.95 * scale; return s;
    };
    // ODV: le card delle giocatrici vere (se i dati non ci sono, sagome neon magenta)
    const L = lineup(team);
    const pending = []; // card ancora in caricamento
    const card = (person, x, z, scale = 1) => {
      const map = cardTexture(person);
      pending.push(map.odvReady); // Promise della card (Three r128: le texture non hanno userData)
      const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false })));
      s.scale.set(1.44 * scale, 1.8 * scale, 1); s.position.set(x, 0.9 * scale, z); s.userData.baseY = 0.9 * scale; return s;
    };
    const odv = (person, pose, x, z, scale) => (person ? card(person, x, z, scale) : player(pose, PINK, x, z, scale));
    const others = L ? L.others : [];
    [[-2.6, 6.4], [0.2, 7.2], [2.8, 5.2]].forEach(([x, z], i) => odv(others[i], 'ready', x, z));
    const odvSetter = odv(L && L.setter, 'set', 0.4, 0.75);
    const odvHitter = odv(L && L.hitter, 'spike', 3.75, 2.0, 1.08);
    const blockerA = odv(L && L.blockers[0], 'block', 1.15, 0.5, 0.9), blockerB = odv(L && L.blockers[1], 'block', 2.05, 0.5, 0.9);
    // Avversarie (azzurro)
    player('ready', BLUE, 2.6, -6.6); player('ready', BLUE, -3.0, -3.2); player('ready', BLUE, 0.2, -8.2);
    player('bump', BLUE, -1.25, -8.05);
    player('set', BLUE, 1.25, -0.9);
    const oppHitter = player('spike', BLUE, 1.45, -1.85, 1.05);
    const oppBlocker = player('block', BLUE, 2.7, -0.45);

    // mani del muro ODV: riempiono lo schermo al momento dell'impatto
    const handTex = handTexture(PINK);
    const hands = [1.0, 1.36, 1.86, 2.22].map((x, i) => {
      const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: handTex, transparent: true, depthWrite: false })));
      s.scale.set(0.34, 0.42, 1); s.position.set(x, 2.2, 0.12); s.userData = { x, lift: i % 2 ? 0.04 : 0 }; return s;
    });
    // mano della battitrice che regge il pallone all'inizio
    const serveHand = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: handTex, transparent: true, depthWrite: false })));
    serveHand.scale.set(0.5, 0.62, 1); serveHand.position.set(2.2, 1.18, 10.85);

    // impatto a terra: anelli d'onda + bagliore
    const impactAt = new THREE.Vector3(-1.9, 0.02, -6.2);
    const rings = [0, 1].map((k) => {
      const r = add(new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 48), basic({ color: k ? 0x6ec1ff : 0xff2e9a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })));
      r.rotation.x = -Math.PI / 2; r.position.copy(impactAt); return r;
    });
    const glow = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgb(255,46,154)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })));
    glow.position.set(impactAt.x, 0.3, impactAt.z); glow.scale.set(3, 3, 1);

    return { crowdMat, odvSetter, odvHitter, blockerA, blockerB, oppHitter, oppBlocker, hands, serveHand, rings, glow, pending, hitterName: L && L.hitter ? L.hitter.nome : '' };
  }

  // ---------- ANIMAZIONE ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const bump = (p, a, b) => (p < a || p > b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI)); // 0→1→0 tra a e b

  // Restituisce una Promise che si risolve quando la scena è COMPLETA: texture disegnate, foto delle card
  // caricate, shader compilati e primo fotogramma reso. onProgress(0–1) segue il caricamento delle card.
  async function init(team, onProgress = () => {}) {
    const section = document.getElementById('pov');
    const cvs = document.getElementById('povCanvas');
    if (!section || !cvs) return false;
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer;
    try {
      if (typeof THREE === 'undefined') throw new Error('three mancante');
      renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    } catch (e) { section.classList.add('is-off'); return false; }
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.setClearColor(0x04061a);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070b1f, 0.032);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.03, 120);
    await fontsLoaded();
    const S = build(scene, mobile, team);
    let loaded = 0;
    onProgress(0);
    await Promise.all(S.pending.map((p) => p.then(() => onProgress(++loaded / S.pending.length))));
    onProgress(1);
    const capt = ((team && team.giocatrici) || []).find((g) => g.nome === S.hitterName);
    if (capt) ACTS[4].sub = `${capt.nome}${capt.capitano ? ' · capitana' : ''}`;

    const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
    const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal');
    const u = (p) => { // p (scroll) → parametro della curva, segmento per segmento
      p = clamp(p);
      let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
      const t = (p - KEYS[i].p) / (KEYS[i + 1].p - KEYS[i].p);
      return (i + clamp(t)) / (KEYS.length - 1);
    };
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), look = new THREE.Vector3();

    const $ = (id) => document.getElementById(id);
    const ui = { intro: $('povIntro'), act: $('povAct'), call: $('povCall'), kmh: $('povKmh'), bar: $('povBar'), h: $('povScoreH'), score: section.querySelector('.pov__score'), speed: section.querySelector('.pov__speed'), flash: section.querySelector('.pov__flash') };
    let lastAct = '', lastCall = '', shownKmh = 0;

    let W = 1, H = 1, baseFov = 58;
    function resize() {
      W = cvs.clientWidth || window.innerWidth; H = cvs.clientHeight || window.innerHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      baseFov = camera.aspect < 0.8 ? 74 : camera.aspect < 1.2 ? 64 : 56; // in verticale serve più campo visivo
      camera.updateProjectionMatrix();
    }

    function speedAt(p) { // m per unità di scroll → usato per km/h, FOV e linee di velocità
      posCurve.getPoint(u(p), tmpA); posCurve.getPoint(u(Math.min(1, p + 0.004)), tmpB);
      return tmpA.distanceTo(tmpB) / 0.004;
    }

    function render(p, time) {
      // posizione e sguardo del pallone
      posCurve.getPoint(u(p), camera.position);
      lookCurve.getPoint(u(p), look);
      // scossa sui colpi
      let shake = 0, flash = 0;
      HITS.forEach((h) => { if (p >= h.p) { const d = (p - h.p) / 0.012; shake += h.power * Math.exp(-d); flash += h.flash * Math.exp(-d * 1.6); } });
      if (shake > 0.01) {
        const k = shake * 0.06;
        camera.position.x += Math.sin(time * 0.09) * k; camera.position.y += Math.cos(time * 0.13) * k;
      }
      camera.lookAt(look);
      // rollio: il pallone gira su sé stesso dopo il muro e nella schiacciata
      camera.rotateZ(bump(p, 0.47, 0.56) * 0.9 - bump(p, 0.78, 0.86) * 0.35);

      const v = speedAt(p);
      camera.fov = baseFov + clamp((v - 45) / 80) * 22 + shake * 4;
      camera.updateProjectionMatrix();

      // giocatrici: salti sincronizzati con l'azione
      const jump = (s, a, b, h) => { s.position.y = s.userData.baseY + bump(p, a, b) * h; };
      jump(S.oppHitter, 0.40, 0.475, 1.15);
      jump(S.blockerA, 0.43, 0.51, 0.75); jump(S.blockerB, 0.43, 0.51, 0.75);
      jump(S.odvSetter, 0.58, 0.64, 0.35);
      jump(S.odvHitter, 0.68, 0.82, 1.25);
      jump(S.oppBlocker, 0.76, 0.83, 0.7);
      const handLift = bump(p, 0.43, 0.51);
      S.hands.forEach((hand) => {
        hand.position.y = 2.05 + handLift * 0.85 + hand.userData.lift;
        hand.material.opacity = clamp(handLift * 3); // le mani compaiono solo quando il muro sale
      });
      S.serveHand.material.opacity = 1 - clamp((p - 0.03) / 0.05);
      S.serveHand.position.y = 1.18 - clamp((p - 0.02) / 0.06) * 0.4;

      // impatto finale: onde e bagliore, il pubblico si accende
      const sinceImpact = p - 0.855;
      S.rings.forEach((r, k) => {
        const t = clamp((sinceImpact - k * 0.006) / 0.05);
        r.material.opacity = sinceImpact > 0 ? (1 - t) * 0.9 : 0;
        const sc = 1 + t * 14; r.scale.set(sc, sc, sc);
      });
      S.glow.material.opacity = sinceImpact > 0 ? Math.exp(-sinceImpact / 0.03) : 0;
      S.crowdMat.size = 0.16 + (sinceImpact > 0 ? 0.12 * Math.exp(-sinceImpact / 0.08) : 0) + Math.sin(time * 0.004) * 0.01;

      renderer.render(scene, camera);

      // ---------- interfaccia sovrapposta ----------
      ui.intro.style.opacity = String(1 - clamp(p / 0.045));
      ui.bar.style.transform = `scaleX(${p.toFixed(4)})`;
      ui.speed.style.opacity = String(clamp((v - 60) / 60) * 0.9);
      ui.flash.style.opacity = String(clamp(flash));
      const kmh = Math.round(clamp(v * 0.75, 0, 110));
      shownKmh += (kmh - shownKmh) * 0.25;
      ui.kmh.textContent = String(Math.round(shownKmh));
      const act = ACTS.find((a) => p >= a.from && p <= a.to);
      const actKey = act ? act.text : '';
      if (actKey !== lastAct) {
        lastAct = actKey;
        ui.act.classList.toggle('is-on', !!act);
        if (act) ui.act.innerHTML = `${act.text}<small>${act.sub}</small>`;
      }
      const call = CALLS.find((c) => p >= c.from && p <= c.to);
      const callKey = call ? call.text : '';
      if (callKey !== lastCall) { lastCall = callKey; ui.call.classList.toggle('is-on', !!call); if (call) ui.call.textContent = call.text; }
      const won = p >= 0.857;
      ui.h.textContent = won ? '25' : '24';
      ui.score.classList.toggle('is-set', won);
    }

    // avanzamento dallo scroll della sezione (sticky), smorzato per fluidità anche su touch
    let target = 0, current = 0, running = false, raf = 0, last = 0;
    const readScroll = () => {
      const r = section.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      target = span > 0 ? clamp(-r.top / span) : 0;
    };
    const loop = (time) => {
      readScroll();
      const dt = Math.min(1000, time - (last || time)); last = time;
      current += (target - current) * (1 - Math.pow(0.86, dt / 16.7)); // stessa fluidità a 30, 60 o 120 fps
      if (Math.abs(target - current) < 0.0004) current = target;
      render(current, time);
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    // ridimensionare il canvas lo svuota: si ridisegna subito, senza aspettare il prossimo fotogramma
    window.addEventListener('resize', () => { resize(); render(current, performance.now()); }, { passive: true });
    renderer.compile(scene, camera); // shader pronti subito: nessuno scatto al primo scroll

    if (REDUCED) { // un fotogramma fisso: il pallone sospeso prima della schiacciata
      render(0.74, 0);
      ui.intro.style.opacity = '1';
      return true;
    }
    readScroll(); current = target; render(current, 0);
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '100px' }).observe(section);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stop(); return; }
      const r = section.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) start();
    });
    return true;
  }

  window.ODVPov = { init };
})();
