// 原野上其他人的日常与反应。只处理平面坐标与状态，不依赖 Three.js；
// 姿态由 src/worlds/residents.js 按 state 摆出，文字在 src/content/residents.js。
//
// routine 是循环的日程，每一步是三种之一：
//   { walk: [[x, z], ...], as, speed }   沿路点走；as 是途中的状态（默认 walk）
//   { stay: 'sit', seconds: [min, max], face: [x, z] }   在原地做一件事
//   { roam: 'play', around, radius, seconds, speed, pause }   在 around 附近
//     来回走动；pause 是两次走动之间停下来做这件事的时间（拾柴的人弯腰去捡）
// follow 指向另一个人的 id：不走 routine，跟在对方身边（追着姐姐跑的弟弟）。
// reactions 按当前状态决定对走近的人的反应：greet 打招呼、nod 点头、
//   hush 示意安静、curious 好奇地凑近、shy 躲到同伴身后、stir 睡梦中翻身。
//   没有对应项就不理会，比如正专心画画的人。

export const REACTION_SECONDS = {
  greet: 3.2,
  nod: 2.2,
  hush: 4,
  curious: 7,
  shy: 6,
  stir: 2.6,
};
// 再次对同一个人做出反应前的间隔（秒）。
export const REACT_COOLDOWN = 30;
const STEER = 5;

const pick = (random, [min, max]) => min + random() * (max - min);

export function createResident(def, random) {
  const [x, z] = def.at;
  const r = {
    id: def.id,
    x,
    z,
    heading: def.heading ?? random() * Math.PI * 2,
    step: -1,
    waypoint: 0,
    activity: 'stand',
    state: 'stand',
    timer: 0,
    pauseTimer: 0,
    centerX: x,
    centerZ: z,
    targetX: x,
    targetZ: z,
    speed: 0,
    reaction: null,
    reactTimer: 0,
    cooldown: 0,
    near: false,
    event: null,
    said: 0,
  };
  if (def.routine) nextStep(r, def, random);
  return r;
}

function turnToward(r, x, z, dt) {
  const wanted = Math.atan2(x - r.x, z - r.z);
  let delta = wanted - r.heading;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  r.heading += delta * Math.min(1, dt * STEER);
}

// 返回是否已经到达。
function moveToward(r, x, z, speed, dt) {
  const dx = x - r.x,
    dz = z - r.z,
    dist = Math.hypot(dx, dz);
  if (dist < 0.12) return true;
  const step = Math.min(dist, speed * dt);
  r.x += (dx / dist) * step;
  r.z += (dz / dist) * step;
  r.speed = speed;
  turnToward(r, x, z, dt);
  return false;
}

function nextStep(r, def, random) {
  r.step = (r.step + 1) % def.routine.length;
  const step = def.routine[r.step];
  r.waypoint = 0;
  if (step.walk) {
    r.activity = step.as ?? 'walk';
  } else if (step.stay) {
    r.activity = step.stay;
    r.timer = pick(random, step.seconds);
  } else {
    // around 固定活动范围（孩子总在院子附近玩）；没有就以当前位置为中心。
    const [x, z] = step.around ?? [r.x, r.z];
    r.activity = step.roam;
    r.timer = pick(random, step.seconds);
    r.centerX = x;
    r.centerZ = z;
    r.targetX = r.x;
    r.targetZ = r.z;
    r.pauseTimer = 0;
  }
}

function live(r, def, dt, random) {
  const step = def.routine[r.step];
  if (step.walk) {
    const [x, z] = step.walk[r.waypoint];
    if (moveToward(r, x, z, step.speed ?? def.speed, dt)) {
      r.waypoint++;
      if (r.waypoint >= step.walk.length) nextStep(r, def, random);
    }
    return;
  }
  r.timer -= dt;
  if (step.stay) {
    if (step.face) turnToward(r, step.face[0], step.face[1], dt);
  } else if (r.pauseTimer > 0) {
    r.pauseTimer -= dt;
  } else if (moveToward(r, r.targetX, r.targetZ, step.speed, dt)) {
    // 走到一处，先停下做事，再挑下一个落脚点。
    r.pauseTimer = step.pause ? pick(random, step.pause) : 0;
    const angle = random() * Math.PI * 2,
      reach = Math.sqrt(random()) * step.radius;
    r.targetX = r.centerX + Math.sin(angle) * reach;
    r.targetZ = r.centerZ + Math.cos(angle) * reach;
  }
  if (r.timer <= 0) nextStep(r, def, random);
}

// 跟在 leader 身侧稍后的位置；落下太远就跑起来追。
function follow(r, def, leader, dt, random) {
  const gap = def.gap ?? 1,
    side = leader.heading + (def.side ?? 2.3),
    x = leader.x + Math.sin(side) * gap,
    z = leader.z + Math.cos(side) * gap,
    dist = Math.hypot(x - r.x, z - r.z);
  if (r.activity === 'squat' && r.timer > 0 && dist < 3.5) {
    // 蹲下看什么东西看入了迷，直到被落下才想起来追。
    r.timer -= dt;
    return;
  }
  if (dist > 0.35) {
    const running = dist > 3;
    r.activity = running ? 'run' : 'walk';
    moveToward(
      r,
      x,
      z,
      running ? def.runSpeed : Math.max(def.speed, leader.speed),
      dt,
    );
    return;
  }
  // 站定后和同伴望向同一个方向。
  turnToward(
    r,
    leader.x + Math.sin(leader.heading) * 3,
    leader.z + Math.cos(leader.heading) * 3,
    dt,
  );
  if (r.activity !== 'stand' && r.activity !== 'squat') r.activity = 'stand';
  if (def.distracted && random() < dt * def.distracted) {
    r.activity = 'squat';
    r.timer = 2.5 + random() * 3;
  }
}

function startReaction(r, reaction) {
  r.reaction = reaction;
  r.reactTimer = REACTION_SECONDS[reaction];
  r.cooldown = REACT_COOLDOWN;
  r.state = reaction;
}

function react(r, def, observer, leader, dt) {
  r.reactTimer -= dt;
  const dist = Math.hypot(observer.x - r.x, observer.z - r.z);
  if (r.reaction === 'curious') {
    // 凑到一步开外就停下，仰头看着你。
    if (dist > 1.7) moveToward(r, observer.x, observer.z, def.speed, dt);
    else turnToward(r, observer.x, observer.z, dt);
  } else if (r.reaction === 'shy' && leader) {
    // 躲到同伴背对着你的那一侧；你还在附近就一直躲着。
    const away = Math.atan2(leader.x - observer.x, leader.z - observer.z);
    moveToward(
      r,
      leader.x + Math.sin(away) * 0.7,
      leader.z + Math.cos(away) * 0.7,
      def.runSpeed ?? def.speed,
      dt,
    );
    if (dist < noticeRadius(def, observer))
      r.reactTimer = Math.max(r.reactTimer, 1);
  } else if (r.reaction !== 'stir') {
    turnToward(r, observer.x, observer.z, dt);
  }
  if (r.reactTimer <= 0) {
    r.reaction = null;
    r.state = r.activity;
  }
}

export function noticeRadius(def, observer) {
  return (def.notice ?? 6) * Math.min(1.3, Math.max(0.6, observer.presence));
}

// leader 是 follow 指向的那个人的状态对象（没有则为 null）。
// 新触发的反应写入 r.event，供界面显示一次后清空。
export function stepResident(r, def, observer, dt, random, leader = null) {
  r.speed = 0;
  r.cooldown -= dt;
  if (r.reaction) {
    react(r, def, observer, leader, dt);
    return;
  }
  const dist = Math.hypot(observer.x - r.x, observer.z - r.z),
    reaction = def.reactions?.[r.activity],
    radius = noticeRadius(def, observer);
  // 睡着的人只会被大步走近的脚步声吵到；放轻脚步就能从旁边经过。
  const heard =
    reaction === 'stir'
      ? observer.moving && observer.presence >= 0.9 && dist < radius * 0.6
      : dist < radius;
  // 只在你走进来的那一刻反应；一直站在旁边不会被反复招呼。
  const arrived = heard && !r.near;
  r.near = heard;
  if (reaction && arrived && r.cooldown <= 0) {
    startReaction(r, reaction);
    r.event = reaction;
    return;
  }
  if (def.follow) {
    if (leader) follow(r, def, leader, dt, random);
  } else live(r, def, dt, random);
  r.state = r.activity;
}

// 被人安静观察（按 F）时的反应。睡着的人不会因为被看着而醒来。
export function respondResident(r, def) {
  if (r.reaction) return r.reaction;
  const reaction = def.reactions?.[r.activity];
  if (!reaction || reaction === 'stir') return null;
  startReaction(r, reaction);
  return reaction;
}

// defs 以 id 为键，见 residentById。
export function stepResidents(list, defs, observer, dt, random) {
  for (const r of list) {
    const def = defs[r.id];
    const leader = def.follow ? list.find((o) => o.id === def.follow) : null;
    stepResident(r, def, observer, dt, random, leader);
  }
}
