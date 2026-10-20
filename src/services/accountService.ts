import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase';

export interface DeviceSession {
  deviceId: string;
  deviceName: string;
  loginAt: number;
  lastActiveAt: number;
}

export interface UserAccount {
  uid: string;
  username: string;
  password: string;
  displayName: string;
  avatar: string;
  role: 'admin' | 'user';
  status: 'active' | 'locked';
  maxDevices: number;
  activeDeviceIds: string[];
  activeDevicesMeta: string;
  expiresAt: number;
  createdAtMs?: number;
  updatedAtMs?: number;
}

const ACCOUNTS_STORAGE_KEY = 'classroom_accounts_db_v1';
const CURRENT_USER_STORAGE_KEY = 'classroom_current_username_v1';
const DEVICE_ID_STORAGE_KEY = 'classroom_device_id_v1';
const ADMIN_EMAIL = 'khoahoang9999@gmail.com';

// Generate SVG Avatar Data URI
export function createAvatarSvgDataUri(
  seedText: string,
  bgColor: string,
  emojiOrInitials: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="g_${seedText.replace(/[^a-zA-Z0-9]/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgColor}" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="60" fill="url(#g_${seedText.replace(/[^a-zA-Z0-9]/g, '')})" />
    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="3" />
    <text x="60" y="64" font-family="system-ui, sans-serif" font-size="46" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${emojiOrInitials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_AVATARS: { id: string; label: string; url: string }[] = [
  { id: 'av1', label: 'Vương Miện Admin', url: createAvatarSvgDataUri('av1', '#4f46e5', '👑') },
  { id: 'av2', label: 'Giáo Viên Nam', url: createAvatarSvgDataUri('av2', '#0284c7', '👨‍🏫') },
  { id: 'av3', label: 'Giáo Viên Nữ', url: createAvatarSvgDataUri('av3', '#db2777', '👩‍🏫') },
  { id: 'av4', label: 'Phi Hành Gia', url: createAvatarSvgDataUri('av4', '#7c3aed', '🧑‍🚀') },
  { id: 'av5', label: 'Ngôi Sao', url: createAvatarSvgDataUri('av5', '#d97706', '🌟') },
  { id: 'av6', label: 'Cáo Thông Thái', url: createAvatarSvgDataUri('av6', '#ea580c', '🦊') },
  { id: 'av7', label: 'Gấu Trúc', url: createAvatarSvgDataUri('av7', '#059669', '🐼') },
  { id: 'av8', label: 'Sư Tử', url: createAvatarSvgDataUri('av8', '#dc2626', '🦁') },
  { id: 'av9', label: 'Cú Mèo', url: createAvatarSvgDataUri('av9', '#4338ca', '🦉') },
  { id: 'av10', label: 'Kỳ Lân', url: createAvatarSvgDataUri('av10', '#9333ea', '🦄') },
  { id: 'av11', label: 'Cá Heo', url: createAvatarSvgDataUri('av11', '#0891b2', '🐬') },
  { id: 'av12', label: 'Tên Lửa', url: createAvatarSvgDataUri('av12', '#2563eb', '🚀') },
];

// Compress uploaded image to small Data URI (< 40KB) so it safely fits in Firestore & localStorage
export function compressAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 180;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không thể xử lý ảnh'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl.slice(0, 145000));
      };
      img.onerror = () => reject(new Error('File ảnh không hợp lệ'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsDataURL(file);
  });
}

// Get or create persistent unique Device ID for this browser/machine
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id || !/^[a-zA-Z0-9_\-]+$/.test(id)) {
      id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id.slice(0, 64);
  } catch {
    return 'dev_default_browser';
  }
}

// Friendly Device & Browser Name
export function getDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Thiết bị Web';
  const ua = navigator.userAgent;
  let os = 'Máy tính';
  if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'MacBook / macOS';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux PC';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  return `${os} (${browser})`;
}

export function parseActiveDevices(account: UserAccount): DeviceSession[] {
  try {
    const parsed = JSON.parse(account.activeDevicesMeta || '[]');
    if (Array.isArray(parsed)) {
      return parsed.filter((d) => account.activeDeviceIds.includes(d.deviceId));
    }
  } catch {}
  return account.activeDeviceIds.map((id, idx) => ({
    deviceId: id,
    deviceName: `Thiết bị #${idx + 1}`,
    loginAt: Date.now(),
    lastActiveAt: Date.now(),
  }));
}

export function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '').slice(0, 50);
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || 'user_default';
}

function getDefaultAccounts(): Record<string, UserAccount> {
  const now = Date.now();
  const tenYearsMs = 10 * 365 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return {
    admin: {
      uid: 'admin_root',
      username: 'admin',
      password: '123456',
      displayName: 'Quản Trị Viên (Admin)',
      avatar: PRESET_AVATARS[0].url,
      role: 'admin',
      status: 'active',
      maxDevices: 2,
      activeDeviceIds: [],
      activeDevicesMeta: '[]',
      expiresAt: now + tenYearsMs,
      createdAtMs: now,
      updatedAtMs: now,
    },
    giaovien1: {
      uid: 'teacher_demo_1',
      username: 'giaovien1',
      password: '123456',
      displayName: 'Cô Nguyễn Thị Lan',
      avatar: PRESET_AVATARS[2].url,
      role: 'user',
      status: 'active',
      maxDevices: 2,
      activeDeviceIds: [],
      activeDevicesMeta: '[]',
      expiresAt: now + thirtyDaysMs,
      createdAtMs: now,
      updatedAtMs: now,
    },
    quanlich: {
      uid: 'teacher_quanlich',
      username: 'quanlich',
      password: '123456',
      displayName: 'Quan Thị Lịch',
      avatar: PRESET_AVATARS[4].url,
      role: 'user',
      status: 'active',
      maxDevices: 2,
      activeDeviceIds: [],
      activeDevicesMeta: '[]',
      expiresAt: now + tenYearsMs,
      createdAtMs: now,
      updatedAtMs: now,
    },
  };
}

function docDataToUserAccount(username: string, data: Record<string, any>): UserAccount {
  return {
    uid: String(data.uid || `uid_${username}`),
    username: String(data.username || username),
    password: String(data.password || '123456'),
    displayName: String(data.displayName || username),
    avatar: String(data.avatar || PRESET_AVATARS[1].url),
    role: data.role === 'admin' ? 'admin' : 'user',
    status: data.status === 'locked' ? 'locked' : 'active',
    maxDevices: Number(data.maxDevices) || 2,
    activeDeviceIds: Array.isArray(data.activeDeviceIds) ? data.activeDeviceIds : [],
    activeDevicesMeta: String(data.activeDevicesMeta || '[]'),
    expiresAt: Number(data.expiresAt) || Date.now() + 30 * 86400000,
    createdAtMs: data.createdAt?.toMillis?.() || Date.now(),
    updatedAtMs: data.updatedAt?.toMillis?.() || Date.now(),
  };
}

class AccountService {
  private accounts: Record<string, UserAccount> = {};
  private currentUsername: string | null = null;
  private listeners: Set<() => void> = new Set();
  private firestoreUnsub: Unsubscribe | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private hasSyncedLocalToCloud: boolean = false;

  constructor() {
    this.loadFromStorage();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('classroom_accounts_sync_channel');
        this.broadcastChannel.onmessage = () => {
          this.loadFromStorage();
          this.notify();
        };
      } catch {}
    }

    // Start real-time Firestore subscription immediately on all devices & domains
    if (typeof window !== 'undefined') {
      this.startRealtimeFirestoreSync();
      this.refreshFromCloud();

      window.addEventListener('focus', () => {
        this.refreshFromCloud();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.refreshFromCloud();
        }
      });

      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          await this.handleFirebaseUserConnected(fbUser);
        }
        this.notify();
      });
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.accounts = { ...getDefaultAccounts(), ...parsed };
        } else {
          this.accounts = getDefaultAccounts();
        }
      } else {
        this.accounts = getDefaultAccounts();
        this.saveToStorage(false);
      }

      const savedUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (savedUser && this.accounts[savedUser]) {
        this.currentUsername = savedUser;
      } else {
        this.currentUsername = null;
      }
    } catch {
      this.accounts = getDefaultAccounts();
    }
  }

  private saveToStorage(broadcast: boolean = true): void {
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(this.accounts));
      if (this.currentUsername) {
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, this.currentUsername);
      } else {
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      }
      if (broadcast && this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'SYNC', t: Date.now() });
      }
    } catch {}
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public getAllAccounts(): UserAccount[] {
    return Object.values(this.accounts).sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return a.username.localeCompare(b.username);
    });
  }

  public getCurrentAccount(): UserAccount | null {
    if (!this.currentUsername) return null;
    return this.accounts[this.currentUsername] || null;
  }

  public isCurrentAccountExpired(): boolean {
    const acc = this.getCurrentAccount();
    if (!acc) return false;
    if (acc.role === 'admin') return false;
    return Date.now() > acc.expiresAt;
  }

  public isCurrentAccountLocked(): boolean {
    const acc = this.getCurrentAccount();
    if (!acc) return false;
    if (acc.role === 'admin') return false;
    return acc.status === 'locked';
  }

  /**
   * Actively fetch all accounts from Firestore to guarantee immediate sync across iframes/tabs
   */
  public async refreshFromCloud(): Promise<void> {
    try {
      const { getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'accounts'));
      if (snap.empty) return;

      const cloudMap: Record<string, UserAccount> = {};
      snap.docs.forEach((docSnap) => {
        const username = docSnap.id;
        cloudMap[username] = docDataToUserAccount(username, docSnap.data());
      });

      // Upload any local-only accounts once on initial boot
      if (!this.hasSyncedLocalToCloud) {
        this.hasSyncedLocalToCloud = true;
        for (const localAcc of Object.values(this.accounts)) {
          if (!cloudMap[localAcc.username]) {
            await this.syncAccountToFirestore(localAcc, true);
            cloudMap[localAcc.username] = localAcc;
          }
        }
      }

      this.accounts = { ...getDefaultAccounts(), ...cloudMap };
      this.saveToStorage(false);
      this.notify();
    } catch (err) {
      console.warn('Cloud refresh warning:', err);
    }
  }

  /**
   * Real-time Firestore listener across ALL devices, browsers, and domains (AI Studio & Cloudflare).
   * Runs immediately on app boot without requiring Google OAuth login.
   */
  private startRealtimeFirestoreSync(): void {
    if (this.firestoreUnsub) {
      this.firestoreUnsub();
      this.firestoreUnsub = null;
    }

    const accountsCol = collection(db, 'accounts');
    this.firestoreUnsub = onSnapshot(
      accountsCol,
      (snapshot) => {
        const cloudUsernames = new Set<string>();

        snapshot.docs.forEach((docSnap) => {
          const username = docSnap.id;
          cloudUsernames.add(username);
          this.accounts[username] = docDataToUserAccount(username, docSnap.data());
        });

        snapshot.docChanges().forEach((change) => {
          const username = change.doc.id;
          if (change.type === 'removed' && username !== 'admin') {
            delete this.accounts[username];
            if (this.currentUsername === username) {
              this.currentUsername = null;
            }
          }
        });

        // Push any local-only accounts up to Firestore once
        if (!this.hasSyncedLocalToCloud) {
          this.hasSyncedLocalToCloud = true;
          Object.values(this.accounts).forEach((localAcc) => {
            if (!cloudUsernames.has(localAcc.username)) {
              this.syncAccountToFirestore(localAcc, true).catch(() => {});
            }
          });
        }

        // Validate current device session if logged in
        if (this.currentUsername && this.accounts[this.currentUsername]) {
          const curAcc = this.accounts[this.currentUsername];
          if (curAcc.status === 'locked' && curAcc.role !== 'admin') {
            this.currentUsername = null;
          }
        }

        this.saveToStorage(false);
        this.notify();
      },
      (err) => {
        console.warn('Firestore real-time sync warning:', err);
      }
    );
  }

  private async handleFirebaseUserConnected(fbUser: FirebaseUser): Promise<void> {
    const isBootstrappedAdmin =
      fbUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && fbUser.emailVerified;
    if (isBootstrappedAdmin && this.accounts['admin']) {
      this.accounts['admin'].uid = sanitizeId(fbUser.uid);
    }
  }

  /**
   * Persist account directly to Firestore so all machines & browsers receive it immediately
   */
  private async syncAccountToFirestore(
    account: UserAccount,
    isCreate: boolean = false
  ): Promise<void> {
    const cleanUsername = sanitizeUsername(account.username);
    if (!cleanUsername || cleanUsername.length < 3) return;

    const docRef = doc(db, 'accounts', cleanUsername);

    try {
      const snap = await getDoc(docRef);
      const payload = {
        uid: sanitizeId(account.uid || `uid_${cleanUsername}`),
        username: cleanUsername,
        password: (account.password || '123456').slice(0, 100),
        displayName: (account.displayName || cleanUsername).trim().slice(0, 100) || cleanUsername,
        avatar: (account.avatar || PRESET_AVATARS[1].url).slice(0, 150000),
        role: account.role === 'admin' ? 'admin' : 'user',
        status: account.status === 'locked' ? 'locked' : 'active',
        maxDevices: Math.max(1, Math.min(10, Math.floor(account.maxDevices || 2))),
        activeDeviceIds: (account.activeDeviceIds || [])
          .slice(0, 10)
          .map((id) => sanitizeId(id)),
        activeDevicesMeta: (account.activeDevicesMeta || '[]').slice(0, 5000),
        expiresAt: Math.max(1000, Math.floor(account.expiresAt || Date.now() + 30 * 86400000)),
      };

      if (!snap.exists() || isCreate) {
        await setDoc(docRef, {
          ...payload,
          createdAt: snap.exists() ? snap.data().createdAt || serverTimestamp() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(docRef, {
          ...payload,
          createdAt: snap.data().createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.warn('Firestore sync error:', error);
    }
  }

  // Fetch single account fresh from Firestore before login / registration checks
  private async fetchAccountFromFirestore(username: string): Promise<UserAccount | null> {
    try {
      const clean = sanitizeUsername(username);
      if (!clean || clean.length < 3) return null;
      const snap = await getDoc(doc(db, 'accounts', clean));
      if (snap.exists()) {
        const acc = docDataToUserAccount(clean, snap.data());
        this.accounts[clean] = acc;
        this.saveToStorage(false);
        return acc;
      }
    } catch {}
    return null;
  }

  // Sign in with Google popup and link/create account
  public async loginWithGoogle(): Promise<{
    success: boolean;
    message: string;
    account?: UserAccount;
  }> {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const fbUser = cred.user;
      const isBootstrappedAdmin =
        fbUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && fbUser.emailVerified;

      const rawName = (fbUser.email?.split('@')[0] || 'user_' + fbUser.uid.slice(0, 6))
        .toLowerCase()
        .replace(/[^a-z0-9_\-]/g, '');
      const username = isBootstrappedAdmin
        ? 'admin'
        : rawName.length >= 3
        ? rawName.slice(0, 40)
        : `user_${rawName}`;

      await this.fetchAccountFromFirestore(username);
      let account = this.accounts[username];
      const now = Date.now();

      if (!account) {
        account = {
          uid: sanitizeId(fbUser.uid),
          username,
          password: '123456',
          displayName: (fbUser.displayName || username).slice(0, 100),
          avatar: fbUser.photoURL || PRESET_AVATARS[isBootstrappedAdmin ? 0 : 1].url,
          role: isBootstrappedAdmin ? 'admin' : 'user',
          status: 'active',
          maxDevices: 2,
          activeDeviceIds: [],
          activeDevicesMeta: '[]',
          expiresAt:
            now + (isBootstrappedAdmin ? 10 * 365 * 86400000 : 30 * 86400000),
          createdAtMs: now,
          updatedAtMs: now,
        };
        this.accounts[username] = account;
      } else {
        account.uid = sanitizeId(fbUser.uid);
        if (isBootstrappedAdmin) {
          account.role = 'admin';
          account.status = 'active';
        }
      }

      const devResult = this.attachCurrentDevice(account, true);
      if (!devResult.allowed) {
        return {
          success: false,
          message: devResult.message,
        };
      }

      this.currentUsername = account.username;
      this.saveToStorage();
      await this.syncAccountToFirestore(account, false);
      this.notify();

      return {
        success: true,
        message: 'Đăng nhập Google thành công!',
        account,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? `Không thể đăng nhập Google: ${error.message}`
            : 'Đăng nhập Google bị hủy.',
      };
    }
  }

  private attachCurrentDevice(
    account: UserAccount,
    forceReplaceOldestIfFull: boolean = false
  ): { allowed: boolean; message: string; activeDevices: DeviceSession[] } {
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();
    const now = Date.now();
    let sessions = parseActiveDevices(account);

    const existingIdx = sessions.findIndex((s) => s.deviceId === deviceId);
    if (existingIdx >= 0) {
      sessions[existingIdx].lastActiveAt = now;
      sessions[existingIdx].deviceName = deviceName;
    } else {
      if (sessions.length >= account.maxDevices) {
        if (!forceReplaceOldestIfFull) {
          return {
            allowed: false,
            message: `Tài khoản "${account.username}" đã đăng nhập đủ tối đa ${account.maxDevices} thiết bị! Vui lòng đăng xuất ở thiết bị cũ hoặc gỡ bớt thiết bị bên dưới.`,
            activeDevices: sessions,
          };
        }
        sessions.sort((a, b) => a.lastActiveAt - b.lastActiveAt);
        sessions = sessions.slice(sessions.length - account.maxDevices + 1);
      }
      sessions.push({
        deviceId,
        deviceName,
        loginAt: now,
        lastActiveAt: now,
      });
    }

    account.activeDeviceIds = sessions.map((s) => s.deviceId).slice(0, 10);
    account.activeDevicesMeta = JSON.stringify(sessions).slice(0, 5000);
    account.updatedAtMs = now;

    return {
      allowed: true,
      message: 'OK',
      activeDevices: sessions,
    };
  }

  // Login with Username & Password (always checks live Firestore first for instant cross-device sync)
  public async login(
    rawUsername: string,
    password: string,
    forceKickOldestDevice: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    code?: 'MAX_DEVICES_REACHED' | 'EXPIRED' | 'LOCKED' | 'INVALID';
    activeDevices?: DeviceSession[];
    account?: UserAccount;
  }> {
    const username = sanitizeUsername(rawUsername);

    // Fetch latest account state directly from Firestore so newly created accounts on another machine work immediately
    const cloudAcc = await this.fetchAccountFromFirestore(username);
    const acc = cloudAcc || this.accounts[username];

    if (!acc || acc.password !== password) {
      return {
        success: false,
        code: 'INVALID',
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác!',
      };
    }

    if (acc.status === 'locked' && acc.role !== 'admin') {
      return {
        success: false,
        code: 'LOCKED',
        message: 'Tài khoản này đang bị khóa. Vui lòng liên hệ Admin!',
      };
    }

    if (acc.role !== 'admin' && Date.now() > acc.expiresAt) {
      return {
        success: false,
        code: 'EXPIRED',
        message: `Tài khoản "${acc.username}" đã hết hạn sử dụng vào ngày ${new Date(
          acc.expiresAt
        ).toLocaleDateString('vi-VN')}. Vui lòng liên hệ Admin để gia hạn!`,
      };
    }

    const devCheck = this.attachCurrentDevice(acc, forceKickOldestDevice);
    if (!devCheck.allowed) {
      return {
        success: false,
        code: 'MAX_DEVICES_REACHED',
        message: devCheck.message,
        activeDevices: devCheck.activeDevices,
      };
    }

    this.currentUsername = acc.username;
    this.saveToStorage();
    await this.syncAccountToFirestore(acc, false);
    this.notify();

    return {
      success: true,
      message: 'Đăng nhập thành công!',
      account: acc,
    };
  }

  // Register a new user account
  public async registerAccount(params: {
    username: string;
    password: string;
    displayName: string;
    avatar?: string;
  }): Promise<{ success: boolean; message: string; account?: UserAccount }> {
    const username = sanitizeUsername(params.username);
    if (username.length < 3 || username.length > 50) {
      return {
        success: false,
        message: 'Tên đăng nhập phải từ 3 đến 50 ký tự (chữ cái, số, gạch dưới).',
      };
    }
    if (params.password.length < 3 || params.password.length > 100) {
      return {
        success: false,
        message: 'Mật khẩu phải từ 3 đến 100 ký tự.',
      };
    }
    if (!params.displayName.trim()) {
      return {
        success: false,
        message: 'Vui lòng nhập tên hiển thị.',
      };
    }

    // Check Firestore first to ensure username is globally unique across all devices
    const existingCloud = await this.fetchAccountFromFirestore(username);
    if (existingCloud || this.accounts[username]) {
      return {
        success: false,
        message: `Tên đăng nhập "${username}" đã tồn tại. Vui lòng chọn tên khác!`,
      };
    }

    const now = Date.now();
    const defaultTrialDays = 30;
    const fbUid = auth.currentUser?.uid || `uid_${username}_${now.toString(36)}`;

    const newAcc: UserAccount = {
      uid: sanitizeId(fbUid),
      username,
      password: params.password.slice(0, 100),
      displayName: params.displayName.trim().slice(0, 100),
      avatar: params.avatar || PRESET_AVATARS[1].url,
      role: 'user',
      status: 'active',
      maxDevices: 2,
      activeDeviceIds: [],
      activeDevicesMeta: '[]',
      expiresAt: now + defaultTrialDays * 86400000,
      createdAtMs: now,
      updatedAtMs: now,
    };

    this.attachCurrentDevice(newAcc, true);
    this.accounts[username] = newAcc;
    this.currentUsername = username;
    this.saveToStorage();
    await this.syncAccountToFirestore(newAcc, true);
    this.notify();

    return {
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      account: newAcc,
    };
  }

  // Logout current device
  public async logout(): Promise<void> {
    const acc = this.getCurrentAccount();
    if (acc) {
      const deviceId = getDeviceId();
      const sessions = parseActiveDevices(acc).filter((s) => s.deviceId !== deviceId);
      acc.activeDeviceIds = sessions.map((s) => s.deviceId);
      acc.activeDevicesMeta = JSON.stringify(sessions);
      acc.updatedAtMs = Date.now();
      await this.syncAccountToFirestore(acc, false);
    }

    this.currentUsername = null;
    this.saveToStorage();
    if (auth.currentUser) {
      try {
        await firebaseSignOut(auth);
      } catch {}
    }
    this.notify();
  }

  // User self-updates profile (displayName, avatar, password)
  public async updateOwnProfile(updates: {
    displayName?: string;
    avatar?: string;
    newPassword?: string;
  }): Promise<{ success: boolean; message: string }> {
    const acc = this.getCurrentAccount();
    if (!acc) {
      return { success: false, message: 'Bạn chưa đăng nhập.' };
    }

    if (updates.displayName !== undefined) {
      const trimmed = updates.displayName.trim();
      if (!trimmed) {
        return { success: false, message: 'Tên hiển thị không được để trống.' };
      }
      acc.displayName = trimmed.slice(0, 100);
    }

    if (updates.avatar !== undefined) {
      acc.avatar = updates.avatar.slice(0, 150000);
    }

    if (updates.newPassword !== undefined && updates.newPassword.length > 0) {
      if (updates.newPassword.length < 3) {
        return { success: false, message: 'Mật khẩu mới phải có ít nhất 3 ký tự.' };
      }
      acc.password = updates.newPassword.slice(0, 100);
    }

    acc.updatedAtMs = Date.now();
    this.saveToStorage();
    await this.syncAccountToFirestore(acc, false);
    this.notify();

    return { success: true, message: 'Đã cập nhật thông tin tài khoản thành công!' };
  }

  // Remove a specific device from an account
  public async removeDeviceSession(
    username: string,
    targetDeviceId: string
  ): Promise<void> {
    const acc = this.accounts[username];
    if (!acc) return;

    const sessions = parseActiveDevices(acc).filter((s) => s.deviceId !== targetDeviceId);
    acc.activeDeviceIds = sessions.map((s) => s.deviceId);
    acc.activeDevicesMeta = JSON.stringify(sessions);
    acc.updatedAtMs = Date.now();

    if (this.currentUsername === username && targetDeviceId === getDeviceId()) {
      this.currentUsername = null;
    }

    this.saveToStorage();
    await this.syncAccountToFirestore(acc, false);
    this.notify();
  }

  // ================= ADMIN OPERATIONS =================

  public async adminCreateAccount(params: {
    username: string;
    password: string;
    displayName: string;
    role: 'admin' | 'user';
    durationDays: number;
    maxDevices: number;
    avatar?: string;
  }): Promise<{ success: boolean; message: string; account?: UserAccount }> {
    const username = sanitizeUsername(params.username);
    if (username.length < 3 || username.length > 50) {
      return {
        success: false,
        message: 'Tên đăng nhập phải từ 3 đến 50 ký tự (chữ cái, số, gạch dưới).',
      };
    }
    if (params.password.length < 3) {
      return {
        success: false,
        message: 'Mật khẩu phải từ 3 ký tự trở lên.',
      };
    }

    const existingCloud = await this.fetchAccountFromFirestore(username);
    if (existingCloud || this.accounts[username]) {
      return {
        success: false,
        message: `Tài khoản "${username}" đã tồn tại!`,
      };
    }

    const now = Date.now();
    const expiresAt = now + Math.max(1, params.durationDays) * 86400000;
    const newAcc: UserAccount = {
      uid: sanitizeId(auth.currentUser?.uid || `admin_created_${username}`),
      username,
      password: params.password.slice(0, 100),
      displayName: (params.displayName.trim() || username).slice(0, 100),
      avatar:
        params.avatar ||
        PRESET_AVATARS[Math.floor(Math.random() * (PRESET_AVATARS.length - 1)) + 1].url,
      role: params.role,
      status: 'active',
      maxDevices: Math.max(1, Math.min(10, params.maxDevices || 2)),
      activeDeviceIds: [],
      activeDevicesMeta: '[]',
      expiresAt,
      createdAtMs: now,
      updatedAtMs: now,
    };

    this.accounts[username] = newAcc;
    this.saveToStorage();
    await this.syncAccountToFirestore(newAcc, true);
    this.notify();

    return {
      success: true,
      message: `Đã tạo và đồng bộ đám mây tài khoản "${username}" thành công!`,
      account: newAcc,
    };
  }

  public async adminExtendAccount(
    username: string,
    addDays: number,
    exactTimestamp?: number
  ): Promise<{ success: boolean; message: string }> {
    const acc = this.accounts[username];
    if (!acc) return { success: false, message: 'Không tìm thấy tài khoản.' };

    const now = Date.now();
    if (exactTimestamp !== undefined) {
      acc.expiresAt = exactTimestamp;
    } else {
      const baseTime = acc.expiresAt > now ? acc.expiresAt : now;
      acc.expiresAt = baseTime + addDays * 86400000;
    }
    acc.status = 'active';
    acc.updatedAtMs = now;

    this.saveToStorage();
    await this.syncAccountToFirestore(acc, false);
    this.notify();

    return {
      success: true,
      message: `Đã gia hạn tài khoản "${username}" đến ${new Date(
        acc.expiresAt
      ).toLocaleDateString('vi-VN')}!`,
    };
  }

  public async adminUpdateAccount(
    username: string,
    updates: Partial<
      Pick<
        UserAccount,
        'password' | 'displayName' | 'role' | 'status' | 'maxDevices' | 'expiresAt' | 'avatar'
      >
    >
  ): Promise<{ success: boolean; message: string }> {
    const acc = this.accounts[username];
    if (!acc) return { success: false, message: 'Không tìm thấy tài khoản.' };

    if (updates.password !== undefined && updates.password.trim().length >= 3) {
      acc.password = updates.password.trim().slice(0, 100);
    }
    if (updates.displayName !== undefined && updates.displayName.trim().length >= 1) {
      acc.displayName = updates.displayName.trim().slice(0, 100);
    }
    if (updates.role !== undefined) {
      acc.role = updates.role;
    }
    if (updates.status !== undefined) {
      acc.status = updates.status;
    }
    if (updates.maxDevices !== undefined) {
      acc.maxDevices = Math.max(1, Math.min(10, updates.maxDevices));
    }
    if (updates.expiresAt !== undefined) {
      acc.expiresAt = updates.expiresAt;
    }
    if (updates.avatar !== undefined) {
      acc.avatar = updates.avatar;
    }

    acc.updatedAtMs = Date.now();
    this.saveToStorage();
    await this.syncAccountToFirestore(acc, false);
    this.notify();

    return { success: true, message: `Đã cập nhật và đồng bộ tài khoản "${username}".` };
  }

  public async adminResetDevices(username: string): Promise<void> {
    const acc = this.accounts[username];
    if (!acc) return;

    acc.activeDeviceIds = [];
    acc.activeDevicesMeta = '[]';
    acc.updatedAtMs = Date.now();
    this.saveToStorage();
    await this.syncAccountToFirestore(acc, false);
    this.notify();
  }

  public async adminDeleteAccount(username: string): Promise<{ success: boolean; message: string }> {
    if (username === 'admin') {
      return { success: false, message: 'Không thể xóa tài khoản Admin gốc!' };
    }
    if (!this.accounts[username]) {
      return { success: false, message: 'Tài khoản không tồn tại.' };
    }

    delete this.accounts[username];
    if (this.currentUsername === username) {
      this.currentUsername = null;
    }
    this.saveToStorage();

    try {
      await deleteDoc(doc(db, 'accounts', username));
    } catch (error) {
      console.warn('Firestore delete error:', error);
    }

    this.notify();
    return { success: true, message: `Đã xóa tài khoản "${username}".` };
  }
}

export const accountService = new AccountService();
