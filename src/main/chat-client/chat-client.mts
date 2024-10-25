import type {
  ChannelList,
  LogInCompleted,
  ToClientCommand,
  Channel,
  User,
  SignUpCompleted,
} from '../protocol/proto.mjs';
import type { RawData } from 'ws';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { toClientCommandSchema } from '../protocol/proto.zod.mjs';
import figlet from 'figlet';
import Debug from 'debug';
import chalk from 'chalk';
import { Tui } from './tui.mjs';
import { MessageHandler } from './message-handler.mjs';
import { NicknameHandler } from './nickname-hander.mjs';
import { FileSharingHandler } from './file-sharing-handler.mjs';
import { ChannelHandler } from './channel-handler.mjs';
import { LookupHandler } from './lookup-handler.mjs';
import { AuthenticationHandler } from './authentication-handler.mjs';
import { UserHandler } from './user-handler.mjs';
import { ChannelRepository } from './channel-repository.mjs';
import { InviteHandler } from './invite-handler.mjs';
import { KeyHandler } from './key-handler.mjs';

// List of all the commands the user can enter in the chat
export enum Commands {
  EXIT = '/exit',
  OPEN = '/open',
  CREATE = '/create',
  CLOSE = '/close',
  HELP = '/help',
  LOOKUP = '/lookup',
  NICK = '/nick',
  SENDFILE = '/sendfile',
  SHOWFILES = '/showfiles',
  REQUESTFILE = '/requestfile',
  SHOWINVITES = '/showinvites',
  SHOWLOOKUP = '/showlookup',
  INVITE = '/invite',
  ACCEPTINVITE = '/acceptinvite',
  REFUSEINVITE = '/refuseinvite',
  DELETEUSER = '/deleteuser',
  ERROR = '/error',
}

let client: User;
const channelRepo: ChannelRepository = new ChannelRepository();
let socket: IWebSocket;
const appName = 'Hermes';
const slogan = 'the messenger of the gods';
const debug = Debug('chatter:chat-client');

export const ChatClient = {
  onServerRawMessage,
  parseCommand,
  launchApp,
  heartbeat,
  onExit,
  getClient,
  setClient,
  getSocket,
  setSocket,
  printWelcomeMessage,
  getCurrentChannel,
  setCurrentChannel,
  getAllChannels,
  setAllChannels,
  getConnectedChannels,
  setConnectedChannels,
  getOpenInvites,
  setOpenInvites,
  processAutocomplete,
};

/**
 * Function which handles the raw input from the server
 *
 * @param ws - websocket which is used to send and receive messages
 * @param data - data which is received from the server
 */
function onServerRawMessage(ws: IWebSocket, data: RawData) {
  const commandResponse = toClientCommandSchema.safeParse(data);
  if (commandResponse.success) {
    const command: ToClientCommand = commandResponse.data;
    switch (command.command) {
      case 'new_user_joined_broadcast':
        ChannelHandler.onNewUserJoinedBroadcast(command.data, channelRepo.getActiveChannel(), client);
        break;
      case 'login_completed':
        channelRepo.setConnectedChannels(command.data.currentChannels.channels);
        channelRepo.setAllChannels(command.data.currentChannels.channels); // Initialize availables with received connected
        AuthenticationHandler.onLogInCompleted(ws, command.data);
        ChannelHandler.onIncomingChannelList(channelRepo.getAllAvailableChannels());
        // Channel list will be sent after, completing the available channel list
        InviteHandler.startInvitePolling(ws);
        break;
      case 'login_refused':
        AuthenticationHandler.onLogInRefused(ws, command.data);
        break;
      case 'signup_completed':
        // Agreed with server that a login completed will follow upon signup completed. Thus no actions required here.
        // void AuthenticationHandler.onSignUpCompleted(ws, command.data);
        break;
      case 'signup_refused':
        void AuthenticationHandler.onSignUpRefused(ws, command.data);
        break;
      case 'channel_list':
        channelRepo.updatePublicChannels(command.data.channels);
        ChannelHandler.onIncomingChannelList(channelRepo.getAllAvailableChannels());
        break;
      case 'channel_join_completed': {
        ChannelHandler.onChannelJoinCompleted(command.data, ws, client, channelRepo);
        break;
      }
      case 'channel_join_refused':
        ChannelHandler.onChannelJoinRefused(command.data);
        break;
      case 'channel_create_completed': {
        ChannelHandler.onChannelCreateCompleted(command.data, channelRepo, ws, client);
        const currentChannel = channelRepo.getActiveChannel();
        if (!currentChannel) {
          break;
        }
        UserHandler.startUserPolling(ws, currentChannel.id);
        break;
      }
      case 'channel_create_refused':
        ChannelHandler.onChannelCreateRefused(command.data);
        break;
      case 'channel_leave_completed':
        ChannelHandler.onChannelLeaveCompleted(command.data, channelRepo);
        break;
      case 'channel_leave_refused':
        ChannelHandler.onChannelLeaveRefused(command.data);
        break;
      case 'message_received':
        MessageHandler.onMessageReceived(command.data, channelRepo.getCurrentSecret());
        break;
      case 'message_sending_error':
        MessageHandler.onMessageSendingError(command.data);
        break;
      case 'lookup_result':
        LookupHandler.onLookupResult(command.data, channelRepo.getCurrentSecret());
        break;
      case 'lookup_error':
        LookupHandler.onLookupError(command.data);
        break;
      case 'incoming_encoded_file':
        FileSharingHandler.onEncodedFile(command.data, channelRepo.getActiveChannel(), socket);
        break;
      case 'file_content':
        FileSharingHandler.onFileContent(command.data, channelRepo.getActiveChannel(), socket);
        break;
      case 'file_sharing_error':
        FileSharingHandler.error(command.data);
        break;
      case 'list_files_response':
        FileSharingHandler.onListFiles(command.data);
        break;
      case 'message_history_response':
        ChannelHandler.onMessageHistoryResponse(command.data, channelRepo.getCurrentSecret());
        break;
      case 'message_history_error':
        ChannelHandler.onMessageHistoryError(command.data);
        break;
      case 'server_error':
        break;
      case 'nickname_change_success':
        NicknameHandler.onNicknameChangeSuccess(command.data, client);
        break;
      case 'participants_error':
        UserHandler.onParticipantsError(command.data);
        break;
      case 'participants_response':
        UserHandler.onParticipantsResponse(command.data, channelRepo.getActiveChannel()?.id);
        break;
      case 'delete_user_success':
        UserHandler.onDeleteCompleted();
        break;
      case 'delete_user_refused':
        UserHandler.onDeleteFailed();
        break;
      case 'channels_broadcast_incoming':
        InviteHandler.onInviteBroadcast(command.data, channelRepo);
        break;
      case 'invite_channel_refused':
        InviteHandler.onInviteRefused(command.data);
        break;
      case 'accept_invite_completed':
        // (No data) (Should not be sent)
        break;
      case 'accept_invite_refused':
        InviteHandler.onAcceptInviteRefused(command.data);
        break;
      case 'reject_invite_completed':
        // (No data)
        break;
      case 'reject_invite_refused':
        InviteHandler.onRejectInviteRefused(command.data);
        break;
      case 'invite_channel_completed':
        InviteHandler.onInviteCompleted(command.data);
        break;
      case 'update_public_key_refused':
        KeyHandler.onUpdatePublicKeyRefused(command.data);
        break;
      case 'public_key_refused':
        KeyHandler.onPublicKeyRefused(command.data);
        break;
      case 'public_key_response':
        KeyHandler.onPublicKeyResponse(command.data);
        break;
      default:
        debug('Listener not implemented yet for command %s', command.command);
        break;
    }
  } else {
    Tui.logError(chalk.red(commandResponse.error));
    debug('Received raw message is not a valid ToClientCommand');
  }
}

/**
 * Function which parses the user input and executes the corresponding command
 *
 * @param input - user input
 * @param ws - websocket which is used to send and receive messages
 */
export function parseCommand(input: string) {
  if (input[0] !== '/') {
    MessageHandler.onSend(socket, input.split(' '), channelRepo.getCurrentSecret());
  } else {
    const inputArray = input.split(' ');
    const command = inputArray[0]?.toLowerCase();
    const args = inputArray.slice(1);
    switch (command) {
      case Commands.EXIT:
        ChatClient.onExit();
        break;
      case Commands.OPEN:
        ChannelHandler.onOpen(socket, args, channelRepo, client);
        break;
      case Commands.CREATE:
        ChannelHandler.onCreate(socket, args, channelRepo.getAllAvailableChannels());
        break;
      case Commands.CLOSE: {
        const hasActiveChannel = channelRepo.getActiveChannel() !== undefined;
        channelRepo.setActiveChannel(ChannelHandler.onClose(channelRepo.getActiveChannel()));
        if (hasActiveChannel) printWelcomeMessage();
        break;
      }
      case Commands.LOOKUP:
        LookupHandler.lookupMessage(socket, args.join(' '), channelRepo.getActiveChannel());
        break;
      case Commands.SENDFILE:
        FileSharingHandler.sendEncodedFile(socket, args, channelRepo.getActiveChannel());
        break;
      case Commands.SHOWFILES:
        Tui.showFiles();
        break;
      case Commands.REQUESTFILE:
        FileSharingHandler.requestFile(socket, args, channelRepo.getActiveChannel());
        break;
      case Commands.HELP:
        Tui.showHelp();
        break;
      case Commands.NICK:
        NicknameHandler.onNick(socket, args);
        break;
      case Commands.SHOWINVITES:
        InviteHandler.onInviteList(args, channelRepo.getChannelInvites());
        break;
      case Commands.INVITE:
        InviteHandler.onInvite(socket, args, client, channelRepo.getActiveChannel(), channelRepo.getCurrentSecret());
        break;
      case Commands.ACCEPTINVITE:
        InviteHandler.onAccept(socket, args, channelRepo);
        break;
      case Commands.REFUSEINVITE:
        InviteHandler.onRefuse(socket, args, channelRepo);
        break;
      case Commands.DELETEUSER:
        UserHandler.deleteUser(socket, client);
        break;
      case Commands.ERROR:
        Tui.showError();
        break;
      case Commands.SHOWLOOKUP:
        Tui.showLookup();
        break;
      default:
        Tui.logError(chalk.red("Command doesn't exist. Type '/help' to get a list of all the commands you can use."));
    }
  }
}

/**
 * Launches the chat application after the user is logged in
 *
 * @param ws - websocket which is used to send and receive messages
 * @param userData - data of the user which is logged in
 */
function launchApp(ws: IWebSocket, userData: LogInCompleted | SignUpCompleted) {
  console.clear();
  Tui.setUp();
  client = userData.user;
  KeyHandler.getKeyPair(ws, client.id);
  ChatClient.printWelcomeMessage();
  socket = ws;
}

/**
 * Prints a welcome message to the console
 */
function printWelcomeMessage() {
  Tui.writeMessage(
    chalk.yellowBright(
      figlet.textSync(appName, { font: 'Slant', horizontalLayout: 'default', verticalLayout: 'default' }),
    ),
  );
  if (client.username === undefined) {
    Tui.writeMessage(
      chalk.yellowBright(
        `Welcome to ${slogan}, ${client.id}! Type "/help" get a list of all the commands you can use.`,
      ),
    );
  } else {
    Tui.writeMessage(
      chalk.yellowBright(
        `Welcome to ${slogan}, ${client.username.trim()}! Type "/help" get a list of all the commands you can use.`,
      ),
    );
  }
}

/**
 *  Starts a heartbeat timer which closes the client if the server does not respond in time
 *
 * @param ws - websocket which is used to send and receive messages
 */
function heartbeat(ws: IWebSocket) {
  const { pingInterval, buffer } = { pingInterval: 30000, buffer: 3000 };
  if (ws.pingTimeout) {
    clearTimeout(ws.pingTimeout);
  }
  ws.pingTimeout = setTimeout(() => {
    Tui.writeMessage('Closing client because of socket time out');
    process.exit(0);
  }, pingInterval + buffer);
}

/**
 * Function which tries to autocomplete the user input
 *
 * @param input - user input
 * @returns - the input or the command which is autocompleted
 */
function processAutocomplete(input: string[]): string {
  if (input.length === 0) {
    return '';
  }
  const userCommand = input[0];
  if (input[0] === Commands.OPEN) {
    return ChannelHandler.processAutocomplete(input, channelRepo.getAllAvailableChannels());
  } else if (input[0] === Commands.REQUESTFILE) {
    return FileSharingHandler.processAutocomplete(input);
  } else if (input[0] === Commands.ACCEPTINVITE || input[0] === Commands.REFUSEINVITE) {
    return InviteHandler.processAutocomplete(input, channelRepo.getChannelInvites());
  } else {
    let counter = 0;
    let match;
    const commands = Object.values(Commands);
    commands.forEach((command) => {
      if (command.toLowerCase().startsWith(userCommand!)) {
        counter++;
        match = command.toLowerCase();
      }
    });
    if (counter === 1 && match) {
      return (match as string) + ' ';
    } else {
      return input.join(' ');
    }
  }
}

/**
 * Stops polling for invites, and exits the process with exit code 0
 */
function onExit() {
  InviteHandler.stopInvitePolling();
  process.exit(0);
}

/**
 * Returns the client which is currently logged in
 *
 * @returns the current user
 */
function getClient(): User {
  return client;
}

/**
 * Sets the client which is currently logged in
 *
 * @param user - Logged in user
 */
function setClient(user: User) {
  client = user;
}

/**
 * Returns the websocket to which the client is connected
 *
 * @returns Connected websocket
 */
function getSocket(): IWebSocket {
  return socket;
}

/**
 * Sets the connected websocket
 *
 * @param ws - Connected websocket
 */
function setSocket(ws: IWebSocket) {
  socket = ws;
}

/**
 * Returns the current channel that the client is on
 *
 * @returns the current channel
 */
function getCurrentChannel(): Channel | undefined {
  return channelRepo.getActiveChannel();
}

/**
 * Sets the current channel
 *
 * @param channel - the new current channel
 */
function setCurrentChannel(channel: Channel | undefined) {
  channelRepo.setActiveChannel(channel);
}

/**
 * Returns all the channels which are available to join
 *
 * @returns all the channels
 */
function getAllChannels(): ChannelList {
  return { channels: channelRepo.getAllAvailableChannels() };
}

/**
 * Sets all the channels which are available to join
 *
 * @param channels - all the channels which are available
 */
function setAllChannels(channels: ChannelList) {
  channelRepo.setAllChannels(channels.channels);
}

/**
 * Returns all the channels which the client is connected to
 *
 * @returns all the connected channels
 */
function getConnectedChannels(): ChannelList {
  return { channels: channelRepo.getConnectedChannels() };
}

/**
 * Sets all the channels which the client is connected to
 *
 * @param channels - all the connected channels
 */
function setConnectedChannels(channels: ChannelList) {
  channelRepo.setConnectedChannels(channels.channels);
}

/**
 * Returns all the channels which the client has an open invite for
 *
 * @returns all the open channel invites
 */
function getOpenInvites(): ChannelList {
  return { channels: channelRepo.getChannelInvites() };
}

/**
 * Sets all the channels which the client has an open invite for
 *
 * @param channels - all the open channel invites
 */
function setOpenInvites(channels: ChannelList) {
  channelRepo.setOpenInvites(channels.channels);
}
