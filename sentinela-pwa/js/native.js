// Ponte com o app Android (Capacitor): alarme nativo e reconhecimento de voz.
// No navegador comum nada disso existe e as funções devolvem "indisponível".
const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);
export const isNative = () => { try { const c = cap(); return !!(c && c.isNativePlatform && c.isNativePlatform()); } catch { return false; } };
const cache = {};
const plugin = (name) => {
  if (!isNative()) return null; if (cache[name] !== undefined) return cache[name];
  try { const c = cap(); cache[name] = (c.Plugins && c.Plugins[name]) || (c.registerPlugin ? c.registerPlugin(name) : null); } catch { cache[name] = null; }
  return cache[name];
};
const call = async (name, method, args) => { const p = plugin(name); if (!p || !p[method]) throw new Error('Recurso disponível só no app Android'); return p[method](args); };

export const APK_URL = 'https://github.com/LucasArr3/sentinela/releases/download/apk-latest/sentinela-tatico.apk';

export const NativeAlarm = {
  available: () => isNative(),
  // Substitui TODOS os alarmes agendados pela lista enviada.
  schedule: (alarms, opts = {}) => call('SentinelaAlarm', 'schedule', { alarms, snoozeMin: opts.snoozeMin ?? 5, ramp: opts.ramp !== false, autostopMin: opts.autostopMin ?? 5, vibMode: opts.vibMode || 'vibsom', vibLead: opts.vibLead ?? 15, watch: opts.watch !== false }),
  cancelAll: () => call('SentinelaAlarm', 'cancelAll'),
  test: (seconds = 10, sound = 'sirene_lamento') => call('SentinelaAlarm', 'test', { seconds, sound }),
  status: () => call('SentinelaAlarm', 'status'),
  openSettings: (kind) => call('SentinelaAlarm', 'openSettings', { kind }),
  requestNotifications: () => call('SentinelaAlarm', 'requestNotifications'),
  pickSound: () => call('SentinelaAlarm', 'pickSound'),
  removeSound: (id) => call('SentinelaAlarm', 'removeSound', { id }),
  widget: (data) => call('SentinelaAlarm', 'widget', { data }),
  bioStatus: () => call('SentinelaAlarm', 'bioStatus'),
  bioAuth: (title) => call('SentinelaAlarm', 'bioAuth', { title }),
  googleSignIn: (clientId) => call('SentinelaAlarm', 'googleSignIn', { clientId }),
  shareFile: (name, mime, data) => call('SentinelaAlarm', 'shareFile', { name, mime, data }),
  testWatch: (seconds = 10) => call('SentinelaAlarm', 'testWatch', { seconds }),
  takeOpen: () => call('SentinelaAlarm', 'takeOpen'),
  pinWidget: (kind) => call('SentinelaAlarm', 'pinWidget', { kind }),
  appVersion: () => call('SentinelaAlarm', 'appVersion'),
  openUrl: (url) => call('SentinelaAlarm', 'openUrl', { url }),
  preview: (sound) => call('SentinelaAlarm', 'preview', { sound }),
  stopPreview: () => call('SentinelaAlarm', 'stopPreview'),
};

// ---------- voz: Web Speech no navegador, SpeechRecognizer do Android no app ----------
const WebSR = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined);
export const canListen = () => (isNative() ? !!plugin('SpeechRecognition') : !!WebSR());
// Devolve uma função "parar". onText(texto, final) recebe o texto parcial/final; onEnd() ao terminar.
export function startListening({ lang = 'pt-BR', onText, onEnd, onError, prompt = 'Fale agora' }) {
  if (isNative()) {
    const sp = plugin('SpeechRecognition'); let done = false; let last = '';
    const finish = () => { if (done) return; done = true; if (last) onText && onText(last, true); onEnd && onEnd(last); };
    (async () => {
      try {
        const perm = await sp.requestPermissions(); if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') throw Object.assign(new Error('permissão negada'), { code: 'not-allowed' });
        const r = await sp.start({ language: lang, maxResults: 1, prompt, popup: true, partialResults: false });
        last = (r && r.matches && r.matches[0]) || ''; finish();
      } catch (e) { if (!done) { done = true; onError && onError(e); onEnd && onEnd(''); } }
    })();
    return () => { try { sp.stop(); } catch { /* */ } };
  }
  const SR = WebSR(); if (!SR) { onError && onError(Object.assign(new Error('sem suporte'), { code: 'unsupported' })); return () => {}; }
  const rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.continuous = false; let fin = '';
  rec.onresult = (e) => { fin = ''; let interim = ''; for (const r of e.results) { if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript; } onText && onText((fin + ' ' + interim).trim(), false); };
  rec.onerror = (e) => { onError && onError(Object.assign(new Error(e.error), { code: e.error })); };
  rec.onend = () => { if (fin) onText && onText(fin.trim(), true); onEnd && onEnd(fin.trim()); };
  try { rec.start(); } catch (e) { onError && onError(e); }
  return () => { try { rec.stop(); } catch { /* */ } };
}

// ---------- atualização do app (consulta o release público no GitHub) ----------
const RELEASE_API = 'https://api.github.com/repos/LucasArr3/sentinela/releases/tags/apk-latest';
const verNum = (t) => { const m = /(?:vers[aã]o|v)\s*1\.0\.(\d+)/i.exec(t || ''); return m ? Number(m[1]) : 0; };
// Devolve { installed, latest, newer, notes, history[] }
export async function checkUpdate() {
  let installed = 0, installedName = '';
  if (isNative()) { try { const v = await NativeAlarm.appVersion(); installedName = v.name || ''; installed = verNum('v' + installedName); } catch { /* */ } }
  const r = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (!r.ok) throw new Error(r.status === 404 ? 'Nenhuma versão publicada ainda' : 'Não consegui consultar (código ' + r.status + ')');
  const j = await r.json(); const body = String(j.body || ''); const latest = verNum(body) || verNum(j.name);
  const parts = body.split(/\n+Anteriores:\n/); const notes = parts[0].replace(/^vers[aã]o[^\n]*\n+/i, '').replace(/^Novidades:\s*/i, '').trim();
  const history = (parts[1] || '').split('\n').map((x) => x.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
  return { installed, installedName, latest, newer: latest > 0 && installed > 0 && latest > installed, notes, history, date: j.published_at || j.created_at || '' };
}
export function openApkDownload() { return isNative() ? NativeAlarm.openUrl(APK_URL) : (window.open(APK_URL, '_blank', 'noopener'), Promise.resolve()); }
