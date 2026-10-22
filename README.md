# A Casa da Tulla · Gomesende, Ourense · «La tulla»

Web nueva para A Casa da Tulla: una casa de granito de 1637, rehabilitada en 2008, que se alquila **entera** (hasta 9 personas, 4 dormitorios dobles con baño, uno adaptado) dentro de la aldea de Gomesende, con finca de unos 1.800 m², piscina mirando al valle y un asador aparte con horno de leña. Hoy tienen un WordPress flojo: es una propuesta que Álvaro les enseñará. En local, con `noindex, nofollow` en todas las páginas, sin publicar y sin commits.

- **Datos y fuentes:** `ref/DATOS-CASA-DA-TULLA.md`; fotos: `ref/FOTOS.md`. Lo que no está ahí no se afirma: va a `PENDIENTES.md` o sale como «supuesto» / «por confirmar».
- **Encargo:** `ENCARGO.md` (aprobado en el chat; cuatro agentes: Web, Entrada, Ruta y Árboles).
- **Una sola página** (`index.html`) más legales y 404. Solo castellano; los nombres propios como son (A Casa da Tulla, Gomesende, Castiñeiro, Figueira, Moreira, Nogueira). «Tulla», «ferrado» y «escá» se explican la primera vez.

## Concepto

En gallego, la **tulla** es el arcón grande donde se guarda el grano (RAG). La casa cuenta que en 1637 aquí se guardaba el grano de las rentas del monasterio de Celanova, y que por eso se llama así. **El grano es el hilo** (la cortina, el ferrado del pie, la ruta), **la portada es su logo pintado a pincel**, **la página entera va de la tarde a la noche** con el scroll, el entorno es **la ruta del grano** de la casa a Celanova en 3D y las habitaciones son **cuatro árboles** que crecen.

La historia se cuenta como la cuenta la casa, y la web dice que no conocemos un documento que la pruebe. El aire de libro de cuentas se usa solo para **datos verdaderos de hoy** (1637 · 2008 · 1.800 m² · 9 · 4 · 4).

### La página, de arriba abajo

| # | Sección | Quién | Qué lleva |
|---|---|---|---|
| — | **Cortina «El grano»** | Entrada | Granito oscuro, el canal de piedra, el grano que forma «1637» y una pincelada que lo barre (`partes/cortina.html`, `css/entrada.css`, `js/grano.js`). |
| 1 | **Portada «Pincel»** | Entrada + Web | El logo real pintado trazo a trazo; el trazo azul del río se hace la pincelada que contiene la casa **a la hora real de Gomesende**. Arrastrar pinta la casa a otra hora. Respaldo de la web: `ocaso-casa` en una pincelada de `clip-path`, el titular, «Ver fechas», teléfono y la línea «Ahora en Gomesende: 18:42 · el sol se pone a las 19:15» (después de la puesta, «el sol sale a las 08:54»: la escribe solo la web). |
| 2 | **«La tulla»** | Web | La palabra con su definición literal de la RAG, lo que cuenta la casa (1637, Celanova, el canal, las medidas, 2008), la foto `pila` sin decir que sea el canal, **las cuentas de hoy** (tabla con doble filete y cifras de estilo antiguo de IM Fell) y **las medidas**: el ferrado y la escá dibujados a línea. |
| — | *De un vistazo* | Web | Solo en la versión sobria: capacidad, dormitorios y camas, baños, adaptado, piscina, asador, mascotas, finca, distancias y registro. |
| 3 | **Cuatro árboles** | Árboles | El corte de la casa y los cuatro dormitorios con su árbol. Respaldo de la web: los cuatro cuartos con foto y texto y el contador «9 personas · 4 dormitorios dobles · 4 baños · uno adaptado · cuna». |
| 4 | **La casa por dentro** | Web | El salón comedor (`salon` con velo, nunca estirada), `salon-2`, `salon-3`, la cocina y un baño, todas a su tamaño real como mucho, y la lista de equipamiento. |
| 5 | **Fuera** (empieza el ocaso) | Web | Piscina, vistas, el asador con la cita de Ppm, porche, jardín, patio y entrada; y «el atardecer es expectacular» (Miguel) con `ocaso-valle` y `casa-reflejo`. |
| 6 | **La ruta del grano** | Ruta | El 3D del IGN de la casa a Celanova con el cielo de ahora y su plano 2D. Respaldo de la web: el plano (`img/terreno/plano.*`, lo pone `construir.mjs` si existe) y las distancias. **Aquí cruza la luz del ocaso a la noche.** |
| 7 | **Alrededor** (ya es de noche) | Web | Distancias de OSRM (frontera 14 km, Arnoia 19, Celanova 22, Prexigueiro 23, Melgaço 24, Ribadavia 27, Ourense 47, Vigo 82, Santiago 134), la iglesia de la aldea, el monte en otoño, las ovejas, el santuario da Guía, la PR-G 143 y dónde comer en Celanova. |
| 8 | **Y cuando se hace de noche** | Web | `noche-piscina` y `noche`. |
| 9 | **Lo que dicen** | Web | «Casa impresionante!» y cinco citas literales con nombre de pila, mes y año; «Excelente» en Google con enlace a la ficha, **sin recuento**. |
| 10 | **Reservar** | Web | El motor de casa entera (`js/reserva.js`), de DEMOSTRACIÓN. |
| 11 | **Cómo llegar** | Web | Gomesende, 47 · 32212 Gomesende, «dentro de la aldea», teléfonos, correo y el mapa de Google solo al pedirlo. |
| 12 | **Pie: el ferrado colmado** | Entrada + Web | El ferrado que se llena de grano con la lectura (módulo `ferrado` de `js/grano.js`), con estrellas finas al final. Respaldo de la web: el ferrado lleno en SVG. Registro TR-OR-000096 y legales. |

**§5 bis:** fuera la pila sticky de tarjetas y el marquee (lo propio es el grano y la luz); gesto táctil del hero (pintar otra hora, módulo Pincel); el objeto que se completa en el pie (el ferrado); **foco del teclado con forma propia**: contorno de 2 px (tinta de tarde y ocaso, farol de noche) y un trazo de pincel corto debajo del elemento (`#foco-pincel`, lo coloca `main.js`); LCP medido abajo. Sin cursor propio.

## La luz: de la tarde a la noche

`js/main.js` calcula `--luz` (0 → 1) con la posición del centro de la pantalla entre las anclas de las secciones (`data-luz` en cada sección: portada 0, la tulla .06, árboles .16, dentro .30, fuera .42, alrededor .72, de noche .80, opiniones .84, reservar .90, llegar .95, pie 1). Pone en `<html>` la clase `luz-dia|luz-ocaso|luz-noche` y lanza `tulla:luz` con `{ luz, tramo }` en `document`.

- **Versión «Tulla» con movimiento:** los colores se interpolan **en OKLCH** entre seis fotogramas clave (cal → granito claro → paja → ámbar → granito de noche → noche honda) y se escriben en `:root` como `--l-fondo`, `--l-texto`, `--l-texto-2`, `--l-acento`, `--l-linea`, `--l-btn-f`, `--l-btn-t` y `--l-foco`. **El cruce del ocaso a la noche (.64 → .70) pasa solo mientras «La ruta del grano» tapa toda la pantalla** (su ancla es doble: `data-luz-cruce`), y el texto cambia de golpe en .67, así que nunca hay texto sobre un fondo a medio camino. `verificar.mjs` mide el contraste en 190 puntos de 0 a 1 (fuera del cruce): mínimo 4,87:1.
- **Sobria, movimiento reducido y sin JS:** cada sección se pinta con su tramo fijo (`data-tramo="tarde|ocaso|noche"`, variables `--t-*` en `css/estilos.css`), sin interpolar.
- **La cabecera** sigue la luz con `--cab-fondo` y `--cab-texto`, pero nunca toma un color del cruce: o clara o de noche. De noche, el logo va sobre una etiqueta de cal (el logo no se toca).
- **El `resize` de la barra del móvil no rehace nada** (ni la luz salta: las anclas usan `altoVista`, no `innerHeight`).

### Paleta y letras

| Token | Color | Uso |
|---|---|---|
| `--cal` / `--cal-2` / `--blanco` | `#F3EEE4` / `#EAE2D3` / `#FBF8F2` | papel de la tarde, el motor |
| `--granito` / `--granito-2` | `#BFB6A6` / `#A89E8C` | fondo de la foto mientras carga |
| `--tinta` / `--tinta-2` | `#2B2620` / `#5B5047` | texto (nunca negro puro) |
| `--paja` | `#D9B46A` | el grano, el colmo del ferrado |
| `--ocaso` / `--ocaso-texto` | `#C8693A` / `color-mix(ocaso 48 %, tinta)` = `#764629` | la piedra encendida; el acento del ocaso |
| `--noche` / `--noche-2` | `#1C1F24` / `#2A2E33` | granito de noche, la ruta |
| `--farol` / `--niebla` | `#F2C46D` / `#C4BBAE` | acento y texto secundario de noche |
| `--verde` / `--verde-texto` | `#6B8F08` (el del logo) / `color-mix(verde 58 %, tinta)` = `#506312` | acento de la tarde y botones |
| `--rio` | `#09A3DF` (el del logo) | **solo** el trazo del río y la piscina, nunca botones |

**Letras** (Google Fonts, `display=swap`): **IM Fell English** (titulares, «tulla», cifras del libro; con cursiva), **Commissioner** 400–600 (texto) y **Spline Sans Mono** (horas, distancias, rótulos).

## El sol (`Tulla.sol`)

`window.Tulla.sol(fecha)` → `{ altura, salida, puesta, fase: 'dia'|'dorada'|'noche' }` con las fórmulas de SunCalc en el punto de Google de la casa (42.1639316, −8.105519); las horas se formatean en Europe/Madrid. Fase: día con el sol a más de 6°, dorada entre 6° y −6° (hora dorada, ocaso y crepúsculo), noche por debajo. `Tulla.hora()` es la hora de ahora o la de **`?hora=2026-10-22T19:30`** (hora de Madrid si no lleva zona). Comprobado a mano para el 22-10-2026: mediodía solar 14:17, sale a las 8:53 y se pone a las 19:42.

## Cómo se trabaja

- **Edita siempre los `*.src.html` o las `partes/`** (cabeza, cabecera, reserva, llegar, pie y guiones; la cortina es de Entrada). `node construir.mjs` incluye las partes (`<!--parte:…-->`), convierte `<img data-foto>` en `<picture>` AVIF/WebP/JPG, pone el plano de la ruta en `<!--plano-ruta-->` si existe, **quita los `<link>`/`<script>` propios que aún no existan** (con aviso) y pone `?v=<huella>` (`versionar.mjs`, también a `js/3d/arranque.js`). Recuerda «Ctrl+F5» si se publica.
- **Fotos:** `scripts/fotos-lista.json` + `node scripts/fotos.mjs` (o `node scripts/fotos.mjs dia noche` para unas pocas). Lee de `ref/fotos/web` y `ref/fotos/escapadarural` (las de casasrurales.net llevan marca de agua: fuera). Gradación común (menos saturación, negros más suaves, un punto cálidas; las de dentro, medio balance de blancos); `fuerza` baja en las del ocaso y la noche para no apagar la piedra encendida. **Nunca amplía**; las `*-800x600-1` de su web (ampliadas, unos 650 px reales) salen como mucho a 1024. `ocaso-casa` es `A-casa-da-Tulla_12` **recortada sin las cuatro personas** (`left 356`). No se enderezaron verticales: las fachadas no lo pedían.
- **Marca:** `node scripts/marca.mjs` → el logo real reducido (`marca/logo-240.png`, `logo-480.png`), el dibujo sin el texto para los iconos (`marca/simbolo.png`: se borra la caja del texto, no se toca un trazo), favicons, icono e `img/og.jpg`.
- **Legales y 404:** `node scripts/legales.mjs` y después `node construir.mjs`.
- **`node verificar.mjs`** (puerto 8851, una vez al terminar; sin capturas; navegador con `--disable-3d-apis` y la página con `?sin-3d`: el WebGL no se pinta). Ver el resultado abajo.
- **`node scripts/rendimiento.mjs`** (puerto 8852): móvil de gama media (Pixel 7, 4G lento, CPU ×4), sin WebGL.
- **`node scripts/probar-borrado-mando.mjs`**: comprueba la receta de borrado del mando.

## Contrato con los módulos

- `window.Tulla.<mod>.montar(el, { movimiento, densidad: 'tulla'|'sobria', hora })` → `{ destruir() }`; el HTML de `el` es el respaldo. `main.js` monta **árboles, ruta y ferrado al acercarse** (900 px de margen) y **el pincel en `Tulla.alAbrirse`**. Si el JS de un módulo aún no ha llegado (el 3D es un módulo diferido), lo vuelve a intentar al `load`, con `tulla:listo` y con el scroll. Guarda cada respaldo: al cambiar de densidad, `destruir()`, devuelve el respaldo y vuelve a montar.
- **Ferrado:** `Tulla.grano.ferrado(el, op)` (o `Tulla.ferrado.montar`) en `[data-modulo="ferrado"]`, con `op.tipo = 'ferrado'`.
- **Ruta:** con `?sin-3d`, `op.gl = false` y `op.sin3d = true`.
- **La cortina** la arranca sola `js/grano.js`. El puente está en `partes/cabeza.html`, desde el primer momento: `Tulla.alAbrirse(fn)`, `Tulla.abrir()`, `Tulla.retirarCortina()`, y escucha `tulla:cortina-abre` / `tulla:cortina-fuera` (los que lanza `Tulla.cortina` de Entrada); la web avisa a su vez con `tulla:abierta` y `tulla:fuera` y pone `Tulla.cortinaFuera`. Redes de seguridad: 6,5 s en la cabeza, 7 s en `main.js` y las de la propia cortina.
- `Tulla.reservar()` baja al simulador; `Tulla.sol`, `Tulla.hora`, `Tulla.luz()`, `Tulla.colores(l)` y `Tulla.web` (lenis, irA, motion, sobria…) para quien los quiera.

## Reservar (DEMOSTRACIÓN)

Pasos: fechas → personas (1 a 9, + cuna) → datos → confirmación con localizador `TUL-AAMMDD-NNN`. Calendario de 12 meses, dos a la vista. **No envía, guarda ni cobra nada, y lo dice** (encima del motor, junto al botón y en la confirmación). **Supuestos:** 28 € por persona y noche en temporada baja y 32 € en alta (las fichas dan de 26 a 31 €); temporada alta = Semana Santa (de Domingo de Ramos a Pascua), puentes y festivos nacionales, julio y agosto; mínimo 2 noches; la cuna sin coste; **sin señal** (no consta); ocupación inventada (siempre la misma por año). Cancelación sin coste hasta 30 días antes (su ficha de casasrurales.net); mascotas «se admiten, avisando» (por confirmar); las horas de entrada y salida se acuerdan.

## Mando de densidades (solo con `?revision`)

- **«Tulla»:** el grano de la cortina, las pinceladas, la luz que cambia con el scroll, los árboles que crecen y el ferrado que se llena.
- **«Sobria»:** la luz fija por tramos sin interpolar, los trazos ya pintados, los árboles ya crecidos, el ferrado ya lleno; **añade** la tabla «A Casa da Tulla, de un vistazo».

### Receta de borrado del mando

1. En `partes/cabeza.html`, en el script, el `try { … }` de `// MANDO DE MAQUETA`.
2. En `partes/pie.html`, el bloque `<!-- MANDO DE MAQUETA` … `<!-- fin del MANDO DE MAQUETA -->`.
3. En `js/main.js`, el bloque `13. MANDO DE MAQUETA` hasta `fin del MANDO DE MAQUETA`.
4. Opcional: `.mando` y `.vistazo` en `css/estilos.css` y la sección `#vistazo` de `index.src.html`.
5. `node construir.mjs`. (`node scripts/probar-borrado-mando.mjs` lo comprueba en memoria: pasa.)

## Comprobaciones

- **`verificar.mjs`:** archivos, noindex, ids, fotos (sin marca de agua, sin personas, nunca ampliadas), textos prohibidos (recuento de reseñas y «4,7», superlativos, WhatsApp, wifi, desayunos y cenas, «cocina de leña», «aislada», Pablo, VUT, Taberna de Reposo, fotos de terceros), la definición literal de la RAG, la historia como la cuenta la casa, CSS de cookies/mando/menú/dvh/cortina, el sol (salida y puesta del 22-10-2026, fases, `?hora=`), la luz por tramos y el contraste (57 parejas en los tres tramos + 190 puntos de la luz interpolada), el foco (2 px y el trazo de pincel; farol de noche), módulos (montan al acercarse; sin sus JS queda cada respaldo), motor de punta a punta, visor por nombre (las 27 miniaturas, flechas, Escape, tocar en móvil), cookies en 4 pasos, mando y sobria, móvil a 360/375/390/768 (sin scroll lateral, foto arriba, menú con la cabecera fija, barra del navegador sin rehacer nada ni mover la luz), legales y, al final y con movimiento, la cortina, el pincel montado al abrirse, la luz que avanza con valores intermedios en OKLCH, el cruce con la ruta tapando la pantalla, sin Lenis ni GSAP y sin JavaScript.
- **Resultado (2026-10-22, con los cuatro módulos ya puestos y la portada en caja 1000/995 · 1000/1300): 145/145.**
- **`scripts/rendimiento.mjs`** (Pixel 7, 4G lento, CPU ×4, sin WebGL): **LCP 1,76–1,88 s**; en dos de tres pasadas el LCP es la propia foto `ocaso-casa-1264.avif` (el módulo Pincel la tapa solo con `opacity` mientras pinta y luego pone `dia` o `noche` según la hora), en la otra el titular. ~733 KB, 23 peticiones (sin las letras de Google). Ojo: en dos pasadas la cortina tardó ~5,7 s en irse, con una tira de tareas largas de 50–140 ms mientras cae el grano (CPU ×4); en la otra, 3,3 s.

## Qué mirar en Chrome

- **La luz:** bajar despacio de la portada al pie. Que el paso de la tarde al ocaso (al llegar a «Fuera») se note sin saltos, y que el de la noche ocurra **dentro** de «La ruta del grano», con la escena tapando. Que la cabecera cambie con ella y que de noche el logo vaya en su etiqueta de cal.
- **La portada** sin el módulo (por ejemplo con el JS del pincel bloqueado): la pincelada de `clip-path` y el titular; con el módulo, cómo encaja el marco de pincel en la columna.
- **«La tulla»:** el diccionario, las cuentas de hoy (doble filete, cifras de estilo antiguo de IM Fell) y los dos dibujos de las medidas.
- **El foco del teclado** (Tab): el contorno de 2 px y el trazo de pincel debajo, en los tres tramos.
- **Las fotos de dentro**, pequeñas y corregidas de color: si alguna se ve rara (el salón va con velo).
- **El mando** con `?revision`: las dos versiones; la sobria con la luz por tramos.
- **La cortina, la portada y el ferrado** en el banco de Entrada: `node pruebas/entrada-probar.mjs --servir` y `http://localhost:8853/pruebas/entrada-demo.html?hora=2026-10-22T19:15` (y `T13:00`, `T19:55`, `T23:00`, más `&densidad=sobria`). Los mismos `?hora=` valen sobre `index.html`. En el móvil la portada es una caja vertical (1000/1300) para el diseño alto del pincel; en escritorio, 1000/995.
- **El 3D de «La ruta del grano»** en su banco de pruebas: `pruebas/3d-banco.html` (y sus variantes `?hora=2026-10-22T21:30`, `?reducido`, `?sobria`, `?sin-3d`); detalles en `js/3d/LEEME.md`.
- **`?hora=`** con varias horas (`2026-10-22T13:00`, `…T19:30`, `…T23:00`): la línea «Ahora en Gomesende…» y la foto de la portada.

## Para publicar

Repo propio y GitHub Pages sobre la rama real (como las anteriores). Antes, `PENDIENTES.md` (capacidad, registro, Moreira/Nogueira, habitación adaptada, el canal, las medidas, tarifas…) y la receta de borrado del mando si se entrega. Quitar el `noindex` solo si se vende.
