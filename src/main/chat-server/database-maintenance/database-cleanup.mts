import { Query } from '../../database/query-builder.mjs';
import { sendMailToUser } from './email-send.mjs';
import { Table } from '../../database/table.mjs';
import { DateTime } from 'luxon';
import type { UserEntry } from '../../database/database-interfaces.mjs';
import { promises } from 'fs';

export const databaseCleanUp = {
  handleUserStatusAndCleanup,
  removeUser,
};

/**
 * Manages user statuses within the database by handling inactivity warnings and cleanup processes.
 *
 * This function identifies users on the brink of deletion due to extended inactivity and performs the following actions:
 * - Sends warnings to users approaching the deletion deadline and give a 7 day deadline.
 * - Deletes information for users who have been inactive beyond the warning period.
 * - Cleans up associated channels if they become empty after user deletions.
 */
async function handleUserStatusAndCleanup() {
  //remove any deadlocks
  try {
    const files = await promises.readdir('assets/databaseJSON');
    for (const file of files) {
      if (file.includes('lock')) {
        await promises.unlink('assets/databaseJSON/' + file);
      }
    }
  } catch (err) {
    console.error('Error removing locks:', err);
  }

  // Identify users close to deletion
  const warning_users = await new Query(Table.USERS)
    .filter(
      ({ self_destruct_at_utc_timestamp, destroy_warning }) =>
        isAlmostDead(self_destruct_at_utc_timestamp) && !destroy_warning,
    )
    .results();

  //Identify users already inactive and with a destroy warning
  const dead_users = await new Query(Table.USERS)
    .filter(
      ({ self_destruct_at_utc_timestamp, destroy_warning }) =>
        isDead(self_destruct_at_utc_timestamp) && destroy_warning,
    )
    .results();

  // Warn almost dead users and update their self-destruct time and destroy warning flag
  for (const user of warning_users) {
    await sendMailToUser(user); //send warning email

    //Ensures the user has 7 days left to log back in
    const new_self_destruct_at_utc_timestamp = DateTime.utc().plus({ days: 7 }).toISO();

    await new Query(Table.USERS)
      .filter(({ email_ID }) => email_ID === user.email_ID)
      .update(
        (user) => (
          (user.self_destruct_at_utc_timestamp = new_self_destruct_at_utc_timestamp), (user.destroy_warning = true)
        ),
      );
  }

  // Perform cleanup for inactive users and associated channels
  for (const user of dead_users) {
    await removeUser(user);
  }
}

/**
 * Determines if the provided date is close to the deletion threshold.
 *
 * @param ISOdate - A string representing a date in ISO format.
 * @returns A boolean indicating whether the provided date is within 7 days of today.
 */
function isAlmostDead(ISOdate: string): boolean {
  const today = DateTime.utc().startOf('day');
  const destroy_date_minus7days = DateTime.fromISO(ISOdate).minus({ days: 7 }).startOf('day');
  return destroy_date_minus7days <= today;
}

/**
 * Determines if the provided date has already reached the deletion threshold.
 *
 * @param ISOdate - A string representing a date in ISO format.
 * @returns A boolean indicating whether the provided date is earlier than or equal to today.
 */
function isDead(ISOdate: string): boolean {
  const today = DateTime.utc();
  const destroy_date = DateTime.fromISO(ISOdate);
  return destroy_date <= today;
}

/**
 * Deletes the user from the database, changes all their messages sender_id to 'User Deleted'
 * If the channel is empty (consist only messages from dead user) it gets deleted with all their messages.
 *
 * @param user - The user of type UserEntry that needs to be removed
 */
async function removeUser(user: UserEntry) {
  const possible_empty_channels = user.channels;

  await new Query(Table.MESSAGES)
    .filter(({ sender_ID }) => sender_ID === user.email_ID)
    .update((entry) => (entry.sender_ID = 'User Deleted'));

  await new Query(Table.USERS).filter(({ email_ID }) => email_ID === user.email_ID).delete();

  // Check for possibly empty channels after user deletion and delete them if no messages exist
  for (const possible_empty_channel of possible_empty_channels) {
    const messages = await new Query(Table.MESSAGES)
      .filter(({ channel_ID, sender_ID }) => channel_ID === possible_empty_channel && sender_ID !== 'User Deleted')
      .results();

    if (messages.length === 0) {
      await new Query(Table.MESSAGES).filter(({ channel_ID }) => channel_ID === possible_empty_channel).delete();
      await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === possible_empty_channel).delete();
    }
  }
}
