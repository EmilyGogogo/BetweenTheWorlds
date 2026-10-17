import { test, expect } from '@playwright/test';

// The game caps simulation updates at 50 ms per frame. Advance that clock one
// frame at a time so software WebGL speed cannot change the test's input timing.
async function advanceGame(page, milliseconds) {
  for (let remaining = milliseconds; remaining > 0; remaining -= 50) {
    await page.clock.fastForward(Math.min(50, remaining));
  }
}

test('built game supports exploration, switching and session-only state without network assets', async ({
  page,
}) => {
  const errors = [];
  const external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  const startTime = new Date('2026-10-17T00:00:00Z');
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '进入万物之间' }).click();
  await advanceGame(page, 1500);
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#sound')).toHaveText('声音 开');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('声音 关');

  await expect(page.locator('#invite')).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.locator('#companion-count')).toHaveText('1');
  const canvas = page.locator('#world');
  await expect(canvas).toHaveAttribute('data-position', /,/);
  const before = await canvas.getAttribute('data-position');
  await page.keyboard.down('w');
  try {
    await advanceGame(page, 1500);
  } finally {
    await page.keyboard.up('w');
  }
  const after = await canvas.getAttribute('data-position');
  expect(after).not.toBe(before);
  expect(Number(after.split(',')[1])).toBeLessThan(-1.2);
  await expect(page.locator('#encounter')).not.toHaveClass(/visible/);
  await advanceGame(page, 4500);
  await expect(page.locator('#encounter')).toHaveClass(/visible/);
  await expect(page.locator('#thought')).not.toHaveText('');

  for (const [key, name, speed] of [
    ['2', '一个人', 7],
    ['3', '一座岛屿', 15],
    ['4', '一颗星球', 38],
    ['1', '一株草', 1.65],
  ]) {
    await page.keyboard.press(key);
    // Input is locked during the 480 ms fade-out and 70 ms fade-in. Complete
    // those two timer stages while rendering each scene without extra ticks.
    await page.clock.fastForward(500);
    await page.clock.fastForward(150);
    await expect(page.locator('#world-name')).toHaveText(name);
    await expect(page.locator('#veil')).not.toHaveClass(/covered/);
    await expect(
      page.locator(`button[data-world="${Number(key) - 1}"]`),
    ).toHaveAttribute('aria-pressed', 'true');

    // Flush the 30-frame diagnostic sampler before reading each real position.
    // Measure input-driven displacement, rather than merely checking constants.
    await advanceGame(page, 1500);
    const origin = (await canvas.getAttribute('data-position'))
      .split(',')
      .map(Number);
    await page.keyboard.down('w');
    if (key === '4') await page.keyboard.down('d');
    try {
      await advanceGame(page, 1000);
    } finally {
      await page.keyboard.up('w');
      if (key === '4') await page.keyboard.up('d');
    }
    await advanceGame(page, 1500);
    const stoppedPosition = await canvas.getAttribute('data-position');
    const position = stoppedPosition.split(',').map(Number);
    const distance = Math.hypot(
      position[0] - origin[0],
      position[1] - origin[1],
    );
    // A fixed game second must retain the old speeds outside Earth. Earth's
    // diagonal must also be normalized, rather than gaining sqrt(2) speed.
    expect(distance, `${name} distance per game second`).toBeCloseTo(speed, 1);
    await advanceGame(page, 1500);
    expect(await canvas.getAttribute('data-position')).toBe(stoppedPosition);

    if (key === '4') {
      await page.keyboard.down('w');
      try {
        await advanceGame(page, 7000);
      } finally {
        await page.keyboard.up('w');
      }
      await advanceGame(page, 1500);
      const boundary = (await canvas.getAttribute('data-position'))
        .split(',')
        .map(Number);
      expect(Math.hypot(...boundary)).toBeCloseTo(200, 1);
    }
  }
  await expect(page.locator('#companion-count')).toHaveText('1');
  await page.locator('#help').click();
  await expect(page.locator('#help-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-panel')).toBeHidden();
  await expect(page.locator('#help')).toBeFocused();

  await page.reload();
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#companion-count')).toHaveText('0');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;
  const state = await page.locator('body').evaluate((body) => ({
    position: body.querySelector('#world')?.dataset.position,
    world: body.dataset.world,
    encounter: body.querySelector('#encounter')?.className,
    thought: body.querySelector('#thought')?.textContent,
    focused: body.ownerDocument.hasFocus(),
    visibility: body.ownerDocument.visibilityState,
  }));
  console.error('Browser smoke failure state:', JSON.stringify(state));
});
