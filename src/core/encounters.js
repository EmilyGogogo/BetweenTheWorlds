export const SAME_KIND_ENCOUNTER_CHANCE = 0.3;
export const DIALOGUE_CHOICE_KEYS = ['A', 'B', 'C'];

export function rollSameKindEncounter(
  random,
  chance = SAME_KIND_ENCOUNTER_CHANCE,
) {
  return random() < chance;
}

export function dialogueNode(dialogue, nodeId) {
  return dialogue.nodes[nodeId] ?? null;
}

export function dialogueChoice(node, index) {
  return node?.choices?.[index] ?? null;
}
