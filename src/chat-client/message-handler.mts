import { clearLine, cursorTo, moveCursor } from 'readline';
import type { IncomingMessage, OutgoingMessage, SendMessageCommand } from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { ChatClient, rl } from './chat-client.mjs';
import { DateTime } from 'luxon';

export const MessageHandler = {
  onMessageReceived,
  onSend,
};

/**
 * Handles a message received from the server and prints it to the console
 *
 * @param message - message which is received from the server
 */
function onMessageReceived(message: IncomingMessage) {
  const currentChannel = ChatClient.getCurrentChannel();
  if (currentChannel !== undefined && message.channel === currentChannel.id) {
    const cursorX = rl.getCursorPos().cols;
    const senderId = message.sender.username || message.sender.id;
    const messageContent = message.msg;
    let timeString;
    if (message.time instanceof DateTime) {
      timeString = message.time.toFormat('HH:mm:ss');
    } else {
      timeString = message.time;
    }
    // clear the line and print the message
    clearLine(process.stdout, 0);
    moveCursor(process.stdout, -1000, 0);
    const logMessage = `${senderId} at ${timeString}: ${messageContent}`;
    console.log(logMessage);
    rl.prompt();
    if (message.sender.id !== ChatClient.getClient().id) {
      cursorTo(process.stdout, cursorX);
    }
  }
}

/**
 * Processes the user input and sends a message to the server
 *
 * @param ws - websocket which is used to send and receive messages
 * @param args - arguments which are provided by the user
 */
function onSend(ws: IWebSocket, args: string[]) {
  const currentChannel = ChatClient.getCurrentChannel();
  const message = args.join(' ');
  if (!currentChannel) {
    console.error('You are not in a channel');
    return;
  }
  if (!message) {
    console.error('No message provided');
    return;
  }
  const messageToSend: OutgoingMessage = {
    msg: message,
    channel: currentChannel.id,
  };
  // clear current line above
  moveCursor(process.stdout, 0, -1);
  clearLine(process.stdout, 0);
  ws.send(
    JSON.stringify({
      command: 'send_message',
      data: messageToSend,
    } as SendMessageCommand),
  );
}
