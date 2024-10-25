import { z } from 'zod';
import { DateTime } from 'luxon';
import type {
  Channel,
  ChannelJoinCompleted,
  ChannelJoinRefused,
  ChannelLeaveCompleted,
  ChannelLeaveRefused,
  ChannelCreateCompleted,
  ChannelCreateRefused,
  ChannelJoinRequest,
  ChannelLeaveRequest,
  ChannelCreateRequest,
  ChannelList,
  LogInRefused,
  LogInRequest,
  LogInCompleted,
  SendMessageCommand,
  User,
  ChannelJoinRequestCommand,
  LogInRequestCommand,
  MessageReceivedCommand,
  ChannelListCommand,
  ChannelJoinCompletedCommand,
  LogInCompletedCommand,
  LogInRefusedCommand,
  ToServerCommand,
  ToClientCommand,
  ChannelJoinRefusedCommand,
  ChannelLeaveRefusedCommand,
  ChannelCreateRefusedCommand,
  ChannelCreateCompletedCommand,
  ChannelLeaveCompletedCommand,
  ChannelLeaveRequestCommand,
  ChannelCreateRequestCommand,
  SignUpRequestCommand,
  SignUpRequest,
  LookupRequest,
  LookupResult,
  LookupResultCommand,
  LookupError,
  LookupErrorCommand,
  LookupRequestCommand,
  HuffmanEncodedFile,
  OutgoingEncodedFile,
  IncomingEncodedFile,
  OutgoingEncodedFileCommand,
  IncomingEncodedFileCommand,
  FileSharingError,
  FileSharingErrorCommand,
  SignUpRefusedCommand,
  SignUpCompleted,
  SignUpRefused,
  SignUpCompletedCommand,
  OutgoingMessage,
  IncomingMessage,
  MessageSendingError,
  RequestMessageHistory,
  MessageHistoryResponse,
  MessageHistoryError,
  MessageSendingErrorCommand,
  RequestMessageHistoryCommand,
  MessageHistoryResponseCommand,
  MessageHistoryErrorCommand,
  MissingPermissionsError,
  InternalError,
  ZodError,
  ParsingError,
  ServerError,
  ServerErrorCommand,
  NicknameChangeRequest,
  NicknameChangeSuccess,
  NicknameChangeRefused,
  NicknameChangeRefusedCommand,
  NicknameChangeSuccessCommand,
  NicknameChangeRequestCommand,
  DeleteUserRequest,
  DeleteUserRequestCommand,
  DeleteUserRefusedCommand,
  DeleteUserRefused,
  DeleteUserSuccess,
  DeleteUserSuccessCommand,
  NewUserJoinedBroadcast,
  NewUserJoinedBroadcastCommand,
  NewUserJoinedBroadcastTrigger,
  NewUserJoinedBroadcastTriggerCommand,
  ListFilesRequestCommand,
  ListFilesRequest,
  ListFilesResponseCommand,
  ListFileEntry,
  ListFilesResponse,
  FileRequest,
  FileRequestCommand,
  EncodedFile,
  LZWEncodedFile,
  RequestParticipants,
  ParticipantsResponse,
  ParticipantsError,
  RequestParticipantsCommand,
  ParticipantsErrorCommand,
  ParticipantsResponseCommand,
  ChannelInviteRequest,
  ChannelInviteCompleted,
  ChannelInviteRefused,
  ChannelInviteBroadcastRequest,
  ChannelInvitesBroadcast,
  AcceptChannelInviteRequest,
  AcceptChannelInviteCompleted,
  AcceptChannelInviteRefused,
  RejectChannelInviteRefused,
  RejectChannelInviteCompleted,
  RejectChannelInviteRequest,
  ChannelInviteRequestCommand,
  ChannelInviteBroadcastRequestCommand,
  AcceptChannelInviteRequestCommand,
  RejectChannelInviteRequestCommand,
  AcceptChannelInviteCompletedCommand,
  AcceptChannelInviteRefusedCommand,
  RejectChannelInviteCompletedCommand,
  RejectChannelInviteRefusedCommand,
  ChannelInvitesBroadcastCommand,
  ChannelInviteCompletedCommand,
  ChannelInviteRefusedCommand,
  FileContentCommand,
  UserClosedUpdateTriggerCommand,
  UserClosedUpdateTrigger,
  UpdatePublicKey,
  PublicKeyRequest,
  PublicKeyResponse,
  PublicKeyRefused,
  UpdatePublicKeyCommand,
  UpdatePublicKeyRefused,
  UpdatePublicKeyRefusedCommand,
  PublicKeyResponseCommand,
  PublicKeyRequestCommand,
  PublicKeyRefusedCommand,
} from './proto.mjs';

/**
 * It checks if the provided user ID is a string and if it represents a valid email
 */
export const userIdSchema = z.string().email('The userID has to be an email');

/**
 * It checks if the provided channel ID is a non-empty string
 */
export const channelIdSchema = z.string().min(1, 'The channel ID can not be an empty string');

/**
 * It checks if the provided user nickname is a non-empty string with a max length of 30
 */
export const userNickSchema = z
  .string({ required_error: 'The user nickname is required' })
  .min(1, 'The user nickname can not be an empty string')
  .max(30, 'The user nickname has a max length of 30');

/**
 * It checks if the provided channel name is a non-empty string with a max length of 30
 */
export const channelNameSchema = z
  .string({ required_error: 'The channel name is required' })
  .min(1, 'The channel name can not be an empty string')
  .max(30, 'The channel name has a max length of 30');

/**
 * It checks if the provided channel type is public, private, private_encrypted, direct_message or direct_message_encrypted.
 */
export const channelTypeSchema = z
  .literal('public')
  .or(z.literal('private'))
  .or(z.literal('private_encrypted'))
  .or(z.literal('direct_message'))
  .or(z.literal('direct_message_encrypted'));

/**
 * It checks if the provided password is a non-empty string with a max length of 30
 */
export const passwordSchema = z.string().superRefine((s, strengthCheck) => {
  const isUpperCase = (ch: string) => /[A-Z]/.test(ch);
  const isLowerCase = (ch: string) => /[a-z]/.test(ch);
  const isNumber = (ch: string) => !isNaN(+ch);
  const addIssue = (check: z.RefinementCtx, mess: string) => check.addIssue({ code: 'custom', message: mess });
  let countOfUpperCase = 0,
    countOfLowerCase = 0,
    countOfNumbers = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (isNumber(ch)) countOfNumbers++;
    else if (isUpperCase(ch)) countOfUpperCase++;
    else if (isLowerCase(ch)) countOfLowerCase++;
  }
  if (s.length === 0) {
    addIssue(strengthCheck, 'A password can not be an empty string');
  }
  if (s.length < 8) {
    addIssue(strengthCheck, 'A password has a minimum length of 8');
  }
  if (s.length > 30) {
    addIssue(strengthCheck, 'A password has a max length of 30');
  }
  if (/\s/.test(s)) {
    addIssue(strengthCheck, 'A password can not contain whitespace');
  }
  if (countOfNumbers < 1) {
    addIssue(strengthCheck, 'A password contains at least 1 number');
  }
  if (countOfLowerCase < 1) {
    addIssue(strengthCheck, 'A password contains at least 1 lowercase letter');
  }
  if (countOfUpperCase < 1) {
    addIssue(strengthCheck, 'A password contains at least 1 uppercase letter');
  }
});

/**
 * Accepts a datestring in ISO-format as input of the parse function and outputs a luxon DateTime object
 */
export const dateTimeSchema = z
  .string({ required_error: 'The time field is required' })
  .transform((isoString) => DateTime.fromISO(isoString, { setZone: true }))
  .refine((dateTime) => dateTime.isValid, "The given string isn't in the ISO date time format");

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the User interface
 * and returns it as a User object if it passes
 */
export const userSchema: z.ZodSchema<User> = z.lazy(() =>
  z.object({
    id: userIdSchema,
    username: userNickSchema.optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the OutgoingMessage interface
 * and returns it as a OutgoingMessage object if it passes
 */
export const outgoingMessageSchema: z.ZodSchema<OutgoingMessage> = z.lazy(() =>
  z.object({
    msg: z.string().min(1, 'A message can not be empty'),
    channel: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the IncomingMessage interface
 * and returns it as a IncomingMessage object if it passes
 */
export const incomingMessageSchema: z.ZodSchema<IncomingMessage> = z.lazy(() =>
  z.object({
    sender: userSchema,
    time: dateTimeSchema,
    msg: z.string().min(1, 'A message can not be empty'),
    channel: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the MessageSendingError interface
 * and returns it as a MessageSendingError object if it passes
 */
export const messageSendingErrorSchema: z.ZodSchema<MessageSendingError> = z.lazy(() =>
  z.object({
    error_code: z.number(),
    reason: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RequestMessageHistory interface
 * and returns it as a RequestMessageHistory object if it passes
 */
export const requestMessageHistorySchema: z.ZodSchema<RequestMessageHistory> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    amount: z.number(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RequestParticipants interface
 * and returns it as a RequestParticipants object if it passes
 */
export const requestParticipantsSchema: z.ZodSchema<RequestParticipants> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRequest interface
 * and returns it as a NicknameChangeRequest object if it passes
 */
export const nicknameChangeRequestSchema: z.ZodSchema<NicknameChangeRequest> = z.lazy(() =>
  z.object({
    nickname: userNickSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRequest interface
 * and returns it as a DeleteUserRequest object if it passes
 */
export const deleteUserRequestSchema: z.ZodSchema<DeleteUserRequest> = z.lazy(() =>
  z.object({
    user: userSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the MessageHistoryResponse interface
 * and returns it as a MessageHistoryResponse object if it passes
 */
export const messageHistoryResponseSchema: z.ZodSchema<MessageHistoryResponse> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    messages: z.array(incomingMessageSchema),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ParticipantsResponse interface
 * and returns it as a ParticipantsResponse object if it passes
 */
export const participantsResponseSchema: z.ZodSchema<ParticipantsResponse> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    participants: z.array(z.tuple([userSchema, dateTimeSchema])),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the MessageHistoryError interface
 * and returns it as a MessageHistoryError object if it passes
 */
export const messageHistoryErrorSchema: z.ZodSchema<MessageHistoryError> = z.lazy(() =>
  z.object({
    error_code: z.number(),
    reason: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ParticipantsError interface
 * and returns it as a ParticipantsError object if it passes
 */
export const participantsErrorSchema: z.ZodSchema<ParticipantsError> = z.lazy(() =>
  z.object({
    error_code: z.number(),
    reason: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LookupRequest interface
 * and returns it as a LookupRequest object if it passes
 */
export const lookupRequestSchema: z.ZodSchema<LookupRequest> = z.lazy(() =>
  z.object({
    time: dateTimeSchema,
    channel_id: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LookupResult interface
 * and returns it as a LookupResult object if it passes
 */
export const lookupResultSchema: z.ZodSchema<LookupResult> = z.lazy(() =>
  z.object({
    messages: z.array(incomingMessageSchema),
    resultIndex: z.number(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LookupError interface
 * and returns it as a LookupError object if it passes
 */
export const lookupErrorSchema: z.ZodSchema<LookupError> = z.lazy(() =>
  z.object({
    error_code: z.number(),
    reason: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the Channel interface
 * and returns it as a Channel object if it passes
 */
export const channelSchema: z.ZodSchema<Channel> = z.lazy(() =>
  z.object({
    name: channelNameSchema,
    id: channelIdSchema,
    type: channelTypeSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelList interface
 * and returns it as a ChannelList object if it passes
 */
export const channelListSchema: z.ZodSchema<ChannelList> = z.lazy(() =>
  z.object({
    channels: z.array(channelSchema),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelJoinRequest interface
 * and returns it as a ChannelJoinRequest object if it passes
 */
export const channelJoinRequestSchema: z.ZodSchema<ChannelJoinRequest> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInviteRequest interface
 * and returns it as a ChannelInviteRequest object if it passes
 */
export const channelInviteRequestSchema: z.ZodSchema<ChannelInviteRequest> = z.lazy(() =>
  z.object({
    receiver: userIdSchema,
    channel_id: channelIdSchema,
    encrypted_secret: z.optional(z.string()),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInviteCompleted interface
 * and returns it as a ChannelInviteCompleted object if it passes
 */
export const channelInviteCompletedSchema: z.ZodSchema<ChannelInviteCompleted> = z.lazy(() => z.object({}));

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInviteBroadcastRequest interface
 * and returns it as a ChannelInviteBroadcastRequest object if it passes
 */
export const channelInviteBroadcastRequestSchema: z.ZodSchema<ChannelInviteBroadcastRequest> = z.lazy(() =>
  z.object({}),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the AcceptChannelInviteCompleted interface
 * and returns it as a AcceptChannelInviteCompleted object if it passes
 */
export const acceptChannelInviteCompletedSchema: z.ZodSchema<AcceptChannelInviteCompleted> = z.lazy(() => z.object({}));

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RejectChannelInviteCompleted interface
 * and returns it as a RejectChannelInviteCompleted object if it passes
 */
export const rejectChannelInviteCompletedSchema: z.ZodSchema<RejectChannelInviteCompleted> = z.lazy(() => z.object({}));

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInviteRefused interface
 * and returns it as a ChannelInviteRefused object if it passes
 */
export const channelInviteRefusedSchema: z.ZodSchema<ChannelInviteRefused> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the AcceptChannelInviteRefused interface
 * and returns it as a AcceptChannelInviteRefused object if it passes
 */
export const acceptChannelInviteRefusedSchema: z.ZodSchema<AcceptChannelInviteRefused> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RejectChannelInviteRefused interface
 * and returns it as a RejectChannelInviteRefused object if it passes
 */
export const rejectChannelInviteRefusedSchema: z.ZodSchema<RejectChannelInviteRefused> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInvitesBroadcast interface
 * and returns it as a ChannelInvitesBroadcast object if it passes
 */
export const channelInvitesBroadcastSchema: z.ZodSchema<ChannelInvitesBroadcast> = z.lazy(() =>
  z.object({
    invites: channelSchema.array(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the AcceptChannelInviteRequest interface
 * and returns it as a AcceptChannelInviteRequest object if it passes
 */
export const acceptChannelInviteRequestSchema: z.ZodSchema<AcceptChannelInviteRequest> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RejectChannelInviteRequest interface
 * and returns it as a RejectChannelInviteRequest object if it passes
 */
export const rejectChannelInviteRequestSchema: z.ZodSchema<RejectChannelInviteRequest> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelJoinCompleted interface
 * and returns it as a ChannelJoinCompleted object if it passes
 */
export const channelJoinCompletedSchema: z.ZodSchema<ChannelJoinCompleted> = z.lazy(() =>
  z.object({
    channel: channelSchema,
    encrypted_secret: z.string().optional(),
    peer_public_key: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelJoinRefused interface
 * and returns it as a ChannelJoinRefused object if it passes
 */
export const channelJoinRefusedSchema: z.ZodSchema<ChannelJoinRefused> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelLeaveRequest interface
 * and returns it as a ChannelLeaveRequest object if it passes
 */
export const channelLeaveRequestSchema: z.ZodSchema<ChannelLeaveRequest> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelLeaveCompleted interface
 * and returns it as a ChannelLeaveCompleted object if it passes
 */
export const channelLeaveCompletedSchema: z.ZodSchema<ChannelLeaveCompleted> = z.lazy(() =>
  z.object({
    channel: channelSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelLeaveRefused interface
 * and returns it as a ChannelLeaveRefused object if it passes
 */
export const channelLeaveRefusedSchema: z.ZodSchema<ChannelLeaveRefused> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelCreateRequest interface
 * and returns it as a ChannelCreateRequest object if it passes
 */
export const channelCreateRequestSchema: z.ZodSchema<ChannelCreateRequest> = z.lazy(() =>
  z.object({
    name: channelNameSchema,
    type: channelTypeSchema,
    invited_participants: userIdSchema.array().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the channelCreateCompleted interface
 * and returns it as a channelCreateCompleted object if it passes
 */
export const channelCreateCompletedSchema: z.ZodSchema<ChannelCreateCompleted> = z.lazy(() =>
  z.object({
    channel: channelSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelCreateRefused interface
 * and returns it as a ChannelCreateRefused object if it passes
 */
export const channelCreateRefusedSchema: z.ZodSchema<ChannelCreateRefused> = z.lazy(() =>
  z.object({
    channel_name: channelNameSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LogInRequest interface
 * and returns it as a LogInRequest object if it passes
 */
export const logInRequestSchema: z.ZodSchema<LogInRequest> = z.lazy(() =>
  z.object({
    user: userSchema,
    password: passwordSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the SignUpRequest interface
 * and returns it as a SignUpRequest object if it passes
 */
export const signUpRequestSchema: z.ZodSchema<SignUpRequest> = z.lazy(() =>
  z.object({
    user: userSchema,
    password: passwordSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the SignUpRefused interface
 * and returns it as a SignUpRefused object if it passes
 */
export const signUpRequestRefusedSchema: z.ZodSchema<SignUpRefused> = z.lazy(() =>
  z.object({
    user: userSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the SignUpCompleted interface
 * and returns it as a SignUpCompleted object if it passes
 */
export const signUpRequestCompletedSchema: z.ZodSchema<SignUpCompleted> = z.lazy(() =>
  z.object({
    user: userSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the UpdatePublicKey interface
 * and returns it as a UpdatePublicKey object if it passes
 */
export const updatePublicKeySchema: z.ZodSchema<UpdatePublicKey> = z.lazy(() =>
  z.object({
    public_key: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the UpdatePublicKeyRefused interface
 * and returns it as a UpdatePublicKeyRefused object if it passes
 */
export const updatePublicKeyRefusedSchema: z.ZodSchema<UpdatePublicKeyRefused> = z.lazy(() =>
  z.object({
    error_code: z.number(),
    reason: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the PublicKeyRequest interface
 * and returns it as a PublicKeyRequest object if it passes
 */
export const publicKeyRequestSchema: z.ZodSchema<PublicKeyRequest> = z.lazy(() =>
  z.object({
    user_id: userIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the PublicKeyResponse interface
 * and returns it as a PublicKeyResponse object if it passes
 */
export const publicKeyResponseSchema: z.ZodSchema<PublicKeyResponse> = z.lazy(() =>
  z.object({
    user_id: userIdSchema,
    public_key: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the PublicKeyRefused interface
 * and returns it as a PublicKeyRefused object if it passes
 */
export const publicKeyRefusedSchema: z.ZodSchema<PublicKeyRefused> = z.lazy(() =>
  z.object({
    user_id: userIdSchema,
    error_code: z.number(),
    reason: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the SignUpRefusedCommand interface
 * and returns it as a SignUpRefusedCommand object if it passes
 */
export const signUpRequestRefusedCommandSchema: z.ZodSchema<SignUpRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('signup_refused'),
    data: signUpRequestRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInviteRequestCommand interface
 * and returns it as a ChannelInviteRequestCommand object if it passes
 */
export const channelInviteRequestCommandSchema: z.ZodSchema<ChannelInviteRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_invite_request'),
    data: channelInviteRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInviteBroadcastRequestCommand interface
 * and returns it as a ChannelInviteBroadcastRequestCommand object if it passes
 */
export const channelInviteBroadcastRequestCommandSchema: z.ZodSchema<ChannelInviteBroadcastRequestCommand> = z.lazy(
  () =>
    z.object({
      command: z.literal('channel_invite_broadcast_request'),
      data: channelInviteBroadcastRequestSchema,
    }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the AcceptChannelInviteRequestCommand interface
 * and returns it as a AcceptChannelInviteRequestCommand object if it passes
 */
export const acceptChannelInviteRequestCommandSchema: z.ZodSchema<AcceptChannelInviteRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('accept_channel_invite_request'),
    data: acceptChannelInviteRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RejectChannelInviteRequestCommand interface
 * and returns it as a RejectChannelInviteRequestCommand object if it passes
 */
export const rejectChannelInviteRequestCommandSchema: z.ZodSchema<RejectChannelInviteRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('reject_channel_invite_request'),
    data: rejectChannelInviteRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the AcceptChannelInviteCompletedCommand interface
 * and returns it as a AcceptChannelInviteCompletedCommand object if it passes
 */
export const acceptChannelInviteCompletedCommandSchema: z.ZodSchema<AcceptChannelInviteCompletedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('accept_invite_completed'),
    data: acceptChannelInviteCompletedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the AcceptChannelInviteRefusedCommand interface
 * and returns it as a AcceptChannelInviteRefusedCommand object if it passes
 */
export const acceptChannelInviteRefusedCommandSchema: z.ZodSchema<AcceptChannelInviteRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('accept_invite_refused'),
    data: acceptChannelInviteRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RejectChannelInviteCompletedCommand interface
 * and returns it as a RejectChannelInviteCompletedCommand object if it passes
 */
export const rejectChannelInviteCompletedCommandSchema: z.ZodSchema<RejectChannelInviteCompletedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('reject_invite_completed'),
    data: rejectChannelInviteCompletedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RejectChannelInviteRefusedCommand interface
 * and returns it as a RejectChannelInviteRefusedCommand object if it passes
 */
export const rejectChannelInviteRefusedCommandSchema: z.ZodSchema<RejectChannelInviteRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('reject_invite_refused'),
    data: rejectChannelInviteRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInvitesBroadcastCommand interface
 * and returns it as a ChannelInvitesBroadcastCommand object if it passes
 */
export const channelInvitesBroadcastCommandSchema: z.ZodSchema<ChannelInvitesBroadcastCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channels_broadcast_incoming'),
    data: channelInvitesBroadcastSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInviteCompletedCommand interface
 * and returns it as a ChannelInviteCompletedCommand object if it passes
 */
export const channelInviteCompletedCommandSchema: z.ZodSchema<ChannelInviteCompletedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('invite_channel_completed'),
    data: channelInviteCompletedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelInviteRefusedCommand interface
 * and returns it as a ChannelInviteRefusedCommand object if it passes
 */
export const channelInviteRefusedCommandSchema: z.ZodSchema<ChannelInviteRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('invite_channel_refused'),
    data: channelInviteRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRefused interface
 * and returns it as a NicknameChangeRefused object if it passes
 */
export const nicknameChangeRefusedSchema: z.ZodSchema<NicknameChangeRefused> = z.lazy(() =>
  z.object({
    user: userSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRefusedCommand interface
 * and returns it as a NicknameChangeRefusedCommand object if it passes
 */
export const nicknameChangeRefusedCommandSchema: z.ZodSchema<NicknameChangeRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('nickname_change_refused'),
    data: nicknameChangeRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRefused interface
 * and returns it as a DeleteUserRefused object if it passes
 */
export const deleteUserRefusedSchema: z.ZodSchema<DeleteUserRefused> = z.lazy(() =>
  z.object({
    user: userSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRefusedCommand interface
 * and returns it as a DeleteUserRefusedCommand object if it passes
 */
export const deleteUserRefusedCommandSchema: z.ZodSchema<DeleteUserRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('delete_user_refused'),
    data: deleteUserRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeSuccessSchema interface
 * and returns it as a NicknameChangeSuccessSchema object if it passes
 */
export const nicknameChangeSuccessSchema: z.ZodSchema<NicknameChangeSuccess> = z.lazy(() =>
  z.object({
    user: userSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeSuccessCommand interface
 * and returns it as a NicknameChangeSuccessCommand object if it passes
 */
export const nicknameChangeSuccessCommandSchema: z.ZodSchema<NicknameChangeSuccessCommand> = z.lazy(() =>
  z.object({
    command: z.literal('nickname_change_success'),
    data: nicknameChangeSuccessSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeSuccessSchema interface
 * and returns it as a DeleteUserSuccessSchema object if it passes
 */
export const deleteUserSuccessSchema: z.ZodSchema<DeleteUserSuccess> = z.lazy(() =>
  z.object({
    user: userSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeSuccessCommand interface
 * and returns it as a NicknameChangeSuccessCommand object if it passes
 */
export const deleteUserSuccessCommandSchema: z.ZodSchema<DeleteUserSuccessCommand> = z.lazy(() =>
  z.object({
    command: z.literal('delete_user_success'),
    data: deleteUserSuccessSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the SignUpCompletedCommand interface
 * and returns it as a SignUpCompletedCommand object if it passes
 */
export const signUpRequestCompletedCommandSchema: z.ZodSchema<SignUpCompletedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('signup_completed'),
    data: signUpRequestCompletedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LogInCompleted interface
 * and returns it as a LogInCompleted object if it passes
 */
export const logInCompletedSchema: z.ZodSchema<LogInCompleted> = z.lazy(() =>
  z.object({
    user: userSchema,
    currentChannels: channelListSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LogInRefused interface
 * and returns it as a LogInRefused object if it passes
 */
export const logInRefusedSchema: z.ZodSchema<LogInRefused> = z.lazy(() =>
  z.object({
    user: userSchema,
    error_code: z.number(),
    reason: z.string().optional(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the HuffmanEncodedFile interface
 * and returns it as a HuffmanEncodedFile object if it passes
 */
export const huffmanEncodedFileSchema: z.ZodSchema<HuffmanEncodedFile> = z.lazy(() =>
  z.object({
    encoding_type: z.literal('huffman'),
    file_content_key: z.number(),
    channel_id: channelIdSchema,
    huffman_tree: z.array(z.tuple([z.number(), z.string()])).min(1, 'We can not send an empty tree'),
    encoded_file: z.array(z.number()).refine((arr) => arr[0] === 0, {
      message: 'The huffman encoded file array must start with 0',
    }),
  }),
);

/**
 * Accepts an unknown array as parameter of the parse function and checks if it contains the required data of the *huffman*FileContentCommand interface
 * and returns it as a FileContentCommand object if it passes
 */
export const huffmanFileContentCommandSchema: z.ZodSchema<FileContentCommand, z.ZodTypeDef, number[]> = z
  .array(z.number())
  .refine(([id, ..._]) => id === 1)
  .transform(([_id, file_content_key, ...content]) => {
    if (!file_content_key) throw new Error('not a valid file content key.');

    const fileLengthArray = content.splice(0, 3);

    let resultBinary = '';
    for (const currentNumber of fileLengthArray) {
      resultBinary += ('000000000000000000000000' + Number(currentNumber).toString(2)).slice(-8);
    }
    const fileLength = parseInt(resultBinary, 2);
    const fileContent = content.splice(0, fileLength);

    const treeLenghtArray = content.splice(0, 3);
    resultBinary = '';
    for (const currentNumber of treeLenghtArray) {
      resultBinary += ('000000000000000000000000' + Number(currentNumber).toString(2)).slice(-8);
    }
    const treeLength = parseInt(resultBinary, 2);
    const treeEntries = content.splice(0, treeLength);
    const tree: [number, string][] = [];

    const amountOfTuples = treeEntries.shift();
    if (!amountOfTuples) {
      throw new Error('amountOfTuples was undefined during parsing');
    }
    let i = 0;
    while (i < treeEntries.length) {
      const decodedCharacterIntValue = treeEntries[i]!;
      let encodedCharacterString = '';
      const lengthOfEncoding = treeEntries[i + 1]!;
      for (let j = 0; j < lengthOfEncoding; j++) {
        const currentEncodedByte = treeEntries[i + 2 + j];
        if (currentEncodedByte === 48) {
          encodedCharacterString += '0';
        } else if (currentEncodedByte === 49) {
          encodedCharacterString += '1';
        } else {
          throw new Error(`expected 48 or 49 during tree parsing but got ${currentEncodedByte}`);
        }
      }
      i += 2 + lengthOfEncoding;
      tree.push([decodedCharacterIntValue, encodedCharacterString]);
    }

    const channel_id = String.fromCharCode(...content);

    const data: HuffmanEncodedFile = {
      encoding_type: 'huffman',
      file_content_key,
      encoded_file: fileContent,
      huffman_tree: tree,
      channel_id: channel_id,
    };

    return {
      command: 'file_content',
      data: data,
    };
  });
/**
 * Accepts an unknown array as parameter of the parse function and checks if it contains the required data of the *lzw*FileContentCommand interface
 * and returns it as a FileContentCommand object if it passes
 */
export const lzwFileContentCommandSchema: z.ZodSchema<FileContentCommand, z.ZodTypeDef, number[]> = z
  .array(z.number())
  .refine(([id, ..._]) => id === 2)
  .transform(([_id, file_content_key, ...content]) => {
    if (!file_content_key) throw new Error('not a valid file content key.');
    const fileLengthArray = content.splice(0, 3);
    let resultBinary = '';
    for (const currentNumber of fileLengthArray) {
      resultBinary += ('000000000000000000000000' + Number(currentNumber).toString(2)).slice(-8);
    }
    const fileLength = parseInt(resultBinary, 2);
    const fileContent = content.splice(0, fileLength);
    const channel_id = String.fromCharCode(...content);

    const data: LZWEncodedFile = {
      encoding_type: 'LZW',
      file_content_key: file_content_key,
      encoded_file: fileContent,
      channel_id: channel_id,
    };

    return {
      command: 'file_content',
      data: data,
    };
  });

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LZWEncodedFile interface
 * and returns it as a LZWEncodedFile object if it passes
 */
export const lZWEncodedFileSchema: z.ZodSchema<LZWEncodedFile> = z.lazy(() =>
  z.object({
    encoding_type: z.literal('LZW'),
    encoded_file: z.array(z.number()),
    file_content_key: z.number(),
    channel_id: channelIdSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the OutgoingEncodedFile interface
 * and returns it as a OutgoingEncodedFile object if it passes
 */
export const outgoingEncodedFileSchema: z.ZodSchema<OutgoingEncodedFile> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    file_content_key: z.number(),
    file_name: z.string().min(1),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the IncomingEncodedFile interface
 * and returns it as a IncomingEncodedFile object if it passes
 */
export const incomingEncodedFileSchema: z.ZodSchema<IncomingEncodedFile> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel_id: channelIdSchema,
    file_content_key: z.number(),
    file_name: z.string().min(1),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it matches any of the following interfaces
 *  - HuffmanEncodedFile
 *  - LZWEncodedFile
 * and returns it as a EncodedFile object if it passes
 */
export const encodedFileSchema: z.ZodSchema<EncodedFile> = huffmanEncodedFileSchema.or(lZWEncodedFileSchema);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ListFilesRequest interface
 * and returns it as a ListFilesRequest object if it passes
 */
export const listFilesRequestSchema: z.ZodSchema<ListFilesRequest> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
  }),
);

/**
 * Accepts an unknown AAAjavascript object as parameter of the parse function and checks if it contains the required fields of the ListFilesResponse interface
 * and returns it as a ListFilesResponse object if it passes
 */
export const ListFileEntrySchema: z.ZodSchema<ListFileEntry> = z.lazy(() =>
  z.object({
    file_name: z.string().min(1),
    file_ID: z.string().min(1),
    sender: userSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the incomingFileList interface
 * and returns it as a incomingFileList object if it passes
 */
export const listFilesResponseSchema: z.ZodSchema<ListFilesResponse> = z.lazy(() =>
  z.object({
    list_of_files: z.array(ListFileEntrySchema),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the fileRequest interface
 * and returns it as a fileRequest object if it passes
 */
export const fileRequestSchema: z.ZodSchema<FileRequest> = z.lazy(() =>
  z.object({
    channel_id: z.string().min(1),
    file_hash: z.string().min(1),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the FileSharingError interface
 * and returns it as a FileSharingError object if it passes
 */
export const fileSharingErrorSchema: z.ZodSchema<FileSharingError> = z.lazy(() =>
  z.object({
    error_code: z.number(),
    reason: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the InternalError interface
 * and returns it as a InternalError object if it passes
 */
const internalErrorSchema: z.ZodSchema<InternalError> = z.lazy(() =>
  z.object({
    error_code: z.literal(0),
    message: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ZodError interface
 * and returns it as a ZodError object if it passes
 */
const zodErrorSchema: z.ZodSchema<ZodError> = z.lazy(() =>
  z.object({
    path: z.array(z.string().or(z.number())),
    message: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ParsingError interface
 * and returns it as a ParsingError object if it passes
 */
const parsingErrorSchema: z.ZodSchema<ParsingError> = z.lazy(() =>
  z.object({
    error_code: z.literal(1),
    errors: z.array(zodErrorSchema),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the MissingPermissionsError interface
 * and returns it as a MissingPermissionsError object if it passes
 */
const missingPermissionsErrorSchema: z.ZodSchema<MissingPermissionsError> = z.lazy(() =>
  z.object({
    error_code: z.literal(2),
    command: z.string(),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it matches any of the following interfaces
 *  - InternalError
 *  - ParsingError
 *  - MissingPermissionsError
 * and returns it as a ServerError object if it passes
 */
export const serverErrorSchema: z.ZodSchema<ServerError> = internalErrorSchema
  .or(parsingErrorSchema)
  .or(missingPermissionsErrorSchema);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the SendMessageCommand interface
 * and returns it as a SendMessageCommand object if it passes
 */
const sendMessageCommandSchema: z.ZodSchema<SendMessageCommand> = z.lazy(() =>
  z.object({
    command: z.literal('send_message'),
    data: outgoingMessageSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the MessageSendingErrorCommand interface
 * and returns it as a MessageSendingErrorCommand object if it passes
 */
const messageSendingErrorCommandSchema: z.ZodSchema<MessageSendingErrorCommand> = z.lazy(() =>
  z.object({
    command: z.literal('message_sending_error'),
    data: messageSendingErrorSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRequestCommand interface
 * and returns it as a NicknameChangeRequestCommand object if it passes
 */
const nicknameChangeRequestCommandSchema: z.ZodSchema<NicknameChangeRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('nickname_change_request'),
    data: nicknameChangeRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRequestCommand interface
 * and returns it as a DeleteUserRequestCommand object if it passes
 */
const deleteUserRequestCommandSchema: z.ZodSchema<DeleteUserRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('delete_user_request'),
    data: deleteUserRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RequestMessageHistoryCommand interface
 * and returns it as a RequestMessageHistoryCommand object if it passes
 */
const requestMessageHistoryCommandSchema: z.ZodSchema<RequestMessageHistoryCommand> = z.lazy(() =>
  z.object({
    command: z.literal('request_message_history'),
    data: requestMessageHistorySchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the RequestParticipantsCommand interface
 * and returns it as a RequestParticipantsCommand object if it passes
 */
const requestParticipantsCommandSchema: z.ZodSchema<RequestParticipantsCommand> = z.lazy(() =>
  z.object({
    command: z.literal('request_participants'),
    data: requestParticipantsSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the MessageHistoryResponseCommand interface
 * and returns it as a MessageHistoryResponseCommand object if it passes
 */
const messageHistoryResponseCommandSchema: z.ZodSchema<MessageHistoryResponseCommand> = z.lazy(() =>
  z.object({
    command: z.literal('message_history_response'),
    data: messageHistoryResponseSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ParticipantsResponseCommand interface
 * and returns it as a ParticipantsResponseCommand object if it passes
 */
const participantsResponseCommandSchema: z.ZodSchema<ParticipantsResponseCommand> = z.lazy(() =>
  z.object({
    command: z.literal('participants_response'),
    data: participantsResponseSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the MessageHistoryErrorCommand interface
 * and returns it as a MessageHistoryErrorCommand object if it passes
 */
const messageHistoryErrorCommandSchema: z.ZodSchema<MessageHistoryErrorCommand> = z.lazy(() =>
  z.object({
    command: z.literal('message_history_error'),
    data: messageHistoryErrorSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ParticipantsErrorCommand interface
 * and returns it as a ParticipantsErrorCommand object if it passes
 */
const participantsErrorCommandSchema: z.ZodSchema<ParticipantsErrorCommand> = z.lazy(() =>
  z.object({
    command: z.literal('participants_error'),
    data: participantsErrorSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LookupRequestCommand interface
 * and returns it as a LookupRequestCommand object if it passes
 */
const lookupRequestCommandSchema: z.ZodSchema<LookupRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('lookup_request'),
    data: lookupRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LookupResultCommand interface
 * and returns it as a LookupResultCommand object if it passes
 */
const lookupResultCommandSchema: z.ZodSchema<LookupResultCommand> = z.lazy(() =>
  z.object({
    command: z.literal('lookup_result'),
    data: lookupResultSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LookupErrorCommand interface
 * and returns it as a LookupErrorCommand object if it passes
 */
const lookupErrorCommandSchema: z.ZodSchema<LookupErrorCommand> = z.lazy(() =>
  z.object({
    command: z.literal('lookup_error'),
    data: lookupErrorSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelJoinRequestCommand interface
 * and returns it as a ChannelJoinRequestCommand object if it passes
 */
const channelJoinRequestCommandSchema: z.ZodSchema<ChannelJoinRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_join_request'),
    data: channelJoinRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelLeaveRequestCommand interface
 * and returns it as a ChannelLeaveRequestCommand object if it passes
 */
const channelLeaveRequestCommandSchema: z.ZodSchema<ChannelLeaveRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_leave_request'),
    data: channelLeaveRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelCreateRequestCommand interface
 * and returns it as a ChannelCreateRequestCommand object if it passes
 */
const channelCreateRequestCommandSchema: z.ZodSchema<ChannelCreateRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_create_request'),
    data: channelCreateRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LogInRequestCommand interface
 * and returns it as a LogInRequestCommand object if it passes
 */
const logInRequestCommandSchema: z.ZodSchema<LogInRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('login_request'),
    data: logInRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the SignUpRequestCommand interface
 * and returns it as a SignUpRequestCommand object if it passes
 */
const signUpRequestCommandSchema: z.ZodSchema<SignUpRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('signup_request'),
    data: signUpRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the MessageReceivedCommand interface
 * and returns it as a MessageReceivedCommand object if it passes
 */
const messageReceivedCommandSchema: z.ZodSchema<MessageReceivedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('message_received'),
    data: incomingMessageSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelListCommand interface
 * and returns it as a ChannelListCommand object if it passes
 */
const channelListCommandSchema: z.ZodSchema<ChannelListCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_list'),
    data: channelListSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelJoinCompletedCommand interface
 * and returns it as a ChannelJoinCompletedCommand object if it passes
 */
const channelJoinCompletedCommandSchema: z.ZodSchema<ChannelJoinCompletedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_join_completed'),
    data: channelJoinCompletedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelJoinRefusedCommand interface
 * and returns it as a ChannelJoinRefusedCommand object if it passes
 */
const channelJoinRefusedCommandSchema: z.ZodSchema<ChannelJoinRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_join_refused'),
    data: channelJoinRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelLeaveRefusedCommand interface
 * and returns it as a ChannelLeaveRefusedCommand object if it passes
 */
const channelLeaveCompletedCommandSchema: z.ZodSchema<ChannelLeaveCompletedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_leave_completed'),
    data: channelLeaveCompletedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelLeaveRefusedCommand interface
 * and returns it as a ChannelLeaveRefusedCommand object if it passes
 */
const channelLeaveRefusedCommandSchema: z.ZodSchema<ChannelLeaveRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_leave_refused'),
    data: channelLeaveRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelCreateCompletedCommand interface
 * and returns it as a ChannelCreateCompletedCommand object if it passes
 */
const channelCreateCompletedCommandSchema: z.ZodSchema<ChannelCreateCompletedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_create_completed'),
    data: channelCreateCompletedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelCreateRefusedCommand interface
 * and returns it as a ChannelCreateRefusedCommand object if it passes
 */
const channelCreateRefusedCommandSchema: z.ZodSchema<ChannelCreateRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('channel_create_refused'),
    data: channelCreateRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LogInCompletedCommand interface
 * and returns it as a LogInCompletedCommand object if it passes
 */
const logInCompletedCommandSchema: z.ZodSchema<LogInCompletedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('login_completed'),
    data: logInCompletedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the LogInRefusedCommand interface
 * and returns it as a LogInRefusedCommand object if it passes
 */
const logInRefusedCommandSchema: z.ZodSchema<LogInRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('login_refused'),
    data: logInRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the OutgoingEncodedFileCommand interface
 * and returns it as a OutgoingEncodedFileCommand object if it passes
 */
const outgoingEncodedFileCommandSchema: z.ZodSchema<OutgoingEncodedFileCommand> = z.lazy(() =>
  z.object({
    command: z.literal('outgoing_encoded_file'),
    data: outgoingEncodedFileSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ListFilesRequestCommand interface
 * and returns it as a ListFilesRequestCommand object if it passes
 */
const listFilesRequestCommandSchema: z.ZodSchema<ListFilesRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('list_files_request'),
    data: listFilesRequestSchema,
  }),
);

const fileRequestCommandSchema: z.ZodSchema<FileRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('file_request'),
    data: fileRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the IncomingEncodedFileCommand interface
 * and returns it as a IncomingEncodedFileCommand object if it passes
 */
const incomingEncodedFileCommandSchema: z.ZodSchema<IncomingEncodedFileCommand> = z.lazy(() =>
  z.object({
    command: z.literal('incoming_encoded_file'),
    data: incomingEncodedFileSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the listFilesReponseCommand  interface
 * and returns it as a listFilesReponseCommand object if it passes
 */
const listFilesReponseCommandSchema: z.ZodSchema<ListFilesResponseCommand> = z.lazy(() =>
  z.object({
    command: z.literal('list_files_response'),
    data: listFilesResponseSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the FileSharingErrorCommand interface
 * and returns it as a FileSharingErrorCommand object if it passes
 */
const fileSharingErrorCommandSchema: z.ZodSchema<FileSharingErrorCommand> = z.lazy(() =>
  z.object({
    command: z.literal('file_sharing_error'),
    data: fileSharingErrorSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ServerErrorCommand interface
 * and returns it as a ServerErrorCommand object if it passes
 */
const serverErrorCommandSchema: z.ZodSchema<ServerErrorCommand> = z.lazy(() =>
  z.object({
    command: z.literal('server_error'),
    data: serverErrorSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NewUserJoinedBroadcast interface
 * and returns it as a NewUserJoinedBroadcast object if it passes
 */
const newUserJoinedBroadcastSchema: z.ZodSchema<NewUserJoinedBroadcast> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
    usersInChannel: z.array(userSchema),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NewUserJoinedBroadcastCommand interface
 * and returns it as a NewUserJoinedBroadcastCommand object if it passes
 */
const newUserJoinedBroadcastCommandSchema: z.ZodSchema<NewUserJoinedBroadcastCommand> = z.lazy(() =>
  z.object({
    command: z.literal('new_user_joined_broadcast'),
    data: newUserJoinedBroadcastSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NewUserJoinedBroadcastTrigger interface
 * and returns it as a NewUserJoinedBroadcastTrigger object if it passes
 */
const newUserJoinedBroadcastTriggerSchema: z.ZodSchema<NewUserJoinedBroadcastTrigger> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NewUserJoinedBroadcastTriggerCommand interface
 * and returns it as a NewUserJoinedBroadcastTriggerCommand object if it passes
 */
const newUserJoinedBroadcastTriggerCommandSchema: z.ZodSchema<NewUserJoinedBroadcastTriggerCommand> = z.lazy(() =>
  z.object({
    command: z.literal('new_user_joined_broadcast_trigger'),
    data: newUserJoinedBroadcastTriggerSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the UserClosedUpdateTrigger interface
 * and returns it as a UserClosedUpdateTrigger object if it passes
 */
const userClosedUpdateTriggerSchema: z.ZodSchema<UserClosedUpdateTrigger> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the UserClosedUpdateTriggerCommand interface
 * and returns it as a UserClosedUpdateTriggerCommand object if it passes
 */
const userClosedUpdateTriggerCommandSchema: z.ZodSchema<UserClosedUpdateTriggerCommand> = z.lazy(() =>
  z.object({
    command: z.literal('user_closed_update_trigger'),
    data: userClosedUpdateTriggerSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the UpdatePublicKeyCommand interface
 * and returns it as a UpdatePublicKeyCommand object if it passes
 */
const updatePublicKeyCommandSchema: z.ZodSchema<UpdatePublicKeyCommand> = z.lazy(() =>
  z.object({
    command: z.literal('update_public_key'),
    data: updatePublicKeySchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the UpdatePublicKeyRefusedCommand interface
 * and returns it as a UpdatePublicKeyRefusedCommand object if it passes
 */
const updatePublicKeyRefusedCommandSchema: z.ZodSchema<UpdatePublicKeyRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('update_public_key_refused'),
    data: updatePublicKeyRefusedSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the PublicKeyRequestCommand interface
 * and returns it as a PublicKeyRequestCommand object if it passes
 */
const publicKeyRequestCommandSchema: z.ZodSchema<PublicKeyRequestCommand> = z.lazy(() =>
  z.object({
    command: z.literal('public_key_request'),
    data: publicKeyRequestSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the PublicKeyResponseCommand interface
 * and returns it as a PublicKeyResponseCommand object if it passes
 */
const publicKeyResponseCommandSchema: z.ZodSchema<PublicKeyResponseCommand> = z.lazy(() =>
  z.object({
    command: z.literal('public_key_response'),
    data: publicKeyResponseSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the PublicKeyRefusedCommand interface
 * and returns it as a PublicKeyRefusedCommand object if it passes
 */
const publicKeyRefusedCommandSchema: z.ZodSchema<PublicKeyRefusedCommand> = z.lazy(() =>
  z.object({
    command: z.literal('public_key_refused'),
    data: publicKeyRefusedSchema,
  }),
);

/**
 * Accepts a byte buffer as input of the parse function and outputs it as a string
 * it also checks whether this string is a json object which contains a string "command" and an object "data"
 */
const incomingDataStringSchema = z.coerce
  .string({ invalid_type_error: 'Did not receive a parsable byte buffer', description: 'Parsing incoming data' })
  .regex(
    /\{\s*(?:"command":"\w*",\s*"data":\{.*?\}|"data":\{.*?\},\s*"command":"\w*")\s*\}/gs,
    'The buffer should contain (only) a string "command" and an object "data"',
  );

export const incomingDataArraySchema = z.instanceof(Buffer).transform((buffer) => {
  return [...buffer];
});

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it matches any of the following interfaces:
 *  - SendMessageCommand
 *  - RequestMessageHistoryCommand
 *  - RequestParticipantsCommand
 *  - ChannelJoinRequestCommand
 *  - LogInRequestCommand
 *  - SignUpRequestCommand
 *  - ChannelLeaveRequestCommand
 *  - ChannelCreateRequestCommand
 *  - LookupRequestCommand
 *  - OutgoingEncodedFileCommand
 *  - NewUserJoinedBroadcastTriggerCommand
 *  - UserClosedUpdateTriggerCommand
 *  - ListFilesRequestCommand
 *  - fileRequestCommand
 *  - FileContentCommand
 *  - UpdatePublicKeyCommandSchema
 *  - PublicKeyRequestCommandSchema
 * and returns it as a ToServerCommand object if it passes
 */
export const toServerCommandSchema: z.ZodSchema<ToServerCommand, z.ZodTypeDef, Buffer | string> =
  incomingDataStringSchema
    .transform((str) => JSON.parse(str) as unknown)
    .pipe(
      sendMessageCommandSchema
        .or(requestMessageHistoryCommandSchema)
        .or(channelJoinRequestCommandSchema)
        .or(logInRequestCommandSchema)
        .or(signUpRequestCommandSchema)
        .or(channelLeaveRequestCommandSchema)
        .or(channelCreateRequestCommandSchema)
        .or(lookupRequestCommandSchema)
        .or(outgoingEncodedFileCommandSchema)
        .or(listFilesRequestCommandSchema)
        .or(fileRequestCommandSchema)
        .or(nicknameChangeRequestCommandSchema)
        .or(deleteUserRequestCommandSchema)
        .or(newUserJoinedBroadcastTriggerCommandSchema)
        .or(requestParticipantsCommandSchema)
        .or(userClosedUpdateTriggerCommandSchema)
        .or(channelInviteRequestCommandSchema)
        .or(channelInviteBroadcastRequestCommandSchema)
        .or(acceptChannelInviteRequestCommandSchema)
        .or(rejectChannelInviteRequestCommandSchema)
        .or(updatePublicKeyCommandSchema)
        .or(publicKeyRequestCommandSchema),
    )
    .or(incomingDataArraySchema.pipe(huffmanFileContentCommandSchema))
    .or(incomingDataArraySchema.pipe(lzwFileContentCommandSchema));
/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it matches any of the following interfaces:
 *  - MessageReceivedCommand
 *  - MessageSendingErrorCommand
 *  - MessageHistoryResponseCommand
 *  - MessageHistoryErrorCommand
 *  - ParticipantsResponseCommand
 *  - ParticipantsErrorCommand
 *  - ChannelListCommand
 *  - ChannelJoinCompletedCommand
 *  - ChannelJoinRefusedCommand
 *  - ChannelLeaveCompletedCommand
 *  - ChannelLeaveRefusedCommand
 *  - ChannelCreateCompletedCommand
 *  - ChannelCreateRefusedCommand
 *  - LogInCompletedCommand
 *  - LogInRefusedCommand
 *  - LookupResultCommand
 *  - LookupErrorCommand
 *  - SignUpRequestRefusedCommand
 *  - SignUpRequestCompletedCommand
 *  - IncomingEncodedFileCommand
 *  - FileSharingErrorCommand
 *  - MissingPermissionsErrorCommand
 *  - NewUserJoinedBroadcastCommand
 *  - ListFilesReponseCommand
 *  - FileRequestResponseCommand
 *  - FileContentCommand
 * and returns it as a ToServerCommand object if it passes
 */
export const toClientCommandSchema: z.ZodSchema<ToClientCommand, z.ZodTypeDef, Buffer | string> =
  incomingDataArraySchema
    .pipe(huffmanFileContentCommandSchema)
    .or(incomingDataArraySchema.pipe(lzwFileContentCommandSchema))
    .or(
      incomingDataStringSchema
        .transform((str) => JSON.parse(str) as unknown)
        .pipe(
          messageReceivedCommandSchema
            .or(messageSendingErrorCommandSchema)
            .or(messageHistoryResponseCommandSchema)
            .or(messageHistoryErrorCommandSchema)
            .or(participantsErrorCommandSchema)
            .or(channelListCommandSchema)
            .or(channelJoinCompletedCommandSchema)
            .or(channelJoinRefusedCommandSchema)
            .or(channelLeaveCompletedCommandSchema)
            .or(channelLeaveRefusedCommandSchema)
            .or(channelCreateCompletedCommandSchema)
            .or(channelCreateRefusedCommandSchema)
            .or(logInCompletedCommandSchema)
            .or(logInRefusedCommandSchema)
            .or(lookupResultCommandSchema)
            .or(lookupErrorCommandSchema)
            .or(signUpRequestRefusedCommandSchema)
            .or(signUpRequestCompletedCommandSchema)
            .or(incomingEncodedFileCommandSchema)
            .or(listFilesReponseCommandSchema)
            .or(participantsResponseCommandSchema)
            .or(incomingEncodedFileCommandSchema)
            .or(fileSharingErrorCommandSchema)
            .or(nicknameChangeSuccessCommandSchema)
            .or(nicknameChangeRefusedCommandSchema)
            .or(serverErrorCommandSchema)
            .or(deleteUserRefusedCommandSchema)
            .or(deleteUserSuccessCommandSchema)
            .or(newUserJoinedBroadcastCommandSchema)
            .or(acceptChannelInviteCompletedCommandSchema)
            .or(acceptChannelInviteRefusedCommandSchema)
            .or(rejectChannelInviteCompletedCommandSchema)
            .or(rejectChannelInviteRefusedCommandSchema)
            .or(channelInviteRefusedCommandSchema)
            .or(channelInviteCompletedCommandSchema)
            .or(channelInvitesBroadcastCommandSchema)
            .or(updatePublicKeyRefusedCommandSchema)
            .or(publicKeyResponseCommandSchema)
            .or(publicKeyRefusedCommandSchema),
        ),
    );

export const LockFileNameSchema = z.string().regex(/.*lock.*/);
