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
    send({ t: "scroll", dy });
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

// --- Botones de clic: press al tocar, release al soltar (toque rápido = clic;
//     mantener apretado + mover el dedo en el pad = arrastrar) ---
document.querySelectorAll("[data-click]").forEach((b) => {
  const btn = b.dataset.click;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    send({ t: "press", btn });
  });
  const up = () => send({ t: "release", btn });
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
});

// --- Teclas ---
document.querySelectorAll("[data-key]").forEach((b) =>
  b.addEventListener("click", () => send({ t: "key", k: b.dataset.key })));

// --- Teclado: input oculto abre el teclado del celular y transmite el tipeo ---
const kbinput = document.getElementById("kbinput");
document.getElementById("kbbtn").addEventListener("click", () => {
  kbinput.value = ""; lastKb = "";
  kbinput.focus();
});
// diff contra el valor previo: maneja escribir y borrar (incluye autocorrección)
let lastKb = "";
kbinput.addEventListener("input", () => {
  const v = kbinput.value;
  let i = 0;
  while (i < lastKb.length && i < v.length && lastKb[i] === v[i]) i++;
  for (let n = 0; n < lastKb.length - i; n++) send({ t: "key", k: "backspace" });
  const add = v.slice(i);
  if (add) send({ t: "type", s: add });
  lastKb = v;
});
kbinput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); send({ t: "key", k: "enter" }); }
});

// --- Alt+Tab modo selección: Alt queda apretado hasta "Elegir" ---
const altpanel = document.getElementById("altpanel");
document.querySelectorAll("[data-alt]").forEach((b) =>
  b.addEventListener("click", () => {
    const action = b.dataset.alt;
    send({ t: "key", k: "alttab_" + action });   // open | next | prev | done
    if (action === "open") altpanel.classList.remove("hidden");
    else if (action === "done") altpanel.classList.add("hidden");
  }));
