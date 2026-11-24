// Backup na nuvem (Firebase) sem SDK: login por e-mail/senha e cópia dos dados em partes no Firestore (REST).
// Os dados ficam em users/{uid}/backup/* e só o próprio usuário pode ler/gravar (veja firebase/firestore.rules).
const CFG = { apiKey: "AIzaSyC1ZF-ko4YQ3lgowtXzkJlTvz7ts_wy8ik", projectId: "gen-lang-client-0373115522", db: "ai-studio-5b655d85-8635-4b7a-955d-c700dc9af2e1" }; // chave web do projeto (pública por natureza; a segurança está nas regras)

export const CHUNK = 600000; // caracteres por documento (limite do Firestore: ~1 MB)
const J = async (url, opts) => {
  const r = await fetch(url, opts); const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || `HTTP ${r.status}`); e.status = r.status; e.code = (j.error && (j.error.message || j.error.status)) || ''; throw e; }
  return j;
};
export function explain(e) {
  const m = String((e && (e.code || e.message)) || '');
  if (/EMAIL_EXISTS/.test(m)) return 'Este e-mail já tem conta na nuvem. Use "Entrar".';
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL|MISSING_PASSWORD/.test(m)) return 'E-mail ou senha incorretos.';
  if (/WEAK_PASSWORD/.test(m)) return 'Senha fraca: use pelo menos 6 caracteres.';
  if (/TOO_MANY_ATTEMPTS/.test(m)) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (/OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/.test(m)) return 'O login por e-mail e senha ainda não foi ativado no Firebase (veja o guia da nuvem).';
  if (/referer|API_KEY_HTTP|API key not valid|API_KEY_INVALID|API_KEY_SERVICE_BLOCKED/i.test(m)) return 'A chave do Firebase está bloqueada para este app. É preciso liberar no Google Cloud (veja o guia da nuvem).';
  if (e && (e.status === 403 || /PERMISSION_DENIED|Missing or insufficient/i.test(m))) return 'O Firebase recusou o acesso. Falta ajustar as regras do Firestore (veja o guia da nuvem).';
  if (e && (e.status === 404 || /not found/i.test(m))) return 'Banco de dados do Firebase não encontrado (veja o guia da nuvem).';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem internet no momento.';
  return 'Erro na nuvem: ' + m.slice(0, 140);
}

// ---------- login (Identity Toolkit REST) ----------
const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts';
const post = (path, body) => J(`${AUTH}:${path}?key=${CFG.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const sess = (r, email) => ({ email, uid: r.localId, refreshToken: r.refreshToken, idToken: r.idToken, exp: Date.now() + (Number(r.expiresIn) || 3600) * 1000 });
export const signUp = async (email, password) => sess(await post('signUp', { email, password, returnSecureToken: true }), email);
export const signIn = async (email, password) => sess(await post('signInWithPassword', { email, password, returnSecureToken: true }), email);
export const resetPassword = (email) => post('sendOobCode', { requestType: 'PASSWORD_RESET', email });
export async function freshToken(s) {
  if (s.idToken && s.exp - 60000 > Date.now()) return s;
  const r = await J(`https://securetoken.googleapis.com/v1/token?key=${CFG.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}` });
  s.idToken = r.id_token; s.refreshToken = r.refresh_token || s.refreshToken; s.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000; return s;
}
// Verifica se o login por e-mail/senha está ativado, sem criar nada (um e-mail inexistente deve dar "não encontrado").
export async function checkAuthEnabled() {
  try { await post('signInWithPassword', { email: 'verificacao@sentinela.invalid', password: 'x-verificacao', returnSecureToken: true }); return { ok: true }; }
  catch (e) { const m = String(e.code || e.message); if (/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|INVALID_EMAIL/.test(m)) return { ok: true }; return { ok: false, msg: explain(e) }; }
}

// ---------- backup (Firestore REST) ----------
const DOCS = () => `projects/${CFG.projectId}/databases/${CFG.db}/documents`;
const base = () => `https://firestore.googleapis.com/v1/${DOCS()}`;
const pad = (i) => String(i).padStart(3, '0');
const docName = (uid, id) => `${DOCS()}/users/${uid}/backup/${id}`;
const hdr = (s) => ({ 'content-type': 'application/json', authorization: `Bearer ${s.idToken}` });
// JSON só com ASCII: 1 caractere = 1 byte, o tamanho do documento fica previsível
export const asciiJSON = (obj) => JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));

export async function getMeta(s) {
  await freshToken(s);
  try {
    const d = await J(`${base()}/users/${s.uid}/backup/meta`, { headers: hdr(s) }); const f = d.fields || {};
    return { updatedAt: Number((f.updatedAt && f.updatedAt.integerValue) || 0), chunks: Number((f.chunks && f.chunks.integerValue) || 0), size: Number((f.size && f.size.integerValue) || 0), device: (f.device && f.device.stringValue) || '' };
  } catch (e) { if (e.status === 404) return null; throw e; }
}
export async function backupUpload(s, payload, meta = {}) {
  await freshToken(s); const text = asciiJSON(payload); const n = Math.max(1, Math.ceil(text.length / CHUNK));
  const prev = await getMeta(s).catch(() => null); const prevN = prev ? prev.chunks : 0; const writes = [];
  for (let i = 0; i < n; i++) writes.push({ update: { name: docName(s.uid, `chunk_${pad(i)}`), fields: { i: { integerValue: String(i) }, data: { stringValue: text.slice(i * CHUNK, (i + 1) * CHUNK) } } } });
  for (let i = n; i < prevN; i++) writes.push({ delete: docName(s.uid, `chunk_${pad(i)}`) });
  writes.push({ update: { name: docName(s.uid, 'meta'), fields: { updatedAt: { integerValue: String(meta.updatedAt || Date.now()) }, chunks: { integerValue: String(n) }, size: { integerValue: String(text.length) }, device: { stringValue: String(meta.device || '').slice(0, 80) }, app: { stringValue: 'sentinela-1' } } } });
  await J(`${base()}:commit`, { method: 'POST', headers: hdr(s), body: JSON.stringify({ writes }) });
  return { chunks: n, size: text.length };
}
export async function backupDownload(s) {
  const meta = await getMeta(s); if (!meta || !meta.chunks) return null;
  const r = await J(`${base()}:batchGet`, { method: 'POST', headers: hdr(s), body: JSON.stringify({ documents: Array.from({ length: meta.chunks }, (_, i) => docName(s.uid, `chunk_${pad(i)}`)) }) });
  const parts = new Array(meta.chunks);
  for (const x of r) if (x.found) { const f = x.found.fields; parts[Number(f.i.integerValue)] = f.data.stringValue; }
  if (parts.some((p) => p === undefined)) throw new Error('Backup incompleto na nuvem');
  return { meta, payload: JSON.parse(parts.join('')) };
}
