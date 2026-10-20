import * as THREE from '../../vendor/three.module.js';
import { characters } from '../content/characters.js';
import { clues } from '../content/clues.js';
import { habitats } from '../content/fauna.js';
import { HOMESTEAD, PEN, POND, residents } from '../content/residents.js';
import { createResident } from '../core/residents.js';
import { createAnimal } from '../core/wildlife.js';
import { createFauna } from './animals.js';
import { createPeople } from './people.js';
import { createResidentViews } from './residents.js';

// 狐獴洞群的土丘与东边的岩丘：动物脚下高度要随它们起伏。
const BURROW = { x: -18, z: 16, radius: 2.2, height: 0.5 };
const KOPJE = { x: 46, z: -12, radius: 3.6, height: 2.2 };
const FIRE = [-37, 36.5];
// 灌木丛 [x, z, 高度]：第一丛是变色龙的家，其余是犬羚藏身的灌木。
const BUSHES = [
  [-9, -19, 1],
  [19, -46.5, 1.1],
  [21.5, -44, 0.9],
  [18, -43.4, 0.8],
];
// 不让随机散布的石头和树落进去的空地 [x, z, 半径]。
const CLEARINGS = [
  [POND.x, POND.z, 13],
  [HOMESTEAD.x, HOMESTEAD.z, 13],
  [-48, 46, 7],
  [-12, 48, 8],
  [KOPJE.x, KOPJE.z, 6],
  [12, -40, 4],
  [-41, -13.5, 4],
  [-45, -43, 6],
  [38, 42, 9],
  [-50, 4, 8],
  [30, -30, 5],
  [46, 16, 6],
  [20, -45, 3],
  [36, -48, 5],
];
const TRACKS = { from: [13, 1], to: [26, 10], sets: 9 };
const ANTS = 36;

// 人层角色使用 assets/ 下的 glTF 模型（来源见 assets/README.md）。
// 模型原点在脚底、无骨骼与动画；行走表现由主循环对 userData.body 做起伏与摆动。
const AVATAR_MODEL_URL = new URL(
  '../../assets/models/human-avatar.glb',
  import.meta.url,
);
const AVATAR_HEIGHT = 1.75;

// 开始下载并整理人物模型。在进入人层之前调用，避免切换时角色缺席。
export async function loadHumanAvatar() {
  // The browser resolves the loader's bare `three` import through index.html's
  // import map. Keeping this dynamic lets Node unit tests build other scenes
  // without requiring a second Three.js package installation.
  const { GLTFLoader } =
    await import('../../vendor/examples/jsm/loaders/GLTFLoader.js');
  return new GLTFLoader()
    .loadAsync(AVATAR_MODEL_URL.href)
    .then((gltf) => prepareAvatarModel(gltf.scene));
}

function prepareAvatarModel(model) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    // 导出工具把烘焙贴图放在自发光通道（不受光照）。改为基础色贴图，
    // 让角色与场景一样接受日光、阴影和色调映射。
    const exported = object.material;
    if (exported.emissiveMap && !exported.map) {
      object.material = new THREE.MeshStandardMaterial({
        map: exported.emissiveMap,
        roughness: 1,
        metalness: 0,
        side: exported.side,
      });
      exported.dispose();
    }
  });
  const bounds = new THREE.Box3().setFromObject(model);
  const scale = AVATAR_HEIGHT / (bounds.max.y - bounds.min.y);
  model.scale.setScalar(scale);
  model.position.y = -bounds.min.y * scale;
  // 场景中的角色面朝 -z；模型导出时面朝 +z，转半圈对齐。
  model.rotation.y = Math.PI;
  return model;
}

export function makeHuman(tools, avatarModel) {
  const {
    newWorld,
    sky,
    lights,
    addClouds,
    mountains,
    terrain,
    groundHeight,
    field,
    rand,
    rock,
    rockMats,
    mesh,
    mat,
    dummy,
    particles,
  } = tools;
  const flat = (color, extra = {}) =>
    mat(color, { flatShading: true, ...extra });
  const burrowBase = groundHeight(BURROW.x, BURROW.z),
    kopjeBase = groundHeight(KOPJE.x, KOPJE.z);
  const dome = (x, z, d, base) => {
    const r = Math.hypot(x - d.x, z - d.z) / d.radius;
    return r < 1 ? base + d.height * Math.sqrt(1 - r * r) : -Infinity;
  };
  const heightAt = (x, z) =>
    Math.max(
      groundHeight(x, z),
      dome(x, z, BURROW, burrowBase),
      dome(x, z, KOPJE, kopjeBase),
    );

  const acaciaGeo = {
      trunk: new THREE.CylinderGeometry(0.13, 0.22, 2.4, 6),
      branch: new THREE.CylinderGeometry(0.05, 0.1, 1, 5),
      canopy: new THREE.IcosahedronGeometry(1, 0),
    },
    bark = flat('#4c3f30'),
    canopyMats = [flat('#5b6934'), flat('#6c7a3b'), flat('#4f5d30')];
  const up = new THREE.Vector3(0, 1, 0),
    from = new THREE.Vector3(),
    to = new THREE.Vector3(),
    dir = new THREE.Vector3();
  // 伞状的金合欢，参照稀树草原的轮廓。
  function acacia(parent, x, z, size) {
    const g = new THREE.Group();
    g.position.set(x, groundHeight(x, z) - 0.05, z);
    g.rotation.y = rand(0, Math.PI * 2);
    g.scale.setScalar(size);
    parent.add(g);
    const leaves = canopyMats[Math.floor(rand(0, canopyMats.length))];
    mesh(acaciaGeo.trunk, bark, g, 0, 1.2, 0).castShadow = true;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + rand(-0.3, 0.3),
        reach = rand(1.1, 1.7);
      from.set(0, 2.2, 0);
      to.set(Math.sin(a) * reach, 3.5 + rand(-0.15, 0.2), Math.cos(a) * reach);
      const branch = mesh(acaciaGeo.branch, bark, g);
      branch.position.copy(from).add(to).multiplyScalar(0.5);
      branch.scale.y = from.distanceTo(to);
      branch.quaternion.setFromUnitVectors(
        up,
        dir.subVectors(to, from).normalize(),
      );
      const lobe = mesh(acaciaGeo.canopy, leaves, g, to.x, to.y + 0.25, to.z);
      lobe.scale.set(rand(1.3, 1.8), rand(0.28, 0.4), rand(1.1, 1.5));
      lobe.rotation.y = rand(0, 3);
      lobe.castShadow = true;
    }
    const crown = mesh(acaciaGeo.canopy, leaves, g, 0, 3.95, 0);
    crown.scale.set(2.5, 0.42, 2.2);
    crown.castShadow = true;
    return g;
  }

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d'),
      g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,248,220,1)');
    g.addColorStop(0.25, 'rgba(255,236,180,.55)');
    g.addColorStop(1, 'rgba(255,236,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  // 线索的微光只对能察觉它的人物显示（由 fieldwork 切换）。
  const markerMaterial = new THREE.SpriteMaterial({
    map: glowTexture(),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  function addClue(w, key, object, height, markerOffset = height + 0.4) {
    const entry = clues[key];
    let marker = null;
    if (!entry.far) {
      object.getWorldPosition(from);
      marker = new THREE.Sprite(markerMaterial);
      marker.position.set(from.x, from.y + markerOffset, from.z);
      marker.scale.setScalar(0.45);
      marker.visible = false;
      w.scene.add(marker);
    }
    w.clues.push({ key, entry, object, height, marker });
  }

  function termiteMound(parent, x, z) {
    const g = new THREE.Group(),
      earth = flat('#a8764c');
    g.position.set(x, groundHeight(x, z), z);
    parent.add(g);
    mesh(new THREE.ConeGeometry(0.9, 2.6, 7), earth, g, 0, 1.2, 0);
    mesh(new THREE.ConeGeometry(0.45, 1.6, 6), earth, g, 0.45, 0.75, 0.2);
    const hole = mesh(new THREE.IcosahedronGeometry(1, 0), flat('#3a2a1e'), g);
    hole.position.set(0.68, 0.35, -0.1);
    hole.scale.set(0.22, 0.2, 0.25);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    return g;
  }
  function weaverNests(tree) {
    const fresh = flat('#9aa060'),
      old = flat('#b9a46a'),
      geo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399,
        r = 0.8 + (i % 3) * 0.45;
      const nest = mesh(
        geo,
        i % 3 ? fresh : old,
        tree,
        Math.sin(a) * r,
        3.25,
        Math.cos(a) * r,
      );
      nest.scale.set(0.12, 0.17, 0.12);
    }
  }
  function seedPods(parent, x, z) {
    const geo = new THREE.TorusGeometry(0.08, 0.018, 4, 8, Math.PI),
      pod = flat('#6e4a2b'),
      g = new THREE.Group();
    g.position.set(x, groundHeight(x, z) + 0.03, z);
    parent.add(g);
    for (let i = 0; i < 7; i++) {
      const o = mesh(geo, pod, g, rand(-0.6, 0.6), 0, rand(-0.6, 0.6));
      o.rotation.set(-Math.PI / 2, 0, rand(0, 6));
    }
    return g;
  }
  function spiderWeb(parent, x, z) {
    const g = new THREE.Group(),
      lines = [],
      dew = [];
    g.position.set(x, groundHeight(x, z), z);
    g.rotation.y = Math.atan2(-x, -z);
    parent.add(g);
    const stalk = flat('#8f8a55');
    for (const side of [-1, 1]) {
      const o = mesh(
        new THREE.CylinderGeometry(0.006, 0.01, 0.85, 4),
        stalk,
        g,
      );
      o.position.set(side * 0.32, 0.42, 0);
    }
    const cy = 0.46;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      lines.push(0, cy, 0, Math.cos(a) * 0.28, cy + Math.sin(a) * 0.28, 0);
    }
    for (let ring = 1; ring <= 6; ring++)
      for (let i = 0; i < 12; i++) {
        const r = ring * 0.045,
          a = (i / 12) * Math.PI * 2,
          b = ((i + 1) / 12) * Math.PI * 2;
        lines.push(
          Math.cos(a) * r,
          cy + Math.sin(a) * r,
          0,
          Math.cos(b) * r,
          cy + Math.sin(b) * r,
          0,
        );
        if ((ring + i) % 2)
          dew.push(Math.cos(a) * r, cy + Math.sin(a) * r, 0.002);
      }
    const web = new THREE.BufferGeometry();
    web.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    g.add(
      new THREE.LineSegments(
        web,
        new THREE.LineBasicMaterial({
          color: '#eef2f0',
          transparent: true,
          opacity: 0.45,
        }),
      ),
    );
    const drops = new THREE.BufferGeometry();
    drops.setAttribute('position', new THREE.Float32BufferAttribute(dew, 3));
    g.add(
      new THREE.Points(
        drops,
        new THREE.PointsMaterial({
          color: '#ffffff',
          size: 0.014,
          transparent: true,
          opacity: 0.85,
        }),
      ),
    );
    return g;
  }
  function flowerPatch(parent, cx, cz) {
    const count = 70,
      stems = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.006, 0.008, 1, 4),
        flat('#5f7236'),
        count,
      ),
      heads = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 0),
        flat('#ffffff'),
        count,
      ),
      colors = ['#e8c95a', '#f1ece0', '#b59ad0', '#e39a4c'].map(
        (c) => new THREE.Color(c),
      );
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2),
        r = Math.sqrt(rand(0, 1)) * 3.4,
        x = cx + Math.sin(a) * r,
        z = cz + Math.cos(a) * r,
        h = rand(0.28, 0.5),
        y = groundHeight(x, z);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, y + h / 2, z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y + h, z);
      dummy.scale.set(0.05, 0.03, 0.05);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
      heads.setColorAt(i, colors[i % colors.length]);
    }
    parent.add(stems, heads);
    const anchor = new THREE.Object3D();
    anchor.position.set(cx, groundHeight(cx, cz), cz);
    parent.add(anchor);
    return anchor;
  }
  function hareTracks(parent) {
    const [fx, fz] = TRACKS.from,
      [tx, tz] = TRACKS.to,
      heading = Math.atan2(tx - fx, tz - fz),
      material = mat('#3d3226', {
        transparent: true,
        opacity: 0.6,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        emissive: '#ffd98a',
        emissiveIntensity: 0,
      }),
      prints = new THREE.InstancedMesh(
        new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2),
        material,
        TRACKS.sets * 4,
      );
    // 每组是野兔的“Y”形脚印：两只长后脚在前，两只前脚在后。
    const layout = [
      [-0.06, 0.12, 0.035, 0.08],
      [0.06, 0.12, 0.035, 0.08],
      [0, -0.1, 0.028, 0.035],
      [0.01, -0.22, 0.028, 0.035],
    ];
    const sin = Math.sin(heading),
      cos = Math.cos(heading);
    for (let s = 0; s < TRACKS.sets; s++) {
      const t = s / (TRACKS.sets - 1),
        cx = fx + (tx - fx) * t,
        cz = fz + (tz - fz) * t;
      layout.forEach(([side, ahead, w, l], i) => {
        const x = cx + cos * side + sin * ahead,
          z = cz - sin * side + cos * ahead;
        dummy.position.set(x, groundHeight(x, z) + 0.045, z);
        dummy.rotation.set(0, heading, 0);
        dummy.scale.set(w, 1, l);
        dummy.updateMatrix();
        prints.setMatrixAt(s * 4 + i, dummy.matrix);
      });
    }
    parent.add(prints);
    const anchor = new THREE.Object3D();
    anchor.position.set(
      fx + (tx - fx) / 2,
      groundHeight((fx + tx) / 2, (fz + tz) / 2),
      fz + (tz - fz) / 2,
    );
    parent.add(anchor);
    return { anchor, material };
  }
  function burrow(parent) {
    const g = new THREE.Group();
    g.position.set(BURROW.x, burrowBase - 0.03, BURROW.z);
    parent.add(g);
    const mound = mesh(
      new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      flat('#9a7752'),
      g,
    );
    mound.scale.set(BURROW.radius, BURROW.height, BURROW.radius);
    mound.receiveShadow = true;
    const hole = new THREE.CircleGeometry(0.14, 8).rotateX(-Math.PI / 2),
      dark = flat('#2a2018');
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05,
        r = 0.45 + (i % 3) * 0.45,
        x = Math.sin(a) * r,
        z = Math.cos(a) * r;
      const y = BURROW.height * Math.sqrt(1 - (r / BURROW.radius) ** 2);
      const o = mesh(hole, dark, g, x, y + 0.02, z);
      o.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
    }
    return g;
  }
  function antTrail(parent) {
    const ants = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.03, 0.012, 0.045),
      mat('#1b1612'),
      ANTS,
    );
    parent.add(ants);
    return ants;
  }
  function raptor(parent) {
    const g = new THREE.Group(),
      brown = flat('#4a3a2c');
    parent.add(g);
    const body = mesh(new THREE.IcosahedronGeometry(1, 0), brown, g);
    body.scale.set(0.25, 0.22, 0.7);
    for (const side of [-1, 1]) {
      const wing = mesh(new THREE.BoxGeometry(1, 0.04, 0.5), brown, g);
      wing.position.set(side * 0.95, 0.05, 0.05);
      wing.rotation.z = side * 0.12;
    }
    const tail = mesh(new THREE.BoxGeometry(0.4, 0.03, 0.4), brown, g);
    tail.position.set(0, 0, -0.75);
    g.scale.setScalar(1.4);
    return g;
  }
  function cloudTower(parent) {
    const g = new THREE.Group(),
      cloud = new THREE.MeshStandardMaterial({
        color: '#f6e9df',
        emissive: '#f0b48e',
        emissiveIntensity: 0.35,
        flatShading: true,
        roughness: 1,
        fog: false,
      }),
      geo = new THREE.IcosahedronGeometry(1, 1);
    g.position.set(380, 0, -330);
    parent.add(g);
    const puffs = [
      [0, 105, 0, 80, 22, 60],
      [-50, 112, 20, 50, 20, 40],
      [45, 110, -15, 55, 22, 45],
      [0, 140, 0, 55, 38, 45],
      [10, 180, 5, 42, 40, 36],
      [-12, 215, 0, 34, 34, 30],
      [8, 245, 4, 28, 28, 24],
      [-25, 165, -20, 30, 28, 26],
    ];
    for (const [x, y, z, sx, sy, sz] of puffs)
      mesh(geo, cloud, g, x, y, z).scale.set(sx, sy, sz);
    return g;
  }

  // ---------- 水塘、牧人的家、岩丘与灌木 ----------
  // 西边谷底的水塘：水面是一块平的圆盘，比谷底最低处略高；
  // 地形高出水面的地方自然把它盖住，岸线就是等高线。返回水面高度。
  function pond(parent) {
    let low = Infinity;
    for (let dx = -9; dx <= 9; dx++)
      for (let dz = -9; dz <= 9; dz++)
        if (Math.hypot(dx, dz) <= 9)
          low = Math.min(low, groundHeight(POND.x + dx, POND.z + dz));
    const level = low + 0.13;
    const water = mesh(
      new THREE.CircleGeometry(11.5, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: '#7f9c99',
        roughness: 0.1,
        metalness: 0.15,
        transparent: true,
        opacity: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
      parent,
      POND.x,
      level,
      POND.z,
    );
    water.receiveShadow = true;
    // 莎草只长在比水面略高的一圈湿地上。
    const count = 170,
      sedges = new THREE.InstancedMesh(
        new THREE.ConeGeometry(0.035, 1, 4),
        flat('#6d7c3b'),
        count,
      );
    let n = 0;
    for (let i = 0; i < 1500 && n < count; i++) {
      const a = rand(0, Math.PI * 2),
        r = rand(5, 12),
        x = POND.x + Math.sin(a) * r,
        z = POND.z + Math.cos(a) * r,
        h = groundHeight(x, z),
        tall = rand(0.35, 0.9);
      if (h < level - 0.03 || h > level + 0.2) continue;
      dummy.position.set(x, h + tall / 2, z);
      dummy.rotation.set(rand(-0.2, 0.2), 0, rand(-0.2, 0.2));
      dummy.scale.set(1, tall, 1);
      dummy.updateMatrix();
      sedges.setMatrixAt(n++, dummy.matrix);
    }
    sedges.count = n;
    parent.add(sedges);
    return level;
  }

  const homeGeo = {
      post: new THREE.CylinderGeometry(0.04, 0.05, 1.3, 5),
      stone: new THREE.IcosahedronGeometry(1, 0),
      log: new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6),
    },
    mud = flat('#a07552'),
    thatch = flat('#b89a5c'),
    doorway = flat('#2b211a'),
    charred = mat('#4a3626'),
    clay = mat('#a8613b'),
    jarGeo = new THREE.SphereGeometry(0.2, 10, 8),
    ember = mat('#e0773a', { emissive: '#ff7a2e', emissiveIntensity: 1.4 });
  // 泥墙草顶的圆屋。坡地上把墙脚埋进土里一些，免得下坡一侧悬空。
  function hut(parent, x, z, radius, facing) {
    const g = new THREE.Group();
    g.position.set(x, groundHeight(x, z) - radius * 0.2, z);
    g.rotation.y = facing;
    parent.add(g);
    mesh(
      new THREE.CylinderGeometry(radius, radius * 1.04, 2.2, 12),
      mud,
      g,
      0,
      1.1,
      0,
    );
    mesh(new THREE.ConeGeometry(radius * 1.35, 1.9, 12), thatch, g, 0, 3.05, 0);
    const door = mesh(
      new THREE.BoxGeometry(0.75, 1.35, 0.12),
      doorway,
      g,
      0,
      1.05,
      radius - 0.02,
    );
    door.castShadow = false;
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    return g;
  }
  function smokeTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d'),
      g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(235,230,222,.75)');
    g.addColorStop(1, 'rgba(235,230,222,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  // 牧人一家：两间圆屋、荆棘围成的羊圈、屋前的火塘与几只水罐。返回炊烟。
  function homestead(parent) {
    hut(parent, -42.5, 33.5, 2.3, 0.9);
    hut(parent, -45.5, 40.5, 1.8, 1.6);
    const posts = 38,
      fence = new THREE.InstancedMesh(homeGeo.post, flat('#6a5a43'), posts);
    for (let i = 0; i < posts; i++) {
      // 朝东留出一道门，牧人带着羊群从这里进出。
      const a = 1.9 + (i / posts) * Math.PI * 1.8,
        x = PEN.x + Math.sin(a) * PEN.radius,
        z = PEN.z + Math.cos(a) * PEN.radius;
      dummy.position.set(x, groundHeight(x, z) + 0.55, z);
      dummy.rotation.set(rand(-0.12, 0.12), rand(0, 3), rand(-0.12, 0.12));
      dummy.scale.set(1, rand(0.8, 1.15), 1);
      dummy.updateMatrix();
      fence.setMatrixAt(i, dummy.matrix);
    }
    fence.castShadow = true;
    parent.add(fence);
    const [fx, fz] = FIRE,
      fy = groundHeight(fx, fz),
      stoneMat = rockMats[1];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2,
        stone = mesh(
          homeGeo.stone,
          stoneMat,
          parent,
          fx + Math.sin(a) * 0.45,
          fy + 0.05,
          fz + Math.cos(a) * 0.45,
        );
      stone.scale.set(0.13, 0.09, 0.11);
    }
    for (const turn of [0.5, 2.2]) {
      const log = mesh(homeGeo.log, charred, parent, fx, fy + 0.08, fz);
      log.rotation.set(Math.PI / 2, 0, turn);
    }
    mesh(
      new THREE.ConeGeometry(0.16, 0.22, 6),
      ember,
      parent,
      fx,
      fy + 0.14,
      fz,
    );
    for (const [x, z] of [
      [-40.2, 35.6],
      [-40.6, 36.2],
    ]) {
      const jar = mesh(jarGeo, clay, parent, x, groundHeight(x, z) + 0.18, z);
      jar.scale.y = 1.15;
      jar.castShadow = true;
    }
    const smoke = smokeTexture();
    return Array.from({ length: 5 }, () => {
      const puff = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: smoke,
          transparent: true,
          depthWrite: false,
        }),
      );
      parent.add(puff);
      return puff;
    });
  }
  // 东边坡顶的岩丘：几块圆石围着一块平顶的大石，蹄兔在上面晒太阳。
  function kopje(parent) {
    const base = groundHeight(KOPJE.x, KOPJE.z),
      stones = [
        [0, 0, 2.6, 1.7, 2.4, 0.9],
        [2.2, 0.8, 1.4, 1.3, 1.3, 0.5],
        [-1.6, 1.9, 1.5, 1.1, 1.3, 0.4],
        [-2.3, -1.2, 1.3, 1.2, 1.4, 0.45],
        [0.9, -2.4, 1.5, 1.0, 1.2, 0.35],
        [2.6, -1.6, 1.0, 0.8, 1.0, 0.3],
      ];
    for (const [dx, dz, sx, sy, sz, lift] of stones) {
      const stone = mesh(
        new THREE.IcosahedronGeometry(1, 1),
        rockMats[(Math.abs(dx * 3 + dz) | 0) % rockMats.length],
        parent,
        KOPJE.x + dx,
        base + lift,
        KOPJE.z + dz,
      );
      stone.scale.set(sx, sy, sz);
      stone.rotation.set(rand(0, 0.4), rand(0, 6), rand(0, 0.4));
      stone.castShadow = stone.receiveShadow = true;
    }
  }
  const bushGeo = new THREE.IcosahedronGeometry(1, 0),
    bushMats = [flat('#4e5f2f'), flat('#5c6b35')];
  // 低矮的灌木丛，高约 size 米。
  function bush(parent, x, z, size) {
    const g = new THREE.Group();
    g.position.set(x, groundHeight(x, z), z);
    g.scale.setScalar(size);
    parent.add(g);
    for (const [dx, dy, dz, r] of [
      [0, 0.55, 0, 0.55],
      [0.4, 0.38, 0.15, 0.42],
      [-0.35, 0.36, -0.2, 0.44],
      [0.05, 0.32, 0.42, 0.36],
    ]) {
      const leaf = mesh(bushGeo, bushMats[dx > 0 ? 1 : 0], g, dx, dy, dz);
      leaf.scale.set(r, r * 0.85, r);
      leaf.castShadow = true;
    }
    return g;
  }
  // 清掉落在空地上的随机石头与树，免得它们长在水里、屋里或人身上。
  function clearScattered(parent, scattered) {
    for (const o of scattered) {
      const reach = Math.max(o.scale.x, o.scale.z) * (o.isMesh ? 1.2 : 2.5);
      if (
        CLEARINGS.some(
          ([x, z, r]) =>
            Math.hypot(o.position.x - x, o.position.z - z) < r + reach,
        )
      ) {
        parent.remove(o);
        if (o.isMesh) o.geometry.dispose();
      }
    }
  }

  function makeHumanScene() {
    const w = newWorld(1),
      s = w.scene;
    w.clues = [];
    // 清晨稀树草原：低角度暖光、粉紫色天空与谷地薄雾。
    w.sky = sky(s, {
      top: '#9a9dbb',
      bottom: '#f3c49b',
      sun: '#ffe2a8',
      direction: [-0.85, 0.07, -1],
    });
    s.background.set('#e2c2a6');
    s.fog.color.set('#dcc0a8');
    w.sun = lights(s, 3.1);
    w.sun.color.set('#ffcf94');
    w.sunOffset = new THREE.Vector3(-72, 34, -75);
    addClouds(s);
    mountains(s);
    terrain(s, 1200, 190, groundHeight, ['#6c7444', '#b9a86e']);
    field(s, 72000, 120, 0.68, groundHeight);
    field(s, 22000, 250, 0.6, groundHeight);
    const scattered = [];
    for (let i = 0; i < 175; i++) {
      const x = rand(-310, 310),
        z = rand(-310, 310);
      if (Math.hypot(x, z) > 35)
        scattered.push(acacia(s, x, z, rand(0.9, 2.2)));
    }
    for (let i = 0; i < 240; i++) {
      const x = rand(-280, 280),
        z = rand(-280, 280);
      // 出生点附近留给动物与线索，避免石头挡住第一眼。
      if (Math.hypot(x, z) > 14)
        scattered.push(rock(s, x, z, rand(0.5, 3.5), groundHeight));
    }

    const oldTree = acacia(s, -14, -28, 2.6);
    w.talkers.push({
      object: oldTree,
      range: 24,
      name: '老树',
      embodiment: {
        kind: 'tree',
        height: 10,
        distance: 42,
        speed: 9,
        scale: '≈ 20 米',
        range: 130,
      },
      lines: [
        ['世界并不在你到来之后，才开始存在。', '原创 · 万物之间'],
        ['你借用的每一口呼吸，都曾属于别的生命。', '原创 · 万物之间'],
      ],
    });
    addClue(w, 'oldTree', oldTree, 2.4, 1.6);
    const baskingRock = rock(s, 10, -16, 3.7, groundHeight);
    w.talkers.push({
      object: baskingRock,
      range: 13,
      name: '岩石',
      embodiment: {
        kind: 'rock',
        height: 1,
        distance: 16,
        speed: 3,
        range: 85,
        ground: (x, z) => groundHeight(x, z) + 1.3,
      },
      lines: [
        ['你站在我身旁，称自己为中心。风却不认识中心。', '原创 · 万物之间'],
      ],
    });
    addClue(w, 'baskingRock', baskingRock, 0.4, 2.6);
    addClue(w, 'termiteMound', termiteMound(s, 15, -7), 1.2, 2.9);
    const weaverTree = acacia(s, -26, -20, 1.7);
    weaverNests(weaverTree);
    addClue(w, 'weaverTree', weaverTree, 4.5, 1.4);
    addClue(w, 'seedPods', seedPods(s, -24.5, -17.5), 0.05, 0.6);
    rock(s, 3, -11.4, 0.45, groundHeight);
    w.ants = antTrail(s);
    const antAnchor = new THREE.Object3D();
    antAnchor.position.set(4.2, groundHeight(4.2, -10), -10);
    s.add(antAnchor);
    addClue(w, 'antTrail', antAnchor, 0.05, 0.5);
    addClue(w, 'spiderWeb', spiderWeb(s, -4, -12), 0.46, 1.1);

    const fauna = createFauna(tools, heightAt);
    const featherObject = mesh(
      new THREE.IcosahedronGeometry(1, 1),
      fauna.materials.spotted,
      s,
      -20,
      groundHeight(-20, -2) + 0.04,
      -2,
    );
    featherObject.scale.set(0.03, 0.006, 0.13);
    featherObject.rotation.y = 0.8;
    addClue(w, 'feather', featherObject, 0.02, 0.5);
    const tracks = hareTracks(s);
    w.trackMaterial = tracks.material;
    addClue(w, 'hareTracks', tracks.anchor, 0.05, 0.5);
    addClue(w, 'burrow', burrow(s), 0.3, 1);
    addClue(w, 'flowerPatch', flowerPatch(s, -7, 7), 0.4, 1.1);
    w.raptor = raptor(s);
    addClue(w, 'raptor', w.raptor, 0);
    addClue(w, 'cloudTower', cloudTower(s), 170);

    // 动物以栖息地中心为家，被惊走后会慢慢回来。
    const random = () => rand(0, 1);
    w.animals = [];
    // 带头的可能是稍后才创建的居民：先记下 follow，等居民建好再连上。
    const leaders = new Map(),
      followers = [];
    let id = 0;
    for (const habitat of habitats) {
      const [hx, hz] = habitat.center;
      for (let i = 0; i < habitat.count; i++) {
        const a = rand(0, Math.PI * 2),
          r = Math.sqrt(rand(0, 1)) * habitat.radius;
        const sim = createAnimal(
          id++,
          habitat.species,
          hx + Math.sin(a) * r,
          hz + Math.cos(a) * r,
          { x: hx, z: hz },
          random,
        );
        if (habitat.id && i === 0) leaders.set(habitat.id, sim);
        if (habitat.follow) followers.push([sim, habitat.follow]);
        w.animals.push({ sim, view: fauna.spawn(s, sim, habitat.scale) });
      }
    }
    w.fauna = fauna;

    const people = createPeople(tools);
    w.cast = characters.map((character, index) => {
      const hands = people.hands(character.look);
      s.add(hands);
      const avatar =
        index === 0 ? new THREE.Group() : people.person(character.look);
      if (index === 0) {
        const body = new THREE.Group();
        avatar.add(body);
        avatar.userData.body = body;
      }
      return { body: avatar, hands };
    });
    w.avatar = w.cast[0].body;
    s.add(w.avatar);

    // 水塘、牧人的家、岩丘与灌木，以及原野上的其他人。
    w.pondLevel = pond(s);
    w.smoke = homestead(s);
    kopje(s);
    for (const [x, z, size] of BUSHES) bush(s, x, z, size);
    acacia(s, -46.5, -45.5, 1.3); // 长颈鹿够叶子的树
    acacia(s, -42, -14.5, 1.5); // 旅人睡觉的树荫
    acacia(s, -51, 50, 1.6); // 奶奶拾柴的树
    rock(s, -5, 47.5, 0.7, groundHeight); // 老伯靠着歇脚的石头
    clearScattered(s, scattered);
    const residentViews = createResidentViews(tools, people, heightAt);
    w.residents = residents.map((def) => {
      const sim = createResident(def, random);
      return { def, sim, view: residentViews.spawn(s, def, sim) };
    });
    w.residentViews = residentViews;
    for (const { def, sim } of w.residents) leaders.set(def.id, sim);
    for (const [sim, leader] of followers) sim.leader = leaders.get(leader);
    const body = w.cast[0].body.userData.body;
    w.avatarState = 'loading';
    w.avatarReady = avatarModel.then(
      (model) => {
        body.add(model);
        w.avatarState = 'ready';
        return true;
      },
      (error) => {
        console.error('人物模型加载失败：', error);
        w.avatarState = 'failed';
        return false;
      },
    );
    w.particles = particles(s, 100, 80, '#fce6ac', 0.05, 15);

    // 场景内的小动画：蚁路、盘旋的鹰、炊烟、线索微光。
    const fireY = groundHeight(FIRE[0], FIRE[1]),
      ant = new THREE.Vector3(),
      raptorCenter = new THREE.Vector3(35, groundHeight(35, -80) + 48, -80);
    const antPath = (u, out) => {
      // 从石头底下出发的二次贝塞尔曲线。
      const a = (1 - u) * (1 - u),
        b = 2 * (1 - u) * u,
        c = u * u;
      return out.set(
        3 * a + 5.5 * b + 5.8 * c,
        0,
        -11.1 * a - 11 * b - 8.4 * c,
      );
    };
    w.animate = (time) => {
      for (let i = 0; i < ANTS; i++) {
        const dirSign = i % 2 ? 1 : -1;
        let u = (i / ANTS + time * 0.02 * dirSign) % 1;
        if (u < 0) u += 1;
        antPath(u, ant);
        antPath(Math.min(1, u + 0.01), to);
        const side = ((i % 3) - 1) * 0.025;
        dummy.position.set(
          ant.x + side,
          groundHeight(ant.x, ant.z) + 0.012,
          ant.z + side,
        );
        dummy.rotation.set(
          0,
          Math.atan2(to.x - ant.x, to.z - ant.z) + (dirSign < 0 ? Math.PI : 0),
          0,
        );
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        w.ants.setMatrixAt(i, dummy.matrix);
      }
      w.ants.instanceMatrix.needsUpdate = true;
      const a = time * 0.12;
      w.raptor.position.set(
        raptorCenter.x + Math.sin(a) * 22,
        raptorCenter.y + Math.sin(time * 0.05) * 6,
        raptorCenter.z + Math.cos(a) * 22,
      );
      w.raptor.rotation.set(0, a + Math.PI / 2, -0.3);
      markerMaterial.opacity = 0.32 + Math.sin(time * 2) * 0.16;
      // 几团烟依次从火塘升起、散开、变淡，被风吹向东北。
      for (let i = 0; i < w.smoke.length; i++) {
        const k = (time * 0.11 + i / w.smoke.length) % 1,
          puff = w.smoke[i];
        puff.position.set(
          FIRE[0] + k * 1.6,
          fireY + 0.4 + k * 4.5,
          FIRE[1] - k * 1.2,
        );
        puff.scale.setScalar(0.5 + k * 1.8);
        puff.material.opacity = (1 - k) * 0.55;
      }
    };
    w.setTrailGlow = (amount) => {
      w.trackMaterial.emissiveIntensity = amount * 0.9;
      for (const clue of w.clues)
        if (clue.marker) clue.marker.scale.setScalar(0.45 + amount * 0.5);
    };
    return w;
  }

  return makeHumanScene();
}
