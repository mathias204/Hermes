[![NPM badge](https://badge.fury.io/js/npm.svg)](https://gitlab.kuleuven.be/p-en-o-cw/2023-2024/chatter/team-03) [![License badge](https://img.shields.io/badge/License-Apache_2.0-brightgreen.svg)](https://gitlab.kuleuven.be/p-en-o-cw/2023-2024/chatter/team-03)

<div align="center">
<center><a  href="https://gitlab.kuleuven.be/p-en-o-cw/2023-2024/chatter/team-03"><img  src="https://i.imgur.com/TcupMvo.png"  alt="Hermes logo"  height="160"  /></center>
</div>

<div align="center">
<center><h1  align="center">Hermes</h1></center>
</div>

<div align="center">
<center><strong>A real-time messaging application that enables users to communicate seamlessly and securely with each other.</strong></center>
</div>

<br>

<div align="center">
<center><a  href="https://gitlab.kuleuven.be/p-en-o-cw/2023-2024/chatter/team-03"><img  src="https://imgur.com/SJbp6a5.png"  alt="Hermes TUI"  height="450"  /></center>
</div>

<br>

Hermes is a real-time messaging application, meticulously designed in JavaScript and TypeScript. With TypeScript being widely embraced in modern software development for its improvement in code quality. Hermes ensures a reliable, secure, and efficient platform for instant messaging, along with support for text-file transfers.

At this stage of development, Hermes offers users a terminal interface showcasing essential functionalities, serving as proof of concept for the application's core capabilities. Possible future iterations will expand upon this foundation, enriching the user experience with advanced features and a polished user interface.

### Features

- Cloud implementation of server and database
- End-to-end encryption for increased security
- Load last messages when opening a channel
- Scroll up through messages in a channel
- User-friendly Text-based User Interface (TUI)
- Self-developed, efficiently structured database implementation
- Multiple compression algorithms for file-sending feature
- Password strength checker upon sign-up
- Message lookup feature
- Message sending and standard channel operations (join/leave/...)
- Possibility to start invite-only channels
- Possibility to start private conversation with other client (DM)
- Data purging from database by means of daily clean-up script
- Meticulous unit-testing and mocking
- Graceful shutdown of the server (server persistence)
- Carefully follows GDPR guidelines

<br>
<br>

# Table of contents

- [Getting started](#getting-started)
  - [Requirements](#requirements)
  - [Installation](#installation)
- [Basic usage](#basic-usage)
  - [Running the application](#running-the-application)
  - [List of commands](#list-of-commands)
- [Debugging and Testing](#debugging-and-testing)
  - [Development mode](#development-mode)
  - [Testing](#testing)
- [License](#license)
- [Credits](#credits)

<br>

# Getting started

To begin, you must clone the repository before running the code on your local machine or cloud environment. This can be done using the following command; note you must have git installed:

```bash
$ git clone git@gitlab.kuleuven.be:p-en-o-cw/2023-2024/chatter/team-03.git
```

Should you not have git installed, [here](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) is a guide on how to install it.

## Requirements

It is recommened to use a Linux-based machine to run this application; this is the operating system for which the TUI was optimized.

First, make sure to have a recent version of "Node Version Manager" (NVM) installed. To install or update NVM one of the following cURL or Wget commands can be used. Note that a restart may be in order to correctly start up NVM.

```bash
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

```bash
$ wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

##

Afterwards you can use the `nvm` command to install the latest version of `node`. This can be done using the following command.

```bash
$ nvm install node
```

##

Finally, the last required package is "Node Package Manager" (NPM). This can be installed using the `nvm` command, illustrated here as well.

```bash
$ nvm install-latest-npm
```

Important note: Upon running the application for the first time, it is possible that other dependencies that are not installed will need to be installed. Follow the instructions in the terminal to do this.

## Installation

Now that all required dependencies and modules are installed, the application can be installed onto the machine or cloud. To do this, we first make a clean install of the required "Node Modules", followed by compiling the JavaScript files in a "build" folder.

Building the JavaScript files is NOT required when testing the client, as will be demonstrated in basic usage section below.

```bash
$ npm ci
```

```bash
$ npm run build
```

<br>

# Basic usage

For this section, we assume a cloud server or Raspberry Pi server has been correctly set up. SSL certificates have been properly defined, and these were hidden from the GitLab repository for security purposes.

Please note and understand that the current cloud server will be terminated after this academic semester.

## Running the application

To launch the refined client Text-based Terminal Interface, input following command after having installed previously mentioned "Node modules" using `npm ci`.

```bash
$ npm run client
```

This will launch the client in the current terminal and connect to our cloud server. It is recommended to maximize the terminal window for the best experience. Communication is secured by modern-day standards utilizing RSA encrypted certificates. User information is stored in accordance with European GDPR rules; requests to purge personal information can be sent to [hermes.info.questions@gmail.com](mailto:hermes.info.questions@gmail.com?subject=Chatter-PenOCWProject%20Inquiry&body=Hello,%0A%0AI%20have%20the%20following%20questions%3A%0A%0A). Upon inactivity or using the `delete account` command in the TUI, user information is also purged from the database.

## Terminal navigations

- `TAB`: Used to move to the next field.
- `SHIFT` + `TAB`: Used to move the previous field.
- `ESC`: Exit current field, close application if pressed 2x.
- `MOUSE INPUT`: Supported for some operations like clickable boxes in the TUI.

## List of commands

Hermes chatter supports various commands for a seamless messaging experience. Here is a list of available commands, also displayed in the TUI upon request.
| Command | Arguments | Description |
| ------------- | ---------------- | --------------------------------------------------------------- |
| /nick | `<username>` | Change your username. |
| /open | `<channel>` | Open a channel. |
| /create | `<channel>` `<[type]>` | Create a channel of given type. If no type is given, the type is public. Allowed types: public, private, private_encrypted, direct_message, direct_message_encrypted. |
| /sendfile | `<path>` `<huffman or lzw>` | Send the text file at PATH to all users in the current channel. The path can be relative or absolute. If the file is located in /file-sharing/to-send/, only the file name can be used instead of the entire path. |
| /showfiles | / | Shows or hides the box of all previously sent files in the current channel. |
| /requestfile | `<HASH>` | Request a previously sent file. The hash can be found in the files box, which can be toggled with /showfiles. |
| /showlookup | / | Shows or hides the lookup box. |
| /lookup | `<yyyy-MM-dd>` `<HH:mm>` | Looks up the closest message to the given date and time. The date and time must be in the format yyyy-MM-dd HH:mm. |
| /close | / | Close the current channel. |
| /showinvites | / | Shows or hides the invites list box. |
| /invite | `<e-mail>` | Sends an invite to the given user, must be in a channel. |
| /acceptinvite | `<channel>` | Accepts the channel invite. |
| /refuseinvite | `<channel>` | Refuses the channel invite. |
| /help | / | Shows or hides this command box. |
| /error | / | Shows or hides the error log box. |
| /exit | / | Exit the application. |
| /deleteuser | / | Delete your account, this action can not be undone. |

<br>

# Debugging and testing

## Development mode

For local development, testing, or code review, you can run the server in debug mode on the localhost address. To achieve this and make a connection with a localhost client, execute the following commands:

```bash
$ npm run dev-server-debug
$ npm run dev-client
```

Note: Upon inspecting the `package.json` file, you might notice other npm commands. These are for the GitLab pipeline, which are of no use for the user and can be ignored.

## Testing

Tests run in Vitest using the `istanbul` coverage provider, as opposed to the standard `v8` provider. The change in provider was made to best fit our needs; it was a personal preference to facilitate the testing process. Due to the meticulous test cases, it is necessary to run the tests with an **empty database**, which is the default state when pulling this repository.

- `npm run test` runs all test suites present, but there is a chance of failure if the JavaScript files have been built beforehand. It is not recommended for inexperienced users, as it may give false positive errors. These errors occur due to conflicts while concurrently running both the .mjs and .mts test suites, which is the default case for `Vitest`.

- `npm run coverage` runs all test suites present and generates a coverage report. This report can be viewed in the terminal or in the web browser by opening the `index.html` file in the newly generated `coverage` folder present in the directory. The latter provides a very in-depth code analysis of the coverage. Note: do NOT build the JavaScript files before running this command for the same reasons as explained above.

<br>

Due to this (expected) issue, and if the user is inexperienced, it is advised to follow the procedure and commands illustrated below when running test files.
Run all the vitest test cases with the extension ".mts" (TypeScript files) to ensure the reliability of the application using the following command:

```bash
$ npm run test-mts
```

Building the JavaScript files and testing them require different commands. Run all the Vitest test cases with the extension ".mjs" using the following commands:

```bash
$ npm run build
$ npm run test-mjs
```

<br>

# License

An Apache 2.0 license was chosen for this project. More information can be found in the [LICENSE.md](https://gitlab.kuleuven.be/p-en-o-cw/2023-2024/chatter/team-03/-/blob/main/LICENSE.md) file in this directory, or on [this website](https://www.apache.org/licenses/LICENSE-2.0).
It was the logical choice since it is the strictest license present in our used dependencies, which can be found in the [LICENSES.md](https://gitlab.kuleuven.be/p-en-o-cw/2023-2024/chatter/team-03/-/blob/main/LICENSES.md) file also in this directory.

<br>
