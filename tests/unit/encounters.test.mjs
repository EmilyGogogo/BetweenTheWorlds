import assert from 'node:assert/strict';
import test from 'node:test';
import { sameKindEncounters } from '../../src/content/encounters.js';
import {
  DIALOGUE_CHOICE_KEYS,
  dialogueChoice,
  dialogueNode,
  rollSameKindEncounter,
} from '../../src/core/encounters.js';
import { rng } from '../../src/core/random.js';

test('same-kind encounters start at exactly thirty percent', () => {
  assert.equal(
    rollSameKindEncounter(() => 0.299999),
    true,
  );
  assert.equal(
    rollSameKindEncounter(() => 0.3),
    false,
  );

  const random = rng(2026);
  let encounters = 0;
  for (let i = 0; i < 50_000; i++) {
    if (rollSameKindEncounter(random)) encounters++;
  }
  const rate = encounters / 50_000;
  assert.ok(rate > 0.29 && rate < 0.31, `encounter rate ${rate}`);
});

test('every scale has a complete three-choice same-kind dialogue', () => {
  assert.equal(sameKindEncounters.length, 4);
  assert.equal(new Set(sameKindEncounters.map((entry) => entry.name)).size, 4);

  for (const entry of sameKindEncounters) {
    assert.match(entry.name, /同类|另一/);
    assert.equal(entry.source, '原创 · 万物之间');
    const opening = dialogueNode(entry, entry.start);
    assert.ok(opening, `${entry.name}: missing opening`);
    assert.equal(opening.choices?.length, DIALOGUE_CHOICE_KEYS.length);
    assert.equal(opening.choices.length, 3);

    opening.choices.forEach((choice, index) => {
      assert.ok(choice.text.length > 4, `${entry.name}: short reply`);
      assert.equal(dialogueChoice(opening, index), choice);
      const response = dialogueNode(entry, choice.next);
      assert.ok(response, `${entry.name}: missing response ${choice.next}`);
      assert.ok(response.end);
      assert.ok(response.text.length > 4, `${entry.name}: short response`);
    });
  }
});
