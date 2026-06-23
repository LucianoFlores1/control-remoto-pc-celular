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
    import io
    import sys
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    # Capture ASCII output and print with encoding handling
    buffer = io.StringIO()
    qr.print_ascii(invert=True, out=buffer)
    output = buffer.getvalue()
    # Write to stdout with UTF-8 encoding on Windows
    try:
        print(output, end='')
    except UnicodeEncodeError:
        sys.stdout.buffer.write(output.encode('utf-8', errors='replace'))


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
