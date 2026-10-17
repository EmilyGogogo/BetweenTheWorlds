import * as THREE from '../../vendor/three.module.js';

const TAU = Math.PI * 2;
const ORIGINAL = '原创 · 万物之间';

// Trees as a blade of grass meets them. One unit is about 8 cm, so a grown
// tree is a tower whose trunk is wider than a patch of meadow; it stands just
// beyond the walkable edge, while saplings and shrubs grow inside it.
export function createTrees(
  {
    rand,
    mat,
    microHeight,
    mergeParts,
    place,
    stemPart,
    plantMaterial,
    canvasTexture,
    flowerHeadParts,
    petalGeometry,
    withMatrix,
    addInstances,
    item,
    annulus,
    scatterLeaves,
    scaled,
  },
  scene,
) {
  const color = (hex) => new THREE.Color(hex);
  const talkers = [];

  function barkTexture(paint, repeatX, repeatY) {
    const texture = canvasTexture(256, 512, paint);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    return texture;
  }
  function furrows(ctx, base, groove, count) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < count; i++) {
      let x = rand(0, 256);
      ctx.strokeStyle = groove(rand(0.4, 0.75));
      ctx.lineWidth = rand(2, 6);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 16; y <= 512; y += 16) {
        x += rand(-4, 4);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle =
        rand(0, 1) < 0.5 ? 'rgba(150,134,112,.22)' : 'rgba(28,22,16,.28)';
      ctx.fillRect(rand(0, 256), rand(0, 512), rand(1, 4), rand(2, 10));
    }
  }
  const oakBark = barkTexture(
    (ctx) => {
      furrows(ctx, '#4a3b2c', (a) => `rgba(22,15,9,${a})`, 46);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle =
          rand(0, 1) < 0.6 ? 'rgba(104,128,58,.4)' : 'rgba(170,176,140,.35)';
        ctx.beginPath();
        ctx.arc(rand(0, 256), rand(0, 512), rand(3, 12), 0, TAU);
        ctx.fill();
      }
    },
    5,
    6,
  );
  const pineBark = barkTexture(
    (ctx) => {
      furrows(ctx, '#7a4a32', (a) => `rgba(40,20,12,${a})`, 30);
      for (let i = 0; i < 160; i++) {
        ctx.strokeStyle = 'rgba(30,16,10,.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rand(0, 256), rand(0, 512), rand(14, 34), rand(8, 20));
      }
    },
    4,
    8,
  );
  const birchBark = barkTexture(
    (ctx) => {
      ctx.fillStyle = '#e9e6de';
      ctx.fillRect(0, 0, 256, 512);
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = 'rgba(160,156,146,.18)';
        ctx.fillRect(rand(0, 256), rand(0, 512), rand(4, 30), rand(1, 2));
      }
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = 'rgba(32,28,26,.82)';
        ctx.fillRect(rand(0, 256), rand(0, 512), rand(6, 34), rand(1.5, 3.5));
      }
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = 'rgba(40,34,30,.75)';
        const x = rand(0, 256),
          y = rand(0, 512),
          w = rand(18, 40);
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.lineTo(x, y - w * 0.4);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x, y + w * 0.3);
        ctx.fill();
      }
    },
    3,
    10,
  );

  // A ridged, open cylinder that flares toward the ground.
  function trunkGeometry({ bottom, top, height, flare, ridges, ridgeDepth }) {
    const geometry = new THREE.CylinderGeometry(
      top,
      bottom,
      height,
      32,
      30,
      true,
    );
    geometry.translate(0, height / 2, 0);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        y = position.getY(i),
        z = position.getZ(i);
      const angle = Math.atan2(z, x),
        base = Math.max(0, 1 - y / 10);
      const scale =
        1 +
        base * base * flare +
        Math.sin(angle * ridges + y * 0.07) * ridgeDepth +
        Math.sin(angle * 5 + y * 0.03) * 0.04;
      position.setXYZ(i, x * scale, y, z * scale);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  // A tube along a curve that tapers from `thickness` toward its end.
  function taperedTube(points, thickness, taper = 0.8) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const geometry = new THREE.TubeGeometry(curve, 24, thickness, 10);
    const position = geometry.attributes.position,
      uv = geometry.attributes.uv,
      center = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const along = uv.getX(i);
      curve.getPointAt(along, center);
      const shrink = 1 - along * taper;
      position.setXYZ(
        i,
        center.x + (position.getX(i) - center.x) * shrink,
        center.y + (position.getY(i) - center.y) * shrink,
        center.z + (position.getZ(i) - center.z) * shrink,
      );
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  const blob = new THREE.IcosahedronGeometry(1, 2);
  {
    const position = blob.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        y = position.getY(i),
        z = position.getZ(i);
      const bump =
        1 +
        Math.sin(x * 4.1 + y * 2.3) * 0.1 +
        Math.cos(z * 3.7 - x * 1.9) * 0.1;
      position.setXYZ(i, x * bump, y * bump, z * bump);
    }
    blob.computeVertexNormals();
  }
  const canopyLeaf = petalGeometry(1.4, 0.7);

  function giantTree({ x, z, bark, trunk, roots, limbs, canopy, talker }) {
    const tree = new THREE.Group();
    tree.position.set(x, microHeight(x, z), z);
    tree.rotation.y = rand(0, TAU);
    const barkMaterial = new THREE.MeshLambertMaterial({
      map: bark,
      bumpMap: bark,
      bumpScale: 1.2,
    });
    const parts = [trunkGeometry(trunk)];
    for (let i = 0; i < roots.count; i++) {
      const angle = (i / roots.count) * TAU + rand(-0.25, 0.25),
        length = rand(...roots.length),
        dx = Math.cos(angle),
        dz = Math.sin(angle),
        start = trunk.bottom * 0.75,
        bend = rand(-2, 2);
      parts.push(
        taperedTube(
          [
            [dx * start, 3.2, dz * start],
            [
              dx * (trunk.bottom + length * 0.25),
              1.1,
              dz * (trunk.bottom + length * 0.25),
            ],
            [
              dx * (trunk.bottom + length * 0.6) - dz * bend,
              0.35,
              dz * (trunk.bottom + length * 0.6) + dx * bend,
            ],
            [
              dx * (trunk.bottom + length) - dz * bend * 1.6,
              -0.7,
              dz * (trunk.bottom + length) + dx * bend * 1.6,
            ],
          ],
          rand(...roots.thickness),
        ),
      );
    }
    for (let i = 0; i < limbs.count; i++) {
      const angle = (i / limbs.count) * TAU + rand(-0.3, 0.3),
        y = rand(...limbs.height),
        reach = rand(...limbs.reach);
      parts.push(
        taperedTube(
          [
            [0, y, 0],
            [
              Math.cos(angle) * reach * 0.45,
              y + reach * 0.35,
              Math.sin(angle) * reach * 0.45,
            ],
            [
              Math.cos(angle) * reach,
              y + reach * 0.55,
              Math.sin(angle) * reach,
            ],
          ],
          limbs.thickness,
          0.7,
        ),
      );
    }
    for (const geometry of parts) {
      const mesh = new THREE.Mesh(geometry, barkMaterial);
      mesh.castShadow = mesh.receiveShadow = true;
      tree.add(mesh);
    }
    tree.add(canopy());
    scene.add(tree);
    talkers.push({ object: tree, ...talker });
    return tree;
  }
  // Leaf masses with a fringe of single leaves on their undersides, which is
  // the part a meadow-dweller actually sees.
  function leafyCanopy({ centerY, radius, depth, blobs, size, hexes }) {
    const parts = [];
    for (let i = 0; i < blobs; i++) {
      const angle = rand(0, TAU),
        r = Math.sqrt(rand(0, 1)) * radius,
        y = centerY + rand(-depth, depth) * (1 - (r / radius) * 0.5),
        s = rand(...size);
      const tint = color(hexes[Math.floor(rand(0, hexes.length))]);
      parts.push({
        geometry: blob,
        matrix: place(
          Math.cos(angle) * r,
          y,
          Math.sin(angle) * r,
          rand(0, 3),
          rand(0, 3),
          0,
          s,
          s * 0.7,
          s,
        ),
        color: tint,
      });
      for (let k = 0; k < 14; k++) {
        const a = rand(0, TAU),
          spread = rand(0.3, 0.95) * s;
        parts.push({
          geometry: canopyLeaf,
          matrix: place(
            Math.cos(angle) * r + Math.cos(a) * spread,
            y - s * 0.55 + rand(-0.6, 0.6),
            Math.sin(angle) * r + Math.sin(a) * spread,
            rand(-0.5, 0.5),
            a,
            rand(-0.9, -0.2),
            1,
            1,
            1,
            'YZX',
          ),
          color: tint.clone().multiplyScalar(1.15),
        });
      }
    }
    const mesh = new THREE.Mesh(
      mergeParts(parts),
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
    );
    mesh.castShadow = true;
    return mesh;
  }
  function pineCanopy() {
    const parts = [];
    const cone = new THREE.ConeGeometry(1, 1, 14, 3, true);
    for (let tier = 0; tier < 8; tier++) {
      const y = 46 + tier * 8.5,
        radius = 19 - tier * 2;
      parts.push({
        geometry: cone,
        matrix: place(
          rand(-1, 1),
          y,
          rand(-1, 1),
          0,
          rand(0, TAU),
          0,
          radius,
          14,
          radius,
        ),
        color: color(tier % 2 ? '#2f4a33' : '#355238'),
      });
    }
    const mesh = new THREE.Mesh(
      mergeParts(parts),
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
    );
    mesh.castShadow = true;
    return mesh;
  }

  giantTree({
    x: -14,
    z: -64,
    bark: oakBark,
    trunk: {
      bottom: 5.2,
      top: 3.4,
      height: 70,
      flare: 0.7,
      ridges: 18,
      ridgeDepth: 0.08,
    },
    roots: { count: 9, length: [12, 20], thickness: [1.3, 2] },
    limbs: { count: 5, height: [36, 52], reach: [22, 32], thickness: 2.2 },
    canopy: () =>
      leafyCanopy({
        centerY: 80,
        radius: 40,
        depth: 14,
        blobs: 60,
        size: [9, 15],
        hexes: ['#3f5a2a', '#4b6a2f', '#58783a', '#365024'],
      }),
    talker: {
      range: 22,
      name: '老橡树',
      lines: [
        ['你在我脚下走了很久，也只是走过了我的一条根。', ORIGINAL],
        [
          '这片原野上的草，我看着换了一百个夏天。每一株，我都记得一点。',
          ORIGINAL,
        ],
        ['长高，是为了离光近一点；扎深，是为了不忘记自己从哪里来。', ORIGINAL],
      ],
    },
  });
  giantTree({
    x: 60,
    z: -22,
    bark: birchBark,
    trunk: {
      bottom: 2.6,
      top: 1.6,
      height: 85,
      flare: 0.3,
      ridges: 7,
      ridgeDepth: 0.015,
    },
    roots: { count: 4, length: [5, 9], thickness: [0.7, 1] },
    limbs: { count: 4, height: [40, 60], reach: [12, 18], thickness: 0.9 },
    canopy: () =>
      leafyCanopy({
        centerY: 72,
        radius: 24,
        depth: 16,
        blobs: 45,
        size: [6, 10],
        hexes: ['#7d9a45', '#8fac52', '#6c8a3c', '#b4b85a'],
      }),
    talker: {
      range: 20,
      name: '白桦',
      lines: [
        ['我的树皮一层层剥落，像在把旧的自己轻轻放下。', ORIGINAL],
        ['风吹过的时候，我所有的叶子都在翻面，像在练习告别。', ORIGINAL],
      ],
    },
  });
  giantTree({
    x: -42,
    z: 52,
    bark: pineBark,
    trunk: {
      bottom: 3.4,
      top: 1,
      height: 110,
      flare: 0.4,
      ridges: 12,
      ridgeDepth: 0.06,
    },
    roots: { count: 5, length: [7, 12], thickness: [1, 1.4] },
    limbs: { count: 0 },
    canopy: pineCanopy,
    talker: {
      range: 22,
      name: '松树',
      lines: [
        ['冬天别的树都睡了，我还醒着。总得有谁，替森林记住绿色。', ORIGINAL],
        ['我的针叶很细。细，是为了在风雪里，少承受一点。', ORIGINAL],
      ],
    },
  });

  // ---- What falls from the trees -------------------------------------------
  const acornGeometry = mergeParts([
    {
      geometry: new THREE.SphereGeometry(0.09, 10, 8),
      matrix: place(0, 0.1, 0, 0, 0, 0, 1, 1.3, 1),
      color: color('#9a6b32'),
    },
    {
      geometry: new THREE.SphereGeometry(0.095, 10, 6, 0, TAU, 0, Math.PI / 2),
      matrix: place(0, 0.17, 0, 0, 0, 0, 1, 0.7, 1),
      color: color('#5e4528'),
    },
    {
      geometry: new THREE.CylinderGeometry(0.008, 0.01, 0.06, 4),
      matrix: place(0, 0.24, 0),
      color: color('#4c3820'),
    },
  ]);
  const coneScale = new THREE.ConeGeometry(0.045, 0.07, 4);
  const pineconeGeometry = (() => {
    const parts = [];
    for (let i = 0; i < 52; i++) {
      const h = (i / 52) * 0.5,
        radius = 0.12 * Math.sin(Math.PI * (h / 0.5)) + 0.03,
        angle = i * 2.4;
      parts.push({
        geometry: coneScale,
        matrix: place(
          Math.cos(angle) * radius,
          h,
          Math.sin(angle) * radius,
          0,
          -angle,
          Math.PI / 2 + 0.5,
        ),
        color: color(i % 2 ? '#7a5232' : '#8d6340'),
      });
    }
    return mergeParts(parts);
  })();
  const seedMaterial = mat('#ffffff', { vertexColors: true, roughness: 0.6 });
  function fallen(geometry, count, centerX, centerZ, inner, outer, scale) {
    const items = [];
    for (let i = 0; i < scaled(count); i++) {
      const [dx, dz] = annulus(inner, outer);
      const x = centerX + dx,
        z = centerZ + dz;
      if (Math.hypot(x, z) > 50) continue;
      items.push(
        item(
          x,
          microHeight(x, z) + 0.02,
          z,
          Math.PI / 2 + rand(-0.3, 0.3),
          rand(0, TAU),
          0,
          rand(...scale),
        ),
      );
    }
    addInstances(scene, geometry, seedMaterial, items, { reach: 40 });
  }
  fallen(acornGeometry, 90, -14, -64, 8, 40, [1.6, 2.2]);
  fallen(pineconeGeometry, 60, -42, 52, 6, 34, [1.4, 2.2]);
  scatterLeaves(scene, 120, { x: 60, z: -22, inner: 6, outer: 34 }, [
    '#d9b23a',
    '#e8c95a',
    '#c79a2e',
    '#b5a24a',
  ]);
  scatterLeaves(scene, 120, { x: -14, z: -64, inner: 8, outer: 36 }, [
    '#8a5a2b',
    '#9c6a2f',
    '#6b4a2a',
  ]);

  // ---- Saplings: trees no taller than a few blades -------------------------
  function outlineLeaf(width, length, edge) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      shape.lineTo(width * edge(t), length * t);
    }
    for (let i = 23; i >= 0; i--) {
      const t = i / 24;
      shape.lineTo(-width * edge(t), length * t);
    }
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }
  const mapleLeaf = outlineLeaf(
    0.28,
    0.5,
    (t) =>
      Math.sin(Math.PI * t) ** 0.6 *
      (0.65 + 0.35 * Math.abs(Math.cos(t * 7.5))),
  );
  const oakLeaf = outlineLeaf(
    0.16,
    0.5,
    (t) => Math.sin(Math.PI * t) * (0.75 + 0.25 * Math.sin(t * 22)),
  );
  const birchLeaf = outlineLeaf(
    0.12,
    0.26,
    (t) =>
      Math.sin(Math.PI * t) ** 0.8 * (1 - 0.35 * t) + Math.sin(t * 60) * 0.03,
  );
  function saplingGeometry({
    height,
    barkHex,
    leaf,
    leafHex,
    youngHex,
    leaves,
    branches,
  }) {
    const { part, curve } = stemPart(
      [
        [0, 0, 0],
        [0.06, height * 0.4, 0.02],
        [-0.04, height * 0.75, 0.05],
        [0.02, height, 0],
      ],
      0.05,
      barkHex,
      12,
    );
    const parts = [part];
    const tips = [curve.getPoint(1)];
    for (let b = 0; b < branches; b++) {
      const t = 0.45 + b * (0.45 / branches),
        start = curve.getPoint(t),
        angle = b * 2.4,
        reach = height * 0.22 * (1 - t * 0.3);
      const twig = stemPart(
        [
          [start.x, start.y, start.z],
          [
            start.x + Math.cos(angle) * reach * 0.5,
            start.y + reach * 0.35,
            start.z + Math.sin(angle) * reach * 0.5,
          ],
          [
            start.x + Math.cos(angle) * reach,
            start.y + reach * 0.5,
            start.z + Math.sin(angle) * reach,
          ],
        ],
        0.022,
        barkHex,
        6,
      );
      parts.push(twig.part);
      tips.push(twig.curve.getPoint(1));
    }
    tips.forEach((tip, i) => {
      for (let k = 0; k < leaves; k++)
        parts.push({
          geometry: leaf,
          matrix: place(
            tip.x + Math.cos(k * 2.4) * 0.04 * k,
            tip.y - k * 0.07,
            tip.z + Math.sin(k * 2.4) * 0.04 * k,
            rand(-0.2, 0.6),
            k * 2.4 + i,
            0,
            1.35,
            1,
            1.35,
            'YXZ',
          ),
          color: color(k < 2 ? youngHex : leafHex),
        });
    });
    return mergeParts(parts);
  }
  const saplingMaterial = plantMaterial({ bendHeight: 4, translucency: 0.8 });
  const saplingKinds = [
    saplingGeometry({
      height: 4,
      barkHex: '#6a5038',
      leaf: mapleLeaf,
      leafHex: '#5f9a3a',
      youngHex: '#c8563a',
      leaves: 9,
      branches: 5,
    }),
    saplingGeometry({
      height: 3.2,
      barkHex: '#5c4a36',
      leaf: oakLeaf,
      leafHex: '#4f7f2e',
      youngHex: '#9cbf5a',
      leaves: 9,
      branches: 4,
    }),
    saplingGeometry({
      height: 5,
      barkHex: '#d9d4c8',
      leaf: birchLeaf,
      leafHex: '#7fae46',
      youngHex: '#b9d46a',
      leaves: 10,
      branches: 6,
    }),
  ];
  const saplings = saplingKinds.map(() => []);
  for (let i = 0; i < scaled(21); i++) {
    const [x, z] = i === 0 ? [-3.6, 2.8] : annulus(6, 46);
    saplings[i % 3].push(
      item(x, microHeight(x, z), z, 0, rand(0, TAU), 0, rand(0.8, 1.3)),
    );
  }
  saplingKinds.forEach((geometry, i) =>
    addInstances(scene, geometry, saplingMaterial, saplings[i], {
      shadow: true,
      reach: 70,
      tile: 64,
    }),
  );
  const firstSapling = new THREE.Object3D();
  firstSapling.position.set(-3.6, microHeight(-3.6, 2.8), 2.8);
  scene.add(firstSapling);
  talkers.push({
    object: firstSapling,
    range: 3.5,
    name: '小树苗',
    lines: [
      ['我现在和你差不多高。再过很多年，你会住在我的影子里。', ORIGINAL],
      ['我还不知道自己会长成什么样。也许，不知道才是长大的样子。', ORIGINAL],
    ],
  });

  // ---- Shrubs: leafy domes about a metre tall --------------------------------
  const shrubLeaf = petalGeometry(0.42, 0.2);
  const roseHead = flowerHeadParts({
    petals: 5,
    length: 0.09,
    width: 0.085,
    petalHex: '#f3a6c4',
    centerHex: '#f2c94a',
    centerRadius: 0.02,
    cup: 0.3,
  });
  const berry = new THREE.SphereGeometry(0.07, 8, 6);
  const leafMass = new THREE.IcosahedronGeometry(1, 2);
  // Each cane carries a few dense leaf masses: a solid core so the bush does
  // not read as bare sticks, wrapped in single leaves facing outward.
  function shrubGeometry({ flowers, berryHex }) {
    const parts = [];
    const outward = new THREE.Vector3();
    for (let c = 0; c < 7; c++) {
      const angle = (c / 7) * TAU + rand(-0.3, 0.3),
        reach = rand(3.5, 5.5),
        height = rand(7, 11);
      const dx = Math.cos(angle),
        dz = Math.sin(angle);
      const { part, curve } = stemPart(
        [
          [0, 0, 0],
          [dx * reach * 0.2, height * 0.6, dz * reach * 0.2],
          [dx * reach * 0.7, height, dz * reach * 0.7],
          [dx * reach, height * 0.75, dz * reach],
        ],
        0.06,
        '#6b5a3e',
        12,
      );
      parts.push(part);
      for (const along of [0.5, 0.72, 0.94]) {
        const center = curve.getPoint(along),
          radius = rand(1.5, 2.1);
        parts.push({
          geometry: leafMass,
          matrix: place(
            center.x,
            center.y,
            center.z,
            rand(0, 3),
            rand(0, 3),
            0,
            radius * 0.92,
          ),
          color: color('#3b5f25'),
        });
        for (let k = 0; k < 70; k++) {
          const theta = rand(0, TAU),
            phi = Math.acos(rand(-0.6, 1));
          outward.set(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta),
          );
          const r = radius * rand(0.85, 1.12);
          parts.push({
            geometry: shrubLeaf,
            matrix: place(
              center.x + outward.x * r,
              center.y + outward.y * r,
              center.z + outward.z * r,
              rand(-0.5, 0.5),
              -theta,
              (Math.PI / 2 - phi) * 0.8,
              rand(1.3, 2),
              1,
              1.4,
              'YZX',
            ),
            color: color(rand(0, 1) < 0.35 ? '#6a9a3e' : '#4d7a2e'),
          });
        }
        for (let k = 0; k < 3; k++) {
          const theta = rand(0, TAU),
            phi = Math.acos(rand(0, 1));
          const x = center.x + Math.sin(phi) * Math.cos(theta) * radius * 1.08,
            y = center.y + Math.cos(phi) * radius * 1.08,
            z = center.z + Math.sin(phi) * Math.sin(theta) * radius * 1.08;
          if (flowers)
            parts.push(
              ...withMatrix(
                roseHead,
                place(
                  x,
                  y,
                  z,
                  (Math.PI / 2 - phi) * 0.7,
                  -theta,
                  0,
                  2.6,
                  2.6,
                  2.6,
                  'YXZ',
                ),
              ),
            );
          if (berryHex)
            for (let b = 0; b < 6; b++)
              parts.push({
                geometry: berry,
                matrix: place(
                  x + rand(-0.15, 0.15),
                  y - rand(0, 0.25),
                  z + rand(-0.15, 0.15),
                ),
                color: color(berryHex),
              });
        }
      }
    }
    return mergeParts(parts);
  }
  const shrubMaterial = plantMaterial({ bendHeight: 10, translucency: 0.6 });
  const shrubKinds = [
    shrubGeometry({ flowers: true }),
    shrubGeometry({ berryHex: '#c3202c' }),
  ];
  shrubKinds.forEach((geometry) => {
    const shrubs = [];
    for (let i = 0; i < scaled(4); i++) {
      const [x, z] = annulus(18, 50);
      shrubs.push(
        item(
          x,
          microHeight(x, z) - 0.1,
          z,
          0,
          rand(0, TAU),
          0,
          rand(0.85, 1.2),
        ),
      );
    }
    addInstances(scene, geometry, shrubMaterial, shrubs, {
      shadow: true,
      reach: 90,
      tile: 64,
    });
  });

  return { talkers };
}
