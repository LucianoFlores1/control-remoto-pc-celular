import os
import socket
import sys


def find_free_port(start: int = 8000, host: str = "0.0.0.0", max_tries: int = 100) -> int:
    for port in range(start, start + max_tries):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind((host, port))
            s.close()
            return port
        except OSError:
            s.close()
            continue
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
