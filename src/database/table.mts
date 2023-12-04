import type { MessageEntry, UserEntry, ChannelEntry } from './database-interfaces.mjs';
type Tables = 'messages' | 'users' | 'channels';
type PrimaryKeys = 'message_ID' | 'email_ID' | 'channel_ID';

/**
 * Makes a table of type Message/UserEntry or ChannelEntry
 */
export class Table<Type extends MessageEntry | UserEntry | ChannelEntry> {
  static readonly MESSAGES = new Table<MessageEntry>('messages', 'message_ID');
  static readonly USERS = new Table<UserEntry>('users', 'email_ID');
  static readonly CHANNELS = new Table<ChannelEntry>('channels', 'channel_ID');

  private constructor(
    public readonly name: Tables,
    public readonly primary_key: PrimaryKeys,
  ) {}

  /**
   * Returns the primaryKey of the DataEntry.
   * @param entry The inspected DataEntry
   * @returns The primaryKey of the DataEntry.
   */
  getPrimaryKey(entry: Type): string | number {
    if ((entry as MessageEntry).message_ID !== undefined) {
      return (entry as MessageEntry).message_ID;
    } else if ((entry as ChannelEntry).channel_ID !== undefined) {
      return (entry as ChannelEntry).channel_ID;
    } else if ((entry as UserEntry).email_ID !== undefined) {
      return (entry as UserEntry).email_ID;
    } else throw new Error('Is not of type DataEntry');
  }
}
