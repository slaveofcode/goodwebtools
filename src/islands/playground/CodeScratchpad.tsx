import { useState } from 'react';
import MonacoEditor from './MonacoEditor';

export default function CodeScratchpad() {
  const [code, setCode] = useState('// Scratchpad\nconst hello = "world";\n');
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A VS Code-grade editor, fully on-device. Multi-cursor, move/copy line, column select — all native.
      </p>
      <MonacoEditor value={code} language="typescript" onChange={setCode} />
    </div>
  );
}
