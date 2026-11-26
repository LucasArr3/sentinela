import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_QUARTERS, DEFAULT_POSTS, defaultScale } from '../js/core.js';
import { buildReport, reportText, makePdf, rpHours, dayPostEntries } from '../js/report.js';
const Q = DEFAULT_QUARTERS; const qid = (h) => Q.find((q) => q.start.slice(0, 2) === h).id;
const mk = (events) => ({ scale: defaultScale('2026-11-24'), quarters: Q, posts: DEFAULT_POSTS, events, profile: { name: 'Lucas' }, prefs: {} });
const ev = [
  { id: '1', type: 'posto', date: '2026-11-24', post: 'Calibre 12', where: 'Bloco C', from: '', to: '14:00' },
  { id: '2', type: 'posto', date: '2026-11-24', post: 'G1', where: '', from: '14:00', to: '' },
  { id: '3', type: 'quarto', date: '2026-11-24', slot: qid('18'), post: 'G1' }, { id: '4', type: 'quarto', date: '2026-11-24', slot: qid('20'), post: 'G1' }, { id: '5', type: 'quarto', date: '2026-11-24', slot: qid('00'), post: 'G2' },
  { id: '6', type: 'extra', date: '2026-11-26', turno: 'diurna', value: 219, paid: true },
  { id: '7', type: 'ocorrencia', date: '2026-11-24', title: 'Revista', time: '14:30', cat: 'Segurança', place: 'Bloco B' },
];
test('horas dos postos do dia e da noite', () => {
  const e = dayPostEntries(mk(ev), '2026-11-24'); assert.equal(e[0].from, '07:00'); assert.equal(e[0].to, '14:00'); assert.equal(e[0].min, 420); assert.equal(e[1].to, '18:00'); assert.equal(e[1].min, 240);
  const r = buildReport(mk(ev), 2026, 10); const g1 = r.posts.find((p) => p.post === 'G1'); assert.equal(g1.min, 240 + 240); assert.equal(g1.dia, 240); assert.equal(g1.noite, 240);
  assert.equal(r.posts.find((p) => p.post === 'G2').min, 120); assert.equal(r.totals.quartos, 3); assert.equal(r.totals.quartosMin, 360); assert.equal(r.totals.diaMin, 660);
  assert.equal(r.totals.extras, 1); assert.equal(r.totals.ocorrencias, 1);
});
test('dia a dia só traz dias com plantão ou registro', () => {
  const r = buildReport(mk(ev), 2026, 10); const d = r.days.find((x) => x.date === '2026-11-24'); assert.ok(d && d.hours === 24); assert.ok(d.lines.some((l) => l.k === 'oc' && l.post === 'Revista'));
  assert.ok(r.days.every((x) => x.hours || x.lines.length || x.status !== 'livre'));
});
test('texto do WhatsApp', () => {
  const t = reportText(buildReport(mk(ev), 2026, 10), { name: 'Lucas', unit: 'Unidade X' }); assert.match(t, /RELATÓRIO DO MÊS — NOVEMBRO\/2026/); assert.match(t, /POR POSTO/); assert.match(t, /G1 — 8h/); assert.match(t, /07:00–14:00 Calibre 12 · Bloco C/); assert.match(t, /18h–20h · 20h–22h G1/);
});
test('PDF válido a partir de JPEGs', () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); const pdf = makePdf([{ bytes: jpg, w: 10, h: 10 }, { bytes: jpg, w: 10, h: 10 }]);
  const s = Buffer.from(pdf).toString('latin1'); assert.ok(s.startsWith('%PDF-1.4')); assert.ok(s.trimEnd().endsWith('%%EOF')); assert.match(s, /\/Count 2/); assert.match(s, /startxref\n\d+\n%%EOF/);
  const off = Number(/startxref\n(\d+)/.exec(s)[1]); assert.equal(s.slice(off, off + 4), 'xref'); assert.equal(rpHours(150), '2h30'); assert.equal(rpHours(120), '2h');
});
