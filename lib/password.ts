import crypto from "crypto";

/**
 * Hashes a plain-text password using irreversible cryptographic scrypt + random 16-byte salt.
 * Output format: "scrypt$<saltHex>$<hashHex>"
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Verifies a plain-text password against a stored irreversible scrypt hash.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    const [, salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, "hex");
    const derivedBuffer = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  }

  // Fallback check if an older record was stored before hashing was enabled
  return storedHash === password;
}

export function isPasswordHashed(storedHash: string): boolean {
  return Boolean(storedHash && storedHash.startsWith("scrypt$"));
}

