import chalk from 'chalk';
import type { NicknameChangeSuccess, User, UserNick } from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { Tui } from './tui.mjs';
import { sendToServer } from '../lib/communication/send.mjs';

export const NicknameHandler = {
  onNick,
  onNicknameChangeSuccess,
};

/**
 * Handles the nick command
 *
 * @param ws - The websocket to send the nickname change request to
 * @param args - The arguments passed to the nick command
 */
function onNick(ws: IWebSocket, args: string[]) {
  const nickname: UserNick = args.join(' ').trim();
  if (!nickname || nickname.length === 0) {
    Tui.logError(chalk.red('No nickname provided'));
    return;
  }
  if (nickname.length < 3) {
    Tui.logError(chalk.red('Nickname too short (min 3 characters)'));
    return;
  }
  if (nickname.length > 10) {
    Tui.logError(chalk.red('Nickname too long (max 10 characters)'));
    return;
  }
  sendToServer(ws, {
    command: 'nickname_change_request',
    data: {
      nickname: nickname,
    },
  });
}
/**
 * Handles the nickname change success event updating the client username and notifying the user
 *
 *  @param data - The data of the nickname change success event
 *  @param client - The user that changed their nickname
 */
function onNicknameChangeSuccess(data: NicknameChangeSuccess, client: User) {
  client.username = data.user.username;
  Tui.writeMessage(chalk.green(`Nickname changed to ${data.user.username}`));
}
