import crypto from 'crypto';

export interface SymmetricKeys {
  encryptionKey: Buffer;
  macKey: Buffer;
}

export const Encryption = {
  generateKeyPair,
  generateRandomGroupSecret,
  calculateSharedSecret,
  deriveEncryptionKey,
  encryptMessage,
  decryptMessage,
};

export type PublicKey = `-----BEGIN PUBLIC KEY-----\n${string}\n-----END PUBLIC KEY-----\n`;
export type PrivateKey = `-----BEGIN PRIVATE KEY-----\n${string}\n-----END PRIVATE KEY-----\n`;

export interface KeyPair {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

function generateKeyPair(): KeyPair {
  const keyPair = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return keyPair as KeyPair;
}

function generateRandomGroupSecret(): Buffer {
  return crypto.randomBytes(32);
}

function calculateSharedSecret(ownPrivateKey: PrivateKey, peerPublicKey: PublicKey): Buffer {
  const publicKey = crypto.createPublicKey({
    key: peerPublicKey,
    type: 'spki',
    format: 'pem',
  });
  const privateKey = crypto.createPrivateKey({
    key: ownPrivateKey,
    type: 'pkcs8',
    format: 'pem',
  });
  return crypto.diffieHellman({ privateKey, publicKey });
}

function deriveEncryptionKey(sharedSecret: Buffer): Buffer {
  return crypto.createHmac('sha256', sharedSecret).digest();
}

function encryptMessage(message: Buffer, encryptionKey: Buffer): Buffer {
  const initializationVector = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, initializationVector);
  const cipherText = cipher.update(message);
  const final = cipher.final();
  const tag = cipher.getAuthTag();
  return Buffer.concat([initializationVector, tag, cipherText, final]);
}

function decryptMessage(encryptedMessage: Buffer, encryptionKey: Buffer): Buffer {
  const initializationVector = encryptedMessage.slice(0, 12);
  const tag = encryptedMessage.slice(12, 16);
  const cipherText = encryptedMessage.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, initializationVector);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]);
}
