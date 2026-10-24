const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { join, resolve } = require('node:path');
const { mkdirSync } = require('node:fs');
const { startAssetServer, isLocalURL, isYouTubeURL } = require('./server.cjs');

app.setName('Final Reader');
const profile = process.env.FINAL_READER_DATA_DIR
  ? resolve(process.env.FINAL_READER_DATA_DIR)
  : join(app.getPath('appData'), 'Final Reader');
mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.setPath('sessionData', profile);
app.setAppUserModelId('com.finalreader.desktop');

let window;
let assets;
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show(); window.focus();
  });
  app.whenReady().then(async () => {
    assets = await startAssetServer(join(__dirname, '..', 'dist'));
    window = new BrowserWindow({
      title: 'Final Reader', width: 1380, height: 900, minWidth: 800, minHeight: 620,
      backgroundColor: '#100f16', show: false, autoHideMenuBar: true,
      icon: join(__dirname, '..', 'dist', 'icon-512.png'),
      webPreferences: {
        contextIsolation: true, sandbox: true, nodeIntegration: false,
        webSecurity: true, allowRunningInsecureContent: false,
        webviewTag: false, navigateOnDragDrop: false, spellcheck: false
      }
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Final Reader', submenu: [{ role: 'quit', label: 'Salir' }] },
      { label: 'Editar', submenu: [{ role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
      { label: 'Ver', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] }
    ]));
    const contents = window.webContents;
    const allowedPermission = (contents, permission, url) => contents === window?.webContents &&
      (permission === 'persistent-storage' && isLocalURL(url, assets.origin) ||
       permission === 'fullscreen' && (isLocalURL(url, assets.origin) || isYouTubeURL(url)));
    contents.session.setPermissionRequestHandler((source, permission, callback, details) => {
      callback(allowedPermission(source, permission, details.requestingUrl));
    });
    contents.session.setPermissionCheckHandler((source, permission, origin, details) => {
      return allowedPermission(source, permission, details.requestingUrl || origin);
    });
    contents.setWindowOpenHandler(({ url }) => {
      if (isYouTubeURL(url)) void shell.openExternal(url).catch(() => {});
      return { action: 'deny' };
    });
    contents.on('will-navigate', event => { if (!isLocalURL(event.url, assets.origin)) event.preventDefault(); });
    contents.on('will-attach-webview', event => event.preventDefault());
    // Library downloads retain Chromium's native Save As dialog.
    contents.session.on('will-download', (_event, item) => {
      const source = item.getURL();
      if (!source.startsWith(`blob:${assets.origin}/`)) item.cancel();
      else item.setSaveDialogOptions({ title: 'Guardar PDF', filters: [{ name: item.getFilename().toLowerCase().endsWith('.png') ? 'Imagen PNG' : 'Documento PDF', extensions: [item.getFilename().toLowerCase().endsWith('.png') ? 'png' : 'pdf'] }] });
    });
    window.once('ready-to-show', () => window.show());
    window.on('closed', () => { window = null; });
    await window.loadURL(assets.origin);
  }).catch(error => {
    const message = error.code === 'EADDRINUSE'
      ? 'No se pudo abrir el lector porque su dirección local está ocupada. Cierra otras ventanas de Final Reader y vuelve a intentarlo. Si continúa, reinicia la computadora.'
      : 'No se pudo iniciar Final Reader. Vuelve a instalar la aplicación. Tus libros guardados no se eliminan al reinstalar.';
    dialog.showErrorBox('Final Reader', message); app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => assets?.server.close());
}
