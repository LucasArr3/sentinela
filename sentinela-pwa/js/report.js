// Relatório detalhado do mês: horários, postos, extras e ocorrências.
// buildReport/reportText são puros (testáveis). renderReport/makePdf geram imagem e PDF sem bibliotecas.
import { monthDays, dayInfo, quartosOn, qLabel, fmtShort, WD3, MONTHS } from './core.js';

const rpMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
export const rpHours = (min) => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`; };
const rpHM = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const rpWhere = (e) => (e.where ? `${e.where} · ${e.post}` : e.post);

// Postos do dia com horário calculado (sem horário = do início do plantão até as 18h)
export function dayPostEntries(state, date) {
  const list = state.events.filter((x) => x.type === 'posto' && x.date === date).sort((a, b) => (a.from || '').localeCompare(b.from || ''));
  const base = rpMin(state.scale.start || '07:00');
  return list.map((e, i) => {
    const s = e.from ? rpMin(e.from) : base; const next = list[i + 1] && list[i + 1].from ? rpMin(list[i + 1].from) : 0;
    const en = e.to ? rpMin(e.to) : (next > s ? next : 18 * 60);
    return { label: rpWhere(e), where: e.where || '', func: e.post, from: rpHM(s), to: rpHM(en), min: Math.max(0, en - s), allDay: !e.from && !e.to };
  });
}
function rpSlotMin(q) { let d = rpMin(q.end) - rpMin(q.start); if (d <= 0) d += 1440; return d; }

const DEF = { from: '08:00', to: '18:00' };
// Relatório simples: uma linha por dia com o posto do dia e os quartos da noite
export function buildReport(state, y, m) {
  const rows = []; let plantoes = 0;
  for (const date of monthDays(y, m)) {
    const info = dayInfo(date, state); const worked = info.status === 'plantao' || info.status === 'permuta_in';
    const dia = dayPostEntries(state, date).map((e) => ({ post: e.label, where: e.where, func: e.func, time: e.allDay || (e.from === DEF.from && e.to === DEF.to) ? '' : `${e.from}–${e.to}` }));
    const nights = new Map();
    for (const e of quartosOn(state, date)) { const q = state.quarters.find((x) => x.id === e.slot); if (!q) continue; const key = e.post || 'Sem posto'; const o = nights.get(key) || { post: key, slots: [] }; o.slots.push(qLabel(q)); nights.set(key, o); }
    const noite = [...nights.values()].map((o) => ({ post: o.post, slots: o.slots.join(' · ') }));
    const qIdx = (id) => state.quarters.findIndex((x) => x.id === id);
    const quartos = quartosOn(state, date).map((e) => ({ i: qIdx(e.slot), q: state.quarters[qIdx(e.slot)], post: e.post || 'Sem posto' })).filter((x) => x.q).sort((a, b) => a.i - b.i).map((x) => ({ time: qLabel(x.q), post: x.post }));
    if (worked) plantoes++;
    if (worked || dia.length || noite.length) rows.push({ date, dow: WD3[new Date(`${date}T12:00:00`).getDay()], worked, dia, noite, quartos });
  }
  const TUR = { diurna: 'Extra diurna', noturna: 'Extra noturna', h24: 'Extra 24h' };
  const extras = state.events.filter((e) => e.type === 'extra' && e.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ date: e.date, dow: WD3[new Date(`${e.date}T12:00:00`).getDay()], turno: TUR[e.turno] || 'Extra' }));
  return { y, m, title: `${MONTHS[m]} de ${y}`, plantoes, rows, extras };
}
export const rowDia = (r) => r.dia.map((d) => d.post + (d.time ? ` (${d.time})` : '')).join(' / ') || (r.worked ? '—' : '');
export const rowNoite = (r) => r.noite.map((n) => `${n.post} ${n.slots}`).join(' · ');

/** Opções do relatório (o usuário escolhe o que mostrar). O padrão é: postos diurnos e noturnos, por tipo. */
export const REPORT_DEFAULT = { show: 'ambos', group: 'tipo', dow: true, diaWhere: true, diaTime: false, nightTime: true, nightPost: true, total: true, extras: false, header: true };
export const reportOpts = (prefs) => ({ ...REPORT_DEFAULT, ...((prefs && prefs.report) || {}) });
export const REPORT_PRESETS = {
  padrao: { ...REPORT_DEFAULT },
  diurno: { ...REPORT_DEFAULT, show: 'dia' },
  noturno: { ...REPORT_DEFAULT, show: 'noite' },
  pordia: { ...REPORT_DEFAULT, group: 'dia' },
  completo: { ...REPORT_DEFAULT, group: 'dia', diaTime: true, extras: true },
};

/** Modelo único do relatório: o app, o texto do WhatsApp, a imagem e o PDF saem dele. */
export function reportModel(rep, profile = {}, opts = {}) {
  const o = { ...REPORT_DEFAULT, ...opts };
  const nightFix = !o.nightTime && !o.nightPost ? { ...o, nightTime: true } : o;
  const diaText = (d) => (o.diaWhere && d.where ? `${d.where} · ${d.func}` : (d.func || d.post)) + (o.diaTime && d.time ? ` (${d.time})` : '');
  const nightText = (n) => [nightFix.nightTime ? n.time : '', nightFix.nightPost ? n.post : ''].filter(Boolean).join(' · ');
  const wantDia = o.show !== 'noite', wantNoite = o.show !== 'dia'; const sections = []; const dw = (r) => (o.dow ? r.dow : '');
  if (o.group === 'dia') {
    const rows = [];
    for (const r of rep.rows) {
      const lines = [];
      if (wantDia && (r.worked || r.dia.length)) lines.push({ tag: 'Diurno', text: r.dia.map(diaText).join(' / ') || '—' });
      if (wantNoite && r.quartos.length) lines.push({ tag: 'Noturno', text: r.quartos.map(nightText).join(' · ') });
      if (lines.length) rows.push({ date: r.date, dow: dw(r), lines });
    }
    sections.push({ title: '', icon: '', rows });
  } else {
    if (wantDia) sections.push({ title: 'Postos diurnos', icon: '☀️', rows: rep.rows.filter((r) => r.worked || r.dia.length).map((r) => ({ date: r.date, dow: dw(r), lines: r.dia.length ? r.dia.map((d) => ({ text: diaText(d) })) : [{ text: '—' }] })) });
    if (wantNoite) sections.push({ title: 'Postos noturnos', icon: '🌙', rows: rep.rows.filter((r) => r.quartos.length).map((r) => ({ date: r.date, dow: dw(r), lines: r.quartos.map((n) => ({ text: nightText(n) })) })) });
  }
  if (o.extras && rep.extras && rep.extras.length) sections.push({ title: 'Extras', icon: '💰', rows: rep.extras.map((e) => ({ date: e.date, dow: dw(e), lines: [{ text: e.turno }] })) });
  const who = o.header ? [profile.name, profile.rank, profile.unit].filter(Boolean).join(' · ') : '';
  const count = o.total ? `${rep.plantoes} ${rep.plantoes === 1 ? 'plantão' : 'plantões'}` : '';
  const empty = sections.every((s) => !s.rows.length);
  return { title: 'Relatório de postos', month: `${MONTHS[rep.m]} de ${rep.y}`, who, count, sections, empty };
}

export function reportText(rep, profile = {}, opts = {}) {
  const M = reportModel(rep, { name: profile.name, unit: profile.unit }, opts); const emo = { Diurno: '☀️', Noturno: '🌙' };
  const L = [`📋 *Relatório de postos — ${MONTHS[rep.m]}/${rep.y}*`]; if (M.who) L.push(M.who); if (M.count) L.push(M.count); L.push('');
  for (const s of M.sections) {
    if (!s.rows.length) continue; if (s.title) L.push(`${s.icon} *${s.title}*`);
    for (const r of s.rows) {
      const d = `${fmtShort(r.date)}${r.dow ? ` (${r.dow})` : ''}`;
      if (r.lines.length === 1 && !r.lines[0].tag) L.push(`${d} · ${r.lines[0].text}`);
      else { L.push(`*${d}*`); for (const l of r.lines) L.push(l.tag ? `   ${emo[l.tag] || ''} ${l.tag}: ${l.text}` : `   • ${l.text}`); }
    }
    L.push('');
  }
  if (M.empty) L.push('Nenhum registro neste mês.');
  while (L.length && L[L.length - 1] === '') L.pop();
  return L.join('\n');
}

// ---------------- imagem (canvas) ----------------
const W = 1240, PH = 1754, M = 76;
export function renderReport(rep, profile = {}, { paged = true, opts = {} } = {}) {
  const model = reportModel(rep, profile, opts); const pages = []; let cv, c, y;
  const F = (w, s) => `${w} ${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const mk = (h) => { cv = document.createElement('canvas'); cv.width = W; cv.height = h; c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, W, h); pages.push(cv); y = M; };
  const txt = (t, x, yy, font, color = '#111827', align = 'left') => { c.font = font; c.fillStyle = color; c.textAlign = align; c.fillText(t, x, yy); };
  const wrap = (t, max, font) => { c.font = font; const out = []; let cur = ''; for (const w of String(t).split(' ')) { const tt = cur ? cur + ' ' + w : w; if (c.measureText(tt).width > max && cur) { out.push(cur); cur = w; } else cur = tt; } if (cur) out.push(cur); return out; };
  const X1 = M, X2 = M + 280, LH = 36; const colW = W - M - X2;
  c = document.createElement('canvas').getContext('2d');
  const meas = model.sections.map((s) => s.rows.map((r) => { const ls = []; for (const l of r.lines) { const ws = wrap(l.text, colW - (l.tag ? 150 : 0), F('700', 26)); ws.forEach((w, k) => ls.push({ tag: k === 0 ? l.tag : '', text: w })); } return { ls, h: Math.max(ls.length, 1) * LH + 26 }; }));
  const totalH = M + 330 + model.sections.reduce((n, s, i) => n + (s.title ? 90 : 20) + meas[i].reduce((a, b) => a + b.h, 0), 0) + 140;
  mk(paged ? PH : Math.max(900, totalH));
  const foot = () => { txt(`${model.month} · Sentinela Tático`, M, cv.height - 52, F('', 21), '#94a3b8'); if (paged) txt(`Página ${pages.length}`, W - M, cv.height - 52, F('', 21), '#94a3b8', 'right'); };
  const sec = (s) => { if (!s.title) return; y += 34; txt(s.title.toUpperCase(), M, y, F('800', 24), '#475569'); y += 14; c.fillStyle = '#cbd5e1'; c.fillRect(M, y, W - 2 * M, 2); y += 10; };
  txt(model.title, M, y + 34, F('800', 48), '#0f172a'); y += 82; txt(model.month + (model.count ? ` · ${model.count}` : ''), M, y, F('600', 28), '#475569'); y += 38;
  if (model.who) { txt(model.who, M, y, F('', 25), '#64748b'); y += 30; }
  y += 24;
  if (model.empty) { y += 50; txt('Nenhum registro neste mês.', M, y, F('', 26), '#64748b'); }
  model.sections.forEach((s, si) => {
    if (!s.rows.length) return; sec(s);
    s.rows.forEach((r, i) => {
      const mm = meas[si][i]; if (paged && y + mm.h > PH - 110) { foot(); mk(PH); if (s.title) { y += 10; txt(s.title.toUpperCase() + ' (cont.)', M, y + 20, F('800', 22), '#475569'); y += 44; } }
      if (i % 2 === 0) { c.fillStyle = '#f8fafc'; c.fillRect(M - 12, y, W - 2 * M + 24, mm.h); }
      const base = y + 16 + 26; txt(fmtShort(r.date), X1, base, F('800', 28)); if (r.dow) txt(r.dow, X1 + 100, base, F('600', 22), '#94a3b8');
      mm.ls.forEach((l, k) => { if (l.tag) txt(l.tag, X2, base + k * LH, F('800', 20), '#94a3b8'); txt(l.text, X2 + (r.lines.some((x) => x.tag) ? 150 : 0), base + k * LH, F('700', 26), '#0f172a'); });
      y += mm.h;
    });
  });
  foot(); if (!paged) { const out = document.createElement('canvas'); out.width = W; out.height = Math.min(cv.height, Math.ceil(y + 100)); out.getContext('2d').drawImage(cv, 0, 0); return [out]; }
  return pages;
}

// ---------------- PDF (páginas em JPEG) ----------------
const enc = new TextEncoder();
const cat = (parts) => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
export function makePdf(jpegs) { // jpegs: [{ bytes: Uint8Array, w, h }]
  const objs = []; const PW = 595.28, PHt = 841.89; const N = jpegs.length;
  const add = (b) => { objs.push(b); return objs.length; };
  add(enc.encode('<< /Type /Catalog /Pages 2 0 R >>')); add(enc.encode(`<< /Type /Pages /Kids [${jpegs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${N} >>`));
  jpegs.forEach((j, i) => {
    const pg = 3 + i * 3; add(enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PHt}] /Resources << /XObject << /Im0 ${pg + 2} 0 R >> >> /Contents ${pg + 1} 0 R >>`));
    const sc = Math.min(PW / j.w, PHt / j.h); const w = j.w * sc, h = j.h * sc; const cs = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} 0 ${(PHt - h).toFixed(2)} cm /Im0 Do Q`;
    add(enc.encode(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    add(cat([enc.encode(`<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.bytes.length} >>\nstream\n`), j.bytes, enc.encode('\nendstream')]));
  });
  const parts = [enc.encode('%PDF-1.4\n')]; const offs = []; let pos = parts[0].length;
  objs.forEach((b, i) => { offs.push(pos); const head = enc.encode(`${i + 1} 0 obj\n`), tail = enc.encode('\nendobj\n'); parts.push(head, b, tail); pos += head.length + b.length + tail.length; });
  let xr = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`; offs.forEach((o) => { xr += `${String(o).padStart(10, '0')} 00000 n \n`; });
  xr += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`; parts.push(enc.encode(xr));
  return cat(parts);
}
export const dataUrlBytes = (u) => { const b = atob(u.split(',')[1]); const o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
export const bytesB64 = (u8) => { let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); };
