import chalk from 'chalk';
import type {
  AcceptChannelInviteRefused,
  Channel,
  ChannelId,
  ChannelInviteCompleted,
  ChannelInviteRefused,
  ChannelInvitesBroadcast,
  RejectChannelInviteRefused,
  User,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { Tui } from './tui.mjs';
import { sendToServer } from '../lib/communication/send.mjs';
import type { ChannelRepository } from './channel-repository.mjs';
import { userIdSchema } from '../protocol/proto.zod.mjs';
import { KeyHandler } from './key-handler.mjs';
import { Encryption } from '../lib/encryption/encryption.mjs';

export const InviteHandler = {
  onInviteBroadcast,
  onInviteRefused,
  onRejectInviteRefused,
  onAcceptInviteRefused,
  onInviteCompleted,
  onInviteList,
  onInvite,
  onAccept,
  onRefuse,
  stopInvitePolling,
  startInvitePolling,
  processAutocomplete,
};

let pollingTimer: NodeJS.Timeout | undefined;

/**
 * Handles an channel_broadcast_incoming event sent by the server, by setting the repository's open invites list to the given
 * list in the data, and also updating the TUI with the new repository invites list.
 * @param data - data which is received from the server
 * @param repo - the chat clients channel repository
 */
function onInviteBroadcast(data: ChannelInvitesBroadcast, repo: ChannelRepository) {
  repo.setOpenInvites(data.invites);
  Tui.setInviteContent(repo.getChannelInvites());
}

/**
 * Handles invite related errors sent by the server.
 * @param data - data which is received from the server
 */
function onInviteRefused(data: ChannelInviteRefused) {
  handleErrorCode(data, 'An unexpected error occured while sending a channel invitation');
}

/**
 * Handles invite rejection related errors sent by the server.
 * @param data - data which is received from the server
 */
function onRejectInviteRefused(data: RejectChannelInviteRefused) {
  handleErrorCode(data, 'An unexpected error occured while refusing a channel invitation');
}

/**
 * Handles invite accepting related errors sent by the server.
 * @param data - data which is received from the server
 */
function onAcceptInviteRefused(data: AcceptChannelInviteRefused) {
  handleErrorCode(data, 'An unexpected error occured while accepting a channel invitation');
}

/**
 * Compares the error code of the given error message to a list of possible expected error codes, and writes a message with
 * an explanation to the user. In case of an unexpected error code, writes the given default message instead, in red, along
 * with an extra line displaying the error code of the error message, and, if present, the reason.
 * @param errorMsg - the error message sent by the server
 * @param defaultMsg - the default message to display when the error is not recognised
 */
function handleErrorCode(errorMsg: ErrorResponse, defaultMsg: string) {
  switch (errorMsg.error_code) {
    case 904:
      Tui.logError(chalk.red('Invited user does not yet exist'));
      break;
    case 907:
      Tui.logError(chalk.red('Invited user already joined this channel'));
      break;
    case 908:
      Tui.logError(chalk.red('Invited user was already invited'));
      break;
    default:
      Tui.logError(chalk.red(defaultMsg));
      // Also print "Error code: ..." with code, or "Error code: ... | Reason: ..." if reason is also present:
      Tui.logError(
        chalk.red(`Error code: ${errorMsg.error_code}${errorMsg.reason ? ` | Reason: ${errorMsg.reason}` : ''}`),
      );
      break;
  }
}

type ErrorResponse = {
  channel_id: ChannelId;
  error_code: number;
  reason?: string | undefined;
};

function onInviteCompleted(_data: ChannelInviteCompleted) {
  Tui.writeMessage(chalk.green('Invite sent!'));
}

/**
 * Processes a list invites command from the user. Ignores extra arguments.
 * This function will set the invite content in the TUI to the given channel list `invites`, and toggles the visibility of
 * said list in the TUI.
 * @param args - arguments which are provided by the user
 * @param invites - the array of channel invites currently saved by the client
 */
function onInviteList(_args: string[], invites: Channel[]): void {
  Tui.setInviteContent(invites);
  Tui.showInvites();
}

/**
 * Processes an invite command from the user. Sends a channel_invite_request to the server, assuming one user e-mail
 * was given as an argument, with said e-mail as the user ID. This ID is not checked client-side.
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 * @param currentChannel - the current channel which is open
 */
function onInvite(
  ws: IWebSocket,
  args: string[],
  user: User,
  currentChannel: Channel | undefined,
  secret?: Buffer | undefined,
): void {
  // Channel checks:
  if (!currentChannel) {
    Tui.logError(chalk.red('Must be in channel to invite users'));
    return;
  }
  if (currentChannel.type === 'public') {
    Tui.logError(chalk.red('Public channels do not allow invites'));
    return;
  }

  // Arguments checks:
  if (args.length !== 1) {
    Tui.logError(chalk.red('Must provide one user to invite'));
    return;
  }

  const userID: string = args[0] as string; // args has one string

  if (!userIdSchema.safeParse(userID).success) {
    Tui.logError(chalk.red('Given user ID is not a valid e-mail address'));
    return;
  }

  // Send invite to the given user
  if (currentChannel.type === 'direct_message_encrypted' || currentChannel.type === 'private_encrypted') {
    if (!secret) {
      Tui.logError(chalk.red('Trying to send an invite to a private channel without a secret'));
      return;
    }
    // Request invitee's public key
    KeyHandler.requestPublicKey(ws, userID)
      .then((publicKey) => {
        const { privateKey } = KeyHandler.getKeyPair(ws, user.id);
        const sharedSecret = Encryption.calculateSharedSecret(privateKey, publicKey);
        const encryptionkey = Encryption.deriveEncryptionKey(sharedSecret);
        const encryptedSecret = Encryption.encryptMessage(secret, encryptionkey);

        sendToServer(ws, {
          command: 'channel_invite_request',
          data: {
            receiver: userID,
            channel_id: currentChannel.id,
            encrypted_secret: encryptedSecret.toString('hex'),
          },
        });
      })
      .catch(() => {
        Tui.logError(chalk.red('Failed to retrieve users public key'));
      });
  } else {
    sendToServer(ws, {
      command: 'channel_invite_request',
      data: {
        receiver: userID,
        channel_id: currentChannel.id,
      },
    });
  }
}

/**
 * Processes an accept command from the user. Sends an accept_channel_invite_request to the server, assuming one channel name
 * was given as an argument, and said channel name is within the client's channel repository as an open invite. Also removes
 * said channel from the repository's invite list.
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 * @param repo - the chat clients channel repository
 */
function onAccept(ws: IWebSocket, args: string[], repo: ChannelRepository): void {
  // Argument checks:
  if (args.length !== 1) {
    Tui.logError(chalk.red('accept requires one (1) argument, the channel name'));
    return;
  }
  const channelName: string = args[0] as string; // args has length 1

  const channel = findChannelByName(channelName, repo.getChannelInvites());
  if (!channel) {
    Tui.logError(chalk.red('No channel invite with given name found'));
    return;
  }

  sendToServer(ws, {
    command: 'accept_channel_invite_request',
    data: {
      channel_id: channel?.id,
    },
  });

  // Remove accepted channel from invites list (temporary: server will be polled with full invite list later)
  const newInvitesArray = repo.getChannelInvites().filter((invite) => invite.id !== channel.id);
  repo.setOpenInvites(newInvitesArray);
  Tui.setInviteContent(repo.getChannelInvites());
}

/**
 * Processes a refuse command from the user. Sends a reject_channel_invite_request to the server, assuming one channel name
 * was given as an argument, and said channel name is within the client's channel repository as an open invite. Also removes
 * said channel from the repository's invite list.
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 * @param repo - the chat clients channel repository
 */
function onRefuse(ws: IWebSocket, args: string[], repo: ChannelRepository): void {
  // Argument checks:
  if (args.length !== 1) {
    Tui.logError(chalk.red('refuse requires one (1) argument, the channel name'));
    return;
  }
  const channelName: string = args[0] as string; // args has length 1

  const channel = findChannelByName(channelName, repo.getChannelInvites());
  if (!channel) {
    Tui.logError(chalk.red('No channel invite with given name found'));
    return;
  }

  sendToServer(ws, {
    command: 'reject_channel_invite_request',
    data: {
      channel_id: channel.id,
    },
  });

  // Remove refused channel from invites list (temporary: server will be polled with full invite list later)
  const newInvitesArray = repo.getChannelInvites().filter((invite) => invite.id !== channel.id);
  repo.setOpenInvites(newInvitesArray);
  Tui.setInviteContent(repo.getChannelInvites());
}

/**
 * Returns the channel in the given channel list with the given name.
 * @param channelName - the name of the requested channel
 * @param channels - the list of channels in which the requested channel resides
 */
function findChannelByName(channelName: string, channels: Channel[]): Channel | undefined {
  return channels.find((channel) => channel.name === channelName);
}

/**
 * Stops polling the server for channel invites
 */
function stopInvitePolling() {
  clearInterval(pollingTimer);
  pollingTimer = undefined;
}

/**
 * Starts polling the server for channel invites
 * @param ws - the server websocket
 */
function startInvitePolling(ws: IWebSocket) {
  InviteHandler.stopInvitePolling();

  sendToServer(ws, {
    command: 'channel_invite_broadcast_request',
    data: {},
  });

  pollingTimer = setInterval(() => {
    sendToServer(ws, {
      command: 'channel_invite_broadcast_request',
      data: {},
    });
  }, 20000);
}

/**
 * Processes the autocomplete for the acceptinvite and refuseinvite commands, by extending the first input argument with a
 * matching invite, assuming there is only one. If there is no match, or more arguments are given, this simply returns the
 * given input.
 *
 * @param input - the input written in the input box, split per space
 * @param invites - the invite which are known to the client
 * @returns the autocompleted input
 */
function processAutocomplete(input: string[], invites: Channel[]): string {
  if (input.length === 2) {
    const userChannelName = input[1];
    let count = 0;
    let match;
    invites.forEach((channel) => {
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
