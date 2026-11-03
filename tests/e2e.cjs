// Prueba de extremo a extremo con emulación de iPhone. Uso: node tests/e2e.cjs [carpeta-capturas]
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SHOTS = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
const fails = []; let passed = 0;
const ok = (c, m) => { if (c) { passed++; } else { fails.push(m); console.log('FALLO:', m); } };
(async () => {
  await new Promise(r => srv.listen(8765, r));
  const base = 'http://localhost:8765';
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'allow', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404|ERR_INTERNET/.test(m.text())) errs.push(m.text()); });
  const shot = async n => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false }); };
  const db = (s, k) => p.evaluate(async ([s, k]) => { const m = await import('/js/db.js'); return k ? m.get(s, k) : m.all(s); }, [s, k]);
  const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const nav = async r => { await p.evaluate(r => { document.querySelectorAll('.sheet-wrap').forEach(() => {}); location.hash = '#/' + r; }, r); await p.waitForTimeout(120); };
  const closeSheets = async () => { for (let i = 0; i < 5; i++) { const c = p.locator('.sheet-wrap:last-of-type .close'); if (await c.count()) { await c.last().click(); await p.waitForTimeout(40); } else break; } };

  await p.goto(base + '/index.html');
  await p.waitForSelector('.sheet-wrap');
  await p.waitForTimeout(600);
  await shot('00-bienvenida');
  ok(await p.locator('text=Primero, instálala').count() > 0, 'la bienvenida en iPhone explica la instalación');
  await p.fill('form[data-s=onboardSave] input[name=water]', '2500');
  await p.click('text=Empezar');
  await p.waitForTimeout(200);
  ok((await db('kv', 'settings')).goals.water === 2500, 'la bienvenida guarda objetivos');
  ok(!(await p.locator('.drow').allInnerTexts()).join().match(/\d{4,}/), 'sin datos ficticios al empezar');
  await shot('01-hoy-vacio');

  // Pasos
  await nav('pasos');
  await p.fill('input[name=n]', '12000'); await p.click('button[data-m=set]'); await p.waitForTimeout(150);
  await p.fill('input[name=n]', '9000'); await p.click('button[data-m=add]'); await p.waitForTimeout(150);
  ok((await db('days', today)).steps === 21000, 'los pasos se fijan y se suman');
  ok((await p.innerText('.center-col')).includes('1.000 de más'), 'pasos restantes o excedente');
  ok(await p.locator('.tags li').count() === 1, 'historial de días con objetivo');
  await shot('02-pasos');
  await p.click('.linkish'); await p.waitForTimeout(60);
  await p.evaluate(() => navigator.clipboard.writeText('22345').catch(() => {}));
  await p.fill('.sheet textarea', '22345'); await p.click('text=Guardar pasos'); await p.waitForTimeout(150);
  ok((await db('days', today)).steps === 22345, 'importación estilo Atajo');
  await p.click('button[data-a=stepEdit]'); await p.fill('.sheet input[name=n]', '21000'); await p.click('.sheet button.btn'); await p.waitForTimeout(150);
  ok((await db('days', today)).steps === 21000, 'editar un registro de pasos');

  // Entrenamiento
  await nav('entreno');
  await p.click('button[data-a=newWorkout]'); await p.fill('.sheet input[name=name]', 'Glúteo'); await p.click('.sheet button.btn.wide'); await p.waitForTimeout(250);
  await p.click('button[data-a=pickEx]'); await p.waitForTimeout(100);
  await p.fill('.sheet input[data-i=libQ]', 'hip thrust barra'); await p.waitForTimeout(150);
  ok(await p.locator('.sheet #libres li').count() === 1, 'el buscador de ejercicios filtra');
  await p.click('.sheet #libres li button'); await p.waitForTimeout(250);
  const fill = async (i, f, v) => { const l = p.locator(`input[data-j="${i}"][data-f="${f}"]`); await l.fill(v); await l.blur(); await p.waitForTimeout(70); };
  await fill(0, 'kg', '40'); await fill(0, 'reps', '12'); await fill(1, 'kg', '50'); await fill(1, 'reps', '10'); await fill(2, 'kg', '60'); await fill(2, 'reps', '8');
  ok((await p.innerText('#wvol')).includes('1.460'), 'volumen del ejemplo: 1.460 kg');
  await p.click('button[data-a=itRpe][data-v="8"]'); await p.waitForTimeout(100);
  await p.click('button[data-a=wTemplate]'); await p.waitForTimeout(100);
  await shot('03-sesion');
  await p.click('button[data-a=wFinish]'); await p.waitForTimeout(200); await closeSheets();
  let ws = await db('workouts');
  ok(ws.length === 1 && ws[0].status === 'done' && ws[0].items[0].rpe === 8, 'la sesión se guarda con su dificultad');
  // Segunda sesión: última vez y récord
  await nav('entreno');
  await p.click('button[data-a=startTemplate]'); await p.waitForTimeout(300);
  ok((await p.innerText('.lastline')).includes('60 kg × 8'), 'muestra lo que levantaste la última vez');
  await fill(0, 'kg', '70'); await fill(0, 'reps', '6');
  await p.click('button[data-a=wFinish]'); await p.waitForTimeout(200);
  ok((await p.innerText('.sheet')).includes('récord de peso'), 'detecta un récord');
  await closeSheets();
  await p.click('.excard .textbtn'); await p.waitForTimeout(200);
  ok((await p.innerText('.sheet .stats')).includes('70 kg'), 'récord de peso en el detalle');
  await shot('04-ejercicio'); await closeSheets();
  await nav('biblioteca');
  await p.selectOption('select[data-f=group]', 'gluteos'); await p.waitForTimeout(100);
  await p.selectOption('select[data-f=equip]', 'Barra'); await p.waitForTimeout(100);
  ok((await p.locator('#libres li').count()) >= 2, 'filtros por grupo y equipo');
  await p.selectOption('select[data-f=group]', ''); await p.selectOption('select[data-f=equip]', ''); await p.waitForTimeout(100);
  await p.click('button[data-a=exNew]'); await p.fill('.sheet input[name=name]', 'Mi ejercicio raro'); await p.click('.sheet .btn.wide'); await p.waitForTimeout(150);
  ok((await db('exercises')).length === 1, 'crear ejercicio propio');

  // Comida
  await nav('comida');
  await p.click('button[data-a=foodPick][data-m=almuerzo]'); await p.waitForTimeout(150);
  await p.fill('.sheet input[data-i=foodQ]', 'pechuga de pollo cocinada'); await p.waitForTimeout(150);
  await p.click('#foodres li button'); await p.waitForTimeout(100);
  await p.fill('.sheet-wrap:last-of-type input[name=qty]', '200'); await p.waitForTimeout(80);
  ok((await p.innerText('.sheet-wrap:last-of-type #qtyprev')).includes('≈'), 'la previsualización marca aproximación');
  await p.click('text=Guardar en el diario'); await p.waitForTimeout(200);
  let log = await db('foodlog');
  ok(log.length === 1 && Math.round(log[0].p) === 62 && log[0].approx === true, 'calcula proteína y marca aproximado');
  // Alimento propio con datos parciales
  await p.click('button[data-a=foodPick][data-m=cena]'); await p.waitForTimeout(120);
  await p.click('button[data-a=foodNew]'); await p.waitForTimeout(60);
  await p.fill('.sheet-wrap:last-of-type input[name=name]', 'Yogur de mi marca');
  for (const [k, v] of [['kcal', '100'], ['p', '10'], ['c', '5'], ['f', '2']]) await p.fill(`.sheet-wrap:last-of-type input[name=${k}]`, v);
  await p.uncheck('.sheet-wrap:last-of-type input[name=approx]');
  await p.click('text=Guardar alimento'); await p.waitForTimeout(150);
  await p.fill('.sheet input[data-i=foodQ]', 'yogur de mi'); await p.waitForTimeout(120);
  await p.click('#foodres li button'); await p.waitForTimeout(80);
  await p.click('text=Guardar en el diario'); await p.waitForTimeout(150);
  log = await db('foodlog');
  ok(log.some(l => l.fiber === null && l.approx === false), 'un dato desconocido no se inventa');
  ok((await p.innerText('.goalbars')).includes('incompleto'), 'avisa de totales incompletos');
  await shot('05-comida');
  // Receta
  await nav('recetas');
  await p.click('button[data-a=recNew]'); await p.fill('.sheet input[name=name]', 'Bol de avena');
  await p.fill('.sheet input[name=name]', 'Bol de avena'); await p.locator('.sheet input[name=name]').blur();
  await p.click('button[data-a=ingPick]'); await p.waitForTimeout(100);
  await p.fill('.sheet-wrap:last-of-type input[data-i=foodQ]', 'avena'); await p.waitForTimeout(120);
  await p.click('.sheet-wrap:last-of-type #foodres li button'); await p.waitForTimeout(80);
  await p.click('text=Añadir a la receta'); await p.waitForTimeout(150);
  await p.click('text=Guardar receta'); await p.waitForTimeout(150);
  ok((await db('recipes')).length === 1, 'guardar receta');
  await p.click('button[data-a=recLog]'); await p.waitForTimeout(150);
  await p.click('text=Guardar en el diario'); await p.waitForTimeout(150);
  ok((await db('foodlog')).some(l => l.name === 'Bol de avena'), 'reutilizar receta en el diario');

  // Agua
  await nav('agua');
  await p.click('button[data-ml="500"]'); await p.waitForTimeout(100); await p.click('button[data-ml="1000"]'); await p.waitForTimeout(100);
  await p.fill('input[name=ml]', '150'); await p.locator('form[data-s=waterCustom] .btn').click(); await p.waitForTimeout(120);
  ok((await p.innerText('.ring')).includes('1,65 L'), 'agua: acumulado en litros');
  await shot('06-agua');
  // Skincare
  await nav('skincare');
  await p.click('button[data-a=skinTick][data-id=am1]'); await p.waitForTimeout(100);
  ok((await db('days', today)).skin.am.am1.time, 'skincare guarda producto y hora');
  await p.click('button[data-a=skinProd][data-id=pm3]'); await p.waitForTimeout(60);
  for (const k of [0, 2, 3, 4, 5, 6]) await p.locator(`.sheet input[name=d${k}]`).evaluate(e => { e.checked = false; });
  await p.click('.sheet .btn.wide'); await p.waitForTimeout(150);
  ok((await db('kv', 'settings')).skin.pm.find(x => x.id === 'pm3').days.join() === '1', 'frecuencia configurable por producto');
  await p.click('button[data-a=skinConcern]'); await p.waitForTimeout(100);
  await p.setInputFiles('input[data-c=skinPhoto]', path.join(ROOT, 'icons/icon-192.png')); await p.waitForTimeout(1500);
  ok((await db('photos')).length === 1, 'guardar foto');
  ok(await p.locator('.photos img').count() === 1, 'mostrar foto');
  await shot('07-skincare');
  // Dental, ducha, pelo
  await nav('dental'); await p.click('button[data-id=floss]'); await p.waitForTimeout(100);
  await nav('ducha'); await p.click('button[data-a=showerTick]'); await p.waitForTimeout(100);
  ok((await db('days', today)).shower.time, 'ducha con hora');
  await nav('pelo'); await p.click('button[data-v=wash]'); await p.waitForTimeout(100); await p.click('button[data-id=washed]'); await p.waitForTimeout(100);
  ok((await p.innerText('.stats')).includes('0'), 'días desde el último lavado');
  await shot('08-pelo');
  // Lectura
  await nav('lectura');
  await p.click('button[data-a=bookNew]'); await p.fill('.sheet input[name=title]', 'La regenta'); await p.click('.sheet .btn.wide'); await p.waitForTimeout(150);
  await p.fill('input[name=p]', '35'); await p.selectOption('select[name=b]', { label: 'La regenta' }); await p.click('text=Registrar páginas'); await p.waitForTimeout(150);
  ok((await p.innerText('.readhead')).includes('+15 páginas adicionales'), 'ejemplo: objetivo cumplido +15 páginas');
  await shot('09-lectura');
  // Cuerpo
  await nav('cuerpo');
  for (const [d, w] of [['2026-01-01', '62'], [today, '60.5']]) { await p.click('button[data-a=bodyNew]'); await p.fill('.sheet input[name=date]', d); await p.fill('.sheet input[name=weight]', w); await p.fill('.sheet input[name=waist]', '70'); await p.click('.sheet .btn.wide'); await p.waitForTimeout(150); }
  ok((await p.innerText('.tbl')).includes('-1,5 kg'), 'diferencia respecto al primer registro');
  await shot('10-cuerpo');
  // Sueño
  await nav('sueno');
  await p.fill('input[data-f=bed]', '23:30'); await p.locator('input[data-f=bed]').blur(); await p.waitForTimeout(150);
  await p.fill('input[data-f=wake]', '07:00'); await p.locator('input[data-f=wake]').blur(); await p.waitForTimeout(150);
  ok((await p.innerText('.huge')).includes('7 h 30'), 'sueño cruzando medianoche');
  await p.click('button[data-a=sleepRate][data-f=quality][data-v="4"]'); await p.waitForTimeout(100);
  await shot('11-sueno');
  // Ánimo
  await nav('animo'); await p.click('button[data-k=mood][data-v="7"]'); await p.waitForTimeout(100); await p.click('button[data-k=energy][data-v="6"]'); await p.waitForTimeout(120);
  ok((await db('days', today)).mood.mood === 7, 'ánimo guardado');
  await shot('12-animo');
  // Ciclo
  await nav('ciclo');
  const past = async (n) => p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }, n);
  for (const n of [70, 40, 12]) {
    await p.click('button[data-a=periodNew]'); await p.fill('.sheet input[name=start]', await past(n)); await p.fill('.sheet input[name=end]', await past(n - 4)); await p.selectOption('.sheet select[name=intensity]', '2'); await p.click('.sheet .btn.wide'); await p.waitForTimeout(150);
  }
  ok((await p.innerText('.page')).includes('29 días de media'), 'estimación con ciclos anteriores');
  ok((await p.innerText('.page')).includes('estimado'), 'las fases se presentan como estimación');
  ok((await p.innerText('.disclaimer')).includes('anticonceptivo'), 'aviso de no anticonceptivo');
  ok(await p.locator('.cal-d.ph-lutea, .cal-d.ph-folicular').count() > 0, 'calendario con fases');
  await shot('13-ciclo');
  await nav('sintomas');
  const t0 = Date.now();
  await p.click('button[data-k=colicos][data-v="4"]'); await p.waitForTimeout(40); await p.click('button[data-k=energia][data-v="3"]'); await p.waitForTimeout(40); await p.click('button[data-k=animo][data-v="4"]'); await p.waitForTimeout(40);
  await p.click('button[data-a=symZero]'); await p.waitForTimeout(150);
  const sym = (await db('days', today)).sym;
  ok(sym.colicos === 4 && sym.tristeza === 0 && Object.keys(sym).length === 20, 'cuestionario: 20 síntomas de 0 a 5');
  await p.fill('input[name=n]', 'Sofocos'); await p.locator('form[data-s=symAdd] .btn').click(); await p.waitForTimeout(150);
  ok((await db('kv', 'settings')).cycle.customSym.length === 1, 'síntoma personalizado');
  await shot('14-sintomas');
  await nav('cicloanalisis'); await p.waitForTimeout(200);
  ok((await p.innerText(".page")).includes("Cólicos"), "análisis cruza síntomas");
  ok(await p.locator('.chart svg').count() >= 2, 'gráficos de análisis');
  await shot('15-analisis');
  // Hábitos
  await nav('habitos'); await p.click('button[data-a=habitNew]'); await p.fill('.sheet input[name=n]', 'Meditar'); await p.click('.sheet .btn.wide'); await p.waitForTimeout(150);
  await p.click('button[data-a=habitTick]'); await p.waitForTimeout(100);
  // Hoy
  await nav('hoy'); await p.waitForTimeout(200);
  const hoy = await p.innerText('.page');
  ok(hoy.includes('Meditar'), 'hábito propio en el panel');
  ok(hoy.includes('7 h 30') && hoy.includes('Hoy'), 'panel: sueño');
  const pctBefore = await p.innerText('.corolla-in b');
  ok(parseInt(pctBefore) > 30, 'porcentaje diario calculado: ' + pctBefore);
  await p.click('button[data-a=toggleItem][data-k=dental]'); await p.waitForTimeout(150);
  ok((await db('days', today)).dental.am === true, 'marcar higiene dental desde el panel');
  ok(parseInt(await p.innerText('.corolla-in b')) >= parseInt(pctBefore), 'el porcentaje se actualiza');
  await p.click('button[data-a=toggleItem][data-k=shower]'); await p.waitForTimeout(150);
  await p.click('button[data-a=toggleItem][data-k=shower]'); await p.waitForTimeout(150);
  await shot('16-hoy');
  await p.screenshot({ path: SHOTS ? `${SHOTS}/16b-hoy-completo.png` : '/dev/null', fullPage: true }).catch(() => {});
  // Fecha pasada y edición
  await p.click('button[data-a=dayShift][data-n="-1"]'); await p.waitForTimeout(150);
  await p.click('button[data-a=quickWater]'); await p.waitForTimeout(150);
  const y = await past(1);
  ok((await db('days', y)).water.length === 1, 'registrar en una fecha anterior');
  await p.click('button[data-a=dayShift][data-n="1"]'); await p.waitForTimeout(100);
  // Calendario y estadísticas
  await nav('calendario'); await p.waitForTimeout(200); await shot('17-calendario');
  await p.click('button[data-v=train]'); await p.waitForTimeout(150);
  ok(await p.locator('.cgen.hit').count() === 1, 'calendario filtra días entrenados');
  await p.click(`button[data-a=calFilter][data-v=""]`); await p.waitForTimeout(150);
  await p.click(`button[data-d="${today}"]`); await p.waitForTimeout(150);
  ok((await p.innerText('.sheet')).includes('21.000'), 'detalle de día en calendario');
  await shot('18-calendario-dia'); await closeSheets();
  await nav('estadisticas'); await p.waitForTimeout(300);
  for (const s of [7, 90, 180, 365, 30]) { await p.click(`button[data-a=statSpan][data-v="${s}"]`); await p.waitForTimeout(200); ok(await p.locator('.chart').count() >= 12, 'estadísticas con 12 gráficos, periodo ' + s); }
  await shot('19-estadisticas');
  const stepsChart1 = await p.locator('.chart').first().innerHTML();
  // Auditoría: ningún control sin función
  const routes = ['hoy', 'pasos', 'entreno', 'biblioteca', 'comida', 'recetas', 'agua', 'skincare', 'dental', 'ducha', 'pelo', 'habitos', 'lectura', 'cuerpo', 'sueno', 'animo', 'ciclo', 'sintomas', 'cicloanalisis', 'mas', 'calendario', 'estadisticas', 'ajustes', 'sesion?id=' + ws[0].id];
  const dead = new Set();
  for (const r of routes) {
    await nav(r); await p.waitForTimeout(150);
    const miss = await p.evaluate(async () => { const { A, CH, IN } = await import('/js/ui.js'); const bad = []; document.querySelectorAll('[data-a]').forEach(e => { if (!A[e.dataset.a]) bad.push('a:' + e.dataset.a); }); document.querySelectorAll('[data-c]').forEach(e => { if (!CH[e.dataset.c]) bad.push('c:' + e.dataset.c); }); document.querySelectorAll('[data-i]').forEach(e => { if (e.tagName === 'INPUT' && e.dataset.i && isNaN(e.dataset.i) && !IN[e.dataset.i]) bad.push('i:' + e.dataset.i); }); document.querySelectorAll('form[data-s]').forEach(e => { if (!A[e.dataset.s]) bad.push('s:' + e.dataset.s); }); document.querySelectorAll('main button:not([data-a]):not([type=submit]):not(form button)').forEach(e => bad.push('sinaccion:' + e.textContent)); return bad; });
    miss.forEach(x => dead.add(r + ' ' + x));
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!overflow, 'sin desbordamiento horizontal en ' + r);
    ok(!(await p.innerText('main')).includes('undefined') && !(await p.innerText('main')).includes('NaN') && !(await p.innerText('main')).includes('[object'), 'sin undefined/NaN en ' + r);
  }
  ok(dead.size === 0, 'controles sin función: ' + [...dead].join(', '));
  // Auditoría en dimensiones reales de iPhone, con espacios seguros simulados (notch / Dynamic Island)
  const IPHONES = [['SE 3', 375, 667, 20, 0], ['13 mini', 375, 812, 50, 34], ['14', 390, 844, 47, 34], ['15', 393, 852, 59, 34], ['16 Pro', 402, 874, 62, 34], ['Air', 420, 912, 62, 34], ['15 Plus', 430, 932, 59, 34], ['16 Pro Max', 440, 956, 62, 34]];
  const cdp = await ctx.newCDPSession(p);
  const AUDIT = () => { const bad = []; const vw = innerWidth; const tab = document.querySelector('.tabbar').getBoundingClientRect();
    const root = document.querySelector('.sheet-wrap:last-of-type .sheet') || document.querySelector('main');
    const name = e => (e.tagName + ':' + (e.getAttribute('aria-label') || e.textContent || e.name || e.className || '').trim().slice(0, 28));
    if (document.documentElement.scrollWidth > vw + 1) bad.push('desborde de página');
    root.querySelectorAll('button,a,input,select,textarea,summary,label.chip-c,label.fileb,label.toggle').forEach(e => {
      if (e.matches('.chip-c input,input[type=file],input[type=checkbox],.hero-title input,.datenav-mid input,.hit')) return;
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); if (!r.width || cs.display === 'none' || e.closest('details:not([open]) table')) return;
      if (r.height < 43.5 || r.width < 36) bad.push(`pequeño ${Math.round(r.width)}x${Math.round(r.height)} ${name(e)}`);
      if (e.matches('input,select,textarea') && parseFloat(cs.fontSize) < 16) bad.push('zoom iOS: ' + name(e));
      if (!e.closest('.scroll-x') && (r.right > vw + 1 || r.left < -1)) bad.push('cortado ' + name(e));
      if (e.matches('button,summary') && e.scrollWidth > e.clientWidth + 1 && e.clientWidth) bad.push('texto cortado ' + name(e));
    });
    root.querySelectorAll('h1,h2,h3,p,li,td,th,figure,svg,table,.stat,.chip').forEach(e => { if (e.closest('.scroll-x') || e.closest('svg') && e.tagName !== 'svg') return; const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) bad.push('cortado ' + name(e)); });
    root.querySelectorAll('.scroll-x').forEach(e => { if (e.scrollWidth > e.clientWidth + 1) bad.push('tabla con scroll lateral: ' + name(e)); });
    return bad; };
  const SHEETS = [['pasos', 'stepsImport'], ['entreno', 'newWorkout'], ['comida', 'foodPick'], ['skincare', 'skinAdd'], ['cuerpo', 'bodyNew'], ['ciclo', 'periodNew'], ['ciclo', 'cycleCfg'], ['lectura', 'bookNew'], ['ajustes', 'backupNew'], ['ajustes', 'remHelp'], ['pelo', 'hairRoutineNew'], ['habitos', 'habitNew']];
  const issues = new Set();
  for (const [dn, w, h, top, bottom] of IPHONES) {
    await p.setViewportSize({ width: w, height: h });
    try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom, left: 0, right: 0 } }); } catch (e) { if (dn === 'SE 3') console.log('Sin simulación de inset:', e.message); }
    for (const r of routes) {
      await nav(r); await p.waitForTimeout(90);
      (await p.evaluate(AUDIT)).forEach(x => issues.add(`${dn} ${r}: ${x}`));
      // nada queda tapado por la barra inferior al llegar al final
      const hidden = await p.evaluate(async () => { window.scrollTo(0, document.documentElement.scrollHeight); await new Promise(r => setTimeout(r, 30)); const v = document.querySelector('#view'); const els = [...v.querySelectorAll('.page>*')].filter(e => e.getBoundingClientRect().height); const last = els[els.length - 1]; const res = last.getBoundingClientRect().bottom > document.querySelector('.tabbar').getBoundingClientRect().top + 1; window.scrollTo(0, 0); return res; });
      if (hidden) issues.add(`${dn} ${r}: el final queda bajo la barra`);
      const topOk = await p.evaluate(t => { const e = document.querySelector('.subhead,.page'); const c = e.firstElementChild?.getBoundingClientRect(); return !c || c.top >= t - 1; }, top);
      if (!topOk) issues.add(`${dn} ${r}: contenido bajo la Dynamic Island`);
    }
    for (const [r, a] of SHEETS) {
      await nav(r); await p.waitForTimeout(60);
      await p.locator(`button[data-a=${a}]`).first().click(); await p.waitForTimeout(90);
      (await p.evaluate(AUDIT)).forEach(x => issues.add(`${dn} hoja ${a}: ${x}`));
      await closeSheets();
    }
    if (SHOTS && ['SE 3', '16 Pro Max'].includes(dn)) for (const r of ['hoy', 'entreno', 'ciclo', 'estadisticas', 'animo', 'sesion?id=' + ws[0].id, 'sintomas', 'ajustes']) { await nav(r); await p.waitForTimeout(120); await p.screenshot({ path: `${SHOTS}/i-${dn.replace(/ /g, '')}-${r.split('?')[0]}.png` }); }
  }
  [...issues].slice(0, 60).forEach(x => console.log('  ·', x));
  ok(issues.size === 0, `auditoría iPhone: ${issues.size} incidencias`);
  await p.setViewportSize({ width: 390, height: 664 }); await nav('hoy');
  // Copias cifradas
  const enc = await p.evaluate(async () => { const b = await import('/js/backup.js'), m = await import('/js/db.js'); const d = await m.exportAll({ photos: true }); const blob = await b.encryptedBlob(d, 'contraseña larga'); const o = JSON.parse(await blob.text()); let wrong = false; try { await b.decryptBackup(o, 'mala contraseña'); } catch { wrong = true; } const back = await b.decryptBackup(o, 'contraseña larga'); const plain = JSON.parse(await b.plainBlob(d).text()); return { wrong, same: JSON.stringify(back) === JSON.stringify(d), plainSame: JSON.stringify(plain) === JSON.stringify(d), leak: JSON.stringify(o).includes('Glúteo') }; });
  ok(enc.wrong && enc.same && enc.plainSame && !enc.leak, 'copia cifrada: abre con su contraseña, rechaza otra y no deja texto legible');
  await nav('ajustes'); await p.waitForTimeout(150); await p.click('button[data-a=backupNew]');
  await p.fill('.sheet input[name=p1]', 'contraseña larga'); await p.fill('.sheet input[name=p2]', 'contraseña larga'); await p.click('.sheet form .btn.wide'); await p.waitForTimeout(2500);
  ok(await p.locator('button[data-a=backupSave]').count() === 1, 'la copia se prepara y espera un toque para compartir');
  await closeSheets();
  // Punto de restauración
  await p.evaluate(async () => { const s = await import('/js/views/settings.js'), m = await import('/js/db.js'); await s.snapshot('2020-01-01'); await m.updDay('2020-05-05', d => { d.steps = 1; }); });
  await p.evaluate(async () => { const m = await import('/js/db.js'), n = await m.get('snapshots', '2020-01-01'); await m.importAll(n.data, 'replace'); });
  ok(!(await db('days', '2020-05-05')) && (await db('photos')).length === 1, 'restaurar punto conserva fotos y deshace cambios');
  ok((await db('workouts')).length === 2, 'snapshot conserva entrenos');
  // Decimal con coma y conexión perdida
  await nav('cuerpo'); await p.waitForTimeout(100); await p.click('button[data-a=bodyNew]'); await p.fill('.sheet input[name=date]', '2026-03-03'); await p.fill('.sheet input[name=weight]', '61,5'); await p.click('.sheet .btn.wide'); await p.waitForTimeout(150);
  ok((await db('body')).some(r => r.weight === 61.5), 'decimales con coma');
  const reconnect = await p.evaluate(async () => { const m = await import('/js/db.js'); (await m.openDB()).close(); return (await m.all('days')).length > 0; });
  ok(reconnect, 'recupera la base de datos si iOS cierra la conexión');
  // Modo instalado: sin avisos de Safari
  const sa = await ctx.newPage(); await sa.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await sa.goto(base + '/index.html'); await sa.waitForSelector('.corolla'); await sa.waitForTimeout(300);
  ok(!(await sa.locator('#safari-warn.on').count()), 'instalada: sin aviso de Safari'); await sa.close();
  // Persistencia tras recarga
  await p.goto(base + '/index.html#/hoy'); await p.waitForSelector('.corolla'); await p.waitForTimeout(300);
  ok((await p.innerText('.page')).includes('21.000'), 'los datos persisten al recargar');
  // Copia y restauración
  const backup = await p.evaluate(async () => { const m = await import('/js/db.js'); return JSON.stringify(await m.exportAll({ photos: true })); });
  const counts = JSON.parse(backup).stores;
  ok(counts.photos[0].data?.startsWith('data:image'), 'la copia incluye fotos');
  await p.evaluate(async b => { const m = await import('/js/db.js'); await m.wipeAll(); await m.importAll(JSON.parse(b), 'replace'); }, backup);
  const ph = await db('photos');
  ok((await db('workouts')).length === 2 && (await db('periods')).length === 3, 'restaurar copia');
  ok(await p.evaluate(async () => { const m = await import('/js/db.js'); return (await m.all('photos'))[0].blob instanceof Blob; }), 'restaurar fotos como Blob');
  const badImport = await p.evaluate(async () => { const m = await import('/js/db.js'); try { m.validateBackup({ app: 'otra' }); return false; } catch { return true; } });
  ok(badImport, 'rechaza archivos que no son copias');
  // PWA y offline
  const reg = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active?.state; });
  ok(reg === 'activated', 'service worker activo');
  const man = await (await p.request.get(base + '/manifest.webmanifest')).json();
  ok(man.display === 'standalone' && man.icons.some(i => i.purpose === 'maskable') && man.icons.some(i => i.sizes === '512x512'), 'manifest correcto');
  for (const u of [...man.icons.map(i => i.src), 'icons/apple-touch-icon.png']) ok((await p.request.get(base + '/' + u)).ok(), 'icono ' + u);
  const links = await p.$$eval('link[rel=apple-touch-startup-image]', l => l.map(x => x.getAttribute('href')));
  for (const u of links) ok((await p.request.get(base + '/' + u)).ok(), 'pantalla de inicio ' + u);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); const assets = [...sw.matchAll(/'((?:js|css|icons)\/[^']+)'/g)].map(m => m[1]);
  const jsFiles = []; const walk = d => fs.readdirSync(path.join(ROOT, d)).forEach(f => { const r = d + '/' + f; fs.statSync(path.join(ROOT, r)).isDirectory() ? walk(r) : jsFiles.push(r); }); walk('js');
  ok(jsFiles.every(f => assets.includes(f)), 'todos los módulos en la caché offline: ' + jsFiles.filter(f => !assets.includes(f)));
  await p.waitForTimeout(600);
  await p.reload(); await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.goto(base + '/index.html#/pasos'); await p.waitForTimeout(800);
  ok((await p.innerText('.page')).includes('21.000'), 'abre sin conexión');
  await p.fill('input[name=n]', '100'); await p.click('button[data-m=set]'); await p.waitForTimeout(200);
  ok((await db('days', today)).steps === 100, 'guarda sin conexión');
  await ctx.setOffline(false);
  // Modo oscuro
  await p.emulateMedia({ colorScheme: 'dark' }); await nav('hoy'); await p.waitForTimeout(200); await shot('20-oscuro');
  await nav('ciclo'); await p.waitForTimeout(200); await shot('21-ciclo-oscuro');
  ok(errs.length === 0, 'sin errores de consola: ' + errs.slice(0, 5).join(' | '));
  console.log(`\n${passed} comprobaciones correctas, ${fails.length} fallos`);
  await b.close(); srv.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('Fallos previos:', fails); process.exit(2); });
