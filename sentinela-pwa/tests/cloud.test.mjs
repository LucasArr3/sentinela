import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signUp, signIn, resetPassword, freshToken, backupUpload, backupDownload, getMeta, explain, checkAuthEnabled, CHUNK, asciiJSON } from '../js/cloud.js';

// Firestore + Auth simulados (formato das respostas REST)
function fakeCloud({ authEnabled = true, rulesOpen = true } = {}) {
  const docs = new Map(); const users = new Map(); const calls = [];
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const f = async (url, opts = {}) => {
    url = String(url); const body = opts.body && opts.headers?.['content-type']?.includes('json') ? JSON.parse(opts.body) : opts.body; calls.push([opts.method || 'GET', url.split('?')[0].split('/').slice(-1)[0]]);
    if (url.includes('identitytoolkit')) {
      if (!authEnabled) return json(400, { error: { message: 'OPERATION_NOT_ALLOWED' } });
      if (url.includes(':signUp')) { if (users.has(body.email)) return json(400, { error: { message: 'EMAIL_EXISTS' } }); users.set(body.email, { pw: body.password, uid: 'u' + users.size }); return json(200, { localId: users.get(body.email).uid, idToken: 'tk1', refreshToken: 'rf1', expiresIn: '3600' }); }
      if (url.includes(':signInWithPassword')) { const u = users.get(body.email); if (!u) return json(400, { error: { message: 'EMAIL_NOT_FOUND' } }); if (u.pw !== body.password) return json(400, { error: { message: 'INVALID_PASSWORD' } }); return json(200, { localId: u.uid, idToken: 'tk2', refreshToken: 'rf2', expiresIn: '3600' }); }
      if (url.includes(':sendOobCode')) return json(200, { email: body.email });
    }
    if (url.includes('securetoken')) { assert.match(String(body), /grant_type=refresh_token&refresh_token=rf/); return json(200, { id_token: 'tk-novo', refresh_token: 'rf-novo', expires_in: '3600' }); }
    if (url.includes('firestore.googleapis.com')) {
      if (!rulesOpen) return json(403, { error: { status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' } });
      assert.match(opts.headers.authorization, /^Bearer tk/);
      if (url.includes(':commit')) { for (const w of body.writes) { if (w.update) { const size = Object.values(w.update.fields).reduce((s, v) => s + (v.stringValue || '').length, 0); assert.ok(size < 1_000_000, 'documento acima do limite'); docs.set(w.update.name, w.update.fields); } else docs.delete(w.delete); } return json(200, { writeResults: [] }); }
      if (url.includes(':batchGet')) return json(200, body.documents.map((n) => (docs.has(n) ? { found: { name: n, fields: docs.get(n) } } : { missing: n })));
      const name = decodeURIComponent(url.split('/v1/')[1].split('?')[0]); return docs.has(name) ? json(200, { name, fields: docs.get(name) }) : json(404, { error: { message: 'Document not found', status: 'NOT_FOUND' } });
    }
    throw new Error('URL inesperada ' + url);
  };
  return { f, docs, users, calls };
}
const withFake = async (fake, fn) => { const old = globalThis.fetch; globalThis.fetch = fake.f; try { return await fn(); } finally { globalThis.fetch = old; } };

test('conta: criar, entrar, senha errada e e-mail repetido', async () => {
  const fake = fakeCloud(); await withFake(fake, async () => {
    const s = await signUp('a@b.com', 'senha123'); assert.equal(s.email, 'a@b.com'); assert.ok(s.uid && s.idToken && s.refreshToken);
    await assert.rejects(() => signUp('a@b.com', 'x'), (e) => /já tem conta/.test(explain(e)));
    await assert.rejects(() => signIn('a@b.com', 'errada'), (e) => explain(e) === 'E-mail ou senha incorretos.');
    assert.equal((await signIn('a@b.com', 'senha123')).uid, s.uid);
    await resetPassword('a@b.com');
  });
});
test('backup: ida e volta com acentos, emoji e foto grande (várias partes)', async () => {
  const fake = fakeCloud(); await withFake(fake, async () => {
    const s = await signUp('x@y.com', '123456'); const foto = 'data:image/jpeg;base64,' + 'A'.repeat(CHUNK * 2 + 123);
    const payload = { v: 1, profile: { name: 'João Ação 🛡️' }, events: [{ id: 1, note: 'ocorrência — não é "rotina"', photos: [foto] }] };
    const r = await backupUpload(s, payload, { updatedAt: 111, device: 'Teste' }); assert.ok(r.chunks >= 3);
    assert.equal((await getMeta(s)).updatedAt, 111);
    const back = await backupDownload(s); assert.deepEqual(back.payload, payload); assert.equal(back.meta.chunks, r.chunks);
    assert.ok(!asciiJSON(payload).match(/[^\x00-\x7f]/));
  });
});
test('backup menor apaga as partes antigas e a nuvem vazia devolve null', async () => {
  const fake = fakeCloud(); await withFake(fake, async () => {
    const s = await signUp('m@n.com', '123456'); assert.equal(await backupDownload(s), null);
    await backupUpload(s, { big: 'B'.repeat(CHUNK * 2) }); const antes = [...fake.docs.keys()].filter((k) => k.includes('chunk_')).length;
    await backupUpload(s, { small: 1 }); const depois = [...fake.docs.keys()].filter((k) => k.includes('chunk_')).length;
    assert.ok(antes >= 3 && depois === 1); assert.deepEqual((await backupDownload(s)).payload, { small: 1 });
  });
});
test('token expirado é renovado; erros de configuração viram instruções claras', async () => {
  const fake = fakeCloud(); await withFake(fake, async () => {
    const s = await signUp('t@t.com', '123456'); s.exp = Date.now() - 1; await freshToken(s); assert.equal(s.idToken, 'tk-novo'); assert.equal(s.refreshToken, 'rf-novo');
  });
  const off = fakeCloud({ authEnabled: false }); await withFake(off, async () => { const c = await checkAuthEnabled(); assert.equal(c.ok, false); assert.match(c.msg, /não foi ativado/); });
  const on = fakeCloud(); await withFake(on, async () => assert.equal((await checkAuthEnabled()).ok, true));
  const closed = fakeCloud({ rulesOpen: false }); await withFake(closed, async () => { const s = await signUp('r@r.com', '123456'); await assert.rejects(() => getMeta(s), (e) => /regras do Firestore/.test(explain(e))); });
  assert.match(explain(new Error('Requests from referer https://localhost/ are blocked. API_KEY_HTTP_REFERRER_BLOCKED')), /chave do Firebase/);
});
