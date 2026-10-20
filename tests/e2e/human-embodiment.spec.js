import { test, expect } from '@playwright/test';

// Input and body ownership use real WebGL at the usual CSS viewport.
// Reduce rasterization cost; these cases do not assess image quality.
test.use({ deviceScaleFactor: 0.25, reducedMotion: 'reduce' });

async function advanceFrames(page, frames = 30) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        function tick() {
          if (--count <= 0) resolve();
          else globalThis.requestAnimationFrame(tick);
        }
        globalThis.requestAnimationFrame(tick);
      }),
    frames,
  );
}

async function startHuman(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.locator('#begin').click();
  await expect(page.locator('#welcome')).toBeHidden();
  await page.keyboard.press('2');
  await expect(page.locator('#naturalist')).toBeVisible();
  await expect(page.locator('#veil')).not.toHaveClass(/covered/);
  const canvas = page.locator('#world');
  await expect(canvas).toHaveAttribute(
    'data-position',
    /^-?\d+\.\d+,-?\d+\.\d+$/,
  );
  return { canvas, errors };
}

async function selectBirdwatcher(page) {
  await page.keyboard.press('c');
  await expect(page.locator('#character-panel')).toBeVisible();
  await page.getByRole('radio', { name: /林雀/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#character-panel')).toBeHidden();
  await page.keyboard.press('v');
  await page.locator('#world').focus();
}

test('character panel blocks movement, scale changes and R before the selected body moves', async ({
  page,
}) => {
  const { canvas, errors } = await startHuman(page);
  await page.keyboard.press('c');
  await expect(page.locator('#character-panel')).toBeVisible();
  const before = await canvas.getAttribute('data-position');
  await page.keyboard.press('r');
  await page.keyboard.press('3');
  await page.keyboard.down('w');
  await advanceFrames(page);
  await page.keyboard.up('w');
  await expect(page.locator('#world-name')).toHaveText('一个人');
  await expect(canvas).toHaveAttribute('data-position', before);
  await expect(page.locator('#soul-ripple')).toBeHidden();
  await page.getByRole('radio', { name: /林雀/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  await canvas.focus();
  await page.keyboard.down('w');
  await advanceFrames(page);
  await page.keyboard.up('w');
  await advanceFrames(page);
  expect(await canvas.getAttribute('data-position')).not.toBe(before);
  expect(errors).toEqual([]);
});

test.describe.serial('selected human body round trip', () => {
  let page, canvas, errors, humanPosition;
  let yaw = 0.22;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({
      baseURL: 'http://127.0.0.1:4173',
      viewport: { width: 960, height: 640 },
      deviceScaleFactor: 0.25,
      reducedMotion: 'reduce',
    });
    ({ canvas, errors } = await startHuman(page));
    await selectBirdwatcher(page);
    const before = await canvas.getAttribute('data-position');
    await page.keyboard.down('w');
    await advanceFrames(page, 15);
    await page.keyboard.up('w');
    await advanceFrames(page);
    humanPosition = await canvas.getAttribute('data-position');
    expect(humanPosition).not.toBe(before);
  });
  test.afterAll(async () => {
    await page?.close();
  });
  async function lookToward(x, z, from) {
    const [px, pz] = from;
    const next = Math.atan2(px - x, pz - z);
    let turn = Math.atan2(Math.sin(next - yaw), Math.cos(next - yaw));
    while (Math.abs(turn) > 0.001) {
      const step = Math.max(-0.4, Math.min(0.4, turn));
      await page.mouse.move(480, 320);
      await page.mouse.down();
      await page.mouse.move(480 - step / 0.005, 320);
      await page.mouse.up();
      turn -= step;
    }
    yaw = next;
    await advanceFrames(page, 10);
  }

  test('inhabiting a rock suspends character controls and observation', async () => {
    await lookToward(10, -16, humanPosition.split(',').map(Number));
    await expect(canvas).toHaveAttribute('data-soul-target', '岩石');
    await expect(page.locator('#soul-ripple')).toBeVisible();
    await page.keyboard.press('r');
    await advanceFrames(page);
    await expect(page.locator('#world-name')).toHaveText('岩石');
    await expect(page.locator('#naturalist')).toBeHidden();
    await expect(page.locator('#observe-hint')).toBeHidden();
    await expect(page.locator('#binocular-mask')).toBeHidden();
    await page.keyboard.press('c');
    await page.keyboard.press('q');
    await page.keyboard.press('f');
    await expect(page.locator('#character-panel')).toBeHidden();
    await expect(page.locator('#binocular-mask')).toBeHidden();
    await expect(page.locator('#field-note')).not.toHaveClass(/visible/);

    expect(errors).toEqual([]);
  });
  test('returning restores the selected character, position and movement', async () => {
    await lookToward(...humanPosition.split(',').map(Number), [10, -16]);
    await expect(canvas).toHaveAttribute('data-soul-target', '一个人');
    await page.keyboard.press('r');
    await advanceFrames(page);
    await expect(page.locator('#world-name')).toHaveText('一个人');
    await expect(page.locator('#naturalist')).toBeVisible();
    await expect(canvas).toHaveAttribute('data-character', 'que');
    await expect(canvas).toHaveAttribute('data-position', humanPosition);
    await page.keyboard.down('d');
    await advanceFrames(page);
    await page.keyboard.up('d');
    expect(await canvas.getAttribute('data-position')).not.toBe(humanPosition);
    expect(errors).toEqual([]);
  });
});
