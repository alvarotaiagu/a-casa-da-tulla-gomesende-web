// El guion de «La ruta del grano», común al 3D y al plano (sin Three.js):
// - fase(p): del progreso del scroll (0–1) a qué se ve: la salida de la casa, el viaje, la llegada y la vista de todo.
// - el cuaderno: los kilómetros, el tramo, la altura y el perfil del camino, como un libro de cuentas.
// - los rótulos: elementos HTML sobre el mapa que no chocan entre sí ni se salen del marco.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const suave = t => (t = clamp(t), t * t * (3 - 2 * t));
const coma = (v, d = 1) => v.toFixed(d).replace('.', ',');

/** p: progreso de la sección fijada → { f: fracción del camino, intro, llegada, vista } (0–1 cada una) */
export function fase(p) {
  p = clamp(p);
  const t = clamp((p - .06) / .78);
  return {
    p,
    intro: 1 - suave(p / .06),                                   // 0–6 %: de la casa de cerca al seguimiento
    f: .7 * t + .3 * (.5 - .5 * Math.cos(Math.PI * t)),          // 6–84 %: el hilo de grano recorre el camino
    llegada: suave((p - .84) / .08),                             // 84–92 %: el monasterio de cerca
    vista: suave((p - .92) / .08),                               // 92–100 %: todo el valle, con los rótulos de alrededor
  };
}

/** Punto del camino en la fracción f: { i (índice con decimales), x, z, h (m reales), km } */
export function enCamino(R, f) {
  const n = R.x.length, i = clamp(f) * (n - 1), a = Math.floor(i), b = Math.min(n - 1, a + 1), k = i - a;
  return { i, x: R.x[a] + (R.x[b] - R.x[a]) * k, z: R.z[a] + (R.z[b] - R.z[a]) * k, h: R.h[a] + (R.h[b] - R.h[a]) * k, km: clamp(f) * R.km };
}

/** El tramo en que va el grano (el último cuyo inicio ya pasó) */
export const tramoDe = (R, f) => R.tramos.reduce((t, x) => (f >= x.f - 1e-6 ? x : t), R.tramos[0]);

// ---------- el cuaderno ----------
/** Escribe el cuaderno dentro de «el» y devuelve poner(fase) */
export function crearCuaderno(el, T) {
  const R = T.ruta, L = T.lugares;
  const N = 120, hs = [];
  for (let j = 0; j < N; j++) hs.push(R.h[Math.round(j / (N - 1) * (R.h.length - 1))]);
  const hMin = Math.min(...hs) - 20, hMax = Math.max(...hs) + 10, PW = 240, PH = 44;
  const px = j => (j / (N - 1) * PW).toFixed(1), py = h => (PH - (h - hMin) / (hMax - hMin) * PH).toFixed(1);
  const linea = hs.map((h, j) => `${j ? 'L' : 'M'}${px(j)} ${py(h)}`).join('');
  el.innerHTML = `
    <p class="ruta-c-ceja">El camino de hoy</p>
    <p class="ruta-c-km"><b data-km>0,0</b><span> de ${coma(R.km)} km</span></p>
    <p class="ruta-c-tramo" data-tramo>${R.tramos[0].t}</p>
    <svg class="ruta-c-perfil" viewBox="0 -4 ${PW} ${PH + 8}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><clipPath id="ruta-c-recorte"><rect x="0" y="-4" width="0" height="${PH + 8}" data-recorte/></clipPath></defs>
      <path class="ruta-c-fondo" d="${linea}L${PW} ${PH}L0 ${PH}Z"/>
      <path class="ruta-c-linea" d="${linea}"/>
      <path class="ruta-c-hecho" d="${linea}" clip-path="url(#ruta-c-recorte)"/>
      <line class="ruta-c-cabeza" x1="0" x2="0" y1="-4" y2="${PH}" data-cabeza/>
    </svg>
    <p class="ruta-c-alt"><span data-alt>${Math.round(R.h[0])} m</span> sobre el mar</p>
    <p class="ruta-c-nota" data-nota>El camino de hoy por carretera; el de 1637 no lo conocemos.</p>
    <p class="ruta-c-fuente">Relieve y ortofoto © IGN (CC BY 4.0) · ruta: OSRM, © OpenStreetMap</p>`;
  const q = s => el.querySelector(s);
  const eKm = q('[data-km]'), eTr = q('[data-tramo]'), eAlt = q('[data-alt]'), eRec = q('[data-recorte]'), eCab = q('[data-cabeza]'), eNota = q('[data-nota]');
  let ultimo = '';
  return function poner(F) {
    const c = enCamino(R, F.f), llega = F.llegada > .5, todo = F.vista > .5;
    const km = coma(F.llegada > .5 ? R.km : c.km);
    const tramo = todo ? `En línea recta son ${coma(R.recta)} km; en coche, una media hora.`
      : llega ? `${L.mon.t} de Celanova · 22 km por carretera hoy` : tramoDe(R, F.f).t;
    const nota = todo ? 'Alrededor: la frontera a 14 km, las termas de Prexigueiro a 23, Melgaço a 24 y Ribadavia a 27.'
      : 'El camino de hoy por carretera; el de 1637 no lo conocemos.';
    const clave = km + tramo + Math.round(c.h);
    if (clave === ultimo) return;
    ultimo = clave;
    eKm.textContent = km; eTr.textContent = tramo; eAlt.textContent = `${Math.round(llega ? L.mon.h : c.h)} m`; eNota.textContent = nota;
    const x = (F.llegada > .5 ? 1 : F.f) * PW;
    eRec.setAttribute('width', x.toFixed(1)); eCab.setAttribute('x1', x.toFixed(1)); eCab.setAttribute('x2', x.toFixed(1));
  };
}

/** El itinerario en texto (para lectores de pantalla y sin JS de la escena): una lista ordenada */
export function itinerario(T) {
  const R = T.ruta, L = T.lugares, li = [];
  for (const t of R.tramos) {
    const c = enCamino(R, t.f);
    li.push(`<li>Km ${coma(c.km)} · ${t.t} (${Math.round(c.h)} m).</li>`);
  }
  li.push(`<li>Km ${coma(R.km)} · Llega al monasterio de San Salvador de Celanova (${Math.round(L.mon.h)} m): 22 km por carretera hoy, ${coma(R.recta)} en línea recta.</li>`);
  return `<ol>${li.join('')}</ol><p>Es el camino de hoy por carretera; el de 1637 no lo conocemos.</p>`;
}

// ---------- los rótulos ----------
/** lista: [{ k, t, sub, clase }] → { els, colocar(pos) } con pos[i] = { x, y, visible, op? } en px del marco */
export function crearRotulos(capa, lista) {
  capa.textContent = '';
  const rot = lista.map(r => {
    const d = document.createElement('div');
    d.className = 'ruta-rotulo' + (r.clase ? ' ' + r.clase : ''); d.dataset.lugar = r.k;
    d.innerHTML = `${r.t}${r.sub ? `<small>${r.sub}</small>` : ''}`;
    d.style.display = 'none';
    capa.appendChild(d); return { ...r, d, w: 0, h: 0 };
  });
  return {
    rot,
    medir() { rot.forEach(r => { r.w = 0; }); },
    /** en orden de la lista: el que choca con uno anterior o no cabe entero en el marco no se pone */
    colocar(pos) {
      const puestos = [], cw = capa.clientWidth, ch = capa.clientHeight;
      rot.forEach((r, i) => {
        const p = pos[i];
        if (!p || !p.visible || (p.op ?? 1) <= .01) { r.d.style.display = 'none'; return; }
        if (r.d.style.display === 'none') r.d.style.display = '';
        if (!r.w) { r.w = r.d.offsetWidth || 120; r.h = r.d.offsetHeight || 34; }
        // si el punto está dentro pero el rótulo se sale por un lado, el rótulo se corre hacia dentro
        let x = p.x;
        if (p.x >= 4 && p.x <= cw - 4) x = Math.min(cw - 4 - r.w / 2, Math.max(4 + r.w / 2, p.x));
        const c = { x0: x - r.w / 2, x1: x + r.w / 2, y0: p.y - r.h - 12, y1: p.y };
        const cabe = c.x0 >= 4 && c.x1 <= cw - 4 && c.y0 >= 4 && c.y1 <= ch - 4 && !puestos.some(o => c.x0 < o.x1 + 4 && c.x1 > o.x0 - 4 && c.y0 < o.y1 && c.y1 > o.y0);
        if (!cabe) { r.d.style.display = 'none'; return; }
        puestos.push(c);
        r.d.style.opacity = (p.op ?? 1) < 1 ? (p.op).toFixed(2) : '';
        r.d.style.transform = `translate(${x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
        r.d.style.setProperty('--guia', `${(p.x - x + r.w / 2).toFixed(1)}px`);   // la rayita sigue apuntando al sitio
      });
    },
    ocultar() { rot.forEach(r => { r.d.style.display = 'none'; }); },
  };
}

/** Los rótulos de la escena (los mismos en 3D y en plano), con cuándo se ven */
export function listaRotulos(T) {
  const L = T.lugares;
  return [
    { k: 'casa', t: L.casa.t, sub: `${L.casa.sub} · ${Math.round(L.casa.h)} m`, clase: 'casa' },
    { k: 'mon', t: `${L.mon.t} de Celanova`, sub: '22 km por carretera hoy', clase: 'mon' },
    { k: 'ramiras', t: L.ramiras.t, sub: 'de camino, km 12', clase: 'camino' },
    { k: 'frontera', t: L.frontera.t, sub: L.frontera.sub },
    { k: 'termas', t: `hacia ${L.termas.t}`, sub: L.termas.sub, clase: 'fuera' },
    { k: 'ribadavia', t: `hacia ${L.ribadavia.t}`, sub: L.ribadavia.sub, clase: 'fuera' },
    { k: 'melgaco', t: `hacia ${L.melgaco.t}`, sub: L.melgaco.sub, clase: 'fuera' },
  ];
}
/** Opacidad de cada rótulo según la fase (libre = el explorador: todos) */
export function opRotulo(k, F, libre) {
  if (libre) return 1;
  if (k === 'casa') return 1 - F.llegada * (1 - F.vista);
  if (k === 'mon') return Math.max(suave((F.f - .78) / .12), F.llegada);
  if (k === 'ramiras') return Math.min(suave((F.f - .42) / .06), 1 - suave((F.f - .66) / .06)) * (1 - F.llegada);
  return F.vista;
}
