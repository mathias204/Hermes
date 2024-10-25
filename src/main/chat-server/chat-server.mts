import type { Channel, ChannelId, ChannelName, ToServerCommand, User } from '../protocol/proto.mjs';
import type { IWebSocket, IWebSocketServer } from '../protocol/ws-interface.mjs';
import type { IncomingMessage } from 'node:http';
import type { RawData } from 'ws';
import { AuthenticationHandler } from './authentication-handler.mjs';
import { ChannelHandler } from './channel-handler.mjs';
import { databaseCleanUp } from './database-maintenance/database-cleanup.mjs';
import { UserHandler } from './user-handler.mjs';
import { MessageHandler } from './message-handler.mjs';
import { toServerCommandSchema } from '../protocol/proto.zod.mjs';
import { FileSharingHandler } from './file-sharing-handler.mjs';
import { LookupHandler } from './lookup-handler.mjs';
import schedule from 'node-schedule';
import Debug from 'debug';
import { sendToClient } from '../lib/communication/send.mjs';
import { BroadcastHandler } from './broadcast-handler.mjs';
import { InvitationHandler } from './invitation-handler.mjs';
import { KeyHandler } from './key-handler.mjs';

const debug = Debug('chatter:chat-server');
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

/**
 * You have the option to run the server in debug mode, relevant and irrelevant (useful for debugging problems) information
 * will be displayed in the terminal when using this mode.
 * Or on our personal (raspberry) server the server runs in normal mode, with no debug statements.
 * Or finally on the cloud server, also runs in normal mode with nu debug statements.
 */
export class ChatServer {
  ended: Promise<void>;
  server: IWebSocketServer;
  channels = new Map<ChannelId, ChannelName>();
  loggedInClients = new Map<IWebSocket, User>();
  currentlyOpenChannels = new Map<User, Channel>();

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
        await databaseCleanUp.handleUserStatusAndCleanup();
        debug('Update database script at startup completed successfully.');
      } catch (_error) {
        debug('Error running update database script at startup.');
      }
    }).catch(console.error);
  }

  /**
   * Install listeners when a new client connects.
   *
   * @param ws - The WebSocket of the new client.
   * @param request - First message sent by IWebSocket when making connection. Holds ip and more information.
   * @returns void
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
   * @param ws - IWebSocket for which a pong event has been received
   * @returns void
   */
  onPong(ws: IWebSocket): void {
    // Need to find a unique id for a ws in this.server.clients iwebsockets
    debug(`Received pong from ${ws.ip}`);
    ws.isAlive = true;

    // Update user fields in database:
    this.runWithPermissions(ws, 'pong', async (user) => {
      await UserHandler.updateUserDatabase(user);
    }).catch((error) => handleUncaughtError(ws, error as string | Error));
  }

  /**
   * Message event has been received on IWebSocket. Decode message and handle it correctly in one of
   * cases mentioned below.
   *
   * @param ws - IWebSocket which has received a message
   * @param data - Information to be decoded, send with message event
   * @param _isBinary - Indicated of message has been transmitted in binary format over the TCP connection.
   * @returns void
   */
  onClientRawMessage(ws: IWebSocket, data: RawData, _isBinary: boolean): void {
    debug('Received raw message %o from %s', data, ws.ip);

    // Decode data and handle accordingly.
    const commandResponse = toServerCommandSchema.safeParse(data);
    if (commandResponse.success) {
      const command: ToServerCommand = commandResponse.data;
      switch (command.command) {
        // Following cases consist of channel operations.
        case 'channel_create_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await ChannelHandler.onClientCreateChannel(ws, user, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'channel_join_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await ChannelHandler.onClientJoinChannel(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'channel_leave_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await ChannelHandler.onClientLeaveChannel(ws, user, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'channel_invite_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await InvitationHandler.onClientInviteOtherClient(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'accept_channel_invite_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await InvitationHandler.onClientAcceptInvite(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'reject_channel_invite_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await InvitationHandler.onClientRejectInvite(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        // Following cases consist of broadcast operations.
        case 'channel_invite_broadcast_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await BroadcastHandler.onClientRequestsInvites(ws, user);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'new_user_joined_broadcast_trigger':
          this.runWithPermissions(ws, command.command, async (user) => {
            await BroadcastHandler.onUserOpenedChannelBroadcastTrigger(
              ws,
              user,
              this.loggedInClients,
              command.data,
              this.currentlyOpenChannels,
            );
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'request_participants':
          this.runWithPermissions(ws, command.command, async (user) => {
            await BroadcastHandler.requestParticipants(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        // Following cases consist of user operations.
        case 'nickname_change_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await UserHandler.updateNickname(ws, user, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'delete_user_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await UserHandler.deleteUser(ws, user, command.data);
            this.onClientClose(ws, 600, Buffer.from('User deleted its account', 'utf8'));
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'user_closed_update_trigger':
          this.runWithPermissions(ws, command.command, async (user) => {
            await UserHandler.closeChannelUpdate(user, command.data, this.currentlyOpenChannels);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        // Following cases consist of message operations.
        case 'request_message_history':
          this.runWithPermissions(ws, command.command, async (user) => {
            await MessageHandler.messageHistory(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'send_message':
          this.runWithPermissions(ws, command.command, async (user) => {
            await MessageHandler.onClientMessage(ws, command.data, user, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        // Following cases consist of lookup operations.
        case 'lookup_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await LookupHandler.onLookupRequest(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        // Following cases consist of file sharing operations.
        case 'outgoing_encoded_file':
          this.runWithPermissions(ws, command.command, async (user) => {
            await FileSharingHandler.onOutgoingEncodedFile(ws, user, this.loggedInClients, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'file_content':
          this.runWithPermissions(ws, command.command, async (user) => {
            await FileSharingHandler.onFileContent(ws, user, this.loggedInClients, command.data, data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
        case 'list_files_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await FileSharingHandler.onListFiles(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'file_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await FileSharingHandler.onFileRequest(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        // Following cases consist of public key operations
        case 'update_public_key':
          this.runWithPermissions(ws, command.command, async (user) => {
            await KeyHandler.onUpdatePublicKey(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'public_key_request':
          this.runWithPermissions(ws, command.command, async (user) => {
            await KeyHandler.onPublicKeyRequest(ws, user, command.data);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        // Following cases consist of authentification operations.
        case 'signup_request':
          handleAsync(async () => {
            await AuthenticationHandler.onClientSignUp(ws, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;

        case 'login_request':
          handleAsync(async () => {
            await AuthenticationHandler.onClientLogin(ws, command.data, this.loggedInClients);
          }).catch((error) => handleUncaughtError(ws, error as string | Error));
          break;
      }
    } else {
      debug('Error in parsing data: got ZodError %s', commandResponse.error.toString());
      sendToClient(ws, {
        command: 'server_error',
        data: {
          error_code: 1,
          errors: commandResponse.error.errors.map(({ path, message }) => ({
            path,
            message,
          })),
        },
      });
    }
  }

  /**
   * Checks if the user has the following permissions:
   *  - User is signed in
   * If the check passes the callback gets called with the user as parameter
   * If the check fails a PermissionDeniedError gets sent to the client
   *  - Unless it is the 'ping', 'pong' or 'disconnect' command
   *
   * @param ws - Websocket which sent the command
   * @param command - Command key of the sent command
   * @param callback - Function to run if the user has the required permissions
   * @returns Promise<void>
   */
  async runWithPermissions(ws: IWebSocket, command: string, callback: (user: User) => Promise<void>): Promise<void> {
    const user = this.loggedInClients.get(ws);
    if (user) {
      await callback(user);
    } else if (!['ping', 'disconnect', 'pong'].includes(command)) {
      sendToClient(ws, {
        command: 'server_error',
        data: {
          error_code: 2,
          command,
        },
      });
      debug(`${ws.ip} tried to send a '${command}' command without the required permissions`);
    }
  }

  /**
   * Send a ping event to a IWebSocket.
   *
   * @param ws - IWebSocket receiving ping event
   * @returns void
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
   *
   * @returns void
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
   * @param ws - IWebSocket object disconnected from IWebServer
   * @returns void
   */
  terminateWebSocket(ws: IWebSocket): void {
    // Update user fields in database:
    this.runWithPermissions(ws, 'disconnect', async (user) => {
      await UserHandler.updateUserDatabase(user);
      // Update fields of IWebServer
      const closingUser: User | undefined = this.loggedInClients.get(ws);
      if (closingUser) {
        this.currentlyOpenChannels.delete(closingUser);
      }
      this.loggedInClients.delete(ws);
    }).catch(console.error);
  }

  /**
   * When socket is closed set it's isAlive field to false and delete instanced from server fields.
   *
   * @param ws - IWebSocket object disconnected from IWebServer
   * @param code - Code with which socket was closed
   * @param reason - Reason for which socket was closed
   * @returns void
   */
  onClientClose(ws: IWebSocket, code: number, reason: Buffer): void {
    debug('Client with ip %s closed connection: %d: %s', ws.ip, code, reason.toString());
    ws.isAlive = false;
    this.terminateWebSocket(ws);
  }

  /**
   * Handler for event listener of IWebSocketServer on event 'error'.
   * Displays error in debug window.
   *
   * @param error - Error IWebSocketServer encountered
   * @returns void
   */
  onServerError(error: Error): void {
    debug('WebSocketServer error: %o', error);
  }

  /**
   * Handler for event listener of IWebSocketServer on event 'close'
   *
   * @returns Promise<void>
   */
  async onServerClose(): Promise<void> {
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
      await flushPromises(); // Flushpromises needed to ensure cleanup script does not run while database operation is happening.
      await databaseCleanUp.handleUserStatusAndCleanup();
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
 * @param handler - Async operation to await
 * @returns Promise<void>
 */
export async function handleAsync(handler: () => Promise<void>): Promise<void> {
  await handler();
}

/**
 * Sends a server_error message to the client claiming that there was an internal error during runtime,
 * with given error message. If at any point during the runtime of the server an unexpected error is thrown,
 * this method should be called to catch it.
 *
 * @param ws - IWebSocket object who's request was the cause of an internal error
 * @param error - The error thrown, or an error message.
 * @returns void
 */
export function handleUncaughtError(ws: IWebSocket, error: string | Error): void {
  debug('Uncaught error %s', error.toString());
  sendToClient(ws, {
    command: 'server_error',
    data: {
      error_code: 0,
      message: error.toString(),
    },
  });
}
