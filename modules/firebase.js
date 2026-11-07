import { firebaseConfig } from '../firebase-config.js';
const V = '10.12.2';
const KEY = 'atg-db';
let fb = null, status = 'local';
const statusCbs = new Set(), watchers = [];

export const isLocal = () => !firebaseConfig || !firebaseConfig.databaseURL;
const setStatus = s => { status = s; statusCbs.forEach(f => f(s)); };
export const onStatus = f => { statusCbs.add(f); f(status); };

const readTree = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const getAt = (t, p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), t);
function setAt(t, p, v) {
  const ks = p.split('/'); let o = t;
  ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
  if (v === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = v;
}
const notifyLocal = () => { const t = readTree(); watchers.forEach(w => w.cb(getAt(t, w.path) ?? null)); };

export async function connect() {
  if (isLocal()) {
    setStatus('local');
    addEventListener('storage', e => { if (e.key === KEY) notifyLocal(); });
    return;
  }
  setStatus('connecting');
  const app = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const rtdb = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`);
  const db = rtdb.getDatabase(app.initializeApp(firebaseConfig));
  fb = { rtdb, db };
  rtdb.onValue(rtdb.ref(db, '.info/connected'), s => setStatus(s.val() ? 'online' : 'offline'));
}

export function watch(path, cb) {
  if (fb) return fb.rtdb.onValue(fb.rtdb.ref(fb.db, path), s => cb(s.val()));
  watchers.push({ path, cb }); cb(getAt(readTree(), path) ?? null);
}

export async function set(path, value) {
  const v = value === null ? null : JSON.parse(JSON.stringify(value));
  if (fb) return fb.rtdb.set(fb.rtdb.ref(fb.db, path), v);
  const t = readTree(); setAt(t, path, v);
  localStorage.setItem(KEY, JSON.stringify(t)); notifyLocal();
}
