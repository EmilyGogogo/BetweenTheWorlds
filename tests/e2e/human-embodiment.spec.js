import { test, expect } from '@playwright/test';

async function advanceGame(page, milliseconds) {
  for (let remaining = milliseconds; remaining > 0; remaining -= 50)
    await page.clock.fastForward(Math.min(50, remaining));
}

test('changing character keeps the human body available after inhabiting a rock', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const startTime = new Date('2026-10-17T00:00:00Z');
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.locator('#begin').click();
  await advanceGame(page, 1500);
  await page.keyboard.press('2');
  await advanceGame(page, 1500);
  const canvas = page.locator('#world');
  const ripple = page.locator('#soul-ripple');
  await page.keyboard.press('c');
  await advanceGame(page, 1500);
  await expect(page.locator('#character-panel')).toBeVisible();
  const beforePanel = await canvas.getAttribute('data-position');
  await page.keyboard.press('r');
  await page.keyboard.press('3');
  await page.keyboard.down('w');
  await advanceGame(page, 1500);
  await page.keyboard.up('w');
  await expect(page.locator('#world-name')).toHaveText('一个人');
  await expect(canvas).toHaveAttribute('data-position', beforePanel);
  await expect(ripple).toBeHidden();
  await page.getByRole('radio', { name: /林雀/ }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  await page.keyboard.down('w');
  await advanceGame(page, 1500);
  await page.keyboard.up('w');
  await advanceGame(page, 1500);
  const humanPosition = await canvas.getAttribute('data-position');
  expect(humanPosition).not.toBe(beforePanel);
  await expect(ripple).toBeVisible();
  const targetName = await canvas.getAttribute('data-soul-target');
  expect(['岩石', '老树']).toContain(targetName);
  await page.keyboard.press('r');
  await advanceGame(page, 1500);
  await expect(page.locator('#world-name')).toHaveText(targetName);
  await expect(page.locator('#naturalist')).toBeHidden();
  await expect(page.locator('#observe-hint')).toBeHidden();
  await expect(page.locator('#binocular-mask')).toBeHidden();
  await page.keyboard.press('c');
  await page.keyboard.press('q');
  await page.keyboard.press('f');
  await expect(page.locator('#character-panel')).toBeHidden();
  await expect(page.locator('#binocular-mask')).toBeHidden();
  await expect(page.locator('#field-note')).not.toHaveClass(/visible/);

  // Turn through a full circle with real pointer input to find the body left behind.
  for (let turn = 0; turn < 20; turn++) {
    if ((await canvas.getAttribute('data-soul-target')) === '一个人') break;
    await page.mouse.move(480, 320);
    await page.mouse.down();
    await page.mouse.move(400, 320);
    await page.mouse.up();
    await advanceGame(page, 500);
  }
  await expect(canvas).toHaveAttribute('data-soul-target', '一个人');
  await page.keyboard.press('r');
  await advanceGame(page, 1500);
  await expect(page.locator('#world-name')).toHaveText('一个人');
  await expect(page.locator('#naturalist')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-character', 'que');
  await expect(canvas).toHaveAttribute('data-position', humanPosition);
  await page.keyboard.down('d');
  await advanceGame(page, 1500);
  await page.keyboard.up('d');
  expect(await canvas.getAttribute('data-position')).not.toBe(humanPosition);
  expect(errors).toEqual([]);
});
