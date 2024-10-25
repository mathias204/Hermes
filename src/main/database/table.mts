import type { MessageEntry, UserEntry, ChannelEntry, FileEntry } from './database-interfaces.mjs';
type Tables = 'messages' | 'users' | 'channels' | 'files';
type PrimaryKeys = 'message_ID' | 'email_ID' | 'channel_ID' | 'file_ID';

/**
 * Makes a table of type Message/UserEntry or ChannelEntry
 */
export class Table<Type extends MessageEntry | UserEntry | ChannelEntry | FileEntry> {
  static readonly MESSAGES = new Table<MessageEntry>('messages', 'message_ID');
  static readonly USERS = new Table<UserEntry>('users', 'email_ID');
  static readonly CHANNELS = new Table<ChannelEntry>('channels', 'channel_ID');
  static readonly FILES = new Table<FileEntry>('files', 'file_ID');

  private constructor(
    public readonly name: Tables,
    public readonly primary_key: PrimaryKeys,
  ) {}

  /**
   * Returns the primaryKey of the DataEntry.
   *
   * @param entry - The inspected DataEntry
   * @returns The primaryKey of the DataEntry.
   */
  getPrimaryKey(entry: Type): string {
    if ((entry as MessageEntry).message_ID !== undefined) {
      return (entry as MessageEntry).message_ID;
    } else if ((entry as ChannelEntry).channel_ID !== undefined) {
      return (entry as ChannelEntry).channel_ID;
    } else if ((entry as UserEntry).email_ID !== undefined) {
      return (entry as UserEntry).email_ID;
    } else if ((entry as FileEntry).file_ID !== undefined) {
      return (entry as FileEntry).file_ID;
    } else throw new Error('Is not of type DataEntry');
  }

  /**
   * Returns the Index of the DataEntry, if one exists.
   *
   * @param entry - The inspected DataEntry
   * @returns The Index of the entry.
   */
  getIndex(entry: Type): string {
    if ((entry as MessageEntry).message_ID !== undefined) {
      return (entry as MessageEntry).channel_ID;
    } else if ((entry as UserEntry).email_ID !== undefined) {
      return (entry as UserEntry).email_ID.charAt(0);
    } else throw new Error('No index was set for this entry type');
  }

  /**
   * Validates if a table has an index or not.
   *
   * @returns - A boolean representing the use of an index.
   */
  hasIndex(): boolean {
    if (this.name === 'channels' || this.name === 'files') {
      return false;
    } else return true;
  }
}
