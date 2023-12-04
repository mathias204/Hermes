import { DateTime } from 'luxon';

export type UserId = string;
export type ChannelId = string;
export type UserNick = string;
export type ChannelName = string;

export interface User {
  id: UserId;
  username?: UserNick | undefined;
}

export interface OutgoingMessage {
  msg: string;
  channel: ChannelId;
}

export interface IncomingMessage extends OutgoingMessage {
  sender: User;
  time: string | DateTime;
}

export interface MessageSendingError {
  error_code: number;
  reason: string;
}

export interface RequestMessageHistory {
  channel_id: ChannelId;
  amount: number;
}

export interface MessageHistoryResponse {
  channel_id: ChannelId;
  messages: IncomingMessage[];
}

export interface MessageHistoryError {
  error_code: number;
  reason: string;
}

export interface LookupRequest {
  time: string | DateTime;
  channel_id: ChannelId;
}

export interface LookupResult {
  messages: IncomingMessage[];
  resultIndex: number;
}

export interface LookupError {
  error_code: number;
  reason: string;
}

export interface Channel {
  name: ChannelName;
  id: ChannelId;
}

export interface ChannelList {
  channels: Channel[];
}

export interface ChannelJoinRequest {
  channel: Channel;
}

export interface ChannelJoinCompleted {
  user: User;
  channel: Channel;
  message_history?: IncomingMessage[] | undefined;
}

export interface ChannelJoinRefused {
  user: User;
  channel: Channel;
  error_code: number;
  reason?: string | undefined;
}

export interface ChannelLeaveRequest {
  channel: Channel;
}

export interface ChannelLeaveCompleted {
  user: User;
  channel: Channel;
}

export interface ChannelLeaveRefused {
  user: User;
  channel: Channel;
  error_code: number;
  reason?: string | undefined;
}

export interface ChannelCreateRequest {
  name: ChannelName;
}

export interface ChannelCreateCompleted {
  user: User;
  channel: Channel;
}

export interface ChannelCreateRefused {
  user: User;
  channel: Channel;
  error_code: number;
  reason?: string | undefined;
}

export interface SignUpRequest {
  user: User;
  password: string;
}

export interface SignUpCompleted {
  user: User;
}

export interface SignUpRefused {
  user: User;
  error_code: number;
  reason?: string | undefined;
}

export interface LogInRequest {
  user: User;
  password: string;
}

export interface LogInCompleted {
  user: User;
  currentChannels: ChannelList;
}

export interface LogInRefused {
  user: User;
  error_code: number;
  reason?: string | undefined;
}

export interface HuffmanEncodedFile {
  huffman_tree: [number, string][];
  encoded_file: number[];
}

export interface OutgoingEncodedFile {
  channel_id: ChannelId;
  file: HuffmanEncodedFile;
}

export interface IncomingEncodedFile extends OutgoingEncodedFile {
  user: User;
}

export interface NicknameChangeRequest {
  nickname: UserNick;
}

export interface NicknameChangeSuccess {
  user: User;
}

export interface NicknameChangeRefused {
  user: User;
  error_code: number;
  reason?: string | undefined;
}

export interface FileEncodingError {
  error_code: number;
  reason: string;
}

export interface InternalError {
  error_code: 0;
  message: string;
}

export interface ZodError {
  path: (string | number)[];
  message: string;
}

export interface ParsingError {
  error_code: 1;
  errors: ZodError[];
}

export interface MissingPermissionsError {
  error_code: 2;
  command: string;
}

export type ServerError = InternalError | ParsingError | MissingPermissionsError;

// To server command interfaces
export type ToServerCommand =
  | SendMessageCommand
  | RequestMessageHistoryCommand
  | ChannelJoinRequestCommand
  | LogInRequestCommand
  | ChannelLeaveRequestCommand
  | ChannelCreateRequestCommand
  | SignUpRequestCommand
  | LookupRequestCommand
  | OutgoingEncodedFileCommand
  | NicknameChangeRequestCommand;

export interface SendMessageCommand {
  command: 'send_message';
  data: OutgoingMessage;
}

export interface RequestMessageHistoryCommand {
  command: 'request_message_history';
  data: RequestMessageHistory;
}

export interface LookupRequestCommand {
  command: 'lookup_request';
  data: LookupRequest;
}

export interface ChannelJoinRequestCommand {
  command: 'channel_join_request';
  data: ChannelJoinRequest;
}

export interface ChannelLeaveRequestCommand {
  command: 'channel_leave_request';
  data: ChannelLeaveRequest;
}

export interface ChannelCreateRequestCommand {
  command: 'channel_create_request';
  data: ChannelCreateRequest;
}

export interface LogInRequestCommand {
  command: 'login_request';
  data: LogInRequest;
}

export interface SignUpRequestCommand {
  command: 'signup_request';
  data: SignUpRequest;
}

export interface OutgoingEncodedFileCommand {
  command: 'outgoing_encoded_file';
  data: OutgoingEncodedFile;
}

export interface NicknameChangeRequestCommand {
  command: 'nickname_change_request';
  data: NicknameChangeRequest;
}

// To client command interfaces
export type ToClientCommand =
  | MessageReceivedCommand
  | MessageSendingErrorCommand
  | MessageHistoryResponseCommand
  | MessageHistoryErrorCommand
  | ChannelListCommand
  | ChannelJoinCompletedCommand
  | ChannelJoinRefusedCommand
  | ChannelLeaveCompletedCommand
  | ChannelLeaveRefusedCommand
  | ChannelCreateCompletedCommand
  | ChannelCreateRefusedCommand
  | LogInCompletedCommand
  | LogInRefusedCommand
  | SignUpRefusedCommand
  | SignUpCompletedCommand
  | LookupResultCommand
  | LookupErrorCommand
  | IncomingEncodedFileCommand
  | FileEncodingErrorCommand
  | ServerErrorCommand
  | NicknameChangeRefusedCommand
  | NicknameChangeSuccessCommand;

export interface NicknameChangeSuccessCommand {
  command: 'nickname_change_success';
  data: NicknameChangeSuccess;
}

export interface NicknameChangeRefusedCommand {
  command: 'nickname_change_refused';
  data: NicknameChangeRefused;
}

export interface MessageReceivedCommand {
  command: 'message_received';
  data: IncomingMessage;
}

export interface MessageSendingErrorCommand {
  command: 'message_sending_error';
  data: MessageSendingError;
}

export interface MessageHistoryResponseCommand {
  command: 'message_history_response';
  data: MessageHistoryResponse;
}

export interface MessageHistoryErrorCommand {
  command: 'message_history_error';
  data: MessageHistoryError;
}

export interface ChannelListCommand {
  command: 'channel_list';
  data: ChannelList;
}

export interface ChannelJoinCompletedCommand {
  command: 'channel_join_completed';
  data: ChannelJoinCompleted;
}

export interface ChannelJoinRefusedCommand {
  command: 'channel_join_refused';
  data: ChannelJoinRefused;
}

export interface ChannelLeaveCompletedCommand {
  command: 'channel_leave_completed';
  data: ChannelLeaveCompleted;
}

export interface ChannelLeaveRefusedCommand {
  command: 'channel_leave_refused';
  data: ChannelLeaveRefused;
}

export interface ChannelCreateCompletedCommand {
  command: 'channel_create_completed';
  data: ChannelCreateCompleted;
}

export interface ChannelCreateRefusedCommand {
  command: 'channel_create_refused';
  data: ChannelCreateRefused;
}

export interface LogInCompletedCommand {
  command: 'login_completed';
  data: LogInCompleted;
}

export interface LogInRefusedCommand {
  command: 'login_refused';
  data: LogInRefused;
}

export interface SignUpCompletedCommand {
  command: 'signup_completed';
  data: SignUpCompleted;
}

export interface SignUpRefusedCommand {
  command: 'signup_refused';
  data: SignUpRefused;
}

export interface LookupResultCommand {
  command: 'lookup_result';
  data: LookupResult;
}

export interface LookupErrorCommand {
  command: 'lookup_error';
  data: LookupError;
}

export interface IncomingEncodedFileCommand {
  command: 'incoming_encoded_file';
  data: IncomingEncodedFile;
}

export interface FileEncodingErrorCommand {
  command: 'file_encoding_error';
  data: FileEncodingError;
}

export interface ServerErrorCommand {
  command: 'server_error';
  data: ServerError;
}
