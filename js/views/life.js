// Lectura, peso y medidas, sueño, estado de ánimo.
import { A, CH, routes, state, S, render, toast, sheet, closeSheet, refreshSheet, confirmDlg, stat, field, numInput, ICON, empty, dateNav, saveSettings, chips, scale } from '../ui.js';
import { all, get, put, del, getDay, updDay, range } from '../db.js';
import { esc, nf, uid, todayStr, addDays, fmtShort, fmtFull, dateRange, numOrNull, hours, mean, sum, round, startOfWeek, fmtMonth } from '../util.js';
import { sleepHours, pagesTotal, bodySeries, bodyDelta, cycleModel, phaseFor, PHASES, workoutVolume } from '../domain.js';
import { barChart, lineChart, progress, C } from '../charts.js';
import { addPhoto, photoGrid } from './photos.js';
import { model } from './shared.js';

/* ---------- Lectura ---------- */
routes.lectura = {
  title: 'Lectura', back: true,
  async render() {
    const date = state.date, day = await getDay(date), t = todayStr(), books = await all('books'), days = await all('days'), goal = S.goals.pages;
    const read = pagesTotal(day), extra = Math.max(read - goal, 0);
    const reading = books.filter(b => b.status === 'leyendo'), pend = books.filter(b => b.status === 'pendiente'), done = books.filter(b => b.status === 'terminado').sort((a, b) => (a.finished < b.finished ? 1 : -1));
    const withP = days.filter(d => pagesTotal(d) > 0), total = sum(withP.map(pagesTotal));
    const y = t.slice(0, 4), m = t.slice(0, 7);
    const ds = dateRange(addDays(t, -29), t), map = new Map(days.map(d => [d.date, pagesTotal(d)]));
    const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(+y, new Date().getMonth() - 11 + i, 15); return d.toISOString().slice(0, 7); });
    const hist = withP.sort((a, b) => a.date < b.date ? 1 : -1);
    return `<div class="page">${dateNav()}
    <section class="readhead"><b>${read}</b><span>de ${goal} páginas</span>${progress(read / goal)}<p class="lead">${read >= goal ? `Objetivo cumplido${extra ? `, +${extra} páginas adicionales` : ''}.` : read ? `Faltan ${goal - read} páginas.` : 'Aún sin lectura este día.'}</p></section>
    <form data-s="readAdd" class="readform"><div class="grid2">${field('Páginas leídas', '<input name="p" type="number" inputmode="numeric" min="1" required>')}${field('Libro', `<select name="b"><option value="">Sin indicar</option>${[...reading, ...pend].map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('')}</select>`)}</div><button class="btn wide">Registrar páginas</button></form>
    ${(day.reading || []).length ? `<ul class="list">${day.reading.map((r, i) => `<li><span class="grow">${esc(r.title || 'Sin libro indicado')}</span><b>${r.pages} págs.</b><button class="icon" data-a="readDel" data-i="${i}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : ''}
    <section class="stats">${stat('Páginas totales', nf(total))}${stat('Este mes', nf(sum(withP.filter(d => d.date.startsWith(m)).map(pagesTotal))))}${stat('Este año', nf(sum(withP.filter(d => d.date.startsWith(y)).map(pagesTotal))))}${stat('Días con objetivo', nf(withP.filter(d => pagesTotal(d) >= goal).length))}${stat('Libros terminados', nf(done.length))}${stat('Terminados este año', nf(done.filter(b => (b.finished || '').startsWith(y)).length))}</section>
    <h2>Leyendo ahora</h2>${bookList(reading)}<h2>Pendientes</h2>${bookList(pend)}<h2>Terminados</h2>${bookList(done)}
    <button class="btn ghost wide" data-a="bookNew">Añadir libro</button>
    ${barChart({ title: 'Páginas por día, últimos 30 días', values: ds.map(d => map.get(d) || null), labels: ds.map(fmtShort), goal, name: 'Páginas' })}
    ${barChart({ title: 'Páginas por mes', values: months.map(k => sum(withP.filter(d => d.date.startsWith(k)).map(pagesTotal))), labels: months.map(k => fmtMonth(k + '-15').slice(0, 3)), name: 'Páginas' })}
    <h2>Historial diario</h2>${hist.length ? `<ul class="list">${hist.slice(0, 40).map(d => `<li><span class="grow">${fmtFull(d.date)}</span><b>${pagesTotal(d)} págs.</b></li>`).join('')}</ul>` : empty('Registra tus páginas para empezar el historial.')}</div>`;
  },
};
const bookList = l => l.length ? `<ul class="list">${l.map(b => `<li><button class="grow textbtn" data-a="bookEdit" data-id="${b.id}"><b>${esc(b.title)}</b><small>${esc(b.author || '')}${b.finished ? `${b.author ? ', ' : ''}terminado el ${fmtShort(b.finished)}` : ''}${b.pages ? `${b.author || b.finished ? ', ' : ''}${b.pages} págs.` : ''}</small></button></li>`).join('')}</ul>` : '<p class="muted small">Ninguno por ahora.</p>';
A.readAdd = async f => {
  const p = numOrNull(f.p.value); if (!p) return toast('Escribe las páginas leídas.');
  const b = f.b.value ? await get('books', f.b.value) : null;
  await updDay(state.date, d => { (d.reading ||= []).push({ pages: Math.round(p), bookId: b?.id || null, title: b?.title || null }); });
  if (b && b.status === 'pendiente') { b.status = 'leyendo'; await put('books', b); }
  toast('Páginas registradas'); await render();
};
A.readDel = async el => { await updDay(state.date, d => { d.reading.splice(+el.dataset.i, 1); }); await render(); };
const bookForm = b => `<form data-s="bookSave" data-id="${b.id || ''}">${field('Título', `<input name="title" required value="${esc(b.title || '')}">`)}${field('Autoría', `<input name="author" value="${esc(b.author || '')}">`)}
  <div class="grid2">${field('Páginas del libro', numInput('pages', b.pages))}${field('Estado', `<select name="status">${[['pendiente', 'Pendiente'], ['leyendo', 'Leyendo'], ['terminado', 'Terminado']].map(([k, l]) => `<option value="${k}" ${(b.status || 'leyendo') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
  ${field('Fecha de fin', `<input name="finished" type="date" value="${b.finished || ''}">`, 'Si está terminado y lo dejas en blanco, se usa la fecha de hoy.')}
  <button class="btn wide">Guardar libro</button>${b.id ? `<button type="button" class="btn ghost danger-t wide" data-a="bookDel" data-id="${b.id}">Eliminar libro</button>` : ''}</form>`;
A.bookNew = () => sheet('Añadir libro', () => bookForm({}));
A.bookEdit = async el => { const b = await get('books', el.dataset.id); sheet('Libro', () => bookForm(b)); };
A.bookSave = async f => { const st = f.status.value; await put('books', { id: f.dataset.id || uid(), title: f.title.value.trim(), author: f.author.value.trim(), pages: numOrNull(f.pages.value), status: st, finished: st === 'terminado' ? (f.finished.value || todayStr()) : null }); closeSheet(); toast('Libro guardado'); await render(); };
A.bookDel = async el => { if (!await confirmDlg('¿Eliminar este libro? Las páginas registradas se conservan.')) return; await del('books', el.dataset.id); closeSheet(); await render(); };

/* ---------- Cuerpo ---------- */
export const BODY = [['weight', 'Peso corporal', 'kg'], ['waist', 'Cintura', 'cm'], ['abdomen', 'Abdomen', 'cm'], ['hip', 'Cadera', 'cm'], ['chest', 'Pecho', 'cm'], ['armR', 'Brazo derecho', 'cm'], ['armL', 'Brazo izquierdo', 'cm'], ['thighR', 'Muslo derecho', 'cm'], ['thighL', 'Muslo izquierdo', 'cm'], ['calf', 'Pantorrilla', 'cm']];
let bodyField = 'weight', cmpA = '', cmpB = '';
routes.cuerpo = {
  title: 'Peso y medidas', back: true,
  async render() {
    const rows = (await all('body')).sort((a, b) => a.date < b.date ? -1 : 1), photos = (await all('photos')).filter(p => p.kind === 'cuerpo').sort((a, b) => a.date < b.date ? 1 : -1);
    const f = BODY.find(b => b[0] === bodyField), s = bodySeries(rows, bodyField);
    const dates = rows.map(r => r.date);
    const a = cmpA && dates.includes(cmpA) ? cmpA : dates[0], b = cmpB && dates.includes(cmpB) ? cmpB : dates[dates.length - 1];
    const ra = rows.find(r => r.date === a), rb = rows.find(r => r.date === b);
    const ws = await all('workouts'), t = todayStr(), wk = dateRange(addDays(t, -83), t).filter((_, i) => i % 7 === 0);
    return `<div class="page"><button class="btn wide" data-a="bodyNew">Añadir medición</button>
    <p class="muted small">El peso es un dato más: mira también tus medidas y tu fuerza, debajo.</p>
    ${rows.length ? `<h2>Respecto al primer registro</h2><div class="scroll-x"><table class="tbl"><thead><tr><th></th><th>Primero</th><th>Actual</th><th>Cambio</th></tr></thead><tbody>${BODY.map(([k, l, u]) => { const d = bodyDelta(rows, k); return d ? `<tr><th>${l}</th><td>${nf(d.first.v, 1)}</td><td>${nf(d.current.v, 1)}</td><td>${d.diff > 0 ? '+' : ''}${nf(d.diff, 1)} ${u}</td></tr>` : ''; }).join('')}</tbody></table></div>` : empty('Añade tu primera medición. Solo hace falta rellenar lo que quieras medir.')}
    <h2>Evolución por medida</h2><div class="chips">${BODY.map(([k, l]) => `<button class="chip ${k === bodyField ? 'on' : ''}" data-a="bodyField" data-v="${k}">${l}</button>`).join('')}</div>
    ${lineChart({ title: `${f[1]} (${f[2]})`, series: [{ name: f[1], color: C.a, values: s.map(x => x.v) }], labels: s.map(x => fmtShort(x.date)), unit: f[2], d: 1, empty: 'Sin registros de esta medida.' })}
    ${weeklyMonthly(s, f)}
    ${barChart({ title: 'Fuerza: volumen semanal de entrenamiento', values: wk.map(w => sum(ws.filter(x => x.status === 'done' && x.date >= w && x.date < addDays(w, 7)).map(workoutVolume))), labels: wk.map(fmtShort), unit: 'kg', name: 'Volumen', empty: 'Tus sesiones aparecerán aquí.' })}
    ${rows.length > 1 ? `<h2>Comparar fechas</h2><div class="grid2">${field('Desde', `<select data-c="cmp" data-k="a">${dates.map(d => `<option ${d === a ? 'selected' : ''} value="${d}">${fmtFull(d)}</option>`).join('')}</select>`)}${field('Hasta', `<select data-c="cmp" data-k="b">${dates.map(d => `<option ${d === b ? 'selected' : ''} value="${d}">${fmtFull(d)}</option>`).join('')}</select>`)}</div>
    <table class="tbl"><tbody>${BODY.map(([k, l, u]) => ra[k] != null && rb[k] != null ? `<tr><th>${l}</th><td>${nf(ra[k], 1)}</td><td>${nf(rb[k], 1)}</td><td>${rb[k] - ra[k] > 0 ? '+' : ''}${nf(rb[k] - ra[k], 1)} ${u}</td></tr>` : '').join('')}</tbody></table>` : ''}
    <h2>Fotos de progreso</h2>${photoGrid(photos)}<label class="btn ghost wide fileb">Añadir foto<input type="file" accept="image/*" data-c="bodyPhoto" hidden></label>
    <h2>Historial completo</h2>${rows.length ? `<ul class="list">${[...rows].reverse().map(r => `<li><button class="grow textbtn" data-a="bodyEdit" data-id="${r.id}"><b>${fmtFull(r.date)}</b><small>${BODY.filter(([k]) => r[k] != null).map(([k, l, u]) => `${l} ${nf(r[k], 1)} ${u}`).join(', ')}</small></button><button class="icon" data-a="bodyDel" data-id="${r.id}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : ''}</div>`;
  },
};
function weeklyMonthly(s, f) {
  if (s.length < 2) return '';
  const cur = s[s.length - 1], near = n => s.filter(x => x.date <= addDays(cur.date, -n)).pop();
  const fmt = p => p ? `${cur.v - p.v > 0 ? '+' : ''}${nf(cur.v - p.v, 1)} ${f[2]}` : '—';
  return `<section class="stats">${stat('En una semana', fmt(near(7)))}${stat('En un mes', fmt(near(30)))}${stat('Desde el inicio', fmt(s[0]))}</section>`;
}
A.bodyField = async el => { bodyField = el.dataset.v; await render(); };
CH.cmp = async el => { if (el.dataset.k === 'a') cmpA = el.value; else cmpB = el.value; await render(); };
CH.bodyPhoto = async el => { await addPhoto(el.files[0], 'cuerpo', todayStr()); await render(); };
const bodyForm = r => `<form data-s="bodySave" data-id="${r.id || ''}">${field('Fecha', `<input name="date" type="date" required max="${todayStr()}" value="${r.date || todayStr()}">`)}<div class="grid2">${BODY.map(([k, l, u]) => field(`${l} (${u})`, numInput(k, r[k]))).join('')}</div><button class="btn wide">Guardar medición</button></form>`;
A.bodyNew = () => sheet('Añadir medición', () => bodyForm({}));
A.bodyEdit = async el => { const r = await get('body', el.dataset.id); sheet('Editar medición', () => bodyForm(r)); };
A.bodySave = async f => { const r = { id: f.dataset.id || uid(), date: f.date.value }; let any = false; BODY.forEach(([k]) => { r[k] = numOrNull(f[k].value); if (r[k] != null) any = true; }); if (!any) return toast('Rellena al menos una medida.'); await put('body', r); closeSheet(); toast('Medición guardada'); await render(); };
A.bodyDel = async el => { if (!await confirmDlg('¿Eliminar esta medición?')) return; await del('body', el.dataset.id); await render(); };

/* ---------- Sueño ---------- */
let sleepSpan = 30;
routes.sueno = {
  title: 'Sueño y descanso', back: true,
  async render() {
    const date = state.date, day = await getDay(date), s = day.sleep || {}, t = todayStr(), h = sleepHours(s.bed, s.wake, s.latency);
    const from = addDays(t, -(sleepSpan - 1)), days = await range('days', from, t), map = new Map(days.map(d => [d.date, d.sleep ? sleepHours(d.sleep.bed, d.sleep.wake, d.sleep.latency) : null]));
    const ds = dateRange(from, t), vals = ds.map(d => map.get(d) ?? null), goal = S.goals.sleep;
    const w = vals.slice(-7), rated = days.filter(d => d.sleep?.quality);
    return `<div class="page">${dateNav()}<section class="center-col"><b class="huge">${h == null ? '—' : hours(h)}</b><span class="muted">de ${nf(goal, 1)} h previstas${h != null ? `. Noche que termina el ${fmtShort(date)}` : ''}</span></section>
    <form data-s="noop" class="grid2">${field('Me acosté', `<input type="time" value="${s.bed || ''}" data-c="sleepF" data-f="bed">`)}${field('Me levanté', `<input type="time" value="${s.wake || ''}" data-c="sleepF" data-f="wake">`)}
    ${field('Tardé en dormirme (min)', `<input type="number" inputmode="numeric" min="0" value="${s.latency ?? ''}" placeholder="Si lo sabes" data-c="sleepF" data-f="latency">`)}${field('Despertares nocturnos', `<input type="number" inputmode="numeric" min="0" value="${s.awakenings ?? ''}" data-c="sleepF" data-f="awakenings">`)}</form>
    <p class="muted small">Si te acuestas después de medianoche, el cálculo sigue siendo correcto. El tiempo que tardas en dormirte se resta.</p>
    <div class="field"><span>Calidad del sueño (1 a 5)</span>${scale('Calidad', s.quality, 1, 5, 'sleepRate', 'data-f="quality"')}</div>
    <div class="field"><span>Descanso al despertar (1 a 5)</span>${scale('Descanso', s.rest, 1, 5, 'sleepRate', 'data-f="rest"')}</div>
    ${day.sleep ? '<button class="btn ghost danger-t sm" data-a="sleepClear">Borrar el sueño de este día</button>' : ''}
    <h2>Evolución</h2>${chips([[7, '7 días'], [30, '30 días'], [90, '3 meses'], [365, '1 año']], sleepSpan, 'sleepSpan')}
    <section class="stats">${stat('Media 7 días', hours(mean(w)))}${stat('Media del periodo', hours(mean(vals)))}${stat('Calidad media', rated.length ? nf(mean(rated.map(d => d.sleep.quality)), 1) : '—', 'de 5')}</section>
    ${sleepSpan <= 90 ? barChart({ title: 'Horas de sueño', values: vals, labels: ds.map(fmtShort), goal, unit: 'h', d: 1, name: 'Horas' }) : lineChart({ title: 'Horas de sueño', series: [{ name: 'Horas', color: C.a, values: vals }], labels: ds.map(fmtShort), goal, unit: 'h', d: 1 })}
    ${(() => { const mon = {}; days.forEach(d => { const v = map.get(d.date); if (v != null) (mon[d.date.slice(0, 7)] ||= []).push(v); }); const k = Object.keys(mon).sort(); return k.length > 1 ? barChart({ title: 'Media por mes', values: k.map(x => mean(mon[x])), labels: k.map(x => fmtMonth(x + '-15').slice(0, 3)), unit: 'h', d: 1, name: 'Horas' }) : ''; })()}
    </div>`;
  },
};
A.sleepSpan = async el => { sleepSpan = +el.dataset.v; await render(); };
CH.sleepF = async el => { const f = el.dataset.f; await updDay(state.date, d => { d.sleep ||= {}; d.sleep[f] = el.type === 'time' ? el.value : numOrNull(el.value); });
  const s = (await getDay(state.date)).sleep, h = sleepHours(s.bed, s.wake, s.latency);
  document.querySelector('.huge').textContent = h == null ? '—' : hours(h);
};
A.sleepRate = async el => { const f = el.dataset.f, v = +el.dataset.v; await updDay(state.date, d => { d.sleep ||= {}; d.sleep[f] = d.sleep[f] === v ? null : v; }); await render(); };
A.sleepClear = async () => { if (!await confirmDlg('¿Borrar el sueño de este día?')) return; await updDay(state.date, d => { delete d.sleep; }); await render(); };

/* ---------- Ánimo ---------- */
export const MOOD = [['mood', 'Estado de ánimo'], ['energy', 'Nivel de energía'], ['stress', 'Nivel de estrés'], ['motivation', 'Motivación'], ['recovery', 'Recuperación muscular'], ['soreness', 'Dolor muscular'], ['wellbeing', 'Bienestar general']];
let moodSpan = 30, moodCmp = 'mood';
routes.animo = {
  title: 'Ánimo, energía y recuperación', back: true,
  async render() {
    const date = state.date, day = await getDay(date), m = day.mood || {}, t = todayStr(), from = addDays(t, -(moodSpan - 1)), days = await range('days', from, t), map = new Map(days.map(d => [d.date, d])), ds = dateRange(from, t);
    const ws = await range('workouts', from, t, 'date'), cm = await model();
    const key = moodCmp, vals = ds.map(d => map.get(d)?.mood?.[key] ?? null), label = MOOD.find(x => x[0] === key)[1];
    const sleepOf = d => { const s = map.get(d)?.sleep; return s ? sleepHours(s.bed, s.wake, s.latency) : null; };
    const trained = new Set(ws.filter(w => w.status === 'done').map(w => w.date));
    const groupAvg = pred => mean(ds.filter(pred).map(d => map.get(d)?.mood?.[key] ?? null));
    const phases = ['menstruacion', 'folicular', 'ovulacion', 'lutea'];
    return `<div class="page">${dateNav()}<p class="muted small">Escala de 1 a 10. En dolor y estrés, 10 es lo máximo que has sentido.</p>
    ${MOOD.map(([k, l]) => `<div class="field"><span>${l}</span>${scale(l, m[k], 1, 10, 'moodSet', `data-k="${k}"`)}</div>`).join('')}
    <h2>Evolución</h2>${chips([[7, '7 días'], [30, '30 días'], [90, '3 meses']], moodSpan, 'moodSpan')}
    <div class="chips">${MOOD.map(([k, l]) => `<button class="chip ${k === key ? 'on' : ''}" data-a="moodKey" data-v="${k}">${l}</button>`).join('')}</div>
    ${lineChart({ title: label, series: [{ name: label, color: C.a, values: vals }], labels: ds.map(fmtShort), min: 1, max: 10, d: 1, empty: 'Registra cómo te encuentras para ver tu evolución.' })}
    <h2>${esc(label)} comparado</h2><p class="muted small">Media en este periodo. Son observaciones de tus datos, no causas.</p><div class="scroll-x"><table class="tbl"><tbody>
    <tr><th>Tras dormir lo previsto</th><td>${nf(groupAvg(d => sleepOf(d) >= S.goals.sleep), 1)}</td></tr><tr><th>Tras dormir menos</th><td>${nf(groupAvg(d => sleepOf(d) != null && sleepOf(d) < S.goals.sleep), 1)}</td></tr>
    <tr><th>Días con entrenamiento</th><td>${nf(groupAvg(d => trained.has(d)), 1)}</td></tr><tr><th>Días sin entrenamiento</th><td>${nf(groupAvg(d => !trained.has(d)), 1)}</td></tr>
    ${phases.map(p => `<tr><th>${PHASES[p]}</th><td>${nf(groupAvg(d => phaseFor(d, cm)?.phase === p), 1)}</td></tr>`).join('')}</tbody></table></div></div>`;
  },
};
A.moodSet = async el => { const { k, v } = el.dataset; await updDay(state.date, d => { d.mood ||= {}; d.mood[k] = d.mood[k] === +v ? null : +v; }); await render(); };
A.moodSpan = async el => { moodSpan = +el.dataset.v; await render(); };
A.moodKey = async el => { moodCmp = el.dataset.v; await render(); };
