import { describe, it, expect } from 'vitest';
import { addTodo, toggleTodo, editTodo, removeTodo, clearDone, moveTodo, activeCount, type Todo } from './todo.lib';

const base: Todo[] = [
  { id: 'a', text: 'first', done: false },
  { id: 'b', text: 'second', done: true },
  { id: 'c', text: 'third', done: false },
];

describe('todo', () => {
  it('adds a trimmed item', () => {
    const r = addTodo([], '  buy milk  ', 'x');
    expect(r).toEqual([{ id: 'x', text: 'buy milk', done: false }]);
  });

  it('ignores blank additions', () => {
    expect(addTodo(base, '   ', 'z')).toBe(base);
  });

  it('toggles done', () => {
    expect(toggleTodo(base, 'a')[0].done).toBe(true);
    expect(toggleTodo(base, 'b')[1].done).toBe(false);
  });

  it('edits text', () => {
    expect(editTodo(base, 'a', 'changed')[0].text).toBe('changed');
  });

  it('removes an item', () => {
    expect(removeTodo(base, 'b').map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('clears completed', () => {
    expect(clearDone(base).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('moves items and clamps at the edges', () => {
    expect(moveTodo(base, 'a', 1).map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(moveTodo(base, 'a', -1)).toBe(base); // already at top → unchanged reference
    expect(moveTodo(base, 'c', 1)).toBe(base);  // already at bottom
  });

  it('counts active items', () => {
    expect(activeCount(base)).toBe(2);
  });

  it('does not mutate the input', () => {
    const copy = JSON.parse(JSON.stringify(base));
    toggleTodo(base, 'a');
    expect(base).toEqual(copy);
  });
});
