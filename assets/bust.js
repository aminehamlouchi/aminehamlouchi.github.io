/* ============================================================
   bust.js — Paper Amine
   A Paper-Mario-style cutout of the real headshot (sticker
   border baked into assets/model/paper-amine.png) standing on
   a pedestal. It bobs, sways, leans toward the cursor, and does
   the classic paper flip when you cross sides. The spotlight
   mimics the mouse: beam, light, and pool all track the cursor.
   Degrades: no WebGL / reduced motion / small screens → skipped.
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
    /* silent — hero works without the stage */
  });
}

async function init() {
  const THREE = await import("three");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  camera.position.set(0, 0.3, 4.4);
  camera.lookAt(0, -0.05, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.opacity = "0";
  renderer.domElement.style.transition = "opacity 900ms ease";
  mount.appendChild(renderer.domElement);

  /* ---------- lights ---------- */
  scene.add(new THREE.AmbientLight(0x9a8a68, 0.75));

  const LAMP = new THREE.Vector3(0.5, 3.3, 1.5);

  const spot = new THREE.SpotLight(0xfff0d2, 70);
  spot.position.copy(LAMP);
  spot.angle = 0.4;
  spot.penumbra = 0.55;
  spot.decay = 1.6;
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  scene.add(spot);
  scene.add(spot.target);

  const rimLight = new THREE.PointLight(0xffb000, 10, 8, 2);
  rimLight.position.set(-1.6, 1.0, -1.2);
  scene.add(rimLight);

  /* ---------- pedestal ---------- */
  const stage = new THREE.Group();
  scene.add(stage);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.6, 0.13, 64),
    new THREE.MeshStandardMaterial({ color: 0x16130c, roughness: 0.55, metalness: 0.35 })
  );
  pedestal.position.y = -0.78;
  pedestal.receiveShadow = true;
  stage.add(pedestal);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.009, 12, 96),
    new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.71;
  stage.add(ring);

  /* ---------- visible beam that tracks the cursor ---------- */
  const BEAM_LEN = 4.6;
  const beamGroup = new THREE.Group();
  beamGroup.position.copy(LAMP);
  scene.add(beamGroup);

  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, BEAM_LEN, 40, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe9b8,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beam.rotation.x = -Math.PI / 2; // tip at group origin, opens along +Z
  beam.position.z = BEAM_LEN / 2;
  beamGroup.add(beam);

  /* ---------- the paper character ---------- */
  const texture = await new Promise((resolve, reject) => {
    new THREE.TextureLoader().load("assets/model/paper-amine.png", resolve, undefined, reject);
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const ASPECT = texture.image.width / texture.image.height;
  const PAPER_H = 1.08;
  const PAPER_W = PAPER_H * ASPECT;

  const paperMat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.35,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const paper = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_W, PAPER_H), paperMat);
  paper.castShadow = true;
  paper.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: texture,
    alphaTest: 0.35,
  });

  const character = new THREE.Group(); // handles flip + lean
  character.add(paper);
  const rig = new THREE.Group(); // handles bob + entrance
  rig.position.y = -0.715 + PAPER_H / 2;
  rig.add(character);
  stage.add(rig);

  /* ---------- sizing ---------- */
  const sizeCanvas = () => {
    const r = mount.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  };
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  /* ---------- pointer ---------- */
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

  const spotTarget = new THREE.Vector3(0, -0.2, 0.3);
  const aimBeam = () => {
    spot.target.position.copy(spotTarget);
    beamGroup.lookAt(spotTarget);
  };

  if (!motionOK) {
    aimBeam();
    renderer.render(scene, camera);
    return;
  }

  /* ---------- animate ---------- */
  let running = true;
  let flipTarget = 0; // multiples of PI
  let lastSide = 0;
  const start = performance.now();

  const tick = (now) => {
    if (!running) return;
    const t = (now - start) / 1000;

    // entrance: paper pops up with a bit of overshoot
    const e = Math.min(t / 0.9, 1);
    const pop = 1 - Math.pow(1 - e, 3);
    const overshoot = e < 1 ? 1 + Math.sin(e * Math.PI) * 0.06 : 1;
    rig.scale.setScalar(pop * overshoot);

    // idle: bob + sway, like a standee catching a breeze
    rig.position.y = -0.715 + PAPER_H / 2 + Math.sin(t * 2.1) * 0.025;
    character.rotation.z = Math.sin(t * 1.3) * 0.03;

    // classic paper flip when the cursor crosses the middle
    const side = pointer.x > 0.08 ? 1 : pointer.x < -0.08 ? -1 : lastSide;
    if (side !== 0 && lastSide !== 0 && side !== lastSide) flipTarget += Math.PI;
    if (side !== 0) lastSide = side;

    const lean = pointer.x * 0.22; // subtle turn toward the cursor
    character.rotation.y += (flipTarget + lean - character.rotation.y) * 0.14;

    // the spotlight mimics the mouse
    spotTarget.x += (pointer.x * 1.5 - spotTarget.x) * 0.1;
    spotTarget.y += (-0.2 - pointer.y * 0.9 - spotTarget.y) * 0.1;
    aimBeam();

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  /* ---------- lifecycle ---------- */
  const resume = () => {
    if (!running) {
      running = true;
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
