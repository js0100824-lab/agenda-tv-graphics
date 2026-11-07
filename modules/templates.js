// Cada plantilla = lista de ELEMENTOS independientes con posición fija (x,y,w,h en el lienzo 1920x1080).
export const arr = x => Array.isArray(x) ? x : Object.values(x || {});
const R = (id, x, y, w, h, fill, showIf) => ({ id, type: 'rect', name: id, x, y, w, h, fill, showIf });
const T = (id, name, field, x, y, w, h, o = {}) => ({ id, type: 'text', name, field, x, y, w, h,
  size: 30, minSize: 14, weight: 400, align: 'left', valign: 'center', fit: 'auto', color: 'text', upper: false, ...o });

export const FIT_MODES = { auto: 'Ajustar al cuadro (varias líneas y reduce)', single: 'Una sola línea (reduce la letra)',
  multi: 'Varias líneas (sin límite)', clip: 'Tamaño fijo (recorta)' };

export const TEMPLATES = {
  headline: {
    name: 'Titular principal',
    fields: [['label', 'Etiqueta superior'], ['headline', 'Titular'], ['sub', 'Subtítulo']],
    defaults: { label: 'ÚLTIMA HORA', headline: 'TITULAR PRINCIPAL DE EJEMPLO', sub: 'Subtítulo con el detalle de la noticia' },
    layout: [R('bg', 80, 790, 1500, 200, 'bg'), R('bg2', 80, 990, 1500, 56, 'bg2', 'sub'),
      T('label', 'Etiqueta', 'label', 80, 746, 300, 44, { size: 26, weight: 700, fill: 'accent', align: 'center', fit: 'single', upper: true }),
      T('headline', 'Titular', 'headline', 108, 800, 1444, 180, { size: 54, weight: 700, upper: true }),
      T('sub', 'Subtítulo', 'sub', 108, 996, 1444, 44, { fit: 'single' })]
  },
  nameplate: {
    name: 'Presentador / nombre',
    fields: [['name', 'Nombre'], ['role', 'Cargo']],
    defaults: { name: 'Nombre Apellido', role: 'Presentador' },
    layout: [R('bar', 1300, 690, 8, 100, 'accent'), R('bg', 1308, 690, 492, 58, 'bg'), R('bg2', 1308, 748, 492, 42, 'bg2', 'role'),
      T('name', 'Nombre', 'name', 1326, 690, 462, 58, { size: 34, weight: 700, fit: 'single' }),
      T('role', 'Cargo', 'role', 1326, 748, 462, 42, { size: 24, fit: 'single' })]
  }
};

export const clone = o => JSON.parse(JSON.stringify(o));
export function newGraphic(id) {
  return { id, visible: false, template: id, fields: { ...TEMPLATES[id].defaults }, layout: clone(TEMPLATES[id].layout),
    style: { accent: '#1565ff', bg: '#0b1f4d', text: '#ffffff' },
    anim: { in: id === 'nameplate' ? 'right' : 'left', duration: 700 } };
}
export const layoutOf = g => g.layout ? arr(g.layout) : TEMPLATES[g.template].layout;

const tok = (v, s) => ({ accent: s.accent, bg: s.bg, text: s.text, bg2: `color-mix(in srgb, ${s.bg} 78%, white)` }[v] || v);

export function buildGraphic(g) {
  const root = document.createElement('div'); root.className = 'gfx';
  const s = g.style || {}, f = g.fields || {};
  for (const e of layoutOf(g)) {
    const val = e.field ? String(f[e.field] ?? '') : '';
    if (e.type === 'text' && !val) continue;
    if (e.showIf && !f[e.showIf]) continue;
    const n = document.createElement('div');
    n.className = 'el' + (e.type === 'text' ? ' txt' : '');
    Object.assign(n.style, { left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px',
      background: e.fill ? tok(e.fill, s) : 'none', opacity: e.opacity ?? 1, transform: e.rot ? `rotate(${e.rot}deg)` : '' });
    if (e.type === 'text') {
      const t = document.createElement('div'); t.textContent = val;
      Object.assign(t.style, { color: tok(e.color || 'text', s), fontWeight: e.weight, textAlign: e.align,
        textTransform: e.upper ? 'uppercase' : 'none', fontFamily: e.font || '' });
      n.style.alignItems = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[e.valign] || 'center';
      Object.assign(n.dataset, { fit: e.fit, size: e.size, min: e.minSize || 12 });
      n.append(t);
    }
    root.append(n);
  }
  return root;
}

// Ajuste de texto: el texto se adapta a SU caja; nunca mueve ni empuja a otros elementos.
export function fitAll(root) {
  const run = () => root.querySelectorAll('.txt').forEach(n => {
    const t = n.firstChild, mode = n.dataset.fit, min = +n.dataset.min; let s = +n.dataset.size;
    t.style.fontSize = s + 'px'; t.style.whiteSpace = mode === 'single' ? 'nowrap' : 'normal';
    n.style.overflow = mode === 'multi' ? 'visible' : 'hidden';
    if (mode === 'single') while (t.scrollWidth > n.clientWidth && s > min) t.style.fontSize = (s -= 1) + 'px';
    else if (mode === 'auto') while (t.offsetHeight > n.clientHeight && s > min) t.style.fontSize = (s -= 1) + 'px';
  });
  run(); document.fonts && document.fonts.ready.then(run);
}
