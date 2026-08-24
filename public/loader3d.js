import * as THREE from "./vendor/three.module.min.js";

/*
 * Original lightweight WebGL scene for YPi's loading state.
 * It uses a faceted media core, orbit rings and a four-blade spinner rather
 * than buffering any downloaded media in the browser or server.
 */

const root = document.getElementById("loaderWorld");
let renderer;
let scene;
let camera;
let stage;
let core;
let fan;
let outerRing;
let innerRing;
let particles;
let frame = 0;
let active = false;
let initialized = false;
let last = 0;
let resizeObserver;
let palette = { background: 0x101010, object: 0xf2f2ee, accent: 0xd8ffb8 };

function readPalette() {
  const light = document.documentElement.classList.contains("light");
  palette = light
    ? { background: 0xf6f6f2, object: 0x202020, accent: 0x4f8525 }
    : { background: 0x101010, object: 0xf2f2ee, accent: 0xd8ffb8 };
}

function makeFan() {
  const group = new THREE.Group();
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 18, 12),
    new THREE.MeshStandardMaterial({ color: palette.object, roughness: 0.48, metalness: 0.16 })
  );
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: palette.accent,
    roughness: 0.42,
    metalness: 0.1,
    flatShading: true,
  });
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(12, 44, 5), bladeMaterial);
    const angle = (Math.PI / 2) * i;
    blade.position.set(Math.sin(angle) * 24, Math.cos(angle) * 24, 0);
    blade.rotation.z = -angle + 0.48;
    group.add(blade);
  }
  group.scale.setScalar(0.62);
  return group;
}

function makeParticles() {
  const count = 80;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 58 + Math.random() * 95;
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 125;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius * 0.35;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: palette.accent, size: 1.7, transparent: true, opacity: 0.62 })
  );
}

function init() {
  if (!root || initialized) return initialized;
  try {
    readPalette();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 1, 1000);
    camera.position.set(0, 18, 210);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, palette.background, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(80, 110, 150);
    scene.add(key);
    const fill = new THREE.DirectionalLight(palette.accent, 1.25);
    fill.position.set(-95, 20, 90);
    scene.add(fill);

    stage = new THREE.Group();
    scene.add(stage);

    core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(30, 1),
      new THREE.MeshStandardMaterial({
        color: palette.object,
        roughness: 0.35,
        metalness: 0.22,
        flatShading: true,
      })
    );
    stage.add(core);

    outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(50, 1.15, 8, 48),
      new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.36, metalness: 0.18 })
    );
    outerRing.rotation.x = 1.08;
    outerRing.rotation.y = -0.2;
    stage.add(outerRing);

    innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(39, 0.85, 8, 42),
      new THREE.MeshStandardMaterial({ color: palette.object, roughness: 0.52, metalness: 0.08 })
    );
    innerRing.rotation.x = -0.64;
    innerRing.rotation.z = 0.34;
    stage.add(innerRing);

    fan = makeFan();
    fan.position.z = 39;
    stage.add(fan);

    particles = makeParticles();
    stage.add(particles);

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();
    initialized = true;
    return true;
  } catch {
    root?.classList.add("webgl-unavailable");
    return false;
  }
}

function resize() {
  if (!renderer || !camera || !root) return;
  const width = Math.max(1, root.clientWidth);
  const height = Math.max(1, root.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function draw(now) {
  if (!active || !renderer || !scene || !camera) return;
  const elapsed = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;

  core.rotation.x += elapsed * 0.42;
  core.rotation.y += elapsed * 0.68;
  fan.rotation.z -= elapsed * 5.7;
  outerRing.rotation.z += elapsed * 0.34;
  innerRing.rotation.y -= elapsed * 0.46;
  particles.rotation.y += elapsed * 0.07;
  stage.rotation.y = Math.sin(now * 0.00055) * 0.18;
  stage.position.y = Math.sin(now * 0.0013) * 4;

  renderer.render(scene, camera);
  frame = requestAnimationFrame(draw);
}

function recolor(material, color) {
  if (!material?.color) return;
  material.color.setHex(color);
  material.needsUpdate = true;
}

function setTheme() {
  readPalette();
  if (!initialized) return;
  recolor(core.material, palette.object);
  recolor(fan.children[0]?.material, palette.object);
  fan.children.slice(1).forEach((blade) => recolor(blade.material, palette.accent));
  recolor(outerRing.material, palette.accent);
  recolor(innerRing.material, palette.object);
  particles.material.color.setHex(palette.accent);
}

window.YPi3DLoader = {
  start() {
    if (!init() || active) return;
    active = true;
    last = performance.now();
    frame = requestAnimationFrame(draw);
  },
  stop() {
    active = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  },
  setTheme,
};
