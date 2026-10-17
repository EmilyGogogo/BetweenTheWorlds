import * as THREE from '../vendor/three.module.js';
import { characters } from './content/characters.js';
import { species } from './content/fauna.js';
import { residentById, stateLabels } from './content/residents.js';
import {
  isSpecialty,
  noteFor,
  observeRange,
  perceives,
} from './core/observation.js';
import { rng } from './core/random.js';
import { respondResident, stepResidents } from './core/residents.js';
import { respond, startle, stepWildlife } from './core/wildlife.js';

// 人层的田野观察：第一人称视角、人物切换、观察笔记、专属能力、动物模拟与原野上的其他人。
// 只在人层激活时由 main.js 调用；事件监听在创建时注册一次。
const EYE_HEIGHT = 1.6;
const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
const RELATIVE = [
  '正前方',
  '右前方',
  '右侧',
  '右后方',
  '身后',
  '左后方',
  '左侧',
  '左前方',
];
// 动物的通用反应描述；物种的 reactionNotes 可以替换其中一条。
const REACTIONS = {
  visit: '它轻轻落在了你的手指上，翅膀慢慢开合。别动。',
  display: '它冲你连点了几下头——这是在告诉你，这块石头有主了。',
  sentinel: '它直起身子盯着你，随时准备叫醒同伴。',
  notice: '它停下来，看了你一会儿。',
  curious: '它凑过来闻了闻你。',
};
// 两次“有人跟你打招呼”的提示之间至少间隔的秒数。
const CHAT_GAP = 6;

// 方位角：0 为北（-z），顺时针增加，π/2 为东（+x）。
const bearing = (x, z) => Math.atan2(x, -z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sector = (angle, names) =>
  names[(Math.round(wrap(angle) / (Math.PI / 4)) + 8) % 8];
const ease = (current, target, dt, rate = 6) =>
  current + (target - current) * Math.min(1, dt * rate);

export function createFieldwork({
  getWorld,
  camera,
  canvas,
  toast,
  clearInput,
  reduced,
  limit,
}) {
  const $ = (id) => document.getElementById(id);
  const random = rng(4242);
  const forward = new THREE.Vector3(),
    toTarget = new THREE.Vector3(),
    point = new THREE.Vector3(),
    lookAt = new THREE.Vector3(),
    handPoint = new THREE.Vector3();
  const observer = {
    x: 0,
    z: 0,
    moving: false,
    presence: 1,
    wind: { x: 0, z: 0 },
    lure: false,
  };
  const journal = new Set();
  const state = {
    index: 0,
    view: 'first',
    panel: false,
    previewSnap: false,
    previewAngle: 0,
    lookPitch: -0.12,
    eye: EYE_HEIGHT,
    ability: false,
    abilityUntil: -1,
    cooldownUntil: -1,
    lureUntil: -1,
    trailUntil: -1,
    noteUntil: -1,
    chatUntil: -1,
    shake: 0,
    still: 0,
    idleShown: false,
    idleLine: 0,
    nextSneeze: 45,
    walk: 0,
    time: 0,
    dt: 0,
    frame: 0,
    targetKind: null,
    target: null,
    windBearing: 0,
  };
  let visible = false,
    sims = null,
    neighbors = null;

  const character = () => characters[state.index];
  const totalFor = (c) =>
    Object.keys(species).length +
    getWorld().residents.length +
    getWorld().clues.filter((clue) => perceives(clue.entry, c)).length;
  const labelFor = (def, sim) =>
    def.labels?.[sim.state] ?? stateLabels[sim.state];
  const lineFor = (def, sim, reaction) => {
    const lines = def.lines[reaction];
    return lines[sim.said++ % lines.length];
  };
  const countFor = (c) => {
    let n = 0;
    for (const key of journal) if (key.startsWith(`${c.id}:`)) n++;
    return n;
  };
  const abilityOn = (key) => state.ability && character().ability.key === key;

  // ---------- 人物选择面板 ----------
  const list = $('character-list');
  const cards = characters.map((c, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'character-card';
    card.setAttribute('role', 'radio');
    const name = document.createElement('strong'),
      focus = document.createElement('span');
    name.textContent = c.name;
    focus.textContent = `${c.focusLabel} · ${c.ability.name}`;
    card.append(name, focus);
    card.addEventListener('click', () => select(i));
    list.append(card);
    return card;
  });
  list.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      e.key
    ];
    if (!step) return;
    e.preventDefault();
    const next = (state.index + step + characters.length) % characters.length;
    select(next);
    cards[next].focus();
  });
  $('character-button').addEventListener('click', () => openPanel());
  $('close-characters').addEventListener('click', () => closePanel());
  $('confirm-character').addEventListener('click', () => closePanel());

  function renderPanel() {
    const c = character();
    cards.forEach((card, i) => {
      const on = i === state.index;
      card.setAttribute('aria-checked', on);
      card.tabIndex = on ? 0 : -1;
    });
    $('detail-name').textContent = c.name;
    $('detail-meta').textContent =
      `擅长观察${c.focusLabel} · 田野笔记 ${countFor(c)} / ${totalFor(c)}`;
    for (const field of [
      'background',
      'personality',
      'habit',
      'preference',
      'flaw',
    ])
      $(`detail-${field}`).textContent = c[field];
    $('detail-ability').textContent =
      `${c.ability.name}：${c.ability.description}`;
  }
  function renderHud() {
    const c = character();
    $('character-name').textContent = c.name;
    $('character-focus').textContent = `${c.focusLabel}观察`;
    $('journal-count').textContent = `${countFor(c)} / ${totalFor(c)}`;
    $('ability-name').textContent = c.ability.name;
    $('ability-state').textContent = state.ability ? '使用中' : '';
    $('wind').classList.toggle('hidden', c.ability.key !== 'wind');
    canvas.dataset.character = c.id;
    canvas.dataset.view = state.panel ? 'preview' : state.view;
    canvas.dataset.ability = state.ability ? c.ability.key : '';
  }
  function refreshMarkers() {
    const c = character();
    for (const clue of getWorld().clues)
      if (clue.marker) clue.marker.visible = perceives(clue.entry, c);
  }

  function select(index) {
    const w = getWorld(),
      previous = w.original.object,
      next = w.cast[index].body;
    setAbility(false);
    w.cast[state.index].hands.visible = false;
    state.index = index;
    if (previous !== next) {
      next.position.copy(previous.position);
      next.rotation.y = previous.rotation.y;
      w.scene.remove(previous);
      w.scene.add(next);
      w.original.object = next;
      w.avatar = next;
      w.position = next.position;
    }
    state.lureUntil = state.trailUntil = state.cooldownUntil = -1;
    state.nextSneeze = state.time + 30 + random() * 40;
    state.idleShown = false;
    w.setTrailGlow(0);
    setTarget(null, null);
    refreshMarkers();
    renderPanel();
    renderHud();
  }
  function openPanel() {
    if (state.panel || !visible) return;
    clearInput();
    setAbility(false);
    state.panel = true;
    state.previewSnap = true;
    state.previewAngle = 0;
    setTarget(null, null);
    renderPanel();
    renderHud();
    $('character-panel').classList.remove('hidden');
    document.body.classList.add('choosing-character');
    cards[state.index].focus();
  }
  function closePanel() {
    if (!state.panel) return false;
    state.panel = false;
    $('character-panel').classList.add('hidden');
    document.body.classList.remove('choosing-character');
    renderHud();
    if (visible) $('character-button').focus();
    return true;
  }

  // ---------- 能力 ----------
  function setAbility(on) {
    state.ability = on;
    $('binocular-mask').classList.toggle(
      'hidden',
      !(on && character().ability.key === 'binoculars'),
    );
    renderHud();
  }
  function nearest(filter) {
    const w = getWorld();
    let best = null,
      bestDist = Infinity;
    for (const a of w.animals) {
      if (a.sim.hidden || !filter(a.sim)) continue;
      const d = Math.hypot(a.sim.x - observer.x, a.sim.z - observer.z);
      if (d < bestDist) {
        best = a.sim;
        bestDist = d;
      }
    }
    return best && { sim: best, dist: bestDist };
  }
  function weatherReading() {
    const from = sector(state.windBearing + Math.PI, COMPASS);
    let text = `风从${from}来，带着干草和尘土的味道；东北方的云在长高，傍晚也许有雷雨。`;
    const animal = nearest((sim) => species[sim.species].temperament.scent);
    if (animal && animal.dist < 45) {
      const dx = animal.sim.x - observer.x,
        dz = animal.sim.z - observer.z;
      // 动物在你的下风处：风把你的气味送过去。
      const smellsYou =
        (dx * observer.wind.x + dz * observer.wind.z) / animal.dist > 0.3;
      const name = species[animal.sim.species].name;
      text += smellsYou
        ? `你正站在${name}的上风处，它很快会闻到你。`
        : `${name}在你的上风处，慢慢靠近，它闻不到你。`;
    }
    return text;
  }
  function trailReading(yaw) {
    const animal = nearest((sim) => !species[sim.species].trackless);
    if (!animal || animal.dist > 60) return '附近的痕迹都是旧的。';
    const relative =
      bearing(animal.sim.x - observer.x, animal.sim.z - observer.z) + yaw;
    return `${sector(relative, RELATIVE)}约 ${Math.round(animal.dist)} 米，${species[animal.sim.species].name}的痕迹还很新。`;
  }
  function useAbility(yaw) {
    const c = character(),
      t = state.time;
    switch (c.ability.key) {
      case 'crouch':
        setAbility(!state.ability);
        toast(
          state.ability ? '你伏低了身子，草叶就在眼前。' : '你慢慢站了起来。',
        );
        break;
      case 'binoculars':
        if (!state.ability) state.view = 'first';
        setAbility(!state.ability);
        break;
      case 'wind':
        state.abilityUntil = t + 2.5;
        toast(weatherReading());
        break;
      case 'trail':
        if (t < state.cooldownUntil) return;
        state.trailUntil = t + 12;
        state.cooldownUntil = t + 6;
        state.abilityUntil = t + 2.5;
        toast(trailReading(yaw));
        break;
      case 'scent':
        if (t < state.cooldownUntil) {
          toast(
            `草药还在散味，${Math.ceil(state.cooldownUntil - t)} 秒后再撒一把。`,
          );
          return;
        }
        state.lureUntil = t + 14;
        state.cooldownUntil = t + 30;
        state.abilityUntil = t + 1.4;
        toast('你撒开一小把干草药，空气里有了干草和薄荷的味道。');
        break;
    }
    renderHud();
  }

  // ---------- 观察 ----------
  function setTarget(kind, target) {
    if (target === state.target) {
      // 人的状态一直在变：提示里跟着显示对方此刻在做什么。
      if (kind === 'person')
        $('observe-specialty').textContent = labelFor(target.def, target.sim);
      return;
    }
    state.targetKind = kind;
    state.target = target;
    $('observe-hint').classList.toggle('hidden', !target);
    if (!target) return;
    const entry =
      kind === 'animal'
        ? species[target.sim.species]
        : kind === 'person'
          ? target.def
          : target.entry;
    const c = character();
    $('observe-label').textContent = `观察 · ${entry.name}`;
    $('observe-specialty').textContent =
      kind === 'person'
        ? labelFor(target.def, target.sim)
        : isSpecialty(entry, c)
          ? `${c.focusLabel}专长`
          : '';
  }
  function findTarget(w) {
    const c = character(),
      firstPerson = state.view === 'first',
      binoculars = abilityOn('binoculars'),
      origin = firstPerson ? camera.position : w.avatar.position;
    camera.getWorldDirection(forward);
    const flatLength = Math.hypot(forward.x, forward.z) || 1;
    let bestKind = null,
      best = null,
      bestScore = Infinity;
    const consider = (kind, item, entry, x, y, z, far) => {
      const dist = Math.hypot(x - origin.x, z - origin.z),
        range = observeRange(entry, c, { binoculars });
      if (dist > range) return;
      let dot, need;
      if (firstPerson) {
        toTarget.set(x - origin.x, y - origin.y, z - origin.z).normalize();
        dot = toTarget.dot(forward);
        need = far || binoculars ? 0.985 : dist < 6 ? 0.8 : 0.93;
      } else {
        dot =
          ((x - origin.x) * forward.x + (z - origin.z) * forward.z) /
          ((dist || 1) * flatLength);
        need = far ? 0.95 : 0.5;
      }
      if (dot < need) return;
      const score = (1 - dot) * 6 + dist / range;
      if (score < bestScore) {
        bestScore = score;
        bestKind = kind;
        best = item;
      }
    };
    for (const a of w.animals) {
      if (a.sim.hidden) continue;
      const p = a.view.object.position;
      consider(
        'animal',
        a,
        species[a.sim.species],
        p.x,
        p.y + 0.15,
        p.z,
        false,
      );
    }
    for (const person of w.residents) {
      const p = person.view.object.position;
      consider(
        'person',
        person,
        person.def,
        p.x,
        p.y + 1.1 * person.def.look.height,
        p.z,
        false,
      );
    }
    for (const clue of w.clues) {
      if (!perceives(clue.entry, c)) continue;
      clue.object.getWorldPosition(point);
      consider(
        'clue',
        clue,
        clue.entry,
        point.x,
        point.y + clue.height,
        point.z,
        clue.entry.far,
      );
    }
    setTarget(bestKind, best);
  }
  function observe() {
    const c = character(),
      target = state.target;
    if (!target) {
      toast('四周很安静。看向一只动物或一处痕迹，再按 F。');
      return;
    }
    let entry,
      key,
      subjectState = null,
      reactionText = '';
    if (state.targetKind === 'animal') {
      const sim = target.sim;
      entry = species[sim.species];
      key = `${c.id}:animal:${sim.species}`;
      subjectState = sim.state;
      const reaction = respond(sim, entry.temperament, observer, {
        canHost: isSpecialty(entry, c) || observer.presence < 0.7,
      });
      if (reaction)
        reactionText = entry.reactionNotes?.[reaction] ?? REACTIONS[reaction];
    } else if (state.targetKind === 'person') {
      // 笔记写对方原本在做什么；反应是对方此刻对你说的话或做的事。
      const { def, sim } = target;
      entry = def;
      key = `${c.id}:person:${def.id}`;
      subjectState = sim.state;
      const reaction = respondResident(sim, def);
      if (reaction) reactionText = lineFor(def, sim, reaction);
    } else {
      entry = target.entry;
      key = `${c.id}:clue:${target.key}`;
    }
    const note = noteFor(entry, c, subjectState);
    const fresh = !journal.has(key);
    journal.add(key);
    $('field-note-title').textContent = `${c.name} · ${entry.name}`;
    $('field-note-text').textContent = note.text;
    $('field-note-reaction').textContent = reactionText;
    $('field-note-meta').textContent = `${
      note.focus ? `${c.focusLabel}视角` : '寻常所见'
    } · ${fresh ? '新记入田野笔记' : '笔记里已有这一条'}`;
    $('field-note').classList.add('visible');
    state.noteUntil = state.time + 11;
    renderHud();
  }

  // ---------- 镜头与手 ----------
  // rest / raised: [x, y, z, 绕 x 转角, 绕 z 转角]，k 为抬手程度。
  function placeHand(hand, sign, k, bob, lift) {
    const rest = hand.userData.rest,
      up = hand.userData.raised;
    hand.position.set(
      rest[0] +
        (up[0] - rest[0]) * k +
        Math.sin(state.walk) * 0.01 * bob * sign,
      rest[1] + (up[1] - rest[1]) * k + lift,
      rest[2] + (up[2] - rest[2]) * k,
    );
    hand.rotation.set(
      rest[3] + (up[3] - rest[3]) * k,
      0,
      rest[4] + (up[4] - rest[4]) * k,
    );
  }
  function poseHands(w, dt, moving) {
    const rig = w.cast[state.index].hands,
      show =
        visible &&
        state.view === 'first' &&
        !state.panel &&
        !abilityOn('binoculars');
    rig.visible = show;
    if (!show) return;
    rig.position.copy(camera.position);
    rig.quaternion.copy(camera.quaternion);
    const raised = state.ability || state.time < state.abilityUntil ? 1 : 0;
    rig.userData.raise = ease(rig.userData.raise, raised, dt, 5);
    const k = rig.userData.raise,
      bob = reduced ? 0 : 1,
      lift = moving
        ? Math.abs(Math.sin(state.walk)) * -0.015 * bob
        : Math.sin(state.time * 1.4) * 0.003 * bob,
      shake =
        state.shake > 0 ? Math.sin(state.time * 60) * state.shake * 0.04 : 0;
    placeHand(rig.userData.left, -1, k, bob, lift + shake);
    placeHand(rig.userData.right, 1, k, bob, lift + shake);
    // 手指的位置，供停到手上的蝴蝶使用。
    rig.userData.right.getWorldPosition(handPoint);
    handPoint.y += 0.04;
  }
  function placeCamera(w, yaw, zoom, immediate) {
    const c = character(),
      avatar = w.avatar,
      dt = state.dt,
      height = c.look.height;
    if (state.panel || state.view !== 'first') {
      avatar.visible = true;
      w.cast[state.index].hands.visible = false;
    }
    if (state.panel) {
      // 第三人称形象预览：绕人物缓慢转动，人物放在画面左侧。
      state.previewAngle += reduced ? 0 : dt * 0.3;
      const angle = avatar.rotation.y + state.previewAngle,
        dx = Math.sin(angle),
        dz = Math.cos(angle);
      point.set(
        avatar.position.x - dx * 4.6,
        avatar.position.y + 1.2 * height,
        avatar.position.z - dz * 4.6,
      );
      if (immediate || state.previewSnap) camera.position.copy(point);
      else camera.position.lerp(point, Math.min(1, dt * 4));
      state.previewSnap = false;
      lookAt.set(
        avatar.position.x - dz * 1.1,
        avatar.position.y + 0.85 * height,
        avatar.position.z + dx * 1.1,
      );
      camera.lookAt(lookAt);
      camera.fov = 42;
      camera.near = 0.1;
      camera.updateProjectionMatrix();
      return true;
    }
    if (state.view !== 'first') return false;
    avatar.visible = false;
    avatar.rotation.y = yaw;
    const eye = height * EYE_HEIGHT * (abilityOn('crouch') ? 0.42 : 1);
    state.eye = immediate ? eye : ease(state.eye, eye, dt, 5);
    const bob =
      reduced || !observer.moving ? 0 : Math.abs(Math.sin(state.walk)) * 0.035;
    camera.position.set(
      avatar.position.x,
      avatar.position.y + state.eye + bob,
      avatar.position.z,
    );
    const cos = Math.cos(state.lookPitch);
    lookAt.set(
      camera.position.x - Math.sin(yaw) * cos,
      camera.position.y + Math.sin(state.lookPitch),
      camera.position.z - Math.cos(yaw) * cos,
    );
    camera.lookAt(lookAt);
    const fov = abilityOn('binoculars')
      ? 17
      : Math.max(40, Math.min(78, 58 * Math.sqrt(zoom)));
    camera.fov = immediate ? fov : ease(camera.fov, fov, dt, 8);
    camera.near = 0.04;
    camera.updateProjectionMatrix();
    poseHands(w, dt, observer.moving);
    return true;
  }

  // ---------- 每帧 ----------
  function update(dt, time, { moving, sneaking, yaw }) {
    const w = getWorld(),
      c = character(),
      traits = c.traits;
    sims ??= w.animals.map((a) => a.sim);
    state.time = time;
    state.dt = dt;
    state.frame++;
    state.walk += moving ? dt * 7 * traits.speed : 0;
    state.shake = Math.max(0, state.shake - dt);

    observer.x = w.position.x;
    observer.z = w.position.z;
    observer.moving = moving;
    observer.presence =
      traits.presence *
      (sneaking ? traits.sneak : 1) *
      (abilityOn('crouch') ? 0.35 : 1);
    observer.lure = time < state.lureUntil;
    state.windBearing = 0.9 + Math.sin(time * 0.013) * 0.5;
    observer.wind.x = Math.sin(state.windBearing);
    observer.wind.z = -Math.cos(state.windBearing);
    stepWildlife(sims, species, observer, dt, random, limit);
    neighbors ??= w.residents.map((r) => r.sim);
    stepResidents(neighbors, residentById, observer, dt, random);
    for (const { def, sim, view } of w.residents) {
      w.residentViews.pose(sim, view, time, dt);
      // 有人注意到你：在屏幕下方说一句话，避免几个人同时开口刷屏。
      if (!sim.event) continue;
      if (time > state.chatUntil && !state.panel) {
        state.chatUntil = time + CHAT_GAP;
        toast(`${def.name} · ${lineFor(def, sim, sim.event)}`);
      }
      sim.event = null;
    }
    // 奔跑玩耍的孩子会惊起附近的鸟和小动物。
    if (state.frame % 10 === 0)
      for (const r of neighbors)
        if (r.speed > 1.6)
          for (const a of w.animals)
            startle(
              a.sim,
              species[a.sim.species].temperament,
              r.x,
              r.z,
              5,
              random,
              limit,
            );

    const hand =
      visible && state.view === 'first' && !state.panel ? handPoint : null;
    for (const a of w.animals) {
      a.view.hand = hand;
      w.fauna.pose(a.sim, a.view, time, dt);
    }
    w.animate(time);
    if (!visible) return;
    w.setTrailGlow(
      time < state.trailUntil ? Math.min(1, state.trailUntil - time) : 0,
    );

    if (traits.sneeze && time > state.nextSneeze && !state.panel) {
      // 苏木的小缺点：花粉过敏，喷嚏会惊走附近的动物。
      state.nextSneeze = time + 40 + random() * 40;
      state.shake = 0.6;
      let startled = 0;
      for (const a of w.animals)
        if (
          startle(
            a.sim,
            species[a.sim.species].temperament,
            observer.x,
            observer.z,
            12,
            random,
            limit,
          )
        )
          startled++;
      toast(
        startled
          ? '阿——嚏！附近的动物被吓了一跳。'
          : '阿——嚏！还好附近没有谁被吓到。',
      );
    }

    if (moving) {
      state.still = 0;
      state.idleShown = false;
    } else state.still += dt;
    if (!state.idleShown && state.still > 16 && !state.panel) {
      state.idleShown = true;
      toast(`${c.name}：${c.idleLines[state.idleLine++ % c.idleLines.length]}`);
    }

    if (state.frame % 6 === 0) {
      if (state.panel) setTarget(null, null);
      else findTarget(w);
    }
    if (time > state.noteUntil) $('field-note').classList.remove('visible');
    if (c.ability.key === 'wind' && state.frame % 5 === 0) {
      const relative = state.windBearing + yaw;
      $('wind-arrow').style.transform =
        `rotate(${(relative * 180) / Math.PI}deg)`;
      $('wind-text').textContent =
        `风自${sector(state.windBearing + Math.PI, COMPASS)}`;
    }
  }

  function handleKey(code, yaw) {
    if (!visible) return false;
    if (code === 'KeyC') openPanel();
    else if (code === 'KeyF') observe();
    else if (code === 'KeyQ') useAbility(yaw);
    else if (code === 'KeyV') {
      if (abilityOn('binoculars')) setAbility(false);
      state.view = state.view === 'first' ? 'third' : 'first';
      toast(
        state.view === 'first'
          ? '第一人称：用这双眼睛看。'
          : '第三人称：看看自己站在哪里。',
      );
      renderHud();
    } else return false;
    return true;
  }

  return {
    setVisible(on) {
      $('naturalist').classList.toggle('hidden', !on);
      if (on === visible) return;
      if (on) {
        visible = true;
        refreshMarkers();
        renderHud();
        return;
      }
      closePanel();
      setAbility(false);
      setTarget(null, null);
      visible = false;
      for (const { hands } of getWorld().cast) hands.visible = false;
      getWorld().original.object.visible = true;
      $('field-note').classList.remove('visible');
    },
    isBlocking: () => state.panel,
    closePanel,
    handleKey,
    update,
    placeCamera,
    speedScale(sneaking) {
      const c = character();
      return (
        c.traits.speed *
        (sneaking ? 0.45 : 1) *
        (abilityOn('crouch') ? 0.4 : 1) *
        (abilityOn('binoculars') ? 0.3 : 1)
      );
    },
    // 第一人称下竖直拖动改为抬头/低头；返回 true 表示已处理。
    lookVertical(dy) {
      if (!visible) return false;
      if (state.panel) return true;
      if (state.view !== 'first') return false;
      state.lookPitch = Math.max(
        -1.2,
        Math.min(1, state.lookPitch - dy * 0.004),
      );
      return true;
    },
  };
}
