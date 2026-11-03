// Enrutado, hojas, avisos, delegación de eventos y piezas de interfaz compartidas.
import { put, get } from './db.js';
import { esc, todayStr, addDays, fmtLong, nf } from './util.js';
import { mergeSettings } from './domain.js';

export const A = {};       // acciones de clic: data-a
export const CH = {};      // cambio: data-c
export const IN = {};      // escritura: data-i
export const routes = {};  // nombre -> {title, render(params) -> html, back}
export const state = { date: todayStr(), route: 'hoy', params: {} };
export let S = mergeSettings(null);
export async function loadSettings() { S = mergeSettings(await get('kv', 'settings')); return S; }
export async function saveSettings() { await put('kv', S); applyTheme(); }
export function applyTheme() {
  if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', S.theme);
}
const $ = q => document.querySelector(q);
export const app = () => $('#view');

export function go(route, params = {}) {
  const q = new URLSearchParams(params).toString();
  const h = `#/${route}${q ? '?' + q : ''}`;
  if (location.hash === h) render(); else location.hash = h;
}
export function parseHash() {
  const [r, q] = location.hash.replace(/^#\/?/, '').split('?');
  return { route: routes[r] ? r : 'hoy', params: Object.fromEntries(new URLSearchParams(q || '')) };
}
let renderSeq = 0;
export async function render({ keepScroll = true } = {}) {
  const { route, params } = parseHash();
  const changed = route !== state.route || JSON.stringify(params) !== JSON.stringify(state.params);
  state.route = route; state.params = params;
  const def = routes[route], seq = ++renderSeq, y = window.scrollY;
  let html;
  try { html = await def.render(params); }
  catch (e) { console.error(e); html = `<div class="page"><h1>No se ha podido abrir este apartado</h1><p class="muted">${esc(e.message)}</p><button class="btn" data-a="reload">Recargar</button></div>`; }
  if (seq !== renderSeq) return;
  const head = def.back ? `<header class="subhead"><button class="back" data-a="back" aria-label="Volver">${ICON.back}</button><span>${esc(typeof def.title === 'function' ? def.title(params) : def.title)}</span></header>` : '';
  app().innerHTML = head + html;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', (t.dataset.tabs || '').split(',').includes(route)));
  window.scrollTo(0, keepScroll && !changed ? y : 0);
}
export const rerender = () => render();

/* ---------- Hojas (modales inferiores) ---------- */
const stack = [];
export function sheet(title, fn, { onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="sheet-bg" data-a="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grabber"></div><div class="sheet-head"><h2>${esc(title)}</h2><button class="close" data-a="closeSheet" aria-label="Cerrar">${ICON.close}</button></div><div class="sheet-body"></div></div>`;
  document.body.append(el);
  document.body.classList.add('locked');
  const entry = { el, fn, onClose };
  stack.push(entry);
  return refreshSheet(entry);
}
export async function refreshSheet(entry = stack[stack.length - 1]) {
  if (!entry) return;
  const b = entry.el.querySelector('.sheet-body'), y = b.scrollTop;
  b.innerHTML = await entry.fn();
  b.scrollTop = y;
}
export function closeSheet() {
  const e = stack.pop();
  if (!e) return;
  e.el.remove();
  if (!stack.length) document.body.classList.remove('locked');
  e.onClose?.();
}
export const closeAllSheets = () => { while (stack.length) closeSheet(); };
export function confirmDlg(msg, ok = 'Eliminar', danger = true) {
  return new Promise(res => {
    let val = false;
    const yes = 'cfYes' + Date.now();
    A[yes] = () => { val = true; closeSheet(); };
    sheet('Confirmar', () => `<p class="lead">${esc(msg)}</p><div class="row-btns"><button class="btn ghost" data-a="closeSheet">Cancelar</button><button class="btn ${danger ? 'danger' : ''}" data-a="${yes}">${esc(ok)}</button></div>`, { onClose: () => { delete A[yes]; res(val); } });
  });
}
let toastT;
export function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-a="toastUndo">Deshacer</button>' : ''}`;
  A.toastUndo = async () => { t.classList.remove('on'); await undo?.(); await refreshAll(); };
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), undo ? 5000 : 2600);
}
export async function refreshAll() { await render(); if (stack.length) await refreshSheet(); }

/* ---------- Componentes ---------- */
export const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M5 19l1-4L16 5l3 3L9 18z"/></svg>',
  today: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  train: '<svg viewBox="0 0 24 24"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/></svg>',
  food: '<svg viewBox="0 0 24 24"><path d="M7 3v8a2 2 0 002 0V3M7 11v10M17 3c-2 1.5-3 4-3 7 0 1.5 1 2.5 3 2.5V21"/></svg>',
  cycle: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 108.5 8.5"/><circle cx="20" cy="6" r="1.4"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="1.8"/><circle cx="18" cy="6" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/></svg>',
};
export const check = (on, action, attrs = '', label = '') => `<button class="chk ${on ? 'on' : ''}" role="checkbox" aria-checked="${!!on}" aria-label="${esc(label)}" data-a="${action}" ${attrs}>${ICON.check}</button>`;
export function dateNav() {
  const d = state.date, t = todayStr();
  return `<div class="datenav"><button data-a="dayShift" data-n="-1" aria-label="Día anterior">${ICON.back}</button>
  <label class="datenav-mid"><span>${d === t ? 'Hoy' : esc(fmtLong(d))}</span><input type="date" value="${d}" max="${t}" data-c="setDate" aria-label="Elegir fecha"></label>
  <button data-a="dayShift" data-n="1" ${d >= t ? 'disabled' : ''} aria-label="Día siguiente">${ICON.next}</button></div>`;
}
A.dayShift = async el => { const n = addDays(state.date, +el.dataset.n); if (n <= todayStr()) { state.date = n; await render(); } };
CH.setDate = async el => { if (el.value && el.value <= todayStr()) { state.date = el.value; await render(); } };
A.closeSheet = () => closeSheet();
A.back = () => { if (history.length > 1) history.back(); else go('hoy'); };
A.reload = () => location.reload();
A.go = el => { closeAllSheets(); go(el.dataset.to, el.dataset.q ? Object.fromEntries(new URLSearchParams(el.dataset.q)) : {}); };

export const stat = (label, value, sub = '') => `<div class="stat"><b>${value}</b><span>${esc(label)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
export const empty = (msg, btn = '') => `<div class="empty"><p>${esc(msg)}</p>${btn}</div>`;
export const field = (label, inner, hint = '') => `<label class="field"><span>${esc(label)}</span>${inner}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
export const numInput = (name, val, attrs = '') => `<input name="${name}" type="text" inputmode="decimal" autocomplete="off" value="${val ?? ''}" ${attrs}>`;
export const form = el => Object.fromEntries(new FormData(el.closest('form')));
export const chips = (opts, sel, action, extra = '') => `<div class="chips ${/[sS]pan$/.test(action) ? 'seg' : ''}">${opts.map(([v, l]) => `<button type="button" class="chip ${String(sel) === String(v) ? 'on' : ''}" data-a="${action}" data-v="${esc(v)}" ${extra}>${esc(l)}</button>`).join('')}</div>`;
export const scale = (name, val, from, to, action, extra = '') => {
  let s = `<div class="scale ${to - from >= 9 ? 'ten' : ''}" role="radiogroup" aria-label="${esc(name)}">`;
  for (let i = from; i <= to; i++) s += `<button type="button" role="radio" aria-checked="${val === i}" class="${val === i ? 'on' : ''}" data-a="${action}" data-v="${i}" ${extra}>${i}</button>`;
  return s + '</div>';
};
export const dayBar = (n, label) => nf(n);

/* ---------- Delegación ---------- */
export function installEvents() {
  document.addEventListener('click', async ev => {
    const el = ev.target.closest('[data-a]');
    if (el && !el.disabled) {
      const fn = A[el.dataset.a];
      if (!fn) { console.error('Acción no definida:', el.dataset.a); return; }
      if (el.tagName !== 'INPUT' && el.tagName !== 'SUMMARY') ev.preventDefault();
      try { await fn(el, ev); } catch (e) { console.error(e); toast(e.message || 'No se ha podido guardar. Inténtalo otra vez.'); }
    }
    showTip(ev);
  });
  document.addEventListener('change', ev => { const f = CH[ev.target.dataset?.c]; if (f) Promise.resolve(f(ev.target, ev)).catch(e => { console.error(e); toast(e.message); }); });
  document.addEventListener('input', ev => { const f = IN[ev.target.dataset?.i]; if (f) Promise.resolve(f(ev.target, ev)).catch(console.error); });
  document.addEventListener('submit', ev => {
    ev.preventDefault();
    const f = A[ev.target.dataset.s];
    if (f) Promise.resolve(f(ev.target, ev)).catch(e => { console.error(e); toast(e.message); });
  });
  document.addEventListener('pointermove', ev => { if (ev.target.closest?.('.chart svg')) { const t = document.elementFromPoint(ev.clientX, ev.clientY); if (t) showTip({ target: t, clientX: ev.clientX, clientY: ev.clientY }, true); } });
  installNative();
  window.addEventListener('scroll', () => hideTip(), { passive: true });
}
/* Comportamiento de app nativa en iOS */
function installNative() {
  // Toca la pestaña activa para volver arriba.
  document.querySelector('.tabbar').addEventListener('click', ev => { const t = ev.target.closest('.tab'); if (t && t.classList.contains('on') && t.dataset.to === state.route) window.scrollTo({ top: 0, behavior: 'smooth' }); }, true);
  // Deslizar desde el borde izquierdo: volver. Deslizar la cabecera de una hoja hacia abajo: cerrarla.
  let sx = 0, sy = 0, edge = false, head = null;
  document.addEventListener('touchstart', e => {
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY;
    edge = sx < 24 && !stack.length && !!routes[state.route]?.back;
    head = e.target.closest('.sheet-head,.grabber') ? e.target.closest('.sheet') : null;
  }, { passive: true });
  document.addEventListener('touchmove', e => { if (head) { const d = Math.max(0, e.touches[0].clientY - sy); head.style.transform = `translateY(${d}px)`; head.style.animation = 'none'; } }, { passive: true });
  document.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    if (edge && t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 60) A.back();
    if (head) { if (t.clientY - sy > 90) closeSheet(); else head.style.transform = ''; head = null; }
    edge = false;
  }, { passive: true });
  // Teclado: la barra inferior se oculta y las hojas quedan encima del teclado.
  const isField = el => el?.matches?.('input:not([type=checkbox]):not([type=file]):not([type=date]):not([type=time]),textarea');
  document.addEventListener('focusin', e => { if (isField(e.target)) document.body.classList.add('kb'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!isField(document.activeElement)) document.body.classList.remove('kb'); }, 60));
  const vv = window.visualViewport;
  if (vv) { const fit = () => document.documentElement.style.setProperty('--vvh', `${vv.height}px`); vv.addEventListener('resize', fit); fit(); }
  // Antes de pasar a segundo plano se confirma el campo en curso para no perderlo.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') document.activeElement?.blur?.(); });
}
function hideTip() { $('#tip')?.classList.remove('on'); }
function showTip(ev, hover) {
  const el = ev.target.closest?.('[data-tip]'), t = $('#tip');
  if (!el) { if (t.classList.contains('on')) hideTip(); return; }
  t.textContent = el.dataset.tip;
  t.classList.add('on');
  const r = t.getBoundingClientRect();
  const x = Math.min(innerWidth - r.width - 8, Math.max(8, ev.clientX - r.width / 2));
  const y = ev.clientY - r.height - 14;
  t.style.transform = `translate(${x}px,${y < 8 ? ev.clientY + 16 : y}px)`;
}
