import chalk from 'chalk';
import { sendToServer } from '../lib/communication/send.mjs';
import type {
  ChannelId,
  DeleteUserRequest,
  DeleteUserRequestCommand,
  ParticipantsError,
  ParticipantsResponse,
  User,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { Tui } from './tui.mjs';
import type { DateTime } from 'luxon';
import { ChatClient } from './chat-client.mjs';

export const UserHandler = {
  stopUserPolling,
  startUserPolling,
  onParticipantsError,
  onParticipantsResponse,
  deleteUser,
  onDeleteCompleted,
  onDeleteFailed,
};

let pollingTimer: NodeJS.Timeout | undefined;

function stopUserPolling() {
  clearInterval(pollingTimer);
  pollingTimer = undefined;
  Tui.updateUsers([], []);
}

function startUserPolling(ws: IWebSocket, channelId: ChannelId) {
  UserHandler.stopUserPolling();

  sendToServer(ws, {
    command: 'request_participants',
    data: {
      channel_id: channelId,
    },
  });

  pollingTimer = setInterval(() => {
    sendToServer(ws, {
      command: 'request_participants',
      data: {
        channel_id: channelId,
      },
    });
  }, 5000);
}

function onParticipantsResponse(response: ParticipantsResponse, activeChannelId: ChannelId | undefined) {
  if (response.channel_id === activeChannelId) {
    const users = response.participants
      .map(
        ([user, lastActive]) =>
          [user, (lastActive as DateTime).diffNow().negate().as('seconds') < 60] as [User, boolean],
      )
      .sort(([user1, _1], [user2, _2]) => (user1.username || user1.id).localeCompare(user2.username || user2.id));
    const onlineUsers = users.filter(([_, online]) => online).map(([user, _]) => user);
    const offlineUsers = users.filter(([_, online]) => !online).map(([user, _]) => user);
    Tui.updateUsers(onlineUsers, offlineUsers);
  }
}

function onParticipantsError(error: ParticipantsError) {
  UserHandler.stopUserPolling();

  Tui.logError(chalk.red('Encountered an error while polling for users, reenter the channel to restart the polling:'));
  Tui.logError(chalk.red(`  ${error.reason}`));
}

/**
 * Function that sends a delete user request to the server
 * @param ws - The websocket to send the request over
 * @param user - The user to delete
 * @returns void
 */
function deleteUser(ws: IWebSocket, user: User) {
  sendToServer(ws, {
    command: 'delete_user_request',
    data: {
      user: user,
    } as DeleteUserRequest,
  } as DeleteUserRequestCommand);
}

/**
 * Function that is called when the user is deleted successfully, exits the client
 * @returns void
 */
function onDeleteCompleted() {
  Tui.writeMessage(chalk.green('User deleted successfully exiting now'));
  setTimeout(() => ChatClient.onExit, 2000);
}

/**
 * Function that is called when the user deletion fails, notifies the user
 * @returns void
 */
function onDeleteFailed() {
  Tui.logError(chalk.red('Failed to delete user'));
}
