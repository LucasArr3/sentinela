import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_QUARTERS, DEFAULT_POSTS, defaultScale } from '../js/core.js';
import { buildReport, reportText, makePdf, dayPostEntries, rowDia, rowNoite } from '../js/report.js';
const Q = DEFAULT_QUARTERS; const qid = (h) => Q.find((q) => q.start.slice(0, 2) === h).id;
const mk = (events) => ({ scale: defaultScale('2026-11-24'), quarters: Q, posts: DEFAULT_POSTS, events, profile: { name: 'Lucas' }, prefs: {} });
const ev = [
  { id: '1', type: 'posto', date: '2026-11-24', post: 'Calibre 12', where: 'Bloco C', from: '08:00', to: '14:00' },
  { id: '2', type: 'posto', date: '2026-11-24', post: 'G1', where: '', from: '14:00', to: '18:00' },
  { id: '3', type: 'quarto', date: '2026-11-24', slot: qid('18'), post: 'G1' }, { id: '4', type: 'quarto', date: '2026-11-24', slot: qid('20'), post: 'G1' }, { id: '5', type: 'quarto', date: '2026-11-24', slot: qid('00'), post: 'G2' },
  { id: '6', type: 'posto', date: '2026-11-28', post: 'Chefe de bloco', where: 'Bloco A', from: '08:00', to: '18:00' },
  { id: '7', type: 'extra', date: '2026-11-26', turno: 'diurna', value: 219 },
];
test('posto do dia com horário padrão 08–18 não mostra horário', () => {
  const e = dayPostEntries(mk(ev), '2026-11-24'); assert.equal(e[0].min, 360);
  const r = buildReport(mk(ev), 2026, 10); const d24 = r.rows.find((x) => x.date === '2026-11-24'); const d28 = r.rows.find((x) => x.date === '2026-11-28');
  assert.equal(rowDia(d28), 'Bloco A · Chefe de bloco'); assert.equal(rowDia(d24), 'Bloco C · Calibre 12 (08:00–14:00) / G1 (14:00–18:00)');
  assert.equal(rowNoite(d24), 'G1 18h–20h · 20h–22h · G2 00h–02h');
});
test('lista só dias de plantão ou com posto, sem extras', () => {
  const r = buildReport(mk(ev), 2026, 10); assert.ok(r.rows.every((x) => x.worked || x.dia.length || x.noite.length)); assert.equal(r.rows.find((x) => x.date === '2026-11-26'), undefined);
  assert.ok(r.plantoes >= 2);
});
test('texto do WhatsApp enxuto', () => {
  const t = reportText(buildReport(mk(ev), 2026, 10), { name: 'Lucas', unit: 'Unidade X' }); assert.match(t, /Relatório de postos — Novembro\/2026/); assert.match(t, /\*28\/11 \(Sáb\)\*\n   ☀️ Diurno: Bloco A · Chefe de bloco/); assert.match(t, /🌙 Noturno: G1 18h–20h · 20h–22h · G2 00h–02h/); assert.doesNotMatch(t, /R\$|Extra/);
});
test('PDF válido a partir de JPEGs', () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); const pdf = makePdf([{ bytes: jpg, w: 10, h: 10 }]); const s = Buffer.from(pdf).toString('latin1'); assert.ok(s.startsWith('%PDF-1.4')); assert.ok(s.trimEnd().endsWith('%%EOF')); assert.match(s, /\/Count 1/);
});
