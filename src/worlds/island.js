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
    rock,
    field,
  } = tools;
  const w = newWorld(2),
    scene = w.scene;
  w.entities = [];
  const coastHeight = (x, z) => {
    const shore = -210 + Math.sin(x * 0.009) * 38 + Math.cos(x * 0.022) * 12;
    const inland = shore - z;
    if (inland < 0) return Math.max(-18, -4 + inland * 0.2);
    return (
      -4 +
      Math.max(0, inland) * 0.18 +
      Math.max(0, inland - 50) *
        0.07 *
        (1 + Math.sin(x * 0.018) * Math.cos(z * 0.019))
    );
  };
  w.coastHeight = coastHeight;
  const seabedHeight = (x, z) =>
    Math.max(
      coastHeight(x, z),
      -13 +
        Math.sin(x * 0.035) * Math.cos(z * 0.042) * 2 +
        Math.sin((x + z) * 0.08) * 0.6,
    );
  const islandSurfaces = [];
  w.seabedHeight = (x, z) => {
    let height = seabedHeight(x, z);
    for (const island of islandSurfaces) {
      const { group, size, surface } = island;
      const px = (x - group.position.x) / size;
      const pz = (z - group.position.z) / size;
      if (Math.abs(px) < 52 && Math.abs(pz) < 45)
        height = Math.max(height, group.position.y + surface(px, pz) * size);
    }
    return height;
  };
  w.sky = sky(scene, {
    top: '#6a94ad',
    bottom: '#ead5ad',
    direction: [-0.8, 0.34, -1],
  });
  w.sun = lights(scene, 3.5);
  w.sun.castShadow = false;
  addClouds(scene);
  scene.fog = new THREE.FogExp2('#a3bcc3', 0.0011);

  const sea = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: windUniform,
      storm: { value: 0 },
      sunDir: { value: new THREE.Vector3(-0.8, 0.34, -1).normalize() },
    },
    vertexShader: `uniform float uTime,storm; varying vec3 vPos; varying vec3 vNormalW;
      void main(){vec3 p=position; float t=uTime; float a=1.+storm*.65;
      float w1=p.x*.055+p.z*.026+t*.85, w2=p.z*.092-p.x*.018-t*1.1, w3=p.x*.18+p.z*.15+t*1.6;
      p.y=a*(sin(w1)*1.45+sin(w2)*.65+sin(w3)*.22);
      vec3 n=normalize(vec3(-a*(cos(w1)*.07975-cos(w2)*.0117+cos(w3)*.0396),1.,-a*(cos(w1)*.0377+cos(w2)*.0598+cos(w3)*.033)));
      vPos=(modelMatrix*vec4(p,1.)).xyz; vNormalW=n; gl_Position=projectionMatrix*viewMatrix*vec4(vPos,1.); }`,
    fragmentShader: `uniform float uTime,storm; uniform vec3 sunDir; varying vec3 vPos,vNormalW;
      void main(){vec3 N=normalize(vNormalW);vec3 V=normalize(cameraPosition-vPos);
      float small=sin(vPos.x*.62+vPos.z*.43+uTime*2.)*cos(vPos.z*.38-vPos.x*.27-uTime)+sin(vPos.x*1.1-vPos.z*.8+uTime)*.35;N=normalize(N+vec3(small*.055,0.,small*.045));
      float fres=pow(1.-abs(dot(N,V)),3.);
      float shore=-210.+sin(vPos.x*.009)*38.+cos(vPos.x*.022)*12.;
      float depth=clamp((vPos.z-shore+22.)/110.,0.,1.);
      vec3 c=mix(vec3(.10,.48,.43),vec3(.018,.15,.23),depth);
      c=mix(c,vec3(.55,.70,.76),fres*.68);
      float glint=.35+.65*pow(.5+.5*sin(vPos.x*3.7+sin(vPos.z*2.1)+uTime)*sin(vPos.z*4.3+uTime*.7),2.);
      float spec=pow(max(dot(reflect(-sunDir,N),V),0.),140.); c+=vec3(1.,.82,.51)*spec*.48*glint;
      float crest=smoothstep(1.4,2.25,vPos.y)*(.5+.5*sin(vPos.x*.8+vPos.z*.65+uTime));
      float surf=(1.-smoothstep(0.,30.,abs(vPos.z-shore+22.)))*smoothstep(.35,.8,sin(vPos.z*.45+uTime*1.8));
      c=mix(c,vec3(.86,.93,.88),clamp(crest*.5+surf*.65,0.,.8));
      c*=1.-storm*.27; float fog=1.-exp(-length(cameraPosition-vPos)*.0011);
      c=mix(c,mix(vec3(.64,.74,.77),vec3(.34,.43,.48),storm),fog);
      if(cameraPosition.y<-.3)c=mix(c,vec3(.03,.25,.28),.45);
      gl_FragColor=vec4(c,1.); }`,
  });
  const waterGeometry = new THREE.PlaneGeometry(2200, 2200, 280, 280);
  waterGeometry.rotateX(-Math.PI / 2);
  mesh(waterGeometry, sea, scene);

  const surfaceCanvas = document.createElement('canvas');
  surfaceCanvas.width = surfaceCanvas.height = 256;
  const surfaceContext = surfaceCanvas.getContext('2d');
  const surfacePixels = surfaceContext.createImageData(256, 256);
  for (let i = 0; i < surfacePixels.data.length; i += 4) {
    const value = Math.floor(rand(175, 255));
    surfacePixels.data[i] =
      surfacePixels.data[i + 1] =
      surfacePixels.data[i + 2] =
        value;
    surfacePixels.data[i + 3] = 255;
  }
  surfaceContext.putImageData(surfacePixels, 0, 0);
  const surfaceTexture = new THREE.CanvasTexture(surfaceCanvas);
  surfaceTexture.wrapS = surfaceTexture.wrapT = THREE.RepeatWrapping;
  surfaceTexture.repeat.set(24, 24);
  function land(parent, width, depth, height, segments = 64) {
    const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position,
      colors = [],
      color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i),
        y = height(x, z);
      positions.setY(i, y);
      color.set(y < 2.8 ? '#c4b48b' : y > 29 ? '#7e8985' : '#536d40');
      color.multiplyScalar(
        0.86 + Math.sin(x * 1.9 + z * 2.4) * 0.07 + rand(0, 0.14),
      );
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return mesh(
      geometry,
      mat('#ffffff', {
        vertexColors: true,
        roughness: 0.94,
        map: surfaceTexture,
        bumpMap: surfaceTexture,
        bumpScale: 0.25,
      }),
      parent,
    );
  }
  // A continuous coast supplies actual traversable ground, not a backdrop.
  land(scene, 1500, 1500, seabedHeight, 170);
  field(scene, 17000, 600, 2.2, (x, z) =>
    coastHeight(x, z) > 4 ? coastHeight(x, z) : -20,
  );
  for (let i = 0; i < 170; i++) {
    const x = rand(-650, 650),
      z = rand(-650, -240);
    if (coastHeight(x, z) > 7)
      tree(scene, x, z, rand(1.6, 3.4), i % 3 !== 0, coastHeight);
  }
  for (let i = 0; i < 90; i++) {
    const x = rand(-650, 650),
      z = rand(-400, -170);
    if (coastHeight(x, z) > -0.6) rock(scene, x, z, rand(2, 8), coastHeight);
  }

  function island(x, z, size, variant) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(size);
    scene.add(group);
    const phase = variant * 1.8;
    const height = (px, pz) => {
      const angle = Math.atan2(pz, px);
      const radius = Math.hypot(px / (variant === 2 ? 43 : 34), pz / 30);
      const edge =
        1 + 0.13 * Math.sin(angle * 3 + phase) + 0.08 * Math.cos(angle * 5);
      if (radius > edge) return -12;
      const mound = Math.max(0, 1 - radius / edge);
      if (variant === 1)
        return Math.max(0, 1 - Math.abs(radius - 0.56) * 3.2) * 6 - 2;
      if (variant === 2) {
        const left = Math.exp(-((px + 12) ** 2 / 130 + pz ** 2 / 180));
        const right = Math.exp(-((px - 12) ** 2 / 85 + (pz + 5) ** 2 / 100));
        return (
          mound * 8 +
          Math.max(left * 31, right * 39) * Math.min(1, mound * 4) -
          2
        );
      }
      if (variant === 3) {
        const crescent = Math.exp(-((px + 7) ** 2 / 300 + pz ** 2 / 80));
        return mound * 12 - crescent * 9 - 1;
      }
      if (variant === 4) {
        const plateau = Math.min(1, mound * 5);
        return (
          plateau * (18 + Math.sin(px * 0.31) * 3 + Math.cos(pz * 0.21) * 2) - 2
        );
      }
      const peak = 24;
      return (
        mound ** 1.4 * peak +
        Math.sin(px * 0.22 + phase) * Math.cos(pz * 0.18) * mound * 6 -
        2
      );
    };
    land(group, 105, 90, height, 64);
    islandSurfaces.push({ group, size, surface: height });
    for (let i = 0; i < 35; i++) {
      const px = rand(-30, 30),
        pz = rand(-26, 26),
        h = height(px, pz);
      if (h > 3 && h < 25 && variant !== 4)
        tree(group, px, pz, rand(0.7, 1.5), variant !== 1, height);
    }
    for (let i = 0; i < 12; i++) {
      const px = rand(-35, 35),
        pz = rand(-28, 28);
      if (height(px, pz) > 0) rock(group, px, pz, rand(0.7, 2), height);
    }
    const foamGeo = new THREE.RingGeometry(30, 30.6, 90);
    const foamPositions = foamGeo.attributes.position;
    for (let i = 0; i < foamPositions.count; i++) {
      const px = foamPositions.getX(i),
        py = foamPositions.getY(i);
      const angle = Math.atan2(py, px);
      let shoreRadius = 48;
      while (
        shoreRadius > 1 &&
        height(Math.cos(angle) * shoreRadius, -Math.sin(angle) * shoreRadius) <
          1
      )
        shoreRadius -= 0.5;
      const radius = shoreRadius + (Math.hypot(px, py) > 30.3 ? 0.8 : 0);
      foamPositions.setXY(
        i,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
    }
    foamGeo.computeBoundingSphere();
    const foam = mesh(
      foamGeo,
      new THREE.MeshBasicMaterial({
        color: '#cfe7dd',
        opacity: 0.1,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      group,
      0,
      0.5,
      0,
    );
    foam.rotation.x = -Math.PI / 2;
    return group;
  }
  const islandGround = (x, z) => Math.max(0.1, coastHeight(x, z) + 1);
  w.avatar = island(0, 0, 1, 0);
  w.primary = { ground: islandGround, limit: 620, speed: 25, distance: 150 };
  const names = ['环礁', '双峰岛', '松林岛', '长岬岛', '石脊岛', '远岛'];
  const islandThoughts = [
    '我把一片海留在身体里。每次潮汐，都有新的来客。',
    '风从两座山峰之间穿过。它从不问，哪一座更高。',
    '林中每一棵树，都在替我听风。',
    '我伸向海，并不是因为远方有什么答案。',
    '潮水带走了沙，留下我不愿藏起的棱角。',
    '从你的岸望来，我很遥远。从我这里，也一样。',
  ];
  const locations = [
    [68, -45, 0.72, 1],
    [-110, -55, 1.3, 2],
    [180, 90, 0.85, 0],
    [-210, 150, 0.75, 3],
    [300, -80, 1.2, 4],
    [-340, 70, 0.8, 1],
  ];
  locations.forEach(([x, z, size, variant], i) => {
    const object = island(x, z, size, variant);
    const entity = {
      object,
      name: names[i],
      kind: 'island',
      distance: 140 * size,
      height: 8,
      speed: 25,
      ground: islandGround,
      limit: 620,
      range: 180,
      scale: '≈ 1 千米',
    };
    w.entities.push(entity);
    w.recruitables.push({ object, joined: false, phase: i });
    w.talkers.push({
      object,
      name: names[i],
      range: 130,
      lines: [
        [islandThoughts[i], '原创 · 万物之间'],
        ['岸线每天改变，你却给了我一个不变的名字。', '原创 · 万物之间'],
      ],
    });
  });

  const wildlife = [];
  function bird(x, y, z, i) {
    const group = new THREE.Group();
    scene.add(group);
    group.position.set(x, y, z);
    const white = mat('#e1ded0'),
      dark = mat('#414e54');
    const body = mesh(new THREE.SphereGeometry(1, 12, 8), white, group);
    body.scale.set(0.7, 0.65, 1.8);
    mesh(new THREE.SphereGeometry(0.55, 12, 8), white, group, 0, 0.4, -1.4);
    for (const side of [-1, 1])
      mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        dark,
        group,
        side * 0.43,
        0.52,
        -1.59,
      );
    const beak = mesh(
      new THREE.ConeGeometry(0.18, 0.65, 8),
      mat('#c39747'),
      group,
      0,
      0.35,
      -2,
    );
    beak.rotation.x = -Math.PI / 2;
    const wings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      group.add(pivot);
      pivot.position.x = side * 0.4;
      const wing = mesh(
        new THREE.SphereGeometry(1, 8, 6),
        white,
        pivot,
        side * 1.7,
        0,
        0,
      );
      wing.scale.set(2.1, 0.1, 0.8);
      wing.rotation.y = side * 0.18;
      const tip = mesh(
        new THREE.SphereGeometry(1, 8, 6),
        dark,
        pivot,
        side * 3.1,
        0,
        side * 0.2,
      );
      tip.scale.set(0.8, 0.09, 0.55);
      wings.push(pivot);
    }
    const entity = {
      object: group,
      name: i === 0 ? '海鸥' : '海鸥 ' + (i + 1),
      kind: 'bird',
      mode: 'fly',
      distance: 17,
      height: 1,
      speed: 32,
      limit: 670,
      ground: null,
      range: 110,
      scale: '≈ 1 米',
    };
    w.entities.push(entity);
    wildlife.push({ entity, wings, phase: i, origin: group.position.clone() });
  }
  for (let i = 0; i < 6; i++) bird(-38 + i * 25, 35 + i * 4, -70 - i * 22, i);
  function fish(x, z, i) {
    const group = new THREE.Group();
    scene.add(group);
    group.position.set(x, -3, z);
    const silver = mat(i % 2 ? '#76acac' : '#cfb56a', {
      metalness: 0.25,
      roughness: 0.38,
    });
    const body = mesh(new THREE.SphereGeometry(1, 16, 10), silver, group);
    body.scale.set(0.55, 0.85, 2.2);
    const tail = mesh(
      new THREE.ConeGeometry(0.9, 1.3, 3),
      silver,
      group,
      0,
      0,
      2.3,
    );
    tail.rotation.x = Math.PI / 2;
    tail.scale.x = 0.2;
    const fin = mesh(
      new THREE.ConeGeometry(0.7, 1.1, 3),
      silver,
      group,
      0,
      0.8,
      0.35,
    );
    fin.scale.x = 0.1;
    for (const side of [-1, 1]) {
      const pectoral = mesh(
        new THREE.ConeGeometry(0.45, 1, 3),
        silver,
        group,
        side * 0.6,
        -0.2,
        -0.3,
      );
      pectoral.rotation.z = side * 0.9;
      pectoral.scale.z = 0.2;
    }
    for (const side of [-1, 1])
      mesh(
        new THREE.SphereGeometry(0.11, 8, 6),
        mat('#11292e'),
        group,
        side * 0.43,
        0.25,
        -1.3,
      );
    const entity = {
      object: group,
      name: i === 0 ? '银鳍鱼' : '银鳍鱼 ' + (i + 1),
      kind: 'fish',
      mode: 'swim',
      distance: 10,
      height: 0.2,
      speed: 18,
      limit: 580,
      ground: null,
      range: 100,
      scale: '≈ 60 厘米',
    };
    w.entities.push(entity);
    wildlife.push({ entity, tail, phase: i, origin: group.position.clone() });
  }
  for (let i = 0; i < 8; i++) fish(40 + i * 9, -120 + i * 8, i);
  // Visible reefs and kelp make the underwater perspective a place to explore.
  for (let i = 0; i < 65; i++) {
    const x = rand(-180, 230),
      z = rand(-170, 180);
    rock(scene, x, z, rand(1, 5), seabedHeight);
    if (i % 2 === 0) {
      const kelp = mesh(
        new THREE.ConeGeometry(0.8, 7, 5),
        mat('#497963'),
        scene,
        x,
        seabedHeight(x, z) + 3,
        z,
      );
      kelp.rotation.z = 0.2;
    }
  }
  field(scene, 4500, 180, 1.9, (x, z) =>
    seabedHeight(x, z) < -6 ? seabedHeight(x, z) : -30,
  );
  const coralMaterials = [mat('#b88a73'), mat('#9d765e'), mat('#809886')];
  const coralGeometry = new THREE.CylinderGeometry(0.12, 0.28, 2, 6);
  for (let i = 0; i < 24; i++) {
    const x = rand(20, 115),
      z = rand(-155, -80);
    rock(scene, x, z, rand(0.5, 1.7), seabedHeight);
    for (let j = 0; j < 4; j++) {
      const coral = mesh(
        coralGeometry,
        coralMaterials[i % 3],
        scene,
        x + Math.sin(j * 2.4) * 0.6,
        seabedHeight(x, z) + 1.1,
        z + Math.cos(j * 2.4) * 0.6,
      );
      coral.rotation.z = Math.sin(j * 2.4) * 0.45;
      coral.rotation.x = Math.cos(j * 2.4) * 0.3;
      coral.scale.y = rand(0.5, 1.5);
    }
  }
  const shoreMarker = new THREE.Group();
  shoreMarker.position.set(0, coastHeight(0, -290), -290);
  scene.add(shoreMarker);
  w.shoreMarker = shoreMarker;
  w.talkers.push({
    object: shoreMarker,
    name: '海岸',
    range: 110,
    embodiment: { portal: 1, range: 125 },
    lines: [['你叫这里陆地，浪叫这里归途。', '原创 · 万物之间']],
  });

  const rainGeo = new THREE.BufferGeometry(),
    rainPoints = [];
  for (let i = 0; i < 900; i++) {
    const x = rand(-220, 220),
      y = rand(0, 160),
      z = rand(-220, 220);
    rainPoints.push(x, y, z, x - 1, y - 5, z);
  }
  rainGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(rainPoints, 3),
  );
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({
      color: '#cadde2',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  scene.add(rain);
  const clearTop = new THREE.Color('#6a94ad'),
    stormTop = new THREE.Color('#344958');
  const clearBottom = new THREE.Color('#ead5ad'),
    stormBottom = new THREE.Color('#869b9f');
  const clearFog = new THREE.Color('#a3bcc3'),
    stormFog = new THREE.Color('#657b83'),
    underFog = new THREE.Color('#205b62');
  const sunWarm = new THREE.Color('#ffe2a4'),
    sunCool = new THREE.Color('#c9dce9');
  let weatherTime = 0;
  w.update = (dt, time, reduced) => {
    weatherTime += dt;
    const storm = reduced
      ? 0
      : 0.5 - 0.5 * Math.cos((weatherTime * Math.PI) / 45);
    sea.uniforms.storm.value = storm;
    w.weather =
      storm > 0.65 ? '海湾阵雨' : storm > 0.3 ? '云影掠海' : '晴光与潮汐';
    w.sky.material.uniforms.top.value.copy(clearTop).lerp(stormTop, storm);
    w.sky.material.uniforms.bottom.value
      .copy(clearBottom)
      .lerp(stormBottom, storm);
    w.sun.intensity = 3.5 - storm * 2.2;
    w.sun.color.copy(sunWarm).lerp(sunCool, storm);
    const underwater = w.controlled.kind === 'fish' && w.position.y < -1;
    scene.fog.color.copy(underwater ? underFog : clearFog);
    if (!underwater) scene.fog.color.lerp(stormFog, storm);
    scene.fog.density = underwater ? 0.018 : 0.0011 + storm * 0.001;
    rain.visible = !underwater && storm > 0.35;
    rain.material.opacity = Math.max(0, storm - 0.35) * 0.45;
    rain.position.set(w.position.x, -(time * 55) % 100, w.position.z);
    for (const animal of wildlife) {
      const { entity, phase, origin } = animal,
        object = entity.object;
      if (entity === w.controlled) {
        animal.wasControlled = true;
        animal.releasedAt = time;
        origin.copy(object.position);
      } else {
        if (animal.wasControlled) {
          origin.copy(object.position);
          animal.wasControlled = false;
        }
        const elapsed = reduced ? 0 : time - (animal.releasedAt || 0);
        const driftX = Math.sin(elapsed * 0.13 + phase) - Math.sin(phase);
        const driftZ = Math.cos(elapsed * 0.13 + phase) - Math.cos(phase);
        object.position.x = origin.x + driftX * 18;
        object.position.z = origin.z + driftZ * 12;
        object.rotation.y = Math.atan2(
          -Math.cos(time * 0.13 + phase),
          Math.sin(time * 0.13 + phase),
        );
      }
      if (animal.wings)
        animal.wings.forEach((wing, i) => {
          wing.rotation.z = reduced
            ? 0
            : Math.sin(time * 4 + phase) * 0.32 * (i ? 1 : -1);
        });
      if (animal.tail)
        animal.tail.rotation.z = reduced ? 0 : Math.sin(time * 7 + phase) * 0.3;
    }
    for (const entity of w.entities) {
      if (entity.kind === 'island')
        entity.object.rotation.z = reduced
          ? 0
          : Math.sin(time * 0.5 + entity.object.position.x) * 0.006;
    }
  };
  return w;
}
