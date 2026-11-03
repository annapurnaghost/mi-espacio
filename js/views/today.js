import { A, CH, routes, state, S, go, render, toast, sheet, closeSheet, ICON, check, saveSettings, field, numInput, form } from '../ui.js';
import { updDay } from '../db.js';
import { esc, fmtLong, nf, hours, todayStr, addDays, nowTime, diffDays, fmtShort, numOrNull, pct, toDate, MONTHS, WEEKDAYS } from '../util.js';
import { sleepHours, PHASES, phaseFor, scheduledOn, macroSplit } from '../domain.js';
import { corolla, progress } from '../charts.js';
import { dayCtx, model } from './shared.js';

const ROWS_ACTION = { steps: 'quickSteps' };
routes.hoy = {
  title: 'Hoy',
  async render() {
    const c = await dayCtx(state.date), m = await model(), d = c.date, t = todayStr();
    const sl = c.day.sleep || {}, sh = sleepHours(sl.bed, sl.wake, sl.latency);
    const ph = phaseFor(d, m), dt = toDate(d), tot = c.totals;
    const goalKcal = S.goals.kcal;
    const backupDays = S.lastBackup ? diffDays(t, S.lastBackup.slice(0, 10)) : null;
    const hasData = c.items.some(i => i.pct > 0);
    const backup = (backupDays == null ? hasData : backupDays >= 7) ? `<button class="notice" data-a="go" data-to="ajustes">${backupDays == null ? 'Aún no has hecho ninguna copia de seguridad.' : `Tu última copia de seguridad es de hace ${backupDays} días.`} Hacer una ahora</button>` : '';
    const rows = c.items.map(i => `<li class="drow ${i.done ? 'is-done' : ''}">
      ${check(i.done, 'toggleItem', `data-k="${i.key}"`, 'Marcar ' + i.label)}
      <button class="drow-main" data-a="${ROWS_ACTION[i.key] || 'go'}" data-to="${i.route}"><span class="drow-t">${esc(i.label)}</span><span class="drow-d">${esc(i.detail)}${i.manual && !i.computedDone ? ', marcado a mano' : ''}</span>${progress(i.pct)}</button></li>`).join('');
    const showWorkoutRest = !c.items.find(i => i.key === 'workout');
    return `<div class="page today">
    ${backup}
    <section class="hero">
      <div class="hero-date">
        <button class="hero-nav" data-a="dayShift" data-n="-1" aria-label="Día anterior">${ICON.back}</button>
        <label class="hero-title"><span class="hero-wd">${d === t ? 'Hoy, ' : ''}${WEEKDAYS[dt.getDay()]}</span><span class="hero-day">${dt.getDate()} de ${MONTHS[dt.getMonth()]}</span><input type="date" value="${d}" max="${t}" data-c="setDate" aria-label="Elegir fecha"></label>
        <button class="hero-nav" data-a="dayShift" data-n="1" ${d >= t ? 'disabled' : ''} aria-label="Día siguiente">${ICON.next}</button>
      </div>
      ${corolla(c.items, { size: 236, inner: `<b>${Math.round(c.pct * 100)}<small> %</small></b><span>del día</span>` })}
      <div class="trio">
        <button data-a="go" data-to="sueno"><b>${sl.wake || '—'}</b><span>Me levanté</span></button>
        <button data-a="go" data-to="sueno"><b>${sl.bed || '—'}</b><span>Me acosté</span></button>
        <button data-a="go" data-to="sueno"><b>${sh == null ? '—' : hours(sh)}</b><span>Sueño</span></button>
      </div>
    </section>

    <section class="band">
      <button class="line" data-a="go" data-to="ciclo"><span>Ciclo</span><b>${ph ? `${esc(PHASES[ph.phase])}, día ${ph.day}${ph.est ? ' (estimado)' : ''}` : 'Registra tu primera menstruación'}</b></button>
      <button class="line" data-a="go" data-to="entreno"><span>Entrenamiento</span><b>${c.planned ? 'Programado: ' + esc(c.planned.name) : 'Sin programar'}. ${c.workouts.some(w => w.status === 'done') ? 'Completado' : c.workouts.length ? 'En curso' : 'Sin completar'}</b></button>
      <button class="line macro" data-a="go" data-to="comida"><span>Comida</span><b>${tot.count ? '≈ ' : ''}${nf(tot.kcal)} kcal${goalKcal ? ` de ${nf(goalKcal)}` : ''}</b>
        <em>Proteínas ${tot.count ? '≈' : ''}${nf(tot.p)} g. Carbohidratos ${tot.count ? '≈' : ''}${nf(tot.c)} g. Grasas ${tot.count ? '≈' : ''}${nf(tot.f)} g</em></button>
    </section>

    <div class="quick">
      <button class="btn ghost" data-a="quickSteps">Pasos</button>
      <button class="btn ghost" data-a="quickWater" data-ml="${S.water.glass}">+ Agua</button>
      <button class="btn ghost" data-a="go" data-to="sintomas">Síntomas</button>
    </div>
    <ul class="drows">${rows}</ul>
    ${showWorkoutRest ? '<p class="muted small center">Hoy no hay entrenamiento programado, así que no cuenta para el porcentaje.</p>' : ''}
    </div>`;
  },
};

A.toggleItem = async el => {
  const k = el.dataset.k, date = state.date, c = await dayCtx(date), it = c.items.find(i => i.key === k);
  if (!it) return;
  const time = nowTime();
  if (k === 'skinAM' || k === 'skinPM') {
    const part = k === 'skinAM' ? 'am' : 'pm', list = scheduledOn(S.skin[part], date);
    await updDay(date, d => {
      d.skin ||= {}; d.skin[part] ||= {};
      for (const p of list) d.skin[part][p.id] = it.done ? { done: false } : { done: true, time, name: p.name };
    });
  } else if (k === 'dental') {
    await updDay(date, d => { d.dental ||= {}; S.dental.filter(x => x.counts).forEach(x => { d.dental[x.id] = !it.done; }); });
  } else if (k === 'shower') {
    await updDay(date, d => { d.shower ||= {}; d.shower.done = !it.done; if (!it.done && !d.shower.time) d.shower.time = time; });
  } else if (it.habit) {
    await updDay(date, d => { d.habits ||= {}; d.habits[it.habit] = !it.done; });
  } else if (it.computedDone) {
    toast('Este indicador sale de tus registros: cámbialo en su apartado.');
    go(it.route); return;
  } else {
    await updDay(date, d => { d.manual ||= {}; d.manual[k] = !d.manual[k]; });
  }
  await render();
};
A.quickSteps = async () => {
  const c = await dayCtx(state.date);
  sheet('Pasos', () => `<form data-s="saveQuickSteps"><p class="lead">${esc(fmtLong(state.date))}: ${nf(c.day.steps || 0)} pasos.</p>
    ${field('Pasos totales del día', numInput('steps', c.day.steps ?? '', 'autofocus required'))}
    <div class="row-btns"><button type="button" class="btn ghost" data-a="go" data-to="pasos">Abrir pasos</button><button class="btn">Guardar pasos</button></div></form>`);
};
A.saveQuickSteps = async f => {
  const v = numOrNull(new FormData(f).get('steps'));
  if (v == null) return toast('Escribe un número de pasos.');
  await updDay(state.date, d => { d.steps = Math.round(v); });
  closeSheet(); toast('Pasos guardados'); await render();
};
A.quickWater = async el => {
  const ml = +el.dataset.ml;
  await updDay(state.date, d => { (d.water ||= []).push({ ml, t: nowTime() }); });
  toast(`+${nf(ml)} ml de agua`); await render();
};
