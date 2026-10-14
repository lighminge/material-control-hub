import { getDocument, setDocumentWithId } from '@/lib/firebase/api';
import { loginAnonymously } from '@/lib/firebase/config';

export const USERS_COLLECTION = 'systemUsers';
export const ADMIN_USERNAME = 'admin';
const SESSION_KEY = 'mch_session_user';

export type SystemUser = {
  id?: string;
  username: string;
  password: string; // stored as hash
  name?: string;
  unit?: string;
  notes?: string;
};

export type SessionUser = { username: string; name?: string };

export async function hashPassword(pw: string): Promise<string> {
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mch:${pw}`));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      return `sha256:${hex}`;
    }
  } catch {
    // fall through
  }
  return `plain:${pw}`;
}

/** Make sure the default admin account exists (admin / admin). */
export async function ensureAdmin() {
  const existing = await getDocument(USERS_COLLECTION, ADMIN_USERNAME);
  if (!existing) {
    await setDocumentWithId(USERS_COLLECTION, ADMIN_USERNAME, {
      username: ADMIN_USERNAME,
      password: await hashPassword('admin'),
      name: '系統管理員',
      unit: '',
      notes: '預設管理員帳號'
    });
  }
}

export async function login(username: string, password: string): Promise<SessionUser> {
  await loginAnonymously();
  await ensureAdmin();
  const user = (await getDocument(USERS_COLLECTION, username.trim())) as SystemUser | null;
  if (!user || user.password !== (await hashPassword(password))) {
    throw new Error('帳號或密碼錯誤');
  }
  const session = { username: user.username, name: user.name };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}
