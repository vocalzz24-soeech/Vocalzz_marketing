// Password hashing (PBKDF2-SHA256) and cookie sessions.
import type { D1Database } from "./env.ts";

const ITERATIONS = 100_000; // Cloudflare Workers' PBKDF2 maximum
const SESSION_DAYS = 14;
export const SESSION_COOKIE = "vz_session";

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    256,
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const { hash: candidate } = await hashPassword(password, salt);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export interface User {
  id: number;
  name: string;
  login: string;
  role: "admin" | "therapist";
  therapist_id: number | null;
}

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, userId, expires).run();
  return token;
}

export async function userForSession(db: D1Database, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  return db
    .prepare(
      `SELECT u.id, u.name, u.login, u.role, u.therapist_id
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`,
    )
    .bind(token, new Date().toISOString())
    .first<User>();
}

export async function deleteSession(db: D1Database, token: string) {
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

export const SESSION_MAX_AGE = SESSION_DAYS * 86_400;
