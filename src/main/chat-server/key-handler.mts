import Debug from 'debug';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { sendToClient } from '../lib/communication/send.mjs';
import type { PublicKeyRequest, UpdatePublicKey, User, UserId } from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';

export const KeyHandler = {
  onUpdatePublicKey,
  onPublicKeyRequest,
};

const debug = Debug('chatter:ChatServer-key-handler');

/**
 * Handles an incoming UpdatePublicKey.
 * Responds with an UpdatePublicKey refused if the sent key is not in the required PEM format.
 * Updates the key in the database if the key is in the requried format.
 *
 * @param ws - IWebSocket instance of user that sent the request
 * @param loggedInUser - The user that sent the request
 * @param request - UpdatePublicKey request
 * @returns Promise<void>
 */
async function onUpdatePublicKey(ws: IWebSocket, loggedInUser: User, request: UpdatePublicKey): Promise<void> {
  if (!request.public_key.match(/^-----BEGIN PUBLIC KEY-----\n.*\n-----END PUBLIC KEY-----\n$/)) {
    handleUpdatePublicKeyRefused(ws, 1000, 'The key is not in the required PEM format');
    debug('Update public key failed, the key is not in the required PEM format');
    return;
  }

  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === loggedInUser.id)
    .update((entry) => {
      entry.public_key = request.public_key;
    });
  debug(`Public key updated for ${loggedInUser.id}`);
}

/**
 * Sends an UpdatePublicKeyRefused containing the given error
 *
 * @param ws - The websocket to send the error to
 * @param error_code - The error code
 * @param reason - The reason of the error
 */
function handleUpdatePublicKeyRefused(ws: IWebSocket, error_code: number, reason: string) {
  sendToClient(ws, {
    command: 'update_public_key_refused',
    data: {
      error_code,
      reason,
    },
  });
}

/**
 * Handles an incoming PublicKeyRequest.
 * Responds with an PublicKeyRefused if the requested user does not have a key set up.
 * Otherwise responds with the users public key.
 *
 * @param ws - IWebSocket instance of user that sent the request
 * @param loggedInUser - The user that sent the request
 * @param request - UpdatePublicKey request
 * @returns Promise<void>
 */
async function onPublicKeyRequest(ws: IWebSocket, loggedInUser: User, request: PublicKeyRequest) {
  const user = (await new Query(Table.USERS).filter(({ email_ID }) => email_ID === request.user_id).results())[0];

  if (!user) {
    handlePublicKeyRefused(ws, request.user_id, 1001, 'User does not exist');
    debug('Request public key failed, user does not exist in database');
    return;
  }

  if (!user.public_key) {
    handlePublicKeyRefused(ws, request.user_id, 1002, 'User does not have a public key published');
    debug('Request public key failed, user does not have a public key published');
    return;
  }

  sendToClient(ws, {
    command: 'public_key_response',
    data: {
      user_id: request.user_id,
      public_key: user.public_key,
    },
  });
  debug(`${loggedInUser.id} requested ${request.user_id} their public key`);
}

/**
 * Sends an PublicKeyRefused containing the given error
 *
 * @param ws - The websocket to send the error to
 * @param error_code - The error code
 * @param reason - The reason of the error
 */
function handlePublicKeyRefused(ws: IWebSocket, user_id: UserId, error_code: number, reason: string) {
  sendToClient(ws, {
    command: 'public_key_refused',
    data: {
      user_id,
      error_code,
      reason,
    },
  });
}
