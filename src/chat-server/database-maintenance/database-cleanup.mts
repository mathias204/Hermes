import { Query } from '../../database/query-builder.mjs';
import { Table } from '../../database/table.mjs';

import { DateTime } from 'luxon';
import { sendMailToUser } from './email-send.mjs';
// import { breakUpFriends } from '../database/queries.mjs';

/**
 * Manages user statuses within the database and performs cleanup processes.
 * This class contains methods to handle user statuses, issue warnings, and perform database cleanups.
 */
export class DatabaseCleanUp {
  private readonly DATABASE_PATH?: string;

  /**
   * Constructs a DatabaseCleanUp instance with an optional database path.
   *
   * @param database_path - An optional string representing the path to a database. If none provided the main database is used.
   * @remarks This constructor is primarily used for testing purposes and allows flexibility in specifying a database path.
   */
  constructor(database_path?: string) {
    if (database_path) {
      this.DATABASE_PATH = database_path;
    }
  }

  /**
   * Manages user statuses within the database by handling inactivity warnings and cleanup processes.
   *
   * This function identifies users on the brink of deletion due to extended inactivity and performs the following actions:
   * - Sends warnings to users approaching the deletion deadline and give a 7 day deadline.
   * - Deletes information for users who have been inactive beyond the warning period.
   * - Cleans up associated channels if they become empty after user deletions.
   */
  async handleUserStatusAndCleanup() {
    // Identify users close to deletion
    const warning_users = await new Query(Table.USERS, this.DATABASE_PATH)
      .filter(
        ({ self_destruct_at_utc_timestamp, destroy_warning }) =>
          this.isAlmostDead(self_destruct_at_utc_timestamp) && !destroy_warning,
      )
      .results();

    //Identify users already inactive and with a destroy warning
    const dead_users = await new Query(Table.USERS, this.DATABASE_PATH)
      .filter(
        ({ self_destruct_at_utc_timestamp, destroy_warning }) =>
          this.isDead(self_destruct_at_utc_timestamp) && destroy_warning,
      )
      .results();

    // Warn almost dead users and update their self-destruct time and destroy warning flag
    for (const user of warning_users) {
      if (!this.DATABASE_PATH) {
        await sendMailToUser(user); //send warning email
      }
      //Ensures the user has 7 days left to log back in
      const new_self_destruct_at_utc_timestamp = DateTime.utc().plus({ days: 7 }).toISO() as string;

      await new Query(Table.USERS, this.DATABASE_PATH)
        .filter(({ email_ID }) => email_ID === user.email_ID)
        .update(
          (user) => (
            (user.self_destruct_at_utc_timestamp = new_self_destruct_at_utc_timestamp), (user.destroy_warning = true)
          ),
        );
    }

    // Perform cleanup for inactive users and associated channels
    const possible_empty_channels: Set<string> = new Set();
    for (const user of dead_users) {
      user.channels.forEach((channel) => possible_empty_channels.add(channel));
      await new Query(Table.MESSAGES, this.DATABASE_PATH)
        .filter(({ sender_ID }) => sender_ID === user.email_ID)
        .delete();
      await new Query(Table.USERS, this.DATABASE_PATH).filter(({ email_ID }) => email_ID === user.email_ID).delete();
    }
    // Check for possibly empty channels after user deletion and delete them if no messages exist
    for (const possible_empty_channel of possible_empty_channels) {
      const messages = await new Query(Table.MESSAGES, this.DATABASE_PATH)
        .filter(({ channel_ID }) => channel_ID === possible_empty_channel)
        .results();

      if (messages.length === 0) {
        await new Query(Table.CHANNELS, this.DATABASE_PATH)
          .filter(({ channel_ID }) => channel_ID === possible_empty_channel)
          .delete();
      }
    }
  }

  /**
   * Determines if the provided date is close to the deletion threshold.
   *
   * @param ISOdate - A string representing a date in ISO format.
   * @returns A boolean indicating whether the provided date is within 7 days of today.
   */
  private isAlmostDead(ISOdate: string): boolean {
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
  private isDead(ISOdate: string): boolean {
    const today = DateTime.utc();
    const destroy_date = DateTime.fromISO(ISOdate);
    return destroy_date <= today;
  }
}
