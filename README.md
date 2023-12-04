# ![](https://i.imgur.com/TcupMvo.png 'Hermes logo') 
# Hermes 

The Hermes chatter is a real-time messaging application that enables users to communicate seamlessly with each other. These communications take place in group chats, which users can create/leave/join. Hermes provides a reliable, secure and efficient platform for instant messaging, additionaly supporting text-file transfers. At this stage of development, the application provides users with a terminal interface, containing minimal working functionalities as prove of concept.

**Table of contents:**

- [Getting Started](#getting-started)
- [Running the App](#running-the-app)
- [Development](#development)
- [Testing](#testing)
- [List of Commands](#list-of-commands)

<br>

## Getting Started

Before running or testing the app, ensure you have the necessary dependencies installed. Use the following commands:

```shell
npm ci
```

<br>

## Running the App

To start the Chatter app, run the following command:

```shell
npm run client
```

This will launch the client in current terminal and connect to a server. Communication is secured by modern day standards utilizing RSA encripted certificates. User information is stored in accordance to European GDPR rules, you only need to setup a valid server for the client to connect with.

<br>

## Development

For local development and testing or code review, you can run the server in debug mode, on the localhost address. To achieve this and make connection with a localhost client, effectuate the following commands:

```shell
npm run dev-server
npm run dev-client
```

Node Package Manager (npm) warnings regarding the **punycode** module can be ignored. This is due to the fact that the users' local machine runs a newer npm version than what punycode or other modules with punycode as dependency are rated for. Node Package Manager version v21.0.0 or newer is recommended, downgrading to version v20.9.0 resolves punycode warnings.

Commands mentioned above run the client in normal mode and server in debug mode. The task description mentioned that the client should be able to run in debug mode. Note the debug statements render the terminal poorly readable and interactable. Starting the client with debug mode on localhost adress can be achieved by following command:

```shell
npm run dev-client-debug
```

<br>

## Testing

Run all the **Vitest** test cases with extension ".mts" (typescript files) to ensure the reliability of the application, using following command:

```shell
npm run test-mts
```

Building the javascript files, and testing these requires a different command. Testing both typescript files and javascript files simultaneously will result in locking issues, and consequently fail certain tests. **Vitest** module effectuates these test concurrently on multiple threads, resulting in said failures. Following commands build and test the javafiles:

```shell
npm run build
npm run test-mjs
```

<br>

## List of Commands

Chatter supports various commands for a seamless messaging experience. Here is a list of available commands:

| Command | Arguments | Description                                                     |
| ------- | --------- | --------------------------------------------------------------- |
| send    | message   | Sends a message over the WebSocket                              |
| nick    | nickname  | Change current nickname by new entry                            |
| open    | channel   | Opens the specified channel                                     |
| create  | channel   | Creates a new channel and opens it                              |
| close   | /         | Closes the currently open channel                               |
| list    | /         | Provides a list of all existing channels                        |
| help    | /         | Displays a list of all possible commands and their descriptions |
| exit    | /         | Closes the application                                          |

##

Feel free to contribute, report issues, or suggest improvements. Happy chatting on Hermes, _the messenger of the gods_!
