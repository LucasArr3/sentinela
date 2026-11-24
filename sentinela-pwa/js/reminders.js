// Alarmes de quarto (padrão 15 min antes, ajustável por quarto) e Alvorada.
// - buildAlarms(): lista pura dos próximos alarmes (enviada ao Android, que toca mesmo com o app fechado).
// - No navegador, dueAlarms()/startReminders() tocam só com o app aberto.
import { slotDate, addDays, dayInfo, iso, qLabel } from './core.js';
import { SOUND_LIST, soundUrl, DEFAULT_SOUND, isBuiltin } from './sounds.js';

export const SOUNDS = SOUND_LIST;
const fired = new Set();
let audio = null, rampTimer = null, stopTimer = null;

export function stopSound() {
  clearInterval(rampTimer); clearTimeout(stopTimer); rampTimer = null; stopTimer = null;
  if (audio) { try { audio.pause(); audio.currentTime = 0; } catch { /* */ } audio = null; }
  try { navigator.vibrate?.(0); } catch { /* */ }
}
// Toca um som em loop. previewMs>0: prévia curta. ramp: volume crescente nos primeiros segundos.
export function playSound(id, opts = {}) {
  const { previewMs = 0, ramp = false } = typeof opts === 'number' ? { previewMs: opts } : opts;
  stopSound();
  try {
    const sid = isBuiltin(id) ? id : DEFAULT_SOUND; audio = new Audio(soundUrl(sid)); audio.loop = true; audio.volume = ramp ? 0.15 : 1;
    const p = audio.play(); if (p && p.catch) p.catch(() => { /* bloqueado até haver toque do usuário */ });
    if (ramp) { let v = 0.15; rampTimer = setInterval(() => { v = Math.min(1, v + 0.085); if (audio) audio.volume = v; if (v >= 1) clearInterval(rampTimer); }, 800); }
    navigator.vibrate?.([500, 250, 500, 250, 500]);
    if (previewMs) stopTimer = setTimeout(stopSound, previewMs);
  } catch { /* áudio indisponível */ }
}

// ---------- cálculo dos alarmes ----------
export function hashId(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return (h & 0x7fffffff) || 1; }
const shiftHours = (info, sc) => (info.status === 'extra' ? (info.events.find((e) => e.type === 'extra')?.turno === 'h24' ? 24 : 12) : sc.hours);

// Alarmes cujo horário cai em [from, to]
export function alarmsBetween(state, from, to) {
  const out = []; const p = state.prefs; if (!p.reminders) return out;
  const f = from.getTime(), t = to.getTime();
  for (const e of state.events) {
    if (e.type !== 'quarto') continue; const q = state.quarters.find((x) => x.id === e.slot); if (!q || q.alvorada || q.alarm === false) continue;
    const lead = q.lead ?? p.lead ?? 15; const st = slotDate(e.date, q, state.scale); const at = st.getTime() - lead * 60000;
    if (at >= f && at <= t) out.push({ id: hashId(`q:${e.id}:${e.slot}:${e.date}`), at, kind: 'quarto', title: `Quarto ${q.start.replace(':00', 'h')}${lead ? ` em ${lead} min` : ' agora'}`, body: e.post ? `Posto: ${e.post}` : 'Prepare-se para assumir o quarto', sound: q.sound || p.sound || DEFAULT_SOUND });
  }
  if (p.alvorada) {
    const al = state.quarters.find((q) => q.alvorada);
    if (al && al.alarm !== false) {
      const first = addDays(iso(from), -1), last = iso(to); const [sh, sm] = state.scale.start.split(':').map(Number);
      for (let d = first; d <= last; d = addDays(d, 1)) {
        const info = dayInfo(d, state); if (!info.works) continue;
        const [y, m, dd] = d.split('-').map(Number); const start = new Date(y, m - 1, dd, sh, sm).getTime(); const end = start + shiftHours(info, state.scale) * 3600e3;
        const alT = slotDate(d, al, state.scale).getTime(); if (alT < start || alT >= end) continue;
        const at = alT - (al.lead ?? 0) * 60000;
        if (at >= f && at <= t) out.push({ id: hashId(`alv:${d}`), at, kind: 'alvorada', title: 'Alvorada', body: 'Hora da Alvorada', sound: al.sound || 'clarim' });
      }
    }
  }
  const mins = Number(p.shiftReminder) || 0;
  if (mins > 0) {
    const [sh, sm] = state.scale.start.split(':').map(Number);
    for (let d = addDays(iso(from), -1); d <= addDays(iso(to), 1); d = addDays(d, 1)) {
      const info = dayInfo(d, state); if (!info.works) continue;
      const [y, m, dd] = d.split('-').map(Number); const at = new Date(y, m - 1, dd, sh, sm).getTime() - mins * 60000;
      if (at >= f && at <= t) out.push({ id: hashId(`plt:${d}`), at, kind: 'plantao', title: `Plantão às ${state.scale.start}`, body: mins >= 120 ? `Faltam ${Math.round(mins / 60)} horas para o plantão` : `Faltam ${mins} minutos para o plantão`, sound: p.shiftSound || 'carrilhao' });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
export const buildAlarms = (state, now = new Date(), days = 14) => alarmsBetween(state, now, new Date(now.getTime() + days * 864e5));

// Navegador: alarmes vencidos nos últimos 2 min que ainda não tocaram
export function dueAlarms(state, now = new Date()) {
  return alarmsBetween(state, new Date(now.getTime() - 120000), now).filter((a) => { const k = `${a.id}:${a.at}`; if (fired.has(k)) return false; fired.add(k); return true; });
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

// Resumo para o widget da tela inicial: próximos plantões e quartos (o Android calcula os textos na hora).
export function buildWidget(state, now = new Date()) {
  const sc = state.scale; const [sh, sm] = sc.start.split(':').map(Number); const nowMs = now.getTime(); const shifts = [];
  for (let d = addDays(iso(now), -1), n = 0; n < 40 && shifts.length < 12; d = addDays(d, 1), n++) {
    const info = dayInfo(d, state); if (!info.works) continue;
    const [y, m, dd] = d.split('-').map(Number); const s = new Date(y, m - 1, dd, sh, sm).getTime(); const e = s + shiftHours(info, sc) * 3600e3;
    if (e > nowMs) shifts.push({ s, e });
  }
  const quartos = [];
  for (const ev of state.events) {
    if (ev.type !== 'quarto') continue; const q = state.quarters.find((x) => x.id === ev.slot); if (!q) continue;
    const st = slotDate(ev.date, q, sc).getTime(); const [eh, em] = q.end.split(':').map(Number); const sd = new Date(st);
    let en = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), eh, em).getTime(); if (en <= st) en += 864e5;
    if (en > nowMs) quartos.push({ s: st, e: en, l: qLabel(q), p: ev.post || '' });
  }
  quartos.sort((a, b) => a.s - b.s);
  return { shifts, quartos: quartos.slice(0, 20) };
}
