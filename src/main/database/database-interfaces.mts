import type { UserId, ChannelId, UserNick, ChannelName, ChannelType } from '../protocol/proto.mjs';
import type { LockFileNameSchema } from '../protocol/proto.zod.mjs';
import { z } from 'zod';

export type DataEntry = MessageEntry | UserEntry | ChannelEntry | FileEntry;
export type LockFileName = z.infer<typeof LockFileNameSchema>;

export interface MessageEntry {
  message_ID: string;
  sender_ID: UserId;
  channel_ID: ChannelId;
  sent_at_utc_timestamp: string;
  message: string;
}

export interface UserEntry {
  email_ID: UserId;
  user_name: UserNick;
  last_seen_utc_timestamp: string;
  hashed_pass: string;
  channels: ChannelId[];
  self_destruct_at_utc_timestamp: string;
  friends: UserId[];
  destroy_warning: boolean;
  public_key?: string | undefined;
  channel_invites: {
    channel_ID: ChannelId;
    sender_ID: UserId;
    encrypted_secret?: string | undefined;
  }[];
}

export interface ChannelEntry {
  channel_ID: ChannelId;
  name: ChannelName;
  type: ChannelType;
}

export interface FileEntry {
  file_ID: string;
  channel: ChannelId;
  file_name: string;
  raw_file_content: Buffer;
  file_content_key: number;
  sender_id: UserId;
  sent_at_utc_timestamp: string;
  encoding_type: 'huffman' | 'LZW';
}

export interface MetaData {
  count: number;
}
