# «La ruta del grano» (sección #ruta): datos del 3D y del plano de la casa al monasterio de Celanova.
#
# Fuentes (se descargan una vez a pruebas/3d-fuente/, que NO se publica; con un User-Agent propio y pausas):
#   MDT05 del IGN por WCS (Elevacion4258_5) y ortofoto PNOA por WMS (OI.OrthoimageCoverage): © Instituto
#   Geográfico Nacional, CC BY 4.0. Dos parches finos (0,35 m/px): la casa y el monasterio.
#   La ruta de hoy por carretera: OSRM (router.project-osrm.org, perfil coche), datos © colaboradores de OpenStreetMap.
# Caja del 3D: lat 42,120–42,215, lon −8,200 – −7,930 (unos 22,4 × 10,5 km): la casa, la ruta entera (sube al
#   norte por la OU-0212 y va al este por la OU-531), Celanova y, al suroeste, la raya de Portugal en Ponte Barxas.
#
# Salida en img/terreno/:
#   alturas-<nx>x<nz>.bin   Uint16 little-endian, decímetros, fila 0 = norte (móvil 384×180 / escritorio 576×270)
#   orto-2048.*, orto-4096.*  ortofoto (móvil / escritorio), fila 0 = norte
#   casa-1024.*, casa-1536.*, mon-1024.*, mon-1536.*  los dos parches finos (móvil / escritorio)
#   plano-base.*            relieve sombreado sobre la ortofoto, sin la ruta (el plano animado del módulo dibuja encima)
#   plano.*                 lo mismo con la ruta dibujada y los dos puntos (respaldo de la web, sin JS)
#   terreno.json            caja, mallas, lugares, la ruta (x, z cada 12 m y la altura real) y sus tramos
# El póster lo pinta pruebas/3d-poster.mjs con la propia escena.
#
# Uso (desde la carpeta de la web): python -I scripts/terreno.py
import json, math, pathlib, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from scipy import ndimage as nd
Image.MAX_IMAGE_PIXELS = None

R = pathlib.Path(__file__).resolve().parent.parent
FUENTE = R / 'pruebas' / '3d-fuente'
OUT = R / 'img' / 'terreno'
FUENTE.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'TullaWeb/1.0 (ruta del grano; web de A Casa da Tulla)'}

S, N, O, E = 42.120, 42.215, -8.200, -7.930
CASA = (42.1639316, -8.105519)          # punto de Google de la ficha (DATOS)
MON = (42.1517171, -7.9571695)          # Convento de San Salvador de Celanova (OSM, relación 10216644)
EX = 1.6
lat0 = (S + N) / 2
KX, KZ = 111320 * math.cos(math.radians(lat0)), 110950       # metros por grado
ancho, alto = (E - O) * KX, (N - S) * KZ

def parche(c, lado):   # caja s, n, o, e de un cuadrado de «lado» metros centrado en c
    dl, do = lado / 2 / KZ, lado / 2 / KX
    return (c[0] - dl, c[0] + dl, c[1] - do, c[1] + do)
P_CASA, P_MON = parche(CASA, 720), parche(MON, 820)

# ---------- 0. Descargas (una vez; pausa entre peticiones) ----------
def baja(url, f, minimo=20000):
    p = FUENTE / f
    if p.exists() and p.stat().st_size > minimo: return p
    print('pido', f, flush=True)
    for intento in range(3):   # el IGN da algún 502 suelto: tres intentos, con calma
        try: d = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read(); break
        except urllib.error.HTTPError as e:
            if e.code < 500 or intento == 2: raise
            print('  ', e.code, 'otra vez en', 15 * (intento + 1), 's'); time.sleep(15 * (intento + 1))
    p.write_bytes(d); print('  ', f, len(d) // 1024, 'KB'); time.sleep(2)
    return p
WMS = 'https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage&STYLES=&CRS=EPSG:4326&FORMAT=image/jpeg'
# el WCS da como mucho 4096 px por lado (el MDT05 va a 4,5e-5°): dos hojas, oeste y este, que se cosen por sus tiepoints
MEDIO = (O + E) / 2
HOJAS = (('mdt5-oeste.tif', O, MEDIO + .002), ('mdt5-este.tif', MEDIO - .002, E))
for f, o, e in HOJAS:
    baja('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=Elevacion4258_5'
         f'&SUBSET=Lat({S},{N})&SUBSET=Long({o},{e})&FORMAT=image/tiff', f, 1_000_000)
OW = 4096; OH = round(OW * alto / ancho)
baja(f'{WMS}&BBOX={S},{O},{N},{E}&WIDTH={OW}&HEIGHT={OH}', 'pnoa-4096.jpg')
baja('https://router.project-osrm.org/route/v1/driving/'
     f'{CASA[1]},{CASA[0]};{MON[1]},{MON[0]}?overview=full&geometries=geojson&steps=true', 'ruta-celanova.json', 5000)
# los parches finos son un extra: si el WMS no responde, la escena va sin ellos (se piden la próxima vez)
for nombre, (s, n, o, e) in (('casa', P_CASA), ('mon', P_MON)):
    try: baja(f'{WMS}&BBOX={s},{o},{n},{e}&WIDTH=2048&HEIGHT=2048', f'{nombre}-pnoa.jpg')
    except Exception as er: print('  sin parche', nombre, er)

if __name__ == '__main__' and 'solo-bajar' in __import__('sys').argv:
    raise SystemExit

# ---------- 1. Relieve: las dos hojas cosidas en la rejilla del MDT05 y recortadas a la caja ----------
hojas = [Image.open(FUENTE / f) for f, _, _ in HOJAS]
px, py = hojas[0].tag_v2[33550][:2]
wD, hD = round((E - O) / px), round((N - S) / py)
dem = np.zeros((hD, wD), np.float32); hecho = np.zeros((hD, wD), bool)
for im in hojas:
    a = np.array(im, dtype=np.float32); x0 = round((im.tag_v2[33922][3] - O) / px); y0 = round((N - im.tag_v2[33922][4]) / py)
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(wD, x0 + a.shape[1]), min(hD, y0 + a.shape[0])
    dem[ya:yb, xa:xb] = a[ya - y0:yb - y0, xa - x0:xb - x0]; hecho[ya:yb, xa:xb] = True
assert hecho.all(), 'faltan píxeles del MDT en la caja'
# el MDT05 del WCS viene en metros enteros: un desenfoque de 1,5 px (≈7 m) quita los escalones de las laderas suaves
dem = nd.gaussian_filter(dem, 1.5)
mx, mz = ancho / wD, alto / hD
def pxl(lat, lon): return min(hD - 1, max(0, int((N - lat) / (N - S) * hD))), min(wD - 1, max(0, int((lon - O) / (E - O) * wD)))
def local(lat, lon): return [round((lon - (O + E) / 2) * KX, 1), round(((S + N) / 2 - lat) * KZ, 1)]
def cota_xz(x, z):   # altura real (bilineal) en metros locales
    c = (x / ancho + .5) * (wD - 1); r = (z / alto + .5) * (hD - 1)
    return float(nd.map_coordinates(dem, [[r], [c]], order=1, mode='nearest')[0])
def uv(lat, lon): return [round((lon - O) / (E - O), 4), round((N - lat) / (N - S), 4)]

# ---------- 2. Mallas (área media, sin escalones) ----------
MALLAS = []
for nx in (384, 576):
    nz = round(nx * alto / ancho)
    a = np.array(Image.fromarray(dem).resize((nx, nz), Image.BOX), dtype=np.float32)
    (OUT / f'alturas-{nx}x{nz}.bin').write_bytes(np.round(np.clip(a, 0, 6000) * 10).astype('<u2').tobytes())
    MALLAS.append([nx, nz])

# ---------- 3. La ruta de hoy (OSRM): cada 12 m, con la altura real y los tramos ----------
osrm = json.loads((FUENTE / 'ruta-celanova.json').read_text(encoding='utf-8'))['routes'][0]
ll = np.array(osrm['geometry']['coordinates'], dtype=np.float64)           # lon, lat
xz = np.column_stack([(ll[:, 0] - (O + E) / 2) * KX, ((S + N) / 2 - ll[:, 1]) * KZ])
seg = np.hypot(*np.diff(xz, axis=0).T); keep = np.concatenate([[True], seg > .01]); xz = xz[keep]
s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(xz, axis=0).T))])
PASO = 12.0
t = np.arange(0, s_[-1], PASO); t = np.append(t, s_[-1])
rx, rz = np.interp(t, s_, xz[:, 0]), np.interp(t, s_, xz[:, 1])
c = (rx / ancho + .5) * (wD - 1); r = (rz / alto + .5) * (hD - 1)
rh = nd.map_coordinates(dem, [r, c], order=1, mode='nearest')
largo = float(s_[-1])
# tramos por los pasos de OSRM (en metros de OSRM; el módulo los pasa a fracción con distance)
acum, pasos = 0.0, []
for paso in osrm['legs'][0]['steps']:
    pasos.append((round(acum), paso.get('ref') or '', paso.get('name') or '')); acum += paso['distance']
def km_de(ref=None, nombre=None, desde=0):
    for m, rf, nm in pasos:
        if m >= desde and ((ref and ref in rf) or (nombre and nombre in nm)): return m
D_OSRM = osrm['distance']
k_ou0212 = km_de(ref='OU-0212'); k_local = km_de(desde=k_ou0212 + 100, nombre='') or 3147
k_ou531 = km_de(ref='OU-531'); k_ciudad = km_de(nombre='Miguel Ángel Blanco')
# Ramirás: el pueblo que cruza la OU-531 (calle «Rúa Manuel Vázquez Álvarez», OSRM; aldea según Nominatim, OSM)
k_ramiras = km_de(nombre='Manuel Vázquez')
TRAMOS = [
    {'d': 0, 'k': 'sale', 't': 'Sale de la tulla, en Gomesende'},
    {'d': k_ou0212, 'k': 'sube', 't': 'Sube hacia el norte por la OU-0212'},
    {'d': pasos[3][0], 'k': 'aldeas', 't': 'Entre aldeas de Gomesende hasta la OU-531'},
    {'d': k_ou531, 'k': 'este', 't': 'Hacia el este por la OU-531, la carretera de Xinzo de Limia a Cortegada'},
    {'d': k_ramiras, 'k': 'ramiras', 't': 'Cruza Ramirás y sigue por la OU-531 hacia Celanova'},
    {'d': k_ciudad, 'k': 'celanova', 't': 'Entra en Celanova'},
]
print('tramos', [(x['d'], x['k']) for x in TRAMOS])

# ---------- 4. Ortofoto (dos tamaños) y los parches finos ----------
orto = np.array(Image.open(FUENTE / 'pnoa-4096.jpg').convert('RGB'), dtype=np.float32)
# el PNOA trae dos vuelos: la franja este (desde la columna ≈2726) sale más oscura y azulada. Se busca el corte (el escalón
# que se repite en todas las filas) y se iguala con la ganancia por canal medida a los dos lados, con el borde difuminado
paso_col = np.abs(np.median(orto[:, 4:] - orto[:, :-4], axis=0)).sum(1)
C0 = int(np.argmax(paso_col)) + 2
if paso_col[C0 - 2] > 12:
    xx = np.arange(orto.shape[1]); peso = np.clip((xx - C0 + 70) / 140, 0, 1)   # ≈750 m de fundido: que no se vea una costura
    for ch in range(3):
        g = np.median(orto[:, C0 - 90:C0 - 6, ch]) / max(1, np.median(orto[:, C0 + 6:C0 + 90, ch]))
        orto[:, :, ch] *= 1 + (g - 1) * peso
    print('corte del PNOA en la columna', C0)
orto = Image.fromarray(np.clip(orto, 0, 255).astype('uint8'))
orto = ImageEnhance.Color(ImageEnhance.Contrast(orto).enhance(1.08)).enhance(.92)
ortos = {}
for w, qj, qw in ((2048, 64, 52), (4096, 62, 50)):
    h = round(w * alto / ancho / 2) * 2
    o = orto.resize((w, h), Image.LANCZOS)
    o.save(OUT / f'orto-{w}.jpg', quality=qj, optimize=True, progressive=True)
    o.save(OUT / f'orto-{w}.webp', quality=qw, method=6)
    ortos[str(w)] = [w, h]
parches = {}
for nombre, (s, n, o, e) in (('casa', P_CASA), ('mon', P_MON)):
    f = FUENTE / f'{nombre}-pnoa.jpg'
    if not f.exists(): continue
    im = ImageEnhance.Contrast(ImageEnhance.Color(Image.open(f).convert('RGB')).enhance(.94)).enhance(1.06)
    for w in (1024, 1536):
        iw = im.resize((w, w), Image.LANCZOS)
        iw.save(OUT / f'{nombre}-{w}.jpg', quality=72, optimize=True, progressive=True)
        iw.save(OUT / f'{nombre}-{w}.webp', quality=52, method=6)
    parches[nombre] = {'xz': local((s + n) / 2, (o + e) / 2), 'ancho': round((e - o) * KX, 1), 'alto': round((n - s) * KZ, 1)}

# ---------- 5. El plano: relieve sombreado sobre la ortofoto; con y sin la ruta ----------
PW = 1800; PH = round(PW * alto / ancho)
d = np.array(Image.fromarray(dem).resize((PW, PH), Image.BOX), dtype=np.float32)
gy, gx = np.gradient(d * EX, ancho / PW)
az, al = math.radians(315), math.radians(40)
sl = np.arctan(np.hypot(gx, gy)); asp = np.arctan2(-gx, gy)
hs = np.clip(math.sin(al) * np.cos(sl) + math.cos(al) * np.sin(sl) * np.cos(az - asp), 0, 1)
o = np.array(orto.resize((PW, PH), Image.LANCZOS), dtype=np.float32) / 255
base = Image.fromarray((np.clip(o * (0.36 + 0.84 * hs[..., None]), 0, 1) * 255).astype('uint8'))
base.save(OUT / 'plano-base.jpg', quality=76, optimize=True, progressive=True); base.save(OUT / 'plano-base.webp', quality=72, method=6)
# el respaldo sin JS: la ruta en paja con un filo oscuro, la casa en el verde del logo y el monasterio
K = 2; big = base.resize((PW * K, PH * K), Image.LANCZOS); dr = ImageDraw.Draw(big)
pp = [((x / ancho + .5) * PW * K, (z / alto + .5) * PH * K) for x, z in zip(rx[::2], rz[::2])]
dr.line(pp, fill=(28, 31, 36), width=11 * K // 2 * 2, joint='curve'); dr.line(pp, fill=(217, 180, 106), width=5 * K, joint='curve')
for (la, lo), col in ((CASA, (107, 143, 8)), (MON, (217, 180, 106))):
    u = uv(la, lo); cx, cy = u[0] * PW * K, u[1] * PH * K
    dr.ellipse([cx - 13 * K, cy - 13 * K, cx + 13 * K, cy + 13 * K], fill=(243, 238, 228)); dr.ellipse([cx - 9 * K, cy - 9 * K, cx + 9 * K, cy + 9 * K], fill=col)
plano = big.resize((PW, PH), Image.LANCZOS)
plano.save(OUT / 'plano.jpg', quality=76, optimize=True, progressive=True); plano.save(OUT / 'plano.webp', quality=72, method=6)

# ---------- 6. Lugares y metadatos ----------
# dentro de la caja: punto propio; fuera: rótulo en el borde de la maqueta, en la línea casa → lugar («hacia …»)
def al_borde(lat, lon, margen=450):
    c0 = np.array(local(*CASA)); c1 = np.array(local(lat, lon)); v = c1 - c0
    lim_x, lim_z = ancho / 2 - margen, alto / 2 - margen
    k = min([((lim_x if v[0] > 0 else -lim_x) - c0[0]) / v[0] if v[0] else 9, ((lim_z if v[1] > 0 else -lim_z) - c0[1]) / v[1] if v[1] else 9, 1])
    p = c0 + v * k; return [round(float(p[0]), 1), round(float(p[1]), 1)]
def lugar(t, sub, la, lo, fuera=False, alto_r=140):
    p = al_borde(la, lo) if fuera else local(la, lo)
    return {'t': t, 'sub': sub, 'xz': p, 'h': round(cota_xz(*p), 1), 'uv': [round(p[0] / ancho + .5, 4), round(p[1] / alto + .5, 4)], 'fuera': fuera, 'alto': alto_r}
i_ram = int(np.argmin(np.abs(t - k_ramiras * largo / D_OSRM)))
L = {
    'casa': lugar('A Casa da Tulla', 'Gomesende', *CASA),
    'mon': lugar('Monasterio de San Salvador', 'Celanova', *MON),
    'ramiras': {**lugar('Ramirás', 'de camino', 0, 0), 'xz': [round(float(rx[i_ram]), 1), round(float(rz[i_ram]), 1)], 'h': round(float(rh[i_ram]), 1),
                'uv': [round(float(rx[i_ram]) / ancho + .5, 4), round(float(rz[i_ram]) / alto + .5, 4)]},
    'frontera': lugar('La frontera', 'Ponte Barxas · 14 km', 42.1389819, -8.1875761, alto_r=120),
    'ribadavia': lugar('Ribadavia', '27 km por carretera', 42.288847, -8.1420491, True, 520),
    'termas': lugar('Termas de Prexigueiro', '23 km por carretera', 42.253336, -8.167345, True, 160),
    'melgaco': lugar('Melgaço (Portugal)', '24 km por carretera', 42.1130412, -8.2593422, True, 160),
}
meta = {'caja': {'s': S, 'n': N, 'o': O, 'e': E}, 'ancho': round(ancho), 'alto': round(alto), 'mallas': MALLAS, 'exageracion': EX,
        'min': round(float(dem.min()), 1), 'max': round(float(dem.max()), 1), 'ortos': ortos, 'parches': parches,
        'plano': {'w': PW, 'h': PH}, 'lugares': L,
        'ruta': {'paso': PASO, 'largo': round(largo, 1), 'km': round(D_OSRM / 1000, 1), 'min': round(osrm['duration'] / 60), 'recta': 12.3,
                 'x': [round(float(v), 1) for v in rx], 'z': [round(float(v), 1) for v in rz], 'h': [round(float(v)) for v in rh],
                 'tramos': [{**x, 'f': round(x['d'] / D_OSRM, 4)} for x in TRAMOS]},
        'fuente': 'MDT05 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0) · Ruta: OSRM, datos © colaboradores de OpenStreetMap'}
(OUT / 'terreno.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('caja km', round(ancho / 1000, 2), round(alto / 1000, 2), '| ruta', round(largo), 'm (OSRM', D_OSRM, ') |', len(rx), 'puntos | alturas', int(rh.min()), '->', int(rh.max()),
      '| casa', L['casa']['h'], 'm | monasterio', L['mon']['h'], 'm | parches', list(parches))
for p in sorted(OUT.iterdir()): print(f'{p.name:28} {p.stat().st_size // 1024:6} KB')
