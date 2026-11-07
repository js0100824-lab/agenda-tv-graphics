import * as store from '../modules/store.js';
import * as db from '../modules/firebase.js';
import { createStage } from '../modules/stage.js';
import { TEMPLATES } from '../modules/templates.js';
import { ANIMS } from '../modules/animations.js';

const $ = id => document.getElementById(id);
const prev = createStage($('mPrev')), prog = createStage($('mProg'));
let sel = 'headline', filled = null;

$('obsurl').value = new URL('../output/index.html', location.href).href;
db.onStatus(s => { const e = $('status'); e.className = 'status ' + s;
  e.textContent = { local: 'MODO LOCAL (sin Firebase)', connecting: 'Conectando…', online: 'Firebase conectado', offline: 'Sin conexión' }[s]; });
$('animIn').innerHTML = Object.entries(ANIMS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

function buildQuick(s) {
  $('quick').innerHTML = '';
  for (const id in TEMPLATES) {
    const on = s.program[id] && s.program[id].visible, b = document.createElement('button');
    b.className = id === sel ? 'sel' : '';
    b.innerHTML = `${TEMPLATES[id].name}<span class="st ${on ? 'on' : ''}">${on ? 'EN AIRE' : 'OFF'}</span>`;
    b.onclick = () => { sel = id; filled = null; render(s); }; $('quick').append(b);
  }
}
function fillForm(g) {          // solo al cambiar de gráfico, para no pisar lo que se escribe
  $('fields').innerHTML = TEMPLATES[sel].fields.map(([k, l]) => `<label>${l}</label><input data-k="${k}">`).join('');
  $('fields').querySelectorAll('input').forEach(i => { i.value = g.fields[i.dataset.k] ?? '';
    i.oninput = () => store.editDraft(sel, { fields: { [i.dataset.k]: i.value } }); });
  $('animIn').value = g.anim.in; $('dur').value = g.anim.duration;
  $('cAccent').value = g.style.accent; $('cBg').value = g.style.bg; $('cText').value = g.style.text;
  filled = sel;
}
function render(s) {
  prev.apply(s.draft); prog.apply(s.program); buildQuick(s);
  if (s.draft[sel] && filled !== sel) fillForm(s.draft[sel]);
}
store.subscribe(render);

$('animIn').onchange = e => store.editDraft(sel, { anim: { in: e.target.value } });
$('dur').oninput = e => store.editDraft(sel, { anim: { duration: +e.target.value } });
$('cAccent').oninput = e => store.editDraft(sel, { style: { accent: e.target.value } });
$('cBg').oninput = e => store.editDraft(sel, { style: { bg: e.target.value } });
$('cText').oninput = e => store.editDraft(sel, { style: { text: e.target.value } });
$('bPrev').onclick = () => store.preview(sel);
$('bShow').onclick = () => store.show(sel);
$('bUpd').onclick = () => store.update(sel);
$('bHide').onclick = () => store.hide(sel);
$('bClr').onclick = () => { store.clearDraft(sel); filled = null; render(store.get()); };
store.init();
