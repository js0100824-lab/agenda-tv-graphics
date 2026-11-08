// Modelo de gráficos: cada gráfico es una lista de ELEMENTOS independientes (texto, imagen, forma, cintilla).
// Cada elemento tiene su propia posición (x,y) y dimensiones (w,h) sobre el escenario de 1920x1080,
// por lo que modificar uno nunca desplaza a los demás.
export const FONTS = ['Segoe UI', 'Arial', 'Arial Black', 'Impact', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia',
  'Times New Roman', 'Courier New', 'Oswald', 'Bebas Neue', 'Anton', 'Montserrat', 'Roboto Condensed'];

// Ranuras de salida: cada una es un gráfico independiente en /draft y /program.
export const SLOTS = {
  headline:  { name: 'Gráfico principal', tpl: 'titulo_sub' },
  ticker:    { name: 'Cintilla inferior', tpl: 'cintilla' },
  nameplate: { name: 'Nombre / cargo',    tpl: 'nameplate' }
};

// Gráficos adicionales creados por el usuario (se guardan en /slots y se suman a los tres integrados)
export function setCustomSlots(map) {
  for (const k of Object.keys(SLOTS)) if (SLOTS[k].custom) delete SLOTS[k];
  Object.entries(map || {}).filter(([, v]) => v).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0))
    .forEach(([id, v]) => { if (!SLOTS[id]) SLOTS[id] = { name: v.name || 'Gráfico', tpl: 'blank', custom: true }; });
}

export const uid = () => Math.random().toString(36).slice(2, 9);
export const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- Fábricas de elementos ----------
const T = (id, name, role, x, y, w, h, text, o = {}) => ({ id, type: 'text', name, role, x, y, w, h, text,
  font: 'Segoe UI', size: 54, minSize: 16, weight: 700, upper: true, color: '#ffffff', bg: '', align: 'left',
  valign: 'middle', padX: 24, lh: 1.1, autofit: true, on: true, ...o });
const I = (id, name, role, x, y, w, h, o = {}) => ({ id, type: 'image', name, role, x, y, w, h, src: '',
  fit: 'contain', opacity: 1, radius: 0, bg: '', lock: true, ar: w / h, on: true, ...o });
const S = (id, name, x, y, w, h, color, o = {}) => ({ id, type: 'shape', name, x, y, w, h, color,
  opacity: 1, radius: 0, on: true, ...o });
const NEWS = ['Primera noticia de ejemplo en la cintilla informativa', 'Segunda noticia de ejemplo con otro detalle',
  'Tercera noticia de ejemplo para completar el recorrido'];
const K = (id, name, x, y, w, h, o = {}) => ({ id, type: 'ticker', name, role: 'ticker', x, y, w, h, items: [...NEWS],
  speed: 140, dir: 'left', bg: '#111827', color: '#ffffff', font: 'Segoe UI', size: 38, weight: 600, upper: false,
  sep: '●', sepColor: '#dc2626', sepGap: 36, label: 'ÚLTIMAS NOTICIAS', labelBg: '#dc2626', labelColor: '#ffffff',
  paused: false, on: true, ...o });

export const newText   = () => T(uid(), 'Texto nuevo', '', 200, 400, 900, 120, 'Texto nuevo', { size: 48, bg: '#0b1f4d' });
export const newImage  = () => I(uid(), 'Imagen', '', 100, 100, 300, 200);
export const newLogo   = () => I(uid(), 'Logotipo', 'logo', 100, 100, 240, 160);
export const newShape  = () => S(uid(), 'Forma', 200, 300, 400, 100, '#1565ff');
export const newTicker = () => K(uid(), 'Cintilla', 0, 980, 1920, 100);

// ---------- Biblioteca de plantillas (estilos de canal informativo) ----------
export const TEMPLATES = {};
const def = (key, name, desc, anim, elements) => { TEMPLATES[key] = { key, name, desc, anim, elements }; };

def('blank', 'En blanco', 'Sin ningún elemento: parte de cero y crea tu propio diseño', { in: 'fade', duration: 600 }, []);

def('logo_titulo', 'Logo + título', 'Panel azul institucional con logotipo a la izquierda', { in: 'left', duration: 700 }, [
  S('panel', 'Panel', 80, 830, 1760, 150, '#0b1f4d', { opacity: .96 }),
  S('bar', 'Barra de acento', 80, 830, 14, 150, '#1565ff'),
  I('logo', 'Logotipo', 'logo', 120, 845, 190, 120),
  T('title', 'Titular', 'headline', 340, 840, 1470, 130, 'TITULAR PRINCIPAL DE EJEMPLO', { size: 58 })
]);

def('logo_titulo_sub', 'Logo + título + subtítulo', 'Logo en círculo, titular rojo y subtítulo blanco', { in: 'left', duration: 700 }, [
  S('disc', 'Círculo del logo', 80, 720, 250, 250, '#ffffff', { radius: 125 }),
  I('logo', 'Logotipo', 'logo', 105, 745, 200, 200, { radius: 100 }),
  T('title', 'Titular', 'headline', 350, 720, 1490, 130, 'TITULAR PRINCIPAL DE EJEMPLO', { size: 56, bg: '#c8102e', padX: 30 }),
  T('sub', 'Subtítulo', 'sub', 350, 850, 1490, 120, 'Subtítulo con el detalle de la noticia', { size: 36, bg: '#ffffff', color: '#1b1b1b', upper: false, weight: 600, padX: 30 })
]);

def('titulo_sub', 'Título + subtítulo', 'Bloque negro con franja amarilla', { in: 'left', duration: 700 }, [
  S('line', 'Línea de acento', 80, 760, 1500, 8, '#ffd400'),
  T('title', 'Titular', 'headline', 80, 768, 1500, 150, 'TITULAR PRINCIPAL DE EJEMPLO', { size: 60, bg: '#111111', padX: 34 }),
  T('sub', 'Subtítulo', 'sub', 80, 918, 1100, 70, 'Subtítulo con el detalle de la noticia', { size: 32, bg: '#ffd400', color: '#111111', upper: false, padX: 34 })
]);

def('titulo_categoria', 'Título + categoría', 'Etiqueta de sección sobre el titular', { in: 'bottom', duration: 700 }, [
  T('cat', 'Categoría', 'category', 80, 740, 360, 60, 'POLÍTICA', { size: 28, bg: '#e11d48', align: 'center' }),
  T('title', 'Titular', 'headline', 80, 800, 1560, 180, 'TITULAR PRINCIPAL DE EJEMPLO', { size: 62, bg: '#0f172a', padX: 36 })
]);

def('logo_titulo_cat', 'Logo + título + categoría', 'Banda verde en la parte superior', { in: 'left', duration: 700 }, [
  S('band', 'Banda', 60, 50, 1800, 190, '#064e3b', { opacity: .95 }),
  I('logo', 'Logotipo', 'logo', 90, 70, 190, 150),
  T('cat', 'Categoría', 'category', 310, 68, 420, 46, 'SOCIEDAD', { size: 26, bg: '#22c55e', color: '#052e16', align: 'center' }),
  T('title', 'Titular', 'headline', 310, 120, 1520, 110, 'TITULAR PRINCIPAL DE EJEMPLO', { size: 50 })
]);

def('principal_secundaria', 'Principal + noticia secundaria', 'Titular grande y columna lateral con otra noticia', { in: 'left', duration: 700 }, [
  T('title', 'Titular', 'headline', 80, 690, 1180, 210, 'TITULAR PRINCIPAL DE EJEMPLO', { size: 66, bg: '#1565ff', padX: 34 }),
  T('sub', 'Subtítulo', 'sub', 80, 900, 1180, 80, 'Subtítulo con el detalle de la noticia', { size: 30, bg: '#0b1f4d', upper: false, weight: 500, padX: 34 }),
  T('tag', 'Etiqueta secundaria', 'label', 1290, 690, 550, 50, 'TAMBIÉN EN LA AGENDA', { size: 26, bg: '#f59e0b', color: '#111111', align: 'center' }),
  T('sec', 'Noticia secundaria', 'secondary', 1290, 740, 550, 240, 'Noticia secundaria de ejemplo', { size: 36, bg: '#1f2937', upper: false, weight: 600, padX: 28 })
]);

def('titulo_cintilla', 'Título + cintilla inferior', 'Titular arriba y cintilla de noticias abajo', { in: 'fade', duration: 600 }, [
  S('accent', 'Barra de acento', 60, 60, 18, 150, '#fbbf24'),
  T('title', 'Titular', 'headline', 78, 60, 1782, 150, 'TITULAR PRINCIPAL DE EJEMPLO', { size: 60, bg: '#7f1d1d', padX: 36 }),
  K('ticker', 'Cintilla', 0, 980, 1920, 100, { label: 'ÚLTIMA HORA' })
]);

def('logo_titulo_sub_cintilla', 'Logo + título + subtítulo + cintilla', 'Panel completo con logotipo y cintilla blanca', { in: 'bottom', duration: 700 }, [
  S('panel', 'Panel', 60, 640, 1800, 310, '#0b1f4d', { opacity: .93 }),
  I('logo', 'Logotipo', 'logo', 90, 670, 220, 170),
  T('title', 'Titular', 'headline', 340, 660, 1490, 140, 'TITULAR PRINCIPAL DE EJEMPLO', { size: 58 }),
  S('line', 'Línea', 340, 804, 1490, 4, '#1565ff'),
  T('sub', 'Subtítulo', 'sub', 340, 812, 1490, 120, 'Subtítulo con el detalle de la noticia', { size: 34, color: '#c7d7ff', upper: false, weight: 500 }),
  K('ticker', 'Cintilla', 0, 970, 1920, 110, { bg: '#ffffff', color: '#0b1f4d', label: 'EN VIVO', labelBg: '#1565ff', sepColor: '#1565ff' })
]);

def('nameplate', 'Presentador / nombre', 'Nombre y cargo en el lateral derecho', { in: 'right', duration: 700 }, [
  T('name', 'Nombre', 'name', 1340, 700, 460, 72, 'Nombre Apellido', { size: 34, bg: '#0b1f4d', upper: false, padX: 34 }),
  S('bar', 'Barra de acento', 1340, 700, 8, 72, '#1565ff'),
  T('role', 'Cargo', 'role', 1340, 772, 460, 52, 'Presentador', { size: 24, bg: '#1c3a78', upper: false, weight: 400, padX: 34 })
]);

def('cintilla', 'Cintilla informativa', 'Cintilla de noticias independiente', { in: 'bottom', duration: 700 }, [
  K('ticker', 'Cintilla', 0, 960, 1920, 120, { bg: '#0b1f4d', label: 'NOTICIAS', labelBg: '#1565ff', sepColor: '#1565ff', size: 42 })
]);

export const TEMPLATE_LIST = Object.values(TEMPLATES);

// Crea un gráfico a partir de una plantilla (integrada o guardada), conservando textos, logo y noticias
// del gráfico anterior cuando comparten el mismo rol.
export function instantiate(tpl, prev) {
  const els = clone(arr(tpl.elements)), old = {};
  let oldTk = null, oldLogo = null;
  if (prev) arr(prev.elements).forEach(e => {
    if (e.type === 'text' && e.role && !(e.role in old)) old[e.role] = e.text;
    if (e.type === 'ticker' && !oldTk) oldTk = e;
    if (e.type === 'image' && e.role === 'logo' && e.src && !oldLogo) oldLogo = e;
  });
  els.forEach(e => {
    if (e.type === 'text' && e.role in old) e.text = old[e.role];
    if (e.type === 'ticker' && oldTk) e.items = clone(arr(oldTk.items));
    if (e.type === 'image' && e.role === 'logo' && !e.src && oldLogo) { e.src = oldLogo.src; e.ar = oldLogo.ar; }
  });
  return { template: tpl.key || 'custom', elements: els, groups: clone(tpl.groups || {}), anim: clone(tpl.anim || { in: 'left', duration: 700 }) };
}

export function newGraphic(id) {
  return { id, v: 2, visible: false, ...instantiate(TEMPLATES[SLOTS[id].tpl]) };
}

// ---------- Construcción del DOM ----------
const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; return d; };
const ff = f => `"${f || 'Segoe UI'}", Arial, Helvetica, sans-serif`;
const num = (v, d = 0) => (isFinite(+v) && v !== '' && v != null ? +v : d);

function fitText(n, t, e) {   // reduce el tamaño hasta que el texto cabe en su caja (varias líneas permitidas)
  const max = Math.max(6, num(e.size, 40)), min = Math.min(max, Math.max(6, num(e.minSize, 12)));
  t.style.fontSize = max + 'px';
  if (e.autofit === false) return;
  const H = n.clientHeight;
  if (!H || t.scrollHeight <= H) return;
  let lo = min, hi = max;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); t.style.fontSize = mid + 'px'; if (t.scrollHeight <= H) lo = mid; else hi = mid - 1; }
  t.style.fontSize = lo + 'px';
}

function mountTicker(n, tr, vp, e) {   // cinta continua sin huecos: dos grupos idénticos que se desplazan en bucle
  const keep = n._anim ? n._anim.currentTime : 0;
  if (n._anim) { n._anim.cancel(); n._anim = null; }
  tr.innerHTML = '';
  const items = arr(e.items).map(x => String(x ?? '').trim()).filter(Boolean);
  if (!items.length) return;
  const seg = div('tkseg'), gap = Math.max(0, num(e.sepGap, 30));
  items.forEach(t => {
    seg.append(div('it', e.upper ? t.toUpperCase() : t));
    const sp = div('sep', e.sep || ''); sp.style.color = e.sepColor || 'inherit'; sp.style.padding = `0 ${gap}px`; seg.append(sp);
  });
  tr.append(seg);
  const W = seg.offsetWidth + 1, vw = vp.clientWidth;
  if (W < 2 || !vw) { tr.innerHTML = ''; return; }
  const k = Math.max(1, Math.ceil(vw / W));
  tr.innerHTML = '';
  for (let i = 0; i < 2 * k; i++) { const c = seg.cloneNode(true); c.style.width = W + 'px'; tr.append(c); }
  const dist = k * W, dur = dist / Math.max(10, num(e.speed, 120)) * 1000;
  n._anim = tr.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dist}px)` }],
    { duration: dur, iterations: Infinity, easing: 'linear', direction: e.dir === 'right' ? 'reverse' : 'normal' });
  if (isFinite(keep) && keep) n._anim.currentTime = keep % dur;
  if (n._paused) n._anim.pause();
}

export function buildElement(e, opts = {}) {
  const n = div(`el ${e.type}`); n.dataset.id = e.id;
  const s = n.style;
  s.left = num(e.x) + 'px'; s.top = num(e.y) + 'px'; s.width = Math.max(1, num(e.w, 100)) + 'px'; s.height = Math.max(1, num(e.h, 50)) + 'px';
  if (e.type === 'text') {
    s.background = e.bg || 'transparent'; s.color = e.color || '#fff';
    s.alignItems = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[e.valign] || 'center';
    const t = div('t', e.text || '');
    Object.assign(t.style, { padding: `4px ${num(e.padX, 24)}px`, textAlign: e.align || 'left', fontFamily: ff(e.font),
      fontWeight: e.weight || 700, lineHeight: num(e.lh, 1.1), textTransform: e.upper ? 'uppercase' : 'none' });
    n.append(t); n._fit = () => fitText(n, t, e);
  } else if (e.type === 'image') {
    s.background = e.bg || 'transparent'; s.borderRadius = num(e.radius) + 'px'; s.opacity = num(e.opacity, 1);
    if (e.src) { const im = new Image(); im.src = e.src; im.draggable = false; im.style.objectFit = e.fit || 'contain'; n.append(im); }
    else if (opts.placeholders) { n.classList.add('ph'); n.textContent = 'LOGO / IMAGEN'; }
  } else if (e.type === 'shape') {
    s.background = e.color || '#1565ff'; s.opacity = num(e.opacity, 1); s.borderRadius = num(e.radius) + 'px';
  } else if (e.type === 'ticker') {
    s.background = e.bg || 'transparent'; s.color = e.color || '#fff'; s.fontFamily = ff(e.font);
    s.fontSize = num(e.size, 36) + 'px'; s.fontWeight = e.weight || 600;
    if (e.label) { const l = div('tkl', e.label); l.style.background = e.labelBg || '#dc2626'; l.style.color = e.labelColor || '#fff'; n.append(l); }
    const vp = div('tkv'), tr = div('tkt'); vp.append(tr); n.append(vp);
    n._paused = !!e.paused;
    n._pause = f => { n._paused = !!f; if (n._anim) { if (f) n._anim.pause(); else n._anim.play(); } };
    n._mount = () => mountTicker(n, tr, vp, e);
  }
  return n;
}
