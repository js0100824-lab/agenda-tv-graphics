// Estado central: /draft (lo que editas y ves en PREVIEW) y /program (lo que ve OBS).
// Además: /headlines (titulares guardados) y /templates (plantillas personalizadas).
import * as db from './firebase.js';
import { SLOTS, newGraphic, arr, uid } from './templates.js';

const state = { draft: {}, program: {}, headlines: {}, templates: {} };
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

export async function init() {
  await db.connect();
  db.watch('draft', v => { state.draft = fixGraphics(v, true); emit(); });
  db.watch('program', v => { state.program = fixGraphics(v, false); emit(); });
  db.watch('headlines', v => { state.headlines = fixLib(v); emit(); });
  db.watch('templates', v => { state.templates = fixLib(v); emit(); });
}

const timers = {};
function saveDraft(id) {   // guardado con pequeño retardo mientras se escribe o se arrastra
  clearTimeout(timers[id]);
  timers[id] = setTimeout(() => db.set(`draft/${id}`, state.draft[id]), 250);
}
// Modifica el borrador. Por defecto lo deja visible en PREVIEW para ver el cambio al instante.
export function mutate(id, fn, { preview = true } = {}) {
  const g = state.draft[id]; if (!g) return;
  fn(g); if (preview) g.visible = true;
  emit(); saveDraft(id);
}
export function setGraphic(id, g) {   // reemplaza el gráfico completo del borrador (plantilla / diseño guardado)
  state.draft[id] = { ...clone(g), id, v: 2, visible: true };
  state.draft[id].elements = fixEls(state.draft[id].elements);
  emit(); return db.set(`draft/${id}`, state.draft[id]);
}
export function preview(id) { state.draft[id].visible = true; emit(); return db.set(`draft/${id}`, state.draft[id]); }
export function clearDraft(id) {
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
  mutate(id, g => { const e = g.elements.find(x => x.id === elId); if (e) Object.assign(e, patch); }, { preview: false });
  const pg = state.program[id]; if (!pg) return;
  const i = arr(pg.elements).findIndex(x => x.id === elId); if (i < 0) return;
  for (const k in patch) { pg.elements[i][k] = patch[k]; db.set(`program/${id}/elements/${i}/${k}`, patch[k]); }
  emit();
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
