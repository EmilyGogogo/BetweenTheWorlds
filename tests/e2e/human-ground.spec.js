import { test, expect } from '@playwright/test';

test('human ground texture has no dark patches that repeat across the hills', async ({
  page,
}) => {
  // Load the production scene builder in an isolated page, without starting a
  // second game loop. Canvas pixels are measured directly; no screenshot baseline.
  // The import map mirrors index.html so the glTF loader can resolve "three".
  await page.route('**/ground-material-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><head><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script></head><body></body></html>',
    }),
  );
  await page.goto('/ground-material-probe');
  const luminance = await page.evaluate(async () => {
    const THREE = await import('/vendor/three.module.js');
    const { createWorldTools } = await import('/src/worlds/shared.js');
    const { makeHuman } = await import('/src/worlds/human.js');
    const renderer = new THREE.WebGLRenderer();
    try {
      const world = makeHuman(
        createWorldTools(renderer),
        Promise.resolve(new THREE.Group()),
      );
      const ground = world.scene.getObjectByName('human-ground');
      const image = ground.material.map.image;
      const pixels = image
        .getContext('2d')
        .getImageData(0, 0, image.width, image.height).data;
      const means = [];
      // 16 × 16 regions average out fine grass grain while retaining the broad
      // blotches that produced the reported repeating pattern.
      const step = image.width / 16;
      for (let y = 0; y < image.height; y += step) {
        for (let x = 0; x < image.width; x += step) {
          let sum = 0;
          for (let dy = 0; dy < step; dy++) {
            for (let dx = 0; dx < step; dx++) {
              const index = ((y + dy) * image.width + x + dx) * 4;
              sum +=
                0.2126 * pixels[index] +
                0.7152 * pixels[index + 1] +
                0.0722 * pixels[index + 2];
            }
          }
          means.push(sum / (step * step));
        }
      }
      return {
        darkest: Math.min(...means),
        lightest: Math.max(...means),
        mean: means.reduce((sum, value) => sum + value, 0) / means.length,
      };
    } finally {
      renderer.dispose();
    }
  });
  // The texture modulates an already green vertex colour: it must stay light
  // and its broad regions must differ by less than 10%, even when tiled.
  expect(luminance.darkest).toBeGreaterThan(180);
  expect(
    (luminance.lightest - luminance.darkest) / luminance.mean,
  ).toBeLessThan(0.1);
});
