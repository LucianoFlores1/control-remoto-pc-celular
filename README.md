# Control Remoto PC ↔ Celular

Usá tu celular Android como touchpad y teclas (Win, Esc, Alt+Tab) de tu PC Windows por WiFi.

## Uso (usuario final)
1. Descargá `ControlRemoto.exe` y hacé doble clic.
   - La primera vez Windows SmartScreen puede avisar: "Más información" → "Ejecutar de todas formas".
2. Escaneá el QR de la ventana con la cámara del celular (misma WiFi).
3. Usá el touchpad y los botones.

## Desarrollo
- `pip install -r requirements.txt`
- `python server.py` (o `iniciar.bat`)
- Tests: `pytest -v`
- Generar el .exe: `build.bat` → `dist/ControlRemoto.exe`

## Notas
- PC y celular deben estar en la misma red WiFi.
- El servidor usa la IP local de la PC (no localhost) y el primer puerto libre desde 8000.
