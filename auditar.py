#!/usr/bin/env python3
"""
ÚLTIMA LÍNEA — AUDITORÍA DEL PROYECTO
=====================================
Detecta las clases de error que más daño han hecho en este proyecto,
sin ejecutar el juego. Correr desde la carpeta que contiene index.html:

    python3 auditar.py

Si todo sale limpio, imprime "SIN PROBLEMAS" y devuelve código 0.
Si encuentra algo, devuelve código 1 (útil para engancharlo a un script
de build o a un hook de git).

QUÉ REVISA
----------
A. Colisiones de nombre entre scripts.
   Dos `let`/`const` con el mismo nombre en el nivel superior de dos
   archivos distintos revientan la página entera con SyntaxError, y el
   mensaje del navegador no siempre señala el archivo culpable.

B. Desajuste entre archivos en disco y los que carga index.html.
   Un archivo nuevo que nadie carga (o un <script> que apunta a un
   archivo que ya no existe) falla en silencio.

C. Funciones huérfanas: definidas y jamás nombradas.
   ESTE ES EL FALLO RECURRENTE del proyecto. Así fue como se quedaron
   invisibles los coches, el escenario, el jefe entero, la sacudida de
   cámara y los matojos: la función existía y estaba bien escrita, pero
   nadie la llamaba. No lanza ningún error en consola.

D. Funciones llamadas que nadie define.
   Provoca ReferenceError en caliente, a veces solo en un caso raro
   (así estaba grantRandomUpgrade: solo fallaba al matar al jefe).

E. Rejillas de pixel art con filas de distinta longitud.
   Deforma el sprite sin avisar.

F. Caracteres de sprite sin color en su paleta.
   Se dibujan como huecos transparentes.

LIMITACIONES
------------
Es análisis estático por texto: no entiende el flujo del programa. Puede
marcar como huérfana una función invocada por un nombre construido
dinámicamente. Revisá cada aviso antes de borrar nada.
"""

import re
import os
import sys

# ----------------------------------------------------------------- util --
def sin_comentarios(s):
    """Quita comentarios pero CONSERVA las plantillas `...`: mucho código
    de UI invoca funciones dentro de plantillas y borrarlas producía
    falsos positivos."""
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'(?m)//[^\n]*$', '', s)


def sin_cadenas(s):
    """Versión agresiva, para cuando el texto de las cadenas estorba."""
    s = sin_comentarios(s)
    s = re.sub(r'`(?:[^`\\]|\\.)*`', '``', s)
    s = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", s)
    return re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', s)


def decls_nivel_superior(txt):
    """Declaraciones fuera de toda llave: son las que colisionan."""
    out, prof = [], 0
    for linea in txt.split('\n'):
        st = linea.strip()
        if prof == 0:
            m = re.match(r'(?:let|const|var)\s+([\w\s,]+?)\s*[=;]', st)
            if m:
                for n in m.group(1).split(','):
                    n = n.strip()
                    if re.fullmatch(r'\w+', n):
                        out.append(n)
            m = re.match(r'function\s+(\w+)', st)
            if m:
                out.append(m.group(1))
        prof = max(0, prof + linea.count('{') - linea.count('}'))
    return out


# nombres del entorno y métodos de objetos: no son funciones del proyecto
IGNORAR = set('''
Math Object Array String Number Boolean JSON Date console window document performance
requestAnimationFrame setTimeout setInterval clearTimeout clearInterval parseInt parseFloat
isNaN isFinite Map Set Promise Error RegExp Symbol AudioContext webkitAudioContext
Float32Array MutationObserver localStorage sessionStorage prompt alert confirm fetch
if for while switch return function typeof new this true false null undefined catch try
else do break continue throw class extends super yield await async delete in instanceof
forEach filter map some every find findIndex push pop shift unshift splice slice concat
join indexOf lastIndexOf includes reduce reduceRight sort reverse fill flat entries keys
values assign freeze create defineProperty hasOwnProperty toString valueOf
split replace replaceAll trim padStart padEnd repeat charAt charCodeAt substring substr
toLowerCase toUpperCase startsWith endsWith match matchAll exec test toFixed
getElementById querySelector querySelectorAll createElement createTextNode
addEventListener removeEventListener dispatchEvent getBoundingClientRect
setPointerCapture releasePointerCapture appendChild removeChild insertBefore
remove add toggle contains closest observe disconnect preventDefault stopPropagation
setAttribute getAttribute removeAttribute setProperty getPropertyValue focus blur click
save restore translate rotate scale transform setTransform beginPath moveTo lineTo arc
arcTo ellipse rect roundRect fillRect strokeRect clearRect fill stroke closePath clip
quadraticCurveTo bezierCurveTo createRadialGradient createLinearGradient createPattern
addColorStop drawImage putImageData getImageData createImageData setLineDash measureText
fillText strokeText getContext toDataURL
now random floor ceil round trunc abs min max sin cos tan asin acos atan atan2 hypot
pow sqrt cbrt sign log log2 log10 exp
createOscillator createGain createBiquadFilter createBufferSource createBuffer
createDynamicsCompressor createAnalyser createConvolver connect disconnect start stop
setValueAtTime linearRampToValueAtTime exponentialRampToValueAtTime
setTargetAtTime cancelScheduledValues getChannelData copyToChannel resume suspend close
call apply bind of from isArray isInteger cancelAnimationFrame
'''.split())


def main():
    if not os.path.exists('index.html'):
        print('ERROR: ejecutá este script desde la carpeta que contiene index.html')
        return 2

    html = open('index.html', encoding='utf-8').read()
    orden = re.findall(r'<script src="(?:js/)?([^"]+\.js)"', html)

    base = 'js' if os.path.isdir('js') else '.'
    ruta = lambda f: os.path.join(base, f)

    cargados = [f for f in orden if os.path.exists(ruta(f))]
    en_disco = sorted(f for f in os.listdir(base) if f.endswith('.js'))

    src = {f: open(ruta(f), encoding='utf-8').read() for f in cargados}
    limpio = {f: sin_comentarios(src[f]) for f in cargados}
    duro = {f: sin_cadenas(src[f]) for f in cargados}

    cuerpo = '\n'.join(limpio.values()) + '\n' + sin_comentarios(html)
    problemas = 0

    def encabezado(t):
        print()
        print('=' * 68)
        print(t)
        print('=' * 68)

    # ---------------------------------------------------------------- A --
    encabezado('A · COLISIONES DE NOMBRE ENTRE SCRIPTS  (SyntaxError fatal)')
    visto, hubo = {}, False
    for f in cargados:
        for n in decls_nivel_superior(duro[f]):
            if n in visto and visto[n] != f:
                print(f'  FATAL  "{n}" se declara en {visto[n]} Y en {f}')
                hubo = True
            visto.setdefault(n, f)
    if not hubo:
        print('  ninguna')
    problemas += hubo

    # ---------------------------------------------------------------- B --
    encabezado('B · ARCHIVOS EN DISCO vs CARGADOS POR index.html')
    hubo = False
    for f in en_disco:
        if f not in orden:
            print(f'  AVISO  {f} existe pero index.html no lo carga')
            hubo = True
    for f in orden:
        if not os.path.exists(ruta(f)):
            print(f'  FATAL  index.html carga {f} pero no existe en disco')
            hubo = True
    if not hubo:
        print('  todo cuadra')
    problemas += hubo

    # ---------------------------------------------------------------- C --
    encabezado('C · FUNCIONES DEFINIDAS QUE NADIE LLAMA  (el fallo recurrente)')
    definidas = {}
    for f in cargados:
        for fn in re.findall(r'\bfunction\s+(\w+)', limpio[f]):
            definidas.setdefault(fn, f)
    hubo = False
    for fn, f in sorted(definidas.items()):
        if len(re.findall(r'\b' + re.escape(fn) + r'\b', cuerpo)) <= 1:
            print(f'  HUERFANA  {f}: {fn}()')
            hubo = True
    if not hubo:
        print('  ninguna')
    problemas += hubo

    # ---------------------------------------------------------------- D --
    encabezado('D · FUNCIONES LLAMADAS QUE NADIE DEFINE  (ReferenceError)')
    globales = set(definidas)
    for f in cargados:
        globales |= set(re.findall(r'\b(?:let|const|var)\s+(\w+)', duro[f]))
        globales |= set(re.findall(r'window\.(\w+)\s*=', duro[f]))
        for blq in re.findall(r'window\.\w+\s*=\s*\{(.*?)\n\s*\};', duro[f], re.S):
            globales |= set(re.findall(r'(\w+)\s*[,:}]', blq))
    hubo = False
    for f in cargados:
        propias = set(re.findall(r'\b(?:function|let|const|var)\s+(\w+)', duro[f]))
        # parametros de funcion: un callback recibido como argumento
        # (onMove, keepFn, rowsProvider...) se invoca dentro pero no se
        # define en ningun sitio; no es un fallo
        locales = set(re.findall(r'\b(?:let|const|var)\s+(\w+)', duro[f]))
        for firma in re.findall(r'(?:function\s*\w*\s*|\b)\(([^)]*)\)\s*(?:=>|\{)', duro[f]):
            for p in firma.split(','):
                p = p.strip().split('=')[0].strip()
                if re.fullmatch(r'\w+', p):
                    locales.add(p)
        for c in sorted(set(re.findall(r'(?<![\w.$])([a-z_]\w*)\s*\(', duro[f]))):
            if c in IGNORAR or c in globales or c in propias or c in locales:
                continue
            # descartar callbacks locales declarados como parametros
            if re.search(r'\b(?:function\s*\([^)]*\b' + re.escape(c) + r'\b|' +
                         re.escape(c) + r'\s*[:=]\s*(?:function|\())', duro[f]):
                continue
            print(f'  INDEFINIDA  {f}: llama a {c}()')
            hubo = True
    if not hubo:
        print('  ninguna')
    problemas += hubo

    # ---------------------------------------------------------------- E --
    encabezado('E · REJILLAS DE PIXEL ART CON FILAS DESIGUALES')
    hubo = False
    rejillas = {}
    for f in en_disco:
        txt = sin_comentarios(open(ruta(f), encoding='utf-8').read())
        for m in re.finditer(r'(?:const|let|var)\s+(\w+)\s*=\s*\[\s*((?:\s*"[^"]*"\s*,?)+)\s*\]', txt):
            filas = re.findall(r'"([^"]*)"', m.group(2))
            if len(filas) < 2:
                continue
            rejillas[m.group(1)] = (f, filas)
            largos = sorted({len(r) for r in filas})
            if len(largos) > 1:
                print(f'  DEFORME  {f}: {m.group(1)} tiene filas de largo {largos}')
                hubo = True
    if not hubo:
        print('  ninguna')
    problemas += hubo

    # ---------------------------------------------------------------- F --
    encabezado('F · CARACTERES DE SPRITE SIN COLOR EN SU PALETA')
    paletas = {}
    for f in en_disco:
        txt = sin_comentarios(open(ruta(f), encoding='utf-8').read())
        for m in re.finditer(r'(?:const|let)\s+(\w*PALETTE\w*)\s*=\s*\{(.*?)\}', txt, re.S):
            paletas[m.group(1)] = set(re.findall(r"(\w)\s*:\s*'#", m.group(2)))
    hubo = False
    for g, (f, filas) in rejillas.items():
        usados = set(''.join(filas)) - {'.'}
        if not usados:
            continue
        raiz = g.split('_')[0]
        for p, cols in paletas.items():
            if not p.startswith(raiz):
                continue
            falta = usados - cols
            if falta and len(falta) < len(usados):
                print(f'  HUECO  {f}: {g} usa {sorted(falta)} ausentes de {p}')
                hubo = True
    if not hubo:
        print('  ninguna')
    problemas += hubo

    print()
    print('=' * 68)
    if problemas:
        print(f'REVISAR: {problemas} categoría(s) con hallazgos.')
        print('Los marcados FATAL rompen el juego. HUERFANA/INDEFINIDA suelen')
        print('ser mecánicas desconectadas. AVISO y HUECO son cosméticos.')
    else:
        print('SIN PROBLEMAS')
    print('=' * 68)
    return 1 if problemas else 0


if __name__ == '__main__':
    sys.exit(main())
