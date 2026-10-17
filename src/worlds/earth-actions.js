// Earth-local arbitration; the shared label/null and feedback/null API stays intact.
export function installEarthActions(world, moon, sun) {
  function select(context) {
    if (!context.canInteract) return null;
    if (moon.getPrimaryAction(context)) return moon;
    if (sun.getPrimaryAction(context)) return sun;
    return null;
  }

  world.earthActions = { moon, sun };
  world.getPrimaryAction = (context) =>
    select(context)?.getPrimaryAction(context) ?? null;
  world.onPrimaryAction = (context) =>
    select(context)?.onPrimaryAction(context) ?? null;
  world.update = (context) => {
    moon.update(context);
    sun.update(context);
  };
}
