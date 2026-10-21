import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { format } from 'date-fns';
import { auth, firebaseConfig } from '@/lib/firebase/config';
import {
  getDocument,
  getDocumentsByField,
  setDocumentWithId,
  addDocument,
  updateDocument,
} from '@/lib/firebase/api';

export const USERS_COLLECTION = 'users';
export const LOGIN_LOGS_COLLECTION = 'loginLogs';
export const ADMIN_USERNAME = 'admin';

/** Usernames are mapped to a (fake) e-mail address because Firebase Auth's password provider needs one. */
export const EMAIL_DOMAIN = 'mch.example.com';
export const USERNAME_PATTERN = /^[a-z0-9._-]{1,30}$/;
export const usernameToEmail = (username: string) => `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
export const normalizeUsername = (username: string) => username.trim().toLowerCase();

export type UserProfile = {
  id?: string;
  username: string;
  email: string;
  name?: string;
  unit?: string;
  notes?: string;
  role: 'admin' | 'user';
  active: boolean;
};

export type SessionUser = {
  uid: string;
  username: string;
  name?: string;
  role: 'admin' | 'user';
  logId?: string;
};

export type LoginLog = {
  id?: string;
  username: string;
  ip?: string;
  location?: string;
  loginTime: string; // yyyy-MM-dd HH:mm:ss
  logoutTime?: string;
  remark?: string;
  failed?: boolean;
};

const LOG_ID_KEY = 'mch_login_log_id';
let currentSession: SessionUser | null = null;

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
      return { ip: String(d.ip), location: loc || '未知' };
    }
  } catch {
    // try fallback below
  }
  try {
    const d = await fetchJson('https://api.ipify.org?format=json');
    if (d?.ip) return { ip: String(d.ip), location: '未知' };
  } catch {
    // ignore
  }
  return { ip: '未知', location: '未知' };
}

const toSession = (uid: string, p: UserProfile, logId?: string): SessionUser => ({
  uid,
  username: p.username,
  name: p.name,
  role: p.role === 'admin' ? 'admin' : 'user',
  logId,
});

export async function login(username: string, password: string): Promise<SessionUser> {
  const name = normalizeUsername(username);
  const { ip, location } = await getIpInfo();

  let uid: string;
  try {
    const cred = await signInWithEmailAndPassword(auth, usernameToEmail(name), password);
    uid = cred.user.uid;
  } catch (e: any) {
    const code: string = e?.code || '';
    const credentialErrors = [
      'auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found',
      'auth/invalid-email', 'auth/too-many-requests', 'auth/user-disabled',
    ];
    if (!credentialErrors.includes(code)) {
      throw new Error('登入失敗，請檢查網路連線後再試');
    }
    const blocked = code === 'auth/too-many-requests';
    try {
      // Unauthenticated, rule-restricted write: only "failed" entries are allowed.
      await addDocument(LOGIN_LOGS_COLLECTION, {
        username: name.slice(0, 50),
        ip,
        location,
        loginTime: nowStr(),
        logoutTime: '',
        remark: blocked ? '登入失敗：嘗試次數過多，已被暫時封鎖' : '登入失敗：帳號或密碼錯誤',
        failed: true,
      });
    } catch {
      // logging must not block the login error
    }
    throw new Error(blocked ? '嘗試次數過多，請稍後再試' : '帳號或密碼錯誤');
  }

  // Authorisation: the account needs an active profile document.
  const profile = (await getDocument(USERS_COLLECTION, uid).catch(() => null)) as UserProfile | null;
  if (!profile || !profile.active) {
    await signOut(auth);
    throw new Error('此帳號已停用或尚未授權，請聯絡管理員');
  }

  // Count wrong attempts since the previous successful login.
  let fails = 0;
  try {
    const logs = (await getDocumentsByField(LOGIN_LOGS_COLLECTION, 'username', profile.username)) as LoginLog[];
    const lastOk = logs.filter(l => !l.failed).reduce((m, l) => (l.loginTime > m ? l.loginTime : m), '');
    fails = logs.filter(l => l.failed && l.loginTime > lastOk).length;
  } catch {
    // ignore
  }

  let logId: string | undefined;
  try {
    logId = await addDocument(LOGIN_LOGS_COLLECTION, {
      username: profile.username,
      ip,
      location,
      loginTime: nowStr(),
      logoutTime: '',
      remark: fails > 0 ? `登入前密碼錯誤 ${fails} 次` : '',
      failed: false,
    });
    sessionStorage.setItem(LOG_ID_KEY, logId);
  } catch {
    // ignore logging failure
  }

  currentSession = toSession(uid, profile, logId);
  return currentSession;
}

/** Restore the signed-in user (if any) when the app starts. */
export function restoreSession(): Promise<SessionUser | null> {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) return resolve(null);
      try {
        const profile = (await getDocument(USERS_COLLECTION, user.uid)) as UserProfile | null;
        if (!profile || !profile.active) {
          await signOut(auth);
          return resolve(null);
        }
        currentSession = toSession(user.uid, profile, sessionStorage.getItem(LOG_ID_KEY) || undefined);
        resolve(currentSession);
      } catch {
        resolve(null);
      }
    });
  });
}

export function getSession(): SessionUser | null {
  return currentSession;
}

export async function logout() {
  const logId = currentSession?.logId || sessionStorage.getItem(LOG_ID_KEY);
  if (logId) {
    try {
      await updateDocument(LOGIN_LOGS_COLLECTION, logId, { logoutTime: nowStr() });
    } catch {
      // ignore
    }
  }
  sessionStorage.removeItem(LOG_ID_KEY);
  currentSession = null;
  await signOut(auth);
}

export type NewUserInput = {
  username: string;
  password: string;
  name?: string;
  unit?: string;
  notes?: string;
};

/**
 * Admin only: create a Firebase Auth account + its profile document.
 * A temporary secondary Firebase app is used so the admin stays signed in.
 */
export async function createSystemUser(input: NewUserInput) {
  const username = normalizeUsername(input.username);
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('帳號只能使用英文字母、數字、. _ -，長度 1~30 字元');
  }
  if (!input.password || input.password.length < 6) {
    throw new Error('密碼至少需要 6 個字元');
  }
  const email = usernameToEmail(username);
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, input.password);
      uid = cred.user.uid;
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        throw new Error('此帳號已存在（若曾刪除過，請先到 Firebase Console 的 Authentication 刪除該帳號）');
      }
      if (e?.code === 'auth/weak-password') throw new Error('密碼強度不足，至少需要 6 個字元');
      throw new Error('建立帳號失敗，請稍後再試');
    }
    try {
      await setDocumentWithId(USERS_COLLECTION, uid, {
        username,
        email,
        name: input.name || '',
        unit: input.unit || '',
        notes: input.notes || '',
        role: 'user',
        active: true,
      });
    } catch {
      throw new Error('帳號已建立，但寫入使用者資料失敗，請確認 Firestore 規則後再試或到 Console 處理');
    }
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondary);
  }
}
