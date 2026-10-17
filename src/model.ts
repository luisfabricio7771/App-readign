export interface Victory {
  bossIndex: number;
  bossId?: string;
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
  pageAnimation: boolean;
  bossAnimation: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark', mode: 'single', autoComplete: false, autoSeconds: 60, reducedMotion: false,
  pageAnimation: true, bossAnimation: true
};

export const BOSSES = [
  { id: 'vespera', name: 'Ala de Amatista', epithet: 'El sello alado del vacío', type: 'Guardián de amatista', image: '/bosses/vespera.png', color: '#ad8aff', description: 'Un ojo violeta vigila el vacío entre dos alas de cristal. Sus órbitas doradas guardan el primer umbral de cada historia.' },
  { id: 'ignar', name: 'Sol de Ámbar', epithet: 'La mirada de una estrella extinta', type: 'Sello solar', image: '/bosses/ignar.png', color: '#f69c68', description: 'Un ojo de ámbar arde entre rayos de cristal. Cada página apaga una chispa del fuego que sus anillos mantienen cautivo.' },
  { id: 'nyria', name: 'Corona de Escarcha', epithet: 'El invierno de seis puntas', type: 'Cristal de hielo', image: '/bosses/nyria.png', color: '#86daec', description: 'Una mirada inmóvil habita una corona de hielo suspendida entre órbitas heladas. Rompe su silencio con tu lectura.' },
  { id: 'mordren', name: 'Hoja de Obsidiana', epithet: 'El juramento sellado', type: 'Espada astral', image: '/bosses/mordren.png', color: '#c8a9dc', description: 'Una hoja oscura, una corona flotante y un ojo que nunca duerme. El juramento de un reino olvidado permanece dentro de este cristal.' },
  { id: 'astralis', name: 'Ojo del Infinito', epithet: 'El antiguo Astralis', type: 'Entidad cósmica', image: '/bosses/astralis.svg', color: '#d7b97d', description: 'En el centro de sus órbitas, una pupila dorada sigue el curso de cada historia. Su mirada existe más allá del tiempo.' },
  { id: 'eclipse', name: 'Eclipse Carmesí', epithet: 'La luna que devoró al sol', type: 'Eclipse de rubí', image: '/bosses/eclipse.png', color: '#e18b9d', description: 'Dos lunas de rubí encierran un ojo rojo. Sus anillos trazan la frontera entre la luz y el vacío.' },
  { id: 'lotus', name: 'Loto Esmeralda', epithet: 'El jardín entre las estrellas', type: 'Flor de cristal', image: '/bosses/lotus.png', color: '#8dd5b0', description: 'Una flor de esmeralda abre sus pétalos sobre un cielo sin suelo. Su mirada guarda las historias que todavía deben florecer.' },
  { id: 'hourglass', name: 'Reloj del Vacío', epithet: 'La última arena del tiempo', type: 'Reloj astral', image: '/bosses/hourglass.png', color: '#d7b785', description: 'Dos prismas oscuros sostienen un río de estrellas. Cada página hace caer un grano de luz en su reloj imposible.' },
  { id: 'moth', name: 'Mariposa Lunar', epithet: 'La mensajera de la noche', type: 'Alas de luna', image: '/bosses/moth.png', color: '#a8b9f1', description: 'Sus cuatro alas de zafiro se abren bajo una luna de plata. Un único ojo guía su vuelo entre las constelaciones.' },
  { id: 'dawn', name: 'Corona del Alba', epithet: 'El primer fulgor del horizonte', type: 'Corona celestial', image: '/bosses/dawn.png', color: '#ead6a0', description: 'Cinco cristales blancos coronan una mirada de oro. Es el último guardián antes de que una nueva vuelta de la aventura comience.' }
] as const;

const LEGACY_BOSS_IDS = ['vespera', 'ignar', 'nyria', 'mordren', 'astralis'];
export function bossForVictory(victory: Victory) {
  const id = victory.bossId || LEGACY_BOSS_IDS[victory.bossIndex % LEGACY_BOSS_IDS.length];
  return BOSSES.find(boss => boss.id === id) || BOSSES[0];
}

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
      bossId: bossFor(book).id,
      name: bossFor(book).name, defeatedAt: now, page
    }] : book.victories
  };
}
