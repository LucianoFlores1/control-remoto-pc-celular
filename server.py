# server.py
import json
import sys
import qrcode
from flask import Flask, send_from_directory
from flask_sock import Sock

import netutil
from controller import InputController, dispatch


def _enable_utf8_console():
    """La consola por defecto de Windows (cp1252) muestra los bloques del QR
    como basura ('â–ˆ' en vez de '█'), y entonces la cámara no lo puede leer.
    Forzamos la consola y stdout a UTF-8 para que el QR se vea y sea escaneable."""
    try:
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.kernel32.SetConsoleOutputCP(65001)
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

app = Flask(__name__, static_folder=netutil.resource_path("static"), static_url_path="/static")
sock = Sock(app)
controller = None  # se crea en main(); evita instanciar pynput al importar el módulo


@app.after_request
def no_cache(resp):
    # el celular siempre toma la última versión del cliente (evita app.js cacheado)
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/favicon.ico")
def favicon():
    # El navegador siempre lo pide; sin esto loguea un 404 inofensivo.
    return "", 204


@sock.route("/ws")
def ws(client):
    try:
        while True:
            data = client.receive()
            if data is None:
                break
            try:
                msg = json.loads(data)
            except (ValueError, TypeError):
                continue
            dispatch(msg, controller)
    finally:
        # si el cliente se cae con Alt apretado (selección de ventanas), lo soltamos
        controller.release_modifiers()


def print_qr(url):
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii(invert=True)


def main():
    global controller
    controller = InputController()
    _enable_utf8_console()
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
