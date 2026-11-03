// Datos compartidos entre apartados.
import { get, getDay, range, foodlogRange, workoutsRange, all } from '../db.js';
import { weekday } from '../util.js';
import { dayItems, compliance, cycleModel, phaseFor, totals } from '../domain.js';
import { S } from '../ui.js';
import { todayStr } from '../util.js';

export async function plannedFor(date, day) {
  const id = day.plannedId !== undefined ? day.plannedId : S.schedule[weekday(date)];
  return id ? (await get('templates', id)) || null : null;
}
export async function dayCtx(date) {
  const day = await getDay(date);
  const [foods, workouts] = await Promise.all([foodlogRange(date, date), workoutsRange(date, date)]);
  const planned = await plannedFor(date, day);
  const items = dayItems(date, day, foods, workouts, S, planned?.name ?? null);
  return { date, day, foods, workouts, planned, items, pct: compliance(items), totals: totals(foods) };
}
export async function model() { return cycleModel(await all('periods'), S.cycle, todayStr()); }
/** Contexto de un rango completo para calendario y estadísticas. */
export async function rangeCtx(a, b) {
  const [days, foods, workouts] = await Promise.all([range('days', a, b), foodlogRange(a, b), workoutsRange(a, b)]);
  const dayMap = new Map(days.map(d => [d.date, d]));
  const foodMap = new Map(); foods.forEach(f => { (foodMap.get(f.date) || foodMap.set(f.date, []).get(f.date)).push(f); });
  const wMap = new Map(); workouts.forEach(w => { (wMap.get(w.date) || wMap.set(w.date, []).get(w.date)).push(w); });
  return { days, foods, workouts, dayMap, foodMap, wMap };
}
export function phaseOf(date, m) { return phaseFor(date, m); }
