import blessed from 'blessed';
import type { Channel, User } from '../protocol/proto.mjs';
import { ChatClient } from './chat-client.mjs';
import chalk from 'chalk';
import { DateTime } from 'luxon';

export const Tui = {
  setUp,
  updateChannels,
  updateUsers,
  writeMessage,
  setChatBoxLabel,
  showHelp,
  clearChatBox,
  setFilesContent,
  showFiles,
  setInviteContent,
  showInvites,
  logError,
  showError,
  setLookupContent,
  showLookup,
  setLookupLabel,
  clearFilesContent,
  setFilesLabel,
};

let screen: blessed.Widgets.Screen;
let chatBox: blessed.Widgets.BoxElement;
let chatLog: blessed.Widgets.Log;
let inputBox: blessed.Widgets.BoxElement;
let input: blessed.Widgets.TextboxElement;
let channelBox: blessed.Widgets.BoxElement;
let inviteNotif: blessed.Widgets.TextElement;
let channelList: blessed.Widgets.ListElement;
let userBox: blessed.Widgets.ListElement;
let helpBox: blessed.Widgets.BoxElement;
let filesBox: blessed.Widgets.BoxElement;
let invitesBox: blessed.Widgets.ListElement;
let errorLog: blessed.Widgets.Log;
let shutdownPrompt: blessed.Widgets.BoxElement;
let lookupBox: blessed.Widgets.BoxElement;

/**
 * Initial setup function for the TUI needs to be called once at startup
 */
function setUp() {
  screen = blessed.screen({
    smartCSR: true,
    autoPadding: true,
    title: ' Hermes ',
  });

  chatBox = blessed.box({
    label: ' Chat ',
    width: '71%',
    left: '15%',
    height: '95%',
    border: {
      type: 'line',
    },
  });

  chatLog = blessed.log({
    parent: chatBox,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      style: {
        bg: 'white',
      },
    },
  });

  inputBox = blessed.box({
    label: ' Type your command (type /help to see a list of commands, TAB to autocomplete) ',
    bottom: '0',
    width: '100%',
    height: 3,
    border: {
      type: 'line',
    },
  });

  input = blessed.textbox({
    left: 1,
    parent: inputBox,
    inputOnFocus: true,
  });

  channelBox = blessed.box({
    label: ' Channels ',
    left: 0,
    width: '14.7%',
    height: '95%',
    border: {
      type: 'line',
    },
  });

  inviteNotif = blessed.text({
    parent: channelBox,
    height: 1,
    content: createInviteNotificationMessage(0),
    style: {
      fg: 'grey',
    },
  });

  channelList = blessed.list({
    parent: channelBox,
    top: 1,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      style: {
        bg: 'white',
      },
    },
  });

  userBox = blessed.list({
    label: ' Users ',
    right: 0,
    width: '14.7%',
    height: '95%',
    border: {
      type: 'line',
    },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      style: {
        bg: 'white',
      },
    },
    interactive: false,
  });

  helpBox = blessed.box({
    label: ' Commands ',
    width: '71%',
    left: '15%',
    bottom: 3,
    height: '30%',
    content: generateHelpContent(),
    border: {
      type: 'line',
    },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      style: {
        bg: 'white',
      },
    },
    hidden: true,
  });

  filesBox = blessed.box({
    label: ' Files ',
    width: '71%',
    left: '15%',
    bottom: 3,
    height: '30%',
    border: {
      type: 'line',
    },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      style: {
        bg: 'white',
      },
    },
    hidden: true,
  });

  lookupBox = blessed.box({
    label: ' Lookup ',
    content: 'No lookup results yet. Use /lookup <yyyy-MM-dd> <HH:mm> to search for messages.',
    width: '71%',
    left: '15%',
    bottom: 3,
    height: '30%',
    border: {
      type: 'line',
    },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      style: {
        bg: 'white',
      },
    },
    hidden: true,
  });

  invitesBox = blessed.list({
    label: ' Invites ',
    left: 0,
    width: '14.7%',
    height: '30%',
    border: {
      type: 'line',
    },
    bottom: 3,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      style: {
        bg: 'white',
      },
    },
    hidden: true,
  });

  errorLog = blessed.log({
    label: ' Error ',
    width: '71%',
    left: '15%',
    bottom: 3,
    height: '30%',
    border: {
      type: 'line',
    },
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      style: {
        bg: 'white',
      },
    },
    hidden: true,
  });

  shutdownPrompt = blessed.box({
    content: 'Press ESC again to exit Hermes or press ENTER to cancel.',
    width: 'shrink',
    height: 'shrink',
    top: 'center',
    left: 'center',
    border: {
      type: 'line',
    },
    hidden: true,
  });

  input.key('enter', () => {
    ChatClient.parseCommand(input.getValue());
    input.setValue('');
    input.focus();
    screen.render();
  });

  input.key(['C-c'], () => process.exit(0));
  input.key(['tab'], () => {
    input.value = ChatClient.processAutocomplete(input.value.trim().split(' '));
    screen.render();
  });
  input.key(['escape'], () => {
    shutdownPrompt.toggle();
    screen.render();
  });

  inputBox.on('mousedowwn', () => input.focus());

  screen.append(chatBox);
  screen.append(inputBox);
  screen.append(channelBox);
  screen.append(userBox);
  screen.append(helpBox);
  screen.append(filesBox);
  screen.append(invitesBox);
  screen.append(errorLog);
  screen.append(shutdownPrompt);
  screen.append(lookupBox);

  screen.render();

  input.focus();

  screen.key(['escape'], () => {
    process.exit(0);
  });

  screen.key(['enter'], () => {
    shutdownPrompt.toggle();
    input.focus();
    screen.render();
  });
}

/**
 * Update the channels list in the TUI
 *
 * @param channels - List of channels to show in the TUI
 */
function updateChannels(channels: Channel[]) {
  channelList.clearItems();
  for (const channel of channels) {
    channelList.add(channel.name);
  }
  screen.render();
}

/**
 * Update the users list in the TUI
 *
 * @param onlineUsers - List of online users to show in the list
 * @param offlineUsers - List of offline users to show in the list
 */
function updateUsers(onlineUsers: User[], offlineUsers: User[]) {
  userBox.clearItems();
  for (const user of onlineUsers) userBox.add(`${chalk.green('⬤')}  ${user.username || user.id}`);
  for (const user of offlineUsers) userBox.add(`${chalk.gray('⬤')}  ${user.username || user.id}`);
  screen.render();
}

/**
 * Write a message to the central chat window
 *
 * @param message - message to be written
 */
function writeMessage(message: string) {
  chatLog.log(message);
}

/**
 * Logs an error message to the error log in the TUI and shows the error log
 *
 * @param error - The error message to log
 */
function logError(error: string) {
  if (errorLog.hidden) errorLog.toggle();
  if (!helpBox.hidden) helpBox.toggle();
  if (!filesBox.hidden) filesBox.toggle();
  if (!lookupBox.hidden) lookupBox.toggle();

  const time: string = DateTime.now().toLocal().toFormat('HH:mm:ss');

  chatBox.height = '65%';
  errorLog.log(`(${chalk.redBright(time)}) - ${error}`);
  screen.render();
}

/**
 * Set the label of the chat box in the TUI
 *
 * @param label - String label to display as the label of the chat box
 */
function setChatBoxLabel(label: string) {
  chatBox.setLabel(label ? ` Chat - ${label} ` : ' Chat ');
  screen.title = label ? ` Hermes - ${label} ` : ' Hermes ';
  screen.render();
}

/**
 * Set the label of the lookup box in the TUI
 *
 * @param label - String label to display as the label of the chat box
 */
function setLookupLabel(label: string) {
  lookupBox.setLabel(label ? ` Lookup - ${label} ` : ' Lookup ');
  screen.render();
}

/**
 * Clear the chat box in the TUI
 */
function clearChatBox() {
  chatLog.setContent('');
  screen.render();
}

/**
 * Generate the content for the help box in the TUI
 *
 * @returns The content for the help box
 */
function generateHelpContent() {
  const commands = [
    { command: chalk.yellowBright('/nick <username>'), description: 'Change your username.' },
    { command: chalk.yellowBright('/open <channel>'), description: 'Open a channel.' },
    {
      command: chalk.yellowBright('/create <channel> [<type>]'),
      description:
        'Create a channel of given type. If no type is given, the type is public. Allowed types: public, private, private_encrypted, direct_message, direct_message_encrypted.',
    },
    {
      command: chalk.yellowBright('/sendfile <PATH> <huffman or lzw>'),
      description:
        'Send the text file at PATH to all the users in the current channel. The path can be relative or absolute. If the file is located in /file-sharing/to-send/, only the file name can be used instead of the entire path.',
    },
    {
      command: chalk.yellowBright('/showfiles'),
      description: 'Shows or hides the box of all previously sent files in the current channel.',
    },
    {
      command: chalk.yellowBright('/requestfile <HASH>'),
      description:
        'Request a previously sent file. The hash can be found in the files box, which can be toggled with /showfiles.',
    },
    { command: chalk.yellowBright('/showlookup'), description: 'Shows or hides the lookup box.' },
    {
      command: chalk.yellowBright('/lookup <yyyy-MM-dd> <HH:mm>'),
      description:
        'Looks up the closest message to the given date and time. The date and time must be in the format yyyy-MM-dd HH:mm.',
    },
    { command: chalk.yellowBright('/close'), description: 'Closes the current channel.' },
    { command: chalk.yellowBright('/showinvites'), description: 'Shows or hides the invites list box.' },
    { command: chalk.yellowBright('/invite <e-mail>'), description: 'Sends an invite to the given user.' },
    { command: chalk.yellowBright('/acceptinvite <channel>'), description: 'Accepts the channel invite.' },
    { command: chalk.yellowBright('/refuseinvite <channel>'), description: 'Refuses the channel invite.' },
    { command: chalk.yellowBright('/help'), description: 'Shows or hides this command box.' },
    { command: chalk.yellowBright('/error'), description: 'Shows or hides the error log box.' },
    { command: chalk.yellowBright('/exit'), description: 'Exit the application.' },
    { command: chalk.yellowBright('/deleteuser'), description: 'Delete your account, this action can not be undone.' },
  ];

  const longestCommandLength = Math.max(...commands.map(({ command }) => command.length));

  return commands
    .map(({ command, description }) => {
      return `${command.padEnd(longestCommandLength)} ${' '.repeat(2)} - ${description}`;
    })
    .join('\n');
}

/**
 * Show or hide the help box in the TUI
 */
function showHelp() {
  if (!filesBox.hidden) filesBox.toggle(); // hide file window if this was open
  if (!errorLog.hidden) errorLog.toggle(); // hide invites window if this was open
  if (!lookupBox.hidden) lookupBox.toggle(); // hide lookup window if this was open

  helpBox.toggle();
  chatBox.height = helpBox.hidden ? '95%' : '65%';
  screen.render();
}

/**
 * Set the content of the files box in the TUI and show it
 *
 * @param content - Content to be displayed in the files box
 */
function setFilesContent(content: string) {
  if (!helpBox.hidden) helpBox.toggle(); // hide help window if this was open
  if (!lookupBox.hidden) lookupBox.toggle(); // hide lookup window if this was open
  if (!errorLog.hidden) errorLog.toggle(); // hide error window if this was open
  if (filesBox.hidden) filesBox.toggle(); // show file window if this was hidden

  filesBox.setContent(content);
  chatBox.height = filesBox.hidden ? '95%' : '65%';
  screen.render();
}

function setFilesLabel(label: string) {
  filesBox.setLabel(label ? ` Files - ${label} ` : ' Files ');
  screen.render();
}

/**
 * Clear the content of the files box in the TUI and hides it
 */
function clearFilesContent() {
  filesBox.setContent('');
  filesBox.hide();
  chatBox.height = '95%';
  screen.render();
}

/**
 * Shows the files box in the TUI
 */
function showFiles() {
  if (!helpBox.hidden) helpBox.toggle(); // hide help window if this was open
  if (!errorLog.hidden) errorLog.toggle(); // hide error window if this was open
  if (!lookupBox.hidden) lookupBox.toggle(); // hide lookup window if this was open

  filesBox.toggle();
  chatBox.height = filesBox.hidden ? '95%' : '65%';
  screen.render();
}
/**
 * Set the content of the lookup box in the TUI and show it
 *
 * @param content
 */
function setLookupContent(content: string) {
  if (!helpBox.hidden) helpBox.toggle(); // hide help window if this was open
  if (!filesBox.hidden) filesBox.toggle(); // hide file window if this was open
  if (!errorLog.hidden) errorLog.toggle(); // hide error window if this was open
  if (lookupBox.hidden) lookupBox.toggle(); // show lookup window if this was closed

  lookupBox.setContent(content);
  chatBox.height = lookupBox.hidden ? '95%' : '65%';
  screen.render();
}

/**
 * Show or hide the lookup box in the TUI
 */
function showLookup() {
  if (!helpBox.hidden) helpBox.toggle(); // hide help window if this was open
  if (!errorLog.hidden) errorLog.toggle(); // hide error window if this was open
  if (!filesBox.hidden) filesBox.toggle(); // hide file window if this was open

  lookupBox.toggle();
  chatBox.height = lookupBox.hidden ? '95%' : '65%';
  screen.render();
}

/**
 * Show or hide the error log in the TUI
 */
function showError() {
  if (!helpBox.hidden) helpBox.toggle(); // hide help window if this was open
  if (!filesBox.hidden) filesBox.toggle(); // hide file window if this was open
  if (!lookupBox.hidden) lookupBox.toggle(); // hide lookup window if this was open

  errorLog.toggle();
  chatBox.height = errorLog.hidden ? '95%' : '65%';
  screen.render();
}

/**
 * Set the content of the invites box in the TUI
 *
 * @param content - Content to be displayed in the invites box
 */
function setInviteContent(channels: Channel[]) {
  updateInviteCount(channels.length);
  invitesBox.clearItems();
  channels.forEach((channel) => {
    invitesBox.add(channel.name);
  });
  screen.render();
}

/**
 * Show or hide the invites box in the TUI
 */
function showInvites() {
  invitesBox.toggle();
  channelBox.height = invitesBox.hidden ? '95%' : '65%';
  screen.render();
}

/**
 * Updates the invite notification message to display the correct number of open invites
 *
 * @param inviteAmount The amount of currently open invites
 */
function updateInviteCount(inviteAmount: number) {
  // Update color:
  const notifColor = inviteAmount === 0 ? 'grey' : 'yellow';
  if (!inviteNotif.style) {
    inviteNotif.style = { fg: notifColor };
  } else {
    (inviteNotif.style as { fg: string }).fg = notifColor;
  }

  // Update text:
  inviteNotif.content = createInviteNotificationMessage(inviteAmount);
  screen.render();
}

/**
 * Constructs a string message representing the amount of open invites.
 * Currently displays 10 or more invites as '9+ Invites'.
 *
 * @param inviteAmount The amount of open invites
 * @returns A string message representing the amount of open invites
 */
function createInviteNotificationMessage(inviteAmount: number): string {
  const notifAmount: string = inviteAmount > 9 ? '9+' : inviteAmount.toString();
  return notifAmount + ' Invite' + (inviteAmount === 1 ? '' : 's');
}
