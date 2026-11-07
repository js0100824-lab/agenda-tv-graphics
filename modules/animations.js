const OFF = {
  left:   { transform: 'translateX(-130%)' },
  right:  { transform: 'translateX(130%)' },
  bottom: { transform: 'translateY(130%)' },
  fade:   { opacity: 0 }
};
export const ANIMS = { left: 'Desde izquierda', right: 'Desde derecha', bottom: 'Desde abajo', fade: 'Fundido' };
const ease = 'cubic-bezier(.22,.8,.2,1)';
const pick = k => OFF[k] || OFF.left;

export function animateIn(el, a = {}) {
  return el.animate([pick(a.in), { transform: 'none', opacity: 1 }],
    { duration: a.duration || 700, easing: ease, fill: 'backwards' }).finished;
}
export function animateOut(el, a = {}) {
  return el.animate([{ transform: 'none', opacity: 1 }, pick(a.out || a.in)],
    { duration: a.duration || 700, easing: ease, fill: 'forwards' }).finished;
}
