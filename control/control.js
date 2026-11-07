import * as store from '../modules/store.js';
import * as db from '../modules/firebase.js';
import { createStage } from '../modules/stage.js';
import { TEMPLATES, FIT_MODES, layoutOf } from '../modules/templates.js';
import { ANIMS } from '../modules/animations.js';

const $ = id => document.getElementById(id);
const prev = createStage($('mPrev')), prog = createStage($('mProg'));
let sel = 'headline', filled = null, elSel = null, elFilled = null;
const NUM = ['size', 'x', 'y', 'w', 'h'];

$('obsurl').value = new URL('../output/index.html', location.href).href;
db.onStatus(s => { const e = $('status'); e.className = 'status ' + s;
  e.textContent = { local: 'MODO LOCAL (sin Firebase)', connecting: 'Conectando…', online: 'Firebase conectado', offline: 'Sin conexión' }[s]; });
$('animIn').innerHTML = Object.entries(ANIMS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('el_fit').innerHTML = Object.entries(FIT_MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

function buildQuick(s) {
  $('quick').innerHTML = '';
  for (const id in TEMPLATES) {
    const on = s.program[id] && s.program[id].visible, b = document.createElement('button');
    b.className = id === sel ? 'sel' : '';
    b.innerHTML = `${TEMPLATES[id].name}<span class="st ${on ? 'on' : ''}">${on ? 'EN AIRE' : 'OFF'}</span>`;
    b.onclick = () => { sel = id; filled = null; elFilled = null; elSel = null; render(store.get()); }; $('quick').append(b);
  }
}
function fillForm(g) {          // solo al cambiar de gráfico o cargar un guardado, para no pisar lo que se escribe
  $('fields').innerHTML = TEMPLATES[sel].fields.map(([k, l]) => `<label>${l}</label><input data-k="${k}">`).join('');
  $('fields').querySelectorAll('input').forEach(i => { i.value = g.fields[i.dataset.k] ?? '';
    i.oninput = () => store.editDraft(sel, { fields: { [i.dataset.k]: i.value } }); });
  $('animIn').value = g.anim.in; $('dur').value = g.anim.duration;
  $('cAccent').value = g.style.accent; $('cBg').value = g.style.bg; $('cText').value = g.style.text;
  filled = sel;
}
const curEl = g => layoutOf(g).find(e => e.id === elSel);
function fillElForm(g) {
  const texts = layoutOf(g).filter(e => e.type === 'text');
  if (!elSel || !texts.some(e => e.id === elSel)) elSel = (texts.find(e => e.id === 'headline') || texts[0]).id;
  $('elSel').innerHTML = texts.map(e => `<option value="${e.id}">${e.name || e.id}</option>`).join(''); $('elSel').value = elSel;
  const e = curEl(g); NUM.forEach(k => $('el_' + k).value = e[k]); $('elR').value = e.size; $('el_fit').value = e.fit;
  elFilled = sel + ':' + elSel;
}
function buildLib(s) {
  const items = Object.entries(s.lib[sel] || {}).sort((a, b) => a[1].ts - b[1].ts), box = $('lib');
  box.innerHTML = items.length ? '' : '<div class="empty">Aún no hay guardados. Escribe un texto y pulsa “Guardar en lista”.</div>';
  for (const [key, it] of items) {
    const r = document.createElement('div'); r.className = 'row';
    r.innerHTML = `<span></span><button data-a="load">Cargar</button><button data-a="air" class="air">Al aire</button><button data-a="rep">Reemplazar</button><button data-a="del" class="x">✕</button>`;
    r.firstChild.textContent = TEMPLATES[sel].fields.map(([k]) => it.fields[k]).filter(Boolean).join('  ·  ') || '(vacío)';
    r.onclick = async ev => { const a = ev.target.dataset.a; if (!a) return;
      if (a === 'del') return store.deleteItem(sel, key);
      if (a === 'rep') return store.replaceItem(sel, key);
      await store.loadItem(sel, key); filled = null; render(store.get());
      if (a === 'air') store.show(sel); };
    box.append(r);
  }
}
function render(s) {
  prev.apply(s.draft); prog.apply(s.program); buildQuick(s); buildLib(s);
  const g = s.draft[sel]; if (!g) return;
  if (filled !== sel) fillForm(g);
  if (elFilled !== sel + ':' + elSel) fillElForm(g);
}
store.subscribe(render);

const tune = p => store.editElement(sel, elSel, p);
NUM.forEach(k => $('el_' + k).oninput = e => { tune({ [k]: +e.target.value }); if (k === 'size') $('elR').value = e.target.value; });
$('elR').oninput = e => { $('el_size').value = e.target.value; tune({ size: +e.target.value }); };
$('el_fit').onchange = e => tune({ fit: e.target.value });
$('elSel').onchange = e => { elSel = e.target.value; fillElForm(store.get().draft[sel]); };
$('animIn').onchange = e => store.editDraft(sel, { anim: { in: e.target.value } });
$('dur').oninput = e => store.editDraft(sel, { anim: { duration: +e.target.value } });
$('cAccent').oninput = e => store.editDraft(sel, { style: { accent: e.target.value } });
$('cBg').oninput = e => store.editDraft(sel, { style: { bg: e.target.value } });
$('cText').oninput = e => store.editDraft(sel, { style: { text: e.target.value } });
$('bPrev').onclick = () => store.preview(sel);
$('bShow').onclick = () => store.show(sel);
$('bUpd').onclick = () => store.update(sel);
$('bHide').onclick = () => store.hide(sel);
$('bSave').onclick = () => store.saveItem(sel);
$('bClr').onclick = () => { store.clearDraft(sel); filled = null; render(store.get()); };
store.init();
