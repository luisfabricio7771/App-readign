import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, Diamond, ShieldCheck, WifiOff, Swords, Upload, ImagePlus, RotateCcw, Check, Moon, Sun, BookOpen, Timer, Sparkles, ArrowDownToLine } from 'lucide-react';
import { BOSSES, type Book, type Settings } from './model';
import { prepareImage } from './pdf';
import { useState } from 'react';

export function Crystal({ small = false }: { small?: boolean }) {
  return <img className={small ? 'crystal small' : 'crystal'} src="/icon.svg" alt="" />;
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = ref.current!;
    (node.querySelector('[autofocus], input, button, select') as HTMLElement)?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, a[href], [tabindex="0"]')].filter(item => item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', listener);
    return () => { document.body.style.overflow = priorOverflow; document.removeEventListener('keydown', listener); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`modal ${wide ? 'wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar ventana"><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}

export function PrivacyNote() {
  return <div className="privacy-line"><span><ShieldCheck size={14} /> Solo en tu dispositivo</span><i /><span><WifiOff size={14} /> Sin conexión</span><i /><span>Sin anuncios. Siempre.</span></div>;
}

export function SettingsModal({ settings, onChange, onClose, onInstall }: { settings: Settings; onChange: (settings: Settings) => void; onClose: () => void; onInstall: () => void }) {
  return <Modal title="A tu manera" onClose={onClose}>
    <p className="modal-intro">Tu espacio de lectura, tus reglas. Los cambios se guardan automáticamente en este dispositivo.</p>
    <div className="settings-section"><h3>Apariencia</h3><div className="segmented">
      <button className={settings.theme === 'dark' ? 'selected' : ''} onClick={() => onChange({ ...settings, theme: 'dark' })}><Moon size={16} /> Oscura</button>
      <button className={settings.theme === 'light' ? 'selected' : ''} onClick={() => onChange({ ...settings, theme: 'light' })}><Sun size={16} /> Clara</button>
    </div></div>
    <div className="settings-section"><h3><BookOpen size={16} /> Modo de lectura</h3><div className="segmented">
      <button className={settings.mode === 'single' ? 'selected' : ''} onClick={() => onChange({ ...settings, mode: 'single' })}>Página individual</button>
      <button className={settings.mode === 'continuous' ? 'selected' : ''} onClick={() => onChange({ ...settings, mode: 'continuous' })}>Continua</button>
    </div></div>
    <div className="settings-section"><label className="toggle-row"><span><strong><Timer size={16} /> Lectura automática</strong><small>Completar la página visible después de un tiempo de lectura activa.</small></span><input type="checkbox" role="switch" checked={settings.autoComplete} onChange={e => onChange({ ...settings, autoComplete: e.target.checked })} /></label>
      {settings.autoComplete && <label className="field inline-field">Tiempo por página<select value={settings.autoSeconds} onChange={e => onChange({ ...settings, autoSeconds: Number(e.target.value) })}><option value={30}>30 segundos</option><option value={60}>1 minuto</option><option value={120}>2 minutos</option><option value={180}>3 minutos</option><option value={300}>5 minutos</option></select></label>}
      <p className="helper">Desactivada por defecto. El temporizador se reinicia al cambiar de página y se pausa si ocultas la app. Siempre puedes usar «Página leída».</p>
    </div>
    <div className="settings-section"><label className="toggle-row"><span><strong><Sparkles size={16} /> Reducir animaciones</strong><small>Una aventura más tranquila.</small></span><input type="checkbox" role="switch" checked={settings.reducedMotion} onChange={e => onChange({ ...settings, reducedMotion: e.target.checked })} /></label></div>
    <div className="info-box"><ShieldCheck size={20} /><p>Tus libros nunca salen de aquí. El navegador guarda archivos y progreso en este dispositivo. Borrar los datos del sitio también borra tu biblioteca; conserva tus PDF originales.</p></div>
    <button className="button secondary full" onClick={onInstall}><ArrowDownToLine size={16} /> Instalar Final Reader</button>
  </Modal>;
}

export function BossEditor({ book, bossId, onSave, onClose }: { book: Book; bossId: string; onSave: (name: string, image?: string) => Promise<void>; onClose: () => void }) {
  const original = BOSSES.find(boss => boss.id === bossId)!;
  const [name, setName] = useState(book.skins[bossId]?.name || original.name as string);
  const [image, setImage] = useState(book.skins[bossId]?.image);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return <Modal title="Dale rostro a tu rival" onClose={() => { if (!busy) onClose(); }}>
    <p className="modal-intro">Personaliza a {original.name} para «{book.title}». Su aspecto cambiará; su desafío seguirá siendo de 10 páginas.</p>
    <div className="boss-edit-preview"><img src={image || original.image} alt="Vista previa del jefe" /></div>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); try { await onSave(name.trim() || original.name, image); onClose(); } catch { setError('No se pudo guardar el jefe. Comprueba el espacio disponible.'); } finally { setBusy(false); } }}>
      <label className="field">Nombre del jefe<input value={name} maxLength={50} required onChange={e => setName(e.target.value)} /></label>
      <input ref={input} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" aria-label="Imagen del jefe" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setError(''); setBusy(true); try { setImage(await prepareImage(file)); } catch (err) { setError((err as Error).message); } finally { setBusy(false); e.target.value = ''; } }} />
      <div className="button-row"><button type="button" className="button secondary" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={17} /> Subir imagen</button><button type="button" className="text-button" onClick={() => { setName(original.name); setImage(undefined); }}><RotateCcw size={14} /> Restaurar</button></div>
      <p className="helper">PNG, JPG, WebP, GIF o AVIF · hasta 15 MB. Usa imágenes propias o que tengas derecho a utilizar. Se guardan localmente.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary full" disabled={busy} type="submit"><Check size={17} /> {busy ? 'Preparando imagen…' : 'Guardar personalización'}</button>
    </form>
  </Modal>;
}

export function InstallHelp({ onClose }: { onClose: () => void }) {
  return <Modal title="Lleva la aventura contigo" onClose={onClose}>
    <div className="install-illustration"><Crystal /><ArrowDownToLine size={22} /></div>
    <p className="modal-intro">Final Reader se instala como una aplicación gratuita. No necesitas una cuenta ni una tienda de apps.</p>
    <div className="settings-section"><h3>iPhone o iPad</h3><p>Abre esta página en Safari, pulsa <strong>Compartir</strong> y elige <strong>Añadir a pantalla de inicio</strong>.</p></div>
    <div className="settings-section"><h3>Windows o Android</h3><p>En Chrome o Edge, abre el menú del navegador y elige <strong>Instalar Final Reader</strong> o <strong>Instalar esta página como aplicación</strong>.</p></div>
    <div className="info-box"><WifiOff size={20} /><p>Abre la app una vez con conexión para preparar el modo sin conexión. Tus libros importados estarán en este navegador; no se sincronizan entre dispositivos.</p></div>
  </Modal>;
}

export function EmptyLibrary({ onImport, onSample, filtered = false }: { onImport: () => void; onSample: () => void; filtered?: boolean }) {
  return <div className="empty-library"><div className="empty-symbol"><BookOpen size={28} /><Diamond className="empty-star" size={12} /></div><h3>{filtered ? 'No encontramos ese libro' : 'Hay mundos esperando por ti'}</h3><p>{filtered ? 'Prueba con otro título o cambia el filtro de tu biblioteca.' : 'Añade tu primer PDF. Nosotros ponemos la aventura.'}</p>{!filtered && <div className="button-row"><button className="button secondary" onClick={onImport}><Upload size={16} /> Añadir un libro</button><button className="text-button" onClick={onSample}>Probar con una muestra <span>→</span></button></div>}</div>;
}

export function HealthBar({ health, label = true }: { health: number; label?: boolean }) {
  return <div className="health-meter"><div className="health-track" role="progressbar" aria-label="Vida del jefe" aria-valuenow={health} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${health}%` }} /></div>{label && <div className="health-caption"><span>PV <b>{health}</b> / 100</span><span>{health}%</span></div>}</div>;
}

export function Stat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string | number; detail: string }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span className="stat-label">{label}</span><div className="stat-value">{value} <span>{detail}</span></div></div></div>;
}

export function CombatRules() {
  return <div className="combat-rules"><Swords size={16} /><p><strong>Una página. Un ataque.</strong><span>10 páginas nuevas = 1 jefe derrotado.</span></p></div>;
}
