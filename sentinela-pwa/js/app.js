import * as C from './core.js';
import { Store, defaultData } from './store.js';
import { ic, esc, $, $$, toast, initials, fmtDur, greet, waHtml } from './ui.js';
import { buildSummary, waLink } from './summary.js';
import { createAssistant } from './ai.js';
import { hasAI, readRoster, compressImage, squareImage, callLLM, DEFAULT_MODELS, autoPickGeminiModel } from './vision.js';
import { startReminders, playSound, stopSound, SOUNDS, keepAwake, notify, askNotifyPermission, buildAlarms, buildWidget } from './reminders.js';
import { SOUND_CATS, soundLabel, DEFAULT_SOUND, isBuiltin } from './sounds.js';
import { NativeAlarm, isNative, startListening, canListen, APK_URL, checkUpdate, openApkDownload } from './native.js';
import { editPhoto, urlToDataUrl, bigGooglePhoto } from './photo.js';
import { signUp, signIn, signInGoogle, sendVerify, refreshVerified, GOOGLE_WEB_CLIENT_ID, resetPassword, backupUpload, backupDownload, getMeta, explain, checkAuthEnabled } from './cloud.js';

const nowD = new Date();
const S = { calSel: null, uid: null, user: null, d: null, view: 'dashboard', cal: { y: nowD.getFullYear(), m: nowD.getMonth() }, fin: { y: nowD.getFullYear(), m: nowD.getMonth() }, sum: { y: nowD.getFullYear(), m: nowD.getMonth(), values: true, notes: true, calendar: true, custom: null }, sheet: null, qv: { y: nowD.getFullYear(), m: nowD.getMonth() }, liv: { y: nowD.getFullYear(), m: nowD.getMonth() }, roster: null, qsel: null, open: new Set(), livf: { q: '', cat: '' }, alarm: null, auth: { tab: 'login', err: '' }, ob: { step: 0, today: true }, draft: null };
const ACCENTS = ['', '#e8e8ea', '#4d8dff', '#d4a63a', '#9bbf5a', '#e07a7a', '#c08ae6'];
const THEMES = [
  { id: 'dark', name: 'Preto', desc: 'Grafite e branco, sóbrio', bg: '#050505', sf: '#111113', ac: '#e8e8ea' },
  { id: 'obsidiana', name: 'Obsidiana', desc: 'Preto espelhado, com degradê', bg: '#030304', sf: '#1b1b22', ac: '#c9ced8' },
  { id: 'tatico', name: 'Tático azul', desc: 'Estilo do app original', bg: '#04070f', sf: '#0d1526', ac: '#3b82ff' },
  { id: 'ouro', name: 'Ouro', desc: 'Preto com dourado', bg: '#050505', sf: '#12110d', ac: '#d4a63a' },
  { id: 'oliva', name: 'Verde oliva', desc: 'Tático militar', bg: '#070906', sf: '#12170f', ac: '#9bbf5a' },
  { id: 'night', name: 'Noturno', desc: 'Vermelho, visão de madrugada', bg: '#000000', sf: '#0e0505', ac: '#ff6a55' },
  { id: 'light', name: 'Claro', desc: 'Fundo branco', bg: '#f4f4f5', sf: '#ffffff', ac: '#18181b' },
];
const THEME_BG = { dark: '#050505', obsidiana: '#030304', tatico: '#04070f', ouro: '#050505', oliva: '#070906', night: '#000000', light: '#f4f4f5' };
const VIEWS = { dashboard: ['Início', 'home'], calendar: ['Calendário', 'calendar'], plantao: ['Plantão', 'shield'], quartos: ['Quartos', 'clock'], finance: ['Finanças', 'wallet'], summary: ['Resumos', 'chat'], livro: ['Ocorrências', 'book'], more: ['Mais', 'menu'], settings: ['Ajustes', 'settings'] };
const save = () => { if (S.d) S.d.mod = Date.now(); if (S.uid && !Store.save(S.uid, S.d)) toast('Não foi possível salvar (armazenamento cheio?)', 'err'); syncAlarmsSoon(); cloudPushSoon(); if (!S.warnedFull && Store.usage().pct > 90) { S.warnedFull = true; toast('Armazenamento quase cheio: exporte um backup e apague fotos antigas', 'err'); } };
// ---- alarmes nativos (Android): reenvia a lista dos próximos 14 dias sempre que algo muda ----
let syncT = null;
function syncAlarmsSoon() { if (!isNative()) return; clearTimeout(syncT); syncT = setTimeout(syncAlarms, 900); }
async function syncAlarms() {
  if (!isNative() || !S.uid || !S.d || !S.d.onboarded) return;
  try { const list = buildAlarms(S.d, new Date(), 14); await NativeAlarm.schedule(list, { snoozeMin: S.d.prefs.snooze, ramp: S.d.prefs.ramp, autostopMin: S.d.prefs.autostop }); S.alarmSync = { n: list.length }; } catch (e) { S.alarmSync = { err: e.message || 'falha ao agendar' }; }
  try { await NativeAlarm.widget(buildWidget(S.d)); } catch { /* widget é opcional */ }
  if (S.view === 'settings') renderView();
}
// ---- nuvem: backup/restauração no Firebase (login por e-mail) ----
const devName = () => (isNative() ? 'App Android' : 'Navegador');
function cloudPayload() { const p = JSON.parse(JSON.stringify(S.d)); if (p.prefs) { delete p.prefs.cloud; delete p.prefs.pin; if (p.prefs.ai) p.prefs.ai.key = ''; } return p; }
function cloudApply(d) {
  const keep = { cloud: S.d.prefs.cloud, pin: S.d.prefs.pin, key: S.d.prefs.ai.key, auto: S.d.prefs.cloudAuto, bio: S.d.prefs.bio }; const b = defaultData();
  S.d = { ...b, ...d, profile: { ...b.profile, ...d.profile }, scale: { ...b.scale, ...d.scale }, money: { ...b.money, ...d.money }, prefs: { ...b.prefs, ...d.prefs, ai: { ...b.prefs.ai, ...(d.prefs || {}).ai, key: keep.key } }, quarters: Array.isArray(d.quarters) && d.quarters.length ? d.quarters : b.quarters, posts: Array.isArray(d.posts) ? d.posts : b.posts, holidays: d.holidays || [], customSounds: [], onboarded: true };
  S.d.prefs.cloud = keep.cloud; S.d.prefs.cloudAuto = keep.auto; if (keep.pin) S.d.prefs.pin = keep.pin; if (keep.bio) S.d.prefs.bio = keep.bio;
}
const G_ICON = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
async function ensureVerified(c) { if (c.verified === true || c.google) return true; try { await refreshVerified(c); Store.save(S.uid, S.d); } catch { /* sem rede */ } return c.verified === true; }
const NEED_VERIFY = 'Confirme seu e-mail para usar o backup: abra o e-mail que enviamos e toque no link.';
// Login com Google (só no app Android). Devolve a sessão da nuvem ou null.
async function googleLogin() {
  if (!isNative()) { toast('O login com Google funciona no app Android', 'err'); return null; }
  if (!GOOGLE_WEB_CLIENT_ID) { toast('Login com Google ainda não configurado (veja o guia da nuvem)', 'err'); return null; }
  try {
    toast('Abrindo o Google…'); const g = await NativeAlarm.googleSignIn(GOOGLE_WEB_CLIENT_ID); const s = await signInGoogle(g.idToken);
    s.email = (s.email || g.email || '').toLowerCase(); s.name = s.name || g.name || ''; s.photo = s.photo || g.photo || ''; return s;
  } catch (e) { const m = String((e && e.message) || e); if (/cancel/i.test(m)) return null; toast(/falha|config|credential|No credentials/i.test(m) ? 'Não deu para entrar com o Google: ' + m.slice(0, 120) : explain(e), 'err'); return null; }
}
// Depois de entrar na nuvem (e-mail ou Google): guarda a sessão e sincroniza com o backup existente
async function adoptGooglePhoto(s) {
  if (!s || !s.photo || S.d.profile.photo) return;
  const big = bigGooglePhoto(s.photo); const data = await urlToDataUrl(big); S.d.profile.photo = data || big; save(); render();
}
async function afterCloudLogin(s) {
  adoptGooglePhoto(s);
  S.d.prefs.cloud = s; S.d.prefs.cloudAuto = S.d.prefs.cloudAuto !== false; Store.save(S.uid, S.d);
  if (!(await ensureVerified(s))) { renderView(); toast('Conta criada. ' + NEED_VERIFY); return; }
  const meta = await getMeta(s);
  if (!meta) await cloudUpload();
  else if (meta.updatedAt > (S.d.mod || 0)) { renderView(); await cloudRestore(); }
  else if (await ask('A nuvem já tem um backup mais antigo. Enviar os dados deste aparelho e substituir?', 'Enviar')) await cloudUpload();
  renderView(); toast('Conectado à nuvem ✅');
}
let cloudT = null;
function cloudPushSoon() { const c = S.d && S.d.prefs && S.d.prefs.cloud; if (!c || S.d.prefs.cloudAuto === false) return; clearTimeout(cloudT); cloudT = setTimeout(() => cloudUpload(true), 25000); }
async function cloudUpload(silent = false) {
  const c = S.d && S.d.prefs.cloud; if (!c || S.cloudBusy) return; S.cloudBusy = true;
  try { if (!(await ensureVerified(c))) throw new Error(NEED_VERIFY); const r = await backupUpload(c, cloudPayload(), { updatedAt: S.d.mod || Date.now(), device: devName() }); S.d.prefs.cloudAt = S.d.mod || Date.now(); S.cloudErr = ''; Store.save(S.uid, S.d); if (!silent) toast(`Backup enviado ✅ (${r.chunks} parte${r.chunks > 1 ? 's' : ''})`); }
  catch (e) { S.cloudErr = e.message === NEED_VERIFY ? NEED_VERIFY : explain(e); if (!silent || !S.cloudWarned) { S.cloudWarned = true; toast(S.cloudErr, 'err'); } }
  S.cloudBusy = false; if (S.view === 'settings') renderView();
}
async function cloudRestore() {
  const c = S.d.prefs.cloud;
  try {
    if (!(await ensureVerified(c))) return toast(NEED_VERIFY, 'err');
    const r = await backupDownload(c); if (!r) return toast('Ainda não há backup na nuvem.', 'err');
    const n = (r.payload.events || []).length; const when = new Date(r.meta.updatedAt).toLocaleString('pt-BR');
    if (!(await ask(`Trocar os dados deste aparelho pelo backup de ${when} (${n} lançamentos, enviado por ${r.meta.device || 'outro aparelho'})?`, 'Restaurar'))) return;
    cloudApply(r.payload); S.d.mod = r.meta.updatedAt; S.d.prefs.cloudAt = r.meta.updatedAt; Store.save(S.uid, S.d); render(); syncAlarmsSoon(); toast('Dados restaurados ✅');
  } catch (e) { toast(explain(e), 'err'); }
}
async function loadBio() { if (!isNative()) return; try { const r = await NativeAlarm.bioStatus(); S.bioOk = !!(r && r.available); } catch { S.bioOk = false; } if (S.view === 'settings') renderView(); }
async function runUpdateCheck(manual) {
  S.upd = { busy: true }; if (S.view === 'settings') renderView();
  try { const u = await checkUpdate(); S.upd = { ...u, at: Date.now() }; if (u.newer) toast('Nova versão 1.0.' + u.latest + ' disponível (Ajustes → Atualização)'); else if (manual) toast(u.installed ? 'Você já está na versão mais recente' : 'Versão mais recente: 1.0.' + u.latest); }
  catch (e) { S.upd = { err: e.message || 'Sem conexão', at: Date.now() }; if (manual) toast('Não consegui verificar: ' + S.upd.err); }
  if (S.view === 'settings') renderView();
}
async function loadAlarmStatus() { if (!isNative()) return; try { S.alarmStatus = await NativeAlarm.status(); } catch { S.alarmStatus = null; } if (S.view === 'settings') renderView(); }
const typeColor = (t) => C.TYPES[t].color;
const tint = (c, p = 18) => `color-mix(in srgb,${c} ${p}%,transparent)`;

const avatarHtml = (p) => (p.photo ? `<img src="${p.photo}" alt="Foto de ${esc(p.name || 'perfil')}">` : esc(initials(p.name)));
function applyTheme() {
  const p = S.d?.prefs || { theme: 'dark', accent: '' }; let th = p.theme;
  if (th === 'auto') th = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  if (!THEME_BG[th]) th = 'dark';
  const el = document.documentElement; el.dataset.theme = th; el.dataset.layout = p.layout === 'classico' ? 'classico' : 'moderno';
  if (p.accent && th !== 'night') { el.style.setProperty('--accent', p.accent); el.style.setProperty('--on', '#0a0a0a'); } else { el.style.removeProperty('--accent'); el.style.removeProperty('--on'); }
  el.style.zoom = p.zoom && p.zoom !== 1 ? String(p.zoom) : '';
  C.PRIV.on = !!p.discreet;
  $('meta[name=theme-color]')?.setAttribute('content', THEME_BG[th]);
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
    case 'posto': return `${e.from ? e.from + (e.to ? '–' + e.to : '') + ' · ' : 'Dia · '}${postoLabel(e)}`;
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
const evRow = (e, actions = true) => `<div class="item"><div class="ico" style="background:${tint(typeColor(e.type))};color:${typeColor(e.type)}">${ic(C.TYPES[e.type].icon)}</div><div class="sp" style="min-width:0"><div class="t">${esc(evTitle(e))}</div>${evSub(e) ? `<div class="s">${esc(evSub(e))}</div>` : ''}${e.type === 'obs' && e.note.length > 60 ? `<div class="s">${esc(e.note)}</div>` : ''}</div>${((e.photos && e.photos[0]) || e.photo) ? `<img class="thumb" src="${(e.photos && e.photos[0]) || e.photo}" alt="">` : ''}${actions ? `<button class="ibtn" data-act="ev-edit" data-id="${e.id}" aria-label="Editar">${ic('edit')}</button>` : ''}</div>`;

// ---------- AUTH / ONBOARDING ----------
const authView = () => {
  const a = S.auth; const reg = a.tab === 'register';
  return `<div class="auth"><div class="pitch"><div class="brand"><div class="logo">${ic('shield')}</div>Sentinela Tático</div>
  <h1>Sua escala de plantão,<br><span style="color:var(--accent)">sob controle.</span></h1><p>Calendário tático para quem trabalha em escala de plantão: escala 24x72 pronta, extras, permutas, folgas, atestados e resumos para o WhatsApp — com assistente de voz.</p>
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
  ${isNative() ? `<button class="btn blk" data-act="google-entry" style="margin-bottom:12px">${G_ICON}Continuar com o Google</button>` : ''}<div class="row" style="margin:16px 0;color:var(--muted)"><hr class="sp" style="border:0;border-top:1px solid var(--line)"><span class="xs">ou</span><hr class="sp" style="border:0;border-top:1px solid var(--line)"></div>
  <button class="btn blk" data-act="guest">${ic('target')}Entrar sem cadastro (já configurado em 24x72)</button>
  <p class="muted xs" style="margin:14px 0 0;text-align:center">Seus dados ficam salvos <b>somente neste aparelho</b>. Use Ajustes → Backup para levar para outro celular.</p></div></div>`;
};

const OB_TITLES = ['Seu perfil', 'Sua escala', 'Valores e postos', 'Tudo pronto'];
function onboardView() {
  const d = S.d, st = S.ob.step; const sc = d.scale;
  const steps = `<div class="ob-steps">${OB_TITLES.map((_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (st === 0) body = `<h2>Bem-vindo 👋</h2><p class="muted">Vamos deixar tudo pronto em menos de um minuto.</p>
   <label class="f">Nome<input data-bind="profile.name" value="${esc(d.profile.name)}" placeholder="Como quer ser chamado"></label>
   <label class="f">Cargo<input data-bind="profile.rank" value="${esc(d.profile.rank)}"></label>
   <label class="f">Como seu nome aparece nas escalas de quartos<input data-bind="profile.alias" value="${esc(d.profile.alias)}" placeholder="Ex.: Lucas, PP Silva (separe por vírgula)"></label>
   <div class="grid2"><label class="f">Matrícula (opcional)<input data-bind="profile.matricula" value="${esc(d.profile.matricula)}"></label><label class="f">Unidade (opcional)<input data-bind="profile.unit" value="${esc(d.profile.unit)}" placeholder="Ex.: Penitenciária X"></label></div>`;
  if (st === 1) body = `<h2>Qual é a sua escala?</h2>${scaleEditor(true)}`;
  if (st === 2) body = `<h2>Valores e postos</h2><p class="muted">Valor de cada extra (você pode mudar em cada lançamento) e os postos da sua unidade.</p>${moneyFields()}<label class="f">Postos da sua unidade (um por linha)<textarea data-posts rows="4">${esc(d.posts.join('\n'))}</textarea></label>`;
  if (st === 3) { const up = C.upcoming(d, 4); body = `<h2>Pronto, ${esc(d.profile.name.split(' ')[0] || 'tudo certo')}! ✅</h2><p class="muted">Sua escala ${C.scaleLabel(sc)} está configurada.</p><div class="list">${up.map((x) => `<div class="item"><div class="ico" style="background:${tint('var(--accent)', 22)};color:var(--accent)">${ic('shield')}</div><div class="sp"><div class="t">${C.dateLong(x.date)}</div><div class="s">${C.relDays(x.date)} · início ${sc.start}</div></div></div>`).join('')}</div>`; }
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
const moneyFields = () => `<div class="grid2"><label class="f">Diurna 12h<input type="number" step="0.01" min="0" inputmode="decimal" data-bind="money.diurna" data-num value="${S.d.money.diurna}"></label><label class="f">Noturna 12h<input type="number" step="0.01" min="0" inputmode="decimal" data-bind="money.noturna" data-num value="${S.d.money.noturna}"></label></div>`;

// ---------- SHELL ----------
function shell() {
  const [title] = VIEWS[S.view]; const p = S.d.profile; const moreSet = ['more', 'plantao', 'finance', 'summary', 'livro', 'settings'];
  const classic = S.d.prefs.layout === 'classico'; const onDuty = C.dutyNow(S.d, new Date()).on;
  const topHtml = classic ? `<header class="top ctop"><div class="clogo">${ic('shield')}</div><div class="sp ctit"><div class="cname">SENTINELA <span>TÁTICO</span></div><div class="csub"><i></i>OPERACIONAL · ${esc(title.toUpperCase())}</div></div><button class="cpill ${onDuty ? 'on' : ''}" data-act="go" data-v="settings" aria-label="Ajustes"><i></i>${onDuty ? 'EM SERVIÇO' : 'ATIVO'}</button></header>` : null;
  const nav = (k) => `<button class="nav ${S.view === k ? 'on' : ''}" data-act="go" data-v="${k}">${ic(VIEWS[k][1])}${VIEWS[k][0]}</button>`;
  const tab = (k, on = S.view === k) => `<button class="tab ${on ? 'on' : ''}" data-act="go" data-v="${k}">${ic(VIEWS[k][1])}${VIEWS[k][0]}</button>`;
  return `<div class="shell"><aside class="side"><div class="brand" style="margin:4px 8px 22px"><div class="logo">${ic('shield')}</div>Sentinela</div>${['dashboard', 'plantao', 'calendar', 'quartos', 'finance', 'summary', 'livro'].map(nav).join('')}<button class="nav" data-act="ai">${ic('sparkles')}Assistente IA</button><span class="sp"></span>${nav('settings')}
   <div class="item" style="margin-top:8px"><div class="avatar" style="width:38px;height:38px;border-radius:12px;font-size:13px">${avatarHtml(p)}</div><div class="sp" style="min-width:0"><div class="t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name || 'Meu perfil')}</div><div class="s">${C.scaleLabel(S.d.scale)}</div></div><button class="ibtn" style="width:34px;height:34px" data-act="logout" title="Sair">${ic('logout')}</button></div></aside>
   <main class="main">${topHtml || `<header class="top"><div class="sp"><div class="muted sm">${S.view === 'dashboard' ? greet() + ',' : 'Sentinela Tático'}</div><h1>${S.view === 'dashboard' ? esc((p.name || 'Olá').split(' ')[0]) : title}</h1></div><button class="avatar" data-act="go" data-v="settings" aria-label="Ajustes">${avatarHtml(p)}</button></header>`}<section class="view" id="view"></section></main></div>
   <nav class="tabbar" aria-label="Navegação">${tab('dashboard')}${tab('calendar')}<button class="fab" data-act="ai" aria-label="Assistente IA">${ic('sparkles')}</button>${tab('quartos')}${tab('more', moreSet.includes(S.view))}</nav><button class="fab desk" data-act="ai" aria-label="Assistente IA">${ic('sparkles')}</button>`;
}

// ---------- DASHBOARD ----------
function dashboard() {
  const classic = S.d.prefs.layout === 'classico';
  const d = S.d, now = new Date(), t = C.today(); const sc = d.scale; const ms = C.monthSummary(d, now.getFullYear(), now.getMonth());
  const du = C.dutyNow(d, now); const info = C.dayInfo(t, d); const ns = C.nextShift(d, now);
  let pill, h, sub = '', extra = '';
  if (du.on) {
    const pct = Math.min(100, ((now - du.start) / (du.end - du.start)) * 100); const sameDay = C.iso(du.end) === t;
    pill = 'EM SERVIÇO'; h = 'Você está de plantão'; sub = `Termina ${sameDay ? 'hoje' : 'amanhã'} às ${String(du.end.getHours()).padStart(2, '0')}:${String(du.end.getMinutes()).padStart(2, '0')} · faltam ${fmtDur(du.end - now)}`;
    extra = `<div class="bar"><i style="width:${pct}%"></i></div>`;
  } else if (ns && !ns.started && ns.info.date === t) {
    pill = 'PLANTÃO HOJE'; h = `Entrada às ${sc.start}`; sub = `Começa em ${fmtDur(ns.start - now)}`;
  } else {
    pill = info.status === 'livre' ? 'FOLGA' : C.STATUS[info.status].label.toUpperCase();
    h = { livre: 'De folga', folga: 'Folga abonada', atestado: 'Afastado (atestado)', ferias: 'De férias', permuta_out: 'Plantão repassado' }[info.status] || 'De folga';
    sub = ns ? `Próximo plantão: ${C.dateLong(ns.info.date)} · ${C.relDays(ns.info.date)}` : 'Sem plantões futuros calculados';
  }
  const c = C.cycleLen(sc); const pos = ((C.diffDays(t, sc.anchor) % c) + c) % c; const hol = C.holidayName(t, d.holidays);
  const qDate = du.on ? C.iso(du.start) : (ns ? ns.info.date : t); const qs = C.quartosOn(d, qDate); const nq = C.nextQuarto(d, now);
  const nextLine = nq ? `<div class="nextq"><div><div class="muted xs">${nq.active ? 'Quarto atual' : 'Próximo quarto'}${nq.ev.date !== t ? ' · ' + C.WD3[C.weekday(nq.ev.date)] + ' ' + C.fmtShort(nq.ev.date) : ''}</div><div class="big">${C.qLabel(nq.q)}${nq.ev.post ? ' · ' + esc(nq.ev.post) : ''}</div></div><div class="when">${nq.active ? 'agora' : 'em ' + fmtDur(nq.start - now)}</div></div>` : '';
  const qg = qGroups(qDate); const nextSlot = nq && nq.ev.date === qDate ? nq.ev.slot : '';
  const qgrid = qg.length ? `<div class="qmini">${qg.map((g) => { const q = d.quarters.find((x) => x.id === g.slot); const st = g.slot === nextSlot ? (nq.active ? 'act' : 'nxt') : ''; return `<span class="qm ${st}"><b>${q ? esc(q.alvorada ? 'Alvorada' : C.qLabel(q)) : esc(g.slot)}</b><small>${g.posts.length ? esc(g.posts.join(' · ')) : '—'}</small></span>`; }).join('')}</div>${nextSlot ? `<div class="muted xs" style="margin-top:2px">${nq.active ? 'Quarto em andamento' : 'Próximo em ' + fmtDur(nq.start - now)}</div>` : ''}` : '';
  const pills = qs.map((e) => { const q = d.quarters.find((x) => x.id === e.slot); return `<span class="qp">${q ? C.qLabel(q) : e.slot}${e.post ? ' · ' + esc(e.post) : ''}</span>`; }).join('');
  const up = C.upcoming(d, 3, t);
  const hm = (x) => `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
  const nx = du.on ? up.find((x) => x.date > C.iso(du.start)) : null; const nsd = du.on ? (nx && { info: { date: nx.date } }) : ns;
  const nextTile = nsd ? `<button class="tile" data-act="day" data-date="${nsd.info.date}"><span class="tl">Próximo plantão</span><span class="tv">${+nsd.info.date.slice(8)} ${C.MONTHS[+nsd.info.date.slice(5, 7) - 1].slice(0, 3).toLowerCase()}</span><span class="ts">${C.WD3[C.weekday(nsd.info.date)]} · ${C.relDays(nsd.info.date)}</span></button>` : '<div class="tile"><span class="tl">Próximo plantão</span><span class="tv">—</span><span class="ts">sem plantões</span></div>';
  const istyle = infoStyle();
  let plainQ = '';
  if (istyle !== 'cartoes') {
    let items = dayItems(qDate); let eta = '';
    if (nq && qs.length) eta = nq.active ? '' : 'em ' + fmtDur(nq.start - now);
    if (!items.length && nq) items = [{ k: 'night', slot: nq.ev.slot, post: nq.ev.post || 'Sem posto', time: C.qLabel(d.quarters.find((x) => x.id === nq.ev.slot) || { start: '', end: '' }), note: `${C.WD3[C.weekday(nq.ev.date)]} ${C.fmtShort(nq.ev.date)}` }];
    const ctx2 = { nextSlot: nq && (nq.ev.date === qDate || !qs.length) ? nq.ev.slot : '', active: nq && nq.active, eta: nq ? 'em ' + fmtDur(nq.start - now) : '' };
    plainQ = `<div class="iblk"><div class="row"><div class="sp"><div class="b">Postos e quartos</div><div class="muted xs">${items.length ? (qs.length || diaResumo(qDate) ? C.dateLong(qDate) : 'Nenhum neste plantão') : ''}</div></div><button class="ibtn" data-act="roster-open" data-date="${qDate}" aria-label="Foto da escala">${ic('camera')}</button><button class="ibtn" data-act="q-open" data-date="${qDate}" aria-label="Editar">${ic('edit')}</button></div>${items.length ? renderItems(items, istyle, ctx2) : `<button class="btn sm blk" data-act="q-open" data-date="${qDate}">${ic('plus')}Marcar meus quartos</button>`}</div>`;
  }
  const hm0 = d.prefs.home || {}; const showEx = hm0.extras !== false, showQ = hm0.quartos !== false, showUp = hm0.proximos !== false, showNum = hm0.numeros === true;
  return `<div class="hero ${du.on ? 'on' : ''}"><span class="pill"><span class="dot"></span>${pill}</span><h2>${h}</h2><div class="muted">${sub}</div>${extra}<div class="muted xs" style="margin-top:14px">Escala ${C.scaleLabel(sc)} · dia ${pos + 1} de ${c}${hol ? ` · Feriado: ${esc(hol)}` : ''}</div>${du.on ? `<button class="ibtn hero-go" data-act="go" data-v="plantao" aria-label="Abrir Modo Plantão">${ic('shield')}</button>` : ''}</div>
  <div class="tiles ${showEx ? '' : 'one'}">${nextTile}${showEx ? `<button class="tile" data-act="go" data-v="finance"><span class="tl">Extras do mês</span><span class="tv">${C.brl(ms.extrasTotal)}</span><span class="ts">${ms.extrasPending > 0 ? C.brl(ms.extrasPending) + ' a receber' : ms.extras.length + ' extra(s)'}</span></button>` : ''}</div>
  ${classic ? `<button class="item crep" data-act="go" data-v="summary"><div class="ico">${ic('chat')}</div><div class="sp"><div class="t">Exportar relatório</div><div class="s">WHATSAPP / RESUMO DO MÊS</div></div>${ic('chevR')}</button>` : ''}
  ${!showQ ? '' : (infoStyle() === 'cartoes' ? `<div class="card col" style="gap:12px"><div class="row"><div class="sp"><div class="b">Postos e quartos</div><div class="muted xs">${diaResumo(qDate) ? 'Dia: <b>' + esc(diaResumo(qDate)) + '</b>' : (qs.length ? C.dateLong(qDate) : (nq ? 'Nenhum neste plantão' : ''))}</div></div><button class="ibtn" data-act="roster-open" data-date="${qDate}" aria-label="Foto da escala">${ic('camera')}</button><button class="ibtn" data-act="q-open" data-date="${qDate}" aria-label="Editar quartos">${ic('edit')}</button></div>${qgrid || nextLine || `<button class="btn sm blk" data-act="q-open" data-date="${qDate}">${ic('plus')}Marcar meus quartos</button>`}</div>` : plainQ)}
  ${!showUp ? '' : (istyle === 'cartoes' ? `<div class="col" style="gap:6px"><span class="muted xs" style="font-weight:700">Próximos plantões</span><div class="nxs">${up.map((x) => `<button data-act="day" data-date="${x.date}"><b>${C.WD3[C.weekday(x.date)]} ${+x.date.slice(8)}</b><small>${C.relDays(x.date)}</small></button>`).join('')}</div></div>` : `<div class="nxl"><span>Próximos plantões</span>${up.map((x) => `<button data-act="day" data-date="${x.date}">${C.WD3[C.weekday(x.date)]} ${+x.date.slice(8)}<small> ${C.relDays(x.date)}</small></button>`).join('')}</div>`)}
  ${!showNum ? '' : `<div class="card col" style="gap:10px"><div class="b">${C.MONTHS[now.getMonth()]} em números</div><div class="trio"><div><b>${ms.plantoes.length + ms.permutaIn.length}</b><span>plantões</span></div><div><b>${ms.extras.length}</b><span>extras</span></div><div><b>${ms.permutas.length}</b><span>permutas</span></div></div></div>`}`;
}
function plantaoView() {
  const d = S.d, now = new Date(), t = C.today(); const du = C.dutyNow(d, now); const nq = C.nextQuarto(d, now); const ns = C.nextShift(d, now);
  const qd = du.on ? C.iso(du.start) : (ns ? ns.info.date : t); const qs = C.quartosOn(d, qd); const pct = du.on ? Math.min(100, ((now - du.start) / (du.end - du.start)) * 100) : 0;
  const hhmm = (x) => `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
  const pills = qs.map((e) => { const q = d.quarters.find((x) => x.id === e.slot); return `<span class="qp">${q ? C.qLabel(q) : e.slot}${e.post ? ' · ' + esc(e.post) : ''}</span>`; }).join('');
  const btn = (act, icn, label, extra = '') => `<button class="pbtn" data-act="${act}" ${extra}>${ic(icn)}<span>${label}</span></button>`;
  return `<div class="card col" style="text-align:center;gap:8px"><div class="clock" id="plClock">${now.toTimeString().slice(0, 8)}</div><div class="muted">${C.dateLong(t)}</div>${du.on ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="muted sm">Em serviço · termina às ${hhmm(du.end)} · faltam ${fmtDur(du.end - now)}</div>` : `<div class="muted sm">Fora de serviço${ns ? ` · próximo plantão ${C.relDays(ns.info.date)}` : ''}</div>`}</div>
  ${nq ? `<div class="nextq"><div><div class="muted xs">${nq.active ? 'Quarto atual' : 'Próximo quarto'}</div><div class="big">${C.qLabel(nq.q)}${nq.ev.post ? ' · ' + esc(nq.ev.post) : ''}</div></div><div class="when">${nq.active ? 'agora' : 'em ' + fmtDur(nq.start - now)}</div></div>` : '<div class="card empty">Nenhum quarto marcado para este plantão.</div>'}
  ${pills ? `<div class="qp-list">${pills}</div>` : ''}
  <div class="pbtns">${btn('ev-new', 'book', 'Ocorrência', `data-t="ocorrencia" data-date="${t}"`)}${btn('q-open', 'clock', 'Quartos', `data-date="${qd}"`)}${btn('ev-new', 'coins', 'Extra', `data-t="extra" data-date="${t}"`)}${btn('roster-open', 'camera', 'Foto da escala', `data-date="${qd}"`)}</div>`;
}
function chart() {
  const now = new Date(); const pts = [];
  for (let i = 5; i >= 0; i--) { const dt = new Date(now.getFullYear(), now.getMonth() - i, 1); pts.push({ l: C.MONTHS[dt.getMonth()].slice(0, 3), v: C.monthSummary(S.d, dt.getFullYear(), dt.getMonth()).extrasTotal }); }
  const max = Math.max(...pts.map((p) => p.v), 1); const w = 300, h = 130, bw = 30, gap = (w - bw * 6) / 7;
  if (pts.every((p) => !p.v)) return `<div class="empty">Nenhuma extra registrada ainda.<br><span class="xs">Cadastre extras para acompanhar sua evolução.</span></div>`;
  return `<svg class="chartbars" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Extras por mês">${pts.map((p, i) => { const bh = Math.max(3, (p.v / max) * 82); const x = gap + i * (bw + gap); const last = i === 5; return `<rect x="${x}" y="${100 - bh}" width="${bw}" height="${bh}" rx="8" fill="${last ? 'var(--accent)' : 'var(--ok)'}" opacity="${last ? 1 : .55}"/><text x="${x + bw / 2}" y="${94 - bh}" text-anchor="middle">${C.PRIV.on ? '' : p.v ? (p.v >= 1000 ? (p.v / 1000).toFixed(1).replace('.', ',') + 'k' : Math.round(p.v)) : ''}</text><text x="${x + bw / 2}" y="118" text-anchor="middle">${p.l}</text>`; }).join('')}</svg>`;
}

// ---------- QUARTOS DE HORA ----------
function qEditor(date, opts = {}) {
  const by = Object.fromEntries(qGroups(date).map((g) => [g.slot, g])); const n = Object.keys(by).length; const act = activePost(); const main = postoDia(date); const timed = postosDia(date).filter((x) => x.from).sort((x, y) => x.from.localeCompare(y.from));
  const open = opts.onlyNight ? 'night' : (S.qopen === undefined ? 'night' : S.qopen); const nps = nightPosts(); const roles = S.d.dayPosts || [];
  const chip = (on, act2, v, label, extra = '') => `<button type="button" class="chip ${on ? 'on' : ''}" data-act="${act2}" data-v="${esc(v)}" ${extra}>${esc(label)}</button>`;
  const whereChips = (cur, act2) => `<div class="muted xs" style="margin:10px 0 6px">Em qual bloco?</div><div class="pgrid3">${whereOpts().map((w) => chip(cur === w, act2, w, w)).join('')}</div>`;
  const sec = (k, title, sum, body) => `<div class="qd ${open === k ? 'open' : ''}"><button type="button" class="qdh" data-act="qd-open" data-v="${k}"><b>${title}</b><span class="muted xs sp">${esc(sum)}</span>${ic('chevR', 'chv')}</button>${open === k ? `<div class="qdb">${body}</div>` : ''}</div>`;
  const td = S.tdraft || {};
  const tform = S.tadd ? `<div class="tform"><div class="muted xs" style="margin-bottom:6px">Posto neste horário</div><div class="pgrid3">${roles.map((r) => chip(td.post === r, 'dp-trole', r, r)).join('')}</div>${td.post && needsWhere(td.post) ? whereChips(td.where, 'dp-twhere') : ''}<div class="grid2" style="margin-top:10px"><label class="f">Das<input type="time" data-tf="from" value="${td.from || ''}"></label><label class="f">Até (opcional)<input type="time" data-tf="to" value="${td.to || ''}"></label></div><div class="row" style="margin-top:8px"><button type="button" class="btn sm sp" data-act="dp-tcancel">Cancelar</button><button type="button" class="btn sm pri sp" data-act="dp-tsave">Adicionar</button></div></div>` : `<button type="button" class="link" style="margin-top:10px" data-act="dp-tadd">+ Horário específico (ex.: escalado para a guarita às 14h)</button>`;
  const dayBody = `<div class="pgrid3">${roles.map((r) => chip(main && main.post === r, 'dp-main', r, r, `data-date="${date}"`)).join('')}</div>${main && needsWhere(main.post) ? whereChips(main.where, 'dp-where') : ''}${timed.length ? `<div class="col" style="gap:6px;margin-top:12px">${timed.map((x) => `<div class="mini"><i style="background:${C.TYPES.posto.color}"></i><span class="sp">${esc(x.from)}${x.to ? '–' + esc(x.to) : ''} · ${esc(postoLabel(x))}</span><button type="button" class="ibtn" data-act="dp-tdel" data-id="${x.id}" aria-label="Remover">${ic('trash')}</button></div>`).join('')}</div>` : ''}${tform}`;
  const grid = `<div class="qgrid">${S.d.quarters.map((q) => { const e = by[q.id]; return `<button class="qchip ${e ? 'on' : ''}" data-act="q-slot" data-date="${date}" data-q="${q.id}" aria-pressed="${!!e}"><b>${esc(q.alvorada ? 'Alvorada' : C.qLabel(q))}</b><small>${e ? (e.posts.length ? esc(e.posts.join(' · ')) : '✓') : q.alvorada ? C.qLabel(q) : '&nbsp;'}</small></button>`; }).join('')}</div>`;
  const nightBody = `${nps.length ? `<div class="muted xs" style="margin-bottom:8px">Escolha o posto e toque nos horários dele. Escolha outro posto e toque de novo: um horário pode ter mais de um posto. Tocar no mesmo posto desmarca.</div><div class="pgrid3">${nps.map((p) => { const cnt = Object.values(by).filter((g) => g.posts.includes(p)).length; return chip(act === p, 'q-setpost', p, cnt ? `${p} · ${cnt}` : p).replace(`data-v="${esc(p)}"`, `data-v="${esc(p)}"`); }).join('')}${chip(act === '', 'q-setpost', '', 'Sem posto')}</div>` : ''}<div class="row" style="margin:12px 0 6px"><span class="muted xs sp">${n ? n + ' marcado(s)' : 'Nenhum marcado'}</span><span class="qt"><button data-act="q-all" data-date="${date}">Todos</button><button data-act="q-none" data-date="${date}">Limpar</button></span></div>${grid}${nps.length ? `<button class="link" style="margin-top:10px" data-act="q-posts">Editar lista de postos</button>` : ''}`;
  const night = sec('night', 'À noite · quartos de hora', n ? n + ' marcado(s)' : 'a partir das 18h', nightBody);
  return opts.onlyNight ? night : sec('day', 'Durante o dia', diaResumo(date) || 'toque para escolher', dayBody) + night;
}
function quartosSheet(date) {
  const back = S.sheet && S.sheet.back;
  return `<div class="grab"></div><div class="row">${back ? `<button class="ibtn" data-act="q-back" aria-label="Voltar">${ic('chevL')}</button>` : ''}<div class="sp"><div class="muted sm">${C.relDays(date)}</div><h3>Postos · ${C.dateLong(date)}</h3></div><button class="ibtn" data-act="close">${ic('x')}</button></div><div class="col" style="margin-top:14px">${qEditor(date)}<button class="btn blk" data-act="roster-open" data-date="${date}">${ic('camera')}Ler de uma foto da escala</button></div>`;
}
function quartosView() {
  const { y, m } = S.qv; const t = C.today(); const key = C.ymKey(y, m);
  const all = C.monthDays(y, m).map((dt) => C.dayInfo(dt, S.d)).filter((i) => i.works || C.quartosOn(S.d, i.date).length);
  const hidden = all.filter((i) => i.date < t && !C.quartosOn(S.d, i.date).length).length; const days = S.qv.all ? all : all.filter((i) => i.date >= t || C.quartosOn(S.d, i.date).length);
  const total = new Set(S.d.events.filter((e) => e.type === 'quarto' && e.date.startsWith(key)).map((e) => e.date + e.slot)).size;
  const rows = days.map((i) => {
    const qs = C.quartosOn(S.d, i.date); const pills = qGroups(i.date).map((g) => { const q = S.d.quarters.find((x) => x.id === g.slot); return `<span class="qp">${q ? C.qLabel(q) : g.slot}${g.posts.length ? ' · ' + esc(g.posts.join(' + ')) : ''}</span>`; }).join('');
    return `<button class="drow ${i.date < t ? 'past' : ''}" ${i.date === t ? 'id="qtoday"' : ''} data-act="q-open" data-date="${i.date}"><div class="dd"><b>${+i.date.slice(8)}</b><span>${C.WD3[C.weekday(i.date)]}</span></div><div class="sp" style="min-width:0">${pills ? (infoStyle() === 'cartoes' ? `<div class="qp-list">${pills}</div>` : `<div class="qtxt">${dayItems(i.date).map((x) => `<span><b>${esc(x.post)}</b> ${esc(x.time)}</span>`).join('')}</div>`) : '<span class="muted sm">Marcar quartos</span>'}</div>${ic('chevR')}</button>`;
  }).join('');
  return `<div class="calhead"><button class="ibtn" data-act="qv-prev" aria-label="Mês anterior">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[m]} <span class="muted" style="font-weight:600">${y}</span></h2><button class="ibtn" data-act="roster-open" data-date="${days.find((i) => i.date >= t)?.date || t}" aria-label="Foto da escala">${ic('camera')}</button><button class="ibtn" data-act="qv-next" aria-label="Próximo mês">${ic('chevR')}</button></div>
  <div class="muted sm" style="margin:-4px 4px 0">${total} quarto(s) marcado(s) neste mês</div><div class="list">${rows || '<div class="card empty">Nenhum plantão a partir de hoje neste mês.</div>'}</div>${hidden ? `<button class="btn sm blk" data-act="qv-all">${S.qv.all ? 'Ocultar dias anteriores sem quartos' : `Mostrar ${hidden} dia(s) anterior(es) sem quartos`}</button>` : ''}`;
}
const OC_COLOR = { Rotina: '#8b8b92', 'Segurança': '#d4a24c', Disciplinar: '#d96b6b', 'Saúde': '#66c08a', Visita: '#7aa8cf', Outros: '#74b9c9' };
const ocRow = (e) => {
  const ph = e.photos || (e.photo ? [e.photo] : []); const col = OC_COLOR[e.cat] || '#8b8b92';
  const pc = e.prio === 'Urgente' ? '#d96b6b' : e.prio === 'Atenção' ? '#d4a24c' : ''; return `<div class="oc" ${pc ? `style="border-left:3px solid ${pc}"` : ''} role="button" tabindex="0" data-act="ev-edit" data-id="${e.id}"><div class="row"><span class="badge" style="background:${tint(col, 22)};color:${col}">${esc(e.cat || 'Rotina')}</span>${e.prio && e.prio !== 'Normal' ? `<span class="badge" style="background:${tint(pc, 22)};color:${pc}">${e.prio}</span>` : ''}<span class="muted xs sp" style="text-align:right">${e.time ? esc(e.time) : ''}</span></div><div class="t">${esc(e.title || 'Ocorrência')}</div>${e.place ? `<div class="s">${esc(e.place)}</div>` : ''}${e.note ? `<div class="s clamp">${esc(e.note)}</div>` : ''}${ph.length ? `<div class="ths">${ph.slice(0, 4).map((u) => `<img src="${u}" alt="">`).join('')}</div>` : ''}</div>`;
};
function livList() {
  const { y, m } = S.liv; const key = C.ymKey(y, m); const q = S.livf.q.trim().toLowerCase();
  const list = S.d.events.filter((e) => e.type === 'ocorrencia' && e.date.startsWith(key) && (!S.livf.cat || (e.cat || 'Rotina') === S.livf.cat) && (!q || [e.title, e.note, e.place, e.people].join(' ').toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
  let last = ''; const rows = list.map((e) => { const h = e.date !== last ? `<div class="h2">${C.dateLong(e.date)}</div>` : ''; last = e.date; return h + ocRow(e); }).join('');
  return rows || `<div class="card empty">${q || S.livf.cat ? 'Nada encontrado com esse filtro.' : 'Nenhuma ocorrência neste mês.<br><span class="xs">Registre fatos do plantão com hora, local e fotos.</span>'}</div>`;
}
function livroView() {
  const { y, m } = S.liv;
  return `<div class="calhead"><button class="ibtn" data-act="liv-prev" aria-label="Mês anterior">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[m]} <span class="muted" style="font-weight:600">${y}</span></h2><button class="ibtn" data-act="liv-next" aria-label="Próximo mês">${ic('chevR')}</button></div>
  <button class="btn pri blk" data-act="ev-new" data-t="ocorrencia" data-date="${C.today()}">${ic('plus')}Nova ocorrência</button>
  <input id="livQ" type="search" placeholder="Buscar nas ocorrências" value="${esc(S.livf.q)}"><div class="chips"><button class="chip ${!S.livf.cat ? 'on' : ''}" data-act="liv-cat" data-v="">Todas</button>${C.OC_CATS.map((c) => `<button class="chip ${S.livf.cat === c ? 'on' : ''}" data-act="liv-cat" data-v="${c}">${c}</button>`).join('')}</div>
  <div class="list" id="livList">${livList()}</div>`;
}
function moreView() {
  const row = (v, icn, t, sub) => `<button class="item" data-act="go" data-v="${v}"><div class="ico" style="background:${tint('var(--accent)', 18)};color:var(--accent)">${ic(icn)}</div><div class="sp"><div class="t">${t}</div><div class="s">${sub}</div></div>${ic('chevR')}</button>`;
  return `<div class="list">${row('plantao', 'shield', 'Modo Plantão', 'Relógio grande, próximo quarto e atalhos')}${row('finance', 'wallet', 'Finanças', 'Extras, valores a receber e permutas')}${row('summary', 'chat', 'Resumos para WhatsApp', 'Escala, quartos e finanças do mês')}${row('livro', 'book', 'Livro de ocorrências', 'Registros com hora e foto')}${row('settings', 'settings', 'Ajustes', 'Escala, quartos, postos, alarmes, IA e conta')}</div>`;
}

// ---------- CALENDÁRIO ----------
function daySummary(date) {
  if (!date) return '';
  const d = S.d; const i = C.dayInfo(date, d); const qs = C.quartosOn(d, date); const dp = postoDia(date); const hol = C.holidayName(date, d.holidays);
  const evs = i.events.filter((e) => !['quarto', 'posto'].includes(e.type) && !(['folga', 'atestado', 'ferias'].includes(e.type) && !e.note && !e.cid));
  const chips = [];
  if (hol) chips.push(`<span class="badge" style="background:${tint('#d4a24c', 20)};color:#d4a24c">${esc(hol)}</span>`);
  if (i.status === 'plantao') chips.push(`<span class="badge" style="background:${tint(C.STATUS.plantao.color, 20)};color:${C.STATUS.plantao.color}">Plantão ${d.scale.hours}h · ${d.scale.start}</span>`);
  else if (i.status === 'extra') { const ex = i.events.find((e) => e.type === 'extra'); chips.push(`<span class="badge" style="background:${tint(C.STATUS.extra.color, 20)};color:${ex && ex.turno === 'noturna' ? C.EXTRA_N : C.EXTRA_D}">${ex && ex.turno === 'noturna' ? 'Extra noturna' : 'Extra diurna'}</span>`); }
  if (dp) chips.push(`<span class="badge" style="background:${tint(C.TYPES.posto.color, 20)};color:${C.TYPES.posto.color}">Dia: ${esc(postoLabel(dp))}</span>`);
  const tm = postosDia(date).filter((x) => x.from).sort((x, y) => x.from.localeCompare(y.from)).map((x) => `<div class="dsr"><i class="dsd" style="background:${C.TYPES.posto.color}"></i><div class="sp"><div class="t">${esc(x.from)}${x.to ? '–' + esc(x.to) : ''} · ${esc(postoLabel(x))}</div></div></div>`).join('');
  const qh = qs.length ? `<div class="qmini">${qGroups(date).map((g) => { const q = d.quarters.find((x) => x.id === g.slot); return `<span class="qm"><b>${q ? esc(q.alvorada ? 'Alvorada' : C.qLabel(q)) : esc(g.slot)}</b><small>${g.posts.length ? esc(g.posts.join(' · ')) : '—'}</small></span>`; }).join('')}</div>` : '';
  const rows = evs.filter((e) => e.type !== 'extra').map((e) => { const T = C.TYPES[e.type]; const sub = e.type === 'ocorrencia' ? [e.cat, e.place].filter(Boolean).join(' · ') : evSub(e); return `<div class="dsr"><i class="dsd" style="background:${T.color}"></i><div class="sp" style="min-width:0"><div class="t">${esc(evTitle(e))}</div>${sub ? `<div class="muted xs" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div>` : ''}</div></div>`; }).join('');
  if (infoStyle() !== 'cartoes') { const its = renderItems(dayItems(date), infoStyle()); const meta = [hol, i.status === 'plantao' ? `Plantão ${d.scale.hours}h · ${d.scale.start}` : (i.status === 'extra' ? (i.events.find((e) => e.type === 'extra')?.turno === 'noturna' ? 'Extra noturna' : 'Extra diurna') : '')].filter(Boolean).join(' · '); const rws = evs.filter((e) => e.type !== 'extra').map((e) => `<div class="ir ev"><b>${esc(evTitle(e))}</b><span>${esc(e.type === 'ocorrencia' ? [e.cat, e.place].filter(Boolean).join(' · ') : evSub(e))}</span></div>`).join(''); return `<div class="dplain" role="button" tabindex="0" data-act="day" data-date="${date}"><div class="dch"><div class="sp" style="min-width:0"><div class="dct">${C.dateLong(date)}</div>${meta ? `<div class="dcs">${esc(meta)}</div>` : ''}</div><span class="dgear" aria-hidden="true">${ic('settings')}</span></div>${its}${rws ? `<div class="ilist">${rws}</div>` : ''}</div>`; }
  return `<div class="dcard" role="button" tabindex="0" data-act="day" data-date="${date}"><div class="dch"><div class="sp" style="min-width:0"><div class="dct">${C.dateLong(date)}</div><div class="dcs">Resumo do dia</div></div><span class="dgear" aria-hidden="true">${ic('settings')}</span></div>${chips.length ? `<div class="row wrap" style="gap:6px">${chips.join('')}</div>` : ''}${tm}${qh}${rows}</div>`;
}
function calendar() {
  const selDay = (S.calSel && S.calSel.startsWith(C.ymKey(S.cal.y, S.cal.m))) ? S.calSel : (C.today().startsWith(C.ymKey(S.cal.y, S.cal.m)) ? C.today() : null);
  const { y, m } = S.cal; const first = new Date(y, m, 1).getDay(); const t = C.today(); const hols = S.d.holidays; const sc = S.d.scale;
  const tag = { plantao: sc.hours + 'h', extra: '12h', permuta_in: 'PERMUTA', permuta_out: 'PASSOU', folga: 'FOLGA', atestado: 'ATEST.', ferias: 'FÉRIAS', livre: '' };
  const cells = Array.from({ length: first }, () => '<div class="cell blank"></div>').join('') + C.monthDays(y, m).map((date) => {
    const i = C.dayInfo(date, S.d); const hol = C.holidayName(date, hols); const types = [...new Set(i.events.map((e) => e.type))].slice(0, 3);
    const ex = i.events.find((e) => e.type === 'extra'); const label = i.status === 'extra' && ex && ex.turno === 'h24' ? '24h' : tag[i.status];
    const mark = '';
    return `<button class="cell ${date === t ? 'today' : ''} ${hol ? 'hol' : ''} ${date === selDay ? 'sel' : ''}" style="--sc:${i.status === 'livre' ? 'transparent' : (i.status === 'extra' && ex ? (ex.turno === 'noturna' ? C.EXTRA_N : C.EXTRA_D) : C.STATUS[i.status].color)}" data-st="${i.status}" data-act="cal-pick" data-date="${date}" aria-label="${C.dateLong(date)}${hol ? ', ' + hol : ''}: ${C.STATUS[i.status].label}"><span class="tg">${label}</span><span class="n">${+date.slice(8)}</span>${mark}${hol ? '<span class="hbar"></span>' : ''}</button>`;
  }).join('');
  const mh = C.monthHolidays(y, m, hols); const tk = mh.map((h) => `<span><b>${C.fmtShort(h.date)}</b> ${esc(h.name)}</span>`).join('');
  const ms = C.monthSummary(S.d, y, m); const exs = ms.extras;
  const lgAll = [[C.STATUS.plantao.color, 'Plantão', ms.plantoes.length > 0], [C.EXTRA_D, 'Extra diurna', exs.some((e) => e.turno !== 'noturna')], [C.EXTRA_N, 'Extra noturna', exs.some((e) => e.turno === 'noturna')], [C.TYPES.permuta.color, 'Permuta', ms.permutaIn.length + ms.permutaOut.length > 0], [C.TYPES.folga.color, 'Folga', ms.folgas.length > 0], [C.TYPES.atestado.color, 'Atestado', ms.atestados.length > 0], [C.TYPES.ferias.color, 'Férias', ms.ferias.length > 0]];
  const lg = lgAll.filter((x) => x[2]);
  return `<div class="ccard"><div class="calhead"><button class="ibtn" data-act="cal-prev" aria-label="Mês anterior">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[m]} <span class="muted" style="font-weight:600">${y}</span></h2><button class="btn sm" data-act="cal-today">Hoje</button><button class="ibtn" data-act="cal-next" aria-label="Próximo mês">${ic('chevR')}</button></div>
  ${mh.length ? `<div class="ticker" aria-label="Feriados do mês"><div class="tk"><div class="tkc">${tk}</div><div class="tkc" aria-hidden="true">${tk}</div></div></div>` : ''}
  <div class="dow">${C.WD3.map((x) => `<div>${x.charAt(0)}</div>`).join('')}</div><div class="cal ${S.calDir ? 'slide-' + S.calDir : ''}" id="cal" data-cs="${S.d.prefs.cellStyle}">${cells}</div><div class="legend">${lg.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>${(S.cal.y !== nowD.getFullYear() || S.cal.m !== nowD.getMonth()) ? `<button class="fab-today" data-act="cal-today">${ic('calendar')}Hoje</button>` : ''}${daySummary(selDay)}`;
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
  <div class="list">${ms.extras.map((e) => `<div class="item"><button class="ico" data-act="ev-paid" data-id="${e.id}" style="background:${tint(e.paid ? '#66c08a' : '#d4a24c', 20)};color:${e.paid ? '#66c08a' : '#d4a24c'}" aria-label="Alternar recebido">${ic(e.paid ? 'check' : 'clock')}</button><div class="sp"><div class="t">${C.WD3[C.weekday(e.date)]} ${C.fmtShort(e.date)} · ${C.brl(e.value)}</div><div class="s">${C.TURNOS[e.turno] || 'Extra'} · ${e.paid ? 'recebida' : 'a receber'}${e.note ? ' · ' + esc(e.note) : ''}</div></div><button class="ibtn" data-act="ev-edit" data-id="${e.id}">${ic('edit')}</button></div>`).join('') || '<div class="card empty">Nenhuma extra neste mês.</div>'}</div>
  <div class="row"><div class="h2 sp">Permutas em aberto</div><button class="btn sm" data-act="ev-new" data-t="permuta" data-date="${C.today()}">${ic('plus')}Permuta</button></div>
  <div class="list">${led.map((r) => `<div class="item"><div class="ico" style="background:${tint('#d4a24c', 20)};color:#d4a24c">${ic('users')}</div><div class="sp"><div class="t">${esc(r.who)}</div><div class="s">${r.net > 0 ? `te deve ${r.net} plantão(ões)` : r.net < 0 ? `você deve ${-r.net} plantão(ões)` : 'equilibrado'} · ${r.open.length} em aberto</div></div><span class="badge" style="background:${tint(r.net >= 0 ? '#66c08a' : '#d96b6b', 20)};color:${r.net >= 0 ? '#66c08a' : '#d96b6b'}">${r.net > 0 ? '+' : ''}${r.net}</span></div>`).join('') || '<div class="card empty">Nenhuma permuta em aberto. ✅</div>'}</div>
  ${perm.length ? `<div class="h2">Permutas de ${C.MONTHS[m]}</div><div class="list">${perm.map((e) => `<div class="item"><button class="ico" data-act="ev-settle" data-id="${e.id}" style="background:${tint(e.settled ? '#66c08a' : '#d4a24c', 20)};color:${e.settled ? '#66c08a' : '#d4a24c'}" aria-label="Quitar">${ic(e.settled ? 'check' : 'swap')}</button><div class="sp"><div class="t">${C.fmtShort(e.date)} · ${esc(evTitle(e))}</div><div class="s">${esc(evSub(e))}</div></div><button class="ibtn" data-act="ev-edit" data-id="${e.id}">${ic('edit')}</button></div>`).join('')}</div>` : ''}`;
}

// ---------- RESUMOS (WhatsApp) ----------
const sumText = () => S.sum.custom ?? buildSummary(S.d, S.sum.y, S.sum.m, { kind: S.d.prefs.waKind, values: S.sum.values, notes: S.sum.notes, calendar: S.sum.calendar });
function summary() {
  const k = S.d.prefs.waKind; const text = sumText(); const tg = (key, l) => `<label class="tgl"><span class="sm">${l}</span><input type="checkbox" data-sum="${key}" ${S.sum[key] ? 'checked' : ''}></label>`;
  return `<div class="calhead"><button class="ibtn" data-act="sum-prev">${ic('chevL')}</button><h2 style="text-align:center">${C.MONTHS[S.sum.m]} <span class="muted" style="font-weight:600">${S.sum.y}</span></h2><button class="ibtn" data-act="sum-next">${ic('chevR')}</button></div>
  <div class="seg">${[['completo', 'Completo'], ['escala', 'Escala'], ['financeiro', 'Finanças'], ['proximos', 'Próximos']].map(([v, l]) => `<button class="${k === v ? 'on' : ''}" data-act="sum-kind" data-v="${v}">${l}</button>`).join('')}</div>
  <details class="sub" data-sec="sumopt" ${S.open.has('sumopt') ? 'open' : ''}><summary>O que incluir no resumo</summary><div style="margin-top:6px">${tg('values', 'Valores (R$)')}${tg('notes', 'Observações')}${tg('calendar', 'Mini calendário do mês')}</div></details>
  ${S.sum.editing ? `<textarea id="sumEdit" style="min-height:300px;font-family:ui-monospace,monospace;font-size:13px">${esc(text)}</textarea>` : `<div class="wa-bubble">${waHtml(text)}</div>`}
  <label class="f">WhatsApp de destino (opcional — vazio = escolher o contato)<input type="tel" inputmode="tel" id="waPhone" placeholder="(11) 91234-5678" value="${esc(S.d.prefs.waPhone)}"></label>
  <a class="btn wa blk" data-act="wa-send" data-native href="${esc(waLink(text, S.d.prefs.waPhone))}" target="_blank" rel="noopener" style="text-decoration:none">${ic('chat')}Enviar pelo WhatsApp</a>
  <div class="grid3"><button class="btn" data-act="sum-copy">${ic('copy')}Copiar</button><button class="btn" data-act="sum-share">${ic('share')}Compartilhar</button><button class="btn" data-act="sum-edit">${ic('edit')}${S.sum.editing ? 'Pronto' : 'Editar'}</button></div>`;
}

// ---------- AJUSTES ----------
const sec = (id, icn, title, sub, body) => `<details class="sec" data-sec="${id}" ${S.open.has(id) ? 'open' : ''}><summary><span class="ico">${ic(icn)}</span><span class="sp"><b>${title}</b><small>${sub}</small></span>${ic('chevR', 'chv')}</summary><div class="secbody">${body}</div></details>`;
const sndOpts = (sel) => SOUND_CATS.map((c) => `<optgroup label="${c}">${SOUNDS.filter((x) => x.cat === c).map((x) => `<option value="${x.id}" ${sel === x.id ? 'selected' : ''}>${x.label}</option>`).join('')}</optgroup>`).join('') + (S.d.customSounds.length ? `<optgroup label="Meus sons">${S.d.customSounds.map((x) => `<option value="${x.id}" ${sel === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>` : '');
const storageMeter = () => { const u = Store.usage(); const col = u.pct > 80 ? 'var(--danger)' : u.pct > 60 ? 'var(--warn)' : 'var(--ok)'; return `<div class="col" style="gap:6px"><div class="row"><b class="sp">Espaço usado neste aparelho</b><span class="muted sm">${(u.chars / 1e6).toFixed(1)} de ~5 MB</span></div><div class="bar" style="margin:0"><i style="width:${Math.min(100, u.pct)}%;background:${col}"></i></div>${u.pct > 70 ? '<div class="muted xs">Está enchendo: apague fotos antigas das ocorrências ou exporte um backup.</div>' : ''}</div>`; };
const natChecks = () => {
  const st = S.alarmStatus; if (st === undefined) return '<div class="muted xs">Verificando permissões…</div>';
  if (!st) return '<div class="muted xs">Não consegui ler o status. Toque em Atualizar.</div>';
  const row = (ok, label, k, fix) => `<div class="row"><span class="badge" style="background:${tint(ok ? '#66c08a' : '#d96b6b', 22)};color:${ok ? '#66c08a' : '#d96b6b'}">${ok ? 'OK' : 'ajustar'}</span><span class="sp sm">${label}</span>${ok ? '' : `<button class="btn sm" data-act="nat-fix" data-k="${k}">${fix}</button>`}</div>`;
  return `<div class="col" style="gap:8px">${row(st.notifications, 'Notificações permitidas', 'notif', 'Permitir')}${row(st.fullScreen, 'Alarme sobre a tela bloqueada', 'fullscreen', 'Permitir')}${row(st.battery, 'Bateria sem restrição (importante no Samsung)', 'battery', 'Ajustar')}</div>`;
};
function settings() {
  const d = S.d, p = d.profile, pr = d.prefs, ai = pr.ai; const row = (l, inner) => `<label class="f">${l}${inner}</label>`;
  const perfil = `<div class="row" style="gap:12px"><div class="avatar" style="width:64px;height:64px;font-size:22px;border-radius:20px">${avatarHtml(p)}</div><div class="col sp" style="gap:8px"><div class="b">Foto do perfil</div><div class="row wrap" style="gap:8px"><label class="btn sm">${ic('camera')}Câmera<input type="file" accept="image/*" capture="user" data-avatar class="hidden"></label><label class="btn sm">${ic('image')}Galeria<input type="file" accept="image/*" data-avatar class="hidden"></label>${p.photo ? `<button class="btn sm" data-act="avatar-edit">${ic('edit')}Ajustar</button><button class="btn sm dng" data-act="avatar-del">Remover</button>` : ''}</div></div></div>${row('Nome', `<input data-bind="profile.name" value="${esc(p.name)}">`)}${row('Cargo', `<input data-bind="profile.rank" value="${esc(p.rank)}">`)}<div class="grid2">${row('Matrícula', `<input data-bind="profile.matricula" value="${esc(p.matricula)}">`)}${row('Unidade', `<input data-bind="profile.unit" value="${esc(p.unit)}">`)}</div>${row('Como seu nome aparece nas escalas de quartos', `<input data-bind="profile.alias" value="${esc(p.alias || '')}" placeholder="Ex.: Lucas, PP Silva (separe por vírgula)">`)}`;
  const quartos = `<div class="muted sm">Faixas usadas ao marcar os quartos (início, fim e nome opcional).</div>${d.quarters.map((q, i) => `<div class="row" style="gap:6px"><input type="time" data-bind="quarters.${i}.start" value="${q.start}"><span class="muted">–</span><input type="time" data-bind="quarters.${i}.end" value="${q.end}"><input data-bind="quarters.${i}.name" value="${esc(q.name || '')}" placeholder="nome"><button class="ibtn" data-act="q-del" data-i="${i}" aria-label="Remover quarto">${ic('trash')}</button></div>`).join('')}<div class="grid2"><button class="btn sm" data-act="q-add">${ic('plus')}Adicionar quarto</button><button class="btn sm" data-act="q-reset">Restaurar padrão</button></div>
  <div id="cfg-postos" class="b" style="margin-top:8px">Postos da unidade</div><div class="muted xs">Use ▲ ▼ para mudar a ordem. É a mesma ordem que aparece ao marcar um quarto.</div>${d.posts.map((x, i) => `<div class="prow"><input data-post-i="${i}" value="${esc(x)}" aria-label="Posto ${i + 1}"><button class="ibtn sm" data-act="post-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button><button class="ibtn sm" data-act="post-down" data-i="${i}" ${i === d.posts.length - 1 ? 'disabled' : ''} aria-label="Descer">▼</button><button class="ibtn sm" data-act="post-del" data-i="${i}" aria-label="Excluir ${esc(x)}">${ic('trash')}</button></div>`).join('')}<button class="btn sm" data-act="post-sort">Ordenar: blocos primeiro</button><div class="row"><input id="postNew" placeholder="Novo posto (ex.: Pavilhão C)"><button class="btn sm" data-act="post-add">${ic('plus')}</button></div><details class="sub" data-sec="daycfg" ${S.open.has('daycfg') ? 'open' : ''}><summary>Postos do dia</summary><div class="col" style="margin-top:10px"><label class="f">Postos durante o dia (um por linha)<textarea data-daypostlist rows="6">${esc((d.dayPosts || []).join('\n'))}</textarea></label><label class="f">Os que pedem o bloco (um por linha)<textarea data-needwherelist rows="3">${esc((d.dayNeedWhere || []).join('\n'))}</textarea></label><div class="muted xs">Calibre 12 e Chefe de bloco pedem o bloco (A, B ou C). Esses também não aparecem nos quartos da noite.</div></div></details>`;
  const alq = d.quarters.map((q, i) => `<div class="qrow"><div class="row"><b class="sp">${esc(q.name || C.qLabel(q))}${q.name ? ` <span class="muted xs">${C.qLabel(q)}</span>` : ''}</b><input type="checkbox" class="sw2" data-bind="quarters.${i}.alarm" ${q.alarm !== false ? 'checked' : ''} aria-label="Alarme ligado"></div><div class="row"><input class="num" type="number" min="0" max="120" inputmode="numeric" data-bind="quarters.${i}.lead" data-numnull placeholder="${q.alvorada ? 0 : pr.lead}" value="${q.lead ?? ''}" aria-label="Minutos antes"><span class="muted xs">min antes</span><select class="sp" data-bind="quarters.${i}.sound" aria-label="Som"><option value="">Padrão</option>${sndOpts(q.sound)}</select><button class="ibtn" data-act="snd-test" data-qi="${i}" aria-label="Ouvir som">${ic('volume')}</button></div></div>`).join('');
  const nat = isNative();
  const natPanel = nat ? `<div class="card col" style="background:var(--surface2);gap:10px"><div class="row"><b class="sp">Alarme do aparelho</b><span class="badge" style="background:${tint(S.alarmSync && S.alarmSync.err ? '#d96b6b' : '#66c08a', 22)};color:${S.alarmSync && S.alarmSync.err ? '#d96b6b' : '#66c08a'}">${S.alarmSync && S.alarmSync.err ? 'erro' : 'ativo'}</span></div><div class="muted xs">${S.alarmSync && S.alarmSync.err ? esc(S.alarmSync.err) : `${S.alarmSync && S.alarmSync.n != null ? S.alarmSync.n : '…'} alarme(s) agendado(s) para os próximos 14 dias. Tocam com o app fechado e a tela bloqueada.`}</div>${natChecks()}<div class="grid2"><button class="btn sm pri" data-act="nat-test">${ic('alert')}Testar em 10 s</button><button class="btn sm" data-act="nat-refresh">Atualizar</button></div><div class="muted xs">No teste, bloqueie a tela do celular e aguarde.</div></div>` : `<div class="card col" style="background:var(--surface2);gap:8px"><b>Alarme completo só no app Android</b><div class="muted xs">No navegador o alarme toca apenas com o app aberto. O app Android toca como o relógio do celular: tela bloqueada, volume de alarme e repetindo até você desligar.</div><a class="btn sm pri" href="${APK_URL}" target="_blank" rel="noopener" data-native>${ic('download')}Baixar o app Android</a></div>`;
  const meus = nat ? `<div class="b">Meus sons</div>${d.customSounds.map((x) => `<div class="row"><span class="sp sm">${esc(x.name)}</span><button class="ibtn" data-act="snd-test" data-sid="${esc(x.id)}" aria-label="Ouvir">${ic('volume')}</button><button class="ibtn" data-act="sound-del" data-sid="${esc(x.id)}" aria-label="Remover">${ic('trash')}</button></div>`).join('')}<button class="btn sm" data-act="sound-import">${ic('plus')}Importar um som do aparelho</button>` : '';
  const alarmes = `${natPanel}<label class="tgl"><span><div class="b">Alarmes de quarto</div><div class="muted xs">Tocam antes do início de cada quarto marcado</div></span><input type="checkbox" data-bind="prefs.reminders" ${pr.reminders ? 'checked' : ''}></label><div class="grid2"><label class="f">Avisar antes (min)<input type="number" min="0" max="120" inputmode="numeric" data-bind="prefs.lead" data-num value="${pr.lead}"></label><label class="f">Som padrão<select data-bind="prefs.sound">${sndOpts(pr.sound)}</select></label></div><button class="btn sm" data-act="snd-test">${ic('volume')}Ouvir o som padrão</button>${meus}
  <label class="tgl"><span><div class="b">Alvorada</div><div class="muted xs">Alarme na hora da Alvorada quando estiver de plantão de 24 h</div></span><input type="checkbox" data-bind="prefs.alvorada" ${pr.alvorada ? 'checked' : ''}></label>
  <label class="f">Lembrete antes do plantão<select data-bind="prefs.shiftReminder" data-numstr>${[[0, 'Desligado'], [60, '1 hora antes'], [120, '2 horas antes'], [180, '3 horas antes'], [720, '12 horas antes']].map(([v, l]) => `<option value="${v}" ${(pr.shiftReminder || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="tgl"><span><div class="b">Volume crescente</div><div class="muted xs">Começa baixo e sobe em ~10 s, sem susto</div></span><input type="checkbox" data-bind="prefs.ramp" ${pr.ramp ? 'checked' : ''}></label>
  <div class="grid2"><label class="f">Soneca (min)<input type="number" min="1" max="30" inputmode="numeric" data-bind="prefs.snooze" data-num value="${pr.snooze}"></label><label class="f">Parar sozinho (min)<input type="number" min="1" max="30" inputmode="numeric" data-bind="prefs.autostop" data-num value="${pr.autostop}"></label></div>
  ${nat ? '' : `<label class="tgl"><span><div class="b">Manter a tela ligada</div><div class="muted xs">Evita o celular apagar durante o plantão, para o alarme tocar</div></span><input type="checkbox" data-bind="prefs.wake" ${pr.wake ? 'checked' : ''}></label>`}
  <details class="sub" data-sec="alq" ${S.open.has('alq') ? 'open' : ''}><summary>Ajustar quarto a quarto</summary><div class="col" style="margin-top:10px">${alq}</div></details>${nat ? '' : `<div class="grid2"><button class="btn sm" data-act="alarm-test">${ic('alert')}Testar alarme</button><button class="btn sm" data-act="notify">Permitir notificações</button></div>`}`;
  const feriados = `<div class="muted sm">Os feriados nacionais (com Carnaval, Páscoa e Corpus Christi) já estão no calendário. Cadastre aqui os da sua cidade ou estado.</div>${(d.holidays || []).map((h, i) => `<div class="row"><span class="chip on" style="flex:none">${h.md.slice(3)}/${h.md.slice(0, 2)}</span><span class="sp">${esc(h.name)}</span><button class="ibtn" data-act="hol-del" data-i="${i}" aria-label="Excluir feriado">${ic('trash')}</button></div>`).join('')}<div class="grid2"><input type="date" id="holDate" aria-label="Data"><input id="holName" placeholder="Nome do feriado"></div><button class="btn sm" data-act="hol-add">${ic('plus')}Adicionar feriado</button>`;
  const ia = `<div class="seg"><button class="${ai.provider === 'gemini' ? 'on' : ''}" data-act="ai-provider" data-v="gemini">Gemini (Google)</button><button class="${ai.provider === 'anthropic' ? 'on' : ''}" data-act="ai-provider" data-v="anthropic">Claude</button></div><label class="f">Chave da API<input type="password" data-bind="prefs.ai.key" value="${esc(ai.key)}" placeholder="Cole sua chave aqui" autocomplete="off"></label><label class="f">Modelo (opcional)<input data-bind="prefs.ai.model" value="${esc(ai.model)}" placeholder="${DEFAULT_MODELS[ai.provider]}"></label><button class="btn sm" data-act="ai-test">${ic('check')}Testar conexão</button><div class="muted xs">${ai.provider === 'gemini' ? 'Chave gratuita em aistudio.google.com/app/apikey.' : 'Chave em console.anthropic.com.'} Fica salva só neste aparelho e vai direto dele ao provedor. Sem chave, tudo funciona; você marca os quartos tocando.</div>`;
  const accentHex = () => { try { const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : '#e8e8ea'; } catch { return '#e8e8ea'; } };
  const coresUI = () => `<div class="muted xs">Toque numa cor para trocar. Vale no calendário, nas listas e nos resumos.</div><div class="colors">${Object.entries(C.COLOR_LABELS).map(([k, l]) => `<label class="cpick"><input type="color" data-color="${k}" value="${(S.d.prefs.colors && S.d.prefs.colors[k]) || (k === 'plantao' ? accentHex() : C.DEFAULT_COLORS[k])}"><span>${l}</span></label>`).join('')}</div><button class="btn sm" data-act="colors-reset">Restaurar cores padrão</button>`;
  const aparencia = `<div class="b">Estilo da interface</div><div class="lay">${[['moderno', 'Moderno', 'Cartões e calendário solto. O padrão.'], ['classico', 'Clássico', 'Parecido com o app original: cabeçalho com escudo, calendário em card.']].map(([v, n, t]) => `<button class="layopt ${(pr.layout || 'moderno') === v ? 'on' : ''}" data-act="layout" data-v="${v}"><b>${n}</b><small>${t}</small></button>`).join('')}</div><div class="b">Estilo das informações</div><div class="lay3">${[['cartoes', 'Cartões', 'Caixinhas, como está.'], ['lista', 'Lista', 'Texto limpo: posto e horário.'], ['linha', 'Linha do tempo', 'Horário na lateral, posto em destaque.']].map(([v, n, t]) => `<button class="layopt ${(pr.infoStyle || 'cartoes') === v ? 'on' : ''}" data-act="info-style" data-v="${v}"><b>${n}</b><small>${t}</small></button>`).join('')}</div><div class="b">Tema</div><div class="themes">${THEMES.map((t) => `<button class="theme ${pr.theme === t.id ? 'on' : ''}" data-act="theme" data-v="${t.id}" aria-label="Tema ${t.name}"><span class="sw" style="background:${t.bg}"><i style="background:${t.sf}"></i><b style="background:${t.ac}"></b></span><span class="tn">${t.name}</span><span class="td">${t.desc}</span></button>`).join('')}<button class="theme ${pr.theme === 'auto' ? 'on' : ''}" data-act="theme" data-v="auto"><span class="sw" style="background:linear-gradient(90deg,#050505 50%,#f4f4f5 50%)"></span><span class="tn">Automático</span><span class="td">Segue o celular</span></button></div><div class="b" style="margin-top:6px">Cor de destaque</div><div class="sw3">${ACCENTS.map((c) => `<button class="${(pr.accent || '') === c ? 'on' : ''}" style="${c ? `background:${c}` : 'background:conic-gradient(#e8e8ea,#4d8dff,#d4a63a,#9bbf5a,#e8e8ea)'}" data-act="accent" data-v="${c}" aria-label="${c ? 'Cor ' + c : 'Cor do tema'}"></button>`).join('')}</div><div class="muted xs">A primeira bolinha usa a cor própria do tema.</div><div class="b" style="margin-top:6px">Tamanho do texto</div><div class="seg">${[[1, 'Normal'], [1.12, 'Grande'], [1.25, 'Muito grande']].map(([v, l]) => `<button class="${(pr.zoom || 1) === v ? 'on' : ''}" data-act="zoom" data-v="${v}">${l}</button>`).join('')}</div><div class="b" style="margin-top:4px">Estilo do calendário</div><div class="seg">${[['classic', 'Clássico'], ['circle', 'Círculos'], ['solid', 'Cheio'], ['clean', 'Limpo']].map(([v, l]) => `<button class="${pr.cellStyle === v ? 'on' : ''}" data-act="cell-style" data-v="${v}">${l}</button>`).join('')}</div><label class="tgl"><span><div class="b">Ler respostas em voz alta</div><div class="muted xs">O assistente fala as respostas</div></span><input type="checkbox" data-bind="prefs.speak" ${pr.speak ? 'checked' : ''}></label>`;
  const seguranca = `${pr.pin ? `<div class="grid2"><button class="btn" data-act="pin-new">${ic('lock')}Alterar PIN</button><button class="btn dng" data-act="pin-off">Remover PIN</button></div><label class="f">Bloquear automaticamente<select data-bind="prefs.lockAfter" data-numstr>${[[0, 'Ao sair do app'], [1, 'Depois de 1 minuto'], [5, 'Depois de 5 minutos'], [-1, 'Só ao abrir o app']].map(([v, l]) => `<option value="${v}" ${(pr.lockAfter ?? 1) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : `<div class="muted sm">Peça um PIN para abrir o app. Protege suas ocorrências e dados contra quem pegar o seu celular.</div><button class="btn pri" data-act="pin-new">${ic('lock')}Criar PIN</button>`}${isNative() && pr.pin && S.bioOk ? `<label class="tgl"><span><div class="b">Desbloquear com biometria</div><div class="muted xs">Digital ou rosto; o PIN continua como alternativa</div></span><input type="checkbox" data-bind="prefs.bio" ${pr.bio ? 'checked' : ''}></label>` : ''}<label class="tgl"><span><div class="b">Modo discreto</div><div class="muted xs">Esconde os valores em R$ na tela</div></span><input type="checkbox" data-bind="prefs.discreet" ${pr.discreet ? 'checked' : ''}></label><div class="muted xs">O PIN não criptografa os dados guardados. No modo sem cadastro não há recuperação do PIN: guarde-o e exporte um backup.</div>`;
  const cl = pr.cloud;
  const nuvem = cl ? `<div class="card col" style="background:var(--surface2);gap:6px"><div class="row"><b class="sp">Conectado</b><span class="badge" style="background:${tint('#6fcf97', 22)};color:#6fcf97">nuvem</span></div><div class="muted sm">${esc(cl.email)}</div>${cl.verified === false || (cl.verified === undefined && !cl.google) ? `<div class="card col" style="gap:8px;border-color:#e0b25a"><b>Confirme seu e-mail</b><div class="muted xs">Enviamos um link para ${esc(cl.email)}. O backup só funciona depois de confirmar.</div><div class="grid2"><button class="btn sm pri" data-act="cloud-verify-check">Já confirmei</button><button class="btn sm" data-act="cloud-verify-resend">Reenviar e-mail</button></div></div>` : ''}<div class="muted xs">${pr.cloudAt ? 'Último backup: ' + new Date(pr.cloudAt).toLocaleString('pt-BR') : 'Nenhum backup enviado ainda'}</div>${S.cloudErr ? `<div class="err">${esc(S.cloudErr)}</div>` : ''}</div><div class="grid2"><button class="btn pri" data-act="cloud-up">${ic('upload')}Enviar agora</button><button class="btn" data-act="cloud-down">${ic('download')}Restaurar</button></div><label class="tgl"><span><div class="b">Backup automático</div><div class="muted xs">Envia sozinho depois que você mexe nos dados</div></span><input type="checkbox" data-bind="prefs.cloudAuto" ${pr.cloudAuto !== false ? 'checked' : ''}></label><button class="btn sm dng" data-act="cloud-out">Sair da nuvem</button>` : `<div class="muted sm">Guarda uma cópia dos seus dados na nuvem e deixa você usar o mesmo login em outro aparelho. Fotos e ocorrências vão junto. A chave de IA e o PIN <b>não</b> vão para a nuvem.</div>${isNative() ? `<button class="btn blk" data-act="google-cloud">${G_ICON}Continuar com o Google</button><div class="muted xs" style="text-align:center">ou com e-mail e senha (enviamos um link para confirmar)</div>` : ''}<form class="col" data-submit="cloud-login"><label class="f">E-mail<input id="cloudEmail" name="email" type="email" required autocomplete="email"></label><label class="f">Senha<input name="password" type="password" minlength="6" required autocomplete="current-password"></label><div class="grid2"><button class="btn pri" type="submit" name="mode" value="in">Entrar</button><button class="btn" type="submit" name="mode" value="up">Criar conta</button></div></form><div class="row"><button class="link" data-act="cloud-reset">Esqueci a senha</button><span class="sp"></span><button class="link" data-act="cloud-check">Verificar configuração</button></div>`;
  const hh = pr.home || {};
  const tglh = (k, t, sub, on) => `<label class="tgl"><span><div class="b">${t}</div><div class="muted xs">${sub}</div></span><input type="checkbox" data-bind="prefs.home.${k}" ${on ? 'checked' : ''}></label>`;
  const inicioCfg = `<div class="muted xs">Escolha o que aparece no Início. O cartão principal do plantão fica sempre.</div>${tglh('extras', 'Extras do mês', 'Total e valor a receber', hh.extras !== false)}${tglh('quartos', 'Quartos de hora', 'Próximo quarto e atalho para marcar', hh.quartos !== false)}${tglh('proximos', 'Próximos plantões', 'Atalhos para os próximos dias', hh.proximos !== false)}${tglh('numeros', 'Resumo do mês em números', 'Plantões, extras e permutas', hh.numeros === true)}`;
  const u = S.upd || {};
  const atualizacao = `<div class="card col" style="background:var(--surface2);gap:8px"><div class="row"><b class="sp">Versão instalada</b><span class="badge">${u.installedName ? esc(u.installedName) : (isNative() ? '…' : 'navegador')}</span></div>${u.busy ? '<div class="muted xs">Verificando…</div>' : u.err ? `<div class="muted xs" style="color:#d96b6b">${esc(u.err)}</div>` : u.latest ? `<div class="row"><span class="sp">Última disponível</span><span class="badge">1.0.${u.latest}</span></div><div class="muted xs">${u.newer ? 'Há uma versão nova.' : 'Você está com a versão mais recente.'}</div>` : '<div class="muted xs">Toque em verificar para ver se há versão nova.</div>'}${u.notes ? `<div class="muted xs" style="white-space:pre-wrap"><b>Novidades</b>\n${esc(u.notes)}</div>` : ''}${u.history && u.history.length ? `<details><summary class="muted xs">Versões anteriores</summary><div class="muted xs" style="white-space:pre-wrap;margin-top:6px">${u.history.map((h) => '• ' + esc(h)).join('\n')}</div></details>` : ''}<div class="grid2"><button class="btn sm" data-act="upd-check">Verificar</button><button class="btn sm ${u.newer || !isNative() ? 'pri' : ''}" data-act="upd-get">${ic('download')}${isNative() ? 'Baixar e atualizar' : 'Baixar o app Android'}</button></div>${isNative() ? '<div class="muted xs">O celular baixa o APK e abre o instalador. Toque em Instalar; seus dados e alarmes são mantidos. Na primeira vez o Android pode pedir para permitir instalar do navegador.</div>' : ''}</div>`;
  const dados = `${storageMeter()}<div class="muted sm">Seus dados ficam somente neste aparelho. Faça backup para guardar ou levar para outro celular.</div><div class="grid2"><button class="btn" data-act="export">${ic('download')}Exportar</button><button class="btn" data-act="import">${ic('upload')}Importar</button></div><input type="file" id="impFile" accept="application/json,.json" class="hidden">${window._bip ? `<button class="btn pri" data-act="install">${ic('download')}Instalar app no aparelho</button>` : `<div class="muted xs">Para instalar: no Chrome use “Adicionar à tela inicial”; no iPhone, Compartilhar → “Adicionar à Tela de Início”.</div>`}<button class="btn dng" data-act="clear-events">${ic('trash')}Apagar todos os lançamentos</button>`;
  const conta = `${S.user.guest ? '<div class="muted sm">Você está no modo sem cadastro. Crie uma conta para proteger os dados com senha.</div>' : `<button class="btn" data-act="pw">${ic('lock')}Alterar senha</button>`}<button class="btn" data-act="logout">${ic('logout')}Sair</button><button class="btn dng" data-act="delete-account">${ic('trash')}Excluir conta e dados</button>`;
  return `<div class="card row"><div class="avatar">${avatarHtml(p)}</div><div class="sp"><div class="b">${esc(p.name || 'Meu perfil')}</div><div class="muted sm">${esc(S.user.guest ? 'Modo sem cadastro' : S.user.email)}</div></div></div>
  <div class="grp">Meu plantão</div>${sec('perfil', 'user', 'Perfil', p.name || 'Seu nome e cargo', perfil)}${sec('escala', 'calendar', 'Escala de plantão', `${C.scaleLabel(d.scale)} · entrada ${d.scale.start}`, scaleEditor())}${sec('quartos', 'clock', 'Quartos e postos', `${d.quarters.length} quartos · ${d.posts.length} postos`, quartos)}${sec('alarmes', 'alert', 'Alarmes', pr.reminders ? `${pr.lead} min antes · ${soundLabel(pr.sound, d.customSounds)}` : 'Desligados', alarmes)}${sec('feriados', 'sun', 'Feriados da minha cidade', `${(d.holidays || []).length} cadastrado(s)`, feriados)}${sec('valores', 'wallet', 'Valores das extras', `Diurna ${C.brl(d.money.diurna)}`, `${moneyFields()}<div class="muted xs">O valor é sugerido ao lançar uma extra e pode ser alterado em cada lançamento.</div>`)}<div class="grp">Personalizar</div>${sec('ia', 'sparkles', 'IA para ler fotos', hasAI(ai) ? 'Conectada' : 'Opcional', ia)}${sec('inicio', 'home', 'Tela inicial', 'Escolher o que aparece', inicioCfg)}${sec('cores', 'palette', 'Cores do calendário', Object.keys(C.COLOR_LABELS).map((k) => `<i class="cdot" style="background:${k === 'plantao' ? C.STATUS.plantao.color : ((S.d.prefs.colors && S.d.prefs.colors[k]) || C.DEFAULT_COLORS[k])}"></i>`).join(''), coresUI())}${sec('aparencia', 'eye', 'Aparência', (THEMES.find((t) => t.id === pr.theme) || { name: 'Automático' }).name, aparencia)}<div class="grp">Conta e dados</div>${sec('nuvem', 'cloud', 'Nuvem e backup', cl ? esc(cl.email) : 'Não conectado', nuvem)}${sec('seguranca', 'lock', 'Segurança e privacidade', pr.pin ? 'PIN ativo' : 'Sem PIN', seguranca)}${sec('atualizacao', 'download', 'Atualização do app', u.newer ? 'Nova versão disponível' : (u.installedName ? 'Versão ' + esc(u.installedName) : 'Versões e download'), atualizacao)}${sec('dados', 'download', 'Dados e backup', 'Exportar, importar, instalar', dados)}${sec('conta', 'lock', 'Conta', S.user.guest ? 'Sem cadastro' : S.user.email, conta)}
  <p class="muted xs" style="text-align:center">Sentinela Tático · versão 1.1 · feito para servidores de plantão</p>`;
}

// ---------- SHEETS ----------
function daySheet(date) {
  const i = C.dayInfo(date, S.d); const st = C.STATUS[i.status]; const hol = C.holidayName(date, S.d.holidays); const qs = C.quartosOn(S.d, date); const evs = i.events.filter((e) => e.type !== 'quarto');
  const extra = evs.find((e) => e.type === 'extra'); const others = evs.filter((e) => e.type !== 'extra' && e.type !== 'posto'); const dpost = postoDia(date); const hasFolga = others.some((e) => e.type === 'folga');
  const qsum = qGroups(date).map((g) => { const q = S.d.quarters.find((x) => x.id === g.slot); return `${q ? C.qLabel(q) : g.slot}${g.posts.length ? ' ' + g.posts.join('+') : ''}`; }).join(' · ');
  const big = (k, small, label, color) => `<button class="qk" data-act="ev-quick" data-k="${k}" data-date="${date}" style="--qc:${color}"><small>${small}</small><b>${label}</b></button>`;
  const main = extra
    ? `<div class="exrow"><div class="seg sp"><button class="${extra.turno !== 'noturna' ? 'on' : ''}" data-act="ev-quick" data-k="diurna" data-date="${date}">Extra diurna</button><button class="${extra.turno === 'noturna' ? 'on' : ''}" data-act="ev-quick" data-k="noturna" data-date="${date}">Extra noturna</button></div><button class="ibtn dng" data-act="ev-rm" data-id="${extra.id}" aria-label="Remover extra">${ic('trash')}</button></div>`
    : `<div class="quick3">${big('diurna', 'Extra', 'Diurna', C.EXTRA_D)}${big('noturna', 'Extra', 'Noturna', C.EXTRA_N)}${hasFolga ? '' : big('folga', 'Dia de', 'Folga', C.TYPES.folga.color)}</div>`;
  const mini = (e) => `<div class="mini"><i style="background:${typeColor(e.type)}"></i><button class="sp" data-act="ev-edit" data-id="${e.id}">${esc(evTitle(e))}</button><button class="ibtn" data-act="ev-rm" data-id="${e.id}" aria-label="Remover">${ic('trash')}</button></div>`;
  const add = (k, label) => `<button class="add w3" data-act="ev-new" data-t="${k}" data-date="${date}"><i style="background:${tint(typeColor(k), 20)};color:${typeColor(k)}">${ic(C.TYPES[k].icon)}</i>${label}</button>`;
  return `<div class="grab"></div><div class="row"><div class="sp"><div class="muted sm">${C.relDays(date)}</div><h3>${C.dateLong(date)}</h3></div><button class="ibtn" data-act="close">${ic('x')}</button></div>
  <div class="row wrap" style="margin:8px 0 14px;gap:6px"><span class="badge" style="background:${tint(st.color, 20)};color:${st.color}">${st.label}</span>${hol ? `<span class="badge" style="background:${tint('#d4a24c', 20)};color:#d4a24c">${esc(hol)}</span>` : ''}</div>
  ${main}
  ${others.length ? `<div class="col" style="gap:6px;margin-top:10px">${others.map(mini).join('')}</div>` : ''}
  ${i.works || qs.length || dpost || diaResumo(date) ? `<button class="item slim" data-act="q-open" data-date="${date}"><div class="ico" style="background:${tint(C.TYPES.quarto.color, 20)};color:${C.TYPES.quarto.color}">${ic('clock')}</div><div class="sp" style="min-width:0"><div class="t">Postos e quartos</div><div class="s">${dpost || qs.length || diaResumo(date) ? esc([diaResumo(date) ? 'Dia: ' + diaResumo(date) : '', qsum].filter(Boolean).join(' · ')) : 'Toque para marcar'}</div></div>${ic('chevR')}</button>` : ''}
  <details class="sub" data-sec="daymore" ${S.open.has('daymore') ? 'open' : ''} style="margin-top:12px"><summary>Mais opções</summary><div class="adds" style="margin-top:10px">${add('permuta', 'Permuta')}${add('atestado', 'Atestado')}${add('ferias', 'Férias')}${add('ocorrencia', 'Ocorrência')}</div></details>`;
}
function formSheet() {
  if (S.draft.type === 'ocorrencia') return ocForm();
  const e = S.draft; const T = C.TYPES[e.type]; const isNew = !e.id; const range = T.range;
  const typeChips = isNew && (e.type === 'folga' || e.type === 'ferias') ? `<div class="seg"><button type="button" class="${e.type === 'folga' ? 'on' : ''}" data-act="f-type" data-v="folga">Folga</button><button type="button" class="${e.type === 'ferias' ? 'on' : ''}" data-act="f-type" data-v="ferias">Férias</button></div>` : '';
  const f = (name, label, inner) => `<label class="f">${label}${inner}</label>`;
  const names = [...new Set(S.d.events.filter((x) => x.who).map((x) => x.who))];
  let fields = '';
  if (e.type === 'extra') fields = `<div class="seg">${[['diurna', 'Diurna'], ['noturna', 'Noturna']].map(([k, l]) => `<button type="button" class="${e.turno === k ? 'on' : ''}" data-act="f-set" data-k="turno" data-v="${k}">${l}</button>`).join('')}</div><details class="sub" data-sec="exmore"><summary>Valor e pagamento · ${C.brl(Number(e.value) || 0)}${e.paid ? ' · recebida' : ''}</summary><div class="col" style="margin-top:10px">${f('value', 'Valor (R$)', `<input data-f="value" type="number" step="0.01" min="0" inputmode="decimal" value="${e.value ?? ''}">`)}<label class="tgl"><span class="sm b">Já recebi esta extra</span><input type="checkbox" data-f="paid" ${e.paid ? 'checked' : ''}></label></div></details>`;
  if (e.type === 'permuta') fields = `<div class="seg"><button class="${e.dir === 'passei' ? 'on' : ''}" data-act="f-set" data-k="dir" data-v="passei">Passei meu plantão</button><button class="${e.dir === 'assumi' ? 'on' : ''}" data-act="f-set" data-k="dir" data-v="assumi">Assumi plantão</button></div>${f('who', e.dir === 'passei' ? 'Quem assumiu' : 'De quem', `<input data-f="who" list="names" value="${esc(e.who || '')}" placeholder="Nome do colega"><datalist id="names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`)}<details class="sub" data-sec="pmore"><summary>Devolução</summary><div class="col" style="margin-top:10px">${f('returnDate', 'Data da devolução (opcional)', `<input data-f="returnDate" type="date" value="${e.returnDate || ''}">`)}<label class="tgl"><span class="sm b">Permuta quitada (já devolvida)</span><input type="checkbox" data-f="settled" ${e.settled ? 'checked' : ''}></label></div></details>`;
  if (e.type === 'folga') fields = `${f('reason', 'Motivo', `<select data-f="reason">${['', 'Compensação', 'Banco de horas', 'Abono', 'Outro'].map((r) => `<option ${e.reason === r ? 'selected' : ''} value="${r}">${r || 'Selecione (opcional)'}</option>`).join('')}</select>`)}`;
  if (e.type === 'atestado') fields = f('cid', 'CID (opcional)', `<input data-f="cid" value="${esc(e.cid || '')}" placeholder="Ex.: J11">`);
  if (e.type === 'obs') fields = '';
  const days = range ? `${f('_days', 'Quantidade de dias', `<input data-f="_days" type="number" min="1" max="365" inputmode="numeric" value="${e._days || 1}">`)}<div class="muted xs" style="margin-top:-6px">${(+e._days || 1) > 1 ? `Até ${C.fmtBR(C.addDays(e.date || C.today(), (+e._days || 1) - 1))}` : ''}</div>` : '';
  return `<div class="grab"></div><div class="row"><div class="ico" style="width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:${tint(T.color, 20)};color:${T.color}">${ic(T.icon)}</div><h3 class="sp">${isNew ? T.label : 'Editar ' + T.label.toLowerCase()}</h3><button class="ibtn" data-act="f-cancel">${ic('x')}</button></div>
  <form class="col" style="margin-top:14px" data-submit="ev-save">${typeChips}${isNew ? `<div class="muted sm" style="margin:-6px 0 0">${C.dateLong(e.date)}</div><details class="sub" data-sec="dtchg"><summary>Mudar a data</summary><div style="margin-top:10px"><input data-f="date" type="date" required value="${e.date}"></div></details>` : f('date', 'Data', `<input data-f="date" type="date" required value="${e.date}">`)}${days}${fields}${e.type === 'obs' || e.note ? f('note', e.type === 'obs' ? 'Observação' : 'Observações', `<textarea data-f="note" placeholder="Escreva aqui…">${esc(e.note || '')}</textarea>`) : `<details class="sub" data-sec="notemore"><summary>Adicionar observação</summary><div style="margin-top:10px"><textarea data-f="note" placeholder="Detalhes, local, motivo…"></textarea></div></details>`}
  <div class="row"><button class="btn pri sp" type="submit">${ic('check')}Salvar</button>${isNew ? '' : `<button class="btn dng" type="button" data-act="ev-del" data-id="${e.id}">${ic('trash')}</button>`}</div></form>`;
}
function ocForm() {
  const e = S.draft; const isNew = !e.id; const ph = e.photos || []; const prio = e.prio || 'Normal';
  const tpls = isNew ? `<div class="chips scrollx">${C.OC_TPL.map((t, i) => `<button type="button" class="chip" data-act="oc-tpl" data-i="${i}">${t.t}</button>`).join('')}</div>` : '';
  return `<div class="grab"></div><div class="row"><h3 class="sp">${isNew ? 'Nova ocorrência' : 'Ocorrência'}</h3><button class="ibtn" data-act="f-cancel" aria-label="Fechar">${ic('x')}</button></div>
  <form class="col" style="margin-top:14px" data-submit="ev-save">${tpls}
   <label class="f">Título<input data-f="title" value="${esc(e.title || '')}" placeholder="O que aconteceu?"></label>
   <div class="grid2"><label class="f">Data<input data-f="date" type="date" required value="${e.date}"></label><label class="f">Hora<input data-f="time" type="time" value="${e.time || ''}"></label></div>
   <div class="f lbl" style="margin-bottom:-4px">Categoria e prioridade</div><div class="chips">${C.OC_CATS.map((c) => `<button type="button" class="chip ${(e.cat || 'Rotina') === c ? 'on' : ''}" data-act="f-set" data-k="cat" data-v="${c}">${c}</button>`).join('')}</div>
   <div class="seg prio">${C.OC_PRIO.map((p) => `<button type="button" class="${prio === p ? 'on' : ''}" data-p="${p}" data-act="f-set" data-k="prio" data-v="${p}">${p}</button>`).join('')}</div>
   <label class="f">Descrição<textarea data-f="note" placeholder="Descreva o fato com clareza…">${esc(e.note || '')}</textarea></label>
   <button type="button" class="btn sm ${S.dict ? 'dng' : ''}" data-act="dictate">${ic('mic')}${S.dict ? 'Ouvindo… toque para parar' : 'Ditar a descrição'}</button>
   <details class="sub" data-sec="ocmore" ${e.place || e.people || S.open.has('ocmore') ? 'open' : ''}><summary>Local e envolvidos</summary><div class="col" style="margin-top:10px"><label class="f">Local<input data-f="place" list="places" value="${esc(e.place || '')}" placeholder="Ex.: Pavilhão B"><datalist id="places">${S.d.posts.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label><label class="f">Envolvidos<input data-f="people" value="${esc(e.people || '')}" placeholder="Nomes ou matrículas"></label></div></details>
   <div class="f lbl">Fotos (até 4)</div><div class="pgrid">${ph.map((u, k) => `<div class="pth"><img src="${u}" alt="Foto ${k + 1}"><button type="button" data-act="photo-del" data-i="${k}" aria-label="Remover foto">${ic('x')}</button></div>`).join('')}${ph.length < 4 ? `<label class="btn sm">${ic('camera')}Câmera<input type="file" accept="image/*" capture="environment" data-photo class="hidden"></label><label class="btn sm">${ic('image')}Galeria<input type="file" accept="image/*" multiple data-photo class="hidden"></label>` : ''}</div>
   <div class="row"><button class="btn pri sp" type="submit">${ic('check')}Salvar</button>${isNew ? '' : `<a class="btn" data-act="oc-share" data-native href="#" target="_blank" rel="noopener" aria-label="Enviar no WhatsApp">${ic('chat')}</a><button class="btn dng" type="button" data-act="ev-del" data-id="${e.id}" aria-label="Excluir">${ic('trash')}</button>`}</div></form>`;
}
function rosterSheet() {
  const R = S.roster; const can = hasAI(S.d.prefs.ai); let body;
  const pick = `<div class="grid2"><label class="btn pri">${ic('camera')}Tirar foto<input type="file" accept="image/*" capture="environment" data-roster-file class="hidden"></label><label class="btn">${ic('image')}Galeria<input type="file" accept="image/*" data-roster-file class="hidden"></label></div>`;
  if (!R.image) body = `<p class="muted sm" style="margin:0">Envie a foto que veio no grupo do WhatsApp. ${can ? 'A IA lê a lista e marca os seus quartos.' : 'Você vê a foto e marca os quartos tocando.'}</p>${pick}${can ? '' : `<button class="btn blk" data-act="go" data-v="settings">${ic('sparkles')}Ligar a leitura automática (IA)</button>`}`;
  else body = `<img class="rimg" src="${R.image}" alt="Foto da escala"><label class="f">Data do plantão<input type="date" data-roster-date value="${R.date}"></label>${can && !R.entries ? `<button class="btn pri blk" data-act="roster-read" ${R.busy ? 'disabled' : ''}>${ic('sparkles')}${R.busy ? 'Lendo a foto…' : 'Ler quartos com IA'}</button>` : ''}${R.err ? `<div class="err">${esc(R.err)}</div>` : ''}${R.entries ? rosterList() : ''}<div class="h2" style="margin:0">Marcar manualmente · ${C.fmtShort(R.date)}</div>${qEditor(R.date, { onlyNight: true })}<div class="grid2"><button class="btn" data-act="roster-reset">Trocar foto</button><button class="btn" data-act="roster-save">Guardar no livro</button></div>`;
  return `<div class="grab"></div><div class="row"><h3 class="sp">Foto do quarto de hora</h3><button class="ibtn" data-act="close">${ic('x')}</button></div><div class="col" style="margin-top:12px">${body}</div>`;
}
function rosterList() {
  const rows = S.roster.entries; if (!rows.length) return '<div class="empty sm">Não encontrei linhas legíveis. Tente uma foto mais nítida ou marque manualmente.</div>';
  const mine = rows.filter((r) => r.mine).length;
  return `<div class="muted sm">${mine ? `Achei ${mine} linha(s) com o seu nome.` : 'Não achei o seu nome. Confira Ajustes → nome na escala, ou marque as linhas abaixo.'}</div><div class="list">${rows.map((r, i) => { const q = S.d.quarters.find((x) => x.id === r.slotId); return `<label class="item" style="${r.mine ? 'border-color:var(--accent)' : ''}"><input type="checkbox" data-ri="${i}" ${r.checked ? 'checked' : ''} ${q ? '' : 'disabled'}><div class="sp" style="min-width:0"><div class="t">${esc(r.name)}${r.mine ? ' · você' : ''}</div><div class="s">${q ? C.qLabel(q) : '⚠ faixa não reconhecida: ' + esc(r.slotText)}${r.post ? ' · ' + esc(r.post) : ''}</div></div></label>`; }).join('')}</div><button class="btn pri blk" data-act="roster-apply">${ic('check')}Marcar selecionados (${rows.filter((r) => r.checked).length})</button>`;
}
function pinSheet() { return `<div class="grab"></div><div class="row"><h3 class="sp">${S.d.prefs.pin ? 'Alterar PIN' : 'Criar PIN'}</h3><button class="ibtn" data-act="close">${ic('x')}</button></div><form class="col" style="margin-top:14px" data-submit="pin-save"><label class="f">PIN (4 a 6 números)<input name="p1" type="password" inputmode="numeric" pattern="[0-9]{4,6}" minlength="4" maxlength="6" required autocomplete="off"></label><label class="f">Repita o PIN<input name="p2" type="password" inputmode="numeric" pattern="[0-9]{4,6}" minlength="4" maxlength="6" required autocomplete="off"></label><div id="pinErr"></div><button class="btn pri">Salvar PIN</button></form>`; }
function pwSheet() { return `<div class="grab"></div><div class="row"><h3 class="sp">Alterar senha</h3><button class="ibtn" data-act="close">${ic('x')}</button></div><form class="col" style="margin-top:14px" data-submit="pw-save"><label class="f">Senha atual<input name="old" type="password" required autocomplete="current-password"></label><label class="f">Nova senha<input name="n1" type="password" minlength="6" required autocomplete="new-password"></label><div id="pwErr"></div><button class="btn pri">Salvar nova senha</button></form>`; }

const assistant = createAssistant({
  data: () => S.d, save, title: evTitle, close: () => closeSheet(), goto: (v) => go(v),
  add: (e) => { addEvent(e); }, edit: (e) => { closeSheet(); openForm(e); },
  ctx: () => ({ quarters: S.d.quarters, posts: S.d.posts }),
  addQuartos: (date, ids, post) => { ids.forEach((id) => setQuarto(date, id, post, true)); save(); render(); },
  roster: () => { assistant.unmount(); S.sheet = null; A['roster-open']({ dataset: { date: C.today() } }); },
  openAI: () => { assistant.unmount(); S.sheet = null; renderSheet(); S.open.add('ia'); go('settings'); setTimeout(() => $('details[data-sec=ia]')?.scrollIntoView({ block: 'start' }), 150); },
});
const setQuarto = (date, slot, post, force = false) => { const e = S.d.events.find((x) => x.type === 'quarto' && x.date === date && x.slot === slot); if (e) { if (force) e.post = post || ''; } else S.d.events.push({ id: C.uid(), type: 'quarto', date, slot, post: post || '' }); };
const qGroups = (date) => { const m = new Map(); for (const e of C.quartosOn(S.d, date)) { if (!m.has(e.slot)) m.set(e.slot, { slot: e.slot, evs: [], posts: [] }); const g = m.get(e.slot); g.evs.push(e); if (e.post) g.posts.push(e.post); } return [...m.values()]; };
const addQuarto = (date, slot, post) => { const list = S.d.events.filter((x) => x.type === 'quarto' && x.date === date && x.slot === slot); if (list.some((x) => (x.post || '') === (post || ''))) return; const blank = list.find((x) => !x.post); if (blank && post) blank.post = post; else if (!post && list.length) return; else S.d.events.push({ id: C.uid(), type: 'quarto', date, slot, post: post || '' }); };
const infoStyle = () => S.d.prefs.infoStyle || 'cartoes';
// Itens do dia: posto do dia, horários específicos e quartos da noite
function dayItems(date) {
  const out = []; const m = postoDia(date);
  if (m) out.push({ k: 'day', post: postoLabel(m), time: 'Dia' });
  postosDia(date).filter((x) => x.from).sort((x, y) => x.from.localeCompare(y.from)).forEach((x) => out.push({ k: 'timed', post: postoLabel(x), time: `${x.from}${x.to ? '–' + x.to : ''}` }));
  qGroups(date).forEach((g) => { const q = S.d.quarters.find((x) => x.id === g.slot); out.push({ k: 'night', slot: g.slot, post: g.posts.length ? g.posts.join(' + ') : 'Sem posto', time: q ? `${q.alvorada ? 'Alvorada ' : ''}${C.qLabel(q)}` : g.slot }); });
  return out;
}
// estado: 'act' (em andamento) | 'nxt' (próximo)
function renderItems(items, style, ctx = {}) {
  if (!items.length) return '';
  const stt = (i) => (i.k === 'night' && i.slot === ctx.nextSlot ? (ctx.active ? 'act' : 'nxt') : '');
  if (style === 'linha') return `<div class="itl">${items.map((i) => { const s2 = stt(i); return `<div class="it ${s2} ${i.k}"><span class="itt">${esc(i.time)}</span><i class="itd"></i><div class="itp"><b>${esc(i.post)}</b>${i.note ? `<small class="nt">${esc(i.note)}</small>` : ''}${s2 ? `<small>${s2 === 'act' ? 'agora' : ctx.eta || 'próximo'}</small>` : ''}</div></div>`; }).join('')}</div>`;
  return `<div class="ilist">${items.map((i) => { const s2 = stt(i); return `<div class="ir ${s2} ${i.k}"><b>${esc(i.post)}</b><span>${esc(i.time)}${i.note ? ' · ' + esc(i.note) : ''}</span>${s2 ? `<em>${s2 === 'act' ? 'agora' : ctx.eta || 'próximo'}</em>` : ''}</div>`; }).join('')}</div>`;
}
const postosDia = (date) => S.d.events.filter((x) => x.type === 'posto' && x.date === date);
const postoDia = (date) => postosDia(date).find((x) => !x.from);
const postoLabel = (e) => `${e.post}${e.where ? ' · ' + e.where : ''}`;
const needsWhere = (r) => (S.d.dayNeedWhere || []).includes(r);
const whereOpts = () => S.d.posts.filter((p) => /^bloco\s/i.test(p));
const nightPosts = () => S.d.posts.filter((p) => !needsWhere(p));
// "Superior · 14:00 G1" — o que está escalado durante o dia
const diaResumo = (date) => { const m = postoDia(date); const t = postosDia(date).filter((x) => x.from).sort((x, y) => x.from.localeCompare(y.from)); return [m ? postoLabel(m) : '', ...t.map((x) => `${x.from}${x.to ? '–' + x.to : ''} ${postoLabel(x)}`)].filter(Boolean).join(' · '); };
const activePost = () => { const np = nightPosts(); const l = S.qpost !== undefined ? S.qpost : S.d.prefs.lastPost; return np.includes(l) ? l : (S.qpost === '' ? '' : (np[0] || '')); };
const refreshQ = () => { save(); render(); if (S.sheet) renderSheet(); };
function showAlarm(a) {
  S.alarm = a; playSound(a.sound, { ramp: S.d.prefs.ramp }); notify(a); clearTimeout(S.alarmT); S.alarmT = setTimeout(() => { if (S.alarm === a) A['alarm-off'](); }, (S.d.prefs.autostop || 5) * 60000); let r = $('#alarmRoot'); if (!r) { r = document.createElement('div'); r.id = 'alarmRoot'; document.body.appendChild(r); }
  r.innerHTML = `<div class="overlay" style="z-index:120;align-items:center;background:rgba(110,0,0,.6)"><div class="sheet" style="border-radius:28px;max-width:380px;text-align:center;padding:28px"><div class="logo" style="margin:0 auto 14px;background:var(--danger)">${ic('alert')}</div><h3 style="font-size:24px">${esc(a.title)}</h3><p class="muted">${esc(a.body)}</p><div class="row" style="margin-top:16px"><button class="btn pri sp" data-act="alarm-off">Entendido</button><button class="btn sp" data-act="alarm-snooze">Soneca ${S.d.prefs.snooze || 5} min</button></div></div></div>`;
}
// Botão Voltar do Android/navegador fecha a folha aberta (em vez de sair do app)
function openSheet(kind, extra = {}) {
  if (!S.sheet) { try { history.pushState({ sheet: 1 }, ''); S.histN = (S.histN || 0) + 1; } catch { /* sem histórico */ } }
  S.sheet = { kind, ...extra }; renderSheet();
}
function closeSheet(fromPop = false) {
  if (S.sheet?.kind === 'ai') assistant.unmount(); S.sheet = null; renderSheet();
  if (!fromPop && S.histN > 0) { const n = S.histN; S.histN = 0; try { history.go(-n); } catch { /* ok */ } }
}
window.addEventListener('popstate', () => { if (S.sheet) { S.histN = Math.max(0, (S.histN || 0) - 1); closeSheet(true); } });
function renderSheet() {
  const root = $('#sheetRoot'); const sh = S.sheet; if (!sh) { root.innerHTML = ''; root.dataset.kind = ''; document.body.style.overflow = ''; return; }
  document.body.style.overflow = 'hidden';
  if (!root.firstChild || root.dataset.kind !== sh.kind) { root.dataset.kind = sh.kind; root.innerHTML = `<div class="overlay" data-act="overlay"><div class="sheet" role="dialog" aria-modal="true"></div></div>`; }
  const el = $('.sheet', root); const top = el.scrollTop;
  if (sh.kind === 'ai') assistant.mount(el);
  else { el.innerHTML = { day: () => daySheet(sh.date), quartos: () => quartosSheet(sh.date), form: formSheet, pw: pwSheet, pinset: pinSheet, roster: rosterSheet }[sh.kind](); el.scrollTop = top; }
}
function openForm(base) {
  const T = C.TYPES[base.type]; const e = { turno: 'diurna', dir: 'passei', ...base };
  if (e.photo && !e.photos) { e.photos = [e.photo]; delete e.photo; }
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
  el.innerHTML = { dashboard, plantao: plantaoView, calendar, quartos: quartosView, finance, summary, livro: livroView, more: moreView, settings }[S.view]();
  el.classList.toggle('enter', !!S.anim); S.anim = false;
}
function render() {
  C.applyColors(S.d && S.d.prefs && S.d.prefs.colors);
  applyTheme(); const root = $('#root');
  if (!S.uid) { root.innerHTML = authView(); return; }
  if (!S.d.onboarded) { root.innerHTML = onboardView(); return; }
  const keep = window.scrollY;
  root.innerHTML = shell(); renderView(); window.scrollTo(0, keep);
}
function go(v) { S.view = v; S.anim = true; S.sheet && closeSheet(); render(); window.scrollTo(0, 0); if (v === 'quartos') setTimeout(() => $('#qtoday')?.scrollIntoView({ block: 'center' }), 60); }

// ---------- TRAVA POR PIN ----------
function renderLock() {
  let r = $('#lockRoot'); if (!r) { r = document.createElement('div'); r.id = 'lockRoot'; document.body.appendChild(r); }
  if (!S.locked) { r.innerHTML = ''; return; }
  const len = S.d.prefs.pin.len; const dots = Array.from({ length: len }, (_, i) => `<i class="${i < S.pinBuf.length ? 'on' : ''}"></i>`).join('');
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => (k === '' ? '<span></span>' : `<button data-act="pin-key" data-k="${k}" aria-label="${k === '⌫' ? 'Apagar' : k}">${k}</button>`)).join('');
  r.innerHTML = `<div class="lock"><div class="logo">${ic('lock')}</div><h2>Digite o PIN</h2><div class="dots ${S.pinErr ? 'err' : ''}">${dots}</div><div class="muted sm" style="min-height:20px">${S.pinMsg || ''}</div><div class="keypad">${keys}</div>${S.d.prefs.bio && isNative() ? `<button class="btn sm" data-act="pin-bio">${ic('lock')}Usar biometria</button>` : ''}<button class="link" data-act="pin-forgot">Esqueci o PIN</button></div>`;
}
function lockNow() { if (S.uid && S.d?.prefs.pin) { S.locked = true; S.pinBuf = ''; S.pinErr = false; S.pinMsg = ''; renderLock(); if (S.d.prefs.bio && isNative()) setTimeout(() => A['pin-bio'](), 350); } }

// ---------- CONFIRMAÇÃO (substitui confirm() nativo) ----------
function ask(msg, ok = 'Confirmar') {
  return new Promise((res) => {
    let r = $('#askRoot'); if (!r) { r = document.createElement('div'); r.id = 'askRoot'; document.body.appendChild(r); }
    r.innerHTML = `<div class="overlay" style="z-index:90;align-items:center"><div class="sheet" style="border-radius:26px;max-width:380px;padding:22px"><h3 style="margin-bottom:8px">Confirmar</h3><p class="muted" style="margin:0 0 18px;white-space:pre-line">${esc(msg)}</p><div class="row"><button class="btn sp" data-k="0">Cancelar</button><button class="btn pri sp" data-k="1">${esc(ok)}</button></div></div></div>`;
    r.onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; r.innerHTML = ''; res(b.dataset.k === '1'); };
  });
}

// ---------- AÇÕES ----------
const setPath = (path, val) => { const ks = path.split('.'); let o = S.d; for (const k of ks.slice(0, -1)) o = (o[k] ??= {}); o[ks.at(-1)] = val; };
const shiftMonth = (o, n) => { const dt = new Date(o.y, o.m + n, 1); o.y = dt.getFullYear(); o.m = dt.getMonth(); };
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } toast('Texto copiado! ✅'); };
const start = async (id, remember = true) => { S.uid = id; S.user = Store.user(id); S.d = Store.load(id) || defaultData(S.user.name); Store.startSession(id, remember); S.view = 'dashboard'; render(); syncAlarmsSoon(); loadAlarmStatus(); };

const A = {
  'auth-tab': (el) => { S.auth = { tab: el.dataset.v, err: '' }; render(); },
  guest: async () => { const { user, data } = await Store.register({ name: 'Meu perfil', guest: true }); data.onboarded = true; data.scale = C.defaultScale(C.today()); Store.save(user.id, data); await start(user.id, true); toast('Escala 24x72 configurada — hoje é seu plantão ✅'); },
  logout: async () => { if (!(await ask('Sair da conta?', 'Sair'))) return; Store.endSession(); S.uid = S.d = S.user = null; S.sheet = null; renderSheet(); render(); },
  'delete-account': async () => { if (!(await ask('Excluir a conta e TODOS os dados deste aparelho? Não dá para desfazer.', 'Excluir'))) return; Store.deleteAccount(S.uid); S.uid = S.d = S.user = null; render(); },
  go: (el) => go(el.dataset.v), ai: () => openSheet('ai'), close: () => closeSheet(),
  overlay: (el, ev) => { if (ev.target === el) (S.sheet?.kind === 'form' && S.sheet.back) ? A['f-cancel']() : closeSheet(); },
  // onboarding
  'ob-next': () => { const st = S.ob.step; if (st === 1 && S.ob.today) S.d.scale.anchor = C.today(); if (st === 0 && !S.d.profile.name.trim()) return toast('Informe seu nome', 'err'); if (st === 3) { S.d.onboarded = true; save(); render(); toast('Bem-vindo ao Sentinela! 🛡️'); return; } S.ob.step++; save(); render(); },
  'ob-back': () => { S.ob.step--; render(); }, 'ob-today': (el) => { S.ob.today = el.dataset.v === '1'; if (S.ob.today) S.d.scale.anchor = C.today(); render(); },
  preset: (el) => { const k = el.dataset.v, p = C.PRESETS[k]; const sc = S.d.scale; sc.preset = k; if (k !== 'custom') { sc.work = p.work; sc.off = p.off; sc.hours = p.hours; if (k === '12x36' && sc.start === '07:00') sc.start = '07:00'; } save(); render(); },
  'anchor-today': () => { S.d.scale.anchor = C.today(); save(); render(); toast('Hoje agora é dia de plantão ✅'); },
  theme: (el) => { S.d.prefs.theme = el.dataset.v; save(); render(); },
  // calendário / nav mensal
  'cal-pick': (el) => { const dt = el.dataset.date; if (S.calTapped === dt) { S.calTapped = null; return openSheet('day', { date: dt }); } S.calSel = dt; S.calTapped = dt; render(); },
  'cal-prev': () => { S.calTapped = null; shiftMonth(S.cal, -1); S.calDir = 'r'; render(); S.calDir = ''; }, 'cal-next': () => { S.calTapped = null; shiftMonth(S.cal, 1); S.calDir = 'l'; render(); S.calDir = ''; }, 'cal-today': () => { S.calDir = (S.cal.y * 12 + S.cal.m) > (nowD.getFullYear() * 12 + nowD.getMonth()) ? 'r' : 'l'; S.cal = { y: nowD.getFullYear(), m: nowD.getMonth() }; render(); S.calDir = ''; },
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
  'f-set': (el) => { const e = S.draft; const k = el.dataset.k; if (k === 'turno' && e.type === 'extra' && !e.id) e.value = S.d.money[el.dataset.v]; e[k] = el.dataset.v; renderSheet(); },
  'ev-rm': (el) => {
    const ev = S.d.events.find((x) => x.id === el.dataset.id); if (!ev) return;
    S.d.events = S.d.events.filter((x) => x.id !== ev.id); save(); renderSheet(); render();
    toast(`${C.TYPES[ev.type].label} removida`, '', () => { S.d.events.push(ev); save(); renderSheet(); render(); });
  },
  'ev-quick': (el) => {
    const k = el.dataset.k; const date = el.dataset.date;
    if (k === 'folga') { S.d.events.push({ id: C.uid(), type: 'folga', date, note: '' }); toast('Folga registrada ✅'); }
    else {
      const ex = S.d.events.find((x) => x.type === 'extra' && x.date === date);
      if (ex) { ex.turno = k; ex.value = S.d.money[k]; toast(`Extra alterada para ${C.TURNOS[k].replace(' (12h)', '').toLowerCase()} ✅`); }
      else { S.d.events.push({ id: C.uid(), type: 'extra', date, turno: k, value: S.d.money[k], paid: false, note: '' }); toast(`${C.TURNOS[k].replace(' (12h)', '')} registrada ✅`); }
    }
    save(); renderSheet(); render();
  },
  'f-cancel': () => { const b = S.sheet?.back; b ? openSheet('day', { date: b }) : closeSheet(); },
  'qv-all': () => { S.qv.all = !S.qv.all; renderView(); },
  'qv-prev': () => { shiftMonth(S.qv, -1); render(); }, 'qv-next': () => { shiftMonth(S.qv, 1); render(); },
  'liv-prev': () => { shiftMonth(S.liv, -1); render(); }, 'liv-next': () => { shiftMonth(S.liv, 1); render(); },
  'q-open': (el) => { const date = el.dataset.date; const back = S.sheet?.kind === 'day' ? date : null; S.tadd = false; S.qsel = null; S.sheet = null; openSheet('quartos', { date, back }); },
  'q-back': () => { const d = S.sheet.date; S.qsel = null; openSheet('day', { date: d }); },
  'q-slot': (el) => {
    const { date, q } = el.dataset; const post = activePost(); const list = S.d.events.filter((x) => x.type === 'quarto' && x.date === date && x.slot === q);
    if (!post) { if (list.length) S.d.events = S.d.events.filter((x) => !list.includes(x)); else addQuarto(date, q, ''); }
    else if (list.some((x) => x.post === post)) S.d.events = S.d.events.filter((x) => !(list.includes(x) && x.post === post));
    else { addQuarto(date, q, post); askNotifyPermission(); }
    refreshQ();
  },
  'q-setpost': (el) => { S.qpost = el.dataset.v; S.d.prefs.lastPost = S.qpost; save(); renderSheet(); },
  'qd-open': (el) => { const cur = S.qopen === undefined ? 'night' : S.qopen; S.qopen = cur === el.dataset.v ? '' : el.dataset.v; S.tadd = false; renderSheet(); },
  'dp-main': (el) => {
    const { date, v } = el.dataset; const cur = postoDia(date);
    if (cur && cur.post === v) S.d.events = S.d.events.filter((x) => x !== cur); else if (cur) { cur.post = v; cur.where = ''; } else S.d.events.push({ id: C.uid(), type: 'posto', date, post: v, where: '' });
    refreshQ();
  },
  'dp-where': (el) => { const m = postoDia(S.sheet.date); if (m) { m.where = m.where === el.dataset.v ? '' : el.dataset.v; refreshQ(); } },
  'dp-tadd': () => { S.tadd = true; S.tdraft = { post: '', where: '', from: '', to: '' }; renderSheet(); },
  'dp-tcancel': () => { S.tadd = false; renderSheet(); },
  'dp-trole': (el) => { S.tdraft.post = el.dataset.v; if (!needsWhere(el.dataset.v)) S.tdraft.where = ''; renderSheet(); },
  'dp-twhere': (el) => { S.tdraft.where = el.dataset.v; renderSheet(); },
  'dp-tsave': () => {
    const t = S.tdraft; if (!t.post) return toast('Escolha o posto', 'err'); if (!t.from) return toast('Informe o horário inicial', 'err'); if (needsWhere(t.post) && !t.where) return toast('Escolha o bloco', 'err');
    S.d.events.push({ id: C.uid(), type: 'posto', date: S.sheet.date, post: t.post, where: t.where || '', from: t.from, to: t.to || '' }); S.tadd = false; refreshQ();
  },
  'dp-tdel': (el) => { S.d.events = S.d.events.filter((x) => x.id !== el.dataset.id); refreshQ(); },
  'q-all': (el) => { const post = activePost(); S.d.quarters.forEach((q) => addQuarto(el.dataset.date, q.id, post)); if (post) askNotifyPermission(); refreshQ(); },
  'q-none': (el) => { S.d.events = S.d.events.filter((x) => !(x.type === 'quarto' && x.date === el.dataset.date)); refreshQ(); },
  'q-posts': () => { S.open.add('quartos'); S.qsel = null; closeSheet(); go('settings'); setTimeout(() => $('#cfg-postos')?.scrollIntoView({ block: 'start' }), 120); },
  'liv-cat': (el) => { S.livf.cat = el.dataset.v; renderView(); },
  zoom: (el) => { S.d.prefs.zoom = Number(el.dataset.v); save(); render(); },
  'info-style': (el) => { S.d.prefs.infoStyle = el.dataset.v; save(); render(); toast('Informações: ' + ({ cartoes: 'Cartões', lista: 'Lista', linha: 'Linha do tempo' })[el.dataset.v]); },
  'layout': (el) => { const v = el.dataset.v; S.d.prefs.layout = v; if (v === 'classico' && ['dark', 'auto'].includes(S.d.prefs.theme)) S.d.prefs.theme = 'tatico'; save(); render(); toast(v === 'classico' ? 'Estilo Clássico (tema Tático azul)' : 'Estilo Moderno'); },
  'colors-reset': () => { S.d.prefs.colors = {}; save(); render(); toast('Cores restauradas'); },
  'avatar-edit': async () => { try { const out = await editPhoto(S.d.profile.photo); if (out) { S.d.profile.photo = out; save(); render(); toast('Foto ajustada ✅'); } } catch (e) { toast(e.message, 'err'); } },
  'avatar-del': () => { delete S.d.profile.photo; save(); render(); },
  'cloud-up': async () => {
    const c = S.d.prefs.cloud;
    try { const m = await getMeta(c); if (m && m.updatedAt > (S.d.prefs.cloudAt || 0) + 2000 && !(await ask(`A nuvem tem um backup mais novo (${new Date(m.updatedAt).toLocaleString('pt-BR')}, de ${m.device || 'outro aparelho'}). Substituir mesmo assim?`, 'Substituir'))) return; } catch (e) { return toast(explain(e), 'err'); }
    await cloudUpload();
  },
  'cloud-down': () => cloudRestore(),
  'cloud-verify-resend': async () => { try { await sendVerify(S.d.prefs.cloud); toast('E-mail de confirmação reenviado ✅ (olhe também o spam)'); } catch (e) { toast(explain(e), 'err'); } },
  'cloud-verify-check': async () => { const c = S.d.prefs.cloud; try { await refreshVerified(c); Store.save(S.uid, S.d); renderView(); if (c.verified) { toast('E-mail confirmado ✅'); cloudUpload(); } else toast('Ainda não confirmado. Toque no link do e-mail e tente de novo.', 'err'); } catch (e) { toast(explain(e), 'err'); } },
  'google-cloud': async () => { const s = await googleLogin(); if (s) { try { await afterCloudLogin(s); } catch (e) { toast(explain(e), 'err'); } } },
  'google-entry': async () => {
    const s = await googleLogin(); if (!s) return;
    try {
      let u = Store.users().find((x) => x.email === s.email);
      if (!u) { const r = await Store.register({ name: s.name || 'Meu perfil', email: s.email, password: crypto.getRandomValues(new Uint32Array(4)).join('-') }); u = r.user; Store.updateUser(u.id, { google: true }); S.ob = { step: 0, today: true }; }
      await start(u.id, true); await afterCloudLogin(s);
    } catch (e) { toast(explain(e), 'err'); }
  },
  'cloud-out': async () => { if (!(await ask('Sair da nuvem neste aparelho? O backup continua guardado lá.', 'Sair'))) return; delete S.d.prefs.cloud; save(); renderView(); },
  'cloud-reset': async () => { const em = String(($('#cloudEmail') || {}).value || '').trim(); if (!em) return toast('Digite seu e-mail acima', 'err'); try { await resetPassword(em); toast('Enviamos um e-mail para criar nova senha ✅'); } catch (e) { toast(explain(e), 'err'); } },
  'cloud-check': async () => { const r = await checkAuthEnabled(); toast(r.ok ? 'Login por e-mail ativado ✅' : r.msg, r.ok ? '' : 'err'); },
  'cell-style': (el) => { S.d.prefs.cellStyle = el.dataset.v; save(); renderView(); },
  'snd-test': async (el) => {
    const q = el.dataset.qi !== undefined ? S.d.quarters[+el.dataset.qi] : null; const id = el.dataset.sid || (q && q.sound) || S.d.prefs.sound;
    if (!isBuiltin(id)) { try { await NativeAlarm.preview(id); } catch { toast('Esse som só toca no app Android', 'err'); } return; }
    playSound(id, { previewMs: 3500 });
  },
  'nat-test': async () => { try { await NativeAlarm.test(10, S.d.prefs.sound); toast('Alarme daqui a 10 segundos. Bloqueie a tela!'); } catch (e) { toast(e.message || 'Falha no teste', 'err'); } },
  'nat-refresh': () => { loadAlarmStatus(); syncAlarms(); },
  'upd-check': () => runUpdateCheck(true),
  'upd-get': async () => { try { await openApkDownload(); } catch (e) { toast('Não consegui abrir o download'); } },
  'nat-fix': async (el) => { try { if (el.dataset.k === 'notif') await NativeAlarm.requestNotifications(); await NativeAlarm.openSettings(el.dataset.k); } catch (e) { toast(e.message || 'Não consegui abrir os ajustes', 'err'); } },
  'sound-import': async () => { try { const r = await NativeAlarm.pickSound(); if (r && r.id) { S.d.customSounds.push({ id: r.id, name: r.name || 'Meu som' }); save(); renderView(); toast('Som importado ✅'); } } catch (e) { if (!/cancel/i.test(e.message || '')) toast(e.message || 'Não consegui importar', 'err'); } },
  'sound-del': async (el) => { const id = el.dataset.sid; try { await NativeAlarm.removeSound(id); } catch { /* */ } S.d.customSounds = S.d.customSounds.filter((x) => x.id !== id); if (S.d.prefs.sound === id) S.d.prefs.sound = DEFAULT_SOUND; S.d.quarters.forEach((q) => { if (q.sound === id) q.sound = ''; }); save(); renderView(); },
  'hol-add': () => { const dt = $('#holDate').value; const nm = $('#holName').value.trim(); if (!dt || !nm) return toast('Informe a data e o nome', 'err'); S.d.holidays.push({ md: dt.slice(5), name: nm }); save(); renderView(); toast('Feriado adicionado ✅'); },
  'hol-del': (el) => { S.d.holidays.splice(+el.dataset.i, 1); save(); renderView(); },
  'oc-tpl': (el) => { const t = C.OC_TPL[+el.dataset.i]; S.draft.title = t.t; S.draft.cat = t.cat; renderSheet(); },
  dictate: () => {
    if (S.dict) { S.dict(); return; }
    if (!canListen()) return toast('O ditado precisa do app Android ou de Chrome, Edge ou Safari', 'err');
    S.dict = startListening({
      prompt: 'Dite a descrição',
      onText: (text, final) => { if (final && text) { S.draft.note = ((S.draft.note || '') + ' ' + text).trim(); const ta = $('[data-f=note]'); if (ta) ta.value = S.draft.note; } },
      onEnd: () => { S.dict = null; if (S.sheet?.kind === 'form') renderSheet(); },
      onError: (e) => { S.dict = null; toast(e.code === 'not-allowed' ? 'Permita o microfone' : 'Não consegui ouvir', 'err'); },
    });
    renderSheet();
  },
  'photo-del': (el) => { S.draft.photos.splice(+el.dataset.i, 1); renderSheet(); },
  'oc-share': (el) => {
    const e = S.draft; const L = [`📒 *OCORRÊNCIA${e.prio && e.prio !== 'Normal' ? ' · ' + e.prio.toUpperCase() : ''}* — ${C.dateLong(e.date)}`, `🕐 ${e.time || '--:--'} · ${e.cat || 'Rotina'}`, `*${e.title || 'Sem título'}*`]; if (e.place) L.push(`📍 ${e.place}`); if (e.people) L.push(`👥 ${e.people}`); if (e.note) L.push('', e.note); L.push('', `_Registrado no Sentinela Tático_`);
    el.href = waLink(L.join('\n'), '');
  },
  'q-add': () => { S.d.quarters.push({ id: C.uid(), start: '00:00', end: '02:00' }); save(); renderView(); },
  'q-del': (el) => { S.d.quarters.splice(+el.dataset.i, 1); save(); renderView(); },
  'q-reset': async () => { if (!(await ask('Restaurar os quartos padrão (18h às 8h)?', 'Restaurar'))) return; S.d.quarters = C.DEFAULT_QUARTERS.map((q) => ({ ...q })); save(); renderView(); },
  'post-add': () => { const v = $('#postNew').value.trim(); if (!v) return; if (!S.d.posts.includes(v)) S.d.posts.push(v); save(); renderView(); },
  'post-up': (el) => { const i = +el.dataset.i; if (i > 0) { const a = S.d.posts; [a[i - 1], a[i]] = [a[i], a[i - 1]]; save(); renderView(); } },
  'post-down': (el) => { const i = +el.dataset.i; const a = S.d.posts; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; save(); renderView(); } },
  'post-sort': () => { const a = S.d.posts; const isB = (x) => /^bloco\s/i.test(x); const blocks = a.filter(isB).sort((x, y) => x.localeCompare(y, 'pt-BR', { numeric: true })); S.d.posts = [...blocks, ...a.filter((x) => !isB(x))]; save(); renderView(); toast('Blocos primeiro ✅'); },
  'post-del': (el) => { S.d.posts.splice(+el.dataset.i, 1); save(); renderView(); },
  'ai-provider': (el) => { S.d.prefs.ai.provider = el.dataset.v; save(); renderView(); },
  'ai-test': async () => { try { toast('Testando…'); const before = S.d.prefs.ai.model; const r = await callLLM(S.d.prefs.ai, { prompt: 'Responda apenas com a palavra OK.' }); if (S.d.prefs.ai.model !== before) save(); renderView(); toast(/ok/i.test(r) ? `IA conectada ✅${S.d.prefs.ai.model && S.d.prefs.ai.model !== before ? ' (modelo ' + S.d.prefs.ai.model + ')' : ''}` : 'A IA respondeu, mas de forma inesperada'); } catch (e) { toast('Falhou: ' + (e.message || 'erro'), 'err'); } },
  notify: async () => { const r = await askNotifyPermission(); toast(r === 'granted' ? 'Notificações liberadas ✅' : 'Notificações bloqueadas no navegador', r === 'granted' ? '' : 'err'); },
  'alarm-test': () => showAlarm({ title: 'Teste de alarme', body: 'É assim que o aviso do quarto vai tocar.', sound: S.d.prefs.sound }),
  'alarm-off': () => { stopSound(); $('#alarmRoot').innerHTML = ''; S.alarm = null; },
  'alarm-snooze': () => { const a = S.alarm; stopSound(); $('#alarmRoot').innerHTML = ''; if (a) setTimeout(() => showAlarm({ ...a, title: a.title.replace(' (soneca)', '') + ' (soneca)' }), (S.d.prefs.snooze || 5) * 60000); toast(`Soneca de ${S.d.prefs.snooze || 5} minutos`); },
  'roster-open': (el) => { S.roster = { date: el.dataset.date || C.today(), image: null, entries: null, busy: false, err: '' }; S.sheet = null; openSheet('roster'); },
  'roster-reset': () => { S.roster.image = null; S.roster.entries = null; S.roster.err = ''; renderSheet(); },
  'roster-read': async () => {
    const R = S.roster; R.busy = true; R.err = ''; renderSheet();
    try { const r = await readRoster(S.d.prefs.ai, R.image, { quarters: S.d.quarters, posts: S.d.posts, profile: S.d.profile }); if (r.date) R.date = r.date; R.entries = r.entries.map((x) => ({ ...x, checked: x.mine && !!x.slotId })); } catch (e) { R.err = e.message || 'Não consegui ler a foto.'; }
    R.busy = false; if (S.sheet?.kind === 'roster') renderSheet();
  },
  'roster-apply': () => { const R = S.roster; let n = 0; for (const r of R.entries.filter((x) => x.checked && x.slotId)) { setQuarto(R.date, r.slotId, r.post); n++; } refreshQ(); toast(n ? `${n} quarto(s) marcado(s) ✅` : 'Nada selecionado'); },
  'roster-save': () => { const R = S.roster; S.d.events.push({ id: C.uid(), type: 'ocorrencia', date: R.date, time: '', title: 'Escala de quartos (foto)', cat: 'Rotina', note: '', photos: [R.image] }); save(); render(); toast('Foto guardada no Livro de ocorrências ✅'); },
  pw: () => openSheet('pw'),
  'pin-new': () => openSheet('pinset'),
  'pin-bio': async () => { if (!S.locked || S.bioBusy) return; S.bioBusy = true; try { await NativeAlarm.bioAuth('Abrir o Sentinela'); S.locked = false; S.pinBuf = ''; S.pinTries = 0; renderLock(); render(); } catch { /* cancelou ou falhou: segue o PIN */ } S.bioBusy = false; },
  'pin-off': async () => { if (!(await ask('Remover o PIN? O app passará a abrir sem pedir senha.', 'Remover'))) return; delete S.d.prefs.pin; save(); renderView(); toast('PIN removido'); },
  'pin-key': async (el) => {
    if (S.lockUntil && Date.now() < S.lockUntil) return; const k = el.dataset.k; const len = S.d.prefs.pin.len;
    if (k === '⌫') S.pinBuf = S.pinBuf.slice(0, -1); else if (S.pinBuf.length < len) S.pinBuf += k;
    S.pinErr = false; S.pinMsg = ''; renderLock();
    if (S.pinBuf.length === len) {
      const ok = (await Store.hashPin(S.pinBuf, S.d.prefs.pin.salt)) === S.d.prefs.pin.hash;
      if (ok) { S.locked = false; S.pinTries = 0; S.pinBuf = ''; renderLock(); render(); return; }
      S.pinTries = (S.pinTries || 0) + 1; S.pinErr = true; S.pinMsg = 'PIN incorreto'; if (S.pinTries >= 5) { S.lockUntil = Date.now() + 30000; S.pinTries = 0; S.pinMsg = 'Muitas tentativas. Aguarde 30 segundos.'; }
      renderLock(); setTimeout(() => { S.pinBuf = ''; S.pinErr = false; renderLock(); }, 450);
    }
  },
  'pin-forgot': async () => {
    if (S.user.guest) return toast('No modo sem cadastro não há recuperação. Limpe os dados do app nas configurações do celular.', 'err');
    if (!(await ask('Sair da conta? Você entra de novo com e-mail e senha, e seus dados continuam salvos.', 'Sair'))) return;
    S.locked = false; renderLock(); Store.endSession(); S.uid = S.d = S.user = null; render();
  },
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
  async 'cloud-login'(f, sub) {
    const fd = new FormData(f); const email = String(fd.get('email')).trim(); const pw = String(fd.get('password')); const up = !!(sub && sub.value === 'up');
    try {
      toast(up ? 'Criando conta…' : 'Entrando…'); const s = up ? await signUp(email, pw) : await signIn(email, pw);
      await afterCloudLogin(s); if (up && s.verifySent) toast('Enviamos um e-mail de confirmação para ' + email);
    } catch (e) { toast(explain(e), 'err'); }
  },
  async 'pin-save'(f) {
    const fd = new FormData(f); const p1 = String(fd.get('p1')), p2 = String(fd.get('p2'));
    if (!/^\d{4,6}$/.test(p1)) { $('#pinErr').innerHTML = '<div class="err">Use de 4 a 6 números.</div>'; return; }
    if (p1 !== p2) { $('#pinErr').innerHTML = '<div class="err">Os PINs não são iguais.</div>'; return; }
    const salt = Store.newSalt(); S.d.prefs.pin = { salt, hash: await Store.hashPin(p1, salt), len: p1.length }; if (S.d.prefs.lockAfter == null) S.d.prefs.lockAfter = 1;
    save(); closeSheet(); renderView(); toast('PIN criado ✅');
  },
  async 'pw-save'(f) {
    const fd = new FormData(f); try { await Store.changePassword(S.uid, fd.get('old'), fd.get('n1')); closeSheet(); toast('Senha alterada ✅'); } catch (e) { $('#pwErr').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el) return; const fn = A[el.dataset.act]; if (fn) { if (el.tagName === 'A' && el.dataset.native === undefined) ev.preventDefault(); fn(el, ev); }
});
document.addEventListener('submit', (ev) => { const f = ev.target.closest('[data-submit]'); if (!f) return; ev.preventDefault(); FORMS[f.dataset.submit]?.(f, ev.submitter); });
// campos do formulário de lançamento
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'livQ') { S.livf.q = t.value; const l = $('#livList'); if (l) l.innerHTML = livList(); return; } if (t.dataset.f && S.draft) { S.draft[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.f === '_days' || t.dataset.f === 'date') renderHint(); }
});
function renderHint() { /* atualização leve do texto "Até dd/mm" ao digitar */ const h = $('#sheetRoot .muted.xs[style*="-6px"]'); if (h) h.textContent = (+S.draft._days || 1) > 1 && S.draft.date ? `Até ${C.fmtBR(C.addDays(S.draft.date, (+S.draft._days || 1) - 1))}` : ''; }
document.addEventListener('change', async (ev) => {
  const t = ev.target;
  if (t.dataset.color) { const pr = S.d.prefs; pr.colors = { ...(pr.colors || {}), [t.dataset.color]: t.value }; save(); render(); return; }
  if (t.dataset.avatar !== undefined && t.files[0]) { const f = t.files[0]; t.value = ''; try { const out = await editPhoto(f); if (out) { S.d.profile.photo = out; save(); render(); toast('Foto atualizada ✅'); } } catch (e) { toast(e.message, 'err'); } return; }
  if (t.dataset.photo !== undefined && t.files.length) { try { const add = []; for (const f of [...t.files].slice(0, 4)) add.push(await compressImage(f, 1024, 0.68)); S.draft.photos = [...(S.draft.photos || []), ...add].slice(0, 4); renderSheet(); } catch (e) { toast(e.message, 'err'); } return; }
  if (t.dataset.rosterFile !== undefined && t.files[0]) { try { S.roster.image = await compressImage(t.files[0]); S.roster.entries = null; S.roster.err = ''; renderSheet(); } catch (e) { toast(e.message, 'err'); } return; }
  if (t.dataset.rosterDate !== undefined) { S.roster.date = t.value || S.roster.date; renderSheet(); return; }
  if (t.dataset.ri !== undefined) { S.roster.entries[+t.dataset.ri].checked = t.checked; renderSheet(); return; }
  if (t.dataset.tf && S.tdraft) { S.tdraft[t.dataset.tf] = t.value; return; }
  if (t.dataset.f && S.draft) { S.draft[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.f === 'turno' && S.draft.type === 'extra') { S.draft.value = S.d.money[t.value]; renderSheet(); } return; }
  if (t.dataset.postI !== undefined) {
    const i = +t.dataset.postI; const old = S.d.posts[i]; const nv = t.value.trim();
    if (!nv) { renderView(); return toast('O nome do posto não pode ficar vazio', 'err'); }
    S.d.events.forEach((e) => { if (e.type === 'quarto' && e.post === old) e.post = nv; }); S.d.posts[i] = nv; save(); return;
  }
  if (t.dataset.daypostlist !== undefined) { S.d.dayPosts = [...new Set(t.value.split('\n').map((x) => x.trim()).filter(Boolean))]; save(); return; }
  if (t.dataset.needwherelist !== undefined) { S.d.dayNeedWhere = [...new Set(t.value.split('\n').map((x) => x.trim()).filter(Boolean))]; save(); return; }
  if (t.dataset.posts !== undefined) { S.d.posts = [...new Set(t.value.split('\n').map((x) => x.trim()).filter(Boolean))]; save(); return; }
  if (t.dataset.bind) {
    let v = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.numstr !== undefined) v = Number(v); if (t.dataset.num !== undefined) v = Math.max(0, Number(v) || 0); if (t.dataset.numnull !== undefined) v = t.value === '' ? null : Math.max(0, Number(t.value) || 0);
    if (t.dataset.bind === 'prefs.wake') keepAwake(v);
    if (t.dataset.bind === 'scale.anchor' && !v) return;
    setPath(t.dataset.bind, v);
    if (t.dataset.bind.startsWith('scale.') && ['work', 'off', 'hours'].includes(t.dataset.bind.split('.')[1])) S.d.scale.preset = 'custom';
    save(); if (t.dataset.bind.startsWith('scale') || t.dataset.bind.startsWith('profile') || (t.dataset.bind.startsWith('money') && S.view === 'settings') || ['prefs.lead', 'prefs.sound', 'prefs.reminders', 'prefs.discreet'].includes(t.dataset.bind) || t.dataset.bind.startsWith('prefs.home.')) render(); return;
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
document.addEventListener('toggle', (e) => { const d = e.target; if (d.matches && d.matches('details[data-sec]')) { if (d.open) { S.open.add(d.dataset.sec); if (d.classList.contains('sec')) $$('details.sec[open]').forEach((o) => { if (o !== d) { o.open = false; S.open.delete(o.dataset.sec); } }); } else S.open.delete(d.dataset.sec); } }, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.d?.prefs.wake) keepAwake(true); });
document.addEventListener('visibilitychange', () => {
  if (!S.d?.prefs.pin) return;
  if (document.visibilityState === 'hidden') S.hiddenAt = Date.now();
  else { const la = S.d.prefs.lockAfter ?? 1; const away = (Date.now() - (S.hiddenAt || Date.now())) / 60000; if (la >= 0 && away >= la) lockNow(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sheet) closeSheet(); });
// gestos: deslizar no calendário troca o mês
let tx = 0, ty = 0; document.addEventListener('touchstart', (e) => { if (e.target.closest('#cal')) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; } else tx = 0; }, { passive: true });
document.addEventListener('touchend', (e) => { if (!tx) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = 0; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { shiftMonth(S.cal, dx < 0 ? 1 : -1); S.calDir = dx < 0 ? 'l' : 'r'; render(); S.calDir = ''; } }, { passive: true });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window._bip = e; if (S.view === 'settings') renderView(); });
setInterval(() => { if (S.view === 'plantao' && !S.sheet && !S.locked) { const el = $('#plClock'); if (el) el.textContent = new Date().toTimeString().slice(0, 8); } }, 1000);
setInterval(() => { if (S.uid && S.d?.onboarded && (S.view === 'dashboard' || S.view === 'plantao') && !S.sheet && !document.activeElement?.closest('input,textarea')) renderView(); }, 30000);

// ---------- MODO DEMONSTRAÇÃO (galeria de estilos: #demo=tema&view=calendar&cell=circle) ----------
function demoData(theme, cell) {
  const d = defaultData('Lucas Silva Santos'); d.onboarded = true; d.profile.unit = 'Penitenciária Estadual'; d.prefs.theme = theme; d.prefs.cellStyle = cell || 'classic';
  const t = C.today(); d.scale = C.defaultScale(C.addDays(t, -1));
  const y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)) - 1; const days = C.monthDays(y, m);
  const shifts = days.filter((x) => C.isScheduled(x, d.scale)); const free = days.filter((x) => !C.isScheduled(x, d.scale));
  const pk = (a, i) => a[Math.min(i, a.length - 1)]; const ev = (o) => d.events.push({ id: C.uid(), note: '', ...o });
  ev({ type: 'extra', date: pk(free, 1), turno: 'diurna', value: 219, paid: true }); ev({ type: 'extra', date: pk(free, 5), turno: 'noturna', value: 219 });
  ev({ type: 'permuta', dir: 'passei', who: 'João', date: pk(shifts, 2) }); ev({ type: 'permuta', dir: 'assumi', who: 'Maria', date: pk(free, 8) });
  ev({ type: 'folga', date: pk(free, 11), end: C.addDays(pk(free, 11), 1), reason: 'Compensação' }); ev({ type: 'atestado', date: pk(free, 14), end: C.addDays(pk(free, 14), 2) });
  const ns = shifts.find((x) => x >= t) || shifts[0];
  [['22-00', 'Bloco A'], ['00-02', 'G1'], ['04-06', 'Monitoramento']].forEach(([slot, post]) => ev({ type: 'quarto', date: ns, slot, post }));
  ev({ type: 'ocorrencia', date: ns, time: '14:30', title: 'Revista de rotina', cat: 'Segurança', prio: 'Atenção', place: 'Bloco B', note: 'Sem alterações. 1 item apreendido.' });
  ev({ type: 'ocorrencia', date: ns, time: '09:10', title: 'Contagem de presos', cat: 'Rotina', prio: 'Normal', place: 'Bloco A', note: 'Contagem conferida.' });
  return d;
}

// ---------- BOOT ----------
(function boot() {
  const id = Store.currentId(); if (id && Store.user(id)) { S.uid = id; S.user = Store.user(id); S.d = Store.load(id); if (!S.d) { S.uid = null; Store.endSession(); } }
  const hp = new URLSearchParams((location.hash || '').slice(1));
  if (hp.has('demo')) { S.uid = 'demo'; S.user = { id: 'demo', name: 'Lucas Silva', guest: true, email: '' }; S.d = demoData(hp.get('demo') || 'dark', hp.get('cell')); S.view = hp.get('view') || 'calendar'; if (hp.get('info')) S.d.prefs.infoStyle = hp.get('info'); if (hp.get('layout')) S.d.prefs.layout = hp.get('layout') === 'classico' ? 'classico' : 'moderno'; }
  const root = document.createElement('div'); root.id = 'root'; const sr = document.createElement('div'); sr.id = 'sheetRoot'; document.body.append(root, sr);
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNative() && !hp.has('demo')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (S.d?.prefs.pin) lockNow();
  if (S.d?.prefs.wake) keepAwake(true);
  if (isNative()) { loadBio(); loadAlarmStatus(); syncAlarms(); setTimeout(() => runUpdateCheck(false), 4000); setInterval(syncAlarms, 6 * 3600e3); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { loadAlarmStatus(); syncAlarms(); } }); }
  else startReminders(() => (S.uid && S.d?.onboarded ? S.d : null), showAlarm);
  window.__sentinela = { S, go, openSheet, openForm, render }; // útil para depuração/testes
})();
