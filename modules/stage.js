// Escenario 1920x1080 compartido por la salida OBS y los monitores del panel.
// Cada gráfico se sincroniza ELEMENTO por ELEMENTO: solo se reconstruye lo que cambió, así editar el titular
// no reinicia la cintilla y pausar/reanudar la cinta se aplica en caliente, sin recargar nada.
import { buildElement, arr } from './templates.js';
import { animateIn, animateOut } from './animations.js';

export function createStage(root, opts = {}) {
  const stage = document.createElement('div');
  stage.className = 'stage'; root.appendChild(stage);
  const live = new Map(); let last = {};
  const scale = () => Math.min(root.clientWidth / 1920, root.clientHeight / 1080) || 1;
  const fit = () => { stage.style.transform = `scale(${scale()})`; };
  new ResizeObserver(fit).observe(root); fit();

  const sigOf = e => JSON.stringify({ ...e, paused: 0 });
  const mount = n => { if (n._fit) n._fit(); if (n._mount) n._mount(); };

  function sync(cur, g) {
    const els = arr(g.elements).filter(e => e && e.on !== false);
    const keep = new Set();
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
    for (const [id, rec] of cur.nodes) if (!keep.has(id)) { rec.node.remove(); cur.nodes.delete(id); }
  }

  function apply(graphics) {
    last = graphics || {};
    const ids = new Set([...Object.keys(last), ...live.keys()]);
    for (const id of ids) {
      const g = last[id], cur = live.get(id), want = !!(g && g.visible);
      if (want && !cur) {
        const el = document.createElement('div'); el.className = 'gfx'; stage.appendChild(el);
        const rec = { el, nodes: new Map(), anim: g.anim }; live.set(id, rec);
        sync(rec, g); if (!opts.static) animateIn(el, g.anim).catch(() => {});
      } else if (want && cur && !cur.leaving) {
        sync(cur, g); cur.anim = g.anim;
      } else if (!want && cur && !cur.leaving) {
        if (opts.static) { cur.el.remove(); live.delete(id); continue; }
        cur.leaving = true;
        animateOut(cur.el, (g && g.anim) || cur.anim).catch(() => {}).then(() => {
          cur.el.remove(); live.delete(id); apply(last);   // si se pidió mostrar de nuevo durante la salida
        });
      }
    }
  }

  const refit = () => live.forEach(rec => rec.nodes.forEach(r => mount(r.node)));
  if (document.fonts) { document.fonts.ready.then(refit); document.fonts.addEventListener('loadingdone', refit); }
  return { apply, el: stage, scale };
}
