// Leitura de foto da escala de quartos (WhatsApp) e IA opcional. A chave fica só neste aparelho.
import { today } from './core.js';
const nz = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash', anthropic: 'claude-sonnet-5-5' };
export const hasAI = (ai) => !!(ai && ai.key && ai.key.trim());

// "22h às 00h", "22:00-00:00", "22 as 24", "Alvorada" -> id do quarto configurado
export function slotFromText(text, quarters) {
  const t = nz(text);
  if (/alvorada/.test(t)) return quarters.find((q) => q.alvorada)?.id || null;
  const m = String(text).toLowerCase().match(/(\d{1,2})\s*(?::\s*\d{2}|h|hs|horas?)?\s*(?:as|às|a|-|–|—|ate|até)\s*(\d{1,2})/);
  if (!m) return null;
  const h1 = Number(m[1]) % 24, h2 = Number(m[2]) % 24;
  const byStart = quarters.filter((q) => Number(q.start.slice(0, 2)) === h1);
  return (byStart.find((q) => Number(q.end.slice(0, 2)) === h2) || byStart[0])?.id || null;
}

// O nome da lista é o meu? (nome completo e apelidos separados por vírgula)
export function nameMatches(entryName, aliases) {
  const e = ` ${nz(entryName)} `; if (e.trim().length < 2) return false;
  return aliases.filter(Boolean).some((a) => {
    const toks = nz(a).split(' ').filter((x) => x.length >= 3); if (!toks.length) return false;
    const hit = toks.filter((x) => e.includes(` ${x}`)).length;
    return hit >= Math.min(2, toks.length);
  });
}
export const aliasesOf = (profile) => [profile.name, ...String(profile.alias || '').split(',')].map((x) => x.trim()).filter(Boolean);

export function matchPost(text, posts) {
  const t = nz(text); if (!t) return '';
  return posts.find((p) => nz(p) === t) || posts.find((p) => t.includes(nz(p)) || nz(p).includes(t)) || String(text).trim();
}

export function buildPrompt(quarters, posts, ref = today()) {
  return `Você lê fotos de escalas de "quarto de hora" (revezamento de postos noturnos) de servidores de plantão, enviadas em grupos de WhatsApp.
Extraia TODAS as linhas legíveis. Responda SOMENTE com JSON, sem texto extra, neste formato:
{"date":"YYYY-MM-DD ou null","entries":[{"name":"nome como escrito","slot":"faixa como escrita, ex: 22h às 00h","post":"posto/local como escrito ou vazio"}]}
Faixas usadas: ${quarters.map((q) => `${q.start}-${q.end}${q.name ? ' (' + q.name + ')' : ''}`).join(', ')}.
Postos conhecidos: ${posts.join(', ') || 'nenhum'}.
Hoje é ${ref}. Se a foto trouxer a data do plantão, use-a em "date"; se não, use null. Não invente linhas.`;
}

export function parseRoster(raw, ctx) {
  let txt = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}'); if (a >= 0 && b > a) txt = txt.slice(a, b + 1);
  let j; try { j = JSON.parse(txt); } catch { throw new Error('A IA não devolveu um formato legível. Tente outra foto, mais nítida.'); }
  const me = aliasesOf(ctx.profile);
  const entries = (Array.isArray(j.entries) ? j.entries : []).map((x) => ({ name: String(x.name || '').trim(), slotText: String(x.slot || '').trim(), slotId: slotFromText(String(x.slot || ''), ctx.quarters), post: matchPost(x.post, ctx.posts), mine: nameMatches(x.name, me) })).filter((x) => x.name || x.slotText);
  return { date: /^\d{4}-\d{2}-\d{2}$/.test(j.date || '') ? j.date : null, entries };
}

// ---------- chamadas ao provedor (chave do próprio usuário) ----------
export async function callLLM(ai, { prompt, image }) {
  const model = (ai.model || '').trim() || DEFAULT_MODELS[ai.provider];
  if (ai.provider === 'anthropic') {
    const content = []; if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.split(',')[1] } });
    content.push({ type: 'text', text: prompt });
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': ai.key.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content }] }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `Erro ${r.status} no provedor de IA`);
    return (j.content || []).map((c) => c.text || '').join('');
  }
  const parts = []; if (image) parts.push({ inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } }); parts.push({ text: prompt });
  const gem = async (mdl) => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': ai.key.trim() }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `Erro ${r.status} no provedor de IA`);
    return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  };
  try { return await gem(model); } catch (e) {
    if (!/not found|404|no longer|not supported|deprecated|is not available/i.test(e.message || '')) throw e;
    const m = await autoPickGeminiModel(ai.key); ai.model = m; return gem(m); // o modelo mudou: usa um que exista na conta
  }
}
export async function readRoster(ai, image, ctx) { return parseRoster(await callLLM(ai, { prompt: buildPrompt(ctx.quarters, ctx.posts), image }), ctx); }

// Reduz a foto (celular gera imagens enormes) para caber no armazenamento local.
export function compressImage(file, max = 1280, q = 0.72) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não consegui abrir essa imagem.')); }; img.src = url;
  });
}

// Se o modelo salvo não existe mais, descobre na conta um modelo "flash" que aceite generateContent.
export async function autoPickGeminiModel(key) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key.trim() } });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `Erro ${r.status} ao listar modelos`);
  const ok = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/i.test(m.name) && !/lite|image|tts|live|audio|thinking|exp|preview/i.test(m.name)).map((m) => m.name.replace(/^models\//, ''));
  const ver = (n) => { const m = n.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  ok.sort((a, b) => ver(b) - ver(a) || a.length - b.length);
  if (!ok.length) throw new Error('Nenhum modelo compatível encontrado nesta chave.');
  return ok[0];
}

// Foto de perfil: recorta o centro em quadrado e reduz (guarda pouco espaço).
export function squareImage(file, size = 256, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(img.width, img.height); const c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não consegui abrir essa imagem.')); }; img.src = url;
  });
}
