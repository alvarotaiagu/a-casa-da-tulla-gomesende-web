/* ------------------------------------------------------------------
   A Casa da Tulla · reserva.js
   Motor de reservas de DEMOSTRACIÓN (el de casa entera de Casa da Laxa y
   Casa de Agosto, llevado a esta casa). Pasos: fechas → personas → datos → confirmación.
   Las noches ocupadas se generan (siempre las mismas para cada año);
   no hay servidor: no se envía, se guarda ni se cobra nada.
   SUPUESTOS (marcados también en la página y en el README):
   - precio por persona y noche: 28 € en temporada baja y 32 € en alta
     (las fichas de los portales dan de 26 a 31 €; no hay tarifa publicada);
   - temporada alta = Semana Santa, puentes y festivos nacionales, julio y agosto;
   - mínimo 2 noches; la cuna, sin coste; sin señal (no consta: no se pide).
   Cancelación sin coste hasta 30 días antes (la de su ficha de casasrurales.net).
   Al conectar el motor real, solo cambian ocupada() y confirmar.
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const raiz = document.getElementById('motor');
  if (!raiz) return;

  /* ---------- fechas ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deClave = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const mas = (k, n) => { const d = deClave(k); d.setDate(d.getDate() + n); return clave(d); };
  const entre = (a, b) => Math.round((deClave(b) - deClave(a)) / 864e5);
  const hoy = clave(new Date());
  const fCorta = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fEur = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const corta = (k) => fCorta.format(deClave(k));
  const larga = (k) => fLarga.format(deClave(k));
  const eur = (n) => fEur.format(Math.round(n * 100) / 100) + ' €';

  // Domingo de Pascua (algoritmo anónimo gregoriano)
  function pascua(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return clave(new Date(y, mes - 1, dia));
  }

  /* ---------- tarifas y temporada (SUPUESTOS) ---------- */
  const PRECIO = { baja: 28, alta: 32 };     // por persona y noche
  const MIN_NOCHES = 2, MAX_PERS = 9, VENTANA = 12;
  // festivos nacionales (y el Viernes Santo); un puente: el lunes o el viernes pegado a un festivo en martes o jueves
  const festivos = new Map();
  function festivosDe(y) {
    if (festivos.has(y)) return festivos.get(y);
    const s = new Set(['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'].map((md) => `${y}-${md}`));
    s.add(mas(pascua(y), -2));
    [...s].forEach((k) => { const w = deClave(k).getDay(); if (w === 2) s.add(mas(k, -1)); if (w === 4) s.add(mas(k, 1)); });
    festivos.set(y, s);
    return s;
  }
  const cacheAlta = new Map();
  // una noche es de temporada alta si cae en Semana Santa, en julio o agosto,
  // o si esa noche o el día siguiente es festivo o puente
  function esAlta(k) {
    if (cacheAlta.has(k)) return cacheAlta.get(k);
    const y = +k.slice(0, 4), md = k.slice(5), p = pascua(y);
    const f = festivosDe(y), sig = mas(k, 1), fs = festivosDe(+sig.slice(0, 4));
    const v = (k >= mas(p, -7) && k <= p) || (md >= '07-01' && md <= '08-31') || f.has(k) || fs.has(sig);
    cacheAlta.set(k, v);
    return v;
  }

  /* ---------- noches ocupadas de ejemplo (siempre las mismas) ---------- */
  function azar(s) { return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ocupadasSet = (function generar() {
    const set = new Set();
    const tomar = (a, n) => { for (let i = 0; i < n; i++) set.add(mas(a, i)); };
    const anios = new Set();
    for (let k = mas(hoy, -40), fin = mas(hoy, 400); k <= fin; k = mas(k, 1)) anios.add(+k.slice(0, 4));
    anios.forEach((y) => {
      const r = azar(y * 1637);
      for (let k = `${y}-01-01`; k <= `${y}-12-31`; k = mas(k, 1)) if (deClave(k).getDay() === 5 && r() < 0.38) tomar(k, 2);
      tomar(mas(pascua(y), -3), 4);
      let k = `${y}-07-01`;
      while (k < `${y}-09-01`) { const n = 4 + Math.floor(r() * 5); if (r() < 0.8) tomar(k, n); k = mas(k, n + (r() < 0.35 ? 1 : 0)); }
      [[`${y}-10-10`, 3], [`${y}-10-31`, 2], [`${y}-12-05`, 3], [`${y}-12-30`, 3], [`${y}-05-01`, 2], [`${y}-07-24`, 3]].forEach(([a, n]) => { if (r() < 0.75) tomar(a, n); });
    });
    return set;
  })();
  const ocupada = (k) => ocupadasSet.has(k);
  const libreEntre = (a, b) => { for (let k = a; k < b; k = mas(k, 1)) if (ocupada(k)) return false; return true; };

  /* ---------- estado ---------- */
  const b0 = deClave(hoy);
  const st = { y: b0.getFullYear(), m: b0.getMonth(), ini: null, fin: null, pers: 4, cuna: false, paso: 'fechas', msg: '', datos: {}, loc: '' };
  const minMes = st.y * 12 + st.m, maxMes = minMes + VENTANA - 1;
  const limite = clave(new Date(b0.getFullYear(), b0.getMonth() + VENTANA, 0));
  const noches = () => { if (!st.ini || !st.fin) return []; const r = []; for (let k = st.ini; k < st.fin; k = mas(k, 1)) r.push(k); return r; };
  const cuenta = () => {
    const n = noches(), alta = n.filter(esAlta).length, baja = n.length - alta;
    const total = (alta * PRECIO.alta + baja * PRECIO.baja) * st.pers;
    return { n: n.length, alta, baja, total };
  };

  /* ---------- pintar ---------- */
  const DSEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const PASOS = [['fechas', 'Fechas'], ['personas', 'Personas'], ['datos', 'Vuestros datos'], ['hecho', 'Confirmación']];
  const SUP = '<span class="sup">supuesto</span>';
  const AVISO = '<p class="motor__fino motor__aviso">Demostración: no se envía, no se guarda ni se cobra nada.</p>';

  function mesHTML(y, m) {
    const primero = new Date(y, m, 1), dias = new Date(y, m + 1, 0).getDate();
    const off = (primero.getDay() + 6) % 7;
    const nombre = primero.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    let h = `<div class="mes"><h4 class="mes__tit">${nombre[0].toUpperCase() + nombre.slice(1)}</h4><div class="dias" role="group" aria-label="${nombre}">`;
    h += DSEM.map((d) => `<span class="dsem" aria-hidden="true">${d}</span>`).join('');
    for (let i = 0; i < off; i++) h += '<span class="vacio"></span>';
    for (let d = 1; d <= dias; d++) {
      const k = `${y}-${pad(m + 1)}-${pad(d)}`;
      const c = ['dia'];
      let dis = false, et = larga(k);
      if (k < hoy || k > limite) { c.push('pasado'); dis = true; }
      else if (ocupada(k)) {
        if (st.ini && !st.fin && k > st.ini && libreEntre(st.ini, k)) { c.push('solo-salida'); et += ', libre para salir'; }
        else { c.push('ocupado'); dis = true; et += ', ocupado'; }
      } else et += ', libre';
      if (esAlta(k) && !dis) { c.push('alta'); et += ', temporada alta'; }
      if (st.ini && k === st.ini) { c.push('ini'); et += ', llegada'; }
      if (st.fin && k === st.fin) { c.push('fin'); et += ', salida'; }
      if (st.ini && st.fin && k > st.ini && k < st.fin) c.push('rango');
      h += `<button type="button" class="${c.join(' ')}" data-k="${k}" aria-label="${et}"${dis ? ' aria-disabled="true" tabindex="-1"' : ''}${(k === st.ini || k === st.fin) ? ' aria-pressed="true"' : ''}>${d}</button>`;
    }
    return h + '</div></div>';
  }

  const resumenFechas = () => `<div class="fechas"><div><small>Llegada</small><b>${st.ini ? corta(st.ini) : '—'}</b></div><div><small>Salida</small><b>${st.fin ? corta(st.fin) : '—'}</b></div></div>`;
  function desglose() {
    const c = cuenta();
    let d = '<div class="desglose" id="desglose">';
    if (!c.n) d += `<div class="nada">${st.ini ? 'Ahora, el día de salida.' : 'Elegid el día de llegada en el calendario.'}</div>`;
    else {
      const per = st.pers === 1 ? '1 persona' : st.pers + ' personas';
      if (c.baja) d += `<div><span>${c.baja} ${c.baja === 1 ? 'noche' : 'noches'} × ${per} × ${eur(PRECIO.baja)}</span><span>${eur(c.baja * PRECIO.baja * st.pers)}</span></div>`;
      if (c.alta) d += `<div><span>${c.alta} ${c.alta === 1 ? 'noche' : 'noches'} de temporada alta × ${per} × ${eur(PRECIO.alta)}</span><span>${eur(c.alta * PRECIO.alta * st.pers)}</span></div>`;
      if (st.cuna) d += '<div><span>Cuna</span><span>sin coste</span></div>';
      d += `<div class="tot"><span>Total estimado</span><span data-total>${eur(c.total)}</span></div>`;
    }
    return d + '</div>';
  }

  function panelFechas() {
    const c = cuenta(), listo = c.n >= MIN_NOCHES;
    return `<h3 id="motor-tit-paso" tabindex="-1">Vuestra estancia</h3>
      ${resumenFechas()}
      ${desglose()}
      <button type="button" class="btn btn--marca" data-acc="seguir" aria-disabled="${!listo}">Seguir: cuántos venís</button>
      <p class="motor__fino">Mínimo ${MIN_NOCHES} noches ${SUP}. Precio por persona y noche: ${eur(PRECIO.baja)} en temporada baja y ${eur(PRECIO.alta)} en alta ${SUP}.</p>`;
  }
  function panelPersonas() {
    return `<h3 id="motor-tit-paso" tabindex="-1">¿Cuántos venís?</h3>
      ${resumenFechas()}
      <div class="pers"><div><small>Personas · hasta 9</small><b aria-live="polite" id="motor-pers">${st.pers}</b></div>
        <button type="button" data-acc="menos" aria-label="Una persona menos"${st.pers <= 1 ? ' disabled' : ''}>−</button>
        <button type="button" data-acc="mas" aria-label="Una persona más"${st.pers >= MAX_PERS ? ' disabled' : ''}>+</button></div>
      <div class="casillas"><label class="check" for="m-cuna"><input type="checkbox" id="m-cuna"${st.cuna ? ' checked' : ''}><span>Necesitamos la cuna <small>hay una en la casa · sin coste en esta demostración ${SUP}</small></span></label></div>
      ${st.pers >= MAX_PERS ? '<p class="motor__fino">Nueve es el máximo de la casa.</p>' : ''}
      ${desglose()}
      <p class="motor__fino">Mascotas: se admiten, avisando antes de llegar ${'<span class="sup">por confirmar</span>'}.</p>
      <button type="button" class="btn btn--marca" data-acc="a-datos">Seguir: vuestros datos</button>
      <button type="button" class="btn btn--linea" data-acc="volver">Cambiar fechas</button>`;
  }
  function panelDatos() {
    const c = cuenta(), v = st.datos;
    const e = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return `<h3 id="motor-tit-paso" tabindex="-1">Vuestros datos</h3>
      <p class="motor__fino">${corta(st.ini)} → ${corta(st.fin)} · ${c.n} noches · ${st.pers} ${st.pers === 1 ? 'persona' : 'personas'} · <b>${eur(c.total)}</b></p>
      <form class="form" id="motor-form" novalidate>
        <label for="m-nombre">Nombre y apellidos<input type="text" id="m-nombre" autocomplete="name" required value="${e(v.nombre)}"></label>
        <label for="m-correo">Correo<input type="email" id="m-correo" autocomplete="email" required value="${e(v.correo)}"></label>
        <label for="m-tel">Teléfono<input type="tel" id="m-tel" autocomplete="tel" inputmode="tel" required value="${e(v.tel)}"></label>
        <label for="m-nota">¿Algo que debamos saber? <span>(opcional)</span><textarea id="m-nota" rows="2">${e(v.nota)}</textarea></label>
        <label class="check" for="m-ok"><input type="checkbox" id="m-ok" required${v.ok ? ' checked' : ''}><span>He leído la <a class="enlace" href="privacidad.html">política de privacidad</a> y las condiciones de cancelación.</span></label>
        <p class="motor__msg" id="m-error" aria-live="assertive"></p>
        <button type="submit" class="btn btn--marca">Pedir la reserva</button>
        ${AVISO}
        <button type="button" class="btn btn--linea" data-acc="volver-pers">Volver</button>
      </form>`;
  }
  function panelHecho() {
    const c = cuenta();
    return `<div class="confirmacion">
      <h3 id="motor-tit-paso" tabindex="-1">Reserva pedida <small>(de demostración)</small></h3>
      <p class="confirmacion__loc" id="motor-loc">${st.loc}</p>
      <p>${larga(st.ini)} → ${larga(st.fin)}<br>${c.n} noches · ${st.pers} ${st.pers === 1 ? 'persona' : 'personas'}${st.cuna ? ' · cuna' : ''} · ${eur(c.total)}</p>
      <p>La casa os escribiría para confirmarla y acordar la hora de llegada. Cancelación sin coste hasta 30 días antes.</p>
      <p class="motor__fino" id="motor-demo-hecho">Demostración: no se ha enviado, guardado ni cobrado nada. En la web de verdad os llegaría la confirmación por correo.</p>
      <button type="button" class="btn btn--linea" data-acc="otra">Hacer otra reserva</button>
    </div>`;
  }

  function pintar(foco) {
    const y2 = st.m === 11 ? st.y + 1 : st.y, m2 = (st.m + 1) % 12, actual = st.y * 12 + st.m;
    const iPaso = PASOS.findIndex((p) => p[0] === st.paso);
    const pasos = '<ol class="motor__pasos" aria-label="Pasos">' + PASOS.map(([k, t], i) => `<li${i === iPaso ? ' aria-current="step"' : ''}${i < iPaso ? ' class="hecho"' : ''}>${t}</li>`).join('') + '</ol>';
    const panel = { fechas: panelFechas, personas: panelPersonas, datos: panelDatos, hecho: panelHecho }[st.paso]();
    raiz.innerHTML = pasos + `<div class="motor__in">
      <div class="motor__cal"${st.paso !== 'fechas' ? ' inert' : ''}>
        <div class="motor__top"><h3>Noches libres</h3>
          <button type="button" class="motor__nav" data-acc="prev" aria-label="Mes anterior"${actual <= minMes ? ' disabled' : ''}>‹</button>
          <button type="button" class="motor__nav" data-acc="next" aria-label="Mes siguiente"${actual + 1 >= maxMes ? ' disabled' : ''}>›</button></div>
        <div class="motor__meses">${mesHTML(st.y, st.m)}${mesHTML(y2, m2)}</div>
        <div class="motor__ley"><span><i style="background:var(--verde-texto)"></i>Vuestra estancia</span><span><i style="background:repeating-linear-gradient(135deg,#EAE2D3 0 4px,#DDD3C2 4px 6px)"></i>Ocupado (de ejemplo)</span><span><i style="background:var(--ocaso-texto);border-radius:50%;width:6px;height:6px"></i>Temporada alta</span></div>
        <p class="motor__msg" aria-live="polite">${st.msg}</p>
      </div>
      <div class="motor__res">${panel}</div></div>`;
    if (foco) {
      const el = raiz.querySelector(foco);
      if (el) el.focus({ preventScroll: true });
    }
  }

  /* ---------- acciones ---------- */
  raiz.addEventListener('change', (e) => { if (e.target.id === 'm-cuna') { st.cuna = e.target.checked; pintar('#m-cuna'); } });
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.k) {
      if (b.getAttribute('aria-disabled') === 'true' || st.paso !== 'fechas') return;
      const k = b.dataset.k;
      st.msg = '';
      if (!st.ini || st.fin || k <= st.ini) {
        if (ocupada(k)) return;
        st.ini = k; st.fin = null;
      } else if (!libreEntre(st.ini, k)) {
        st.msg = 'Hay noches ocupadas entre medias: elegid otra salida.';
        if (!ocupada(k)) { st.ini = k; st.fin = null; }
      } else if (entre(st.ini, k) < MIN_NOCHES) {
        st.msg = `La estancia mínima es de ${MIN_NOCHES} noches.`;
      } else st.fin = k;
      pintar(`[data-k="${k}"]`);
      return;
    }
    const a = b.dataset.acc;
    if (!a) return;
    let foco = `[data-acc="${a}"]:not(:disabled)`;
    if (a === 'prev') { if (st.y * 12 + st.m <= minMes) return; if (st.m === 0) { st.m = 11; st.y--; } else st.m--; }
    else if (a === 'next') { if (st.y * 12 + st.m + 1 >= maxMes) return; if (st.m === 11) { st.m = 0; st.y++; } else st.m++; }
    else if (a === 'menos') st.pers = Math.max(1, st.pers - 1);
    else if (a === 'mas') st.pers = Math.min(MAX_PERS, st.pers + 1);
    else if (a === 'seguir') {
      if (cuenta().n < MIN_NOCHES) { st.msg = st.ini ? 'Falta el día de salida.' : 'Elegid primero el día de llegada.'; foco = null; }
      else { st.paso = 'personas'; st.msg = ''; foco = '#motor-tit-paso'; }
    }
    else if (a === 'a-datos') { st.paso = 'datos'; foco = '#motor-tit-paso'; }
    else if (a === 'volver') { st.paso = 'fechas'; foco = '#motor-tit-paso'; }
    else if (a === 'volver-pers') { guardarDatos(); st.paso = 'personas'; foco = '#motor-tit-paso'; }
    else if (a === 'otra') { st.paso = 'fechas'; st.ini = st.fin = null; st.datos = {}; st.cuna = false; foco = '#motor-tit-paso'; }
    else return;
    pintar(foco);
    if (['seguir', 'a-datos', 'volver', 'volver-pers', 'otra'].includes(a) && window.Tulla && window.Tulla.web) {
      const r = raiz.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.5) window.Tulla.web.irA(raiz);
    }
  });

  function guardarDatos() {
    const v = (id) => { const el = raiz.querySelector('#' + id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
    if (!raiz.querySelector('#m-nombre')) return;
    st.datos = { nombre: v('m-nombre'), correo: v('m-correo'), tel: v('m-tel'), nota: v('m-nota'), ok: v('m-ok') };
  }

  raiz.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, err = f.querySelector('#m-error');
    guardarDatos();
    const campos = ['m-nombre', 'm-correo', 'm-tel'].map((id) => f.querySelector('#' + id));
    campos.forEach((c) => c.removeAttribute('aria-invalid'));
    const falta = [];
    if (!st.datos.nombre.trim()) falta.push([campos[0], 'el nombre']);
    if (!/^\S+@\S+\.\S{2,}$/.test(st.datos.correo.trim())) falta.push([campos[1], 'un correo válido']);
    if (st.datos.tel.replace(/\D/g, '').length < 9) falta.push([campos[2], 'un teléfono de al menos 9 cifras']);
    if (falta.length) {
      falta.forEach(([c]) => c.setAttribute('aria-invalid', 'true'));
      err.textContent = 'Falta ' + falta.map((x) => x[1]).join(', ') + '.';
      falta[0][0].focus();
      return;
    }
    if (!st.datos.ok) { err.textContent = 'Falta aceptar la política de privacidad.'; f.querySelector('#m-ok').focus(); return; }
    // localizador TUL-AAMMDD-NNN (de la llegada); en la demostración no se guarda en ningún sitio
    st.loc = 'TUL-' + st.ini.slice(2).replace(/-/g, '') + '-' + String((entre(st.ini, st.fin) * 37 + st.pers * 11 + st.datos.nombre.length * 7) % 1000).padStart(3, '0');
    st.paso = 'hecho';
    pintar('#motor-tit-paso');
  });

  // estado inicial de ejemplo: el próximo fin de semana libre, para cuatro
  for (let k = mas(hoy, 1), i = 0; i < 150; k = mas(k, 1), i++) {
    if (deClave(k).getDay() === 5 && libreEntre(k, mas(k, 2))) {
      st.ini = k; st.fin = mas(k, 2);
      const d = deClave(k); st.y = d.getFullYear(); st.m = d.getMonth();
      if (st.y * 12 + st.m + 1 > maxMes) { st.y = b0.getFullYear(); st.m = b0.getMonth(); }
      break;
    }
  }
  pintar();

  // para las pruebas
  window.__motor = { st, ocupada, esAlta, cuenta, pascua, PRECIO, MIN_NOCHES, MAX_PERS };
})();
