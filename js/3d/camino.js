// La ruta del grano en 3D: con el scroll, un hilo de granos dorados recorre el camino de hoy por carretera
// (OSRM, de la casa al monasterio de Celanova), pegado al relieve, y la cámara lo acompaña sin marear:
// la casa de cerca → el viaje (siempre mirando hacia el norte, girando poco) → el monasterio → todo el valle.
// Después, el explorador libre (OrbitControls; en táctil, tras «Mover el mapa») con los rótulos de alrededor.
// No es el vuelo por el río de Pontillón: aquí no hay vuelo con tiempo propio, todo lo mueve el scroll.
import { OrbitControls } from './vendor/OrbitControls.js';
import { fase, enCamino, clamp, suave, crearRotulos, listaRotulos, opRotulo } from './guion.js';

const $ = id => document.getElementById(id);
const TACTIL = matchMedia('(pointer: coarse)').matches;
const mezcla = (a, b, k) => a + (b - a) * k;
const mezclaAng = (a, b, k) => a + ((((b - a) % 360) + 540) % 360 - 180) * k;
const VIAJE = 1200;   // ms de la vuelta al camino

// el grano: una textura de granos en gris sobre una banda tenue (la tiñe uColor; con mipmaps, de lejos es una línea dorada)
function texturaGrano(THREE) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(0, 22, 128, 20);
  let s = 5; const az = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const [gx, gy, rot] of [[18, 26, -.25], [52, 38, .3], [86, 27, .12], [114, 40, -.35], [36, 46, .05], [100, 18, .4]]) {
    x.save(); x.translate(gx, gy); x.rotate(rot + (az() - .5) * .2);
    const g = x.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#e6e6e6'); g.addColorStop(1, '#8c8c8c');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 15, 6.5, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(70,70,70,.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-11, 0); x.lineTo(11, 0); x.stroke();
    x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function texturaBrillo(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(.25, 'rgba(242,196,109,.55)'); g.addColorStop(1, 'rgba(242,196,109,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const cintaVert = `attribute float aS; attribute float aLado; attribute vec2 aNorm;
uniform float uAncho; varying vec2 vUv; varying float vS;
#include <fog_pars_vertex>
void main(){ vec3 p = position + vec3(aNorm.x, 0., aNorm.y) * aLado * uAncho; p.y += uAncho * .35;
  vUv = vec2(aS / (uAncho * 2.6), aLado * .5 + .5); vS = aS;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const cintaFrag = `uniform sampler2D uMapa; uniform vec3 uColor; uniform float uCabeza, uOpacidad;
varying vec2 vUv; varying float vS;
#include <fog_pars_fragment>
void main(){ if (vS > uCabeza) discard;
  vec4 t = texture2D(uMapa, vUv);
  float brillo = 1. + .6 * smoothstep(60., 0., uCabeza - vS);   // los últimos metros, recién caídos, brillan más
  gl_FragColor = vec4(t.rgb * uColor * brillo, t.a * uOpacidad);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function montarCamino(motor, { movimiento, quieto, alPrimerFotograma }) {
  const { THREE, D, AG } = motor, { EX, W, H, L, R, T, suelo } = D;
  const marco = $('ruta-marco'), caja = $('ruta-lienzo'), capa = $('ruta-rotulos');
  const bMover = $('ruta-mover'), bVolver = $('ruta-volver');
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const camara = new THREE.PerspectiveCamera(42, 16 / 10, 20, 90000);
  const n = R.x.length, PASO = R.paso, LARGO = (n - 1) * PASO;
  const sup = (x, z) => suelo(x, z) * EX;

  // ---------- el camino suavizado (≈720 m) para la cámara: sin tirones en las curvas ----------
  const CX = new Float32Array(n), CZ = new Float32Array(n), CY = new Float32Array(n);
  {
    const Vn = 60, pesos = []; for (let j = -Vn; j <= Vn; j++) pesos.push(Math.exp(-(j * j) / (2 * (Vn / 2.2) ** 2)));
    for (let i = 0; i < n; i++) {
      let sx = 0, sz = 0, sy = 0, sw = 0;
      for (let j = -Vn; j <= Vn; j++) { const k = Math.min(n - 1, Math.max(0, i + j)), w = pesos[j + Vn]; sx += R.x[k] * w; sz += R.z[k] * w; sy += sup(R.x[k], R.z[k]) * w; sw += w; }
      CX[i] = sx / sw; CZ[i] = sz / sw; CY[i] = sy / sw;
    }
  }
  const enSuave = f => { const i = clamp(f) * (n - 1), a = Math.floor(i), b = Math.min(n - 1, a + 1), k = i - a; return V3(mezcla(CX[a], CX[b], k), mezcla(CY[a], CY[b], k), mezcla(CZ[a], CZ[b], k)); };

  // ---------- la cinta de grano ----------
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3), aS = new Float32Array(n * 2), aLado = new Float32Array(n * 2), aNorm = new Float32Array(n * 2 * 2), ix = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let tx = R.x[b] - R.x[a], tz = R.z[b] - R.z[a]; const m = Math.hypot(tx, tz) || 1; tx /= m; tz /= m;
    const y = sup(R.x[i], R.z[i]) + 2.5;
    for (let l = 0; l < 2; l++) {
      const v = i * 2 + l;
      pos.set([R.x[i], y, R.z[i]], v * 3); aS[v] = i * PASO; aLado[v] = l ? -1 : 1; aNorm.set([-tz, tx], v * 2);
    }
    if (i < n - 1) { const v = i * 2; ix.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  geo.setAttribute('aLado', new THREE.BufferAttribute(aLado, 1)); geo.setAttribute('aNorm', new THREE.BufferAttribute(aNorm, 2)); geo.setIndex(ix);
  geo.computeBoundingSphere(); geo.boundingSphere.radius += 200;
  const PAJA = new THREE.Color('#D9B46A'), FAROL = new THREE.Color('#F2C46D');
  const uCinta = { uMapa: { value: texturaGrano(THREE) }, uColor: { value: PAJA.clone() }, uCabeza: { value: 0 }, uOpacidad: { value: 1 }, uAncho: { value: 8 },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) };
  const cinta = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: uCinta, vertexShader: cintaVert, fragmentShader: cintaFrag, transparent: true, depthWrite: false,
    toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  cinta.renderOrder = 3; motor.escena.add(cinta);

  // ---------- los granos que caen en la cabeza del hilo (90, cada 5 m, reutilizados) ----------
  const NG = 90, SG = 5;
  const granos = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: '#e2bb6a', roughness: .45, metalness: 0, emissive: '#7a5a22', emissiveIntensity: .25 }), NG);
  granos.instanceMatrix.setUsage(THREE.DynamicDrawUsage); granos.frustumCulled = false; granos.renderOrder = 4; granos.castShadow = false;
  motor.escena.add(granos);
  const azar = g => { const s = Math.sin(g * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), esc = V3(1, 1, 1), pg = V3(0, 0, 0);
  // el brillo de la cabeza
  const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrillo(THREE), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  brillo.renderOrder = 5; motor.escena.add(brillo);

  // de noche el grano tiene la luz del farol
  motor.escucharHora(({ m }) => {
    uCinta.uColor.value.copy(PAJA).lerp(FAROL, m.noche).multiplyScalar(1 + m.noche * .25);
    granos.material.emissiveIntensity = .25 + m.noche * 1.1;
    brillo.material.opacity = .55 + m.noche * .45;
  });

  // ---------- las poses: parámetros (mira a, rumbo, inclinación, distancia) que se mezclan ----------
  let aspecto = 1.6, Dvista = 14000, Tvista = V3(0, 0, 0), Bvista = 180;
  const casaP = AG.casa.P, monP = AG.mon.P;
  const Pose = (o, b, el, d) => ({ o, b, el, d });
  const poseIntro = () => Pose(casaP.clone().setY(casaP.y + 20), 206, 27, aspecto < 1 ? 1150 : 950);
  const poseViaje = f => Pose(enSuave(f), mezcla(198, 172, f), aspecto < 1 ? 36 : 33, aspecto < 1 ? 3300 : 3000);
  const poseMon = () => Pose(monP.clone().setY(monP.y + 20), 166, 30, aspecto < 1 ? 1350 : 1150);
  const poseVista = () => Pose(Tvista.clone(), Bvista, aspecto < 1 ? 58 : 52, Dvista);
  function mezclarPose(A, B, k) {
    if (k <= 0) return A; if (k >= 1) return B;
    return Pose(A.o.clone().lerp(B.o, k), mezclaAng(A.b, B.b, k), mezcla(A.el, B.el, k), Math.exp(mezcla(Math.log(A.d), Math.log(B.d), k)));
  }
  const rad = Math.PI / 180;
  function colocar(P, cam = camara) {
    const ce = Math.cos(P.el * rad);
    cam.position.set(P.o.x + P.d * ce * Math.sin(P.b * rad), P.o.y + P.d * Math.sin(P.el * rad), P.o.z - P.d * ce * Math.cos(P.b * rad));
    const minY = sup(cam.position.x, cam.position.z) + 150; if (cam.position.y < minY) cam.position.y = minY;
    cam.lookAt(P.o); cam.updateMatrixWorld();
  }
  const poseDe = F => {
    let P = mezclarPose(poseViaje(F.f), poseIntro(), F.intro);
    P = mezclarPose(P, poseMon(), F.llegada);
    return mezclarPose(P, poseVista(), F.vista);
  };

  // la vista de todo: el camino entero (y las dos agujas) dentro del encuadre, con margen
  const prueba = new THREE.PerspectiveCamera();
  function encuadrar() {
    Bvista = aspecto < 1 ? 250 : 180;
    const pts = []; for (let i = 0; i < n; i += 40) pts.push(V3(R.x[i], sup(R.x[i], R.z[i]), R.z[i]));
    pts.push(casaP.clone().setY(casaP.y + 240), monP.clone().setY(monP.y + 240));
    // y los rótulos de alrededor (la frontera y los «hacia …», en los bordes de la maqueta)
    for (const k of ['frontera', 'ribadavia', 'termas', 'melgaco']) { const l = L[k]; pts.push(V3(l.xz[0], sup(l.xz[0], l.xz[1]) + (l.alto || 140) * EX, l.xz[1])); }
    const bb = new THREE.Box3().setFromPoints(pts); bb.getCenter(Tvista);
    prueba.copy(camara);
    const cabe = d => { colocar(Pose(Tvista, Bvista, aspecto < 1 ? 58 : 52, d), prueba); prueba.updateProjectionMatrix();
      return pts.every(p => { const v = p.clone().project(prueba); return Math.abs(v.x) < .84 && Math.abs(v.y) < .8 && v.z < 1; }); };
    let a = 2000, b = 70000; for (let i = 0; i < 22; i++) { const m = (a + b) / 2; if (cabe(m)) b = m; else a = m; }
    Dvista = b;
  }

  // ---------- rótulos ----------
  const lista = listaRotulos(T);
  const rotulos = crearRotulos(capa, lista);
  const iRam = Math.round(clamp(R.tramos.find(t => t.k === 'ramiras')?.f ?? .55) * (n - 1));
  const anclas = lista.map(r => {
    if (r.k === 'casa') return casaP.clone().setY(casaP.y + 245);
    if (r.k === 'mon') return monP.clone().setY(monP.y + 245);
    if (r.k === 'ramiras') return V3(R.x[iRam], sup(R.x[iRam], R.z[iRam]) + 90, R.z[iRam]);
    const l = L[r.k]; return V3(l.xz[0], sup(l.xz[0], l.xz[1]) + (l.alto || 140) * EX, l.xz[1]);
  });
  const pant = {};

  // ---------- estado ----------
  let p = quieto ? 1 : 0, pv = p, modo = 'camino', viaje = null, F = fase(pv);
  colocar(poseDe(F));

  // ---------- el explorador ----------
  const ctl = new OrbitControls(camara, caja);
  // la rueda es del scroll de la página (el marco ocupa la pantalla): acercar con Ctrl + rueda (o el pellizco del trackpad),
  // con + y − del teclado y, en táctil con el mapa suelto, con dos dedos
  Object.assign(ctl, { enabled: false, enableDamping: true, dampingFactor: .08, minDistance: 300, maxDistance: 42000, maxPolarAngle: 1.42,
    screenSpacePanning: false, rotateSpeed: .6, enableZoom: TACTIL });
  ctl.addEventListener('change', () => {
    ctl.target.x = clamp(ctl.target.x, -W / 2, W / 2); ctl.target.z = clamp(ctl.target.z, -H / 2, H / 2);
    motor.pedir();
  });
  let moviendo = false;
  const esf = new THREE.Spherical(), off = V3(0, 0, 0);
  ctl.addEventListener('start', () => { moviendo = true; motor.pedir(); });
  ctl.addEventListener('end', () => { moviendo = false; });
  const alRueda = e => {
    if (!e.ctrlKey) return;
    e.preventDefault(); soltar();
    off.copy(camara.position).sub(ctl.target);
    off.setLength(clamp(off.length() * Math.exp(clamp(e.deltaY, -60, 60) * .01), ctl.minDistance, ctl.maxDistance));
    camara.position.copy(ctl.target).add(off); ctl.update(); motor.pedir();
  };
  caja.addEventListener('wheel', alRueda, { passive: false });
  // en táctil, el dedo hace scroll hasta que se pulsa «Mover el mapa» (OrbitControls pone touch-action: none al crearse)
  let suelto = !TACTIL;
  caja.style.touchAction = 'pan-y';
  function ponerMover(activo) {
    suelto = activo;
    caja.style.touchAction = activo ? 'none' : 'pan-y';
    bMover.textContent = activo ? 'Soltar el mapa' : 'Mover el mapa';
    bMover.setAttribute('aria-pressed', String(activo));
    marco.classList.toggle('mapa-suelto', activo);
    ctl.enabled = modo === 'libre' && suelto;
  }
  function ponerModo(m) {
    modo = m;
    marco.classList.toggle('libre', m === 'libre');
    bVolver.hidden = m !== 'libre';
    ctl.enabled = m === 'libre' && suelto;
    rotulos.medir();
  }
  /** al explorador desde donde esté la cámara */
  function soltar() {
    if (modo === 'libre') return;
    viaje = null;
    ctl.target.copy(miraActual()); ponerModo('libre'); ctl.update(); motor.pedir();
  }
  function miraActual() {   // el punto del suelo al que mira la cámara (o el de la pose)
    const P = poseDe(F); return P.o.clone();
  }
  function volver() {
    if (modo !== 'libre') return;
    if (TACTIL) ponerMover(false);
    if (!movimiento) { ponerModo('camino'); colocar(poseDe(F)); motor.pedir(); return; }
    viaje = { t0: -1, p0: camara.position.clone(), o0: ctl.target.clone() };
    ponerModo('camino'); motor.pedir();
  }
  if (TACTIL) {
    bMover.hidden = false; ponerMover(false);
    bMover.addEventListener('click', () => { if (!suelto) soltar(); ponerMover(!suelto); });
  } else bMover.hidden = true;
  bVolver.addEventListener('click', volver);
  // ratón: arrastrar suelta el mapa (en captura, antes que OrbitControls: el mismo arrastre ya gira)
  const alBajar = e => { if (e.pointerType === 'touch') return; if (modo !== 'libre') soltar(); };
  caja.addEventListener('pointerdown', alBajar, { capture: true });
  // teclado: flechas giran e inclinan, + y − acercan (sueltan el mapa); Escape vuelve al camino
  caja.tabIndex = 0;
  caja.setAttribute('role', 'application');
  caja.setAttribute('aria-roledescription', 'relieve en 3D');
  caja.setAttribute('aria-label', 'El camino de la casa al monasterio de Celanova en 3D. Flechas: girar e inclinar. Más y menos: acercar y alejar. Escape: volver al camino.');
  const alTeclear = e => {
    const k = e.key; let dTh = 0, dPh = 0, f = 1;
    if (k === 'Escape' && modo === 'libre') { e.preventDefault(); volver(); return; }
    if (k === 'ArrowLeft') dTh = -.12; else if (k === 'ArrowRight') dTh = .12;
    else if (k === 'ArrowUp') dPh = -.08; else if (k === 'ArrowDown') dPh = .08;
    else if (k === '+' || k === '=') f = .85; else if (k === '-' || k === '_') f = 1 / .85;
    else return;
    e.preventDefault(); soltar();
    off.copy(camara.position).sub(ctl.target); esf.setFromVector3(off);
    esf.theta += dTh; esf.phi = Math.max(.15, Math.min(ctl.maxPolarAngle, esf.phi + dPh));
    esf.radius = Math.max(ctl.minDistance, Math.min(ctl.maxDistance, esf.radius * f));
    camara.position.copy(ctl.target).add(off.setFromSpherical(esf)); ctl.update(); motor.pedir();
  };
  caja.addEventListener('keydown', alTeclear);
  bVolver.textContent = quieto ? 'Ver todo el camino' : 'Volver al camino';

  // ---------- el hilo en cada fotograma ----------
  function ponerHilo(Fh) {
    const fh = Fh.llegada > .5 ? 1 : Fh.f, sCab = fh * LARGO;
    const dCam = camara.position.distanceTo(enSuave(fh));
    const ancho = clamp(dCam * .0028, 6, 46);
    uCinta.uAncho.value = ancho; uCinta.uCabeza.value = fh >= .9999 ? LARGO + 50 : sCab;
    cinta.visible = sCab > 1 || fh >= .9999;
    // granos que caen: los 90 últimos, cada uno en su sitio fijo del camino (el mismo grano en cada fotograma)
    const g0 = Math.floor(sCab / SG), cae = 70 * ancho / 8;
    let k = 0;
    for (let j = 0; j < NG; j++) {
      const g = g0 - j; if (g < 0) break;
      const s = g * SG, t = (sCab - s) / 140, r1 = azar(g), r2 = azar(g + .37), r3 = azar(g + .71);
      const c = enCamino(R, s / LARGO), i = Math.min(n - 2, Math.floor(c.i));
      let tx = R.x[i + 1] - R.x[i], tz = R.z[i + 1] - R.z[i]; const m = Math.hypot(tx, tz) || 1; tx /= m; tz /= m;
      const lat = (r1 - .5) * ancho * 1.1;
      const caida = t < 1 ? (1 - t) * (1 - t) : 0;
      pg.set(c.x - tz * lat, sup(c.x, c.z) + ancho * .5 + caida * cae, c.z + tx * lat);
      eul.set((r2 - .5) * .6 + caida * 6 * r3, Math.atan2(tx, tz) + (r3 - .5) * 1.2, (r1 - .5) * .5 + caida * 4);
      q.setFromEuler(eul);
      const tam = ancho * (.32 + r2 * .1);
      esc.set(tam * .55, tam * .5, tam * 1.1);
      mtx.compose(pg, q, esc); granos.setMatrixAt(k++, mtx);
    }
    granos.count = k; granos.instanceMatrix.needsUpdate = true;
    granos.visible = k > 0;
    const cab = enCamino(R, fh);
    brillo.position.set(cab.x, sup(cab.x, cab.z) + ancho * 2.2, cab.z);
    brillo.scale.setScalar(ancho * (fh < 1 ? 16 : 10));
    brillo.visible = fh > .0005;
  }

  // ---------- la vista ----------
  const vista = motor.montar({
    caja, camara,
    ajustarCamara(w, h) {
      aspecto = w / h; camara.fov = motor.fovPara(aspecto);
      // el punto al que se mira, corrido: a la derecha del cuaderno (apaisado) o por encima (vertical)
      const dx = aspecto >= 1 && w > 760 ? Math.min(190, w * .13) : 0, dy = aspecto < 1 || w <= 760 ? Math.min(120, h * .14) : 0;
      // con setViewOffset, aspect es el de la imagen entera (la visible es un trozo)
      camara.aspect = (w + 2 * dx) / (h + 2 * dy);
      if (dx || dy) camara.setViewOffset(w + 2 * dx, h + 2 * dy, 0, 2 * dy, w, h); else camara.clearViewOffset();
      camara.updateProjectionMatrix();
      encuadrar(); rotulos.medir();
      if (modo === 'camino' && !viaje) colocar(poseDe(F));
    },
    cuadro(t, dt) {
      pv = movimiento ? pv + (p - pv) * (1 - Math.exp(-dt / 90)) : p;
      if (Math.abs(p - pv) < 1e-4) pv = p;
      let sigue = pv !== p;
      F = fase(pv);
      if (modo === 'camino') {
        const dest = poseDe(F);
        if (viaje) {
          if (viaje.t0 < 0) viaje.t0 = t;
          const k = suave((t - viaje.t0) / VIAJE), c2 = prueba; c2.copy(camara); colocar(dest, c2);
          camara.position.lerpVectors(viaje.p0, c2.position, k); camara.lookAt(V3(0, 0, 0).lerpVectors(viaje.o0, dest.o, k)); camara.updateMatrixWorld();
          if (k >= 1) viaje = null; else sigue = true;
        } else colocar(dest);
      } else {
        const cambia = ctl.update();
        const c = camara.position, minY = sup(c.x, c.z) + 60; if (c.y < minY) c.y = minY;
        sigue = sigue || cambia || moviendo;
      }
      ponerHilo(F);
      return sigue;
    },
    trasPintar() {
      const libre = modo === 'libre';
      rotulos.colocar(anclas.map((a, i) => { motor.aPantalla(a, pant); return { x: pant.x, y: pant.y, visible: pant.visible, op: opRotulo(lista[i].k, F, libre) }; }));
    },
    alPrimerFotograma,
  });

  return {
    vista, camara, ctl, cinta, granos,
    get modo() { return modo; }, get progreso() { return pv; }, get fase() { return F; },
    ponerProgreso(v, deGolpe) { p = quieto ? 1 : clamp(v); if (deGolpe || !movimiento) pv = p; motor.pedir(); },
    soltar, volver, poses: { intro: poseIntro, viaje: poseViaje, mon: poseMon, vista: poseVista },
    destruir() {
      ctl.dispose();
      caja.removeEventListener('wheel', alRueda);
      caja.removeEventListener('pointerdown', alBajar, { capture: true }); caja.removeEventListener('keydown', alTeclear);
      capa.textContent = '';
    },
  };
}
