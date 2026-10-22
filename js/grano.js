/* ------------------------------------------------------------------
   A Casa da Tulla · «La tulla» · el grano                     (agente Entrada)
   CORTINA «El grano» (partes/cortina.html)
     1. Granito oscuro y el canal de piedra que asoma por arriba.
     2. El grano baja por el canal, cae con gravedad y se posa formando
        «1637» de abajo arriba, como un montón que se llena (rebota un poco,
        alguno rueda por la ladera).
     3. «A Casa da Tulla» y «Gomesende · Ourense».
     4. Una pincelada (la brocha de cerdas de la portada) cruza en diagonal,
        se lleva el grano y destapa la portada: Tulla.cortina.abrir() salta
        cuando EMPIEZA el barrido; al acabar, Tulla.cortina.retirar().
     Todo va por reloj de pared: el barrido empieza como muy tarde a los 2,8 s
     y la cortina está fuera a los 3,8 s (desde que empezó a cargar la página).
     Los 10 primeros fotogramas miden el aparato: si va lento, menos grano en el
     aire; si va muy lento, «1637» ya posado y directo al barrido.
     Se salta si la página tardó más de 2 s; se retira SIEMPRE (finally, tope a
     los 3,8 s y la red de la parte). Canvas 2D, sin rAF cuando acaba.
   FERRADO del pie: Tulla.ferrado.montar(el, op) (o Tulla.grano.ferrado):
     un ferrado de madera dibujado a línea que se llena de grano con la
     lectura (de «Alrededor» al pie) y llega colmado al final.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const T = (window.Tulla = window.Tulla || {});
  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    try { return new URL('../', s || location.href).href; } catch (e) { return './'; }
  })();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const expoInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
  const salida = (t) => 1 - Math.pow(1 - t, 3);
  const DPR = () => Math.min(window.devicePixelRatio || 1, 1.5);
  function azar(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  /* ================= los granos: un atlas de sprites (ángulos × tonos) =================
     Centeno y trigo: grano alargado color paja con su surco, luz arriba y sombra abajo. */
  const TONOS = [
    ['#E9CD8E', '#D9B46A', '#A9853F'],   // trigo
    ['#F0D9A2', '#E0BF7A', '#B39049'],   // trigo claro
    ['#D2B27A', '#BE9A5C', '#86683A'],   // centeno
    ['#DDB873', '#C99F55', '#93713A'],   // paja oscura
  ];
  const ANGULOS = 16;
  function atlas(largo, dpr) {
    const ancho = largo * 0.5;
    const celda = Math.ceil((largo + 4) * dpr);
    const cv = lienzo(celda * ANGULOS, celda * TONOS.length);
    const c = cv.getContext('2d');
    for (let t = 0; t < TONOS.length; t++) {
      const [luz, base, oscuro] = TONOS[t];
      for (let a = 0; a < ANGULOS; a++) {
        c.save();
        c.translate(a * celda + celda / 2, t * celda + celda / 2);
        c.scale(dpr, dpr);
        // sombra
        c.save();
        c.translate(0.55, 0.9);
        c.rotate(a / ANGULOS * Math.PI);
        c.fillStyle = 'rgba(12,10,8,.55)';
        c.beginPath(); c.ellipse(0, 0, largo / 2, ancho / 2 + 0.35, 0, 0, Math.PI * 2); c.fill();
        c.restore();
        c.rotate(a / ANGULOS * Math.PI);
        const g = c.createLinearGradient(0, -ancho / 2, 0, ancho / 2);
        g.addColorStop(0, luz); g.addColorStop(0.45, base); g.addColorStop(1, oscuro);
        c.fillStyle = g;
        c.beginPath();
        // grano con punta: más estrecho por un extremo
        c.moveTo(-largo / 2, 0);
        c.bezierCurveTo(-largo / 2, -ancho * 0.62, largo * 0.32, -ancho * 0.58, largo / 2, -ancho * 0.05);
        c.bezierCurveTo(largo * 0.34, ancho * 0.6, -largo / 2, ancho * 0.6, -largo / 2, 0);
        c.fill();
        // el surco
        c.strokeStyle = 'rgba(110,80,35,.55)';
        c.lineWidth = Math.max(0.35, ancho * 0.12);
        c.beginPath(); c.moveTo(-largo * 0.34, ancho * 0.05); c.quadraticCurveTo(0, ancho * 0.16, largo * 0.36, 0); c.stroke();
        // brillo
        c.fillStyle = 'rgba(255,248,225,.5)';
        c.beginPath(); c.ellipse(-largo * 0.08, -ancho * 0.22, largo * 0.22, ancho * 0.1, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }
    return {
      cv, celda, dpr,
      // dibuja un grano en coordenadas CSS (el contexto ya escalado por dpr)
      pintar(ctx, x, y, ang, tono) {
        let a = Math.round(((ang % Math.PI) + Math.PI) % Math.PI / Math.PI * ANGULOS) % ANGULOS;
        const s = celda / dpr;
        ctx.drawImage(cv, a * celda, tono * celda, celda, celda, x - s / 2, y - s / 2, s, s);
      },
    };
  }

  /* ================= CORTINA ================= */
  function cortina() {
    const C = T.cortina;
    const el = document.getElementById('cortina');
    if (!C || !el || C.fuera) return;
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducido || performance.now() > 2000 || document.hidden) { C.retirar(); return; }
    const cv = el.querySelector('.cortina__lienzo');
    const ctx = cv && cv.getContext && cv.getContext('2d');
    if (!ctx) { C.retirar(); return; }
    C.enMarcha = true;

    const W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight;
    const movil = W < 760;
    const dpr = Math.min(DPR(), movil ? 1.25 : 1.5);   // pantalla entera: en el móvil, un poco menos
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rnd = azar(1637);
    const N = Math.round((movil ? 1700 : 3400) * ((navigator.hardwareConcurrency || 8) <= 4 ? 0.7 : 1));
    const capa = (w, h) => { const c = lienzo(w * dpr, h * dpr); const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x]; };
    const [fondo, cF] = capa(W, H);            // granito; luego también el canal, el grano posado y el texto
    const [texto, cT] = capa(W, H);
    const [capaCanal, cC] = capa(W, H);
    let granito = null;

    /* ---- el canal de piedra: baja desde el borde de arriba, en diagonal ---- */
    // (se coloca cuando se sabe dónde va el número)
    let canal = null;
    function pintarFondo() {
      cF.save();
      if (granito) {
        const p = cF.createPattern(granito, 'repeat');
        cF.fillStyle = p;
      } else cF.fillStyle = '#2E2B28';
      cF.fillRect(0, 0, W, H);
      // luz cálida que cae por el canal y viñeta
      let g = cF.createRadialGradient(W * 0.5, H * 0.38, 10, W * 0.5, H * 0.45, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(217,180,106,.10)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
      cF.fillStyle = g; cF.fillRect(0, 0, W, H);
      cF.restore();
    }
    function pintarCanal(c) {
      const { boca, dir, largo, ancho } = canal;
      const nx = -dir[1], ny = dir[0];
      const arriba = [boca[0] - dir[0] * largo, boca[1] - dir[1] * largo];
      const banda = (w) => [
        [arriba[0] + nx * w, arriba[1] + ny * w], [boca[0] + nx * w, boca[1] + ny * w],
        [boca[0] - nx * w, boca[1] - ny * w], [arriba[0] - nx * w, arriba[1] - ny * w],
      ];
      const poli = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
      // la piedra (con su sombra sobre el muro)
      c.save();
      c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 22; c.shadowOffsetY = 12; c.shadowOffsetX = 4;
      poli(banda(ancho * 0.95));
      c.fillStyle = granito ? c.createPattern(granito, 'repeat') : '#4A4540';
      c.fill();
      c.restore();
      poli(banda(ancho * 0.95));
      let g = c.createLinearGradient(boca[0] + nx * ancho, boca[1] + ny * ancho, boca[0] - nx * ancho, boca[1] - ny * ancho);
      g.addColorStop(0, 'rgba(245,232,210,.30)'); g.addColorStop(0.5, 'rgba(160,150,135,.10)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
      c.fillStyle = g; c.fill();
      // la canaleta tallada (más oscura, con sombra dentro)
      poli(banda(ancho * 0.52));
      g = c.createLinearGradient(boca[0] + nx * ancho * 0.52, boca[1] + ny * ancho * 0.52, boca[0] - nx * ancho * 0.52, boca[1] - ny * ancho * 0.52);
      g.addColorStop(0, 'rgba(8,7,6,.82)'); g.addColorStop(0.45, 'rgba(30,27,24,.6)'); g.addColorStop(1, 'rgba(70,64,58,.45)');
      c.fillStyle = g; c.fill();
      // filos de luz de los bordes tallados
      c.lineWidth = 1.2;
      [[0.95, 'rgba(255,246,230,.38)'], [0.52, 'rgba(255,246,230,.22)'], [-0.52, 'rgba(0,0,0,.45)'], [-0.95, 'rgba(0,0,0,.5)']].forEach(([w, col]) => {
        c.strokeStyle = col;
        c.beginPath(); c.moveTo(arriba[0] + nx * ancho * w, arriba[1] + ny * ancho * w); c.lineTo(boca[0] + nx * ancho * w, boca[1] + ny * ancho * w); c.stroke();
      });
      // la cara de la boca, cortada a escuadra, y su labio
      c.beginPath();
      c.moveTo(boca[0] + nx * ancho * 0.95, boca[1] + ny * ancho * 0.95);
      c.lineTo(boca[0] - nx * ancho * 0.95, boca[1] - ny * ancho * 0.95);
      c.lineTo(boca[0] - nx * ancho * 0.95 + dir[0] * 7, boca[1] - ny * ancho * 0.95 + dir[1] * 7 + 3);
      c.lineTo(boca[0] + nx * ancho * 0.95 + dir[0] * 7, boca[1] + ny * ancho * 0.95 + dir[1] * 7 + 3);
      c.closePath();
      c.fillStyle = 'rgba(20,18,16,.7)'; c.fill();
      c.strokeStyle = 'rgba(255,246,230,.3)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(boca[0] + nx * ancho * 0.95, boca[1] + ny * ancho * 0.95); c.lineTo(boca[0] - nx * ancho * 0.95, boca[1] - ny * ancho * 0.95); c.stroke();
    }

    /* ---- el «1637»: los objetivos de los granos, del raster del número ---- */
    function letra(fam, peso, px) { return `${peso} ${px}px ${fam}`; }
    const FELL = '"IM Fell English", "IM FELL English", Georgia, "Times New Roman", serif';
    const MONO = '"Spline Sans Mono", ui-monospace, Menlo, Consolas, monospace';
    function objetivos() {
      const R = lienzo(W, H), c = R.getContext('2d', { willReadFrequently: true });
      let fs = 200;
      c.font = letra(FELL, 400, fs);
      const ancho = c.measureText('1637').width || fs * 2;
      const meta = movil ? W * 0.84 : Math.min(W * 0.6, H * 1.05);
      fs = fs * meta / ancho;
      c.font = letra(FELL, 400, fs);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#fff';
      const base = movil ? H * 0.53 : H * 0.6;
      c.fillText('1637', W / 2, base);
      // solo la franja del número (leer la pantalla entera es una tarea larga en un móvil lento)
      const yA = Math.max(0, Math.floor(base - fs * 1.05)), yZ = Math.min(H, Math.ceil(base + fs * 0.5));
      const banda = c.getImageData(0, yA, W, yZ - yA).data;
      const alfa = (x, y) => (y < yA || y >= yZ ? 0 : banda[((y - yA) * W + x) * 4 + 3]);
      let x0 = W, x1 = 0, y0 = H, y1 = 0, area = 0;
      for (let y = yA; y < yZ; y += 2) for (let x = 0; x < W; x += 2) {
        if (alfa(x, y) > 128) { area += 4; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      const paso = Math.sqrt(area / N);
      const pts = [];
      for (let y = y0; y <= y1; y += paso) for (let x = x0; x <= x1; x += paso) {
        const jx = x + (rnd() - 0.5) * paso * 0.9, jy = y + (rnd() - 0.5) * paso * 0.9;
        const ix = Math.round(jx), iy = Math.round(jy);
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
        if (alfa(ix, iy) > 110) pts.push([jx, jy]);
      }
      return { pts, paso, caja: [x0, y0, x1, y1], fs, base };
    }

    /* ---- el texto: «A Casa da Tulla» y la línea fina ---- */
    function pintarTexto(caja) {
      const nombreFs = movil ? clamp(W * 0.088, 26, 44) : clamp(W * 0.034, 30, 62);
      const y = caja[3] + (movil ? H * 0.1 : H * 0.115);
      cT.fillStyle = '#F3EEE4';
      cT.textAlign = 'center';
      cT.font = letra(FELL, 400, nombreFs);
      cT.fillText('A Casa da Tulla', W / 2, y);
      // la línea fina: letra a letra para poder espaciar sin depender de letterSpacing
      const lineaFs = movil ? 11 : 13;
      cT.font = letra(MONO, 400, lineaFs);
      const linea = 'GOMESENDE · OURENSE', esp = lineaFs * 0.32;
      const anchos = Array.from(linea).map((ch) => cT.measureText(ch).width + esp);
      const total = anchos.reduce((a, b) => a + b, 0) - esp;
      let x = W / 2 - total / 2;
      const y2 = y + nombreFs * 0.95;
      cT.textAlign = 'left';
      cT.fillStyle = 'rgba(217,180,106,.9)';
      Array.from(linea).forEach((ch, i) => { cT.fillText(ch, x, y2); x += anchos[i]; });
      // dos filetes a los lados
      cT.strokeStyle = 'rgba(217,180,106,.55)'; cT.lineWidth = 1;
      const l = movil ? 22 : 46;
      cT.beginPath(); cT.moveTo(W / 2 - total / 2 - 14 - l, y2 - lineaFs * 0.35); cT.lineTo(W / 2 - total / 2 - 14, y2 - lineaFs * 0.35);
      cT.moveTo(W / 2 + total / 2 + 14, y2 - lineaFs * 0.35); cT.lineTo(W / 2 + total / 2 + 14 + l, y2 - lineaFs * 0.35); cT.stroke();
    }

    /* ---- la animación: TODO por reloj de pared. Si un fotograma tarda, el grano llega igual a su hora
       (aquí no hay reloj que «trague atascos»: manda la hora de llegada). Topes duros desde que empezó
       a cargar la página: el barrido empieza como muy tarde a los 2,8 s y la cortina está fuera a los 3,8 s. ---- */
    const TOPE_BARRIDO = 2800, TOPE_FUERA = 3800;
    let raf = 0;
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const cuadro = () => new Promise((r) => requestAnimationFrame(r));

    async function correr() {
      // la baldosa de granito y las letras: como mucho 650 ms, y sin comerse el tiempo del grano
      const pGranito = new Promise((r) => { const i = new Image(); i.onload = () => { granito = i; r(); }; i.onerror = r; i.src = BASE + 'img/pincel/granito.webp'; });
      const pLetras = document.fonts && document.fonts.load ? Promise.all([document.fonts.load(letra(FELL, 400, 120), '1637 A Casa da Tulla'), document.fonts.load(letra(MONO, 400, 13), 'GOMESENDE')]) : Promise.resolve();
      await Promise.race([Promise.all([pGranito, pLetras]), espera(clamp(TOPE_BARRIDO - 1600 - performance.now(), 0, 650))]);
      const obj = objetivos();
      const [bx0, by0, bx1, by1] = obj.caja;
      // el canal: su boca encima del número, un poco a la derecha; entra por el borde de arriba
      const ang = (movil ? 62 : 38) * Math.PI / 180;           // inclinación respecto a la horizontal
      const dir = [-Math.cos(ang), Math.sin(ang)];               // baja hacia la izquierda
      const bocaY = clamp(by0 - (movil ? H * 0.12 : H * 0.15), H * 0.08, H * 0.3);
      const boca = [W / 2 + (movil ? W * 0.12 : W * 0.06), bocaY];
      const largo = (bocaY + 40) / dir[1];
      canal = { boca, dir, largo, ancho: clamp(H * 0.03, 14, 30) };
      pintarFondo();
      ctx.drawImage(fondo, 0, 0, W, H);          // el primer fotograma ya, antes de esconder el texto de respaldo
      el.classList.add('es-lienzo');
      await cuadro();                            // la preparación, repartida en tareas cortas
      pintarCanal(cC);                           // el canal asoma desde arriba en los primeros 380 ms
      pintarTexto(obj.caja);

      // cada grano: objetivo, salida por la boca, vuelo con gravedad, rebote o rodada
      const paso = obj.paso;
      const A = atlas(clamp(paso * 1.9, 4, 9), dpr);
      const g = H * 3.4;                                          // gravedad (px/s²)
      const vCanal = H * 0.9;
      const orden = obj.pts.map((p) => ({ p, k: -p[1] + (rnd() - 0.5) * paso * 10 })).sort((a, b) => a.k - b.k);
      const n = orden.length;
      const SOLTAR = 1380, tRebote = 130, tRodar = 260;
      const granos = orden.map(({ p }, i) => {
        const rueda = rnd() < 0.13;
        const lado = rnd() < 0.5 ? -1 : 1;
        const llega = rueda ? [p[0] + lado * paso * 4.5, p[1] - paso * 3] : p;
        const off = (rnd() - 0.5) * canal.ancho * 0.8;
        const x0 = boca[0] - dir[1] * off, y0 = boca[1] + dir[0] * off;
        const deslizar = (0.18 + rnd() * 0.5) * Math.min(largo, H * 0.32);
        const tC = deslizar / vCanal * 1000;
        const vy0 = dir[1] * vCanal;
        const caida = Math.max(4, llega[1] - y0);
        const tV = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * caida)) / g * 1000;
        const sale = 240 + SOLTAR * Math.pow(i / n, 0.82);
        return {
          sale, tC, tV, deslizar, x0, y0, llega, p, rueda, lado, fin: sale + tC + tV + (rueda ? tRodar : tRebote),
          vx: (llega[0] - x0) / (tV / 1000), vy0,
          ang: rnd() * Math.PI, giro: (rnd() - 0.5) * 18, tono: Math.floor(rnd() * TONOS.length),
          rebote: paso * (0.6 + rnd() * 1.4), hecho: false, sinVuelo: false,
        };
      });
      let finVuelo = 0;
      for (const q of granos) if (q.fin > finVuelo) finVuelo = q.fin;
      const INI_TEXTO = Math.min(1150, finVuelo * 0.55), NATURAL_BARRIDO = clamp(finVuelo + 60, 1900, 2600);

      // el barrido: dos pasadas diagonales enormes (ida y vuelta) con la brocha de la portada
      const diag = Math.hypot(W, H);
      const u = [W / diag, -H / diag];              // de abajo a la izquierda hacia arriba a la derecha
      const nn = [H / diag, W / diag];               // normal hacia abajo a la derecha
      const D = W * H / diag;                        // distancia de la diagonal a las esquinas
      const anchoB = D * 1.12, sep = D * 0.5;
      const c0 = [W / 2, H / 2];
      const ext = diag / 2 + anchoB * 0.6;
      const pto = (s, o) => [c0[0] + u[0] * s + nn[0] * o, c0[1] + u[1] * s + nn[1] * o];
      const camino = [pto(-ext, -sep), pto(ext, -sep), pto(ext + sep * 0.9, 0), pto(ext, sep), pto(-ext, sep)];
      const P = T.pincel;
      const pasada = P && P.brocha && P.trazo ? P.trazo(camino, anchoB, P.brocha(1637, 64), { estilo: '#000', paso: 6, presion: () => 1, solido: true }) : null;
      await cuadro();

      // el reparto del tiempo: si vamos tarde, el grano cae más deprisa; si no da tiempo, «1637» ya posado
      const a0 = performance.now();
      const k = Math.max(1, NATURAL_BARRIDO / Math.max(1, TOPE_BARRIDO - a0));
      let directo = k > 1.9;
      let iniB = directo ? Math.min(a0 + 420, TOPE_BARRIDO) : Math.min(a0 + NATURAL_BARRIDO / k, TOPE_BARRIDO);
      let canalFijo = false, textoFijo = false, abierto = false, inicioB = 0, durB = 1150, posados = 0;
      const volando = [];
      let cV = null;                                 // capa aparte para el grano que barre la brocha
      el.dataset.fase = 'grano';
      el.dataset.k = k.toFixed(2);

      const fijarCanal = () => { if (!canalFijo) { cF.drawImage(capaCanal, 0, 0, W, H); canalFijo = true; } };
      const fijarTexto = () => { if (!textoFijo) { cF.drawImage(texto, 0, 0, W, H); textoFijo = true; } };
      function posar(t, todos) {
        for (const q of granos) {
          if (q.hecho || (!todos && t < q.fin)) continue;
          q.hecho = true; posados++;
          A.pintar(cF, q.p[0], q.p[1], q.ang + q.giro * 0.02, q.tono);
        }
        el.dataset.posados = posados + '/' + n;
      }
      function posarTodos() { fijarCanal(); posar(0, true); }
      if (directo) posarTodos();
      // si va lento: dos de cada tres granos que faltan aparecen ya posados (sin vuelo que pintar)
      function aligerar(t) { let i = 0; for (const q of granos) if (!q.hecho && t < q.sale && (i++ % 3)) q.sinVuelo = true; }
      function dibujarVuelo(q, t) {
        let x, y, ang = q.ang;
        let r = t - q.sale;
        if (r < q.tC) {                               // baja por el canal
          const s = q.deslizar * (1 - r / q.tC);
          x = q.x0 - canal.dir[0] * s; y = q.y0 - canal.dir[1] * s;
          ang = Math.atan2(canal.dir[1], canal.dir[0]) + (q.ang - 1.5) * 0.25;
        } else if ((r -= q.tC) < q.tV) {              // cae
          const s = r / 1000;
          x = q.x0 + q.vx * s; y = q.y0 + q.vy0 * s + 0.5 * g * s * s;
          ang = q.ang + q.giro * s;
        } else {
          r -= q.tV;
          ang = q.ang + q.giro * q.tV / 1000;
          if (q.rueda) {                              // rueda por la ladera hasta su sitio
            const kk = salida(clamp(r / tRodar, 0, 1));
            x = q.llega[0] + (q.p[0] - q.llega[0]) * kk; y = q.llega[1] + (q.p[1] - q.llega[1]) * kk;
            ang += q.lado * kk * 2.4;
          } else {                                    // un rebote corto
            const kk = clamp(r / tRebote, 0, 1);
            x = q.p[0]; y = q.p[1] - Math.sin(Math.PI * kk) * q.rebote * (1 - kk * 0.5);
          }
        }
        A.pintar(ctx, x, y, ang, q.tono);
      }
      function componer(t, ahora) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(fondo, 0, 0, W, H);           // granito + canal + grano posado + texto ya fijo: un solo volcado
        if (!canalFijo) {
          const kk = salida(clamp(t / 380, 0, 1)), d = (1 - kk) * largo * 0.55;
          ctx.drawImage(capaCanal, -canal.dir[0] * d, -canal.dir[1] * d, W, H);
          if (kk >= 1) fijarCanal();
        }
        for (const q of granos) if (!q.hecho && !q.sinVuelo && t >= q.sale) dibujarVuelo(q, t);
        if (!textoFijo) {
          const a = directo ? clamp((ahora - a0) / 320, 0, 1) : clamp((t - INI_TEXTO) / 650, 0, 1);
          if (a >= 1) { fijarTexto(); ctx.drawImage(texto, 0, 0, W, H); }
          else if (a > 0) {
            ctx.globalAlpha = salida(a);
            ctx.drawImage(texto, 0, (1 - salida(a)) * 10, W, H);
            ctx.globalAlpha = 1;
          }
        }
      }
      function abrir(ahora) {
        abierto = true;
        posarTodos(); fijarTexto();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.drawImage(fondo, 0, 0, W, H);           // desde aquí la brocha borra sobre el lienzo, sin volver a componer
        inicioB = ahora;
        durB = clamp(TOPE_FUERA - 140 - ahora, 450, 1150);
        if (pasada && el.dataset.lento !== '2') {
          const vol = document.createElement('canvas');
          vol.className = 'cortina__lienzo cortina__volando';
          vol.width = cv.width; vol.height = cv.height;
          el.appendChild(vol);
          cV = vol.getContext('2d');
          cV.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        el.classList.add('es-abriendo');
        el.dataset.fase = 'barrido';
        C.abrir();
      }
      function barrer(b, dt) {
        const cabeza = expoInOut(b);
        ctx.globalCompositeOperation = 'destination-out';
        if (pasada) pasada.pintar(ctx, cabeza * pasada.fin);
        else {                                        // sin la brocha de la portada: una pasada lisa
          ctx.save(); ctx.fillStyle = '#000'; ctx.translate(c0[0], c0[1]); ctx.rotate(Math.atan2(u[1], u[0]));
          ctx.fillRect(-ext, -D * 1.2, (2 * ext) * cabeza, D * 2.4); ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
        if (!cV) return;
        // la brocha se lleva grano: unos cuantos salen volando delante de la cabeza
        if (b > 0.04 && b < 0.96 && volando.length < 220) {
          const m = pasada.m, s = cabeza * pasada.fin;
          let i = 0;
          while (i < m.n - 1 && m.S[i + 1] < s) i++;
          const dx = m.X[Math.min(m.n - 1, i + 2)] - m.X[Math.max(0, i - 2)], dy = m.Y[Math.min(m.n - 1, i + 2)] - m.Y[Math.max(0, i - 2)];
          const l = Math.hypot(dx, dy) || 1;
          for (let kk = 0; kk < 8; kk++) {
            const o = (rnd() - 0.5) * anchoB * 0.9;
            const x = m.X[i] + m.NX[i] * o, y = m.Y[i] + m.NY[i] * o;
            if (x < bx0 - 10 || x > bx1 + 10 || y < by0 - 10 || y > by1 + 10) continue;
            const v = 900 + rnd() * 900;
            volando.push({ x, y, vx: dx / l * v + (rnd() - 0.5) * 300, vy: dy / l * v + (rnd() - 0.5) * 300, ang: rnd() * 3, giro: (rnd() - 0.5) * 30, tono: Math.floor(rnd() * TONOS.length), vida: 0 });
          }
        }
        cV.clearRect(0, 0, W, H);
        const s = Math.min(dt, 50) / 1000;
        for (let i = volando.length - 1; i >= 0; i--) {
          const v = volando[i];
          v.vida += dt;
          v.vy += g * 0.5 * s;
          v.x += v.vx * s; v.y += v.vy * s; v.ang += v.giro * s;
          const a = 1 - v.vida / 480;
          if (a <= 0) { volando.splice(i, 1); continue; }
          cV.globalAlpha = a;
          A.pintar(cV, v.x, v.y, v.ang, v.tono);
        }
        cV.globalAlpha = 1;
      }

      // el bucle: los primeros fotogramas miden el aparato
      const tiempos = [];
      let previo = performance.now();
      await new Promise((res) => {
        const paso = (ahora) => {
          if (C.fuera) { res(); return; }
          const dt = Math.max(0, ahora - previo);
          previo = ahora;
          const t = (ahora - a0) * k;                 // tiempo de la física (por reloj)
          if (!abierto && !directo && tiempos.length < 11) {
            tiempos.push(dt);
            if (tiempos.length === 11) {
              const media = tiempos.slice(1).reduce((a, b) => a + b, 0) / 10;   // el primero lleva la preparación
              el.dataset.media = media.toFixed(1);
              if (media > 55) {                       // muy lento: «1637» ya posado y al barrido
                el.dataset.lento = '2';
                directo = true; posarTodos();
                iniB = Math.min(iniB, ahora + 300);
              } else if (media > 30) {                // lento: menos grano en el aire
                el.dataset.lento = '1';
                aligerar(t);
              }
            }
          }
          if (!abierto) {
            posar(t, false);
            if (ahora >= iniB) abrir(ahora); else componer(t, ahora);
          }
          if (abierto) {
            const b = clamp((ahora - inicioB) / durB, 0, 1);
            barrer(b, dt);
            if (b >= 1 && (volando.length === 0 || ahora > TOPE_FUERA - 60)) { res(); return; }
          }
          raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
      });
    }

    // para las pruebas: cuándo se abrió y cuándo se retiró
    const marcas = (T.cortina.marcas = T.cortina.marcas || {});
    marcas.inicio = performance.now();
    T.cortina.alAbrirse(() => { marcas.abre = performance.now(); });
    T.cortina.alRetirarse(() => { if (!marcas.fuera) marcas.fuera = performance.now(); });
    // tope duro: fuera a los 3,8 s pase lo que pase (aunque un fotograma se atasque, el temporizador llega)
    const tope = setTimeout(() => { marcas.tope = true; C.retirar(); }, Math.max(0, TOPE_FUERA - performance.now()));
    correr()
      .catch((er) => console.warn('Cortina:', er))
      .finally(() => { if (raf) cancelAnimationFrame(raf); clearTimeout(tope); C.retirar(); });
  }

  /* ================= FERRADO del pie ================= */
  const NS = 'http://www.w3.org/2000/svg';
  // geometría (viewBox 260 × 230): caja troncocónica de duelas con dos aros, más ancha arriba
  const F = { cx: 130, yA: 74, rxA: 94, ryA: 17, yB: 200, rxB: 76, ryB: 14, colmo: 40 };
  function ferradoSVG() {
    const { cx, yA, rxA, ryA, yB, rxB, ryB } = F;
    const lerp = (a, b, t) => a + (b - a) * t;
    const aro = (t, d) => {
      const y = lerp(yA, yB, t), rx = lerp(rxA, rxB, t), ry = lerp(ryA, ryB, t);
      return `<path class="ferrado__aro" d="M${cx - rx} ${y + d} A${rx} ${ry} 0 0 0 ${cx + rx} ${y + d}"/>`;
    };
    let duelas = '';
    for (let k = 1; k < 9; k++) {
      const a = Math.PI * (k / 9);
      const xa = cx - Math.cos(a) * rxA, xb = cx - Math.cos(a) * rxB;
      const ya = yA + Math.sin(a) * ryA, yb = yB + Math.sin(a) * ryB;
      duelas += `<path class="ferrado__duela" d="M${xa.toFixed(1)} ${ya.toFixed(1)} L${xb.toFixed(1)} ${yb.toFixed(1)}"/>`;
    }
    return `<svg class="ferrado__dibujo" viewBox="0 0 260 230" aria-hidden="true" focusable="false">
      <path class="ferrado__boca-dentro" d="M${cx - rxA} ${yA} A${rxA} ${ryA} 0 0 1 ${cx + rxA} ${yA}"/>
      ${duelas}
      <path class="ferrado__lado" d="M${cx - rxA} ${yA} L${cx - rxB} ${yB} A${rxB} ${ryB} 0 0 0 ${cx + rxB} ${yB} L${cx + rxA} ${yA}"/>
      ${aro(0.2, 0)}${aro(0.2, 5)}${aro(0.8, 0)}${aro(0.8, 5)}
      <path class="ferrado__boca" d="M${cx - rxA} ${yA} A${rxA} ${ryA} 0 0 0 ${cx + rxA} ${yA}"/>
      <path class="ferrado__canto" d="M${cx - rxA + 6} ${yA} A${rxA - 6} ${ryA - 4} 0 0 0 ${cx + rxA - 6} ${yA}"/>
    </svg>`;
  }
  // ¿está (x, y) dentro del ferrado o del colmo? (en coordenadas del viewBox)
  function dentro(x, y, colmo) {
    const { cx, yA, rxA, ryA, yB, rxB, ryB } = F;
    if (y > yB + ryB * 0.75) return false;
    if (y >= yA) {
      const t = (y - yA) / (yB - yA);
      const rx = rxA + (rxB - rxA) * t - 3;
      if (Math.abs(x - cx) > rx) return false;
      if (y > yB) { const e = (x - cx) / rxB; return y - yB < ryB * Math.sqrt(Math.max(0, 1 - e * e)) * 0.75; }
      return true;
    }
    // por encima de la boca: el colmo (una cúpula baja, con su elipse de la boca)
    const e = (x - cx) / (rxA - 4);
    if (Math.abs(e) >= 1) return false;
    const bajo = yA - ryA * Math.sqrt(1 - e * e) * 0.9;           // borde de atrás de la boca
    const alto = yA - colmo * Math.pow(1 - e * e, 0.9);
    return y >= Math.min(bajo, alto);
  }
  function ferrado(el, op) {
    op = op || {};
    if (el.dataset.montado === '1') return { destruir() {} };
    const quieto = op.movimiento === false || op.densidad === 'sobria';
    el.dataset.montado = '1';
    el.classList.add('ferrado');
    // solo el dibujo: el rótulo («un ferrado, colmado») lo pone la web al lado
    el.innerHTML = '<div class="ferrado__lienzo-caja"><canvas class="ferrado__grano" aria-hidden="true"></canvas>' + ferradoSVG() + '</div>';
    const cv = el.querySelector('canvas');
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) { el.dataset.lleno = '100'; el.classList.add('es-colmado'); return { destruir() {} }; }
    const caja = el.querySelector('.ferrado__lienzo-caja');
    let dpr = DPR(), escala = 1, A = null;
    // los granos: dentro del ferrado y del colmo, de abajo arriba
    const rnd = azar(2008);
    const pts = [];
    const PASO = 4.3;
    for (let y = F.yB + F.ryB; y > F.yA - F.colmo - 2; y -= PASO * 0.86) {
      for (let x = F.cx - F.rxA; x <= F.cx + F.rxA; x += PASO) {
        const jx = x + (rnd() - 0.5) * PASO, jy = y + (rnd() - 0.5) * PASO * 0.8;
        if (dentro(jx, jy, F.colmo)) pts.push({ x: jx, y: jy, ang: rnd() * Math.PI, tono: Math.floor(rnd() * TONOS.length), k: 0 });
      }
    }
    pts.forEach((p) => { p.k = -p.y + (rnd() - 0.5) * 6; });
    pts.sort((a, b) => a.k - b.k);
    const N = pts.length;
    let posados = 0;              // cuántos están ya en su sitio
    const cayendo = [];
    function medir() {
      const r = caja.getBoundingClientRect();
      dpr = DPR();
      escala = r.width / 260;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * 230 / 260 * dpr);
      ctx.setTransform(dpr * escala, 0, 0, dpr * escala, 0, 0);
      A = atlas(5.2, dpr * escala);
      redibujar();
    }
    function redibujar() {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
      for (let i = 0; i < posados; i++) A.pintar(ctx, pts[i].x, pts[i].y, pts[i].ang, pts[i].tono);
    }
    let meta = 0, visible = false, raf = 0, vivo = true, previo = 0;
    const desde = () => document.querySelector(op.desde || '#alrededor');
    function progreso() {
      if (quieto) return 1;
      const doc = document.documentElement;
      const total = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
      const fin = total - innerHeight;
      const d = desde();
      const ini = d ? Math.max(0, d.getBoundingClientRect().top + scrollY - innerHeight) : fin * 0.5;
      if (fin <= ini) return scrollY >= fin - 2 ? 1 : 0;
      return clamp((scrollY - ini) / (fin - ini), 0, 1);
    }
    function actualizar() {
      const p = progreso();
      // en el último 1,5 % ya colmado (la barra del móvil deja a veces unos píxeles sin bajar)
      meta = Math.round(N * clamp(p / 0.985, 0, 1));
      el.dataset.lleno = String(Math.round(p * 100));
      el.classList.toggle('es-colmado', meta >= N);
      if (!A) return;
      if (!visible || quieto) {                     // fuera de pantalla: sin animar, solo el estado
        if (posados !== meta) { posados = meta; cayendo.length = 0; redibujar(); }
        return;
      }
      if (meta < posados) { posados = meta; cayendo.length = 0; redibujar(); return; }
      if (!raf) raf = requestAnimationFrame(bucle);
    }
    function bucle(ahora) {
      raf = 0;
      if (!vivo) return;
      let dt = previo ? ahora - previo : 16;
      previo = ahora;
      if (dt > 100) dt = 33;
      // lanzar los que faltan (como mucho unos pocos por fotograma: cae como un chorro)
      const lanzados = posados + cayendo.length;
      for (let i = lanzados; i < Math.min(meta, lanzados + 14); i++) cayendo.push({ i, t: 0 });
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
      for (let i = 0; i < posados; i++) A.pintar(ctx, pts[i].x, pts[i].y, pts[i].ang, pts[i].tono);
      for (let k = cayendo.length - 1; k >= 0; k--) {
        const c = cayendo[k];
        c.t += dt;
        const p = pts[c.i];
        const u = clamp(c.t / 420, 0, 1);
        const y0 = -10, yy = y0 + (p.y - y0) * u * u;
        const xx = F.cx + (p.x - F.cx) * Math.min(1, u * 1.4);
        A.pintar(ctx, xx, yy, p.ang + (1 - u) * 3, p.tono);
      }
      // los que llegan se posan (en orden, para no dejar huecos)
      while (cayendo.length && cayendo[0].t >= 420 && cayendo[0].i === posados) { cayendo.shift(); posados++; }
      cayendo.sort((a, b) => a.i - b.i);
      if (cayendo.length || posados < meta) raf = requestAnimationFrame(bucle);
      else previo = 0;
    }
    let pendiente = false;
    const alScroll = () => { if (pendiente) return; pendiente = true; requestAnimationFrame(() => { pendiente = false; actualizar(); }); };
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
      const antes = visible;
      visible = es[es.length - 1].isIntersecting;
      if (visible && !antes) {
        // al entrar en pantalla se dibuja quieto lo que ya toca; lo de después cae
        posados = Math.max(0, Math.min(meta, N) - 0);
        cayendo.length = 0;
        if (A) redibujar();
      }
      actualizar();
    }) : null;
    if (io) io.observe(el); else visible = true;
    let anchoVista = innerWidth;
    const alCambiar = () => { if (innerWidth === anchoVista) return; anchoVista = innerWidth; medir(); };
    if (!quieto) addEventListener('scroll', alScroll, { passive: true });
    addEventListener('resize', alCambiar);
    medir();
    actualizar();
    if (quieto) { posados = N; redibujar(); }
    return {
      destruir() {
        vivo = false;
        if (raf) cancelAnimationFrame(raf);
        if (io) io.disconnect();
        removeEventListener('scroll', alScroll);
        removeEventListener('resize', alCambiar);
      },
    };
  }

  T.grano = { montar: ferrado, ferrado, atlas };
  T.ferrado = { montar: ferrado };

  // la cortina arranca ya (el script va con defer: el DOM está)
  try { cortina(); } catch (er) { console.warn('Cortina:', er); if (T.cortina) T.cortina.retirar(); }
})();
