import type {
  OutgoingEncodedFileCommand,
  OutgoingEncodedFile,
  Channel,
  IncomingEncodedFile,
  ListFilesRequestCommand,
  ListFilesRequest,
  ListFilesResponse,
  FileRequest,
  FileRequestCommand,
  EncodedFile,
  HuffmanEncodedFileArray,
  LZWEncodedFileArray,
  FileSharingError,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { LZW } from '../lib/lempel-ziv-welch/lempel-ziv-welch.mjs';
import { promises } from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as fs from 'fs';
import { Tui } from './tui.mjs';
import { sendRawToServer, sendToServer } from '../lib/communication/send.mjs';
import { VariableWidthEncoding } from '../lib/lempel-ziv-welch/variable-width-encoding.mjs';
import { HuffmanEncoding } from '../lib/huffman/huffman.mjs';

export const MAX_SIZE_BYTES = 1024 * 1024 * 5;

export const FileSharingHandler = {
  sendEncodedFile,
  onEncodedFile,
  listFilesRequest,
  onListFiles,
  requestFile,
  onFileContent,
  processAutocomplete,
  error,
};

const keyToContentMap = new Map<number, EncodedFile>();
const keyToMetaDataMap = new Map<number, IncomingEncodedFile>();
let fileHashes: string[] = [];

/**
 * Checks if the provided file:
 *  - exists.
 *  - a textfile is.
 *  - within the size limit.
 *
 * @param filePath - location of file
 * @returns  On succes it returns the buffer of the to send file.
 *           On fail it logs the error reason and returns an empty buffer.
 */
function loadTextFileBuffer(filePath: string): Buffer {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath);
    if (ext !== '.txt') {
      Tui.logError(chalk.red('The file is not a .txt file.'));
      return Buffer.alloc(0);
    }
    const fileSize = stats.size;
    if (fileSize > MAX_SIZE_BYTES) {
      Tui.logError(chalk.red(`The file is bigger than ${MAX_SIZE_BYTES} bytes.`));
      return Buffer.alloc(0);
    }
    return fs.readFileSync(filePath);
  } catch (err) {
    Tui.logError(
      chalk.red(
        'The provided path does not exist. Try placing the textfile in /file-sharing/to-send/ and executing the command sendfile <fileName.txt>.',
      ),
    );
    return Buffer.alloc(0);
  }
}

/**
 * The handler for the `sendfile <PATH>` command.
 *
 * @param ws - the websocket for sending the file
 * @param args - this should only have one argument: the absolute or relative path to the text file.
 *               When only a file name is given, the dedicated directory /file-sharing/to-send/ is searched.
 * @param channel - the channel in which the `sendfile` command was sent.
 * @returns On succes, sends the server an OutgoingEncodedFileCommand
 */
function sendEncodedFile(ws: IWebSocket, args: string[], channel: Channel | undefined) {
  // safety checks
  if (!channel || !channel.id) {
    Tui.logError(chalk.red('To send a file you must be have a channel open.'));
    return;
  }
  if (!args[0]) {
    Tui.logError(chalk.red('Not a valid path.'));
    return;
  }
  const encoding_type = args[1];
  if (!encoding_type || (encoding_type !== 'huffman' && encoding_type !== 'lzw')) {
    Tui.logError(
      chalk.red(
        `Please specify how you want to compress the file. The second argument should either be 'huffman' or 'lzw'. `,
      ),
    );
    return;
  }

  const filePath = getFilePath(args[0]);

  const fileBuffer = loadTextFileBuffer(filePath);
  if (fileBuffer.length <= 0) {
    return;
  }
  if (encoding_type === 'huffman') {
    const dataToSend = huffmanEncodeAndPackage(fileBuffer, filePath, channel);
    sendToServer(ws, dataToSend[1]);
    sendRawToServer(ws, dataToSend[0]);
    listFilesRequest(ws, channel);
    return;
  } else if (encoding_type === 'lzw') {
    const dataToSend = lzwEncodeAndPackage(fileBuffer, filePath, channel);
    sendToServer(ws, dataToSend[1]);
    sendRawToServer(ws, dataToSend[0]);
    listFilesRequest(ws, channel);
    return;
  }
}

/**
 * compresses a file with huffman encoding and packages the data to be sent.
 *
 * @param fileBuffer - buffer of a textfile
 * @param filePath - the path to `fileBuffer`
 * @param channel - the channel where the file is being send.
 * @returns A tuple with a HuffmanEncodedFileArray and a OutgoingEncodedFileCommand. The file array should be sent as a buffer.
 */
function huffmanEncodeAndPackage(
  fileBuffer: Buffer,
  filePath: string,
  channel: Channel,
): [HuffmanEncodedFileArray, OutgoingEncodedFileCommand] {
  const huffman = HuffmanEncoding.buildEncodingFromFile(fileBuffer);
  const tree = huffman.encoding;
  const file = huffman.encode(fileBuffer);

  const fileContentKey = Math.floor(Math.random() * 256);
  const lenghtArrayOfEncodedFile = lengthToSizeArray(file.length);
  const treeByteArray = [tree.length];
  for (const [decodedCharacterIntValue, encodedCharacterString] of tree) {
    treeByteArray.push(decodedCharacterIntValue);
    treeByteArray.push(encodedCharacterString.length);
    for (const c of encodedCharacterString) {
      treeByteArray.push(c.charCodeAt(0));
    }
  }
  const lengthArrayOfTree = lengthToSizeArray(treeByteArray.length);

  const channelID = Buffer.from(channel.id);
  const encodedFileArray: HuffmanEncodedFileArray = [
    1,
    fileContentKey,
    lenghtArrayOfEncodedFile[0],
    lenghtArrayOfEncodedFile[1],
    lenghtArrayOfEncodedFile[2],
    ...file,
    lengthArrayOfTree[0],
    lengthArrayOfTree[1],
    lengthArrayOfTree[2],
    ...treeByteArray,
    ...channelID,
  ];

  const fileName = path.basename(filePath);
  const outgoingFile: OutgoingEncodedFile = {
    channel_id: channel.id,
    file_name: fileName,
    file_content_key: fileContentKey,
  };
  const outgoingCommand: OutgoingEncodedFileCommand = {
    command: 'outgoing_encoded_file',
    data: outgoingFile,
  };

  return [encodedFileArray, outgoingCommand];
}

/**
 * compresses a file with LZW encoding and packages the data to be sent.
 *
 * @param fileBuffer - buffer of a textfile
 * @param filePath - the path to `fileBuffer`
 * @param channel - the channel where the file is being send.
 * @returns A tuple with a LZWEncodedFileArray and a OutgoingEncodedFileCommand. The file array should be sent as a buffer.
 */

function lzwEncodeAndPackage(
  file: Buffer,
  filePath: string,
  channel: Channel,
): [LZWEncodedFileArray, OutgoingEncodedFileCommand] {
  const lzwEncodedData = LZW.encode(file);
  const encodedFile = VariableWidthEncoding.toBuffer(lzwEncodedData);
  const lengthArrayOfEncodedFile = lengthToSizeArray(encodedFile.length);

  const channelID = Buffer.from(channel.id);
  const fileContentKey = Math.floor(Math.random() * 256);

  const encodedFileArray: LZWEncodedFileArray = [
    2,
    fileContentKey,
    lengthArrayOfEncodedFile[0],
    lengthArrayOfEncodedFile[1],
    lengthArrayOfEncodedFile[2],
    ...encodedFile,
    ...channelID,
  ];

  const fileName = path.basename(filePath);
  const metaData: OutgoingEncodedFile = {
    channel_id: channel.id,
    file_name: fileName,
    file_content_key: fileContentKey,
  };

  const outgoingEncodedFileCommand: OutgoingEncodedFileCommand = {
    command: 'outgoing_encoded_file',
    data: metaData,
  };

  return [encodedFileArray, outgoingEncodedFileCommand];
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

/**
 * Gets called when some receives an incoming IncomingEncodedFile from the server in a certain Channel.
 *
 * @param metaData - the IncomingEncodedFile.
 * @param channel - the channel in which the user received the file.
 * @returns if the fileContent was avaible, it also decompresses the file and saves it.
 * else it stores the metaData until the fileContent is received.
 */
export function onEncodedFile(metaData: IncomingEncodedFile, channel: Channel | undefined, ws: IWebSocket) {
  if (!channel) {
    Tui.logError(chalk.red('No channel is open.'));
    return;
  }
  if (channel.id !== metaData.channel_id) {
    Tui.logError(chalk.red('channel-id does not match.'));
    return;
  }
  if (!keyToContentMap.has(metaData.file_content_key)) {
    keyToMetaDataMap.set(metaData.file_content_key, metaData);
    return;
  }
  const fileContent = keyToContentMap.get(metaData.file_content_key);
  keyToContentMap.delete(metaData.file_content_key);
  if (fileContent) {
    decodeFile(metaData, fileContent);
    listFilesRequest(ws, channel);
  }
}

/**
 * Gets called when someone receives an incoming HuffmanEncodedFile from the server.
 * @param fileContent
 * @returns if the metaData was available, it also decompresses the file and saves it.
 * else it stores the fileContent until the metaData is received.
 */
export function onFileContent(fileContent: EncodedFile, channel: Channel | undefined, ws: IWebSocket) {
  if (!channel) {
    Tui.logError(chalk.red('No channel is open.'));
    return;
  }
  if (!keyToMetaDataMap.has(fileContent.file_content_key)) {
    keyToContentMap.set(fileContent.file_content_key, fileContent);
    return;
  }
  const metaData = keyToMetaDataMap.get(fileContent.file_content_key);
  keyToMetaDataMap.delete(fileContent.file_content_key);
  if (metaData) {
    decodeFile(metaData, fileContent);
    listFilesRequest(ws, channel);
  }
}

/**
 * Before calling this method, the caller should delete the metaData and fileContent entries from their maps.
 * Decompresses a received file and saves it.
 *
 * @param metaData metaData of a received file.
 * @param fileContent fileContent of that file.
 *
 */
function decodeFile(metaData: IncomingEncodedFile, fileContent: EncodedFile) {
  let decodedBuffer: Buffer;
  let lzw: number[];
  const fileName = generateUniqueFileName(metaData);
  if (fileContent.encoding_type === 'huffman') {
    const huffman = new HuffmanEncoding(fileContent.huffman_tree);
    const encoded = Buffer.from(fileContent.encoded_file);
    decodedBuffer = huffman.decode(encoded);
  } else if (fileContent.encoding_type === 'LZW') {
    lzw = VariableWidthEncoding.fromBuffer(Buffer.from(fileContent.encoded_file));
    decodedBuffer = LZW.decode(lzw);
  } else {
    Tui.logError(chalk.red(`We can only decompress huffman and LZW`));
    return;
  }

  promises.writeFile(`file-sharing/received/${fileName}`, decodedBuffer).catch((err) => {
    Tui.logError(chalk.red(`Error while writing file to disk: ${err}`));
    return;
  });
  Tui.writeMessage(
    chalk.greenBright(
      `Received new file from ${metaData.user.username}, it was saved at file-sharing/received/${metaData.file_name}`,
    ),
  );
}

/**
 * It checks if `file-sharing/received/<incomingFile>` already exists.
 * Makes the name unique by adding a `(number)` to it.
 *
 * @param file - the IncomingEncodedFile
 * @returns `<filename>(number).txt` which is unique under `file-sharing/received`
 */
function generateUniqueFileName(file: IncomingEncodedFile): string {
  let fileName = file.file_name;
  if (fs.existsSync(`file-sharing/received/${fileName}`)) {
    let fileNumber = 1;
    const fileParts = file.file_name.split('.');
    const fileExtension = fileParts.pop();
    const fileBaseName = fileParts.join('.');
    while (fs.existsSync(`file-sharing/received/${fileName}`)) {
      fileName = `${fileBaseName}(${fileNumber}).${fileExtension}`;
      fileNumber++;
    }
  } else {
    fileName = file.file_name;
  }
  return fileName;
}

/**
 * When called with just a name of a textfile, the name gets prepended with the path of the dedicated to-send directory
 *
 * @param filePath the provided path argument of `sendfile <PATH>`
 * @returns the entire path to the file.
 */
function getFilePath(filePath: string): string {
  if (path.isAbsolute(filePath) || isRelative(filePath)) {
    return filePath;
  }
  return `file-sharing/to-send/${filePath}`;
}

/**
 * @param filePath - location of file
 * @returns a boolean to determine if a path is relative or not.
 */
function isRelative(filePath: string): boolean {
  return filePath.includes('/') || filePath.includes('\\');
}
/**
 * Sends a ListFilesRequestCommand to the server.
 *
 * @param ws - the websocket for sending the file
 * @param channel - the channel_id of the active channel, a file list of this channel is made.
 */
function listFilesRequest(ws: IWebSocket, channel: Channel | undefined) {
  if (!channel) {
    Tui.logError(chalk.red('No channel is open.'));
    return;
  }
  Tui.setFilesLabel(channel.name);
  const listFilesRequest: ListFilesRequest = {
    channel_id: channel.id,
  };
  const requestCommand: ListFilesRequestCommand = {
    command: 'list_files_request',
    data: listFilesRequest,
  };
  sendToServer(ws, requestCommand);
}

/**
 * Handels an IncomingListFilesCommand - this is the reponse to the ListFilesRequestCommand
 *
 * @param data instance of IncomingListFiles which is used to log all the sent files.
 */
function onListFiles(data: ListFilesResponse) {
  const files = data.list_of_files;
  fileHashes = [];
  files.forEach((file) => {
    fileHashes.push(file.file_ID);
  });
  if (files.length === 0) {
    Tui.setFilesContent(chalk.red('No files have been sent in this channel.'));
  } else {
    Tui.setFilesContent(
      files
        .map(
          (file) =>
            `- ` +
            chalk.yellowBright(`${file.file_name}`) +
            ` sent by ` +
            chalk.greenBright(`${file.sender.username}`) +
            ` [Hash: ${file.file_ID}]`,
        )
        .join('\n'),
    );
  }
}

/**
 * Handels a filerequest <HASH> command.
 *
 * @param ws - the websocket for sending the file
 * @param args - hash of the requested files
 * @param channel - current channel
 * @returns On succes, sends the server an FileRequestCommand.
 */
function requestFile(ws: IWebSocket, args: string[], channel: Channel | undefined) {
  if (!channel) {
    Tui.logError(chalk.red('No channel is open.'));
    return;
  }
  if (!args[0]) {
    Tui.logError(
      chalk.red(
        'Please provide the file-hash from the requested file as an argument. You can use the listfiles command to see all the files and their hashes.',
      ),
    );
    return;
  }

  const fileRequest: FileRequest = {
    channel_id: channel.id,
    file_hash: args[0],
  };

  const fileRequestCommand: FileRequestCommand = {
    command: 'file_request',
    data: fileRequest,
  };

  sendToServer(ws, fileRequestCommand);
}

/**
 * Autocompletes the file hash when the user types the first few characters of the hash.
 *
 * @param input - the input array of the user
 * @returns the string to be displayed on the screen
 */
function processAutocomplete(input: string[]): string {
  if (input.length === 2) {
    const userHash = input[1];
    let count = 0;
    let match;
    fileHashes.forEach((file) => {
      if (file.startsWith(userHash!)) {
        count++;
        match = file;
      }
    });
    if (count === 1) {
      return input[0] + ' ' + match;
    }
  }
  return input.join(' ');
}

/**
 * handles error messaging when the server errors
 * @param data
 */
function error(data: FileSharingError) {
  Tui.logError(data.error_code + ' ' + data.reason);
}
