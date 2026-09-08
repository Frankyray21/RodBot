/* Camera math is independent of rendering speed and input hardware. */
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
export const nearestYaw = (from, to) => from + ((to - from) % 360 + 540) % 360 - 180;

// Integrate exponential friction, rather than subtracting a fixed amount per frame.
export function inertiaStep(velocity, seconds, friction = 8) {
  const decay = Math.exp(-friction * Math.max(0, seconds));
  return { velocity: velocity * decay, distance: velocity * (1 - decay) / friction };
}

export function framingScale(width, height) {
  if (!(width > 0 && height > 0)) return 1;
  return clamp(1.15 * Math.max(1, 1.3 / (width / height)), 1.15, 2.4);
}
