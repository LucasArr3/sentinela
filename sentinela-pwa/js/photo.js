// Editor de foto de perfil: arrastar, zoom (pinça/roda/controle), girar livremente e de 90 em 90, espelhar.
// Entrega um JPEG quadrado de alta qualidade (640 px) como data URL.
export const OUT = 640;

// Baixa uma imagem por URL e devolve data URL (null se o servidor bloquear o acesso).
export async function urlToDataUrl(url) {
  try {
    const r = await fetch(url, { mode: 'cors' }); if (!r.ok) return null; const b = await r.blob();
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); });
  } catch { return null; }
}
// Pede a versão grande da foto do Google (…=s96-c vira …=s640-c)
export const bigGooglePhoto = (u) => String(u || '').replace(/=s\d+(-c)?$/, '=s640-c').replace(/\?sz=\d+/, '?sz=640');

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Não consegui abrir essa imagem.')); i.src = src; });

// src: File | data URL | URL. Devolve Promise<string|null> (null se cancelar).
export async function editPhoto(src) {
  let url, revoke = false; if (src instanceof Blob) { url = URL.createObjectURL(src); revoke = true; } else url = src;
  let img; try { img = await loadImg(url); } finally { if (revoke) setTimeout(() => URL.revokeObjectURL(url), 5000); }
  return new Promise((resolve) => {
    const V = Math.max(220, Math.min(320, window.innerWidth - 88)); // lado do quadro na tela
    const st = { s: 1, rot: 0, flip: 1, tx: 0, ty: 0 }; const cover = Math.max(V / img.width, V / img.height); st.s = cover;
    const root = document.createElement('div'); root.className = 'pe'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Ajustar foto');
    root.innerHTML = `<div class="pe-card"><div class="pe-top"><b>Ajustar foto</b><span class="muted xs">Arraste, use dois dedos para ampliar</span></div>
      <div class="pe-stage" style="width:${V}px;height:${V}px"><canvas width="${V * 2}" height="${V * 2}" style="width:${V}px;height:${V}px"></canvas><div class="pe-grid"></div></div>
      <label class="pe-row"><span>Zoom</span><input type="range" data-z min="0.2" max="4" step="0.01" value="1"></label>
      <label class="pe-row"><span>Ângulo <b data-ang>0°</b></span><input type="range" data-r min="-180" max="180" step="0.5" value="0"></label>
      <div class="pe-btns"><button type="button" data-a="l">↺ 90°</button><button type="button" data-a="r">↻ 90°</button><button type="button" data-a="f">⇋ Espelhar</button><button type="button" data-a="x">Redefinir</button></div>
      <div class="pe-act"><button type="button" class="btn" data-a="cancel">Cancelar</button><button type="button" class="btn pri" data-a="ok">Usar foto</button></div></div>`;
    document.body.appendChild(root);
    const cv = root.querySelector('canvas'); const ctx = cv.getContext('2d'); const z = root.querySelector('[data-z]'); const rg = root.querySelector('[data-r]'); const ang = root.querySelector('[data-ang]');
    const draw = (c, size) => {
      const k = size / V; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b0b0d'; c.fillRect(0, 0, size, size);
      c.imageSmoothingQuality = 'high'; c.translate(size / 2 + st.tx * k, size / 2 + st.ty * k); c.rotate((st.rot * Math.PI) / 180); c.scale(st.s * k * st.flip, st.s * k); c.drawImage(img, -img.width / 2, -img.height / 2);
    };
    const paint = () => { draw(ctx, V * 2); z.value = String(st.s / cover); ang.textContent = `${Math.round(st.rot * 10) / 10}°`; rg.value = String(st.rot); };
    const setZoom = (m) => { st.s = Math.min(cover * 4, Math.max(cover * 0.2, cover * m)); paint(); };
    z.oninput = () => setZoom(+z.value); rg.oninput = () => { st.rot = +rg.value; paint(); };
    // arrastar e pinça
    const ptr = new Map(); let pd = 0;
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); pd = 0; root.classList.add('drag'); };
    cv.onpointermove = (e) => {
      if (!ptr.has(e.pointerId)) return; const [ox, oy] = ptr.get(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptr.size === 1) { st.tx += e.clientX - ox; st.ty += e.clientY - oy; paint(); }
      else if (ptr.size === 2) { const [a, b] = [...ptr.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) { st.s = Math.min(cover * 4, Math.max(cover * 0.2, st.s * (d / pd))); paint(); } pd = d; }
    };
    const up = (e) => { ptr.delete(e.pointerId); pd = 0; if (!ptr.size) root.classList.remove('drag'); };
    cv.onpointerup = up; cv.onpointercancel = up;
    cv.onwheel = (e) => { e.preventDefault(); setZoom((st.s / cover) * (e.deltaY < 0 ? 1.06 : 0.94)); };
    const finish = (val) => { root.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') finish(null); };
    document.addEventListener('keydown', onKey);
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return; const k = a.dataset.a;
      if (k === 'l') st.rot = ((st.rot - 90 + 540) % 360) - 180; if (k === 'r') st.rot = ((st.rot + 90 + 540) % 360) - 180;
      if (k === 'f') st.flip *= -1; if (k === 'x') Object.assign(st, { s: cover, rot: 0, flip: 1, tx: 0, ty: 0 });
      if (k === 'cancel') return finish(null);
      if (k === 'ok') { const o = document.createElement('canvas'); o.width = o.height = OUT; draw(o.getContext('2d'), OUT); return finish(o.toDataURL('image/jpeg', 0.92)); }
      paint();
    });
    paint();
  });
}
