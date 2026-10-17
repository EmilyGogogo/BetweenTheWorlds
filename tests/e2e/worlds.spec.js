import { test, expect } from '@playwright/test';

// The game caps simulation updates at 50 ms per frame. Advance that clock one
// frame at a time so software WebGL speed cannot change the test's input timing.
async function advanceGame(page, milliseconds) {
  for (let remaining = milliseconds; remaining > 0; remaining -= 50) {
    await page.clock.fastForward(Math.min(50, remaining));
  }
}

async function dismissDialogue(page) {
  if (await page.locator('#dialogue').isVisible()) {
    await page.keyboard.press('Escape');
    await advanceGame(page, 100);
  }
  await expect(page.locator('#dialogue')).toBeHidden();
}

async function exerciseSameKindDialogue(page, name) {
  await advanceGame(page, 650);
  if (!(await page.locator('#dialogue').isVisible())) {
    await expect(page.locator('#same-kind')).toBeVisible();
    await page.keyboard.press('r');
  }
  await expect(page.locator('#dialogue')).toBeVisible();
  await expect(page.locator('#dialogue-speaker')).toHaveText(`${name} · 同类`);
  await expect(page.locator('#dialogue-source')).toHaveText('原创 · 万物之间');
  await expect(page.locator('#dialogue-choices button')).toHaveCount(3);
  const opening = await page.locator('#dialogue-line').textContent();
  await page.keyboard.press('a');
  await expect(page.locator('#dialogue-reply')).toHaveText(/^你：/);
  await expect(page.locator('#dialogue-line')).not.toHaveText(opening ?? '');
  await expect(page.locator('#dialogue-choices button')).toHaveCount(0);
  await dismissDialogue(page);
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
  await dismissDialogue(page);

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

  for (const [key, name, sameKind] of [
    ['2', '一个人', '另一个旅人'],
    ['3', '一座岛屿', '另一座岛'],
    ['4', '一颗星球', '另一颗星球'],
    ['1', '一株草', '另一株草'],
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
    await exerciseSameKindDialogue(page, sameKind);
    if (key === '1') await expect(page.locator('#senses')).toBeVisible();
    else {
      await expect(page.locator('#senses')).toBeHidden();
      await expect(page.locator('#feeling')).not.toHaveClass(/visible/);
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
