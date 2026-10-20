// 野生动物的行为状态机。只处理平面坐标与状态，不依赖 Three.js，
// 渲染姿态由 src/worlds/animals.js 根据 state 与 speed 决定。
//
// observer: { x, z, moving, presence, wind: {x, z} | null, lure }
//   presence 越大越容易惊动动物；wind 是风吹向的单位向量；
//   lure 为真时，吃草的动物会被草药气味吸引。
// 常态：forage 觅食、rest 休息、wander 闲逛。
// 反应：flee 逃开、alert 警觉、withdrawn 缩壳、curled 团起、
//       sentinel 站岗、hidden 躲进洞、freeze 僵住、curious 被吸引、
//       notice 注意到你、display 示威点头、visit 停到人手上、
//       warn 张耳警告（之后会领着幼崽走开，不会攻击）。
// 有 leader 的动物以带头者的当前位置为家：羊群跟着牧人，小象跟着母象。

export const LURE_RADIUS = 18;
const STEER = 6;
const STILL = new Set(['freeze', 'alert', 'display', 'notice']),
  UNREACHABLE = new Set(['flee', 'withdrawn', 'curled', 'freeze', 'warn']),
  AIRBORNE = new Set(['flutter', 'fly']);

export function createAnimal(id, species, x, z, home = { x, z }, random) {
  return {
    id,
    species,
    x,
    z,
    homeX: home.x,
    homeZ: home.z,
    heading: random() * Math.PI * 2,
    state: 'forage',
    timer: 1 + random() * 4,
    targetX: x,
    targetZ: z,
    speed: 0,
    hidden: false,
    leader: null,
  };
}

export function alertRadius(t, observer, a) {
  if (!t.alertRadius) return 0;
  let radius = t.alertRadius * observer.presence;
  if (!observer.moving) radius *= 0.6;
  if (t.herbivore && observer.lure) radius *= 0.5;
  if (t.scent && observer.wind) {
    const dx = a.x - observer.x,
      dz = a.z - observer.z,
      dist = Math.hypot(dx, dz) || 1;
    // 风从观察者吹向动物时，气味先到，动物更早察觉。
    radius *= 1 + (0.35 * (dx * observer.wind.x + dz * observer.wind.z)) / dist;
  }
  return radius;
}

function turnToward(a, x, z, dt) {
  const wanted = Math.atan2(x - a.x, z - a.z);
  let delta = wanted - a.heading;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  a.heading += delta * Math.min(1, dt * STEER);
}

function moveToward(a, x, z, speed, dt) {
  const dx = x - a.x,
    dz = z - a.z,
    dist = Math.hypot(dx, dz);
  if (dist < 0.08) return true;
  const step = Math.min(dist, speed * dt);
  a.x += (dx / dist) * step;
  a.z += (dz / dist) * step;
  a.speed = speed;
  turnToward(a, x, z, dt);
  return false;
}

function settle(a, random) {
  a.state = random() < 0.7 ? 'forage' : 'rest';
  a.timer = 2 + random() * 5;
}

function clampToLimit(a, limit) {
  const dist = Math.hypot(a.targetX, a.targetZ);
  if (dist > limit) {
    a.targetX *= limit / dist;
    a.targetZ *= limit / dist;
  }
}

function live(a, t, dt, random) {
  if (a.leader && Math.hypot(a.homeX - a.x, a.homeZ - a.z) > t.homeRadius) {
    // 落在带头的后面太远，小跑着跟上去。
    a.state = 'wander';
    a.timer = 1;
    moveToward(a, a.homeX, a.homeZ, t.walkSpeed * 2.2, dt);
    return;
  }
  if (a.state === 'wander') {
    if (moveToward(a, a.targetX, a.targetZ, t.walkSpeed, dt) || a.timer <= 0)
      settle(a, random);
    return;
  }
  if (a.timer > 0) return;
  const angle = random() * Math.PI * 2,
    reach = Math.sqrt(random()) * t.homeRadius;
  a.targetX = a.homeX + Math.sin(angle) * reach;
  a.targetZ = a.homeZ + Math.cos(angle) * reach;
  a.state = 'wander';
  a.timer = 4 + (t.homeRadius * 2) / Math.max(t.walkSpeed, 0.05);
}

function startFlee(a, t, fromX, fromZ, radius, random, limit) {
  const away = Math.atan2(a.x - fromX, a.z - fromZ) + (random() - 0.5) * 0.9;
  if (t.reaction === 'burrow') {
    a.targetX = a.homeX;
    a.targetZ = a.homeZ;
  } else if (AIRBORNE.has(t.reaction) || t.perch) {
    // 蝴蝶只在自己的花丛里换一朵花；鸟飞起来绕一圈，落回原来那片地方；
    // 栖在灌木上的动物只会挪到枝条的另一边。
    a.targetX = a.homeX + Math.sin(away) * t.homeRadius * 0.85;
    a.targetZ = a.homeZ + Math.cos(away) * t.homeRadius * 0.85;
  } else {
    const dist = Math.max(radius * 1.7, 5);
    a.targetX = a.x + Math.sin(away) * dist;
    a.targetZ = a.z + Math.cos(away) * dist;
  }
  clampToLimit(a, limit);
  a.state = 'flee';
  a.timer = 8;
}

function reactLured(a, t, observer, dist, radius, dt) {
  if (!(t.herbivore && observer.lure && dist < LURE_RADIUS)) return false;
  a.state = 'curious';
  a.timer = 3;
  const stop = Math.max(3, radius + 0.8);
  if (dist > stop) {
    const k = stop / dist;
    moveToward(
      a,
      observer.x + (a.x - observer.x) * k,
      observer.z + (a.z - observer.z) * k,
      t.walkSpeed,
      dt,
    );
  } else turnToward(a, observer.x, observer.z, dt);
  return true;
}

// 体型大的食草动物在逃开之前，会先停下来盯着你看一阵。
function watching(t, observer, dist, radius) {
  return (
    t.watchRadius &&
    !(t.herbivore && observer.lure) &&
    dist < t.watchRadius * (radius / t.alertRadius)
  );
}

// 家畜不怕人：安静地站在附近，它们会过来闻一闻你的手；bold 的连你走动也不在乎。
// radius 是它注意到你的距离，同样受脚步轻重和风向影响。
function tame(a, t, observer, dist, radius, dt, random) {
  if (a.state === 'curious') {
    if ((observer.moving && !t.bold) || dist > radius * 1.6 || a.timer <= 0)
      settle(a, random);
    else if (dist > 1.2)
      moveToward(a, observer.x, observer.z, t.walkSpeed * 1.5, dt);
    else turnToward(a, observer.x, observer.z, dt);
    return;
  }
  if (
    dist < radius &&
    (t.bold || !observer.moving) &&
    random() < dt * t.curiosity
  ) {
    a.state = 'curious';
    a.timer = 6;
    return;
  }
  if (!reactLured(a, t, observer, dist, radius, dt)) live(a, t, dt, random);
}

export function stepAnimal(a, t, observer, dt, random, limit = Infinity) {
  const dist = Math.hypot(a.x - observer.x, a.z - observer.z),
    radius = alertRadius(t, observer, a);
  a.timer -= dt;
  a.speed = 0;

  if (a.state === 'visit') {
    // 停在人手上：人一走动或时间到，就飞回花丛。
    if (observer.moving || a.timer <= 0) {
      a.state = 'wander';
      a.timer = 6;
    } else moveToward(a, observer.x, observer.z, t.walkSpeed, dt);
    return;
  }

  switch (t.reaction) {
    case 'flee':
    case 'flutter':
    case 'fly':
      if (a.state === 'flee') {
        if (
          moveToward(a, a.targetX, a.targetZ, t.fleeSpeed, dt) ||
          a.timer <= 0
        ) {
          a.state = t.reaction === 'flutter' ? 'rest' : 'alert';
          a.timer = t.calmAfter;
        }
      } else if (dist < radius)
        startFlee(a, t, observer.x, observer.z, radius, random, limit);
      else if (watching(t, observer, dist, radius)) {
        a.state = 'alert';
        a.timer = Math.max(a.timer, 2);
        turnToward(a, observer.x, observer.z, dt);
      } else if (a.state === 'alert' || a.state === 'notice') {
        turnToward(a, observer.x, observer.z, dt);
        if (a.timer <= 0) settle(a, random);
      } else if (!reactLured(a, t, observer, dist, radius, dt))
        live(a, t, dt, random);
      return;

    case 'withdraw':
    case 'curl': {
      const tucked = t.reaction === 'withdraw' ? 'withdrawn' : 'curled';
      if (dist < radius) {
        a.state = tucked;
        a.timer = t.calmAfter;
      } else if (a.state === tucked || a.state === 'notice') {
        if (a.state === 'notice') turnToward(a, observer.x, observer.z, dt);
        if (a.timer <= 0) settle(a, random);
      } else if (!reactLured(a, t, observer, dist, radius, dt))
        live(a, t, dt, random);
      return;
    }

    case 'burrow': {
      const watch = t.watchRadius * (radius / t.alertRadius);
      if (a.state === 'hidden') {
        a.hidden = true;
        if (dist < radius * 1.4) a.timer = Math.max(a.timer, 2);
        else if (a.timer <= 0) {
          a.hidden = false;
          a.state = 'sentinel';
          a.timer = 4;
        }
      } else if (a.state === 'flee') {
        if (moveToward(a, a.homeX, a.homeZ, t.fleeSpeed, dt)) {
          a.state = 'hidden';
          a.hidden = true;
          a.timer = t.calmAfter;
        }
      } else if (dist < radius)
        startFlee(a, t, observer.x, observer.z, radius, random, limit);
      else if (dist < watch) {
        a.state = 'sentinel';
        a.timer = 3;
        turnToward(a, observer.x, observer.z, dt);
      } else if (a.state === 'sentinel' || a.state === 'notice') {
        if (a.timer <= 0) settle(a, random);
      } else live(a, t, dt, random);
      return;
    }

    case 'freeze':
      if (a.state === 'flee') {
        if (
          moveToward(a, a.targetX, a.targetZ, t.fleeSpeed, dt) ||
          a.timer <= 0
        ) {
          a.state = 'alert';
          a.timer = t.calmAfter;
        }
      } else if (dist < radius * 0.5)
        startFlee(a, t, observer.x, observer.z, radius, random, limit);
      else if (dist < radius) {
        a.state = 'freeze';
        a.timer = t.calmAfter;
      } else if (STILL.has(a.state)) {
        if (a.state === 'display') turnToward(a, observer.x, observer.z, dt);
        if (a.timer <= 0) settle(a, random);
      } else live(a, t, dt, random);
      return;

    case 'warn':
      if (a.state === 'flee') {
        if (
          moveToward(a, a.targetX, a.targetZ, t.fleeSpeed, dt) ||
          a.timer <= 0
        ) {
          a.state = 'alert';
          a.timer = t.calmAfter;
        }
      } else if (a.state === 'warn' && dist < radius * 0.55)
        // 警告过了你还往前走：她转身领着幼崽慢慢走开。
        startFlee(a, t, observer.x, observer.z, radius, random, limit);
      else if (dist < radius) {
        a.state = 'warn';
        a.timer = t.calmAfter;
        turnToward(a, observer.x, observer.z, dt);
      } else if (STILL.has(a.state) || a.state === 'warn') {
        turnToward(a, observer.x, observer.z, dt);
        if (a.timer <= 0) settle(a, random);
      } else live(a, t, dt, random);
      return;

    case 'tame':
      tame(a, t, observer, dist, radius, dt, random);
      return;

    default:
      live(a, t, dt, random);
  }
}

// 外来的惊扰（喷嚏、同伴报警）。返回动物是否因此改变了状态。
export function startle(a, t, x, z, radius, random, limit = Infinity) {
  if (a.hidden || Math.hypot(a.x - x, a.z - z) > radius) return false;
  switch (t.reaction) {
    case 'flee':
    case 'flutter':
    case 'fly':
    case 'freeze':
    case 'burrow':
      if (a.state === 'flee') return false;
      startFlee(a, t, x, z, t.alertRadius, random, limit);
      return true;
    case 'warn':
      if (a.state === 'flee') return false;
      a.state = 'warn';
      a.timer = t.calmAfter;
      return true;
    case 'withdraw':
      a.state = 'withdrawn';
      a.timer = t.calmAfter;
      return true;
    case 'curl':
      a.state = 'curled';
      a.timer = t.calmAfter;
      return true;
    default:
      return false;
  }
}

// 被人安静观察时的小反应。canHost 表示人物足够安静、可以让蝴蝶停到手上。
export function respond(a, t, observer, { canHost = false } = {}) {
  if (a.hidden || UNREACHABLE.has(a.state)) return null;
  switch (t.reaction) {
    case 'flutter':
      if (!canHost || observer.moving) return null;
      a.state = 'visit';
      a.timer = 7;
      return 'visit';
    case 'freeze':
      a.state = 'display';
      a.timer = 3.5;
      return 'display';
    case 'burrow':
      a.state = 'sentinel';
      a.timer = 4;
      return 'sentinel';
    case 'tame':
      a.state = 'curious';
      a.timer = 6;
      return 'curious';
    case 'ignore':
      return null;
    default:
      a.state = 'notice';
      a.timer = 3;
      return 'notice';
  }
}

export function stepWildlife(animals, table, observer, dt, random, limit) {
  for (const a of animals) {
    const t = table[a.species].temperament,
      before = a.state;
    if (a.leader) {
      a.homeX = a.leader.x;
      a.homeZ = a.leader.z;
    }
    stepAnimal(a, t, observer, dt, random, limit);
    if (!t.social || a.state !== 'flee' || before === 'flee') continue;
    // 群居动物：一只报警，附近的同伴一起跑。
    for (const other of animals)
      if (
        other !== a &&
        other.species === a.species &&
        Math.hypot(other.x - a.x, other.z - a.z) < 10
      )
        startle(other, t, observer.x, observer.z, Infinity, random, limit);
  }
}
