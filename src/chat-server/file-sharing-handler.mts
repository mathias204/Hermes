import type {
  OutgoingEncodedFile,
  User,
  FileEncodingErrorCommand,
  IncomingEncodedFileCommand,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import Debug from 'debug';

const debug = Debug('chatter:ChatServer-file-sharing-handler');

/**
 * Handles an OutgoingEncodedFile command
 * Sends an IncomingEncodedFile to all connect clients with access to thegiven channel
 * Sends a FileEncodingErrorCommand to the sender if something went wrong
 *
 * @param ws Websocket which sent the request
 * @param sender User who is connected with the websocket
 * @param loggedInClients A hashmap of the currently signed in users
 * @param request OutgoingEncodedFile request containing a channel id and an encoded file
 * @returns
 */
export async function onOutgoingEncodedFile(
  ws: IWebSocket,
  sender: User,
  loggedInClients: Map<IWebSocket, User>,
  request: OutgoingEncodedFile,
) {
  const channel = await new Query(Table.CHANNELS)
    .filter(({ channel_ID }) => channel_ID === request.channel_id)
    .results();

  if (channel.length === 0) {
    handleFileSharingError(ws, 404, `Channel with ID '${request.channel_id}' not found`);
    return;
  }

  const usersInChannel = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(request.channel_id))
    .results();
  if (!usersInChannel.some(({ email_ID }) => email_ID === sender.id)) {
    handleFileSharingError(ws, 405, "You don't have access to this channel");
    return;
  }

  Array.from(loggedInClients)
    .filter(([receivingWs, _]) => receivingWs.isAlive)
    .filter(([_, { id }]) => {
      return usersInChannel.some(({ email_ID }) => email_ID === id);
    })
    .forEach(([receivingWs, _]) => {
      receivingWs.send(
        JSON.stringify({
          command: 'incoming_encoded_file',
          data: {
            user: sender,
            ...request,
          },
        } as IncomingEncodedFileCommand),
      );
    });
}

/**
 * Sends a file encoding error contain the given error
 *
 * @param ws The websocket to send the error to
 * @param error_code The error code of the error
 * @param reason The reason of the error
 */
function handleFileSharingError(ws: IWebSocket, error_code: number, reason: string) {
  debug(`Lookup error: ${error_code} - ${reason}`);
  ws.send(
    JSON.stringify({
      command: 'file_encoding_error',
      data: {
        error_code,
        reason,
      },
    } as FileEncodingErrorCommand),
  );
}
