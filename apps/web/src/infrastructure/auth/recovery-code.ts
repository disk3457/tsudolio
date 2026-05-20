import { createHash, randomInt } from "node:crypto";

const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const codeLength = 16;
const groupLength = 4;

export function createRecoveryCode() {
  let value = "";

  for (let index = 0; index < codeLength; index += 1) {
    value += codeAlphabet[randomInt(codeAlphabet.length)];
  }

  return value.match(new RegExp(`.{1,${groupLength}}`, "g"))?.join("-") ?? value;
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256")
    .update(normalizeRecoveryCode(code))
    .digest("base64url");
}

export function normalizeRecoveryCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function getRecoveryCodeSuffix(code: string) {
  return normalizeRecoveryCode(code).slice(-groupLength);
}
