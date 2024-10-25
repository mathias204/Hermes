import figlet from 'figlet';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import blessed from 'blessed';
import { AuthenticationHandler } from './authentication-handler.mjs';
import chalk from 'chalk';
import { passwordStrength } from './pass-entropy.mjs';

export const AuthenticationTUI = {
  showLoginScreen,
  showRegisterScreen,
};

function showPasswordStrength(passwordInput: blessed.Widgets.TextboxElement) {
  passwordInput.setLabel(` Password: (${passwordStrength(passwordInput.getValue())}) `);
}

function showLoginScreen(_ws: IWebSocket, email?: string, password?: string, error?: string) {
  const screen = blessed.screen({
    smartCSR: true,
    autoPadding: true,
    title: 'Hermes - Login',
  });

  const form = blessed.form({
    parent: screen,
    keys: true,
  });

  const titleBox = blessed.box({
    content: figlet.textSync('Hermes', { font: 'Slant' }),
    top: '7.5%',
    left: 'center',
    right: 'center',
    width: '100%',
    height: 10,
    align: 'center',
    border: {
      type: 'bg',
    },
  });

  const emailInput = blessed.textbox({
    top: '35%',
    left: '35%',
    right: '70%',
    height: 'shrink',
    width: '30%',
    label: ' Email ',
    clickable: true,
    inputOnFocus: true,
    border: {
      type: 'line',
    },
  });

  const passwordInput = blessed.textbox({
    top: '45%',
    left: '35%',
    right: '70%',
    height: 'shrink',
    width: '30%',
    clickable: true,
    inputOnFocus: true,
    censor: true,
    label: ' Password ',
    border: {
      type: 'line',
    },
  });

  const toggleMaskButton = blessed.button({
    parent: passwordInput,
    mouse: true,
    shrink: true,
    padding: {
      left: 1,
      right: 1,
    },
    style: {
      fg: 'white',
    },
    content: '[Show]',
    left: '100%-10',
  });

  const exitButton = blessed.button({
    parent: form,
    top: '70%',
    left: '35%',
    height: 'shrink',
    width: '10%',
    mouse: true,
    keys: true,
    content: 'Exit',
    align: 'center',
    focusable: true,
    border: {
      type: 'line',
    },
    style: {
      hover: {
        bg: 'white',
        fg: 'black',
      },
      focus: {
        bg: 'white',
        fg: 'black',
      },
    },
  });

  const signUpButton = blessed.button({
    parent: form,
    top: '70%',
    left: '45%',
    height: 'shrink',
    width: '10%',
    mouse: true,
    keys: true,
    content: 'Sign Up',
    align: 'center',
    border: {
      type: 'line',
    },
    style: {
      hover: {
        bg: 'white',
        fg: 'black',
      },
      focus: {
        bg: 'white',
        fg: 'black',
      },
    },
  });

  const logInButton = blessed.button({
    parent: form,
    top: '70%',
    left: '54.7%',
    height: 'shrink',
    width: '10%',
    mouse: true,
    keys: true,
    content: 'Log in',
    align: 'center',
    border: {
      type: 'line',
    },
    style: {
      border: {
        fg: 'white',
      },
      hover: {
        bg: 'white',
      },
      focus: {
        bg: 'white',
      },
    },
  });

  // email

  emailInput.on('mousedown', () => {
    emailInput.cancel();
    passwordInput.cancel();
    emailInput.focus();
  });

  emailInput.key(['enter', 'tab'], () => {
    emailInput.cancel();
    emailInput.value = emailInput.value.trim();
    screen.render();
    passwordInput.focus();
  });

  emailInput.key(['S-tab'], () => {
    emailInput.cancel();
    emailInput.value = emailInput.value.trim();
    screen.render();
    logInButton.focus();
  });

  // password

  passwordInput.on('submit', () => {
    screen.destroy();
    console.clear();
    AuthenticationHandler.logInUser(_ws, emailInput.getValue(), passwordInput.getValue());
  });

  passwordInput.on('mousedown', () => {
    emailInput.cancel();
    passwordInput.cancel();
    passwordInput.focus();
  });

  passwordInput.key(['tab'], () => {
    passwordInput.cancel();
    passwordInput.value = passwordInput.value.trim();
    screen.render();
    exitButton.focus();
  });

  passwordInput.key(['S-tab'], () => {
    passwordInput.cancel();
    passwordInput.value = passwordInput.value.trim();
    screen.render();
    emailInput.focus();
  });

  toggleMaskButton.on('mousedown', () => {
    passwordInput.censor = !passwordInput.censor;
    toggleMaskButton.content = passwordInput.censor ? '[Show]' : '[Hide]';
    passwordInput.setContent(passwordInput.censor ? '*'.repeat(passwordInput.value.length) : passwordInput.value); // masking hack
    screen.render();
  });

  // exit

  exitButton.on('mousedown', () => {
    screen.destroy();
    console.clear();
    process.exit(0);
  });

  exitButton.on('submit', () => {
    screen.destroy();
    console.clear();
    process.exit(0);
  });

  exitButton.key('enter', () => {
    screen.destroy();
    console.clear();
    process.exit(0);
  });

  exitButton.key(['tab'], () => {
    signUpButton.focus();
  });

  exitButton.key(['S-tab'], () => {
    passwordInput.focus();
  });

  // sign up

  signUpButton.on('mousedown', () => {
    screen.destroy();
    AuthenticationTUI.showRegisterScreen(_ws, emailInput.getValue(), '', passwordInput.getValue());
  });

  signUpButton.key('enter', () => {
    screen.destroy();
    AuthenticationTUI.showRegisterScreen(_ws, emailInput.getValue(), '', passwordInput.getValue());
  });

  signUpButton.key(['tab'], () => {
    logInButton.focus();
  });

  signUpButton.key(['S-tab'], () => {
    exitButton.focus();
  });

  // log in

  logInButton.on('mousedown', () => {
    screen.destroy();
    console.clear();
    AuthenticationHandler.logInUser(_ws, emailInput.getValue(), passwordInput.getValue());
  });

  logInButton.on('submit', () => {
    screen.destroy();
    console.clear();
    AuthenticationHandler.logInUser(_ws, emailInput.getValue(), passwordInput.getValue());
  });

  logInButton.key('enter', () => {
    screen.destroy();
    console.clear();
    AuthenticationHandler.logInUser(_ws, emailInput.getValue(), passwordInput.getValue());
  });

  logInButton.key(['tab'], () => {
    emailInput.focus();
  });

  logInButton.key(['S-tab'], () => {
    signUpButton.focus();
  });

  // screen

  screen.append(titleBox);
  screen.append(emailInput);
  screen.append(passwordInput);

  if (email) {
    emailInput.setValue(email);
  }

  if (password) {
    passwordInput.setValue(password);
  }

  if (error) {
    const errorBox = blessed.box({
      top: '80%',
      content: chalk.redBright(error),
      left: 'center',
      right: 'center',
      width: '100%',
      bottom: 'center',
      height: error.split('\n').length,
      align: 'center',
    });
    screen.append(errorBox);
  }

  screen.key(['escape', 'q', 'C-c'], function () {
    return process.exit(0);
  });

  screen.render();
  emailInput.focus();
  return;
}

function showRegisterScreen(
  ws: IWebSocket,
  email?: string,
  username?: string,
  password?: string,
  repeatedPassword?: string,
  gdprAcceptance?: boolean,
  error?: string,
) {
  const screen = blessed.screen({
    smartCSR: true,
    autoPadding: true,
    title: 'Hermes - Register',
  });

  const form = blessed.form({
    parent: screen,
    keys: true,
  });

  const titleBox = blessed.box({
    content: figlet.textSync('Hermes', { font: 'Slant' }),
    top: '7.5%',
    left: 'center',
    right: 'center',
    width: '100%',
    height: 10,
    align: 'center',
    border: {
      type: 'bg',
    },
  });

  const emailInput = blessed.textbox({
    top: '25%',
    left: '35%',
    right: '70%',
    height: 'shrink',
    width: '30%',
    label: ' Email ',
    clickable: true,
    inputOnFocus: true,
    border: {
      type: 'line',
    },
  });

  const usernameInput = blessed.textbox({
    top: '35%',
    left: '35%',
    right: '70%',
    height: 'shrink',
    width: '30%',
    label: ' Username ',
    clickable: true,
    inputOnFocus: true,
    border: {
      type: 'line',
    },
  });

  const passwordInput = blessed.textbox({
    top: '45%',
    left: '35%',
    right: '70%',
    height: 'shrink',
    width: '30%',
    mouse: true,
    censor: true,
    inputOnFocus: true,
    label: ' Password - Hover to see requirements ',
    border: {
      type: 'line',
    },
    hoverText:
      'A password has the following requirements:\n - Minimum length of 8 characters\n - Maximum length of 30 characters\n - Does not contain whitespace\n - Contains at least 1 number\n - Contains at least 1 lowercase letter\n - Contains at least 1 uppercase letter',
  });

  const repeatPasswordInput = blessed.textbox({
    top: '53.5%',
    left: '35%',
    right: '70%',
    height: 'shrink',
    width: '30%',
    mouse: true,
    inputOnFocus: true,
    censor: true,
    label: ' Repeat password ',
    border: {
      type: 'line',
    },
  });

  const toggleMaskButton = blessed.button({
    parent: passwordInput,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
      left: 1,
      right: 1,
    },
    style: {
      fg: 'white',
    },
    content: '[Show]',
    left: '100%-10',
  });

  const gdprBox = blessed.checkbox({
    parent: form,
    top: '62.5%',
    left: '35%',
    align: 'center',
    width: '30%',
    mouse: true,
    content: 'Do you agree that we store your data in conformity with the GDPR?',
    height: 'shrink',
  });

  const signUpButton = blessed.button({
    parent: form,
    top: '70%',
    left: '54.7%',
    height: 'shrink',
    width: '10%',
    mouse: true,
    keys: true,
    content: 'Sign up',
    align: 'center',
    border: {
      type: 'line',
    },
    style: {
      hover: {
        bg: 'white',
        fg: 'black',
      },
      focus: {
        bg: 'white',
        fg: 'black',
      },
    },
  });

  const backButton = blessed.button({
    parent: form,
    top: '70%',
    left: '35%',
    height: 'shrink',
    width: '10%',
    mouse: true,
    keys: true,
    content: 'Back',
    align: 'center',
    border: {
      type: 'line',
    },
    style: {
      hover: {
        bg: 'white',
        fg: 'black',
      },
      focus: {
        bg: 'white',
        fg: 'black',
      },
    },
  });

  // email

  emailInput.on('submit', () => {
    usernameInput.focus();
  });

  emailInput.on('mousedown', () => {
    usernameInput.cancel();
    emailInput.cancel();
    repeatPasswordInput.cancel();
    passwordInput.cancel();
    emailInput.focus();
  });

  emailInput.key(['tab'], () => {
    emailInput.cancel();
    emailInput.value = emailInput.value.trim();
    screen.render();
    usernameInput.focus();
  });

  emailInput.key(['S-tab'], () => {
    emailInput.cancel();
    emailInput.value = emailInput.value.trim();
    screen.render();
    signUpButton.focus();
  });

  // username

  usernameInput.on('submit', () => {
    passwordInput.focus();
  });

  usernameInput.on('mousedown', () => {
    usernameInput.cancel();
    emailInput.cancel();
    repeatPasswordInput.cancel();
    passwordInput.cancel();
    usernameInput.focus();
  });

  usernameInput.key(['tab'], () => {
    usernameInput.cancel();
    usernameInput.value = usernameInput.value.trim();
    screen.render();
    passwordInput.focus();
  });

  usernameInput.key(['S-tab'], () => {
    usernameInput.cancel();
    usernameInput.value = usernameInput.value.trim();
    screen.render();
    emailInput.focus();
  });

  // password

  passwordInput.on('submit', () => {
    repeatPasswordInput.focus();
  });

  passwordInput.on('keypress', (key) => {
    if (!key) return;
    if (passwordInput.getValue().trim().length < 0) {
      passwordInput.setLabel(' Password - Hover to see requirements ');
    } else if (passwordInput.getValue().trim().length > 29) {
      passwordInput.setLabel(` Password: (${chalk.red('TOO LONG')}) `);
    } else {
      passwordInput.setLabel(` Password: (${passwordStrength(passwordInput.getValue() + key)}) `);
    }
    screen.render();
  });

  passwordInput.key(['backspace'], () => {
    if (passwordInput.getValue().trim().length === 0) {
      passwordInput.setLabel(' Password - Hover to see requirements ');
    } else if (passwordInput.getValue().trim().length > 30) {
      passwordInput.setLabel(` Password: (${chalk.red('TOO LONG')}) `);
    } else {
      passwordInput.setLabel(` Password: (${passwordStrength(passwordInput.getValue())}) `);
    }
    screen.render();
  });

  passwordInput.key(['tab'], () => {
    if (passwordInput.getValue().trim().length === 0) {
      passwordInput.setLabel(' Password - Hover to see requirements ');
    } else if (passwordInput.getValue().trim().length > 30) {
      passwordInput.setLabel(` Password: (${chalk.red('TOO LONG')}) `);
    } else {
      passwordInput.setLabel(` Password: (${passwordStrength(passwordInput.getValue().slice(0, -1))}) `); // this is a hack so that the label does not update for the TAB input
    }
    passwordInput.cancel();
    passwordInput.value = passwordInput.value.trim();
    screen.render();
    repeatPasswordInput.focus();
  });

  passwordInput.key(['escape'], () => {
    if (passwordInput.getValue().trim().length === 0) {
      passwordInput.setLabel(' Password - Hover to see requirements ');
    } else if (passwordInput.getValue().trim().length > 30) {
      passwordInput.setLabel(` Password: (${chalk.red('TOO LONG')}) `);
    } else {
      passwordInput.setLabel(` Password: (${passwordStrength(passwordInput.getValue().slice(0, -1))}) `); // this is a hack so that the label does not update for the ESCAPE input
    }
    screen.render();
  });

  passwordInput.key(['S-tab'], () => {
    passwordInput.cancel();
    passwordInput.value = passwordInput.value.trim();
    screen.render();
    usernameInput.focus();
  });

  passwordInput.on('mousedown', () => {
    usernameInput.cancel();
    emailInput.cancel();
    repeatPasswordInput.cancel();
    passwordInput.cancel();
    passwordInput.focus();
  });

  toggleMaskButton.on('mousedown', () => {
    passwordInput.censor = !passwordInput.censor;
    repeatPasswordInput.censor = !repeatPasswordInput.censor;
    toggleMaskButton.content = passwordInput.censor ? '[Show]' : '[Hide]';
    passwordInput.setContent(passwordInput.censor ? '*'.repeat(passwordInput.value.length) : passwordInput.value); // masking hack
    repeatPasswordInput.setContent(
      passwordInput.censor ? '*'.repeat(repeatPasswordInput.value.length) : repeatPasswordInput.value,
    ); // masking hack
    screen.render();
  });

  // repeated password

  repeatPasswordInput.on('submit', () => {
    if (!gdprBox.checked) {
      screen.destroy();
      showRegisterScreen(
        ws,
        emailInput.getValue(),
        usernameInput.getValue(),
        passwordInput.getValue(),
        repeatPasswordInput.getValue(),
        false,
        'Please accept our terms and conditions.',
      );
      return;
    }
    screen.destroy();
    console.clear();
    AuthenticationHandler.registerUser(
      ws,
      emailInput.value,
      usernameInput.value,
      passwordInput.value,
      repeatPasswordInput.value,
    );
  });

  repeatPasswordInput.on('mousedown', () => {
    usernameInput.cancel();
    emailInput.cancel();
    repeatPasswordInput.cancel();
    passwordInput.cancel();
    repeatPasswordInput.focus();
  });

  repeatPasswordInput.key(['tab'], () => {
    repeatPasswordInput.cancel();
    repeatPasswordInput.value = repeatPasswordInput.value.trim();
    screen.render();
    backButton.focus();
  });

  repeatPasswordInput.key(['S-tab'], () => {
    repeatPasswordInput.cancel();
    repeatPasswordInput.value = repeatPasswordInput.value.trim();
    screen.render();
    passwordInput.focus();
  });

  // back

  backButton.on('mousedown', () => {
    screen.destroy();
    console.clear();
    AuthenticationTUI.showLoginScreen(ws, emailInput.getValue(), passwordInput.getValue());
  });

  backButton.key('enter', () => {
    screen.destroy();
    console.clear();
    AuthenticationTUI.showLoginScreen(ws, emailInput.getValue(), passwordInput.getValue());
  });

  backButton.key(['tab'], () => {
    signUpButton.focus();
  });

  backButton.key(['S-tab'], () => {
    repeatPasswordInput.focus();
  });

  // sign up

  signUpButton.on('mousedown', () => {
    if (!gdprBox.checked) {
      screen.destroy();
      showRegisterScreen(
        ws,
        emailInput.getValue(),
        usernameInput.getValue(),
        passwordInput.getValue(),
        repeatPasswordInput.getValue(),
        false,
        'Please accept our terms and conditions.',
      );
      return;
    }
    screen.destroy();
    console.clear();
    AuthenticationHandler.registerUser(
      ws,
      emailInput.value,
      usernameInput.value,
      passwordInput.value,
      repeatPasswordInput.value,
    );
  });

  signUpButton.key('enter', () => {
    if (!gdprBox.checked) {
      screen.destroy();
      showRegisterScreen(
        ws,
        emailInput.getValue(),
        usernameInput.getValue(),
        passwordInput.getValue(),
        repeatPasswordInput.getValue(),
        false,
        'Please accept our terms and conditions.',
      );
      return;
    }
    screen.destroy();
    console.clear();
    AuthenticationHandler.registerUser(
      ws,
      emailInput.value,
      usernameInput.value,
      passwordInput.value,
      repeatPasswordInput.value,
    );
  });

  signUpButton.key(['tab'], () => {
    emailInput.focus();
  });

  signUpButton.key(['S-tab'], () => {
    backButton.focus();
  });

  // screen

  screen.append(titleBox);
  screen.append(usernameInput);
  screen.append(passwordInput);
  screen.append(emailInput);
  screen.append(repeatPasswordInput);

  if (email) {
    emailInput.setValue(email);
  }

  if (username) {
    usernameInput.setValue(username);
  }

  if (password) {
    passwordInput.setValue(password);
    if (passwordInput.getValue().trim().length > 30) {
      passwordInput.setLabel(` Password: (${chalk.red('TOO LONG')}) `);
    } else {
      showPasswordStrength(passwordInput);
    }
  }

  if (repeatedPassword) {
    repeatPasswordInput.setValue(repeatedPassword);
  }

  if (error) {
    const errorBox = blessed.box({
      top: '80%',
      content: chalk.redBright(error),
      left: 'center',
      right: 'center',
      width: '100%',
      bottom: 'center',
      height: error.split('\n').length,
      align: 'center',
    });
    screen.append(errorBox);
  }

  if (gdprAcceptance) {
    gdprBox.check();
  }

  screen.key(['escape', 'q', 'C-c'], function () {
    return process.exit(0);
  });

  screen.render();
  emailInput.focus();
  return;
}
