import type { LookupError, LookupResult } from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import type { Channel } from '../protocol/proto.mjs';
import { DateTime } from 'luxon';
import { Tui } from './tui.mjs';
import chalk from 'chalk';
import { sendToServer } from '../lib/communication/send.mjs';
import { Encryption } from '../lib/encryption/encryption.mjs';

export const LookupHandler = {
  lookupMessage,
  onLookupResult,
  onLookupError,
};

/**
 * Function which sends time for which to look up the closest message to the server
 *
 * @param ws - websocket which is used to send and receive messages
 * @param time - date & time for which to search closest message
 * @param channel - channel in which to search for the message
 */
function lookupMessage(ws: IWebSocket, time: string, channel: Channel | undefined) {
  if (channel) {
    const parsedDate = DateTime.fromFormat(time, 'yyyy-MM-dd HH:mm');
    if (parsedDate.isValid) {
      sendToServer(ws, {
        command: 'lookup_request',
        data: { time: parsedDate.toUTC().toISO(), channel_id: channel.id },
      });
      Tui.setLookupLabel(`${channel.name} (${parsedDate.toLocal().toFormat('yyyy-MM-dd HH:mm')})`);
    } else {
      Tui.logError(chalk.red('Invalid date format. Please use the format "yyyy-MM-dd HH:mm"'));
    }
  } else {
    Tui.logError(chalk.red('Enter a channel to perform a message lookup'));
  }
}

/**
 * Displays received messages to user after the user did the lookup command
 *
 * @param result - LookupResult instance that contains a list of messages and the index of the closest message to the time given in the lookup command
 * @param secret - Secret to decrypt encrypted messages with if provided
 */
function onLookupResult(result: LookupResult, secret?: Buffer | undefined) {
  const lookup: string[] = [];
  let encryptionKey = undefined;
  if (secret) encryptionKey = Encryption.deriveEncryptionKey(secret);
  for (const [index, message] of result.messages.entries()) {
    const sender: string = message.sender.username === undefined ? message.sender.id : message.sender.username;
    let content: string = message.msg;
    if (encryptionKey)
      content = Encryption.decryptMessage(Buffer.from(content, 'hex'), encryptionKey).toString('utf-8');
    let time = '';
    if (message.time instanceof DateTime) {
      time = message.time.toLocal().toFormat('yyyy-MM-dd HH:mm:ss');
    } else {
      time = DateTime.fromISO(message.time, { setZone: true }).toLocal().toFormat('yyyy-MM-dd HH:mm:ss');
    }
    if (index === result.resultIndex) {
      lookup.push(chalk.yellowBright(`${time} ${sender}: ${content}`));
    } else {
      lookup.push(chalk.gray(`${time} ${sender}: ${content}`));
    }
  }
  Tui.setLookupContent(lookup.join('\n'));
}

/**
 * Handles the error when a lookup request fails
 *
 * @param data - contains the error code and error reason for the lookup request fail
 */
function onLookupError(data: LookupError) {
  Tui.setLookupLabel('');
  Tui.logError(chalk.red(data.reason));
}
