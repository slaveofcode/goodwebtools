export interface Breadcrumb {
  t: number;
  kind: 'action' | 'console' | 'error';
  action: string;
  data?: Record<string, unknown>;
}

export interface FileMeta {
  claimedType: string;
  actualFormat: string;
  size: number;
  lastModified: number;
  decodeOk?: boolean;
  width?: number;
  height?: number;
}

export interface Diagnostics {
  app: { reportId: string; timestamp: string; build: string; toolId: string; route: string; locale: string };
  browser: Record<string, unknown>;
  display: Record<string, unknown>;
  capabilities: Record<string, boolean | string | number>;
  error?: { name: string; message: string; stack?: string; causeChain?: string[] };
  file?: FileMeta;
  logs: { breadcrumbs: Breadcrumb[] };
  user?: { message?: string };
}

export interface ReportContext {
  toolId: string;
  getFile?: () => File | null;
  extra?: Record<string, unknown>;
}

export interface ReportPrefill { error?: Error | null }
