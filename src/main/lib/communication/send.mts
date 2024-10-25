import type { RawData } from 'ws';
import type { RawToServerCommand, ToClientCommand, ToServerCommand } from '../../protocol/proto.mjs';
import type { IWebSocket } from '../../protocol/ws-interface.mjs';
import Debug from 'debug';

const debug = Debug('chatter:ws-send:');

export function sendToClient(ws: IWebSocket, command: ToClientCommand): void {
  ws.send(JSON.stringify(command));
}

export function sendToServer(ws: IWebSocket, command: ToServerCommand): void {
  ws.send(JSON.stringify(command));
}

export function sendRawToClient(ws: IWebSocket, command: RawData): void {
  if (Buffer.isBuffer(command)) {
    ws.send(command);
  } else {
    debug('Raw data should always be send as a buffer');
  }
}

export function sendRawToServer(ws: IWebSocket, command: RawToServerCommand): void {
  const dataToSend = Buffer.from(command);
  ws.send(dataToSend);
}
