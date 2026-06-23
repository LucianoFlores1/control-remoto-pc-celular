@echo off
pyinstaller --onefile --name ControlRemoto ^
  --add-data "static;static" ^
  --collect-all pynput ^
  server.py
echo.
echo Listo: dist\ControlRemoto.exe
pause
