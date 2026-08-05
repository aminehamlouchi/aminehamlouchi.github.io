/* ============================================================
   bust.js — 3D point-cloud portrait
   Reads bust.jpg (color) + bust-depth.jpg (MiDaS depth map)
   and rebuilds Amine as ~18k amber points in real 3D.
   Slow oscillating rotation + cursor parallax.
   Degrades: no WebGL / reduced motion / small screens → skipped
   (the أمين particle field remains the hero visual).
   ============================================================ */

const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
const mount = document.querySelector("[data-bust]");

const supported = () => {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
};

if (mount && window.innerWidth >= 700 && supported()) {
  init().catch(() => {
    /* silent — hero works without the bust */
  });
}

async function init() {
  const THREE = await import("./vendor/three.module.min.js");

  const loadImg = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });

  const [photo, depth] = await Promise.all([
    loadImg("assets/model/bust.jpg"),
    loadImg("assets/model/bust-depth.jpg"),
  ]);

  const readPixels = (img) => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height);
  };

  const px = readPixels(photo);
  const dx = readPixels(depth);
  const W = px.width;
  const H = px.height;

  // ---- build point cloud ----
  const STEP = 3;
  const positions = [];
  const colors = [];
  const starts = [];
  const delays = [];

  const amber = new THREE.Color("#ffb000");
  const deep = new THREE.Color("#4a3410");
  const parchment = new THREE.Color("#ede4d3");
  const tmp = new THREE.Color();

  for (let y = 0; y < H; y += STEP) {
    for (let x = 0; x < W; x += STEP) {
      const i = (y * W + x) * 4;
      const r = px.data[i];
      const g = px.data[i + 1];
      const b = px.data[i + 2];
      const d = dx.data[i] / 255; // MiDaS inverse depth: 1 = close

      // skip background: white studio wall OR far depth
      if (d < 0.32 || (r > 242 && g > 242 && b > 242)) continue;

      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

      // centered plane coords (y flipped)
      const posX = x - W / 2;
      const posY = H / 2 - y;
      // relief: depth carries the bust shape, luminance adds facial detail
      const posZ = (d - 0.55) * 150 + (luma - 0.5) * 14;

      positions.push(posX, posY, posZ);

      // amber ramp by luminance (lifted floor so the face reads), highlights → parchment
      tmp.copy(deep).lerp(amber, 0.15 + 0.85 * Math.pow(luma, 0.72));
      if (luma > 0.78) tmp.lerp(parchment, (luma - 0.78) / 0.22);
      colors.push(tmp.r, tmp.g, tmp.b);

      // scattered spawn position for the assembly entrance
      const a = Math.random() * Math.PI * 2;
      const rad = 260 + Math.random() * 320;
      starts.push(Math.cos(a) * rad, (Math.random() - 0.5) * 640, Math.sin(a) * rad - 120);
      delays.push(Math.random() * 0.5);
    }
  }

  const count = positions.length / 3;
  const geo = new THREE.BufferGeometry();
  const posAttr = new Float32Array(motionOK ? starts : positions);
  geo.setAttribute("position", new THREE.BufferAttribute(posAttr, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 3.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  group.add(points);

  // ---- scene ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 10, 3000);
  camera.position.z = 1150;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  mount.appendChild(renderer.domElement);
  scene.add(group);

  const size = () => {
    const r = mount.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    // fit the ~H-tall cloud into view
    camera.position.z = (H * 0.62) / Math.tan((camera.fov * Math.PI) / 360);
    camera.updateProjectionMatrix();
  };
  size();
  window.addEventListener("resize", size);

  // ---- interaction ----
  const target = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  if (!motionOK) {
    group.rotation.y = 0.22;
    renderer.render(scene, camera);
    return;
  }

  // ---- animate ----
  let running = true;
  let t0 = performance.now();
  const pos = geo.attributes.position.array;

  const tick = (now) => {
    if (!running) return;
    const t = (now - t0) / 1000;

    // assembly: scattered → portrait
    if (t < 2.6) {
      for (let i = 0; i < count; i++) {
        const k = Math.min(Math.max((t - delays[i]) / 1.9, 0), 1);
        const e = 1 - Math.pow(1 - k, 4); // ease-out quart
        const i3 = i * 3;
        pos[i3] = starts[i3] + (positions[i3] - starts[i3]) * e;
        pos[i3 + 1] = starts[i3 + 1] + (positions[i3 + 1] - starts[i3 + 1]) * e;
        pos[i3 + 2] = starts[i3 + 2] + (positions[i3 + 2] - starts[i3 + 2]) * e;
      }
      geo.attributes.position.needsUpdate = true;
    }

    // slow oscillating turn + cursor-follow
    group.rotation.y += ((Math.sin(t * 0.32) * 0.42 + target.x * 0.3) - group.rotation.y) * 0.05;
    group.rotation.x += ((Math.sin(t * 0.21) * 0.05 + target.y * 0.12) - group.rotation.x) * 0.05;
    group.position.y = Math.sin(t * 0.5) * 7;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // pause when hidden / offscreen
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) {
      running = true;
      t0 = performance.now() - 10_000; // skip re-assembly
      requestAnimationFrame(tick);
    } else if (!entry.isIntersecting) {
      running = false;
    }
  });
  io.observe(mount);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      t0 = performance.now() - 10_000;
      requestAnimationFrame(tick);
    }
  });
}
