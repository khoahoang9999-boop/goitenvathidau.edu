import { Student, ClassGroup, QuizSet } from '../types';
import { getTrackFromDB, saveTrackToDB, CustomTrack } from './musicStorage';
import { sound } from './sound';

const APP_DB_NAME = 'ClassroomAppStorageDB';
const APP_DB_VERSION = 1;
const APP_STORE_NAME = 'app_data';
const CURRENT_USER_STORAGE_KEY = 'classroom_current_username_v1';

// Request persistent storage from browser so IndexedDB & LocalStorage are never auto-cleared
if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

export function getCurrentUserScope(explicitUsername?: string | null): string {
  const raw =
    explicitUsername ??
    (typeof window !== 'undefined' ? localStorage.getItem(CURRENT_USER_STORAGE_KEY) : null);
  const clean = (raw || 'guest').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
  return clean || 'guest';
}

export function getUserScopedKey(baseKey: string, explicitUsername?: string | null): string {
  const scope = getCurrentUserScope(explicitUsername);
  if (baseKey.includes('__user_')) return baseKey;
  return `${baseKey}__user_${scope}`;
}

export function openAppDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(APP_DB_NAME, APP_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(APP_STORE_NAME)) {
        db.createObjectStore(APP_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToAppDB<T>(
  key: string,
  value: T,
  explicitUsername?: string | null
): Promise<void> {
  try {
    const scopedKey = getUserScopedKey(key, explicitUsername);
    const db = await openAppDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(APP_STORE_NAME, 'readwrite');
      const store = tx.objectStore(APP_STORE_NAME);
      const req = store.put({ key: scopedKey, value, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB save error for ${key}:`, err);
  }
}

export async function getFromAppDB<T>(
  key: string,
  explicitUsername?: string | null
): Promise<T | null> {
  try {
    const scope = getCurrentUserScope(explicitUsername);
    const scopedKey = getUserScopedKey(key, scope);
    const db = await openAppDB();
    return new Promise((resolve) => {
      const tx = db.transaction(APP_STORE_NAME, 'readonly');
      const store = tx.objectStore(APP_STORE_NAME);
      const req = store.get(scopedKey);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result.value as T);
          return;
        }
        // Only migrate legacy unscoped data for 'admin' so existing admin data is preserved,
        // while all other accounts remain 100% isolated.
        if (scope === 'admin' && !key.includes('__user_')) {
          const fallbackReq = store.get(key);
          fallbackReq.onsuccess = () =>
            resolve(fallbackReq.result ? (fallbackReq.result.value as T) : null);
          fallbackReq.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getAllKeysFromAppDB(
  explicitUsername?: string | null
): Promise<Record<string, any>> {
  try {
    const scope = getCurrentUserScope(explicitUsername);
    const suffix = `__user_${scope}`;
    const db = await openAppDB();
    return new Promise((resolve) => {
      const tx = db.transaction(APP_STORE_NAME, 'readonly');
      const store = tx.objectStore(APP_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const result: Record<string, any> = {};
        if (Array.isArray(req.result)) {
          req.result.forEach((item: { key: string; value: any }) => {
            if (item && item.key) {
              if (item.key.endsWith(suffix)) {
                const baseKey = item.key.slice(0, item.key.length - suffix.length);
                result[baseKey] = item.value;
              } else if (scope === 'admin' && !item.key.includes('__user_')) {
                if (!(item.key in result)) {
                  result[item.key] = item.value;
                }
              }
            }
          });
        }
        resolve(result);
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

// Convert ArrayBuffer <-> Base64 for Backup/Restore of uploaded audio files
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface FullBackupPayload {
  version: number;
  exportedAt: string;
  students: Student[];
  classes: ClassGroup[];
  selectedClass: string;
  customTugImage: string | null;
  quizSets?: QuizSet[];
  arenaTheme?: string;
  showStudentFaces?: boolean;
  classPhotos?: Record<string, any>;
  music?: {
    source: string;
    volume: number;
    track?: {
      name: string;
      type: string;
      size: number;
      base64Data: string;
    } | null;
  };
}

export async function createFullBackupData(
  currentStudents: Student[],
  currentClasses: ClassGroup[],
  selectedClass: string
): Promise<FullBackupPayload> {
  const allDbData = await getAllKeysFromAppDB();
  const customTugImage =
    allDbData['custom_tug_image'] ||
    localStorage.getItem(getUserScopedKey('cp_custom_tug_image')) ||
    null;

  let quizSets: QuizSet[] | undefined;
  try {
    const savedQuiz =
      allDbData['quiz_sets'] || localStorage.getItem(getUserScopedKey('cp_quiz_sets'));
    if (savedQuiz) {
      quizSets = typeof savedQuiz === 'string' ? JSON.parse(savedQuiz) : savedQuiz;
    }
  } catch {}

  const classPhotos: Record<string, any> = {};
  Object.keys(allDbData).forEach((k) => {
    if (k.startsWith('class_photo_')) {
      classPhotos[k] = allDbData[k];
    }
  });

  // Get uploaded music from IndexedDB if present
  let trackBackup: { name: string; type: string; size: number; base64Data: string } | null = null;
  try {
    const track = await getTrackFromDB('bg_music');
    if (track && track.data) {
      trackBackup = {
        name: track.name,
        type: track.type,
        size: track.size,
        base64Data: arrayBufferToBase64(track.data),
      };
    }
  } catch {}

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    students: currentStudents,
    classes: currentClasses,
    selectedClass,
    customTugImage,
    quizSets,
    arenaTheme: localStorage.getItem(getUserScopedKey('cp_arena_theme')) || 'tug',
    showStudentFaces: localStorage.getItem(getUserScopedKey('cp_show_student_faces')) !== 'false',
    classPhotos,
    music: {
      source: sound.getMusicSource(),
      volume: sound.getMusicVolume(),
      track: trackBackup,
    },
  };
}

export async function restoreFullBackupData(payload: FullBackupPayload): Promise<{
  students: Student[];
  classes: ClassGroup[];
  selectedClass: string;
}> {
  if (!payload || !Array.isArray(payload.students)) {
    throw new Error('File sao lưu không hợp lệ hoặc bị hỏng.');
  }

  // 1. Save students & classes to current user's isolated IndexedDB + localStorage
  await saveToAppDB('students', payload.students);
  if (Array.isArray(payload.classes) && payload.classes.length > 0) {
    await saveToAppDB('classes', payload.classes);
    try {
      localStorage.setItem(
        getUserScopedKey('classroom_picker_classes_v3'),
        JSON.stringify(payload.classes)
      );
    } catch {}
  }

  try {
    localStorage.setItem(
      getUserScopedKey('classroom_picker_students_v3'),
      JSON.stringify(payload.students)
    );
  } catch {
    // If localStorage hits 5MB quota due to many photos, IndexedDB still holds 100% of photos safely
  }

  if (payload.selectedClass) {
    try {
      localStorage.setItem(
        getUserScopedKey('classroom_picker_active_class_v3'),
        payload.selectedClass
      );
    } catch {}
  }

  // 2. Restore Tug of War custom image
  if (payload.customTugImage) {
    await saveToAppDB('custom_tug_image', payload.customTugImage);
    try {
      localStorage.setItem(getUserScopedKey('cp_custom_tug_image'), payload.customTugImage);
    } catch {}
  }

  // 3. Restore Quiz sets
  if (Array.isArray(payload.quizSets) && payload.quizSets.length > 0) {
    await saveToAppDB('quiz_sets', payload.quizSets);
    try {
      localStorage.setItem(getUserScopedKey('cp_quiz_sets'), JSON.stringify(payload.quizSets));
    } catch {}
  }

  // 4. Restore Class Photos & Pins
  if (payload.classPhotos && typeof payload.classPhotos === 'object') {
    for (const [k, v] of Object.entries(payload.classPhotos)) {
      await saveToAppDB(k, v);
    }
  }

  // 5. Restore Custom Uploaded Music Track
  if (payload.music) {
    if (typeof payload.music.volume === 'number') {
      sound.setMusicVolume(payload.music.volume);
    }
    if (payload.music.track && payload.music.track.base64Data) {
      const buffer = base64ToArrayBuffer(payload.music.track.base64Data);
      const customTrack: CustomTrack = {
        id: 'bg_music',
        name: payload.music.track.name,
        type: payload.music.track.type || 'audio/mp3',
        size: payload.music.track.size || buffer.byteLength,
        data: buffer,
        updatedAt: Date.now(),
      };
      await saveTrackToDB(customTrack);
      await sound.loadCustomTrackFromBuffer(buffer, customTrack.name, customTrack.type);
      sound.setMusicSource(payload.music.source === 'synth' ? 'synth' : 'custom');
    }
  }

  // Dispatch custom event so open components (like ClassroomQuiz) immediately refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('classroom-data-restored'));
  }

  return {
    students: payload.students,
    classes: Array.isArray(payload.classes) && payload.classes.length > 0 ? payload.classes : [],
    selectedClass: payload.selectedClass || 'Lớp 6A1',
  };
}
