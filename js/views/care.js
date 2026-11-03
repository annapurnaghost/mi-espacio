// Skincare, higiene dental, ducha, cuidado capilar y hábitos propios.
import { A, CH, routes, state, S, render, toast, sheet, closeSheet, refreshSheet, confirmDlg, stat, field, numInput, ICON, check, empty, dateNav, saveSettings, chips, scale, form } from '../ui.js';
import { all, get, put, del, getDay, updDay, range } from '../db.js';
import { esc, nf, uid, todayStr, addDays, fmtShort, fmtFull, nowTime, dateRange, WD_SHORT, WEEKDAYS, weekday, startOfMonth } from '../util.js';
import { scheduledOn, lastWash, consistency } from '../domain.js';
import { barChart, hbars, progress } from '../charts.js';
import { addPhoto, photoGrid } from './photos.js';

const wdPicker = (days = []) => `<div class="wd-pick">${[1, 2, 3, 4, 5, 6, 0].map(k => `<label class="chip-c"><input type="checkbox" name="d${k}" ${days.includes(k) ? 'checked' : ''}><span title="${WEEKDAYS[k]}">${WD_SHORT[k]}</span></label>`).join('')}</div>`;
const readDays = f => [0, 1, 2, 3, 4, 5, 6].filter(k => f['d' + k].checked);
const freqLabel = d => !d?.length ? 'Solo cuando quieras' : d.length === 7 ? 'Todos los días' : [1, 2, 3, 4, 5, 6, 0].filter(k => d.includes(k)).map(k => WD_SHORT[k]).join(' ');

/* ---------- Skincare ---------- */
routes.skincare = {
  title: 'Skincare', back: true,
  async render() {
    const date = state.date, day = await getDay(date), t = todayStr();
    const hist = await range('days', addDays(t, -29), t);
    const photos = (await all('photos')).filter(p => p.kind === 'piel').sort((a, b) => a.date < b.date ? 1 : -1);
    const section = (part, title) => {
      const log = day.skin?.[part] || {}, list = S.skin[part], sched = scheduledOn(list, date);
      const done = sched.filter(p => log[p.id]?.done).length;
      return `<section class="routine"><header><h2>${title}</h2><span>${sched.length ? `${done} de ${sched.length}` : 'Sin productos hoy'}</span></header>${progress(sched.length ? done / sched.length : 0)}
      <ol class="routine-list">${list.map(p => {
        const on = !!log[p.id]?.done, isToday = (p.days || []).includes(weekday(date));
        return `<li class="${isToday ? '' : 'off-day'}">${check(on, 'skinTick', `data-p="${part}" data-id="${p.id}"`, p.name)}
          <button class="grow textbtn" data-a="skinProd" data-p="${part}" data-id="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.brand || '')}${p.brand ? ', ' : ''}${isToday ? esc(freqLabel(p.days)) : 'Hoy no toca: ' + esc(freqLabel(p.days))}</small></button>
          ${on ? `<input class="time-mini" type="time" value="${log[p.id].time || ''}" data-c="skinTime" data-p="${part}" data-id="${p.id}" aria-label="Hora de ${esc(p.name)}">` : ''}</li>`;
      }).join('')}</ol>
      <button class="btn ghost sm" data-a="skinAdd" data-p="${part}">Añadir producto</button></section>`;
    };
    const dd = day.skin?.log || {};
    const usage = [...S.skin.am.map(p => ['am', p]), ...S.skin.pm.map(p => ['pm', p])].map(([part, p]) => ({ label: p.name + (part === 'am' ? ', mañana' : ', noche'), value: hist.filter(h => h.skin?.[part]?.[p.id]?.done).length })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
    const concerns = S.skin.concerns;
    return `<div class="page">${dateNav()}${section('am', 'Rutina de mañana')}${section('pm', 'Rutina de noche')}
    <section><h2>Estado de la piel</h2><p class="muted small">Toca para marcar lo que notas hoy.</p>
    <div class="chips">${concerns.map(c => `<button class="chip ${dd[c] ? 'on' : ''}" data-a="skinConcern" data-v="${esc(c)}">${esc(c)}</button>`).join('')}<button class="chip dashed" data-a="skinConcernAdd">Añadir</button></div>
    <label class="field"><span>Notas</span><textarea rows="2" data-c="skinNote">${esc(day.skin?.note || '')}</textarea></label></section>
    ${hbars({ title: 'Uso de cada producto, últimos 30 días', rows: usage, fmt: v => `${v} ${v === 1 ? 'día' : 'días'}`, empty: 'Marca tus productos para ver con qué frecuencia los usas.' })}
    <h2>Fotos de evolución</h2><p class="muted small">Se guardan solo en este iPhone.</p>${photoGrid(photos)}<label class="btn ghost wide fileb">Añadir foto<input type="file" accept="image/*" data-c="skinPhoto" hidden></label>
    <h2>Historial</h2>${skinHistory(hist)}
    <p class="muted small">Esta aplicación respeta tus frecuencias y no recomienda combinar activos ni aumentar su uso.</p></div>`;
  },
};
function skinHistory(hist) {
  const rows = hist.filter(h => h.skin && (Object.values(h.skin.am || {}).some(x => x.done) || Object.values(h.skin.pm || {}).some(x => x.done) || h.skin.note || Object.values(h.skin.log || {}).some(Boolean))).sort((a, b) => a.date < b.date ? 1 : -1);
  if (!rows.length) return empty('Tus rutinas registradas aparecerán aquí.');
  const nm = v => v.filter(x => x.done).map(x => `${x.name || ''}${x.time ? ' ' + x.time : ''}`).join(', ');
  return `<ul class="plain-list">${rows.slice(0, 20).map(h => `<li><b>${fmtShort(h.date)}</b>${nm(Object.values(h.skin.am || {})) ? `<br>Mañana: ${esc(nm(Object.values(h.skin.am)))}` : ''}${nm(Object.values(h.skin.pm || {})) ? `<br>Noche: ${esc(nm(Object.values(h.skin.pm)))}` : ''}${Object.entries(h.skin.log || {}).filter(e => e[1]).length ? `<br>Piel: ${esc(Object.entries(h.skin.log).filter(e => e[1]).map(e => e[0]).join(', '))}` : ''}${h.skin.note ? `<br><em>${esc(h.skin.note)}</em>` : ''}</li>`).join('')}</ul>`;
}
A.skinTick = async el => {
  const { p, id } = el.dataset, prod = S.skin[p].find(x => x.id === id);
  await updDay(state.date, d => { d.skin ||= {}; d.skin[p] ||= {}; d.skin[p][id] = d.skin[p][id]?.done ? { done: false } : { done: true, time: nowTime(), name: prod.name }; });
  await render();
};
CH.skinTime = async el => { const { p, id } = el.dataset; await updDay(state.date, d => { d.skin[p][id].time = el.value; }); };
A.skinConcern = async el => { await updDay(state.date, d => { d.skin ||= {}; d.skin.log ||= {}; d.skin.log[el.dataset.v] = !d.skin.log[el.dataset.v]; }); await render(); };
A.skinConcernAdd = () => sheet('Añadir cambio en la piel', () => `<form data-s="skinConcernSave">${field('Nombre', '<input name="n" required>')}<button class="btn wide">Guardar</button></form>`);
A.skinConcernSave = async f => { const n = f.n.value.trim(); if (n && !S.skin.concerns.includes(n)) S.skin.concerns.push(n); await saveSettings(); closeSheet(); await render(); };
CH.skinNote = el => updDay(state.date, d => { d.skin ||= {}; d.skin.note = el.value; });
CH.skinPhoto = async el => { await addPhoto(el.files[0], 'piel', state.date); await render(); };
const prodForm = (part, p) => `<form data-s="skinProdSave" data-p="${part}" data-id="${p.id || ''}">${field('Producto o paso', `<input name="name" required value="${esc(p.name || '')}">`)}${field('Marca', `<input name="brand" value="${esc(p.brand || '')}" placeholder="Opcional">`)}
  <p class="field-l">Días en los que toca</p>${wdPicker(p.days ?? [0, 1, 2, 3, 4, 5, 6])}<small class="muted">Sin días marcados, queda disponible pero no cuenta para tu rutina.</small>
  <button class="btn wide">Guardar producto</button>${p.id ? `<div class="row-btns"><button type="button" class="btn ghost sm" data-a="skinMove" data-p="${part}" data-id="${p.id}" data-d="-1">Subir en la rutina</button><button type="button" class="btn ghost sm" data-a="skinMove" data-p="${part}" data-id="${p.id}" data-d="1">Bajar en la rutina</button></div><button type="button" class="btn ghost danger-t wide" data-a="skinProdDel" data-p="${part}" data-id="${p.id}">Quitar de la rutina</button>` : ''}</form>`;
A.skinAdd = el => sheet('Añadir producto', () => prodForm(el.dataset.p, {}));
A.skinProd = el => { const p = S.skin[el.dataset.p].find(x => x.id === el.dataset.id); sheet('Producto', () => prodForm(el.dataset.p, p)); };
A.skinProdSave = async f => {
  const part = f.dataset.p, list = S.skin[part], id = f.dataset.id, data = { name: f.name.value.trim(), brand: f.brand.value.trim(), days: readDays(f) };
  if (id) Object.assign(list.find(x => x.id === id), data); else list.push({ id: uid(), ...data });
  await saveSettings(); closeSheet(); toast('Producto guardado'); await render();
};
A.skinMove = async el => { const l = S.skin[el.dataset.p], i = l.findIndex(x => x.id === el.dataset.id), j = i + +el.dataset.d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; await saveSettings(); closeSheet(); await render(); };
A.skinProdDel = async el => { if (!await confirmDlg('¿Quitar este producto? Tu historial se conserva.', 'Quitar')) return; S.skin[el.dataset.p] = S.skin[el.dataset.p].filter(x => x.id !== el.dataset.id); await saveSettings(); closeSheet(); await render(); };

/* ---------- Dental ---------- */
routes.dental = {
  title: 'Higiene dental', back: true,
  async render() {
    const date = state.date, day = await getDay(date), t = todayStr(), dd = day.dental || {};
    const w = dateRange(addDays(t, -6), t), mo = dateRange(addDays(t, -29), t);
    const hist = new Map((await range('days', mo[0], t)).map(h => [h.date, h.dental || {}]));
    const rate = (dates, id) => consistency(dates, x => hist.get(x)?.[id]);
    return `<div class="page">${dateNav()}<ul class="checks">${S.dental.map(i => `<li>${check(dd[i.id], 'dentalTick', `data-id="${i.id}"`, i.name)}<span class="grow">${esc(i.name)}${i.counts ? '' : '<small class="block muted">Opcional: no cuenta para el porcentaje</small>'}</span></li>`).join('')}</ul>
    <button class="btn ghost sm" data-a="dentalEdit">Cambiar esta lista</button>
    <h2>Constancia</h2><div class="scroll-x"><table class="tbl"><thead><tr><th></th><th>7 días</th><th>30 días</th></tr></thead><tbody>${S.dental.map(i => `<tr><th>${esc(i.name)}</th><td>${rate(w, i.id).n} de 7</td><td>${rate(mo, i.id).n} de 30</td></tr>`).join('')}</tbody></table></div>
    ${barChart({ title: 'Actividades hechas por día', values: mo.map(x => S.dental.filter(i => hist.get(x)?.[i.id]).length || null), labels: mo.map(fmtShort), name: 'Actividades', empty: 'Marca tus actividades para ver tu constancia.' })}</div>`;
  },
};
A.dentalTick = async el => { await updDay(state.date, d => { d.dental ||= {}; d.dental[el.dataset.id] = !d.dental[el.dataset.id]; }); await render(); };
const listEditor = (title, list, key, optCounts) => sheet(title, () => `<ul class="list">${list().map(i => `<li><span class="grow">${esc(i.name)}</span>${optCounts ? `<label class="toggle sm"><input type="checkbox" data-c="listCounts" data-id="${i.id}" data-k="${key}" ${i.counts ? 'checked' : ''}><span>Cuenta</span></label>` : ''}<button class="icon" data-a="listDel" data-id="${i.id}" data-k="${key}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul><form class="inline" data-s="listAdd" data-k="${key}"><input name="n" placeholder="Nueva actividad" required aria-label="Nueva actividad"><button class="btn">Añadir</button></form>`);
const listRef = k => k === 'dental' ? [S, 'dental'] : k === 'shower' ? [S, 'shower'] : k === 'hairW' ? [S.hair, 'wash'] : [S.hair, 'nowash'];
A.dentalEdit = () => listEditor('Higiene dental', () => S.dental, 'dental', true);
CH.listCounts = async el => { const [o, f] = listRef(el.dataset.k); o[f].find(x => x.id === el.dataset.id).counts = el.checked; await saveSettings(); await render(); };
A.listDel = async el => { const [o, f] = listRef(el.dataset.k); o[f] = o[f].filter(x => x.id !== el.dataset.id); await saveSettings(); await refreshSheet(); await render(); };
A.listAdd = async fm => { const [o, f] = listRef(fm.dataset.k), n = fm.n.value.trim(); if (!n) return; o[f].push({ id: uid(), name: n, counts: true }); await saveSettings(); await refreshSheet(); await render(); };

/* ---------- Ducha ---------- */
routes.ducha = {
  title: 'Ducha e higiene corporal', back: true,
  async render() {
    const date = state.date, day = await getDay(date), sh = day.shower || {}, t = todayStr();
    const all30 = await all('days'), showers = all30.filter(d => d.shower?.done).sort((a, b) => a.date < b.date ? 1 : -1);
    const mo = dateRange(addDays(t, -29), t), done = new Set(showers.map(s => s.date));
    return `<div class="page">${dateNav()}<ul class="checks"><li>${check(sh.done, 'showerTick', '', 'Ducha realizada')}<span class="grow">Ducha realizada</span>${sh.done ? `<input class="time-mini" type="time" value="${sh.time || ''}" data-c="showerTime" aria-label="Hora de la ducha">` : ''}</li>
    ${S.shower.map(i => `<li>${check(sh.items?.[i.id], 'showerItem', `data-id="${i.id}"`, i.name)}<span class="grow">${esc(i.name)}</span></li>`).join('')}</ul>
    <button class="btn ghost sm" data-a="showerEdit">Añadir otros cuidados</button>
    <section class="stats">${stat('Duchas registradas', nf(showers.length), 'en total')}${stat('Últimos 7 días', nf(mo.slice(-7).filter(d => done.has(d)).length))}${stat('Últimos 30 días', nf(mo.filter(d => done.has(d)).length))}</section>
    <h2>Historial</h2>${showers.length ? `<ul class="list">${showers.slice(0, 40).map(s => `<li><span class="grow">${fmtFull(s.date)}</span><span>${s.shower.time || ''}</span></li>`).join('')}</ul>` : empty('Tus duchas registradas aparecerán aquí.')}</div>`;
  },
};
A.showerTick = async () => { await updDay(state.date, d => { d.shower ||= {}; d.shower.done = !d.shower.done; if (d.shower.done && !d.shower.time) d.shower.time = nowTime(); }); await render(); };
CH.showerTime = el => updDay(state.date, d => { d.shower.time = el.value; });
A.showerItem = async el => { await updDay(state.date, d => { d.shower ||= {}; d.shower.items ||= {}; d.shower.items[el.dataset.id] = !d.shower.items[el.dataset.id]; }); await render(); };
A.showerEdit = () => listEditor('Otros cuidados', () => S.shower, 'shower');

/* ---------- Pelo ---------- */
routes.pelo = {
  title: 'Cuidado capilar', back: true,
  async render() {
    const date = state.date, day = await getDay(date), h = day.hair || {}, days = await all('days'), lw = lastWash(days, date);
    const list = h.type === 'wash' ? S.hair.wash : h.type === 'nowash' ? S.hair.nowash : [];
    return `<div class="page">${dateNav()}
    <section class="stats">${stat('Último lavado', lw.last ? fmtShort(lw.last) : '—')}${stat('Días desde entonces', lw.since == null ? '—' : nf(lw.since))}${stat('Lavados registrados', nf(lw.count))}</section>
    <h2>Tipo de día</h2>${chips([['wash', 'Día de lavado'], ['nowash', 'Día sin lavado']], h.type || '', 'hairType')}
    ${list.length ? `<ul class="checks">${list.map(i => `<li>${check(h.items?.[i.id], 'hairTick', `data-id="${i.id}"`, i.name)}<span class="grow">${esc(i.name)}</span></li>`).join('')}</ul><button class="btn ghost sm" data-a="hairEdit">Cambiar esta lista</button>
    ${S.hair.routines.length ? `<h3>Aplicar una rutina</h3><div class="chips">${S.hair.routines.filter(r => r.type === h.type).map(r => `<button class="chip" data-a="hairApply" data-id="${r.id}">${esc(r.name)}</button>`).join('') || '<span class="muted small">No hay rutinas para este tipo de día.</span>'}</div>` : ''}` : '<p class="muted">Elige el tipo de día para ver tus casillas.</p>'}
    <label class="field"><span>Productos usados hoy</span><input value="${esc(h.used || '')}" data-c="hairUsed" placeholder="Mascarilla de argán, aceite..." list="hairprods"><datalist id="hairprods">${S.hair.products.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist></label>
    <h2>Mis productos</h2>${S.hair.products.length ? `<ul class="list">${S.hair.products.map(p => `<li><span class="grow">${esc(p.name)}</span><button class="icon" data-a="hairProdDel" data-id="${p.id}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : ''}
    <form class="inline" data-s="hairProdAdd"><input name="n" placeholder="Nombre del producto" required aria-label="Nombre del producto"><button class="btn ghost">Añadir</button></form>
    <h2>Mis rutinas capilares</h2>${S.hair.routines.length ? `<ul class="list">${S.hair.routines.map(r => `<li><span class="grow"><b>${esc(r.name)}</b><small class="block">${r.type === 'wash' ? 'Día de lavado' : 'Día sin lavado'}, ${r.items.length} pasos</small></span><button class="icon" data-a="hairRoutineDel" data-id="${r.id}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : ''}
    <button class="btn ghost wide" data-a="hairRoutineNew">Crear rutina capilar</button></div>`;
  },
};
A.hairType = async el => { await updDay(state.date, d => { d.hair ||= {}; d.hair.type = d.hair.type === el.dataset.v ? null : el.dataset.v; }); await render(); };
A.hairTick = async el => { await updDay(state.date, d => { d.hair.items ||= {}; d.hair.items[el.dataset.id] = !d.hair.items[el.dataset.id]; }); await render(); };
CH.hairUsed = el => updDay(state.date, d => { d.hair ||= {}; d.hair.used = el.value; });
A.hairEdit = async () => { const d = await getDay(state.date), wash = d.hair?.type === 'wash'; listEditor(wash ? 'Día de lavado' : 'Día sin lavado', () => wash ? S.hair.wash : S.hair.nowash, wash ? 'hairW' : 'hairN'); };
A.hairProdAdd = async f => { S.hair.products.push({ id: uid(), name: f.n.value.trim() }); await saveSettings(); await render(); };
A.hairProdDel = async el => { S.hair.products = S.hair.products.filter(p => p.id !== el.dataset.id); await saveSettings(); await render(); };
A.hairApply = async el => { const r = S.hair.routines.find(x => x.id === el.dataset.id); await updDay(state.date, d => { d.hair.items ||= {}; r.items.forEach(i => { d.hair.items[i] = true; }); }); await render(); };
A.hairRoutineNew = () => sheet('Crear rutina capilar', () => `<form data-s="hairRoutineSave">${field('Nombre', '<input name="n" required placeholder="Lavado con mascarilla">')}
  ${field('Tipo de día', '<select name="t"><option value="wash">Día de lavado</option><option value="nowash">Día sin lavado</option></select>')}
  <p class="field-l">Pasos de la rutina</p><div class="chips col">${[...S.hair.wash.map(i => [i, 'lavado']), ...S.hair.nowash.map(i => [i, 'sin lavado'])].map(([i, k]) => `<label class="toggle"><input type="checkbox" name="i_${i.id}"><span>${esc(i.name)} (${k})</span></label>`).join('')}</div><button class="btn wide">Guardar rutina</button></form>`);
A.hairRoutineSave = async f => {
  const pool = f.t.value === 'wash' ? S.hair.wash : S.hair.nowash, items = pool.filter(i => f['i_' + i.id]?.checked).map(i => i.id);
  if (!items.length) return toast('Marca al menos un paso de ese tipo de día.');
  S.hair.routines.push({ id: uid(), name: f.n.value.trim(), type: f.t.value, items }); await saveSettings(); closeSheet(); toast('Rutina guardada'); await render();
};
A.hairRoutineDel = async el => { S.hair.routines = S.hair.routines.filter(r => r.id !== el.dataset.id); await saveSettings(); await render(); };

/* ---------- Hábitos propios ---------- */
routes.habitos = {
  title: 'Mis hábitos', back: true,
  async render() {
    const date = state.date, day = await getDay(date), t = todayStr(), hist = await range('days', addDays(t, -29), t);
    return `<div class="page">${dateNav()}<p class="muted">Lo que añadas aquí aparece en tu resumen de hoy y cuenta en tu porcentaje.</p>
    ${S.habits.length ? `<ul class="checks">${S.habits.map(h => `<li>${check(day.habits?.[h.id], 'habitTick', `data-id="${h.id}"`, h.name)}<button class="grow textbtn" data-a="habitEdit" data-id="${h.id}"><b>${esc(h.name)}</b><small>${esc(freqLabel(h.days))}. ${hist.filter(x => x.habits?.[h.id]).length} de los últimos 30 días</small></button><button class="icon" data-a="habitDel" data-id="${h.id}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : empty('Aún no has añadido hábitos propios.')}
    <button class="btn wide" data-a="habitNew">Añadir hábito</button></div>`;
  },
};
const habitForm = h => `<form data-s="habitSave" data-id="${h.id || ''}">${field('Nombre', `<input name="n" required value="${esc(h.name || '')}">`)}<p class="field-l">Días</p>${wdPicker(h.days || [0, 1, 2, 3, 4, 5, 6])}<button class="btn wide">Guardar hábito</button></form>`;
A.habitNew = () => sheet('Añadir hábito', () => habitForm({}));
A.habitEdit = el => sheet('Editar hábito', () => habitForm(S.habits.find(h => h.id === el.dataset.id)));
A.habitSave = async f => { const d = { name: f.n.value.trim(), days: readDays(f) }, id = f.dataset.id; if (id) Object.assign(S.habits.find(h => h.id === id), d); else S.habits.push({ id: uid(), ...d }); await saveSettings(); closeSheet(); await render(); };
A.habitTick = async el => { await updDay(state.date, d => { d.habits ||= {}; d.habits[el.dataset.id] = !d.habits[el.dataset.id]; }); await render(); };
A.habitDel = async el => { if (!await confirmDlg('¿Eliminar este hábito? Los días ya marcados dejan de mostrarse.')) return; S.habits = S.habits.filter(h => h.id !== el.dataset.id); await saveSettings(); await render(); };
