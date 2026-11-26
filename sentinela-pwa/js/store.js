// Persistência local (localStorage) com contas por dispositivo. Dados ficam só neste aparelho.
import { defaultScale, today, DEFAULT_QUARTERS, DEFAULT_POSTS, DEFAULT_DAY_POSTS, DEFAULT_NEED_WHERE, OLD_DEFAULT_POSTS } from './core.js';
import { DEFAULT_SOUND, migrateSound } from './sounds.js';
const K = 'sentinela:v1';
// Armazenamento tolerante a bloqueio (aba anônima etc.): cai para memória se o navegador negar.
const MEM_ONLY = typeof location !== 'undefined' && /demo=/.test(location.hash || ''); // galeria de estilos: nunca toca nos dados reais
const safe = (name) => { const mem = new Map(); let real = null; try { if (!MEM_ONLY) { real = window[name]; real.getItem('__t'); } } catch { real = null; }
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
  profile: { name, rank: '', matricula: '', unit: '', phone: '', alias: '' },
  quarters: DEFAULT_QUARTERS.map((q) => ({ ...q })), posts: [...DEFAULT_POSTS], dayPosts: [...DEFAULT_DAY_POSTS], dayNeedWhere: [...DEFAULT_NEED_WHERE], holidays: [], customSounds: [],
  scale: defaultScale(today()),
  money: { diurna: 219, noturna: 219 },
  prefs: { theme: 'dark', accent: '', speak: false, waPhone: '', waKind: 'completo', lastPost: '', reminders: true, lead: 15, sound: DEFAULT_SOUND, shiftReminder: 0, shiftSound: 'carrilhao', snooze: 5, ramp: true, autostop: 5, alvorada: true, wake: false, cellStyle: 'classic', colors: {}, layout: 'moderno', infoStyle: 'cartoes', calCard: true, ai: { provider: 'gemini', key: '', model: '' } },
  events: [],
});

export const Store = {
  usage() { let chars = 0; try { const L = window.localStorage; for (let i = 0; i < L.length; i++) { const k = L.key(i); chars += k.length + (L.getItem(k) || '').length; } } catch { /* sem acesso */ } return { chars, pct: (chars / 5_000_000) * 100 }; },
  newSalt: () => b64(crypto.getRandomValues(new Uint8Array(16))),
  hashPin: (pin, salt) => hashPw(pin, salt, 100000),
  users: () => rd(`${K}:users`, []),
  currentId: () => ss.getItem(`${K}:sid`) || ls.getItem(`${K}:sid`),
  load(id) { const d = rd(`${K}:data:${id}`, null); if (!d) return null; const b = defaultData();
    if (Array.isArray(d.posts) && JSON.stringify(d.posts) === JSON.stringify(OLD_DEFAULT_POSTS)) { // lista de fábrica antiga -> postos da unidade
      const map = { 'Pavilhão A': 'Bloco A', 'Pavilhão B': 'Bloco B' }; d.posts = [...DEFAULT_POSTS];
      (d.events || []).forEach((e) => { if (e.post && map[e.post]) e.post = map[e.post]; });
    }
    if (d.prefs && d.prefs.sound) d.prefs.sound = migrateSound(d.prefs.sound); if (Array.isArray(d.quarters)) d.quarters.forEach((q) => { if (q.sound) q.sound = migrateSound(q.sound); }); return { ...b, ...d, profile: { ...b.profile, ...d.profile }, scale: { ...b.scale, ...d.scale }, money: { ...b.money, ...d.money }, prefs: { ...b.prefs, ...d.prefs, accent: (d.prefs || {}).accent && !['#3b82f6', '#e8e8ea'].includes(d.prefs.accent) ? d.prefs.accent : '', ai: { ...b.prefs.ai, ...(d.prefs || {}).ai } }, quarters: Array.isArray(d.quarters) && d.quarters.length ? d.quarters : b.quarters, posts: Array.isArray(d.posts) ? d.posts : b.posts, holidays: Array.isArray(d.holidays) ? d.holidays : [], customSounds: Array.isArray(d.customSounds) ? d.customSounds : [] }; },
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
