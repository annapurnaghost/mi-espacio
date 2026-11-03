import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/domain.js';

test('sueño cruza medianoche y resta latencia', () => {
  assert.equal(D.sleepHours('23:30', '07:30'), 8);
  assert.equal(D.sleepHours('01:00', '08:30'), 7.5);
  assert.equal(D.sleepHours('23:00', '07:00', 30), 7.5);
  assert.equal(D.sleepHours(null, '07:00'), null);
});
test('volumen y formato: ejemplo de hip thrust', () => {
  const it = { sets: [{ kg: 40, reps: 12 }, { kg: 50, reps: 10 }, { kg: 60, reps: 8 }] };
  assert.equal(D.itemVolume(it), 40 * 12 + 50 * 10 + 60 * 8);
  assert.equal(D.workoutVolume({ items: [it, it] }), 2920);
});
test('récords e historial', () => {
  const ws = [{ id: 'a', date: '2026-01-01', items: [{ exId: 'x', sets: [{ kg: 40, reps: 12 }] }] }, { id: 'b', date: '2026-02-01', items: [{ exId: 'x', sets: [{ kg: 60, reps: 8 }] }] }];
  const h = D.exerciseHistory(ws, 'x');
  assert.equal(h[0].date, '2026-02-01');
  const r = D.exerciseRecords(h);
  assert.equal(r.kg.kg, 60); assert.equal(r.reps.reps, 12);
  assert.deepEqual(D.newRecords({ sets: [{ kg: 65, reps: 5 }] }, h), ['nuevo récord de peso: 65 kg']);
  assert.equal(D.monthlyProgress(h).length, 2);
});
test('nutrición: escala y nunca inventa un dato ausente', () => {
  const v = D.scale({ kcal: 200, p: 10, c: 20, f: 5, fiber: null, sugar: 1 }, 150);
  assert.equal(v.kcal, 300); assert.equal(v.fiber, null);
  const t = D.totals([v, D.scale({ kcal: 100, p: 1, c: 1, f: 1, fiber: 2, sugar: 0 }, 100)]);
  assert.equal(t.kcal, 400); assert.equal(t.fiber, 2); assert.equal(t.missing.fiber, true);
  assert.ok(Math.abs(D.macroSplit({ p: 25, c: 25, f: 0 }).p - .5) < 1e-9);
});
test('receta: valores por 100 g con peso cocinado', () => {
  const n = D.recipeNutrition({ servings: 2, cookedWeight: 400, ingredients: [{ qty: 200, kcal: 400, p: 20, c: 0, f: 0, fiber: 0, sugar: 0, approx: false }, { qty: 300, kcal: 200, p: 10, c: 0, f: 0, fiber: 0, sugar: 0, approx: false }] });
  assert.equal(n.per100.kcal, 150); assert.equal(n.portionWeight, 200); assert.equal(n.approx, false);
});
test('pasos desde Atajos', () => {
  assert.deepEqual(D.parseSteps('12345', '2026-11-03'), [{ date: '2026-11-03', steps: 12345 }]);
  assert.deepEqual(D.parseSteps('12.345,6', '2026-11-03'), [{ date: '2026-11-03', steps: 12345 }]);
  assert.deepEqual(D.parseSteps('2026-11-02=8000\n2026-11-03=9000', 'x'), [{ date: '2026-11-02', steps: 8000 }, { date: '2026-11-03', steps: 9000 }]);
  assert.deepEqual(D.parseSteps('nada', 'x'), []);
});
test('estadísticas de pasos', () => {
  const s = D.stepsStats([{ date: '2026-11-01', steps: 20000 }, { date: '2026-11-02', steps: 21000 }, { date: '2026-11-03', steps: 5000 }], '2026-11-03', 20000);
  assert.equal(s.best.steps, 21000); assert.equal(s.hits.length, 2); assert.equal(s.streak, 2);
  assert.ok(Math.abs(s.avg7 - 46000 / 3) < 1e-6);
});
const cfg = { avgLen: 28, luteal: 14, bleed: 5 };
test('ciclo: predicción con historial y actualización', () => {
  const ps = [{ start: '2026-08-01', end: '2026-08-05' }, { start: '2026-08-31', end: '2026-09-04' }, { start: '2026-09-28', end: '2026-10-02' }];
  const m = D.cycleModel(ps, cfg, '2026-10-05');
  assert.equal(m.avgLen, 29); assert.equal(m.nextStart, '2026-10-27'); assert.equal(m.bleed, 5);
  assert.equal(m.predictions[0].ovulation, '2026-11-11');
  const m2 = D.cycleModel([...ps, { start: '2026-10-30' }], cfg, '2026-10-30');
  assert.notEqual(m2.nextStart, m.nextStart);
});
test('ciclo: fases en orden y estimadas', () => {
  const m = D.cycleModel([{ start: '2026-10-01', end: '2026-10-05' }], cfg, '2026-10-10');
  const f = d => D.phaseFor(d, m).phase;
  assert.equal(f('2026-10-03'), 'menstruacion'); assert.equal(f('2026-10-08'), 'folicular');
  assert.equal(f('2026-10-15'), 'ovulacion'); assert.equal(f('2026-10-20'), 'lutea');
  assert.equal(D.phaseFor('2026-10-20', m).est, true);
  assert.equal(D.phaseFor('2026-09-01', m), null);
  assert.equal(D.phaseFor('2026-10-29', m).phase, 'menstruacion'); // siguiente prevista
});
test('ciclo: retraso no se presenta como fase normal', () => {
  const m = D.cycleModel([{ start: '2026-10-01', end: '2026-10-05' }], cfg, '2026-11-03');
  assert.equal(m.late, 5); assert.equal(D.phaseFor('2026-11-03', m).phase, 'retraso');
  assert.equal(m.predictions[0].start, '2026-11-04');
});
test('cumplimiento: respeta días configurados y descanso', () => {
  const S = D.defaultSettings();
  S.skin.pm.find(p => p.name === 'Tretinoína').days = [1];
  const date = '2026-11-03'; // martes
  const items = D.dayItems(date, { steps: 10000, skin: { pm: { pm1: { done: true }, pm2: { done: true }, pm4: { done: true } } } }, [], [], S, null);
  const pm = items.find(i => i.key === 'skinPM');
  assert.equal(pm.pct, 1); assert.equal(items.find(i => i.key === 'steps').pct, .5);
  assert.equal(items.find(i => i.key === 'workout'), undefined);
  assert.ok(D.dayItems(date, {}, [], [], S, 'Pierna').find(i => i.key === 'workout'));
});
test('pelo y medidas', () => {
  const lw = D.lastWash([{ date: '2026-11-01', hair: { items: { washed: true } } }, { date: '2026-10-25', hair: { items: { washed: true } } }], '2026-11-03');
  assert.equal(lw.last, '2026-11-01'); assert.equal(lw.since, 2); assert.equal(lw.count, 2);
  const d = D.bodyDelta([{ date: '2026-01-01', weight: 60 }, { date: '2026-02-01', weight: 58.5 }], 'weight');
  assert.equal(d.diff, -1.5);
});
