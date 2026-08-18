/**
 * Pure to-do list operations for the quick to-do / sticky-notes tool. Framework-
 * free and immutable (every op returns a new array) so the island just persists
 * the result to localStorage. IDs are supplied by the caller to keep this pure.
 */

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

/** Append a new (unchecked) item. Blank text is ignored. */
export function addTodo(list: Todo[], text: string, id: string): Todo[] {
  const t = text.trim();
  if (!t) return list;
  return [...list, { id, text: t, done: false }];
}

/** Flip the done state of one item. */
export function toggleTodo(list: Todo[], id: string): Todo[] {
  return list.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

/** Edit the text of one item (blank clears to empty string, kept for the row). */
export function editTodo(list: Todo[], id: string, text: string): Todo[] {
  return list.map((t) => (t.id === id ? { ...t, text } : t));
}

/** Remove one item. */
export function removeTodo(list: Todo[], id: string): Todo[] {
  return list.filter((t) => t.id !== id);
}

/** Drop all completed items. */
export function clearDone(list: Todo[]): Todo[] {
  return list.filter((t) => !t.done);
}

/** Move an item up (-1) or down (+1), clamped within bounds. */
export function moveTodo(list: Todo[], id: string, dir: -1 | 1): Todo[] {
  const i = list.findIndex((t) => t.id === id);
  if (i === -1) return list;
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Number of not-yet-done items. */
export function activeCount(list: Todo[]): number {
  return list.reduce((n, t) => n + (t.done ? 0 : 1), 0);
}
