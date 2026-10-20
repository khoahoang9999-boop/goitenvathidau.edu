const DB_NAME = 'ClassroomMusicDB';
const DB_VERSION = 2;
const STORE_NAME = 'custom_tracks';

export interface CustomTrack {
  id: string;
  name: string;
  type: string;
  size: number;
  blob?: Blob;
  data?: ArrayBuffer;
  updatedAt: number;
}

export function openMusicDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTrackToDB(track: CustomTrack): Promise<void> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(track);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getTrackFromDB(id: string = 'bg_music'): Promise<CustomTrack | null> {
  try {
    const db = await openMusicDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteTrackFromDB(id: string = 'bg_music'): Promise<void> {
  try {
    const db = await openMusicDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}
