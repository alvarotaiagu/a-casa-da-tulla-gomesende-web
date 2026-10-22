/* ------------------------------------------------------------------
   A Casa da Tulla · «La tulla» · portada «Pincel»            (agente Entrada)
   1. El logo REAL se descubre trazo a trazo con una brocha de cerdas: los
      muros, las ventanas, el tejado de pincel seco y, al final, el río.
      (No se redibuja: las pinceladas son máscaras que pintan SUS píxeles.)
   2. El trazo azul del río sigue: la brocha vuelve y barre en zigzag la
      forma-marco (img/pincel/marco-*.svg) y, detrás del azul húmedo, va
      quedando la foto de la casa a la hora REAL de Gomesende.
   3. Gesto: arrastrar sobre la foto pinta la misma casa a otra hora (de día
      → de noche; de noche → al atardecer). Se seca y vuelve en unos 4 s.
      El botón «Verla de noche» hace lo mismo con una pasada automática.
   Contrato: Tulla.pincel.montar(el, { movimiento, densidad, hora }) → { destruir }.
   El HTML de `el` (la foto en su pincelada CSS) es el respaldo.
   Expone también Tulla.pincel.brocha (la usa la cortina de js/grano.js).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const T = (window.Tulla = window.Tulla || {});
  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    try { return new URL('../', s || location.href).href; } catch (e) { return './'; }
  })();
  const url = (r) => BASE + r;

  // datos que se piden ya (la portada se monta ~2 s después, al abrirse la cortina)
  const pedir = (r) => fetch(url(r)).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  let pDatos = null, pFotos = null;
  const datos = () => (pDatos = pDatos || pedir('img/pincel/pincel.json'));
  const fotos = () => (pFotos = pFotos || pedir('img/fotos/fotos.json'));
  if (document.querySelector('[data-modulo="pincel"]')) { datos(); fotos(); }

  /* ================= utilidades ================= */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const expoInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
  const cuadInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  function azar(semilla) {               // mulberry32: siempre la misma brocha
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const DPR = () => Math.min(window.devicePixelRatio || 1, 1.5);   // presupuesto: nunca más de 1,5
  const cargar = (src) => new Promise((ok, mal) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => ok(i);
    i.onerror = mal;
    i.src = src;
  });
  const listo = (img) => (img.complete && img.naturalWidth ? Promise.resolve(img) : new Promise((ok, mal) => {
    img.addEventListener('load', () => ok(img), { once: true });
    img.addEventListener('error', mal, { once: true });
  }));

  /* ================= la brocha de cerdas =================
     Una brocha son N cerdas repartidas a lo ancho. Cada una pinta su propia línea, desplazada
     sobre la normal del trazo, con su grosor, su carga de pintura, un pequeño retraso (la
     cabeza del trazo sale deshilachada) y, las de los bordes, cortes de pincel seco.
     Se pinta por tramos: cada fotograma solo añade lo nuevo (barato). */
  function brocha(semilla, n) {
    const r = azar(semilla);
    const cerdas = [];
    for (let i = 0; i < n; i++) {
      const o = (i + 0.5) / n - 0.5 + (r() - 0.5) * (0.9 / n);
      const borde = Math.abs(o) > 0.34;
      cerdas.push({
        o,
        g: 0.75 + r() * 0.95,                                  // grosor relativo
        carga: borde ? 0.35 + r() * 0.5 : 0.84 + r() * 0.16,    // tinta
        lag: r() * r() * 0.05 + Math.abs(o) * 0.045,            // retraso (en fracción del trazo)
        seco: borde ? 0.45 + r() * 0.5 : 0,                     // umbral de los cortes secos
        f1: 0.011 + r() * 0.02, f2: 0.031 + r() * 0.04, fase: r() * 100,
        tono: r(),
      });
    }
    return cerdas;
  }
  // muestrea una polilínea con Catmull-Rom (cada ~3 px) y guarda la longitud acumulada y las normales
  function muestrear(p, paso) {
    paso = paso || 3;
    const P = [p[0]].concat(p, [p[p.length - 1]]);
    const X = [], Y = [];
    for (let i = 1; i < P.length - 2; i++) {
      const [x0, y0] = P[i - 1], [x1, y1] = P[i], [x2, y2] = P[i + 1], [x3, y3] = P[i + 2];
      const L = Math.hypot(x2 - x1, y2 - y1);
      const k = Math.max(2, Math.ceil(L / paso));
      for (let j = 0; j < k; j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        X.push(0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3));
        Y.push(0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3));
      }
    }
    X.push(p[p.length - 1][0]); Y.push(p[p.length - 1][1]);
    const n = X.length, S = new Float32Array(n), NX = new Float32Array(n), NY = new Float32Array(n);
    for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
      const dx = X[b] - X[a], dy = Y[b] - Y[a], l = Math.hypot(dx, dy) || 1;
      NX[i] = -dy / l; NY[i] = dx / l;
    }
    return { X, Y, S, NX, NY, n, L: S[n - 1] || 1 };
  }
  /* un trazo: puntos + ancho + brocha. pintar(ctx, cabeza) añade lo que falta hasta `cabeza`
     (longitud de arco recorrida por la cabeza). op: { estilo (color o patrón), solido, presion(u),
     tonos: [colores] }. */
  function trazo(puntos, ancho, cerdas, op) {
    op = op || {};
    const m = muestrear(puntos, op.paso);
    const hechos = new Int32Array(cerdas.length).fill(0);
    const presion = op.presion || ((u) => Math.min(1, 0.6 + u * 7) * (u > 0.86 ? 1 - (u - 0.86) * 1.4 : 1));
    const nC = cerdas.length;
    function pintar(ctx, cabeza) {
      const { X, Y, S, NX, NY, n, L } = m;
      ctx.lineJoin = 'round';
      for (let c = 0; c < nC; c++) {
        const b = cerdas[c];
        const sb = cabeza - b.lag * Math.min(L, 900);
        let i0 = hechos[c];
        if (sb <= S[i0]) continue;
        let i1 = i0;
        while (i1 < n - 1 && S[i1 + 1] <= sb) i1++;
        if (i1 === i0) continue;
        const mid = (i0 + i1) >> 1;
        const u = S[mid] / L;
        const w = ancho * presion(u);
        let a = op.solido ? 1 : b.carga;
        if (b.seco && !op.solido) {
          const nn = Math.sin(S[mid] * b.f1 + b.fase) + 0.6 * Math.sin(S[mid] * b.f2 + b.fase * 1.7);
          const corte = clamp((nn + 1.6) / 3.2, 0, 1);       // 0..1
          a *= clamp((corte - b.seco * 0.7) * 3.2, 0, 1);
          // al final del trazo las cerdas del borde se quedan sin pintura
          a *= clamp((1.08 - u) * 3, 0, 1);
        }
        if (a > 0.02) {
          ctx.globalAlpha = a;
          ctx.lineWidth = Math.max(0.6, (ancho / nC) * b.g * 1.9 * presion(u));
          ctx.lineCap = a >= 0.98 ? 'round' : 'butt';
          if (op.tonos) ctx.strokeStyle = op.tonos[Math.floor(b.tono * op.tonos.length)];
          else ctx.strokeStyle = op.estilo;
          ctx.beginPath();
          for (let i = i0; i <= i1; i++) {
            const ww = (op.presion ? w : ancho * presion(S[i] / L)) * b.o;
            const x = X[i] + NX[i] * ww, y = Y[i] + NY[i] * ww;
            if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        hechos[c] = i1;
      }
      ctx.globalAlpha = 1;
    }
    // hasta dónde tiene que llegar la cabeza para que acabe también la cerda más retrasada
    const fin = m.L + Math.max.apply(null, cerdas.map((b) => b.lag)) * Math.min(m.L, 900) + 2;
    return { pintar, L: m.L, fin, m, acabado: () => hechos.every((h) => h >= m.n - 1) };
  }

  /* ================= el sol en Gomesende (fórmulas de SunCalc) =================
     Se usa Tulla.sol de la web si existe (para que la portada y la luz digan lo mismo);
     si no (página de prueba), este. Coordenadas de la casa: 42.1639316, -8.105519. */
  const LAT = 42.1639316, LNG = -8.105519;
  const RAD = Math.PI / 180, DIA = 864e5, J1970 = 2440588, J2000 = 2451545, EPS = RAD * 23.4397;
  const aJul = (d) => d.valueOf() / DIA - 0.5 + J1970;
  const deJul = (j) => new Date((j + 0.5 - J1970) * DIA);
  const dias = (d) => aJul(d) - J2000;
  const decl = (l) => Math.asin(Math.sin(EPS) * Math.sin(l));
  const ascR = (l) => Math.atan2(Math.sin(l) * Math.cos(EPS), Math.cos(l));
  const anomalia = (d) => RAD * (357.5291 + 0.98560028 * d);
  const longEcl = (M) => M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
  function alturaSol(fecha) {
    const lw = RAD * -LNG, phi = RAD * LAT, d = dias(fecha);
    const L = longEcl(anomalia(d)), dec = decl(L), H = RAD * (280.16 + 360.9856235 * d) - lw - ascR(L);
    return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
  }
  function salidaPuesta(fecha) {
    const lw = RAD * -LNG, phi = RAD * LAT, d = dias(fecha), J0 = 0.0009;
    const n = Math.round(d - J0 - lw / (2 * Math.PI));
    const ds = J0 + lw / (2 * Math.PI) + n;
    const M = anomalia(ds), L = longEcl(M), dec = decl(L);
    const transito = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    const w = Math.acos((Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    const a = J0 + (w + lw) / (2 * Math.PI) + n;
    const puesta = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    return { salida: deJul(transito - (puesta - transito)), puesta: deJul(puesta), mediodia: deJul(transito) };
  }
  // hora de Madrid
  const fmtHora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmtPartes = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function partesMadrid(t) {
    const o = {};
    fmtPartes.formatToParts(new Date(t)).forEach((p) => { o[p.type] = +p.value; });
    return o;
  }
  function madridAUtc(y, mo, d, h, mi) {
    const deseado = Date.UTC(y, mo - 1, d, h, mi);
    let t = deseado;
    for (let k = 0; k < 3; k++) {
      const p = partesMadrid(t);
      const visto = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
      t += deseado - visto;
    }
    return new Date(t);
  }
  function horaDeLaUrl() {
    try {
      const v = new URLSearchParams(location.search).get('hora');
      const m = v && /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2}))?/.exec(v);
      if (!m) return null;
      return madridAUtc(+m[1], +m[2], +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
    } catch (e) { return null; }
  }
  const comoFecha = (v) => (v instanceof Date ? v : typeof v === 'number' || typeof v === 'string' ? new Date(v) : null);
  function elSol(fecha) {
    const p = partesMadrid(fecha);
    const hoy = salidaPuesta(madridAUtc(p.year, p.month, p.day, 12, 0));
    const altura = alturaSol(fecha);
    let fase = altura >= 8 ? 'dia' : altura > -6 ? 'dorada' : 'noche';
    let salida = hoy.salida, puesta = hoy.puesta;
    if (typeof T.sol === 'function') {
      try {
        const s = T.sol(fecha) || {};
        if (s.fase === 'dia' || s.fase === 'dorada' || s.fase === 'noche') fase = s.fase;
        salida = comoFecha(s.salida) || salida;
        puesta = comoFecha(s.puesta) || puesta;
      } catch (e) { /* el nuestro */ }
    }
    const tarde = fecha >= hoy.mediodia;
    let foto = 'dia';
    if (fase === 'noche') foto = 'noche';
    else if (fase === 'dorada' && tarde) foto = altura > 0 ? 'ocaso-casa' : 'ocaso-valle';
    // la línea pequeña y verdadera
    let linea;
    if (fecha < salida) linea = 'el sol sale a las ' + fmtHora.format(salida);
    else if (fecha < puesta) linea = 'el sol se pone a las ' + fmtHora.format(puesta);
    else {
      const m = new Date(fecha.valueOf() + DIA), q = partesMadrid(m);
      linea = 'el sol sale a las ' + fmtHora.format(salidaPuesta(madridAUtc(q.year, q.month, q.day, 12, 0)).salida);
    }
    return { fase, foto, altura, salida, puesta, texto: 'Ahora en Gomesende: ' + fmtHora.format(fecha) + ' · ' + linea };
  }

  /* ================= fotos por nombre ================= */
  // punto de interés de cada foto (object-position), el mismo en el CSS del marco y en el lienzo
  const FOCO = { dia: [0.74, 0.42], 'ocaso-casa': [0.32, 0.34], 'ocaso-valle': [0.42, 0.62], noche: [0.46, 0.52] };
  const OTRA = { dia: 'noche', 'ocaso-casa': 'noche', 'ocaso-valle': 'noche', noche: 'ocaso-casa' };
  const ROTULO = { noche: 'Verla de noche', 'ocaso-casa': 'Verla al atardecer' };
  const ALT = {
    dia: 'A Casa da Tulla de día: la esquina de granito, el patio enlosado y las flores',
    'ocaso-casa': 'A Casa da Tulla al atardecer, con la piedra encendida y reflejada en la piscina',
    'ocaso-valle': 'El atardecer sobre el valle desde la piscina de A Casa da Tulla',
    noche: 'A Casa da Tulla de noche, con la fachada de granito iluminada',
  };
  function formatoDe(img) {
    const s = (img && (img.currentSrc || img.src)) || '';
    const m = /\.(avif|webp|jpe?g)(\?|$)/i.exec(s);
    return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'webp';
  }
  function ponerFoto(pic, img, nombre, lista) {
    const f = lista && lista.find((x) => x.nombre === nombre);
    if (!f) return false;
    const set = (ext) => f.anchos.map((w) => url(`img/fotos/${nombre}-${w}.${ext} ${w}w`)).join(', ');
    if (pic) pic.querySelectorAll('source').forEach((s) => {
      const tipo = (s.getAttribute('type') || '').split('/')[1];
      if (tipo) s.srcset = set(tipo === 'jpeg' ? 'jpg' : tipo);
    });
    const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
    img.srcset = set('jpg');
    img.src = url(`img/fotos/${nombre}-${base}.jpg`);
    img.width = f.ancho; img.height = f.alto;
    if (pic) pic.dataset.foto = nombre;
    return true;
  }
  function urlFoto(nombre, lista, anchoNecesario, ext) {
    const f = lista && lista.find((x) => x.nombre === nombre);
    if (!f) return null;
    const w = f.anchos.find((a) => a >= anchoNecesario) || f.anchos[f.anchos.length - 1];
    return url(`img/fotos/${nombre}-${w}.${ext}`);
  }

  /* ================= montar ================= */
  function montar(el, op) {
    op = op || {};
    if (el.dataset.montado === '1') return { destruir() {} };
    const quieto = op.movimiento === false || op.densidad === 'sobria';
    const fecha = op.hora instanceof Date ? op.hora : horaDeLaUrl() || new Date();
    const fijo = !!(op.hora || horaDeLaUrl());
    const sol = elSol(fecha);
    const nombre = sol.foto, otra = OTRA[nombre] || 'noche';
    el.dataset.montado = '1';
    el.dataset.foto = nombre;
    el.dataset.fase = sol.fase;
    el.classList.add('pincel');
    el.classList.toggle('es-pintando', !quieto);      // (al volver a montar con el mando, limpio)
    delete el.dataset.pintado; delete el.dataset.gesto; delete el.dataset.otra;

    // la línea de la hora (el hueco lo deja la web en el texto de la portada)
    const seccion = el.closest('section') || document;
    const linea = seccion.querySelector('[data-luz-ahora]');
    let relojLinea = null;
    // (si la web ya la escribió en main.js, se queda la suya: un solo autor)
    if (linea && !linea.textContent.trim()) {
      linea.textContent = sol.texto;
      if (!fijo) relojLinea = setInterval(() => { linea.textContent = elSol(new Date()).texto; }, 60000);
    }

    // estructura: logo (el real), marco con la foto (el respaldo, movido dentro), lienzos y gesto
    let pic = el.querySelector('picture');
    let img = (pic && pic.querySelector('img')) || el.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.decoding = 'async';
    }
    if (!pic && img.parentElement && img.parentElement.tagName === 'PICTURE') pic = img.parentElement;
    const nodoFoto = pic || img;
    // la escena: una lámina (logo + marco, con su proporción) y la fila del botón, encajadas en `el`
    const escena = document.createElement('div');
    escena.className = 'pincel__escena';
    const lamina = document.createElement('div');
    lamina.className = 'pincel__lamina';
    escena.appendChild(lamina);
    el.appendChild(escena);
    const marco = document.createElement('div');
    marco.className = 'pincel__marco';
    lamina.appendChild(marco);
    marco.appendChild(nodoFoto);
    img.classList.add('pincel__foto');
    img.alt = ALT[nombre] || img.alt || '';
    img.style.objectPosition = (FOCO[nombre] || [0.5, 0.5]).map((v) => v * 100 + '%').join(' ');

    const logo = document.createElement('div');
    logo.className = 'pincel__logo';
    logo.innerHTML = '<picture><source type="image/webp" srcset="' + url('img/pincel/logo.webp') + '">'
      + '<img src="' + url('img/pincel/logo.png') + '" width="1058" height="462" alt="" decoding="async"></picture>';
    lamina.insertBefore(logo, marco);
    const logoImg = logo.querySelector('img');

    const lienzoMarco = document.createElement('canvas');
    lienzoMarco.className = 'pincel__lienzo';
    lienzoMarco.setAttribute('aria-hidden', 'true');
    marco.appendChild(lienzoMarco);

    const fila = document.createElement('div');
    fila.className = 'pincel__fila';
    const tactil = matchMedia('(pointer: coarse)').matches;
    fila.innerHTML = '<button type="button" class="pincel__otra" disabled>'
      + '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M4 19c3 .5 5-1 5.6-3.2l1-1.1 2.6 2.6-1.1 1C10 20.6 6.5 21 4 19Z" fill="currentColor"/><path d="m11.6 13.7 7.8-8.6a1.6 1.6 0 0 1 2.3 2.3l-8.6 7.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
      + '<span>' + (ROTULO[otra] || 'Verla a otra hora') + '</span></button>'
      + '<span class="pincel__pista">' + (tactil ? 'o desliza el dedo de lado sobre la foto' : 'o pinta sobre la foto arrastrando') + '</span>';
    escena.appendChild(fila);
    const boton = fila.querySelector('button');

    // estado y limpieza
    let vivo = true, visible = true, raf = 0;
    const limpiar = [];
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      if (visible) despertar();
    }, { rootMargin: '80px' }) : null;
    if (io) { io.observe(el); limpiar.push(() => io.disconnect()); }
    const alVisibilidad = () => { if (!document.hidden) despertar(); };
    document.addEventListener('visibilitychange', alVisibilidad);
    limpiar.push(() => document.removeEventListener('visibilitychange', alVisibilidad));

    // un solo bucle: lo que esté en marcha (pintado inicial, secado del gesto) se apunta aquí
    const tareas = new Set();
    let previo = 0;
    function bucle(ahora) {
      raf = 0;
      if (!vivo) return;
      if (!visible || document.hidden) { previo = 0; return; }   // se reanuda al volver
      let dt = previo ? ahora - previo : 16;
      previo = ahora;
      if (dt > 100) dt = 33;                                       // reloj que traga atascos
      tareas.forEach((f) => { if (f(dt) === false) tareas.delete(f); });
      if (tareas.size) raf = requestAnimationFrame(bucle); else previo = 0;
    }
    function despertar() { if (!raf && tareas.size && vivo) raf = requestAnimationFrame(bucle); }
    const tarea = (f) => { tareas.add(f); despertar(); };

    // medidas
    let anchoVista = innerWidth, altoVista = innerHeight;
    function caja(n) {
      const r = n.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    function prepararLienzo(cv, b) {
      const d = DPR();
      cv.width = Math.max(1, Math.round(b.w * d));
      cv.height = Math.max(1, Math.round(b.h * d));
      const ctx = cv.getContext('2d');
      ctx.setTransform(d, 0, 0, d, 0, 0);
      return ctx;
    }
    function patronCubre(ctx, imagen, b, foco) {
      const iw = imagen.naturalWidth || imagen.width, ih = imagen.naturalHeight || imagen.height;
      const s = Math.max(b.w / iw, b.h / ih);
      const ox = (b.w - iw * s) * foco[0], oy = (b.h - ih * s) * foco[1];
      const p = ctx.createPattern(imagen, 'no-repeat');
      if (p && p.setTransform) p.setTransform(new DOMMatrix([s, 0, 0, s, ox, oy]));
      return p;
    }
    let datosP = null, forma = null, formaClave = null;
    function formaMarco() {
      const clave = (getComputedStyle(escena).getPropertyValue('--pincel-marco') || 'ancho').trim() || 'ancho';
      if (formaClave === clave && forma) return forma;
      const M = datosP && datosP.marcos[clave];
      if (!M) return null;
      formaClave = clave;
      forma = { vb: M.vb, path: new Path2D(M.d) };
      return forma;
    }
    function recortar(ctx, b) {
      const f = formaMarco();
      if (!f) return;
      const d = DPR();
      ctx.setTransform(d * b.w / f.vb[0], 0, 0, d * b.h / f.vb[1], 0, 0);
      ctx.clip(f.path, 'evenodd');
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    /* ---------- el final: todo en el DOM (el logo real y la foto con su máscara CSS) ---------- */
    let acabado = false;
    function acabar() {
      if (acabado) return;
      acabado = true;
      el.classList.remove('es-pintando');
      el.dataset.fase = 'lista';
      el.dataset.pintado = '1';
      const lienzoLogo = el.querySelector('.pincel__lienzo-logo');
      const letras = el.querySelectorAll('.pincel__letras');
      const quitar = () => {
        if (lienzoLogo) lienzoLogo.remove();
        letras.forEach((n) => n.remove());
        if (!lienzoMarco.classList.contains('es-gesto')) {
          const c = lienzoMarco.getContext('2d');
          c.save();
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.clearRect(0, 0, lienzoMarco.width, lienzoMarco.height);
          c.restore();
        }
        lienzoMarco.classList.remove('es-visible');
      };
      if (quieto) quitar(); else setTimeout(quitar, 520);
      prepararGesto();
    }

    /* ---------- el pintado inicial ---------- */
    async function pintar() {
      const [d, lista] = await Promise.all([datos(), fotos()]);
      datosP = d;
      if (!vivo) return;
      if (nombre !== (nodoFoto.dataset && nodoFoto.dataset.foto) && lista) {
        ponerFoto(pic, img, nombre, lista);
      }
      el.dataset.foto = nombre;
      if (quieto || !d) { acabar(); return; }
      // se monta cuando la cortina EMPIEZA a barrer: el pincel arranca a media pasada, para que se vea
      const C = T.cortina;
      if (C && !C.fuera && document.documentElement.classList.contains('cortina-activa')) {
        await new Promise((r) => { C.alRetirarse(r); setTimeout(r, 850); });   // sin pelear con el barrido por la CPU
      }
      try {
        await Promise.race([listo(logoImg), new Promise((r) => setTimeout(r, 2500))]);
        if (!logoImg.naturalWidth) throw new Error('sin logo');
      } catch (e) { acabar(); return; }
      if (!vivo) return;
      const fotoLista = Promise.race([listo(img).then(() => img.decode ? img.decode().catch(() => {}) : 0), new Promise((r) => setTimeout(r, 4000))]);

      const BL = caja(logo), BM = caja(marco);
      if (BL.w < 10 || BM.w < 10) { acabar(); return; }
      // lienzo del logo (con margen para la brocha)
      const MARGEN = BL.w * 0.06;
      const bl = { w: BL.w + MARGEN * 2, h: BL.h + MARGEN * 2 };
      const lienzoLogo = document.createElement('canvas');
      lienzoLogo.className = 'pincel__lienzo-logo';
      lienzoLogo.setAttribute('aria-hidden', 'true');
      lienzoLogo.style.left = -MARGEN + 'px';
      lienzoLogo.style.top = -MARGEN + 'px';
      lienzoLogo.style.width = bl.w + 'px';
      lienzoLogo.style.height = bl.h + 'px';
      logo.appendChild(lienzoLogo);
      const cL = prepararLienzo(lienzoLogo, bl);
      const k = BL.w / d.logo.w;
      const enLienzo = ([x, y]) => [MARGEN + x * k, MARGEN + y * k];
      const patLogo = cL.createPattern(logoImg, 'no-repeat');
      patLogo.setTransform(new DOMMatrix([k, 0, 0, k, MARGEN, MARGEN]));

      // las letras del logo (no son brochazos): se descubren de izquierda a derecha
      d.logo.texto.forEach((bx, i) => {
        const div = document.createElement('div');
        div.className = 'pincel__letras';
        div.style.left = (bx[0] / d.logo.w * 100) + '%';
        div.style.top = (bx[1] / d.logo.h * 100) + '%';
        div.style.width = ((bx[2] - bx[0]) / d.logo.w * 100) + '%';
        div.style.height = ((bx[3] - bx[1]) / d.logo.h * 100) + '%';
        const ii = document.createElement('img');
        ii.src = logoImg.currentSrc || logoImg.src;
        ii.alt = '';
        ii.style.width = (d.logo.w / (bx[2] - bx[0]) * 100) + '%';
        ii.style.left = (-bx[0] / (bx[2] - bx[0]) * 100) + '%';
        ii.style.top = (-bx[1] / (bx[3] - bx[1]) * 100) + '%';
        div.appendChild(ii);
        div.dataset.i = i;
        logo.appendChild(div);
      });

      // el plan: cada trazo con su inicio y su duración (proporcional a su largo)
      const VEL = { muros: 1450, ventanas: 820, tejado: 1800, rio: 1750 };   // px del logo por segundo
      const PAUSA = { muros: 0, ventanas: 40, tejado: 60, rio: 40 };
      let t = 0, grupo = null;
      const plan = d.trazos.map((tr, i) => {
        if (tr.g !== grupo) { t += PAUSA[tr.g] || 0; grupo = tr.g; }
        const pts = tr.p.map(enLienzo);
        const cerdas = brocha(1637 + i * 31, tr.g === 'rio' ? 30 : tr.g === 'tejado' ? 28 : 20);
        const tz = trazo(pts, tr.w * k * 1.22, cerdas, { estilo: patLogo });
        const largoLogo = tz.L / k;
        const dur = Math.max(150, largoLogo / (VEL[tr.g] || 900) * 1000);
        const p = { tz, t0: t, dur, g: tr.g };
        t += dur * (tr.g === 'tejado' ? 0.5 : 0.66);      // se solapan: la mano no se para
        return p;
      });
      const rio = plan[plan.length - 1];
      const finLogo = rio.t0 + rio.dur;
      const iniLetras = plan.find((p) => p.g === 'tejado').t0 + 120;

      // el marco: la brocha azul sale del final del río y barre en zigzag; detrás, la foto
      const bm = { w: BM.w, h: BM.h };
      const cM = prepararLienzo(lienzoMarco, bm);
      cM.save();
      recortar(cM, bm);
      const fin = enLienzo(d.logo.finRio);   // en el lienzo del logo → al del marco
      const ini = [fin[0] - MARGEN + BL.x - BM.x, fin[1] - MARGEN + BL.y - BM.y];
      const B = d.bandas, W = bm.w, H = bm.h;
      const pasos = [ini, [0.1 * W, B[0] * H]];
      B.forEach((c, i) => {
        const ida = i % 2 === 0;
        if (i) pasos.push([(ida ? -0.04 : 1.04) * W, c * H]);
        pasos.push([(ida ? 1.04 : -0.04) * W, c * H]);
      });
      const anchoB = d.anchoBrocha * H * 1.2;
      const cerdasM = brocha(2008, 46);
      const RIO = ['#09A3DF', '#0B95CC', '#24AEE4', '#0A9AD6', '#4DBDE8'];
      const azulT = trazo(pasos, anchoB, cerdasM, { tonos: RIO, paso: 4 });
      let fotoT = null, patFoto = null;
      const INI_MARCO = rio.t0 + rio.dur * 0.72;
      const DUR_MARCO = 1200, RETRASO = 300;
      lienzoMarco.classList.add('es-visible');

      el.dataset.fase = 'pintando-logo';
      let reloj = 0, letrasLanzadas = false;
      await new Promise((resuelto) => {
        tarea((dt) => {
          if (!vivo) { resuelto(); return false; }
          reloj += dt;
          // 1. el logo
          for (const p of plan) {
            if (reloj < p.t0) break;
            const u = clamp((reloj - p.t0) / p.dur, 0, 1);
            p.tz.pintar(cL, cuadInOut(u) * p.tz.fin);
          }
          if (!letrasLanzadas && reloj >= iniLetras) {
            letrasLanzadas = true;
            el.querySelectorAll('.pincel__letras').forEach((n, i) => {
              n.animate([{ maskPosition: '100% 0', webkitMaskPosition: '100% 0' }, { maskPosition: '0% 0', webkitMaskPosition: '0% 0' }],
                { duration: i ? 700 : 1000, delay: i ? 520 : 0, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' });
            });
          }
          // 2. el marco
          if (reloj >= INI_MARCO) {
            if (el.dataset.fase !== 'pintando-marco') el.dataset.fase = 'pintando-marco';
            const u = clamp((reloj - INI_MARCO) / DUR_MARCO, 0, 1);
            azulT.pintar(cM, expoInOut(u) * azulT.fin);
            if (!fotoT && img.complete && img.naturalWidth) {
              patFoto = patronCubre(cM, img, bm, FOCO[nombre] || [0.5, 0.5]);
              fotoT = trazo(pasos, anchoB * 1.08, cerdasM, { estilo: patFoto, solido: true, paso: 4 });
            }
            if (fotoT) {
              const v = clamp((reloj - INI_MARCO - RETRASO) / DUR_MARCO, 0, 1);
              fotoT.pintar(cM, expoInOut(v) * fotoT.fin);
            }
          }
          const terminado = reloj >= Math.max(finLogo, INI_MARCO + DUR_MARCO + RETRASO) + 60;
          if (terminado && (fotoT || reloj > INI_MARCO + DUR_MARCO + 4000)) { resuelto(); return false; }
          return true;
        });
      });
      cM.restore();
      if (!fotoT) await fotoLista;
      acabar();
    }

    /* ---------- el gesto: pintar otra hora ---------- */
    let gesto = null;
    async function prepararGesto() {
      if (gesto || !vivo) return;
      gesto = {};
      const lista = await fotos();
      if (!datosP) datosP = await datos();
      const bm0 = caja(marco);
      const ext = formatoDe(img);
      const src = urlFoto(otra, lista, bm0.w * DPR(), ext === 'jpg' ? 'jpg' : ext);
      if (!src || !datosP || !vivo) return;
      let otraImg;
      try { otraImg = await cargar(src); } catch (e) {
        try { otraImg = await cargar(src.replace(/\.(avif|webp)$/, '.jpg')); } catch (er) { return; }
      }
      if (!vivo) return;
      let bm = caja(marco), cG = null, pat = null;
      function rehacer() {
        bm = caja(marco);
        forma = null;
        const c = prepararLienzo(lienzoMarco, bm);
        c.save();
        recortar(c, bm);
        pat = patronCubre(c, otraImg, bm, FOCO[otra] || [0.5, 0.5]);
        cG = c;
      }
      rehacer();
      lienzoMarco.classList.add('es-gesto');
      el.dataset.otra = otra;
      boton.disabled = false;
      const cerdasG = brocha(42, 26);
      let pintado = 0;           // ms desde la última pincelada
      let tinta = 0;             // cuánto queda por secar (0 = nada pintado)
      let secando = false;
      function secar() {
        if (secando) return;
        secando = true;
        tarea((dt) => {
          if (!vivo) return false;
          pintado += dt;
          if (pintado < 1300) return true;
          // se seca: unos 2,7 s de fundido después de 1,3 s quieta
          const a = quieto ? 1 : 1 - Math.exp(-dt / 900);
          cG.save();
          cG.setTransform(1, 0, 0, 1, 0, 0);
          cG.globalCompositeOperation = 'destination-out';
          cG.globalAlpha = Math.min(1, a * 1.15);
          cG.fillRect(0, 0, lienzoMarco.width, lienzoMarco.height);
          cG.restore();
          tinta -= dt;
          if (tinta <= 0 || quieto) {
            // borrado final SIN el recorte (con él, el antialias del borde deja píxeles a medias)
            cG.restore();
            cG.save(); cG.setTransform(1, 0, 0, 1, 0, 0); cG.clearRect(0, 0, lienzoMarco.width, lienzoMarco.height); cG.restore();
            cG.save();
            recortar(cG, bm);
            el.dataset.gesto = 'seco';
            secando = false;
            return false;
          }
          return true;
        });
      }
      // un trazo a mano: cerdas con presión según la velocidad (deprisa → fino y seco)
      let ultimo = null, ancho = 0;
      const base = () => Math.max(26, Math.min(bm.w, bm.h) * 0.16);
      function pincelada(x, y, dtMov) {
        if (!ultimo) { ultimo = { x, y, nx: 0, ny: 1, s: 0 }; ancho = base() * 0.7; return; }
        const dx = x - ultimo.x, dy = y - ultimo.y, l = Math.hypot(dx, dy);
        if (l < 1.5) return;
        const v = l / Math.max(8, dtMov) * 1000;                 // px/s
        const meta = base() * clamp(1.2 - v / 2600, 0.42, 1.15);
        ancho += (meta - ancho) * 0.35;
        const nx = -dy / l, ny = dx / l;
        const s1 = ultimo.s + l;
        cG.lineJoin = 'round';
        cG.strokeStyle = pat;
        for (const b of cerdasG) {
          let a = b.carga;
          if (b.seco) {
            const nn = Math.sin(s1 * b.f1 + b.fase) + 0.6 * Math.sin(s1 * b.f2 + b.fase * 1.7);
            a *= clamp(((nn + 1.6) / 3.2 - b.seco * 0.7) * 3.2, 0, 1) * clamp(1.3 - v / 3200, 0.3, 1);
          }
          if (a < 0.03) continue;
          cG.globalAlpha = a;
          cG.lineWidth = Math.max(0.8, ancho / cerdasG.length * b.g * 1.9);
          cG.lineCap = a > 0.97 ? 'round' : 'butt';
          cG.beginPath();
          cG.moveTo(ultimo.x + ultimo.nx * b.o * ancho, ultimo.y + ultimo.ny * b.o * ancho);
          cG.lineTo(x + nx * b.o * ancho, y + ny * b.o * ancho);
          cG.stroke();
        }
        cG.globalAlpha = 1;
        ultimo = { x, y, nx, ny, s: s1 };
        pintado = 0;
        tinta = 2700;
        el.dataset.gesto = 'pintado';
        secar();
      }
      let activo = null, tPrev = 0;
      const local = (e) => { const r = lienzoMarco.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      function abajo(e) {
        if (e.button > 0) return;
        activo = e.pointerId;
        ultimo = null;
        tPrev = e.timeStamp;
        const [x, y] = local(e);
        pincelada(x, y, 16);
        if (e.pointerType === 'mouse') { try { lienzoMarco.setPointerCapture(e.pointerId); } catch (er) {} }
      }
      function mueve(e) {
        if (activo !== e.pointerId) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of (evs.length ? evs : [e])) {
          const [x, y] = local(ev);
          pincelada(x, y, ev.timeStamp - tPrev);
          tPrev = ev.timeStamp;
        }
      }
      function arriba(e) { if (activo === e.pointerId) { activo = null; ultimo = null; } }
      lienzoMarco.addEventListener('pointerdown', abajo);
      lienzoMarco.addEventListener('pointermove', mueve);
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => lienzoMarco.addEventListener(n, arriba));
      limpiar.push(() => {
        lienzoMarco.removeEventListener('pointerdown', abajo);
        lienzoMarco.removeEventListener('pointermove', mueve);
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => lienzoMarco.removeEventListener(n, arriba));
      });
      // el botón: una pasada automática con la misma brocha (o de golpe con movimiento reducido)
      function automatica() {
        const W = bm.w, H = bm.h;
        if (quieto) {
          cG.save(); cG.globalAlpha = 1; cG.fillStyle = pat; cG.fillRect(0, 0, W, H); cG.restore();
          pintado = 0; tinta = 1; el.dataset.gesto = 'pintado';
          setTimeout(() => { if (vivo) secar(); }, 2500);
          return;
        }
        const p = [[-0.05 * W, 0.2 * H], [1.05 * W, 0.16 * H], [1.05 * W, 0.5 * H], [-0.05 * W, 0.52 * H], [-0.05 * W, 0.84 * H], [1.05 * W, 0.86 * H]];
        const tz = trazo(p, H * 0.42, brocha(77, 40), { estilo: pat, solido: false, paso: 4 });
        const tz2 = trazo(p, H * 0.44, brocha(78, 40), { estilo: pat, solido: true, paso: 4 });
        let r = 0;
        el.dataset.gesto = 'pintando';
        tarea((dt) => {
          if (!vivo) return false;
          r += dt;
          const u = clamp(r / 1250, 0, 1), v = clamp((r - 220) / 1250, 0, 1);
          tz.pintar(cG, expoInOut(u) * tz.fin);
          tz2.pintar(cG, expoInOut(v) * tz2.fin);
          pintado = 0; tinta = 2700; el.dataset.gesto = 'pintado';
          if (v >= 1) { secar(); return false; }
          return true;
        });
      }
      boton.addEventListener('click', automatica);
      limpiar.push(() => boton.removeEventListener('click', automatica));
      // un cambio de tamaño de verdad (no la barra del móvil) rehace el lienzo del gesto
      gesto.rehacer = () => { cG.restore(); rehacer(); };
    }

    function alCambiar() {
      if (innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160) return;   // la barra del móvil: nada
      anchoVista = innerWidth; altoVista = innerHeight;
      if (!acabado) { tareas.clear(); acabar(); return; }
      if (gesto && gesto.rehacer) gesto.rehacer();
    }
    addEventListener('resize', alCambiar);
    limpiar.push(() => removeEventListener('resize', alCambiar));

    pintar().catch((er) => { console.warn('Pincel:', er); acabar(); });

    return {
      destruir() {
        vivo = false;
        if (raf) cancelAnimationFrame(raf);
        tareas.clear();
        if (relojLinea) clearInterval(relojLinea);
        limpiar.forEach((f) => { try { f(); } catch (e) {} });
        el.classList.remove('es-pintando');
      },
    };
  }

  T.pincel = { montar, brocha, trazo, sol: elSol, horaDeLaUrl };
})();
