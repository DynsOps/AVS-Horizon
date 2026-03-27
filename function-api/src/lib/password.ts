import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

const toHex = (value: Buffer): string => value.toString('hex');
const fromHex = (value: string): Buffer => Buffer.from(value, 'hex');

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${toHex(salt)}$${toHex(derived)}`;
};

export const verifyPassword = (password: string, storedHash: string): boolean => {
  const [algo, nValue, rValue, pValue, saltHex, hashHex] = storedHash.split('$');
  if (algo !== 'scrypt' || !nValue || !rValue || !pValue || !saltHex || !hashHex) {
    return false;
  }

  const salt = fromHex(saltHex);
  const expected = fromHex(hashHex);
  const derived = scryptSync(password, salt, expected.length, {
    N: Number(nValue),
    r: Number(rValue),
    p: Number(pValue),
  });

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
};

export const safeStringEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};
