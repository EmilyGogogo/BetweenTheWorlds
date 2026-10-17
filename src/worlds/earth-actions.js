// Earth-local arbitration; the shared label/null and feedback/null API stays intact.
export function installEarthActions(
  world,
  moon,
  sun,
  ringedPlanet = null,
  { visualUpdate = null } = {},
) {
  function select(context) {
    if (!context.canInteract) return null;
    if (moon.getPrimaryAction(context)) return moon;
    if (sun.getPrimaryAction(context)) return sun;
    if (ringedPlanet?.getPrimaryAction(context)) return ringedPlanet;
    return null;
  }

  world.earthActions = { moon, sun, ringedPlanet };
  world.getPrimaryAction = (context) =>
    select(context)?.getPrimaryAction(context) ?? null;
  world.onPrimaryAction = (context) =>
    select(context)?.onPrimaryAction(context) ?? null;
  world.update = (context) => {
    ringedPlanet?.update(context);
    moon.update(context);
    sun.update(context);
    visualUpdate?.(context);
  };
  if (ringedPlanet)
    world.getMovementInfluence = (context, out) =>
      ringedPlanet.getMovementInfluence(context, out);
}
