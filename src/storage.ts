import { openDB, type DBSchema } from 'idb';
import { DEFAULT_SETTINGS, type Book, type Settings } from './model';
import { DEFAULT_MUSIC, type MusicPreferences } from './youtube';

interface ReaderDB extends DBSchema {
  books: { key: string; value: Book };
  files: { key: string; value: Blob };
  settings: { key: string; value: Settings };
  music: { key: string; value: MusicPreferences };
}
const db = openDB<ReaderDB>('final-reader', 2, {
  upgrade(database, oldVersion) {
    if (oldVersion < 1) {
      database.createObjectStore('books', { keyPath: 'id' });
      database.createObjectStore('files');
      database.createObjectStore('settings');
    }
    if (oldVersion < 2) database.createObjectStore('music');
  }
});

export const listBooks = async () => (await db).getAll('books');
export const getFile = async (id: string) => (await db).get('files', id);
export async function addBook(book: Book, file: Blob) {
  const tx = (await db).transaction(['books', 'files'], 'readwrite');
  await Promise.all([tx.objectStore('books').add(book), tx.objectStore('files').add(file, book.id)]);
  await tx.done;
}
export async function mutateBook(id: string, update: (book: Book) => Book) {
  const tx = (await db).transaction('books', 'readwrite');
  const book = await tx.store.get(id);
  if (!book) throw new Error('Este libro ya no está en la biblioteca.');
  const next = update(book);
  await tx.store.put(next);
  await tx.done;
  return next;
}
export async function deleteBook(id: string) {
  const tx = (await db).transaction(['books', 'files'], 'readwrite');
  await Promise.all([tx.objectStore('books').delete(id), tx.objectStore('files').delete(id)]);
  await tx.done;
}
export const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...await (await db).get('settings', 'preferences') });
export const saveSettings = async (settings: Settings) => (await db).put('settings', settings, 'preferences');
export const loadMusic = async () => ({ ...DEFAULT_MUSIC, ...await (await db).get('music', 'preferences') });
export const saveMusic = async (preferences: MusicPreferences) => (await db).put('music', preferences, 'preferences');

export async function requestPersistence() {
  // An unsupported or denied request must not prevent importing a book.
  try { return await navigator.storage?.persist?.() ?? false; } catch { return false; }
}
