import * as THREE from '../../vendor/three.module.js';

export function makeMicro(tools) {
  const {
    newWorld,
    sky,
    lights,
    addClouds,
    terrain,
    microHeight,
    field,
    plant,
    rockMats,
    dummy,
    rand,
    rock,
    mesh,
    mat,
    particles,
  } = tools;
  function flower(parent, x, z, size = 1) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(x, microHeight(x, z), z);
    g.scale.setScalar(size);
    const stem = mat('#536c39'),
      white = mat('#e9e3ca', { side: THREE.DoubleSide }),
      yellow = mat('#c6a342');
    mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.3, 5), stem, g, 0, 0.65, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const p = mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        white,
        g,
        Math.sin(a) * 0.17,
        1.3,
        Math.cos(a) * 0.17,
      );
      p.scale.set(0.65, 0.25, 1.5);
      p.rotation.y = -a;
    }
    mesh(new THREE.SphereGeometry(0.09, 8, 5), yellow, g, 0, 1.32, 0);
    return g;
  }
  function makeMicroScene() {
    const w = newWorld(0),
      s = w.scene;
    w.sky = sky(s);
    w.sun = lights(s, 3.2);
    addClouds(s);
    terrain(s, 160, 180, microHeight, ['#82734c', '#a39566']);
    field(s, 18000, 55, 1.1, microHeight, 4);
    field(s, 650, 24, 2.2, microHeight, 5);
    w.avatar = plant(s, 0, 0, 1.2);
    const pebbles = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      rockMats[1],
      2500,
    );
    for (let i = 0; i < 2500; i++) {
      const x = rand(-45, 45),
        z = rand(-45, 45);
      dummy.position.set(x, microHeight(x, z), z);
      dummy.scale.set(rand(0.025, 0.11), rand(0.015, 0.07), rand(0.025, 0.11));
      dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
    }
    s.add(pebbles);
    w.avatar.children.forEach((a) => (a.castShadow = true));
    for (let i = 0; i < 130; i++) {
      const x = rand(-55, 55),
        z = rand(-55, 55);
      rock(s, x, z, rand(0.08, 0.65), microHeight);
    }
    for (let i = 0; i < 35; i++) {
      const x = rand(-30, 30),
        z = rand(-30, 30);
      flower(s, x, z, rand(1.2, 2.8));
    }
    const fl = flower(s, -2, -5, 2.4);
    w.talkers.push({
      object: fl,
      range: 5,
      name: '雏菊',
      lines: [
        ['你说我是野花。可在我这里，你才是过客。', '原创 · 万物之间'],
        ['朝向太阳，并不是为了被谁看见。', '原创 · 万物之间'],
      ],
    });
    const r = rock(s, 3, -6, 1.5, microHeight);
    w.talkers.push({
      object: r,
      range: 5,
      name: '石头',
      lines: [
        ['你的一生很长。也许，只是我的一个清晨。', '原创 · 万物之间'],
        [
          '大小不在事物之中，也在你的目光之中。',
          '受《庄子·秋水》启发 · 原创改写',
        ],
      ],
    });
    for (let i = 0; i < 22; i++) {
      const a = i * 2.399,
        dist = 2.5 + Math.sqrt(i) * 2.5;
      const p = plant(
        s,
        Math.sin(a) * dist,
        Math.cos(a) * dist,
        rand(0.8, 1.1),
      );
      w.recruitables.push({ object: p, joined: false, phase: rand(0, 6) });
    }
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#e4f1dc',
      metalness: 0.05,
      roughness: 0.05,
      transparent: true,
      opacity: 0.7,
      clearcoat: 1,
      envMapIntensity: 1.5,
    });
    for (let i = 0; i < 14; i++) {
      const x = rand(-12, 12),
        z = rand(-12, 12);
      mesh(
        new THREE.SphereGeometry(rand(0.06, 0.13), 12, 10),
        glass,
        s,
        x,
        microHeight(x, z) + rand(0.9, 1.7),
        z,
      );
    }
    w.particles = particles(s, 100, 28, '#fff5cb', 0.035, 4);
    return w;
  }

  return makeMicroScene();
}
