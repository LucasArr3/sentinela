// Alarmes de quarto (padrão 15 min antes, ajustável por quarto) e Alvorada. Funcionam com o app aberto.
import { slotDate, dutyNow } from './core.js';
const fired = new Set();
let ctx = null, timer = null;

export const SOUNDS = [
  { id: 'sirene', label: 'Sirene tática' }, { id: 'sonar', label: 'Sonar' }, { id: 'radio', label: 'Rádio HT' },
  { id: 'alerta', label: 'Alerta (bipes)' }, { id: 'buzina', label: 'Buzina' }, { id: 'alvorada', label: 'Alvorada (clarim)' },
];
function tone(f, at, dur, type = 'square', vol = 0.25) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
  const t = ctx.currentTime + at; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur + 0.05);
}
const PATTERNS = {
  sirene: { every: 1700, play: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 920 : 640, i * 0.42, 0.4, 'square', 0.22); } },
  sonar: { every: 1800, play: () => { tone(1000, 0, 0.9, 'sine', 0.35); tone(1000, 0.55, 0.5, 'sine', 0.12); } },
  radio: { every: 1900, play: () => { tone(1200, 0, 0.12, 'square', 0.2); tone(1700, 0.16, 0.12, 'square', 0.2); tone(1200, 0.45, 0.12, 'square', 0.2); tone(1700, 0.61, 0.2, 'square', 0.2); } },
  alerta: { every: 1300, play: () => { for (let i = 0; i < 3; i++) tone(880, i * 0.3, 0.16, 'square', 0.25); } },
  buzina: { every: 1500, play: () => { tone(196, 0, 0.8, 'sawtooth', 0.28); tone(247, 0, 0.8, 'sawtooth', 0.18); } },
  alvorada: { every: 2800, play: () => { [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, i * 0.28 + (i > 3 ? 0.2 : 0), i === 5 ? 0.7 : 0.26, 'triangle', 0.35)); } },
};
export function stopSound() { clearInterval(timer); timer = null; }
export function playSound(id, previewMs = 0) {
  try {
    stopSound(); const pat = PATTERNS[id] || PATTERNS.sirene;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume();
    pat.play(); timer = setInterval(pat.play, pat.every); navigator.vibrate?.([400, 200, 400, 200, 400]);
    if (previewMs) setTimeout(stopSound, previewMs);
  } catch { /* áudio indisponível */ }
}

export function dueAlarms(state, now = new Date()) {
  const out = []; const p = state.prefs; if (!p.reminders) return out;
  const near = (t) => now >= t && now - t < 120000;
  for (const e of state.events) {
    if (e.type !== 'quarto') continue; const q = state.quarters.find((x) => x.id === e.slot); if (!q || q.alvorada || q.alarm === false) continue;
    const lead = q.lead ?? p.lead ?? 15; const st = slotDate(e.date, q, state.scale); const at = new Date(st.getTime() - lead * 60000); const key = `q${e.id}${st.getTime()}`;
    if (near(at) && !fired.has(key)) { fired.add(key); out.push({ title: `Quarto ${q.start.replace(':00', 'h')}${lead ? ` em ${lead} min` : ' agora'}`, body: e.post ? `Posto: ${e.post}` : 'Prepare-se para assumir o quarto', sound: q.sound || p.sound || 'sirene' }); }
  }
  if (p.alvorada) {
    const al = state.quarters.find((q) => q.alvorada); const du = dutyNow(state, now);
    if (al && al.alarm !== false && du.on) {
      const [h, m] = al.start.split(':').map(Number); const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m); const at = new Date(t.getTime() - (al.lead ?? 0) * 60000); const key = `alv${t.getTime()}`;
      if (near(at) && !fired.has(key)) { fired.add(key); out.push({ title: 'Alvorada', body: 'Hora da Alvorada', sound: al.sound || 'alvorada' }); }
    }
  }
  return out;
}
export function startReminders(getState, onAlarm) {
  setInterval(() => { try { const s = getState(); if (s) dueAlarms(s).forEach(onAlarm); } catch { /* ignora */ } }, 15000);
}
export async function askNotifyPermission() { try { if ('Notification' in window && Notification.permission === 'default') return await Notification.requestPermission(); } catch { /* */ } return typeof Notification !== 'undefined' ? Notification.permission : 'denied'; }
export function notify(a) { try { if ('Notification' in window && Notification.permission === 'granted') new Notification(a.title, { body: a.body, tag: a.title, requireInteraction: true }); } catch { /* */ } }
let lock = null;
export async function keepAwake(on) {
  try { if (on && 'wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } else if (!on && lock) { await lock.release(); lock = null; } } catch { /* */ }
}
