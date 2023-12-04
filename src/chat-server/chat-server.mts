import type { ChannelId, ChannelName, ServerErrorCommand, ToServerCommand, User } from '../protocol/proto.mjs';
import type { IWebSocket, IWebSocketServer } from '../protocol/ws-interface.mjs';
import type { IncomingMessage } from 'node:http';
import type { RawData } from 'ws';
import { onClientCreateChannel, onClientJoinChannel, onClientLeaveChannel } from './channel-handler.mjs';
import { DatabaseCleanUp } from './database-maintenance/database-cleanup.mjs';
import { onClientLogin, onClientSignUp } from './authentication-handler.mjs';
import { updateNickname, updateUserDatabase } from './user-handler.mjs';
import { messageHistory, onClientMessage } from './message-handler.mjs';
import { toServerCommandSchema } from '../protocol/proto.zod.mjs';
import { onOutgoingEncodedFile } from './file-sharing-handler.mjs';
import { onLookupRequest } from './lookup-handler.mjs';
import schedule from 'node-schedule';
import Debug from 'debug';

const debug = Debug('chatter:chat-server');
const database_cleaner = new DatabaseCleanUp();
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

/**
 * You have the option to run the server in debug mode, relevant and irrelevant (useful for debugging problems) information
 * will be displayed in the terminal when using this mode.
 * On our personal (raspberry) server the server runs in normal mode, with no debug statements.
 */
export class ChatServer {
  ended: Promise<void>;
  server: IWebSocketServer;
  channels = new Map<ChannelId, ChannelName>();
  loggedInClients = new Map<IWebSocket, User>();

  constructor(server: IWebSocketServer) {
    // Initiate fields of IWebSocketServer and event listeners.
    this.server = server;
    this.server.on('error', (error: Error) => this.onServerError(error));
    this.ended = new Promise<void>((resolve, _reject) => {
      this.server.on('close', () => resolve());
    });
    this.server.on('connection', (ws: IWebSocket, request: IncomingMessage | string | undefined) =>
      this.onConnection(ws, request),
    );
    this.server.on('close', () => {
      handleAsync(async () => {
        await this.onServerClose();
      }).catch(console.error);
    });

    // Initiate interval on which to ping connected IWebSocket, to check if they have timed-out.
    // Additionally updates last_seem time for logged in users.
    setInterval(() => this.checkClientConnections(), 30000);

    // Initiate update database script upon startup of the server.
    handleAsync(async () => {
      try {
        await database_cleaner.handleUserStatusAndCleanup();
        debug('Update database script at startup completed successfully.');
      } catch (_error) {
        debug('Error running update database script at startup.');
      }
    }).catch(console.error);
  }

  /**
   * Install listeners when a new client connects.
   *
   * @param ws | The WebSocket of the new client.
   * @param request | First message sent by IWebSocket when making connection. Holds ip and more information.
   */
  onConnection(ws: IWebSocket, request: IncomingMessage | string | undefined): void {
    // Retrieve IP of IWebSocket and store in field.
    const ip = typeof request === 'string' ? request : request?.socket?.remoteAddress ?? '{unknown IP}';
    ws.ip = ip;
    debug(`Connection from ${ip}, current number of connected clients is ${this.server.clients.size}`);

    // Set up heartbeat for the client, checks if client has timed-out.
    ws.isAlive = true;
    ws.on('pong', () => this.onPong(ws));

    // Now install a listener for messages from this websocket:
    ws.on('message', (data: RawData, isBinary: boolean) => this.onClientRawMessage(ws, data, isBinary));
    ws.on('close', (code: number, reason: Buffer) => this.onClientClose(ws, code, reason));
  }

  /**
   * Handler for pong event on a websocket. Sets isAlive field back to true,
   * websocket has not timed-out and should be rechecked in 30 seconds.
   *
   * @param ws | IWebSocket for which a pong event has been received
   */
  onPong(ws: IWebSocket): void {
    // Need to find a unique id for a ws in this.server.clients iwebsockets
    debug(`Received pong from ${ws.ip}`);
    ws.isAlive = true;

    // Update user fields in database:
    this.runWithPermissions(ws, 'pong', async (user) => {
      await updateUserDatabase(user);
    }).catch((error) => handleUncaughtError(ws, error as string | Error));
  }

  /**
   * Message event has been received on IWebSocket. Decode message and handle it correctly in one of
   * cases mentioned below.
   *
   * @param ws | IWebSocket which has received a message
   * @param data | Information to be decoded, send with message event
   * @param _isBinary | Indicated of message has been transmitted in binary format over the TCP connection.
   */
  onClientRawMessage(ws: IWebSocket, data: RawData, _isBinary: boolean): void {
    debug('Received raw message %o from %s', data, ws.ip);

    // Decode data and handle accordingly.
    const commandResponse = toServerCommandSchema.safeParse(data);
    if (commandResponse.success) {
      const command: ToServerCommand = commandResponse.data;

      switch (command.command) {
        // Indicates all possible commands the server can handle.
        case 'nickname_change_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await updateNickname(ws, user, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'request_message_history':
          this.runWithPermissions(ws, command.command, async (user) => {
            await messageHistory(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'channel_join_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await onClientJoinChannel(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'channel_create_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await onClientCreateChannel(ws, user, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'channel_leave_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await onClientLeaveChannel(ws, user, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'send_message':
          this.runWithPermissions(ws, command.command, async (user) => {
            await onClientMessage(ws, command.data, user, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'lookup_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await onLookupRequest(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'outgoing_encoded_file':
          this.runWithPermissions(ws, command.command, async (user) => {
            await onOutgoingEncodedFile(ws, user, this.loggedInClients, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'signup_request':
          handleAsync(async () => {
            await onClientSignUp(ws, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'login_request':
          handleAsync(async () => {
            await onClientLogin(ws, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
      }
    } else {
      debug('Error in parsing data: got ZodError %s', commandResponse.error.toString());
      ws.send(
        JSON.stringify({
          command: 'server_error',
          data: {
            error_code: 1,
            errors: commandResponse.error.errors.map(({ path, message }) => ({
              path,
              message,
            })),
          },
        } as ServerErrorCommand),
      );
    }
  }

  /**
   * Checks if the user has the following permissions:
   *  - User is signed in
   * If the check passes the callback gets called with the user as parameter
   * If the check fails a PermissionDeniedError gets sent to the client
   *  - Unless it is the 'ping' or 'disconnect' command
   *
   * @param ws Websocket which sent the command
   * @param command Command key of the sent command
   * @param callback Function to run if the user has the required permissions
   */
  async runWithPermissions(ws: IWebSocket, command: string, callback: (user: User) => Promise<void>): Promise<void> {
    const user = this.loggedInClients.get(ws);
    if (user) {
      await callback(user);
    } else if (!['ping', 'disconnect', 'pong'].includes(command)) {
      ws.send(
        JSON.stringify({
          command: 'server_error',
          data: {
            error_code: 2,
            command,
          },
        } as ServerErrorCommand),
      );
      debug(`${ws.ip} tried to send a '${command}' command without the required permissions`);
    }
  }

  /**
   * Send a ping event to a IWebSocket.
   *
   * @param ws | IWebSocket receiving ping event
   */
  pingWebSocket(ws: IWebSocket): void {
    ws.ping();
  }

  /**
   * Function that is continously called in intervals of 30 seconds.
   * Checks every IWebSocket instance that is currently connected to the server for time-outs.
   *
   * If isAlive field of socket is false, terminate that IWebSocket. If isAlive field of
   * socket is true. Set this to false and ping socket. When pong is received from IWebSocket set isAlive property
   * back to true in ws.on('pong') event.
   */
  checkClientConnections(): void {
    this.server.clients.forEach((ws: IWebSocket) => {
      if (ws.isAlive === false) {
        debug(`Terminating connection with, socket timeout ${ws.ip}`);
        this.terminateWebSocket(ws);
      } else {
        debug(`Sending ping to ${ws.ip}`);
        ws.isAlive = false;
        this.pingWebSocket(ws);
      }
    });
  }

  /**
   * Function used to remove IWebSocket from server fields when a time-out is detected.
   *
   * @param ws | IWebSocket object disconnected from IWebServer
   */
  terminateWebSocket(ws: IWebSocket): void {
    // Update user fields in database:
    this.runWithPermissions(ws, 'disconnect', async (user) => {
      await updateUserDatabase(user);
      // Update fields of IWebServer
      this.loggedInClients.delete(ws);
    }).catch(console.error);
  }

  /**
   * When socket is closed set it's isAlive field to false and delete instanced from server fields.
   *
   * @param ws | IWebSocket object disconnected from IWebServer
   * @param code | Code with which socket was closed
   * @param reason | Reason for which socket was closed
   */
  onClientClose(ws: IWebSocket, code: number, reason: Buffer): void {
    debug('Client with ip %s closed connection: %d: %s', ws.ip, code, reason.toString());
    ws.isAlive = false;

    // Update user fields in database:
    this.runWithPermissions(ws, 'disconnect', async (user) => {
      await updateUserDatabase(user);
      // Update fields of IWebServer
      this.loggedInClients.delete(ws);
    }).catch(console.error);
  }

  /**
   * Handler for event listener of IWebSocketServer on event 'error'.
   * Displays error in debug window.
   *
   * @param error | Error IWebSocketServer encountered
   */
  onServerError(error: Error) {
    debug('WebSocketServer error: %o', error);
  }

  /**
   * Handler for event listener of IWebSocketServer on event 'close'
   */
  async onServerClose() {
    await flushPromises();
    debug('WebSocketServer closed, promises are resolved. Server and database persistency is ensured.');
  }

  /**
   * Script that runs once IWebServer has been initialized.
   * Effects an update/cleanup of database and sends mail to users pending removal due to inactivity.
   * Planned to be run daily at 2:30AM.
   */
  job = schedule.scheduleJob('30 2 * * *', async () => {
    try {
      // Run update script defined by database.
      await database_cleaner.handleUserStatusAndCleanup();
      debug('Update database script scheduled at 2:30AM, completed successfully.');
    } catch (_error) {
      debug('Error running update database script, scheduled at 2:30AM.');
    }
  });
}

/**
 * To comply with eslint rules and not void await statements this implementation was required.
 * It awaits cases from "onClientRawMessage" without making the function async. This blocked handling
 * multiple incoming messages after each other.
 *
 * @param handler | Async operation to await
 */
export async function handleAsync(handler: () => Promise<void>): Promise<void> {
  await handler();
}

/**
 * TODO DOCU @JONAS
 *
 * @param ws
 * @param error
 */
function handleUncaughtError(ws: IWebSocket, error: string | Error) {
  debug('Uncaught error %s', error.toString());
  ws.send(
    JSON.stringify({
      command: 'server_error',
      data: {
        error_code: 0,
        message: error.toString(),
      },
    } as ServerErrorCommand),
  );
}
