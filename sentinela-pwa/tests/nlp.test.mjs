import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand, parseDate } from '../js/nlp.js';
const REF = '2026-11-23'; // segunda-feira
test('datas', () => {
  assert.equal(parseDate('amanhã', REF), '2026-11-24');
  assert.equal(parseDate('depois de amanhã', REF), '2026-11-25');
  assert.equal(parseDate('dia 5', REF), '2026-11-05');
  assert.equal(parseDate('12/12', REF), '2026-12-12');
  assert.equal(parseDate('3 de dezembro', REF), '2026-12-03');
  assert.equal(parseDate('sexta', REF), '2026-11-27');
  assert.equal(parseDate('próxima segunda', REF), '2026-11-30');
});
test('extra com valor e turno', () => {
  const r = parseCommand('Adiciona uma extra noturna dia 30 valor 250,50', REF);
  assert.equal(r.kind, 'create'); assert.equal(r.event.type, 'extra'); assert.equal(r.event.turno, 'noturna');
  assert.equal(r.event.date, '2026-11-30'); assert.equal(r.event.value, 250.5);
});
test('permuta com colega', () => {
  const r = parseCommand('permuta com o João dia 27 passei meu plantão', REF);
  assert.equal(r.event.type, 'permuta'); assert.equal(r.event.dir, 'passei'); assert.equal(r.event.who, 'João'); assert.equal(r.event.date, '2026-11-27');
  const a = parseCommand('assumi o plantão da maria amanhã', REF);
  assert.equal(a.event.dir, 'assumi'); assert.equal(a.event.who, 'Maria'); assert.equal(a.event.date, '2026-11-24');
});
test('atestado por dias e folga', () => {
  const r = parseCommand('atestado médico de 3 dias a partir de amanhã', REF);
  assert.equal(r.event.type, 'atestado'); assert.equal(r.event.date, '2026-11-24'); assert.equal(r.event.end, '2026-11-26');
  const f = parseCommand('marca folga dia 20 de dezembro', REF);
  assert.equal(f.event.type, 'folga'); assert.equal(f.event.date, '2026-12-20');
});
test('consultas e navegação', () => {
  assert.equal(parseCommand('quando é meu próximo plantão?', REF).q, 'next');
  assert.equal(parseCommand('quanto vou receber de extras esse mês', REF).q, 'extras');
  assert.equal(parseCommand('estou de plantão hoje?', REF).q, 'today');
  assert.equal(parseCommand('gerar resumo para o whatsapp', REF).kind, 'nav');
  assert.equal(parseCommand('banana', REF).kind, 'unknown');
});
