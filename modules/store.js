// Estado central: /draft (lo que editas y ves en PREVIEW) y /program (lo que ve OBS).
// Además: /headlines (titulares guardados) y /templates (plantillas personalizadas).
import * as db from './firebase.js';
import { SLOTS, DEFAULT_NAMES, newGraphic, arr, uid, setCustomSlots, applyOrder, setNames, setClosed, isBuiltin, getOrder } from './templates.js';

const state = { draft: {}, program: {}, headlines: {}, templates: {}, slots: {}, names: {}, programs: {}, closed: {}, openSrc: {} };
const subs = new Set();
const emit = () => subs.forEach(f => f(state));
export const subscribe = f => { subs.add(f); f(state); };
export const get = () => state;
const clone = o => JSON.parse(JSON.stringify(o));

// Firebase elimina arrays vacíos y convierte algunos arrays en objetos: se normaliza al leer.
const fixEls = list => { const els = arr(list); els.forEach(e => { if (e && e.type === 'ticker') e.items = arr(e.items); }); return els; };
function fixGraphics(v, fill) {
  const r = {};
  for (const k in (v || {})) { const g = v[k]; if (g && g.v === 2) { g.elements = fixEls(g.elements); r[k] = g; } }
  if (fill) for (const id in SLOTS) if (!r[id]) r[id] = newGraphic(id);
  return r;
}
function fixLib(v) {
  const r = {};
  for (const k in (v || {})) {
    const x = v[k]; if (!x) continue;
    if (x.elements) x.elements = fixEls(x.elements);
    if (x.design) x.design.elements = fixEls(x.design.elements);
    r[k] = x;
  }
  return r;
}

function fixProgs(v) {   // programas guardados: cada uno trae todos sus gráficos
  const r = {};
  for (const k in (v || {})) {
    const p = v[k]; if (!p) continue;
    p.slots = p.slots || {}; p.names = p.names || {}; p.order = arr(p.order);
    const gs = {}; for (const id in (p.graphics || {})) { const g = p.graphics[id]; if (g) { g.elements = fixEls(g.elements); gs[id] = g; } }
    p.graphics = gs; r[k] = p;
  }
  return r;
}

export async function init() {
  await db.connect();
  db.watch('slots', v => {   // gráficos adicionales (además de los tres integrados)
    state.slots = v || {}; setCustomSlots(state.slots);
    for (const id in SLOTS) if (!state.draft[id]) state.draft[id] = newGraphic(id);
    emit();
  });
  db.watch('slotNames', v => { state.names = v || {}; setNames(state.names); emit(); });   // nombres personalizados de los gráficos integrados
  db.watch('closedSlots', v => {   // fuentes integradas cerradas (guardadas en un programa)
    state.closed = v || {}; setClosed(state.closed); setNames(state.names);
    for (const id in SLOTS) if (!state.draft[id]) state.draft[id] = newGraphic(id);
    emit();
  });
  db.watch('openSources', v => { state.openSrc = v || {}; emit(); });   // de qué programa viene cada fuente abierta
  db.watch('programs', v => { state.programs = fixProgs(v); emit(); });
  db.watch('slotOrder', v => { applyOrder(v); emit(); });   // orden de los botones de los switches
  db.watch('draft', v => {   // no pisar con datos remotos lo que se está editando y aún no se ha guardado
    const n = fixGraphics(v, true);
    for (const id in pending) if (pending[id] && state.draft[id]) n[id] = state.draft[id];
    state.draft = n; emit();
  });
  db.watch('program', v => { state.program = fixGraphics(v, false); emit(); });
  db.watch('headlines', v => { state.headlines = fixLib(v); emit(); });
  db.watch('templates', v => { state.templates = fixLib(v); emit(); });
}

// ---------- Historial (deshacer / rehacer) por gráfico ----------
const hist = {}; let markNext = true, autoPreview = true;
const H = id => hist[id] || (hist[id] = { past: [], future: [], last: 0 });
export const markStep = () => { markNext = true; };          // el siguiente cambio abre un paso nuevo del historial
export const setAutoPreview = v => { autoPreview = !!v; };   // en Diseño, editar no enciende el switch de PREVIEW
export const canUndo = id => !!(hist[id] && hist[id].past.length);
export const canRedo = id => !!(hist[id] && hist[id].future.length);
function pushNow(id) { const h = H(id); h.past.push(clone(state.draft[id])); if (h.past.length > 100) h.past.shift(); h.future = []; h.last = 0; markNext = true; }
function restore(id, snapshot) {
  const keep = state.draft[id].visible; snapshot.id = id; snapshot.visible = keep;
  state.draft[id] = snapshot; H(id).last = 0; markNext = true; emit(); saveDraft(id);
}
export function undo(id) {
  const h = H(id); if (!h.past.length || !state.draft[id]) return false;
  h.future.push(clone(state.draft[id])); restore(id, h.past.pop()); return true;
}
export function redo(id) {
  const h = H(id); if (!h.future.length || !state.draft[id]) return false;
  h.past.push(clone(state.draft[id])); restore(id, h.future.pop()); return true;
}

const timers = {}, pending = {};
function saveDraft(id) {   // guardado con pequeño retardo mientras se escribe o se arrastra
  pending[id] = true; clearTimeout(timers[id]);
  timers[id] = setTimeout(() => { pending[id] = false; db.set(`draft/${id}`, state.draft[id]); }, 250);
}
// Modifica el borrador. Por defecto lo deja visible en PREVIEW para ver el cambio al instante.
export function mutate(id, fn, { preview = autoPreview, history = true } = {}) {
  const g = state.draft[id]; if (!g) return;
  let before = null, h = null, was = null;
  if (history) {   // un gesto continuo (arrastrar, escribir) cuenta como un solo paso
    h = H(id); const now = Date.now();
    if (markNext || now - h.last > 800) { before = JSON.stringify(g); was = { m: markNext, f: h.future }; h.past.push(JSON.parse(before)); if (h.past.length > 100) h.past.shift(); h.future = []; markNext = false; }
    h.last = now;
  }
  fn(g);
  if (before !== null && JSON.stringify(g) === before) { h.past.pop(); h.future = was.f; markNext = was.m; }   // no cambió nada: no ensucia el historial
  if (preview) g.visible = true;
  emit(); saveDraft(id);
}
export function setGraphic(id, g) {   // reemplaza el gráfico completo del borrador (plantilla / diseño guardado)
  if (state.draft[id]) pushNow(id);
  state.draft[id] = { ...clone(g), id, v: 2, visible: true };
  state.draft[id].elements = fixEls(state.draft[id].elements);
  emit(); return db.set(`draft/${id}`, state.draft[id]);
}
export function preview(id) { state.draft[id].visible = true; emit(); return db.set(`draft/${id}`, state.draft[id]); }
export function unpreview(id) { state.draft[id].visible = false; emit(); return db.set(`draft/${id}`, state.draft[id]); }
export function clearDraft(id) {
  pushNow(id);
  state.draft[id].elements.forEach(e => { if (e.type === 'text') e.text = ''; });
  emit(); return db.set(`draft/${id}`, state.draft[id]);
}
export async function show(id) {            // PREVIEW -> AIRE
  state.draft[id].visible = true; await db.set(`draft/${id}`, state.draft[id]);
  return db.set(`program/${id}`, { ...state.draft[id], visible: true });
}
export function update(id) {                // actualiza contenido en aire sin cambiar su visibilidad
  const on = !!(state.program[id] && state.program[id].visible);
  return db.set(`program/${id}`, { ...state.draft[id], visible: on });
}
export async function hide(id) {
  state.draft[id].visible = false; await db.set(`draft/${id}`, state.draft[id]);
  if (state.program[id]) return db.set(`program/${id}/visible`, false);
}

// Cambios EN VIVO de un solo elemento (pausar/reanudar cinta, activar/ocultar): se escriben en el borrador y
// directamente en /program solo en ese campo, sin tocar el resto del contenido en aire.
export function live(id, elId, patch) {
  mutate(id, g => { const e = g.elements.find(x => x.id === elId); if (e) Object.assign(e, patch); }, { preview: false, history: false });
  const pg = state.program[id]; if (!pg) return;
  const i = arr(pg.elements).findIndex(x => x.id === elId); if (i < 0) return;
  for (const k in patch) { pg.elements[i][k] = patch[k]; db.set(`program/${id}/elements/${i}/${k}`, patch[k]); }
  emit();
}

// ---------- Gráficos adicionales ----------
export function addSlot(name) {
  const id = uid(), rec = { name, ts: Date.now() };
  state.slots[id] = rec; setCustomSlots(state.slots); state.draft[id] = newGraphic(id); emit();
  db.set(`slots/${id}`, rec); db.set(`draft/${id}`, state.draft[id]); return id;
}
export function moveSlot(id, to) {   // cambia la posición de un gráfico en los switches y en «Editando»
  const ids = Object.keys(SLOTS), from = ids.indexOf(id); if (from < 0) return;
  to = Math.max(0, Math.min(ids.length - 1, to)); if (from === to) return;
  ids.splice(from, 1); ids.splice(to, 0, id);
  const full = getOrder(), open = new Set(ids); let n = 0;   // las fuentes cerradas conservan su sitio; las abiertas ocupan los suyos en el nuevo orden
  const merged = full.map(k => (open.has(k) ? ids[n++] : k));
  applyOrder(merged); emit(); return db.set('slotOrder', merged);
}
export function renameSlot(id, name) {   // cualquier gráfico se puede renombrar (los integrados guardan su nombre en /slotNames)
  name = String(name || '').trim(); if (!name || !SLOTS[id]) return;
  if (state.slots[id]) { state.slots[id].name = name; setCustomSlots(state.slots); emit(); return db.set(`slots/${id}/name`, name); }
  state.names[id] = name; setNames(state.names); emit(); return db.set(`slotNames/${id}`, name);
}
export async function removeSlot(id) {
  if (!SLOTS[id] || !SLOTS[id].custom) return;
  delete state.slots[id]; delete hist[id]; setCustomSlots(state.slots); delete state.draft[id]; delete state.program[id]; emit();
  delete state.openSrc[id]; db.set(`openSources/${id}`, null);
  { const o = getOrder().filter(k => k !== id); applyOrder(o); db.set('slotOrder', o); }
  await db.set(`program/${id}`, null); await db.set(`draft/${id}`, null); return db.set(`slots/${id}`, null);
}

// ---------- Titulares guardados y plantillas personalizadas ----------
const byTs = o => Object.values(o).sort((a, b) => (b.ts || 0) - (a.ts || 0));
export const headlines = () => byTs(state.headlines);
export const templates = () => byTs(state.templates);
function putLib(path, bag, rec) {
  const id = rec.id || uid(), r = { ...clone(rec), id, ts: Date.now() };
  bag[id] = r; emit(); db.set(`${path}/${id}`, r); return id;
}
function delLib(path, bag, id) { delete bag[id]; emit(); return db.set(`${path}/${id}`, null); }
export const saveHeadline = rec => putLib('headlines', state.headlines, rec);
export const deleteHeadline = id => delLib('headlines', state.headlines, id);
export const saveTemplate = rec => putLib('templates', state.templates, rec);
export const deleteTemplate = id => delLib('templates', state.templates, id);

// ---------- Programas: un conjunto de FUENTES elegidas (diseños, textos, logos, cintilla, nombres y orden) ----------
// Guardar un programa guarda solo las fuentes elegidas y las CIERRA (salen de Operación y del aire). Abrir las vuelve a cargar
// sumándolas a las que ya hay. Cada fuente abierta desde un programa queda marcada en /openSources para poder cerrarlas juntas.
export const programs = () => byTs(state.programs);
const srcName = (p, id) => (p.slots[id] && p.slots[id].name) || p.names[id] || DEFAULT_NAMES[id] || 'Fuente';
export const progIds = p => (p.order.length ? p.order : Object.keys(p.graphics)).filter(id => p.graphics[id]);
export const progNames = p => progIds(p).map(id => srcName(p, id));
export const sourceIds = () => Object.keys(SLOTS);                          // fuentes abiertas ahora, en orden
export const sourceProgram = id => state.openSrc[id] || null;                // id del programa del que viene la fuente (o null si no está guardada)
export const progOpenIds = pid => Object.keys(SLOTS).filter(id => state.openSrc[id] === pid);   // fuentes abiertas de ese programa
export const savedOpenIds = () => Object.keys(SLOTS).filter(id => state.openSrc[id] && state.programs[state.openSrc[id]]);  // abiertas y guardadas en algún programa

// Forma canónica para comparar (Firebase reordena claves y quita vacíos)
const canon = o => Array.isArray(o) ? o.map(canon) : (o && typeof o === 'object')
  ? Object.fromEntries(Object.keys(o).sort().filter(k => o[k] !== null && o[k] !== undefined && !(Array.isArray(o[k]) && !o[k].length)).map(k => [k, canon(o[k])])) : o;
const body = g => { const c = clone(g); delete c.visible; delete c.id; return JSON.stringify(canon(c)); };
export function changedIds(ids) {   // fuentes abiertas que ya no coinciden con lo guardado en su programa
  return ids.filter(id => { const p = state.programs[state.openSrc[id]], saved = p && p.graphics[id]; return saved && state.draft[id] && body(saved) !== body(state.draft[id]); });
}

// Guarda las fuentes `ids` con ese nombre (si se da `id` de programa, lo reemplaza; con merge solo cambia esas fuentes y conserva el resto).
export function saveProgram(name, id, ids, { merge = false } = {}) {
  const old = merge && id && state.programs[id], graphics = old ? clone(old.graphics) : {}, slots = old ? clone(old.slots) : {}, names = old ? clone(old.names) : {};
  let order = old ? progIds(old) : [];
  ids = ids.filter(k => SLOTS[k] && state.draft[k]);
  ids.forEach(k => {
    const g = clone(state.draft[k]); delete g.visible; graphics[k] = g;
    if (SLOTS[k].custom && state.slots[k]) slots[k] = clone(state.slots[k]); else delete slots[k];
    if (!SLOTS[k].custom && state.names[k]) names[k] = state.names[k]; else delete names[k];
  });
  const mine = Object.keys(SLOTS).filter(k => ids.includes(k));
  order = [...order.filter(k => graphics[k]), ...mine.filter(k => !order.includes(k))];
  return putLib('programs', state.programs, { id, name, order, slots, names, graphics });
}

// Cierra fuentes: salen del aire, de PREVIEW, de Operación y de Diseño. Las integradas quedan «cerradas»; las añadidas se quitan.
// Su contenido sigue guardado en el programa, así que se recupera con «Abrir».
export async function closeSources(ids) {
  ids = ids.filter(k => SLOTS[k]); if (!ids.length) return;
  applyOrder(getOrder());   // fija el lugar que ocupan ahora, también el de las que se cierran
  const custom = {}; ids.forEach(k => { custom[k] = !!SLOTS[k].custom; });
  ids.forEach(k => {
    clearTimeout(timers[k]); pending[k] = false; delete hist[k];
    delete state.draft[k]; delete state.program[k]; delete state.openSrc[k];
    if (custom[k]) delete state.slots[k]; else state.closed[k] = true;
  });
  setCustomSlots(state.slots); setClosed(state.closed); emit();
  const order = getOrder(), w = [];   // copia antes de escribir: los observadores de la base de datos reaccionan a cada escritura
  ids.forEach(k => {
    w.push(db.set(`program/${k}`, null), db.set(`draft/${k}`, null), db.set(`openSources/${k}`, null));
    w.push(custom[k] ? db.set(`slots/${k}`, null) : db.set(`closedSlots/${k}`, true));
  });
  w.push(db.set('slotOrder', order));
  await Promise.all(w);
}

export const deleteProgram = id => {
  untagProgram(id); return delLib('programs', state.programs, id);
};
function untagProgram(pid) {   // al eliminar un programa, sus fuentes abiertas dejan de estar «guardadas»
  for (const k in state.openSrc) if (state.openSrc[k] === pid) { delete state.openSrc[k]; db.set(`openSources/${k}`, null); }
}
export function renameProgram(id, name) {
  if (!state.programs[id] || !name) return; state.programs[id].name = name; emit(); return db.set(`programs/${id}/name`, name);
}
export function duplicateProgram(id) {
  const p = state.programs[id]; if (!p) return;
  const c = clone(p); delete c.id; c.name = p.name + ' (copia)'; return putLib('programs', state.programs, c);
}
export const openConflicts = pid => { const p = state.programs[pid]; return p ? progIds(p).filter(k => SLOTS[k]) : []; };   // fuentes abiertas que Abrir reemplazaría

// Abre las fuentes de un programa SUMÁNDOLAS a las que ya hay; si una con el mismo id ya está abierta, la reemplaza.
export async function openProgram(pid) {
  const p = state.programs[pid]; if (!p) return [];
  const ids = progIds(p);
  ids.forEach(k => {
    clearTimeout(timers[k]); pending[k] = false; delete hist[k];
    const pg = state.program[k]; if (pg && pg.visible) { pg.visible = false; db.set(`program/${k}/visible`, false); }   // si la fuente reemplazada estaba al aire, sale
    if (isBuiltin(k)) { delete state.closed[k]; if (p.names[k]) state.names[k] = p.names[k]; else delete state.names[k]; }
    else state.slots[k] = p.slots[k] ? clone(p.slots[k]) : { name: 'Fuente', ts: Date.now() };
  });
  setCustomSlots(state.slots); setClosed(state.closed); setNames(state.names);
  const full = getOrder(); ids.forEach(k => { if (!full.includes(k)) full.push(k); }); applyOrder(full);   // cada fuente vuelve al lugar que tenía en los switches
  ids.forEach(k => {
    const g = { ...clone(p.graphics[k]), id: k, v: 2, visible: false }; g.elements = fixEls(g.elements);
    state.draft[k] = g; state.openSrc[k] = pid;
  });
  markNext = true; emit();
  const order = getOrder(), w = [];   // copias antes de escribir: los observadores de la base de datos reaccionan a cada escritura
  const recs = ids.map(k => [k, isBuiltin(k), clone(state.slots[k] || null), state.names[k] || null, clone(state.draft[k])]);
  recs.forEach(([k, builtin, slot, name, draft]) => {
    w.push(builtin ? db.set(`closedSlots/${k}`, null) : db.set(`slots/${k}`, slot));
    if (builtin) w.push(db.set(`slotNames/${k}`, name));
    w.push(db.set(`openSources/${k}`, pid), db.set(`draft/${k}`, draft));
  });
  w.push(db.set('slotOrder', order));
  await Promise.all(w);
  return ids;
}

// Fuentes integradas que están cerradas (eliminadas o guardadas en un programa) y se pueden restaurar en blanco.
export const closedBuiltins = () => Object.keys(state.closed).filter(k => state.closed[k] && isBuiltin(k));
export async function restoreBuiltin(id) {
  if (!isBuiltin(id) || !state.closed[id]) return;
  delete state.closed[id]; delete state.names[id]; setClosed(state.closed); setNames(state.names);
  state.draft[id] = newGraphic(id); const g = clone(state.draft[id]); emit();
  await Promise.all([db.set(`closedSlots/${id}`, null), db.set(`slotNames/${id}`, null), db.set(`draft/${id}`, g)]);
}
