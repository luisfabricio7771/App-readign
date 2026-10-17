import { describe, expect, it } from 'vitest';
import { bossFor, bossHealth, completePage, percent, type Book } from './model';

function book(totalPages = 60): Book {
  return { id: 'test', title: 'Libro', fileName: 'libro.pdf', totalPages, lastPage: 1, completedPages: [], victories: [], importedAt: '', lastOpened: '', readingSeconds: 0, size: 1, skins: {} };
}
describe('Reading combat', () => {
  it('counts only the completed page, including after jumping to page 50', () => {
    const result = completePage({ ...book(), lastPage: 50 }, 50);
    expect(result.completedPages).toEqual([50]);
    expect(bossHealth(result)).toBe(90);
    expect(result.victories).toHaveLength(0);
  });
  it('never rewards the same page twice', () => {
    const once = completePage(book(), 1);
    expect(completePage(once, 1)).toBe(once);
  });
  it('rejects invalid page numbers', () => {
    const original = book();
    for (const page of [-1, 0, 61, 1.5, NaN, Infinity]) expect(completePage(original, page)).toBe(original);
  });
  it('defeats exactly one boss on the tenth distinct page, then starts a new boss', () => {
    let current = book();
    for (let page = 1; page <= 9; page++) current = completePage(current, page);
    expect(bossHealth(current)).toBe(10);
    expect(current.victories).toHaveLength(0);
    current = completePage(current, 10, '2026-10-17T12:00:00.000Z');
    expect(current.victories).toEqual([{ bossIndex: 0, name: 'Véspera', page: 10, defeatedAt: '2026-10-17T12:00:00.000Z' }]);
    expect(bossHealth(current)).toBe(100);
    expect(bossFor(current).name).toBe('Ignar');
    expect(bossHealth(completePage(current, 11))).toBe(90);
  });
  it('cycles appearances while keeping each encounter distinct', () => {
    let current = book();
    for (let page = 1; page <= 60; page++) current = completePage(current, page);
    expect(current.victories.map(victory => victory.bossIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(current.victories[5].name).toBe('Véspera');
    expect(bossFor(current).index).toBe(6);
    expect(percent(current)).toBe(100);
  });
  it('preserves custom names in the victory history', () => {
    let current: Book = { ...book(), skins: { vespera: { name: 'Mi dragón', image: 'data:image/png;base64,test' } } };
    for (let page = 1; page <= 10; page++) current = completePage(current, page);
    expect(current.victories[0].name).toBe('Mi dragón');
    expect(bossFor({ ...current, skins: {} }, 0).name).toBe('Véspera');
    expect(current.victories[0].name).toBe('Mi dragón');
  });
  it('keeps books independent and short final encounters unfinished', () => {
    let first = book(3);
    const second = book();
    for (let page = 1; page <= 3; page++) first = completePage(first, page);
    expect(percent(first)).toBe(100);
    expect(first.victories).toHaveLength(0);
    expect(bossHealth(first)).toBe(70);
    expect(second.completedPages).toHaveLength(0);
    expect(bossHealth(second)).toBe(100);
  });
});
