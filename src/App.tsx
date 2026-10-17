import { isDesktopApp } from './platform';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronDown, Clock3, Diamond, Download, Flame, FolderHeart, Library, LoaderCircle, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Sparkles, Swords, Trash2, Trophy, Upload, Wifi, WifiOff, X } from 'lucide-react';
import { BOSSES, DEFAULT_SETTINGS, bossForVictory, percent, type Book, type Settings } from './model';
import { addBook, deleteBook, getFile, listBooks, loadSettings, mutateBook, requestPersistence, saveSettings } from './storage';
import { openPdf, thumbnail, type PasswordHandler } from './pdf';
import { CombatRules, Crystal, EmptyLibrary, HealthBar, InstallHelp, Modal, PrivacyNote, SettingsModal, Stat } from './components';
import Reader from './Reader';

type View = 'library' | 'chronicles' | 'bestiary';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type PasswordRequest = { retry: boolean; resolve: (value: string) => void; reject: () => void };
const timeFormat = (seconds: number) => seconds >= 3600 ? `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min` : `${Math.floor(seconds / 60)} min`;

function PasswordModal({ request, onDone }: { request: PasswordRequest; onDone: () => void }) {
  const [value, setValue] = useState('');
  return <Modal title="Este libro tiene contraseña" onClose={() => { request.reject(); onDone(); }}><p className="modal-intro">{request.retry ? 'La contraseña no es correcta. Inténtalo de nuevo.' : 'Introduce la contraseña del PDF para abrirlo. No se guardará ni se enviará a ningún servidor.'}</p><form onSubmit={e => { e.preventDefault(); request.resolve(value); onDone(); }}><label className="field">Contraseña del PDF<input autoFocus type="password" value={value} onChange={e => setValue(e.target.value)} required /></label><button className="button primary full" type="submit">Abrir libro <ArrowRight size={17} /></button></form></Modal>;
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [fatal, setFatal] = useState('');
  const [view, setView] = useState<View>('library');
  const [activeId, setActiveId] = useState(() => location.hash.startsWith('#book=') ? decodeURIComponent(location.hash.slice(6)) : null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent>();
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(isDesktopApp);
  const [filter, setFilter] = useState<'all' | 'reading' | 'finished'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [importing, setImporting] = useState('');
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean }>();
  const [deleteTarget, setDeleteTarget] = useState<Book>();
  const [menu, setMenu] = useState<string>();
  const [bossDetail, setBossDetail] = useState<typeof BOSSES[number]>();
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest>();
  const fileInput = useRef<HTMLInputElement>(null);
  const importLock = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const booksRef = useRef(books); booksRef.current = books;
  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(undefined), error ? 10000 : 6000);
  }, []);
  const askPassword = useCallback<PasswordHandler>((retry) => new Promise((resolve, reject) => {
    setPasswordRequest({ retry, resolve, reject: () => reject(new Error('Importación cancelada.')) });
  }), []);

  useEffect(() => {
    Promise.all([listBooks(), loadSettings()]).then(([savedBooks, savedSettings]) => { setBooks(savedBooks); setSettings(savedSettings); setLoaded(true); }).catch(() => { setFatal('No se pudo abrir el almacenamiento local. Permite los datos del sitio en tu navegador y vuelve a intentarlo. El modo privado puede restringir el espacio disponible.'); setLoaded(true); });
    const connected = () => setOnline(navigator.onLine);
    const cached = () => setOfflineReady(true);
    const installable = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const hashChange = () => setActiveId(location.hash.startsWith('#book=') ? decodeURIComponent(location.hash.slice(6)) : null);
    window.addEventListener('online', connected); window.addEventListener('offline', connected); window.addEventListener('offline-ready', cached); window.addEventListener('beforeinstallprompt', installable); window.addEventListener('hashchange', hashChange);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', connected); window.removeEventListener('offline-ready', cached); window.removeEventListener('beforeinstallprompt', installable); window.removeEventListener('hashchange', hashChange); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full'; }, [settings.theme, settings.reducedMotion]);
  useEffect(() => { if (!menu) return; const close = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('.book-menu-wrap')) setMenu(undefined); }; document.addEventListener('click', close); return () => document.removeEventListener('click', close); }, [menu]);
  const updateBook = useCallback(async (id: string, update: (book: Book) => Book) => {
    const next = await mutateBook(id, update);
    setBooks(current => current.map(book => book.id === id ? next : book));
    return next;
  }, []);
  const changeSettings = (next: Settings) => {
    setSettings(next); void saveSettings(next).catch(() => notify('No se pudieron guardar los ajustes. Comprueba el espacio disponible.', true));
  };
  const openBook = (book: Book) => {
    setActiveId(book.id); location.hash = `book=${encodeURIComponent(book.id)}`;
    void updateBook(book.id, current => ({ ...current, lastOpened: new Date().toISOString() })).catch(() => notify('No se pudo actualizar la fecha de apertura.', true));
    window.scrollTo(0, 0);
  };
  const goBack = () => { location.hash = ''; setActiveId(null); };
  const installApp = async () => {
    if (!installEvent) { setInstallHelp(true); return; }
    try { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(undefined); }
    catch { setInstallHelp(true); }
  };

  const importFiles = async (files: File[]) => {
    if (importLock.current || fatal) return;
    importLock.current = true;
    let lastBook: Book | undefined;
    for (const file of files) {
      let pdf: Awaited<ReturnType<typeof openPdf>> | undefined;
      try {
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') throw new Error(`«${file.name}» no es un archivo PDF.`);
        if (!file.size) throw new Error('Este archivo está vacío.');
        setImporting(file.name);
        pdf = await openPdf(file, askPassword);
        const id = pdf.fingerprints[0] || crypto.randomUUID();
        const existing = booksRef.current.find(book => book.id === id);
        if (existing) { notify('Este libro ya está en tu biblioteca. Conservamos tu progreso.'); lastBook = existing; continue; }
        let cover: string | undefined;
        try { cover = await thumbnail(pdf); } catch { /* A thumbnail failure must not reject a readable PDF. */ }
        const metadata = await pdf.getMetadata().catch(() => undefined);
        const pdfTitle = (metadata?.info as { Title?: string } | undefined)?.Title?.trim();
        const now = new Date().toISOString();
        const book: Book = {
          id, title: pdfTitle && !/^(untitled|sin t[ií]tulo|document)$/i.test(pdfTitle) ? pdfTitle : file.name.replace(/\.pdf$/i, '').replace(/[_]/g, ' '),
          fileName: file.name, totalPages: pdf.numPages, lastPage: 1,
          completedPages: [], victories: [], importedAt: now, lastOpened: now,
          readingSeconds: 0, size: file.size, cover, skins: {}
        };
        await addBook(book, file);
        booksRef.current = [...booksRef.current, book];
        setBooks(current => [...current, book]);
        lastBook = book;
        void requestPersistence();
      } catch (err) {
        const error = err as Error;
        notify(error.name === 'QuotaExceededError' ? 'No hay espacio suficiente en este navegador. Libera espacio o elimina algún libro.' : error.name === 'InvalidPDFException' ? 'Este PDF está dañado o no es compatible. Prueba con otro archivo.' : `No se pudo importar el PDF: ${error.message}`, true);
      } finally { await pdf?.loadingTask.destroy(); }
    }
    setImporting(''); importLock.current = false;
    if (lastBook) openBook(lastBook);
  };
  const importSample = async () => {
    if (importLock.current) return;
    const existing = books.find(book => book.fileName === 'El atlas de los umbrales.pdf');
    if (existing) { openBook(existing); return; }
    try {
      const response = await fetch('/sample.pdf');
      if (!response.ok) throw new Error();
      await importFiles([new File([await response.blob()], 'El atlas de los umbrales.pdf', { type: 'application/pdf' })]);
    } catch { notify('No se pudo abrir la muestra. Conéctate una vez para descargarla o importa tu propio PDF.', true); }
  };
  const downloadBook = async (book: Book) => {
    setMenu(undefined);
    try {
      const file = await getFile(book.id);
      if (!file) throw new Error();
      const url = URL.createObjectURL(file); const link = document.createElement('a');
      link.href = url; link.download = book.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { notify('No se pudo descargar el archivo guardado.', true); }
  };
  const totalPages = books.reduce((sum, book) => sum + book.completedPages.length, 0);
  const allVictories = books.flatMap(book => book.victories.map(victory => ({ ...victory, bookTitle: book.title, bookId: book.id }))).sort((a, b) => b.defeatedAt.localeCompare(a.defeatedAt));
  const xp = allVictories.length * 100, level = Math.floor(xp / 300) + 1;
  const finished = books.filter(book => percent(book) === 100).length;
  const totalSeconds = books.reduce((sum, book) => sum + book.readingSeconds, 0);
  const storageSize = books.reduce((sum, book) => sum + book.size, 0);
  const activeBook = books.find(book => book.id === activeId);
  const sortedBooks = [...books].filter(book => {
    const matches = book.title.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return matches && (filter === 'all' || (filter === 'reading' ? percent(book) < 100 : percent(book) === 100));
  }).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'es') : sort === 'progress' ? percent(b) - percent(a) : b.lastOpened.localeCompare(a.lastOpened));
  const recent = [...books].filter(book => percent(book) < 100).sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))[0];

  return <>
    <input className="visually-hidden" ref={fileInput} type="file" accept="application/pdf,.pdf" multiple aria-label="Importar archivos PDF" onChange={e => { if (e.target.files) void importFiles([...e.target.files]); e.target.value = ''; }} />
    {loaded && activeBook && !fatal ? <Reader key={activeBook.id} book={activeBook} settings={settings} onUpdate={updateBook} onBack={goBack} password={askPassword} onSettings={() => setSettingsOpen(true)} onChangeSettings={changeSettings} notify={notify} blocked={settingsOpen || !!passwordRequest} /> : <div className="app-shell" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); void importFiles([...e.dataTransfer.files]); }}>
      <aside className="sidebar"><a href="#" className="brand" onClick={() => { setView('library'); setActiveId(null); }} aria-label="Final Reader, inicio"><Crystal /><span>FINAL<span className="brand-light">READER</span><small>EVERY PAGE IS AN ADVENTURE</small></span></a>
        <span className="sidebar-label">TU REFUGIO</span>
        <nav className="main-navigation" aria-label="Navegación principal"><button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Library size={19} /><span>Biblioteca</span><span className="nav-count">{books.length}</span></button><button className={view === 'chronicles' ? 'active' : ''} onClick={() => setView('chronicles')}><Trophy size={19} /><span>Mis hazañas</span>{allVictories.length > 0 && <span className="nav-dot" />}</button><button className={view === 'bestiary' ? 'active' : ''} onClick={() => setView('bestiary')}><Swords size={19} /><span>Bestiario</span><span className="new-badge">{BOSSES.length}</span></button></nav>
        <div className="sidebar-adventure"><div className="small-spark">✦</div><p>Las grandes aventuras<br />empiezan con una página.</p><span>Haz de la lectura tu ritual.</span></div>
        <div className="sidebar-bottom"><button className="sidebar-action" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /> Ajustes</button><button className="sidebar-action" onClick={() => void installApp()}><ArrowDownToLine size={18} /> {isDesktopApp ? 'Aplicación de escritorio' : 'Instalar aplicación'}<ArrowRight size={14} /></button><div className="adventurer"><div className="avatar"><Diamond size={20} /></div><div><strong>Lector errante <span>NV. {level}</span></strong><div className="xp-track"><i style={{ width: `${xp % 300 / 3}%` }} /></div><small>{xp % 300} / 300 EXP para el siguiente nivel</small></div></div><span className="sidebar-version">FINAL READER <span>v1.3 · HECHO PARA LEER</span></span></div>
      </aside>
      <div className="workspace"><header className="topbar"><div className="breadcrumb"><span>Tu santuario de lectura</span><ChevronDown size={13} /><span>{view === 'library' ? 'Biblioteca' : view === 'chronicles' ? 'Mis hazañas' : 'Bestiario'}</span></div><div className="topbar-right"><span className="local-badge"><span className="status-dot" /><ShieldCheck size={13} /> Espacio privado</span><span className="topbar-separator" /><button className="icon-button mobile-settings" aria-label="Abrir ajustes" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button><button className="level-badge" title="Ver mis hazañas" onClick={() => setView('chronicles')}><Diamond size={14} /><span>Nivel {level}</span></button></div></header>
        <main className="dashboard">
          {!loaded ? <div className="initial-loading"><LoaderCircle className="spin" size={28} /><p>Preparando tu biblioteca…</p></div> : fatal ? <div className="fatal-state" role="alert"><ShieldCheck size={36} /><h1>Necesitamos un lugar para tus libros</h1><p>{fatal}</p><button className="button primary" onClick={() => location.reload()}>Reintentar</button></div> : <>
            {view === 'library' && <>
              <div className="page-heading"><div><div className="eyebrow"><span className="tiny-line" /> EL PRÓXIMO CAPÍTULO TE ESPERA</div><h1>Tu biblioteca. <span>Tu aventura.</span></h1><p>Un refugio para tus libros. Un nuevo mundo en cada página.</p></div><button className="button primary import-top" disabled={!!importing} onClick={() => fileInput.current?.click()}><Plus size={18} /> Importar PDF</button></div>
              <section className="adventure-hero"><div className="hero-grid" /><div className="hero-content"><span className="hero-tag"><Sparkles size={13} /> TU HISTORIA COMIENZA AQUÍ</span><h2>Cada página,<br />una nueva <em>conquista.</em></h2><p>Sumérgete en tus libros. Desafía a criaturas legendarias.<br className="desktop-break" /> Convierte el hábito de leer en tu mejor aventura.</p><div className="hero-buttons"><button className="button primary" onClick={() => recent ? openBook(recent) : fileInput.current?.click()}>{recent ? <BookOpen size={17} /> : <Upload size={17} />}{recent ? 'Continuar leyendo' : 'Comenzar mi aventura'}<ArrowRight size={16} /></button><button className="hero-sample" onClick={() => void importSample()}>Explorar una muestra <ArrowRight size={15} /></button></div><PrivacyNote /></div><div className="hero-art" aria-hidden="true"><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" /><img src={BOSSES[0].image} alt="" /><div className="hero-enemy-label"><span className="gold-spark">✦</span><div><span>EL PRIMER GUARDIÁN</span><strong>{BOSSES[0].name}</strong></div><span className="hero-enemy-level">I</span></div></div><span className="hero-corner top-left" /><span className="hero-corner bottom-right" /></section>
              <section className="stats-row" aria-label="Estadísticas de lectura"><Stat icon={<BookOpen size={20} />} label="Páginas conquistadas" value={totalPages} detail="páginas" /><Stat icon={<Swords size={21} />} label="Jefes derrotados" value={allVictories.length} detail="victorias" /><Stat icon={<Sparkles size={20} />} label="Experiencia ganada" value={xp} detail="EXP" /><Stat icon={<Clock3 size={20} />} label="Tiempo entre mundos" value={timeFormat(totalSeconds)} detail="de lectura" /></section>
              <section className="library-section"><div className="section-title"><div><h2>Tu biblioteca <span>{books.length}</span></h2><p>Historias que te esperan, mundos que te pertenecen.</p></div><div className="library-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar un libro…" aria-label="Buscar en la biblioteca" />{query && <button className="icon-button" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={14} /></button>}</div></div><div className="library-filters"><div className="tabs" role="group" aria-label="Filtrar libros"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos los libros <span>{books.length}</span></button><button className={filter === 'reading' ? 'active' : ''} onClick={() => setFilter('reading')}>En lectura</button><button className={filter === 'finished' ? 'active' : ''} onClick={() => setFilter('finished')}>Completados{finished > 0 && <span>{finished}</span>}</button></div><label className="sort-control"><span>Ordenar por:</span><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Ordenar biblioteca"><option value="recent">Más recientes</option><option value="title">Título A–Z</option><option value="progress">Progreso</option></select></label></div>
                {!sortedBooks.length ? <EmptyLibrary onImport={() => fileInput.current?.click()} onSample={() => void importSample()} filtered={!!query || filter !== 'all'} /> : <div className="book-grid">{sortedBooks.map((book, index) => <article className="book-card" key={book.id}><button className={`book-cover cover-${index % 4}`} onClick={() => openBook(book)} aria-label={`Leer ${book.title}`}><div className="book-cover-inner">{book.cover ? <img src={book.cover} alt={`Portada de ${book.title}`} /> : <><BookOpen size={42} /><strong>{book.title}</strong></>}<span className="cover-read-overlay"><BookOpen size={19} /> {book.completedPages.length ? 'Seguir leyendo' : 'Abrir libro'}</span></div><span className="file-badge">PDF</span>{percent(book) === 100 && <span className="finished-badge"><Check size={13} /> Completado</span>}</button><div className="book-details"><div className="book-title-row"><button onClick={() => openBook(book)}><h3 title={book.title}>{book.title}</h3></button><div className="book-menu-wrap"><button className="icon-button" aria-label={`Opciones de ${book.title}`} aria-expanded={menu === book.id} onClick={() => setMenu(menu === book.id ? undefined : book.id)}><MoreHorizontal size={18} /></button>{menu === book.id && <div className="book-menu"><button onClick={() => void downloadBook(book)}><Download size={15} /> Descargar PDF</button><button className="danger-text" onClick={() => { setDeleteTarget(book); setMenu(undefined); }}><Trash2 size={15} /> Eliminar libro</button></div>}</div></div><div className="book-meta"><span>{book.totalPages} páginas</span><span><Swords size={12} />{book.victories.length} {book.victories.length === 1 ? 'victoria' : 'victorias'}</span></div><div className="book-progress-label"><span>{book.completedPages.length ? `${book.completedPages.length} páginas leídas` : 'La aventura te espera'}</span><b>{percent(book)}%</b></div><div className="progress-track"><i style={{ width: `${percent(book)}%` }} /></div></div></article>)}<button className="add-book-card" onClick={() => fileInput.current?.click()}><span><Plus size={25} /></span><strong>Una nueva aventura</strong><small>Importa un PDF de tu dispositivo</small></button></div>}
              </section><div className="library-bottom-note"><span><ShieldCheck size={15} /> Tu biblioteca es solo tuya. No subimos tus archivos a ningún servidor.</span><span>{storageSize ? `${(storageSize / 1024 / 1024).toFixed(1)} MB guardados localmente` : 'Sin cuentas. Sin límites de aventuras.'}</span></div>
            </>}
            {view === 'chronicles' && <><div className="page-heading"><div><div className="eyebrow"><span className="tiny-line" /> EL REGISTRO DE TU AVENTURA</div><h1>Tus páginas. <span>Tus hazañas.</span></h1><p>Cada pequeño paso deja una gran historia.</p></div><div className="chronicle-level"><Diamond size={22} /><span>NIVEL {level}<small>{xp} EXP acumulada</small></span></div></div><section className="stats-row"><Stat icon={<BookOpen size={20} />} label="Páginas leídas" value={totalPages} detail="páginas" /><Stat icon={<Trophy size={20} />} label="Victorias" value={allVictories.length} detail="jefes" /><Stat icon={<FolderHeart size={20} />} label="Libros completados" value={finished} detail="historias" /><Stat icon={<Clock3 size={20} />} label="Tiempo de lectura" value={timeFormat(totalSeconds)} detail="" /></section><section className="chronicles"><div className="section-title"><div><h2>El salón de las victorias</h2><p>Tus conquistas se guardan aquí, una página a la vez.</p></div><Trophy size={22} /></div>{!allVictories.length ? <div className="empty-library"><div className="empty-symbol gold"><Trophy size={28} /></div><h3>Tu leyenda está por escribirse</h3><p>Completa 10 páginas nuevas de un libro para registrar tu primera victoria y ganar 100 EXP.</p><button className="button secondary" onClick={() => setView('library')}>Ir a mi biblioteca <ArrowRight size={16} /></button></div> : <div className="victory-list">{allVictories.map(victory => <button key={`${victory.bookId}-${victory.bossIndex}`} onClick={() => { const book = books.find(item => item.id === victory.bookId); if (book) openBook(book); }}><div className="victory-list-art"><img src={bossForVictory(victory).image} alt="" /></div><div><span className="eyebrow">VICTORIA · ENCUENTRO {victory.bossIndex + 1}</span><h3>{victory.name}</h3><p>{victory.bookTitle}</p></div><div className="victory-reward"><strong>+100 EXP</strong><small>{new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(victory.defeatedAt))}</small></div><ChevronDown size={17} /></button>)}</div>}</section></>}
            {view === 'bestiary' && <><div className="page-heading"><div><div className="eyebrow"><span className="tiny-line" /> MÁS ALLÁ DE LA SIGUIENTE PÁGINA</div><h1>Conoce a tus <span>adversarios.</span></h1><p>Diez guardianes originales. Un desafío: seguir descubriendo.</p></div></div><div className="bestiary-intro"><Swords size={23} /><div><h3>La constancia es tu mejor arma</h3><p>Cada jefe tiene 100 PV. Cada página nueva completada inflige 10 de daño. Tras 10 páginas, ganas 100 EXP y aparece el siguiente guardián. El ciclo se repite.</p></div></div><div className="bestiary-grid">{BOSSES.map((boss, index) => <button key={boss.id} className="bestiary-card" style={{ '--boss-color': boss.color } as React.CSSProperties} onClick={() => setBossDetail(boss)}><div className="bestiary-art"><span>{String(index + 1).padStart(2, '0')}</span><img src={boss.image} alt={boss.name} loading="lazy" /></div><div className="bestiary-info"><span className="eyebrow">{boss.type}</span><h2>{boss.name}</h2><p>{boss.epithet}</p><span className="bestiary-link">Descubrir guardián <ArrowRight size={16} /></span></div></button>)}</div><div className="info-box bestiary-note"><PencilIcon /><p>¿Tu propio rival? Desde el panel de combate de cada libro puedes cambiar el nombre y la imagen del jefe. La personalización se guarda solo para ese libro.</p></div></>}
          </>}
          <footer className="dashboard-footer"><span><Crystal small /> FINAL READER <i>Un capítulo más allá.</i></span><span className={online ? '' : 'offline'}>{online ? (offlineReady ? <WifiOff size={13} /> : <Wifi size={13} />) : <WifiOff size={13} />}{online ? (offlineReady ? 'Disponible sin conexión' : 'Todo se guarda en tu dispositivo') : 'Estás sin conexión · Tu aventura continúa'}</span></footer>
        </main>
      </div>
      {dragging && <div className="drop-zone"><Upload size={44} /><h2>Una nueva aventura está por llegar</h2><p>Suelta aquí tus archivos PDF para añadirlos a tu biblioteca.</p></div>}
    </div>}
    {settingsOpen && <SettingsModal settings={settings} onChange={changeSettings} onClose={() => setSettingsOpen(false)} onInstall={() => { setSettingsOpen(false); void installApp(); }} />}
    {installHelp && <InstallHelp onClose={() => setInstallHelp(false)} />}
    {deleteTarget && <Modal title="¿Cerrar este capítulo?" onClose={() => setDeleteTarget(undefined)}><p className="modal-intro">Se eliminarán «{deleteTarget.title}», sus páginas completadas, sus victorias y sus personalizaciones de este dispositivo. Esta acción no se puede deshacer.</p><div className="button-row end"><button className="button secondary" onClick={() => setDeleteTarget(undefined)}>Conservar libro</button><button className="button danger" onClick={async () => { try { await deleteBook(deleteTarget.id); setBooks(current => current.filter(book => book.id !== deleteTarget.id)); setDeleteTarget(undefined); notify('El libro se ha eliminado de este dispositivo.'); } catch { notify('No se pudo eliminar el libro.', true); } }}><Trash2 size={16} /> Eliminar libro</button></div></Modal>}
    {bossDetail && <Modal title={bossDetail.name} onClose={() => setBossDetail(undefined)}><div className="boss-detail-art"><img src={bossDetail.image} alt={bossDetail.name} /></div><span className="eyebrow">{bossDetail.type}</span><h3 className="boss-detail-epithet">{bossDetail.epithet}</h3><p className="modal-intro">{bossDetail.description}</p><HealthBar health={100} /><CombatRules /></Modal>}
    {passwordRequest && <PasswordModal key={String(passwordRequest.retry)} request={passwordRequest} onDone={() => setPasswordRequest(undefined)} />}
    {importing && <div className="import-status" role="status"><LoaderCircle size={21} className="spin" /><div><strong>Preparando tu libro…</strong><span>{importing}</span></div><ShieldCheck size={19} /></div>}
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <Flame size={19} /> : <Check size={19} />}<p>{toast.text}</p><button className="icon-button" aria-label="Cerrar aviso" onClick={() => setToast(undefined)}><X size={16} /></button></div>}
  </>;
}

function PencilIcon() { return <Settings2 size={22} />; }
