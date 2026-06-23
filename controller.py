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
