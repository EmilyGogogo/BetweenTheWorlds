export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
export function summarizeFrames(frames) {
  if (frames.length < 2)
    throw new Error('Need at least two real rendered frames');
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (
      ![frame.timestamp, frame.calls, frame.geometries, frame.textures].every(
        Number.isFinite,
      )
    )
      throw new Error('Invalid frame data');
    if (i && frame.timestamp <= frames[i - 1].timestamp)
      throw new Error('Timestamps must increase');
  }
  const deltas = frames
      .slice(1)
      .map((f, i) => f.timestamp - frames[i].timestamp),
    sorted = [...deltas].sort((a, b) => a - b);
  const counts = (key) => ({
    start: frames[0][key],
    peak: Math.max(...frames.map((f) => f[key])),
    end: frames.at(-1)[key],
  });
  return {
    durationMs: frames.at(-1).timestamp - frames[0].timestamp,
    frames: frames.length,
    medianMs: median(deltas),
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    calls: {
      median: median(frames.map((f) => f.calls)),
      peak: Math.max(...frames.map((f) => f.calls)),
    },
    geometries: counts('geometries'),
    textures: counts('textures'),
  };
}
export function compareSamples(before, after) {
  if (before.length !== 3 || after.length !== 3)
    throw new Error(
      'Exactly three baseline and three after samples are required',
    );
  const canonical = (value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? JSON.stringify(
          Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          ),
        )
      : JSON.stringify(value);
  for (const group of [before, after])
    if (
      !group[0].version?.sourceHash ||
      group.some((s) => s.version?.sourceHash !== group[0].version.sourceHash)
    )
      throw new Error('Run versions differ or have no source fingerprint');
  const all = [...before, ...after];
  for (const sample of all) {
    if (
      !sample.valid ||
      sample.summary.durationMs < 60000 ||
      sample.summary.medianMs <= 0 ||
      sample.summary.p95Ms <= 0
    )
      throw new Error('Invalid or incomplete sample');
    if (canonical(sample.conditions) !== canonical(before[0].conditions))
      throw new Error('Conditions differ');
    const reported = sample.conditions.reportedEnvironment;
    if (
      !reported ||
      ['device', 'cpu', 'gpu', 'os', 'browserVersion', 'power'].some(
        (key) =>
          typeof reported[key] !== 'string' ||
          !reported[key].trim() ||
          reported[key] === 'unknown',
      ) ||
      !Number.isFinite(reported.memoryGiB) ||
      reported.memoryGiB <= 0 ||
      !Number.isFinite(reported.refreshHz) ||
      reported.refreshHz <= 0 ||
      reported.hardwareAcceleration !== true
    )
      throw new Error(
        'Environment evidence is incomplete or hardware acceleration unconfirmed',
      );
  }
  const increase = (key) =>
    (median(after.map((s) => s.summary[key])) /
      median(before.map((s) => s.summary[key])) -
      1) *
    100;
  const medianIncreasePct = increase('medianMs'),
    p95IncreasePct = increase('p95Ms');
  return {
    medianIncreasePct,
    p95IncreasePct,
    pass: medianIncreasePct <= 10 && p95IncreasePct <= 10,
  };
}
