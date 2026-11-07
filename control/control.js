import * as store from '../modules/store.js';
import * as db from '../modules/firebase.js';
import { createStage } from '../modules/stage.js';
import { SLOTS, TEMPLATE_LIST, FONTS, arr, instantiate, newText, newImage, newLogo, newShape, newTicker } from '../modules/templates.js';
import { ANIMS } from '../modules/animations.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const mk$ = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const prev = createStage($('mPrev'), { placeholders: true }), prog = createStage($('mProg'));
let sel = 'headline', tab = 'op', editingH = null;
const selIds = {};
const draftOf = () => store.get().draft[sel];
const curEl = () => { const g = draftOf(); return g && arr(g.elements).find(e => e.id === selIds[sel]); };
const tickerOf = g => { if (!g) return null; const t = arr(g.elements).filter(e => e.type === 'ticker'); return t.find(e => e.id === selIds[sel]) || t[0] || null; };
const edit = (elId, fn) => store.mutate(sel, g => { const e = g.elements.find(x => x.id === elId); if (e) fn(e, g); });

$('obsurl').value = new URL('../output/index.html', location.href).href;
db.onStatus(s => { const e = $('status'); e.className = 'status ' + s;
  e.textContent = { local: 'MODO LOCAL (sin Firebase)', connecting: 'Conectando…', online: 'Firebase conectado', offline: 'Sin conexión' }[s]; });
$('animIn').innerHTML = Object.entries(ANIMS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

// ---------- Pestañas ----------
document.querySelectorAll('#nav a').forEach(a => a.onclick = () => {
  tab = a.dataset.tab;
  document.querySelectorAll('#nav a').forEach(x => x.classList.toggle('on', x === a));
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== 'tab-' + tab);
  if (tab === 'design' && draftOf() && !draftOf().visible) store.mutate(sel, () => {});
  render(store.get());
});

// ---------- Selector de gráfico y barra en vivo ----------
function buildQuick(s) {
  const q = $('quick'); const html = Object.keys(SLOTS).map(id => {
    const on = s.program[id] && s.program[id].visible;
    return `<button data-id="${id}" class="${id === sel ? 'sel' : ''}">${SLOTS[id].name}<span class="st ${on ? 'on' : ''}">${on ? 'EN AIRE' : 'OFF'}</span></button>`;
  }).join('');
  if (q.dataset.k === html) return; q.dataset.k = html; q.innerHTML = html;
  q.querySelectorAll('button').forEach(b => b.onclick = () => { sel = b.dataset.id; $('fields').dataset.k = ''; render(store.get()); });
}
function buildLive(s) {
  const box = $('liveBar'), tk = tickerOf(s.draft[sel]);
  if (!tk) { box.hidden = true; return; }
  box.hidden = false;
  const pg = s.program[sel], src = (pg && pg.visible && arr(pg.elements).find(e => e.id === tk.id)) || tk;
  const paused = !!src.paused, on = src.on !== false;
  const html = `<span>CINTILLA «${esc(tk.name)}» (EN VIVO)</span><button id="lvP">${paused ? '▶ Reanudar' : '⏸ Pausar'}</button><button id="lvO" class="${on ? 'danger' : 'go'}">${on ? 'Ocultar cintilla' : 'Activar cintilla'}</button>`;
  if (box.dataset.k === html) return; box.dataset.k = html; box.innerHTML = html;
  $('lvP').onclick = () => store.live(sel, tk.id, { paused: !paused });
  $('lvO').onclick = () => store.live(sel, tk.id, { on: !on });
}

// ---------- Pestaña Operación ----------
function syncContent(g) {
  const texts = arr(g.elements).filter(e => e.type === 'text'), box = $('fields');
  const key = sel + ':' + texts.map(e => e.id).join(',');
  if (box.dataset.k !== key) {
    box.dataset.k = key; box.innerHTML = '';
    texts.forEach(e => { const t = mk$('textarea'); t.rows = 2; t.dataset.id = e.id; t.oninput = () => edit(e.id, x => { x.text = t.value; }); box.append(mk$('label', '', e.name || 'Texto'), t); });
    if (!texts.length) box.innerHTML = '<p class="hint">Este gráfico no tiene cuadros de texto. Puedes añadirlos en la pestaña Diseño.</p>';
  }
  box.querySelectorAll('textarea').forEach(t => { const e = texts.find(x => x.id === t.dataset.id); if (e && document.activeElement !== t) t.value = e.text ?? ''; });
  if (document.activeElement !== $('animIn')) $('animIn').value = g.anim.in;
  if (document.activeElement !== $('dur')) $('dur').value = g.anim.duration;
}
$('animIn').onchange = e => store.mutate(sel, g => { g.anim = { ...g.anim, in: e.target.value }; });
$('dur').oninput = e => store.mutate(sel, g => { g.anim = { ...g.anim, duration: +e.target.value }; });
$('bPrev').onclick = () => store.preview(sel);
$('bShow').onclick = () => store.show(sel);
$('bUpd').onclick = () => store.update(sel);
$('bHide').onclick = () => store.hide(sel);
$('bClr').onclick = () => { store.clearDraft(sel); $('fields').dataset.k = ''; render(store.get()); };

// ---------- Imágenes (PNG / JPG / WebP) ----------
function pickImage(cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { alert('Formato no permitido. Usa PNG, JPG o WebP.'); return; }
    const url = URL.createObjectURL(f);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      const src = c.toDataURL(f.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .92);   // PNG/WebP conservan transparencia
      if (src.length > 3e6) { alert('La imagen es demasiado pesada. Usa una más pequeña.'); return; }
      cb({ src, ar: img.naturalWidth / img.naturalHeight });
    } catch { alert('No se pudo leer la imagen.'); } finally { URL.revokeObjectURL(url); }
  };
  inp.click();
}
const applyImage = (id, r, resize) => edit(id, e => { e.src = r.src; e.ar = r.ar; if (resize) e.h = Math.max(10, Math.round(e.w / r.ar)); });

// ---------- Pestaña Diseño: lista, altas y propiedades ----------
const ICON = { text: 'T', image: '▣', shape: '▭', ticker: '≡' };
function renderList(g) {
  const box = $('elList'), els = arr(g.elements);
  const key = [sel, selIds[sel], els.map(e => e.id + e.name + (e.on === false)).join()].join('|');
  if (box.dataset.k === key) return; box.dataset.k = key; box.innerHTML = '';
  els.slice().reverse().forEach(e => {
    const r = mk$('div', 'erow' + (e.id === selIds[sel] ? ' on' : '') + (e.on === false ? ' off' : ''), `${ICON[e.type] || '?'}  ${e.name || e.type}`);
    r.onclick = () => { selIds[sel] = e.id; render(store.get()); }; box.append(r);
  });
}
const addEl = e => { store.mutate(sel, g => g.elements.push(e)); selIds[sel] = e.id; render(store.get()); };
$('addText').onclick = () => addEl(newText());
$('addShape').onclick = () => addEl(newShape());
$('addTicker').onclick = () => addEl(newTicker());
$('addLogo').onclick = () => { const e = newLogo(); addEl(e); pickImage(r => applyImage(e.id, r, true)); };
$('addImg').onclick = () => { const e = newImage(); addEl(e); pickImage(r => applyImage(e.id, r, true)); };
$('tSave').onclick = () => {
  const name = $('tName').value.trim(), g = draftOf(); if (!name) { alert('Escribe un nombre para la plantilla.'); return; }
  store.saveTemplate({ name, desc: 'Plantilla personalizada', elements: clone(g.elements), anim: clone(g.anim) }); $('tName').value = '';
};

function setProp(id, p, v) {
  edit(id, e => {
    const ow = e.w, oh = e.h; e[p] = v;
    if (e.type === 'image' && e.lock !== false && ow && oh) { if (p === 'w') e.h = Math.max(1, Math.round(v * oh / ow)); if (p === 'h') e.w = Math.max(1, Math.round(v * ow / oh)); }
  });
}
function mk(spec, id) {
  const [p, label, type, opt] = spec, w = mk$('div', 'f');
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
const SPECS = {
  text: [['text', 'Texto', 'area'], ['font', 'Tipografía', 'select', FONTS.map(f => [f, f])], ['size', 'Tamaño máximo (px)', 'num', { min: 6, max: 400 }], ['minSize', 'Tamaño mínimo (px)', 'num', { min: 6, max: 400 }],
    ['weight', 'Grosor', 'select', [[400, 'Normal'], [600, 'Seminegrita'], [700, 'Negrita'], [800, 'Extranegrita']]], ['align', 'Alineación', 'select', [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]],
    ['valign', 'Alineación vertical', 'select', [['top', 'Arriba'], ['middle', 'Centro'], ['bottom', 'Abajo']]], ['color', 'Color del texto', 'color'], ['bg', 'Color de fondo', 'coloropt'],
    ['padX', 'Margen lateral (px)', 'num', { min: 0 }], ['lh', 'Interlineado', 'num', { min: .8, max: 2, step: .05 }], ['upper', 'Mayúsculas', 'check'], ['autofit', 'Ajuste automático (reduce el texto si no cabe)', 'check']],
  image: [['fit', 'Ajuste', 'select', [['contain', 'Mantener proporciones'], ['cover', 'Rellenar (recorta)']]], ['lock', 'Bloquear proporciones al redimensionar', 'check'],
    ['opacity', 'Opacidad', 'num', { min: 0, max: 1, step: .05 }], ['radius', 'Redondeo (px)', 'num', { min: 0 }], ['bg', 'Color de fondo', 'coloropt']],
  shape: [['color', 'Color', 'color'], ['opacity', 'Opacidad', 'num', { min: 0, max: 1, step: .05 }], ['radius', 'Redondeo (px)', 'num', { min: 0 }]],
  ticker: [['speed', 'Velocidad (px/s)', 'num', { min: 10, max: 1000, step: 10 }], ['dir', 'Dirección', 'select', [['left', '← Hacia la izquierda'], ['right', '→ Hacia la derecha']]],
    ['font', 'Tipografía', 'select', FONTS.map(f => [f, f])], ['size', 'Tamaño de letra (px)', 'num', { min: 10, max: 200 }], ['weight', 'Grosor', 'select', [[400, 'Normal'], [600, 'Seminegrita'], [700, 'Negrita'], [800, 'Extranegrita']]],
    ['color', 'Color del texto', 'color'], ['bg', 'Color de fondo', 'color'], ['upper', 'Mayúsculas', 'check'],
    ['sep', 'Separador entre noticias', 'text', { list: 'sepList' }], ['sepColor', 'Color del separador', 'color'], ['sepGap', 'Espacio alrededor del separador (px)', 'num', { min: 0 }],
    ['label', 'Etiqueta izquierda (vacía = sin etiqueta)', 'text'], ['labelBg', 'Fondo de la etiqueta', 'color'], ['labelColor', 'Color de la etiqueta', 'color']]
};
const grid = (specs, id) => { const d = mk$('div', 'grid2'); specs.forEach(s => d.append(mk(s, id))); return d; };

function buildNews(e) {
  const wrap = mk$('div'), list = mk$('div', 'news'); wrap.append(mk$('h3', '', 'Noticias'), list);
  arr(e.items).forEach((t, i) => {
    const r = mk$('div', 'nr'), inp = mk$('input'); inp.value = t; inp.dataset.news = i;
    inp.oninput = () => edit(e.id, x => { x.items[i] = inp.value; });
    const mv = (d) => edit(e.id, x => { const j = i + d; if (j < 0 || j >= x.items.length) return; [x.items[i], x.items[j]] = [x.items[j], x.items[i]]; });
    const up = mk$('button', '', '↑'), dn = mk$('button', '', '↓'), rm = mk$('button', 'danger', '✕');
    up.onclick = () => mv(-1); dn.onclick = () => mv(1); rm.onclick = () => edit(e.id, x => { x.items.splice(i, 1); });
    r.append(inp, up, dn, rm); list.append(r);
  });
  const add = mk$('button', 'go', '+ Añadir noticia'); add.onclick = () => edit(e.id, x => { x.items.push('Nueva noticia'); });
  wrap.append(add); return wrap;
}
function buildActions(e) {
  const a = mk$('div', 'arow'), b = (t, f, c) => { const x = mk$('button', c || '', t); x.onclick = f; a.append(x); return x; };
  if (e.type === 'image') { b('Subir / cambiar imagen', () => pickImage(r => applyImage(e.id, r, false)), 'go'); b('Quitar imagen', () => edit(e.id, x => { x.src = ''; })); }
  b('Duplicar', () => { const c = clone(e); c.id = Math.random().toString(36).slice(2, 9); c.name = (e.name || e.type) + ' (copia)'; c.x += 30; c.y += 30; addEl(c); });
  b('▲ Al frente', () => moveZ(1)); b('▼ Atrás', () => moveZ(-1));
  b('Eliminar', () => { store.mutate(sel, g => { g.elements = g.elements.filter(x => x.id !== e.id); }); selIds[sel] = null; render(store.get()); }, 'danger');
  return a;
}
function moveZ(d) {
  store.mutate(sel, g => { const i = g.elements.findIndex(e => e.id === selIds[sel]), j = i + d; if (i < 0 || j < 0 || j >= g.elements.length) return; [g.elements[i], g.elements[j]] = [g.elements[j], g.elements[i]]; });
}
function renderInsp(box, e, kind) {
  if (!e) { box.dataset.k = ''; box.innerHTML = '<p class="hint">Selecciona un elemento.</p>'; return; }
  const key = [sel, kind, e.id, e.type, e.type === 'ticker' ? arr(e.items).length : ''].join('|');
  if (box.dataset.k !== key) {
    box.dataset.k = key; box.innerHTML = '';
    box.append(mk$('h3', '', (kind === 'ticker' ? 'Cintilla: ' : 'Propiedades: ') + (e.name || e.type)));
    if (kind === 'ticker') {
      box.append(buildNews(e), mk$('h3', '', 'Estilo y movimiento'), grid(SPECS.ticker, e.id), mk$('h3', '', 'Altura y posición de la cinta'), grid([['name', 'Nombre', 'text'], ...GEO], e.id));
    } else {
      box.append(grid([['name', 'Nombre', 'text'], ['on', 'Visible', 'check'], ...GEO], e.id), mk$('h3', '', 'Aspecto'), grid(SPECS[e.type] || [], e.id));
      if (e.type === 'ticker') box.append(mk$('p', 'hint', 'Las noticias se editan en la pestaña Cintilla.'));
    }
    if (kind !== 'ticker') box.append(buildActions(e));
  }
  box.querySelectorAll('[data-p]').forEach(i => {
    const p = i.dataset.p, t = i.dataset.t, v = e[p];
    if (t === 'coloropt') { const [c, k] = i.children; c.checked = !!v; if (v) k.value = v; return; }
    if (document.activeElement === i) return;
    if (t === 'check') i.checked = !!v; else i.value = v ?? '';
  });
  box.querySelectorAll('[data-news]').forEach(i => { if (document.activeElement !== i) i.value = arr(e.items)[+i.dataset.news] ?? ''; });
}
function renderTickerTab(g) {
  const box = $('tkInsp'), tk = tickerOf(g);
  if (!tk) {
    if (box.dataset.k !== 'none') { box.dataset.k = 'none'; box.innerHTML = '<p class="hint">Este gráfico no tiene cintilla.</p>'; const b = mk$('button', 'go', 'Añadir cintilla a este gráfico'); b.onclick = () => addEl(newTicker()); box.append(b); }
    return;
  }
  renderInsp(box, tk, 'ticker');
}

// ---------- Selección y movimiento directo en PREVIEW ----------
const ovl = mk$('div', 'ovl'); ovl.append(mk$('div', 'hd')); prev.el.append(ovl);
function drawOvl() {
  const e = curEl();
  if (tab !== 'design' || !e) { ovl.style.display = 'none'; return; }
  Object.assign(ovl.style, { display: 'block', left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px' });
}
let drag = null;
ovl.addEventListener('pointerdown', ev => {
  const e = curEl(); if (!e) return;
  drag = { rs: ev.target.classList.contains('hd'), sx: ev.clientX, sy: ev.clientY, x: e.x, y: e.y, w: e.w, h: e.h, type: e.type, lock: e.lock !== false };
  ovl.setPointerCapture(ev.pointerId); ev.preventDefault();
});
ovl.addEventListener('pointermove', ev => {
  if (!drag) return;
  const k = 1 / prev.scale(), dx = (ev.clientX - drag.sx) * k, dy = (ev.clientY - drag.sy) * k;
  store.mutate(sel, g => {
    const e = g.elements.find(x => x.id === selIds[sel]); if (!e) return;
    if (!drag.rs) { e.x = Math.round(drag.x + dx); e.y = Math.round(drag.y + dy); return; }
    let w = Math.max(10, Math.round(drag.w + dx)), h = Math.max(10, Math.round(drag.h + dy));
    if ((drag.type === 'image' && drag.lock) || ev.shiftKey) h = Math.max(10, Math.round(w * drag.h / drag.w));
    e.w = w; e.h = h;
  });
});
ovl.addEventListener('pointerup', () => { drag = null; });
prev.el.addEventListener('pointerdown', ev => {   // clic en el PREVIEW selecciona el elemento que hay debajo
  if (tab !== 'design' || ev.target.closest('.ovl')) return;
  const g = draftOf(), r = prev.el.getBoundingClientRect(), k = 1 / prev.scale();
  const px = (ev.clientX - r.left) * k, py = (ev.clientY - r.top) * k;
  const hit = arr(g.elements).slice().reverse().find(e => e.on !== false && px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h);
  if (hit) { selIds[sel] = hit.id; render(store.get()); }
});

// ---------- Titulares guardados ----------
function snapshot(withDesign) {
  const g = draftOf(), texts = {};
  arr(g.elements).forEach(e => { if (e.type === 'text' && e.role && !(e.role in texts)) texts[e.role] = e.text; });
  const rec = { texts, slot: sel };
  if (withDesign) rec.design = { template: g.template, elements: clone(g.elements), anim: clone(g.anim) };
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

// ---------- Plantillas ----------
let tplKey = null;
function useTemplate(t) {
  store.setGraphic(sel, instantiate(t, draftOf())); selIds[sel] = null; $('fields').dataset.k = ''; render(store.get());
}
function addCard(grid, t, del) {
  const c = mk$('div', 'tcard'), th = mk$('div', 'thumb'); c.append(th); grid.append(c);
  const b = mk$('b', '', t.name); if (del) { const x = mk$('button', 'tdel', '✕'); x.onclick = ev => { ev.stopPropagation(); if (confirm(`¿Eliminar la plantilla «${t.name}»?`)) store.deleteTemplate(t.id); }; b.prepend(x); }
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

// ---------- Render general ----------
function render(s) {
  prev.apply(s.draft); prog.apply(s.program); buildQuick(s);
  const g = s.draft[sel]; if (!g) return;
  const els = arr(g.elements);
  if (!els.some(e => e.id === selIds[sel])) selIds[sel] = (els.find(e => e.type === 'text') || els[0] || {}).id;
  buildLive(s);
  if (tab === 'op') syncContent(g);
  if (tab === 'design') { renderList(g); renderInsp($('insp'), curEl(), 'design'); }
  if (tab === 'ticker') renderTickerTab(g);
  if (tab === 'saved') renderSaved();
  if (tab === 'tpl') renderTpl();
  drawOvl();
}
store.subscribe(render);
store.init();
