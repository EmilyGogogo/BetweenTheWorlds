import assert from 'node:assert/strict';
import test from 'node:test';
import {
  updateActionContext,
  performPrimaryAction,
  primaryActionLabel,
  renderPrimaryAction,
} from '../../src/core/world-actions.js';

test('shared context blocks welcome/help/transitions for both action and orbit', () => {
  const context = { reducedMotion: true };
  for (const started of [false, true])
    for (const switching of [false, true])
      for (const helpOpen of [false, true]) {
        updateActionContext(context, started, switching, helpOpen, 0.05);
        const allowed = started && !switching && !helpOpen;
        assert.equal(context.canInteract, allowed);
        assert.equal(context.canSimulate, allowed);
        assert.equal(context.dt, 0.05);
        assert.equal(context.reducedMotion, true);
      }
});

test('E routing isolates grass, Earth, optional worlds and blocked/repeated keys', () => {
  let grassCalls = 0;
  let earthCalls = 0;
  const recruit = () => grassCalls++;
  const world = {
    onPrimaryAction(context) {
      assert.equal(context.canInteract, true);
      earthCalls++;
      return 'joined';
    },
  };
  const context = { canInteract: true };
  const input = { active: 3, world, context, repeat: false, recruit };
  for (const active of [0, 1, 2, 3]) {
    assert.equal(
      performPrimaryAction({ ...input, active, repeat: true }),
      null,
    );
    assert.equal(
      performPrimaryAction({
        ...input,
        active,
        context: { canInteract: false },
      }),
      null,
    );
  }
  assert.equal(grassCalls, 0);
  assert.equal(earthCalls, 0);
  assert.equal(performPrimaryAction({ ...input, active: 0 }), null);
  assert.equal(grassCalls, 1);
  assert.equal(earthCalls, 0);
  assert.equal(performPrimaryAction(input), 'joined');
  assert.equal(earthCalls, 1);
  world.onPrimaryAction = () => null;
  assert.equal(performPrimaryAction(input), null);
  for (const active of [1, 2]) {
    assert.equal(performPrimaryAction({ ...input, active, world: {} }), null);
  }
  assert.equal(grassCalls, 1);
});

test('prompts respect activity and live eligibility without changing state', () => {
  let eligible = true;
  const world = {
    getPrimaryAction: () => (eligible ? { label: '邀请月亮同行' } : null),
  };
  const context = { canInteract: true };
  assert.equal(primaryActionLabel(3, world, context, null), '邀请月亮同行');
  eligible = false;
  assert.equal(primaryActionLabel(3, world, context, null), null);
  assert.equal(primaryActionLabel(0, {}, context, {}), '邀请这株草一起走');
  assert.equal(primaryActionLabel(0, {}, context, null), null);
  assert.equal(primaryActionLabel(1, {}, context, null), null);
  assert.equal(primaryActionLabel(2, {}, context, null), null);
  assert.equal(primaryActionLabel(0, {}, { canInteract: false }, {}), null);
});

test('prompt DOM adapter hides immediately and only writes when text/visibility changes', () => {
  let hidden = true;
  let text = '邀请这株草一起走';
  let writes = 0;
  const element = {
    classList: {
      contains: () => hidden,
      toggle(_name, value) {
        hidden = value;
        writes++;
      },
    },
  };
  const label = {
    get textContent() {
      return text;
    },
    set textContent(value) {
      text = value;
      writes++;
    },
  };
  renderPrimaryAction(element, label, '邀请月亮同行');
  assert.equal(text, '邀请月亮同行');
  assert.equal(hidden, false);
  assert.equal(writes, 2);
  for (let i = 0; i < 100; i++) renderPrimaryAction(element, label, text);
  assert.equal(writes, 2);
  renderPrimaryAction(element, label, null);
  assert.equal(hidden, true);
  assert.equal(writes, 3);
  renderPrimaryAction(element, label, '邀请这株草一起走');
  assert.equal(text, '邀请这株草一起走');
  assert.equal(hidden, false);
});
