import type {
  Channel,
  DeleteUserRefused,
  DeleteUserRequest,
  DeleteUserSuccess,
  NicknameChangeRequest,
  NicknameChangeSuccess,
  User,
  UserClosedUpdateTrigger,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { DateTime } from 'luxon';
import Debug from 'debug';
import { sendToClient } from '../lib/communication/send.mjs';

export const UserHandler = {
  updateUserDatabase,
  updateNickname,
  deleteUser,
  closeChannelUpdate,
};

const debug = Debug('chatter:ChatServer-user-handler');

/**
 * Updates user fields like self destruct at/last seen/destruct warning in database.
 * This upon logging in, disconnecting and ping event.
 *
 * @param user - Takes a User which is logged in and about to be disconnected.
 * @returns Promise<void>
 */
async function updateUserDatabase(user: User): Promise<void> {
  debug('Updating user %s entry in database, upon connection/disconnection/ping.', user.id);
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === user.id)
    .update((entry) => {
      entry.destroy_warning = false;
      entry.self_destruct_at_utc_timestamp = DateTime.now().plus({ months: 8 }).toUTC().toISO();
      entry.last_seen_utc_timestamp = DateTime.now().toUTC().toISO();
    });
  return;
}

/**
 * Updates user nickname field in database.
 *
 * @param ws - IWebSocket used to receive and send commands.
 * @param user - User for which nickname has to be modified.
 * @param data - Request containing new username.
 * @param loggedInClients - Server field that needs updating.
 * @returns Promise<void>
 */
async function updateNickname(
  ws: IWebSocket,
  user: User,
  data: NicknameChangeRequest,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  // Error handling:
  if (data.nickname.trim().length < 3) {
    handleNickRefused(ws, user, 602, 'Invalid nickname, has length less than 3 characters');
    return;
  }

  // Update database with new nickname:
  const newUser = (
    await new Query(Table.USERS)
      .filter(({ email_ID }) => email_ID === user.id)
      .update((entry) => (entry.user_name = data.nickname))
  )[0];

  // Error handling:
  if (!newUser) {
    handleNickRefused(ws, user, 603, 'User was not found in the database, error should never occur');
    return;
  }

  // Updated server.loggedInClients:
  loggedInClients.set(ws, { id: newUser.email_ID, username: newUser.user_name });

  // Formulate response:
  const response: NicknameChangeSuccess = {
    user: {
      id: newUser.email_ID,
      username: newUser.user_name,
    },
  };
  sendToClient(ws, { command: 'nickname_change_success', data: response });
  debug('Sent nickname change completed command, database has been updated accordingly for %s.', newUser.email_ID);
  return;
}

/**
 * Handles server-client communications for when a nickname change request is denied.
 * Forwarding an error code and reason to the client thru a "nickname_change_refused" command.
 *
 * @param ws - IWebSocket used to receive and send commands
 * @param user - User for which nickname change request is denied
 * @param error_code - Error code corresponding to the reason as to why the nickname change is denied
 * @param reason - Reason for which nickname change is denied
 */
function handleNickRefused(ws: IWebSocket, user: User, error_code: number, reason: string): void {
  debug(`Changing nickname failed, refuse command has been sent and database remains unchanged. Error ${error_code}`);
  sendToClient(ws, {
    command: 'nickname_change_refused',
    data: {
      user,
      error_code,
      reason,
    },
  });
}

/**
 * Removes user from database.
 *
 * @param ws - IWebSocket used to receive and send commands.
 * @param user - User for which nickname has to be modified.
 * @param data - Request containing new username.
 * @returns Promise<void>
 */
async function deleteUser(ws: IWebSocket, user: User, data: DeleteUserRequest): Promise<void> {
  if (user.id !== data.user.id) {
    // Authenticated user connected via ws is trying to delete someone else
    const response: DeleteUserRefused = {
      user: {
        id: user.id,
        username: user.username,
      },
      error_code: 601,
    };
    sendToClient(ws, { command: 'delete_user_refused', data: response });
    debug('Sent delete user refused command, user tried to delete someone else.');
    return;
  }

  await new Query(Table.USERS).filter(({ email_ID }) => email_ID === user.id).delete();

  const response: DeleteUserSuccess = {
    user: {
      id: user.id,
      username: user.username,
    },
  };

  sendToClient(ws, { command: 'delete_user_success', data: response });
  debug('Sent delete user success command, ws connection now getting closed');
  return;
}

/**
 * Needed for "currently active in channel X feature", when user closes a channel in client it sends a notification to the server.
 * Removing the entry from server field "currentlyOpenChannels".
 *
 * Note:
 * It was chosen not to send any feedback over the websocket regarding this function. It is not critical and programmed in a
 * redundant way. (See BroadcastHandler.onUserOpenedChannelBroadcastTrigger())
 *
 *
 * @param ws - IWebSocket used to receive and send commands.
 * @param user - User for which server field "currentlyOpenChannels" must be updated.
 * @param data - Notification telling server, client closed a channel. Contains User and Channel instance.
 * @param currentlyOpenChannels - To modify server field with received data.
 * @returns Promise<void>
 */
async function closeChannelUpdate(
  loggedInUser: User,
  request: UserClosedUpdateTrigger,
  currentlyOpenChannels: Map<User, Channel>,
): Promise<void> {
  const usersInChannel = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(request.channel.id))
    .results();

  if (!usersInChannel.some(({ email_ID }) => email_ID === loggedInUser.id)) {
    return;
  }

  // Tries deleting User entry from dict "currentlyOpenChannels":
  currentlyOpenChannels.delete(request.user);
}
