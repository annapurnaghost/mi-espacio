import { A, routes, state, S, dateNav, render, toast, sheet, closeSheet, stat, field, numInput, ICON, confirmDlg, refreshAll, chips, empty } from '../ui.js';
import { all, getDay, updDay } from '../db.js';
import { esc, nf, todayStr, addDays, dateRange, fmtShort, fmtFull, numOrNull, fmtMonth, mean, clamp } from '../util.js';
import { stepsStats, parseSteps } from '../domain.js';
import { ring, barChart, lineChart, C } from '../charts.js';

let span = 30, limit = 30;
routes.pasos = {
  title: 'Pasos', back: true,
  async render() {
    const date = state.date, t = todayStr(), days = await all('days'), goal = S.goals.steps;
    const d = days.find(x => x.date === date) || {}, s = stepsStats(days, t, goal);
    const v = d.steps || 0, p = v / goal, rem = Math.max(goal - v, 0);
    const map = new Map(days.map(x => [x.date, x.steps]));
    const ds = dateRange(addDays(t, -(span - 1)), t);
    const months = {}; days.filter(x => x.steps != null).forEach(x => { (months[x.date.slice(0, 7)] ||= []).push(x.steps); });
    const mk = Object.keys(months).sort().slice(-12);
    const hist = days.filter(x => x.steps != null).sort((a, b) => a.date < b.date ? 1 : -1);
    return `<div class="page">${dateNav()}
    <section class="center-col">${ring(p, { size: 216, stroke: 7, inner: `<b class="big">${nf(v)}</b><span>de ${nf(goal)} pasos</span><em>${Math.round(p * 100)} %</em>` })}
      <p class="lead center">${rem ? `Te quedan ${nf(rem)} pasos.` : `Objetivo alcanzado${v > goal ? `, ${nf(v - goal)} de más` : ''}.`}</p></section>
    <form class="inline" data-s="stepsSet"><input name="n" type="number" inputmode="numeric" min="0" placeholder="Número de pasos" aria-label="Número de pasos" required>
      <button class="btn ghost" name="m" value="add" data-a="stepsMode" data-m="add" type="button">Sumar</button><button class="btn" data-a="stepsMode" data-m="set" type="button">Fijar total</button></form>
    <button class="linkish" data-a="stepsImport">Traer los pasos desde Salud con un Atajo de iOS</button>
    <section class="stats">
      ${stat('Media diaria', nf(s.avgAll), 'todos los registros')}
      ${stat('Media semanal', nf(s.avg7), 'últimos 7 días')}
      ${stat('Media mensual', nf(s.avg30), 'últimos 30 días')}
      ${stat('Récord personal', nf(s.best?.steps), s.best ? fmtShort(s.best.date) : '')}
      ${stat('Días con objetivo', nf(s.hits.length), `de ${nf(s.total)} registrados`)}
      ${stat('Racha actual', nf(s.streak), s.streak === 1 ? 'día' : 'días')}
    </section>
    ${chips([[7, '7 días'], [30, '30 días'], [90, '3 meses'], [365, '1 año']], span, 'stepSpan')}
    ${span <= 90 ? barChart({ title: 'Evolución diaria', values: ds.map(x => map.get(x) ?? null), labels: ds.map(fmtShort), goal, name: 'Pasos' })
      : lineChart({ title: 'Evolución diaria', series: [{ name: 'Pasos', color: C.a, values: ds.map(x => map.get(x) ?? null) }], labels: ds.map(fmtShort), goal })}
    ${barChart({ title: 'Media por mes', values: mk.map(k => mean(months[k])), labels: mk.map(k => fmtMonth(k + '-01').slice(0, 3) + ' ' + k.slice(2, 4)), goal, name: 'Pasos' })}
    <h2>Días con ${nf(goal)} pasos</h2>
    ${s.hits.length ? `<ul class="tags">${[...s.hits].reverse().slice(0, 40).map(h => `<li>${fmtShort(h.date)}${h.date.slice(0, 4) !== t.slice(0, 4) ? ' ' + h.date.slice(0, 4) : ''}: ${nf(h.steps)}</li>`).join('')}</ul>` : empty('Cuando llegues al objetivo, el día aparecerá aquí.')}
    <h2>Registro por fecha</h2>
    ${hist.length ? `<ul class="list">${hist.slice(0, limit).map(h => `<li><span>${fmtFull(h.date)}</span><b>${nf(h.steps)}</b><button class="icon" data-a="stepEdit" data-d="${h.date}" aria-label="Editar">${ICON.edit}</button><button class="icon" data-a="stepDel" data-d="${h.date}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>
    ${hist.length > limit ? '<button class="btn ghost wide" data-a="stepMore">Ver más</button>' : ''}` : empty('Aún no has registrado pasos.')}
    </div>`;
  },
};
A.stepSpan = async el => { span = +el.dataset.v; await render(); };
A.stepMore = async () => { limit += 60; await render(); };
A.stepsMode = async el => {
  const f = el.closest('form'), v = numOrNull(f.n.value);
  if (v == null) { toast('Escribe un número de pasos.'); return; }
  await updDay(state.date, d => { d.steps = el.dataset.m === 'add' ? (d.steps || 0) + Math.round(v) : Math.round(v); });
  toast('Pasos guardados'); await render();
};
A.stepsSet = f => A.stepsMode({ closest: () => f, dataset: { m: 'set' } });
A.stepEdit = async el => {
  const date = el.dataset.d, d = await getDay(date);
  sheet('Editar pasos', () => `<form data-s="stepSave" data-d="${date}"><p class="lead">${fmtFull(date)}</p>${field('Pasos', numInput('n', d.steps, 'required'))}<button class="btn wide">Guardar pasos</button></form>`);
};
A.stepSave = async f => { const v = numOrNull(f.n.value); if (v == null) return; await updDay(f.dataset.d, d => { d.steps = Math.round(v); }); closeSheet(); toast('Pasos guardados'); await render(); };
A.stepDel = async el => { const date = el.dataset.d; if (!await confirmDlg(`¿Eliminar los pasos del ${fmtFull(date)}?`)) return; await updDay(date, d => { delete d.steps; }); toast('Registro eliminado'); await render(); };
function applyImport(text) {
  const rows = parseSteps(text, state.date === todayStr() ? todayStr() : state.date);
  if (!rows.length) { toast('No se ha encontrado ningún número de pasos en ese texto.'); return false; }
  return Promise.all(rows.map(r => updDay(r.date, d => { d.steps = r.steps; }))).then(() => { toast(rows.length === 1 ? `${nf(rows[0].steps)} pasos guardados` : `${rows.length} días guardados`); return true; });
}
A.stepsImport = () => sheet('Pasos desde Salud', () => `
  <p class="lead">Una aplicación web no puede leer Salud directamente: Apple reserva ese acceso a las aplicaciones nativas. La alternativa es un Atajo que copia tus pasos y los pegas aquí con un toque.</p>
  <button class="btn wide" data-a="stepsPaste">Pegar pasos copiados</button>
  <form data-s="stepsImportText"><label class="field"><span>O escríbelos a mano</span><textarea name="t" rows="2" placeholder="12345"></textarea><small>Vale un número o varias líneas como 2026-11-03=12345.</small></label><button class="btn ghost wide">Guardar pasos</button></form>
  <h3>Crear el Atajo una sola vez</h3>
  <ol class="steps-list"><li>Abre Atajos y crea un atajo nuevo llamado «Pasos a Alba».</li>
  <li>Añade <b>Buscar muestras de salud</b>. Tipo: Pasos. Fecha de inicio: hoy. Agrupar por: día.</li>
  <li>Añade <b>Calcular estadísticas</b>: Suma de las muestras.</li>
  <li>Añade <b>Copiar al portapapeles</b> con ese resultado.</li>
  <li>Añade <b>Abrir app</b> y elige Alba, si aparece en la lista. Si no aparece, abre Alba desde tu pantalla de inicio.</li></ol>
  <p class="muted small">Ejecútalo cuando quieras actualizar y toca «Pegar pasos copiados». iOS te pedirá confirmar el pegado. Los nombres de las acciones pueden variar un poco según la versión de iOS.</p>`);
A.stepsPaste = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (await applyImport(text)) { closeSheet(); await render(); }
  } catch { toast('El portapapeles no está disponible: escribe los pasos en el cuadro.'); }
};
A.stepsImportText = async f => { if (await applyImport(f.t.value)) { closeSheet(); await render(); } };
