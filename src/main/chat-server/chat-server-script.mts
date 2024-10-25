import { ChatServer, handleAsync } from './chat-server.mjs';
import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import Debug from 'debug';

const debug = Debug('chatter:chat-server-script');

const isLocalExecution = process.argv.includes('--local');
const isCloudExecution = process.argv.includes('--cloud');
const isPiExecution = process.argv.includes('--pi');

let certPath: string;
let keyPath: string;

if (isLocalExecution) {
  certPath = './src/main/certificates/server-localhost/server.crt';
  keyPath = './src/main/certificates/server-localhost/server.key';
} else if (isCloudExecution) {
  certPath = './src/main/certificates/server-cloud/server.crt';
  keyPath = './src/main/certificates/server-cloud/server.key';
} else if (isPiExecution) {
  certPath = './src/main/certificates/server-raspberry/server.crt';
  keyPath = './src/main/certificates/server-raspberry/server.key';
} else {
  // Handle the case where no execution type is specified
  throw new Error('Please specify the execution type: --local, --cloud, or --pi');
}

const httpsServer = createServer({
  cert: readFileSync(certPath),
  key: readFileSync(keyPath),
  ca: readFileSync('./src/main/certificates/certificate-authority/rootCA.crt'),
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
