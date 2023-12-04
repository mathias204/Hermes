import type { IWebSocket } from '../protocol/ws-interface.mjs';
import Debug from 'debug';
import type {
  Channel,
  ChannelJoinRefused,
  ChannelJoinCompleted,
  ChannelLeaveRefused,
  ChannelLeaveCompleted,
  ChannelCreateRefused,
  ChannelCreateCompleted,
  ChannelList,
  ChannelCreateRequestCommand,
  RequestMessageHistory,
  RequestMessageHistoryCommand,
  MessageHistoryResponse,
} from '../protocol/proto.mjs';
import { rl } from './chat-client.mjs';
import { DateTime } from 'luxon';
import { clearLine, moveCursor } from 'readline';

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
};

const debug = Debug('chatter:channels');

/**
 * Function which handles a channel_join_refused from the server, this function does not print to console
 *
 * @param data - data which is received from the server
 */
function onChannelJoinRefused(data: ChannelJoinRefused) {
  debug('onChannelJoinRefused received');
  const error_code = data.error_code;
  switch (error_code) {
    case 404:
      console.log(`Channel '${data.channel.name}' does not exist`);
      break;
    case 405:
      console.log(`You are already in channel '${data.channel.name}'`);
      break;
    default:
      console.error(`Unknown error code ${error_code} received with message '${data.reason}'`);
      break;
  }
  return;
}

/**
 * Function which handles a channel_create_completed from the server, this function does not print to console
 *
 * @param data - data which is received from the server
 * @param ws - websocket which is used to send and receive messages
 * @returns the channel which was joined
 */
export function onChannelJoinCompleted(data: ChannelJoinCompleted, ws: IWebSocket): Channel {
  rl.setPrompt(`[${data.channel.name}] > `);
  ws.send(
    JSON.stringify({
      command: 'request_message_history',
      data: { channel_id: data.channel.id, amount: 10 } as RequestMessageHistory,
    } as RequestMessageHistoryCommand),
  );
  return data.channel;
}

/**
 * Function which handles a channel_leave_refused from the server, this function does not print to console
 *
 * @param data - data which is received from the server
 */
function onChannelLeaveRefused(data: ChannelLeaveRefused) {
  debug('onChannelLeaveRefused received');
  const error_code = data.error_code;
  console.error(`unknown error code ${error_code} received with message '${data.reason}'`);
  return;
}

/**
 * Function which handles a channel_create_completed from the server, this function does not print to console
 *
 * @param data - data which is received from the server
 * @param channelList - the current channel list of all the channels
 * @returns the new channel list
 */
function onChannelLeaveCompleted(data: ChannelLeaveCompleted, channelList: ChannelList): ChannelList {
  debug('onChannelLeaveCompleted received');
  const newChannels = channelList.channels.filter((channel) => channel.id !== data.channel.id);
  channelList.channels = newChannels;
  return channelList;
}

/**
 * Function which handles a channel_create_completed from the server, this function does not print to console
 * @param data - data which is received from the server
 */
function onChannelCreateRefused(data: ChannelCreateRefused) {
  debug('onChannelCreateRefused received');
  const error_code = data.error_code;
  console.error(`unknown error code ${error_code} received with message '${data.reason}'`);
}

/**
 * Function which handles a channel_create_completed from the server, add the channel to the channel list
 *
 * @param data - data which is received from the server
 * @param channelList - the current channel list of all the channels
 * @returns a tuple with the new channel and the new channel list
 */
function onChannelCreateCompleted(data: ChannelCreateCompleted, channelList: ChannelList): [Channel, ChannelList] {
  debug('onChannelCreateCompleted received');
  channelList.channels.push(data.channel);
  return [data.channel, channelList];
}

/**
 * Processes a create command from the user, creating the channel it prompted for.
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 * @param allChannels - all channels which are available
 */
function onCreate(ws: IWebSocket, args: string[], allChannels: ChannelList) {
  debug('onCreate received');
  const channelName = args[0];
  if (!channelName) {
    console.log('No channel name provided');
    return;
  }
  if (allChannels.channels.find((channel) => channel.name === channelName)) {
    console.log('Channel already exists');
    return;
  }

  ws.send(
    JSON.stringify({
      command: 'channel_create_request',
      data: {
        name: channelName,
      },
    } as ChannelCreateRequestCommand),
  );
  rl.setPrompt(`[${channelName}] > `);
}

/**
 * Processes a open command from the user, opening the channel it prompted for.
 *
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 * @param allChannels - all channels which are available
 * @param connectedChannels - all channels which the client is connected to
 * @param currentChannel - the current channel which is open
 * @returns the new current channel
 */
function onOpen(
  ws: IWebSocket,
  args: string[],
  allChannels: ChannelList,
  connectedChannels: ChannelList,
  currentChannel: Channel | undefined,
): Channel | undefined {
  debug('onOpen received');
  const channelName = args[0];
  if (!channelName) {
    console.log('No channel name provided');
    return currentChannel;
  }
  if (currentChannel?.name === channelName) {
    console.log('You are already in this channel');
    return currentChannel;
  }
  const channel = allChannels.channels.find((channel) => channel.name === channelName);
  if (!allChannels.channels.find((channel) => channel.name === channelName)) {
    console.log('Channel does not exist');
    return currentChannel;
  }
  const channelConnected = connectedChannels.channels.find((channel) => channel.name === channelName);
  if (channelConnected) {
    console.log(`Opened channel '${channelName}'`);
    rl.setPrompt(`[${channelName}] > `);

    const request: RequestMessageHistory = {
      channel_id: channelConnected.id,
      amount: 10,
    };
    ws.send(
      JSON.stringify({
        command: 'request_message_history',
        data: request,
      } as RequestMessageHistoryCommand),
    );
    return channel;
  } else {
    ws.send(
      JSON.stringify({
        command: 'channel_join_request',
        data: {
          channel: channel,
        },
      }),
    );
    console.log(`Opened channel '${channelName}'`);
    rl.setPrompt(`[${channelName}] > `);
    return channel;
  }
}

/**
 * Processes a close command from the user, closing the current channel.
 *
 * @param currentChannel - the current channel which is open
 * @returns - the new current channel
 */
function onClose(currentChannel: Channel | undefined): undefined {
  debug('onClose received');
  if (!currentChannel) {
    console.log('You are not in a channel');
    return;
  }
  rl.setPrompt('> ');
  return undefined;
}

/**
 * Prints the message history to the console for the users to read
 *
 * @param data - MessageHistoryResponse which holds the channel_id and messages
 */
function onMessageHistoryResponse(data: MessageHistoryResponse) {
  clearLine(process.stdout, 0);
  moveCursor(process.stdout, -1000, 0);
  console.log(`The last ${data.messages.length} message(s) in this channel is/are:`);
  data.messages.forEach((message) => {
    let timeString: string;
    if (message.time instanceof DateTime) {
      timeString = message.time.toLocal().toFormat('yyyy-MM-dd HH:mm');
    } else {
      timeString = DateTime.fromISO(message.time, { setZone: true }).toLocal().toFormat('yyyy-MM-dd HH:mm');
    }
    const senderName = message.sender.username || message.sender.id;
    console.log(`${senderName} at ${timeString}: ${message.msg}`);
  });
  rl.prompt();
}
