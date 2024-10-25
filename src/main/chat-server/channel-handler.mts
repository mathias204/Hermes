import type {
  ChannelCreateCompleted,
  ChannelCreateRequest,
  ChannelId,
  ChannelJoinRequest,
  ChannelLeaveCompleted,
  ChannelLeaveRequest,
  User,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import type { ChannelEntry, UserEntry } from '../database/database-interfaces.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { randomUUID } from 'node:crypto';
import Debug from 'debug';
import { sendToClient } from '../lib/communication/send.mjs';
import { BroadcastHandler } from './broadcast-handler.mjs';

export const ChannelHandler = {
  onClientJoinChannel,
  onClientCreateChannel,
  onClientLeaveChannel,
};

const MAX_INSERTION_ATTEMPTS = 3;
const debug = Debug('chatter:ChatServer-channel-handler');

/**
 * Function handles case 'channel_create_request' for IWebServer.
 * Will refuse to create channel if there is already one in the database with same ID.
 *
 * Upon succesful completion of the create request, UserEntry and ChannelEntry[] of database will
 * be updated to contain new channel.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param request - Information about the join channel request, Channel instance
 * @returns Promise<void>
 */
async function onClientCreateChannel(
  ws: IWebSocket,
  loggedInUser: User,
  request: ChannelCreateRequest,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  const channelEntry: ChannelEntry = {
    channel_ID: randomUUID(),
    name: request.name,
    type: request.type,
  };

  // Attempt to insert the channel into the database
  let inserted = false;
  let attempts = 0;

  while (!inserted) {
    try {
      await new Query(Table.CHANNELS).insert(channelEntry);
      inserted = true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Primary ID already exists.' &&
        attempts < MAX_INSERTION_ATTEMPTS
      ) {
        attempts++;
        debug(`Failed to insert channel, trying again with new ID [attempt ${attempts}/${MAX_INSERTION_ATTEMPTS}]`);
        channelEntry.channel_ID = randomUUID();
      } else {
        debug('Joining channel failed, refuse command has been sent and database remains unchanged. Error 500');
        handleChannelCreateRefused(ws, request.name, 500, 'Failed to insert channel into the database');
        return;
      }
    }
  }

  // Update user in database:
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.id)
    .update((entry) => entry.channels.push(channelEntry.channel_ID));

  // Send ChannelCreateCompleted command over websocket:
  const response: ChannelCreateCompleted = {
    channel: { name: channelEntry.name, id: channelEntry.channel_ID, type: channelEntry.type },
  };
  sendToClient(ws, { command: 'channel_create_completed', data: response });
  debug('Creating channel was succesful, database is updated.');

  // Notify relevant users of the update in the database, only if public channel is made:
  if (response.channel.type === 'public') {
    await BroadcastHandler.broadcastChannels(loggedInClients);
  }

  // Optional invited_participants field will not be handled, only for cases private/privateEncrypted/directMessage/directMessageEncrypted.
  // Intended as future expansion, if client whishes to create and invite users in 1 command instead of 2.
}

/**
 * Sends a ChannelCreateRefused containing the given error
 *
 * @param ws - The websocket to send the error to
 * @param channel_name - The name of the channel the user tried to create
 * @param error_code - The error code of the error
 * @param reason - The reason of the error
 * @returns void
 */
function handleChannelCreateRefused(
  ws: IWebSocket,
  channel_name: ChannelId,
  error_code: number,
  reason?: string | undefined,
): void {
  debug(`Joining channel failed, refuse command has been sent and database remains unchanged. Error ${error_code}`);
  sendToClient(ws, {
    command: 'channel_create_refused',
    data: {
      channel_name,
      error_code,
      reason,
    },
  });
}

/**
 * Function handles case 'channel_join_request' for IWebServer.
 * Will refuse joining channel if user is already part of that channel, or if the channel
 * does not exist. Additionaly also refuse if the channel is of private time, and user has no invite.
 *
 * After succesfully joining a channel database will be updated accordingly, UserEntry in database also updated.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param request - Information about the join channel request, Channel instance
 * @returns - Promise<void>
 */
async function onClientJoinChannel(ws: IWebSocket, loggedInUser: User, request: ChannelJoinRequest): Promise<void> {
  // Load requested channel from database:
  const channel = (
    await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === request.channel_id).results()
  )[0];

  if (!channel) {
    // Channel does not exist, cannot join a channel that doesn't exist
    handleChannelJoinRefused(ws, request.channel_id, 404);
    return;
  }

  const user = (await new Query(Table.USERS).filter(({ email_ID }) => email_ID === loggedInUser.id).results())[0];
  if (!user || user.channels.includes(channel.channel_ID)) {
    // User is attempting to join a channel he is already a part of.
    handleChannelJoinRefused(ws, request.channel_id, 405);
    return;
  }

  switch (channel.type) {
    case 'public':
      // User is free to join any public channel:
      await handleChannelJoinPublic(ws, user, channel);
      break;

    case 'private':
      // User must have an invite to join a private channel:
      await handleChannelJoinPrivate(ws, user, channel);
      break;

    case 'direct_message':
      // User can join on the condition that channel has not more than 2 users:
      await handleChannelJoinDirectMessage(ws, user, channel);
      break;

    case 'private_encrypted':
      // User must have an invite to join a private encrypted channel:
      await handleChannelJoinPrivateEncrypted(ws, user, channel);
      break;

    case 'direct_message_encrypted':
      // User must have an invite to join a private encrypted channel and the channel can have max 2 users:
      await handleChannelJoinDirectMessageEncrypted(ws, user, channel);
      break;
  }
}

/**
 * Case for when user tries joining a channel of type public, without E2EE.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, UserEntry instance
 * @param channel - Channel to join, some error checking already happened previously
 * @returns Promise<void>
 */
async function handleChannelJoinPublic(ws: IWebSocket, loggedInUser: UserEntry, channel: ChannelEntry): Promise<void> {
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.email_ID)
    .update((entry) => entry.channels.push(channel.channel_ID));

  // Send ChannelJoinCompleted command:
  handleChannelJoinCompleted(ws, channel);
}

/**
 * Case for when user tries joining a channel of type private, without E2EE. Will first check if user can join
 * the private channel by looking at invites array.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param channel - Channel to join, some error checking already happened previously
 * @returns Promise<void>
 */
async function handleChannelJoinPrivate(ws: IWebSocket, loggedInUser: UserEntry, channel: ChannelEntry): Promise<void> {
  // First check if loggedInUser has permissions to join private channel
  if (!loggedInUser.channel_invites.some(({ channel_ID }) => channel_ID === channel.channel_ID)) {
    handleChannelJoinRefused(ws, channel.channel_ID, 408, 'User has no invites for this private channel');
    return;
  }

  // Now we update the database
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.email_ID)
    .update((entry) => {
      entry.channels.push(channel.channel_ID);
      entry.channel_invites = entry.channel_invites.filter(({ channel_ID }) => channel_ID !== channel.channel_ID);
    });

  // Notify user of success
  handleChannelJoinCompleted(ws, channel);
}

/**
 * Case for when user tries joining a channel of type direct message, without E2EE. Will first check if user can join
 * the direct message channel by applying rule of maximum 2 users being able to join. And users who attempt to
 * join must also have an invite.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param channel - Channel to join, some error checking already happened previously
 * @returns Promise<void>
 */
async function handleChannelJoinDirectMessage(
  ws: IWebSocket,
  loggedInUser: UserEntry,
  channel: ChannelEntry,
): Promise<void> {
  // First check if loggedInUser has permissions to join the direct message channel
  if (!loggedInUser.channel_invites.some(({ channel_ID }) => channel_ID === channel.channel_ID)) {
    handleChannelJoinRefused(ws, channel.channel_ID, 409, 'User has no invites for this direct message channel');
    return;
  }

  // Query users and give .result() for ones part of channel having "channel_id". If greater or equal to two, abort
  const participatingUsers = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(channel.channel_ID))
    .results();
  if (participatingUsers.length >= 2) {
    handleChannelJoinRefused(ws, channel.channel_ID, 410, 'Direct message channel already has 2 users');
    return;
  }

  // Now we update the database
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.email_ID)
    .update((entry) => {
      entry.channels.push(channel.channel_ID);
      entry.channel_invites = entry.channel_invites.filter(({ channel_ID }) => channel_ID !== channel.channel_ID);
    });

  // Notify user of success
  handleChannelJoinCompleted(ws, channel);
}

/**
 * Case for when user tries joining a channel of type private, with E2EE. Will first check if user can join
 * the private channel by looking at invites array. Afterwards a secure connection
 * will be established.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param channel - Channel to join, some error checking already happened previously
 * @returns Promise<void>
 */
async function handleChannelJoinPrivateEncrypted(
  ws: IWebSocket,
  loggedInUser: UserEntry,
  channel: ChannelEntry,
): Promise<void> {
  const invite = loggedInUser.channel_invites.find(({ channel_ID }) => channel_ID === channel.channel_ID);
  if (!invite) {
    handleChannelJoinRefused(ws, channel.channel_ID, 408, 'User has no invites for this encrypted channel');
    return;
  }

  if (!invite.encrypted_secret) {
    handleChannelJoinRefused(ws, channel.channel_ID, 411, 'Invite to encrypted channel is missing encrypted secret');
    return;
  }

  const inviteSender = (
    await new Query(Table.USERS).filter(({ email_ID }) => email_ID === invite.sender_ID).results()
  )[0];

  if (!inviteSender || !inviteSender.public_key) {
    handleChannelJoinRefused(
      ws,
      channel.channel_ID,
      412,
      `The user that sent the invite doesn't have their public key published`,
    );
    return;
  }

  // Now we update the database
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.email_ID)
    .update((entry) => {
      entry.channels.push(channel.channel_ID);
      entry.channel_invites = entry.channel_invites.filter(({ channel_ID }) => channel_ID !== channel.channel_ID);
    });

  // Notify user of success
  handleChannelJoinCompleted(ws, channel, invite.encrypted_secret, inviteSender.public_key);
}

/**
 * Case for when user tries joining a channel of type direct message, with E2EE. Will first check if user can join
 * the direct message channel by applying rule of maximum 2 users being able to join. Afterwards a secure connection
 * will be established.
 *
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param channel - Channel to join, some error checking already happened previously
 * @returns Promise<void>
 */
async function handleChannelJoinDirectMessageEncrypted(
  ws: IWebSocket,
  loggedInUser: UserEntry,
  channel: ChannelEntry,
): Promise<void> {
  const invite = loggedInUser.channel_invites.find(({ channel_ID }) => channel_ID === channel.channel_ID);
  if (!invite) {
    handleChannelJoinRefused(ws, channel.channel_ID, 409, 'User has no invites for this direct message channel');
    return;
  }

  // Query users and give .result() for ones part of channel having "channel_id". If greater or equal to two, abort
  const participatingUsers = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(channel.channel_ID))
    .results();
  if (participatingUsers.length >= 2) {
    handleChannelJoinRefused(ws, channel.channel_ID, 410, 'Direct message channel already has 2 users');
    return;
  }

  if (!invite.encrypted_secret) {
    handleChannelJoinRefused(ws, channel.channel_ID, 411, 'Invite to encrypted channel is missing encrypted secret');
    return;
  }

  const inviteSender = (
    await new Query(Table.USERS).filter(({ email_ID }) => email_ID === invite.sender_ID).results()
  )[0];

  if (!inviteSender || !inviteSender.public_key) {
    handleChannelJoinRefused(
      ws,
      channel.channel_ID,
      412,
      `The user that sent the invite doesn't have their public key published`,
    );
    return;
  }

  // Now we update the database
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.email_ID)
    .update((entry) => {
      entry.channels.push(channel.channel_ID);
      entry.channel_invites = entry.channel_invites.filter(({ channel_ID }) => channel_ID !== channel.channel_ID);
    });

  // Notify user of success
  handleChannelJoinCompleted(ws, channel, invite.encrypted_secret, inviteSender.public_key);
}

/**
 * Sends a ChannelJoinRefused containing the given error
 *
 * @param ws - The websocket to send the error to
 * @param channel_id - The id of the channel hte user tried to join
 * @param error_code - The error code of the error
 * @param reason - The reason of the error
 * @returns void
 */
function handleChannelJoinRefused(
  ws: IWebSocket,
  channel_id: ChannelId,
  error_code: number,
  reason?: string | undefined,
): void {
  debug(`Joining channel failed, refuse command has been sent and database remains unchanged. Error ${error_code}`);
  sendToClient(ws, {
    command: 'channel_join_refused',
    data: {
      channel_id,
      error_code,
      reason,
    },
  });
}

/**
 * Sends a ChannelJoinSuccessCommand
 *
 * @param ws - The websocket to send the command to
 * @param channel_id - The id of the channel the user joined
 * @returns void
 */
function handleChannelJoinCompleted(
  ws: IWebSocket,
  channel: ChannelEntry,
  encrypted_secret?: string,
  peer_public_key?: string,
): void {
  debug(`Joining channel was success, success command has been sent and database changed.`);
  sendToClient(ws, {
    command: 'channel_join_completed',
    data: {
      channel: {
        name: channel.name,
        id: channel.channel_ID,
        type: channel.type,
      },
      encrypted_secret,
      peer_public_key,
    },
  });
}

/**
 * Function handles case 'channel_leave_request' for IWebServer.
 * Will refuse to leave a channel if it tries to leave a non-existing channel,
 * or if it tries to leave a channel the user is not a part of.
 * Upon succesful completion of the leave request, UserEntry of database will be
 * updated so its channels field no longer contain channel it left.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param request - Information about the join channel request, Channel instance
 * @param loggedInClients - Information about the logged in users and their corresponding websocket
 * @returns Promise<void>
 */
async function onClientLeaveChannel(
  ws: IWebSocket,
  loggedInUser: User,
  request: ChannelLeaveRequest,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  // Load requested channel from database:
  const channel = (
    await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === request.channel_id).results()
  )[0];

  // If channel does not exist, it is impossible to leave it. Return channel leave refused command:
  if (!channel) {
    // User is attempting to leave a channel that does not exist.
    handleChannelLeaveRefused(ws, request.channel_id, 404);
    return;
  }

  // Check now if the user is a member of the channel he is trying to leave:
  const user = (await new Query(Table.USERS).filter(({ email_ID }) => email_ID === loggedInUser.id).results())[0];

  if (!user || !user.channels.includes(channel.channel_ID)) {
    handleChannelLeaveRefused(ws, request.channel_id, 407);
    return;
  }

  // Update DB for user:
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.id)
    .update((entry) => {
      // Remove the element with the specified channel ID
      entry.channels = entry.channels.filter((channelID) => channelID !== channel.channel_ID);
    });

  // Send leave confirmed command:
  const response: ChannelLeaveCompleted = {
    channel: { name: channel.name, id: channel.channel_ID, type: channel.type },
  };
  sendToClient(ws, { command: 'channel_leave_completed', data: response });
  debug('Leaving channel was succesful, database is updated.');

  if (response.channel.type === 'public') {
    await BroadcastHandler.broadcastChannels(loggedInClients);
  }
}

/**
 * Sends a ChannelJoinRefused containing the given error
 *
 * @param ws - The websocket to send the error to
 * @param channel_id - The id of the channel thee user tried to leave
 * @param error_code - The error code of the error
 * @param reason - The reason of the error
 * @returns void
 */
function handleChannelLeaveRefused(
  ws: IWebSocket,
  channel_id: ChannelId,
  error_code: number,
  reason?: string | undefined,
): void {
  debug(`Leaving channel failed, refuse command has been sent and database remains unchanged. Error ${error_code}`);
  sendToClient(ws, {
    command: 'channel_leave_refused',
    data: {
      channel_id,
      error_code,
      reason,
    },
  });
}
