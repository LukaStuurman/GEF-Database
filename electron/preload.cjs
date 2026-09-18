const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  getState: () => ipcRenderer.invoke("desktop:get-state"),
  readStoredFiles: (filenames) =>
    ipcRenderer.invoke("desktop:read-stored-files", filenames),
  chooseDatabaseDirectory: () =>
    ipcRenderer.invoke("desktop:choose-database-directory"),
  setDatabaseDirectory: (payload) =>
    ipcRenderer.invoke("desktop:set-database-directory", payload),
  listBackupFiles: () => ipcRenderer.invoke("desktop:list-backup-files"),
  readBackupFile: (reference) =>
    ipcRenderer.invoke("desktop:read-backup-file", reference),
  updateBackupIndex: (references) =>
    ipcRenderer.invoke("desktop:update-backup-index", references),
  chooseBackupDirectory: () =>
    ipcRenderer.invoke("desktop:choose-backup-directory"),
  setBackupDirectory: (payload) =>
    ipcRenderer.invoke("desktop:set-backup-directory", payload),
  storeFiles: (files) => ipcRenderer.invoke("desktop:store-files", files),
  removeStoredFile: (filename) =>
    ipcRenderer.invoke("desktop:remove-stored-file", filename),
  clearStoredFiles: () => ipcRenderer.invoke("desktop:clear-stored-files"),
  saveBoreStyle: (style) =>
    ipcRenderer.invoke("desktop:save-bore-style", style),
  searchOpenStreetMap: (query, language) =>
    ipcRenderer.invoke("desktop:search-openstreetmap", { query, language }),
  downloadDinoGef: (dinoNumber) =>
    ipcRenderer.invoke("desktop:download-dinoloket-gef", dinoNumber),
  savePdfExports: (files) =>
    ipcRenderer.invoke("desktop:save-pdf-exports", files),
  exportSelectedGefFiles: (filenames) =>
    ipcRenderer.invoke("desktop:export-selected-gef-files", filenames),
  appendDebugLog: (payload) =>
    ipcRenderer.invoke("desktop:append-debug-log", payload),
  onDatasetProgress: (callback) => {
    const listener = (_event, progress) => {
      callback(progress);
    };

    ipcRenderer.on("desktop:dataset-progress", listener);

    return () => {
      ipcRenderer.removeListener("desktop:dataset-progress", listener);
    };
  },
});

