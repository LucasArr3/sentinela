import test from 'node:test';
import assert from 'node:assert/strict';
import { alarmMs } from '../js/core.js';

test('alarme: minutos antes (qualquer valor) e horário exato', () => {
  const st = new Date(2026, 10, 26, 0, 0).getTime();
  assert.equal(alarmMs({ lead: 7 }, st, 15), st - 7 * 60000);
  assert.equal(alarmMs({}, st, 15), st - 15 * 60000);
  assert.equal(alarmMs({ lead: 0 }, st, 15), st);
  // horário exato: a última ocorrência antes do início do quarto
  const st2 = new Date(2026, 10, 26, 6, 0).getTime();
  assert.equal(new Date(alarmMs({ at: '05:20' }, st2, 15)).getHours(), 5);
  assert.equal(new Date(alarmMs({ at: '05:20' }, st2, 15)).getMinutes(), 20);
  assert.ok(alarmMs({ at: '23:30' }, st, 15) < st); // 23:30 do dia anterior
  assert.equal(new Date(alarmMs({ at: '23:30' }, st, 15)).getDate(), 25);
});
