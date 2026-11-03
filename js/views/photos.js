// Fotos: se reducen y se guardan como Blob en IndexedDB, solo en este dispositivo.
import { A, sheet, closeSheet, confirmDlg, toast, render } from '../ui.js';
import { put, get, del } from '../db.js';
import { uid, fmtFull, esc } from '../util.js';

const urls = new Map();
export async function addPhoto(file, kind, date) {
  if (!file) return;
  const bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se ha podido leer esa imagen. Prueba con otra foto.')); i.src = URL.createObjectURL(file); });
  const max = 1400, k = Math.min(1, max / Math.max(bmp.naturalWidth, bmp.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.naturalWidth * k); c.height = Math.round(bmp.naturalHeight * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  URL.revokeObjectURL(bmp.src);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', .82));
  await put('photos', { id: uid(), kind, date, blob, note: '' });
  toast('Foto guardada');
}
export const photoSrc = p => { if (!p.blob) return ''; if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.blob)); return urls.get(p.id); };
export const photoGrid = list => list.length ? `<div class="photos">${list.map(p => `<button data-a="photoOpen" data-id="${p.id}" aria-label="Abrir foto del ${fmtFull(p.date)}"><img loading="lazy" src="${photoSrc(p)}" alt=""><span>${fmtFull(p.date)}</span></button>`).join('')}</div>` : '';
A.photoOpen = async el => {
  const p = await get('photos', el.dataset.id);
  sheet(fmtFull(p.date), () => `<img class="photo-full" src="${photoSrc(p)}" alt="Foto del ${fmtFull(p.date)}"><label class="field"><span>Nota</span><input value="${esc(p.note || '')}" data-c="photoNote" data-id="${p.id}"></label><button class="btn ghost danger-t wide" data-a="photoDel" data-id="${p.id}">Eliminar foto</button>`);
};
import('../ui.js').then(({ CH }) => { CH.photoNote = async el => { const p = await get('photos', el.dataset.id); p.note = el.value; await put('photos', p); }; });
A.photoDel = async el => { if (!await confirmDlg('¿Eliminar esta foto?')) return; await del('photos', el.dataset.id); closeSheet(); toast('Foto eliminada'); await render(); };
