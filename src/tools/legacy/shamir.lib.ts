/**
 * Shamir Secret Sharing over GF(2^8) — splits a secret (the vault's 32-byte data
 * key) into `n` shares such that any `k` of them reconstruct it, and fewer than `k`
 * reveal nothing. Pure and framework-free; the field is the AES field (reducing
 * polynomial 0x11b, generator 0x03). Operates byte-wise, so the secret can be any
 * length. Correctness of a reconstruction is verified downstream by AES-GCM's auth
 * tag (a wrong/insufficient combine yields a key that fails to decrypt).
 */

// GF(2^8) log/exp tables (generator g = 3).
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x ^= xtime(x); // x = x*2 ^ x = x*3
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function xtime(a: number): number {
  const b = a << 1;
  return (b & 0x100 ? b ^ 0x11b : b) & 0xff;
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Multiplicative inverse in GF(2^8). */
function inv(a: number): number {
  if (a === 0) throw new Error('division by zero in GF(256)');
  return EXP[255 - LOG[a]];
}

/** Evaluate a polynomial (coeffs low→high) at x via Horner's method. */
function evalPoly(coeffs: Uint8Array, x: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) result = mul(result, x) ^ coeffs[i];
  return result;
}

export interface SplitOptions {
  /** Injectable randomness for tests; defaults to crypto.getRandomValues. */
  random?: (len: number) => Uint8Array;
}

function defaultRandom(len: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(len));
}

/**
 * Split `secret` into `n` shares, any `k` of which reconstruct it. Each returned
 * share is `[x, ...values]` where x (1..n) is the share's evaluation point.
 */
export function split(secret: Uint8Array, n: number, k: number, opts: SplitOptions = {}): Uint8Array[] {
  if (!Number.isInteger(n) || !Number.isInteger(k)) throw new Error('n and k must be integers.');
  if (k < 1) throw new Error('Threshold k must be at least 1.');
  if (n < k) throw new Error('Total shares n must be ≥ threshold k.');
  if (n > 255) throw new Error('At most 255 shares are supported.');
  if (secret.length === 0) throw new Error('Secret must not be empty.');
  const random = opts.random ?? defaultRandom;

  const shares: Uint8Array[] = [];
  for (let x = 1; x <= n; x++) {
    const out = new Uint8Array(secret.length + 1);
    out[0] = x;
    shares.push(out);
  }

  for (let j = 0; j < secret.length; j++) {
    // Polynomial with constant term = secret byte, k-1 random higher coeffs.
    const coeffs = new Uint8Array(k);
    coeffs[0] = secret[j];
    if (k > 1) coeffs.set(random(k - 1), 1);
    for (let s = 0; s < n; s++) {
      shares[s][j + 1] = evalPoly(coeffs, s + 1);
    }
  }
  return shares;
}

/**
 * Reconstruct the secret from shares via Lagrange interpolation at x=0. Requires at
 * least `k` valid, distinct shares; passing fewer (or mismatched) yields a wrong
 * secret rather than an error — verified downstream by decryption.
 */
export function combine(shares: Uint8Array[]): Uint8Array {
  if (shares.length === 0) throw new Error('Provide at least one share.');
  const len = shares[0].length - 1;
  if (len < 1) throw new Error('Malformed share.');
  const xs = shares.map(s => s[0]);
  if (new Set(xs).size !== xs.length) throw new Error('Duplicate shares — each share must be different.');
  if (xs.some((x, i) => x === 0 || shares[i].length - 1 !== len)) throw new Error('Malformed or inconsistent shares.');

  // Precompute each share's Lagrange basis at 0: L_i = ∏_{m≠i} x_m / (x_i ⊕ x_m).
  const basis = xs.map((xi, i) => {
    let num = 1;
    let den = 1;
    for (let m = 0; m < xs.length; m++) {
      if (m === i) continue;
      num = mul(num, xs[m]);
      den = mul(den, xi ^ xs[m]);
    }
    return mul(num, inv(den));
  });

  const secret = new Uint8Array(len);
  for (let j = 0; j < len; j++) {
    let acc = 0;
    for (let i = 0; i < shares.length; i++) acc ^= mul(shares[i][j + 1], basis[i]);
    secret[j] = acc;
  }
  return secret;
}
