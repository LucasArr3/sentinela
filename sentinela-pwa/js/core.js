// Núcleo de regras do Sentinela Tático — funções puras, sem DOM.
export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => {
  const [ya, ma, da] = a.split('-').map(Number); const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 864e5);
};
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WD3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const ymKey = (y, m) => `${y}-${pad(m + 1)}`;
export const fmtBR = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
export const fmtShort = (s) => { const [, m, d] = s.split('-'); return `${d}/${m}`; };
export const weekday = (s) => parse(s).getDay();
export const PRIV = { on: false }; // modo discreto: esconde valores em R$ na tela
export const brl = (v) => (PRIV.on ? 'R$ ••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0));

// ---------- Escalas ----------
export const PRESETS = {
  '24x72': { label: '24x72', work: 1, off: 3, hours: 24, hint: '1 dia de plantão, 3 de folga' },
  '24x48': { label: '24x48', work: 1, off: 2, hours: 24, hint: '1 dia de plantão, 2 de folga' },
  '12x36': { label: '12x36', work: 1, off: 1, hours: 12, hint: 'Plantão dia sim, dia não' },
  '48x96': { label: '48x96', work: 2, off: 4, hours: 24, hint: '2 dias de plantão, 4 de folga' },
  custom: { label: 'Personalizada', work: 1, off: 3, hours: 24, hint: 'Defina você mesmo' },
};
export const defaultScale = (anchor = today()) => ({ preset: '24x72', work: 1, off: 3, hours: 24, start: '07:00', anchor });
export const cycleLen = (sc) => sc.work + sc.off;
export const isScheduled = (date, sc) => {
  const c = cycleLen(sc); const mod = ((diffDays(date, sc.anchor) % c) + c) % c; return mod < sc.work;
};
export const scaleLabel = (sc) => (sc.preset !== 'custom' ? sc.preset : `${sc.work * 24}x${sc.off * 24}`);

// ---------- Eventos ----------
export const TYPES = {
  extra: { label: 'Extra', plural: 'Extras', color: '#F2B33D', icon: 'coins', emoji: '💰', range: false },
  permuta: { label: 'Permuta', plural: 'Permutas', color: '#FF7A59', icon: 'swap', emoji: '🔁', range: false },
  posto: { label: 'Posto do dia', plural: 'Postos do dia', color: '#7aa8cf', icon: 'shield', emoji: '🛡️', range: false },
  quarto: { label: 'Quarto de hora', plural: 'Quartos', color: '#7aa8cf', icon: 'clock', emoji: '⏱️', range: false },
  folga: { label: 'Folga', plural: 'Folgas', color: '#2FC4B2', icon: 'coffee', emoji: '🌙', range: true },
  atestado: { label: 'Atestado médico', plural: 'Atestados', color: '#F0506E', icon: 'medical', emoji: '🏥', range: true },
  ferias: { label: 'Férias', plural: 'Férias', color: '#E879C6', icon: 'umbrella', emoji: '🏖️', range: true },
  marca: { label: 'Marcador', plural: 'Marcadores', color: '#8b8b92', icon: 'target', emoji: '🏷️', range: false },
  obs: { label: 'Observação', plural: 'Observações', color: '#8b8b92', icon: 'note', emoji: '📝', range: false },
  ocorrencia: { label: 'Ocorrência', plural: 'Ocorrências', color: '#c9788a', icon: 'book', emoji: '📒', range: false },
};

// ---------- Quartos de hora e postos ----------
export const DEFAULT_QUARTERS = [
  { id: '18-20', start: '18:00', end: '20:00' }, { id: '20-22', start: '20:00', end: '22:00' }, { id: '22-00', start: '22:00', end: '00:00' },
  { id: '00-02', start: '00:00', end: '02:00' }, { id: '02-04', start: '02:00', end: '04:00' }, { id: '04-06', start: '04:00', end: '06:00' },
  { id: '06-08', start: '06:00', end: '08:00', name: 'Alvorada', alvorada: true, lead: 0, sound: 'clarim' },
];
export const DEFAULT_POSTS = ['Bloco A', 'Bloco B', 'Bloco C', 'G1', 'G2', 'Superior', 'Monitoramento'];
// Durante o dia (antes das 18h) não há quarto de hora: há o posto do dia e, quando o supervisor manda, horários específicos.
export const DEFAULT_DAY_POSTS = ['Bloco A', 'Bloco B', 'Bloco C', 'Superior', 'G1', 'G2', 'Monitoramento', 'Calibre 12', 'Chefe de bloco', 'Hospital'];
export const DEFAULT_NEED_WHERE = ['Calibre 12', 'Chefe de bloco'];
export const OLD_DEFAULT_POSTS = ['Portaria', 'Pavilhão A', 'Pavilhão B', 'Muralha', 'Ronda'];
const hh = (t) => t.replace(':00', '') + 'h';
export const qLabel = (q) => `${q.start}–${q.end}`;
export const qName = (q) => (q.name ? `${q.name} (${qLabel(q)})` : qLabel(q));
// Início real do quarto: horas antes da entrada do plantão pertencem ao dia seguinte.
export function slotDate(date, q, sc) {
  const [h, m] = q.start.split(':').map(Number); const sh = Number(sc.start.split(':')[0]);
  const [y, mo, d] = (h < sh ? addDays(date, 1) : date).split('-').map(Number); return new Date(y, mo - 1, d, h, m);
}
export const slotOrder = (q, sc) => { const h = Number(q.start.slice(0, 2)); return h < Number(sc.start.slice(0, 2)) ? h + 24 : h; };
const evOrder = (state, e) => { const q = state.quarters.find((x) => x.id === e.slot); return q ? slotOrder(q, state.scale) : 99; };
export const quartosOn = (state, date) => state.events.filter((e) => e.type === 'quarto' && e.date === date).sort((a, b) => evOrder(state, a) - evOrder(state, b));
export function nextQuarto(state, now = new Date()) {
  let best = null;
  for (const e of state.events) {
    if (e.type !== 'quarto') continue; const q = state.quarters.find((x) => x.id === e.slot); if (!q) continue;
    const st = slotDate(e.date, q, state.scale); const [eh, em] = q.end.split(':').map(Number);
    const en = new Date(st.getFullYear(), st.getMonth(), st.getDate(), eh, em); if (en <= st) en.setDate(en.getDate() + 1);
    if (en > now && (!best || st < best.start)) best = { ev: e, q, start: st, end: en, active: now >= st };
  }
  return best;
}
// Cores do calendário: mesma luminosidade para tudo combinar
export let EXTRA_D = '#F2B33D';
export let EXTRA_N = '#8B8CF5';
// Cores padrão e personalização (prefs.colors). Chaves: extraD, extraN, permuta, folga, atestado, ferias, quarto
export const DEFAULT_COLORS = { extraD: '#F2B33D', extraN: '#8B8CF5', permuta: '#FF7A59', folga: '#2FC4B2', atestado: '#F0506E', ferias: '#E879C6', quarto: '#7aa8cf', plantao: '' };
export const COLOR_LABELS = { plantao: 'Plantão', extraD: 'Extra diurna', extraN: 'Extra noturna', permuta: 'Permuta', folga: 'Folga', atestado: 'Atestado', ferias: 'Férias', quarto: 'Quarto de hora' };
export function applyColors(custom) {
  const c = { ...DEFAULT_COLORS, ...(custom || {}) }; const ok = (v) => /^#[0-9a-f]{6}$/i.test(v);
  for (const k of Object.keys(DEFAULT_COLORS)) if (!ok(c[k])) c[k] = DEFAULT_COLORS[k];
  STATUS.plantao.color = c.plantao || 'var(--accent)';
  EXTRA_D = c.extraD; EXTRA_N = c.extraN;
  TYPES.extra.color = c.extraD; STATUS.extra.color = c.extraD;
  TYPES.permuta.color = c.permuta; STATUS.permuta_in.color = c.permuta; STATUS.permuta_out.color = c.permuta;
  TYPES.folga.color = c.folga; STATUS.folga.color = c.folga;
  TYPES.atestado.color = c.atestado; STATUS.atestado.color = c.atestado;
  TYPES.ferias.color = c.ferias; STATUS.ferias.color = c.ferias; TYPES.quarto.color = c.quarto; TYPES.posto.color = c.quarto;
}
export const TURNOS = { diurna: 'Extra diurna (12h)', noturna: 'Extra noturna (12h)' };
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const evEnd = (e) => e.end || e.date;
export const covers = (e, date) => date >= e.date && date <= evEnd(e);

export function eventsOn(events, date) {
  return events.filter((e) => covers(e, date)).sort((a, b) => Object.keys(TYPES).indexOf(a.type) - Object.keys(TYPES).indexOf(b.type));
}

// Situação efetiva de um dia considerando escala + eventos.
export function dayInfo(date, state) {
  const sc = state.scale; const evs = eventsOn(state.events, date);
  const scheduled = isScheduled(date, sc);
  const has = (t, f) => evs.some((e) => e.type === t && (!f || f(e)));
  const extra = has('extra');
  let status = 'livre';
  if (scheduled) {
    if (has('atestado')) status = 'atestado';
    else if (has('ferias')) status = 'ferias';
    else if (has('permuta', (e) => e.dir === 'passei')) status = 'permuta_out';
    else if (has('folga')) status = 'folga';
    else status = 'plantao';
  } else {
    if (has('permuta', (e) => e.dir === 'assumi')) status = 'permuta_in';
    else if (extra) status = 'extra';
    else if (has('atestado')) status = 'atestado';
    else if (has('ferias')) status = 'ferias';
    else if (has('folga')) status = 'folga';
  }
  const works = ['plantao', 'permuta_in', 'extra'].includes(status) || (extra && status === 'plantao');
  return { date, scheduled, status, works, events: evs };
}
export const MARK_ICON_DEFAULT = { atestado: 'medical', permuta: 'swap', ferias: 'umbrella', folga: 'coffee', extraD: 'sun', extraN: 'moon', extraH: 'bolt' };
export let MARK_ICONS = { ...MARK_ICON_DEFAULT };
export const ICON_CHOICES = ['medical', 'swap', 'umbrella', 'coffee', 'sun', 'moon', 'bolt', 'coins', 'book', 'users', 'target', 'bell', 'shield', 'clock', 'phone', 'mail', 'calendar', 'note', 'pulse', 'alert', 'check', 'home', 'wallet', 'chat'];
export function applyIcons(custom) { MARK_ICONS = { ...MARK_ICON_DEFAULT, ...(custom || {}) }; for (const k of Object.keys(MARK_ICONS)) if (!ICON_CHOICES.includes(MARK_ICONS[k])) MARK_ICONS[k] = MARK_ICON_DEFAULT[k]; }
/** Situações do dia que viram marcador no canto da célula (o dia de plantão mantém a própria cor). */
export function dayMarks(info, state) {
  const ev = info.events; const out = [];
  if (ev.some((e) => e.type === 'atestado')) out.push({ k: 'atestado', color: TYPES.atestado.color, icon: MARK_ICONS.atestado, label: 'Atestado' });
  if (ev.some((e) => e.type === 'permuta')) out.push({ k: 'permuta', color: TYPES.permuta.color, icon: MARK_ICONS.permuta, label: 'Permuta' });
  if (ev.some((e) => e.type === 'ferias')) out.push({ k: 'ferias', color: TYPES.ferias.color, icon: MARK_ICONS.ferias, label: 'Férias' });
  if (ev.some((e) => e.type === 'folga')) out.push({ k: 'folga', color: TYPES.folga.color, icon: MARK_ICONS.folga, label: 'Folga' });
  const ex = ev.find((e) => e.type === 'extra');
  if (ex) { const n = ex.turno === 'noturna'; out.push({ k: n ? 'extraN' : 'extraD', color: n ? EXTRA_N : EXTRA_D, icon: n ? MARK_ICONS.extraN : (ex.turno === 'h24' ? MARK_ICONS.extraH : MARK_ICONS.extraD), label: n ? 'Extra noturna' : 'Extra diurna' }); }
  const tags = (state && state.tags) || [];
  for (const e of ev) if (e.type === 'marca') { const t = tags.find((x) => x.id === e.tag); if (t && !out.some((o) => o.k === 'tag:' + t.id)) out.push({ k: 'tag:' + t.id, color: t.color, icon: t.icon || 'target', label: t.name }); }
  return out;
}
/** Cor/estado da célula: dia de plantão (ou plantão assumido) fica com a cor de plantão; atestado, férias e folga em dia livre ficam neutros. */
export function cellStatus(info) {
  if (info.scheduled || info.status === 'permuta_in') return 'plantao';
  if (['atestado', 'ferias', 'folga'].includes(info.status)) return 'livre';
  return info.status;
}
export const STATUS = {
  plantao: { label: 'Plantão', color: 'var(--accent)' },
  extra: { label: 'Extra', color: '#F2B33D' },
  permuta_in: { label: 'Assumiu plantão (permuta)', color: '#FF7A59' },
  permuta_out: { label: 'Passou plantão (permuta)', color: '#FF7A59' },
  folga: { label: 'Folga abonada', color: '#2FC4B2' },
  atestado: { label: 'Atestado médico', color: '#F0506E' },
  ferias: { label: 'Férias', color: '#E879C6' },
  livre: { label: 'Folga', color: 'var(--muted)' },
};

export function monthDays(y, m) { return Array.from({ length: daysInMonth(y, m) }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`); }

export function monthSummary(state, y, m) {
  const days = monthDays(y, m).map((d) => dayInfo(d, state));
  const key = ymKey(y, m);
  const extras = state.events.filter((e) => e.type === 'extra' && e.date.startsWith(key)).sort((a, b) => a.date.localeCompare(b.date));
  const total = extras.reduce((s, e) => s + (Number(e.value) || 0), 0);
  const paid = extras.filter((e) => e.paid).reduce((s, e) => s + (Number(e.value) || 0), 0);
  const count = (st) => days.filter((d) => d.status === st).length;
  const permutas = state.events.filter((e) => e.type === 'permuta' && e.date.startsWith(key)).sort((a, b) => a.date.localeCompare(b.date));
  const hoursOf = (d) => (d.status === 'plantao' || d.status === 'permuta_in' ? state.scale.hours : 0)
    + d.events.filter((e) => e.type === 'extra').reduce((s, e) => s + (e.turno === 'h24' ? 24 : 12), 0);
  return {
    days, plantoes: days.filter((d) => d.status === 'plantao'),
    permutaIn: days.filter((d) => d.status === 'permuta_in'), permutaOut: days.filter((d) => d.status === 'permuta_out'),
    extras, extrasTotal: total, extrasPaid: paid, extrasPending: total - paid,
    folgas: days.filter((d) => d.status === 'folga'), atestados: days.filter((d) => d.status === 'atestado'),
    ferias: days.filter((d) => d.status === 'ferias'),
    quartos: state.events.filter((e) => e.type === 'quarto' && e.date.startsWith(key)).sort((a, b) => a.date.localeCompare(b.date) || evOrder(state, a) - evOrder(state, b)),
    permutas, obs: state.events.filter((e) => e.type === 'obs' && e.date.startsWith(key)).sort((a, b) => a.date.localeCompare(b.date)),
    hours: days.reduce((s, d) => s + hoursOf(d), 0),
    workDays: days.filter((d) => d.works),
    count,
  };
}

// Saldo de permutas por colega: positivo = te devem plantões; negativo = você deve.
export function permutaLedger(events) {
  const map = new Map();
  for (const e of events.filter((x) => x.type === 'permuta')) {
    const k = (e.who || 'Colega').trim() || 'Colega';
    const row = map.get(k) || { who: k, net: 0, open: [] };
    if (!e.settled) { row.net += e.dir === 'passei' ? 1 : -1; row.open.push(e); }
    map.set(k, row);
  }
  return [...map.values()].filter((r) => r.open.length).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export function nextWorkDay(state, from = today(), includeFrom = true, limit = 400) {
  for (let i = includeFrom ? 0 : 1; i < limit; i++) { const d = addDays(from, i); const info = dayInfo(d, state); if (info.works) return info; }
  return null;
}
export function upcoming(state, n = 5, from = today()) {
  const out = []; let d = from;
  for (let i = 0; i < 400 && out.length < n; i++, d = addDays(d, 1)) { const info = dayInfo(d, state); if (info.works) out.push(info); }
  return out;
}

// Está em serviço agora? Considera plantões que viram a noite (ex.: 07h → 07h).
export function dutyNow(state, now = new Date()) {
  const [h, mi] = state.scale.start.split(':').map(Number);
  for (const off of [0, -1]) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h, mi, 0);
    const day = iso(base);
    const info = dayInfo(day, state);
    const isShift = info.status === 'plantao' || info.status === 'permuta_in';
    const hasExtra = info.events.some((e) => e.type === 'extra');
    if (!(isShift || hasExtra)) continue;
    const hrs = isShift ? state.scale.hours : (info.events.find((e) => e.type === 'extra')?.turno === 'h24' ? 24 : 12);
    const end = new Date(base.getTime() + hrs * 3600e3);
    if (now >= base && now < end) return { on: true, start: base, end, info };
  }
  return { on: false };
}

export function relDays(date, ref = today()) {
  const n = diffDays(date, ref);
  if (n === 0) return 'hoje'; if (n === 1) return 'amanhã'; if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}
export const dateLong = (s) => { const d = parse(s); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`; };

// Próximo plantão que ainda não terminou (inclui o de hoje se ainda não acabou).
export function nextShift(state, now = new Date()) {
  const [h, mi] = state.scale.start.split(':').map(Number);
  for (let i = -1; i < 400; i++) {
    const day = addDays(iso(now), i); const info = dayInfo(day, state);
    if (!info.works) continue;
    const [y, m, d] = day.split('-').map(Number);
    const start = new Date(y, m - 1, d, h, mi); const hrs = info.status === 'extra' ? (info.events.find((e) => e.type === 'extra')?.turno === 'h24' ? 24 : 12) : state.scale.hours;
    const end = new Date(start.getTime() + hrs * 3600e3);
    if (end > now) return { info, start, end, started: now >= start };
  }
  return null;
}
export const evDays = (e) => diffDays(evEnd(e), e.date) + 1;

// ---------- Feriados (Brasil) ----------
export const OC_PRIO = ['Normal', 'Atenção', 'Urgente'];
export const OC_TPL = [{ t: 'Sem alteração', cat: 'Rotina' }, { t: 'Revista de rotina', cat: 'Segurança' }, { t: 'Contagem de presos', cat: 'Rotina' }, { t: 'Atendimento médico', cat: 'Saúde' }, { t: 'Visita', cat: 'Visita' }, { t: 'Ocorrência disciplinar', cat: 'Disciplinar' }];
export const OC_CATS = ['Rotina', 'Segurança', 'Disciplinar', 'Saúde', 'Visita', 'Outros'];
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return `${y}-${pad(mo)}-${pad(da)}`;
}
const holCache = new Map();
// custom: [{ md: 'MM-DD', name }] — feriados estaduais/municipais que se repetem todo ano
export function holidaysOf(y, custom = []) {
  const key = y + JSON.stringify(custom); if (holCache.has(key)) return holCache.get(key);
  const E = easter(y); const m = {};
  const fixed = { '01-01': 'Confraternização Universal', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '09-07': 'Independência', '10-12': 'N. Sra. Aparecida', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal' };
  for (const [md, n] of Object.entries(fixed)) m[`${y}-${md}`] = n;
  m[addDays(E, -48)] = 'Carnaval'; m[addDays(E, -47)] = 'Carnaval'; m[addDays(E, -2)] = 'Sexta-feira Santa'; m[E] = 'Páscoa'; m[addDays(E, 60)] = 'Corpus Christi';
  for (const c of custom) if (c && /^\d{2}-\d{2}$/.test(c.md) && c.name) m[`${y}-${c.md}`] = c.name;
  holCache.set(key, m); return m;
}
export const holidayName = (date, custom = []) => holidaysOf(Number(date.slice(0, 4)), custom)[date] || '';
export function monthHolidays(y, m, custom = []) {
  const h = holidaysOf(y, custom); const key = ymKey(y, m);
  return Object.entries(h).filter(([d]) => d.startsWith(key)).sort(([a], [b]) => a.localeCompare(b)).map(([date, name]) => ({ date, name }));
}
