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
let scrollAcc = 0;
let dragging = false;   // modo arrastre activo (clic izquierdo apretado)
const TAP_MS = 300;
const TAP_SLOP = 14;
const SCROLL_DIV = 12;   // px de dedo por "línea" de scroll (mayor = más lento)

pad.addEventListener("touchstart", (e) => {
  e.preventDefault();
  // si el teclado del celular estaba abierto, cerrarlo al volver al pad
  if (document.activeElement === kbinput) kbinput.blur();
  // targetTouches = solo los dedos sobre el pad (ignora el dedo que mantiene
  // apretado el botón de clic), así se puede arrastrar con un dedo en el pad
  const tt = e.targetTouches;
  if (tt.length === 1) {
    lastX = tt[0].clientX;
    lastY = tt[0].clientY;
    moved = false;
    startTime = Date.now();
  } else if (tt.length === 2) {
    twoLastY = (tt[0].clientY + tt[1].clientY) / 2;
    scrollAcc = 0;
  }
}, { passive: false });

pad.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const tt = e.targetTouches;
  if (tt.length === 1) {
    const x = tt[0].clientX, y = tt[0].clientY;
    const dx = x - lastX, dy = y - lastY;
    lastX = x; lastY = y;
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved = true;
    send({ t: "move", dx, dy });
  } else if (tt.length === 2) {
    const y = (tt[0].clientY + tt[1].clientY) / 2;
    const dy = y - twoLastY;
    twoLastY = y;
    moved = true;
    // px -> líneas, acumulando el resto para no perder los movimientos chicos
    scrollAcc += dy / SCROLL_DIV;
    const lines = Math.trunc(scrollAcc);
    if (lines !== 0) { send({ t: "scroll", dy: lines }); scrollAcc -= lines; }
  }
}, { passive: false });

pad.addEventListener("touchend", (e) => {
  e.preventDefault();
  const tt = e.targetTouches;
  if (!dragging && !moved && (Date.now() - startTime) < TAP_MS && tt.length === 0) {
    send({ t: "click", btn: "left" });
  }
  // al pasar de 2 dedos a 1, re-anclar para no producir un salto del cursor
  if (tt.length === 1) {
    lastX = tt[0].clientX;
    lastY = tt[0].clientY;
  }
}, { passive: false });

// --- Botones de clic ---
document.querySelectorAll("[data-click]").forEach((b) =>
  b.addEventListener("click", () => send({ t: "click", btn: b.dataset.click })));

// --- Arrastrar (toggle): aprieta el clic izquierdo y lo deja apretado; movés
//     con un dedo en el pad; tocás de nuevo para soltar ---
const dragbtn = document.getElementById("dragbtn");
dragbtn.addEventListener("click", () => {
  dragging = !dragging;
  send({ t: dragging ? "press" : "release", btn: "left" });
  dragbtn.classList.toggle("active", dragging);
  dragbtn.textContent = dragging ? "✋ Soltar" : "✊ Arrastrar";
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
