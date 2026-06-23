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
