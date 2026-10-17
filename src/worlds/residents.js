import * as THREE from '../../vendor/three.module.js';
import { REACTION_SECONDS } from '../core/residents.js';

// 原野上其他人的外形与姿态。身体沿用 people.js 的 person()，这里按年龄
// 调整比例，加上衣物、随身物件和摆在原地的东西，再按 state / speed 摆姿。
// 行为在 src/core/residents.js。几何体与材质在所有人之间共享。
//
// 关节坐标：torso 原点在髋部（整体 y = 0.8），head 原点在颈部（整体 y = 1.4，
// 头心在其上 0.17）；人物模型面朝 -z，+x 是右手。
const HEAD_SCALE = { toddler: 1.5, child: 1.22 },
  STOOP = { elder: 0.22 };
const LYING = new Set(['sleep']),
  JOINTS = ['legX', 'legZ', 'armX', 'armZ'];

export function createResidentViews(tools, people, heightAt) {
  const { mesh, mat } = tools;
  const geo = {
    rod: new THREE.CylinderGeometry(1, 1, 1, 6),
    box: new THREE.BoxGeometry(1, 1, 1),
    ball: new THREE.SphereGeometry(1, 10, 8),
    disc: new THREE.CylinderGeometry(1, 1, 1, 14),
    crown: new THREE.CylinderGeometry(0.15, 0.17, 0.13, 12),
    wrap: new THREE.TorusGeometry(0.175, 0.055, 6, 16),
    // 头巾从后脑包到两鬓，脸前留出口子（-z 方向在 phi = 1.5π）。
    cap: new THREE.SphereGeometry(
      0.21,
      12,
      7,
      Math.PI * 1.5 + 0.9,
      Math.PI * 2 - 1.8,
      0,
      Math.PI * 0.62,
    ),
    skirt: new THREE.CylinderGeometry(0.21, 0.31, 0.74, 10),
    jar: new THREE.SphereGeometry(0.13, 10, 8),
    jarNeck: new THREE.CylinderGeometry(0.05, 0.065, 0.08, 8),
  };
  const clay = mat('#a8613b'),
    wood = mat('#6d5338'),
    deadwood = mat('#8d7558'),
    rope = mat('#c2ab7a'),
    felt = mat('#5d4c39'),
    canvasBack = mat('#d9cdb2'),
    packCloth = mat('#56633f'),
    bedroll = mat('#8f3f2f'),
    metal = mat('#9aa3a6', { metalness: 0.5, roughness: 0.45 }),
    paints = ['#c0533f', '#e1b84f', '#4f6f8f', '#f1ece0'].map((c) => mat(c));

  function part(g, material, parent, [sx, sy, sz], [x, y, z]) {
    const o = mesh(g, material, parent, x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  function jar(parent, x, y, z) {
    const g = group(parent, x, y, z);
    part(geo.jar, clay, g, [1, 1.1, 1], [0, 0, 0]);
    mesh(geo.jarNeck, clay, g, 0, 0.16, 0);
    return g;
  }
  function brimmedHat(parent, material) {
    const g = group(parent);
    part(geo.disc, material, g, [0.3, 0.02, 0.3], [0, 0, 0]);
    mesh(geo.crown, material, g, 0, 0.07, 0);
    return g;
  }

  // 画布上的画：橙色的天、橄榄色的地和一棵伞状的树，用 canvas 画一次。
  function paintingTexture() {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 72;
    const ctx = c.getContext('2d'),
      sky = ctx.createLinearGradient(0, 0, 0, 50);
    sky.addColorStop(0, '#a7a3c4');
    sky.addColorStop(1, '#f1c08f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 96, 72);
    ctx.fillStyle = '#8d8a52';
    ctx.fillRect(0, 50, 96, 22);
    ctx.fillStyle = '#3f3a2a';
    ctx.fillRect(44, 30, 4, 22);
    ctx.beginPath();
    ctx.ellipse(46, 28, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 随身物件。返回一个按状态切换显隐的函数（不需要切换的返回 null）。
  const wearables = {
    // 笔顺着手臂伸出去；调色板抵消手臂抬起的角度，保持水平。
    brush({ hands: [left, right] }) {
      part(geo.rod, wood, right, [0.007, 0.22, 0.007], [0, -0.1, -0.02]);
      part(geo.ball, paints[0], right, [0.012, 0.02, 0.012], [0, -0.22, -0.02]);
      const board = group(left, 0, -0.05, -0.06);
      board.rotation.x = -0.75;
      part(geo.disc, canvasBack, board, [0.1, 0.01, 0.08], [0, 0, 0]);
      paints.forEach((m, i) =>
        part(
          geo.ball,
          m,
          board,
          [0.016, 0.008, 0.016],
          [-0.05 + i * 0.033, 0.008, 0.02],
        ),
      );
      return null;
    },
    feltHat({ head }) {
      const worn = brimmedHat(head, felt),
        resting = brimmedHat(head, felt);
      worn.position.set(0, 0.31, 0);
      // 睡觉时盖在脸上。
      resting.position.set(0, 0.17, -0.19);
      resting.rotation.x = Math.PI / 2;
      return (state, activity) => {
        const asleep = LYING.has(activity);
        worn.visible = !asleep;
        resting.visible = asleep;
      };
    },
    binoculars({ torso, head }) {
      const hanging = people.binoculars(torso),
        raised = people.binoculars(head);
      hanging.position.set(0, 0.38, -0.25);
      raised.position.set(0, 0.18, -0.24);
      return (state) => {
        raised.visible = state === 'scan';
        hanging.visible = !raised.visible;
      };
    },
    headwrap({ head }, m) {
      const wrap = mesh(geo.wrap, m.accent, head, 0, 0.27, 0.01);
      wrap.rotation.x = Math.PI / 2;
      part(geo.ball, m.accent, head, [0.16, 0.1, 0.17], [0, 0.31, 0.01]);
      part(geo.ball, m.accent, head, [0.06, 0.06, 0.06], [0, 0.26, 0.19]);
      return null;
    },
    headscarf({ head }, m) {
      const scarf = mesh(geo.cap, m.accent, head, 0, 0.19, 0.02);
      scarf.scale.set(1.06, 1.08, 1.1);
      scarf.rotation.x = 0.38;
      return null;
    },
    skirt({ figure }, m) {
      // 裙子挂在髋部，坐下时跟着腿向前倒。
      const hip = group(figure, 0, 0.8, 0);
      mesh(geo.skirt, m.pants, hip, 0, -0.37, 0);
      return { hip };
    },
    jar({ hands: [, right], head }) {
      const carried = jar(right, 0, -0.15, 0),
        balanced = jar(head, 0, 0.42, 0);
      return (state, activity) => {
        balanced.visible = activity === 'carry';
        carried.visible = !balanced.visible;
      };
    },
    bundle({ torso }) {
      const g = group(torso, 0, 0.3, 0.3);
      g.rotation.z = 0.25;
      for (let i = 0; i < 7; i++) {
        const stick = part(
          geo.rod,
          deadwood,
          g,
          [0.022, 0.95, 0.022],
          [((i % 4) - 1.5) * 0.05, 0, Math.floor(i / 4) * 0.05],
        );
        stick.rotation.z = Math.PI / 2 + (i % 3) * 0.06;
      }
      for (const x of [-0.25, 0.25]) {
        const tie = part(geo.disc, rope, g, [0.1, 0.03, 0.1], [x, 0, 0.02]);
        tie.rotation.z = Math.PI / 2;
      }
      return null;
    },
  };

  const painting = new THREE.MeshStandardMaterial({
      map: paintingTexture(),
      roughness: 0.9,
    }),
    canvasFace = new THREE.PlaneGeometry(0.58, 0.44);
  // 摆在原地的东西：画架、小凳、背包。front 是正面（局部 +z）朝向的点。
  const props = {
    easel(g) {
      // 两条前腿向外撇开，后腿斜撑在画布背后。
      for (const x of [-0.28, 0.28]) {
        const leg = part(
          geo.rod,
          wood,
          g,
          [0.015, 1.5, 0.015],
          [x, 0.73, 0.12],
        );
        leg.rotation.set(-0.08, 0, x * 0.43);
      }
      const back = part(geo.rod, wood, g, [0.015, 1.5, 0.015], [0, 0.7, -0.3]);
      back.rotation.x = 0.28;
      const board = group(g, 0, 1.12, 0.16);
      board.rotation.x = -0.12;
      part(geo.box, canvasBack, board, [0.62, 0.48, 0.02], [0, 0, -0.012]);
      mesh(canvasFace, painting, board, 0, 0, 0.001);
      part(geo.box, wood, g, [0.66, 0.025, 0.07], [0, 0.86, 0.18]);
    },
    stool(g) {
      part(geo.disc, wood, g, [0.17, 0.035, 0.17], [0, 0.42, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2,
          leg = part(
            geo.rod,
            wood,
            g,
            [0.014, 0.44, 0.014],
            [Math.sin(a) * 0.11, 0.2, Math.cos(a) * 0.11],
          );
        leg.rotation.set(Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2);
      }
    },
    backpack(g) {
      const pack = group(g, 0, 0, 0);
      pack.rotation.x = -0.3;
      part(geo.box, packCloth, pack, [0.4, 0.58, 0.26], [0, 0.3, 0]);
      part(geo.box, packCloth, pack, [0.42, 0.14, 0.28], [0, 0.58, 0.02]);
      const roll = part(geo.disc, bedroll, pack, [0.1, 0.5, 0.1], [0, 0.72, 0]);
      roll.rotation.z = Math.PI / 2;
      part(geo.disc, metal, g, [0.04, 0.2, 0.04], [0.34, 0.1, 0.12]);
    },
  };

  function placeProps(parent, def) {
    for (const prop of def.props ?? []) {
      const [x, z] = prop.at,
        g = group(parent, x, heightAt(x, z), z);
      if (prop.face)
        g.rotation.y = Math.atan2(prop.face[0] - x, prop.face[1] - z);
      props[prop.kind](g);
      g.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
    }
  }

  function spawn(parent, def, sim) {
    placeProps(parent, def);
    const object = group(parent),
      figure = people.person(def.look);
    figure.rotation.y = Math.PI;
    object.add(figure);
    const { limbs, torso, head, hands } = figure.userData;
    head.scale.setScalar(HEAD_SCALE[def.age] ?? 1);
    const m = {
        accent: mat(def.look.accent),
        pants: mat(def.look.pants),
      },
      parts = { figure, torso, head, hands },
      toggles = [];
    let skirt = null;
    for (const key of def.wear ?? []) {
      const result = wearables[key](parts, m);
      if (typeof result === 'function') toggles.push(result);
      else if (result?.hip) skirt = result.hip;
    }
    object.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    object.rotation.y = sim.heading;
    return {
      object,
      figure,
      torso,
      head,
      legs: [limbs[0], limbs[2]],
      arms: [limbs[1], limbs[3]],
      skirt,
      toggles,
      shown: null,
      carry: def.wear?.includes('jar')
        ? 'jar'
        : def.wear?.includes('bundle')
          ? 'bundle'
          : null,
      // 右手拿着木杖或水罐时，用左手打招呼、吆喝。
      free: def.look.prop === 'staff' || def.wear?.includes('jar') ? 0 : 1,
      age: def.age,
      height: def.look.height,
      phase: sim.id.length,
      current: blankPose(),
    };
  }

  // ---------- 姿态 ----------
  function blankPose() {
    return {
      y: 0,
      legX: [0, 0],
      legZ: [0, 0],
      armX: [0, 0],
      armZ: [0, 0],
      torso: 0,
      headX: 0,
      headY: 0,
      headZ: 0,
      roll: 0,
    };
  }
  // 目标姿态在每帧复用，避免新建对象。
  const goal = blankPose();
  function setBoth(pair, value, spread = 0) {
    pair[0] = value - spread;
    pair[1] = value + spread;
  }
  function seated(t, y = -0.68, legs = 1.38) {
    t.y = y;
    setBoth(t.legX, legs);
    setBoth(t.legZ, 0, 0.12);
    setBoth(t.armX, 0.5);
    t.torso = -0.1;
  }
  // 各状态的基本姿势；没有列出的状态按站立处理。
  const stances = {
    sit: (t) => seated(t),
    doze(t) {
      seated(t);
      t.torso = 0.22;
      t.headX = -0.55;
      setBoth(t.armX, 0.25);
    },
    drink(t) {
      seated(t);
      t.armX[1] = 2.25;
      t.armZ[1] = -0.38;
      t.headX = 0.35;
    },
    sleep(t) {
      seated(t, -0.6, 1.36);
      t.torso = 1.48;
      t.headX = 0.05;
      t.armX[0] = 0.15;
      t.armX[1] = 2.7;
      t.armZ[1] = 0.35;
    },
    squat(t) {
      t.y = -0.45;
      setBoth(t.legX, 1.15);
      setBoth(t.legZ, 0, 0.25);
      t.torso = -0.55;
      t.headX = -0.3;
      setBoth(t.armX, 0.95);
    },
    gather: bend,
    draw: bend,
    paint(t) {
      seated(t, -0.36, 0.95);
      t.torso = -0.06;
      t.armX[0] = 0.75;
      t.armX[1] = 1.35;
      t.armZ[1] = -0.12;
    },
    look(t) {
      seated(t, -0.36, 0.95);
      t.torso = 0.16;
      t.headX = 0.1;
      t.armX[0] = 0.6;
      t.armX[1] = 0.45;
    },
    stretch(t) {
      t.armZ[0] = -2.85;
      t.armZ[1] = 2.85;
      t.torso = 0.14;
      t.headX = 0.25;
    },
    scan(t) {
      setBoth(t.legZ, 0, 0.06);
      setBoth(t.armX, 2.05);
      t.armZ[0] = 0.45;
      t.armZ[1] = -0.45;
      t.headX = 0.06;
    },
    note(t) {
      t.armX[0] = 1.0;
      t.armX[1] = 0.95;
      t.armZ[0] = 0.25;
      t.armZ[1] = -0.3;
      t.headX = -0.45;
    },
    tend(t) {
      t.armX[1] = 0.35;
    },
    call(t, free) {
      handToMouth(t, free);
      t.headX = 0.25;
    },
  };
  // 空着的那只手抬到嘴边（吆喝、示意安静）。
  function handToMouth(t, free) {
    t.armX[free] = 2.15;
    t.armZ[free] = free ? -0.5 : 0.5;
  }
  function bend(t) {
    setBoth(t.legX, 0.12);
    setBoth(t.legZ, 0, 0.08);
    t.torso = -1.12;
    t.headX = 0.55;
    t.armX[0] = 1.2;
    t.armX[1] = 1.4;
  }
  // 反应叠加在当前姿势上：坐着的人也能挥手。free 是空着的那只手。
  const gestures = {
    greet(t, free) {
      t.armZ[free] = free ? 2.55 : -2.55;
      t.armX[free] = 0.2;
    },
    hush: handToMouth,
    curious(t) {
      t.torso -= 0.12;
      t.headZ = 0.3;
    },
    shy(t) {
      t.torso -= 0.15;
      t.headX = -0.3;
      setBoth(t.armX, 0.6);
    },
  };

  function aim(sim, view) {
    const t = goal,
      moving = sim.speed > 0.05;
    t.y = t.torso = t.headX = t.headY = t.headZ = t.roll = 0;
    setBoth(t.legX, 0);
    setBoth(t.legZ, 0);
    setBoth(t.armX, 0);
    setBoth(t.armZ, 0);
    const base = sim.reaction ? sim.activity : sim.state;
    if (!moving) stances[base]?.(t, view.free);
    t.torso -= (STOOP[view.age] ?? 0) * (LYING.has(base) ? 0 : 1);
    if (moving && view.carry === 'bundle' && base === 'carry') t.torso -= 0.35;
    if (sim.reaction) gestures[sim.reaction]?.(t, view.free);
    return t;
  }

  function pose(sim, view, time, dt) {
    const o = view.object;
    o.position.set(sim.x, heightAt(sim.x, sim.z), sim.z);
    let turn = sim.heading - o.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    o.rotation.y += turn * Math.min(1, dt * 8);
    if (view.shown !== sim.state) {
      view.shown = sim.state;
      for (const toggle of view.toggles) toggle(sim.state, sim.activity);
    }

    const t = aim(sim, view),
      c = view.current,
      k = Math.min(1, dt * 5);
    c.y += (t.y - c.y) * k;
    c.torso += (t.torso - c.torso) * k;
    c.headX += (t.headX - c.headX) * k;
    c.headY += (t.headY - c.headY) * k;
    c.headZ += (t.headZ - c.headZ) * k;
    for (const key of JOINTS)
      for (let i = 0; i < 2; i++) c[key][i] += (t[key][i] - c[key][i]) * k;

    // 走路时腿与对侧的手臂一起摆；孩子步子碎，老人摆幅小。
    const moving = sim.speed > 0.05,
      running = sim.speed > 1.6,
      stride = (running ? 0.85 : 0.45) * (view.age === 'elder' ? 0.65 : 1);
    view.phase += moving ? (dt * sim.speed * 6.5) / view.height : 0;
    const swing = moving ? Math.sin(view.phase) * stride : 0,
      carryingJar = view.carry === 'jar' && sim.activity === 'carry';
    const [legL, legR] = view.legs,
      [armL, armR] = view.arms;
    legL.rotation.set(c.legX[0] + swing, 0, c.legZ[0]);
    legR.rotation.set(c.legX[1] - swing, 0, c.legZ[1]);
    armL.rotation.set(
      c.armX[0] - swing * 0.8,
      0,
      c.armZ[0] - (view.age === 'toddler' && moving ? 0.35 : 0),
    );
    // 顶着水罐时右手扶在罐上，不跟着摆。
    if (carryingJar) armR.rotation.set(0.15, 0, 2.75);
    else
      armR.rotation.set(
        c.armX[1] + swing * 0.8,
        0,
        c.armZ[1] + (view.age === 'toddler' && moving ? 0.35 : 0),
      );
    // 打招呼时挥手；点头；画画时手腕的小动作；记笔记时笔在动。
    if (sim.reaction === 'greet')
      view.arms[view.free].rotation.z += Math.sin(time * 9) * 0.3;
    if (sim.state === 'paint') {
      armR.rotation.x += Math.sin(time * 3.1) * 0.07;
      armR.rotation.z += Math.sin(time * 2.3) * 0.09;
    }
    if (sim.state === 'note') armR.rotation.z += Math.sin(time * 7) * 0.05;

    const breathe = Math.sin(time * 1.3 + view.phase) * 0.012;
    view.torso.rotation.set(c.torso + (running ? -0.18 : 0) + breathe, 0, 0);
    let nod = 0;
    if (sim.reaction === 'nod') nod = -Math.abs(Math.sin(time * 5)) * 0.3;
    let look = c.headY;
    if (sim.state === 'tend') look += Math.sin(time * 0.4 + view.phase) * 0.45;
    // 驼背的老人会微微仰起头看路。
    const lift = LYING.has(sim.activity) ? 0 : (STOOP[view.age] ?? 0) * 0.6;
    view.head.rotation.set(c.headX + nod + lift, look, c.headZ);
    // 睡梦中翻身：整个人向一侧滚一下再回来。
    const rolled = REACTION_SECONDS.stir - sim.reactTimer,
      roll =
        sim.reaction === 'stir'
          ? Math.sin(Math.min(1, rolled / 1.2) * Math.PI) * 0.35
          : 0;
    // 孩子玩耍停下时会蹦一蹦。
    const hop =
      sim.state === 'play' && !moving
        ? Math.abs(Math.sin(time * 6 + view.phase)) * 0.12
        : 0;
    view.figure.position.y = (c.y + hop) * view.height;
    view.figure.rotation.z = roll;
    if (view.skirt)
      view.skirt.rotation.x = ((c.legX[0] + c.legX[1]) / 2) * 0.85;
  }

  return { spawn, pose };
}
