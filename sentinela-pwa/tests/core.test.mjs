import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultScale, dayInfo, isScheduled, monthSummary, permutaLedger, upcoming, dutyNow, addDays, uid } from '../js/core.js';

const mk = (events = [], anchor = '2026-11-23') => ({ scale: defaultScale(anchor), events });

test('24x72: hoje (âncora) é plantão e o ciclo repete a cada 4 dias', () => {
  const s = mk();
  assert.equal(isScheduled('2026-11-23', s.scale), true);
  assert.equal(isScheduled('2026-11-24', s.scale), false);
  assert.equal(isScheduled('2026-11-26', s.scale), false);
  assert.equal(isScheduled('2026-11-27', s.scale), true);
  assert.equal(isScheduled('2026-11-19', s.scale), true); // passado
  assert.equal(isScheduled('2027-03-01', s.scale), (Math.round((Date.UTC(2027,2,1)-Date.UTC(2026,10,23))/864e5) % 4) === 0);
});
test('permuta passei remove plantão; assumi cria plantão', () => {
  const s = mk([{ id: 'a', type: 'permuta', dir: 'passei', date: '2026-11-27' }, { id: 'b', type: 'permuta', dir: 'assumi', date: '2026-11-25' }]);
  assert.equal(dayInfo('2026-11-27', s).status, 'permuta_out');
  assert.equal(dayInfo('2026-11-27', s).works, false);
  assert.equal(dayInfo('2026-11-25', s).status, 'permuta_in');
  assert.equal(dayInfo('2026-11-25', s).works, true);
});
test('atestado em faixa cobre plantões e soma dias', () => {
  const s = mk([{ id: 'a', type: 'atestado', date: '2026-11-26', end: '2026-12-04' }]);
  assert.equal(dayInfo('2026-11-27', s).status, 'atestado');
  assert.equal(dayInfo('2026-12-01', s).status, 'atestado');
  assert.equal(dayInfo('2026-12-05', s).status, 'plantao');
  const m = monthSummary(s, 2026, 11);
  assert.equal(m.atestados.length, 4);
});
test('extras: soma, pago e pendente; horas', () => {
  const s = mk([{ id: 'a', type: 'extra', date: '2026-11-25', value: 219, turno: 'diurna', paid: true }, { id: 'b', type: 'extra', date: '2026-11-26', value: 250.5, turno: 'noturna' }]);
  const m = monthSummary(s, 2026, 10);
  assert.equal(m.extrasTotal, 469.5); assert.equal(m.extrasPaid, 219); assert.equal(m.extrasPending, 250.5);
  assert.equal(m.plantoes.length, 7); // 3,7,11,15,19,23,27
});
test('saldo de permutas por colega', () => {
  const l = permutaLedger([
    { type: 'permuta', dir: 'passei', who: 'João' }, { type: 'permuta', dir: 'passei', who: 'João' },
    { type: 'permuta', dir: 'assumi', who: 'Maria' }, { type: 'permuta', dir: 'assumi', who: 'João', settled: true },
  ]);
  assert.deepEqual(l.map((r) => [r.who, r.net]), [['João', 2], ['Maria', -1]]);
});
test('próximos plantões e em serviço agora (vira a noite)', () => {
  const s = mk();
  assert.deepEqual(upcoming(s, 3, '2026-11-23').map((d) => d.date), ['2026-11-23', '2026-11-27', '2026-12-01']);
  assert.equal(dutyNow(s, new Date(2026, 10, 23, 9, 0)).on, true);
  assert.equal(dutyNow(s, new Date(2026, 10, 24, 6, 59)).on, true); // madrugada do dia seguinte
  assert.equal(dutyNow(s, new Date(2026, 10, 24, 7, 1)).on, false);
  assert.equal(dutyNow(s, new Date(2026, 10, 23, 6, 0)).on, false);
});
