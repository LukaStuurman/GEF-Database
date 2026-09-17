import type { GefData } from "@bedrock-engineer/gef-parser";

const DATABASE_NAME = "gef-viewer-desktop-cache";
const DATABASE_VERSION = 1;
const STORE_NAME = "parsed-gef-files";

interface CachedGefFile {
  name: string;
  data: GefData;
}

function openCacheDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open GEF cache database."));
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

export async function getCachedGefFiles(
  names: Array<string>,
): Promise<Record<string, GefData>> {
  if (names.length === 0) {
    return {};
  }

  const database = await openCacheDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const cachedFiles: Record<string, GefData> = {};
    let pending = names.length;

    const finish = () => {
      pending -= 1;

      if (pending === 0) {
        resolve(cachedFiles);
      }
    };

    transaction.oncomplete = () => {
      database.close();
    };

    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Failed to read GEF cache database."),
      );
    };

    for (const name of names) {
      const request = store.get(name);

      request.onsuccess = () => {
        const record = request.result as CachedGefFile | undefined;

        if (record) {
          cachedFiles[name] = record.data;
        }

        finish();
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to read cached GEF file."));
      };
    }
  });
}

export async function saveCachedGefFiles(
  files: Array<[string, GefData]>,
): Promise<void> {
  if (files.length === 0) {
    return;
  }

  const database = await openCacheDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Failed to write GEF cache database."),
      );
    };

    for (const [name, data] of files) {
      store.put({
        name,
        data,
      } satisfies CachedGefFile);
    }
  });
}

export async function removeCachedGefFiles(names: Array<string>): Promise<void> {
  if (names.length === 0) {
    return;
  }

  const database = await openCacheDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ??
          new Error("Failed to remove GEF cache entries from database."),
      );
    };

    for (const name of names) {
      store.delete(name);
    }
  });
}

export async function clearCachedGefFiles(): Promise<void> {
  const database = await openCacheDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to clear GEF cache database."));
    };

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Failed to clear GEF cache database."),
      );
    };
  });
}

export async function pruneCachedGefFiles(
  validNames: Array<string>,
): Promise<void> {
  const validNameSet = new Set(validNames);
  const database = await openCacheDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to prune GEF cache database."));
    };

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        return;
      }

      const key = String(cursor.primaryKey);

      if (!validNameSet.has(key)) {
        cursor.delete();
      }

      cursor.continue();
    };

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ?? new Error("Failed to prune GEF cache database."),
      );
    };
  });
}

