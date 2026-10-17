import * as THREE from '../../vendor/three.module.js';

export function makeIsland(tools) {
  const {
    newWorld,
    sky,
    lights,
    addClouds,
    windUniform,
    mesh,
    mat,
    rand,
    tree,
  } = tools;
  function water(parent, width = 2400) {
    const geo = new THREE.PlaneGeometry(width, width, 100, 100);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({
      transparent: false,
      uniforms: {
        uTime: windUniform,
        deep: { value: new THREE.Color('#17464e') },
        shallow: { value: new THREE.Color('#578d8d') },
        sunDir: { value: new THREE.Vector3(-0.7, 0.35, -0.8).normalize() },
      },
      vertexShader: `uniform float uTime;varying vec3 vPos;varying vec3 vNormalW;void main(){vec3 p=position;float x=p.x,z=p.z,t=uTime; p.y+=sin(x*.09+t*.8)*.45+cos(z*.12+t*.6)*.35+sin(x*.25+z*.21+t)*.13;vec3 n=normalize(vec3(-.0405*cos(x*.09+t*.8)-.0325*cos(x*.25+z*.21+t),1.,.042*sin(z*.12+t*.6)-.0273*cos(x*.25+z*.21+t)));vPos=(modelMatrix*vec4(p,1.)).xyz;vNormalW=normalize(mat3(modelMatrix)*n);gl_Position=projectionMatrix*viewMatrix*vec4(vPos,1.);}`,
      fragmentShader: `uniform vec3 deep,shallow,sunDir;uniform float uTime;varying vec3 vPos,vNormalW;void main(){vec3 V=normalize(cameraPosition-vPos);vec3 N=normalize(vNormalW);float f=pow(1.-max(dot(N,V),0.),3.);float wave=sin(vPos.x*.8+vPos.z*.6+uTime)*sin(vPos.z*.9-uTime*.6);vec3 c=mix(deep,shallow,.28+f*.5+wave*.03);float spec=pow(max(dot(reflect(-sunDir,N),V),0.),140.);c+=vec3(1.,.76,.42)*spec*1.8;float foam=pow(max(0.,wave),18.)*.12;c+=foam;float fog=1.-exp(-length(cameraPosition-vPos)*.0012);c=mix(c,vec3(.61,.66,.65),fog);gl_FragColor=vec4(c,1.);}`,
    });
    return mesh(geo, m, parent, 0, -0.4, 0);
  }
  function island(parent, size = 1) {
    const g = new THREE.Group();
    parent.add(g);
    g.scale.setScalar(size);
    const geo = new THREE.PlaneGeometry(70, 65, 42, 40);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position,
      colors = [],
      c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        d = Math.sqrt((x / 33) ** 2 + (z / 29) ** 2);
      const shape = Math.max(0, 1 - d);
      const h =
        shape ** 1.9 * 23 +
        Math.sin(x * 0.21) * Math.cos(z * 0.25) * shape * 4 -
        1.2;
      p.setY(i, h);
      c.set(h < 1.2 ? '#b8ac80' : h > 12 ? '#727b71' : '#586e41');
      c.multiplyScalar(rand(0.85, 1.12));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const a = mesh(
      geo,
      mat('#ffffff', { vertexColors: true, flatShading: true }),
      g,
    );
    a.castShadow = true;
    a.receiveShadow = true;
    const h = (x, z) =>
      Math.max(0, 1 - Math.sqrt((x / 33) ** 2 + (z / 29) ** 2)) ** 1.9 * 23 +
      Math.sin(x * 0.21) *
        Math.cos(z * 0.25) *
        Math.max(0, 1 - Math.sqrt((x / 33) ** 2 + (z / 29) ** 2)) *
        4 -
      1.2;
    for (let i = 0; i < 38; i++) {
      const x = rand(-20, 20),
        z = rand(-20, 20);
      if (h(x, z) > 2) tree(g, x, z, rand(0.45, 0.9), true, h);
    }
    const ring = mesh(
      new THREE.RingGeometry(30, 32, 70),
      new THREE.MeshBasicMaterial({
        color: '#bdcfc0',
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      g,
      0,
      -0.05,
      0,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.y = 0.85;
    return g;
  }
  function makeIslandScene() {
    const w = newWorld(2),
      s = w.scene;
    w.sky = sky(s, {
      top: '#6e8b9d',
      bottom: '#f2c99a',
      direction: [-0.8, 0.24, -1],
    });
    w.sun = lights(s, 3.5);
    addClouds(s);
    water(s);
    w.avatar = island(s);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399,
        r = rand(175, 520);
      const o = island(s, rand(0.4, 1.3));
      o.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      w.talkers.push({
        object: o,
        range: 115,
        name: '远岛',
        lines: [
          ['隔开我们的海，也把我们连接。', '原创 · 万物之间'],
          ['所谓孤岛，只是你暂时看不见海底的山脉。', '原创 · 万物之间'],
        ],
      });
    }
    return w;
  }

  return makeIslandScene();
}
