const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, '..', '3d', 'js', 'motion.js'), 'utf8');
const motion = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${label}: ${actual} vs ${expected}`);
}

test('the same gesture travels equally far at 30, 60 and 120 FPS', async () => {
  const { inertiaStep } = await motion;
  for (const initial of [-160, 200]) {
    const results = [30, 60, 120].map(fps => {
      let velocity = initial, distance = 0;
      for (let frame = 0; frame < fps * 2; frame++) {
        const step = inertiaStep(velocity, 1 / fps);
        velocity = step.velocity;
        distance += step.distance;
      }
      return { velocity, distance };
    });
    for (const result of results) {
      close(result.distance, results[0].distance, 'distance independent of frame rate');
      close(result.velocity, results[0].velocity, 'remaining velocity independent of frame rate');
      assert.ok(Math.abs(result.velocity) < 0.001, 'gesture slows to rest');
      assert.equal(Math.sign(result.distance), Math.sign(initial), 'gesture direction is preserved');
    }
  }
});

test('inertia can cross irregular frame durations without changing the result', async () => {
  const { inertiaStep } = await motion;
  let velocity = 120, distance = 0;
  for (const seconds of [0.01, 0.04, 0.15, 0.3, 0.5]) {
    const step = inertiaStep(velocity, seconds);
    velocity = step.velocity;
    distance += step.distance;
  }
  const full = inertiaStep(120, 1);
  close(distance, full.distance, 'integrated distance');
  close(velocity, full.velocity, 'remaining velocity');
  assert.deepEqual(inertiaStep(120, 0), { velocity: 120, distance: 0 });
});

test('camera flights take the short yaw path across zero and after several rotations', async () => {
  const { nearestYaw } = await motion;
  const cases = [
    [350, 10, 370], [10, 350, -10], [305, 90, 450],
    [1440, 10, 1450], [-1440, 350, -1450], [30, 1470, 30],
    [750, -1410, 750]
  ];
  for (const [from, to, expected] of cases) {
    const target = nearestYaw(from, to);
    assert.equal(target, expected, `${from} to ${to}`);
    assert.ok(Math.abs(target - from) <= 180, 'rotation never exceeds half a turn');
    close(((target - to) % 360 + 360) % 360, 0, 'target orientation preserved');
  }
});

test('portrait framing backs the camera away and stays bounded on narrow screens', async () => {
  const { framingScale } = await motion;
  const desktop = framingScale(1440, 900);
  const tablet = framingScale(768, 1024);
  const phone = framingScale(320, 740);
  assert.ok(tablet > desktop);
  assert.ok(phone >= tablet);
  for (const [width, height] of [[320, 568], [320, 740], [390, 844], [1, 10000], [10000, 1]]) {
    const scale = framingScale(width, height);
    assert.ok(Number.isFinite(scale) && scale >= 1.15 && scale <= 2.4, `${width}x${height}`);
  }
  for (const dimensions of [[0, 740], [320, 0], [-1, 900]]) {
    assert.equal(framingScale(...dimensions), 1, 'hidden or invalid viewport is safe');
  }
});
