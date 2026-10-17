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
  const groundHeight = (x, z) =>
    Math.sin(x * 0.016) * Math.cos(z * 0.021) * 8 +
    Math.sin(x * 0.041 + z * 0.029) * 2.3 +
    Math.cos(z * 0.008) * 3;
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
  function groundTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a9ab8c';
    ctx.fillRect(0, 0, 512, 512);
    const rr = rng(777);
    for (let i = 0; i < 60000; i++) {
      const x = rr() * 512,
        y = rr() * 512,
        n = rr();
      ctx.fillStyle =
        n > 0.7
          ? 'rgba(211,204,156,.35)'
          : n > 0.3
            ? 'rgba(71,78,43,.28)'
            : 'rgba(114,98,65,.4)';
      ctx.fillRect(x, y, rr() * 3 + 0.4, rr() * 5 + 0.4);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(90, 90);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const earthTexture = groundTexture();
  function terrain(parent, width, segments, h, colors) {
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
          Math.max(
            0,
            Math.min(
              1,
              0.45 +
                y * 0.025 +
                Math.sin(x * 0.5 + z * 0.6) * 0.1 +
                random() * 0.18,
            ),
          ),
        );
      c.push(color.r, color.g, color.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.computeVertexNormals();
    const o = mesh(
      g,
      mat('#ffffff', {
        vertexColors: true,
        map: earthTexture,
        roughness: 1,
        bumpMap: earthTexture,
        bumpScale: 0.07,
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
      sameKind: null,
      followers: [],
      recruitables: [],
      moving: 0,
    };
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
