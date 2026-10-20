import { getDocument, setDocumentWithId, addDocument, updateDocument } from '@/lib/firebase/api';
import { format } from 'date-fns';
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

export type SessionUser = { username: string; name?: string; logId?: string };

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

export const LOGIN_LOGS_COLLECTION = 'loginLogs';
const FAILS_COLLECTION = 'loginFails';

export type LoginLog = {
  id?: string;
  username: string;
  ip?: string;
  location?: string;
  loginTime: string; // yyyy-MM-dd HH:mm:ss
  logoutTime?: string;
  remark?: string;
};

const nowStr = () => format(new Date(), 'yyyy-MM-dd HH:mm:ss');

async function fetchJson(url: string, ms = 3000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Best-effort public IP + rough location lookup (never throws). */
async function getIpInfo(): Promise<{ ip: string; location: string }> {
  try {
    const d = await fetchJson('https://ipapi.co/json/');
    if (d?.ip) {
      const loc = [d.country_name, d.region, d.city].filter(Boolean).join(' ');
      return { ip: d.ip, location: loc || '未知' };
    }
  } catch {
    // try fallback below
  }
  try {
    const d = await fetchJson('https://api.ipify.org?format=json');
    if (d?.ip) return { ip: d.ip, location: '未知' };
  } catch {
    // ignore
  }
  return { ip: '未知', location: '未知' };
}

const failKey = (u: string) => encodeURIComponent(u.trim() || '_empty_');

async function getFailCount(username: string): Promise<number> {
  try {
    const d: any = await getDocument(FAILS_COLLECTION, failKey(username));
    return d?.count || 0;
  } catch {
    return 0;
  }
}

async function setFailCount(username: string, count: number) {
  try {
    await setDocumentWithId(FAILS_COLLECTION, failKey(username), { username, count });
  } catch {
    // ignore
  }
}

export async function login(username: string, password: string): Promise<SessionUser> {
  await loginAnonymously();
  await ensureAdmin();
  const name = username.trim();
  const user = (await getDocument(USERS_COLLECTION, name)) as SystemUser | null;
  const ok = !!user && user.password === (await hashPassword(password));
  const { ip, location } = await getIpInfo();

  if (!ok) {
    const count = (await getFailCount(name)) + 1;
    await setFailCount(name, count);
    try {
      await addDocument(LOGIN_LOGS_COLLECTION, {
        username: name,
        ip,
        location,
        loginTime: nowStr(),
        logoutTime: '',
        remark: user ? `登入失敗：密碼錯誤（累計第 ${count} 次）` : `登入失敗：帳號不存在（累計第 ${count} 次）`
      });
    } catch {
      // logging must not block the login error
    }
    throw new Error('帳號或密碼錯誤');
  }

  const fails = await getFailCount(name);
  let logId: string | undefined;
  try {
    logId = await addDocument(LOGIN_LOGS_COLLECTION, {
      username: name,
      ip,
      location,
      loginTime: nowStr(),
      logoutTime: '',
      remark: fails > 0 ? `登入前密碼錯誤 ${fails} 次` : ''
    });
    if (fails > 0) await setFailCount(name, 0);
  } catch {
    // ignore logging failure
  }
  const session: SessionUser = { username: user!.username, name: user!.name, logId };
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

export async function logout() {
  const s = getSession();
  sessionStorage.removeItem(SESSION_KEY);
  if (s?.logId) {
    try {
      await updateDocument(LOGIN_LOGS_COLLECTION, s.logId, { logoutTime: nowStr() });
    } catch {
      // ignore
    }
  }
}
