// Estado central: /draft (lo que editas y ves en PREVIEW) y /program (lo que ve OBS).
import * as db from './firebase.js';
import { TEMPLATES, newGraphic, arr, clone } from './templates.js';

const state = { draft: {}, program: {}, lib: {} };
const subs = new Set();
const emit = () => subs.forEach(f => f(state));
export const subscribe = f => { subs.add(f); f(state); };
export const get = () => state;

export async function init() {
  await db.connect();
  db.watch('draft', v => { state.draft = v || {}; for (const id in TEMPLATES) { const g = state.draft[id] || (state.draft[id] = newGraphic(id));
      g.fields = g.fields || {}; g.layout = g.layout ? arr(g.layout) : clone(TEMPLATES[id].layout); }
    emit(); });
  db.watch('library', v => { state.lib = v || {}; emit(); });
  db.watch('program', v => { state.program = v || {}; emit(); });
}

const timers = {};
function saveDraft(id) {   // guardado con pequeño retardo mientras se escribe
  clearTimeout(timers[id]);
  timers[id] = setTimeout(() => db.set(`draft/${id}`, state.draft[id]), 250);
}
export function editDraft(id, patch) {
  const g = state.draft[id];
  for (const k of ['fields', 'style', 'anim']) if (patch[k]) g[k] = { ...g[k], ...patch[k] };
  emit(); saveDraft(id);
}
export function preview(id)  { state.draft[id].visible = true;  emit(); return db.set(`draft/${id}`, state.draft[id]); }
export function clearDraft(id) {
  state.draft[id].fields = Object.fromEntries(Object.keys(TEMPLATES[id].defaults).map(k => [k, '']));
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

export function editElement(id, elId, patch) {   // cambia SOLO ese elemento
  const g = state.draft[id]; g.layout = arr(g.layout);
  Object.assign(g.layout.find(e => e.id === elId) || {}, patch); emit(); saveDraft(id);
}
// Lista de guardados por tipo de gráfico: /library/<plantilla>/<item>
export const saveItem = id => db.set(`library/${id}/i${Date.now().toString(36)}`, { fields: { ...state.draft[id].fields }, ts: Date.now() });
export const replaceItem = (id, key) => db.set(`library/${id}/${key}`, { fields: { ...state.draft[id].fields }, ts: Date.now() });
export const deleteItem = (id, key) => db.set(`library/${id}/${key}`, null);
export function loadItem(id, key) {
  const it = state.lib[id] && state.lib[id][key]; if (!it) return;
  state.draft[id].fields = { ...it.fields }; emit(); return db.set(`draft/${id}`, state.draft[id]);
}
