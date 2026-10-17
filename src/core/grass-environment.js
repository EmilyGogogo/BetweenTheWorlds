// What a blade of grass can sense: weather, warmth, water around the roots,
// photosynthesis and its own growth. Kept free of rendering so the scene, the
// feelings dialogue and the unit tests all read the same state.

export const weatherPhases = [
  {
    id: 'sunny',
    label: '晴',
    duration: 75,
    sun: 1,
    wind: 0.25,
    rain: 0,
    temperature: 24,
  },
  {
    id: 'cloudy',
    label: '云影',
    duration: 35,
    sun: 0.38,
    wind: 0.35,
    rain: 0,
    temperature: 20,
  },
  {
    id: 'breeze',
    label: '起风',
    duration: 30,
    sun: 0.8,
    wind: 1,
    rain: 0,
    temperature: 21,
  },
  {
    id: 'rain',
    label: '小雨',
    duration: 45,
    sun: 0.2,
    wind: 0.55,
    rain: 1,
    temperature: 17,
  },
  {
    id: 'after-rain',
    label: '雨后',
    duration: 50,
    sun: 0.9,
    wind: 0.2,
    rain: 0,
    temperature: 22,
  },
];

export const BASE_HEIGHT_CM = 10;
// Seconds for sun, wind, rain and temperature to settle into a new phase.
const SETTLE = 6;
const MOISTURE_FROM_RAIN = 0.012;
const MOISTURE_LOSS = 0.0016;
// Centimetres grown per second at full photosynthesis.
const GROWTH_RATE = 0.004;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

export function createGrassEnvironment() {
  const first = weatherPhases[0];
  const state = {
    phaseIndex: 0,
    phaseTime: 0,
    weather: first.id,
    label: first.label,
    sun: first.sun,
    wind: first.wind,
    rain: first.rain,
    temperature: first.temperature,
    moisture: 0.45,
    photosynthesis: 0,
    growth: 0,
  };
  state.photosynthesis = photosynthesisOf(state);

  // Advances the simulation and returns the new phase id when the weather
  // changes during this step, otherwise null.
  function step(dt) {
    let changed = null;
    state.phaseTime += dt;
    while (state.phaseTime >= weatherPhases[state.phaseIndex].duration) {
      state.phaseTime -= weatherPhases[state.phaseIndex].duration;
      state.phaseIndex = (state.phaseIndex + 1) % weatherPhases.length;
      changed = weatherPhases[state.phaseIndex].id;
    }
    const phase = weatherPhases[state.phaseIndex];
    state.weather = phase.id;
    state.label = phase.label;
    const settle = 1 - Math.exp(-dt / SETTLE);
    state.sun += (phase.sun - state.sun) * settle;
    state.wind += (phase.wind - state.wind) * settle;
    state.rain += (phase.rain - state.rain) * settle;
    state.temperature += (phase.temperature - state.temperature) * settle;
    state.moisture = clamp01(
      state.moisture +
        state.rain * MOISTURE_FROM_RAIN * dt -
        MOISTURE_LOSS * (0.4 + state.sun) * dt,
    );
    state.photosynthesis = photosynthesisOf(state);
    state.growth += state.photosynthesis * GROWTH_RATE * dt;
    return changed;
  }

  return { state, step };
}

// Light drives photosynthesis; dry roots and uncomfortable temperatures slow it.
export function photosynthesisOf({ sun, moisture, temperature }) {
  const water = clamp01(moisture * 1.6 + 0.2);
  const comfort = Math.max(0.2, 1 - Math.abs(temperature - 23) / 15);
  return clamp01(sun * water * comfort);
}

export function heightCm(state) {
  return BASE_HEIGHT_CM + state.growth;
}
