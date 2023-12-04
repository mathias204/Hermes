import type { MessageEntry } from './database-interfaces.mjs';
import { Query } from './query-builder.mjs';
import { Table } from './table.mjs';
import { del } from './query-builder.mjs';
import { DateTime } from 'luxon';

/**
 * Creates a friendship between two users.
 * @param x User 1.
 * @param y User 2.
 * @param datapath The path to the specific database.
 */
export async function makeFriends(x: string, y: string, datapath?: string) {
  let DATABASE_PATH = 'assets/databaseJSON/database';
  if (datapath) {
    DATABASE_PATH = datapath;
  }
  await new Query(Table.USERS, DATABASE_PATH)
    .filter(({ email_ID }) => email_ID === x || email_ID === y)
    .update((entry) => {
      if (entry.email_ID === x) {
        entry.friends = entry.friends.concat(y);
      } else {
        entry.friends = entry.friends.concat(x);
      }
    });
}

/**
 * Breaks up a friendship between two users, if they are friends.
 * @param x User 1.
 * @param y User 2.
 * @param datapath The path to the specific database.
 */
export async function breakUpFriends(x: string, y: string, datapath?: string) {
  let DATABASE_PATH = 'assets/databaseJSON/database';
  if (datapath) {
    DATABASE_PATH = datapath;
  }
  await new Query(Table.USERS, DATABASE_PATH)
    .filter(({ email_ID }) => email_ID === x || email_ID === y)
    .update((entry) => {
      if (entry.email_ID === x) {
        const new_friends = del(entry.friends, y);
        entry.friends = new_friends;
      } else {
        entry.friends = del(entry.friends, x);
      }
    });
}

/**
 * Checks if two users are friends.
 * @param x User 1.
 * @param y User 2.
 * @param datapath The path to the specific database.
 * @returns True if they are friends, false otherwise.
 */
export async function checkFriends(x: string, y: string, datapath?: string): Promise<boolean> {
  let DATABASE_PATH = 'assets/databaseJSON/database';
  if (datapath) {
    DATABASE_PATH = datapath;
  }
  const userX = await new Query(Table.USERS, DATABASE_PATH).filter(({ email_ID }) => email_ID === x).results();
  if (userX[0] !== undefined) {
    return userX[0].friends.find((element) => element === y) !== undefined;
  } else return false;
}

/**
 * Loads the last n messages from the specified channel.
 * @param channel The specific channel from which the messages are loaded.
 * @param n The amount of loaded messages.
 * @param datapath The location of the used database.
 * @returns An array containing the last n messages, ordered from new to old.
 */
export async function loadMessages(channel: string, n: number, datapath?: string): Promise<MessageEntry[]> {
  let DATABASE_PATH = 'assets/databaseJSON/database';
  if (datapath) {
    DATABASE_PATH = datapath;
  }
  const result = await new Query(Table.MESSAGES, DATABASE_PATH)
    .filter(({ channel_ID }) => channel_ID === channel)
    .results();

  result.sort((a, b) => compareTime(a, b));
  return result.slice(0, n);
}

/**
 * Compares the sent-time of two messages.
 * @param a the first MessageEntry
 * @param b the second MessageEntry
 * @returns a 1 if a is sent sooner than b and -1 for the other way around.
 */
export function compareTime(a: MessageEntry, b: MessageEntry): number {
  if (DateTime.fromISO(a.sent_at_utc_timestamp) < DateTime.fromISO(b.sent_at_utc_timestamp)) {
    return 1;
  } else {
    return -1;
  }
}
