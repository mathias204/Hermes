import type {
  OutgoingEncodedFile,
  User,
  ListFilesRequest,
  ListFileEntry,
  ListFilesResponseCommand,
  ListFilesResponse,
  FileRequest,
  EncodedFile,
  IncomingEncodedFileCommand,
  HuffmanEncodedFileArray,
  LZWEncodedFileArray,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { Query } from '../database/query-builder.mjs';
import { Table } from '../database/table.mjs';
import Debug from 'debug';
import type { FileEntry } from '../database/database-interfaces.mjs';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { sendRawToClient, sendToClient } from '../lib/communication/send.mjs';
import type { RawData } from 'ws';

export const FileSharingHandler = {
  onOutgoingEncodedFile,
  storeFileInServerDatabase,
  onListFiles,
  onFileRequest,
  onFileContent,
};

const debug = Debug('chatter:ChatServer-file-sharing-handler');
const MAX_INSERTION_ATTEMPTS = 3;

const keyToContentMap = new Map<number, EncodedFile>();
const keyToMetaDataMap = new Map<number, OutgoingEncodedFile>();

/**
 * Handles an OutgoingEncodedFile command - it represents the meta data of the file
 * Sends an IncomingEncodedFile to all connect clients with access to thegiven channel
 * Sends a FileSharingErrorCommand to the sender if something went wrong
 *
 * @param ws - Websocket which sent the request
 * @param sender - User who is connected with the websocket
 * @param loggedInClients - A hashmap of the currently signed in users
 * @param request - OutgoingEncodedFile request containing a channel id and an encoded file
 * @returns Promise<void>
 */
async function onOutgoingEncodedFile(
  ws: IWebSocket,
  sender: User,
  loggedInClients: Map<IWebSocket, User>,
  request: OutgoingEncodedFile,
): Promise<void> {
  const channel = await new Query(Table.CHANNELS)
    .filter(({ channel_ID }) => channel_ID === request.channel_id)
    .results();

  if (channel.length === 0) {
    handleFileSharingError(ws, 404, `Channel with ID '${request.channel_id}' not found`);
    return;
  }

  const usersInChannel = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(request.channel_id))
    .results();
  if (!usersInChannel.some(({ email_ID }) => email_ID === sender.id)) {
    handleFileSharingError(ws, 405, "You don't have access to this channel");
    return;
  }

  Array.from(loggedInClients)
    .filter(([receivingWs, _]) => receivingWs.isAlive && receivingWs !== ws)
    .filter(([_, { id }]) => {
      return usersInChannel.some(({ email_ID }) => email_ID === id);
    })
    .forEach(([receivingWs, _]) => {
      sendToClient(receivingWs, {
        command: 'incoming_encoded_file',
        data: {
          user: sender,
          ...request,
        },
      });
    });

  if (keyToContentMap.has(request.file_content_key)) {
    const fileContent = keyToContentMap.get(request.file_content_key);
    keyToContentMap.delete(request.file_content_key);
    if (fileContent) {
      await storeFileInServerDatabase(ws, sender, request, fileContent);
    }
  } else {
    keyToMetaDataMap.set(request.file_content_key, request);
  }
}

/**
 *
 * Handles an FileContentCommand command
 * Sends an FileContentCommand to all connect clients with access to the given channel
 * Sends a FileSharingErrorCommand to the sender if something went wrong
 * @param ws - Websocket which sent the request
 * @param sender - User who is connected with the websocket
 * @param loggedInClients - A hashmap of the currently signed in users
 * @param fileContent - HuffmanEncodedFile contains everything which is needed to decompress the file
 * @param data - RawData used to send the content to all the connected clients
 * @returns
 */
async function onFileContent(
  ws: IWebSocket,
  sender: User,
  loggedInClients: Map<IWebSocket, User>,
  fileContent: EncodedFile,
  data: RawData,
): Promise<void> {
  const channel = await new Query(Table.CHANNELS)
    .filter(({ channel_ID }) => channel_ID === fileContent.channel_id)
    .results();

  if (channel.length === 0) {
    handleFileSharingError(ws, 404, `Channel with ID '${fileContent.channel_id}' not found`);
    return;
  }

  const usersInChannel = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(fileContent.channel_id))
    .results();
  if (!usersInChannel.some(({ email_ID }) => email_ID === sender.id)) {
    handleFileSharingError(ws, 405, "You don't have access to this channel");
    return;
  }

  Array.from(loggedInClients)
    .filter(([receivingWs, _]) => receivingWs.isAlive && receivingWs !== ws)
    .filter(([_, { id }]) => {
      return usersInChannel.some(({ email_ID }) => email_ID === id);
    })
    .forEach(([receivingWs, _]) => {
      if (Buffer.isBuffer(data)) {
        sendRawToClient(receivingWs, data);
      }
    });

  if (keyToMetaDataMap.has(fileContent.file_content_key)) {
    const metaData = keyToMetaDataMap.get(fileContent.file_content_key);
    keyToContentMap.delete(fileContent.file_content_key);
    if (metaData) {
      await storeFileInServerDatabase(ws, sender, metaData, fileContent);
    }
  } else {
    keyToContentMap.set(fileContent.file_content_key, fileContent);
  }
}

/**
 * Sends a file sharing error containing the given error
 *
 * @param ws - The websocket to send the error to
 * @param error_code - The error code of the error
 * @param reason - The reason of the error
 * @returns void
 */
function handleFileSharingError(ws: IWebSocket, error_code: number, reason: string): void {
  debug(`File sharing error: ${error_code} - ${reason}`);
  sendToClient(ws, {
    command: 'file_sharing_error',
    data: {
      error_code,
      reason,
    },
  });
}

/**
 * Stores sent files in the server database.
 *
 * @param ws - Websocket which sent the request
 * @param sender - User who is connected with the websocket
 * @param metaData - OutgoingEncodedFile contains the metadata of the file
 * @param fileContent - EncodedFile contains all the data needed to decompress the file
 * @returns Promise<void>
 */
async function storeFileInServerDatabase(
  ws: IWebSocket,
  sender: User,
  metaData: OutgoingEncodedFile,
  fileContent: EncodedFile,
): Promise<void> {
  const randomID = randomUUID();
  let file: FileEntry;
  if (fileContent.encoding_type === 'huffman') {
    const fileLength = lengthToSizeArray(fileContent.encoded_file.length);
    const treeByteArray = [fileContent.huffman_tree.length];
    for (const [decodedCharacterIntValue, encodedCharacterString] of fileContent.huffman_tree) {
      treeByteArray.push(decodedCharacterIntValue);
      treeByteArray.push(encodedCharacterString.length);
      for (const c of encodedCharacterString) {
        treeByteArray.push(c.charCodeAt(0));
      }
    }
    const treeLength = lengthToSizeArray(treeByteArray.length);

    const channel_id_buffer = Buffer.from(fileContent.channel_id);
    const rawFileContent: HuffmanEncodedFileArray = [
      1,
      fileContent.file_content_key,
      fileLength[0],
      fileLength[1],
      fileLength[2],
      ...fileContent.encoded_file,
      treeLength[0],
      treeLength[1],
      treeLength[2],
      ...treeByteArray,
      ...channel_id_buffer,
    ];

    file = {
      file_ID: randomID,
      channel: metaData.channel_id,
      file_name: metaData.file_name,
      raw_file_content: Buffer.from(rawFileContent),
      file_content_key: metaData.file_content_key,
      sender_id: sender.id,
      sent_at_utc_timestamp: DateTime.utc().toISO(),
      encoding_type: 'huffman',
    };
  } else if (fileContent.encoding_type === 'LZW') {
    const channelID = Buffer.from(metaData.channel_id);
    const fileLength = lengthToSizeArray(fileContent.encoded_file.length);
    const rawFileContent: LZWEncodedFileArray = [
      2,
      fileContent.file_content_key,
      fileLength[0],
      fileLength[1],
      fileLength[2],
      ...fileContent.encoded_file,
      ...channelID,
    ];
    file = {
      file_ID: randomID,
      channel: metaData.channel_id,
      file_name: metaData.file_name,
      raw_file_content: Buffer.from(rawFileContent),
      file_content_key: metaData.file_content_key,
      sender_id: sender.id,
      sent_at_utc_timestamp: DateTime.utc().toISO(),
      encoding_type: 'LZW',
    };
  } else {
    handleFileSharingError(ws, 501, 'sent file does not have the correct encoding type');
    return;
  }

  let inserted = false;
  let attempts = 0;

  while (!inserted) {
    try {
      await new Query(Table.FILES).insert(file);
      inserted = true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Primary ID already exists.' &&
        attempts < MAX_INSERTION_ATTEMPTS
      ) {
        attempts++;
        debug(`Failed to insert file, trying again with new ID [attempt ${attempts}/${MAX_INSERTION_ATTEMPTS}]`);
        file.file_ID = randomUUID();
      } else {
        handleFileSharingError(ws, 501, 'Failed to insert file into database');
        return;
      }
    }
  }
}
/**
 * Handles an ListFilesRequestCommand
 *
 * @param ws - Websocket which sent the request
 * @param user - User who is connected with the websocket
 * @param data - ListFilesRequest which contains the channel_id, a file list of this channel is made.
 * @returns Promise<void>
 */
async function onListFiles(ws: IWebSocket, user: User, data: ListFilesRequest): Promise<void> {
  const channel = await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === data.channel_id).results();

  if (channel.length === 0) {
    handleFileSharingError(ws, 404, `Channel with ID '${data.channel_id}' not found`);
    return;
  }

  const usersInChannel = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(data.channel_id))
    .results();
  if (!usersInChannel.some(({ email_ID }) => email_ID === user.id)) {
    handleFileSharingError(ws, 405, "You don't have access to this channel");
    return;
  }

  const files: FileEntry[] = await new Query(Table.FILES)
    .filter((FileEntry) => data.channel_id === FileEntry.channel)
    .results();

  const usersDB = await new Query(Table.USERS).results();
  const filesInChannel: ListFileEntry[] = files.map((file) => {
    const senderName = usersDB.find((user) => user.email_ID === file.sender_id)?.user_name;
    const fileSender: User = {
      id: file.sender_id,
      username: senderName,
    };
    return {
      file_name: file.file_name,
      file_ID: file.file_ID,
      sender: fileSender,
    };
  });

  const dataToSend: ListFilesResponse = {
    list_of_files: filesInChannel,
  };

  const result: ListFilesResponseCommand = {
    command: 'list_files_response',
    data: dataToSend,
  };
  debug('Sending response to listfiles request');
  sendToClient(ws, result);
}

/**
 *  Handles an FileRequestCommand
 *
 * @param ws - Websocket which sent the request
 * @param user - User who is connected with the websocket
 * @param data - FileRequest which contains the channel_id and the requested file hash.
 * @returns Promise<void>
 */
async function onFileRequest(ws: IWebSocket, user: User, data: FileRequest): Promise<void> {
  const channel = await new Query(Table.CHANNELS).filter(({ channel_ID }) => channel_ID === data.channel_id).results();
  if (channel.length === 0) {
    handleFileSharingError(ws, 404, `Channel with ID '${data.channel_id}' not found`);
    return;
  }

  const usersInChannel = await new Query(Table.USERS)
    .filter(({ channels }) => channels.includes(data.channel_id))
    .results();
  if (!usersInChannel.some(({ email_ID }) => email_ID === user.id)) {
    handleFileSharingError(ws, 405, "You don't have access to this channel");
    return;
  }

  const file = await new Query(Table.FILES).filter(({ file_ID }) => file_ID === data.file_hash).results();
  if (file.length === 0) {
    handleFileSharingError(ws, 800, `No file with hash ${data.file_hash} was found`);
  }

  if (file[0]) {
    const rawFile = file[0].raw_file_content;
    const usersDB = await new Query(Table.USERS).results();
    const senderName = usersDB.find((user) => user.email_ID === file[0]?.sender_id)?.user_name;
    const fileContentKey = file[0].file_content_key;
    const fileSender: User = {
      id: file[0].sender_id,
      username: senderName,
    };
    const metaDataToSend: IncomingEncodedFileCommand = {
      command: 'incoming_encoded_file',
      data: {
        channel_id: file[0].channel,
        file_name: file[0].file_name,
        user: fileSender,
        file_content_key: fileContentKey,
      },
    };

    sendToClient(ws, metaDataToSend);
    sendRawToClient(ws, Buffer.from(rawFile));
  } else {
    handleFileSharingError(ws, 801, 'File was not received succesfully');
  }
}

/**
 * @param length
 * @returns a 3-tuple
 */
function lengthToSizeArray(length: number): [number, number, number] {
  const binaryRepresentation = ('000000000000000000000000' + Number(length).toString(2)).slice(-24);
  const resultArray: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const nextBinaryChunk = binaryRepresentation.substring(8 * i, 8 * (i + 1));
    const decimalRepresentationOfChunk = parseInt(nextBinaryChunk, 2);
    resultArray[i] = decimalRepresentationOfChunk;
  }
  return resultArray;
}
