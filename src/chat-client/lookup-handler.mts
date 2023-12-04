import Debug from 'debug';
import type { LookupError, LookupResult } from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { DateTime } from 'luxon';
import type { Channel } from '../protocol/proto.mjs';

const debug = Debug('chatter:lookup-handler');

export const LookupHandler = {
  lookupMessage,
  onLookupResult,
  onLookupError,
};

/**
 * Function which sends time for which to look up the closest message to the server
 *
 * @param ws - websocket which is used to send and receive messages
 * @param time - date & time for which to search closest message
 * @param channel - channel in which to search for the message
 */
function lookupMessage(ws: IWebSocket, time: string, channel: Channel | undefined) {
  if (channel) {
    const parsedDate = DateTime.fromFormat(time, 'HH:mm dd-MM-yyyy');
    if (parsedDate.isValid) {
      ws.send(
        JSON.stringify({
          command: 'lookup_request',
          data: { time: parsedDate.toUTC().toISO(), channel_id: channel.id },
        }),
      );
    } else {
      console.error('Invalid date format. Please use the format "HH:mm dd-MM-yyyy"');
    }
  } else {
    console.error('Enter a channel to perform a message lookup');
  }
}

/**
 * Displays received messages to user after the user did the lookup command
 *
 * @param result - LookupResult instance that contains a list of messages and the index of the closest message to the time given in the lookup command
 */
function onLookupResult(result: LookupResult) {
  console.log('Lookup result');
  console.log('----------------------');
  for (const [index, message] of result.messages.entries()) {
    const sender: string = message.sender.username === undefined ? message.sender.id : message.sender.username;
    let time = '';
    if (message.time instanceof DateTime) {
      time = message.time.toLocal().toFormat('yyyy-MM-dd HH:mm:ss');
    } else {
      time = DateTime.fromISO(message.time, { setZone: true }).toLocal().toFormat('yyyy-MM-dd HH:mm:ss');
    }
    if (index === result.resultIndex) {
      console.log(`>>> ${time} ${sender}: ${message.msg}`);
    } else {
      console.log(`${time} ${sender}: ${message.msg}`);
    }
  }
  console.log('----------------------');
}

/**
 * Handles the error when a lookup request fails
 *
 * @param data - contains the error code and error reason for the lookup request fail
 */
function onLookupError(data: LookupError) {
  debug(`Lookup error: ${data.error_code} - ${data.reason}`);
  console.error(data.reason);
}
