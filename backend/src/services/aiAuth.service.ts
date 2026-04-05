import axios from 'axios';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000';

function resolveAuthUsername(): string {
  return (
    process.env.AI_ENGINE_AUTH_USERNAME
    || process.env.AUTH_USERNAME
    || 'elixi_admin'
  ).trim();
}

function resolveAuthPassword(): string {
  return (
    process.env.AI_ENGINE_AUTH_PASSWORD
    || process.env.AUTH_PASSWORD
    || 'change_me_to_a_strong_password'
  ).trim();
}

let cachedToken: string | null = null;
let expiresAtEpochMs = 0;

export async function getAiEngineAuthHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedToken && now < expiresAtEpochMs - 30_000) {
    return { Authorization: `Bearer ${cachedToken}` };
  }

  const authUsername = resolveAuthUsername();
  const authPassword = resolveAuthPassword();

  const body = new URLSearchParams();
  body.set('username', authUsername);
  body.set('password', authPassword);
  body.set('grant_type', 'password');

  const response = await axios.post<{ access_token: string; expires_in?: number }>(
    `${AI_ENGINE_URL}/auth/token`,
    body.toString(),
    {
      timeout: 8000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  cachedToken = response.data.access_token;
  const ttlSeconds = Number(response.data.expires_in || 3600);
  expiresAtEpochMs = now + ttlSeconds * 1000;

  return { Authorization: `Bearer ${cachedToken}` };
}
