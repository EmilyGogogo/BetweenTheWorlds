import * as THREE from '../../vendor/three.module.js';
import { sameKindEncounters } from '../content/encounters.js';
import { rng } from '../core/random.js';

export function makeSpace(tools) {
  const { newWorld, mesh, mat, rand } = tools;
  function planetTexture() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2d657c';
    ctx.fillRect(0, 0, 1024, 512);
    const rr = rng(218);
    for (let i = 0; i < 27; i++) {
      const x = rr() * 1024,
        y = 80 + rr() * 352,
        rx = 25 + rr() * 100,
        ry = 15 + rr() * 65;
      ctx.beginPath();
      for (let j = 0; j <= 48; j++) {
        const a = (j / 48) * Math.PI * 2,
          ir = 0.65 + rr() * 0.45;
        const px = x + Math.cos(a) * rx * ir,
          py = y + Math.sin(a) * ry * ir;
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = ['#6c804e', '#8d9466', '#446748', '#ad9e72'][i % 4];
      ctx.fill();
    }
    for (let i = 0; i < 4200; i++) {
      const x = rr() * 1024,
        y = rr() * 512;
      ctx.fillStyle = `rgba(240,244,223,${rr() * 0.17})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rr() * 17 + 2, rr() * 3 + 1, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#e7eddf');
    g.addColorStop(0.11, '#e7eddf00');
    g.addColorStop(0.89, '#e7eddf00');
    g.addColorStop(1, '#e7eddf');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function atmosphere(parent, radius, color = '#84bcf5', opacity = 0.65) {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        color: { value: new THREE.Color(color) },
        opacity: { value: opacity },
      },
      vertexShader:
        'varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader:
        'uniform vec3 color;uniform float opacity;varying vec3 n,eye;void main(){float edge=pow(1.-abs(dot(normalize(n),normalize(eye))),3.);gl_FragColor=vec4(color,edge*opacity);}',
    });
    return mesh(new THREE.SphereGeometry(radius, 48, 32), m, parent);
  }
  function makeSpaceScene() {
    const w = newWorld(3),
      s = w.scene;
    s.background = new THREE.Color('#060c19');
    s.fog = null;
    const sun = new THREE.DirectionalLight('#ffe1b6', 3.8);
    sun.position.set(-200, 100, 160);
    s.add(sun);
    s.add(new THREE.AmbientLight('#8e9bc4', 1.1));
    w.sun = sun;
    const starGeo = new THREE.BufferGeometry(),
      pos = [],
      colors = [];
    for (let i = 0; i < 4200; i++) {
      const d = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1))
        .normalize()
        .multiplyScalar(rand(850, 1400));
      pos.push(d.x, d.y, d.z);
      const c = new THREE.Color().setHSL(rand(0.05, 0.65), 0.25, rand(0.55, 1));
      colors.push(c.r, c.g, c.b);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    s.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          size: 1.15,
          vertexColors: true,
          sizeAttenuation: true,
        }),
      ),
    );
    const tex = planetTexture();
    w.avatar = new THREE.Group();
    s.add(w.avatar);
    w.globe = mesh(
      new THREE.SphereGeometry(23, 72, 48),
      mat('#ffffff', { map: tex, roughness: 0.87 }),
      w.avatar,
    );
    w.globe.rotation.z = 0.15;
    atmosphere(w.avatar, 24.1);
    const sameKind = w.avatar.clone(true);
    sameKind.position.set(35, 8, -45);
    sameKind.scale.setScalar(0.55);
    s.add(sameKind);
    w.sameKind = {
      object: sameKind,
      range: 70,
      ...sameKindEncounters[3],
    };
    const p = new THREE.Group();
    s.add(p);
    p.position.set(-150, 40, -230);
    p.rotation.z = 0.38;
    const gas = mesh(
      new THREE.SphereGeometry(49, 64, 40),
      mat('#c5a27c', { roughness: 1 }),
      p,
    );
    gas.rotation.z = 0.25;
    const ringGeo = new THREE.RingGeometry(66, 103, 160, 8);
    const rp = ringGeo.attributes.position,
      cs = [],
      co = new THREE.Color();
    for (let i = 0; i < rp.count; i++) {
      const r = Math.hypot(rp.getX(i), rp.getY(i)),
        f = 0.6 + 0.3 * Math.sin(r * 5) + 0.1 * Math.sin(r * 17);
      co.set('#c2b197').multiplyScalar(f);
      cs.push(co.r, co.g, co.b);
    }
    ringGeo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
    const ring = mesh(
      ringGeo,
      mat('#ffffff', {
        side: THREE.DoubleSide,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
      }),
      p,
    );
    ring.rotation.x = 1.14;
    w.talkers.push({
      object: p,
      range: 290,
      name: '有环的星球',
      lines: [
        ['你用距离衡量遥远，用自己衡量一切。', '原创 · 万物之间'],
        ['我们并不独立。引力一直在无声地交谈。', '原创 · 万物之间'],
      ],
    });
    const moon = mesh(
      new THREE.IcosahedronGeometry(9, 3),
      mat('#92918a', { flatShading: true }),
      s,
      80,
      5,
      -65,
    );
    w.talkers.push({
      object: moon,
      range: 75,
      name: '月亮',
      lines: [['你以为你在独行。我的潮汐，却一直跟着你。', '原创 · 万物之间']],
    });
    // Sparse luminous dust supplies depth without flattening the navigable sky into a picture.
    const hazeGeo = new THREE.BufferGeometry(),
      hp = [];
    for (let i = 0; i < 900; i++) {
      hp.push(
        rand(-1100, 1100),
        rand(-80, 80) + Math.sin(i) * 120,
        rand(-1000, -600),
      );
    }
    hazeGeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    s.add(
      new THREE.Points(
        hazeGeo,
        new THREE.PointsMaterial({
          color: '#9f91bd',
          size: 8,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        }),
      ),
    );
    return w;
  }

  return makeSpaceScene();
}
