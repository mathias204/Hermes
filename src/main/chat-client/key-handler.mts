import fs from 'fs';
import { Encryption, type KeyPair, type PrivateKey, type PublicKey } from '../lib/encryption/encryption.mjs';
import type {
  ChannelId,
  PublicKeyRefused,
  PublicKeyResponse,
  UpdatePublicKeyRefused,
  UserId,
} from '../protocol/proto.mjs';
import type { IWebSocket } from '../protocol/ws-interface.mjs';
import { sendToServer } from '../lib/communication/send.mjs';
import { Tui } from './tui.mjs';
import chalk from 'chalk';

export const KeyHandler = {
  requestPublicKey,
  generateAndPublishKeyPair,
  getKeyPair,
  setKeyPair,
  onUpdatePublicKeyRefused,
  onPublicKeyResponse,
  onPublicKeyRefused,
  loadKeyPairFromFiles,
  saveKeyPairToFiles,
  loadChannelSecretFromFile,
  saveChannelSecretToFile,
};

interface ReceivedKey {
  userId: UserId;
  key: PublicKey | null;
}

let receivedKeys: ReceivedKey[] = [];

let keyPair: KeyPair | null = null;

/**
 * Requests a public key from the server
 *
 * @param socket socket to send the request to
 * @param requestedUserId - id of the user whose public key needs to be requested
 * @returns a promise containing the users public key
 */
async function requestPublicKey(socket: IWebSocket, requestedUserId: UserId): Promise<PublicKey> {
  sendToServer(socket, {
    command: 'public_key_request',
    data: {
      user_id: requestedUserId,
    },
  });

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const matchingKey = receivedKeys.find(({ userId }) => userId === requestedUserId);
      if (matchingKey) {
        receivedKeys = receivedKeys.filter(({ userId }) => userId !== requestedUserId);
        if (!matchingKey.key) {
          reject();
          return;
        }

        clearInterval(interval);
        resolve(matchingKey.key);
      }
    }, 10);
  });
}

/**
 * Generates a key pair, saves it to files and publishes the public key to the server
 *
 * @param socket - socket to publish the public key to
 * @param userId - own user ID
 * @returns Generated key pair
 */
function generateAndPublishKeyPair(socket: IWebSocket, userId: UserId): KeyPair {
  keyPair = Encryption.generateKeyPair();
  KeyHandler.saveKeyPairToFiles(keyPair, userId);

  sendToServer(socket, {
    command: 'update_public_key',
    data: {
      public_key: keyPair.publicKey,
    },
  });

  return keyPair;
}

/**
 * Sets the current key pair
 *
 * @param newKeyPair - new key pair
 */
function setKeyPair(newKeyPair: KeyPair | null) {
  keyPair = newKeyPair;
}

/**
 * Gets the current key pair
 *
 * @param socket - server socket
 * @param userId - own user id
 * @returns current key pair
 */
function getKeyPair(socket: IWebSocket, userId: UserId): KeyPair {
  if (keyPair) return keyPair;

  try {
    return KeyHandler.loadKeyPairFromFiles(userId);
  } catch {
    return KeyHandler.generateAndPublishKeyPair(socket, userId);
  }
}

/**
 * Saves the key pair to PEM formatted files
 *
 * @param keyPair - key pair to save
 * @param userId - own user id
 */
function saveKeyPairToFiles(keyPair: KeyPair, userId: UserId) {
  const publicPath = `assets/encryption/keys/${userId}.pub.pem`;
  const privatePath = `assets/encryption/keys/${userId}.pem`;

  fs.writeFileSync(publicPath, keyPair.publicKey);
  fs.writeFileSync(privatePath, keyPair.privateKey);
}

/**
 * Loads the key pair from PEM formatted files, throws an error if the files don't exist
 *
 * @param userId - own user id
 * @returns key pair
 */
function loadKeyPairFromFiles(userId: UserId): KeyPair {
  const publicPath = `assets/encryption/keys/${userId}.pub.pem`;
  const privatePath = `assets/encryption/keys/${userId}.pem`;
  if (!fs.existsSync(publicPath) || !fs.existsSync(privatePath)) {
    throw new Error('Keypair not saved');
  }

  const publicKey = fs.readFileSync(publicPath).toString() as PublicKey;
  const privateKey = fs.readFileSync(privatePath).toString() as PrivateKey;

  return {
    publicKey,
    privateKey,
  };
}

/**
 * Handles an UpdatePublicKeyRefused sent by the server
 *
 * @param data - data to handle
 */
function onUpdatePublicKeyRefused(data: UpdatePublicKeyRefused) {
  Tui.logError(chalk.red(`Failed to publish public key: ${data.error_code} ${data.reason}`));
}

/**
 * Handles an PublicKeyResponse sent by the server
 *
 * @param data - data to handle
 */
function onPublicKeyResponse(data: PublicKeyResponse) {
  receivedKeys.push({
    userId: data.user_id,
    key: data.public_key as PublicKey,
  });
}

/**
 * Handles an PublicKeyRefused sent by the server
 *
 * @param data - data to handle
 */
function onPublicKeyRefused(data: PublicKeyRefused) {
  Tui.logError(chalk.red(`Failed to retreive peer public key: ${data.error_code} ${data.reason}`));

  receivedKeys.push({
    userId: data.user_id,
    key: null,
  });
}

/**
 * Saves the given secret to a secret file
 *
 * @param channelId - id of the channel to which the secret belongs
 * @param secret - Buffer containing the secret
 */
function saveChannelSecretToFile(channelId: ChannelId, secret: Buffer) {
  const path = `assets/encryption/secrets/${channelId}.secret`;
  fs.writeFileSync(path, secret);
}

/**
 * Loads the the secret belonging to the given channel from a file
 *
 * @param channelId - id of the channel to which the secret belongs
 * @returns Buffer containing the secret
 */
function loadChannelSecretFromFile(channelId: ChannelId): Buffer {
  const path = `assets/encryption/secrets/${channelId}.secret`;
  if (!fs.existsSync(path)) throw new Error('Channel secret does not exist');
  return fs.readFileSync(path);
}
