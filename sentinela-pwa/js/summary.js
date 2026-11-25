// Geração de textos formatados para WhatsApp (*negrito*, _itálico_, ``` monoespaçado ```).
import { MONTHS, WD3, monthSummary, permutaLedger, upcoming, qLabel, fmtShort, fmtBR, parse, addDays, scaleLabel, TURNOS, daysInMonth, pad, today, dateLong, evEnd } from './core.js';

const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); // texto de envio: valor real
const dow = (d) => WD3[parse(d).getDay()];
const line = '━━━━━━━━━━━━━━━━━━';

function miniCalendar(state, y, m) {
  const sum = monthSummary(state, y, m); const map = Object.fromEntries(sum.days.map((d) => [d.date, d]));
  const first = new Date(y, m, 1).getDay(); const n = daysInMonth(y, m);
  const mark = (d) => { const s = d.status; return s === 'plantao' ? '▣' : s === 'permuta_in' ? '◈' : s === 'extra' ? '★' : s === 'permuta_out' ? '◇' : s === 'atestado' ? '✚' : s === 'folga' ? '○' : s === 'ferias' ? '☼' : ' '; };
  let out = 'D   S   T   Q   Q   S   S\n'; let row = '    '.repeat(first);
  for (let i = 1; i <= n; i++) {
    const d = map[`${y}-${pad(m + 1)}-${pad(i)}`]; row += `${pad(i)}${mark(d)} `;
    if ((first + i) % 7 === 0 || i === n) { out += row.trimEnd() + '\n'; row = ''; }
  }
  return out + '\n▣ plantão  ★ extra  ◈ assumi\n◇ passei  ○ folga  ✚ atestado';
}

export function buildSummary(state, y, m, opts = {}) {
  const o = { kind: 'completo', values: true, notes: true, calendar: true, ...opts };
  const s = monthSummary(state, y, m); const p = state.profile; const L = [];
  const title = { escala: 'ESCALA', financeiro: 'RESUMO FINANCEIRO', completo: 'RESUMO DO MÊS', proximos: 'PRÓXIMOS PLANTÕES' }[o.kind];
  if (o.kind === 'proximos') {
    L.push(`🛡️ *${title}*`, `👤 *${p.name || 'Servidor'}*${p.rank ? ` · ${p.rank}` : ''}`, `🔁 Escala ${scaleLabel(state.scale)}`, line);
    const up = upcoming(state, 8);
    L.push(...up.map((d) => `▫️ *${dow(d.date)} ${fmtShort(d.date)}* — ${d.status === 'extra' ? 'Extra' : d.status === 'permuta_in' ? 'Permuta (assumi)' : 'Plantão ' + state.scale.hours + 'h'}`));
    L.push(line, `_Gerado pelo Sentinela Tático_`); return L.join('\n');
  }
  L.push(`🛡️ *${title} — ${MONTHS[m].toUpperCase()}/${y}*`);
  L.push(`👤 *${p.name || 'Servidor'}*${p.rank ? ` · ${p.rank}` : ''}`);
  if (p.unit) L.push(`📍 ${p.unit}`);
  L.push(`🔁 Escala ${scaleLabel(state.scale)} · início ${state.scale.start}`, line);

  if (o.kind !== 'financeiro') {
    if (o.calendar) L.push('📆 *CALENDÁRIO*', '```', miniCalendar(state, y, m), '```', '');
    L.push(`⚔️ *PLANTÕES (${s.plantoes.length + s.permutaIn.length})*`);
    const work = s.days.filter((d) => ['plantao', 'permuta_in'].includes(d.status));
    L.push(...(work.length ? work.map((d) => `▫️ ${dow(d.date)} ${fmtShort(d.date)}${d.status === 'permuta_in' ? ' _(permuta — assumi)_' : ''}`) : ['— nenhum —']));
    L.push('');
    if (s.quartos.length) {
      L.push(`⏱️ *QUARTOS E POSTOS (${s.quartos.length})*`); const byDay = {};
      for (const e of s.quartos) { const q = state.quarters.find((x) => x.id === e.slot); (byDay[e.date] = byDay[e.date] || []).push(`${q ? qLabel(q) : e.slot}${e.post ? ' ' + e.post : ''}`); }
      L.push(...Object.entries(byDay).map(([d, v]) => `▫️ ${dow(d)} ${fmtShort(d)} — ${v.join(' · ')}`), '');
    }
  }
  if (s.extras.length || o.kind === 'financeiro') {
    L.push(`💰 *EXTRAS (${s.extras.length})*`);
    L.push(...(s.extras.length ? s.extras.map((e) => `▫️ ${dow(e.date)} ${fmtShort(e.date)} — ${(TURNOS[e.turno] || 'Extra').replace(/ \(.*\)/, '')}${o.values ? ` — ${brl(e.value)}${e.paid ? ' ✅' : ' ⏳'}` : ''}`) : ['— nenhuma —']));
    if (o.values && s.extras.length) L.push(`➡️ *Total: ${brl(s.extrasTotal)}*`, `✅ Recebido: ${brl(s.extrasPaid)}`, `⏳ A receber: ${brl(s.extrasPending)}`);
    L.push('');
  }
  if (s.permutas.length) {
    L.push(`🔁 *PERMUTAS (${s.permutas.length})*`);
    L.push(...s.permutas.map((e) => `▫️ ${fmtShort(e.date)} — ${e.dir === 'passei' ? 'Passei p/' : 'Assumi de'} *${e.who || 'colega'}*${e.settled ? ' ✅' : ' ⏳'}${e.returnDate && !e.settled ? ` _(devolução ${fmtShort(e.returnDate)})_` : ''}`));
    const led = permutaLedger(state.events);
    if (led.length) L.push('', ...led.map((r) => `⚖️ ${r.net > 0 ? `${r.who} me deve *${r.net}*` : `devo *${-r.net}* a ${r.who}`} plantão(ões)`));
    L.push('');
  }
  if (o.kind !== 'financeiro') {
    const grp = (rows) => { const out = []; let cur = null; for (const d of rows) { if (cur && d.date === addDays(cur.b, 1)) cur.b = d.date; else { cur = { a: d.date, b: d.date }; out.push(cur); } } return out.map((r) => (r.a === r.b ? fmtShort(r.a) : `${fmtShort(r.a)} a ${fmtShort(r.b)}`)).join(', '); };
    if (s.folgas.length) L.push(`🌙 *FOLGAS (${s.folgas.length})*`, `▫️ ${grp(s.folgas)}`, '');
    if (s.atestados.length) L.push(`🏥 *ATESTADO MÉDICO (${s.atestados.length} dia${s.atestados.length > 1 ? 's' : ''})*`, `▫️ ${grp(s.atestados)}`, '');
    if (s.ferias.length) L.push(`🏖️ *FÉRIAS (${s.ferias.length} dias)*`, `▫️ ${grp(s.ferias)}`, '');
    if (o.notes) {
      const notes = [...s.obs, ...state.events.filter((e) => e.type !== 'obs' && e.note && e.date.startsWith(`${y}-${pad(m + 1)}`))];
      if (notes.length) L.push('📝 *OBSERVAÇÕES*', ...notes.map((e) => `▫️ ${fmtShort(e.date)} — ${e.note}`), '');
    }
    const oc = state.events.filter((e) => e.type === 'ocorrencia' && e.date.startsWith(`${y}-${pad(m + 1)}`)).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    if (o.kind === 'completo' && oc.length) L.push(`📒 *OCORRÊNCIAS (${oc.length})*`, ...oc.map((e) => `▫️ ${fmtShort(e.date)}${e.time ? ' ' + e.time : ''} — ${e.title || 'Ocorrência'}${e.place ? ' (' + e.place + ')' : ''}${e.prio && e.prio !== 'Normal' ? ' ⚠️' : ''}`), '');
    L.push(`⏱️ Carga estimada: *${s.hours}h*`);
  }
  L.push(line, `_Gerado pelo Sentinela Tático · ${fmtBR(today())}_`);
  return L.join('\n').replace(/\n{3,}/g, '\n\n');
}

export const waLink = (text, phone = '') => {
  const digits = (phone || '').replace(/\D/g, ''); const num = digits ? (digits.length <= 11 ? '55' + digits : digits) : '';
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
};
