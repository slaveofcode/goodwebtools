// Web Worker host for the on-device model (WebLLM/MLC). Running inference off the
// main thread keeps the chat UI responsive during load and generation.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
