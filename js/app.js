import { openDB, updDay } from './db.js';
import { loadSettings, applyTheme, installEvents, render, S, toast, state } from './ui.js';
import { todayStr } from './util.js';
import { parseSteps } from './domain.js';
import './views/today.js';
import './views/steps.js';
import './views/train.js';
import './views/food.js';
import './views/care.js';
import './views/life.js';
import './views/cycle.js';
import './views/overview.js';
import { onboarding, startReminderLoop, isIOS, isStandalone, autoSnapshot } from './views/settings.js';

async function main() {
  await openDB();
  await loadSettings();
  applyTheme();
  installEvents();
  try { await navigator.storage?.persist?.(); } catch { /* no disponible */ }
  window.addEventListener('hashchange', () => render({ keepScroll: false }));
  // Importar pasos desde un enlace: ...?pasos=12345
  const q = new URLSearchParams(location.search);
  if (q.has('pasos')) {
    const rows = parseSteps(q.get('pasos'), q.get('fecha') || todayStr());
    for (const r of rows) await updDay(r.date, d => { d.steps = r.steps; });
    history.replaceState(null, '', location.pathname + location.hash);
    if (rows.length) toast(`${rows[0].steps} pasos guardados`);
  }
  await render();
  document.querySelector('#splash')?.classList.add('out');
  setTimeout(() => document.querySelector('#splash')?.remove(), 500);
  if (!S.onboarded) onboarding();
  else if (isIOS() && !isStandalone()) document.querySelector('#safari-warn')?.classList.add('on');
  startReminderLoop();
  setTimeout(() => autoSnapshot().catch(e => console.warn(e)), 1500);
  // Si la app vuelve de segundo plano en otro día, pasa a hoy.
  let last = todayStr();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && todayStr() !== last) { if (state.date === last) state.date = todayStr(); last = todayStr(); render(); }
  });
  registerSW();
}
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nueva versión lista: se aplicará al volver a abrir Alba.');
      });
    });
  }).catch(e => console.warn('Service Worker no disponible', e));
}
main().catch(e => {
  console.error(e);
  document.querySelector('#view').innerHTML = `<div class="page"><h1>No se ha podido abrir tu base de datos</h1><p>${String(e.message).replace(/</g, '&lt;')}</p><p class="muted">Cierra otras ventanas de Alba y vuelve a abrirla. En modo privado de Safari no se puede guardar.</p></div>`;
  document.querySelector('#splash')?.remove();
});
