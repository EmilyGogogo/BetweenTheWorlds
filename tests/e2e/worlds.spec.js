import { test, expect } from '@playwright/test';

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
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '进入万物之间' }).click();
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
    await expect
      .poll(() => canvas.getAttribute('data-position'))
      .not.toBe(before);
    await expect
      .poll(async () =>
        Number((await canvas.getAttribute('data-position')).split(',')[1]),
      )
      .toBeLessThan(-1.2);
  } finally {
    await page.keyboard.up('w');
  }
  // The simulation caps each frame's delta, so software WebGL can run slower
  // than wall time. Keep the real dialogue assertion and allow for that rate.
  await expect(page.locator('#encounter')).toHaveClass(/visible/, {
    timeout: 120_000,
  });
  await expect(page.locator('#thought')).not.toHaveText('');

  for (const [key, name] of [
    ['2', '一个人'],
    ['3', '一座岛屿'],
    ['4', '一颗星球'],
    ['1', '一株草'],
  ]) {
    await page.keyboard.press(key);
    await expect(page.locator('#world-name')).toHaveText(name);
    await expect(page.locator('#veil')).not.toHaveClass(/covered/);
    await expect(
      page.locator(`button[data-world="${Number(key) - 1}"]`),
    ).toHaveAttribute('aria-pressed', 'true');
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
