import * as THREE from '../../vendor/three.module.js';

const TAU = Math.PI * 2;
const ORIGINAL = '原创 · 万物之间';
// Creatures farther than this from the player are hidden and not animated;
// they are a few pixels at most there and the fog has taken them anyway.
const NEARBY = 34;

const lines = {
  ant: [
    ['我们没有地图。可每一只走过的，都在为后来者留下路。', ORIGINAL],
    ['一粒面包屑，就是我们整个下午的远方。', ORIGINAL],
  ],
  ladybug: [
    ['我在你的叶子上歇了一会儿。被一株草托住，也是一种幸运。', ORIGINAL],
    ['身上的点不是为了好看，是在告诉别人：我并不好惹。', ORIGINAL],
  ],
  snail: [
    ['我背着家走。所以走到哪里，都不算离开。', ORIGINAL],
    ['你们说我慢。可我从来没有错过一片叶子。', ORIGINAL],
  ],
  spider: [
    ['我织了一整夜，网上挂满露水。网是为了等待，等待也是一种手艺。', ORIGINAL],
    ['每一根丝都很细，可它们连在一起，就能接住清晨。', ORIGINAL],
  ],
  grasshopper: [
    [
      '我跳起来的那一刻，整片草地都在我脚下。落下时，又回到了它怀里。',
      ORIGINAL,
    ],
    ['我的一生只有一个夏天。所以每一次跳，我都用尽全力。', ORIGINAL],
  ],
  caterpillar: [
    ['我吃得很慢，睡得很长。总有一天，我会忘了怎么爬，学会怎么飞。', ORIGINAL],
    ['现在的我，还不知道自己将来会有翅膀。', ORIGINAL],
  ],
  beetle: [
    ['我穿着一身盔甲，却只是想安静地找点吃的。', ORIGINAL],
    ['光太亮的时候，我就钻进落叶底下，想一会儿事情。', ORIGINAL],
  ],
  bee: [
    ['每一朵花，我只拿一点点。这样，明天它还会为我开。', ORIGINAL],
    ['我飞过一千朵花，才酿出一小滴甜。慢一点的东西，往往更甜。', ORIGINAL],
  ],
  butterfly: [
    ['我只是路过。可每一次路过，花都记得。', ORIGINAL],
    ['我曾经是一条毛毛虫。所以我知道，变化可以很慢，也可以很美。', ORIGINAL],
  ],
  dragonfly: [
    ['我在水里长大，在风里长出翅膀。你看，变化也可以很轻。', ORIGINAL],
  ],
};

// Small lives at grass height. One unit is roughly 8 cm, so an ant is about
// 0.1 units long. Motion is computed in `update` without allocating.
export function createFauna(
  {
    rand,
    mat,
    microHeight,
    dummy,
    mergeParts,
    place,
    stemPart,
    annulus,
    flowerSpots,
    scaled,
  },
  scene,
) {
  const color = (hex) => new THREE.Color(hex);
  const sphere = new THREE.SphereGeometry(1, 10, 7);
  const talkers = [];
  const creatures = [];
  // Homes across the walkable meadow; the first `close` ones near the start.
  const homes = (count, close = 1) =>
    Array.from({ length: Math.max(close, scaled(count)) }, (_, i) =>
      i < close ? annulus(1.2, 6) : annulus(6, 46),
    );
  const nameKey = {
    蚂蚁: 'ant',
    瓢虫: 'ladybug',
    蜗牛: 'snail',
    蜘蛛: 'spider',
    蚱蜢: 'grasshopper',
    毛毛虫: 'caterpillar',
    步甲: 'beetle',
    蜜蜂: 'bee',
    蝴蝶: 'butterfly',
    蜻蜓: 'dragonfly',
  };
  // Every `every`-th creature of a kind can answer the player.
  function speaks(object, name, range, i, every = 1) {
    if (i % every === 0)
      talkers.push({ object, range, name, lines: lines[nameKey[name]] });
  }
  const vertexMaterial = (extra = {}) =>
    mat('#ffffff', { vertexColors: true, ...extra });
  function paint(geometry, tone) {
    const position = geometry.attributes.position,
      colors = [],
      shade = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      tone(position.getX(i), position.getY(i), position.getZ(i), shade);
      colors.push(shade.r, shade.g, shade.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }
  const leg = new THREE.CylinderGeometry(0.0016, 0.0012, 0.045, 3);
  function legs(parts, hex, spread = 0.02, size = 1) {
    for (const side of [-1, 1])
      for (let k = 0; k < 3; k++)
        parts.push({
          geometry: leg,
          matrix: place(
            side * spread,
            0.009 * size,
            (0.03 - k * 0.012) * size,
            0,
            (k - 1) * 0.5 * side,
            -side * (Math.PI / 2 + 0.35),
            size,
          ),
          color: color(hex),
        });
  }

  // ---- Ants: colonies with a mound and a column on a scent loop ---------------
  const antGeometry = (() => {
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
    legs(parts, '#1c130c');
    for (const side of [-1, 1])
      parts.push({
        geometry: leg,
        matrix: place(side * 0.008, 0.03, 0.066, 0.9, 0, side * 0.35, 0.8),
        color: body,
      });
    return mergeParts(parts);
  })();
  const moundGeometry = (() => {
    const parts = [
      {
        geometry: new THREE.SphereGeometry(0.45, 16, 8, 0, TAU, 0, Math.PI / 2),
        matrix: place(0, 0, 0, 0, 0, 0, 1, 0.45, 1),
        color: color('#7a5a3c'),
      },
      {
        geometry: sphere,
        matrix: place(0, 0.2, 0, 0, 0, 0, 0.05, 0.02, 0.05),
        color: color('#1a120b'),
      },
    ];
    const grain = new THREE.IcosahedronGeometry(0.02, 0);
    for (let i = 0; i < 90; i++) {
      const angle = rand(0, TAU),
        r = Math.sqrt(rand(0, 1)) * 0.46;
      parts.push({
        geometry: grain,
        matrix: place(
          Math.cos(angle) * r,
          0.2 * Math.sqrt(Math.max(0, 1 - (r / 0.46) ** 2)) + 0.005,
          Math.sin(angle) * r,
        ),
        color: color(i % 3 ? '#a07c55' : '#5a4029'),
      });
    }
    return mergeParts(parts);
  })();
  const antMaterial = vertexMaterial({ roughness: 0.45 });
  const crumbGeometry = new THREE.IcosahedronGeometry(0.014, 0),
    crumbMaterial = mat('#efe3c0');
  const colonies = [[1.6, 2.3], ...homes(5, 0)].map(([x, z], i) => {
    const ants = new THREE.InstancedMesh(antGeometry, antMaterial, 16),
      crumbs = new THREE.InstancedMesh(crumbGeometry, crumbMaterial, 3);
    ants.castShadow = true;
    ants.frustumCulled = crumbs.frustumCulled = false;
    const colony = {
      x,
      z,
      radius: rand(1.2, 1.8),
      ants,
      crumbs,
      offsets: Array.from(
        { length: 16 },
        (_, k) => k * 0.33 + rand(-0.05, 0.05),
      ),
      lead: new THREE.Object3D(),
    };
    const start = trailPoint(colony, 0, { x: 0, z: 0 });
    const mound = new THREE.Mesh(
      moundGeometry,
      vertexMaterial({ roughness: 1 }),
    );
    mound.position.set(start.x, microHeight(start.x, start.z) - 0.02, start.z);
    mound.receiveShadow = true;
    colony.mound = mound;
    scene.add(ants, crumbs, mound, colony.lead);
    speaks(colony.lead, '蚂蚁', 2.2, i);
    return colony;
  });
  function trailPoint(colony, u, out) {
    const radius =
      colony.radius + Math.sin(u * 3) * 0.35 + Math.sin(u * 5 + 1) * 0.2;
    out.x = colony.x + Math.cos(u) * radius * 1.3;
    out.z = colony.z + Math.sin(u) * radius * 0.8;
    return out;
  }

  // ---- Walkers: ladybugs, beetles and caterpillars ---------------------------
  const ladybugGeometry = (() => {
    const spots = [
      [0, 0.85, 0.5],
      [0.55, 0.7, 0.35],
      [-0.55, 0.7, 0.35],
      [0.62, 0.55, -0.4],
      [-0.62, 0.55, -0.4],
      [0.28, 0.6, -0.72],
      [-0.28, 0.6, -0.72],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
    const red = color('#c42a1c'),
      black = color('#120c0a'),
      direction = new THREE.Vector3();
    const shell = paint(
      new THREE.SphereGeometry(0.05, 20, 10, 0, TAU, 0, Math.PI / 2),
      (x, y, z, shade) => {
        direction.set(x, y, z).normalize();
        const spotted = spots.some((spot) => direction.dot(spot) > 0.962);
        const seam = Math.abs(direction.x) < 0.035 && direction.z < 0.6;
        shade.copy(spotted || seam ? black : red);
      },
    );
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
  })();
  const beetleGeometry = (() => {
    const parts = [
      {
        geometry: sphere,
        matrix: place(0, 0.03, -0.01, 0, 0, 0, 0.045, 0.028, 0.075),
        color: color('#1f5e4a'),
      },
      {
        geometry: sphere,
        matrix: place(0, 0.028, 0.07, 0, 0, 0, 0.032, 0.022, 0.026),
        color: color('#173f36'),
      },
      {
        geometry: sphere,
        matrix: place(0, 0.024, 0.1, 0, 0, 0, 0.02, 0.016, 0.018),
        color: color('#0f1c18'),
      },
    ];
    legs(parts, '#121612', 0.045, 1.8);
    return mergeParts(parts);
  })();
  const caterpillarGeometry = (() => {
    const parts = [];
    for (let k = 0; k < 10; k++) {
      const size = 0.024 * (k === 0 ? 1.15 : 1 - Math.max(0, k - 6) * 0.12);
      parts.push({
        geometry: sphere,
        matrix: place(0, size, 0.1 - k * 0.026, 0, 0, 0, size),
        color: color(k === 0 ? '#3e5a1c' : k % 2 ? '#8dbb3e' : '#7aa833'),
      });
      if (k > 0)
        parts.push({
          geometry: sphere,
          matrix: place(0.012, size * 1.75, 0.1 - k * 0.026, 0, 0, 0, 0.006),
          color: color(k % 2 ? '#f2d24a' : '#1e2a12'),
        });
    }
    return mergeParts(parts);
  })();
  function addWalkers(
    geometry,
    material,
    count,
    { scale, speed, leash, name, every, close = 1 },
  ) {
    homes(count, close).forEach(([x, z], i) => {
      const object = new THREE.Mesh(geometry, material);
      object.scale.setScalar(scale);
      object.castShadow = true;
      scene.add(object);
      creatures.push({
        object,
        move: updateWalker,
        homeX: x,
        homeZ: z,
        x,
        z,
        heading: rand(0, TAU),
        seed: rand(0, 10),
        speed,
        leash,
        inch: name === '毛毛虫',
        scale,
      });
      speaks(object, name, 2.2, i, every);
    });
  }
  addWalkers(ladybugGeometry, vertexMaterial({ roughness: 0.28 }), 18, {
    scale: 1.25,
    speed: 0.07,
    leash: 1.4,
    name: '瓢虫',
    every: 4,
    close: 3,
  });
  addWalkers(
    beetleGeometry,
    vertexMaterial({ roughness: 0.25, metalness: 0.55 }),
    8,
    { scale: 1.4, speed: 0.12, leash: 2.2, name: '步甲', every: 2 },
  );
  addWalkers(caterpillarGeometry, vertexMaterial({ roughness: 0.55 }), 7, {
    scale: 1.3,
    speed: 0.025,
    leash: 0.9,
    name: '毛毛虫',
    every: 1,
  });

  // ---- Grasshoppers: they sit, then leap ---------------------------------------
  const grasshopperGeometry = (() => {
    const green = color('#6f9a3a'),
      dark = color('#4e7228');
    const thin = new THREE.CylinderGeometry(0.004, 0.003, 0.12, 4);
    const parts = [
      {
        geometry: sphere,
        matrix: place(0, 0.05, -0.02, 0, 0, 0, 0.032, 0.035, 0.12),
        color: green,
      },
      {
        geometry: sphere,
        matrix: place(0, 0.065, 0.11, 0.3, 0, 0, 0.03, 0.036, 0.034),
        color: green,
      },
      {
        geometry: sphere,
        matrix: place(0, 0.085, -0.03, 0, 0, 0, 0.026, 0.008, 0.11),
        color: dark,
      },
    ];
    for (const side of [-1, 1]) {
      parts.push(
        {
          geometry: sphere,
          matrix: place(side * 0.022, 0.08, 0.12, 0, 0, 0, 0.01),
          color: color('#3a2e1e'),
        },
        {
          geometry: sphere,
          matrix: place(
            side * 0.04,
            0.08,
            -0.03,
            -0.5,
            0,
            0,
            0.014,
            0.016,
            0.075,
          ),
          color: green,
        },
        {
          geometry: thin,
          matrix: place(side * 0.045, 0.045, -0.1, 0.9, 0, 0),
          color: dark,
        },
        {
          geometry: thin,
          matrix: place(side * 0.03, 0.03, 0.06, 0.3, 0, side * 0.6, 0.4),
          color: dark,
        },
        {
          geometry: thin,
          matrix: place(side * 0.012, 0.11, 0.17, -1.1, 0, side * 0.3, 0.9),
          color: dark,
        },
      );
    }
    return mergeParts(parts);
  })();
  homes(10).forEach(([x, z], i) => {
    const object = new THREE.Mesh(
      grasshopperGeometry,
      vertexMaterial({ roughness: 0.5 }),
    );
    object.scale.setScalar(1.3);
    object.castShadow = true;
    scene.add(object);
    speaks(object, '蚱蜢', 2.4, i, 2);
    creatures.push({
      object,
      move: updateHopper,
      homeX: x,
      homeZ: z,
      x,
      z,
      heading: rand(0, TAU),
      hopAt: rand(1, 6),
      hopStart: -1,
      fromX: x,
      fromZ: z,
      toX: x,
      toZ: z,
    });
  });

  // ---- Fliers: butterflies, bees, hoverflies and dragonflies -------------------
  function wingGeometry(baseHex, tipHex) {
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
    const base = color(baseHex),
      tip = color(tipHex);
    const geometry = mergeParts(
      [new THREE.ShapeGeometry(fore, 8), new THREE.ShapeGeometry(hind, 8)].map(
        (wing) => ({
          geometry: paint(wing, (x, y, _z, shade) =>
            shade
              .copy(base)
              .lerp(
                tip,
                Math.min(1, Math.max(0, (Math.hypot(x, y) - 0.1) / 0.1)),
              ),
          ),
        }),
      ),
    );
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }
  const butterflyBody = new THREE.CapsuleGeometry(0.008, 0.07, 3, 6);
  butterflyBody.rotateX(Math.PI / 2);
  const palettes = [
    ['#f4f1e4', '#3a3632'],
    ['#f2dc62', '#e9c93a'],
    ['#8fb0e6', '#eef2fa'],
    ['#e9873a', '#2a1b10'],
    ['#c7a6e8', '#7b5aa8'],
    ['#b5432c', '#2a3f8a'],
  ].map(([base, tip]) => wingGeometry(base, tip));
  const wingMaterial = vertexMaterial({
    side: THREE.DoubleSide,
    roughness: 0.8,
  });
  const bodyMaterial = mat('#2b241c');
  function addFlier(object, right, left, [x, z], extra) {
    object.position.set(x, microHeight(x, z) + 1.3, z);
    scene.add(object);
    creatures.push({
      object,
      move: updateFlier,
      right,
      left,
      homeX: x,
      homeZ: z,
      x,
      z,
      seed: rand(0, 20),
      lastX: x,
      lastZ: z,
      ...extra,
    });
  }
  const spotHomes = (count) =>
    Array.from({ length: Math.max(2, scaled(count)) }, (_, i) =>
      i < 2 || !flowerSpots.length
        ? annulus(1.5, 8)
        : flowerSpots[Math.floor(rand(0, flowerSpots.length))],
    );
  spotHomes(14).forEach((home, i) => {
    const group = new THREE.Group();
    const wing = palettes[i % palettes.length];
    const right = new THREE.Mesh(wing, wingMaterial),
      left = new THREE.Mesh(wing, wingMaterial);
    left.scale.x = -1;
    group.add(new THREE.Mesh(butterflyBody, bodyMaterial), right, left);
    group.scale.setScalar(rand(1.3, 1.8));
    addFlier(group, right, left, home, {
      kind: 'butterfly',
      reach: rand(2.5, 5.5),
    });
    speaks(group, '蝴蝶', 2.6, i, 3);
  });

  function bandedBody(radius, length, yellowHex, blackHex, stripes) {
    const body = new THREE.CapsuleGeometry(radius, length, 4, 8);
    body.rotateX(Math.PI / 2);
    const yellow = color(yellowHex),
      black = color(blackHex);
    return paint(body, (_x, _y, z, shade) =>
      shade.copy(
        z > length * 0.45 || Math.sin(z * stripes) > 0.2 ? black : yellow,
      ),
    );
  }
  const flyWingShape = new THREE.Shape();
  flyWingShape.absellipse(0.03, 0, 0.03, 0.011, 0, TAU);
  const flyWing = new THREE.ShapeGeometry(flyWingShape, 6);
  flyWing.rotateX(Math.PI / 2);
  const clearWing = new THREE.MeshBasicMaterial({
    color: '#eef4ff',
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const hoverflyBody = bandedBody(0.011, 0.04, '#e6b326', '#17110b', 260);
  const beeBody = bandedBody(0.016, 0.045, '#d99a1f', '#2a1d10', 200);
  function buzzer(body, scale, home, kind, name, i, every) {
    const group = new THREE.Group();
    const right = new THREE.Mesh(flyWing, clearWing),
      left = new THREE.Mesh(flyWing, clearWing);
    right.position.set(0.006, 0.014, 0.005);
    left.position.set(-0.006, 0.014, 0.005);
    left.scale.x = -1;
    group.add(
      new THREE.Mesh(body, vertexMaterial({ roughness: 0.6 })),
      right,
      left,
    );
    group.scale.setScalar(scale);
    addFlier(group, right, left, home, { kind });
    if (name) speaks(group, name, 2.2, i, every);
  }
  spotHomes(6).forEach((home) => buzzer(hoverflyBody, 1.6, home, 'hover'));
  spotHomes(10).forEach((home, i) =>
    buzzer(beeBody, 1.9, home, 'hover', '蜜蜂', i, 3),
  );

  const dragonflyBody = mergeParts([
    {
      geometry: new THREE.CylinderGeometry(0.009, 0.006, 0.36, 6),
      matrix: place(0, 0, -0.2, Math.PI / 2, 0, 0),
      color: color('#2d7fc4'),
    },
    {
      geometry: sphere,
      matrix: place(0, 0, 0.01, 0, 0, 0, 0.022, 0.022, 0.04),
      color: color('#3a8f6a'),
    },
    {
      geometry: sphere,
      matrix: place(0.016, 0.006, 0.055, 0, 0, 0, 0.018),
      color: color('#2a5d8f'),
    },
    {
      geometry: sphere,
      matrix: place(-0.016, 0.006, 0.055, 0, 0, 0, 0.018),
      color: color('#2a5d8f'),
    },
  ]);
  const dragonflyWingShape = new THREE.Shape();
  dragonflyWingShape.absellipse(0.13, 0, 0.13, 0.028, 0, TAU);
  const dragonflyWing = mergeParts([
    {
      geometry: new THREE.ShapeGeometry(dragonflyWingShape, 8),
      matrix: place(0, 0, 0.03, -Math.PI / 2, 0, 0.05),
    },
    {
      geometry: new THREE.ShapeGeometry(dragonflyWingShape, 8),
      matrix: place(0, 0, -0.02, -Math.PI / 2, 0, -0.12),
    },
  ]);
  homes(5).forEach((home, i) => {
    const group = new THREE.Group();
    const right = new THREE.Mesh(dragonflyWing, clearWing),
      left = new THREE.Mesh(dragonflyWing, clearWing);
    left.scale.x = -1;
    group.add(
      new THREE.Mesh(
        dragonflyBody,
        vertexMaterial({ roughness: 0.3, metalness: 0.3 }),
      ),
      right,
      left,
    );
    group.scale.setScalar(1.6);
    addFlier(group, right, left, home, {
      kind: 'dragonfly',
      reach: rand(5, 8),
    });
    speaks(group, '蜻蜓', 3, i);
  });

  // ---- Snails, worms and webs --------------------------------------------------
  const shellGeometry = (() => {
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
    return mergeParts(parts);
  })();
  const footGeometry = new THREE.CapsuleGeometry(0.032, 0.17, 4, 10);
  const skin = mat('#9a9183', { roughness: 0.25 });
  homes(6).forEach(([x, z], i) => {
    const snail = new THREE.Group();
    snail.add(
      new THREE.Mesh(shellGeometry, vertexMaterial({ roughness: 0.35 })),
    );
    const foot = new THREE.Mesh(footGeometry, skin);
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1, 1, 0.55);
    foot.position.set(0, 0.018, 0.02);
    snail.add(foot);
    for (const side of [-1, 1]) {
      snail.add(
        new THREE.Mesh(
          stemPart(
            [
              [side * 0.012, 0.03, 0.11],
              [side * 0.018, 0.06, 0.13],
              [side * 0.026, 0.085, 0.14],
            ],
            0.003,
            '#8e877a',
            4,
          ).part.geometry,
          skin,
        ),
      );
      const eye = new THREE.Mesh(sphere, mat('#3b352d'));
      eye.scale.setScalar(0.006);
      eye.position.set(side * 0.026, 0.087, 0.14);
      snail.add(eye);
    }
    snail.traverse((child) => (child.castShadow = true));
    scene.add(snail);
    speaks(snail, '蜗牛', 2.6, i);
    creatures.push({
      object: snail,
      move: updateSnail,
      x,
      z,
      homeX: x - 0.9,
      homeZ: z,
      angle: 0,
    });
  });

  const wormMaterial = mat('#b47a6c', { roughness: 0.3 });
  const worms = homes(12, 2).map(([x, z]) => {
    const points = [];
    for (let i = 0; i < 7; i++)
      points.push([i * 0.06 - 0.18, 0.014, Math.sin(i * 1.1 + x) * 0.035]);
    const worm = new THREE.Mesh(
      stemPart(points, 0.014, '#b07466', 20).part.geometry,
      wormMaterial,
    );
    const turn = rand(0, TAU);
    worm.position.set(x, microHeight(x, z), z);
    worm.rotation.y = turn;
    worm.scale.setScalar(1.4);
    worm.visible = false;
    worm.castShadow = true;
    scene.add(worm);
    return { object: worm, x, z, turn };
  });

  const threadMaterial = new THREE.LineBasicMaterial({
    color: '#f6f2e6',
    transparent: true,
    opacity: 0.42,
  });
  const beadMaterial = new THREE.PointsMaterial({
    color: '#ffffff',
    size: 0.022,
    transparent: true,
    opacity: 0.9,
  });
  const dryStemMaterial = mat('#a68f5c', { roughness: 0.8 });
  const spiderGeometry = mergeParts([
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
  ]);
  function makeWeb(x, z) {
    const web = new THREE.Group();
    for (const [stemX, height] of [
      [-0.6, 1.7],
      [0.62, 1.4],
    ]) {
      const dry = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.014, height, 5),
        dryStemMaterial,
      );
      dry.position.set(stemX, height / 2, 0);
      dry.rotation.z = -stemX * 0.08;
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
    for (const [ax, ay] of [
      [-0.6, 1.62],
      [0.62, 1.32],
      [-0.58, 0.52],
      [0.6, 0.6],
    ]) {
      const angle = Math.atan2(ay - center[1], ax - center[0]);
      threads.push(
        center[0] + Math.cos(angle) * outer,
        center[1] + Math.sin(angle) * outer * 0.92,
        0,
        ax,
        ay,
        0,
      );
    }
    const threadGeometry = new THREE.BufferGeometry();
    threadGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(threads, 3),
    );
    const beadGeometry = new THREE.BufferGeometry();
    beadGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(beads, 3),
    );
    const spider = new THREE.Mesh(
      spiderGeometry,
      vertexMaterial({ roughness: 0.5 }),
    );
    spider.position.set(center[0], center[1], 0.005);
    web.add(
      new THREE.LineSegments(threadGeometry, threadMaterial),
      new THREE.Points(beadGeometry, beadMaterial),
      spider,
    );
    web.position.set(x, microHeight(x, z), z);
    web.rotation.y = rand(0, TAU);
    scene.add(web);
    return web;
  }
  const webs = [[3.8, -1.6], ...homes(6, 0)].map(([x, z], i) => {
    const web = makeWeb(x, z);
    speaks(web, '蜘蛛', 2.4, i);
    return { object: web, x, z };
  });

  const point = { x: 0, z: 0 },
    ahead = { x: 0, z: 0 };
  const near = (x, z, px, pz) =>
    (x - px) ** 2 + (z - pz) ** 2 < NEARBY * NEARBY;
  const turnToward = (from, to) =>
    Math.atan2(Math.sin(to - from), Math.cos(to - from));

  function updateColonies(time, px, pz, reduced) {
    for (const colony of colonies) {
      const visible = near(colony.x, colony.z, px, pz);
      colony.ants.visible = colony.crumbs.visible = visible;
      if (!visible || (reduced && colony.started)) continue;
      colony.started = true;
      let crumb = 0;
      colony.offsets.forEach((offset, i) => {
        const u = time * 0.12 + offset;
        trailPoint(colony, u, point);
        trailPoint(colony, u + 0.02, ahead);
        const y = microHeight(point.x, point.z);
        dummy.position.set(point.x, y, point.z);
        dummy.rotation.set(
          0,
          Math.atan2(ahead.x - point.x, ahead.z - point.z),
          0,
        );
        dummy.scale.setScalar(1.3);
        dummy.updateMatrix();
        colony.ants.setMatrixAt(i, dummy.matrix);
        if (i % 5 === 2 && crumb < 3) {
          dummy.position.y += 0.05;
          dummy.position.x += Math.sin(dummy.rotation.y) * 0.08;
          dummy.position.z += Math.cos(dummy.rotation.y) * 0.08;
          dummy.updateMatrix();
          colony.crumbs.setMatrixAt(crumb++, dummy.matrix);
        }
        if (i === 0) colony.lead.position.set(point.x, y, point.z);
      });
      colony.ants.instanceMatrix.needsUpdate = true;
      colony.crumbs.instanceMatrix.needsUpdate = true;
    }
  }
  function updateWalker(walker, time, dt) {
    const stride = walker.inch
      ? 0.5 + 0.5 * Math.sin(time * 4 + walker.seed)
      : 1;
    const speed =
      walker.speed * stride * Math.max(0, Math.sin(time * 0.23 + walker.seed));
    walker.heading += Math.sin(time * 0.7 + walker.seed * 5) * dt * 1.4;
    if (
      Math.hypot(walker.x - walker.homeX, walker.z - walker.homeZ) >
      walker.leash
    )
      walker.heading +=
        turnToward(
          walker.heading,
          Math.atan2(walker.homeX - walker.x, walker.homeZ - walker.z),
        ) *
        dt *
        0.8;
    walker.x += Math.sin(walker.heading) * speed * dt;
    walker.z += Math.cos(walker.heading) * speed * dt;
    walker.object.position.set(
      walker.x,
      microHeight(walker.x, walker.z),
      walker.z,
    );
    walker.object.rotation.y = walker.heading;
    if (walker.inch)
      walker.object.scale.z =
        walker.scale * (1 + Math.sin(time * 4 + walker.seed) * 0.12);
  }
  function updateHopper(hopper, time) {
    if (hopper.hopStart < 0 && time >= hopper.hopAt) {
      const away = Math.hypot(hopper.x - hopper.homeX, hopper.z - hopper.homeZ);
      const heading =
        away > 2.5
          ? Math.atan2(hopper.homeX - hopper.x, hopper.homeZ - hopper.z)
          : rand(0, TAU);
      const distance = rand(0.8, 1.8);
      Object.assign(hopper, {
        heading,
        hopStart: time,
        fromX: hopper.x,
        fromZ: hopper.z,
        toX: hopper.x + Math.sin(heading) * distance,
        toZ: hopper.z + Math.cos(heading) * distance,
      });
    }
    let lift = 0;
    if (hopper.hopStart >= 0) {
      const t = Math.min(1, (time - hopper.hopStart) / 0.55);
      hopper.x = hopper.fromX + (hopper.toX - hopper.fromX) * t;
      hopper.z = hopper.fromZ + (hopper.toZ - hopper.fromZ) * t;
      lift = Math.sin(Math.PI * t) * 0.7;
      if (t === 1) {
        hopper.hopStart = -1;
        hopper.hopAt = time + rand(3, 9);
      }
    }
    hopper.object.position.set(
      hopper.x,
      microHeight(hopper.x, hopper.z) + lift,
      hopper.z,
    );
    hopper.object.rotation.set(-lift * 0.4, hopper.heading, 0);
  }
  function updateFlier(flier, time, dt) {
    const body = flier.object;
    if (flier.kind === 'hover') {
      const dart = Math.floor((time + flier.seed * 3) / 5);
      const targetX = flier.homeX + Math.sin(dart * 12.9898 + flier.seed) * 1.6,
        targetZ = flier.homeZ + Math.cos(dart * 78.233 + flier.seed) * 1.6;
      body.position.x += (targetX - body.position.x) * Math.min(1, dt * 2.5);
      body.position.z += (targetZ - body.position.z) * Math.min(1, dt * 2.5);
      body.position.y =
        microHeight(body.position.x, body.position.z) +
        1.35 +
        Math.sin(time * 2.1 + flier.seed) * 0.08 +
        Math.sin(time * 23) * 0.004;
      body.rotation.y = Math.atan2(
        targetX - body.position.x,
        targetZ - body.position.z,
      );
      const buzz = Math.sin(time * 90) * 0.5;
      flier.right.rotation.z = 0.2 + buzz;
      flier.left.rotation.z = -0.2 - buzz;
    } else {
      const dragonfly = flier.kind === 'dragonfly';
      const t = time * (dragonfly ? 0.45 : 0.22) + flier.seed;
      const x =
          flier.homeX + Math.sin(t) * flier.reach + Math.sin(t * 2.3) * 0.8,
        z =
          flier.homeZ +
          Math.cos(t * 0.8) * flier.reach * 0.7 +
          Math.cos(t * 1.7) * 0.6;
      const height = dragonfly
        ? 3 + Math.sin(t * 1.3) * 0.6
        : 1.2 + Math.sin(t * 3.1) * 0.5;
      body.position.set(
        x,
        microHeight(x, z) + height + Math.sin(time * 7 + flier.seed) * 0.03,
        z,
      );
      body.rotation.y = Math.atan2(x - flier.lastX, z - flier.lastZ);
      flier.lastX = x;
      flier.lastZ = z;
      const flap = dragonfly
        ? 0.15 * Math.sin(time * 60)
        : 0.15 + 1.05 * Math.abs(Math.sin(time * 11 + flier.seed));
      flier.right.rotation.z = flap;
      flier.left.rotation.z = -flap;
    }
    flier.x = body.position.x;
    flier.z = body.position.z;
  }
  function updateSnail(snail, _time, dt) {
    snail.angle += dt * 0.012;
    snail.x = snail.homeX + Math.cos(snail.angle) * 0.9;
    snail.z = snail.homeZ + Math.sin(snail.angle) * 0.9;
    snail.object.position.set(snail.x, microHeight(snail.x, snail.z), snail.z);
    snail.object.rotation.y = -snail.angle;
  }

  // Hides what is far away, then animates only what is near.
  function update(time, dt, { wetness, reduced, playerX = 0, playerZ = 0 }) {
    for (const { object, x, z, turn } of worms) {
      object.visible = wetness > 0.55 && near(x, z, playerX, playerZ);
      if (object.visible && !reduced) {
        object.scale.x = 1.4 * (1 + Math.sin(time * 1.6 + x) * 0.12);
        object.rotation.y = turn + Math.sin(time * 0.4 + z) * 0.4;
      }
    }
    for (const web of webs)
      web.object.visible = near(web.x, web.z, playerX, playerZ);
    for (const colony of colonies)
      colony.mound.visible = near(colony.x, colony.z, playerX, playerZ);
    updateColonies(time, playerX, playerZ, reduced);
    for (const creature of creatures) {
      creature.object.visible = near(creature.x, creature.z, playerX, playerZ);
      if (!creature.object.visible || (reduced && creature.placed)) continue;
      creature.placed = true;
      creature.move(creature, time, dt);
    }
  }
  update(0, 0, { wetness: 0, reduced: false });

  return { talkers, update };
}
