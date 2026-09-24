/* Radius-relative inspection zoom. Public model-viewer API only.
 * Native zoom also changes field of view and uses the complete orbit range;
 * that makes a single wheel notch jump too far when inspecting a fitting.
 */
const bound = (value, min, max) => Math.max(min, Math.min(max, value));
export function zoomRate(radius) {
  const t = bound((radius - .5) / 4.5, 0, 1);
  return .012 + .038 * t * t * (3 - 2 * t);
}
export function wheelUnits(event, height = 800) {
  const vertical = Number(event.deltaY);
  // Some browsers expose Shift + vertical wheel as horizontal wheel input.
  const delta = event.shiftKey && vertical === 0 ? Number(event.deltaX) : vertical;
  if (!Number.isFinite(delta)) return 0;
  const scale = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? height : 1;
  return bound(delta * scale, -120, 120) / 100;
}
export function attachPrecisionZoom(model, options = {}) {
  const min = options.minRadius ?? .35, max = options.maxRadius ?? 45;
  const ready = options.isReady || (() => model.loaded);
  const doc = model.ownerDocument || document;
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups = [], pointers = new Map();
  let goal = null, frame = null, last = 0, destroyed = false;
  const previousSensitivity = model.zoomSensitivity;
  // Keep native rotation, tap-to-centre and two-finger pan, but own the zoom.
  model.zoomSensitivity = 0;
  const listen = (node, name, fn, config) => {
    node.addEventListener(name, fn, config);
    cleanups.push(() => node.removeEventListener(name, fn, config));
  };
  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; goal = null; last = 0;
  }
  function writeRadius(radius) {
    const orbit = model.getCameraOrbit();
    model.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${radius}m`;
    model.jumpCameraToGoal();
  }
  function tick(now) {
    frame = null;
    if (destroyed || !ready() || doc.hidden || goal === null) { cancel(); return; }
    const radius = model.getCameraOrbit().radius;
    const dt = last ? bound(now - last, 1, 50) : 16;
    last = now;
    const next = radius + (goal - radius) * (1 - Math.exp(-dt / 55));
    if (Math.abs(goal - next) < .00002) { writeRadius(goal); goal = null; last = 0; }
    else { writeRadius(next); frame = requestAnimationFrame(tick); }
  }
  function change(logScale) {
    if (destroyed || !ready() || doc.hidden || !Number.isFinite(logScale) || logScale === 0) return;
    const radius = goal ?? model.getCameraOrbit().radius;
    if (!Number.isFinite(radius) || radius <= 0) return;
    options.onInteraction?.();
    goal = bound(radius * Math.exp(bound(logScale, -.25, .25)), min, max);
    if (reduced()) { const next = goal; cancel(); writeRadius(next); }
    else if (frame === null) frame = requestAnimationFrame(tick);
  }
  function step(units, precise = false) {
    if (!ready() || !Number.isFinite(units)) return;
    const radius = goal ?? model.getCameraOrbit().radius;
    change(units * Math.log1p(zoomRate(radius)) * (precise ? .25 : 1));
  }
  function zoomBy(factor, precise = false) {
    if (Number.isFinite(factor) && factor > 0) step(Math.log(factor) / Math.log(1.08), precise);
  }
  listen(model, 'wheel', event => {
    if (!ready() || destroyed || !event.cancelable) return;
    // Leave Ctrl/Cmd-wheel browser magnification available.
    if (event.ctrlKey || event.metaKey) { event.stopImmediatePropagation(); return; }
    const units = wheelUnits(event, model.getBoundingClientRect().height);
    if (!units) return;
    event.preventDefault(); event.stopImmediatePropagation();
    step(units, event.shiftKey);
  }, { capture: true, passive: false });
  listen(model, 'keydown', event => {
    if (!ready() || event.ctrlKey || event.metaKey || event.altKey || !['+', '=', '-', '_'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    step(event.key === '-' || event.key === '_' ? 1 : -1, event.shiftKey);
  }, true);
  const separation = () => {
    if (pointers.size !== 2) return null;
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  listen(model, 'pointerdown', event => {
    cancel();
    if (event.pointerType === 'touch') pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }, true);
  listen(model, 'pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const before = separation();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = separation();
    if (!ready() || !before || !after || before < 12 || after < 12) return;
    const radius = goal ?? model.getCameraOrbit().radius;
    const gain = .18 + .32 * bound((radius - .5) / 4.5, 0, 1);
    change(Math.log(before / after) * gain);
  }, true);
  const release = event => pointers.delete(event.pointerId);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(model, name, release, true);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) { cancel(); pointers.clear(); } });
  listen(model, 'load', () => { cancel(); pointers.clear(); model.zoomSensitivity = 0; });
  listen(model, 'error', cancel);
  return {
    zoomBy, step, cancel,
    destroy() {
      if (destroyed) return;
      destroyed = true; cancel(); pointers.clear(); cleanups.forEach(fn => fn());
      model.zoomSensitivity = previousSensitivity;
    }
  };
}
