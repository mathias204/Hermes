import type { IncomingMessage, MessageSendingError, OutgoingMessage } from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { DateTime } from 'luxon';
import chalk from 'chalk';
import { Tui } from './tui.mjs';
import { ChatClient } from './chat-client.mjs';
import { sendToServer } from '../lib/communication/send.mjs';
import { Encryption } from '../lib/encryption/encryption.mjs';

export const MessageHandler = {
  onMessageReceived,
  onSend,
  onMessageSendingError,
};

/**
 * Handles a message received from the server and prints it to the TUI
 *
 * @param message - message which is received from the server
 * @param secret - the secret to decrypt the message with if the channel is encrypted
 */
function onMessageReceived(message: IncomingMessage, secret?: Buffer | undefined) {
  const currentChannel = ChatClient.getCurrentChannel();
  if (currentChannel !== undefined && message.channel === currentChannel.id) {
    const senderId = message.sender.username || message.sender.id;
    let messageContent = message.msg;
    let timeString;
    if (message.time instanceof DateTime) {
      timeString = message.time.toLocal().toFormat('HH:mm:ss');
    } else {
      timeString = message.time;
    }

    if (currentChannel.type === 'direct_message_encrypted' || currentChannel.type === 'private_encrypted') {
      if (!secret) {
        Tui.logError(chalk.red(`Received a message in an encrypted channel, but secret is not provided`));
        return;
      }
      const encryptionKey = Encryption.deriveEncryptionKey(secret);
      messageContent = Encryption.decryptMessage(Buffer.from(message.msg, 'hex'), encryptionKey).toString('utf8');
    }
    Tui.writeMessage(chalk.yellowBright(`${senderId}`) + ' at ' + chalk.cyan(`${timeString}`) + `: ${messageContent}`);
  }
}

/**
 * Processes the user input and sends a message to the server
 *
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 * @param secret - secret to encrypt the message with if the channel is encrypted
 */
function onSend(ws: IWebSocket, args: string[], secret?: Buffer | undefined) {
  const currentChannel = ChatClient.getCurrentChannel();
  let message = args.join(' ');
  if (!message) {
    return;
  }
  if (!currentChannel) {
    Tui.logError(chalk.red('You are not in a channel, type /open <channel> to open a channel!'));
    return;
  }

  if (currentChannel.type === 'direct_message_encrypted' || currentChannel.type === 'private_encrypted') {
    if (!secret) {
      Tui.logError(chalk.red(`Trying to send a message in an encrypted channel, but secret is not provided`));
      return;
    }

    const encryptionKey = Encryption.deriveEncryptionKey(secret);
    message = Encryption.encryptMessage(Buffer.from(message, 'utf8'), encryptionKey).toString('hex');
  }

  const messageToSend: OutgoingMessage = {
    msg: message,
    channel: currentChannel.id,
  };

  sendToServer(ws, {
    command: 'send_message',
    data: messageToSend,
  });
}

/**
 * Handles the error when a message sending request fails
 *
 * @param data - contains the error code and error reason for the message sending request fail
 */
function onMessageSendingError(data: MessageSendingError) {
  Tui.logError(chalk.red(`Error: ${data.error_code} - ${data.reason}`));
}
