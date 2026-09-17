import { parseGefFile, type GefData } from "@bedrock-engineer/gef-parser";

const EMPTY_TEXT_PLACEHOLDER = "__GEF_EMPTY_TEXT_PLACEHOLDER__";

function shouldRetryWithSanitizedTextHeaders(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    message.includes("#MEASUREMENTTEXT") || message.includes("#SPECIMENTEXT")
  );
}

function sanitizeMalformedTextHeaders(content: string): {
  content: string;
  changed: boolean;
} {
  const usesWindowsLineEndings = content.includes("\r\n");
  const newline = usesWindowsLineEndings ? "\r\n" : "\n";
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let changed = false;
  let isInHeader = true;

  const nextLines = lines.map((line) => {
    if (!isInHeader) {
      return line;
    }

    const trimmed = line.trim();

    if (/^#EOH\s*=/i.test(trimmed)) {
      isInHeader = false;
      return line;
    }

    if (!/^#(?:MEASUREMENTTEXT|SPECIMENTEXT)\s*=/i.test(trimmed)) {
      return line;
    }

    const nextLine = line.replace(
      /,\s*,/g,
      `, ${EMPTY_TEXT_PLACEHOLDER},`,
    );

    if (nextLine !== line) {
      changed = true;
    }

    return nextLine;
  });

  return {
    content: changed ? nextLines.join(newline) : content,
    changed,
  };
}

function restoreSanitizedStrings<T>(value: T): T {
  if (typeof value === "string") {
    return (value === EMPTY_TEXT_PLACEHOLDER ? "" : value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => restoreSanitizedStrings(entry)) as T;
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      (value as Record<string, unknown>)[key] = restoreSanitizedStrings(entry);
    }
  }

  return value;
}

export async function parseGefFileCompat(file: File): Promise<GefData> {
  try {
    return await parseGefFile(file);
  } catch (error) {
    if (!shouldRetryWithSanitizedTextHeaders(error)) {
      throw error;
    }

    const sanitized = sanitizeMalformedTextHeaders(await file.text());

    if (!sanitized.changed) {
      throw error;
    }

    const sanitizedFile = new File([sanitized.content], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });

    return restoreSanitizedStrings(await parseGefFile(sanitizedFile));
  }
}

