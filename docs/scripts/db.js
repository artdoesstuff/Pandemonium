const DB_NAME    = 'pandemonium';
const DB_VERSION = 1;
let db = null;

function dbOpen() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('blobs'))  d.createObjectStore('blobs');
      if (!d.objectStoreNames.contains('queue'))  d.createObjectStore('queue', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('images')) d.createObjectStore('images', { keyPath: 'id' });
    };
    req.onsuccess  = e => { db = e.target.result; resolve(db); };
    req.onerror    = e => reject(e.target.error);
  });
}

function dbPut(store, key, value) {
  return dbOpen().then(d => new Promise((resolve, reject) => {
    const tx  = d.transaction(store, 'readwrite');
    const req = store === 'blobs'
      ? tx.objectStore(store).put(value, key)
      : tx.objectStore(store).put(value);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  }));
}

function dbGet(store, key) {
  return dbOpen().then(d => new Promise((resolve, reject) => {
    const tx  = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  }));
}

function dbGetAll(store) {
  return dbOpen().then(d => new Promise((resolve, reject) => {
    const tx  = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  }));
}

function dbDelete(store, key) {
  return dbOpen().then(d => new Promise((resolve, reject) => {
    const tx  = d.transaction(store, 'readwrite');
    const req = store === 'blobs'
      ? tx.objectStore(store).delete(key)
      : tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  }));
}

function dbClear(store) {
  return dbOpen().then(d => new Promise((resolve, reject) => {
    const tx  = d.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  }));
}