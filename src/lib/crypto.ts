import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const KEY_HEX = process.env.ENCRYPTION_KEY;
if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error(
    `ENCRYPTION_KEY must be exactly 64 hex characters. Got: ${KEY_HEX?.length ?? 0} chars`
  );
}
const KEY = Buffer.from(KEY_HEX, "hex");

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16-byte authentication tag
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

/**
 * Decrypts AES-256-GCM ciphertext produced by encrypt().
 * Verifies the authentication tag — throws if tampered.
 */
export function decrypt(stored: string): string {
  const iv = Buffer.from(stored.slice(0, 24), "hex");
  const tag = Buffer.from(stored.slice(24, 56), "hex");
  const ciphertext = Buffer.from(stored.slice(56), "hex");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
