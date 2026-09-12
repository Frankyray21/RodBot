import { ModelViewerElement } from '../vendor/model-viewer-4.3.1.min.js';
import { MODEL_URL, ENVIRONMENT_URL, DRACO_URL } from './model-assets.js';

// A live presentation of the same articulated model used in the exercises.
// Its camera moves; the machine never slides relative to the workshop floor.
export function createHero(model, button) {
  if (!model) return;
  ModelViewerElement.dracoDecoderLocation = DRACO_URL;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = media.matches, visible = false, loaded = false, frame = 0, last = 0, phase = 0;
  let previousPose = '';
  const clips = [
    ['Rotation_tourelle', .5], ['Elevation_bras', 1], ['Inclinaison_pince', .65],
    ['Rotation_pince', .5], ['Ouverture_pince', 0], ['Stabilisateurs', 1]
  ];
  const pose = (arm, wrist) => {
    const key = arm.toFixed(3) + ':' + wrist.toFixed(3);
    if (!loaded || previousPose === key) return;
    previousPose = key;
    model.timeScale = 0;
    model.animationCrossfadeDuration = 0;
    for (const [clip, time] of clips) {
      if (!model.availableAnimations.includes(clip)) continue;
      model.appendAnimation(clip, { time: clip === 'Elevation_bras' ? arm : clip === 'Inclinaison_pince' ? wrist : time, timeScale: 0, weight: 1, fade: false, repetitions: '1' });
    }
    // appendAnimation queues its application for a render tick.
    requestAnimationFrame(() => model.pause());
  };
  const tick = time => {
    frame = 0;
    if (paused || !visible || document.hidden || !loaded) { last = 0; return; }
    const dt = last ? Math.min(.06, (time - last) / 1000) : 0;
    last = time;
    phase += dt;
    // A 24-second slow reveal with a small, unloaded arm movement.
    const cycle = phase * Math.PI * 2 / 24;
    const wave = .5 - .5 * Math.cos(cycle);
    model.cameraOrbit = `${-50 + 45 * Math.sin(cycle * .5)}deg ${70 - 7 * wave}deg 100%`;
    pose(1 - .25 * wave, .65 - .12 * wave);
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    button.textContent = paused ? 'Animer la réplique' : 'Pause animation';
    button.setAttribute('aria-pressed', String(paused));
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
    model.pause();
    if (!paused && visible && !document.hidden && loaded) frame = requestAnimationFrame(tick);
  };
  button.addEventListener('click', () => { paused = !paused; sync(); });
  model.addEventListener('load', () => { loaded = true; pose(1, .65); sync(); });
  model.addEventListener('error', () => { button.hidden = true; loaded = false; sync(); });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !model.src) { model.environmentImage = ENVIRONMENT_URL; model.src = MODEL_URL; }
    sync();
  });
  observer.observe(model);
  document.addEventListener('visibilitychange', sync);
  media.addEventListener('change', event => { if (event.matches) paused = true; sync(); });
  sync();
  return { pause() { paused = true; sync(); } };
}
