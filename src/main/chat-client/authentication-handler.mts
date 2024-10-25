import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { AuthenticationTUI } from './authentication-tui.mjs';
import { passwordSchema, userIdSchema, userNickSchema } from '../protocol/proto.zod.mjs';
import { sendToServer } from '../lib/communication/send.mjs';
import type { LogInCompleted, LogInRefused, SignUpCompleted, SignUpRefused } from '../protocol/proto.mjs';
import { ChatClient } from './chat-client.mjs';
import { passwordStrength } from './pass-entropy.mjs';

export const AuthenticationHandler = {
  authenticateUser,
  logInUser,
  registerUser,
  onSignUpRefused,
  onSignUpCompleted,
  onLogInRefused,
  onLogInCompleted,
};

function authenticateUser(ws: IWebSocket) {
  AuthenticationTUI.showLoginScreen(ws);
}

function logInUser(ws: IWebSocket, email: string, password: string) {
  if (!userIdSchema.safeParse(email).success) {
    AuthenticationTUI.showLoginScreen(ws, '', '', 'Invalid e-mail or password');
    return;
  }

  if (!password) {
    AuthenticationTUI.showLoginScreen(ws, '', '', 'Please enter a password');
    return;
  }

  if (!passwordSchema.safeParse(password).success) {
    AuthenticationTUI.showLoginScreen(ws, '', '', 'Invalid e-mail or password');
    return;
  }

  sendToServer(ws, {
    command: 'login_request',
    data: {
      user: {
        id: email,
      },
      password,
    },
  });
}

function onLogInCompleted(ws: IWebSocket, response: LogInCompleted) {
  ChatClient.launchApp(ws, response);
}

function onLogInRefused(ws: IWebSocket, response: LogInRefused) {
  switch (response.error_code) {
    case 101:
    case 102:
      AuthenticationTUI.showLoginScreen(ws, '', '', 'Password or email is incorrect');
      break;
    default:
      AuthenticationTUI.showLoginScreen(
        ws,
        '',
        '',
        `Unknown server error code: ${response.error_code}${response.reason ? `\nReason: ${response.reason}, contact an administrator` : ''}`,
      );
      break;
  }
}

function registerUser(ws: IWebSocket, email: string, username: string, password: string, repeatedPassword: string) {
  if (!userIdSchema.safeParse(email).success) {
    AuthenticationTUI.showRegisterScreen(ws, '', username, '', '', true, 'Invalid e-mail address');
    return;
  }

  if (!userNickSchema.safeParse(username).success) {
    AuthenticationTUI.showRegisterScreen(
      ws,
      email,
      '',
      '',
      '',
      true,
      'The username has to be between 1 and 30 characters',
    );
    return;
  }

  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    const missedRequirements = passwordResult.error.errors.map((error) => error.message).join('\n');
    AuthenticationTUI.showRegisterScreen(
      ws,
      email,
      username,
      '',
      '',
      true,
      `The password does not conform to the following requirement(s):\n${missedRequirements}`,
    );
    return;
  }

  if (password !== repeatedPassword) {
    AuthenticationTUI.showRegisterScreen(ws, email, username, '', '', true, 'Passwords do not match');
    return;
  }

  if (passwordStrength(password) === 'WEAK') {
    AuthenticationTUI.showRegisterScreen(ws, email, username, '', '', true, 'The given password is not strong enough');
    return;
  }

  sendToServer(ws, {
    command: 'signup_request',
    data: {
      user: {
        id: email,
        username,
      },
      password,
    },
  });
}

function onSignUpCompleted(ws: IWebSocket, response: SignUpCompleted) {
  ChatClient.launchApp(ws, response);
}

function onSignUpRefused(ws: IWebSocket, response: SignUpRefused) {
  switch (response.error_code) {
    case 103:
      AuthenticationTUI.showRegisterScreen(ws, '', '', '', '', true, 'This email address has already been used');
      break;
    default:
      AuthenticationTUI.showRegisterScreen(
        ws,
        '',
        '',
        '',
        '',
        true,
        `Unknown server error code: ${response.error_code}${response.reason ? `\nReason: ${response.reason}, contact an administrator` : ''}`,
      );
      break;
  }
}
