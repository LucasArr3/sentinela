import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_QUARTERS, DEFAULT_POSTS, defaultScale, slotDate, nextQuarto, quartosOn, monthSummary } from '../js/core.js';
import { slotFromText, nameMatches, parseRoster, matchPost } from '../js/vision.js';
import { parseCommand } from '../js/nlp.js';
import { dueAlarms } from '../js/reminders.js';
import { buildSummary } from '../js/summary.js';
const Q = DEFAULT_QUARTERS;
const st = (events = []) => ({ scale: defaultScale('2026-11-23'), quarters: Q, posts: DEFAULT_POSTS, events, profile: { name: 'Lucas Silva Santos', alias: 'Lucas S' }, prefs: { reminders: true, lead: 15, alvorada: true } });

test('faixa de horário a partir do texto', () => {
  assert.equal(slotFromText('22h às 00h', Q), '22-00'); assert.equal(slotFromText('02:00 - 04:00', Q), '02-04');
  assert.equal(slotFromText('18 as 20', Q), '18-20'); assert.equal(slotFromText('ALVORADA', Q), '06-08'); assert.equal(slotFromText('banana', Q), null);
});
test('nome na lista é o meu', () => {
  const me = ['Lucas Silva Santos', 'Lucas S'];
  assert.equal(nameMatches('PP Lucas Silva', me), true); assert.equal(nameMatches('Ag. Lucas S.', me), true);
  assert.equal(nameMatches('João Pereira', me), false);
});
test('lê o JSON da IA, mesmo com cerca de código', () => {
  const raw = '```json\n{"date":"2026-11-23","entries":[{"name":"PP Lucas Silva","slot":"22h às 00h","post":"pavilhao a"},{"name":"Maria","slot":"00h às 02h","post":"Portaria"}]}\n```';
  const r = parseRoster(raw, { quarters: Q, posts: DEFAULT_POSTS, profile: { name: 'Lucas Silva Santos' } });
  assert.equal(r.date, '2026-11-23'); assert.equal(r.entries.length, 2);
  assert.deepEqual([r.entries[0].slotId, r.entries[0].post, r.entries[0].mine], ['22-00', 'Pavilhão A', true]); assert.equal(r.entries[1].mine, false);
  assert.throws(() => parseRoster('sem json', { quarters: Q, posts: [], profile: { name: 'x' } }));
});
test('quartos após a meia-noite pertencem ao plantão do dia anterior', () => {
  const s = st(); const d = slotDate('2026-11-23', Q[3], s.scale); assert.equal(d.getDate(), 24); assert.equal(d.getHours(), 0);
  assert.equal(slotDate('2026-11-23', Q[0], s.scale).getDate(), 23);
});
test('próximo quarto e alarme 15 min antes', () => {
  const s = st([{ id: 'a', type: 'quarto', date: '2026-11-23', slot: '22-00', post: 'Muralha' }, { id: 'b', type: 'quarto', date: '2026-11-23', slot: '02-04' }]);
  const n = nextQuarto(s, new Date(2026, 10, 23, 21, 0)); assert.equal(n.ev.id, 'a');
  assert.equal(nextQuarto(s, new Date(2026, 10, 24, 0, 30)).ev.id, 'b');
  const al = dueAlarms(s, new Date(2026, 10, 23, 21, 46)); assert.equal(al.length, 1); assert.match(al[0].body, /Muralha/);
  assert.equal(dueAlarms(s, new Date(2026, 10, 23, 21, 47)).length, 0); // não repete
});
test('comando de voz para quartos', () => {
  const r = parseCommand('marca quartos 22 às 00 e 02 às 04 dia 27 no pavilhão A', '2026-11-23', { quarters: Q, posts: DEFAULT_POSTS });
  assert.equal(r.kind, 'quartos'); assert.deepEqual(r.ids, ['22-00', '02-04']); assert.equal(r.date, '2026-11-27'); assert.equal(r.post, 'Pavilhão A');
  assert.equal(parseCommand('todos os quartos hoje', '2026-11-23', { quarters: Q, posts: [] }).ids.length, 6);
});
test('resumo inclui quartos e postos', () => {
  const s = st([{ id: 'a', type: 'quarto', date: '2026-11-23', slot: '22-00', post: 'Muralha' }, { id: 'b', type: 'quarto', date: '2026-11-23', slot: '02-04', post: 'Ronda' }]);
  const t = buildSummary(s, 2026, 10, { kind: 'completo' }); assert.match(t, /QUARTOS E POSTOS \(2\)/); assert.match(t, /22h–00h Muralha · 02h–04h Ronda/);
  assert.equal(quartosOn(s, '2026-11-23').map((e) => e.slot).join(), '22-00,02-04');
});
