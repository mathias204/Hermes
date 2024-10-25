import WebSocket from 'ws';
import Debug from 'debug';
import { readFileSync } from 'node:fs';
import { ChatClient } from './chat-client.mjs';
import { AuthenticationHandler } from './authentication-handler.mjs';

const debug = Debug('chatter:websocket-client');

const isLocalExecution = process.argv.includes('--local');
const isCloudExecution = process.argv.includes('--cloud');
const isPiExecution = process.argv.includes('--pi');
/**
 * Use these extra arguments to define where client should connect to.
 * Options are localhost, pi server or cloud server. Each of these can be run in debug mode.
 */
let ip: string;
if (isLocalExecution) {
  ip = 'wss://127.0.0.1:8000/';
} else if (isCloudExecution) {
  ip = 'wss://164.90.204.77:8000/';
} else if (isPiExecution) {
  ip = 'wss://81.164.184.73:8000/';
} else {
  // Handle the case where no execution type is specified
  throw new Error('Please specify the execution type: --local, --cloud, or --pi');
}
const ws = new WebSocket(`${ip}`, {
  ca: readFileSync('./src/main/certificates/certificate-authority/rootCA.crt'),
});

ws.on('open', () => {
  debug('WebSocket connection opened successfully.');
  ChatClient.heartbeat(ws);
  console.clear();
  AuthenticationHandler.authenticateUser(ws);
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
