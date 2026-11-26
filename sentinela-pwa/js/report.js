// Relatório detalhado do mês: horários, postos, extras e ocorrências.
// buildReport/reportText são puros (testáveis). renderReport/makePdf geram imagem e PDF sem bibliotecas.
import { monthDays, dayInfo, quartosOn, qLabel, fmtShort, WD3, MONTHS, brl, STATUS, TURNOS } from './core.js';

const rpMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
export const rpHours = (min) => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`; };
const rpHM = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const rpWhere = (e) => `${e.post}${e.where ? ' · ' + e.where : ''}`;

// Postos do dia com horário calculado (sem horário = do início do plantão até as 18h)
export function dayPostEntries(state, date) {
  const list = state.events.filter((x) => x.type === 'posto' && x.date === date).sort((a, b) => (a.from || '').localeCompare(b.from || ''));
  const base = rpMin(state.scale.start || '07:00');
  return list.map((e, i) => {
    const s = e.from ? rpMin(e.from) : base; const next = list[i + 1] && list[i + 1].from ? rpMin(list[i + 1].from) : 0;
    const en = e.to ? rpMin(e.to) : (next > s ? next : 18 * 60);
    return { label: rpWhere(e), from: rpHM(s), to: rpHM(en), min: Math.max(0, en - s), allDay: !e.from && !e.to };
  });
}
function rpSlotMin(q) { let d = rpMin(q.end) - rpMin(q.start); if (d <= 0) d += 1440; return d; }

export function buildReport(state, y, m) {
  const days = []; const byPost = new Map(); const T = { plantoes: 0, plantaoHoras: 0, extras: 0, extrasValor: 0, extrasPago: 0, quartos: 0, quartosMin: 0, diaMin: 0, permutas: 0, folgas: 0, atestados: 0, ferias: 0, ocorrencias: 0 };
  const add = (post, min, kind, date) => { const o = byPost.get(post) || { post, min: 0, regs: 0, dias: new Set(), dia: 0, noite: 0 }; o.min += min; o.regs++; o.dias.add(date); o[kind] += min; byPost.set(post, o); };
  for (const date of monthDays(y, m)) {
    const info = dayInfo(date, state); const lines = [];
    if (info.status === 'plantao' || info.status === 'permuta_in') { T.plantoes++; T.plantaoHoras += state.scale.hours; }
    for (const e of dayPostEntries(state, date)) { lines.push({ k: 'dia', time: e.allDay ? 'dia todo' : `${e.from}–${e.to}`, post: e.label, min: e.min }); T.diaMin += e.min; add(e.label, e.min, 'dia', date); }
    const nights = new Map();
    for (const e of quartosOn(state, date)) { const q = state.quarters.find((x) => x.id === e.slot); if (!q) continue; const key = e.post || 'Sem posto'; const o = nights.get(key) || { post: key, slots: [], min: 0 }; o.slots.push(q.alvorada ? `Alvorada ${qLabel(q)}` : qLabel(q)); o.min += rpSlotMin(q); nights.set(key, o); }
    for (const o of nights.values()) { lines.push({ k: 'noite', time: o.slots.join(' · '), post: o.post, min: o.min }); T.quartos += o.slots.length; T.quartosMin += o.min; add(o.post, o.min, 'noite', date); }
    for (const e of info.events) {
      if (e.type === 'extra') { T.extras++; T.extrasValor += Number(e.value) || 0; if (e.paid) T.extrasPago += Number(e.value) || 0; lines.push({ k: 'extra', time: '', post: `${TURNOS[e.turno] || 'Extra'}${e.value != null ? ' · ' + brl(e.value) : ''}${e.paid ? ' · recebida' : ''}` }); }
      else if (e.type === 'permuta') { T.permutas++; lines.push({ k: 'permuta', time: '', post: `${e.dir === 'passei' ? 'Passei plantão para' : 'Assumi plantão de'} ${e.who || 'colega'}` }); }
      else if (e.type === 'folga') { T.folgas++; lines.push({ k: 'folga', time: '', post: `Folga${e.reason ? ' · ' + e.reason : ''}` }); }
      else if (e.type === 'atestado') { T.atestados++; lines.push({ k: 'atestado', time: '', post: `Atestado${e.cid ? ' · CID ' + e.cid : ''}` }); }
      else if (e.type === 'ferias') { T.ferias++; lines.push({ k: 'ferias', time: '', post: 'Férias' }); }
      else if (e.type === 'ocorrencia') { T.ocorrencias++; lines.push({ k: 'oc', time: e.time || '', post: e.title || 'Ocorrência', sub: [e.cat, e.place].filter(Boolean).join(' · ') }); }
      else if (e.type === 'obs' && e.note) lines.push({ k: 'obs', time: '', post: e.note.slice(0, 80) });
    }
    const worked = ['plantao', 'permuta_in', 'extra'].includes(info.status);
    if (lines.length || worked) days.push({ date, dow: WD3[new Date(`${date}T12:00:00`).getDay()], status: info.status, statusLabel: STATUS[info.status] ? STATUS[info.status].label : '', hours: worked ? (info.status === 'extra' ? 12 : state.scale.hours) : 0, lines });
  }
  const posts = [...byPost.values()].map((o) => ({ post: o.post, min: o.min, regs: o.regs, dias: o.dias.size, dia: o.dia, noite: o.noite })).sort((a, b) => b.min - a.min);
  return { y, m, title: `${MONTHS[m]} de ${y}`, totals: T, posts, days };
}

export function reportText(rep, profile = {}) {
  const T = rep.totals; const L = [];
  L.push(`📋 *RELATÓRIO DO MÊS — ${MONTHS[rep.m].toUpperCase()}/${rep.y}*`);
  if (profile.name) L.push(`👤 *${profile.name}*${profile.rank ? ' · ' + profile.rank : ''}`);
  if (profile.unit) L.push(`📍 ${profile.unit}`);
  L.push('━━━━━━━━━━━━━━', '*RESUMO*', `▫️ Plantões: ${T.plantoes} (${T.plantaoHoras}h)`, `▫️ Tempo em posto: dia ${rpHours(T.diaMin)} · noite ${rpHours(T.quartosMin)} (${T.quartos} quarto${T.quartos === 1 ? '' : 's'})`);
  if (T.extras) L.push(`▫️ Extras: ${T.extras} · ${brl(T.extrasValor)}`);
  if (T.permutas) L.push(`▫️ Permutas: ${T.permutas}`);
  if (T.ocorrencias) L.push(`▫️ Ocorrências: ${T.ocorrencias}`);
  if (rep.posts.length) { L.push('', '*POR POSTO*'); for (const p of rep.posts) L.push(`▫️ ${p.post} — ${rpHours(p.min)} · ${p.dias} dia${p.dias === 1 ? '' : 's'}`); }
  if (rep.days.length) {
    L.push('', '*DIA A DIA*');
    for (const d of rep.days) {
      L.push(`▪️ *${d.dow} ${fmtShort(d.date)}*${d.hours ? ` · ${d.statusLabel || 'Plantão'} ${d.hours}h` : (d.statusLabel && d.status !== 'livre' ? ' · ' + d.statusLabel : '')}`);
      for (const l of d.lines) L.push(`   ${l.k === 'dia' ? '☀️' : l.k === 'noite' ? '🌙' : l.k === 'extra' ? '💰' : l.k === 'oc' ? '📒' : '•'} ${l.time ? l.time + ' ' : ''}${l.post}${l.sub ? ' (' + l.sub + ')' : ''}`);
    }
  }
  return L.join('\n');
}

// ---------------- imagem (canvas) ----------------
const W = 1240, PH = 1754, M = 76;
export function renderReport(rep, profile = {}, { paged = true } = {}) {
  const T = rep.totals; const pages = []; let cv, c, y;
  const mk = (h) => { cv = document.createElement('canvas'); cv.width = W; cv.height = h; c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, W, h); pages.push(cv); y = M; };
  const F = (w, s) => `${w} ${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const txt = (t, x, yy, font, color = '#111827', align = 'left') => { c.font = font; c.fillStyle = color; c.textAlign = align; c.fillText(t, x, yy); };
  const fit = (t, max, font) => { c.font = font; if (c.measureText(t).width <= max) return t; while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; };
  // pré-cálculo da altura para o modo "imagem única"
  const rowsH = 44; const dayH = (d) => 54 + d.lines.length * 40;
  const headH = 330; const sumH = 250; const postH = rep.posts.length ? 100 + rep.posts.length * rowsH : 0;
  const totalH = M + headH + sumH + postH + 80 + rep.days.reduce((s, d) => s + dayH(d) + 14, 0) + 120;
  mk(paged ? PH : Math.max(PH / 2, totalH));
  const bottom = () => (paged ? PH - 110 : cv.height - 110);
  const need = (h) => { if (paged && y + h > bottom()) { foot(); mk(PH); } };
  const foot = () => { txt(`${MONTHS[rep.m]} de ${rep.y} · gerado pelo Sentinela Tático`, M, cv.height - 56, F('', 22), '#94a3b8'); txt(`Página ${pages.length}`, W - M, cv.height - 56, F('', 22), '#94a3b8', 'right'); };
  // cabeçalho
  c.fillStyle = '#0f172a'; c.fillRect(0, 0, W, 250); txt('RELATÓRIO DO MÊS', M, 100, F('800', 26), '#93c5fd'); txt(`${MONTHS[rep.m]} de ${rep.y}`, M, 170, F('800', 66), '#fff');
  txt([profile.name, profile.rank].filter(Boolean).join(' · ') || 'Sentinela Tático', M, 220, F('600', 28), '#cbd5e1');
  y = 250 + 60; if (profile.unit || profile.matricula) { txt([profile.unit, profile.matricula ? 'Mat. ' + profile.matricula : ''].filter(Boolean).join(' · '), M, y, F('', 26), '#475569'); y += 20; }
  y += 30;
  // resumo (cartões)
  const boxes = [[`${T.plantoes}`, 'Plantões', `${T.plantaoHoras}h`], [rpHours(T.diaMin), 'Posto de dia', ''], [rpHours(T.quartosMin), 'Quartos (noite)', `${T.quartos} horários`], [`${T.extras}`, 'Extras', brl(T.extrasValor)], [`${T.permutas}`, 'Permutas', ''], [`${T.ocorrencias}`, 'Ocorrências', '']];
  const bw = (W - 2 * M - 2 * 20) / 3; boxes.forEach((b, i) => { const bx = M + (i % 3) * (bw + 20), by = y + Math.floor(i / 3) * 112; c.fillStyle = '#f1f5f9'; c.beginPath(); c.roundRect(bx, by, bw, 96, 18); c.fill(); txt(b[0], bx + 24, by + 52, F('800', 40), '#0f172a'); txt(b[1] + (b[2] ? ' · ' + b[2] : ''), bx + 24, by + 82, F('600', 21), '#64748b'); });
  y += 2 * 112 + 36;
  // por posto
  if (rep.posts.length) {
    need(100 + rowsH * 2); txt('POR POSTO', M, y, F('800', 24), '#334155'); y += 18; c.fillStyle = '#e2e8f0'; c.fillRect(M, y, W - 2 * M, 2); y += 40;
    txt('Posto', M, y, F('700', 21), '#94a3b8'); txt('Dia', 700, y, F('700', 21), '#94a3b8', 'right'); txt('Noite', 860, y, F('700', 21), '#94a3b8', 'right'); txt('Total', 1010, y, F('700', 21), '#94a3b8', 'right'); txt('Dias', W - M, y, F('700', 21), '#94a3b8', 'right'); y += 16;
    rep.posts.forEach((p, i) => { need(rowsH + 10); y += rowsH - 10; if (i % 2 === 0) { c.fillStyle = '#f8fafc'; c.fillRect(M - 10, y - 32, W - 2 * M + 20, rowsH); } txt(fit(p.post, 520, F('700', 26)), M, y, F('700', 26)); txt(p.dia ? rpHours(p.dia) : '—', 700, y, F('', 25), '#475569', 'right'); txt(p.noite ? rpHours(p.noite) : '—', 860, y, F('', 25), '#475569', 'right'); txt(rpHours(p.min), 1010, y, F('800', 26), '#0f172a', 'right'); txt(String(p.dias), W - M, y, F('', 25), '#475569', 'right'); y += 10; });
    y += 40;
  }
  // dia a dia
  need(160); txt('DIA A DIA', M, y, F('800', 24), '#334155'); y += 18; c.fillStyle = '#e2e8f0'; c.fillRect(M, y, W - 2 * M, 2); y += 16;
  if (!rep.days.length) { y += 40; txt('Nenhum registro neste mês.', M, y, F('', 26), '#64748b'); }
  const col = { dia: '#2563eb', noite: '#7c3aed', extra: '#16a34a', permuta: '#d97706', folga: '#0891b2', atestado: '#dc2626', ferias: '#db2777', oc: '#be185d', obs: '#64748b' };
  for (const d of rep.days) {
    need(dayH(d) + 14); y += 42; txt(`${d.dow} ${fmtShort(d.date)}`, M, y, F('800', 30)); const tag = d.hours ? `${d.statusLabel || 'Plantão'} ${d.hours}h` : (d.status !== 'livre' ? d.statusLabel : ''); if (tag) txt(tag, M + 190, y, F('700', 22), '#64748b'); y += 8;
    for (const l of d.lines) { y += 40; c.fillStyle = col[l.k] || '#64748b'; c.beginPath(); c.arc(M + 12, y - 9, 7, 0, 7); c.fill(); let x = M + 40; if (l.time) { txt(fit(l.time, 330, F('700', 24)), x, y, F('700', 24), '#334155'); x += 350; } txt(fit(l.post + (l.sub ? ' · ' + l.sub : ''), W - M - x, F('600', 25)), x, y, F('600', 25), '#0f172a'); }
    y += 14; c.fillStyle = '#f1f5f9'; c.fillRect(M, y, W - 2 * M, 1.5); y += 4;
  }
  foot(); if (!paged) { const out = document.createElement('canvas'); out.width = W; out.height = Math.min(cv.height, Math.ceil(y + 110)); out.getContext('2d').drawImage(cv, 0, 0); return [out]; }
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
