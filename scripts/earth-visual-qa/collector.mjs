/* global document, innerWidth, innerHeight, devicePixelRatio, matchMedia, addEventListener */
import { summarizeFrames } from './metrics.js';

// Only the manual QA server imports this module. No extra RAF, automated key
// input, network upload, wall-clock substitution or GPU/heap claim is involved.
export function installManualVisualQA({ renderer, readState, version }) {
  const panel = document.createElement('aside');
  Object.assign(panel.style, {
    position: 'fixed',
    right: '12px',
    top: '145px',
    zIndex: '100',
    background: '#080e1ff5',
    color: '#f1eedf',
    border: '1px solid #aaa',
    padding: '12px',
    font: '12px/1.6 sans-serif',
    width: '300px',
  });
  const title = document.createElement('strong');
  title.textContent = `视觉手验采样 · ${version.label}`;
  const status = document.createElement('div');
  status.textContent = '先进入游戏，依次按1–4，每层保持至少3秒至资源计数稳定。';
  const device = document.createElement('textarea');
  device.rows = 3;
  device.value = JSON.stringify({
    device: 'unknown',
    cpu: 'unknown',
    gpu: 'unknown',
    memoryGiB: 'unknown',
    os: 'unknown',
    browserVersion: 'unknown',
    refreshHz: 'unknown',
    power: 'unknown',
    hardwareAcceleration: 'unknown',
  });
  device.style.width = '100%';
  device.setAttribute(
    'aria-label',
    '环境JSON：未知字段保留unknown；完整性能验收前补齐',
  );
  const start = document.createElement('button');
  start.textContent = '开始60秒实帧采样';
  const save = document.createElement('button');
  save.textContent = '保存当前记录 JSON';
  panel.append(title, status, device, start, save);
  document.body.append(panel);
  const context = renderer.getContext(),
    debug = context.getExtension('WEBGL_debug_renderer_info');
  const gpu = debug
    ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL)
    : 'unknown';
  const reportedEnvironment = () => {
    try {
      return JSON.parse(device.value);
    } catch {
      return { note: device.value, invalidJSON: true };
    }
  };
  const environment = () => ({
    reportedEnvironment: reportedEnvironment(),
    userAgent: navigator.userAgent,
    gpu,
    viewport: [innerWidth, innerHeight],
    systemDPR: devicePixelRatio,
    rendererDPR: renderer.getPixelRatio(),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    audio: readState().audio,
    quality: 'standard',
    collectorVersion: 1,
  });
  const attempts = [],
    warm = {},
    stable = {};
  let current = null;
  const stateOf = () => readState();
  function invalidate(reason) {
    if (current && !current.errors.includes(reason))
      current.errors.push(reason);
  }
  const hidden = () => {
    if (document.hidden) invalidate('page-hidden');
  };
  document.addEventListener('visibilitychange', hidden);
  addEventListener('blur', () => invalidate('focus-lost'));
  addEventListener('resize', () => invalidate('viewport-changed'));
  start.onclick = () => {
    const state = stateOf();
    if (current) return;
    if (
      Object.keys(warm).length !== 4 ||
      state.active !== 3 ||
      !state.started ||
      state.help ||
      state.switching ||
      state.moon !== 'available' ||
      state.sun !== 'ready' ||
      state.ring !== 'ready' ||
      Math.hypot(state.x, state.z) > 0.05 ||
      Math.abs(state.yaw - 0.22) > 1e-6 ||
      Math.abs(state.pitch - 0.13) > 1e-6 ||
      state.zoom !== 1
    ) {
      status.textContent =
        '请预热四层后回到初始Earth，不按E/拖镜头；如已移动请刷新重来。';
      return;
    }
    current = {
      version,
      conditions: environment(),
      warmup: structuredClone(warm),
      startedAt: new Date().toISOString(),
      initial: state,
      frames: [],
      errors: [],
    };
    start.disabled = true;
  };
  function download(record) {
    const blob = new Blob([JSON.stringify(record, null, 2)], {
        type: 'application/json',
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = `earth-visual-${version.label}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  save.onclick = () =>
    download({
      version,
      environment: environment(),
      warmup: warm,
      attempts,
      current,
    });
  return {
    frame(timestamp) {
      if (!Number.isFinite(timestamp)) return;
      const state = stateOf(),
        info = renderer.info,
        signature = `${info.memory.geometries}/${info.memory.textures}`;
      if (state.started && !state.switching && !state.help) {
        if (stable[state.active]?.signature !== signature) {
          stable[state.active] = { signature, since: timestamp };
          delete warm[state.active];
        }
        const entry = stable[state.active];
        if (timestamp - entry.since >= 3000 && !warm[state.active])
          warm[state.active] = {
            world: state.active,
            stableForMs: timestamp - entry.since,
            geometry: info.memory.geometries,
            textures: info.memory.textures,
            completedAtMs: timestamp,
          };
      }
      if (!current) return;
      const frames = current.frames;
      if (frames.length && timestamp <= frames.at(-1).timestamp) {
        invalidate('non-monotonic-frame');
        return;
      }
      const t = frames.length ? (timestamp - frames[0].timestamp) / 1000 : 0;
      const phase =
        t < 20 || t >= 40
          ? '松开所有方向键'
          : Math.floor((t - 20) / 2) % 2 === 0
            ? '按住 W'
            : '按住 S';
      status.textContent = `${Math.min(60, t).toFixed(1)} / 60秒：${phase}；预热${Object.keys(warm).length}/4`;
      if (state.active !== 3 || state.switching || state.help)
        invalidate('world-or-pause-changed');
      if (
        state.moon !== 'available' ||
        state.sun !== 'ready' ||
        state.ring !== 'ready'
      )
        invalidate('relationship-changed');
      if (
        state.yaw !== current.initial.yaw ||
        state.pitch !== current.initial.pitch ||
        state.zoom !== current.initial.zoom
      )
        invalidate('camera-changed');
      if (devicePixelRatio !== current.conditions.systemDPR)
        invalidate('dpr-changed');
      if (state.audio !== current.conditions.audio) invalidate('audio-changed');
      if (
        matchMedia('(prefers-reduced-motion: reduce)').matches !==
        current.conditions.reducedMotion
      )
        invalidate('reduced-motion-changed');
      // Human reaction is recorded, never silently repaired. Deviations outside
      // a declared 350ms window around each 2-second route cue invalidate a run.
      const nearCue =
        t >= 19.65 &&
        t <= 40.35 &&
        Math.abs(t - 20 - Math.round((t - 20) / 2) * 2) <= 0.35;
      const keys = state.keys
        .filter((k) =>
          [
            'KeyW',
            'KeyS',
            'KeyA',
            'KeyD',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
          ].includes(k),
        )
        .sort();
      const expected =
        t >= 20 && t < 40
          ? [Math.floor((t - 20) / 2) % 2 === 0 ? 'KeyW' : 'KeyS']
          : [];
      if (!nearCue && JSON.stringify(keys) !== JSON.stringify(expected))
        invalidate('route-deviation');
      frames.push({
        timestamp,
        intervalMs: frames.length ? timestamp - frames.at(-1).timestamp : null,
        calls: info.render.calls,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        x: state.x,
        z: state.z,
        keys,
      });
      if (t >= 60) {
        current.final = state;
        current.endedAt = new Date().toISOString();
        current.summary = summarizeFrames(frames);
        current.valid = current.errors.length === 0;
        attempts.push(current);
        status.textContent = current.valid
          ? '已采满60秒，保存JSON；下一轮刷新并重新预热。'
          : `无效但保留：${current.errors.join(', ')}。保存后重采。`;
        download({ version, attempts });
        current = null;
        start.disabled = false;
      }
    },
  };
}
