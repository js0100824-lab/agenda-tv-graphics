export const TEMPLATES = {
  headline: {
    name: 'Titular principal',
    fields: [['label', 'Etiqueta superior'], ['headline', 'Titular'], ['sub', 'Subtítulo']],
    defaults: { label: 'ÚLTIMA HORA', headline: 'TITULAR PRINCIPAL DE EJEMPLO', sub: 'Subtítulo con el detalle de la noticia' }
  },
  nameplate: {
    name: 'Presentador / nombre',
    fields: [['name', 'Nombre'], ['role', 'Cargo']],
    defaults: { name: 'Nombre Apellido', role: 'Presentador' }
  }
};

export function newGraphic(id) {
  return { id, visible: false, template: id, fields: { ...TEMPLATES[id].defaults },
    style: { accent: '#1565ff', bg: '#0b1f4d', text: '#ffffff' },
    anim: { in: id === 'nameplate' ? 'right' : 'left', duration: 700 } };
}

const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; d.textContent = text; return d; };

export function buildGraphic(g) {
  const el = document.createElement('div');
  el.className = `gfx ${g.template}`;
  const s = g.style || {}, f = g.fields || {};
  el.style.setProperty('--accent', s.accent || '#1565ff');
  el.style.setProperty('--bg', s.bg || '#0b1f4d');
  el.style.color = s.text || '#fff';
  if (g.template === 'headline') {
    if (f.label) el.append(div('tag', f.label));
    if (f.headline) el.append(div('main', f.headline));
    if (f.sub) el.append(div('sub', f.sub));
  } else if (g.template === 'nameplate') {
    if (f.name) el.append(div('name', f.name));
    if (f.role) el.append(div('role', f.role));
  }
  return el;
}
