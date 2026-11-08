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

## Última actualización
- **Switches** dentro de Operación, bajo los monitores: botón «Abrir switches» / «Cerrar switches» y «Añadir gráfico».
- **Empezar en blanco** crea un gráfico nuevo y vacío sin tocar el que estaba seleccionado.
- **Cintilla**: separación automática de noticias (Enter, |, • y fin de frase) con lista de las noticias detectadas.

## Versión 5
- **Diseño tiene su propio editor**: ya no se edita sobre PREVIEW. En la pestaña Diseño se ocultan los monitores PREVIEW y PROGRAMA y se muestra solo el editor, que enseña siempre el gráfico que estás editando aunque su switch esté apagado.
- **Corregido el bug del switch**: entrar a Diseño o editar allí ya no enciende el switch de PREVIEW ni abre el gráfico apagado.
- **Copiar y pegar**: botones Copiar / Pegar, clic derecho sobre el editor (Copiar, Pegar, Eliminar) y atajos Ctrl+C / Ctrl+V. Funciona con un elemento, varios o un grupo, y se puede pegar en otra fuente (cambia de fuente en «Editando» y pega).
- **Deshacer / Rehacer**: botones y atajos Ctrl+Z / Ctrl+Y (también Ctrl+Mayús+Z). Un arrastre o un rato escribiendo cuenta como un solo paso. Historial independiente por gráfico (hasta 100 pasos).
- **Textura**: formas y cuadros de texto admiten una imagen de relleno (Cargar textura / Quitar textura) con ajuste: rellenar, ajustar, estirar o mosaico.

## Versión 6 (limpieza y teléfono)
- **Diseño reordenado**: arriba solo «Editando» y la vista del editor; debajo van Añadir, Historial, Copiar y pegar y «Empezar en blanco». En pantallas grandes el editor queda a la izquierda y la lista de elementos, propiedades, grupos y alinear a la derecha (con su propio desplazamiento), así la página no se hace larga.
- **Se quitó la pestaña Animaciones**: todo está en Operación. Las opciones básicas siguen a la vista y las avanzadas (retardos, velocidad, por elemento) están en «Animación avanzada», plegada.
- **Se quitó la barra duplicada** de grupos y alinear que estaba sobre el editor (siguen en el panel derecho).
- **Teléfono**: menú superior con desplazamiento lateral, monitores lado a lado, columnas en una sola, botones y campos más grandes, y tirador y bordes de selección que se ven y se tocan bien aunque el editor sea pequeño. Mantener pulsado sobre un elemento abre el menú de copiar, pegar y eliminar.

## Versión 7 (Diseño como antes, pero más cómodo)
- **Todo vuelve abajo**: se quitó el panel pegado a la esquina derecha. Debajo del editor van Añadir, Historial y «Empezar en blanco», y más abajo Elementos, propiedades, Selección y grupos, Alinear, etc.
- **Editor fijo**: al hacer scroll el editor (con sus botones) se queda arriba y solo se desplazan los apartados de abajo.
- **Menú del clic derecho**: Copiar, Pegar, Eliminar y **Añadir**. Al pasar o tocar «Añadir» se abre otro menú al lado (como en Windows) con Texto, Logotipo, Imagen, Forma y Cintilla; el elemento nuevo aparece donde hiciste clic.
- **Se quitó la fila «Copiar y pegar»** de abajo (siguen el menú del clic derecho y Ctrl + C / Ctrl + V).
- **Varios gráficos abiertos a la vez**: en «Editando» (pestaña Diseño), tocar otro gráfico lo abre junto a los que ya estaban; se ven todos en el editor y puedes seleccionar y mover elementos de cualquiera (el que tocas pasa a ser el activo, en azul fuerte). Tocar el activo lo cierra.

## Versión 8
- **Quitar la selección**: clic en un espacio vacío del editor (o en el vacío de la lista de Elementos, o tecla Esc) deja todo sin seleccionar. Mayús + clic en vacío no la quita.
- **Elementos en cuadritos**: la lista pasa a cuadritos pequeños en varias columnas (cada uno con su tipo y nombre); los grupos van dentro de un recuadro punteado. Ya no hay que bajar para elegir un elemento.

## Versión 9
- **Orden de los switches**: arrastra un botón sobre otro, o usa «Antes» / «Después» en la lista de gráficos (dentro de «Abrir switches»). El orden se guarda en `/slotOrder` y también se aplica a «Editando».
- **Cintilla en Diseño**: al seleccionar una cintilla en el editor ahora aparecen sus noticias (texto), junto con movimiento, tipografía, colores, separador y etiqueta.
- **Tarjetas como cuadros**: las propiedades se acomodan en cuadros que se reparten el ancho disponible en vez de una columna larga.
- **Bordes completos**: el borde de selección y el cuadro de tamaño ya no se cortan cuando el elemento toca el límite del escenario en el editor.

## Versión 10
- **Corregido**: un elemento más grande que el escenario ya no se pinta encima de los botones y tarjetas ni tapa los clics. El editor recorta el contenido al escenario y deja solo un margen pequeño alrededor para ver completos el borde y el tirador.
- Si un elemento se sale del escenario, el tirador de tamaño se queda en la esquina visible, así siempre se puede reducir.
