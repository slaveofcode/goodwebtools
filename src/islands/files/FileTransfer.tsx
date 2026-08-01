import { useEffect, useRef, useState } from 'react';
import { Send, Download, ShieldCheck } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import { useFileTransfer, type TransferMode } from '@/hooks/useFileTransfer';
import { makeRoomId, roomLink, roomIdFromHash } from '@/tools/webrtc/signal.lib';
import { formatBytes } from '@/tools/webrtc/file-transfer.lib';

export default function FileTransfer() {
  const t = useFileTransfer();
  const [acked, setAcked] = useState(false);
  const [mode, setMode] = useState<TransferMode>('send');
  const [roomId, setRoomId] = useState('');
  const [link, setLink] = useState('');
  const sentName = useRef('');

  // Decide role from the URL hash: a room id in the hash means we're receiving.
  useEffect(() => {
    const fromHash = roomIdFromHash(window.location.hash);
    if (fromHash) {
      setMode('receive');
      setRoomId(fromHash);
    } else {
      const id = makeRoomId();
      setMode('send');
      setRoomId(id);
      setLink(roomLink(window.location.origin, id));
    }
  }, []);

  const start = () => {
    setAcked(true);
    t.connect(mode, roomId);
  };

  const onDrop = (files: File[]) => {
    const f = files[0];
    if (f) { sentName.current = f.name; t.sendFile(f); }
  };

  const downloadReceived = () => {
    if (t.receivedBlob && t.incoming) downloadService.download(t.receivedBlob, t.incoming.name);
  };

  // --- Ack gate: nothing connects until the user agrees. ---
  if (!acked) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 border-2 border-border p-4">
          <p className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="h-5 w-5" /> Before you connect
          </p>
          <p className="text-sm text-muted-foreground">
            To introduce your two devices, GoodWebTools uses a small <strong>signaling server</strong> to
            exchange connection details (about 2&nbsp;KB). Your files transfer <strong>directly,
            peer-to-peer</strong>, and never pass through our server. Connections are best-effort and may
            fail on very restrictive networks (no relay server is used).
          </p>
          <Button onClick={start}>Continue</Button>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    connecting: 'Connecting…',
    waiting: 'Waiting for the other device to join…',
    connected: mode === 'send' ? 'Connected — choose a file to send.' : 'Connected — waiting for a file…',
    transferring: 'Transferring…',
    done: mode === 'send' ? 'Sent!' : 'Received!',
  };

  return (
    <div className="space-y-4">
      {/* Sender: shareable link */}
      {mode === 'send' && (t.status === 'connecting' || t.status === 'waiting') && (
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Share this link with the other device</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all border-2 border-border bg-muted px-3 py-2 text-sm">{link}</code>
            <CopyButton value={link} label="Copy link" />
          </div>
        </div>
      )}

      {t.status !== 'error' && statusLabel[t.status] && (
        <p className="text-sm text-muted-foreground">{statusLabel[t.status]}</p>
      )}
      {t.error && <Alert variant="error">{t.error}</Alert>}

      {/* Sender: file picker once connected */}
      {mode === 'send' && (t.status === 'connected' || t.status === 'done') && (
        <Dropzone onDrop={onDrop} multiple={false}>
          <div className="space-y-1">
            <p className="flex items-center justify-center gap-2 text-lg font-bold">
              <Send className="h-5 w-5" /> Drop a file to send
            </p>
            <p className="text-sm text-muted-foreground">or click to browse · sent directly to the other device</p>
          </div>
        </Dropzone>
      )}

      {/* Transfer progress */}
      {(t.status === 'transferring' || (t.status === 'done' && mode === 'send')) && (
        <ProgressBar percent={t.progress} label={mode === 'send' ? `Sending ${sentName.current}` : 'Transferring'} />
      )}

      {/* Receiver: incoming file + download */}
      {mode === 'receive' && t.incoming && (
        <div className="space-y-2 border-2 border-border p-3">
          <p className="text-sm font-bold">{t.incoming.name} · {formatBytes(t.incoming.size)}</p>
          {t.status === 'transferring' && <ProgressBar percent={t.progress} label="Receiving" />}
          {t.status === 'done' && t.receivedBlob && (
            <Button onClick={downloadReceived}>
              <Download className="h-4 w-4" /> Download file
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
