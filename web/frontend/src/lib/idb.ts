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

/**
 * Open a database. `onClosed` runs once when this connection is closed under
 * the caller: another tab asked for a newer version (the connection closes so
 * that upgrade can go ahead), or the browser closed it. A cached connection
 * must be dropped then, or every later transaction on it fails.
 *
 * A blocked open is reported as a failure at once; if the browser finishes
 * opening it later, that connection is closed straight away, so nobody holds
 * a connection that no caller knows about.
 */
export function openDatabase(
  name: string,
  version: number,
  upgrade: (db: IDBDatabase, oldVersion: number) => void,
  onClosed?: (reason: 'versionchange' | 'closed') => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let gaveUp = false;
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = (event) => {
      upgrade(request.result, event.oldVersion);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (gaveUp) {
        db.close();
        return;
      }
      let closed = false;
      const close = (reason: 'versionchange' | 'closed') => {
        if (closed) return;
        closed = true;
        onClosed?.(reason);
      };
      db.onversionchange = () => {
        db.close();
        close('versionchange');
      };
      db.onclose = () => close('closed');
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error(`Failed to open database ${name}`));
    request.onblocked = () => {
      gaveUp = true;
      reject(new Error(`Database ${name} open blocked by another connection`));
    };
  });
}

/**
 * One shared connection, opened on first use. It is opened again after a
 * failed open or once the connection was closed (`openDatabase`'s
 * `onClosed`); a closed one is never handed out.
 */
export function createConnection(open: (onClosed: (reason: 'versionchange' | 'closed') => void) => Promise<IDBDatabase>): () => Promise<IDBDatabase> {
  let current: Promise<IDBDatabase> | null = null;
  return () => {
    if (!current) {
      const opening = open(() => {
        if (current === opening) current = null;
      });
      current = opening;
      opening.catch(() => {
        if (current === opening) current = null;
      });
    }
    return current;
  };
}
