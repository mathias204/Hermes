import type { UserId, ChannelId, UserNick, ChannelName } from '../protocol/proto.mjs';

export type DataEntry = MessageEntry | UserEntry | ChannelEntry;

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
}

export interface ChannelEntry {
  channel_ID: ChannelId;
  name: ChannelName;
}
