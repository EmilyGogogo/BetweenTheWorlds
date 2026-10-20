import { test, expect } from '@playwright/test';

// The game caps simulation updates at 50 ms per frame. Advance that clock one
// frame at a time so software WebGL speed cannot change the test's input timing.
async function advanceGame(page, milliseconds) {
  for (let remaining = milliseconds; remaining > 0; remaining -= 50) {
    await page.clock.fastForward(Math.min(50, remaining));
  }
}

// Keep movement walks separate from the exploration smoke so every scene
// retains the existing per-test budget and every displacement assertion.
for (const [key, name, speed] of [
  // 默认阿禾沿用人物速度倍率 0.9。
  ['2', '一个人', 6.3],
  // 岛屿本体沿用现有的 25 场景单位/秒移动基线。
  ['3', '一座岛屿', 25],
  ['4', '一颗星球', 38],
  ['1', '一株草', 1.65],
]) {
  test(`movement in ${name} preserves speed, release and limits @full`, async ({
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

    const canvas = page.locator('#world');
    if (key !== '1') {
      await page.keyboard.press(key);
      await page.clock.fastForward(500);
      await page.clock.fastForward(150);
    }
    await expect(page.locator('#world-name')).toHaveText(name);
    await expect(page.locator('#veil')).not.toHaveClass(/covered/);
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

    if (key === '2') {
      await page.keyboard.down('Shift');
      await page.keyboard.down('w');
      try {
        await advanceGame(page, 1000);
      } finally {
        await page.keyboard.up('w');
        await page.keyboard.up('Shift');
      }
      await advanceGame(page, 1500);
      const sneakingPosition = (await canvas.getAttribute('data-position'))
        .split(',')
        .map(Number);
      expect(
        Math.hypot(
          sneakingPosition[0] - position[0],
          sneakingPosition[1] - position[1],
        ),
        '阿禾放轻脚步时保留 0.45 倍速度',
      ).toBeCloseTo(2.835, 1);
    }

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
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });
}
