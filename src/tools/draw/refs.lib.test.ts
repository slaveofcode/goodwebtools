import { describe, it, expect } from 'vitest';
import { addRef, removeRef, hasRef } from './refs.lib';

const fk = (table: string, column: string) => ({ table, column, pk: false, unique: false });
const pk = (table: string, column: string) => ({ table, column, pk: true, unique: false });
const uniq = (table: string, column: string) => ({ table, column, pk: false, unique: true });

const BASE = `Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
}
`;

describe('addRef — cardinality inference', () => {
  it('FK → PK yields many-to-one with the FK on the left', () => {
    const out = addRef(BASE, fk('posts', 'user_id'), pk('users', 'id'));
    expect(out).toContain('Ref: posts.user_id > users.id');
  });

  it('is direction-independent (PK → FK gives the same line)', () => {
    const out = addRef(BASE, pk('users', 'id'), fk('posts', 'user_id'));
    expect(out).toContain('Ref: posts.user_id > users.id');
  });

  it('unique ↔ pk yields one-to-one', () => {
    const out = addRef(BASE, uniq('profiles', 'user_id'), pk('users', 'id'));
    expect(out).toContain('Ref: profiles.user_id - users.id');
  });

  it('dedupes an existing relationship', () => {
    const once = addRef(BASE, fk('posts', 'user_id'), pk('users', 'id'));
    const twice = addRef(once, pk('users', 'id'), fk('posts', 'user_id'));
    expect(twice).toBe(once);
  });

  it('ignores a self-connection on the same column', () => {
    expect(addRef(BASE, pk('users', 'id'), pk('users', 'id'))).toBe(BASE);
  });

  it('does not confuse a prefix column (users.id vs users.identity)', () => {
    const withRef = addRef(BASE, fk('posts', 'user_id'), pk('users', 'id'));
    // Adding a different relationship to users.identity must not be deduped away.
    const more = addRef(withRef, fk('posts', 'author'), pk('users', 'identity'));
    expect(more).toContain('Ref: posts.author > users.identity');
  });
});

describe('hasRef', () => {
  it('detects an existing standalone ref in either order', () => {
    const dbml = BASE + 'Ref: posts.user_id > users.id\n';
    expect(hasRef(dbml, fk('posts', 'user_id'), pk('users', 'id'))).toBe(true);
    expect(hasRef(dbml, pk('users', 'id'), fk('posts', 'user_id'))).toBe(true);
    expect(hasRef(dbml, fk('posts', 'title'), pk('users', 'id'))).toBe(false);
  });
});

describe('removeRef', () => {
  it('removes the matching standalone ref line and keeps the rest', () => {
    const dbml = BASE + 'Ref: posts.user_id > users.id\n';
    const out = removeRef(dbml, fk('posts', 'user_id'), pk('users', 'id'));
    expect(out).not.toContain('Ref: posts.user_id > users.id');
    expect(out).toContain('Table users');
    expect(out).toContain('Table posts');
  });

  it('matches regardless of operator/direction in the text', () => {
    const dbml = BASE + 'Ref: users.id < posts.user_id\n';
    const out = removeRef(dbml, fk('posts', 'user_id'), pk('users', 'id'));
    expect(out).not.toMatch(/Ref:/);
  });

  it('leaves unrelated refs intact', () => {
    const dbml = BASE + 'Ref: posts.user_id > users.id\nRef: posts.id > users.id\n';
    const out = removeRef(dbml, fk('posts', 'user_id'), pk('users', 'id'));
    expect(out).not.toContain('posts.user_id > users.id');
    expect(out).toContain('Ref: posts.id > users.id');
  });
});
