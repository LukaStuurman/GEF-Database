import type { GefData } from "@bedrock-engineer/gef-parser";
import { parseGefFileCompat } from "./gef-parse-compat";

interface ParseWorkerRequest {
  id: number;
  file: File;
}

type ParseWorkerResponse =
  | {
      id: number;
      status: "fulfilled";
      value: GefData;
    }
  | {
      id: number;
      status: "rejected";
      error: string;
    };

self.onmessage = async (event: MessageEvent<ParseWorkerRequest>) => {
  const { id, file } = event.data;

  try {
    const value = await parseGefFileCompat(file);
    const response: ParseWorkerResponse = {
      id,
      status: "fulfilled",
      value,
    };

    self.postMessage(response);
  } catch (error) {
    const response: ParseWorkerResponse = {
      id,
      status: "rejected",
      error: error instanceof Error ? error.message : String(error),
    };

    self.postMessage(response);
  }
};

