import { useCallback, useEffect, useRef, useState } from 'react';
import PdfPage, { type PdfPageProps } from './PdfPage';

interface Props extends Omit<PdfPageProps, 'eager' | 'onError'> {
  animated: boolean;
  onBusy: (busy: boolean) => void;
  onVisible: (page: number) => void;
}
type Turn = { target: number; phase: 'loading' | 'turning'; direction: 'forward' | 'backward' };

export default function PageTurn({ number, animated, onBusy, onVisible, onReady, ...props }: Props) {
  const [front, setFront] = useState(number);
  const [turn, setTurn] = useState<Turn | null>(null);
  const ready = useRef(new Set<number>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ turn, number, front, animated, onBusy, onVisible, onReady });
  latest.current = { turn, number, front, animated, onBusy, onVisible, onReady };
  const finish = useCallback(() => {
    const state = latest.current;
    if (!state.turn) return;
    clearTimeout(timer.current);
    const target = state.turn.target;
    setFront(target); setTurn(null); state.onVisible(target);
    state.onBusy(state.number !== target);
  }, []);
  useEffect(() => {
    // Coalesce rapid requests; finish the current sheet before the latest target.
    if (turn?.phase === 'turning') return;
    if (number === front) { setTurn(null); onBusy(false); return; }
    if (turn?.target !== number) {
      setTurn({ target: number, phase: 'loading', direction: number > front ? 'forward' : 'backward' });
      onBusy(true);
    }
  }, [number, front, turn, onBusy]);
  const start = useCallback(() => {
    const state = latest.current;
    if (!state.turn || state.turn.phase !== 'loading' || !ready.current.has(state.turn.target)) return;
    if (!state.animated || Math.abs(state.turn.target - state.front) !== 1) { finish(); return; }
    setTurn({ ...state.turn, phase: 'turning' });
    timer.current = setTimeout(finish, 720); // fallback if animationend is throttled
  }, [finish]);
  useEffect(() => { start(); }, [turn, start]);
  useEffect(() => { if (!animated && turn?.phase === 'turning') finish(); }, [animated, turn, finish]);
  const reportReady = useCallback((page: number, value: boolean) => {
    if (value) ready.current.add(page); else ready.current.delete(page);
    latest.current.onReady(page, value);
    if (value && page === latest.current.front) latest.current.onVisible(page);
    if (value) start();
  }, [start]);
  const reportError = useCallback((page: number) => {
    if (latest.current.turn?.target === page) finish();
  }, [finish]);
  useEffect(() => {
    // Resizing/zooming keeps both canvases coherent and skips a mid-resize turn.
    if (latest.current.turn?.phase === 'turning') finish();
  }, [props.width, finish]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pages = turn ? [front, turn.target] : [front];
  return <div className={`page-turn-viewport ${turn?.phase === 'turning' ? `is-turning turn-${turn.direction}` : ''}`} data-turn-state={turn?.phase || 'idle'} data-visible-page={front} aria-busy={number !== front || !!turn} style={{ width: props.width }}>
    <div className="page-turn-scene">
      {pages.map(page => <div key={page} className={`page-turn-layer ${page === front ? 'turn-front' : 'turn-target'}`} aria-hidden={page !== front || undefined} onAnimationEnd={event => { if (event.target === event.currentTarget && page === front) finish(); }}>
        <PdfPage {...props} number={page} eager onReady={reportReady} onError={reportError} />
        <span className="paper-shading" aria-hidden="true" />
      </div>)}
    </div>
  </div>;
}
