import Debug from 'debug';
import WebSocket from 'ws';
import { AuthenticationHandler } from './authentication-handler.mjs';
import { readFileSync } from 'fs';
import { ChatClient } from './chat-client.mjs';

const debug = Debug('chatter:websocket-client');

const isLocalExecution = process.argv.includes('--local');
const ws =
  debug.enabled || isLocalExecution
    ? new WebSocket('wss://127.0.0.1:8000/', {
        ca: readFileSync('./src/certificates/certificate-authority/rootCA.crt'), // root certificate
      })
    : new WebSocket('hidden', {
        ca: readFileSync('./src/certificates/certificate-authority/rootCA.crt'),
      });

ws.on('open', () => {
  debug('WebSocket connection opened successfully.');
  ChatClient.heartbeat(ws);
  console.clear();
  AuthenticationHandler.authenticateUser(ws).catch((error) => {
    console.error(error);
  });
});

ws.on('error', (error) => {
  throw error;
});

ws.on('close', (code, reason) => {
  debug('WebSocket connection closed: %d, %s', code, reason);
  console.log('Connection to server is lost: %d, %s', code, reason);
  process.exit(0);
});
ws.on('message', (data) => ChatClient.onServerRawMessage(ws, data));
ws.on('ping', () => ChatClient.heartbeat(ws));
