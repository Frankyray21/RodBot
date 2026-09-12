const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, '..', '3d/js/simulation-state.js'), 'utf8');
const { createSimulation, SIMULATION_LIMITS, SIMULATION_INITIAL_POSE } = new Function(source.replaceAll('export ', '') + '\nreturn { createSimulation, SIMULATION_LIMITS, SIMULATION_INITIAL_POSE };')();
const setup = callbacks => {
  const sim = createSimulation(callbacks);
  sim.dispatch({ type: 'SET_SOURCE', value: 'REMOTE' });
  sim.dispatch({ type: 'ZONE_CLEAR', value: true });
  sim.dispatch({ type: 'REARM' });
  sim.dispatch({ type: 'SET_MODE', value: 'DIRECT' });
  return sim;
};
const press = (sim, command) => sim.dispatch({ type: 'PRESS', command });
const release = (sim, command) => sim.dispatch({ type: 'RELEASE', command });
const step = (sim, count = 1, seconds = .1) => { for (let i = 0; i < count; i++) sim.dispatch({ type: 'STEP', seconds }); };

test('initial state and returned snapshots cannot mutate internal state', () => {
  const sim = createSimulation(); const state = sim.getState();
  assert.equal(state.source, 'LOCAL'); assert.equal(state.mode, 'STANDBY'); assert.equal(state.armed, false); assert.equal(state.zoneClear, false);
  assert.deepEqual(state.pose, SIMULATION_INITIAL_POSE);
  state.pose.arm = Infinity; state.estops.u1 = true; state.held.js1_up = true;
  assert.equal(sim.getState().pose.arm, 0); assert.equal(sim.getState().estops.u1, false); assert.deepEqual(sim.getState().held, {});
});

test('LOCAL, missing exercise clearance, missing rearm and STANDBY reject radio motion without queuing it', () => {
  const sim = createSimulation();
  press(sim, 'js1_up'); assert.equal(sim.getState().feedback.code, 'LOCAL_RADIO_IGNORED');
  sim.dispatch({ type: 'SET_SOURCE', value: 'REMOTE' }); press(sim, 'js1_up'); assert.equal(sim.getState().feedback.code, 'EXERCISE_ZONE_REQUIRED');
  sim.dispatch({ type: 'ZONE_CLEAR', value: true }); press(sim, 'js1_up'); assert.equal(sim.getState().feedback.code, 'REARM_REQUIRED');
  sim.dispatch({ type: 'REARM' }); press(sim, 'js1_up'); assert.equal(sim.getState().feedback.code, 'STANDBY_NO_MOTION');
  sim.dispatch({ type: 'SET_MODE', value: 'DIRECT' }); step(sim, 20);
  assert.equal(sim.getState().pose.arm, 0); assert.deepEqual(sim.getState().held, {});
});

test('all four stops halt REMOTE and require release plus distinct rearm, without restarting a held command', () => {
  for (const id of ['u1', 'u2', 'u3', 'u4']) {
    const sim = setup(); press(sim, 'js1_up'); step(sim, 2); assert.ok(sim.getState().pose.arm > 0);
    sim.dispatch({ type: 'ESTOP', id }); const stoppedPose = sim.getState().pose;
    assert.equal(sim.getState().armed, false); assert.deepEqual(sim.getState().held, {});
    sim.dispatch({ type: 'REARM' }); assert.equal(sim.getState().armed, false);
    press(sim, 'js1_up'); step(sim, 30); assert.deepEqual(sim.getState().pose, stoppedPose);
    sim.dispatch({ type: 'RELEASE_ESTOP', id }); assert.equal(sim.getState().armed, false);
    sim.dispatch({ type: 'REARM' }); step(sim, 30); assert.deepEqual(sim.getState().pose, stoppedPose);
    press(sim, 'js1_up'); step(sim); assert.ok(sim.getState().pose.arm > stoppedPose.arm);
  }
});

test('radio stop u2 is inactive in LOCAL, wired stops still disarm, returning to REMOTE with u2 pressed blocks rearm', () => {
  const sim = createSimulation(); sim.dispatch({ type: 'ZONE_CLEAR', value: true }); sim.dispatch({ type: 'REARM' });
  assert.equal(sim.getState().armed, true);
  sim.dispatch({ type: 'ESTOP', id: 'u2' }); assert.equal(sim.getState().armed, true); assert.equal(sim.getState().feedback.code, 'REMOTE_STOP_INACTIVE_LOCAL');
  sim.dispatch({ type: 'ESTOP', id: 'u3' }); assert.equal(sim.getState().armed, false);
  sim.dispatch({ type: 'RELEASE_ESTOP', id: 'u3' }); sim.dispatch({ type: 'REARM' }); assert.equal(sim.getState().armed, true);
  sim.dispatch({ type: 'SET_SOURCE', value: 'REMOTE' }); sim.dispatch({ type: 'REARM' }); assert.equal(sim.getState().armed, false);
});

test('release, loss-of-focus RELEASE_ALL, source/mode changes and zone removal neutralise continuous input', () => {
  for (const interruption of [{ type: 'RELEASE', command: 'js1_up' }, { type: 'RELEASE_ALL' }, { type: 'SET_SOURCE', value: 'LOCAL' }, { type: 'SET_MODE', value: 'STANDBY' }, { type: 'ZONE_CLEAR', value: false }]) {
    const sim = setup(); press(sim, 'js1_up'); step(sim); sim.dispatch(interruption); const pose = sim.getState().pose;
    step(sim, 40); assert.deepEqual(sim.getState().pose, pose); assert.deepEqual(sim.getState().held, {});
  }
});

test('opening requires simultaneous green plus upward JS2 for a continuous second, reset by releasing either input', () => {
  for (const released of ['grip_enable', 'js2_up']) {
    const sim = setup(); press(sim, 'js2_up'); step(sim, 20); assert.equal(sim.getState().pose.grip, 0);
    press(sim, 'grip_enable'); step(sim, 9); assert.equal(sim.getState().pose.grip, 0);
    release(sim, released); press(sim, released); step(sim, 9); assert.equal(sim.getState().pose.grip, 0);
    step(sim); assert.ok(sim.getState().pose.grip > 0);
    release(sim, released); const pose = sim.getState().pose; step(sim, 10); assert.deepEqual(sim.getState().pose, pose);
  }
});

test('downward JS2 without green cannot close; combined impulse starts closure without a delay and continues after normal release', () => {
  const sim = setup(); press(sim, 'grip_enable'); press(sim, 'js2_up'); step(sim, 24); sim.dispatch({ type: 'RELEASE_ALL' });
  assert.equal(sim.getState().pose.grip, 100);
  press(sim, 'js2_down'); assert.equal(sim.getState().pose.grip, 100);
  press(sim, 'grip_enable'); assert.equal(sim.getState().closing, true); assert.equal(sim.getState().pose.grip, 100);
  step(sim); assert.equal(sim.getState().pose.grip, 88);
  release(sim, 'js2_down'); release(sim, 'grip_enable'); assert.deepEqual(sim.getState().held, {}); assert.equal(sim.getState().closing, true);
  step(sim, 10); assert.equal(sim.getState().pose.grip, 0); assert.equal(sim.getState().closing, false);
});

test('a latched closing movement is cancelled by each safety/neutral transition, even after both physical commands were released', () => {
  for (const interruption of [{ type: 'ESTOP', id: 'u1' }, { type: 'RELEASE_ALL' }, { type: 'REARM' }, { type: 'SET_SOURCE', value: 'LOCAL' }, { type: 'SET_MODE', value: 'STANDBY' }, { type: 'ZONE_CLEAR', value: false }]) {
    const sim = setup(); press(sim, 'grip_enable'); press(sim, 'js2_up'); step(sim, 24); sim.dispatch({ type: 'RELEASE_ALL' });
    press(sim, 'grip_enable'); press(sim, 'js2_down'); release(sim, 'grip_enable'); release(sim, 'js2_down'); step(sim);
    assert.equal(sim.getState().closing, true); assert.equal(sim.getState().pose.grip, 88); assert.deepEqual(sim.getState().held, {});
    sim.dispatch(interruption); const grip = sim.getState().pose.grip;
    assert.equal(sim.getState().closing, false); step(sim, 20); assert.equal(sim.getState().pose.grip, grip);
    sim.dispatch({ type: 'RELEASE_ESTOP', id: 'u1' }); sim.dispatch({ type: 'SET_SOURCE', value: 'REMOTE' }); sim.dispatch({ type: 'ZONE_CLEAR', value: true }); sim.dispatch({ type: 'REARM' }); sim.dispatch({ type: 'SET_MODE', value: 'DIRECT' });
    step(sim, 20); assert.equal(sim.getState().pose.grip, grip); assert.equal(sim.getState().closing, false);
  }
});

test('contradictory paddle inputs do not open or close, emergency cancels accumulated opening time', () => {
  const sim = setup(); press(sim, 'js2_up'); press(sim, 'js2_down'); press(sim, 'grip_enable'); step(sim, 30); assert.equal(sim.getState().pose.grip, 0);
  release(sim, 'js2_down'); step(sim, 9); sim.dispatch({ type: 'ESTOP', id: 'u1' });
  sim.dispatch({ type: 'RELEASE_ESTOP', id: 'u1' }); sim.dispatch({ type: 'REARM' });
  press(sim, 'grip_enable'); press(sim, 'js2_up'); step(sim, 9); assert.equal(sim.getState().pose.grip, 0); step(sim); assert.ok(sim.getState().pose.grip > 0);
});

test('signed mappings and saturation match the existing six GLB clip bounds', () => {
  const sim = setup(); press(sim, 'js1_left'); press(sim, 'js1_up'); press(sim, 'js3_up'); step(sim, 400);
  assert.equal(sim.getState().pose.turret, 35); assert.equal(sim.getState().pose.arm, 15); assert.equal(sim.getState().pose.wrist, 10);
  sim.dispatch({ type: 'RELEASE_ALL' }); press(sim, 'js1_right'); press(sim, 'js1_down'); press(sim, 'js3_down'); step(sim, 400);
  assert.equal(sim.getState().pose.turret, -35); assert.equal(sim.getState().pose.arm, 0); assert.equal(sim.getState().pose.wrist, -10);
  for (const [key, [min, max]] of Object.entries(SIMULATION_LIMITS)) assert.ok(sim.getState().pose[key] >= min && sim.getState().pose[key] <= max);
  assert.equal(sim.getState().pose.tool, 0); assert.equal(sim.getState().pose.jacks, 100);
});

test('time jumps clamp to 0.1 second and non-finite/negative steps do not advance time or pose', () => {
  const sim = setup(); press(sim, 'js1_up'); press(sim, 'grip_enable'); press(sim, 'js2_up'); step(sim, 1, 10000);
  assert.equal(sim.getState().pose.arm, .5); assert.equal(sim.getState().gripHoldSeconds, .1); assert.equal(sim.getState().pose.grip, 0);
  const state = sim.getState(); for (const seconds of [NaN, Infinity, -1, 0, '1']) step(sim, 1, seconds);
  assert.deepEqual(sim.getState(), state);
});

test('unsupported modes neutralise and enter STANDBY, horn only gives feedback, reset restores the exercise', () => {
  const sim = setup(); press(sim, 'js1_up'); step(sim); sim.dispatch({ type: 'SET_MODE', value: 'LINEAR' }); const pose = sim.getState().pose;
  assert.equal(sim.getState().mode, 'STANDBY'); assert.equal(sim.getState().feedback.code, 'MODE_UNSUPPORTED'); step(sim, 10); assert.deepEqual(sim.getState().pose, pose);
  sim.dispatch({ type: 'HORN' }); assert.deepEqual(sim.getState().pose, pose); assert.equal(sim.getState().feedback.page, 21);
  press(sim, 'js3_right'); assert.equal(sim.getState().feedback.code, 'COMMAND_UNSUPPORTED');
  sim.dispatch({ type: 'RESET' }); assert.deepEqual(sim.getState().pose, SIMULATION_INITIAL_POSE); assert.equal(sim.getState().armed, false); assert.equal(sim.getState().zoneClear, false);
});

test('callbacks receive independent snapshots and remote controls return to neutral with model motion', () => {
  const poses = [], controls = [], changes = [];
  const sim = setup({ onPose: pose => { poses.push({ ...pose }); pose.arm = -999; }, onControlPose: pose => controls.push(pose), onChange: state => { changes.push(state.feedback.code); state.pose.arm = -888; } });
  press(sim, 'js1_up'); step(sim); assert.equal(sim.getState().pose.arm, .5); assert.equal(poses.at(-1).arm, .5); assert.equal(controls.at(-1).js1y, 1);
  sim.dispatch({ type: 'ESTOP', id: 'u4' }); assert.equal(controls.at(-1).js1y, 0); assert.ok(changes.includes('EMERGENCY_STOP'));
});
