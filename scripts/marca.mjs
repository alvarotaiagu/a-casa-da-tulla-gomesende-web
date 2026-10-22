/* La marca de A Casa da Tulla: su logo real (ref/marca/LOGO_A_CASA_DA_TULLA-1.png, 1058×462, con
   transparencia). NO se redibuja: solo se reduce y, para los iconos, se toma el dibujo (la casa, el
   tejado y el río) quitando el texto, sin tocar un trazo.
   Uso: node scripts/marca.mjs → marca/logo-240.png, logo-480.png (cabecera y pie), marca/simbolo.png,
   favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png e img/og.jpg (1200×630).
   Necesita antes img/fotos/ (scripts/fotos.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = path.join(RAIZ, 'ref/marca/LOGO_A_CASA_DA_TULLA-1.png');
const CAL = '#F3EEE4', TINTA = '#2B2620';
fs.mkdirSync(path.join(RAIZ, 'marca'), { recursive: true });
fs.mkdirSync(path.join(RAIZ, 'img'), { recursive: true });

// 1. el logo entero, reducido (cabecera a 120 px y pie a 140 px de ancho, en 1x y 2x)
for (const w of [240, 480]) await sharp(LOGO).resize({ width: w, kernel: 'lanczos3' }).png({ compressionLevel: 9, palette: false }).toFile(path.join(RAIZ, `marca/logo-${w}.png`));

// 2. el dibujo sin el texto: se borran (alfa 0) la caja de «A Casa da Tulla» y la de «Casa de Turismo rural»;
//    la casa, el tejado y el río quedan como son
const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const texto = (x >= 445 && y >= 250 && y <= 338) || (x >= 748 && y >= 338);
  if (texto) data[(y * W + x) * 4 + 3] = 0;
}
const sinTexto = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
const simbolo = await sharp(sinTexto).trim({ threshold: 1 }).png().toBuffer();
fs.writeFileSync(path.join(RAIZ, 'marca/simbolo.png'), simbolo);
const meta = await sharp(simbolo).metadata();

// un icono cuadrado: el dibujo centrado sobre cal
async function icono(tam, radio = 0) {
  const marco = Math.round(tam * 0.08), ancho = tam - 2 * marco;
  const dib = await sharp(simbolo).resize({ width: ancho, height: ancho, fit: 'inside', kernel: 'lanczos3' }).toBuffer();
  const m = await sharp(dib).metadata();
  const fondo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}"><rect width="${tam}" height="${tam}" rx="${radio}" fill="${CAL}"/></svg>`);
  return sharp(fondo).composite([{ input: dib, left: Math.round((tam - m.width) / 2), top: Math.round((tam - m.height) / 2) }]).png().toBuffer();
}
await sharp(await icono(64, 12)).resize(32, 32).png().toFile(path.join(RAIZ, 'marca/favicon-32.png'));
await sharp(await icono(180)).png().toFile(path.join(RAIZ, 'marca/apple-touch-icon.png'));
await sharp(await icono(512)).png().toFile(path.join(RAIZ, 'marca/icono-512.png'));
// favicon.svg: el mismo icono (PNG dentro de un SVG, para no redibujar el logo en vectores)
const b64 = (await icono(96, 18)).toString('base64');
fs.writeFileSync(path.join(RAIZ, 'marca/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,${b64}"/></svg>\n`);

// 3. og:image 1200×630: el logo sobre cal a la izquierda y la casa al ocaso, en su pincelada, a la derecha
const logoOg = await sharp(LOGO).resize({ width: 560 }).toBuffer();
const lm = await sharp(logoOg).metadata();
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${CAL}"/>
  <text x="62" y="430" font-family="Georgia, serif" font-size="40" fill="${TINTA}">Una casa de granito de 1637</text>
  <text x="62" y="478" font-family="Georgia, serif" font-size="40" font-style="italic" fill="#764629">que guardaba el grano</text>
  <text x="62" y="540" font-family="Consolas, monospace" font-size="17" letter-spacing="2.5" fill="#5B5047">CASA ENTERA PARA NUEVE · GOMESENDE</text>
</svg>`;
const foto = await sharp(path.join(RAIZ, 'img/fotos/ocaso-casa-800.jpg')).resize(520, 560, { fit: 'cover', position: 'centre' }).toBuffer();
// la pincelada (semilla fija): bordes deshilachados
let s = 1637; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const P = [];
for (let i = 0; i <= 20; i++) P.push([10 + i * 500 / 20, 6 + r() * 10]);
for (let i = 1; i < 24; i++) P.push([514 - (r() < .3 ? 10 + r() * 16 : r() * 8), i * 560 / 24]);
for (let i = 20; i >= 0; i--) P.push([10 + i * 500 / 20, 552 - r() * 14]);
for (let i = 23; i > 0; i--) P.push([4 + (r() < .35 ? 12 + r() * 22 : r() * 8), i * 560 / 24]);
const mascara = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="520" height="560"><polygon points="${P.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="#fff"/></svg>`);
const fotoRecortada = await sharp(foto).ensureAlpha().composite([{ input: mascara, blend: 'dest-in' }]).png().toBuffer();
await sharp(Buffer.from(og)).composite([
  { input: logoOg, left: 48, top: 60 },
  { input: fotoRecortada, left: 650, top: 35 },
]).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log(`marca/ (logo ${lm.width}×${lm.height} en el og, símbolo ${meta.width}×${meta.height}) e img/og.jpg listos`);
