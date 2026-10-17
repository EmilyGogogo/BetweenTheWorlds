import * as THREE from '../../vendor/three.module.js';

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
    tree,
    rand,
    rock,
    particles,
  } = tools;
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
    const r = rock(s, 10, -16, 3.7, groundHeight);
    w.talkers.push({
      object: r,
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
    // avatar 负责位置与朝向；body 承载模型并由主循环做行走起伏。
    w.avatar = new THREE.Group();
    const body = new THREE.Group();
    w.avatar.add(body);
    w.avatar.userData.body = body;
    s.add(w.avatar);
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
    return w;
  }

  return makeHumanScene();
}
