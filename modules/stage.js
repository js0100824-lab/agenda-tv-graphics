// Escenario 1920x1080 compartido por la salida OBS y los monitores del panel.
// Cada gráfico se sincroniza ELEMENTO por ELEMENTO: solo se reconstruye lo que cambió, así editar el titular
// no reinicia la cintilla y pausar/reanudar la cinta se aplica en caliente, sin recargar nada.
// Animaciones: el gráfico entra y sale con el motor de animations.js, como grupo completo o elemento por elemento.
import { buildElement, arr, layerOf } from './templates.js?v=13d';
import { normAnim, mergeAnim, playAnim, stopAnim, bbox } from './animations.js?v=13d';

const FULL = { x: 0, y: 0, w: 1920, h: 1080 };
const wait = ms => new Promise(r => setTimeout(r, ms));

export function createStage(root, opts = {}) {
  const stage = document.createElement('div');
  stage.className = 'stage'; root.appendChild(stage);
  const live = new Map(); let last = {};
  const scale = () => Math.min(root.clientWidth / 1920, root.clientHeight / 1080) || 1;
  const fit = () => { stage.style.transform = `scale(${scale()})`; };
  new ResizeObserver(fit).observe(root); fit();

  // la animación, el grupo y el bloqueo no afectan al dibujo: no reconstruyen el elemento
  const sigOf = e => JSON.stringify({ ...e, paused: 0, anim: 0, group: 0, locked: 0 });
  const mount = n => { if (n._fit) n._fit(); if (n._mount) n._mount(); };
  const visEls = g => arr(g.elements).filter(e => e && e.on !== false);

  function sync(cur, g) {
    cur.g = g;
    const els = visEls(g), keep = new Set();
    els.forEach((e, i) => {
      keep.add(e.id);
      const sig = sigOf(e); let rec = cur.nodes.get(e.id);
      if (!rec || rec.sig !== sig) {
        const n = buildElement(e, opts); n.style.zIndex = i;
        if (rec) rec.node.replaceWith(n); else cur.el.append(n);
        rec = { node: n, sig }; cur.nodes.set(e.id, rec); mount(n);
      } else rec.node.style.zIndex = i;
      if (rec.node._pause) rec.node._pause(!!e.paused);
    });
    for (const [id, rec] of cur.nodes) if (!keep.has(id)) { stopAnim(rec.node); rec.node.remove(); cur.nodes.delete(id); }
  }

  const stopAll = rec => { stopAnim(rec.el); rec.nodes.forEach(r => stopAnim(r.node)); };

  // Reproduce una fase ('in' | 'out') de un gráfico. Promesa: se resuelve cuando todo ha terminado.
  function run(rec, phase) {
    const g = rec.g, s = normAnim(g.anim), els = visEls(g);
    if (rec.lastMode && rec.lastMode !== s.mode) stopAll(rec);
    rec.lastMode = s.mode;
    if (s.mode !== 'elements') return playAnim(rec.el, phase, s, { a: bbox(els), b: FULL });
    stopAnim(rec.el);
    const n = els.length;
    return Promise.all(els.map((e, i) => {
      const r = rec.nodes.get(e.id); if (!r) return null;
      const box = { x: +e.x || 0, y: +e.y || 0, w: +e.w || 0, h: +e.h || 0 };
      return playAnim(r.node, phase, mergeAnim(s, e.anim), { a: box, b: box }, (phase === 'in' ? i : n - 1 - i) * s.stagger);
    }));
  }

  function create(id, g) {
    const el = document.createElement('div'); el.className = 'gfx'; el.style.zIndex = layerOf(id); stage.appendChild(el);
    const rec = { el, nodes: new Map(), g, seq: 0, leaving: false, busy: false, tok: 0, temp: false };
    live.set(id, rec); sync(rec, g); return rec;
  }
  function enter(rec) { rec.seq++; rec.leaving = false; return run(rec, 'in'); }
  function leave(id, rec) {
    const q = ++rec.seq; rec.leaving = true;
    run(rec, 'out').then(() => {   // solo se elimina si nadie ha pedido mostrar de nuevo mientras salía
      if (rec.seq === q && rec.leaving) { stopAll(rec); rec.el.remove(); live.delete(id); }
    });
  }

  function apply(graphics) {
    last = graphics || {};
    const ids = new Set([...Object.keys(last), ...live.keys()]);
    for (const id of ids) {
      const g = last[id], cur = live.get(id), want = !!(g && g.visible);
      if (cur && cur.busy) { if (g) cur.g = g; continue; }   // hay una prueba de animación en curso
      if (want && !cur) { const rec = create(id, g); if (!opts.static) enter(rec); }
      else if (want && cur && !cur.leaving) sync(cur, g);
      else if (want && cur && cur.leaving) { sync(cur, g); enter(cur); }   // volver a mostrar durante la salida: se invierte con fluidez
      else if (!want && cur && !cur.leaving) {
        if (g) cur.g = g;
        if (opts.static) { cur.el.remove(); live.delete(id); continue; }
        leave(id, cur);
      }
    }
  }

  // ---------- Prueba de animaciones (solo editor): no toca lo que hay en aire ----------
  function release(id, rec) {
    rec.busy = false; stopAll(rec);
    const g = last[id];
    if (rec.temp && !(g && g.visible)) { rec.el.remove(); live.delete(id); } else { rec.temp = false; apply(last); }
  }
  async function test(id, mode) {   // mode: 'in' | 'out' | 'both' -> true si terminó, false si se interrumpió
    const g = last[id]; if (!g) return false;
    let rec = live.get(id);
    if (!rec) { rec = create(id, g); rec.temp = true; }
    else { stopAll(rec); rec.leaving = false; rec.seq++; rec.g = g; sync(rec, g); }
    const tok = ++rec.tok; rec.busy = true;
    const alive = () => rec.tok === tok;
    if (mode === 'in' || mode === 'both') { await run(rec, 'in'); if (!alive()) return false; }
    if (mode === 'both') { await wait(1000); if (!alive()) return false; }
    if (mode === 'out' || mode === 'both') { await run(rec, 'out'); if (!alive()) return false; await wait(450); if (!alive()) return false; }
    release(id, rec); return true;
  }
  function stopTest(id) { const rec = live.get(id); if (rec && rec.busy) { rec.tok++; release(id, rec); } }

  const refit = () => live.forEach(rec => rec.nodes.forEach(r => mount(r.node)));
  if (document.fonts) { document.fonts.ready.then(refit); document.fonts.addEventListener('loadingdone', refit); }
  return { apply, el: stage, scale, test, stopTest };
}
