/**
 * ICE (STUN/TURN) server configuration. Users can bring their own servers so they
 * don't rely on the public defaults — a custom TURN server also fixes connections
 * behind strict/symmetric NAT.
 *
 * Input format (one server per line; blank lines and `#` comments ignored):
 *   stun:stun.example.com:3478
 *   turn:turn.example.com:3478 <username> <credential>
 *   stun:a.com:3478,stun:b.com:3478        (comma-separated urls share one entry)
 */

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

const SCHEME_RE = /^(stun|stuns|turn|turns):/i;

export interface IceParseResult {
  servers: RTCIceServer[];
  invalid: string[];
}

/** Parse user ICE-server input into RTCIceServer entries, collecting invalid lines. */
export function parseIceConfig(text: string): IceParseResult {
  const servers: RTCIceServer[] = [];
  const invalid: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const tokens = line.split(/\s+/);
    const urls = tokens[0].split(',').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0 || !urls.every(u => SCHEME_RE.test(u))) {
      invalid.push(line);
      continue;
    }

    const entry: RTCIceServer = { urls };
    const isTurn = urls.some(u => /^turns?:/i.test(u));
    if (isTurn && tokens[1]) {
      entry.username = tokens[1];
      if (tokens[2]) entry.credential = tokens[2];
    }
    servers.push(entry);
  }

  return { servers, invalid };
}

/** The ICE servers to actually use: parsed custom servers, or the public default. */
export function effectiveIceServers(text: string): RTCIceServer[] {
  const { servers } = parseIceConfig(text);
  return servers.length > 0 ? servers : DEFAULT_ICE_SERVERS;
}
