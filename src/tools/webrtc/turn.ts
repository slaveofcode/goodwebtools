/**
 * Fetch short-lived TURN credentials from our `/api/turn` Worker route (backed by
 * Cloudflare Realtime TURN) so the P2P tools can traverse strict NATs — e.g. a
 * phone on mobile data connecting to a laptop on Wi-Fi.
 *
 * Returns the TURN server entries only (callers merge them with their own
 * STUN/default and any user-supplied servers). Returns an empty array when TURN
 * isn't configured or on any error, so callers degrade to STUN-only cleanly.
 *
 * TURN is a fallback: ICE always prefers a direct host/reflexive path, so pairing
 * stays device-to-device on the same network and only relays when it must.
 */
export async function fetchTurnServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/turn', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
    const t = data.iceServers;
    return Array.isArray(t) ? t : t ? [t] : [];
  } catch {
    return [];
  }
}
