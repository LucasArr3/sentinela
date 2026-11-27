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
  const raw = '```json\n{"date":"2026-11-23","entries":[{"name":"PP Lucas Silva","slot":"22h às 00h","post":"bloco a"},{"name":"Maria","slot":"00h às 02h","post":"Portaria"}]}\n```';
  const r = parseRoster(raw, { quarters: Q, posts: DEFAULT_POSTS, profile: { name: 'Lucas Silva Santos' } });
  assert.equal(r.date, '2026-11-23'); assert.equal(r.entries.length, 2);
  assert.deepEqual([r.entries[0].slotId, r.entries[0].post, r.entries[0].mine], ['22-00', 'Bloco A', true]); assert.equal(r.entries[1].mine, false);
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
  const r = parseCommand('marca quartos 22 às 00 e 02 às 04 dia 27 no bloco A', '2026-11-23', { quarters: Q, posts: DEFAULT_POSTS });
  assert.equal(r.kind, 'quartos'); assert.deepEqual(r.ids, ['22-00', '02-04']); assert.equal(r.date, '2026-11-27'); assert.equal(r.post, 'Bloco A');
  assert.equal(parseCommand('todos os quartos hoje', '2026-11-23', { quarters: Q, posts: [] }).ids.length, 6);
});
test('resumo inclui quartos e postos', () => {
  const s = st([{ id: 'a', type: 'quarto', date: '2026-11-23', slot: '22-00', post: 'Muralha' }, { id: 'b', type: 'quarto', date: '2026-11-23', slot: '02-04', post: 'Ronda' }]);
  const t = buildSummary(s, 2026, 10, { kind: 'completo' }); assert.match(t, /QUARTOS E POSTOS \(2\)/); assert.match(t, /22:00–00:00 Muralha · 02:00–04:00 Ronda/);
  assert.equal(quartosOn(s, '2026-11-23').map((e) => e.slot).join(), '22-00,02-04');
});

import { holidayName, monthHolidays } from '../js/core.js';
test('feriados nacionais (inclusive móveis) e municipais', () => {
  assert.equal(holidayName('2026-12-25'), 'Natal'); assert.equal(holidayName('2026-04-03'), 'Sexta-feira Santa'); assert.equal(holidayName('2026-04-05'), 'Páscoa');
  assert.equal(holidayName('2026-02-17'), 'Carnaval'); assert.equal(holidayName('2026-06-04'), 'Corpus Christi'); assert.equal(holidayName('2026-11-23'), '');
  assert.equal(holidayName('2027-03-26'), 'Sexta-feira Santa'); // Páscoa 2027 = 28/03
  assert.equal(holidayName('2026-08-15', [{ md: '08-15', name: 'Aniversário da cidade' }]), 'Aniversário da cidade');
  assert.deepEqual(monthHolidays(2026, 10).map((h) => h.name), ['Finados', 'Proclamação da República', 'Consciência Negra']);
});
test('alarme individual por quarto: antecedência e som próprios', () => {
  const qs = DEFAULT_QUARTERS.map((q) => (q.id === '22-00' ? { ...q, lead: 5, sound: 'sonar' } : q.id === '02-04' ? { ...q, alarm: false } : q));
  const s = { ...st([{ id: 'x1', type: 'quarto', date: '2026-11-23', slot: '22-00', post: 'X' }, { id: 'x2', type: 'quarto', date: '2026-11-23', slot: '02-04' }, { id: 'x3', type: 'quarto', date: '2026-11-23', slot: '20-22' }]), quarters: qs };
  assert.equal(dueAlarms(s, new Date(2026, 10, 23, 21, 46)).length, 0); // 15 min padrão não vale para o 22-00 (usa 5)
  const a = dueAlarms(s, new Date(2026, 10, 23, 21, 56)); assert.equal(a.length, 1); assert.equal(a[0].sound, 'sonar');
  const c = dueAlarms(s, new Date(2026, 10, 23, 19, 46)); assert.equal(c.length, 1); assert.equal(c[0].sound, 'sirene_lamento'); // 20-22 usa 15 min e som padrão
  assert.equal(dueAlarms(s, new Date(2026, 10, 24, 1, 46)).length, 0); // alarme desligado no 02-04
});

import { buildAlarms, alarmsBetween, hashId } from '../js/reminders.js';
import { SOUND_LIST, migrateSound, isBuiltin } from '../js/sounds.js';
test('buildAlarms: próximos 14 dias, ordenados, ids estáveis e únicos', () => {
  const evs = [{ id: 'k1', type: 'quarto', date: '2026-11-23', slot: '22-00', post: 'Muralha' }, { id: 'k2', type: 'quarto', date: '2026-11-27', slot: '02-04' }, { id: 'k3', type: 'quarto', date: '2026-12-20', slot: '18-20' }];
  const s = st(evs); const now = new Date(2026, 10, 23, 8, 0);
  const a = buildAlarms(s, now, 14); const q = a.filter((x) => x.kind === 'quarto');
  assert.equal(q.length, 2); // o de 20/12 fica fora do horizonte
  assert.ok(q[0].at < q[1].at); assert.equal(new Date(q[0].at).getHours(), 21); assert.equal(new Date(q[0].at).getMinutes(), 45);
  assert.equal(q[0].body, 'Posto: Muralha'); assert.deepEqual(a.map((x) => x.id), buildAlarms(s, now, 14).map((x) => x.id));
  assert.equal(new Set(a.map((x) => x.id)).size, a.length);
});
test('Alvorada: toca nos plantões de 24h às 06:00 do dia seguinte', () => {
  const s = st(); const now = new Date(2026, 10, 23, 8, 0);
  const alv = buildAlarms(s, now, 10).filter((x) => x.kind === 'alvorada'); const d = alv.map((x) => new Date(x.at).toISOString().slice(0, 10));
  assert.equal(alv.length >= 2, true); assert.equal(new Date(alv[0].at).getHours() , 6); assert.equal(alv[0].sound, 'clarim');
  assert.equal(d[0] , new Date(2026, 10, 24, 6).toISOString().slice(0, 10));
  assert.equal(buildAlarms({ ...s, prefs: { ...s.prefs, alvorada: false } }, now, 10).filter((x) => x.kind === 'alvorada').length, 0);
  const s12 = { ...s, scale: { ...s.scale, hours: 12 } }; assert.equal(buildAlarms(s12, now, 10).filter((x) => x.kind === 'alvorada').length, 0); // 12h: 06:00 fora do serviço
  assert.equal(buildAlarms({ ...s, prefs: { ...s.prefs, reminders: false } }, now, 10).length, 0);
});
test('catálogo de sons e migração dos ids antigos', () => {
  assert.equal(SOUND_LIST.length, 13); assert.equal(migrateSound('sirene'), 'sirene_lamento'); assert.equal(migrateSound('alvorada'), 'clarim'); assert.equal(migrateSound('klaxon'), 'klaxon');
  assert.ok(isBuiltin('radio')); assert.ok(!isBuiltin('custom:abc')); assert.notEqual(hashId('a'), hashId('b'));
});

test('lembrete antes do plantão (opcional) e extras com cores distintas', () => {
  const s = st(); const now = new Date(2026, 10, 23, 0, 0);
  assert.equal(buildAlarms(s, now, 3).filter((x) => x.kind === 'plantao').length, 0); // desligado por padrão
  const on = { ...s, prefs: { ...s.prefs, shiftReminder: 120 } };
  const a = buildAlarms(on, now, 3).filter((x) => x.kind === 'plantao'); assert.equal(a.length, 1);
  assert.equal(new Date(a[0].at).getHours(), 5); assert.match(a[0].body, /2 horas/); assert.equal(a[0].sound, 'carrilhao');
});

import { buildWidget } from '../js/reminders.js';
test('widget: próximos plantões e quartos para a tela inicial', () => {
  const s = st([{ id: 'w1', type: 'quarto', date: '2026-11-23', slot: '22-00', post: 'Bloco A' }]); const now = new Date(2026, 10, 23, 8, 0);
  const w = buildWidget(s, now); assert.ok(w.shifts.length >= 3 && w.shifts[0].s <= now.getTime() && w.shifts[0].e > now.getTime()); // plantão em andamento
  assert.equal(new Date(w.shifts[0].s).getHours(), 7); assert.equal(w.shifts[0].e - w.shifts[0].s, 24 * 3600e3);
  assert.deepEqual([w.quartos.length, w.quartos[0].l, w.quartos[0].p], [1, '22:00–00:00', 'Bloco A']); assert.equal(new Date(w.quartos[0].e).getDate(), 24);
  assert.deepEqual(buildWidget(s, new Date(2026, 10, 25, 9, 0)).quartos, []); // quarto já passou
});
