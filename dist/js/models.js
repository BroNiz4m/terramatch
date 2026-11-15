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

/**
 * Original low, box-shaped cargo lander. Visual metres; front and exit face -Z.
 * The model owns hardware/nozzle glow. Plumes and dust belong to landing-effects.
 */
function chamferPanel(width,height,depth,cut=.18) {
  const x=width/2,y=height/2,c=Math.min(cut,x*.4,y*.4),shape=new THREE.Shape();
  shape.moveTo(-x+c,-y);shape.lineTo(x-c,-y);shape.lineTo(x,-y+c);shape.lineTo(x,y-c);
  shape.lineTo(x-c,y);shape.lineTo(-x+c,y);shape.lineTo(-x,y-c);shape.lineTo(-x,-y+c);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,depth-.03),bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,steps:1});
  geometry.center();return geometry;
}

/** Transparent ink, with no backing plate or opaque paper-colored pixels. */
function landerLabelTexture(text) {
  let canvas,ctx,texture;
  try {canvas=globalThis.document?.createElement?.('canvas');if(canvas){canvas.width=1024;canvas.height=256;ctx=canvas.getContext?.('2d');}} catch {}
  if(ctx&&typeof ctx.fillText==='function'){
    ctx.clearRect?.(0,0,1024,256);ctx.fillStyle='#172029';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='700 176px Inter, Arial, sans-serif';ctx.fillText(text,512,128,960);
    texture=new THREE.CanvasTexture(canvas);texture.userData.renderMethod='local-canvas-text';
  } else {
    const glyphs={
      W:'10001/10001/10001/10101/10101/10101/01010',h:'10000/10000/10110/11001/10001/10001/10001',
      '0':'01110/10001/10011/10101/11001/10001/01110',K:'10001/10010/10100/11000/10100/10010/10001',
      n:'00000/00000/11110/10001/10001/10001/10001',o:'00000/00000/01110/10001/10001/10001/01110',
      w:'00000/00000/10001/10001/10101/10101/01010',s:'00000/00000/01111/10000/01110/00001/11110',
      T:'11111/00100/00100/00100/00100/00100/00100',e:'00000/00000/01110/10001/11111/10000/01110',
      r:'00000/00000/10110/11001/10000/10000/10000',a:'00000/00000/01110/00001/01111/10001/01111',
      M:'10001/11011/10101/10101/10001/10001/10001',t:'00100/00100/11111/00100/00100/00101/00010',
      c:'00000/00000/01111/10000/10000/10000/01111',
    };
    const scale=8,width=(text.length*6+4)*scale,height=96,pixels=new Uint8Array(width*height*4);
    const left=Math.floor((width-(text.length*6-1)*scale)/2),top=20;
    [...text].forEach((letter,index)=>{const rows=(glyphs[letter]||'00000/00000/00000/00000/00000/00000/00000').split('/');
      for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(rows[row][col]==='1')for(let y=0;y<scale;y++)for(let x=0;x<scale;x++){
        const offset=((top+row*scale+y)*width+left+index*6*scale+col*scale+x)*4;
        pixels[offset]=23;pixels[offset+1]=32;pixels[offset+2]=41;pixels[offset+3]=255;
      }
    });
    texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);texture.flipY=true;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.userData.renderMethod='local-pixel-font';
  }
  texture.colorSpace=THREE.SRGBColorSpace;texture.userData.text=text;texture.userData.transparentInk=true;
  texture.userData.originalProceduralAsset=true;texture.needsUpdate=true;return texture;
}

function hullLettering(text) {
  return new THREE.MeshStandardMaterial({map:landerLabelTexture(text),transparent:true,alphaTest:.12,depthWrite:false,
    roughness:.72,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,side:THREE.FrontSide});
}

/** Original six-wheel visual rover. Suspension follows sampled terrain; this is not a mobility simulation. */
export function createSurfaceRover() {
  const root = new THREE.Group();
  root.name = 'TerraMatch Surface Rover';
  const ivory = material(0xe2dfd3, .63, .18), orange = material(0xef812c, .46, .4);
  const dark = material(0x242b31, .62, .65), silver = material(0xa4aaac, .36, .82);
  const tread = material(0x686d70, .72, .65), glass = material(0x111e2e, .13, .6);
  const body = new THREE.Group(); root.add(body);
  mesh(bevelBox(1.7, .28, 2.35), dark, body, 0, .92, .05);
  mesh(bevelBox(1.63, .56, 1.42, .06), ivory, body, 0, 1.29, .12);
  mesh(bevelBox(1.8, .12, 1.5), silver, body, 0, 1.01, .08);
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(.035, .05, 1.1), orange, body, side * .829, 1.075, .16);
    for (const z of [-.43, .67]) {
      const b = mesh(new THREE.CylinderGeometry(.027, .027, .025, 6), silver, body, side * .833, 1.48, z); b.rotation.z = Math.PI / 2;
    }
    const label = mesh(new THREE.PlaneGeometry(1.17, .29), hullLettering('Wh0Knows'), body, side * .837, 1.31, .12);
    label.rotation.y = side * Math.PI / 2; label.name = 'Wh0Knows direct side lettering';
    for (const z of [-.33, .44]) {
      strut(body, new THREE.Vector3(side * .45, 1.58, z - .12), new THREE.Vector3(side * .45, 1.64, z - .12), .022, dark);
      strut(body, new THREE.Vector3(side * .45, 1.64, z - .12), new THREE.Vector3(side * .45, 1.64, z + .12), .022, dark);
      strut(body, new THREE.Vector3(side * .45, 1.64, z + .12), new THREE.Vector3(side * .45, 1.58, z + .12), .022, dark);
    }
    // Orange cable loops on the deck, not freestanding labels or backing cards.
    const loop = mesh(new THREE.TorusGeometry(.075, .018, 6, 12), orange, body, side * .72, 1.17, -.79); loop.rotation.y = Math.PI / 2;
  }
  const front = mesh(bevelBox(1.79, .32, .32), ivory, body, 0, 1.04, -1.12); front.name = 'Front chassis';
  const frontBrand = mesh(new THREE.PlaneGeometry(.89, .23), hullLettering('TerraMatch'), body, 0, 1.06, -1.291);
  frontBrand.rotation.y = Math.PI; frontBrand.name = 'TerraMatch direct front lettering';
  mesh(new THREE.BoxGeometry(.65, .025, .018), orange, body, 0, .929, -1.29);
  function cameraLens(parent, x, y, z, radius) {
    mesh(bevelBox(radius * 2.65, radius * 2.65, .07, .025), dark, parent, x, y, z);
    cylinderAlongZ(parent, radius, .035, silver, x, y, z - .051);
    cylinderAlongZ(parent, radius * .77, .04, glass, x, y, z - .07);
  }
  for (const side of [-1, 1]) cameraLens(body, side * .69, 1.05, -1.305, .105);
  const mast = new THREE.Group(); mast.name = 'Binocular camera mast'; body.add(mast); mast.position.set(-.23, 1.2, -.65);
  mesh(bevelBox(.13, .91, .12, .017), silver, mast, 0, .43, 0);
  for (const y of [.12, .66]) cylinderAlongZ(mast, .095, .14, dark, 0, y, -.005);
  mesh(bevelBox(.79, .25, .27, .035), ivory, mast, 0, .93, 0);
  mesh(new THREE.BoxGeometry(.55, .025, .19), orange, mast, 0, 1.069, 0);
  for (const side of [-1, 1]) cameraLens(mast, side * .255, .93, -.15, .086);
  mesh(new THREE.CylinderGeometry(.13, .13, .18, 20), silver, body, .4, 1.67, .36);
  mesh(new THREE.CylinderGeometry(.065, .065, .12, 16), dark, body, .4, 1.52, .36);
  // Rear solar deck with discrete cells and visible silver grid, made from original geometry.
  const solar = new THREE.Group(); solar.name = 'Rear solar array'; body.add(solar); solar.position.set(0, 1.4, 1.14); solar.rotation.x = -.10;
  mesh(bevelBox(1.86, .075, .95, .02), silver, solar);
  const blue = material(0x173c73, .34, .4);
  const cellGeometry = new THREE.BoxGeometry(.211, .012, .198);
  for (let x = 0; x < 8; x++) for (let z = 0; z < 4; z++) mesh(cellGeometry, blue, solar, (x - 3.5) * .222, .045, (z - 1.5) * .212);
  for (const x of [-.68, .68]) strut(body, new THREE.Vector3(x, .96, .75), new THREE.Vector3(x, 1.36, 1.48), .035, dark);
  mesh(bevelBox(1.3, .16, .23), dark, body, 0, 1.12, 1.54);
  for (let i = 0; i < 9; i++) mesh(new THREE.BoxGeometry(.022, .13, .19), silver, body, (i - 4) * .13, 1.16, 1.55);
  // Folded sample arm: two links, rotary joints and a cylindrical end tool.
  const arm = new THREE.Group(); arm.name = 'Stowed instrument arm'; body.add(arm);
  const armPoints = [new THREE.Vector3(.58, 1.24, -.64), new THREE.Vector3(-.55, 1.31, -.97), new THREE.Vector3(.48, 1.31, -1.36)];
  for (let i = 0; i < 2; i++) {
    strut(arm, armPoints[i], armPoints[i + 1], .065, silver);
    strut(arm, armPoints[i].clone().add(new THREE.Vector3(0, .06, 0)), armPoints[i + 1].clone().add(new THREE.Vector3(0, .06, 0)), .025, dark);
  }
  for (const p of armPoints) cylinderAlongZ(arm, .11, .13, dark, p.x, p.y, p.z);
  mesh(new THREE.CylinderGeometry(.09, .08, .19, 16), silver, arm, .48, 1.19, -1.36);
  const wheels = [], suspensions = [], radius = .42, halfTrack = 1.3;
  const drumGeometry = new THREE.CylinderGeometry(radius - .026, radius - .026, .31, 24);
  const hubGeometry = new THREE.CylinderGeometry(.23, .23, .335, 20);
  const cleatGeometry = new THREE.BoxGeometry(.342, .052, .054);
  for (const side of [-1, 1]) {
    const sideWheels = [];
    for (let index = 0; index < 3; index++) {
      const carrier = new THREE.Group(); carrier.name = `${side < 0 ? 'Left' : 'Right'} wheel ${index + 1}`; root.add(carrier);
      const spin = new THREE.Group(); carrier.add(spin);
      const drum = mesh(drumGeometry, tread, spin); drum.rotation.z = Math.PI / 2;
      const hub = mesh(hubGeometry, silver, spin); hub.rotation.z = Math.PI / 2;
      for (let k = 0; k < 20; k++) {
        const a = k / 20 * TAU, cleat = mesh(cleatGeometry, silver, spin, 0, Math.cos(a) * (radius - .026), Math.sin(a) * (radius - .026)); cleat.rotation.x = a;
      }
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * TAU, b = mesh(new THREE.CylinderGeometry(.021, .021, .024, 6), dark, spin, side * .178, Math.cos(a) * .178, Math.sin(a) * .178); b.rotation.z = Math.PI / 2;
      }
      const neutral = new THREE.Vector3(side * halfTrack, radius, (index - 1) * 1.18);
      carrier.position.copy(neutral);
      const wheel = { side, index, carrier, spin, neutral, radius, contactWorld: new THREE.Vector3(), roll: 0 };
      wheels.push(wheel); sideWheels.push(wheel);
    }
    const links = Array.from({ length: 5 }, () => mesh(new THREE.CylinderGeometry(.065, .065, 1, 8), silver, root));
    const joints = Array.from({ length: 6 }, () => { const joint = mesh(new THREE.CylinderGeometry(.115, .115, .12, 16), dark, root); joint.rotation.z = Math.PI / 2; return joint; });
    suspensions.push({ side, wheels: sideWheels, links, joints, rockerAngle: 0, bogieAngle: 0 });
  }
  const previous = new THREE.Vector3(), current = new THREE.Vector3(), forward = new THREE.Vector3(), axle = new THREE.Vector3();
  let initialized = false, previousYaw = 0;
  function update(dt = .016, elapsed = 0, moving = false, heightSampler) {
    root.updateWorldMatrix(true, false); root.getWorldPosition(current);
    forward.set(0, 0, -1).transformDirection(root.matrixWorld); forward.y = 0; forward.normalize();
    const yaw = Math.atan2(-forward.x, -forward.z);
    const travel = initialized && dt > 0 ? current.clone().sub(previous).dot(forward) : 0;
    const yawDelta = initialized && dt > 0 ? Math.atan2(Math.sin(yaw - previousYaw), Math.cos(yaw - previousYaw)) : 0;
    for (const wheel of wheels) {
      const { carrier, spin, neutral, side, index } = wheel;
      carrier.position.copy(neutral);
      // Corner steering indicates a turn. Wheel travel, including reverse and pivot turns, drives roll.
      carrier.rotation.y = index === 1 ? 0 : clamp(yawDelta * 12, -.4, .4) * (index === 0 ? 1 : -1);
      axle.set(1, 0, 0).applyAxisAngle(UP, carrier.rotation.y).transformDirection(root.matrixWorld);
      const support = radius * Math.sqrt(Math.max(0, 1 - axle.y * axle.y)) + .171 * Math.abs(axle.y);
      const center = neutral.clone().applyMatrix4(root.matrixWorld);
      const ground = heightSampler?.(center.x, center.z);
      if (Number.isFinite(ground)) {
        center.y = ground + support; carrier.position.copy(root.worldToLocal(center.clone()));
        wheel.contactWorld.set(center.x, ground, center.z);
      } else wheel.contactWorld.copy(center).add(new THREE.Vector3(0, -support, 0));
      wheel.roll -= (travel + side * yawDelta * halfTrack) / radius;
      spin.rotation.x = wheel.roll;
    }
    for (const suspension of suspensions) {
      const [a, b, c] = suspension.wheels.map(w => w.carrier.position.clone());
      const hip = new THREE.Vector3(suspension.side * .91, 1.01, -.25);
      const bogie = b.clone().lerp(c, .5); bogie.x = suspension.side * 1.08; bogie.y += .25;
      const fork = a.clone().lerp(bogie, .53); fork.x = suspension.side * 1.05; fork.y += .29;
      const points = [[hip, fork], [fork, a], [fork, bogie], [bogie, b], [bogie, c]];
      // Rear bogie beam follows middle/rear hubs; its central pivot connects to the rocker.
      points.forEach(([start, end], i) => positionLink(suspension.links[i], start, end));
      [hip, fork, a, b, c, bogie].forEach((p, i) => suspension.joints[i].position.copy(p));
      suspension.rockerAngle = Math.atan2(bogie.y - a.y, bogie.z - a.z);
      suspension.bogieAngle = Math.atan2(c.y - b.y, c.z - b.z);
    }
    previous.copy(current); previousYaw = yaw; initialized = true;
  }
  Object.assign(root.userData, {
    update, resetMotion() { initialized = false; }, wheels, suspensions, body, mast, solar, arm, frontBrand,
    wheelCount: 6, halfWidth: 1.64, halfLength: 1.67, wheelRadius: radius, forward: '-Z',
    designRevision: 'surface-rover-reference-v1', modelCredit: 'Original procedural TerraMatch surface rover',
  });
  update(0); return root;
}

export function createCargoLander() {
  const root = new THREE.Group();
  root.name = 'TerraMatch Cargo Lander';
  const ivory = material(0xe2dfd3, 0.68, 0.16);
  const orange = material(0xef812c, 0.55, 0.22);
  const dark = material(0x18212a, 0.62, 0.66);
  const silver = material(0x9ba9ad, 0.3, 0.85);
  const interior = material(0x777369, 0.84, 0.18);
  const innerDoor = material(0xbcb8a9, 0.74, 0.18);
  const deckMetal = material(0x858881, 0.8, 0.32);
  const rubber = material(0x24282b, 0.93, 0.08);
  const lamp = material(0xffddaa, 0.34, 0.12, { emissive: 0xffb85a, emissiveIntensity: 2.2 });
  const hull = new THREE.Group();
  hull.name = 'Low cargo hull';
  root.add(hull);
  const deckHeight = 0.85, hullWidth = 6.4, hullDepth = 5.2;
  const bayWidth = 4.5, bayDepth = 4.6, bayHeight = 2.65;
  const frontZ = -2.64, rampLength = 4.1, segmentLength = rampLength / 2;
  let deployment = 0, gear = 1, compression = 0, rampGroundY = 0;
  let groundSampler = null, thrust = 0;

  // Separate walls leave a real 4.5 m-wide open payload bay through the front.
  mesh(bevelBox(hullWidth, 0.28, hullDepth, 0.075), dark, hull, 0, 0.685, 0);
  mesh(bevelBox(6.26, 0.08, 5.08, 0.025), silver, hull, 0, 0.80, 0);
  for(const side of [-1,1]){
    const wall=mesh(chamferPanel(5.12,2.98,.24,.26),ivory,hull,side*3.08,2.25,0);
    wall.rotation.y=side*Math.PI/2;wall.name='Chamfered side hull panel';
  }
  mesh(chamferPanel(6.16,2.98,.24,.27),ivory,hull,0,2.25,2.48).name='Fixed rear bulkhead';
  const roof=mesh(chamferPanel(6.52,5.32,.30,.38),ivory,hull,0,3.69,0);roof.rotation.x=-Math.PI/2;roof.name='Chamfered cargo roof';
  const underside=mesh(chamferPanel(6.4,5.2,.08,.34),dark,hull,0,3.54,0);underside.rotation.x=-Math.PI/2;
  for (const side of [-1, 1]) {
    mesh(chamferPanel(0.88, bayHeight, 0.26, 0.14), ivory, hull, side * 2.76, deckHeight + bayHeight / 2, -2.48);
    for (const z of [-2.47, 2.47]) for(const y of [1.08,3.42]) mesh(bevelBox(0.25, 0.62, 0.26, 0.045), orange, hull, side * 3.10, y, z);
    mesh(bevelBox(0.11, 0.15, 4.9, 0.025), orange, hull, side * 3.21, 3.80, 0);
    mesh(new THREE.BoxGeometry(0.08, 0.13, 4.98), silver, hull, side * 2.97, 0.98, 0);
    // Perimeter seams leave the wide branding field uninterrupted.
    for(const y of [1.03,3.46])mesh(new THREE.BoxGeometry(.018,.018,4.25),silver,hull,side*3.207,y,0);
    for(const z of [-2.15,2.15]){
      mesh(new THREE.BoxGeometry(.018,2.10,.018),silver,hull,side*3.207,2.25,z);
      for(const y of [1.22,2.25,3.28]){
        const fastener=mesh(new THREE.CylinderGeometry(.026,.026,.025,6),dark,hull,side*3.225,y,z);fastener.rotation.z=Math.PI/2;
      }
    }
    for(const z of [-1.5,-.5,.5,1.5]){
      const fastener=mesh(new THREE.CylinderGeometry(.022,.022,.022,6),silver,hull,side*3.224,3.29,z);fastener.rotation.z=Math.PI/2;
    }
    for(const z of [-1.8,1.8])for(let y=1.08;y<1.38;y+=.07)mesh(new THREE.BoxGeometry(.025,.027,.35),dark,hull,side*3.225,y,z);
    mesh(bevelBox(0.33, 0.78, 0.3, 0.03), dark, hull, side * 2.67, 1.60, 1.94);
  }
  // Chunky corner armor gives the small lander its orange structural identity.
  // Everything stays outside the 4.5 m cargo corridor.
  for (const side of [-1, 1]) for (const fore of [-1, 1]) {
    const roofCap = mesh(chamferPanel(0.72, 0.72, 0.27, 0.14), orange, hull, side * 3.02, 3.83, fore * 2.39);
    roofCap.rotation.x=-Math.PI/2;
    roofCap.name = 'Orange roof corner armor';
    mesh(bevelBox(0.43, 0.018, 0.43, 0.035), dark, hull, side * 3.02, 3.973, fore * 2.39);
    for (const dx of [-0.25, 0.25]) for (const dz of [-0.24, 0.24]) {
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 6), silver, hull, side * 3.02 + dx, 3.975, fore * 2.39 + dz);
    }
    const shoulder = mesh(chamferPanel(0.70, 0.67, 0.72, 0.11), orange, hull, side * 3.15, 1.64, fore * 2.26);
    shoulder.rotation.y=side*Math.PI/2;
    shoulder.name = 'Orange articulated landing-leg shoulder';
    mesh(bevelBox(0.055, 0.43, 0.46, 0.035), silver, hull, side * 3.525, 1.64, fore * 2.26);
    const shoulderHub = mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.12, 16), dark, hull, side * 3.58, 1.64, fore * 2.26);
    shoulderHub.rotation.z = Math.PI / 2;
    for (const dy of [-0.16, 0.16]) for (const dz of [-0.17, 0.17]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.025, 6), dark, hull, side * 3.56, 1.64 + dy, fore * 2.26 + dz);
      bolt.rotation.z = Math.PI / 2;
    }
  }
  mesh(chamferPanel(5.64,.50,.24,.12),ivory,hull,0,3.68,-2.64).name='Front structural branding lintel';
  for(const side of [-1,1]){
    mesh(bevelBox(.70,.065,.025,.012),orange,hull,side*2.03,3.68,-2.778);
    for(const y of [3.54,3.82])bolt(hull,silver,side*2.59,y,-2.786);
    mesh(bevelBox(.16,2.24,.16,.035),orange,hull,side*2.64,2.12,-2.62);
  }
  mesh(new THREE.BoxGeometry(4.63, 0.06, 0.31), orange, hull, 0, 0.82, -2.50);

  // Warm lamps, ceiling ribs and a dark ribbed floor make the actual bay readable.
  mesh(new THREE.BoxGeometry(4.58, 0.02, 4.65), interior, hull, 0, 0.84, -0.12);
  for (let z = -2.42; z < 2.1; z += 0.30) mesh(new THREE.BoxGeometry(4.5, 0.012, 0.035), silver, hull, 0, 0.855, z);
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.06, 0.055, 3.9), lamp, hull, side * 2.17, 3.45, -0.1);
    mesh(new THREE.BoxGeometry(0.035, 0.035, 4.3), lamp, hull, side * 2.20, 0.93, -0.08);
    for (const z of [-1.5, 0, 1.5]) mesh(new THREE.BoxGeometry(0.07, 2.2, 0.07), silver, hull, side * 2.37, 2.02, z);
  }
  for(const side of [-1,1]){
    mesh(bevelBox(1.18,.075,.25,.025),dark,hull,side*1.10,3.47,-2.36);
    mesh(bevelBox(1.03,.025,.18,.012),lamp,hull,side*1.10,3.423,-2.36);
  }
  for(const x of [-1.5,0,1.5]){
    mesh(chamferPanel(1.42,1.84,.045,.10),innerDoor,hull,x,2.23,2.332);
    for(const dx of [-.60,.60])for(const y of [1.45,3.02])bolt(hull,dark,x+dx,y,2.300);
    mesh(bevelBox(1.28,.12,.07,.015),orange,hull,x,1.20,2.27);
  }
  for(const side of [-1,1])for(const z of [-1.2,.3,1.65]){
    const panel=mesh(chamferPanel(1.22,1.72,.04,.10),innerDoor,hull,side*2.925,2.15,z);panel.rotation.y=side*Math.PI/2;
  }
  const bayLight = new THREE.PointLight(0xffc078, 2.4, 7, 2);
  bayLight.position.set(0, 2.8, -0.35); hull.add(bayLight);
  mesh(new THREE.BoxGeometry(4.42, 0.1, 0.1), silver, hull, 0, 1.13, 2.15);

  // Segmented ivory roof, compact antenna and fixed rear service fittings.
  const roofPanels=[];
  for(const side of [-1,1])for(const z of [-1.63,0,1.63]){
    const panel=mesh(chamferPanel(2.84,1.48,.035,.14),ivory,hull,side*1.49,3.862,z);panel.rotation.x=-Math.PI/2;panel.name='Segmented roof armor';roofPanels.push(panel);
    for(const dx of [-1.15,1.15])for(const dz of [-.53,.53])mesh(new THREE.CylinderGeometry(.022,.022,.012,6),silver,hull,side*1.49+dx,3.89,z+dz);
  }
  mesh(bevelBox(1.10,.06,.19,.025),orange,hull,0,3.90,1.97);
  mesh(new THREE.CylinderGeometry(.18,.22,.16,20),dark,hull,0,3.96,.65);
  mesh(new THREE.CylinderGeometry(.13,.13,.10,16),orange,hull,0,4.08,.65);
  mesh(new THREE.CylinderGeometry(.025,.044,.55,10),silver,hull,0,4.38,.65);
  mesh(new THREE.SphereGeometry(.044,12,8),dark,hull,0,4.68,.65);
  mesh(chamferPanel(1.12,.82,.035,.10),innerDoor,hull,0,2.28,2.625).name='Rear maintenance hatch';
  for(const side of [-1,1]){
    mesh(bevelBox(.46,.94,.035,.025),dark,hull,side*1.55,2.28,2.625);
    for(let y=1.90;y<2.69;y+=.09)mesh(new THREE.BoxGeometry(.36,.025,.025),silver,hull,side*1.55,y,2.66);
    for(const y of [1.96,2.60])bolt(hull,dark,side*.43,y,2.66);
  }

  const brandingText='Wh0Knows',brandMaterial=hullLettering(brandingText);
  const brandingLabels=[-1,1].map(side=>{
    const label=mesh(new THREE.PlaneGeometry(3.65,.82),brandMaterial,hull,side*3.223,2.43,0);
    label.name=side<0?'Wh0Knows left-side branding':'Wh0Knows right-side branding';label.rotation.y=side*Math.PI/2;
    label.castShadow=false;label.receiveShadow=true;label.renderOrder=2;label.userData.text=brandingText;label.userData.application='transparent hull ink';return label;
  });
  // The old name sat behind the roof edge. This ink plane is outside the frontmost beam.
  const frontBrand=mesh(new THREE.PlaneGeometry(2.85,.42),hullLettering('TerraMatch'),hull,0,3.68,-2.785);
  frontBrand.rotation.y=Math.PI;frontBrand.name='TerraMatch front lintel';frontBrand.userData.text='TerraMatch';
  frontBrand.userData.application='transparent hull ink';frontBrand.castShadow=false;frontBrand.receiveShadow=true;frontBrand.renderOrder=2;

  // Two genuinely independent side hinges. Opening sends both leaves outside the bay.
  const doorPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'Left side-hinged cargo door' : 'Right side-hinged cargo door';
    pivot.position.set(side * 2.50, deckHeight, -2.67);
    hull.add(pivot);
    const inward = -side, centerX = inward * 1.25;
    mesh(chamferPanel(2.50,2.54,.16,.18),ivory,pivot,centerX,1.31,0).name='Cargo door exterior shell';
    mesh(chamferPanel(2.28,2.30,.012,.17),dark,pivot,centerX,1.31,-.095);
    mesh(chamferPanel(2.22,2.24,.025,.16),ivory,pivot,centerX,1.31,-.122);
    mesh(chamferPanel(2.27,2.29,.045,.16),innerDoor,pivot,centerX,1.31,.11);
    for(const y of [.22,2.40])mesh(bevelBox(2.08,.045,.04,.012),silver,pivot,centerX,y,.153);
    for(const x of [inward*.17,inward*2.33])mesh(bevelBox(.045,1.96,.04,.012),silver,pivot,x,1.31,.153);
    for(const x of [centerX-.96,centerX+.96])for(const y of [.39,2.23])bolt(pivot,dark,x,y,.16);
    for(const y of [.15,2.47])mesh(bevelBox(.22,.18,.19,.025),orange,pivot,inward*2.35,y,-.02);
    mesh(bevelBox(.10,.30,.045,.02),dark,pivot,inward*2.12,1.32,-.153);
    for (const y of [0.22, 1.30, 2.38]) {
      mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.24, 12), dark, pivot, 0, y, 0);
    }
    doorPivots.push(pivot);
  }

  // Two-fold ramp fits below the roof when stowed, then becomes one wide walkway.
  const rampPivot = new THREE.Group();
  rampPivot.name = 'Ramp base hinge';
  rampPivot.position.set(0, deckHeight, frontZ);
  hull.add(rampPivot);
  const rampTipPivot = new THREE.Group();
  rampTipPivot.name = 'Ramp folding end hinge';
  rampTipPivot.position.z = -segmentLength;
  rampPivot.add(rampTipPivot);
  function rampSegment(parent, endSegment) {
    mesh(new THREE.BoxGeometry(4.64, 0.09, segmentLength), silver, parent, 0, -0.065, -segmentLength / 2);
    mesh(new THREE.BoxGeometry(4.43, 0.026, segmentLength - 0.04), deckMetal, parent, 0, -0.013, -segmentLength / 2);
    for (let z = 0.12; z < segmentLength; z += 0.30) mesh(new THREE.BoxGeometry(4.37, 0.022, 0.070), silver, parent, 0, 0.003, -z);
    for (const side of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.10, 0.15, segmentLength), ivory, parent, side * 2.34, 0.08, -segmentLength / 2);
      mesh(new THREE.BoxGeometry(0.035, 0.035, segmentLength - 0.06), orange, parent, side * 2.295, 0.165, -segmentLength / 2);
      if (endSegment) mesh(bevelBox(0.25, 0.22, 0.38, 0.025), orange, parent, side * 2.32, 0.09, -segmentLength + 0.17);
    }
  }
  rampSegment(rampPivot, false); rampSegment(rampTipPivot, true);

  // Four independently grounded splayed landing legs with circular footpads.
  const legParts = [], footAnchors = [];
  for (const side of [-1, 1]) for (const fore of [-1, 1]) {
    const group = new THREE.Group();
    group.name = (side < 0 ? 'Left ' : 'Right ') + (fore < 0 ? 'front' : 'rear') + ' landing leg';
    root.add(group);
    const upper = strut(group, new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.15, ivory);
    const lower = strut(group, new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.09, silver);
    const brace = strut(group, new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.052, silver);
    const kneeMesh = mesh(new THREE.SphereGeometry(0.18, 12, 8), dark, group);
    const pad = mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.11, 24), rubber, group);
    const padPlate = mesh(new THREE.CylinderGeometry(0.43, 0.53, 0.075, 24), silver, group);
    const padHub = mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.20, 12), dark, group);
    for(let i=0;i<8;i++){const angle=i*Math.PI/4;mesh(new THREE.CylinderGeometry(.023,.023,.022,6),dark,padPlate,Math.sin(angle)*.37,.048,Math.cos(angle)*.37);}
    const anchor = new THREE.Vector3(side * 4.10, 0, fore * 3.32);
    footAnchors.push(anchor);
    legParts.push({ side, fore, group, upper, lower, brace, kneeMesh, pad, padPlate, padHub, anchor });
  }

  // Six actual open bell nozzles; only their small throat glow belongs to the model.
  const nozzleAnchors = [], nozzleGlows = [];
  for (const side of [-1, 1]) for (const z of [-1.48, 0, 1.48]) {
    const x = side * 2.08;
    const nozzle = mesh(new THREE.CylinderGeometry(0.17, 0.38, 0.43, 24, 1, true), dark, hull, x, 0.425, z);
    nozzle.name = 'Underbody bell nozzle';
    nozzle.material = dark.clone(); nozzle.material.side = THREE.DoubleSide;
    mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.085, 20), silver, hull, x, 0.66, z);
    const ring = mesh(new THREE.TorusGeometry(0.375, 0.026, 6, 24), silver, hull, x, 0.21, z);
    ring.rotation.x = Math.PI / 2;
    const glowMaterial = material(0x3e281a, 0.38, 0.35, { emissive: 0xffa65b, emissiveIntensity: 0 });
    const glow = mesh(new THREE.CircleGeometry(0.255, 24), glowMaterial, hull, x, 0.254, z);
    glow.rotation.x = Math.PI / 2;
    nozzleGlows.push(glow);
    nozzleAnchors.push(new THREE.Vector3(x, 0.205, z));
  }
  const flames = new THREE.Group();
  flames.name = 'External exhaust effects attachment';
  root.add(flames);

  function updateGrounding() {
    const clampedFeet = [];
    legParts.forEach((leg, index) => {
      const x = leg.side * THREE.MathUtils.lerp(3.02, 4.10, gear);
      const z = leg.fore * THREE.MathUtils.lerp(2.18, 3.32, gear);
      const requested = groundSampler?.(x, z);
      const validGround = Number.isFinite(requested) ? requested : 0;
      const applied = clamp(validGround, -0.8, 0.45);
      if (Number.isFinite(requested) && applied !== requested) clampedFeet.push({ footIndex: index, requested, applied });
      const groundY = THREE.MathUtils.lerp(0.48, applied, gear);
      leg.anchor.set(x, groundY, z);
      const mount = new THREE.Vector3(leg.side * 2.98, 1.65 - compression * 0.1, leg.fore * 2.12);
      const knee = new THREE.Vector3(leg.side * THREE.MathUtils.lerp(3.10, 3.69, gear), THREE.MathUtils.lerp(1.0, 0.72 + applied * 0.45, gear) - compression * 0.035, leg.fore * THREE.MathUtils.lerp(2.19, 2.89, gear));
      const ankle = new THREE.Vector3(x, groundY + 0.24, z);
      positionLink(leg.upper, mount, knee);
      positionLink(leg.lower, knee, ankle);
      positionLink(leg.brace, new THREE.Vector3(leg.side * 3.02, 0.86 - compression * 0.1, leg.fore * 2.04), ankle);
      leg.kneeMesh.position.copy(knee);
      leg.pad.position.set(x, groundY + 0.055, z);
      leg.padPlate.position.set(x, groundY + 0.13, z);
      leg.padHub.position.set(x, groundY + 0.23, z);
    });
    root.userData.groundingStatus = { outOfRange: clampedFeet.length > 0, clampedFeet, minimumLocalGround: -0.8, maximumLocalGround: 0.45 };
  }
  function updateRamp() {
    const rampP = ease((deployment - 0.5) / 0.5);
    // Retract the folded stack behind the closed door skins before descent.
    rampPivot.position.z=frontZ+.30*(1-rampP);
    const height = deckHeight - compression * 0.1;
    const rawSine = (rampGroundY - height) / rampLength;
    const appliedSine = clamp(rawSine, -0.65, 0.65);
    const deployedAngle = Math.asin(appliedSine);
    rampPivot.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, deployedAngle, rampP);
    rampTipPivot.rotation.x = (1 - rampP) * Math.PI;
    rampTipPivot.position.y = -(1 - rampP) * 0.12;
    root.userData.rampHeight = height;
    root.userData.rampAngle = deployedAngle;
    root.userData.rampGrounding = { requested: rampGroundY, applied: height + rampLength * appliedSine, clamped: rawSine !== appliedSine };
    root.userData.rampTipZ = frontZ - rampLength * Math.cos(deployedAngle);
  }
  function setDeployment(progress) {
    deployment = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
    const doorP = ease(deployment / 0.55);
    doorPivots[0].rotation.y = doorP * 110 * Math.PI / 180;
    doorPivots[1].rotation.y = -doorP * 110 * Math.PI / 180;
    updateRamp();
    root.userData.deployment = deployment;
  }
  function setCompression(value) {
    compression = Number.isFinite(value) ? clamp(value, 0, 1) : 0;
    hull.position.y = -compression * 0.1;
    for (const anchor of nozzleAnchors) anchor.y = 0.205 - compression * 0.1;
    root.userData.compression = compression;
    updateGrounding(); updateRamp();
  }
  root.userData.setDeployment = setDeployment;
  root.userData.setLandingGear = value => { gear = Number.isFinite(value) ? clamp(value, 0, 1) : 1; root.userData.landingGear = gear; updateGrounding(); };
  root.userData.setCompression = setCompression;
  root.userData.setGrounding = sampler => { groundSampler = typeof sampler === 'function' ? sampler : null; updateGrounding(); };
  root.userData.setRampGroundHeight = value => { rampGroundY = Number.isFinite(value) ? value : 0; updateRamp(); };
  root.userData.rampSurfaceHeight = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > bayWidth / 2) return null;
    const height = deckHeight - compression * 0.1;
    if (z >= frontZ && z <= frontZ + bayDepth) return height;
    if (deployment < 0.995 || z > frontZ || z < root.userData.rampTipZ) return null;
    return height + (frontZ - z) * Math.tan(root.userData.rampAngle);
  };
  root.userData.setThrust = value => {
    thrust = Number.isFinite(value) ? clamp(value, 0, 2) : 0;
    root.userData.thrust = thrust;
    for (const glow of nozzleGlows) glow.material.emissiveIntensity = thrust * 1.8;
  };
  root.userData.update = (_dt = 0, time = 0) => {
    updateGrounding();
    for (let i = 0; i < nozzleGlows.length; i++) nozzleGlows[i].material.emissiveIntensity = thrust * (1.7 + Math.sin(time * 16 + i) * 0.12);
  };
  Object.assign(root.userData, {
    hull, doorPivots, rampPivot, rampTipPivot, rampLength, rampWidth: bayWidth, bayWidth, bayDepth, bayHeight,
    doorFrontZ: frontZ, bayBackZ: frontZ + bayDepth, hullWidth, hullDepth, deckHeight,
    footAnchors, landingLegs: legParts, nozzleAnchors, nozzleGlows, flames,
    brandingText, brandingLabels, frontBrand, roofPanels, designRevision:'cargo-reference-v2', forward: '-Z', landingGear: 1,
    modelCredit: 'Original procedural TerraMatch Cargo Lander · Wh0Knows',
  });
  setCompression(0); setDeployment(0); root.userData.setThrust(0);
  return root;
}

/** Backward-compatible name; the actual model is now the low cargo lander. */
export function createRocket() { return createCargoLander(); }

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
