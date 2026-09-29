import { emptyStore, type Store } from './planner';
// Guest records stay on this browser. This is not an encrypted document vault or cloud sync.
const DB = 'trippilot-planner-v1';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close another TripPilot tab to enable local saving.'));
  });
}
export async function readStore(): Promise<Store> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readonly');
    const req = tx.objectStore('workspace').get('trips');
    req.onsuccess = () => { const value = req.result; if (value && (value.version !== 1 || !Array.isArray(value.trips))) reject(new Error('Saved data has an unsupported format.')); else resolve(value || emptyStore()); };
    req.onerror = () => reject(req.error);
  }); } finally { db.close(); }
}
export async function writeStore(store: Store): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    tx.objectStore('workspace').put(store, 'trips');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Local saving was interrupted.'));
  }); } finally { db.close(); }
}
