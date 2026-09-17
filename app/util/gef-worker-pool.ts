import type { GefData } from "@bedrock-engineer/gef-parser";
import { parseGefFileCompat } from "./gef-parse-compat";

interface ParseResultSuccess {
  status: "fulfilled";
  value: GefData;
}

interface ParseResultFailure {
  status: "rejected";
  reason: string;
}

export type ParseResult = ParseResultSuccess | ParseResultFailure;

interface ParseWorkerResponseSuccess {
  id: number;
  status: "fulfilled";
  value: GefData;
}

interface ParseWorkerResponseFailure {
  id: number;
  status: "rejected";
  error: string;
}

type ParseWorkerResponse =
  | ParseWorkerResponseSuccess
  | ParseWorkerResponseFailure;

interface ParseGefFilesWithWorkerPoolOptions {
  onProgress?: (processed: number, total: number) => void;
  maxConcurrency?: number;
}

function getWorkerConcurrency(fileCount: number, maxConcurrency?: number): number {
  const availableCores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 4;
  const desiredConcurrency = Math.max(
    2,
    Math.min(availableCores - 1, 6, fileCount),
  );

  if (typeof maxConcurrency === "number") {
    return Math.max(1, Math.min(desiredConcurrency, maxConcurrency, fileCount));
  }

  return desiredConcurrency;
}

async function parseGefFilesDirectly(
  files: Array<File>,
  options: ParseGefFilesWithWorkerPoolOptions,
): Promise<Array<ParseResult>> {
  const results: Array<ParseResult> = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;

    try {
      const value = await parseGefFileCompat(file);
      results.push({
        status: "fulfilled",
        value,
      });
    } catch (error) {
      results.push({
        status: "rejected",
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    options.onProgress?.(index + 1, files.length);
  }

  return results;
}

export async function parseGefFilesWithWorkerPool(
  files: Array<File>,
  options: ParseGefFilesWithWorkerPoolOptions = {},
): Promise<Array<ParseResult>> {
  if (files.length === 0) {
    return [];
  }

  if (typeof Worker === "undefined" || files.length < 8) {
    return parseGefFilesDirectly(files, options);
  }

  const concurrency = getWorkerConcurrency(files.length, options.maxConcurrency);

  if (concurrency <= 1) {
    return parseGefFilesDirectly(files, options);
  }

  const results: Array<ParseResult> = new Array(files.length);
  const workers = Array.from(
    { length: concurrency },
    () =>
      new Worker(new URL("./gef-parse.worker.ts", import.meta.url), {
        type: "module",
      }),
  );

  return new Promise((resolve, reject) => {
    let nextIndex = 0;
    let completed = 0;
    let hasFailed = false;

    const cleanup = () => {
      workers.forEach((worker) => {
        worker.terminate();
      });
    };

    const assignWork = (worker: Worker) => {
      if (hasFailed) {
        return;
      }

      if (nextIndex >= files.length) {
        return;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;

      worker.postMessage({
        id: currentIndex,
        file: files[currentIndex],
      });
    };

    workers.forEach((worker) => {
      worker.onerror = () => {
        if (hasFailed) {
          return;
        }

        hasFailed = true;
        cleanup();
        reject(new Error("GEF worker parsing failed."));
      };

      worker.onmessage = (event: MessageEvent<ParseWorkerResponse>) => {
        if (hasFailed) {
          return;
        }

        const response = event.data;

        results[response.id] =
          response.status === "fulfilled"
            ? {
                status: "fulfilled",
                value: response.value,
              }
            : {
                status: "rejected",
                reason: response.error,
              };

        completed += 1;
        options.onProgress?.(completed, files.length);

        if (completed >= files.length) {
          cleanup();
          resolve(results);
          return;
        }

        assignWork(worker);
      };

      assignWork(worker);
    });
  });
}

