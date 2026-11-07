# AGENDA TV GRAPHICS (Fase 1)
1. Sube la carpeta a GitHub Pages (los módulos ES no funcionan abriendo el archivo con doble clic; necesitan http/https).
2. Crea un proyecto Firebase con Realtime Database y pega tu config en `firebase-config.js`.
3. Reglas temporales de prueba (Realtime Database > Reglas): `{ "rules": { ".read": true, ".write": true } }`. Se endurecerán en la Fase 6.
4. Panel: `/control/index.html`. OBS: Fuente de navegador con la URL de `/output/index.html`, 1920x1080.
Sin `databaseURL` funciona en modo local (misma ventana del navegador), solo para pruebas.

## Fase 1b
Plantillas por elementos independientes, ajuste de texto sin mover el resto, tamaño del titular por separado y lista de guardados por gráfico (Firebase `/library`).
Sube TODO el contenido de nuevo y recarga con Ctrl+F5.
