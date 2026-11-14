import * as THREE from '../vendor/three.module.js';

/** Original TerraMatch hardware. Units are visual metres, forward is -Z. */
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function material(color, roughness = 0.55, metalness = 0.35, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, mat);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function bevelBox(width, height, depth, radius = 0.045) {
  const shape = new THREE.Shape();
  const x = -width / 2 + radius;
  const y = -height / 2 + radius;
  shape.moveTo(x, y);
  shape.lineTo(-x, y);
  shape.lineTo(-x, -y);
  shape.lineTo(x, -y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * radius),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: radius,
    bevelThickness: radius,
    curveSegments: 2,
  });
  geometry.center();
  return geometry;
}

function strut(parent, start, end, radius, mat, segments = 10) {
  const result = mesh(new THREE.CylinderGeometry(radius, radius, 1, segments), mat, parent);
  positionLink(result, start, end);
  return result;
}

function positionLink(object, start, end) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const length = Math.max(delta.length(), 0.0001);
  object.position.copy(start).addScaledVector(delta, 0.5);
  object.quaternion.setFromUnitVectors(UP, delta.divideScalar(length));
  object.scale.y = length;
}

function cylinderAlongZ(parent, radius, length, mat, x, y, z) {
  const result = mesh(new THREE.CylinderGeometry(radius, radius, length, 20), mat, parent, x, y, z);
  result.rotation.x = Math.PI / 2;
  return result;
}

function bolt(parent, mat, x, y, z) {
  const result = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.017, 6), mat, parent, x, y, z);
  result.rotation.x = Math.PI / 2;
  return result;
}

/**
 * Six-legged, original visual explorer; not a validated locomotion simulator.
 * Set root.position to world ground height. Call root.userData.update each frame.
 * update(dt, elapsedSeconds, moving, worldHeightSampler) grounds every foot.
 * worldHeightSampler(worldX, worldZ) returns worldY in the renderer's coordinates.
 */
export function createHexapod() {
  const root = new THREE.Group();
  root.name = 'TerraMatch Hexapod';
  const ivory = material(0xd7d7ca, 0.48, 0.48);
  const orange = material(0xe2742d, 0.4, 0.4);
  const dark = material(0x17202b, 0.52, 0.68);
  const hinge = material(0x343b42, 0.35, 0.85);
  const silver = material(0xa4afb4, 0.25, 0.95);
  const rubber = material(0x171a1e, 0.92, 0.1);
  const lens = material(0x174f83, 0.16, 0.65, { emissive: 0x147bda, emissiveIntensity: 0.8 });
  const whiteLight = material(0xc9ebff, 0.2, 0.3, { emissive: 0xbfe9ff, emissiveIntensity: 1.2 });
  const body = new THREE.Group();
  root.add(body);

  mesh(bevelBox(1.36, 0.48, 2.16, 0.075), ivory, body, 0, 1.17, 0);
  mesh(bevelBox(1.44, 0.2, 2.22, 0.045), dark, body, 0, 0.94, 0);
  const shell = mesh(bevelBox(1.27, 0.2, 1.96, 0.065), orange, body, 0, 1.49, 0.05);
  shell.rotation.x = -0.025;
  mesh(bevelBox(0.54, 0.035, 1.52, 0.012), ivory, body, 0, 1.615, 0.08);
  for (const z of [-0.54, -0.32, -0.1, 0.12, 0.34, 0.56]) {
    mesh(new THREE.BoxGeometry(0.55, 0.012, 0.035), dark, body, 0, 1.642, z);
  }
  for (const side of [-1, 1]) {
    for (const z of [-0.72, -0.36, 0, 0.36, 0.72]) {
      mesh(new THREE.BoxGeometry(0.012, 0.18, 0.09), dark, body, side * 0.69, 1.18, z);
    }
    mesh(new THREE.BoxGeometry(0.028, 0.04, 1.48), orange, body, side * 0.72, 1.04, 0);
    cylinderAlongZ(body, 0.085, 0.08, whiteLight, side * 0.46, 1.17, -1.105);
    cylinderAlongZ(body, 0.055, 0.07, lens, side * 0.24, 1.2, -1.11);
    for (const z of [-0.91, 0.91]) bolt(body, dark, side * 0.5, 1.34, z);
  }
  mesh(bevelBox(0.9, 0.14, 0.15, 0.025), dark, body, 0, 0.89, -1.14);
  mesh(bevelBox(0.95, 0.14, 0.13, 0.025), dark, body, 0, 0.89, 1.14);
  const mast = new THREE.Group();
  mast.position.set(0, 1.58, -0.3);
  body.add(mast);
  mesh(new THREE.CylinderGeometry(0.048, 0.065, 0.46, 12), silver, mast, 0, 0.22, 0);
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), dark, mast, 0, 0.46, 0);
  const head = new THREE.Group();
  head.position.y = 0.58;
  mast.add(head);
  mesh(bevelBox(0.47, 0.24, 0.27, 0.04), ivory, head);
  mesh(bevelBox(0.4, 0.17, 0.035, 0.012), dark, head, 0, 0, -0.145);
  cylinderAlongZ(head, 0.065, 0.025, lens, -0.095, 0, -0.175);
  cylinderAlongZ(head, 0.045, 0.025, lens, 0.095, 0, -0.175);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), dark, body, 0.48, 1.75, 0.82);

  const legs = [];
  for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
    const side = sideIndex ? 1 : -1;
    for (let index = 0; index < 3; index++) {
      const z = (index - 1) * 0.77;
      const leg = new THREE.Group();
      leg.name = `Leg ${side < 0 ? 'left' : 'right'} ${index + 1}`;
      root.add(leg);
      const upper = mesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 6), ivory, leg);
      const upperInset = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), dark, leg);
      const lower = mesh(new THREE.CylinderGeometry(0.085, 0.12, 1, 6), ivory, leg);
      const piston = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), silver, leg);
      const hipJoint = mesh(new THREE.SphereGeometry(0.16, 12, 8), hinge, leg);
      const kneeJoint = mesh(new THREE.SphereGeometry(0.145, 12, 8), hinge, leg);
      const ankleJoint = mesh(new THREE.SphereGeometry(0.08, 10, 6), hinge, leg);
      const foot = mesh(bevelBox(0.3, 0.075, 0.36, 0.02), rubber, leg);
      const ankle = mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.13, 8), dark, leg);
      const hip = new THREE.Vector3(side * 0.69, 1.06, z);
      const neutral = new THREE.Vector3(side * (index === 1 ? 1.8 : 1.62), 0.055, z * 1.32);
      legs.push({ side, index, hip, neutral, upper, upperInset, lower, piston, hipJoint, kneeJoint, ankleJoint, foot, ankle,
        phase: ((index + sideIndex) % 2) * Math.PI, footPosition: neutral.clone() });
    }
  }
  let gait = 0;
  let walkingSet = false;
  let stanceWidth = 1;
  const worldPoint = new THREE.Vector3();
  const localGround = new THREE.Vector3();
  const hip = new THREE.Vector3();
  const foot = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const bend = new THREE.Vector3();
  const knee = new THREE.Vector3();

  function update(dt = 0.016, elapsed = 0, moving = walkingSet, heightSampler) {
    const movement = typeof moving === 'number' ? clamp(Math.abs(moving), 0, 1.8) : moving ? 1 : 0;
    gait += clamp(dt, 0, 0.08) * (movement ? 6.4 * Math.max(0.45, movement) : 0);
    const bob = movement ? Math.sin(gait * 2) * 0.026 : Math.sin(elapsed * 1.4) * 0.006;
    body.position.y = bob;
    body.rotation.z = movement ? Math.sin(gait) * 0.018 : 0;
    head.rotation.y = Math.sin(elapsed * 0.35) * 0.12;
    root.updateWorldMatrix(true, false);
    for (const leg of legs) {
      const phase = gait + leg.phase;
      foot.copy(leg.neutral);
      foot.x = leg.side * (0.78 + (Math.abs(leg.neutral.x) - 0.78) * stanceWidth);
      if (movement) {
        foot.z += Math.cos(phase) * 0.36;
        foot.y += Math.max(0, Math.sin(phase)) * 0.29;
        foot.x += leg.side * Math.max(0, Math.sin(phase)) * 0.045;
      }
      if (heightSampler) {
        worldPoint.copy(foot).applyMatrix4(root.matrixWorld);
        const sampled = heightSampler(worldPoint.x, worldPoint.z);
        if (Number.isFinite(sampled)) {
          localGround.copy(worldPoint);
          localGround.y = sampled;
          root.worldToLocal(localGround);
          foot.y += clamp(localGround.y, -0.62, 0.62);
        }
      }
      hip.copy(leg.hip);
      hip.y += bob;
      delta.subVectors(foot, hip);
      const rawDistance = delta.length();
      const distance = clamp(rawDistance, 0.24, 1.92);
      delta.divideScalar(rawDistance || 1);
      const a = (0.98 ** 2 - 1.08 ** 2 + distance ** 2) / (2 * distance);
      const h = Math.sqrt(Math.max(0, 0.98 ** 2 - a ** 2));
      bend.set(leg.side * stanceWidth, 0.8 * stanceWidth, (1 - stanceWidth) * (leg.index === 2 ? -1 : 1));
      bend.addScaledVector(delta, -bend.dot(delta)).normalize();
      knee.copy(hip).addScaledVector(delta, a).addScaledVector(bend, h);
      positionLink(leg.upper, hip, knee);
      positionLink(leg.upperInset, hip, knee);
      leg.upperInset.position.z += 0.065;
      positionLink(leg.lower, knee, foot);
      positionLink(leg.piston, knee, foot);
      leg.piston.position.x += leg.side * 0.09;
      leg.hipJoint.position.copy(hip);
      leg.kneeJoint.position.copy(knee);
      leg.ankleJoint.position.copy(foot).add(new THREE.Vector3(0, 0.1, 0));
      leg.foot.position.copy(foot);
      leg.ankle.position.copy(foot).add(new THREE.Vector3(0, 0.08, 0));
      leg.footPosition.copy(foot);
    }
  }
  root.userData.update = update;
  root.userData.animate = ({ time = 0, walking = false, speed = 1, terrainHeight, dt = 0.016 } = {}) => update(dt, time, walking ? speed : 0, terrainHeight);
  root.userData.setWalking = (value) => { walkingSet = !!value; };
  root.userData.setStance = (value) => { stanceWidth = clamp(value, 0, 1); };
  root.userData.legs = legs;
  root.userData.body = body;
  root.userData.head = head;
  root.userData.forward = '-Z';
  root.userData.footCount = 6;
  root.userData.modelCredit = 'Original procedural TerraMatch hexapod';
  update(0, 0, false);
  return root;
}

/** Original cargo lander. setDeployment opens the visible hatch then lowers ramp. */
export function createRocket() {
  const root = new THREE.Group();
  root.name = 'TerraMatch cargo lander';
  const ivory = material(0xd6d5c8, 0.5, 0.62);
  const dark = material(0x20242a, 0.56, 0.75);
  const orange = material(0xd76c2a, 0.49, 0.45);
  const silver = material(0x9da6a8, 0.33, 0.88);
  const interior = material(0x30322f, 0.83, 0.4);
  const lamp = material(0xffd795, 0.3, 0.2, { emissive: 0xffbb66, emissiveIntensity: 1.8 });
  const wallMat = ivory.clone(); wallMat.side = THREE.DoubleSide;
  const wedge = 0.68;

  mesh(new THREE.CylinderGeometry(1.46, 1.72, 3.4, 48, 1, true, Math.PI + wedge, TAU - 2 * wedge), wallMat, root, 0, 2.88, 0);
  mesh(new THREE.CylinderGeometry(1.41, 1.67, 3.4, 48, 1, true, Math.PI + wedge, TAU - 2 * wedge), interior, root, 0, 2.88, 0);
  mesh(new THREE.CylinderGeometry(1.16, 1.47, 3.35, 48), ivory, root, 0, 6.25, 0);
  mesh(new THREE.CylinderGeometry(1.435, 1.48, 0.43, 48), orange, root, 0, 4.83, 0);
  mesh(new THREE.CylinderGeometry(1.32, 1.345, 0.065, 48), silver, root, 0, 6.15, 0);
  mesh(new THREE.CylinderGeometry(1.18, 1.2, 0.065, 48), silver, root, 0, 7.68, 0);
  const nosePoints = [new THREE.Vector2(1.16, 7.925), new THREE.Vector2(1.03, 8.8), new THREE.Vector2(0.83, 9.7), new THREE.Vector2(0.49, 10.8), new THREE.Vector2(0.1, 11.75), new THREE.Vector2(0, 11.9)];
  mesh(new THREE.LatheGeometry(nosePoints, 48), dark, root);
  mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.16, 48), interior, root, 0, 1.16, 0);
  mesh(new THREE.CylinderGeometry(1.46, 1.46, 0.12, 48), interior, root, 0, 4.48, 0);
  mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.12, 48), silver, root, 0, 1.04, 0);

  // Thin metallic bands and service panels make the silhouette read as hardware.
  for (const y of [1.5, 2.35, 3.25, 4.2, 5.4, 6.8, 7.4]) {
    const radius = y < 4.5 ? THREE.MathUtils.lerp(1.72, 1.46, (y - 1.18) / 3.4) : THREE.MathUtils.lerp(1.47, 1.16, (y - 4.575) / 3.35);
    const geometry = new THREE.CylinderGeometry(radius + 0.008, radius + 0.008, 0.018, 48, 1, true, Math.PI + wedge, TAU - 2 * wedge);
    mesh(geometry, silver, root, 0, y, 0);
  }
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.1, 3.35, 0.13), silver, root, side * 1.025, 2.87, -1.25);
    mesh(new THREE.BoxGeometry(0.95, 0.12, 0.12), silver, root, side * 0.54, 4.49, -1.42);
    for (const y of [5.65, 6.55]) {
      const panel = mesh(bevelBox(0.28, 0.45, 0.04, 0.018), dark, root, side * 0.56, y, -1.23);
      panel.rotation.y = side * -0.3;
    }
    for (const y of [1.75, 2.35, 2.95, 3.55, 4.15]) {
      bolt(root, silver, side * 1.09, y, -1.29);
    }
  }
  // Interior cargo racks, ribs, floor slats and warm payload lights.
  for (const side of [-1, 1]) {
    for (const z of [-0.55, 0.12, 0.8]) {
      mesh(new THREE.BoxGeometry(0.07, 2.5, 0.07), silver, root, side * 1.05, 2.6, z);
    }
    mesh(new THREE.BoxGeometry(0.8, 0.04, 0.08), lamp, root, side * 0.48, 4.3, -0.65);
    mesh(new THREE.BoxGeometry(0.06, 0.8, 0.08), lamp, root, side * 1.02, 3.6, -0.98);
  }
  for (const x of [-0.85, -0.42, 0, 0.42, 0.85]) {
    mesh(new THREE.BoxGeometry(0.035, 0.02, 2.35), silver, root, x, 1.25, -0.1);
  }
  for (const side of [-1, 1]) {
    mesh(bevelBox(0.66, 0.8, 0.62, 0.04), interior, root, side * 0.64, 1.7, 0.65);
    mesh(new THREE.BoxGeometry(0.03, 0.74, 0.64), silver, root, side * 0.64, 1.7, 0.65);
  }
  const doorPivot = new THREE.Group();
  doorPivot.position.set(0, 4.47, -1.37);
  root.add(doorPivot);
  mesh(bevelBox(2.02, 3.3, 0.17, 0.035), ivory, doorPivot, 0, -1.65, 0);
  mesh(new THREE.BoxGeometry(1.87, 3.13, 0.05), interior, doorPivot, 0, -1.65, 0.11);
  for (const y of [-0.38, -1.02, -1.66, -2.3, -2.94]) {
    mesh(new THREE.BoxGeometry(1.8, 0.05, 0.12), silver, doorPivot, 0, y, 0.15);
  }
  const doorStruts = [-1, 1].map(side => strut(root, new THREE.Vector3(side * 1.05, 3.5, -1.33), new THREE.Vector3(side * 1.0, 3.0, -1.44), 0.035, silver));
  const rampPivot = new THREE.Group();
  rampPivot.position.set(0, 1.24, -1.35);
  root.add(rampPivot);
  mesh(new THREE.BoxGeometry(1.9, 0.085, 4.15), silver, rampPivot, 0, 0, -2.075);
  mesh(new THREE.BoxGeometry(1.71, 0.035, 4.04), interior, rampPivot, 0, 0.06, -2.075);
  for (let z = 0.12; z < 4.12; z += 0.22) {
    mesh(new THREE.BoxGeometry(1.65, 0.026, 0.045), silver, rampPivot, 0, 0.09, -z);
  }
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.08, 0.2, 4.15), ivory, rampPivot, side * 0.95, 0.08, -2.075);
    mesh(new THREE.BoxGeometry(0.02, 0.035, 4.0), orange, rampPivot, side * 0.9, 0.19, -2.075);
  }
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const sx = Math.sin(angle), sz = Math.cos(angle);
    const mount = new THREE.Vector3(sx * 1.46, 2.7, sz * 1.46);
    const knee = new THREE.Vector3(sx * 2.2, 1.3, sz * 2.2);
    const pad = new THREE.Vector3(sx * 2.9, 0.16, sz * 2.9);
    strut(root, mount, knee, 0.125, ivory);
    strut(root, knee, pad, 0.1, silver);
    strut(root, new THREE.Vector3(sx * 1.56, 1.25, sz * 1.56), pad, 0.055, silver);
    mesh(new THREE.SphereGeometry(0.17, 12, 8), dark, root, knee.x, knee.y, knee.z);
    mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.13, 12), dark, root, pad.x, 0.075, pad.z);
    mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.08, 12), silver, root, pad.x, 0.18, pad.z);
  }
  const flames = new THREE.Group();
  root.add(flames);
  const flameOrange = new THREE.MeshBasicMaterial({ color: 0xff7c27, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
  const flameBlue = new THREE.MeshBasicMaterial({ color: 0xa5deff, transparent: true, opacity: 0.8, depthWrite: false });
  for (const x of [-0.55, 0.55]) {
    const nozzle = mesh(new THREE.CylinderGeometry(0.19, 0.4, 0.55, 20, 1, true), dark, root, x, 0.68, 0);
    const outer = mesh(new THREE.ConeGeometry(0.38, 3.2, 24, 1, true), flameOrange, flames, x, -1.2, 0);
    outer.rotation.z = Math.PI;
    const inner = mesh(new THREE.ConeGeometry(0.17, 1.55, 20), flameBlue, flames, x, -0.4, 0);
    inner.rotation.z = Math.PI;
  }
  flames.visible = false;
  root.userData.setThrust = level => { flames.visible = level > 0.001; flames.scale.y = clamp(level, 0.05, 2); };
  root.userData.setDeployment = progress => {
    const door = ease(progress / 0.62);
    const ramp = ease((progress - 0.3) / 0.7);
    doorPivot.rotation.x = door * Math.PI * 0.51;
    rampPivot.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, -0.285, ramp);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const end = new THREE.Vector3(side, -1.35, 0.14).applyAxisAngle(new THREE.Vector3(1, 0, 0), doorPivot.rotation.x).add(doorPivot.position);
      positionLink(doorStruts[i], new THREE.Vector3(side * 1.05, 3.5, -1.33), end);
    }
    root.userData.deployment = clamp(progress, 0, 1);
  };
  root.userData.doorPivot = doorPivot;
  root.userData.rampPivot = rampPivot;
  root.userData.flames = flames;
  root.userData.rampLength = 4.15;
  root.userData.rampHeight = 1.24;
  root.userData.forward = '-Z';
  root.userData.modelCredit = 'Original procedural TerraMatch cargo lander';
  root.userData.setDeployment(0);
  return root;
}

/** Seeded visual rock. These decorative meshes are not observed geological data. */
export function createRock(seed = 1, color = 0x795741) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const variation = 0.8 + random() * 0.35;
    positions.setXYZ(i, positions.getX(i) * variation, positions.getY(i) * variation * 0.7, positions.getZ(i) * variation);
  }
  geometry.computeVertexNormals();
  const rock = new THREE.Mesh(geometry, material(color, 0.97, 0));
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}
