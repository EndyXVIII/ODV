/* =========================================================
   ODV RIO-SAONARA · "NEON ARENA" · main.js
   Indice:
   00 Setup & utilità        08 Le Eroine (roster, filtri, tilt)
   01 Dati (JSON)            09 Character select (modal)
   02 Smooth scroll (Lenis)  10 Rotazione P1–P6
   03 Loader                 11 Staff
   04 Hero: città + pioggia  12 Partite (locandine)
   05 Hero: pallone 3D       13 Risultati & classifica
   06 Hero: countdown        14 Palasport · Instagram · Partner
   07 Marquee                15 Contatti
                             16 Nav, micro-interazioni, easter egg
                             17 Avvio
   ========================================================= */
(() => {
  'use strict';

  /* ---------- 00 SETUP & UTILITÀ ---------- */
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const HAS_GSAP = typeof window.gsap !== 'undefined';
  const HAS_ST = HAS_GSAP && typeof window.ScrollTrigger !== 'undefined';
  const HAS_FLIP = HAS_GSAP && typeof window.Flip !== 'undefined';
  if (HAS_ST) gsap.registerPlugin(ScrollTrigger);
  if (HAS_FLIP) gsap.registerPlugin(Flip);

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const splitName = (nome) => { const p = nome.trim().split(/\s+/); const surname = p.pop(); return { first: p.join(' '), surname }; };
  const pad2 = (n) => String(n).padStart(2, '0');

  // Colori e icone per ruolo (le icone sono <symbol> nello sprite SVG di index.html)
  const ROLES = {
    Palleggiatrice: { color: 'var(--r-palleggiatrice)', icon: 'i-palleggio', short: 'Palleggio' },
    Opposto: { color: 'var(--r-opposto)', icon: 'i-opposto', short: 'Opposto' },
    Schiacciatrice: { color: 'var(--r-schiacciatrice)', icon: 'i-schiacciata', short: 'Banda' },
    Centrale: { color: 'var(--r-centrale)', icon: 'i-centrale', short: 'Centrale' },
    Libero: { color: 'var(--r-libero)', icon: 'i-libero', short: 'Libero' }
  };
  const STAFF_ROLE = { color: 'var(--azzurro-maglia)', icon: 'i-staff' };

  const fmtDay = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

  // Velocità di scroll condivisa (marquee, pallone 3D)
  const scroll = { velocity: 0, lastY: window.scrollY };

  // Esegue fn quando l'elemento entra nel viewport (una volta)
  function onVisible(el, fn, opts = { threshold: 0.25 }) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
    }, opts);
    io.observe(el);
  }

  /* ---------- 01 DATI ---------- */
  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  }
  const dataPromise = Promise.all([
    loadJSON('data/team.json'),
    loadJSON('data/matches.json'),
    loadJSON('data/standings.json')
  ]).then(([team, matches, standings]) => ({ team, matches, standings }));

  /* ---------- 02 SMOOTH SCROLL (LENIS) ---------- */
  let lenis = null;
  function initSmoothScroll() {
    if (!REDUCED && typeof window.Lenis !== 'undefined' && HAS_GSAP) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      if (HAS_ST) lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    // Velocità di scroll (px/frame), smorzata
    const tick = () => {
      const y = window.scrollY;
      const v = lenis ? lenis.velocity : y - scroll.lastY;
      scroll.velocity += (v - scroll.velocity) * 0.2;
      scroll.lastY = y;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function scrollToTarget(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: el.id === 'home' ? 0 : -60, duration: 1.4 });
    else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    if (lenis) lock ? lenis.stop() : lenis.start();
  }

  /* ---------- 03 LOADER ---------- */
  // Il loader resta finché il sito non è COMPLETO (scena 3D con le foto delle card, dati e contenuti).
  // Il pallone rimbalza sulla linea neon, il tabellone segue l'avanzamento reale fino a 25,
  // poi schiacciata in camera e reveal circolare. Restituisce { progress(0–1), finish(), done }.
  function runLoader() {
    const loader = $('#loader');
    const score = $('#loaderScore');
    const hint = $('.loader__hint');
    let resolveDone;
    const done = new Promise((r) => { resolveDone = r; });
    let closed = false;
    const close = () => { if (closed) return; closed = true; loader.classList.add('is-done'); lockScroll(false); resolveDone(); };
    let shown = 0;
    const show = (f) => {
      const v = Math.min(24, Math.round(f * 24));
      score.textContent = pad2(v);
      hint.textContent = f < 1 ? `Preparo il palazzetto… ${Math.round(f * 100)}%` : 'Si gioca!';
    };
    lockScroll(true);

    if (!HAS_GSAP || REDUCED) { // nessuna animazione: solo l'avanzamento, poi via
      return {
        progress: (f) => { shown = Math.max(shown, f); show(shown); },
        finish: () => { score.textContent = '25'; close(); },
        done
      };
    }

    const ball = $('#loaderBall');
    const t0 = performance.now();
    const bounce = gsap.to(ball, { y: -140, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: -1 });
    const spin = gsap.to(ball, { rotation: '+=360', duration: 0.9, ease: 'none', repeat: -1 });
    const counter = { v: 0 };
    const progress = (f) => {
      if (f <= shown) return;
      shown = f;
      gsap.to(counter, { v: f, duration: 0.35, ease: 'power1.out', overwrite: true, onUpdate: () => show(counter.v) });
    };
    let finishing = false;
    const finish = () => {
      if (finishing) return;
      finishing = true;
      const wait = Math.max(0, 700 - (performance.now() - t0)); // almeno un rimbalzo, anche con tutto in cache
      // rete di sicurezza: se le animazioni sono rallentate (scheda in background) si entra comunque
      setTimeout(() => { if (!closed) { gsap.killTweensOf([ball, loader, counter]); close(); } }, wait + 3500);
      gsap.delayedCall(wait / 1000, () => {
        bounce.kill(); spin.kill();
        gsap.timeline({ onComplete: close })
          .to(counter, { v: 1, duration: 0.25, onUpdate: () => show(counter.v) })
          .call(() => { score.textContent = '25'; })
          .to(ball, { y: 0, duration: 0.12, ease: 'power2.in' })
          .to(ball, { y: -190, scale: 1.2, rotation: '+=180', duration: 0.2, ease: 'power2.out' })
          .to(ball, { y: 40, scale: 34, rotation: '+=360', duration: 0.45, ease: 'power3.in' })
          .to(ball, { autoAlpha: 0, duration: 0.15 }, '-=0.15')
          .to(loader, { '--r': () => `${Math.hypot(innerWidth, innerHeight)}px`, duration: 0.7, ease: 'power3.inOut' }, '-=0.3');
      });
    };
    return { progress, finish, done };
  }

  /* ---------- 04 HERO: CITTÀ + PIOGGIA ---------- */
  function buildCity() {
    const svg = $('#heroCity');
    if (!svg) return;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const lights = ['#FF2E9A', '#6EC1FF', '#FFD23F', '#7B2CFF', '#ffffff'];
    let out = '';
    let x = -20;
    let windows = 0;
    while (x < 1620) {
      const w = 50 + rnd() * 90;
      const h = 90 + rnd() * 250;
      const y = 360 - h;
      out += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${rnd() > 0.5 ? '#0a0f2e' : '#0d1338'}"/>`;
      if (rnd() > 0.7) out += `<rect x="${(x + w / 2 - 1).toFixed(0)}" y="${(y - 30).toFixed(0)}" width="2" height="30" fill="#0d1338"/><circle cx="${(x + w / 2).toFixed(0)}" cy="${(y - 30).toFixed(0)}" r="2.5" fill="#FF2E9A"/>`;
      // finestre illuminate
      for (let wy = y + 12; wy < 350 && windows < 520; wy += 16) {
        for (let wx = x + 8; wx < x + w - 10; wx += 13) {
          if (rnd() > 0.72) {
            windows++;
            out += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="6" height="8" fill="${lights[Math.floor(rnd() * lights.length)]}" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`;
          }
        }
      }
      x += w + rnd() * 8;
    }
    // insegna neon su un palazzo
    out += '<g><rect x="1120" y="120" width="120" height="44" rx="6" fill="none" stroke="#FF2E9A" stroke-width="3" style="filter:drop-shadow(0 0 6px #FF2E9A)"/><text x="1180" y="152" text-anchor="middle" font-family="Orbitron, monospace" font-weight="900" font-size="24" fill="#fff" style="filter:drop-shadow(0 0 6px #FF2E9A)">ODV</text></g>';
    svg.innerHTML = out;
  }

  function initRain() {
    const cvs = $('#rain');
    const hero = $('#home');
    if (!cvs || !cvs.getContext) return;
    const ctx = cvs.getContext('2d');
    let w = 0, h = 0, drops = [], bokeh = [], running = false, raf = 0;

    // sprite sfocati pre-renderizzati per il bokeh (economici da disegnare)
    const sprites = ['255,46,154', '110,193,255', '123,44,255', '255,210,63'].map((rgb) => {
      const s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, `rgba(${rgb},.55)`);
      grd.addColorStop(0.6, `rgba(${rgb},.18)`);
      grd.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      return s;
    });
    const newDrop = (anyY) => ({ x: Math.random() * (w + 200), y: anyY ? Math.random() * h : -30, len: 10 + Math.random() * 16, v: 9 + Math.random() * 8, a: 0.12 + Math.random() * 0.3 });
    const newBokeh = () => ({ x: Math.random() * w, y: Math.random() * h * 0.85, r: 14 + Math.random() * 50, vx: (Math.random() - 0.5) * 0.25, vy: -0.05 - Math.random() * 0.15, s: sprites[Math.floor(Math.random() * sprites.length)], p: Math.random() * Math.PI * 2 });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = cvs.clientWidth; h = cvs.clientHeight;
      cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drops = Array.from({ length: Math.round(Math.min(220, (w * h) / 7000)) }, () => newDrop(true));
      bokeh = Array.from({ length: Math.round(Math.min(26, w / 55)) }, newBokeh);
      if (!running) draw(0);
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of bokeh) {
        b.x += b.vx; b.y += b.vy;
        if (b.y < -60) { b.y = h * 0.85; b.x = Math.random() * w; }
        ctx.globalAlpha = 0.55 + Math.sin(t / 900 + b.p) * 0.35;
        ctx.drawImage(b.s, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1;
      for (const d of drops) {
        d.y += d.v; d.x -= d.v * 0.18;
        if (d.y > h) Object.assign(d, newDrop(false));
        ctx.strokeStyle = `rgba(180,210,255,${d.a})`;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.len * 0.18, d.y - d.len);
        ctx.stroke();
      }
    }
    function loop(t) { draw(t); raf = requestAnimationFrame(loop); }
    function start() { if (running || REDUCED) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  function initHeroParallax() {
    if (!HAS_ST || REDUCED) return;
    $$('.hero [data-depth]').forEach((el) => {
      const d = parseFloat(el.dataset.depth);
      gsap.to(el, { yPercent: d * 60, ease: 'none', scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: true } });
    });
    if (FINE_POINTER) {
      const signs = $$('.hero [data-depth]').map((el) => ({ d: parseFloat(el.dataset.depth), to: gsap.quickTo(el, 'x', { duration: 1, ease: 'power3.out' }) }));
      $('#home').addEventListener('pointermove', (e) => {
        const nx = e.clientX / innerWidth - 0.5;
        signs.forEach((s) => s.to(-nx * 80 * s.d));
      });
    }
  }

  /* ---------- 05 HERO: PALLONE 3D ---------- */
  // Texture procedurale stile Mikasa: 6 facce di cubo, ognuna divisa in 3 strisce giallo/blu
  function makeBallTexture() {
    const W = 1024, H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const Y = [255, 210, 63], B = [27, 58, 140], S = [12, 22, 64];
    for (let j = 0; j < H; j++) {
      const lat = Math.PI / 2 - ((j + 0.5) / H) * Math.PI;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < W; i++) {
        const lon = ((i + 0.5) / W) * Math.PI * 2 - Math.PI;
        const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
        const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
        let axis, m, s, t;
        if (ax >= ay && ax >= az) { axis = 0; m = x; s = y / ax; t = z / ax; }
        else if (ay >= az) { axis = 1; m = y; s = z / ay; t = x / ay; }
        else { axis = 2; m = z; s = x / az; t = y / az; }
        const k = s < -1 / 3 ? 0 : s < 1 / 3 ? 1 : 2;
        const seam = Math.min(Math.abs(s + 1 / 3), Math.abs(s - 1 / 3)) < 0.02 || Math.max(Math.abs(s), Math.abs(t)) > 0.98;
        const col = seam ? S : ((axis + k + (m > 0 ? 0 : 1)) % 2 ? B : Y);
        const shade = 1 - 0.1 * t * t;
        const o = (j * W + i) * 4;
        d[o] = col[0] * shade; d[o + 1] = col[1] * shade; d[o + 2] = col[2] * shade; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function webglAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  function initBall() {
    const wrap = $('#heroBall');
    const canvas = $('#ballCanvas');
    const fallback = $('.hero__ball-fallback');
    const useFallback = () => {
      wrap.classList.add('is-fallback');
      return {
        intro() {
          if (!HAS_GSAP || REDUCED) return;
          gsap.from(fallback, { x: '-70vw', y: '-40vh', scale: 0.3, duration: 1.4, ease: 'power2.out' });
        }
      };
    };
    if (typeof window.THREE === 'undefined' || !webglAvailable()) return useFallback();

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch (e) { return useFallback(); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = THREE.sRGBEncoding;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    const tex = new THREE.CanvasTexture(makeBallTexture());
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.05 })
    );
    const group = new THREE.Group();
    group.add(ball);
    scene.add(group);

    scene.add(new THREE.AmbientLight(0x6070c0, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.5, 3.5, 4);
    scene.add(key);
    const rimPink = new THREE.PointLight(0xff2e9a, 3.2, 12);
    rimPink.position.set(-3, -1.4, 1.5);
    scene.add(rimPink);
    const rimBlue = new THREE.PointLight(0x6ec1ff, 2.6, 12);
    rimBlue.position.set(3, -2, -1);
    scene.add(rimBlue);

    // Stato animabile da GSAP
    const pose = { x: 0, y: 0, z: 0, sx: 1, sy: 1, float: 0 };
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    let running = false, raf = 0, last = performance.now(), time = 0;

    function resize() {
      const r = wrap.getBoundingClientRect();
      const s = Math.max(1, Math.round(r.width));
      renderer.setSize(s, s, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; time += dt;
      const spin = 0.5 + Math.min(Math.abs(scroll.velocity) * 0.06, 9);
      ball.rotation.y += spin * dt;
      ball.rotation.x += spin * 0.35 * dt;
      tilt.x += (tilt.tx - tilt.x) * 0.06;
      tilt.y += (tilt.ty - tilt.y) * 0.06;
      group.rotation.x = tilt.y * 0.5;
      group.rotation.z = -tilt.x * 0.35;
      group.position.set(pose.x + tilt.x * 0.25, pose.y + Math.sin(time * 1.4) * 0.09 * pose.float, pose.z);
      group.scale.set(pose.sx, pose.sy, pose.sx);
      renderer.render(scene, camera);
    }
    function loop(now) { frame(now); raf = requestAnimationFrame(loop); }
    function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(wrap);
    else window.addEventListener('resize', resize);
    if (FINE_POINTER) {
      window.addEventListener('pointermove', (e) => {
        tilt.tx = (e.clientX / innerWidth - 0.5) * 2;
        tilt.ty = (e.clientY / innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    if (REDUCED) {
      pose.float = 0;
      frame(performance.now());
      return { intro() {} };
    }
    // Pallone fuori scena finché non parte l'intro
    pose.x = -7; pose.y = 3.5; pose.z = -3;
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(wrap);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    return {
      // Servizio: arco, un rimbalzo con schiacciamento, poi galleggia
      intro() {
        if (!HAS_GSAP) { Object.assign(pose, { x: 0, y: 0, z: 0, float: 1 }); return; }
        const tl = gsap.timeline();
        tl.to(pose, { x: 0, z: 0, duration: 1.6, ease: 'power1.out' }, 0)
          .to(pose, { y: 2.2, duration: 0.6, ease: 'power2.out' }, 0)
          .to(pose, { y: -1.15, duration: 0.55, ease: 'power2.in' }, 0.6)
          .to(pose, { sy: 0.82, sx: 1.12, duration: 0.08, ease: 'power1.out' }, 1.15)
          .to(pose, { sy: 1, sx: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' }, 1.23)
          .to(pose, { y: 0, duration: 0.6, ease: 'power2.out' }, 1.15)
          .to(pose, { float: 1, duration: 1 }, 1.6);
      }
    };
  }

  /* ---------- 06 HERO: COUNTDOWN FLIP CLOCK ---------- */
  function makeFlip(el) {
    el.innerHTML = '<div class="flip__half flip__half--top"><span>00</span></div><div class="flip__half flip__half--bottom"><span>00</span></div><div class="flip__flap flip__flap--top"><span>00</span></div><div class="flip__flap flip__flap--bottom"><span>00</span></div>';
    const [top, bottom, flapTop, flapBottom] = $$(':scope > div', el);
    const [tS, bS, ftS, fbS] = [top, bottom, flapTop, flapBottom].map((n) => n.firstElementChild);
    let cur = null;
    return (value) => {
      const v = pad2(value);
      if (v === cur) return;
      if (cur === null || REDUCED || !HAS_GSAP) {
        tS.textContent = bS.textContent = ftS.textContent = fbS.textContent = v;
        cur = v;
        return;
      }
      tS.textContent = v; fbS.textContent = v;
      ftS.textContent = cur; bS.textContent = cur;
      gsap.fromTo(flapTop, { rotateX: 0 }, { rotateX: -90, duration: 0.28, ease: 'power2.in' });
      gsap.fromTo(flapBottom, { rotateX: 90 }, { rotateX: 0, duration: 0.28, delay: 0.28, ease: 'power2.out', onComplete: () => { bS.textContent = v; } });
      cur = v;
    };
  }
  const compClass = (m) => (m.competizione === 'Coppa Veneto' ? 'comp--coppa' : 'comp--serie-c');
  function initCountdown(matches) {
    const now = Date.now();
    const next = matches.find((m) => m.ts > now);
    // Ultima partita giocata con il suo punteggio (ODV sempre per prima)
    const last = matches.filter((m) => m.ts <= now && m.risultato).pop();
    if (last) {
      const [a, b] = String(last.risultato).split(/[-–]/).map(Number);
      const el = $('#nextLast');
      el.hidden = false;
      el.innerHTML = `<span>Ultima</span> <b class="${a > b ? 'is-win' : 'is-loss'}">ODV ${a}–${b}</b> ${esc(last.avversario)} <span class="comp-tag ${compClass(last)}">${last.competizione === 'Serie C' ? 'Campionato' : 'Coppa'}</span>`;
    }
    const units = Object.fromEntries($$('#flipclock .flip').map((el) => [el.dataset.unit, makeFlip(el)]));
    if (!next) {
      $('#nextComp').textContent = 'Stagione 2026/27';
      $('#nextOpp').textContent = 'presto in calendario';
      $('#nextMeta').textContent = 'Il prossimo film è in fase di montaggio. Restate sintonizzati!';
      ['d', 'h', 'm', 's'].forEach((u) => units[u](0));
      return;
    }
    $('#nextComp').innerHTML = `<span class="comp-tag ${compClass(next)}">${esc(next.competizione === 'Serie C' ? 'Campionato' : next.competizione)}</span> ${esc(next.turno)}`;
    $('#nextOpp').textContent = next.avversario;
    $('#nextMeta').textContent = `${fmtDay.format(next.date)} · ore ${fmtTime.format(next.date)} · ${next.luogo} · ${next.casa ? 'in casa' : 'in trasferta'}${next.segnaposto ? ' (da confermare)' : ''}`;
    const clock = $('#flipclock');
    clock.setAttribute('aria-label', `Mancano al calcio d'inizio: aggiornamento ogni secondo`);
    const tick = () => {
      let diff = Math.max(0, Math.floor((next.ts - Date.now()) / 1000));
      const d = Math.floor(diff / 86400); diff -= d * 86400;
      const h = Math.floor(diff / 3600); diff -= h * 3600;
      const m = Math.floor(diff / 60); const s = diff - m * 60;
      units.d(d); units.h(h); units.m(m); units.s(s);
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- 07 MARQUEE ---------- */
  function initMarquee() {
    const words = 'ATTACCO · MURO · DIFESA · RICEZIONE · PALLEGGIO · FORZA ODV · UNITI PER LA VITTORIA · ';
    const words2 = 'OGNI PUNTO È UN FILM · ODV RIO-SAONARA · SERIE C 2026/27 · NEON ARENA · ';
    $$('.marquee__track').forEach((track, i) => {
      const txt = i === 0 ? words : words2;
      const chunk = `<span>${txt.repeat(3)}</span>`;
      track.innerHTML = chunk + chunk; // due copie identiche: loop a -50%
    });
    if (REDUCED || !HAS_GSAP) return;
    const tracks = $$('.marquee__track').map((el) => ({ el, dir: Number(el.dataset.dir), x: 0, half: 1, set: gsap.quickSetter(el, 'x', 'px') }));
    const measure = () => tracks.forEach((t) => { t.half = t.el.scrollWidth / 2 || 1; }); // misura una volta, non a ogni fotogramma
    measure();
    window.addEventListener('resize', measure, { passive: true });
    if (document.fonts) document.fonts.ready.then(measure);
    let visible = true; // fuori schermo il ticker non lavora
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe($('.marquee'));
    gsap.ticker.add((_t, dt) => {
      if (!visible) return;
      const boost = Math.min(Math.abs(scroll.velocity) * 0.6, 40);
      const sign = scroll.velocity < -0.5 ? -1 : 1;
      tracks.forEach((t) => {
        const half = t.half;
        t.x -= t.dir * sign * (1.1 + boost) * (dt / 16.67);
        if (t.x <= -half) t.x += half;
        if (t.x > 0) t.x -= half;
        t.set(t.x);
      });
    });
  }

  /* ---------- 08 LE EROINE ---------- */
  function cardHTML(p, { kind = 'player', tag = 'div', index = 0 } = {}) {
    const role = kind === 'staff' ? STAFF_ROLE : (ROLES[p.ruolo] || STAFF_ROLE);
    const { first, surname } = splitName(p.nome);
    const src = `assets/${kind === 'staff' ? 'staff' : 'players'}/${slug(surname)}.webp`;
    const alt = kind === 'staff' ? `${p.nome}, ${p.ruolo} di ODV Rio-Saonara` : `${p.nome}, ${p.ruolo.toLowerCase()} di ODV Rio-Saonara`;
    const attrs = tag === 'button'
      ? `type="button" aria-haspopup="dialog" aria-label="Apri la scheda di ${esc(p.nome)}, ${esc(p.ruolo)}${p.capitano ? ', capitana' : ''}" data-index="${index}"`
      : '';
    return `
      <${tag} class="hero-card__inner" ${attrs}>
        <span class="hero-card__bg" aria-hidden="true"></span>
        <svg class="hero-card__icon" aria-hidden="true"><use href="#${role.icon}"/></svg>
        <span class="hero-card__mono" aria-hidden="true">ODV</span>
        <svg class="hero-card__sil" viewBox="0 0 200 250" aria-hidden="true"><use href="#i-silhouette"/></svg>
        <img class="hero-card__img" src="${src}" alt="${esc(alt)}" width="800" height="1000" loading="lazy" decoding="async" onload="this.parentNode.classList.add('has-img')" onerror="this.remove()">
        <span class="hero-card__fade" aria-hidden="true"></span>
        <span class="hero-card__shine" aria-hidden="true"></span>
        <span class="hero-card__info">
          <span class="hero-card__role">${esc(p.ruolo)}${p.capitano ? ' · Capitana' : ''}</span>
          <span class="hero-card__name"><small>${esc(first)}</small>${esc(surname)}</span>
        </span>
        ${p.capitano ? '<span class="captain-badge" title="Capitana" aria-label="Capitana">C</span>' : ''}
        <span class="hero-card__panel"><b>${p.capitano ? 'La capitana' : 'Superpotere'}</b>${esc(p.superpotere || 'Forza ODV!')}${p.grido ? `<strong class="hero-card__grido">«${esc(p.grido)}»</strong>` : ''}</span>
        <span class="hero-card__glow" aria-hidden="true"></span>
      </${tag}>`;
  }

  function attachTilt(inner) {
    if (!FINE_POINTER || REDUCED || !HAS_GSAP) return;
    const rx = gsap.quickTo(inner, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(inner, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    gsap.set(inner, { transformPerspective: 900 });
    inner.addEventListener('pointermove', (e) => {
      const r = inner.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      ry(px * 18);
      rx(-py * 18);
    });
    inner.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }

  function initRoster(team) {
    const roster = $('#roster');
    const players = team.giocatrici;
    roster.innerHTML = players.map((p, i) => `
      <article class="hero-card" data-role="${esc(p.ruolo)}" style="--rc:${(ROLES[p.ruolo] || STAFF_ROLE).color}">
        ${cardHTML(p, { tag: 'button', index: i })}
      </article>`).join('');
    const cards = $$('.hero-card', roster);
    cards.forEach((c) => attachTilt($('.hero-card__inner', c)));
    roster.addEventListener('click', (e) => {
      const btn = e.target.closest('.hero-card__inner[data-index]');
      if (btn) openSelect(Number(btn.dataset.index), btn, 'player');
    });

    // Entrata: le card "cadono" con overshoot da schiacciata
    if (HAS_ST && !REDUCED) {
      // entrata breve e morbida: le card salgono di poco senza passare sopra filtri e titoli
      gsap.set(cards, { autoAlpha: 0, y: 48, scale: 0.94 });
      ScrollTrigger.batch(cards, {
        start: 'top 95%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, scale: 1, duration: 0.65, ease: 'back.out(1.7)', stagger: 0.06, overwrite: true })
      });
    }

    // Filtri con GSAP Flip
    const chips = $$('.chip');
    chips.forEach((chip) => chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      chips.forEach((c) => { const on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      if (HAS_GSAP) { gsap.killTweensOf(cards); gsap.set(cards, { autoAlpha: 1, y: 0, scale: 1 }); }
      const state = HAS_FLIP && !REDUCED ? Flip.getState(cards) : null;
      cards.forEach((c) => { c.hidden = !(f === 'all' || c.dataset.role === f); });
      if (state) {
        Flip.from(state, {
          duration: 0.65, ease: 'power3.inOut', absolute: true, scale: true, stagger: 0.02,
          onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.5, y: -60 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(2)' }),
          onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.5, duration: 0.35 }),
          onComplete: () => HAS_ST && ScrollTrigger.refresh()
        });
      } else if (HAS_ST) ScrollTrigger.refresh();
    }));
  }

  /* ---------- 09 CHARACTER SELECT (MODAL) ---------- */
  // Due "mazzi": le giocatrici e lo staff. La scheda a schermo intero scorre dentro il mazzo aperto.
  const DECKS = {
    player: { title: 'SELEZIONA LA TUA EROINA', folder: 'players' },
    staff: { title: 'LO STAFF ODV', folder: 'staff' }
  };
  const select = { decks: {}, deck: 'player', list: [], index: 0, opener: null, typing: null };
  function initSelect(team) {
    select.decks = { player: team.giocatrici, staff: team.staff };
    $('#selThumbs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) { const i = Number(b.dataset.i); renderSelect(i, i > select.index ? 1 : -1); }
    });
    $('#selPrev').addEventListener('click', () => stepSelect(-1));
    $('#selNext').addEventListener('click', () => stepSelect(1));
    $('#selClose').addEventListener('click', closeSelect);
    $('#selectModal').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSelect();
      if (e.key === 'ArrowRight') stepSelect(1);
      if (e.key === 'ArrowLeft') stepSelect(-1);
      if (e.key === 'Tab') { // trappola del focus
        const f = $$('#selectModal button');
        const firstEl = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    });
  }
  const roleOf = (p, deck) => (deck === 'staff' ? STAFF_ROLE : ROLES[p.ruolo] || STAFF_ROLE);
  function renderThumbs() {
    const { folder } = DECKS[select.deck];
    $('#selThumbs').innerHTML = select.list.map((p, i) => {
      const { surname } = splitName(p.nome);
      return `<button class="select__thumb" type="button" role="listitem" data-i="${i}" style="--rc:${roleOf(p, select.deck).color}" aria-label="${esc(p.nome)}">
        <svg viewBox="0 0 200 250" aria-hidden="true"><use href="#i-silhouette"/></svg>
        <img src="assets/${folder}/${slug(surname)}.webp" alt="" loading="lazy" onload="this.parentNode.classList.add('has-img')" onerror="this.remove()" style="position:absolute;inset:0;object-position:50% 15%">
      </button>`;
    }).join('');
  }
  function openSelect(i, opener, deck = 'player') {
    const modal = $('#selectModal');
    select.opener = opener;
    if (deck !== select.deck || !select.list.length) {
      select.deck = deck;
      select.list = select.decks[deck] || [];
      renderThumbs();
    }
    $('.select__top').textContent = DECKS[deck].title;
    modal.hidden = false;
    lockScroll(true);
    renderSelect(i, 0);
    $('#selClose').focus();
    if (HAS_GSAP && !REDUCED) {
      gsap.fromTo('.select__bg', { clipPath: 'polygon(0 0, 0 0, -30% 100%, -30% 100%)' }, { clipPath: 'polygon(0 0, 130% 0, 100% 100%, -30% 100%)', duration: 0.55, ease: 'power3.inOut' });
      gsap.from('.select__top, .select__thumbs, .select__arrow', { autoAlpha: 0, y: 20, duration: 0.5, delay: 0.25, stagger: 0.05 });
    }
  }
  function closeSelect() {
    const modal = $('#selectModal');
    const done = () => { modal.hidden = true; lockScroll(false); select.opener && select.opener.focus({ preventScroll: true }); };
    if (HAS_GSAP && !REDUCED) gsap.to(modal, { autoAlpha: 0, duration: 0.3, onComplete: () => { done(); gsap.set(modal, { clearProps: 'all' }); } });
    else done();
  }
  function stepSelect(dir) {
    const n = select.list.length;
    renderSelect((select.index + dir + n) % n, dir);
  }
  function renderSelect(i, dir) {
    select.index = i;
    const p = select.list[i];
    const role = roleOf(p, select.deck);
    const modal = $('#selectModal');
    modal.style.setProperty('--rc', role.color);
    const art = $('#selArt');
    art.style.setProperty('--rc', role.color);
    art.innerHTML = cardHTML(p, { kind: select.deck });
    $('#selRole').innerHTML = `<svg aria-hidden="true"><use href="#${role.icon}"/></svg>${esc(p.ruolo)}${p.capitano ? ' · Capitana' : ''}`;
    $('#selPower').textContent = p.superpotere || 'Forza ODV!';
    const dedica = $('#selDedica');
    dedica.hidden = !(p.dedica || p.grido);
    dedica.innerHTML = `${esc(p.dedica || '')}${p.grido ? `<strong class="select__grido">${esc(p.grido)}</strong>` : ''}`;
    $('.select__ready').textContent = select.deck === 'staff' ? 'IN PANCHINA, SEMPRE PRONTI ▸' : 'PRONTA AL SERVIZIO ▸';
    $$('.select__thumb').forEach((t, k) => { t.classList.toggle('is-current', k === i); t.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    const cur = $('.select__thumb.is-current');
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });

    // Nome "digitato" lettera per lettera
    const nameEl = $('#selName');
    const full = p.nome.toUpperCase();
    nameEl.setAttribute('aria-label', p.nome);
    if (select.typing) select.typing.kill();
    if (!HAS_GSAP || REDUCED) { nameEl.textContent = full; return; }
    const o = { n: 0 };
    select.typing = gsap.to(o, {
      n: full.length, duration: full.length * 0.045, ease: 'none',
      onUpdate: () => { nameEl.innerHTML = `${esc(full.slice(0, Math.round(o.n)))}<span class="caret" aria-hidden="true"></span>`; }
    });
    gsap.fromTo(art, { autoAlpha: 0, x: dir * 120, rotationY: dir * 25, scale: 0.9 }, { autoAlpha: 1, x: 0, rotationY: 0, scale: 1, duration: 0.6, ease: 'power3.out', transformPerspective: 1000 });
    gsap.fromTo(['#selRole', '#selPower', '#selDedica', '.select__ready'], { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.1, delay: 0.15, ease: 'power3.out' });
  }

  /* ---------- 10 ROTAZIONE P1–P6 ---------- */
  function initRotation(team) {
    const names = (team.rotazione || team.giocatrici.slice(0, 6).map((g) => g.nome)).slice(0, 6);
    const byName = Object.fromEntries(team.giocatrici.map((g) => [g.nome, g]));
    // La capitana è sempre in campo: se manca dal sestetto prende il posto di una giocatrice del suo stesso ruolo
    const captain = team.giocatrici.find((g) => g.capitano);
    if (captain && !names.includes(captain.nome)) {
      const k = names.findIndex((n) => (byName[n] || {}).ruolo === captain.ruolo);
      names[k >= 0 ? k : 4] = captain.nome;
    }
    const slots = Object.fromEntries($$('#court .slot').map((s) => [Number(s.dataset.pos), s]));
    // pos[1..6] → elemento token
    let pos = {};
    names.slice(0, 6).forEach((n, k) => {
      const g = byName[n] || { nome: n, ruolo: '' };
      const role = ROLES[g.ruolo] || STAFF_ROLE;
      const t = document.createElement('div');
      t.className = 'token';
      t.style.setProperty('--rc', role.color);
      t.innerHTML = `${esc(splitName(g.nome).surname)}<small>${esc(role.short || g.ruolo)}</small>${g.capitano ? '<span class="captain-badge" title="Capitana">C</span>' : ''}`;
      if (g.capitano) t.classList.add('token--captain');
      pos[k + 1] = t;
      slots[k + 1].appendChild(t);
    });
    if (team.liberoInCampo) $('#rotLibero').innerHTML = `In seconda linea entra il libero: <strong>${esc(team.liberoInCampo)}</strong>.`;
    let count = 1;
    $('#rotateBtn').addEventListener('click', () => {
      const tokens = Object.values(pos);
      const state = HAS_FLIP && !REDUCED ? Flip.getState(tokens) : null;
      // senso orario: P2→P1, P1→P6, P6→P5, P5→P4, P4→P3, P3→P2
      const next = {};
      for (let p = 1; p <= 6; p++) next[p] = pos[(p % 6) + 1];
      pos = next;
      for (let p = 1; p <= 6; p++) slots[p].appendChild(pos[p]);
      if (state) Flip.from(state, { duration: 0.85, ease: 'power3.inOut', stagger: 0.03 });
      count = (count % 6) + 1;
      $('#rotCount').textContent = `Rotazione ${count} di 6`;
    });
  }

  /* ---------- 11 STAFF ---------- */
  function initStaff(team) {
    const row = $('#staffRow');
    row.innerHTML = team.staff.map((s, i) => `<article class="hero-card" style="--rc:${STAFF_ROLE.color}">${cardHTML(s, { kind: 'staff', tag: 'button', index: i })}</article>`).join('');
    $$('.hero-card__inner', row).forEach(attachTilt);
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('.hero-card__inner[data-index]');
      if (btn) openSelect(Number(btn.dataset.index), btn, 'staff');
    });
    if (!HAS_ST || REDUCED) return;
    // Wipe orizzontale al neon
    const cards = $$('.hero-card', row);
    gsap.set(cards, { clipPath: 'inset(0 100% 0 0)' });
    ScrollTrigger.create({
      trigger: row, start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to(cards, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power4.inOut', stagger: 0.14 });
        gsap.fromTo($$('.hero-card__glow', row), { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.14, delay: 0.5, yoyo: true, repeat: 1 });
      }
    });
  }

  /* ---------- 12 PARTITE (LOCANDINE) ---------- */
  const THEMES = {
    'noir-agents': 'Operazione tre punti',
    'vintage-bw': 'In bianco e nero',
    'western': 'Per un pugno di set',
    'abbey-road': 'Attraverso la rete',
    '80s-rock': "Rock'n'spike",
    'gothic': 'La notte del muro'
  };
  const initials = (name) => {
    const words = name.replace(/\./g, '').split(/\s+/).filter((w) => w.length > 2 && !/^(asd|volley|polisportiva)$/i.test(w));
    const src = words.length ? words : [name];
    return (src.length > 1 ? src[0][0] + src[1][0] : src[0].slice(0, 2)).toUpperCase();
  };
  function initPosters(team, matches) {
    const track = $('#postersTrack');
    const now = Date.now();
    // Locandine: tutte le partite giocate + le prossime 4 di ogni competizione (il calendario completo è su FIPAV)
    const upcomingBy = {};
    matches = matches.filter((m) => {
      if (m.ts <= now) return true;
      upcomingBy[m.competizione] = (upcomingBy[m.competizione] || 0) + 1;
      return upcomingBy[m.competizione] <= 4;
    });
    const nextIdx = matches.findIndex((m) => m.ts > now);
    const coach = (team.staff.find((s) => /head coach/i.test(s.ruolo)) || {}).nome || 'lo staff ODV';
    track.innerHTML = matches.map((m, i) => {
      const played = m.ts <= now;
      const isNext = i === nextIdx;
      let stamp = '';
      if (played) {
        if (m.risultato) {
          const [a, b] = String(m.risultato).split(/[-–]/).map(Number);
          const win = a > b;
          stamp = `<div class="poster__stamp ${win ? 'poster__stamp--win' : ''}">${a}–${b}<small>${win ? 'VITTORIA' : 'SCONFITTA'}</small></div>`;
          if (m.parziali && m.parziali.length) stamp += `<div class="poster__sets">${m.parziali.map((p) => `<span>${esc(p)}</span>`).join('')}</div>`;
        } else {
          stamp = '<div class="poster__stamp poster__stamp--muted">GIOCATA<small>risultato in arrivo</small></div>';
        }
      }
      const tema = THEMES[m.tema] ? m.tema : 'noir-agents';
      return `
      <article class="poster tema-${tema} ${compClass(m)} ${played ? 'is-played' : ''}" data-comp="${esc(m.competizione)}" aria-label="${esc(`${m.competizione}, ${m.turno}: ODV contro ${m.avversario}, ${fmtDay.format(m.date)} ore ${fmtTime.format(m.date)}, ${m.luogo}`)}">
        <div class="poster__bg" aria-hidden="true"></div><div class="poster__fx" aria-hidden="true"></div>
        <span class="poster__league" aria-hidden="true">${m.competizione === 'Coppa Veneto' ? '🏆 Coppa Veneto' : 'Campionato · Serie C'}</span>
        <div class="poster__top">
          <div>
            <p class="poster__presents">Officina del Volley presenta</p>
            <span class="poster__comp">${esc(m.competizione)} · ${esc(m.turno)}</span>
          </div>
          <div class="poster__logo" title="Logo ${esc(m.avversario)}" aria-hidden="true">${esc(initials(m.avversario))}</div>
        </div>
        ${stamp}
        <h3 class="poster__title">${esc(THEMES[tema])}</h3>
        <p class="poster__vs">ODV Rio-Saonara <em>vs</em> ${esc(m.avversario)}</p>
        <div class="poster__badges">
          <span class="badge ${m.casa ? 'badge--casa' : 'badge--trasferta'}">${m.casa ? 'Casa' : 'Trasferta'}</span>
          ${isNext ? '<span class="badge badge--prossima">Prossima</span>' : ''}
          ${m.segnaposto ? '<span class="badge badge--tbc">Da confermare</span>' : ''}
        </div>
        <div class="poster__credits">
          <p class="poster__date">${esc(fmtDay.format(m.date).toUpperCase())} · ${esc(fmtTime.format(m.date))}</p>
          <p class="poster__venue">${esc(m.luogo)}</p>
          <p class="poster__billing">Un film di ${esc(coach)} · con le Eroine di ODV Rio-Saonara · e il pubblico più rumoroso della Serie C</p>
        </div>
      </article>`;
    }).join('');

    // Il timbro del risultato "sbatte" sulla locandina quando entra in vista (funziona anche dentro lo scroll orizzontale)
    $$('.poster', track).forEach((poster) => {
      const stamp = $('.poster__stamp', poster);
      const sets = $('.poster__sets', poster);
      if (!stamp) return;
      if (!HAS_GSAP || REDUCED) { stamp.style.opacity = 1; if (sets) sets.style.opacity = 1; return; }
      gsap.set(stamp, { xPercent: -50, yPercent: -50, rotation: -14 });
      onVisible(poster, () => {
        gsap.timeline({ delay: 0.15 })
          .fromTo(stamp, { scale: 3.4, autoAlpha: 0, rotation: -40 }, { scale: 1, autoAlpha: 1, rotation: -14, duration: 0.42, ease: 'power4.in' })
          .fromTo(poster, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1.2, 0.3)' })
          .to(sets, { autoAlpha: 1, duration: 0.3 }, '-=0.2');
      }, { threshold: 0.6 });
    });

    // Striscia orizzontale nativa: scorrimento a scatto, frecce, trascinamento col mouse e tastiera.
    // Niente sezione "fissata": la pagina scorre sempre normalmente e nulla copre i pulsanti.
    const posters = $('#posters');
    const prev = $('#postersPrev'), next = $('#postersNext');
    const step = () => {
      const first = $('.poster:not([hidden])', track);
      return first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 24) : 320;
    };
    const go = (dir) => posters.scrollBy({ left: dir * step(), behavior: REDUCED ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    const updateArrows = () => {
      const max = posters.scrollWidth - posters.clientWidth - 4;
      prev.disabled = posters.scrollLeft <= 4;
      next.disabled = posters.scrollLeft >= max;
      posters.classList.toggle('at-start', prev.disabled);
      posters.classList.toggle('at-end', next.disabled);
    };
    posters.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows, { passive: true });
    posters.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    // trascinamento col mouse (sul touch lo scorrimento è già nativo)
    let drag = null;
    posters.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: posters.scrollLeft, moved: false };
      posters.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      posters.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!drag) return;
      posters.classList.remove('is-dragging');
      setTimeout(() => { drag = null; }, 0);
    });
    posters.addEventListener('click', (e) => { if (drag && drag.moved) { e.preventDefault(); e.stopPropagation(); } }, true);

    // Filtro Campionato / Coppa Veneto
    const compChips = $$('.chips--comp .chip');
    compChips.forEach((chip) => chip.addEventListener('click', () => {
      const f = chip.dataset.comp;
      compChips.forEach((c) => { const on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      const items = $$('.poster', track);
      items.forEach((po) => { po.hidden = !(f === 'all' || po.dataset.comp === f); });
      const shown = items.filter((po) => !po.hidden);
      if (HAS_GSAP && !REDUCED) gsap.fromTo(shown, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', overwrite: true });
      const firstNext = shown.find((po) => !po.classList.contains('is-played')) || shown[0];
      posters.scrollTo({ left: firstNext ? Math.max(0, firstNext.offsetLeft - 16) : 0, behavior: 'auto' });
      updateArrows();
    }));

    // Parte già centrata sulla prossima partita
    if (nextIdx > 0) {
      const target = $$('.poster', track)[nextIdx];
      requestAnimationFrame(() => { posters.scrollLeft = Math.max(0, target.offsetLeft - 16); updateArrows(); });
    } else requestAnimationFrame(updateArrows);
  }

  /* ---------- 13 RISULTATI & CLASSIFICA ---------- */
  function countUp(el, to, duration = 1.4) {
    if (!HAS_GSAP || REDUCED) { el.textContent = to; return; }
    const o = { v: 0 };
    gsap.to(o, { v: to, duration, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
  }
  function initResults(team, matches, standings) {
    const now = Date.now();
    const played = matches.filter((m) => m.ts <= now);
    const withResult = played.filter((m) => m.risultato);
    const last = withResult[withResult.length - 1] || played[played.length - 1];
    const sb = $('#scoreboard');
    const status = $('#sbStatus');
    if (last) {
      $('#sbComp').innerHTML = `Ultimo risultato · <span class="comp-tag ${compClass(last)}">${esc(last.competizione === 'Serie C' ? 'Campionato' : last.competizione)}</span> ${esc(last.turno)}`;
      $('#sbAway').textContent = last.avversario;
      const sets = $('#sbSets');
      if (last.risultato) {
        const [a, b] = String(last.risultato).split(/[-–]/).map(Number);
        sets.innerHTML = (last.parziali || []).map((p, k) => `<li><b>${k + 1}° set</b>${esc(p)}</li>`).join('');
        status.textContent = `${fmtDay.format(last.date)} · ${last.luogo} · ${a > b ? 'Vittoria! Forza ODV!' : 'Si riparte più forti.'}`;
        onVisible(sb, () => {
          countUp($('#sbH'), a, 1.2);
          countUp($('#sbA'), b, 1.2);
          if (HAS_GSAP && !REDUCED) gsap.from($$('li', sets), { autoAlpha: 0, y: 20, scale: 0.8, stagger: 0.25, delay: 1, duration: 0.4, ease: 'back.out(2)' });
        });
      } else {
        $('#sbH').textContent = '–';
        $('#sbA').textContent = '–';
        status.textContent = `${fmtDay.format(last.date)} · ${last.luogo} · risultato in aggiornamento`;
        status.classList.add('is-waiting');
      }
    } else {
      $('#sbAway').textContent = 'si parte presto';
      status.textContent = 'La stagione sta per iniziare';
    }

    // Contatori calcolati dai risultati reali (ODV sempre per prima in risultato e parziali)
    const odvRow = (standings.squadre || standings).find((r) => /rio-?saonara|odv/i.test(r.squadra)) || {};
    const stats = { vittorie: 0, setVinti: 0, punti: odvRow.pt || 0, puntiFatti: 0 };
    withResult.forEach((m) => {
      const [a, b] = String(m.risultato).split(/[-–]/).map(Number);
      if (a > b) stats.vittorie++;
      stats.setVinti += a;
      (m.parziali || []).forEach((p) => { stats.puntiFatti += Number(String(p).split(/[-–]/)[0]) || 0; });
    });
    $$('[data-count]').forEach((el) => onVisible(el, () => countUp(el, Number(stats[el.dataset.count]) || 0, 1.8)));

    // Classifica (ordinata per punti, vittorie, quoziente set)
    const rows = [...(standings.squadre || standings)].sort((x, y) => (y.pt - x.pt) || (y.v - x.v) || ((y.sv / Math.max(1, y.sp)) - (x.sv / Math.max(1, x.sp))));
    const body = $('#standingsBody');
    body.innerHTML = rows.map((r, i) => {
      const odv = /rio-?saonara|odv/i.test(r.squadra);
      return `<tr class="${odv ? 'is-odv' : ''}"${odv ? ' aria-current="true"' : ''}>
        <td>${i + 1}</td><td class="t-left">${esc(r.squadra)}</td><td class="pt">${r.pt}</td><td>${r.g}</td><td>${r.v}</td><td>${r.p}</td><td>${r.sv}</td><td>${r.sp}</td></tr>`;
    }).join('');
    if (standings.nota) $('#standingsNote').textContent = standings.nota;
    if (HAS_ST && !REDUCED) {
      const trs = $$('tr', body);
      gsap.set(trs, { autoAlpha: 0, x: -50 });
      ScrollTrigger.create({ trigger: body, start: 'top 85%', once: true, onEnter: () => gsap.to(trs, { autoAlpha: 1, x: 0, stagger: 0.05, duration: 0.5, ease: 'power3.out' }) });
    }
  }

  /* ---------- 14 PALASPORT · INSTAGRAM · PARTNER ---------- */
  function initPalasport(team) {
    if (team.indirizzo) $('#palaAddr').textContent = team.indirizzo;
    // La mappa di OpenStreetMap si carica solo su richiesta (servizio esterno: niente connessioni senza consenso)
    const consent = $('#mapConsent');
    $('#mapLoad').addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.title = 'Mappa OpenStreetMap del Palasalmaso, Villatora di Saonara (PD)';
      frame.referrerPolicy = 'no-referrer';
      frame.src = consent.dataset.src;
      consent.replaceWith(frame);
      frame.focus();
    });
    if (!HAS_ST || REDUCED) return;
    $$('.arena [data-depth]').forEach((el) => {
      const d = parseFloat(el.dataset.depth);
      gsap.fromTo(el, { y: d * 120 }, { y: -d * 120, ease: 'none', scrollTrigger: { trigger: '#palasport', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }
  // Griglia Instagram da data/instagram.json: [{ "immagine": "ig-1.webp", "post": "https://www.instagram.com/p/…/" }]
  async function initInstagram() {
    let posts = [];
    try { posts = await loadJSON('data/instagram.json'); } catch (e) { /* griglia di segnaposto */ }
    if (!posts.length) posts = Array.from({ length: 9 }, (_, i) => ({ immagine: `ig-${i + 1}.webp` }));
    $('#igGrid').innerHTML = posts.map((p, i) => `
      <a class="ig-tile" href="${esc(p.post || 'https://www.instagram.com/officinadip/')}" target="_blank" rel="noopener" aria-label="Apri il post ${i + 1} di @officinadip su Instagram">
        <img src="assets/instagram/${esc(p.immagine)}" alt="${esc(p.alt || `Post Instagram ${i + 1} di @officinadip`)}" loading="lazy" decoding="async" width="512" height="640" onerror="this.closest('.ig-tile').classList.add('is-ph')">
        <span class="ig-tile__ph" aria-hidden="true">FOTO IN ARRIVO<small>@officinadip</small></span>
        <svg class="ig-tile__icon" aria-hidden="true"><use href="#i-instagram"/></svg>
      </a>`).join('');
    if (HAS_ST && !REDUCED) {
      const tiles = $$('.ig-tile');
      gsap.set(tiles, { autoAlpha: 0, y: 40, scale: 0.94 });
      ScrollTrigger.batch(tiles, { start: 'top 92%', once: true, onEnter: (b) => gsap.to(b, { autoAlpha: 1, y: 0, scale: 1, stagger: 0.08, duration: 0.7, ease: 'power3.out' }) });
    }
  }
  function initPartners() {
    const logos = Array.from({ length: 6 }, (_, i) => `<div class="logo-item"><img src="assets/sponsors/sponsor-${i + 1}.svg" alt="Sponsor ${i + 1} (logo segnaposto)" width="180" height="90" loading="lazy"></div>`).join('');
    const track = $('#logosTrack');
    track.innerHTML = logos + logos.replace(/alt="[^"]*"/g, 'alt="" aria-hidden="true"');
  }

  /* ---------- 15 CONTATTI ---------- */
  function initContact(team) {
    const form = $('#contactForm');
    const fields = {
      nome: { el: $('#fNome'), err: $('#eNome'), check: (v) => v.trim().length >= 2 || 'Dicci come ti chiami (almeno 2 lettere).' },
      email: { el: $('#fEmail'), err: $('#eEmail'), check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Serve un indirizzo email valido.' },
      messaggio: { el: $('#fMsg'), err: $('#eMsg'), check: (v) => v.trim().length >= 10 || 'Scrivi almeno 10 caratteri: anche un "Forza ODV!" va bene.' },
      privacy: { el: $('#fPrivacy'), err: $('#ePrivacy'), check: (_v, el) => el.checked || 'Per inviare il messaggio serve il consenso al trattamento dei dati.' }
    };
    const validate = (f) => {
      const res = f.check(f.el.value, f.el);
      const ok = res === true;
      f.el.setAttribute('aria-invalid', String(!ok));
      f.err.textContent = ok ? '' : res;
      return ok;
    };
    Object.values(fields).forEach((f) => f.el.addEventListener(f.el.type === 'checkbox' ? 'change' : 'blur', () => (f.el.type === 'checkbox' || f.el.value) && validate(f)));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const results = Object.values(fields).map(validate);
      if (results.includes(false)) {
        const firstBad = Object.values(fields).find((f) => f.el.getAttribute('aria-invalid') === 'true');
        firstBad.el.focus();
        if (HAS_GSAP && !REDUCED) gsap.fromTo(form, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.4, 0.3)' });
        return;
      }
      // Nessun backend: apriamo il client di posta precompilato (fallback mailto:)
      const to = team.email || 'info@officinadelvolley.it';
      const subject = `Messaggio dal sito ODV Rio-Saonara — ${fields.nome.el.value.trim()}`;
      const body = `${fields.messaggio.el.value.trim()}\n\n— ${fields.nome.el.value.trim()} (${fields.email.el.value.trim()})`;
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      playNetSuccess();
      form.reset();
    });
  }
  // Animazione successo: il pallone scavalca la rete neon e cade "IN"
  function playNetSuccess() {
    const box = $('#formSuccess');
    box.hidden = false;
    const ball = $('.net-anim__ball');
    const inTxt = $('.net-anim__in');
    const p0 = { x: 40, y: 140 }, c = { x: 160, y: -10 }, p1 = { x: 270, y: 139 };
    const place = (t) => {
      const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x;
      const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y;
      ball.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(t * 540).toFixed(0)})`);
    };
    if (!HAS_GSAP || REDUCED) { place(1); inTxt.style.opacity = 1; return; }
    const o = { t: 0 };
    gsap.timeline()
      .set(inTxt, { opacity: 0 })
      .to(o, { t: 1, duration: 1.1, ease: 'power1.inOut', onUpdate: () => place(o.t) })
      .to('.net-anim__net', { scaleY: 0.96, transformOrigin: '50% 100%', duration: 0.08, yoyo: true, repeat: 3 }, 0.5)
      .fromTo(inTxt, { opacity: 0, scale: 2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' });
  }

  /* ---------- 16 NAV, CURSORE, MICRO-INTERAZIONI, EASTER EGG ---------- */
  function initNav() {
    const nav = $('#nav');
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Ancore con smooth scroll
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2 || !$(id)) return;
      e.preventDefault();
      if (!$('#mobileMenu').hidden) toggleMenu(false);
      scrollToTarget(id);
      history.replaceState(null, '', id);
    });

    // Indicatore: pallina luminosa che scorre sotto il link attivo
    const links = $$('[data-nav]');
    const ball = $('.nav__ball');
    const moveBall = (link) => {
      links.forEach((l) => { const on = l === link; l.classList.toggle('is-active', on); on ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current'); });
      const x = link.offsetLeft + link.offsetWidth / 2;
      if (HAS_GSAP) gsap.to(ball, { x, opacity: 1, duration: REDUCED ? 0 : 0.6, ease: 'back.out(2.5)' });
      else { ball.style.transform = `translateX(${x}px)`; ball.style.opacity = 1; }
    };
    const sections = links.map((l) => $(l.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            const link = links.find((l) => l.getAttribute('href') === `#${en.target.id}`);
            if (link) moveBall(link);
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      sections.forEach((s) => io.observe(s));
    }

    // Menu mobile
    const burger = $('#burger');
    burger.addEventListener('click', () => toggleMenu($('#mobileMenu').hidden));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#mobileMenu').hidden) toggleMenu(false); });

    // Toggle "Luci del palazzetto"
    const toggle = $('#lightsToggle');
    const setTheme = (giorno) => {
      document.documentElement.dataset.theme = giorno ? 'giorno' : 'notte';
      toggle.setAttribute('aria-pressed', String(giorno));
      toggle.title = giorno ? 'Spegni le luci del palazzetto (modalità notte)' : 'Accendi le luci del palazzetto (modalità giorno)';
      $('meta[name="theme-color"]').setAttribute('content', giorno ? '#F2F5FB' : '#070B1F');
      try { localStorage.setItem('odv-tema', giorno ? 'giorno' : 'notte'); } catch (e) { /* ok */ }
    };
    setTheme(document.documentElement.dataset.theme === 'giorno');
    toggle.addEventListener('click', () => {
      const giorno = document.documentElement.dataset.theme !== 'giorno';
      setTheme(giorno);
      if (HAS_GSAP && !REDUCED) gsap.fromTo('body', { opacity: 0.4 }, { opacity: 1, duration: 0.5, ease: 'steps(4)' });
    });
  }
  function toggleMenu(open) {
    const menu = $('#mobileMenu');
    const burger = $('#burger');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      lockScroll(true);
      $('a', menu).focus();
    } else {
      menu.classList.remove('is-open');
      menu.hidden = true;
      lockScroll(false);
      burger.focus();
    }
  }

  function initMagnetic() {
    $$('[data-magnetic]').forEach((btn) => {
      if (FINE_POINTER && !REDUCED && HAS_GSAP) {
        const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
        const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
        btn.addEventListener('pointermove', (e) => {
          const r = btn.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.45);
        });
        btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      }
      // "Scossa della rete" al clic
      btn.addEventListener('click', () => {
        if (!HAS_GSAP || REDUCED) return;
        gsap.fromTo(btn, { rotation: 0 }, { keyframes: { rotation: [-5, 4, -3, 2, 0] }, duration: 0.45, ease: 'none' });
      });
    });
  }

  function initRevealFx() {
    // Neon che si accende quando entra nel viewport
    $$('[data-flicker]').forEach((el) => {
      if (el.id === 'heroTitle') return;
      onVisible(el, () => el.classList.add('is-lit'), { threshold: 0.4 });
    });
    // Linee del campo che si disegnano
    $$('.court-divider').forEach((el) => onVisible(el, () => el.classList.add('is-drawn'), { threshold: 1 }));
    // Rete che vibra al passaggio del mouse
    $$('.mesh').forEach((sec) => {
      sec.addEventListener('pointerenter', () => {
        sec.classList.remove('is-rippling');
        void sec.offsetWidth;
        sec.classList.add('is-rippling');
      });
    });
    // Wipe angolato in stile broadcast sui titoli di sezione
    if (!HAS_GSAP || REDUCED) return;
    $$('.section__head, .partite__head').forEach((head) => {
      head.style.position = 'relative';
      const bar = document.createElement('span');
      bar.className = 'wipe-bar';
      bar.setAttribute('aria-hidden', 'true');
      head.appendChild(bar);
      const kids = [...head.children].filter((c) => c !== bar && !c.hasAttribute('data-flicker'));
      gsap.set(bar, { autoAlpha: 0 });
      gsap.set(kids, { autoAlpha: 0 });
      onVisible(head, () => {
        gsap.timeline()
          .fromTo(bar, { xPercent: -110, skewX: -18, autoAlpha: 1 }, { xPercent: 0, duration: 0.35, ease: 'power3.in' })
          .set(kids, { autoAlpha: 1 })
          .to(bar, { xPercent: 115, duration: 0.45, ease: 'power3.out' })
          .call(() => bar.remove());
      }, { threshold: 0.3 });
    });
  }

  // Easter egg: digita "ACE" → pioggia di mini palloni + insegna "ACE!"
  function initAce() {
    let buf = '';
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable]') || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-3);
      if (buf === 'ace') { buf = ''; ace(); }
    });
  }
  function ace() {
    const banner = $('#aceBanner');
    $('#aceLive').textContent = 'Ace! Punto diretto in battuta.';
    if (!HAS_GSAP) return;
    gsap.timeline()
      .fromTo(banner, { autoAlpha: 0, scale: 0.4, rotation: -8 }, { autoAlpha: 1, scale: 1.1, rotation: -4, duration: 0.35, ease: 'back.out(3)' })
      .to(banner, { keyframes: { opacity: [1, 0.3, 1, 0.5, 1] }, duration: 0.5 })
      .to(banner, { autoAlpha: 0, scale: 1.5, duration: 0.4, delay: 0.5 });
    if (REDUCED) return;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    for (let i = 0; i < 28; i++) {
      const b = document.createElement('div');
      b.className = 'mini-ball';
      b.innerHTML = '<svg viewBox="0 0 100 100"><use href="#i-ball"/></svg>';
      document.body.appendChild(b);
      const ang = Math.random() * Math.PI * 2;
      const dist = 200 + Math.random() * Math.max(innerWidth, innerHeight) * 0.6;
      gsap.set(b, { x: cx - 15, y: cy - 15, scale: 0.3 });
      gsap.timeline({ onComplete: () => b.remove() })
        .to(b, { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist * 0.7, scale: 0.6 + Math.random() * 1.2, rotation: gsap.utils.random(-720, 720), duration: 0.9 + Math.random() * 0.5, ease: 'power3.out' })
        .to(b, { y: `+=${innerHeight * 0.6}`, autoAlpha: 0, duration: 0.9, ease: 'power2.in' });
    }
  }

  function heroIntro(ballCtl) {
    const title = $('#heroTitle');
    title.classList.add('is-lit');
    ballCtl.intro();
    if (!HAS_GSAP || REDUCED) return;
    gsap.from(['.hero .eyebrow', '.hero__sub', '.hero__tag', '.hero__ctas > *'], { autoAlpha: 0, y: 30, duration: 0.8, stagger: 0.08, delay: 0.25, ease: 'power3.out' });
    gsap.from('#nextCard', { autoAlpha: 0, x: 60, rotationY: -25, transformPerspective: 800, duration: 1, delay: 0.6, ease: 'power3.out' });
    gsap.from('.hero__sign', { autoAlpha: 0, duration: 1.2, stagger: 0.3, ease: 'steps(6)' });
  }

  /* ---------- 17 AVVIO ---------- */
  async function boot() {
    initSmoothScroll();
    initNav();
    initMarquee();
    buildCity();
    initRain();
    initHeroParallax();
    initAce();
    initInstagram();
    initPartners();
    const ballCtl = initBall();

    // Avanzamento del loader: scena 3D (foto delle card) 70%, dati del sito 30%
    const loader = runLoader();
    const prog = { pov: 0, data: 0 };
    const report = () => loader.progress(prog.pov * 0.7 + prog.data * 0.3);
    loader.done.then(() => heroIntro(ballCtl));

    let data = null;
    try {
      data = await dataPromise;
    } catch (err) {
      console.warn('[ODV] Impossibile caricare i dati JSON. Avvia un server locale (vedi README).', err);
      $('#roster').innerHTML = '<p class="section__lead">Dati non disponibili: apri il sito tramite un server locale (vedi README) per caricare le eroine.</p>';
    }
    prog.data = 0.4; report();
    // La scena 3D parte subito con i dati della squadra, in parallelo a FIPAV
    const povReady = window.ODVPov
      ? window.ODVPov.init(data && data.team, (f) => { prog.pov = f; report(); }).catch((e) => { console.warn('[ODV] Scena 3D non disponibile.', e); return false; })
      : Promise.resolve(false);
    povReady.then(() => performance.mark('odv:pov-pronta')); // tempi misurabili in DevTools → Performance

    let live = null;
    if (data && window.ODVFipav) {
      // FIPAV in diretta; se non risponde in 3,5 s restano i JSON salvati (dopo il primo accesso è in cache)
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3500));
      live = await Promise.race([window.ODVFipav.refresh(data.matches, data.standings).catch((e) => { console.warn('[ODV] FIPAV non raggiungibile, uso i dati salvati.', e); return null; }), timeout]);
      if (live) { data.matches = live.matches; data.standings = live.standings; }
    }
    prog.data = 0.8; report();
    const stamp = $('#fipavStamp');
    if (stamp) {
      stamp.classList.toggle('is-live', !!live);
      stamp.innerHTML = live
        ? `<i></i> Dati in diretta da FIPAV Veneto · aggiornati alle ${fmtTime.format(live.aggiornato)}`
        : 'Dati FIPAV salvati · <a href="https://www.fipavveneto.net/mobile/risultati.asp?CampionatoId=92006" target="_blank" rel="noopener">calendario ufficiale</a>';
    }
    if (data) {
      const matches = data.matches
        .map((m) => ({ ...m, date: new Date(m.data), ts: new Date(m.data).getTime() }))
        .sort((a, b) => a.ts - b.ts);
      initRoster(data.team);
      initSelect(data.team);
      initRotation(data.team);
      initStaff(data.team);
      initPosters(data.team, matches);
      initResults(data.team, matches, data.standings);
      initPalasport(data.team);
      initContact(data.team);
      initCountdown(matches);
    }
    initMagnetic();
    initRevealFx();
    prog.data = 1; report();

    // Si entra solo quando la scena 3D è completa (con un tetto di 15 s, per non restare mai bloccati)
    await Promise.race([povReady, new Promise((r) => setTimeout(r, 15000))]);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (HAS_ST) ScrollTrigger.refresh();
    performance.mark('odv:contenuti-pronti');
    loader.finish();
    await loader.done;
    performance.mark('odv:sito-visibile');
    if (HAS_ST) {
      window.addEventListener('load', () => ScrollTrigger.refresh());
      ScrollTrigger.refresh();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
