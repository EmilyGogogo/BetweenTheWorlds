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

  await expect(page.locator('#senses')).toBeVisible();
  await expect(page.locator('#sense-weather')).toHaveText('晴');
  await expect(page.locator('#sense-height')).toHaveText(/厘米$/);
  await page.keyboard.press('f');
  await expect(page.locator('#feeling')).toHaveClass(/visible/);
  await expect(page.locator('#feeling-speaker')).toHaveText(/^你/);
  await expect(page.locator('#feeling-text')).not.toHaveText('');
  await expect(page.locator('#feeling-source')).toHaveText(/原创|启发/);
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
    // 岛屿本体沿用现有的 25 场景单位/秒移动基线。
    ['3', '一座岛屿', 25],
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

    if (key === '2') {
      // The human avatar is a real glTF download; keep rendering frames until
      // the scene reports the model attached, or fail if it never does.
      await expect
        .poll(
          async () => {
            await advanceGame(page, 200);
            return canvas.getAttribute('data-avatar');
          },
          { timeout: process.env.CI ? 120_000 : 60_000 },
        )
        .toBe('ready');
    }
    if (key === '1') await expect(page.locator('#senses')).toBeVisible();
    else {
      await expect(page.locator('#senses')).toBeHidden();
      await expect(page.locator('#feeling')).not.toHaveClass(/visible/);
    }

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

test('looking toward the sun offers a ripple and R enters the actual solar body', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const startTime = new Date('2026-10-17T00:00:00Z');
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.goto('/');
  await page.locator('#begin').click();
  await advanceGame(page, 1500);
  // Orbit using the real pointer, then look up from the grass toward the sun.
  await page.mouse.move(480, 320);
  await page.mouse.down();
  await page.mouse.move(434, 220, { steps: 10 });
  await page.mouse.up();
  await advanceGame(page, 1500);
  await expect(page.locator('#world')).toHaveAttribute(
    'data-soul-target',
    '太阳',
  );
  await expect(page.locator('#soul-ripple')).toBeVisible();
  await page.keyboard.press('r');
  await advanceGame(page, 1500);
  await expect(page.locator('body')).toHaveAttribute('data-world', '3');
  await expect(page.locator('#world-name')).toHaveText('太阳');
  await expect(page.locator('#world')).toHaveAttribute('data-entity', 'sun');
  expect(errors).toEqual([]);
});

test('a seagull can approach the fish ripple, become a fish and explore underwater', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const startTime = new Date('2026-10-17T00:00:00Z');
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.goto('/?world=island');
  await page.locator('#begin').click();
  await advanceGame(page, 1500);
  const canvas = page.locator('#world');
  await expect(canvas).toHaveAttribute('data-soul-target', '海鸥');
  await page.keyboard.press('r');
  await advanceGame(page, 1500);
  await expect(canvas).toHaveAttribute('data-entity', 'bird');
  async function move(key, duration) {
    await page.keyboard.down(key);
    try {
      await advanceGame(page, duration);
    } finally {
      await page.keyboard.up(key);
    }
  }
  const birdBefore = await canvas.getAttribute('data-position');
  await move('d', 3000);
  const birdAfter = await canvas.getAttribute('data-position');
  expect(
    Number(birdAfter.split(',')[0]) - Number(birdBefore.split(',')[0]),
  ).toBeGreaterThan(75);
  await move('ShiftLeft', 2500);
  await expect(canvas).toHaveAttribute('data-soul-target', /^银鳍鱼/);
  await page.keyboard.press('r');
  await advanceGame(page, 1500);
  await expect(canvas).toHaveAttribute('data-entity', 'fish');
  await move('ShiftLeft', 1500);
  expect(Number(await canvas.getAttribute('data-altitude'))).toBeLessThan(-5);
  const fishBefore = await canvas.getAttribute('data-position');
  await move('w', 1500);
  expect(await canvas.getAttribute('data-position')).not.toBe(fishBefore);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('R enters the rippling body directly in all four scales, without a selector', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const startTime = new Date('2026-10-17T00:00:00Z');
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  // R before entering the game has no effect.
  await page.keyboard.press('r');
  await expect(page.locator('#world-name')).toHaveText('一株草');
  await expect(page.locator('#soul-ripple')).toBeHidden();
  await page.locator('#begin').click();
  await advanceGame(page, 1500);
  const canvas = page.locator('#world');
  const ripple = page.locator('#soul-ripple');
  async function enterRipple() {
    await expect(ripple).toBeVisible();
    const name = await canvas.getAttribute('data-soul-target');
    expect(name).toBeTruthy();
    await expect(ripple).toHaveText('');
    await page.keyboard.press('r');
    await advanceGame(page, 1500);
    await expect(page.locator('#world-name')).toHaveText(name);
    // Help and welcome are the only dialogs in the scene.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  async function move(key, duration = 1500) {
    await page.keyboard.down(key);
    try {
      await advanceGame(page, duration);
    } finally {
      await page.keyboard.up(key);
    }
  }
  await enterRipple();
  const grassBefore = await canvas.getAttribute('data-position');
  await move('w');
  expect(await canvas.getAttribute('data-position')).not.toBe(grassBefore);
  await page.keyboard.press('2');
  await advanceGame(page, 1500);
  await enterRipple();
  const treeBefore = await canvas.getAttribute('data-position');
  await move('w');
  expect(await canvas.getAttribute('data-position')).not.toBe(treeBefore);
  await page.keyboard.press('3');
  await advanceGame(page, 1500);
  await expect(page.locator('#invite')).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.locator('#companion-count')).toHaveText('1');
  await enterRipple();
  await expect(canvas).toHaveAttribute('data-entity', 'bird');
  const altitude = Number(await canvas.getAttribute('data-altitude'));
  await move('Space');
  expect(Number(await canvas.getAttribute('data-altitude'))).toBeGreaterThan(
    altitude + 4,
  );
  await page.keyboard.press('4');
  await advanceGame(page, 1500);
  await enterRipple();
  const spaceBefore = await canvas.getAttribute('data-position');
  await move('d');
  expect(await canvas.getAttribute('data-position')).not.toBe(spaceBefore);
  await page.keyboard.press('3');
  await advanceGame(page, 1500);
  await expect(canvas).toHaveAttribute('data-entity', 'bird');
  await expect(page.locator('#companion-count')).toHaveText('1');
  await page.locator('#help').click();
  await advanceGame(page, 650);
  await expect(ripple).toBeHidden();
  const beforeHelp = await page.locator('#world-name').textContent();
  await page.keyboard.press('r');
  await expect(page.locator('#world-name')).toHaveText(beforeHelp);
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-panel')).toBeHidden();
  expect(errors).toEqual([]);
});
