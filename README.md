# Final Reader

Lector de PDF privado con alma de RPG. Una PWA en español, gratuita, sin cuentas, anuncios, suscripciones, analítica ni servidor de libros. React, TypeScript, Vite, PDF.js e IndexedDB.

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
- Cinco jefes originales, bestiario, registro de victorias, experiencia y niveles. Nombre e imagen personalizables por libro. Las imágenes se redimensionan localmente.
- Instalación PWA e importación/lectura de libros sin conexión después de la primera carga completa. El worker, fuentes y mapas de caracteres de PDF.js también se guardan para uso sin conexión.

## Reglas del combate

Cada libro tiene un progreso independiente. **Cambiar de página nunca provoca daño.** Pulsa **Página leída** o la tecla **L** para completar la página que se ha renderizado. Cada página distinta hace 10 de daño; volver a completarla no daña ni otorga experiencia. El guardado se realiza en una transacción de IndexedDB para evitar recompensas duplicadas.

Después de diez páginas distintas se registra una victoria y se ganan **100 EXP**. Aparece otro jefe con 100 PV. La página once lo deja en 90 PV. Hay cinco apariencias que se repiten en orden, conservando un número distinto para cada encuentro. Cada 300 EXP se sube un nivel. Si un libro termina sin completar otra tanda de diez, el último jefe conserva la vida restante: no se inventan páginas ni victorias.

La detección automática es **opcional y está apagada inicialmente**. En Ajustes puedes elegir entre 30 segundos y 5 minutos por página. Solo cuenta mientras la página está renderizada, la app tiene el foco y está visible, sin búsquedas o diálogos abiertos. Cambiar de página reinicia el temporizador. Es una ayuda basada en tiempo, no una comprobación de comprensión de lectura.

## Privacidad y almacenamiento

Los PDF se procesan en el navegador y se guardan como `Blob` en IndexedDB, junto con sus metadatos y progreso. No se envían archivos ni textos a servicios externos. Los únicos recursos de la app se sirven desde su propio origen. No se usan cookies de seguimiento ni fuentes remotas.

Los datos pertenecen al **navegador y origen actuales**. No hay sincronización entre equipos ni entre navegadores. Borrar los datos del sitio elimina la biblioteca y el progreso. Se solicita almacenamiento persistente cuando el navegador lo admite, pero el espacio disponible depende del dispositivo. Conserva tus PDF originales; la opción Descargar PDF permite recuperar una copia del archivo, **no una copia de seguridad del progreso**. El modo privado puede limitar o eliminar los datos al cerrar la sesión.

En iPhone, abre la aplicación en Safari y usa **Compartir → Añadir a pantalla de inicio**. En Windows, usa la opción de instalación de Edge o Chrome. La pantalla completa nativa no está disponible en todos los navegadores de iPhone; la app instalada permite leer sin las barras del navegador. La instalación requiere HTTPS (o un origen local de desarrollo) y una primera carga con conexión.

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

Las pruebas de navegador usan PDF reales y dos tamaños: escritorio y móvil con dimensiones de iPhone 13. Comprueban renderizado, búsqueda, navegación, zoom, lectura continua, combate de diez páginas, salto a la página 50, duplicados, persistencia, personalización con imagen, ajustes, errores, eliminación y lectura de un PDF guardado tras desconectar la red. Una prueba adicional ejecuta Vite en desarrollo, bloquea las importaciones antiguas del worker desde `node_modules` y comprueba que se importa y renderiza un PDF con un worker real, sin recurrir a un fake worker. La emulación móvil usa Chromium; no sustituye una prueba en Safari sobre un iPhone físico.

Para actualizar una copia descargada: detén el servidor con Ctrl + C, descomprime la versión nueva en otra carpeta, entra en la carpeta que contiene `package.json`, ejecuta `npm ci` y después `npm run dev -- --port 5173 --strictPort`. En PowerShell puedes utilizar `npm.cmd`. Abre la misma dirección `http://localhost:5173/` para seguir usando el almacenamiento de ese navegador. No hace falta borrar datos del sitio ni eliminar la copia anterior.

## Estructura

- `src/App.tsx`: biblioteca, importación, navegación y estadísticas.
- `src/Reader.tsx`: renderizado bajo demanda, búsqueda y lector/combatiente.
- `src/model.ts`: reglas puras de páginas, jefes y victorias.
- `src/storage.ts`: transacciones de IndexedDB y preferencias.
- `src/pdf.ts`: PDF.js, contraseñas, portadas e imágenes.
- `src/components.tsx`: diálogos accesibles, ajustes y personalización.
- `public/bosses/`: Astralis en SVG y cuatro ilustraciones PNG originales de geometría cósmica con fondo transparente.
- `scripts/prepare-pdf.mjs`: prepara el worker estático versionado y los recursos sin conexión antes de iniciar o compilar.
- `scripts/prepare-assets.mjs`: recursos locales, iconos y relato de muestra originales.
- `vite.config.ts`: manifiesto PWA y precaché sin servicios externos.

Las ilustraciones y el relato se crearon para Final Reader. Los cuatro nuevos guardianes siguen la dirección visual de Astralis: ojos, cristales, órbitas y símbolos arcanos. No se incluyen personajes, marcas gráficas ni imágenes de Final Fantasy. El CSS de la capa de texto deriva de PDF.js (Mozilla Foundation, Apache-2.0); ver `THIRD_PARTY_NOTICES.md`.
