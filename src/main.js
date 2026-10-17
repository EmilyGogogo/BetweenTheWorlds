import * as THREE from '../vendor/three.module.js';
import { descriptions } from './content/worlds.js';
import { createWorldFactory } from './worlds/index.js';
import {
  updateActionContext,
  performPrimaryAction,
  primaryActionLabel,
  renderPrimaryAction,
} from './core/world-actions.js';
import {
  createMovementInput,
  createMovementStepper,
} from './core/world-movement.js';

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
const movementInput = createMovementInput();
const keys = movementInput.keys;
const stepMovement = createMovementStepper();

const v = new THREE.Vector3(),
  target = new THREE.Vector3(),
  desired = new THREE.Vector3();
let active = 0,
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
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const actionContext = {
  dt: 0,
  canInteract: false,
  canSimulate: false,
  reducedMotion: reduced,
};
const { builders, rand, microHeight, groundHeight, windUniform } =
  createWorldFactory(renderer);

function getWorld(index) {
  if (!worlds[index]) worlds[index] = builders[index]();
  return worlds[index];
}
function updateUI() {
  const d = descriptions[active];
  $('world-name').textContent = d.name;
  $('chapter').textContent = d.chapter;
  $('world-description').textContent = d.description;
  $('scale-value').textContent = d.scale;
  document.body.dataset.world = active;
  document.querySelectorAll('[data-world]').forEach((b) => {
    const on = +b.dataset.world === active;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  $('companions').classList.toggle('hidden', active !== 0);
  $('companion-count').textContent = getWorld(0).followers.length;
}
async function switchWorld(index) {
  if (index === active || switching || !started) return;
  switching = true;
  keys.clear();
  $('encounter').classList.remove('visible');
  $('invite').classList.add('hidden');
  $('veil').classList.add('covered');
  await new Promise((r) => setTimeout(r, reduced ? 20 : 480));
  try {
    getWorld(index);
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
    d = descriptions[active],
    p = w.position;
  const h =
    active === 0
      ? microHeight(p.x, p.z)
      : active === 1
        ? groundHeight(p.x, p.z)
        : 0;
  w.avatar.position.set(p.x, h, p.z);
  target.set(p.x, h + d.height, p.z);
  const distance = d.distance * zoom;
  desired.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    target.y + Math.sin(pitch) * distance,
    target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  if (active < 2) {
    const ground = active === 0 ? microHeight : groundHeight;
    desired.y = Math.max(
      desired.y,
      ground(desired.x, desired.z) + (active === 0 ? 0.22 : 0.5),
    );
  }
  camera.near = active === 0 ? 0.025 : 0.1;
  camera.far = 3500;
  camera.updateProjectionMatrix();
  if (immediate) camera.position.copy(desired);
  else camera.position.lerp(desired, 0.085);
  camera.lookAt(target);
  if (w.sky) w.sky.position.copy(camera.position);
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  toastUntil = time + 4;
}
function say(talker) {
  const line = talker.lines[Math.floor(rand(0, talker.lines.length))];
  $('speaker').textContent = talker.name + ' · 低语';
  $('thought').textContent = line[0];
  $('thought-source').textContent = line[1];
  $('encounter').classList.add('visible');
  lastTalk = time;
  talkUntil = time + 8.5;
}
function recruit() {
  refreshPrimaryAction();
  const w = getWorld(0);
  if (active !== 0 || !nearGrass || !started || switching) return;
  if (w.followers.length >= 12) {
    toast('已经有 12 位同行者。');
    return;
  }
  nearGrass.joined = true;
  w.followers.push(nearGrass);
  $('companion-count').textContent = w.followers.length;
  toast(
    w.followers.length === 1
      ? '现在，风有了两个方向。'
      : `${w.followers.length} 株草，与你一起经过世界。`,
  );
  nearGrass = null;
  refreshPrimaryAction();
}
function encounter() {
  if (!started || switching) return;
  const w = getWorld(active);
  if (time - lastTalk > 19) {
    const candidates = w.talkers.filter((t) => {
      t.object.getWorldPosition(v);
      return v.distanceTo(w.avatar.position) < t.range;
    });
    if (candidates.length)
      say(candidates[Math.floor(rand(0, candidates.length))]);
  }
}
function refreshActionContext(dt = 0) {
  updateActionContext(
    actionContext,
    started,
    switching,
    !$('help-panel').classList.contains('hidden'),
    dt,
  );
  movementInput.refresh(
    actionContext,
    descriptions[active].limit,
    getWorld(active),
  );
  actionContext.stepId = frame;
}
function refreshPrimaryAction() {
  refreshActionContext();
  const w = getWorld(active);
  nearGrass = null;
  if (actionContext.canInteract && active === 0 && w.followers.length < 12) {
    let closest = 3;
    for (const p of w.recruitables) {
      if (p.joined) continue;
      const dist = p.object.position.distanceTo(w.avatar.position);
      if (dist < closest) {
        nearGrass = p;
        closest = dist;
      }
    }
  }
  renderPrimaryAction(
    $('invite'),
    $('invite-label'),
    primaryActionLabel(active, w, actionContext, nearGrass),
  );
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
  toggleAudio();
  toast('按住鼠标拖动观察，W A S D 自由移动。');
};
$('sound').onclick = toggleAudio;
$('help').onclick = () => {
  keys.clear();
  $('help-panel').classList.remove('hidden');
  refreshPrimaryAction();
  $('close-help').focus();
};
function closeHelp() {
  $('help-panel').classList.add('hidden');
  refreshPrimaryAction();
  $('help').focus();
}
$('close-help').onclick = closeHelp;
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    closeHelp();
    return;
  }
  if (!started || !$('help-panel').classList.contains('hidden')) return;
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
  movementInput.keydown(e.code, getWorld(active));
  if (e.code.startsWith('Digit') && +e.key >= 1 && +e.key <= 4)
    switchWorld(+e.key - 1);
  if (e.code === 'KeyE') {
    refreshActionContext();
    const feedback = performPrimaryAction({
      active,
      world: getWorld(active),
      context: actionContext,
      repeat: e.repeat,
      recruit,
    });
    if (feedback) toast(feedback);
    refreshPrimaryAction();
  }
});
addEventListener('keyup', (e) => movementInput.keyup(e.code));
addEventListener('blur', () => {
  movementInput.blur(getWorld(active));
  drag = null;
});
canvas.addEventListener('pointerdown', (e) => {
  if (!started || switching) return;
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  yaw -= (e.clientX - drag.x) * 0.005;
  pitch = Math.max(0.04, Math.min(1.15, pitch + (e.clientY - drag.y) * 0.004));
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
    if (!started) return;
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
    d = descriptions[active];
  refreshActionContext(dt);
  const movement = stepMovement(w, d, yaw, keys, actionContext);
  const moving = movement.moving;
  if (moving && active < 2) {
    const angle = Math.atan2(-movement.directionX, -movement.directionZ);
    let delta = angle - w.avatar.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    w.avatar.rotation.y += delta * 0.14;
  }
  w.update?.(actionContext);
  movementInput.finishStep(w);
  if (active === 0) {
    w.avatar.rotation.z =
      Math.sin(time * 1.6) * 0.035 + (moving ? Math.sin(time * 8) * 0.04 : 0);
    w.followers.forEach((p, i) => {
      const angle = i * 2.399,
        rad = 1.2 + Math.sqrt(i) * 0.64;
      const tx = w.position.x + Math.sin(angle) * rad,
        tz = w.position.z + Math.cos(angle) * rad;
      p.object.position.x += (tx - p.object.position.x) * Math.min(1, dt * 2);
      p.object.position.z += (tz - p.object.position.z) * Math.min(1, dt * 2);
      p.object.position.y = microHeight(
        p.object.position.x,
        p.object.position.z,
      );
      p.object.rotation.z = Math.sin(time * 1.7 + p.phase) * 0.08;
    });
    w.recruitables.forEach((p) => {
      if (!p.joined)
        p.object.rotation.z = Math.sin(time * 1.5 + p.phase) * 0.05;
    });
  }
  if (active === 1) {
    w.avatar.userData.limbs.forEach((limb, i) => {
      limb.rotation.x = moving
        ? Math.sin(time * 8 + (i < 2 ? 0 : Math.PI)) * 0.48
        : Math.sin(time * 1.2) * 0.02;
    });
    if (w.sun) {
      w.sun.position.set(w.position.x - 60, 58, w.position.z - 75);
      w.sun.target.position.copy(w.avatar.position);
    }
  }
  if (active === 2) {
    w.avatar.rotation.y += dt * 0.008;
    w.avatar.rotation.z = reduced ? 0 : Math.sin(time * 0.24) * 0.003;
  }
  if (w.particles && !reduced) w.particles.rotation.y = time * 0.003;
  placeCamera();
  refreshPrimaryAction();
  if (frame % 12 === 0) encounter();
  if (time > talkUntil) $('encounter').classList.remove('visible');
  if (time > toastUntil) $('toast').classList.remove('visible');
  renderer.render(w.scene, camera);
  if (frame % 30 === 0) {
    canvas.dataset.position = `${w.position.x.toFixed(2)},${w.position.z.toFixed(2)}`;
    canvas.dataset.followers = worlds[0].followers.length;
    canvas.dataset.drawcalls = renderer.info.render.calls;
  }
}
try {
  getWorld(0);
  updateUI();
  placeCamera(true);
  $('loading').classList.add('hidden');
  canvas.style.cursor = 'grab';
  animate();
} catch (e) {
  console.error(e);
  $('loading').textContent = '世界未能加载，请刷新或尝试其他电脑浏览器。';
}
