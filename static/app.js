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
