// Alarmes de quarto (X min antes) e Alvorada. Funcionam com o app aberto (aba ou app instalado em uso).
import { slotDate, dutyNow } from './core.js';
const fired = new Set();
let ctx = null, osc = null, timer = null;

export function siren(on) {
  try {
    if (!on) { clearInterval(timer); osc?.stop(); osc = null; return; }
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume();
    osc = ctx.createOscillator(); const g = ctx.createGain(); g.gain.value = 0.25; osc.connect(g); g.connect(ctx.destination); osc.type = 'square'; osc.start();
    let hi = false; timer = setInterval(() => { hi = !hi; osc.frequency.value = hi ? 920 : 640; }, 420);
    navigator.vibrate?.([400, 200, 400, 200, 400]);
  } catch { /* áudio indisponível */ }
}

export function dueAlarms(state, now = new Date()) {
  const out = []; const p = state.prefs; if (!p.reminders) return out; const lead = Number(p.lead) || 0;
  const near = (t) => now >= t && now - t < 120000;
  for (const e of state.events) {
    if (e.type !== 'quarto') continue; const q = state.quarters.find((x) => x.id === e.slot); if (!q || q.alvorada) continue;
    const st = slotDate(e.date, q, state.scale); const at = new Date(st.getTime() - lead * 60000); const key = `q${e.id}${st.getTime()}`;
    if (near(at) && !fired.has(key)) { fired.add(key); out.push({ title: `Quarto ${q.start.replace(':00', 'h')} em ${lead} min`, body: e.post ? `Posto: ${e.post}` : 'Prepare-se para assumir o quarto', alvorada: false }); }
  }
  if (p.alvorada) {
    const al = state.quarters.find((q) => q.alvorada); const du = dutyNow(state, now);
    if (al && du.on) { const [h, m] = al.start.split(':').map(Number); const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m); const key = `alv${t.getTime()}`;
      if (near(t) && !fired.has(key)) { fired.add(key); out.push({ title: 'Alvorada', body: 'Hora da Alvorada — confirme para silenciar', alvorada: true }); } }
  }
  return out;
}
export function startReminders(getState, onAlarm) {
  setInterval(() => { try { const s = getState(); if (s) dueAlarms(s).forEach(onAlarm); } catch { /* ignora */ } }, 15000);
}
export async function askNotifyPermission() { try { if ('Notification' in window && Notification.permission === 'default') return await Notification.requestPermission(); } catch { /* */ } return Notification?.permission; }
export function notify(a) { try { if ('Notification' in window && Notification.permission === 'granted') new Notification(a.title, { body: a.body, tag: a.title, requireInteraction: true }); } catch { /* */ } }
