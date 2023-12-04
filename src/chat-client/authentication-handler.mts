import type { IWebSocket } from '../protocol/ws-interface.mjs';
import type {
  LogInCompleted,
  LogInRefused,
  LogInRequestCommand,
  SignUpRequest,
  SignUpRequestCommand,
  SignUpRefused,
  SignUpCompleted,
  UserNick,
} from '../protocol/proto.mjs';

import Debug from 'debug';
import { userIdSchema } from '../protocol/proto.zod.mjs';
import { ChatClient } from './chat-client.mjs';
import * as inquirer from '@inquirer/prompts';

const debug = Debug('chatter:login-handler');

export const AuthenticationHandler = {
  onLoginRequestTimedOut,
  onLoginRefused,
  onLoginCompleted,
  authenticateUser,
  onSignUpRefused,
  onSignUpCompleted,
  loginUser,
  registerUser,
};

let requestTimeout: NodeJS.Timeout;

/**
 * Handles the user login for the chat client: asks for email and password and sends a LoginRequest to the server
 *  - debug mode: uses a predefined email and password
 *
 * @param ws - websocket which is used to send and receive messages
 */
async function authenticateUser(ws: IWebSocket) {
  const answers = await inquirer.select({
    message: 'What do you want to do?',
    choices: [
      { name: 'Log in', value: 'login' },
      { name: 'Register', value: 'register' },
      { name: 'Exit', value: 'exit' },
    ],
  });
  switch (answers) {
    case 'login':
      await AuthenticationHandler.loginUser(ws);
      break;
    case 'register':
      await AuthenticationHandler.registerUser(ws);
      break;
    case 'exit':
      exit();
      break;
    default:
      throw new Error('Invalid choice');
  }
}

/**
 * exits the application
 */
function exit() {
  process.exit(0);
}

/**
 * Handles the user login for the chat client: asks for email and password and sends a LoginRequest to the server
 * @param ws - websocket which is used to send and receive messages
 */
async function loginUser(ws: IWebSocket) {
  let userId = await inquirer.input({ message: 'Email: ' });
  while (!userIdSchema.safeParse(userId).success) {
    userId = await inquirer.input({ message: 'Email is invalid, please try again: ' });
  }

  const userPassword: string = await inquirer.password({ message: 'Password: ', mask: '*' });
  const requestLoginCommand: LogInRequestCommand = {
    command: 'login_request',
    data: { user: { id: userId }, password: userPassword },
  };
  ws.send(JSON.stringify(requestLoginCommand));
  requestTimeout = setTimeout(AuthenticationHandler.onLoginRequestTimedOut, 10000);
}

/**
 * Handles the user registration for the chat client: asks for email, username and password and sends a SignUpRequest to the server
 * @param ws - websocket which is used to send and receive messages
 */
async function registerUser(ws: IWebSocket) {
  const answer = await inquirer.select({
    message: 'In order to register, you need to agree that we store your data conform to the GDPR.',
    choices: [
      { name: 'I agree', value: 'agree' },
      { name: 'I do not agree', value: 'disagree' },
    ],
  });
  if (answer === 'agree') {
    const userId = await inquirer.input({ message: 'Email: ' });
    if (!userIdSchema.safeParse(userId).success) {
      console.error('Email is invalid, please try again');
      void AuthenticationHandler.authenticateUser(ws);
      return;
    }
    const userName: UserNick = await inquirer.input({ message: 'Username: ' });
    const userPassword: string = await inquirer.password({ message: 'Password: ', mask: '*' });
    const userPasswordRepeat: string = await inquirer.password({ message: 'Repeat password: ', mask: '*' });
    if (userPassword !== userPasswordRepeat) {
      console.error('Passwords do not match');
      void AuthenticationHandler.authenticateUser(ws);
      return;
    }
    const requestLoginCommand: SignUpRequestCommand = {
      command: 'signup_request',
      data: { user: { id: userId, username: userName }, password: userPassword } as SignUpRequest,
    };
    ws.send(JSON.stringify(requestLoginCommand));
    requestTimeout = setTimeout(AuthenticationHandler.onLoginRequestTimedOut, 10000);
  } else {
    process.exit(0);
  }
}

/**
 * Handles the refusal of a signup request and throws an error.
 * @param ws - websocket which is used to send and receive messages
 * @param data - signupRefused data: error code and reason
 *             -- error_code: 103 - email is already in use
 */
function onSignUpRefused(ws: IWebSocket, data: SignUpRefused) {
  clearTimeout(requestTimeout);
  switch (data.error_code) {
    case 103:
      console.error('Email already in use');
      void AuthenticationHandler.authenticateUser(ws);
      break;
    default:
      console.error(`Unknown error code: ${data.error_code}, reason: ${data.reason} contact the administrator`);
  }
}

/**
 * Handles the completion of a signup request and launches the chat application.
 * @param ws - websocket which is used to send and receive messages
 * @param data - signupCompleted data: id and username, if known user
 */
function onSignUpCompleted(ws: IWebSocket, data: SignUpCompleted) {
  debug('SignUpCompleted received');
  clearTimeout(requestTimeout);
  ChatClient.launchApp(ws, data);
}

/**
 * Handles the completion of a login request and launches the chat application.
 * @param ws - websocket which is used to send and receive messages
 * @param data - loginCompleted data: id and username, if known user
 */
function onLoginCompleted(ws: IWebSocket, data: LogInCompleted) {
  clearTimeout(requestTimeout);
  ChatClient.launchApp(ws, data);
}

/**
 * Handles the refusal of a login request and throws an error.
 *
 * @param ws - websocket which is used to send and receive messages
 * @param data - loginRefused data: error code and reason
 *             -- error_code: 101 - user is not known to the database
 *             -- error_code: 102 - password is incorrect
 */
async function onLoginRefused(ws: IWebSocket, data: LogInRefused) {
  clearTimeout(requestTimeout);
  switch (data.error_code) {
    case 101:
    case 102:
      console.error(`Password or email is incorrect`);
      await AuthenticationHandler.authenticateUser(ws);
      break;
    default:
      console.error(`Unknown error code: ${data.error_code}, reason: ${data.reason}`);
      break;
  }
}

/**
 * Handles timed out event of a login request.
 */
function onLoginRequestTimedOut() {
  debug('No response received from server, login request timed out');
}
