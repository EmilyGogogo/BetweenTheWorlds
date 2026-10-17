import * as THREE from '../vendor/three.module.js';
import { feelingTopics, weatherArrivals } from './content/grass-feelings.js';
import { descriptions } from './content/worlds.js';
import {
  DIALOGUE_CHOICE_KEYS,
  dialogueChoice,
  dialogueNode,
  rollSameKindEncounter,
} from './core/encounters.js';
import { chooseFeeling } from './core/feelings.js';
import { heightCm } from './core/grass-environment.js';
import { createWorldFactory } from './worlds/index.js';

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
const sameKindPrompt = $('same-kind');
const dialogueBox = $('dialogue');
let dialogueState = null,
  dialogueReturnFocus = null;
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
  $('senses').classList.toggle('hidden', active !== 0 || !started);
  $('companion-count').textContent = getWorld(0).followers.length;
  updateSenses();
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
  switching = true;
  keys.clear();
  closeSameKindDialogue();
  sameKindPrompt.classList.add('hidden');
  hideFeeling();
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
    if (getWorld(index).sameKind) getWorld(index).sameKind.inRange = false;
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
  hideFeeling();
  const line = talker.lines[Math.floor(rand(0, talker.lines.length))];
  $('speaker').textContent = talker.name + ' · 低语';
  $('thought').textContent = line[0];
  $('thought-source').textContent = line[1];
  $('encounter').classList.add('visible');
  lastTalk = time;
  talkUntil = time + 8.5;
}
function sameKindInRange(npc, w) {
  npc.object.getWorldPosition(v);
  return v.distanceTo(w.avatar.position) <= npc.range;
}
function renderDialogueNode() {
  if (!dialogueState) return;
  const node = dialogueNode(dialogueState.npc, dialogueState.nodeId);
  if (!node) {
    closeSameKindDialogue();
    return;
  }
  $('dialogue-line').textContent = node.text;
  const choices = $('dialogue-choices');
  choices.replaceChildren();
  const options = node.end ? [] : (node.choices ?? []);
  options.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dialogue-choice';
    button.dataset.choice = DIALOGUE_CHOICE_KEYS[index];
    const key = document.createElement('kbd');
    key.textContent = DIALOGUE_CHOICE_KEYS[index];
    const text = document.createElement('span');
    text.textContent = choice.text;
    button.append(key, text);
    button.addEventListener('click', () => chooseDialogueResponse(index));
    choices.append(button);
  });
  $('dialogue-hint').textContent = options.length
    ? '按 A / B / C 回复 · Esc 离开'
    : '对话结束 · Esc 或 × 继续探索';
  const nextFocus = options.length
    ? choices.querySelector('button')
    : $('dialogue-close');
  nextFocus?.focus();
}
function openSameKindDialogue(npc) {
  if (!started || switching || dialogueState || !npc?.start) return;
  keys.clear();
  hideFeeling();
  $('encounter').classList.remove('visible');
  talkUntil = -1;
  $('invite').classList.add('hidden');
  sameKindPrompt.classList.add('hidden');
  dialogueReturnFocus = document.activeElement;
  dialogueState = { npc, nodeId: npc.start };
  $('dialogue-speaker').textContent = `${npc.name} · 同类`;
  $('dialogue-source').textContent = npc.source;
  $('dialogue-reply').textContent = '';
  $('dialogue-reply').classList.add('hidden');
  dialogueBox.classList.remove('hidden');
  renderDialogueNode();
}
function chooseDialogueResponse(index) {
  if (!dialogueState) return;
  const node = dialogueNode(dialogueState.npc, dialogueState.nodeId);
  const choice = dialogueChoice(node, index);
  if (!choice) return;
  $('dialogue-reply').textContent = `你：${choice.text}`;
  $('dialogue-reply').classList.remove('hidden');
  if (!choice.next) {
    $('dialogue-choices').replaceChildren();
    $('dialogue-hint').textContent = '对话结束 · Esc 或 × 继续探索';
    $('dialogue-close').focus();
    return;
  }
  dialogueState.nodeId = choice.next;
  renderDialogueNode();
}
function closeSameKindDialogue() {
  if (!dialogueState) return;
  dialogueBox.classList.add('hidden');
  dialogueState = null;
  $('dialogue-choices').replaceChildren();
  $('dialogue-line').textContent = '';
  $('dialogue-reply').textContent = '';
  $('dialogue-reply').classList.add('hidden');
  const focus =
    dialogueReturnFocus && document.contains(dialogueReturnFocus)
      ? dialogueReturnFocus
      : canvas;
  dialogueReturnFocus = null;
  focus.focus();
}
function talkToSameKind() {
  if (!started || switching || dialogueState) return;
  const w = getWorld(active),
    npc = w.sameKind;
  if (npc && sameKindInRange(npc, w)) openSameKindDialogue(npc);
}
function checkSameKindEncounter(w) {
  const npc = w.sameKind;
  if (!npc || !started || switching || dialogueState) {
    sameKindPrompt.classList.add('hidden');
    return;
  }
  const inRange = sameKindInRange(npc, w);
  const entered = inRange && !npc.inRange;
  npc.inRange = inRange;
  sameKindPrompt.classList.toggle('hidden', !inRange);
  if (entered && rollSameKindEncounter(() => rand(0, 1)))
    openSameKindDialogue(npc);
}
function recruit() {
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
}
function encounter() {
  if (!started || switching || dialogueState) return;
  const w = getWorld(active);
  if (time - lastTalk > 19) {
    const candidates = w.talkers.filter((t) => {
      t.object.getWorldPosition(v);
      return v.distanceTo(w.avatar.position) < t.range;
    });
    if (candidates.length)
      say(candidates[Math.floor(rand(0, candidates.length))]);
  }
  nearGrass = null;
  if (active === 0 && w.followers.length < 12) {
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
  $('invite').classList.toggle('hidden', !nearGrass);
  if (active === 0) senseFeelings(w);
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
  if (active !== 0 || !started || switching) return;
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
  toast('按住鼠标拖动观察，W A S D 自由移动。');
};
$('sound').onclick = toggleAudio;
$('dialogue-close').onclick = closeSameKindDialogue;
$('help').onclick = () => {
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
  if (dialogueState) {
    if (e.code === 'Escape') {
      e.preventDefault();
      closeSameKindDialogue();
      return;
    }
    const choiceIndex = DIALOGUE_CHOICE_KEYS.indexOf(e.key.toUpperCase());
    if (choiceIndex >= 0 && !e.repeat) {
      e.preventDefault();
      chooseDialogueResponse(choiceIndex);
    }
    return;
  }
  if (e.code === 'Escape') {
    if (!$('help-panel').classList.contains('hidden')) {
      e.preventDefault();
      closeHelp();
    }
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
  keys.add(e.code);
  if (e.code.startsWith('Digit') && +e.key >= 1 && +e.key <= 4)
    switchWorld(+e.key - 1);
  if (e.code === 'KeyE' && !e.repeat) recruit();
  if (e.code === 'KeyF' && !e.repeat) listenToSelf();
  if (e.code === 'KeyR' && !e.repeat) talkToSameKind();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  drag = null;
});
canvas.addEventListener('pointerdown', (e) => {
  if (!started || switching || dialogueState) return;
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
    if (!started || dialogueState) return;
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
  let dx = 0,
    dz = 0;
  if (
    started &&
    !switching &&
    !dialogueState &&
    $('help-panel').classList.contains('hidden')
  ) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  }
  const moving = dx !== 0 || dz !== 0;
  w.moving = moving ? 1 : 0;
  if (moving) {
    const len = Math.hypot(dx, dz),
      x = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / len,
      z = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) / len;
    w.position.x += x * d.speed * dt;
    w.position.z += z * d.speed * dt;
    const dist = Math.hypot(w.position.x, w.position.z);
    if (dist > d.limit) w.position.multiplyScalar(d.limit / dist);
    if (active < 2) {
      const angle = Math.atan2(-x, -z);
      let delta = angle - w.avatar.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      w.avatar.rotation.y += delta * 0.14;
    }
  }
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
    w.sameKind?.object.userData.limbs?.forEach((limb, i) => {
      limb.rotation.x = Math.sin(time * 1.1 + i * 0.7) * 0.025;
    });
  }
  if (active === 2) {
    w.avatar.rotation.y += dt * 0.008;
    w.avatar.rotation.z = reduced ? 0 : Math.sin(time * 0.24) * 0.003;
  }
  if (active === 3) {
    w.globe.rotation.y += dt * 0.018;
    if (w.sameKind) w.sameKind.object.rotation.y += dt * 0.012;
  }
  if (w.particles && !reduced) w.particles.rotation.y = time * 0.003;
  if (w.update) w.update(dt, time, reduced);
  placeCamera();
  if (frame % 12 === 0) {
    encounter();
    checkSameKindEncounter(w);
  }
  if (feeling) {
    if (time > feeling.until) hideFeeling();
    else positionFeeling();
  }
  if (active === 0 && started && frame % 30 === 0) updateSenses();
  if (time > talkUntil) $('encounter').classList.remove('visible');
  if (time > toastUntil) $('toast').classList.remove('visible');
  renderer.render(w.scene, camera);
  if (frame % 30 === 0) {
    canvas.dataset.position = `${w.position.x.toFixed(2)},${w.position.z.toFixed(2)}`;
    canvas.dataset.followers = worlds[0].followers.length;
    canvas.dataset.weather = worlds[0].environment.state.weather;
    canvas.dataset.drawcalls = renderer.info.render.calls;
    canvas.dataset.sameKind = w.sameKind?.name ?? '';
    canvas.dataset.dialogue = dialogueState?.nodeId ?? '';
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
