import * as THREE from '../../vendor/three.module.js';
import { sameKindEncounters } from '../content/encounters.js';

export function makeHuman(tools) {
  const {
    newWorld,
    sky,
    lights,
    addClouds,
    mountains,
    terrain,
    groundHeight,
    field,
    tree,
    rand,
    rock,
    mesh,
    mat,
    particles,
  } = tools;
  function human() {
    const g = new THREE.Group(),
      coat = mat('#b9b3a0'),
      pants = mat('#414a48'),
      skin = mat('#b19a7c');
    mesh(new THREE.SphereGeometry(0.18, 12, 8), skin, g, 0, 1.57, 0);
    const body = mesh(
      new THREE.CylinderGeometry(0.23, 0.19, 0.64, 9),
      coat,
      g,
      0,
      1.09,
      0,
    );
    body.castShadow = true;
    const limbs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.12, 0.8, 0);
      g.add(leg);
      mesh(
        new THREE.CylinderGeometry(0.075, 0.065, 0.7, 7),
        pants,
        leg,
        0,
        -0.35,
        0,
      );
      mesh(new THREE.BoxGeometry(0.15, 0.1, 0.28), pants, leg, 0, -0.69, -0.05);
      limbs.push(leg);
      const arm = new THREE.Group();
      arm.position.set(side * 0.29, 1.34, 0);
      g.add(arm);
      mesh(
        new THREE.CylinderGeometry(0.065, 0.05, 0.62, 7),
        coat,
        arm,
        0,
        -0.3,
        0,
      );
      limbs.push(arm);
    }
    g.userData.limbs = limbs;
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return g;
  }
  function makeHumanScene() {
    const w = newWorld(1),
      s = w.scene;
    w.sky = sky(s, {
      top: '#7895ac',
      bottom: '#dfccae',
      direction: [-0.8, 0.18, -1],
    });
    w.sun = lights(s, 3.4);
    addClouds(s);
    mountains(s);
    terrain(s, 1200, 190, groundHeight, ['#6f754c', '#aba171']);
    field(s, 72000, 120, 0.68, groundHeight);
    field(s, 22000, 250, 0.6, groundHeight);
    for (let i = 0; i < 175; i++) {
      const x = rand(-310, 310),
        z = rand(-310, 310);
      if (Math.hypot(x, z) > 35) tree(s, x, z, rand(1.2, 3));
    }
    for (let i = 0; i < 240; i++)
      rock(s, rand(-280, 280), rand(-280, 280), rand(0.5, 3.5), groundHeight);
    const t = tree(s, -14, -28, 4);
    w.talkers.push({
      object: t,
      range: 24,
      name: '老树',
      lines: [
        ['世界并不在你到来之后，才开始存在。', '原创 · 万物之间'],
        ['你借用的每一口呼吸，都曾属于别的生命。', '原创 · 万物之间'],
      ],
    });
    const r = rock(s, 10, -16, 3.7, groundHeight);
    w.talkers.push({
      object: r,
      range: 13,
      name: '岩石',
      lines: [
        ['你站在我身旁，称自己为中心。风却不认识中心。', '原创 · 万物之间'],
      ],
    });
    w.avatar = human();
    s.add(w.avatar);
    const sameKind = human();
    sameKind.position.set(4, groundHeight(4, -9), -9);
    sameKind.rotation.y = Math.PI;
    s.add(sameKind);
    w.sameKind = {
      object: sameKind,
      range: 11,
      ...sameKindEncounters[1],
    };
    w.particles = particles(s, 100, 80, '#fce6ac', 0.05, 15);
    return w;
  }

  return makeHumanScene();
}
