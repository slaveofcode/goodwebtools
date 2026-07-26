import * as Comlink from 'comlink';
import type { Remote } from 'comlink';
import type { SqliteApi } from './sqlite.worker';
import SqliteWorker from './sqlite.worker?worker';

let remote: Remote<SqliteApi> | null = null;

/** Comlink-wrapped SQLite engine, created once per session. */
export function getSqlite(): Remote<SqliteApi> {
  if (!remote) {
    const worker = new SqliteWorker();
    worker.addEventListener('error', (e) => console.error('[sqlite worker]', e.message));
    remote = Comlink.wrap<SqliteApi>(worker);
  }
  return remote;
}
