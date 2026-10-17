import * as THREE from '../../vendor/three.module.js';

// 人物外形：第三人称全身模型与第一人称手部/随身道具。
// 几何体在所有人物间共享，材质按人物创建一次并随场景缓存。
export function createPeople(tools) {
  const { mesh, mat } = tools;
  const geo = {
    head: new THREE.SphereGeometry(0.18, 12, 8),
    hair: new THREE.SphereGeometry(0.19, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    hood: new THREE.SphereGeometry(
      0.23,
      12,
      8,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.62,
    ),
    body: new THREE.CylinderGeometry(0.23, 0.19, 0.64, 9),
    leg: new THREE.CylinderGeometry(0.075, 0.065, 0.7, 7),
    foot: new THREE.BoxGeometry(0.15, 0.1, 0.28),
    arm: new THREE.CylinderGeometry(0.065, 0.05, 0.62, 7),
    brim: new THREE.CylinderGeometry(0.38, 0.38, 0.025, 16),
    crown: new THREE.CylinderGeometry(0.15, 0.18, 0.13, 12),
    band: new THREE.TorusGeometry(0.182, 0.024, 6, 18),
    scarf: new THREE.TorusGeometry(0.15, 0.055, 6, 14),
    box: new THREE.BoxGeometry(1, 1, 1),
    rod: new THREE.CylinderGeometry(1, 1, 1, 7),
    ring: new THREE.TorusGeometry(0.05, 0.008, 6, 20),
    lens: new THREE.CircleGeometry(0.048, 20),
    leaf: new THREE.IcosahedronGeometry(1, 0),
    sleeve: new THREE.CylinderGeometry(0.042, 0.048, 0.34, 8).rotateX(
      Math.PI / 2,
    ),
  };
  const dark = mat('#2c2a26'),
    wood = mat('#6d5338'),
    brass = mat('#b8954f', { metalness: 0.6, roughness: 0.4 }),
    paper = mat('#efe6cf'),
    stem = mat('#5c7034'),
    bloom = mat('#e2c35a'),
    glass = new THREE.MeshStandardMaterial({
      color: '#d9ecf0',
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

  function box(material, parent, [w, h, d], [x, y, z]) {
    const o = mesh(geo.box, material, parent, x, y, z);
    o.scale.set(w, h, d);
    return o;
  }
  function rod(material, parent, radius, length, [x, y, z]) {
    const o = mesh(geo.rod, material, parent, x, y, z);
    o.scale.set(radius, length, radius);
    return o;
  }
  function palette(look) {
    return {
      skin: mat(look.skin),
      hair: mat(look.hair),
      coat: mat(look.coat),
      pants: mat(look.pants),
      accent: mat(look.accent),
    };
  }

  // 道具挂在手的局部坐标里：y 向上，-z 指向手指方向。
  function magnifier(parent) {
    const g = new THREE.Group();
    parent.add(g);
    rod(wood, g, 0.012, 0.11, [0, 0.07, -0.02]);
    mesh(geo.ring, brass, g, 0, 0.17, -0.02);
    mesh(geo.lens, glass, g, 0, 0.17, -0.02);
    return g;
  }
  function binoculars(parent) {
    const g = new THREE.Group();
    parent.add(g);
    for (const side of [-1, 1]) {
      const barrel = rod(dark, g, 0.032, 0.13, [side * 0.042, 0, 0]);
      barrel.rotation.x = Math.PI / 2;
    }
    box(dark, g, [0.05, 0.025, 0.04], [0, 0, 0.01]);
    return g;
  }
  function staff(parent, length) {
    const o = rod(wood, parent, 0.022, length, [0, -length / 2 + 0.08, 0]);
    o.rotation.x = 0.08;
    return o;
  }
  function notebook(parent) {
    const g = new THREE.Group();
    parent.add(g);
    for (const side of [-1, 1]) {
      const page = box(paper, g, [0.1, 0.006, 0.14], [side * 0.05, 0, 0]);
      page.rotation.z = side * 0.18;
    }
    box(wood, g, [0.21, 0.004, 0.145], [0, -0.006, 0]);
    return g;
  }
  function sprig(parent) {
    const g = new THREE.Group();
    parent.add(g);
    rod(stem, g, 0.004, 0.18, [0, 0.09, 0]);
    for (let i = 0; i < 3; i++) {
      const leaf = mesh(geo.leaf, stem, g, (i - 1) * 0.02, 0.06 + i * 0.04, 0);
      leaf.scale.set(0.012, 0.03, 0.006);
      leaf.rotation.z = (i - 1) * 0.6;
    }
    const flower = mesh(geo.leaf, bloom, g, 0, 0.19, 0);
    flower.scale.setScalar(0.018);
    return g;
  }

  function hat(look, m, g) {
    if (look.hat !== 'hood') mesh(geo.hair, m.hair, g, 0, 1.6, 0.01);
    if (look.hat === 'straw') {
      mesh(geo.brim, m.accent, g, 0, 1.72, 0);
      mesh(geo.crown, m.accent, g, 0, 1.79, 0);
    } else if (look.hat === 'cap') {
      const crown = mesh(geo.hair, m.accent, g, 0, 1.63, 0);
      crown.scale.setScalar(1.02);
      box(m.accent, g, [0.22, 0.02, 0.15], [0, 1.66, -0.2]);
    } else if (look.hat === 'band') {
      const band = mesh(geo.band, m.accent, g, 0, 1.64, 0);
      band.rotation.x = Math.PI / 2;
    } else if (look.hat === 'hood') {
      const hood = mesh(geo.hood, m.coat, g, 0, 1.56, 0.03);
      hood.rotation.x = 0.45;
    }
  }
  function gear(look, m, g) {
    if (look.gear === 'satchel') {
      box(m.accent, g, [0.2, 0.18, 0.07], [0.27, 0.92, 0.02]);
      const strap = box(m.accent, g, [0.035, 0.75, 0.02], [0.02, 1.15, -0.2]);
      strap.rotation.z = 0.62;
    } else if (look.gear === 'strap') {
      const pair = binoculars(g);
      pair.position.set(0, 1.18, -0.25);
    } else if (look.gear === 'scarf') {
      mesh(geo.scarf, m.accent, g, 0, 1.4, 0).rotation.x = Math.PI / 2;
      box(m.accent, g, [0.09, 0.36, 0.03], [0.1, 1.2, -0.2]);
    } else if (look.gear === 'backpack') {
      box(m.accent, g, [0.34, 0.42, 0.18], [0, 1.12, 0.27]);
      box(m.pants, g, [0.35, 0.12, 0.19], [0, 1.28, 0.28]);
    } else if (look.gear === 'pouch') {
      box(m.accent, g, [0.13, 0.13, 0.08], [-0.24, 0.84, -0.06]);
    }
  }

  // 关节：joint 用来转动，frame 里的子物体沿用整体坐标，转动时绕 (0, y, 0)。
  function pivot(parent, y) {
    const joint = new THREE.Group(),
      frame = new THREE.Group();
    joint.position.y = y;
    frame.position.y = -y;
    joint.add(frame);
    parent.add(joint);
    return [joint, frame];
  }

  // 上身以髋部为轴、头以颈部为轴，供原野上的其他人坐下、弯腰和点头；
  // 玩家形象只摆动 limbs。
  function person(look) {
    const g = new THREE.Group(),
      m = palette(look),
      [torso, upper] = pivot(g, 0.8),
      [head, top] = pivot(upper, 1.4);
    mesh(geo.head, m.skin, top, 0, 1.57, 0);
    mesh(geo.body, m.coat, upper, 0, 1.09, 0);
    hat(look, m, top);
    gear(look, m, upper);
    const limbs = [],
      hands = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.12, 0.8, 0);
      g.add(leg);
      mesh(geo.leg, m.pants, leg, 0, -0.35, 0);
      mesh(geo.foot, m.pants, leg, 0, -0.69, -0.05);
      limbs.push(leg);
      const arm = new THREE.Group();
      arm.position.set(side * 0.29, 1.34, 0);
      upper.add(arm);
      mesh(geo.arm, m.coat, arm, 0, -0.3, 0);
      limbs.push(arm);
      // 模型面朝 -z，+x 是右手。
      const hand = new THREE.Group();
      hand.position.set(0, -0.62, 0);
      arm.add(hand);
      hands.push(hand);
      if (side === 1 && look.prop === 'magnifier') magnifier(hand);
      if (side === 1 && look.prop === 'staff') staff(hand, 1.5);
      if (side === -1 && look.prop === 'notebook')
        notebook(hand).rotation.x = Math.PI / 2;
      if (side === -1 && look.prop === 'sprig') sprig(hand);
    }
    g.scale.setScalar(look.height);
    g.userData = { limbs, torso, head, hands };
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return g;
  }

  // 第一人称手部。每帧由 fieldwork 把整组对齐到相机，
  // 子物体用相机局部坐标：x 向右、y 向上、-z 向前。
  function hands(look) {
    const rig = new THREE.Group(),
      m = palette(look),
      sides = {};
    for (const side of [-1, 1]) {
      const hand = new THREE.Group();
      rig.add(hand);
      mesh(geo.sleeve, m.coat, hand, 0, 0, 0.17);
      box(m.skin, hand, [0.075, 0.034, 0.1], [0, 0, -0.04]);
      box(m.skin, hand, [0.022, 0.03, 0.05], [-side * 0.045, 0.012, -0.02]);
      sides[side] = hand;
    }
    const left = sides[-1],
      right = sides[1];
    // rest / raised 是手在平时与使用能力时的位置和朝向。
    const pose = (hand, rest, raised) => {
      hand.userData.rest = rest;
      hand.userData.raised = raised;
    };
    if (look.prop === 'magnifier') {
      const lens = magnifier(right);
      lens.scale.setScalar(0.7);
      lens.rotation.x = -0.2;
      pose(
        left,
        [-0.24, -0.21, -0.45, 0.35, 0.25],
        [-0.26, -0.24, -0.42, 0.3, 0.2],
      );
      pose(right, [0.21, -0.2, -0.45, 0.3, -0.2], [0.06, -0.13, -0.46, 0.9, 0]);
    } else if (look.prop === 'binoculars') {
      binoculars(right).position.set(-0.08, 0.04, -0.06);
      pose(left, [-0.1, -0.21, -0.45, 0.3, 0.1], [-0.07, -0.05, -0.2, 0, 0]);
      pose(right, [0.06, -0.21, -0.45, 0.3, -0.1], [0.09, -0.05, -0.2, 0, 0]);
    } else if (look.prop === 'staff') {
      staff(right, 1.4);
      pose(
        left,
        [-0.24, -0.21, -0.45, 0.3, 0.2],
        [-0.16, -0.12, -0.56, 1, 0.4],
      );
      pose(
        right,
        [0.26, -0.17, -0.5, 0.15, -0.15],
        [0.26, -0.18, -0.5, 0.15, -0.15],
      );
    } else if (look.prop === 'notebook') {
      const book = notebook(left);
      book.rotation.x = 0.4;
      book.scale.setScalar(0.75);
      rod(wood, right, 0.006, 0.14, [0, 0.03, -0.05]).rotation.x = 1.1;
      pose(
        left,
        [-0.15, -0.2, -0.45, 0.5, 0.25],
        [-0.08, -0.17, -0.5, 0.8, 0.1],
      );
      pose(
        right,
        [0.2, -0.21, -0.45, 0.3, -0.2],
        [0.08, -0.18, -0.5, 0.5, -0.4],
      );
    } else {
      sprig(left).scale.setScalar(0.6);
      pose(
        left,
        [-0.2, -0.19, -0.45, 0.2, 0.15],
        [-0.07, -0.14, -0.56, 0.5, 0],
      );
      pose(
        right,
        [0.23, -0.21, -0.45, 0.3, -0.2],
        [0.24, -0.22, -0.45, 0.3, -0.2],
      );
    }
    rig.userData = { left, right, raise: 0 };
    rig.visible = false;
    return rig;
  }

  return { person, hands, binoculars };
}
