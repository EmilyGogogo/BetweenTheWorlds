import * as THREE from '../vendor/three.module.js';
import { feelingTopics, weatherArrivals } from './content/grass-feelings.js';
import { descriptions } from './content/worlds.js';
import { chooseFeeling } from './core/feelings.js';
import { heightCm } from './core/grass-environment.js';
import { createWorldFactory } from './worlds/index.js';
import { createFieldwork } from './fieldwork.js';
import { prepareEntities, inhabit, findSoulTarget } from './core/embodiment.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
} catch {
  $('loading').textContent =
    '这台设备暂时无法开启 WebGL。请用支持硬件加速的电脑浏览器重试。';
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(
  52,
  innerWidth / innerHeight,
  0.03,
  4000,
);
const clock = new THREE.Clock();
const worlds = [];
const keys = new Set();

const v = new THREE.Vector3(),
  target = new THREE.Vector3(),
  desired = new THREE.Vector3(),
  lookTarget = new THREE.Vector3(),
  projectedSoul = new THREE.Vector3(),
  viewDirection = new THREE.Vector3();
const ripple = $('soul-ripple');
let soulTarget = null,
  soulReadyAt = 0;
const solarPortal = { name: '太阳', portal: 3, solar: true };
function clearSoulTarget() {
  soulTarget = null;
  ripple.classList.add('hidden');
  delete canvas.dataset.soulTarget;
}
let active =
    new URLSearchParams(location.search).get('world') === 'island' ? 2 : 0,
  started = false,
  switching = false,
  yaw = 0.22,
  pitch = 0.34,
  zoom = 1,
  time = 0,
  frame = 0,
  drag = null,
  nearGrass = null;
let lastTalk = -30,
  talkUntil = -1,
  toastUntil = 0;
// The grass layer's spoken sensations, shown in a bubble above the speaker.
const FEELING_SECONDS = 7.5;
const feelingBox = $('feeling');
const feelingPoint = new THREE.Vector3();
const recentFeelings = [];
let feeling = null,
  nextFeeling = 0,
  lastSelfFeeling = -10;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const { builders, rand, microHeight, groundHeight, windUniform } =
  createWorldFactory(renderer);

function getWorld(index) {
  if (!worlds[index]) {
    worlds[index] = builders[index]();
    prepareEntities(
      worlds[index],
      index === 0 ? microHeight : index === 1 ? groundHeight : () => 0,
    );
  }
  return worlds[index];
}
const fieldwork = createFieldwork({
  getWorld: () => getWorld(1),
  camera,
  canvas,
  toast,
  clearInput: () => {
    keys.clear();
    drag = null;
  },
  reduced,
  limit: descriptions[1].limit,
});
const sneaking = () => keys.has('ShiftLeft') || keys.has('ShiftRight');
function updateUI() {
  const d = descriptions[active];
  const world = getWorld(active);
  const entity = world.controlled;
  $('world-name').textContent = entity.name;
  $('chapter').textContent = d.chapter;
  $('world-description').textContent = d.description;
  $('scale-value').textContent = entity.scale;
  document.body.dataset.world = active;
  document.querySelectorAll('[data-world]').forEach((b) => {
    const on = +b.dataset.world === active;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  $('companions').classList.toggle('hidden', active !== 0 && active !== 2);
  $('senses').classList.toggle(
    'hidden',
    active !== 0 || !started || entity.kind !== 'grass',
  );
  $('companion-count').textContent = world.followers.length;
  fieldwork.setVisible(active === 1 && entity.kind === 'human');
  if (active === 0) updateSenses();
}
function setMeter(id, value) {
  const percent = Math.round(value * 100);
  $(id).style.setProperty('--level', `${percent}%`);
  $(id).setAttribute('aria-valuenow', percent);
}
function updateSenses() {
  const env = getWorld(0).environment.state;
  $('sense-weather').textContent = env.label;
  $('sense-warmth').textContent = `${Math.round(env.temperature)}°C`;
  setMeter('meter-sun', env.sun);
  setMeter('meter-water', env.moisture);
  setMeter('meter-photo', env.photosynthesis);
  $('sense-height').textContent = `${heightCm(env).toFixed(1)} 厘米`;
}
async function switchWorld(index) {
  if (index === active || switching || !started) return;
  clearSoulTarget();
  switching = true;
  keys.clear();
  hideFeeling();
  $('encounter').classList.remove('visible');
  $('invite').classList.add('hidden');
  $('veil').classList.add('covered');
  await new Promise((r) => setTimeout(r, reduced ? 20 : 480));
  try {
    const w = getWorld(index);
    if (w.avatarReady && !w.avatarNotified) {
      w.avatarNotified = true;
      w.avatarReady.then((ok) => {
        if (!ok) toast('人物模型未能加载，场景仍可探索。');
      });
    }
    active = index;
    zoom = 1;
    pitch = index === 2 ? 0.39 : index === 3 ? 0.13 : 0.34;
    yaw = 0.22;
    lastTalk = time;
    talkUntil = -1;
    nearGrass = null;
    updateUI();
    placeCamera(true);
    if (audio) updateAudio();
  } catch (e) {
    toast('场景暂时无法加载，请刷新重试。');
    console.error(e);
  }
  await new Promise((r) => setTimeout(r, 70));
  $('veil').classList.remove('covered');
  switching = false;
}
function placeCamera(immediate = false) {
  const w = getWorld(active),
    d = w.controlled,
    p = w.position;
  if (d.ground) p.y = d.ground(p.x, p.z);
  if (
    active === 1 &&
    d.kind === 'human' &&
    fieldwork.placeCamera(w, yaw, zoom, immediate)
  ) {
    if (w.sky) w.sky.position.copy(camera.position);
    return;
  }
  target.set(p.x, p.y + d.height, p.z);
  const distance = d.distance * zoom;
  desired.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    target.y + Math.max(0.04, Math.sin(pitch)) * distance,
    target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  if (d.ground || d.mode === 'fly') {
    const ground =
      active === 0
        ? microHeight
        : active === 1
          ? groundHeight
          : w.coastHeight || (() => 0);
    desired.y = Math.max(
      desired.y,
      ground(desired.x, desired.z) + (active === 0 ? 0.22 : 0.5),
    );
  }
  // Looking up moves the gaze rather than pushing the camera into the ground.
  if (pitch < 0) target.y += -Math.sin(pitch) * distance * 1.8;
  camera.near = active === 0 ? 0.025 : 0.1;
  camera.far = 3500;
  camera.fov = 52;
  camera.updateProjectionMatrix();
  if (immediate) camera.position.copy(desired);
  else camera.position.lerp(desired, 0.085);
  if (immediate) lookTarget.copy(target);
  else lookTarget.lerp(target, reduced ? 1 : 0.1);
  camera.lookAt(lookTarget);
  camera.updateMatrixWorld();
  if (w.sky) w.sky.position.copy(camera.position);
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  toastUntil = time + 4;
}
function say(talker) {
  hideFeeling();
  const line = talker.lines[Math.floor(rand(0, talker.lines.length))];
  $('speaker').textContent = talker.name + ' · 低语';
  $('thought').textContent = line[0];
  $('thought-source').textContent = line[1];
  $('encounter').classList.add('visible');
  lastTalk = time;
  talkUntil = time + 8.5;
}
function recruit() {
  const w = getWorld(active);
  if (!nearGrass || !started || switching || !canPlay()) return;
  if (w.followers.length >= 12) {
    toast('已经有 12 位同行者。');
    return;
  }
  nearGrass.joined = true;
  w.followers.push(nearGrass);
  w.followLeader = w.controlled;
  updateUI();
  toast(`${w.followers.length} 位同行者，与你一起经过世界。`);
  nearGrass = null;
  $('invite').classList.add('hidden');
}
function canPlay() {
  return (
    $('help-panel').classList.contains('hidden') && !fieldwork.isBlocking()
  );
}
function projectEntity(entity) {
  entity.object.getWorldPosition(projectedSoul);
  projectedSoul.y += entity.focusHeight ?? entity.height;
  // A submerged animal is signalled at the water surface when seen from above.
  if (active === 2 && entity.kind === 'fish' && camera.position.y > 0)
    projectedSoul.y = 1;
  return projectedSoul.project(camera);
}
function updateSoulTarget() {
  if (!started || switching || !canPlay() || time < soulReadyAt) {
    clearSoulTarget();
    return;
  }
  const world = getWorld(active);
  let candidate = findSoulTarget(world, projectEntity, soulTarget);
  if (world.sky && world.controlled.mode !== 'swim') {
    camera.getWorldDirection(viewDirection);
    const sunDirection = world.sky.material.uniforms.sunDir.value;
    if (viewDirection.dot(sunDirection) > 0.982) candidate = solarPortal;
  }
  if (!candidate) {
    clearSoulTarget();
    return;
  }
  if (candidate.solar) {
    projectedSoul
      .copy(world.sky.material.uniforms.sunDir.value)
      .multiplyScalar(1000)
      .add(camera.position)
      .project(camera);
  } else projectEntity(candidate);
  soulTarget = candidate;
  ripple.style.left = `${(projectedSoul.x * 0.5 + 0.5) * innerWidth}px`;
  ripple.style.top = `${(-projectedSoul.y * 0.5 + 0.5) * innerHeight}px`;
  ripple.setAttribute('aria-label', `魂穿：${candidate.name}`);
  ripple.style.color = candidate.solar ? '#354648' : '';
  ripple.classList.remove('hidden');
  canvas.dataset.soulTarget = candidate.name;
}
function become(entity) {
  const world = getWorld(active);
  const previous = world.avatar;
  if (!inhabit(world, entity)) return;
  previous.visible = true;
  clearSoulTarget();
  keys.clear();
  drag = null;
  nearGrass = null;
  hideFeeling();
  $('invite').classList.add('hidden');
  zoom = 1;
  pitch = entity.mode === 'swim' ? 0.12 : 0.32;
  $('encounter').classList.remove('visible');
  lastTalk = time;
  soulReadyAt = time + 1.2;
  document.body.classList.add('soul-shift');
  setTimeout(
    () => document.body.classList.remove('soul-shift'),
    reduced ? 0 : 800,
  );
  updateUI();
  canvas.focus({ preventScroll: true });
}
async function possessNearby() {
  if (!started || switching || !canPlay() || time < soulReadyAt) return;
  updateSoulTarget();
  const entity = soulTarget;
  if (!entity) return;
  if (entity.portal !== undefined) {
    await switchWorld(entity.portal);
    if (entity.solar && active === 3)
      become(getWorld(3).entities.find((entry) => entry.kind === 'sun'));
    else if (active === entity.portal) become(getWorld(active).original);
  } else become(entity);
}
ripple.onclick = possessNearby;

function encounter() {
  if (!started || switching || !canPlay()) return;
  const w = getWorld(active);
  if (time - lastTalk > 19) {
    const candidates = w.talkers.filter((t) => {
      t.object.getWorldPosition(v);
      return t.object !== w.avatar && v.distanceTo(w.avatar.position) < t.range;
    });
    if (candidates.length)
      say(candidates[Math.floor(rand(0, candidates.length))]);
  }
  nearGrass = null;
  if (
    ['grass', 'island'].includes(w.controlled.kind) &&
    w.followers.length < 12
  ) {
    let closest = active === 2 ? 110 : 3;
    for (const p of w.recruitables) {
      if (p.joined || p.object === w.avatar) continue;
      const dist = p.object.position.distanceTo(w.avatar.position);
      if (dist < closest) {
        nearGrass = p;
        closest = dist;
      }
    }
  }
  $('invite').classList.toggle('hidden', !nearGrass);
  $('invite-label').textContent =
    active === 2 ? '邀请这座岛一起漂流' : '邀请这株草一起走';
  if (active === 0 && w.controlled.kind === 'grass') senseFeelings(w);
}

function feelFor(species = null) {
  const w = getWorld(0);
  return chooseFeeling(w.environment.state, {
    topics: feelingTopics,
    species,
    followers: w.followers.length,
    recent: recentFeelings,
    random: () => rand(0, 1),
  });
}
function showFeeling(target, speaker, choice, lift) {
  $('feeling-speaker').textContent = speaker;
  $('feeling-text').textContent = choice.text;
  $('feeling-source').textContent = choice.source;
  feelingBox.classList.add('visible');
  feeling = { target, lift, until: time + FEELING_SECONDS };
  recentFeelings.push(choice.key);
  if (recentFeelings.length > 8) recentFeelings.shift();
  nextFeeling = time + rand(22, 34);
  positionFeeling();
}
function hideFeeling() {
  feeling = null;
  feelingBox.classList.remove('visible');
}
function feelSelf(speaker = '你 · 此刻的感受', choice = feelFor()) {
  const avatar = getWorld(0).avatar;
  lastSelfFeeling = time;
  showFeeling(avatar, speaker, choice, 1.15 * avatar.scale.y);
}
function feelPlant(plant, role) {
  showFeeling(
    plant.object,
    `${plant.species.name} · ${role}`,
    feelFor(plant.species),
    1.25 * plant.object.scale.y,
  );
}
function listenToSelf() {
  if (
    active !== 0 ||
    !started ||
    switching ||
    !canPlay() ||
    getWorld(0).controlled.kind !== 'grass'
  )
    return;
  if (time - lastSelfFeeling < 2.5) return;
  feelSelf();
}
// Priority: a weather change, then a newly met plant, then an idle thought
// from you or one of your companions. The encounter panel always goes first.
function senseFeelings(w) {
  if (!started || switching || time < talkUntil) return;
  if (w.weatherEvent) {
    const lines = weatherArrivals[w.weatherEvent];
    w.weatherEvent = null;
    const [text, source] = lines[Math.floor(rand(0, lines.length))];
    feelSelf(`你 · ${w.environment.state.label}`, { text, source, key: text });
    return;
  }
  if (feeling) return;
  if (nearGrass && time - (nearGrass.lastFelt ?? -Infinity) > 40) {
    nearGrass.lastFelt = time;
    feelPlant(nearGrass, '它的感受');
    return;
  }
  if (time < nextFeeling) return;
  if (w.followers.length && rand(0, 1) < 0.4)
    feelPlant(w.followers[Math.floor(rand(0, w.followers.length))], '同行者');
  else feelSelf();
}
function positionFeeling() {
  if (!feeling) return;
  camera.updateMatrixWorld();
  feeling.target.getWorldPosition(feelingPoint);
  feelingPoint.y += feeling.lift;
  feelingPoint.project(camera);
  const offscreen =
    feelingPoint.z > 1 ||
    Math.abs(feelingPoint.x) > 1.1 ||
    Math.abs(feelingPoint.y) > 1.1;
  feelingBox.classList.toggle('offscreen', offscreen);
  if (offscreen) return;
  const x = Math.min(
    innerWidth - 150,
    Math.max(150, (feelingPoint.x * 0.5 + 0.5) * innerWidth),
  );
  const y = Math.min(
    innerHeight - 200,
    Math.max(
      feelingBox.offsetHeight + 150,
      (-feelingPoint.y * 0.5 + 0.5) * innerHeight,
    ),
  );
  feelingBox.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
}

let audio = null;
function updateAudio() {
  if (!audio) return;
  const { ctx, gain, filter } = audio;
  gain.gain.setTargetAtTime(active === 3 ? 0.055 : 0.095, ctx.currentTime, 1);
  filter.frequency.setTargetAtTime(
    [900, 650, 1550, 280][active],
    ctx.currentTime,
    2,
  );
}
async function toggleAudio() {
  try {
    if (!audio) {
      const ctx = new AudioContext(),
        gain = ctx.createGain(),
        filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.25;
      filter.connect(gain);
      gain.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate),
        data = buffer.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        brown = (brown + Math.random() * 0.04 - 0.02) / 1.02;
        data[i] = brown * 3;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(filter);
      source.start();
      const tones = new AudioNodeGroup(ctx, gain);
      audio = { ctx, gain, filter, enabled: true, tones };
      updateAudio();
    } else {
      audio.enabled = !audio.enabled;
      if (audio.enabled) await audio.ctx.resume();
      else await audio.ctx.suspend();
    }
    $('sound').textContent = audio.enabled ? '声音 开' : '声音 关';
    $('sound').setAttribute(
      'aria-label',
      audio.enabled ? '关闭环境声' : '开启环境声',
    );
  } catch {
    toast('浏览器未能开启声音，仍可继续探索。');
  }
}
class AudioNodeGroup {
  constructor(ctx, out) {
    for (const [i, f] of [110, 164.81, 220, 293.66].entries()) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.value = 0.035 / (i + 1);
      o.connect(g);
      g.connect(out);
      o.start();
      const lfo = ctx.createOscillator(),
        lg = ctx.createGain();
      lfo.frequency.value = 0.035 + i * 0.017;
      lg.gain.value = 0.012 / (i + 1);
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start();
    }
  }
}

document
  .querySelectorAll('[data-world]')
  .forEach((b) =>
    b.addEventListener('click', () => switchWorld(+b.dataset.world)),
  );
$('begin').onclick = () => {
  started = true;
  $('welcome').style.opacity = '0';
  $('welcome').style.pointerEvents = 'none';
  setTimeout(() => $('welcome').classList.add('hidden'), 1000);
  lastTalk = time - 12;
  nextFeeling = time + 14;
  updateUI();
  toggleAudio();
  canvas.focus({ preventScroll: true });
};
$('sound').onclick = toggleAudio;
$('help').onclick = () => {
  clearSoulTarget();
  keys.clear();
  $('help-panel').classList.remove('hidden');
  $('close-help').focus();
};
function closeHelp() {
  $('help-panel').classList.add('hidden');
  $('help').focus();
}
$('close-help').onclick = closeHelp;
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (!fieldwork.closePanel()) closeHelp();
    return;
  }
  if (!started || !$('help-panel').classList.contains('hidden')) return;
  // 人物面板打开时，方向键与空格交给面板里的按钮。
  if (fieldwork.isBlocking()) {
    if (e.code === 'KeyC' && !e.repeat) fieldwork.closePanel();
    return;
  }
  if (e.code === 'KeyR' && !e.repeat) {
    e.preventDefault();
    possessNearby();
    return;
  }
  if (!canPlay()) return;
  if (
    [
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
    ].includes(e.code)
  )
    e.preventDefault();
  keys.add(e.code);
  if (e.code.startsWith('Digit') && +e.key >= 1 && +e.key <= 4)
    switchWorld(+e.key - 1);
  if (e.code === 'KeyE' && !e.repeat) recruit();
  if (
    active === 1 &&
    getWorld(1).controlled.kind === 'human' &&
    !switching &&
    !e.repeat
  )
    fieldwork.handleKey(e.code, yaw);
  if (e.code === 'KeyF' && !e.repeat) listenToSelf();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  drag = null;
});
canvas.addEventListener('pointerdown', (e) => {
  if (!started || switching || !canPlay()) return;
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  yaw -= (e.clientX - drag.x) * 0.005;
  const dy = e.clientY - drag.y;
  if (!(
    active === 1 &&
    getWorld(1).controlled.kind === 'human' &&
    fieldwork.lookVertical(dy)
  ))
    pitch = Math.max(-0.9, Math.min(1.15, pitch + dy * 0.004));
  drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => {
  drag = null;
  canvas.style.cursor = 'grab';
});
canvas.addEventListener('pointercancel', () => {
  drag = null;
});
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!started || switching || !canPlay()) return;
    e.preventDefault();
    zoom = Math.max(0.55, Math.min(2.4, zoom + e.deltaY * 0.001));
  },
  { passive: false },
);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  frame++;
  windUniform.value = reduced ? 0 : time;
  const w = getWorld(active),
    d = w.controlled;
  let dx = 0,
    dz = 0;
  if (started && !switching && canPlay()) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  }
  if (started && !switching && canPlay() && d.mode) {
    const vertical =
      (keys.has('Space') ? 1 : 0) -
      (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0);
    w.position.y += vertical * d.speed * 0.55 * dt;
    if (d.mode === 'fly')
      w.position.y = THREE.MathUtils.clamp(
        w.position.y,
        Math.max(4, w.coastHeight(w.position.x, w.position.z) + 3),
        160,
      );
    if (d.mode === 'swim')
      w.position.y = THREE.MathUtils.clamp(
        w.position.y,
        w.seabedHeight(w.position.x, w.position.z) + 1.3,
        -0.8,
      );
  }
  const moving = dx !== 0 || dz !== 0;
  w.moving = moving ? 1 : 0;
  if (moving) {
    const len = Math.hypot(dx, dz),
      x = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / len,
      z = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) / len;
    const speed =
      d.speed *
      (active === 1 && d.kind === 'human'
        ? fieldwork.speedScale(sneaking())
        : 1);
    w.position.x += x * speed * dt;
    w.position.z += z * speed * dt;
    const dist = Math.hypot(w.position.x, w.position.z);
    if (dist > d.limit) {
      w.position.x *= d.limit / dist;
      w.position.z *= d.limit / dist;
    }
    if (
      d.mode === 'swim' &&
      w.seabedHeight(w.position.x, w.position.z) > -2.5
    ) {
      w.position.x -= x * d.speed * dt;
      w.position.z -= z * d.speed * dt;
    }
    if (active < 2 || d.mode) {
      const angle = Math.atan2(-x, -z);
      let delta = angle - w.avatar.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      w.avatar.rotation.y += delta * 0.14;
    }
  }
  if (d.kind === 'grass' || d.kind === 'flower') {
    w.avatar.rotation.z = reduced
      ? 0
      : Math.sin(time * 1.6) * 0.035 + (moving ? Math.sin(time * 8) * 0.04 : 0);
  }
  if (active === 0 || active === 2) {
    const leader = w.followLeader.object.position;
    w.followers.forEach((p, i) => {
      const angle = i * 2.399,
        radius =
          active === 2 ? 100 + Math.sqrt(i) * 65 : 1.2 + Math.sqrt(i) * 0.64;
      const tx = leader.x + Math.sin(angle) * radius,
        tz = leader.z + Math.cos(angle) * radius;
      p.object.position.x +=
        (tx - p.object.position.x) *
        Math.min(1, dt * (active === 2 ? 0.45 : 2));
      p.object.position.z +=
        (tz - p.object.position.z) *
        Math.min(1, dt * (active === 2 ? 0.45 : 2));
      p.object.position.y = p.entity.ground(
        p.object.position.x,
        p.object.position.z,
      );
      if (active === 0)
        p.object.rotation.z = reduced
          ? 0
          : Math.sin(time * 1.7 + p.phase) * 0.08;
    });
  }
  if (d.kind === 'human') {
    const body = w.avatar.userData.body;
    if (body) {
      // The glTF avatar has no skeleton; the other characters retain joint animation.
      body.position.y = reduced
        ? 0
        : moving
          ? Math.abs(Math.sin(time * 8)) * 0.05
          : Math.sin(time * 1.2) * 0.008;
      body.rotation.z = !reduced && moving ? Math.sin(time * 8) * 0.03 : 0;
      body.rotation.x +=
        ((moving && !reduced ? -0.07 : 0) - body.rotation.x) * 0.1;
    } else {
      w.avatar.userData.limbs.forEach((limb, index) => {
        limb.rotation.x = moving
          ? Math.sin(time * 8 + (index < 2 ? 0 : Math.PI)) * 0.48
          : reduced
            ? 0
            : Math.sin(time * 1.2) * 0.02;
      });
    }
  }
  if (active === 1 && w.sun) {
    w.sun.position.copy(w.avatar.position).add(w.sunOffset);
    w.sun.target.position.copy(w.avatar.position);
  }
  if (active === 1)
    fieldwork.update(dt, time, { moving, sneaking: sneaking(), yaw });
  if (active === 3 && !reduced) w.globe.rotation.y += dt * 0.018;
  if (w.particles && !reduced) w.particles.rotation.y = time * 0.003;
  if (w.update) w.update(dt, time, reduced);
  placeCamera();
  updateSoulTarget();
  if (frame % 12 === 0) encounter();
  if (feeling) {
    if (time > feeling.until) hideFeeling();
    else positionFeeling();
  }
  if (active === 0 && started && frame % 30 === 0) updateSenses();
  if (time > talkUntil) $('encounter').classList.remove('visible');
  if (time > toastUntil) $('toast').classList.remove('visible');
  renderer.render(w.scene, camera);
  // Keep loading state in sync with the rendered scene; throttled telemetry
  // can retain the previous world's status for another 30 frames.
  canvas.dataset.avatar = w.avatarState ?? 'built-in';
  if (frame % 30 === 0) {
    canvas.dataset.position = `${w.position.x.toFixed(2)},${w.position.z.toFixed(2)}`;
    canvas.dataset.followers = w.followers.length;
    canvas.dataset.entity = w.controlled.kind;
    canvas.dataset.altitude = w.position.y.toFixed(2);
    if (w.environment) canvas.dataset.weather = w.environment.state.weather;
    canvas.dataset.drawcalls = renderer.info.render.calls;
    if (w.weather) canvas.dataset.weather = w.weather;
  }
}
try {
  getWorld(active);
  updateUI();
  placeCamera(true);
  $('loading').classList.add('hidden');
  canvas.style.cursor = 'grab';
  animate();
} catch (e) {
  console.error(e);
  $('loading').textContent = '世界未能加载，请刷新或尝试其他电脑浏览器。';
}
