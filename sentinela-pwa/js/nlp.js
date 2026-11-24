// Interpretador de comandos em português (voz ou texto). 100% local/offline.
import { today, addDays, parse, iso, diffDays, pad, MONTHS, weekday } from './core.js';

export const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9$,.:/\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const MES = MONTHS.map((m) => norm(m));
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, vinte: 20, trinta: 30 };
const numWords = (t) => t.replace(/\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|vinte|trinta)\b/g, (w) => NUM[w]);

export function parseDate(raw, ref = today()) {
  const t = numWords(norm(raw)); let m;
  if (/\bdepois de amanha\b/.test(t)) return addDays(ref, 2);
  if (/\bamanha\b/.test(t)) return addDays(ref, 1);
  if (/\bontem\b/.test(t)) return addDays(ref, -1);
  if (/\bhoje\b/.test(t)) return ref;
  const [ry, rm] = ref.split('-').map(Number);
  if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    let y = m[3] ? Number(m[3]) : ry; if (y < 100) y += 2000;
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  if ((m = t.match(/\b(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?: de (\d{4}))?/))) {
    const mi = MES.indexOf(m[2]); let y = m[3] ? +m[3] : ry;
    let d = `${y}-${pad(mi + 1)}-${pad(+m[1])}`; if (!m[3] && d < ref) d = `${y + 1}-${pad(mi + 1)}-${pad(+m[1])}`; return d;
  }
  if ((m = t.match(/\bdia (\d{1,2})\b/))) {
    const day = +m[1]; let d = `${ry}-${pad(rm)}-${pad(day)}`;
    return d;
  }
  for (let i = 0; i < 7; i++) {
    const re = new RegExp(`\\b(proxima |proximo |na |no |essa |esta )?${DIAS[i]}( feira)?\\b`);
    if ((m = t.match(re))) {
      let delta = (i - weekday(ref) + 7) % 7; if (delta === 0 && !/^(esta|essa|na|no)/.test(m[1] || '')) delta = 7; if (delta === 0 && m[1] && /proxim/.test(m[1])) delta = 7;
      return addDays(ref, delta);
    }
  }
  return null;
}

const STOP = new Set(['dia', 'hoje', 'amanha', 'ontem', 'no', 'na', 'em', 'para', 'por', 'de', 'do', 'da', 'e', 'que', 'ate', 'a', 'o', 'as', 'os', 'com', 'meu', 'minha', 'plantao', 'valor', 'reais', 'real', 'extra', 'folga', 'sabado', 'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'proxima', 'proximo', 'diurna', 'noturna', 'dias', 'devolver', 'devolvo', 'devolve', 'e', 'pra']);
const titleCase = (s) => s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

function findPerson(raw) {
  const words = raw.replace(/[,.!?]/g, ' ').split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = norm(words[i]);
    if (['com', 'do', 'da', 'pro', 'pra', 'para'].includes(w)) {
      let j = i + 1; if (['o', 'a'].includes(norm(words[j] || ''))) j++;
      const name = [];
      while (j < words.length && name.length < 2) {
        const n = norm(words[j]); if (!n || STOP.has(n) || /\d/.test(n)) break; name.push(words[j]); j++;
      }
      if (name.length && !/^(minha|meu)$/.test(norm(name[0]))) return titleCase(name.join(' '));
    }
  }
  return null;
}

export function parseCommand(input, ref = today(), ctx = { quarters: [], posts: [] }) {
  const raw = input.trim(); const t = numWords(norm(raw));
  if (!raw) return { kind: 'empty' };
  const has = (...r) => r.some((x) => new RegExp(x).test(t));

  // ---- Consultas ----
  if (has('\\b(gera|gerar|monta|montar|manda|mandar|envia|enviar|cria|criar|faz|fazer)\\b.*\\b(resumo|whats|zap|relatorio)\\b', '^(resumo|whats)')) return { kind: 'nav', to: 'resumos', text: 'Abrindo o gerador de resumos para WhatsApp.' };
  if (has('\\b(quando|qual|que dia)\\b.*\\bproximo (plantao|extra)', 'proximo plantao', 'proxima escala')) return { kind: 'query', q: 'next' };
  if (has('(estou|to|tou) de plantao', 'plantao hoje', 'trabalho hoje', 'tenho plantao hoje')) return { kind: 'query', q: 'today' };
  if (has('\\b(quanto|total|valor)\\b.*\\bextra', 'extras? (do|desse|deste|esse|este) mes', 'quanto (vou )?(receb|ganh)')) return { kind: 'query', q: 'extras', date: parseDate(raw, ref) };
  if (has('\\bsaldo\\b.*\\bpermut', 'quem (me )?deve', 'quanto devo', 'permutas? (abertas|pendentes)', 'devo plantao')) return { kind: 'query', q: 'permutas' };
  if (has('quantos?\\b.*\\bplant', 'plantoes (do|desse|deste|esse|este) mes')) return { kind: 'query', q: 'count', date: parseDate(raw, ref) };
  if (has('quantos?\\b.*\\b(atestado|dias de atestado)')) return { kind: 'query', q: 'atestados' };

  // ---- Quartos de hora ----
  if (has('\\bquartos?\\b') && ctx.quarters.length) {
    if (has('\\bproximo quarto', 'qual (e )?(o )?meu quarto', 'meus quartos (de )?hoje', 'quarto (de hoje|agora)')) return { kind: 'query', q: 'nextq' };
    const ids = [];
    if (has('todos os quartos', 'quartos todos')) ids.push(...ctx.quarters.filter((q) => !q.alvorada).map((q) => q.id));
    for (const m of t.matchAll(/(\d{1,2})\s*(?:h|horas?|:00)?\s*(?:as|a|ate|-)\s*(\d{1,2})/g)) {
      const h1 = Number(m[1]) % 24, h2 = Number(m[2]) % 24;
      const cand = ctx.quarters.filter((q) => Number(q.start.slice(0, 2)) === h1); const q = cand.find((x) => Number(x.end.slice(0, 2)) === h2) || cand[0]; if (q && !ids.includes(q.id)) ids.push(q.id);
    }
    if (has('alvorada')) { const a = ctx.quarters.find((q) => q.alvorada); if (a && !ids.includes(a.id)) ids.push(a.id); }
    const post = ctx.posts.find((p) => t.includes(norm(p))) || '';
    return ids.length ? { kind: 'quartos', date: parseDate(raw, ref) || ref, ids, post } : { kind: 'help', text: 'Quais quartos? Diga, por exemplo: “quartos 22 às 00 e 02 às 04 dia 27 no bloco A”.' };
  }

  // ---- Criação ----
  let type = null;
  if (has('atestado', 'afastament', 'licenca medica', 'medico')) type = 'atestado';
  else if (has('permut', '\\btroc', 'passei', 'passar (o )?(meu )?plantao', 'assumi', 'assumir', 'cobri', 'cobrir', 'peguei (o )?plantao', 'cedi')) type = 'permuta';
  else if (has('ferias')) type = 'ferias';
  else if (has('\\bextra', 'hora extra', 'diaria')) type = 'extra';
  else if (has('folga', 'folgar', 'compens', 'abono')) type = 'folga';
  else if (has('^(anota|anotar|lembrete|lembrar|observacao|nota)\\b', '\\b(anota|anotar|lembra|observacao)\\b')) type = 'obs';
  if (!type) return { kind: 'unknown' };

  let date = parseDate(raw, ref);
  // "dia N" já caído no mês corrente pode ter passado -> mantém (usuário pode registrar passado)
  if (!date) date = ref;
  const ev = { id: undefined, type, date };
  const value = (t.match(/(?:r\$\s*|valor (?:de )?|por )(\d+(?:[.,]\d{1,2})?)(?!\s*dias?)/) || t.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|conto)/));
  if (value) ev.value = Number(value[1].replace(',', '.'));
  const dur = t.match(/(\d{1,3})\s*dias?\b/);

  if (type === 'extra') {
    ev.turno = has('noturn', 'noite') ? 'noturna' : has('24 ?h', '24 horas', 'vinte e quatro', 'dia inteiro') ? 'h24' : 'diurna';
  }
  if (type === 'permuta') {
    ev.dir = has('assumi', 'assumir', 'cobri', 'cobrir', 'peguei', 'fiquei no lugar', 'no lugar d') ? 'assumi' : 'passei';
    ev.who = findPerson(raw) || '';
    const ret = t.match(/devol\w* (?:dia |em )?(.+)$/); if (ret) { const rd = parseDate(ret[1], ref); if (rd) ev.returnDate = rd; }
  }
  if ((type === 'atestado' || type === 'folga' || type === 'ferias') && dur) {
    const n = Math.min(Math.max(+dur[1], 1), 365); if (n > 1) ev.end = addDays(date, n - 1);
  }
  const range = t.match(/\bde (.+?) ate (?:dia )?(.+)$/);
  if (range && ['atestado', 'folga', 'ferias'].includes(type)) { const a = parseDate(range[1], ref), b = parseDate(range[2], ref); if (a && b && b >= a) { ev.date = a; ev.end = b; } }
  if (type === 'folga') ev.reason = has('compens') ? 'Compensação' : has('banco') ? 'Banco de horas' : has('abono') ? 'Abono' : '';
  if (type === 'obs') ev.note = raw.replace(/^(anota|anotar|lembrete|observacao|nota)[:,]?\s*/i, '');
  else if (!ev.note) ev.note = '';
  return { kind: 'create', event: ev };
}
