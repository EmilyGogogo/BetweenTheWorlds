import * as THREE from '../../vendor/three.module.js';

const TAU = Math.PI * 2;
const ORIGINAL = '原创 · 万物之间';

// Small lives at grass height. One unit is roughly 8 cm here, so an ant is
// about 0.1 units long. All motion is computed in `update` without allocating.
export function createFauna(
  { rand, mat, microHeight, dummy, mergeParts, place, stemPart },
  scene,
) {
  const color = (hex) => new THREE.Color(hex);
  const sphere = new THREE.SphereGeometry(1, 10, 7);
  const talkers = [];

  // ---- Ants: a column following a scent loop near the start ----------------
  function antGeometry() {
    const body = color('#1c130c');
    const parts = [
      {
        geometry: sphere,
        matrix: place(0, 0.016, 0.046, 0, 0, 0, 0.012),
        color: body,
      },
      {
        geometry: sphere,
        matrix: place(0, 0.017, 0.022, 0, 0, 0, 0.009, 0.009, 0.016),
        color: body,
      },
      {
        geometry: sphere,
        matrix: place(0, 0.021, -0.02, 0.2, 0, 0, 0.016, 0.014, 0.026),
        color: color('#2a1a0f'),
      },
    ];
    const leg = new THREE.CylinderGeometry(0.0016, 0.0012, 0.045, 3);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++)
        parts.push({
          geometry: leg,
          matrix: place(
            side * 0.02,
            0.009,
            0.03 - k * 0.012,
            0,
            (k - 1) * 0.5 * side,
            -side * (Math.PI / 2 + 0.35),
          ),
          color: body,
        });
      parts.push({
        geometry: leg,
        matrix: place(side * 0.008, 0.03, 0.066, 0.9, 0, side * 0.35, 0.8),
        color: body,
      });
    }
    return mergeParts(parts);
  }
  const antCount = 22;
  const ants = new THREE.InstancedMesh(
    antGeometry(),
    mat('#ffffff', { roughness: 0.45, vertexColors: true }),
    antCount,
  );
  const crumbs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.014, 0),
    mat('#efe3c0'),
    5,
  );
  ants.castShadow = true;
  ants.frustumCulled = crumbs.frustumCulled = false;
  scene.add(ants, crumbs);
  const antTrail = { x: 1.6, z: 2.3 };
  const antOffsets = Array.from(
    { length: antCount },
    (_, i) => i * 0.27 + rand(-0.05, 0.05),
  );
  function trailPoint(u, out) {
    const radius = 1.6 + Math.sin(u * 3) * 0.35 + Math.sin(u * 5 + 1) * 0.2;
    out.x = antTrail.x + Math.cos(u) * radius * 1.3;
    out.z = antTrail.z + Math.sin(u) * radius * 0.8;
    return out;
  }
  const antLead = new THREE.Object3D();
  scene.add(antLead);
  talkers.push({
    object: antLead,
    range: 2.2,
    name: '蚂蚁',
    lines: [
      ['我们没有地图。可每一只走过的，都在为后来者留下路。', ORIGINAL],
      ['一粒面包屑，就是我们整个下午的远方。', ORIGINAL],
    ],
  });

  // ---- Ladybugs ---------------------------------------------------------------
  function ladybugGeometry() {
    const shell = new THREE.SphereGeometry(
      0.05,
      20,
      10,
      0,
      TAU,
      0,
      Math.PI / 2,
    );
    const spots = [
      [0, 0.85, 0.5],
      [0.55, 0.7, 0.35],
      [-0.55, 0.7, 0.35],
      [0.62, 0.55, -0.4],
      [-0.62, 0.55, -0.4],
      [0.28, 0.6, -0.72],
      [-0.28, 0.6, -0.72],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
    const position = shell.attributes.position,
      colors = [],
      direction = new THREE.Vector3();
    const red = color('#c42a1c'),
      black = color('#120c0a');
    for (let i = 0; i < position.count; i++) {
      direction.fromBufferAttribute(position, i).normalize();
      const spotted = spots.some((spot) => direction.dot(spot) > 0.962);
      const seam = Math.abs(direction.x) < 0.035 && direction.z < 0.6;
      const tone = spotted || seam ? black : red;
      colors.push(tone.r, tone.g, tone.b);
    }
    shell.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    shell.scale(1, 0.72, 1.2);
    return mergeParts([
      { geometry: shell, matrix: place(0, 0.006, 0) },
      {
        geometry: sphere,
        matrix: place(0, 0.012, 0.056, 0, 0, 0, 0.026, 0.018, 0.02),
        color: black,
      },
      {
        geometry: sphere,
        matrix: place(0.013, 0.02, 0.064, 0, 0, 0, 0.007),
        color: color('#f2eee2'),
      },
      {
        geometry: sphere,
        matrix: place(-0.013, 0.02, 0.064, 0, 0, 0, 0.007),
        color: color('#f2eee2'),
      },
    ]);
  }
  const ladybugMaterial = mat('#ffffff', {
    roughness: 0.28,
    vertexColors: true,
  });
  const ladybugs = [];
  for (const [x, z] of [
    [-1.2, 1.4],
    [2.3, -1.2],
    [-2.8, -2.6],
    [0.9, 3.8],
  ]) {
    const bug = new THREE.Mesh(ladybugGeometry(), ladybugMaterial);
    bug.scale.setScalar(1.25);
    bug.castShadow = true;
    scene.add(bug);
    ladybugs.push({
      object: bug,
      homeX: x,
      homeZ: z,
      x,
      z,
      heading: rand(0, TAU),
      seed: rand(0, 10),
    });
  }
  talkers.push({
    object: ladybugs[0].object,
    range: 2,
    name: '瓢虫',
    lines: [
      ['我在你的叶子上歇了一会儿。被一株草托住，也是一种幸运。', ORIGINAL],
      ['身上的点不是为了好看，是在告诉别人：我并不好惹。', ORIGINAL],
    ],
  });

  // ---- Butterflies --------------------------------------------------------------
  function wingGeometry() {
    const fore = new THREE.Shape();
    fore.moveTo(0.004, 0.012);
    fore.quadraticCurveTo(0.09, 0.09, 0.18, 0.1);
    fore.quadraticCurveTo(0.21, 0.06, 0.19, 0.02);
    fore.quadraticCurveTo(0.1, -0.01, 0.004, -0.008);
    const hind = new THREE.Shape();
    hind.moveTo(0.004, -0.004);
    hind.quadraticCurveTo(0.12, -0.02, 0.13, -0.07);
    hind.quadraticCurveTo(0.1, -0.13, 0.03, -0.1);
    hind.quadraticCurveTo(0.004, -0.05, 0.004, -0.004);
    const geometry = mergeParts([
      { geometry: new THREE.ShapeGeometry(fore, 8) },
      { geometry: new THREE.ShapeGeometry(hind, 8) },
    ]);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }
  const wing = wingGeometry();
  const bodyGeometry = new THREE.CapsuleGeometry(0.008, 0.07, 3, 6);
  bodyGeometry.rotateX(Math.PI / 2);
  const butterflies = [
    ['#f4f1e4', 3.5, 1.2, -4.5],
    ['#f2dc62', 5.5, -3.5, -9],
    ['#8fb0e6', 2.6, 4, -2],
  ].map(([wingHex, reach, cx, cz], i) => {
    const group = new THREE.Group();
    const wingMaterial = mat(wingHex, {
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    const right = new THREE.Mesh(wing, wingMaterial),
      left = new THREE.Mesh(wing, wingMaterial);
    left.scale.x = -1;
    group.add(new THREE.Mesh(bodyGeometry, mat('#2b241c')), right, left);
    group.scale.setScalar(1.5);
    scene.add(group);
    return {
      group,
      right,
      left,
      reach,
      cx,
      cz,
      seed: i * 2.1 + rand(0, 1),
      lastX: cx,
      lastZ: cz,
    };
  });

  // ---- Hoverflies over the flowers ------------------------------------------------
  const flyBody = new THREE.CapsuleGeometry(0.011, 0.04, 4, 8);
  flyBody.rotateX(Math.PI / 2);
  {
    const position = flyBody.attributes.position,
      colors = [];
    const yellow = color('#e6b326'),
      black = color('#17110b');
    for (let i = 0; i < position.count; i++) {
      const z = position.getZ(i);
      const tone = z > 0.018 || Math.sin(z * 260) > 0.2 ? black : yellow;
      colors.push(tone.r, tone.g, tone.b);
    }
    flyBody.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  const flyWingShape = new THREE.Shape();
  flyWingShape.absellipse(0.03, 0, 0.03, 0.011, 0, TAU);
  const flyWing = new THREE.ShapeGeometry(flyWingShape, 6);
  flyWing.rotateX(Math.PI / 2);
  const flyWingMaterial = new THREE.MeshBasicMaterial({
    color: '#eef4ff',
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const hoverflies = [
    [-1.6, -3.4],
    [2.6, 1.6],
  ].map(([x, z], i) => {
    const group = new THREE.Group();
    const right = new THREE.Mesh(flyWing, flyWingMaterial),
      left = new THREE.Mesh(flyWing, flyWingMaterial);
    right.position.set(0.006, 0.012, 0.005);
    left.position.set(-0.006, 0.012, 0.005);
    left.scale.x = -1;
    group.add(
      new THREE.Mesh(
        flyBody,
        mat('#ffffff', { vertexColors: true, roughness: 0.4 }),
      ),
      right,
      left,
    );
    group.scale.setScalar(1.6);
    scene.add(group);
    return { group, right, left, x, z, seed: i * 3.7 };
  });

  // ---- Snail -----------------------------------------------------------------
  const snail = new THREE.Group();
  {
    const parts = [];
    for (let k = 0; k < 26; k++) {
      const angle = k * 0.42,
        radius = 0.075 * Math.exp(-k * 0.075),
        size = 0.06 * Math.exp(-k * 0.08);
      parts.push({
        geometry: sphere,
        matrix: place(
          Math.cos(angle) * radius * 0.25,
          0.11 + Math.sin(angle) * radius,
          Math.cos(angle) * radius - 0.02,
          0,
          0,
          0,
          size * 0.8,
          size,
          size,
        ),
        color: color(k % 4 < 2 ? '#8a5a2e' : '#c49a5c'),
      });
    }
    snail.add(
      new THREE.Mesh(
        mergeParts(parts),
        mat('#ffffff', { vertexColors: true, roughness: 0.35 }),
      ),
    );
    const skin = mat('#9a9183', { roughness: 0.25 });
    const foot = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.032, 0.17, 4, 10),
      skin,
    );
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1, 1, 0.55);
    foot.position.set(0, 0.018, 0.02);
    snail.add(foot);
    for (const side of [-1, 1]) {
      const { part } = stemPart(
        [
          [side * 0.012, 0.03, 0.11],
          [side * 0.018, 0.06, 0.13],
          [side * 0.026, 0.085, 0.14],
        ],
        0.003,
        '#8e877a',
        4,
      );
      snail.add(new THREE.Mesh(part.geometry, skin));
      const eye = new THREE.Mesh(sphere, mat('#3b352d'));
      eye.scale.setScalar(0.006);
      eye.position.set(side * 0.026, 0.087, 0.14);
      snail.add(eye);
    }
    snail.traverse((child) => (child.castShadow = true));
    scene.add(snail);
  }
  const snailPath = { x: -3.4, z: 1.8, angle: 0 };
  talkers.push({
    object: snail,
    range: 2.6,
    name: '蜗牛',
    lines: [
      ['我背着家走。所以走到哪里，都不算离开。', ORIGINAL],
      ['你们说我慢。可我从来没有错过一片叶子。', ORIGINAL],
    ],
  });

  // ---- Earthworms, which surface when the soil is wet ---------------------------
  const worms = [
    [-1.8, 3.1, 0.4],
    [3.2, 2.9, 2.2],
  ].map(([x, z, turn]) => {
    const points = [];
    for (let i = 0; i < 7; i++)
      points.push([i * 0.06 - 0.18, 0.014, Math.sin(i * 1.1) * 0.035]);
    const { part } = stemPart(points, 0.014, '#b07466', 20);
    const worm = new THREE.Mesh(
      part.geometry,
      mat('#b47a6c', { roughness: 0.3 }),
    );
    worm.position.set(x, microHeight(x, z), z);
    worm.rotation.y = turn;
    worm.scale.setScalar(1.4);
    worm.visible = false;
    worm.castShadow = true;
    scene.add(worm);
    return { worm, x, z, turn };
  });

  // ---- A dewy spider web between two dry stems ------------------------------------
  const web = new THREE.Group();
  {
    const stemMaterial = mat('#a68f5c', { roughness: 0.8 });
    for (const [x, height] of [
      [-0.6, 1.7],
      [0.62, 1.4],
    ]) {
      const dry = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.014, height, 5),
        stemMaterial,
      );
      dry.position.set(x, height / 2, 0);
      dry.rotation.z = -x * 0.08;
      dry.castShadow = true;
      web.add(dry);
    }
    const threads = [],
      beads = [];
    const center = [0, 0.95],
      outer = 0.46;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * TAU;
      threads.push(
        center[0],
        center[1],
        0,
        center[0] + Math.cos(angle) * outer,
        center[1] + Math.sin(angle) * outer * 0.92,
        0,
      );
    }
    let previous = null;
    for (let step = 0; step <= 16 * 7; step++) {
      const angle = (step / 16) * TAU,
        radius = 0.06 + (step / (16 * 7)) * (outer - 0.08);
      const point = [
        center[0] + Math.cos(angle) * radius,
        center[1] + Math.sin(angle) * radius * 0.92,
        0,
      ];
      if (previous) threads.push(...previous, ...point);
      if (step % 3 === 1) beads.push(...point);
      previous = point;
    }
    for (const [x, y] of [
      [-0.6, 1.62],
      [0.62, 1.32],
      [-0.58, 0.52],
      [0.6, 0.6],
    ]) {
      const angle = Math.atan2(y - center[1], x - center[0]);
      threads.push(
        center[0] + Math.cos(angle) * outer,
        center[1] + Math.sin(angle) * outer * 0.92,
        0,
        x,
        y,
        0,
      );
    }
    const threadGeometry = new THREE.BufferGeometry();
    threadGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(threads, 3),
    );
    web.add(
      new THREE.LineSegments(
        threadGeometry,
        new THREE.LineBasicMaterial({
          color: '#f6f2e6',
          transparent: true,
          opacity: 0.42,
        }),
      ),
    );
    const beadGeometry = new THREE.BufferGeometry();
    beadGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(beads, 3),
    );
    web.add(
      new THREE.Points(
        beadGeometry,
        new THREE.PointsMaterial({
          color: '#ffffff',
          size: 0.022,
          transparent: true,
          opacity: 0.9,
        }),
      ),
    );
    const spider = new THREE.Mesh(
      mergeParts([
        {
          geometry: sphere,
          matrix: place(0, 0, 0, 0, 0, 0, 0.022, 0.026, 0.018),
          color: color('#3a2a1c'),
        },
        {
          geometry: sphere,
          matrix: place(0, 0.03, 0, 0, 0, 0, 0.012),
          color: color('#2a1d12'),
        },
      ]),
      mat('#ffffff', { vertexColors: true, roughness: 0.5 }),
    );
    spider.position.set(center[0], center[1], 0.005);
    web.add(spider);
    const x = 3.8,
      z = -1.6;
    web.position.set(x, microHeight(x, z), z);
    web.rotation.y = 0.5;
    scene.add(web);
  }
  talkers.push({
    object: web,
    range: 2.4,
    name: '蜘蛛',
    lines: [
      [
        '我织了一整夜，网上挂满露水。网是为了等待，等待也是一种手艺。',
        ORIGINAL,
      ],
      ['每一根丝都很细，可它们连在一起，就能接住清晨。', ORIGINAL],
    ],
  });

  const point = { x: 0, z: 0 },
    ahead = { x: 0, z: 0 };
  function update(time, dt, { wetness, reduced }) {
    for (const { worm, x, z, turn } of worms) {
      worm.visible = wetness > 0.55;
      if (worm.visible && !reduced) {
        worm.scale.x = 1.4 * (1 + Math.sin(time * 1.6 + x) * 0.12);
        worm.rotation.y = turn + Math.sin(time * 0.4 + z) * 0.4;
      }
    }
    if (reduced) return;

    let crumb = 0;
    for (let i = 0; i < antCount; i++) {
      const u = time * 0.12 + antOffsets[i];
      trailPoint(u, point);
      trailPoint(u + 0.02, ahead);
      const y = microHeight(point.x, point.z);
      dummy.position.set(point.x, y, point.z);
      dummy.rotation.set(
        0,
        Math.atan2(ahead.x - point.x, ahead.z - point.z),
        0,
      );
      dummy.scale.setScalar(1.3);
      dummy.updateMatrix();
      ants.setMatrixAt(i, dummy.matrix);
      if (i % 5 === 2 && crumb < 5) {
        dummy.position.y += 0.05;
        dummy.position.x += Math.sin(dummy.rotation.y) * 0.08;
        dummy.position.z += Math.cos(dummy.rotation.y) * 0.08;
        dummy.updateMatrix();
        crumbs.setMatrixAt(crumb++, dummy.matrix);
      }
      if (i === 0) antLead.position.set(point.x, y, point.z);
    }
    ants.instanceMatrix.needsUpdate = true;
    crumbs.instanceMatrix.needsUpdate = true;

    for (const bug of ladybugs) {
      const speed = 0.07 * Math.max(0, Math.sin(time * 0.23 + bug.seed));
      bug.heading += Math.sin(time * 0.7 + bug.seed * 5) * dt * 1.4;
      const away = Math.hypot(bug.x - bug.homeX, bug.z - bug.homeZ);
      if (away > 1.4) {
        const home = Math.atan2(bug.homeX - bug.x, bug.homeZ - bug.z);
        bug.heading +=
          Math.atan2(
            Math.sin(home - bug.heading),
            Math.cos(home - bug.heading),
          ) *
          dt *
          0.8;
      }
      bug.x += Math.sin(bug.heading) * speed * dt;
      bug.z += Math.cos(bug.heading) * speed * dt;
      bug.object.position.set(bug.x, microHeight(bug.x, bug.z), bug.z);
      bug.object.rotation.y = bug.heading;
    }

    for (const fly of butterflies) {
      const t = time * 0.22 + fly.seed;
      const x = fly.cx + Math.sin(t) * fly.reach + Math.sin(t * 2.3) * 0.8,
        z =
          fly.cz +
          Math.cos(t * 0.8) * fly.reach * 0.7 +
          Math.cos(t * 1.7) * 0.6;
      const ground = microHeight(x, z);
      fly.group.position.set(
        x,
        ground +
          1.2 +
          Math.sin(t * 3.1) * 0.5 +
          Math.sin(time * 7 + fly.seed) * 0.03,
        z,
      );
      fly.group.rotation.y = Math.atan2(x - fly.lastX, z - fly.lastZ);
      fly.lastX = x;
      fly.lastZ = z;
      const flap = 0.15 + 1.05 * Math.abs(Math.sin(time * 11 + fly.seed));
      fly.right.rotation.z = flap;
      fly.left.rotation.z = -flap;
    }

    for (const fly of hoverflies) {
      const dart = Math.floor((time + fly.seed * 3) / 5);
      const targetX = fly.x + Math.sin(dart * 12.9898 + fly.seed) * 0.9,
        targetZ = fly.z + Math.cos(dart * 78.233 + fly.seed) * 0.9;
      const body = fly.group;
      body.position.x += (targetX - body.position.x) * Math.min(1, dt * 2.5);
      body.position.z += (targetZ - body.position.z) * Math.min(1, dt * 2.5);
      body.position.y =
        microHeight(body.position.x, body.position.z) +
        1.35 +
        Math.sin(time * 2.1 + fly.seed) * 0.08 +
        Math.sin(time * 23) * 0.004;
      body.rotation.y = Math.atan2(
        targetX - body.position.x,
        targetZ - body.position.z,
      );
      const buzz = Math.sin(time * 90) * 0.5;
      fly.right.rotation.z = 0.2 + buzz;
      fly.left.rotation.z = -0.2 - buzz;
    }

    snailPath.angle += dt * 0.012;
    const sx = snailPath.x + Math.cos(snailPath.angle) * 0.9,
      sz = snailPath.z + Math.sin(snailPath.angle) * 0.9;
    snail.position.set(sx, microHeight(sx, sz), sz);
    snail.rotation.y = -snailPath.angle;
  }
  update(0, 0, { wetness: 0, reduced: false });

  return { talkers, update };
}
