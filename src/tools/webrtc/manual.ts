import { DEFAULT_ICE_SERVERS } from './ice.lib';
import { encodeSdp, decodeSdp } from './manual-sdp.lib';

/**
 * Serverless WebRTC connection: the two peers copy-paste an offer code and an
 * answer code to each other through any channel (chat, email). No signaling
 * server is involved. ICE is gathered fully before producing each code
 * ("non-trickle") so all candidates travel inside the code.
 */

export interface ManualOptions {
  initiator: boolean;
  iceServers?: RTCIceServer[];
  onState?: (state: RTCPeerConnectionState) => void;
  onChannel?: (channel: RTCDataChannel) => void;
}

export interface ManualConnection {
  pc: RTCPeerConnection;
  /** Sender: produce the offer code to share. */
  createOfferCode(): Promise<string>;
  /** Receiver: accept the sender's offer code, return the answer code to share back. */
  acceptOfferReturnAnswer(offerCode: string): Promise<string>;
  /** Sender: accept the receiver's answer code to complete the connection. */
  acceptAnswer(answerCode: string): Promise<void>;
  close(): void;
}

/** Resolve once ICE gathering completes (or after a timeout, to avoid stalling). */
function gatherComplete(pc: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => { if (pc.iceGatheringState === 'complete') finish(); };
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(finish, timeoutMs);
  });
}

export function createManualConnection(opts: ManualOptions): ManualConnection {
  const pc = new RTCPeerConnection({ iceServers: opts.iceServers ?? DEFAULT_ICE_SERVERS });
  pc.onconnectionstatechange = () => opts.onState?.(pc.connectionState);

  if (opts.initiator) {
    const channel = pc.createDataChannel('data', { ordered: true });
    opts.onChannel?.(channel);
  } else {
    pc.ondatachannel = e => opts.onChannel?.(e.channel);
  }

  return {
    pc,
    async createOfferCode() {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await gatherComplete(pc);
      return encodeSdp(pc.localDescription!);
    },
    async acceptOfferReturnAnswer(offerCode: string) {
      const offer = decodeSdp(offerCode);
      if (!offer || offer.type !== 'offer') throw new Error('That doesn’t look like a valid offer code.');
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await gatherComplete(pc);
      return encodeSdp(pc.localDescription!);
    },
    async acceptAnswer(answerCode: string) {
      const answer = decodeSdp(answerCode);
      if (!answer || answer.type !== 'answer') throw new Error('That doesn’t look like a valid answer code.');
      await pc.setRemoteDescription(answer);
    },
    close() {
      try { pc.close(); } catch { /* ignore */ }
    },
  };
}
