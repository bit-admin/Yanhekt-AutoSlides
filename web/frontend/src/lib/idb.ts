// Minimal promisified IndexedDB helpers. Deliberately tiny (no `idb`
// dependency): the slide store's access patterns are simple get/put/delete
// and index scans on three object stores, one writer at a time.

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

export function openDatabase(
  name: string,
  version: number,
  upgrade: (db: IDBDatabase, oldVersion: number) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = (event) => {
      upgrade(request.result, event.oldVersion);
    };
    request.onsuccess = () => {
      const db = request.result;
      // If another tab upgrades the schema, drop this connection so it can.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error(`Failed to open database ${name}`));
    request.onblocked = () => reject(new Error(`Database ${name} open blocked by another connection`));
  });
}
