import type { WebSocket, RawData } from 'ws';
import type { IncomingMessage } from 'node:http';

export interface IWebSocketEvents {
  message: (data: RawData, isBinary: boolean) => void;
  open: () => void;
  close: (code: number, reason: Buffer) => void;
  ping: () => void; // Add ping event
  pong: () => void; // Add pong event
}

export interface IWebSocket {
  isAlive?: boolean;
  pingTimeout?: NodeJS.Timeout | null;
  ip?: string;
  readonly readyState:
    | typeof WebSocket.CONNECTING
    | typeof WebSocket.OPEN
    | typeof WebSocket.CLOSING
    | typeof WebSocket.CLOSED;
  on(event: 'message', cb: IWebSocketEvents['message']): this;
  on(event: 'open', cb: IWebSocketEvents['open']): this;
  on(event: 'close', cb: IWebSocketEvents['close']): this;
  on(event: 'ping', cb: () => void): this; // Add ping event
  on(event: 'pong', cb: () => void): this; // Add pong event
  send(data: string | Buffer): void;
  ping(): void; // Add ping method
  pong(): void; // Add pong method
}

export interface IWebSocketServerEvents {
  // Note: We added the `| string | undefined` for our mock convenience...
  connection: (socket: IWebSocket, request: IncomingMessage | string | undefined) => void;
  error: (error: Error) => void;
  close: () => void;
}

export interface IWebSocketServer {
  readonly clients: Set<IWebSocket>;
  on(event: 'connection', cb: IWebSocketServerEvents['connection']): this;
  on(event: 'error', cb: IWebSocketServerEvents['error']): this;
  on(event: 'close' | 'listening', cb: IWebSocketServerEvents['close']): this;
}
