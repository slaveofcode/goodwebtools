export function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
  const binary = atob(base64 + padding);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function prettyJson(raw: string): string {
  return JSON.stringify(JSON.parse(raw), null, 2);
}

export function decodeJwt(token: string): { header: string; payload: string } {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Not a valid JWT — expected at least two dot-separated segments.');
  }
  return {
    header: prettyJson(base64UrlDecode(parts[0])),
    payload: prettyJson(base64UrlDecode(parts[1])),
  };
}
