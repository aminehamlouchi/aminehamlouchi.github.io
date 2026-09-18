/* ============================================================
   home.js: aminehamlouchi.com v3, "the stage"
   A full-screen WebGL stage (raw WebGL, no library) renders a
   procedural world per scene and shader transitions between them.
   Native scroll + snap drives the scene index. GSAP (vendored,
   optional) animates the DOM. Everything degrades: no WebGL gets
   a tinted gradient, reduced motion gets stills and cross-fades,
   no JS gets a readable document.
   ============================================================ */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const body = document.body;
  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  html.classList.remove("no-js");
  // keep DOM motion on wall-clock time even when the GPU frame rate dips
  if (hasGsap) gsap.ticker.lagSmoothing(0);

  /* ------------------------------------------------------------
     scene registry
     ------------------------------------------------------------ */
  const scenes = $$(".scene");
  const TINTS = [
    [0.62, 0.86, 1.0], // 0 intro: cold glass (cyan-ice)
    [0.91, 0.92, 0.94], // 1 work: bone
    [0.38, 0.78, 1.0], // 2 experience: sky
    [1.0, 0.71, 0.33], // 3 community: saffron
    [0.55, 0.94, 0.48], // 4 code: phosphor
    [0.79, 0.65, 1.0], // 5 contact: violet
    [0.86, 0.92, 1.0], // 6 résumé: ice
  ];
  const EFFECTS = { glass: 0, ripple: 1, plasma: 2, frost: 3 };
  let sceneIdx = 0;

  /* ------------------------------------------------------------
     toast + sound
     ------------------------------------------------------------ */
  const toastEl = $("[data-toast]");
  let toastT = 0;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
  };

  const sound = (() => {
    let ctx = null;
    let on = false;
    try {
      on = localStorage.getItem("sound") === "on";
    } catch {}
    const btn = $("[data-sound]");
    const paint = () => {
      if (!btn) return;
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "sound on" : "sound off";
    };
    const ensure = () => {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
    };
    const blip = (f0, f1, dur, gain) => {
      if (!on) return;
      try {
        ensure();
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + dur + 0.02);
      } catch {}
    };
    if (btn) {
      btn.addEventListener("click", () => {
        on = !on;
        try {
          localStorage.setItem("sound", on ? "on" : "off");
        } catch {}
        paint();
        if (on) blip(660, 990, 0.12, 0.05);
      });
      paint();
    }
    return {
      tick: () => blip(520, 780, 0.09, 0.035),
      hover: () => blip(1200, 1400, 0.03, 0.012),
      chord: () => {
        blip(440, 660, 0.25, 0.04);
        setTimeout(() => blip(660, 990, 0.25, 0.03), 90);
      },
      get on() {
        return on;
      },
    };
  })();

  /* ------------------------------------------------------------
     the GPU stage
     ------------------------------------------------------------ */
  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uSceneA, uSceneB, uProgress, uEffect, uStorm, uBoot;
    uniform vec3 uTintA, uTintB;
    uniform float uQ;

    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++){ if (float(i) >= 3.0 + uQ * 2.0) break; v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }
    /* liquid glass: a field of drifting lenses, smooth-unioned, plus one under the pointer */
    float lenses(vec2 p, vec2 m, float t){
      float d = 1e3;
      for (int i = 0; i < 4; i++){
        float fi = float(i);
        vec2 c = vec2(sin(t * 0.21 + fi * 1.7) * 0.6 + cos(t * 0.09 + fi * 0.9) * 0.22, cos(t * 0.17 + fi * 2.3) * 0.36 + sin(t * 0.07 + fi) * 0.1);
        float r = 0.2 + 0.05 * sin(t * 0.45 + fi * 1.3);
        float di = length(p - c) - r;
        float h = clamp(0.5 + 0.5 * (d - di) / 0.28, 0.0, 1.0);
        d = mix(d, di, h) - 0.28 * h * (1.0 - h);
      }
      float dm = length(p - m) - 0.15;
      float h = clamp(0.5 + 0.5 * (d - dm) / 0.3, 0.0, 1.0);
      d = mix(d, dm, h) - 0.3 * h * (1.0 - h);
      return d;
    }
    vec3 lightField(vec2 p, vec3 tint, float t){
      vec3 bg = vec3(0.02, 0.028, 0.04);
      float beams = 0.0;
      for (int i = 0; i < 3; i++){
        float fi = float(i);
        float b = sin((p.x * 0.9 - p.y * 0.55) * 3.6 + t * 0.25 + fi * 2.1);
        beams += smoothstep(0.8, 1.0, b) * (0.25 + 0.18 * fi);
      }
      vec2 gp = abs(fract(p * 2.6 + vec2(0.0, t * 0.04)) - 0.5);
      float grid = smoothstep(0.485, 0.5, max(gp.x, gp.y));
      float glow = smoothstep(1.3, 0.0, length(p - vec2(0.35, 0.1)));
      return bg + tint * (beams * 0.22 + grid * 0.16 + glow * 0.07);
    }
    vec2 fold(vec2 p, float n){
      float a = atan(p.y, p.x);
      float s = 6.2831853 / n;
      a = mod(a, s);
      a = abs(a - s * 0.5);
      return length(p) * vec2(cos(a), sin(a));
    }
    float cellular(vec2 p){
      vec2 i = floor(p), f = fract(p);
      float d = 1.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
        vec2 g = vec2(float(x), float(y));
        vec2 o = vec2(hash(i + g), hash(i + g + 7.0));
        d = min(d, length(g + o - f));
      }
      return d;
    }

    vec3 world(float id, vec2 uv, vec2 p, vec3 tint, float t){
      vec3 bg = vec3(0.02, 0.028, 0.04);
      vec3 col = bg;
      if (id < 0.5 || id > 5.5) {
        /* 00 intro (and 06 résumé): liquid glass. lenses refract a light field, with dispersion and a specular rim */
        vec2 m0 = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float d0 = lenses(p, m0, t);
        float e = 0.012;
        vec2 g = vec2(lenses(p + vec2(e, 0.0), m0, t) - d0, lenses(p + vec2(0.0, e), m0, t) - d0) / e;
        float inside = smoothstep(0.004, -0.004, d0);
        float thick = sqrt(max(0.0, -d0)) * 1.2;
        vec2 bend = -g * thick * 0.18;
        vec3 r = lightField(p + bend * 1.06, tint, t);
        vec3 gcol = lightField(p + bend, tint, t);
        vec3 b = lightField(p + bend * 0.94, tint, t);
        vec3 refr = vec3(r.r, gcol.g, b.b) * 1.25 + tint * 0.05;
        vec3 plain = lightField(p, tint, t);
        vec3 n = normalize(vec3(-g * 0.9, 1.0));
        float spec = pow(max(0.0, dot(n, normalize(vec3(-0.45, 0.7, 0.6)))), 28.0);
        float rim = smoothstep(0.035, 0.0, abs(d0));
        vec3 film = 0.5 + 0.5 * sin(thick * 14.0 + vec3(0.0, 2.1, 4.2));
        col = mix(plain, refr + film * 0.035, inside);
        col += (spec * 0.9 * inside + rim * 0.55) * mix(vec3(1.0), tint, 0.5);
      } else if (id < 1.5) {
        /* 01 work: ink in water */
        float n1 = fbm(p * 2.2 + vec2(t * 0.05, 0.0));
        float n2 = fbm(p * 2.2 + n1 * 2.6 + vec2(0.0, t * 0.04));
        float ink = pow(smoothstep(0.32, 0.92, n2), 2.2);
        col = bg + vec3(0.92, 0.93, 0.96) * ink * 0.22 + tint * ink * 0.12;
      } else if (id < 2.5) {
        /* 02 experience: perspective grid with light pulses */
        vec2 g = p; g.y += 0.32;
        float depth = 1.0 / (abs(g.y) + 0.22);
        vec2 gp = vec2(g.x * depth * 2.2, depth * 1.3 + t * 0.7);
        vec2 f = abs(fract(gp) - 0.5);
        float line = smoothstep(0.47, 0.5, max(f.x, f.y));
        float fade = smoothstep(0.0, 1.0, 1.0 / depth) * 0.9;
        float pulse = pow(fract(gp.y * 0.2 - t * 0.35), 10.0);
        float horizon = smoothstep(0.06, 0.0, abs(g.y)) * 0.8;
        col = bg + tint * (line * fade * (0.35 + pulse * 1.2) + horizon * 0.4);
      } else if (id < 3.5) {
        /* 03 community: warm aurora */
        float band = 0.0;
        for (int i = 0; i < 4; i++){
          float fi = float(i);
          float y = 0.28 * sin(p.x * 1.4 + t * 0.25 + fi * 1.9) + fi * 0.16 - 0.25;
          float wob = 0.08 * fbm(p * 3.0 + t * 0.12 + fi);
          band += smoothstep(0.12, 0.0, abs(p.y - y) - wob) * (0.5 + 0.5 * fi / 3.0);
        }
        col = bg + tint * band * 0.42 + tint * 0.06 * fbm(p * 2.0 + t * 0.03);
      } else if (id < 4.5) {
        /* 04 code: hex cells flickering */
        vec2 hp = p * 9.0;
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(hp, r) - h;
        vec2 b = mod(hp - h, r) - h;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        vec2 id2 = hp - gv;
        float e = 1.0 - max(abs(gv.x) * 0.866 + abs(gv.y) * 0.5, abs(gv.y));
        float edge = smoothstep(0.0, 0.06, e) * smoothstep(0.12, 0.06, e);
        float flick = step(0.93, hash(floor(id2) + floor(t * 2.0 + hash(id2) * 4.0)));
        float fill = smoothstep(0.08, 0.5, e) * flick;
        float vig = smoothstep(1.4, 0.2, length(p));
        col = bg + tint * (edge * 0.18 + fill * 0.55) * vig;
      } else {
        /* 05 contact: deep calm with stars */
        float n = fbm(p * 1.4 + vec2(t * 0.02, 0.0));
        float stars = step(0.996, hash(floor(uv * uRes * 0.5))) * (0.5 + 0.5 * sin(t * 2.0 + hash(floor(uv * uRes * 0.5)) * 6.28));
        col = bg + tint * 0.16 * n + vec3(stars) * 0.6;
      }
      float vign = smoothstep(1.5, 0.35, length(p));
      return col * (0.55 + 0.45 * vign);
    }

    void main(){
      vec2 uv = vUv;
      vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float t = uTime;
      vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      float md = length(p - m);
      /* the pointer warms the world around it */
      p += (p - m) * 0.06 * smoothstep(0.5, 0.0, md);

      vec3 colA = world(uSceneA, uv, p, uTintA, t);
      vec3 col = colA;

      if (uProgress > 0.001) {
        float pr = uProgress;
        float mask = 0.0;
        vec2 uvB = uv;
        if (uEffect < 0.5) {
          /* glass: a bubble grows from the pointer, refracting the next world */
          float R = pr * 1.9;
          float d = length(p - m);
          mask = smoothstep(R + 0.02, R - 0.02, d);
          vec2 dir = (p - m) / max(d, 0.001);
          float ro = 0.09 * pow(smoothstep(0.2, 1.0, d / max(R, 0.001)), 1.5) * (1.0 - pr);
          uvB -= dir * ro;
          float rim = smoothstep(0.03, 0.0, abs(d - R)) * (1.0 - pr);
          vec3 colB = world(uSceneB, uvB, (uvB - 0.5) * vec2(uRes.x / uRes.y, 1.0), uTintB, t);
          col = mix(colA, colB, mask) + uTintB * rim * 0.5;
        } else if (uEffect < 1.5) {
          /* ripple: concentric waves carry the next world in */
          float d = length(p - m);
          float wave = sin(d * 26.0 - pr * 22.0) * 0.5 + 0.5;
          float front = smoothstep(pr * 2.4 + 0.15, pr * 2.4 - 0.25, d);
          mask = clamp(front + wave * 0.35 * (1.0 - pr) * front, 0.0, 1.0);
          vec2 dir = (p - m) / max(d, 0.001);
          uvB += dir * sin(d * 26.0 - pr * 22.0) * 0.02 * (1.0 - pr);
          vec3 colB = world(uSceneB, uvB, (uvB - 0.5) * vec2(uRes.x / uRes.y, 1.0), uTintB, t);
          col = mix(colA, colB, mask);
        } else if (uEffect < 2.5) {
          /* plasma: a burning edge eats the old world */
          float n = fbm(p * 3.0 + t * 0.2);
          float th = pr * 1.3 - 0.15;
          mask = smoothstep(th - 0.08, th + 0.08, n + (1.0 - length(p) * 0.35) * 0.3);
          float edge = smoothstep(0.1, 0.0, abs(n + (1.0 - length(p) * 0.35) * 0.3 - th));
          vec3 colB = world(uSceneB, uv, p, uTintB, t);
          col = mix(colA, colB, mask) + uTintB * edge * 0.9 * (1.0 - pr) * pr * 4.0;
        } else {
          /* frost: crystals grow across the frame */
          float c = cellular(p * 7.0 + t * 0.05);
          float n = fbm(p * 4.0);
          float th = pr * 1.25 - 0.1;
          mask = smoothstep(th - 0.06, th + 0.06, n * 0.6 + c * 0.5 + (1.0 - uv.y) * 0.2);
          float crystal = smoothstep(0.08, 0.0, c) * smoothstep(0.15, 0.0, abs(n * 0.6 + c * 0.5 + (1.0 - uv.y) * 0.2 - th));
          vec3 colB = world(uSceneB, uv, p, uTintB, t);
          col = mix(colA, colB, mask) + vec3(0.9) * crystal * 0.5 * (1.0 - pr);
        }
      }

      /* konami storm and boot flash */
      col += uTintA * uStorm * (0.5 + 0.5 * sin(t * 30.0 + p.x * 20.0)) * 0.35;
      col = mix(col, vec3(0.0), uBoot);

      /* grain */
      col += (hash(uv * uRes + fract(t)) - 0.5) * 0.035;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const stage = (() => {
    const canvas = $("#stage");
    if (!canvas) return null;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) {
      html.classList.add("no-gl");
      return null;
    }
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      html.classList.add("no-gl");
      return null;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      html.classList.add("no-gl");
      return null;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ["uRes", "uTime", "uMouse", "uSceneA", "uSceneB", "uProgress", "uEffect", "uStorm", "uBoot", "uTintA", "uTintB", "uQ"].forEach(
      (n) => (U[n] = gl.getUniformLocation(prog, n))
    );

    const initial = Number(canvas.dataset.scene || 0) || 0;
    const state = {
      sceneA: initial,
      sceneB: initial,
      progress: 0,
      effect: 0,
      storm: 0,
      pending: null,
      tween: null,
      boot: motionOK ? 1 : 0,
      tintA: (TINTS[initial] || TINTS[0]).slice(),
      tintB: (TINTS[initial] || TINTS[0]).slice(),
      mouse: [0.5, 0.5],
      mouseT: [0.62, 0.45],
    };

    const scale = finePointer ? Math.min(window.devicePixelRatio || 1, 1.5) * 0.8 : 0.55;
    const resize = () => {
      const w = Math.round(window.innerWidth * scale);
      const h = Math.round(window.innerHeight * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    let running = false;
    let raf = 0;
    const t0 = performance.now();
    const draw = (now) => {
      resize();
      const t = (now - t0) / 1000;
      state.mouse[0] = lerp(state.mouse[0], state.mouseT[0], 0.06);
      state.mouse[1] = lerp(state.mouse[1], state.mouseT[1], 0.06);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, t);
      gl.uniform2f(U.uMouse, state.mouse[0], state.mouse[1]);
      gl.uniform1f(U.uSceneA, state.sceneA);
      gl.uniform1f(U.uSceneB, state.sceneB);
      gl.uniform1f(U.uProgress, state.progress);
      gl.uniform1f(U.uEffect, state.effect);
      gl.uniform1f(U.uStorm, state.storm);
      gl.uniform1f(U.uBoot, state.boot);
      gl.uniform3fv(U.uTintA, state.tintA);
      gl.uniform3fv(U.uTintB, state.tintB);
      gl.uniform1f(U.uQ, finePointer ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (running && motionOK) raf = requestAnimationFrame(draw);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const once = () => draw(performance.now());

    window.addEventListener("pointermove", (e) => {
      state.mouseT[0] = e.clientX / window.innerWidth;
      state.mouseT[1] = 1 - e.clientY / window.innerHeight;
    });
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : motionOK && start()));
    window.addEventListener("resize", () => !motionOK && once());
    if (motionOK) start();
    else once();

    return {
      state,
      once,
      transition(to, effect, done) {
        const commit = () => {
          state.sceneA = state.sceneB;
          state.tintA = state.tintB.slice();
          state.progress = 0;
          state.tween = null;
        };
        const runNext = () => {
          const next = state.pending;
          state.pending = null;
          if (next) this.transition(next.to, next.effect, next.done);
        };
        if (to === state.sceneB && state.tween) return;
        /* already mid-transition: never reset progress (that is the visible
           snap-back). Queue the newest target and let the running tween
           accelerate to its end, so the picture keeps moving one way. */
        if (state.tween && state.tween.isActive()) {
          state.pending = { to, effect, done };
          state.tween.timeScale(Math.min(4, state.tween.timeScale() * 1.9));
          return;
        }
        state.sceneB = to;
        state.tintB = TINTS[to].slice();
        state.effect = effect;
        if (!motionOK || !hasGsap) {
          commit();
          once();
          if (done) done();
          return;
        }
        state.progress = 0.0001;
        state.tween = gsap.to(state, {
          progress: 1,
          duration: finePointer ? (effect === EFFECTS.glass ? 1.0 : 1.15) : 0.85,
          ease: "power2.inOut",
          onComplete: () => {
            commit();
            if (state.pending) runNext();
            else if (done) done();
          },
        });
      },
      storm() {
        if (!hasGsap) return;
        gsap.killTweensOf(state, "storm");
        gsap.fromTo(state, { storm: 1 }, { storm: 0, duration: 5, ease: "expo.out" });
      },
      boot() {
        if (!hasGsap || !motionOK) {
          state.boot = 0;
          once();
          return;
        }
        gsap.to(state, { boot: 0, duration: 1.6, ease: "power2.out", delay: 0.2 });
      },
    };
  })();

  /* ------------------------------------------------------------
     text: split + scramble
     ------------------------------------------------------------ */
  const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/";
  const ARABIC = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي";
  const splitChars = (el) => {
    if (el.dataset.splitDone) return $$(".char", el);
    el.setAttribute("aria-label", el.textContent.trim().replace(/\s+/g, " "));
    const splitNode = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) return frag.appendChild(document.createTextNode(" "));
            const word = document.createElement("span");
            word.className = "word";
            word.setAttribute("aria-hidden", "true");
            Array.from(w).forEach((ch) => {
              const c = document.createElement("span");
              c.className = "char";
              c.textContent = ch;
              word.appendChild(c);
            });
            frag.appendChild(word);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          splitNode(child);
        }
      });
    };
    splitNode(el);
    el.dataset.splitDone = "1";
    return $$(".char", el);
  };
  const scramble = (el, finalText, { duration = 700, chars = LATIN, from = null } = {}) =>
    new Promise((resolve) => {
      if (!motionOK) {
        el.textContent = finalText;
        return resolve();
      }
      const start = performance.now();
      const len = finalText.length;
      const seed = Array.from({ length: len }, () => Math.random());
      const tick = (now) => {
        const p = clamp01((now - start) / duration);
        let out = "";
        for (let i = 0; i < len; i++) {
          const ch = finalText[i];
          if (ch === " ") {
            out += " ";
            continue;
          }
          const reveal = p > seed[i] * 0.7 + (i / len) * 0.3;
          out += reveal ? ch : (from && p < 0.35 ? from : chars)[Math.floor(Math.random() * (from && p < 0.35 ? from : chars).length)];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(tick);
        else {
          el.textContent = finalText;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });

  $$("[data-scramble]").forEach((el) => {
    const text = el.textContent;
    el.dataset.text = text;
    let busy = false;
    el.addEventListener("pointerenter", async () => {
      if (busy || !finePointer) return;
      busy = true;
      sound.hover();
      await scramble(el, text, { duration: 420 });
      busy = false;
    });
  });

  /* ------------------------------------------------------------
     scene enter / leave animation
     ------------------------------------------------------------ */
  const enterScene = (sec) => {
    if (!hasGsap || !motionOK) return;
    const displays = $$("[data-split]", sec);
    displays.forEach((d) => {
      const chars = splitChars(d);
      gsap.killTweensOf(chars);
      gsap.fromTo(
        chars,
        { yPercent: 105, rotate: 3, opacity: 0 },
        { yPercent: 0, rotate: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: { each: 0.018, from: "start" }, delay: 0.15 }
      );
    });
    const items = $$("[data-stagger] > *", sec);
    if (items.length) {
      gsap.killTweensOf(items);
      gsap.fromTo(items, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", stagger: 0.05, delay: 0.3 });
    }
    $$("[data-scramble-enter]", sec).forEach((el) => scramble(el, el.dataset.text || el.textContent, { duration: 600 }));
  };
  const primeScene = (sec) => {
    if (!hasGsap || !motionOK) return;
    $$("[data-split]", sec).forEach((d) => gsap.set(splitChars(d), { yPercent: 105, opacity: 0 }));
    $$("[data-stagger] > *", sec).forEach((el) => gsap.set(el, { opacity: 0, y: 22 }));
    $$("[data-scramble-enter]", sec).forEach((el) => (el.dataset.text = el.dataset.text || el.textContent));
  };

  /* ------------------------------------------------------------
     scene switching via scroll snap + IntersectionObserver
     ------------------------------------------------------------ */
  const navLinks = $$(".hud-nav a[href^='#']");
  const dots = $$(".dots a");
  const counters = $$("[data-counter], [data-counter-mini]");
  const entered = new Set();

  const sceneById = (n) => scenes.find((s) => Number(s.dataset.scene) === n);
  const setScene = (n, { silent = false } = {}) => {
    const sec = sceneById(n);
    if (!sec) return;
    if (n === sceneIdx && entered.has(n)) return;
    const prev = sceneIdx;
    sceneIdx = n;
    body.setAttribute("data-scene", String(n));
    navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + sec.id));
    dots.forEach((d, i) => d.classList.toggle("is-active", i === n));
    counters.forEach((c) => (c.textContent = String(n).padStart(2, "0")));
    const effect = EFFECTS[sec.dataset.effect] ?? 0;
    if (stage && prev !== n) stage.transition(n, effect);
    if (!entered.has(n)) {
      entered.add(n);
      enterScene(sec);
    }
    if (!silent && prev !== n) sound.tick();
    if (prev !== n && scenes.length > 1) history.replaceState(null, "", "#" + sec.id);
  };

  scenes.forEach((s, i) => i > 0 && primeScene(s));
  sceneIdx = Number(scenes[0]?.dataset.scene || 0);
  /* a scene is "on" when it crosses the vertical midline of the viewport,
     which works for scenes taller than the screen (phones) as well */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) setScene(Number(en.target.dataset.scene));
        });
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
    );
    scenes.forEach((s) => io.observe(s));
  } else {
    scenes.forEach((s) => {
      entered.add(Number(s.dataset.scene));
      enterScene(s);
    });
  }
  window.addEventListener("beforeprint", () => {
    if (hasGsap) gsap.set("[data-split] .char, [data-stagger] > *, .intro-lede, .intro-meta, .intro-ar, .paper", { clearProps: "all" });
  });

  /* keyboard: arrows and j/k step scenes */
  window.addEventListener("keydown", (e) => {
    if (/input|textarea/i.test(document.activeElement.tagName)) return;
    const step = e.key === "ArrowDown" || e.key === "j" || e.key === "PageDown" ? 1 : e.key === "ArrowUp" || e.key === "k" || e.key === "PageUp" ? -1 : 0;
    if (!step) return;
    const cur = scenes.findIndex((sc) => Number(sc.dataset.scene) === sceneIdx);
    const next = scenes[Math.min(scenes.length - 1, Math.max(0, cur + step))];
    if (next) {
      e.preventDefault();
      next.scrollIntoView({ behavior: motionOK ? "smooth" : "auto" });
    }
  });

  /* ------------------------------------------------------------
     00 intro: boot sequence (Arabic glyphs resolve into the name)
     ------------------------------------------------------------ */
  const boot = async () => {
    const lines = $$(".intro-name .line");
    if (!lines.length) {
      html.classList.add("is-ready");
      return;
    }
    const arName = $(".intro-ar");
    const lede = $(".intro-lede");
    const meta = $(".intro-meta");
    const paper = $(".paper");
    if (!hasGsap || !motionOK) {
      html.classList.add("is-ready");
      return;
    }
    const introBits = [lede, meta, paper, arName].filter(Boolean);
    if (introBits.length) gsap.set(introBits, { opacity: 0, y: 16 });
    if (stage) stage.boot();
    await Promise.all(lines.map((l, i) => scramble(l, l.dataset.text || l.textContent, { duration: 1100 + i * 250, from: ARABIC })));
    lines.forEach((l) => splitChars(l));
    const reveal = [arName, lede, meta].filter(Boolean);
    if (reveal.length) gsap.to(reveal, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 });
    if (paper) gsap.to(paper, { opacity: 1, y: 0, duration: 1.1, ease: "power3.out", delay: 0.2 });
    html.classList.add("is-ready");
    entered.add(0);
    sound.chord();
  };
  $$(".intro-name .line").forEach((l) => (l.dataset.text = l.textContent));
  document.fonts.ready.then(boot);
  setScene(sceneIdx, { silent: true });

  /* paper cutout: tilt with the pointer, flip on click */
  const paper = $(".paper");
  if (paper) {
    const card = $(".paper-card", paper);
    if (finePointer && motionOK) {
      window.addEventListener("pointermove", (e) => {
        if (sceneIdx !== 0 || paper.classList.contains("is-flipped")) return;
        const rx = (0.5 - e.clientY / window.innerHeight) * 14;
        const ry = (e.clientX / window.innerWidth - 0.5) * 22;
        card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      });
    }
    const flip = () => {
      paper.classList.toggle("is-flipped");
      if (paper.classList.contains("is-flipped")) card.style.transform = "";
      sound.tick();
    };
    paper.addEventListener("click", flip);
    window.addEventListener("amine:flip", flip);
  }

  /* ------------------------------------------------------------
     01 work: hover a project, the hologram shows it
     ------------------------------------------------------------ */
  const workItems = $$(".work-item");
  const holo = $("[data-holo]");
  if (workItems.length && holo) {
    const d = {
      img: $("[data-holo-img]", holo),
      num: $("[data-detail-num]", holo),
      numLabel: $("[data-detail-numlabel]", holo),
      title: $("[data-detail-title]", holo),
      barTitle: $("[data-holo-title]", holo),
      idx: $("[data-holo-idx]", holo),
      desc: $("[data-detail-desc]", holo),
      meta: $("[data-detail-meta]", holo),
      link: $("[data-detail-link]", holo),
      receipt: $("[data-detail-receipt]", holo),
    };
    workItems.forEach((w) => {
      if (w.dataset.img) {
        const im = new Image();
        im.src = w.dataset.img;
      }
    });
    let current = null;
    const pick = (item) => {
      if (item === current) return;
      current = item;
      workItems.forEach((w) => w.classList.toggle("is-on", w === item));
      const ds = item.dataset;
      if (d.title) d.title.textContent = ds.title;
      if (d.barTitle) d.barTitle.textContent = ds.title;
      if (d.idx) d.idx.textContent = `${String(workItems.indexOf(item) + 1).padStart(2, "0")} / ${String(workItems.length).padStart(2, "0")}`;
      if (d.desc) d.desc.textContent = ds.desc;
      if (d.meta) d.meta.textContent = ds.meta;
      if (d.receipt) d.receipt.textContent = ds.receipt || "";
      if (d.numLabel) d.numLabel.textContent = ds.numlabel || "";
      if (d.num) {
        const n = Number(ds.num);
        if (hasGsap && motionOK && !Number.isNaN(n)) {
          const o = { v: 0 };
          gsap.to(o, { v: n, duration: 0.8, ease: "power2.out", onUpdate: () => (d.num.textContent = Math.round(o.v).toLocaleString("en-US")) });
        } else d.num.textContent = ds.num;
      }
      if (d.link) {
        if (ds.link) {
          d.link.href = ds.link;
          d.link.textContent = ds.linklabel || ds.link;
          d.link.hidden = false;
        } else d.link.hidden = true;
      }
      if (d.img) {
        if (ds.img) {
          d.img.src = ds.img;
          d.img.alt = ds.title + ", screenshot";
          holo.classList.add("has-img");
        } else {
          holo.classList.remove("has-img");
        }
      }
      holo.classList.remove("is-glitch");
      void holo.offsetWidth;
      if (motionOK) holo.classList.add("is-glitch");
      const nameEl = $(".name", item);
      if (nameEl && finePointer) scramble(nameEl, nameEl.dataset.text || nameEl.textContent, { duration: 380 });
      sound.hover();
    };
    workItems.forEach((w) => {
      const nameEl = $(".name", w);
      if (nameEl) nameEl.dataset.text = nameEl.textContent;
      w.addEventListener("pointerenter", () => finePointer && pick(w));
      w.addEventListener("focus", () => pick(w));
      w.addEventListener("click", () => {
        pick(w);
        if (w.dataset.link && finePointer) window.open(w.dataset.link, "_blank", "noopener");
      });
    });
    pick(workItems[0]);
    holo.classList.remove("is-glitch");
    if (finePointer && motionOK) {
      window.addEventListener("pointermove", (e) => {
        if (sceneIdx !== 1) return;
        const r = holo.getBoundingClientRect();
        const cx = (e.clientX - (r.left + r.width / 2)) / Math.max(r.width, 1);
        const cy = (e.clientY - (r.top + r.height / 2)) / Math.max(r.height, 1);
        holo.style.setProperty("--rx", `${(-cy * 9).toFixed(2)}deg`);
        holo.style.setProperty("--ry", `${(cx * 12).toFixed(2)}deg`);
      });
    }
  }

  /* ------------------------------------------------------------
     résumé: floating sheet, in-page PDF viewer, tilt
     ------------------------------------------------------------ */
  const resumeDialog = $("[data-resume-dialog]");
  if (resumeDialog && typeof resumeDialog.showModal === "function") {
    const frame = $("iframe", resumeDialog);
    const open = () => {
      if (frame && !frame.src) frame.src = frame.dataset.src;
      resumeDialog.showModal();
      sound.tick();
    };
    $$("[data-open-resume]").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    }));
    $("[data-resume-close]", resumeDialog)?.addEventListener("click", () => resumeDialog.close());
    resumeDialog.addEventListener("click", (e) => e.target === resumeDialog && resumeDialog.close());
  }
  const sheet = $("[data-sheet]");
  if (sheet && finePointer && motionOK) {
    window.addEventListener("pointermove", (e) => {
      if (sceneIdx !== Number(sheet.dataset.sheet || 6)) return;
      const r = sheet.getBoundingClientRect();
      const cx = (e.clientX - (r.left + r.width / 2)) / Math.max(r.width, 1);
      const cy = (e.clientY - (r.top + r.height / 2)) / Math.max(r.height, 1);
      sheet.style.setProperty("--rx", `${(-cy * 8).toFixed(2)}deg`);
      sheet.style.setProperty("--ry", `${(cx * 10).toFixed(2)}deg`);
    });
  }

  /* ------------------------------------------------------------
     02 experience: tabs
     ------------------------------------------------------------ */
  const xpTabs = $$(".xp-tab");
  if (xpTabs.length) {
    const panels = $$(".xp-panel");
    const pick = (tab) => {
      xpTabs.forEach((t) => t.classList.toggle("is-on", t === tab));
      xpTabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      panels.forEach((p) => p.classList.toggle("is-on", p.dataset.xpPanel === tab.dataset.xp));
      const on = panels.find((p) => p.classList.contains("is-on"));
      if (on && hasGsap && motionOK) gsap.fromTo($$("li, .when", on), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power3.out" });
      sound.hover();
    };
    xpTabs.forEach((t) => {
      t.addEventListener("pointerenter", () => finePointer && pick(t));
      t.addEventListener("click", () => pick(t));
      t.addEventListener("focus", () => pick(t));
    });
  }

  /* ------------------------------------------------------------
     pointer-lit cards, copy button, clock, cursor
     ------------------------------------------------------------ */
  if (finePointer) {
    $$(".repo").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }
  $$("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast("copied · " + b.dataset.copy);
      } catch {
        toast(b.dataset.copy);
      }
    })
  );
  const clock = $("[data-clock]");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Kentucky/Louisville", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const tick = () => (clock.textContent = fmt.format(new Date()) + " louisville");
    tick();
    setInterval(tick, 1000);
  }
  const cursor = $(".cursor");
  if (cursor && finePointer && motionOK) {
    html.classList.add("has-cursor");
    let cx = -100;
    let cy = -100;
    let tx = -100;
    let ty = -100;
    window.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      const hot = e.target.closest("a, button, .work-item, .xp-tab, .paper");
      cursor.classList.toggle("is-link", !!hot);
    });
    window.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
    window.addEventListener("pointerup", () => cursor.classList.remove("is-down"));
    document.addEventListener("mouseleave", () => (cursor.style.opacity = "0"));
    document.addEventListener("mouseenter", () => (cursor.style.opacity = ""));
    const loop = () => {
      cx = lerp(cx, tx, 0.22);
      cy = lerp(cy, ty, 0.22);
      cursor.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  $$("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));

  /* ------------------------------------------------------------
     terminal
     ------------------------------------------------------------ */
  const term = $("[data-terminal]");
  if (term && typeof term.showModal === "function") {
    const scroll = $("[data-term-scroll]", term);
    const input = $("[data-term-input]", term);
    const history = [];
    let historyIdx = -1;
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const print = (h, cls = "line-out") => {
      const p = document.createElement("p");
      p.className = cls;
      p.innerHTML = h;
      scroll.appendChild(p);
      scroll.scrollTop = scroll.scrollHeight;
    };
    const LINK = (href, label) => `<a href="${href}" target="_blank" rel="noreferrer">${label || href}</a>`;
    const go = (id) => {
      const t = $(id);
      if (!t) return `nothing at ${id}`;
      term.close();
      t.scrollIntoView({ behavior: motionOK ? "smooth" : "auto" });
      return null;
    };
    const C = {
      help: () =>
        [
          "available commands:",
          "  whoami      who is this guy",
          "  now         this semester",
          "  work        the systems          scene 1",
          "  receipts    every number, sourced",
          "  community   masjid · msa · dawah  scene 3",
          "  code        public repos          scene 4",
          "  contact     reach me              scene 5",
          "  resume      the one page          scene 6  (pdf for the file)",
          "  scene <n>   jump to a scene",
          "  play        checkers · ttt",
          "  flip        flip the paper me",
          "  sound       toggle the blips",
          "  storm       overload the stage",
          "  arabic      لماذا العربية؟",
          "  sudo hire-me",
          "  clear · exit",
        ].join("\n"),
      whoami: () => "Amine Hamlouchi. CS at the University of Louisville, minor in Arabic.\nProduct engineering intern at Kamel Ride, IT analyst intern at Parker Hannifin,\ntechnical lead at Alnur Mosque, founder of Rumi and Minbar. Louisville, KY.",
      now: () => "→ Kamel Ride · product engineering intern (Aug 2026–)\n→ Parker Hannifin · IT analyst intern (May 2026–)\n→ Alnur Mosque · technical lead, digital operations (2024–)\n→ UofL MSA · executive board (2025–26)",
      work: () => go("#work"),
      community: () => go("#community"),
      code: () => go("#code"),
      contact: () => go("#contact"),
      scene: (a) => {
        const n = Number(a[0]);
        const sec = sceneById(n);
        return sec ? go("#" + sec.id) : "scene 0 … 6";
      },
      receipts: () => {
        // receipts.json is the same file tools/check-receipts.mjs gates the
        // build on, so the terminal and CI can never disagree.
        if (receiptCache) return receiptCache;
        fetch("receipts.json")
          .then((r) => r.json())
          .then((d) => {
            receiptCache = d.receipts
              .map((r) => "  " + r.claim.padEnd(52) + (d.sources[r.source]?.label || r.source) + " \u203a " + r.where)
              .join("\n");
            print(receiptCache);
          })
          .catch(() => print("  receipts.json did not load. it is at /receipts.json"));
        return "reading receipts.json ...";
      },
      play: (a) => {
        const g = (a[0] || "").toLowerCase();
        if (g.startsWith("check")) return (location.href = "checkers.html"), null;
        if (g.startsWith("t")) return (location.href = "tic-tac-toe-3d.html"), null;
        return "play checkers · play ttt";
      },
      flip: () => (window.dispatchEvent(new CustomEvent("amine:flip")), "*paper flip*"),
      sound: () => ($("[data-sound]")?.click(), sound.on ? "sound on" : "sound off"),
      storm: () => (stage ? (stage.storm(), "stage overload, five seconds") : "no stage here"),
      arabic: () => ({ text: "أهلاً وسهلاً! أدرس العربية كتخصص فرعي، ولهذا يسكن شيء من العربية في زوايا هذا الموقع.", cls: "line-out ar" }),
      salaam: () => ({ text: "وعليكم السلام ورحمة الله وبركاته", cls: "line-out ar" }),
      resume: () => go("#resume"),
      pdf: () => "→ " + LINK("assets/amine-hamlouchi-resume.pdf", "amine-hamlouchi-resume.pdf") + '  ·  <a href="resume.html">full text</a>',
      email: () => "email    : " + LINK("mailto:amine@hamlouchi.com", "amine@hamlouchi.com") + "\nphone    : " + LINK("tel:+15026931063", "(502) 693-1063") + "\ngithub   : " + LINK("https://github.com/aminehamlouchi", "github.com/aminehamlouchi") + "\nlinkedin : " + LINK("https://www.linkedin.com/in/aminehamlouchi", "linkedin.com/in/aminehamlouchi"),
      cv: () => "that page is private. if a family is meant to see it, they already have the link.",
      sudo: (a) => (a.join(" ") === "hire-me" ? "[sudo] permission granted.\nforwarding to " + LINK("mailto:amine@hamlouchi.com", "amine@hamlouchi.com") + " ..." : "amine is not in the sudoers file. this incident will be reported."),
      rm: () => "nice try.",
      ls: () => "intro/  work/  experience/  community/  code/  contact/  resume.pdf",
      neofetch: () => ["  أمين      amine@louisville", "  ─────     ────────────────", "  os        hand-built html · no framework · no build step", "  stage     raw webgl · one fragment shader · six worlds", "  shell     amine.sys v3", "  langs     en · ar", "  kernel    speed school cs '28"].join("\n"),
      clear: () => ((scroll.innerHTML = ""), null),
      exit: () => (term.close(), null),
    };
    C.projects = C.work;
    C.repos = C.code;
    C.github = C.code;
    C.msa = C.community;
    C.dawah = C.community;
    C.nikah = C.cv;
    C.mail = C.email;
    C.cv2 = C.resume;
    let receiptCache = null;
    const run = (raw) => {
      const line = raw.trim();
      if (!line) return;
      print(`<span class="user">amine@louisville:~$</span> ${esc(line)}`, "line-cmd");
      history.push(line);
      historyIdx = history.length;
      const [cmd, ...args] = line.toLowerCase().split(/\s+/);
      const h = C[cmd];
      if (!h) return print(`command not found: ${esc(cmd)}. try 'help'`);
      const out = h(args);
      if (out === null || out === undefined) return;
      if (typeof out === "object") print(out.text, out.cls);
      else print(out);
    };
    const open = () => {
      if (term.open) return;
      term.showModal();
      if (!scroll.childElementCount) {
        print("amine.sys v3 · the stage is yours");
        print("type 'help' to look around.");
      }
      input.focus();
    };
    $$("[data-term-open]").forEach((b) => b.addEventListener("click", open));
    $("[data-term-close]", term)?.addEventListener("click", () => term.close());
    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && !term.open && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        open();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        run(input.value);
        input.value = "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIdx > 0) input.value = history[(historyIdx -= 1)] || "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx < history.length) input.value = history[(historyIdx += 1)] || "";
      }
    });
    term.addEventListener("click", (e) => e.target === term && term.close());
  }

  /* ------------------------------------------------------------
     easter eggs
     ------------------------------------------------------------ */
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kIdx = 0;
  window.addEventListener("keydown", (e) => {
    if (/input|textarea/i.test(document.activeElement.tagName)) return;
    kIdx = e.key === KONAMI[kIdx] ? kIdx + 1 : e.key === KONAMI[0] ? 1 : 0;
    if (kIdx === KONAMI.length) {
      kIdx = 0;
      if (stage) stage.storm();
      sound.chord();
      toast("stage overload ✦");
    }
  });
  const brand = $(".hud-brand");
  if (brand) {
    let taps = 0;
    let tapT = 0;
    brand.addEventListener("click", (e) => {
      taps += 1;
      clearTimeout(tapT);
      tapT = setTimeout(() => (taps = 0), 700);
      if (taps === 3) {
        e.preventDefault();
        taps = 0;
        toast("أهلاً وسهلاً · welcome");
      }
    });
  }
})();
