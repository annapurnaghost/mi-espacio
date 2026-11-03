// Ajustes, copias de seguridad, recordatorios y primer inicio.
import { A, CH, routes, S, render, go, toast, sheet, closeSheet, refreshSheet, confirmDlg, field, numInput, ICON, saveSettings, chips, stat } from '../ui.js';
import { encryptedBlob, plainBlob, decryptBackup } from '../backup.js';
import { all, get, put, del, exportAll, importAll, validateBackup, wipeAll, backupName, STORES } from '../db.js';
import { esc, nf, todayStr, uid, numOrNull, fmtFull, pad, addDays } from '../util.js';
import { EXERCISES } from '../data/exercises.js';
import { FOODS } from '../data/foods.js';

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

routes.ajustes = {
  title: 'Ajustes', back: true,
  async render() {
    const g = S.goals;
    let usage = '';
    try { const e = await navigator.storage?.estimate?.(); if (e) usage = `${nf(e.usage / 1048576, 1)} MB usados`; } catch { /* no disponible */ }
    let persisted = null;
    try { persisted = await navigator.storage?.persisted?.(); } catch { /* no disponible */ }
    const hidden = (await all('exercises')).filter(x => x.hidden);
    const snaps = (await all('snapshots')).sort((a, b) => a.id < b.id ? 1 : -1);
    const dash = [['sleep', 'Sueño'], ['steps', 'Pasos'], ['workout', 'Entrenamiento'], ['protein', 'Proteína'], ['water', 'Agua'], ['skinAM', 'Skincare de mañana'], ['skinPM', 'Skincare de noche'], ['dental', 'Higiene dental'], ['shower', 'Ducha'], ['hair', 'Cuidado capilar'], ['reading', 'Lectura']];
    return `<div class="page">
    <h2>Objetivos</h2><form data-s="goalsSave"><div class="grid2">
    ${field('Pasos diarios', numInput('steps', g.steps, 'required'))}${field('Proteína (g)', numInput('protein', g.protein, 'required'))}${field('Fibra (g)', numInput('fiber', g.fiber, 'required'))}${field('Calorías (opcional)', numInput('kcal', g.kcal, 'placeholder="Sin objetivo"'))}${field('Agua (ml)', numInput('water', g.water, 'required'))}${field('Tamaño de vaso (ml)', numInput('glass', S.water.glass, 'required'))}${field('Páginas diarias', numInput('pages', g.pages, 'required'))}${field('Horas de sueño', numInput('sleep', g.sleep, 'required'))}</div><button class="btn wide">Guardar objetivos</button></form>
    <h2>Qué cuenta para tu porcentaje</h2><div class="chips col">${dash.map(([k, l]) => `<label class="toggle"><input type="checkbox" data-c="dashToggle" data-k="${k}" ${S.dash[k] !== false ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <button class="btn ghost wide" data-a="go" data-to="habitos">Añadir o eliminar hábitos</button>
    <h2>Copias de seguridad</h2>
    <p class="muted">Tus datos viven solo en este iPhone y sobreviven a cierres y actualizaciones. Si borras Alba o cambias de iPhone, solo los recuperas con una copia: guárdala en iCloud Drive, cifrada con tu contraseña.</p>
    <p class="lead small-lead">${S.lastBackup ? `Última copia: ${fmtFull(S.lastBackup.slice(0, 10))}.` : 'Aún no has hecho ninguna copia.'} ${usage}.${persisted === true ? ' Almacenamiento persistente concedido.' : ''}</p>
    <button class="btn wide" data-a="backupNew">Crear copia cifrada</button>
    <label class="btn ghost wide fileb">Importar una copia<input type="file" data-c="restoreFile" hidden></label>
    <h3>Puntos de restauración</h3><p class="muted small">Alba guarda sola una instantánea al día de los últimos 5 días, sin fotos, por si borras algo por error. Están en este iPhone: no sustituyen a una copia.</p>
    ${snaps.length ? `<ul class="list">${snaps.map(n => `<li><span class="grow">${esc(n.label || fmtFull(n.id.slice(0, 10)))}</span><button class="btn ghost sm" data-a="snapRestore" data-id="${n.id}">Restaurar</button></li>`).join('')}</ul>` : ''}
    <h2>Recordatorios</h2><div id="rem">${remHtml()}</div>
    <h2>Apariencia</h2>${chips([['auto', 'Automática'], ['light', 'Clara'], ['dark', 'Oscura']], S.theme, 'themeSet')}
    <h2>Biblioteca</h2><p class="muted">${EXERCISES.length} ejercicios y ${FOODS.length} alimentos de referencia, más los tuyos.</p>
    ${hidden.length ? `<button class="btn ghost wide" data-a="unhide">Recuperar ${hidden.length} ejercicios ocultos</button>` : ''}
    <h2>Instalación</h2><button class="btn ghost wide" data-a="installHelp">Cómo instalar en el iPhone</button>
    <h2>Borrar todo</h2><button class="btn ghost danger-t wide" data-a="wipe">Borrar todos mis datos</button>
    <p class="muted small center">Alba 1.0. Sin cuentas ni servidores: nada sale de tu dispositivo, salvo las búsquedas que hagas en Open Food Facts.</p></div>`;
  },
};
A.goalsSave = async f => {
  const n = k => numOrNull(f[k].value);
  for (const k of ['steps', 'protein', 'fiber', 'water', 'pages', 'sleep']) { if (!(n(k) > 0)) return toast('Revisa los objetivos: deben ser mayores que cero.'); S.goals[k] = n(k); }
  S.goals.kcal = n('kcal') || null; S.water.glass = n('glass') || 250;
  await saveSettings(); toast('Objetivos guardados'); await render();
};
CH.dashToggle = async el => { S.dash[el.dataset.k] = el.checked; await saveSettings(); };
A.themeSet = async el => { S.theme = el.dataset.v; await saveSettings(); await render(); };
A.unhide = async () => { for (const x of (await all('exercises')).filter(e => e.hidden)) await del('exercises', x.id); toast('Ejercicios recuperados'); await render(); };

/* Copias */
async function saveFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  return true;
}
A.backupNew = () => sheet('Crear copia cifrada', () => `<form data-s="backupMake">${field('Contraseña de la copia', '<input name="p1" type="password" autocomplete="new-password" required minlength="8">', 'Al menos 8 caracteres. No se guarda en ningún sitio: si la olvidas, esa copia no se puede abrir.')}${field('Repite la contraseña', '<input name="p2" type="password" autocomplete="new-password" required>')}
  <label class="toggle"><input type="checkbox" name="photos" checked><span>Incluir fotos</span></label><label class="toggle"><input type="checkbox" name="plain" data-c="noop"><span>Sin cifrar (cualquiera con el archivo podrá leerlo)</span></label>
  <button class="btn wide">Preparar copia</button></form>`);
CH.noop = () => {};
let ready = null;
A.backupMake = async f => {
  const plain = f.plain.checked;
  if (!plain) { if (f.p1.value.length < 8) return toast('La contraseña necesita al menos 8 caracteres.'); if (f.p1.value !== f.p2.value) return toast('Las contraseñas no coinciden.'); }
  toast('Preparando la copia...');
  const data = await exportAll({ photos: f.photos.checked });
  ready = { blob: plain ? plainBlob(data) : await encryptedBlob(data, f.p1.value), name: backupName() };
  closeSheet();
  // iOS solo abre el menú de compartir justo después de un toque: por eso hay un segundo botón.
  sheet('Copia lista', () => `<p class="lead">${nf(ready.blob.size / 1048576, 1)} MB${plain ? ', sin cifrar' : ', cifrada'}.</p><p class="muted">En el siguiente menú elige <b>Guardar en Archivos</b> y después <b>iCloud Drive</b>.</p><button class="btn wide" data-a="backupSave">Guardar en Archivos</button>`);
};
A.backupSave = async () => {
  const ok = await saveFile(ready.blob, ready.name);
  if (ok) { S.lastBackup = new Date().toISOString(); await saveSettings(); ready = null; closeSheet(); toast('Copia guardada'); await render(); }
};
let pending;
const offerRestore = () => {
  const count = Object.values(pending.stores).reduce((a, r) => a + r.length, 0);
  sheet('Importar copia', () => `<p class="lead">Copia del ${fmtFull(pending.exported.slice(0, 10))} con ${nf(count)} registros${pending.photosIncluded ? '' : ', sin fotos'}.</p><p class="muted">Combinar conserva lo que ya tienes y sobrescribe los registros coincidentes. Reemplazar borra primero los datos actuales. Antes de importar se crea un punto de restauración.</p><div class="row-btns"><button class="btn" data-a="restoreGo" data-m="merge">Combinar</button><button class="btn ghost danger-t" data-a="restoreGo" data-m="replace">Reemplazar todo</button></div>`);
};
CH.restoreFile = async el => {
  const file = el.files[0]; el.value = ''; if (!file) return;
  let o;
  try { o = JSON.parse(await file.text()); } catch { return toast('Ese archivo no es una copia válida.'); }
  if (o?.app === 'alba' && o.encrypted) { pending = o; return sheet('Copia cifrada', () => `<form data-s="restoreUnlock">${field('Contraseña de la copia', '<input name="p" type="password" autocomplete="current-password" required>')}<button class="btn wide">Abrir copia</button></form>`); }
  try { pending = validateBackup(o); } catch (e) { return toast(e.message); }
  offerRestore();
};
A.restoreUnlock = async f => {
  toast('Abriendo la copia...');
  try { pending = validateBackup(await decryptBackup(pending, f.p.value)); } catch (e) { return toast(e.message); }
  closeSheet(); offerRestore();
};
export async function snapshot(id = todayStr(), label = null) {
  await put('snapshots', { id, label, data: await exportAll({ photos: false }) });
  const list = (await all('snapshots')).filter(x => !x.label).sort((a, b) => a.id < b.id ? 1 : -1);
  for (const x of list.slice(5)) await del('snapshots', x.id);
}
export async function autoSnapshot() {
  if (await get('snapshots', todayStr())) return;
  const hasData = (await all('days')).length || (await all('workouts')).length;
  if (hasData) await snapshot();
}
A.restoreGo = async el => {
  await snapshot('zz-antes-de-importar', 'Justo antes de la última importación');
  const n = await importAll(pending, el.dataset.m);
  closeSheet(); toast(`${nf(n)} registros importados`);
  setTimeout(() => location.reload(), 900);
};
A.snapRestore = async el => {
  const n = await get('snapshots', el.dataset.id);
  if (!await confirmDlg('¿Volver a este punto? Los registros posteriores se perderán; tus fotos se conservan.', 'Restaurar')) return;
  await importAll(n.data, 'replace');
  location.reload();
};
A.wipe = () => sheet('Borrar todos mis datos', () => `<form data-s="wipeGo"><p class="lead">Se borrarán todos tus registros, fotos y ajustes de este iPhone. No se puede deshacer.</p>${field('Escribe BORRAR para confirmar', '<input name="c" required autocomplete="off">')}<button class="btn danger wide">Borrar todo</button></form>`);
A.wipeGo = async f => { if (f.c.value.trim().toUpperCase() !== 'BORRAR') return toast('Escribe BORRAR para confirmar.'); await wipeAll(); location.reload(); };

/* Recordatorios: sin servidor, iOS no entrega avisos con la aplicación cerrada. */
const notifState = () => !('Notification' in window) ? 'unsupported' : Notification.permission;
function remHtml() {
  const st = notifState();
  return `<p class="muted">Con Alba cerrada, iOS solo entrega avisos enviados desde un servidor, y Alba no usa ninguno para que tus datos no salgan del iPhone. Tus avisos fiables pueden vivir en Calendario o en Atajos; con Alba abierta también aparecen dentro.</p>
  ${S.reminders.length ? `<ul class="list">${S.reminders.map(r => `<li><span class="grow"><b>${r.time}</b> ${esc(r.label)}</span><button class="icon" data-a="remDel" data-id="${r.id}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : ''}
  <form class="inline" data-s="remAdd"><input name="label" required placeholder="Rutina de noche" aria-label="Recordatorio"><input name="time" type="time" required aria-label="Hora"><button class="btn ghost">Añadir</button></form>
  <div class="row-btns"><button class="btn" data-a="remIcs" ${S.reminders.length ? '' : 'disabled'}>Exportar a Calendario</button><button class="btn ghost" data-a="remHelp">Avisos con Atajos</button>${st === 'default' ? '<button class="btn ghost" data-a="remPerm">Permitir avisos</button>' : ''}</div>
  ${st === 'unsupported' ? '<p class="muted small">Los avisos dentro de la aplicación requieren tenerla instalada en la pantalla de inicio.</p>' : st === 'denied' ? '<p class="muted small">Los avisos están desactivados en Ajustes de iOS.</p>' : ''}`;
}
A.remAdd = async f => { S.reminders.push({ id: uid(), label: f.label.value.trim(), time: f.time.value }); S.reminders.sort((a, b) => a.time < b.time ? -1 : 1); await saveSettings(); await render(); };
A.remDel = async el => { S.reminders = S.reminders.filter(r => r.id !== el.dataset.id); await saveSettings(); await render(); };
A.remHelp = () => sheet('Avisos con Atajos', () => `<ol class="steps-list"><li>Abre Atajos y ve a <b>Automatización</b>.</li><li>Crea una nueva con <b>Hora del día</b>, a la hora que quieras, y elige que se ejecute de inmediato.</li><li>Añade <b>Mostrar notificación</b> con tu texto.</li><li>Si quieres, añade <b>Abrir app</b> y elige Alba, si aparece en la lista.</li></ol><p class="muted small">Con Calendario: exporta, guarda el archivo en Archivos, ábrelo desde ahí y añade los eventos. Los nombres pueden variar según tu versión de iOS.</p>`);
A.remPerm = async () => { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Avisos permitidos' : 'Avisos no permitidos'); await render(); };
A.remIcs = async () => {
  const d = todayStr().replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
  const icsEsc = s => s.replace(/([,;\\])/g, '\\$1');
  const ev = S.reminders.map(r => { const t = r.time.replace(':', ''); return ['BEGIN:VEVENT', `UID:${r.id}@alba`, `DTSTAMP:${stamp}`, `DTSTART:${d}T${t}00`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY', `SUMMARY:${icsEsc(r.label)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(r.label)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n'); }).join('\r\n');
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Alba//ES\r\nCALSCALE:GREGORIAN\r\n${ev}\r\nEND:VCALENDAR\r\n`;
  await saveFile(new Blob([ics], { type: 'text/calendar' }), 'alba-recordatorios.ics');
};
const fired = new Set();
export function startReminderLoop() {
  const tick = async () => {
    const n = new Date(), hm = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    for (const r of S.reminders) {
      const k = r.id + todayStr() + hm;
      if (r.time === hm && !fired.has(k)) {
        fired.add(k); toast(r.label);
        if (notifState() === 'granted') { try { (await navigator.serviceWorker?.ready)?.showNotification('Alba', { body: r.label, icon: 'icons/icon-192.png' }); } catch { /* el aviso interno ya se ha mostrado */ } }
      }
    }
  };
  setInterval(tick, 20000); tick();
}

/* Instalación y bienvenida */
const INSTALL = `<ol class="steps-list"><li>Abre la dirección de Alba en <b>Safari</b>.</li><li>Toca <b>Compartir</b>, el cuadrado con la flecha.</li><li>Elige <b>Añadir a pantalla de inicio</b> y confirma.</li><li>Abre Alba desde su icono. Empieza a registrar desde ahí: Safari y la aplicación instalada guardan los datos por separado.</li></ol>`;
A.installHelp = () => sheet('Instalar en el iPhone', () => INSTALL);
export function onboarding() {
  sheet('Bienvenida a Alba', () => `<p class="lead">Tu sistema personal de salud, entrenamiento y autocuidado. Empieza vacío: cada dato que veas será tuyo.</p>
  ${isIOS() && !isStandalone() ? `<div class="notice-b"><b>Primero, instálala</b>${INSTALL}</div>` : ''}
  <form data-s="onboardSave"><div class="grid2">${field('Pasos diarios', numInput('steps', S.goals.steps))}${field('Proteína (g)', numInput('protein', S.goals.protein))}${field('Agua (ml)', numInput('water', S.goals.water))}${field('Horas de sueño', numInput('sleep', S.goals.sleep))}</div>
  ${field('Primer día de tu última menstruación', `<input name="period" type="date" max="${todayStr()}">`, 'Opcional. Puedes añadirlo más tarde.')}
  <p class="muted small">Agua y sueño son valores de partida que he puesto yo, porque no los indicabas. Cambia lo que quieras aquí o en Ajustes.</p>
  <button class="btn wide">Empezar</button></form>`, { onClose: async () => { if (!S.onboarded) { S.onboarded = true; await saveSettings(); } } });
}
A.onboardSave = async f => {
  for (const k of ['steps', 'protein', 'water', 'sleep']) { const v = numOrNull(f[k].value); if (v > 0) S.goals[k] = v; }
  if (f.period.value) await put('periods', { id: uid(), start: f.period.value, end: null, intensity: null });
  S.onboarded = true; await saveSettings(); closeSheet(); await render();
};
