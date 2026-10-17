import { createWorldFactory } from '../../src/worlds/index.js';

// Only the procedural texture's paint calls are stubbed. The factory, Three.js
// graph, callbacks and transforms are real; no rendering or visual claim is made.
export function withCanvas(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const context = Object.fromEntries(
    [
      'fillRect',
      'beginPath',
      'lineTo',
      'moveTo',
      'closePath',
      'fill',
      'ellipse',
    ].map((name) => [name, () => {}]),
  );
  context.createLinearGradient = () => ({ addColorStop() {} });
  context.createRadialGradient = () => ({ addColorStop() {} });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ getContext: () => context }) },
  });
  try {
    return run();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
}

export function createEarth() {
  return withCanvas(() =>
    createWorldFactory({
      capabilities: { getMaxAnisotropy: () => 8 },
    }).builders[3](),
  );
}
