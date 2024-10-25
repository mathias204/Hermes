import type {
  Channel,
  ChannelJoinRefused,
  ChannelJoinCompleted,
  ChannelLeaveRefused,
  ChannelLeaveCompleted,
  ChannelCreateRefused,
  ChannelCreateCompleted,
  RequestMessageHistory,
  MessageHistoryResponse,
  MessageHistoryError,
  NewUserJoinedBroadcast,
  User,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { DateTime } from 'luxon';
import { Tui } from './tui.mjs';
import chalk from 'chalk';
import { sendToServer } from '../lib/communication/send.mjs';
import { UserHandler } from './user-handler.mjs';
import type { ChannelRepository } from './channel-repository.mjs';
import { channelNameSchema, channelTypeSchema } from '../protocol/proto.zod.mjs';
import { Encryption, type PublicKey } from '../lib/encryption/encryption.mjs';
import { KeyHandler } from './key-handler.mjs';
import { FileSharingHandler } from './file-sharing-handler.mjs';

export const ChannelHandler = {
  onChannelJoinRefused,
  onChannelJoinCompleted,
  onChannelLeaveRefused,
  onChannelLeaveCompleted,
  onChannelCreateRefused,
  onChannelCreateCompleted,
  onCreate,
  onOpen,
  onClose,
  onMessageHistoryResponse,
  onMessageHistoryError,
  onNewUserJoinedBroadcast,
  onIncomingChannelList,
  processAutocomplete,
};

/**
 * Function which handles a new_user_joined_broadcast from the server by logging the new user which joined the channel
 *
 * @param data - data which is received from the server
 * @param currentChannel - the current channel which is open
 * @param user - the current user
 */
function onNewUserJoinedBroadcast(data: NewUserJoinedBroadcast, currentChannel: Channel | undefined, user: User) {
  if (user === data.user || currentChannel === undefined) {
    return;
  }

  if (currentChannel.id === data.channel.id) {
    Tui.writeMessage(chalk.green(`user "${data.user.username || data.user.id}" opened the channel`));
  }
}

/**
 * Function which handles a channel_join_refused from the server by logging the error message
 *
 * Possible error codes:
 * 404 - The channel does not exist
 * 405 - You are already in the channel
 * Default - Unknown error code received with message
 *
 * @param data - data which is received from the server
 */
function onChannelJoinRefused(data: ChannelJoinRefused) {
  const error_code = data.error_code;
  switch (error_code) {
    case 404:
      Tui.logError(chalk.red(`The channel does not exist`));
      break;
    case 405:
      Tui.logError(chalk.red(`You are already in the channel`));
      break;
    default:
      Tui.logError(chalk.red(`Unknown error code ${error_code} received with message '${data.reason}'`));
      break;
  }
  return;
}

/**
 * Function which handles a channel_create_completed from the server
 *
 * Adds the channel to the repositories connected channels list, sets the new channel as the active channel, starts the user polling,
 * and responds to the server with a request_message_history and a new_user_joined_broadcast_trigger
 *
 * @param data - data which is received from the server
 * @param ws - websocket which is used to send and receive messages
 * @param client - the user using the client
 * @param repo - the chat clients channel repository
 */
export function onChannelJoinCompleted(
  data: ChannelJoinCompleted,
  ws: IWebSocket,
  client: User,
  repo: ChannelRepository,
): void {
  repo.addConnectedChannel(data.channel);
  if (!repo.containsAsAvailable(data.channel.id)) {
    repo.addAvailableChannel(data.channel);
    Tui.updateChannels(repo.getAllAvailableChannels());
  }
  repo.setActiveChannel(data.channel);
  UserHandler.startUserPolling(ws, data.channel.id);
  Tui.setChatBoxLabel(`${data.channel.name} (${data.channel.type})`);
  Tui.clearChatBox();
  sendToServer(ws, {
    command: 'request_message_history',
    data: { channel_id: data.channel.id, amount: 10 },
  });

  if (data.channel.type === 'direct_message_encrypted' || data.channel.type === 'private_encrypted') {
    // Decrypt the secret
    const { privateKey } = KeyHandler.getKeyPair(ws, client.id);
    const sharedSecret = Encryption.calculateSharedSecret(privateKey, data.peer_public_key as PublicKey);
    const encryptionKey = Encryption.deriveEncryptionKey(sharedSecret);
    const secret = Encryption.decryptMessage(Buffer.from(data.encrypted_secret!, 'hex'), encryptionKey);
    KeyHandler.saveChannelSecretToFile(data.channel.id, secret);
    repo.setCurrentSecret(secret);
  } else {
    repo.clearCurrentSecret();
  }

  sendToServer(ws, {
    command: 'new_user_joined_broadcast_trigger',
    data: {
      user: client,
      channel: data.channel,
    },
  });

  FileSharingHandler.listFilesRequest(ws, data.channel);
}

/**
 * Function which handles a channel_leave_refused from the server by logging the error message
 *
 * @param data - data which is received from the server
 */
function onChannelLeaveRefused(data: ChannelLeaveRefused) {
  const error_code = data.error_code;
  Tui.logError(chalk.red(`unknown error code ${error_code} received with message '${data.reason}'`));
  return;
}

/**
 * Function which handles a channel_create_completed from the server
 *
 * Removes the channel from the repositories connected channels list, removes the channel from the repositories available channels list if it is not public
 *
 * @param data - data which is received from the server
 * @param repo -  the chat clients channel repository
 */
function onChannelLeaveCompleted(data: ChannelLeaveCompleted, repo: ChannelRepository) {
  repo.removeConnectedChannel(data.channel.id);
  repo.removeAvailableChannelIfNotPublic(data.channel.id);
  repo.clearCurrentSecret();
}

/**
 * Function which handles a channel_create_completed from the server by logging the error message
 *
 * @param data - data which is received from the server
 */
function onChannelCreateRefused(data: ChannelCreateRefused) {
  const error_code = data.error_code;
  Tui.logError(chalk.red(`unknown error code ${error_code} received with message '${data.reason}'`));
}

/**
 * Function which handles a channel_create_completed from the server.
 *
 * Adds the channel to the repositories available channels list, connected channels list,
 * sets the new channel as the active channel, and responds to the server with a new_user_joined_broadcast_trigger.
 *
 * @param data - data which is received from the server
 * @param channelRepo - the chat clients channel repository
 * @param ws - websocket which is used to send and receive messages
 * @param client - the user using the client
 */
function onChannelCreateCompleted(
  data: ChannelCreateCompleted,
  channelRepo: ChannelRepository,
  ws: IWebSocket,
  client: User,
): void {
  Tui.writeMessage(chalk.green(`Created channel '${data.channel.name}'`));

  // Availability of channel:
  channelRepo.addAvailableChannel(data.channel);

  // Connection to channel:
  channelRepo.addConnectedChannel(data.channel);

  // Update connection
  Tui.updateChannels(channelRepo.getAllAvailableChannels());

  // Update secret
  let channel_secret = undefined;
  if (data.channel.type === 'direct_message_encrypted' || data.channel.type === 'private_encrypted') {
    KeyHandler.loadKeyPairFromFiles;
    channel_secret = Encryption.generateRandomGroupSecret();
    KeyHandler.saveChannelSecretToFile(data.channel.id, channel_secret);
    channelRepo.setCurrentSecret(channel_secret);
  } else {
    channelRepo.clearCurrentSecret();
  }

  // Broadcast join:
  sendToServer(ws, {
    command: 'new_user_joined_broadcast_trigger',
    data: {
      user: client,
      channel: data.channel,
    },
  });

  // Set as active:
  channelRepo.setActiveChannel(data.channel);
  Tui.setChatBoxLabel(`${data.channel.name} (${data.channel.type})`);
}

/**
 * Processes a create channel command from the user
 *
 * Creates a new channel with the given name and type, if these are valid and the channel does not already exist
 *
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 * @param allChannels - all channels which are available
 */
function onCreate(ws: IWebSocket, args: string[], allChannels: Channel[]) {
  if (args.length > 2) {
    Tui.logError(chalk.red('Too many arguments. Usage: /create <channel-name> [<channel-type>]'));
    return;
  }

  // Channel name:
  const channelName = args[0];
  if (!channelName) {
    Tui.logError(chalk.red('No channel name provided'));
    return;
  }
  const channelResult = channelNameSchema.safeParse(channelName);
  if (!channelResult.success) {
    Tui.logError(chalk.red('Channel name must be between 1 and 30 characters'));
    return;
  }
  if (allChannels.find((channel) => channel.name === channelName)) {
    Tui.logError(chalk.red('Channel already exists'));
    return;
  }

  // Channel type:
  let channelType = args[1];
  if (!channelType) channelType = 'public';
  // Currently, type is the same as the type sent in a command, for simplicity.
  // This could be changed later to allow for more user-friendly input.
  const parseResult = channelTypeSchema.safeParse(channelType);
  if (!parseResult.success) {
    Tui.logError(chalk.red('Unknown channel type'));
    return;
  }
  const parsedType = parseResult.data;

  Tui.clearChatBox();

  sendToServer(ws, {
    command: 'channel_create_request',
    data: {
      name: channelName,
      type: parsedType,
    },
  });
}

/**
 * Processes a open command from the user
 *
 * Opens a new channel with the given name, if it exists and the user is not already in the channel
 *
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 * @param repo - the clients channel repository
 * @param client - the current user
 * @returns the new current channel
 */
function onOpen(ws: IWebSocket, args: string[], repo: ChannelRepository, client: User): void {
  const firstArg = args[0];
  if (!firstArg) {
    Tui.logError(chalk.red('No channel name provided'));
    return;
  }
  const channelName: string = firstArg;
  if (repo.getActiveChannel()?.name === channelName) {
    Tui.logError(chalk.red('You are already in this channel'));
    return;
  }
  const channel = repo.getAllAvailableChannels().find((channel) => channel.name === channelName);
  if (!channel) {
    Tui.logError(chalk.red('Channel does not exist'));
    return;
  }
  const channelConnected = repo.getConnectedChannels().find((channel) => channel.name === channelName);
  if (channelConnected) {
    const request: RequestMessageHistory = {
      channel_id: channelConnected.id,
      amount: 10,
    };

    Tui.clearChatBox();
    Tui.setChatBoxLabel(`${channel.name} (${channel.type})`);

    sendToServer(ws, {
      command: 'request_message_history',
      data: request,
    });

    sendToServer(ws, {
      command: 'new_user_joined_broadcast_trigger',
      data: {
        user: client,
        channel: channelConnected,
      },
    });

    UserHandler.startUserPolling(ws, channelConnected.id);
    repo.setActiveChannel(channelConnected);
    if (channelConnected.type === 'direct_message_encrypted' || channelConnected.type === 'private_encrypted')
      repo.setCurrentSecret(KeyHandler.loadChannelSecretFromFile(channelConnected.id));
    else repo.clearCurrentSecret();
    FileSharingHandler.listFilesRequest(ws, channelConnected);
    return;
  } else {
    sendToServer(ws, {
      command: 'channel_join_request',
      data: {
        channel_id: channel.id,
      },
    });
    return;
  }
}

/**
 * Processes a close command from the user, closing the current channel
 *
 * @param currentChannel - the current channel which is open
 * @returns - the new current channel (undefined)
 */
function onClose(currentChannel: Channel | undefined): undefined {
  if (!currentChannel) {
    Tui.logError(chalk.red('You are not in a channel'));
    return;
  }
  UserHandler.stopUserPolling();
  Tui.clearChatBox();
  Tui.setChatBoxLabel('');
  Tui.clearFilesContent();
  return undefined;
}

/**
 * Logs the message history to the chat log for the users to read
 *
 * @param data - MessageHistoryResponse which holds the channel_id and messages
 * @param secret - Secret to decrypt encrypted message with if provided
 */
function onMessageHistoryResponse(data: MessageHistoryResponse, secret?: Buffer | undefined) {
  Tui.writeMessage(chalk.gray(`The last ${data.messages.length} message(s) in this channel is/are:`));
  let encryptionKey: Buffer;
  if (secret) encryptionKey = Encryption.deriveEncryptionKey(secret);
  data.messages.forEach((message) => {
    let content: string = message.msg;
    if (encryptionKey)
      content = Encryption.decryptMessage(Buffer.from(content, 'hex'), encryptionKey).toString('utf-8');
    let timeString: string;
    if (message.time instanceof DateTime) {
      timeString = message.time.toLocal().toFormat('yyyy-MM-dd HH:mm');
    } else {
      timeString = DateTime.fromISO(message.time, { setZone: true }).toLocal().toFormat('yyyy-MM-dd HH:mm');
    }
    const senderName = message.sender.username || message.sender.id;
    Tui.writeMessage(chalk.gray(`${senderName} at ${timeString}: ${content}`));
  });
}

/**
 * Handles the error when a message history request fails
 *
 * @param data - contains the error code and error reason for the message history request fail
 */
function onMessageHistoryError(data: MessageHistoryError) {
  Tui.logError(chalk.red(data.reason));
}

/**
 * Handles a an incoming list of channels
 *
 * @param data - data which is received from the server
 */
function onIncomingChannelList(channels: Channel[]) {
  Tui.updateChannels(channels);
}

/**
 * Processes the autocomplete for the open command
 *
 * @param input - the input from the user
 * @param channels - the channels which are available
 * @returns the autocompleted input
 */
function processAutocomplete(input: string[], channels: Channel[]): string {
  if (input.length === 2) {
    const userChannelName = input[1];
    let count = 0;
    let match;
    channels.forEach((channel) => {
      if (channel.name.startsWith(userChannelName!)) {
        count++;
        match = channel.name;
      }
    });
    if (count === 1) {
      return input[0] + ' ' + match;
    }
  }
  return input.join(' ');
}
