import { A, CH, IN, routes, state, S, render, go, toast, sheet, closeSheet, refreshSheet, confirmDlg, stat, field, numInput, ICON, chips, empty, saveSettings, scale, dateNav } from '../ui.js';
import { all, get, put, del, workoutsRange, updDay, getDay } from '../db.js';
import { esc, nf, uid, norm, todayStr, addDays, fmtShort, fmtFull, numOrNull, nowTime, WEEKDAYS, startOfWeek, dateRange, fmtMonth, weekday } from '../util.js';
import { modeOf, workoutVolume, itemVolume, exerciseHistory, exerciseRecords, monthlyProgress, groupFrequency, fmtSet, newRecords } from '../domain.js';
import { EXERCISES, GROUPS } from '../data/exercises.js';
import { lineChart, barChart, hbars, C } from '../charts.js';
import { plannedFor } from './shared.js';

const EQUIP = [...new Set(EXERCISES.map(e => e.equip))].sort();
const TYPES = [...new Set(EXERCISES.map(e => e.type))];
const groupLabel = g => GROUPS[g]?.[0] || g;
export async function allExercises() {
  const custom = await all('exercises');
  const hidden = new Set(custom.filter(c => c.hidden).map(c => c.id));
  const byId = new Map(EXERCISES.map(e => [e.id, e]));
  custom.filter(c => !c.hidden).forEach(c => byId.set(c.id, { ...c, custom: true }));
  return [...byId.values()].filter(e => !hidden.has(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
const groupOf = id => EXERCISES.find(e => e.id === id)?.group;
const blankSet = (mode, prev) => mode === 'cardio' ? { mins: prev?.mins ?? null, km: prev?.km ?? null } : mode === 'time' ? { secs: prev?.secs ?? null } : { kg: prev?.kg ?? null, reps: prev?.reps ?? null };

routes.entreno = {
  title: 'Entrenamiento',
  async render() {
    const date = state.date, t = todayStr();
    const [ws, tpls] = await Promise.all([all('workouts'), all('templates')]);
    ws.sort((a, b) => a.date === b.date ? (a.created < b.created ? 1 : -1) : (a.date < b.date ? 1 : -1));
    const day = await getDay(date), planned = await plannedFor(date, day);
    const todayW = ws.filter(w => w.date === date);
    const wk = ws.filter(w => w.date >= startOfWeek(t) && w.status === 'done');
    const d30 = ws.filter(w => w.date > addDays(t, -30) && w.status === 'done');
    const freq = groupFrequency(d30, groupOf);
    const weeks = Array.from({ length: 12 }, (_, i) => startOfWeek(addDays(t, -7 * (11 - i))));
    return `<div class="page"><h1>Entrenamiento</h1>${dateNav()}
    <section class="band plain">
      <p class="line-s"><span>Programado</span><b>${planned ? esc(planned.name) : 'Nada programado'}</b></p>
      ${planned && !todayW.length ? `<button class="btn wide" data-a="startTemplate" data-id="${planned.id}">Empezar ${esc(planned.name)}</button>` : ''}
      ${todayW.map(w => `<button class="session" data-a="go" data-to="sesion" data-q="id=${w.id}"><b>${esc(w.name)}</b><span>${w.status === 'done' ? 'Completada' : 'En curso'}, ${(w.items || []).length} ejercicios, ${nf(workoutVolume(w))} kg de volumen</span></button>`).join('')}
      <div class="row-btns"><button class="btn ${planned && !todayW.length ? 'ghost' : ''}" data-a="newWorkout">Nueva sesión</button><button class="btn ghost" data-a="go" data-to="biblioteca">Biblioteca</button></div>
    </section>
    <section class="stats">
      ${stat('Esta semana', nf(wk.length), wk.length === 1 ? 'sesión' : 'sesiones')}
      ${stat('Últimos 30 días', nf(d30.length), 'sesiones')}
      ${stat('Volumen 30 días', nf(d30.reduce((a, w) => a + workoutVolume(w), 0)), 'kg')}
    </section>
    <h2>Rutinas y calendario semanal</h2>
    ${tpls.length ? `<ul class="list">${tpls.map(p => `<li><button class="grow textbtn" data-a="startTemplate" data-id="${p.id}"><b>${esc(p.name)}</b><small>${(p.items || []).length} ejercicios${weekdaysOf(p.id)}</small></button><button class="icon" data-a="planDays" data-id="${p.id}" aria-label="Programar">${ICON.edit}</button><button class="icon" data-a="tplDel" data-id="${p.id}" aria-label="Eliminar rutina">${ICON.trash}</button></li>`).join('')}</ul>` : '<p class="muted">Guarda una sesión como rutina para reutilizarla y programarla por días.</p>'}
    ${planned || tpls.length ? `<button class="linkish" data-a="planDate">Cambiar lo programado para este día</button>` : ''}
    ${barChart({ title: 'Sesiones por semana', values: weeks.map(w => ws.filter(x => x.status === 'done' && x.date >= w && x.date < addDays(w, 7)).length), labels: weeks.map(fmtShort), name: 'Sesiones', empty: 'Las sesiones terminadas aparecerán aquí.' })}
    ${hbars({ title: 'Frecuencia por grupo muscular, últimos 30 días', rows: Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([g, v]) => ({ label: groupLabel(g), value: v })), fmt: v => `${v} ${v === 1 ? 'sesión' : 'sesiones'}`, empty: 'Aún sin datos.' })}
    <h2>Historial</h2>
    ${ws.length ? `<ul class="list">${ws.slice(0, 60).map(w => `<li><button class="grow textbtn" data-a="go" data-to="sesion" data-q="id=${w.id}"><b>${esc(w.name)}</b><small>${fmtFull(w.date)}, ${nf(workoutVolume(w))} kg${w.status === 'done' ? '' : ', en curso'}</small></button>${ICONnext}</li>`).join('')}</ul>` : empty('Crea tu primera sesión para empezar el historial.')}
    </div>`;
  },
};
const ICONnext = `<span class="chev">${ICON.next}</span>`;
const weekdaysOf = id => { const d = Object.entries(S.schedule).filter(([, v]) => v === id).map(([k]) => WEEKDAYS[k]); return d.length ? `, ${d.join(', ')}` : ''; };

async function createWorkout(name, items = []) {
  const w = { id: uid(), date: state.date, name, status: 'open', created: Date.now(), items, notes: '' };
  await put('workouts', w);
  go('sesion', { id: w.id });
}
A.newWorkout = () => sheet('Nueva sesión', () => `<form data-s="newWorkoutSave">${field('Nombre de la sesión', `<input name="name" required placeholder="Pierna y glúteo">`)}<button class="btn wide">Crear sesión</button></form>`);
A.newWorkoutSave = async f => { const n = f.name.value.trim(); if (!n) return; closeSheet(); await createWorkout(n); };
A.startTemplate = async el => {
  const p = await get('templates', el.dataset.id);
  const items = p.items.map(i => ({ ...i, sets: i.sets.map(s => { const m = {}; for (const k in s) m[k] = null; return m; }) }));
  await createWorkout(p.name, items);
};
A.tplDel = async el => { if (!await confirmDlg('¿Eliminar esta rutina? Las sesiones ya hechas se conservan.')) return; const id = el.dataset.id; await del('templates', id); for (const k in S.schedule) if (S.schedule[k] === id) delete S.schedule[k]; await saveSettings(); await render(); };
A.planDays = async el => {
  const id = el.dataset.id, p = await get('templates', id);
  sheet('Programar ' + p.name, () => `<form data-s="planSave" data-id="${id}"><label class="field"><span>Nombre</span><input name="name" value="${esc(p.name)}" required></label><p class="field-l">Días de la semana</p><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(k => `<label class="chip-c"><input type="checkbox" name="d${k}" ${S.schedule[k] === id ? 'checked' : ''}><span>${WEEKDAYS[k]}</span></label>`).join('')}</div><button class="btn wide">Guardar rutina</button></form>`);
};
A.planSave = async f => {
  const id = f.dataset.id, p = await get('templates', id);
  p.name = f.name.value.trim() || p.name; await put('templates', p);
  for (let k = 0; k < 7; k++) { if (f['d' + k].checked) S.schedule[k] = id; else if (S.schedule[k] === id) delete S.schedule[k]; }
  await saveSettings(); closeSheet(); await render();
};
A.planDate = async () => {
  const tpls = await all('templates'), day = await getDay(state.date);
  sheet('Programado este día', () => `<p class="lead">${fmtFull(state.date)}</p>${chips([['', 'Nada'], ...tpls.map(t => [t.id, t.name])], day.plannedId ?? S.schedule[weekday(state.date)] ?? '', 'planDateSet')}`);
};
A.planDateSet = async el => { await updDay(state.date, d => { d.plannedId = el.dataset.v || null; }); closeSheet(); await render(); };

/* ---------- Sesión ---------- */
routes.sesion = {
  title: 'Sesión', back: true,
  async render({ id }) {
    const w = await get('workouts', id);
    if (!w) return `<div class="page">${empty('Esta sesión ya no existe.')}</div>`;
    const ws = await all('workouts');
    const cards = (w.items || []).map((it, i) => itemCard(it, i, ws, w)).join('');
    return `<div class="page session-page" data-wid="${w.id}">
    <form class="sess-head" data-s="noop"><input class="title-input" value="${esc(w.name)}" data-c="wName" aria-label="Nombre de la sesión"><input type="date" value="${w.date}" max="${todayStr()}" data-c="wDate" aria-label="Fecha"></form>
    <p class="lead" id="wvol">Volumen total: ${nf(workoutVolume(w))} kg</p>
    ${cards || empty('Añade ejercicios de la biblioteca.')}
    <button class="btn ghost wide" data-a="pickEx" data-w="${w.id}">Añadir ejercicio</button>
    <label class="field"><span>Notas de la sesión</span><textarea rows="2" data-c="wNotes">${esc(w.notes || '')}</textarea></label>
    <div class="row-btns"><button class="btn ${w.status === 'done' ? 'ghost' : ''}" data-a="wFinish">${w.status === 'done' ? 'Reabrir sesión' : 'Terminar sesión'}</button><button class="btn ghost" data-a="wTemplate">Guardar como rutina</button></div>
    <button class="btn ghost danger-t wide" data-a="wDel">Eliminar sesión</button>
    <p class="muted small center">Cada cambio se guarda automáticamente.</p></div>`;
  },
};
function itemCard(it, i, ws, w) {
  const hist = exerciseHistory(ws, it.exId, w.id), mode = it.mode || 'strength', last = hist[0], rec = exerciseRecords(hist);
  const cols = mode === 'cardio' ? [['mins', 'Min'], ['km', 'Km']] : mode === 'time' ? [['secs', 'Segundos']] : [['kg', 'Kg'], ['reps', 'Reps']];
  const lastSets = last?.sets || [];
  return `<article class="excard" data-i="${i}">
    <header><button class="textbtn grow" data-a="exDetail" data-id="${it.exId}"><b>${esc(it.name)}</b><small>${esc(groupLabel(it.group))}</small></button>
    <button class="icon" data-a="itUp" data-i="${i}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button>
    <button class="icon" data-a="itDel" data-i="${i}" aria-label="Quitar ejercicio">${ICON.trash}</button></header>
    ${last ? `<p class="lastline">Última vez, ${fmtShort(last.date)}: ${last.sets.map(fmtSet).join('; ')}${rec.kg ? `. Récord: ${nf(rec.kg.kg, 2)} kg` : ''}</p>` : '<p class="lastline">Primera vez que registras este ejercicio.</p>'}
    <table class="sets"><thead><tr><th>Serie</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}${mode === 'strength' ? '<th>Antes</th>' : ''}<th></th></tr></thead><tbody>
    ${it.sets.map((s, j) => `<tr><td>${j + 1}</td>${cols.map(c => `<td><input type="text" inputmode="decimal" autocomplete="off" aria-label="${c[1]} serie ${j + 1}" value="${s[c[0]] ?? ''}" data-c="setVal" data-i="${i}" data-j="${j}" data-f="${c[0]}"></td>`).join('')}${mode === 'strength' ? `<td class="muted small">${lastSets[j] ? esc(fmtSet(lastSets[j])) : ''}</td>` : ''}<td><button class="icon" data-a="setDel" data-i="${i}" data-j="${j}" aria-label="Quitar serie">${ICON.close}</button></td></tr>`).join('')}
    </tbody></table>
    <div class="row-btns"><button class="btn ghost sm" data-a="setAdd" data-i="${i}">Añadir serie</button><button class="btn ghost sm" data-a="restStart" data-s="${it.rest || 90}">Descanso ${it.rest || 90} s</button></div>
    <label class="field"><span>Descanso entre series (s)</span><input type="number" inputmode="numeric" value="${it.rest ?? ''}" placeholder="90" data-c="itField" data-i="${i}" data-f="rest"></label>
    <div class="field"><span>Dificultad (1 a 10)</span>${scale('Dificultad', it.rpe, 1, 10, 'itRpe', `data-i="${i}"`)}</div>
    <label class="field"><span>Comentarios</span><input value="${esc(it.notes || '')}" data-c="itField" data-i="${i}" data-f="notes" placeholder="Cómo ha ido"></label>
    <p class="muted small" data-vol>${mode === 'strength' ? `Volumen: ${nf(itemVolume(it))} kg` : ''}</p>
  </article>`;
}
const wid = () => state.params.id;
const updW = async fn => { const w = await get('workouts', wid()); fn(w); await put('workouts', w); return w; };
CH.wName = el => updW(w => { w.name = el.value.trim() || w.name; });
CH.wDate = el => updW(w => { if (el.value) w.date = el.value; });
CH.wNotes = el => updW(w => { w.notes = el.value; });
A.noop = () => {};
CH.setVal = async el => {
  const { i, j, f } = el.dataset, v = numOrNull(el.value);
  const w = await updW(w => { w.items[i].sets[j][f] = v; });
  const vol = el.closest('.excard').querySelector('[data-vol]');
  if (w.items[i].mode === 'strength') vol.textContent = `Volumen: ${nf(itemVolume(w.items[i]))} kg`;
  document.querySelector('#wvol').textContent = `Volumen total: ${nf(workoutVolume(w))} kg`;
};
CH.itField = el => updW(w => { const { i, f } = el.dataset; w.items[i][f] = f === 'rest' ? numOrNull(el.value) : el.value; }).then(() => { if (el.dataset.f === 'rest') render(); });
A.itRpe = async el => { await updW(w => { const it = w.items[el.dataset.i], v = +el.dataset.v; it.rpe = it.rpe === v ? null : v; }); await render(); };
A.setAdd = async el => { await updW(w => { const it = w.items[el.dataset.i]; it.sets.push(blankSet(it.mode, it.sets[it.sets.length - 1])); }); await render(); };
A.setDel = async el => { await updW(w => { w.items[el.dataset.i].sets.splice(+el.dataset.j, 1); }); await render(); };
A.itDel = async el => { if (!await confirmDlg('¿Quitar este ejercicio de la sesión?', 'Quitar')) return; await updW(w => { w.items.splice(+el.dataset.i, 1); }); await render(); };
A.itUp = async el => { const i = +el.dataset.i; await updW(w => { [w.items[i - 1], w.items[i]] = [w.items[i], w.items[i - 1]]; }); await render(); };
A.wFinish = async () => {
  const before = await get('workouts', wid()), ws = await all('workouts');
  const w = await updW(w => { w.status = w.status === 'done' ? 'open' : 'done'; });
  await render();
  if (w.status !== 'done') return;
  const recs = (before.items || []).flatMap(it => newRecords(it, exerciseHistory(ws, it.exId, before.id)).map(r => `${it.name}: ${r}`));
  sheet('Sesión terminada', () => `<p class="lead">Volumen total: ${nf(workoutVolume(w))} kg en ${w.items.length} ejercicios.</p>${recs.length ? `<ul class="plain-list">${recs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}<button class="btn wide" data-a="closeSheet">Cerrar</button>`);
};
A.wDel = async () => { if (!await confirmDlg('¿Eliminar esta sesión y todas sus series?')) return; await del('workouts', wid()); toast('Sesión eliminada'); go('entreno'); };
A.wTemplate = async () => {
  const w = await get('workouts', wid());
  await put('templates', { id: uid(), name: w.name, items: w.items.map(i => ({ ...i, notes: '', rpe: null })) });
  toast('Rutina guardada');
};
let restT, restEnd = 0;
A.restStart = el => {
  restEnd = Date.now() + +el.dataset.s * 1000; // hora real: sigue bien aunque iOS pause la app
  const b = document.querySelector('#rest');
  clearInterval(restT);
  const draw = () => {
    const s = Math.ceil((restEnd - Date.now()) / 1000);
    if (s <= 0) { A.restStop(); toast('Descanso terminado'); return; }
    b.innerHTML = `<span>Descanso: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span><button data-a="restStop">Parar</button>`;
  };
  b.classList.add('on'); draw();
  restT = setInterval(draw, 500);
};
A.restStop = () => { clearInterval(restT); document.querySelector('#rest').classList.remove('on'); };
// Mantiene la pantalla encendida durante una sesión, si iOS lo permite.
let wake;
const syncWake = async () => {
  const want = location.hash.startsWith('#/sesion') && document.visibilityState === 'visible';
  try { if (want && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } else if (!want && wake) { await wake.release(); wake = null; } } catch { wake = null; }
};
window.addEventListener('hashchange', syncWake); document.addEventListener('visibilitychange', syncWake);

/* ---------- Selector y biblioteca ---------- */
const lib = { q: '', group: '', equip: '', type: '' };
function filtered(list) {
  const q = norm(lib.q);
  return list.filter(e => (!lib.group || e.group === lib.group) && (!lib.equip || e.equip === lib.equip) && (!lib.type || e.type === lib.type) && (!q || q.split(/\s+/).every(w => norm(e.name).includes(w))));
}
const filtersHtml = () => `<input class="search" type="search" placeholder="Buscar ejercicio" value="${esc(lib.q)}" data-i="libQ" aria-label="Buscar ejercicio">
  <div class="selects"><select data-c="libF" data-f="group" aria-label="Grupo muscular"><option value="">Todos los grupos</option>${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}" ${lib.group === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}</select>
  <select data-c="libF" data-f="equip" aria-label="Equipamiento"><option value="">Todo el equipo</option>${EQUIP.map(k => `<option ${lib.equip === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
  <select data-c="libF" data-f="type" aria-label="Tipo"><option value="">Todos los tipos</option>${TYPES.map(k => `<option ${lib.type === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>`;
const exRows = (list, action, extra = '') => {
  if (!list.length) return empty('Ningún ejercicio coincide. Puedes crearlo.', `<button class="btn ghost" data-a="exNew">Crear ejercicio</button>`);
  const shown = list.slice(0, 80);
  return `<p class="muted small">${list.length} ejercicios${list.length > 80 ? ', mostrando 80; afina la búsqueda' : ''}</p><ul class="list ex-list">${shown.map(e => `<li><button class="grow textbtn" data-a="${action}" data-id="${e.id}" ${extra}><b>${esc(e.name)}</b><small>${esc(groupLabel(e.group))}, ${esc(e.equip)}, ${esc(e.type)}${e.custom ? ', propio' : ''}</small></button></li>`).join('')}</ul>`;
};
let libResultsAction = 'exDetail';
IN.libQ = async el => { lib.q = el.value; const box = document.querySelector('.sheet-wrap:last-child #libres') || document.querySelector('#libres'); box.innerHTML = exRows(filtered(await allExercises()), libResultsAction); };
CH.libF = async el => { lib[el.dataset.f] = el.value; const box = document.querySelector('.sheet-wrap:last-child #libres') || document.querySelector('#libres'); box.innerHTML = exRows(filtered(await allExercises()), libResultsAction); };
routes.biblioteca = {
  title: 'Biblioteca de ejercicios', back: true,
  async render() {
    libResultsAction = 'exDetail';
    return `<div class="page">${filtersHtml()}<button class="btn ghost wide" data-a="exNew">Crear ejercicio propio</button><div id="libres">${exRows(filtered(await allExercises()), 'exDetail')}</div></div>`;
  },
};
A.pickEx = async () => {
  libResultsAction = 'addEx'; lib.q = '';
  sheet('Añadir ejercicio', async () => `${filtersHtml()}<button class="btn ghost wide" data-a="exNew">Crear ejercicio propio</button><div id="libres">${exRows(filtered(await allExercises()), 'addEx')}</div>`, { onClose: () => { libResultsAction = 'exDetail'; lib.q = ''; } });
};
A.addEx = async el => {
  const e = (await allExercises()).find(x => x.id === el.dataset.id), mode = modeOf(e.type);
  const ws = await all('workouts'), last = exerciseHistory(ws, e.id, wid())[0];
  const n = last ? last.sets.length : 3;
  await updW(w => { w.items.push({ exId: e.id, name: e.name, group: e.group, type: e.type, mode, rest: last?.item.rest ?? null, rpe: null, notes: '', sets: Array.from({ length: n }, () => blankSet(mode)) }); });
  closeSheet(); toast(`${e.name} añadido`); await render();
};
A.exNew = () => sheet('Crear ejercicio', () => exForm({}));
const exForm = e => `<form data-s="exSave" data-id="${e.id || ''}">${field('Nombre', `<input name="name" required value="${esc(e.name || lib.q || '')}">`)}
  ${field('Grupo muscular', `<select name="group">${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}" ${e.group === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}</select>`)}
  ${field('Equipamiento', `<select name="equip">${EQUIP.map(k => `<option ${e.equip === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>`)}
  ${field('Tipo', `<select name="type">${TYPES.map(k => `<option ${e.type === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>`, 'Cardio registra minutos y km. Isométrico, movilidad y estiramiento registran segundos. El resto, kg y repeticiones.')}
  <button class="btn wide">Guardar ejercicio</button></form>`;
A.exSave = async f => {
  const id = f.dataset.id || 'c-' + uid();
  await put('exercises', { id, name: f.name.value.trim(), group: f.group.value, equip: f.equip.value, type: f.type.value });
  closeSheet(); toast('Ejercicio guardado');
  const w = document.querySelector('.sheet-wrap:last-child');
  if (w) await refreshSheet(); else await render();
};
A.exDetail = async el => {
  const id = el.dataset.id, e = (await allExercises()).find(x => x.id === id);
  sheet(e?.name || 'Ejercicio', async () => {
    const ws = (await all('workouts')).filter(w => w.status === 'done' || w.id === wid());
    const hist = exerciseHistory(ws, id), rec = exerciseRecords(hist), asc = [...hist].reverse(), mon = monthlyProgress(hist);
    return `<p class="muted">${e ? `${esc(groupLabel(e.group))}, ${esc(e.equip)}, ${esc(e.type)}` : 'Ejercicio eliminado de la biblioteca'}</p>
    <section class="stats">${stat('Récord de peso', rec.kg ? `${nf(rec.kg.kg, 2)} kg` : '—', rec.kg ? `× ${rec.kg.reps}, ${fmtShort(rec.kg.date)}` : '')}${stat('Récord de reps', rec.reps ? nf(rec.reps.reps) : '—', rec.reps ? `${rec.reps.kg != null ? nf(rec.reps.kg, 2) + ' kg, ' : ''}${fmtShort(rec.reps.date)}` : '')}${stat('Mayor volumen', rec.vol ? `${nf(rec.vol.volume)} kg` : '—', rec.vol ? fmtShort(rec.vol.date) : '')}</section>
    ${lineChart({ title: 'Evolución de carga máxima', series: [{ name: 'Carga', color: C.a, values: asc.map(h => h.topKg || null) }], labels: asc.map(h => fmtShort(h.date)), unit: 'kg', d: 1, empty: 'Registra este ejercicio para ver su evolución.' })}
    ${barChart({ title: 'Progresión mensual de volumen', values: mon.map(m => m.volume), labels: mon.map(m => fmtMonth(m.month + '-01').slice(0, 3)), unit: 'kg', name: 'Volumen' })}
    <h3>Historial</h3>${hist.length ? `<ul class="plain-list">${hist.slice(0, 30).map(h => `<li><b>${fmtFull(h.date)}</b><br>${h.sets.map(fmtSet).join('; ')}${h.item.notes ? `<br><em>${esc(h.item.notes)}</em>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Sin registros.</p>'}
    ${e?.custom ? `<div class="row-btns"><button class="btn ghost" data-a="exEdit" data-id="${id}">Editar</button><button class="btn ghost danger-t" data-a="exDel" data-id="${id}">Eliminar</button></div>` : `<button class="btn ghost wide" data-a="exHide" data-id="${id}">Ocultar de la biblioteca</button>`}`;
  });
};
A.exEdit = async el => { const e = await get('exercises', el.dataset.id); sheet('Editar ejercicio', () => exForm(e)); };
A.exDel = async el => { if (!await confirmDlg('¿Eliminar este ejercicio? Tu historial conserva las series ya guardadas.')) return; await del('exercises', el.dataset.id); closeSheet(); await render(); };
A.exHide = async el => { await put('exercises', { id: el.dataset.id, hidden: true }); closeSheet(); toast('Ejercicio oculto. Puedes recuperarlo en Ajustes.'); await render(); };
