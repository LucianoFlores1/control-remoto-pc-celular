SENSITIVITY = 1.5

_VALID_BUTTONS = {"left", "right"}
_VALID_KEYS = {
    "win", "esc", "alttab", "backspace", "enter",
    # modo selección de ventanas: mantiene Alt apretado entre toques
    "alttab_open", "alttab_next", "alttab_prev", "alttab_done",
}


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
        elif t == "press":
            btn = msg.get("btn")
            if btn in _VALID_BUTTONS:
                controller.press(btn)
        elif t == "release":
            btn = msg.get("btn")
            if btn in _VALID_BUTTONS:
                controller.release(btn)
        elif t == "scroll":
            controller.scroll(float(msg["dy"]))
        elif t == "key":
            k = msg.get("k")
            if k in _VALID_KEYS:
                controller.key(k)
        elif t == "type":
            s = msg.get("s")
            if isinstance(s, str) and s:
                controller.type(s)
    except (KeyError, TypeError, ValueError):
        return


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

    def press(self, button):
        btn = Button.left if button == "left" else Button.right
        self._mouse.press(btn)

    def release(self, button):
        btn = Button.left if button == "left" else Button.right
        self._mouse.release(btn)

    def scroll(self, dy):
        # pynput: dy positivo sube; en el cliente invertimos para que arrastrar
        # hacia abajo baje el contenido (lo ajustamos en app.js).
        self._mouse.scroll(0, int(round(dy)))

    def type(self, text):
        self._kb.type(text)

    def key(self, name):
        if name == "win":
            self._tap(Key.cmd)
        elif name == "esc":
            self._tap(Key.esc)
        elif name == "backspace":
            self._tap(Key.backspace)
        elif name == "enter":
            self._tap(Key.enter)
        elif name == "alttab":
            # cambio rápido a la ventana anterior (un solo Alt+Tab)
            with self._kb.pressed(Key.alt):
                self._tap(Key.tab)
        elif name == "alttab_open":
            # abre el selector y lo deja abierto (Alt queda apretado)
            self._kb.press(Key.alt)
            self._tap(Key.tab)
        elif name == "alttab_next":
            self._tap(Key.tab)               # avanza (Alt sigue apretado)
        elif name == "alttab_prev":
            with self._kb.pressed(Key.shift): # retrocede
                self._tap(Key.tab)
        elif name == "alttab_done":
            self._kb.release(Key.alt)         # confirma la ventana elegida

    def release_modifiers(self):
        """Suelta Alt/Shift y los botones del mouse por si quedaron apretados
        (ej. el celular se desconectó en medio de la selección o de un arrastre)."""
        for mod in (Key.alt, Key.shift):
            try:
                self._kb.release(mod)
            except Exception:
                pass
        for btn in (Button.left, Button.right):
            try:
                self._mouse.release(btn)
            except Exception:
                pass

    def _tap(self, key):
        self._kb.press(key)
        self._kb.release(key)
