// Échantillon de contrôle de la boîte à outils (non utilisé par la page).
import { G, m, grp, part, asm, bolt, nut, washer, hydCylinder, hose, fitting, elbow, coupler, lever, estopButton, triPerforated, rubberTrack, decal, pin, IN, boltCircle } from '../kit.js';
export function build() {
  const parts = [];
  parts.push(part({ id: 'plate', fr: 'Plaque' }, [m(G.plate(G.rrect(0.4, 0.3, 0.02), 0.012, { holes: [{ c: [0.1, 0.05], r: 0.02 }, { slot: [-0.12, -0.05, -0.04, -0.05], r: 0.012 }] }), 'red', { p: [0, 0.3, 0] })]));
  parts.push(part({ id: 'bolts', fr: 'Visserie' }, [
    grp([bolt({ d: 0.5 * IN, L: 1.5 * IN, washer: true }), grp([nut({ d: 0.5 * IN, lock: true })], { p: [0.05, 0, 0] }), grp([washer({ d: 0.5 * IN })], { p: [0.1, 0, 0] }), grp([bolt({ head: 'shcs' })], { p: [0.15, 0, 0] }), grp([bolt({ head: 'bhcs' })], { p: [0.2, 0, 0] })], { p: [0.3, 0.45, 0] }),
  ]));
  parts.push(part({ id: 'cyl', fr: 'Vérin' }, [grp([hydCylinder({ bore: 2.5 * IN, rod: 1.5 * IN, stroke: 8 * IN, ext: 0.5 })], { p: [-0.4, 0.1, 0] })]));
  parts.push(part({ id: 'hose', fr: 'Boyau' }, [hose([[-0.2, 0.1, 0.2], [0, 0.4, 0.3], [0.3, 0.2, 0.25], [0.5, 0.1, 0.1]])]));
  parts.push(part({ id: 'fit', fr: 'Raccords' }, [grp([fitting(), grp([elbow()], { p: [0.05, 0, 0] }), grp([coupler()], { p: [0.12, 0, 0] }), grp([lever()], { p: [0.2, 0, 0] }), grp([estopButton()], { p: [0.3, 0, 0] })], { p: [0.2, 0.0, 0.3] })]));
  parts.push(part({ id: 'perf', fr: 'Panneau perforé' }, [m(triPerforated(0.8, 0.4, 0.006), 'white', { p: [0.2, 0.6, -0.3] })]));
  parts.push(part({ id: 'track', fr: 'Chenille' }, [m(rubberTrack({ length: 1.2, height: 0.36, width: 0.25 }), 'rubber', { p: [-0.3, 0.18, -0.5] })]));
  parts.push(part({ id: 'decal', fr: 'Étiquette' }, [decal({ lines: ['LP RODBOT'], w: 0.3, h: 0.06, bg: '#ffffff', fg: '#b3161d', p: [0.2, 0.3, 0.007] })]));
  parts.push(part({ id: 'pins', fr: 'Axes' }, [grp([pin({ d: 1.25 * IN, L: 3 * IN }), boltCircle(8, 0.08, 0, { d: 0.375 * IN, L: 1 * IN })], { p: [0.6, 0.2, 0.2] }), m(G.tube(0.1, 0.06, 0.03), 'blackCast', { p: [0.6, 0.18, 0.2] }), m(G.box(0.2, 0.1, 0.15, 0.01), 'grey', { p: [0.6, 0.05, -0.2] }), m(G.disc(0.06, 0.03), 'chrome', { p: [0.8, 0.05, 0] }), m(G.box(0.1, 0.1, 0.1), 'yellow', { p: [0.8, 0.05, 0.2] }), m(G.sphere(0.04), 'amber', { p: [0.9, 0.1, -0.1] })]));
  return asm({ id: 'test', fr: 'Test' }, parts);
}
