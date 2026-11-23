// Persistência local (localStorage) com contas por dispositivo. Dados ficam só neste aparelho.
import { defaultScale, today, DEFAULT_QUARTERS, DEFAULT_POSTS } from './core.js';
const K = 'sentinela:v1';
// Armazenamento tolerante a bloqueio (aba anônima etc.): cai para memória se o navegador negar.
const safe = (name) => { const mem = new Map(); let real = null; try { real = window[name]; real.getItem('__t'); } catch { real = null; }
  return { getItem: (k) => { try { if (real) return real.getItem(k); } catch { /* */ } return mem.has(k) ? mem.get(k) : null; }, setItem: (k, v) => { try { if (real) return real.setItem(k, v); } catch { /* */ } mem.set(k, String(v)); }, removeItem: (k) => { try { if (real) return real.removeItem(k); } catch { /* */ } mem.delete(k); } }; };
const ls = safe('localStorage'), ss = safe('sessionStorage');
const rd = (k, f) => { try { const v = ls.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
const wr = (k, v) => { try { ls.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

const enc = (s) => new TextEncoder().encode(s);
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function hashPw(pw, salt, iter) {
  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', enc(pw), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: iter }, key, 256));
  }
  let h = 2166136261; for (const c of salt + pw) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16);
}

export const defaultData = (name = '') => ({
  v: 1, onboarded: false,
  profile: { name, rank: 'Policial Penal', matricula: '', unit: '', phone: '', alias: '' },
  quarters: DEFAULT_QUARTERS.map((q) => ({ ...q })), posts: [...DEFAULT_POSTS],
  scale: defaultScale(today()),
  money: { diurna: 219, noturna: 219, h24: 438 },
  prefs: { theme: 'dark', accent: '#3b82f6', speak: false, waPhone: '', waKind: 'completo', lastPost: '', reminders: true, lead: 15, alvorada: true, ai: { provider: 'gemini', key: '', model: '' } },
  events: [],
});

export const Store = {
  users: () => rd(`${K}:users`, []),
  currentId: () => ss.getItem(`${K}:sid`) || ls.getItem(`${K}:sid`),
  load(id) { const d = rd(`${K}:data:${id}`, null); if (!d) return null; const b = defaultData(); return { ...b, ...d, profile: { ...b.profile, ...d.profile }, scale: { ...b.scale, ...d.scale }, money: { ...b.money, ...d.money }, prefs: { ...b.prefs, ...d.prefs, ai: { ...b.prefs.ai, ...(d.prefs || {}).ai } }, quarters: Array.isArray(d.quarters) && d.quarters.length ? d.quarters : b.quarters, posts: Array.isArray(d.posts) ? d.posts : b.posts }; },
  save(id, data) { return wr(`${K}:data:${id}`, data); },
  async register({ name, email, password, guest = false }) {
    const users = this.users(); email = (email || '').trim().toLowerCase();
    if (!guest && users.some((u) => u.email === email)) throw new Error('Este e-mail já está cadastrado neste aparelho.');
    const id = 'u' + Math.random().toString(36).slice(2, 10); const user = { id, name, email, guest, createdAt: Date.now() };
    if (!guest) { const salt = b64(crypto.getRandomValues(new Uint8Array(16))); user.salt = salt; user.iter = 150000; user.hash = await hashPw(password, salt, user.iter); }
    users.push(user); wr(`${K}:users`, users);
    const d = defaultData(name); this.save(id, d); return { user, data: d };
  },
  async login(email, password) {
    email = email.trim().toLowerCase(); const u = this.users().find((x) => x.email === email);
    if (!u || !u.hash) throw new Error('E-mail ou senha incorretos.');
    if ((await hashPw(password, u.salt, u.iter)) !== u.hash) throw new Error('E-mail ou senha incorretos.');
    return u;
  },
  async changePassword(id, oldPw, newPw) {
    const users = this.users(); const u = users.find((x) => x.id === id); if (!u?.hash) throw new Error('Conta sem senha.');
    if ((await hashPw(oldPw, u.salt, u.iter)) !== u.hash) throw new Error('Senha atual incorreta.');
    u.salt = b64(crypto.getRandomValues(new Uint8Array(16))); u.hash = await hashPw(newPw, u.salt, u.iter); wr(`${K}:users`, users);
  },
  startSession(id, remember) { ss.setItem(`${K}:sid`, id); if (remember) ls.setItem(`${K}:sid`, id); else ls.removeItem(`${K}:sid`); },
  endSession() { ss.removeItem(`${K}:sid`); ls.removeItem(`${K}:sid`); },
  deleteAccount(id) { wr(`${K}:users`, this.users().filter((u) => u.id !== id)); ls.removeItem(`${K}:data:${id}`); this.endSession(); },
  user: (id) => rd(`${K}:users`, []).find((u) => u.id === id),
  updateUser(id, patch) { const us = rd(`${K}:users`, []); const u = us.find((x) => x.id === id); if (u) { Object.assign(u, patch); wr(`${K}:users`, us); } },
};
