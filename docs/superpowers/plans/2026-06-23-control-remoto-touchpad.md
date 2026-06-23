# Control Remoto PC ↔ Celular Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un control remoto que permita usar un celular Android como touchpad y teclas especiales (Win, Esc, Alt+Tab) de una PC Windows por WiFi local, entregado como un único `ControlRemoto.exe`.

**Architecture:** Un proceso Python en la PC sirve una página web (Flask) y mantiene un canal WebSocket (flask-sock). El celular abre la web en Chrome, captura gestos táctiles y los manda como JSON. El servidor traduce cada mensaje a acciones de mouse/teclado con pynput. La lógica "mensaje → acción" se separa del backend de pynput para poder testearla con un controlador falso.

**Tech Stack:** Python 3, Flask, flask-sock, pynput, qrcode, pytest, PyInstaller. Cliente: HTML/CSS/JS vanilla + manifest PWA.

## Global Constraints

- Plataforma objetivo de la PC: Windows 11, Python 3.
- La dirección servida usa la **IP local de la PC** (ej. `192.168.0.15`), NUNCA `localhost`/`127.0.0.1`. El servidor escucha en `0.0.0.0`.
- Celular Android con Chrome; cliente web sin instalación.
- Puerto inicial `8000`; si está ocupado, probar el siguiente hasta encontrar libre.
- Stack síncrono (Flask + flask-sock), porque pynput es síncrono.
- PIN de seguridad: preparado pero **apagado por defecto** (fuera del MVP funcional, no implementar salvo que se pida).
- Entregable final: `ControlRemoto.exe` con PyInstaller `--onefile`, sin que el usuario instale nada.
- Para leer `static/` dentro del `.exe` empaquetado usar `sys._MEIPASS`.
- DRY, YAGNI, TDD, commits frecuentes.

---

## File Structure

```
server.py                       # arranque: IP + puerto libre + QR + Flask + ruta WS
controller.py                   # InputController (pynput) + dispatch(msg, controller)
netutil.py                      # find_free_port, get_local_ip, resource_path
static/
  index.html                    # touchpad + botones + estado
  app.js                        # gestos táctiles + WebSocket + reconexión
  style.css                     # estilos
  manifest.webmanifest          # PWA mínimo
tests/
  test_dispatch.py              # mensaje JSON -> llamadas al controlador (fake)
  test_netutil.py               # find_free_port
iniciar.bat                     # desarrollo: python server.py
build.bat                       # PyInstaller --onefile -> ControlRemoto.exe
requirements.txt                # dependencias
README.md                       # uso + nota SmartScreen
```

---

### Task 1: Scaffolding del proyecto y dependencias

**Files:**
- Create: `requirements.txt`
- Create: `iniciar.bat`
- Create: `tests/__init__.py`

**Interfaces:**
- Consumes: nada.
- Produces: entorno con dependencias declaradas; `tests/` como paquete.

- [ ] **Step 1: Crear `requirements.txt`**

```
flask==3.0.3
flask-sock==0.7.0
pynput==1.7.7
qrcode==7.4.2
pyinstaller==6.6.0
pytest==8.2.0
```

- [ ] **Step 2: Crear `tests/__init__.py` vacío**

Archivo vacío (sirve para que pytest trate `tests` como paquete).

- [ ] **Step 3: Crear `iniciar.bat`**

```bat
@echo off
python server.py
pause
```

- [ ] **Step 4: Instalar dependencias y verificar**

Run: `pip install -r requirements.txt && python -c "import flask, flask_sock, pynput, qrcode; print('ok')"`
Expected: imprime `ok` sin errores.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt iniciar.bat tests/__init__.py
git commit -m "chore: scaffolding y dependencias del proyecto"
```

---

### Task 2: Utilidades de red (`netutil.py`)

**Files:**
- Create: `netutil.py`
- Test: `tests/test_netutil.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `find_free_port(start: int = 8000, host: str = "0.0.0.0", max_tries: int = 100) -> int` — devuelve el primer puerto libre desde `start`; lanza `RuntimeError` si no encuentra.
  - `get_local_ip() -> str` — devuelve la IP LAN de la PC (ej. `"192.168.0.15"`); cae a `"127.0.0.1"` si no detecta.
  - `resource_path(rel: str) -> str` — ruta absoluta a un recurso, compatible con PyInstaller (`sys._MEIPASS`) y con ejecución normal.

- [ ] **Step 1: Escribir el test que falla**

```python
# tests/test_netutil.py
import socket
import netutil


def test_find_free_port_returns_open_port():
    port = netutil.find_free_port(start=8000)
    # debe poder bindearse: está libre
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", port))
    s.close()
    assert 8000 <= port <= 8100


def test_find_free_port_skips_busy_port():
    # ocupar 8000 y verificar que devuelve otro
    busy = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    busy.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    busy.bind(("0.0.0.0", 8000))
    busy.listen(1)
    try:
        port = netutil.find_free_port(start=8000)
        assert port != 8000
    finally:
        busy.close()


def test_get_local_ip_is_not_loopback_format():
    ip = netutil.get_local_ip()
    assert isinstance(ip, str)
    assert ip.count(".") == 3
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pytest tests/test_netutil.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'netutil'`.

- [ ] **Step 3: Implementar `netutil.py`**

```python
# netutil.py
import os
import socket
import sys


def find_free_port(start: int = 8000, host: str = "0.0.0.0", max_tries: int = 100) -> int:
    for port in range(start, start + max_tries):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((host, port))
            return port
        except OSError:
            continue
        finally:
            s.close()
    raise RuntimeError(f"No hay puerto libre entre {start} y {start + max_tries}")


def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # no envía datos; solo fuerza al SO a elegir la interfaz de salida
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def resource_path(rel: str) -> str:
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pytest tests/test_netutil.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add netutil.py tests/test_netutil.py
git commit -m "feat: utilidades de red (puerto libre, IP local, resource_path)"
```

---

### Task 3: Dispatch de mensajes + controlador falso (`controller.py`)

**Files:**
- Create: `controller.py`
- Test: `tests/test_dispatch.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - Protocolo de controlador (cualquier objeto con estos métodos):
    - `move(dx: float, dy: float) -> None`
    - `click(button: str) -> None`  # `"left"` | `"right"`
    - `scroll(dy: float) -> None`
    - `key(name: str) -> None`      # `"win"` | `"esc"` | `"alttab"`
  - `dispatch(msg: dict, controller) -> None` — traduce un mensaje JSON ya parseado a una llamada del controlador. Ignora silenciosamente mensajes malformados o tipos desconocidos (no lanza).
  - `SENSITIVITY: float` — multiplicador aplicado a `dx`/`dy` en `move`.

- [ ] **Step 1: Escribir el test que falla**

```python
# tests/test_dispatch.py
import controller


class FakeController:
    def __init__(self):
        self.calls = []

    def move(self, dx, dy):
        self.calls.append(("move", dx, dy))

    def click(self, button):
        self.calls.append(("click", button))

    def scroll(self, dy):
        self.calls.append(("scroll", dy))

    def key(self, name):
        self.calls.append(("key", name))


def test_move_applies_sensitivity():
    c = FakeController()
    controller.dispatch({"t": "move", "dx": 10, "dy": -4}, c)
    assert c.calls == [("move", 10 * controller.SENSITIVITY, -4 * controller.SENSITIVITY)]


def test_click_left_and_right():
    c = FakeController()
    controller.dispatch({"t": "click", "btn": "left"}, c)
    controller.dispatch({"t": "click", "btn": "right"}, c)
    assert c.calls == [("click", "left"), ("click", "right")]


def test_scroll():
    c = FakeController()
    controller.dispatch({"t": "scroll", "dy": 30}, c)
    assert c.calls == [("scroll", 30)]


def test_keys():
    c = FakeController()
    for k in ("win", "esc", "alttab"):
        controller.dispatch({"t": "key", "k": k}, c)
    assert c.calls == [("key", "win"), ("key", "esc"), ("key", "alttab")]


def test_unknown_type_is_ignored():
    c = FakeController()
    controller.dispatch({"t": "nope"}, c)
    controller.dispatch({}, c)
    controller.dispatch({"t": "click"}, c)        # falta btn
    controller.dispatch({"t": "click", "btn": "middle"}, c)  # btn inválido
    controller.dispatch({"t": "key", "k": "f1"}, c)          # tecla no soportada
    assert c.calls == []
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pytest tests/test_dispatch.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'controller'`.

- [ ] **Step 3: Implementar el dispatch en `controller.py`**

Escribir SOLO la parte de protocolo + dispatch (el backend pynput se agrega en la Task 4, en el mismo archivo).

```python
# controller.py
SENSITIVITY = 1.5

_VALID_BUTTONS = {"left", "right"}
_VALID_KEYS = {"win", "esc", "alttab"}


def dispatch(msg, controller):
    """Traduce un mensaje JSON ya parseado a una llamada del controlador.
    Ignora silenciosamente mensajes malformados o desconocidos."""
    if not isinstance(msg, dict):
        return
    t = msg.get("t")
    try:
        if t == "move":
            dx = float(msg["dx"]) * SENSITIVITY
            dy = float(msg["dy"]) * SENSITIVITY
            controller.move(dx, dy)
        elif t == "click":
            btn = msg.get("btn")
            if btn in _VALID_BUTTONS:
                controller.click(btn)
        elif t == "scroll":
            controller.scroll(float(msg["dy"]))
        elif t == "key":
            k = msg.get("k")
            if k in _VALID_KEYS:
                controller.key(k)
    except (KeyError, TypeError, ValueError):
        return
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pytest tests/test_dispatch.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add controller.py tests/test_dispatch.py
git commit -m "feat: dispatch de mensajes JSON a acciones (testeable con fake)"
```

---

### Task 4: Backend real de entrada con pynput (`InputController`)

**Files:**
- Modify: `controller.py` (agregar la clase `InputController` al final)

**Interfaces:**
- Consumes: nada del dispatch (es un controlador concreto que cumple el protocolo).
- Produces:
  - `InputController` — implementa `move`, `click`, `scroll`, `key` usando pynput.

Nota: no se testea con unidad automatizada (mueve el mouse real). Se verifica de forma manual en la Task 7. Mantener la clase pequeña y obvia.

- [ ] **Step 1: Implementar `InputController` en `controller.py`**

Agregar al final del archivo:

```python
from pynput.mouse import Button, Controller as MouseController
from pynput.keyboard import Key, Controller as KeyboardController


class InputController:
    """Controlador real: inyecta entrada en Windows con pynput."""

    def __init__(self):
        self._mouse = MouseController()
        self._kb = KeyboardController()

    def move(self, dx, dy):
        self._mouse.move(int(round(dx)), int(round(dy)))

    def click(self, button):
        btn = Button.left if button == "left" else Button.right
        self._mouse.click(btn)

    def scroll(self, dy):
        # pynput: dy positivo sube; en el cliente invertimos para que arrastrar
        # hacia abajo baje el contenido (lo ajustamos en app.js).
        self._mouse.scroll(0, int(round(dy)))

    def key(self, name):
        if name == "win":
            self._tap(Key.cmd)
        elif name == "esc":
            self._tap(Key.esc)
        elif name == "alttab":
            with self._kb.pressed(Key.alt):
                self._tap(Key.tab)

    def _tap(self, key):
        self._kb.press(key)
        self._kb.release(key)
```

- [ ] **Step 2: Verificación rápida de import (no mueve nada)**

Run: `python -c "import controller; c = controller.InputController(); print('InputController ok')"`
Expected: imprime `InputController ok` sin excepción.

- [ ] **Step 3: Re-correr todos los tests (no deben romperse)**

Run: `pytest -v`
Expected: PASS (todo lo anterior sigue verde).

- [ ] **Step 4: Commit**

```bash
git add controller.py
git commit -m "feat: InputController real con pynput (mouse, scroll, teclas)"
```

---

### Task 5: Cliente web (touchpad + botones + WebSocket)

**Files:**
- Create: `static/index.html`
- Create: `static/style.css`
- Create: `static/app.js`
- Create: `static/manifest.webmanifest`

**Interfaces:**
- Consumes: endpoint WebSocket `/ws` (lo sirve la Task 6) y los archivos estáticos servidos desde `/`.
- Produces: mensajes JSON según el protocolo de la Task 3 (`move`, `click`, `scroll`, `key`).

No hay test automatizado de UI; se verifica manualmente en la Task 7. Mantener todo vanilla, sin dependencias.

- [ ] **Step 1: Crear `static/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Control Remoto</title>
  <link rel="manifest" href="/static/manifest.webmanifest">
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <div id="status" class="disconnected">Conectando…</div>
  <div id="pad">Deslizá para mover · tocá para clic</div>
  <div id="keys">
    <button data-key="win">⊞ Win</button>
    <button data-key="esc">Esc</button>
    <button data-key="alttab">Alt+Tab</button>
  </div>
  <div id="clicks">
    <button data-click="left">Clic Izq</button>
    <button data-click="right">Clic Der</button>
  </div>
  <script src="/static/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear `static/style.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
html, body { height: 100%; background: #111; color: #eee; font-family: system-ui, sans-serif; overflow: hidden; }
body { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
#status { text-align: center; padding: 6px; border-radius: 6px; font-size: 14px; }
#status.connected { background: #1f7a3f; }
#status.disconnected { background: #7a1f1f; }
#pad { flex: 1; background: #1c1c1e; border: 1px dashed #444; border-radius: 12px;
       display: flex; align-items: center; justify-content: center; color: #666;
       font-size: 14px; touch-action: none; }
#keys, #clicks { display: flex; gap: 8px; }
button { flex: 1; padding: 16px; font-size: 16px; background: #2c2c2e; color: #eee;
         border: none; border-radius: 10px; touch-action: manipulation; }
button:active { background: #3a82f7; }
```

- [ ] **Step 3: Crear `static/app.js`**

```javascript
const statusEl = document.getElementById("status");
const pad = document.getElementById("pad");

let ws = null;
function connect() {
  ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onopen = () => { statusEl.textContent = "Conectado"; statusEl.className = "connected"; };
  ws.onclose = () => {
    statusEl.textContent = "Desconectado — reintentando…";
    statusEl.className = "disconnected";
    setTimeout(connect, 1000);
  };
  ws.onerror = () => ws.close();
}
connect();

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// --- Touchpad: movimiento relativo, tap = clic, 2 dedos = scroll ---
let lastX = 0, lastY = 0;
let twoLastY = 0;
let moved = false;
let startTime = 0;
const TAP_MS = 200;
const TAP_SLOP = 10;

pad.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    moved = false;
    startTime = Date.now();
  } else if (e.touches.length === 2) {
    twoLastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: false });

pad.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    const dx = x - lastX, dy = y - lastY;
    lastX = x; lastY = y;
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved = true;
    send({ t: "move", dx, dy });
  } else if (e.touches.length === 2) {
    const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const dy = y - twoLastY;
    twoLastY = y;
    moved = true;
    // arrastrar hacia abajo => contenido baja: invertimos el signo
    send({ t: "scroll", dy: -dy });
  }
}, { passive: false });

pad.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (!moved && (Date.now() - startTime) < TAP_MS && e.touches.length === 0) {
    send({ t: "click", btn: "left" });
  }
}, { passive: false });

// --- Botones de clic y teclas ---
document.querySelectorAll("[data-click]").forEach((b) =>
  b.addEventListener("click", () => send({ t: "click", btn: b.dataset.click })));
document.querySelectorAll("[data-key]").forEach((b) =>
  b.addEventListener("click", () => send({ t: "key", k: b.dataset.key })));
```

- [ ] **Step 4: Crear `static/manifest.webmanifest`**

```json
{
  "name": "Control Remoto",
  "short_name": "Control",
  "display": "fullscreen",
  "orientation": "portrait",
  "background_color": "#111111",
  "theme_color": "#111111",
  "start_url": "/"
}
```

- [ ] **Step 5: Commit**

```bash
git add static/index.html static/style.css static/app.js static/manifest.webmanifest
git commit -m "feat: cliente web touchpad (gestos, botones, WebSocket, PWA)"
```

---

### Task 6: Servidor (`server.py`) — Flask + WebSocket + arranque con QR

**Files:**
- Create: `server.py`

**Interfaces:**
- Consumes:
  - `netutil.find_free_port`, `netutil.get_local_ip`, `netutil.resource_path` (Task 2).
  - `controller.InputController`, `controller.dispatch` (Tasks 3-4).
  - archivos en `static/` (Task 5).
- Produces: ejecutable de servidor (`python server.py`) que sirve la web, expone `/ws`, imprime QR + URL.

- [ ] **Step 1: Implementar `server.py`**

```python
# server.py
import json
import qrcode
from flask import Flask, send_from_directory
from flask_sock import Sock

import netutil
from controller import InputController, dispatch

app = Flask(__name__, static_folder=netutil.resource_path("static"), static_url_path="/static")
sock = Sock(app)
controller = InputController()


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@sock.route("/ws")
def ws(client):
    while True:
        data = client.receive()
        if data is None:
            break
        try:
            msg = json.loads(data)
        except (ValueError, TypeError):
            continue
        dispatch(msg, controller)


def print_qr(url):
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii(invert=True)


def main():
    ip = netutil.get_local_ip()
    port = netutil.find_free_port(start=8000)
    url = f"http://{ip}:{port}"
    print("\n=== Control Remoto ===")
    print(f"Escaneá este QR con el celular (misma WiFi):\n")
    print_qr(url)
    print(f"\nO abrí en Chrome:  {url}\n")
    app.run(host="0.0.0.0", port=port, threaded=True)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verificar que arranca e imprime QR + URL**

Run: `python server.py` (dejar correr ~3s, luego Ctrl+C)
Expected: imprime el bloque "=== Control Remoto ===", un QR ASCII, y una línea `http://<ip-lan>:8000` donde `<ip-lan>` NO es `127.0.0.1` si hay red. No debe lanzar excepción al arrancar.

- [ ] **Step 3: Verificar que la web responde**

Con el servidor corriendo, en otra terminal:
Run: `curl -s http://127.0.0.1:8000/ | findstr "Control Remoto"`
Expected: imprime la línea del `<title>Control Remoto</title>` (el HTML se sirve).

- [ ] **Step 4: Re-correr la suite de tests**

Run: `pytest -v`
Expected: PASS (todos los tests de netutil y dispatch siguen verdes).

- [ ] **Step 5: Commit**

```bash
git add server.py
git commit -m "feat: servidor Flask + WebSocket + arranque con QR y puerto dinamico"
```

---

### Task 7: Verificación manual end-to-end

**Files:**
- Create: `docs/superpowers/plans/verificacion-manual.md` (checklist de prueba real)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: evidencia de que funciona con un celular real.

- [ ] **Step 1: Crear el checklist de verificación manual**

```markdown
# Verificación manual — Control Remoto

Requisitos: PC y celular Android en la misma WiFi.

1. [ ] En la PC: `python server.py` (o `iniciar.bat`). Aparece QR + URL.
2. [ ] En el celular: escanear el QR con la cámara → abre Chrome en la URL.
3. [ ] El indicador superior pasa a "Conectado" (verde).
4. [ ] Deslizar un dedo por el touchpad mueve el cursor de la PC.
5. [ ] Tap rápido en el touchpad = clic izquierdo.
6. [ ] Botón "Clic Der" abre el menú contextual.
7. [ ] Arrastrar con dos dedos hace scroll (abajo = baja el contenido).
8. [ ] Botón "⊞ Win" abre el menú Inicio.
9. [ ] Botón "Esc" sale de una app a pantalla completa.
10. [ ] Botón "Alt+Tab" cambia de ventana.
11. [ ] Apagar la WiFi del cel un momento: el estado pasa a "Desconectado"
       y se reconecta solo al volver.
12. [ ] (Opcional) "Agregar a pantalla de inicio" desde Chrome crea el ícono.
```

- [ ] **Step 2: Ejecutar el checklist con un celular real**

Seguir cada paso. Anotar cualquier fallo. Si algo falla, depurar antes de continuar (gestos en `app.js`, mapeo de teclas en `controller.py`).

- [ ] **Step 3: Commit del checklist**

```bash
git add docs/superpowers/plans/verificacion-manual.md
git commit -m "docs: checklist de verificacion manual end-to-end"
```

---

### Task 8: Empaquetado en `ControlRemoto.exe` (PyInstaller) + README

**Files:**
- Create: `build.bat`
- Create: `README.md`

**Interfaces:**
- Consumes: `server.py` y `static/` (debe empaquetarse con `--add-data`).
- Produces: `dist/ControlRemoto.exe` (un solo archivo, sin dependencias para el usuario).

- [ ] **Step 1: Crear `build.bat`**

En Windows, `--add-data` usa `;` como separador entre origen y destino.

```bat
@echo off
pyinstaller --onefile --name ControlRemoto ^
  --add-data "static;static" ^
  --collect-all pynput ^
  server.py
echo.
echo Listo: dist\ControlRemoto.exe
pause
```

- [ ] **Step 2: Generar el ejecutable**

Run: `build.bat`
Expected: termina sin error y crea `dist/ControlRemoto.exe`.

- [ ] **Step 3: Probar el ejecutable empaquetado**

Run: `dist\ControlRemoto.exe` (dejar correr ~3s, Ctrl+C)
Expected: imprime el QR + URL igual que `python server.py`. Verificar (paso manual) que desde el celular se abre la web y se conecta — esto confirma que `static/` quedó embebido vía `sys._MEIPASS`.

- [ ] **Step 4: Crear `README.md`**

```markdown
# Control Remoto PC ↔ Celular

Usá tu celular Android como touchpad y teclas (Win, Esc, Alt+Tab) de tu PC Windows por WiFi.

## Uso (usuario final)
1. Descargá `ControlRemoto.exe` y hacé doble clic.
   - La primera vez Windows SmartScreen puede avisar: "Más información" → "Ejecutar de todas formas".
2. Escaneá el QR de la ventana con la cámara del celular (misma WiFi).
3. Usá el touchpad y los botones.

## Desarrollo
- `pip install -r requirements.txt`
- `python server.py` (o `iniciar.bat`)
- Tests: `pytest -v`
- Generar el .exe: `build.bat` → `dist/ControlRemoto.exe`

## Notas
- PC y celular deben estar en la misma red WiFi.
- El servidor usa la IP local de la PC (no localhost) y el primer puerto libre desde 8000.
```

- [ ] **Step 5: Actualizar `.gitignore` para artefactos de build**

Agregar al `.gitignore` (no commitear `build/`, `dist/`, ni el `.spec`):

```
build/
dist/
*.spec
```

- [ ] **Step 6: Commit**

```bash
git add build.bat README.md .gitignore
git commit -m "build: empaquetado ControlRemoto.exe con PyInstaller + README"
```

---

## Self-Review

**Spec coverage:**
- Mover mouse relativo → Task 3 (dispatch move) + Task 4 (pynput) + Task 5 (touchmove). ✔
- Clic izq (tap) / der (botón) → Task 5 gestos + Task 3/4. ✔
- Scroll dos dedos → Task 5 + Task 3/4. ✔
- Teclas Win/Esc/Alt+Tab → Task 4 mapeo + Task 5 botones. ✔
- IP local (no localhost) + puerto dinámico → Task 2 + Task 6 (Global Constraints). ✔
- QR en consola al arrancar → Task 6. ✔
- Lógica mensaje→acción testeable con fake → Task 3. ✔
- Estado conexión + reconexión → Task 5 (app.js). ✔
- PWA "agregar a pantalla de inicio" → Task 5 (manifest). ✔
- Ejecutable único .exe, cero instalación → Task 8. ✔
- Nota SmartScreen → Task 8 (README). ✔
- PIN opcional apagado → fuera del MVP por Global Constraints (no se implementa). ✔
- Testing: tests de dispatch y de puerto → Task 2, Task 3; verificación manual → Task 7. ✔

**Placeholder scan:** Sin TBD/TODO; todo paso de código incluye el código real.

**Type consistency:** El protocolo de controlador (`move(dx,dy)`, `click(button)`, `scroll(dy)`, `key(name)`) es idéntico en el `FakeController` (Task 3), en `dispatch` (Task 3) y en `InputController` (Task 4). `dispatch(msg, controller)` y `SENSITIVITY` se usan consistentes entre Task 3 y Task 6. Nombres de `netutil` (`find_free_port`, `get_local_ip`, `resource_path`) coinciden entre Task 2 y Task 6.
