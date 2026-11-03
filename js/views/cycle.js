// Ciclo menstrual: calendario, registro de periodos, síntomas y análisis. Todo se presenta como estimación.
import { A, CH, routes, state, S, render, toast, sheet, closeSheet, refreshSheet, confirmDlg, stat, field, numInput, ICON, empty, dateNav, saveSettings, chips, scale, go } from '../ui.js';
import { all, get, put, del, getDay, updDay, daysRange, workoutsRange } from '../db.js';
import { esc, nf, uid, todayStr, addDays, diffDays, fmtShort, fmtFull, fmtMonth, dateRange, startOfMonth, endOfMonth, weekday, numOrNull, mean, sum, toDate, WD_SHORT } from '../util.js';
import { PHASES, phaseFor, SYMPTOMS, sleepHours, workoutVolume } from '../domain.js';
import { ring, lineChart, barChart, hbars, heatTable, C } from '../charts.js';
import { model } from './shared.js';

const DISCLAIMER = 'Las fases y fechas son estimaciones a partir de tus registros, no certezas médicas. No uses esta aplicación como método anticonceptivo ni para diagnosticar enfermedades.';
const PHASE_KEYS = ['menstruacion', 'folicular', 'ovulacion', 'lutea'];
const PHASE_SHORT = { menstruacion: 'Mens.', folicular: 'Folic.', ovulacion: 'Ovul.', lutea: 'Lútea' };
const PH_COLOR = { menstruacion: 'var(--ph-m)', folicular: 'var(--ph-f)', ovulacion: 'var(--ph-o)', lutea: 'var(--ph-l)' };
const INTENSITY = [[1, 'Leve'], [2, 'Moderado'], [3, 'Abundante'], [4, 'Muy abundante']];
let month = null;
export const phaseLegend = () => `<ul class="phase-key">${PHASE_KEYS.map(p => `<li><i class="ph ph-${p}"></i>${PHASES[p]}</li>`).join('')}<li><i class="ph ph-pred"></i>Previsión</li></ul>`;
function calendar(ym, m, t) {
  const first = ym + '-01', last = endOfMonth(first), lead = (weekday(first) + 6) % 7;
  let cells = '<div class="cal-h">' + [1, 2, 3, 4, 5, 6, 0].map(k => `<span>${WD_SHORT[k]}</span>`).join('') + '</div><div class="cal-g">';
  for (let i = 0; i < lead; i++) cells += '<span></span>';
  for (const d of dateRange(first, last)) {
    const ph = phaseFor(d, m);
    cells += `<button class="cal-d ${ph ? 'ph-' + ph.phase : ''} ${ph?.est && d > t ? 'pred' : ''} ${d === t ? 'today' : ''}" data-a="cycleDay" data-d="${d}" aria-label="${fmtFull(d)}${ph ? ', ' + PHASES[ph.phase] : ''}">${+d.slice(8)}</button>`;
  }
  return cells + '</div>';
}
routes.ciclo = {
  title: 'Ciclo',
  async render() {
    const m = await model(), t = todayStr(), now = phaseFor(t, m);
    month ||= t.slice(0, 7);
    const open = m.last && !m.last.end && diffDays(t, m.last.start) < 15 ? m.last : null;
    const next = m.predictions[0];
    const shift = n => { const d = toDate(month + '-15'); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    return `<div class="page"><h1>Ciclo</h1>
    ${m.last ? `<section class="center-col">${ring(now ? Math.min(now.day / now.len, 1) : 0, { size: 186, stroke: 5, color: PH_COLOR[now?.phase] || 'var(--ph-m)', inner: `<b class="big">Día ${now?.day ?? '—'}</b><span>${esc(PHASES[now?.phase] || '')}</span><em>estimado</em>` })}
      ${m.late != null ? `<p class="lead center">Tu menstruación estaba prevista el ${fmtShort(m.nextStart)}. Regístrala cuando llegue y la previsión se ajustará.</p>` : `<p class="lead center">Próxima menstruación: hacia el ${fmtShort(next.start)}${m.margin ? `, ${m.margin === 1 ? 'un día' : `unos ${m.margin} días`} arriba o abajo` : ''}.</p>`}
      <p class="muted small center">${m.basedOn ? `Calculado con tus últimos ${m.basedOn} ${m.basedOn === 1 ? 'ciclo' : 'ciclos'}: ${m.avgLen} días de media.` : `Aún con ${m.avgLen} días de ciclo orientativos: mejorará con tus registros.`}</p></section>` : empty('Registra el primer día de tu última menstruación para empezar.')}
    <div class="row-btns">${open ? `<button class="btn" data-a="periodEnd">Terminó hoy</button>` : `<button class="btn" data-a="periodStart">Me ha venido hoy</button>`}<button class="btn ghost" data-a="periodNew">Registrar otra fecha</button></div>
    <button class="btn ghost wide" data-a="go" data-to="sintomas">Cuestionario de hoy</button>
    <div class="cal-nav"><button data-a="cycleMonth" data-m="${shift(-1)}" aria-label="Mes anterior">${ICON.back}</button><h2>${fmtMonth(month + '-15')}</h2><button data-a="cycleMonth" data-m="${shift(1)}" aria-label="Mes siguiente">${ICON.next}</button></div>
    ${calendar(month, m, t)}${phaseLegend()}
    <section class="stats">${stat('Ciclo medio', m.basedOn ? `${m.avgLen} días` : '—', m.basedOn ? `entre ${m.min} y ${m.max}` : 'faltan datos')}${stat('Sangrado medio', m.bleeds.length ? `${m.bleed} días` : '—')}${stat('Ciclos registrados', nf(m.ps.length))}</section>
    ${m.predictions.length ? `<h2>Previsiones</h2><div class="scroll-x"><table class="tbl"><thead><tr><th>Menstruación</th><th>Ovulación estimada</th></tr></thead><tbody>${m.predictions.slice(0, 4).map(p => `<tr><td>${fmtShort(p.start)}</td><td>${fmtShort(p.ovulation)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="row-btns"><button class="btn ghost" data-a="go" data-to="cicloanalisis">Análisis del ciclo</button><button class="btn ghost" data-a="cycleCfg">Ajustes del ciclo</button></div>
    <h2>Tus menstruaciones</h2>${m.ps.length ? `<ul class="list">${[...m.ps].reverse().map((p, i, arr) => { const prev = arr[i + 1]; return `<li><button class="grow textbtn" data-a="periodEdit" data-id="${p.id}"><b>${fmtFull(p.start)}</b><small>${p.end ? `${diffDays(p.end, p.start) + 1} días de sangrado` : 'Sin fecha de fin'}${p.intensity ? `, ${INTENSITY.find(x => x[0] === p.intensity)?.[1].toLowerCase()}` : ''}${prev ? `, ciclo de ${diffDays(p.start, prev.start)} días` : ''}</small></button><span class="chev">${ICON.next}</span></li>`; }).join('')}</ul>` : ''}
    <p class="disclaimer">${DISCLAIMER}</p></div>`;
  },
};
A.cycleMonth = async el => { month = el.dataset.m; await render(); };
A.periodStart = async () => { await put('periods', { id: uid(), start: todayStr(), end: null, intensity: null }); toast('Menstruación registrada: las previsiones se han actualizado'); await render(); };
A.periodEnd = async () => { const m = await model(); m.last.end = todayStr(); await put('periods', m.last); toast('Fecha de fin guardada'); await render(); };
const periodForm = p => `<form data-s="periodSave" data-id="${p.id || ''}">${field('Primer día', `<input name="start" type="date" max="${todayStr()}" required value="${p.start || ''}">`)}${field('Último día', `<input name="end" type="date" max="${todayStr()}" value="${p.end || ''}">`, 'Si aún no ha terminado, déjalo en blanco.')}
  ${field('Intensidad del sangrado', `<select name="intensity"><option value="">Sin indicar</option>${INTENSITY.map(([v, l]) => `<option value="${v}" ${p.intensity === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
  <button class="btn wide">Guardar</button>${p.id ? `<button type="button" class="btn ghost danger-t wide" data-a="periodDel" data-id="${p.id}">Eliminar registro</button>` : ''}</form>`;
A.periodNew = el => sheet('Registrar menstruación', () => periodForm({ start: el.dataset.d || '' }));
A.periodEdit = async el => { const p = await get('periods', el.dataset.id); sheet('Menstruación', () => periodForm(p)); };
A.periodSave = async f => {
  const start = f.start.value, end = f.end.value || null;
  if (end && end < start) return toast('El último día no puede ser anterior al primero.');
  const others = (await all('periods')).filter(p => p.id !== f.dataset.id);
  if (others.some(p => p.start === start)) return toast('Ya hay una menstruación registrada con ese primer día.');
  await put('periods', { id: f.dataset.id || uid(), start, end, intensity: numOrNull(f.intensity.value) });
  closeSheet(); toast('Guardado: las previsiones se han actualizado'); await render();
};
A.periodDel = async el => { if (!await confirmDlg('¿Eliminar este registro de menstruación?')) return; await del('periods', el.dataset.id); closeSheet(); await render(); };
A.cycleDay = async el => {
  const d = el.dataset.d, m = await model(), ph = phaseFor(d, m), day = await getDay(d), syms = Object.entries(day.sym || {}).filter(([, v]) => v > 0), lab = symLabels();
  sheet(fmtFull(d), () => `<p class="lead">${ph ? `${PHASES[ph.phase]}, día ${ph.day}${ph.est ? ' (estimado)' : ''}` : 'Sin datos del ciclo'}</p>${syms.length ? `<ul class="plain-list">${syms.map(([k, v]) => `<li>${esc(lab[k] || k)}: ${v} de 5</li>`).join('')}</ul>` : ''}
  ${d <= todayStr() ? `<div class="row-btns"><button class="btn ghost" data-a="symOpen" data-d="${d}">Registrar síntomas</button><button class="btn ghost" data-a="periodNew" data-d="${d}">Empezó este día</button></div>` : '<p class="muted small">Fecha futura: es una previsión.</p>'}`);
};
A.symOpen = el => { closeSheet(); state.date = el.dataset.d; go('sintomas'); };
A.cycleCfg = () => sheet('Ajustes del ciclo', () => `<form data-s="cycleCfgSave">${field('Duración de ciclo orientativa (días)', numInput('avgLen', S.cycle.avgLen, 'required min="15" max="60"'), 'Solo se usa hasta que tengas dos menstruaciones registradas.')}${field('Días de sangrado orientativos', numInput('bleed', S.cycle.bleed, 'required min="1" max="15"'))}${field('Duración de la fase lútea (días)', numInput('luteal', S.cycle.luteal, 'required min="8" max="20"'), 'La ovulación se estima contando estos días hacia atrás desde la siguiente menstruación.')}<button class="btn wide">Guardar ajustes</button></form>`);
A.cycleCfgSave = async f => { Object.assign(S.cycle, { avgLen: +f.avgLen.value, bleed: +f.bleed.value, luteal: +f.luteal.value }); await saveSettings(); closeSheet(); await render(); };

/* ---------- Cuestionario diario ---------- */
export const symLabels = () => Object.fromEntries([...SYMPTOMS.fisicos, ...SYMPTOMS.emocionales, ...S.cycle.customSym.map(c => [c.id, c.name])]);
const symRow = ([k, l], v) => `<div class="symrow"><span>${esc(l)}</span>${scale(l, v ?? null, 0, 5, 'symSet', `data-k="${k}"`)}</div>`;
routes.sintomas = {
  title: 'Cómo me encuentro', back: true,
  async render() {
    const day = await getDay(state.date), s = day.sym || {}, n = Object.values(s).filter(v => v != null).length, total = SYMPTOMS.fisicos.length + SYMPTOMS.emocionales.length + S.cycle.customSym.length;
    return `<div class="page">${dateNav()}<p class="muted small">De 0 (nada) a 5 (mucho). Se guarda al tocar; deja en blanco lo que no quieras contestar. ${n} de ${total} respondidos.</p>
    <button class="btn ghost sm" data-a="symZero">Poner a 0 los que falten</button>
    <h2>Físicos</h2>${SYMPTOMS.fisicos.map(x => symRow(x, s[x[0]])).join('')}
    <h2>Emocionales</h2>${SYMPTOMS.emocionales.map(x => symRow(x, s[x[0]])).join('')}
    <h2>Mis síntomas</h2>${S.cycle.customSym.map(c => symRow([c.id, c.name], s[c.id])).join('')}
    <form class="inline" data-s="symAdd"><input name="n" required placeholder="Añadir síntoma" aria-label="Añadir síntoma"><button class="btn ghost">Añadir</button></form>
    ${S.cycle.customSym.length ? `<div class="chips">${S.cycle.customSym.map(c => `<button class="chip" data-a="symRemove" data-id="${c.id}">Quitar ${esc(c.name)}</button>`).join('')}</div>` : ''}
    <label class="field"><span>Notas</span><textarea rows="2" data-c="symNote">${esc(day.symNote || '')}</textarea></label></div>`;
  },
};
A.symSet = async el => {
  const { k, v } = el.dataset;
  await updDay(state.date, d => { d.sym ||= {}; d.sym[k] = d.sym[k] === +v ? null : +v; });
  const row = el.closest('.scale'), cur = (await getDay(state.date)).sym[k];
  row.querySelectorAll('button').forEach(b => { const on = +b.dataset.v === cur; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
};
A.symZero = async () => { const keys = Object.keys(symLabels()); await updDay(state.date, d => { d.sym ||= {}; keys.forEach(k => { if (d.sym[k] == null) d.sym[k] = 0; }); }); await render(); };
A.symAdd = async f => { const n = f.n.value.trim(); if (!n) return; S.cycle.customSym.push({ id: 'c_' + uid(), name: n }); await saveSettings(); await render(); };
A.symRemove = async el => { if (!await confirmDlg('¿Quitar este síntoma del cuestionario? Lo ya registrado se conserva.', 'Quitar')) return; S.cycle.customSym = S.cycle.customSym.filter(c => c.id !== el.dataset.id); await saveSettings(); await render(); };
CH.symNote = el => updDay(state.date, d => { d.symNote = el.value; });

/* ---------- Análisis ---------- */
routes.cicloanalisis = {
  title: 'Análisis del ciclo', back: true,
  async render() {
    const m = await model(), t = todayStr();
    if (!m.ps.length) return `<div class="page">${empty('El análisis aparecerá cuando registres menstruaciones y síntomas.')}</div>`;
    const start = m.ps[0].start, days = await daysRange(start, t), ws = (await workoutsRange(start, t)).filter(w => w.status === 'done');
    const lab = symLabels(), tag = new Map(days.map(d => [d.date, phaseFor(d.date, m)]));
    const inPhase = p => days.filter(d => tag.get(d.date)?.phase === p);
    // Frecuencia de síntomas
    const freq = {}; days.forEach(d => Object.entries(d.sym || {}).forEach(([k, v]) => { if (v > 0) freq[k] = (freq[k] || 0) + 1; }));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const heat = top.slice(0, 12).map(([k]) => ({ label: lab[k] || k, values: PHASE_KEYS.map(p => mean(inPhase(p).map(d => d.sym?.[k] ?? null))) }));
    // Por día del ciclo
    const maxLen = Math.min(45, Math.max(...m.lengths, m.avgLen));
    const byDay = (fn) => Array.from({ length: maxLen }, (_, i) => mean(days.filter(d => tag.get(d.date)?.day === i + 1).map(fn)));
    const labels = Array.from({ length: maxLen }, (_, i) => `Día ${i + 1}`);
    const sh = d => d.sleep ? sleepHours(d.sleep.bed, d.sleep.wake, d.sleep.latency) : null;
    const perPhase = fn => PHASE_KEYS.map(p => mean(inPhase(p).map(fn)));
    // Rendimiento
    const wTag = ws.map(w => ({ w, p: phaseFor(w.date, m)?.phase }));
    const perf = PHASE_KEYS.map(p => { const l = wTag.filter(x => x.p === p); const rpes = l.flatMap(x => x.w.items.map(i => i.rpe)); return { n: l.length, vol: mean(l.map(x => workoutVolume(x.w))), rpe: mean(rpes) }; });
    // Comparación entre ciclos
    const cyc = m.ps.map((p, i) => ({ p, next: m.ps[i + 1]?.start })).slice(-8).map(({ p, next }) => {
      const r = days.filter(d => d.date >= p.start && (!next || d.date < next));
      const symvals = r.flatMap(d => Object.values(d.sym || {}).filter(v => v != null));
      return { start: p.start, len: next ? diffDays(next, p.start) : null, bleed: p.end ? diffDays(p.end, p.start) + 1 : null, sym: mean(symvals), energy: mean(r.map(d => d.sym?.energia ?? null)), mood: mean(r.map(d => d.sym?.animo ?? null)) };
    }).reverse();
    return `<div class="page"><p class="disclaimer">Observaciones a partir de tus datos, con fases estimadas. Una coincidencia no demuestra una causa.</p>
    ${hbars({ title: 'Síntomas más frecuentes', rows: top.filter(([k]) => !['energia', 'animo', 'motivacion', 'concentracion'].includes(k)).slice(0, 10).map(([k, v]) => ({ label: lab[k] || k, value: v })), fmt: v => `${v} ${v === 1 ? 'día' : 'días'}`, empty: 'Completa el cuestionario diario para ver tus síntomas.' })}
    ${heatTable({ title: 'Intensidad media por fase (0 a 5)', cols: PHASE_KEYS.map(p => PHASE_SHORT[p]), rows: heat })}
    ${lineChart({ title: 'Energía y estado de ánimo por día del ciclo', series: [{ name: 'Energía', color: C.a, values: byDay(d => d.sym?.energia ?? null) }, { name: 'Estado de ánimo', color: C.b, values: byDay(d => d.sym?.animo ?? null) }], labels, min: 0, max: 5, d: 1, empty: 'Registra energía y ánimo en el cuestionario.' })}
    ${barChart({ title: 'Sueño medio por fase', values: perPhase(sh), labels: PHASE_KEYS.map(p => PHASE_SHORT[p]), unit: 'h', d: 1, name: 'Horas', empty: 'Registra tu sueño para compararlo.' })}
    ${barChart({ title: 'Cambios en el apetito por fase (0 a 5)', values: perPhase(d => d.sym?.apetito ?? null), labels: PHASE_KEYS.map(p => PHASE_SHORT[p]), d: 1, name: 'Apetito', empty: 'Registra el apetito en el cuestionario.' })}
    <h2>Ciclo y rendimiento deportivo</h2>${ws.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th></th><th>Sesiones</th><th>Volumen medio</th><th>Dificultad</th></tr></thead><tbody>${PHASE_KEYS.map((p, i) => `<tr><th>${PHASES[p]}</th><td>${perf[i].n}</td><td>${perf[i].vol == null ? '—' : nf(perf[i].vol) + ' kg'}</td><td>${nf(perf[i].rpe, 1)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Termina sesiones de entrenamiento para compararlas por fase.</p>'}
    <h2>Comparación entre ciclos</h2><div class="scroll-x"><table class="tbl"><thead><tr><th>Inicio</th><th>Días</th><th>Sangrado</th><th>Síntomas</th><th>Energía</th><th>Ánimo</th></tr></thead><tbody>${cyc.map(c => `<tr><td>${fmtShort(c.start)}</td><td>${c.len ?? 'en curso'}</td><td>${c.bleed ?? '—'}</td><td>${nf(c.sym, 1)}</td><td>${nf(c.energy, 1)}</td><td>${nf(c.mood, 1)}</td></tr>`).join('')}</tbody></table></div>
    ${barChart({ title: 'Duración de cada ciclo', values: m.lengths.slice(-12), labels: m.ps.slice(1).slice(-12).map(p => fmtShort(p.start)), unit: 'días', name: 'Días', empty: 'Con dos menstruaciones verás la primera duración.' })}
    <p class="disclaimer">${DISCLAIMER}</p></div>`;
  },
};
