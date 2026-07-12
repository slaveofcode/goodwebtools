// Copies the @imgly/background-removal model assets into public/models/imgly
// for LOCAL DEV only (served at /models/imgly/, same path the R2 Worker uses
// in production). These are gitignored and are NOT part of the production build
// — in production they're uploaded to the R2 bucket under the imgly/ prefix.
import { cpSync, mkdirSync, existsSync } from 'node:fs';

const SRC = 'node_modules/@imgly/background-removal-data/dist';
const DEST = 'public/models/imgly';

if (!existsSync(SRC)) {
  console.error('Missing @imgly/background-removal-data. Run: npm i -D @imgly/background-removal-data');
  process.exit(1);
}
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });
console.log(`Staged model assets → ${DEST} (local dev).`);
console.log('For production, upload these files to the R2 bucket under "imgly/". See DEPLOYMENT.md.');
