import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeftRight, CircleCheck, Columns2, Expand, EyeOff, LoaderCircle, Maximize, Minimize, Minus, PanelRightClose, PanelRightOpen, Pencil, Plus, Search, Settings2, Swords, Trophy, X, BookOpen, List, Timer } from 'lucide-react';
import { bossFor, bossHealth, completePage, percent, type Book, type Settings } from './model';
import { getFile } from './storage';
import { openPdf, type PasswordHandler } from './pdf';
import { BossEditor, CombatRules, HealthBar } from './components';
import './pdf-text.css';

function normalized(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(); }

function PdfPage({ pdf, number, width, root, query, onReady }: { pdf: PDFDocumentProxy; number: number; width: number; root: HTMLDivElement | null; query: string; onReady: (page: number, ready: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(4 / 3);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const textRef = useRef<HTMLDivElement | null>(null);
  const queryRef = useRef(query); queryRef.current = query;
  const highlight = useCallback(() => {
    const container = textRef.current;
    if (!container) return;
    for (const span of container.querySelectorAll('span:not(.markedContent)')) {
      const text = span.textContent || '';
      span.textContent = text;
      const term = normalized(queryRef.current.trim());
      if (!term) continue;
      const lower = normalized(text);
      let position = 0, index = lower.indexOf(term);
      if (index === -1) continue;
      span.textContent = '';
      while (index !== -1) {
        span.append(document.createTextNode(text.slice(position, index)));
        const mark = document.createElement('mark');
        mark.className = 'pdf-search-mark'; mark.textContent = text.slice(index, index + term.length); span.append(mark);
        position = index + term.length; index = lower.indexOf(term, position);
      }
      span.append(document.createTextNode(text.slice(position)));
    }
  }, []);
  useEffect(() => { highlight(); }, [query, highlight]);
  useEffect(() => {
    const node = host.current!;
    const observer = new IntersectionObserver(entries => setNear(entries[0].isIntersecting), { root, rootMargin: '700px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [root]);
  useEffect(() => {
    if (!near || !width) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let textLayer: TextLayer | undefined;
    const node = host.current!;
    setError(''); setReady(false); onReady(number, false);
    const render = async () => {
      try {
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        setRatio(base.height / base.width);
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement('canvas');
        const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16000000 / (viewport.width * viewport.height)));
        canvas.width = Math.floor(viewport.width * dpr); canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        canvas.setAttribute('aria-label', `Página ${number}`);
        canvas.setAttribute('role', 'img');
        const oldCanvas = node.querySelector('canvas'); oldCanvas?.remove();
        node.prepend(canvas);
        renderTask = page.render({ canvas, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
        await renderTask.promise;
        if (cancelled) return;
        const text = await page.getTextContent();
        if (cancelled) return;
        textRef.current?.remove();
        const layer = document.createElement('div'); layer.className = 'textLayer';
        layer.style.setProperty('--total-scale-factor', String(viewport.scale));
        node.append(layer); textRef.current = layer;
        textLayer = new TextLayer({ textContentSource: text, container: layer, viewport });
        await textLayer.render();
        if (cancelled) return;
        highlight(); setReady(true); onReady(number, true);
      } catch (err) {
        if (!cancelled && (err as Error).name !== 'RenderingCancelledException') setError('No se pudo dibujar esta página. Prueba a cambiar de página o volver a abrir el libro.');
      }
    };
    void render();
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); node.querySelector('canvas')?.remove(); textRef.current?.remove(); textRef.current = null; onReady(number, false); };
  }, [pdf, number, width, near, onReady, highlight]);
  return <div className="pdf-page" ref={host} data-page={number} data-ready={ready} style={{ width, minHeight: width * ratio, '--scale-factor': 1 } as CSSProperties}>
    {!ready && !error && <div className="page-placeholder"><LoaderCircle className="spin" size={22} /><span>Página {number}</span></div>}
    {error && <p className="page-error" role="alert">{error}</p>}
  </div>;
}

interface ReaderProps {
  book: Book; settings: Settings;
  onUpdate: (id: string, update: (book: Book) => Book) => Promise<Book>;
  onSettings: () => void; onChangeSettings: (settings: Settings) => void;
  onBack: () => void; password: PasswordHandler;
  notify: (message: string, error?: boolean) => void;
  blocked: boolean;
}

export default function Reader({ book, settings, onUpdate, onSettings, onChangeSettings, onBack, password, notify, blocked }: ReaderProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(book.lastPage);
  const [pageInput, setPageInput] = useState(String(book.lastPage));
  const [zoom, setZoom] = useState(1);
  const [availableWidth, setAvailableWidth] = useState(700);
  const [panel, setPanel] = useState(true);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [searchedTerm, setSearchedTerm] = useState('');
  const [results, setResults] = useState<{ page: number; snippet: string; count: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultIndex, setResultIndex] = useState(0);
  const [readyPages, setReadyPages] = useState<Set<number>>(new Set());
  const [marking, setMarking] = useState(false);
  const [attack, setAttack] = useState(false);
  const [victory, setVictory] = useState<ReturnType<typeof bossFor>>();
  const [defeated, setDefeated] = useState<ReturnType<typeof bossFor>>();
  const [editor, setEditor] = useState(false);
  const [autoElapsed, setAutoElapsed] = useState(0);
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const container = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | undefined>(undefined);
  const searchJob = useRef(0);
  const attackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const defeatTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ book, onUpdate, page, blocked }); latest.current = { book, onUpdate, page, blocked };
  const currentBoss = bossFor(book);
  const closeSearch = useCallback(() => {
    searchJob.current++; setSearching(false); setSearchOpen(false); setSearchedTerm('');
  }, []);
  const displayBoss = defeated || currentBoss;
  const completed = book.completedPages.includes(page);
  const ready = readyPages.has(page);
  const pageWidth = Math.round(Math.min(availableWidth - 40, 850) * zoom);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const file = await getFile(book.id);
        if (!file) throw new Error('El archivo ya no está disponible en este navegador. Vuelve a importarlo desde tu copia original.');
        const doc = await openPdf(file, password);
        if (cancelled) { await doc.loadingTask.destroy(); return; }
        pdfRef.current = doc; setPdf(doc);
      } catch (err) { if (!cancelled) setLoadError((err as Error).message || 'No se pudo abrir el PDF.'); }
    };
    void load();
    return () => { cancelled = true; searchJob.current++; void pdfRef.current?.loadingTask.destroy(); pdfRef.current = undefined; clearTimeout(attackTimer.current); clearTimeout(defeatTimer.current); };
  }, [book.id, password]);

  useEffect(() => {
    if (!scrollRoot) return;
    const resize = new ResizeObserver(entries => setAvailableWidth(entries[0].contentRect.width));
    resize.observe(scrollRoot); return () => resize.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    setPageInput(String(page)); setAutoElapsed(0);
    if (page !== latest.current.book.lastPage) void latest.current.onUpdate(book.id, current => ({ ...current, lastPage: page })).catch(() => notify('No se pudo guardar la última página.', true));
  }, [page, book.id, notify]);

  const reportReady = useCallback((number: number, value: boolean) => {
    setReadyPages(previous => { const next = new Set(previous); if (value) next.add(number); else next.delete(number); return next; });
  }, []);

  const goTo = useCallback((target: number) => {
    const next = Math.min(book.totalPages, Math.max(1, Math.trunc(target)));
    if (!Number.isFinite(next)) return;
    setPage(next); setPageInput(String(next));
    if (settings.mode === 'continuous') {
      scrollRoot?.querySelector(`[data-page="${next}"]`)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    } else if (scrollRoot) { scrollRoot.scrollTop = 0; }
  }, [book.totalPages, settings.mode, scrollRoot]);

  useEffect(() => {
    if (settings.mode !== 'continuous' || !pdf) return;
    const frame = requestAnimationFrame(() => scrollRoot?.querySelector(`[data-page="${latest.current.page}"]`)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [settings.mode, pdf, scrollRoot]);

  const markPage = useCallback(async () => {
    if (marking || !ready || completed || blocked || editor || searchOpen) return;
    setMarking(true);
    const boss = bossFor(book);
    try {
      const updated = await onUpdate(book.id, current => completePage(current, page));
      if (updated.completedPages.length > book.completedPages.length) {
        setAttack(true); clearTimeout(attackTimer.current); attackTimer.current = setTimeout(() => setAttack(false), 650);
        if (updated.victories.length > book.victories.length) {
          setVictory(boss); setDefeated(boss); clearTimeout(defeatTimer.current); defeatTimer.current = setTimeout(() => setDefeated(undefined), 1800);
        }
        if (updated.completedPages.length === updated.totalPages) notify('¡Libro completado! Una historia más forma parte de ti.');
      }
    } catch { notify('No se pudo guardar la página. Comprueba el espacio del navegador.', true); }
    finally { setMarking(false); }
  }, [book, page, onUpdate, marking, ready, completed, blocked, editor, searchOpen, notify]);

  const markRef = useRef(markPage); markRef.current = markPage;
  useEffect(() => {
    if (!settings.autoComplete || completed || !ready || blocked || editor || searchOpen) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      setAutoElapsed(value => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.autoComplete, page, completed, ready, blocked, editor, searchOpen]);
  useEffect(() => {
    if (settings.autoComplete && autoElapsed >= settings.autoSeconds && !completed) void markRef.current();
  }, [autoElapsed, settings.autoSeconds, settings.autoComplete, completed]);

  useEffect(() => {
    let seconds = 0;
    const flush = () => {
      if (!seconds) return;
      const elapsed = seconds; seconds = 0;
      void latest.current.onUpdate(book.id, current => ({ ...current, readingSeconds: current.readingSeconds + elapsed })).catch(() => notify('No se pudo guardar el tiempo de lectura.', true));
    };
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && document.hasFocus() && !latest.current.blocked && pdfRef.current) seconds++;
      if (seconds >= 15) flush();
    }, 1000);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); flush(); };
  }, [book.id, notify]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (blocked || editor || document.querySelector('[role="dialog"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setSearchOpen(true); return; }
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); goTo(page + (e.key === 'ArrowRight' ? 1 : -1)); }
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); void markRef.current(); }
      if (e.key === 'Escape') { closeSearch(); setMobilePanel(false); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [page, goTo, blocked, editor, closeSearch]);

  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed); return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  const touch = useRef<{ x: number; y: number; time: number } | null>(null);
  const runSearch = async () => {
    if (!pdf || !term.trim()) return;
    const id = ++searchJob.current;
    const query = term.trim();
    setSearching(true); setResults([]); setHasSearched(false); setSearchedTerm(query); setSearchProgress(0);
    const matches: typeof results = [];
    try {
      for (let number = 1; number <= pdf.numPages; number++) {
        if (id !== searchJob.current) return;
        const content = await (await pdf.getPage(number)).getTextContent();
        const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
        const textNormalized = normalized(text), needle = normalized(query);
        const index = textNormalized.indexOf(needle);
        if (index !== -1) {
          let count = 0, cursor = index;
          while (cursor !== -1) { count++; cursor = textNormalized.indexOf(needle, cursor + needle.length); }
          matches.push({ page: number, snippet: `${index > 45 ? '…' : ''}${text.slice(Math.max(0, index - 45), index + query.length + 90)}…`, count });
        }
        setSearchProgress(Math.round(number / pdf.numPages * 100));
        if (number % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (id !== searchJob.current) return;
      setResults(matches); setHasSearched(true); setResultIndex(0);
      if (matches.length) goTo(matches[0].page);
    } catch { if (id === searchJob.current) notify('No se pudo completar la búsqueda en este documento.', true); }
    finally { if (id === searchJob.current) setSearching(false); }
  };

  const onScroll = () => {
    if (settings.mode !== 'continuous' || !scrollRoot) return;
    const bounds = scrollRoot.getBoundingClientRect();
    const anchor = bounds.top + Math.min(bounds.height * .35, 260);
    let closest = page, distance = Infinity;
    for (const item of scrollRoot.querySelectorAll<HTMLElement>('[data-page]')) {
      const rect = item.getBoundingClientRect();
      if (rect.top <= anchor && rect.bottom >= anchor) { closest = Number(item.dataset.page); break; }
      const nextDistance = Math.min(Math.abs(rect.top - anchor), Math.abs(rect.bottom - anchor));
      if (nextDistance < distance) { distance = nextDistance; closest = Number(item.dataset.page); }
    }
    setPage(closest);
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notify('Para una lectura sin barras en iPhone, añade Final Reader a la pantalla de inicio.');
    } catch { notify('Este navegador no permite pantalla completa. Puedes instalar la app para leer sin barras.'); }
  };

  return <div className={`reader ${panel ? '' : 'panel-hidden'}`} ref={container}>
    <header className="reader-header"><button className="icon-button back-button" title="Volver a la biblioteca" aria-label="Volver a la biblioteca" onClick={onBack}><ArrowLeft size={20} /></button><div className="reader-book-title"><span>ESTÁS LEYENDO</span><h1>{book.title}</h1></div><div className="reader-header-actions"><button className={`icon-button ${searchOpen ? 'active' : ''}`} title="Buscar en el libro (Ctrl + F)" aria-label="Buscar en el libro" onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)}><Search size={19} /></button><button className="icon-button" title="Ajustes de lectura" aria-label="Ajustes de lectura" onClick={onSettings}><Settings2 size={19} /></button><button className="icon-button fullscreen-button" title="Pantalla completa" aria-label="Pantalla completa" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button><span className="vertical-divider" /><button className="icon-button desktop-panel-toggle" title={panel ? 'Ocultar combate' : 'Mostrar combate'} aria-label={panel ? 'Ocultar combate' : 'Mostrar combate'} onClick={() => setPanel(value => !value)}>{panel ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}</button></div></header>
    {victory && <div className="victory-banner" role="status"><div className="victory-emblem"><Trophy size={22} /></div><div><strong>¡VICTORIA! <span>{victory.name} ha caído.</span></strong><small>+100 EXP · Un nuevo rival te espera. Sigue a tu ritmo.</small></div><button className="icon-button" onClick={() => setVictory(undefined)} aria-label="Cerrar victoria"><X size={18} /></button></div>}
    <div className="reader-body">
      <main className="reading-main">
        <div className="pdf-toolbar"><div className="toolbar-group"><button className="icon-button" aria-label="Alejar" disabled={zoom <= .5} onClick={() => setZoom(value => Math.max(.5, Math.round((value - .15) * 100) / 100))}><Minus size={16} /></button><span className="zoom-value">{Math.round(zoom * 100)}%</span><button className="icon-button" aria-label="Acercar" disabled={zoom >= 2.5} onClick={() => setZoom(value => Math.min(2.5, Math.round((value + .15) * 100) / 100))}><Plus size={16} /></button><button className="icon-button fit-button" title="Ajustar al ancho" aria-label="Ajustar al ancho" onClick={() => setZoom(1)}><ChevronsLeftRight size={17} /></button></div><div className="toolbar-group"><button className={`icon-button ${settings.mode === 'single' ? 'active' : ''}`} title="Página individual" aria-label="Página individual" onClick={() => onChangeSettings({ ...settings, mode: 'single' })}><Columns2 size={17} /></button><button className={`icon-button ${settings.mode === 'continuous' ? 'active' : ''}`} title="Lectura continua" aria-label="Lectura continua" onClick={() => onChangeSettings({ ...settings, mode: 'continuous' })}><List size={18} /></button></div></div>
        {searchOpen && <section className="search-panel" aria-label="Búsqueda de texto"><form className="pdf-search-form" onSubmit={e => { e.preventDefault(); void runSearch(); }}><Search size={17} /><input aria-label="Texto a buscar" autoFocus placeholder="Buscar en este libro…" value={term} onChange={e => setTerm(e.target.value)} maxLength={200} /><button className="button primary compact" type="submit" disabled={!pdf || !term.trim() || searching}>{searching ? `${searchProgress}%` : 'Buscar'}</button><button className="icon-button" type="button" aria-label="Cerrar búsqueda" onClick={closeSearch}><X size={17} /></button></form>
          {hasSearched && <div className="search-summary">{results.length ? <><span>{results.reduce((sum, result) => sum + result.count, 0)} coincidencias en {results.length} páginas</span><div><button className="icon-button" aria-label="Resultado anterior" onClick={() => { const next = (resultIndex - 1 + results.length) % results.length; setResultIndex(next); goTo(results[next].page); }}><ChevronLeft size={15} /></button><span>{resultIndex + 1} / {results.length}</span><button className="icon-button" aria-label="Resultado siguiente" onClick={() => { const next = (resultIndex + 1) % results.length; setResultIndex(next); goTo(results[next].page); }}><ChevronRight size={15} /></button></div></> : <span>No hay coincidencias. Los PDF escaneados necesitan una capa de texto; no se realiza OCR.</span>}</div>}
          {results.length > 0 && <div className="search-results">{results.map((result, index) => <button key={result.page} className={index === resultIndex ? 'selected' : ''} onClick={() => { setResultIndex(index); goTo(result.page); }}><strong>Pág. {result.page}</strong><span>{result.snippet}</span></button>)}</div>}
        </section>}
        <div className="pdf-scroll" ref={setScrollRoot} onScroll={onScroll}
          onTouchStart={e => { if (e.touches.length === 1) touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }; else touch.current = null; }}
          onTouchEnd={e => { const start = touch.current; touch.current = null; if (!start || settings.mode !== 'single' || zoom > 1.05 || !e.changedTouches.length || window.getSelection()?.toString()) return; const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 2 && Date.now() - start.time < 650) goTo(page + (dx < 0 ? 1 : -1)); }}>
          {!pdf && !loadError && <div className="reader-loading"><LoaderCircle className="spin" size={30} /><p>Abriendo tu próxima aventura…</p></div>}
          {loadError && <div className="reader-load-error" role="alert"><BookOpen size={32} /><h2>No pudimos abrir este libro</h2><p>{loadError}</p><button className="button secondary" onClick={onBack}>Volver a la biblioteca</button></div>}
          {pdf && <div className="pdf-page-list">{(settings.mode === 'single' ? [page] : Array.from({ length: book.totalPages }, (_, index) => index + 1)).map(number => <PdfPage key={`${book.id}-${number}`} pdf={pdf} number={number} width={Math.max(200, pageWidth)} root={scrollRoot} query={searchedTerm} onReady={reportReady} />)}</div>}
        </div>
        <footer className="reader-footer"><div className="page-navigation"><button className="icon-button" aria-label="Página anterior" disabled={page === 1} onClick={() => goTo(page - 1)}><ChevronLeft size={20} /></button><form onSubmit={e => { e.preventDefault(); goTo(Number(pageInput)); (document.activeElement as HTMLElement)?.blur(); }}><label><span className="page-label">Página</span><input aria-label="Número de página" inputMode="numeric" value={pageInput} onChange={e => setPageInput(e.target.value.replace(/\D/g, ''))} onBlur={() => { if (pageInput) goTo(Number(pageInput)); else setPageInput(String(page)); }} /><span>de {book.totalPages}</span></label></form><button className="icon-button" aria-label="Página siguiente" disabled={page === book.totalPages} onClick={() => goTo(page + 1)}><ChevronRight size={20} /></button></div><button className={`button mark-button ${completed ? 'completed' : 'primary'}`} disabled={completed || !ready || marking || searchOpen || blocked} onClick={() => void markPage()}>{completed ? <CircleCheck size={17} /> : <Swords size={17} />}<span>{completed ? 'Página completada' : 'Página leída'}</span>{!completed && <kbd>L</kbd>}</button>{settings.autoComplete && !completed && <span className="auto-timer" title="Tiempo de lectura activa"><Timer size={12} />{Math.max(0, settings.autoSeconds - autoElapsed)} s</span>}</footer>
      </main>
      <aside className={`combat-panel ${mobilePanel ? 'mobile-open' : ''}`} aria-label="Panel de combate">
        <div className="combat-heading"><span><i /> COMBATE ACTIVO</span><button className="icon-button mobile-close" aria-label="Minimizar combate" onClick={() => setMobilePanel(false)}><ChevronDown size={19} /></button><button className="icon-button desktop-hide" aria-label="Ocultar panel de combate" onClick={() => setPanel(false)}><EyeOff size={16} /></button></div>
        <div className={`boss-stage ${attack ? 'attacking' : ''} ${defeated ? 'defeated' : ''}`}><div className="boss-orbit" /><img key={displayBoss.image} src={displayBoss.image} alt={`${displayBoss.name}, ${displayBoss.epithet}`} />{attack && <span className="damage-number">−10 PV</span>}<span className="encounter-badge">ENCUENTRO {displayBoss.index + 1 < 10 ? '0' : ''}{displayBoss.index + 1}</span></div>
        <div className="boss-identity"><span className="eyebrow">{displayBoss.type}</span><h2>{displayBoss.name}</h2><p>{displayBoss.epithet}</p></div>
        <HealthBar health={defeated ? 0 : bossHealth(book)} />
        <div className="page-gems" aria-label={`${book.completedPages.length % 10} de 10 páginas para este jefe`}>{Array.from({ length: 10 }, (_, i) => <span key={i} className={i < book.completedPages.length % 10 ? 'filled' : ''}>◆</span>)}</div>
        <p className="battle-hint">{10 - book.completedPages.length % 10} páginas nuevas para la victoria</p>
        <CombatRules />
        <div className="book-journey"><h3>Tu viaje en este libro <span>{percent(book)}%</span></h3><div className="progress-track"><i style={{ width: `${percent(book)}%` }} /></div><div><span><BookOpen size={14} /> {book.completedPages.length} / {book.totalPages} páginas</span><span><Trophy size={14} /> {book.victories.length}</span></div></div>
        {book.completedPages.length === book.totalPages && <div className="book-finished"><Check size={16} /> ¡Historia completada!{book.totalPages % 10 !== 0 && <small>El último combate queda con {bossHealth(book)}% de vida. Cada victoria requiere 10 páginas.</small>}</div>}
        <button className="customize-button" onClick={() => setEditor(true)}><Pencil size={14} /> Personalizar jefe <ArrowRight size={14} /></button>
        <p className="combat-footnote">Avanza a tu ritmo.<br />El verdadero tesoro está en la historia.</p>
      </aside>
      <button className={`mobile-boss-chip ${mobilePanel ? 'hidden' : ''}`} onClick={() => setMobilePanel(true)} aria-label="Desplegar combate"><img src={currentBoss.image} alt="" /><span><strong>{currentBoss.name}</strong><HealthBar health={bossHealth(book)} label={false} /></span><b>{bossHealth(book)}%</b><Expand size={14} /></button>
    </div>
    {editor && <BossEditor book={book} bossId={currentBoss.id} onClose={() => setEditor(false)} onSave={async (name, image) => { await onUpdate(book.id, current => ({ ...current, skins: { ...current.skins, [currentBoss.id]: { name, image } } })); }} />}
  </div>;
}
