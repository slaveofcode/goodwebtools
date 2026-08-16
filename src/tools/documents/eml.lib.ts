/**
 * Pure formatting helpers for the EML viewer. The MIME parsing itself is done by
 * postal-mime in the island; these turn its parsed address objects into readable
 * strings. No I/O.
 */

export interface EmailAddress {
  name?: string;
  address?: string;
}

export function formatAddress(addr: EmailAddress | null | undefined): string {
  if (!addr) return '';
  const name = (addr.name ?? '').trim();
  const address = (addr.address ?? '').trim();
  if (name && address) return `${name} <${address}>`;
  return address || name;
}

export function formatAddressList(list: EmailAddress[] | null | undefined): string {
  if (!list || list.length === 0) return '';
  return list.map(formatAddress).filter(Boolean).join(', ');
}
