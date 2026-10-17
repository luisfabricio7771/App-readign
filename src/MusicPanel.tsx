import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, Heart, LoaderCircle, Minimize2, Music2, Pause, Play, Plus, SkipForward, Trash2, Volume2, X, Maximize2 } from 'lucide-react';
import { loadMusic, saveMusic } from './storage';
import { DEFAULT_MUSIC, loadYouTubeAPI, parseYouTubeLink, youtubeError, type MusicPreferences, type YouTubeLink, type YouTubePlayer } from './youtube';

export type MusicView = 'closed' | 'open' | 'mini';
interface Props { view: MusicView; onView: (view: MusicView) => void; blocked: boolean; onPlaying: (playing: boolean) => void }

export default function MusicPanel({ view, onView, blocked, onPlaying }: Props) {
  const [preferences, setPreferences] = useState<MusicPreferences>(DEFAULT_MUSIC);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [active, setActive] = useState<YouTubeLink | null>(null);
  const [title, setTitle] = useState('Tu banda sonora');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playlist, setPlaylist] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const readyTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const job = useRef(0);
  const mounted = useRef(true);
  const preferencesLoaded = useRef(false);
  const latest = useRef({ view, blocked, preferences, active, onPlaying });
  latest.current = { view, blocked, preferences, active, onPlaying };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  const pause = useCallback((reason?: string) => {
    try { player.current?.pauseVideo(); } catch { /* The API may still be loading. */ }
    setPlaying(false); latest.current.onPlaying(false);
    if (reason) setMessage(reason);
  }, []);
  const physicallyVisible = useCallback(() => {
    const node = frame.current;
    if (!node || !panel.current || latest.current.view === 'closed' || latest.current.blocked || document.visibilityState !== 'visible') return false;
    const rect = node.getBoundingClientRect();
    const bounds = panel.current.getBoundingClientRect();
    const heading = panel.current.querySelector('.music-heading')!.getBoundingClientRect();
    return rect.width >= 200 && rect.height >= 200 && rect.top >= Math.max(0, bounds.top, heading.bottom) - .5 && rect.left >= 0 && rect.bottom <= Math.min(innerHeight, bounds.bottom) + .5 && rect.right <= innerWidth + .5;
  }, []);
  const revealPlayer = useCallback(() => {
    if (!physicallyVisible() && panel.current && frame.current && latest.current.view !== 'closed') {
      const bounds = panel.current.getBoundingClientRect();
      const heading = panel.current.querySelector('.music-heading')!.getBoundingClientRect();
      panel.current.scrollTop += frame.current.getBoundingClientRect().top - bounds.top - heading.height - 10;
    }
    return physicallyVisible();
  }, [physicallyVisible]);
  useEffect(() => {
    mounted.current = true;
    loadMusic().then(saved => { if (mounted.current) { preferencesLoaded.current = true; setPreferences(saved); setInput(saved.lastLink); setLoaded(true); } }).catch(() => { setLoaded(true); setError('No pudimos recuperar tus favoritos musicales.'); });
    const flush = () => { if (preferencesLoaded.current) void saveMusic(latest.current.preferences).catch(() => {}); };
    window.addEventListener('pagehide', flush);
    return () => { flush(); window.removeEventListener('pagehide', flush); mounted.current = false; job.current++; clearTimeout(readyTimeout.current); player.current?.destroy(); player.current = null; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => { void saveMusic(preferences).catch(() => { if (mounted.current) setError('No se pudo guardar la música en este navegador.'); }); }, 200);
    return () => clearTimeout(timer);
  }, [preferences, loaded]);
  useLayoutEffect(() => {
    if (view === 'closed') { job.current++; clearTimeout(readyTimeout.current); setLoading(false); }
    if (view === 'closed' || blocked) pause(blocked ? 'Reproducción pausada mientras hay una ventana abierta.' : undefined);
  }, [view, blocked, pause]);
  useEffect(() => {
    const visibility = () => { if (document.visibilityState !== 'visible') pause('YouTube se pausó al ocultar la aplicación. Pulsa reproducir para continuar.'); };
    const connection = () => { setOnline(navigator.onLine); if (!navigator.onLine) pause('Sin conexión. Tus PDF siguen disponibles; YouTube necesita internet.'); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', connection); window.addEventListener('offline', connection);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); };
  }, [pause]);
  useEffect(() => {
    if (!frame.current) return;
    const resize = new ResizeObserver(() => { if (player.current && !physicallyVisible()) pause(); });
    const visibility = new IntersectionObserver(() => {
      if (player.current && !physicallyVisible()) pause();
    }, { threshold: [0, .99, 1] });
    resize.observe(frame.current); visibility.observe(frame.current);
    return () => { resize.disconnect(); visibility.disconnect(); };
  }, [pause, physicallyVisible]);
  const updateTitle = useCallback(() => {
    const data = player.current?.getVideoData();
    const current = latest.current.active;
    if (!data?.title) return;
    setTitle(data.title);
    if (current) setPreferences(previous => ({ ...previous, favorites: previous.favorites.map(favorite => favorite.key === current.key ? { ...favorite, title: data.title! } : favorite) }));
  }, []);

  const loadLink = async (value: string) => {
    const link = parseYouTubeLink(value);
    setError(''); setMessage('');
    if (!link) { setError('Pega un enlace válido de un video o playlist de YouTube.'); return; }
    if (!navigator.onLine) { setError('Necesitas conexión para cargar YouTube. Puedes seguir leyendo tus PDF sin conexión.'); return; }
    const id = ++job.current; clearTimeout(readyTimeout.current);
    setInput(link.url); setActive(link); setLoading(true); setPlaylist(!!link.playlistId);
    latest.current.active = link;
    const cue = (instance: YouTubePlayer) => {
      if (link.playlistId) instance.cuePlaylist({ list: link.playlistId, listType: 'playlist', startSeconds: link.startSeconds });
      else instance.cueVideoById({ videoId: link.videoId!, startSeconds: link.startSeconds });
      setPlaying(false); latest.current.onPlaying(false);
      setTitle(link.playlistId ? 'Playlist de YouTube' : 'Video de YouTube');
      setMessage('Contenido cargado. Pulsa reproducir en el video o en los controles.');
    };
    try {
      await loadYouTubeAPI();
      if (!mounted.current || id !== job.current) return;
      if (player.current && ready) { pause(); cue(player.current); setLoading(false); return; }
      player.current?.destroy(); host.current!.replaceChildren();
      const target = document.createElement('div'); host.current!.append(target);
      const instance = new window.YT!.Player(target, {
        width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 1, playsinline: 1, origin: location.origin, rel: 0 },
        events: {
          onReady: event => {
            if (!mounted.current || id !== job.current) return;
            clearTimeout(readyTimeout.current);
            player.current = event.target; setReady(true); setLoading(false);
            event.target.getIframe().setAttribute('title', 'Reproductor oficial de YouTube');
            event.target.getIframe().setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            if (!ios) event.target.setVolume(latest.current.preferences.volume);
            cue(event.target);
          },
          onStateChange: event => {
            if (!mounted.current) return;
            if (event.data === 1 && !physicallyVisible()) { pause('Amplía o desplaza el panel para mantener visible el reproductor.'); return; }
            const isPlaying = event.data === 1;
            setPlaying(isPlaying); latest.current.onPlaying(isPlaying);
            if (isPlaying) {
              setError(''); setMessage('');
              const url = latest.current.active?.url;
              if (url) setPreferences(previous => previous.lastLink === url ? previous : { ...previous, lastLink: url });
            }
            try { setPlaylist(!!latest.current.active?.playlistId || !!event.target.getPlaylist()?.length); updateTitle(); } catch { /* Some videos omit metadata. */ }
          },
          onError: event => { if (mounted.current) { clearTimeout(readyTimeout.current); setLoading(false); pause(); setError(youtubeError(event.data)); } },
          onAutoplayBlocked: () => { if (mounted.current) { pause(); setMessage('El navegador requiere que pulses reproducir dentro del video.'); } }
        }
      });
      player.current = instance;
      readyTimeout.current = setTimeout(() => {
        if (mounted.current && id === job.current) { pause(); setLoading(false); setError('YouTube no responde. Revisa tu conexión o prueba con otro enlace.'); }
      }, 20000);
    } catch (reason) { if (mounted.current && id === job.current) { setLoading(false); setError((reason as Error).message); } }
  };

  const changeView = (next: MusicView) => {
    if (next === 'closed') { job.current++; clearTimeout(readyTimeout.current); pause(); setLoading(false); }
    onView(next);
  };
  const toggle = () => {
    if (!ready || !player.current) return;
    if (playing) { pause(); return; }
    if (!revealPlayer()) { setMessage('Amplía o desplaza el panel para reproducir con el video visible.'); return; }
    setError(''); setMessage(''); player.current.playVideo();
  };
  const favorite = () => {
    const link = parseYouTubeLink(input);
    if (!link) { setError('Pega un enlace válido para guardarlo como favorito.'); return; }
    if (preferences.favorites.some(item => item.key === link.key)) { setMessage('Este enlace ya está en tus favoritos.'); return; }
    setPreferences(previous => ({ ...previous, favorites: [...previous.favorites, { key: link.key, url: link.url, title: active?.key === link.key && title !== 'Tu banda sonora' ? title : `${link.playlistId ? 'Playlist' : 'Video'} · ${link.playlistId || link.videoId}` }] }));
    setError(''); setMessage('Favorito guardado en este dispositivo.');
  };
  const matchingFavorite = parseYouTubeLink(input)?.key;

  return <aside className={`music-panel music-${view}`} ref={panel} data-testid="music-panel" aria-label="Panel musical" aria-hidden={view === 'closed' || undefined}>
    <header className="music-heading"><span><Music2 size={16} /><strong>{view === 'mini' ? 'YouTube' : 'Tu banda sonora'}</strong><i className={playing ? 'playing-dot' : ''} /></span><div><button className="icon-button" onClick={() => changeView(view === 'mini' ? 'open' : 'mini')} aria-label={view === 'mini' ? 'Ampliar reproductor musical' : 'Minimizar reproductor musical'}>{view === 'mini' ? <Maximize2 size={15} /> : <Minimize2 size={15} />}</button><button className="icon-button" onClick={() => changeView('closed')} aria-label="Cerrar reproductor musical"><X size={16} /></button></div></header>
    <div className="music-expanded-controls"><p className="music-intro">Dale una melodía a tu siguiente capítulo.</p><form onSubmit={event => { event.preventDefault(); void loadLink(input); }} className="music-link-form"><label className="field">Video o playlist de YouTube<input value={input} onChange={event => setInput(event.target.value)} placeholder="Pega aquí un enlace de YouTube…" aria-label="Enlace de YouTube" maxLength={2000} /></label><div className="music-load-row"><button className="button primary compact" type="submit" disabled={loading || !loaded || !input.trim()}>{loading ? <LoaderCircle className="spin" size={14} /> : <Play size={13} />}{loading ? 'Conectando…' : 'Cargar enlace'}</button><button type="button" className="icon-button" title="Guardar enlace favorito" aria-label="Guardar enlace favorito" onClick={favorite} disabled={!loaded || !input.trim()}><Heart size={16} fill={preferences.favorites.some(item => item.key === matchingFavorite) ? 'currentColor' : 'none'} /></button></div></form></div>
    <div className="youtube-frame" ref={frame} data-testid="youtube-frame"><div className="youtube-host" ref={host} />{!ready && <div className="youtube-placeholder">{loading ? <LoaderCircle size={24} className="spin" /> : <Music2 size={28} />}<span>{loading ? 'Conectando con YouTube…' : 'Reproductor oficial de YouTube'}</span><small>El video permanece visible durante la reproducción.</small></div>}</div>
    <div className="music-expanded-controls music-player-controls"><div className="music-track"><span className="eyebrow">{playing ? 'REPRODUCIENDO' : 'TU SELECCIÓN'}</span><h3>{title}</h3></div><div className="music-buttons"><button className="button secondary compact" onClick={toggle} disabled={!ready || !online}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pausar' : 'Reproducir'}</button><button className="icon-button" title="Siguiente video de la playlist" aria-label="Siguiente video de la playlist" disabled={!ready || !playlist || !online} onClick={() => { if (revealPlayer()) player.current?.nextVideo(); else setMessage('Amplía el panel para mantener el video visible.'); }}><SkipForward size={17} /></button>{active && <a href={active.url} target="_blank" rel="noopener noreferrer" className="icon-button" title="Abrir en YouTube" aria-label="Abrir en YouTube"><ExternalLink size={15} /></a>}</div><label className="music-volume"><Volume2 size={15} /><span className="visually-hidden">Volumen de YouTube</span><input type="range" aria-label="Volumen de YouTube" min={0} max={100} value={preferences.volume} disabled={ios} onChange={event => { const volume = Number(event.target.value); setPreferences(previous => ({ ...previous, volume })); if (ready) player.current?.setVolume(volume); }} /><span>{ios ? 'Dispositivo' : `${preferences.volume}%`}</span></label>{ios && <p className="helper">En iPhone, usa los botones de volumen del dispositivo.</p>}</div>
    {(error || message || !online) && <p className={`music-message ${error ? 'has-error' : ''}`} role={error ? 'alert' : 'status'}>{!online ? 'Sin conexión: puedes seguir leyendo; YouTube necesita internet.' : error || message}</p>}
    <div className="music-favorites music-expanded-controls"><h3><Heart size={13} /> Tus favoritos <span>{preferences.favorites.length}</span></h3>{preferences.favorites.length ? <ul>{preferences.favorites.map(item => <li key={item.key}><button onClick={() => void loadLink(item.url)} title={item.title} disabled={loading}><Play size={12} /><span>{item.title}</span></button><button className="icon-button" aria-label={`Eliminar favorito ${item.title}`} onClick={() => setPreferences(previous => ({ ...previous, favorites: previous.favorites.filter(favorite => favorite.key !== item.key) }))}><Trash2 size={13} /></button></li>)}</ul> : <p>Guarda tus enlaces con <Heart size={11} />. No necesitas una cuenta en Final Reader.</p>}<button className="music-add-current" onClick={favorite} disabled={!input.trim()}><Plus size={12} /> Guardar este enlace</button></div>
    <p className="music-privacy music-expanded-controls">Al cargar un enlace te conectas con YouTube, que aplica sus anuncios y restricciones. Los PDF siguen siendo locales. La app no reproduce con la pantalla bloqueada.</p>
  </aside>;
}
