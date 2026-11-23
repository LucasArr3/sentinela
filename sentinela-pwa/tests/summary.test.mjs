import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary, waLink } from '../js/summary.js';
import { defaultScale } from '../js/core.js';
const state = { profile: { name: 'Lucas', rank: 'Policial Penal', unit: 'Unidade X' }, scale: defaultScale('2026-11-23'),
  events: [{ id: '1', type: 'extra', date: '2026-11-25', turno: 'diurna', value: 219 }, { id: '2', type: 'permuta', date: '2026-11-27', dir: 'passei', who: 'João' }, { id: '3', type: 'atestado', date: '2026-11-10', end: '2026-11-12' }] };
test('resumo completo contém seções', () => {
  const t = buildSummary(state, 2026, 10); 
  for (const x of ['RESUMO DO MÊS — NOVEMBRO/2026', 'PLANTÕES (5)', 'EXTRAS (1)', 'R$', 'PERMUTAS', 'ATESTADO', 'João me deve']) assert.ok(t.includes(x) || t.includes(x.replace('R$', 'R$ ')), x);
});
test('link do whatsapp', () => { assert.ok(waLink('oi mundo', '(11) 91234-5678').startsWith('https://wa.me/5511912345678?text=oi%20mundo')); });
