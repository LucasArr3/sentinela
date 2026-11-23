import * as C from './core.js';
import { Store, defaultData } from './store.js';
import { ic, esc, $, $$, toast, initials, fmtDur, greet, waHtml } from './ui.js';
import { buildSummary, waLink } from './summary.js';
import { createAssistant } from './ai.js';
import { hasAI, readRoster, compressImage, callLLM, DEFAULT_MODELS } from './vision.js';
import { startReminders, siren, notify, askNotifyPermission } from './reminders.js';

const nowD = new Date();
const S = { uid: null, user: null, d: null, view: 'dashboard', cal: { y: nowD.getFullYear(), m: nowD.getMonth() }, fin: { y: nowD.getFullYear(), m: nowD.getMonth() }, sum: { y: nowD.getFullYear(), m: nowD.getMonth(), values: true, notes: true, calendar: true, custom: null }, sheet: null, qv: { y: nowD.getFullYear(), m: nowD.getMonth() }, liv: { y: nowD.getFullYear(), m: nowD.getMonth() }, roster: null, auth: { tab: 'login', err: '' }, ob: { step: 0, today: true }, draft: null };
const ACCENTS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];
const VIEWS = { dashboard: ['Início', 'home'], calendar: ['Calendário', 'calendar'], quartos: ['Quartos', 'clock'], finance: ['Finanças', 'wallet'], summary: ['Resumos', 'chat'], livro: ['Ocorrências', 'alert'], more: ['Mais', 'menu'], settings: ['Ajustes', 'settings'] };
const save = () => { if (S.uid && !Store.save(S.uid, S.d)) toast('Não foi possível salvar (armazenamento cheio?)', 'err'); };
const typeColor = (t) => C.TYPES[t].color;
const tint = (c, p = 18) => `color-mix(in srgb,${c} ${p}%,transparent)`;

function applyTheme() {
  const p = S.d?.prefs || { theme: 'dark', accent: ACCENTS[0] }; let th = p.theme;
  if (th === 'auto') th = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = th; document.documentElement.style.setProperty('--accent', p.accent);
  $('meta[name=theme-color]')?.setAttribute('content', th === 'light' ? '#eef2f8' : '#060a12');
}

// ---------- títulos de eventos ----------
export function evTitle(e) {
  const n = C.evDays(e);
  switch (e.type) {
    case 'extra': return `${C.TURNOS[e.turno] || 'Extra'}${e.value != null ? ' · ' + C.brl(e.value) : ''}`;
    case 'permuta': return `${e.dir === 'passei' ? 'Passei plantão para' : 'Assumi plantão de'} ${e.who || 'colega'}`;
    case 'folga': return `Folga${n > 1 ? ` · ${n} dias` : ''}${e.reason ? ' · ' + e.reason : ''}`;
    case 'atestado': return `Atestado médico · ${n} dia${n > 1 ? 's' : ''}`;
    case 'ferias': return `Férias · ${n} dias`;
    case 'quarto': { const q = S.d.quarters.find((x) => x.id === e.slot); return `${q ? C.qLabel(q) : e.slot}${e.post ? ' · ' + e.post : ''}`; }
    case 'ocorrencia': return `${e.time ? e.time + ' · ' : ''}${e.title || 'Ocorrência'}`;
    default: return (e.note || 'Observação').slice(0, 60);
  }
}
const evSub = (e) => {
  const bits = [];
  if (e.type === 'extra') bits.push(e.paid ? '✅ Recebida' : '⏳ A receber');
  if (e.type === 'permuta') { bits.push(e.settled ? '✅ Quitada' : '⏳ Em aberto'); if (e.returnDate) bits.push(`devolução ${C.fmtShort(e.returnDate)}`); }
  if (e.type === 'atestado' && e.cid) bits.push(`CID ${e.cid}`);
  if (e.end) bits.push(`${C.fmtShort(e.date)} → ${C.fmtShort(e.end)}`);
  if (e.note && e.type !== 'obs') bits.push(e.note);
  return bits.join(' · ');
};
const evRow = (e, actions = true) => `<div class="item"><div class="ico" style="background:${tint(typeColor(e.type))};color:${typeColor(e.type)}">${ic(C.TYPES[e.type].icon)}</div><div class="sp" style="min-width:0"><div class="t">${esc(evTitle(e))}</div>${evSub(e) ? `<div class="s">${esc(evSub(e))}</div>` : ''}${e.type === 'obs' && e.note.length > 60 ? `<div class="s">${esc(e.note)}</div>` : ''}</div>${e.photo ? `<img class="thumb" src="${e.photo}" alt="">` : ''}${actions ? `<button class="ibtn" data-act="ev-edit" data-id="${e.id}" aria-label="Editar">${ic('edit')}</button>` : ''}</div>`;

// ---------- AUTH / ONBOARDING ----------
const authView = () => {
  const a = S.auth; const reg = a.tab === 'register';
  return `<div class="auth"><div class="pitch"><div class="brand"><div class="logo">${ic('shield')}</div>Sentinela Tático</div>
  <h1>Sua escala de plantão,<br><span style="color:var(--accent)">sob controle.</span></h1><p>Calendário tático para Policiais Penais: escala 24x72 pronta, extras, permutas, folgas, atestados e resumos para o WhatsApp — com assistente de voz.</p>
  <div class="feat"><div><i>${ic('calendar')}</i>Escala 24x72 (e outras) já configurada</div><div><i>${ic('wallet')}</i>Controle de extras e valores a receber</div><div><i>${ic('swap')}</i>Permutas com saldo por colega</div><div><i>${ic('mic')}</i>Comandos por voz com IA</div><div><i>${ic('chat')}</i>Resumo do mês pronto para o WhatsApp</div></div></div>
  <div class="card authcard"><div class="seg" style="margin-bottom:18px"><button class="${reg ? '' : 'on'}" data-act="auth-tab" data-v="login">Entrar</button><button class="${reg ? 'on' : ''}" data-act="auth-tab" data-v="register">Criar conta</button></div>
  <form class="col" data-submit="${reg ? 'register' : 'login'}" autocomplete="on">
   ${reg ? `<label class="f">Nome completo<input name="name" required autocomplete="name" placeholder="Seu nome"></label>` : ''}
   <label class="f">E-mail<input name="email" type="email" required autocomplete="email" placeholder="voce@email.com"></label>
   <label class="f">Senha<input name="password" type="password" required minlength="${reg ? 6 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'Mínimo 6 caracteres' : 'Sua senha'}"></label>
   ${reg ? `<label class="f">Confirmar senha<input name="password2" type="password" required autocomplete="new-password"></label>` : ''}
   <label class="tgl"><span class="sm">Manter conectado neste aparelho</span><input type="checkbox" name="remember" checked></label>
   ${a.err ? `<div class="err">${esc(a.err)}</div>` : ''}
   <button class="btn pri blk" type="submit">${reg ? 'Criar conta e configurar' : 'Entrar'}</button></form>
  <div class="row" style="margin:16px 0;color:var(--muted)"><hr class="sp" style="border:0;border-top:1px solid var(--line)"><span class="xs">ou</span><hr class="sp" style="border:0;border-top:1px solid var(--line)"></div>
  <button class="btn blk" data-act="guest">${ic('target')}Entrar sem cadastro (já configurado em 24x72)</button>
  <p class="muted xs" style="margin:14px 0 0;text-align:center">Seus dados ficam salvos <b>somente neste aparelho</b>. Use Ajustes → Backup para levar para outro celular.</p></div></div>`;
};

const OB_TITLES = ['Seu perfil', 'Sua escala', 'Valores das extras', 'Tudo pronto'];
function onboardView() {
  const d = S.d, st = S.ob.step; const sc = d.scale;
  const steps = `<div class="ob-steps">${OB_TITLES.map((_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (st === 0) body = `<h2>Bem-vindo, policial 👮</h2><p class="muted">Vamos deixar tudo pronto em menos de um minuto.</p>
   <label class="f">Nome<input data-bind="profile.name" value="${esc(d.profile.name)}" placeholder="Como quer ser chamado"></label>
   <label class="f">Cargo<input data-bind="profile.rank" value="${esc(d.profile.rank)}"></label>
   <label class="f">Como seu nome aparece nas escalas de quartos<input data-bind="profile.alias" value="${esc(d.profile.alias)}" placeholder="Ex.: Lucas, PP Silva (separe por vírgula)"></label>
   <div class="grid2"><label class="f">Matrícula (opcional)<input data-bind="profile.matricula" value="${esc(d.profile.matricula)}"></label><label class="f">Unidade (opcional)<input data-bind="profile.unit" value="${esc(d.profile.unit)}" placeholder="Ex.: Penitenciária X"></label></div>`;
  if (st === 1) body = `<h2>Qual é a sua escala?</h2>${scaleEditor(true)}`;
  if (st === 2) body = `<h2>Quanto vale sua extra?</h2><p class="muted">Usado para calcular o que você tem a receber. Você pode alterar a qualquer momento — e ajustar o valor de cada extra individualmente.</p>${moneyFields()}`;
  if (st === 3) { const up = C.upcoming(d, 4); body = `<h2>Pronto, ${esc(d.profile.name.split(' ')[0] || 'policial')}! ✅</h2><p class="muted">Sua escala ${C.scaleLabel(sc)} está configurada.</p><div class="list">${up.map((x) => `<div class="item"><div class="ico" style="background:${tint('var(--accent)', 22)};color:var(--accent)">${ic('shield')}</div><div class="sp"><div class="t">${C.dateLong(x.date)}</div><div class="s">${C.relDays(x.date)} · início ${sc.start}</div></div></div>`).join('')}</div>`; }
  return `<div class="auth" style="max-width:560px"><div class="col"><div class="brand"><div class="logo">${ic('shield')}</div>Sentinela Tático</div><div class="card authcard">${steps}<div class="col">${body}</div>
   <div class="row" style="margin-top:20px">${st > 0 ? `<button class="btn" data-act="ob-back">Voltar</button>` : ''}<span class="sp"></span><button class="btn pri" data-act="ob-next">${st === 3 ? 'Ir para o painel' : 'Continuar'}${ic('chevR')}</button></div></div></div></div>`;
}
function scaleEditor(onboarding = false) {
  const sc = S.d.scale; const custom = sc.preset === 'custom';
  const next = C.upcoming(S.d, 5);
  return `<div class="chips">${Object.entries(C.PRESETS).map(([k, p]) => `<button class="chip ${sc.preset === k ? 'on' : ''}" data-act="preset" data-v="${k}">${p.label}</button>`).join('')}</div>
  <p class="muted sm" style="margin:0">${C.PRESETS[sc.preset].hint}</p>
  ${custom ? `<div class="grid3"><label class="f">Dias de plantão<input type="number" min="1" max="7" data-bind="scale.work" data-num value="${sc.work}"></label><label class="f">Dias de folga<input type="number" min="1" max="30" data-bind="scale.off" data-num value="${sc.off}"></label><label class="f">Horas/dia<input type="number" min="1" max="24" data-bind="scale.hours" data-num value="${sc.hours}"></label></div>` : ''}
  <label class="f">Horário de entrada<input type="time" data-bind="scale.start" value="${sc.start}"></label>
  ${onboarding ? `<div class="card" style="padding:12px"><div class="b" style="margin-bottom:8px">Você está de plantão hoje?</div><div class="seg"><button class="${S.ob.today ? 'on' : ''}" data-act="ob-today" data-v="1">Sim, hoje é plantão</button><button class="${S.ob.today ? '' : 'on'}" data-act="ob-today" data-v="0">Não</button></div>${S.ob.today ? '' : `<label class="f" style="margin-top:10px">Data de um plantão (último ou próximo)<input type="date" data-bind="scale.anchor" value="${sc.anchor}"></label>`}</div>`
    : `<label class="f">Data de um plantão (passado ou futuro)<input type="date" data-bind="scale.anchor" value="${sc.anchor}"></label><button class="btn sm" data-act="anchor-today">${ic('target')}Hoje estou de plantão</button>`}
  <div><div class="h2" style="margin:0 0 8px">Próximos plantões calculados</div><div class="chips">${next.map((x) => `<span class="chip on">${C.WD3[C.weekday(x.date)]} ${C.fmtShort(x.date)}</span>`).join('')}</div></div>`;
}
const moneyFields = () => `<div class="grid3"><label class="f">Diurna 12h<input type="number" step="0.01" min="0" inputmode="decimal" data-bind="money.diurna" data-num value="${S.d.money.diurna}"></label><label class="f">Noturna 12h<input type="number" step="0.01" min="0" inputmode="decimal" data-bind="money.noturna" data-num value="${S.d.money.noturna}"></label><label class="f">24h<input type="number" step="0.01" min="0" inputmode="decimal" data-bind="money.h24" data-num value="${S.d.money.h24}"></label></div>`;

// ---------- SHELL ----------
function shell() {
  const [title] = VIEWS[S.view]; const p = S.d.profile; const moreSet = ['more', 'finance', 'summary', 'livro', 'settings'];
  const nav = (k) => `<button class="nav ${S.view === k ? 'on' : ''}" data-act="go" data-v="${k}">${ic(VIEWS[k][1])}${VIEWS[k][0]}</button>`;
  const tab = (k, on = S.view === k) => `<button class="tab ${on ? 'on' : ''}" data-act="go" data-v="${k}">${ic(VIEWS[k][1])}${VIEWS[k][0]}</button>`;
  return `<div class="shell"><aside class="side"><div class="brand" style="margin:4px 8px 22px"><div class="logo">${ic('shield')}</div>Sentinela</div>${['dashboard', 'calendar', 'quartos', 'finance', 'summary', 'livro'].map(nav).join('')}<button class="nav" data-act="ai">${ic('sparkles')}Assistente IA</button><span class="sp"></span>${nav('settings')}
   <div class="item" style="margin-top:8px"><div class="avatar" style="width:38px;height:38px;border-radius:12px;font-size:13px">${esc(initials(p.name))}</div><div class="sp" style="min-width:0"><div class="t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name || 'Policial')}</div><div class="s">${C.scaleLabel(S.d.scale)}</div></div><button class="ibtn" style="width:34px;height:34px" data-act="logout" title="Sair">${ic('logout')}</button></div></aside>
   <main class="main"><header class="top"><div class="sp"><div class="muted sm">${S.view === 'dashboard' ? greet() + ',' : 'Sentinela Tático'}</div><h1>${S.view === 'dashboard' ? esc((p.name || 'Policial').split(' ')[0]) : title}</h1></div><button class="avatar" data-act="go" data-v="settings" aria-label="Ajustes">${esc(initials(p.name))}</button></header><section class="view" id="view"></section></main></div>
   <nav class="tabbar" aria-label="Navegação">${tab('dashboard')}${tab('calendar')}<button class="fab" data-act="ai" aria-label="Assistente IA">${ic('sparkles')}</button>${tab('quartos')}${tab('more', moreSet.includes(S.view))}</nav><button class="fab desk" data-act="ai" aria-label="Assistente IA">${ic('sparkles')}</button>`;
}

// ---------- DASHBOARD ----------
function dashboard() {
  const d = S.d, now = new Date(), t = C.today(); const sc = d.scale; const ms = C.monthSummary(d, now.getFullYear(), now.getMonth());
  const du = C.dutyNow(d, now); const info = C.dayInfo(t, d); const ns = C.nextShift(d, now);
  let pill, h, sub = '', extra = '';
  if (du.on) {
    const pct = Math.min(100, ((now - du.start) / (du.end - du.start)) * 100); const sameDay = C.iso(du.end) === t;
    pill = 'EM SERVIÇO'; h = 'Você está de plantão'; sub = `Termina ${sameDay ? 'hoje' : 'amanhã'} às ${String(du.end.getHours()).padStart(2, '0')}:${String(du.end.getMinutes()).padStart(2, '0')} · faltam ${fmtDur(du.end - now)}`;
    extra = `<div class="bar"><i style="width:${pct}%"></i></div><div class="row xs muted"><span>Início ${sc.start}</span><span class="sp"></span><span>${Math.round(pct)}% cumprido</span></div>`;
  } else if (ns && !ns.started && ns.info.date === t) {
    pill = 'PLANTÃO HOJE'; h = `Entrada às ${sc.start}`; sub = `Começa em ${fmtDur(ns.start - now)}`;
  } else {
    const label = { livre: 'De folga', folga: 'Folga abonada', atestado: 'Afastado (atestado)', ferias: 'De férias', permuta_out: 'Plantão repassado', plantao: 'De folga', extra: 'De folga', permuta_in: 'De folga' }[info.status];
    pill = info.status === 'livre' ? 'FOLGA' : C.STATUS[info.status].label.toUpperCase(); h = label;
    sub = ns ? `Próximo plantão: ${C.dateLong(ns.info.date)} — ${C.relDays(ns.info.date)}` : 'Sem plantões futuros calculados';
    if (ns) extra = `<div class="muted xs" style="margin-top:8px">Entrada às ${sc.start} · faltam ${fmtDur(ns.start - now)}</div>`;
  }
  const c = C.cycleLen(sc); const pos = ((C.diffDays(t, sc.anchor) % c) + c) % c;
  const cyc = `<div class="cycle">${Array.from({ length: c }, (_, i) => `<div class="${i < sc.work ? 'w' : ''} ${i === pos ? 'cur' : ''}">${i < sc.work ? 'P' : 'F'}<br><span style="font-weight:600;opacity:.7">${i + 1}</span></div>`).join('')}</div><div class="muted xs" style="margin-top:6px">Ciclo ${C.scaleLabel(sc)} · hoje é o dia ${pos + 1} de ${c}</div>`;
  const quick = ['extra', 'permuta', 'folga', 'atestado'].map((k) => `<button class="qa" data-act="ev-new" data-t="${k}" data-date="${t}"><i style="background:${tint(typeColor(k), 20)};color:${typeColor(k)}">${ic(C.TYPES[k].icon)}</i>${C.TYPES[k].label.replace(' médico', '')}</button>`).join('') + `<button class="qa" data-act="roster-open" data-date="${t}"><i style="background:${tint('#38bdf8', 20)};color:#38bdf8">${ic('camera')}</i>Foto</button>`;
  const qDate = du.on ? C.iso(du.start) : (ns ? ns.info.date : t); const nq = C.nextQuarto(d, now);
  const qCard = `<div class="card col" style="gap:12px"><div class="row"><div class="sp"><div class="b">Quartos de hora</div><div class="muted xs">${C.dateLong(qDate)}${nq ? ` · próximo ${C.qLabel(nq.q)}${nq.ev.post ? ' — ' + esc(nq.ev.post) : ''} ${nq.active ? '(agora)' : 'em ' + fmtDur(nq.start - now)}` : ''}</div></div>${qTools(qDate, true)}</div>${postBar()}${qGrid(qDate)}</div>`;
  const up = C.upcoming(d, 3, t).filter((x) => !(du.on && x.date === C.iso(du.start) && false));
  const led = C.permutaLedger(d.events); const pend = d.events.filter((e) => e.type === 'extra' && !e.paid);
  const pendTotal = pend.reduce((s, e) => s + (Number(e.value) || 0), 0);
  return `<div class="hero ${du.on ? 'on' : ''}"><span class="pill"><span class="dot"></span>${pill}</span><h2>${h}</h2><div class="muted">${sub}</div>${extra}${cyc}</div>
  <div class="quick">${quick}</div>
  ${qCard}
  <div class="card row" style="justify-content:space-around;text-align:center"><div><div class="b">${ms.plantoes.length + ms.permutaIn.length}</div><div class="muted xs">plantões</div></div><div><div class="b">${C.brl(ms.extrasTotal)}</div><div class="muted xs">extras</div></div><div><div class="b">${ms.quartos.length}</div><div class="muted xs">quartos</div></div><div><div class="b">${ms.permutas.length}</div><div class="muted xs">permutas</div></div></div>
  <div class="h2">Próximos plantões</div><div class="list">${up.map((x) => `<button class="item" data-act="day" data-date="${x.date}"><div class="ico" style="background:${tint(C.STATUS[x.status].color, 20)};color:${C.STATUS[x.status].color}">${ic(x.status === 'extra' ? 'bolt' : 'shield')}</div><div class="sp"><div class="t">${C.dateLong(x.date)}</div><div class="s">${C.relDays(x.date)} · ${C.STATUS[x.status].label}</div></div>${ic('chevR')}</button>`).join('')}</div>
  ${led.length || pend.length ? `<div class="h2">Pendências</div><div class="card col" style="gap:8px">${pend.length ? `<div class="row"><div class="ico" style="width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:${tint('#22c55e', 20)};color:#22c55e">${ic('wallet')}</div><div class="sp"><div class="b">${C.brl(pendTotal)} a receber</div><div class="s muted sm">${pend.length} extra(s) não marcada(s) como recebida(s)</div></div></div>` : ''}${led.map((r) => `<div class="row"><div class="ico" style="width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:${tint('#f59e0b', 20)};color:#f59e0b">${ic('swap')}</div><div class="sp"><div class="b">${esc(r.who)}</div><div class="s muted sm">${r.net > 0 ? `te deve ${r.net} plantão(ões)` : r.net < 0 ? `você deve ${-r.net} plantão(ões)` : 'equilibrado'}</div></div></div>`).join('')}</div>` : ''}
  <button class="btn wa blk" data-act="go" data-v="summary">${ic('chat')}Gerar resumo para o WhatsApp</button>`;
}
function chart() {
  const now = new Date(); const pts = [];
  for (let i = 5; i >= 0; i--) { const dt = new Date(now.getFullYear(), now.getMonth() - i, 1); pts.push({ l: C.MONTHS[dt.getMonth()].slice(0, 3), v: C.monthSummary(S.d, dt.getFullYear(), dt.getMonth()).extrasTotal }); }
  const max = Math.max(...pts.map((p) => p.v), 1); const w = 300, h = 130, bw = 30, gap = (w - bw * 6) / 7;
  if (pts.every((p) => !p.v)) return `<div class="empty">Nenhuma extra registrada ainda.<br><span class="xs">Cadastre extras para acompanhar sua evolução.</span></div>`;
  return `<svg class="chartbars" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Extras por mês">${pts.map((p, i) => { const bh = Math.max(3, (p.v / max) * 82); const x = gap + i * (bw + gap); const last = i === 5; return `<rect x="${x}" y="${100 - bh}" width="${bw}" height="${bh}" rx="8" fill="${last ? 'var(--accent)' : 'var(--ok)'}" opacity="${last ? 1 : .55}"/><text x="${x + bw / 2}" y="${94 - bh}" text-anchor="middle">${p.v ? (p.v >= 1000 ? (p.v / 1000).toFixed(1).replace('.', ',') + 'k' : Math.round(p.v)) : ''}</text><text x="${x + bw / 2}" y="118" text-anchor="middle">${p.l}</text>`; }).join('')}</svg>`;
}

// ---------- QUARTOS DE HORA ----------
const postBar = () => `<div class="chips" style="margin:2px 0"><button class="chip ${!S.d.prefs.lastPost ? 'on' : ''}" data-act="q-post" data-v="">Sem posto</button>${S.d.posts.map((p) => `<button class="chip ${S.d.prefs.lastPost === p ? 'on' : ''}" data-act="q-post" data-v="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
function qGrid(date) {
  const by = Object.fromEntries(C.quartosOn(S.d, date).map((e) => [e.slot, e]));
  return `<div class="qgrid">${S.d.quarters.map((q) => { const e = by[q.id]; return `<button class="qchip ${e ? 'on' : ''}" data-act="q-toggle" data-date="${date}" data-q="${q.id}" aria-pressed="${!!e}"><b>${esc(q.alvorada ? 'Alvorada' : C.qLabel(q))}</b><small>${e && e.post ? esc(e.post) : q.alvorada ? C.qLabel(q) : '&nbsp;'}</small></button>`; }).join('')}</div>`;
}
const qTools = (date, photo = false) => `<span class="qt"><button data-act="q-all" data-date="${date}">Todos</button><button data-act="q-none" data-date="${date}">Limpar</button>${photo ? `<button data-act="roster-open" data-date="${date}" aria-label="Foto da escala" style="color:var(--accent)">${ic('camera')}</button>` : ''}</span>`;
function quartosView() {
  const { y, m } = S.qv; const t = C.today(); const key = C.ymKey(y, m);
  const days = C.monthDays(y, m).map((dt) => C.dayInfo(dt, S.d)).filter((i) => i.works || C.quartosOn(S.d, i.date).length);
  const total = S.d.events.filter((e) => e.type === 'quarto' && e.date.startsWith(key)).length;
  return `<div class="calhead"><button class="ibtn" data-act="qv-prev">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[m]} <span class="muted" style="font-weight:600">${y}</span></h2><button class="ibtn" data-act="qv-next">${ic('chevR')}</button></div>
  <div class="card col" style="gap:8px"><div class="row"><div class="b sp">Posto ao marcar</div><span class="muted xs">${total} quarto(s) no mês</span></div>${postBar()}<div class="muted xs">Toque num quarto para marcar. Tocar de novo remove. Com outro posto escolhido, troca o posto.</div></div>
  <button class="btn blk" data-act="roster-open" data-date="${days.find((i) => i.date >= t)?.date || t}">${ic('camera')}Enviar foto da escala de quartos</button>
  ${days.map((i) => { const n = C.quartosOn(S.d, i.date).length; return `<div class="card col" style="gap:10px" ${i.date === t ? 'id="qtoday"' : ''}><div class="row"><div class="sp"><div class="b">${C.WD3[C.weekday(i.date)]} ${C.fmtShort(i.date)}${i.date === t ? ' · hoje' : ''}</div><div class="muted xs">${n ? n + ' quarto(s)' : 'sem quartos marcados'}</div></div>${qTools(i.date)}</div>${qGrid(i.date)}</div>`; }).join('') || '<div class="card empty">Nenhum plantão neste mês.</div>'}`;
}
function livroView() {
  const { y, m } = S.liv; const key = C.ymKey(y, m);
  const list = S.d.events.filter((e) => e.type === 'ocorrencia' && e.date.startsWith(key)).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
  let last = ''; const rows = list.map((e) => { const h = e.date !== last ? `<div class="h2">${C.dateLong(e.date)}</div>` : ''; last = e.date; return h + evRow(e); }).join('');
  return `<div class="calhead"><button class="ibtn" data-act="liv-prev">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[m]} <span class="muted" style="font-weight:600">${y}</span></h2><button class="ibtn" data-act="liv-next">${ic('chevR')}</button></div>
  <button class="btn pri blk" data-act="ev-new" data-t="ocorrencia" data-date="${C.today()}">${ic('plus')}Nova ocorrência</button><div class="list">${rows || '<div class="card empty">Nenhuma ocorrência neste mês.<br><span class="xs">Registre fatos do plantão com hora, descrição e foto.</span></div>'}</div>`;
}
function moreView() {
  const row = (v, icn, t, sub) => `<button class="item" data-act="go" data-v="${v}"><div class="ico" style="background:${tint('var(--accent)', 18)};color:var(--accent)">${ic(icn)}</div><div class="sp"><div class="t">${t}</div><div class="s">${sub}</div></div>${ic('chevR')}</button>`;
  return `<div class="list">${row('finance', 'wallet', 'Finanças', 'Extras, valores a receber e permutas')}${row('summary', 'chat', 'Resumos para WhatsApp', 'Escala, quartos e finanças do mês')}${row('livro', 'alert', 'Livro de ocorrências', 'Registros com hora e foto')}${row('settings', 'settings', 'Ajustes', 'Escala, quartos, postos, alarmes, IA e conta')}</div>`;
}

// ---------- CALENDÁRIO ----------
function calendar() {
  const { y, m } = S.cal; const first = new Date(y, m, 1).getDay(); const t = C.today();
  const tag = { plantao: S.d.scale.hours + 'h', extra: 'Extra', permuta_in: 'Perm +', permuta_out: 'Perm −', folga: 'Folga', atestado: 'Atest.', ferias: 'Férias', livre: '' };
  const cells = Array.from({ length: first }, () => '<div class="cell blank"></div>').join('') + C.monthDays(y, m).map((date) => {
    const i = C.dayInfo(date, S.d); const types = [...new Set(i.events.map((e) => e.type))].slice(0, 4); const nq = i.events.filter((e) => e.type === 'quarto').length;
    return `<button class="cell ${date === t ? 'today' : ''}" data-st="${i.status}" data-act="day" data-date="${date}" aria-label="${C.dateLong(date)}: ${C.STATUS[i.status].label}"><span class="n">${+date.slice(8)}${nq ? `<sup class="qn">${nq}</sup>` : ''}</span><span class="tg" style="color:${i.status === 'livre' ? 'transparent' : C.STATUS[i.status].color}">${tag[i.status]}</span><span class="dots">${types.map((k) => `<i style="background:${typeColor(k)}"></i>`).join('')}</span></button>`;
  }).join('');
  const ms = C.monthSummary(S.d, y, m);
  const lg = [['var(--accent)', 'Plantão'], ['#22c55e', 'Extra'], ['#f59e0b', 'Permuta'], ['#a78bfa', 'Folga'], ['#ef4444', 'Atestado'], ['#14b8a6', 'Férias']];
  return `<div class="calhead"><button class="ibtn" data-act="cal-prev" aria-label="Mês anterior">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[m]} <span class="muted" style="font-weight:600">${y}</span></h2><button class="btn sm" data-act="cal-today">Hoje</button><button class="ibtn" data-act="cal-next" aria-label="Próximo mês">${ic('chevR')}</button></div>
  <div class="dow">${C.WD3.map((x) => `<div>${x}</div>`).join('')}</div><div class="cal" id="cal">${cells}</div>
  <div class="legend">${lg.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>
  <div class="card row wrap" style="gap:16px"><div><div class="b">${ms.plantoes.length + ms.permutaIn.length}</div><div class="muted xs">plantões</div></div><div><div class="b">${C.brl(ms.extrasTotal)}</div><div class="muted xs">extras</div></div><div><div class="b">${ms.permutas.length}</div><div class="muted xs">permutas</div></div><div><div class="b">${ms.folgas.length + ms.atestados.length}</div><div class="muted xs">folgas/atest.</div></div><span class="sp"></span><button class="btn sm pri" data-act="ev-new" data-t="extra" data-date="${C.today()}">${ic('plus')}Novo</button></div>`;
}

// ---------- FINANÇAS ----------
function finance() {
  const { y, m } = S.fin; const ms = C.monthSummary(S.d, y, m); const pct = ms.extrasTotal ? (ms.extrasPaid / ms.extrasTotal) * 100 : 0;
  const year = Array.from({ length: 12 }, (_, i) => C.monthSummary(S.d, y, i).extrasTotal).reduce((a, b) => a + b, 0);
  const led = C.permutaLedger(S.d.events); const perm = ms.permutas;
  return `<div class="calhead"><button class="ibtn" data-act="fin-prev">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[m]} <span class="muted" style="font-weight:600">${y}</span></h2><button class="ibtn" data-act="fin-next">${ic('chevR')}</button></div>
  <div class="hero" style="padding:18px"><span class="pill"><span class="dot" style="background:var(--ok)"></span>Extras do mês</span><h2 style="font-size:36px">${C.brl(ms.extrasTotal)}</h2><div class="bar"><i style="width:${pct}%"></i></div><div class="row sm"><span>✅ Recebido <b>${C.brl(ms.extrasPaid)}</b></span><span class="sp"></span><span>⏳ A receber <b>${C.brl(ms.extrasPending)}</b></span></div><div class="muted xs" style="margin-top:10px">Acumulado em ${y}: <b>${C.brl(year)}</b></div></div>
  <div class="card">${chart()}</div>
  <div class="row"><div class="h2 sp">Extras (${ms.extras.length})</div><button class="btn sm pri" data-act="ev-new" data-t="extra" data-date="${y === nowD.getFullYear() && m === nowD.getMonth() ? C.today() : `${y}-${C.pad(m + 1)}-01`}">${ic('plus')}Extra</button></div>
  <div class="list">${ms.extras.map((e) => `<div class="item"><button class="ico" data-act="ev-paid" data-id="${e.id}" style="background:${tint(e.paid ? '#22c55e' : '#f59e0b', 20)};color:${e.paid ? '#22c55e' : '#f59e0b'}" aria-label="Alternar recebido">${ic(e.paid ? 'check' : 'clock')}</button><div class="sp"><div class="t">${C.WD3[C.weekday(e.date)]} ${C.fmtShort(e.date)} · ${C.brl(e.value)}</div><div class="s">${C.TURNOS[e.turno] || 'Extra'} · ${e.paid ? 'recebida' : 'a receber'}${e.note ? ' · ' + esc(e.note) : ''}</div></div><button class="ibtn" data-act="ev-edit" data-id="${e.id}">${ic('edit')}</button></div>`).join('') || '<div class="card empty">Nenhuma extra neste mês.</div>'}</div>
  <div class="row"><div class="h2 sp">Permutas em aberto</div><button class="btn sm" data-act="ev-new" data-t="permuta" data-date="${C.today()}">${ic('plus')}Permuta</button></div>
  <div class="list">${led.map((r) => `<div class="item"><div class="ico" style="background:${tint('#f59e0b', 20)};color:#f59e0b">${ic('users')}</div><div class="sp"><div class="t">${esc(r.who)}</div><div class="s">${r.net > 0 ? `te deve ${r.net} plantão(ões)` : r.net < 0 ? `você deve ${-r.net} plantão(ões)` : 'equilibrado'} · ${r.open.length} em aberto</div></div><span class="badge" style="background:${tint(r.net >= 0 ? '#22c55e' : '#ef4444', 20)};color:${r.net >= 0 ? '#22c55e' : '#ef4444'}">${r.net > 0 ? '+' : ''}${r.net}</span></div>`).join('') || '<div class="card empty">Nenhuma permuta em aberto. ✅</div>'}</div>
  ${perm.length ? `<div class="h2">Permutas de ${C.MONTHS[m]}</div><div class="list">${perm.map((e) => `<div class="item"><button class="ico" data-act="ev-settle" data-id="${e.id}" style="background:${tint(e.settled ? '#22c55e' : '#f59e0b', 20)};color:${e.settled ? '#22c55e' : '#f59e0b'}" aria-label="Quitar">${ic(e.settled ? 'check' : 'swap')}</button><div class="sp"><div class="t">${C.fmtShort(e.date)} · ${esc(evTitle(e))}</div><div class="s">${esc(evSub(e))}</div></div><button class="ibtn" data-act="ev-edit" data-id="${e.id}">${ic('edit')}</button></div>`).join('')}</div>` : ''}`;
}

// ---------- RESUMOS (WhatsApp) ----------
const sumText = () => S.sum.custom ?? buildSummary(S.d, S.sum.y, S.sum.m, { kind: S.d.prefs.waKind, values: S.sum.values, notes: S.sum.notes, calendar: S.sum.calendar });
function summary() {
  const k = S.d.prefs.waKind; const text = sumText(); const tg = (key, l) => `<label class="tgl"><span class="sm">${l}</span><input type="checkbox" data-sum="${key}" ${S.sum[key] ? 'checked' : ''}></label>`;
  return `<div class="calhead"><button class="ibtn" data-act="sum-prev">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[S.sum.m]} <span class="muted" style="font-weight:600">${S.sum.y}</span></h2><button class="ibtn" data-act="sum-next">${ic('chevR')}</button></div>
  <div class="seg">${[['completo', 'Completo'], ['escala', 'Escala'], ['financeiro', 'Finanças'], ['proximos', 'Próximos']].map(([v, l]) => `<button class="${k === v ? 'on' : ''}" data-act="sum-kind" data-v="${v}">${l}</button>`).join('')}</div>
  <div class="card" style="padding:6px 14px">${tg('values', 'Incluir valores (R$)')}${tg('notes', 'Incluir observações')}${tg('calendar', 'Mini calendário do mês')}</div>
  ${S.sum.editing ? `<textarea id="sumEdit" style="min-height:300px;font-family:ui-monospace,monospace;font-size:13px">${esc(text)}</textarea>` : `<div class="wa-bubble">${waHtml(text)}</div>`}
  <label class="f">WhatsApp de destino (opcional — vazio = escolher o contato)<input type="tel" inputmode="tel" id="waPhone" placeholder="(11) 91234-5678" value="${esc(S.d.prefs.waPhone)}"></label>
  <a class="btn wa blk" data-act="wa-send" href="${esc(waLink(text, S.d.prefs.waPhone))}" target="_blank" rel="noopener" style="text-decoration:none">${ic('chat')}Enviar pelo WhatsApp</a>
  <div class="grid3"><button class="btn" data-act="sum-copy">${ic('copy')}Copiar</button><button class="btn" data-act="sum-share">${ic('share')}Compartilhar</button><button class="btn" data-act="sum-edit">${ic('edit')}${S.sum.editing ? 'Pronto' : 'Editar'}</button></div>`;
}

// ---------- AJUSTES ----------
function settings() {
  const d = S.d, p = d.profile, pr = d.prefs;
  const row = (l, inner) => `<label class="f">${l}${inner}</label>`;
  return `<div class="card col"><div class="row"><div class="avatar">${esc(initials(p.name))}</div><div class="sp"><div class="b">${esc(p.name || 'Policial')}</div><div class="muted sm">${esc(S.user.guest ? 'Modo sem cadastro' : S.user.email)}</div></div></div></div>
  <div class="h2">Perfil</div><div class="card col">${row('Nome', `<input data-bind="profile.name" value="${esc(p.name)}">`)}${row('Cargo', `<input data-bind="profile.rank" value="${esc(p.rank)}">`)}${row('Como seu nome aparece nas escalas de quartos', `<input data-bind="profile.alias" value="${esc(p.alias || '')}" placeholder="Ex.: Lucas, PP Silva (separe por vírgula)">`)}<div class="grid2">${row('Matrícula', `<input data-bind="profile.matricula" value="${esc(p.matricula)}">`)}${row('Unidade', `<input data-bind="profile.unit" value="${esc(p.unit)}">`)}</div></div>
  <div class="h2">Escala de plantão</div><div class="card col">${scaleEditor()}</div>
  ${quartosSettings()}
  <div class="h2">Valores padrão das extras</div><div class="card col">${moneyFields()}<div class="muted xs">Ao lançar uma extra, o valor é sugerido automaticamente — e pode ser alterado em cada lançamento.</div></div>
  ${aiSettings()}
  <div class="h2">Aparência</div><div class="card col"><div class="seg">${[['dark', 'Escuro'], ['light', 'Claro'], ['auto', 'Automático']].map(([v, l]) => `<button class="${pr.theme === v ? 'on' : ''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}</div><div class="sw">${ACCENTS.map((c) => `<button class="${pr.accent === c ? 'on' : ''}" style="background:${c}" data-act="accent" data-v="${c}" aria-label="Cor ${c}"></button>`).join('')}</div></div>
  <div class="h2">Voz</div><div class="card"><label class="tgl"><span><div class="b">Ler respostas em voz alta</div><div class="muted xs">O assistente fala as respostas (voz do aparelho)</div></span><input type="checkbox" data-bind="prefs.speak" data-bool ${pr.speak ? 'checked' : ''}></label></div>
  <div class="h2">Dados e backup</div><div class="card col"><div class="muted sm">Seus dados ficam somente neste aparelho. Faça backup para guardar ou levar para outro celular.</div><div class="grid2"><button class="btn" data-act="export">${ic('download')}Exportar backup</button><button class="btn" data-act="import">${ic('upload')}Importar backup</button></div><input type="file" id="impFile" accept="application/json,.json" class="hidden">${window._bip ? `<button class="btn pri" data-act="install">${ic('download')}Instalar app no aparelho</button>` : `<div class="muted xs">💡 Para instalar: no Chrome use “Adicionar à tela inicial”; no iPhone, Compartilhar → “Adicionar à Tela de Início”.</div>`}<button class="btn dng" data-act="clear-events">${ic('trash')}Apagar todos os lançamentos</button></div>
  <div class="h2">Conta</div><div class="card col">${S.user.guest ? '<div class="muted sm">Você está no modo sem cadastro. Crie uma conta para proteger os dados com senha.</div>' : `<button class="btn" data-act="pw">${ic('lock')}Alterar senha</button>`}<button class="btn" data-act="logout">${ic('logout')}Sair</button><button class="btn dng" data-act="delete-account">${ic('trash')}Excluir conta e dados</button></div>
  <p class="muted xs" style="text-align:center">Sentinela Tático · versão 1.0 · feito para Policiais Penais 🛡️</p>`;
}

function quartosSettings() {
  const d = S.d, pr = d.prefs;
  return `<div class="h2">Quartos de hora e postos</div><div class="card col"><div class="muted sm">Faixas usadas ao marcar seus quartos (início, fim e nome opcional).</div>${d.quarters.map((q, i) => `<div class="row" style="gap:6px"><input type="time" data-bind="quarters.${i}.start" value="${q.start}"><span class="muted">–</span><input type="time" data-bind="quarters.${i}.end" value="${q.end}"><input data-bind="quarters.${i}.name" value="${esc(q.name || '')}" placeholder="nome"><button class="ibtn" data-act="q-del" data-i="${i}" aria-label="Remover quarto">${ic('trash')}</button></div>`).join('')}<div class="grid2"><button class="btn sm" data-act="q-add">${ic('plus')}Adicionar quarto</button><button class="btn sm" data-act="q-reset">Restaurar padrão</button></div>
  <div class="b" style="margin-top:6px">Postos</div><div class="chips">${d.posts.map((p, i) => `<span class="chip on" style="display:inline-flex;gap:8px;align-items:center">${esc(p)}<button data-act="post-del" data-i="${i}" aria-label="Remover ${esc(p)}" style="color:var(--muted);display:inline-grid">${ic('x')}</button></span>`).join('') || '<span class="muted sm">Nenhum posto cadastrado.</span>'}</div><div class="row"><input id="postNew" placeholder="Novo posto (ex.: Pavilhão C)"><button class="btn sm" data-act="post-add" aria-label="Adicionar posto">${ic('plus')}</button></div></div>
  <div class="h2">Alarmes</div><div class="card col"><label class="tgl"><span><div class="b">Avisar antes de cada quarto</div><div class="muted xs">Toca um alarme com o app aberto</div></span><input type="checkbox" data-bind="prefs.reminders" ${pr.reminders ? 'checked' : ''}></label><label class="f">Minutos de antecedência<input type="number" min="0" max="120" data-bind="prefs.lead" data-num value="${pr.lead}"></label><label class="tgl"><span><div class="b">Alvorada</div><div class="muted xs">Alarme no horário da Alvorada, quando estiver de plantão</div></span><input type="checkbox" data-bind="prefs.alvorada" ${pr.alvorada ? 'checked' : ''}></label><div class="grid2"><button class="btn sm" data-act="alarm-test">${ic('clock')}Testar alarme</button><button class="btn sm" data-act="notify">Permitir notificações</button></div><div class="muted xs">Os alarmes só tocam com o app aberto no aparelho. Mantenha a tela ligada durante o plantão.</div></div>`;
}
function aiSettings() {
  const ai = S.d.prefs.ai;
  return `<div class="h2">IA: ler foto e entender frases livres</div><div class="card col"><div class="seg"><button class="${ai.provider === 'gemini' ? 'on' : ''}" data-act="ai-provider" data-v="gemini">Gemini (Google)</button><button class="${ai.provider === 'anthropic' ? 'on' : ''}" data-act="ai-provider" data-v="anthropic">Claude</button></div><label class="f">Chave da API<input type="password" data-bind="prefs.ai.key" value="${esc(ai.key)}" placeholder="Cole sua chave aqui" autocomplete="off"></label><label class="f">Modelo (opcional)<input data-bind="prefs.ai.model" value="${esc(ai.model)}" placeholder="${DEFAULT_MODELS[ai.provider]}"></label><button class="btn sm" data-act="ai-test">${ic('check')}Testar conexão</button><div class="muted xs">${ai.provider === 'gemini' ? 'Chave gratuita em aistudio.google.com/app/apikey.' : 'Chave em console.anthropic.com.'} Ela fica salva só neste aparelho e vai direto dele para o provedor. Sem chave, tudo continua funcionando: você marca os quartos tocando.</div></div>`;
}

// ---------- SHEETS ----------
function daySheet(date) {
  const i = C.dayInfo(date, S.d); const st = C.STATUS[i.status];
  const adds = Object.keys(C.TYPES).filter((k) => k !== 'quarto').map((k) => `<button class="qa" data-act="ev-new" data-t="${k}" data-date="${date}"><i style="background:${tint(typeColor(k), 20)};color:${typeColor(k)}">${ic(C.TYPES[k].icon)}</i>${k === 'atestado' ? 'Atestado' : C.TYPES[k].label}</button>`).join('');
  return `<div class="grab"></div><div class="row"><div class="sp"><div class="muted sm">${C.relDays(date)}</div><h3>${C.dateLong(date)}</h3></div><button class="ibtn" data-act="close">${ic('x')}</button></div>
  <div class="row" style="margin:12px 0"><span class="badge" style="background:${tint(st.color, 20)};color:${st.color};font-size:12.5px;padding:6px 12px">${st.label}</span><span class="muted sm">Escala ${C.scaleLabel(S.d.scale)}: ${i.scheduled ? 'dia de plantão' : 'dia de folga'}</span></div>
  <div class="list">${i.events.filter((e) => e.type !== 'quarto').map((e) => evRow(e)).join('') || '<div class="empty sm">Nenhum lançamento neste dia.</div>'}</div>
  ${i.works || C.quartosOn(S.d, date).length ? `<div class="row" style="margin-top:16px"><div class="h2 sp" style="margin:0">Quartos e postos</div>${qTools(date, true)}</div>${postBar()}${qGrid(date)}` : ''}<div class="h2" style="margin-top:16px">Adicionar</div><div class="quick" style="grid-template-columns:repeat(3,1fr);margin-top:8px">${adds}</div>`;
}
function formSheet() {
  const e = S.draft; const T = C.TYPES[e.type]; const isNew = !e.id; const range = T.range;
  const typeChips = isNew ? `<div class="chips">${Object.entries(C.TYPES).filter(([k]) => k !== 'quarto').map(([k, v]) => `<button class="chip ${e.type === k ? 'on' : ''}" data-act="f-type" data-v="${k}">${v.label}</button>`).join('')}</div>` : '';
  const f = (name, label, inner) => `<label class="f">${label}${inner}</label>`;
  const names = [...new Set(S.d.events.filter((x) => x.who).map((x) => x.who))];
  let fields = '';
  if (e.type === 'extra') fields = `${f('turno', 'Turno', `<select data-f="turno">${Object.entries(C.TURNOS).map(([k, v]) => `<option value="${k}" ${e.turno === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}${f('value', 'Valor (R$)', `<input data-f="value" type="number" step="0.01" min="0" inputmode="decimal" value="${e.value ?? ''}">`)}<label class="tgl"><span class="sm b">Já recebi esta extra</span><input type="checkbox" data-f="paid" ${e.paid ? 'checked' : ''}></label>`;
  if (e.type === 'permuta') fields = `<div class="seg"><button class="${e.dir === 'passei' ? 'on' : ''}" data-act="f-set" data-k="dir" data-v="passei">Passei meu plantão</button><button class="${e.dir === 'assumi' ? 'on' : ''}" data-act="f-set" data-k="dir" data-v="assumi">Assumi plantão</button></div>${f('who', e.dir === 'passei' ? 'Quem assumiu' : 'De quem', `<input data-f="who" list="names" value="${esc(e.who || '')}" placeholder="Nome do colega"><datalist id="names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`)}${f('returnDate', 'Data da devolução (opcional)', `<input data-f="returnDate" type="date" value="${e.returnDate || ''}">`)}<label class="tgl"><span class="sm b">Permuta quitada (já devolvida)</span><input type="checkbox" data-f="settled" ${e.settled ? 'checked' : ''}></label>`;
  if (e.type === 'folga') fields = `${f('reason', 'Motivo', `<select data-f="reason">${['', 'Compensação', 'Banco de horas', 'Abono', 'Outro'].map((r) => `<option ${e.reason === r ? 'selected' : ''} value="${r}">${r || 'Selecione (opcional)'}</option>`).join('')}</select>`)}`;
  if (e.type === 'atestado') fields = f('cid', 'CID (opcional)', `<input data-f="cid" value="${esc(e.cid || '')}" placeholder="Ex.: J11">`);
  if (e.type === 'obs') fields = '';
  if (e.type === 'ocorrencia') fields = `${f('time', 'Hora', `<input data-f="time" type="time" value="${e.time || ''}">`)}${f('title', 'Título', `<input data-f="title" value="${esc(e.title || '')}" placeholder="Ex.: Revista no pavilhão B">`)}${e.photo ? `<div class="photo"><img src="${e.photo}" alt="Foto anexada"><button class="btn sm" type="button" data-act="photo-clear">Remover foto</button></div>` : `<label class="btn">${ic('camera')}Anexar foto<input type="file" accept="image/*" capture="environment" data-photo class="hidden"></label>`}`;
  const days = range ? `${f('_days', 'Quantidade de dias', `<input data-f="_days" type="number" min="1" max="365" inputmode="numeric" value="${e._days || 1}">`)}<div class="muted xs" style="margin-top:-6px">${(+e._days || 1) > 1 ? `Até ${C.fmtBR(C.addDays(e.date || C.today(), (+e._days || 1) - 1))}` : ''}</div>` : '';
  return `<div class="grab"></div><div class="row"><div class="ico" style="width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:${tint(T.color, 20)};color:${T.color}">${ic(T.icon)}</div><h3 class="sp">${isNew ? 'Novo lançamento' : 'Editar ' + T.label.toLowerCase()}</h3><button class="ibtn" data-act="f-cancel">${ic('x')}</button></div>
  <form class="col" style="margin-top:14px" data-submit="ev-save">${typeChips}${f('date', 'Data', `<input data-f="date" type="date" required value="${e.date}">`)}${days}${fields}${f('note', e.type === 'obs' ? 'Observação' : e.type === 'ocorrencia' ? 'Descrição' : 'Observações (opcional)', `<textarea data-f="note" placeholder="${e.type === 'obs' ? 'Escreva sua anotação…' : 'Detalhes, local, motivo…'}">${esc(e.note || '')}</textarea>`)}
  <div class="row"><button class="btn pri sp" type="submit">${ic('check')}Salvar</button>${isNew ? '' : `<button class="btn dng" type="button" data-act="ev-del" data-id="${e.id}">${ic('trash')}</button>`}</div></form>`;
}
function rosterSheet() {
  const R = S.roster; const can = hasAI(S.d.prefs.ai); let body;
  const pick = `<div class="grid2"><label class="btn pri">${ic('camera')}Tirar foto<input type="file" accept="image/*" capture="environment" data-roster-file class="hidden"></label><label class="btn">${ic('image')}Galeria<input type="file" accept="image/*" data-roster-file class="hidden"></label></div>`;
  if (!R.image) body = `<p class="muted sm" style="margin:0">Envie a foto que veio no grupo do WhatsApp. ${can ? 'A IA lê a lista e marca os seus quartos.' : 'Você vê a foto e marca os quartos tocando.'}</p>${pick}${can ? '' : `<button class="btn blk" data-act="go" data-v="settings">${ic('sparkles')}Ligar a leitura automática (IA)</button>`}`;
  else body = `<img class="rimg" src="${R.image}" alt="Foto da escala"><label class="f">Data do plantão<input type="date" data-roster-date value="${R.date}"></label>${can && !R.entries ? `<button class="btn pri blk" data-act="roster-read" ${R.busy ? 'disabled' : ''}>${ic('sparkles')}${R.busy ? 'Lendo a foto…' : 'Ler quartos com IA'}</button>` : ''}${R.err ? `<div class="err">${esc(R.err)}</div>` : ''}${R.entries ? rosterList() : ''}<div class="row"><div class="h2 sp" style="margin:0">Marcar manualmente · ${C.fmtShort(R.date)}</div>${qTools(R.date)}</div>${postBar()}${qGrid(R.date)}<div class="grid2"><button class="btn" data-act="roster-reset">Trocar foto</button><button class="btn" data-act="roster-save">Guardar no livro</button></div>`;
  return `<div class="grab"></div><div class="row"><h3 class="sp">Foto do quarto de hora</h3><button class="ibtn" data-act="close">${ic('x')}</button></div><div class="col" style="margin-top:12px">${body}</div>`;
}
function rosterList() {
  const rows = S.roster.entries; if (!rows.length) return '<div class="empty sm">Não encontrei linhas legíveis. Tente uma foto mais nítida ou marque manualmente.</div>';
  const mine = rows.filter((r) => r.mine).length;
  return `<div class="muted sm">${mine ? `Achei ${mine} linha(s) com o seu nome.` : 'Não achei o seu nome. Confira Ajustes → nome na escala, ou marque as linhas abaixo.'}</div><div class="list">${rows.map((r, i) => { const q = S.d.quarters.find((x) => x.id === r.slotId); return `<label class="item" style="${r.mine ? 'border-color:var(--accent)' : ''}"><input type="checkbox" data-ri="${i}" ${r.checked ? 'checked' : ''} ${q ? '' : 'disabled'}><div class="sp" style="min-width:0"><div class="t">${esc(r.name)}${r.mine ? ' · você' : ''}</div><div class="s">${q ? C.qLabel(q) : '⚠ faixa não reconhecida: ' + esc(r.slotText)}${r.post ? ' · ' + esc(r.post) : ''}</div></div></label>`; }).join('')}</div><button class="btn pri blk" data-act="roster-apply">${ic('check')}Marcar selecionados (${rows.filter((r) => r.checked).length})</button>`;
}
function pwSheet() { return `<div class="grab"></div><div class="row"><h3 class="sp">Alterar senha</h3><button class="ibtn" data-act="close">${ic('x')}</button></div><form class="col" style="margin-top:14px" data-submit="pw-save"><label class="f">Senha atual<input name="old" type="password" required autocomplete="current-password"></label><label class="f">Nova senha<input name="n1" type="password" minlength="6" required autocomplete="new-password"></label><div id="pwErr"></div><button class="btn pri">Salvar nova senha</button></form>`; }

const assistant = createAssistant({
  data: () => S.d, save, title: evTitle, close: () => closeSheet(), goto: (v) => go(v),
  add: (e) => { addEvent(e); }, edit: (e) => { closeSheet(); openForm(e); },
  ctx: () => ({ quarters: S.d.quarters, posts: S.d.posts }),
  addQuartos: (date, ids, post) => { ids.forEach((id) => setQuarto(date, id, post)); save(); render(); },
  roster: () => { closeSheet(); A['roster-open']({ dataset: { date: C.today() } }); },
});
const setQuarto = (date, slot, post) => { const e = S.d.events.find((x) => x.type === 'quarto' && x.date === date && x.slot === slot); if (e) e.post = post || e.post || ''; else S.d.events.push({ id: C.uid(), type: 'quarto', date, slot, post: post || '' }); };
const refreshQ = () => { save(); render(); if (S.sheet && ['day', 'roster'].includes(S.sheet.kind)) renderSheet(); };
function showAlarm(a) {
  siren(true); notify(a); let r = $('#alarmRoot'); if (!r) { r = document.createElement('div'); r.id = 'alarmRoot'; document.body.appendChild(r); }
  r.innerHTML = `<div class="overlay" style="z-index:120;align-items:center;background:rgba(110,0,0,.6)"><div class="sheet" style="border-radius:28px;max-width:380px;text-align:center;padding:28px"><div class="logo" style="margin:0 auto 14px;background:var(--danger)">${ic('alert')}</div><h3 style="font-size:24px">${esc(a.title)}</h3><p class="muted">${esc(a.body)}</p><button class="btn pri blk" style="margin-top:16px" data-act="alarm-off">Entendido</button></div></div>`;
}
function openSheet(kind, extra = {}) { S.sheet = { kind, ...extra }; renderSheet(); }
function closeSheet() { if (S.sheet?.kind === 'ai') assistant.unmount(); S.sheet = null; renderSheet(); }
function renderSheet() {
  const root = $('#sheetRoot'); const sh = S.sheet; if (!sh) { root.innerHTML = ''; root.dataset.kind = ''; document.body.style.overflow = ''; return; }
  document.body.style.overflow = 'hidden';
  if (!root.firstChild || root.dataset.kind !== sh.kind) { root.dataset.kind = sh.kind; root.innerHTML = `<div class="overlay" data-act="overlay"><div class="sheet" role="dialog" aria-modal="true"></div></div>`; }
  const el = $('.sheet', root); const top = el.scrollTop;
  if (sh.kind === 'ai') assistant.mount(el);
  else { el.innerHTML = { day: () => daySheet(sh.date), form: formSheet, pw: pwSheet, roster: rosterSheet }[sh.kind](); el.scrollTop = top; }
}
function openForm(base) {
  const T = C.TYPES[base.type]; const e = { turno: 'diurna', dir: 'passei', ...base };
  if (!e.id && e.type === 'ocorrencia' && !e.time) e.time = new Date().toTimeString().slice(0, 5);
  if (!e.id && e.type === 'extra' && e.value == null) e.value = S.d.money[e.turno];
  if (T.range) e._days = e._days || (e.end ? C.diffDays(e.end, e.date) + 1 : 1);
  S.draft = e; openSheet('form', { back: S.sheet?.kind === 'day' ? S.sheet.date : S.sheet?.back });
}
function addEvent(e) {
  const ev = { ...e, id: e.id || C.uid() }; if (ev.type === 'extra') { ev.value = Number(ev.value) || 0; ev.paid = !!ev.paid; }
  S.d.events.push(ev); save(); render(); return ev;
}

// ---------- RENDER ----------
function renderView() {
  const el = $('#view'); if (!el) return;
  el.innerHTML = { dashboard, calendar, quartos: quartosView, finance, summary, livro: livroView, more: moreView, settings }[S.view]();
  el.classList.toggle('enter', !!S.anim); S.anim = false;
}
function render() {
  applyTheme(); const root = $('#root');
  if (!S.uid) { root.innerHTML = authView(); return; }
  if (!S.d.onboarded) { root.innerHTML = onboardView(); return; }
  const keep = window.scrollY;
  root.innerHTML = shell(); renderView(); window.scrollTo(0, keep);
}
function go(v) { S.view = v; S.anim = true; S.sheet && closeSheet(); render(); window.scrollTo(0, 0); if (v === 'quartos') setTimeout(() => $('#qtoday')?.scrollIntoView({ block: 'center' }), 60); }

// ---------- CONFIRMAÇÃO (substitui confirm() nativo) ----------
function ask(msg, ok = 'Confirmar') {
  return new Promise((res) => {
    let r = $('#askRoot'); if (!r) { r = document.createElement('div'); r.id = 'askRoot'; document.body.appendChild(r); }
    r.innerHTML = `<div class="overlay" style="z-index:90;align-items:center"><div class="sheet" style="border-radius:26px;max-width:380px;padding:22px"><h3 style="margin-bottom:8px">Confirmar</h3><p class="muted" style="margin:0 0 18px;white-space:pre-line">${esc(msg)}</p><div class="row"><button class="btn sp" data-k="0">Cancelar</button><button class="btn pri sp" data-k="1">${esc(ok)}</button></div></div></div>`;
    r.onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; r.innerHTML = ''; res(b.dataset.k === '1'); };
  });
}

// ---------- AÇÕES ----------
const setPath = (path, val) => { const ks = path.split('.'); let o = S.d; for (const k of ks.slice(0, -1)) o = o[k]; o[ks.at(-1)] = val; };
const shiftMonth = (o, n) => { const dt = new Date(o.y, o.m + n, 1); o.y = dt.getFullYear(); o.m = dt.getMonth(); };
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } toast('Texto copiado! ✅'); };
const start = async (id, remember = true) => { S.uid = id; S.user = Store.user(id); S.d = Store.load(id) || defaultData(S.user.name); Store.startSession(id, remember); S.view = 'dashboard'; render(); };

const A = {
  'auth-tab': (el) => { S.auth = { tab: el.dataset.v, err: '' }; render(); },
  guest: async () => { const { user, data } = await Store.register({ name: 'Policial Penal', guest: true }); data.onboarded = true; data.scale = C.defaultScale(C.today()); Store.save(user.id, data); await start(user.id, true); toast('Escala 24x72 configurada — hoje é seu plantão ✅'); },
  logout: async () => { if (!(await ask('Sair da conta?', 'Sair'))) return; Store.endSession(); S.uid = S.d = S.user = null; S.sheet = null; renderSheet(); render(); },
  'delete-account': async () => { if (!(await ask('Excluir a conta e TODOS os dados deste aparelho? Não dá para desfazer.', 'Excluir'))) return; Store.deleteAccount(S.uid); S.uid = S.d = S.user = null; render(); },
  go: (el) => go(el.dataset.v), ai: () => openSheet('ai'), close: () => closeSheet(),
  overlay: (el, ev) => { if (ev.target === el) (S.sheet?.kind === 'form' && S.sheet.back) ? A['f-cancel']() : closeSheet(); },
  // onboarding
  'ob-next': () => { const st = S.ob.step; if (st === 1 && S.ob.today) S.d.scale.anchor = C.today(); if (st === 0 && !S.d.profile.name.trim()) return toast('Informe seu nome', 'err'); if (st === 3) { S.d.onboarded = true; save(); render(); toast('Bem-vindo ao Sentinela! 🛡️'); return; } S.ob.step++; save(); render(); },
  'ob-back': () => { S.ob.step--; render(); }, 'ob-today': (el) => { S.ob.today = el.dataset.v === '1'; if (S.ob.today) S.d.scale.anchor = C.today(); render(); },
  preset: (el) => { const k = el.dataset.v, p = C.PRESETS[k]; const sc = S.d.scale; sc.preset = k; if (k !== 'custom') { sc.work = p.work; sc.off = p.off; sc.hours = p.hours; if (k === '12x36' && sc.start === '07:00') sc.start = '07:00'; } save(); render(); },
  'anchor-today': () => { S.d.scale.anchor = C.today(); save(); render(); toast('Hoje agora é dia de plantão ✅'); },
  theme: (el) => { S.d.prefs.theme = el.dataset.v; save(); render(); }, accent: (el) => { S.d.prefs.accent = el.dataset.v; save(); render(); },
  // calendário / nav mensal
  'cal-prev': () => { shiftMonth(S.cal, -1); render(); }, 'cal-next': () => { shiftMonth(S.cal, 1); render(); }, 'cal-today': () => { S.cal = { y: nowD.getFullYear(), m: nowD.getMonth() }; render(); },
  'fin-prev': () => { shiftMonth(S.fin, -1); render(); }, 'fin-next': () => { shiftMonth(S.fin, 1); render(); },
  'sum-prev': () => { shiftMonth(S.sum, -1); S.sum.custom = null; render(); }, 'sum-next': () => { shiftMonth(S.sum, 1); S.sum.custom = null; render(); },
  'sum-kind': (el) => { S.d.prefs.waKind = el.dataset.v; S.sum.custom = null; S.sum.editing = false; save(); render(); },
  day: (el) => openSheet('day', { date: el.dataset.date }),
  // eventos
  'ev-new': (el) => { const t = el.dataset.t; const back = S.sheet?.kind === 'day' ? S.sheet.date : null; S.sheet = null; openForm({ type: t, date: el.dataset.date, note: '' }); S.sheet.back = back; },
  'ev-edit': (el) => { const e = S.d.events.find((x) => x.id === el.dataset.id); if (e) { const back = S.sheet?.kind === 'day' ? S.sheet.date : null; openForm({ ...e }); S.sheet.back = back; } },
  'ev-del': async (el) => { if (!(await ask('Excluir este lançamento?', 'Excluir'))) return; S.d.events = S.d.events.filter((x) => x.id !== el.dataset.id); save(); const b = S.sheet?.back; b ? openSheet('day', { date: b }) : closeSheet(); render(); toast('Lançamento excluído'); },
  'ev-paid': (el) => { const e = S.d.events.find((x) => x.id === el.dataset.id); e.paid = !e.paid; save(); render(); toast(e.paid ? 'Marcada como recebida ✅' : 'Marcada como a receber'); },
  'ev-settle': (el) => { const e = S.d.events.find((x) => x.id === el.dataset.id); e.settled = !e.settled; save(); render(); toast(e.settled ? 'Permuta quitada ✅' : 'Permuta reaberta'); },
  'f-type': (el) => { const e = S.draft; e.type = el.dataset.v; const T = C.TYPES[e.type]; if (T.range) e._days = e._days || 1; if (e.type === 'extra' && e.value == null) e.value = S.d.money[e.turno || 'diurna']; renderSheet(); },
  'f-set': (el) => { S.draft[el.dataset.k] = el.dataset.v; renderSheet(); },
  'f-cancel': () => { const b = S.sheet?.back; b ? openSheet('day', { date: b }) : closeSheet(); },
  'qv-prev': () => { shiftMonth(S.qv, -1); render(); }, 'qv-next': () => { shiftMonth(S.qv, 1); render(); },
  'liv-prev': () => { shiftMonth(S.liv, -1); render(); }, 'liv-next': () => { shiftMonth(S.liv, 1); render(); },
  'q-post': (el) => { S.d.prefs.lastPost = el.dataset.v; refreshQ(); },
  'q-toggle': (el) => {
    const { date, q } = el.dataset; const post = S.d.prefs.lastPost; const e = S.d.events.find((x) => x.type === 'quarto' && x.date === date && x.slot === q);
    if (!e) { setQuarto(date, q, post); if (S.d.prefs.reminders) askNotifyPermission(); } else if (post && e.post !== post) e.post = post; else S.d.events = S.d.events.filter((x) => x !== e);
    refreshQ();
  },
  'q-all': (el) => { for (const q of S.d.quarters) if (!S.d.events.some((x) => x.type === 'quarto' && x.date === el.dataset.date && x.slot === q.id)) setQuarto(el.dataset.date, q.id, S.d.prefs.lastPost); refreshQ(); },
  'q-none': (el) => { S.d.events = S.d.events.filter((x) => !(x.type === 'quarto' && x.date === el.dataset.date)); refreshQ(); },
  'q-add': () => { S.d.quarters.push({ id: C.uid(), start: '00:00', end: '02:00' }); save(); renderView(); },
  'q-del': (el) => { S.d.quarters.splice(+el.dataset.i, 1); save(); renderView(); },
  'q-reset': async () => { if (!(await ask('Restaurar os quartos padrão (18h às 8h)?', 'Restaurar'))) return; S.d.quarters = C.DEFAULT_QUARTERS.map((q) => ({ ...q })); save(); renderView(); },
  'post-add': () => { const v = $('#postNew').value.trim(); if (!v) return; if (!S.d.posts.includes(v)) S.d.posts.push(v); save(); renderView(); },
  'post-del': (el) => { S.d.posts.splice(+el.dataset.i, 1); save(); renderView(); },
  'ai-provider': (el) => { S.d.prefs.ai.provider = el.dataset.v; save(); renderView(); },
  'ai-test': async () => { try { toast('Testando…'); const r = await callLLM(S.d.prefs.ai, { prompt: 'Responda apenas com a palavra OK.' }); toast(/ok/i.test(r) ? 'IA conectada ✅' : 'A IA respondeu, mas de forma inesperada'); } catch (e) { toast('Falhou: ' + (e.message || 'erro'), 'err'); } },
  notify: async () => { const r = await askNotifyPermission(); toast(r === 'granted' ? 'Notificações liberadas ✅' : 'Notificações bloqueadas no navegador', r === 'granted' ? '' : 'err'); },
  'alarm-test': () => showAlarm({ title: 'Teste de alarme', body: 'É assim que o aviso do quarto vai tocar.', alvorada: false }),
  'alarm-off': () => { siren(false); $('#alarmRoot').innerHTML = ''; },
  'photo-clear': () => { S.draft.photo = ''; renderSheet(); },
  'roster-open': (el) => { S.roster = { date: el.dataset.date || C.today(), image: null, entries: null, busy: false, err: '' }; S.sheet = null; openSheet('roster'); },
  'roster-reset': () => { S.roster.image = null; S.roster.entries = null; S.roster.err = ''; renderSheet(); },
  'roster-read': async () => {
    const R = S.roster; R.busy = true; R.err = ''; renderSheet();
    try { const r = await readRoster(S.d.prefs.ai, R.image, { quarters: S.d.quarters, posts: S.d.posts, profile: S.d.profile }); if (r.date) R.date = r.date; R.entries = r.entries.map((x) => ({ ...x, checked: x.mine && !!x.slotId })); } catch (e) { R.err = e.message || 'Não consegui ler a foto.'; }
    R.busy = false; if (S.sheet?.kind === 'roster') renderSheet();
  },
  'roster-apply': () => { const R = S.roster; let n = 0; for (const r of R.entries.filter((x) => x.checked && x.slotId)) { setQuarto(R.date, r.slotId, r.post); n++; } refreshQ(); toast(n ? `${n} quarto(s) marcado(s) ✅` : 'Nada selecionado'); },
  'roster-save': () => { const R = S.roster; S.d.events.push({ id: C.uid(), type: 'ocorrencia', date: R.date, time: '', title: 'Escala de quartos (foto)', note: '', photo: R.image }); save(); render(); toast('Foto guardada no Livro de ocorrências ✅'); },
  pw: () => openSheet('pw'),
  // resumos
  'wa-send': (el) => { S.d.prefs.waPhone = $('#waPhone').value; save(); el.href = waLink(sumText(), S.d.prefs.waPhone); },
  'sum-copy': () => copyText(sumText()),
  'sum-share': async () => { if (navigator.share) { try { await navigator.share({ text: sumText() }); } catch { /* cancelado */ } } else copyText(sumText()); },
  'sum-edit': () => { if (S.sum.editing) { S.sum.custom = $('#sumEdit').value; S.sum.editing = false; } else { S.sum.custom = sumText(); S.sum.editing = true; } render(); },
  // dados
  export: () => { const blob = new Blob([JSON.stringify({ app: 'sentinela', version: 1, exportedAt: new Date().toISOString(), data: S.d }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sentinela-backup-${C.today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Backup exportado ✅'); },
  import: () => $('#impFile').click(),
  'clear-events': async () => { if (!(await ask('Apagar TODOS os extras, permutas, folgas, atestados e observações?', 'Apagar tudo'))) return; S.d.events = []; save(); render(); toast('Lançamentos apagados'); },
  install: async () => { const p = window._bip; if (!p) return; p.prompt(); await p.userChoice; window._bip = null; render(); },
};
const FORMS = {
  async login(f) {
    const fd = new FormData(f); try { const u = await Store.login(fd.get('email'), fd.get('password')); S.auth.err = ''; await start(u.id, !!fd.get('remember')); } catch (e) { S.auth.err = e.message; render(); }
  },
  async register(f) {
    const fd = new FormData(f); const pw = fd.get('password');
    try {
      if (pw !== fd.get('password2')) throw new Error('As senhas não coincidem.');
      const { user } = await Store.register({ name: fd.get('name').trim(), email: fd.get('email'), password: pw }); S.auth.err = ''; S.ob = { step: 0, today: true }; await start(user.id, !!fd.get('remember'));
    } catch (e) { S.auth.err = e.message; render(); }
  },
  'ev-save'() {
    const e = { ...S.draft }; const T = C.TYPES[e.type]; if (!e.date) return toast('Informe a data', 'err');
    if (T.range) { const n = Math.max(1, parseInt(e._days) || 1); e.end = n > 1 ? C.addDays(e.date, n - 1) : undefined; } else delete e.end; delete e._days;
    if (e.type === 'obs' && !(e.note || '').trim()) return toast('Escreva a observação', 'err');
    if (e.type === 'ocorrencia' && !(e.title || '').trim() && !(e.note || '').trim() && !e.photo) return toast('Descreva a ocorrência', 'err');
    if (e.type === 'extra') { e.value = Number(e.value) || 0; e.paid = !!e.paid; }
    if (e.type === 'permuta') e.who = (e.who || '').trim();
    if (e.id) S.d.events = S.d.events.map((x) => (x.id === e.id ? e : x)); else { e.id = C.uid(); S.d.events.push(e); }
    save(); const b = S.sheet?.back; if (b) openSheet('day', { date: b }); else closeSheet(); render(); toast('Salvo ✅');
  },
  async 'pw-save'(f) {
    const fd = new FormData(f); try { await Store.changePassword(S.uid, fd.get('old'), fd.get('n1')); closeSheet(); toast('Senha alterada ✅'); } catch (e) { $('#pwErr').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el) return; const fn = A[el.dataset.act]; if (fn) { if (el.tagName === 'A' && el.dataset.act !== 'wa-send') ev.preventDefault(); fn(el, ev); }
});
document.addEventListener('submit', (ev) => { const f = ev.target.closest('[data-submit]'); if (!f) return; ev.preventDefault(); FORMS[f.dataset.submit]?.(f); });
// campos do formulário de lançamento
document.addEventListener('input', (ev) => {
  const t = ev.target; if (t.dataset.f && S.draft) { S.draft[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.f === '_days' || t.dataset.f === 'date') renderHint(); }
});
function renderHint() { /* atualização leve do texto "Até dd/mm" ao digitar */ const h = $('#sheetRoot .muted.xs[style*="-6px"]'); if (h) h.textContent = (+S.draft._days || 1) > 1 && S.draft.date ? `Até ${C.fmtBR(C.addDays(S.draft.date, (+S.draft._days || 1) - 1))}` : ''; }
document.addEventListener('change', async (ev) => {
  const t = ev.target;
  if (t.dataset.photo !== undefined && t.files[0]) { try { S.draft.photo = await compressImage(t.files[0]); renderSheet(); } catch (e) { toast(e.message, 'err'); } return; }
  if (t.dataset.rosterFile !== undefined && t.files[0]) { try { S.roster.image = await compressImage(t.files[0]); S.roster.entries = null; S.roster.err = ''; renderSheet(); } catch (e) { toast(e.message, 'err'); } return; }
  if (t.dataset.rosterDate !== undefined) { S.roster.date = t.value || S.roster.date; renderSheet(); return; }
  if (t.dataset.ri !== undefined) { S.roster.entries[+t.dataset.ri].checked = t.checked; renderSheet(); return; }
  if (t.dataset.f && S.draft) { S.draft[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.f === 'turno' && S.draft.type === 'extra') { S.draft.value = S.d.money[t.value]; renderSheet(); } return; }
  if (t.dataset.bind) {
    let v = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.num !== undefined) v = Math.max(0, Number(v) || 0);
    if (t.dataset.bind === 'scale.anchor' && !v) return;
    setPath(t.dataset.bind, v);
    if (t.dataset.bind.startsWith('scale.') && ['work', 'off', 'hours'].includes(t.dataset.bind.split('.')[1])) S.d.scale.preset = 'custom';
    save(); if (t.dataset.bind.startsWith('scale') || t.dataset.bind.startsWith('profile') || t.dataset.bind.startsWith('money') && S.view === 'settings') render(); return;
  }
  if (t.dataset.sum) { S.sum[t.dataset.sum] = t.checked; S.sum.custom = null; render(); return; }
  if (t.id === 'waPhone') { S.d.prefs.waPhone = t.value; save(); return; }
  if (t.id === 'impFile' && t.files[0]) {
    try {
      const j = JSON.parse(await t.files[0].text()); const d = j.data || j; if (!Array.isArray(d.events) || !d.scale) throw new Error('Arquivo inválido');
      if (!(await ask(`Importar backup com ${d.events.length} lançamento(s)? Os dados atuais serão substituídos.`, 'Importar'))) return;
      const b = defaultData(); S.d = { ...b, ...d, profile: { ...b.profile, ...d.profile }, scale: { ...b.scale, ...d.scale }, money: { ...b.money, ...d.money }, prefs: { ...b.prefs, ...d.prefs }, onboarded: true }; save(); render(); toast('Backup importado ✅');
    } catch { toast('Arquivo de backup inválido', 'err'); }
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sheet) closeSheet(); });
// gestos: deslizar no calendário troca o mês
let tx = 0; document.addEventListener('touchstart', (e) => { if (e.target.closest('#cal')) tx = e.touches[0].clientX; else tx = 0; }, { passive: true });
document.addEventListener('touchend', (e) => { if (!tx) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 70) { shiftMonth(S.cal, dx < 0 ? 1 : -1); render(); } tx = 0; }, { passive: true });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window._bip = e; if (S.view === 'settings') renderView(); });
setInterval(() => { if (S.uid && S.d?.onboarded && S.view === 'dashboard' && !S.sheet && !document.activeElement?.closest('input,textarea')) renderView(); }, 30000);

// ---------- BOOT ----------
(function boot() {
  const id = Store.currentId(); if (id && Store.user(id)) { S.uid = id; S.user = Store.user(id); S.d = Store.load(id); if (!S.d) { S.uid = null; Store.endSession(); } }
  const root = document.createElement('div'); root.id = 'root'; const sr = document.createElement('div'); sr.id = 'sheetRoot'; document.body.append(root, sr);
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  startReminders(() => (S.uid && S.d?.onboarded ? S.d : null), showAlarm);
  window.__sentinela = { S, go, openSheet, openForm, render }; // útil para depuração/testes
})();
