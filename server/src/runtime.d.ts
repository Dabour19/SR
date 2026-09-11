/**
 * Minimal ambient types for the Workers runtime (so the server typechecks
 * without installing @cloudflare/workers-types). If you install the official
 * package, delete this file and the "types" entry in tsconfig.json.
 */
declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };

declare interface WebSocket {
  serializeAttachment(value?: unknown): unknown;
}

declare interface ResponseInit {
  webSocket?: WebSocket;
}

declare interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

declare interface DurableObjectState {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  serializeAttachment(value: unknown): void;
  storage: {
    put(key: string, value: unknown): Promise<void>;
    get<T>(key: string): Promise<T | undefined>;
  };
}

declare interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): Fetcher;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
