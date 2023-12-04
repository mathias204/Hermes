import { z } from 'zod';
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
  FileEncodingError,
  FileEncodingErrorCommand,
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
} from './proto.mjs';
import { DateTime } from 'luxon';

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
 * TODO: improve password security
 *
 * It checks if the provided password is a non-empty string with a max length of 30
 */
export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(1, 'A password can not be an empty string')
  .max(30, 'A password has a max length of 30');

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
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the NicknameChangeRequest interface
 * and returns it as a NicknameChangeRequest object if it passes
 */
export const nicknameChangeRequestSchema: z.ZodSchema<NicknameChangeRequest> = z.lazy(() =>
  z.object({
    nickname: userNickSchema,
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
    channel: channelSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelJoinCompleted interface
 * and returns it as a ChannelJoinCompleted object if it passes
 */
export const channelJoinCompletedSchema: z.ZodSchema<ChannelJoinCompleted> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
    message_history: z.array(incomingMessageSchema).default([]),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelJoinRefused interface
 * and returns it as a ChannelJoinRefused object if it passes
 */
export const channelJoinRefusedSchema: z.ZodSchema<ChannelJoinRefused> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
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
    channel: channelSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelLeaveCompleted interface
 * and returns it as a ChannelLeaveCompleted object if it passes
 */
export const channelLeaveCompletedSchema: z.ZodSchema<ChannelLeaveCompleted> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelLeaveRefused interface
 * and returns it as a ChannelLeaveRefused object if it passes
 */
export const channelLeaveRefusedSchema: z.ZodSchema<ChannelLeaveRefused> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
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
  }),
);

export const channelCreateCompletedSchema: z.ZodSchema<ChannelCreateCompleted> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the ChannelCreateRefused interface
 * and returns it as a ChannelCreateRefused object if it passes
 */
export const channelCreateRefusedSchema: z.ZodSchema<ChannelCreateRefused> = z.lazy(() =>
  z.object({
    user: userSchema,
    channel: channelSchema,
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
    password: z.string(),
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
    huffman_tree: z.array(z.tuple([z.number(), z.string()])).min(1, 'We can not send an empty tree'),
    encoded_file: z
      .array(
        z.number().min(0, 'It must be an array of unsigned bytes').max(255, 'It must be an array of unsigned bytes'),
      )
      .min(1, 'We can not send an empty file'),
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the OutgoingEncodedFile interface
 * and returns it as a OutgoingEncodedFile object if it passes
 */
export const outgoingEncodedFileSchema: z.ZodSchema<OutgoingEncodedFile> = z.lazy(() =>
  z.object({
    channel_id: channelIdSchema,
    file: huffmanEncodedFileSchema,
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
    file: huffmanEncodedFileSchema,
  }),
);

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the FileEncodingError interface
 * and returns it as a FileEncodingError object if it passes
 */
export const fileEncodingErrorSchema: z.ZodSchema<FileEncodingError> = z.lazy(() =>
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
 * Accepts an unknown javascript object as parameter of the parse function and checks if it contains the required fields of the FileEncodingErrorCommand interface
 * and returns it as a FileEncodingErrorCommand object if it passes
 */
const fileEncodingErrorCommandSchema: z.ZodSchema<FileEncodingErrorCommand> = z.lazy(() =>
  z.object({
    command: z.literal('file_encoding_error'),
    data: fileEncodingErrorSchema,
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
 * Accepts a byte buffer as input of the parse function and outputs it as a string
 * it also checks whether this string is a json object which contains a string "command" and an object "data"
 */
const incomingDataStringSchema = z.coerce
  .string({ invalid_type_error: 'Did not receive a parsable byte buffer', description: 'Parsing incoming data' })
  .regex(
    /\{\s*(?:"command":"\w*",\s*"data":\{.*?\}|"data":\{.*?\},\s*"command":"\w*")\s*\}/gs,
    'The buffer should contain (only) a string "command" and an object "data"',
  );

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it matches any of the following interfaces:
 *  - SendMessageCommand
 *  - RequestMessageHistoryCommand
 *  - ChannelJoinRequestCommand
 *  - LogInRequestCommand
 *  - SignUpRequestCommand
 *  - ChannelLeaveRequestCommand
 *  - ChannelCreateRequestCommand
 *  - LookupRequestCommand
 *  - OutgoingEncodedFileCommand
 * and returns it as a ToServerCommand object if it passes
 */
export const toServerCommandSchema: z.ZodSchema<ToServerCommand, z.ZodTypeDef, string> = incomingDataStringSchema
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
      .or(nicknameChangeRequestCommandSchema),
  );

/**
 * Accepts an unknown javascript object as parameter of the parse function and checks if it matches any of the following interfaces:
 *  - MessageReceivedCommand
 *  - MessageSendingErrorCommand
 *  - MessageHistoryResponseCommand
 *  - MessageHistoryErrorCommand
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
 *  - FileEncodingErrorCommand
 *  - MissingPermissionsErrorCommand
 * and returns it as a ToServerCommand object if it passes
 */
export const toClientCommandSchema: z.ZodSchema<ToClientCommand, z.ZodTypeDef, string> = incomingDataStringSchema
  .transform((str) => JSON.parse(str) as unknown)
  .pipe(
    messageReceivedCommandSchema
      .or(messageSendingErrorCommandSchema)
      .or(messageHistoryResponseCommandSchema)
      .or(messageHistoryErrorCommandSchema)
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
      .or(fileEncodingErrorCommandSchema)
      .or(nicknameChangeSuccessCommandSchema)
      .or(nicknameChangeRefusedCommandSchema)
      .or(serverErrorCommandSchema),
  );
