import { heightCm } from './grass-environment.js';

// How strongly each sensation is felt right now. Zero means the topic does not
// fit the current state and must not be chosen.
export function topicWeights(env, { followers = 0 } = {}) {
  return {
    sun: env.sun > 0.7 && env.rain < 0.3 ? 3 : 0,
    shade: env.sun < 0.5 && env.rain < 0.3 ? 3 : 0,
    wind: env.wind > 0.6 ? 3 : env.wind > 0.3 ? 0.6 : 0,
    rain: env.rain > 0.4 ? 4 : 0,
    roots: env.moisture > 0.6 ? 3 : env.moisture > 0.4 ? 1 : 0,
    photosynthesis:
      env.photosynthesis > 0.55 ? 3 : env.photosynthesis > 0.3 ? 1 : 0,
    growth: env.growth >= 0.05 ? 1.5 : 0,
    thirst: env.moisture < 0.25 && env.sun > 0.6 ? 3 : 0,
    being: 1,
    companions: followers > 0 ? 1.5 : 0,
  };
}

export function fillFeeling(text, env) {
  return text
    .replaceAll('{temp}', String(Math.round(env.temperature)))
    .replaceAll('{mm}', String(Math.max(1, Math.round(env.growth * 10))))
    .replaceAll('{cm}', heightCm(env).toFixed(1));
}

function pickWeighted(entries, random) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Chooses one line that fits the current sensations. `species` adds the
// plant's own voice; `recent` holds texts said lately so they are not repeated.
export function chooseFeeling(
  env,
  { topics, species = null, followers = 0, recent = [], random },
) {
  const weights = topicWeights(env, { followers });
  const pools = Object.entries(weights).filter(
    ([topic, weight]) => weight > 0 && topics[topic]?.length,
  );
  if (species?.lines.length) pools.push(['species', 3]);
  const topic = pickWeighted(pools, random);
  const pool = topic === 'species' ? species.lines : topics[topic];
  const fresh = pool.filter(([text]) => !recent.includes(text));
  const choices = fresh.length ? fresh : pool;
  const [text, source] = choices[Math.floor(random() * choices.length)];
  return { topic, key: text, text: fillFeeling(text, env), source };
}
