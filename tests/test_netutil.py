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
