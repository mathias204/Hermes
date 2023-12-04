import type {
  NicknameChangeRequest,
  NicknameChangeSuccess,
  NicknameChangeSuccessCommand,
  User,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import { DateTime } from 'luxon';
import Debug from 'debug';

const debug = Debug('chatter:ChatServer-user-handler');

/**
 * Updates user fields like self destruct at/last seen/destruct warning in database.
 * This upon logging in, disconnecting and ping event.
 *
 * @param user | Takes a User which is logged in and about to be disconnected.
 * @returns | void
 */
export async function updateUserDatabase(user: User): Promise<void> {
  debug('Updating user %s entry in database, upon connection/disconnection/ping.', user.id);
  await new Query(Table.USERS)
    .filter(({ email_ID }) => email_ID === user.id)
    .update((entry) => {
      entry.destroy_warning = false;
      entry.self_destruct_at_utc_timestamp = DateTime.now().plus({ months: 8 }).toUTC().toISO() as string;
      entry.last_seen_utc_timestamp = DateTime.now().toUTC().toISO() as string;
    });
  return;
}

/**
 * Updates user nickname field in database.
 *
 * @param ws | IWebSocket used to receive and send commands.
 * @param user | User for which nickname has to be modified.
 * @param data | Request containing new username.
 * @param loggedInClients | Server field that needs updating.
 */
export async function updateNickname(
  ws: IWebSocket,
  user: User,
  data: NicknameChangeRequest,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  // Update database with new nickname:
  const newUser = (
    await new Query(Table.USERS)
      .filter(({ email_ID }) => email_ID === user.id)
      .update((entry) => (entry.user_name = data.nickname))
  )[0];

  // Error handling:
  if (!newUser) {
    debug("Something went wrong that couldn't go wrong, user not found in database.");
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
  ws.send(JSON.stringify({ command: 'nickname_change_success', data: response } as NicknameChangeSuccessCommand));
  debug('Sent nickname change completed command, database has been updated accordingly for %s.', newUser.email_ID);
  return;
}
