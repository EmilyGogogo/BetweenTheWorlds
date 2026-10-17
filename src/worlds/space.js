import * as THREE from '../../vendor/three.module.js';
import { createMoonCompanion } from './earth-moon.js';
import { createSunResponse, sunSettings } from './earth-sun.js';
import { installEarthActions } from './earth-actions.js';
import { createEarthBackground, createSpaceRocks } from './earth-background.js';
import {
  createEarthTextures,
  createMoonTextures,
  createSunTexture,
  createGasTexture,
  createRingTexture,
  setRingUV,
} from './earth-materials.js';
import { createEarthVisualUpdate } from './earth-visuals.js';
import {
  createRingedPlanet,
  ringedMovementLimits,
} from './earth-ringed-planet.js';

export function makeSpace(tools) {
  const { newWorld, mesh, mat } = tools;
  function atmosphere(
    parent,
    radius,
    color = '#84bcf5',
    opacity = 0.65,
    halo = false,
  ) {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        color: { value: new THREE.Color(color) },
        opacity: { value: opacity },
        edgePower: { value: halo ? 1.7 : 3.8 },
      },
      vertexShader:
        'varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader:
        'uniform vec3 color;uniform float opacity,edgePower;varying vec3 n,eye;void main(){float edge=pow(1.-abs(dot(normalize(n),normalize(eye))),edgePower);gl_FragColor=vec4(color,edge*opacity);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    });
    return mesh(new THREE.SphereGeometry(radius, 48, 32), m, parent);
  }
  function makeSpaceScene() {
    const w = newWorld(3),
      s = w.scene;
    s.background = new THREE.Color('#050914');
    const generationStart = performance.now();
    const surface = createEarthTextures();
    const lunar = createMoonTextures();
    const sunTexture = createSunTexture();
    const gasTexture = createGasTexture();
    const ringTexture = createRingTexture();
    s.fog = null;
    const sun = new THREE.DirectionalLight('#ffe1b6', 3.8);
    sun.position.set(-200, 100, 160);
    s.add(sun);
    s.add(new THREE.AmbientLight('#8e9bc4', 1.1));
    w.sun = sun;
    w.sky = createEarthBackground();
    s.add(w.sky);
    w.spaceRocks = createSpaceRocks();
    s.add(w.spaceRocks);
    w.avatar = new THREE.Group();
    s.add(w.avatar);
    w.globe = mesh(
      new THREE.SphereGeometry(23, 72, 48),
      mat('#ffffff', {
        map: surface.color,
        bumpMap: surface.data,
        roughnessMap: surface.data,
        bumpScale: 0.16,
        roughness: 1,
        metalness: 0,
      }),
      w.avatar,
    );
    w.globe.rotation.z = 0.15;
    w.clouds = mesh(
      new THREE.SphereGeometry(23.35, 64, 40),
      mat('#ffffff', {
        map: surface.clouds,
        transparent: true,
        opacity: 0.8,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      }),
      w.avatar,
    );
    w.clouds.name = 'earth-cloud-shell';
    w.clouds.rotation.z = w.globe.rotation.z;
    w.atmosphere = atmosphere(w.avatar, 24.1);
    const p = new THREE.Group();
    s.add(p);
    p.position.set(-150, 40, -230);
    p.rotation.z = 0.38;
    const gas = mesh(
      new THREE.SphereGeometry(49, 64, 40),
      mat('#ffffff', { map: gasTexture, roughness: 1, metalness: 0 }),
      p,
    );
    gas.rotation.z = 0.25;
    const ringGeo = new THREE.RingGeometry(66, 103, 160, 8);
    setRingUV(ringGeo);
    const ring = mesh(
      ringGeo,
      mat('#ffffff', {
        side: THREE.DoubleSide,
        map: ringTexture,
        transparent: true,
        opacity: 0.8,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      }),
      p,
    );
    ring.rotation.x = 1.14;
    const ringedTalker = {
      object: p,
      range: 290,
      name: '有环的星球',
      lines: [
        ['你用距离衡量遥远，用自己衡量一切。', '原创 · 万物之间'],
        ['我们并不独立。引力一直在无声地交谈。', '原创 · 万物之间'],
      ],
    };
    w.talkers.push(ringedTalker);
    const ringedActions = createRingedPlanet(w, p, gas, ring, ringedTalker);
    w.movementInfluenceLimits = ringedMovementLimits;
    const moon = mesh(
      new THREE.SphereGeometry(9, 64, 40),
      mat('#ffffff', {
        map: lunar.color,
        bumpMap: lunar.height,
        bumpScale: 0.35,
        roughness: 1,
        metalness: 0,
      }),
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
    const moonActions = createMoonCompanion(w, moon);
    const sunBody = new THREE.Group();
    sunBody.position.set(...sunSettings.position);
    s.add(sunBody);
    mesh(
      new THREE.SphereGeometry(sunSettings.radius, 40, 28),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        map: sunTexture,
        toneMapped: false,
      }),
      sunBody,
    );
    const halo = atmosphere(
      sunBody,
      sunSettings.haloRadius,
      '#ffd79d',
      0.28,
      true,
    );
    const sunActions = createSunResponse(w, sunBody, halo, {
      object: sunBody,
      range: sunSettings.talkRange,
      name: '太阳',
      lines: [
        ['光抵达你时，也照见了我们之间。', '原创 · 万物之间'],
        ['靠近不是占有。你可以带着温暖，继续远行。', '原创 · 万物之间'],
      ],
    });
    const visualUpdate = createEarthVisualUpdate(w);
    installEarthActions(w, moonActions, sunActions, ringedActions, {
      visualUpdate,
    });
    w.earthVisuals = {
      generationMs: performance.now() - generationStart,
      quality: 'standard',
      decorations: true,
    };
    return w;
  }

  return makeSpaceScene();
}
