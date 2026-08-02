/**
 * The Digital Legacy Letter "vault": turns the letter + accounts into a single
 * encrypted, self-describing file, and opens it again via either the password or a
 * quorum of family shares. The file never contains the shares — those are handed out
 * separately. Text-based (JSON) so it survives email/copy-paste.
 */
import {
  generateDek, encryptWithDek, decryptWithDek,
  wrapDekWithPassword, unwrapDekWithPassword, type PasswordWrap, type Ciphertext,
} from './crypto.lib';
import { split, combine } from './shamir.lib';

export const VAULT_EXT = 'gwtvault';
const APP = 'gwt-legacy';
const VERSION = 1;
const SHARE_PREFIX = 'gwt-wasiat.v1.';

export interface Account {
  service: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
}

export interface LegacyContent {
  /** The personal message / letter. */
  message: string;
  accounts: Account[];
  /** ISO date the vault was created. */
  createdAt?: string;
}

// ---- base64 helpers (binary-safe) ----
function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(str: string): Uint8Array {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const b64url = (b: Uint8Array) => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => unb64(s.replace(/-/g, '+').replace(/_/g, '/'));

function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 4);
}

// ---- share strings ----
/** Encode a raw share ([x, ...bytes]) as a human-transportable string with a checksum. */
export function encodeShare(share: Uint8Array): string {
  return `${SHARE_PREFIX}${b64url(share)}.${fnv1a(share)}`;
}

/** Decode + checksum-verify a share string back to raw bytes. */
export function decodeShare(str: string): Uint8Array {
  const trimmed = str.trim();
  if (!trimmed.startsWith(SHARE_PREFIX)) throw new Error('This does not look like a family share.');
  const body = trimmed.slice(SHARE_PREFIX.length);
  const dot = body.lastIndexOf('.');
  if (dot < 0) throw new Error('This share is incomplete.');
  const bytes = unb64url(body.slice(0, dot));
  if (fnv1a(bytes) !== body.slice(dot + 1)) throw new Error('This share looks mistyped (checksum failed).');
  return bytes;
}

interface Envelope {
  app: string;
  v: number;
  content: { iv: string; ct: string };
  password: { salt: string; iters: number; iv: string; ct: string } | null;
  shares: { n: number; k: number } | null;
}

const encodeCt = (c: Ciphertext) => ({ iv: b64(c.iv), ct: b64(c.ct) });
const decodeCt = (o: { iv: string; ct: string }): Ciphertext => ({ iv: unb64(o.iv), ct: unb64(o.ct) });

export interface CreateOptions {
  password?: string;
  shares?: { n: number; k: number };
}

export interface CreateResult {
  /** The .gwtvault file text to download. */
  file: string;
  /** Share strings to distribute (empty if shares weren't requested). */
  shares: string[];
}

/** Encrypt the content into a vault file (+ optional shares). Requires at least one recovery path. */
export async function createVault(content: LegacyContent, opts: CreateOptions): Promise<CreateResult> {
  const hasPw = !!opts.password;
  const hasShares = !!opts.shares;
  if (!hasPw && !hasShares) throw new Error('Choose at least one way to unlock: a password or family shares.');
  if (opts.shares) {
    const { n, k } = opts.shares;
    if (k < 2) throw new Error('Family shares need a threshold of at least 2.');
    if (n < k) throw new Error('Total shares must be at least the threshold.');
    if (n > 20) throw new Error('Keep total shares to 20 or fewer.');
  }

  const dek = generateDek();
  const plain = new TextEncoder().encode(JSON.stringify({ ...content, createdAt: content.createdAt ?? undefined }));
  const contentCt = await encryptWithDek(plain, dek);

  let password: Envelope['password'] = null;
  if (opts.password) {
    const w = await wrapDekWithPassword(dek, opts.password);
    password = { salt: b64(w.salt), iters: w.iters, iv: b64(w.iv), ct: b64(w.ct) };
  }

  let shareStrings: string[] = [];
  let sharesMeta: Envelope['shares'] = null;
  if (opts.shares) {
    const raw = split(dek, opts.shares.n, opts.shares.k);
    shareStrings = raw.map(encodeShare);
    sharesMeta = { n: opts.shares.n, k: opts.shares.k };
  }

  const envelope: Envelope = { app: APP, v: VERSION, content: encodeCt(contentCt), password, shares: sharesMeta };
  return { file: JSON.stringify(envelope, null, 2), shares: shareStrings };
}

/** Parse + validate a vault file. Throws with a clear message on a bad/foreign file. */
export function parseVault(file: string): Envelope {
  let obj: Envelope;
  try {
    obj = JSON.parse(file);
  } catch {
    throw new Error('This is not a valid GoodWebTools legacy vault file.');
  }
  if (obj?.app !== APP) throw new Error('This is not a GoodWebTools legacy vault (.gwtvault) file.');
  if (obj.v !== VERSION) throw new Error(`Unsupported vault version (${obj.v}).`);
  if (!obj.content?.iv || !obj.content?.ct) throw new Error('This vault file is missing its contents.');
  return obj;
}

/** What unlock methods a given vault supports. */
export function vaultCapabilities(file: string): { password: boolean; shares: { n: number; k: number } | null } {
  const env = parseVault(file);
  return { password: !!env.password, shares: env.shares };
}

async function decryptContent(env: Envelope, dek: Uint8Array): Promise<LegacyContent> {
  let plain: Uint8Array;
  try {
    plain = await decryptWithDek(decodeCt(env.content), dek);
  } catch {
    throw new Error('The letter could not be opened — the key was incorrect.');
  }
  return JSON.parse(new TextDecoder().decode(plain)) as LegacyContent;
}

/** Open a vault with the password. */
export async function openWithPassword(file: string, password: string): Promise<LegacyContent> {
  const env = parseVault(file);
  if (!env.password) throw new Error('This vault is not protected by a password — use the family shares instead.');
  const wrap: PasswordWrap = {
    salt: unb64(env.password.salt), iters: env.password.iters,
    iv: unb64(env.password.iv), ct: unb64(env.password.ct),
  };
  const dek = await unwrapDekWithPassword(wrap, password);
  return decryptContent(env, dek);
}

/** Open a vault with a quorum of family shares. */
export async function openWithShares(file: string, shareStrings: string[]): Promise<LegacyContent> {
  const env = parseVault(file);
  if (!env.shares) throw new Error('This vault does not use family shares — use the password instead.');
  const decoded = shareStrings.map(decodeShare);
  if (decoded.length < env.shares.k) {
    throw new Error(`Need at least ${env.shares.k} shares to open this letter — you provided ${decoded.length}.`);
  }
  const dek = combine(decoded);
  return decryptContent(env, dek);
}
