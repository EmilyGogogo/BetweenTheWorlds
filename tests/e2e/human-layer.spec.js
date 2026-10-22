import { test, expect } from '@playwright/test';
import { species } from '../../src/content/fauna.js';

test('human layer: first-person observation differs by character and survives switching', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  );
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: '进入万物之间' }).click();
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#naturalist')).toBeHidden();

  const canvas = page.locator('#world');
  await page.keyboard.press('2');
  await expect(page.locator('#world-name')).toHaveText('一个人');
  await expect(page.locator('#veil')).not.toHaveClass(/covered/);
  await expect(page.locator('#naturalist')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-view', 'first');
  await expect(canvas).toHaveAttribute('data-character', 'he');

  // 出生点正前方有一只陆龟，阿禾（昆虫视角）读到的是昆虫笔记。
  const tortoise = species.tortoise;
  await expect(page.locator('#observe-label')).toHaveText(
    `观察 · ${tortoise.name}`,
  );
  await page.keyboard.press('f');
  await expect(page.locator('#field-note')).toHaveClass(/visible/);
  await expect(page.locator('#field-note-text')).toContainText(
    tortoise.notes.insect,
  );
  await expect(page.locator('#field-note-meta')).toContainText('新记入');
  await expect(page.locator('#journal-count')).toHaveText(/^1 \//);

  // 人物面板：键盘打开，选中林雀，Escape 关闭后焦点回到人物按钮。
  await page.keyboard.press('c');
  await expect(page.locator('#character-panel')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-view', 'preview');
  await page.getByRole('radio', { name: /林雀/ }).click();
  await expect(page.getByRole('radio', { name: /林雀/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('#detail-flaw')).not.toHaveText('');
  await page.keyboard.press('Escape');
  await expect(page.locator('#character-panel')).toBeHidden();
  await expect(page.locator('#character-button')).toBeFocused();
  await expect(canvas).toHaveAttribute('data-character', 'que');
  await expect(page.locator('#journal-count')).toHaveText(/^0 \//);
  // 面板打开时会清空目标；关闭后等提示重新出现再观察。
  await expect(page.locator('#observe-hint')).toBeVisible();
  await expect(page.locator('#observe-label')).toHaveText(
    `观察 · ${tortoise.name}`,
  );

  await page.keyboard.press('f');
  await expect(page.locator('#field-note-text')).toContainText(
    tortoise.notes.bird,
  );

  await page.keyboard.press('q');
  await expect(page.locator('#binocular-mask')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-ability', 'binoculars');
  await page.keyboard.press('q');
  await expect(page.locator('#binocular-mask')).toBeHidden();
  await page.keyboard.press('v');
  await expect(canvas).toHaveAttribute('data-view', 'third');

  // 离开人层再回来：人物、视角与笔记都保留在本次会话里。
  await page.keyboard.press('1');
  await expect(page.locator('#world-name')).toHaveText('一株草');
  // The title updates before the final fade-in timer unlocks input. Wait for
  // that timer before sending another key, otherwise the return is ignored.
  await expect(page.locator('#veil')).not.toHaveClass(/covered/);
  await expect(page.locator('#naturalist')).toBeHidden();
  await expect(page.locator('#observe-hint')).toBeHidden();
  await page.keyboard.press('2');
  await expect(page.locator('#world-name')).toHaveText('一个人');
  await expect(page.locator('#veil')).not.toHaveClass(/covered/);
  await expect(page.locator('#character-name')).toHaveText('林雀');
  await expect(canvas).toHaveAttribute('data-view', 'third');
  await expect(page.locator('#journal-count')).toHaveText(/^1 \//);
  expect(errors).toEqual([]);
});
