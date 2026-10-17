import * as THREE from '../../vendor/three.module.js';
import { grassSpecies } from '../content/grass-feelings.js';
import {
  BASE_HEIGHT_CM,
  createGrassEnvironment,
  heightCm,
} from '../core/grass-environment.js';
import { createFauna } from './micro-fauna.js';
import { createFlora } from './micro-flora.js';

const TAU = Math.PI * 2;
// A low sun ahead of the starting camera, so the meadow is lit from behind as
// in the golden-hour reference and blades glow where light passes through.
// The visible disc sits nearer the horizon than the light, keeping it in frame
// without stretching shadows across the whole field.
const SUN_DIRECTION = new THREE.Vector3(-0.42, 0.26, -0.87).normalize();
const SKY_SUN_DIRECTION = new THREE.Vector3(-0.42, 0.07, -0.87).normalize();
const AVATAR_SIZE = 1.2;
const CLEAR_SKY = {
  top: new THREE.Color('#4c7fc2'),
  bottom: new THREE.Color('#f5d7a2'),
};
const GREY_SKY = {
  top: new THREE.Color('#7f8e9c'),
  bottom: new THREE.Color('#c3c2b6'),
};
const CLEAR_FOG = new THREE.Color('#e3d3a6');
const GREY_FOG = new THREE.Color('#a7aba1');
const SUN_DISC = new THREE.Color('#fff0c4');
const WHITE = new THREE.Color('#ffffff');
const WET_SOIL = new THREE.Color('#8a7f78');
const GREY_HILLS = new THREE.Color('#c4c6c8');

export function makeMicro(tools) {
  const {
    newWorld,
    sky,
    lights,
    addClouds,
    terrain,
    microHeight,
    rock,
    rand,
    particles,
    windUniform,
  } = tools;
  const flora = createFlora(tools);

  // Distant blue ridges that stay visible through the meadow haze.
  function hills(scene) {
    const materials = [];
    for (const [radius, hex, height, seed] of [
      [330, '#93a3bb', 34, 0],
      [250, '#a9b4c2', 20, 2.1],
    ]) {
      const positions = [],
        colors = [],
        index = [];
      const top = new THREE.Color(hex),
        foot = new THREE.Color('#e6dcc4');
      const segments = 160;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * TAU;
        const ridge =
          height *
          (0.55 +
            0.25 * Math.sin(angle * 3 + seed) +
            0.15 * Math.sin(angle * 7.3 + seed * 2) +
            0.08 * Math.sin(angle * 17 + seed));
        const x = Math.sin(angle) * radius,
          z = Math.cos(angle) * radius;
        positions.push(x, -12, z, x, ridge, z);
        colors.push(foot.r, foot.g, foot.b, top.r, top.g, top.b);
        if (i < segments) {
          const k = i * 2;
          index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3),
      );
      geometry.setIndex(index);
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        fog: false,
        side: THREE.DoubleSide,
      });
      scene.add(new THREE.Mesh(geometry, material));
      materials.push(material);
    }
    return materials;
  }

  // Rain streaks fall in the shader and follow the player.
  function rainStreaks() {
    const positions = [],
      ends = [];
    for (let i = 0; i < 1400; i++) {
      const x = rand(-12, 12),
        y = rand(0, 7),
        z = rand(-12, 12);
      positions.push(x, y, z, x, y, z);
      ends.push(0, 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
    const rain = new THREE.LineSegments(
      geometry,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: windUniform, uRain: { value: 0 } },
        vertexShader: /* glsl */ `
attribute float aEnd;
uniform float uTime;
void main() {
  vec3 p = position;
  p.y = mod(position.y - uTime * 7.5, 7.0) + aEnd * 0.3;
  p.x += aEnd * 0.035;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
        fragmentShader: /* glsl */ `
uniform float uRain;
void main() { gl_FragColor = vec4(0.86, 0.9, 0.97, 0.5 * uRain); }`,
      }),
    );
    rain.frustumCulled = false;
    rain.visible = false;
    return rain;
  }

  // Motes rising from the player's leaves while photosynthesis is strong.
  function lifeMotes(parent) {
    const positions = [],
      speeds = [];
    for (let i = 0; i < 36; i++) {
      const angle = rand(0, TAU),
        radius = rand(0.05, 0.45);
      positions.push(
        Math.cos(angle) * radius,
        rand(0, 1.3),
        Math.sin(angle) * radius,
      );
      speeds.push(rand(0.6, 1.4));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      'aSpeed',
      new THREE.Float32BufferAttribute(speeds, 1),
    );
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: windUniform, uStrength: { value: 0 } },
      vertexShader: /* glsl */ `
attribute float aSpeed;
uniform float uTime;
varying float vFade;
void main() {
  vec3 p = position;
  p.y = mod(position.y + uTime * 0.12 * aSpeed, 1.3);
  vFade = sin(p.y / 1.3 * 3.14159);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min(18.0, 21.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: /* glsl */ `
uniform float uStrength;
varying float vFade;
void main() {
  float glow = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(0.93, 1.0, 0.72, glow * vFade * uStrength);
}`,
    });
    const motes = new THREE.Points(geometry, material);
    motes.frustumCulled = false;
    parent.add(motes);
    return material;
  }

  function makeMicroScene() {
    const world = newWorld(0),
      scene = world.scene;
    world.sky = sky(scene, {
      top: '#4c7fc2',
      bottom: '#f5d7a2',
      sun: '#fff0c4',
      direction: SKY_SUN_DIRECTION.toArray(),
      haze: 0.35,
    });
    const skyUniforms = world.sky.material.uniforms;
    const sunlight = lights(scene, 3.4);
    world.sun = sunlight;
    sunlight.color.set('#ffd28a');
    Object.assign(sunlight.shadow.camera, {
      left: -16,
      right: 16,
      top: 16,
      bottom: -16,
    });
    sunlight.shadow.camera.updateProjectionMatrix();
    const hemisphere = scene.children.find((child) => child.isHemisphereLight);
    hemisphere.color.set('#d4e2ef');
    hemisphere.groundColor.set('#5b4532');
    scene.fog = new THREE.FogExp2(CLEAR_FOG.getHex(), 0.017);
    flora.swayUniforms.uSunDir.value.copy(SKY_SUN_DIRECTION);
    addClouds(scene);
    const hillMaterials = hills(scene);

    const soil = flora.dressSoil(
      terrain(scene, 160, 180, microHeight, ['#a39684', '#cdbba0']),
    );
    const blades = flora.buildMeadow(scene);
    flora.buildClods(scene);
    flora.buildLitter(scene);
    for (let i = 0; i < 40; i++) {
      const [x, z] = flora.annulus(3, 55);
      rock(scene, x, z, rand(0.08, 0.55), microHeight);
    }
    world.avatar = flora.tuft(scene, 'tuft', 'self', 0, 0, AVATAR_SIZE);

    const daisy = flora.hero(
      scene,
      flora.daisyGeometry,
      flora.materials.plant,
      -2,
      -5,
      2.4,
    );
    world.talkers.push({
      object: daisy,
      range: 5,
      name: '雏菊',
      lines: [
        ['你说我是野花。可在我这里，你才是过客。', '原创 · 万物之间'],
        ['朝向太阳，并不是为了被谁看见。', '原创 · 万物之间'],
      ],
    });
    const stone = rock(scene, 3, -6, 1.5, microHeight);
    world.talkers.push({
      object: stone,
      range: 5,
      name: '石头',
      lines: [
        ['你的一生很长。也许，只是我的一个清晨。', '原创 · 万物之间'],
        [
          '大小不在事物之中，也在你的目光之中。',
          '受《庄子·秋水》启发 · 原创改写',
        ],
      ],
    });

    for (let i = 0; i < 22; i++) {
      const angle = i * 2.399,
        distance = 2.5 + Math.sqrt(i) * 2.5;
      const species = grassSpecies[i % grassSpecies.length];
      const object = flora.tuft(
        scene,
        species.form,
        species.id,
        Math.sin(angle) * distance,
        Math.cos(angle) * distance,
        rand(0.8, 1.1),
      );
      world.recruitables.push({
        object,
        joined: false,
        phase: rand(0, 6),
        species,
      });
    }

    const fauna = createFauna({ ...tools, ...flora }, scene);
    world.talkers.push(...fauna.talkers);

    // A tall blade leaning into the starting view, with a large drop at its tip.
    const heroBlade = flora.hero(
      scene,
      flora.broadBlade,
      flora.materials.blade,
      1.25,
      2.1,
      2.3,
      -0.5,
    );
    heroBlade.updateMatrix();
    const heroRecord = {
      x: 1.25,
      z: 2.1,
      rotation: -0.5,
      scaleX: 2.3,
      scaleZ: 2.3,
      matrix: heroBlade.matrix,
      curve: flora.broadBlade.userData.curve,
    };
    const heroDropPosition = new THREE.Vector3(
      0,
      0.985,
      0.985 * 0.985 * heroRecord.curve + 0.012,
    ).applyMatrix4(heroRecord.matrix);
    heroDropPosition.y -= 0.085;
    const refraction = flora.captureRefraction(
      scene,
      new THREE.Vector3(0.8, 0.8, 1.6),
    );
    flora.buildDew(scene, blades, refraction, [
      {
        blade: heroRecord,
        along: 0.985,
        radius: 0.075,
        hanging: true,
        position: heroDropPosition,
      },
    ]);
    const heroDrop = new THREE.Object3D();
    heroDrop.position.copy(heroDropPosition);
    scene.add(heroDrop);
    world.talkers.push({
      object: heroDrop,
      range: 2.4,
      name: '露珠',
      lines: [
        ['我映着整片天空，可我只有一滴那么大。', '原创 · 万物之间'],
        [
          '太阳再升高一点，我就要走了。别难过，我会变成云，再回来。',
          '原创 · 万物之间',
        ],
      ],
    });

    const sparkles = flora.sparkleField(700, 16);
    scene.add(sparkles);
    const rain = rainStreaks();
    scene.add(rain);
    const motes = lifeMotes(world.avatar);
    world.particles = particles(scene, 120, 28, '#fff2c4', 0.03, 4);

    const environment = createGrassEnvironment();
    world.environment = environment;
    world.weatherEvent = null;
    const avatarPoint = new THREE.Vector3();
    // Called by the main loop while this layer is active.
    world.update = (dt, time, reduced) => {
      const changed = environment.step(dt);
      if (changed) world.weatherEvent = changed;
      const state = environment.state;
      const overcast = 1 - state.sun;
      const wetness = Math.min(1, Math.max(0, (state.moisture - 0.35) / 0.55));
      flora.swayUniforms.uWind.value = state.wind;
      flora.swayUniforms.uBacklight.value = 0.2 + state.sun * 0.8;
      sunlight.intensity = 0.7 + state.sun * 2.9;
      hemisphere.intensity = 1.25 + state.sun * 0.55;
      skyUniforms.top.value.copy(CLEAR_SKY.top).lerp(GREY_SKY.top, overcast);
      skyUniforms.bottom.value
        .copy(CLEAR_SKY.bottom)
        .lerp(GREY_SKY.bottom, overcast);
      skyUniforms.haze.value = 0.35 * state.sun;
      skyUniforms.sunColor.value
        .copy(SUN_DISC)
        .multiplyScalar(0.2 + 0.8 * state.sun);
      scene.fog.color.copy(CLEAR_FOG).lerp(GREY_FOG, overcast);
      scene.fog.density = 0.017 + state.rain * 0.01;
      for (const material of hillMaterials)
        material.color.copy(WHITE).lerp(GREY_HILLS, overcast * 0.7);
      soil.color.copy(WHITE).lerp(WET_SOIL, wetness);
      soil.roughness = 1 - wetness * 0.45;
      sparkles.material.uniforms.uStrength.value =
        0.2 + wetness * 0.8 + state.sun * 0.25;
      rain.visible = !reduced && state.rain > 0.02;
      rain.material.uniforms.uRain.value = state.rain;
      motes.uniforms.uStrength.value =
        state.photosynthesis * (world.moving ? 0.3 : 0.85);
      world.avatar.scale.setScalar(
        (AVATAR_SIZE * heightCm(state)) / BASE_HEIGHT_CM,
      );
      avatarPoint.set(
        world.position.x,
        microHeight(world.position.x, world.position.z),
        world.position.z,
      );
      sunlight.position.copy(SUN_DIRECTION).multiplyScalar(90).add(avatarPoint);
      sunlight.target.position.copy(avatarPoint);
      rain.position.copy(avatarPoint);
      fauna.update(time, dt, { wetness, reduced });
    };
    return world;
  }

  return makeMicroScene();
}
