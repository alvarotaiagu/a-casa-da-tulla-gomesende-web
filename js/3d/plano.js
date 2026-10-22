// «En plano»: la ruta del grano en 2D (sin WebGL). El relieve sombreado sobre la ortofoto del IGN (img/terreno/plano-base)
// y encima, en SVG, el hilo de granos que avanza con el scroll y una «cámara» (el viewBox) que lo acompaña, igual que el 3D:
// la casa de cerca, el viaje, el monasterio y al final todo el valle. Es el plan B (sin WebGL2, ahorro de datos, ?sin-3d)
// y el botón «En plano». Los rótulos son los mismos que en 3D (guion.js).
import { fase, enCamino, clamp, suave, crearRotulos, listaRotulos, opRotulo } from './guion.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const mezcla = (a, b, k) => a + (b - a) * k;

/** caja: el contenedor (.ruta-plano; los rótulos van en su propia capa dentro), base: URL de img/terreno/ */
export function montarPlano(caja, T, { base, movimiento }) {
  const PW = T.plano.w, PH = T.plano.h, R = T.ruta, L = T.lugares;
  const aP = (x, z) => [(x / T.ancho + .5) * PW, (z / T.alto + .5) * PH];
  // el camino en coordenadas del plano y una copia suavizada (≈600 m) para que la cámara no dé tirones en las curvas
  const n = R.x.length, PX = new Float32Array(n), PY = new Float32Array(n);
  for (let i = 0; i < n; i++) { const [x, y] = aP(R.x[i], R.z[i]); PX[i] = x; PY[i] = y; }
  const SX = new Float32Array(n), SY = new Float32Array(n), V = 50;
  for (let i = 0; i < n; i++) { let sx = 0, sy = 0, c = 0; for (let j = Math.max(0, i - V); j <= Math.min(n - 1, i + V); j++) { sx += PX[j]; sy += PY[j]; c++; } SX[i] = sx / c; SY[i] = sy / c; }
  let d = ''; for (let i = 0; i < n; i += 2) d += (i ? 'L' : 'M') + PX[i].toFixed(1) + ' ' + PY[i].toFixed(1);
  d += 'L' + PX[n - 1].toFixed(1) + ' ' + PY[n - 1].toFixed(1);
  const [cx, cy] = aP(...L.casa.xz), [mx, my] = aP(...L.mon.xz);

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'ruta-plano-svg'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = `
    <defs><mask id="ruta-p-mascara" maskUnits="userSpaceOnUse" x="-50" y="-50" width="${PW + 100}" height="${PH + 100}">
      <path d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-dasharray="1 2" stroke-dashoffset="1" data-revela/></mask>
      <radialGradient id="ruta-p-brillo"><stop offset="0" stop-color="#F2C46D" stop-opacity=".95"/><stop offset=".35" stop-color="#F2C46D" stop-opacity=".45"/><stop offset="1" stop-color="#F2C46D" stop-opacity="0"/></radialGradient></defs>
    <image href="${base}plano-base.webp" x="0" y="0" width="${PW}" height="${PH}" preserveAspectRatio="none"/>
    <path class="ruta-p-borde" d="${d}" pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1" data-hilo/>
    <path class="ruta-p-hilo" d="${d}" pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1" data-hilo/>
    <path class="ruta-p-granos" d="${d}" mask="url(#ruta-p-mascara)" data-granos/>
    <circle class="ruta-p-brillo" r="26" fill="url(#ruta-p-brillo)" cx="${cx}" cy="${cy}" data-cabeza/>
    <circle class="ruta-p-punto casa" r="7" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}"/>
    <circle class="ruta-p-punto mon" r="7" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}"/>`;
  // si el navegador no tiene WebP, la imagen JPG
  const img = svg.querySelector('image');
  const prueba = new Image(); prueba.onerror = () => img.setAttribute('href', `${base}plano-base.jpg`); prueba.src = `${base}plano-base.webp`;
  caja.appendChild(svg);
  const capa = document.createElement('div'); capa.className = 'ruta-rotulos'; capa.setAttribute('aria-hidden', 'true'); caja.appendChild(capa);
  const revela = svg.querySelector('[data-revela]'), hilos = svg.querySelectorAll('[data-hilo]'), granos = svg.querySelector('[data-granos]'), cabeza = svg.querySelector('[data-cabeza]');

  const lista = listaRotulos(T);
  const rotulos = crearRotulos(capa, lista);
  const puntos = lista.map(r => [L[r.k].uv[0] * PW, L[r.k].uv[1] * PH]);

  // ---------- la cámara 2D: ancho visible (en px del plano) y centro según la fase ----------
  let cw = 0, ch = 0, vb = [0, 0, PW, PH], esc = 1;
  function camara(F) {
    const a = cw / ch;
    const c = enCamino(R, F.f), i = Math.round(c.i);
    const zoomViaje = a < 1 ? 520 : 600;
    let w = mezcla(zoomViaje, a < 1 ? 300 : 360, F.intro), x = mezcla(SX[i], cx, F.intro), y = mezcla(SY[i], cy, F.intro);
    w = mezcla(w, a < 1 ? 360 : 420, F.llegada); x = mezcla(x, mx, F.llegada); y = mezcla(y, my, F.llegada);
    // la vista de todo: el plano entero (el camino y, en los bordes, la frontera y los «hacia …» de alrededor)
    w = mezcla(w, PW * 1.02, F.vista); x = mezcla(x, PW / 2, F.vista); y = mezcla(y, PH / 2, F.vista);
    let h = w / a;
    if (h > PH && F.vista < .5) { h = PH; w = h * a; }
    // como en 3D: el grano, a la derecha del cuaderno (apaisado) o por encima de él (vertical)
    const e = cw / w, dx = a >= 1 && cw > 760 ? Math.min(190, cw * .13) : 0, dy = a < 1 || cw <= 760 ? Math.min(120, ch * .14) : 0;
    x -= dx / e * (1 - F.vista); y += dy / e * (1 - F.vista);
    // dentro de la imagen siempre que quepa
    x = w >= PW ? PW / 2 : clamp(x, w / 2, PW - w / 2); y = h >= PH ? PH / 2 : clamp(y, h / 2, PH - h / 2);
    return [x - w / 2, y - h / 2, w, h];
  }
  function medir() { cw = caja.clientWidth; ch = caja.clientHeight; rotulos.medir(); }

  let p = 0, pv = 0, raf = 0, ultimo = 0, activo = false;
  function pintar() {
    if (!cw || !ch) medir();
    if (!cw || !ch) return;
    const F = fase(pv), fh = F.llegada > .5 ? 1 : F.f;
    vb = camara(F); esc = cw / vb[2];
    svg.setAttribute('viewBox', vb.map(v => v.toFixed(1)).join(' '));
    // el trazo y los granos, del mismo grosor en pantalla a cualquier zoom
    const off = (1 - fh).toFixed(4);
    revela.setAttribute('stroke-dashoffset', off); hilos.forEach(h => h.setAttribute('stroke-dashoffset', off));
    svg.style.setProperty('--z', esc.toFixed(3));
    const c = enCamino(R, fh), i = Math.round(c.i);
    cabeza.setAttribute('cx', PX[i].toFixed(1)); cabeza.setAttribute('cy', PY[i].toFixed(1));
    cabeza.setAttribute('r', (26 / Math.sqrt(esc)).toFixed(1));
    cabeza.style.opacity = fh > 0 && fh < 1 ? '1' : '0';
    rotulos.colocar(lista.map((r, k) => ({ x: (puntos[k][0] - vb[0]) * esc, y: (puntos[k][1] - vb[1]) * esc - 8, visible: true, op: opRotulo(r.k, F, false) })));
  }
  function cuadro(t) {
    raf = 0;
    if (!activo) return;
    const dt = ultimo ? Math.min(100, t - ultimo) : 16; ultimo = t;
    pv = movimiento ? pv + (p - pv) * (1 - Math.exp(-dt / 110)) : p;
    if (Math.abs(p - pv) < 1e-4) pv = p;
    pintar();
    if (pv !== p) raf = requestAnimationFrame(cuadro); else ultimo = 0;
  }
  const pedir = () => { if (!raf && activo) raf = requestAnimationFrame(cuadro); };
  const ro = new ResizeObserver(() => { const w = caja.clientWidth, h = caja.clientHeight; if (w !== cw || Math.abs(h - ch) > 0) { medir(); pedir(); } });
  ro.observe(caja);

  return {
    svg, rotulos,
    get progreso() { return pv; },
    ponerProgreso(v, deGolpe) { p = clamp(v); if (deGolpe || !movimiento) pv = p; pedir(); },
    mostrar(si) { activo = si; caja.hidden = !si; if (si) { medir(); pv = p; pedir(); } else { cancelAnimationFrame(raf); raf = 0; rotulos.ocultar(); } },
    destruir() { activo = false; cancelAnimationFrame(raf); ro.disconnect(); svg.remove(); capa.remove(); },
  };
}
