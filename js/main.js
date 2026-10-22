/* ------------------------------------------------------------------
   A Casa da Tulla · Gomesende · «La tulla» · lo común de la página
   - El sol de Gomesende (Tulla.sol) y la hora (Tulla.hora, acepta ?hora=).
   - La luz: --luz (0 → 1) con el scroll, de la tarde a la noche (colores en OKLCH).
   - Monta los módulos (pincel, árboles, ruta, ferrado) con su respaldo.
   - La cortina es del módulo Entrada (js/grano.js); el puente con ella está en
     partes/cabeza.html (Tulla.abrir, Tulla.retirarCortina, Tulla.alAbrirse).
   - El motor de reservas va en js/reserva.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // «con-movimiento» solo sin movimiento reducido: si no, los titulares partidos se quedarían escondidos
  const motion = !quieto;
  if (motion) raiz.classList.add('con-movimiento');
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const params = new URLSearchParams(location.search);
  const sin3d = params.has('sin-3d');

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const T = (window.Tulla = window.Tulla || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. la hora y el sol de Gomesende (fórmulas de SunCalc) ============ */
  const LAT = 42.1639316, LNG = -8.105519;
  const ZONA = 'Europe/Madrid';
  const fHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  // desfase de Madrid (ms) en un instante dado
  function desfase(d) {
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000;
  }
  // «2026-10-22T19:00» = las 19:00 de Madrid (si no lleva zona)
  function deMadrid(s) {
    if (!s) return null;
    if (/[zZ]|[+-]\d\d:?\d\d$/.test(s)) { const d = new Date(s); return isNaN(d) ? null : d; }
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2})(?::(\d{2}))?)?/.exec(s);
    if (!m) return null;
    const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0));
    let d = new Date(utc - desfase(new Date(utc)));
    d = new Date(utc - desfase(d)); // segunda pasada por si cae en el cambio de hora
    return d;
  }
  const horaFija = deMadrid(params.get('hora'));
  T.hora = () => (horaFija ? new Date(horaFija) : new Date());

  const rad = Math.PI / 180, DIA = 864e5, J1970 = 2440588, J2000 = 2451545, OBL = rad * 23.4397, J0 = 0.0009;
  const aJuliano = (d) => d.valueOf() / DIA - 0.5 + J1970;
  const deJuliano = (j) => new Date((j + 0.5 - J1970) * DIA);
  const aDias = (d) => aJuliano(d) - J2000;
  const declinacion = (l) => Math.asin(Math.sin(OBL) * Math.sin(l));
  const ascension = (l) => Math.atan2(Math.sin(l) * Math.cos(OBL), Math.cos(l));
  const anomalia = (d) => rad * (357.5291 + 0.98560028 * d);
  const longitud = (M) => M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  function altura(fecha) {
    const lw = rad * -LNG, phi = rad * LAT, d = aDias(fecha), L = longitud(anomalia(d));
    const dec = declinacion(L), H = rad * (280.16 + 360.9856235 * d) - lw - ascension(L);
    return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / rad;
  }
  function salidaPuesta(fecha) {
    const lw = rad * -LNG, phi = rad * LAT, d = aDias(fecha);
    const n = Math.round(d - J0 - lw / (2 * Math.PI));
    const ds = J0 + lw / (2 * Math.PI) + n, M = anomalia(ds), L = longitud(M), dec = declinacion(L);
    const tr = (a) => J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    const jMedio = tr(ds);
    const w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    const jPuesta = tr(J0 + (w + lw) / (2 * Math.PI) + n);
    return { salida: deJuliano(jMedio - (jPuesta - jMedio)), puesta: deJuliano(jPuesta) };
  }
  // fase: día (sol a más de 6º), dorada (hora dorada, ocaso y crepúsculo: entre 6º y −6º) o noche
  T.sol = (fecha) => {
    const f = fecha instanceof Date ? fecha : T.hora();
    const a = altura(f), sp = salidaPuesta(f);
    return { altura: Math.round(a * 100) / 100, salida: sp.salida, puesta: sp.puesta, fase: a > 6 ? 'dia' : a > -6 ? 'dorada' : 'noche' };
  };
  // la línea pequeña y verdadera de la portada
  const ahora = $('[data-luz-ahora]');
  if (ahora && !ahora.textContent.trim()) {
    const h = T.hora(), s = T.sol(h);
    let resto;
    if (h < s.salida) resto = 'el sol sale a las ' + fHora.format(s.salida);
    else if (h < s.puesta) resto = 'el sol se pone a las ' + fHora.format(s.puesta);
    // después de la puesta, cuándo sale mañana
    else resto = 'el sol sale a las ' + fHora.format(T.sol(new Date(h.getTime() + DIA)).salida);
    ahora.textContent = 'Ahora en Gomesende: ' + fHora.format(h) + ' · ' + resto;
    ahora.dataset.fase = s.fase;
  }

  /* ============ 2. la luz: de la tarde a la noche con el scroll ============ */
  // fotogramas clave (colores de verificar.mjs: texto ≥ 4,5:1 en cada tramo). Entre .64 y .70 se cruza
  // del ocaso a la noche: pasa mientras «La ruta del grano» tapa la pantalla, y el texto cambia de golpe en .67.
  const K = [
    [0, { fondo: '#F3EEE4', texto: '#2B2620', texto2: '#5B5047', acento: '#506312', btnf: '#506312', btnt: '#F3EEE4' }],
    [0.40, { fondo: '#EFE3CC', texto: '#2B2620', texto2: '#5B5047', acento: '#506312', btnf: '#506312', btnt: '#F3EEE4' }],
    [0.44, { fondo: '#EDD6AC', texto: '#2B2620', texto2: '#4D3C2D', acento: '#764629', btnf: '#764629', btnt: '#F3EEE4' }],
    [0.64, { fondo: '#EAC69C', texto: '#2B2620', texto2: '#4D3C2D', acento: '#764629', btnf: '#764629', btnt: '#F3EEE4' }],
    [0.70, { fondo: '#2A2E33', texto: '#F3EEE4', texto2: '#C4BBAE', acento: '#F2C46D', btnf: '#F2C46D', btnt: '#2B2620' }],
    [1, { fondo: '#16181C', texto: '#F3EEE4', texto2: '#C4BBAE', acento: '#F2C46D', btnf: '#F2C46D', btnt: '#2B2620' }],
  ];
  const CRUCE = [0.64, 0.70], GIRO = 0.67;
  // los tramos fijos (los mismos del CSS): la sobria, el movimiento reducido y la cabecera en el cruce
  const FIJO = {
    tarde: { fondo: '#F3EEE4', texto: '#2B2620' },
    ocaso: { fondo: '#EDD6AC', texto: '#2B2620' },
    noche: { fondo: '#1F2227', texto: '#F3EEE4', btnf: '#F2C46D', btnt: '#2B2620' },
  };
  const tramoDe = (l) => (l < 0.42 ? 'tarde' : l < GIRO ? 'ocaso' : 'noche');

  // sRGB ⇄ OKLCH
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  function aOklch(h) {
    const [r, g, b] = hex(h).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
  }
  function deOklch([L, C, H]) {
    const A = C * Math.cos(H), B = C * Math.sin(H);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return rgb.map((c) => Math.round(Math.min(1, Math.max(0, gam(c))) * 255));
  }
  const cache = new Map();
  const ok = (h) => { if (!cache.has(h)) cache.set(h, aOklch(h)); return cache.get(h); };
  function mezcla(a, b, t) {
    if (a === b || t <= 0) return deOklch(ok(a));
    if (t >= 1) return deOklch(ok(b));
    const p = ok(a), q = ok(b);
    let dh = q[2] - p[2];
    if (dh > Math.PI) dh -= 2 * Math.PI; else if (dh < -Math.PI) dh += 2 * Math.PI;
    // con poco croma el tono no cuenta: se toma el del otro color
    const h = p[1] < 0.02 ? q[2] : q[1] < 0.02 ? p[2] : p[2] + dh * t;
    return deOklch([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, h]);
  }
  const rgb = (c, a) => (a === undefined ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`);
  // los colores de una luz: interpolados en OKLCH por tramos; en el cruce, el fondo se interpola y el texto cambia en GIRO
  function coloresDe(l) {
    let i = 0;
    while (i < K.length - 2 && l > K[i + 1][0]) i++;
    const [la, A] = K[i], [lb, B] = K[i + 1];
    const t = Math.min(1, Math.max(0, (l - la) / (lb - la)));
    const cruce = la === CRUCE[0] && lb === CRUCE[1];
    const out = {};
    for (const k of Object.keys(A)) {
      if (cruce && k !== 'fondo') out[k] = deOklch(ok(l < GIRO ? A[k] : B[k]));
      else out[k] = mezcla(A[k], B[k], t);
    }
    return out;
  }
  T.colores = coloresDe;   // para las pruebas

  // la luz sale de la posición del centro de la pantalla entre las anclas de las secciones (data-luz);
  // en «La ruta del grano» (data-luz-cruce), de .64 a .70 mientras la escena tapa toda la pantalla
  const anclados = $$('[data-luz], [data-luz-cruce]');
  function anclas() {
    const a = [];
    anclados.forEach((el) => {
      const r = el.getBoundingClientRect(), top = r.top + scrollY, alto = r.height;
      if (el.hasAttribute('data-luz-cruce')) {
        const m = Math.min(altoVista, alto) / 2;
        a.push([top + m, CRUCE[0]], [Math.max(top + m, top + alto - m), CRUCE[1]]);
      } else if (alto > 0) a.push([top, parseFloat(el.dataset.luz) || 0]);
    });
    a.sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < a.length; i++) if (a[i][1] < a[i - 1][1]) a[i][1] = a[i - 1][1];
    return a;
  }
  function luzEn(y, a) {
    if (!a.length || y <= a[0][0]) return a.length ? a[0][1] : 0;
    for (let i = 1; i < a.length; i++) {
      if (y <= a[i][0]) {
        const [y0, l0] = a[i - 1], [y1, l1] = a[i];
        return y1 === y0 ? l1 : l0 + (l1 - l0) * (y - y0) / (y1 - y0);
      }
    }
    return a[a.length - 1][1];
  }
  const VARS = ['--l-fondo', '--l-texto', '--l-texto-2', '--l-acento', '--l-linea', '--l-btn-f', '--l-btn-t', '--l-foco'];
  let luz = -1, viva = null, tramo = '';
  function pintarLuz(forzar) {
    const l = Math.round(luzEn(scrollY + altoVista / 2, anclas()) * 1000) / 1000;
    const vivaAhora = motion && !sobria();
    if (!forzar && l === luz && vivaAhora === viva) return;
    luz = l;
    const st = raiz.style;
    st.setProperty('--luz', String(l));
    const tr = tramoDe(l);
    if (tr !== tramo) {
      raiz.classList.remove('luz-dia', 'luz-ocaso', 'luz-noche');
      raiz.classList.add(tr === 'tarde' ? 'luz-dia' : 'luz-' + tr);
      tramo = tr;
    }
    const c = coloresDe(l);
    if (vivaAhora) {
      st.setProperty('--l-fondo', rgb(c.fondo));
      st.setProperty('--l-texto', rgb(c.texto));
      st.setProperty('--l-texto-2', rgb(c.texto2));
      st.setProperty('--l-acento', rgb(c.acento));
      st.setProperty('--l-linea', rgb(c.texto, 0.2));
      st.setProperty('--l-btn-f', rgb(c.btnf));
      st.setProperty('--l-btn-t', rgb(c.btnt));
      st.setProperty('--l-foco', rgb(l < GIRO ? c.texto : c.acento));
    } else if (viva !== false) VARS.forEach((v) => st.removeProperty(v));
    viva = vivaAhora;
    // la cabecera: nunca en el tramo de cruce (o clara o de noche)
    const cab = vivaAhora && !(l > CRUCE[0] && l < CRUCE[1]) ? c : (() => { const f = FIJO[tr]; return { fondo: hex(f.fondo).map((x) => Math.round(x * 255)), texto: hex(f.texto).map((x) => Math.round(x * 255)) }; })();
    st.setProperty('--cab-fondo', rgb(cab.fondo, 0.9));
    st.setProperty('--cab-texto', rgb(cab.texto));
    st.setProperty('--cab-btn-f', tr === 'noche' ? '#F2C46D' : tr === 'ocaso' ? '#764629' : '#506312');
    st.setProperty('--cab-btn-t', tr === 'noche' ? '#2B2620' : '#F3EEE4');
    document.dispatchEvent(new CustomEvent('tulla:luz', { detail: { luz: l, tramo: tr } }));
  }
  T.luz = () => luz;

  /* ============ 3. titulares partidos ============ */
  function partir(h) {
    if (h.classList.contains('es-partido')) return;
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    const envolver = (nodo) => {
      if (nodo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        nodo.textContent.split(/([ \t\r\n]+)/).forEach((t) => {
          if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
          const pal = document.createElement('span');
          pal.className = 'pal';
          pal.setAttribute('aria-hidden', 'true');
          const i = document.createElement('i');
          i.textContent = t;
          i.style.setProperty('--n', n++);
          pal.appendChild(i);
          frag.appendChild(pal);
        });
        nodo.replaceWith(frag);
      } else if (nodo.nodeType === 1) Array.from(nodo.childNodes).forEach(envolver);
    };
    Array.from(h.childNodes).forEach(envolver);
    h.classList.add('es-partido');
  }
  if (motion && 'IntersectionObserver' in window) {
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('[data-partir]').forEach((h) => { partir(h); vistos.observe(h); });
  }

  /* ============ 4. Lenis (y el ScrollTrigger de los módulos) ============ */
  const G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true, lerp: 0.11 });
    if (G && ST) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cab')) || 72;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    if (lenis) lenis.scrollTo(y, { duration: 1.3 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };
  // los módulos llaman aquí para reservar: baja al simulador
  T.reservar = () => irA('#reservar');

  /* ============ 5. módulos: pincel (portada), árboles, ruta (3D) y ferrado (pie) ============ */
  // se montan al acercarse; el pincel, cuando la cortina EMPIEZA a abrirse. Si su JS falla o no está,
  // se queda el respaldo del HTML. Se guarda el respaldo para volver a montar al cambiar de densidad.
  const montados = new Map();     // el → { inst, respaldo }
  const esperando = new Set();    // cerca de la pantalla, pero su JS aún no ha llegado (el 3D es un módulo diferido)
  function modulo(nombre) {
    if (nombre === 'ferrado') {
      if (T.grano && typeof T.grano.ferrado === 'function') return { montar: (el, op) => T.grano.ferrado(el, op) };
      if (T.ferrado && typeof T.ferrado.montar === 'function') return T.ferrado;
      if (T.grano && typeof T.grano.montar === 'function') return T.grano;
      return null;
    }
    const m = T[nombre];
    return m && typeof m.montar === 'function' ? m : null;
  }
  const opciones = (el) => {
    const op = { movimiento: motion, densidad: sobria() ? 'sobria' : 'tulla', hora: T.hora() };
    if (el.dataset.modulo === 'ferrado') op.tipo = 'ferrado';
    if (el.dataset.modulo === 'ruta' && sin3d) { op.gl = false; op.sin3d = true; }
    return op;
  };
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el.dataset.modulo);
    if (!mod) { esperando.add(el); return; }
    esperando.delete(el);
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones(el));
      montados.set(el, { inst, respaldo });
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); };
  addEventListener('load', reintentar);
  document.addEventListener('tulla:listo', reintentar);
  function remontarTodos() {
    // sobre una copia: montar otra vez mete la entrada de nuevo en el Map
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
    if (ST) ST.refresh();
  }
  const portadaPincel = $('#portada [data-modulo="pincel"]');
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    $$('[data-modulo]').forEach((el) => { if (el !== portadaPincel) ioMod.observe(el); });
  } else $$('[data-modulo]').forEach((el) => { if (el !== portadaPincel) montarModulo(el); });

  /* ============ 6. la cortina (del módulo Entrada): alAbrirse() y su retirada ============ */
  const cortina = $('#cortina');
  T.alAbrirse(() => {
    $('#portada').classList.add('abierta');
    if (portadaPincel) montarModulo(portadaPincel);
  });
  let fuera = false;
  function alSalir() {
    if (fuera) return;
    fuera = true;
    if (cortina && !cortina.hidden && getComputedStyle(cortina).display !== 'none') cortina.hidden = true;
    if (lenis) lenis.start();
    if (G) G.ticker.lagSmoothing(0);      // al retirar la cortina, nunca antes
    if (ST) ST.refresh();
    pintarLuz(true);
    mostrarCookies();
  }
  document.addEventListener('tulla:fuera', alSalir);
  const retirarCortina = () => { T.retirarCortina(); alSalir(); };
  if (T.cortinaFuera) setTimeout(alSalir, 0);
  // si la cortina se esconde o desaparece por su cuenta, también cuenta como retirada
  if (cortina && 'MutationObserver' in window) {
    const mo = new MutationObserver(() => {
      if (!document.contains(cortina) || cortina.hidden || cortina.dataset.estado === 'fuera') { mo.disconnect(); retirarCortina(); }
    });
    mo.observe(document.body, { childList: true });
    mo.observe(cortina, { attributes: true, attributeFilter: ['hidden', 'data-estado'] });
  }

  /* ============ 7. cabecera, menú y anclas ============ */
  const cab = $('#cab');
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, 1000);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 8. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'casadatulla-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });

  // la cortina la arranca sola js/grano.js (con Tulla.cortina y los eventos tulla:cortina-abre / -fuera).
  // Si no hay cortina, si el movimiento está reducido o si su JS no ha llegado, fuera ya.
  if (T.cortina && T.cortina.fuera) retirarCortina();
  if (T.cortina && typeof T.cortina.alAbrirse === 'function') T.cortina.alAbrirse(() => T.abrir());
  if (!cortina || !motion || !T.grano) retirarCortina();
  // red de seguridad propia por si la cortina se atasca
  setTimeout(retirarCortina, 7000);

  /* ============ 9. mapa de Google solo al pedirlo ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('42.1639316,-8.105519') + '&z=15&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con A Casa da Tulla en Gomesende';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 10. visor de fotos: se abre por el NOMBRE de la foto ============ */
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  // la serie se hace de la MISMA lista de miniaturas, sin repetir nombres
  function serie() {
    const vistas = new Map();
    $$('[data-visor]').forEach((b) => {
      const n = b.dataset.visor;
      if (vistas.has(n)) return;
      const img = b.querySelector('img');
      if (!img) return;
      const anchos = (img.getAttribute('srcset') || '').split(',').map((x) => parseInt(x.trim().split(/\s+/)[1], 10)).filter(Boolean).sort((a, z) => a - z);
      const pie = b.closest('figure, article, li')?.querySelector('figcaption, h3');
      vistas.set(n, { n, alt: img.alt, pie: pie ? pie.textContent.replace(/\s+/g, ' ').trim() : img.alt, anchos: anchos.length ? anchos : [800], ancho: +img.getAttribute('width') || 1024, alto: +img.getAttribute('height') || 768 });
    });
    return [...vistas.values()];
  }
  let lista = [], actual = 0, origen = null;
  function poner(i) {
    actual = (i + lista.length) % lista.length;
    const f = lista[actual];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0], gran = f.anchos[f.anchos.length - 1];
    // primero la de 800 (o la menor, ya en caché), y la grande al cargar
    vImg.src = `img/fotos/${f.n}-${peq}.jpg`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    vImg.style.setProperty('--nat', f.ancho + 'px');
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.jpg`;
    }
    vPie.textContent = f.pie;
    vN.textContent = (actual + 1) + ' / ' + lista.length;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor]');
    if (!b || !visor || typeof visor.showModal !== 'function') return;
    lista = serie();
    const i = lista.findIndex((f) => f.n === b.dataset.visor);
    if (i < 0) return;
    origen = b;
    poner(i);
    visor.showModal();
    if (lenis) lenis.stop();
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actual - 1));
    $('#visor-sig').addEventListener('click', () => poner(actual + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actual - 1); else if (e.key === 'ArrowRight') poner(actual + 1); });
    visor.addEventListener('close', () => { if (lenis) lenis.start(); if (origen) origen.focus({ preventScroll: true }); });
  }

  /* ============ 11. el foco del teclado: contorno de 2 px y un trazo de pincel debajo ============ */
  const pincelFoco = $('#foco-pincel');
  let enfocado = null;
  function ponerPincel() {
    if (!pincelFoco) return;
    const el = enfocado;
    if (!el || !document.contains(el) || el.closest('dialog')) { pincelFoco.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { pincelFoco.classList.remove('es-visible'); return; }
    const fijo = !!el.closest('.cab, .cookies, .mando, .menu-movil, .saltar');
    pincelFoco.classList.toggle('es-fijo', fijo);
    const ancho = Math.max(28, Math.min(r.width + 8, 420));
    pincelFoco.style.width = ancho + 'px';
    pincelFoco.style.left = (r.left + r.width / 2 - ancho / 2 + (fijo ? 0 : scrollX)) + 'px';
    pincelFoco.style.top = (r.bottom + 6 + (fijo ? 0 : scrollY)) + 'px';
    pincelFoco.style.color = getComputedStyle(el).getPropertyValue('--foco').trim() || '';
    pincelFoco.classList.add('es-visible');
  }
  // :focus-visible se decide al terminar de moverse el foco: se mira un instante después
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible'); } catch (er) {}
      enfocado = visible ? el : null;
      ponerPincel();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 12. con el scroll: cabecera, luz y módulos que esperan ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    cab.classList.toggle('sc', scrollY > 24);
    pintarLuz();
    reintentar();
    if (enfocado && pincelFoco.classList.contains('es-fijo')) ponerPincel();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  // los módulos cambian de alto al montarse: la luz se vuelve a medir (solo se lee, no se rehace nada)
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (!pend) pend = requestAnimationFrame(alScroll); }).observe($('#principal'));
  alScroll();
  pintarLuz(true);

  /* ============ 13. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      pintarLuz(true);
      remontarTodos();
      document.dispatchEvent(new CustomEvent('tulla:densidad', { detail: sobria() ? 'sobria' : 'tulla' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 14. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('tulla:resize'));
      pintarLuz(true);
      ponerPincel();
    }, 200);
  });

  // lo que pueden usar los módulos y las pruebas
  T.web = {
    motion, quieto, sobria, lenis, irA, montados,
    alAbrirse: T.alAbrirse, abrir: T.abrir, retirarCortina,
    get fuera() { return fuera; }, get altoVista() { return altoVista; },
  };
})();
