import * as THREE from '../../vendor/three.module.js';
import { species as table } from '../content/fauna.js';

// 动物的低多边形模型与姿态。行为在 src/core/wildlife.js，
// 这里只根据 state / speed 摆出对应姿势。几何体与材质按物种共享。
const ALERT = new Set(['alert', 'notice', 'flee', 'curious']),
  UPRIGHT = new Set(['sentinel', 'notice', 'alert']),
  PERCHED = new Set(['rest', 'forage']);
// 变色龙平静与紧张时的体色。
const CALM = new THREE.Color('#79a043'),
  TENSE = new THREE.Color('#3f4d29');
// 象鼻三节的姿态（弧度）：静止、随步子摆动、进食卷起、警告高举。
const TRUNK_REST = [0.15, 0.15, 0.2],
  TRUNK_SWAY = [0.12, 0.1, 0],
  TRUNK_CURL = [0.25, 0.6, 0.9],
  TRUNK_RAISED = [-1.15, -0.55, -0.35];

export function createFauna(tools, heightAt) {
  const { mesh, mat } = tools;
  const smooth = new THREE.IcosahedronGeometry(1, 1),
    rough = new THREE.IcosahedronGeometry(1, 0),
    rod = new THREE.CylinderGeometry(1, 1, 1, 6),
    cone = new THREE.ConeGeometry(1, 1, 6),
    dome = new THREE.SphereGeometry(0.24, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    rim = new THREE.CylinderGeometry(0.24, 0.25, 0.05, 9),
    capsule = new THREE.CapsuleGeometry(0.05, 0.17, 2, 7).rotateX(Math.PI / 2),
    wingShape = new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2),
    tailCurl = new THREE.TorusGeometry(0.03, 0.008, 5, 12, Math.PI * 1.6);
  const flat = (color, extra = {}) =>
    mat(color, { flatShading: true, ...extra });
  const m = {
    eye: mat('#16130f', { roughness: 0.3 }),
    hare: flat('#8f7656'),
    hareLight: flat('#d8cbb3'),
    shell: flat('#8b7343'),
    shellDark: flat('#4f4128'),
    reptile: flat('#9a8a64'),
    spines: flat('#4e3f30'),
    spineTips: flat('#b4a283'),
    face: flat('#cfb895'),
    meerkat: flat('#b59b73'),
    meerkatDark: flat('#3d3127'),
    spotted: flat('#ffffff', { map: spotTexture() }),
    neck: flat('#7b95b5'),
    casque: flat('#c8a46a'),
    wattle: flat('#b2402f'),
    leg: flat('#3b3a36'),
    agama: flat('#3d5fa3'),
    agamaHead: flat('#de7a2f'),
    agamaTail: flat('#5a6c86'),
    beetle: mat('#141413', { roughness: 0.3, metalness: 0.25 }),
    dung: flat('#5e4a33'),
    wing: mat('#e8913a', { side: THREE.DoubleSide, roughness: 0.6 }),
    wingEdge: mat('#3a2a1c', { side: THREE.DoubleSide }),
    zebra: flat('#ffffff', { map: stripeTexture(false) }),
    zebraLeg: flat('#ffffff', { map: stripeTexture(true) }),
    mane: flat('#1d1b19'),
    muzzle: flat('#2e2a26'),
    giraffe: flat('#ffffff', { map: patchTexture() }),
    giraffeLight: flat('#e3d2a8'),
    elephant: flat('#7d7a74'),
    elephantEar: flat('#9b8f84'),
    ivory: flat('#e9e0c9'),
    warthog: flat('#5e5249'),
    ostrich: flat('#26231f'),
    ostrichHen: flat('#7d6d5c'),
    ostrichSkin: flat('#c4a497'),
    plume: flat('#ece7dc'),
    crane: flat('#7e8388'),
    crown: flat('#dcb862'),
    wingGold: flat('#c9a35a'),
    egret: flat('#f3f0e7'),
    egretWing: flat('#f3f0e7', { side: THREE.DoubleSide }),
    bill: flat('#e2bd45'),
    legYellow: flat('#6d6440'),
    weaver: flat('#e8c23c'),
    weaverWing: flat('#d9b12f', { side: THREE.DoubleSide }),
    mask: flat('#1d1a17'),
    hyrax: flat('#7c6651'),
    frog: flat('#6a7a3c'),
    frogEye: flat('#c9a640'),
    goats: ['#e9e3d7', '#8b5e3c', '#2c2723', '#c9b79c', '#efe9dd'].map((c) =>
      flat(c),
    ),
    horn: flat('#9d8e77'),
    dog: flat('#b08a55'),
    dogLight: flat('#e6d6b8'),
    jackal: flat('#a37a4c'),
    saddle: flat('#3d3833'),
    dikdik: flat('#8f7f6b'),
    eyeRing: flat('#ece6d8'),
  };
  const v3 = new THREE.Vector3();

  function spotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3e4350';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#e9e6dc';
    for (let y = 4; y < 64; y += 8)
      for (let x = (y / 8) % 2 ? 0 : 4; x < 64; x += 8) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  }
  function blob(parent, material, [sx, sy, sz], [x, y, z], geo = smooth) {
    const o = mesh(geo, material, parent, x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  function eyes(parent, spread, y, z, size = 0.016) {
    for (const side of [-1, 1])
      blob(parent, m.eye, [size, size, size], [side * spread, y, z]);
  }
  const ease = (current, target, dt, rate = 6) =>
    current + (target - current) * Math.min(1, dt * rate);
  // 斑马的条纹：身体用竖纹，腿用横纹。
  function stripeTexture(across) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f1ede4';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#1c1a18';
    for (let i = 0; i < 4; i++) {
      const width = 6 + (i % 2) * 3;
      if (across) ctx.fillRect(0, i * 16, 64, width);
      else ctx.fillRect(i * 16, 0, width, 64);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(across ? 1 : 4, across ? 4 : 1);
    return t;
  }
  // 长颈鹿的斑块：棕色多边形之间留出浅色的网线。
  function patchTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eadbb4';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#9c5a32';
    // 交错排列的大斑块，彼此只隔一道细线。
    for (let row = -1; row < 4; row++)
      for (let col = -1; col < 4; col++) {
        const cx = col * 20 + (row & 1) * 10 + 10,
          cy = row * 17 + 9;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + 0.5,
            r = 10 + Math.sin(col * 3.1 + row * 5.3 + k * 2.2) * 1.4;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9);
        }
        ctx.fill();
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1.5);
    return t;
  }
  // 四条腿，顺序是左前、右前、左后、右后；pair 为真时只建 z 处的一对。
  // hip 是腿根离父组原点的高度，默认等于腿长。
  function hoofed(
    parent,
    material,
    length,
    radius,
    spread,
    z,
    pair,
    hip = length,
  ) {
    const legs = [];
    for (const row of pair ? [z] : [z, -z])
      for (const side of [-1, 1]) {
        const leg = group(parent, side * spread, hip, row);
        mesh(rod, material, leg, 0, -length / 2, 0).scale.set(
          radius,
          length,
          radius,
        );
        legs.push(leg);
      }
    return legs;
  }
  // 四足步态：对角的两条腿一起迈；pace 为真时同侧两条腿一起（长颈鹿）。
  function stride(a, v, legs, dt, legLength, pace = false) {
    const moving = a.speed > 0.05;
    v.phase += dt * (moving ? (4 + a.speed * 1.3) / legLength : 0);
    const s = Math.sin(v.phase) * (!moving ? 0 : a.speed > 2.5 ? 0.7 : 0.32);
    legs[0].rotation.x = s;
    legs[1].rotation.x = -s;
    legs[2].rotation.x = pace ? s : -s;
    legs[3].rotation.x = pace ? -s : s;
    return moving;
  }
  const gallop = (a, v, height) =>
    a.speed > 2.5 ? Math.abs(Math.sin(v.phase)) * height : 0;
  // 鸟的翅膀平时收着（隐藏），飞起来才展开。
  function flightWings(body, material, y, span, z) {
    return [-1, 1].map((side) => {
      const wing = group(body, side * span * 0.15, y, z);
      mesh(wingShape, material, wing, side * span * 0.5, 0, 0).scale.set(
        span * 0.5,
        1,
        span * 0.22,
      );
      wing.visible = false;
      return wing;
    });
  }
  // 受惊（flee）时升到 height 高处扇着翅膀飞，落地后收起翅膀。
  function flight(a, v, wings, time, dt, height, beat) {
    v.lift = ease(v.lift, a.state === 'flee' ? height : 0, dt, 2.5);
    const flying = v.lift > 0.08;
    v.object.position.y += v.lift;
    wings.forEach((wing, i) => {
      wing.visible = flying;
      wing.rotation.z = (i ? 1 : -1) * Math.sin(time * beat + v.seed) * 0.8;
    });
    return flying;
  }

  const builders = {
    hare(root) {
      const body = group(root);
      blob(body, m.hare, [0.15, 0.14, 0.24], [0, 0.2, 0]);
      blob(body, m.hare, [0.14, 0.13, 0.13], [0, 0.17, -0.13]);
      blob(body, m.hareLight, [0.05, 0.05, 0.04], [0, 0.22, -0.26]);
      const head = group(body, 0, 0.27, 0.17);
      blob(head, m.hare, [0.085, 0.085, 0.115], [0, 0.05, 0.06]);
      eyes(head, 0.065, 0.08, 0.1);
      const ears = [-1, 1].map((side) => {
        const ear = group(head, side * 0.03, 0.12, 0.02);
        ear.rotation.z = side * 0.12;
        blob(ear, m.hare, [0.028, 0.12, 0.014], [0, 0.11, 0]);
        return ear;
      });
      return { body, head, ears };
    },
    tortoise(root) {
      const shell = mesh(dome, m.shell, root, 0, 0.06, 0);
      shell.scale.set(1, 0.85, 1.2);
      mesh(rim, m.shellDark, root, 0, 0.065, 0).scale.set(1, 1, 1.2);
      const head = group(root, 0, 0.08, 0.24);
      blob(head, m.reptile, [0.05, 0.045, 0.07], [0, 0, 0.05]);
      eyes(head, 0.035, 0.015, 0.09, 0.009);
      const legs = [];
      for (const x of [-1, 1])
        for (const z of [-1, 1]) {
          const leg = group(root, x * 0.16, 0.07, z * 0.18);
          blob(leg, m.reptile, [0.04, 0.06, 0.04], [0, -0.03, 0]);
          legs.push(leg);
        }
      return { head, legs };
    },
    hedgehog(root) {
      const body = group(root);
      blob(body, m.spines, [0.15, 0.11, 0.18], [0, 0.1, 0], rough);
      blob(
        body,
        m.spineTips,
        [0.14, 0.105, 0.17],
        [0, 0.1, 0],
        rough,
      ).rotation.set(0.6, 0.4, 0.3);
      const face = group(root, 0, 0.07, 0.14);
      const snout = mesh(cone, m.face, face, 0, 0, 0.05);
      snout.scale.set(0.06, 0.13, 0.06);
      snout.rotation.x = Math.PI / 2;
      blob(face, m.eye, [0.014, 0.014, 0.014], [0, 0, 0.115]);
      eyes(face, 0.035, 0.03, 0.03, 0.01);
      return { body, face };
    },
    meerkat(root) {
      for (const side of [-1, 1])
        blob(root, m.meerkat, [0.03, 0.04, 0.05], [side * 0.035, 0.035, 0.01]);
      const body = group(root, 0, 0.07, 0);
      mesh(capsule, m.meerkat, body, 0, 0, 0.11);
      const tail = mesh(cone, m.meerkatDark, body, 0, 0, -0.12);
      tail.scale.set(0.018, 0.22, 0.018);
      tail.rotation.x = -Math.PI / 2;
      for (const side of [-1, 1])
        mesh(rod, m.meerkat, body, side * 0.03, -0.045, 0.2).scale.set(
          0.012,
          0.07,
          0.012,
        );
      const head = group(body, 0, 0.01, 0.25);
      blob(head, m.meerkat, [0.045, 0.045, 0.06], [0, 0.01, 0.03]);
      blob(head, m.meerkatDark, [0.014, 0.014, 0.014], [0, 0, 0.09]);
      for (const side of [-1, 1])
        blob(
          head,
          m.meerkatDark,
          [0.016, 0.012, 0.01],
          [side * 0.026, 0.025, 0.06],
        );
      return { body, head };
    },
    guineafowl(root) {
      const body = group(root);
      blob(body, m.spotted, [0.14, 0.13, 0.19], [0, 0.3, 0]);
      const neck = group(body, 0, 0.36, 0.14);
      mesh(rod, m.neck, neck, 0, 0.06, 0).scale.set(0.024, 0.14, 0.024);
      blob(neck, m.neck, [0.04, 0.04, 0.05], [0, 0.14, 0.02]);
      const casque = mesh(cone, m.casque, neck, 0, 0.19, 0);
      casque.scale.set(0.02, 0.06, 0.02);
      const beak = mesh(cone, m.casque, neck, 0, 0.13, 0.07);
      beak.scale.set(0.012, 0.04, 0.012);
      beak.rotation.x = Math.PI / 2;
      for (const side of [-1, 1])
        blob(neck, m.wattle, [0.012, 0.018, 0.01], [side * 0.02, 0.11, 0.05]);
      eyes(neck, 0.03, 0.15, 0.04, 0.008);
      const legs = [-1, 1].map((side) => {
        const leg = group(root, side * 0.05, 0.22, 0);
        mesh(rod, m.leg, leg, 0, -0.11, 0).scale.set(0.01, 0.22, 0.01);
        return leg;
      });
      return { body, neck, legs };
    },
    agama(root) {
      const body = group(root);
      blob(body, m.agama, [0.05, 0.032, 0.12], [0, 0.045, 0]);
      blob(body, m.agamaHead, [0.04, 0.032, 0.05], [0, 0.06, 0.13]);
      eyes(body, 0.03, 0.07, 0.15, 0.007);
      const tail = mesh(cone, m.agamaTail, body, 0, 0.04, -0.23);
      tail.scale.set(0.025, 0.26, 0.02);
      tail.rotation.x = -Math.PI / 2;
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          blob(
            body,
            m.agamaTail,
            [0.03, 0.01, 0.012],
            [x * 0.065, 0.02, z * 0.06],
          );
      return { body };
    },
    beetle(root) {
      const ball = group(root, 0, 0.07, 0.1);
      blob(ball, m.dung, [0.07, 0.07, 0.07], [0, 0, 0]);
      const bug = group(root, 0, 0.03, -0.01);
      bug.rotation.y = Math.PI;
      blob(bug, m.beetle, [0.032, 0.022, 0.042], [0, 0, 0]);
      blob(bug, m.beetle, [0.022, 0.016, 0.018], [0, -0.005, 0.045]);
      return { ball, bug };
    },
    butterfly(root) {
      const body = group(root);
      const thorax = mesh(rod, m.wingEdge, body);
      thorax.scale.set(0.006, 0.07, 0.006);
      thorax.rotation.x = Math.PI / 2;
      const wings = [-1, 1].map((side) => {
        const wing = group(body, side * 0.004, 0, 0);
        const fore = mesh(wingShape, m.wing, wing, side * 0.035, 0, 0.012);
        fore.scale.set(0.038, 1, 0.028);
        const hind = mesh(
          wingShape,
          m.wingEdge,
          wing,
          side * 0.028,
          -0.001,
          -0.02,
        );
        hind.scale.set(0.026, 1, 0.02);
        return wing;
      });
      return { body, wings };
    },
    zebra(root) {
      const body = group(root);
      blob(body, m.zebra, [0.29, 0.34, 0.95], [0, 1.12, 0]);
      const neck = group(body, 0, 1.3, 0.6);
      blob(neck, m.zebra, [0.13, 0.4, 0.17], [0, 0.3, 0.16]).rotation.x = 0.45;
      blob(neck, m.mane, [0.035, 0.4, 0.07], [0, 0.36, 0.06]).rotation.x = 0.45;
      const head = group(neck, 0, 0.58, 0.34);
      blob(head, m.zebra, [0.11, 0.12, 0.3], [0, -0.06, 0.2]).rotation.x = 0.55;
      blob(head, m.muzzle, [0.08, 0.08, 0.09], [0, -0.2, 0.42]);
      for (const side of [-1, 1]) {
        const ear = mesh(cone, m.zebra, head, side * 0.07, 0.1, 0);
        ear.scale.set(0.035, 0.12, 0.03);
        ear.rotation.z = -side * 0.25;
      }
      const legs = hoofed(root, m.zebraLeg, 0.95, 0.045, 0.17, 0.52);
      const tail = group(body, 0, 1.24, -0.8);
      mesh(rod, m.zebra, tail, 0, -0.25, 0).scale.set(0.018, 0.5, 0.018);
      blob(tail, m.mane, [0.035, 0.1, 0.035], [0, -0.52, 0]);
      return { body, neck, head, legs, tail };
    },
    giraffe(root) {
      const body = group(root);
      blob(body, m.giraffe, [0.32, 0.4, 0.95], [0, 2.05, 0]).rotation.x = -0.18;
      const neck = group(body, 0, 2.3, 0.6);
      blob(neck, m.giraffe, [0.13, 0.95, 0.15], [0, 0.85, 0.22]).rotation.x =
        0.26;
      blob(neck, m.mane, [0.03, 0.85, 0.05], [0, 0.85, 0.11]).rotation.x = 0.26;
      const head = group(neck, 0, 1.72, 0.48);
      blob(head, m.giraffe, [0.1, 0.12, 0.27], [0, 0, 0.16]).rotation.x = 0.3;
      blob(head, m.giraffeLight, [0.07, 0.07, 0.08], [0, -0.07, 0.36]);
      for (const side of [-1, 1]) {
        mesh(rod, m.giraffeLight, head, side * 0.05, 0.16, 0.02).scale.set(
          0.018,
          0.14,
          0.018,
        );
        blob(head, m.mane, [0.026, 0.026, 0.026], [side * 0.05, 0.24, 0.02]);
        const ear = blob(
          head,
          m.giraffeLight,
          [0.025, 0.06, 0.02],
          [side * 0.11, 0.1, -0.02],
        );
        ear.rotation.z = -side * 1.1;
      }
      eyes(head, 0.085, 0.04, 0.12, 0.018);
      const legs = [
        ...hoofed(root, m.giraffeLight, 1.75, 0.055, 0.2, 0.5, true),
        ...hoofed(root, m.giraffeLight, 1.62, 0.05, 0.2, -0.55, true),
      ];
      const tail = group(body, 0, 2.05, -0.82);
      mesh(rod, m.giraffe, tail, 0, -0.35, 0).scale.set(0.02, 0.7, 0.02);
      blob(tail, m.mane, [0.04, 0.12, 0.04], [0, -0.74, 0]);
      return { body, neck, head, legs, tail };
    },
    elephant(root, sim, scale) {
      const body = group(root);
      blob(body, m.elephant, [0.85, 0.92, 1.35], [0, 1.95, 0]);
      const head = group(body, 0, 2.3, 1.25);
      blob(head, m.elephant, [0.52, 0.6, 0.55], [0, 0, 0.18]);
      eyes(head, 0.36, 0.08, 0.5, 0.04);
      // 鼻子是三节，每一节都挂在上一节的末端。
      const trunk = [];
      let joint = head;
      for (const [y, z, radius, length] of [
        [-0.3, 0.55, 0.15, 0.62],
        [-0.6, 0, 0.12, 0.56],
        [-0.54, 0, 0.085, 0.52],
      ]) {
        joint = group(joint, 0, y, z);
        mesh(rod, m.elephant, joint, 0, -length / 2, 0).scale.set(
          radius,
          length,
          radius,
        );
        trunk.push(joint);
      }
      const ears = [-1, 1].map((side) => {
        const ear = group(head, side * 0.42, 0.12, 0.02);
        blob(
          ear,
          m.elephantEar,
          [0.05, 0.78, 0.64],
          [side * 0.05, -0.16, -0.5],
        );
        return ear;
      });
      if (scale > 0.6)
        for (const side of [-1, 1]) {
          const tusk = mesh(cone, m.ivory, head, side * 0.22, -0.38, 0.56);
          tusk.scale.set(0.055, 0.55, 0.055);
          tusk.rotation.x = 2.1;
        }
      const legs = hoofed(root, m.elephant, 1.35, 0.22, 0.42, 0.72);
      const tail = group(body, 0, 2.2, -1.32);
      mesh(rod, m.elephant, tail, 0, -0.4, 0).scale.set(0.03, 0.8, 0.03);
      return { body, head, trunk, ears, legs, tail };
    },
    warthog(root) {
      // 身体以后腿上端为轴：低头吃草时前半身跪下去，后腿保持站立。
      const body = group(root, 0, 0.44, -0.3);
      blob(body, m.warthog, [0.24, 0.29, 0.55], [0, 0.12, 0.3]);
      blob(body, m.mane, [0.03, 0.06, 0.42], [0, 0.39, 0.3]);
      const head = group(body, 0, 0.12, 0.78);
      blob(head, m.warthog, [0.16, 0.19, 0.25], [0, -0.06, 0.12]);
      blob(head, m.muzzle, [0.08, 0.07, 0.04], [0, -0.13, 0.36]);
      for (const side of [-1, 1]) {
        blob(head, m.warthog, [0.04, 0.05, 0.04], [side * 0.16, 0, 0.18]);
        const tusk = mesh(cone, m.ivory, head, side * 0.1, -0.12, 0.3);
        tusk.scale.set(0.022, 0.16, 0.022);
        tusk.rotation.set(-0.3, 0, -side * 0.9);
        const ear = mesh(cone, m.warthog, head, side * 0.1, 0.12, -0.02);
        ear.scale.set(0.035, 0.1, 0.025);
        ear.rotation.z = -side * 0.6;
      }
      eyes(head, 0.1, 0.05, 0.16, 0.014);
      const front = hoofed(body, m.warthog, 0.44, 0.04, 0.12, 0.62, true, 0),
        back = hoofed(body, m.warthog, 0.44, 0.04, 0.12, 0, true, 0);
      const tail = group(body, 0, 0.22, -0.24);
      mesh(rod, m.warthog, tail, 0, -0.17, 0).scale.set(0.01, 0.34, 0.01);
      blob(tail, m.mane, [0.02, 0.05, 0.02], [0, -0.36, 0]);
      return { body, head, front, back, tail };
    },
    ostrich(root, sim) {
      const plumage = sim.id % 2 ? m.ostrichHen : m.ostrich,
        body = group(root);
      blob(body, plumage, [0.4, 0.34, 0.52], [0, 1.25, 0]);
      blob(body, m.plume, [0.22, 0.16, 0.18], [0, 1.32, -0.48]);
      const wings = [-1, 1].map((side) => {
        const wing = group(body, side * 0.36, 1.32, 0.02);
        blob(
          wing,
          sim.id % 2 ? plumage : m.plume,
          [0.06, 0.2, 0.36],
          [side * 0.04, -0.06, -0.06],
        );
        return wing;
      });
      const neck = group(body, 0, 1.42, 0.38);
      mesh(rod, m.ostrichSkin, neck, 0, 0.45, 0.04).scale.set(
        0.045,
        0.9,
        0.045,
      );
      const head = group(neck, 0, 0.92, 0.08);
      blob(head, m.ostrichSkin, [0.07, 0.065, 0.09], [0, 0, 0]);
      const beak = mesh(cone, m.casque, head, 0, -0.01, 0.11);
      beak.scale.set(0.035, 0.09, 0.02);
      beak.rotation.x = Math.PI / 2;
      eyes(head, 0.05, 0.02, 0.03, 0.02);
      const legs = [-1, 1].map((side) => {
        const leg = group(root, side * 0.14, 1.1, 0);
        mesh(rod, m.ostrichSkin, leg, 0, -0.55, 0).scale.set(0.045, 1.1, 0.045);
        blob(leg, m.ostrichSkin, [0.05, 0.03, 0.1], [0, -1.08, 0.05]);
        return leg;
      });
      return { body, wings, neck, head, legs };
    },
    crane(root) {
      const body = group(root);
      blob(body, m.crane, [0.15, 0.17, 0.27], [0, 0.72, 0]);
      const wings = [-1, 1].map((side) => {
        const wing = group(body, side * 0.12, 0.8, 0.04);
        blob(wing, m.plume, [0.04, 0.12, 0.25], [side * 0.03, -0.04, -0.06]);
        blob(
          wing,
          m.wingGold,
          [0.035, 0.07, 0.12],
          [side * 0.04, -0.09, -0.24],
        );
        return wing;
      });
      const neck = group(body, 0, 0.8, 0.18);
      mesh(rod, m.crane, neck, 0, 0.16, 0.03).scale.set(0.03, 0.34, 0.03);
      const head = group(neck, 0, 0.34, 0.05);
      blob(head, m.leg, [0.045, 0.05, 0.065], [0, 0, 0]);
      for (const side of [-1, 1])
        blob(head, m.plume, [0.012, 0.03, 0.03], [side * 0.04, 0, 0.01]);
      blob(head, m.wattle, [0.02, 0.03, 0.02], [0, -0.05, 0.03]);
      for (let i = 0; i < 7; i++) {
        const spike = mesh(cone, m.crown, head, 0, 0.05, -0.01);
        spike.scale.set(0.012, 0.11, 0.012);
        spike.rotation.set(-0.5 + (i % 2) * 0.2, (i - 3) * 0.32, 0);
      }
      const beak = mesh(cone, m.leg, head, 0, -0.01, 0.08);
      beak.scale.set(0.012, 0.06, 0.012);
      beak.rotation.x = Math.PI / 2;
      eyes(head, 0.032, 0.012, 0.035, 0.008);
      const legs = [-1, 1].map((side) => {
        const leg = group(root, side * 0.05, 0.62, 0);
        mesh(rod, m.leg, leg, 0, -0.31, 0).scale.set(0.011, 0.62, 0.011);
        return leg;
      });
      return { body, wings, neck, head, legs };
    },
    egret(root) {
      const body = group(root);
      blob(body, m.egret, [0.07, 0.08, 0.13], [0, 0.32, 0]);
      blob(body, m.wingGold, [0.05, 0.03, 0.08], [0, 0.39, -0.02]);
      const wings = flightWings(body, m.egretWing, 0.36, 0.4, 0);
      const neck = group(body, 0, 0.36, 0.08);
      mesh(rod, m.egret, neck, 0, 0.06, 0.02).scale.set(0.018, 0.13, 0.018);
      const head = group(neck, 0, 0.13, 0.03);
      blob(head, m.egret, [0.03, 0.03, 0.045], [0, 0, 0]);
      blob(head, m.wingGold, [0.022, 0.018, 0.03], [0, 0.022, -0.01]);
      const beak = mesh(cone, m.bill, head, 0, -0.005, 0.06);
      beak.scale.set(0.008, 0.055, 0.008);
      beak.rotation.x = Math.PI / 2;
      eyes(head, 0.022, 0.008, 0.02, 0.005);
      const legs = [-1, 1].map((side) => {
        const leg = group(root, side * 0.025, 0.26, 0);
        mesh(rod, m.legYellow, leg, 0, -0.13, 0).scale.set(0.006, 0.26, 0.006);
        return leg;
      });
      return { body, wings, neck, head, legs };
    },
    weaver(root) {
      const body = group(root);
      blob(body, m.weaver, [0.038, 0.036, 0.06], [0, 0.05, 0]);
      const head = group(body, 0, 0.075, 0.045);
      blob(head, m.weaver, [0.026, 0.026, 0.026], [0, 0, 0]);
      blob(head, m.mask, [0.022, 0.02, 0.016], [0, -0.003, 0.014]);
      const beak = mesh(cone, m.mask, head, 0, -0.004, 0.032);
      beak.scale.set(0.008, 0.02, 0.008);
      beak.rotation.x = Math.PI / 2;
      const wings = flightWings(body, m.weaverWing, 0.06, 0.12, 0);
      return { body, head, wings };
    },
    hyrax(root) {
      const body = group(root);
      blob(body, m.hyrax, [0.13, 0.12, 0.22], [0, 0.12, 0]);
      const head = group(body, 0, 0.17, 0.18);
      blob(head, m.hyrax, [0.075, 0.075, 0.085], [0, 0, 0.03]);
      blob(head, m.muzzle, [0.022, 0.018, 0.016], [0, -0.01, 0.11]);
      for (const side of [-1, 1])
        blob(head, m.hyrax, [0.025, 0.025, 0.012], [side * 0.05, 0.06, -0.01]);
      eyes(head, 0.045, 0.02, 0.08, 0.01);
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          blob(
            body,
            m.muzzle,
            [0.025, 0.015, 0.035],
            [x * 0.08, 0.012, z * 0.12],
          );
      return { body, head };
    },
    chameleon(root) {
      // 只有一只，体色材质单独创建，好按情绪变色。
      const skin = flat(CALM.getStyle()),
        body = group(root);
      blob(body, skin, [0.026, 0.045, 0.075], [0, 0.05, 0]);
      const head = group(body, 0, 0.065, 0.07);
      blob(head, skin, [0.025, 0.03, 0.04], [0, 0, 0.02]);
      const casque = mesh(cone, skin, head, 0, 0.03, -0.01);
      casque.scale.set(0.018, 0.04, 0.025);
      casque.rotation.x = -0.6;
      for (const side of [-1, 1]) {
        blob(head, skin, [0.012, 0.012, 0.012], [side * 0.022, 0.008, 0.025]);
        blob(head, m.eye, [0.005, 0.005, 0.005], [side * 0.033, 0.008, 0.027]);
      }
      const tail = mesh(tailCurl, skin, body, 0, 0.02, -0.1);
      tail.rotation.y = Math.PI / 2;
      for (const x of [-1, 1])
        for (const z of [-1, 1]) {
          const leg = mesh(rod, skin, body, x * 0.024, 0.02, z * 0.04);
          leg.scale.set(0.005, 0.045, 0.005);
          leg.rotation.z = x * 0.6;
        }
      return { body, head, skin };
    },
    frog(root) {
      const body = group(root);
      blob(body, m.frog, [0.04, 0.028, 0.055], [0, 0.035, 0]);
      blob(body, m.frog, [0.034, 0.024, 0.032], [0, 0.045, 0.045]);
      for (const side of [-1, 1]) {
        blob(
          body,
          m.frogEye,
          [0.011, 0.011, 0.011],
          [side * 0.02, 0.063, 0.05],
        );
        blob(body, m.eye, [0.005, 0.005, 0.005], [side * 0.026, 0.066, 0.056]);
      }
      const legs = [-1, 1].map((side) => {
        const leg = group(body, side * 0.034, 0.024, -0.03);
        blob(leg, m.frog, [0.016, 0.014, 0.045], [side * 0.008, 0, 0]);
        return leg;
      });
      return { body, legs };
    },
    jackal(root) {
      const body = group(root);
      blob(body, m.jackal, [0.1, 0.12, 0.3], [0, 0.42, 0]);
      blob(body, m.saddle, [0.085, 0.06, 0.25], [0, 0.5, -0.02]);
      const head = group(body, 0, 0.52, 0.28);
      blob(head, m.jackal, [0.062, 0.062, 0.072], [0, 0.02, 0.02]);
      blob(head, m.jackal, [0.032, 0.03, 0.08], [0, -0.01, 0.1]);
      blob(head, m.eye, [0.011, 0.01, 0.01], [0, 0, 0.18]);
      for (const side of [-1, 1]) {
        const ear = mesh(cone, m.jackal, head, side * 0.04, 0.1, -0.01);
        ear.scale.set(0.035, 0.11, 0.02);
        ear.rotation.z = -side * 0.2;
      }
      eyes(head, 0.034, 0.035, 0.065, 0.009);
      const legs = hoofed(root, m.jackal, 0.34, 0.02, 0.07, 0.19);
      const tail = group(body, 0, 0.47, -0.3);
      tail.rotation.x = 0.5;
      blob(tail, m.jackal, [0.04, 0.04, 0.15], [0, 0, -0.13]);
      blob(tail, m.mane, [0.03, 0.03, 0.05], [0, 0, -0.27]);
      return { body, head, legs, tail };
    },
    dikdik(root, sim) {
      const body = group(root);
      blob(body, m.dikdik, [0.075, 0.1, 0.17], [0, 0.32, 0]);
      const head = group(body, 0, 0.42, 0.15);
      blob(head, m.dikdik, [0.04, 0.045, 0.06], [0, 0.02, 0.02]);
      blob(head, m.dikdik, [0.02, 0.02, 0.05], [0, -0.01, 0.08]);
      for (const side of [-1, 1]) {
        blob(
          head,
          m.eyeRing,
          [0.014, 0.014, 0.012],
          [side * 0.032, 0.035, 0.04],
        );
        blob(head, m.eye, [0.009, 0.009, 0.009], [side * 0.038, 0.035, 0.043]);
        const ear = blob(
          head,
          m.dikdik,
          [0.018, 0.045, 0.01],
          [side * 0.04, 0.08, -0.01],
        );
        ear.rotation.z = -side * 0.5;
        // 雄犬羚有一对短短的角。
        if (sim.id % 2 === 0) {
          const horn = mesh(cone, m.horn, head, side * 0.016, 0.075, 0);
          horn.scale.set(0.007, 0.05, 0.007);
          horn.rotation.x = -0.4;
        }
      }
      const legs = hoofed(root, m.dikdik, 0.27, 0.011, 0.045, 0.1);
      return { body, head, legs };
    },
    goat(root, sim) {
      const coat = m.goats[sim.id % m.goats.length],
        body = group(root);
      blob(body, coat, [0.16, 0.19, 0.34], [0, 0.58, 0]);
      const head = group(body, 0, 0.72, 0.3);
      blob(head, coat, [0.065, 0.075, 0.13], [0, -0.02, 0.08]).rotation.x =
        0.45;
      blob(head, m.muzzle, [0.022, 0.035, 0.02], [0, -0.13, 0.12]);
      for (const side of [-1, 1]) {
        const horn = mesh(cone, m.horn, head, side * 0.03, 0.08, -0.01);
        horn.scale.set(0.014, 0.11, 0.014);
        horn.rotation.x = -0.75;
        const ear = blob(
          head,
          coat,
          [0.05, 0.016, 0.025],
          [side * 0.07, 0.02, 0],
        );
        ear.rotation.z = side * 0.5;
      }
      eyes(head, 0.05, 0.03, 0.08, 0.009);
      const legs = hoofed(root, coat, 0.42, 0.024, 0.09, 0.21);
      const tail = mesh(cone, coat, body, 0, 0.72, -0.33);
      tail.scale.set(0.02, 0.08, 0.02);
      tail.rotation.x = -0.5;
      return { body, head, legs };
    },
    dog(root) {
      const body = group(root);
      blob(body, m.dog, [0.12, 0.14, 0.3], [0, 0.48, 0]);
      blob(body, m.dogLight, [0.08, 0.08, 0.06], [0, 0.48, 0.26]);
      const head = group(body, 0, 0.6, 0.3);
      blob(head, m.dog, [0.075, 0.075, 0.085], [0, 0.02, 0.02]);
      blob(head, m.dogLight, [0.042, 0.04, 0.075], [0, -0.02, 0.11]);
      blob(head, m.eye, [0.016, 0.014, 0.012], [0, 0, 0.185]);
      for (const side of [-1, 1]) {
        const ear = mesh(cone, m.dog, head, side * 0.045, 0.1, -0.01);
        ear.scale.set(0.03, 0.08, 0.02);
        ear.rotation.z = -side * 0.25;
      }
      eyes(head, 0.04, 0.04, 0.07, 0.01);
      const legs = hoofed(root, m.dog, 0.38, 0.024, 0.08, 0.2);
      const tail = group(body, 0, 0.56, -0.3);
      mesh(rod, m.dog, tail, 0, 0.13, 0).scale.set(0.018, 0.28, 0.018);
      return { body, head, legs, tail };
    },
  };

  const posers = {
    hare(a, v, p, time, dt) {
      const moving = a.speed > 0.05;
      v.phase += dt * (moving ? 6 + a.speed * 1.4 : 0);
      p.body.position.y = moving
        ? Math.abs(Math.sin(v.phase)) * Math.min(0.22, 0.05 + a.speed * 0.025)
        : 0;
      p.body.rotation.x = moving ? -Math.cos(v.phase) * 0.12 : 0;
      const alert = ALERT.has(a.state);
      p.head.rotation.x = ease(
        p.head.rotation.x,
        a.state === 'forage' ? 0.55 : alert ? -0.15 : 0.1,
        dt,
      );
      const ear = a.state === 'rest' ? -1.1 : alert ? 0 : -0.35;
      for (const e of p.ears) e.rotation.x = ease(e.rotation.x, ear, dt, 8);
    },
    tortoise(a, v, p, time, dt) {
      v.tuck = ease(v.tuck, a.state === 'withdrawn' ? 1 : 0, dt, 3);
      p.head.position.z = 0.24 - 0.13 * v.tuck;
      p.head.scale.setScalar(1 - 0.65 * v.tuck);
      p.head.rotation.x = ease(
        p.head.rotation.x,
        a.state === 'notice' ? -0.4 : a.state === 'forage' ? 0.3 : 0,
        dt,
        2,
      );
      v.phase += dt * a.speed * 30;
      p.legs.forEach((leg, i) => {
        leg.scale.y = 1 - 0.6 * v.tuck;
        leg.rotation.x =
          Math.sin(v.phase + (i % 3 ? Math.PI : 0)) *
          0.4 *
          Math.min(1, a.speed * 10);
      });
    },
    hedgehog(a, v, p, time, dt) {
      v.tuck = ease(v.tuck, a.state === 'curled' ? 1 : 0, dt, 5);
      const c = v.tuck;
      p.body.scale.set(1 - 0.12 * c, 1 + 0.18 * c, 1 - 0.22 * c);
      p.face.scale.setScalar(Math.max(0.001, 1 - c));
      v.phase += dt * a.speed * 40;
      v.object.rotation.z = Math.sin(v.phase) * 0.06 * Math.min(1, a.speed * 4);
      p.face.rotation.x =
        a.state === 'forage' || a.state === 'notice'
          ? Math.sin(time * 9 + v.seed) * 0.1 + 0.15
          : 0;
    },
    meerkat(a, v, p, time, dt) {
      const upright = UPRIGHT.has(a.state) ? 1 : 0;
      v.upright = ease(v.upright, upright, dt, 5);
      p.body.rotation.x = -1.3 * v.upright;
      p.head.rotation.x =
        1.2 * v.upright +
        (a.state === 'forage'
          ? 0.55 + Math.sin(time * 11 + v.seed) * 0.12
          : 0) *
          (1 - v.upright);
      v.sink = ease(v.sink, a.hidden ? 1 : 0, dt, 4);
      v.object.position.y -= 0.4 * v.sink;
      v.object.visible = v.sink < 0.97;
      v.phase += dt * a.speed * 9;
      p.body.position.y =
        0.07 + Math.abs(Math.sin(v.phase)) * 0.03 * Math.min(1, a.speed);
    },
    guineafowl(a, v, p, time, dt) {
      const moving = a.speed > 0.05;
      v.phase += dt * (moving ? 5 + a.speed * 5 : 0);
      p.legs[0].rotation.x = moving ? Math.sin(v.phase) * 0.6 : 0;
      p.legs[1].rotation.x = moving ? -Math.sin(v.phase) * 0.6 : 0;
      p.body.position.y = moving ? Math.abs(Math.cos(v.phase)) * 0.025 : 0;
      p.neck.position.z = 0.14 + (moving ? Math.sin(v.phase * 2) * 0.025 : 0);
      const peck =
        a.state === 'forage'
          ? Math.max(0, Math.sin(time * 3 + v.seed)) * 1.1
          : 0;
      p.neck.rotation.x = ease(
        p.neck.rotation.x,
        a.state === 'notice' || a.state === 'alert' ? -0.2 : peck,
        dt,
        10,
      );
    },
    agama(a, v, p, time) {
      const bobbing =
        a.state === 'display' ||
        (PERCHED.has(a.state) && Math.sin(time * 0.7 + v.seed) > 0.8);
      p.body.position.y = bobbing ? Math.abs(Math.sin(time * 9)) * 0.03 : 0;
      p.body.rotation.x = bobbing ? -Math.abs(Math.sin(time * 9)) * 0.2 : 0;
      v.object.rotation.z = a.speed > 0.05 ? Math.sin(time * 30) * 0.08 : 0;
    },
    beetle(a, v, p, time, dt) {
      p.ball.rotation.x += (a.speed * dt) / 0.07;
      const dance = a.state === 'rest' ? 1 : 0;
      v.upright = ease(v.upright, dance, dt, 3);
      p.bug.position.set(0, 0.03 + 0.12 * v.upright, -0.01 + 0.11 * v.upright);
      p.bug.rotation.x = -0.5 * (1 - v.upright);
      if (dance) p.bug.rotation.y += dt * 2.4;
      else p.bug.rotation.y = ease(p.bug.rotation.y, Math.PI, dt, 4);
    },
    butterfly(a, v, p, time, dt) {
      const perched = PERCHED.has(a.state);
      const lift = perched ? 0.42 : 0.75 + Math.sin(time * 2.1 + v.seed) * 0.22;
      v.lift = ease(v.lift, lift + (a.state === 'flee' ? 0.6 : 0), dt, 3);
      v.object.position.y += v.lift;
      const flap = perched
        ? 0.25 + Math.sin(time * 1.6 + v.seed) * 0.55
        : Math.sin(time * 22 + v.seed) * 0.9 + 0.3;
      p.wings[0].rotation.z = -flap;
      p.wings[1].rotation.z = flap;
      v.visit = ease(v.visit, a.state === 'visit' && v.hand ? 1 : 0, dt, 2);
      if (v.visit > 0.001) v.object.position.lerp(v3.copy(v.hand), v.visit);
    },
    zebra(a, v, p, time, dt) {
      const moving = stride(a, v, p.legs, dt, 0.95);
      v.object.position.y += gallop(a, v, 0.06);
      p.neck.rotation.x = ease(
        p.neck.rotation.x,
        a.state === 'forage'
          ? 1.15
          : ALERT.has(a.state)
            ? -0.25
            : a.state === 'rest'
              ? 0.3
              : moving
                ? 0.15
                : 0.35,
        dt,
        4,
      );
      p.head.rotation.x =
        a.state === 'forage' ? Math.sin(time * 5 + v.seed) * 0.05 : 0;
      p.tail.rotation.z = Math.sin(time * 1.7 + v.seed) * 0.25;
    },
    giraffe(a, v, p, time, dt) {
      // 长颈鹿慢走时同侧两条腿一起迈。
      const moving = stride(a, v, p.legs, dt, 1.7, true);
      const browsing = a.state === 'forage';
      p.neck.rotation.x = ease(
        p.neck.rotation.x,
        browsing ? -0.12 : moving ? 0.22 + Math.sin(v.phase * 2) * 0.06 : 0,
        dt,
        3,
      );
      p.head.rotation.x = ease(
        p.head.rotation.x,
        browsing ? -0.5 + Math.sin(time * 1.3 + v.seed) * 0.12 : 0,
        dt,
        3,
      );
      p.tail.rotation.z = Math.sin(time * 1.4 + v.seed) * 0.2;
    },
    elephant(a, v, p, time, dt) {
      stride(a, v, p.legs, dt, 1.35);
      const warning = a.state === 'warn';
      v.spread = ease(v.spread, warning ? 1 : 0, dt, 3);
      // 平时慢慢扇耳朵散热；警告时把耳朵整个张开，抬头举起鼻子。
      // 耳朵贴在头后侧，左耳正转、右耳反转才是向外张。
      const flap = Math.max(0, Math.sin(time * 0.9 + v.seed)) * 0.35,
        open = (0.15 + flap) * (1 - v.spread) + 1.05 * v.spread;
      p.ears[0].rotation.y = open;
      p.ears[1].rotation.y = -open;
      p.head.rotation.x = ease(p.head.rotation.x, warning ? -0.3 : 0.05, dt, 3);
      const sway = Math.sin(time * 1.1 + v.seed),
        feeding =
          a.state === 'forage' ? Math.max(0, Math.sin(time * 0.8 + v.seed)) : 0;
      // 鼻子三节：平时随步子轻摆，吃东西时一节节卷起，警告时向前高举。
      for (let i = 0; i < 3; i++) {
        const curl =
          TRUNK_REST[i] + sway * TRUNK_SWAY[i] + feeding * TRUNK_CURL[i];
        p.trunk[i].rotation.x = ease(
          p.trunk[i].rotation.x,
          warning ? TRUNK_RAISED[i] : curl,
          dt,
          3,
        );
      }
      p.tail.rotation.z = Math.sin(time * 1.2 + v.seed) * 0.2;
    },
    warthog(a, v, p, time, dt) {
      const moving = a.speed > 0.05,
        kneel = a.state === 'forage' && !moving ? 1 : 0;
      v.tuck = ease(v.tuck, kneel, dt, 4);
      v.phase += dt * (moving ? (4 + a.speed * 1.3) / 0.44 : 0);
      const amp = !moving ? 0 : a.speed > 2 ? 0.7 : 0.35,
        s = Math.sin(v.phase) * amp;
      // 跪下吃草：前半身压低，前腿向后折，后腿保持竖直。
      p.body.rotation.x = 0.35 * v.tuck;
      p.front[0].rotation.x = 1.25 * v.tuck + s;
      p.front[1].rotation.x = 1.25 * v.tuck - s;
      p.back[0].rotation.x = -0.35 * v.tuck - s;
      p.back[1].rotation.x = -0.35 * v.tuck + s;
      v.object.position.y +=
        a.speed > 2 ? Math.abs(Math.sin(v.phase)) * 0.06 : 0;
      p.head.rotation.x = ease(
        p.head.rotation.x,
        ALERT.has(a.state) && a.state !== 'flee' ? -0.25 : 0.15 * v.tuck,
        dt,
        5,
      );
      // 逃跑时尾巴竖得笔直，像一根天线。
      p.tail.rotation.x = ease(
        p.tail.rotation.x,
        a.state === 'flee' ? 2.9 : 0.3,
        dt,
        6,
      );
    },
    ostrich(a, v, p, time, dt) {
      const moving = a.speed > 0.05,
        running = a.speed > 2;
      v.phase += dt * (moving ? 3 + a.speed * 1.1 : 0);
      const s = moving ? Math.sin(v.phase) * (running ? 0.85 : 0.45) : 0;
      p.legs[0].rotation.x = s;
      p.legs[1].rotation.x = -s;
      v.object.position.y += running ? Math.abs(Math.cos(v.phase)) * 0.08 : 0;
      const peck =
        a.state === 'forage'
          ? 1.3 + Math.max(0, Math.sin(time * 2.4 + v.seed)) * 0.4
          : 0;
      p.neck.rotation.x = ease(
        p.neck.rotation.x,
        peck ||
          (ALERT.has(a.state)
            ? -0.12
            : moving
              ? Math.sin(v.phase * 2) * 0.08
              : 0.05),
        dt,
        6,
      );
      p.head.rotation.x = -p.neck.rotation.x * 0.5;
      v.spread = ease(v.spread, running ? 1 : 0, dt, 4);
      p.wings[0].rotation.z = -0.75 * v.spread;
      p.wings[1].rotation.z = 0.75 * v.spread;
    },
    crane(a, v, p, time, dt) {
      const moving = a.speed > 0.05;
      v.phase += dt * (moving ? 5 + a.speed * 3 : 0);
      const s = moving ? Math.sin(v.phase) * 0.5 : 0;
      p.legs[0].rotation.x = s;
      p.legs[1].rotation.x = -s;
      // rest 时成对跳舞：张开翅膀、跳起、鞠躬。
      const dancing = a.state === 'rest' ? 1 : 0;
      v.spread = ease(
        v.spread,
        Math.max(dancing, a.state === 'flee' ? 0.5 : 0),
        dt,
        4,
      );
      const beat = Math.sin(time * 4 + v.seed);
      p.wings[0].rotation.z = -(1.3 + beat * 0.25 * dancing) * v.spread;
      p.wings[1].rotation.z = (1.3 + beat * 0.25 * dancing) * v.spread;
      v.object.position.y += dancing * Math.max(0, beat) * 0.22;
      const dip =
        a.state === 'forage'
          ? Math.max(0, Math.sin(time * 2 + v.seed)) * 1.1
          : 0;
      p.neck.rotation.x = ease(
        p.neck.rotation.x,
        dancing
          ? 0.4 + Math.sin(time * 2 + v.seed) * 0.5
          : ALERT.has(a.state)
            ? -0.2
            : dip,
        dt,
        6,
      );
    },
    egret(a, v, p, time, dt) {
      const flying = flight(a, v, p.wings, time, dt, 2.2, 14);
      const moving = a.speed > 0.05 && !flying;
      v.phase += dt * (moving ? 7 + a.speed * 4 : 0);
      const s = moving ? Math.sin(v.phase) * 0.5 : 0;
      p.legs[0].rotation.x = flying ? -1.2 : s;
      p.legs[1].rotation.x = flying ? -1.2 : -s;
      p.neck.position.z = 0.08 + (moving ? Math.sin(v.phase * 2) * 0.02 : 0);
      const strike =
        a.state === 'forage'
          ? Math.max(0, Math.sin(time * 3.2 + v.seed) - 0.6) * 2.4
          : 0;
      p.neck.rotation.x = ease(
        p.neck.rotation.x,
        flying ? -0.4 : strike,
        dt,
        12,
      );
    },
    weaver(a, v, p, time, dt) {
      const flying = flight(a, v, p.wings, time, dt, 3.4, 26);
      const moving = a.speed > 0.05 && !flying;
      v.phase += dt * (moving ? 18 : 0);
      p.body.position.y = moving ? Math.abs(Math.sin(v.phase)) * 0.03 : 0;
      p.head.rotation.x =
        a.state === 'forage' && !flying
          ? Math.max(0, Math.sin(time * 6 + v.seed)) * 0.8
          : 0;
    },
    hyrax(a, v, p, time, dt) {
      v.upright = ease(v.upright, a.state === 'sentinel' ? 1 : 0, dt, 5);
      p.body.rotation.x = -0.6 * v.upright;
      p.head.rotation.x = 0.45 * v.upright;
      const basking = a.state === 'rest' ? 1 : 0;
      v.tuck = ease(v.tuck, basking, dt, 2);
      p.body.scale.set(1 + 0.12 * v.tuck, 1 - 0.18 * v.tuck, 1);
      v.sink = ease(v.sink, a.hidden ? 1 : 0, dt, 4);
      v.object.position.y -= 0.35 * v.sink;
      v.object.visible = v.sink < 0.97;
      v.phase += dt * a.speed * 22;
      p.body.position.y =
        Math.abs(Math.sin(v.phase)) * 0.03 * Math.min(1, a.speed);
    },
    chameleon(a, v, p, time, dt) {
      // 受惊时颜色变暗、身体侧扁地鼓起；僵住时前后摇晃，模仿被风吹动的叶子。
      const tense = a.state === 'freeze' || a.state === 'display' ? 1 : 0;
      v.tuck = ease(v.tuck, tense, dt, 1.5);
      p.skin.color.lerpColors(CALM, TENSE, v.tuck);
      p.body.scale.x = 1 + (a.state === 'display' ? 0.6 : 0) * v.tuck;
      p.body.rotation.z = Math.sin(time * 1.3 + v.seed) * 0.14 * v.tuck;
      p.body.position.x = Math.sin(time * 0.9 + v.seed) * 0.01 * v.tuck;
    },
    frog(a, v, p, time, dt) {
      const moving = a.speed > 0.05;
      v.phase += dt * (moving ? 7 : 0);
      const hop = moving ? Math.abs(Math.sin(v.phase)) : 0;
      p.body.position.y = hop * 0.1;
      for (const leg of p.legs) leg.scale.z = 1 + hop * 0.8;
      p.body.rotation.x = ease(
        p.body.rotation.x,
        a.state === 'sentinel' ? -0.3 : 0,
        dt,
        5,
      );
      // 躲进水里：沉到水面以下。
      v.sink = ease(v.sink, a.hidden ? 1 : 0, dt, 5);
      v.object.position.y -= 0.14 * v.sink;
      v.object.visible = v.sink < 0.97;
    },
    jackal(a, v, p, time, dt) {
      stride(a, v, p.legs, dt, 0.34);
      v.object.position.y += gallop(a, v, 0.05);
      p.head.rotation.x = ease(
        p.head.rotation.x,
        a.state === 'forage' ? 0.7 : ALERT.has(a.state) ? -0.2 : 0.1,
        dt,
        5,
      );
      p.tail.rotation.x = ease(
        p.tail.rotation.x,
        a.state === 'flee' ? 0.15 : 0.6,
        dt,
        4,
      );
    },
    dikdik(a, v, p, time, dt) {
      stride(a, v, p.legs, dt, 0.27);
      // 逃跑时一蹦一跳地冲出去。
      v.object.position.y += gallop(a, v, 0.16);
      p.head.rotation.x = ease(
        p.head.rotation.x,
        a.state === 'forage' ? 0.6 : a.state === 'freeze' ? -0.25 : 0,
        dt,
        6,
      );
    },
    goat(a, v, p, time, dt) {
      stride(a, v, p.legs, dt, 0.42);
      p.head.rotation.x = ease(
        p.head.rotation.x,
        a.state === 'forage'
          ? 0.9 + Math.sin(time * 4 + v.seed) * 0.06
          : a.state === 'curious'
            ? -0.25
            : 0.2,
        dt,
        5,
      );
    },
    dog(a, v, p, time, dt) {
      stride(a, v, p.legs, dt, 0.38);
      const resting = a.state === 'rest' && a.speed < 0.05 ? 1 : 0;
      v.tuck = ease(v.tuck, resting, dt, 3);
      // 趴下：身体放低，腿收短。
      p.body.position.y = -0.24 * v.tuck;
      for (const leg of p.legs) leg.scale.y = 1 - 0.6 * v.tuck;
      const happy = a.state === 'curious';
      p.tail.rotation.x = ease(
        p.tail.rotation.x,
        happy || a.speed > 0.05 ? -0.5 : 0.5,
        dt,
        5,
      );
      p.tail.rotation.z = happy
        ? Math.sin(time * 18) * 0.6
        : Math.sin(time * 2) * 0.1;
      p.head.rotation.z = happy ? Math.sin(time * 1.5) * 0.25 : 0;
    },
  };

  // 创建一只动物的外观；sim 是 wildlife.js 中的状态对象，scale 是个体大小（幼崽）。
  function spawn(parent, sim, scale = 1) {
    const object = new THREE.Group();
    parent.add(object);
    object.scale.setScalar(scale);
    const parts = builders[sim.species](object, sim, scale);
    object.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    object.rotation.y = sim.heading;
    return {
      object,
      parts,
      phase: 0,
      tuck: 0,
      upright: 0,
      sink: 0,
      lift: 0,
      spread: 0,
      visit: 0,
      hand: null,
      seed: sim.id * 1.7,
    };
  }

  function pose(sim, view, time, dt) {
    const o = view.object;
    o.position.set(
      sim.x,
      heightAt(sim.x, sim.z) + (table[sim.species].temperament.perch ?? 0),
      sim.z,
    );
    let turn = sim.heading - o.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    o.rotation.y += turn * Math.min(1, dt * 8);
    posers[sim.species](sim, view, view.parts, time, dt);
  }

  return { spawn, pose, materials: m };
}
