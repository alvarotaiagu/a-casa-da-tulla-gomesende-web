/* ------------------------------------------------------------------
   A Casa da Tulla · módulo «Cuatro árboles» (Árboles)

   Arriba, el corte de la casa (img/arboles/corte.svg, dibujo orientativo):
   se dibuja al entrar y cae grano por el canal de piedra. Debajo, los cuatro
   dormitorios, cada uno con su árbol en lámina botánica (img/arboles/*.svg,
   generadas por pruebas/arboles-dibujo.py) que CRECE CON EL SCROLL: raíces,
   tronco, ramas en orden, hojas que brotan, aguada de color y el fruto; al
   terminar, una línea de llamada sale del fruto y abre la foto del cuarto en
   un medallón («fig. 2»).

   Contrato: window.Tulla.arboles.montar(el, { movimiento, densidad, fotos? })
   → { destruir() }. El HTML de `el` es el respaldo (lo escribe la web): se
   oculta solo cuando el módulo ya está montado y vuelve con destruir() o si
   algo falla. Las fotos se toman del respaldo (su <picture>) por nombre
   (hab-castineiro…); si no están, de img/fotos/fotos.json.

   Trazos: pathLength=1 + stroke-dashoffset escrito a mano en cada fotograma
   (sin GSAP; si algún día se pasa a GSAP: autoRound:false, checklist punto 8).
   Fijado con CSS sticky (sin pin-spacer); en móvil o si un ancestro rompe el
   sticky, crece al pasar por la pantalla, sin fijar. Sin requestAnimationFrame
   cuando no se mueve nada. El resize de la barra del móvil no rehace nada.
   Con movimiento:false, movimiento reducido o densidad sobria: todo crecido,
   las fotos abiertas y sin fijar.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var guion = document.currentScript && document.currentScript.src;
  var base = function (ruta) {
    try { return guion ? new URL(ruta, guion).href : ruta.replace(/^\.\.\//, ''); } catch (e) { return ruta.replace(/^\.\.\//, ''); }
  };
  var NS = 'http://www.w3.org/2000/svg';

  /* SUPUESTO (a PENDIENTES.md): no consta cuál de las dos es la naranja y cuál
     la roja. Si los dueños dicen otra cosa, se cambia SOLO aquí. */
  var ASIGNACION = { nogueira: 'naranja', moreira: 'roja' };

  // Lo que se ve en las fotos y dicen las fichas (ref/DATOS-CASA-DA-TULLA.md, «Habitaciones»).
  var CUARTOS = {
    azul: {
      foto: 'hab-castineiro', color: '#2E4E9C', pared: 'Pared azul',
      alt: 'Dormitorio de pared azul y muro de granito, con cama de matrimonio de cabecero torneado y una puerta-ventana al balcón',
      desc: 'Una pared azul y otra de granito. Cama de matrimonio con el cabecero de madera torneada y una puerta-ventana al balcón, que da a la piscina.',
      datos: ['Cama de matrimonio', 'Balcón a la piscina', 'Baño propio']
    },
    rosa: {
      foto: 'hab-figueira', color: '#D69A8A', pared: 'Pared rosa',
      alt: 'Dormitorio de pared rosa y muro de granito, con armario de madera, cama de matrimonio y una puerta a la terraza',
      desc: 'Granito y una pared rosa, un armario de madera y cama de matrimonio, con puerta a una terraza.',
      datos: ['Cama de matrimonio', 'Terraza', 'Baño propio']
    },
    naranja: {
      foto: 'hab-naranja', color: '#D97A30', pared: 'Pared naranja',
      alt: 'Dormitorio de pared naranja con techo de vigas, cama de matrimonio de madera y una ventana que da al monte',
      desc: 'Pared naranja y techo de vigas. Cama de matrimonio de madera y una ventana con vistas al monte.',
      datos: ['Cama de matrimonio', 'Vistas al monte', 'Baño propio']
    },
    roja: {
      foto: 'hab-roja', color: '#A8322D', pared: 'Pared roja',
      alt: 'Dormitorio de pared roja con techo de vigas y dos camas individuales de cabecero tallado',
      desc: 'Pared roja y techo de vigas. Dos camas con el cabecero tallado, un tocador de madera y una ventana con contraventanas.',
      datos: ['Dos camas individuales', 'Ventana con contraventanas', 'Baño propio']
    }
  };
  var HABS = [
    { id: 'castineiro', nombre: 'Castiñeiro', arbol: 'el castaño', latin: 'Castanea sativa', lam: 'I', cuarto: 'azul' },
    { id: 'figueira', nombre: 'Figueira', arbol: 'la higuera', latin: 'Ficus carica', lam: 'II', cuarto: 'rosa' },
    { id: 'nogueira', nombre: 'Nogueira', arbol: 'el nogal', latin: 'Juglans regia', lam: 'III', cuarto: ASIGNACION.nogueira },
    { id: 'moreira', nombre: 'Moreira', arbol: 'el moral', latin: 'Morus nigra', lam: 'IV', cuarto: ASIGNACION.moreira }
  ];
  var CIFRAS = [['9', 'personas'], ['4', 'dormitorios dobles'], ['4', 'baños'], ['1', 'adaptado para movilidad reducida'], ['+', 'cuna']];

  // fases del progreso (0..1) de cada lámina, además de las que trae el SVG
  var LAVADO = [0.6, 0.9];
  var GUIA = [0.875, 0.93];
  var FOTO = [0.9, 0.985];
  var ARO = [0.925, 1];
  var CORTE_MS = 2600;

  var lim = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var tramo = function (v, a) { return lim((v - a[0]) / (a[1] - a[0])); };
  var vaiven = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var salir = function (t) { return 1 - Math.pow(1 - t, 3); };
  var brote = function (t) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  var escapar = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var cache = {};
  var pedir = function (url, tipo) {
    if (!cache[url]) {
      cache[url] = fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error(url + ' ' + r.status);
        return tipo === 'json' ? r.json() : r.text();
      });
      cache[url].catch(function () { delete cache[url]; });
    }
    return cache[url];
  };

  var stickyRoto = function (el) {
    // mientras la cortina tapa, <html> y <body> llevan overflow:hidden; es pasajero (al quitarse
    // la clase, el MutationObserver vuelve a mirar): no cuenta como roto
    if (document.documentElement.classList.contains('cortina-activa')) return false;
    var htmlVisible = getComputedStyle(document.documentElement).overflowY === 'visible';
    for (var n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (n === document.body && htmlVisible) continue;
      var cs = getComputedStyle(n);
      if (/(hidden|auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) return true;
    }
    return false;
  };

  // ---------- piezas animables de un SVG
  var leerPiezas = function (svg) {
    var els = svg.querySelectorAll('[data-t]');
    var out = [];
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      var m = e.getAttribute('data-m') || 'd';
      if (m === 'd') { e.setAttribute('pathLength', '1'); e.classList.add('arb-tr'); }
      var o = (e.getAttribute('data-o') || '0 0').split(' ');
      out.push({ el: e, t: +e.getAttribute('data-t'), d: +e.getAttribute('data-d') || 0.02, m: m, ox: +o[0], oy: +o[1], r: +(e.getAttribute('data-r') || 0), est: -1 });
    }
    return out;
  };
  var pintarPiezas = function (piezas, v) {
    for (var i = 0; i < piezas.length; i++) {
      var q = piezas[i];
      var lt = (v - q.t) / q.d;
      var est = lt <= 0 ? 0 : lt >= 1 ? 2 : 1;
      if (est === q.est && est !== 1) continue;
      q.est = est;
      var s = q.el.style;
      if (est !== 1) {
        s.opacity = est === 0 ? '0' : '';
        if (q.m === 'd') s.strokeDashoffset = est === 0 ? '1' : '0';
        else if (q.m === 'b') q.el.removeAttribute('transform');
        continue;
      }
      if (q.m === 'd') {
        s.opacity = '';
        s.strokeDashoffset = (1 - lt).toFixed(4);
      } else if (q.m === 'b') {
        var k = Math.max(0.001, brote(lt));
        q.el.setAttribute('transform', 'translate(' + q.ox + ' ' + q.oy + ') rotate(' + (q.r * (1 - salir(lt))).toFixed(2) + ') scale(' + k.toFixed(4) + ') translate(' + (-q.ox) + ' ' + (-q.oy) + ')');
        s.opacity = lim(lt * 3).toFixed(3);
      } else {
        s.opacity = lt.toFixed(3);
      }
    }
  };
  var limpiarSvg = function (texto) {
    return texto.replace(/^[\s\S]*?(<svg)/, '$1').replace(/<style>[\s\S]*?<\/style>/, '');
  };

  // ---------- fotos: del respaldo (por nombre) o de fotos.json
  var buscarFoto = function (respaldo, nombre) {
    var imgs = respaldo.querySelectorAll('img');
    var re = new RegExp('(^|/)' + nombre + '-\\d+\\.');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      var src = (im.getAttribute('src') || '') + ' ' + (im.getAttribute('srcset') || '') + ' ' + (im.getAttribute('data-foto') || '');
      if (re.test(src) || im.getAttribute('data-foto') === nombre) return im.closest('picture') || im;
    }
    return null;
  };
  var hacerFoto = function (nombre, alt, fotosJson, opc, respaldo) {
    var sizes = '(min-width: 900px) 380px, calc(100vw - 32px)';
    var dir = opc.base || base('../img/fotos/');
    if (opc.fotos && opc.fotos[nombre]) {
      var im0 = document.createElement('img');
      im0.src = opc.fotos[nombre];
      im0.alt = alt; im0.decoding = 'async'; im0.loading = 'lazy';
      return im0;
    }
    var del = buscarFoto(respaldo, nombre);
    if (del) {
      var cl = del.cloneNode(true);
      var im = cl.tagName === 'IMG' ? cl : cl.querySelector('img');
      if (im) { im.alt = alt; im.setAttribute('sizes', sizes); im.loading = 'lazy'; im.decoding = 'async'; im.removeAttribute('class'); im.removeAttribute('style'); }
      var srcs = cl.querySelectorAll ? cl.querySelectorAll('source') : [];
      for (var i = 0; i < srcs.length; i++) srcs[i].setAttribute('sizes', sizes);
      return cl;
    }
    var info = null;
    if (fotosJson && fotosJson.length) for (var j = 0; j < fotosJson.length; j++) if (fotosJson[j].nombre === nombre) info = fotosJson[j];
    var anchos = info ? info.anchos : [480];
    var set = function (ext) { return anchos.map(function (a) { return dir + nombre + '-' + a + '.' + ext + ' ' + a + 'w'; }).join(', '); };
    var pic = document.createElement('picture');
    if (info) {
      ['avif', 'webp'].forEach(function (ext) {
        var so = document.createElement('source');
        so.type = 'image/' + ext; so.srcset = set(ext); so.sizes = sizes;
        pic.appendChild(so);
      });
    }
    var img = document.createElement('img');
    img.src = dir + nombre + '-' + anchos[Math.min(1, anchos.length - 1)] + '.jpg';
    if (info) { img.srcset = set('jpg'); img.sizes = sizes; }
    img.alt = alt; img.loading = 'lazy'; img.decoding = 'async';
    pic.appendChild(img);
    return pic;
  };

  // ---------- montaje
  function montar(el, opciones) {
    var opc = opciones || {};
    if (!el || el.dataset.montado === '1') return { destruir: function () {} };
    var raiz = document.documentElement;
    var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
    var reduce = mqReduce.matches;
    var vivo = true;
    var limpiar = [];
    var nodo = null, respaldo = [];
    var habs = [];
    var corte = null;
    var modo = '';
    var raf = 0, ultimo = 0, enVista = false;
    var anchoVista = innerWidth, altoVista = innerHeight;

    // la web vuelve a montar el módulo al cambiar de densidad; la clase de <html> se sigue igualmente
    var quieto = function () {
      return opc.movimiento === false || reduce || opc.densidad === 'sobria' || raiz.classList.contains('densidad-sobria');
    };

    /* ---------- progreso de cada lámina */
    var objetivoDe = function (h) {
      var vh = altoVista;
      if (modo === 'fijo') {
        var r = h.art.getBoundingClientRect();
        if (h.cab == null) h.cab = parseFloat(getComputedStyle(h.escena).top) || 0; // top del sticky
        if (h.rec == null) h.rec = h.art.offsetHeight - h.escena.offsetHeight;
        var ini = vh * 0.55, fin = h.cab - h.rec * 0.9;
        return lim((ini - r.top) / (ini - fin));
      }
      var rl = h.lamina.getBoundingClientRect();
      var rm = h.med.getBoundingClientRect();
      var distMed = (rm.top + rm.height / 2) - rl.top;
      var ini2 = vh * 0.9, fin2 = vh * 0.62 - distMed;
      return lim((ini2 - rl.top) / (ini2 - fin2));
    };

    // solo se escribe lo que cambia (una variable en el <svg> recalcula todo su árbol)
    var poner = function (h, clave, valor, fn) { if (h.ult[clave] !== valor) { h.ult[clave] = valor; fn(valor); } };
    var pintarHab = function (h, v) {
      pintarPiezas(h.piezas, v);
      poner(h, 'lav', tramo(v, LAVADO).toFixed(3), function (x) { h.svg.style.setProperty('--lav', x); });
      var g = vaiven(tramo(v, GUIA));
      poner(h, 'guia', (1 - g).toFixed(4), function (x) {
        if (h.guiaPath) h.guiaPath.style.strokeDashoffset = x;
        if (h.guiaPunto) h.guiaPunto.style.opacity = g > 0 ? '1' : '0';
      });
      var a = vaiven(tramo(v, FOTO));
      poner(h, 'abre', a.toFixed(4), function (x) {
        h.med.style.setProperty('--abre', x);
        // cerrada no se enfoca ni se pulsa
        if (h.btn) h.btn.style.visibility = a > 0 ? '' : 'hidden';
        h.art.classList.toggle('es-abierta', a >= 0.999);
      });
      var ar = salir(tramo(v, ARO));
      poner(h, 'aro', (1 - ar).toFixed(4), function (x) { for (var i = 0; i < h.aros.length; i++) h.aros[i].style.strokeDashoffset = x; });
      h.art.dataset.progreso = v.toFixed(3);
    };

    var paso = function (ahora) {
      raf = 0;
      if (!vivo) return;
      var dt = Math.min(0.1, (ahora - (ultimo || ahora)) / 1000) || 1 / 60;
      ultimo = ahora;
      var sigue = false;
      for (var i = 0; i < habs.length; i++) {
        var h = habs[i];
        var dif = h.obj - h.p;
        if (dif === 0) continue;
        h.p = Math.abs(dif) < 0.0005 ? h.obj : h.p + dif * (1 - Math.exp(-dt / 0.11));
        pintarHab(h, h.p);
        if (h.p !== h.obj) sigue = true;
      }
      if (sigue) raf = requestAnimationFrame(paso); else ultimo = 0;
    };
    var alScroll = function () {
      if (modo === 'quieto' || !enVista) return;
      var mover = false;
      for (var i = 0; i < habs.length; i++) {
        var o = objetivoDe(habs[i]);
        if (o !== habs[i].obj) { habs[i].obj = o; mover = true; }
      }
      if (mover && !raf) { ultimo = 0; raf = requestAnimationFrame(paso); }
    };

    /* ---------- línea de llamada del fruto al medallón */
    var colocarGuias = function () {
      for (var i = 0; i < habs.length; i++) {
        var h = habs[i];
        if (!h.guia) continue;
        var visible = getComputedStyle(h.guia).display !== 'none';
        if (!visible) continue;
        var re = h.escena.getBoundingClientRect();
        var rs = h.svg.getBoundingClientRect();
        var rm = h.med.getBoundingClientRect();
        var derecha = rm.left > rs.left;
        var fr = (h.svg.getAttribute(derecha ? 'data-fruto-der' : 'data-fruto-izq') || '400 300').split(' ');
        var esc = Math.min(rs.width / 800, rs.height / 1000);
        var ox = rs.left + (rs.width - 800 * esc) / 2, oy = rs.top + (rs.height - 1000 * esc) / 2;
        var fx = ox + (+fr[0]) * esc - re.left, fy = oy + (+fr[1]) * esc - re.top;
        var tx = (derecha ? rm.left - 10 : rm.right + 10) - re.left;
        var ty = rm.top + rm.height / 2 - re.top;
        var dx = tx - fx;
        h.guia.setAttribute('viewBox', '0 0 ' + Math.round(re.width) + ' ' + Math.round(re.height));
        h.guiaPath.setAttribute('d', 'M' + fx.toFixed(1) + ' ' + fy.toFixed(1) + 'C' + (fx + dx * 0.45).toFixed(1) + ' ' + (fy - 18).toFixed(1) + ' ' + (tx - dx * 0.35).toFixed(1) + ' ' + ty.toFixed(1) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1));
        h.guiaPunto.setAttribute('cx', fx.toFixed(1));
        h.guiaPunto.setAttribute('cy', fy.toFixed(1));
      }
    };

    /* ---------- el corte: se dibuja por tiempo al entrar y cae el grano */
    var corteHecho = false;
    var pintarCorte = function (v) { if (corte) pintarPiezas(corte.piezas, v); };
    var montonA = function (k) {
      if (!corte || !corte.monton) return;
      var m = corte.m;
      if (k >= 1) { corte.monton.removeAttribute('transform'); corte.monton.style.opacity = ''; return; }
      corte.monton.style.opacity = k > 0 ? '' : '0';
      corte.monton.setAttribute('transform', 'translate(' + m[0] + ' ' + m[1] + ') scale(' + (0.5 + 0.5 * k).toFixed(3) + ' ' + Math.max(0.001, k).toFixed(3) + ') translate(' + (-m[0]) + ' ' + (-m[1]) + ')');
    };
    var animarCorte = function () {
      if (!corte || corteHecho) return;
      corteHecho = true;
      var t0 = performance.now();
      var svg = corte.svg;
      var c0 = corte.c0, c1 = corte.c1, m = corte.m;
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'cr-granos');
      svg.appendChild(g);
      var N = 80, granos = [], asentados = 0;
      var azar = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(1637);
      for (var i = 0; i < N; i++) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', (1.6 + azar() * 0.9).toFixed(2));
        c.setAttribute('class', 'cr-grano');
        c.style.opacity = '0';
        g.appendChild(c);
        granos.push({ el: c, t0: CORTE_MS * 0.82 / 1000 + i * 0.03 + azar() * 0.02, dx: (azar() - 0.5) * 3, vx: 10 + azar() * 22, hecho: false });
      }
      montonA(0);
      var fin = CORTE_MS / 1000 + 0.6 + N * 0.03 + 1.2;
      var cuadro = function (ahora) {
        if (!vivo || !corte) return;
        if (modo === 'quieto') { if (g.parentNode) g.parentNode.removeChild(g); pintarCorte(1); montonA(1); return; }
        var t = (ahora - t0) / 1000;
        pintarCorte(lim(t * 1000 / CORTE_MS));
        for (var i = 0; i < granos.length; i++) {
          var q = granos[i];
          if (q.hecho) continue;
          var lt = t - q.t0;
          if (lt < 0) continue;
          var x, y;
          if (lt < 0.32) {
            var f = lt / 0.32; f = f * f;
            x = c0[0] + (c1[0] - c0[0]) * f + q.dx;
            y = c0[1] + 8 + (c1[1] - c0[1]) * f;
          } else {
            var tt = lt - 0.32;
            x = c1[0] + 2 + q.vx * tt;
            y = c1[1] + 9 + 60 * tt + 0.5 * 900 * tt * tt;
            var alto = 46 * (asentados / N);
            if (y >= m[1] - alto * (1 - Math.min(1, Math.abs(x - m[0]) / 34))) {
              q.hecho = true; asentados++;
              q.el.style.opacity = '0';
              montonA(asentados / N);
              continue;
            }
          }
          q.el.setAttribute('cx', x.toFixed(1));
          q.el.setAttribute('cy', y.toFixed(1));
          q.el.style.opacity = '1';
        }
        if (t < fin && asentados < N) requestAnimationFrame(cuadro);
        else { montonA(1); pintarCorte(1); if (g.parentNode) g.parentNode.removeChild(g); }
      };
      requestAnimationFrame(cuadro);
    };

    /* ---------- modos */
    var ponerModo = function () {
      if (!nodo) return;
      var q = quieto();
      var nuevo = q ? 'quieto' : (innerWidth >= 900 && innerHeight >= 600 && !stickyRoto(nodo) ? 'fijo' : 'suelto');
      if (nuevo === modo) return;
      modo = nuevo;
      nodo.classList.toggle('arb--mov', nuevo !== 'quieto');
      nodo.classList.toggle('arb--quieto', nuevo === 'quieto');
      nodo.classList.toggle('arb--fijo', nuevo === 'fijo');
      nodo.classList.toggle('arb--suelto', nuevo === 'suelto');
      nodo.dataset.modo = nuevo;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      for (var i = 0; i < habs.length; i++) {
        var h = habs[i];
        h.cab = h.rec = null;
        h.ult = {};
        for (var j = 0; j < h.piezas.length; j++) h.piezas[j].est = -1;
        h.p = h.obj = nuevo === 'quieto' ? 1 : objetivoDe(h);
        pintarHab(h, h.p);
      }
      if (corte) {
        if (nuevo === 'quieto') { corteHecho = true; for (var k = 0; k < corte.piezas.length; k++) corte.piezas[k].est = -1; pintarCorte(1); montonA(1); }
        else if (!corteHecho) { pintarCorte(0); montonA(0); }
      }
      colocarGuias();
      if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) {} }
    };

    var alResize = function () {
      // la barra del móvil cambia el alto: no se rehace nada (checklist punto 10)
      if (innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160) return;
      anchoVista = innerWidth; altoVista = innerHeight;
      for (var i = 0; i < habs.length; i++) habs[i].cab = habs[i].rec = null;
      ponerModo();
      colocarGuias();
      alScroll();
    };

    /* ---------- construir */
    var construir = function (res) {
      if (!vivo) return;
      var textoCorte = res[0], fotosJson = res[1], textos = res.slice(2);
      var respaldoTmp = document.createElement('div');
      Array.prototype.forEach.call(el.children, function (n) { respaldoTmp.appendChild(n.cloneNode(true)); });

      nodo = document.createElement('div');
      nodo.className = 'arb';
      var h = '';
      h += '<div class="arb-cabeza"><ul class="arb-cifras" aria-label="La casa en cifras">';
      CIFRAS.forEach(function (c) {
        h += '<li>' + (c[0] === '+' ? '<b aria-hidden="true">+</b>' : '<b>' + c[0] + '</b>') + ' <span>' + c[1] + '</span></li>';
      });
      h += '</ul><a class="btn btn--marca arb-fechas" href="#reservar">Ver fechas</a></div>';
      if (textoCorte) {
        h += '<figure class="arb-corte"><div class="arb-corte-lienzo" role="img" aria-label="Dibujo orientativo de la casa en corte: abajo el salón comedor con chimenea, la escalera de madera y la cocina; arriba los cuatro dormitorios con baño y, en la entrada, el canal de piedra por donde se cargaba el grano; encima, el tejado con sus vigas de madera. No es el plano.">' + limpiarSvg(textoCorte) + '</div>';
        h += '<figcaption class="arb-corte-nota"><b>Dibujo orientativo, no es el plano.</b> Abajo, el salón comedor con chimenea y la cocina; arriba, los cuatro dormitorios, cada uno con su baño. Dónde está cada cuarto es una suposición. Cuentan las fichas de la casa que en la entrada de la segunda planta se conserva un canal de piedra por donde se cargaba el grano.</figcaption></figure>';
      }
      h += '<div class="arb-habs">';
      HABS.forEach(function (ha, i) {
        var cu = CUARTOS[ha.cuarto];
        h += '<article class="arb-hab" id="arb-' + ha.id + '" data-hab="' + ha.id + '" aria-labelledby="arb-t-' + ha.id + '">';
        h += '<div class="arb-escena">';
        h += '<figure class="arb-lamina" aria-hidden="true"><div class="arb-papel"><div class="arb-plancha">' + (textos[i] ? limpiarSvg(textos[i]) : '') + '</div>' +
          '<figcaption class="arb-pie"><span class="arb-pie-lam">Lám. ' + ha.lam + '</span><span class="arb-pie-nom"><i>' + escapar(ha.latin) + '</i> · ' + escapar(ha.nombre) + '</span></figcaption></div></figure>';
        h += '<div class="arb-texto">';
        h += '<figure class="arb-medallon"><button type="button" class="foto-btn arb-foto-btn" data-visor="' + cu.foto + '" aria-label="Ver más grande: ' + escapar(ha.nombre) + '"><span class="arb-foto"></span></button><svg class="arb-aro" viewBox="0 0 130 100" aria-hidden="true" focusable="false"><ellipse cx="65" cy="50" rx="64" ry="49" pathLength="1"/><ellipse class="arb-aro-fino" cx="65" cy="50" rx="61" ry="46" pathLength="1"/></svg>' +
          '<figcaption class="arb-med-pie">fig. 2 · el dormitorio</figcaption></figure>';
        h += '<p class="arb-num">Dormitorio · lámina ' + ha.lam + '</p>';
        h += '<h3 class="arb-nombre" id="arb-t-' + ha.id + '">' + escapar(ha.nombre) + '</h3>';
        h += '<p class="arb-arbol">' + escapar(ha.arbol) + ', en gallego</p>';
        h += '<p class="arb-desc">' + escapar(cu.desc) + '</p>';
        h += '<ul class="arb-datos"><li><i class="arb-muestra" style="--muestra:' + cu.color + '" aria-hidden="true"></i>' + escapar(cu.pared) + '</li>' +
          cu.datos.map(function (d) { return '<li>' + escapar(d) + '</li>'; }).join('') + '</ul>';
        h += '</div>';
        h += '<svg class="arb-guia" aria-hidden="true" focusable="false"><path pathLength="1"/><circle r="3.2"/></svg>';
        h += '</div></article>';
      });
      h += '</div>';
      nodo.innerHTML = h;

      // fotos
      var meds = nodo.querySelectorAll('.arb-foto');
      HABS.forEach(function (ha, i) {
        var cu = CUARTOS[ha.cuarto];
        meds[i].appendChild(hacerFoto(cu.foto, cu.alt, fotosJson, opc, respaldoTmp));
      });

      // piezas
      var arts = nodo.querySelectorAll('.arb-hab');
      for (var i = 0; i < arts.length; i++) {
        var art = arts[i];
        var svg = art.querySelector('.arb-plancha svg');
        if (!svg) throw new Error('lámina sin <svg>');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        habs.push({
          art: art, escena: art.querySelector('.arb-escena'), lamina: art.querySelector('.arb-lamina'), svg: svg,
          med: art.querySelector('.arb-medallon'), aros: art.querySelectorAll('.arb-aro ellipse'),
          guia: art.querySelector('.arb-guia'), guiaPath: art.querySelector('.arb-guia path'), guiaPunto: art.querySelector('.arb-guia circle'),
          btn: art.querySelector('.arb-foto-btn'), piezas: leerPiezas(svg), p: 0, obj: 0, ult: {}
        });
      }
      var svgCorte = nodo.querySelector('.arb-corte svg');
      if (svgCorte) {
        svgCorte.setAttribute('focusable', 'false');
        svgCorte.setAttribute('aria-hidden', 'true');
        var num = function (a) { return (svgCorte.getAttribute(a) || '0 0').split(' ').map(Number); };
        corte = { svg: svgCorte, piezas: leerPiezas(svgCorte), monton: svgCorte.querySelector('.cr-monton'), c0: num('data-canal-de'), c1: num('data-canal'), m: num('data-monton') };
        // el montón lo lleva el grano, no el tiempo
        corte.piezas = corte.piezas.filter(function (q) { return q.el !== corte.monton; });
      }

      // botón
      var boton = nodo.querySelector('.arb-fechas');
      var alBoton = function (ev) {
        var T = window.Tulla;
        if (T && typeof T.reservar === 'function') { ev.preventDefault(); T.reservar(); }
      };
      boton.addEventListener('click', alBoton);

      // respaldo fuera (se guarda para destruir)
      respaldo = Array.prototype.slice.call(el.children).map(function (n) { var hd = n.hidden; n.hidden = true; return { n: n, h: hd }; });
      el.appendChild(nodo);
      el.dataset.montado = '1';

      ponerModo();

      // observadores
      var io = new IntersectionObserver(function (ent) {
        ent.forEach(function (e) { enVista = e.isIntersecting; });
        if (enVista) alScroll();
      }, { rootMargin: '60% 0px 60% 0px' });
      io.observe(el);
      limpiar.push(function () { io.disconnect(); });
      if (corte) {
        var ioC = new IntersectionObserver(function (ent) {
          ent.forEach(function (e) { if (e.isIntersecting && modo !== 'quieto') { animarCorte(); ioC.disconnect(); } });
        }, { rootMargin: '0px 0px -22% 0px', threshold: 0 });
        ioC.observe(nodo.querySelector('.arb-corte-lienzo'));
        limpiar.push(function () { ioC.disconnect(); });
      }
      window.addEventListener('scroll', alScroll, { passive: true });
      window.addEventListener('resize', alResize);
      limpiar.push(function () { window.removeEventListener('scroll', alScroll); window.removeEventListener('resize', alResize); });
      var mo = new MutationObserver(function () { ponerModo(); alScroll(); });
      mo.observe(raiz, { attributes: true, attributeFilter: ['class'] });
      limpiar.push(function () { mo.disconnect(); });
      var alMq = function () { reduce = mqReduce.matches; ponerModo(); };
      if (mqReduce.addEventListener) { mqReduce.addEventListener('change', alMq); limpiar.push(function () { mqReduce.removeEventListener('change', alMq); }); }
      // la guía depende de la letra y de la foto: recolocar cuando lleguen
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (vivo) colocarGuias(); });
      Array.prototype.forEach.call(nodo.querySelectorAll('.arb-foto img'), function (im) { if (!im.complete) im.addEventListener('load', colocarGuias, { once: true }); });
      alScroll();
    };

    var dir = opc.svg || base('../img/arboles/');
    var fotosUrl = opc.fotosJson || base('../img/fotos/fotos.json');
    Promise.all([
      pedir(dir + 'corte.svg').catch(function () { return ''; }),
      pedir(fotosUrl, 'json').catch(function () { return null; })
    ].concat(HABS.map(function (ha) { return pedir(dir + ha.id + '.svg'); }))).then(construir).catch(function (err) {
      if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo);
      respaldo.forEach(function (r) { r.n.hidden = r.h; });
      delete el.dataset.montado;
      if (window.console) console.warn('[arboles] se queda el respaldo:', err && err.message);
    });

    return {
      destruir: function () {
        vivo = false;
        if (raf) cancelAnimationFrame(raf);
        limpiar.forEach(function (f) { try { f(); } catch (e) {} });
        if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo);
        respaldo.forEach(function (r) { r.n.hidden = r.h; });
        delete el.dataset.montado;
        habs = []; corte = null;
        if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) {} }
      }
    };
  }

  window.Tulla = window.Tulla || {};
  window.Tulla.arboles = { montar: montar, ASIGNACION: ASIGNACION, HABS: HABS, CUARTOS: CUARTOS };
})();
