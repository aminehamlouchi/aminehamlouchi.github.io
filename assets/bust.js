/* ============================================================
   bust.js — 3D model on a spotlight display
   Loads assets/model/amine.glb (generated locally with TripoSR
   from a headshot) and presents it like a game-character select:
   pedestal, warm spotlight, slow turntable spin, cursor parallax.
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
    /* silent — hero works without the display */
  });
}

async function init() {
  const THREE = await import("three");
  const { GLTFLoader } = await import("./vendor/GLTFLoader.js");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  camera.position.set(0, 0.3, 4.4);
  camera.lookAt(0, -0.05, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.style.opacity = "0";
  renderer.domElement.style.transition = "opacity 1200ms ease";
  mount.appendChild(renderer.domElement);

  /* ---------- lighting: museum spotlight ---------- */
  scene.add(new THREE.AmbientLight(0x8a7a5f, 0.55));

  const spot = new THREE.SpotLight(0xfff0d2, 60);
  spot.position.set(0.6, 3.4, 1.6);
  spot.angle = 0.42;
  spot.penumbra = 0.65;
  spot.decay = 1.6;
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  scene.add(spot);

  // amber rim from behind-left, ties into the site palette
  const rim = new THREE.PointLight(0xffb000, 14, 8, 2);
  rim.position.set(-1.6, 1.1, -1.4);
  scene.add(rim);

  // soft cool fill so shadows aren't pitch black
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5);
  fill.position.set(1.4, 0.6, 2.2);
  scene.add(fill);

  /* ---------- pedestal ---------- */
  const stage = new THREE.Group();
  scene.add(stage);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.66, 0.14, 64),
    new THREE.MeshStandardMaterial({ color: 0x16130c, roughness: 0.55, metalness: 0.35 })
  );
  pedestal.position.y = -0.82;
  pedestal.receiveShadow = true;
  stage.add(pedestal);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.01, 12, 96),
    new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.745;
  stage.add(ring);

  // faint light cone (fake volumetrics, additive)
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 3.2, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe9b8,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  cone.position.set(0.28, 1.1, 0.75);
  cone.lookAt(spot.position);
  cone.rotateX(Math.PI / 2);
  scene.add(cone);

  /* ---------- the model ---------- */
  const turntable = new THREE.Group();
  stage.add(turntable);

  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load("assets/model/amine.glb", resolve, undefined, reject);
  });

  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const scale = 1.15 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(scale);
  model.position.y = -0.75 + (size.y * scale) / 2; // stand on the pedestal
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      if (o.material) {
        o.material.roughness = 0.85;
        o.material.metalness = 0.0;
      }
    }
  });
  turntable.add(model);

  /* ---------- sizing ---------- */
  const sizeCanvas = () => {
    const r = mount.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  };
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  /* ---------- interaction ---------- */
  const pointer = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  renderer.domElement.style.opacity = "1";

  if (!motionOK) {
    turntable.rotation.y = 0.35;
    renderer.render(scene, camera);
    return;
  }

  /* ---------- animate: slow turntable under the spotlight ---------- */
  let running = true;
  let last = performance.now();

  const tick = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    turntable.rotation.y += dt * 0.55; // one lap ~11.4s
    stage.position.y = Math.sin(now / 1400) * 0.02;

    // gentle parallax: camera drifts toward the cursor
    camera.position.x += (pointer.x * 0.35 - camera.position.x) * 0.04;
    camera.position.y += (0.3 - pointer.y * 0.18 - camera.position.y) * 0.04;
    camera.lookAt(0, -0.05, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  /* ---------- lifecycle ---------- */
  const resume = () => {
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
  };
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) resume();
    else running = false;
  });
  io.observe(mount);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else resume();
  });
}
