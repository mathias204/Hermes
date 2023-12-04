import type { IncomingMessage, LookupErrorCommand, LookupRequest, LookupResult, User } from '../protocol/proto.mjs';
import type { MessageEntry, UserEntry } from '../database/database-interfaces.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { DateTime } from 'luxon';
import Debug from 'debug';

const debug = Debug('chatter:ChatServer-lookup-handler');

/**
 * Handles a lookup request
 * Sends a LookupResult if the request succeeded
 * Sends a LookupError if something went wrong
 *
 * @param ws Websocket which sent the request
 * @param user User who is connected with the websocket
 * @param request LookupRequest data containing a timestamp and a channel id
 */
export async function onLookupRequest(ws: IWebSocket, user: User, request: LookupRequest) {
  const channels = await new Query(Table.CHANNELS)
    .filter(({ channel_ID }) => request.channel_id === channel_ID)
    .results();

  if (channels.length === 0) {
    handleLookupError(ws, 404, `Channel with ID ${request.channel_id} not found`);
    return;
  }

  const users = await new Query(Table.USERS).results();

  if (users.some(({ email_ID, channels }) => user.id === email_ID && !channels.includes(request.channel_id))) {
    handleLookupError(ws, 405, "You don't have access to this channel");
    return;
  }

  const messages: MessageEntry[] = await new Query(Table.MESSAGES)
    .filter(({ channel_ID }) => channel_ID === request.channel_id)
    .results();

  if (messages.length === 0) {
    handleLookupError(ws, 204, 'No messages found in the requested channel');
    return;
  }

  const index = lookup(messages, request.time as DateTime);

  ws.send(
    JSON.stringify({
      command: 'lookup_result',
      data: getMessagesAroundIndex(messages, users, index, 5),
    }),
  );
}

/**
 * Collects the n messages before and after around the given index as a LookupResult
 *
 * @param messageEntries The message entries from the current channel
 * @param users All users in the database
 * @param index The index of the actual match with the messages parameter
 * @param n The amount of message to collect before and after the actual match
 * @returns A LookupResult containing the messages and the index of the actual match within these messages
 */
export function getMessagesAroundIndex(
  messageEntries: MessageEntry[],
  users: UserEntry[],
  index: number,
  n: number,
): LookupResult {
  const startIndex = Math.max(0, index - n);
  const endIndex = index + n;
  const resultIndex = index - startIndex;

  const messages: IncomingMessage[] = messageEntries.slice(startIndex, endIndex).map((msg) => ({
    sender: {
      id: msg.sender_ID,
      username: users.find(({ email_ID }) => msg.sender_ID === email_ID)?.user_name || undefined,
    },
    msg: msg.message,
    channel: msg.channel_ID,
    time: msg.sent_at_utc_timestamp,
  }));

  return {
    messages,
    resultIndex,
  };
}

/**
 * Looks for the message which was sent closest to the given time and returns its index
 *
 * @param messages The messages to search through
 * @param time The timestamp to look for
 * @returns Index of the closest match
 */
function lookup(messages: MessageEntry[], time: DateTime): number {
  const index = binarySearch(messages, time);
  if (index === messages.length - 1) {
    return index;
  }

  const diff1 = Math.abs(compare(DateTime.fromISO(messages[index]?.sent_at_utc_timestamp as string), time));
  const diff2 = Math.abs(compare(DateTime.fromISO(messages[index + 1]?.sent_at_utc_timestamp as string), time));
  if (diff1 > diff2) {
    return index + 1;
  } else {
    return index;
  }
}

/**
 * Calculates the difference in milliseconds between two given times
 *
 * @param time1 The first time to compare
 * @param time2 The second time to compare
 * @returns The difference in milliseconds between the given times
 */
function compare(time1: DateTime, time2: DateTime): number {
  return time1.diff(time2).toMillis();
}

/**
 * A search algorithm which performs binary search on the messages to the message which was send last before the given time
 *
 * @param messages A sorted array of messages
 * @param time The time to look for
 * @returns The index of the message which was last send before the given time
 */
function binarySearch(messages: MessageEntry[], time: DateTime): number {
  let min = 0;
  let max = messages.length - 1;

  while (min < max) {
    const mid = Math.ceil((min + max) / 2);
    const message = messages[mid];
    if (message) {
      const diff = compare(DateTime.fromISO(message.sent_at_utc_timestamp), time);
      if (diff < 0) {
        min = mid + 1;
      } else if (diff > 0) {
        max = mid - 1;
      } else {
        return mid;
      }
    } else {
      throw new Error(`Binary search: Message at index [${mid}] is undefined or null (Shouldn't be able to occur)`);
    }
  }

  return Math.min(min, max);
}

/**
 * Sends a Lookup error contain the given error
 *
 * @param ws The websocket to send the error to
 * @param error_code The error code of the error
 * @param reason The reason of the error
 */
function handleLookupError(ws: IWebSocket, error_code: number, reason: string) {
  debug(`Lookup error: ${error_code} - ${reason}`);
  ws.send(
    JSON.stringify({
      command: 'lookup_error',
      data: {
        error_code,
        reason,
      },
    } as LookupErrorCommand),
  );
}
