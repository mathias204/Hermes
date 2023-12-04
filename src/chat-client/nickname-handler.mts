import type { NicknameChangeRequest, NicknameChangeRequestCommand, UserNick } from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';

export const NicknameHandler = {
  onNick,
};

/**
 * Handles the nick command
 * @param ws The websocket to send the nickname change request to
 * @param args The arguments passed to the nick command
 */
function onNick(ws: IWebSocket, args: string[]) {
  const nickname: UserNick = args.join(' ');
  if (!nickname) {
    console.error('No nickname provided');
    return;
  }
  ws.send(
    JSON.stringify({
      command: 'nickname_change_request',
      data: {
        nickname: nickname,
      } as NicknameChangeRequest,
    } as NicknameChangeRequestCommand),
  );
}
