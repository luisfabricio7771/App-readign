export interface YouTubeLink { videoId?: string; playlistId?: string; startSeconds: number; url: string; key: string }
export interface MusicFavorite { key: string; url: string; title: string }
export interface MusicPreferences { lastLink: string; volume: number; favorites: MusicFavorite[] }
export const DEFAULT_MUSIC: MusicPreferences = { lastLink: '', volume: 60, favorites: [] };

const hosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be']);
export function parseYouTubeLink(input: string): YouTubeLink | null {
  try {
    const value = input.trim();
    if (!value) return null;
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!hosts.has(url.hostname.toLowerCase()) || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const videoId = url.hostname.endsWith('youtu.be') ? parts[0] : ['embed', 'shorts', 'live'].includes(parts[0]) && parts[1] !== 'videoseries' ? parts[1] : url.searchParams.get('v') || undefined;
    const playlistId = url.searchParams.get('list') || undefined;
    if (videoId && !/^[\w-]{11}$/.test(videoId)) return null;
    if (playlistId && !/^[\w-]{5,150}$/.test(playlistId)) return null;
    if (!videoId && !playlistId) return null;
    const time = url.searchParams.get('t') || url.searchParams.get('start') || '';
    const timeParts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);
    const startSeconds = Math.min(86400, /^\d+$/.test(time) ? Number(time) : timeParts ? Number(timeParts[1] || 0) * 3600 + Number(timeParts[2] || 0) * 60 + Number(timeParts[3] || 0) : 0);
    const canonical = new URL(videoId ? 'https://www.youtube.com/watch' : 'https://www.youtube.com/playlist');
    if (videoId) canonical.searchParams.set('v', videoId);
    if (playlistId) canonical.searchParams.set('list', playlistId);
    if (startSeconds) canonical.searchParams.set('t', String(startSeconds));
    return { videoId, playlistId, startSeconds, url: canonical.href, key: playlistId ? `playlist:${playlistId}${videoId ? `:${videoId}` : ''}` : `video:${videoId}` };
  } catch { return null; }
}

export interface YouTubePlayer {
  playVideo(): void; pauseVideo(): void; destroy(): void;
  setVolume(volume: number): void;
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  loadPlaylist(options: { list: string; listType: 'playlist'; index?: number; startSeconds?: number }): void;
  cuePlaylist(options: { list: string; listType: 'playlist'; index?: number; startSeconds?: number }): void;
  nextVideo(): void;
  getVideoData(): { title?: string; video_id?: string };
  getPlaylist(): string[] | undefined;
  getIframe(): HTMLIFrameElement;
}
interface PlayerOptions {
  width: string; height: string; host: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady(event: { target: YouTubePlayer }): void;
    onStateChange(event: { data: number; target: YouTubePlayer }): void;
    onError(event: { data: number }): void;
    onAutoplayBlocked(): void;
  };
}
declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}
let api: Promise<void> | undefined;
export function loadYouTubeAPI(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (api) return api;
  api = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    let timeout: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timeout); if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous; };
    const fail = () => { cleanup(); script.remove(); reject(new Error('No pudimos conectar con YouTube. Revisa tu conexión o los bloqueadores del navegador.')); };
    const ready = () => { cleanup(); previous?.(); if (window.YT?.Player) resolve(); else fail(); };
    window.onYouTubeIframeAPIReady = ready;
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true; script.onerror = fail;
    timeout = setTimeout(fail, 15000);
    document.head.append(script);
  }).catch(error => { api = undefined; throw error; });
  return api;
}

export function youtubeError(code: number) {
  if (code === 100) return 'Este video no está disponible o es privado.';
  if (code === 101 || code === 150) return 'El propietario no permite insertar este video. Prueba con otro enlace o ábrelo en YouTube.';
  if (code === 153) return 'YouTube no pudo identificar este reproductor. Usa la app desde una dirección web y permite el identificador de origen del navegador.';
  if (code === 2) return 'YouTube no reconoce este video o playlist. Revisa el enlace.';
  return 'YouTube no pudo reproducir este contenido. Prueba con otro enlace.';
}
