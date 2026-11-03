// Gráficos SVG propios, sin librerías. Cada marca tiene una zona táctil con detalle (data-tip).
import { esc, nf, clamp } from './util.js';
export const C = { a: 'var(--s1)', b: 'var(--s2)', c: 'var(--s3)', d: 'var(--s4)' };
const W = 340;
function niceMax(v) {
  if (v <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(v)), n = v / e;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * e;
}
function axisY(min, max, H, top, bot, left, fmt) {
  const ticks = [0, .5, 1].map(f => min + (max - min) * f);
  return ticks.map(t => {
    const y = H - bot - (t - min) / (max - min || 1) * (H - top - bot);
    return `<line x1="${left}" x2="${W}" y1="${y}" y2="${y}" class="grid"/><text x="${left - 5}" y="${y + 3.5}" text-anchor="end" class="tick">${esc(fmt(t))}</text>`;
  }).join('');
}
function axisX(labels, H, bot, xAt) {
  const n = labels.length, step = Math.max(1, Math.ceil(n / 5));
  let out = '';
  for (let i = 0; i < n; i += step) {
    const anchor = i === 0 && n > 1 ? 'start' : 'middle';
    out += `<text x="${xAt(i)}" y="${H - bot + 15}" text-anchor="${anchor}" class="tick">${esc(labels[i])}</text>`;
  }
  return out;
}
const legend = series => series.length < 2 ? '' : `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
function dataTable(labels, series, fmt) {
  const rows = labels.map((l, i) => series.some(s => s.values[i] != null) ? `<tr><td>${esc(l)}</td>${series.map(s => `<td>${s.values[i] == null ? '—' : esc(fmt(s.values[i]))}</td>`).join('')}</tr>` : '').join('');
  return `<details class="chart-data"><summary>Ver datos</summary><table><thead><tr><th></th>${series.map(s => `<th>${esc(s.name || 'Valor')}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></details>`;
}
const noData = msg => `<p class="chart-empty">${esc(msg || 'Aún no hay registros en este periodo.')}</p>`;
const figure = (title, svg, foot = '') => `<figure class="chart">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}${svg}${foot}</figure>`;

/** series: [{name,color,values:[n|null]}], labels: [..] */
export function lineChart({ title, series, labels, unit = '', goal, h = 170, d = 0, min: fixedMin, max: fixedMax, empty }) {
  const vals = series.flatMap(s => s.values).filter(v => v != null);
  if (!vals.length) return figure(title, noData(empty));
  const fmt = v => `${nf(v, d)}${unit ? ' ' + unit : ''}`;
  let lo = fixedMin ?? Math.min(...vals), hi = fixedMax ?? Math.max(...vals, goal ?? -Infinity);
  if (fixedMin == null) { const pad = (hi - lo) * .15 || Math.abs(hi) * .1 || 1; lo = Math.max(0, lo - pad); if (goal != null) lo = Math.min(lo, goal); }
  if (fixedMax == null) hi = lo === hi ? hi + 1 : hi + (hi - lo) * .06;
  const top = 8, bot = 24, left = 42, H = h, n = labels.length;
  const x = i => n === 1 ? (left + W) / 2 : left + 3 + i * (W - left - 8) / (n - 1);
  const y = v => H - bot - (v - lo) / (hi - lo || 1) * (H - top - bot);
  let marks = '';
  for (const s of series) {
    let seg = '', pen = false;
    s.values.forEach((v, i) => { if (v == null) { pen = false; return; } seg += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; });
    marks += `<path d="${seg}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v, i) => {
      if (v == null) return;
      const iso = s.values[i - 1] == null && s.values[i + 1] == null;
      if (iso || n <= 14) marks += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${iso ? 3.5 : 2.5}" fill="${s.color}" stroke="var(--surface)" stroke-width="1.5"/>`;
    });
  }
  const colW = (W - left) / Math.max(n, 1);
  const hits = labels.map((l, i) => {
    const tip = [l, ...series.filter(s => s.values[i] != null).map(s => `${series.length > 1 ? s.name + ': ' : ''}${fmt(s.values[i])}`)].join('\n');
    return series.some(s => s.values[i] != null) ? `<rect class="hit" x="${(x(i) - colW / 2).toFixed(1)}" y="0" width="${colW.toFixed(1)}" height="${H}" data-tip="${esc(tip)}"/>` : '';
  }).join('');
  const gl = goal != null && goal >= lo && goal <= hi ? `<line x1="${left}" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" class="goal"/><text x="${W}" y="${y(goal) - 4}" text-anchor="end" class="tick">Objetivo ${esc(fmt(goal))}</text>` : '';
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || 'Gráfico')}">${axisY(lo, hi, H, top, bot, left, v => nf(v, hi - lo < 5 ? 1 : 0))}${gl}${axisX(labels, H, bot, x)}${marks}${hits}</svg>`;
  return figure(title, svg, legend(series) + dataTable(labels, series, fmt));
}
export function barChart({ title, values, labels, color = C.a, unit = '', goal, h = 170, d = 0, empty, name }) {
  if (!values.some(v => v != null && v !== 0)) return figure(title, noData(empty));
  const fmt = v => `${nf(v, d)}${unit ? ' ' + unit : ''}`;
  const top = 8, bot = 24, left = 42, H = h, n = values.length;
  const hi = niceMax(Math.max(...values.map(v => v || 0), goal || 0));
  const plot = W - left, band = plot / n, bw = clamp(band - 2, 1.5, 22);
  const y = v => H - bot - v / hi * (H - top - bot);
  const x = i => left + band * i + band / 2;
  const rr = Math.min(4, bw / 2);
  const bars = values.map((v, i) => {
    if (!v) return '';
    const yy = y(v), base = H - bot, bx = x(i) - bw / 2, r = Math.min(rr, base - yy);
    return `<path fill="${color}" d="M${bx} ${base}V${yy + r}Q${bx} ${yy} ${bx + r} ${yy}H${bx + bw - r}Q${bx + bw} ${yy} ${bx + bw} ${yy + r}V${base}Z"/>`;
  }).join('');
  const hits = values.map((v, i) => v == null ? '' : `<rect class="hit" x="${(left + band * i).toFixed(1)}" y="0" width="${band.toFixed(1)}" height="${H}" data-tip="${esc(labels[i] + '\n' + fmt(v))}"/>`).join('');
  const gl = goal ? `<line x1="${left}" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" class="goal"/>` : '';
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || 'Gráfico')}">${axisY(0, hi, H, top, bot, left, v => nf(v, hi < 5 ? 1 : 0))}${axisX(labels, H, bot, x)}${bars}${gl}${hits}</svg>`;
  return figure(title, svg, dataTable(labels, [{ name: name || title, values }], fmt));
}
export function donut({ title, parts, center, sub, size = 150 }) {
  const total = parts.reduce((a, p) => a + (p.value || 0), 0);
  if (!total) return figure(title, noData('Añade alimentos para ver el reparto.'));
  const r = 42, c = 2 * Math.PI * r, gap = 1.6;
  let off = 0;
  const arcs = parts.filter(p => p.value > 0).map(p => {
    const len = p.value / total * c;
    const s = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${p.color}" stroke-width="11" stroke-dasharray="${Math.max(len - gap, .5)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 50 50)" data-tip="${esc(p.name + '\n' + p.note)}"/>`;
    off += len; return s;
  }).join('');
  const svg = `<div class="donut-wrap"><svg viewBox="0 0 100 100" style="width:${size}px" role="img" aria-label="${esc(title || 'Reparto')}">${arcs}<text x="50" y="50" text-anchor="middle" class="donut-n">${esc(center || '')}</text><text x="50" y="60" text-anchor="middle" class="donut-s">${esc(sub || '')}</text></svg>
  <ul class="donut-key">${parts.map(p => `<li><i style="background:${p.color}"></i><span>${esc(p.name)}</span><b>${esc(p.note)}</b></li>`).join('')}</ul></div>`;
  return figure(title, svg);
}
/** Barras horizontales etiquetadas (frecuencia por grupo, síntomas...). */
export function hbars({ title, rows, fmt = v => nf(v), color = C.a, empty }) {
  if (!rows.length) return figure(title, noData(empty));
  const hi = Math.max(...rows.map(r => r.value), 1);
  return figure(title, `<ul class="hbars">${rows.map(r => `<li data-tip="${esc(r.label + '\n' + fmt(r.value))}"><span>${esc(r.label)}</span><div><i style="width:${Math.max(r.value / hi * 100, 1.5)}%;background:${color}"></i></div><b>${esc(fmt(r.value))}</b></li>`).join('')}</ul>`);
}
/** Tabla de calor: una tinta, de claro a oscuro. Se lee también por el número. */
export function heatTable({ title, cols, rows, max = 5, d = 1 }) {
  if (!rows.length) return figure(title, noData());
  return figure(title, `<div class="scroll-x"><table class="heat"><thead><tr><th></th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><th>${esc(r.label)}</th>${r.values.map(v => {
    const f = v == null ? 0 : clamp(v / max, 0, 1);
    return `<td style="--h:${Math.round(f * 100)}%" class="${f > .7 ? 'dark' : ''}">${v == null ? '—' : nf(v, d)}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>`);
}
/** Anillo de progreso. */
export function ring(p, { size = 180, stroke = 8, inner = '', color = 'var(--olive)' } = {}) {
  const r = 50 - stroke / 2, c = 2 * Math.PI * r, pc = clamp(p, 0, 1);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${pc * c} ${c}" transform="rotate(-90 50 50)"/></svg><div class="ring-in">${inner}</div></div>`;
}
/** La corola: un pétalo por indicador del día; se llena según su progreso. */
export function corolla(items, { size = 220, inner = '', tiny = false } = {}) {
  const n = Math.max(items.length, 1), R0 = tiny ? 16 : 22, R1 = 48;
  const petal = (i, f, cls, key) => {
    const a = i / n * 360, half = Math.min(180 / n * .86, 26), L = R0 + (R1 - R0) * f;
    const w = Math.tan(half * Math.PI / 180) * (L + R0) / 2 * .78;
    const m = (R0 + L) / 2;
    return `<path class="${cls}" ${key ? `data-petal="${key}"` : ''} transform="rotate(${a.toFixed(2)} 50 50)" d="M50 ${50 - R0}C${50 - w} ${50 - m} ${50 - w * .7} ${50 - L + 1} 50 ${50 - L}C${50 + w * .7} ${50 - L + 1} ${50 + w} ${50 - m} 50 ${50 - R0}Z"/>`;
  };
  const bg = items.map((_, i) => petal(i, 1, 'petal-bg')).join('');
  const fg = items.map((it, i) => it.pct > 0 ? petal(i, Math.max(it.pct, .28), it.pct >= 1 ? 'petal-done' : 'petal-part', it.key) : '').join('');
  return `<div class="corolla" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true">${bg}${fg}</svg><div class="corolla-in">${inner}</div></div>`;
}
export const progress = (p, cls = '') => `<div class="bar ${cls}" role="progressbar" aria-valuenow="${Math.round(clamp(p, 0, 1) * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${clamp(p, 0, 1) * 100}%"></i></div>`;
