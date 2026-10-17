import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import { LoaderCircle } from 'lucide-react';

export interface PdfPageProps {
  pdf: PDFDocumentProxy; number: number; width: number;
  root: HTMLDivElement | null; query: string;
  onReady: (page: number, ready: boolean) => void;
  onError?: (page: number) => void;
  eager?: boolean;
}
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export default function PdfPage({ pdf, number, width, root, query, onReady, onError, eager = false }: PdfPageProps) {
  const host = useRef<HTMLDivElement>(null);
  const committed = useRef<{ canvas: HTMLCanvasElement; layer: HTMLDivElement; text: TextLayer } | null>(null);
  const [near, setNear] = useState(eager);
  const [ratio, setRatio] = useState(4 / 3);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const queryRef = useRef(query); queryRef.current = query;
  const errorRef = useRef(onError); errorRef.current = onError;
  const highlight = useCallback((container: HTMLDivElement) => {
    const term = normalize(queryRef.current.trim());
    for (const span of container.querySelectorAll('span:not(.markedContent)')) {
      const text = span.textContent || ''; span.textContent = text;
      if (!term) continue;
      const lower = normalize(text);
      let position = 0, index = lower.indexOf(term);
      if (index === -1) continue;
      span.textContent = '';
      while (index !== -1) {
        span.append(document.createTextNode(text.slice(position, index)));
        const mark = document.createElement('mark'); mark.className = 'pdf-search-mark';
        mark.textContent = text.slice(index, index + term.length); span.append(mark);
        position = index + term.length; index = lower.indexOf(term, position);
      }
      span.append(document.createTextNode(text.slice(position)));
    }
  }, []);
  useEffect(() => { if (committed.current) highlight(committed.current.layer); }, [query, highlight]);
  useEffect(() => {
    if (eager) return;
    const observer = new IntersectionObserver(entries => setNear(entries[0].isIntersecting), { root, rootMargin: '700px 0px' });
    observer.observe(host.current!); return () => observer.disconnect();
  }, [root, eager]);

  useEffect(() => {
    if ((!near && !eager) || !width) {
      committed.current?.canvas.remove(); committed.current?.text.cancel(); committed.current?.layer.remove();
      committed.current = null; setReady(false); onReady(number, false); return;
    }
    let cancelled = false;
    let task: RenderTask | undefined;
    let draftText: TextLayer | undefined;
    let draftLayer: HTMLDivElement | undefined;
    const node = host.current!;
    setError(''); onReady(number, false);
    // Keep the committed pixels visible while a replacement renders off screen.
    const render = async () => {
      try {
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 }); setRatio(base.height / base.width);
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement('canvas');
        const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16000000 / (viewport.width * viewport.height)));
        canvas.width = Math.floor(viewport.width * dpr); canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = '100%'; canvas.style.height = '100%';
        canvas.setAttribute('aria-label', `Página ${number}`); canvas.setAttribute('role', 'img');
        task = page.render({ canvas, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
        await task.promise;
        if (cancelled) return;
        const text = await page.getTextContent();
        if (cancelled) return;
        const layer = document.createElement('div'); draftLayer = layer;
        layer.className = 'textLayer'; layer.style.visibility = 'hidden';
        layer.style.setProperty('--total-scale-factor', String(viewport.scale)); node.append(layer);
        const textLayer = new TextLayer({ textContentSource: text, container: layer, viewport }); draftText = textLayer;
        await textLayer.render();
        if (cancelled) { layer.remove(); return; }
        highlight(layer);
        committed.current?.canvas.remove(); committed.current?.text.cancel(); committed.current?.layer.remove();
        node.prepend(canvas); layer.style.visibility = '';
        committed.current = { canvas, layer, text: textLayer };
        draftLayer = undefined; draftText = undefined;
        setReady(true); onReady(number, true);
      } catch (reason) {
        draftLayer?.remove();
        if (!cancelled && (reason as Error).name !== 'RenderingCancelledException') {
          setError('No se pudo dibujar esta página. Prueba a cambiar de página o volver a abrir el libro.');
          onReady(number, false); errorRef.current?.(number);
        }
      }
    };
    void render();
    return () => { cancelled = true; task?.cancel(); draftText?.cancel(); draftLayer?.remove(); onReady(number, false); };
  }, [pdf, number, width, near, eager, onReady, highlight]);
  useEffect(() => () => {
    committed.current?.canvas.remove(); committed.current?.text.cancel(); committed.current?.layer.remove(); committed.current = null;
  }, []);
  return <div className="pdf-page" ref={host} data-page={number} data-ready={ready && !error} style={{ width, minHeight: width * ratio, '--scale-factor': 1 } as CSSProperties}>
    {!ready && !error && <div className="page-placeholder"><LoaderCircle className="spin" size={22} /><span>Página {number}</span></div>}
    {error && <p className="page-error" role="alert">{error}</p>}
  </div>;
}
