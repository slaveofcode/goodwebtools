import { useState, useEffect } from 'react';
import { hotkeyService } from '@/services/hotkey';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface RegisteredHotkey {
  id: string;
  keys: string;
  description?: string;
}

export default function HotkeyTest() {
  const [hotkeys, setHotkeys] = useState<RegisteredHotkey[]>([]);
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<{ globalHotkeys: boolean; modifierKeys: string[] } | null>(null);

  useEffect(() => {
    // Get capabilities on mount
    const caps = hotkeyService.getCapabilities();
    setCapabilities(caps);

    // Cleanup: unregister all on unmount
    return () => {
      hotkeyService.unregisterAll().catch(console.error);
    };
  }, []);

  const registerTestHotkey = async (keys: string, description: string) => {
    setError(null);
    try {
      await hotkeyService.register(
        keys,
        () => {
          setLastTriggered(`${description} (${keys})`);
          console.log(`Hotkey triggered: ${keys}`);
        },
        description
      );

      const registered = hotkeyService.getRegistered();
      setHotkeys(registered.map(hk => ({ id: hk.id, keys: hk.keys, description: hk.description })));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const unregisterHotkey = async (id: string) => {
    try {
      await hotkeyService.unregister(id);
      const registered = hotkeyService.getRegistered();
      setHotkeys(registered.map(hk => ({ id: hk.id, keys: hk.keys, description: hk.description })));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const unregisterAll = async () => {
    try {
      await hotkeyService.unregisterAll();
      setHotkeys([]);
      setLastTriggered(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground mb-2">
          Test global hotkey registration. Registered hotkeys will work even when this app is not focused.
        </p>
        {capabilities && (
          <div className="text-xs text-muted-foreground">
            <div>Global Hotkeys: {capabilities.globalHotkeys ? '✓ Supported' : '✗ Not Supported'}</div>
            <div>Supported Modifiers: {capabilities.modifierKeys.join(', ')}</div>
          </div>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {lastTriggered && (
        <Alert variant="success">
          Last Triggered: <strong>{lastTriggered}</strong>
        </Alert>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-bold">Quick Test Hotkeys</h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => registerTestHotkey('CommandOrControl+Shift+T', 'Test Hotkey 1')}>
            Register Cmd+Shift+T
          </Button>
          <Button onClick={() => registerTestHotkey('CommandOrControl+Shift+Y', 'Test Hotkey 2')}>
            Register Cmd+Shift+Y
          </Button>
          <Button onClick={() => registerTestHotkey('CommandOrControl+Shift+U', 'Test Hotkey 3')}>
            Register Cmd+Shift+U
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Registered Hotkeys ({hotkeys.length})</h3>
          {hotkeys.length > 0 && (
            <Button variant="ghost" size="sm" onClick={unregisterAll}>
              Unregister All
            </Button>
          )}
        </div>
        {hotkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hotkeys registered</p>
        ) : (
          <div className="space-y-2">
            {hotkeys.map(hk => (
              <div
                key={hk.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
              >
                <div>
                  <div className="font-mono text-sm font-bold">{hk.keys}</div>
                  {hk.description && <div className="text-xs text-muted-foreground">{hk.description}</div>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => unregisterHotkey(hk.id)}>
                  Unregister
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <h4 className="mb-2 text-sm font-bold">Usage Instructions</h4>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Click a button above to register a hotkey</li>
          <li>Minimize or blur this app window</li>
          <li>Press the registered hotkey combination</li>
          <li>Return to this window to see the "Last Triggered" alert</li>
        </ol>
      </div>
    </div>
  );
}
