import { DateTime } from 'luxon';

export type UserId = string;
export type ChannelId = string;
export type UserNick = string;
export type ChannelName = string;
export type ChannelType = 'public' | 'private' | 'private_encrypted' | 'direct_message' | 'direct_message_encrypted';

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

export interface RequestParticipants {
  channel_id: ChannelId;
}

export interface ParticipantsResponse {
  channel_id: ChannelId;
  participants: [User, string | DateTime][];
}

export interface ParticipantsError {
  error_code: number;
  reason: string;
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
  type: ChannelType;
}

export interface ChannelList {
  channels: Channel[];
}

export interface ChannelInviteRequest {
  receiver: UserId;
  channel_id: ChannelId;
  encrypted_secret?: string | undefined;
}

export interface ChannelInviteCompleted {}

export interface ChannelInviteRefused {
  channel_id: ChannelId;
  error_code: number;
  reason?: string | undefined;
}

export interface ChannelInviteBroadcastRequest {}

export interface ChannelInvitesBroadcast {
  invites: Channel[];
}

export interface AcceptChannelInviteRequest {
  channel_id: ChannelId;
}

export interface AcceptChannelInviteCompleted {}

export interface AcceptChannelInviteRefused {
  channel_id: ChannelId;
  error_code: number;
  reason?: string | undefined;
}

export interface RejectChannelInviteRequest {
  channel_id: ChannelId;
}

export interface RejectChannelInviteCompleted {}

export interface RejectChannelInviteRefused {
  channel_id: ChannelId;
  error_code: number;
  reason?: string | undefined;
}

export interface ChannelJoinRequest {
  channel_id: ChannelId;
}

export interface ChannelJoinCompleted {
  channel: Channel;
  encrypted_secret?: string | undefined;
  peer_public_key?: string | undefined;
}

export interface NewUserJoinedBroadcast {
  user: User;
  channel: Channel;
  usersInChannel: User[];
}

export interface ChannelJoinRefused {
  channel_id: ChannelId;
  error_code: number;
  reason?: string | undefined;
}

export interface ChannelLeaveRequest {
  channel_id: ChannelId;
}

export interface ChannelLeaveCompleted {
  channel: Channel;
}

export interface ChannelLeaveRefused {
  channel_id: ChannelId;
  error_code: number;
  reason?: string | undefined;
}

export interface ChannelCreateRequest {
  name: ChannelName;
  type: ChannelType;
  invited_participants?: UserId[] | undefined;
}

export interface ChannelCreateCompleted {
  channel: Channel;
}

export interface ChannelCreateRefused {
  channel_name: ChannelName;
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

export interface FileContentCommand {
  command: 'file_content';
  data: EncodedFile;
}

export type HuffmanEncodedFileArray = [1, ...number[]];

export type LZWEncodedFileArray = [2, ...number[]];

export interface HuffmanEncodedFile {
  encoding_type: 'huffman';
  file_content_key: number;
  huffman_tree: [number, string][];
  encoded_file: number[];
  channel_id: ChannelId;
}

export interface LZWEncodedFile {
  encoding_type: 'LZW';
  file_content_key: number;
  encoded_file: number[];
  channel_id: ChannelId;
}

export interface OutgoingEncodedFile {
  channel_id: ChannelId;
  file_name: string;
  file_content_key: number;
}

export interface IncomingEncodedFile extends OutgoingEncodedFile {
  user: User;
}

export type EncodedFile = HuffmanEncodedFile | LZWEncodedFile;

export interface ListFileEntry {
  file_name: string;
  file_ID: string;
  sender: User;
}

export interface ListFilesResponse {
  list_of_files: ListFileEntry[];
}

export interface ListFilesRequest {
  channel_id: ChannelId;
}

export interface FileRequest {
  channel_id: ChannelId;
  file_hash: string;
}

export interface NewUserJoinedBroadcastTrigger {
  user: User;
  channel: Channel;
}

export interface UserClosedUpdateTrigger {
  user: User;
  channel: Channel;
}

export interface NicknameChangeRequest {
  nickname: UserNick;
}

export interface DeleteUserRequest {
  user: User;
}

export interface NicknameChangeSuccess {
  user: User;
}

export interface DeleteUserSuccess {
  user: User;
}

export interface DeleteUserRefused {
  user: User;
  error_code: number;
  reason?: string | undefined;
}

export interface NicknameChangeRefused {
  user: User;
  error_code: number;
  reason?: string | undefined;
}

export interface FileSharingError {
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

export interface UpdatePublicKey {
  public_key: string;
}

export interface UpdatePublicKeyRefused {
  error_code: number;
  reason: string;
}

export interface PublicKeyRequest {
  user_id: UserId;
}

export interface PublicKeyResponse {
  user_id: UserId;
  public_key: string;
}

export interface PublicKeyRefused {
  user_id: UserId;
  error_code: number;
  reason: string;
}

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
  | ListFilesRequestCommand
  | FileRequestCommand
  | NicknameChangeRequestCommand
  | DeleteUserRequestCommand
  | NewUserJoinedBroadcastTriggerCommand
  | RequestParticipantsCommand
  | ChannelInviteRequestCommand
  | ChannelInviteBroadcastRequestCommand
  | AcceptChannelInviteRequestCommand
  | RejectChannelInviteRequestCommand
  | FileContentCommand
  | UserClosedUpdateTriggerCommand
  | UpdatePublicKeyCommand
  | PublicKeyRequestCommand;

export type RawToServerCommand = HuffmanEncodedFileArray | LZWEncodedFileArray;

export type RawToClientCommand = HuffmanEncodedFileArray | LZWEncodedFileArray;

export interface ChannelInviteRequestCommand {
  command: 'channel_invite_request';
  data: ChannelInviteRequest;
}

export interface ChannelInviteBroadcastRequestCommand {
  command: 'channel_invite_broadcast_request';
  data: ChannelInviteBroadcastRequest;
}

export interface AcceptChannelInviteRequestCommand {
  command: 'accept_channel_invite_request';
  data: AcceptChannelInviteRequest;
}

export interface RejectChannelInviteRequestCommand {
  command: 'reject_channel_invite_request';
  data: RejectChannelInviteRequest;
}

export interface SendMessageCommand {
  command: 'send_message';
  data: OutgoingMessage;
}

export interface RequestMessageHistoryCommand {
  command: 'request_message_history';
  data: RequestMessageHistory;
}

export interface RequestParticipantsCommand {
  command: 'request_participants';
  data: RequestParticipants;
}

export interface LookupRequestCommand {
  command: 'lookup_request';
  data: LookupRequest;
}

export interface ChannelJoinRequestCommand {
  command: 'channel_join_request';
  data: ChannelJoinRequest;
}

export interface NewUserJoinedBroadcastTriggerCommand {
  command: 'new_user_joined_broadcast_trigger';
  data: NewUserJoinedBroadcastTrigger;
}

export interface UserClosedUpdateTriggerCommand {
  command: 'user_closed_update_trigger';
  data: UserClosedUpdateTrigger;
}

export interface NewUserJoinedBroadcastCommand {
  command: 'new_user_joined_broadcast';
  data: NewUserJoinedBroadcast;
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

export interface ListFilesRequestCommand {
  command: 'list_files_request';
  data: ListFilesRequest;
}

export interface FileRequestCommand {
  command: 'file_request';
  data: FileRequest;
}

export interface NicknameChangeRequestCommand {
  command: 'nickname_change_request';
  data: NicknameChangeRequest;
}

export interface DeleteUserRequestCommand {
  command: 'delete_user_request';
  data: DeleteUserRequest;
}

export interface UpdatePublicKeyCommand {
  command: 'update_public_key';
  data: UpdatePublicKey;
}

export interface PublicKeyRequestCommand {
  command: 'public_key_request';
  data: PublicKeyRequest;
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
  | ListFilesResponseCommand
  | FileSharingErrorCommand
  | ServerErrorCommand
  | NicknameChangeRefusedCommand
  | NicknameChangeSuccessCommand
  | NewUserJoinedBroadcastCommand
  | DeleteUserSuccessCommand
  | DeleteUserRefusedCommand
  | ParticipantsErrorCommand
  | ParticipantsResponseCommand
  | ChannelInviteCompletedCommand
  | ChannelInviteRefusedCommand
  | ChannelInvitesBroadcastCommand
  | AcceptChannelInviteCompletedCommand
  | AcceptChannelInviteRefusedCommand
  | RejectChannelInviteCompletedCommand
  | RejectChannelInviteRefusedCommand
  | FileContentCommand
  | UpdatePublicKeyRefusedCommand
  | PublicKeyResponseCommand
  | PublicKeyRefusedCommand;

export interface AcceptChannelInviteCompletedCommand {
  command: 'accept_invite_completed';
  data: AcceptChannelInviteCompleted;
}

export interface AcceptChannelInviteRefusedCommand {
  command: 'accept_invite_refused';
  data: AcceptChannelInviteRefused;
}

export interface RejectChannelInviteCompletedCommand {
  command: 'reject_invite_completed';
  data: RejectChannelInviteCompleted;
}

export interface RejectChannelInviteRefusedCommand {
  command: 'reject_invite_refused';
  data: RejectChannelInviteRefused;
}

export interface ChannelInvitesBroadcastCommand {
  command: 'channels_broadcast_incoming';
  data: ChannelInvitesBroadcast;
}

export interface ChannelInviteCompletedCommand {
  command: 'invite_channel_completed';
  data: ChannelInviteCompleted;
}

export interface ChannelInviteRefusedCommand {
  command: 'invite_channel_refused';
  data: ChannelInviteRefused;
}

export interface DeleteUserSuccessCommand {
  command: 'delete_user_success';
  data: DeleteUserSuccess;
}

export interface DeleteUserRefusedCommand {
  command: 'delete_user_refused';
  data: DeleteUserRefused;
}

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

export interface ParticipantsResponseCommand {
  command: 'participants_response';
  data: ParticipantsResponse;
}

export interface ParticipantsErrorCommand {
  command: 'participants_error';
  data: ParticipantsError;
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

export interface ListFilesResponseCommand {
  command: 'list_files_response';
  data: ListFilesResponse;
}

export interface FileSharingErrorCommand {
  command: 'file_sharing_error';
  data: FileSharingError;
}

export interface ServerErrorCommand {
  command: 'server_error';
  data: ServerError;
}

export interface UpdatePublicKeyRefusedCommand {
  command: 'update_public_key_refused';
  data: UpdatePublicKeyRefused;
}

export interface PublicKeyResponseCommand {
  command: 'public_key_response';
  data: PublicKeyResponse;
}

export interface PublicKeyRefusedCommand {
  command: 'public_key_refused';
  data: PublicKeyRefused;
}
