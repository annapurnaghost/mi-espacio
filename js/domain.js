// Lógica de negocio pura (sin DOM ni base de datos): se prueba en Node.
import { addDays, diffDays, mean, sum, round, weekday, clamp, nf, hours } from './util.js';

/* ---------- Ajustes por defecto: solo lo que has pedido, todo editable ---------- */
const P = (id, name, opt = {}) => ({ id, name, days: [0, 1, 2, 3, 4, 5, 6], ...opt });
export const SYMPTOMS = {
  fisicos: [['dolor_abdominal', 'Dolor abdominal'], ['colicos', 'Cólicos'], ['lumbar', 'Dolor lumbar'], ['mamas', 'Sensibilidad mamaria'], ['hinchazon', 'Hinchazón'], ['retencion', 'Retención de líquidos'], ['cabeza', 'Dolor de cabeza'], ['cansancio', 'Cansancio'], ['acne', 'Acné'], ['apetito', 'Cambios en el apetito'], ['antojos', 'Antojos'], ['digestivas', 'Alteraciones digestivas']],
  emocionales: [['animo', 'Estado de ánimo'], ['irritabilidad', 'Irritabilidad'], ['ansiedad', 'Ansiedad'], ['tristeza', 'Tristeza'], ['motivacion', 'Motivación'], ['energia', 'Energía'], ['concentracion', 'Concentración'], ['sensibilidad', 'Sensibilidad emocional']],
};
export const defaultSettings = () => ({
  key: 'settings', onboarded: false, theme: 'auto',
  goals: { steps: 20000, protein: 130, fiber: 25, kcal: null, water: 2000, pages: 20, sleep: 8 },
  skin: {
    am: [P('am1', 'Limpieza'), P('am2', 'Vitamina C'), P('am3', 'Ácido azelaico'), P('am4', 'Crema hidratante'), P('am5', 'Protector solar SPF')],
    pm: [P('pm1', 'Doble limpieza'), P('pm2', 'Péptidos'), P('pm3', 'Tretinoína'), P('pm4', 'Crema hidratante')],
    concerns: ['Irritación', 'Sequedad', 'Granitos', 'Rojeces', 'Descamación'],
  },
  dental: [{ id: 'am', name: 'Cepillado de mañana', counts: true }, { id: 'pm', name: 'Cepillado de noche', counts: true }, { id: 'floss', name: 'Hilo dental', counts: true }, { id: 'tongue', name: 'Limpieza de lengua', counts: false }],
  shower: [{ id: 'clean', name: 'Limpieza corporal' }, { id: 'hydrate', name: 'Hidratación corporal' }],
  hair: {
    wash: [{ id: 'washed', name: 'Me he lavado el pelo', key: true }, { id: 'mask', name: 'Mascarilla intensiva' }, { id: 'cond', name: 'Acondicionador' }, { id: 'leave', name: 'Leave-in' }, { id: 'oil', name: 'Aceite capilar' }, { id: 'heat', name: 'Protector térmico' }],
    nowash: [{ id: 'serum', name: 'Sérum capilar' }, { id: 'oil2', name: 'Aceite' }, { id: 'night', name: 'Tratamiento nocturno' }, { id: 'protect', name: 'Protección del cabello antes de dormir' }],
    products: [], routines: [],
  },
  habits: [],
  cycle: { avgLen: 28, luteal: 14, bleed: 5, customSym: [] },
  schedule: {}, // día de la semana -> id de plantilla de entrenamiento
  water: { glass: 250 },
  dash: { sleep: true, steps: true, workout: true, protein: true, water: true, skinAM: true, skinPM: true, dental: true, shower: true, hair: true, reading: true },
  reminders: [],
  lastBackup: null,
});
export function mergeSettings(saved) {
  const d = defaultSettings();
  if (!saved) return d;
  return { ...d, ...saved, goals: { ...d.goals, ...saved.goals }, cycle: { ...d.cycle, ...saved.cycle }, dash: { ...d.dash, ...saved.dash }, skin: { ...d.skin, ...saved.skin }, hair: { ...d.hair, ...saved.hair }, water: { ...d.water, ...saved.water } };
}

/* ---------- Sueño ---------- */
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** Horas entre acostarse y levantarse; cruza medianoche si hace falta. La latencia se resta si se conoce. */
export function sleepHours(bed, wake, latency = 0) {
  if (!bed || !wake) return null;
  let d = mins(wake) - mins(bed);
  if (d <= 0) d += 1440;
  d -= Number(latency) || 0;
  return d > 0 ? round(d / 60, 2) : 0;
}

/* ---------- Pasos ---------- */
export function stepsStats(days, today, goal = 20000) {
  const rows = days.filter(d => d.steps != null).sort((a, b) => a.date < b.date ? -1 : 1);
  const within = n => rows.filter(d => d.date > addDays(today, -n) && d.date <= today).map(d => d.steps);
  const best = rows.reduce((b, d) => !b || d.steps > b.steps ? d : b, null);
  const hits = rows.filter(d => d.steps >= goal);
  let streak = 0, c = today;
  const map = new Map(rows.map(r => [r.date, r.steps]));
  if (!(map.get(c) >= goal)) c = addDays(c, -1);
  while (map.get(c) >= goal) { streak++; c = addDays(c, -1); }
  return { total: rows.length, avgAll: mean(rows.map(r => r.steps)), avg7: mean(within(7)), avg30: mean(within(30)), best, hits, streak };
}
/** Interpreta lo que deja el Atajo de iOS: "12345", "pasos:12345" o varias líneas "2026-11-03=12345". */
export function parseSteps(text, today) {
  const t = (text || '').trim(), out = [];
  const re = /(\d{4}-\d{2}-\d{2})\s*[=:;,\s]\s*(\d[\d.,]*)/g;
  let m;
  while ((m = re.exec(t))) { const v = cleanNum(m[2]); if (v != null) out.push({ date: m[1], steps: v }); }
  if (out.length) return out;
  const n = t.match(/\d[\d.,]*/);
  if (n) { const v = cleanNum(n[0]); if (v != null) return [{ date: today, steps: v }]; }
  return [];
}
function cleanNum(s) {
  const c = s.trim().replace(/[.\s]/g, '').replace(/,\d{1,2}$/, '').replace(/,/g, '');
  const v = Math.round(Number(c));
  return Number.isFinite(v) && v >= 0 && v < 300000 ? v : null;
}

/* ---------- Entrenamiento ---------- */
export const modeOf = t => t === 'cardio' ? 'cardio' : (t === 'movilidad' || t === 'estiramiento' || t === 'isométrico') ? 'time' : 'strength';
const doneSets = it => (it.sets || []).filter(s => s.kg != null || s.reps != null || s.secs != null || s.mins != null || s.km != null);
export const itemVolume = it => sum(doneSets(it).map(s => (Number(s.kg) || 0) * (Number(s.reps) || 0)));
export const workoutVolume = w => sum((w.items || []).map(itemVolume));
export const fmtSet = s => {
  if (s.mins != null || s.km != null) return [s.mins != null ? `${nf(s.mins, 1)} min` : '', s.km != null ? `${nf(s.km, 2)} km` : ''].filter(Boolean).join(', ');
  if (s.secs != null && s.reps == null) return `${nf(s.secs)} s`;
  return `${s.kg != null ? nf(s.kg, 2) + ' kg × ' : ''}${s.reps != null ? nf(s.reps) : '?'}`;
};
/** Historial de un ejercicio, del más reciente al más antiguo. */
export function exerciseHistory(workouts, exId, excludeId) {
  const out = [];
  for (const w of workouts) {
    if (w.id === excludeId) continue;
    for (const it of w.items || []) if (it.exId === exId && doneSets(it).length) out.push({ date: w.date, workoutId: w.id, item: it, sets: doneSets(it), volume: itemVolume(it), topKg: Math.max(0, ...doneSets(it).map(s => Number(s.kg) || 0)), topReps: Math.max(0, ...doneSets(it).map(s => Number(s.reps) || 0)) });
  }
  return out.sort((a, b) => a.date < b.date ? 1 : -1);
}
export function exerciseRecords(hist) {
  let kg = null, reps = null, vol = null;
  for (const h of hist) {
    for (const s of h.sets) {
      if (s.kg != null && s.kg > 0 && (!kg || s.kg > kg.kg || (s.kg === kg.kg && (s.reps || 0) > kg.reps))) kg = { kg: s.kg, reps: s.reps || 0, date: h.date };
      if (s.reps != null && (!reps || s.reps > reps.reps)) reps = { reps: s.reps, kg: s.kg, date: h.date };
    }
    if (!vol || h.volume > vol.volume) vol = { volume: h.volume, date: h.date };
  }
  return { kg, reps, vol };
}
export function monthlyProgress(hist) {
  const m = {};
  for (const h of hist) { const k = h.date.slice(0, 7); m[k] ||= { month: k, volume: 0, topKg: 0, sessions: 0 }; m[k].volume += h.volume; m[k].topKg = Math.max(m[k].topKg, h.topKg); m[k].sessions++; }
  return Object.values(m).sort((a, b) => a.month < b.month ? -1 : 1);
}
/** Sesiones por grupo muscular: una sesión cuenta una vez por grupo. */
export function groupFrequency(workouts, groupOf) {
  const c = {};
  for (const w of workouts) {
    const g = new Set((w.items || []).filter(i => doneSets(i).length).map(i => i.group || groupOf(i.exId)).filter(Boolean));
    g.forEach(x => { c[x] = (c[x] || 0) + 1; });
  }
  return c;
}
/** Marca de las series de esta sesión que superan el mejor peso o repeticiones anteriores. */
export function newRecords(item, hist) {
  const r = exerciseRecords(hist), out = [];
  const sets = doneSets(item);
  const kg = Math.max(0, ...sets.map(s => Number(s.kg) || 0)), reps = Math.max(0, ...sets.map(s => Number(s.reps) || 0));
  if (hist.length && kg > 0 && (!r.kg || kg > r.kg.kg)) out.push(`nuevo récord de peso: ${nf(kg, 2)} kg`);
  if (hist.length && reps > 0 && (!r.reps || reps > r.reps.reps)) out.push(`nuevo récord de repeticiones: ${reps}`);
  return out;
}

/* ---------- Nutrición ---------- */
export const NUTRIENTS = ['kcal', 'p', 'c', 'f', 'fiber', 'sugar'];
export const NUT_LABEL = { kcal: 'Calorías', p: 'Proteínas', c: 'Carbohidratos', f: 'Grasas', fiber: 'Fibra', sugar: 'Azúcares' };
/** Valores para una cantidad a partir de valores por 100. Un dato ausente sigue ausente: nunca se rellena. */
export function scale(per100, qty) {
  const o = {};
  for (const n of NUTRIENTS) o[n] = per100[n] == null ? null : per100[n] * qty / 100;
  return o;
}
export function totals(entries) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, sugar: 0, missing: {}, approx: false, count: entries.length };
  for (const e of entries) {
    for (const n of NUTRIENTS) { if (e[n] == null) t.missing[n] = true; else t[n] += e[n]; }
    if (e.approx !== false) t.approx = true;
  }
  return t;
}
/** Reparto energético de macronutrientes: 4/4/9 kcal por gramo. */
export function macroSplit(t) {
  const e = [t.p * 4, t.c * 4, t.f * 9], s = sum(e);
  return s ? { p: e[0] / s, c: e[1] / s, f: e[2] / s } : null;
}
/** Valores por 100 g de una receta, a partir de ingredientes guardados con sus cantidades. */
export function recipeNutrition(r) {
  const ing = r.ingredients || [];
  const whole = {}; for (const n of NUTRIENTS) whole[n] = ing.some(i => i[n] == null) ? null : sum(ing.map(i => i[n]));
  const rawWeight = sum(ing.map(i => i.qty));
  const weight = Number(r.cookedWeight) || rawWeight;
  const per100 = {}; for (const n of NUTRIENTS) per100[n] = whole[n] == null || !weight ? null : whole[n] / weight * 100;
  const portions = Number(r.servings) || 1;
  return { whole, weight, per100, portionWeight: weight / portions, approx: ing.some(i => i.approx !== false) };
}

/* ---------- Ciclo menstrual (siempre estimaciones) ---------- */
export const PHASES = { menstruacion: 'Menstruación', folicular: 'Fase folicular', ovulacion: 'Ovulación estimada', lutea: 'Fase lútea', retraso: 'Menstruación prevista sin registrar' };
export function cycleModel(periods, cfg, today) {
  const ps = [...periods].filter(p => p.start).sort((a, b) => a.start < b.start ? -1 : 1);
  const lengths = [];
  for (let i = 1; i < ps.length; i++) lengths.push(diffDays(ps[i].start, ps[i - 1].start));
  const recent = lengths.slice(-6);
  const avgLen = recent.length ? Math.round(mean(recent)) : cfg.avgLen;
  const sd = recent.length >= 2 ? Math.sqrt(mean(recent.map(l => (l - mean(recent)) ** 2))) : null;
  const bleeds = ps.filter(p => p.end).map(p => diffDays(p.end, p.start) + 1).slice(-6);
  const bleed = bleeds.length ? Math.round(mean(bleeds)) : cfg.bleed;
  const margin = sd == null ? null : Math.max(1, Math.round(sd));
  const luteal = cfg.luteal;
  const last = ps[ps.length - 1];
  let nextStart = last ? addDays(last.start, avgLen) : null;
  const late = nextStart && nextStart <= today ? diffDays(today, nextStart) : null;
  // Si la fecha prevista ya pasó, la siguiente previsión parte de mañana.
  const anchor = nextStart && nextStart <= today ? addDays(today, 1) : nextStart;
  const predictions = [];
  if (anchor) for (let i = 0; i < 12; i++) {
    const start = addDays(anchor, avgLen * i);
    predictions.push({ start, end: addDays(start, bleed - 1), ovulation: addDays(start, avgLen - luteal) });
  }
  return { ps, lengths, recent, avgLen, sd, margin, bleed, bleeds, luteal, last, nextStart, late, anchor, predictions, basedOn: recent.length, min: recent.length ? Math.min(...recent) : null, max: recent.length ? Math.max(...recent) : null, today };
}
function phaseIn(date, start, bleedEnd, nextStart, luteal) {
  let ov = addDays(nextStart, -luteal);
  if (ov <= bleedEnd) ov = addDays(bleedEnd, 1);
  if (date <= bleedEnd) return 'menstruacion';
  if (date >= addDays(ov, -1) && date <= addDays(ov, 1)) return 'ovulacion';
  return date < ov ? 'folicular' : 'lutea';
}
/** Fase de una fecha; est=true cuando depende de una previsión y no de un ciclo ya cerrado. */
export function phaseFor(date, m) {
  if (!m.last || date < m.ps[0].start) return null;
  for (let i = m.ps.length - 1; i >= 0; i--) {
    const p = m.ps[i];
    if (date < p.start) continue;
    const known = m.ps[i + 1]?.start;
    const bleedEnd = p.end || addDays(p.start, m.bleed - 1);
    if (known) return { phase: phaseIn(date, p.start, bleedEnd, known, m.luteal), day: diffDays(date, p.start) + 1, est: false, len: diffDays(known, p.start), start: p.start };
    const next = m.nextStart;
    if (date < next) return { phase: phaseIn(date, p.start, bleedEnd, next, m.luteal), day: diffDays(date, p.start) + 1, est: true, len: m.avgLen, start: p.start };
    if (date <= m.today || date < m.anchor) return { phase: 'retraso', day: diffDays(date, p.start) + 1, est: true, len: m.avgLen, start: p.start };
    // Futuro más allá de la siguiente previsión
    const n = Math.floor(diffDays(date, m.anchor) / m.avgLen);
    const st = addDays(m.anchor, n * m.avgLen);
    return { phase: phaseIn(date, st, addDays(st, m.bleed - 1), addDays(st, m.avgLen), m.luteal), day: diffDays(date, st) + 1, est: true, len: m.avgLen, start: st, predicted: true };
  }
  return null;
}

/* ---------- Cumplimiento diario ---------- */
export const scheduledOn = (list, date) => (list || []).filter(p => (p.days || []).includes(weekday(date)));
const frac = (a, b) => b > 0 ? clamp(a / b, 0, 1) : 0;
export function waterTotal(day) { return sum((day.water || []).map(w => w.ml)); }
export function pagesTotal(day) { return sum((day.reading || []).map(r => r.pages)); }
export function isHairDone(day, S) {
  const h = day.hair || {};
  if (h.type === 'wash') return !!h.items?.washed;
  if (h.type === 'nowash') return Object.values(h.items || {}).some(Boolean);
  return false;
}
/** Conjunto de indicadores de un día. Cada uno aporta su progreso de 0 a 1. */
export function dayItems(date, day, foods, workouts, S, plannedName) {
  const g = S.goals, m = day.manual || {}, out = [];
  const add = (key, label, route, progress, detail, extra = {}) => {
    const manual = m[key] === true;
    if (S.dash[key] === false && !extra.habit) return;
    out.push({ key, label, route, pct: manual ? 1 : progress, done: manual || progress >= 1, computedDone: progress >= 1, manual, detail, ...extra });
  };
  const sl = day.sleep || {};
  const sh = sleepHours(sl.bed, sl.wake, sl.latency);
  add('sleep', 'Sueño', 'sueno', sh == null ? 0 : frac(sh, g.sleep), sh == null ? 'Sin registrar' : `${hours(sh)} de ${nf(g.sleep, 1)} h`);
  add('steps', 'Pasos', 'pasos', frac(day.steps || 0, g.steps), `${nf(day.steps || 0)} de ${nf(g.steps)}`);
  const done = workouts.filter(w => w.status === 'done');
  const planned = plannedName != null;
  // Sin entreno programado ni hecho, el día de descanso no resta.
  if (planned || done.length || m.workout) add('workout', 'Entrenamiento', 'entreno', done.length ? 1 : 0, done.length ? `Completado: ${done.map(w => w.name).join(', ')}` : `Programado: ${plannedName}`);
  const t = totals(foods);
  add('protein', 'Proteína', 'comida', frac(t.p, g.protein), `${nf(t.p)} de ${nf(g.protein)} g`);
  const ml = waterTotal(day);
  add('water', 'Agua', 'agua', frac(ml, g.water), `${nf(ml / 1000, 2)} de ${nf(g.water / 1000, 2)} L`);
  for (const [key, part, label] of [['skinAM', 'am', 'Rutina facial de mañana'], ['skinPM', 'pm', 'Rutina facial de noche']]) {
    const list = scheduledOn(S.skin[part], date), log = day.skin?.[part] || {};
    const n = list.filter(p => log[p.id]?.done).length;
    if (list.length) add(key, label, 'skincare', frac(n, list.length), `${n} de ${list.length} productos`);
  }
  const dl = S.dental.filter(d => d.counts), dd = day.dental || {};
  const dn = dl.filter(d => dd[d.id]).length;
  add('dental', 'Higiene dental', 'dental', frac(dn, dl.length), `${dn} de ${dl.length} hechos`);
  add('shower', 'Ducha', 'ducha', day.shower?.done ? 1 : 0, day.shower?.done ? (day.shower.time ? `A las ${day.shower.time}` : 'Hecha') : 'Pendiente');
  const hd = isHairDone(day, S);
  add('hair', 'Cuidado capilar', 'pelo', hd ? 1 : 0, day.hair?.type === 'wash' ? (hd ? 'Día de lavado' : 'Día de lavado, pendiente') : day.hair?.type === 'nowash' ? (hd ? 'Día sin lavado' : 'Día sin lavado, pendiente') : 'Pendiente');
  const pg = pagesTotal(day);
  add('reading', 'Lectura', 'lectura', frac(pg, g.pages), `${pg} de ${g.pages} páginas`);
  for (const h of S.habits || []) {
    if (h.days && !h.days.includes(weekday(date))) continue;
    add('h_' + h.id, h.name, 'habitos', day.habits?.[h.id] ? 1 : 0, day.habits?.[h.id] ? 'Hecho' : 'Pendiente', { habit: h.id });
  }
  return out;
}
export const compliance = items => items.length ? mean(items.map(i => i.pct)) : 0;

/** Días desde el último lavado de pelo, a partir de los registros. */
export function lastWash(days, today) {
  const w = days.filter(d => d.date <= today && d.hair?.items?.washed).map(d => d.date).sort();
  const last = w[w.length - 1] || null;
  return { last, since: last ? diffDays(today, last) : null, count: w.length };
}
/** Comparación de una medida corporal con su primer registro y con otra fecha. */
export function bodySeries(rows, field) {
  return rows.filter(r => r[field] != null).sort((a, b) => a.date < b.date ? -1 : 1).map(r => ({ date: r.date, v: r[field] }));
}
export function bodyDelta(rows, field, date) {
  const s = bodySeries(rows, field);
  if (!s.length) return null;
  const cur = date ? s.filter(x => x.date <= date).pop() : s[s.length - 1];
  if (!cur) return null;
  return { first: s[0], current: cur, diff: round(cur.v - s[0].v, 2) };
}
/** Racha y constancia de una condición sobre fechas. */
export function consistency(dates, test) {
  const n = dates.filter(test).length;
  return { n, of: dates.length, rate: dates.length ? n / dates.length : 0 };
}
