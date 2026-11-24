// Assistente Sentinela: comandos por voz/texto interpretados localmente (sem enviar dados a terceiros).
import { parseCommand } from './nlp.js';
import * as C from './core.js';
import { ic, esc, $, fmtDur } from './ui.js';
import { hasAI, callLLM } from './vision.js';
import { startListening, canListen } from './native.js';

const EXAMPLES = ['Marca quartos 22 às 00 e 02 às 04 no pavilhão A', 'Quando é meu próximo plantão?', 'Adiciona extra noturna dia 30 valor 250', 'Permuta com o João dia 27, passei meu plantão', 'Quanto vou receber de extras esse mês?', 'Gerar resumo para o WhatsApp'];

export function createAssistant(api) {
  let msgs = [{ who: 'bot', text: 'Olá! Sou o assistente do Sentinela. 🎙️ Toque no microfone e fale — ou digite — para registrar extras, permutas, folgas, atestados e consultar sua escala.' }];
  let listening = false, rec = null, root = null;

  const speak = (t) => { if (!api.data().prefs.speak || !('speechSynthesis' in window)) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/[*_`]/g, '').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '')); u.lang = 'pt-BR'; speechSynthesis.speak(u); } catch { /* ignore */ } };
  const say = (text, extra = {}) => { msgs.push({ who: 'bot', text, ...extra }); draw(); speak(text); };

  function answer(q, r) {
    const d = api.data(); const now = new Date(); const t = C.today();
    const ref = r.date ? C.parse(r.date) : now; const y = ref.getFullYear(), m = ref.getMonth();
    if (q === 'next') {
      const n = C.nextShift(d, now); if (!n) return 'Não encontrei plantões futuros. Verifique sua escala em Configurações.';
      const when = n.started ? `Você está em serviço agora, até ${n.end.getHours().toString().padStart(2, '0')}:${n.end.getMinutes().toString().padStart(2, '0')}.` : `Seu próximo plantão é ${C.dateLong(n.info.date)} (${C.relDays(n.info.date)}), às ${d.scale.start}.`;
      if (n.started) { const nx = C.nextWorkDay(d, n.info.date, false); return when + (nx ? `\nDepois dele: ${C.dateLong(nx.date)} (${C.relDays(nx.date)}).` : ''); }
      return when;
    }
    if (q === 'today') { const du = C.dutyNow(d, now); const i = C.dayInfo(t, d); return du.on ? '🟢 Sim, você está em serviço agora.' : i.works ? 'Hoje é dia de plantão, mas você não está em serviço neste horário.' : `Hoje: ${C.STATUS[i.status].label}. ${C.nextShift(d, now) ? 'Próximo plantão ' + C.relDays(C.nextShift(d, now).info.date) + '.' : ''}`; }
    if (q === 'nextq') { const n = C.nextQuarto(d, now); const ql = (x) => `${C.qLabel(x.q)}${x.ev.post ? ' — ' + x.ev.post : ''}`; return n ? (n.active ? `Você está no quarto ${ql(n)} agora, até ${n.q.end.replace(':00', 'h')}.` : `Seu próximo quarto é ${ql(n)}, ${C.relDays(C.iso(n.start))} às ${n.q.start.replace(':00', 'h')} (em ${fmtDur(n.start - now)}).`) : 'Você não tem quartos marcados daqui para frente. Marque na aba Quartos.'; }
    if (q === 'extras') { const s = C.monthSummary(d, y, m); return s.extras.length ? `Em ${C.MONTHS[m]} você tem ${s.extras.length} extra(s): ${C.brl(s.extrasTotal)}.\n✅ Recebido: ${C.brl(s.extrasPaid)}\n⏳ A receber: ${C.brl(s.extrasPending)}` : `Nenhuma extra registrada em ${C.MONTHS[m]}.`; }
    if (q === 'permutas') { const l = C.permutaLedger(d.events); return l.length ? 'Saldo de permutas em aberto:\n' + l.map((x) => (x.net > 0 ? `• ${x.who} te deve ${x.net} plantão(ões)` : x.net < 0 ? `• Você deve ${-x.net} plantão(ões) a ${x.who}` : `• ${x.who}: equilibrado`)).join('\n') : 'Nenhuma permuta em aberto. ✅'; }
    if (q === 'count') { const s = C.monthSummary(d, y, m); return `${C.MONTHS[m]}: ${s.plantoes.length} plantão(ões) na escala${s.permutaIn.length ? ` + ${s.permutaIn.length} por permuta` : ''}${s.permutaOut.length ? `, ${s.permutaOut.length} passado(s)` : ''}. Carga estimada: ${s.hours}h.`; }
    if (q === 'atestados') { const s = C.monthSummary(d, y, m); return `${s.atestados.length} dia(s) de atestado em ${C.MONTHS[m]}.`; }
    return 'Não entendi a consulta.';
  }

  async function viaLLM(text) {
    const d = api.data(); const ai = d.prefs.ai; msgs.push({ who: 'bot', text: 'Pensando…', tmp: true }); draw();
    try {
      const prompt = `Você é o assistente do app Sentinela (calendário de plantão de policiais penais, escala ${C.scaleLabel(d.scale)}). Hoje é ${C.today()}. Faixas de quarto: ${d.quarters.map((q) => q.id).join(', ')}. Postos: ${d.posts.join(', ') || 'nenhum'}.
Interprete o pedido e responda SOMENTE JSON, em um destes formatos:
{"action":"create","event":{"type":"extra|permuta|folga|atestado|ferias|obs","date":"YYYY-MM-DD","end":"YYYY-MM-DD (opcional)","turno":"diurna|noturna|h24","value":0,"dir":"passei|assumi","who":"","note":""}}
{"action":"quartos","date":"YYYY-MM-DD","slots":["22-00"],"post":""}
{"action":"answer","text":"resposta curta em português"}
Pedido: ${text}`;
      const raw = await callLLM(ai, { prompt }); const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      msgs = msgs.filter((m) => !m.tmp);
      if (j.action === 'create' && j.event?.type && C.TYPES[j.event.type]) { const e = { ...j.event, note: j.event.note || '' }; if (e.type === 'extra' && e.value == null) e.value = d.money[e.turno || 'diurna'] || 0; say(`Entendi:\n${C.TYPES[e.type].emoji} ${api.title(e)}\n📅 ${C.dateLong(e.date)}\n\nConfirmar?`, { pending: e }); }
      else if (j.action === 'quartos' && Array.isArray(j.slots)) { const ids = j.slots.filter((x) => d.quarters.some((q) => q.id === x)); ids.length ? say(`Entendi:\n⏱️ Quartos ${ids.join(', ')}${j.post ? ' — ' + j.post : ''}\n📅 ${C.dateLong(j.date)}\n\nConfirmar?`, { pendingQ: { date: j.date, ids, post: j.post || '' } }) : say('Não identifiquei quais quartos. Diga as faixas, ex.: 22 às 00.'); }
      else say(j.text || 'Não entendi. Pode reformular?');
    } catch (e) { msgs = msgs.filter((m) => !m.tmp); say('Não consegui usar a IA agora: ' + (e.message || 'erro') + '. Tente um comando mais direto.'); }
  }

  function submit(text) {
    text = text.trim(); if (!text) return; msgs.push({ who: 'me', text }); const r = parseCommand(text, undefined, api.ctx());
    if (r.kind === 'quartos') {
      const qs = api.data().quarters; const names = r.ids.map((id) => { const q = qs.find((x) => x.id === id); return q ? C.qLabel(q) : id; }).join(', ');
      say(`Entendi:\n⏱️ Quartos ${names}${r.post ? ' — ' + r.post : ''}\n📅 ${C.dateLong(r.date)}\n\nConfirmar?`, { pendingQ: { date: r.date, ids: r.ids, post: r.post } });
    } else if (r.kind === 'help') say(r.text);
    else if (r.kind === 'create') {
      const e = r.event; const pending = { ...e };
      if (pending.type === 'extra' && pending.value == null) pending.value = api.data().money[pending.turno] || 0;
      const sug = pending.type === 'permuta' && !pending.who ? '\n⚠️ Não identifiquei o colega — você pode completar em “Ajustar”.' : '';
      say(`Entendi:\n${C.TYPES[pending.type].emoji} ${api.title(pending)}\n📅 ${C.dateLong(pending.date)}${pending.end ? ` até ${C.fmtBR(pending.end)}` : ''}${pending.note && pending.type !== 'obs' ? `\n${pending.note}` : ''}${sug}\n\nConfirmar?`, { pending });
    } else if (r.kind === 'query') say(answer(r.q, r));
    else if (r.kind === 'nav') { say(r.text); setTimeout(() => { api.close(); api.goto(r.to); }, 700); }
    else if (hasAI(api.data().prefs.ai)) viaLLM(text);
    else say('Não consegui entender esse comando. Tente algo como:\n• “Extra noturna dia 30 valor 250”\n• “Atestado de 3 dias a partir de amanhã”\n• “Quando é meu próximo plantão?”\n\nPara frases livres, ligue a IA em Ajustes → IA.');
  }

  let stopFn = null;
  function toggleMic() {
    if (!canListen()) return say('Este aparelho ou navegador não oferece reconhecimento de voz. Use o app Android, Chrome, Edge ou Safari, ou digite o comando.');
    if (listening) { if (stopFn) stopFn(); return; }
    const input = $('#aiInput', root); listening = true; paint();
    stopFn = startListening({
      prompt: 'Fale seu comando',
      onText: (t) => { input.value = t; },
      onEnd: (t) => { listening = false; stopFn = null; paint(); const v = (t || input.value).trim(); if (v) { input.value = ''; submit(v); } },
      onError: (e) => { listening = false; paint(); if (e.code === 'not-allowed' || e.code === 'service-not-allowed') say('Permita o acesso ao microfone para usar a voz.'); else if (!['no-speech', 'aborted'].includes(e.code)) say('Não consegui ouvir. Tente de novo.'); },
    });
  }

  function paint() { const b = $('#aiMic', root); if (!b) return; b.classList.toggle('rec', listening); b.innerHTML = ic(listening ? 'stop' : 'mic', ''); $('#aiHint', root).textContent = listening ? 'Ouvindo… fale seu comando' : 'Toque no microfone e fale'; }
  function draw() {
    const box = $('#aiChat', root); if (!box) return;
    box.innerHTML = msgs.map((m, i) => `<div class="msg ${m.who}">${esc(m.text)}${(m.pending || m.pendingQ) && !m.done ? `<div class="conf"><button class="btn pri sm" data-ai="ok" data-i="${i}">${ic('check')}Confirmar</button><button class="btn sm" data-ai="edit" data-i="${i}">${ic('edit')}Ajustar</button><button class="btn sm" data-ai="no" data-i="${i}">Cancelar</button></div>` : ''}</div>`).join('');
    box.scrollTop = box.scrollHeight;
  }

  return {
    mount(el) {
      root = el;
      root.innerHTML = `<div class="grab"></div><div class="row" style="margin-bottom:10px"><div class="logo" style="width:40px;height:40px;border-radius:14px">${ic('sparkles')}</div><div class="sp"><h3>Assistente IA</h3><div class="muted xs">Fale ou digite — tudo é processado no seu aparelho</div></div><button class="ibtn" data-ai="speak" title="Ler respostas em voz alta" style="${api.data().prefs.speak ? 'color:var(--accent)' : ''}">${ic('volume')}</button><button class="ibtn" data-ai="close">${ic('x')}</button></div>
      <div class="chat" id="aiChat"></div>
      ${hasAI(api.data().prefs.ai) ? '' : `<div class="card" style="background:var(--surface2);padding:12px;margin:10px 0"><div class="b">Ligue a IA para frases livres e fotos</div><div class="muted xs" style="margin:4px 0 8px">Hoje funciona com comandos diretos. Com a chave gratuita do Gemini, o assistente entende qualquer frase e lê a foto da escala.</div><button class="btn sm pri" data-ai="setup">Ligar a IA</button></div>`}
      <div class="chips" style="margin:12px -18px;padding:0 18px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none">${EXAMPLES.map((x) => `<button class="chip" style="white-space:nowrap" data-ai="ex" data-t="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="row"><button class="mic" id="aiMic" data-ai="mic" aria-label="Falar">${ic('mic')}</button><button class="ibtn" data-ai="photo" aria-label="Foto da escala de quartos" title="Foto da escala de quartos">${ic('camera')}</button><form class="row sp" id="aiForm" style="gap:8px"><input id="aiInput" placeholder="Ex.: extra diurna dia 28 valor 219" autocomplete="off"><button class="ibtn" style="background:var(--accent);color:#fff;border:0" aria-label="Enviar">${ic('send')}</button></form></div>
      <div class="muted xs" id="aiHint" style="text-align:center;margin-top:8px">Toque no microfone e fale</div>`;
      draw();
      root.addEventListener('submit', (e) => { e.preventDefault(); const i = $('#aiInput', root); const v = i.value; i.value = ''; submit(v); });
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ai]'); if (!b) return; const a = b.dataset.ai;
        if (a === 'close') api.close(); else if (a === 'mic') toggleMic(); else if (a === 'ex') submit(b.dataset.t);
        else if (a === 'speak') { const d = api.data(); d.prefs.speak = !d.prefs.speak; api.save(); b.style.color = d.prefs.speak ? 'var(--accent)' : ''; if (d.prefs.speak) speak('Leitura em voz alta ativada.'); else speechSynthesis?.cancel(); }
        else if (a === 'photo') api.roster();
        else if (a === 'setup') api.openAI();
        else { const m = msgs[+b.dataset.i]; if (!m?.pending && !m?.pendingQ) return;
          if (a === 'ok') { m.done = true; if (m.pendingQ) { api.addQuartos(m.pendingQ.date, m.pendingQ.ids, m.pendingQ.post); say('✅ Quartos marcados!'); } else { api.add(m.pending); say(`✅ Registrado! ${api.title(m.pending)} em ${C.fmtBR(m.pending.date)}.`); } }
          if (a === 'no') { m.done = true; say('Ok, cancelei.'); }
          if (a === 'edit') { m.done = true; if (m.pendingQ) { api.close(); api.goto('quartos'); } else api.edit(m.pending); } }
      });
      if (!canListen()) $('#aiHint', root).textContent = 'Voz indisponível aqui — use o campo de texto';
    },
    unmount() { try { rec?.abort(); } catch { /* ignore */ } listening = false; root = null; },
  };
}
