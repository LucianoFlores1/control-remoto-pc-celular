const statusEl = document.getElementById("status");
const pad = document.getElementById("pad");

let ws = null;
let reconnectTimer = null;
function connect() {
  reconnectTimer = null;
  ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onopen = () => { statusEl.textContent = "Conectado"; statusEl.className = "connected"; };
  ws.onclose = () => {
    statusEl.textContent = "Desconectado — reintentando…";
    statusEl.className = "disconnected";
    // un solo reintento pendiente a la vez (evita timers apilados)
    if (!reconnectTimer) reconnectTimer = setTimeout(connect, 1000);
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
  // al pasar de 2 dedos a 1, re-anclar para no producir un salto del cursor
  if (e.touches.length === 1) {
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  }
}, { passive: false });

// --- Botones de clic y teclas ---
document.querySelectorAll("[data-click]").forEach((b) =>
  b.addEventListener("click", () => send({ t: "click", btn: b.dataset.click })));
document.querySelectorAll("[data-key]").forEach((b) =>
  b.addEventListener("click", () => send({ t: "key", k: b.dataset.key })));

// --- Alt+Tab modo selección: Alt queda apretado hasta "Elegir" ---
const altpanel = document.getElementById("altpanel");
document.querySelectorAll("[data-alt]").forEach((b) =>
  b.addEventListener("click", () => {
    const action = b.dataset.alt;
    send({ t: "key", k: "alttab_" + action });   // open | next | prev | done
    if (action === "open") altpanel.classList.remove("hidden");
    else if (action === "done") altpanel.classList.add("hidden");
  }));
