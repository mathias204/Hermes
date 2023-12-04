import type {
  ChannelId,
  ChannelList,
  LogInCompleted,
  LogInCompletedCommand,
  LogInRefused,
  LogInRefusedCommand,
  LogInRequest,
  SignUpCompleted,
  SignUpCompletedCommand,
  SignUpRefused,
  SignUpRefusedCommand,
  SignUpRequest,
  User,
  UserId,
  UserNick,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { broadcastChannels } from './channel-handler.mjs';
import { updateUserDatabase } from './user-handler.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import * as bcrypt from 'bcrypt';
import { DateTime } from 'luxon';
import Debug from 'debug';

const saltRounds = 10;
const debug = Debug('chatter:ChatServer-authentication-handler');

/**
 * Function handles case 'signup_request' for IWebServer.
 * Upon succesful/failed signup the IWebSocket sends 'SignUpCompletedCommand'/'SignUpRefusedCommand'
 * to the client. If signup was succesful, client immediatly expects a login attempt.
 *
 * @param ws | IWebSocket object currently handling client that wants to sign up.
 * @param credentials | Information of client attempting to sign up.
 * @param loggedInClients | Server's Map of logged in clients, to which the new client gets added on successful signup.
 * @returns | boolean
 */
export async function onClientSignUp(
  ws: IWebSocket,
  credentials: SignUpRequest,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  debug('Received sign up request for %s', credentials.user.id);

  // Initialize parameters and load user data from request.
  const hashed_pass = await bcrypt.hash(credentials.password, saltRounds); // Use external module to hash/unhash passwords
  const userToAdd: UserId = credentials.user.id;
  const nickToAdd: UserNick = credentials.user.username || ''; // Should never be undefined as per agreement with client.

  // Inserting a UserEntry can return an error if there is an entry with an
  // email_ID that is already existing. Use then/catch to detect failure when inserting user in the DB.
  new Query(Table.USERS)
    .insert({
      email_ID: userToAdd,
      user_name: nickToAdd,
      last_seen_utc_timestamp: DateTime.now().toUTC().toISO() as string,
      hashed_pass: hashed_pass,
      channels: [],
      self_destruct_at_utc_timestamp: DateTime.now().plus({ months: 8 }).toUTC().toISO() as string,
      friends: [],
      destroy_warning: false,
    })
    .then(async () => {
      debug('Signup of client was succesful, now added to DB.');
      const response: SignUpCompleted = { user: credentials.user };
      ws.send(JSON.stringify({ command: 'signup_completed', data: response } as SignUpCompletedCommand));
      await onClientLogin(ws, credentials, loggedInClients);
      return;
    })
    .catch((_error) => {
      debug('Failed to signup user, user already in database. Sending error code 103 to client.');
      const response: SignUpRefused = {
        user: credentials.user,
        error_code: 103,
      };
      ws.send(JSON.stringify({ command: 'signup_refused', data: response } as SignUpRefusedCommand));
      return;
    });
}

/**
 * Function handles case 'login_request' for IWebServer.
 * Upon succesful/failed login the IWebSocket sends 'LogInCompletedCommand'/'LogInRefusedCommand'
 * to the client. If login was succesful, server expects a return boolean set to true.
 *
 * @param ws | IWebSocket object currently handling client that wants to sign up.
 * @param credentials | Information of client attempting to sign up.
 * @param loggedInClients | Server's Map of logged in clients, to which the new client gets added on successful login.
 * @returns | boolean
 */
export async function onClientLogin(
  ws: IWebSocket,
  credentials: LogInRequest,
  loggedInClients: Map<IWebSocket, User>,
): Promise<void> {
  debug('Received log in request for %s', credentials.user.id);
  // Request userdata from DB, needed to check passwords.
  const allUsersDB = await new Query(Table.USERS).results(); // returns UserEntry[].

  // Initialize parameters and load user data from request.
  let userAuthenticated: boolean = false;
  let errorCode: number = 0;
  let startupChannelIDs: ChannelId[] = [];

  const foundUser = allUsersDB.find((userDB) => userDB.email_ID === credentials.user.id);

  if (foundUser) {
    const match = (await bcrypt.compare(credentials.password, foundUser.hashed_pass)) as boolean;

    if (match) {
      userAuthenticated = true;
      startupChannelIDs = foundUser.channels; // Array of channelIds (strings)
    } else {
      errorCode = 101;
    }
  } else {
    errorCode = 102;
  }

  if (userAuthenticated) {
    // Find username, can be specified by user trying to login or not.
    const nick = foundUser?.user_name;
    // Add User and IWebSocket to server field, loggedInClients:
    const user: User = {
      id: credentials.user.id,
      username: nick,
    };
    loggedInClients.set(ws, user);

    // Update userfields self_destruct_at and destroy_warning:
    await updateUserDatabase(user);

    // Send channelList object containing channels user is a part of, with LogInCompletedCommand:
    const allChannelsDB = await new Query(Table.CHANNELS).results();
    const response2: ChannelList = {
      channels: allChannelsDB
        .filter((channelDB) => startupChannelIDs.includes(channelDB.channel_ID))
        .map((channelDB) => ({
          name: channelDB.name,
          id: channelDB.channel_ID,
        })),
    };

    // Send response to client, also initialize channels user is part of.
    // Clients expects this command after succesful authentication.
    const response: LogInCompleted = { user: user, currentChannels: response2 };
    ws.send(JSON.stringify({ command: 'login_completed', data: response } as LogInCompletedCommand));
    debug('Sent log in completed response to client');
    await broadcastChannels(ws, undefined);
    return;
  } else {
    const response: LogInRefused = {
      user: credentials.user,
      error_code: errorCode,
    };
    ws.send(JSON.stringify({ command: 'login_refused', data: response } as LogInRefusedCommand));
    debug('Sent log in refused response to client');
    return;
  }
}
