// Capa de datos sobre IndexedDB. Todo queda en el dispositivo.
import { toStr } from './util.js';
const NAME = 'alba', VERSION = 2;
export const STORES = {
  kv: { keyPath: 'key' },
  days: { keyPath: 'date' },
  workouts: { keyPath: 'id', idx: ['date'] },
  templates: { keyPath: 'id' },
  exercises: { keyPath: 'id' },
  foods: { keyPath: 'id' },
  recipes: { keyPath: 'id' },
  foodlog: { keyPath: 'id', idx: ['date'] },
  body: { keyPath: 'id', idx: ['date'] },
  periods: { keyPath: 'id', idx: ['start'] },
  books: { keyPath: 'id' },
  photos: { keyPath: 'id', idx: ['date'] },
  snapshots: { keyPath: 'id' }, // puntos de restauración internos; no van en las copias
};
const DATA_STORES = () => Object.keys(STORES).filter(s => s !== 'snapshots');
let dbp;
export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const [n, o] of Object.entries(STORES)) {
        if (d.objectStoreNames.contains(n)) continue;
        const s = d.createObjectStore(n, { keyPath: o.keyPath });
        (o.idx || []).forEach(i => s.createIndex(i, i));
      }
    };
    r.onsuccess = () => { const d = r.result; d.onclose = () => { dbp = null; }; d.onversionchange = () => { d.close(); dbp = null; }; res(d); };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('La base de datos está abierta en otra ventana.'));
  });
  return dbp;
}
const wrap = q => new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
// iOS puede cerrar la conexión con la base de datos cuando la app pasa a segundo plano: se reabre y se reintenta una vez.
const lost = e => e && (e.name === 'InvalidStateError' || e.name === 'UnknownError' || /connection|closing/i.test(e.message || ''));
async function retry(fn) { try { return await fn(); } catch (e) { if (!lost(e)) throw e; dbp = null; return fn(); } }
const tx = (store, mode, fn) => retry(() => tx0(store, mode, fn));
async function tx0(store, mode, fn) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    let out;
    Promise.resolve(fn(t.objectStore(store), v => { out = v; }));
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transacción cancelada'));
  });
}
export const get = (s, k) => tx(s, 'readonly', (o, set) => { o.get(k).onsuccess = e => set(e.target.result); });
export const put = (s, v) => tx(s, 'readwrite', o => { o.put(v); }).then(() => v);
export const del = (s, k) => tx(s, 'readwrite', o => { o.delete(k); });
export const all = s => retry(() => openDB().then(d => wrap(d.transaction(s).objectStore(s).getAll())));
export const clearStore = s => tx(s, 'readwrite', o => { o.clear(); });
/** Rango [a,b] por índice, o por clave primaria si no se indica índice. */
export const range = (s, a, b, index) => retry(() => openDB().then(d => {
  const o = d.transaction(s).objectStore(s);
  return wrap((index ? o.index(index) : o).getAll(IDBKeyRange.bound(a, b)));
}));
export const getDay = async date => (await get('days', date)) || { date };
/** Actualización atómica de un día: lee, modifica y escribe en la misma transacción. */
export const updDay = (date, fn) => tx('days', 'readwrite', (o, set) => {
  const q = o.get(date);
  q.onsuccess = () => { const d = q.result || { date }; fn(d); d.updated = Date.now(); o.put(d); set(d); };
});
export const daysRange = (a, b) => range('days', a, b);
export const workoutsRange = (a, b) => range('workouts', a, b, 'date');
export const foodlogRange = (a, b) => range('foodlog', a, b, 'date');

/* ---------- Copia de seguridad ---------- */
const blobToData = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const dataToBlob = u => { const [h, b] = u.split(','); const bin = atob(b); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: h.match(/:(.*?);/)[1] }); };

export async function exportAll({ photos = true } = {}) {
  const out = { app: 'alba', format: 1, exported: new Date().toISOString(), photosIncluded: photos, stores: {} };
  for (const s of DATA_STORES()) {
    if (s === 'photos' && !photos) continue;
    const rows = await all(s);
    if (s === 'photos') for (const r of rows) { if (r.blob) { r.data = await blobToData(r.blob); delete r.blob; } }
    out.stores[s] = rows;
  }
  return out;
}
export function validateBackup(o) {
  if (!o || o.app !== 'alba' || !o.stores || typeof o.stores !== 'object') throw new Error('El archivo no es una copia de seguridad de Alba.');
  if (o.format > 1) throw new Error('La copia es de una versión más reciente de la aplicación.');
  for (const [s, rows] of Object.entries(o.stores)) {
    if (!STORES[s] || s === 'snapshots') throw new Error(`La copia contiene una sección desconocida: ${s}.`);
    if (!Array.isArray(rows)) throw new Error(`La sección ${s} está dañada.`);
    const key = STORES[s].keyPath;
    if (rows.some(r => r == null || r[key] == null)) throw new Error(`Hay registros sin identificador en ${s}.`);
  }
  return o;
}
/** mode: 'merge' conserva lo que no esté en la copia; 'replace' borra antes. */
export async function importAll(o, mode = 'merge') {
  validateBackup(o);
  const d = await openDB();
  const names = DATA_STORES();
  const prepared = {};
  for (const s of names) {
    prepared[s] = (o.stores[s] || []).map(r => {
      if (s === 'photos' && r.data) { const c = { ...r, blob: dataToBlob(r.data) }; delete c.data; return c; }
      return r;
    });
  }
  await new Promise((res, rej) => {
    const t = d.transaction(names, 'readwrite');
    for (const s of names) {
      const os = t.objectStore(s);
      if (mode === 'replace' && !(s === 'photos' && o.photosIncluded === false)) os.clear();
      prepared[s].forEach(r => os.put(r));
    }
    t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
  let n = 0; for (const s of names) n += prepared[s].length;
  return n;
}
export async function wipeAll() { for (const s of Object.keys(STORES)) await clearStore(s); }
export const backupName = () => `alba-copia-${toStr(new Date())}.json`;
