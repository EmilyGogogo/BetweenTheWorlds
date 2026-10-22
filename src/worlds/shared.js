import * as THREE from '../../vendor/three.module.js';
import { rng } from '../core/random.js';

export function createWorldTools(renderer) {
  const dummy = new THREE.Object3D();
  const random = rng(1729);
  const rand = (a, b) => a + (b - a) * random();
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.93, ...extra });
  const rockMats = [
    mat('#66685a'),
    mat('#8a8270'),
    mat('#6e7168'),
    mat('#a2997b'),
  ];
  const bark = mat('#514835'),
    leaf = mat('#58633a'),
    pineLeaf = mat('#3c5045');
  // 地形起伏的系数只写一次，JS 与 GLSL 两个版本都从这里生成，避免草毯着色器与
  // 实际地面高度产生偏移。
  const GROUND = {
    broad: [0.016, 0.021, 8],
    ripple: [0.041, 0.029, 2.3],
    swell: [0.008, 3],
  };
  const groundHeight = (x, z) =>
    Math.sin(x * GROUND.broad[0]) *
      Math.cos(z * GROUND.broad[1]) *
      GROUND.broad[2] +
    Math.sin(x * GROUND.ripple[0] + z * GROUND.ripple[1]) * GROUND.ripple[2] +
    Math.cos(z * GROUND.swell[0]) * GROUND.swell[1];
  const groundHeightGLSL = `float groundHeight(vec2 p){
  return sin(p.x*${GROUND.broad[0]})*cos(p.y*${GROUND.broad[1]})*${GROUND.broad[2].toFixed(1)}
    + sin(p.x*${GROUND.ripple[0]}+p.y*${GROUND.ripple[1]})*${GROUND.ripple[2]}
    + cos(p.y*${GROUND.swell[0]})*${GROUND.swell[1].toFixed(1)};
}`;
  const microHeight = (x, z) =>
    Math.sin(x * 0.22) * 0.25 +
    Math.sin(z * 0.29) * 0.19 +
    Math.cos(x * 0.4 + z * 0.32) * 0.09;
  function mesh(g, m, parent, x = 0, y = 0, z = 0) {
    const a = new THREE.Mesh(g, m);
    a.position.set(x, y, z);
    parent.add(a);
    return a;
  }
  function rock(parent, x, z, scale = 1, h = () => 0) {
    const o = mesh(
      new THREE.IcosahedronGeometry(1, 1),
      rockMats[Math.floor(rand(0, rockMats.length))],
      parent,
      x,
      h(x, z) + scale * 0.35,
      z,
    );
    o.scale.set(
      scale * rand(0.8, 1.5),
      scale * rand(0.6, 1),
      scale * rand(0.7, 1.3),
    );
    o.rotation.set(rand(0, 1), rand(0, 6), rand(0, 1));
    o.castShadow = true;
    o.receiveShadow = true;
    return o;
  }

  const windUniform = { value: 0 };
  // 人这一层的草毯跟随受控实体平移，main.js 每帧写入当前位置。
  const playerUniform = { value: new THREE.Vector3() };
  function grassMaterial() {
    const m = mat('#d4d6ab', {
      side: THREE.DoubleSide,
      roughness: 0.75,
      vertexColors: true,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniform;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
 float bend=pow(clamp(position.y,0.0,1.0),1.6);
 transformed.x += sin(uTime*1.7+instanceMatrix[3].x*.7+instanceMatrix[3].z*.3)*bend*.19;
 transformed.z += cos(uTime*1.15+instanceMatrix[3].z*.5)*bend*.08;`,
      );
    };
    return m;
  }
  const bladeGeometry = (() => {
    const g = new THREE.BufferGeometry(),
      p = [],
      c = [],
      idx = [];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6,
        w = 0.045 * (1 - t) + 0.003;
      for (const side of [-1, 1]) {
        p.push(side * w, t, t * t * 0.24);
        const co = new THREE.Color(side < 0 ? '#b9cb77' : '#e4e6a3');
        co.multiplyScalar(0.75 + t * 0.25);
        c.push(co.r, co.g, co.b);
      }
      if (j < 6) {
        const k = j * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  function field(parent, count, radius, height, h, clear = 0) {
    const m = grassMaterial(),
      o = new THREE.InstancedMesh(bladeGeometry, m, count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x = rand(-radius, radius);
      const z = rand(-radius, radius);
      if (Math.hypot(x, z) < clear) {
        x += clear;
      }
      dummy.position.set(x, h(x, z), z);
      dummy.rotation.set(0, rand(0, Math.PI * 2), 0);
      const s = height * rand(0.5, 1.5);
      dummy.scale.set(s * rand(0.7, 1.4), s, s);
      dummy.updateMatrix();
      o.setMatrixAt(i, dummy.matrix);
      c.setHSL(rand(0.15, 0.22), rand(0.2, 0.5), rand(0.42, 0.65));
      o.setColorAt(i, c);
    }
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function tree(parent, x, z, size = 1, pine = false, h = groundHeight) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(x, h(x, z), z);
    g.scale.setScalar(size);
    const trunk = mesh(
      new THREE.CylinderGeometry(0.16, 0.27, 3.3, 7),
      bark,
      g,
      0,
      1.65,
      0,
    );
    trunk.castShadow = true;
    if (pine) {
      for (let i = 0; i < 4; i++) {
        const a = mesh(
          new THREE.ConeGeometry(1.7 - i * 0.31, 2.5, 8),
          pineLeaf,
          g,
          0,
          2 + i * 0.8,
          0,
        );
        a.castShadow = true;
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4;
        const canopy = mesh(
          new THREE.IcosahedronGeometry(1, 1),
          leaf,
          g,
          Math.sin(a) * 1.5,
          3.6 + rand(-0.2, 0.4),
          Math.cos(a) * 1.1,
        );
        canopy.scale.set(1.65, 0.6, 1.35);
        canopy.castShadow = true;
        const from = new THREE.Vector3(0, 2.1, 0),
          to = new THREE.Vector3(Math.sin(a) * 1.5, 3.5, Math.cos(a) * 1.1),
          dir = to.clone().sub(from);
        const branch = mesh(
          new THREE.CylinderGeometry(0.065, 0.13, dir.length(), 6),
          bark,
          g,
        );
        branch.position.copy(from.add(to).multiplyScalar(0.5));
        branch.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.normalize(),
        );
      }
    }
    return g;
  }
  // 默认参数与原先的固定贴图完全一致，其他尺度的地面不受影响。
  function groundTexture(opts = {}) {
    const {
      base = '#a9ab8c',
      strokes = [
        'rgba(211,204,156,.35)',
        'rgba(71,78,43,.28)',
        'rgba(114,98,65,.4)',
      ],
      cuts = [0.7, 0.3],
      count = 60000,
      size = [3, 5],
      repeat = 90,
      seed = 777,
    } = opts;
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    const rr = rng(seed);
    for (let i = 0; i < count; i++) {
      const x = rr() * 512,
        y = rr() * 512,
        n = rr();
      ctx.fillStyle =
        n > cuts[0] ? strokes[0] : n > cuts[1] ? strokes[1] : strokes[2];
      ctx.fillRect(x, y, rr() * size[0] + 0.4, rr() * size[1] + 0.4);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const earthTexture = groundTexture();
  function terrain(parent, width, segments, h, colors, opts = {}) {
    const {
      map = earthTexture,
      bumpScale = 0.07,
      // 返回 0–1 的混色权重；默认沿用原先的高度 + 细碎随机。
      blend = (x, z, y) =>
        0.45 + y * 0.025 + Math.sin(x * 0.5 + z * 0.6) * 0.1 + random() * 0.18,
    } = opts;
    const g = new THREE.PlaneGeometry(width, width, segments, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position,
      c = [];
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        y = h(x, z);
      pos.setY(i, y);
      color
        .set(colors[0])
        .lerp(
          new THREE.Color(colors[1]),
          Math.max(0, Math.min(1, blend(x, z, y))),
        );
      c.push(color.r, color.g, color.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.computeVertexNormals();
    const o = mesh(
      g,
      mat('#ffffff', {
        vertexColors: true,
        map,
        roughness: 1,
        bumpMap: map,
        bumpScale,
      }),
      parent,
    );
    o.receiveShadow = true;
    return o;
  }
  function sky(
    scene,
    {
      top = '#7899b2',
      bottom = '#e8ce9e',
      sun = '#fff0bc',
      direction = [-0.8, 0.28, -1],
      haze = 0,
    } = {},
  ) {
    const d = new THREE.Vector3(...direction).normalize();
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(top) },
        bottom: { value: new THREE.Color(bottom) },
        sunColor: { value: new THREE.Color(sun) },
        sunDir: { value: d },
        haze: { value: haze },
      },
      vertexShader:
        'varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec3 vDir; uniform vec3 top,bottom,sunColor,sunDir; uniform float haze; void main(){vec3 d=normalize(vDir);float h=max(d.y,0.0); vec3 c=mix(bottom,top,pow(h,.55));float s=max(dot(d,sunDir),0.0);c+=sunColor*(pow(s,450.0)*2.6+pow(s,12.0)*.13+pow(s,4.0)*haze);gl_FragColor=vec4(c,1.0);}`,
    });
    const a = mesh(new THREE.SphereGeometry(1600, 32, 20), m, scene);
    return a;
  }
  function cloudTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 32; i++) {
      const x = rand(30, 226),
        y = rand(40, 90),
        r = rand(18, 44);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,250,230,.23)');
      g.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return new THREE.CanvasTexture(c);
  }
  const clouds = cloudTexture();
  function addClouds(scene) {
    for (let i = 0; i < 18; i++) {
      const m = new THREE.SpriteMaterial({
        map: clouds,
        color: '#efdbc2',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        fog: false,
      });
      const a = new THREE.Sprite(m);
      a.position.set(rand(-600, 600), rand(100, 260), rand(-650, 300));
      a.scale.set(rand(150, 350), rand(35, 70), 1);
      scene.add(a);
    }
  }
  function lights(scene, intensity = 3) {
    scene.add(new THREE.HemisphereLight('#e3e5d8', '#4d513c', 2));
    const fill = new THREE.DirectionalLight('#c9dce9', 1.1);
    fill.position.set(30, 35, 70);
    scene.add(fill);
    const sun = new THREE.DirectionalLight('#ffe2a4', intensity);
    sun.position.set(-60, 58, -75);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -35,
      right: 35,
      top: 35,
      bottom: -35,
      near: 0.1,
      far: 220,
    });
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);
    return sun;
  }
  function mountains(scene) {
    for (let band = 0; band < 3; band++) {
      const radius = 460 + band * 240;
      const geo = new THREE.PlaneGeometry(2400, 2400, 90, 90);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position,
        cs = [],
        color = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = p.getZ(i),
          r = Math.hypot(x, z),
          angle = Math.atan2(x, z);
        const ridge =
          70 +
          Math.sin(angle * 7 + band) * 28 +
          Math.sin(angle * 13) * 18 +
          Math.cos(angle * 23) * 9;
        const edge = Math.max(0, 1 - Math.abs(r - radius) / 210);
        const n = Math.sin(x * 0.037 + z * 0.029) * Math.cos(z * 0.043) * 12;
        const h = edge * (ridge + n) * (1 + band * 0.25) - 20;
        p.setY(i, h);
        color.set(band === 0 ? '#74827c' : band === 1 ? '#8a9791' : '#9ca5a1');
        color.multiplyScalar(0.9 + Math.max(0, h) / 400);
        cs.push(color.r, color.g, color.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
      geo.computeVertexNormals();
      mesh(
        geo,
        mat('#ffffff', { vertexColors: true, flatShading: true }),
        scene,
      );
    }
  }
  function newWorld(index) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a7b4aa');
    scene.fog = new THREE.FogExp2('#b6b8a2', index === 0 ? 0.013 : 0.0026);
    const group = new THREE.Group();
    scene.add(group);
    return {
      index,
      scene,
      group,
      position: new THREE.Vector3(),
      talkers: [],
      followers: [],
      recruitables: [],
      moving: 0,
    };
  }
  // 一片草叶：越往上越窄、向前弯，顶点明暗让根部压暗、叶尖受光。
  function bladeShape(segments, width, curve) {
    const g = new THREE.BufferGeometry(),
      p = [],
      idx = [];
    for (let j = 0; j <= segments; j++) {
      const t = j / segments,
        w = width * (1 - t * 0.9) + 0.002;
      for (const side of [-1, 1]) p.push(side * w, t, t * t * curve);
      if (j < segments) {
        const k = j * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /**
   * 密草层。instanced 绘制，每簇草的位置、朝向、高矮和颜色放在实例属性里。
   * 传 tile 时草毯在着色器里按 tile 网格环绕到玩家周围：代价与玩家位置无关，
   * 近处才能铺满而不必为整片原野生成几百万根草。草在环绕边界处缩放到 0，
   * 不会看到跳变。tile 为 0 时是一批静止的草丛，用于中景。
   * 落地高度在着色器里用 groundHeight 求值，因此只适用于大地层的地形。
   * 生命周期：几何体与材质随场景一次性创建，与其他场景对象一样常驻。
   */
  function grassLayer(parent, opts = {}) {
    const {
      count = 60000,
      tile = 0,
      radius = 120,
      clumps = 0,
      clumpRadius = 0.7,
      height = 0.45,
      heightVariance = [0.6, 1.5],
      width = 0.03,
      curve = 0.3,
      segments = 4,
      tint = () => new THREE.Color('#8d9b57'),
      windStrength = 0.17,
      shade = 0.4,
      sunDirection = null,
    } = opts;
    const geo = new THREE.InstancedBufferGeometry();
    const blade = bladeShape(segments, width, curve);
    geo.index = blade.index;
    geo.attributes.position = blade.attributes.position;
    geo.attributes.normal = blade.attributes.normal;
    geo.instanceCount = count;

    // x, z, 朝向, 缩放
    const inst = new Float32Array(count * 4);
    const colors = new Float32Array(count * 3);
    const c = new THREE.Color();
    let cx = 0,
      cz = 0;
    for (let i = 0; i < count; i++) {
      let x, z;
      if (clumps) {
        if (i % Math.ceil(count / clumps) === 0) {
          cx = rand(-radius, radius);
          cz = rand(-radius, radius);
        }
        const a = rand(0, Math.PI * 2),
          r = Math.sqrt(rand(0, 1)) * clumpRadius;
        x = cx + Math.cos(a) * r;
        z = cz + Math.sin(a) * r;
      } else if (tile) {
        x = rand(-tile / 2, tile / 2);
        z = rand(-tile / 2, tile / 2);
      } else {
        x = rand(-radius, radius);
        z = rand(-radius, radius);
      }
      inst[i * 4] = x;
      inst[i * 4 + 1] = z;
      inst[i * 4 + 2] = rand(0, Math.PI * 2);
      inst[i * 4 + 3] = height * rand(heightVariance[0], heightVariance[1]);
      c.copy(tint(x, z));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
    geo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));

    const m = mat('#ffffff', {
      side: THREE.DoubleSide,
      roughness: 0.82,
      vertexColors: true,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniform;
      shader.uniforms.uPlayer = playerUniform;
      shader.uniforms.uTile = { value: tile };
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `attribute vec4 aInst;
uniform float uTime,uTile;
uniform vec3 uPlayer;
${groundHeightGLSL}
void main() {`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
 float yaw=aInst.z, cy=cos(yaw), sy=sin(yaw);
 objectNormal.xz=vec2(objectNormal.x*cy-objectNormal.z*sy,objectNormal.x*sy+objectNormal.z*cy);`,
        )
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed=position*vec3(aInst.w,aInst.w,aInst.w);
 transformed.xz=vec2(transformed.x*cy-transformed.z*sy,transformed.x*sy+transformed.z*cy);
 vec2 base=aInst.xy;
 float fade=1.0;
 if(uTile>0.0){
   base+=floor((uPlayer.xz-base)/uTile+0.5)*uTile;
   fade=1.0-smoothstep(uTile*0.34,uTile*0.48,length(base-uPlayer.xz));
 }
 float bend=pow(clamp(position.y,0.0,1.0),1.6)*aInst.w;
 transformed.x+=sin(uTime*1.6+base.x*0.7+base.y*0.35)*bend*${windStrength.toFixed(3)};
 transformed.z+=cos(uTime*1.1+base.y*0.5)*bend*${(windStrength * 0.45).toFixed(3)};
 transformed*=fade;
 transformed+=vec3(base.x,groundHeight(base),base.y);`,
        )
        .replace(
          '#include <color_vertex>',
          `#include <color_vertex>
 vColor*=${shade.toFixed(2)}+${(1 - shade).toFixed(2)}*clamp(position.y,0.0,1.0);`,
        );
      if (sunDirection) {
        shader.uniforms.uMeadowSun = {
          value: new THREE.Vector3(...sunDirection).normalize(),
        };
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nuniform vec3 uMeadowSun;',
          )
          .replace(
            '#include <opaque_fragment>',
            `vec3 meadowSunView=normalize((viewMatrix*vec4(uMeadowSun,0.0)).xyz);
float meadowBacklight=pow(max(dot(-normalize(vViewPosition),meadowSunView),0.0),4.0);
outgoingLight+=diffuseColor.rgb*vec3(1.0,.79,.42)*meadowBacklight*.65;
#include <opaque_fragment>`,
          );
      }
    };
    // 不同草层将参数写入 GLSL，必须区分程序缓存，不能复用第一层的风幅和明暗。
    m.customProgramCacheKey = () =>
      `meadow-${windStrength}-${shade}-${Boolean(sunDirection)}`;
    const o = new THREE.Mesh(geo, m);
    o.receiveShadow = true;
    // 草毯跟随玩家、静止草丛覆盖整片原野，包围盒都不适合逐帧剔除。
    o.frustumCulled = false;
    parent.add(o);
    return o;
  }

  function particles(parent, count, radius, color, size, height) {
    const geo = new THREE.BufferGeometry(),
      pos = [];
    for (let i = 0; i < count; i++)
      pos.push(rand(-radius, radius), rand(0.3, height), rand(-radius, radius));
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const a = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    parent.add(a);
    return a;
  }

  return {
    renderer,
    rand,
    microHeight,
    groundHeight,
    windUniform,
    playerUniform,
    grassLayer,
    groundTexture,
    newWorld,
    sky,
    lights,
    addClouds,
    terrain,
    field,
    rock,
    rockMats,
    dummy,
    mesh,
    mat,
    tree,
    mountains,
    particles,
  };
}
