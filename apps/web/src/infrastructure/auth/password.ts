import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

const hashVersion = "scrypt-v1";
const keyLength = 64;
const scryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} satisfies ScryptOptions;

const scryptAsync = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scryptAsync(
    password,
    salt,
    keyLength,
    scryptOptions,
  );

  return [
    hashVersion,
    String(keyLength),
    salt,
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [version, keyLengthValue, salt, expectedHash] = storedHash.split("$");
  const parsedKeyLength = Number(keyLengthValue);

  if (
    version !== hashVersion ||
    !Number.isInteger(parsedKeyLength) ||
    parsedKeyLength <= 0 ||
    !salt ||
    !expectedHash
  ) {
    return false;
  }

  const actualKey = await scryptAsync(
    password,
    salt,
    parsedKeyLength,
    scryptOptions,
  );
  const expectedKey = Buffer.from(expectedHash, "base64url");

  return (
    actualKey.byteLength === expectedKey.byteLength &&
    timingSafeEqual(actualKey, expectedKey)
  );
}
