# Final Reader

Lector de PDF privado con alma de RPG. Una PWA en español, gratuita, sin cuentas, anuncios propios, suscripciones, analítica ni servidor de libros. La música de YouTube es opcional y conserva el reproductor, anuncios y restricciones del servicio. React, TypeScript, Vite, PDF.js e IndexedDB.

## Aplicación de Windows (.exe)

La versión de escritorio incluye su propio motor de navegación. **No necesitas Node.js, npm, una terminal, Chrome ni un servidor Vite para usar el ejecutable.** Es compatible con Windows 10/11 de 64 bits.

En [Releases](https://github.com/luisfabricio7771/App-readign/releases) encontrarás dos archivos por versión:

- `FinalReader-1.4.0-Setup.exe`: instalador para tu usuario, con selección de carpeta y accesos directos en el escritorio y menú Inicio; no requiere administrador.
- `FinalReader-1.4.0-Portable.exe`: un solo archivo que puedes guardar y abrir con doble clic, sin instalarlo. Durante el arranque extrae temporalmente su motor de lectura; puede tardar unos segundos.

El lector, la muestra y las ilustraciones vienen incluidos y funcionan sin internet **desde el primer inicio**. La música de YouTube sigue necesitando conexión. Los PDF y el progreso se guardan en `%APPDATA%\Final Reader`, fuera de la carpeta de instalación. La aplicación instalada y la portátil usan la misma biblioteca; las actualizaciones y la desinstalación conservan los datos. Chrome tiene una biblioteca independiente: los libros y el progreso del navegador no se transfieren automáticamente. Puedes importar tus PDF originales en la aplicación.

El ejecutable no tiene certificado comercial de firma de Windows; el sistema puede mostrar un aviso de editor desconocido. Descarga los archivos de este repositorio y consulta `SHA256SUMS.txt` en la misma publicación.

### Compilar la versión de escritorio

Solo para desarrollar o generar tus propios ejecutables, necesitas Node.js 24 y las dependencias del proyecto:

```sh
npm ci
npm run desktop:start       # Compila y abre la ventana de escritorio
npm run desktop:dist        # Genera los dos .exe de Windows en release/
```

El empaquetado oficial se realiza en Windows mediante `.github/workflows/windows-desktop.yml`, al publicar una etiqueta `v` que coincida con `package.json`. El flujo compila, prueba la aplicación empaquetada en Windows, genera SHA256 y publica los archivos solo después de superar las pruebas. No requiere claves de API ni un certificado de pago. El disparo manual genera artefactos sin publicar una release.

El proceso principal de Electron sirve únicamente los recursos empaquetados a través de `127.0.0.1:43763`, una dirección interna que no se anuncia en la red. No sirve la biblioteca ni recibe archivos. El origen permanece fijo para conservar IndexedDB. Si el puerto está ocupado, muestra un error en vez de cambiar de origen y hacer desaparecer aparentemente los datos. Se utiliza una sola instancia, aislamiento de contexto, sandbox, integración de Node desactivada en el lector, CSP, permisos limitados y bloqueo de navegación externa. Los enlaces oficiales de YouTube se abren en el navegador externo.

Para validar el proceso de escritorio:

```sh
npm run test:desktop-server # Rutas, MIME, CSP y restricciones de acceso
npm run desktop:runtime    # Descarga y verifica el motor de Electron
npm run build
npm run test:desktop        # PDF real, sin conexión, persistencia y aislamiento
```

`FINAL_READER_TEST_EXECUTABLE` permite ejecutar la prueba contra un binario empaquetado. `FINAL_READER_DATA_DIR` permite usar un perfil independiente de pruebas. En contenedores Linux sin sandbox de sistema disponible, el arnés admite `FINAL_READER_TEST_NO_SANDBOX=1`; no se añade esa opción al producto ni se utiliza en las pruebas de Windows. En Linux, la prueba necesita una pantalla X11 o Xvfb.

## Empezar

Requiere Node.js **22.13 o posterior** (recomendado: **24 LTS**) y npm.

```sh
npm ci
npm run dev
```

El script `postinstall` prepara los recursos locales de PDF.js, los iconos instalables y un PDF de muestra original de 24 páginas. No descarga libros ni imágenes de terceros. Abre la dirección que muestra Vite. Importa un PDF o pulsa **Explorar una muestra**.

Antes de cada arranque y compilación se prepara un worker estático de la misma versión que PDF.js en `public/pdf/`. Así, su carga no depende de importar un módulo desde `node_modules`, una ruta que puede fallar en Vite sobre Windows. El worker se incluye también en la caché sin conexión.

```sh
npm run build
npm run preview
```

La PWA y el funcionamiento sin conexión se prueban con la compilación de producción (`preview`), no con el servidor de desarrollo. Para publicarla basta servir `dist/` en un alojamiento estático con **HTTPS**, desde la raíz del dominio. No hay backend, variables de entorno ni claves que configurar.

## Lo que incluye

- Biblioteca con portadas reales, búsqueda, filtros, ordenación, descarga del PDF original y eliminación con confirmación.
- Importación múltiple y arrastrar/soltar; detección de duplicados por la huella del documento. Los PDF cifrados solicitan contraseña sin guardarla.
- Lectura individual o continua, ajuste al ancho, zoom, navegación por botones, flechas del teclado y deslizamiento horizontal en modo individual sin ampliar.
- Búsqueda de texto local, resultados por página, resaltado y selección de texto. Los documentos escaneados sin capa de texto se pueden leer; no se hace OCR.
- Recuerdo automático de la última página, páginas completadas, tiempo de lectura, victorias y ajustes.
- Interfaz oscura o clara, reducción de animaciones y pantalla completa cuando el navegador la permite.
- Panel de combate ocultable en computadora y pequeño indicador desplegable en móvil. Las animaciones permanecen en el panel y las victorias aparecen en una franja que no cubre el texto.
- Diez jefes originales, bestiario, registro de victorias, experiencia y niveles. Nombre e imagen personalizables por libro. Las imágenes se redimensionan localmente.
- Animación de hoja 3D de 640 ms en página individual, con sombras y dirección inversa al retroceder. Se espera a que el destino esté renderizado y se mantienen como máximo la hoja actual y el destino, sin renderizar el libro completo. Los cambios rápidos se agrupan hacia el último destino solicitado.
- Jefes flotantes con aura, retroceso, destello, «-10% HP», disolución y sello «BOSS DEFEATED». Interruptores separados para hojas y jefes; ambas opciones respetan `prefers-reduced-motion` y la preferencia global de movimiento reducido.
- Panel musical con API oficial de YouTube: enlaces de videos y playlists, reproducción/pausa, volumen cuando el dispositivo lo permite, siguiente video, favoritos locales y último enlace reproducido.
- Instalación PWA e importación/lectura de libros sin conexión después de la primera carga completa. El worker, fuentes y mapas de caracteres de PDF.js también se guardan para uso sin conexión.

## Reglas del combate

Cada libro tiene un progreso independiente. **Cambiar de página nunca provoca daño.** Pulsa **Página leída** o la tecla **L** para completar la página que se ha renderizado. Cada página distinta hace 10 de daño; volver a completarla no daña ni otorga experiencia. El guardado se realiza en una transacción de IndexedDB para evitar recompensas duplicadas.

Después de diez páginas distintas se registra una victoria y se ganan **100 EXP**. Aparece otro jefe con 100 PV. La página once lo deja en 90 PV. Hay diez apariencias que se repiten en orden, conservando un número distinto para cada encuentro. Cada 300 EXP se sube un nivel. Si un libro termina sin completar otra tanda de diez, el último jefe conserva la vida restante: no se inventan páginas ni victorias.

La detección automática es **opcional y está apagada inicialmente**. En Ajustes puedes elegir entre 30 segundos y 5 minutos por página. Solo cuenta mientras la página está renderizada y estable, la app tiene el foco y está visible, sin búsquedas, diálogos o combate móvil desplegado. El tiempo de giro de una hoja no cuenta como lectura. Cambiar de página reinicia el temporizador. Es una ayuda basada en tiempo, no una comprobación de comprensión de lectura.

## Privacidad y almacenamiento

Los PDF se procesan en el navegador y se guardan como `Blob` en IndexedDB, junto con sus metadatos y progreso. No se envían archivos ni textos a servicios externos. Los recursos del lector se sirven desde su propio origen. No se usan fuentes remotas ni analítica propia. Abrir el panel musical no conecta con YouTube; la conexión externa empieza cuando el usuario carga un enlace. YouTube aplica su propia política de privacidad.

Los datos pertenecen al **navegador y origen actuales**. No hay sincronización entre equipos ni entre navegadores. Borrar los datos del sitio elimina la biblioteca y el progreso. Se solicita almacenamiento persistente cuando el navegador lo admite, pero el espacio disponible depende del dispositivo. Conserva tus PDF originales; la opción Descargar PDF permite recuperar una copia del archivo, **no una copia de seguridad del progreso**. El modo privado puede limitar o eliminar los datos al cerrar la sesión.

En iPhone, abre la aplicación en Safari y usa **Compartir → Añadir a pantalla de inicio**. En Windows, usa la opción de instalación de Edge o Chrome. La pantalla completa nativa no está disponible en todos los navegadores de iPhone; la app instalada permite leer sin las barras del navegador. La instalación requiere HTTPS (o un origen local de desarrollo) y una primera carga con conexión.

## Música de YouTube

Pulsa el icono musical de la cabecera del lector, pega un enlace y selecciona **Cargar enlace**. Después pulsa **Reproducir** o usa los controles oficiales. No se usa YouTube Data API, búsqueda de videos, claves, cuentas de Final Reader ni extracción de audio.

El panel ocupa su propio espacio junto al PDF en computadora y debajo de él en móvil. Se puede redimensionar horizontalmente en escritorio y desplazar en ambos tamaños. **Minimizar** conserva la instancia y mantiene visible el iframe oficial con al menos **200 × 200 píxeles**. **Cerrar** pausa la reproducción y conserva la instancia para volver a abrirla durante esa lectura. Cambiar de página o completar ataques no reconstruye el reproductor. Al salir del libro, se destruye y el último enlace reproducido queda guardado.

La reproducción se pausa si se oculta la app, se pierde la conexión, se cierra el panel, se abre una ventana que lo cubre o el reproductor deja de estar completamente visible. No se promete música en segundo plano ni con la pantalla bloqueada. En iPhone, el volumen puede depender de los botones del dispositivo. Las playlists, anuncios, inserción y disponibilidad de cada video quedan sujetos a YouTube.

Los favoritos, el volumen y el último enlace se guardan localmente en IndexedDB. La actualización a la versión 2 de la base añade un almacén musical sin borrar libros, progreso, ajustes ni imágenes propias. Las victorias anteriores conservan su nombre e ilustración histórica.

Referencias oficiales: [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [parámetros del reproductor](https://developers.google.com/youtube/player_parameters) y [funcionalidad mínima requerida](https://developers.google.com/youtube/terms/required-minimum-functionality).

## Los diez guardianes

Ala de Amatista, Sol de Ámbar, Corona de Escarcha, Hoja de Obsidiana, Ojo del Infinito (el antiguo Astralis), Eclipse Carmesí, Loto Esmeralda, Reloj del Vacío, Mariposa Lunar y Corona del Alba. Se mantienen las claves internas de los cinco primeros para conservar las personalizaciones existentes.

## Verificación

```sh
npm test                 # Reglas de combate y progresión
npm run build           # TypeScript + producción + service worker
npx playwright install chromium
npm run test:e2e         # Ejecutar después de build
```

Si ya tienes Chromium instalado, puedes utilizarlo sin descargar otro navegador. En el entorno de nube de este repositorio:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Las pruebas adicionales comprueban el giro en ambos sentidos, cambios rápidos en un PDF de 120 páginas, zoom, gestos móviles, ausencia de daño durante la transición, movimiento reducido, reacciones de jefes y migración desde datos anteriores. Los controles musicales se prueban con un **doble de la IFrame API utilizado únicamente en los tests**, incluida la persistencia de la instancia, playlists, favoritos, volumen, errores, visibilidad y falta de conexión. La red del entorno de nube utilizado para desarrollar esta versión bloquea YouTube (403 del proxy), de modo que no se ha verificado allí la reproducción real de un video; esa comprobación requiere un navegador con acceso al servicio.

Las pruebas de navegador usan PDF reales y dos tamaños: escritorio y móvil con dimensiones de iPhone 13. Comprueban renderizado, búsqueda, navegación, zoom, lectura continua, combate de diez páginas, salto a la página 50, duplicados, persistencia, personalización con imagen, ajustes, errores, eliminación y lectura de un PDF guardado tras desconectar la red. Una prueba adicional ejecuta Vite en desarrollo, bloquea las importaciones antiguas del worker desde `node_modules` y comprueba que se importa y renderiza un PDF con un worker real, sin recurrir a un fake worker. La emulación móvil usa Chromium; no sustituye una prueba en Safari sobre un iPhone físico.

Para actualizar una copia descargada: detén el servidor con Ctrl + C, descomprime la versión nueva en otra carpeta, entra en la carpeta que contiene `package.json`, ejecuta `npm ci` y después `npm run dev -- --port 5173 --strictPort`. En PowerShell puedes utilizar `npm.cmd`. Abre la misma dirección `http://localhost:5173/` para seguir usando el almacenamiento de ese navegador. No hace falta borrar datos del sitio ni eliminar la copia anterior.

## Estructura

- `src/App.tsx`: biblioteca, importación, navegación y estadísticas.
- `src/Reader.tsx`: coordinación del lector, búsqueda, combate y música.
- `src/PdfPage.tsx`: canvas y texto con sustitución atómica al renderizar.
- `src/PageTurn.tsx`: transición 3D entre la hoja actual y un destino preparado.
- `src/MusicPanel.tsx`: panel musical persistente, controles y favoritos.
- `src/youtube.ts`: validación de enlaces y carga de la API oficial.
- `src/model.ts`: reglas puras de páginas, jefes y victorias.
- `src/storage.ts`: transacciones de IndexedDB y preferencias.
- `src/pdf.ts`: PDF.js, contraseñas, portadas e imágenes.
- `src/components.tsx`: diálogos accesibles, ajustes y personalización.
- `desktop/main.cjs`: ventana nativa, perfil local, permisos y navegación.
- `desktop/server.cjs`: recursos empaquetados en una dirección interna estable.
- `electron-builder.yml`: instalador y ejecutable portátil de Windows.
- `.github/workflows/windows-desktop.yml`: compilación, prueba y publicación en Windows.
- `public/bosses/`: Ojo del Infinito en SVG y nueve ilustraciones PNG originales de geometría cósmica con fondo transparente.
- `scripts/prepare-pdf.mjs`: prepara el worker estático versionado y los recursos sin conexión antes de iniciar o compilar.
- `scripts/prepare-assets.mjs`: recursos locales, iconos y relato de muestra originales.
- `vite.config.ts`: manifiesto PWA y precaché sin servicios externos.

Las ilustraciones y el relato se crearon para Final Reader. Los guardianes siguen la dirección visual de Astralis: ojos, cristales, órbitas y símbolos arcanos. No se incluyen personajes, marcas gráficas ni imágenes de Final Fantasy. El CSS de la capa de texto deriva de PDF.js (Mozilla Foundation, Apache-2.0); ver `THIRD_PARTY_NOTICES.md`.

## Taller PDF (versión 1.4)

Abre un libro y pulsa el lápiz **Editar PDF** en la cabecera. El taller funciona localmente y sin conexión, también en la aplicación de Windows.

- Añadir texto latino, resaltados rectangulares, lápiz libre, firmas dibujadas, líneas, rectángulos, elipses e imágenes/firma escaneada. Seleccionar, mover, actualizar y eliminar las anotaciones añadidas.
- Girar páginas, reordenarlas, duplicarlas con sus anotaciones, eliminarlas, insertar páginas en blanco, unir otros PDF y extraer rangos a un documento independiente.
- Recortar márgenes por porcentaje, añadir marca de agua, numeración, título y autor.
- Rellenar campos de texto, casillas y desplegables compatibles; se exportan como contenido fijo.
- Deshacer y rehacer hasta 30 cambios. Guardar y recuperar el borrador localmente por libro, incluyendo los PDF unidos.
- Descargar la copia PDF, incorporarla a la biblioteca, exportar una página como PNG e imprimir una representación del documento editado.

**El original y su progreso nunca se reemplazan.** Guardar la copia crea un libro independiente con su propio progreso. La base de datos pasa a versión 3 añadiendo borradores sin eliminar libros, victorias, música ni ajustes. Una copia exportada es un PDF normal; para continuar editando las anotaciones por separado usa el borrador del libro original.

El taller añade contenido; no reescribe el texto original como un procesador de textos. No incluye OCR, censura segura, firma digital certificada, recuperación de contraseñas ni conversión a Word/Excel. Recortar o tapar texto no elimina la información subyacente. Los PDF cifrados requieren una copia sin contraseña antes de editarlos. La exportación reconstruye el contenido vectorial: puede omitir anotaciones, enlaces, adjuntos y marcadores previos y no conserva firmas digitales válidas. Revisa la copia y conserva el original. El texto nuevo utiliza Helvetica/WinAnsi (incluye español); caracteres no compatibles producen un error de exportación.

Las pruebas del taller comprueban rangos, reordenación, giros, recortes, uniones, páginas en blanco, campos de formulario y generación de PDF. La prueba de navegador añade texto real, recupera el borrador, reorganiza páginas, descarga el resultado y encuentra el texto exportado con PDF.js, conservando el progreso del original. La prueba nativa de Windows también guarda una copia desde el ejecutable empaquetado sin acceso a internet.
