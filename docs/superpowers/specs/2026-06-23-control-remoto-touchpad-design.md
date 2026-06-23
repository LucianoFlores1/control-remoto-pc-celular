# Diseño: Control remoto PC ↔ Celular (touchpad por WiFi)

Fecha: 2026-06-23

## Objetivo

Permitir controlar el mouse y algunas teclas de una PC con Windows desde un
celular Android, usándolo como un touchpad a ciegas (el usuario mira el monitor
de la PC, no la pantalla del celular). Pensado especialmente para salir de apps
en pantalla completa (tecla Windows, Escape) y moverse entre ventanas (Alt+Tab).

## Alcance (MVP)

Incluye:
- Mover el mouse de forma relativa (como trackpad de notebook).
- Clic izquierdo (tap rápido) y clic derecho (botón dedicado).
- Scroll vertical (arrastre con dos dedos).
- Teclas especiales: `Win`, `Esc`, `Alt+Tab` (botones dedicados).
- Arranque "dos clics": ejecutable/.bat que levanta todo.
- Código QR en la consola al arrancar para conectar sin tipear la URL.
- Selección de puerto dinámica (busca el primer puerto libre).

No incluye (YAGNI por ahora):
- Ver/espejar la pantalla de la PC en el celular.
- Control por internet fuera de la red local.
- App nativa de Android (es una página web).
- Teclado completo / escribir texto.

## Supuestos / Restricciones

- Celular Android con navegador Chrome.
- PC con Windows 11 y Python 3 instalado.
- Celular y PC en la **misma red WiFi local**.
- La dirección usa la **IP local de la PC** (ej. `192.168.0.15`), NO `localhost`
  ni `127.0.0.1` (el celular no podría alcanzar localhost).

## Arquitectura

```
   CELULAR (Chrome)                       PC (Windows)
 ┌──────────────────┐                 ┌──────────────────────┐
 │  Página web      │   WiFi local    │   server.py (Python) │
 │  - zona touchpad │ ◄──WebSocket──► │   - sirve la web     │
 │  - botones       │   (JSON)        │   - recibe eventos   │
 └──────────────────┘                 │   - mueve mouse/tecla│
                                      │     con pynput       │
                                      └──────────────────────┘
```

Un único proceso Python en la PC sirve la página web y mantiene el canal de
tiempo real. El celular solo abre una URL en el navegador; no se instala nada.

**Stack:**
- `Flask` — sirve la página web (HTML/JS/CSS).
- `flask-sock` — endpoint WebSocket sobre Flask (todo síncrono, fácil de seguir).
- `pynput` — inyecta movimientos de mouse, clics, scroll y teclas en Windows.
- `qrcode` — dibuja el QR en la consola al arrancar.

Se elige un stack síncrono (Flask + flask-sock) en lugar de asyncio porque
`pynput` es síncrono y así el código es más simple de razonar.

## Componentes

### 1. `server.py` (PC)
Responsabilidades:
- Detectar la IP local de la PC.
- Buscar el primer puerto TCP libre desde `8000` hacia arriba.
- Armar la URL `http://<ip>:<puerto>`.
- Dibujar el QR + imprimir la URL en texto en la consola.
- Servir la página web estática.
- Exponer un endpoint WebSocket `/ws` que recibe mensajes JSON.
- Traducir cada mensaje a una acción de entrada.

### 2. Decodificador de mensajes (PC, testeable)
Función/clase que recibe un mensaje JSON ya parseado y llama al método
correspondiente de un "controlador". El controlador real usa `pynput`; en los
tests se usa un controlador falso que solo registra las llamadas. Así la lógica
"mensaje → acción" se testea sin mover el mouse de verdad.

Interfaz del controlador (lo que el decodificador necesita):
- `move(dx, dy)`
- `click(button)`  # "left" | "right"
- `scroll(dy)`
- `key(name)`      # "win" | "esc" | "alttab"

### 3. Cliente web (celular): `index.html` + `app.js` + `style.css`
- Zona de touchpad que captura `touchmove` y envía deltas.
- Detección de tap (toque corto sin desplazamiento) → clic izquierdo.
- Arrastre con dos dedos → scroll.
- Botones: `Clic Izq`, `Clic Der`, `⊞ Win`, `Esc`, `Alt+Tab`.
- Indicador de estado Conectado / Desconectado.
- Reconexión automática del WebSocket si se corta.

## Protocolo (JSON sobre WebSocket)

Del celular al servidor:

```
{ "t": "move",   "dx": 12, "dy": -4 }              // mover mouse relativo (px)
{ "t": "click",  "btn": "left" }                   // "left" | "right"
{ "t": "scroll", "dy": 30 }                         // scroll vertical
{ "t": "key",    "k": "win" }                       // "win" | "esc" | "alttab"
```

El servidor no necesita responder mensajes (canal de un solo sentido para
acciones). El estado de conexión se infiere de que el WebSocket esté abierto.

### Mapeo de teclas (pynput)
- `win`    → tecla Windows (`Key.cmd`).
- `esc`    → `Key.esc`.
- `alttab` → mantener `Alt`, presionar y soltar `Tab`, soltar `Alt`.

### Sensibilidad del mouse
Se aplica un multiplicador lineal constante a `dx`/`dy` antes de mover. Valor
inicial fijo (ajustable en el código). Sin aceleración en el MVP.

## Arranque (flujo)

```
1. Detecta la IP local de la PC.
2. Busca el primer puerto libre desde 8000 (8000, 8001, 8002, ...).
3. Arma la URL  http://<ip>:<puerto>
4. Dibuja el QR + la URL en texto en la consola.
5. Levanta el servidor y queda esperando conexión del celular.
```

Se entrega un `.bat` (doble clic) que ejecuta `python server.py`, para el flujo
"dos clics".

## Facilidad de uso (cero fricción para usuarios perezosos)

Objetivo: instalar y ejecutar en la PC con el mínimo absoluto de pasos.

- **Ejecutable único con PyInstaller (`--onefile`).** Se empaqueta `server.py`,
  todas las librerías (Flask, flask-sock, pynput, qrcode) y los archivos web
  (`static/`) dentro de un solo `ControlRemoto.exe`. El usuario final **no
  instala Python ni pip ni dependencias**: descarga el `.exe`, doble clic,
  aparece el QR, escanea y usa. Para acceder a `static/` empaquetado se usa la
  ruta de PyInstaller (`sys._MEIPASS`).
- **Celular sin instalación** (es una web). Se agrega soporte "Agregar a
  pantalla de inicio" (manifest PWA mínimo) para que quede como ícono tipo app
  y reabra rápido.
- **Aviso de SmartScreen:** la primera vez Windows puede advertir porque el
  `.exe` no está firmado. Se documenta el paso "Más información → Ejecutar de
  todas formas". (Firmar el ejecutable queda fuera del MVP.)
- El `.bat` / `python server.py` se mantiene solo para desarrollo, no para el
  usuario final.

## Manejo de errores

- Si no se detecta IP local, avisar y caer a `0.0.0.0` con aviso.
- Si todos los puertos de un rango razonable están ocupados, error claro.
- El cliente muestra "Desconectado" y reintenta la conexión automáticamente.
- Errores de `pynput` se loguean en la consola sin tumbar el servidor.

## Seguridad

- El servidor solo escucha en la red local.
- Riesgo: cualquiera en la misma WiFi podría conectarse y controlar la PC.
- Mitigación opcional (preparada pero **apagada por defecto** en el MVP): PIN de
  4 dígitos incluido en la URL/QR y validado al abrir el WebSocket.

## Testing

- Tests unitarios del decodificador "mensaje JSON → acción" usando un
  controlador falso que registra las llamadas (sin mover el mouse real).
  Cubrir: cada tipo de mensaje, valores de botón/tecla válidos e inválidos,
  mensajes malformados.
- Test de la utilidad de "buscar puerto libre".
- Prueba manual end-to-end con el celular: mover, clics, scroll y las tres
  teclas.

## Cómo se usa

1. Doble clic al `.bat` en la PC (o `python server.py`).
2. Escanear el QR de la consola con la cámara del celular → abre Chrome en la URL.
3. Usar la zona de touchpad y los botones.

## Estructura de archivos propuesta

```
server.py              # servidor: IP/puerto/QR + Flask + WebSocket + pynput
controller.py          # controlador pynput + decodificador de mensajes
static/
  index.html
  app.js
  style.css
  manifest.webmanifest # PWA mínimo (agregar a pantalla de inicio)
tests/
  test_decoder.py
  test_port.py
iniciar.bat            # arranque para DESARROLLO (python server.py)
build.bat              # genera ControlRemoto.exe con PyInstaller (--onefile)
requirements.txt       # flask, flask-sock, pynput, qrcode, pyinstaller
```

Entregable para el usuario final: **`ControlRemoto.exe`** (un solo archivo).
