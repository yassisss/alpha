import crypto from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.MYSQL_URL ||
  "alphateam-secure-hmac-key-2026";

export const SESSION_COOKIE_NAME = "alphateam_session";

export interface SessionPayload {
  id: number;
  phone: string;
  role: string;
  exp: number;
}

/**
 * Creates an HMAC-SHA256 signed token (Node.js runtime - API routes)
 */
export function createSessionToken(user: {
  id: number;
  phone: string;
  role: string;
}): string {
  const payload: SessionPayload = {
    id: user.id,
    phone: user.phone,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

