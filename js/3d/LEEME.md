# «La ruta del grano» · el 3D de A Casa da Tulla

Una sola sección: `#ruta`, en la zona del entorno (nunca de portada). Con el scroll, **un hilo de granos dorados recorre el camino de hoy por carretera** de la casa al monasterio de San Salvador de Celanova (la ruta de OSRM, 21,8 km, pegada al relieve) y la cámara lo acompaña: la casa de cerca → el viaje (mirando siempre hacia el norte, girando poco) → el monasterio, con su rótulo «Monasterio de San Salvador de Celanova · 22 km por carretera hoy» → todo el valle con los rótulos de alrededor (la frontera en Ponte Barxas, y «hacia» Ribadavia, las termas de Prexigueiro y Melgaço, con sus km de `DATOS`). Después, el explorador libre. El cielo es el de ahora en Gomesende (sol y luna reales, estrellas de noche); de noche el grano luce como un farol. Relieve MDT05 y ortofoto PNOA del IGN (CC BY 4.0), altura ×1,6.

Texto honesto en el cuaderno: «El camino de hoy por carretera; el de 1637 no lo conocemos.»

Parte de `../casa-o-pontillon-cortegada-web/js/3d/` (motor, cielo, calidad automática, póster) **sin su vuelo por el río ni su agua**: aquí no hay tiempo propio, todo lo mueve el scroll.

## Ficheros

| Fichero | Qué hace |
|---|---|
| `arranque.js` | Lo único que carga la web. Pone `window.Tulla.ruta.montar(el, opciones)` y lanza `tulla:listo`. Al montar: la pista fijada, el cuaderno, los botones, el progreso del scroll y la elección 3D / plano. Lleva `VERSION`. |
| `guion.js` | Sin Three.js. `fase(p)` (del scroll a qué se ve), el cuaderno (km, tramo, altura, perfil), el itinerario en texto y los rótulos (sin choques, dentro del marco). |
| `plano.js` | Sin WebGL. El plano 2D: relieve sombreado + ortofoto, y en SVG el hilo de granos que avanza con el scroll y una «cámara» (el `viewBox`) que lo acompaña igual que el 3D. Es el plan B y el botón «En plano». |
| `sol.js` | Sol y luna (SunCalc) en la casa, hora de Madrid, el chip «Ahora en Gomesende · …». Acepta `?hora=` (como la portada) o `?ahora3d=`, y `opciones.hora`. |
| `escena.js` | El motor: un renderer, relieve con cantos, la casa y el monasterio de cerca (parches a 0,35 m/px), cúpula de cielo, estrellas, sombras, las dos agujas, calidad automática, proyección a pantalla. |
| `camino.js` | La cinta de grano (shader propio: textura de granos que se revela hasta la «cabeza»), los 90 granos que caen en la cabeza, el brillo, las poses de cámara mezcladas por la fase, el encuadre de todo el valle y el explorador (OrbitControls). |
| `vendor/` | Three.js r160 y `OrbitControls.js` (copiados de Pontillón). |
| `../../css/3d.css` | Todo lo que mete el módulo, bajo `[data-modulo="ruta"]`. |
| `../../scripts/terreno.py` | Descarga (una vez) y prepara `img/terreno/`. |
| `../../pruebas/3d-*` | Banco, prueba sin pintar WebGL y póster. |

## Contrato con la web

**Marcado** (ya está así en `index.src.html`; solo falta la imagen del plano en el hueco `<!--plano-ruta-->`):

```html
<section id="ruta" class="ruta" data-tramo="noche" aria-labelledby="t-ruta">
  <div class="env ruta__cab">…eyebrow, <h2 id="t-ruta">, texto…</div>
  <div class="ruta__modulo" data-modulo="ruta">
    <div class="modulo__respaldo ruta__respaldo">
      <picture>
        <source type="image/webp" srcset="img/terreno/plano.webp">
        <img class="ruta__plano" src="img/terreno/plano.jpg" width="1800" height="852" loading="lazy" decoding="async"
             alt="El camino de hoy por carretera de A Casa da Tulla, en Gomesende, al monasterio de San Salvador de Celanova, en dorado sobre el relieve y la foto aérea: sube al norte y va hacia el este, unos 22 km.">
      </picture>
      <ul class="ruta__lista">…las distancias…</ul>
      <p class="ruta__fuente">Relieve y ortofoto: Instituto Geográfico Nacional (CC BY 4.0). Rutas: OpenStreetMap.</p>
    </div>
  </div>
</section>
```

- `css/3d.css` en el `<head>`; al final del `<body>`: `<script type="module" src="js/3d/arranque.js"></script>` (con la huella de `versionar.mjs`).
- `main.js` ya lo monta bien: al acercarse (900 px), con `{ movimiento, densidad, hora, gl:false si ?sin-3d }`; si el módulo aún no estaba, reintenta con `tulla:listo`. `montar` es idempotente (dos llamadas devuelven la misma instancia) y `destruir()` deja el respaldo como estaba (para el mando de densidades).
- Al montar, el módulo mete **delante** del respaldo `.ruta-pista` (alto = la pantalla + 320svh; quieta, solo el marco) y esconde la imagen `.ruta__plano` (su `<picture>`); la lista y la fuente se quedan debajo. Llama a `ScrollTrigger.refresh()` si existe.
- **Sticky:** `.ruta-fijo` es `position: sticky; top: var(--cab)`. Ningún antepasado (`.ruta`, `.ruta__modulo`, `main`…) puede llevar `overflow: hidden/auto` ni `transform`. `overflow: clip` sí vale. El marco ocupa todo el ancho (sin el padding de `.env`).
- Lee de la web: `--cab`, `--lado`, `--noche`, `--cal`, `--niebla`, `--paja`, `--farol`, `--verde`, `--verde-texto`, `--tinta`, `--f-tit`, `--f-txt`, `--f-mono` (con respaldo si faltan). Espera la cortina (`Tulla.cortinaFuera`, `#cortina[hidden]` o `tulla:fuera`; 6 s de red) antes de crear el motor.
- Ids propios: `ruta-marco`, `ruta-lienzo`, `ruta-rotulos`, `ruta-plano`, `ruta-chip`, `ruta-carga`, `ruta-3d`, `ruta-2d`, `ruta-mover`, `ruta-volver`, `ruta-cuaderno`, `ruta-itinerario`, `ruta-poster`.
- Clases que pone en `#ruta-marco`: `con-3d` (primer fotograma), `sin-3d`, `en-plano`, `libre` (explorador), `mapa-suelto` (táctil). Eventos: `tulla:listo` (al cargar `arranque.js`) y `tulla:ruta-lista` (primer fotograma del 3D).
- Para las pruebas: `window.TULLA_3D` = `{ estado: 'montando'|'cargando'|'listo'|'plano'|'sin-3d'|'respaldo', motivo, vista: '3d'|'plano', progreso, quieto, motor, camino, plano }`.

## Cómo se comporta

- **Con movimiento y densidad «Tulla»:** la pista se fija y el scroll es el camino (0–6 % la casa de cerca, 6–84 % el viaje, 84–92 % el monasterio, 92–100 % todo el valle). El cuaderno (abajo a la izquierda; abajo a lo ancho en el móvil) lleva los km, el tramo (OU-0212, aldeas de Gomesende, OU-531, Ramirás, Celanova), la altura real y el perfil.
- **Movimiento reducido o «sobria»:** no se fija; el marco se queda quieto con el camino entero y la vista de todo, y el explorador.
- **Explorador:** arrastrar con el ratón suelta el mapa (gira; botón derecho mueve); Ctrl + rueda o el pellizco del trackpad acercan (la rueda sola sigue siendo el scroll de la página); en táctil, «Mover el mapa» (y dos dedos acercan); teclado en el lienzo: flechas, + y −, Escape. «Volver al camino» lo devuelve al scroll. El hilo sigue al scroll también en el explorador.
- **Plano:** sin WebGL2, con ahorro de datos, con `?sin-3d` (u `opciones.gl === false`) o con el botón «En plano». Mismo guion, mismos rótulos, en 2D.

## Cómo se regenera

```
python -I scripts/terreno.py     # descarga a pruebas/3d-fuente/ (si falta) y genera img/terreno/
node pruebas/3d-poster.mjs        # poster-ruta-1600 y poster-ruta-movil-720 (pinta WebGL: una vez, escala 1)
node pruebas/3d-probar.mjs        # la prueba sin pintar WebGL
```
Después, **subir `VERSION` en `arranque.js`**. `pruebas/3d-fuente/` (MDT de 25 MB, ortofotos, la ruta de OSRM) no se publica: va al `.gitignore`.

La ortofoto del PNOA trae dos vuelos con un corte en la columna 2726 de 4096 (el este, más oscuro y azulado): `terreno.py` lo busca y lo iguala con un fundido de ≈750 m; aun así se nota algo el cambio de estación.

## Rendimiento

- Nada pesado antes de `load` + un rato libre + la cortina. `arranque.js` pesa 9 KB; `guion.js`, `sol.js` y `terreno.json` (34 KB), al montar; Three.js (166 KB gzip) y los datos, solo con WebGL2.
- Móvil (`pointer: coarse` o pantalla < 700 px): malla 384×182, ortofoto 2048 (276 KB WebP), parches 1024 (205 + 168 KB), sombras 1024, densidad ≤ 1,5, sin antialias. Escritorio: 576×273, 4096 (1,1 MB), 1536 (477 + 355 KB), sombras 2048, densidad ≤ 1,75.
- Pinta solo si se ve y algo se mueve (el scroll amortiguado, el explorador, la vuelta); fuera de pantalla, con la pestaña oculta o en plano, nada. La luz se rehace cada minuto.
- Calidad automática (media de 45 fotogramas > 30 ms): densidad −0,25 hasta 1 → sin sombras → densidad 0,75.
- La barra del móvil no rehace el búfer (cambio de alto < 160 px).

## No probado

El 3D no se ha probado pintándolo salvo el póster (una pasada con WebGL por software). Lo mira Álvaro en su Chrome y en un móvil real: la fluidez, que la cinta no se hunda en laderas muy empinadas, el tamaño de los granos de lejos, la noche.
