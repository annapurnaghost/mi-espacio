import { A, CH, IN, routes, state, S, render, toast, sheet, closeSheet, refreshSheet, confirmDlg, stat, field, numInput, ICON, chips, empty, dateNav } from '../ui.js';
import { all, get, put, del, foodlogRange, updDay, getDay, range } from '../db.js';
import { esc, nf, uid, norm, todayStr, addDays, fmtShort, numOrNull, nowTime, dateRange, startOfWeek, mean, sum, fmtFull } from '../util.js';
import { scale as scaleN, totals, macroSplit, recipeNutrition, NUTRIENTS, NUT_LABEL, waterTotal } from '../domain.js';
import { FOODS } from '../data/foods.js';
import { donut, barChart, lineChart, ring, progress, C } from '../charts.js';

export const MEALS = [['desayuno', 'Desayuno'], ['mediamanana', 'Media mañana'], ['almuerzo', 'Almuerzo'], ['merienda', 'Merienda'], ['cena', 'Cena'], ['otros', 'Otros alimentos']];
const defaultMeal = () => { const h = new Date().getHours(); return h < 11 ? 'desayuno' : h < 13 ? 'mediamanana' : h < 16 ? 'almuerzo' : h < 19 ? 'merienda' : h < 23 ? 'cena' : 'otros'; };
const ap = t => t.approx ? '≈ ' : '';
const fmtN = (t, n, unit = 'g') => t.missing?.[n] ? `${ap(t)}${nf(t[n], n === 'kcal' ? 0 : 1)} ${unit}, incompleto` : `${ap(t)}${nf(t[n], n === 'kcal' ? 0 : 1)} ${unit}`;
let span = 7;

routes.comida = {
  title: 'Alimentación',
  async render() {
    const date = state.date, t = todayStr(), logs = await foodlogRange(date, date), T = totals(logs), g = S.goals, day = await getDay(date);
    const sp = macroSplit(T), ml = waterTotal(day);
    const from = addDays(t, -(span - 1)), hist = await foodlogRange(from, t), ds = dateRange(from, t);
    const by = new Map(); hist.forEach(e => { (by.get(e.date) || by.set(e.date, []).get(e.date)).push(e); });
    const dt = ds.map(x => by.has(x) ? totals(by.get(x)) : null), logged = dt.filter(Boolean);
    return `<div class="page"><h1>Alimentación</h1>${dateNav()}
    <section class="nutri">
      ${donut({ parts: [{ name: 'Proteínas', value: T.p * 4, color: C.a, note: `${ap(T)}${nf(T.p)} g${sp ? `, ${Math.round(sp.p * 100)} %` : ''}` }, { name: 'Carbohidratos', value: T.c * 4, color: C.b, note: `${ap(T)}${nf(T.c)} g${sp ? `, ${Math.round(sp.c * 100)} %` : ''}` }, { name: 'Grasas', value: T.f * 9, color: C.c, note: `${ap(T)}${nf(T.f)} g${sp ? `, ${Math.round(sp.f * 100)} %` : ''}` }], center: `${ap(T)}${nf(T.kcal)}`, sub: 'kcal' })}
      <div class="goalbars">
        <div><span>Proteína</span><b>${ap(T)}${nf(T.p)} de ${nf(g.protein)} g</b>${progress(T.p / g.protein)}</div>
        <div><span>Fibra</span><b>${ap(T)}${nf(T.fiber)} de ${nf(g.fiber)} g${T.missing.fiber ? ', incompleto' : ''}</b>${progress(T.fiber / g.fiber)}</div>
        ${g.kcal ? `<div><span>Calorías</span><b>${ap(T)}${nf(T.kcal)} de ${nf(g.kcal)}</b>${progress(T.kcal / g.kcal)}</div>` : ''}
        <div><span>Azúcares</span><b>${ap(T)}${nf(T.sugar)} g${T.missing.sugar ? ', incompleto' : ''}</b></div>
        <button class="waterline" data-a="go" data-to="agua"><span>Agua</span><b>${nf(ml / 1000, 2)} de ${nf(g.water / 1000, 2)} L</b>${progress(ml / g.water)}</button>
      </div>
    </section>
    ${T.count ? `<p class="muted small">${T.approx ? 'Los valores con ≈ son aproximados: proceden de referencias genéricas o de bases colaborativas.' : 'Todos los alimentos de hoy tienen valores de etiqueta.'}${Object.keys(T.missing).length ? ' «Incompleto» significa que algún alimento no tiene ese dato y no se ha estimado.' : ''}</p>` : ''}
    ${MEALS.map(([k, l]) => mealBlock(k, l, logs.filter(e => e.meal === k))).join('')}
    <div class="row-btns"><button class="btn ghost" data-a="go" data-to="recetas">Recetas y platos</button><button class="btn ghost" data-a="copyDay">Copiar de ayer</button></div>
    <h2>Resumen</h2>
    ${chips([[7, '7 días'], [30, '30 días'], [90, '3 meses']], span, 'foodSpan')}
    <section class="stats">
      ${stat('Calorías al día', `≈ ${nf(mean(logged.map(x => x.kcal)))}`, `${logged.length} días con registro`)}
      ${stat('Proteína al día', `≈ ${nf(mean(logged.map(x => x.p)))} g`, `${logged.filter(x => x.p >= g.protein).length} días con objetivo`)}
      ${stat('Fibra al día', `≈ ${nf(mean(logged.map(x => x.fiber)))} g`, '')}
    </section>
    ${barChart({ title: 'Calorías por día (aproximadas)', values: dt.map(x => x ? x.kcal : null), labels: ds.map(fmtShort), goal: g.kcal, unit: 'kcal', name: 'Calorías', empty: 'Añade alimentos para ver tu resumen.' })}
    ${lineChart({ title: 'Macronutrientes por día (aproximados)', series: [{ name: 'Proteínas', color: C.a, values: dt.map(x => x ? x.p : null) }, { name: 'Carbohidratos', color: C.b, values: dt.map(x => x ? x.c : null) }, { name: 'Grasas', color: C.c, values: dt.map(x => x ? x.f : null) }], labels: ds.map(fmtShort), unit: 'g', empty: 'Añade alimentos para ver la evolución.' })}
    </div>`;
  },
};
function mealBlock(k, label, rows) {
  const t = totals(rows);
  return `<section class="meal"><header><h3>${label}</h3><span>${rows.length ? `${ap(t)}${nf(t.kcal)} kcal, ${nf(t.p)} g prot.` : ''}</span><button class="btn ghost sm" data-a="foodPick" data-m="${k}">Añadir</button></header>
  ${rows.length ? `<ul class="list">${rows.map(e => `<li><button class="grow textbtn" data-a="logEdit" data-id="${e.id}"><b>${esc(e.name)}</b><small>${nf(e.qty, 1)} ${e.unit}, ${e.approx !== false ? '≈ ' : ''}${nf(e.kcal)} kcal, P ${nf(e.p)} C ${nf(e.c)} G ${nf(e.f)}</small></button><button class="icon" data-a="logDel" data-id="${e.id}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : ''}</section>`;
}
A.foodSpan = async el => { span = +el.dataset.v; await render(); };
A.logDel = async el => { const r = await get('foodlog', el.dataset.id); await del('foodlog', r.id); toast('Alimento eliminado', () => put('foodlog', r)); await render(); };
A.copyDay = async () => {
  const y = addDays(state.date, -1), rows = await foodlogRange(y, y);
  if (!rows.length) return toast('El día anterior no tiene alimentos.');
  if (!await confirmDlg(`¿Copiar ${rows.length} alimentos del día anterior a este día?`, 'Copiar', false)) return;
  for (const r of rows) await put('foodlog', { ...r, id: uid(), date: state.date });
  toast('Alimentos copiados'); await render();
};

/* ---------- Búsqueda ---------- */
let pick = { meal: 'desayuno', q: '', online: null, mode: 'log' };
export async function allFoods() {
  const [custom, rec] = await Promise.all([all('foods'), all('recipes')]);
  const hidden = new Set(custom.filter(c => c.hidden).map(c => c.id));
  const recs = rec.map(r => { const n = recipeNutrition(r); return { id: r.id, name: r.name, cat: 'Mis recetas', unit: 'g', ...n.per100, approx: n.approx, recipe: true, portion: { name: '1 ración', qty: Math.round(n.portionWeight) }, source: 'Calculada con tus ingredientes' }; });
  return [...recs, ...custom.filter(c => !c.hidden).map(c => ({ ...c, mine: true })), ...FOODS.filter(f => !hidden.has(f.id))];
}
const foodList = (list, onlineLabel) => {
  const q = norm(pick.q);
  let m = list;
  if (q) m = list.filter(f => q.split(/\s+/).every(w => norm(f.name).includes(w)));
  m = m.sort((a, b) => (b.mine || b.recipe ? 1 : 0) - (a.mine || a.recipe ? 1 : 0) || (q ? norm(a.name).indexOf(q) - norm(b.name).indexOf(q) : 0));
  return `<ul class="list ex-list">${m.slice(0, 60).map(f => `<li><button class="grow textbtn" data-a="foodChoose" data-id="${f.id}"><b>${esc(f.name)}</b><small>${f.approx !== false ? '≈ ' : ''}${nf(f.kcal)} kcal/100 ${f.unit}, ${esc(f.cat || '')}</small></button></li>`).join('')}</ul>${m.length ? '' : '<p class="muted">Nada en tu base de datos con ese nombre.</p>'}`;
};
const recentHtml = async () => {
  if (pick.q) return '';
  const rows = (await foodlogRange(addDays(todayStr(), -30), todayStr())).reverse(), seen = new Set(), out = [];
  for (const r of rows) { if (r.foodId && !seen.has(r.foodId)) { seen.add(r.foodId); out.push(r); } if (out.length === 6) break; }
  return out.length ? `<h3>Recientes</h3><div class="chips">${out.map(r => `<button class="chip" data-a="foodChoose" data-id="${r.foodId}">${esc(r.name)}</button>`).join('')}</div>` : '';
};
A.foodPick = async el => {
  pick = { meal: el.dataset.m || defaultMeal(), q: '', online: null, mode: 'log' };
  sheet('Añadir alimento', pickHtml);
};
const pickHtml = async () => `<input class="search" type="search" placeholder="Buscar alimento" value="${esc(pick.q)}" data-i="foodQ" aria-label="Buscar alimento">
  <div class="row-btns"><button class="btn ghost sm" data-a="foodNew">Crear alimento</button><button class="btn ghost sm" data-a="offSearch">Buscar en Open Food Facts</button><button class="btn ghost sm" data-a="offCode">Código de barras</button></div>
  ${await recentHtml()}<div id="foodres">${foodList(await allFoods())}</div>`;
IN.foodQ = async el => { pick.q = el.value; document.querySelector('#foodres').innerHTML = foodList(await allFoods()); };
let chosen;
A.foodChoose = async el => {
  const f = (await allFoods()).find(x => x.id === el.dataset.id) || pick.online?.find(x => x.id === el.dataset.id);
  if (!f) return toast('Este alimento ya no está en tu base de datos.');
  if (pick.mode === 'ingredient') return ingredientQty(f);
  chosen = f;
  sheet(f.name, () => qtyForm(f, { qty: f.portion?.qty || 100, meal: pick.meal }));
};
const preview = (f, q) => { const v = scaleN(f, q || 0), a = f.approx !== false ? '≈ ' : ''; return `<dl class="nutlist">${NUTRIENTS.map(n => `<div><dt>${NUT_LABEL[n]}</dt><dd>${v[n] == null ? 'sin dato' : `${a}${nf(v[n], n === 'kcal' ? 0 : 1)} ${n === 'kcal' ? 'kcal' : 'g'}`}</dd></div>`).join('')}</dl>`; };
const qtyForm = (f, e) => `<form data-s="logSave" data-id="${e.id || ''}"><p class="muted small">${esc(f.source || (f.approx === false ? 'Valores de etiqueta introducidos por ti' : 'Valores aproximados'))}</p>
  <div class="grid2">${field(`Cantidad (${f.unit})`, `<input name="qty" type="text" inputmode="decimal" autocomplete="off" required value="${e.qty}" data-i="qtyLive">`)}
  ${field('Comida', `<select name="meal">${MEALS.map(([k, l]) => `<option value="${k}" ${e.meal === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
  ${f.portion ? `<button type="button" class="chip" data-a="qtyPortion" data-q="${f.portion.qty}">${esc(f.portion.name)} (${f.portion.qty} ${f.unit})</button>` : ''}
  <div id="qtyprev">${preview(f, e.qty)}</div><button class="btn wide">Guardar en el diario</button></form>`;
IN.qtyLive = el => { document.querySelector('.sheet-wrap:last-child #qtyprev').innerHTML = preview(chosen, numOrNull(el.value)); };
A.qtyPortion = el => { const f = el.closest('form'); f.qty.value = el.dataset.q; IN.qtyLive(f.qty); };
A.logSave = async f => {
  const q = numOrNull(f.qty.value);
  if (!q) return toast('Escribe una cantidad.');
  const c = chosen, id = f.dataset.id || uid();
  await put('foodlog', { id, date: state.date, meal: f.meal.value, foodId: c.id, name: c.name, qty: q, unit: c.unit, approx: c.approx !== false, per100: pickN(c), ...scaleN(c, q) });
  closeSheet(); if (!f.dataset.id) closeSheet();
  toast(`${c.name} guardado`); await render();
};
const pickN = f => Object.fromEntries(NUTRIENTS.map(n => [n, f[n] ?? null]));
A.logEdit = async el => {
  const e = await get('foodlog', el.dataset.id);
  chosen = { id: e.foodId, name: e.name, unit: e.unit, approx: e.approx, ...e.per100, portion: null };
  sheet(e.name, () => qtyForm(chosen, e));
};
/* Crear alimento propio */
A.foodNew = () => sheet('Crear alimento', () => foodForm({ name: pick.q, unit: 'g', approx: false }));
const foodForm = f => `<form data-s="foodSave" data-id="${f.id || ''}">${field('Nombre', `<input name="name" required value="${esc(f.name || '')}">`)}
  <div class="grid2">${field('Unidad', `<select name="unit"><option value="g" ${f.unit === 'g' ? 'selected' : ''}>gramos</option><option value="ml" ${f.unit === 'ml' ? 'selected' : ''}>mililitros</option></select>`)}${field('Categoría', `<input name="cat" value="${esc(f.cat || 'Mis alimentos')}">`)}</div>
  <p class="field-l">Valores por 100 ${f.unit || 'g'}. Deja en blanco lo que no conozcas: no se estimará.</p>
  <div class="grid2">${NUTRIENTS.map(n => field(NUT_LABEL[n], numInput(n, f[n]))).join('')}</div>
  <div class="grid2">${field('Ración (nombre)', `<input name="pn" value="${esc(f.portion?.name || '')}" placeholder="1 unidad">`)}${field('Ración (cantidad)', numInput('pq', f.portion?.qty))}</div>
  <label class="toggle"><input type="checkbox" name="approx" ${f.approx !== false ? 'checked' : ''}><span>Son valores aproximados, no de una etiqueta</span></label>
  <button class="btn wide">Guardar alimento</button></form>`;
A.foodSave = async fm => {
  const v = n => numOrNull(fm[n].value);
  const rec = { id: fm.dataset.id || 'c-' + uid(), name: fm.name.value.trim(), unit: fm.unit.value, cat: fm.cat.value.trim() || 'Mis alimentos', approx: fm.approx.checked, portion: v('pq') ? { name: fm.pn.value || 'Ración', qty: v('pq') } : null, source: fm.approx.checked ? 'Valores aproximados añadidos por ti' : 'Valores de etiqueta añadidos por ti' };
  NUTRIENTS.forEach(n => { rec[n] = v(n); });
  await put('foods', rec); closeSheet(); toast('Alimento guardado'); await refreshSheet(); await render();
};
/* Open Food Facts: en línea, datos colaborativos, siempre aproximados */
const offMap = p => {
  const n = p.nutriments || {}, g = k => { const v = n[k + '_100g']; return v == null || v === '' ? null : Number(v); };
  return { id: 'off-' + p.code, name: [p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(', '), cat: 'Open Food Facts', unit: 'g', kcal: g('energy-kcal'), p: g('proteins'), c: g('carbohydrates'), f: g('fat'), fiber: g('fiber'), sugar: g('sugars'), approx: true, source: 'Open Food Facts, base colaborativa: compruébalo con la etiqueta', portion: null };
};
const FIELDS = 'code,product_name,brands,nutriments';
async function offFetch(url) {
  if (!navigator.onLine) throw new Error('Sin conexión: esta búsqueda necesita internet. Tu base de datos local sigue disponible.');
  const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(); return await r.json(); }
  catch { throw new Error('Open Food Facts no ha respondido. Inténtalo más tarde o crea el alimento.'); }
  finally { clearTimeout(t); }
}
async function offShow(list) {
  const ok = list.filter(f => f.name && f.kcal != null);
  pick.online = ok;
  sheet('Open Food Facts', () => ok.length ? `<p class="muted small">Base colaborativa: los datos pueden tener errores. Comprueba la etiqueta.</p><ul class="list ex-list">${ok.map(f => `<li><button class="grow textbtn" data-a="offSave" data-id="${f.id}"><b>${esc(f.name)}</b><small>≈ ${nf(f.kcal)} kcal/100 g</small></button></li>`).join('')}</ul>` : empty('Sin resultados con datos nutricionales. Puedes crear el alimento.'));
}
A.offSave = async el => { const f = pick.online.find(x => x.id === el.dataset.id); await put('foods', { ...f }); closeSheet(); await refreshSheet(); await A.foodChoose({ dataset: { id: f.id } }); };
A.offSearch = async () => {
  const q = pick.q.trim(); if (q.length < 2) return toast('Escribe primero el alimento en el buscador.');
  toast('Buscando...');
  const d = await offFetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`);
  await offShow((d.products || []).map(offMap));
};
A.offCode = () => sheet('Código de barras', () => `<form data-s="offCodeGo">${field('Número del código', '<input name="c" inputmode="numeric" required pattern="[0-9]{6,14}" placeholder="8410000000000">', 'Escríbelo a mano: Safari en iPhone no permite leerlo con la cámara desde una web de forma fiable.')}<button class="btn wide">Buscar producto</button></form>`);
A.offCodeGo = async f => {
  const d = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(f.c.value)}.json?fields=${FIELDS}`);
  if (d.status !== 1 && !d.product) return toast('Ese código no está en Open Food Facts.');
  closeSheet(); await offShow([offMap({ ...d.product, code: f.c.value })]);
};

/* ---------- Recetas ---------- */
routes.recetas = {
  title: 'Recetas y platos', back: true,
  async render() {
    const rs = await all('recipes'), custom = (await all('foods')).filter(f => !f.hidden);
    return `<div class="page"><p class="lead">Guarda tus platos habituales y añádelos al diario con un toque.</p><button class="btn wide" data-a="recNew">Crear receta</button>
    ${rs.length ? `<ul class="list">${rs.map(r => { const n = recipeNutrition(r); return `<li><button class="grow textbtn" data-a="recEdit" data-id="${r.id}"><b>${esc(r.name)}</b><small>${r.servings || 1} raciones, ${n.approx ? '≈ ' : ''}${nf(n.whole.kcal == null ? null : n.whole.kcal / (r.servings || 1))} kcal por ración</small></button><button class="btn ghost sm" data-a="recLog" data-id="${r.id}">Añadir</button></li>`; }).join('')}</ul>` : empty('Aún no tienes recetas.')}
    <h2>Mis alimentos</h2>${custom.length ? `<ul class="list">${custom.map(f => `<li><button class="grow textbtn" data-a="foodEdit" data-id="${f.id}"><b>${esc(f.name)}</b><small>${f.approx !== false ? '≈ ' : ''}${nf(f.kcal)} kcal/100 ${f.unit}</small></button><button class="icon" data-a="foodDel" data-id="${f.id}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : '<p class="muted">Los alimentos que crees aparecerán aquí.</p>'}
    </div>`;
  },
};
A.foodEdit = async el => { const f = await get('foods', el.dataset.id); sheet('Editar alimento', () => foodForm(f)); };
A.foodDel = async el => { if (!await confirmDlg('¿Eliminar este alimento? Lo ya registrado en el diario se conserva.')) return; await del('foods', el.dataset.id); await render(); };
let draft;
const recForm = () => {
  const n = recipeNutrition(draft);
  return `<form data-s="recSave">${field('Nombre', `<input name="name" required value="${esc(draft.name || '')}" data-c="recF" data-f="name">`)}
  <div class="grid2">${field('Raciones', `<input name="servings" type="number" min="1" inputmode="numeric" value="${draft.servings || 1}" data-c="recF" data-f="servings">`)}${field('Peso final cocinado (g)', numInput('cookedWeight', draft.cookedWeight, 'data-c="recF" data-f="cookedWeight" placeholder="Opcional"'))}</div>
  <h3>Ingredientes</h3>${draft.ingredients.length ? `<ul class="list">${draft.ingredients.map((i, x) => `<li><span class="grow"><b>${esc(i.name)}</b><small class="block">${nf(i.qty, 1)} ${i.unit}, ${i.approx !== false ? '≈ ' : ''}${nf(i.kcal)} kcal</small></span><button type="button" class="icon" data-a="ingDel" data-i="${x}" aria-label="Quitar">${ICON.trash}</button></li>`).join('')}</ul>` : '<p class="muted">Añade al menos un ingrediente.</p>'}
  <button type="button" class="btn ghost wide" data-a="ingPick">Añadir ingrediente</button>
  ${draft.ingredients.length ? `<p class="lead">Por ración: ${n.approx ? '≈ ' : ''}${nf(n.whole.kcal == null ? null : n.whole.kcal / (draft.servings || 1))} kcal, ${nf(n.whole.p == null ? null : n.whole.p / (draft.servings || 1))} g de proteína.</p>` : ''}
  <button class="btn wide">Guardar receta</button>${draft.id ? `<button type="button" class="btn ghost danger-t wide" data-a="recDel">Eliminar receta</button>` : ''}</form>`;
};
A.recNew = () => { draft = { name: '', servings: 1, ingredients: [] }; sheet('Receta', recForm); };
A.recEdit = async el => { draft = structuredClone(await get('recipes', el.dataset.id)); sheet('Receta', recForm); };
CH.recF = el => { const f = el.dataset.f; draft[f] = f === 'name' ? el.value : numOrNull(el.value); if (f !== 'name') refreshSheet(); };
A.ingDel = async el => { draft.ingredients.splice(+el.dataset.i, 1); await refreshSheet(); };
A.ingPick = () => { pick = { meal: 'otros', q: '', online: null, mode: 'ingredient' }; sheet('Ingrediente', pickHtml, { onClose: () => { pick.mode = 'log'; } }); };
function ingredientQty(f) { chosen = f; sheet(f.name, () => `<form data-s="ingSave">${field(`Cantidad (${f.unit})`, `<input name="qty" type="text" inputmode="decimal" autocomplete="off" required value="${f.portion?.qty || 100}">`)}<button class="btn wide">Añadir a la receta</button></form>`); }
A.ingSave = async f => {
  const q = numOrNull(f.qty.value); if (!q) return;
  draft.ingredients.push({ foodId: chosen.id, name: chosen.name, qty: q, unit: chosen.unit, approx: chosen.approx !== false, ...scaleN(chosen, q) });
  closeSheet(); closeSheet(); await refreshSheet();
};
A.recSave = async f => {
  if (!draft.ingredients.length) return toast('Añade al menos un ingrediente.');
  draft.name = f.name.value.trim(); draft.servings = numOrNull(f.servings.value) || 1; draft.cookedWeight = numOrNull(f.cookedWeight.value);
  draft.id ||= 'r-' + uid();
  await put('recipes', draft); closeSheet(); toast('Receta guardada'); await render();
};
A.recDel = async () => { if (!await confirmDlg('¿Eliminar esta receta? Lo registrado en el diario se conserva.')) return; await del('recipes', draft.id); closeSheet(); await render(); };
A.recLog = async el => { pick = { meal: defaultMeal(), q: '', online: null, mode: 'log' }; await A.foodChoose(el); };

/* ---------- Hidratación ---------- */
routes.agua = {
  title: 'Hidratación', back: true,
  async render() {
    const date = state.date, t = todayStr(), day = await getDay(date), ml = waterTotal(day), goal = S.goals.water;
    const from = addDays(t, -29), days = await range('days', from, t), map = new Map(days.map(d => [d.date, waterTotal(d)]));
    const ds = dateRange(from, t), wk = ds.slice(-7).map(d => map.get(d) || null);
    const glass = S.water.glass;
    return `<div class="page">${dateNav()}<section class="center-col">${ring(ml / goal, { size: 200, stroke: 7, inner: `<b class="big">${nf(ml / 1000, 2)} L</b><span>${nf(ml)} de ${nf(goal)} ml</span><em>${Math.round(ml / goal * 100)} %</em>` })}</section>
    <div class="water-grid">${[[glass, `Vaso, ${glass} ml`], [500, 'Botella de 500 ml'], [750, 'Botella de 750 ml'], [1000, 'Botella de 1 L']].map(([v, l]) => `<button class="btn ghost" data-a="waterAdd" data-ml="${v}">${l}</button>`).join('')}</div>
    <form class="inline" data-s="waterCustom"><input name="ml" type="number" inputmode="numeric" min="1" placeholder="Cantidad en ml" required aria-label="Cantidad en mililitros"><button class="btn">Añadir</button></form>
    <section class="stats">${stat('Media semanal', `${nf(mean(wk.filter(Boolean)) / 1000, 2)} L`, 'días con registro')}${stat('Días con objetivo', nf(ds.filter(d => (map.get(d) || 0) >= goal).length), 'últimos 30')}</section>
    <h2>Registro de este día</h2>${(day.water || []).length ? `<ul class="list">${day.water.map((w, i) => `<li><span class="grow">${w.t || ''}</span><b>${nf(w.ml)} ml</b><button class="icon" data-a="waterDel" data-i="${i}" aria-label="Eliminar">${ICON.trash}</button></li>`).join('')}</ul>` : empty('Aún no has registrado agua este día.')}
    ${barChart({ title: 'Hidratación, últimos 30 días', values: ds.map(d => map.get(d) || null), labels: ds.map(fmtShort), goal, unit: 'ml', name: 'Agua' })}
    <form class="inline" data-s="waterGoal"><label class="grow field"><span>Objetivo diario (ml)</span><input name="g" type="number" inputmode="numeric" value="${goal}" min="100" required></label><button class="btn ghost">Guardar objetivo</button></form></div>`;
  },
};
A.waterAdd = async el => { await updDay(state.date, d => { (d.water ||= []).push({ ml: +el.dataset.ml, t: nowTime() }); }); await render(); };
A.waterCustom = async f => { const v = numOrNull(f.ml.value); if (!v) return; await updDay(state.date, d => { (d.water ||= []).push({ ml: v, t: nowTime() }); }); await render(); };
A.waterDel = async el => { await updDay(state.date, d => { d.water.splice(+el.dataset.i, 1); }); await render(); };
A.waterGoal = async f => { const { saveSettings } = await import('../ui.js'); S.goals.water = numOrNull(f.g.value) || S.goals.water; await saveSettings(); toast('Objetivo guardado'); await render(); };
