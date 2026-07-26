import { useEffect, useCallback } from 'react';
import { persistenceService } from '@/services/persistence.service';

export function usePersistence(toolId: string) {
  useEffect(() => {
    persistenceService.enableNavigationGuard(toolId);

    return () => {
      persistenceService.disableNavigationGuard(toolId);
    };
  }, [toolId]);

  const autoSave = useCallback(
    (data: any) => persistenceService.autoSave(toolId, data),
    [toolId]
  );

  const loadAutoSave = useCallback(
    () => persistenceService.loadAutoSave(toolId),
    [toolId]
  );

  const clearAutoSave = useCallback(
    () => persistenceService.clearAutoSave(toolId),
    [toolId]
  );

  const markDirty = useCallback(
    () => persistenceService.markDirty(toolId),
    [toolId]
  );

  const markClean = useCallback(
    () => persistenceService.markClean(toolId),
    [toolId]
  );

  const isDirty = useCallback(
    () => persistenceService.isDirty(toolId),
    [toolId]
  );

  const saveToFile = useCallback(
    (data: Blob, suggestedName: string, fileHandle?: FileSystemFileHandle) =>
      persistenceService.saveToFile(data, suggestedName, fileHandle),
    []
  );

  const loadFromFile = useCallback(
    (accept?: string[]) => persistenceService.loadFromFile(accept),
    []
  );

  return {
    autoSave,
    loadAutoSave,
    clearAutoSave,
    markDirty,
    markClean,
    isDirty,
    saveToFile,
    loadFromFile,
  };
}
