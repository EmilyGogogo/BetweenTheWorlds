import assert from 'node:assert/strict';
import test from 'node:test';
import {
  feelingTopics,
  grassSpecies,
  weatherArrivals,
} from '../../src/content/grass-feelings.js';
import { chooseFeeling, topicWeights } from '../../src/core/feelings.js';
import {
  createGrassEnvironment,
  heightCm,
  weatherPhases,
} from '../../src/core/grass-environment.js';
import { rng } from '../../src/core/random.js';

const cycleSeconds = weatherPhases.reduce((sum, p) => sum + p.duration, 0);

function run(environment, seconds, onStep = () => {}) {
  for (let t = 0; t < seconds; t += 0.5) onStep(environment.step(0.5));
}

test('weather cycles through every phase and reports each change once', () => {
  const environment = createGrassEnvironment();
  const changes = [];
  run(environment, cycleSeconds, (changed) => changed && changes.push(changed));
  assert.deepEqual(changes, [
    ...weatherPhases.slice(1).map((p) => p.id),
    weatherPhases[0].id,
  ]);
});

test('rain soaks the roots, sun dries them, and growth never shrinks', () => {
  const environment = createGrassEnvironment();
  const { state } = environment;
  let before = null,
    peak = 0,
    lastGrowth = 0;
  run(environment, cycleSeconds * 2, () => {
    if (state.weather === 'rain' && before === null) before = state.moisture;
    peak = Math.max(peak, state.moisture);
    assert.ok(state.growth >= lastGrowth);
    lastGrowth = state.growth;
  });
  assert.ok(peak > before + 0.3, `moisture ${before} -> ${peak}`);
  assert.ok(state.moisture >= 0 && state.moisture <= 1);
  assert.ok(heightCm(state) > 10.5, `grew to ${heightCm(state)} cm`);
});

test('photosynthesis follows light: strong in sun, weak under rain', () => {
  const environment = createGrassEnvironment();
  const { state } = environment;
  const byPhase = {};
  run(environment, cycleSeconds, () => {
    if (state.phaseTime > 20) byPhase[state.weather] = state.photosynthesis;
  });
  assert.ok(byPhase['after-rain'] > 0.7, JSON.stringify(byPhase));
  assert.ok(byPhase.rain < 0.35, JSON.stringify(byPhase));
});

test('feelings match what the grass is sensing', () => {
  const rain = {
    sun: 0.2,
    wind: 0.5,
    rain: 0.9,
    temperature: 17,
    moisture: 0.8,
    photosynthesis: 0.1,
    growth: 0,
  };
  const weights = topicWeights(rain);
  assert.equal(weights.sun, 0);
  assert.equal(weights.growth, 0);
  assert.ok(weights.rain > 0 && weights.roots > 0);
  const random = rng(7);
  for (let i = 0; i < 40; i++) {
    const { topic } = chooseFeeling(rain, { topics: feelingTopics, random });
    assert.ok(weights[topic] > 0, `${topic} should not be felt in rain`);
  }
});

test('feelings avoid recent lines and fill every placeholder', () => {
  const sunny = {
    sun: 1,
    wind: 0.2,
    rain: 0,
    temperature: 24.4,
    moisture: 0.5,
    photosynthesis: 0.9,
    growth: 0.73,
  };
  const random = rng(11);
  for (let i = 0; i < 60; i++) {
    const choice = chooseFeeling(sunny, {
      topics: feelingTopics,
      species: grassSpecies[0],
      followers: 2,
      random,
    });
    assert.doesNotMatch(choice.text, /[{}]/);
  }
  const pair = {
    sun: [
      ['甲', 'test'],
      ['乙', 'test'],
    ],
  };
  for (let i = 0; i < 20; i++)
    assert.equal(
      chooseFeeling(sunny, { topics: pair, recent: ['甲'], random }).key,
      '乙',
    );
  const growth = feelingTopics.growth[0][0];
  const filled = chooseFeeling(sunny, {
    topics: { growth: [[growth, 'test']] },
    random: () => 0,
  });
  assert.match(filled.text, /7 毫米/);
});

test('every line names its source and inspirations are not quotes', () => {
  const lines = [
    ...Object.values(feelingTopics).flat(),
    ...Object.values(weatherArrivals).flat(),
    ...grassSpecies.flatMap((s) => s.lines),
  ];
  for (const [text, source] of lines) {
    assert.ok(text.length > 4);
    assert.match(source, /^(原创 · 万物之间|受《.+》.*启发 · 原创改写)$/);
  }
  for (const phase of weatherPhases)
    assert.ok(weatherArrivals[phase.id]?.length, phase.id);
});
