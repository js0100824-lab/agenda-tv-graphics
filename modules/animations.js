// Biblioteca de animaciones de entrada / salida (Web Animations API).
// Cada animación se define por su estado OCULTO (H); la entrada va de H a "visible" y la salida hace el camino
// inverso (o usa otra animación elegida). Así toda entrada tiene su salida equivalente.
// Contexto: a = rectángulo (en px del escenario) de lo que se anima; b = caja del nodo animado (para recortes).
const FULL = { x: 0, y: 0, w: 1920, h: 1080 };
const OPP = { left: 'right', right: 'left', up: 'down', down: 'up' };
const MARGIN = 40;
const SHOWN = { transform: 'none', opacity: 1, filter: 'none', clipPath: 'inset(0px 0px 0px 0px)' };
const EASE_IN = 'cubic-bezier(.22,.8,.2,1)', EASE_OUT = 'cubic-bezier(.6,.05,.3,1)';

const dist = (r, d) => d === 'left' ? -(r.x + r.w + MARGIN) : d === 'right' ? 1920 - r.x + MARGIN : d === 'up' ? -(r.y + r.h + MARGIN) : 1080 - r.y + MARGIN;
const mv = (r, d) => (d === 'left' || d === 'right' ? 'translateX(' : 'translateY(') + dist(r, d) + 'px)';
const cl = (t, r, b, l) => `inset(${[t, r, b, l].map(v => Math.max(0, Math.round(v)) + 'px').join(' ')})`;
// recorte que oculta TODO el contenido (a) dentro de la caja (b), por el lado indicado
const wipe = ({ a, b }, d) => d === 'right' ? cl(0, b.x + b.w - a.x, 0, 0) : d === 'left' ? cl(0, 0, 0, a.x + a.w - b.x)
  : d === 'down' ? cl(0, 0, b.y + b.h - a.y, 0) : cl(a.y + a.h - b.y, 0, 0, 0);
const mask = ({ a, b }, d) => { if (d === 'right') { const m = a.x + a.w / 2; return cl(0, b.x + b.w - m, 0, m - b.x); }
  const m = a.y + a.h / 2; return cl(m - b.y, 0, b.y + b.h - m, 0); };

export const CATALOG = {
  bottom: { label: 'Desde abajo', hid: c => ({ transform: mv(c.a, 'down') }) },
  top: { label: 'Desde arriba', hid: c => ({ transform: mv(c.a, 'up') }) },
  left: { label: 'Desde la izquierda', hid: c => ({ transform: mv(c.a, 'left') }) },
  right: { label: 'Desde la derecha', hid: c => ({ transform: mv(c.a, 'right') }) },
  fade: { label: 'Desvanecimiento', hid: () => ({ opacity: 0 }) },
  slideH: { label: 'Deslizamiento horizontal', def: 'left', dirs: [['left', 'Desde la izquierda'], ['right', 'Desde la derecha']],
    hid: c => ({ opacity: 0, transform: `translateX(${c.dir === 'right' ? 170 : -170}px)` }) },
  slideV: { label: 'Deslizamiento vertical', def: 'down', dirs: [['up', 'Desde arriba'], ['down', 'Desde abajo']],
    hid: c => ({ opacity: 0, transform: `translateY(${c.dir === 'up' ? -110 : 110}px)` }) },
  zoomIn: { label: 'Zoom de entrada (crece)', hid: () => ({ opacity: 0, transform: 'scale(.4)' }) },
  zoomOut: { label: 'Zoom de salida (se encoge)', hid: () => ({ opacity: 0, transform: 'scale(1.8)' }) },
  softIn: { label: 'Aparición suave', only: 'in', hid: () => ({ opacity: 0, transform: 'translateY(18px)', filter: 'blur(8px)' }) },
  softOut: { label: 'Desaparición suave', only: 'out', hid: () => ({ opacity: 0, transform: 'translateY(-18px)', filter: 'blur(8px)' }) },
  wipeH: { label: 'Barrido horizontal', def: 'right', dirs: [['right', 'De izquierda a derecha'], ['left', 'De derecha a izquierda']], hid: c => ({ clipPath: wipe(c, c.dir) }) },
  wipeV: { label: 'Barrido vertical', def: 'down', dirs: [['down', 'De arriba a abajo'], ['up', 'De abajo a arriba']], hid: c => ({ clipPath: wipe(c, c.dir) }) },
  mask: { label: 'Revelado por máscara (desde el centro)', def: 'down', dirs: [['down', 'Vertical'], ['right', 'Horizontal']], hid: c => ({ clipPath: mask(c, c.dir) }) },
  scaleFade: { label: 'Escala y desvanecimiento', hid: () => ({ opacity: 0, transform: 'scale(.85)' }) },
  combo: { label: 'Entrada y salida combinadas (cruza)', def: 'left', dirs: [['left', 'Entra por la izquierda, sale por la derecha'], ['right', 'Entra por la derecha, sale por la izquierda'],
    ['up', 'Entra por arriba, sale por abajo'], ['down', 'Entra por abajo, sale por arriba']],
    hid: c => ({ opacity: 0, transform: mv(c.a, c.dir) }), hidOut: c => ({ opacity: 0, transform: mv(c.a, OPP[c.dir]) }) }
};
export const ANIMS = Object.fromEntries(Object.entries(CATALOG).map(([k, c]) => [k, c.label]));   // compatibilidad
export const AUTO_OUT = { softIn: 'softOut' };

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);
export function normAnim(a) {   // ajustes completos con valores por defecto (admite datos antiguos {in,duration})
  const x = a || {}, k = CATALOG[x.in] && CATALOG[x.in].only !== 'out' ? x.in : 'left';
  const o = x.out && x.out !== 'auto' && CATALOG[x.out] && CATALOG[x.out].only !== 'in' ? x.out : 'auto', base = num(x.duration, 700);
  return { in: k, out: o, dirIn: x.dirIn || '', dirOut: x.dirOut || '', inDur: num(x.inDur, base), outDur: num(x.outDur, base),
    inDelay: Math.max(0, num(x.inDelay, 0)), outDelay: Math.max(0, num(x.outDelay, 0)), speed: Math.min(4, Math.max(.25, num(x.speed, 1))),
    mode: x.mode === 'elements' ? 'elements' : 'group', stagger: Math.max(0, num(x.stagger, 80)) };
}
export const outKey = s => s.out === 'auto' ? (AUTO_OUT[s.in] || s.in) : s.out;

const OV = ['in', 'out', 'dirIn', 'dirOut', 'inDur', 'outDur', 'inDelay', 'outDelay'];
export function mergeAnim(base, over) {   // ajustes propios de un elemento sobre los del gráfico (vacío = heredar)
  if (!over) return base; const r = { ...base };
  OV.forEach(k => { const v = over[k]; if (v === undefined || v === null || v === '') return;
    if (k === 'in') { if (CATALOG[v] && CATALOG[v].only !== 'out') r.in = v; }
    else if (k === 'out') { if (v === 'auto' || (CATALOG[v] && CATALOG[v].only !== 'in')) r.out = v; }
    else if (k === 'dirIn' || k === 'dirOut') r[k] = v; else r[k] = Math.max(0, num(v, base[k])); });
  return r;
}

export function bbox(els) {
  if (!els.length) return FULL;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  els.forEach(e => { const x = +e.x || 0, y = +e.y || 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + (+e.w || 0)); y1 = Math.max(y1, y + (+e.h || 0)); });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const dirOf = (c, d) => c.dirs && c.dirs.some(x => x[0] === d) ? d : c.def;
function frames(c, dir, ctx, out) {
  const H = (out && c.hidOut ? c.hidOut : c.hid)({ ...ctx, dir }), S = {};
  for (const k in H) S[k] = SHOWN[k];
  return [H, S];
}

export function stopAnim(node) { if (node._pl) { try { node._pl.anim.cancel(); } catch {} node._pl = null; } }

function track(node, pl) {
  return pl.anim.finished.then(() => { if (node._pl === pl && pl.phase === 'in') { pl.anim.cancel(); node._pl = null; } }, () => {});
}

// Reproduce la entrada ('in') o la salida ('out') de un nodo. Devuelve una promesa que se resuelve al terminar
// (también si la animación se interrumpe). Si se pide la fase contraria mientras corre una y son inversas entre sí,
// se invierte desde el punto actual (sin saltos); si no, la nueva sustituye a la anterior.
export function playAnim(node, phase, s, ctx, extraDelay = 0) {
  const inK = s.in, key = phase === 'in' ? inK : outKey(s), c = CATALOG[key] || CATALOG.left;
  const dIn = dirOf(CATALOG[inK] || c, s.dirIn), dir = phase === 'in' ? dIn : dirOf(c, s.dirOut || s.dirIn);
  const mirror = phase === 'out' && key === inK && dir === dIn && !c.hidOut, canon = phase === 'in' || mirror;
  const sig = [key, dir, ctx.a.x, ctx.a.y, ctx.a.w, ctx.a.h].join('|');
  const cur = node._pl;
  if (cur && cur.anim.playState === 'running' && cur.phase !== phase && cur.canon && canon && cur.sig === sig) {
    cur.anim.reverse(); cur.phase = phase; return track(node, cur);
  }
  if (cur) { cur.anim.cancel(); node._pl = null; }
  const [H, S] = frames(c, dir, ctx, phase === 'out');
  const dur = Math.max(1, num(phase === 'in' ? s.inDur : s.outDur, 700) / (s.speed || 1));
  const delay = Math.max(0, num(phase === 'in' ? s.inDelay : s.outDelay, 0) + extraDelay);
  node.style.transformOrigin = `${ctx.a.x + ctx.a.w / 2 - ctx.b.x}px ${ctx.a.y + ctx.a.h / 2 - ctx.b.y}px`;
  const anim = node.animate(canon ? [H, S] : [S, H], { duration: dur, delay, fill: 'both',
    easing: canon ? EASE_IN : EASE_OUT, direction: phase === 'out' && mirror ? 'reverse' : 'normal' });
  const pl = { anim, phase, canon, sig }; node._pl = pl;
  return track(node, pl);
}
