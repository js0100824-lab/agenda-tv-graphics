// Escenario 1920x1080 compartido por la salida OBS y los monitores del panel.
import { buildGraphic, fitAll } from './templates.js';
import { animateIn, animateOut } from './animations.js';

export function createStage(root) {
  const stage = document.createElement('div');
  stage.className = 'stage'; root.appendChild(stage);
  const live = new Map(); let last = {};
  const fit = () => { stage.style.transform = `scale(${Math.min(root.clientWidth / 1920, root.clientHeight / 1080)})`; };
  new ResizeObserver(fit).observe(root); fit();

  function apply(graphics) {
    last = graphics || {};
    const ids = new Set([...Object.keys(last), ...live.keys()]);
    for (const id of ids) {
      const g = last[id], cur = live.get(id), want = !!(g && g.visible);
      if (want && !cur) {
        const el = buildGraphic(g); stage.appendChild(el); fitAll(el);
        live.set(id, { el, sig: JSON.stringify(g), anim: g.anim }); animateIn(el, g.anim);
      } else if (want && cur && !cur.leaving) {
        const sig = JSON.stringify(g);
        if (sig !== cur.sig) { const n = buildGraphic(g); cur.el.replaceWith(n); fitAll(n); cur.el = n; cur.sig = sig; cur.anim = g.anim; }
      } else if (!want && cur && !cur.leaving) {
        cur.leaving = true;
        animateOut(cur.el, (g && g.anim) || cur.anim).catch(() => {}).then(() => {
          cur.el.remove(); live.delete(id); apply(last);   // si se pidió mostrar de nuevo durante la salida
        });
      }
    }
  }
  return { apply };
}
