import Debug from 'debug';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { sendToClient } from '../lib/communication/send.mjs';
import type {
  Channel,
  ChannelInvitesBroadcast,
  ChannelList,
  NewUserJoinedBroadcastTrigger,
  ParticipantsResponse,
  RequestParticipants,
  User,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';

// This code was previously in channel-handler.mts. In order to limit size of this
// handler, broadcast-handler.mts was created.

export const BroadcastHandler = {
  broadcastChannels,
  onUserOpenedChannelBroadcastTrigger,
  requestParticipants,
  onClientRequestsInvites,
};

const debug = Debug('chatter:ChatServer-broadcast-handler');

/**
 * Function sends a list of channelIDs, these are the current invites a user has. Server authenticates
 * users upon login, thus no extra verifications needed here. Broadcast can be sent directly.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 */
async function onClientRequestsInvites(ws: IWebSocket, loggedInUser: User): Promise<void> {
  const userDB = (await new Query(Table.USERS).filter(({ email_ID }) => email_ID === loggedInUser.id).results())[0];

  if (!userDB) {
    debug('Impossible error since user is authenticated.');
    return;
  }

  const toSendChannels = await new Query(Table.CHANNELS)
    .filter(({ channel_ID }) =>
      userDB.channel_invites.some(({ channel_ID: invite_channel_ID }) => invite_channel_ID === channel_ID),
    )
    .results();

  const inv: Channel[] = [];

  for (const item of toSendChannels) {
    const i: Channel = {
      name: item.name,
      id: item.channel_ID,
      type: item.type,
    };
    inv.push(i);
  }

  const response: ChannelInvitesBroadcast = {
    invites: inv,
  };

  sendToClient(ws, { command: 'channels_broadcast_incoming', data: response });
  debug('Retrieving invites succesful for given user.');
}

/**
 * Function sends a list of tuples each containing a user and his last seen time. This for all users
 * part of the requested channel.
 * Response is sent to user making request, user should have enough permissions to request this information.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param command - Information about the command, contains channelID
 * @returns Promise<void>
 */
async function requestParticipants(ws: IWebSocket, loggedInUser: User, command: RequestParticipants): Promise<void> {
  const requestedChannel = await new Query(Table.CHANNELS)
    .filter(({ channel_ID }) => channel_ID === command.channel_id)
    .results();

  if (requestedChannel.length === 0) {
    handleRequestParticipantsRefused(ws, 700, 'No such channel exists');
    return;
  }

  const participatingUsers = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(command.channel_id))
    .results();

  if (!participatingUsers.some(({ email_ID }) => email_ID === loggedInUser.id)) {
    handleRequestParticipantsRefused(ws, 701, "You don't have access to this channel");
    return;
  }

  const participants: [User, string][] = [];
  for (const userEntry of participatingUsers) {
    const id = userEntry.email_ID;
    const nick = userEntry.user_name;
    const last_seen = userEntry.last_seen_utc_timestamp;

    participants.push([
      {
        id: id,
        username: nick,
      },
      last_seen,
    ]);
  }

  const response: ParticipantsResponse = {
    channel_id: command.channel_id,
    participants: participants,
  };

  sendToClient(ws, { command: 'participants_response', data: response });
  debug('Retrieving participants succesful for given channel.');
  return;
}

/**
 * Sends a ParticipantsRefused containing the given error
 *
 * @param ws - The websocket to send the error to
 * @param channel_id - The id of the channel hte user tried to join
 * @param error_code - The error code of the error
 * @param reason - The reason of the error
 * @returns void
 */
function handleRequestParticipantsRefused(ws: IWebSocket, error_code: number, reason: string): void {
  debug(`Retrieving participants failed, refuse command has been sent. Error ${error_code}`);
  sendToClient(ws, {
    command: 'participants_error',
    data: {
      error_code,
      reason,
    },
  });
}

/**
 * Function sends a ChannelList item to socket, containing a list of all Channels in database it can join without an invite.
 * If IWebSocket instance is specified, ChannelList is only sent to this socket.
 * Else every logged in client receives a ChannelList from his IWebSocket.
 *
 * @param receiving - One IWebSocket instance or multiple instances.
 * @returns Promise<void>
 */
async function broadcastChannels(receiving: IWebSocket | Map<IWebSocket, User>): Promise<void> {
  const allChannelsDB = await new Query(Table.CHANNELS).filter(({ type }) => type === 'public').results();
  const response: ChannelList = { channels: [] };

  // Retrieve all active and public channels from database.
  for (const channelDB of allChannelsDB) {
    const newChannel: Channel = {
      name: channelDB.name,
      id: channelDB.channel_ID,
      type: channelDB.type,
    };
    response.channels.push(newChannel);
  }

  if (receiving instanceof Map) {
    // Send channelList object to all connected IWebSockets.
    // Often needed when a new Channel is created/removed.
    for (const webSocket of receiving.keys()) {
      sendToClient(webSocket, { command: 'channel_list', data: response });
    }
  } else {
    // Send channelList object to only one IWebSocket.
    // Often needed when user logs in or signs up.
    sendToClient(receiving, { command: 'channel_list', data: response });
  }
}

/**
 * Function sends a NewUserJoinedBroadcast item to all sockets, containing information about a new user that opened a channel.
 * Also enables client to see who currently has the channel open, agreement with client that it sends this command everytime a channel is open.
 *
 * @param ws - IWebSocket instance of logged in user
 * @param loggedInUser - Information about the sender, User instance
 * @param loggedInClients - Information about the logged in users and their corresponding websocket
 * @param request - Information about the channel the user opened in client, has Channel instance
 * @returns void
 */
async function onUserOpenedChannelBroadcastTrigger(
  ws: IWebSocket,
  loggedInUser: User,
  loggedInClients: Map<IWebSocket, User>,
  request: NewUserJoinedBroadcastTrigger,
  currentlyOpenChannels: Map<User, Channel>,
) {
  const usersInChannel = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(request.channel.id))
    .results();

  if (!usersInChannel.some(({ email_ID }) => email_ID === loggedInUser.id)) {
    return;
  }

  // Update currentlyOpen with loggedInUser and Channel:
  currentlyOpenChannels.set(loggedInUser, request.channel);

  // Check new field with request.channel to get users who currently have channel open:
  const activeUsersInChannel: User[] = Array.from(currentlyOpenChannels.entries())
    .filter(([_, channel]) => channel.id === request.channel.id)
    .map(([user, _]) => user);

  // Filter out clients not in the same channel:
  Array.from(loggedInClients)
    .filter(([receivingWs, user]) => {
      // Filter out the current WebSocket and check if the user is in the channel
      return receivingWs.isAlive && receivingWs !== ws && usersInChannel.some(({ email_ID }) => email_ID === user.id);
    })
    .forEach(([receivingWs, _]) => {
      sendToClient(receivingWs, {
        command: 'new_user_joined_broadcast',
        data: {
          user: loggedInUser,
          channel: {
            name: request.channel.name,
            id: request.channel.id,
            type: request.channel.type,
          },
          usersInChannel: activeUsersInChannel,
        },
      });
    });
}
