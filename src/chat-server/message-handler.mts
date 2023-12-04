import type {
  IncomingMessage,
  MessageHistoryErrorCommand,
  MessageHistoryResponse,
  MessageHistoryResponseCommand,
  MessageReceivedCommand,
  MessageSendingErrorCommand,
  OutgoingMessage,
  RequestMessageHistory,
  User,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { DateTime } from 'luxon';
import type { MessageEntry } from '../database/database-interfaces.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { randomUUID } from 'node:crypto';
import Debug from 'debug';

const MAX_INSERTION_ATTEMPTS = 3;
const debug = Debug('chatter:ChatServer-message-handler');

/**
 * Function handles case 'send_message' for IWebServer.
 * Function inserts message into the database, upon succesful completion of this task it
 * notifies relevant clients via their websockets. These relevant clients are all clients
 * that are logged in and a member of target channel.
 *
 * @param ws Websocket which sent the message.
 * @param message Message object received from client.
 * @param sender User object of the sender
 * @param loggedInClients All clients currently logged in.
 * @returns Promise<void>
 */
export async function onClientMessage(
  ws: IWebSocket,
  message: OutgoingMessage,
  sender: User,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  debug('Server received request to handle new message for user %s.', sender.id);

  const channel = await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === message.channel).results();

  if (channel.length === 0) {
    handleMessageSendingError(ws, 404, `Channel with ID '${message.channel}' not found`);
    return;
  }

  const usersInChannel = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(message.channel))
    .results();
  if (!usersInChannel.some(({ email_ID }) => email_ID === sender.id)) {
    handleMessageSendingError(ws, 405, "You don't have access to this channel");
    return;
  }

  const time = DateTime.utc().toISO() as string;
  const msgID = randomUUID();

  const messageEntry: MessageEntry = {
    message_ID: msgID,
    sender_ID: sender.id,
    channel_ID: message.channel,
    sent_at_utc_timestamp: time,
    message: message.msg,
  };

  let inserted = false;
  let attempts = 0;

  while (!inserted) {
    try {
      await new Query(Table.MESSAGES).insert(messageEntry);
      inserted = true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Primary ID already exists.' &&
        attempts < MAX_INSERTION_ATTEMPTS
      ) {
        attempts++;
        debug(`Failed to insert message, trying again with new ID [attempt ${attempts}/${MAX_INSERTION_ATTEMPTS}]`);
        messageEntry.message_ID = randomUUID();
      } else {
        handleMessageSendingError(ws, 500, 'Failed to insert message into database');
        return;
      }
    }
  }

  Array.from(loggedInClients)
    .filter(([receivingWs, _]) => receivingWs.isAlive)
    .filter(([_, { id }]) => {
      return usersInChannel.some(({ email_ID }) => email_ID === id);
    })
    .forEach(([receivingWs, _]) => {
      receivingWs.send(
        JSON.stringify({
          command: 'message_received',
          data: {
            sender,
            time,
            ...message,
          },
        } as MessageReceivedCommand),
      );
    });
}

/**
 * Returns the user with a history of messages sent in a specified channel.
 * Can return an error if the user is attempting to access a channel he is not part of,
 * or if the channel does not exist.
 *
 * @param ws IWebSocket instance a response is sent to.
 * @param user User attempting to retrieve message history of a channel
 * @param request Request received from client, contains channel ID and amount of messages to load.
 * @returns Promise<void>
 */
export async function messageHistory(ws: IWebSocket, user: User, request: RequestMessageHistory): Promise<void> {
  const channels = await new Query(Table.CHANNELS)
    .filter(({ channel_ID }) => channel_ID === request.channel_id)
    .results();

  if (channels.length === 0) {
    handleMessageHistoryError(ws, 404, 'Channel user attempts to retrieve history from does not exist.');
    debug('Retrieving message history failed, channel does not exist.');
    return;
  }

  const usersDB = await new Query(Table.USERS).results();
  const userWithId = usersDB.find(({ email_ID }) => email_ID === user.id);
  const hasAccess: boolean = userWithId?.channels.includes(request.channel_id) || false;

  if (!hasAccess) {
    handleMessageHistoryError(ws, 405, 'User has no access to this channel and thus neither its message history.');
    debug('Retrieving message history failed, user has no access to channel.');
    return;
  } else {
    let messagesDB = await new Query(Table.MESSAGES)
      .filter(({ channel_ID }) => channel_ID === request.channel_id)
      .results();

    messagesDB = messagesDB.slice(-request.amount);

    const messages: IncomingMessage[] = [];
    for (const messageEntry of messagesDB) {
      const messageDBChannel = messageEntry.channel_ID;
      const messageDBTime = messageEntry.sent_at_utc_timestamp;
      const messageDBMessage = messageEntry.message;

      const messageDBSentByID = messageEntry.sender_ID;
      const messageDBSentByName = usersDB.find((user) => user.email_ID === messageDBSentByID)?.user_name;

      messages.push({
        sender: { id: messageDBSentByID, username: messageDBSentByName },
        msg: messageDBMessage,
        channel: messageDBChannel,
        time: messageDBTime,
      });
    }

    const response: MessageHistoryResponse = {
      channel_id: request.channel_id,
      messages: messages,
    };

    ws.send(JSON.stringify({ command: 'message_history_response', data: response } as MessageHistoryResponseCommand));
    debug('Retrieving message history succesful for given channel and user.');
    return;
  }
}

/**
 * Sends a MessageSendingError containing the given error
 *
 * @param ws The websocket to send the error to
 * @param error_code The error code of the error
 * @param reason The reason of the error
 */
function handleMessageSendingError(ws: IWebSocket, error_code: number, reason: string) {
  debug(`Lookup error: ${error_code} - ${reason}`);
  ws.send(
    JSON.stringify({
      command: 'message_sending_error',
      data: {
        error_code,
        reason,
      },
    } as MessageSendingErrorCommand),
  );
}

/**
 * Sends a MessageSendingError containing the given error
 *
 * @param ws The websocket to send the error to
 * @param error_code The error code of the error
 * @param reason The reason of the error
 */
function handleMessageHistoryError(ws: IWebSocket, error_code: number, reason: string) {
  debug(`Lookup error: ${error_code} - ${reason}`);
  ws.send(
    JSON.stringify({
      command: 'message_history_error',
      data: {
        error_code,
        reason,
      },
    } as MessageHistoryErrorCommand),
  );
}
