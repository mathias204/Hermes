import Debug from 'debug';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import type {
  AcceptChannelInviteRefused,
  AcceptChannelInviteRequest,
  ChannelId,
  ChannelInviteCompleted,
  ChannelInviteRequest,
  ChannelJoinRequest,
  RejectChannelInviteCompleted,
  RejectChannelInviteRefused,
  RejectChannelInviteRequest,
  User,
} from '../protocol/proto.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { sendToClient } from '../lib/communication/send.mjs';
import { ChannelHandler } from './channel-handler.mjs';

export const InvitationHandler = {
  onClientInviteOtherClient,
  onClientAcceptInvite,
  onClientRejectInvite,
};

const debug = Debug('chatter:ChatServer-invitation-handler');

/**
 * Function adds an invite to another user's database if this user exists and
 * if the channel (linked to invite) exists and is not public type. Handling maximum
 * session of 2 users in DM type is already handled when joining the channel. Thus error
 * handling for this is not required here.
 *
 * User sending invite must also be part of channel he is inviting peer to. And invite cannot
 * be send to peer, if peer is already part of channel.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param request - Information about the command, contains channelID
 * @returns Promise<void>
 */
async function onClientInviteOtherClient(
  ws: IWebSocket,
  loggedInUser: User,
  request: ChannelInviteRequest,
): Promise<void> {
  // First gather channelEntry/userEntry from database,
  // check if they exist and type of channelEntry is not public:
  const channel = (
    await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === request.channel_id).results()
  )[0];
  const recipientUser = (
    await new Query(Table.USERS).filter(({ email_ID }) => email_ID === request.receiver).results()
  )[0];

  if (!channel) {
    // channel of invite not found:
    handleChannelInviteRefused(
      ws,
      request.channel_id,
      903,
      'Invite to channel failed, channel does not exist in database.',
    );
    debug('Invite to channel failed, channel does not exist in database.');
    return;
  }

  if (!recipientUser) {
    // recipient of invite not found:
    handleChannelInviteRefused(
      ws,
      request.channel_id,
      904,
      'Invite to channel failed, recipient user does not exist in database.',
    );
    debug('Invite to channel failed, recipient user does not exist in database.');
    return;
  }

  if (channel.type === 'public') {
    // Cannot send invite to public channels:
    handleChannelInviteRefused(ws, request.channel_id, 905, 'Invite to channel failed, channel of type public.');
    debug('Invite to channel failed, channel of type public.');
    return;
  }

  if (
    (channel.type === 'private_encrypted' || channel.type === 'direct_message_encrypted') &&
    !request.encrypted_secret
  ) {
    // Cannot send invite to encrypted channels without an encrypted secret:
    handleChannelInviteRefused(
      ws,
      request.channel_id,
      909,
      `Invite to channel failed, channel of type ${channel.type} without encrypted secret provided.`,
    );
    debug('Invite to channel failed, channel of type public.');
    return;
  }

  const sendingUser = (
    await new Query(Table.USERS).filter(({ email_ID }) => email_ID === loggedInUser.id).results()
  )[0];

  if (!sendingUser || !sendingUser.channels.includes(request.channel_id)) {
    // sendingUser always exists since authenticated in server, check if sendingUser is
    // part of channel he invites peers to:
    handleChannelInviteRefused(
      ws,
      request.channel_id,
      906,
      'Invite to channel failed, sender of invite not part of channel.',
    );
    debug('Invite to channel failed, sender of invite not part of channel.');
    return;
  }

  if (recipientUser.channels.includes(request.channel_id)) {
    // Recipient does not need invite since he is already member:
    handleChannelInviteRefused(
      ws,
      request.channel_id,
      907,
      'Invite to channel failed, recipient of invite already part of channel.',
    );
    debug('Invite to channel failed, recipient of invite already part of channel.');
    return;
  }

  if (recipientUser.channel_invites.some(({ channel_ID }) => channel_ID === request.channel_id)) {
    // Recipient already has an invite for this channel:
    handleChannelInviteRefused(
      ws,
      request.channel_id,
      908,
      'Invite to channel failed, recipient already is invited to channel.',
    );
    debug('Invite to channel failed, recipient already is invited to channel.');
    return;
  }

  // Now we can update database to add invite:
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === request.receiver)
    .update((entry) =>
      entry.channel_invites.push({
        channel_ID: request.channel_id,
        sender_ID: sendingUser.email_ID,
        encrypted_secret: request.encrypted_secret,
      }),
    );

  // Send confirmation command to client:
  const response: ChannelInviteCompleted = {};
  sendToClient(ws, { command: 'invite_channel_completed', data: response });
  debug('Invite succesfully added.');
}

/**
 * Sends a ChannelInviteRefused containing the given error
 *
 * @param ws - The websocket to send the error to
 * @param channel_id - The id of the channel the user tried to invite
 * @param error_code - The error code of the error
 * @param reason - The reason of the error
 * @returns void
 */
function handleChannelInviteRefused(
  ws: IWebSocket,
  channel_id: ChannelId,
  error_code: number,
  reason?: string | undefined,
): void {
  debug(`Inviting to channel failed, refuse command has been sent and database remains unchanged. Error ${error_code}`);
  sendToClient(ws, {
    command: 'invite_channel_refused',
    data: {
      channel_id,
      error_code,
      reason,
    },
  });
}

/**
 * Function redirects to "onClientJoinChannel" function in channel-handler. In order
 * to reduce overhead and redundancy.
 * The need for "onClientAcceptInvite" lies solely on giving the client multiple choices
 * on how to implement features.
 *
 * IMPORTANT: Client commands and error codes also follow "onClientJoinChannel".
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param request - Information about the command, contains channelID
 * @returns Promise<void>
 */
async function onClientAcceptInvite(
  ws: IWebSocket,
  loggedInUser: User,
  request: AcceptChannelInviteRequest,
): Promise<void> {
  // First check channel exists and type of channel must be (E2EE) DM/Private:
  const channel = (
    await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === request.channel_id).results()
  )[0];

  if (!channel) {
    // Channel does not exist, cannot join a channel that doesn't exist
    const response: AcceptChannelInviteRefused = {
      channel_id: request.channel_id,
      error_code: 901,
      reason: 'Tried accepting an invite to a non-existing channel.',
    };

    sendToClient(ws, { command: 'accept_invite_refused', data: response });
    debug('Tried accepting an invite to a non-existing channel.');
    return;
  }

  if (channel.type === 'public') {
    // Using this invite function for public channels should not be done!
    const response: AcceptChannelInviteRefused = {
      channel_id: request.channel_id,
      error_code: 902,
      reason: 'Tried accepting an invite to a public channel.',
    };

    sendToClient(ws, { command: 'accept_invite_refused', data: response });
    debug('Tried accepting an invite to a public channel.');
    return;
  }

  // Convert request to more general type, then call onClientJoinChannel function:
  const newRequest: ChannelJoinRequest = { channel_id: request.channel_id };
  await ChannelHandler.onClientJoinChannel(ws, loggedInUser, newRequest);
}

/**
 * Function removes an invite from a user's invites array. First checking to see if channel-invite needing
 * removal is linked to an existing channel.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param request - Information about the command, contains channelID
 * @returns Promise<void>
 */
async function onClientRejectInvite(
  ws: IWebSocket,
  loggedInUser: User,
  request: RejectChannelInviteRequest,
): Promise<void> {
  // First check if given channel exists
  const channel = (
    await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === request.channel_id).results()
  )[0];

  // If channel does not exist, it is impossible to remove invite. Return corresponding command to client:
  if (!channel) {
    const response: RejectChannelInviteRefused = {
      channel_id: request.channel_id,
      error_code: 900,
      reason: 'Tried deleting an invite from a non-existing channel.',
    };

    sendToClient(ws, { command: 'reject_invite_refused', data: response });
    debug('Tried deleting an invite from a non-existing channel.');
    return;
  }

  // Now update user database accordingly:
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.id)
    .update((entry) => {
      entry.channel_invites = entry.channel_invites.filter(({ channel_ID }) => channel_ID !== request.channel_id);
    });

  const response: RejectChannelInviteCompleted = {};
  sendToClient(ws, { command: 'reject_invite_completed', data: response });
  debug('Invite has succesfully been deleted from user his invites array.');
}
