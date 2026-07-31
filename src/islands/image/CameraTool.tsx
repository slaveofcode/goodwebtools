import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ImageResult } from '@/components/ui/ImageResult';
import CameraCapture from './CameraCapture';

export default function CameraTool() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [capturing, setCapturing] = useState(true);

  const retake = () => { setPhoto(null); setCapturing(true); };

  return (
    <div className="space-y-4">
      {capturing && (
        <CameraCapture
          onCapture={(file) => { setPhoto(file); setCapturing(false); }}
          onCancel={() => setCapturing(false)}
        />
      )}

      {!capturing && !photo && (
        <Button onClick={() => setCapturing(true)}>Open camera</Button>
      )}

      {photo && (
        <div className="space-y-2">
          {/* ImageResult already renders Download / Copy image / Edit in Annotator. */}
          <ImageResult blob={photo} filename={photo.name} />
          <Button variant="secondary" onClick={retake}>Retake</Button>
        </div>
      )}
    </div>
  );
}
