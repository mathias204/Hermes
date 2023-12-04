import { ChatServer, handleAsync } from './chat-server.mjs';
import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import Debug from 'debug';

const debug = Debug('chatter:chat-server-script');

const httpsServer = debug.enabled
  ? createServer({
      cert: readFileSync('./src/certificates/server-localhost/server.crt'),
      key: readFileSync('./src/certificates/server-localhost/server.key'),
      ca: readFileSync('./src/certificates/certificate-authority/rootCA.crt'),
    })
  : createServer({
      cert: readFileSync('./src/certificates/server-raspberry/server.crt'),
      key: readFileSync('./src/certificates/server-raspberry/server.key'),
      ca: readFileSync('./src/certificates/certificate-authority/rootCA.crt'),
    });

const wssServer = new WebSocketServer({ noServer: true });
const chatServer = new ChatServer(wssServer);

// Attach the WebSocket server to the HTTPS server
httpsServer.on('upgrade', (request, socket, head) => {
  wssServer.handleUpgrade(request, socket, head, (ws) => {
    wssServer.emit('connection', ws, request);
  });
});

// Start listening on a specific port (e.g., 8000)
const PORT = 8000;
httpsServer.listen(PORT, () => {
  debug('Started chat server: current clients: %d', chatServer.server.clients.size);
});

// Handler for SIGINT/SIGTERM/... handles persistent shutdown for server.
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown.');
  handleShutdown();
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown.');
  handleShutdown();
});

process.on('SIGHUP', () => {
  console.log('Received SIGHUP. Graceful shutdown.');
  handleShutdown();
});

process.on('SIGBREAK', () => {
  console.log('Received SIGBREAK. Graceful shutdown.');
  handleShutdown();
});

function handleShutdown() {
  handleAsync(async () => {
    await chatServer.onServerClose().catch(console.error);
    process.exit(0);
  }).catch(console.error);
}
