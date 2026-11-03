// Más, calendario general y estadísticas.
import { A, routes, state, S, render, go, sheet, closeSheet, ICON, chips, empty, stat } from '../ui.js';
import { all, range } from '../db.js';
import { esc, nf, todayStr, addDays, dateRange, fmtShort, fmtFull, fmtMonth, endOfMonth, weekday, toDate, WD_SHORT, mean, sum, startOfWeek, hours } from '../util.js';
import { dayItems, compliance, sleepHours, totals, waterTotal, pagesTotal, PHASES, phaseFor, isHairDone, scheduledOn, workoutVolume, exerciseHistory, bodySeries } from '../domain.js';
import { corolla, barChart, lineChart, C } from '../charts.js';
import { rangeCtx, model, dayCtx } from './shared.js';
import { BODY, MOOD } from './life.js';
import { GROUPS } from '../data/exercises.js';

routes.mas = {
  title: 'Más',
  render() {
    const entries = [['pasos', 'Pasos', `Objetivo: ${nf(S.goals.steps)}`], ['agua', 'Hidratación', 'Vasos y botellas'], ['skincare', 'Skincare', 'Mañana y noche'], ['dental', 'Higiene dental', 'Cepillado e hilo'], ['ducha', 'Ducha e higiene', 'Registro corporal'], ['pelo', 'Cuidado capilar', 'Días de lavado'], ['lectura', 'Lectura', `${S.goals.pages} páginas al día`], ['cuerpo', 'Peso y medidas', 'Evolución física'], ['sueno', 'Sueño', 'Horas y calidad'], ['animo', 'Ánimo y energía', 'Recuperación'], ['habitos', 'Mis hábitos', 'Los que añadas'], ['calendario', 'Calendario', 'Todo tu mes'], ['estadisticas', 'Estadísticas', 'Gráficos por periodo'], ['ajustes', 'Ajustes', 'Objetivos, copias, avisos']];
    return `<div class="page"><h1>Más</h1><ul class="moregrid">${entries.map(([r, t, s]) => `<li><button data-a="go" data-to="${r}"><b>${t}</b><span>${esc(s)}</span></button></li>`).join('')}</ul></div>`;
  },
};

/* ---------- Calendario ---------- */
const FLAGS = [['train', 'Entrené'], ['steps', 'Pasos'], ['protein', 'Proteína'], ['skin', 'Skincare'], ['hair', 'Lavé el pelo'], ['read', 'Lectura'], ['hyg', 'Higiene'], ['sleep', 'Sueño']];
function flagsOf(date, r) {
  const d = r.dayMap.get(date) || {}, f = r.foodMap.get(date) || [], w = r.wMap.get(date) || [], o = {};
  o.train = w.some(x => x.status === 'done');
  o.steps = (d.steps || 0) >= S.goals.steps;
  o.protein = totals(f).p >= S.goals.protein;
  const skinList = [...scheduledOn(S.skin.am, date).map(p => ['am', p]), ...scheduledOn(S.skin.pm, date).map(p => ['pm', p])];
  o.skin = skinList.length > 0 && skinList.every(([part, p]) => d.skin?.[part]?.[p.id]?.done);
  o.hair = !!d.hair?.items?.washed;
  o.read = pagesTotal(d) >= S.goals.pages;
  const den = S.dental.filter(x => x.counts);
  o.hyg = den.length > 0 && den.every(x => d.dental?.[x.id]) && !!d.shower?.done;
  const sh = d.sleep ? sleepHours(d.sleep.bed, d.sleep.wake, d.sleep.latency) : null;
  o.sleep = sh != null && sh >= S.goals.sleep;
  return o;
}
let calMonth = null, calFilter = '';
routes.calendario = {
  title: 'Calendario', back: true,
  async render() {
    const t = todayStr(); calMonth ||= t.slice(0, 7);
    const first = calMonth + '-01', last = endOfMonth(first), r = await rangeCtx(first, last);
    const shift = n => { const d = toDate(calMonth + '-15'); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const lead = (weekday(first) + 6) % 7, ds = dateRange(first, last);
    const counts = Object.fromEntries(FLAGS.map(([k]) => [k, 0]));
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (const d of ds) {
      const fl = flagsOf(d, r); FLAGS.forEach(([k]) => { if (fl[k]) counts[k]++; });
      const items = d <= t ? dayItems(d, r.dayMap.get(d) || {}, r.foodMap.get(d) || [], r.wMap.get(d) || [], S, null) : [];
      const sel = calFilter ? fl[calFilter] : false;
      cells += `<button class="cgen ${d === t ? 'today' : ''} ${sel ? 'hit' : ''} ${calFilter && !sel ? 'dim' : ''}" data-a="calDay" data-d="${d}" ${d > t ? 'disabled' : ''} aria-label="${fmtFull(d)}">${calFilter ? '' : items.length && compliance(items) > 0 ? corolla(items, { size: 36, tiny: true }) : ''}<span>${+d.slice(8)}</span></button>`;
    }
    return `<div class="page"><div class="cal-nav"><button data-a="calMonth" data-m="${shift(-1)}" aria-label="Mes anterior">${ICON.back}</button><h2>${fmtMonth(first)}</h2><button data-a="calMonth" data-m="${shift(1)}" ${calMonth >= t.slice(0, 7) ? 'disabled' : ''} aria-label="Mes siguiente">${ICON.next}</button></div>
    <div class="chips"><button class="chip ${!calFilter ? 'on' : ''}" data-a="calFilter" data-v="">Todo</button>${FLAGS.map(([k, l]) => `<button class="chip ${calFilter === k ? 'on' : ''}" data-a="calFilter" data-v="${k}">${l}: ${counts[k]}</button>`).join('')}</div>
    <div class="cal-h">${[1, 2, 3, 4, 5, 6, 0].map(k => `<span>${WD_SHORT[k]}</span>`).join('')}</div><div class="cal-g gen">${cells}</div>
    <p class="muted small">${calFilter ? `Marcados: días en los que se cumple «${FLAGS.find(x => x[0] === calFilter)[1]}».` : 'Cada flor se llena con lo que completaste. Toca un día para ver todos sus registros.'}</p></div>`;
  },
};
A.calMonth = async el => { calMonth = el.dataset.m; await render(); };
A.calFilter = async el => { calFilter = el.dataset.v; await render(); };
A.calDay = async el => {
  const d = el.dataset.d, c = await dayCtx(d), m = await model(), ph = phaseFor(d, m), day = c.day, t = c.totals, sl = day.sleep;
  const sh = sl ? sleepHours(sl.bed, sl.wake, sl.latency) : null;
  const moodRows = MOOD.filter(([k]) => day.mood?.[k] != null).map(([k, l]) => `${l}: ${day.mood[k]}`);
  sheet(fmtFull(d), () => `<p class="lead">${Math.round(c.pct * 100)} % del día completado.</p><ul class="plain-list detail">
    ${ph ? `<li><b>Ciclo</b>${esc(PHASES[ph.phase])}, día ${ph.day}${ph.est ? ' (estimado)' : ''}</li>` : ''}
    <li><b>Pasos</b>${nf(day.steps || 0)}</li><li><b>Sueño</b>${sh == null ? 'Sin registrar' : `${hours(sh)} (de ${sl.bed} a ${sl.wake})`}</li>
    <li><b>Entrenamiento</b>${c.workouts.length ? c.workouts.map(w => `${esc(w.name)}, ${nf(workoutVolume(w))} kg`).join('; ') : 'Ninguno'}</li>
    <li><b>Comida</b>${t.count ? `≈ ${nf(t.kcal)} kcal, ${nf(t.p)} g de proteína` : 'Sin registrar'}</li><li><b>Agua</b>${nf(waterTotal(day))} ml</li>
    ${c.items.filter(i => ['skinAM', 'skinPM', 'dental', 'shower', 'hair', 'reading'].includes(i.key) || i.habit).map(i => `<li><b>${esc(i.label)}</b>${esc(i.detail)}</li>`).join('')}
    ${moodRows.length ? `<li><b>Ánimo</b>${esc(moodRows.join(', '))}</li>` : ''}</ul>
    <button class="btn wide" data-a="calOpen" data-d="${d}">Abrir y editar este día</button>`);
};
A.calOpen = el => { state.date = el.dataset.d; closeSheet(); go('hoy'); };

/* ---------- Estadísticas ---------- */
let span = 30, exercise = '', bodyF = 'weight', statHidden = {};
function buckets(ds) {
  if (ds.length <= 31) return { groups: ds.map(d => [d]), labels: ds.map(fmtShort), by: 'día' };
  const size = ds.length <= 100 ? 7 : ds.length <= 200 ? 7 : 30, groups = [], labels = [];
  for (let i = 0; i < ds.length; i += size) { const g = ds.slice(i, i + size); groups.push(g); labels.push(fmtShort(g[0])); }
  return { groups, labels, by: size === 7 ? 'semana' : 'mes' };
}
routes.estadisticas = {
  title: 'Estadísticas', back: true,
  async render() {
    const t = todayStr(), from = addDays(t, -(span - 1)), ds = dateRange(from, t), r = await rangeCtx(from, t), b = buckets(ds), m = await model();
    const allW = (await all('workouts')).filter(w => w.status === 'done');
    const bodyRows = await all('body');
    const avg = fn => b.groups.map(g => mean(g.map(fn)));
    const dayOf = d => r.dayMap.get(d) || {};
    const totOf = d => r.foodMap.has(d) ? totals(r.foodMap.get(d)) : null;
    const sleepOf = d => { const s = dayOf(d).sleep; return s ? sleepHours(s.bed, s.wake, s.latency) : null; };
    const hygOf = d => { const x = dayOf(d), de = S.dental.filter(i => i.counts); if (!x.dental && !x.shower) return null; return (de.filter(i => x.dental?.[i.id]).length + (x.shower?.done ? 1 : 0)) / (de.length + 1) * 100; };
    const weeks = []; for (let w = startOfWeek(from); w <= t; w = addDays(w, 7)) weeks.push(w);
    // Ejercicios con historial
    const used = new Map(); allW.forEach(w => w.items.forEach(i => { if (i.mode === 'strength') used.set(i.exId, i.name); }));
    const list = [...used.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
    if (!used.has(exercise)) exercise = list[0]?.[0] || '';
    const hist = exercise ? exerciseHistory(allW, exercise).filter(h => h.date >= from).reverse() : [];
    const bs = bodySeries(bodyRows, bodyF).filter(x => x.date >= from), bf = BODY.find(x => x[0] === bodyF);
    const cycles = m.lengths.slice(-12), cLabels = m.ps.slice(1).slice(-12).map(p => fmtShort(p.start));
    const per = b.by === 'día' ? '' : ` (media por ${b.by})`;
    return `<div class="page">${chips([[7, '7 días'], [30, '30 días'], [90, '3 meses'], [180, '6 meses'], [365, '1 año']], span, 'statSpan')}
    ${lineOrBar('Pasos diarios' + per, avg(d => dayOf(d).steps ?? null), b.labels, S.goals.steps, '')}
    ${barChart({ title: 'Entrenamientos por semana', values: weeks.map(w => allW.filter(x => x.date >= w && x.date < addDays(w, 7)).length), labels: weeks.map(fmtShort), name: 'Sesiones', empty: 'Termina sesiones para ver este gráfico.' })}
    ${list.length ? `<label class="field"><span>Progresión de cargas: ejercicio</span><select data-c="statEx">${list.map(([id, n]) => `<option value="${id}" ${id === exercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}
    ${lineChart({ title: 'Progresión de cargas', series: [{ name: 'Carga máxima', color: C.a, values: hist.map(h => h.topKg || null) }], labels: hist.map(h => fmtShort(h.date)), unit: 'kg', d: 1, empty: 'Registra ejercicios con peso para ver tu progresión.' })}
    ${lineOrBar('Calorías (aproximadas)' + per, avg(d => totOf(d)?.kcal ?? null), b.labels, S.goals.kcal, 'kcal')}
    ${lineChart({ title: 'Macronutrientes (aproximados)' + per, series: [{ name: 'Proteínas', color: C.a, values: avg(d => totOf(d)?.p ?? null) }, { name: 'Carbohidratos', color: C.b, values: avg(d => totOf(d)?.c ?? null) }, { name: 'Grasas', color: C.c, values: avg(d => totOf(d)?.f ?? null) }], labels: b.labels, unit: 'g', empty: 'Añade alimentos para ver tus macronutrientes.' })}
    ${lineOrBar('Consumo de agua' + per, avg(d => { const v = waterTotal(dayOf(d)); return v || null; }), b.labels, S.goals.water, 'ml')}
    <div class="chips">${BODY.map(([k, l]) => `<button class="chip ${k === bodyF ? 'on' : ''}" data-a="statBody" data-v="${k}">${l}</button>`).join('')}</div>
    ${lineChart({ title: `${bf[1]} (${bf[2]})`, series: [{ name: bf[1], color: C.a, values: bs.map(x => x.v) }], labels: bs.map(x => fmtShort(x.date)), unit: bf[2], d: 1, empty: 'Sin mediciones en este periodo.' })}
    ${lineOrBar('Horas de sueño' + per, avg(sleepOf), b.labels, S.goals.sleep, 'h', 1)}
    ${lineOrBar('Páginas leídas' + per, avg(d => pagesTotal(dayOf(d)) || null), b.labels, S.goals.pages, '')}
    ${lineChart({ title: 'Cumplimiento de higiene' + per, series: [{ name: 'Higiene', color: C.a, values: avg(hygOf) }], labels: b.labels, unit: '%', min: 0, max: 100, empty: 'Marca higiene dental y ducha para ver este gráfico.' })}
    ${barChart({ title: 'Evolución del ciclo: duración', values: cycles, labels: cLabels, unit: 'días', name: 'Días', empty: 'Con dos menstruaciones verás la primera duración.' })}
    ${lineChart({ title: 'Estado de ánimo y energía' + per, series: [{ name: 'Ánimo', color: C.a, values: avg(d => dayOf(d).mood?.mood ?? null) }, { name: 'Energía', color: C.b, values: avg(d => dayOf(d).mood?.energy ?? null) }], labels: b.labels, min: 1, max: 10, d: 1, empty: 'Registra ánimo y energía para ver este gráfico.' })}
    </div>`;
  },
};
const lineOrBar = (title, values, labels, goal, unit, d = 0) => values.length > 31 ? lineChart({ title, series: [{ name: title, color: C.a, values }], labels, goal, unit, d }) : barChart({ title, values, labels, goal, unit, d, name: title.split(' (')[0] });
A.statSpan = async el => { span = +el.dataset.v; await render(); };
A.statBody = async el => { bodyF = el.dataset.v; await render(); };
import('../ui.js').then(({ CH }) => { CH.statEx = async el => { exercise = el.value; await render(); }; });
