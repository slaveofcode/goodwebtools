import { describe, it, expect } from 'vitest';
import {
  createVault, openWithPassword, openWithShares, parseVault,
  vaultCapabilities, encodeShare, decodeShare, type LegacyContent,
} from './vault.lib';

const content: LegacyContent = {
  message: 'Untuk keluargaku — terima kasih untuk segalanya. 🙏',
  accounts: [
    { service: 'Instagram', username: 'me@example.com', password: 'sup3r-s3cret!', url: 'instagram.com', notes: '2FA di HP' },
    { service: 'Bank', username: '1234567890', password: 'pinpin', notes: 'rekening utama' },
  ],
};

describe('vault — password path', () => {
  it('round-trips content through create → openWithPassword', async () => {
    const { file } = await createVault(content, { password: 'correct horse battery staple' });
    const out = await openWithPassword(file, 'correct horse battery staple');
    expect(out.message).toBe(content.message);
    expect(out.accounts).toEqual(content.accounts);
  });

  it('rejects the wrong password', async () => {
    const { file } = await createVault(content, { password: 'right' });
    await expect(openWithPassword(file, 'wrong')).rejects.toThrow(/[Ww]rong password/);
  });

  it('a password-only vault cannot be opened with shares', async () => {
    const { file, shares } = await createVault(content, { password: 'x' });
    expect(shares).toHaveLength(0);
    await expect(openWithShares(file, [])).rejects.toThrow(/does not use family shares/);
  });
});

describe('vault — family shares path', () => {
  it('opens with any k of n shares', async () => {
    const { file, shares } = await createVault(content, { shares: { n: 5, k: 3 } });
    expect(shares).toHaveLength(5);
    const out = await openWithShares(file, [shares[4], shares[1], shares[2]]);
    expect(out.accounts).toEqual(content.accounts);
    const out2 = await openWithShares(file, [shares[0], shares[3], shares[4]]);
    expect(out2.message).toBe(content.message);
  });

  it('refuses fewer than k shares', async () => {
    const { file, shares } = await createVault(content, { shares: { n: 5, k: 3 } });
    await expect(openWithShares(file, [shares[0], shares[1]])).rejects.toThrow(/[Nn]eed at least 3/);
  });

  it('a shares-only vault has no password path', async () => {
    const { file } = await createVault(content, { shares: { n: 3, k: 2 } });
    expect(vaultCapabilities(file)).toEqual({ password: false, shares: { n: 3, k: 2 } });
    await expect(openWithPassword(file, 'anything')).rejects.toThrow(/not protected by a password/);
  });
});

describe('vault — both paths', () => {
  it('opens the same content via password OR shares', async () => {
    const { file, shares } = await createVault(content, { password: 'pw', shares: { n: 4, k: 2 } });
    const viaPw = await openWithPassword(file, 'pw');
    const viaShares = await openWithShares(file, [shares[0], shares[2]]);
    expect(viaPw).toEqual(viaShares);
    expect(viaPw.message).toBe(content.message);
    expect(vaultCapabilities(file)).toEqual({ password: true, shares: { n: 4, k: 2 } });
  });
});

describe('vault — validation & shares encoding', () => {
  it('requires at least one recovery path', async () => {
    await expect(createVault(content, {})).rejects.toThrow(/at least one way to unlock/);
  });

  it('rejects nonsensical share params', async () => {
    await expect(createVault(content, { shares: { n: 2, k: 1 } })).rejects.toThrow(/threshold of at least 2/);
    await expect(createVault(content, { shares: { n: 2, k: 3 } })).rejects.toThrow(/at least the threshold/);
  });

  it('share strings round-trip and detect tampering', () => {
    const raw = new Uint8Array([3, 10, 20, 30, 40]);
    const s = encodeShare(raw);
    expect([...decodeShare(s)]).toEqual([...raw]);
    // Corrupt a character in the payload → checksum should fail.
    const broken = s.slice(0, -6) + (s[s.length - 6] === 'A' ? 'B' : 'A') + s.slice(-5);
    expect(() => decodeShare(broken)).toThrow();
    expect(() => decodeShare('hello')).toThrow(/does not look like a family share/);
  });

  it('parseVault rejects foreign/corrupt files', () => {
    expect(() => parseVault('{"not":"ours"}')).toThrow(/not a GoodWebTools legacy vault/);
    expect(() => parseVault('not json')).toThrow(/not a valid/);
  });

  it('the vault file never contains the shares', async () => {
    const { file, shares } = await createVault(content, { shares: { n: 3, k: 2 } });
    for (const s of shares) expect(file).not.toContain(s.split('.').slice(-2)[0]);
  });
});
