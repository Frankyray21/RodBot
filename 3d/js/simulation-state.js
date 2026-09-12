/* Pure familiarisation state. No DOM, timers, machine connection, IK or quiz.
 * Manual BM260024 R0: pp.12,14-15,17-22,49-50,54-56.
 * zoneClear and rearming after a source change are exercise prerequisites;
 * they do not claim an automatic personnel detector on the real machine.
 * Rates and pose bounds belong to the six illustrative GLB clips, not the machine.
 */
export const SIMULATION_LIMITS = Object.freeze({
  turret: Object.freeze([-35, 35]), arm: Object.freeze([0, 15]),
  wrist: Object.freeze([-10, 10]), tool: Object.freeze([-35, 35]),
  grip: Object.freeze([0, 100]), jacks: Object.freeze([0, 100])
});
export const SIMULATION_INITIAL_POSE = Object.freeze({ turret: 0, arm: 0, wrist: 3, tool: 0, grip: 0, jacks: 100 });
const COMMANDS = new Set(['js1_up', 'js1_down', 'js1_left', 'js1_right', 'js3_up', 'js3_down', 'grip_enable', 'js2_up', 'js2_down']);
const STOPS = new Set(['u1', 'u2', 'u3', 'u4']);
const copy = value => JSON.parse(JSON.stringify(value));
const feedback = (code, text, page) => ({ code, text, page });
const initialState = () => ({
  source: 'LOCAL', mode: 'STANDBY', armed: false, zoneClear: false,
  estops: { u1: false, u2: false, u3: false, u4: false },
  pose: { ...SIMULATION_INITIAL_POSE }, held: {}, gripHoldSeconds: 0, closing: false,
  feedback: feedback('EXERCISE_READY', 'Repérez les commandes. La simulation commence en LOCAL, sans mouvement.', 14)
});

export function createSimulation({ onChange, onPose, onControlPose } = {}) {
  let state = initialState();
  const isHeld = command => state.held[command] === true;
  const activeStop = () => state.estops.u1 || state.estops.u3 || state.estops.u4 || (state.source === 'REMOTE' && state.estops.u2);
  const neutral = () => { state.held = {}; state.gripHoldSeconds = 0; state.closing = false; };
  const controlPose = () => ({
    js1x: Number(isHeld('js1_right')) - Number(isHeld('js1_left')),
    js1y: Number(isHeld('js1_up')) - Number(isHeld('js1_down')),
    js2: Number(isHeld('js2_up')) - Number(isHeld('js2_down')),
    js3x: 0,
    js3y: Number(isHeld('js3_up')) - Number(isHeld('js3_down')),
    gripEnable: isHeld('grip_enable')
  });
  const reason = () => {
    if (activeStop()) return feedback('ESTOP_ACTIVE', "Un arrêt d'urgence est enfoncé. Déverrouillez-le avant le réarmement.", 15);
    if (state.source !== 'REMOTE') return feedback('LOCAL_RADIO_IGNORED', 'En LOCAL, les demandes de mouvement de la radio sont ignorées.', 14);
    if (!state.zoneClear) return feedback('EXERCISE_ZONE_REQUIRED', "Pour cet exercice, confirmez que la zone virtuelle est libre. Ce contrôle n'est pas un capteur de la machine.", 11);
    if (!state.armed) return feedback('REARM_REQUIRED', 'Réarmez la sécurité au panneau avant de commander un mouvement.', 15);
    if (state.mode !== 'DIRECT') return feedback('STANDBY_NO_MOTION', 'En VEILLE, les commandes de mouvement ne sont pas traitées. Sélectionnez DIRECT.', 54);
    return null;
  };
  const boundPose = () => {
    for (const [key, [min, max]] of Object.entries(SIMULATION_LIMITS)) {
      state.pose[key] = Math.max(min, Math.min(max, Number.isFinite(state.pose[key]) ? state.pose[key] : SIMULATION_INITIAL_POSE[key]));
    }
  };
  const emit = before => {
    boundPose();
    const snapshot = copy(state);
    if (JSON.stringify(before.pose) !== JSON.stringify(state.pose)) onPose?.(copy(state.pose));
    if (JSON.stringify(before.held) !== JSON.stringify(state.held)) onControlPose?.(controlPose());
    if (JSON.stringify(before) !== JSON.stringify(state)) onChange?.(snapshot);
    return snapshot;
  };
  const explainGrip = () => {
    if (isHeld('js2_up') && isHeld('js2_down')) {
      state.gripHoldSeconds = 0;
      state.feedback = feedback('GRIP_CONFLICT', 'Ramenez la bascule centrale au neutre avant de choisir une direction.', 22);
    } else if ((isHeld('js2_up') || isHeld('js2_down')) && !isHeld('grip_enable')) {
      state.gripHoldSeconds = 0;
      state.feedback = feedback('GRIP_ENABLE_REQUIRED', 'Maintenez aussi le bouton vert PINCE pour actionner la bascule centrale JS2.', 55);
    } else if (isHeld('js2_down') && isHeld('grip_enable')) {
      // P.56: one downward impulse with green held commands closure.
      // Animate that latched command after normal RELEASE. Neutral/safety
      // transitions cancel it, so a later rearm can never resume it.
      state.closing = state.pose.grip > 0;
      state.gripHoldSeconds = 0;
      state.feedback = feedback(state.closing ? 'GRIP_CLOSING' : 'GRIP_CLOSED', state.closing
        ? 'Fermeture commandée par le bouton vert et une impulsion de JS2 vers le bas.'
        : 'La pince vide est fermée.', 56);
    } else if (isHeld('js2_up') && isHeld('grip_enable')) {
      state.feedback = feedback('GRIP_OPEN_HOLD', 'Maintenez le bouton vert et JS2 vers le haut ensemble pendant au moins 1 seconde.', 55);
    }
  };
  const horn = () => {
    state.feedback = state.source === 'LOCAL'
      ? feedback('LOCAL_RADIO_IGNORED', 'En LOCAL, la radio ne commande pas le RodBot.', 17)
      : feedback('HORN', 'Commande du klaxon repérée sur la radio. Aucun mouvement hydraulique.', 21);
  };

  function dispatch(action = {}) {
    const before = copy(state);
    switch (action.type) {
      case 'SET_SOURCE': {
        if (!['LOCAL', 'REMOTE'].includes(action.value)) {
          state.feedback = feedback('SOURCE_UNSUPPORTED', 'Choisissez LOCAL ou REMOTE.', 14); break;
        }
        if (action.value === state.source) break;
        neutral(); state.armed = false; state.mode = 'STANDBY'; state.source = action.value;
        state.feedback = feedback('SOURCE_CHANGED', action.value === 'LOCAL'
          ? 'LOCAL : les mouvements radio sont ignorés. Les commandes de cet exercice sont au neutre.'
          : "REMOTE sélectionné. Pour reprendre cet exercice, réarmez la sécurité puis choisissez DIRECT.", 14);
        break;
      }
      case 'SET_MODE': {
        neutral();
        if (!['STANDBY', 'DIRECT'].includes(action.value)) {
          state.mode = 'STANDBY';
          state.feedback = feedback('MODE_UNSUPPORTED', 'Ce mode est présenté en repérage seulement. La simulation de mouvement revient en VEILLE.', 50); break;
        }
        if (action.value === 'DIRECT' && state.source !== 'REMOTE') {
          state.feedback = feedback('LOCAL_RADIO_IGNORED', 'Passez en REMOTE pour sélectionner DIRECT depuis la radio.', 17); break;
        }
        state.mode = action.value;
        state.feedback = feedback('MODE_CHANGED', action.value === 'DIRECT' ? 'DIRECT : chaque commande agit sur son articulation.' : 'VEILLE : aucun mouvement commandé.', action.value === 'DIRECT' ? 56 : 54);
        break;
      }
      case 'ZONE_CLEAR': {
        state.zoneClear = action.value === true;
        if (!state.zoneClear) { neutral(); state.armed = false; }
        state.feedback = feedback('EXERCISE_ZONE', state.zoneClear
          ? 'Zone virtuelle déclarée libre pour cet exercice.'
          : 'Exercice arrêté : la zone virtuelle doit être déclarée libre avant la reprise.', 11);
        break;
      }
      case 'REARM': {
        neutral();
        if (activeStop()) {
          state.armed = false; state.feedback = feedback('ESTOP_ACTIVE', "Déverrouillez d'abord les arrêts d'urgence actifs. Le bouton de réarmement ne les libère pas.", 15);
        } else if (!state.zoneClear) {
          state.armed = false; state.feedback = feedback('EXERCISE_ZONE_REQUIRED', "Avant le réarmement de cet exercice, confirmez que la zone virtuelle est libre.", 11);
        } else {
          state.armed = true;
          state.feedback = feedback('SAFETY_ARMED', 'Sécurité réarmée. Les commandes restent au neutre ; aucun mouvement ne redémarre seul.', 15);
        }
        break;
      }
      case 'ESTOP': {
        if (!STOPS.has(action.id)) { state.feedback = feedback('STOP_UNKNOWN', "Cet arrêt d'urgence n'est pas identifié.", 12); break; }
        state.estops[action.id] = true;
        neutral();
        if (action.id === 'u2' && state.source === 'LOCAL') {
          state.feedback = feedback('REMOTE_STOP_INACTIVE_LOCAL', "En LOCAL, l'arrêt de la radio n'arrête pas le RodBot. Les trois arrêts câblés restent des repères distincts.", 19);
        } else {
          state.armed = false;
          state.feedback = feedback('EMERGENCY_STOP', "Mouvement arrêté. Déverrouiller le bouton ne réarme pas le circuit de sécurité.", 15);
        }
        break;
      }
      case 'RELEASE_ESTOP': {
        if (!STOPS.has(action.id)) break;
        state.estops[action.id] = false; neutral();
        state.feedback = feedback('ESTOP_RELEASED', 'Bouton déverrouillé. Si le circuit a été arrêté, il reste à réarmer au panneau.', 15);
        break;
      }
      case 'PRESS': {
        if (action.command === 'horn') { horn(); break; }
        if (!COMMANDS.has(action.command)) {
          state.feedback = feedback('COMMAND_UNSUPPORTED', 'Cette commande est disponible en repérage ; son mouvement ne fait pas partie de cette simulation.', 22); break;
        }
        const denied = reason();
        if (denied) { neutral(); state.feedback = denied; break; }
        if (isHeld(action.command)) break;
        state.held[action.command] = true;
        state.feedback = feedback('COMMAND_HELD', 'Commande maintenue. Relâchez pour revenir au neutre.', 17);
        explainGrip();
        break;
      }
      case 'RELEASE': {
        if (!isHeld(action.command)) break;
        delete state.held[action.command];
        if (['grip_enable', 'js2_up', 'js2_down'].includes(action.command)) state.gripHoldSeconds = 0;
        state.feedback = state.closing
          ? feedback('GRIP_CLOSING', 'Bascule relâchée. La fermeture déjà commandée se poursuit.', 56)
          : feedback('COMMAND_RELEASED', 'Commande relâchée ; la manette revient au neutre.', 17);
        break;
      }
      case 'RELEASE_ALL':
        neutral(); state.feedback = feedback('ALL_NEUTRAL', 'Toutes les commandes sont au neutre.', 17); break;
      case 'HORN': horn(); break;
      case 'STEP': {
        if (!Number.isFinite(action.seconds) || action.seconds <= 0) break;
        const dt = Math.min(action.seconds, .1);
        if (!Object.keys(state.held).length && !state.closing) break;
        const denied = reason();
        if (denied) { neutral(); state.feedback = denied; break; }
        state.pose.arm += (Number(isHeld('js1_up')) - Number(isHeld('js1_down'))) * 5 * dt;
        state.pose.turret += (Number(isHeld('js1_left')) - Number(isHeld('js1_right'))) * 16 * dt;
        // +Y Blender / -Z glTF rotates longitudinal +X downward: JS3 up is wrist +.
        state.pose.wrist += (Number(isHeld('js3_up')) - Number(isHeld('js3_down'))) * 8 * dt;
        if (isHeld('grip_enable') && isHeld('js2_up') && !isHeld('js2_down')) {
          state.gripHoldSeconds = Math.min(1, state.gripHoldSeconds + dt);
          if (state.gripHoldSeconds >= 1 - 1e-9) {
            state.closing = false;
            state.pose.grip += 80 * dt;
            state.feedback = feedback('GRIP_OPENING', 'Ouverture de la pince vide : les deux commandes sont maintenues depuis au moins 1 seconde.', 55);
          }
        } else state.gripHoldSeconds = 0;
        if (state.closing) {
          state.pose.grip = Math.max(0, state.pose.grip - 120 * dt);
          if (state.pose.grip === 0) {
            state.closing = false;
            state.feedback = feedback('GRIP_CLOSED', 'La fermeture commandée est terminée. La pince reste vide.', 56);
          }
        }
        break;
      }
      case 'RESET': state = initialState(); break;
      default: state.feedback = feedback('ACTION_UNSUPPORTED', 'Cette action ne fait pas partie de la familiarisation.', 21);
    }
    return emit(before);
  }
  return Object.freeze({ getState: () => copy(state), dispatch });
}
