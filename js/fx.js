/* ============================================================
   Fantasy Realms — FX layer
   three.js ember background, GSAP score counter, card-add
   flight & sparkle effects. Purely decorative: every feature
   degrades gracefully when three/gsap are missing.
   ============================================================ */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =============== WebGL ember background =============== */
  function initBackground() {
    var canvas = document.getElementById('fx-bg');
    if (!canvas || !window.THREE) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    } catch (e) {
      return; // no WebGL — static gradient background remains
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(60, 1, 1, 120);
    camera.position.z = 32;

    var SPREAD_X = 42, SPREAD_Y = 28;
    var N = 230;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(N * 3);
    var col = new Float32Array(N * 3);
    var meta = [];
    // violet / teal / gold / white embers
    var palette = [[0.6, 0.45, 1.0], [0.25, 0.9, 0.8], [1.0, 0.82, 0.4], [0.92, 0.9, 1.0]];
    var weights = [0.38, 0.25, 0.22, 0.15];

    function pickColor() {
      var r = Math.random(), acc = 0;
      for (var i = 0; i < palette.length; i++) {
        acc += weights[i];
        if (r <= acc) return palette[i];
      }
      return palette[0];
    }

    for (var i = 0; i < N; i++) {
      var x = (Math.random() * 2 - 1) * SPREAD_X;
      var y = (Math.random() * 2 - 1) * SPREAD_Y;
      var z = (Math.random() * 2 - 1) * 14;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      var c = pickColor();
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      meta.push({
        speed: 0.3 + Math.random() * 0.9,
        amp: 0.5 + Math.random() * 2.4,
        phase: Math.random() * Math.PI * 2,
        freq: 0.08 + Math.random() * 0.35,
        baseX: x
      });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    // soft round sprite texture
    var spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteCanvas.height = 64;
    var g = spriteCanvas.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(spriteCanvas);

    var mat = new THREE.PointsMaterial({
      size: 1.1,
      map: tex,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    scene.add(new THREE.Points(geo, mat));

    var targX = 0, targY = 0, curX = 0, curY = 0;
    window.addEventListener('pointermove', function (e) {
      targX = e.clientX / window.innerWidth - 0.5;
      targY = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    var running = !document.hidden, raf = 0, last = performance.now(), t = 0;

    function loop() {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      var now = performance.now();
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      var p = geo.attributes.position.array;
      for (var i = 0; i < N; i++) {
        var m = meta[i];
        p[i * 3 + 1] += m.speed * dt * 2.1;
        if (p[i * 3 + 1] > SPREAD_Y) p[i * 3 + 1] = -SPREAD_Y;
        p[i * 3] = m.baseX + Math.sin(t * m.freq + m.phase) * m.amp;
      }
      geo.attributes.position.needsUpdate = true;
      curX += (targX - curX) * 0.03;
      curY += (targY - curY) * 0.03;
      camera.position.x = curX * 4;
      camera.position.y = -curY * 3;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }

    document.addEventListener('visibilitychange', function () {
      var shouldRun = !document.hidden && !reduced;
      if (shouldRun && !running) {
        running = true;
        last = performance.now();
        loop();
      } else if (!shouldRun) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });

    if (reduced) {
      running = false;
      renderer.render(scene, camera); // one static frame of stardust
    } else {
      loop();
    }
  }

  /* =============== score counter & orb pulse =============== */
  var lastScore = null, scoreTween = null;

  function fmt(v) {
    v = Math.round(v);
    return v >= 0 ? ('000' + v).slice(-3) : '-' + ('000' + Math.abs(v)).slice(-3);
  }

  function onHandUpdated() {
    var el = document.getElementById('points');
    if (!el) return;
    var mirror = document.getElementById('sheet-points');
    var v = parseInt(el.textContent, 10) || 0;
    if (lastScore === null || v === lastScore || reduced || !window.gsap) {
      if (mirror) mirror.textContent = fmt(v);
      lastScore = v;
      return;
    }
    if (scoreTween) scoreTween.kill();
    var counter = { v: lastScore };
    var target = v;
    scoreTween = gsap.to(counter, {
      v: target,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: function () {
        var s = fmt(counter.v);
        el.textContent = s;
        if (mirror) mirror.textContent = s;
      },
      onComplete: function () {
        el.textContent = fmt(target);
        if (mirror) mirror.textContent = fmt(target);
      }
    });
    gsap.fromTo(el, { scale: 1.25 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)', clearProps: 'scale' });
    var orb = document.querySelector('.fr-orb');
    if (orb) {
      orb.classList.remove('is-flash');
      void orb.offsetWidth;
      orb.classList.add('is-flash');
    }
    lastScore = v;
  }
  document.addEventListener('fr:hand-updated', onHandUpdated);

  /* =============== card-add flight & sparkles =============== */
  function suitOf(el) {
    var m = (el.className || '').match(/\b(land|flood|weather|flame|army|wizard|leader|beast|weapon|artifact|wild|building|outsider|undead|cursed-item)\b/);
    return m ? m[1] : '';
  }

  window.frFx = {
    cardAdded: function (fromEl) {
      if (reduced || !window.gsap || !fromEl) return;
      var from = fromEl.getBoundingClientRect();
      var desktop = window.matchMedia('(min-width: 900px)').matches;
      var targetEl = desktop ? document.getElementById('hand-sheet') : document.getElementById('sheet-bar');
      if (!targetEl) return;
      var to = targetEl.getBoundingClientRect();
      var suit = suitOf(fromEl);

      /* flying chip */
      var chip = document.createElement('div');
      chip.className = 'fx-chip ' + suit;
      var x0 = from.left + from.width * 0.5;
      var y0 = from.top + from.height * 0.5;
      chip.style.left = (x0 - 9) + 'px';
      chip.style.top = (y0 - 9) + 'px';
      document.body.appendChild(chip);
      var dx = (to.left + to.width * 0.5) - x0;
      var dy = (to.top + Math.min(to.height * 0.5, 30)) - y0;
      gsap.to(chip, {
        keyframes: [
          { x: dx * 0.45, y: dy * 0.35 - 46, scale: 1.25, duration: 0.26, ease: 'power1.out' },
          { x: dx, y: dy, scale: 0.35, opacity: 0.4, duration: 0.3, ease: 'power2.in' }
        ],
        onComplete: function () { chip.remove(); }
      });

      /* sparkle burst at tap position */
      for (var i = 0; i < 7; i++) {
        var s = document.createElement('span');
        s.className = 'fx-spark ' + suit;
        s.style.left = (x0 - 2) + 'px';
        s.style.top = (y0 - 2) + 'px';
        document.body.appendChild(s);
        var a = Math.random() * Math.PI * 2;
        var d = 22 + Math.random() * 30;
        gsap.to(s, {
          x: Math.cos(a) * d,
          y: Math.sin(a) * d,
          opacity: 0,
          scale: 0.3,
          duration: 0.45 + Math.random() * 0.25,
          ease: 'power2.out',
          onComplete: (function (el) { return function () { el.remove(); }; })(s)
        });
      }

      /* pulse the target bar */
      var bar = document.getElementById('sheet-bar');
      if (bar && !desktop) {
        bar.classList.remove('is-flash');
        void bar.offsetWidth;
        bar.classList.add('is-flash');
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackground);
  } else {
    initBackground();
  }
})();
