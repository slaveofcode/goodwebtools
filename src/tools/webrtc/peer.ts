import type { SignalMessage } from './signal.lib';

/** Public STUN only (no TURN). Connections may fail behind strict/symmetric NAT. */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

export interface CreatePeerOptions {
  initiator: boolean;
  sendSignal: (msg: SignalMessage) => void;
  onState?: (state: RTCPeerConnectionState) => void;
  onChannel?: (channel: RTCDataChannel) => void;
}

export interface PeerHandles {
  pc: RTCPeerConnection;
  applySignal(msg: SignalMessage): Promise<void>;
  close(): void;
}

/**
 * Wrap an RTCPeerConnection with the offer/answer/ICE plumbing routed through the
 * signaling channel. The initiator creates the data channel and offer; the other
 * side answers. ICE candidates that arrive before the remote description are queued.
 */
export function createPeer(opts: CreatePeerOptions): PeerHandles {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const pendingIce: RTCIceCandidateInit[] = [];

  pc.onicecandidate = e => {
    if (e.candidate) opts.sendSignal({ type: 'ice', candidate: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => opts.onState?.(pc.connectionState);

  if (opts.initiator) {
    const channel = pc.createDataChannel('data', { ordered: true });
    opts.onChannel?.(channel);
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        opts.sendSignal({ type: 'offer', sdp: pc.localDescription });
      } catch { /* surfaced via connection state */ }
    };
  } else {
    pc.ondatachannel = e => opts.onChannel?.(e.channel);
  }

  async function flushIce() {
    while (pendingIce.length) {
      const c = pendingIce.shift()!;
      try { await pc.addIceCandidate(c); } catch { /* ignore */ }
    }
  }

  async function applySignal(msg: SignalMessage): Promise<void> {
    if (msg.type === 'offer') {
      await pc.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      opts.sendSignal({ type: 'answer', sdp: pc.localDescription });
    } else if (msg.type === 'answer') {
      await pc.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit);
      await flushIce();
    } else if (msg.type === 'ice') {
      const candidate = msg.candidate as RTCIceCandidateInit;
      if (pc.remoteDescription) {
        try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
      } else {
        pendingIce.push(candidate);
      }
    }
  }

  return {
    pc,
    applySignal,
    close() { try { pc.close(); } catch { /* ignore */ } },
  };
}
