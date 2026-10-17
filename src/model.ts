export interface Victory {
  bossIndex: number;
  name: string;
  defeatedAt: string;
  page: number;
}

export interface BossSkin { name: string; image?: string }
export interface Book {
  id: string;
  title: string;
  fileName: string;
  totalPages: number;
  lastPage: number;
  completedPages: number[];
  victories: Victory[];
  importedAt: string;
  lastOpened: string;
  readingSeconds: number;
  size: number;
  cover?: string;
  skins: Record<string, BossSkin>;
}

export interface Settings {
  theme: 'dark' | 'light';
  mode: 'single' | 'continuous';
  autoComplete: boolean;
  autoSeconds: number;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark', mode: 'single', autoComplete: false, autoSeconds: 60, reducedMotion: false
};

export const BOSSES = [
  { id: 'vespera', name: 'Véspera', epithet: 'Dragón del vacío', type: 'Dragón ancestral', image: '/bosses/vespera.svg', color: '#ad8aff', description: 'Entre las estrellas olvidadas espera el guardián del primer umbral. Solo el conocimiento puede quebrar sus escamas.' },
  { id: 'ignar', name: 'Ignar', epithet: 'Corazón de ceniza', type: 'Demonio de fuego', image: '/bosses/ignar.svg', color: '#f69c68', description: 'Forjado en las entrañas de una montaña dormida. Cada página apaga una chispa de su fuego eterno.' },
  { id: 'nyria', name: 'Nyria', epithet: 'La reina de la escarcha', type: 'Espíritu de hielo', image: '/bosses/nyria.svg', color: '#86daec', description: 'Su corona encierra los inviernos de mil reinos. Rompe el silencio y derrite sus defensas con tu lectura.' },
  { id: 'mordren', name: 'Mordren', epithet: 'El juramento roto', type: 'Caballero oscuro', image: '/bosses/mordren.svg', color: '#c8a9dc', description: 'Un caballero sin reino custodia las historias que nadie se atrevió a terminar. Escribe el final de su guardia.' },
  { id: 'astralis', name: 'Astralis', epithet: 'Eco del infinito', type: 'Entidad cósmica', image: '/bosses/astralis.svg', color: '#d7b97d', description: 'Más allá del tiempo, una mirada sigue el curso de cada historia. Diez páginas bastan para cambiar su destino.' }
] as const;

export function bossFor(book: Book, index = Math.floor(book.completedPages.length / 10)) {
  const base = BOSSES[index % BOSSES.length];
  const skin = book.skins[base.id];
  return { ...base, name: skin?.name || base.name, image: skin?.image || base.image, index };
}

export function bossHealth(book: Book) {
  return 100 - (book.completedPages.length % 10) * 10;
}

export function percent(book: Book) {
  return Math.round(book.completedPages.length / book.totalPages * 100);
}

// Pure reducer used inside an IndexedDB read/write transaction. Navigation never calls it.
export function completePage(book: Book, page: number, now = new Date().toISOString()): Book {
  if (!Number.isInteger(page) || page < 1 || page > book.totalPages || book.completedPages.includes(page)) return book;
  const completedPages = [...book.completedPages, page].sort((a, b) => a - b);
  const victory = completedPages.length % 10 === 0;
  return {
    ...book, completedPages,
    victories: victory ? [...book.victories, {
      bossIndex: Math.floor(book.completedPages.length / 10),
      name: bossFor(book).name, defeatedAt: now, page
    }] : book.victories
  };
}
