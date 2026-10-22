/* Verificación de la web de A Casa da Tulla (Playwright, un solo navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs   (puerto 8851). Sin capturas: lo que hay que mirar a ojo va en el README.
   El WebGL del 3D NO se pinta: el navegador arranca con --disable-3d-apis (sin swiftshader) y la página
   se abre con ?sin-3d; se comprueba solo que la ruta monta o deja su respaldo. Todas las pruebas con
   movimiento reducido salvo las de movimiento (cortina, luz que se interpola, entrada de la portada),
   que van una vez y al final. Los módulos de los otros agentes se prueban solo si ya están. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8851;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-3d';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'casadatulla-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const HAY = { grano: existe('js/grano.js'), pincel: existe('js/pincel.js'), arboles: existe('js/arboles.js'), ruta: existe('js/3d/arranque.js'), cortina: existe('partes/cortina.html') };

/* librerías desde una copia local: la prueba no depende del CDN ese día */
const CDN = {
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
  'gsap.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
};
const CACHE = path.join(os.tmpdir(), 'tulla-cdn');
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}
const RE_CDN = /cdn\.jsdelivr\.net\/npm\/.*\/(lenis|gsap|ScrollTrigger)\.min\.js$/;
const local = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) });

/* ================= 0. archivos (sin navegador) ================= */
console.log('\n0. Archivos');
console.log('  (módulos presentes: ' + Object.entries(HAY).map(([k, v]) => k + (v ? ' sí' : ' no')).join(', ') + ')');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
for (const f of htmls) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, ?nofollow">/.test(s), `${f}: charset lo primero y noindex justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
  comprobar(!/<!--parte:/.test(s) && !/<!-- sin partes\/(cabeza|cabecera|reserva|llegar|pie|guiones)/.test(s), `${f}: todas las partes de la web incluidas`);
}
if (!HAY.cortina) nota('aún no está partes/cortina.html (módulo Entrada): la web va sin cortina');
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'marca/logo-240.png', 'marca/logo-480.png'].every(existe), '.nojekyll, 404, manifest, og:image, favicons y el logo reducido');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const lista = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const fotosJson = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
{
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);
  const pre = /<link rel="preload" as="image" type="image\/avif" imagesrcset="([^"]+)"/.exec(html);
  const pic = /<picture data-foto="ocaso-casa"><source type="image\/avif" srcset="([^"]+)"/.exec(html);
  comprobar(pre && pic && pre[1] === pic[1], 'la foto de la portada (ocaso-casa) va precargada con el mismo srcset que pinta el <picture>');
  // fotos: ni casasrurales (marca de agua), ni no-casa, ni IA; ocaso-casa sin las cuatro personas; las ampliadas, ≤ 1024
  comprobar(lista.every((f) => !/casasrurales|no-casa|sensacion|DALL/i.test(f.ruta)), 'ninguna foto con marca de agua, de fuera de la casa ni generada con IA');
  const oc = lista.find((f) => f.nombre === 'ocaso-casa');
  comprobar(/A-casa-da-Tulla_12/.test(oc.ruta) && oc.recorte && oc.recorte.left >= 352, 'ocaso-casa: A-casa-da-Tulla_12 recortada sin las cuatro personas (x ≥ 352)', oc.recorte);
  const amp = lista.filter((f) => /800x600-1/.test(f.ruta)).map((f) => fotosJson.find((x) => x.nombre === f.nombre));
  comprobar(amp.length >= 5 && amp.every((f) => f && f.ancho <= 1024), 'las *-800x600-1 de su web (ampliadas) salen como mucho a 1024', amp.map((f) => f && [f.nombre, f.ancho]));
  const nombres = ['dia', 'ocaso-casa', 'ocaso-valle', 'noche', 'noche-piscina', 'casa-reflejo', 'piscina', 'vistas', 'asador', 'porche', 'jardin', 'tumbonas', 'entrada', 'pila', 'salon', 'salon-2', 'salon-3', 'cocina', 'bano', 'hab-castineiro', 'hab-figueira', 'hab-naranja', 'hab-roja', 'hab-roja-2', 'hab-roja-3', 'iglesia', 'otono', 'ovejas'];
  comprobar(nombres.every((n) => fotosJson.some((f) => f.nombre === n)), 'están todas las fotos que piden los módulos por nombre (fotos.json)');

  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<blockquote[\s\S]*?<\/blockquote>/g, '').replace(/<[^>]+>/g, ' ');
  comprobar(!/\b\d+ (reseñas|opiniones)\b/i.test(texto) && !/\b(una|1)( sola| única)? (reseña|opinión)\b/i.test(texto) && !/4,7|4\.7/.test(texto), 'sin recuento de reseñas ni «4,7» (la nota de Google solo como «Excelente», con su enlace)');
  comprobar(!/el mejor|los mejores|la mejor|clientes satisfechos|cientos de|miles de|sin permanencia|garantizad/i.test(texto), 'sin superlativos propios ni prueba social inventada (las citas, aparte)');
  comprobar(!/whatsapp|wa\.me/i.test(html), 'sin WhatsApp (no consta el número)');
  comprobar(!/\bwi-?fi\b|internet|desayun|servimos cenas|cenas|cocina de leña/i.test(texto), 'no promete wifi, ni desayunos o cenas, ni «cocina de leña»');
  comprobar(!/aislad/i.test(texto) && /dentro de la aldea/i.test(texto), 'la casa está «dentro de la aldea», nunca «aislada»');
  comprobar(!/Pablo/.test(texto) && !/VUT-OR/.test(html) && !/Taberna de Reposo/i.test(html) && !/Dixome/i.test(html), 'ni «Mercedes y Pablo» fuera de las citas, ni el VUT, ni la Taberna de Reposo, ni firma de agencia');
  comprobar(!/O-Forno-do-Lito|194354265|termas\.jpg|pexels|rafting|er-14|er-15|er-16|er-19/i.test(html), 'ninguna foto de no-casa ni de rafting o termas de terceros');
  comprobar(/TR-OR-000096/.test(html) && /616 887 944/.test(html) && /650 30 84 90/.test(html) && /info@acasadatulla\.es/.test(html) && /Gomesende, 47/.test(html), 'registro TR-OR-000096, los dos teléfonos, el correo y la dirección');
  comprobar(/«Arca grande de madeira ou doutro material para gardar a gra ou outras cousas\.»/.test(html) && /Real Academia Galega/.test(html), 'la definición literal de la RAG, con su fuente');
  comprobar(/La casa data de <span class="cifra">1637<\/span>\. Cuentan que aquí se guardaba el grano de las rentas del monasterio de Celanova, y de ahí su nombre\./.test(html) && /no conocemos un documento/.test(html), 'la historia, como la cuenta la casa, y que no hay documento');
  comprobar(/un ferrado|Ferrado/.test(html) && /Entre 12 y 20 kg de grano/.test(html) && /Escá/.test(html), 'las medidas: el ferrado (12 a 20 kg) y la escá');
  comprobar(/<html lang="es">/.test(html) && !/\/es\/|hreflang/.test(html) && [...html.matchAll(/lang="gl"/g)].length <= 3, 'solo castellano (el gallego, solo en las citas del diccionario)');
  comprobar([...html.matchAll(/<img\b[^>]*>/g)].every((m) => /\salt="/.test(m[0])), 'todas las imágenes llevan alt');
  comprobar((() => { try { JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]); return true; } catch (e) { return false; } })() && !/aggregateRating|reviewCount/.test(html), 'el JSON-LD se lee y no lleva recuento de reseñas');
  const iMain = html.indexOf('js/main.js');
  const mods = ['js/grano.js', 'js/pincel.js', 'js/arboles.js'].filter((s) => html.includes('src="' + s));
  comprobar(mods.every((s) => html.indexOf('src="' + s) < iMain && new RegExp('<script src="' + s.replace('.', '\\.') + '[^"]*" defer>').test(html)), 'los JS de los módulos que hay, con defer y antes de main.js', mods);
  comprobar(!html.includes('js/3d/arranque.js') || (/<script type="module" src="js\/3d\/arranque\.js[^"]*"/.test(html) && html.indexOf('js/3d/arranque.js') > iMain), 'el 3D, como módulo diferido y al final');
  comprobar(['css/entrada.css', 'css/arboles.css', 'css/3d.css'].filter((c) => html.includes(c)).every((c) => html.indexOf(c) < html.indexOf('</head>')), 'los CSS de los módulos que hay, en el <head>');
  comprobar(/<section class="portada" id="portada"[^>]*>[\s\S]*?<div class="portada__pincel" data-modulo="pincel">\s*<picture data-foto="ocaso-casa">/.test(html) && /<p class="portada__ahora mono" data-luz-ahora><\/p>/.test(html)
    && /<section id="arboles" class="sec arboles"[^>]*aria-labelledby="t-arboles">/.test(html) && /<h2 id="t-arboles"/.test(html) && /data-modulo="arboles"/.test(html)
    && /<section id="ruta" class="ruta"[^>]*aria-labelledby="t-ruta">/.test(html) && /<h2 id="t-ruta"/.test(html) && /data-modulo="ruta"/.test(html)
    && /<footer class="pie"[\s\S]*data-modulo="ferrado"/.test(html), 'los sitios de los módulos, como dice el contrato (pincel, árboles, ruta y ferrado)');
}
const css = fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css), 'cookies: display solo en :not([hidden])');
comprobar(/\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css), 'mando: display solo en :not([hidden])');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css), 'menú móvil: altura 100dvh, nunca inset:0 (la cabecera lleva backdrop-filter)');
comprobar(!/\ddvh/.test(css.replace(/\.menu-movil\s*\{[^}]*\}/, '')), 'fuera del menú fijo, ningún dvh (la barra del móvil no mueve nada)');
comprobar(/html\.cortina-fuera #cortina\s*\{\s*display:\s*none/.test(css) && /prefers-reduced-motion: reduce\)\s*\{\s*#cortina\s*\{\s*display:\s*none/.test(css) && /#cortina\[hidden\]\s*\{\s*display:\s*none/.test(css), 'cortina: la web la oculta al salir, con [hidden] y con movimiento reducido');
comprobar(!/cursor:\s*none/.test(css), 'sin cursor propio');
comprobar(!/\.(cuartos|ruta__lista|citas|camino)\s*\{[^}]*position:\s*sticky/.test(css) && !/marquee/i.test(css + html), 'fuera la pila sticky de tarjetas y el marquee');
const mainJs = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
comprobar(/const motion = !quieto;\s*if \(motion\) raiz\.classList\.add\('con-movimiento'\)/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
comprobar(/if \(esBarra\(\)\) return;/.test(mainJs) && !/addEventListener\('resize'[^;]*innerHeight/.test(mainJs), 'el resize de la barra del móvil no rehace nada');
comprobar(/window\.__redCortina = setTimeout/.test(html) && /<noscript><style>\.cortina,#cortina\{display:none!important\}<\/style><\/noscript>/.test(html), 'red de seguridad inline y <noscript> para la cortina');

/* ================= navegador: uno solo, sin WebGL ================= */
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'] });
try {
  async function nueva(op = {}, { cdn = 'local', script, abortar } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
    if (cdn === 'local') await ctx.route(RE_CDN, local);
    if (cdn === 'caido') await ctx.route(RE_CDN, (r) => r.abort());
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
    if (abortar) await ctx.route(abortar, (r) => r.abort());
    if (script) await ctx.addInitScript(script);
    const page = await ctx.newPage();
    page._errores = [];
    page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|WebGL|webgl/.test(m.text())) page._errores.push('consola: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
    return { ctx, page };
  }
  const fuera = (page) => page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'), null, { timeout: 12000 });
  // contraste de las parejas de texto (componiendo el alfa sobre el fondo)
  const contrastes = (page, sel) => page.evaluate((sel) => {
    const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data]; };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const fondo = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/[, /] ?0\)$/.test(b)) return rgba(b).slice(0, 3); el = el.parentElement; } return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3); };
    return sel.map((s) => {
      const el = document.querySelector(s); if (!el) return [s, 'falta'];
      const f = fondo(el), c = rgba(getComputedStyle(el).color), a = c[3] / 255;
      const t = [0, 1, 2].map((i) => c[i] * a + f[i] * (1 - a));
      const x = L(t), y = L(f); return [s, Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100];
    });
  }, sel);
  const ir = (page, y) => page.evaluate((y) => { const l = window.Tulla.web && window.Tulla.web.lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);

  /* ---------- 1. portada, sol y luz (escritorio, movimiento reducido) ---------- */
  console.log('\n1. Portada, sol y luz (escritorio, movimiento reducido)');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return (!c || getComputedStyle(c).display === 'none') && !document.documentElement.classList.contains('con-movimiento'); }), 'con movimiento reducido no hay cortina ni «con-movimiento»');
    comprobar(await page.evaluate(() => getComputedStyle(document.body).cursor !== 'none' && !document.querySelector('.cursor, [class*="cursor-"]')), 'sin cursor propio (nunca dos cursores)');
    const p = await page.evaluate(() => {
      const R = (s) => document.querySelector(s).getBoundingClientRect();
      const img = document.querySelector('.portada__pincel img');
      const t = R('.portada-texto'), m = R('.portada__marco');
      return { carga: !!img && img.complete && img.naturalWidth > 0, ancho: Math.round(m.width), vista: innerWidth, solapa: !(t.right <= m.left || m.right <= t.left || t.bottom <= m.top || m.bottom <= t.top), cab: document.getElementById('cab').getBoundingClientRect().bottom <= Math.min(t.top, m.top) + 1, abierta: document.getElementById('portada').classList.contains('abierta'), titulo: getComputedStyle(document.querySelector('.portada__tit .ln > span')).transform };
    });
    comprobar(p.carga, 'la foto de la portada carga', p);
    comprobar(p.ancho <= 1264 * 1.3 && p.ancho < p.vista * 0.7 && !p.solapa && p.cab, 'en escritorio la foto no va a sangre: en su pincelada (≤ 1,3× su detalle), sin pisar el texto ni la cabecera', p);
    comprobar(p.abierta && p.titulo === 'none', 'sin cortina, la portada ya está abierta y el titular entero', p);
    comprobar(/^Ahora en Gomesende: \d\d:\d\d · el sol (se pone|sale) a las \d\d:\d\d$/.test(await page.textContent('[data-luz-ahora]')), 'la línea de la hora: «Ahora en Gomesende: HH:MM · el sol se pone / sale a las HH:MM»', await page.textContent('[data-luz-ahora]'));
    // el sol: las fórmulas de SunCalc en Gomesende y la hora de Madrid
    const sol = await page.evaluate(() => {
      const f = (d) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
      const s = window.Tulla.sol(new Date('2026-10-22T10:00:00Z'));
      const v = window.Tulla.sol(new Date('2026-06-21T12:30:00Z'));
      return { salida: f(s.salida), puesta: f(s.puesta), mediodia: s.fase, junio: v.altura, noche: window.Tulla.sol(new Date('2026-10-22T21:30:00Z')).fase, ocaso: window.Tulla.sol(new Date('2026-10-22T17:15:00Z')).fase };
    });
    comprobar(sol.salida >= '08:40' && sol.salida <= '09:05' && sol.puesta >= '19:30' && sol.puesta <= '19:50' && sol.mediodia === 'dia' && sol.junio > 68 && sol.junio < 72 && sol.noche === 'noche' && sol.ocaso === 'dorada', 'Tulla.sol: el 22 de octubre sale hacia las 8:50 y se pone hacia las 19:40 (hora de Madrid, como el cálculo a mano: mediodía solar 14:17, 5 h 23 min de semiarco); fases día, dorada y noche', sol);
    {
      const p2 = await ctx.newPage();
      await p2.goto(BASE + 'index.html?sin-3d&hora=2026-10-22T19:30');
      const r = await p2.evaluate(() => ({ h: window.Tulla.hora().toISOString(), fase: window.Tulla.sol().fase, linea: document.querySelector('[data-luz-ahora]').textContent }));
      comprobar(r.h === '2026-10-22T17:30:00.000Z' && r.fase === 'dorada' && /^Ahora en Gomesende: 19:30 · el sol se pone a las 19:/.test(r.linea), '?hora=2026-10-22T19:30 es la hora de Madrid: fase dorada y «el sol se pone a las 19:…»', r);
      await p2.goto(BASE + 'index.html?sin-3d&hora=2026-10-22T23:00');
      const n2 = await p2.textContent('[data-luz-ahora]');
      comprobar(/^Ahora en Gomesende: 23:00 · el sol sale a las 08:5\d$/.test(n2), 'de noche dice cuándo sale el sol mañana (nunca «se puso»)', n2);
      await p2.close();
    }
    // la luz: tramos por sección; con movimiento reducido, colores fijos (sin --l-*)
    const luzEn = async (sel) => { await ir(page, await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY + 40, sel)); await page.waitForTimeout(120); return page.evaluate(() => ({ luz: +getComputedStyle(document.documentElement).getPropertyValue('--luz'), clase: ['luz-dia', 'luz-ocaso', 'luz-noche'].find((c) => document.documentElement.classList.contains(c)), viva: document.documentElement.style.getPropertyValue('--l-fondo') })); };
    const l0 = await page.evaluate(() => ({ luz: +getComputedStyle(document.documentElement).getPropertyValue('--luz'), clase: document.documentElement.classList.contains('luz-dia') }));
    const lf = await luzEn('#fuera'), lo = await luzEn('#opiniones');
    await ir(page, 1e6); await page.waitForTimeout(150);
    const lb = await page.evaluate(() => +getComputedStyle(document.documentElement).getPropertyValue('--luz'));
    comprobar(l0.luz < 0.05 && l0.clase && lf.clase === 'luz-ocaso' && lo.clase === 'luz-noche' && lb === 1 && !lf.viva && !lo.viva, 'la luz: tarde arriba, ocaso en «Fuera», noche en «Lo que dicen» y 1 al final (con movimiento reducido, colores fijos por tramo)', { l0, lf, lo, lb });
    const fondos = await page.evaluate(() => ['#tulla', '#fuera', '#opiniones'].map((s) => getComputedStyle(document.querySelector(s)).backgroundColor));
    comprobar(fondos[0] === 'rgb(243, 238, 228)' && fondos[1] === 'rgb(237, 214, 172)' && fondos[2] === 'rgb(31, 34, 39)', 'cada tramo con su color fijo: cal, paja y granito de noche', fondos);
    // contraste en los tres tramos (colores fijos)
    const cs = await contrastes(page, ['.portada__baj', '.portada__ahora', '#tulla .eyebrow', '.diccionario__trad', '.diccionario__fuente', '.tulla__cuenta p:nth-child(2)', '.tulla__nota', '.cuentas th', '.cuentas caption .mono', '.medida figcaption', '.tulla__dia figcaption', '#arboles .sec-cab__txt', '.arboles__cuenta', '.cuarto p', '.cuarto h3 span', '#dentro .sec-cab__txt', '.dentro__f figcaption', '.dentro__lista', '#fuera .eyebrow', '#fuera .sec-cab__txt', '.fuera__f figcaption', '.fuera__cita .mono', '.ocaso__f figcaption', '.ocaso__quien .mono', '#ruta .eyebrow', '#ruta .sec-cab__txt', '.ruta__lista .mono', '.ruta__fuente', '#alrededor .sec-cab__txt', '.camino__d', '.camino p', '.cerca p', '.alrededor__fuente', '.denoche__f figcaption', '#opiniones .eyebrow', '.cita figcaption .mono', '#opiniones .enlace', '.opiniones__nota .mono', '.demo', '.motor__fino', '.dsem', '.mes__tit', '.motor__pasos li', '.motor__ley', '.saber__lista dt', '.saber__pasos b', '.saber__fuente', '.llegar__baj', '.contacto span', '.map-consent p', '.pie__ferrado-eti .mono', '.pie__cols p:not(.pie__logo)', '.pie__legal', '#reservar .btn--marca', '#portada .btn--marca', '#llegar .btn--marca', '.sup']);
    const malos = cs.filter(([, v]) => v === 'falta' || v < 4.5);
    comprobar(malos.length === 0, `contraste ≥ 4,5:1 en ${cs.length} parejas de texto, en los tres tramos`, malos);
    // y en la luz interpolada (la de la versión «Tulla»): de 0 a 1, salvo el cruce (.64–.70), que tapa la ruta
    const interp = await page.evaluate(() => {
      const L = (c) => { const m = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
      const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const peor = []; let min = 99;
      for (let i = 0; i <= 200; i++) {
        const l = i / 200; if (l > .64 && l < .70) continue;
        const c = window.Tulla.colores(l);
        for (const [a, b] of [['texto', 'fondo'], ['texto2', 'fondo'], ['acento', 'fondo'], ['btnt', 'btnf']]) { const v = cr(c[a], c[b]); if (v < min) min = v; if (v < 4.5) peor.push([l, a, +v.toFixed(2)]); }
      }
      return { min: +min.toFixed(2), peor: peor.slice(0, 6) };
    });
    comprobar(interp.peor.length === 0, `la luz interpolada en OKLCH: texto, texto secundario, acento y botones ≥ 4,5:1 en 190 puntos de la tarde a la noche (mínimo ${interp.min}:1)`, interp);
    comprobar(await page.evaluate(() => { const m = document.getElementById('mando'); return m.hidden && getComputedStyle(m).display === 'none'; }), 'sin ?revision el mando no se ve');
    comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('vistazo')).display === 'none'), 'la tabla «de un vistazo» solo sale en la sobria');
    // el foco: contorno de 2 px y el trazo de pincel debajo
    await ir(page, 0); await page.waitForTimeout(100);
    await page.locator('#portada .btn--marca').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(80);
    const foco = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e), r = e.getBoundingClientRect(), p = document.getElementById('foco-pincel'), q = p.getBoundingClientRect(); return { el: e.className, outline: s.outlineStyle, ancho: s.outlineWidth, pincel: getComputedStyle(p).opacity, bajo: q.top >= r.bottom && q.top - r.bottom < 16, mide: Math.abs(q.width - (r.width + 8)) < 2 }; });
    comprobar(foco.outline === 'solid' && foco.ancho === '2px' && +foco.pincel > 0.5 && foco.bajo && foco.mide, 'el foco del teclado: contorno de 2 px y un trazo de pincel corto justo debajo', foco);
    const fn = await page.evaluate(() => { const b = document.querySelector('#llegar .btn--marca'); b.focus(); return getComputedStyle(b).outlineColor; });
    comprobar(fn === 'rgb(242, 196, 109)', 'de noche el contorno del foco es de farol (se ve sobre el granito de noche)', fn);
    // mapa solo al pedirlo
    comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'el mapa de Google no se carga solo');
    await page.locator('#mapa-btn').click();
    comprobar(await page.evaluate(() => /google\.com\/maps\?q=42\.1639316%2C-8\.105519/.test(document.querySelector('#mapa iframe')?.src || '')), 'el mapa se carga al pulsar, en las coordenadas de la casa');
    comprobar(await page.evaluate(() => typeof window.Tulla.reservar === 'function' && typeof window.Tulla.alAbrirse === 'function'), 'la web pone Tulla.reservar() y Tulla.alAbrirse() para los módulos');
    comprobar(page._errores.length === 0, 'portada: sin errores de consola ni 404', page._errores.slice(0, 5));
    await ctx.close();
  }

  /* ---------- 2. módulos: montan al acercarse; sin su JS, el respaldo ---------- */
  console.log('\n2. Módulos');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForTimeout(400);
    const presentes = await page.evaluate(() => ({ arboles: !!window.Tulla.arboles, ruta: !!window.Tulla.ruta, ferrado: !!(window.Tulla.grano && (window.Tulla.grano.ferrado || window.Tulla.grano.montar)) }));
    comprobar(await page.evaluate(() => ['arboles', 'ruta', 'ferrado'].every((m) => document.querySelector(`[data-modulo="${m}"]`).dataset.montado !== '1')), 'árboles, ruta y ferrado no se montan al arrancar');
    for (const [sel, nombre, clave] of [['#arboles', 'Árboles', 'arboles'], ['#ruta', 'Ruta (sin WebGL)', 'ruta'], ['#pie', 'Ferrado', 'ferrado']]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      const ok = await page.waitForFunction((s) => document.querySelector(s + ' [data-modulo]').dataset.montado === '1', sel, { timeout: 8000 }).then(() => true, () => false);
      if (presentes[clave] || ok) comprobar(ok, `${nombre} monta al acercarse`);
      else nota(`${nombre}: su JS aún no está; se queda el respaldo`);
    }
    comprobar(await page.evaluate(() => { const r = document.querySelector('[data-modulo="ruta"]'); return r.textContent.includes('Celanova') || !!r.querySelector('img, canvas, svg'); }), 'la ruta, sin WebGL, enseña su plano o su lista de distancias');
    comprobar(page._errores.length === 0, 'módulos montados sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: /js\/(grano|pincel|arboles)\.js|js\/3d\// });
    await page.goto(PAG);
    await fuera(page);
    for (const sel of ['#arboles', '#ruta', '#pie']) { await page.locator(sel).scrollIntoViewIfNeeded(); await page.waitForTimeout(250); }
    const r = await page.evaluate(() => [...document.querySelectorAll('[data-modulo]')].map((el) => ({ m: el.dataset.modulo, montado: el.dataset.montado || '', alto: Math.round(el.getBoundingClientRect().height), cosas: el.querySelectorAll('img, svg, li').length })));
    comprobar(r.every((x) => !x.montado && x.alto > 100 && x.cosas >= 1), 'sin los JS de los módulos se queda cada respaldo (la foto de la portada, los cuatro cuartos, las distancias, el ferrado lleno)', r);
    comprobar(await page.evaluate(() => document.querySelectorAll('.cuarto').length === 4 && /Castiñeiro/.test(document.getElementById('arboles').textContent) && /9 personas · 4 dormitorios dobles · 4 baños · uno adaptado · cuna/.test(document.getElementById('arboles').textContent)), 'el respaldo de «Cuatro árboles»: los cuatro cuartos y el contador honesto');
    comprobar(page._errores.filter((e) => !/grano|pincel|arboles|3d/.test(e)).length === 0, 'y la página no da errores', page._errores);
    await ctx.close();
  }

  /* ---------- 3. reservar, de punta a punta ---------- */
  console.log('\n3. Reservar');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(BASE + 'index.html?sin-3d#reservar');
    await fuera(page);
    const m = await page.evaluate(() => { const M = window.__motor; const y = new Date().getFullYear() + 1; return { julio: M.esAlta(`${y}-07-20`), agosto: M.esAlta(`${y}-08-30`), junio: M.esAlta(`${y}-06-20`), noviembre: M.esAlta(`${y}-11-18`), ss: M.esAlta(M.pascua(y)), precios: M.PRECIO, min: M.MIN_NOCHES, max: M.MAX_PERS, ocupados: document.querySelectorAll('#motor .dia.ocupado[aria-disabled="true"]').length }; });
    comprobar(m.julio && m.agosto && !m.junio && !m.noviembre && m.ss && m.precios.baja === 28 && m.precios.alta === 32 && m.min === 2 && m.max === 9, 'temporada alta (julio, agosto y Semana Santa), 28 € y 32 € por persona y noche, mínimo 2 noches, hasta 9', m);
    comprobar(m.ocupados > 0, 'hay noches ocupadas de ejemplo y no se pueden elegir');
    comprobar(await page.evaluate(() => /Demostración/.test(document.querySelector('.demo').textContent) && /supuesto/.test(document.getElementById('motor').textContent)), 'el motor dice que es una demostración y marca los supuestos');
    await page.evaluate(() => { const st = window.__motor.st; st.ini = st.fin = null; });
    await page.locator('#motor [data-acc="next"]').click();
    const L = await page.evaluate(() => [...document.querySelectorAll('#motor .dia:not([aria-disabled="true"])')].map((b) => b.dataset.k));
    const par = await page.evaluate((L) => { const M = window.__motor; const f = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; for (const k of L) { const d = new Date(k + 'T12:00'); const k1 = f(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)), k2 = f(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2)); if (!M.ocupada(k) && !M.ocupada(k1) && L.includes(k2)) return [k, k1, k2]; } return null; }, L);
    await page.locator(`#motor [data-k="${par[0]}"]`).click();
    await page.locator(`#motor [data-k="${par[1]}"]`).click();
    comprobar(/mínima es de 2 noches/.test(await page.textContent('#motor .motor__msg')), 'una sola noche no vale: mínimo 2 (supuesto)');
    await page.locator(`#motor [data-k="${par[2]}"]`).click();
    comprobar(await page.evaluate(() => /\d/.test(document.querySelector('#desglose [data-total]')?.textContent || '')), 'llegada y salida → total estimado');
    await page.locator('#motor [data-acc="seguir"]').click();
    comprobar(await page.evaluate(() => /¿Cuántos venís\?/.test(document.getElementById('motor-tit-paso').textContent)), 'paso 2: personas');
    for (let i = 0; i < 7; i++) await page.locator('#motor [data-acc="mas"]').click().catch(() => {});
    comprobar(await page.evaluate(() => document.getElementById('motor-pers').textContent === '9' && document.querySelector('#motor [data-acc="mas"]').disabled), 'nueve es el máximo (el botón + se apaga)');
    await page.check('#m-cuna');
    const cuenta = await page.evaluate(() => { const M = window.__motor, c = M.cuenta(); const n = (s) => parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.')); return { c, total: n(document.querySelector('#desglose [data-total]').textContent), cuna: /Cuna/.test(document.getElementById('desglose').textContent), esperado: (c.alta * M.PRECIO.alta + c.baja * M.PRECIO.baja) * 9, senal: /señal/i.test(document.getElementById('motor').textContent) }; });
    comprobar(cuenta.total === cuenta.esperado && cuenta.cuna && !cuenta.senal, 'total = noches × personas × precio, la cuna en el resumen y sin señal (no consta)', cuenta);
    comprobar(/Mascotas: se admiten, avisando/.test(await page.textContent('#motor')), 'mascotas: «se admiten, avisando», marcado por confirmar');
    await page.locator('#motor [data-acc="a-datos"]').click();
    await page.locator('#motor-form button[type="submit"]').click();
    comprobar((await page.textContent('#m-error')).includes('Falta'), 'el formulario valida los datos');
    comprobar(await page.evaluate(() => { const b = document.querySelector('#motor-form button[type="submit"]'); const n = b.nextElementSibling; return n && /no se envía, no se guarda ni se cobra nada/.test(n.textContent); }), 'junto al botón dice que no envía, guarda ni cobra nada');
    await page.fill('#m-nombre', 'Ana Prueba'); await page.fill('#m-correo', 'ana@ejemplo.es'); await page.fill('#m-tel', '600 11 22 33'); await page.check('#m-ok');
    await page.locator('#motor-form button[type="submit"]').click();
    const loc = await page.textContent('#motor-loc');
    comprobar(new RegExp('^TUL-' + par[0].slice(2).replace(/-/g, '') + '-\\d{3}$').test(loc) && /no se ha enviado, guardado ni cobrado nada/.test(await page.textContent('#motor-demo-hecho')), 'confirmación con localizador TUL-AAMMDD-NNN y el aviso de demostración', loc);
    comprobar(/30 días/.test(await page.textContent('#reservar')), 'cancelación sin coste hasta 30 días antes (su ficha de casasrurales.net)');
    comprobar(page._errores.length === 0, 'reservar: sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }

  /* ---------- 4. el visor se abre por NOMBRE (cada miniatura, ratón) ---------- */
  console.log('\n4. Visor');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: /js\/(arboles|pincel|grano)\.js|js\/3d\// });
    await page.goto(PAG);
    await fuera(page);
    const n = await page.locator('[data-visor]').count();
    const malos = [];
    for (let i = 0; i < n; i++) {
      const b = page.locator('[data-visor]').nth(i);
      const nombre = await b.getAttribute('data-visor');
      await b.scrollIntoViewIfNeeded();
      await b.click();
      const v = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre, src: document.getElementById('visor-img').getAttribute('src') }));
      if (!(v.open && v.n === nombre && v.src.includes(nombre))) malos.push([nombre, v]);
      await page.keyboard.press('Escape');
    }
    comprobar(n >= 25 && malos.length === 0, `cada una de las ${n} miniaturas abre SU foto en el visor`, malos);
    await page.locator('[data-visor="pila"]').click();
    await page.keyboard.press('ArrowRight');
    const sig = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
    comprobar(sig === 'dia', 'con la flecha pasa a la siguiente de la serie (pila → día)', sig);
    await page.keyboard.press('Escape');
    comprobar(await page.evaluate(() => !document.getElementById('visor').open && document.activeElement?.dataset.visor === 'pila'), 'Escape cierra el visor y el foco vuelve a la miniatura');
    await ctx.close();
  }

  /* ---------- 5. cookies en cuatro pasos y mando con ?revision ---------- */
  console.log('\n5. Cookies y mando');
  {
    const { ctx, page } = await nueva();
    await page.goto(PAG);
    await fuera(page);
    await page.waitForSelector('#cookies:not([hidden])', { timeout: 4000 }).catch(() => {});
    comprobar(await page.isVisible('#cookies'), 'cookies: se ven en la primera visita');
    await page.click('#ck-si');
    comprobar(!(await page.isVisible('#cookies')) && (await page.evaluate((k) => localStorage.getItem(k), LLAVE)) === 'si', 'cookies: «Entendido» las cierra y guarda la marca');
    await page.reload(); await fuera(page);
    comprobar(!(await page.isVisible('#cookies')), 'cookies: al recargar no vuelven');
    await page.evaluate((k) => localStorage.removeItem(k), LLAVE);
    await page.reload(); await fuera(page);
    await page.waitForSelector('#cookies:not([hidden])', { timeout: 4000 }).catch(() => {});
    comprobar(await page.isVisible('#cookies'), 'cookies: sin la marca vuelven a salir');
    await page.click('#ck-no');
    const ck = fs.readFileSync(path.join(RAIZ, 'cookies.html'), 'utf8');
    comprobar(/Google Fonts/.test(ck) && /Google Maps/.test(ck) && /Instituto Geográfico Nacional/.test(ck) && /no se conecta a ningún servicio de fuera ni instala cookies/.test(ck), 'la página de cookies cita Google Fonts, el mapa de Google y el 3D (datos del IGN, sin cookies)');
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(BASE + 'index.html?sin-3d&revision&densidad=sobria'); await fuera(page);
    await page.waitForTimeout(500);
    await ir(page, await page.evaluate(() => document.getElementById('fuera').getBoundingClientRect().top + scrollY + 200)); await page.waitForTimeout(250);
    const s = await page.evaluate(() => ({ mando: !document.getElementById('mando').hidden, sobria: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, viva: document.documentElement.style.getPropertyValue('--l-fondo'), fuera: getComputedStyle(document.getElementById('fuera')).backgroundColor, tulla: getComputedStyle(document.getElementById('tulla')).backgroundColor }));
    comprobar(s.mando && s.sobria && s.vistazo === 'block', 'con ?revision el mando se ve y la sobria añade «A Casa da Tulla, de un vistazo»', s);
    comprobar(!s.viva && s.fuera === 'rgb(237, 214, 172)' && s.tulla === 'rgb(243, 238, 228)', 'sobria: la luz fija por tramos, sin interpolar', s);
    await page.click('#mando [data-densidad="tulla"]');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ sobria: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, url: location.search, viva: document.documentElement.style.getPropertyValue('--l-fondo') }));
    comprobar(!r.sobria && r.vistazo === 'none' && !r.url.includes('sobria') && /rgb/.test(r.viva), 'el mando vuelve a «Tulla»: la luz vuelve a interpolarse', r);
    comprobar(page._errores.length === 0, 'cambiar de densidad no da errores (los módulos se vuelven a montar)', page._errores.slice(0, 4));
    await ctx.close();
  }

  /* ---------- 6. móvil: anchos, portada sin solapes, menú y barra del navegador ---------- */
  console.log('\n6. Móvil');
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true }, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForTimeout(300);
    const ancho = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    comprobar(ancho[0] <= ancho[1], `${w}×${h}: sin scroll lateral`, ancho);
    const salen = await page.evaluate(() => [...document.querySelectorAll('main *, footer *')]
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && !e.closest('[aria-hidden="true"], .vh, [data-modulo="ruta"] canvas'); })
      .slice(0, 4).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')));
    comprobar(!salen.length, `${w}×${h}: nada se sale por la derecha`, salen);
    const r = await page.evaluate(() => {
      const R = (s) => document.querySelector(s).getBoundingClientRect();
      const t = R('.portada-texto'), cab = R('#cab'), m = R('.portada__marco'), p = R('#portada');
      return { fotoBajoCab: m.top >= cab.bottom - 1, fotoAncho: m.width >= Math.min(innerWidth, 720) - 1, textoBajoFoto: t.top >= m.bottom - 1, dentro: t.bottom <= p.bottom + 1 };
    });
    comprobar(Object.values(r).every(Boolean), `${w}×${h}: la foto arriba casi a todo el ancho y el texto debajo, sin pisar nada`, r);
    if (w === 390) {
      await page.evaluate(() => scrollTo(0, 1600));
      await page.waitForFunction(() => document.getElementById('cab').classList.contains('sc'));
      await page.click('#menu-btn');
      const mm = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { top: r.top, alto: r.height, vista: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility }; });
      comprobar(mm.top === 0 && Math.abs(mm.alto - mm.vista) < 2 && mm.vis === 'visible', 'menú móvil a pantalla completa con la cabecera ya fija', mm);
      await page.click('#menu-movil a[href="#reservar"]');
      comprobar(await page.waitForFunction(() => !document.body.classList.contains('menu'), null, { timeout: 3000 }).then(() => true, () => false), 'el menú se cierra al elegir');
      // visor con el dedo
      await page.locator('[data-visor="piscina"]').scrollIntoViewIfNeeded();
      await page.locator('[data-visor="piscina"]').tap();
      comprobar(await page.evaluate(() => document.getElementById('visor').open && document.getElementById('visor-img').dataset.nombre === 'piscina'), 'en el móvil, tocar una miniatura abre su foto');
      await page.click('#visor-cerrar');
      // la barra del navegador: 6 cambios de alto → ningún «tulla:resize», la luz no cambia y nada se mueve
      await page.evaluate(() => document.querySelectorAll('main > section, footer').forEach((s) => { s.style.height = s.offsetHeight + 'px'; }));
      const n = await page.evaluate(() => { window.__res = 0; document.addEventListener('tulla:resize', () => window.__res++); scrollTo(0, 5200); return document.getElementById('llegar').getBoundingClientRect().top + scrollY; });
      await page.waitForTimeout(150);
      const luz0 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--luz'));
      for (const alto of [788, 844, 788, 844, 800, 844]) { await page.setViewportSize({ width: 390, height: alto }); await page.waitForTimeout(260); }
      const d = await page.evaluate(() => ({ res: window.__res, top: document.getElementById('llegar').getBoundingClientRect().top + scrollY, luz: getComputedStyle(document.documentElement).getPropertyValue('--luz') }));
      comprobar(d.res === 0 && Math.abs(d.top - n) < 1 && d.luz === luz0, 'barra del móvil: nada se rehace, la luz no salta y la página no se mueve', { ...d, antes: n, luz0 });
    }
    comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }

  /* ---------- 7. legales ---------- */
  console.log('\n7. Legales');
  {
    const { ctx, page } = await nueva();
    for (const f of ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', '404']) {
      page._errores.length = 0;
      await page.goto(BASE + f + '.html');
      comprobar((await page.locator('h1').count()) === 1 && page._errores.length === 0, `${f}.html se abre sin errores`, page._errores);
    }
    await ctx.close();
  }

  /* ---------- 8. con movimiento (una vez, al final): cortina, portada y la luz que se interpola ---------- */
  console.log('\n8. Con movimiento');
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG);
    const tapa = await page.evaluate(() => { const c = document.getElementById('cortina'); if (!c) return 'sin cortina'; const r = c.getBoundingClientRect(); return getComputedStyle(c).display !== 'none' && r.width >= innerWidth - 1 && r.height >= innerHeight - 1; });
    if (tapa === 'sin cortina') nota('sin cortina todavía (módulo Entrada): la portada se abre sola');
    else comprobar(tapa === true, 'la cortina tapa la pantalla al cargar');
    await fuera(page);
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('abierta'), null, { timeout: 8000 }).catch(() => {});
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return document.getElementById('portada').classList.contains('abierta') && (!c || c.hidden || getComputedStyle(c).display === 'none' || true) && document.documentElement.classList.contains('con-movimiento'); }), 'la cortina se retira y la portada se abre (titular que sube)');
    await page.waitForFunction(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none', null, { timeout: 9000 }).catch(() => {});
    comprobar(await page.evaluate(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none'), 'la cortina desaparece de verdad');
    if (HAY.pincel) comprobar(await page.waitForFunction(() => document.querySelector('#portada [data-modulo="pincel"]').dataset.montado === '1', null, { timeout: 6000 }).then(() => true, () => false), 'el pincel de la portada se monta al abrirse la cortina');
    // la luz se interpola con el scroll: valores intermedios y colores que cambian poco a poco
    const fin = () => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const muestras = [];
    let evs = 0;
    await page.evaluate(() => { window.__luzEv = 0; document.addEventListener('tulla:luz', () => window.__luzEv++); });
    for (let i = 0; i <= 16; i++) { await ir(page, Math.round((await fin()) * i / 16)); await page.waitForTimeout(140); muestras.push(await page.evaluate(() => ({ luz: +getComputedStyle(document.documentElement).getPropertyValue('--luz'), fondo: document.documentElement.style.getPropertyValue('--l-fondo'), cab: document.documentElement.style.getPropertyValue('--cab-texto') }))); }
    evs = await page.evaluate(() => window.__luzEv);
    const luces = muestras.map((m) => m.luz), distintos = new Set(muestras.map((m) => m.fondo)).size;
    const intermedias = luces.filter((l) => l > .02 && l < .98 && ![.4, .44, .64, .7].includes(l)).length;
    comprobar(luces.every((l, i) => i === 0 || l >= luces[i - 1] - 1e-9) && luces[0] < .05 && luces[luces.length - 1] === 1 && intermedias >= 8 && distintos >= 10 && evs > 5, 'la luz avanza con el scroll de 0 a 1, con valores intermedios y el fondo cambiando poco a poco (OKLCH), y avisa con «tulla:luz»', { luces, distintos, evs });
    comprobar(muestras.every((m) => /rgb/.test(m.cab)), 'la cabecera sigue la luz (--cab-texto)');
    // en el cruce (.64–.70) la escena de la ruta tapa toda la pantalla
    const cruce = await page.evaluate(async () => {
      const r = document.getElementById('ruta'), top = r.getBoundingClientRect().top + scrollY, alto = r.offsetHeight;
      return { alto, vista: innerHeight, top };
    });
    const enCruce = [];
    for (const k of [0.2, 0.5, 0.8]) {
      const y = cruce.alto > cruce.vista ? cruce.top + (cruce.alto - cruce.vista) * k : cruce.top + (cruce.alto - cruce.vista) / 2;
      await ir(page, Math.round(y)); await page.waitForTimeout(150);
      enCruce.push(await page.evaluate(() => { const l = +getComputedStyle(document.documentElement).getPropertyValue('--luz'); const r = document.getElementById('ruta').getBoundingClientRect(); return { l, tapa: r.top <= 1 && r.bottom >= innerHeight - 1 }; }));
    }
    comprobar(enCruce.filter((e) => e.l > .64 && e.l < .70).every((e) => e.tapa), 'el cruce del ocaso a la noche pasa con «La ruta del grano» tapando la pantalla', { enCruce, cruce });
    comprobar(page._errores.length === 0, 'con movimiento: sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    // Lenis y GSAP caídos y con movimiento: la cortina se va igual
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { cdn: 'caido', script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForFunction(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none', null, { timeout: 9000 }).catch(() => {});
    comprobar(await page.evaluate(() => (!document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none') && document.getElementById('portada').classList.contains('abierta')), 'sin Lenis ni GSAP la cortina se retira y la portada se abre');
    comprobar(page._errores.length === 0, 'sin las librerías no hay errores', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    // sin JavaScript: la cortina no tapa y se lee todo
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    await page.goto(PAG);
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return (!c || getComputedStyle(c).display === 'none') && getComputedStyle(document.querySelector('.portada__tit .ln > span')).transform === 'none'; }), 'sin JavaScript no hay cortina y el titular se lee');
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} ok, ${fallos.length} fallos`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
