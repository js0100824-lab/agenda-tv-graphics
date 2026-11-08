import * as store from '../modules/store.js';
import * as db from '../modules/firebase.js';
import { createStage } from '../modules/stage.js';
import { SLOTS, TEMPLATES, TEMPLATE_LIST, FONTS, arr, uid, layerOf, instantiate, newText, newImage, newLogo, newShape, newTicker, newClock } from '../modules/templates.js';
import { CATALOG, normAnim, outKey } from '../modules/animations.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const mk$ = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const prev = createStage($('mPrev'), { placeholders: true }), prog = createStage($('mProg'));
const ed = createStage($('mEd'), { placeholders: true, static: true });   // editor propio de la pestaña Diseño (independiente de PREVIEW y PROGRAMA)
let sel = 'headline', tab = 'op', editingH = null, loopOn = false, animElId = null;
let open = new Set(['headline']);   // gráficos abiertos juntos en el editor de Diseño; «sel» es el activo (el que muestran la lista y las propiedades)
const STAGE = { x: 0, y: 0, w: 1920, h: 1080 };

// ---------- Selección: un elemento, varios (Mayús + clic) o un grupo completo ----------
const SEL = {};   // por gráfico: { id: elemento principal, multi: Set de ids, grp: id del grupo seleccionado }
const S = () => SEL[sel] || (SEL[sel] = { id: null, multi: new Set(), grp: null });
const draftOf = () => store.get().draft[sel];
const elsOf = g => arr(g && g.elements);
const grpOf = g => (g && g.groups) || {};
const byId = (g, id) => elsOf(g).find(e => e.id === id);
const curEl = () => { const g = draftOf(); return g && byId(g, S().id); };
const tickerOf = g => { if (!g) return null; const t = elsOf(g).filter(e => e.type === 'ticker'); return t.find(e => e.id === S().id) || t[0] || null; };
const edit = (elId, fn) => store.mutate(sel, g => { const e = g.elements.find(x => x.id === elId); if (e) fn(e, g); });

function deselect() { const s = S(); s.id = null; s.multi = new Set(); s.grp = null; s.none = true; render(store.get()); }   // quita la selección (clic en un espacio vacío)
function selectOne(id) { const s = S(); s.id = id; s.multi = new Set(id ? [id] : []); s.grp = null; render(store.get()); }
function selectGroup(gid) {
  const s = S(), m = elsOf(draftOf()).filter(e => e.group === gid);
  s.grp = gid; s.multi = new Set(m.map(e => e.id)); s.id = m.length ? m[m.length - 1].id : null; render(store.get());
}
function toggleMulti(id) {
  const s = S(); s.grp = null;
  if (s.multi.has(id)) s.multi.delete(id); else s.multi.add(id);
  s.id = s.multi.has(id) ? id : ([...s.multi].pop() || s.id); render(store.get());
}
function fixSel(g) {   // mantiene la selección válida si cambian o desaparecen elementos
  const s = S(), ids = new Set(elsOf(g).map(e => e.id));
  s.multi = new Set([...s.multi].filter(i => ids.has(i)));
  if (s.grp && !elsOf(g).some(e => e.group === s.grp)) s.grp = null;
  if (!ids.has(s.id)) s.id = null;
  if (s.id) s.none = false;
  if (!s.id && !s.none) { const f = elsOf(g).find(e => e.type === 'text') || elsOf(g)[0]; if (f) { s.id = f.id; s.grp = null; s.multi = new Set([f.id]); } }
  if (!s.multi.size && s.id) s.multi.add(s.id);
}
function target() {   // elementos sobre los que actúan mover, escalar y alinear
  const g = draftOf(), s = S(); if (!g) return { els: [], group: null };
  if (s.grp) return { els: elsOf(g).filter(e => e.group === s.grp), group: s.grp };
  const ids = s.multi.size > 1 ? [...s.multi] : [s.id];
  return { els: elsOf(g).filter(e => ids.includes(e.id)), group: null };
}
function isLocked(g, t) {
  const gr = grpOf(g);
  return t.els.some(e => e.locked || (e.group && gr[e.group] && gr[e.group].locked));
}
const bb = els => {
  if (!els.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x0 = Math.min(...els.map(e => +e.x)), y0 = Math.min(...els.map(e => +e.y));
  return { x: x0, y: y0, w: Math.max(...els.map(e => +e.x + +e.w)) - x0, h: Math.max(...els.map(e => +e.y + +e.h)) - y0 };
};
function scaleEl(e, o, bx, by, k) {   // escala un elemento respecto a la esquina (bx,by) a partir de su estado original o
  e.x = Math.round(bx + (o.x - bx) * k); e.y = Math.round(by + (o.y - by) * k);
  e.w = Math.max(1, Math.round(o.w * k)); e.h = Math.max(1, Math.round(o.h * k));
  ['size', 'minSize', 'padX', 'radius', 'sepGap'].forEach(p => { if (o[p] != null && o[p] !== '') e[p] = Math.max(p === 'size' || p === 'minSize' ? 6 : 0, Math.round(o[p] * k)); });
}
function cleanGroups(g) {   // un grupo necesita al menos 2 elementos
  const m = g.groups || (g.groups = {}), cnt = {};
  g.elements.forEach(e => { if (e.group) cnt[e.group] = (cnt[e.group] || 0) + 1; });
  g.elements.forEach(e => { if (e.group && (!m[e.group] || cnt[e.group] < 2)) delete e.group; });
  for (const k in m) if ((cnt[k] || 0) < 2) delete m[k];
}
function activeGroup() { const g = draftOf(), s = S(), e = curEl(); return s.grp || (s.multi.size <= 1 && e && e.group && grpOf(g)[e.group] ? e.group : null); }

$('obsurl').value = new URL('../output/index.html', location.href).href;
db.onStatus(s => { const e = $('status'); e.className = 'status ' + s;
  e.textContent = { local: 'MODO LOCAL (sin Firebase)', connecting: 'Conectando…', online: 'Firebase conectado', offline: 'Sin conexión' }[s]; });

// ---------- Pestañas ----------
function setTab(t) {
  tab = t;
  document.querySelectorAll('#nav a').forEach(x => x.classList.toggle('on', x.dataset.tab === t));
  document.querySelectorAll('.tab').forEach(x => x.hidden = x.id !== 'tab-' + t);
  $('main').classList.toggle('dsg', t === 'design');   // en pantallas grandes Diseño ocupa la pantalla sin desplazar toda la página
  store.setAutoPreview(t !== 'design');   // en Diseño, editar NO enciende el switch de PREVIEW
  hideCtx(); render(store.get());
}
document.querySelectorAll('#nav a').forEach(a => a.onclick = () => setTab(a.dataset.tab));

// ---------- Selector de gráfico y barra en vivo ----------
// ---------- Switches: PROGRAMA (rojo, al aire) y PREVIEW (verde) ----------
function toggleAir(id) { const pg = store.get().program[id]; if (pg && pg.visible) store.hide(id); else store.show(id); }
function toggleView(id) {
  const d = store.get().draft[id]; if (!d) return;
  if (id !== sel) selectSlot(id);
  if (d.visible) store.unpreview(id); else store.preview(id);
}
function selectSlot(id, add) {
  loopOn = false; syncLoopBtns(); prev.stopTest(sel); sel = id;
  if (add && tab === 'design') open.add(id); else open = new Set([id]);
  ['fields', 'animQuick', 'animFull', 'animEl', 'insp'].forEach(i => { $(i).dataset.k = ''; }); render(store.get());
}
function buildEditbar() {
  const box = $('editBtns'), ids = Object.keys(SLOTS), multi = tab === 'design', key = ids.map(id => id + SLOTS[id].name + (id === sel) + (multi && open.has(id))).join('|');
  $('edHint').hidden = !multi;
  if (box.dataset.k === key) return; box.dataset.k = key; box.innerHTML = '';
  ids.forEach(id => {
    const b = mk$('button', 'segb' + (id === sel ? ' on' : multi && open.has(id) ? ' open' : ''), SLOTS[id].name);
    b.onclick = () => {
      if (tab !== 'design') { selectSlot(id); return; }
      if (id === sel && open.size > 1) { open.delete(id); selectSlot([...open].pop(), true); return; }   // cerrar el activo: pasa al último que quedó abierto
      selectSlot(id, true);   // abrir otro gráfico junto a los que ya están abiertos (o activar uno ya abierto)
    };
    box.append(b);
  });
}
function buildAirpad(s) {
  const ids = Object.keys(SLOTS), live = id => !!(s.program[id] && s.program[id].visible), view = id => !!(s.draft[id] && s.draft[id].visible);
  const key = ids.map(id => [id, SLOTS[id].name, live(id), view(id), id === sel].join(':')).join('|'), rows = $('swProg');
  if (rows.dataset.k === key) return; rows.dataset.k = key;
  [['swProg', true], ['swPrev', false]].forEach(([rid, isProg]) => {
    const row = $(rid); row.innerHTML = '';
    ids.forEach(id => {
      const on = isProg ? live(id) : view(id);
      const b = mk$('button', 'sbtn ' + (isProg ? 'prog' : 'prev') + (on ? ' on' : '') + (!isProg && id === sel ? ' sel' : ''), SLOTS[id].name);
      b.onclick = () => isProg ? toggleAir(id) : toggleView(id);
      b.draggable = true;   // arrastrar un botón sobre otro cambia su posición
      b.ondragstart = e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; b.classList.add('drag'); };
      b.ondragend = () => b.classList.remove('drag');
      b.ondragover = e => { e.preventDefault(); b.classList.add('over'); };
      b.ondragleave = () => b.classList.remove('over');
      b.ondrop = e => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (from && from !== id) store.moveSlot(from, ids.indexOf(id)); };
      row.append(b);
    });
  });
  const mg = $('swMgr'); mg.innerHTML = ''; mg.className = 'swmgr';
  mg.append(mk$('p', 'hint', 'Para cambiar el orden, mantén pulsado un gráfico y arrástralo hacia arriba o hacia abajo (en el teléfono, desde las rayitas de la izquierda). Para cambiar su nombre, escribe en su cuadro y pulsa Enter. El orden se guarda y se aplica también en «Editando».'));
  const list = mk$('div', 'mlist'); mg.append(list);
  ids.forEach(id => {
    const r = mk$('div', 'mrow'), inp = mk$('input', 'mname');
    inp.value = SLOTS[id].name; inp.maxLength = 60; inp.title = 'Editar el nombre del gráfico';
    inp.onchange = () => { const n = inp.value.trim(); if (n && n !== SLOTS[id].name) store.renameSlot(id, n); else inp.value = SLOTS[id].name; };
    inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
    r.append(mk$('div', 'grip'), inp);
    if (SLOTS[id].custom) {
      const x = mk$('button', 'danger', 'Eliminar');
      x.onclick = () => { if (confirm(`¿Eliminar el gráfico «${SLOTS[id].name}»? Se borra también su diseño.`)) { if (sel === id) selectSlot('headline'); store.removeSlot(id); } };
      r.append(x);
    }
    list.append(r);
  });
  sortRows(list, ids, (id, to) => store.moveSlot(id, to));
}
// Reordenar filas arrastrando (ratón o dedo): la fila sigue al puntero y las demás se apartan; al soltar se guarda el nuevo orden.
function sortRows(list, ids, onMove) {
  const rows = [...list.children];
  rows.forEach((r, i) => r.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || ev.target.closest('input,button,select')) return;
    if (ev.pointerType === 'touch' && !ev.target.closest('.grip')) return;   // en pantalla táctil solo se arrastra desde las rayitas, para poder desplazar la página
    const rects = rows.map(x => x.getBoundingClientRect()), pitch = rows.length > 1 ? rects[1].top - rects[0].top : rects[0].height, y0 = ev.clientY;
    let to = i; r.setPointerCapture(ev.pointerId); r.classList.add('dragging'); list.classList.add('sorting'); ev.preventDefault();
    const move = e => {
      const dy = Math.max(-i * pitch, Math.min((rows.length - 1 - i) * pitch, e.clientY - y0));
      r.style.transform = `translateY(${dy}px)`; to = Math.max(0, Math.min(rows.length - 1, Math.round(i + dy / pitch)));
      rows.forEach((x, j) => { if (x !== r) x.style.transform = i < to && j > i && j <= to ? `translateY(${-pitch}px)` : i > to && j < i && j >= to ? `translateY(${pitch}px)` : ''; });
    };
    const up = () => {
      r.removeEventListener('pointermove', move); r.removeEventListener('pointerup', up); r.removeEventListener('pointercancel', up);
      rows.forEach(x => { x.style.transform = ''; }); r.classList.remove('dragging'); list.classList.remove('sorting');
      if (to !== i) onMove(ids[i], to);
    };
    r.addEventListener('pointermove', move); r.addEventListener('pointerup', up); r.addEventListener('pointercancel', up);
  }));
}
$('edRename').onclick = () => { const n = (prompt('Nuevo nombre del gráfico:', SLOTS[sel].name) || '').trim(); if (n) store.renameSlot(sel, n); };
$('slotAdd').onclick = () => {
  const name = (prompt('Nombre del nuevo gráfico (por ejemplo: Marcador, Reloj, Logo):') || '').trim(); if (!name) return;
  selectSlot(store.addSlot(name));   // nuevo gráfico en blanco: aparece en los switches; se diseña en Diseño o Plantillas
};
let swOpen = false;
$('swToggle').onclick = () => {
  swOpen = !swOpen; $('opMain').hidden = swOpen; $('swPanel').hidden = !swOpen; $('swToggle').textContent = swOpen ? 'Cerrar switches' : 'Abrir switches';
};
function newBlankGraphic() {   // crea OTRO gráfico vacío; el gráfico seleccionado no se toca
  const name = (prompt('Nombre del nuevo gráfico en blanco:', 'Gráfico ' + (Object.keys(SLOTS).length + 1)) || '').trim(); if (!name) return null;
  const id = store.addSlot(name); selectSlot(id); if (tab !== 'design') store.preview(id); return id;
}
$('tBlank').onclick = newBlankGraphic;
function buildLive(s) {
  const box = $('liveBar'), tk = tickerOf(s.draft[sel]);
  if (!tk) { box.hidden = true; return; }
  box.hidden = false;
  const pg = s.program[sel], src = (pg && pg.visible && arr(pg.elements).find(e => e.id === tk.id)) || tk;
  const paused = !!src.paused, on = src.on !== false;
  const html = `<span>CINTILLA «${esc(tk.name)}» (EN VIVO)</span><button id="lvP">${paused ? 'Reanudar' : 'Pausar'}</button><button id="lvO" class="${on ? 'danger' : 'go'}">${on ? 'Ocultar cintilla' : 'Activar cintilla'}</button>`;
  if (box.dataset.k === html) return; box.dataset.k = html; box.innerHTML = html;
  $('lvP').onclick = () => store.live(sel, tk.id, { paused: !paused });
  $('lvO').onclick = () => store.live(sel, tk.id, { on: !on });
}

// ---------- Pestaña Operación ----------
function syncContent(g) {
  const texts = elsOf(g).filter(e => e.type === 'text'), box = $('fields');
  const key = sel + ':' + texts.map(e => e.id).join(',');
  if (box.dataset.k !== key) {
    box.dataset.k = key; box.innerHTML = '';
    texts.forEach(e => { const t = mk$('textarea'); t.rows = 2; t.dataset.id = e.id; t.oninput = () => edit(e.id, x => { x.text = t.value; }); box.append(mk$('label', '', e.name || 'Texto'), t); });
    if (!texts.length) box.innerHTML = '<p class="hint">Este gráfico no tiene cuadros de texto. Puedes añadirlos en la pestaña Diseño.</p>';
  }
  box.querySelectorAll('textarea').forEach(t => { const e = texts.find(x => x.id === t.dataset.id); if (e && document.activeElement !== t) t.value = e.text ?? ''; });
}
$('bPrev').onclick = () => store.preview(sel);
$('bUpd').onclick = () => store.update(sel);
$('bClr').onclick = () => { store.clearDraft(sel); $('fields').dataset.k = ''; render(store.get()); };

// ---------- Animaciones: configuración y previsualización ----------
const inOpts = () => Object.entries(CATALOG).filter(([, c]) => c.only !== 'out').map(([k, c]) => [k, c.label]);
const outOpts = () => [['auto', 'Automática (inversa de la entrada)'], ...Object.entries(CATALOG).filter(([, c]) => c.only !== 'in').map(([k, c]) => [k, c.label])];

// scope 'g': ajustes del gráfico · scope 'e': ajustes propios de un elemento (vacío = heredar del gráfico)
function animFields(box, scope, el, full) {
  const inh = scope === 'e', ga = normAnim((draftOf() || {}).anim), ov = (el && el.anim) || {};
  const inKey = inh && ov.in && CATALOG[ov.in] ? ov.in : ga.in;
  const eff = { in: inKey, out: inh && ov.out ? ov.out : ga.out };
  const dIn = (CATALOG[inKey] || {}).dirs, dOut = (CATALOG[outKey(eff)] || {}).dirs, H = inh ? [['', 'Heredar del gráfico']] : [];
  const set = (p, v) => scope === 'g' ? store.mutate(sel, g => { g.anim = { ...g.anim, [p]: v }; }) : edit(el.id, e => { e.anim = { ...(e.anim || {}), [p]: v }; });
  const F = (p, label, kind, opt) => {
    const w = mk$('div', 'f'); w.append(mk$('label', '', label)); let i;
    if (kind === 'sel') { i = mk$('select'); opt.forEach(([v, t]) => { const o = mk$('option', '', t); o.value = v; i.append(o); }); }
    else { i = mk$('input'); i.type = 'number'; Object.entries(opt || {}).forEach(([k, v]) => i.setAttribute(k, v)); if (inh) i.placeholder = 'heredar'; }
    i.dataset.ap = p; i.dataset.sc = scope;
    i.onchange = i.oninput = () => {
      let v = i.value;
      if (kind === 'num') { if (v === '') { if (!inh) return; } else if (isNaN(+v)) return; else v = +v; }
      set(p, v);
    };
    w.append(i); box.append(w);
  };
  if (full && !inh) F('mode', 'Animar', 'sel', [['group', 'Grupo completo (todo a la vez)'], ['elements', 'Elementos individuales (uno por uno)']]);
  F('in', 'Animación de entrada', 'sel', [...H, ...inOpts()]);
  if (dIn) F('dirIn', 'Dirección de entrada', 'sel', [['', inh ? 'Heredar' : 'Predeterminada'], ...dIn]);
  F('out', 'Animación de salida', 'sel', [...H, ...outOpts()]);
  if (dOut) F('dirOut', 'Dirección de salida', 'sel', [['', inh ? 'Heredar' : 'Igual que la entrada'], ...dOut]);
  F('inDur', 'Duración de entrada (ms)', 'num', { min: 50, max: 10000, step: 50 });
  F('outDur', 'Duración de salida (ms)', 'num', { min: 50, max: 10000, step: 50 });
  if (full) {
    F('inDelay', 'Retardo de entrada (ms)', 'num', { min: 0, max: 10000, step: 50 });
    F('outDelay', 'Retardo de salida (ms)', 'num', { min: 0, max: 10000, step: 50 });
    if (!inh) F('speed', 'Velocidad (1 = normal)', 'num', { min: .25, max: 4, step: .25 });
    if (!inh && ga.mode === 'elements') F('stagger', 'Desfase entre elementos (ms)', 'num', { min: 0, max: 2000, step: 20 });
  }
}
function syncAnim(box, a, el) {
  box.querySelectorAll('[data-ap]').forEach(i => {
    if (document.activeElement === i) return;
    const p = i.dataset.ap; i.value = (i.dataset.sc === 'e' ? ((el && el.anim && el.anim[p]) ?? '') : a[p]) ?? '';
  });
}
function renderAnim(box, g, full) {
  const a = normAnim(g.anim), key = [sel, full, a.mode, a.in, a.out].join('|');
  if (box.dataset.k !== key) { box.dataset.k = key; box.innerHTML = ''; const gr = mk$('div', full ? 'grid2' : 'grid1'); animFields(gr, 'g', null, full); box.append(gr); }
  syncAnim(box, a, null);
}
function renderAnimEl(box, g) {
  const a = normAnim(g.anim);
  if (a.mode !== 'elements') {
    if (box.dataset.k !== 'off') { box.dataset.k = 'off'; box.innerHTML = '<p class="hint">Elige «Elementos individuales» en «Animar» para dar a cada elemento su propia animación, retardo y duración.</p>'; }
    return;
  }
  const els = elsOf(g); if (!els.some(e => e.id === animElId)) animElId = (els[0] || {}).id;
  const el = els.find(e => e.id === animElId), ov = (el && el.anim) || {};
  const key = ['on', sel, animElId, ov.in || '', ov.out || '', a.in, a.out, els.map(e => e.id).join()].join('|');
  if (box.dataset.k !== key) {
    box.dataset.k = key; box.innerHTML = '';
    const pick = mk$('select'); els.forEach(e => { const o = mk$('option', '', `${e.name || e.type}${e.group ? ' (en grupo)' : ''}`); o.value = e.id; pick.append(o); });
    pick.value = animElId; pick.onchange = () => { animElId = pick.value; box.dataset.k = ''; render(store.get()); };
    const gr = mk$('div', 'grid2'); box.append(mk$('label', '', 'Elemento'), pick, gr); if (el) animFields(gr, 'e', el, true);
  }
  syncAnim(box, a, el);
}
$('animMore').ontoggle = () => render(store.get());   // pinta la animación avanzada al abrirla
const syncLoopBtns = () => document.querySelectorAll('[data-pv="loop"]').forEach(b => b.classList.toggle('on', loopOn));
async function playTest(mode) { loopOn = false; syncLoopBtns(); prev.stopTest(sel); await prev.test(sel, mode); }
async function toggleLoop() {
  if (loopOn) { loopOn = false; syncLoopBtns(); prev.stopTest(sel); return; }
  loopOn = true; syncLoopBtns(); const id = sel;
  while (loopOn && sel === id) { if (!(await prev.test(id, 'both'))) break; await new Promise(r => setTimeout(r, 500)); }
  loopOn = false; syncLoopBtns();
}
document.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => b.dataset.pv === 'loop' ? toggleLoop() : playTest(b.dataset.pv));

// ---------- Imágenes (PNG / JPG / WebP) ----------
function pickImage(cb, maxSide = 800, maxLen = 3e6) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { alert('Formato no permitido. Usa PNG, JPG o WebP.'); return; }
    const url = URL.createObjectURL(f);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      let k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight)), src = '';
      for (let i = 0; i < 5; i++) {   // si pesa demasiado se reduce poco a poco
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
        src = c.toDataURL(f.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .9);   // PNG/WebP conservan transparencia
        if (src.length <= maxLen) break; k *= .75;
      }
      if (src.length > maxLen) { alert('La imagen es demasiado pesada. Usa una más pequeña.'); return; }
      cb({ src, ar: img.naturalWidth / img.naturalHeight });
    } catch { alert('No se pudo leer la imagen.'); } finally { URL.revokeObjectURL(url); }
  };
  inp.click();
}
const applyImage = (id, r, resize) => edit(id, e => { e.src = r.src; e.ar = r.ar; if (resize) e.h = Math.max(10, Math.round(e.w / r.ar)); });

// ---------- Pestaña Diseño: lista, altas y propiedades ----------
const TYPE = { text: 'Texto', clock: 'Reloj', image: 'Imagen', shape: 'Forma', ticker: 'Cintilla' };
function renderList(g) {
  const box = $('elList'), els = elsOf(g), s = S(), groups = grpOf(g);
  const key = [sel, s.id, s.grp, [...s.multi].join(), els.map(e => [e.id, e.name, e.on === false, e.group, e.locked].join(':')).join(),
    Object.entries(groups).map(([k, v]) => k + v.name + v.locked).join()].join('|');
  if (box.dataset.k === key) return; box.dataset.k = key; box.innerHTML = '';
  const rev = els.slice().reverse(), done = new Set();
  const row = (e, child, into) => {
    const r = mk$('div', 'erow' + (child ? ' child' : '') + (s.multi.has(e.id) ? (s.grp ? ' in' : ' on') : '') + (e.on === false ? ' off' : ''));
    r.append(mk$('span', 'etype', TYPE[e.type] || ''), mk$('span', 'ename', e.name || e.type)); if (e.locked) r.append(mk$('span', 'etag', 'Bloqueado'));
    r.onclick = ev => { if (ev.shiftKey || ev.ctrlKey || ev.metaKey) toggleMulti(e.id); else selectOne(e.id); }; into.append(r);
  };
  rev.forEach(e => {
    if (e.group && groups[e.group]) {
      if (done.has(e.group)) return; done.add(e.group);
      const m = rev.filter(x => x.group === e.group), meta = groups[e.group];
      const h = mk$('div', 'erow grp' + (s.grp === e.group ? ' on' : ''));
      h.append(mk$('span', 'etype', 'Grupo'), mk$('span', 'ename', `${meta.name || 'Grupo'} (${m.length})`)); if (meta.locked) h.append(mk$('span', 'etag', 'Bloqueado'));
      const wrap = mk$('div', 'egrp'); h.onclick = () => selectGroup(e.group); wrap.append(h); m.forEach(x => row(x, true, wrap)); box.append(wrap);
    } else row(e, false, box);
  });
}
$('elList').onclick = ev => { if (ev.target === $('elList')) deselect(); };   // clic en el espacio vacío de la lista
const addEl = e => { store.mutate(sel, g => g.elements.push(e)); selectOne(e.id); };
const ADDERS = { text: newText, clock: newClock, logo: newLogo, image: newImage, shape: newShape, ticker: newTicker };
function addAt(kind, pt) {   // añade un elemento; con pt (clic derecho) queda centrado en ese punto
  const e = ADDERS[kind]();
  if (pt && kind !== 'ticker') { e.x = Math.round(Math.max(0, Math.min(1920 - e.w, pt.x - e.w / 2))); e.y = Math.round(Math.max(0, Math.min(1080 - e.h, pt.y - e.h / 2))); }
  addEl(e); if (kind === 'logo' || kind === 'image') pickImage(r => applyImage(e.id, r, true));
}
$('addText').onclick = () => addAt('text'); $('addClock').onclick = () => addAt('clock'); $('addShape').onclick = () => addAt('shape'); $('addTicker').onclick = () => addAt('ticker');
$('addLogo').onclick = () => addAt('logo'); $('addImg').onclick = () => addAt('image');
$('tSave').onclick = () => {
  const name = $('tName').value.trim(), g = draftOf(); if (!name) { alert('Escribe un nombre para la plantilla.'); return; }
  store.saveTemplate({ name, desc: 'Plantilla personalizada', elements: clone(g.elements), groups: clone(g.groups || {}), anim: clone(g.anim) }); $('tName').value = '';
};

// ---------- Grupos, bloqueo y alineación ----------
$('gAll').onclick = () => { const s = S(), ids = elsOf(draftOf()).filter(e => e.on !== false).map(e => e.id); s.grp = null; s.multi = new Set(ids); s.id = ids[ids.length - 1] || null; render(store.get()); };
$('gGroup').onclick = () => {
  const ids = [...S().multi]; if (ids.length < 2) { alert('Selecciona al menos 2 elementos (Mayús + clic en la lista o en el editor).'); return; }
  const gid = uid();
  store.mutate(sel, g => {
    g.groups = g.groups || {}; g.groups[gid] = { name: 'Grupo ' + (Object.keys(g.groups).length + 1), locked: false };
    g.elements.forEach(e => { if (ids.includes(e.id)) e.group = gid; }); cleanGroups(g);
  });
  selectGroup(gid);
};
$('gUngroup').onclick = () => {
  const gid = activeGroup(); if (!gid) return;
  const ids = elsOf(draftOf()).filter(e => e.group === gid).map(e => e.id);
  store.mutate(sel, g => { g.elements.forEach(e => { if (e.group === gid) delete e.group; }); if (g.groups) delete g.groups[gid]; });
  const s = S(); s.grp = null; s.multi = new Set(ids); render(store.get());
};
$('gDup').onclick = () => {
  const gid = activeGroup(); if (!gid) return; const ngid = uid();
  store.mutate(sel, g => {
    const meta = (g.groups || {})[gid] || {}; g.groups = g.groups || {}; g.groups[ngid] = { name: (meta.name || 'Grupo') + ' (copia)', locked: false };
    g.elements.filter(e => e.group === gid).forEach(e => { const c = clone(e); c.id = uid(); c.group = ngid; c.x += 30; c.y += 30; g.elements.push(c); });
  });
  selectGroup(ngid);
};
$('gLock').onclick = () => {
  const s = S();
  if (s.grp) store.mutate(sel, g => { const m = (g.groups || {})[s.grp]; if (m) m.locked = !m.locked; }, { preview: false });
  else { const t = target(), lock = !t.els.some(e => e.locked); store.mutate(sel, g => g.elements.forEach(e => { if (t.els.some(x => x.id === e.id)) e.locked = lock; }), { preview: false }); }
};
$('gName').oninput = () => { const gid = S().grp; if (gid) store.mutate(sel, g => { if (g.groups && g.groups[gid]) g.groups[gid].name = $('gName').value; }); };

const ALIGNS = [['left', 'Izquierda'], ['hc', 'Centro H'], ['right', 'Derecha'], ['top', 'Arriba'], ['vc', 'Centro V'], ['bottom', 'Abajo']];
const ALIGN = {
  left: (r, R) => ({ dx: R.x - r.x }), hc: (r, R) => ({ dx: R.x + R.w / 2 - (r.x + r.w / 2) }), right: (r, R) => ({ dx: R.x + R.w - (r.x + r.w) }),
  top: (r, R) => ({ dy: R.y - r.y }), vc: (r, R) => ({ dy: R.y + R.h / 2 - (r.y + r.h / 2) }), bottom: (r, R) => ({ dy: R.y + R.h - (r.y + r.h) })
};
function align(mode) {
  const t = target(), g = draftOf(); if (!t.els.length || isLocked(g, t)) return;
  const multi = !t.group && t.els.length > 1, ref = multi && $('alignRef').value === 'sel' ? bb(t.els) : STAGE;
  store.mutate(sel, g2 => {
    const els = g2.elements.filter(e => t.els.some(x => x.id === e.id));
    const move = (list, r) => { const d = ALIGN[mode](r, ref); list.forEach(e => { e.x = Math.round(e.x + (d.dx || 0)); e.y = Math.round(e.y + (d.dy || 0)); }); };
    if (multi) els.forEach(e => move([e], e)); else move(els, bb(els));   // un grupo o un elemento se alinea como una sola pieza
  });
}
function distribute(axis) {
  const t = target(), g = draftOf();
  if (t.group || t.els.length < 3) { alert('Selecciona 3 o más elementos sueltos (Mayús + clic) para distribuirlos.'); return; }
  if (isLocked(g, t)) return;
  store.mutate(sel, g2 => {
    const P = axis === 'h' ? ['x', 'w'] : ['y', 'h'], els = g2.elements.filter(e => t.els.some(x => x.id === e.id)).sort((a, b) => a[P[0]] - b[P[0]]);
    const first = els[0], lastE = els[els.length - 1], span = lastE[P[0]] + lastE[P[1]] - first[P[0]], total = els.reduce((s, e) => s + e[P[1]], 0);
    const gap = (span - total) / (els.length - 1); let pos = first[P[0]];
    els.forEach(e => { e[P[0]] = Math.round(pos); pos += e[P[1]] + gap; });
  });
}
(() => {
  const bar = $('alignBar'), add = (t, f) => { const b = mk$('button', '', t); b.onclick = f; bar.append(b); };
  ALIGNS.forEach(([m, t]) => add(t, () => align(m))); add('Distribuir H', () => distribute('h')); add('Distribuir V', () => distribute('v'));
})();
function renderSelUI(g) {
  const t = target(), s = S(), meta = s.grp ? grpOf(g)[s.grp] : null, e1 = curEl(), ag = activeGroup();
  $('selInfo').textContent = meta ? `Grupo «${meta.name}» · ${t.els.length} elementos` : t.els.length > 1 ? `${t.els.length} elementos seleccionados (Mayús + clic para añadir o quitar)`
    : e1 ? `Elemento: ${e1.name || e1.type}${e1.group ? ' (dentro de un grupo)' : ''}` : 'Sin selección';
  $('gGroup').disabled = !(t.els.length > 1 && !t.group); $('gUngroup').disabled = $('gDup').disabled = !ag;
  const lk = s.grp ? !!(meta || {}).locked : t.els.some(e => e.locked);
  $('gLock').textContent = lk ? 'Desbloquear' : 'Bloquear';
  const gn = $('gName'); gn.hidden = !s.grp; if (s.grp && document.activeElement !== gn) gn.value = (meta || {}).name || '';
  $('alignRef').hidden = !(t.els.length > 1 && !t.group);
}

function setProp(id, p, v) {
  edit(id, e => {
    const ow = e.w, oh = e.h; e[p] = v;
    if (e.type === 'image' && e.lock !== false && ow && oh) { if (p === 'w') e.h = Math.max(1, Math.round(v * oh / ow)); if (p === 'h') e.w = Math.max(1, Math.round(v * ow / oh)); }
  });
}
function mk(spec, id) {
  const [p, label, type, opt] = spec, w = mk$('div', 'f' + (type === 'area' ? ' wide' : ''));
  if (type === 'check') { const l = mk$('label', 'chk'), i = mk$('input'); i.type = 'checkbox'; i.dataset.p = p; i.dataset.t = type; i.onchange = () => setProp(id, p, i.checked); l.append(i, ' ' + label); w.append(l); return w; }
  w.append(mk$('label', '', label));
  if (type === 'coloropt') {
    const r = mk$('div', 'row'), c = mk$('input'), k = mk$('input'); c.type = 'checkbox'; k.type = 'color'; r.dataset.p = p; r.dataset.t = type;
    const u = () => setProp(id, p, c.checked ? k.value : ''); c.onchange = u; k.oninput = () => { c.checked = true; u(); }; r.append(c, k); w.append(r); return w;
  }
  let i;
  if (type === 'select') { i = mk$('select'); opt.forEach(([v, t]) => { const o = mk$('option', '', t); o.value = v; i.append(o); }); }
  else if (type === 'area') { i = mk$('textarea'); i.rows = 2; }
  else { i = mk$('input'); i.type = type === 'num' ? 'number' : type === 'color' ? 'color' : 'text'; if (opt && !Array.isArray(opt)) for (const k in opt) i.setAttribute(k, opt[k]); }
  i.dataset.p = p; i.dataset.t = type;
  i.oninput = i.onchange = () => {
    let v = i.value;
    if (type === 'num') { if (v === '' || isNaN(+v)) return; v = +v; if ((p === 'w' || p === 'h') && v < 10) return; }
    else if (type === 'select' && v !== '' && !isNaN(+v)) v = +v;
    setProp(id, p, v);
  };
  w.append(i); return w;
}
const GEO = [['x', 'X (px)', 'num'], ['y', 'Y (px)', 'num'], ['w', 'Ancho (px)', 'num', { min: 10 }], ['h', 'Alto (px)', 'num', { min: 10 }]];
const WEIGHTS = [[400, 'Normal'], [600, 'Seminegrita'], [700, 'Negrita'], [800, 'Extranegrita']], FONTSEL = FONTS.map(f => [f, f]);
const SECTIONS = {
  clock: [['Reloj (hora de República Dominicana)', [['fmt', 'Mostrar', 'select', [['hm', 'Hora y minutos'], ['hms', 'Hora, minutos y segundos']]], ['h12', 'Formato de 12 horas (AM / PM)', 'check']]],
    ['Tipografía', [['font', 'Tipografía', 'select', FONTSEL], ['size', 'Tamaño máximo (px)', 'num', { min: 6, max: 400 }], ['minSize', 'Tamaño mínimo (px)', 'num', { min: 6, max: 400 }],
      ['weight', 'Grosor', 'select', WEIGHTS], ['autofit', 'Ajuste automático al cuadro', 'check']]],
    ['Alineación y márgenes', [['align', 'Alineación', 'select', [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]],
      ['valign', 'Alineación vertical', 'select', [['top', 'Arriba'], ['middle', 'Centro'], ['bottom', 'Abajo']]], ['padX', 'Margen lateral (px)', 'num', { min: 0 }]]],
    ['Colores', [['color', 'Color del texto', 'color'], ['bg', 'Color de fondo', 'coloropt']]]],
  text: [['Contenido', [['text', 'Texto', 'area']]],
    ['Tipografía', [['font', 'Tipografía', 'select', FONTSEL], ['size', 'Tamaño máximo (px)', 'num', { min: 6, max: 400 }], ['minSize', 'Tamaño mínimo (px)', 'num', { min: 6, max: 400 }],
      ['weight', 'Grosor', 'select', WEIGHTS], ['upper', 'Mayúsculas', 'check'], ['autofit', 'Ajuste automático del texto', 'check']]],
    ['Alineación y márgenes', [['align', 'Alineación', 'select', [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]],
      ['valign', 'Alineación vertical', 'select', [['top', 'Arriba'], ['middle', 'Centro'], ['bottom', 'Abajo']]], ['padX', 'Margen lateral (px)', 'num', { min: 0 }], ['lh', 'Interlineado', 'num', { min: .8, max: 2, step: .05 }]]],
    ['Colores', [['color', 'Color del texto', 'color'], ['bg', 'Color de fondo', 'coloropt']]]],
  image: [['Imagen', [['fit', 'Ajuste', 'select', [['contain', 'Mantener proporciones'], ['cover', 'Rellenar (recorta)']]], ['opacity', 'Opacidad', 'num', { min: 0, max: 1, step: .05 }],
      ['radius', 'Redondeo (px)', 'num', { min: 0 }], ['lock', 'Bloquear proporciones al redimensionar', 'check']]], ['Colores', [['bg', 'Color de fondo', 'coloropt']]]],
  shape: [['Forma', [['color', 'Color', 'color'], ['opacity', 'Opacidad', 'num', { min: 0, max: 1, step: .05 }], ['radius', 'Redondeo (px)', 'num', { min: 0 }]]]],
  ticker: [['Movimiento', [['speed', 'Velocidad (px/s)', 'num', { min: 10, max: 1000, step: 10 }], ['dir', 'Dirección', 'select', [['left', 'Hacia la izquierda'], ['right', 'Hacia la derecha']]]]],
    ['Texto', [['font', 'Tipografía', 'select', FONTSEL], ['size', 'Tamaño de letra (px)', 'num', { min: 10, max: 200 }], ['weight', 'Grosor', 'select', WEIGHTS], ['upper', 'Mayúsculas', 'check']]],
    ['Colores', [['color', 'Color del texto', 'color'], ['bg', 'Color de fondo', 'color']]],
    ['Separador entre noticias', [['sep', 'Separador', 'text', { list: 'sepList' }], ['sepColor', 'Color del separador', 'color'], ['sepGap', 'Espacio alrededor (px)', 'num', { min: 0 }]]],
    ['Etiqueta izquierda', [['label', 'Texto (vacío = sin etiqueta)', 'text'], ['labelBg', 'Fondo de la etiqueta', 'color'], ['labelColor', 'Color del texto', 'color']]]]
};
const grid = (specs, id) => { const d = mk$('div', 'gx'); specs.forEach(s => d.append(mk(s, id))); return d; };
const card = (title, body) => { const c = mk$('div', 'dcard'); c.append(mk$('h3', '', title), body); return c; };

// Las noticias se pegan en un solo cuadro. Se separan por Enter, | o •; en modo automático también al final de cada frase.
const ABBR = new Set(['ee', 'uu', 'sr', 'sra', 'srta', 'dr', 'dra', 'lic', 'ing', 'arq', 'prof', 'av', 'no', 'núm', 'num', 'etc', 'pág', 'tel', 'gral', 'cnel', 'art', 'ud', 'uds']);
function sentences(text) {
  const out = [], re = /([.!?]+)\s+(?=[A-ZÁÉÍÓÚÜÑ0-9¿¡"«“(])/g; let start = 0, m;
  while ((m = re.exec(text))) {
    const w = (text.slice(start, m.index).match(/(\S+)$/) || [''])[0];
    if (m[1] === '.' && (/^[A-ZÁÉÍÓÚÜÑ]$/.test(w) || ABBR.has(w.toLowerCase().replace(/\./g, '')))) continue;   // iniciales y abreviaturas
    out.push(text.slice(start, m.index + m[1].length)); start = m.index + m[0].length;
  }
  out.push(text.slice(start)); return out;
}
const parseNews = (raw, mode = 'auto') => {
  const base = String(raw || '').split(/\r?\n|\||•|●|◆|■|★|\/\//).map(x => x.trim()).filter(Boolean);
  return mode === 'lines' ? base : base.flatMap(sentences).map(x => x.trim()).filter(Boolean);
};
function buildNews(e) {
  const w = mk$('div'), t = mk$('textarea'), sp = mk$('select'), n = mk$('p', 'hint'), list = mk$('div', 'nlist');
  t.rows = 6; t.dataset.raw = '1'; t.placeholder = 'Pega aquí el texto de la cintilla, con todas las noticias seguidas…';
  const set = (x, raw, mode) => { x.raw = raw; x.split = mode; x.items = parseNews(raw, mode); };
  t.oninput = () => edit(e.id, x => set(x, t.value, x.split || 'auto'));
  [['auto', 'Automático: Enter, | , • y fin de frase'], ['lines', 'Solo con Enter, | o •']].forEach(([v, l]) => { const o = mk$('option', '', l); o.value = v; sp.append(o); });
  sp.dataset.split = '1'; sp.onchange = () => edit(e.id, x => set(x, x.raw ?? arr(x.items).join('\n'), sp.value));
  n.dataset.cnt = '1'; list.dataset.list = '1';
  w.append(t, mk$('label', '', 'Cómo separar las noticias'), sp, n, list);
  return w;
}
function buildActions(e) {
  const a = mk$('div', 'arow'), b = (t, f, c) => { const x = mk$('button', c || '', t); x.onclick = f; a.append(x); return x; };
  if (e.type === 'image') { b('Subir / cambiar imagen', () => pickImage(r => applyImage(e.id, r, false)), 'go'); b('Quitar imagen', () => edit(e.id, x => { x.src = ''; })); }
  b('Duplicar', () => { const c = clone(e); c.id = uid(); delete c.group; c.name = (e.name || e.type) + ' (copia)'; c.x += 30; c.y += 30; addEl(c); });
  b('Traer al frente', () => moveZ(1)); b('Enviar atrás', () => moveZ(-1));
  b('Eliminar', () => { store.mutate(sel, g => { g.elements = g.elements.filter(x => x.id !== e.id); cleanGroups(g); }); S().id = null; render(store.get()); }, 'danger');
  return a;
}
function moveZ(d) {
  store.mutate(sel, g => { const i = g.elements.findIndex(e => e.id === S().id), j = i + d; if (i < 0 || j < 0 || j >= g.elements.length) return; [g.elements[i], g.elements[j]] = [g.elements[j], g.elements[i]]; });
}
const TEXFIT = [['cover', 'Rellenar (recorta lo que sobre)'], ['contain', 'Ajustar completa'], ['stretch', 'Estirar a la forma'], ['tile', 'Mosaico (repetir)']];
function buildTexture(e) {   // carga una imagen dentro de la forma o del cuadro de texto
  const w = mk$('div'), st = mk$('p', 'hint'), row = mk$('div', 'arow');
  st.dataset.tex = '1';
  const up = mk$('button', 'go', 'Cargar textura'), rm = mk$('button', '', 'Quitar textura');
  up.onclick = () => pickImage(r => edit(e.id, x => { x.tex = r.src; if (!x.texFit) x.texFit = 'cover'; }), 1000, 1.5e6);
  rm.onclick = () => edit(e.id, x => { delete x.tex; });
  row.append(up, rm); w.append(st, row, grid([['texFit', 'Ajuste de la textura', 'select', TEXFIT], ['texScale', 'Tamaño del mosaico (px)', 'num', { min: 8, max: 2000 }]], e.id));
  return card('Textura', w);
}
function renderInsp(box, e, kind) {
  if (!e) { box.dataset.k = ''; box.innerHTML = '<p class="hint">Selecciona un elemento.</p>'; return; }
  const key = [sel, kind, e.id, e.type].join('|');
  if (box.dataset.k !== key) {
    box.dataset.k = key; box.innerHTML = '';
    const head = mk$('div', 'dhead'); head.append(mk$('span', 'dtype', TYPE[e.type] || ''), mk$('b', '', e.name || e.type)); box.append(head);
    if (kind !== 'ticker') box.append(card('General', grid([['name', 'Nombre', 'text'], ['on', 'Visible', 'check'], ['locked', 'Bloquear posición', 'check']], e.id)));
    if (e.type === 'ticker') { const nc = card('Noticias', buildNews(e)); nc.classList.add('span'); box.append(nc); }   // las noticias también se editan aquí, en Diseño
    box.append(card(kind === 'ticker' ? 'Altura y posición de la cinta' : 'Posición y tamaño', grid(GEO, e.id)));
    (SECTIONS[e.type] || []).forEach(([t, specs]) => box.append(card(t, grid(specs, e.id))));
    if (e.type === 'shape' || e.type === 'text' || e.type === 'clock') box.append(buildTexture(e));
    if (kind !== 'ticker') box.append(buildActions(e));
  }
  box.querySelectorAll('[data-p]').forEach(i => {
    const p = i.dataset.p, t = i.dataset.t, v = e[p];
    if (t === 'coloropt') { const [c, k] = i.children; c.checked = !!v; if (v) k.value = v; return; }
    if (document.activeElement === i) return;
    if (t === 'check') i.checked = !!v; else i.value = (p === 'texFit' && !v) ? 'cover' : (p === 'texScale' && !v) ? 200 : (v ?? '');
  });
  box.querySelectorAll('[data-tex]').forEach(n => { n.textContent = e.tex ? 'Textura cargada. Se ve dentro del elemento; el color queda de fondo.' : 'Sin textura. Carga una imagen (PNG, JPG o WebP) para rellenar este elemento.'; });
  box.querySelectorAll('[data-raw]').forEach(t => { if (document.activeElement !== t) t.value = e.raw ?? arr(e.items).join('\n'); });
  box.querySelectorAll('[data-split]').forEach(i => { if (document.activeElement !== i) i.value = e.split || 'auto'; });
  box.querySelectorAll('[data-list]').forEach(d => {   // lista de noticias detectadas, para ver dónde termina cada una
    const items = arr(e.items), k = items.join('\u0001'); if (d.dataset.k === k) return; d.dataset.k = k; d.innerHTML = '';
    items.forEach((t, i) => { const r = mk$('div', 'nitem'); r.append(mk$('b', '', String(i + 1)), mk$('span', '', t)); d.append(r); });
  });
  box.querySelectorAll('[data-cnt]').forEach(n => { const c = arr(e.items).length; n.textContent = c === 1 ? '1 noticia detectada' : `${c} noticias detectadas`; });
}
function groupGeo(p, v) {   // X / Y / Ancho / Alto de un grupo o selección múltiple (el tamaño mantiene proporciones)
  if (!isFinite(v)) return; const t = target(), g = draftOf(); if (!t.els.length || isLocked(g, t)) return;
  const snap = t.els.map(clone), b = bb(snap);
  store.mutate(sel, g2 => snap.forEach(o => {
    const e = byId(g2, o.id); if (!e) return;
    if (p === 'x') e.x = Math.round(o.x + v - b.x); else if (p === 'y') e.y = Math.round(o.y + v - b.y);
    else scaleEl(e, o, b.x, b.y, Math.max(.05, p === 'w' ? v / b.w : v / b.h));
  }));
}
function renderMultiInsp(box, t) {
  const key = ['mul', sel, t.group || '', t.els.map(e => e.id).join()].join('|');
  if (box.dataset.k !== key) {
    box.dataset.k = key; box.innerHTML = '';
    box.append(mk$('h3', '', t.group ? 'Grupo' : 'Selección múltiple'),
      mk$('p', 'hint', 'Mover, redimensionar (mantiene proporciones) y alinear actúan sobre toda la composición. Doble clic en el editor (o clic en el elemento de la lista) para editar un elemento suelto.'));
    const gr = mk$('div', 'grid2');
    [['x', 'X (px)'], ['y', 'Y (px)'], ['w', 'Ancho (px)'], ['h', 'Alto (px)']].forEach(([p, l]) => { const w = mk$('div', 'f'), i = mk$('input'); i.type = 'number'; i.dataset.gp = p; i.onchange = () => groupGeo(p, +i.value); w.append(mk$('label', '', l), i); gr.append(w); });
    box.append(gr);
  }
  const b = bb(t.els); box.querySelectorAll('[data-gp]').forEach(i => { if (document.activeElement !== i) i.value = Math.round(b[i.dataset.gp]); });
}
function renderTickerTab(g) {
  const box = $('tkInsp'), tk = tickerOf(g);
  if (!tk) {
    if (box.dataset.k !== 'none') { box.dataset.k = 'none'; box.innerHTML = '<p class="hint">Este gráfico no tiene cintilla.</p>'; const b = mk$('button', 'go', 'Añadir cintilla a este gráfico'); b.onclick = () => addEl(newTicker()); box.append(b); }
    return;
  }
  renderInsp(box, tk, 'ticker');
}

// ---------- Selección y movimiento directo en el editor ----------
const ovl = mk$('div', 'ovl'), lbl = mk$('div', 'lbl'), hd = mk$('div', 'hd'), hov = mk$('div', 'hov'), pool = [];
ovl.append(lbl, hd); ed.el.append(ovl, hov);
function outline(i, r) {
  let d = pool[i]; if (!d) { d = mk$('div', 'ovl2'); ed.el.append(d); pool[i] = d; }
  Object.assign(d.style, { display: 'block', left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
}
function drawOvl() {
  ed.el.style.setProperty('--s', (1 / ed.scale()).toFixed(3));   // bordes, etiqueta y tirador conservan un tamaño cómodo en pantalla (también en teléfono)
  const g = draftOf(), t = target(); pool.forEach(d => d.style.display = 'none'); ed.el.classList.remove('tight');
  if (tab !== 'design' || !g || !t.els.length) { ovl.style.display = 'none'; hov.style.display = 'none'; return; }
  const b = bb(t.els), lk = isLocked(g, t), multi = t.els.length > 1;
  ovl.className = 'ovl' + (t.group ? ' grp' : multi ? ' multi' : '') + (lk ? ' lock' : '');
  Object.assign(ovl.style, { display: 'block', left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
  lbl.textContent = (lk ? 'BLOQUEADO · ' : '') + (t.group ? 'GRUPO: ' + ((grpOf(g)[t.group] || {}).name || '') : multi ? t.els.length + ' ELEMENTOS' : (t.els[0].name || t.els[0].type));
  ed.el.classList.toggle('tight', b.x < 0 || b.y < 0 || b.x + b.w > 1920 || b.y + b.h > 1080);   // si se sale del escenario, el borde se recorta justo en el límite
  lbl.style.top = b.y < 70 ? `calc(${Math.max(0, -b.y)}px + var(--s, 1.6) * 6px)` : 'calc(var(--s, 1.6) * -26px)'; lbl.style.left = (Math.max(0, -b.x) + 6) + 'px'; hd.style.display = lk ? 'none' : 'block';
  const ox = b.x + b.w > 1920, oy = b.y + b.h > 1080;   // si el elemento se sale del escenario, el tirador se queda en la esquina visible
  if (ox || oy) Object.assign(hd.style, { right: 'auto', bottom: 'auto', left: `calc(${Math.min(b.x + b.w, 1920) - b.x}px - var(--s, 1.6) * 26px)`, top: `calc(${Math.min(b.y + b.h, 1080) - b.y}px - var(--s, 1.6) * 26px)` });
  else Object.assign(hd.style, { right: '', bottom: '', left: '', top: '' });
  if (multi) t.els.forEach((e, i) => outline(i, e));
}
new ResizeObserver(() => drawOvl()).observe($('mEd'));
function stagePt(ev) { const r = ed.el.getBoundingClientRect(), k = 1 / ed.scale(); return { x: (ev.clientX - r.left) * k, y: (ev.clientY - r.top) * k }; }
function hitAt(ev) {   // elemento visible más alto bajo el puntero, entre todos los gráficos abiertos: { e, slot }
  const { x: px, y: py } = stagePt(ev), d = store.get().draft;
  const ids = [...open].filter(id => d[id]).sort((a, b) => layerOf(b) - layerOf(a));   // primero el gráfico que queda por encima
  for (const id of ids) {
    const e = elsOf(d[id]).slice().reverse().find(e => e.on !== false && px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h);
    if (e) return { e, slot: id };
  }
  return null;
}
function pickHit(h, multi) {   // selecciona lo tocado; si es de otro gráfico abierto, ese pasa a ser el activo
  const same = h.slot === sel; if (!same) selectSlot(h.slot, true);
  if (multi && same) toggleMulti(h.e.id);
  else if (h.e.group && grpOf(draftOf())[h.e.group]) selectGroup(h.e.group); else selectOne(h.e.id);
}
let drag = null;
ovl.addEventListener('pointerdown', ev => {
  if (ev.button !== 0) return;
  const g = draftOf(), t = target(); if (!t.els.length || isLocked(g, t)) return;
  const box = bb(t.els);   // cx, cy: esquina que se ve en pantalla (el tirador se queda dentro del escenario aunque el elemento se salga)
  drag = { rs: ev.target.classList.contains('hd'), sx: ev.clientX, sy: ev.clientY, snap: t.els.map(clone), box, cx: Math.min(box.x + box.w, 1920), cy: Math.min(box.y + box.h, 1080), single: !t.group && t.els.length === 1 };
  ovl.setPointerCapture(ev.pointerId); ev.preventDefault();
});
ovl.addEventListener('pointermove', ev => {
  if (!drag) return;
  const k = 1 / ed.scale(), dx = (ev.clientX - drag.sx) * k, dy = (ev.clientY - drag.sy) * k;
  store.mutate(sel, g => {   // todo se calcula desde el estado inicial: las posiciones relativas no se pierden
    if (!drag.rs) { drag.snap.forEach(o => { const e = byId(g, o.id); if (e) { e.x = Math.round(o.x + dx); e.y = Math.round(o.y + dy); } }); return; }
    if (drag.single) {
      const o = drag.snap[0], e = byId(g, o.id); if (!e) return;
      let w = Math.max(10, Math.round(drag.cx + dx - o.x)), h = Math.max(10, Math.round(drag.cy + dy - o.y));   // la esquina nueva sigue al puntero desde donde está el tirador
      if ((o.type === 'image' && o.lock !== false) || ev.shiftKey) h = Math.max(10, Math.round(w * o.h / o.w));
      e.w = w; e.h = h; return;
    }
    const kk = Math.max(.05, (drag.cx + dx - drag.box.x) / drag.box.w);   // grupo o selección múltiple: siempre proporcional
    drag.snap.forEach(o => { const e = byId(g, o.id); if (e) scaleEl(e, o, drag.box.x, drag.box.y, kk); });
  });
});
ovl.addEventListener('pointerup', () => { drag = null; });
ed.el.addEventListener('pointerdown', ev => {   // clic en el editor selecciona lo que hay debajo
  if (tab !== 'design' || ev.button !== 0 || ev.target.closest('.ovl')) return;
  const h = hitAt(ev), add = ev.shiftKey || ev.ctrlKey || ev.metaKey;
  if (!h) { if (!add) deselect(); return; }   // clic en un espacio vacío: se quita la selección
  pickHit(h, add);
});
ed.el.addEventListener('dblclick', ev => { if (tab !== 'design') return; const h = hitAt(ev); if (!h) return; if (h.slot !== sel) selectSlot(h.slot, true); selectOne(h.e.id); });   // doble clic: elemento suelto dentro de un grupo
ed.el.addEventListener('pointermove', ev => {
  if (tab !== 'design' || drag) { hov.style.display = 'none'; return; }
  const h = hitAt(ev); if (!h || (h.slot === sel && S().multi.has(h.e.id))) { hov.style.display = 'none'; return; }
  const e = h.e; Object.assign(hov.style, { display: 'block', left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px' });
});
ed.el.addEventListener('pointerleave', () => { hov.style.display = 'none'; });
addEventListener('keydown', ev => {   // flechas: mover 1 px (Mayús = 10 px) lo seleccionado
  if (tab !== 'design' || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key]; if (!d) return;
  const t = target(); if (!t.els.length || isLocked(draftOf(), t)) return; ev.preventDefault();
  const m = ev.shiftKey ? 10 : 1; store.mutate(sel, g => g.elements.forEach(e => { if (t.els.some(x => x.id === e.id)) { e.x += d[0] * m; e.y += d[1] * m; } }));
});

// ---------- Titulares guardados ----------
function snapshot(withDesign) {
  const g = draftOf(), texts = {};
  elsOf(g).forEach(e => { if (e.type === 'text' && e.role && !(e.role in texts)) texts[e.role] = e.text; });
  const rec = { texts, slot: sel };
  if (withDesign) rec.design = { template: g.template, elements: clone(g.elements), groups: clone(g.groups || {}), anim: clone(g.anim) };
  return rec;
}
function loadHeadline(h) {
  const slot = h.slot && SLOTS[h.slot] ? h.slot : 'headline'; sel = slot; $('fields').dataset.k = '';
  if (h.design) store.setGraphic(slot, h.design);
  else store.mutate(slot, g => g.elements.forEach(e => { if (e.type === 'text' && e.role && h.texts && e.role in h.texts) e.text = h.texts[e.role]; }));
  render(store.get());
}
$('hSave').onclick = () => {
  const name = $('hName').value.trim(); if (!name) { alert('Escribe un nombre para identificar el titular.'); return; }
  store.saveHeadline({ name, ...snapshot($('hDesign').checked) }); $('hName').value = '';
};
$('hUpd').onclick = () => {
  const name = $('hName').value.trim(); if (!name) { alert('Escribe un nombre.'); return; }
  store.saveHeadline({ id: editingH, name, ...snapshot($('hDesign').checked) }); stopEdit();
};
$('hCancel').onclick = () => stopEdit();
function stopEdit() { editingH = null; $('hName').value = ''; $('hDesign').checked = false; render(store.get()); }
$('hSearch').oninput = () => { $('hList').dataset.k = ''; renderSaved(); };
function renderSaved() {
  const q = norm($('hSearch').value), all = store.headlines();
  const list = all.filter(h => !q || norm([h.name, ...Object.values(h.texts || {})].join(' ')).includes(q));
  const key = q + '|' + editingH + '|' + list.map(h => h.id + h.ts).join();
  $('hSave').hidden = !!editingH; $('hUpd').hidden = $('hCancel').hidden = !editingH;
  const box = $('hList'); if (box.dataset.k === key) return; box.dataset.k = key; box.innerHTML = '';
  if (!list.length) { box.innerHTML = `<p class="hint">${all.length ? 'Sin resultados.' : 'Todavía no hay titulares guardados.'}</p>`; return; }
  list.forEach(h => {
    const t = h.texts || {}, r = mk$('div', 'hrow' + (h.id === editingH ? ' edit' : ''));
    r.innerHTML = `<div class="ht"><b>${esc(h.name)}</b>${h.design ? '<span class="badge">CON DISEÑO</span>' : ''}<div class="hh">${esc(t.headline || t.name || '')}</div><div class="hs">${esc(t.sub || t.role || '')}</div></div><div class="hb"></div>`;
    const hb = r.querySelector('.hb'), b = (txt, f, c) => { const x = mk$('button', c || '', txt); x.onclick = f; hb.append(x); };
    b('Cargar', () => loadHeadline(h), 'go');
    b('Editar', () => { editingH = h.id; $('hName').value = h.name; $('hDesign').checked = !!h.design; loadHeadline(h); });
    b('Duplicar', () => { const c = clone(h); delete c.id; c.name = h.name + ' (copia)'; store.saveHeadline(c); });
    b('Eliminar', () => { if (confirm(`¿Eliminar «${h.name}»?`)) { if (editingH === h.id) editingH = null; store.deleteHeadline(h.id); } }, 'danger');
    box.append(r);
  });
}

// ---------- Programas (conjuntos completos de gráficos) ----------
let curProg = null; try { curProg = localStorage.getItem('atg_prog'); } catch { /* sin almacenamiento */ }
const setCurProg = id => { curProg = id; try { id ? localStorage.setItem('atg_prog', id) : localStorage.removeItem('atg_prog'); } catch { /* nada */ } };
const onAir = () => Object.values(store.get().program).some(g => g && g.visible);
function afterOpen() {   // tras abrir un programa se reinicia todo lo que dependía de los gráficos anteriores
  for (const k in SEL) delete SEL[k]; loopOn = false; syncLoopBtns(); prev.stopTest(sel); sel = 'headline'; open = new Set([sel]); animElId = null;
  ['fields', 'animQuick', 'animFull', 'animEl', 'insp', 'elList', 'editBtns', 'swProg'].forEach(i => { $(i).dataset.k = ''; }); render(store.get());
}
$('pSave').onclick = () => {
  const name = $('pName').value.trim(); if (!name) { alert('Escribe un nombre para el programa.'); return; }
  const same = store.programs().find(p => norm(p.name) === norm(name));
  if (same && !confirm(`Ya existe un programa llamado «${same.name}». ¿Reemplazarlo con los gráficos actuales?`)) return;
  setCurProg(store.saveProgram(name, same && same.id)); $('pName').value = '';
};
$('pSearch').oninput = () => { $('pList').dataset.k = ''; renderProgs(); };
function renderProgs() {
  const q = norm($('pSearch').value), all = store.programs(), list = all.filter(p => !q || norm(p.name).includes(q));
  const key = q + '|' + curProg + '|' + list.map(p => p.id + p.ts + p.name).join();
  const box = $('pList'); if (box.dataset.k === key) return; box.dataset.k = key; box.innerHTML = '';
  if (!list.length) { box.innerHTML = `<p class="hint">${all.length ? 'Sin resultados.' : 'Todavía no hay programas guardados.'}</p>`; return; }
  list.forEach(p => {
    const names = store.progNames(p), r = mk$('div', 'hrow' + (p.id === curProg ? ' edit' : ''));
    r.innerHTML = `<div class="ht"><b>${esc(p.name)}</b>${p.id === curProg ? '<span class="badge">ABIERTO</span>' : ''}<div class="hh">${names.length} ${names.length === 1 ? 'gráfico' : 'gráficos'}</div><div class="hs">${esc(names.join(' · '))}</div></div><div class="hb"></div>`;
    const hb = r.querySelector('.hb'), b = (txt, f, c) => { const x = mk$('button', c || '', txt); x.onclick = f; hb.append(x); };
    b('Abrir', async () => {
      if (!confirm(`¿Abrir «${p.name}»? Se reemplazan todos los gráficos actuales por los de este programa.${onAir() ? ' Lo que esté al aire saldrá del aire.' : ''}`)) return;
      await store.openProgram(p.id); setCurProg(p.id); afterOpen();
    }, 'go');
    b('Actualizar con lo actual', () => { if (confirm(`¿Reemplazar el contenido guardado de «${p.name}» con los gráficos actuales?`)) setCurProg(store.saveProgram(p.name, p.id)); });
    b('Renombrar', () => { const n = (prompt('Nuevo nombre del programa:', p.name) || '').trim(); if (n) store.renameProgram(p.id, n); });
    b('Duplicar', () => store.duplicateProgram(p.id));
    b('Eliminar', () => { if (confirm(`¿Eliminar el programa «${p.name}»?`)) { if (curProg === p.id) setCurProg(null); store.deleteProgram(p.id); } }, 'danger');
    box.append(r);
  });
}

// ---------- Plantillas ----------
let tplKey = null;
function useTemplate(t) {
  if (t.key === 'blank') { if (newBlankGraphic() && tab !== 'design') setTab('design'); return; }
  store.setGraphic(sel, instantiate(t, draftOf())); const s = S(); s.id = null; s.grp = null; s.multi = new Set(); $('fields').dataset.k = ''; render(store.get());
}
function addCard(grid, t, del) {
  const c = mk$('div', 'tcard'), th = mk$('div', 'thumb'); c.append(th); grid.append(c);
  const b = mk$('b', '', t.name); if (del) { const x = mk$('button', 'tdel', 'Eliminar'); x.onclick = ev => { ev.stopPropagation(); if (confirm(`¿Eliminar la plantilla «${t.name}»?`)) store.deleteTemplate(t.id); }; b.prepend(x); }
  c.append(b, mk$('small', '', t.desc || ''));
  c.onclick = () => useTemplate(t);
  createStage(th, { static: true, placeholders: true }).apply({ x: { visible: true, elements: t.elements, anim: t.anim } });
}
function renderTpl() {
  $('tplHint').textContent = `Al elegir una plantilla se carga en «${SLOTS[sel].name}» conservando los textos, el logotipo y las noticias actuales.`;
  const mine = store.templates(), key = mine.map(t => t.id + t.ts).join();
  if (tplKey === key) return; tplKey = key;
  $('tplBuilt').innerHTML = $('tplMine').innerHTML = '';
  TEMPLATE_LIST.forEach(t => addCard($('tplBuilt'), t, false));
  if (!mine.length) $('tplMine').innerHTML = '<p class="hint">Aún no hay plantillas personalizadas. Guárdalas desde la pestaña Diseño.</p>';
  mine.forEach(t => addCard($('tplMine'), t, true));
}

// ---------- Deshacer / rehacer ----------
const doUndo = () => { store.undo(sel); $('fields').dataset.k = ''; };
const doRedo = () => { store.redo(sel); $('fields').dataset.k = ''; };
$('edUndo').onclick = doUndo; $('edRedo').onclick = doRedo;
addEventListener('pointerdown', () => store.markStep(), true);   // cada clic o arrastre nuevo abre un paso del historial

// ---------- Copiar y pegar elementos entre gráficos (fuentes) ----------
let clip = null; const pasteN = {};
try { clip = JSON.parse(localStorage.getItem('atg_clip') || 'null'); } catch { clip = null; }
function copySel() {
  const g = draftOf(), t = target(); if (!g || !t.els.length) return false;
  const groups = {}; t.els.forEach(e => { if (e.group && grpOf(g)[e.group]) groups[e.group] = clone(grpOf(g)[e.group]); });
  clip = { els: clone(t.els), groups, from: sel }; for (const k in pasteN) delete pasteN[k];
  try { localStorage.setItem('atg_clip', JSON.stringify(clip)); } catch { /* imágenes muy pesadas: queda solo en memoria */ }
  render(store.get()); return true;
}
function pasteClip() {
  if (!clip || !clip.els || !clip.els.length || !draftOf()) return;
  const n = (pasteN[sel] = (pasteN[sel] || 0) + 1), off = clip.from === sel ? 30 * n : 30 * (n - 1), ngs = {};
  const els = clip.els.map(o => {
    const e = clone(o); e.id = uid(); e.x = (+e.x || 0) + off; e.y = (+e.y || 0) + off;
    if (o.group && clip.groups[o.group]) { ngs[o.group] = ngs[o.group] || uid(); e.group = ngs[o.group]; } else delete e.group;
    return e;
  });
  store.mutate(sel, g => { g.groups = g.groups || {}; for (const k in ngs) g.groups[ngs[k]] = clone(clip.groups[k]); els.forEach(e => g.elements.push(e)); cleanGroups(g); });
  const gids = Object.values(ngs), s = S(), ids = els.map(e => e.id);
  if (gids.length === 1 && els.every(e => e.group)) selectGroup(gids[0]);
  else { s.grp = null; s.multi = new Set(ids); s.id = ids[ids.length - 1]; render(store.get()); }
}
function deleteSel() {
  const t = target(), g = draftOf(); if (!t.els.length || isLocked(g, t)) return;
  const ids = new Set(t.els.map(e => e.id));
  store.mutate(sel, g2 => { g2.elements = g2.elements.filter(x => !ids.has(x.id)); cleanGroups(g2); });
  const s = S(); s.id = null; s.grp = null; s.multi = new Set(); render(store.get());
}
function syncEditTools() { $('edUndo').disabled = !store.canUndo(sel); $('edRedo').disabled = !store.canRedo(sel); }

// Menú del clic derecho sobre el editor: Copiar, Pegar, Eliminar y Añadir (con submenú al lado, como en Windows)
const ctx = mk$('div', 'ctx'), sub = mk$('div', 'ctx sub'); ctx.hidden = sub.hidden = true; document.body.append(ctx, sub);
function hideCtx() { ctx.hidden = true; sub.hidden = true; }
const ADD_ITEMS = [['text', 'Texto'], ['clock', 'Reloj'], ['logo', 'Logotipo'], ['image', 'Imagen'], ['shape', 'Forma'], ['ticker', 'Cintilla']];
function openSub(btn, pt) {
  sub.innerHTML = ''; sub.append(mk$('div', 'clab', 'En «' + SLOTS[sel].name + '»'));
  ADD_ITEMS.forEach(([k, t]) => { const b = mk$('button', '', t); b.onclick = () => { hideCtx(); addAt(k, pt); }; sub.append(b); });
  sub.hidden = false;
  const r = btn.getBoundingClientRect(), w = sub.offsetWidth, h = sub.offsetHeight;
  sub.style.left = (r.right + 2 + w > innerWidth - 4 ? Math.max(4, r.left - w - 2) : r.right + 2) + 'px';   // se abre a la derecha; si no cabe, a la izquierda
  sub.style.top = Math.max(4, Math.min(r.top - 4, innerHeight - h - 8)) + 'px';
}
ed.el.addEventListener('contextmenu', ev => {
  ev.preventDefault(); if (tab !== 'design') return;
  const h = hitAt(ev); if (h && !(h.slot === sel && S().multi.has(h.e.id))) pickHit(h, false);
  const pt = stagePt(ev), has = target().els.length > 0; ctx.innerHTML = ''; sub.hidden = true;
  const item = (t, f, dis, cls) => { const b = mk$('button', cls || '', t); b.disabled = !!dis; b.onclick = () => { hideCtx(); f(); }; b.onmouseenter = () => { sub.hidden = true; }; ctx.append(b); };
  item('Copiar', copySel, !has); item('Pegar', pasteClip, !(clip && clip.els && clip.els.length)); item('Eliminar', deleteSel, !has, 'danger');
  ctx.append(mk$('div', 'csep'));
  const add = mk$('button', 'hassub', 'Añadir'); add.onmouseenter = add.onclick = () => openSub(add, pt); ctx.append(add);
  ctx.hidden = false;
  ctx.style.left = Math.max(4, Math.min(ev.clientX, innerWidth - ctx.offsetWidth - 8)) + 'px'; ctx.style.top = Math.max(4, Math.min(ev.clientY, innerHeight - ctx.offsetHeight - 8)) + 'px';
});
addEventListener('pointerdown', ev => { if (!ev.target.closest('.ctx')) hideCtx(); }, true);
addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { const open = !ctx.hidden; hideCtx(); if (!open && tab === 'design' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) deselect(); return; }
  if (tab !== 'design' || !(ev.ctrlKey || ev.metaKey) || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
  const k = ev.key.toLowerCase();
  if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); doUndo(); }
  else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); doRedo(); }
  else if (k === 'c') { if (copySel()) ev.preventDefault(); }
  else if (k === 'v') { if (clip) { ev.preventDefault(); pasteClip(); } }
});

// Editor fijo arriba: alturas de la barra superior y de «Editando» para que el editor se quede pegado debajo
const asideEl = document.querySelector('aside'), ebEl = $('editbar');
function syncOffsets() { const r = document.documentElement.style; r.setProperty('--ah', asideEl.offsetHeight + 'px'); r.setProperty('--eb', ebEl.offsetHeight + 'px'); }
new ResizeObserver(syncOffsets).observe(asideEl); new ResizeObserver(syncOffsets).observe(ebEl); syncOffsets();

// ---------- Render general ----------
function render(s) {
  if (!SLOTS[sel]) sel = 'headline';
  open = new Set([...open].filter(id => SLOTS[id])); open.add(sel);
  prev.apply(s.draft); prog.apply(s.program); buildEditbar(); buildAirpad(s);
  $('monitors').classList.toggle('off', tab === 'design');   // en Diseño solo se ve el editor (los monitores siguen montados fuera de pantalla)
  const g = s.draft[sel]; if (!g) return;
  fixSel(g); buildLive(s);
  const show = {}; if (tab === 'design') open.forEach(id => { if (s.draft[id]) show[id] = { ...s.draft[id], visible: true }; });
  ed.apply(show);   // el editor muestra todos los gráficos abiertos, estén o no sus switches encendidos
  if (tab === 'design') syncEditTools();
  if (tab === 'op') {
    syncContent(g); renderAnim($('animQuick'), g, false);
    if ($('animMore').open) { renderAnim($('animFull'), g, true); renderAnimEl($('animEl'), g); }   // la animación avanzada solo se pinta si está abierta
  }
  if (tab === 'design') {
    renderList(g); renderSelUI(g);
    const t = target(); if (t.els.length > 1) renderMultiInsp($('insp'), t); else renderInsp($('insp'), curEl(), 'design');
  }
  if (tab === 'ticker') renderTickerTab(g);
  if (tab === 'saved') renderSaved();
  if (tab === 'prog') renderProgs();
  if (tab === 'tpl') renderTpl();
  drawOvl();
}
store.subscribe(render);
store.init();
