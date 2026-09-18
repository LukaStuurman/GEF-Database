import type { GefData } from "@bedrock-engineer/gef-parser";
import type { TFunction } from "i18next";
import {
  ChevronDownIcon,
  GithubIcon,
  LinkedinIcon,
  MailIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Button,
  Disclosure,
  DisclosurePanel,
  FileTrigger,
  Heading,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  createDefaultBoreStyle,
  normalizeBoreStyle,
  type BoreStyleSettings,
} from "~/util/bore-style";
import {
  clearCachedGefFiles,
  getCachedGefFiles,
  pruneCachedGefFiles,
  removeCachedGefFiles,
  saveCachedGefFiles,
} from "~/util/desktop-gef-cache";
import { parseGefFilesWithWorkerPool } from "~/util/gef-worker-pool";
import {
  createIndexedGefFileFromDatasetEntry,
  createIndexedGefFileFromGefData,
  createIndexedGefFileFromStoredEntry,
  type IndexedGefFile,
} from "~/util/gef-index";
import {
  createDefaultBorePdfExportOptions,
  exportSelectedBorePdfs,
  type BorePdfExportOptions,
  getAvailablePdfGraphOptions,
  type PdfExportItem,
} from "~/util/bore-pdf-export";
import { CompactBoreHeader, DetailedBoreHeaders } from "./bore-header-items";
import { BorePlot } from "./bore-plot";
import { BorePdfExportCard } from "./bore-pdf-export-card";
import { Card } from "./card";
import { CompactCptHeader, DetailedCptHeaders } from "./cpt-header-items";
import { CptPlots } from "./cpt-plot";
import { CompactDissHeader, DetailedDissHeaders } from "./diss-header-items";
import { DissPlots } from "./diss-plots";
import { DesktopBackupCard } from "./desktop-backup-card";
import { DownloadGeoJSONButton } from "./download-geojson-button";
import { FileTable } from "./file-table";
import { GefMap } from "./gef-map.client";
import { InstallInstructions } from "./install-instructions";
import { PreExcavationPlot } from "./preexcavation-plot";
import { SpecimenTable } from "./specimen-table";

function translateWarning(warning: string, t: TFunction): string {
  const parts = warning.split(":");
  const key = parts[0];

  switch (key) {
    case "missingZidHeader":
      return t("missingZidHeader", { filename: parts[1] });
    case "unknownHeightSystem":
      return t("unknownHeightSystem", {
        filename: parts[1],
        heightCode: parts[2],
      });
    case "zidWithoutHeight":
      return t("zidWithoutHeight", { filename: parts[1] });
    case "missingXyidHeader":
      return t("missingXyidHeader", { filename: parts[1] });
    case "missingColumnInfoQuantity": {
      const count = parseInt(parts[2] ?? "0");
      const entry = t(
        count === 1
          ? "missingColumnInfoQuantity_entry"
          : "missingColumnInfoQuantity_entry_plural",
      );

      return t("missingColumnInfoQuantity", {
        filename: parts[1],
        count,
        entry,
      });
    }
    default:
      return warning;
  }
}

function translateError(error: string, t: TFunction): string {
  if (error === "sieveTestNotSupported") {
    return t("sieveTestNotSupported");
  }
  return error;
}

interface DesktopFilePayload {
  name: string;
  content: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return "Unknown error";
}

async function appendDesktopDebugLog(payload: {
  scope: string;
  message?: string;
  stack?: string | null;
  [key: string]: unknown;
}) {
  if (!window.desktopApi?.appendDebugLog) {
    return;
  }

  try {
    await window.desktopApi.appendDebugLog(payload);
  } catch (error) {
    console.error(error);
  }
}

async function serializeFiles(
  files: Array<File>,
): Promise<Array<DesktopFilePayload>> {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      content: await file.text(),
    })),
  );
}

export function App() {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [indexedGefFiles, setIndexedGefFiles] = useState<
    Record<string, IndexedGefFile>
  >({});
  const [loadedGefData, setLoadedGefData] = useState<Record<string, GefData>>(
    {},
  );
  const [selectedFileName, setSelectedFileName] = useState("");
  const [loadingFileNames, setLoadingFileNames] = useState<Array<string>>([]);
  const [failedFiles, setFailedFiles] = useState<
    Array<{ name: string; error: string }>
  >([]);
  const [databaseDirectory, setDatabaseDirectory] = useState<string | null>(
    null,
  );
  const [backupDirectory, setBackupDirectory] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{
    phase: "scanning" | "indexing";
    processed: number;
    total: number;
  } | null>(null);
  const [databaseCount, setDatabaseCount] = useState(0);
  const [backupCount, setBackupCount] = useState(0);
  const [boreStyle, setBoreStyle] = useState<BoreStyleSettings>(
    createDefaultBoreStyle,
  );
  const [selectedPdfExportFilenames, setSelectedPdfExportFilenames] = useState<
    Array<string>
  >([]);
  const [borePdfExportOptions, setBorePdfExportOptions] =
    useState<BorePdfExportOptions>(createDefaultBorePdfExportOptions);
  const [selectedPdfGraphKeys, setSelectedPdfGraphKeys] = useState<
    Array<string>
  >([]);
  const [isExportingBorePdfs, setIsExportingBorePdfs] = useState(false);
  const [isExportingGefFiles, setIsExportingGefFiles] = useState(false);
  const [isLoadingPdfGraphOptions, setIsLoadingPdfGraphOptions] =
    useState(false);
  const [borePdfExportStatus, setBorePdfExportStatus] = useState<string | null>(
    null,
  );
  const [gefFileExportStatus, setGefFileExportStatus] = useState<string | null>(
    null,
  );
  const hasInitializedGraphSelectionRef = useRef(false);
  const pendingLoadRef = useRef(new Map<string, Promise<GefData | null>>());

  const exportablePdfFiles = useMemo(
    () =>
      Object.values(indexedGefFiles)
        .filter(
          (file) =>
            file.fileType === "BORE" ||
            file.fileType === "CPT" ||
            file.fileType === "DISS",
        )
        .map((file) => ({
          filename: file.filename,
          fileType: file.fileType as "BORE" | "CPT" | "DISS",
        }))
        .sort((left, right) => left.filename.localeCompare(right.filename)),
    [indexedGefFiles],
  );

  const selectedPdfExportItems = useMemo(
    () =>
      selectedPdfExportFilenames
        .map((filename) => {
          const data = loadedGefData[filename];

          if (
            !data ||
            (data.fileType !== "BORE" &&
              data.fileType !== "CPT" &&
              data.fileType !== "DISS")
          ) {
            return null;
          }

          return {
            filename,
            data,
          } satisfies PdfExportItem;
        })
        .filter((item): item is PdfExportItem => item !== null),
    [loadedGefData, selectedPdfExportFilenames],
  );

  const availablePdfGraphOptions = useMemo(() => {
    return getAvailablePdfGraphOptions(selectedPdfExportItems, t);
  }, [selectedPdfExportItems, t]);

  const pendingPdfGraphOptionFilenames = useMemo(
    () =>
      borePdfExportOptions.includeBorePlotPage
        ? selectedPdfExportFilenames.filter((filename) => {
            const indexedFile = indexedGefFiles[filename];

            return (
              indexedFile !== undefined &&
              (indexedFile.fileType === "BORE" ||
                indexedFile.fileType === "CPT" ||
                indexedFile.fileType === "DISS") &&
              !loadedGefData[filename]
            );
          })
        : [],
    [
      borePdfExportOptions.includeBorePlotPage,
      indexedGefFiles,
      loadedGefData,
      selectedPdfExportFilenames,
    ],
  );

  async function loadSampleFiles() {
    const sampleFiles = [
      "example_bore.gef",
      "example_cpt.gef",
      "example_diss.gef",
    ];

    const files = await Promise.all(
      sampleFiles.map(async (filename) => {
        const response = await fetch(new URL(filename, window.location.href));
        const text = await response.text();
        return new File([text], filename, { type: "text/plain" });
      }),
    );

    await handleFiles(files);
  }

  async function persistSuccessfulFiles(
    files: Array<File>,
    options: { showStatus?: boolean } = {},
  ) {
    if (!window.desktopApi || files.length === 0) {
      return;
    }

    try {
      const result = await window.desktopApi.storeFiles(
        await serializeFiles(files),
      );
      setDatabaseDirectory(result.databaseDirectory);
      setDatabaseCount(result.databaseCount);
      setBackupDirectory(result.backupDirectory);
      if (options.showStatus ?? true) {
        setBackupStatus(
          t("databaseSavedStatus", { count: result.databaseCount }),
        );
      }
    } catch (error) {
      console.error(error);
      if (options.showStatus ?? true) {
        setBackupStatus(t("databaseSaveFailed"));
      }
    }
  }

  function mergeFailedFiles(failed: Array<{ name: string; error: string }>) {
    if (failed.length === 0) {
      return;
    }

    setFailedFiles((previous) => {
      const next = new Map(previous.map((item) => [item.name, item]));

      for (const item of failed) {
        next.set(item.name, item);
      }

      return Array.from(next.values()).sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    });
  }

  async function applyParsedFiles(
    parsedGefFiles: Array<[string, GefData]>,
    successfulFiles: Array<File>,
    failed: Array<{ name: string; error: string }>,
    options: {
      persistToDatabase?: boolean;
      showPersistStatus?: boolean;
    } = {},
  ) {
    if (
      parsedGefFiles.length === 0 &&
      successfulFiles.length === 0 &&
      failed.length === 0
    ) {
      return;
    }

    if (parsedGefFiles.length > 0) {
      await saveCachedGefFiles(parsedGefFiles);
    }

    startTransition(() => {
      if (parsedGefFiles.length > 0) {
        setLoadedGefData((previous) => ({
          ...previous,
          ...Object.fromEntries(parsedGefFiles),
        }));
        setIndexedGefFiles((previous) => {
          const next = { ...previous };

          for (const [filename, data] of parsedGefFiles) {
            const existing = previous[filename];

            next[filename] = createIndexedGefFileFromGefData(
              filename,
              data,
              existing?.source ?? "database",
              existing?.source === "dataset" && existing.datasetReference
                ? {
                    backupFileName: existing.datasetReference.backupFileName,
                    size: existing.datasetReference.size,
                    modifiedTimeMs: existing.datasetReference.modifiedTimeMs,
                  }
                : { storedFileName: existing?.storedFileName },
            );
          }

          return next;
        });
      }

      const firstParsed = parsedGefFiles[0];
      if (firstParsed) {
        setSelectedFileName(firstParsed[0]);
      }
    });

    mergeFailedFiles(failed);

    if (options.persistToDatabase && successfulFiles.length > 0) {
      await persistSuccessfulFiles(successfulFiles, {
        showStatus: options.showPersistStatus,
      });
    }
  }

  function setFileLoading(filename: string, isLoading: boolean) {
    setLoadingFileNames((previous) =>
      isLoading
        ? previous.includes(filename)
          ? previous
          : [...previous, filename]
        : previous.filter((value) => value !== filename),
    );
  }

  async function readFilePayload(indexedFile: IndexedGefFile) {
    if (!window.desktopApi) {
      return null;
    }

    if (indexedFile.source === "dataset") {
      return indexedFile.datasetReference
        ? window.desktopApi.readBackupFile(indexedFile.datasetReference)
        : null;
    }

    const files = await window.desktopApi.readStoredFiles([
      indexedFile.filename,
    ]);
    return files[0] ?? null;
  }

  async function ensureGefFileLoaded(
    filename: string,
  ): Promise<GefData | null> {
    const loaded = loadedGefData[filename];

    if (loaded) {
      return loaded;
    }

    const existingRequest = pendingLoadRef.current.get(filename);

    if (existingRequest) {
      return existingRequest;
    }

    const indexedFile = indexedGefFiles[filename];

    if (!indexedFile) {
      return null;
    }

    const request = (async () => {
      setFileLoading(filename, true);

      try {
        const cached = await getCachedGefFiles([filename]);
        const cachedData = cached[filename];

        if (cachedData) {
          startTransition(() => {
            setLoadedGefData((previous) => ({
              ...previous,
              [filename]: cachedData,
            }));
            setIndexedGefFiles((previous) => {
              const existing = previous[filename];

              if (!existing) {
                return previous;
              }

              return {
                ...previous,
                [filename]: createIndexedGefFileFromGefData(
                  filename,
                  cachedData,
                  existing.source,
                  existing.source === "dataset" && existing.datasetReference
                    ? {
                        backupFileName:
                          existing.datasetReference.backupFileName,
                        size: existing.datasetReference.size,
                        modifiedTimeMs:
                          existing.datasetReference.modifiedTimeMs,
                      }
                    : { storedFileName: existing.storedFileName },
                ),
              };
            });
          });
          return cachedData;
        }

        const payload = await readFilePayload(indexedFile);

        if (!payload) {
          throw new Error("Bestand kon niet worden geladen.");
        }

        const parseResults = await parseGefFilesWithWorkerPool([
          new File([payload.content], payload.name, {
            type: "text/plain",
          }),
        ]);
        const result = parseResults[0];

        if (!result || result.status !== "fulfilled") {
          throw new Error(
            result?.status === "rejected" ? result.reason : "Parse failed.",
          );
        }

        await saveCachedGefFiles([[filename, result.value]]);

        startTransition(() => {
          setLoadedGefData((previous) => ({
            ...previous,
            [filename]: result.value,
          }));
          setIndexedGefFiles((previous) => ({
            ...previous,
            [filename]: createIndexedGefFileFromGefData(
              filename,
              result.value,
              indexedFile.source,
              indexedFile.source === "dataset" && indexedFile.datasetReference
                ? {
                    backupFileName: indexedFile.datasetReference.backupFileName,
                    size: indexedFile.datasetReference.size,
                    modifiedTimeMs: indexedFile.datasetReference.modifiedTimeMs,
                  }
                : { storedFileName: indexedFile.storedFileName },
            ),
          }));
        });

        return result.value;
      } catch (error) {
        mergeFailedFiles([
          {
            name: filename,
            error: getErrorMessage(error),
          },
        ]);
        return null;
      } finally {
        pendingLoadRef.current.delete(filename);
        setFileLoading(filename, false);
      }
    })();

    pendingLoadRef.current.set(filename, request);
    return request;
  }

  async function syncDatasetDirectory(options: { showStatus?: boolean } = {}) {
    if (!window.desktopApi) {
      return;
    }

    const unsubscribe = window.desktopApi.onDatasetProgress((progress) => {
      setRestoreProgress(progress);
    });

    try {
      const datasetFiles = await window.desktopApi.listBackupFiles();
      setBackupCount(datasetFiles.length);
      setIndexedGefFiles((previous) => {
        const next = Object.fromEntries(
          Object.entries(previous).filter(
            ([, file]) => file.source !== "dataset",
          ),
        ) as Record<string, IndexedGefFile>;

        for (const file of datasetFiles) {
          next[file.name] = createIndexedGefFileFromDatasetEntry(file);
        }

        return next;
      });
      void pruneCachedGefFiles(
        Array.from(
          new Set([
            ...Object.values(indexedGefFiles)
              .filter((file) => file.source !== "dataset")
              .map((file) => file.filename),
            ...datasetFiles.map((file) => file.name),
          ]),
        ),
      ).catch((error) => {
        console.error(error);
      });

      if (options.showStatus) {
        setBackupStatus(
          t("backupFolderRefreshed", { count: datasetFiles.length }),
        );
      }
    } finally {
      unsubscribe();
    }
  }

  async function chooseBackupDirectory() {
    if (!window.desktopApi) {
      return;
    }

    try {
      const directory = await window.desktopApi.chooseBackupDirectory();

      if (!directory) {
        return;
      }

      setIsRestoring(true);
      setRestoreProgress(null);
      setBackupStatus(null);

      const result = await window.desktopApi.setBackupDirectory({
        directory,
      });

      setDatabaseDirectory(result.databaseDirectory);
      setBackupDirectory(result.backupDirectory);
      setDatabaseCount(result.databaseCount);
      setBackupCount(result.backupCount);
      await syncDatasetDirectory({ showStatus: true });
    } catch (error) {
      console.error(error);
      setBackupStatus(t("backupSaveFailed"));
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  }

  async function refreshBackupDirectory() {
    if (!window.desktopApi || !backupDirectory || isRestoring) {
      return;
    }

    setIsRestoring(true);
    setRestoreProgress(null);
    setBackupStatus(null);

    try {
      await syncDatasetDirectory({ showStatus: true });
    } catch (error) {
      console.error(error);
      setBackupStatus(t("backupRefreshFailed"));
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  }

  async function chooseDatabaseDirectory() {
    if (!window.desktopApi) {
      return;
    }

    try {
      const directory = await window.desktopApi.chooseDatabaseDirectory();

      if (!directory) {
        return;
      }

      const result = await window.desktopApi.setDatabaseDirectory({
        directory,
      });

      setDatabaseDirectory(result.databaseDirectory);
      setBackupDirectory(result.backupDirectory);
      setDatabaseCount(result.databaseCount);
      setBackupCount(result.backupCount);
      setBackupStatus(
        t("databaseFolderSelected", { count: result.databaseCount }),
      );
    } catch (error) {
      console.error(error);
      setBackupStatus(t("databaseFolderSaveFailed"));
    }
  }

  async function openDinoGef(dinoNumber: string) {
    if (!window.desktopApi?.downloadDinoGef) {
      return;
    }

    try {
      const payload = await window.desktopApi.downloadDinoGef(dinoNumber);
      await handleFiles(
        [
          new File([payload.content], payload.name, {
            type: "text/plain",
          }),
        ],
        {
          persistToDatabase: false,
          showPersistStatus: false,
        },
      );
    } catch (error) {
      console.error(error);
      mergeFailedFiles([
        {
          name: `DINOloket ${dinoNumber}`,
          error: getErrorMessage(error),
        },
      ]);
    }
  }

  async function handleFiles(
    fileList: FileList | Array<File> | null,
    options: { persistToDatabase?: boolean; showPersistStatus?: boolean } = {},
  ) {
    const files = Array.from(fileList ?? []);

    if (files.length === 0) {
      return;
    }

    const results = await parseGefFilesWithWorkerPool(files, {
      maxConcurrency: 6,
    });
    const parsedGefFiles: Array<[string, GefData]> = [];
    const successfulFiles: Array<File> = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i]!;
      const file = files[i]!;

      if (result.status === "fulfilled") {
        parsedGefFiles.push([file.name, result.value]);
        successfulFiles.push(file);
      } else {
        failed.push({
          name: file.name,
          error: result.reason,
        });
      }
    }

    await applyParsedFiles(parsedGefFiles, successfulFiles, failed, {
      persistToDatabase: options.persistToDatabase ?? true,
      showPersistStatus: options.showPersistStatus ?? true,
    });
  }

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      void appendDesktopDebugLog({
        scope: "renderer:error",
        message: event.message || "Unknown renderer error",
        stack: event.error instanceof Error ? event.error.stack : null,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === "string"
            ? event.reason
            : "Unknown rejection";

      void appendDesktopDebugLog({
        scope: "renderer:unhandled-rejection",
        message: reason,
        stack: event.reason instanceof Error ? event.reason.stack : null,
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  useEffect(() => {
    if (!window.desktopApi) {
      return;
    }

    let isCancelled = false;

    const restoreSession = async () => {
      setIsRestoring(true);
      setRestoreProgress(null);

      try {
        const state = await window.desktopApi!.getState();

        if (isCancelled) {
          return;
        }

        setBackupDirectory(state.backupDirectory);
        setDatabaseDirectory(state.databaseDirectory);
        setDatabaseCount(state.databaseCount);
        setBackupCount(state.backupCount);
        if (state.boreStyle) {
          setBoreStyle(normalizeBoreStyle(state.boreStyle));
        }

        const initialIndexedFiles = [
          ...state.storedFiles.map((file) =>
            createIndexedGefFileFromStoredEntry(file),
          ),
          ...state.rememberedFiles.map((file) =>
            createIndexedGefFileFromDatasetEntry(file),
          ),
        ];
        const initialIndexedFileMap = Object.fromEntries(
          initialIndexedFiles.map((file) => [file.filename, file]),
        ) as Record<string, IndexedGefFile>;

        setIndexedGefFiles(initialIndexedFileMap);
        setSelectedFileName("");

        void pruneCachedGefFiles(Object.keys(initialIndexedFileMap)).catch(
          (error) => {
            console.error(error);
          },
        );

        if (state.backupDirectory) {
          await syncDatasetDirectory();
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!isCancelled) {
          setIsRestoring(false);
          setRestoreProgress(null);
        }
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedFileName || loadedGefData[selectedFileName]) {
      return;
    }

    void ensureGefFileLoaded(selectedFileName).catch((error) => {
      console.error(error);
    });
  }, [loadedGefData, selectedFileName]);

  useEffect(() => {
    if (!borePdfExportOptions.includeBorePlotPage) {
      setIsLoadingPdfGraphOptions(false);
      return;
    }

    if (pendingPdfGraphOptionFilenames.length === 0) {
      setIsLoadingPdfGraphOptions(false);
      return;
    }

    let isCancelled = false;

    const loadGraphOptionFiles = async () => {
      setIsLoadingPdfGraphOptions(true);

      try {
        const batchSize = 4;

        for (
          let index = 0;
          index < pendingPdfGraphOptionFilenames.length;
          index += batchSize
        ) {
          if (isCancelled) {
            return;
          }

          const batch = pendingPdfGraphOptionFilenames.slice(
            index,
            index + batchSize,
          );

          await Promise.allSettled(
            batch.map((filename) => ensureGefFileLoaded(filename)),
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPdfGraphOptions(false);
        }
      }
    };

    void loadGraphOptionFiles();

    return () => {
      isCancelled = true;
    };
  }, [
    borePdfExportOptions.includeBorePlotPage,
    pendingPdfGraphOptionFilenames,
  ]);

  useEffect(() => {
    const filenames = Object.keys(indexedGefFiles).sort((left, right) =>
      left.localeCompare(right),
    );

    if (filenames.length === 0) {
      if (selectedFileName) {
        setSelectedFileName("");
      }
      return;
    }

    if (selectedFileName && !indexedGefFiles[selectedFileName]) {
      setSelectedFileName("");
      return;
    }

    if (filenames.length === 1 && !selectedFileName) {
      setSelectedFileName(filenames[0] ?? "");
    }
  }, [indexedGefFiles, selectedFileName]);

  useEffect(() => {
    if (!window.desktopApi) {
      return;
    }

    void window.desktopApi.saveBoreStyle(boreStyle).catch((error) => {
      console.error(error);
    });
  }, [boreStyle]);

  useEffect(() => {
    setSelectedPdfExportFilenames((previous) => {
      const available = new Set(
        exportablePdfFiles.map((file) => file.filename),
      );
      const filtered = previous.filter((filename) => available.has(filename));

      if (filtered.length > 0) {
        return filtered;
      }

      if (selectedFileName && available.has(selectedFileName)) {
        return [selectedFileName];
      }

      if (exportablePdfFiles.length === 1) {
        return exportablePdfFiles.map((file) => file.filename);
      }

      return [];
    });
  }, [exportablePdfFiles, selectedFileName]);

  useEffect(() => {
    setSelectedPdfGraphKeys((previous) => {
      const availableKeys = new Set(
        availablePdfGraphOptions.map((option) => option.key),
      );
      const filtered = previous.filter((key) => availableKeys.has(key));

      if (!hasInitializedGraphSelectionRef.current) {
        if (availablePdfGraphOptions.length === 0) {
          return filtered;
        }

        hasInitializedGraphSelectionRef.current = true;
        return availablePdfGraphOptions.map((option) => option.key);
      }

      if (previous.length === 0) {
        return filtered;
      }

      if (filtered.length > 0 || availablePdfGraphOptions.length === 0) {
        return filtered;
      }

      return availablePdfGraphOptions.map((option) => option.key);
    });
  }, [availablePdfGraphOptions]);

  async function exportSelectedFilesAsPdf() {
    const files = (
      await Promise.all(
        selectedPdfExportFilenames.map(async (filename) => {
          const data = await ensureGefFileLoaded(filename);

          if (
            !data ||
            (data.fileType !== "BORE" &&
              data.fileType !== "CPT" &&
              data.fileType !== "DISS")
          ) {
            return null;
          }

          return {
            filename,
            data,
          } satisfies PdfExportItem;
        }),
      )
    ).filter((item): item is PdfExportItem => item !== null);

    if (files.length === 0) {
      return;
    }

    const hasOtherSections =
      borePdfExportOptions.includeSummaryPage ||
      borePdfExportOptions.includeSpecimensPage ||
      borePdfExportOptions.includeTechnicalInfoPage;
    const hasGraphSections =
      borePdfExportOptions.includeBorePlotPage &&
      selectedPdfGraphKeys.length > 0;

    if (!hasOtherSections && !hasGraphSections) {
      setBorePdfExportStatus(t("borePdfExportSelectAtLeastOnePage"));
      return;
    }

    setIsExportingBorePdfs(true);
    setBorePdfExportStatus(null);

    try {
      const result = await exportSelectedBorePdfs({
        files,
        boreStyle,
        exportOptions: borePdfExportOptions,
        selectedGraphKeys: selectedPdfGraphKeys,
      });

      if (result.savedCount === 0) {
        setBorePdfExportStatus(t("borePdfExportCancelled"));
      } else if (result.directory) {
        setBorePdfExportStatus(
          t("borePdfExportSavedTo", {
            count: result.savedCount,
            directory: result.directory,
          }),
        );
      } else {
        setBorePdfExportStatus(
          t("borePdfExportCompleted", { count: result.savedCount }),
        );
      }
    } catch (error) {
      console.error(error);
      void appendDesktopDebugLog({
        scope: "pdf-export:ui-error",
        message: getErrorMessage(error),
        stack: error instanceof Error ? error.stack : null,
        selectedFilenames: selectedPdfExportFilenames,
      });
      setBorePdfExportStatus(
        `${t("borePdfExportFailed")} ${getErrorMessage(error)}`,
      );
    } finally {
      setIsExportingBorePdfs(false);
    }
  }

  async function exportSelectedGefFiles() {
    if (
      !window.desktopApi?.exportSelectedGefFiles ||
      selectedPdfExportFilenames.length === 0
    ) {
      return;
    }

    setIsExportingGefFiles(true);
    setGefFileExportStatus(null);

    try {
      const result = await window.desktopApi.exportSelectedGefFiles(
        selectedPdfExportFilenames,
      );

      if (!result.directory) {
        setGefFileExportStatus(t("gefExportCancelled"));
      } else if (result.failedCount > 0) {
        setGefFileExportStatus(
          t("gefExportPartiallyCompleted", {
            savedCount: result.savedCount,
            failedCount: result.failedCount,
            directory: result.directory,
          }),
        );
      } else {
        setGefFileExportStatus(
          t("gefExportCompleted", {
            count: result.savedCount,
            directory: result.directory,
          }),
        );
      }
    } catch (error) {
      console.error(error);
      setGefFileExportStatus(
        `${t("gefExportFailed")} ${getErrorMessage(error)}`,
      );
    } finally {
      setIsExportingGefFiles(false);
    }
  }

  const selectedFile = selectedFileName
    ? loadedGefData[selectedFileName]
    : undefined;
  const isSelectedFileLoading =
    selectedFileName !== "" && loadingFileNames.includes(selectedFileName);

  return (
    <div className="pancake">
      <Header />

      <main className="main-grid px-2">
        <div className="mb-2">
          <div className="mb-8">
            <FileTrigger
              acceptedFileTypes={[".gef", ".GEF"]}
              allowsMultiple
              onSelect={(fileList) => {
                handleFiles(fileList).catch((error: unknown) => {
                  console.error(error);
                });
              }}
            >
              <Button
                isPending={isPending}
                className="flex gap-1 items-center justify-center w-full p-2 border border-blue-300 aria-selected:bg-blue-200 data-pressed:bg-blue-200 data-pressed:text-blue-800 rounded-sm bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
              >
                {isPending ? (
                  <>
                    {t("processingFiles")}{" "}
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </>
                ) : (
                  <>
                    {t("chooseFiles")}
                    <UploadIcon size={14} />
                  </>
                )}
              </Button>
            </FileTrigger>

            <div className="text-xs mt-1 text-center">
              <span className=" text-gray-500">{t("or")} </span>
              <Button
                className=" text-blue-500 hover:text-blue-800 underline"
                onPress={() => {
                  loadSampleFiles().catch((error: unknown) => {
                    console.error(error);
                  });
                }}
              >
                {t("loadSampleFiles")}
              </Button>
            </div>
          </div>

          <DesktopBackupCard
            databaseDirectory={databaseDirectory}
            backupDirectory={backupDirectory}
            databaseFileCount={databaseCount}
            backupFileCount={backupCount}
            statusMessage={backupStatus}
            isRestoring={isRestoring}
            restoreProgress={restoreProgress}
            onChooseDatabaseFolder={() => {
              chooseDatabaseDirectory().catch((error: unknown) => {
                console.error(error);
              });
            }}
            onChooseFolder={() => {
              chooseBackupDirectory().catch((error: unknown) => {
                console.error(error);
              });
            }}
            onRefreshFolder={() => {
              refreshBackupDirectory().catch((error: unknown) => {
                console.error(error);
              });
            }}
          />

          <BorePdfExportCard
            exportableFiles={exportablePdfFiles}
            selectedFilenames={selectedPdfExportFilenames}
            availableGraphOptions={availablePdfGraphOptions}
            selectedGraphKeys={selectedPdfGraphKeys}
            exportOptions={borePdfExportOptions}
            isExporting={isExportingBorePdfs}
            isExportingGefFiles={isExportingGefFiles}
            isLoadingGraphOptions={isLoadingPdfGraphOptions}
            statusMessage={borePdfExportStatus}
            gefExportStatusMessage={gefFileExportStatus}
            onToggleFilename={(filename) => {
              setSelectedPdfExportFilenames((previous) =>
                previous.includes(filename)
                  ? previous.filter((value) => value !== filename)
                  : [...previous, filename].sort((left, right) =>
                      left.localeCompare(right),
                    ),
              );
            }}
            onToggleGraphKey={(key) => {
              setSelectedPdfGraphKeys((previous) =>
                previous.includes(key)
                  ? previous.filter((value) => value !== key)
                  : [...previous, key].sort((left, right) =>
                      left.localeCompare(right),
                    ),
              );
            }}
            onToggleExportOption={(option) => {
              setBorePdfExportOptions((previous) => ({
                ...previous,
                [option]: !previous[option],
              }));
            }}
            onSelectAll={() => {
              setSelectedPdfExportFilenames(
                exportablePdfFiles.map((file) => file.filename),
              );
            }}
            onClearSelection={() => {
              setSelectedPdfExportFilenames([]);
            }}
            onSelectAllGraphs={() => {
              setSelectedPdfGraphKeys(
                availablePdfGraphOptions.map((option) => option.key),
              );
            }}
            onClearGraphSelection={() => {
              setSelectedPdfGraphKeys([]);
            }}
            onExport={() => {
              exportSelectedFilesAsPdf().catch((error: unknown) => {
                console.error(error);
              });
            }}
            onExportGefFiles={() => {
              exportSelectedGefFiles().catch((error: unknown) => {
                console.error(error);
              });
            }}
          />

          {failedFiles.length > 0 && (
            <Disclosure className="mb-4 p-4 bg-red-50 border border-red-200 rounded-sm group">
              <Heading level={2}>
                <Button
                  slot="trigger"
                  className="flex items-center gap-1 text-red-800 font-semibold w-full"
                >
                  <ChevronDownIcon
                    size={16}
                    className="transition-transform group-data-[expanded]:rotate-180"
                  />
                  {t("failedToParse", { count: failedFiles.length })}
                </Button>
              </Heading>

              <DisclosurePanel>
                <ul className="space-y-1 mt-2">
                  {failedFiles.map(({ name, error }) => (
                    <li key={name} className="text-sm text-red-700">
                      <span className="font-medium">{name}</span>:{" "}
                      {translateError(error, t)}
                    </li>
                  ))}
                </ul>
              </DisclosurePanel>
            </Disclosure>
          )}

          <FileTable
            indexedGefFiles={indexedGefFiles}
            selectedFileName={selectedFileName}
            onSelectionChange={setSelectedFileName}
            onFileDrop={(files) => {
              handleFiles(files).catch((error: unknown) => {
                console.error(error);
              });
            }}
            onFileRemove={(filename) => {
              setIndexedGefFiles((previous) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { [filename]: _, ...rest } = previous;
                return rest;
              });
              setLoadedGefData((previous) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { [filename]: _, ...rest } = previous;
                return rest;
              });

              if (selectedFileName === filename) {
                const remaining = Object.keys(indexedGefFiles).filter(
                  (f) => f !== filename,
                );
                setSelectedFileName(remaining[0] ?? "");
              }

              if (window.desktopApi) {
                void removeCachedGefFiles([filename]).catch((error) => {
                  console.error(error);
                });
                void window.desktopApi
                  .removeStoredFile(filename)
                  .then((counts) => {
                    setDatabaseDirectory(counts.databaseDirectory);
                    setDatabaseCount(counts.databaseCount);
                    setBackupCount(counts.backupCount);
                  })
                  .catch((error) => {
                    console.error(error);
                  });
              }
            }}
          />

          {Object.keys(indexedGefFiles).length > 0 && (
            <Button
              className="button mt-2 ml-auto transition-colors"
              onPress={() => {
                setIndexedGefFiles({});
                setLoadedGefData({});
                setSelectedFileName("");
                setFailedFiles([]);
                if (window.desktopApi) {
                  void clearCachedGefFiles().catch((error) => {
                    console.error(error);
                  });
                  void window.desktopApi
                    .clearStoredFiles()
                    .then((counts) => {
                      setDatabaseDirectory(counts.databaseDirectory);
                      setDatabaseCount(counts.databaseCount);
                      setBackupCount(counts.backupCount);
                    })
                    .catch((error) => {
                      console.error(error);
                    });
                }
                setBackupStatus(t("databaseCleared"));
              }}
            >
              {t("clearAllFiles")} <TrashIcon size={14} />
            </Button>
          )}

          <div className="mb-6 mt-2">
            <h2 className="text-xl font-semibold mb-3">
              {Object.keys(indexedGefFiles).length === 1
                ? t("location")
                : t("allLocations")}
            </h2>

            <Suspense
              fallback={
                <div className="w-full h-96 rounded-sm border border-gray-300 bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-500">{t("loadingMap")}</span>
                </div>
              }
            >
              <GefMap
                indexedGefFiles={indexedGefFiles}
                selectedFileName={selectedFileName}
                selectedPdfFilenames={selectedPdfExportFilenames}
                onMarkerClick={setSelectedFileName}
                onOpenDinoGef={(dinoNumber) => {
                  void openDinoGef(dinoNumber);
                }}
                onAddPdfSelection={(filenames) => {
                  setSelectedPdfExportFilenames((previous) =>
                    Array.from(new Set([...previous, ...filenames])).sort(
                      (left, right) => left.localeCompare(right),
                    ),
                  );
                }}
                onSetPdfSelection={(filenames) => {
                  setSelectedPdfExportFilenames(filenames);
                }}
              />
            </Suspense>

            <DownloadGeoJSONButton indexedGefFiles={indexedGefFiles} />
          </div>
        </div>

        {selectedFile ? (
          <div className="space-y-6 max-w-full">
            {selectedFile.warnings.length > 0 && (
              <Disclosure className="p-4 bg-amber-50 border border-amber-200 rounded-sm group">
                <Heading level={2}>
                  <Button
                    slot="trigger"
                    className="flex items-center gap-1 text-amber-800 font-semibold w-full"
                  >
                    <ChevronDownIcon
                      size={16}
                      className="transition-transform group-data-[expanded]:rotate-180"
                    />
                    {t("warning", { count: selectedFile.warnings.length })}
                  </Button>
                </Heading>

                <DisclosurePanel>
                  <ul className="space-y-1 mt-2">
                    {selectedFile.warnings.map((warning, i) => (
                      <li key={i} className="text-sm text-amber-700">
                        {translateWarning(warning, t)}
                      </li>
                    ))}
                  </ul>
                </DisclosurePanel>
              </Disclosure>
            )}

            {selectedFile.fileType === "DISS" && (
              <>
                <CompactDissHeader
                  filename={selectedFileName}
                  data={selectedFile}
                />

                <DissPlots
                  data={selectedFile.data}
                  columnInfo={selectedFile.columnInfo}
                  baseFilename={selectedFileName.replace(/\.gef$/i, "")}
                />

                <DetailedDissHeaders data={selectedFile} />
              </>
            )}

            {selectedFile.fileType === "CPT" && (
              <>
                <CompactCptHeader
                  filename={selectedFileName}
                  data={selectedFile}
                />

                <CptPlots
                  data={selectedFile.data}
                  columnInfo={selectedFile.columnInfo}
                  zid={selectedFile.headers.ZID}
                  baseFilename={selectedFileName.replace(/\.gef$/i, "")}
                />

                {selectedFile.preExcavationLayers.length > 0 && (
                  <PreExcavationPlot
                    layers={selectedFile.preExcavationLayers}
                    baseFilename={selectedFileName.replace(/\.gef$/i, "")}
                  />
                )}

                <DetailedCptHeaders data={selectedFile} />
              </>
            )}

            {selectedFile.fileType === "BORE" && (
              <>
                <CompactBoreHeader
                  filename={selectedFileName}
                  data={selectedFile}
                />

                <BorePlot
                  layers={selectedFile.layers}
                  specimens={selectedFile.specimens}
                  baseFilename={selectedFileName.replace(/\.gef$/i, "")}
                  boreStyle={boreStyle}
                  onBoreStyleChange={setBoreStyle}
                  onBoreStyleReset={() => {
                    setBoreStyle(createDefaultBoreStyle());
                  }}
                />

                {selectedFile.specimens.length > 0 && (
                  <SpecimenTable specimens={selectedFile.specimens} />
                )}

                <DetailedBoreHeaders data={selectedFile} />
              </>
            )}
          </div>
        ) : isSelectedFileLoading ? (
          <Card>
            <p className="text-gray-700 font-medium">{t("processingFiles")}</p>
            <p className="text-sm text-gray-500 mt-2">{selectedFileName}</p>
          </Card>
        ) : Object.keys(indexedGefFiles).length > 0 ? (
          <SelectFileMessage />
        ) : (
          <MarketingMessage />
        )}
      </main>
      <Footer />
    </div>
  );
}

function SelectFileMessage() {
  const { t } = useTranslation();

  return (
    <Card>
      <p className="text-gray-700 font-medium">{t("selectFileForDetails")}</p>
      <p className="mt-2 text-sm text-gray-500">
        {t("selectFileForDetailsDescription")}
      </p>
    </Card>
  );
}

function MarketingMessage() {
  const { t } = useTranslation();
  return (
    <Card>
      <p className="text-gray-600 mb-4">{t("uploadGefFile")}</p>

      <div className="text-sm text-gray-500">
        <p className="mb-2">{t("freeToolByBedrock")}</p>

        <ul className="list-disc list-inside space-y-1 ">
          <li>{t("customWebApps")}</li>
          <li>{t("bimCadIntegrations")}</li>
          <li>{t("pythonAutomation")}</li>
        </ul>

        <p className="mt-3">
          {t("emptyStateContact")}{" "}
          <a
            href="mailto:info@bedrock.engineer"
            className="text-blue-500 hover:underline font-medium"
          >
            {t("contactUs")} info@bedrock.engineer
          </a>
        </p>
      </div>
    </Card>
  );
}

function Header() {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = async () => {
    const newLang = i18n.language === "nl" ? "en" : "nl";
    await i18n.changeLanguage(newLang);
    window.localStorage.setItem("bedrock-gef-viewer-language", newLang);
  };

  return (
    <header className="mb-6 border-b border-gray-300 py-4 px-2">
      <div
        style={{ maxWidth: "clamp(360px, 100%, 1800px)" }}
        className=" mx-auto flex justify-between items-center"
      >
        <h1
          className="text-3xl flex gap-2 items-center"
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          <img src="bedrock.svg" width={30} /> {t("appTitle")}
        </h1>

        <button
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 transition-colors"
          onClick={() => {
            handleLanguageChange().catch((error: unknown) => {
              console.error(error);
            });
          }}
        >
          {i18n.language === "nl" ? "English" : "Nederlands"}
        </button>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="mt-8 py-8 border-t border-gray-300 text-sm text-gray-500">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 mb-3">{t("about")}</h3>

            <p className="text-sm">{t("appDescription")}</p>

            <p className="text-sm">
              {t("privacyNote")} {t("offlineNote")}{" "}
            </p>

            <p>
              <Suspense fallback="Checking...">
                <InstallInstructions />
              </Suspense>
            </p>

            <a
              className="hover:underline flex gap-1 items-center text-md mt-2"
              href="https://bedrock.engineer"
            >
              <img
                src="bedrock.svg"
                width="16px"
                height="16px"
                alt="Bedrock logo"
              />
              Bedrock.engineer
            </a>

            <a
              className="text-blue-400 hover:underline flex gap-1 items-center text-sm mt-2"
              href="https://bro.bedrock.engineer"
            >
              Bedrock BRO/XML viewer
            </a>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 mb-3">{t("contact")}</h3>
            <div>
              <p className="text-sm mb-1">
                {t("needSimilarApp")}
                <br />
                {t("contactUs")}:
                <a
                  href="mailto:info@bedrock.engineer"
                  className="text-blue-400 hover:underline font-medium ml-1"
                >
                  info@bedrock.engineer
                </a>
              </p>
            </div>

            <div>
              <p className="text-sm mb-1 inline-flex">
                {t("feedbackOrRequests")}
              </p>

              <a
                className="flex gap-1 items-center text-blue-400 hover:underline font-medium"
                href="https://github.com/bedrock-engineer/gef-app/issues"
              >
                <GithubIcon size={14} /> Github Issues
              </a>

              <a
                href="mailto:jules.blom@bedrock.engineer"
                className="flex gap-1 items-center text-blue-400 hover:underline font-medium"
              >
                <MailIcon size={12} /> jules.blom@bedrock.engineer
              </a>

              <a
                href="https://www.linkedin.com/company/bedrock-engineer/"
                className="flex gap-1 items-center text-blue-400 hover:underline font-medium"
              >
                <LinkedinIcon size={14} />
                LinkedIn
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-300">
          <p className="text-gray-400 text-xs text-center">{t("disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}

