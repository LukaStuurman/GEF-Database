import type { BoreStyleSettings } from "~/util/bore-style";

type DesktopGefFileType = "BORE" | "CPT" | "DISS";

interface DesktopFilePayload {
  name: string;
  content: string;
}

interface DesktopGefIndexFields {
  fileType: DesktopGefFileType | null;
  projectId: string | null;
  testId: string | null;
  companyName: string | null;
  testDate: string | null;
  startDate: string | null;
  startTime: string | null;
  fileDate: string | null;
  finalDepth: number | null;
  childCount: number;
  lastScan: number | null;
  coordinateSystemCode: string | null;
  originalX: number | null;
  originalY: number | null;
  heightSystemCode: string | null;
  surfaceElevation: number | null;
  parentReference: string | null;
  parentValue: number | null;
  parentUnit: string | null;
  boringDate: string | null;
  placeName: string | null;
  drillingCompany: string | null;
}

interface DesktopDirectoryFileReference extends DesktopGefIndexFields {
  name: string;
  backupFileName: string;
  size: number | null;
  modifiedTimeMs: number | null;
}

interface DesktopStoredFileReference extends DesktopGefIndexFields {
  name: string;
  storedFileName: string;
}

interface DesktopStatePayload {
  databaseDirectory: string | null;
  backupDirectory: string | null;
  storedFiles: Array<DesktopStoredFileReference>;
  databaseCount: number;
  backupCount: number;
  boreStyle: BoreStyleSettings | null;
  rememberedFiles: Array<DesktopDirectoryFileReference>;
}

interface DesktopBackupPayload {
  directory: string;
}

interface DesktopDatabasePayload {
  directory: string;
}

interface DesktopApi {
  getState: () => Promise<DesktopStatePayload>;
  readStoredFiles: (
    filenames: Array<string>,
  ) => Promise<Array<DesktopFilePayload>>;
  chooseDatabaseDirectory: () => Promise<string | null>;
  setDatabaseDirectory: (payload: DesktopDatabasePayload) => Promise<{
    databaseDirectory: string | null;
    backupDirectory: string | null;
    databaseCount: number;
    backupCount: number;
  }>;
  listBackupFiles: () => Promise<Array<DesktopDirectoryFileReference>>;
  readBackupFile: (
    reference: DesktopDirectoryFileReference,
  ) => Promise<DesktopFilePayload | null>;
  updateBackupIndex: (
    references: Array<DesktopDirectoryFileReference>,
  ) => Promise<{ backupCount: number }>;
  chooseBackupDirectory: () => Promise<string | null>;
  setBackupDirectory: (payload: DesktopBackupPayload) => Promise<{
    databaseDirectory: string | null;
    backupDirectory: string | null;
    databaseCount: number;
    backupCount: number;
  }>;
  storeFiles: (files: Array<DesktopFilePayload>) => Promise<{
    databaseDirectory: string | null;
    backupDirectory: string | null;
    databaseCount: number;
    backupCount: number;
  }>;
  removeStoredFile: (filename: string) => Promise<{
    databaseDirectory: string | null;
    databaseCount: number;
    backupCount: number;
  }>;
  clearStoredFiles: () => Promise<{
    databaseDirectory: string | null;
    databaseCount: number;
    backupCount: number;
  }>;
  saveBoreStyle: (style: BoreStyleSettings) => Promise<BoreStyleSettings>;
  searchOpenStreetMap: (
    query: string,
    language: string,
  ) => Promise<
    Array<{
      placeId: number;
      displayName: string;
      lat: number;
      lon: number;
    }>
  >;
  savePdfExports: (
    files: Array<{ filename: string; dataBase64: string }>,
  ) => Promise<{ savedCount: number; directory: string | null }>;
  exportSelectedGefFiles: (filenames: Array<string>) => Promise<{
    savedCount: number;
    failedCount: number;
    directory: string | null;
  }>;
  appendDebugLog: (payload: {
    scope: string;
    message?: string;
    stack?: string | null;
    filename?: string;
    [key: string]: unknown;
  }) => Promise<boolean>;
  onDatasetProgress: (
    callback: (progress: {
      phase: "scanning" | "indexing";
      processed: number;
      total: number;
    }) => void,
  ) => () => void;
}

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}

export {};

