export function updateActionContext(context, started, switching, helpOpen, dt) {
  const allowed = started && !switching && !helpOpen;
  context.canInteract = allowed;
  context.canSimulate = allowed;
  context.dt = dt;
}

export function performPrimaryAction({
  active,
  world,
  context,
  repeat,
  recruit,
}) {
  if (repeat || !context.canInteract) return null;
  if (active === 0 || world.controlled?.kind === 'island') {
    recruit();
    return null;
  }
  // A rejected Earth action never falls through to grass recruitment.
  return world.onPrimaryAction?.(context) ?? null;
}

export function primaryActionLabel(active, world, context, nearGrass) {
  if (!context.canInteract) return null;
  if (active === 0 || active === 2)
    return nearGrass
      ? active === 2
        ? '邀请这座岛一起漂流'
        : '邀请这株草一起走'
      : null;
  return world.getPrimaryAction?.(context)?.label ?? null;
}

export function renderPrimaryAction(element, labelElement, label) {
  if (label && labelElement.textContent !== label)
    labelElement.textContent = label;
  const hidden = !label;
  if (element.classList.contains('hidden') !== hidden)
    element.classList.toggle('hidden', hidden);
}
