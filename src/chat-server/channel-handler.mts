import type { UserEntry } from '../database/database-interfaces.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import type {
  Channel,
  ChannelCreateCompleted,
  ChannelCreateCompletedCommand,
  ChannelCreateRequest,
  ChannelJoinCompleted,
  ChannelJoinCompletedCommand,
  ChannelJoinRefused,
  ChannelJoinRefusedCommand,
  ChannelJoinRequest,
  ChannelLeaveCompleted,
  ChannelLeaveCompletedCommand,
  ChannelLeaveRefused,
  ChannelLeaveRefusedCommand,
  ChannelLeaveRequest,
  ChannelList,
  ChannelListCommand,
  User,
} from '../protocol/proto.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { randomUUID } from 'node:crypto';
import Debug from 'debug';

const debug = Debug('chatter:ChatServer-channel-handler');

/**
 * Function handles case 'channel_join_request' for IWebServer.
 * Will refuse joining channel if user is already part of that channel, or if the channel
 * does not exist.
 * After succesfully joining a channel database will be updated accordingly, UserEntry of database updated.
 *
 * @param ws | IWebSocket instance of logged in user
 * @param loggedInUser | Information about the sender, User instance
 * @param request | Information about the join channel request, Channel instance
 * @returns | void
 */
export async function onClientJoinChannel(
  ws: IWebSocket,
  loggedInUser: User,
  request: ChannelJoinRequest,
): Promise<void> {
  // Initialize parameters:
  const sender: User = loggedInUser;
  const channelIDToAdd: string = request.channel.id;
  const channelNameToAdd: string = request.channel.name;

  // Load existing channels from database:
  const channelsDB = await new Query(Table.CHANNELS).results();

  if (!channelsDB.some((channel) => channel.channel_ID === channelIDToAdd)) {
    // Channel does not exist, cannot join a channel that doesn't exist
    const response: ChannelJoinRefused = {
      user: sender,
      channel: { name: channelNameToAdd, id: channelIDToAdd },
      error_code: 404,
    };
    ws.send(JSON.stringify({ command: 'channel_join_refused', data: response } as ChannelJoinRefusedCommand));
    debug(
      'Joining channel failed, refuse command has been sent and database remains unchanged. Error 404. ID: %s, name: %s',
      channelIDToAdd,
      channelNameToAdd,
    );
    return;
  } else {
    const usersDB = await new Query(Table.USERS).results();
    if (usersDB.find((user) => user.email_ID === loggedInUser.id)?.channels.includes(channelIDToAdd)) {
      // User is attempting to join a channel he is already a part of.
      const response: ChannelJoinRefused = {
        user: sender,
        channel: { name: channelNameToAdd, id: channelIDToAdd },
        error_code: 405,
      };
      ws.send(JSON.stringify({ command: 'channel_join_refused', data: response } as ChannelJoinRefusedCommand));
      debug('Joining channel failed, refuse command has been sent and database remains unchanged. Error 405');
      return;
    }

    // Send ChannelJoinCompleted command:
    const response: ChannelJoinCompleted = {
      user: sender,
      channel: { name: channelNameToAdd, id: channelIDToAdd },
    };

    // Now update database:
    await new Query(Table.USERS)
      .filter(({ email_ID }) => email_ID === loggedInUser.id)
      .update((entry) => entry.channels.push(request.channel.id));
    debug('Joining channel was succesful, database is updated.');

    ws.send(JSON.stringify({ command: 'channel_join_completed', data: response } as ChannelJoinCompletedCommand));
    return;
  }
}

/**
 * Function handles case 'channel_create_request' for IWebServer.
 * Will refuse to create channel if there is already one in the database with same ID.
 * Upon succesful completion of the create request, UserEntry and ChannelEntry[] of database will
 * be updated to contain new channel.
 *
 * @param ws | IWebSocket instance of logged in user
 * @param loggedInUser | Information about the sender, User instance
 * @param request | Information about the join channel request, Channel instance
 * @returns | void
 */
export async function onClientCreateChannel(
  ws: IWebSocket,
  loggedInUser: User | undefined,
  request: ChannelCreateRequest,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  // Check if loggedInUser is undefined:
  if (!loggedInUser) {
    debug("Something went wrong that wasn't supposed to. User was undefined in this.loggedInClients?");
    return;
  }

  // Initialize parameters:
  const creatorID = loggedInUser.id;
  const creatorName = loggedInUser.username;
  const channelToAddName = request.name;

  // Update channels of database:
  const channelToAddID = randomUUID();
  await new Query(Table.CHANNELS).insert({ channel_ID: channelToAddID, name: channelToAddName });

  // Update user in database:
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.id)
    .update((entry) => entry.channels.push(channelToAddID));

  // Send ChannelCreateCompleted command over websocket:
  const response: ChannelCreateCompleted = {
    user: { id: creatorID, username: creatorName },
    channel: { name: channelToAddName, id: channelToAddID },
  };
  ws.send(JSON.stringify({ command: 'channel_create_completed', data: response } as ChannelCreateCompletedCommand));
  debug('Creating channel was succesful, database is updated.');

  // Notify relevant users of the update in the database:
  await broadcastChannels(undefined, loggedInClients);
  return;
}

/**
 * Function handles case 'channel_leave_request' for IWebServer.
 * Will refuse to leave a channel if it tries to leave a non-existing channel,
 * or if it tries to leave a channel the user is not a part of.
 * Upon succesful completion of the leave request, UserEntry of database will be
 * updated so its channels field no longer contain channel it left.
 *
 * @param ws | IWebSocket instance of logged in user
 * @param loggedInUser | Information about the sender, User instance
 * @param request | Information about the join channel request, Channel instance
 * @param loggedInClients | Information about the logged in users and their corresponding websocket
 * @returns | void
 */
export async function onClientLeaveChannel(
  ws: IWebSocket,
  loggedInUser: User | undefined,
  request: ChannelLeaveRequest,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  // Check if loggedInUser is undefined:
  if (!loggedInUser) {
    debug("Something went wrong that wasn't supposed to. User was undefined in this.loggedInClients?");
    return;
  }

  // Initialize parameters:
  const clientID = loggedInUser.id;
  const clientName = loggedInUser.username;
  const channelToLeaveID = request.channel.id;
  const channelToLeaveName = request.channel.name;

  // Load channels from database and check if there is already a channel with specified ID:
  const channelsDB = await new Query(Table.CHANNELS).results();
  const channelExists = channelsDB.some((channel) => channel.channel_ID === channelToLeaveID);

  // If channel does not exist, it is impossible to leave it. Return channel leave refused command:
  if (!channelExists) {
    // User is attempting to leave a channel that does not exist.
    const response: ChannelLeaveRefused = {
      user: { id: clientID, username: clientName },
      channel: { name: channelToLeaveName, id: channelToLeaveID },
      error_code: 404,
    };
    ws.send(JSON.stringify({ command: 'channel_leave_refused', data: response } as ChannelLeaveRefusedCommand));
    debug('Leaving channel failed, refuse command has been sent and database remains unchanged.');
    return;
  } else {
    // Check now if the user is a member of the channel he is trying to leave:
    const userDB = (
      await new Query(Table.USERS).filter(({ email_ID }) => email_ID === loggedInUser.id).results()
    )[0] as UserEntry | undefined;

    if (!userDB) {
      debug("Something went wrong that shouldn't have in leave channel handler. userDB undefined.");
      return;
    }

    if (userDB.channels.includes(channelToLeaveID)) {
      // Update DB for user:
      await new Query(Table.USERS)
        .filter(({ email_ID }) => email_ID === loggedInUser.id)
        .update((entry) => {
          // Remove the element with the specified channel ID
          entry.channels = entry.channels.filter((channelID) => channelID !== channelToLeaveID);
        });

      // Send leave confirmed command:
      const response: ChannelLeaveCompleted = {
        user: { id: clientID, username: clientName },
        channel: { name: channelToLeaveName, id: channelToLeaveID },
      };
      ws.send(JSON.stringify({ command: 'channel_leave_completed', data: response } as ChannelLeaveCompletedCommand));
      debug('Leaving channel was succesful, database is updated.');
      await broadcastChannels(undefined, loggedInClients);
      return;
    } else {
      // Send leave refused command:
      const response: ChannelLeaveRefused = {
        user: { id: clientID, username: clientName },
        channel: { name: channelToLeaveName, id: channelToLeaveID },
        error_code: 407,
      };
      ws.send(JSON.stringify({ command: 'channel_leave_refused', data: response } as ChannelLeaveRefusedCommand));
      debug('Leaving channel failed, refuse command has been sent and database remains unchanged.');
      return;
    }
  }
}

/**
 * Function sends a ChannelList item to socket, containing a list of all Channels in database.
 * If IWebSocket instance is specified, ChannelList is only sent to this socket.
 * Else every logged in client receives a ChannelList from his IWebSocket.
 *
 * @param ws | Optional IWebSocket parameter
 * @param loggedInClients | Optional information about logged in clients and their corresponding websocket
 * @returns | void
 */
export async function broadcastChannels(ws?: IWebSocket, loggedInClients?: Map<IWebSocket, User>): Promise<void> {
  const allChannelsDB = await new Query(Table.CHANNELS).results();
  const response: ChannelList = { channels: [] };

  // Retrieve all active channels from database.
  for (const channelDB of allChannelsDB) {
    const newChannel: Channel = {
      name: channelDB.name,
      id: channelDB.channel_ID,
    };
    response.channels.push(newChannel);
  }

  // Send channelList object to only one IWebSocket.
  // Often needed when user logs in or signs up.
  if (ws) {
    ws.send(JSON.stringify({ command: 'channel_list', data: response } as ChannelListCommand));

    // Send channelLit object to all connected IWebSockets.
    // Often needed when a new Channel is created/removed.
  } else if (loggedInClients) {
    for (const [webSocket] of loggedInClients.entries()) {
      webSocket.send(JSON.stringify({ command: 'channel_list', data: response } as ChannelListCommand));
    }
  } else {
    debug('An error has occured in broadcastChannels function call.');
  }
}
