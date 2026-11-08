# AGENDA TV GRAPHICS (Fase 1 + nueva versión)
1. Sube la carpeta a GitHub Pages (los módulos ES necesitan http/https).
2. Crea un proyecto Firebase con Realtime Database y pega tu config en `firebase-config.js`.
3. Reglas temporales de prueba: `{ "rules": { ".read": true, ".write": true } }` (se endurecerán en la Fase 6).
4. Panel: `/control/index.html`. OBS: Fuente de navegador con `/output/index.html`, 1920x1080, sin recargar nunca.
Sin `databaseURL` funciona en modo local (mismo navegador), solo para pruebas.

## Novedades
- **Elementos independientes**: cada texto, logo, forma o cintilla tiene su propia posición y tamaño; mover o agrandar uno no desplaza a los demás.
- **Texto grande**: tamaño máximo/mínimo, ancho y alto propios, varias líneas y ajuste automático (el texto se reduce hasta caber y nunca sale de su caja).
- **10 plantillas** de canal informativo (logo, subtítulo, categoría, noticia secundaria, cintilla…).
- **Logotipos**: subir PNG/JPG/WebP, cambiar, quitar, mover y redimensionar conservando proporciones (arrastrando en PREVIEW).
- **Cintilla**: noticias editables, movimiento continuo sin huecos, velocidad, dirección, colores, tipografía, altura/posición, separadores, pausa/reanudar y activar/ocultar EN VIVO (barra amarilla), independiente del titular.
- **Diseño**: añadir/duplicar/eliminar textos, imágenes, logos, formas y cintillas; guardar plantillas propias.
- **Titulares guardados** (sin categorías): guardar con nombre, editar, duplicar, eliminar, buscar y cargar; opcionalmente con todo su diseño y cintilla.
- Todo se sincroniza con `/program` en tiempo real, con fondo transparente. Datos nuevos: `/headlines` y `/templates`.
- Los datos antiguos de la Fase 1 (sin elementos) se ignoran y se sustituyen por plantillas nuevas.

## Animaciones, grupos y salida al aire
- **Entrada y salida** equivalentes (inversa por defecto o la que elijas), con 16 animaciones, dirección, duración, retardo y velocidad; por grupo completo o por elemento. Pruebas en PREVIEW: ▶ Entrada, ▶ Salida, ▶ Ambas, ⟲ Repetir.
- **Grupos**: Mayús + clic para multiselección; Agrupar, Desagrupar, Duplicar, Bloquear; mover y escalar con proporciones; doble clic entra en un grupo. **Alinear** y distribuir; flechas del teclado para ajuste fino.
- **Vista previa grande** (pestaña Diseño): botón «⤢ Ampliar»; Esc para cerrar.
- **Plantilla «En blanco»** (sin elementos) en Plantillas y botón «Empezar en blanco» en Diseño.
- **SALIDA AL AIRE**: un botón grande por gráfico (clic = mostrar y se pone en rojo; otro clic = ocultar). «+ Añadir gráfico» crea más (datos en `/slots`); se apilan en filas de tres.

## Cambios de la última versión
- **Capas**: la cintilla siempre va por encima; los demás gráficos entran y salen por detrás de ella, sin superponerse.
- **Switches** (pestaña propia): fila PROGRAMA (rojo, al aire) y fila PREVIEW (verde), con el nombre de cada gráfico.
- **Cintilla**: las noticias se pegan en un solo cuadro (separadas por Enter, | o •).
- **Diseño** reorganizado en tarjetas; sin iconos ni emojis en la interfaz.
