export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type KV = { key: string; value: string; enabled: boolean };

export type AuthDef =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'api-key'; header: string; value: string };

export type BodyDef =
  | { mode: 'none' }
  | { mode: 'json'; content: string }
  | { mode: 'form'; fields: KV[] }
  | { mode: 'raw'; content: string; contentType: string };

export type CaptureRule = { jsonPath: string; intoVar: string };

export type VarSource =
  | { type: 'env'; varName: string }
  | { type: 'response'; requestId: string; jsonPath: string };

export type VarBinding = { name: string; source: VarSource };

export type SentRequestSummary = {
  method: string;
  /** Final URL with query params appended. */
  url: string;
  /** All outgoing headers, including auth and content-type. */
  headers: [string, string][];
  /** The request body as sent, or null if none. */
  body: string | null;
};

export type ResponseSnapshot = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  /** The exact request that produced this response (variables resolved). */
  sentRequest?: SentRequestSummary;
};

export const MAX_REQUEST_RESPONSES = 5;
export const MAX_HISTORY = 50;
export const SAVE_INTERVAL = 30;

export type RequestDef = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KV[];
  headers: KV[];
  body: BodyDef;
  auth: AuthDef;
  capture: CaptureRule | null;
  bindings: VarBinding[];
  responseHistory: ResponseSnapshot[];
};

export type Folder = {
  id: string;
  name: string;
  folders: Folder[];
  requests: RequestDef[];
};

export type Collection = {
  id: string;
  name: string;
  folders: Folder[];
  requests: RequestDef[];
};

export type Environment = {
  id: string;
  name: string;
  vars: Record<string, string>;
};

export type HistoryEntry = {
  id: string;
  ts: number;
  req: RequestDef;
  res: ResponseSnapshot;
};

export type Workspace = {
  collections: Collection[];
  envs: Environment[];
  activeEnvId: string | null;
  activeCollectionId: string | null;
  activeRequestId: string | null;
  lastResponse: ResponseSnapshot | null;
  history: HistoryEntry[];
};
