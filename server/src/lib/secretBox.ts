import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";

/*
  AES-256-GCM encryption for secrets stored in MongoDB (provider API keys).

  Stored format:  enc:v1:<iv>:<auth tag>:<ciphertext>   (each part base64)

  The key comes from APP_ENCRYPTION_KEY. When that is not set, a random key is
  generated once and kept in a file (ENCRYPTION_KEY_FILE) that lives outside the
  database, so a database dump or backup alone does not reveal the secrets.
*/

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";

let cachedKey: Buffer | undefined;

function loadKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const fromEnv = config.encryption.key;

  if (fromEnv) {
    // Any passphrase works: it is stretched to exactly 32 bytes.
    cachedKey = createHash("sha256").update(fromEnv).digest();
    return cachedKey;
  }

  const file = config.encryption.keyFile;

  if (existsSync(file)) {
    cachedKey = Buffer.from(readFileSync(file, "utf8").trim(), "base64");
  } else {
    cachedKey = randomBytes(32);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, cachedKey.toString("base64"), { mode: 0o600 });
    chmodSync(file, 0o600);
    console.warn(
      `[secrets] APP_ENCRYPTION_KEY is not set. Generated a key file at ${file}. ` +
        "Keep it safe and set APP_ENCRYPTION_KEY in production.",
    );
  }

  if (cachedKey.length !== 32) {
    throw new Error(`Encryption key file ${file} is invalid (expected 32 bytes).`);
  }

  return cachedKey;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    return "";
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [
    PREFIX.slice(0, -1),
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decrypts a stored value. Throws if the key is wrong or the data was tampered with. */
export function decryptSecret(stored: string): string {
  if (!stored) {
    return "";
  }

  if (!isEncrypted(stored)) {
    // Legacy plaintext value written before encryption was added.
    return stored;
  }

  const [, , ivB64, tagB64, dataB64] = stored.split(":");

  if (!ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Malformed encrypted value.");
  }

  const decipher = createDecipheriv(ALGORITHM, loadKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
